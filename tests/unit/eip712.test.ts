import { describe, expect, it } from 'vitest';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import {
  CANARY_TYPED_DOMAIN,
  canaryTypedData,
  DEFAULT_CANARY_STATEMENT,
  hashCanaryStatement,
  issuedAtNow,
  recoverCanarySigner,
  verifyCanarySignature,
} from '@/lib/eip712';
import { TIRAMISU_CHAIN_ID } from '@/lib/chain';

describe('EIP-712 canary statements', () => {
  it('uses Tiramisu in the domain', () => {
    expect(CANARY_TYPED_DOMAIN.chainId).toBe(TIRAMISU_CHAIN_ID);
    expect(CANARY_TYPED_DOMAIN.version).toBe('7');
  });

  it('hashes the same input the same way', () => {
    const input = { desk: '0x1da3c22c079c264536D831F6F1fCe638aB0b20B0' as const, statement: 'No warrants', issuedAt: 1n };
    expect(hashCanaryStatement(input)).toBe(hashCanaryStatement(input));
    expect(hashCanaryStatement({ ...input, statement: 'other' })).not.toBe(hashCanaryStatement(input));
  });

  it('round trips a signature from a throwaway account', async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const input = { desk: account.address, statement: DEFAULT_CANARY_STATEMENT, issuedAt: 1_700_000_000n };
    const signature = await account.signTypedData(canaryTypedData(input));
    expect(await verifyCanarySignature(account.address, input, signature)).toBe(true);
    expect(await recoverCanarySigner(input, signature)).toBe(account.address);
  });

  it('rejects a statement that was changed', async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const input = { desk: account.address, statement: 'Alive', issuedAt: 10n };
    const signature = await account.signTypedData(canaryTypedData(input));
    expect(await verifyCanarySignature(account.address, { ...input, statement: 'Gone' }, signature)).toBe(false);
  });

  it('issuedAtNow is unix seconds', () => {
    const n = issuedAtNow(1_700_000_500);
    expect(n).toBe(1_700_000n);
  });
});
