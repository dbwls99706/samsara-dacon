// 빠른 UI 캡처 — main / in-game / pause / cardpick / gameover
import { chromium } from 'playwright';
import { mkdirSync, existsSync, rmSync } from 'node:fs';

const URL = process.argv[2] || 'http://localhost:4173/';
const OUT = 'scripts/ui-out';
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function run(label, viewport, isMobile) {
  const ctx = await browser.newContext({
    viewport, deviceScaleFactor: 2, isMobile, hasTouch: isMobile,
  });
  await ctx.addInitScript(() => { try { localStorage.setItem('samsara.tutorial.done', '1'); } catch {} });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 25000 });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/${label}-1-main.png` });

  // START
  const startBtn = page.locator('button:visible').filter({ hasText: /시작|바로\s*플레이|PLAY|START/ }).first();
  try { await startBtn.click({ timeout: 4000 }); } catch (e) { console.log(label, 'start click fail', e.message); }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${label}-2-ingame-start.png` });

  // 플레이 입력 — 게임 영역 탭 (judge-session 패턴)
  const tapX = Math.round(viewport.width * 0.72);
  const tapY = Math.round(viewport.height * 0.42);
  for (let i = 0; i < 60; i++) {
    if (isMobile) {
      await page.touchscreen.tap(tapX, tapY).catch(()=>{});
    } else {
      await page.mouse.click(tapX, tapY).catch(()=>{});
    }
    await page.waitForTimeout(120);
    // 카드픽 자동 클릭 (진행 유지)
    if (i === 30 || i === 45) {
      await page.screenshot({ path: `${OUT}/${label}-3-mid-${i}.png` });
      const card = page.locator('button:visible, [role="button"]:visible').filter({ hasText: /\S/ }).first();
      try { await card.click({ timeout: 600 }); } catch {}
    }
  }
  await page.screenshot({ path: `${OUT}/${label}-4-later.png` });
  await ctx.close();
}

await run('mobile', { width: 412, height: 915 }, true);
await run('desktop', { width: 1366, height: 768 }, false);
await browser.close();
console.log('done -> scripts/ui-out');
