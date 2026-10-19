import { beforeEach, describe, expect, it } from 'vitest';
import { POST as tip } from '@/app/api/tip/route';
import { relayIpWindow } from '@/lib/rate-limit';
import { HEX_KEY, postJson } from '../helpers/request';

describe('per ip relay window on the tip route', () => {
  beforeEach(() => relayIpWindow.reset());

  it('returns 429 after the window fills', async () => {
    const body = { deskKey: HEX_KEY, wireB64: 'AA==', lifetime: '24h' as const };
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const r = await tip(postJson('http://localhost:3000/api/tip?dryRun=1', body, { 'x-forwarded-for': '203.0.113.9' }));
      statuses.push(r.status);
    }
    expect(statuses[7]).not.toBe(429);
    expect(statuses[8]).toBe(429);
    expect(statuses[11]).toBe(429);
  });

  it('isolates two client addresses', async () => {
    const body = { deskKey: HEX_KEY, wireB64: 'AA==', lifetime: '24h' as const };
    for (let i = 0; i < 8; i++) {
      await tip(postJson('http://localhost:3000/api/tip?dryRun=1', body, { 'x-forwarded-for': '203.0.113.10' }));
    }
    const other = await tip(
      postJson('http://localhost:3000/api/tip?dryRun=1', body, { 'x-forwarded-for': '203.0.113.11' }),
    );
    expect(other.status).not.toBe(429);
  });
});
