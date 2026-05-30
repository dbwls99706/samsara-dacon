import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';

const OUT = 'scripts/ui-out';
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({ headless: true });

async function auditViewport(label, width, height, isMobile) {
  const ctx = await b.newContext({
    viewport: { width, height },
    isMobile,
    hasTouch: isMobile
  });

  // Inject return player state
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('samsara.tutorial.done', '1');
      localStorage.setItem('samsara.meta.v2', JSON.stringify({
        schema: 2,
        savedAt: '2026-01-01T00:00:00.000Z',
        data: { totalCycles: 7, rp: 120, character: 'tiger', language: 'ko' }
      }));
    } catch {}
  });

  const p = await ctx.newPage();
  await p.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);

  // Click START
  console.log(`[${label}] Clicking main start button...`);
  await p.locator('button:visible').filter({ hasText: /시작|PLAY/ }).first().click({ timeout: 4000 });
  await p.waitForTimeout(1500);

  // Force cardPick phase
  console.log(`[${label}] Transitioning to cardPick phase...`);
  const metrics = await p.evaluate(async () => {
    // go is global now
    window.go('cardPick');
    await new Promise(resolve => setTimeout(resolve, 800));

    const root = document.querySelector('#screen-host > div');
    const header = document.querySelector('h2')?.parentElement;
    const cards = Array.from(document.querySelectorAll('.samsara-card'));
    
    // Find skip button
    const buttons = Array.from(document.querySelectorAll('button'));
    const skipBtn = buttons.find(btn => btn.textContent.includes('건너뛰기'));

    const vh = window.innerHeight;
    const vw = window.innerWidth;

    const cardsRects = cards.map(c => {
      const r = c.getBoundingClientRect();
      return {
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        height: Math.round(r.height),
        overflow: r.bottom > vh
      };
    });

    const rootScrollHeight = root ? root.scrollHeight : 0;
    const hasScroll = rootScrollHeight > vh;

    const skipRect = skipBtn ? skipBtn.getBoundingClientRect() : null;

    return {
      vh,
      vw,
      hasScroll,
      rootScrollHeight,
      cardsCount: cards.length,
      cardsRects,
      skipButton: skipRect ? {
        top: Math.round(skipRect.top),
        bottom: Math.round(skipRect.bottom),
        height: Math.round(skipRect.height),
        overflow: skipRect.bottom > vh
      } : null
    };
  });

  await p.screenshot({ path: `${OUT}/cardpick-check-${label}.png` });
  console.log(`[${label}] Result:`, JSON.stringify(metrics, null, 2));
  await ctx.close();
}

try {
  await auditViewport('desktop', 1366, 768, false);
  await auditViewport('mobile915', 412, 915, true);
  await auditViewport('mobile740', 412, 740, true);
} catch (e) {
  console.error(e);
} finally {
  await b.close();
}
