// 2026-05-11 — 사용자 신고 버그 회귀:
//  (1) 콤보 임계 보너스 NUMBER_POPUP 가 raw 정수 "x117440513" 처럼 출력 → fmtBig 으로 K/M/B/T 포맷
//  (2) biome 페널티(0.2)로 일부 formation/recipe 가 등록 안 됨 → fallback 으로 count 등록 보장

import { beforeEach, describe, expect, it } from 'vitest';
import { newGameState, setRngSeed } from '../src/game/cards';
import { reduce } from '../src/game/state';
import { createWorld } from '../src/game/world';
import { setTerrainSeed } from '../src/game/terrain';

beforeEach(() => {
  setRngSeed(42);
  setTerrainSeed(12345);
});

describe('NUMBER_POPUP 큰 수 포맷', () => {
  it('1K 이상 코인 픽업 — text 가 K/M/B 약어로 출력', () => {
    const s = newGameState({});
    // coinGainMult 를 키워 픽업 결과 큰 수 강제
    s.coinGainMult = 10000;
    const r = reduce(s, { type: 'PICKUP', coins: 100, x: 0, y: 0, kind: 'coin' });
    const popup = r.events.find(e => e.type === 'NUMBER_POPUP');
    expect(popup).toBeTruthy();
    // 1M 코인 = "+1.0M" 등 짧은 형태 (정확한 자릿수는 fmtBig 구현에 따름)
    const text = popup && (popup as any).text;
    expect(text).toMatch(/[KMB]$/); // K/M/B suffix 가 있음
    expect(text).not.toMatch(/\d{6,}/); // 6자리 이상 raw 숫자 없음
  });

  it('탭 보상 — tapMult/globalScoreMult 폭주 시도 ', () => {
    const s = reduce(newGameState({}), { type: 'START_WAVE', wave: 1 }).state;
    s.tapMult = 1_000_000;
    s.globalScoreMult = 1000;
    const r = reduce(s, { type: 'TAP', t: 1000, x: 100, y: 100 });
    const popups = r.events.filter(e => e.type === 'NUMBER_POPUP');
    expect(popups.length).toBeGreaterThan(0);
    for (const p of popups) {
      const text = (p as any).text as string;
      // raw 9자리 숫자 없어야 함 (1e8 이상은 K/M/B/T 로 포맷)
      expect(text).not.toMatch(/\d{9,}/);
    }
  });

  it('콤보 임계 보너스 — 큰 bonus 가 fmtBig 로 포맷', () => {
    const s = reduce(newGameState({}), { type: 'START_WAVE', wave: 1 }).state;
    s.combo = 9;  // 10 도달 직전
    s.lastTapTime = 950;  // 콤보 window 안 (300ms 기본)
    s.tapMult = 100_000_000;
    s.globalScoreMult = 100;
    const r = reduce(s, { type: 'TAP', t: 1000, x: 100, y: 100 });
    // 콤보 = 10, COMBO_MULT[10] = 1.5 → bonus 거대
    const goldPopups = r.events.filter(e =>
      e.type === 'NUMBER_POPUP' && (e as any).color === '#ffd700'
    );
    expect(goldPopups.length).toBeGreaterThan(0);
    for (const p of goldPopups) {
      const text = (p as any).text as string;
      // "+1.2T ×1.5" 같은 형태. raw 9자리 정수 없음.
      expect(text).not.toMatch(/\d{9,}/);
    }
  });
});

describe('formation/recipe 등록 보장', () => {
  it('createWorld 가 충분한 prop 을 등록 (count 손실 < 30%)', () => {
    // 기대값 (recipes 합): shrine 6 + wreck 10 + stardust 12 + asteroid 12 + blackhole 3 + lantern 6
    //   + rocks 6 + ruins 3 + pressure_plate 5 + beacon 4 + mirror_shard 6 + cursed_totem 2 = 75
    // + formation: castle_wall 4*~5 monolith = ~20 + rock_cluster 6*~6 = ~36 + temple_ruins 3*7 = ~21 + broken_archway 4*~4 = ~16. 총 ~93 from formations.
    // 합계 ~ 168 prop. fallback 적용 후 손실 30% 이내.
    const w = createWorld();
    const propCount = w.props.length;
    expect(propCount).toBeGreaterThan(100);  // 최소치 — 충분히 많이 등록됨
  });

  it('각 prop kind 가 최소 1개 이상 등장 (cursed_totem 처럼 희소한 종도 보장)', () => {
    const w = createWorld();
    const kinds = new Set(w.props.map(p => p.kind));
    // cursed_totem 은 count 2 — fallback 으로 등록 보장
    expect(kinds.has('cursed_totem')).toBe(true);
    // beacon 도 count 4 — 등록되어야 함
    expect(kinds.has('beacon')).toBe(true);
    // pressure_plate count 5
    expect(kinds.has('pressure_plate')).toBe(true);
    // 솔리드 벽도 모두 등장 (formation + 산개)
    expect(kinds.has('monolith')).toBe(true);
    expect(kinds.has('rocks')).toBe(true);
    expect(kinds.has('ruins')).toBe(true);
  });

  it('formation count 최소치 — castle_wall 의 monolith 가 최소 5개 (1 wall = ~5 monolith)', () => {
    const w = createWorld();
    const monolithCount = w.props.filter(p => p.kind === 'monolith').length;
    // 4 castle_walls × 평균 4 monolith (skip 1) = ~16. fallback 으로 최소 5+ 보장.
    expect(monolithCount).toBeGreaterThanOrEqual(5);
  });

  it('⭐ ridge chain — elevation 임계 셀에 rocks/monolith 가 밀집 spawn', () => {
    const w = createWorld();
    // ridge chain 으로 rocks + monolith 가 산맥 형태로 대량 spawn.
    // 기존 산개 (rocks 6 + monolith from formation ~16) 대비 ≥2배 이상이어야 함.
    const rockCount = w.props.filter(p => p.kind === 'rocks').length;
    const monolithCount = w.props.filter(p => p.kind === 'monolith').length;
    expect(rockCount).toBeGreaterThanOrEqual(20);  // 산맥 ridge 로 인한 밀집
    expect(monolithCount).toBeGreaterThanOrEqual(10);  // peak monolith 추가
  });
});
