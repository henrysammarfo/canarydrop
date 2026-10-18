import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { createDesk } from '@/lib/arkiv';

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dryRun = url.searchParams.get('dryRun') === '1' || req.headers.get('x-dry-run') === '1';
    const pk = process.env.DESK_PRIVATE_KEY as Hex | undefined;
    if (!pk && !dryRun) return NextResponse.json({ error: 'demo_disabled' }, { status: 403 });
    const body = await req.json();
    const { name, deskPubRawB64 } = body as { name: string; deskPubRawB64: string };
    if (!name || !deskPubRawB64) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    if (dryRun) {
      const pubc = createPublicClient({ chain: tiramisu, transport: http() });
      const predicted = await pubc.predictEntityKeys({ owner: (process.env.NEXT_PUBLIC_DESK_ADDRESS as Hex) || '0x0000000000000000000000000000000000000000', count: 2 });
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

