// Student shop view — Sadia Fatima (P3)
import React from 'react';
import ParlourFront from './ParlourFront.js';

export type StudentOrder = {
  id: string;
  round: number;
  state: 'pending' | 'complete';
  result?: { status: string; rawResponse?: string; latencyMs?: number };
};
export type StudentState = {
  name: string;
  order?: StudentOrder;
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

export default function StudentView({student, setStudent, name, setName, sending, act, api}: Props) {
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
  const order = student.order;
  const pending = order?.state === 'pending';
  const served = order?.result?.status === 'OK';
  return <>
    <h2>Hello, {student.name}!</h2>
    <p className="student-mode">{shopModeText(student)}</p>
    <div className="student-cone" aria-label={served ? 'Your ice cream' : 'Ice cream shop'}>{served ? '🍦' : '🏪'}</div>
    <p role="status">{orderMessage(order)}</p>
    <div className="student-actions">
      <button disabled={sending || pending} onClick={() => void act(async () => {const next = await api('order', {}); setStudent({...student, order: next});})}>Order one ice cream</button>
      <button type="button" className="student-leave" disabled={sending || pending}
        title={pending ? 'Wait for your order to finish' : undefined}
        onClick={() => void act(async () => {await api('leave', {}); setStudent(null); setName('');})}>Leave shop</button>
    </div>
  </>;
}
