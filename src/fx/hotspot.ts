// SAMSARA · 윤회 — 핫스팟 + QTE
//
// 핫스팟: 매초 화면에 황금 영역 1개. 그 위 탭 시 ×3 점수 (mod_dark/카드로 ×10 까지).
// 변종: W3+ 빈도 ↑, W6+ 동시 2개, W10+ 동시 3개 + 빨강 트랩 (×0.5).
// QTE: 콤보 ×25 도달 시 화살표 패턴 4~5개. 정확히 따라 탭 시 ×100 콤보 점프.

export interface Hotspot {
  id: number;
  x: number; y: number;
  size: number;
  type: 'gold' | 'trap';
  spawnedAt: number;
  duration: number;
  alpha: number;
}

let nextId = 1;
let active: Hotspot[] = [];
let canvas: HTMLCanvasElement | null = null;
let lastSpawn = 0;
let enabled = false;
let _wave = 0;

export function initHotspot(parent: HTMLElement): HTMLCanvasElement {
  if (canvas) return canvas;
  canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3';
  parent.appendChild(canvas);
  resize();
  window.addEventListener('resize', resize);
  return canvas;
}

function resize() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const vv = (window as any).visualViewport;
  const w = vv?.width ?? window.innerWidth;
  const h = vv?.height ?? window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function setHotspotEnabled(v: boolean) { enabled = v; }
export function setHotspotWave(w: number) { _wave = w; }

export function tickHotspot(dt: number, t: number): void {
  if (!canvas || !enabled) {
    active = [];
    if (canvas) {
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    return;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 만료
  for (let i = active.length - 1; i >= 0; i--) {
    const h = active[i];
    const age = (t - h.spawnedAt) / 1000;
    if (age > h.duration) { active.splice(i, 1); continue; }
    // 알파: in 0.2 / hold / out 0.2
    if (age < 0.2) h.alpha = age / 0.2;
    else if (age > h.duration - 0.2) h.alpha = (h.duration - age) / 0.2;
    else h.alpha = 1;
  }

  // 스폰 (간격 1초, W3+ 0.7초)
  const interval = _wave >= 3 ? 700 : 1000;
  if (t - lastSpawn > interval) {
    lastSpawn = t;
    const maxConcurrent = _wave >= 10 ? 3 : _wave >= 6 ? 2 : 1;
    if (active.length < maxConcurrent) {
      const W = window.innerWidth;
      const H = window.innerHeight;
      const margin = 80;
      const isTrap = _wave >= 10 && Math.random() < 0.2;
      active.push({
        id: nextId++,
        x: margin + Math.random() * (W - margin * 2),
        y: margin + Math.random() * (H - margin * 2),
        size: 70,
        type: isTrap ? 'trap' : 'gold',
        spawnedAt: t,
        duration: _wave >= 15 ? 0.5 : 1.0,
        alpha: 0,
      });
    }
  }

  // 그리기
  for (const h of active) {
    const c = h.type === 'trap' ? '#ff3366' : '#ffd700';
    const pulse = 1 + Math.sin(t / 100) * 0.05;
    ctx.save();
    ctx.globalAlpha = h.alpha;
    ctx.translate(h.x, h.y);
    ctx.rotate((t / 1000) * 0.5);
    ctx.scale(pulse, pulse);
    // glow
    const g = ctx.createRadialGradient(0, 0, 5, 0, 0, h.size);
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-h.size, -h.size, h.size * 2, h.size * 2);
    // 중심 ring
    ctx.strokeStyle = c;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, h.size * 0.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/** 탭 좌표가 핫스팟 안인지 — 안이면 spot 제거 후 multiplier 반환. */
export function consumeHotspotAt(x: number, y: number): { hit: boolean; mult: number; type: 'gold' | 'trap' } {
  for (let i = 0; i < active.length; i++) {
    const h = active[i];
    const dx = x - h.x, dy = y - h.y;
    if (dx * dx + dy * dy < h.size * h.size) {
      active.splice(i, 1);
      return { hit: true, mult: h.type === 'trap' ? 0.5 : 3, type: h.type };
    }
  }
  return { hit: false, mult: 1, type: 'gold' };
}

// ─────────────────────────── QTE ───────────────────────────

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface QteState {
  pattern: Direction[];
  index: number;
  startedAt: number;
  duration: number; // 초
  active: boolean;
}

let qte: QteState | null = null;
let qteCanvas: HTMLDivElement | null = null;

export function ensureQteOverlay(parent: HTMLElement): HTMLDivElement {
  if (!qteCanvas) {
    qteCanvas = document.createElement('div');
    qteCanvas.style.cssText = `
      position:fixed;top:30%;left:50%;transform:translate(-50%,-50%);
      display:none;z-index:7;pointer-events:none;
      font-family:Galmuri11,monospace;font-size:64px;
      background:rgba(10,10,26,0.85);padding:24px 40px;border-radius:12px;
      border:2px solid var(--gold);text-align:center;
    `;
    parent.appendChild(qteCanvas);
  }
  return qteCanvas;
}

export function isQteActive(): boolean { return !!qte?.active; }

export function startQte(): void {
  if (qte?.active) return;
  const dirs: Direction[] = ['up', 'down', 'left', 'right'];
  const len = 3 + Math.floor(Math.random() * 3); // 3~5
  const pattern = Array.from({ length: len }, () => dirs[Math.floor(Math.random() * 4)]);
  qte = {
    pattern, index: 0,
    startedAt: performance.now(),
    duration: 1.6 + len * 0.2,
    active: true,
  };
  renderQte();
}

export function tickQte(t: number): boolean {
  if (!qte?.active) return false;
  const elapsed = (t - qte.startedAt) / 1000;
  if (elapsed > qte.duration) {
    qte.active = false;
    if (qteCanvas) qteCanvas.style.display = 'none';
    return false;
  }
  return true;
}

/** Direction 입력 처리. true 반환 시 패턴 완료. */
export function handleQteInput(dir: Direction): { complete: boolean; correct: boolean } {
  if (!qte?.active) return { complete: false, correct: false };
  const expected = qte.pattern[qte.index];
  if (dir === expected) {
    qte.index += 1;
    if (qte.index >= qte.pattern.length) {
      qte.active = false;
      if (qteCanvas) qteCanvas.style.display = 'none';
      return { complete: true, correct: true };
    }
    renderQte();
    return { complete: false, correct: true };
  }
  return { complete: false, correct: false };
}

const ARROW: Record<Direction, string> = { up: '↑', down: '↓', left: '←', right: '→' };

function renderQte() {
  if (!qte || !qteCanvas) return;
  qteCanvas.innerHTML = qte.pattern.map((d, i) => {
    const color = i < qte!.index ? '#00ff88' : i === qte!.index ? '#ffd700' : '#8888aa';
    return `<span style="color:${color};margin:0 8px">${ARROW[d]}</span>`;
  }).join('');
  qteCanvas.style.display = 'block';
}
