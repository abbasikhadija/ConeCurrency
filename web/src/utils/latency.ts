/**
 * Latency calculation and rolling average utilities.
 */

/**
 * Calculates rolling average of latencies over a fixed window size.
 * Handles edge cases like empty inputs, non-finite values, and negative numbers.
 */
export function calculateWindowAverage(latencies: number[], maxWindow: number = 50): number {
  if (!latencies || latencies.length === 0) {
    return 0.0;
  }

  // Filter out invalid numbers (NaN, Infinity, negative)
  const valid = latencies.filter((val) => typeof val === 'number' && Number.isFinite(val) && val >= 0);

  if (valid.length === 0) {
    return 0.0;
  }

  // Use the most recent maxWindow values
  const windowSlice = valid.slice(-maxWindow);
  const sum = windowSlice.reduce((acc, val) => acc + val, 0);
  const avg = sum / windowSlice.length;

  return parseFloat(avg.toFixed(1));
}

/**
 * Updates a running average given a new sample.
 */
export function updateRollingAverage(currentAvg: number, newSample: number, totalSamples: number): number {
  if (!Number.isFinite(newSample) || newSample < 0) {
    return currentAvg;
  }
  if (totalSamples <= 1) {
    return parseFloat(newSample.toFixed(1));
  }

  // Numerical stability check
  const updated = currentAvg + (newSample - currentAvg) / totalSamples;
  return parseFloat(updated.toFixed(1));
}

/**
 * Formats millisecond latency into clean string for display.
 */
export function formatLatency(latencyMs: number): string {
  if (!Number.isFinite(latencyMs) || latencyMs < 0) {
    return '0.0';
  }
  return latencyMs.toFixed(1);
}

