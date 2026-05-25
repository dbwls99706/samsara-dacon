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
        // ⭐ 진짜 할퀴기 — 3 평행 사선 자국 (부채꼴 X). 곡률 + 가운데 두꺼움 + 끝 tapered.
        // 각 줄: 시작점은 가까이 모이고 끝점은 부채꼴로 벌어져 자연스러운 발톱 자국.
        // k=0 짧음 → k=0.5 max length → k=1 페이드.
        const lenK = Math.sin(k * Math.PI);  // 0 → 1 → 0 (휘둘림 모션)
        const startR = f.range * 0.2 * lenK;
        const endR = f.range * (0.85 + 0.15 * lenK);
        for (let n = -1; n <= 1; n++) {
          const off = n * 0.28;
          // 가운데(0)는 두껍게, 양 끝(±1)은 얇게 — 타이거 발톱 중심부 강조.
          const baseW = 4.5 + (n === 0 ? 1.5 : 0);
          ctx.lineWidth = baseW * (1 - k * 0.7);
          ctx.lineCap = 'round';
          // 시작-끝 각도 (사선 streak)
          const sa = off - 0.08;
          const ea = off + 0.08;
          const sx0 = Math.cos(sa) * startR;
          const sy0 = Math.sin(sa) * startR;
          const ex = Math.cos(ea) * endR;
          const ey = Math.sin(ea) * endR;
          // 곡률 — 안쪽으로 살짝 휘어진 streak
          const midR = (startR + endR) * 0.5;
          const ma = (sa + ea) * 0.5;
          const mx = Math.cos(ma) * midR * 1.05;
          const my = Math.sin(ma) * midR * 1.05;
          ctx.beginPath();
          ctx.moveTo(sx0, sy0);
          ctx.quadraticCurveTo(mx, my, ex, ey);
          ctx.stroke();
        }
        // 미세 spark dots — 발톱 끝 지점에서 튀는 입자 효과
        if (k < 0.5) {
          ctx.fillStyle = '#fff';
          ctx.globalAlpha = alpha * (1 - k * 2);
          for (let n = -1; n <= 1; n++) {
            const off = n * 0.28 + 0.08;
            const r = f.range * 0.95;
            const px = Math.cos(off) * r;
            const py = Math.sin(off) * r;
            ctx.beginPath();
            ctx.arc(px, py, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = alpha;
        }
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
