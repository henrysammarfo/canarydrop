import { NextRequest } from 'next/server';
import { CHAIN_READ_FAILED, DEFAULT_DESK } from '@/lib/constants';
import { AppError } from '@/lib/errors';
import { isAddress } from '@/lib/hex';
import { jsonFail, jsonOk } from '@/lib/http';
import { loadDeskLive } from '@/lib/live-read';
import { protectRead } from '@/lib/protect';
import type { Hex } from 'viem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const blocked = await protectRead(req, 'desk');
    if (blocked) return blocked;
    const raw = req.nextUrl.searchParams.get('creator') ?? '';
    if (raw && !isAddress(raw)) throw new AppError('bad_request');
    const creator = (raw && isAddress(raw) ? raw : DEFAULT_DESK) as Hex;
    const fresh = req.nextUrl.searchParams.get('fresh') === '1';
    const live = await loadDeskLive(creator, { fresh });
    return jsonOk(live);
  } catch (err: unknown) {
    if (err instanceof AppError) return jsonFail(err);
    return jsonOk(
      {
        ok: true,
        creator: DEFAULT_DESK,
        deskKey: null,
        canaryKey: null,
        alive: false,
        name: 'CanaryDrop desk',
        deskPubB64: null,
        expiresAt: null,
        createdAt: null,
        currentBlock: null,
        blockDuration: 2,
        fetchedAt: Date.now(),
        stale: false,
        staleAgeMs: 0,
        note: CHAIN_READ_FAILED,
      },
    );
  }
}
