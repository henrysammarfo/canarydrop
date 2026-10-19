import { describe, expect, it } from 'vitest';
import { isAllowedHostname, originAllowed, originIncludesHost, parseOrigin } from '@/lib/origin';

describe('origin allow list', () => {
  it('rejects missing origin', () => {
    expect(originAllowed(null)).toBe(false);
    expect(originAllowed(undefined)).toBe(false);
    expect(originAllowed('')).toBe(false);
    expect(originAllowed('   ')).toBe(false);
  });

  it('allows localhost http', () => {
    expect(originAllowed('http://localhost:3000')).toBe(true);
    expect(originAllowed('http://127.0.0.1:3000')).toBe(true);
  });

  it('allows production host', () => {
    expect(originAllowed('https://canarydrop.vercel.app')).toBe(true);
  });

  it('rejects a github.io Origin so it never reaches CSRF', () => {
    expect(originAllowed('https://henrysammarfo.github.io')).toBe(false);
    expect(isAllowedHostname('henrysammarfo.github.io')).toBe(false);
  });

  it('does not treat the static mirror as a write Origin', () => {
    expect(originAllowed('https://canarydrop-static.vercel.app')).toBe(false);
  });

  it('allows this team preview host', () => {
    expect(originAllowed('https://canarydrop-git-v7-double-down-teamtitanlink.vercel.app')).toBe(true);
  });

  it('rejects a canarydrop preview on another Vercel team', () => {
    expect(originAllowed('https://canarydrop-git-v2-hardening-user.vercel.app')).toBe(false);
  });

  it('rejects a sibling vercel app', () => {
    expect(originAllowed('https://notcanarydrop.vercel.app')).toBe(false);
    expect(originAllowed('https://evil.vercel.app')).toBe(false);
  });

  it('rejects the includes() bypass used on main', () => {
    const forged = 'https://canarydrop.vercel.app.evil.com';
    expect(originIncludesHost(forged, 'canarydrop.vercel.app')).toBe(true);
    expect(originAllowed(forged)).toBe(false);
  });

  it('rejects localhost substring in another host', () => {
    const forged = 'https://localhost.attacker.example';
    expect(originIncludesHost(forged, 'localhost')).toBe(true);
    expect(originAllowed(forged)).toBe(false);
  });

  it('rejects credentials in the origin', () => {
    expect(originAllowed('https://user:pass@canarydrop.vercel.app')).toBe(false);
  });

  it('rejects ftp and data urls', () => {
    expect(originAllowed('ftp://localhost')).toBe(false);
    expect(originAllowed('data:text/plain,hello')).toBe(false);
  });

  it('parseOrigin returns a URL for valid origins', () => {
    const url = parseOrigin('https://canarydrop.vercel.app');
    expect(url?.hostname).toBe('canarydrop.vercel.app');
  });

  it('isAllowedHostname is case insensitive', () => {
    expect(isAllowedHostname('LOCALHOST')).toBe(true);
    expect(isAllowedHostname('CanaryDrop.vercel.app')).toBe(true);
  });
});
