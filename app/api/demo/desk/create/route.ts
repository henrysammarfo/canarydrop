import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createDesk } from '@/lib/arkiv';
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
    const schema = z.object({ name: z.string().min(1).max(60), deskPubRawB64: z.string().max(2048) }).strict();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'bad_request', message: parsed.error.issues.map(i=>i.message).join('; ') }, { status: 400 });
    const { name, deskPubRawB64 } = parsed.data;
    if (!name || !deskPubRawB64) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    if (dryRun) {
      const pubc = createPublicClient({ chain: tiramisu, transport: http() });
      const deskRaw = process.env.NEXT_PUBLIC_DESK_ADDRESS || '';
      const deskOwner = (/^0x[0-9a-fA-F]{40}$/.test(deskRaw)
        ? deskRaw
        : '0x1da3c22c079c264536D831F6F1fCe638aB0b20B0') as Hex;
      const predicted = await pubc.predictEntityKeys({ owner: deskOwner, count: 2 });
      return NextResponse.json({ ok: true, dryRun: true, predicted: predicted.map((x) => x.key) });
    } else {
      const account = privateKeyToAccount(pk as Hex);
      const w = createWalletClient({ chain: tiramisu, transport: http(), account });
      const out = await createDesk(w, account.address, name, Uint8Array.from(Buffer.from(deskPubRawB64, 'base64')));
      return NextResponse.json({ ok: true, txHash: out.txHash, created: out.createdEntities });
    }
  } catch (e: any) {
    return NextResponse.json({ error: 'server_error', message: String(e?.message ?? e) }, { status: 500 });
  }
}

