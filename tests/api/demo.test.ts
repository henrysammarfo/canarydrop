import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createDesk } from '@/app/api/demo/desk/create/route';
import { POST as renewDesk } from '@/app/api/demo/desk/renew/route';
import { POST as replyDesk } from '@/app/api/demo/reply/route';

function req(url: string, body?: any) {
  return new NextRequest(url, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
    headers: { 'content-type': 'application/json' },
  } as any);
}

describe('demo routes dry-run', () => {
  it('predicts keys on create dry-run', async () => {
    const r = await createDesk(req('http://localhost/api/demo/desk/create?dryRun=1', { name: 'Demo', deskPubRawB64: 'AA==' }));
    expect(r.status).toBe(200);
  });
  it('acknowledges renew dry-run', async () => {
    const r = await renewDesk(req('http://localhost/api/demo/desk/renew?dryRun=1', { deskKey: '0x0', canaryKey: '0x0' }));
    expect(r.status).toBe(200);
  });
  it('acknowledges reply dry-run', async () => {
    const r = await replyDesk(req('http://localhost/api/demo/reply?dryRun=1', { tipKey: '0x0', wireB64: 'AA==' }));
    expect(r.status).toBe(200);
  });
});

