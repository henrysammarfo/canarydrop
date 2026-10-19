import { test, expect } from '@playwright/test';

test('how page shows live Arkiv claims', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/how', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /how canarydrop uses arkiv/i })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /Latest block/i })).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('#ownedBy')).toBeVisible();
  await expect(page.locator('#createdBy')).toBeVisible();
  await expect(page.locator('#ownedBy .query-box')).toContainText('$owner');
  await expect(page.getByRole('link', { name: /seed write/i }).first()).toHaveAttribute('href', /tiramisu\.explorer\.arkiv\.network\/tx\//);
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/[\u2013\u2014]/);
});

test('how page skip target is the main landmark', async ({ page }) => {
  await page.goto('/how', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('a.skip-link')).toHaveAttribute('href', '#main');
  await expect(page.locator('main#main')).toBeVisible();
});
