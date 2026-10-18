import { test, expect } from '@playwright/test';
import path from 'node:path';

const origin = process.env.PRODUCTION_URL || '';
const desk = '0x1da3c22c079c264536D831F6F1fCe638aB0b20B0';
const routes = [
  '/',
  '/submit',
  '/desk',
  '/r',
  '/explorer',
  '/docs',
  `/canary/${desk}`,
  `/d/${desk}`,
  '/__404__',
];

function urlFor(r: string) {
  const p = r === '/__404__' ? '/not-a-real-page' : r;
  return origin ? `${origin.replace(/\/$/, '')}${p}` : p;
}

for (const r of routes) {
  test(`route ${r} loads without console errors (desktop)`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto(urlFor(r), { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/CanaryDrop|Canary/);
    const unexpected = errors.filter((e) => {
      if (r === '/__404__' && /404/.test(e)) return false;
      return true;
    });
    expect(unexpected, `Console errors on ${r}`).toEqual([]);
    await page.screenshot({ path: path.join('shots', r.replace(/\W+/g, '_') + '.png'), fullPage: true });
  });
}

for (const width of [1440, 390] as const) {
  for (const r of routes) {
    test(`${width}px ${r} no horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto(urlFor(r), { waitUntil: 'load' });
      const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      expect(w.sw, `${r} overflow ${w.sw} > ${w.iw}`).toBeLessThanOrEqual(w.iw + 1);
    });
  }
}

test('home FAQ is visible with nonzero opacity at 1440', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(urlFor('/'), { waitUntil: 'load' });
  const faq = page.locator('#faq');
  await faq.scrollIntoViewIfNeeded();
  await expect(faq).toBeVisible();
  const opacity = await faq.evaluate((el) => Number(getComputedStyle(el).opacity));
  expect(opacity).toBeGreaterThan(0);
  await expect(page.getByText('Do sources need a wallet?')).toBeVisible();
});

test('hero CTAs are narrower than 260px', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(urlFor('/'), { waitUntil: 'load' });
  const w1 = await page.locator('#hero a[href="/submit"]').boundingBox();
  const w2 = await page.locator('#hero a[href="/desk"]').boundingBox();
  expect(w1!.width).toBeLessThan(260);
  expect(w2!.width).toBeLessThan(260);
});

test('no en or em dashes in visible text on every route', async ({ page }) => {
  for (const r of routes) {
    await page.goto(urlFor(r), { waitUntil: 'domcontentloaded' });
    const text = await page.locator('body').innerText();
    expect(text, `en/em dash on ${r}`).not.toMatch(/[\u2013\u2014]/);
  }
});

test('modal opens and closes on submit', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(urlFor('/submit'), { waitUntil: 'load' });
  await page.getByRole('button', { name: 'How sending works' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('mobile nav shows hamburger and hides inline links', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(urlFor('/'), { waitUntil: 'load' });
  await expect(page.locator('.hamburger')).toBeVisible();
  await expect(page.locator('.nav-links')).toBeHidden();
  await expect(page.locator('.home-marquee')).toBeVisible();
  await page.locator('.hamburger').click();
  await expect(page.locator('#mobile-menu.open')).toBeVisible();
  await expect(page.locator('#mobile-menu').getByRole('link', { name: 'Submit' })).toBeVisible();
});

test('production home has headline', async ({ page }) => {
  test.skip(!process.env.PRODUCTION_URL, 'PRODUCTION_URL not set');
  await page.goto(process.env.PRODUCTION_URL!);
  await expect(page.locator('#hero h1')).toContainText(/TIPS THAT CANNOT BE SEIZED|Tips that cannot be seized/);
});
