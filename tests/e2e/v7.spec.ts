import { test, expect } from '@playwright/test';

test('landing has one tip sentence and one canary sentence', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#hero .lead').first()).toHaveText(
    'Your tip is locked on your device and only the newsroom can open it.',
  );
  await expect(page.locator('#hero .lead').nth(1)).toHaveText(
    'If the newsroom goes quiet the canary dies on its own.',
  );
});

test('threat page states what Arkiv does not hide', async ({ page }) => {
  await page.goto('/threat', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /threat model and limits/i })).toBeVisible();
  await expect(page.getByText(/Use Tor Browser/i)).toBeVisible();
  await expect(page.getByText(/Ciphertext size/i)).toBeVisible();
  await expect(page.locator('.tor-banner')).toBeVisible();
});

test('how page documents the static build', async ({ page }) => {
  await page.goto('/how', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#static-build')).toBeVisible();
  await expect(page.locator('#static-build')).toContainText('npm run build:static');
});

test('submit offers send without the sponsor', async ({ page }) => {
  await page.goto('/submit', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Send without the sponsor')).toBeVisible();
  await expect(page.getByText('Use the sponsor')).toBeVisible();
});

test('demo dead drop page is synthetic', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/desk/drop', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Dead drop' })).toBeVisible();
  await expect(page.getByText(/synthetic data only/i)).toBeVisible();
  await expect(page.getByText('Synthetic hold statement')).toBeVisible();
});

test('settings shows Ethereum sign in', async ({ page }) => {
  await page.goto('/desk/settings', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Sign in with Ethereum' })).toBeVisible();
});

test('public canary has a signature checker', async ({ page }) => {
  await page.goto('/canary/0x1da3c22c079c264536D831F6F1fCe638aB0b20B0', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Check signature' })).toBeVisible();
});

test('well known desk record is served', async ({ request }) => {
  const res = await request.get('/.well-known/canarydrop.json');
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { v: number; desk: string };
  expect(body.v).toBe(1);
  expect(body.desk.toLowerCase()).toBe('0x1da3c22c079c264536d831f6f1fce638ab0b20b0');
});
