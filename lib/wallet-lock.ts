import {
  REDIS_LOCK_PREFIX,
  WALLET_LOCK_RETRY_MS,
  WALLET_LOCK_TTL_MS,
  WALLET_LOCK_WAIT_MS,
} from './constants';
import { AppError } from './errors';
import { deskQueue, relayQueue, sleep, type SerialQueue } from './retry';
import { getRedis, warnRedisLockFallback, type SharedStore } from './store';

export type WalletKind = 'relay' | 'desk';

export type WalletLockOpts = {
  waitMs?: number;
  retryMs?: number;
  ttlMs?: number;
  now?: () => number;
};

const UNLOCK_LUA =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

export function walletLockKey(kind: WalletKind, address: string): string {
  const id = address.trim().toLowerCase() || 'missing';
  return `${REDIS_LOCK_PREFIX}:${kind}:${id}`;
}

function queueFor(kind: WalletKind): SerialQueue {
  return kind === 'relay' ? relayQueue : deskQueue;
}

async function releaseLock(redis: SharedStore, key: string, token: string): Promise<void> {
  try {
    await redis.eval(UNLOCK_LUA, [key], [token]);
  } catch {
    // TTL still drops the key. Never throw from unlock.
  }
}

async function tryAcquire(
  redis: SharedStore,
  key: string,
  token: string,
  ttlMs: number,
): Promise<'ok' | 'busy' | 'down'> {
  try {
    const acquired = await redis.set(key, token, { nx: true, px: ttlMs });
    return acquired === 'OK' ? 'ok' : 'busy';
  } catch {
    return 'down';
  }
}

/**
 * Outer Redis lock per paying wallet, inner process queue.
 * We still read a pending Ethereum nonce inside the callback. Redis is not a nonce counter.
 */
export async function withWalletLock<T>(
  kind: WalletKind,
  address: string,
  fn: () => Promise<T>,
  opts: WalletLockOpts = {},
): Promise<T> {
  const queue = queueFor(kind);
  const redis = getRedis();
  if (!redis) return queue.enqueue(fn);

  const key = walletLockKey(kind, address);
  const token = crypto.randomUUID();
  const ttlMs = opts.ttlMs ?? WALLET_LOCK_TTL_MS;
  const waitMs = opts.waitMs ?? WALLET_LOCK_WAIT_MS;
  const retryMs = opts.retryMs ?? WALLET_LOCK_RETRY_MS;
  const now = opts.now ?? Date.now;
  const deadline = now() + waitMs;

  while (true) {
    const result = await tryAcquire(redis, key, token, ttlMs);
    if (result === 'down') {
      warnRedisLockFallback();
      return queue.enqueue(fn);
    }
    if (result === 'ok') break;
    if (now() >= deadline) {
      throw new AppError('try_later', 'The sponsor is busy. Please try again.');
    }
    await sleep(retryMs);
  }

  try {
    return await queue.enqueue(fn);
  } finally {
    await releaseLock(redis, key, token);
  }
}
