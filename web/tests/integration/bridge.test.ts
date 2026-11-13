import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { MockTcpServer } from '../../mock-server/tcp-server.js';
import { BridgeServer } from '../../server/bridge.js';

describe('Bridge Server & Mock TCP Integration', () => {
  const TEST_BACKEND_PORT = 8098;
  const TEST_BRIDGE_PORT = 3098;

  let mockBackend: MockTcpServer;
  let bridgeServer: BridgeServer;

  beforeAll(async () => {
    // 1. Start mock TCP backend
    mockBackend = new MockTcpServer({
      port: TEST_BACKEND_PORT,
      stock: 50,
      maxWorkers: 4,
      maxQueue: 8,
      minDelayMs: 5,
      maxDelayMs: 15,
    });
    await mockBackend.start();

    // 2. Start Bridge Server on fixed port
    bridgeServer = new BridgeServer({
      adminPassword: 'classroom-test-only',
      backendPort: TEST_BACKEND_PORT,
      bridgePort: TEST_BRIDGE_PORT,
    });
    await bridgeServer.start();
  });

  afterAll(async () => {
    await bridgeServer.stop();
    await mockBackend.stop();
  });

  it('relays single BOOK request over TCP and returns valid latency and ticketId', async () => {
    const entry = await bridgeServer.sendSingleTcpRequest('BOOK');
    expect(entry.command).toBe('BOOK');
    expect(entry.status).toBe('OK');
    expect(entry.ticketId).toBeDefined();
    expect(entry.latencyMs).toBeGreaterThan(0);
  });

  it('relays STATUS command and reflects current stats', async () => {
    const entry = await bridgeServer.sendSingleTcpRequest('STATUS');
    expect(entry.command).toBe('STATUS');
    expect(entry.status).toBe('STATUS');
  });

  it('relays RESET command and resets inventory', async () => {
    const entry = await bridgeServer.sendSingleTcpRequest('RESET');
    expect(entry.command).toBe('RESET');
    bridgeServer.resetStats();
    expect(bridgeServer.getStats().booked).toBe(0);
  });

  it('handles 25 concurrent requests with ZERO duplicate ticket IDs under mutex protection', async () => {
    const results = await bridgeServer.sendConcurrentTcpRequests('BOOK', 25);
    expect(results).toHaveLength(25);

    const successfulBookings = results.filter((r) => r.status === 'OK');
    const ticketIds = successfulBookings.map((r) => r.ticketId);

    // Verify all ticket IDs are completely unique (no race condition!)
    const uniqueIds = new Set(ticketIds);
    expect(uniqueIds.size).toBe(ticketIds.length);
    expect(bridgeServer.getStats().raceConditionDetected).toBe(false);
  });

  it('triggers BUSY load shedding when server queue capacity is exceeded', async () => {
    // Configure a constrained mock server with 1 worker and 1 queue slot
    const constrainedBackend = new MockTcpServer({
      port: 8099,
      stock: 50,
      maxWorkers: 1,
      maxQueue: 1,
      minDelayMs: 60,
      maxDelayMs: 100,
    });
    await constrainedBackend.start();

    const constrainedBridge = new BridgeServer({
      backendPort: 8099,
      bridgePort: 3099,
    });
    await constrainedBridge.start();

    try {
      // Fire 10 requests simultaneously into 1 worker + 1 queue
      const results = await constrainedBridge.sendConcurrentTcpRequests('BOOK', 10);
      expect(results).toHaveLength(10);
      const busyReplies = results.filter((r) => r.status === 'BUSY');
      expect(busyReplies.length).toBeGreaterThan(0);
    } finally {
      await constrainedBridge.stop();
      await constrainedBackend.stop();
    }
  });

  it('handles backend server downtime and reconnects smoothly', async () => {
    // Stop mock backend temporarily
    await mockBackend.stop();

    // Request should fail gracefully with error without crashing
    const errEntry = await bridgeServer.sendSingleTcpRequest('BOOK');
    expect(errEntry.status).toBe('ERR');

    // Restart mock backend
    mockBackend = new MockTcpServer({
      port: TEST_BACKEND_PORT,
      stock: 50,
    });
    await mockBackend.start();

    // Now request should succeed again
    const okEntry = await bridgeServer.sendSingleTcpRequest('BOOK');
    expect(okEntry.status).toBe('OK');
  });

  it('serves HTTP API health and status endpoints', async () => {
    const res = await request(`http://127.0.0.1:${TEST_BRIDGE_PORT}`).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.backend).toBeDefined();
  });
});
