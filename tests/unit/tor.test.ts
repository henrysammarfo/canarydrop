import { describe, expect, it } from 'vitest';
import { looksLikeTorBrowser, shouldShowTorBanner, TOR_BANNER } from '@/lib/tor';

describe('tor signals', () => {
  it('treats an onion host as Tor', () => {
    expect(looksLikeTorBrowser({ hostname: 'abc.onion' })).toBe(true);
    expect(shouldShowTorBanner({ hostname: 'abc.onion' })).toBe(false);
  });

  it('treats Tor Browser user agent text as Tor', () => {
    expect(looksLikeTorBrowser({ hostname: 'example.com', userAgent: 'Mozilla Tor Browser' })).toBe(true);
  });

  it('shows the banner for an ordinary host', () => {
    expect(shouldShowTorBanner({ hostname: 'canarydrop.vercel.app', userAgent: 'Chrome' })).toBe(true);
    expect(TOR_BANNER).toMatch(/Tor Browser/);
    expect(TOR_BANNER).not.toMatch(/[\u2013\u2014]/);
  });

  it('ignores empty signals', () => {
    expect(looksLikeTorBrowser({})).toBe(false);
    expect(shouldShowTorBanner({})).toBe(true);
  });
});
