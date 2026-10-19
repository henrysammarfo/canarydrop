import { test, expect } from '@playwright/test';

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
