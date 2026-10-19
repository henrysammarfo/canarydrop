import { test, expect } from '@playwright/test';

test('desk page has a single main landmark', async ({ page }) => {
  await page.goto('/desk', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.locator('main#main')).toBeVisible();
});

test('demo key GET from a real page is not blocked as a missing Origin', async ({ page }) => {
  await page.goto('/desk', { waitUntil: 'domcontentloaded' });
  const result = await page.evaluate(async () => {
    const r = await fetch('/api/demo/desk/key', { method: 'GET', credentials: 'same-origin' });
    const j = (await r.json()) as { error?: string; ok?: boolean; jwk?: { crv?: string } };
    return { status: r.status, error: j.error ?? null, ok: j.ok === true, crv: j.jwk?.crv ?? null };
  });
  expect(result.error, 'real-browser GET must not be bad_origin').not.toBe('bad_origin');
  expect([200, 403]).toContain(result.status);
  if (result.status === 200) {
    expect(result.ok).toBe(true);
    expect(result.crv).toBe('P-256');
  } else {
    expect(result.error).toBe('demo_disabled');
  }
});

test('desk demo mode toggle is usable without a wallet', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/desk', { waitUntil: 'load' });
  const demo = page.locator('label.badge', { hasText: 'Demo mode' });
  await expect(demo).toBeVisible();
  const box = demo.locator('input[type="checkbox"]');
  if (!(await box.isChecked())) await box.check();
  await expect(page.getByText(/Demo mode is on/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Please use the site to send this request/i)).toHaveCount(0);
  await page.getByRole('button', { name: 'inbox' }).click();
  await expect(page.getByText(/Older tips load from Arkiv/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /load older tips/i })).toBeVisible();
});
