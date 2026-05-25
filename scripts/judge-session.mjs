// 심사위원 5분 풀 세션 시뮬레이션 — UX 폴리시 발견용
//
// 시나리오: 베테랑 심사위원이 메인 화면에서 START → 본 게임 진입 → 5분간 플레이
//
// 캡처 정책:
//   - main: 메인 화면 (0초)
//   - main+autodemo: 0.5초 (autodemo 한 프레임 후)
//   - 진입 직후: 캔버스 마운트 시점
//   - 매 15초 간격
//   - 카드 픽 화면 등장 즉시 (가장 중요)
//   - 시너지 발동 콜아웃 등장 즉시
//   - 보스 등장 즉시
//   - 게임 오버 화면 등장 즉시
//   - 하이라이트 릴 등장 즉시
//
// 출력:
//   scripts/judge-out/NN-event.png + judge-report.json + 타임라인 로그
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const URL = process.argv[2] || 'http://localhost:5173/';
const OUT = 'scripts/judge-out';
const SESSION_MS = 5 * 60 * 1000; // 5분
const PERIODIC_INTERVAL_MS = 15 * 1000; // 15초마다 캡처
const TAP_INTERVAL_MS = 130; // 인간 비슷한 탭 속도

if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
});

// 베테랑 모드 (튜토리얼 스킵)
await ctx.addInitScript(() => {
  try {
    localStorage.setItem('samsara.tutorial.done', '1');
  } catch {}
});

const page = await ctx.newPage();

const events = [];
const errors = [];
const warnings = [];
let frameCounter = 0;

function timestamp() {
  const t = Date.now() - sessionStart;
  return `t+${(t / 1000).toFixed(1)}s`;
}

async function snap(label) {
  const idx = String(frameCounter++).padStart(3, '0');
  const safe = label.replace(/[^a-z0-9_-]/gi, '_').slice(0, 40);
  const file = `${OUT}/${idx}-${safe}.png`;
  try {
    await page.screenshot({ path: file, fullPage: false });
    events.push({ at: timestamp(), label, file });
  } catch (e) {
    events.push({ at: timestamp(), label, file: null, err: e.message });
  }
}

page.on('console', (m) => {
  const type = m.type();
  const text = m.text();
  if (type === 'error') errors.push({ at: timestamp(), text });
  else if (type === 'warning') warnings.push({ at: timestamp(), text });
});
page.on('pageerror', (e) => errors.push({ at: timestamp(), text: 'PAGEERR: ' + e.message }));
page.on('requestfailed', (req) => {
  if (!req.url().includes('favicon')) {
    errors.push({ at: timestamp(), text: `REQ FAIL: ${req.failure()?.errorText} ${req.url()}` });
  }
});

const sessionStart = Date.now();

// [0] 페이지 로드
console.log('[0] loading...');
await page.goto(URL, { waitUntil: 'networkidle', timeout: 25000 });
await snap('00-page-loaded');

// [1] 메인 화면 — 0.5초 대기 후 (autodemo 한 프레임)
await page.waitForTimeout(700);
await snap('01-main-screen');

// [2] START 클릭 — "튜토리얼 건너뛰기 → 바로 플레이" 우선, 없으면 "▶ 시작"
let startClicked = false;
const skipLink = page.locator('text=/튜토리얼\\s*건너뛰기/').first();
if ((await skipLink.count()) > 0) {
  await skipLink.click({ timeout: 3000 });
  startClicked = true;
  events.push({ at: timestamp(), label: 'CLICK: 튜토리얼 건너뛰기' });
}
if (!startClicked) {
  const startBtn = page.locator('button:visible').filter({ hasText: /시작|바로\s*플레이|PLAY|START/ }).first();
  if ((await startBtn.count()) > 0) {
    await startBtn.click({ timeout: 3000 });
    startClicked = true;
    events.push({ at: timestamp(), label: 'CLICK: 시작' });
  }
}
events.push({ at: timestamp(), label: `start_clicked=${startClicked}` });

// [3] 캔버스 마운트
await page.waitForTimeout(2500);
const canvas = page.locator('canvas').first();
const canvasCount = await canvas.count();
events.push({ at: timestamp(), label: `canvas_count=${canvasCount}` });
await snap('02-canvas-mounted');

// [4] 메인 플레이 — 5분간 가상 조이스틱 이동 + 우측 탭 + 이벤트 감지
const VW = 412, VH = 915;
const tapX = Math.round(VW * 0.72);
const tapY = Math.round(VH * 0.42);
const joyX = Math.round(VW * 0.25);
const joyY = Math.round(VH * 0.78);
const JR = 60;
const dirs = [
  { dx: JR, dy: 0, name: 'E' },
  { dx: JR * 0.7, dy: -JR * 0.7, name: 'NE' },
  { dx: 0, dy: -JR, name: 'N' },
  { dx: -JR * 0.7, dy: -JR * 0.7, name: 'NW' },
  { dx: -JR, dy: 0, name: 'W' },
  { dx: -JR * 0.7, dy: JR * 0.7, name: 'SW' },
  { dx: 0, dy: JR, name: 'S' },
  { dx: JR * 0.7, dy: JR * 0.7, name: 'SE' },
];

// 이벤트 감지 셀렉터
const cardPickHeader = page.locator('h2', { hasText: '카드 선택' }).first();
const synergyBanner = page.locator('text=/★\\s*SYNERGY/').first();
const gameOverHeader = page.locator('text=/GAME\\s*OVER/').first();
const bossSignal = page.locator('text=/BOSS|보스/').first();
const highlightReel = page.locator('text=/하이라이트|HIGHLIGHT/').first();

let dirIdx = 0;
let lastPeriodic = Date.now();
let cardPickSnaps = 0;
let synergySnaps = 0;
let bossSnaps = 0;
let gameOverHit = false;

console.log('[4] playing session for 5 minutes...');

while (Date.now() - sessionStart < SESSION_MS) {
  const elapsed = Date.now() - sessionStart;

  // 주기적 캡처
  if (Date.now() - lastPeriodic >= PERIODIC_INTERVAL_MS) {
    await snap(`periodic-${Math.round(elapsed / 1000)}s`);
    lastPeriodic = Date.now();
  }

  // 이벤트 감지 (저비용 카운트 체크)
  try {
    if (await cardPickHeader.isVisible({ timeout: 50 }).catch(() => false)) {
      if (cardPickSnaps < 5) {
        await snap(`event-card-pick-${++cardPickSnaps}`);
      }
      // 첫 카드 선택 (좌측) — 게임 진행 위해
      const firstCard = page.locator('button:visible, [role="button"]:visible').filter({ hasText: /\S/ }).first();
      try { await firstCard.click({ timeout: 1000 }); } catch {}
      await page.waitForTimeout(500);
      continue;
    }
    if (await gameOverHeader.isVisible({ timeout: 50 }).catch(() => false)) {
      if (!gameOverHit) {
        await snap('event-game-over');
        gameOverHit = true;
        // 게임오버 후 1초 대기, 하이라이트 릴 등장
        await page.waitForTimeout(1500);
        await snap('event-highlight-reel');
        // "한 판 더" 클릭
        const retryBtn = page.locator('button:visible').filter({ hasText: /한 판 더|다시|RETRY/ }).first();
        if ((await retryBtn.count()) > 0) {
          try { await retryBtn.click({ timeout: 2000 }); } catch {}
          await page.waitForTimeout(2000);
          await snap('event-restart');
        }
      }
    }
    if (await synergyBanner.isVisible({ timeout: 50 }).catch(() => false)) {
      if (synergySnaps < 3) {
        await snap(`event-synergy-${++synergySnaps}`);
      }
    }
    if (await bossSignal.isVisible({ timeout: 50 }).catch(() => false)) {
      if (bossSnaps < 2) {
        await snap(`event-boss-${++bossSnaps}`);
      }
    }
  } catch {}

  // 가상 조이스틱 + 우측 탭 패턴
  const dir = dirs[dirIdx % dirs.length];
  dirIdx++;
  try {
    await page.mouse.move(joyX, joyY);
    await page.mouse.down();
    for (let s = 1; s <= 6; s++) {
      const px = joyX + (dir.dx * s) / 6;
      const py = joyY + (dir.dy * s) / 6;
      await page.mouse.move(px, py, { steps: 2 });
      await page.touchscreen.tap(tapX, tapY);
      await page.waitForTimeout(TAP_INTERVAL_MS);
    }
    await page.mouse.up();
  } catch {}
}

// 종료 캡처
await snap('99-final');

await browser.close();

const report = {
  url: URL,
  session_ms: SESSION_MS,
  total_events: events.length,
  total_errors: errors.length,
  total_warnings: warnings.length,
  card_pick_screens_captured: cardPickSnaps,
  synergy_callouts_captured: synergySnaps,
  boss_signals_captured: bossSnaps,
  game_over_hit: gameOverHit,
  events,
  errors,
  warnings,
};
writeFileSync(`${OUT}/judge-report.json`, JSON.stringify(report, null, 2));

console.log('\n=== SUMMARY ===');
console.log('Events:', events.length, '/ Errors:', errors.length, '/ Warnings:', warnings.length);
console.log('Captures: card pick', cardPickSnaps, '/ synergy', synergySnaps, '/ boss', bossSnaps, '/ game over', gameOverHit);
console.log('Output:', OUT);
