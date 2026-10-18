import { test, expect } from '@playwright/test';
import path from 'node:path';

const base = process.env.PRODUCTION_URL || 'http://localhost:3000';
const routes = process.env.PRODUCTION_URL
  ? [] // skip local routes when testing production
  : ['/', '/submit', '/desk', '/r', '/explorer', '/docs', '/canary/0x1da3c22c079c264536D831F6F1fCe638aB0b20B0', '/d/0x1da3c22c079c264536D831F6F1fCe638aB0b20B0', '/__404__'];

for (const r of routes) {
  test(`route ${r} loads without console errors (desktop)`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(r === '/__404__' ? '/not-a-real-page' : r);
    await expect(page).toHaveTitle(/CanaryDrop|Canary/);
    expect(errors, `Console errors on ${r}`).toEqual([]);
    await page.screenshot({ path: path.join('shots', r.replace(/\W+/g, '_') + '.png'), fullPage: true });
  });
}

test('no horizontal overflow at 390px on home', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(process.env.PRODUCTION_URL ? process.env.PRODUCTION_URL : '/');
  const w = await page.evaluate(() => ({ sw: document.body.scrollWidth, iw: window.innerWidth }));
  expect(w.sw <= w.iw).toBeTruthy();
});

test('production home has headline', async ({ page }) => {
  test.skip(!process.env.PRODUCTION_URL, 'PRODUCTION_URL not set');
  await page.goto(process.env.PRODUCTION_URL!);
  await expect(page.locator('#hero h1')).toContainText(/TIPS THAT CANNOT BE SEIZED|Tips that cannot be seized/);
});

test('production hero CTAs are auto width', async ({ page }) => {
  test.skip(!process.env.PRODUCTION_URL, 'PRODUCTION_URL not set');
  await page.goto(process.env.PRODUCTION_URL!);
  const w1 = await page.locator('#hero a[href="/submit"]').boundingBox();
  const w2 = await page.locator('#hero a[href="/desk"]').boundingBox();
  expect(w1!.width).toBeLessThan(260);
  expect(w2!.width).toBeLessThan(260);
});

