import { NextRequest, NextResponse } from 'next/server';
import { createWalletClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { reply } from '@/lib/arkiv';

export async function POST(req: NextRequest) {
  try {
    const pk = process.env.DESK_PRIVATE_KEY as Hex | undefined;
    if (!pk) return NextResponse.json({ error: 'demo_disabled' }, { status: 403 });
    const body = await req.json();
    const { tipKey, wireB64 } = body as { tipKey: Hex; wireB64: string };
    if (!tipKey || !wireB64) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
    const account = privateKeyToAccount(pk);
    const w = createWalletClient({ chain: tiramisu, transport: http(), account });
    const out = await reply(w, tipKey, Uint8Array.from(Buffer.from(wireB64, 'base64')));
    return NextResponse.json({ ok: true, txHash: out.txHash });
  } catch (e: any) {
    return NextResponse.json({ error: 'server_error', message: String(e?.message ?? e) }, { status: 500 });
  }
}

