import { describe, expect, it } from 'vitest';
import evidence from '@/arkiv/evidence.json';
import { inboxPageQueryText, queryPredicate, sealedTipsQueryText } from '@/lib/arkiv';
import { isFreshProofCache, seedTxLinks } from '@/lib/proofs';
import { CHAIN_READ_FAILED, DEFAULT_RELAY, PROJECT, PROOF_CACHE_MS, SEALED_OWNER, SEALED_TIPS_EMPTY } from '@/lib/constants';

describe('judge proofs helpers', () => {
  it('maps seed txs to explorer links', () => {
    const links = seedTxLinks();
    expect(links.length).toBe(evidence.txs.length);
    expect(links[0]?.href).toContain('/tx/');
    expect(links[0]?.href).toContain(evidence.txs[0]);
    expect(links.every((l) => l.label.startsWith('Seed write'))).toBe(true);
  });

  it('prints the sealed tips predicate without SELECT or LIMIT', () => {
    const text = sealedTipsQueryText();
    expect(text).toContain(`project = str('${PROJECT}')`);
    expect(text).toContain("type = str('tip')");
    expect(text.toLowerCase()).toContain(DEFAULT_RELAY.toLowerCase());
    expect(text.toLowerCase()).toContain(SEALED_OWNER.toLowerCase());
    expect(text).toMatch(/\$owner = addr\(/);
    expect(text).toMatch(/\$creator = addr\(/);
    expect(text).not.toMatch(/SELECT|LIMIT/i);
    expect(queryPredicate({ toString: () => text })).toBe(text);
  });

  it('prints the inbox predicate with burn ownership', () => {
    const desk = `0x${'ab'.repeat(32)}` as const;
    const text = inboxPageQueryText(desk);
    expect(text).toContain(`project = str('${PROJECT}')`);
    expect(text).toContain("type = str('tip')");
    expect(text.toLowerCase()).toContain(SEALED_OWNER.toLowerCase());
    expect(text).toMatch(/\$owner = addr\(/);
  });

  it('treats a 45 second proof cache as fresh, then stale', () => {
    expect(isFreshProofCache(1_000, 1_000 + PROOF_CACHE_MS - 1)).toBe(true);
    expect(isFreshProofCache(1_000, 1_000 + PROOF_CACHE_MS)).toBe(false);
    expect(isFreshProofCache(1_000, 500)).toBe(false);
  });

  it('uses plain English for chain read failures and empty sealed tips', () => {
    expect(CHAIN_READ_FAILED).toBe('Could not read Tiramisu right now. This page will try again on its own.');
    expect(CHAIN_READ_FAILED).not.toMatch(/ECONNRESET|stack|failed to fetch/i);
    expect(SEALED_TIPS_EMPTY).toMatch(/No live sealed tips/);
    expect(SEALED_TIPS_EMPTY).toMatch(/27 Oct 2026/);
  });
});
