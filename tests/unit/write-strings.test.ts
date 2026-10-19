import { describe, expect, it } from 'vitest';
import { str } from '@arkiv-network/sdk/attr';
import { canaryWriteAttrs, canaryWritePayload, canarySigFromRow } from '@/lib/arkiv';
import { DEFAULT_CANARY_STATEMENT } from '@/lib/eip712';
import {
  EIP712_SIG_HEX,
  canaryWriteAttrNames,
  productWriteStringValues,
} from '@/lib/write-strings';

describe('SDK string attribute cap', () => {
  it('rejects a 132-character EIP-712 signature with the real str() helper', () => {
    expect(EIP712_SIG_HEX.length).toBe(132);
    expect(() => str(EIP712_SIG_HEX)).toThrow(/128-byte limit/);
  });

  it('omits sig from signed canary and create-desk attributes', () => {
    const names = canaryWriteAttrNames(true);
    expect(names).toContain('statement');
    expect(names).not.toContain('sig');
    const attrs = canaryWriteAttrs(`0x${'11'.repeat(32)}`, {
      statement: DEFAULT_CANARY_STATEMENT,
      issuedAt: 1n,
      signature: EIP712_SIG_HEX,
    });
    expect(attrs).not.toHaveProperty('sig');
  });

  it('stores the EIP-712 signature in the payload so readers still find it', () => {
    const payload = canaryWritePayload({
      statement: DEFAULT_CANARY_STATEMENT,
      issuedAt: 11n,
      signature: EIP712_SIG_HEX,
    });
    const parsed = JSON.parse(new TextDecoder().decode(payload)) as { sig?: string };
    expect(parsed.sig).toBe(EIP712_SIG_HEX);
    expect(canarySigFromRow({ payload }).signature).toBe(EIP712_SIG_HEX);
  });

  it('accepts every product string attribute with the real SDK str() check', () => {
    const values = productWriteStringValues();
    expect(values.length).toBeGreaterThan(4);
    expect(values).toContain(DEFAULT_CANARY_STATEMENT);
    expect(values).not.toContain(EIP712_SIG_HEX);
    for (const value of values) {
      const cell = str(value);
      expect(cell.value).toBe(value);
      expect(new TextEncoder().encode(value).byteLength).toBeLessThanOrEqual(128);
    }
  });
});
