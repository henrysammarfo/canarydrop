import { EntityMutationError } from '@arkiv-network/sdk';
import {
  CHAIN_READ_RETRY_ATTEMPTS,
  CHAIN_READ_RETRY_BASE_MS,
  CHAIN_RETRY_ATTEMPTS,
  CHAIN_RETRY_BASE_MS,
} from './constants';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function backoffMs(attempt: number, base = CHAIN_RETRY_BASE_MS): number {
  return base * 2 ** attempt;
}

/** Full jitter around an exponential delay. Range is 50% to 150% of the base. */
export function jitterMs(base: number, rand: () => number = Math.random): number {
  const spread = 0.5 + rand();
  return Math.max(0, Math.round(base * spread));
}

export type BackoffExtra = {
  base?: number;
  jitter?: boolean;
  rand?: () => number;
};

export function isRetryableChainError(err: unknown): boolean {
  if (err instanceof EntityMutationError && err.txHash) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (msg.includes('do not retry')) return false;
  if (msg.includes('insufficient funds')) return false;
  if (msg.includes('nonce')) return true;
  if (msg.includes('429')) return true;
  if (msg.includes('rate')) return true;
  if (msg.includes('timeout')) return true;
  if (msg.includes('econnreset')) return true;
  if (msg.includes('network')) return true;
  if (msg.includes('503')) return true;
  if (msg.includes('replacement')) return true;
  if (msg.includes('fee too low')) return true;
  return false;
}

export async function withBackoff<T>(
  fn: () => Promise<T>,
  attempts = CHAIN_RETRY_ATTEMPTS,
  pause: (ms: number) => Promise<void> = sleep,
  extra?: BackoffExtra,
): Promise<T> {
  const base = extra?.base ?? CHAIN_RETRY_BASE_MS;
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isRetryableChainError(err) || i === attempts - 1) throw err;
      const wait = backoffMs(i, base);
      await pause(extra?.jitter ? jitterMs(wait, extra.rand) : wait);
    }
  }
  throw last;
}

export function withReadBackoff<T>(
  fn: () => Promise<T>,
  pause: (ms: number) => Promise<void> = sleep,
  rand: () => number = Math.random,
): Promise<T> {
  return withBackoff(fn, CHAIN_READ_RETRY_ATTEMPTS, pause, {
    base: CHAIN_READ_RETRY_BASE_MS,
    jitter: true,
    rand,
  });
}

/** Serialize writes from one process so predictEntityKeys and the tx nonce stay in lockstep. */
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();

  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(fn, fn);
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run as Promise<T>;
  }
}

export const relayQueue = new SerialQueue();
export const deskQueue = new SerialQueue();
