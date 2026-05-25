// 비밀 카드 S01–S05 잠금해제 + 풀 합류 회귀 가드.
// 기획서 §4-1.5 "Secret 5" / README "비밀 5장" / CLAUDE.md §12 가 단언하는
// 5종 비밀 카드가 (1) 데이터로 존재하고 (2) 조건 충족 시 실제 잠금해제되며
// (3) 잠금해제 후 drawCards 풀에 합류하고 (4) 그 전엔 절대 안 나오는지 검증.
// 이게 깨지면 "비밀 카드 5종" 주장이 기획↔구현 갭이 된다 (일관성 20점 직격).
import { describe, expect, it, beforeEach } from 'vitest';
import {
  newGameState, setRngSeed, allSecretCards,
  checkSecretCardUnlocks, loadCardUnlocks, drawCards,
} from '../src/game/cards';
import type { Card, CardTag, GameState } from '../src/game/types';

beforeEach(() => {
  setRngSeed(42);
  if (typeof globalThis.localStorage === 'undefined') {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    };
  } else {
    localStorage.clear();
  }
});

function card(id: string, tags: CardTag[]): Card {
  return { id, tags, rarity: 'common', effects: [] };
}

// 어떤 비밀 카드도 잠금해제되지 않는 깨끗한 베이스 상태 (각 테스트가 1개 조건만 켠다)
function neutral(): GameState {
  const s = newGameState({});
  s.comboMaxRun = 0;
  s.wave = 2;
  s.tapCount = 1;             // S02 (zeroTaps) 비활성
  s.waveTimeRemaining = 10;   // S03 (zeroTime) 비활성
  s.cards = [card('G01', ['gold'])]; // S05(0장)·S04(6태그)·S01(fire 0장) 비활성
  s.stats.bossesDefeated = 0; // S04 비활성
  return s;
}

describe('secret cards — 데이터 무결성', () => {
  it('test_secret_cards_catalog_is_exactly_S01_to_S05_with_valid_shape', () => {
    // Arrange
    const KNOWN_UNLOCK = new Set([
      'comboWithoutTag', 'clearWithZeroTaps', 'clearWithZeroTime',
      'allTagsBossDefeat', 'zeroCardsToWave',
    ]);
    // Act
    const secrets = allSecretCards();
    // Assert
    expect(secrets.map(c => c.id).sort()).toEqual(['S01', 'S02', 'S03', 'S04', 'S05']);
    for (const c of secrets) {
      expect(Array.isArray(c.tags)).toBe(true);
      expect(['common', 'rare', 'epic', 'legendary']).toContain(c.rarity);
      expect(Array.isArray(c.effects)).toBe(true);
      expect(c.effects.length).toBeGreaterThan(0);
      expect(c.unlock).toBeTruthy();
      expect(KNOWN_UNLOCK.has(String(c.unlock!.type))).toBe(true);
    }
  });
});

describe('secret cards — 조건별 잠금해제', () => {
  it('test_S01_combo100_zero_fire_wave5_unlocks_phoenix', () => {
    const s = neutral();
    s.comboMaxRun = 100; s.wave = 5; s.cards = []; // fire 0장
    expect(checkSecretCardUnlocks(s)).toContain('S01');
  });

  it('test_S01_locked_when_owning_a_fire_card', () => {
    const s = neutral();
    s.comboMaxRun = 100; s.wave = 5; s.cards = [card('F01', ['fire'])];
    expect(checkSecretCardUnlocks(s)).not.toContain('S01');
  });

  it('test_S02_zero_taps_clear_unlocks_lord_of_the_deep', () => {
    const s = neutral();
    s.tapCount = 0;
    expect(checkSecretCardUnlocks(s)).toContain('S02');
  });

  it('test_S03_five_time_cards_timeout_clear_unlocks_paradox', () => {
    const s = neutral();
    s.waveTimeRemaining = 0;
    s.cards = [0, 1, 2, 3, 4].map(i => card('T0' + i, ['time']));
    expect(checkSecretCardUnlocks(s)).toContain('S03');
  });

  it('test_S03_locked_when_time_remaining_positive', () => {
    const s = neutral();
    s.waveTimeRemaining = 5;
    s.cards = [0, 1, 2, 3, 4].map(i => card('T0' + i, ['time']));
    expect(checkSecretCardUnlocks(s)).not.toContain('S03');
  });

  it('test_S04_all_six_tags_plus_boss_defeat_unlocks_radiance', () => {
    const s = neutral();
    s.stats.bossesDefeated = 1;
    const tags: CardTag[] = ['fire', 'ice', 'gold', 'time', 'chaos', 'echo'];
    s.cards = tags.map((t, i) => card('X0' + i, [t]));
    expect(checkSecretCardUnlocks(s)).toContain('S04');
  });

  it('test_S04_locked_without_boss_defeat', () => {
    const s = neutral();
    s.stats.bossesDefeated = 0;
    const tags: CardTag[] = ['fire', 'ice', 'gold', 'time', 'chaos', 'echo'];
    s.cards = tags.map((t, i) => card('X0' + i, [t]));
    expect(checkSecretCardUnlocks(s)).not.toContain('S04');
  });

  it('test_S05_zero_cards_wave5_unlocks_the_void', () => {
    const s = neutral();
    s.cards = []; s.wave = 5;
    expect(checkSecretCardUnlocks(s)).toContain('S05');
  });

  it('test_neutral_state_unlocks_nothing', () => {
    expect(checkSecretCardUnlocks(neutral())).toEqual([]);
  });

  it('test_unlock_is_idempotent_and_persisted', () => {
    // Arrange
    const s = neutral();
    s.cards = []; s.wave = 5;
    // Act — 두 번째 호출은 이미 잠금해제되어 newly 에 포함 안 됨
    const first = checkSecretCardUnlocks(s);
    const second = checkSecretCardUnlocks(s);
    // Assert
    expect(first).toContain('S05');
    expect(second).not.toContain('S05');
    expect(loadCardUnlocks().ids).toContain('S05');
  });
});

describe('secret cards — drawCards 풀 합류', () => {
  it('test_locked_secret_legendary_never_appears_in_draw_pool', () => {
    // Arrange — 잠금해제 0 (beforeEach 가 localStorage clear)
    // Act — legendary 강제로 다수 드로우
    const drawn = drawCards(300, undefined, 'legendary').map(c => c.id);
    // Assert — 비밀 legendary S04/S05 는 풀에 없음
    expect(drawn).not.toContain('S04');
    expect(drawn).not.toContain('S05');
  });

  it('test_unlocked_secret_legendary_enters_draw_pool', () => {
    // Arrange — S04(광휘, legendary) 잠금해제
    const s = neutral();
    s.stats.bossesDefeated = 1;
    const tags: CardTag[] = ['fire', 'ice', 'gold', 'time', 'chaos', 'echo'];
    s.cards = tags.map((t, i) => card('X0' + i, [t]));
    expect(checkSecretCardUnlocks(s)).toContain('S04');
    // Act
    const drawn = drawCards(300, undefined, 'legendary').map(c => c.id);
    // Assert — 이제 legendary 풀에 합류 → 다수 드로우 시 등장
    expect(drawn).toContain('S04');
  });

  it('test_unlocked_secret_does_not_leak_into_unrelated_rarity', () => {
    // Arrange — S04(legendary) 잠금해제 후 common 강제 드로우
    const s = neutral();
    s.stats.bossesDefeated = 1;
    const tags: CardTag[] = ['fire', 'ice', 'gold', 'time', 'chaos', 'echo'];
    s.cards = tags.map((t, i) => card('X0' + i, [t]));
    checkSecretCardUnlocks(s);
    // Act
    const drawn = drawCards(300, undefined, 'common').map(c => c.id);
    // Assert — S04 는 legendary 라 common 풀엔 안 나옴
    expect(drawn).not.toContain('S04');
  });
});
