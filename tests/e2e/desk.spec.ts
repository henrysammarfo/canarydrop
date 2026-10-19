import { test, expect } from '@playwright/test';

test('overview keeps keys in one compact row', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/desk', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Desk identity')).toHaveCount(0);
  await expect(page.locator('.keys-bar')).toBeVisible();
  await expect(page.locator('.keys-bar').getByText('Creator')).toBeVisible();
});

test('overview canary card fills the lifetime gap when alive', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/desk', { waitUntil: 'load' });
  await page.getByText('Loading the live desk from Arkiv…').waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
  const alive = page.getByText(/^Alive$/);
  if ((await alive.count()) === 0) return;
  await expect(page.getByRole('progressbar', { name: /canary lifetime remaining/i })).toBeVisible();
  await expect(page.getByText(/of this lifetime is left/i)).toBeVisible();
  await expect(page.getByText(/Next renewal due|This lifetime has ended/i)).toBeVisible();
});

test('desk first visit does not toast a generic error', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/desk', { waitUntil: 'load' });
  await page.getByText('Loading the live desk from Arkiv…').waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
  await expect(page.getByText('Something went wrong. Please try again.')).toHaveCount(0);
  await expect(page.getByText('Demo mode is off.')).toHaveCount(0);
});

test('renew canary is hidden until a live canary exists', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/desk', { waitUntil: 'load' });
  await page.getByText('Loading the live desk from Arkiv…').waitFor({ state: 'hidden', timeout: 45_000 }).catch(() => undefined);
  const renew = page.getByRole('button', { name: /^Renew canary$/ });
  if ((await renew.count()) > 0) {
    await expect(renew.first()).toBeEnabled();
  } else {
    await expect(
      page.getByText(/no live canary to renew|no live canary yet|Checking the live canary|Still reading the live canary/i),
    ).toBeVisible();
  }
});

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

test('create demo desk shows a success notice and drops the stale key warning', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/desk', { waitUntil: 'load' });
  const demo = page.locator('label.badge', { hasText: 'Demo mode' });
  await expect(demo).toBeVisible();
  const box = demo.locator('input[type="checkbox"]');
  if (!(await box.isChecked())) await box.check();
  await expect(page.getByText(/Demo mode is on/i)).toBeVisible({ timeout: 15_000 });
  await page.goto('/desk/settings');
  const createBtn = page.getByRole('button', { name: /Create demo desk/i });
  try {
    await expect(createBtn.first()).toBeEnabled({ timeout: 15_000 });
  } catch {
    test.skip(true, 'Demo mode is off in this environment');
    return;
  }
  await page.route('**/api/demo/desk/create**', async (route) => {
    const req = route.request();
    if (req.method() !== 'POST') {
      await route.continue();
      return;
    }
    const dryRun = new URL(req.url()).searchParams.get('dryRun') === '1';
    if (dryRun) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        txHash: `0x${'b3'.repeat(32)}`,
        created: [`0x${'1d'.repeat(32)}`, `0x${'3c'.repeat(32)}`],
      }),
    });
  });
  await createBtn.first().click();
  await expect(page.locator('.page-note').filter({ hasText: /Desk and canary created/i })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator('.page-note').getByText(/This browser now uses the new live desk/i)).toBeVisible();
  const toast = page.locator('.toast-stack .toast').filter({ hasText: /Desk and canary created/i });
  await expect(toast).toBeVisible();
  const toastBox = await toast.boundingBox();
  expect(toastBox, 'toast sits under the topbar, not the caption bar').toBeTruthy();
  expect(toastBox!.y).toBeLessThan(120);
  await expect(page.getByText(/The live desk still has an older public key/i)).toHaveCount(0);
});

test('desk sidebar marks the active page and opens each section', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/desk', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('aside[aria-label="Desk navigation"] a[aria-current="page"]')).toHaveText(/Overview/);
  await page.locator('aside').getByRole('link', { name: 'Inbox', exact: true }).click();
  await expect(page).toHaveURL(/\/desk\/inbox/);
  await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible();
  await page.locator('aside').getByRole('link', { name: 'Canary', exact: true }).click();
  await expect(page).toHaveURL(/\/desk\/canary/);
  await page.locator('aside').getByRole('link', { name: 'Replies' }).click();
  await expect(page).toHaveURL(/\/desk\/replies/);
  await page.locator('aside').getByRole('link', { name: 'Desk settings' }).click();
  await expect(page).toHaveURL(/\/desk\/settings/);
  await page.locator('aside').getByRole('link', { name: 'Explorer' }).click();
  await expect(page).toHaveURL(/\/explorer/);
  await expect(page.locator('aside a[aria-current="page"]')).toHaveText(/Explorer/);
});

test('desk demo mode toggle is usable without a wallet', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/desk', { waitUntil: 'load' });
  const demo = page.locator('label.badge', { hasText: 'Demo mode' });
  await expect(demo).toBeVisible();
  const box = demo.locator('input[type="checkbox"]');
  if (!(await box.isChecked())) await box.check();
  await expect(page.getByText(/Demo mode is on/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Demo mode is off.')).toHaveCount(0);
  await expect(page.getByText('Something went wrong. Please try again.')).toHaveCount(0);
  await expect(page.getByText(/Please use the site to send this request/i)).toHaveCount(0);
  await page.locator('aside').getByRole('link', { name: 'Inbox', exact: true }).click();
  await expect(page).toHaveURL(/\/desk\/inbox/);
  await expect(page.getByText(/Older tips load from Arkiv/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /load older tips/i })).toBeVisible();
});
