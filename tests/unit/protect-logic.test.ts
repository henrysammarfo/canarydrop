import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { clientIp, isDryRun, protectRead, protectWrite } from '@/lib/protect';
import { isLifetime } from '@/lib/arkiv';
import { CSRF, postJson } from '../helpers/request';
import { setIpLimiterForTests } from '@/lib/rate-limit';

function req(url: string, headers: Record<string, string>) {
  return new NextRequest(url, { method: 'POST', headers });
}

describe('protect helpers', () => {
  it('reads the first forwarded ip', () => {
    const r = req('http://localhost/api/tip', { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' });
    expect(clientIp(r)).toBe('203.0.113.1');
  });

  it('falls back to cf connecting ip', () => {
    const r = req('http://localhost/api/tip', { 'cf-connecting-ip': '198.51.100.4' });
    expect(clientIp(r)).toBe('198.51.100.4');
  });

  it('uses missing when no ip is present', () => {
    const r = req('http://localhost/api/tip', {});
    expect(clientIp(r)).toBe('missing');
  });

  it('detects dry run query and header', () => {
    expect(isDryRun(req('http://localhost/api/tip?dryRun=1', {}))).toBe(true);
    expect(isDryRun(req('http://localhost/api/tip', { 'x-dry-run': '1' }))).toBe(true);
    expect(isDryRun(req('http://localhost/api/tip', {}))).toBe(false);
  });

  it('lifetime union', () => {
    expect(isLifetime('24h')).toBe(true);
    expect(isLifetime('9d')).toBe(false);
    expect(isLifetime('1h')).toBe(true);
  });

  it('protectWrite is async and returns 429 when the limiter denies', async () => {
    setIpLimiterForTests({ limit: async () => ({ success: false }) });
    const blocked = await protectWrite(
      postJson('http://localhost:3000/api/tip', { deskKey: `0x${'ab'.repeat(32)}` }),
      'relay',
    );
    expect(blocked?.status).toBe(429);
    expect((await blocked?.json())?.error).toBe('rate_limited');
  });

  it('protectRead is async and still requires origin', async () => {
    const blocked = await protectRead(
      new NextRequest('http://localhost:3000/api/demo/desk/key', {
        method: 'GET',
        headers: { cookie: `cd_csrf=${CSRF}` },
      }),
      'desk',
    );
    expect(blocked?.status).toBe(403);
  });
});
