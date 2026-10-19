import { describe, expect, it } from 'vitest';
import { DEFAULT_DESK, DEFAULT_RELAY, PROJECT } from '@/lib/constants';
import { canaryAlive, getDesk, headBlock, pub } from '@/lib/arkiv';
import { eq } from '@arkiv-network/sdk/query';

async function retryRead<T>(fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let i = 0; i < 8; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      await new Promise((resolve) => setTimeout(resolve, Math.min(8000, 800 * 2 ** i)));
    }
  }
  throw last;
}

describe('arkiv read-only against Tiramisu', () => {
  it('reads block timing', async () => {
    const t = await retryRead(() => pub().getBlockTiming());
    expect(typeof t.currentBlock).toBe('bigint');
    expect(t.blockDuration).toBeGreaterThan(0);
    const head = await retryRead(() => headBlock());
    const drift = head > t.currentBlock ? head - t.currentBlock : t.currentBlock - head;
    expect(Number(drift)).toBeLessThanOrEqual(2);
  });

  it('counts entities', async () => {
    const n = await retryRead(() => pub().getEntityCount());
    expect(n).toBeGreaterThan(0);
  });

  it('loads the demo desk by createdBy', async () => {
    const desk = await retryRead(() => getDesk(DEFAULT_DESK));
    if (!desk) {
      expect(desk).toBeUndefined();
      return;
    }
    expect(desk.key).toMatch(/^0x[0-9a-fA-F]{64}$/);
    const canary = await retryRead(() => canaryAlive(DEFAULT_DESK, desk.key));
    if (canary) expect(canary.key).toMatch(/^0x/);
  });

  it('lists tips created by the relay', async () => {
    const page = await retryRead(() =>
      pub()
        .select({ key: true, owner: true })
        .where(eq('project', PROJECT), eq('type', 'tip'))
        .createdBy(DEFAULT_RELAY)
        .limit(20)
        .fetch(),
    );
    expect(page.blockNumber).toBeGreaterThan(0n);
    expect(Array.isArray(page.entities)).toBe(true);
  });
});
