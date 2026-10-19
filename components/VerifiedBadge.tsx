import Badge from '@/components/ui/Badge';
import type { DeskListing } from '@/lib/domain-verify';

export default function VerifiedBadge({
  signal,
  compact = false,
}: {
  signal: DeskListing;
  compact?: boolean;
}) {
  if (signal === 'listed') {
    return <Badge tone="ok">{compact ? 'Verified' : 'Verified domain'}</Badge>;
  }
  if (signal === 'mismatch') {
    return <Badge tone="wait">{compact ? 'Unlisted' : 'Not the desk this site lists'}</Badge>;
  }
  return null;
}
