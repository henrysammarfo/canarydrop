import type { Hex } from 'viem';
import CanaryStatusLive from '@/components/CanaryStatusLive';
import { DEFAULT_DESK, DEFAULT_IMPOSTOR } from '@/lib/constants';

export const dynamic = process.env.STATIC_EXPORT === '1' ? 'force-static' : 'force-dynamic';

export function generateStaticParams() {
  return [{ creator: DEFAULT_DESK }, { creator: DEFAULT_IMPOSTOR }];
}

export default function CanaryStatus({ params }: { params: { creator: string } }) {
  return <CanaryStatusLive creator={params.creator as Hex} />;
}
