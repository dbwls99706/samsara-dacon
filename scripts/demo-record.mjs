// Demo Record — SAMSARA 70초 시연 영상 헤드리스 자동 녹화.
// Playwright 의 page.video() 로 webm 캡처 → ffmpeg 로 mp4 변환은 사용자 영역.
// 시연 영상은 사용자가 OBS 로 직접 녹화하는 게 1순위지만, 이 스크립트는:
//   1. 사용자가 일정 빠듯해 OBS 못 돌릴 때 폴백
//   2. 컷 타이밍 검증 (docs/22_demo_video_shotlist.md 의 15컷 구조 가시화)
//   3. 1차 60% 동료 개발자에게 "헤드리스 봇이 70초 풀-플레이 한다" 라는 신뢰 시그널
//
// 사용: npm run demo:record [URL]
// 출력: scripts/demo-out/demo-<timestamp>.webm + scripts/demo-out/cuts.json (컷 메타)

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, renameSync, readdirSync } from 'fs';
import { join } from 'path';

const URL = process.argv[2] || 'http://localhost:4173/';
const OUT = 'scripts/demo-out';
mkdirSync(OUT, { recursive: true });

const TARGET_SEC = 75; // 70초 + 5초 여유 (게임 오버 컷 포함)
const VIEWPORT = { width: 412, height: 915 }; // 모바일 — 1차 60% 동료 개발자 + 심사자 폰 시청 가정

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  recordVideo: { dir: OUT, size: VIEWPORT },
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
});
const page = await ctx.newPage();

const cuts = [];
const cut = (sec, name) => cuts.push({ t: sec.toFixed(1), name });
const t0 = Date.now();
const elapsed = () => (Date.now() - t0) / 1000;

console.log(`[demo-record] target ${TARGET_SEC}s · viewport ${VIEWPORT.width}×${VIEWPORT.height} · URL ${URL}`);

// Cut 1 (0~3s): 메인 화면 — 캐치프레이즈 + 윤회 도감
cut(0, 'main-screen');
await page.goto(URL, { waitUntil: 'load', timeout: 15000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/cut01-main.png` });

// Cut 2 (3~5s): START 클릭 + 입력 hint
cut(elapsed(), 'start-click');
const startBtn = page.locator('text=/시작|START/i').first();
if (await startBtn.isVisible().catch(() => false)) {
  await startBtn.click();
}
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/cut02-start.png` });

// Cut 3 (5~15s): W1 진행 — 가상 조이스틱 드래그 + 자동 무기 발사
cut(elapsed(), 'w1-gameplay');
const canvas = page.locator('canvas').first();
const box = await canvas.boundingBox();
if (box) {
  // 8 방향 드래그 패턴 — 적 회피하며 코인 줍기
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dirs = [
    [0, -60], [50, -50], [70, 0], [50, 50],
    [0, 60], [-50, 50], [-70, 0], [-50, -50]
  ];
  for (let i = 0; i < 8; i++) {
    const [dx, dy] = dirs[i % 8];
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + dx, cy + dy, { steps: 6 });
    await page.waitForTimeout(800);
    await page.mouse.up();
    await page.waitForTimeout(200);
  }
}

// Cut 4 (15~30s): 콤보 ×25/50 임계 + 점수 폭발
cut(elapsed(), 'combo-threshold');
if (box) {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  for (let i = 0; i < 15; i++) {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + (i % 2 ? 60 : -60), cy + (i % 3 ? 40 : -40), { steps: 5 });
    await page.waitForTimeout(900);
    await page.mouse.up();
    await page.waitForTimeout(100);
  }
}
await page.screenshot({ path: `${OUT}/cut04-combo.png` });

// Cut 5 (30~35s): 카드 선택 — Run Identity 발현 핵심 컷
cut(elapsed(), 'card-pick');
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/cut05-cardpick.png` });
// 첫 번째 카드 클릭 (가운데)
const cardArea = page.locator('canvas, [class*="card"]').first();
if (await cardArea.isVisible().catch(() => false)) {
  await page.mouse.click(VIEWPORT.width / 2, VIEWPORT.height * 0.55);
}

// Cut 6 (35~55s): W2 진행 — 시너지 발현
cut(elapsed(), 'w2-synergy');
if (box) {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  for (let i = 0; i < 20; i++) {
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + Math.cos(i) * 70, cy + Math.sin(i) * 70, { steps: 4 });
    await page.waitForTimeout(800);
    await page.mouse.up();
    await page.waitForTimeout(150);
  }
}

// Cut 7 (55~70s): 게임 오버 — 사망 도장 + 환생 점수 + 윤회 도감 배지
cut(elapsed(), 'game-over');
// 적에 일부러 노출 위해 정지
await page.waitForTimeout(7000);
await page.screenshot({ path: `${OUT}/cut07-gameover.png` });

// 잔여 시간 채우기 — 하이라이트 / 공유 PNG 노출
while (elapsed() < TARGET_SEC) {
  await page.waitForTimeout(500);
}

cut(elapsed(), 'end');
const finalSec = elapsed();

await page.close();
await ctx.close();
await browser.close();

// 비디오 파일 이름 정리 — playwright 가 랜덤 이름 부여
let videoName = '';
try {
  const files = readdirSync(OUT).filter(f => f.endsWith('.webm'));
  if (files.length) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const newName = `demo-${ts}.webm`;
    renameSync(join(OUT, files[0]), join(OUT, newName));
    videoName = newName;
  }
} catch (e) { /* rename 실패해도 비디오는 존재 */ }

const report = {
  url: URL,
  duration_sec: +finalSec.toFixed(1),
  viewport: VIEWPORT,
  video_file: videoName || '(rename 실패 — 원본 파일명 확인)',
  cuts,
  note: '시연 영상 본 녹화는 사용자 OBS 권장. 본 헤드리스 캡처는 컷 타이밍 검증 + 폴백용.',
};
writeFileSync(`${OUT}/cuts.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(`\n[demo-record] 완료 → ${OUT}/${videoName}`);
