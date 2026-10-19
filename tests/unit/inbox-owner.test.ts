import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';
import { pickNewestCanary, tipVisibleInInbox } from '@/lib/arkiv';
import { DEFAULT_RELAY, SEALED_OWNER } from '@/lib/constants';

describe('sealed inbox filter', () => {
  it('shows only burn owned tips', () => {
    expect(tipVisibleInInbox(SEALED_OWNER)).toBe(true);
    expect(tipVisibleInInbox(DEFAULT_RELAY)).toBe(false);
    expect(tipVisibleInInbox(null)).toBe(false);
  });

  it('picks the newest canary row', () => {
    const older = { createdAt: 10n, key: `0x${'aa'.repeat(32)}` as Hex };
    const newer = { createdAt: 20n, key: `0x${'bb'.repeat(32)}` as Hex };
    expect(pickNewestCanary([older, newer])?.key).toBe(newer.key);
    expect(pickNewestCanary([])).toBeNull();
  });
});
