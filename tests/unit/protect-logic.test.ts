import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { clientIp, isDryRun } from '@/lib/protect';
import { isLifetime } from '@/lib/arkiv';

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
});
