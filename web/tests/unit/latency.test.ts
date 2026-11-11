import { describe, it, expect } from 'vitest';
import { calculateWindowAverage, updateRollingAverage, formatLatency } from '../../src/utils/latency.js';

describe('Latency Calculations & Rolling Average', () => {
  it('handles empty or null arrays cleanly', () => {
    expect(calculateWindowAverage([])).toBe(0.0);
    expect(calculateWindowAverage(null as any)).toBe(0.0);
    expect(calculateWindowAverage(undefined as any)).toBe(0.0);
  });

  it('calculates average across valid positive numbers', () => {
    expect(calculateWindowAverage([10, 20, 30])).toBe(20.0);
    expect(calculateWindowAverage([15.2, 25.8])).toBe(20.5);
  });

  it('filters out NaN, Infinity, and negative values', () => {
    expect(calculateWindowAverage([10, NaN, 20, -5, Infinity, 30])).toBe(20.0);
  });

  it('respects window size capping at maxWindow (e.g. 5 samples)', () => {
    const latencies = [100, 100, 100, 10, 20, 30]; // 6 items
    // If window is 3, takes last 3: [10, 20, 30] -> avg 20.0
    expect(calculateWindowAverage(latencies, 3)).toBe(20.0);
  });

  it('updates rolling average progressively', () => {
    expect(updateRollingAverage(0, 20, 1)).toBe(20.0);
    expect(updateRollingAverage(20.0, 40, 2)).toBe(30.0);
    expect(updateRollingAverage(30.0, -10, 3)).toBe(30.0); // ignores negative
    expect(updateRollingAverage(30.0, NaN, 3)).toBe(30.0); // ignores NaN
  });

  it('formats latency values for display', () => {
    expect(formatLatency(15.245)).toBe('15.2');
    expect(formatLatency(0)).toBe('0.0');
    expect(formatLatency(-5)).toBe('0.0');
    expect(formatLatency(NaN)).toBe('0.0');
  });
});

