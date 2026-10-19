import { describe, expect, it } from 'vitest';
import type { Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { TIRAMISU_CHAIN_ID } from '@/lib/chain';
import {
  buildSiweMessage,
  newsroomSiweFields,
  parseSiweMessage,
  siweDomainAllowed,
  siweNonce,
  verifySiwe,
} from '@/lib/siwe';

describe('EIP-4361 SIWE', () => {
  it('builds a message the parser accepts', () => {
    const fields = newsroomSiweFields({
      domain: 'canarydrop.vercel.app',
      address: '0x1da3c22c079c264536D831F6F1fCe638aB0b20B0',
      uri: 'https://canarydrop.vercel.app/desk',
      nonce: 'abcd1234',
      issuedAt: '2026-10-19T00:00:00.000Z',
    });
    expect(fields.chainId).toBe(TIRAMISU_CHAIN_ID);
    const message = buildSiweMessage(fields);
    const parsed = parseSiweMessage(message);
    expect(parsed?.address).toBe(fields.address);
    expect(parsed?.nonce).toBe('abcd1234');
    expect(parsed?.statement).toMatch(/newsroom desk/);
  });

  it('rejects a truncated message', () => {
    expect(parseSiweMessage('hello')).toBeNull();
    expect(parseSiweMessage('example.com wants you to sign in with your Ethereum account:\n0x1')).toBeNull();
  });

  it('verifies a wallet signature', async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const fields = newsroomSiweFields({
      domain: 'localhost',
      address: account.address,
      uri: 'http://localhost:3000/desk',
      nonce: 'deadbeef',
      issuedAt: '2026-10-19T12:00:00.000Z',
    });
    const message = buildSiweMessage(fields);
    const signature = (await account.signMessage({ message })) as Hex;
    const checked = await verifySiwe(message, signature);
    expect(checked).toEqual({ ok: true, address: account.address });
  });

  it('rejects a signature for another account', async () => {
    const a = privateKeyToAccount(generatePrivateKey());
    const b = privateKeyToAccount(generatePrivateKey());
    const fields = newsroomSiweFields({
      domain: 'localhost',
      address: a.address,
      uri: 'http://localhost:3000',
      nonce: 'aa',
      issuedAt: '2026-10-19T12:00:00.000Z',
    });
    const signature = (await b.signMessage({ message: buildSiweMessage(fields) })) as Hex;
    expect(await verifySiwe(buildSiweMessage(fields), signature)).toEqual({ ok: false });
  });

  it('makes a hex nonce and checks domain', () => {
    expect(siweNonce(8)).toMatch(/^[0-9a-f]{16}$/);
    expect(siweDomainAllowed('canarydrop.vercel.app', 'CanaryDrop.vercel.app')).toBe(true);
    expect(siweDomainAllowed('evil.com', 'canarydrop.vercel.app')).toBe(false);
  });
});
