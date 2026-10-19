import { describe, expect, it } from 'vitest';
import { privateKeyToAddress } from 'viem/accounts';
import {
  encodeStealthMeta,
  generateStealthAddress,
  isStealthAddress,
  newStealthMeta,
  parseStealthMeta,
  recoverStealthPrivateKey,
  STEALTH_SCHEME_ID,
  stealthMatches,
} from '@/lib/stealth';

describe('ERC-5564 style stealth addresses', () => {
  it('encodes and parses a meta-address', () => {
    const { meta } = newStealthMeta();
    const encoded = encodeStealthMeta(meta);
    expect(encoded.startsWith('st:eth:0x01')).toBe(true);
    expect(parseStealthMeta(encoded)).toEqual(meta);
    expect(parseStealthMeta('nope')).toBeNull();
    expect(STEALTH_SCHEME_ID).toBe(1);
  });

  it('lets the recipient recover the one-time address', () => {
    const keys = newStealthMeta();
    const announcement = generateStealthAddress(keys.meta);
    const priv = recoverStealthPrivateKey(announcement, keys.viewingPriv, keys.spendingPriv);
    expect(privateKeyToAddress(priv).toLowerCase()).toBe(announcement.stealthAddress.toLowerCase());
    expect(stealthMatches(announcement, keys.viewingPriv, keys.spendingPriv)).toBe(true);
    expect(isStealthAddress(announcement.stealthAddress)).toBe(true);
  });

  it('rejects the wrong viewing key', () => {
    const a = newStealthMeta();
    const b = newStealthMeta();
    const announcement = generateStealthAddress(a.meta);
    expect(stealthMatches(announcement, b.viewingPriv, a.spendingPriv)).toBe(false);
  });
});
