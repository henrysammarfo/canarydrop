'use client';

import { useEffect, useState } from 'react';
import type { Hex } from 'viem';
import VerifiedBadge from '@/components/VerifiedBadge';
import type { DeskListing } from '@/lib/domain-verify';
import { listingForDesk } from '@/lib/listing-client';

export default function DeskListingBadge({
  creator,
  domain,
}: {
  creator: Hex;
  domain?: string | null;
}) {
  const [signal, setSignal] = useState<DeskListing>('unknown');
  useEffect(() => {
    let cancelled = false;
    void listingForDesk(creator, domain).then((next) => {
      if (!cancelled) setSignal(next);
    });
    return () => {
      cancelled = true;
    };
  }, [creator, domain]);
  return <VerifiedBadge signal={signal} />;
}
