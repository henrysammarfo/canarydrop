import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const origin = process.env.PRODUCTION_URL || '';
const desk = '0x1da3c22c079c264536D831F6F1fCe638aB0b20B0';
const routes = [
  '/',
  '/submit',
  '/desk',
  '/desk/inbox',
  '/desk/canary',
  '/desk/replies',
  '/desk/settings',
  '/r',
  '/explorer',
  '/docs',
  '/how',
  '/verify',
  '/threat',
  '/desk/drop',
  `/canary/${desk}`,
  `/d/${desk}`,
  `/canary?desk=${desk}`,
  `/d?desk=${desk}`,
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
      if (/status of 403 \(Forbidden\)/.test(e)) return false;
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

async function wheelUntil(page: import('@playwright/test').Page, locator: import('@playwright/test').Locator) {
  await page.mouse.move(720, 420);
  for (let i = 0; i < 36; i++) {
    const box = await locator.boundingBox();
    if (box) {
      const y = box.y + box.height / 2;
      if (y > 80 && y < 860) return box;
    }
    await page.mouse.wheel(0, 900);
  }
  return locator.boundingBox();
}

async function hitAtCenter(page: import('@playwright/test').Page, locator: import('@playwright/test').Locator) {
  const box = await locator.boundingBox();
  expect(box, 'target must have a box').toBeTruthy();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  return page.evaluate(
    ({ x, y }) => {
      const n = document.elementFromPoint(x, y) as HTMLElement | null;
      if (!n) return { ok: false, tag: '', text: '' };
      return { ok: true, tag: n.tagName, text: (n.innerText || n.textContent || '').slice(0, 200) };
    },
    { x, y },
  );
}

function lowerHalfNotFlat(png: Buffer) {
  const raw = png.toString('binary');
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  const start = Math.floor(png.length / 2);
  let min = 255;
  let max = 0;
  for (let i = start; i < png.length; i += 31) {
    const v = png[i];
    if (v === undefined) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  expect(max - min, 'full page lower half is a single color').toBeGreaterThan(20);
  return raw.length;
}

test('home FAQ and footer CTA are hittable after mouse wheel at 1440', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(urlFor('/'), { waitUntil: 'load' });
  const faqQ = page.getByText('Do sources need a wallet?');
  await wheelUntil(page, faqQ);
  await expect(faqQ).toBeVisible();
  const faqHit = await hitAtCenter(page, faqQ);
  expect(faqHit.ok, 'elementFromPoint missed FAQ').toBeTruthy();
  expect(faqHit.text).toMatch(/Do sources need a wallet/i);

  const cta = page.getByRole('heading', { name: /ready to try it/i });
  await wheelUntil(page, cta);
  await expect(cta).toBeVisible();
  const ctaHit = await hitAtCenter(page, cta);
  expect(ctaHit.ok, 'elementFromPoint missed CTA').toBeTruthy();
  expect(ctaHit.text).toMatch(/ready to try it/i);

  const shot = await page.screenshot({
    fullPage: true,
    path: path.join('shots', 'home_full_wheel.png'),
  });
  lowerHalfNotFlat(shot);
});

const deskLiveFixture = JSON.parse(
  fs.readFileSync(path.resolve('tests/e2e/fixtures/desk-live.json'), 'utf8'),
) as Record<string, unknown>;
const tipDryRunFixture = JSON.parse(
  fs.readFileSync(path.resolve('tests/e2e/fixtures/tip-dry-run.json'), 'utf8'),
) as Record<string, unknown>;

async function mockSubmitLiveReads(page: Page) {
  await page.route('**/api/desk/live**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(deskLiveFixture),
    });
  });
  await page.route('**/api/tip**', async (route) => {
    const req = route.request();
    if (req.method() !== 'POST' || !req.url().includes('dryRun=1')) {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(tipDryRunFixture),
    });
  });
}

test('dry run tip submit shows a toast', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockSubmitLiveReads(page);
  await page.goto(urlFor('/submit'), { waitUntil: 'load' });
  const creator = page.getByLabel('Desk creator address');
  if ((await creator.inputValue()) !== desk) await creator.fill(desk);
  const canary = page.locator('p[role="status"]').filter({ hasText: /Canary alive/i });
  await expect(canary).toBeVisible();
  await page.locator('#tip-body').fill('Synthetic judge dry run tip.');
  const dry = page.getByRole('button', { name: 'Dry run' });
  await expect(dry).toBeEnabled();
  const posted = page.waitForResponse(
    (res) => res.request().method() === 'POST' && res.url().includes('/api/tip') && res.url().includes('dryRun=1'),
  );
  await dry.click();
  const res = await posted;
  expect(res.ok(), `dry run HTTP ${res.status()}`).toBeTruthy();
  await expect(page.locator('.toast-stack .toast').filter({ hasText: /Dry run ok/i })).toBeVisible();
});

test('live dry run tip submit shows a toast', async ({ page }) => {
  test.skip(!process.env.LIVE_E2E, 'LIVE_E2E not set');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(urlFor('/submit'), { waitUntil: 'load' });
  const creator = page.getByLabel('Desk creator address');
  if ((await creator.inputValue()) !== desk) await creator.fill(desk);
  const canary = page.locator('p[role="status"]').filter({ hasText: /Canary (alive|gone|unknown)/i });
  await expect(canary).toBeVisible({ timeout: 35_000 });
  await page.locator('#tip-body').fill('Synthetic judge dry run tip.');
  const dry = page.getByRole('button', { name: 'Dry run' });
  await expect(dry).toBeEnabled();
  const posted = page.waitForResponse(
    (res) => res.request().method() === 'POST' && res.url().includes('/api/tip') && res.url().includes('dryRun=1'),
  );
  await dry.click();
  const res = await posted;
  expect(res.ok(), `dry run HTTP ${res.status()}`).toBeTruthy();
  await expect(page.locator('.toast-stack .toast').filter({ hasText: /Dry run ok/i })).toBeVisible();
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
