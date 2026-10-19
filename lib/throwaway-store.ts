import type { Hex } from 'viem';
import { newThrowawayKey } from './direct-tip';
import { isPrivateKey } from './hex';

export const THROWAWAY_STORE = 'canarydrop/throwawayKey';

export function loadThrowawayKey(storage?: Storage | null): Hex | null {
  const store = storage ?? (typeof sessionStorage === 'undefined' ? null : sessionStorage);
  if (!store) return null;
  try {
    const raw = store.getItem(THROWAWAY_STORE);
    if (!raw || !isPrivateKey(raw)) return null;
    return raw as Hex;
  } catch {
    return null;
  }
}

export function saveThrowawayKey(privateKey: Hex, storage?: Storage | null): void {
  if (!isPrivateKey(privateKey)) return;
  const store = storage ?? (typeof sessionStorage === 'undefined' ? null : sessionStorage);
  if (!store) return;
  try {
    store.setItem(THROWAWAY_STORE, privateKey);
  } catch {
    // Private mode can refuse sessionStorage.
  }
}

export function clearThrowawayKey(storage?: Storage | null): void {
  const store = storage ?? (typeof sessionStorage === 'undefined' ? null : sessionStorage);
  if (!store) return;
  try {
    store.removeItem(THROWAWAY_STORE);
  } catch {
    // Ignore.
  }
}

/** One throwaway key per tab. A new key on every send can never be funded. */
export function loadOrCreateThrowawayKey(storage?: Storage | null): Hex {
  const existing = loadThrowawayKey(storage);
  if (existing) return existing;
  const next = newThrowawayKey();
  saveThrowawayKey(next, storage);
  return next;
}

export function formatGlm(wei: bigint): string {
  const whole = wei / 10n ** 18n;
  const frac = (wei % 10n ** 18n).toString().padStart(18, '0').slice(0, 4);
  return `${whole}.${frac} GLM`;
}
