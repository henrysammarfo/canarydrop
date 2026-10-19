import { describe, expect, it } from 'vitest';
import evidence from '@/arkiv/evidence.json';
import { queryPredicate, sealedTipsQueryText } from '@/lib/arkiv';
import { seedTxLinks } from '@/lib/proofs';
import { DEFAULT_RELAY, PROJECT, SEALED_OWNER } from '@/lib/constants';

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
});
