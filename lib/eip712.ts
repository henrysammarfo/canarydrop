import type { Hex } from 'viem';
import { hashTypedData, recoverTypedDataAddress, verifyTypedData } from 'viem';
import { TIRAMISU_CHAIN_ID } from './chain';
import { isAddress } from './hex';

/** EIP-712 typed canary statement. Verifiable offline with the desk wallet address. */
export const CANARY_TYPED_DOMAIN = {
  name: 'CanaryDrop',
  version: '7',
  chainId: TIRAMISU_CHAIN_ID,
} as const;

export const CANARY_TYPED_TYPES = {
  CanaryStatement: [
    { name: 'desk', type: 'address' },
    { name: 'statement', type: 'string' },
    { name: 'issuedAt', type: 'uint256' },
  ],
} as const;

export type CanaryStatement = {
  desk: Hex;
  statement: string;
  issuedAt: bigint;
};

export function canaryTypedData(input: CanaryStatement) {
  return {
    domain: CANARY_TYPED_DOMAIN,
    types: CANARY_TYPED_TYPES,
    primaryType: 'CanaryStatement' as const,
    message: {
      desk: input.desk,
      statement: input.statement,
      issuedAt: input.issuedAt,
    },
  };
}

export function hashCanaryStatement(input: CanaryStatement): Hex {
  return hashTypedData(canaryTypedData(input));
}

export async function verifyCanarySignature(
  address: Hex,
  input: CanaryStatement,
  signature: Hex,
): Promise<boolean> {
  if (!isAddress(address)) return false;
  try {
    return await verifyTypedData({
      ...canaryTypedData(input),
      address,
      signature,
    });
  } catch {
    return false;
  }
}

export async function recoverCanarySigner(input: CanaryStatement, signature: Hex): Promise<Hex | null> {
  try {
    return await recoverTypedDataAddress({
      ...canaryTypedData(input),
      signature,
    });
  } catch {
    return null;
  }
}

export const DEFAULT_CANARY_STATEMENT = 'No warrants or gag orders received.';

export function issuedAtNow(now = Date.now()): bigint {
  return BigInt(Math.floor(now / 1000));
}
