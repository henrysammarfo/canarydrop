import { describe, expect, it } from 'vitest';
import { POST as tip } from '@/app/api/tip/route';
import { POST as createDesk } from '@/app/api/demo/desk/create/route';
import { HEX_KEY, postJson, postRaw } from '../helpers/request';

describe('write route guards', () => {
  it('rejects a tip with no origin', async () => {
    const r = await tip(
      postRaw('http://localhost:3000/api/tip?dryRun=1', {
        headers: {
          'content-type': 'application/json',
          cookie: `cd_csrf=${'a'.repeat(32)}`,
          'x-csrf-token': 'a'.repeat(32),
        },
        body: JSON.stringify({ deskKey: HEX_KEY, wireB64: 'AAECAw==', lifetime: '24h' }),
      }),
    );
    expect(r.status).toBe(403);
    expect((await r.json()).error).toBe('bad_origin');
  });

  it('rejects a forged origin that only includes the host as a substring', async () => {
    const r = await tip(
      postJson(
        'http://localhost:3000/api/tip?dryRun=1',
        { deskKey: HEX_KEY, wireB64: 'AAECAw==', lifetime: '24h' },
        { origin: 'https://localhost.evil.example' },
      ),
    );
    expect(r.status).toBe(403);
  });

  it('rejects a missing csrf pair', async () => {
    const r = await tip(
      postJson(
        'http://localhost:3000/api/tip?dryRun=1',
        { deskKey: HEX_KEY, wireB64: 'AAECAw==', lifetime: '24h' },
        { cookie: '', 'x-csrf-token': '' },
      ),
    );
    expect(r.status).toBe(403);
    expect((await r.json()).error).toBe('bad_csrf');
  });

  it('rejects a csrf mismatch', async () => {
    const r = await tip(
      postJson(
        'http://localhost:3000/api/tip?dryRun=1',
        { deskKey: HEX_KEY, wireB64: 'AAECAw==', lifetime: '24h' },
        { 'x-csrf-token': 'b'.repeat(32) },
      ),
    );
    expect(r.status).toBe(403);
  });

  it('rejects a cross-site fetch metadata value', async () => {
    const r = await tip(
      postJson(
        'http://localhost:3000/api/tip?dryRun=1',
        { deskKey: HEX_KEY, wireB64: 'AAECAw==', lifetime: '24h' },
        { 'sec-fetch-site': 'cross-site' },
      ),
    );
    expect(r.status).toBe(403);
  });

  it('rejects a same-site sibling host', async () => {
    const r = await tip(
      postJson(
        'http://localhost:3000/api/tip?dryRun=1',
        { deskKey: HEX_KEY, wireB64: 'AAECAw==', lifetime: '24h' },
        { 'sec-fetch-site': 'same-site' },
      ),
    );
    expect(r.status).toBe(403);
  });

  it('demo create also requires origin', async () => {
    const r = await createDesk(
      postRaw('http://localhost:3000/api/demo/desk/create?dryRun=1', {
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Demo', deskPubRawB64: 'AA==' }),
      }),
    );
    expect(r.status).toBe(403);
  });

  it('rejects a production substring origin', async () => {
    const r = await tip(
      postJson(
        'http://localhost:3000/api/tip?dryRun=1',
        { deskKey: HEX_KEY, wireB64: 'AA==', lifetime: '24h' },
        { origin: 'https://canarydrop.vercel.app.evil.com' },
      ),
    );
    expect(r.status).toBe(403);
    expect((await r.json()).error).toBe('bad_origin');
  });

  it('public error bodies have no stack field', async () => {
    const r = await tip(postJson('http://localhost:3000/api/tip?dryRun=1', {}));
    const j = await r.json();
    expect(j.stack).toBeUndefined();
    expect(JSON.stringify(j)).not.toMatch(/Ident32|node_modules/);
  });
});
