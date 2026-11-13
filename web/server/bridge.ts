import express, { Request, Response } from 'express';
import * as http from 'http';
import * as net from 'net';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'node:path';
import { Classroom } from './classroom.js';
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
  initialStock?: number;
  adminPassword?: string;
  manageBackend?: boolean;
  serverPath?: string;
}

export interface TapeLogEntry {
  id: string;
  timestamp: string;
  command: string;
  rawResponse: string;
  status: 'OK' | 'SOLD_OUT' | 'BUSY' | 'ERR' | 'MALFORMED' | 'TIMEOUT' | 'STATUS';
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
  private classroom: Classroom;
  private inFlight = 0;
  private initialStock?: number;

  constructor(options: BridgeOptions = {}) {
    this.backendHost = options.backendHost ?? PROTOCOL_CONFIG.DEFAULT_BACKEND_HOST;
    this.backendPort = options.backendPort ?? PROTOCOL_CONFIG.DEFAULT_BACKEND_PORT;
    this.bridgePort = options.bridgePort ?? PROTOCOL_CONFIG.DEFAULT_BRIDGE_PORT;

    this.app = express();
    this.app.set('trust proxy', 'loopback');
    this.initialStock = options.initialStock;
    this.app.use(express.json());

    this.classroom = new Classroom(this.app, this, options);
    this.setupRoutes();
    this.app.use(express.static(path.resolve('dist')));
    this.app.get('/', (_req, res) => res.sendFile(path.resolve('dist/index.html')));
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

  public get pendingRequests() { return this.inFlight; }

  private setupRoutes() {
    // Mutating dashboard operations and detailed status require an admin session.
    this.app.use('/api', (req, res, next) => {
      if (req.method !== 'GET' && this.classroom.isChanging) {res.status(409).json({error:'Round is changing'});return;}
      if (req.path === '/health' || this.classroom.isAdmin(req)) return next();
      res.status(401).json({ error: 'Admin login required' });
    });
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
      const count = req.body.count ?? 10;
      if (!Number.isInteger(count) || count < 1 || count > 50) { res.status(400).json({error:'count must be 1..50'}); return; }
      const results = await this.sendConcurrentTcpRequests('BOOK', count);
      res.json({ count, results, stats: this.stats });
    });

    // Reset counters endpoint
    this.app.post('/api/reset', async (_req: Request, res: Response) => {
      const result = await this.requestReset();
      res.status(result.success ? 200 : 409).json(result);
    });

    // Status query endpoint
    this.app.get('/api/status', async (_req: Request, res: Response) => {
      res.json({ success: true, stats: this.getStats(), scope: 'bridge-observed orders', backendConnected: this.backendConnected });
    });

    // Malformed request test endpoint
    this.app.post('/api/bad-request', async (_req: Request, res: Response) => {
      const entry = await this.sendSingleTcpRequest('MALFORMED_COMMAND');
      res.json(entry);
    });
  }

  public setInitialStock(stock: number) { this.initialStock = stock; }

  public async requestReset() {
    if (this.inFlight) return { success: false, error: 'Wait for pending orders before resetting' };
    try {
      if (await this.classroom.restartManaged()) return {success:true,stats:this.stats};
    } catch (error) {
      const message = (error as Error).message;
      this.broadcast({type:'ACTION_ERROR',message});
      return {success:false,error:message,stats:this.stats};
    }
    const entry = await this.sendSingleTcpRequest('RESET');
    const success = entry.rawResponse === 'OK RESET';
    if (success) { this.resetStats(); this.broadcast({type:'RESET_STATE',stats:this.stats}); }
    else this.broadcast({type:'ACTION_ERROR', message:'Backend rejected reset. Start a new managed round to restore inventory.'});
    return {success, entry, stats:this.stats};
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
    this.inFlight++;
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
        this.inFlight--;
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

        if (command === 'BOOK' || command === 'MALFORMED_COMMAND') this.updateStats(logEntry);
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
    if (!Number.isInteger(count) || count < 1 || count > 50) throw new Error('count must be 1..50');
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
    if (this.initialStock !== undefined && this.stats.booked > this.initialStock) {
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
    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer(this.app);
      this.wss = new WebSocketServer({ server: this.httpServer, maxPayload: 65536 });

      this.httpServer.once('error', reject);
      this.wss.on('connection', (ws: WebSocket, request) => {
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
            if (!this.classroom.isAdmin(request)) { ws.send(JSON.stringify({type:'ACTION_ERROR',message:'Admin login required'})); return; }
            if(this.classroom.isChanging) {ws.send(JSON.stringify({type:'ACTION_ERROR',message:'Round is changing'}));return;}
            const data = JSON.parse(raw.toString());
            if (data.type === 'BOOK') {
              await this.sendSingleTcpRequest('BOOK');
            } else if (data.type === 'BURST') {
              const count = data.count ?? 10;
              await this.sendConcurrentTcpRequests('BOOK', count);
            } else if (data.type === 'BAD_REQUEST') {
              await this.sendSingleTcpRequest('MALFORMED_COMMAND');
            } else if (data.type === 'RESET') {
              await this.requestReset();
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

      this.httpServer.listen(this.bridgePort, '0.0.0.0', () => {
        console.log(`[Bridge Server] Running on http://127.0.0.1:${this.bridgePort} (Relaying to TCP ${this.backendHost}:${this.backendPort})`);
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    await this.classroom.stop();
    return new Promise((resolve) => {
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
        this.healthCheckTimer = null;
      }
      if (this.wss) {
        this.wss.clients.forEach(client => client.terminate());
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

