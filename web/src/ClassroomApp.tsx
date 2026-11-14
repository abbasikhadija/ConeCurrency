import React, { useEffect, useState } from 'react';
import Dashboard from './App.js';
import './student/student.css';
import StudentView from './student/StudentView.js';
import StudentMenu from './student/StudentMenu.js';
import EntryChoice from './student/EntryChoice.js';
import AboutUs from './student/AboutUs.js';
import StudentLearn from './student/StudentLearn.js';

async function api(url: string, body?: object) {
  const response=await fetch('/api/'+url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,
    body:body?JSON.stringify(body):undefined,credentials:'same-origin'});
  const data=await response.json();
  if(!response.ok)throw Object.assign(new Error(data.error || 'Request failed'),{status:response.status});
  return data;
}

export default function ClassroomApp() {
  const [admin,setAdmin]=useState(false);
  const [login,setLogin]=useState(false);
  const [password,setPassword]=useState('');
  const [name,setName]=useState('');
  const [student,setStudent]=useState<any>(null);
  const [round,setRound]=useState<any>(null);
  const [error,setError]=useState('');
  const [sending,setSending]=useState(false);
  const [view,setView]=useState<'shop'|'about'|'learn'>('shop');
  const [entry,setEntry]=useState<'choose'|'customer'>('choose');
  const [config,setConfig]=useState({mode:'concurrent',tickets:50,workers:4,queue:32,delayMs:500});
  useEffect(()=>{void api('session').then(data=>setAdmin(data.admin));void api('student').then(setStudent).catch(()=>{});},[]);
  useEffect(()=>{
    let mounted=true;
    const refresh=()=>void api(admin?'round':'student').then(data=>{if(mounted){admin?setRound(data):setStudent(data);}})
      .catch(error=>{if(mounted && !admin && error.status===401)setStudent(null);});
    refresh();const timer=setInterval(refresh,700);
    return()=>{mounted=false;clearInterval(timer);};
  },[admin]);
  const act=async(work:()=>Promise<any>)=>{setError('');setSending(true);try{await work();}catch(e){setError((e as Error).message);}finally{setSending(false);}};
  return <>
    <nav className="classroom-bar" aria-label="Classroom navigation">
      <strong>ConeCurrency Classroom 🍦</strong>
      {admin?<button onClick={()=>void act(async()=>{await api('logout',{});setAdmin(false);})}>Log out</button>:
        <StudentMenu items={[
          login?{label:'Customer view',onSelect:()=>{setLogin(false);setView('shop');}}:{label:'Admin login',onSelect:()=>{setLogin(true);setView('shop');}},
          {label:'How it works',onSelect:()=>setView('learn')},
          {label:'About us',onSelect:()=>setView('about')},
        ]}/>}
    </nav>
    {error && <p role="alert" className="classroom-error">{error}</p>}
    {admin?<>
      <section className="classroom-panel" aria-label="Admin round controls">
        <h2>Admin — start a new round</h2>
        <p>Mode changes restart the managed C server and replenish stock. Pending orders must finish first.</p>
        <form onSubmit={event=>{event.preventDefault();void act(async()=>{await api('round',config);setRound(await api('round'));});}}>
          <label>Mode <select value={config.mode} onChange={event=>setConfig({...config,mode:event.target.value})}>
            <option value="sequential">Sequential — one cashier</option><option value="concurrent">Concurrent — worker pool</option></select></label>
          {(['tickets','workers','queue','delayMs'] as const).map(field=><label key={field}>{({tickets:'Stock',workers:'Workers',queue:'Queue capacity',delayMs:'Preparation delay (ms)'})[field]}
            <input type="number" required min={field==='tickets'||field==='delayMs'?0:1} value={config[field]} onChange={event=>setConfig({...config,[field]:Number(event.target.value)})}/></label>)}
          <button disabled={sending || !!round?.pending}>Start new round</button>
        </form>
        <p>{round?.managed?`Round ${round.round}: ${round.config.mode}`:'External backend — managed controls require MANAGE_BACKEND=1.'} · Pending: {round?.pending??0}</p>
        <h3>Classroom orders</h3>
        <ul>{round?.students?.map((entry:any,index:number)=><li key={index}>{entry.name}: {entry.order?`${entry.order.state} ${entry.order.result?.status||''}`:'joined'}</li>)}</ul>
      </section>
      <Dashboard/>
    </>:view==='about'?<main className="classroom-panel"><AboutUs onBack={()=>setView('shop')}/></main>:
      view==='learn'?<main className="classroom-panel student-learn-panel"><StudentLearn onBack={()=>setView('shop')}/></main>:<main className="classroom-panel">
      <h1>Welcome to ConeCurrency 🍦</h1>
      {login?<form onSubmit={event=>{event.preventDefault();void act(async()=>{await api('login',{password});setPassword('');setAdmin(true);setLogin(false);});}}>
        <h2>Team admin sign-in</h2><label>Admin password <input type="password" autoComplete="current-password" required value={password} onChange={event=>setPassword(event.target.value)}/></label>
        <button disabled={sending}>Sign in</button>
      </form>:!student&&entry==='choose'?<EntryChoice onCustomer={()=>setEntry('customer')} onAdmin={()=>setLogin(true)}/>:<StudentView student={student} setStudent={setStudent} name={name} setName={setName} sending={sending} act={act} api={api} onLearn={()=>setView('learn')}/>}
    </main>}
  </>;
}
