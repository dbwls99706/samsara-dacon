// SAMSARA · 윤회 — 하이라이트 릴 자동 편집
//
// 게임 진행 중 highlightEvents 발생 시 메인 캔버스 스냅샷 캡처.
// 게임오버 시 5초 시퀀스로 자동 합성 → 다운로드 가능한 GIF/WebM 또는 PNG 시퀀스.
//
// 단순 구현: PNG 5장을 좌→우 슬라이드 모션으로 합성하여 하나의 1080×1080 PNG 캔버스로 출력.
// 동영상은 추가 라이브러리 필요 — 본 단계에선 PNG 콜라주.

import type { HighlightEvent } from '../game/types.js';
import { formatNum } from '../game/cards.js';

const MAX_FRAMES = 5;
let frames: { data: ImageData; t: number; type: string; payload: any }[] = [];

let captureCanvas: HTMLCanvasElement | null = null;
let captureCtx: CanvasRenderingContext2D | null = null;

export function ensureCaptureCanvas(): HTMLCanvasElement {
  if (!captureCanvas) {
    captureCanvas = document.createElement('canvas');
    captureCanvas.width = 480;
    captureCanvas.height = 320;
    // willReadFrequently — getImageData 가 captureFrame 마다 호출되므로 Chrome 최적화 hint
    captureCtx = captureCanvas.getContext('2d', { willReadFrequently: true });
  }
  return captureCanvas;
}

/** 화면을 작은 캔버스로 캡처 — 비싸므로 주의해 호출 (이벤트당 1회). */
export function captureFrame(ev: HighlightEvent, sourceCanvas?: HTMLCanvasElement): void {
  const c = ensureCaptureCanvas();
  const ctx = captureCtx!;
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, c.width, c.height);
  if (sourceCanvas) {
    try {
      ctx.drawImage(sourceCanvas, 0, 0, c.width, c.height);
    } catch { /* tainted — skip */ }
  }
  // 텍스트 오버레이
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 24px monospace';
  ctx.fillText(labelFor(ev), 16, 32);
  ctx.fillStyle = '#f0f0ff';
  ctx.font = '14px monospace';
  ctx.fillText(`${ev.t.toFixed(1)}s`, 16, c.height - 16);

  const data = ctx.getImageData(0, 0, c.width, c.height);
  frames.push({ data, t: ev.t, type: ev.type, payload: ev.payload });
  if (frames.length > MAX_FRAMES) frames.shift();
}

function labelFor(ev: HighlightEvent): string {
  const p = ev.payload as Record<string, any>;
  switch (ev.type) {
    case 'maxCombo': return `MAX COMBO ×${p.combo}`;
    case 'synergy': return `SYNERGY ${p.id ?? ''}`;
    case 'bossDefeat': return `BOSS DEFEATED`;
    case 'legendary': return `LEGENDARY ${p.id ?? ''}`;
    case 'bigPayout': return `+${formatNum(Number(p.coins) || 0)} coins`;
    default: return ev.type;
  }
}

/**
 * 캡처된 5 프레임을 1080×1080 캔버스로 합성. PNG dataURL 반환.
 * 5장이 안 되면 placeholder 로 채움.
 */
export function buildReelPng(): string {
  const SIZE = 1080;
  const out = document.createElement('canvas');
  out.width = SIZE; out.height = SIZE;
  const ctx = out.getContext('2d')!;

  // 배경 그라데이션
  const g = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  g.addColorStop(0, '#0a0a1a');
  g.addColorStop(0.5, '#1a1a2e');
  g.addColorStop(1, '#0a0a1a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // 제목
  ctx.fillStyle = '#ff2a6d';
  ctx.font = 'bold 64px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SAMSARA', SIZE / 2, 120);
  ctx.fillStyle = '#05d9e8';
  ctx.font = '24px monospace';
  ctx.fillText('윤회 · HIGHLIGHTS', SIZE / 2, 160);

  // 5 프레임 2x3 그리드 (마지막 1칸 비움)
  const PADDING = 60;
  const FRAME_W = 460;
  const FRAME_H = 300;
  const positions = [
    [PADDING,             220],
    [SIZE - PADDING - FRAME_W, 220],
    [PADDING,             540],
    [SIZE - PADDING - FRAME_W, 540],
    [SIZE / 2 - FRAME_W / 2, 860],
  ];
  for (let i = 0; i < MAX_FRAMES; i++) {
    const [x, y] = positions[i];
    ctx.fillStyle = '#1a1a2e';
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 4;
    ctx.fillRect(x, y, FRAME_W, FRAME_H);
    ctx.strokeRect(x, y, FRAME_W, FRAME_H);
    const f = frames[i];
    if (f) {
      // ImageData 를 임시 캔버스 → 출력 캔버스로 그리기
      const tmp = document.createElement('canvas');
      tmp.width = f.data.width; tmp.height = f.data.height;
      tmp.getContext('2d')!.putImageData(f.data, 0, 0);
      ctx.drawImage(tmp, x + 4, y + 4, FRAME_W - 8, FRAME_H - 8);
    } else {
      ctx.fillStyle = '#8888aa';
      ctx.font = '20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('—', x + FRAME_W / 2, y + FRAME_H / 2);
    }
  }

  ctx.textAlign = 'left';
  return out.toDataURL('image/png');
}

export function clearReel(): void {
  frames = [];
}

export function getReelFrameCount(): number {
  return frames.length;
}
