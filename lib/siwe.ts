import type { Hex } from 'viem';
import { verifyMessage } from 'viem';
import { TIRAMISU_CHAIN_ID } from './chain';
import { isAddress } from './hex';

/** EIP-4361 Sign In With Ethereum. https://eips.ethereum.org/EIPS/eip-4361 */
export type SiweFields = {
  domain: string;
  address: Hex;
  statement?: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
};

const SIWE_HEAD = /^(?<domain>[^\n]+) wants you to sign in with your Ethereum account:\n(?<address>0x[0-9a-fA-F]{40})\n/;

export function siweNonce(bytes = 16): string {
  const out = new Uint8Array(bytes);
  crypto.getRandomValues(out);
  return Array.from(out, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function buildSiweMessage(fields: SiweFields): string {
  const statement = fields.statement?.trim()
    ? `\n${fields.statement.trim()}\n`
    : '\n';
  return [
    `${fields.domain} wants you to sign in with your Ethereum account:`,
    fields.address,
    statement,
    `URI: ${fields.uri}`,
    `Version: ${fields.version}`,
    `Chain ID: ${fields.chainId}`,
    `Nonce: ${fields.nonce}`,
    `Issued At: ${fields.issuedAt}`,
  ].join('\n');
}

export function parseSiweMessage(message: string): SiweFields | null {
  const head = message.match(SIWE_HEAD);
  if (!head?.groups) return null;
  const domain = head.groups.domain?.trim();
  const address = head.groups.address;
  if (!domain || !address || !isAddress(address)) return null;
  const rest = message.slice(head[0].length);
  const uri = rest.match(/^URI: (.+)$/m)?.[1]?.trim();
  const version = rest.match(/^Version: (.+)$/m)?.[1]?.trim();
  const chainRaw = rest.match(/^Chain ID: (.+)$/m)?.[1]?.trim();
  const nonce = rest.match(/^Nonce: (.+)$/m)?.[1]?.trim();
  const issuedAt = rest.match(/^Issued At: (.+)$/m)?.[1]?.trim();
  if (!uri || !version || !chainRaw || !nonce || !issuedAt) return null;
  const chainId = Number(chainRaw);
  if (!Number.isInteger(chainId) || chainId <= 0) return null;
  const statementBlock = rest.split('\nURI:')[0]?.trim();
  const fields: SiweFields = {
    domain,
    address,
    uri,
    version,
    chainId,
    nonce,
    issuedAt,
  };
  if (statementBlock) fields.statement = statementBlock;
  return fields;
}

export function newsroomSiweFields(opts: {
  domain: string;
  address: Hex;
  uri: string;
  nonce?: string;
  issuedAt?: string;
}): SiweFields {
  return {
    domain: opts.domain,
    address: opts.address,
    statement: 'Sign in to the CanaryDrop newsroom desk.',
    uri: opts.uri,
    version: '1',
    chainId: TIRAMISU_CHAIN_ID,
    nonce: opts.nonce ?? siweNonce(),
    issuedAt: opts.issuedAt ?? new Date().toISOString(),
  };
}

export async function verifySiwe(message: string, signature: Hex): Promise<{ ok: true; address: Hex } | { ok: false }> {
  const fields = parseSiweMessage(message);
  if (!fields) return { ok: false };
  try {
    const ok = await verifyMessage({
      address: fields.address,
      message,
      signature,
    });
    return ok ? { ok: true, address: fields.address } : { ok: false };
  } catch {
    return { ok: false };
  }
}

export function siweDomainAllowed(domain: string, host: string): boolean {
  return domain.toLowerCase() === host.toLowerCase();
}
