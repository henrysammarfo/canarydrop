import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { reply } from '@/lib/arkiv';
import { z } from 'zod';

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dryRun = url.searchParams.get('dryRun') === '1' || req.headers.get('x-dry-run') === '1';
    const origin = req.headers.get('origin') || '';
    const host = req.nextUrl.host;
    if (origin && !origin.includes(host)) return NextResponse.json({ error: 'bad_origin', message: 'Please use the site to operate the demo desk.' }, { status: 400 });
    const pk = process.env.DESK_PRIVATE_KEY as Hex | undefined;
    if (!pk && !dryRun) return NextResponse.json({ error: 'demo_disabled' }, { status: 403 });
    const schema = z.object({
      tipKey: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
      wireB64: z.string().max(16 * 1024),
    }).strict();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'bad_request', message: parsed.error.issues.map(i=>i.message).join('; ') }, { status: 400 });
    const { tipKey, wireB64 } = parsed.data;
    if (!tipKey || !wireB64) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true, wouldReplyTo: tipKey });
    } else {
      const account = privateKeyToAccount(pk as Hex);
      const w = createWalletClient({ chain: tiramisu, transport: http(), account });
      const out = await reply(w, tipKey, Uint8Array.from(Buffer.from(wireB64, 'base64')));
      return NextResponse.json({ ok: true, txHash: out.txHash });
    }
  } catch (e: any) {
    return NextResponse.json({ error: 'server_error', message: String(e?.message ?? e) }, { status: 500 });
  }
}

