import type { Hex } from 'viem';
import { deskAddress, getDesk } from './arkiv';
import { preferPubForCreator } from './demo-pub';

/** Live desk entity created by the canonical demo wallet. */
export async function resolveCanonicalDemoDeskKey(): Promise<Hex | null> {
  const creator = deskAddress();
  const desk = await getDesk(creator, preferPubForCreator(creator));
  return desk?.key ?? null;
}

export function isCanonicalDemoDeskKey(deskKey: Hex, canonical: Hex | null | undefined): boolean {
  if (!canonical) return false;
  return deskKey.toLowerCase() === canonical.toLowerCase();
}
