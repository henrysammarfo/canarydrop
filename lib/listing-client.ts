import type { Hex } from 'viem';
import {
  fakeDeskSignal,
  fetchDeskRecord,
  lookupDeclaredDomain,
  wellKnownUrl,
  type DeskListing,
} from './domain-verify';

export async function listingForDesk(creator: Hex, declaredDomain?: string | null): Promise<DeskListing> {
  if (declaredDomain) {
    const lookup = await lookupDeclaredDomain(declaredDomain);
    return fakeDeskSignal(lookup.listedDesk, creator);
  }
  const rec = await fetchDeskRecord(wellKnownUrl());
  return fakeDeskSignal(rec?.desk ?? null, creator);
}
