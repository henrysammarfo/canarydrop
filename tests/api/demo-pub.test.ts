import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { generatePrivateKey } from 'viem/accounts';
import { GET } from '@/app/api/demo/desk/pub/route';
import { GET as demoKey } from '@/app/api/demo/desk/key/route';
import { getJson } from '../helpers/request';

describe('demo desk pub route', () => {
  afterEach(() => {
    delete process.env.DESK_PRIVATE_KEY;
  });

  it('rejects a missing origin without same-origin fetch metadata', async () => {
    const r = await GET(
      new NextRequest('http://localhost:3000/api/demo/desk/pub', {
        method: 'GET',
        headers: { cookie: 'cd_csrf=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      }),
    );
    expect(r.status).toBe(403);
    expect((await r.json()).error).toBe('bad_origin');
  });

  it('returns public bytes and never the private jwk', async () => {
    process.env.DESK_PRIVATE_KEY = generatePrivateKey();
    const r = await GET(getJson('http://localhost:3000/api/demo/desk/pub'));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(typeof j.pubB64).toBe('string');
    expect(j.jwk).toBeUndefined();
    expect(JSON.stringify(j)).not.toMatch(/"d":/);
    expect(Buffer.from(j.pubB64, 'base64')[0]).toBe(4);
  });

  it('matches the public bytes from the key route', async () => {
    process.env.DESK_PRIVATE_KEY = generatePrivateKey();
    const pub = await (await GET(getJson('http://localhost:3000/api/demo/desk/pub'))).json();
    const key = await (await demoKey(getJson('http://localhost:3000/api/demo/desk/key'))).json();
    expect(pub.pubB64).toBe(key.pubB64);
  });
});
