// 일시정지 풋터 겹침 검증 (결정적) — 일시정지를 연 뒤 무기 카드를 DOM 복제해 패널을
// 강제로 길게(무기 다수 시뮬) → 풋터가 무기패널과 겹치는지 + 컨테이너 스크롤 정상인지 측정.
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
const OUT = 'scripts/ui-out';
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ headless: true });

async function run(label, viewport, dsf, isMobile) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: dsf, isMobile, hasTouch: isMobile });
  await ctx.addInitScript(() => { try { localStorage.setItem('samsara.tutorial.done', '1'); } catch {} });
  const p = await ctx.newPage();
  await p.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  await p.locator('button:visible').filter({ hasText: /시작|PLAY|START/ }).first().click({ timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(3500); // 무기 1~2개 확보
  await p.keyboard.press('Escape').catch(() => {});
  await p.waitForTimeout(600);

  // 일시정지 정상 캡처 (적은 무기)
  await p.screenshot({ path: `${OUT}/pause2-${label}.png` });

  // 무기 카드 복제로 패널 강제 확장 (6개 시뮬)
  const measure = await p.evaluate(() => {
    const pw = document.getElementById('pause-weapons');
    const menu = document.getElementById('pause-menu');
    if (!pw || !menu || menu.style.display === 'none') return { paused: false };
    const cards = pw.querySelectorAll(':scope > div');
    const last = cards[cards.length - 1];
    if (last) for (let i = 0; i < 6; i++) pw.appendChild(last.cloneNode(true));
    // 풋터 = pause-menu 의 마지막 직계 텍스트 div
    const foot = Array.from(menu.children).find(e => /재개\s*클릭|ESC 또는/.test(e.textContent || ''));
    const a = pw.getBoundingClientRect();
    const c = foot ? foot.getBoundingClientRect() : null;
    return {
      paused: true,
      simulatedCards: pw.querySelectorAll(':scope > div').length,
      menuScrollable: menu.scrollHeight > menu.clientHeight,
      overlap: c ? !(a.right <= c.left || a.left >= c.right || a.bottom <= c.top || a.top >= c.bottom) : null,
      footTop: c ? Math.round(c.top) : null, pwBottom: Math.round(a.bottom),
    };
  });
  await p.waitForTimeout(200);
  await p.screenshot({ path: `${OUT}/pausemany-${label}.png` });
  console.log(`[${label}] vp=${viewport.width}x${viewport.height} ` + JSON.stringify(measure));
  await ctx.close();
}

await run('shortphone', { width: 412, height: 740 }, 2, true);
await run('desktop', { width: 1366, height: 768 }, 1, false);
await b.close();
console.log('done');
