import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/tip/route';

function req(url: string, body?: any) {
  return new NextRequest(url, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  } as any);
}

describe('api/tip validation', () => {
  it('rejects missing fields with friendly message', async () => {
    const r = await POST(req('http://localhost/api/tip?dryRun=1', {}));
    const j = await r.json();
    expect(r.status).toBe(400);
    expect(j.message).toMatch(/Please include deskKey/);
  });
});

