import { chromium } from 'playwright';

const url = process.env.PRODUCTION_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(url, { waitUntil: 'domcontentloaded' });
const info = await page.evaluate(() => {
  const offenders = [];
  const iw = window.innerWidth;
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.right > iw + 1 || r.left < -1) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        cls: el.className || null,
        right: r.right,
        left: r.left,
      });
    }
  });
  return { iw, sw: document.body.scrollWidth, offenders: offenders.slice(0, 20) };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
