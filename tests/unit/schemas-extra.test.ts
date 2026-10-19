import { describe, expect, it } from 'vitest';
import { MAX_WIRE_B64_CHARS } from '@/lib/constants';
import { createDeskBody, hexKey, replyBody, renewBody, tipBody } from '@/lib/schemas';
import { HEX_KEY, ZERO_KEY } from '../helpers/request';

describe('schema extra cases', () => {
  it('accepts every product lifetime', () => {
    for (const lifetime of ['1h', '24h', '72h', '7d'] as const) {
      expect(tipBody.safeParse({ deskKey: HEX_KEY, wireB64: 'AAECAw==', lifetime }).success).toBe(true);
    }
  });

  it('rejects empty and huge desk names', () => {
    expect(createDeskBody.safeParse({ name: '', deskPubRawB64: 'AAECAw==' }).success).toBe(false);
    expect(createDeskBody.safeParse({ name: 'A', deskPubRawB64: 'AAECAw==' }).success).toBe(true);
    expect(createDeskBody.safeParse({ name: 'x'.repeat(60), deskPubRawB64: 'AAECAw==' }).success).toBe(true);
  });

  it('rejects a missing canary key on renew', () => {
    expect(renewBody.safeParse({ deskKey: HEX_KEY }).success).toBe(false);
    expect(renewBody.safeParse({ deskKey: ZERO_KEY, canaryKey: HEX_KEY }).success).toBe(true);
  });

  it('rejects a wire under 8 chars', () => {
    expect(replyBody.safeParse({ tipKey: HEX_KEY, wireB64: 'AA==' }).success).toBe(false);
    expect(tipBody.safeParse({ deskKey: HEX_KEY, wireB64: 'AA==', lifetime: '24h' }).success).toBe(false);
  });

  it('rejects a wire over the shared b64 cap', () => {
    const huge = 'A'.repeat(MAX_WIRE_B64_CHARS + 1);
    expect(tipBody.safeParse({ deskKey: HEX_KEY, wireB64: huge, lifetime: '24h' }).success).toBe(false);
    expect(replyBody.safeParse({ tipKey: HEX_KEY, wireB64: huge }).success).toBe(false);
  });

  it('hexKey requires 0x and 64 hex chars', () => {
    expect(hexKey.safeParse(HEX_KEY).success).toBe(true);
    expect(hexKey.safeParse(HEX_KEY.slice(2)).success).toBe(false);
    expect(hexKey.safeParse(`0x${'g'.repeat(64)}`).success).toBe(false);
    expect(hexKey.safeParse(`0x${'a'.repeat(63)}`).success).toBe(false);
  });
});
