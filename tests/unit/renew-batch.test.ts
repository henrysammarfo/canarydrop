import { describe, expect, it, vi } from 'vitest';
import type { Hex } from 'viem';
import { coreRenewExtensions, holdRenewExtensions, renew, type Wallet } from '@/lib/arkiv';

const desk = `0x${'11'.repeat(32)}` as Hex;
const canary = `0x${'22'.repeat(32)}` as Hex;
const hold = `0x${'33'.repeat(32)}` as Hex;
const otherHold = `0x${'44'.repeat(32)}` as Hex;
const tx = `0x${'aa'.repeat(32)}` as Hex;

describe('renew batches', () => {
  it('keeps canary and desk in the core batch', () => {
    const core = coreRenewExtensions(canary, desk);
    expect(core.map((row) => row.entityKey)).toEqual([canary, desk]);
    expect(holdRenewExtensions([hold, otherHold]).map((row) => row.entityKey)).toEqual([hold, otherHold]);
    expect(core.some((row) => row.entityKey === hold)).toBe(false);
  });

  it('still returns the canary write when a later hold extension fails', async () => {
    const executeBatch = vi
      .fn()
      .mockResolvedValueOnce({ txHash: tx })
      .mockRejectedValueOnce(new Error('no entity'));
    const w = { executeBatch } as unknown as Wallet;
    const out = await renew(w, desk, canary, { nonce: 7 }, { holdKeys: [hold] });
    expect(out.txHash).toBe(tx);
    expect(executeBatch).toHaveBeenCalledTimes(2);
    const coreOps = executeBatch.mock.calls[0]?.[0] as {
      creates?: unknown[];
      extensions: { entityKey: Hex }[];
    };
    const holdOps = executeBatch.mock.calls[1]?.[0] as { extensions: { entityKey: Hex }[] };
    expect(coreOps.creates).toBeUndefined();
    expect(coreOps.extensions.map((row) => row.entityKey)).toEqual([canary, desk]);
    expect(holdOps.extensions.map((row) => row.entityKey)).toEqual([hold]);
    expect(executeBatch.mock.calls[1]?.[1]).toEqual({ nonce: 8 });
  });
});
