import { describe, expect, it } from 'vitest';
import { createDeskBody, replyBody, renewBody, tipBody } from '@/lib/schemas';
import { HEX_KEY } from '../helpers/request';

describe('request schemas', () => {
  it('accepts a valid tip', () => {
    const parsed = tipBody.safeParse({ deskKey: HEX_KEY, wireB64: 'AAECAw==', lifetime: '24h' });
    expect(parsed.success).toBe(true);
  });

  it('rejects extra fields', () => {
    expect(tipBody.safeParse({ deskKey: HEX_KEY, wireB64: 'AAECAw==', lifetime: '24h', extra: 1 }).success).toBe(false);
  });

  it('rejects a bad lifetime', () => {
    expect(tipBody.safeParse({ deskKey: HEX_KEY, wireB64: 'AAECAw==', lifetime: '9d' }).success).toBe(false);
  });

  it('rejects a bad desk key', () => {
    expect(tipBody.safeParse({ deskKey: '0xXYZ', wireB64: 'AAECAw==', lifetime: '24h' }).success).toBe(false);
  });

  it('accepts reply and renew bodies', () => {
    expect(replyBody.safeParse({ tipKey: HEX_KEY, wireB64: 'AAECAw==' }).success).toBe(true);
    expect(renewBody.safeParse({ deskKey: HEX_KEY, canaryKey: HEX_KEY }).success).toBe(true);
  });

  it('caps desk names', () => {
    expect(createDeskBody.safeParse({ name: 'x'.repeat(61), deskPubRawB64: 'AAECAw==' }).success).toBe(false);
    expect(createDeskBody.safeParse({ name: 'Desk', deskPubRawB64: 'AAECAw==' }).success).toBe(true);
  });
});
