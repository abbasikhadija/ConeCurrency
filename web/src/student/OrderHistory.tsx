// This student's order history and served-time explanation — Sadia Fatima (P3)
import React from 'react';
import type { StudentOrder } from './StudentView.js';

const LABEL: Record<string, string> = {OK: 'Served 🍦', SOLD_OUT: 'Sold out', BUSY: 'Line full'};
const seconds = (ms?: number) => `${((ms ?? 0) / 1000).toFixed(1)} s`;

/**
 * Explains a finished order's measured round-trip time. Preparation time is the
 * round's configured delay; anything beyond it was spent waiting for a worker.
 */
export function servedTimeText(order: StudentOrder | undefined, delayMs?: number): string | null {
  if (!order || order.state !== 'complete' || order.result?.latencyMs === undefined) return null;
  const total = order.result.latencyMs;
  if (order.result.status !== 'OK') return `The server answered in ${seconds(total)}.`;
  if (!delayMs) return `Served in ${seconds(total)}.`;
  const waited = total - delayMs;
  if (waited < 100) return `Served in ${seconds(total)} — a cashier was free straight away.`;
  return `Served in ${seconds(total)}: making a cone takes ${seconds(delayMs)}, and about ${seconds(waited)} was spent waiting in line for a free cashier.`;
}

export default function OrderHistory({history}: {history: StudentOrder[]}) {
  if (!history.length) return null;
  const count = (status: string) => history.filter(order => order.result?.status === status).length;
  return <section className="order-history" aria-labelledby="order-history-title">
    <h3 id="order-history-title">Your orders</h3>
    <p className="order-history-totals">
      <span>🍦 Served: <strong>{count('OK')}</strong></span>
      <span>Sold out: <strong>{count('SOLD_OUT')}</strong></span>
      <span>Line full: <strong>{count('BUSY')}</strong></span>
    </p>
    <ol className="order-history-list">
      {history.map(order => <li key={order.id} className={`history-${(order.result?.status ?? 'ERR').toLowerCase()}`}>
        <span>{order.finishedAt ? new Date(order.finishedAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'}) : ''}</span>
        <span>{LABEL[order.result?.status ?? ''] ?? 'Not confirmed'}</span>
        <span>{seconds(order.result?.latencyMs)}</span>
      </li>)}
    </ol>
  </section>;
}
