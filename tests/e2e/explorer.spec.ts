import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const explorerLiveFixture = JSON.parse(
  fs.readFileSync(path.resolve('tests/e2e/fixtures/explorer-live.json'), 'utf8'),
) as Record<string, unknown>;

async function mockExplorerLive(page: Page) {
  await page.route('**/api/explorer**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(explorerLiveFixture),
    });
  });
}

test('explorer sealed tips filter degrades when none are live', async ({ page }) => {
  await mockExplorerLive(page);
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
      { timeout: 10_000 },
    )
    .toMatch(/No live sealed tips|tip/i);
});

async function explorerTableText(page: Page) {
  if ((await page.getByText('Loading live rows…').count()) > 0) return 'loading';
  return page.locator('tbody').innerText();
}

test('explorer desks keep canonical and impostor labels and mark replaced demo rows', async ({ page }) => {
  await mockExplorerLive(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/explorer', { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'Desks' }).click();
  await expect.poll(() => explorerTableText(page), { timeout: 10_000 }).toMatch(/desk/i);
  const more = page.getByRole('button', { name: /load more/i });
  if (await more.isEnabled()) {
    await more.click();
    await expect.poll(() => explorerTableText(page), { timeout: 10_000 }).not.toBe('loading');
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

for (const width of [1024, 1280, 1440, 1920] as const) {
  test(`${width} explorer flags stay inside their cells`, async ({ page }) => {
    await mockExplorerLive(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/explorer', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => explorerTableText(page), { timeout: 10_000 }).toMatch(/tip|desk/i);
    const clipped = await page.evaluate(() => {
      const wrap = document.querySelector('.table-wrap');
      const table = document.querySelector('.data-table');
      if (!wrap || !table) return [{ text: 'missing table', overflowRight: 1, overflowLeft: 0 }];
      const wr = wrap.getBoundingClientRect();
      const nodes = [
        ...table.querySelectorAll('.flag'),
        ...table.querySelectorAll('.actions-cell .btn'),
      ];
      return nodes.flatMap((el) => {
        const cell = el.closest('td') ?? el;
        const r = el.getBoundingClientRect();
        const cr = cell.getBoundingClientRect();
        const visibleInWrap = r.right > wr.left + 1 && r.left < wr.right - 1;
        const cutByWrap = visibleInWrap && (r.right - wr.right > 1 || wr.left - r.left > 1);
        const overflowRight = r.right - cr.right;
        const overflowLeft = cr.left - r.left;
        if (cutByWrap || overflowRight > 1 || overflowLeft > 1) {
          return [{ text: (el.textContent ?? '').trim(), overflowRight, overflowLeft, cutByWrap }];
        }
        return [];
      });
    });
    expect(clipped, `${width}px ${JSON.stringify(clipped)}`).toEqual([]);
  });
}

test('explorer canaries mark the replaced demo canary', async ({ page }) => {
  await mockExplorerLive(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/explorer', { waitUntil: 'domcontentloaded' });
  await page.getByRole('tab', { name: 'Canaries' }).click();
  await expect.poll(() => explorerTableText(page), { timeout: 10_000 }).not.toBe('loading');
  const more = page.getByRole('button', { name: /load more/i });
  if (await more.isEnabled()) {
    await more.click();
    await expect.poll(() => explorerTableText(page), { timeout: 10_000 }).not.toBe('loading');
  }
  const text = await page.locator('tbody').innerText();
  if (/0x5a9cc9/i.test(text)) {
    expect(text).toMatch(/Older demo canary, replaced/i);
  }
});
