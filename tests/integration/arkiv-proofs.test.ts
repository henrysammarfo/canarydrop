import { describe, expect, it } from 'vitest';
import { DEFAULT_RELAY, PROJECT, SEALED_OWNER } from '@/lib/constants';
import {
  chainEntityCount,
  explorerPage,
  mintNonce,
  sealedTips,
  tipsOrCanaries,
} from '@/lib/arkiv';
import { isSealedOwner } from '@/lib/chain';
import { gatherArkivProofs } from '@/lib/proofs';

describe('deeper Arkiv reads against Tiramisu', () => {
  it('lists sealed tips owned by the burn address', async () => {
    const page = await sealedTips();
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

  it('explorer sealed filter only returns burn owned tips', async () => {
    const page = await explorerPage({ kind: 'tip', sealed: true });
    expect(page.blockNumber).toBeGreaterThan(0n);
    for (const row of page.entities) {
      expect(isSealedOwner(row.owner)).toBe(true);
    }
  });

  it('or() can mix tips and canaries', async () => {
    const page = await tipsOrCanaries();
    expect(page.entities.length).toBeGreaterThan(0);
    expect(page.blockNumber).toBeGreaterThan(0n);
  });

  it('entity mint nonce is a bigint for the sponsor', async () => {
    const nonce = await mintNonce(DEFAULT_RELAY);
    expect(typeof nonce).toBe('bigint');
    expect(nonce).toBeGreaterThanOrEqual(0n);
  });

  it('getEntityCount is the whole chain, not one project page', async () => {
    const n = await chainEntityCount();
    const page = await explorerPage();
    expect(n).toBeGreaterThan(page.entities.length);
    expect(n).toBeGreaterThan(1000);
  });

  it('gatherArkivProofs returns live claims with explorer links', async () => {
    const proofs = await gatherArkivProofs();
    const ids = proofs.claims.map((c) => c.id);
    for (const id of ['createdBy', 'ownedBy', 'impostor', 'slot', 'nonce', 'or', 'count', 'batch', 'watch']) {
      expect(ids).toContain(id);
    }
    const owned = proofs.claims.find((c) => c.id === 'ownedBy');
    expect(owned?.query).toContain(PROJECT);
    expect(owned?.query).toMatch(/\$owner = addr\(/);
    expect(proofs.seedTxs.length).toBeGreaterThan(0);
    expect(proofs.head).toMatch(/^\d+$/);
  });
});
