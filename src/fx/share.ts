// SAMSARA · 윤회 — 공유 이미지 1080×1080 PNG 생성
//
// 게임 오버 화면에서 "공유" 버튼 클릭 시 자동 생성.
// Web Share API 우선, 실패 시 다운로드 폴백.

import type { GameState } from '../game/types.js';
import { formatNum, allRunIdentities, allSynergies, allModifierDefs } from '../game/cards.js';
import { BIOME_KINDS } from '../game/terrain.js';

const TAG_EMOJI: Record<string, string> = { fire: '🔥', ice: '❄️', gold: '💰', time: '⏱️', chaos: '🌀', echo: '🪞' };

export function buildSharePng(state: GameState): string {
  const SIZE = 1080;
  const c = document.createElement('canvas');
  c.width = SIZE; c.height = SIZE;
  const ctx = c.getContext('2d')!;

  // 배경
  const bg = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 100, SIZE / 2, SIZE / 2, SIZE);
  bg.addColorStop(0, '#1a1a2e');
  bg.addColorStop(1, '#0a0a1a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // 별빛 노이즈
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.4})`;
    ctx.fillRect(Math.random() * SIZE, Math.random() * SIZE, 2, 2);
  }

  // 헤더 — 그라디언트 텍스트
  ctx.textAlign = 'center';
  ctx.font = 'bold 96px monospace';
  const titleGrad = ctx.createLinearGradient(0, 0, SIZE, 0);
  titleGrad.addColorStop(0, '#ff2a6d');
  titleGrad.addColorStop(1, '#05d9e8');
  ctx.fillStyle = titleGrad;
  ctx.fillText('SAMSARA', SIZE / 2, 160);

  ctx.fillStyle = '#8888aa';
  ctx.font = '32px monospace';
  ctx.fillText('윤회 · 30초마다 새 운명을 짠다', SIZE / 2, 220);

  // 점수 — 거대 황금 숫자
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 200px monospace';
  ctx.shadowBlur = 30;
  ctx.shadowColor = '#ffd700';
  ctx.fillText(formatNum(state.totalScore), SIZE / 2, 480);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#f0f0ff';
  ctx.font = '36px monospace';
  ctx.fillText(`최종 점수`, SIZE / 2, 540);

  // Run Identity (있으면)
  if (state.runIdentity) {
    ctx.fillStyle = '#ff2a6d';
    ctx.font = 'bold 52px monospace';
    ctx.fillText(state.runIdentity, SIZE / 2, 600);
  }

  // 통계 박스
  const statsY = 645;
  ctx.fillStyle = 'rgba(26,26,46,0.7)';
  ctx.fillRect(120, statsY, SIZE - 240, 120);
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 2;
  ctx.strokeRect(120, statsY, SIZE - 240, 120);

  ctx.fillStyle = '#f0f0ff';
  ctx.font = 'bold 34px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`웨이브 ${state.wave}`, 160, statsY + 52);
  ctx.fillText(`콤보 ×${state.comboMaxRun}`, 160, statsY + 95);
  ctx.textAlign = 'right';
  ctx.fillText(`보스 ${state.stats.bossesDefeated}`, SIZE - 160, statsY + 52);
  ctx.fillText(`카드 ${state.cards.length}장`, SIZE - 160, statsY + 95);

  // ⭐ 윤회 도감 깊이 패널 — 1차 투표(6/8~) 중 SNS/DACON 갤러리 노출면.
  //   동료 개발자(60% 가중)에게 "매 런이 구조적으로 다른 게임" 을 한 장으로 전달.
  //   meta read-only. 색만으로 정보 X (◆⚡◈⬡ 글리프 + 숫자).
  const m = state.meta;
  const clamp = (a: number, b: number) => Math.min(a, b);
  const codex: [string, string, number, number, string][] = [
    ['◆', '운명',   clamp((m.seenIdentityIds ?? []).length, allRunIdentities().length), allRunIdentities().length, '#c98bff'],
    ['⚡', '시너지', clamp((m.seenSynergyIds ?? []).length, allSynergies().length),       allSynergies().length,    '#ffd700'],
    ['◈', '모디',   clamp((m.seenModifierIds ?? []).length, allModifierDefs().length),   allModifierDefs().length, '#ff8c3a'],
    ['⬡', '생태계', clamp((m.seenBiomeIds ?? []).length, BIOME_KINDS.length),            BIOME_KINDS.length,       '#00ff88'],
  ];
  const remainRI = Math.max(0, allRunIdentities().length - codex[0][2]);
  const cdxX = 110, cdxY = 800, cdxW = SIZE - 220, cdxH = 180;
  const cgrad = ctx.createLinearGradient(cdxX, cdxY, cdxX, cdxY + cdxH);
  cgrad.addColorStop(0, 'rgba(57,28,84,0.55)');
  cgrad.addColorStop(1, 'rgba(16,12,28,0.85)');
  ctx.fillStyle = cgrad;
  ctx.fillRect(cdxX, cdxY, cdxW, cdxH);
  ctx.strokeStyle = '#b14aff';
  ctx.lineWidth = 2;
  ctx.strokeRect(cdxX, cdxY, cdxW, cdxH);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#c98bff';
  ctx.font = 'bold 38px monospace';
  ctx.fillText('◆  윤회 도감', cdxX + 36, cdxY + 56);
  ctx.fillStyle = '#9a93b8';
  ctx.font = '22px monospace';
  ctx.fillText(`매 런이 구조적으로 다른 게임 · 아직 못 본 운명 ${remainRI}개`, cdxX + 36, cdxY + 92);

  ctx.textAlign = 'center';
  codex.forEach(([glyph, label, seen, total, col], i) => {
    const colX = cdxX + cdxW * (i + 0.5) / 4;
    ctx.fillStyle = col;
    ctx.font = 'bold 30px monospace';
    ctx.fillText(`${glyph} ${label}`, colX, cdxY + 138);
    ctx.fillStyle = '#f0f0ff';
    ctx.font = 'bold 32px monospace';
    ctx.fillText(`${seen} / ${total}`, colX, cdxY + 172);
  });

  // 카드 5장 미리보기 (보유한 첫 5장 태그 이모지)
  const cardsY = 1018;
  ctx.textAlign = 'center';
  ctx.font = '46px monospace';
  const showCards = state.cards.slice(0, 5);
  const startX = SIZE / 2 - (showCards.length - 1) * 50;
  showCards.forEach((card, i) => {
    const tag = card.tags[0] ?? '';
    const emoji = TAG_EMOJI[tag] ?? '✨';
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(startX + i * 100 - 36, cardsY - 36, 72, 72);
    ctx.strokeStyle = '#' + (tag === 'fire' ? 'ff2a6d' : tag === 'ice' ? '05d9e8' : tag === 'gold' ? 'ffd700' : tag === 'time' ? 'd300c5' : tag === 'chaos' ? 'ff6f00' : 'b3ff00');
    ctx.lineWidth = 3;
    ctx.strokeRect(startX + i * 100 - 36, cardsY - 36, 72, 72);
    ctx.fillStyle = '#f0f0ff';
    ctx.fillText(emoji, startX + i * 100, cardsY + 16);
  });

  // 푸터
  ctx.textAlign = 'center';
  ctx.font = '24px monospace';
  ctx.fillStyle = '#8888aa';
  ctx.fillText('samsara-dacon.vercel.app', SIZE / 2, 1068);

  return c.toDataURL('image/png');
}

/** Web Share API 우선, 실패 시 다운로드. */
export async function shareImage(dataUrl: string, fileName: string = 'samsara-score.png'): Promise<{ ok: boolean; method: 'share' | 'download' }> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], fileName, { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: any) => boolean };
    if (nav.canShare && nav.canShare({ files: [file] }) && navigator.share) {
      await navigator.share({
        files: [file],
        title: 'SAMSARA · 윤회',
        text: '30초마다 새 운명을 짠다',
      });
      return { ok: true, method: 'share' };
    }
  } catch (err) {
    console.warn('[share]', err);
  }
  // 다운로드 폴백
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  return { ok: true, method: 'download' };
}
