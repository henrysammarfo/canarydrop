import { describe, expect, it } from 'vitest';
import { csrfCookieHeader, newCsrfToken, tokensMatch } from '@/lib/csrf';

describe('csrf tokens', () => {
  it('creates a 32 byte hex token', () => {
    const token = newCsrfToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('creates distinct tokens', () => {
    expect(newCsrfToken()).not.toBe(newCsrfToken());
  });

  it('matches equal tokens', () => {
    expect(tokensMatch('abcdefghijklmnop', 'abcdefghijklmnop')).toBe(true);
  });

  it('rejects missing values', () => {
    expect(tokensMatch(null, 'abcdefghijklmnop')).toBe(false);
    expect(tokensMatch('abcdefghijklmnop', null)).toBe(false);
    expect(tokensMatch('', '')).toBe(false);
  });

  it('rejects short tokens', () => {
    expect(tokensMatch('short', 'short')).toBe(false);
  });

  it('rejects different lengths', () => {
    expect(tokensMatch('abcdefghijklmnop', 'abcdefghijklmnopq')).toBe(false);
  });

  it('rejects a one character change', () => {
    const a = 'a'.repeat(32);
    const b = 'b' + 'a'.repeat(31);
    expect(tokensMatch(a, b)).toBe(false);
  });

  it('sets SameSite=Lax on the cookie', () => {
    expect(csrfCookieHeader('tok', true)).toContain('SameSite=Lax');
    expect(csrfCookieHeader('tok', true)).toContain('Secure');
    expect(csrfCookieHeader('tok', false)).not.toContain('Secure');
  });
});
