import { test, expect } from '@playwright/test';

test('replies page labels stealth replies experimental', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/desk/replies', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.page-header .experimental-label')).toHaveText('Experimental');
});

test('send reply shows inline confirmation and a toast under the topbar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/desk', { waitUntil: 'load' });
  const demo = page.locator('label.badge', { hasText: 'Demo mode' });
  await expect(demo).toBeVisible();
  const box = demo.locator('input[type="checkbox"]');
  if (!(await box.isChecked())) await box.check();
  await expect(page.getByText(/Demo mode is on/i)).toBeVisible({ timeout: 15_000 });
  await page.locator('aside').getByRole('link', { name: 'Inbox', exact: true }).click();
  await expect(page).toHaveURL(/\/desk\/inbox/);
  const replyBox = page.getByLabel(/Reply to tip/i).first();
  try {
    await expect(replyBox).toBeVisible({ timeout: 20_000 });
  } catch {
    test.skip(true, 'No open tip to reply to in this environment');
    return;
  }
  const replyKey = `0x${'ab'.repeat(32)}`;
  await page.route('**/api/demo/reply**', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, txHash: `0x${'cd'.repeat(32)}`, replyKey }),
    });
  });
  await replyBox.fill('Synthetic judge reply.');
  await page.getByRole('button', { name: 'Send reply' }).first().click();
  await expect(page.locator('.stealth-reply-note').first()).toContainText('Experimental');
  const inline = page.locator('.reply-sent').filter({ hasText: /Reply sent/i });
  await expect(inline).toBeVisible({ timeout: 20_000 });
  await expect(inline.getByRole('link', { name: /Open it on Replies/i })).toHaveAttribute(
    'href',
    `/desk/replies#reply-${replyKey}`,
  );
  await expect(inline.locator('.experimental-label')).toHaveText('Experimental');
  const toast = page.locator('.toast-stack .toast').filter({ hasText: /one time address/i });
  await expect(toast).toBeVisible();
  await expect(toast).toContainText('Experimental');
  const pos = await toast.boundingBox();
  expect(pos, 'toast sits under the topbar').toBeTruthy();
  expect(pos!.y).toBeLessThan(120);
});
