import { describe, expect, it } from 'vitest';
import { EntityMutationError } from '@arkiv-network/sdk';
import { backoffMs, isRetryableChainError, jitterMs, SerialQueue, withBackoff, withReadBackoff } from '@/lib/retry';

describe('retry helpers', () => {
  it('doubles backoff', () => {
    expect(backoffMs(0, 50)).toBe(50);
    expect(backoffMs(1, 50)).toBe(100);
    expect(backoffMs(2, 50)).toBe(200);
    expect(backoffMs(3, 50)).toBe(400);
  });

  it('retries nonce errors', () => {
    expect(isRetryableChainError(new Error('nonce too low'))).toBe(true);
    expect(isRetryableChainError(new Error('replacement transaction underpriced'))).toBe(true);
  });

  it('retries 429 and timeouts', () => {
    expect(isRetryableChainError(new Error('429 too many requests'))).toBe(true);
    expect(isRetryableChainError(new Error('timeout'))).toBe(true);
    expect(isRetryableChainError(new Error('ECONNRESET'))).toBe(true);
  });

  it('does not retry out of funds', () => {
    expect(isRetryableChainError(new Error('insufficient funds'))).toBe(false);
  });

  it('does not retry EntityMutationError with a tx hash', () => {
    const err = new EntityMutationError('mismatch, do not retry', { txHash: `0x${'ab'.repeat(32)}` });
    expect(isRetryableChainError(err)).toBe(false);
  });

  it('withBackoff retries then succeeds', async () => {
    let n = 0;
    const pauses: number[] = [];
    const out = await withBackoff(
      async () => {
        n += 1;
        if (n < 3) throw new Error('nonce too low');
        return 'ok';
      },
      4,
      async (ms) => {
        pauses.push(ms);
      },
    );
    expect(out).toBe('ok');
    expect(n).toBe(3);
    expect(pauses).toEqual([50, 100]);
  });

  it('jitter stays between half and one and a half of the base', () => {
    expect(jitterMs(1000, () => 0)).toBe(500);
    expect(jitterMs(1000, () => 1)).toBe(1500);
    expect(jitterMs(1000, () => 0.5)).toBe(1000);
  });

  it('read backoff retries once with jitter instead of a fast loop', async () => {
    let n = 0;
    const pauses: number[] = [];
    await expect(
      withReadBackoff(
        async () => {
          n += 1;
          throw new Error('429 ANON_COST_LIMITED');
        },
        async (ms) => {
          pauses.push(ms);
        },
        () => 0.5,
      ),
    ).rejects.toThrow(/429/);
    expect(n).toBe(2);
    expect(pauses).toEqual([700]);
  });

  it('withBackoff stops on a fatal error', async () => {
    await expect(
      withBackoff(async () => {
        throw new Error('insufficient funds for gas');
      }, 4, async () => undefined),
    ).rejects.toThrow(/insufficient funds/);
  });

  it('serial queue runs tasks in order', async () => {
    const q = new SerialQueue();
    const order: number[] = [];
    const a = q.enqueue(async () => {
      await new Promise((r) => setTimeout(r, 20));
      order.push(1);
      return 1;
    });
    const b = q.enqueue(async () => {
      order.push(2);
      return 2;
    });
    expect(await Promise.all([a, b])).toEqual([1, 2]);
    expect(order).toEqual([1, 2]);
  });

  it('serial queue continues after a failure', async () => {
    const q = new SerialQueue();
    const first = q.enqueue(async () => {
      throw new Error('boom');
    });
    const second = q.enqueue(async () => 7);
    await expect(first).rejects.toThrow('boom');
    expect(await second).toBe(7);
  });
});
