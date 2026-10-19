import { NextRequest } from 'next/server';
import type { Hex } from 'viem';
import { pub, renew } from '@/lib/arkiv';
import { deskAccount, deskWallet, requireDeskEthKey } from '@/lib/demo-wallet';
import { AppError } from '@/lib/errors';
import { assertMinBalance } from '@/lib/guard';
import { jsonFail, jsonOk } from '@/lib/http';
import { isDryRun, protectWrite, readJson } from '@/lib/protect';
import { deskQueue, withBackoff } from '@/lib/retry';
import { renewBody } from '@/lib/schemas';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const blocked = protectWrite(req, 'desk');
    if (blocked) return blocked;
    const dryRun = isDryRun(req);
    if (!dryRun) requireDeskEthKey();
    const raw = await readJson(req);
    if (raw === null) throw new AppError('bad_request');
    const parsed = renewBody.safeParse(raw);
    if (!parsed.success) throw new AppError('bad_request');
    const { deskKey, canaryKey } = parsed.data;
    if (dryRun) return jsonOk({ ok: true, dryRun: true, wouldRenew: [deskKey, canaryKey] });
    const account = deskAccount();
    await assertMinBalance(pub(), account.address);
    const out = await deskQueue.enqueue(() =>
      withBackoff(async () => {
        const nonce = await pub().getTransactionCount({ address: account.address, blockTag: 'pending' });
        return renew(deskWallet(), deskKey as Hex, canaryKey as Hex, { nonce });
      }),
    );
    return jsonOk({ ok: true, txHash: out.txHash });
  } catch (err: unknown) {
    return jsonFail(err);
  }
}
