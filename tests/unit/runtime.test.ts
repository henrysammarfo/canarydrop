import { describe, expect, it } from 'vitest';
import { isStaticExport, publicBasePath, sameOriginApi, withBasePath } from '@/lib/runtime';

describe('runtime flags', () => {
  it('defaults to the server path', () => {
    expect(isStaticExport()).toBe(false);
    expect(sameOriginApi()).toBe(true);
    expect(publicBasePath()).toBe('');
    expect(withBasePath('/how')).toBe('/how');
  });

  it('prefixes a custom base path', () => {
    const prev = process.env.NEXT_PUBLIC_BASE_PATH;
    process.env.NEXT_PUBLIC_BASE_PATH = '/canarydrop';
    expect(publicBasePath()).toBe('/canarydrop');
    expect(withBasePath('/how')).toBe('/canarydrop/how');
    expect(withBasePath('/canarydrop/how')).toBe('/canarydrop/how');
    if (prev === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
    else process.env.NEXT_PUBLIC_BASE_PATH = prev;
  });

  it('treats STATIC_EXPORT as static', () => {
    const prev = process.env.STATIC_EXPORT;
    process.env.STATIC_EXPORT = '1';
    expect(isStaticExport()).toBe(true);
    expect(sameOriginApi()).toBe(false);
    if (prev === undefined) delete process.env.STATIC_EXPORT;
    else process.env.STATIC_EXPORT = prev;
  });
});
