import { NextRequest } from 'next/server';
import type { Hex } from 'viem';
import { pub } from '@/lib/arkiv';
import { b64ToBytes } from '@/lib/bytes';
import { writeDeadDrop } from '@/lib/dead-drop';
import { isCanonicalDemoDeskKey, resolveCanonicalDemoDeskKey } from '@/lib/demo-desk';
import { deskAccount, deskWallet, requireDeskEthKey } from '@/lib/demo-wallet';
import { AppError } from '@/lib/errors';
import { assertMinBalance } from '@/lib/guard';
import { jsonFail, jsonOk } from '@/lib/http';
import { isDryRun, protectWrite, readJson } from '@/lib/protect';
import { withBackoff } from '@/lib/retry';
import { dropBody } from '@/lib/schemas';
import { withWalletLock } from '@/lib/wallet-lock';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const blocked = await protectWrite(req, 'desk');
    if (blocked) return blocked;
    const dryRun = isDryRun(req);
    if (!dryRun) requireDeskEthKey();
    const raw = await readJson(req);
    if (raw === null) throw new AppError('bad_request');
    const parsed = dropBody.safeParse(raw);
    if (!parsed.success) throw new AppError('bad_request');
    const { deskKey, dropPayloadB64, releasePayloadB64 } = parsed.data;
    const canonical = await resolveCanonicalDemoDeskKey();
    if (!isCanonicalDemoDeskKey(deskKey as Hex, canonical)) throw new AppError('no_desk');
    if (dryRun) return jsonOk({ ok: true, dryRun: true, wouldSeal: deskKey });
    const account = deskAccount();
    await assertMinBalance(pub(), account.address);
    const out = await withWalletLock('desk', account.address, () =>
      withBackoff(async () => {
        const nonce = await pub().getTransactionCount({ address: account.address, blockTag: 'pending' });
        return writeDeadDrop(
          deskWallet(),
          account.address,
          deskKey as Hex,
          b64ToBytes(dropPayloadB64),
          b64ToBytes(releasePayloadB64),
          { nonce },
        );
      }),
    );
    const created = Array.isArray(out.createdEntities) ? out.createdEntities : [];
    return jsonOk({
      ok: true,
      txHash: out.txHash,
      dropKey: created[0],
      releaseKey: created[1],
      holdKey: created[2],
    });
  } catch (err: unknown) {
    return jsonFail(err);
  }
}
