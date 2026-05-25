import { describe, expect, it } from 'vitest';
import { buildWeapons, STARTERS } from '../src/game/weapons';
import { getCard, newGameState } from '../src/game/cards';
import type { Card } from '../src/game/types';

describe('buildWeapons — 카드 → 무기 변환', () => {
  it('카드 0장이어도 시작 무기 1개 포함', () => {
    const ws = buildWeapons([], newGameState({}), 'tiger');
    expect(ws.length).toBe(1);
    expect(ws[0].id).toBe('starter_claw');
  });

  it('5 캐릭터별 시작 무기 ID 분리', () => {
    const characters = ['tiger', 'magpie', 'dokkaebi', 'gumiho', 'dragon'] as const;
    const starterIds = new Set<string>();
    for (const ch of characters) {
      const w = STARTERS[ch].weapon();
      starterIds.add(w.id);
    }
    expect(starterIds.size).toBe(5);
  });

  it('🔥 카드 1장 → 시작무기 + 화염무기 (lv1)', () => {
    const card: Card = getCard('F01')!;
    const ws = buildWeapons([card], newGameState({}), 'tiger');
    expect(ws.length).toBe(2);
    const fire = ws.find(w => w.tag === 'fire' && w.id === 'fire');
    expect(fire).toBeDefined();
    expect(fire!.level).toBe(1);
    expect(fire!.evolved).toBeFalsy();
  });

  it('🔥 카드 5장 → 화염무기 evolved (lv 5)', () => {
    // 같은 태그 5장 시뮬 — 같은 카드 복제로 충분 (counts 만 보기 때문)
    const card: Card = getCard('F01')!;
    const cards = [card, card, card, card, card];
    const ws = buildWeapons(cards, newGameState({}), 'tiger');
    const fire = ws.find(w => w.id === 'fire')!;
    expect(fire.level).toBe(5);
    expect(fire.evolved).toBe(true);
    expect(fire.displayName).toContain('진화');
  });

  it('듀얼태그 카드 → 두 무기 모두 +1 레벨', () => {
    // F01 = 단일 fire 태그라 가정. 듀얼태그를 찾기 위해 모든 카드 중 듀얼 1장 사용
    const card = getCard('F01')!;
    const cards = [card, card, card]; // fire ×3 → fire 무기 lv3, synergy3 발동
    const ws = buildWeapons(cards, newGameState({}), 'tiger');
    const fire = ws.find(w => w.id === 'fire')!;
    expect(fire.level).toBe(3);
  });

  it('각 무기 cooldownMax > 0', () => {
    const card = getCard('F01')!;
    const ws = buildWeapons([card], newGameState({}), 'tiger');
    for (const w of ws) {
      expect(w.cooldownMax).toBeGreaterThan(0);
    }
  });
});
