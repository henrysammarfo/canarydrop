import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeRedis } from '../helpers/memory-redis';
import {
  REDIS_LOCK_FALLBACK_WARNING,
  REDIS_MISSING_WARNING,
  REDIS_RATE_FALLBACK_WARNING,
  getRedis,
  getUpstashRedis,
  readRedisCreds,
  resetStoreForTests,
  setRedisForTests,
  warnIfRedisMissing,
  warnRedisLockFallback,
  warnRedisRateFallback,
} from '@/lib/store';

describe('readRedisCreds', () => {
  it('prefers the UPSTASH_REDIS_REST pair', () => {
    const creds = readRedisCreds({
      UPSTASH_REDIS_REST_URL: 'https://alpha.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'upstash-token',
      KV_REST_API_URL: 'https://beta.upstash.io',
      KV_REST_API_TOKEN: 'kv-token',
    });
    expect(creds).toEqual({
      url: 'https://alpha.upstash.io',
      token: 'upstash-token',
      source: 'upstash',
    });
  });

  it('falls through to the KV_REST_API pair', () => {
    const creds = readRedisCreds({
      KV_REST_API_URL: 'https://kv.upstash.io',
      KV_REST_API_TOKEN: 'kv-token',
    });
    expect(creds).toEqual({
      url: 'https://kv.upstash.io',
      token: 'kv-token',
      source: 'kv',
    });
  });

  it('ignores an incomplete UPSTASH pair and uses KV', () => {
    const creds = readRedisCreds({
      UPSTASH_REDIS_REST_URL: 'https://alpha.upstash.io',
      KV_REST_API_URL: 'https://kv.upstash.io',
      KV_REST_API_TOKEN: 'kv-token',
    });
    expect(creds?.source).toBe('kv');
  });

  it('rejects http and rediss urls', () => {
    expect(
      readRedisCreds({
        UPSTASH_REDIS_REST_URL: 'http://insecure.example',
        UPSTASH_REDIS_REST_TOKEN: 'token',
      }),
    ).toBeNull();
    expect(
      readRedisCreds({
        KV_REST_API_URL: 'rediss://default:secret@host:6379',
        KV_REST_API_TOKEN: 'token',
      }),
    ).toBeNull();
  });

  it('never treats KV_URL as the REST url', () => {
    expect(
      readRedisCreds({
        KV_URL: 'rediss://default:supersecret@host:6379',
      }),
    ).toBeNull();
  });

  it('trims whitespace and treats empty as missing', () => {
    expect(
      readRedisCreds({
        UPSTASH_REDIS_REST_URL: '  https://alpha.upstash.io  ',
        UPSTASH_REDIS_REST_TOKEN: '  token  ',
      })?.url,
    ).toBe('https://alpha.upstash.io');
    expect(
      readRedisCreds({
        UPSTASH_REDIS_REST_URL: '   ',
        UPSTASH_REDIS_REST_TOKEN: 'token',
      }),
    ).toBeNull();
  });
});

describe('getRedis', () => {
  afterEach(() => {
    resetStoreForTests();
  });

  it('returns null when env is missing', () => {
    expect(getRedis()).toBeNull();
    expect(getUpstashRedis()).toBeNull();
  });

  it('returns the injected test store and not a real client', () => {
    const fake = new FakeRedis();
    setRedisForTests(fake);
    expect(getRedis()).toBe(fake);
    expect(getUpstashRedis()).toBeNull();
  });
});

describe('redis warnings', () => {
  afterEach(() => {
    resetStoreForTests();
    vi.restoreAllMocks();
  });

  it('warns once when not in vitest and never prints a token or rediss url', () => {
    const logs: string[] = [];
    vi.spyOn(console, 'warn').mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });
    const env = {
      VITEST: 'false',
      KV_URL: 'rediss://default:supersecret@host:6379',
      UPSTASH_REDIS_REST_TOKEN: 'supersecret-token',
    };
    warnIfRedisMissing(env);
    warnIfRedisMissing(env);
    expect(logs).toEqual([REDIS_MISSING_WARNING]);
    expect(logs[0]).not.toMatch(/supersecret|rediss|token=/i);
  });

  it('stays quiet under vitest', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    warnIfRedisMissing({ VITEST: 'true' });
    warnRedisRateFallback({ VITEST: 'true' });
    warnRedisLockFallback({ VITEST: 'true' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('rate and lock fallback warnings are distinct and one shot', () => {
    const logs: string[] = [];
    vi.spyOn(console, 'warn').mockImplementation((msg: unknown) => {
      logs.push(String(msg));
    });
    const env = { VITEST: 'false' };
    warnRedisRateFallback(env);
    warnRedisRateFallback(env);
    warnRedisLockFallback(env);
    warnRedisLockFallback(env);
    expect(logs).toEqual([REDIS_RATE_FALLBACK_WARNING, REDIS_LOCK_FALLBACK_WARNING]);
  });
});
