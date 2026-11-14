// Live top-down view of the parlour — Sadia Fatima (P3)
//
// Cashiers are the C server's worker threads; the line is its bounded queue.
// Data comes from GET /api/shop. Who stands at which counter is estimated from
// arrival order (the real queue is first-come, first-served) and says so.
import React, { useEffect, useState } from 'react';

type Person = {name: string; you: boolean; waitedMs: number};
export type ShopSnapshot = {
  managed: boolean;
  mode: 'sequential' | 'concurrent';
  cashiers: number;
  queueCapacity: number | null;
  delayMs: number | null;
  stock: {initial: number; remaining: number} | null;
  counters: Person[];
  line: (Person & {position: number})[];
  crowd: number;
  recent: {name: string; status: string; latencyMs: number; finishedAt: number}[];
  estimated: true;
};

const MAX_COUNTERS_SHOWN = 8;
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

export function youText(shop: ShopSnapshot): string | null {
  if (shop.counters.some(person => person.you)) return 'A cashier is making your cone right now.';
  const me = shop.line.find(person => person.you);
  return me ? `You are number ${me.position} in line (estimated).` : null;
}

export function ShopFloorView({shop}: {shop: ShopSnapshot}) {
  const soldOut = shop.stock?.remaining === 0;
  const shown = Math.min(shop.cashiers, MAX_COUNTERS_SHOWN);
  const stations = Array.from({length: shown}, (_, i) => shop.counters[i]);
  const you = youText(shop);
  return <section className={`shop-floor${soldOut ? ' shop-sold-out' : ''}`} aria-labelledby="shop-floor-title">
    <header className="shop-floor-head">
      <h3 id="shop-floor-title">Inside the parlour</h3>
      <span className="shop-chip">{shop.cashiers === 1 ? '1 cashier' : `${shop.cashiers} cashiers`} · {shop.mode}</span>
      {shop.stock && <span className="shop-chip shop-stock" aria-label="Cones left">🍦 {shop.stock.remaining} / {shop.stock.initial} cones left</span>}
    </header>
    {you && <p className="shop-you" aria-live="polite">{you}</p>}

    <div className="shop-counters" aria-label="Cashier counters (worker threads)">
      {stations.map((person, i) => <div key={i} className={`shop-counter${person ? ' busy' : ''}${person?.you ? ' you' : ''}`}>
        <span className="shop-cashier" aria-hidden="true">{soldOut && !person ? '😴' : '👩‍🍳'}</span>
        <span className="shop-counter-label">Cashier {i + 1}</span>
        {person ? <>
          <span className="shop-customer">{person.you ? `You (${person.name})` : person.name}</span>
          <span className="shop-progress" aria-label="Making a cone"/>
        </> : <span className="shop-free">{soldOut ? 'No cones left' : 'Free'}</span>}
      </div>)}
      {shop.cashiers > shown && <div className="shop-counter more">+{shop.cashiers - shown} more cashiers</div>}
      {soldOut && <div className="shop-sold-out-sign" aria-label="Sold out">SOLD OUT</div>}
    </div>

    <div className="shop-line" aria-label="Waiting line (queue)">
      <span className="shop-line-label">Waiting line{shop.queueCapacity ? ` · room for ${shop.queueCapacity}` : ''}</span>
      <ol>
        {shop.line.map(person => <li key={`${person.position}-${person.name}`} className={person.you ? 'you' : undefined}>
          <span className="shop-position">#{person.position}</span>
          <span aria-hidden="true">🧍</span>
          <span>{person.you ? `You (${person.name})` : person.name}</span>
          <small>{seconds(person.waitedMs)}</small>
        </li>)}
        {shop.crowd > 0 && <li className="crowd">+{shop.crowd} crowd {shop.crowd === 1 ? 'customer' : 'customers'} from the team</li>}
        {!shop.line.length && !shop.crowd && <li className="empty">Nobody is waiting</li>}
      </ol>
    </div>

    {shop.recent.length > 0 && <div className="shop-recent" aria-label="Recently served">
      <span className="shop-line-label">Just served</span>
      <ul>{shop.recent.map(item => <li key={`${item.finishedAt}-${item.name}`} className={`recent-${item.status.toLowerCase()}`}>
        {item.name} {item.status === 'OK' ? '🍦' : item.status === 'SOLD_OUT' ? '· sold out' : item.status === 'BUSY' ? '· line full' : '· not confirmed'} · {seconds(item.latencyMs)}
      </li>)}</ul>
    </div>}

    <p className="shop-note">Cashiers are the server's worker threads and the line is its waiting queue. Positions are estimated from
      the order people pressed "order"; the real queue serves first come, first served.</p>
  </section>;
}

/** Polls the live snapshot while the student is in the shop. */
export default function ShopFloor({api}: {api: (url: string) => Promise<any>}) {
  const [shop, setShop] = useState<ShopSnapshot | null>(null);
  useEffect(() => {
    let mounted = true;
    const refresh = () => void api('shop').then(data => { if (mounted) setShop(data); }).catch(() => {});
    refresh();
    const timer = setInterval(refresh, 700);
    return () => { mounted = false; clearInterval(timer); };
  }, [api]);
  return shop ? <ShopFloorView shop={shop}/> : null;
}
