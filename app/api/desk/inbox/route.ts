import { NextRequest } from 'next/server';
import { CHAIN_READ_FAILED } from '@/lib/constants';
import { AppError } from '@/lib/errors';
import { isEntityKey } from '@/lib/hex';
import { jsonFail, jsonOk } from '@/lib/http';
import { loadInboxLive } from '@/lib/live-read';
import { protectRead } from '@/lib/protect';
import type { Hex } from 'viem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const blocked = await protectRead(req, 'desk');
    if (blocked) return blocked;
    const deskKey = req.nextUrl.searchParams.get('deskKey') ?? '';
    if (!isEntityKey(deskKey)) throw new AppError('bad_request');
    const cursor = req.nextUrl.searchParams.get('cursor');
    const atRaw = req.nextUrl.searchParams.get('atBlock');
    const atBlock = atRaw && /^\d+$/.test(atRaw) ? BigInt(atRaw) : undefined;
    const liveOpts: { cursor?: string; atBlock?: bigint } = {};
    if (cursor) liveOpts.cursor = cursor;
    if (atBlock !== undefined) liveOpts.atBlock = atBlock;
    const live = await loadInboxLive(deskKey as Hex, liveOpts);
    return jsonOk(live);
  } catch (err: unknown) {
    if (err instanceof AppError) return jsonFail(err);
    return jsonFail(new AppError('try_later', CHAIN_READ_FAILED));
  }
}
