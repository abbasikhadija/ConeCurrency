// "What's happening here?" guide for new customers — Sadia Fatima
import React, { useEffect, useRef } from 'react';

const MESSAGES: [string, string][] = [
  ['Ready to order.', 'You can place an order.'],
  ['Making your cone…', 'Your order has reached the server. You are at a cashier or waiting in line.'],
  ['Your ice cream is ready!', 'The server confirmed your cone.'],
  ['This round is sold out.', 'The freezer is empty. Every cone has already been given to someone.'],
  ['The line is full right now.', 'Too many customers are waiting. Try again in a moment.'],
  ['Order could not be confirmed.', 'No answer arrived in time. Ask the team before ordering again.'],
];

export function CustomerGuideDialog({onClose}: {onClose: () => void}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div className="celebration-backdrop" onClick={onClose}>
    <div className="customer-guide" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={event => event.stopPropagation()}>
      <div className="customer-guide-head">
        <h2 id="guide-title">What's happening here? 🍦</h2>
        <button type="button" ref={closeButton} className="customer-guide-close" aria-label="Close guide" onClick={onClose}>✕</button>
      </div>

      <h3>Why you're here</h3>
      <p>This parlour is an Operating Systems experiment. Every order you place is a real request to a C program, the
        <strong> server</strong>, running on Linux. Many customers order at the same moment, and the server has to serve
        everyone quickly and fairly, without ever handing out a cone that doesn't exist.</p>

      <h3>What happens when you order</h3>
      <ol>
        <li>Your order travels to the server.</li>
        <li>A free <strong>cashier</strong> takes it. Cashiers are the server's <em>worker threads</em>. If they are all busy,
          you wait in the <strong>line</strong>, which is the server's <em>queue</em>: first come, first served.</li>
        <li>The cashier checks the freezer. Only one cashier can open it at a time (a <em>lock</em>), so two customers can
          never both get the last cone.</li>
        <li>Your answer comes back to this screen.</li>
      </ol>

      <h3>What each message means</h3>
      <dl className="customer-guide-messages">
        {MESSAGES.map(([message, meaning]) => <div key={message}><dt>{message}</dt><dd>{meaning}</dd></div>)}
      </dl>

      <h3>Reading the shop floor</h3>
      <ul>
        <li><strong>Cashier counters</strong> show who is being served right now.</li>
        <li><strong>The waiting line</strong> shows customers in the order they ordered. Positions are estimated, because
          the server doesn't report exact places.</li>
        <li><strong>"Served in 1.5 s"</strong> is the real measured time. Anything beyond the time to make one cone was
          spent waiting for a free cashier.</li>
        <li>Your display name is shown to other customers in the shop.</li>
      </ul>
      <button type="button" className="customer-guide-done" onClick={onClose}>Got it, let's order</button>
    </div>
  </div>;
}

/** Small button that opens the guide. */
export default function CustomerGuide() {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  return <>
    <button type="button" className="customer-guide-open" onClick={() => setOpen(true)}>❓ What's happening here?</button>
    {open && <CustomerGuideDialog onClose={close}/>}
  </>;
}
