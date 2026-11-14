// Welcome entry choice — Sadia Fatima (P3)
import React from 'react';
import ParlourFront from './ParlourFront.js';

export default function EntryChoice({onCustomer, onAdmin}: {onCustomer: () => void; onAdmin: () => void}) {
  return <div className="student-welcome">
    <ParlourFront/>
    <div className="entry-choice">
      <p className="student-join-intro">Step inside our ice cream parlour. Every order goes to a real server that serves the whole class at once.</p>
      <button type="button" className="entry-card entry-customer" onClick={onCustomer}>
        <span className="entry-icon" aria-hidden="true">🍦</span>
        <span><strong>I'm a customer</strong><small>Order an ice cream and watch the shop serve you</small></span>
      </button>
      <button type="button" className="entry-card entry-admin" onClick={onAdmin}>
        <span className="entry-icon" aria-hidden="true">🔐</span>
        <span><strong>Team admin</strong><small>Run rounds and watch the server dashboard</small></span>
      </button>
    </div>
  </div>;
}
