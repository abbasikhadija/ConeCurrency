// Manager's briefing to the owner: set up the shift — Sadia Fatima
import React, { useMemo } from 'react';
import { useTypewriter } from './useTypewriter.js';
import ShiftPreview from './ShiftPreview.js';

export type ShiftConfig = {mode: 'sequential' | 'concurrent'; tickets: number; workers: number; queue: number; delayMs: number};
type Round = {round: number; managed: boolean; enabled?: boolean; pending?: number; config?: ShiftConfig};
type Props = {
  config: ShiftConfig;
  setConfig: (config: ShiftConfig) => void;
  round?: Round | null;
  sending: boolean;
  onStart: () => void;
};

const BRIDGE_TIMEOUT_MS = 5000;   // the web bridge waits this long for each reply

const LINES = [
  "Good morning, owner! Here's how I'd like to run today's shift. Change anything you like.",
  'How should the cashiers work today?',
  'How many cones are in the freezer?',
  'How many cashiers are on shift?',
  'How many customers can wait in line?',
  'How long does one cone take to make?',
  'All set. Shall I open the shop?',
];

/** Plain-language status of the running shift. */
export function shiftStatus(round?: Round | null): string {
  if (!round) return 'Checking the shop…';
  if (!round.managed) return round.enabled === false
    ? 'Shop controls are off: the server was started outside this page.'
    : 'The shop is closed. Open it to start a shift.';
  const config = round.config;
  const style = config?.mode === 'sequential' ? 'one cashier serves at a time' : `${config?.workers ?? ''} cashiers serve together`;
  return `Shop open · shift ${round.round} · ${style}`;
}

/** Warns when late customers could wait longer than the bridge allows. */
export function waitWarning(config: ShiftConfig): string | null {
  if (config.delayMs <= 0) return null;
  const cashiers = config.mode === 'sequential' ? 1 : Math.max(1, config.workers);
  const servedInTime = Math.floor(BRIDGE_TIMEOUT_MS / config.delayMs) * cashiers;
  if (servedInTime >= config.queue + cashiers) return null;
  return `Heads-up: at ${(config.delayMs / 1000).toFixed(1)} s per cone, only about ${servedInTime} customers can be served within 5 s. ` +
    'Anyone waiting longer is reported as "not confirmed".';
}

export default function ShiftBriefing({config, setConfig, round, sending, onStart}: Props) {
  const lines = useMemo(() => LINES, []);
  const {visible, finished, typing, done, revealAll} = useTypewriter(lines);
  const number = (key: 'tickets' | 'workers' | 'queue' | 'delayMs', value: string) => setConfig({...config, [key]: Number(value)});
  const pending = round?.pending ?? 0;
  const controlsOff = round?.enabled === false;
  const warning = waitWarning(config);

  const bubble = (index: number, control?: React.ReactNode) => (index <= typing || done) && <div className="briefing-msg" key={index}>
    <span className="briefing-avatar" aria-hidden="true">🧑‍💼</span>
    <div className="briefing-body">
      <p className="briefing-text">{visible(index)}{!finished(index) && !done && <span className="briefing-caret" aria-hidden="true"/>}</p>
      {control && (finished(index) || done) && <div className="briefing-control">{control}</div>}
    </div>
  </div>;

  return <section className="classroom-panel admin-shift" aria-label="Admin round controls">
    <div className="admin-shift-head">
      <h2>Today's shift</h2>
      {!done && <button type="button" className="briefing-skip" onClick={revealAll}>Show everything</button>}
    </div>
    <div className="admin-shift-grid">
      <form className="briefing" onSubmit={event => {event.preventDefault(); onStart();}}>
        {bubble(0)}
        {bubble(1, <select aria-label="Service style" value={config.mode}
          onChange={event => setConfig({...config, mode: event.target.value as ShiftConfig['mode']})}>
          <option value="concurrent">Together — all cashiers serve at once (concurrent)</option>
          <option value="sequential">One at a time — a single cashier serves (sequential)</option>
        </select>)}
        {bubble(2, <><input aria-label="Cones in the freezer" type="number" required min={0} max={1000000} value={config.tickets}
          onChange={event => number('tickets', event.target.value)}/> <span>cones</span></>)}
        {bubble(3, <><input aria-label="Cashiers on shift" type="number" required min={1} max={64} value={config.workers}
          disabled={config.mode === 'sequential'} onChange={event => number('workers', event.target.value)}/> <span>cashiers</span>
          {config.mode === 'sequential' && <small className="briefing-hint">Only one cashier works in one-at-a-time mode.</small>}</>)}
        {bubble(4, <><input aria-label="Places in the waiting line" type="number" required min={1} max={10000} value={config.queue}
          onChange={event => number('queue', event.target.value)}/> <span>customers</span></>)}
        {bubble(5, <><input aria-label="Time per cone in milliseconds" type="number" required min={0} max={60000} step={100} value={config.delayMs}
          onChange={event => number('delayMs', event.target.value)}/> <span>milliseconds ({(config.delayMs / 1000).toFixed(1)} s)</span></>)}
        {bubble(6, <button disabled={sending || pending > 0 || controlsOff}
          title={pending > 0 ? 'Wait for the orders in progress to finish' : controlsOff ? 'Shop controls are off' : undefined}>
          {round?.managed ? 'Start a new shift' : 'Open the shop'}</button>)}
        {(finished(5) || done) && warning && <p className="briefing-warning">{warning}</p>}
      </form>
      <ShiftPreview config={config}/>
    </div>
    <p className="admin-shift-status" role="status">{shiftStatus(round)}{pending > 0 && ` · orders in progress: ${pending}`}</p>
  </section>;
}
