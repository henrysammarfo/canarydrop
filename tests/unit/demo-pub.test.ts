import { afterEach, describe, expect, it } from 'vitest';
import { generatePrivateKey } from 'viem/accounts';
import { DEFAULT_DESK, DEFAULT_IMPOSTOR } from '@/lib/constants';
import { preferPubForCreator, sharedDemoPub } from '@/lib/demo-pub';

describe('shared demo pub', () => {
  afterEach(() => {
    delete process.env.DESK_PRIVATE_KEY;
  });

  it('is undefined without a desk wallet key', () => {
    expect(sharedDemoPub()).toBeUndefined();
    expect(preferPubForCreator(DEFAULT_DESK)).toBeUndefined();
  });

  it('returns public bytes for the demo wallet only', () => {
    process.env.DESK_PRIVATE_KEY = generatePrivateKey();
    const pub = preferPubForCreator(DEFAULT_DESK);
    expect(pub?.byteLength).toBe(65);
    expect(pub?.[0]).toBe(4);
    expect(preferPubForCreator(DEFAULT_IMPOSTOR)).toBeUndefined();
  });
});
