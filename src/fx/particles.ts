// SAMSARA · 윤회 — Canvas 파티클 풀 + 화면 효과
//
// 객체 풀 (500개) — alloc/dealloc 0회 보장. 60fps 유지.
// 모바일 FPS < 50 감지 시 자동 풀 다운.

interface Particle {
  active: boolean;
  x: number; y: number;
  vx: number; vy: number;
  life: number;       // 잔여 (초)
  lifeMax: number;
  size: number;
  color: string;
  rotation: number;
  rotSpeed: number;
  gravity: number;
}

const POOL_SIZE = 500;
const pool: Particle[] = Array.from({ length: POOL_SIZE }, () => ({
  active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, lifeMax: 0,
  size: 0, color: '#fff', rotation: 0, rotSpeed: 0, gravity: 0,
}));
let cursor = 0;

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let dprCached = 1;

let perfMode = false; // FPS < 50 시 활성

export function initParticles(parent: HTMLElement): HTMLCanvasElement {
  canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4';
  parent.appendChild(canvas);
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  // visualViewport 변동(주소창 슬라이드/줌)에도 반응 — 데스크탑/모바일 공통
  const vv = (window as any).visualViewport;
  if (vv) { vv.addEventListener('resize', resize); vv.addEventListener('scroll', resize); }
  return canvas;
}

function viewport() {
  const vv = (window as any).visualViewport;
  return {
    w: vv?.width ?? window.innerWidth,
    h: vv?.height ?? window.innerHeight,
  };
}

function resize() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  dprCached = dpr;
  const { w, h } = viewport();
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function setPerfMode(on: boolean) { perfMode = on; }

const PALETTES: Record<string, string[]> = {
  spark:     ['#ffffff', '#ffd700', '#ff2a6d'],
  burst:     ['#ffd700', '#ff2a6d', '#05d9e8'],
  explosion: ['#ffd700', '#ffaa00', '#ff3366', '#ffffff'],
  confetti:  ['#ff2a6d', '#05d9e8', '#ffd700', '#b3ff00', '#d300c5'],
  supernova: ['#ffffff', '#ffd700', '#ff2a6d', '#05d9e8', '#b3ff00'],
  coin:      ['#ffd700', '#ffaa00'],
  ring:      ['#ffffff'],
  glitch:    ['#ff2a6d', '#05d9e8', '#b3ff00'],
};

export function spawnParticles(kind: string, x: number, y: number, count: number) {
  const colors = PALETTES[kind] ?? PALETTES.spark;
  let n = perfMode ? Math.floor(count * 0.5) : count;
  for (let i = 0; i < n; i++) {
    const p = pool[cursor];
    cursor = (cursor + 1) % POOL_SIZE;
    p.active = true;
    p.x = x;
    p.y = y;
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * (kind === 'explosion' || kind === 'supernova' ? 280 : 120);
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.lifeMax = 0.4 + Math.random() * (kind === 'confetti' || kind === 'supernova' ? 1.5 : 0.6);
    p.life = p.lifeMax;
    p.size = kind === 'supernova' ? 4 + Math.random() * 4
           : kind === 'explosion' ? 3 + Math.random() * 4
           : 2 + Math.random() * 2;
    p.color = colors[Math.floor(Math.random() * colors.length)];
    p.rotation = Math.random() * Math.PI * 2;
    p.rotSpeed = (Math.random() - 0.5) * 8;
    p.gravity = kind === 'coin' || kind === 'confetti' ? 400 : 0;
  }
}

export function spawnRing(x: number, y: number, color: string = '#ffffff') {
  // ring 은 별도 active 카테고리 — 여기선 큰 spark 1개로 표현
  const p = pool[cursor];
  cursor = (cursor + 1) % POOL_SIZE;
  p.active = true;
  p.x = x; p.y = y; p.vx = 0; p.vy = 0;
  p.lifeMax = 0.5; p.life = 0.5;
  p.size = 5; p.color = color; p.rotation = 0; p.rotSpeed = 0; p.gravity = 0;
  // size 는 update 에서 keyframe 으로 키움 → simplest: 그냥 흰 원으로 그리고 별도 처리하지 않음
}

// 캔버스를 비우는 작업 — hitstop 무관 매 프레임 (잔상 방지)
// ctx 는 setTransform(dpr) 이 적용된 상태이므로 logical 단위(=뷰포트 픽셀)로 클리어해야
// 하단 잔상이 남지 않는다. (canvas.width 는 device px 라 scale 곱이 추가로 적용되어 영역이 어긋남)
export function clearFxCanvas() {
  if (!ctx || !canvas) return;
  const W = canvas.width / dprCached;
  const H = canvas.height / dprCached;
  ctx.clearRect(0, 0, W, H);
}

export function tickParticles(dt: number, freeze: boolean = false) {
  if (!ctx) return;
  for (const p of pool) {
    if (!p.active) continue;
    if (!freeze) {
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.vx *= 0.98;
      p.rotation += p.rotSpeed * dt;
    }
    const alpha = Math.min(1, p.life / p.lifeMax);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    ctx.restore();
  }
}

// ─────────────────────────── Ripple (탭 좌표 원형 확산) ───────────────────────────

interface Ripple { x: number; y: number; t: number; color: string; }
const ripples: Ripple[] = [];

export function spawnRipple(x: number, y: number, color: string = 'rgba(255,255,255,0.6)') {
  ripples.push({ x, y, t: 0, color });
}

export function tickRipples(dt: number) {
  if (!ctx) return;
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.t += dt;
    if (r.t > 0.4) { ripples.splice(i, 1); continue; }
    const radius = r.t * 200;
    const alpha = 1 - r.t / 0.4;
    ctx.save();
    ctx.globalAlpha = alpha * 0.5;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// ─────────────────────────── 콤보 오라 (화면 가장자리 발광) ───────────────────────────

let auraIntensity = 0;
let auraColor = '#ff2a6d';

export function setAura(combo: number) {
  if (combo >= 100) { auraIntensity = 0.9; auraColor = '#ffd700'; }
  else if (combo >= 50) { auraIntensity = 0.7; auraColor = '#ff2a6d'; }
  else if (combo >= 25) { auraIntensity = 0.5; auraColor = '#ff6f00'; }
  else if (combo >= 10) { auraIntensity = 0.3; auraColor = '#05d9e8'; }
  else { auraIntensity *= 0.9; if (auraIntensity < 0.01) auraIntensity = 0; }
}

export function tickAura() {
  if (!ctx || auraIntensity < 0.01) return;
  // ctx 는 setTransform(dpr) 이 적용된 상태 → logical 단위로 그려야 한다.
  // (이전: canvas.width 직접 사용 → 그라디언트가 dpr 배 어긋나 화면 하단에 잔상이 남던 버그)
  const W = (canvas?.width ?? 0) / dprCached;
  const H = (canvas?.height ?? 0) / dprCached;
  const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, hexToRgba(auraColor, auraIntensity));
  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function hexToRgba(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ─────────────────────────── Hitstop ───────────────────────────

let hitstopUntil = 0;
export function applyHitstop(durationMs: number) {
  const until = performance.now() + durationMs;
  if (until > hitstopUntil) hitstopUntil = until;
}
export function isHitstopped(): boolean {
  return performance.now() < hitstopUntil;
}

// ─────────────────────────── 통합 RAF ───────────────────────────

let rafId: number | null = null;
let lastT = 0;
export function startFxLoop() {
  if (rafId != null) return;
  lastT = performance.now();
  const loop = (t: number) => {
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    // 캔버스 비우기는 매 프레임 (hitstop 중에도) — 잔상 방지
    clearFxCanvas();
    const frozen = isHitstopped();
    tickParticles(dt, frozen);
    if (!frozen) tickRipples(dt);
    tickAura();
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);
}
