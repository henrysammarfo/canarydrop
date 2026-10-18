import { NextRequest, NextResponse } from 'next/server';
import type { Hex } from 'viem';
import { postTip } from '@/lib/relay';
import { createPublicClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { http } from 'viem';
import { key } from '@arkiv-network/sdk/attr';
import { PROJECT, LIFETIMES } from '@/lib/arkiv';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20; // per-IP per minute, in-memory
const ipBuckets = new Map<string, { resetAt: number; count: number }>();

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
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.ip ??
      req.headers.get('cf-connecting-ip') ??
      null;
    if (!rateLimit(ip)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

    const body = await req.json();
    const { deskKey, wireB64, lifetime } = body as {
      deskKey: Hex;
      wireB64: string;
      lifetime: '1h' | '24h' | '72h' | '7d';
    };
    if (!deskKey || !wireB64 || !lifetime) {
      return NextResponse.json(
        {
          error: 'missing_fields',
          message:
            'Please include deskKey, wireB64 (base64 ciphertext), and lifetime (one of 1h, 24h, 72h, 7d). Nothing was sent.',
        },
        { status: 400 },
      );
    }
    const wire = Uint8Array.from(Buffer.from(wireB64, 'base64'));
    if (dryRun) {
      const pub = createPublicClient({ chain: tiramisu, transport: http() });
      const [pred] = await pub.predictEntityKeys({ owner: (process.env.NEXT_PUBLIC_RELAY_ADDRESS || '0x') as Hex, count: 1 });
      // Construct the attributes we would write
      const attributes = { project: PROJECT, type: 'tip', desk: key(deskKey) } as any;
      return NextResponse.json({
        ok: true,
        dryRun: true,
        predictedTipKey: pred.key,
        attributes,
        expires: lifetime in LIFETIMES ? lifetime : 'unknown',
      });
    } else {
      const out = await postTip(deskKey, wire, lifetime);
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

