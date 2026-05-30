import { chromium } from 'playwright';
import { mkdirSync, existsSync, rmSync } from 'node:fs';

const URL = 'http://localhost:4173/';
const OUT = 'scripts/ui-out/audit';

if (existsSync(OUT)) {
  rmSync(OUT, { recursive: true, force: true });
}
mkdirSync(OUT, { recursive: true });

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

async function runAudit() {
  console.log('[AUDIT] Launching Chromium browser...');
  const browser = await chromium.launch({ headless: true });

  // 1. Viewport Sweep
  const defaultViewport = { width: 412, height: 915 };
  const context = await browser.newContext({
    viewport: defaultViewport,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });

  // Bypass tutorial
  await context.addInitScript(() => {
    try {
      localStorage.setItem('samsara.tutorial.done', '1');
    } catch (e) {}
  });

  const page = await context.newPage();
  console.log(`[AUDIT] Loading game homepage: ${URL}`);
  await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2500); // wait for boot animation to clear

  // SCREEN 1: Main (Home)
  console.log('[AUDIT] Capturing SCREEN 1: Main (Home)...');
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(300);
    const path = `${OUT}/1-main-${vp.name}-${vp.width}x${vp.height}.png`;
    await page.screenshot({ path });
  }

  // Restore to standard for action
  await page.setViewportSize(defaultViewport);
  await page.waitForTimeout(300);

  // Start the game
  console.log('[AUDIT] Clicking START button to play...');
  const startBtn = page.locator('button:visible').filter({ hasText: /시작|바로\s*플레이|PLAY|START/ }).first();
  await startBtn.click();
  await page.waitForTimeout(2000); // let the canvas and HUD spawn

  // SCREEN 2: Play (Ingame)
  console.log('[AUDIT] Capturing SCREEN 2: Play (Ingame)...');
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(300);
    const path = `${OUT}/2-play-${vp.name}-${vp.width}x${vp.height}.png`;
    await page.screenshot({ path });
  }

  // Restore to standard
  await page.setViewportSize(defaultViewport);
  await page.waitForTimeout(300);

  // SCREEN 3: Pause
  console.log('[AUDIT] Pressing Escape to trigger SCREEN 3: Pause...');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);

  console.log('[AUDIT] Capturing SCREEN 3: Pause...');
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(300);
    const path = `${OUT}/3-pause-${vp.name}-${vp.width}x${vp.height}.png`;
    await page.screenshot({ path });
  }

  // Restore to standard and resume
  await page.setViewportSize(defaultViewport);
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape'); // resume
  await page.waitForTimeout(800);

  // SCREEN 4: Card Pick
  console.log('[AUDIT] Collecting XP gems to level up for SCREEN 4: Card Pick...');
  // Move around in a circle to kill enemies and collect XP
  const combos = [
    ['ArrowRight'], ['ArrowDown'], ['ArrowLeft'], ['ArrowUp'],
    ['ArrowRight', 'ArrowDown'], ['ArrowLeft', 'ArrowUp'],
    ['ArrowRight', 'ArrowUp'], ['ArrowLeft', 'ArrowDown']
  ];
  let held = [];
  let cardPickFound = false;

  for (let i = 0; i < 180; i++) {
    // Check if card pick is open
    cardPickFound = await page.evaluate(() => !!document.querySelector('.samsara-card'));
    if (cardPickFound) {
      console.log(`[AUDIT] Card Pick screen triggered successfully at step ${i}!`);
      break;
    }

    // Release current keys
    for (const k of held) {
      await page.keyboard.up(k).catch(() => {});
    }
    // Select new keys
    held = combos[i % combos.length];
    for (const k of held) {
      await page.keyboard.down(k).catch(() => {});
    }
    await page.waitForTimeout(350);
  }

  // Release all keys
  for (const k of held) {
    await page.keyboard.up(k).catch(() => {});
  }

  if (cardPickFound) {
    console.log('[AUDIT] Capturing SCREEN 4: Card Pick...');
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);
      const path = `${OUT}/4-cardpick-${vp.name}-${vp.width}x${vp.height}.png`;
      await page.screenshot({ path });
    }
  } else {
    console.error('[AUDIT] WARNING: Could not trigger Card Pick screen!');
  }

  // Restore to standard and click first card to resume
  await page.setViewportSize(defaultViewport);
  await page.waitForTimeout(300);
  if (cardPickFound) {
    const firstCard = page.locator('.samsara-card').first();
    await firstCard.click();
    await page.waitForTimeout(1000);
  }

  // SCREEN 5: Game Over
  console.log('[AUDIT] Standing still to allow enemies to kill the player for SCREEN 5: Game Over...');
  let gameOverFound = false;
  for (let i = 0; i < 60; i++) {
    gameOverFound = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return text.includes('환생') || text.includes('GAME OVER') || !!document.getElementById('game-over-title');
    });
    if (gameOverFound) {
      console.log(`[AUDIT] Game Over screen triggered successfully at check ${i}!`);
      break;
    }
    await page.waitForTimeout(500);
  }

  if (gameOverFound) {
    console.log('[AUDIT] Capturing SCREEN 5: Game Over...');
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);
      const path = `${OUT}/5-gameover-${vp.name}-${vp.width}x${vp.height}.png`;
      await page.screenshot({ path });
    }
  } else {
    console.error('[AUDIT] WARNING: Could not trigger Game Over screen!');
  }

  await context.close();

  // 2. DPR scaling test
  console.log('[AUDIT] Testing DPR scaling (dsf = 1, 2, 3) on standard mobile viewport...');
  for (const dsf of [1, 2, 3]) {
    const dprContext = await browser.newContext({
      viewport: defaultViewport,
      deviceScaleFactor: dsf,
      isMobile: true,
      hasTouch: true,
    });
    await dprContext.addInitScript(() => {
      try { localStorage.setItem('samsara.tutorial.done', '1'); } catch (e) {}
    });
    const dprPage = await dprContext.newPage();
    await dprPage.goto(URL, { waitUntil: 'load' });
    await dprPage.waitForTimeout(1500);
    const dprStartBtn = dprPage.locator('button:visible').filter({ hasText: /시작|바로\s*플레이|PLAY|START/ }).first();
    await dprStartBtn.click();
    await dprPage.waitForTimeout(1500);
    
    // Check canvas backing store dimensions
    const canvasDetails = await dprPage.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      return {
        styleWidth: canvas.style.width,
        styleHeight: canvas.style.height,
        backingWidth: canvas.width,
        backingHeight: canvas.height,
        dpr: window.devicePixelRatio,
      };
    });
    console.log(`[AUDIT] DPR ${dsf} canvas details:`, JSON.stringify(canvasDetails));
    
    await dprPage.screenshot({ path: `${OUT}/dpr-${dsf}-play.png` });
    await dprContext.close();
  }

  // 3. Dynamic orientation switch check during play
  console.log('[AUDIT] Testing orientation transition during play...');
  const orientContext = await browser.newContext({
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await orientContext.addInitScript(() => {
    try { localStorage.setItem('samsara.tutorial.done', '1'); } catch (e) {}
  });
  const orientPage = await orientContext.newPage();
  await orientPage.goto(URL, { waitUntil: 'load' });
  await orientPage.waitForTimeout(1500);
  const orientStartBtn = orientPage.locator('button:visible').filter({ hasText: /시작|바로\s*플레이|PLAY|START/ }).first();
  await orientStartBtn.click();
  await orientPage.waitForTimeout(1500);

  // Take screenshot in Portrait
  await orientPage.screenshot({ path: `${OUT}/orientation-1-portrait.png` });
  
  // Rotate to Landscape
  console.log('[AUDIT] Rotating viewport to landscape...');
  await orientPage.setViewportSize({ width: 915, height: 412 });
  await orientPage.waitForTimeout(500);
  await orientPage.screenshot({ path: `${OUT}/orientation-2-landscape.png` });

  // Rotate back to Portrait
  console.log('[AUDIT] Rotating viewport back to portrait...');
  await orientPage.setViewportSize({ width: 412, height: 915 });
  await orientPage.waitForTimeout(500);
  await orientPage.screenshot({ path: `${OUT}/orientation-3-portrait-back.png` });
  
  await orientContext.close();
  await browser.close();
  console.log('[AUDIT] Sweep audit finished successfully!');
}

runAudit().catch(console.error);
