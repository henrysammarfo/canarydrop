import { NextRequest } from 'next/server';
import type { Hex } from 'viem';
import { key, str } from '@arkiv-network/sdk/attr';
import { LIFETIMES, PROJECT, pub, relayAddress, requireLiveDesk } from '@/lib/arkiv';
import { b64ToBytes } from '@/lib/bytes';
import { AppError } from '@/lib/errors';
import { jsonFail, jsonOk } from '@/lib/http';
import { assertWireB64, throwIfOversizedWire } from '@/lib/limits';
import { isDryRun, protectWrite, readJson } from '@/lib/protect';
import { postTip } from '@/lib/relay';
import { tipBody } from '@/lib/schemas';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const blocked = protectWrite(req, 'relay');
    if (blocked) return blocked;
    const dryRun = isDryRun(req);
    const raw = await readJson(req);
    if (raw === null) throw new AppError('bad_request');
    throwIfOversizedWire(raw);
    const parsed = tipBody.safeParse(raw);
    if (!parsed.success) throw new AppError('bad_request', parsed.error.issues.map((i) => i.message).join('; '));
    const { deskKey, wireB64, lifetime } = parsed.data;
    assertWireB64(wireB64);
    const wire = b64ToBytes(wireB64);
    if (!dryRun) {
      const out = await postTip(deskKey as Hex, wire, lifetime);
      return jsonOk({ ok: true, ...out });
    }
    await requireLiveDesk(deskKey as Hex);
    const relay = relayAddress();
    const [pred] = await pub().predictEntityKeys({ owner: relay, count: 1 });
    return jsonOk({
      ok: true,
      dryRun: true,
      predictedTipKey: pred.key,
      attributes: { project: str(PROJECT), type: str('tip'), desk: key(deskKey as Hex) },
      expires: lifetime in LIFETIMES ? lifetime : 'unknown',
    });
  } catch (err: unknown) {
    return jsonFail(err);
  }
}
