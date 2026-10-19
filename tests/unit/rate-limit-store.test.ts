import { afterEach, describe, expect, it } from 'vitest';
import type { Redis } from '@upstash/redis';
import {
  allowIp,
  createUpstashIpGate,
  resetRateLimitForTests,
  setIpLimiterForTests,
} from '@/lib/rate-limit';
import { REDIS_RL_PREFIX } from '@/lib/constants';
import { resetStoreForTests } from '@/lib/store';
import { FakeRedis, createStoreIpGate } from '../helpers/memory-redis';

describe('durable per IP window', () => {
  afterEach(() => {
    resetStoreForTests();
    resetRateLimitForTests();
  });

  it('falls back to the in process window when Redis is unset', async () => {
    expect(await allowIp('relay', '203.0.113.1')).toBe(true);
    expect(await allowIp('relay', '203.0.113.1')).toBe(true);
  });

  it('shares a counter across two isolate stand ins on FakeRedis', async () => {
    const redis = new FakeRedis();
    const isolateA = createStoreIpGate(redis, 2);
    const isolateB = createStoreIpGate(redis, 2);
    expect((await isolateA.limit('relay:203.0.113.8')).success).toBe(true);
    expect((await isolateB.limit('relay:203.0.113.8')).success).toBe(true);
    expect((await isolateA.limit('relay:203.0.113.8')).success).toBe(false);
    expect((await isolateB.limit('relay:198.51.100.8')).success).toBe(true);
  });

  it('allowIp uses the injected store limiter', async () => {
    const redis = new FakeRedis();
    setIpLimiterForTests(createStoreIpGate(redis, 2));
    expect(await allowIp('relay', '203.0.113.20')).toBe(true);
    expect(await allowIp('relay', '203.0.113.20')).toBe(true);
    expect(await allowIp('relay', '203.0.113.20')).toBe(false);
    expect(await allowIp('desk', '203.0.113.21')).toBe(true);
  });

  it('falls back to memory when the Redis limiter throws', async () => {
    setIpLimiterForTests({
      limit: async () => {
        throw new Error('upstash timeout');
      },
    });
    expect(await allowIp('desk', '203.0.113.30')).toBe(true);
    for (let i = 0; i < 7; i++) {
      expect(await allowIp('desk', '203.0.113.30')).toBe(true);
    }
    expect(await allowIp('desk', '203.0.113.30')).toBe(false);
  });

  it('builds an Upstash sliding window gate with no ephemeral cache', () => {
    const dummy = {
      evalsha: async () => [0, 0, 0],
      get: async () => null,
      set: async () => 'OK' as const,
    };
    const gate = createUpstashIpGate(dummy as unknown as Redis, 8);
    expect(typeof gate.limit).toBe('function');
    expect(REDIS_RL_PREFIX).toBe('cd:rl');
  });

  it('keeps read and write buckets separate on the injected store', async () => {
    const redis = new FakeRedis();
    setIpLimiterForTests(createStoreIpGate(redis, 1));
    expect(await allowIp('desk', '203.0.113.40')).toBe(true);
    expect(await allowIp('desk', '203.0.113.40')).toBe(false);
    expect(await allowIp('desk-read', '203.0.113.40')).toBe(true);
  });
});
