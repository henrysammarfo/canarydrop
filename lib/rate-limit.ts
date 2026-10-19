import { IP_RATE_MAX_DESK, IP_RATE_MAX_RELAY, IP_RATE_WINDOW_MS } from './constants';

export type RateBucket = { resetAt: number; count: number };

/** Per process window. Durable caps live on Arkiv. See lib/guard.ts. */
export class SlidingWindow {
  readonly buckets = new Map<string, RateBucket>();

  constructor(
    readonly windowMs: number,
    readonly max: number,
  ) {}

  allow(key: string, now = Date.now()): boolean {
    const id = key || 'missing';
    const current = this.buckets.get(id);
    if (!current || now >= current.resetAt) {
      this.buckets.set(id, { resetAt: now + this.windowMs, count: 1 });
      return true;
    }
    if (current.count >= this.max) return false;
    current.count += 1;
    return true;
  }

  peek(key: string): RateBucket | undefined {
    return this.buckets.get(key || 'missing');
  }

  reset(): void {
    this.buckets.clear();
  }
}

export const relayIpWindow = new SlidingWindow(IP_RATE_WINDOW_MS, IP_RATE_MAX_RELAY);
export const deskIpWindow = new SlidingWindow(IP_RATE_WINDOW_MS, IP_RATE_MAX_DESK);
