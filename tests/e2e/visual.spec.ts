import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const desk = '0x1da3c22c079c264536D831F6F1fCe638aB0b20B0';
const pages = [
  '/',
  '/submit',
  '/desk',
  '/desk/inbox',
  '/desk/canary',
  '/desk/replies',
  '/desk/settings',
  '/explorer',
  '/how',
  '/verify',
  '/docs',
  `/canary/${desk}`,
  `/d/${desk}`,
  '/r',
];

const outDir = '/opt/cursor/artifacts';

function slug(route: string) {
  return route === '/' ? 'home' : route.replace(/\W+/g, '_').replace(/^_|_$/g, '');
}

test.describe('visual screenshots and overflow', () => {
  for (const width of [1440, 390] as const) {
    for (const route of pages) {
      test(`${width} ${route} screenshot and no overflow`, async ({ page }) => {
        fs.mkdirSync(outDir, { recursive: true });
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
        await page.goto(route, { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready.then(() => true)).catch(() => undefined);
        if (route === '/explorer') {
          await page.getByText('Loading live rows…').waitFor({ state: 'hidden', timeout: 25_000 }).catch(() => undefined);
        }
        if (route === '/submit') {
          await page.getByText('Looking up this desk on Arkiv…').waitFor({ state: 'hidden', timeout: 25_000 }).catch(() => undefined);
        }
        await page.waitForTimeout(400);
        const file = path.join(outDir, `${slug(route)}_${width}.png`);
        await page.screenshot({ path: file, fullPage: true });
        const box = await page.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          iw: window.innerWidth,
        }));
        expect(box.sw, `${route} overflow ${box.sw} > ${box.iw}`).toBeLessThanOrEqual(box.iw + 1);
      });
    }
  }

  for (const width of [1440, 390] as const) {
    test(`${width} desk demo mode screenshot`, async ({ page }) => {
      fs.mkdirSync(outDir, { recursive: true });
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto('/desk', { waitUntil: 'load' });
      const demo = page.locator('label.badge', { hasText: 'Demo mode' });
      const box = demo.locator('input[type="checkbox"]');
      if (!(await box.isChecked())) await box.check();
      await expect(page.getByText(/Demo mode is on/i)).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(outDir, `desk_demo_${width}.png`), fullPage: true });
      const measure = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        iw: window.innerWidth,
      }));
      expect(measure.sw).toBeLessThanOrEqual(measure.iw + 1);
    });
  }
});
