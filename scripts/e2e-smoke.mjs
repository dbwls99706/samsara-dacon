// E2E smoke test against localhost:5173 (or arg URL).
// Boots the page, asserts title, listens for console errors, takes screenshot.
// Exit code: 0 = pass, 1 = fail.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';

const URL = process.argv[2] || 'http://localhost:5173/';
const OUT = 'scripts/e2e-out';
mkdirSync(OUT, { recursive: true });

const errors = [];
const warnings = [];
const requests = [];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
});
const page = await ctx.newPage();

page.on('console', msg => {
  const text = msg.text();
  if (msg.type() === 'error') errors.push(text);
  else if (msg.type() === 'warning') warnings.push(text);
});
page.on('pageerror', err => errors.push('PAGEERR: ' + err.message));
page.on('requestfailed', req => {
  if (!req.url().includes('favicon')) {
    requests.push(`FAIL ${req.failure()?.errorText ?? '?'} ${req.url()}`);
  }
});

const start = Date.now();
const resp = await page.goto(URL, { waitUntil: 'networkidle', timeout: 20000 });
const loadMs = Date.now() - start;

const title = await page.title();
const status = resp?.status() ?? -1;
const description = await page.locator('meta[name="description"]').getAttribute('content').catch(() => null);

// Wait for app boot — Vite root <div id="app"> exists, look for any rendered child
await page.waitForTimeout(1500);
const appHtml = await page.locator('#app').innerHTML().catch(() => '');
const appHasContent = appHtml.length > 100;

await page.screenshot({ path: `${OUT}/01-mobile-home.png`, fullPage: false });

// Try clicking the tutorial/start button — SAMSARA uses "튜토리얼" as primary CTA
let startClicked = false;
let canvasFound = false;
let canvasSize = null;
// Visible-only filter (the home overlay has many buttons, but only home-screen ones are visible)
const startBtn = page.locator('button:visible').filter({
  hasText: /^(▶?\s*)?튜토리얼$|^바로\s*플레이$|^▶\s*시작$|^Tutorial$|^PLAY$|^START$/
}).first();
if (await startBtn.count() > 0) {
  try {
    await startBtn.click({ timeout: 3000 });
    startClicked = true;
    await page.waitForTimeout(2500);
    // Check canvas is drawing
    const canvas = page.locator('canvas').first();
    if (await canvas.count() > 0) {
      canvasFound = true;
      const box = await canvas.boundingBox();
      canvasSize = box ? { w: Math.round(box.width), h: Math.round(box.height) } : null;
    }
    await page.screenshot({ path: `${OUT}/03-mobile-ingame.png`, fullPage: false });
  } catch (e) {
    errors.push('START CLICK FAILED: ' + e.message);
  }
}

// Desktop pass
const dctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const dpage = await dctx.newPage();
dpage.on('console', msg => { if (msg.type() === 'error') errors.push('DESK: ' + msg.text()); });
dpage.on('pageerror', err => errors.push('DESK PAGEERR: ' + err.message));
await dpage.goto(URL, { waitUntil: 'networkidle', timeout: 20000 });
await dpage.waitForTimeout(1500);
await dpage.screenshot({ path: `${OUT}/02-desktop-home.png`, fullPage: false });

await browser.close();

const report = {
  url: URL,
  http_status: status,
  load_ms: loadMs,
  title,
  description_len: description?.length ?? 0,
  app_has_content: appHasContent,
  start_button_found_and_clicked: startClicked,
  canvas_found_after_start: canvasFound,
  canvas_size: canvasSize,
  console_errors: errors,
  console_warnings_count: warnings.length,
  console_warnings: warnings,
  request_failures: requests,
  pass: status === 200 && appHasContent && errors.length === 0
};

writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.pass ? 0 : 1);
