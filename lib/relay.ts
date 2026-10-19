import { createWalletClient, EntityMutationError } from '@arkiv-network/sdk';
import { key, str, u64 } from '@arkiv-network/sdk/attr';
import { tiramisu } from '@arkiv-network/sdk/chains';
import type { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { LIFETIMES, PROJECT, SEALED_OWNER, pub, requireLiveDesk, type Wallet } from './arkiv';
import type { Lifetime } from './constants';
import { utcDaySlot } from './day';
import { AppError } from './errors';
import { isPrivateKey } from './hex';
import { assertWireBytes } from './limits';
import { assertMinBalance, assertRelaySpendRoom } from './guard';
import { relayQueue, withBackoff } from './retry';
import { rpcHttp } from './rpc';

function requireRelayKey(): Hex {
  const raw = process.env.RELAY_PRIVATE_KEY ?? '';
  if (!isPrivateKey(raw)) throw new AppError('unfunded', 'The sponsor is not configured.');
  return raw as Hex;
}

export function relayAccount() {
  return privateKeyToAccount(requireRelayKey());
}

export function relayWallet(): Wallet {
  return createWalletClient({ chain: tiramisu, transport: rpcHttp(), account: relayAccount() });
}

/**
 * Create the tip and hand ownership to 0x…dEaD in one batch. Nobody can extend, patch, or delete
 * it afterwards, so the lifetime the source picked is the lifetime it gets.
 */
export async function postTip(deskKey: Hex, wire: Uint8Array, life: Lifetime) {
  return relayQueue.enqueue(() => postTipOnce(deskKey, wire, life));
}

async function postTipOnce(deskKey: Hex, wire: Uint8Array, life: Lifetime) {
  assertWireBytes(wire);
  if (wire[0] !== 1) throw new AppError('bad_request', 'That tip is not a valid sealed message.');
  await requireLiveDesk(deskKey);

  const account = relayAccount();
  const w = relayWallet();
  await assertMinBalance(pub(), account.address);
  await assertRelaySpendRoom(account.address);

  return withBackoff(async () => {
    const nonce = await pub().getTransactionCount({ address: account.address, blockTag: 'pending' });
    const [tip] = await pub().predictEntityKeys({ owner: account.address, count: 1 });
    try {
      const r = await w.executeBatch(
        {
          creates: [
            {
              salt: tip.salt,
              payload: wire,
              contentType: 'application/octet-stream',
              attributes: {
                project: str(PROJECT),
                type: str('tip'),
                desk: key(deskKey),
                slot: u64(utcDaySlot()),
              },
              expires: LIFETIMES[life],
              flags: { readonly: true },
            },
          ],
          ownershipChanges: [{ entityKey: tip.key, newOwner: SEALED_OWNER }],
        },
        { nonce },
      );
      const created = r.createdEntities[0];
      if (!created) throw new AppError('server_error');
      return { tipKey: created, txHash: r.txHash };
    } catch (err) {
      if (err instanceof EntityMutationError && err.txHash) {
        throw new AppError(
          'server_error',
          'The network accepted a write but the app could not confirm it. Please check the explorer before sending again.',
        );
      }
      throw err;
    }
  });
}
