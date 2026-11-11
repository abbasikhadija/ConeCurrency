import express, { Request, Response } from 'express';
import * as http from 'http';
import * as net from 'net';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import {
  PROTOCOL_CONFIG,
  parseProtocolResponse,
  serializeProtocolRequest,
  ParsedProtocolResponse,
} from '../src/config/protocol.js';

export interface BridgeOptions {
  backendHost?: string;
  backendPort?: number;
  bridgePort?: number;
}

export interface TapeLogEntry {
  id: string;
  timestamp: string;
  command: string;
  rawResponse: string;
  status: 'OK' | 'SOLD_OUT' | 'BUSY' | 'ERR' | 'MALFORMED' | 'TIMEOUT';
  ticketId?: string;
  reason?: string;
  latencyMs: number;
}

export interface BridgeStats {
  booked: number;
  soldOut: number;
  busy: number;
  bad: number;
  avgLatencyMs: number;
  totalRequests: number;
  seenTicketIds: string[];
  raceConditionDetected: boolean;
}

export class BridgeServer {
  private app: express.Application;
  private httpServer: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private backendHost: string;
  private backendPort: number;
  private bridgePort: number;
  private backendConnected: boolean = false;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  private stats: BridgeStats = {
    booked: 0,
    soldOut: 0,
    busy: 0,
    bad: 0,
    avgLatencyMs: 0.0,
    totalRequests: 0,
    seenTicketIds: [],
    raceConditionDetected: false,
  };

  private latencies: number[] = [];

  constructor(options: BridgeOptions = {}) {
    this.backendHost = options.backendHost ?? PROTOCOL_CONFIG.DEFAULT_BACKEND_HOST;
    this.backendPort = options.backendPort ?? PROTOCOL_CONFIG.DEFAULT_BACKEND_PORT;
    this.bridgePort = options.bridgePort ?? PROTOCOL_CONFIG.DEFAULT_BRIDGE_PORT;

    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());

    this.setupRoutes();
  }

  public getApp(): express.Application {
    return this.app;
  }

  public getStats(): BridgeStats {
    return { ...this.stats };
  }

  public isBackendConnected(): boolean {
    return this.backendConnected;
  }

  private setupRoutes() {
    // Health and Backend Status
    this.app.get('/api/health', (_req: Request, res: Response) => {
      res.json({
        status: 'ok',
        backend: {
          host: this.backendHost,
          port: this.backendPort,
          connected: this.backendConnected,
        },
        stats: this.stats,
      });
    });

    // Single Booking endpoint
    this.app.post('/api/book', async (_req: Request, res: Response) => {
      const entry = await this.sendSingleTcpRequest('BOOK');
      res.json(entry);
    });

    // Parallel Burst endpoint (Rush Hour / Flash Mob)
    this.app.post('/api/burst', async (req: Request, res: Response) => {
      const count = Math.min(Math.max(parseInt(req.body.count || '10', 10), 1), 50);
      const results = await this.sendConcurrentTcpRequests('BOOK', count);
      res.json({ count, results, stats: this.stats });
    });

    // Reset counters endpoint
    this.app.post('/api/reset', async (_req: Request, res: Response) => {
      const entry = await this.sendSingleTcpRequest('RESET');
      this.resetStats();
      this.broadcast({
        type: 'RESET_STATE',
        stats: this.stats,
      });
      res.json({ success: true, entry, stats: this.stats });
    });

    // Status query endpoint
    this.app.get('/api/status', async (_req: Request, res: Response) => {
      const entry = await this.sendSingleTcpRequest('STATUS');
      res.json({ entry, stats: this.stats });
    });

    // Malformed request test endpoint
    this.app.post('/api/bad-request', async (_req: Request, res: Response) => {
      const entry = await this.sendSingleTcpRequest('MALFORMED_COMMAND');
      res.json(entry);
    });
  }

  public resetStats() {
    this.stats = {
      booked: 0,
      soldOut: 0,
      busy: 0,
      bad: 0,
      avgLatencyMs: 0.0,
      totalRequests: 0,
      seenTicketIds: [],
      raceConditionDetected: false,
    };
    this.latencies = [];
  }

  /**
   * Executes a single TCP connection and transaction against the backend.
   */
  public sendSingleTcpRequest(command: string): Promise<TapeLogEntry> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });

      const client = new net.Socket();
      client.setTimeout(PROTOCOL_CONFIG.TIMEOUT_MS);

      let rawResponse = '';
      let isSettled = false;

      const finish = (raw: string, timeout = false) => {
        if (isSettled) return;
        isSettled = true;
        client.destroy();

        const end = process.hrtime.bigint();
        const latencyMs = Number(end - start) / 1_000_000.0;

        let parsed: ParsedProtocolResponse;
        if (timeout) {
          parsed = { raw: 'TIMEOUT', status: 'ERR', reason: 'Socket connection timed out' };
        } else {
          parsed = parseProtocolResponse(raw);
        }

        const logEntry: TapeLogEntry = {
          id,
          timestamp,
          command,
          rawResponse: parsed.raw.trim(),
          status: parsed.status as any,
          ticketId: parsed.ticketId,
          reason: parsed.reason,
          latencyMs,
        };

        this.updateStats(logEntry);
        this.broadcast({
          type: 'TAPE_ENTRY',
          entry: logEntry,
          stats: this.stats,
        });

        resolve(logEntry);
      };

      client.connect(this.backendPort, this.backendHost, () => {
        this.setBackendConnected(true);
        client.write(serializeProtocolRequest(command));
      });

      client.on('data', (data) => {
        rawResponse += data.toString('ascii');
        if (rawResponse.includes('\n')) {
          finish(rawResponse);
        }
      });

      client.on('timeout', () => {
        finish('ERR TIMEOUT\n', true);
      });

      client.on('error', (err) => {
        this.setBackendConnected(false);
        finish(`ERR ${err.message}\n`);
      });

      client.on('close', () => {
        if (!isSettled) {
          finish(rawResponse || 'ERR CONNECTION_CLOSED\n');
        }
      });
    });
  }

  /**
   * Fires N parallel TCP socket connections concurrently to test backend lock contention.
   */
  public async sendConcurrentTcpRequests(command: string, count: number): Promise<TapeLogEntry[]> {
    const promises: Promise<TapeLogEntry>[] = [];
    for (let i = 0; i < count; i++) {
      promises.push(this.sendSingleTcpRequest(command));
    }
    return Promise.all(promises);
  }

  private updateStats(entry: TapeLogEntry) {
    this.stats.totalRequests++;

    if (entry.status === 'OK') {
      this.stats.booked++;
      if (entry.ticketId) {
        if (this.stats.seenTicketIds.includes(entry.ticketId)) {
          // DUPLICATE TICKET ID -> RACE CONDITION DETECTED!
          this.stats.raceConditionDetected = true;
        } else {
          this.stats.seenTicketIds.push(entry.ticketId);
        }
      }
    } else if (entry.status === 'SOLD_OUT') {
      this.stats.soldOut++;
    } else if (entry.status === 'BUSY') {
      this.stats.busy++;
    } else {
      this.stats.bad++;
    }

    // Check consistency: if total booked > initial stock (e.g. 50), flag race condition!
    if (this.stats.booked > PROTOCOL_CONFIG.DEFAULT_STOCK) {
      this.stats.raceConditionDetected = true;
    }

    if (entry.latencyMs > 0) {
      this.latencies.push(entry.latencyMs);
      if (this.latencies.length > 50) this.latencies.shift(); // Keep rolling window
      const sum = this.latencies.reduce((a, b) => a + b, 0);
      this.stats.avgLatencyMs = parseFloat((sum / this.latencies.length).toFixed(1));
    }
  }

  private setBackendConnected(connected: boolean) {
    if (this.backendConnected !== connected) {
      this.backendConnected = connected;
      this.broadcast({
        type: 'BACKEND_STATUS',
        connected,
        stats: this.stats,
      });
    }
  }

  private probeBackend(): Promise<boolean> {
    return new Promise((resolve) => {
      const probe = new net.Socket();
      probe.setTimeout(1000);

      probe.connect(this.backendPort, this.backendHost, () => {
        probe.destroy();
        resolve(true);
      });

      probe.on('error', () => {
        probe.destroy();
        resolve(false);
      });

      probe.on('timeout', () => {
        probe.destroy();
        resolve(false);
      });
    });
  }

  public broadcast(message: any) {
    if (!this.wss) return;
    const data = JSON.stringify(message);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer = http.createServer(this.app);
      this.wss = new WebSocketServer({ server: this.httpServer });

      this.wss.on('connection', (ws: WebSocket) => {
        // Send initial state upon connection
        ws.send(
          JSON.stringify({
            type: 'INIT_STATE',
            connected: this.backendConnected,
            stats: this.stats,
          })
        );

        ws.on('message', async (raw: string) => {
          try {
            const data = JSON.parse(raw.toString());
            if (data.type === 'BOOK') {
              await this.sendSingleTcpRequest('BOOK');
            } else if (data.type === 'BURST') {
              const count = parseInt(data.count || '10', 10);
              await this.sendConcurrentTcpRequests('BOOK', count);
            } else if (data.type === 'BAD_REQUEST') {
              await this.sendSingleTcpRequest('MALFORMED_COMMAND');
            } else if (data.type === 'RESET') {
              await this.sendSingleTcpRequest('RESET');
              this.resetStats();
              this.broadcast({ type: 'RESET_STATE', stats: this.stats });
            }
          } catch (e) {
            // ignore bad JSON
          }
        });
      });

      // Background health check probe every 2.5s
      this.healthCheckTimer = setInterval(async () => {
        const isUp = await this.probeBackend();
        this.setBackendConnected(isUp);
      }, 2500);

      this.httpServer.listen(this.bridgePort, () => {
        console.log(`[Bridge Server] Running on http://127.0.0.1:${this.bridgePort} (Relaying to TCP ${this.backendHost}:${this.backendPort})`);
        resolve();
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
        this.healthCheckTimer = null;
      }
      if (this.wss) {
        this.wss.close();
      }
      if (this.httpServer) {
        this.httpServer.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

