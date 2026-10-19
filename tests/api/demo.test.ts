import { describe, expect, it } from 'vitest';
import { POST as createDesk } from '@/app/api/demo/desk/create/route';
import { POST as renewDesk } from '@/app/api/demo/desk/renew/route';
import { POST as replyDesk } from '@/app/api/demo/reply/route';
import { POST as dropDesk } from '@/app/api/demo/drop/route';
import { GET as demoKey } from '@/app/api/demo/desk/key/route';
import { HEX_KEY, getJson, postJson } from '../helpers/request';

const pubB64 = Buffer.alloc(65, 4).toString('base64');

describe('demo routes dry-run', () => {
  it('predicts keys on create dry-run', async () => {
    const r = await createDesk(postJson('http://localhost:3000/api/demo/desk/create?dryRun=1', { name: 'Demo', deskPubRawB64: pubB64 }));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.dryRun).toBe(true);
    expect(Array.isArray(j.predicted)).toBe(true);
    expect(j.predicted).toHaveLength(2);
  });

  it('rejects a public key of the wrong size', async () => {
    const r = await createDesk(postJson('http://localhost:3000/api/demo/desk/create?dryRun=1', { name: 'Demo', deskPubRawB64: 'AA==' }));
    expect(r.status).toBe(400);
  });

  it('acknowledges renew dry-run', async () => {
    const r = await renewDesk(postJson('http://localhost:3000/api/demo/desk/renew?dryRun=1', { deskKey: HEX_KEY, canaryKey: HEX_KEY }));
    expect(r.status).toBe(200);
    expect((await r.json()).wouldRenew).toEqual([HEX_KEY, HEX_KEY]);
  });

  it('acknowledges drop dry-run', async () => {
    const payload = Buffer.alloc(80, 1).toString('base64');
    const r = await dropDesk(
      postJson('http://localhost:3000/api/demo/drop?dryRun=1', {
        deskKey: HEX_KEY,
        dropPayloadB64: payload,
        releasePayloadB64: payload,
      }),
    );
    expect(r.status).toBe(200);
    expect((await r.json()).wouldSeal).toBe(HEX_KEY);
  });

  it('acknowledges reply dry-run', async () => {
    const wire = Buffer.alloc(80, 1).toString('base64');
    const r = await replyDesk(postJson('http://localhost:3000/api/demo/reply?dryRun=1', { tipKey: HEX_KEY, wireB64: wire }));
    expect(r.status).toBe(200);
  });

  it('demo key without a server desk key is disabled', async () => {
    const prev = process.env.DESK_PRIVATE_KEY;
    delete process.env.DESK_PRIVATE_KEY;
    try {
      const r = await demoKey(getJson('http://localhost:3000/api/demo/desk/key'));
      expect(r.status).toBe(403);
      expect((await r.json()).error).toBe('demo_disabled');
    } finally {
      if (prev) process.env.DESK_PRIVATE_KEY = prev;
      else delete process.env.DESK_PRIVATE_KEY;
    }
  });
});
