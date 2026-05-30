// P2 검증 — 복귀 플레이어(7버튼) 홈 하단 시드 ↔ 메뉴 겹침 / 일시정지 하단 텍스트 ↔ 무기패널 겹침.
// 짧은 뷰포트(데스크톱 1366×768, 짧은폰 412×740)에서 캡처 + 겹침 박스 교차 probe.
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
const OUT = 'scripts/ui-out';
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true });

const seedMeta = () => {
  try {
    localStorage.setItem('samsara.tutorial.done', '1');
    localStorage.setItem('samsara.meta.v2', JSON.stringify({
      schema: 2, savedAt: '2026-01-01T00:00:00.000Z',
      data: { totalCycles: 7, rp: 120, character: 'tiger', language: 'ko' },
    }));
  } catch {}
};

function rectsOverlap(a, b) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

async function home(label, viewport, dsf, isMobile) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: dsf, isMobile, hasTouch: isMobile });
  await ctx.addInitScript(seedMeta);
  const p = await ctx.newPage();
  await p.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `${OUT}/home-${label}.png` });
  const ov = await p.evaluate(() => {
    function rc(t) { const r = t.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; }
    const all = Array.from(document.querySelectorAll('#screen-host *, #app *'));
    const seed = all.find(e => /오늘의 윤회/.test(e.textContent || '') && e.children.length === 0);
    const btns = Array.from(document.querySelectorAll('.tap-press'));
    if (!seed) return { seedFound: false };
    const sr = rc(seed);
    const hit = btns.map(x => rc(x)).filter(br => !(sr.right <= br.left || sr.left >= br.right || sr.bottom <= br.top || sr.top >= br.bottom));
    return { seedFound: true, seedRect: { top: Math.round(sr.top), bottom: Math.round(sr.bottom) }, overlapsButtons: hit.length };
  });
  console.log(`[home-${label}] vp=${viewport.width}x${viewport.height} ` + JSON.stringify(ov));
  await ctx.close();
}

async function pause(label, viewport, dsf, isMobile) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: dsf, isMobile, hasTouch: isMobile });
  await ctx.addInitScript(seedMeta);
  const p = await ctx.newPage();
  await p.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.locator('button:visible').filter({ hasText: /시작|PLAY|START/ }).first().click({ timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(3000);
  await p.keyboard.press('Escape').catch(() => {});
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}/pause-${label}.png` });
  const ov = await p.evaluate(() => {
    function rc(t) { const r = t.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, h: r.height }; }
    const pw = document.getElementById('pause-weapons');
    const all = Array.from(document.querySelectorAll('#pause-menu *'));
    const foot = all.find(e => /재개|ESC/.test(e.textContent || '') && e.children.length === 0);
    if (!pw || !foot) return { found: false, pw: !!pw, foot: !!foot };
    const a = rc(pw), c = rc(foot);
    const overlap = !(a.right <= c.left || a.left >= c.right || a.bottom <= c.top || a.top >= c.bottom);
    return { found: true, pauseWeaponsBottom: Math.round(a.bottom), footTop: Math.round(c.top), overlap };
  });
  console.log(`[pause-${label}] vp=${viewport.width}x${viewport.height} ` + JSON.stringify(ov));
  await ctx.close();
}

await home('desktop', { width: 1366, height: 768 }, 1, false);
await home('shortphone', { width: 412, height: 740 }, 2, true);
await pause('desktop', { width: 1366, height: 768 }, 1, false);
await b.close();
console.log('done');
