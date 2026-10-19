import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildStaticCsp } from '@/lib/csp';

describe('static mirror Vercel project', () => {
  const raw = readFileSync(new URL('../../vercel.static.json', import.meta.url), 'utf8');
  const config = JSON.parse(raw) as {
    buildCommand?: string;
    outputDirectory?: string;
    framework?: string | null;
    headers?: { source: string; headers: { key: string; value: string }[] }[];
    functions?: unknown;
    rewrites?: unknown;
  };

  it('builds only the static export into out/', () => {
    expect(config.buildCommand).toBe('npm run build:static');
    expect(config.outputDirectory).toBe('out');
    expect(config.framework).toBeNull();
    expect(config.functions).toBeUndefined();
  });

  it('sets CSP and no-referrer as real headers', () => {
    const headers = config.headers?.[0]?.headers ?? [];
    const csp = headers.find((h) => h.key === 'Content-Security-Policy')?.value;
    const referrer = headers.find((h) => h.key === 'Referrer-Policy')?.value;
    expect(csp).toBe(buildStaticCsp());
    expect(referrer).toBe('no-referrer');
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain('unsafe-eval');
  });
});
