// Animated parlour front for the welcome screen — Sadia Fatima (P3)
import React from 'react';

const BALLOONS = ['pink', 'mint', 'vanilla', 'cocoa', 'pink'];
const CUSTOMERS = ['🧒', '👩', '🧑', '👧', '👨'];

/** Decorative shop illustration: balloons on the roof, customers walking in. */
export default function ParlourFront() {
  return <div className="parlour-front" aria-hidden="true" data-testid="parlour-front">
    <div className="parlour-balloons">
      {BALLOONS.map((colour, i) => <span key={i} className={`balloon balloon-${colour}`} style={{animationDelay: `${i * 0.4}s`}}/>)}
    </div>
    <div className="parlour-building">
      <div className="parlour-sign">🍦 ICE CREAM</div>
      <div className="parlour-awning"/>
      <div className="parlour-wall">
        <div className="parlour-window">🍨 🍦 🍧</div>
        <div className="parlour-door"/>
      </div>
    </div>
    <div className="parlour-street">
      {CUSTOMERS.map((person, i) => <span key={i} className="parlour-customer" style={{animationDelay: `${i * 1.2}s`}}>{person}</span>)}
    </div>
  </div>;
}
