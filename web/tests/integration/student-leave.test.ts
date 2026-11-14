// Student leave flow — Sadia Fatima (P3)
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import net from 'node:net';
import request from 'supertest';
import { BridgeServer } from '../../server/bridge.js';

describe('Students can leave the shop and start again without a server restart', () => {
  let backend: net.Server, bridge: BridgeServer, delayMs = 0;
  beforeAll(async () => {
    backend = net.createServer(socket => {
      socket.once('data', () => setTimeout(() => socket.end('OK BOOKED\n'), delayMs));
    });
    await new Promise<void>(resolve => backend.listen(0, '127.0.0.1', resolve));
    bridge = new BridgeServer({bridgePort: 3098, backendPort: (backend.address() as net.AddressInfo).port, adminPassword: 'leave-test-secret'});
  });
  afterAll(async () => { await bridge.stop(); await new Promise<void>(resolve => backend.close(() => resolve())); });

  const waitForCompletion = async (agent: ReturnType<typeof request.agent>) => {
    for (let i = 0; i < 100; i++) {
      const state = (await agent.get('/api/student')).body;
      if (state.order?.state === 'complete') return state;
      await new Promise(r => setTimeout(r, 10));
    }
    throw new Error('order did not complete');
  };

  it('leaving ends the session, and joining again starts with no previous order', async () => {
    delayMs = 0;
    const sadia = request.agent(bridge.getApp());
    await sadia.post('/api/join').send({name: 'Sadia'});
    await sadia.post('/api/order').send({});
    await waitForCompletion(sadia);

    const left = await sadia.post('/api/leave').send({});
    expect(left.status).toBe(200);
    expect(String(left.headers['set-cookie'])).toMatch(/cc_student=;/);
    expect((await sadia.get('/api/student')).status).toBe(401);

    expect((await sadia.post('/api/join').send({name: 'Sadia again'})).status).toBe(200);
    const fresh = (await sadia.get('/api/student')).body;
    expect(fresh.name).toBe('Sadia again');
    expect(fresh.order).toBeUndefined();
  });

  it('a student cannot leave while their order is still waiting for the server', async () => {
    delayMs = 300;
    const ali = request.agent(bridge.getApp());
    await ali.post('/api/join').send({name: 'Ali'});
    expect((await ali.post('/api/order').send({})).status).toBe(202);
    expect((await ali.post('/api/leave').send({})).status).toBe(409);
    await waitForCompletion(ali);
    expect((await ali.post('/api/leave').send({})).status).toBe(200);
  });

  it('leaving without a session is harmless', async () => {
    const stranger = request.agent(bridge.getApp());
    expect((await stranger.post('/api/leave').send({})).status).toBe(200);
  });
});

describe('Order history is kept per student and cleared on leave', () => {
  let backend: net.Server, bridge: BridgeServer;
  beforeAll(async () => {
    backend = net.createServer(socket => socket.once('data', () => socket.end('OK BOOKED\n')));
    await new Promise<void>(resolve => backend.listen(0, '127.0.0.1', resolve));
    bridge = new BridgeServer({bridgePort: 3096, backendPort: (backend.address() as net.AddressInfo).port, adminPassword: 'history-test-secret'});
  });
  afterAll(async () => { await bridge.stop(); await new Promise<void>(resolve => backend.close(() => resolve())); });

  it('records each finished order, newest first, with its measured time', async () => {
    const sadia = request.agent(bridge.getApp()), other = request.agent(bridge.getApp());
    await sadia.post('/api/join').send({name: 'Sadia'});
    await other.post('/api/join').send({name: 'Other'});
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      ids.unshift((await sadia.post('/api/order').send({})).body.id);
      for (let j = 0; j < 100 && (await sadia.get('/api/student')).body.order?.state !== 'complete'; j++) await new Promise(r => setTimeout(r, 10));
    }
    const state = (await sadia.get('/api/student')).body;
    expect(state.history.map((order: any) => order.id)).toEqual(ids);
    expect(state.history[0].result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(typeof state.history[0].finishedAt).toBe('number');
    expect((await other.get('/api/student')).body.history).toEqual([]);   // private to each student

    await sadia.post('/api/leave').send({});
    await sadia.post('/api/join').send({name: 'Sadia'});
    expect((await sadia.get('/api/student')).body.history).toEqual([]);
  });
});

describe('Live shop snapshot endpoint', () => {
  let backend: net.Server, bridge: BridgeServer;
  beforeAll(async () => {
    backend = net.createServer(socket => socket.once('data', () => setTimeout(() => socket.end('OK BOOKED\n'), 300)));
    await new Promise<void>(resolve => backend.listen(0, '127.0.0.1', resolve));
    bridge = new BridgeServer({bridgePort: 3095, backendPort: (backend.address() as net.AddressInfo).port, adminPassword: 'shop-test-secret'});
  });
  afterAll(async () => { await bridge.stop(); await new Promise<void>(resolve => backend.close(() => resolve())); });

  it('is only for joined students', async () => {
    expect((await request(bridge.getApp()).get('/api/shop')).status).toBe(401);
  });

  it('shows waiting customers by name in arrival order, marks "you", then lists them as served', async () => {
    const ali = request.agent(bridge.getApp()), sadia = request.agent(bridge.getApp());
    await ali.post('/api/join').send({name: 'Ali'});
    await sadia.post('/api/join').send({name: 'Sadia'});
    await ali.post('/api/order').send({});
    await new Promise(r => setTimeout(r, 20));
    await sadia.post('/api/order').send({});

    const shop = (await sadia.get('/api/shop')).body;
    const waiting = [...shop.counters, ...shop.line];
    expect(waiting.map((p: any) => p.name)).toEqual(['Ali', 'Sadia']);
    expect(waiting.find((p: any) => p.name === 'Sadia').you).toBe(true);
    expect(waiting.find((p: any) => p.name === 'Ali').you).toBe(false);
    expect(shop.estimated).toBe(true);
    expect(JSON.stringify(shop)).not.toMatch(/cc_student|[0-9a-f]{8}-[0-9a-f]{4}-/);   // no tokens or order IDs leak

    await new Promise(r => setTimeout(r, 700));
    const after = (await sadia.get('/api/shop')).body;
    expect(after.counters).toHaveLength(0);
    expect(after.recent.map((r: any) => r.name).sort()).toEqual(['Ali', 'Sadia']);
  });
});
