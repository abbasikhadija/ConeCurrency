// Learning articles must describe the real C protocol — Sadia Fatima (P3)
import { describe, it, expect } from 'vitest';
import { ARTICLES } from '../../src/learn/articles';

describe('How it works articles', () => {
  it('quote the real C server reply, not mock ticket IDs', () => {
    const text = ARTICLES.map(article => JSON.stringify(article)).join('\n');
    expect(text).not.toMatch(/OK CONE-/);
    expect(text).toMatch(/OK BOOKED/);
  });
});
