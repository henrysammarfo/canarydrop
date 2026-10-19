import { describe, expect, it } from 'vitest';
import { isPrivateKey } from '@/lib/hex';
import {
  THROWAWAY_STORE,
  clearThrowawayKey,
  formatGlm,
  loadOrCreateThrowawayKey,
  loadThrowawayKey,
  saveThrowawayKey,
} from '@/lib/throwaway-store';

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

describe('throwaway key store', () => {
  it('keeps one key per store so a funded address can be reused', () => {
    const store = new MemoryStore() as unknown as Storage;
    const first = loadOrCreateThrowawayKey(store);
    const second = loadOrCreateThrowawayKey(store);
    expect(isPrivateKey(first)).toBe(true);
    expect(second).toBe(first);
    expect(store.getItem(THROWAWAY_STORE)).toBe(first);
  });

  it('clears and then mints a new key', () => {
    const store = new MemoryStore() as unknown as Storage;
    const first = loadOrCreateThrowawayKey(store);
    clearThrowawayKey(store);
    expect(loadThrowawayKey(store)).toBeNull();
    const next = loadOrCreateThrowawayKey(store);
    expect(next).not.toBe(first);
  });

  it('rejects a malformed stored value', () => {
    const store = new MemoryStore() as unknown as Storage;
    store.setItem(THROWAWAY_STORE, 'nope');
    expect(loadThrowawayKey(store)).toBeNull();
    saveThrowawayKey('0x1' as never, store);
    expect(store.getItem(THROWAWAY_STORE)).toBe('nope');
  });

  it('formats GLM without scientific notation', () => {
    expect(formatGlm(0n)).toBe('0.0000 GLM');
    expect(formatGlm(20n * 10n ** 15n)).toBe('0.0200 GLM');
  });
});
