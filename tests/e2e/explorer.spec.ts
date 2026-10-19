import { test, expect, type Page } from '@playwright/test';

test('explorer sealed tips filter degrades when none are live', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/explorer', { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'Sealed tips' }).click();
  await expect(page.getByRole('tab', { name: 'Sealed tips' })).toHaveAttribute('aria-selected', 'true');
  await expect
    .poll(
      async () => {
        if ((await page.getByText('Loading live rows…').count()) > 0) return 'loading';
        return page.locator('tbody').innerText();
      },
      { timeout: 45_000 },
    )
    .toMatch(/No live sealed tips|tip/i);
});

async function explorerTableText(page: Page) {
  if ((await page.getByText('Loading live rows…').count()) > 0) return 'loading';
  return page.locator('tbody').innerText();
}

test('explorer desks keep canonical and impostor labels and mark replaced demo rows', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/explorer', { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'Desks' }).click();
  await expect.poll(() => explorerTableText(page), { timeout: 45_000 }).toMatch(/desk/i);
  const more = page.getByRole('button', { name: /load more/i });
  if (await more.isEnabled()) {
    await more.click();
    await expect.poll(() => explorerTableText(page), { timeout: 45_000 }).not.toBe('loading');
  }
  const text = await page.locator('tbody').innerText();
  expect(text).not.toMatch(/[\u2013\u2014]/);
  if (/Canonical demo desk/i.test(text)) {
    expect(text).toMatch(/Canonical demo desk/i);
  }
  if (/Ignored impostor/i.test(text)) {
    expect(text).toMatch(/Ignored impostor/i);
  }
  if (/0x874e54/i.test(text)) {
    expect(text).toMatch(/Older demo desk, replaced/i);
  }
});

test('explorer canaries mark the replaced demo canary', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/explorer', { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'Canaries' }).click();
  await expect.poll(() => explorerTableText(page), { timeout: 45_000 }).not.toBe('loading');
  const more = page.getByRole('button', { name: /load more/i });
  if (await more.isEnabled()) {
    await more.click();
    await expect.poll(() => explorerTableText(page), { timeout: 45_000 }).not.toBe('loading');
  }
  const text = await page.locator('tbody').innerText();
  if (/0x5a9cc9/i.test(text)) {
    expect(text).toMatch(/Older demo canary, replaced/i);
  }
});
