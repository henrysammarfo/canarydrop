import { NextRequest, NextResponse } from 'next/server';
import type { Hex } from 'viem';
import { postTip } from '@/lib/relay';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20; // per-IP per minute, in-memory
const ipBuckets = new Map<string, { resetAt: number; count: number }>();

function rateLimit(ip: string | null) {
  if (!ip) return false;
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
      return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    }
    const wire = Uint8Array.from(Buffer.from(wireB64, 'base64'));
    const out = await postTip(deskKey, wire, lifetime);
    return NextResponse.json({ ok: true, ...out });
  } catch (e: any) {
    // Do not leak secrets
    return NextResponse.json({ error: 'server_error', message: String(e?.message ?? e) }, { status: 500 });
  }
}

