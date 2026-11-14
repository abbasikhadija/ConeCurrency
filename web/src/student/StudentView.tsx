// Student shop view — Sadia Fatima (P3)
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ParlourFront from './ParlourFront.js';
import OrderVisual from './OrderVisual.js';
import Celebration from './Celebration.js';
import OrderHistory, { servedTimeText } from './OrderHistory.js';
import ShopFloor from './ShopFloor.js';

export type StudentOrder = {
  id: string;
  round: number;
  state: 'pending' | 'complete';
  result?: { status: string; rawResponse?: string; latencyMs?: number };
  finishedAt?: number;
};
export type StudentState = {
  name: string;
  order?: StudentOrder;
  history?: StudentOrder[];
  delayMs?: number;
  round: number;
  mode: 'sequential' | 'concurrent';
  workers?: number;
  managed: boolean;
};
type Api = (url: string, body?: object) => Promise<any>;
type Props = {
  student: StudentState | null;
  setStudent: (student: StudentState | null) => void;
  name: string;
  setName: (name: string) => void;
  sending: boolean;
  act: (work: () => Promise<any>) => Promise<void>;
  api: Api;
  /** Opens "How it works"; offered after a successful order. */
  onLearn?: () => void;
};

/** Plain-language description of how the real C server is serving customers. */
export function shopModeText(student: Pick<StudentState, 'managed' | 'mode' | 'workers'>): string {
  if (!student.managed) return 'The shop is open.';
  if (student.mode === 'sequential') return 'One cashier is serving customers one at a time.';
  const workers = student.workers ?? 0;
  return workers > 1 ? `${workers} cashiers are serving customers at the same time.` : 'Cashiers are serving customers at the same time.';
}

export function orderMessage(order?: StudentOrder): string {
  if (!order) return 'Ready to order.';
  if (order.state === 'pending') return 'Order pending — waiting for the real server response.';
  switch (order.result?.status) {
    case 'OK': return 'Your ice cream is ready!';
    case 'SOLD_OUT': return 'This round is sold out.';
    case 'BUSY': return 'The server queue is full. Please try again.';
    default: return 'Order could not be confirmed. Ask the team before retrying.';
  }
}

export default function StudentView({student, setStudent, name, setName, sending, act, api, onLearn}: Props) {
  const [celebrating, setCelebrating] = useState(false);
  const lastSeen = useRef<{id?: string; pending: boolean}>({pending: false});
  const order = student?.order;
  // Celebrate only when *this screen* saw the order go from pending to served,
  // not when an old result is shown again after a reload.
  useEffect(() => {
    const wasPending = lastSeen.current.pending && lastSeen.current.id === order?.id;
    if (wasPending && order?.state === 'complete' && order.result?.status === 'OK') setCelebrating(true);
    lastSeen.current = {id: order?.id, pending: order?.state === 'pending'};
  }, [order?.id, order?.state, order?.result?.status]);
  const closeCelebration = useCallback(() => setCelebrating(false), []);
  if (!student) {
    return <div className="student-welcome">
      <ParlourFront/>
      <form className="student-join" onSubmit={event => {event.preventDefault(); void act(async () => {await api('join', {name}); setStudent(await api('student'));});}}>
      <p className="student-join-intro">Step inside our ice cream parlour. Your order goes to a real server that serves the whole class at once.</p>
      <label className="student-join-label" htmlFor="student-name">Your display name</label>
      <input id="student-name" required maxLength={40} autoComplete="nickname" placeholder="e.g. Sadia" value={name} onChange={event => setName(event.target.value)}/>
      <p className="student-join-hint">Classmates will see this name in the shop.</p>
      <button disabled={sending}>Enter the parlour</button>
    </form>
    </div>;
  }
  const pending = order?.state === 'pending';
  return <>
    <h2>Hello, {student.name}!</h2>
    <p className="student-mode">{shopModeText(student)}</p>
    <OrderVisual order={order}/>
    <p role="status">{orderMessage(order)}</p>
    {/* The preparation delay is only known for rounds the bridge started itself. */}
    {servedTimeText(order, student.managed ? student.delayMs : undefined) &&
      <p className="served-time">{servedTimeText(order, student.managed ? student.delayMs : undefined)}</p>}
    <div className="student-actions">
      <button disabled={sending || pending} onClick={() => void act(async () => {const next = await api('order', {}); setStudent({...student, order: next});})}>{order ? 'Order another ice cream' : 'Order one ice cream'}</button>
      <button type="button" className="student-leave" disabled={sending || pending}
        title={pending ? 'Wait for your order to finish' : undefined}
        onClick={() => void act(async () => {await api('leave', {}); setStudent(null); setName('');})}>Leave shop</button>
    </div>
    <ShopFloor api={api}/>
    <OrderHistory history={student.history ?? []}/>
    {celebrating && <Celebration onLearn={onLearn} onClose={closeCelebration}/>}
  </>;
}
