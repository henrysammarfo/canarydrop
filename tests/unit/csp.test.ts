import { describe, expect, it } from 'vitest';
import { buildCsp, cspAllowsUnsafeEval, cspAllowsUnsafeInlineScript } from '@/lib/csp';

describe('csp', () => {
  const header = buildCsp('abc123');

  it('includes the nonce', () => {
    expect(header).toContain(`'nonce-abc123'`);
    expect(header).toContain(`'strict-dynamic'`);
  });

  it('does not allow unsafe-eval', () => {
    expect(cspAllowsUnsafeEval(header)).toBe(false);
    expect(header).not.toContain('unsafe-eval');
  });

  it('does not use bare unsafe-inline for scripts', () => {
    expect(cspAllowsUnsafeInlineScript(header)).toBe(false);
  });

  it('allowlists Tiramisu RPC only on connect-src', () => {
    expect(header).toContain('https://rpc.tiramisu.db-chain.testnet.arkiv.network');
    expect(header).toContain('wss://rpc.tiramisu.db-chain.testnet.arkiv.network');
    const connect = header.split(';').find((part) => part.trim().startsWith('connect-src')) ?? '';
    expect(connect).toContain("'self'");
    expect(connect).not.toMatch(/(^|\s)https:(;|\s|$)/);
    expect(connect).not.toContain('*');
  });

  it('blocks frames and objects', () => {
    expect(header).toContain("frame-ancestors 'none'");
    expect(header).toContain("object-src 'none'");
    expect(header).toContain("base-uri 'self'");
  });

  it('keeps style-src unsafe-inline because React sets element styles', () => {
    expect(header).toContain("style-src 'self' 'unsafe-inline'");
  });

  it('flags a legacy header as unsafe', () => {
    const legacy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'";
    expect(cspAllowsUnsafeEval(legacy)).toBe(true);
    expect(cspAllowsUnsafeInlineScript(legacy)).toBe(true);
  });

  it('does not wildcard connect-src', () => {
    expect(header).not.toContain('connect-src *');
    expect(header).toContain("worker-src 'none'");
    expect(header).toContain('upgrade-insecure-requests');
  });
});
