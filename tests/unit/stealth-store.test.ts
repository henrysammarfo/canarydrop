import { describe, expect, it } from 'vitest';
import { isAddress, isPrivateKey } from '@/lib/hex';
import { announcementForReply, loadOrCreateStealthMeta } from '@/lib/stealth-store';
import { stealthMatches } from '@/lib/stealth';

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

describe('stealth meta store', () => {
  it('reuses one meta and builds a matching announcement', () => {
    const store = new MemoryStore() as unknown as Storage;
    const first = loadOrCreateStealthMeta(store);
    const second = loadOrCreateStealthMeta(store);
    expect(first.spendingPriv).toBe(second.spendingPriv);
    expect(isPrivateKey(first.spendingPriv)).toBe(true);
    const announcement = announcementForReply(first.meta);
    expect(isAddress(announcement.stealthAddress)).toBe(true);
    expect(stealthMatches(announcement, first.viewingPriv, first.spendingPriv)).toBe(true);
  });
});
