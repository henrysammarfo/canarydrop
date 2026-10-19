import { describe, expect, it } from 'vitest';
import type { Attributes } from '@arkiv-network/sdk';
import { attrKey, attrStr, attrU64 } from '@/lib/attr';

const attrs = {
  type: { type: 'str', value: 'tip' },
  desk: { type: 'key', value: `0x${'ab'.repeat(32)}` },
  slot: { type: 'u64', value: 20261019n },
} as unknown as Attributes;

describe('attribute helpers', () => {
  it('reads str', () => {
    expect(attrStr(attrs, 'type')).toBe('tip');
    expect(attrStr(attrs, 'missing')).toBeUndefined();
    expect(attrStr(undefined, 'type')).toBeUndefined();
  });

  it('reads key', () => {
    expect(attrKey(attrs, 'desk')).toMatch(/^0xab/);
    expect(attrKey(attrs, 'type')).toBeUndefined();
  });

  it('reads u64', () => {
    expect(attrU64(attrs, 'slot')).toBe(20261019n);
    expect(attrU64(attrs, 'type')).toBeUndefined();
  });
});
