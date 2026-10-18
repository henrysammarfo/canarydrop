import { test, expect } from '@playwright/test';
import path from 'node:path';

const routes = ['/', '/submit', '/desk', '/r', '/explorer', '/docs'];

for (const r of routes) {
  test(`route ${r} loads without console errors (desktop)`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(r);
    await expect(page).toHaveTitle(/CanaryDrop|Canary/);
    expect(errors, `Console errors on ${r}`).toEqual([]);
    await page.screenshot({ path: path.join('shots', r.replace(/\W+/g, '_') + '.png'), fullPage: true });
  });
}

