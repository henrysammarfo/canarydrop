import { NextRequest } from 'next/server';
import type { Hex } from 'viem';
import { reply } from '@/lib/arkiv';
import { b64ToBytes } from '@/lib/bytes';
import { deskQueue, withBackoff } from '@/lib/retry';
import { deskAccount, deskWallet, requireDeskEthKey } from '@/lib/demo-wallet';
import { AppError } from '@/lib/errors';
import { assertMinBalance, assertDeskSpendRoom } from '@/lib/guard';
import { jsonFail, jsonOk } from '@/lib/http';
import { assertWireB64, throwIfOversizedWire } from '@/lib/limits';
import { isDryRun, protectWrite, readJson } from '@/lib/protect';
import { pub } from '@/lib/arkiv';
import { replyBody } from '@/lib/schemas';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const blocked = protectWrite(req, 'desk');
    if (blocked) return blocked;
    const dryRun = isDryRun(req);
    if (!dryRun) requireDeskEthKey();
    const raw = await readJson(req);
    if (raw === null) throw new AppError('bad_request');
    throwIfOversizedWire(raw);
    const parsed = replyBody.safeParse(raw);
    if (!parsed.success) throw new AppError('bad_request');
    const { tipKey, wireB64 } = parsed.data;
    assertWireB64(wireB64);
    if (dryRun) return jsonOk({ ok: true, dryRun: true, wouldReplyTo: tipKey });
    const account = deskAccount();
    await assertMinBalance(pub(), account.address);
    await assertDeskSpendRoom(account.address);
    const out = await deskQueue.enqueue(() =>
      withBackoff(async () => {
        const nonce = await pub().getTransactionCount({ address: account.address, blockTag: 'pending' });
        return reply(deskWallet(), tipKey as Hex, b64ToBytes(wireB64), undefined, { nonce });
      }),
    );
    return jsonOk({ ok: true, txHash: out.txHash });
  } catch (err: unknown) {
    return jsonFail(err);
  }
}
