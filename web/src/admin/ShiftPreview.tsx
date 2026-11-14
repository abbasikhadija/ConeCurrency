// Live picture of the planned shift — Sadia Fatima
import React from 'react';
import type { ShiftConfig } from './ShiftBriefing.js';

const MAX_ICONS = 24;
const MAX_CASHIERS = 12;

function Icons({count, icon, max}: {count: number; icon: string; max: number}) {
  const shown = Math.max(0, Math.min(count, max));
  return <>{Array.from({length: shown}, (_, i) => <span key={i} className="preview-icon">{icon}</span>)}
    {count > max && <span className="preview-more">+{count - max}</span>}</>;
}

export default function ShiftPreview({config}: {config: ShiftConfig}) {
  const sequential = config.mode === 'sequential';
  const onShift = sequential ? 1 : config.workers;
  return <aside className="shift-preview" aria-label="Shift preview">
    <h3>Today's parlour</h3>
    <div className="preview-row">
      <span className="preview-label">Freezer</span>
      <div className="preview-icons" aria-label={`Freezer: ${config.tickets} ${config.tickets === 1 ? 'cone' : 'cones'}`}>
        {config.tickets > 0 ? <Icons count={config.tickets} icon="🍦" max={MAX_ICONS}/> : <span className="preview-empty">Empty — every order will be sold out</span>}
      </div>
    </div>
    <div className="preview-row">
      <span className="preview-label">Cashiers</span>
      <div className="preview-icons" aria-label={`Cashiers: ${onShift} on shift`}>
        <Icons count={onShift} icon="👩‍🍳" max={MAX_CASHIERS}/>
        {sequential && config.workers > 1 && <span className="preview-note">one at a time</span>}
      </div>
    </div>
    <div className="preview-row">
      <span className="preview-label">Waiting line</span>
      <div className="preview-icons preview-line" aria-label={`Waiting line: room for ${config.queue}`}>
        {Array.from({length: Math.min(config.queue, MAX_ICONS)}, (_, i) => <span key={i} className="preview-slot"/>)}
        {config.queue > MAX_ICONS && <span className="preview-more">+{config.queue - MAX_ICONS}</span>}
      </div>
    </div>
    <div className="preview-row">
      <span className="preview-label">Each cone</span>
      <span className="preview-timer">⏱ {(config.delayMs / 1000).toFixed(1)} s</span>
    </div>
  </aside>;
}
