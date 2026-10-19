import { describe, expect, it } from 'vitest';
import { DEFAULT_DESK, DEFAULT_RELAY, PROJECT } from '@/lib/constants';
import { canaryAlive, getDesk, headBlock, pub } from '@/lib/arkiv';
import { eq } from '@arkiv-network/sdk/query';

describe('arkiv read-only against Tiramisu', () => {
  it('reads block timing', async () => {
    const t = await pub().getBlockTiming();
    expect(typeof t.currentBlock).toBe('bigint');
    expect(t.blockDuration).toBeGreaterThan(0);
    expect(await headBlock()).toBe(t.currentBlock);
  });

  it('counts entities', async () => {
    const n = await pub().getEntityCount();
    expect(n).toBeGreaterThan(0);
  });

  it('loads the demo desk by createdBy', async () => {
    const desk = await getDesk(DEFAULT_DESK);
    if (!desk) {
      expect(desk).toBeUndefined();
      return;
    }
    expect(desk.key).toMatch(/^0x[0-9a-fA-F]{64}$/);
    const canary = await canaryAlive(DEFAULT_DESK, desk.key);
    if (canary) expect(canary.key).toMatch(/^0x/);
  });

  it('lists tips created by the relay', async () => {
    const page = await pub()
      .select({ key: true, owner: true })
      .where(eq('project', PROJECT), eq('type', 'tip'))
      .createdBy(DEFAULT_RELAY)
      .limit(20)
      .fetch();
    expect(page.blockNumber).toBeGreaterThan(0n);
    expect(Array.isArray(page.entities)).toBe(true);
  });
});
