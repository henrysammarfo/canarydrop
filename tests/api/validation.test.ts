import { describe, expect, it } from 'vitest';
import { POST as tip } from '@/app/api/tip/route';
import { POST as reply } from '@/app/api/demo/reply/route';
import { HEX_KEY, postJson } from '../helpers/request';

describe('validators', () => {
  it('rejects oversize ciphertext', async () => {
    const big = 'A'.repeat(70000);
    const r = await tip(postJson('http://localhost:3000/api/tip?dryRun=1', { deskKey: HEX_KEY, wireB64: big, lifetime: '24h' }));
    expect(r.status).toBe(400);
    expect((await r.json()).error).toBe('too_large');
  });

  it('rejects bad hex', async () => {
    const r = await tip(postJson('http://localhost:3000/api/tip?dryRun=1', { deskKey: '0xXYZ', wireB64: 'AA==', lifetime: '24h' }));
    expect(r.status).toBe(400);
  });

  it('rejects extra fields', async () => {
    const r = await tip(
      postJson('http://localhost:3000/api/tip?dryRun=1', {
        deskKey: HEX_KEY,
        wireB64: 'AA==',
        lifetime: '24h',
        extra: 1,
      }),
    );
    expect(r.status).toBe(400);
  });

  it('rejects a short reply wire', async () => {
    const r = await reply(postJson('http://localhost:3000/api/demo/reply?dryRun=1', { tipKey: HEX_KEY, wireB64: 'AA==' }));
    expect([400, 403]).toContain(r.status);
  });
});
