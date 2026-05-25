// 깊이 가시화 회귀 가드 — handleGameOver 의 평생 발견 집합 누적.
// 게임오버 화면 "N / 28 운명 발견" 의 데이터 정합성. 이 로직이 깨지면
// 도감 카운터가 멈추거나 폭주(중복 누적)해 참신성 가시화가 무효가 된다.
import { describe, expect, it, beforeEach } from 'vitest';
import { newGameState, setRngSeed, allRunIdentities, allSynergies, allModifierDefs } from '../src/game/cards';
import { reduce } from '../src/game/state';
import { BIOME_KINDS } from '../src/game/terrain';
import type { GameState } from '../src/game/types';

beforeEach(() => setRngSeed(42));

function overWith(patch: Partial<GameState>): GameState {
  const s = newGameState({});
  Object.assign(s, patch);
  return reduce(s, { type: 'GAME_OVER' }).state;
}

describe('discovery — handleGameOver 평생 발견 누적', () => {
  it('test_gameover_first_identity_and_synergy_accumulate_and_flag_new', () => {
    // Arrange + Act
    const s = overWith({ runIdentity: 'id_7fire', activeSynergies: ['syn_fire_3', 'syn_fire_5'] });
    // Assert
    expect(s.meta.seenIdentityIds).toEqual(['id_7fire']);
    expect(s.meta.seenSynergyIds).toEqual(['syn_fire_3', 'syn_fire_5']);
    expect(s.stats.newIdentityThisRun).toBe(true);
    expect(s.stats.newSynergyThisRun).toBe(2);
  });

  it('test_gameover_repeat_discovery_no_duplicate_and_not_flagged_new', () => {
    // Arrange: 이미 평생 발견된 상태에서 같은 것을 다시 경험
    const s0 = newGameState({ seenIdentityIds: ['id_7fire'], seenSynergyIds: ['syn_fire_3'] });
    Object.assign(s0, { runIdentity: 'id_7fire', activeSynergies: ['syn_fire_3'] });
    // Act
    const s = reduce(s0, { type: 'GAME_OVER' }).state;
    // Assert — 중복 누적 0, NEW 플래그 꺼짐
    expect(s.meta.seenIdentityIds).toEqual(['id_7fire']);
    expect(s.meta.seenSynergyIds).toEqual(['syn_fire_3']);
    expect(s.stats.newIdentityThisRun).toBe(false);
    expect(s.stats.newSynergyThisRun).toBe(0);
  });

  it('test_gameover_partial_new_synergy_only_increments_unseen', () => {
    // Arrange: 시너지 1종 기보유, 런에서 2종 도달 (1종만 신규)
    const s0 = newGameState({ seenSynergyIds: ['syn_fire_3'] });
    Object.assign(s0, { runIdentity: null, activeSynergies: ['syn_fire_3', 'syn_fire_5'] });
    // Act
    const s = reduce(s0, { type: 'GAME_OVER' }).state;
    // Assert
    expect((s.meta.seenSynergyIds ?? []).sort()).toEqual(['syn_fire_3', 'syn_fire_5']);
    expect(s.stats.newSynergyThisRun).toBe(1);
    expect(s.stats.newIdentityThisRun).toBe(false);
  });

  it('test_gameover_no_identity_does_not_pollute_set', () => {
    // Arrange + Act — 정체성 미발현 런
    const s = overWith({ runIdentity: null, activeSynergies: [] });
    // Assert
    expect(s.meta.seenIdentityIds).toEqual([]);
    expect(s.meta.seenSynergyIds).toEqual([]);
    expect(s.stats.newIdentityThisRun).toBe(false);
    expect(s.stats.newSynergyThisRun).toBe(0);
  });

  it('test_newGameState_round_trips_persisted_seen_sets', () => {
    // Arrange + Act — localStorage 에서 로드된 partial meta 가 보존되는지 (persistence 가드)
    const s = newGameState({ seenIdentityIds: ['id_harmony', 'id_7ice'], seenSynergyIds: ['syn_echo_7'] });
    // Assert
    expect(s.meta.seenIdentityIds).toEqual(['id_harmony', 'id_7ice']);
    expect(s.meta.seenSynergyIds).toEqual(['syn_echo_7']);
  });

  it('test_seen_count_never_exceeds_total_catalog', () => {
    // Arrange — 누적 집합은 단조 증가하지만 카탈로그 총수를 넘지 않아야 도감 % 가 정상
    const s = overWith({ runIdentity: 'id_7fire', activeSynergies: ['syn_fire_3'] });
    // Assert
    expect((s.meta.seenIdentityIds ?? []).length).toBeLessThanOrEqual(allRunIdentities().length);
    expect((s.meta.seenSynergyIds ?? []).length).toBeLessThanOrEqual(allSynergies().length);
    expect(allRunIdentities().length).toBe(28);
    expect(allSynergies().length).toBe(18);
  });
});

describe('discovery — 모디파이어 / biome 평생 발견 누적', () => {
  it('test_gameover_modifier_and_biome_run_sets_merge_into_meta', () => {
    // Arrange — 런 도중 누적된 run-scoped 집합 (handleStartWave / BIOME_SEEN 가 채움)
    const s0 = newGameState({});
    s0.stats.modifierIds = ['mod_goldrain', 'mod_haste'];
    s0.stats.biomeIds = ['mountain', 'cursed'];
    // Act
    const s = reduce(s0, { type: 'GAME_OVER' }).state;
    // Assert — meta 로 머지 (handleGameOver 만 meta 변경)
    expect((s.meta.seenModifierIds ?? []).sort()).toEqual(['mod_goldrain', 'mod_haste']);
    expect((s.meta.seenBiomeIds ?? []).sort()).toEqual(['cursed', 'mountain']);
  });

  it('test_gameover_modifier_biome_dedupe_against_lifetime_set', () => {
    // Arrange — 일부는 이미 평생 발견됨. 중복 누적 0.
    const s0 = newGameState({ seenModifierIds: ['mod_goldrain'], seenBiomeIds: ['mountain'] });
    s0.stats.modifierIds = ['mod_goldrain', 'mod_haste']; // goldrain 은 이미 봄
    s0.stats.biomeIds = ['mountain', 'sanctuary'];        // mountain 은 이미 봄
    // Act
    const s = reduce(s0, { type: 'GAME_OVER' }).state;
    // Assert — 합집합, 중복 없음
    expect((s.meta.seenModifierIds ?? []).sort()).toEqual(['mod_goldrain', 'mod_haste']);
    expect((s.meta.seenBiomeIds ?? []).sort()).toEqual(['mountain', 'sanctuary']);
  });

  it('test_gameover_new_modifier_biome_counts_only_count_unseen', () => {
    // Arrange — goldrain/mountain 은 기보유, haste/sanctuary 만 신규
    const s0 = newGameState({ seenModifierIds: ['mod_goldrain'], seenBiomeIds: ['mountain'] });
    s0.stats.modifierIds = ['mod_goldrain', 'mod_haste'];
    s0.stats.biomeIds = ['mountain', 'sanctuary'];
    // Act
    const s = reduce(s0, { type: 'GAME_OVER' }).state;
    // Assert — 신규는 각각 1개만
    expect(s.stats.newModifierThisRun).toBe(1);
    expect(s.stats.newBiomeThisRun).toBe(1);
  });

  it('test_gameover_new_counts_zero_when_all_already_seen', () => {
    // Arrange — 전부 기보유
    const s0 = newGameState({ seenModifierIds: ['mod_a'], seenBiomeIds: ['cursed'] });
    s0.stats.modifierIds = ['mod_a'];
    s0.stats.biomeIds = ['cursed'];
    // Act
    const s = reduce(s0, { type: 'GAME_OVER' }).state;
    // Assert
    expect(s.stats.newModifierThisRun).toBe(0);
    expect(s.stats.newBiomeThisRun).toBe(0);
  });

  it('test_biome_seen_action_dedupes_and_respects_phase', () => {
    // Arrange — playing 페이즈에서 같은 biome 2회 통지 → 1개만 누적
    const s0 = newGameState({});
    s0.phase = 'playing';
    // Act
    let s = reduce(s0, { type: 'BIOME_SEEN', biome: 'plains' }).state;
    s = reduce(s, { type: 'BIOME_SEEN', biome: 'plains' }).state;
    s = reduce(s, { type: 'BIOME_SEEN', biome: 'cursed' }).state;
    // Assert — dedupe (plains 1회)
    expect((s.stats.biomeIds ?? []).sort()).toEqual(['cursed', 'plains']);
    // Act — 비-플레이 페이즈에서는 누적 안 됨 (오염 방지)
    s.phase = 'over';
    s = reduce(s, { type: 'BIOME_SEEN', biome: 'sanctuary' }).state;
    // Assert
    expect((s.stats.biomeIds ?? []).includes('sanctuary')).toBe(false);
  });

  it('test_no_run_modifiers_or_biomes_does_not_pollute_meta', () => {
    // Arrange + Act — 모디/biome 미발견 런 (방어적 — 빈 집합이 빈 집합으로)
    const s = reduce(newGameState({}), { type: 'GAME_OVER' }).state;
    // Assert
    expect(s.meta.seenModifierIds ?? []).toEqual([]);
    expect(s.meta.seenBiomeIds ?? []).toEqual([]);
  });

  it('test_newGameState_round_trips_persisted_modifier_biome_sets', () => {
    // Arrange + Act — localStorage 로드된 partial meta 보존 (persistence 가드)
    const s = newGameState({ seenModifierIds: ['mod_a', 'mod_b'], seenBiomeIds: ['cursed'] });
    // Assert
    expect(s.meta.seenModifierIds).toEqual(['mod_a', 'mod_b']);
    expect(s.meta.seenBiomeIds).toEqual(['cursed']);
  });

  it('test_modifier_biome_count_never_exceeds_total_catalog', () => {
    // Arrange — 도감 % 정상성: 누적 ≤ 카탈로그 총수
    const s0 = newGameState({});
    s0.stats.modifierIds = ['mod_goldrain'];
    s0.stats.biomeIds = ['mountain'];
    const s = reduce(s0, { type: 'GAME_OVER' }).state;
    // Assert — 카탈로그 계약 (영상/도감 분모와 동일 출처)
    expect((s.meta.seenModifierIds ?? []).length).toBeLessThanOrEqual(allModifierDefs().length);
    expect((s.meta.seenBiomeIds ?? []).length).toBeLessThanOrEqual(BIOME_KINDS.length);
    expect(allModifierDefs().length).toBe(30);
    expect(BIOME_KINDS.length).toBe(4);
  });
});

// 도감 화면(mountCodex) 모디파이어/생태계 열람 그리드의 렌더링 계약 가드.
// screens.ts 는 DOM 모듈이라 직접 import 불가 → 그리드가 의존하는 데이터 계약만 검증.
// 이게 깨지면 도감 카드가 빈 제목/오분류(특히 비밀형 이름 노출)로 렌더된다.
describe('discovery — 도감 열람 그리드 데이터 계약', () => {
  it('test_codex_every_modifier_has_known_type_and_nonempty_name', () => {
    // Arrange
    const KNOWN = new Set(['blessing', 'challenge', 'secret']);
    // Act
    const defs = allModifierDefs();
    // Assert — 그리드 type 배지 + 비밀 은닉 분기가 의존하는 계약
    for (const m of defs) {
      expect(KNOWN.has(m.type)).toBe(true);
      expect(typeof m.name_ko).toBe('string');
      expect(m.name_ko.trim().length).toBeGreaterThan(0);
    }
    // 비밀형이 최소 1종 존재해야 "??? 비밀" 은닉 UX 가 의미를 가진다
    expect(defs.some(m => m.type === 'secret')).toBe(true);
  });

  it('test_codex_modifier_ids_are_unique', () => {
    // Arrange + Act — 그리드는 id 1개당 카드 1장. 중복 id 면 도감 칸이 어긋난다.
    const ids = allModifierDefs().map(m => m.id);
    // Assert
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('test_codex_biome_kinds_are_exactly_the_known_four', () => {
    // Arrange — BIOME_INFO 라벨 맵이 커버해야 하는 정확한 키 집합
    const EXPECTED = ['mountain', 'plains', 'cursed', 'sanctuary'].sort();
    // Act
    const kinds = [...BIOME_KINDS].sort();
    // Assert — 새 biome 추가 시 이 테스트가 BIOME_INFO 갱신을 강제
    expect(kinds).toEqual(EXPECTED);
  });
});
