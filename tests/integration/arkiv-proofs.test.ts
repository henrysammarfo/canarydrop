import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_RELAY, PROJECT, SEALED_TIPS_EMPTY } from '@/lib/constants';
import {
  chainEntityCount,
  explorerPage,
  mintNonce,
  sealedTips,
  tipsOrCanaries,
} from '@/lib/arkiv';
import { attrStr } from '@/lib/attr';
import { isSealedOwner } from '@/lib/chain';
import { clearArkivProofsCache, gatherArkivProofs } from '@/lib/proofs';

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

describe('deeper Arkiv reads against Tiramisu', () => {
  beforeEach(() => {
    clearArkivProofsCache();
  });

  it('lists sealed tips owned by the burn address', async () => {
    const page = await retryRead(() => sealedTips());
    expect(page.blockNumber).toBeGreaterThan(0n);
    expect(typeof page.hasNextPage).toBe('function');
    for (const row of page.entities) {
      expect(isSealedOwner(row.owner)).toBe(true);
      expect(row.creator?.toLowerCase()).toBe(DEFAULT_RELAY.toLowerCase());
      if (row.creationFlags) {
        expect(row.creationFlags.readonly).toBe(true);
        expect(row.creationFlags.permissionlessExtension).toBe(false);
      }
    }
  });

  it('explorer sealed filter only returns CanaryDrop tips from the sponsor', async () => {
    const sealed = await retryRead(() => sealedTips());
    const page = await retryRead(() => explorerPage({ kind: 'tip', sealed: true }));
    expect(page.blockNumber).toBeGreaterThan(0n);
    const sealedKeys = sealed.entities.map((e) => e.key).sort();
    const pageKeys = page.entities.map((e) => e.key).sort();
    expect(pageKeys).toEqual(sealedKeys);
    for (const row of page.entities) {
      expect(attrStr(row.attributes, 'type')).toBe('tip');
      expect(row.creator?.toLowerCase()).toBe(DEFAULT_RELAY.toLowerCase());
      expect(isSealedOwner(row.owner)).toBe(true);
    }
  });

  it('or() can mix tips and canaries', async () => {
    const page = await retryRead(() => tipsOrCanaries());
    expect(page.entities.length).toBeGreaterThan(0);
    expect(page.blockNumber).toBeGreaterThan(0n);
  });

  it('entity mint nonce is a bigint for the sponsor', async () => {
    const nonce = await retryRead(() => mintNonce(DEFAULT_RELAY));
    expect(typeof nonce).toBe('bigint');
    expect(nonce).toBeGreaterThanOrEqual(0n);
  });

  it('getEntityCount is the whole chain, not one project page', async () => {
    const n = await retryRead(() => chainEntityCount());
    const page = await retryRead(() => explorerPage());
    expect(n).toBeGreaterThan(page.entities.length);
    expect(n).toBeGreaterThan(1000);
  });

  it('gatherArkivProofs returns live claims with explorer links', async () => {
    const proofs = await retryRead(async () => {
      clearArkivProofsCache();
      const next = await gatherArkivProofs();
      const owned = next.claims.find((c) => c.id === 'ownedBy');
      if (!owned?.ok) throw new Error(owned?.detail ?? 'ownedBy not live');
      return next;
    });
    const ids = proofs.claims.map((c) => c.id);
    for (const id of ['createdBy', 'ownedBy', 'impostor', 'slot', 'nonce', 'or', 'count', 'batch', 'watch']) {
      expect(ids).toContain(id);
    }
    const owned = proofs.claims.find((c) => c.id === 'ownedBy');
    expect(owned?.query).toContain(PROJECT);
    expect(owned?.query).toMatch(/\$owner = addr\(/);
    expect(owned?.query).toMatch(/\$creator = addr\(/);
    expect(owned?.ok).toBe(true);
    expect(owned?.detail === SEALED_TIPS_EMPTY || /live sealed tips/i.test(owned?.detail ?? '')).toBe(true);
    expect(proofs.seedTxs.length).toBeGreaterThan(0);
    expect(proofs.head).toMatch(/^\d+$/);
  });
});
