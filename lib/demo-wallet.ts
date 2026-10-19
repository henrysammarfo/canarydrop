import { createWalletClient, jsonToPayload } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import type { Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { Wallet } from './arkiv';
import { pub } from './arkiv';
import { AppError } from './errors';
import { isPrivateKey } from './hex';
import { rpcHttp } from './rpc';

export function requireDeskEthKey(): Hex {
  const raw = process.env.DESK_PRIVATE_KEY ?? '';
  if (!isPrivateKey(raw)) throw new AppError('demo_disabled');
  return raw as Hex;
}

export function deskAccount() {
  return privateKeyToAccount(requireDeskEthKey());
}

export function deskWallet(): Wallet {
  return createWalletClient({ chain: tiramisu, transport: rpcHttp(), account: deskAccount() });
}

export { jsonToPayload, pub };
