import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('renew.mjs', () => {
  it('extends live dead drop holds with the canary', () => {
    const src = fs.readFileSync(path.resolve('scripts/renew.mjs'), 'utf8');
    expect(src).toContain('liveHoldKeys');
    expect(src).toContain('holdKeys: plan.holdKeys');
    expect(src).toContain('renew(');
    expect(src).not.toMatch(/[\u2013\u2014]/);
  });

  it('seed renew also extends live holds', () => {
    const src = fs.readFileSync(path.resolve('scripts/seed-testnet.mjs'), 'utf8');
    expect(src).toContain("eq('type', 'hold')");
    expect(src).toContain('holdKeys.map');
  });
});
