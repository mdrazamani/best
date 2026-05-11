import { describe, expect, it } from 'vitest';
import { money, shamsiDate } from './format';

describe('format helpers', () => {
  it('formats money output', () => {
    expect(money(1200000).length).toBeGreaterThan(1);
  });

  it('returns a non-empty persian calendar value', () => {
    const value = shamsiDate('2026-05-12T10:00:00.000Z');
    expect(value).not.toBe('-');
  });
});
