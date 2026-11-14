// Live shop snapshot for the student shop floor — Sadia Fatima (P3)
//
// Everything here is either measured by the bridge or taken from the settings
// the bridge used to start the C server. The C server does not report which
// worker holds which customer, so "at a counter" vs "in line" is an ESTIMATE
// from arrival order (the real queue is FIFO), and is labelled as such.

export type ShopOrderInput = {name: string; isYou: boolean; sentAt: number};
export type ShopRecentInput = {name: string; status: string; latencyMs: number; finishedAt: number};
export type ShopInput = {
  managed: boolean;
  mode: 'sequential' | 'concurrent';
  workers: number;
  queueCapacity: number;
  delayMs: number;
  initialStock: number;
  booked: number;
  pending: ShopOrderInput[];
  inFlightTotal: number;        // every request the bridge is waiting on, students and admin crowds
  recent: ShopRecentInput[];
  now: number;
};

export type ShopSnapshot = {
  managed: boolean;
  mode: 'sequential' | 'concurrent';
  cashiers: number;
  queueCapacity: number | null;
  delayMs: number | null;
  stock: {initial: number; remaining: number} | null;
  counters: {name: string; you: boolean; waitedMs: number}[];
  line: {name: string; you: boolean; position: number; waitedMs: number}[];
  crowd: number;
  recent: ShopRecentInput[];
  estimated: true;
};

export function buildShopSnapshot(input: ShopInput): ShopSnapshot {
  const cashiers = input.mode === 'sequential' ? 1 : Math.max(1, input.workers);
  const ordered = [...input.pending].sort((a, b) => a.sentAt - b.sentAt);   // FIFO, like the C queue
  const people = ordered.map(order => ({name: order.name, you: order.isYou, waitedMs: Math.max(0, input.now - order.sentAt)}));
  return {
    managed: input.managed,
    mode: input.mode,
    cashiers,
    queueCapacity: input.managed ? input.queueCapacity : null,
    delayMs: input.managed ? input.delayMs : null,
    // Stock is only known when the bridge started this round itself.
    stock: input.managed ? {initial: input.initialStock, remaining: Math.max(0, input.initialStock - input.booked)} : null,
    counters: people.slice(0, cashiers),
    line: people.slice(cashiers).map((person, index) => ({...person, position: index + 1})),
    crowd: Math.max(0, input.inFlightTotal - input.pending.length),
    recent: input.recent.slice(0, 8),
    estimated: true,
  };
}
