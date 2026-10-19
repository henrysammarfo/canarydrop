import { describe, expect, it } from 'vitest';
import { POST as tip } from '@/app/api/tip/route';
import { setIpLimiterForTests } from '@/lib/rate-limit';
import { HEX_KEY, postJson } from '../helpers/request';
import { FakeRedis, createStoreIpGate } from '../helpers/memory-redis';

describe('tip route with a shared Redis window', () => {
  it('counts two isolates against the same FakeRedis limiter', async () => {
    const redis = new FakeRedis();
    setIpLimiterForTests(createStoreIpGate(redis, 2));
    const body = { deskKey: HEX_KEY, wireB64: 'AA==', lifetime: '24h' as const };
    const headers = { 'x-forwarded-for': '203.0.113.77' };
    const a = await tip(postJson('http://localhost:3000/api/tip?dryRun=1', body, headers));
    const b = await tip(postJson('http://localhost:3000/api/tip?dryRun=1', body, headers));
    const c = await tip(postJson('http://localhost:3000/api/tip?dryRun=1', body, headers));
    expect(a.status).not.toBe(429);
    expect(b.status).not.toBe(429);
    expect(c.status).toBe(429);
    expect((await c.json()).error).toBe('rate_limited');
  });
});
