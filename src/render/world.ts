// SAMSARA · 윤회 — 월드 렌더 (Canvas2D)
//
// 카메라 lerp + 그리드 배경 + 모든 엔티티 그리기.
// 호랑이는 SVG 를 미리 Image 로 디코딩해서 캔버스에 drawImage.

import type { World, Enemy, Projectile, Pickup, AreaEffect } from '../game/world.js';
import { drawAttackFx } from './attacks.js';
import {
  BIOME_TINT, elevationAt, getTerrainSeed, biomeAt,
  PEAK_THRESHOLD, sampleNoiseRaw,
} from '../game/terrain.js';

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let dpr = 1;

let tigerImg: HTMLImageElement | null = null;
let tigerLoaded = false;

// 캐릭터 + 적 + 픽업 스프라이트 사전 로드 (없으면 캔버스 도형 fallback)
const characterImgs: Record<string, HTMLImageElement> = {};
const enemyImgs: Record<string, HTMLImageElement> = {};
const pickupImgs: Record<string, HTMLImageElement> = {};
const imgLoaded: Record<string, boolean> = {};

function loadImg(map: Record<string, HTMLImageElement>, key: string, src: string) {
  const img = new Image();
  img.src = src;
  img.onload = () => { imgLoaded[src] = true; };
  img.onerror = () => { /* fallback to canvas drawing */ };
  map[key] = img;
}

const TAG_AURA: Record<string, string> = {
  fire: '#ff2a6d', ice: '#05d9e8', gold: '#ffd700',
  time: '#d300c5', chaos: '#ff6f00', echo: '#b3ff00',
};

export function initWorldRender(parent: HTMLElement): HTMLCanvasElement {
  canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;z-index:1;background:#0a0a1a';
  parent.appendChild(canvas);
  ctx = canvas.getContext('2d', { alpha: false });
  resize();
  window.addEventListener('resize', resize);
  // visualViewport 가 있으면(데스크탑 + 모바일 둘 다) 거기서도 size 추적 → 하단 잘림 방지
  const vv = (window as any).visualViewport;
  if (vv) { vv.addEventListener('resize', resize); vv.addEventListener('scroll', resize); }

  tigerImg = new Image();
  tigerImg.src = '/character/tiger.svg';
  tigerImg.onload = () => { tigerLoaded = true; imgLoaded['/character/tiger.svg'] = true; };

  // 캐릭터 5종 × (idle + walk1 + walk2 + attack) = 20 스프라이트
  for (const c of ['tiger', 'magpie', 'dokkaebi', 'gumiho', 'dragon']) {
    loadImg(characterImgs, c, `/character/${c}.svg`);
    loadImg(characterImgs, `${c}_walk1`, `/character/${c}_walk1.svg`);
    loadImg(characterImgs, `${c}_walk2`, `/character/${c}_walk2.svg`);
    loadImg(characterImgs, `${c}_attack`, `/character/${c}_attack.svg`);
  }

  // 적 5종
  loadImg(enemyImgs, 'jab', '/enemy/jab.svg');
  loadImg(enemyImgs, 'wonwi', '/enemy/wonwi.svg');
  loadImg(enemyImgs, 'dokkaebi', '/enemy/dokkaebi_e.svg');
  loadImg(enemyImgs, 'jangsan', '/enemy/jangsan.svg');
  loadImg(enemyImgs, 'boss', '/enemy/boss.svg');

  // 픽업 7종
  loadImg(pickupImgs, 'coin', '/pickup/coin.svg');
  loadImg(pickupImgs, 'xp', '/pickup/xp.svg');
  loadImg(pickupImgs, 'gem', '/pickup/gem.svg');
  loadImg(pickupImgs, 'heart', '/pickup/heart.svg');
  loadImg(pickupImgs, 'magnet', '/pickup/magnet.svg');
  loadImg(pickupImgs, 'bomb', '/pickup/bomb.svg');
  loadImg(pickupImgs, 'chest', '/pickup/chest.svg');

  return canvas;
}

export function getCharacterImg(id: string): HTMLImageElement | null {
  const img = characterImgs[id];
  return img && imgLoaded[img.src] ? img : null;
}
export function getEnemyImg(kind: string): HTMLImageElement | null {
  const img = enemyImgs[kind];
  return img && imgLoaded[img.src] ? img : null;
}
export function getPickupImg(kind: string): HTMLImageElement | null {
  const img = pickupImgs[kind];
  return img && imgLoaded[img.src] ? img : null;
}

function resize() {
  if (!canvas || !ctx) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const vv = (window as any).visualViewport;
  const w = vv?.width ?? window.innerWidth;
  const h = vv?.height ?? window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function getWorldCanvas(): HTMLCanvasElement | null { return canvas; }

// ─────────────────────────── 컬러 유틸 ───────────────────────────
// hex → 밝게/어둡게. enemy fallback / 그라디언트 등에 사용.
function clamp01(n: number): number { return n < 0 ? 0 : n > 1 ? 1 : n; }
function parseHex(c: string): [number, number, number] | null {
  if (c.length === 7 && c[0] === '#') {
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return [r, g, b];
  }
  return null;
}
function lighten(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const r = Math.round(rgb[0] + (255 - rgb[0]) * clamp01(amount));
  const g = Math.round(rgb[1] + (255 - rgb[1]) * clamp01(amount));
  const b = Math.round(rgb[2] + (255 - rgb[2]) * clamp01(amount));
  return `rgb(${r},${g},${b})`;
}
function darken(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const k = 1 - clamp01(amount);
  return `rgb(${Math.round(rgb[0] * k)},${Math.round(rgb[1] * k)},${Math.round(rgb[2] * k)})`;
}

// ─────────────────────────── 생동감 있는 배경 효과 (Grid, Biome, Dust) ───────────────────────────

// drawBiomeFloor removed for cleaner background

function drawDynamicGrid(ctx: CanvasRenderingContext2D, cx: number, cy: number, W: number, H: number, t: number) {
  const GRID_SIZE = 100;
  const offsetX = -(cx % GRID_SIZE);
  const offsetY = -(cy % GRID_SIZE);

  ctx.save();
  ctx.strokeStyle = 'rgba(5, 217, 232, 0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = offsetX; x < W; x += GRID_SIZE) {
    ctx.moveTo(x, 0); ctx.lineTo(x, H);
  }
  for (let y = offsetY; y < H; y += GRID_SIZE) {
    ctx.moveTo(0, y); ctx.lineTo(W, y);
  }
  ctx.stroke();

  // 네온 펄스 (데이터 흐름)
  const pulseX = ((t / 20) % (GRID_SIZE * 5)) + offsetX;
  const pulseY = ((t / 20) % (GRID_SIZE * 5)) + offsetY;
  
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(255, 42, 109, 0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pulseX, 0); ctx.lineTo(pulseX, H);
  ctx.moveTo(0, pulseY); ctx.lineTo(W, pulseY);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(5, 217, 232, 0.2)';
  ctx.beginPath();
  ctx.moveTo(pulseX - GRID_SIZE, 0); ctx.lineTo(pulseX - GRID_SIZE, H);
  ctx.moveTo(0, pulseY - GRID_SIZE); ctx.lineTo(W, pulseY - GRID_SIZE);
  ctx.stroke();
  ctx.restore();
}

function drawAtmosphereDust(ctx: CanvasRenderingContext2D, cx: number, cy: number, W: number, H: number, t: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.globalCompositeOperation = 'screen';
  const numDust = 40;
  for (let i = 0; i < numDust; i++) {
    const px = (((i * 2137 + t * 0.04 - cx * 0.2) % W) + W) % W;
    const py = (((i * 3421 + Math.sin(t * 0.001 + i) * 30 - cy * 0.2) % H) + H) % H;
    const size = 1 + (i % 2);
    ctx.globalAlpha = 0.1 + 0.4 * Math.max(0, Math.sin(t * 0.003 + i));
    ctx.fillRect(px, py, size, size);
  }
  ctx.restore();
}

// ─────────────────────────── 등고선 (Marching Squares) ───────────────────────────
// 펄린 elevation 의 임계 도등선을 셀 단위로 추적해 라인 segment 로 연결.
// 각 셀의 4 코너 elevation 을 샘플 → 4 edge 중 threshold 를 가로지르는 곳에 lerp 점 생성.
// 2/4 개의 교차점이면 두 점 연결. (16-case 풀 마칭 스퀘어의 단순화 — saddle 분리 생략.)

interface ContourLevel { v: number; r: number; g: number; b: number; a: number; }
const CONTOUR_STYLES: ContourLevel[] = [
  // ⭐ 알파 강화 (이전 대비 ×2) — 우주 배경에서 등고선 가시성 확보.
  { v: -0.30, r:  70, g: 130, b: 180, a: 0.35 },  // 저지대 / 협곡 (시안 강조)
  { v:  0.00, r: 180, g: 200, b: 210, a: 0.28 },  // 해수면 (밝은 회색)
  { v:  0.30, r: 220, g: 180, b: 130, a: 0.42 },  // 산기슭 (베이지 진함)
  { v:  0.40, r: 230, g: 150, b:  60, a: 0.52 },  // RIDGE — 등반선 (오렌지)
  { v:  0.55, r: 255, g: 215, b:   0, a: 0.65 },  // PEAK — 정상부 절벽 (선명한 황금)
];

function drawContours(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, W: number, H: number, seed: number, t: number,
): void {
  const STEP = 150;
  const startX = Math.floor((cx - W / 2 - STEP) / STEP) * STEP;
  const startY = Math.floor((cy - H / 2 - STEP) / STEP) * STEP;
  const endX = cx + W / 2 + STEP;
  const endY = cy + H / 2 + STEP;
  const cols = Math.ceil((endX - startX) / STEP) + 1;
  const rows = Math.ceil((endY - startY) / STEP) + 1;
  // 한 번만 elevation 샘플 — Float32Array 캐시
  const elev = new Float32Array(cols * rows);
  for (let c = 0; c < cols; c++) {
    const wx = startX + c * STEP;
    for (let r = 0; r < rows; r++) {
      const wy = startY + r * STEP;
      elev[r * cols + c] = elevationAt(wx, wy, seed);
    }
  }
  // peak 라인은 미세 펄스 (생명감) — t 기반 알파 변조
  const peakPulse = 0.85 + 0.15 * Math.sin(t / 800);
  ctx.save();
  ctx.lineWidth = 1;
  for (const lv of CONTOUR_STYLES) {
    const isPeak = lv.v >= PEAK_THRESHOLD - 0.001;
    const alpha = lv.a * (isPeak ? peakPulse : 1);
    ctx.strokeStyle = `rgba(${lv.r},${lv.g},${lv.b},${alpha})`;
    if (isPeak) {
      ctx.shadowColor = `rgba(${lv.r},${lv.g},${lv.b},0.6)`;
      ctx.shadowBlur = 4;
    } else {
      ctx.shadowBlur = 0;
    }
    ctx.beginPath();
    for (let c = 0; c < cols - 1; c++) {
      for (let r = 0; r < rows - 1; r++) {
        const e00 = elev[r * cols + c];
        const e10 = elev[r * cols + (c + 1)];
        const e01 = elev[(r + 1) * cols + c];
        const e11 = elev[(r + 1) * cols + (c + 1)];
        // 화면 좌표 (이 셀의 좌상단)
        const wx = startX + c * STEP;
        const wy = startY + r * STEP;
        const sx = (wx - cx) + W / 2;
        const sy = (wy - cy) + H / 2;
        const th = lv.v;
        // 4 edge crossing — 최대 4 점 (saddle case 는 두 쌍으로 처리)
        const px: number[] = [];
        const py: number[] = [];
        // top edge (e00 ↔ e10)
        if ((e00 < th) !== (e10 < th)) {
          const tt = (th - e00) / (e10 - e00 || 1e-9);
          px.push(sx + tt * STEP); py.push(sy);
        }
        // right edge (e10 ↔ e11)
        if ((e10 < th) !== (e11 < th)) {
          const tt = (th - e10) / (e11 - e10 || 1e-9);
          px.push(sx + STEP); py.push(sy + tt * STEP);
        }
        // bottom edge (e01 ↔ e11)
        if ((e01 < th) !== (e11 < th)) {
          const tt = (th - e01) / (e11 - e01 || 1e-9);
          px.push(sx + tt * STEP); py.push(sy + STEP);
        }
        // left edge (e00 ↔ e01)
        if ((e00 < th) !== (e01 < th)) {
          const tt = (th - e00) / (e01 - e00 || 1e-9);
          px.push(sx); py.push(sy + tt * STEP);
        }
        if (px.length >= 2) {
          ctx.moveTo(px[0], py[0]);
          ctx.lineTo(px[1], py[1]);
          if (px.length === 4) {
            ctx.moveTo(px[2], py[2]);
            ctx.lineTo(px[3], py[3]);
          }
        }
      }
    }
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ─────────────────────────── 그리기 ───────────────────────────

// 떠다니는 한자 (배경 깊이감) — 월드 좌표에 영구
// 배경 한자 제거 — 가시성 우선
interface BgGlyph { x: number; y: number; ch: string; size: number; alpha: number; rot: number; }
const bgGlyphs: BgGlyph[] = [];

// 지형 섹터 / 가이드 라인 제거 — 가시성 우선 (props 와 적이 한눈에 보이도록)
interface TerrainSector { x: number; y: number; r: number; color: string; label: string; }
const terrainSectors: TerrainSector[] = [];
interface TerrainLine { x1: number; y1: number; x2: number; y2: number; }
const terrainLines: TerrainLine[] = [];

// (mapDecos 는 world.ts 의 인터랙티브 props 로 이동됨)

// 배경 별 (월드 좌표, 시차 X, 카메라 좌표 기반 패럴렉스)
interface Star { x: number; y: number; size: number; alpha: number; twinkle: number; }
const bgStars: Star[] = (() => {
  const out: Star[] = [];
  for (let i = 0; i < 130; i++) {
    out.push({
      x: (Math.random() - 0.5) * 6000,
      y: (Math.random() - 0.5) * 6000,
      size: Math.random() < 0.05 ? 2.5 : Math.random() < 0.2 ? 1.5 : 1,
      alpha: 0.2 + Math.random() * 0.7,
      twinkle: Math.random() * Math.PI * 2,
    });
  }
  return out;
})();
// 은하수 클러스터 (몇몇 영역에 별 밀집)
interface Nebula { x: number; y: number; r: number; color: string; }
const bgNebulae: Nebula[] = [
  { x: -1200, y: -800, r: 900, color: '#b14aff' },
  { x: 1500, y: 600, r: 1200, color: '#05d9e8' },
  { x: -500, y: 1400, r: 700, color: '#ff2a6d' },
  { x: 2000, y: -1500, r: 800, color: '#ffd700' },
];

// 임시 호환 타입 (드로우 함수 시그니처)
interface DecoLite { kind: any; rot: number; size: number; seed: number; destroyedAt?: number; }

function drawDecoration(d: DecoLite, sx: number, sy: number, t: number) {
  if (!ctx) return;
  ctx.save();
  ctx.translate(sx, sy);

  // 파괴 모션 (조각나서 퍼지는 파편 효과)
  let shatter = 0;
  if (d.destroyedAt) {
    const elapsed = t - d.destroyedAt;
    shatter = Math.max(0, Math.min(1, elapsed / 1000));
    ctx.globalAlpha = 1 - Math.pow(shatter, 2); // 점점 빠르게 사라짐
    // 팽창 및 파편화 (스케일 + 미세 회전)
    ctx.scale(1 + shatter * 0.8, 1 + shatter * 0.8);
    ctx.rotate((Math.random() - 0.5) * shatter * 0.5);
    
    // 파편 입자들
    ctx.fillStyle = '#ff2a6d';
    ctx.shadowColor = '#ff2a6d';
    ctx.shadowBlur = 12;
    for(let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + d.seed;
      const dist = shatter * 50 * (0.5 + Math.sin(d.seed + i) * 0.5);
      ctx.fillRect(Math.cos(ang) * dist, Math.sin(ang) * dist, 3, 3);
    }
    ctx.shadowBlur = 0;
  }

  // ⭐ 변환 분기 — 탑다운 뷰 원근감 보존.
  //  - 공중에 떠있는 것(asteroid/stardust/blackhole/lantern)만 자유 회전.
  //  - 땅에 고정된 것(monolith/rocks/ruins/shrine/wreck/beacon/cursed_totem/mirror_shard/pressure_plate)
  //    은 절대 회전하지 않고 좌우 반전(flip)으로만 자연 변화 — "땅에 누운" 시각 오류 방지.
  const isFloating = d.kind === 'asteroid' || d.kind === 'stardust' || d.kind === 'blackhole' || d.kind === 'lantern';
  if (isFloating) {
    const spin = d.kind === 'asteroid' ? d.rot + t / 8000 : d.rot;
    ctx.rotate(spin);
    ctx.scale(d.size, d.size);
  } else {
    // 좌우 반전만 — d.rot 부호로 결정. 그림자/마커는 항상 아래/제자리 유지.
    const flip = d.rot >= 0 ? 1 : -1;
    ctx.scale(d.size * flip, d.size);
  }
  // ⭐ 스케일 보정 — scale(d.size) 적용 후 lineWidth/shadowBlur 가 size 만큼 부풀어 외곽선이
  // 굵어지는 시각 버그 방지. 모든 stroke/blur 에 invSize 곱해 화면 픽셀 기준 일정.
  const invSize = 1 / d.size;
  switch (d.kind) {
    case 'asteroid': {
      // 네오펑크 크리스탈 모노리스 (미니멀 육각형)
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      // 육각형 그림자
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + d.rot;
        const px = Math.cos(a) * 12 + 2, py = Math.sin(a) * 12 + 2;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      
      // 본체 (다크 퍼플-그레이)
      const grad = ctx.createLinearGradient(-10, -10, 10, 10);
      grad.addColorStop(0, '#3a2a4a');
      grad.addColorStop(1, '#1a1226');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#b14aff'; // 보라색 네온
      ctx.lineWidth = 1.5 * invSize;
      ctx.shadowColor = '#b14aff';
      ctx.shadowBlur = (8 + 4 * Math.sin(t / 400 + d.seed)) * invSize;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + d.rot;
        const px = Math.cos(a) * 12, py = Math.sin(a) * 12;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // 내부 코어 빛
      ctx.fillStyle = '#b14aff';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      break;
    }
    case 'stardust': {
      // 궤도 고리와 구체
      const a = 0.6 + 0.4 * Math.sin(t / 600 + d.seed);
      const corona = t / 1400 + d.seed;
      
      // 중심 발광 구체
      const cgrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 8);
      cgrad.addColorStop(0, `rgba(255, 255, 255, ${a})`);
      cgrad.addColorStop(0.5, `rgba(177, 74, 255, ${a * 0.8})`);
      cgrad.addColorStop(1, 'rgba(177, 74, 255, 0)');
      ctx.fillStyle = cgrad;
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
      
      // 회전하는 궤도 링 (기울어진 타원)
      ctx.save();
      ctx.rotate(corona);
      ctx.strokeStyle = `rgba(5, 217, 232, ${a * 0.7})`;
      ctx.lineWidth = 1.5 * invSize;
      ctx.shadowColor = '#05d9e8';
      ctx.shadowBlur = 6 * invSize;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 4, 0, 0, Math.PI * 2);
      ctx.stroke();
      
      // 궤도를 도는 미립자
      const orbX = Math.cos(corona * 3) * 14;
      const orbY = Math.sin(corona * 3) * 4;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(orbX, orbY, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      break;
    }
    case 'blackhole': {
      // 미니멀 블랙홀 — 완전한 검은 원 + 보라/마젠타 네온 링
      const rot = t / 900;
      
      // 강착 원반 (가장 밖의 흐릿한 링)
      ctx.save();
      ctx.rotate(rot * 0.3);
      const diskGrad = ctx.createLinearGradient(-24, 0, 24, 0);
      diskGrad.addColorStop(0, 'rgba(177, 74, 255, 0)');
      diskGrad.addColorStop(0.5, 'rgba(255, 42, 109, 0.8)');
      diskGrad.addColorStop(1, 'rgba(177, 74, 255, 0)');
      ctx.strokeStyle = diskGrad;
      ctx.lineWidth = 3 * invSize;
      ctx.shadowColor = '#ff2a6d';
      ctx.shadowBlur = 15 * invSize;
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // 밝은 네온 고리 (사건의 지평선 테두리)
      ctx.strokeStyle = '#b14aff';
      ctx.lineWidth = 1.5 * invSize;
      ctx.shadowColor = '#b14aff';
      ctx.shadowBlur = 10 * invSize;
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.stroke();

      // 완전한 칠흑의 코어
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#000000';
      ctx.beginPath(); ctx.arc(0, 0, 11.5, 0, Math.PI * 2); ctx.fill();
      
      break;
    }
    case 'lantern': {
      // 마름모 형태의 네온 케이지 + 푸른 광구
      const glow = 0.5 + 0.5 * Math.sin(t / 400 + d.seed);
      const float = Math.sin(t / 800 + d.seed) * 2;
      ctx.translate(0, float);

      // 상단 케이블
      ctx.strokeStyle = 'rgba(5, 217, 232, 0.4)';
      ctx.lineWidth = 1 * invSize;
      ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, -10); ctx.stroke();

      // 광구 (코어)
      const haloGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 12);
      haloGrad.addColorStop(0, `rgba(255, 255, 255, ${glow})`);
      haloGrad.addColorStop(0.4, `rgba(5, 217, 232, ${glow * 0.8})`);
      haloGrad.addColorStop(1, 'rgba(5, 217, 232, 0)');
      ctx.fillStyle = haloGrad;
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();

      // 마름모 케이지
      ctx.strokeStyle = '#05d9e8';
      ctx.lineWidth = 1.5 * invSize;
      ctx.shadowColor = '#05d9e8';
      ctx.shadowBlur = 8 * invSize;
      ctx.beginPath();
      ctx.moveTo(0, -10); ctx.lineTo(8, 0); ctx.lineTo(0, 10); ctx.lineTo(-8, 0);
      ctx.closePath();
      ctx.stroke();

      // 룬 기호 ✧ (영혼 마커)
      ctx.fillStyle = `rgba(255, 255, 255, ${0.85 + glow * 0.15})`;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowBlur = 0;
      ctx.fillText('✧', 0, 0.5);

      break;
    }
    case 'wreck': {
      // 기하학적 파편 + 붉은 네온 스파크
      const flash = Math.sin(t / 100 + d.seed) > 0.6 ? 1 : 0.3;

      // 검은 삼각형 프레임
      ctx.fillStyle = '#1a1426';
      ctx.strokeStyle = '#3a2c46';
      ctx.lineWidth = 2 * invSize;
      ctx.beginPath();
      ctx.moveTo(-12, 10); ctx.lineTo(12, 10); ctx.lineTo(0, -12);
      ctx.closePath();
      ctx.fill(); ctx.stroke();

      // 프레임 절단면 (어둡게)
      ctx.fillStyle = '#0a0510';
      ctx.beginPath();
      ctx.moveTo(-6, -2); ctx.lineTo(4, 2); ctx.lineTo(-2, 10);
      ctx.closePath();
      ctx.fill();

      // 노출된 붉은 회로 펄스
      ctx.strokeStyle = `rgba(255, 42, 109, ${flash})`;
      ctx.shadowColor = '#ff2a6d';
      ctx.shadowBlur = 8 * flash * invSize;
      ctx.lineWidth = 1.5 * invSize;
      ctx.beginPath();
      ctx.moveTo(-2, 2); ctx.lineTo(2, 6); ctx.lineTo(0, 10);
      ctx.stroke();
      
      // 코어 잔열 점
      ctx.fillStyle = '#ff2a6d';
      ctx.fillRect(-1, 0, 2, 2);
      ctx.shadowBlur = 0;
      break;
    }
    case 'shrine': {
      // 검은 오벨리스크 + 황금 네온
      const beamA = 0.3 + 0.2 * Math.sin(t / 700 + d.seed);
      
      // 상공으로 쏘는 빛기둥
      const beamGrad = ctx.createLinearGradient(0, -40, 0, -10);
      beamGrad.addColorStop(0, 'rgba(255, 215, 0, 0)');
      beamGrad.addColorStop(1, `rgba(255, 215, 0, ${beamA})`);
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(-3, -10); ctx.lineTo(-8, -40);
      ctx.lineTo(8, -40); ctx.lineTo(3, -10);
      ctx.closePath();
      ctx.fill();

      // 검은 오벨리스크 본체 (사다리꼴)
      ctx.fillStyle = '#0a0a1a';
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1.5 * invSize;
      ctx.beginPath();
      ctx.moveTo(-6, -10); ctx.lineTo(6, -10);
      ctx.lineTo(10, 14); ctx.lineTo(-10, 14);
      ctx.closePath();
      ctx.fill();

      // 황금 네온 윤곽선
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = (10 * beamA + 2) * invSize;
      ctx.stroke();

      // 중앙 문양 ◈ (봉인 마커)
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('◈', 0, 2);

      ctx.shadowBlur = 0;
      break;
    }
    // ⭐ 솔리드 지형지물 — 검은 비석. 황금 룬 + 무거운 그림자.
    case 'monolith': {
      // 그림자
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.beginPath();
      ctx.ellipse(2, 28, 26, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // 본체 — 어두운 모놀리스 (직사각형 + 비대칭)
      const grad = ctx.createLinearGradient(-22, -34, 22, 34);
      grad.addColorStop(0, '#15101a');
      grad.addColorStop(0.5, '#26202c');
      grad.addColorStop(1, '#0a0612');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-18, -34);
      ctx.lineTo(18, -34);
      ctx.lineTo(22, 28);
      ctx.lineTo(-22, 28);
      ctx.closePath();
      ctx.fill();
      // 외곽선 (황금)
      ctx.strokeStyle = 'rgba(255,215,0,0.45)';
      ctx.lineWidth = 1.5 * invSize;
      ctx.stroke();
      // 황금 룬 (펄스)
      const runePulse = 0.5 + 0.5 * Math.sin(t / 600 + d.seed);
      ctx.fillStyle = `rgba(255,215,0,${0.7 + runePulse * 0.3})`;
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 10 * invSize;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('▲', 0, -10);
      ctx.fillText('◇', 0, 8);
      ctx.shadowBlur = 0;
      break;
    }
    // ⭐ 솔리드 지형지물 — 회색 바위 군집 (3~5개 클러스터)
    case 'rocks': {
      // 그림자
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.ellipse(2, 22, 24, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      // 메인 바위 (큰 거 1) — ⭐ 네오펑크 우주 팔레트(인디고/슬레이트)로. 지구 회색 X.
      const rg1 = ctx.createRadialGradient(-6, -8, 0, -6, -8, 24);
      rg1.addColorStop(0, '#4a4468');
      rg1.addColorStop(0.6, '#2c2742');
      rg1.addColorStop(1, '#161222');
      ctx.fillStyle = rg1;
      ctx.beginPath();
      ctx.moveTo(-22, -2); ctx.lineTo(-14, -22); ctx.lineTo(8, -20); ctx.lineTo(20, -4); ctx.lineTo(14, 18); ctx.lineTo(-12, 16); ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 1.5 * invSize;
      ctx.stroke();
      // 작은 바위 2개 (옆에)
      ctx.fillStyle = '#2c2742';
      ctx.beginPath();
      ctx.moveTo(14, -16); ctx.lineTo(22, -8); ctx.lineTo(20, 4); ctx.lineTo(10, 0); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-18, 8); ctx.lineTo(-22, 20); ctx.lineTo(-10, 22); ctx.lineTo(-8, 12); ctx.closePath();
      ctx.fill(); ctx.stroke();
      // 하이라이트 (은은한 보라 림 — 네온 씬과 통합)
      ctx.fillStyle = 'rgba(177,140,255,0.18)';
      ctx.beginPath();
      ctx.ellipse(-6, -10, 8, 4, -0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    // ⭐ 신규 — 압전판 (pressure_plate): 평평한 원판 + 활성 시 빨간 깜빡임
    case 'pressure_plate' as any: {
      const dd = d as any;
      const fuse = dd.plateFuse as number | undefined;
      const active = fuse != null && fuse > 0 && fuse < 1.0;
      const blinkRate = active ? 8 + (1 - fuse) * 20 : 0;  // 임박할수록 빠르게 깜빡
      const blink = active ? (Math.sin(t / 1000 * blinkRate * Math.PI * 2) > 0 ? 1 : 0.3) : 1;
      // 외곽 링 (땅에 박힌 느낌)
      ctx.fillStyle = active ? `rgba(255, 170, 0, ${0.5 + 0.5 * blink})` : '#1a1a2a';
      ctx.beginPath();
      ctx.ellipse(0, 4, 22, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      // 본체 — 8각형 압전판
      ctx.fillStyle = active ? `rgba(60, 30, 5, 1)` : '#2a2230';
      ctx.strokeStyle = active ? `rgba(255, 170, 0, ${blink})` : '#888';
      ctx.lineWidth = 2 * invSize;
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur = active ? 14 * blink * invSize : 0;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const px = Math.cos(a) * 18, py = Math.sin(a) * 6;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // 중앙 마커 ◉
      ctx.shadowBlur = 0;
      ctx.fillStyle = active ? `rgba(255, 255, 255, ${blink})` : '#666';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('◉', 0, 1);
      // 활성 시 폭발 반경 외곽 (220px) 표시
      if (active && ctx.globalAlpha === 1) {
        ctx.strokeStyle = `rgba(255, 100, 0, ${0.15 + 0.25 * blink})`;
        ctx.lineWidth = 1.5 * invSize;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(0, 0, 110, 0, Math.PI * 2);  // d.size 곱은 외부에서 이미 적용 (대략 표시)
        ctx.stroke();
        ctx.setLineDash([]);
      }
      break;
    }
    // ⭐ 신규 — 봉화 (beacon): 불기둥 + 펄스
    case 'beacon' as any: {
      const flame = 0.7 + 0.3 * Math.sin(t / 250 + d.seed);
      const flickerY = Math.sin(t / 180 + d.seed * 2) * 1.5;
      // 그림자
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.ellipse(2, 16, 16, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // 받침대 (검은 돌)
      ctx.fillStyle = '#1a1626';
      ctx.strokeStyle = '#3a2c46';
      ctx.lineWidth = 1.5 * invSize;
      ctx.beginPath();
      ctx.moveTo(-10, 12); ctx.lineTo(10, 12); ctx.lineTo(8, 0); ctx.lineTo(-8, 0); ctx.closePath();
      ctx.fill(); ctx.stroke();
      // 불꽃 (3겹)
      ctx.globalCompositeOperation = 'lighter';
      const flameGrad = ctx.createRadialGradient(0, -8 + flickerY, 0, 0, -8 + flickerY, 16);
      flameGrad.addColorStop(0, `rgba(255, 255, 100, ${flame})`);
      flameGrad.addColorStop(0.5, `rgba(255, 111, 0, ${flame * 0.8})`);
      flameGrad.addColorStop(1, 'rgba(255, 42, 109, 0)');
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.arc(0, -8 + flickerY, 16, 0, Math.PI * 2);
      ctx.fill();
      // 코어 (밝은 점)
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, -8 + flickerY, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      // 펄스 링 (영향 반경 250px hint — 시각만, 본 prop radius 와 무관)
      ctx.strokeStyle = `rgba(255, 111, 0, ${0.15 + 0.1 * Math.sin(t / 400 + d.seed)})`;
      ctx.lineWidth = 1 * invSize;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, 70, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }
    // ⭐ 신규 — 거울 파편 (mirror_shard): 시안 다이아 + 반사 표면
    case 'mirror_shard' as any: {
      const shimmer = 0.6 + 0.4 * Math.sin(t / 300 + d.seed);
      // 그림자
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(2, 18, 16, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // 다이아 본체 (네온 시안)
      const dg = ctx.createLinearGradient(-14, -14, 14, 14);
      dg.addColorStop(0, '#0d3a44');
      dg.addColorStop(0.5, '#05d9e8');
      dg.addColorStop(1, '#0d3a44');
      ctx.fillStyle = dg;
      ctx.strokeStyle = `rgba(5, 217, 232, ${shimmer})`;
      ctx.lineWidth = 1.5 * invSize;
      ctx.shadowColor = '#05d9e8';
      ctx.shadowBlur = 10 * shimmer * invSize;
      ctx.beginPath();
      ctx.moveTo(0, -16); ctx.lineTo(14, 0); ctx.lineTo(0, 16); ctx.lineTo(-14, 0); ctx.closePath();
      ctx.fill(); ctx.stroke();
      // 반사 표면 (밝은 줄)
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(255, 255, 255, ${shimmer * 0.9})`;
      ctx.lineWidth = 1.2 * invSize;
      ctx.beginPath();
      ctx.moveTo(-6, -8); ctx.lineTo(8, 6);
      ctx.moveTo(-8, -2); ctx.lineTo(2, 10);
      ctx.stroke();
      // 중앙 마커
      ctx.fillStyle = `rgba(255, 255, 255, ${shimmer})`;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('◈', 0, 0.5);
      break;
    }
    // ⭐ 신규 — 저주 토템 (cursed_totem): 마젠타 해골 + 어두운 오라
    case 'cursed_totem' as any: {
      const pulse = 0.5 + 0.5 * Math.sin(t / 220 + d.seed);
      // 그림자 (커다란, 검정 + 보라)
      ctx.fillStyle = 'rgba(50, 0, 50, 0.7)';
      ctx.beginPath();
      ctx.ellipse(2, 22, 22, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      // 토템 기둥 (검은-마젠타 그라데)
      const tg = ctx.createLinearGradient(0, -22, 0, 22);
      tg.addColorStop(0, '#1a0510');
      tg.addColorStop(0.5, '#3a0a26');
      tg.addColorStop(1, '#0a0506');
      ctx.fillStyle = tg;
      ctx.strokeStyle = `rgba(211, 0, 197, ${0.6 + pulse * 0.4})`;
      ctx.lineWidth = 1.8 * invSize;
      ctx.shadowColor = '#d300c5';
      ctx.shadowBlur = 12 * pulse * invSize;
      ctx.beginPath();
      // 사다리꼴 + 위가 좁음 (토템 느낌)
      ctx.moveTo(-10, -22); ctx.lineTo(10, -22);
      ctx.lineTo(14, 22); ctx.lineTo(-14, 22);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      // 해골 ☠ 마커 (위)
      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(211, 0, 197, ${0.85 + pulse * 0.15})`;
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('☠', 0, -8);
      // 룬 (아래)
      ctx.fillStyle = '#d300c5';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('卍', 0, 10);
      // 어두운 오라 (글로벌 알파로)
      ctx.globalCompositeOperation = 'lighter';
      const auraGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 38);
      auraGrad.addColorStop(0, `rgba(211, 0, 197, ${0.18 * pulse})`);
      auraGrad.addColorStop(1, 'rgba(211, 0, 197, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      break;
    }
    // ⭐ 솔리드 지형지물 — 무너진 기둥 (사다리꼴)
    case 'ruins': {
      // 그림자
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath();
      ctx.ellipse(2, 22, 22, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      // 본체 (사다리꼴 — 무너진 듯)
      const cgrad = ctx.createLinearGradient(0, -22, 0, 22);
      cgrad.addColorStop(0, '#7a6a58');
      cgrad.addColorStop(0.5, '#5a4a38');
      cgrad.addColorStop(1, '#3a2a1c');
      ctx.fillStyle = cgrad;
      ctx.beginPath();
      ctx.moveTo(-14, -22); ctx.lineTo(14, -22); ctx.lineTo(18, 22); ctx.lineTo(-18, 22); ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 1.5 * invSize;
      ctx.stroke();
      // 가로 균열 (decorative)
      ctx.strokeStyle = 'rgba(20,12,4,0.6)';
      ctx.lineWidth = 1 * invSize;
      ctx.beginPath();
      ctx.moveTo(-15, -8); ctx.lineTo(15, -8);
      ctx.moveTo(-16, 6); ctx.lineTo(16, 6);
      ctx.stroke();
      // 위쪽 — 부서진 톱니
      ctx.fillStyle = '#7a6a58';
      ctx.beginPath();
      ctx.moveTo(-14, -22);
      ctx.lineTo(-10, -26); ctx.lineTo(-6, -22);
      ctx.lineTo(-2, -25); ctx.lineTo(2, -22);
      ctx.lineTo(6, -27); ctx.lineTo(10, -22); ctx.lineTo(14, -22);
      ctx.lineTo(14, -20); ctx.lineTo(-14, -20);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1 * invSize;
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

// 처치 폭발 (월드 좌표)
interface KillBurst { x: number; y: number; t0: number; color: string; size: number; }
const killBursts: KillBurst[] = [];
export function spawnKillBurst(x: number, y: number, color = '#ffd700', size = 1) {
  killBursts.push({ x, y, t0: performance.now(), color, size });
  if (killBursts.length > 60) killBursts.shift();
}

// 보스 패턴 텔레그래프 — beam(돌진) / ring(링형 탄막) / circle(소환).
// ttl 진행도 = 1 → 0 으로 알파 / 두께 보간. 빨강/보라 펄스로 위협 인지.
function drawBossTelegraphs(ctx: CanvasRenderingContext2D, world: World, cx: number, cy: number, W: number, H: number) {
  const rt = world.bossRuntime;
  if (!rt || rt.telegraphData.length === 0) return;
  for (const tg of rt.telegraphData) {
    const progress = 1 - Math.max(0, Math.min(1, tg.ttl / tg.ttlMax));   // 0→1 진행
    const sx = (tg.pos.x - cx) + W / 2;
    const sy = (tg.pos.y - cy) + H / 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (tg.kind === 'beam' && tg.dir && tg.len && tg.width) {
      ctx.translate(sx, sy);
      ctx.rotate(Math.atan2(tg.dir.y, tg.dir.x));
      const w = tg.width * (0.6 + 0.4 * progress);
      const grad = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
      grad.addColorStop(0,   'rgba(255,42,109,0)');
      grad.addColorStop(0.5, `rgba(255,42,109,${0.35 + 0.45 * progress})`);
      grad.addColorStop(1,   'rgba(255,42,109,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, -w / 2, tg.len, w);
      // 끝부분 화살표
      ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * progress})`;
      ctx.beginPath();
      ctx.moveTo(tg.len, -w * 0.6);
      ctx.lineTo(tg.len + 18, 0);
      ctx.lineTo(tg.len, w * 0.6);
      ctx.closePath();
      ctx.fill();
    } else if (tg.kind === 'ring' && tg.radius) {
      const r = tg.radius * (0.6 + 0.4 * progress);
      ctx.strokeStyle = tg.color;
      ctx.lineWidth = 4 + 4 * progress;
      ctx.shadowColor = tg.color;
      ctx.shadowBlur = 18;
      ctx.globalAlpha = 0.55 + 0.35 * progress;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.stroke();
    } else if (tg.kind === 'circle' && tg.radius) {
      const r = tg.radius;
      const grad = ctx.createRadialGradient(sx, sy, r * 0.3, sx, sy, r);
      grad.addColorStop(0, `rgba(211,0,197,${0.05 + 0.15 * progress})`);
      grad.addColorStop(1, `rgba(211,0,197,${0.4 + 0.4 * progress})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      // 중심 펄스
      ctx.fillStyle = `rgba(255,200,255,${progress * 0.6})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 6 + 4 * Math.sin(progress * Math.PI), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// 도장 텍스트 (콤보 임계값 시 화면 중앙 큰 한자)
interface StampText { text: string; t0: number; color: string; }
const stamps: StampText[] = [];
export function spawnStamp(text: string, color = '#ff2a6d') {
  stamps.push({ text, t0: performance.now(), color });
}

export function drawWorld(world: World, runIdentity: string | null, t: number): void {
  if (!ctx || !canvas) return;
  const W = canvas.width / dpr;
  const H = canvas.height / dpr;
  const cx = world.camera.x;
  const cy = world.camera.y;

  // ⭐ 자동 카메라 줌 — 배경은 줌 없이, 월드 엔티티만 zoom (위협 인지 + 모바일 가독성).
  // 배경(그라디언트/성운/별)은 화면 가득 그대로, 엔티티는 화면 중앙 기준 scale.
  const zoom = world.cameraZoom || 1;

  // ── 배경 — 깊은 우주 그라디언트 (다층 + 미세 비네트) ──
  const bgGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.8);
  bgGrad.addColorStop(0, '#0e0822');
  bgGrad.addColorStop(0.4, '#080520');
  bgGrad.addColorStop(0.75, '#04020e');
  bgGrad.addColorStop(1, '#01000a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // ── 성운 — 큰 색 클러스터 (다층 patches + 부드러운 펄스) ──
  for (const n of bgNebulae) {
    const sx = (n.x - cx) * 0.3 + W / 2;
    const sy = (n.y - cy) * 0.3 + H / 2;
    if (sx + n.r < 0 || sx - n.r > W || sy + n.r < 0 || sy - n.r > H) continue;
    const pulse = 0.85 + 0.15 * Math.sin(t / 4000 + n.x * 0.001);
    const r = n.r * pulse;
    // 메인 헤일로
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    grad.addColorStop(0, n.color + '12'); // 은은하게 낮춤 (was 40)
    grad.addColorStop(0.4, n.color + '05'); // was 18
    grad.addColorStop(1, n.color + '00');
    ctx.fillStyle = grad;
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    // 내부 코어 (밝은 색)
    const inner = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 0.3);
    inner.addColorStop(0, n.color + '15'); // was 55
    inner.addColorStop(1, n.color + '00');
    ctx.fillStyle = inner;
    ctx.fillRect(sx - r * 0.3, sy - r * 0.3, r * 0.6, r * 0.6);
  }

  // ── 별 (다층 패럴렉스 — 깊이감) ──
  ctx.save();
  // 깊은 별 (0.3x 패럴렉스, 작고 어둡게)
  for (let i = 0; i < bgStars.length; i += 2) {
    const s = bgStars[i];
    const sx = (s.x - cx) * 0.3 + W / 2;
    const sy = (s.y - cy) * 0.3 + H / 2;
    if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
    const tw = 0.6 + 0.4 * Math.sin(t / 700 + s.twinkle);
    ctx.globalAlpha = s.alpha * tw * 0.5;
    ctx.fillStyle = '#aaccff';
    ctx.fillRect(sx, sy, s.size * 0.7, s.size * 0.7);
  }
  // 가까운 별 (0.6x 패럴렉스, 글로우)
  for (let i = 1; i < bgStars.length; i += 2) {
    const s = bgStars[i];
    const sx = (s.x - cx) * 0.6 + W / 2;
    const sy = (s.y - cy) * 0.6 + H / 2;
    if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;
    const tw = 0.7 + 0.3 * Math.sin(t / 600 + s.twinkle);
    ctx.globalAlpha = s.alpha * tw;
    const c = s.size > 2 ? '#ffd7e0' : s.size > 1.2 ? '#aaccff' : '#ffffff';
    ctx.fillStyle = c;
    if (s.size > 2) {
      ctx.shadowColor = c;
      ctx.shadowBlur = 6;
      ctx.fillRect(sx, sy, s.size, s.size);
      // 4점 광채 (큰 별)
      ctx.globalAlpha = s.alpha * tw * 0.6;
      ctx.fillRect(sx - 2, sy + s.size / 2 - 0.3, s.size + 4, 0.6);
      ctx.fillRect(sx + s.size / 2 - 0.3, sy - 2, 0.6, s.size + 4);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillRect(sx, sy, s.size, s.size);
    }
  }
  ctx.restore();

  // ── 생동감 있는 바닥 렌더링 (Dust) ──
  drawAtmosphereDust(ctx, cx, cy, W, H, t);

  // 지형 섹터와 라인 렌더링을 제거하여 배경을 자연스럽게 유지.

  // ── 인터랙티브 월드 오브젝트 (props) — Y 정렬하여 원근감(Perspective) 교정 ──
  ctx.save();
  const sortedProps = [...world.props].sort((a, b) => a.pos.y - b.pos.y);
  for (const p of sortedProps) {
    const dsx = (p.pos.x - cx) + W / 2;
    const dsy = (p.pos.y - cy) + H / 2;
    const margin = 120;
    if (dsx < -margin || dsx > W + margin || dsy < -margin || dsy > H + margin) continue;

    // 파괴 애니 (1초 fade + 다층 shockwave)
    const destroying = p.destroyedAt != null;
    if (destroying) {
      const k = (t - (p.destroyedAt as number)) / 1000;
      const kind = p.kind;
      const ringColor = kind === 'shrine' ? '#ffd700'
                      : kind === 'wreck' ? '#ff8866'
                      : kind === 'asteroid' ? '#b14aff'
                      : '#b14aff';
      ctx.save();
      // 본체 잔영 (수축)
      ctx.globalAlpha = Math.max(0, 1 - k * 1.4);
      ctx.translate(dsx, dsy);
      ctx.scale(1 + k * 0.3, 1 + k * 0.3);
      ctx.translate(-dsx, -dsy);
      drawDecoration(p as any, dsx, dsy, t);
      ctx.restore();
      // 다중 shockwave (3겹)
      ctx.save();
      ctx.shadowColor = ringColor;
      for (let ri = 0; ri < 3; ri++) {
        const phase = k - ri * 0.12;
        if (phase <= 0) continue;
        const rad = 18 + phase * 140;
        ctx.globalAlpha = Math.max(0, 0.7 - phase * 0.9);
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = Math.max(0.3, 4 - phase * 4);
        ctx.shadowBlur = 18 - ri * 5;
        ctx.beginPath(); ctx.arc(dsx, dsy, rad, 0, Math.PI * 2); ctx.stroke();
      }
      // 중심 백색 섬광 (초반 0.2초)
      if (k < 0.25) {
        ctx.globalAlpha = (1 - k / 0.25) * 0.9;
        const flashGrad = ctx.createRadialGradient(dsx, dsy, 0, dsx, dsy, 40);
        flashGrad.addColorStop(0, '#ffffff');
        flashGrad.addColorStop(0.4, ringColor);
        flashGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = flashGrad;
        ctx.beginPath(); ctx.arc(dsx, dsy, 40, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      continue;
    }

    // ⭐ 지면 그림자 및 앰비언트 글로우 — 땅에 닿은 prop 모두. 공중 prop 제외.
    // 그림자는 항상 prop 아래(+y) 에 고정 — 회전·flip 영향 받지 않음.
    {
      const grounded = (
        p.kind === 'wreck' || p.kind === 'shrine' ||
        p.kind === 'monolith' || p.kind === 'rocks' || p.kind === 'ruins' ||
        p.kind === 'beacon' || p.kind === 'cursed_totem' ||
        p.kind === 'mirror_shard' || p.kind === 'pressure_plate'
      );
      if (grounded) {
        ctx.save();
        // 주변 앰비언트 글로우 (오브젝트가 배경과 어우러지게 바닥에 색 번짐 효과)
        let glow = 'rgba(0,0,0,0)';
        if (p.kind === 'shrine') glow = 'rgba(255, 215, 0, 0.15)'; // 황금
        else if (p.kind === 'wreck') glow = 'rgba(255, 42, 109, 0.15)'; // 핑크
        else if (p.kind === 'beacon') glow = 'rgba(255, 111, 0, 0.2)'; // 오렌지
        else if (p.kind === 'cursed_totem') glow = 'rgba(211, 0, 197, 0.15)'; // 마젠타
        else if (p.kind === 'mirror_shard') glow = 'rgba(5, 217, 232, 0.15)'; // 시안
        else if (p.kind === 'pressure_plate') glow = 'rgba(255, 170, 0, 0.15)';
        
        if (glow !== 'rgba(0,0,0,0)') {
          ctx.globalCompositeOperation = 'screen';
          const gGrad = ctx.createRadialGradient(dsx, dsy, 0, dsx, dsy, p.radius * 2.5);
          gGrad.addColorStop(0, glow);
          gGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gGrad;
          ctx.fillRect(dsx - p.radius * 2.5, dsy - p.radius * 2.5, p.radius * 5, p.radius * 5);
          ctx.globalCompositeOperation = 'source-over';
        }
        
        ctx.globalAlpha = 0.40;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(dsx, dsy + p.radius * 0.85, p.radius * 0.95, p.radius * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 피격 흰 플래시
    if (p.hitFlashUntil > t) {
      const flashA = (p.hitFlashUntil - t) / 120;
      drawDecoration(p as any, dsx, dsy, t);
      ctx.save();
      ctx.globalAlpha = flashA * 0.85;
      ctx.globalCompositeOperation = 'lighter';
      const fg = ctx.createRadialGradient(dsx, dsy, 0, dsx, dsy, p.radius + 8);
      fg.addColorStop(0, '#ffffff');
      fg.addColorStop(0.6, 'rgba(255,255,255,0.4)');
      fg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(dsx, dsy, p.radius + 8, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else {
      drawDecoration(p as any, dsx, dsy, t);
    }

    // ── 머리 위 아이콘 라벨 (큰 이모지 + 펄스 — "여기 가서 먹어!" 시그널) ──
    {
      const labelMap: Record<string, { icon: string; color: string }> = {
        shrine:    { icon: '★', color: '#ffd700' },  // 보상 + Pray
        wreck:     { icon: '♥', color: '#ff3366' },  // 체력 (점진 채굴)
        stardust:  { icon: '⚡', color: '#b14aff' },  // 부스트 (Adaptive)
        asteroid:  { icon: '◆', color: '#7a6088' },  // Kinetic
        blackhole: { icon: '⚠', color: '#ff2a6d' },  // 위험
        lantern:   { icon: '❄', color: '#05d9e8' },  // 슬로우 영역
        // ⭐ 신규 props 라벨 (자연물은 라벨 제거하여 시각적 복잡도 감소)
        pressure_plate: { icon: '◉', color: '#ffaa00' },  // 압전판 — Chicken
        beacon:         { icon: '☼', color: '#ff6f00' },  // 봉화 — Greed
        mirror_shard:   { icon: '◈', color: '#05d9e8' },  // 거울 — 반사
        cursed_totem:   { icon: '☠', color: '#d300c5' },  // 저주 — Stag Hunt
      };
      const lab = labelMap[p.kind];
      if (lab && !p.consumed) {
        const labY = dsy - p.radius - 22;
        const pulse = 0.85 + 0.15 * Math.sin(t / 280 + p.seed);
        ctx.save();
        // 둥근 배경
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.beginPath();
        ctx.arc(dsx, labY, 11, 0, Math.PI * 2);
        ctx.fill();
        // 보더 (글로우)
        ctx.strokeStyle = lab.color;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = lab.color;
        ctx.shadowBlur = 10 * pulse;
        ctx.stroke();
        // 아이콘
        ctx.shadowBlur = 0;
        ctx.fillStyle = lab.color;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(lab.icon, dsx, labY + 0.5);
        ctx.restore();
      }
    }

    // 파괴 가능한 prop 의 HP 바 (체력 90% 이하부터, 라운드+그라데이션)
    // ⭐ destructible 전체 — shrine/wreck/asteroid/monolith/rocks/ruins/beacon/cursed_totem
    const destructibleForHpBar = (
      p.kind === 'shrine' || p.kind === 'wreck' || p.kind === 'asteroid' ||
      p.kind === 'monolith' || p.kind === 'rocks' || p.kind === 'ruins' ||
      p.kind === 'beacon' || p.kind === 'cursed_totem'
    );
    if (destructibleForHpBar && p.hp < p.hpMax * 0.9) {
      const ratio = Math.max(0, p.hp / p.hpMax);
      const w = 36, h = 4, x = dsx - w / 2, y = dsy - p.radius - 10;
      const r = 2;
      // 배경 (라운드)
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.beginPath();
      (ctx as any).roundRect ? (ctx as any).roundRect(x - 1, y - 1, w + 2, h + 2, r + 1) : ctx.rect(x - 1, y - 1, w + 2, h + 2);
      ctx.fill();
      // 안쪽 채우기 (그라데이션)
      const fillW = Math.max(0, w * ratio);
      const hpGrad = ctx.createLinearGradient(x, y, x + w, y);
      if (ratio > 0.5) {
        hpGrad.addColorStop(0, '#b3ff00'); hpGrad.addColorStop(1, '#05d9e8');
      } else if (ratio > 0.25) {
        hpGrad.addColorStop(0, '#ffd700'); hpGrad.addColorStop(1, '#ffaa00');
      } else {
        hpGrad.addColorStop(0, '#ff6f00'); hpGrad.addColorStop(1, '#ff3366');
      }
      ctx.fillStyle = hpGrad;
      ctx.beginPath();
      (ctx as any).roundRect ? (ctx as any).roundRect(x, y, fillW, h, r) : ctx.rect(x, y, fillW, h);
      ctx.fill();
      // 하이라이트 라인
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(x, y, fillW, 0.8);
    }

    // 블랙홀 인력장 — 등심원 + 굴절 호 + 미립자 흡수
    if (p.kind === 'blackhole') {
      ctx.save();
      // 등심원 (펄스)
      const rings = 5;
      for (let r = 1; r <= rings; r++) {
        const phase = (t / 1200 + p.seed + r * 0.4) % 1;
        const radius = 40 + phase * 240;
        const a = (1 - phase) * 0.18;
        ctx.globalAlpha = a;
        ctx.strokeStyle = '#b14aff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(dsx, dsy, radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      // 흡수 미립자 (8개, 나선)
      ctx.globalAlpha = 0.7;
      for (let i = 0; i < 8; i++) {
        const phase = ((t / 600 + p.seed + i * 0.13) % 1);
        const ang = phase * Math.PI * 4 + (i / 8) * Math.PI * 2;
        const rad = (1 - phase) * 90 + 30;
        const px = dsx + Math.cos(ang) * rad;
        const py = dsy + Math.sin(ang) * rad;
        ctx.fillStyle = i % 3 === 0 ? '#05d9e8' : i % 3 === 1 ? '#ffd700' : '#ff2a6d';
        ctx.shadowColor = ctx.fillStyle as string;
        ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(px, py, 1.4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    // 등불 슬로우 오라 (다층 펄스)
    if (p.kind === 'lantern') {
      ctx.save();
      const a = 0.06 + 0.05 * Math.sin(t / 800 + p.seed);
      const grad = ctx.createRadialGradient(dsx, dsy, 10, dsx, dsy, 100);
      grad.addColorStop(0, `rgba(255, 100, 80, ${a + 0.12})`);
      grad.addColorStop(0.6, `rgba(255, 60, 100, ${a * 0.5})`);
      grad.addColorStop(1, 'rgba(255, 60, 100, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(dsx, dsy, 100, 0, Math.PI * 2); ctx.fill();
      // 외곽 박동 링
      const beat = (t / 1500 + p.seed) % 1;
      ctx.globalAlpha = (1 - beat) * 0.4;
      ctx.strokeStyle = '#ff6f00';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(dsx, dsy, 30 + beat * 70, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }

    // 별먼지 매혹 글로우 (다층)
    if (p.kind === 'stardust' && !p.consumed) {
      ctx.save();
      const a = 0.25 + 0.15 * Math.sin(t / 400 + p.seed);
      const grad = ctx.createRadialGradient(dsx, dsy, 0, dsx, dsy, 22);
      grad.addColorStop(0, `rgba(220, 180, 255, ${a})`);
      grad.addColorStop(0.5, `rgba(177, 74, 255, ${a * 0.5})`);
      grad.addColorStop(1, 'rgba(177, 74, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(dsx, dsy, 22, 0, Math.PI * 2); ctx.fill();
      // 외곽 박동
      const beat = (t / 1000 + p.seed * 7) % 1;
      ctx.globalAlpha = (1 - beat) * 0.5;
      ctx.strokeStyle = '#b14aff';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(dsx, dsy, 8 + beat * 18, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();

  // ── 떠다니는 한자 (12개로 축소, 매우 미묘) ──
  ctx.save();
  for (const g of bgGlyphs) {
    const sx = (g.x - cx) + W / 2;
    const sy = (g.y - cy + Math.sin(t / 2000 + g.x) * 4) + H / 2;
    if (sx < -150 || sx > W + 150 || sy < -150 || sy > H + 150) continue;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(g.rot);
    ctx.fillStyle = `rgba(180, 100, 220, ${g.alpha})`;
    ctx.font = `${g.size}px 'Galmuri11', monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(g.ch, 0, 0);
    ctx.restore();
  }
  ctx.restore();

  // 우주 먼지 제거 — 가시성 우선 (props 와 적이 잘 보이도록)

  // ⭐ Biome 틴트 + elevation 명도 변조 (펄린 노이즈 기반 입체감).
  // 셀당 sampleNoiseRaw 1회 — biome, elevation 동시 획득.
  // 명도 규칙: elevation 양수 = 밝게(고지대 빛), 음수 = 어둡게(저지대 그림자).
  // peak 셀(>0.55)에는 남쪽 짧은 그림자 — 절벽 단차 시각화.
  ctx.save();
  const biomeCell = 400;
  const seedT = getTerrainSeed();
  const cellStartX = Math.floor((cx - W / 2 - biomeCell) / biomeCell) * biomeCell;
  const cellStartY = Math.floor((cy - H / 2 - biomeCell) / biomeCell) * biomeCell;
  for (let zx = cellStartX; zx < cx + W / 2 + biomeCell; zx += biomeCell) {
    for (let zy = cellStartY; zy < cy + H / 2 + biomeCell; zy += biomeCell) {
      const centerX = zx + biomeCell / 2;
      const centerY = zy + biomeCell / 2;
      const sample = sampleNoiseRaw(centerX, centerY, seedT);
      const tint = BIOME_TINT[sample.biome];
      const sx = (zx - cx) + W / 2;
      const sy = (zy - cy) + H / 2;
      // 1) biome 라디얼 틴트
      if (tint.a >= 0.01) {
        const grad = ctx.createRadialGradient(
          sx + biomeCell / 2, sy + biomeCell / 2, 0,
          sx + biomeCell / 2, sy + biomeCell / 2, biomeCell * 0.75
        );
        const col = `${tint.r},${tint.g},${tint.b}`;
        grad.addColorStop(0, `rgba(${col},${tint.a})`);
        grad.addColorStop(0.7, `rgba(${col},${tint.a * 0.35})`);
        grad.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(sx, sy, biomeCell, biomeCell);
      }
      // 2) ⭐ elevation 명도 — 고지대 밝게(+22% alpha), 저지대 어둡게(-20% alpha).
      // 이전 ±10% → ±22% 로 강화 — 산악과 평지의 시각 단차 뚜렷.
      const elev = sample.elevation;
      if (elev > 0.05) {
        const aBright = Math.min(0.22, elev * 0.22);
        const lg = ctx.createRadialGradient(
          sx + biomeCell / 2, sy + biomeCell / 2, 0,
          sx + biomeCell / 2, sy + biomeCell / 2, biomeCell * 0.7
        );
        lg.addColorStop(0, `rgba(255,250,200,${aBright})`);
        lg.addColorStop(1, 'rgba(255,250,200,0)');
        ctx.fillStyle = lg;
        ctx.fillRect(sx, sy, biomeCell, biomeCell);
      } else if (elev < -0.05) {
        const aDark = Math.min(0.20, -elev * 0.20);
        ctx.fillStyle = `rgba(0,4,15,${aDark})`;
        ctx.fillRect(sx, sy, biomeCell, biomeCell);
      }
      // 3) ⭐ 절벽 그림자 — RIDGE 이상 (>0.40) 셀 남쪽에 어두운 그라데 (드롭 섀도우).
      // peak (>0.55) 일수록 더 진하고 길게 — 단차 강조.
      if (elev > 0.40) {
        const peakNess = Math.min(1, (elev - 0.40) / 0.40);  // 0..1
        const shadowH = biomeCell * (0.18 + peakNess * 0.20);
        const shadowA = 0.30 + peakNess * 0.25;
        const shg = ctx.createLinearGradient(0, sy + biomeCell, 0, sy + biomeCell + shadowH);
        shg.addColorStop(0, `rgba(0,4,12,${shadowA})`);
        shg.addColorStop(1, 'rgba(0,4,12,0)');
        ctx.fillStyle = shg;
        ctx.fillRect(sx - biomeCell * 0.05, sy + biomeCell, biomeCell * 1.1, shadowH);
      }
    }
  }
  ctx.restore();

  // ⭐ 등고선 라인 — 사용자 피드백 ("지형 경계선이 인공적") 으로 비활성.
  // biome 틴트 라디얼 + elevation 명도(±22%) + 절벽 그림자만으로 단차 충분히 인지.
  // drawContours 함수는 보존; 호출만 주석 처리 (필요 시 다시 활성).
  // drawContours(ctx, cx, cy, W, H, seedT, t);

  // ── 그리드 (네오펑크 — 듀얼 컬러 + 펄스 + 교차점 글로우) ──
  // 사용자 피드백 "그래픽이 조잡" → 단조로운 격자 라인 → 듀얼 그리드 + 교차점 액센트
  const grid = 200;
  const subgrid = 50; // 미세 4분할
  ctx.save();
  const startX = Math.floor((cx - W / 2) / grid) * grid;
  const startY = Math.floor((cy - H / 2) / grid) * grid;
  // ⭐ 그리드 약하게 — 사용자 피드백 "경계선 X, 실제 지형 느낌". 미세 격자는 거의 무시 가능 수준.
  // 1) 미세 격자 (거의 안 보임 — 시각 기준점만)
  ctx.strokeStyle = 'rgba(80,60,140,0.015)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = startX; x < cx + W / 2 + grid; x += subgrid) {
    const sx = (x - cx) + W / 2;
    ctx.moveTo(sx, 0); ctx.lineTo(sx, H);
  }
  for (let y = startY; y < cy + H / 2 + grid; y += subgrid) {
    const sy = (y - cy) + H / 2;
    ctx.moveTo(0, sy); ctx.lineTo(W, sy);
  }
  ctx.stroke();
  // 2) 메인 격자 (약한 펄스만)
  const pulseGrid = 0.018 + 0.012 * Math.sin(t / 1800);
  ctx.strokeStyle = `rgba(120,80,200,${pulseGrid})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = startX; x < cx + W / 2 + grid; x += grid) {
    const sx = (x - cx) + W / 2;
    ctx.moveTo(sx, 0); ctx.lineTo(sx, H);
  }
  for (let y = startY; y < cy + H / 2 + grid; y += grid) {
    const sy = (y - cy) + H / 2;
    ctx.moveTo(0, sy); ctx.lineTo(W, sy);
  }
  ctx.stroke();
  // 3) 교차점 글로우 — 약하게 (실제 지형 느낌)
  ctx.fillStyle = `rgba(5,217,232,${0.07 + 0.05 * Math.sin(t / 1100)})`;
  ctx.shadowColor = '#05d9e8';
  ctx.shadowBlur = 2;
  for (let x = startX; x < cx + W / 2 + grid; x += grid) {
    const sx = (x - cx) + W / 2;
    for (let y = startY; y < cy + H / 2 + grid; y += grid) {
      const sy = (y - cy) + H / 2;
      ctx.fillRect(sx - 1, sy - 1, 2, 2);
    }
  }
  ctx.shadowBlur = 0;
  ctx.restore();

  // ⭐ 줌 적용 시작 — 월드 엔티티 (적/픽업/플레이어/투사체)에만 zoom. 배경/HUD 는 제외.
  if (zoom !== 1) {
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);
  }

  // ── 처치 폭발 (월드 좌표, 3겹 shockwave + 8 spike + 중심 백광) ──
  for (let i = killBursts.length - 1; i >= 0; i--) {
    const k = killBursts[i];
    const age = (t - k.t0) / 1000;
    if (age > 0.7) { killBursts.splice(i, 1); continue; }
    const sx = (k.x - cx) + W / 2;
    const sy = (k.y - cy) + H / 2;
    const r = age * 100 * k.size;
    const alpha = 1 - age / 0.7;
    ctx.save();
    ctx.shadowColor = k.color;
    // 외곽 링 (강조)
    ctx.shadowBlur = 14;
    ctx.globalAlpha = alpha * 0.85;
    ctx.strokeStyle = k.color;
    ctx.lineWidth = Math.max(0, 4.5 * alpha);
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(0, r), 0, Math.PI * 2);
    ctx.stroke();
    // 보조 링 (안쪽, 시안)
    ctx.shadowBlur = 8;
    ctx.globalAlpha = alpha * 0.5;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(0, 2 * alpha);
    ctx.beginPath();
    ctx.arc(sx, sy, Math.max(0, r * 0.7), 0, Math.PI * 2);
    ctx.stroke();
    // 8 spike (회전)
    ctx.shadowBlur = 6;
    ctx.globalAlpha = alpha * 0.9;
    ctx.strokeStyle = k.color;
    ctx.lineWidth = 2;
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2 + age * 2;
      const r1 = r * 0.45; const r2 = r * 1.05;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(a) * r1, sy + Math.sin(a) * r1);
      ctx.lineTo(sx + Math.cos(a) * r2, sy + Math.sin(a) * r2);
      ctx.stroke();
    }
    // 중심 백광 (초반 0.2초)
    if (age < 0.25) {
      ctx.shadowBlur = 0;
      ctx.globalAlpha = (1 - age / 0.25) * 0.9;
      const fg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 28 * k.size);
      fg.addColorStop(0, '#ffffff');
      fg.addColorStop(0.4, k.color);
      fg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.arc(sx, sy, 28 * k.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // 영역 효과 (적 뒤에)
  for (const a of world.areaEffects) {
    drawArea(a, cx, cy, W, H, t);
  }

  // 픽업
  for (const p of world.pickups) {
    drawPickup(p, cx, cy, W, H, t);
  }

  // 죽음 puff (적 뒤에)
  drawDeadAnims(world, cx, cy, W, H);

  // 적
  for (const e of world.enemies) {
    drawEnemy(e, cx, cy, W, H, t);
  }

  // 보스 패턴 텔레그래프 (적 위 — 즉살 방지 시각 경고)
  if (world.bossRuntime) drawBossTelegraphs(ctx, world, cx, cy, W, H);

  // 데미지 숫자
  drawDamageNumbers(world, cx, cy, W, H);

  // 발사체
  for (const p of world.projectiles) {
    drawProjectile(p, cx, cy, W, H);
  }

  // 공격 fx (발사체 위에 큰 효과)
  drawAttackFx(ctx, cx, cy, W, H, t);

  // 플레이어
  drawPlayer(world, cx, cy, W, H, runIdentity, t);

  // ⭐ 줌 적용 종료 — HUD/오프스크린 마커는 zoom 없이.
  if (zoom !== 1) ctx.restore();

  // ── 보스 화면 밖 화살표 마커 (육각 + 거리표시) ──
  if (world.bossInstance && world.bossInstance.hp > 0) {
    const b = world.bossInstance;
    const bsx = (b.pos.x - cx) + W / 2;
    const bsy = (b.pos.y - cy) + H / 2;
    const margin = 40;
    const offscreen = bsx < margin || bsx > W - margin || bsy < margin || bsy > H - margin;
    if (offscreen) {
      const dx = b.pos.x - world.player.pos.x;
      const dy = b.pos.y - world.player.pos.y;
      const dist = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      const px = W / 2 + Math.cos(ang) * Math.min(W / 2 - margin, H / 2 - margin);
      const py = H / 2 + Math.sin(ang) * Math.min(W / 2 - margin, H / 2 - margin);
      const pulse = 0.7 + 0.3 * Math.sin(t / 120);
      // 외곽 헤일로
      ctx.save();
      ctx.globalAlpha = pulse * 0.4;
      const halo = ctx.createRadialGradient(px, py, 4, px, py, 28);
      halo.addColorStop(0, 'rgba(255,42,109,0.9)');
      halo.addColorStop(1, 'rgba(255,42,109,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(px, py, 28, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // 화살표 본체 (그라데이션)
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(ang);
      const arrowGrad = ctx.createLinearGradient(-22, 0, 4, 0);
      arrowGrad.addColorStop(0, '#8a0a28');
      arrowGrad.addColorStop(0.7, '#ff2a6d');
      arrowGrad.addColorStop(1, '#ff80a8');
      ctx.fillStyle = arrowGrad;
      ctx.shadowColor = '#ff2a6d';
      ctx.shadowBlur = 12;
      ctx.globalAlpha = pulse;
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(-22, -14);
      ctx.lineTo(-14, 0);
      ctx.lineTo(-22, 14);
      ctx.closePath();
      ctx.fill();
      // 화살표 윤곽
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
      // BOSS 라벨 + 거리
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#ff2a6d';
      ctx.shadowColor = '#ff2a6d';
      ctx.shadowBlur = 6;
      ctx.font = 'bold 11px Galmuri11, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lx = px - Math.cos(ang) * 38;
      const ly = py - Math.sin(ang) * 38;
      ctx.fillText('BOSS', lx, ly);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = pulse * 0.7;
      ctx.font = '9px Galmuri11, monospace';
      ctx.fillText(`${Math.round(dist)}m`, lx, ly + 12);
      ctx.restore();
    }
  }

  // ── 시네마틱 비네트 (가장자리 어둡게) ──
  ctx.save();
  const vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(0.7, 'rgba(0,0,0,0.18)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // ── 저체력 적색 펄스 비네트 (HP < 33%) ──
  const playerHpRatio = world.player.hp / Math.max(1, world.player.hpMax);
  if (playerHpRatio < 0.33 && playerHpRatio > 0) {
    const intensity = (1 - playerHpRatio / 0.33);
    const pulse = 0.5 + 0.5 * Math.sin(t / 280);
    ctx.save();
    const danger = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    danger.addColorStop(0, 'rgba(255,42,109,0)');
    danger.addColorStop(0.6, `rgba(255,42,109,${intensity * pulse * 0.15})`);
    danger.addColorStop(1, `rgba(255,42,109,${intensity * pulse * 0.45})`);
    ctx.fillStyle = danger;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ── 시네마틱 스캔라인 (네오펑크, 매우 미묘) ──
  ctx.save();
  ctx.globalAlpha = 0.04;
  ctx.fillStyle = '#000000';
  for (let y = 0; y < H; y += 3) {
    ctx.fillRect(0, y, W, 1);
  }
  ctx.restore();

  // ── 도장 텍스트 (콤보/시너지 강조 — 화면 중앙 큰 한자, 0.6초 줌인 + fade) ──
  for (let i = stamps.length - 1; i >= 0; i--) {
    const s = stamps[i];
    const age = (t - s.t0) / 1000;
    if (age > 0.7) { stamps.splice(i, 1); continue; }
    const scale = age < 0.2 ? age / 0.2 * 1.2 : 1.2 - (age - 0.2) / 0.5 * 0.2;
    const alpha = age < 0.5 ? 1 : 1 - (age - 0.5) / 0.2;
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale, scale);
    ctx.rotate(-0.06);
    // 화면 너비/높이 기반 스케일 — 1.2x scale 적용 후도 화면 안에 들어와야 함
    // 가용 영역의 70% 안에 박스 (높이 1.3x + 좌우 패딩 0.3x) 가 들어가도록 역산
    const maxByW = (W * 0.85) / 1.2 / 1.5;   // 박스 width ≈ stampSize × 1.5 (글자폭 1.0 + 패딩 0.3)
    const maxByH = (H * 0.85) / 1.2 / 1.3;   // 박스 height = stampSize × 1.3
    const stampSize = Math.max(48, Math.min(140, Math.floor(Math.min(maxByW, maxByH))));
    ctx.font = `bold ${stampSize}px 'Galmuri11', monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // 도장 빨강 박스 — 폰트 크기에 비례
    const txtW = ctx.measureText(s.text).width;
    const w = txtW + stampSize * 0.3;
    const h = stampSize * 1.3;
    ctx.fillStyle = s.color;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = '#fff';
    ctx.fillText(s.text, 0, 0);
    ctx.restore();
  }
}

function drawPlayer(w: World, cx: number, cy: number, W: number, H: number, runIdentity: string | null, t: number) {
  if (!ctx) return;
  const sx = (w.player.pos.x - cx) + W / 2;
  const sy = (w.player.pos.y - cy) + H / 2;

  const moving = Math.hypot(w.player.vel.x, w.player.vel.y) > 30;
  const dashing = w.dashUntil > t;

  // ── 그림자 (땅에 붙어있는 느낌) ──
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 22, 22, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── 엔진 부스터 (캐릭터 이동 방향 반대쪽으로 입자 방출) ──
  if (moving || dashing) {
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(w.player.facing + Math.PI); // 진행 방향의 반대
    for (let i = 0; i < 5; i++) {
      const pT = (t + i * 40) % 200;
      const k = pT / 200; // 0 ~ 1
      const dist = 14 + k * 25 + (dashing ? 15 : 0);
      const spread = (Math.sin(t / 20 + i) * 8) * k;
      const r = 4 * (1 - k);
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.fillStyle = dashing ? '#05d9e8' : '#ff5500';
      ctx.shadowColor = dashing ? '#05d9e8' : '#ffaa00';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(dist, spread, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ── 별먼지 부스트 ── 보랏빛 잔상 + 후광
  if (w.boostUntil > t) {
    const remain = (w.boostUntil - t) / 1000;
    const a = Math.min(1, remain / 0.4);
    ctx.save();
    // 후광 파동
    const pulse = 0.6 + 0.4 * Math.sin(t / 80);
    const grad = ctx.createRadialGradient(sx, sy, 6, sx, sy, 60 * pulse);
    grad.addColorStop(0, `rgba(220, 180, 255, ${a * 0.55})`);
    grad.addColorStop(0.5, `rgba(177, 74, 255, ${a * 0.3})`);
    grad.addColorStop(1, 'rgba(177, 74, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(sx, sy, 60 * pulse, 0, Math.PI * 2); ctx.fill();
    // 속도선 (vel 반대방향 잔상)
    const vx = w.player.vel.x, vy = w.player.vel.y;
    const speed = Math.hypot(vx, vy);
    if (speed > 60) {
      const nx = -vx / speed, ny = -vy / speed;
      for (let i = 0; i < 4; i++) {
        const len = 14 + i * 6;
        const off = 8 + i * 5;
        ctx.globalAlpha = a * (0.6 - i * 0.13);
        ctx.strokeStyle = '#b14aff';
        ctx.shadowColor = '#b14aff';
        ctx.shadowBlur = 6;
        ctx.lineWidth = 2 - i * 0.4;
        ctx.beginPath();
        ctx.moveTo(sx + nx * off, sy + ny * off);
        ctx.lineTo(sx + nx * (off + len), sy + ny * (off + len));
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ── Run Identity 시각 변신 — 빌드별 오라 (회전 펄스) ──
  const auraColor = identityAura(runIdentity);
  if (auraColor) {
    ctx.save();
    const pulse = 1 + Math.sin(t / 200) * 0.15;
    const grad = ctx.createRadialGradient(sx, sy, 4, sx, sy, 70 * pulse);
    grad.addColorStop(0, auraColor + 'aa');
    grad.addColorStop(0.5, auraColor + '44');
    grad.addColorStop(1, auraColor + '00');
    ctx.fillStyle = grad;
    ctx.fillRect(sx - 80, sy - 80, 160, 160);
    // 회전 링
    ctx.strokeStyle = auraColor + 'cc';
    ctx.lineWidth = 2;
    ctx.translate(sx, sy);
    ctx.rotate(t / 500);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.moveTo(Math.cos(a) * 38, Math.sin(a) * 38);
      ctx.lineTo(Math.cos(a) * 48, Math.sin(a) * 48);
    }
    ctx.stroke();
    ctx.restore();
  }

  // ── 호랑이 (모션) ──
  // bobbing — 걷는 동안만 (sin 곡선, 절댓값 = 두 발 디딤)
  const bob = moving ? Math.abs(Math.sin(w.player.walkPhase)) * -3 : 0;
  // 정지 시 호흡 (천천히 부풀고 들숨 → 날숨)
  const idleBreath = moving ? 1 : 1 + Math.sin(t / 700) * 0.025;
  // 공격 squash (lastAttackTime 후 120ms 안) — 강화: 더 큰 stretch + 백워드 recoil
  const sinceAttack = t - w.player.lastAttackTime;
  const attackK = sinceAttack < 180 ? 1 - sinceAttack / 180 : 0;
  const squash = 1 - attackK * 0.28;
  const stretch = 1 + attackK * 0.32;
  // 공격 시 후폭풍 글로우 (사이즈 1.5x 짧게)
  if (attackK > 0) {
    ctx.save();
    ctx.globalAlpha = attackK * 0.5;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, 50 + attackK * 30);
    grad.addColorStop(0, '#ffffff88');
    grad.addColorStop(0.4, '#ffd70044');
    grad.addColorStop(1, '#ff2a6d00');
    ctx.fillStyle = grad;
    ctx.fillRect(sx - 80, sy - 80, 160, 160);
    ctx.restore();
  }
  // 무적 깜빡임 (50ms 주기 깜빡) + 펄스 링
  const invuln = w.player.invulnUntil > t;
  const blink = invuln && Math.floor(t / 60) % 2 === 0;

  if (invuln) {
    const remain = (w.player.invulnUntil - t) / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(t / 60);
    const r = w.player.radius + 8 + pulse * 6;
    ctx.save();
    ctx.globalAlpha = Math.min(0.8, remain * 1.2) * (0.6 + pulse * 0.4);
    ctx.strokeStyle = '#05d9e8';
    ctx.lineWidth = 2 + pulse * 1.5;
    ctx.shadowColor = '#05d9e8';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 대시 잔상
  // 현재 캐릭터 스프라이트 — meta.character 에서 (없으면 호랑이)
  const charId = (typeof window !== 'undefined' && (window as any).__samsara_char) || 'tiger';
  // 모든 캐릭터 모션 프레임 — 공격 중 → attack / 이동 중 → walk1/walk2 / 정지 → idle
  let frameId = charId;
  if (attackK > 0.4) frameId = `${charId}_attack`;
  else if (moving) frameId = Math.sin(w.player.walkPhase) >= 0 ? `${charId}_walk1` : `${charId}_walk2`;
  const charImg = getCharacterImg(frameId) ?? getCharacterImg(charId) ?? tigerImg;
  const charLoaded = imgLoaded[charImg?.src ?? ''] || tigerLoaded;

  if (dashing && charLoaded && charImg) {
    for (let n = 1; n <= 3; n++) {
      const back = n * 0.06;
      const bx = sx - w.player.vel.x * back;
      const by = sy - w.player.vel.y * back;
      ctx.save();
      ctx.globalAlpha = 0.25 - n * 0.06;
      ctx.translate(bx, by);
      ctx.scale(w.player.facingX, 1);
      ctx.drawImage(charImg, -32, -32, 64, 64);
      ctx.restore();
    }
  }

  // ── 머리 위 HP 바 + 대시 쿨다운 (라운드 + 그라데이션 + 세그먼트) ──
  const hpRatio = Math.max(0, w.player.hp / Math.max(1, w.player.hpMax));
  ctx.save();
  const hpW = 48, hpH = 5, hpX = sx - hpW / 2, hpY = sy - 40, rr = hpH / 2;
  // 외곽 어둠
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.beginPath();
  if ((ctx as any).roundRect) (ctx as any).roundRect(hpX - 1.5, hpY - 1.5, hpW + 3, hpH + 3, rr + 1.5);
  else ctx.rect(hpX - 1.5, hpY - 1.5, hpW + 3, hpH + 3);
  ctx.fill();
  // 채우기 (그라데이션)
  const fillW = hpW * hpRatio;
  const hpGrad = ctx.createLinearGradient(hpX, hpY, hpX + hpW, hpY);
  if (hpRatio > 0.5) {
    hpGrad.addColorStop(0, '#00ff88'); hpGrad.addColorStop(1, '#b3ff00');
  } else if (hpRatio > 0.25) {
    hpGrad.addColorStop(0, '#ffaa00'); hpGrad.addColorStop(1, '#ffd700');
  } else {
    hpGrad.addColorStop(0, '#ff3366'); hpGrad.addColorStop(1, '#ff5577');
  }
  ctx.fillStyle = hpGrad;
  ctx.beginPath();
  if ((ctx as any).roundRect) (ctx as any).roundRect(hpX, hpY, fillW, hpH, rr);
  else ctx.rect(hpX, hpY, fillW, hpH);
  ctx.fill();
  // 하이라이트 라인
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillRect(hpX, hpY, fillW, 1);
  // 세그먼트 구분 (10 segments)
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 0.6;
  for (let i = 1; i < 10; i++) {
    const x = hpX + (hpW / 10) * i;
    ctx.beginPath(); ctx.moveTo(x, hpY); ctx.lineTo(x, hpY + hpH); ctx.stroke();
  }
  // 대시 쿨다운 (링)
  const cdY = sy - 52;
  if (w.dashCooldown > 0) {
    const cd = 1 - w.dashCooldown / 2;
    // 배경 링
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(sx, cdY, 8, 0, Math.PI * 2);
    ctx.stroke();
    // 채우기 (시안)
    ctx.strokeStyle = '#05d9e8';
    ctx.shadowColor = '#05d9e8';
    ctx.shadowBlur = 6;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(sx, cdY, 8, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cd);
    ctx.stroke();
    ctx.shadowBlur = 0;
  } else {
    // 준비됨 — 황록 펄스 ⚡
    const ready = 0.7 + 0.3 * Math.sin(t / 200);
    ctx.fillStyle = `rgba(179, 255, 0, ${ready})`;
    ctx.shadowColor = '#b3ff00';
    ctx.shadowBlur = 8;
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⚡', sx, cdY);
    ctx.shadowBlur = 0;
  }
  ctx.restore();

  if (!blink) {
    ctx.save();
    ctx.translate(sx, sy + bob);
    
    // 비행/대시 시 이동 방향으로 살짝 기울임 (부스터 추진 느낌)
    if (moving || dashing) {
      const speedK = Math.min(1, Math.hypot(w.player.vel.x, w.player.vel.y) / 250);
      const flightTilt = speedK * 0.2 * w.player.facingX;
      ctx.rotate(flightTilt);
    }

    if (w.player.staggerUntil > t) {
      const sk = (w.player.staggerUntil - t) / 350;
      const wobble = Math.sin(t / 25) * 0.3 * sk;
      ctx.rotate(wobble);
    }
    ctx.scale(w.player.facingX * stretch * idleBreath, squash * idleBreath);
    ctx.imageSmoothingEnabled = false;

    if (charLoaded && charImg) {
      const size = 64;
      // 빨강 피격 틴트 — drawImage 후 source-atop 으로 빨강 덮기
      ctx.drawImage(charImg, -size / 2, -size / 2, size, size);
      if (w.player.hitFlashUntil > t) {
        const alpha = Math.max(0, (w.player.hitFlashUntil - t) / 250);
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = `rgba(255, 60, 60, ${alpha * 0.7})`;
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.globalCompositeOperation = 'source-over';
      }
    } else {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(0, 0, w.player.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function identityAura(ri: string | null): string | null {
  if (!ri) return null;
  if (ri.includes('5fire') || ri === 'id_5fire') return '#ff2a6d';
  if (ri.includes('5ice') || ri === 'id_5ice') return '#05d9e8';
  if (ri.includes('5gold') || ri === 'id_5gold') return '#ffd700';
  if (ri.includes('5time') || ri === 'id_5time') return '#d300c5';
  if (ri.includes('5chaos') || ri === 'id_5chaos') return '#ff6f00';
  if (ri.includes('5echo') || ri === 'id_5echo') return '#b3ff00';
  if (ri === 'id_harmony') return '#ffffff';
  return null;
}

function drawEnemy(e: Enemy, cx: number, cy: number, W: number, H: number, t: number) {
  if (!ctx) return;
  const sx = (e.pos.x - cx) + W / 2;
  const sy = (e.pos.y - cy) + H / 2;
  if (sx < -50 || sx > W + 50 || sy < -50 || sy > H + 50) return;

  // 텔레그래프 — 빨간 원 + 점점 채워짐
  if (e.spawning < 1) {
    ctx.save();
    ctx.strokeStyle = '#ff3366';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(sx, sy, e.radius + 4, 0, Math.PI * 2 * e.spawning);
    ctx.stroke();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#ff3366';
    ctx.beginPath();
    ctx.arc(sx, sy, e.radius * e.spawning, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  const burning = e.burnUntil > t;
  const flashing = e.hitFlashUntil > t;
  // 모션 — 이동 방향으로 살짝 기울이고, 걸음 bobbing, 차지 중엔 떨림
  const speed = Math.hypot(e.vel.x, e.vel.y);
  const moving = speed > 5;
  const phase = (t / 200 + e.id * 1.7) % (Math.PI * 2);
  const bob = moving ? Math.sin(phase) * 1.5 : 0;
  const tilt = moving ? Math.sin(phase) * 0.08 : 0;
  // 차지/돌진 중인 charger 는 진동
  const charging = e.kind === 'charger' && e.chargeUntil > t;
  const wobble = charging ? Math.sin(t / 30) * 2 : 0;
  // 공격 임박 (attackCd 짧아지면 부풀어 오름) — shooter / summoner
  const attacking = (e.kind === 'shooter' || e.kind === 'summoner') && e.attackCd < 0.4 && e.attackCd > 0;
  const breathScale = attacking ? 1 + (0.4 - e.attackCd) * 0.4 : 1;

  // ⭐ 위협 시그니처 + 그라운딩 — 모든 적 공통.
  //  (1) 진한 접지 그림자 → "땅에 놓인" 느낌(붕뜸 방지)
  //  (2) 빨강 위협 underglow → 색이 친화적(초록 wonwi/회색 jab)이어도 "이건 날 해친다"가 한눈에.
  //  픽업엔 절대 빨강을 쓰지 않으므로, 빨강 오라 = 적 = 위협 이라는 단일 규칙이 성립.
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + e.radius * 0.9, e.radius * 0.95, e.radius * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  if (!flashing) {
    const threatPulse = 0.5 + 0.5 * Math.sin(t / 360 + e.id);
    const tgrad = ctx.createRadialGradient(sx, sy, e.radius * 0.35, sx, sy, e.radius * 1.75);
    tgrad.addColorStop(0, `rgba(255, 38, 68, ${0.24 + 0.12 * threatPulse})`);
    tgrad.addColorStop(0.65, 'rgba(255, 38, 68, 0.06)');
    tgrad.addColorStop(1, 'rgba(255, 38, 68, 0)');
    ctx.fillStyle = tgrad;
    ctx.beginPath(); ctx.arc(sx, sy, e.radius * 1.75, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // ⭐ Elite 표식 — 빨간 외곽 링 + 펄스 + "ELITE" 라벨
  if (e.elite) {
    ctx.save();
    const pulse = 0.7 + 0.3 * Math.sin(t / 220);
    ctx.strokeStyle = `rgba(255, 0, 60, ${pulse})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ff0044';
    ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(sx, sy, e.radius + 8, 0, Math.PI * 2); ctx.stroke();
    // 두 번째 외곽 링 (점선)
    ctx.setLineDash([6, 6]);
    ctx.lineDashOffset = -t / 30;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.arc(sx, sy, e.radius + 14, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // ELITE 라벨 (위)
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#ff0044';
    ctx.font = 'bold 9px Galmuri11, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    ctx.strokeText('ELITE', sx, sy - e.radius - 6);
    ctx.fillText('ELITE', sx, sy - e.radius - 6);
    ctx.restore();
  }

  // 화염 오라 (burning)
  if (burning) {
    ctx.save();
    const burnPulse = 0.6 + 0.4 * Math.sin(t / 80 + e.id);
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, e.radius + 14);
    grad.addColorStop(0, `rgba(255, 100, 30, ${burnPulse * 0.5})`);
    grad.addColorStop(0.6, `rgba(255, 42, 109, ${burnPulse * 0.25})`);
    grad.addColorStop(1, 'rgba(255, 42, 109, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(sx, sy, e.radius + 14, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // 슬로우 아이스 (slowUntil)
  if (e.slowUntil > t) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = '#05d9e8';
    ctx.shadowColor = '#05d9e8';
    ctx.shadowBlur = 6;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + t / 1500;
      const r1 = e.radius + 2;
      const r2 = e.radius + 6;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(ang) * r1, sy + Math.sin(ang) * r1);
      ctx.lineTo(sx + Math.cos(ang) * r2, sy + Math.sin(ang) * r2);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.save();
  ctx.translate(sx + wobble, sy + bob);
  ctx.rotate(tilt);
  ctx.scale(e.vel.x < -1 ? -breathScale : breathScale, breathScale);
  if (burning || flashing) {
    ctx.shadowBlur = 12;
    ctx.shadowColor = flashing ? '#fff' : '#ff2a6d';
  }

  // 스프라이트 우선 — 미로드 시 도형 fallback (사용자 피드백 "조잡함" → 그라디언트 + 빛나는 눈 + 펄스 코어)
  const sprite = getEnemyImg(e.kind);
  if (sprite && !flashing) {
    const size = e.radius * 2.4;
    ctx.imageSmoothingEnabled = false;
    // ⭐ 위협 림 — 스프라이트가 귀여워도(회색 jab 등) 빨강 실루엣 글로우로 "적" 인지.
    if (!burning) { ctx.shadowColor = 'rgba(255,38,68,0.85)'; ctx.shadowBlur = 7; }
    ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
    ctx.shadowBlur = 0;
  } else if (flashing) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // ── 풍부한 fallback: 외곽 글로우 + 본체 그라디언트 + 빛나는 눈 + 코어 펄스 ──
    // 외곽 위협 글로우
    const auraGrad = ctx.createRadialGradient(0, 0, e.radius * 0.5, 0, 0, e.radius * 1.6);
    auraGrad.addColorStop(0, e.color + '88');
    auraGrad.addColorStop(0.6, e.color + '22');
    auraGrad.addColorStop(1, e.color + '00');
    ctx.fillStyle = auraGrad;
    ctx.beginPath(); ctx.arc(0, 0, e.radius * 1.6, 0, Math.PI * 2); ctx.fill();
    // 본체 (방사형 그라디언트 — 입체감)
    const bodyGrad = ctx.createRadialGradient(-e.radius * 0.3, -e.radius * 0.3, 0, 0, 0, e.radius);
    bodyGrad.addColorStop(0, lighten(e.color, 0.3));
    bodyGrad.addColorStop(0.6, e.color);
    bodyGrad.addColorStop(1, darken(e.color, 0.4));
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fill();
    // 외곽선 (어둡게 + 두께)
    ctx.strokeStyle = darken(e.color, 0.6);
    ctx.lineWidth = 1.4;
    ctx.stroke();
    // 코어 펄스 (붉은 점)
    const corePulse = 0.6 + 0.4 * Math.sin(t / 240 + e.id);
    ctx.fillStyle = `rgba(255, 60, 90, ${corePulse * 0.4})`;
    ctx.beginPath(); ctx.arc(0, 0, e.radius * 0.45, 0, Math.PI * 2); ctx.fill();
    // ⭐ 성난 표정 — 안쪽으로 기운 빨강 삼각눈 + 찌푸린 입. (이전 시안 미소 = 친화적 → 위협 인지로 교정)
    const eyeGlow = 0.75 + 0.25 * Math.sin(t / 160 + e.id);
    ctx.shadowColor = '#ff2840';
    ctx.shadowBlur = 5;
    ctx.fillStyle = `rgba(255, 70, 60, ${eyeGlow})`;
    for (const dir of [-1, 1]) {
      ctx.save();
      ctx.translate(dir * e.radius * 0.32, -e.radius * 0.15);
      ctx.rotate(dir * 0.5);
      ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff2a0';
    ctx.beginPath(); ctx.arc(-e.radius * 0.32, -e.radius * 0.15, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(e.radius * 0.32, -e.radius * 0.15, 0.9, 0, Math.PI * 2); ctx.fill();
    // 찌푸린 입 (위로 볼록 = frown)
    ctx.strokeStyle = 'rgba(20,0,5,0.85)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, e.radius * 0.55, e.radius * 0.32, Math.PI + 0.3, Math.PI * 2 - 0.3);
    ctx.stroke();
  }
  // 피격 흰 플래시 오버레이 (스프라이트 위에)
  if (flashing && sprite) {
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // 공격 임박 텔레그래프 — 빨간 링 깜빡임
  if (attacking) {
    ctx.save();
    const pulse = 0.5 + 0.5 * Math.sin(t / 50);
    ctx.strokeStyle = `rgba(255, 50, 80, ${0.4 + pulse * 0.5})`;
    ctx.lineWidth = 2 + pulse * 1.5;
    ctx.beginPath();
    ctx.arc(sx, sy, e.radius + 4 + pulse * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // 차지 중인 charger — 빨간 트레일
  if (charging) {
    ctx.save();
    ctx.strokeStyle = '#ff2a6d';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx - e.vel.x * 0.04, sy - e.vel.y * 0.04);
    ctx.stroke();
    ctx.restore();
  }

  // HP 바 — 중형 (hpMax >= 4) 부터 표시 (라운드 + 그라데이션)
  if (e.hpMax >= 4) {
    const big = e.hpMax >= 10;
    const w = big ? 48 : 32;
    const h = big ? 5 : 3.5;
    const ratio = Math.max(0, e.hp / Math.max(1, e.hpMax));
    const x = sx - w / 2;
    const y = sy - e.radius - (big ? 10 : 8);
    const r = h / 2;
    // 배경
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.beginPath();
    if ((ctx as any).roundRect) (ctx as any).roundRect(x - 1, y - 1, w + 2, h + 2, r + 1);
    else ctx.rect(x - 1, y - 1, w + 2, h + 2);
    ctx.fill();
    // 채우기 (그라데이션)
    const fillW = w * ratio;
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    if (ratio > 0.5) {
      grad.addColorStop(0, '#ff8855'); grad.addColorStop(1, '#ffaa66');
    } else if (ratio > 0.25) {
      grad.addColorStop(0, '#ff3366'); grad.addColorStop(1, '#ff5577');
    } else {
      grad.addColorStop(0, '#ff0044'); grad.addColorStop(1, '#ff2266');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    if ((ctx as any).roundRect) (ctx as any).roundRect(x, y, fillW, h, r);
    else ctx.rect(x, y, fillW, h);
    ctx.fill();
    // 하이라이트
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x, y, fillW, 0.8);
  }
}

function drawDeadAnims(world: { deadAnims: any[] }, cx: number, cy: number, W: number, H: number) {
  if (!ctx) return;
  for (const a of world.deadAnims) {
    const sx = (a.pos.x - cx) + W / 2;
    const sy = (a.pos.y - cy) + H / 2;
    const k = Math.max(0, Math.min(1, 1 - a.life / Math.max(0.001, a.lifeMax)));
    const alpha = Math.max(0, 1 - k);
    const r = Math.max(0, a.radius * (1 + k * 1.5));
    // 초반 백색 섬광 (k < 0.2)
    if (k < 0.2 && r > 0) {
      ctx!.save();
      ctx!.globalAlpha = (1 - k / 0.2) * 0.85;
      const fg = ctx!.createRadialGradient(sx, sy, 0, sx, sy, r * 1.6);
      fg.addColorStop(0, '#ffffff');
      fg.addColorStop(0.4, a.color);
      fg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx!.fillStyle = fg;
      ctx!.beginPath(); ctx!.arc(sx, sy, r * 1.6, 0, Math.PI * 2); ctx!.fill();
      ctx!.restore();
    }
    ctx!.save();
    ctx!.translate(sx, sy);
    ctx!.rotate(a.rot + k * 4);
    ctx!.globalAlpha = alpha;
    ctx!.shadowColor = a.color;
    ctx!.shadowBlur = 8;
    // puff cloud (다층)
    ctx!.fillStyle = a.color;
    for (let n = 0; n < 8; n++) {
      const ang = (n / 8) * Math.PI * 2;
      const dist = r * (0.6 + (n % 2) * 0.25);
      ctx!.beginPath();
      const puffR = Math.max(0, r * 0.42 * (1 - k));
      ctx!.arc(Math.cos(ang) * dist, Math.sin(ang) * dist, puffR, 0, Math.PI * 2);
      ctx!.fill();
    }
    ctx!.shadowBlur = 0;
    ctx!.restore();
    // 영혼 위로 떠오름 (k > 0.3)
    if (k > 0.3 && k < 0.95) {
      const soulY = sy - (k - 0.3) * 28;
      const soulA = (1 - (k - 0.3) / 0.65) * 0.7;
      ctx!.save();
      ctx!.globalAlpha = soulA;
      ctx!.fillStyle = '#ffffff';
      ctx!.shadowColor = a.color;
      ctx!.shadowBlur = 6;
      ctx!.fillRect(sx - 1, soulY - 1, 2, 2);
      ctx!.restore();
    }
  }
}

function drawDamageNumbers(world: { damageNumbers: any[] }, cx: number, cy: number, W: number, H: number) {
  if (!ctx) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const d of world.damageNumbers) {
    const sx = (d.pos.x - cx) + W / 2;
    const sy = (d.pos.y - cy) + H / 2;
    const k = d.life / d.lifeMax;
    // 등장 0.15초 강조 펀치 (1.4x → 1x)
    const elapsed = 1 - k;
    const punchK = elapsed < 0.15 ? 1 - elapsed / 0.15 : 0;
    // ⭐ 큰 데미지(size>=24)는 펀치 강도 + scale 더 크게 → "큰 거"라는 인지
    const isBig = d.size >= 24;
    const punchAmp = isBig ? 0.7 : 0.4;
    const scale = 1 + punchK * punchAmp;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(scale, scale);
    ctx.globalAlpha = Math.max(0, Math.min(1, k * 1.5));
    ctx.font = `bold ${d.size}px 'Galmuri11', monospace`;
    // 외곽 검정 윤곽 (큰 숫자는 더 두껍게)
    ctx.lineWidth = isBig ? 6 : 4;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000';
    ctx.strokeText(d.text, 0, 0);
    // ⭐ 무지개 본체 (T+) — gradient text (수직 그라디언트)
    if (d.size >= 36) {
      const grad = ctx.createLinearGradient(0, -d.size, 0, d.size);
      grad.addColorStop(0,    '#ff2a6d');
      grad.addColorStop(0.33, '#ffd700');
      grad.addColorStop(0.66, '#05d9e8');
      grad.addColorStop(1,    '#b14aff');
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 24;
      ctx.fillStyle = grad;
    } else {
      ctx.shadowColor = d.color;
      ctx.shadowBlur = isBig ? 16 : 8;
      ctx.fillStyle = d.color;
    }
    ctx.fillText(d.text, 0, 0);
    ctx.shadowBlur = 0;
    // 백색 코어 (작게 위에) — 큰 데미지는 펀치 더 길게
    if (punchK > 0) {
      ctx.globalAlpha = punchK;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(d.text, 0, -0.5);
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawProjectile(p: Projectile, cx: number, cy: number, W: number, H: number) {
  if (!ctx) return;
  const sx = (p.pos.x - cx) + W / 2;
  const sy = (p.pos.y - cy) + H / 2;
  if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) return;
  ctx.save();

  // 잔상 (coin/orb) — 5점 페이드 아웃 (lighter 합성으로 빛나게)
  if (p.trail && p.trail.length > 1) {
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < p.trail.length; i++) {
      const tp = p.trail[i];
      const tsx = (tp.x - cx) + W / 2;
      const tsy = (tp.y - cy) + H / 2;
      const a = (i + 1) / p.trail.length * 0.45;
      const tr = p.radius * ((i + 1) / p.trail.length) * 0.85;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(tsx, tsy, tr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // 외곽 글로우
  ctx.shadowColor = p.color;
  ctx.shadowBlur = 16;
  if (p.kind === 'coin') {
    // 황금 코인 — 본체 + 백색 코어 + 원화 기호
    const grad = ctx.createRadialGradient(sx - p.radius / 3, sy - p.radius / 3, 0, sx, sy, p.radius);
    grad.addColorStop(0, '#fff8c0');
    grad.addColorStop(0.5, '#ffd700');
    grad.addColorStop(1, '#b58800');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(sx, sy, p.radius, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#000';
    ctx.font = `bold ${p.radius * 1.4}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('₩', sx, sy);
  } else if (p.kind === 'orb') {
    // 오브 — 본체 + 백색 코어
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.radius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, p.color);
    grad.addColorStop(1, p.color + '00');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(sx, sy, p.radius, 0, Math.PI * 2); ctx.fill();
  } else if (p.kind === 'mirror') {
    // 미러 — 회전 다이아몬드 + 내부 광채
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(performance.now() / 200);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(0, -p.radius);
    ctx.lineTo(p.radius, 0);
    ctx.lineTo(0, p.radius);
    ctx.lineTo(-p.radius, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, -p.radius * 0.5);
    ctx.lineTo(p.radius * 0.5, 0);
    ctx.lineTo(0, p.radius * 0.5);
    ctx.lineTo(-p.radius * 0.5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else {
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(sx, sy, p.radius, 0, Math.PI * 2); ctx.fill();
    // 백색 코어
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.arc(sx, sy, p.radius * 0.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawArea(a: AreaEffect, cx: number, cy: number, W: number, H: number, t: number) {
  if (!ctx) return;
  const sx = (a.pos.x - cx) + W / 2;
  const sy = (a.pos.y - cy) + H / 2;
  if (sx < -a.radius || sx > W + a.radius || sy < -a.radius || sy > H + a.radius) return;
  ctx.save();
  const alpha = Math.min(0.55, a.life * 0.75);
  if (a.kind === 'aura') {
    // 펄스 + 회전 룬 링
    const pulse = 0.85 + 0.15 * Math.sin(t / 200);
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, a.radius * pulse);
    grad.addColorStop(0, a.color + '99');
    grad.addColorStop(0.5, a.color + '40');
    grad.addColorStop(1, a.color + '00');
    ctx.fillStyle = grad;
    ctx.fillRect(sx - a.radius, sy - a.radius, a.radius * 2, a.radius * 2);
    // 회전 점 12개
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(t / 800);
    ctx.fillStyle = a.color;
    ctx.shadowColor = a.color;
    ctx.shadowBlur = 6;
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(ang) * a.radius * 0.92, Math.sin(ang) * a.radius * 0.92, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else if (a.kind === 'nova') {
    // 다중 링 + 백색 코어
    ctx.shadowColor = a.color;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = a.color;
    ctx.lineWidth = 5;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(sx, sy, a.radius, 0, Math.PI * 2);
    ctx.stroke();
    // 안쪽 보조 링
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = alpha * 0.7;
    ctx.beginPath();
    ctx.arc(sx, sy, a.radius * 0.85, 0, Math.PI * 2);
    ctx.stroke();
  } else { // rift
    // 시간 균열 — 회전 + 사선 광채
    const grad = ctx.createRadialGradient(sx, sy, a.radius * 0.4, sx, sy, a.radius);
    grad.addColorStop(0, a.color + '00');
    grad.addColorStop(0.55, a.color + '55');
    grad.addColorStop(0.85, a.color + '22');
    grad.addColorStop(1, a.color + '00');
    ctx.fillStyle = grad;
    ctx.fillRect(sx - a.radius, sy - a.radius, a.radius * 2, a.radius * 2);
    // 회전 균열선 4개
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(t / 500);
    ctx.strokeStyle = a.color;
    ctx.shadowColor = a.color;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = alpha * 1.4;
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * a.radius * 0.4, Math.sin(ang) * a.radius * 0.4);
      ctx.lineTo(Math.cos(ang) * a.radius * 0.95, Math.sin(ang) * a.radius * 0.95);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

// ⭐ 픽업 색 약속 (5색 약속 정렬):
//  - coin = 황금 / xp = 라임 / gem = 시안 / heart = 핑크 (♥로 명확히) / chest = 황금+무지개
// ⭐ aura = 픽업 본체 색과 반드시 일치 (이전 xp 시안젬에 라임 헤일로 = 색 충돌).
const PICKUP_AURA: Record<string, string> = { coin: '#ffd700', xp: '#05d9e8', gem: '#05d9e8', heart: '#ff66aa', magnet: '#b3ff00', bomb: '#ffaa00', chest: '#ffd700' };

function drawPickup(p: Pickup, cx: number, cy: number, W: number, H: number, t: number) {
  if (!ctx) return;
  const sx = (p.pos.x - cx) + W / 2;
  const sy = (p.pos.y - cy) + H / 2;
  if (sx < -30 || sx > W + 30 || sy < -30 || sy > H + 30) return;
  const pulse = Math.max(0.1, 1 + Math.sin(t / 150 + p.id) * 0.15);
  const aura = PICKUP_AURA[p.kind] ?? '#ffd700';

  // ⭐ 접지 그림자 — 픽업이 공중에 붕 뜨지 않게 (모든 종류). 적 그림자보다 옅게 = 보상 톤.
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + p.radius * 1.15, p.radius * 0.7, p.radius * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ⭐ 지면 헤일로 — 픽업 보상 인지. 단 배경에 녹아들도록 부드럽게(반경/알파 축소, 색 일치).
  ctx.save();
  const haloR = p.radius * 1.9 * pulse;
  const haloGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, haloR);
  haloGrad.addColorStop(0, `${aura}40`);
  haloGrad.addColorStop(0.5, `${aura}16`);
  haloGrad.addColorStop(1, `${aura}00`);
  ctx.fillStyle = haloGrad;
  ctx.beginPath(); ctx.arc(sx, sy, haloR, 0, Math.PI * 2); ctx.fill();
  // 회전 ring (얇은 점선) — 큰 픽업(heart/chest/gem)에만
  if (p.radius >= 12) {
    ctx.strokeStyle = `${aura}aa`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -t / 60;
    ctx.beginPath();
    ctx.arc(sx, sy, p.radius * 1.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();

  // 스프라이트 우선
  const sprite = getPickupImg(p.kind);
  if (sprite) {
    ctx.save();
    ctx.shadowBlur = 9;
    ctx.shadowColor = aura;
    // ⭐ 시각 스케일 +50% (충돌 radius 와 별개)
    const size = p.radius * 3 * pulse;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, sx - size / 2, sy - size / 2, size, size);
    ctx.restore();
    return;
  }

  ctx.save();
  ctx.shadowBlur = 12;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  switch (p.kind) {
    case 'coin': {
      ctx.shadowColor = '#ffd700';
      const grad = ctx.createRadialGradient(sx - p.radius / 3, sy - p.radius / 3, 0, sx, sy, p.radius * pulse);
      grad.addColorStop(0, '#fff8c0');
      grad.addColorStop(0.6, '#ffd700');
      grad.addColorStop(1, '#b58800');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(sx, sy, p.radius * pulse, 0, Math.PI * 2); ctx.fill();
      // 하이라이트 호
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx - p.radius * 0.2, sy - p.radius * 0.2, p.radius * 0.55, Math.PI * 1.1, Math.PI * 1.7);
      ctx.stroke();
      break;
    }
    case 'xp': {
      ctx.shadowColor = '#05d9e8';
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.PI / 4 + t / 1500);
      const grad = ctx.createLinearGradient(-p.radius, -p.radius, p.radius, p.radius);
      grad.addColorStop(0, '#80f0ff');
      grad.addColorStop(0.5, '#05d9e8');
      grad.addColorStop(1, '#0288a8');
      ctx.fillStyle = grad;
      ctx.fillRect(-p.radius / 1.4, -p.radius / 1.4, p.radius * 1.4, p.radius * 1.4);
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(-p.radius / 1.4, -p.radius / 1.4, p.radius * 1.4, 1);
      ctx.restore();
      break;
    }
    case 'heart': {
      // ⭐ 핑크(#ff66aa)로 — 적 빨강(#ff3366)과 구분. 강한 ♥ 아이콘.
      ctx.shadowColor = '#ff66aa'; ctx.shadowBlur = 18;
      ctx.fillStyle = '#ff66aa';
      ctx.font = `bold ${p.radius * 2.6 * pulse}px monospace`;
      ctx.fillText('♥', sx, sy);
      // 작은 하이라이트
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(sx - p.radius * 0.3, sy - p.radius * 0.2, p.radius * 0.22, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'magnet':
      ctx.shadowColor = '#b3ff00'; ctx.fillStyle = '#b3ff00';
      ctx.font = `${p.radius * 2 * pulse}px monospace`;
      ctx.fillText('🧲', sx, sy);
      break;
    case 'bomb':
      ctx.shadowColor = '#ffaa00'; ctx.fillStyle = '#ffaa00';
      ctx.font = `${p.radius * 2 * pulse}px monospace`;
      ctx.fillText('💣', sx, sy);
      break;
    case 'chest': {
      ctx.shadowColor = '#ffd700';
      // 그림자
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + p.radius * 0.85, p.radius, p.radius * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      // 본체 (그라데이션)
      ctx.shadowBlur = 14;
      const bgrad = ctx.createLinearGradient(sx, sy - p.radius * 0.7, sx, sy + p.radius * 0.7);
      bgrad.addColorStop(0, '#e74060');
      bgrad.addColorStop(1, '#8a1020');
      ctx.fillStyle = bgrad;
      ctx.fillRect(sx - p.radius, sy - p.radius * 0.7, p.radius * 2, p.radius * 1.4);
      // 황금 띠
      ctx.shadowBlur = 0;
      const ggrad = ctx.createLinearGradient(sx - p.radius, sy, sx + p.radius, sy);
      ggrad.addColorStop(0, '#b58800');
      ggrad.addColorStop(0.5, '#fff8c0');
      ggrad.addColorStop(1, '#b58800');
      ctx.fillStyle = ggrad;
      ctx.fillRect(sx - p.radius, sy - 1.5, p.radius * 2, 3);
      ctx.fillRect(sx - 2, sy - p.radius * 0.7, 4, p.radius * 1.4);
      // 자물쇠
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(sx, sy, 2, 0, Math.PI * 2);
      ctx.fill();
      // 빛 펄스
      ctx.fillStyle = `rgba(255,215,0,${0.3 + 0.3 * Math.sin(t / 300)})`;
      ctx.fillRect(sx - p.radius, sy - p.radius * 0.7, p.radius * 2, 1);
      break;
    }
    case 'gem': {
      ctx.shadowColor = '#05d9e8';
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(t / 800);
      const grad = ctx.createLinearGradient(0, -p.radius, 0, p.radius);
      grad.addColorStop(0, '#80f0ff');
      grad.addColorStop(0.5, '#05d9e8');
      grad.addColorStop(1, '#0288a8');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, -p.radius);
      ctx.lineTo(p.radius, 0);
      ctx.lineTo(0, p.radius);
      ctx.lineTo(-p.radius, 0);
      ctx.closePath();
      ctx.fill();
      // 내부 광택
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.moveTo(0, -p.radius * 0.5);
      ctx.lineTo(p.radius * 0.3, -p.radius * 0.1);
      ctx.lineTo(0, 0);
      ctx.lineTo(-p.radius * 0.3, -p.radius * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
    default:
      ctx.shadowColor = '#b3ff00'; ctx.fillStyle = '#b3ff00';
      ctx.beginPath(); ctx.arc(sx, sy, p.radius * pulse, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
