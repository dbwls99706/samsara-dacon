import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = 'scripts/sim-out';
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

console.log('Starting SAMSARA E2E Simulator & Stress Tester...\n');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1024, height: 768 },
  deviceScaleFactor: 1
});

// Seed some initial localStorage to simulate a returning player context
await context.addInitScript(() => {
  try {
    localStorage.setItem('samsara.tutorial.done', '1');
    // Set returning player profile (schema 2)
    localStorage.setItem('samsara.meta.v2', JSON.stringify({
      schema: 2,
      savedAt: new Date().toISOString(),
      data: { totalCycles: 15, rp: 75, character: 'tiger', language: 'ko' }
    }));
  } catch (e) {
    console.error('Init script localStorage error:', e);
  }
});

const page = await context.newPage();
const pageErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error') {
    pageErrors.push(`[Console Error] ${msg.text()}`);
  }
});
page.on('pageerror', err => {
  pageErrors.push(`[Runtime Exception] ${err.message}`);
});

// Port fallback logic (try 4173 first, then 4188)
let connected = false;
try {
  console.log('Trying port 4173...');
  await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded', timeout: 5000 });
  connected = true;
} catch (e) {
  console.log('Port 4173 unavailable. Trying port 4188...');
  try {
    await page.goto('http://localhost:4188/', { waitUntil: 'domcontentloaded', timeout: 5000 });
    connected = true;
  } catch (err) {
    console.error('Failed to connect to both ports 4173 and 4188. Make sure npm run preview is running.');
  }
}

if (connected) {
  await page.waitForTimeout(2000);
} else {
  process.exit(1);
}

const runs = [];
const runCount = 5;

// Let's define motion keyboard directions for kiting
const combos = [
  ['ArrowRight'], ['ArrowRight', 'ArrowUp'], ['ArrowUp'], ['ArrowUp', 'ArrowLeft'],
  ['ArrowLeft'], ['ArrowLeft', 'ArrowDown'], ['ArrowDown'], ['ArrowDown', 'ArrowRight']
];
let comboIndex = 0;
let heldKeys = [];

async function setKite(p) {
  for (const k of heldKeys) {
    await p.keyboard.up(k).catch(() => {});
  }
  heldKeys = combos[comboIndex % combos.length];
  comboIndex++;
  for (const k of heldKeys) {
    await p.keyboard.down(k).catch(() => {});
  }
}

async function releaseKeys(p) {
  for (const k of heldKeys) {
    await p.keyboard.up(k).catch(() => {});
  }
  heldKeys = [];
}

for (let r = 1; r <= runCount; r++) {
  console.log(`\n--- RUN #${r} START ---`);
  
  // Click start or play button on home screen
  const startBtn = page.locator('button:visible').filter({ hasText: /시작|PLAY|START/ }).first();
  if (await startBtn.count()) {
    await startBtn.click();
    console.log('Clicked Start Button.');
  } else {
    // Maybe we are already in the character selection or in-game, let's check
    const selectTiger = page.locator('button:visible').filter({ hasText: /호랑이/ }).first();
    if (await selectTiger.count()) {
      await selectTiger.click();
      console.log('Clicked Character Selection (Tiger).');
    }
  }

  await page.waitForTimeout(1000);

  // Focus the game canvas to make keyboard navigation work
  const canvas = page.locator('canvas').first();
  if (await canvas.count()) {
    await canvas.click({ position: { x: 512, y: 384 } }).catch(() => {});
  }

  let gameOverDetected = false;
  let waveReached = 1;
  let scoreReached = 0;
  let rpEarned = 0;
  let timeStart = Date.now();
  let loopCount = 0;

  // Track if we did stress tests during the run
  let stressTested = false;

  while (!gameOverDetected && (Date.now() - timeStart < 150000)) { // 2.5 mins max per run
    loopCount++;
    
    // 1. Check for card pick overlay
    const cardPicker = page.locator('.samsara-card');
    const cardCount = await cardPicker.count();
    if (cardCount > 0) {
      await releaseKeys(page);
      // Pick first card
      const firstCard = cardPicker.first();
      const cardText = await firstCard.innerText().catch(() => '');
      await firstCard.click().catch(() => {});
      console.log(`Picked card: ${cardText.split('\n')[0]}`);
      await page.waitForTimeout(500);
      continue;
    }

    // 2. Check for Ritual select overlay (between cycles or end-run)
    const ritualOption = page.locator('button:visible').filter({ hasText: /윤회|의식|결산/ }).first();
    if (await ritualOption.count()) {
      await releaseKeys(page);
      await ritualOption.click().catch(() => {});
      console.log('Selected Ritual/Settlement option.');
      await page.waitForTimeout(500);
      continue;
    }

    // 3. Check for Skip Button
    const skipBtn = page.locator('button:visible').filter({ hasText: /건너뛰기/ }).first();
    if (await skipBtn.count()) {
      await skipBtn.click().catch(() => {});
      console.log('Clicked card skip button.');
      await page.waitForTimeout(500);
      continue;
    }

    // 4. Check for Game Over Screen
    const gameOverBanner = page.locator('div:visible').filter({ hasText: /윤회의 서|GAME OVER/ }).first();
    if (await gameOverBanner.count()) {
      await releaseKeys(page);
      gameOverDetected = true;
      
      // Extract ending stats
      const statsText = await page.evaluate(() => {
        const bodyText = document.body.textContent ?? '';
        const rpMatch = bodyText.match(/(\d+)\s*RP/);
        const waveMatch = bodyText.match(/웨이브\s*(\d+)/i) || bodyText.match(/wave\s*(\d+)/i);
        return {
          text: bodyText,
          rp: rpMatch ? rpMatch[1] : '0',
          wave: waveMatch ? waveMatch[1] : '?'
        };
      });

      console.log(`Game Over Detected. stats:`, statsText.wave, 'wave,', statsText.rp, 'RP');
      rpEarned = parseInt(statsText.rp, 10);
      
      // Click restart button
      const restartBtn = page.locator('button:visible').filter({ hasText: /다시 시작/ }).first();
      if (await restartBtn.count()) {
        await restartBtn.click();
        console.log('Clicked Restart Button.');
        await page.waitForTimeout(1000);
      }
      break;
    }

    // 5. Normal playing loop: kite & tap screen occasionally to spawn combo
    if (loopCount % 3 === 0) {
      await setKite(page);
    }
    
    // Occasional tap at player position (centered)
    if (loopCount % 5 === 0) {
      await page.mouse.click(512, 384).catch(() => {});
    }

    // Retrieve active game parameters from DOM
    const gameHUD = await page.evaluate(() => {
      const wEl = document.getElementById('hud-wave');
      const cEl = document.getElementById('hud-coins') || document.getElementById('hud-score');
      return {
        wave: wEl ? wEl.textContent : '?',
        coins: cEl ? cEl.textContent : '?'
      };
    });

    if (gameHUD.wave && gameHUD.wave !== '?') {
      const wNum = parseInt(gameHUD.wave.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(wNum) && wNum > waveReached) {
        waveReached = wNum;
        console.log(`Reached Wave ${waveReached}, Coins: ${gameHUD.coins}`);
      }
    }

    // 6. Perform Stress Testing in Run #3
    if (r === 3 && !stressTested && waveReached >= 2) {
      stressTested = true;
      console.log('*** Running Stress Test Scenarios on Run #3 ***');
      
      // A. Input Spamming: Toggle pause spam
      console.log('Stress: Pause/Resume Spamming...');
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(30);
      }
      
      // B. Resizing window
      console.log('Stress: Window resize toggles...');
      await page.setViewportSize({ width: 412, height: 740 }); // Mobile compact mode
      await page.waitForTimeout(300);
      await page.setViewportSize({ width: 1024, height: 768 }); // Restore desktop
      await page.waitForTimeout(300);

      // C. Storage corruption injection
      console.log('Stress: LocalStorage corruption injection...');
      await page.evaluate(() => {
        try {
          localStorage.setItem('samsara.meta.v2', '{corrupted_json_test');
        } catch(e){}
      });
    }

    await page.waitForTimeout(200);
  }

  runs.push({
    run: r,
    waveReached,
    rpEarned,
    timeSec: Math.round((Date.now() - timeStart) / 1000)
  });
}

console.log('\n=== SIMULATION RESULTS SUMMARY ===');
console.log(JSON.stringify(runs, null, 2));

console.log('\n=== RUNTIME EXCEPTIONS AND CONSOLE ERRORS ===');
if (pageErrors.length === 0) {
  console.log('Zero console errors or runtime exceptions detected!');
} else {
  pageErrors.forEach(err => console.log(err));
}

await browser.close();
console.log('\nSimulation complete!');
