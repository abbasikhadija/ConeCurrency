import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import http from 'node:http';
import request from 'supertest';
import { BridgeServer } from '../../server/bridge.js';

describe('HTTPS reverse-proxy deployment', () => {
  const origin = 'https://classroom.example';
  let bridge: BridgeServer;
  let proxy: http.Server;
  beforeAll(async () => {
    bridge = new BridgeServer({ bridgeHost: '127.0.0.1', bridgePort: 3096, adminPassword: 'proxy-test-only' });
    await bridge.start();
    // Model nginx's local upstream connection and TLS forwarding, over real HTTP.
    proxy = http.createServer((incoming, outgoing) => {
      const upstream = http.request({
        hostname: '127.0.0.1', port: 3096, method: incoming.method, path: incoming.url,
        headers: { ...incoming.headers, 'x-forwarded-proto': 'https', 'x-forwarded-for': '198.51.100.10' },
      }, response => {
        outgoing.writeHead(response.statusCode!, response.headers);
        response.pipe(outgoing);
      });
      upstream.on('error', () => { outgoing.writeHead(502); outgoing.end(); });
      incoming.pipe(upstream);
    });
  });
  afterAll(async () => {
    await new Promise<void>(resolve => proxy.close(() => resolve()));
    await bridge.stop();
  });
  it('accepts same-origin HTTPS login and sets secure admin/student cookies through a loopback proxy', async () => {
    const login = await request(proxy).post('/api/login').set('Host', 'classroom.example')
      .set('Origin', origin).send({ password: 'proxy-test-only' });
    expect(login.status).toBe(200);
    const adminCookie = login.headers['set-cookie'][0];
    for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Strict']) expect(adminCookie).toContain(attribute);
    const session = await request(proxy).get('/api/session').set('Host', 'classroom.example').set('Cookie', adminCookie.split(';')[0]);
    expect(session.body.admin).toBe(true);
    const joined = await request(proxy).post('/api/join').set('Host', 'classroom.example')
      .set('Origin', origin).send({ name: 'Deployment student' });
    expect(joined.status).toBe(200);
    expect(joined.headers['set-cookie'][0]).toContain('Secure');
  });
  it('continues to reject cross-origin mutations and unauthenticated mode changes behind the proxy', async () => {
    const crossOrigin = await request(proxy).post('/api/login').set('Host', 'classroom.example')
      .set('Origin', 'https://unrelated.example').send({ password: 'proxy-test-only' });
    expect(crossOrigin.status).toBe(403);
    const round = await request(proxy).post('/api/round').set('Host', 'classroom.example')
      .set('Origin', origin).send({ mode: 'concurrent', tickets: 50, workers: 4, queue: 32, delayMs: 20 });
    expect(round.status).toBe(401);
  });
});
