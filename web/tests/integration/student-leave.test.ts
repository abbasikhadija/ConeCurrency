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
