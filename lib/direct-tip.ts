import { createWalletClient, EntityMutationError } from '@arkiv-network/sdk';
import { key, str, u64 } from '@arkiv-network/sdk/attr';
import { tiramisu } from '@arkiv-network/sdk/chains';
import type { Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { PROJECT, SEALED_OWNER, pub, requireLiveDesk, tipExpires, type Wallet } from './arkiv';
import type { Lifetime } from './constants';
import { MIN_WALLET_WEI } from './constants';
import { utcDaySlot } from './day';
import { AppError } from './errors';
import { isPrivateKey } from './hex';
import { assertWireBytes } from './limits';
import { rpcHttp } from './rpc';

export function newThrowawayKey(): Hex {
  return generatePrivateKey();
}

export function throwawayAccount(privateKey: Hex) {
  if (!isPrivateKey(privateKey)) throw new AppError('bad_request', 'That throwaway key is not valid.');
  return privateKeyToAccount(privateKey);
}

export function walletFromKey(privateKey: Hex): Wallet {
  return createWalletClient({
    chain: tiramisu,
    transport: rpcHttp(),
    account: throwawayAccount(privateKey),
  });
}

export async function throwawayBalance(address: Hex): Promise<bigint> {
  return pub().getBalance({ address });
}

export function hasGas(balance: bigint, floor = MIN_WALLET_WEI): boolean {
  return balance >= floor;
}

export async function predictDirectTip(owner: Hex): Promise<Hex> {
  const [tip] = await pub().predictEntityKeys({ owner, count: 1 });
  return tip.key;
}

/**
 * Source-paid sealed tip. A throwaway in-browser key creates the tip and hands
 * it to the burn address in the same batch. The sponsor path stays optional.
 */
export async function postDirectTip(opts: {
  privateKey: Hex;
  deskKey: Hex;
  wire: Uint8Array;
  life: Lifetime;
  dryRun?: boolean;
}): Promise<{ tipKey: Hex; txHash?: Hex; dryRun?: true; owner: Hex }> {
  assertWireBytes(opts.wire);
  if (opts.wire[0] !== 1) throw new AppError('bad_request', 'That tip is not a valid sealed message.');
  await requireLiveDesk(opts.deskKey);

  const account = throwawayAccount(opts.privateKey);
  if (opts.dryRun) {
    const tipKey = await predictDirectTip(account.address);
    return { tipKey, dryRun: true, owner: account.address };
  }

  const balance = await throwawayBalance(account.address);
  if (!hasGas(balance)) {
    throw new AppError(
      'unfunded',
      'This throwaway key has no testnet funds. Use the sponsor path, or fund the address and try again.',
    );
  }

  const w = walletFromKey(opts.privateKey);
  const nonce = await pub().getTransactionCount({ address: account.address, blockTag: 'pending' });
  const [tip] = await pub().predictEntityKeys({ owner: account.address, count: 1 });
  try {
    const r = await w.executeBatch(
      {
        creates: [
          {
            salt: tip.salt,
            payload: opts.wire,
            contentType: 'application/octet-stream',
            attributes: {
              project: str(PROJECT),
              type: str('tip'),
              desk: key(opts.deskKey),
              slot: u64(utcDaySlot()),
              path: str('direct'),
            },
            expires: tipExpires(opts.life),
            flags: { readonly: true },
          },
        ],
        ownershipChanges: [{ entityKey: tip.key, newOwner: SEALED_OWNER }],
      },
      { nonce },
    );
    const created = r.createdEntities[0];
    if (!created) throw new AppError('server_error');
    return { tipKey: created, txHash: r.txHash, owner: account.address };
  } catch (err) {
    if (err instanceof EntityMutationError && err.txHash) {
      throw new AppError(
        'server_error',
        'The network accepted a write but the app could not confirm it. Please check the explorer before sending again.',
      );
    }
    throw err;
  }
}

export function directTipAttributes(deskKey: Hex) {
  return {
    project: str(PROJECT),
    type: str('tip'),
    desk: key(deskKey),
    slot: u64(utcDaySlot()),
    path: str('direct'),
  };
}
