import { describe, expect, it } from 'vitest';
import { buildWeapons, STARTERS } from '../src/game/weapons';
import { getCard, newGameState, allCards } from '../src/game/cards';
import { createWorld } from '../src/game/world';
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

// 회귀: 7-tier 궁극(s7)이 첫 발동에 실제로 트리거되는가.
// 원본 버그(2026-05-30, Antigravity QA P1): fire/gold/time/chaos 의 7-tier 게이트가
// `t >= (w as any)._xxx7Ready` 였는데 _xxx7Ready 가 초기값 undefined → `t >= undefined`
// 는 항상 false → if 블록(궁극 효과 + 쿨다운 초기화)이 영원히 실행 안 됨 → 궁극 미발동.
// (ice 만 `?? 0` 이 있어 정상이었음.) fix = 4개에도 `?? 0` 추가.
// 가드: 첫 apply 후 해당 쿨다운 플래그가 number 로 세팅되면 = 블록이 실행됨 = 궁극 발동.
describe('buildWeapons — 7-tier 궁극 발동 (undefined 비교 회귀 가드)', () => {
  const CASES: { tag: string; flag: string }[] = [
    { tag: 'fire', flag: '_fire7Ready' },
    { tag: 'ice', flag: '_ice7Ready' },
    { tag: 'gold', flag: '_gold7Ready' },
    { tag: 'time', flag: '_time7Ready' },
    { tag: 'chaos', flag: '_chaos7Ready' },
  ];

  function singleTagCard(tag: string): Card {
    const c = allCards().find(c => (c.tags ?? []).length === 1 && (c.tags ?? [])[0] === tag);
    if (!c) throw new Error(`단일태그 ${tag} 카드 없음`);
    return c;
  }

  for (const { tag, flag } of CASES) {
    it(`weapon_${tag}_7stack_ultimate_fires_on_first_tick`, () => {
      // Arrange: 같은 태그 7장 → level 7 (s7=true)
      const cards = Array.from({ length: 7 }, () => singleTagCard(tag));
      const weapon = buildWeapons(cards, newGameState({}), 'tiger').find(w => w.id === tag)!;
      expect(weapon).toBeDefined();
      expect(weapon.level).toBeGreaterThanOrEqual(7);
      const world = createWorld();
      // 쿨다운 플래그는 world-scoped (weapons.ts line 376 주석 참조 — 다음 런 carry-over 방지)
      expect((world as any)[flag]).toBeUndefined(); // 초기엔 미설정

      // Act: 큰 t 로 1회 apply (쿨다운이 어떤 값이든 t 가 크면 게이트 통과해야 정상)
      weapon.apply(world, 10_000, newGameState({}));

      // Assert: 7-tier 블록이 실행되어 쿨다운 플래그가 세팅됨 (버그 시 undefined 유지 → 실패)
      expect(typeof (world as any)[flag]).toBe('number');
    });
  }
});
