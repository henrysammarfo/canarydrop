import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/tip/route';
import { DEFAULT_DESK } from '@/lib/constants';
import { getDesk } from '@/lib/arkiv';
import { HEX_KEY, postJson } from '../helpers/request';

describe('tip dry-run against Tiramisu', () => {
  it('refuses a random key that is not a desk', async () => {
    const wire = Buffer.alloc(80, 1).toString('base64');
    const r = await POST(
      postJson('http://localhost:3000/api/tip?dryRun=1', {
        deskKey: HEX_KEY,
        wireB64: wire,
        lifetime: '24h',
      }),
    );
    const j = await r.json();
    expect(r.status).toBe(400);
    expect(j.error).toBe('no_desk');
    expect(String(j.message)).not.toMatch(/stack|Ident32|private/i);
  });

  it('predicts a tip key when the demo desk is live', async () => {
    const desk = await getDesk(DEFAULT_DESK);
    if (!desk) {
      expect(desk).toBeUndefined();
      return;
    }
    const wire = Buffer.alloc(80, 1).toString('base64');
    const r = await POST(
      postJson('http://localhost:3000/api/tip?dryRun=1', {
        deskKey: desk.key,
        wireB64: wire,
        lifetime: '24h',
      }),
    );
    const j = await r.json();
    expect(r.status).toBe(200);
    expect(j.dryRun).toBe(true);
    expect(String(j.predictedTipKey)).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });
});
