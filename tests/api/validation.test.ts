import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as tip } from '@/app/api/tip/route';

function req(url: string, body: any) {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
  } as any);
}

describe('validators', () => {
  it('rejects oversize ciphertext', async () => {
    const big = 'A'.repeat(70000);
    const r = await tip(req('http://localhost/api/tip?dryRun=1', { deskKey: '0x' + 'a'.repeat(64), wireB64: big, lifetime: '24h' }));
    expect(r.status).toBe(400);
  });
  it('rejects bad hex', async () => {
    const r = await tip(req('http://localhost/api/tip?dryRun=1', { deskKey: '0xXYZ', wireB64: 'AA==', lifetime: '24h' }));
    expect(r.status).toBe(400);
  });
  it('rejects extra fields', async () => {
    const r = await tip(req('http://localhost/api/tip?dryRun=1', { deskKey: '0x' + 'b'.repeat(64), wireB64: 'AA==', lifetime: '24h', extra: 1 }));
    expect(r.status).toBe(400);
  });
});

