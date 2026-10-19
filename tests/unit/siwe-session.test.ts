import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { deskWriteAllowed, restoreSiweSession, saveSiweSession, siweSessionHostOk } from '@/lib/siwe-session';
import { buildSiweMessage, newsroomSiweFields } from '@/lib/siwe';
import { DEFAULT_DESK, DEFAULT_IMPOSTOR } from '@/lib/constants';

class MemoryStore {
  map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

describe('SIWE desk write gate', () => {
  it('allows demo writes and same signer as creator', () => {
    expect(deskWriteAllowed({ creator: DEFAULT_DESK, signer: null, demo: true })).toBe(true);
    expect(deskWriteAllowed({ creator: DEFAULT_DESK, signer: DEFAULT_DESK, demo: false })).toBe(true);
    expect(deskWriteAllowed({ creator: DEFAULT_DESK, signer: DEFAULT_IMPOSTOR, demo: false })).toBe(false);
    expect(deskWriteAllowed({ creator: DEFAULT_DESK, signer: null, demo: false })).toBe(false);
  });

  it('restores only a verified session for this host', async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const fields = newsroomSiweFields({
      domain: 'localhost',
      address: account.address,
      uri: 'http://localhost:3000/desk',
      nonce: 'abcd',
      issuedAt: '2026-10-19T00:00:00.000Z',
    });
    const message = buildSiweMessage(fields);
    const signature = (await account.signMessage({ message })) as Hex;
    const store = new MemoryStore() as unknown as Storage;
    saveSiweSession({ address: account.address, message, signature }, store);
    expect(siweSessionHostOk({ address: account.address, message, signature }, 'localhost')).toBe(true);
    const restored = await restoreSiweSession('localhost', store);
    expect(restored?.address).toBe(account.address);
    const rejected = await restoreSiweSession('evil.example', store);
    expect(rejected).toBeNull();
  });
});
