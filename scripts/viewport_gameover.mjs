import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';

const URL = 'http://localhost:4173/';
const OUT = 'scripts/ui-out/audit';

const VIEWPORTS = [
  { name: 'small_phone', width: 360, height: 640, isMobile: true },
  { name: 'standard_phone', width: 412, height: 915, isMobile: true },
  { name: 'short_phone', width: 412, height: 740, isMobile: true },
  { name: 'landscape_1', width: 844, height: 390, isMobile: true },
  { name: 'landscape_2', width: 740, height: 360, isMobile: true },
  { name: 'tablet', width: 768, height: 1024, isMobile: true },
  { name: 'desktop', width: 1366, height: 768, isMobile: false },
  { name: 'large_desktop', width: 1920, height: 1080, isMobile: false },
  { name: 'fold_narrow', width: 280, height: 653, isMobile: true },
];

async function runGameOverAudit() {
  console.log('[GAMEOVER-AUDIT] Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const defaultViewport = { width: 412, height: 915 };
  const context = await browser.newContext({
    viewport: defaultViewport,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  await context.addInitScript(() => {
    try {
      localStorage.setItem('samsara.tutorial.done', '1');
    } catch (e) {}
  });

  const page = await context.newPage();
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  const startBtn = page.locator('button:visible').filter({ hasText: /시작|바로\s*플레이|PLAY|START/ }).first();
  await startBtn.click();
  await page.waitForTimeout(1000);

  console.log('[GAMEOVER-AUDIT] Standing completely still. Clicking Card Picks. Waiting for death...');
  let gameOverFound = false;

  for (let sec = 0; sec < 150; sec++) {
    // Check if Game Over (Highlight) is showing
    gameOverFound = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return text.includes('환생') || text.includes('GAME OVER') || !!document.getElementById('game-over-title') || window.location.hash === '#highlight' || document.body.innerText.includes('HIGHLIGHT');
    });

    if (gameOverFound) {
      console.log(`[GAMEOVER-AUDIT] Game Over screen detected after ${sec} seconds!`);
      break;
    }

    // Check if Card Pick is showing, click first card
    const hasCardPick = await page.evaluate(() => !!document.querySelector('.samsara-card'));
    if (hasCardPick) {
      console.log('[GAMEOVER-AUDIT] Card Pick modal detected. Clicking first card...');
      const firstCard = page.locator('.samsara-card').first();
      await firstCard.click();
      await page.waitForTimeout(800);
    }

    await page.waitForTimeout(1000);
  }

  if (gameOverFound) {
    console.log('[GAMEOVER-AUDIT] Capturing SCREEN 5: Game Over...');
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);
      const path = `${OUT}/5-gameover-${vp.name}-${vp.width}x${vp.height}.png`;
      await page.screenshot({ path });
    }
  } else {
    console.error('[GAMEOVER-AUDIT] FAILED to trigger Game Over screen within 150s.');
  }

  await context.close();
  await browser.close();
  console.log('[GAMEOVER-AUDIT] Complete!');
}

runGameOverAudit().catch(console.error);
