import { test, expect } from '@playwright/test';

test('verify page links to canary submit explorer desk and how', async ({ page }) => {
  await page.goto('/verify', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /verify in 60 seconds/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /open canary/i })).toHaveAttribute('href', /\/canary\/0x/i);
  await expect(page.getByRole('link', { name: /submit a tip/i })).toHaveAttribute('href', '/submit');
  await expect(page.getByRole('link', { name: /open explorer/i })).toHaveAttribute('href', '/explorer');
  await expect(page.getByRole('link', { name: /open the desk/i })).toHaveAttribute('href', '/desk');
  await expect(page.locator('#main').getByRole('link', { name: /how we use arkiv/i })).toHaveAttribute('href', '/how');
});

test('verify canary link opens the public canary page', async ({ page }) => {
  await page.goto('/verify', { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: /open canary/i }).click();
  await expect(page).toHaveURL(/\/canary\/0x/i);
  await expect(page.getByRole('heading', { name: /canary status/i })).toBeVisible();
});
