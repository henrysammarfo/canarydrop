import { describe, expect, it } from 'vitest';
import { EntityMutationError } from '@arkiv-network/sdk';
import { backoffMs, isRetryableChainError, SerialQueue, withBackoff } from '@/lib/retry';

describe('retry extra cases', () => {
  it('retries fee too low and 503', () => {
    expect(isRetryableChainError(new Error('fee too low'))).toBe(true);
    expect(isRetryableChainError(new Error('503 Service Unavailable'))).toBe(true);
    expect(isRetryableChainError(new Error('network error'))).toBe(true);
  });

  it('does not retry EntityMutationError when there is no matching message', () => {
    const err = new EntityMutationError('transient');
    expect(err.txHash).toBeUndefined();
    expect(isRetryableChainError(err)).toBe(false);
  });

  it('does not retry an unknown message', () => {
    expect(isRetryableChainError(new Error('Ident32InvalidByte'))).toBe(false);
    expect(isRetryableChainError('nope')).toBe(false);
    expect(isRetryableChainError(null)).toBe(false);
  });

  it('backoff grows as a power of two', () => {
    expect([0, 1, 2, 3, 4].map((i) => backoffMs(i, 10))).toEqual([10, 20, 40, 80, 160]);
  });

  it('withBackoff uses the last error after retries', async () => {
    await expect(
      withBackoff(
        async () => {
          throw new Error('timeout');
        },
        3,
        async () => undefined,
      ),
    ).rejects.toThrow(/timeout/);
  });

  it('serial queue preserves return values of many tasks', async () => {
    const q = new SerialQueue();
    const jobs = Array.from({ length: 8 }, (_, i) => q.enqueue(async () => i * i));
    expect(await Promise.all(jobs)).toEqual([0, 1, 4, 9, 16, 25, 36, 49]);
  });
});
