import type { Hex } from 'viem';
import { deskAddress } from './arkiv';
import { deriveDemoDeskJwk, demoPubRaw } from './demo-key';
import { isPrivateKey } from './hex';

/** Public bytes of the shared demo P-256 key. Server only. Undefined if demo mode is off. */
export function sharedDemoPub(): Uint8Array | undefined {
  const raw = process.env.DESK_PRIVATE_KEY ?? '';
  if (!isPrivateKey(raw)) return undefined;
  try {
    return demoPubRaw(deriveDemoDeskJwk(raw));
  } catch {
    return undefined;
  }
}

/** Prefer the shared demo pub only for the canonical demo desk wallet. Impostor stays untouched. */
export function preferPubForCreator(creator: Hex): Uint8Array | undefined {
  if (creator.toLowerCase() !== deskAddress().toLowerCase()) return undefined;
  return sharedDemoPub();
}
