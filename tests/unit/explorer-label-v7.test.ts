import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';
import { DEFAULT_DESK, DEFAULT_IMPOSTOR } from '@/lib/constants';
import { explorerRowFlags, explorerTypeBadges } from '@/lib/explorer-label';

const KEY = `0x${'1f'.repeat(32)}` as Hex;

describe('verified domain flags', () => {
  it('marks the listed desk as verified', () => {
    const row = explorerRowFlags({
      type: 'desk',
      key: KEY,
      creator: DEFAULT_DESK,
      demoCreator: DEFAULT_DESK,
      impostorCreator: DEFAULT_IMPOSTOR,
      listedDesk: DEFAULT_DESK,
    });
    expect(row.verifiedDomain).toBe(true);
    expect(row.unlistedDesk).toBe(false);
    expect(explorerTypeBadges(row).some((b) => b.full === 'Verified domain')).toBe(true);
  });

  it('marks another creator as unlisted', () => {
    const row = explorerRowFlags({
      type: 'desk',
      key: KEY,
      creator: DEFAULT_IMPOSTOR,
      demoCreator: DEFAULT_DESK,
      impostorCreator: DEFAULT_IMPOSTOR,
      listedDesk: DEFAULT_DESK,
    });
    expect(row.impostor).toBe(true);
    expect(row.unlistedDesk).toBe(true);
    expect(row.verifiedDomain).toBe(false);
    expect(explorerTypeBadges(row).some((b) => b.short === 'Unlisted')).toBe(false);
  });
});
