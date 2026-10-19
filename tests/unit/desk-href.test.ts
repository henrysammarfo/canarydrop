import { describe, expect, it } from 'vitest';
import { DEFAULT_DESK, DEFAULT_IMPOSTOR } from '@/lib/constants';
import { canaryHref, parseDeskQuery, publicDeskHref } from '@/lib/desk-href';

describe('query desk routes', () => {
  it('builds query hrefs the static mirror can open', () => {
    expect(canaryHref(DEFAULT_IMPOSTOR)).toBe(`/canary?desk=${DEFAULT_IMPOSTOR}`);
    expect(publicDeskHref(DEFAULT_DESK)).toBe(`/d?desk=${DEFAULT_DESK}`);
  });

  it('parses a desk query or falls back', () => {
    expect(parseDeskQuery(DEFAULT_IMPOSTOR)).toBe(DEFAULT_IMPOSTOR);
    expect(parseDeskQuery('nope')).toBe(DEFAULT_DESK);
    expect(parseDeskQuery(null)).toBe(DEFAULT_DESK);
  });
});
