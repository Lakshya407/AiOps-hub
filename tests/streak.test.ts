import { describe, it, expect } from 'vitest';
import { computeStreak } from '../src/lib/utils/streak';

const iso = (offsetDays: number) => { const d = new Date(); d.setDate(d.getDate() - offsetDays); return d.toISOString().slice(0, 10); };

describe('computeStreak', () => {
  it('counts consecutive active days', () => {
    expect(computeStreak([iso(0), iso(1), iso(2)])).toBe(3);
  });
  it('breaks on gap', () => {
    expect(computeStreak([iso(0), iso(2)])).toBe(1);
  });
  it('rest days do not break streak', () => {
    expect(computeStreak([iso(0), iso(2)], [iso(1)])).toBe(2);
  });
});
