import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';
import { isCanonicalDemoDeskKey } from '@/lib/demo-desk';

const CANON = `0x${'ab'.repeat(32)}` as Hex;

describe('canonical demo desk key', () => {
  it('accepts only the live demo desk entity', () => {
    expect(isCanonicalDemoDeskKey(CANON, CANON)).toBe(true);
    expect(isCanonicalDemoDeskKey(CANON.toUpperCase() as Hex, CANON)).toBe(true);
    expect(isCanonicalDemoDeskKey(`0x${'cd'.repeat(32)}` as Hex, CANON)).toBe(false);
    expect(isCanonicalDemoDeskKey(CANON, null)).toBe(false);
  });
});
