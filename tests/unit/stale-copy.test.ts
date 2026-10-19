import { describe, expect, it } from 'vitest';
import { showingDataFrom } from '@/lib/stale-copy';

describe('showingDataFrom', () => {
  it('uses seconds under 90', () => {
    expect(showingDataFrom(1_000)).toBe('Showing data from 1 second ago.');
    expect(showingDataFrom(40_000)).toBe('Showing data from 40 seconds ago.');
  });

  it('uses minutes after that', () => {
    expect(showingDataFrom(120_000)).toBe('Showing data from 2 minutes ago.');
  });

  it('has no en or em dashes', () => {
    expect(showingDataFrom(40_000)).not.toMatch(/[\u2013\u2014]/);
  });
});
