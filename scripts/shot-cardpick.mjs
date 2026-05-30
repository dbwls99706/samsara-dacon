// 모바일(412×915) 카드 선택 화면 캡처 — 3장이 한 화면에 들어오는지 검증.
// 키보드 카이팅으로 XP 수집 → "카드 선택" 모달 뜨면 즉시 스크린샷(건너뛰지 않음).
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
const OUT = 'scripts/ui-out';
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true });

async function capture(label, viewport, dsf, isMobile) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: dsf, isMobile, hasTouch: isMobile });
  await ctx.addInitScript(() => { try { localStorage.setItem('samsara.tutorial.done', '1'); } catch {} });
  const p = await ctx.newPage();
  await p.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.locator('button:visible').filter({ hasText: /시작|PLAY|START/ }).first().click({ timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(800);
  await p.locator('canvas').first().click({ position: { x: viewport.width / 2, y: viewport.height * 0.45 } }).catch(() => {});

  const combos = [['ArrowRight'], ['ArrowDown'], ['ArrowLeft'], ['ArrowUp'], ['ArrowRight', 'ArrowDown'], ['ArrowLeft', 'ArrowUp']];
  let held = [];
  const found = () => p.evaluate(() => !!document.querySelector('.samsara-card'));
  let shot = false;
  for (let i = 0; i < 120; i++) {
    if (await found()) {
      for (const k of held) await p.keyboard.up(k).catch(() => {});
      await p.waitForTimeout(500);
      await p.screenshot({ path: `${OUT}/cardpick-${label}.png` });
      const info = await p.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.samsara-card'));
        const vh = window.innerHeight, vw = window.innerWidth;
        const rows = new Set(cards.map(c => Math.round(c.getBoundingClientRect().top / 20)));
        return {
          n: cards.length, rows: rows.size,
          rects: cards.map(c => { const r = c.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), offScreen: r.bottom > vh || r.right > vw }; }),
        };
      });
      console.log(`[${label}] vp=${viewport.width}x${viewport.height} cards=${info.n} rows=${info.rows} ` + JSON.stringify(info.rects));
      shot = true; break;
    }
    for (const k of held) await p.keyboard.up(k).catch(() => {});
    held = combos[i % combos.length];
    for (const k of held) await p.keyboard.down(k).catch(() => {});
    await p.waitForTimeout(500);
  }
  console.log(`[${label}] ${shot ? 'ok' : 'no-cardpick'}`);
  await ctx.close();
}

await capture('mobile', { width: 412, height: 915 }, 2, true);
await capture('desktop', { width: 1366, height: 768 }, 1, false);
await b.close();
