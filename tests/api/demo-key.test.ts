import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { generatePrivateKey } from 'viem/accounts';
import { GET } from '@/app/api/demo/desk/key/route';
import { getJson } from '../helpers/request';

describe('demo desk key route', () => {
  afterEach(() => {
    delete process.env.DESK_PRIVATE_KEY;
  });

  it('rejects a missing origin', async () => {
    const r = await GET(
      getJson('http://localhost:3000/api/demo/desk/key', { origin: '' }),
    );
    expect(r.status).toBe(403);
    expect((await r.json()).error).toBe('bad_origin');
  });

  it('allows a real-browser same-origin GET with no Origin header', async () => {
    process.env.DESK_PRIVATE_KEY = generatePrivateKey();
    const r = await GET(
      new NextRequest('http://localhost:3000/api/demo/desk/key', {
        method: 'GET',
        headers: { 'sec-fetch-site': 'same-origin' },
      }),
    );
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.jwk.crv).toBe('P-256');
  });

  it('rejects a same-origin GET whose host is not ours', async () => {
    const r = await GET(
      new NextRequest('http://evil.example/api/demo/desk/key', {
        method: 'GET',
        headers: { 'sec-fetch-site': 'same-origin' },
      }),
    );
    expect(r.status).toBe(403);
    expect((await r.json()).error).toBe('bad_origin');
  });

  it('rejects a forged origin', async () => {
    const r = await GET(
      getJson('http://localhost:3000/api/demo/desk/key', {
        origin: 'https://canarydrop.vercel.app.evil.com',
      }),
    );
    expect(r.status).toBe(403);
  });

  it('returns a P-256 jwk from a throwaway desk wallet key', async () => {
    process.env.DESK_PRIVATE_KEY = generatePrivateKey();
    const r = await GET(getJson('http://localhost:3000/api/demo/desk/key'));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(j.jwk.kty).toBe('EC');
    expect(j.jwk.crv).toBe('P-256');
    expect(typeof j.jwk.d).toBe('string');
    expect(typeof j.jwk.x).toBe('string');
    expect(typeof j.pubB64).toBe('string');
    expect(Buffer.from(j.pubB64, 'base64')[0]).toBe(4);
  });

  it('is stable for the same throwaway key', async () => {
    const eth = generatePrivateKey();
    process.env.DESK_PRIVATE_KEY = eth;
    const a = await (await GET(getJson('http://localhost:3000/api/demo/desk/key'))).json();
    const b = await (await GET(getJson('http://localhost:3000/api/demo/desk/key'))).json();
    expect(a.jwk.d).toBe(b.jwk.d);
    expect(a.pubB64).toBe(b.pubB64);
  });
});
