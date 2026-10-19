import { describe, expect, it } from 'vitest';
import { generatePrivateKey } from 'viem/accounts';
import { deriveDemoDeskJwk, demoJwkPublic, demoPubRaw } from '@/lib/demo-key';
import { AppError } from '@/lib/errors';

describe('demo desk key derivation', () => {
  it('derives a stable P-256 jwk from a throwaway eth key', () => {
    const eth = generatePrivateKey();
    const a = deriveDemoDeskJwk(eth);
    const b = deriveDemoDeskJwk(eth);
    expect(a.crv).toBe('P-256');
    expect(a.kty).toBe('EC');
    expect(a.d).toBe(b.d);
    expect(a.x).toBe(b.x);
    expect(demoPubRaw(a).byteLength).toBe(65);
    expect(demoPubRaw(a)[0]).toBe(4);
  });

  it('changes when the seed changes', () => {
    const a = deriveDemoDeskJwk(generatePrivateKey());
    const b = deriveDemoDeskJwk(generatePrivateKey());
    expect(a.d).not.toBe(b.d);
  });

  it('omits d from the public view', () => {
    const jwk = deriveDemoDeskJwk(generatePrivateKey());
    const pub = demoJwkPublic(jwk);
    expect('d' in pub).toBe(false);
    expect(pub.x).toBe(jwk.x);
  });

  it('rejects a malformed eth key', () => {
    expect(() => deriveDemoDeskJwk('nope')).toThrow(AppError);
  });
});
