import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';
import { str, u64 } from '@arkiv-network/sdk/attr';
import { canarySignPayload, parseCanarySigFields, signerIsDesk } from '@/lib/canary-sign';
import { DEFAULT_CANARY_STATEMENT } from '@/lib/eip712';
import { DEFAULT_DESK, DEFAULT_IMPOSTOR } from '@/lib/constants';

describe('signed canary fields', () => {
  it('serializes typed data for a wallet prompt', () => {
    const payload = canarySignPayload({
      desk: DEFAULT_DESK,
      statement: DEFAULT_CANARY_STATEMENT,
      issuedAt: 1_700_000_000n,
    });
    expect(payload.primaryType).toBe('CanaryStatement');
    expect(payload.message.issuedAt).toBe('1700000000');
    expect(payload.types.EIP712Domain.length).toBe(3);
  });

  it('reads signature and issued time from attributes or payload', () => {
    const fromAttr = parseCanarySigFields({
      attributes: {
        statement: str('Alive'),
        issuedAt: u64(11n),
        sig: str('0xabc'),
      } as never,
    });
    expect(fromAttr.issuedAt).toBe('11');
    expect(fromAttr.signature).toBe('0xabc');
    const fromPayload = parseCanarySigFields({
      payload: new TextEncoder().encode(JSON.stringify({ statement: 'Alive', issuedAt: '22', sig: '0xdef' })),
    });
    expect(fromPayload.issuedAt).toBe('22');
    expect(fromPayload.signature).toBe('0xdef');
  });

  it('checks the signer against the desk creator', () => {
    expect(signerIsDesk(DEFAULT_DESK, DEFAULT_DESK)).toBe(true);
    expect(signerIsDesk(DEFAULT_IMPOSTOR, DEFAULT_DESK)).toBe(false);
    expect(signerIsDesk(null, DEFAULT_DESK)).toBe(false);
    const desk = DEFAULT_DESK as Hex;
    expect(signerIsDesk(desk, desk)).toBe(true);
  });
});
