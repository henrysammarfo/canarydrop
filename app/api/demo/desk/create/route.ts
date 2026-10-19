import { NextRequest } from 'next/server';
import { createDesk, pub } from '@/lib/arkiv';
import { b64ToBytes } from '@/lib/bytes';
import { deskAccount, deskWallet, requireDeskEthKey } from '@/lib/demo-wallet';
import { AppError } from '@/lib/errors';
import { assertDeskCreateRoom, assertMinBalance } from '@/lib/guard';
import { jsonFail, jsonOk } from '@/lib/http';
import { isDryRun, protectWrite, readJson } from '@/lib/protect';
import { withBackoff } from '@/lib/retry';
import { withWalletLock } from '@/lib/wallet-lock';
import { createDeskBody } from '@/lib/schemas';
import { DEFAULT_DESK } from '@/lib/constants';
import { asAddress } from '@/lib/hex';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const blocked = await protectWrite(req, 'desk');
    if (blocked) return blocked;
    const dryRun = isDryRun(req);
    if (!dryRun) requireDeskEthKey();
    const raw = await readJson(req);
    if (raw === null) throw new AppError('bad_request');
    const parsed = createDeskBody.safeParse(raw);
    if (!parsed.success) throw new AppError('bad_request');
    const { name, deskPubRawB64, domain } = parsed.data;
    const pubRaw = b64ToBytes(deskPubRawB64);
    if (pubRaw.byteLength !== 65) throw new AppError('bad_request', 'That desk public key is the wrong size.');
    if (domain && !/^[a-z0-9.-]{1,80}$/.test(domain.trim().toLowerCase())) {
      throw new AppError('bad_request', 'That domain is not valid.');
    }
    if (dryRun) {
      const deskOwner = asAddress(process.env.NEXT_PUBLIC_DESK_ADDRESS ?? '', DEFAULT_DESK);
      const predicted = await pub().predictEntityKeys({ owner: deskOwner, count: 2 });
      return jsonOk({ ok: true, dryRun: true, predicted: predicted.map((x) => x.key) });
    }
    const account = deskAccount();
    await assertMinBalance(pub(), account.address);
    await assertDeskCreateRoom(account.address);
    const { DEFAULT_CANARY_STATEMENT, canaryTypedData, issuedAtNow } = await import('@/lib/eip712');
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
        return createDesk(deskWallet(), account.address, name, pubRaw, { nonce }, {
          domain: domain?.trim().toLowerCase(),
          signed,
        });
      }),
    );
    return jsonOk({ ok: true, txHash: out.txHash, created: out.createdEntities });
  } catch (err: unknown) {
    return jsonFail(err);
  }
}
