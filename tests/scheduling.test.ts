import { describe, it, expect } from 'vitest';
import { planForDay, dayIndexSince, addDays } from '../src/lib/utils/scheduling';

describe('scheduling', () => {
  it('spreads topics deterministically', () => {
    const a = planForDay('2026-01-01', 0, 3);
    const b = planForDay('2026-01-01', 1, 3);
    expect(a).toHaveLength(3);
    expect(b).toHaveLength(3);
    expect(a[0]).not.toEqual(b[0]);
  });
  it('day index is 0 for start date', () => {
    expect(dayIndexSince(new Date().toISOString().slice(0, 10))).toBe(0);
  });
  it('addDays works', () => {
    expect(addDays('2026-01-01', 1)).toBe('2026-01-02');
  });
});
