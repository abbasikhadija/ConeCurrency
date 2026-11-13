import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import net from 'node:net';
import request from 'supertest';
import { BridgeServer } from '../../server/bridge.js';

describe('Classroom security and original C wire protocol',()=>{
  let backend:net.Server, bridge:BridgeServer, stock=3;
  beforeAll(async()=>{
    backend=net.createServer(socket=>{let data='';socket.on('data',chunk=>{
      data+=chunk;if(!data.includes('\n'))return;
      socket.end(data==='BOOK\n'?(stock>0?(stock--,'OK BOOKED\n'):'ERR SOLD_OUT\n'):'ERR BAD_REQUEST\n');
    });});
    await new Promise<void>(resolve=>backend.listen(0,'127.0.0.1',resolve));
    bridge=new BridgeServer({backendPort:(backend.address() as net.AddressInfo).port,adminPassword:'test-classroom-secret'});
  });
  afterAll(async()=>{await bridge.stop();await new Promise<void>(resolve=>backend.close(()=>resolve()));});
  it('requires admin authentication for all dashboard mutations and round settings',async()=>{
    for(const endpoint of ['book','burst','reset','bad-request','round'])
      expect((await request(bridge.getApp()).post('/api/'+endpoint).send({})).status).toBe(401);
    expect((await request(bridge.getApp()).post('/api/login').send({password:'wrong'})).status).toBe(401);
  });
  it('students join by name and access only their own tracked orders',async()=>{
    const alice=request.agent(bridge.getApp()),bob=request.agent(bridge.getApp());
    expect((await alice.post('/api/join').send({name:'Alice'})).status).toBe(200);
    await bob.post('/api/join').send({name:'Bob'});
    const order=await alice.post('/api/order').send({});
    expect(order.status).toBe(202);
    let state:any;
    for(let i=0;i<50;i++){state=(await alice.get('/api/student')).body;if(state.order?.state==='complete')break;await new Promise(r=>setTimeout(r,10));}
    expect(state.order.result.rawResponse).toBe('OK BOOKED');
    expect(state.order.id).toBe(order.body.id);
    expect((await bob.get('/api/student')).body.order).toBeUndefined();
    expect((await bob.post('/api/burst').send({count:25})).status).toBe(401);
  });
  it('plain BOOKED replies do not imply duplicate IDs; failed resets preserve counters',async()=>{
    const admin=request.agent(bridge.getApp());
    await admin.post('/api/login').send({password:'test-classroom-secret'});
    await admin.post('/api/book').send({});await admin.post('/api/book').send({});
    expect(bridge.getStats().booked).toBe(3);
    expect(bridge.getStats().raceConditionDetected).toBe(false);
    const reset=await admin.post('/api/reset').send({});
    expect(reset.status).toBe(409);expect(reset.body.success).toBe(false);
    expect(bridge.getStats().booked).toBe(3);expect(stock).toBe(0);
    expect((await admin.get('/api/status')).status).toBe(501);
    expect(bridge.getStats().bad).toBe(0);
    expect((await admin.post('/api/burst').send({count:1000})).status).toBe(400);
    expect((await admin.post('/api/burst').send({count:'invalid'})).status).toBe(400);
  });
});

describe.skipIf(!process.env.REAL_C_SERVER)('Managed real C round integration',()=>{
  let bridge:BridgeServer;
  beforeAll(()=>{bridge=new BridgeServer({backendPort:18087,adminPassword:'real-c-test-secret',manageBackend:true,serverPath:process.env.REAL_C_SERVER});});
  afterAll(async()=>{await bridge.stop();});
  it('switches actual C modes, depletes stock and restarts inventory on confirmed reset',async()=>{
    const admin=request.agent(bridge.getApp());
    await admin.post('/api/login').send({password:'real-c-test-secret'});
    for(const mode of ['sequential','concurrent']){
      const round=await admin.post('/api/round').send({mode,tickets:1,workers:4,queue:32,delayMs:0});
      expect(round.status).toBe(200);
      expect((await admin.post('/api/book').send({})).body.rawResponse).toBe('OK BOOKED');
      expect((await admin.post('/api/book').send({})).body.rawResponse).toBe('ERR SOLD_OUT');
      expect((await admin.post('/api/reset').send({})).body.success).toBe(true);
      expect((await admin.post('/api/book').send({})).body.rawResponse).toBe('OK BOOKED');
    }
  });
});
