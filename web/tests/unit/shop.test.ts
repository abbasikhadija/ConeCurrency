// Shop snapshot rules — Sadia Fatima (P3)
import { describe, it, expect } from 'vitest';
import { buildShopSnapshot, ShopInput } from '../../server/shop';

const base: ShopInput = {managed: true, mode: 'concurrent', workers: 2, queueCapacity: 8, delayMs: 500,
  initialStock: 10, booked: 3, pending: [], inFlightTotal: 0, recent: [], now: 10_000};
const order = (name: string, sentAt: number, isYou = false) => ({name, sentAt, isYou});

describe('buildShopSnapshot', () => {
  it('fills the counters first in arrival order (FIFO) and numbers the rest of the line', () => {
    const shop = buildShopSnapshot({...base, pending: [order('C', 3000), order('A', 1000), order('D', 4000, true), order('B', 2000)], inFlightTotal: 4});
    expect(shop.counters.map(p => p.name)).toEqual(['A', 'B']);
    expect(shop.line).toEqual([
      {name: 'C', you: false, position: 1, waitedMs: 7000},
      {name: 'D', you: true, position: 2, waitedMs: 6000},
    ]);
    expect(shop.estimated).toBe(true);
  });

  it('uses one cashier in sequential mode', () => {
    const shop = buildShopSnapshot({...base, mode: 'sequential', pending: [order('A', 1), order('B', 2)], inFlightTotal: 2});
    expect(shop.cashiers).toBe(1);
    expect(shop.counters).toHaveLength(1);
    expect(shop.line).toHaveLength(1);
  });

  it('reports stock left only for rounds the bridge started', () => {
    expect(buildShopSnapshot(base).stock).toEqual({initial: 10, remaining: 7});
    expect(buildShopSnapshot({...base, booked: 12}).stock?.remaining).toBe(0);
    const external = buildShopSnapshot({...base, managed: false});
    expect(external.stock).toBeNull();
    expect(external.delayMs).toBeNull();
    expect(external.queueCapacity).toBeNull();
  });

  it('counts admin crowd requests that are not student orders', () => {
    expect(buildShopSnapshot({...base, pending: [order('A', 1)], inFlightTotal: 11}).crowd).toBe(10);
    expect(buildShopSnapshot({...base, pending: [order('A', 1)], inFlightTotal: 0}).crowd).toBe(0);
  });
});
