import type { Hex } from 'viem';
import { attrStr, attrU64 } from './attr';
import { DEFAULT_CANARY_STATEMENT, canaryTypedData, type CanaryStatement } from './eip712';
import { isAddress } from './hex';

export type SignedCanary = CanaryStatement & { signature: Hex };

export type CanarySigFields = {
  statement: string;
  issuedAt: string | null;
  signature: Hex | null;
};

export function canarySignPayload(input: CanaryStatement) {
  const typed = canaryTypedData(input);
  return {
    domain: {
      name: typed.domain.name,
      version: typed.domain.version,
      chainId: Number(typed.domain.chainId),
    },
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
      ],
      CanaryStatement: typed.types.CanaryStatement,
    },
    primaryType: typed.primaryType,
    message: {
      desk: typed.message.desk,
      statement: typed.message.statement,
      issuedAt: typed.message.issuedAt.toString(),
    },
  };
}

export function parseCanarySigFields(input: {
  attributes?: Parameters<typeof attrStr>[0];
  payload?: Uint8Array | null;
}): CanarySigFields {
  const fromAttr = {
    statement: attrStr(input.attributes, 'statement') ?? DEFAULT_CANARY_STATEMENT,
    issuedAt: attrU64(input.attributes, 'issuedAt')?.toString() ?? null,
    signature: (attrStr(input.attributes, 'sig') as Hex | undefined) ?? null,
  };
  if (!input.payload) return fromAttr;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(input.payload));
    if (typeof parsed !== 'object' || parsed === null) return fromAttr;
    const rec = parsed as Record<string, unknown>;
    const statement = typeof rec.statement === 'string' && rec.statement.trim() ? rec.statement.trim() : fromAttr.statement;
    const issuedAt =
      typeof rec.issuedAt === 'string' || typeof rec.issuedAt === 'number'
        ? String(rec.issuedAt)
        : fromAttr.issuedAt;
    const signature =
      typeof rec.sig === 'string' && rec.sig.startsWith('0x') ? (rec.sig as Hex) : fromAttr.signature;
    return { statement, issuedAt, signature };
  } catch {
    return fromAttr;
  }
}

export function signedCanaryAttributes(input: SignedCanary) {
  return {
    statement: input.statement,
    issuedAt: input.issuedAt,
    signature: input.signature,
  };
}

export function signerIsDesk(signer: Hex | null | undefined, desk: Hex | null | undefined): boolean {
  if (!signer || !desk) return false;
  if (!isAddress(signer) || !isAddress(desk)) return false;
  return signer.toLowerCase() === desk.toLowerCase();
}
