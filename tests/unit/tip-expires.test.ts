import { describe, expect, it } from 'vitest';
import { ExpirationTime } from '@arkiv-network/sdk';
import { LIFETIMES, tipExpires } from '@/lib/arkiv';
import { DEMO_TIP_LIVE_UNTIL } from '@/lib/constants';

describe('tipExpires', () => {
  it('keeps new tips live until 27 Oct 2026 when that date is still ahead', () => {
    const now = new Date('2026-10-19T12:00:00.000Z');
    const expires = tipExpires('1h', now);
    const expected = ExpirationTime.atDate(DEMO_TIP_LIVE_UNTIL, { atLeast: LIFETIMES['1h'] });
    expect(expires.expiresAt).toEqual(expected.expiresAt);
    expect(expires.minLifetime).toBe(expected.minLifetime);
    expect(expires.expiresAt).toEqual(DEMO_TIP_LIVE_UNTIL);
  });

  it('uses the chosen lifetime after the judging floor', () => {
    const now = new Date('2026-10-28T00:00:00.000Z');
    expect(tipExpires('1h', now)).toEqual(LIFETIMES['1h']);
    expect(tipExpires('7d', now)).toEqual(LIFETIMES['7d']);
  });
});
