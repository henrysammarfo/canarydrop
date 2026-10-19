import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';
import {
  pickLiveDesk,
  deskRowMatchesPub,
  createdDeskAndCanary,
  fetchedDeskIsReady,
  DESK_CREATED_NOTICE,
  DESK_CREATED_TOAST,
} from '@/lib/desk-pick';

const SHARED = Uint8Array.from({ length: 65 }, (_, i) => (i === 0 ? 4 : 1));
const OTHER = Uint8Array.from({ length: 65 }, (_, i) => (i === 0 ? 4 : 2));

function row(createdAt: bigint, pub: Uint8Array, key: string) {
  return {
    key: key as Hex,
    createdAt,
    payload: new TextEncoder().encode(JSON.stringify({ name: 'Desk', pub: Array.from(pub) })),
  };
}

describe('pickLiveDesk', () => {
  it('returns the newest row when no pub is preferred', () => {
    const rows = [row(1n, SHARED, `0x${'11'.repeat(32)}`), row(3n, OTHER, `0x${'33'.repeat(32)}`)];
    expect(pickLiveDesk(rows)?.key).toBe(`0x${'33'.repeat(32)}`);
  });

  it('prefers the newest live desk whose payload pub matches the shared key', () => {
    const matchingOlder = row(2n, SHARED, `0x${'22'.repeat(32)}`);
    const matchingNewer = row(4n, SHARED, `0x${'44'.repeat(32)}`);
    const newestWrong = row(9n, OTHER, `0x${'99'.repeat(32)}`);
    const picked = pickLiveDesk([matchingOlder, newestWrong, matchingNewer], SHARED);
    expect(picked?.key).toBe(`0x${'44'.repeat(32)}`);
    expect(deskRowMatchesPub(picked!, SHARED)).toBe(true);
  });

  it('falls back to newest when nothing matches the shared key', () => {
    const rows = [row(1n, OTHER, `0x${'11'.repeat(32)}`), row(2n, OTHER, `0x${'22'.repeat(32)}`)];
    expect(pickLiveDesk(rows, SHARED)?.key).toBe(`0x${'22'.repeat(32)}`);
  });

  it('returns undefined for an empty list', () => {
    expect(pickLiveDesk([])).toBeUndefined();
  });

  it('reads desk and canary keys from a create batch', () => {
    const desk = `0x${'ab'.repeat(32)}`;
    const canary = `0x${'cd'.repeat(32)}`;
    expect(createdDeskAndCanary([desk, canary])).toEqual({ deskKey: desk, canaryKey: canary });
    expect(createdDeskAndCanary(['nope'])).toEqual({});
  });

  it('waits until the fetched desk matches the shared key and expected key', () => {
    const matching = row(4n, SHARED, `0x${'44'.repeat(32)}`);
    const other = row(9n, OTHER, `0x${'99'.repeat(32)}`);
    expect(fetchedDeskIsReady(other, SHARED, matching.key)).toBe(false);
    expect(fetchedDeskIsReady(matching, SHARED, matching.key)).toBe(true);
    expect(fetchedDeskIsReady(matching, SHARED, other.key)).toBe(false);
  });

  it('uses plain English for the create success copy', () => {
    expect(DESK_CREATED_TOAST).toBe('Desk and canary created.');
    expect(DESK_CREATED_NOTICE).toContain('This browser now uses the new live desk.');
    expect(DESK_CREATED_NOTICE).not.toMatch(/[\u2013\u2014]/);
    expect(DESK_CREATED_TOAST).not.toMatch(/[\u2013\u2014]/);
  });
});

