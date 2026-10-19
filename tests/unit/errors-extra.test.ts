import { describe, expect, it } from 'vitest';
import { EntityMutationError } from '@arkiv-network/sdk';
import type { Hex } from 'viem';
import { AppError, errorBody, mapUnknownError, publicMessage, receiptTimeoutHash } from '@/lib/errors';

describe('error mapping extra cases', () => {
  it('maps fetch failed and econnreset to try_later', () => {
    expect(mapUnknownError(new Error('fetch failed')).code).toBe('try_later');
    expect(mapUnknownError(new Error('ECONNRESET')).code).toBe('try_later');
    expect(mapUnknownError(new Error('timeout of 20000ms exceeded')).code).toBe('try_later');
  });

  it('maps exceeds the balance', () => {
    expect(mapUnknownError(new Error('tx exceeds the balance of the account')).code).toBe('unfunded');
  });

  it('keeps a custom AppError message', () => {
    const err = new AppError('bad_request', 'That desk public key is the wrong size.');
    expect(errorBody(err).message).toBe('That desk public key is the wrong size.');
    expect(errorBody(err).status).toBe(400);
  });

  it('public messages exist for every code we ship', () => {
    const codes = [
      'bad_origin',
      'bad_csrf',
      'rate_limited',
      'try_later',
      'bad_request',
      'too_large',
      'no_desk',
      'demo_disabled',
      'spend_cap',
      'unfunded',
      'server_error',
    ] as const;
    for (const code of codes) {
      expect(publicMessage(code).length).toBeGreaterThan(8);
      expect(publicMessage(code)).not.toMatch(/Ident32|stack|private key/i);
    }
  });

  it('EntityMutationError with a hash becomes server_error without the hash', () => {
    const err = new EntityMutationError('mismatch', { txHash: `0x${'ab'.repeat(32)}` });
    const body = errorBody(err);
    expect(body.error).toBe('server_error');
    expect(body.message).toMatch(/explorer/i);
    expect(body.message).not.toMatch(/ababab/);
  });

  it('reads a receipt timeout hash and ignores a revert with a hash', () => {
    const hash = `0x${'cd'.repeat(32)}` as Hex;
    const timeout = new EntityMutationError('Timed out while waiting for transaction receipt', { txHash: hash });
    expect(receiptTimeoutHash(timeout)).toBe(hash);
    const revert = new EntityMutationError('Transaction reverted. Reason: EntityNotFound', { txHash: hash });
    expect(receiptTimeoutHash(revert)).toBeUndefined();
    expect(receiptTimeoutHash(new Error('timeout of 20000ms exceeded'))).toBeUndefined();
  });
});
