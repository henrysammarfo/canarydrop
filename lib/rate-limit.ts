import { Ratelimit } from '@upstash/ratelimit';
import type { Redis } from '@upstash/redis';
import {
  IP_RATE_MAX_DESK,
  IP_RATE_MAX_READ,
  IP_RATE_MAX_RELAY,
  IP_RATE_WINDOW_MS,
  REDIS_RL_PREFIX,
} from './constants';
import { getUpstashRedis, warnRedisRateFallback } from './store';

export type RateBucket = { resetAt: number; count: number };

export type IpLimiter = {
  limit: (identifier: string) => Promise<{ success: boolean }>;
};

export type WriteKind = 'relay' | 'desk';
export type IpBucket = 'relay' | 'desk' | 'relay-read' | 'desk-read';

/** Per process window. Used when Redis env is missing or a Redis call fails. */
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
export const relayReadIpWindow = new SlidingWindow(IP_RATE_WINDOW_MS, IP_RATE_MAX_READ);
export const deskReadIpWindow = new SlidingWindow(IP_RATE_WINDOW_MS, IP_RATE_MAX_READ);

const gateCache = new Map<string, IpLimiter>();
let injectedLimiter: IpLimiter | null | undefined;

export function createUpstashIpGate(redis: Redis, max: number): IpLimiter {
  const windowSec = Math.max(1, Math.round(IP_RATE_WINDOW_MS / 1000));
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, `${windowSec} s`),
    prefix: REDIS_RL_PREFIX,
    ephemeralCache: false,
    analytics: false,
    timeout: 0,
    enableTelemetry: false,
    enableProtection: false,
  });
}

export function setIpLimiterForTests(limiter: IpLimiter | null | undefined): void {
  injectedLimiter = limiter;
}

export function resetRateLimitForTests(): void {
  relayIpWindow.reset();
  deskIpWindow.reset();
  relayReadIpWindow.reset();
  deskReadIpWindow.reset();
  injectedLimiter = undefined;
  gateCache.clear();
}

function maxFor(bucket: IpBucket): number {
  if (bucket === 'desk-read' || bucket === 'relay-read') return IP_RATE_MAX_READ;
  return bucket === 'desk' ? IP_RATE_MAX_DESK : IP_RATE_MAX_RELAY;
}

function memoryFor(bucket: IpBucket): SlidingWindow {
  if (bucket === 'desk-read') return deskReadIpWindow;
  if (bucket === 'relay-read') return relayReadIpWindow;
  return bucket === 'desk' ? deskIpWindow : relayIpWindow;
}

function cachedGate(bucket: IpBucket, redis: Redis, max: number): IpLimiter {
  const hit = gateCache.get(bucket);
  if (hit) return hit;
  const gate = createUpstashIpGate(redis, max);
  gateCache.set(bucket, gate);
  return gate;
}

function limiterFor(bucket: IpBucket, max: number): IpLimiter | null {
  if (injectedLimiter !== undefined) return injectedLimiter;
  const redis = getUpstashRedis();
  if (!redis) return null;
  return cachedGate(bucket, redis, max);
}

export async function allowIp(bucket: IpBucket, ip: string): Promise<boolean> {
  const key = `${bucket}:${ip || 'missing'}`;
  const max = maxFor(bucket);
  const memory = memoryFor(bucket);
  const limiter = limiterFor(bucket, max);
  if (!limiter) return memory.allow(key);
  try {
    const result = await limiter.limit(key);
    return result.success;
  } catch {
    warnRedisRateFallback();
    return memory.allow(key);
  }
}
