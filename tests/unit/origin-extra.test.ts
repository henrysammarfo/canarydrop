import { describe, expect, it } from 'vitest';
import { isAllowedHostname, originAllowed, parseOrigin } from '@/lib/origin';

describe('origin extra cases', () => {
  it('allows localhost without a port', () => {
    expect(originAllowed('http://localhost')).toBe(true);
    expect(originAllowed('http://127.0.0.1')).toBe(true);
  });

  it('allows production with an explicit 443 port in the header', () => {
    expect(originAllowed('https://canarydrop.vercel.app:443')).toBe(true);
  });

  it('allows a git preview host', () => {
    expect(originAllowed('https://canarydrop-git-v2-hardening-henrysammarfo.vercel.app')).toBe(true);
  });

  it('rejects a canarydrop prefix on another domain', () => {
    expect(originAllowed('https://canarydrop.example')).toBe(false);
    expect(originAllowed('https://canarydrop.vercel.app.attacker.tld')).toBe(false);
  });

  it('rejects whitespace around a good host after trim of empty', () => {
    expect(originAllowed(' https://canarydrop.vercel.app ')).toBe(true);
  });

  it('rejects a relative origin', () => {
    expect(parseOrigin('/api/tip')).toBeNull();
    expect(originAllowed('/api/tip')).toBe(false);
  });

  it('rejects javascript and file schemes', () => {
    expect(originAllowed('javascript:alert(1)')).toBe(false);
    expect(originAllowed('file://localhost')).toBe(false);
  });

  it('does not allow other loopback names', () => {
    expect(isAllowedHostname('0.0.0.0')).toBe(false);
    expect(isAllowedHostname('::1')).toBe(false);
    expect(isAllowedHostname('localhost.localdomain')).toBe(false);
  });
});
