// SAMSARA · 윤회 — 공격 모션 시각 효과 (월드 좌표)
//
// 무기 발사 순간 화면에 큰 시각 효과: 발톱 streak, breath cone, slash arc 등.
// 모두 짧은 수명 (200~400ms) — 매 프레임 그리고 만료 시 제거.

import type { Vec } from '../game/world.js';

export type AttackKind = 'claw' | 'arc' | 'slash' | 'cone' | 'pulse' | 'beam' | 'flash';

export interface AttackFx {
  kind: AttackKind;
  pos: Vec;
  angle: number;
  range: number;
  color: string;
  t0: number;
  duration: number;
  thickness: number;
}

const fx: AttackFx[] = [];

export function spawnAttackFx(a: Omit<AttackFx, 't0'>): void {
  fx.push({ ...a, t0: performance.now() });
  if (fx.length > 80) fx.shift();
}

export function clearAttackFx(): void { fx.length = 0; }

export function drawAttackFx(ctx: CanvasRenderingContext2D, cx: number, cy: number, W: number, H: number, t: number): void {
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i];
    const age = (t - f.t0) / 1000;
    if (age > f.duration) { fx.splice(i, 1); continue; }
    const k = Math.max(0, Math.min(1, age / Math.max(0.001, f.duration)));
    const sx = (f.pos.x - cx) + W / 2;
    const sy = (f.pos.y - cy) + H / 2;
    const alpha = 1 - k;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(f.angle);
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 18;
    ctx.shadowColor = f.color;
    ctx.strokeStyle = f.color;
    ctx.fillStyle = f.color;

    switch (f.kind) {
      case 'claw': {
        // ⭐ 메이플스토리 '매직클로' 풍 — 두 갈래 발톱 에너지가 살짝 V 로 벌어져 앞으로 짧게
        //   쏘아졌다 사라진다. 각 갈래 = 곡선 3-prong 발톱. 선두 밝은 팁 + 꼬리 모션블러로
        //   '쐈다' 느낌. startR→endR 전진(짧은 사거리, 범위 유지). 빠르고 펀치감 있게.
        const reach = f.range;
        const travel = Math.min(1, k * 1.5);                 // 앞으로 전진(후반은 정지)
        const headR = reach * (0.34 + 0.66 * travel);        // 발톱 선두 위치
        const tailR = reach * (0.10 + 0.50 * travel);        // 꼬리(모션블러 시작)
        const fade = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5;      // 후반 페이드아웃
        for (const side of [-1, 1]) {                        // 두 갈래 (V 스프레드)
          const base = side * 0.21;
          for (let n = -1; n <= 1; n++) {                    // 발톱 3-prong
            const off = base + n * 0.075;
            ctx.lineWidth = (3 + (n === 0 ? 1.6 : 0)) * (0.4 + fade * 0.6);
            ctx.lineCap = 'round';
            ctx.globalAlpha = alpha * fade * (n === 0 ? 1 : 0.78);
            const hx = Math.cos(off) * headR, hy = Math.sin(off) * headR;
            const ta = off - side * 0.06;                    // 꼬리는 살짝 안쪽으로 휘어
            const tx = Math.cos(ta) * tailR, ty = Math.sin(ta) * tailR;
            const ma = (off + ta) * 0.5, mr = (headR + tailR) * 0.5;
            const mx = Math.cos(ma) * mr * 1.05, my = Math.sin(ma) * mr * 1.05;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.quadraticCurveTo(mx, my, hx, hy);
            ctx.stroke();
          }
          // 선두 에너지 팁 — 밝은 흰 점 (쏘아지는 느낌)
          if (fade > 0.35) {
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = alpha * fade;
            const tx = Math.cos(base) * headR, ty = Math.sin(base) * headR;
            ctx.beginPath();
            ctx.arc(tx, ty, 2.6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = alpha;
        break;
      }
      case 'arc': {
        // 부채꼴 채우기 (도깨비 방망이)
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const half = Math.PI / 3;
        ctx.arc(0, 0, f.range * (0.5 + k * 0.5), -half, half);
        ctx.closePath();
        ctx.globalAlpha = alpha * 0.4;
        ctx.fill();
        ctx.globalAlpha = alpha;
        ctx.lineWidth = 4;
        ctx.stroke();
        break;
      }
      case 'slash': {
        // 직선 베기
        ctx.lineWidth = (1 - k) * f.thickness;
        ctx.beginPath();
        ctx.moveTo(-f.range / 2 + k * 20, 0);
        ctx.lineTo(f.range / 2 - k * 20, 0);
        ctx.stroke();
        break;
      }
      case 'cone': {
        // 원뿔 형태 (용숨)
        ctx.beginPath();
        ctx.moveTo(0, 0);
        const len = f.range * (0.6 + k * 0.4);
        const spread = f.range * 0.4;
        ctx.lineTo(len, -spread);
        ctx.lineTo(len, spread);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, 0, len, 0);
        grad.addColorStop(0, f.color + 'cc');
        grad.addColorStop(1, f.color + '00');
        ctx.fillStyle = grad;
        ctx.globalAlpha = alpha * 0.7;
        ctx.fill();
        break;
      }
      case 'pulse': {
        // 원 확장 펄스
        ctx.lineWidth = (1 - k) * 6;
        ctx.beginPath();
        ctx.arc(0, 0, f.range * (0.3 + k * 0.7), 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'beam': {
        ctx.lineWidth = (1 - k) * f.thickness;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(f.range, 0);
        ctx.stroke();
        break;
      }
      case 'flash': {
        // 빛 폭발
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, f.range * (1 - k));
        grad.addColorStop(0, f.color + 'ff');
        grad.addColorStop(1, f.color + '00');
        ctx.fillStyle = grad;
        ctx.fillRect(-f.range, -f.range, f.range * 2, f.range * 2);
        break;
      }
    }
    ctx.restore();
  }
}
