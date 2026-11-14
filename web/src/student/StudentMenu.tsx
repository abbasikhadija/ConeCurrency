// Top-bar menu for visitors — Sadia Fatima (P3)
import React, { useEffect, useRef, useState } from 'react';

export type MenuItem = { label: string; onSelect: () => void };

/** Accessible "☰ Menu" dropdown: closes on selection, outside click or Escape. */
export default function StudentMenu({items}: {items: MenuItem[]}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  return <div className="student-menu" ref={root}>
    <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>☰ Menu</button>
    {open && <ul role="menu" className="student-menu-list">
      {items.map(item => <li key={item.label} role="none">
        <button type="button" role="menuitem" onClick={() => { setOpen(false); item.onSelect(); }}>{item.label}</button>
      </li>)}
    </ul>}
  </div>;
}
