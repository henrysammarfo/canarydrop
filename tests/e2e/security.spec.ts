import { test, expect } from '@playwright/test';

test('home CSP has no unsafe-eval and carries a script nonce', async ({ request }) => {
  const res = await request.get('/');
  expect(res.ok()).toBeTruthy();
  const csp = res.headers()['content-security-policy'] ?? '';
  expect(csp, 'missing CSP').not.toBe('');
  expect(csp).not.toContain('unsafe-eval');
  expect(csp).toMatch(/nonce-/);
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain('rpc.tiramisu.db-chain.testnet.arkiv.network');
});

test('tip API rejects a request with no origin', async ({ request }) => {
  const res = await request.post('/api/tip?dryRun=1', {
    data: { deskKey: `0x${'a'.repeat(64)}`, wireB64: 'AA==', lifetime: '24h' },
    headers: { origin: '' },
  });
  expect([400, 403]).toContain(res.status());
});

test('verify page has the 60 second path', async ({ page }) => {
  await page.goto('/verify', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /verify in 60 seconds/i })).toBeVisible();
  await expect(page.getByText(/you do not need a wallet/i)).toBeVisible();
});

test('home sets a csrf cookie', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const cookies = await context.cookies();
  expect(cookies.some((c) => c.name === 'cd_csrf' && c.value.length >= 16)).toBeTruthy();
});

test('demo key route is origin guarded', async ({ request }) => {
  const res = await request.get('/api/demo/desk/key');
  expect([200, 403]).toContain(res.status());
  const j = await res.json();
  if (res.status() === 200) {
    expect(j.jwk.crv).toBe('P-256');
  } else {
    expect(String(j.error)).toMatch(/bad_origin|demo_disabled/);
  }
});
