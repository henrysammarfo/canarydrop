import { NextRequest, NextResponse } from 'next/server';
import type { Hex } from 'viem';
import { postTip } from '@/lib/relay';
import { createPublicClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { http } from 'viem';
import { key } from '@arkiv-network/sdk/attr';
import { PROJECT, LIFETIMES } from '@/lib/arkiv';
import { z } from 'zod';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20; // per-IP per minute, in-memory
const ipBuckets = new Map<string, { resetAt: number; count: number }>();
let globalWrites = { count: 0, resetAt: Date.now() + 24 * 3600 * 1000 };
const GLOBAL_DAILY_MAX = 500; // generous cap

function rateLimit(ip: string | null) {
  if (!ip) return true;
  const now = Date.now();
  const b = ipBuckets.get(ip);
  if (!b || now >= b.resetAt) {
    ipBuckets.set(ip, { resetAt: now + RATE_LIMIT_WINDOW_MS, count: 1 });
    return true;
  }
  if (b.count >= RATE_LIMIT_MAX) return false;
  b.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dryRun = url.searchParams.get('dryRun') === '1' || req.headers.get('x-dry-run') === '1';
    const origin = req.headers.get('origin') || '';
    const referer = req.headers.get('referer') || '';
    const host = req.nextUrl.host;
    if ((origin && !origin.includes(host)) || (referer && !referer.includes(host))) {
      return NextResponse.json({ error: 'bad_origin', message: 'Please use the site to submit tips.' }, { status: 400 });
    }
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.ip ??
      req.headers.get('cf-connecting-ip') ??
      null;
    if (!rateLimit(ip)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    const now = Date.now();
    if (now > globalWrites.resetAt) { globalWrites = { count: 0, resetAt: now + 24 * 3600 * 1000 }; }
    if (!dryRun && globalWrites.count >= GLOBAL_DAILY_MAX) {
      return NextResponse.json({ error: 'try_later', message: 'We received many tips today. Please try again tomorrow.' }, { status: 429 });
    }

    const schema = z.object({
      deskKey: z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'deskKey must be 0x + 64 hex'),
      wireB64: z.string().max(16 * 1024 * 4 / 3 + 200, 'ciphertext is too large'), // rough cap
      lifetime: z.enum(['1h','24h','72h','7d']),
    }).strict();
    const body = schema.safeParse(await req.json());
    if (!body.success) return NextResponse.json({ error: 'bad_request', message: body.error.issues.map(i=>i.message).join('; ') }, { status: 400 });
    const { deskKey, wireB64, lifetime } = body.data;
    const wire = Uint8Array.from(Buffer.from(wireB64, 'base64'));
    if (!dryRun) globalWrites.count++;
    if (dryRun) {
      const pub = createPublicClient({ chain: tiramisu, transport: http() });
      const [pred] = await pub.predictEntityKeys({ owner: (process.env.NEXT_PUBLIC_RELAY_ADDRESS || '0x') as Hex, count: 1 });
      // Construct the attributes we would write
      const attributes = { project: PROJECT, type: 'tip', desk: key(deskKey as any) } as any;
      return NextResponse.json({
        ok: true,
        dryRun: true,
        predictedTipKey: pred.key,
        attributes,
        expires: lifetime in LIFETIMES ? lifetime : 'unknown',
      });
    } else {
      const out = await postTip(deskKey as any, wire, lifetime);
      return NextResponse.json({ ok: true, ...out });
    }
  } catch (e: any) {
    // Do not leak secrets
    const msg = String(e?.message ?? e);
    const friendly =
      /insufficient funds|fund/.test(msg.toLowerCase())
        ? "We couldn't send your tip right now because the network sponsor wallet is out of test tokens. Please try again later. Nothing was sent."
        : msg;
    return NextResponse.json({ error: 'server_error', message: friendly }, { status: 500 });
  }
}

