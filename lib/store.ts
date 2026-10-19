import { Redis } from '@upstash/redis';

export type RedisSource = 'upstash' | 'kv';

export type RedisCreds = {
  url: string;
  token: string;
  source: RedisSource;
};

export type RedisSetOpts = {
  nx?: true;
  px?: number;
};

/** Commands the rate limiter and wallet lock actually use. */
export type SharedStore = {
  set: (key: string, value: string, opts?: RedisSetOpts) => Promise<'OK' | string | null>;
  get: (key: string) => Promise<string | null>;
  del: (...keys: string[]) => Promise<number>;
  eval: <T = unknown>(script: string, keys: string[], args: string[]) => Promise<T>;
};

export const REDIS_MISSING_WARNING =
  'CanaryDrop: Upstash Redis env vars are missing. Per IP limits and wallet locks stay in this process only. Connect Upstash in the Vercel Marketplace so preview and production isolates share a store.';

export const REDIS_RATE_FALLBACK_WARNING =
  'CanaryDrop: Upstash Redis failed during a rate limit check. Using the in process window for this request.';

export const REDIS_LOCK_FALLBACK_WARNING =
  'CanaryDrop: Upstash Redis failed during a wallet lock. Using the in process queue for this request.';

type Mode = 'unset' | 'none' | 'real' | 'test';

let mode: Mode = 'unset';
let real: Redis | null = null;
let testStore: SharedStore | null = null;
let missingWarned = false;
let rateFallbackWarned = false;
let lockFallbackWarned = false;

function inVitest(env: NodeJS.Dict<string | undefined> = process.env): boolean {
  return env.VITEST === 'true';
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function pair(urlRaw: string | undefined, tokenRaw: string | undefined): { url: string; token: string } | null {
  const url = urlRaw?.trim() ?? '';
  const token = tokenRaw?.trim() ?? '';
  if (!url || !token) return null;
  if (!isHttpsUrl(url)) return null;
  return { url, token };
}

/**
 * Read Marketplace REST creds. Prefers UPSTASH_REDIS_REST_* then KV_REST_API_*.
 * Ignores KV_URL (rediss). Never logs the url or token.
 */
export function readRedisCreds(env: NodeJS.Dict<string | undefined> = process.env): RedisCreds | null {
  const upstash = pair(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN);
  if (upstash) return { ...upstash, source: 'upstash' };
  const kv = pair(env.KV_REST_API_URL, env.KV_REST_API_TOKEN);
  if (kv) return { ...kv, source: 'kv' };
  return null;
}

export function warnIfRedisMissing(env: NodeJS.Dict<string | undefined> = process.env): void {
  if (inVitest(env) || missingWarned) return;
  missingWarned = true;
  console.warn(REDIS_MISSING_WARNING);
}

export function warnRedisRateFallback(env: NodeJS.Dict<string | undefined> = process.env): void {
  if (inVitest(env) || rateFallbackWarned) return;
  rateFallbackWarned = true;
  console.warn(REDIS_RATE_FALLBACK_WARNING);
}

export function warnRedisLockFallback(env: NodeJS.Dict<string | undefined> = process.env): void {
  if (inVitest(env) || lockFallbackWarned) return;
  lockFallbackWarned = true;
  console.warn(REDIS_LOCK_FALLBACK_WARNING);
}

function ensure(): void {
  if (mode !== 'unset') return;
  const creds = readRedisCreds();
  if (!creds) {
    warnIfRedisMissing();
    mode = 'none';
    real = null;
    return;
  }
  try {
    real = new Redis({ url: creds.url, token: creds.token });
    mode = 'real';
  } catch {
    warnIfRedisMissing();
    mode = 'none';
    real = null;
  }
}

export function getRedis(): SharedStore | null {
  ensure();
  if (mode === 'test') return testStore;
  if (mode === 'real') return real;
  return null;
}

/** The @upstash/redis client, only when env creds built a real one. Tests never see this. */
export function getUpstashRedis(): Redis | null {
  ensure();
  return mode === 'real' ? real : null;
}

export function setRedisForTests(store: SharedStore | null): void {
  mode = 'test';
  testStore = store;
  real = null;
}

export function resetStoreForTests(): void {
  mode = 'unset';
  real = null;
  testStore = null;
  missingWarned = false;
  rateFallbackWarned = false;
  lockFallbackWarned = false;
}
