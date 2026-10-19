import { describe, expect, it } from 'vitest';
import { parseDeskPayload } from '@/lib/payload';

function deskBytes(extra: Record<string, unknown> = {}) {
  return new TextEncoder().encode(
    JSON.stringify({
      name: 'Desk',
      pub: Array.from({ length: 65 }, (_, i) => i),
      ...extra,
    }),
  );
}

describe('desk payload domain', () => {
  it('keeps a valid domain', () => {
    const parsed = parseDeskPayload(deskBytes({ domain: 'News.Example.com' }));
    expect(parsed?.domain).toBe('news.example.com');
  });

  it('drops an invalid domain', () => {
    expect(parseDeskPayload(deskBytes({ domain: 'no spaces allowed' }))?.domain).toBeUndefined();
    expect(parseDeskPayload(deskBytes({ domain: '' }))?.domain).toBeUndefined();
  });
});
