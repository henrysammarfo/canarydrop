import { afterEach, describe, expect, it } from 'vitest';
import { AppError } from '@/lib/errors';
import { resetStoreForTests, setRedisForTests } from '@/lib/store';
import { walletLockKey, withWalletLock } from '@/lib/wallet-lock';
import { FakeRedis } from '../helpers/memory-redis';

const ADDR = '0xA6Aa6a1409eb54028550466169A29EAfd8f7a442';

describe('wallet lock', () => {
  afterEach(() => {
    resetStoreForTests();
  });

  it('names the lock key with kind and lowercase address', () => {
    expect(walletLockKey('relay', ADDR)).toBe(`cd:lock:relay:${ADDR.toLowerCase()}`);
    expect(walletLockKey('desk', '  ')).toBe('cd:lock:desk:missing');
  });

  it('serializes concurrent holders on a shared FakeRedis', async () => {
    const redis = new FakeRedis();
    setRedisForTests(redis);
    const order: number[] = [];
    const jobs = [1, 2, 3].map((n) =>
      withWalletLock('relay', ADDR, async () => {
        await new Promise((r) => setTimeout(r, 20));
        order.push(n);
        return n;
      }),
    );
    expect(await Promise.all(jobs)).toEqual([1, 2, 3]);
    expect(order).toEqual([1, 2, 3]);
    expect(await redis.get(walletLockKey('relay', ADDR))).toBeNull();
  });

  it('fails closed when the lock is held past the wait budget', async () => {
    const redis = new FakeRedis();
    setRedisForTests(redis);
    await redis.set(walletLockKey('relay', ADDR), 'other-isolate', { nx: true, px: 30_000 });
    await expect(
      withWalletLock('relay', ADDR, async () => 1, { waitMs: 0, retryMs: 1 }),
    ).rejects.toMatchObject({ code: 'try_later' });
    expect(await redis.get(walletLockKey('relay', ADDR))).toBe('other-isolate');
  });

  it('does not delete another holder token on unlock', async () => {
    const redis = new FakeRedis();
    setRedisForTests(redis);
    const key = walletLockKey('desk', ADDR);
    const first = withWalletLock(
      'desk',
      ADDR,
      async () => {
        await redis.set(key, 'stolen', { px: 30_000 });
        return 'held';
      },
      { waitMs: 0 },
    );
    expect(await first).toBe('held');
    expect(await redis.get(key)).toBe('stolen');
  });

  it('falls back to the process queue when Redis set throws', async () => {
    const redis = new FakeRedis();
    redis.failSet = true;
    setRedisForTests(redis);
    const order: number[] = [];
    const jobs = [1, 2].map((n) =>
      withWalletLock('desk', ADDR, async () => {
        await new Promise((r) => setTimeout(r, 15));
        order.push(n);
        return n;
      }),
    );
    expect(await Promise.all(jobs)).toEqual([1, 2]);
    expect(order).toEqual([1, 2]);
  });

  it('uses the process queue when Redis env is missing', async () => {
    const order: number[] = [];
    const jobs = [1, 2].map((n) =>
      withWalletLock('relay', ADDR, async () => {
        await new Promise((r) => setTimeout(r, 15));
        order.push(n);
        return n;
      }),
    );
    expect(await Promise.all(jobs)).toEqual([1, 2]);
    expect(order).toEqual([1, 2]);
  });

  it('still releases after the callback throws', async () => {
    const redis = new FakeRedis();
    setRedisForTests(redis);
    await expect(
      withWalletLock('relay', ADDR, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await redis.get(walletLockKey('relay', ADDR))).toBeNull();
    expect(await withWalletLock('relay', ADDR, async () => 7)).toBe(7);
  });

  it('does not share a lock across two wallets', async () => {
    const redis = new FakeRedis();
    setRedisForTests(redis);
    const other = '0x1da3c22c079c264536D831F6F1fCe638aB0b20B0';
    const started: string[] = [];
    const a = withWalletLock('relay', ADDR, async () => {
      started.push('a');
      await new Promise((r) => setTimeout(r, 40));
      return 'a';
    });
    await new Promise((r) => setTimeout(r, 5));
    const b = withWalletLock('relay', other, async () => {
      started.push('b');
      return 'b';
    });
    expect(await b).toBe('b');
    expect(started).toEqual(['a', 'b']);
    expect(await a).toBe('a');
  });

  it('maps contention to AppError try_later', async () => {
    const redis = new FakeRedis();
    setRedisForTests(redis);
    await redis.set(walletLockKey('relay', ADDR), 'busy', { nx: true, px: 30_000 });
    try {
      await withWalletLock('relay', ADDR, async () => 1, { waitMs: 0 });
      throw new Error('expected try_later');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('try_later');
      expect((err as AppError).message).toBe('The sponsor is busy. Please try again.');
    }
  });
});
