// Customers list for the owner — Sadia Fatima
import React from 'react';

type Entry = {name: string; order?: {state: string; result?: {status?: string}}};

export function customerState(entry: Entry): {label: string; tone: string} {
  if (!entry.order) return {label: 'browsing', tone: 'idle'};
  if (entry.order.state === 'pending') return {label: 'being served', tone: 'pending'};
  switch (entry.order.result?.status) {
    case 'OK': return {label: 'served 🍦', tone: 'ok'};
    case 'SOLD_OUT': return {label: 'sold out', tone: 'sold_out'};
    case 'BUSY': return {label: 'line full', tone: 'busy'};
    default: return {label: 'not confirmed', tone: 'idle'};
  }
}

export default function CustomerList({customers}: {customers?: Entry[]}) {
  return <section aria-labelledby="admin-customers-title">
    <h3 id="admin-customers-title">Customers</h3>
    {customers?.length ? <ul className="admin-customers">
      {customers.map((entry, index) => {
        const state = customerState(entry);
        return <li key={index}><span>{entry.name}</span><span className={`admin-customer-state ${state.tone}`}>{state.label}</span></li>;
      })}
    </ul> : <p className="admin-customers-empty">No customers have come in yet.</p>}
  </section>;
}
