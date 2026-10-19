import { NextRequest } from 'next/server';
import { bytesToB64 } from '@/lib/bytes';
import { deriveDemoDeskJwk, demoPubRaw } from '@/lib/demo-key';
import { requireDeskEthKey } from '@/lib/demo-wallet';
import { jsonFail, jsonOk } from '@/lib/http';
import { protectRead } from '@/lib/protect';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const blocked = protectRead(req, 'desk');
    if (blocked) return blocked;
    const jwk = deriveDemoDeskJwk(requireDeskEthKey());
    return jsonOk({
      ok: true,
      jwk,
      pubB64: bytesToB64(demoPubRaw(jwk)),
      note: 'Shared testnet demo key so a fresh browser can open demo tips. Not a newsroom key.',
    });
  } catch (err: unknown) {
    return jsonFail(err);
  }
}
