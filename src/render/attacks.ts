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
        // ⭐ 교차 X 발톱 — 앞으로 '발사'되는 게 아니라 공격 방향 앞을 두 대각선(↘ + ↗)이
        //   빠르게 시간차로 긁는다(샥-샥). 두 줄이 X 로 교차 = 할퀴기 갈퀴 자국.
        //   각 대각선 = 3-prong 발톱 마크 + 선두 흰 스파크. 제자리 rake (범위 80 유지).
        const reach = f.range;
        const near = reach * 0.14, far = reach * 0.94, half = reach * 0.5;
        // 두 스트로크의 개별 시간창 (겹치는 구간에서 X 가 형성됨)
        const win: [number, number][] = [[0.0, 0.55], [0.30, 1.0]];
        for (let s = 0; s < 2; s++) {
          const [w0, w1] = win[s];
          if (k < w0 || k > w1) continue;
          const sk = (k - w0) / (w1 - w0);                   // 0..1 이 스트로크 진행
          const draw = Math.min(1, sk / 0.28);               // 앞 28% 동안 빠르게 그어짐
          const sfade = sk < 0.28 ? 1 : 1 - (sk - 0.28) / 0.72;
          const ydir = s === 0 ? 1 : -1;                     // ↘ 먼저, ↗ 나중
          // near→far 로 그어지는 대각선 (y 는 -half→+half, ydir 로 방향 반전)
          const x0 = near, y0 = -half * ydir;
          const x1 = near + (far - near) * draw;
          const y1 = (-half + half * 2 * draw) * ydir;
          const segAng = Math.atan2(y1 - y0, x1 - x0);
          const nx = -Math.sin(segAng), ny = Math.cos(segAng); // 진행 수직 (3-prong 오프셋용)
          for (let n = -1; n <= 1; n++) {                    // 발톱 3-prong
            const noff = n * reach * 0.09;
            ctx.lineWidth = (n === 0 ? 4.5 : 2.6) * (0.5 + sfade * 0.5);
            ctx.lineCap = 'round';
            ctx.globalAlpha = alpha * sfade * (n === 0 ? 1 : 0.7);
            ctx.beginPath();
            ctx.moveTo(x0 + nx * noff, y0 + ny * noff);
            ctx.lineTo(x1 + nx * noff, y1 + ny * noff);
            ctx.stroke();
          }
          // 선두 흰 스파크 (긁히는 끝점)
          if (sfade > 0.4) {
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = alpha * sfade;
            ctx.beginPath();
            ctx.arc(x1, y1, 2.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = f.color;
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
