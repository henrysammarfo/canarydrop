import { NextRequest } from 'next/server';
import { CHAIN_READ_FAILED } from '@/lib/constants';
import { AppError } from '@/lib/errors';
import { jsonFail, jsonOk } from '@/lib/http';
import { loadExplorerLive, type ExplorerFilter } from '@/lib/live-read';
import { protectRead } from '@/lib/protect';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FILTERS = new Set<ExplorerFilter>(['all', 'tip', 'desk', 'canary', 'reply', 'sealed']);

export async function GET(req: NextRequest) {
  try {
    const blocked = await protectRead(req, 'desk');
    if (blocked) return blocked;
    const raw = (req.nextUrl.searchParams.get('filter') ?? 'all') as ExplorerFilter;
    if (!FILTERS.has(raw)) throw new AppError('bad_request');
    const cursor = req.nextUrl.searchParams.get('cursor');
    const atRaw = req.nextUrl.searchParams.get('atBlock');
    const atBlock = atRaw && /^\d+$/.test(atRaw) ? BigInt(atRaw) : undefined;
    const liveOpts: { cursor?: string; atBlock?: bigint } = {};
    if (cursor) liveOpts.cursor = cursor;
    if (atBlock !== undefined) liveOpts.atBlock = atBlock;
    const live = await loadExplorerLive(raw, liveOpts);
    return jsonOk(live);
  } catch (err: unknown) {
    if (err instanceof AppError) return jsonFail(err);
    return jsonOk({
      ok: true,
      items: [],
      cursor: null,
      atBlock: '0',
      hasMore: false,
      currentBlock: null,
      blockDuration: 2,
      canonicalDeskKey: null,
      fetchedAt: Date.now(),
      stale: false,
      staleAgeMs: 0,
      note: CHAIN_READ_FAILED,
    });
  }
}
