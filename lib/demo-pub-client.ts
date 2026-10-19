import type { Hex } from 'viem';
import { deskAddress } from './arkiv';
import { b64ToBytes } from './bytes';
import { appFetch } from './client-fetch';

/** Public bytes only. Never fetches the private JWK. */
export async function fetchSharedDemoPub(): Promise<Uint8Array | undefined> {
  try {
    const r = await appFetch('/api/demo/desk/pub');
    if (!r.ok) return undefined;
    const j = (await r.json()) as { pubB64?: string };
    if (typeof j.pubB64 !== 'string') return undefined;
    const pub = b64ToBytes(j.pubB64);
    if (pub.byteLength !== 65 || pub[0] !== 4) return undefined;
    return pub;
  } catch {
    return undefined;
  }
}

export async function preferPubForCreatorClient(creator: Hex): Promise<Uint8Array | undefined> {
  if (creator.toLowerCase() !== deskAddress().toLowerCase()) return undefined;
  return fetchSharedDemoPub();
}
