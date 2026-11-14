// Big picture showing the student's current order state — Sadia Fatima (P3)
import React from 'react';
import type { StudentOrder } from './StudentView.js';

export default function OrderVisual({order}: {order?: StudentOrder}) {
  if (!order) return <div className="order-visual" aria-label="Ice cream shop"><span className="order-emoji">🏪</span></div>;
  if (order.state === 'pending') {
    return <div className="order-visual order-pending" aria-label="Your cone is being made">
      <span className="order-emoji">🍦</span>
      <span className="order-caption">Making your cone<span className="dots" aria-hidden="true"/></span>
    </div>;
  }
  switch (order.result?.status) {
    case 'OK':
      return <div className="order-visual order-served" aria-label="Your ice cream"><span className="order-emoji">🍦</span></div>;
    case 'SOLD_OUT':
      return <div className="order-visual order-sold-out" aria-label="Sold out">
        <span className="order-emoji">🍦</span><span className="order-stamp">SOLD OUT</span>
      </div>;
    case 'BUSY':
      return <div className="order-visual order-busy" aria-label="Shop busy">
        <span className="order-emoji">⏳</span><span className="order-caption">The line is full right now</span>
      </div>;
    default:
      return <div className="order-visual order-error" aria-label="Order not confirmed"><span className="order-emoji">⚠️</span></div>;
  }
}
