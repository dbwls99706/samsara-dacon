// SAMSARA · 윤회 — 보스 시스템
//
// 보스 웨이브: 30초 안에 목표 점수 격파.
// 보스 종류: 일반 (W5/15/30) / 메가 (W10/20/35) / 신성 (W25/50/75)
// 격파 시 의식 카드 3종 선택 (영구 런 버프)

import { rng, DATA } from './cards.js';
import type { Card } from './types.js';

export type BossKind = 'normal' | 'mega' | 'divine';

export interface BossSpec {
  kind: BossKind;
  wave: number;
  targetScore: number;
  bgmTrack: 'boss_normal' | 'boss_mega' | 'boss_divine';
  rewardLabel: string;
}

const NORMAL_WAVES = new Set([5, 15, 30, 40]);
const MEGA_WAVES = new Set([10, 20, 35]);
const DIVINE_WAVES = new Set([25, 50, 75]);

export function isBossWave(wave: number): boolean {
  return NORMAL_WAVES.has(wave) || MEGA_WAVES.has(wave) || DIVINE_WAVES.has(wave);
}

export function bossKind(wave: number): BossKind | null {
  if (DIVINE_WAVES.has(wave)) return 'divine';
  if (MEGA_WAVES.has(wave)) return 'mega';
  if (NORMAL_WAVES.has(wave)) return 'normal';
  return null;
}

export function bossSpec(wave: number): BossSpec | null {
  const kind = bossKind(wave);
  if (!kind) return null;
  // target = 100 * 1.4^wave * (kind multiplier)
  const base = Math.floor(100 * Math.pow(1.4, wave));
  const mult = kind === 'divine' ? 7 : kind === 'mega' ? 4 : 2.5;
  return {
    kind,
    wave,
    targetScore: Math.floor(base * mult),
    bgmTrack: kind === 'divine' ? 'boss_divine' : kind === 'mega' ? 'boss_mega' : 'boss_normal',
    rewardLabel: kind === 'divine' ? '신성한 의식' : kind === 'mega' ? '메가 의식' : '의식',
  };
}

// ─────────────────────────── 의식 카드 (영구 런 버프) ───────────────────────────

export interface RitualCard {
  id: string;
  name_ko: string;
  desc_ko: string;
  apply: (state: import('./types.js').GameState) => void;
}

export const RITUAL_CARDS: RitualCard[] = [
  { id: 'rit_rage',     name_ko: '격노',         desc_ko: '보스 격파 시 +5,000', apply: s => { s.coins += 5000; } },
  { id: 'rit_eternal',  name_ko: '영원의 약속',   desc_ko: '라이프 영구 +1',      apply: s => { s.lifeMax += 1; s.life += 1; } },
  { id: 'rit_time',     name_ko: '시간 정복',     desc_ko: '모든 웨이브 +5초',    apply: s => { s.waveTimeMax += 5; s.waveTimeRemaining += 5; } },
  { id: 'rit_combo',    name_ko: '콤보 마스터',   desc_ko: '콤보 윈도우 +0.15초', apply: s => { s.comboWindow += 0.15; } },
  { id: 'rit_gold',     name_ko: '황금 손',       desc_ko: '코인 획득 ×1.5',      apply: s => { s.coinGainMult *= 1.5; } },
  { id: 'rit_revive',   name_ko: '불사조',         desc_ko: '부활 +1회',           apply: s => { s.reviveAvailable += 1; } },
  { id: 'rit_global',   name_ko: '운명의 총애',   desc_ko: '점수 ×1.3 (영구)',    apply: s => { s.globalScoreMult *= 1.3; } },
  { id: 'rit_tap',      name_ko: '맹타',         desc_ko: '탭 위력 ×2',           apply: s => { s.tapMult *= 2; } },
  { id: 'rit_legendary', name_ko: '전설의 부름',  desc_ko: '다음 카드 전설 등급', apply: s => { s.forceNextCardRarity = 'legendary'; } },
];

/** 의식 카드 3장 무작위 추첨 (중복 X) */
export function drawRitualChoices(): RitualCard[] {
  const pool = [...RITUAL_CARDS];
  const out: RitualCard[] = [];
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

// ─────────────────────────── 신성 보스 격파 보상 (전설 카드) ───────────────────────────

export function drawLegendaryChoices(): Card[] {
  const legendaries = DATA.cards.filter(c => c.rarity === 'legendary');
  const pool = [...legendaries];
  const out: Card[] = [];
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}
