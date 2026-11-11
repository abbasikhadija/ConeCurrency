import { describe, it, expect } from 'vitest';
import { reduceStats, INITIAL_STATS } from '../../src/utils/formatters.js';
import { TapeEntry } from '../../src/types/index.js';

describe('Stats Reducer & Invariant Checker', () => {
  it('returns unchanged copy on empty or undefined entry', () => {
    expect(reduceStats(INITIAL_STATS, undefined)).toEqual(INITIAL_STATS);
    expect(reduceStats(INITIAL_STATS, null as any)).toEqual(INITIAL_STATS);
    expect(reduceStats(INITIAL_STATS, {} as any)).toEqual(INITIAL_STATS);
  });

  it('increments booked count and tracks unique ticket IDs', () => {
    const entry1: TapeEntry = {
      id: '1',
      timestamp: '12:00:00',
      command: 'BOOK',
      rawResponse: 'OK CONE-0001',
      status: 'OK',
      ticketId: 'CONE-0001',
      latencyMs: 15.0,
    };

    const s1 = reduceStats(INITIAL_STATS, entry1);
    expect(s1.booked).toBe(1);
    expect(s1.totalRequests).toBe(1);
    expect(s1.seenTicketIds).toEqual(['CONE-0001']);
    expect(s1.raceConditionDetected).toBe(false);
  });

  it('detects duplicate ticket IDs and flags RACE CONDITION DETECTED', () => {
    const entry1: TapeEntry = {
      id: '1',
      timestamp: '12:00:00',
      command: 'BOOK',
      rawResponse: 'OK CONE-0001',
      status: 'OK',
      ticketId: 'CONE-0001',
      latencyMs: 15.0,
    };

    const s1 = reduceStats(INITIAL_STATS, entry1);
    // Duplicate ticket ID arriving!
    const s2 = reduceStats(s1, entry1);

    expect(s2.booked).toBe(2);
    expect(s2.raceConditionDetected).toBe(true);
  });

  it('detects inventory overselling beyond stock limit and flags RACE CONDITION DETECTED', () => {
    // Max stock set to 3
    const maxStock = 3;
    let current = INITIAL_STATS;

    for (let i = 1; i <= 4; i++) {
      current = reduceStats(
        current,
        {
          id: String(i),
          timestamp: '12:00:00',
          command: 'BOOK',
          rawResponse: `OK CONE-000${i}`,
          status: 'OK',
          ticketId: `CONE-000${i}`,
          latencyMs: 12.0,
        },
        maxStock
      );
    }

    expect(current.booked).toBe(4);
    expect(current.raceConditionDetected).toBe(true);
  });

  it('increments soldOut, busy, and bad counters correctly', () => {
    let s = reduceStats(INITIAL_STATS, { status: 'SOLD_OUT' } as any);
    expect(s.soldOut).toBe(1);

    s = reduceStats(s, { status: 'BUSY' } as any);
    expect(s.busy).toBe(1);

    s = reduceStats(s, { status: 'ERR' } as any);
    expect(s.bad).toBe(1);

    s = reduceStats(s, { status: 'TIMEOUT' } as any);
    expect(s.bad).toBe(2);
  });
});

