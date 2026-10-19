import { EntityMutationError } from '@arkiv-network/sdk';
import { CHAIN_RETRY_ATTEMPTS, CHAIN_RETRY_BASE_MS } from './constants';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function backoffMs(attempt: number, base = CHAIN_RETRY_BASE_MS): number {
  return base * 2 ** attempt;
}

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
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isRetryableChainError(err) || i === attempts - 1) throw err;
      await pause(backoffMs(i));
    }
  }
  throw last;
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
