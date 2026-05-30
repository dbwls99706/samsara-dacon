// W1→W2→W3 라이브 플레이 캡처 — FTUE 무기 라벨이 W3 에서 접히는지(progressive
// disclosure) 실제 실행으로 증명. 데스크톱(키보드 확실히 동작) + 8방향 촘촘 카이팅으로 생존.
// 레일 라벨 로직(renderWeaponHud)은 기기 무관이라 데스크톱 증명이 모바일에도 유효.
import { chromium } from 'playwright';
import { mkdirSync, existsSync, rmSync } from 'node:fs';
const OUT = 'scripts/ui-out';
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { try { localStorage.setItem('samsara.tutorial.done', '1'); } catch {} });
const p = await ctx.newPage();
const errors = [];
p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
p.on('pageerror', e => errors.push('PAGEERR: ' + e.message));

await p.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
await p.locator('button:visible').filter({ hasText: /시작|PLAY|START/ }).first().click({ timeout: 4000 }).catch(() => {});
await p.waitForTimeout(800);
// 캔버스 포커스 확보 (키보드 keydown 이 window 로 가도록)
await p.locator('canvas').first().click({ position: { x: 640, y: 360 } }).catch(() => {});

// 8방향 촘촘 카이팅 — 0.6s 마다 방향 회전, 대각선 포함해 계속 이동 = 적 무리 흘리기.
const combos = [['ArrowRight'], ['ArrowRight', 'ArrowUp'], ['ArrowUp'], ['ArrowUp', 'ArrowLeft'],
  ['ArrowLeft'], ['ArrowLeft', 'ArrowDown'], ['ArrowDown'], ['ArrowDown', 'ArrowRight']];
let ci = 0, held = [];
async function kite() {
  for (const k of held) await p.keyboard.up(k).catch(() => {});
  held = combos[ci % combos.length]; ci++;
  for (const k of held) await p.keyboard.down(k).catch(() => {});
}
// 카드 선택 모달이 뜨면 게임이 멈춘다 → 봇이 안 고르면 웨이브 진행 불가.
// "건너뛰기"(skip) 클릭으로 진행. (덱 구성은 이 테스트의 관심사 아님 — 웨이브 진행이 목적)
async function dismissCardPick() {
  const skip = p.locator('button:visible').filter({ hasText: /건너뛰기/ }).first();
  if (await skip.count().catch(() => 0)) {
    for (const k of held) await p.keyboard.up(k).catch(() => {}); held = [];
    await skip.click({ timeout: 1000 }).catch(() => {});
    return true;
  }
  return false;
}

async function probe(tag) {
  await dismissCardPick(); await p.waitForTimeout(700); // 모달 치우고 실제 HUD 캡처
  const info = await p.evaluate(() => {
    const wave = document.getElementById('hud-wave')?.textContent?.trim().replace(/\s+/g, ' ') ?? '?';
    const rail = document.getElementById('hud-weapons');
    const labels = rail ? Array.from(rail.querySelectorAll('div'))
      .map(d => (d.childElementCount === 0 ? (d.textContent || '').trim() : ''))
      .filter(t => t.length >= 2 && /[가-힣]/.test(t)) : [];
    const dead = !!document.body.textContent?.includes('GAME OVER');
    return { wave, labels, dead, hudPresent: !!rail };
  });
  console.log(`[${tag}] wave=${JSON.stringify(info.wave)} dead=${info.dead} railLabels=${JSON.stringify(info.labels)}`);
  await p.screenshot({ path: `${OUT}/${tag}.png` });
  return info;
}

await p.waitForTimeout(1800); // 카운트다운 종료 후 W1
await probe('wave1');

// ~33s 까지 카이팅 → W2
let t0 = Date.now();
while (Date.now() - t0 < 31000) { await dismissCardPick(); await kite(); await p.waitForTimeout(600); }
const w2 = await probe('wave2');

// ~+30s → W3
t0 = Date.now();
while (Date.now() - t0 < 30000) { await dismissCardPick(); await kite(); await p.waitForTimeout(600); }
const w3 = await probe('wave3');

for (const k of held) await p.keyboard.up(k).catch(() => {});
console.log('console_errors=' + JSON.stringify(errors));
console.log(`VERDICT: w2.wave=${w2.wave} w2.dead=${w2.dead} | w3.wave=${w3.wave} w3.dead=${w3.dead} w3.labels=${w3.labels.length}`);
await b.close();
console.log('done');
