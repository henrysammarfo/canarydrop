import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { renew } from '@/lib/arkiv';

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dryRun = url.searchParams.get('dryRun') === '1' || req.headers.get('x-dry-run') === '1';
    const pk = process.env.DESK_PRIVATE_KEY as Hex | undefined;
    if (!pk && !dryRun) return NextResponse.json({ error: 'demo_disabled' }, { status: 403 });
    const body = await req.json();
    const { deskKey, canaryKey } = body as { deskKey: Hex; canaryKey: Hex };
    if (!deskKey || !canaryKey) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    const account = privateKeyToAccount((pk || '0x') as Hex);
    const w = createWalletClient({ chain: tiramisu, transport: http(), account });
    if (dryRun) {
      return NextResponse.json({ ok: true, dryRun: true, wouldRenew: [deskKey, canaryKey] });
    } else {
      const out = await renew(w, deskKey, canaryKey);
      return NextResponse.json({ ok: true, txHash: out.txHash });
    }
  } catch (e: any) {
    return NextResponse.json({ error: 'server_error', message: String(e?.message ?? e) }, { status: 500 });
  }
}

