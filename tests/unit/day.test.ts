import { describe, expect, it } from 'vitest';
import { slotFromDateParts, utcDaySlot } from '@/lib/day';

describe('utc day slot', () => {
  it('encodes YYYYMMDD', () => {
    expect(utcDaySlot(new Date(Date.UTC(2026, 9, 19)))).toBe(20261019n);
    expect(slotFromDateParts(2026, 1, 2)).toBe(20260102n);
  });

  it('uses UTC not local', () => {
    const justAfterUtcMidnight = new Date(Date.UTC(2026, 9, 19, 0, 30));
    expect(utcDaySlot(justAfterUtcMidnight)).toBe(20261019n);
  });

  it('stays on the previous UTC day just before midnight', () => {
    const almost = new Date(Date.UTC(2026, 9, 19, 23, 59, 59));
    expect(utcDaySlot(almost)).toBe(20261019n);
    const next = new Date(Date.UTC(2026, 9, 20, 0, 0, 1));
    expect(utcDaySlot(next)).toBe(20261020n);
  });

  it('pads months and days', () => {
    expect(slotFromDateParts(2026, 10, 9)).toBe(20261009n);
    expect(slotFromDateParts(1999, 1, 1)).toBe(19990101n);
  });
});
