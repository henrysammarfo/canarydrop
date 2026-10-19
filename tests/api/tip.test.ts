import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/tip/route';
import { CSRF, HEX_KEY, postJson } from '../helpers/request';

describe('api/tip validation', () => {
  it('rejects missing fields with a public error', async () => {
    const r = await POST(postJson('http://localhost:3000/api/tip?dryRun=1', {}));
    const j = await r.json();
    expect(r.status).toBe(400);
    expect(j.error).toBe('bad_request');
    expect(String(j.message)).not.toMatch(/Ident32|stack|private/i);
  });

  it('rejects invalid json', async () => {
    const r = await POST(
      new NextRequest('http://localhost:3000/api/tip?dryRun=1', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://localhost:3000',
          cookie: `cd_csrf=${CSRF}`,
          'x-csrf-token': CSRF,
          'sec-fetch-site': 'same-origin',
        },
        body: '{',
      }),
    );
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('bad_request');
  });

  it('dry run of a missing desk returns no_desk rather than paying', async () => {
    const wire = Buffer.alloc(80, 1).toString('base64');
    const r = await POST(postJson('http://localhost:3000/api/tip?dryRun=1', { deskKey: HEX_KEY, wireB64: wire, lifetime: '24h' }));
    const j = await r.json();
    expect(r.status).toBe(400);
    expect(j.error).toBe('no_desk');
  });
});
