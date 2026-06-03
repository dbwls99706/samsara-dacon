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
        // ⭐ 할퀴기 — 캐릭터에서 '발사되어 나가는' 게 아니라 제자리에서 '샥-샥' 긁는 스와이프.
        //   발톱 자국은 방사형으로 자라지 않고, 공격 호(arc)를 가로질러 빠르게 쓸고 지나간다.
        //   두 번의 교차 스트로크(X 자국) = "샥샥". 범위(range)는 그대로 — 끝은 항상 range 에 닿음.
        const startR = f.range * 0.30;   // 발톱 시작 = 캐릭터 근처(고정 — 안 자람)
        const endR = f.range;            // 끝 = 항상 range 까지 (범위 유지)
        // 두 스트로크: 첫 번째(k<0.55) ↘, 두 번째(k≥0.45) ↗ — 시간차 교차 긁기.
        const strokes: Array<{ on: boolean; lk: number; dir: number }> = [
          { on: k < 0.55,  lk: k / 0.55,            dir:  1 },
          { on: k >= 0.45, lk: (k - 0.45) / 0.55,   dir: -1 },
        ];
        for (const st of strokes) {
          if (!st.on) continue;
          const lk = Math.max(0, Math.min(1, st.lk));
          const swipeA = Math.sin(lk * Math.PI);   // 진입→이탈 페이드 (빠른 스침)
          const sweep = (lk - 0.5) * 0.85 * st.dir; // 호를 가로지르는 각 스윕
          const tilt = st.dir * 0.16;               // 두 스트로크를 X 자로 약간 기울임
          for (let n = -1; n <= 1; n++) {
            const off = n * 0.2 + sweep + tilt;     // 3 평행 발톱선 + 전체 스윕
            const baseW = 4 + (n === 0 ? 1.6 : 0);  // 가운데 두껍게
            ctx.lineWidth = baseW * (0.35 + swipeA * 0.65);
            ctx.lineCap = 'round';
            ctx.globalAlpha = alpha * swipeA;       // 스트로크별 자체 페이드 (둘 다 선명)
            const sa = off - 0.05, ea = off + 0.05;
            const sx0 = Math.cos(sa) * startR, sy0 = Math.sin(sa) * startR;
            const ex = Math.cos(ea) * endR, ey = Math.sin(ea) * endR;
            const midR = (startR + endR) * 0.5, ma = (sa + ea) * 0.5;
            const mx = Math.cos(ma) * midR * 1.06, my = Math.sin(ma) * midR * 1.06;
            ctx.beginPath();
            ctx.moveTo(sx0, sy0);
            ctx.quadraticCurveTo(mx, my, ex, ey);
            ctx.stroke();
          }
          // 끝자락 spark — 발톱이 스치는 순간만 살짝
          if (swipeA > 0.7) {
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = alpha * (swipeA - 0.7) * 2;
            const off = sweep + tilt;
            const px = Math.cos(off) * endR * 0.98, py = Math.sin(off) * endR * 0.98;
            ctx.beginPath();
            ctx.arc(px, py, 2.3, 0, Math.PI * 2);
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
