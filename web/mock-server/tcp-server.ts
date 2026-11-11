import * as net from 'net';
import { PROTOCOL_CONFIG } from '../src/config/protocol.js';

export interface MockServerOptions {
  port?: number;
  host?: string;
  stock?: number;
  maxWorkers?: number;
  maxQueue?: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  allowRaceCondition?: boolean;
}

export class MockTcpServer {
  private server: net.Server | null = null;
  private port: number;
  private host: string;
  private stock: number;
  private initialStock: number;
  private bookedCount: number = 0;
  private soldOutCount: number = 0;
  private busyCount: number = 0;
  private badCount: number = 0;

  private activeWorkers: number = 0;
  private maxWorkers: number;
  private maxQueue: number;

  // Real Bounded Queue simulation
  private queue: Array<{ socket: net.Socket; command: string }> = [];

  private minDelayMs: number;
  private maxDelayMs: number;
  private allowRaceCondition: boolean;

  // Mutex lock
  private mutexLocked: boolean = false;
  private mutexWaiters: Array<() => void> = [];

  constructor(options: MockServerOptions = {}) {
    this.port = options.port ?? PROTOCOL_CONFIG.DEFAULT_BACKEND_PORT;
    this.host = options.host ?? PROTOCOL_CONFIG.DEFAULT_BACKEND_HOST;
    this.stock = options.stock ?? PROTOCOL_CONFIG.DEFAULT_STOCK;
    this.initialStock = this.stock;
    this.maxWorkers = options.maxWorkers ?? 4;
    this.maxQueue = options.maxQueue ?? 8;
    this.minDelayMs = options.minDelayMs ?? 15;
    this.maxDelayMs = options.maxDelayMs ?? 35;
    this.allowRaceCondition = options.allowRaceCondition ?? false;
  }

  private async acquireMutex(): Promise<() => void> {
    if (this.allowRaceCondition) {
      return () => {};
    }

    if (!this.mutexLocked) {
      this.mutexLocked = true;
      return () => this.releaseMutex();
    }

    return new Promise((resolve) => {
      this.mutexWaiters.push(() => {
        this.mutexLocked = true;
        resolve(() => this.releaseMutex());
      });
    });
  }

  private releaseMutex(): void {
    if (this.mutexWaiters.length > 0) {
      const next = this.mutexWaiters.shift()!;
      next();
    } else {
      this.mutexLocked = false;
    }
  }

  public getStats() {
    return {
      stock: this.stock,
      initialStock: this.initialStock,
      booked: this.bookedCount,
      soldOut: this.soldOutCount,
      busy: this.busyCount,
      bad: this.badCount,
      activeWorkers: this.activeWorkers,
      queued: this.queue.length,
    };
  }

  public reset(newStock?: number) {
    this.stock = newStock ?? this.initialStock;
    this.bookedCount = 0;
    this.soldOutCount = 0;
    this.busyCount = 0;
    this.badCount = 0;
    this.activeWorkers = 0;
    this.queue = [];
  }

  public setUnsafeMode(enabled: boolean) {
    this.allowRaceCondition = enabled;
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => this.handleConnection(socket));

      this.server.on('error', (err) => {
        reject(err);
      });

      this.server.listen(this.port, this.host, () => {
        console.log(`[Mock TCP Backend] Listening on ${this.host}:${this.port} (Stock: ${this.stock}, Workers: ${this.maxWorkers}, Queue: ${this.maxQueue})`);
        resolve();
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private handleConnection(socket: net.Socket) {
    let buffer = '';

    socket.on('data', (chunk) => {
      buffer += chunk.toString('ascii');

      const newlineIndex = buffer.indexOf('\n');
      if (newlineIndex === -1) {
        if (buffer.length > PROTOCOL_CONFIG.MAX_REQ_BYTES) {
          this.badCount++;
          socket.write('ERR BAD_REQUEST\n');
          socket.end();
        }
        return;
      }

      const rawCommand = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      const command = rawCommand.trim();

      // Check Queue Capacity (Load Shedding -> BUSY)
      if (command === 'BOOK') {
        if (this.activeWorkers >= this.maxWorkers) {
          if (this.queue.length >= this.maxQueue) {
            // Queue full -> Shed load immediately!
            this.busyCount++;
            socket.write('BUSY\n');
            socket.end();
            return;
          }
          // Enqueue for next available worker
          this.queue.push({ socket, command });
          return;
        }

        // Available worker picks it up
        this.activeWorkers++;
        this.executeWorker(socket, command);
      } else {
        // Non-booking commands execute immediately
        this.executeImmediate(socket, command);
      }
    });

    socket.on('error', () => {
      // Ignore client aborts
    });
  }

  private async executeImmediate(socket: net.Socket, command: string) {
    if (command === 'STATUS') {
      const resp = `STATUS ${this.bookedCount} ${this.soldOutCount} ${this.busyCount}\n`;
      socket.write(resp);
      socket.end();
      return;
    }

    if (command === 'RESET') {
      this.reset();
      socket.write('OK RESET\n');
      socket.end();
      return;
    }

    this.badCount++;
    if (socket.writable) {
      socket.write('ERR BAD_REQUEST\n');
    }
    socket.end();
  }

  private async executeWorker(socket: net.Socket, command: string) {
    try {
      const jitter = Math.floor(Math.random() * (this.maxDelayMs - this.minDelayMs + 1)) + this.minDelayMs;
      await new Promise((r) => setTimeout(r, jitter));

      const unlock = await this.acquireMutex();
      let reply = '';

      if (this.stock > 0) {
        if (this.allowRaceCondition) {
          await new Promise((r) => setTimeout(r, 10));
        }

        this.stock--;
        this.bookedCount++;
        const ticketId = `CONE-${String(this.bookedCount).padStart(4, '0')}`;
        reply = `OK ${ticketId}\n`;
      } else {
        this.soldOutCount++;
        reply = 'SOLD_OUT\n';
      }

      unlock();

      if (socket.writable) {
        socket.write(reply);
      }
    } finally {
      socket.end();

      // Check if another client is waiting in queue
      if (this.queue.length > 0) {
        const next = this.queue.shift()!;
        this.executeWorker(next.socket, next.command);
      } else {
        this.activeWorkers = Math.max(0, this.activeWorkers - 1);
      }
    }
  }
}
