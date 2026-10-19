import { NextRequest } from 'next/server';
import type { Hex } from 'viem';
import { pub, renew } from '@/lib/arkiv';
import { extendableHoldKeys } from '@/lib/dead-drop';
import { deskAccount, deskWallet, requireDeskEthKey } from '@/lib/demo-wallet';
import { DEFAULT_CANARY_STATEMENT, canaryTypedData, issuedAtNow } from '@/lib/eip712';
import { AppError } from '@/lib/errors';
import { assertMinBalance } from '@/lib/guard';
import { jsonFail, jsonOk } from '@/lib/http';
import { isDryRun, protectWrite, readJson } from '@/lib/protect';
import { withBackoff } from '@/lib/retry';
import { withWalletLock } from '@/lib/wallet-lock';
import { renewBody } from '@/lib/schemas';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const blocked = await protectWrite(req, 'desk');
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
    const holdKeys = await extendableHoldKeys(deskKey as Hex, account.address);
    const issuedAt = issuedAtNow();
    const signed = {
      statement: DEFAULT_CANARY_STATEMENT,
      issuedAt,
      signature: await account.signTypedData(
        canaryTypedData({ desk: account.address, statement: DEFAULT_CANARY_STATEMENT, issuedAt }),
      ),
    };
    const out = await withWalletLock('desk', account.address, () =>
      withBackoff(async () => {
        const nonce = await pub().getTransactionCount({ address: account.address, blockTag: 'pending' });
        return renew(deskWallet(), deskKey as Hex, canaryKey as Hex, { nonce }, {
          holdKeys,
          signed,
          owner: account.address,
        });
      }),
    );
    return jsonOk({ ok: true, txHash: out.txHash });
  } catch (err: unknown) {
    return jsonFail(err);
  }
}
