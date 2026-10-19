import { describe, expect, it } from 'vitest';
import { DESK_DAILY_CREATE_CAP, DESK_DAILY_WRITE_CAP, MIN_WALLET_WEI, RELAY_DAILY_TIP_CAP } from '@/lib/constants';
import { belowFloor, overDailyCap } from '@/lib/guard';

describe('spend caps', () => {
  it('relay cap is 120 tips a day', () => {
    expect(RELAY_DAILY_TIP_CAP).toBe(120);
    expect(overDailyCap(0, RELAY_DAILY_TIP_CAP)).toBe(false);
    expect(overDailyCap(119, RELAY_DAILY_TIP_CAP)).toBe(false);
    expect(overDailyCap(120, RELAY_DAILY_TIP_CAP)).toBe(true);
    expect(overDailyCap(121, RELAY_DAILY_TIP_CAP)).toBe(true);
  });

  it('desk reply cap is 40 a day', () => {
    expect(DESK_DAILY_WRITE_CAP).toBe(40);
    expect(overDailyCap(40, DESK_DAILY_WRITE_CAP)).toBe(true);
    expect(overDailyCap(39, DESK_DAILY_WRITE_CAP)).toBe(false);
  });

  it('desk create cap is 10 a day', () => {
    expect(DESK_DAILY_CREATE_CAP).toBe(10);
    expect(overDailyCap(10, DESK_DAILY_CREATE_CAP)).toBe(true);
    expect(overDailyCap(9, DESK_DAILY_CREATE_CAP)).toBe(false);
  });

  it('treats NaN and negative used counts as over cap', () => {
    expect(overDailyCap(Number.NaN, 10)).toBe(true);
    expect(overDailyCap(-1, 10)).toBe(true);
    expect(overDailyCap(Number.POSITIVE_INFINITY, 10)).toBe(true);
  });

  it('GLM floor is 0.02', () => {
    expect(MIN_WALLET_WEI).toBe(20n * 10n ** 15n);
    expect(belowFloor(0n)).toBe(true);
    expect(belowFloor(MIN_WALLET_WEI - 1n)).toBe(true);
    expect(belowFloor(MIN_WALLET_WEI)).toBe(false);
    expect(belowFloor(MIN_WALLET_WEI + 1n)).toBe(false);
  });
});
