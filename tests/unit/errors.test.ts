import { describe, expect, it } from 'vitest';
import { EntityMutationError } from '@arkiv-network/sdk';
import { AppError, errorBody, mapUnknownError, publicMessage } from '@/lib/errors';

describe('error mapping', () => {
  it('keeps AppError as is', () => {
    const err = new AppError('no_desk');
    expect(mapUnknownError(err)).toBe(err);
    expect(err.status).toBe(400);
  });

  it('maps insufficient funds', () => {
    const mapped = mapUnknownError(new Error('insufficient funds for transfer'));
    expect(mapped.code).toBe('unfunded');
    expect(mapped.status).toBe(503);
  });

  it('maps rate limits', () => {
    expect(mapUnknownError(new Error('ANON_COST_LIMITED')).code).toBe('rate_limited');
    expect(mapUnknownError(new Error('429 Too Many Requests')).code).toBe('rate_limited');
  });

  it('maps nonce errors to try later', () => {
    expect(mapUnknownError(new Error('nonce too low')).code).toBe('try_later');
  });

  it('never returns the raw RPC text', () => {
    const mapped = mapUnknownError(new Error('execution reverted: Ident32InvalidByte(1, 0x41)'));
    expect(mapped.message).toBe(publicMessage('server_error'));
    expect(mapped.message).not.toMatch(/Ident32/);
  });

  it('does not leak a tx hash in the public body', () => {
    const err = new EntityMutationError('do not retry', { txHash: `0x${'11'.repeat(32)}` });
    const body = errorBody(err);
    expect(body.message).not.toContain('1111');
    expect(body.error).toBe('server_error');
  });

  it('string errors still map', () => {
    expect(errorBody('timeout of 20000ms exceeded').error).toBe('try_later');
  });

  it('unknown values become server_error', () => {
    expect(errorBody({ weird: true }).error).toBe('server_error');
  });
});
