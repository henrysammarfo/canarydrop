import type { Hex } from 'viem';
import { isPrivateKey } from './hex';
import { generateStealthAddress, newStealthMeta, type StealthAnnouncement, type StealthMeta } from './stealth';

export const STEALTH_STORE = 'canarydrop/stealthMeta';

export type StoredStealthMeta = {
  spendingPriv: Hex;
  viewingPriv: Hex;
  meta: StealthMeta;
};

export function loadStealthMeta(storage?: Storage | null): StoredStealthMeta | null {
  const store = storage ?? (typeof localStorage === 'undefined' ? null : localStorage);
  if (!store) return null;
  try {
    const raw = store.getItem(STEALTH_STORE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredStealthMeta>;
    if (!parsed.spendingPriv || !parsed.viewingPriv || !parsed.meta) return null;
    if (!isPrivateKey(parsed.spendingPriv) || !isPrivateKey(parsed.viewingPriv)) return null;
    if (!parsed.meta.spending || !parsed.meta.viewing) return null;
    return { spendingPriv: parsed.spendingPriv, viewingPriv: parsed.viewingPriv, meta: parsed.meta };
  } catch {
    return null;
  }
}

export function saveStealthMeta(value: StoredStealthMeta, storage?: Storage | null): void {
  const store = storage ?? (typeof localStorage === 'undefined' ? null : localStorage);
  if (!store) return;
  try {
    store.setItem(STEALTH_STORE, JSON.stringify(value));
  } catch {
    // Ignore.
  }
}

export function loadOrCreateStealthMeta(storage?: Storage | null): StoredStealthMeta {
  const existing = loadStealthMeta(storage);
  if (existing) return existing;
  const created = newStealthMeta();
  saveStealthMeta(created, storage);
  return created;
}

export function announcementForReply(meta: StealthMeta): StealthAnnouncement {
  const out = generateStealthAddress(meta);
  return {
    schemeId: out.schemeId,
    ephemeralPub: out.ephemeralPub,
    stealthAddress: out.stealthAddress,
    viewTag: out.viewTag,
  };
}
