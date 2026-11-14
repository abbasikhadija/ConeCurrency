import { Application, Request } from 'express';
import { IncomingMessage } from 'node:http';
import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import { existsSync } from 'node:fs';
import type { BridgeServer, BridgeOptions, TapeLogEntry } from './bridge.js';

type Round = {mode: 'sequential' | 'concurrent'; tickets: number; workers: number; queue: number; delayMs: number};
type Order = {id: string; round: number; state: 'pending' | 'complete'; result?: TapeLogEntry};
type Student = {name: string; expires: number; order?: Order};
const hash = (value: string) => createHash('sha256').update(value).digest();
const cookie = (req: IncomingMessage, key: string) => (req.headers.cookie || '').split(';').map(p => p.trim()).find(p => p.startsWith(key + '='))?.slice(key.length + 1);

export class Classroom {
  private admins = new Map<string, number>();
  private students = new Map<string, Student>();
  private failures = new Map<string, {count: number; expires: number}>();
  private password: string;
  private child?: ChildProcess;
  private changing = false;
  private round = 0;
  private config: Round = {mode:'concurrent',tickets:50,workers:4,queue:32,delayMs:500};

  constructor(app: Application, private bridge: BridgeServer, private options: BridgeOptions) {
    this.password = options.adminPassword ?? process.env.ADMIN_PASSWORD ?? '';
    app.use('/api', (req, res, next) => {
      if (req.method !== 'GET' && req.headers.origin && req.headers.origin !== `${req.protocol}://${req.headers.host}`) {
        res.status(403).json({error:'Same-origin requests required'}); return;
      }
      next();
    });
    app.get('/api/session', (req, res) => res.json({admin:this.isAdmin(req), configured:!!this.password}));
    app.post('/api/login', (req, res) => {
      const ip = req.ip || 'local';
      let attempts = this.failures.get(ip);
      if (!attempts || attempts.expires < Date.now()) attempts = {count:0,expires:Date.now()+60000};
      if (attempts.count >= 10) {res.status(429).json({error:'Too many attempts. Wait a minute.'}); return;}
      if (!this.password || typeof req.body.password !== 'string' || !timingSafeEqual(hash(req.body.password),hash(this.password))) {
        attempts.count++; this.failures.set(ip, attempts);
        res.status(401).json({error:'Invalid credentials or ADMIN_PASSWORD is not configured'}); return;
      }
      this.prune();
      const token = randomUUID(); this.admins.set(token, Date.now()+8*3600000);
      res.cookie('cc_admin',token,{httpOnly:true,sameSite:'strict',secure:req.secure,maxAge:8*3600000});
      res.json({admin:true});
    });
    app.post('/api/logout', (req,res) => {this.admins.delete(cookie(req,'cc_admin') || '');res.clearCookie('cc_admin');res.json({ok:true});});
    app.post('/api/join', (req,res) => {
      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      if (!name || name.length > 40 || /[\x00-\x1f]/.test(name)) {res.status(400).json({error:'Enter a display name of 1–40 characters'});return;}
      this.prune();
      if (this.students.size >= 1000) {res.status(503).json({error:'Classroom full'});return;}
      const existing = cookie(req,'cc_student');
      const token = existing && this.students.has(existing) ? existing : randomUUID();
      const previous = this.students.get(token);
      this.students.set(token,{name,expires:Date.now()+8*3600000,order:previous?.order});
      res.cookie('cc_student',token,{httpOnly:true,sameSite:'strict',secure:req.secure,maxAge:8*3600000});
      res.json({name});
    });
    app.post('/api/leave', (req,res) => {
      const token = cookie(req,'cc_student') || '';
      if (this.students.get(token)?.order?.state === 'pending') {
        res.status(409).json({error:'Wait for your order to finish before leaving'});return;
      }
      this.students.delete(token);
      res.clearCookie('cc_student');
      res.json({ok:true});
    });
    app.get('/api/student', (req,res) => {
      const student=this.student(req);
      if (!student) {res.status(401).json({error:'Join the classroom first'});return;}
      res.json({name:student.name,order:student.order,round:this.round,mode:this.config.mode,managed:!!this.child});
    });
    app.post('/api/order', (req,res) => {
      const student=this.student(req);
      if (!student) {res.status(401).json({error:'Join first'});return;}
      if (this.changing) {res.status(409).json({error:'The admin is changing rounds'});return;}
      if (student.order?.state === 'pending') {res.status(202).json(student.order);return;}
      if (this.bridge.pendingRequests >= 200) {res.status(429).json({error:'Shop busy, try shortly'});return;}
      const order: Order={id:randomUUID(),round:this.round,state:'pending'};
      student.order=order;
      res.status(202).json(order);
      this.bridge.broadcast({type:'STUDENT_ORDER',name:student.name,order});
      void this.bridge.sendSingleTcpRequest('BOOK').then(result => {
        order.result=result; order.state='complete';
        this.bridge.broadcast({type:'STUDENT_ORDER',name:student.name,order});
      });
    });
    app.get('/api/round', (req,res) => {
      if (!this.isAdmin(req)) {res.status(401).json({error:'Admin login required'});return;}
      res.json({round:this.round,config:this.config,managed:!!this.child,enabled:!!this.options.manageBackend,
        pending:this.bridge.pendingRequests,students:[...this.students.values()].map(s=>({name:s.name,order:s.order}))});
    });
    app.post('/api/round', async (req,res) => {
      if (!this.isAdmin(req)) {res.status(401).json({error:'Admin login required'});return;}
      const c=req.body as Round;
      if (!['sequential','concurrent'].includes(c.mode) || !this.number(c.tickets,0,1000000) ||
          !this.number(c.workers,1,64) || !this.number(c.queue,1,10000) || !this.number(c.delayMs,0,60000)) {
        res.status(400).json({error:'Invalid round settings'});return;
      }
      try {await this.startRound(c); res.json({round:this.round,config:this.config});}
      catch(error) {res.status(409).json({error:(error as Error).message});}
    });
  }
  get isChanging() {return this.changing;}
  isAdmin(req: IncomingMessage) {return (this.admins.get(cookie(req,'cc_admin') || '') || 0)>Date.now();}
  private student(req: Request) {const value=this.students.get(cookie(req,'cc_student')||'');return value && value.expires>Date.now()?value:undefined;}
  private number(n: number, low: number, high: number) {return Number.isInteger(n)&&n>=low&&n<=high;}
  private prune() {
    for(const [key,value] of this.students) if(value.expires<Date.now() && value.order?.state!=='pending') this.students.delete(key);
    for(const [key,value] of this.admins) if(value<Date.now()) this.admins.delete(key);
    for(const [key,value] of this.failures) if(value.expires<Date.now()) this.failures.delete(key);
  }
  async restartManaged() {if(!this.child)return false;await this.startRound(this.config);return true;}
  async startRound(config: Round) {
    if (!this.options.manageBackend) throw new Error('Set MANAGE_BACKEND=1 to enable managed C rounds on Ubuntu');
    if (this.changing || this.bridge.pendingRequests) throw new Error('Wait for all pending orders to finish');
    const executable=path.resolve(this.options.serverPath || '../ticket-server');
    if(!existsSync(executable))throw new Error('Build the real C server with make all first');
    this.changing=true;
    try {
      await this.stop();
      const child=spawn(executable,['--mode',config.mode,'--tickets',String(config.tickets),'--workers',String(config.workers),
        '--queue',String(config.queue),'--delay-ms',String(config.delayMs),'--port',String(this.options.backendPort||8080)],{stdio:['ignore','pipe','pipe']});
      this.child=child;
      await new Promise<void>((resolve,reject)=>{
        let output='',errors='';
        const timer=setTimeout(()=>reject(new Error('C server startup timed out')),5000);
        const finish=(error?:Error)=>{clearTimeout(timer);error?reject(error):resolve();};
        child.once('error',finish);
        child.once('exit',()=>{if(this.child===child)this.child=undefined;finish(new Error(errors || 'C server exited'));});
        child.stderr?.on('data',data=>{errors=(errors+data).slice(-2000);});
        child.stdout?.on('data',data=>{output=(output+data).slice(-2000);if(output.includes(' on 127.0.0.1:'))finish();});
      });
      this.config={...config};this.round++;
      this.bridge.setInitialStock(config.tickets);this.bridge.resetStats();
      this.bridge.broadcast({type:'RESET_STATE',stats:this.bridge.getStats()});
    } catch(error) {await this.stop();throw error;} finally {this.changing=false;}
  }
  async stop() {
    const child=this.child;this.child=undefined;
    if(!child || !child.pid || child.exitCode!==null)return;
    await new Promise<void>(resolve=>{const timer=setTimeout(()=>{child.kill('SIGKILL');},3000);
      child.once('exit',()=>{clearTimeout(timer);resolve();});child.kill('SIGINT');});
  }
}
