import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { DEFAULT_DESK } from '@/lib/constants';
import { getJson } from '../helpers/request';

vi.mock('@/lib/live-read', () => ({
  loadDeskLive: vi.fn(async () => ({
    ok: true,
    creator: DEFAULT_DESK,
    deskKey: `0x${'1f'.repeat(32)}`,
    canaryKey: `0x${'3c'.repeat(32)}`,
    alive: true,
    name: 'CanaryDrop Demo Desk',
    deskPubB64: 'BA==',
    expiresAt: '200',
    createdAt: '50',
    currentBlock: '100',
    blockDuration: 2,
  })),
  loadInboxLive: vi.fn(async () => ({
    ok: true,
    tips: [
      { key: `0x${'ab'.repeat(32)}`, createdAt: '9', payloadB64: 'YQ==', owner: DEFAULT_DESK },
    ],
    cursor: null,
    atBlock: '100',
    hasMore: false,
  })),
  loadExplorerLive: vi.fn(async () => ({
    ok: true,
    items: [],
    cursor: null,
    atBlock: '100',
    hasMore: false,
    currentBlock: '100',
    blockDuration: 2,
    canonicalDeskKey: `0x${'1f'.repeat(32)}`,
  })),
}));

const { GET } = await import('@/app/api/desk/live/route');
const { GET: inboxGet } = await import('@/app/api/desk/inbox/route');
const { GET: explorerGet } = await import('@/app/api/explorer/route');

afterEach(() => {
  vi.clearAllMocks();
});

describe('desk live routes', () => {
  it('rejects a missing origin without same-origin fetch metadata', async () => {
    const r = await GET(
      new NextRequest('http://localhost:3000/api/desk/live', {
        method: 'GET',
        headers: { cookie: 'cd_csrf=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
      }),
    );
    expect(r.status).toBe(403);
    expect((await r.json()).error).toBe('bad_origin');
  });

  it('rejects an invalid creator', async () => {
    const r = await GET(getJson('http://localhost:3000/api/desk/live?creator=not-an-address'));
    expect(r.status).toBe(400);
  });

  it('returns the canonical desk snapshot', async () => {
    const r = await GET(getJson(`http://localhost:3000/api/desk/live?creator=${DEFAULT_DESK}`));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(j.alive).toBe(true);
    expect(j.deskKey).toMatch(/^0x1f/);
    expect(j.jwk).toBeUndefined();
    expect(JSON.stringify(j)).not.toMatch(/"d":/);
  });

  it('rejects a missing desk key on inbox', async () => {
    const r = await inboxGet(getJson('http://localhost:3000/api/desk/inbox'));
    expect(r.status).toBe(400);
  });

  it('returns inbox rows for a valid desk key', async () => {
    const r = await inboxGet(getJson(`http://localhost:3000/api/desk/inbox?deskKey=0x${'ab'.repeat(32)}`));
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.tips).toHaveLength(1);
    expect(j.tips[0].payloadB64).toBe('YQ==');
  });

  it('rejects an unknown explorer filter', async () => {
    const r = await explorerGet(getJson('http://localhost:3000/api/explorer?filter=nope'));
    expect(r.status).toBe(400);
  });
});
