// 2026-05-11 — 펄린 노이즈 지형 시스템 회귀 테스트
//
// 검증:
//  - valueNoise2d / fbm2d 의 결정론 (같은 시드 → 같은 값)
//  - 범위 — value/fbm 모두 [0,1]
//  - biomeAt 의 4 biome 분류가 모두 등장 (전역 균형)
//  - biomeWeight — 선호 biome > 비선호 biome
//  - setTerrainSeed / getTerrainSeed 동기

import { beforeEach, describe, expect, it } from 'vitest';
import {
  biomeAt,
  biomeWeight,
  BIOME_PROP_WEIGHTS,
  BIOME_TINT,
  CONTOUR_LEVELS,
  elevationAt,
  fbm2d,
  getTerrainSeed,
  PEAK_THRESHOLD,
  RIDGE_THRESHOLD,
  sampleNoiseRaw,
  setTerrainSeed,
  slopeSpeedMul,
  valueNoise2d,
} from '../src/game/terrain';

beforeEach(() => setTerrainSeed(12345));

describe('valueNoise2d — 결정론 + 범위', () => {
  it('같은 좌표/시드 → 같은 값', () => {
    const v1 = valueNoise2d(0.5, 0.5, 100);
    const v2 = valueNoise2d(0.5, 0.5, 100);
    expect(v1).toBe(v2);
  });

  it('다른 시드 → 거의 다른 값', () => {
    const v1 = valueNoise2d(0.5, 0.5, 100);
    const v2 = valueNoise2d(0.5, 0.5, 200);
    expect(v1).not.toBe(v2);
  });

  it('출력 범위 [0, 1]', () => {
    for (let i = 0; i < 200; i++) {
      const x = (Math.random() - 0.5) * 100;
      const y = (Math.random() - 0.5) * 100;
      const v = valueNoise2d(x, y, 42);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('인접 좌표 연속성 — smoothstep 보간으로 점프 없음', () => {
    const a = valueNoise2d(1.0, 1.0, 99);
    const b = valueNoise2d(1.01, 1.0, 99);
    const c = valueNoise2d(1.001, 1.0, 99);
    expect(Math.abs(a - b)).toBeLessThan(0.5);  // 큰 점프 없음
    expect(Math.abs(a - c)).toBeLessThan(0.05); // 매우 가까우면 매우 비슷
  });
});

describe('fbm2d — 4 옥타브 누적', () => {
  it('출력 범위 [0, 1]', () => {
    for (let i = 0; i < 200; i++) {
      const x = (Math.random() - 0.5) * 100;
      const y = (Math.random() - 0.5) * 100;
      const v = fbm2d(x, y, 42);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('결정론', () => {
    expect(fbm2d(1.5, 2.5, 7)).toBe(fbm2d(1.5, 2.5, 7));
  });

  it('옥타브 인자 — 다른 결과', () => {
    expect(fbm2d(1, 1, 7, 2)).not.toBe(fbm2d(1, 1, 7, 8));
  });
});

describe('biomeAt — 4 biome 균형', () => {
  it('1000 포인트 샘플 — 모든 biome 등장 (전역 다양성)', () => {
    const counts: Record<string, number> = { mountain: 0, plains: 0, cursed: 0, sanctuary: 0 };
    // 거대 영역 샘플 (5000x5000 정사각형)
    for (let i = 0; i < 1000; i++) {
      const x = (Math.random() - 0.5) * 10000;
      const y = (Math.random() - 0.5) * 10000;
      const b = biomeAt(x, y, 12345);
      counts[b] = (counts[b] ?? 0) + 1;
    }
    // 4 biome 모두 한 번 이상 등장
    expect(counts.mountain).toBeGreaterThan(0);
    expect(counts.plains).toBeGreaterThan(0);
    expect(counts.cursed).toBeGreaterThan(0);
    expect(counts.sanctuary).toBeGreaterThan(0);
    // plains 가 dominant (가장 흔함)
    expect(counts.plains).toBeGreaterThanOrEqual(counts.cursed);
    expect(counts.plains).toBeGreaterThanOrEqual(counts.sanctuary);
  });

  it('결정론 — 같은 좌표/시드 = 같은 biome', () => {
    expect(biomeAt(123, 456, 7)).toBe(biomeAt(123, 456, 7));
  });

  it('시드 변경 시 biome 맵 달라짐', () => {
    let diffs = 0;
    for (let i = 0; i < 50; i++) {
      const x = i * 137, y = i * 211;
      if (biomeAt(x, y, 1) !== biomeAt(x, y, 99999)) diffs++;
    }
    expect(diffs).toBeGreaterThan(10);  // 최소 20% 변경
  });
});

describe('biomeWeight — 선호 biome 가중치', () => {
  it('각 biome 에서 선호 prop > 비선호 prop', () => {
    // mountain biome 인 좌표를 명시적으로 찾기
    let foundMountain: { x: number; y: number } | null = null;
    for (let i = 0; i < 1000 && !foundMountain; i++) {
      const x = (Math.random() - 0.5) * 10000;
      const y = (Math.random() - 0.5) * 10000;
      if (biomeAt(x, y, 12345) === 'mountain') foundMountain = { x, y };
    }
    expect(foundMountain).toBeTruthy();
    if (foundMountain) {
      // 산악에서 rocks (가중 4.0) > shrine (없음 → 기본 0.2)
      expect(biomeWeight('rocks', foundMountain.x, foundMountain.y, 12345))
        .toBeGreaterThan(biomeWeight('shrine', foundMountain.x, foundMountain.y, 12345));
    }
  });

  it('가중치 테이블 일관성 — 4 biome 모두 정의됨', () => {
    expect(BIOME_PROP_WEIGHTS.mountain).toBeDefined();
    expect(BIOME_PROP_WEIGHTS.plains).toBeDefined();
    expect(BIOME_PROP_WEIGHTS.cursed).toBeDefined();
    expect(BIOME_PROP_WEIGHTS.sanctuary).toBeDefined();
    // cursed 의 cursed_totem 이 가장 강한 가중
    expect(BIOME_PROP_WEIGHTS.cursed.cursed_totem ?? 0).toBeGreaterThan(2);
    expect(BIOME_PROP_WEIGHTS.sanctuary.shrine ?? 0).toBeGreaterThan(3);
  });

  it('가중치 음수 X / 0 이상', () => {
    for (const [biome, weights] of Object.entries(BIOME_PROP_WEIGHTS)) {
      for (const [, w] of Object.entries(weights as Record<string, number>)) {
        expect(w).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('BIOME_TINT — 시각 렌더 컬러', () => {
  it('4 biome 모두 정의됨 + RGB 정상 + alpha 양수', () => {
    for (const k of ['mountain', 'plains', 'cursed', 'sanctuary'] as const) {
      const t = BIOME_TINT[k];
      expect(t.r).toBeGreaterThanOrEqual(0);
      expect(t.r).toBeLessThanOrEqual(255);
      expect(t.g).toBeGreaterThanOrEqual(0);
      expect(t.g).toBeLessThanOrEqual(255);
      expect(t.b).toBeGreaterThanOrEqual(0);
      expect(t.b).toBeLessThanOrEqual(255);
      expect(t.a).toBeGreaterThan(0);
      expect(t.a).toBeLessThan(0.30);  // 강화된 틴트 (0.10~0.24)
    }
  });
});

describe('sampleNoiseRaw — debug/render 헬퍼', () => {
  it('biome + elevation + corruption 반환, biomeAt 와 일관', () => {
    const r = sampleNoiseRaw(100, 200, 42);
    expect(r.elevation).toBeGreaterThanOrEqual(-1);
    expect(r.elevation).toBeLessThanOrEqual(1);
    expect(r.corruption).toBeGreaterThanOrEqual(-1);
    expect(r.corruption).toBeLessThanOrEqual(1);
    expect(r.biome).toBe(biomeAt(100, 200, 42));
  });
});

describe('elevationAt — 빠른 elevation 샘플', () => {
  it('결정론 + 범위 [-1, 1]', () => {
    setTerrainSeed(12345);
    for (let i = 0; i < 50; i++) {
      const x = (Math.random() - 0.5) * 5000;
      const y = (Math.random() - 0.5) * 5000;
      const e = elevationAt(x, y);
      expect(e).toBeGreaterThanOrEqual(-1);
      expect(e).toBeLessThanOrEqual(1);
    }
    // 결정론
    expect(elevationAt(100, 200)).toBe(elevationAt(100, 200));
  });

  it('RIDGE_THRESHOLD / PEAK_THRESHOLD 일관성', () => {
    expect(RIDGE_THRESHOLD).toBe(0.40);
    expect(PEAK_THRESHOLD).toBe(0.55);
    expect(PEAK_THRESHOLD).toBeGreaterThan(RIDGE_THRESHOLD);
  });

  it('CONTOUR_LEVELS 가 RIDGE/PEAK 임계값을 포함', () => {
    expect(CONTOUR_LEVELS).toContain(RIDGE_THRESHOLD);
    expect(CONTOUR_LEVELS).toContain(PEAK_THRESHOLD);
  });
});

describe('slopeSpeedMul — 경사도 이동 보정', () => {
  it('동일 위치 = mul 1.0 (평지)', () => {
    setTerrainSeed(12345);
    const mul = slopeSpeedMul(100, 100, 100, 100);
    expect(mul).toBeCloseTo(1.0);
  });

  it('범위 [0.7, 1.25] 클램프', () => {
    setTerrainSeed(12345);
    for (let i = 0; i < 100; i++) {
      const x = (Math.random() - 0.5) * 5000;
      const y = (Math.random() - 0.5) * 5000;
      const dx = (Math.random() - 0.5) * 200;
      const dy = (Math.random() - 0.5) * 200;
      const mul = slopeSpeedMul(x, y, x + dx, y + dy);
      expect(mul).toBeGreaterThanOrEqual(0.7);
      expect(mul).toBeLessThanOrEqual(1.25);
    }
  });

  // ⭐ 결정론적 격자 스캔 — 이전엔 Math.random() 200회 탐색이라 ~17% 확률로 표본을
  //   못 찾고 "expected false to be true" 로 flaky 했다 (test-standards.md 위반).
  //   terrain 은 seed 12345 에서 완전 결정론적이므로 고정 격자를 훑으면 항상 같은 표본.
  //   STEP=137 은 노이즈 격자(800px)와 정렬되지 않게 한 소수성 간격.
  function findSlopeSample(want: 'up' | 'down'): { x: number; y: number } | null {
    const STEP = 137;
    for (let x = -3000; x <= 3000; x += STEP) {
      for (let y = -3000; y <= 3000; y += STEP) {
        const d = elevationAt(x + 50, y + 50) - elevationAt(x, y);
        if (want === 'up' && d > 0.15) return { x, y };
        if (want === 'down' && -d > 0.15) return { x, y };
      }
    }
    return null;
  }

  it('오르막 (toE > fromE) → mul < 1', () => {
    // Arrange
    setTerrainSeed(12345);
    // Act
    const p = findSlopeSample('up');
    // Assert
    expect(p).not.toBeNull();
    expect(slopeSpeedMul(p!.x, p!.y, p!.x + 50, p!.y + 50)).toBeLessThan(1.0);
  });

  it('내리막 (toE < fromE) → mul > 1', () => {
    // Arrange
    setTerrainSeed(12345);
    // Act
    const p = findSlopeSample('down');
    // Assert
    expect(p).not.toBeNull();
    expect(slopeSpeedMul(p!.x, p!.y, p!.x + 50, p!.y + 50)).toBeGreaterThan(1.0);
  });
});

describe('setTerrainSeed / getTerrainSeed', () => {
  it('세터 → 게터 일관', () => {
    setTerrainSeed(777);
    expect(getTerrainSeed()).toBe(777);
    setTerrainSeed(99999);
    expect(getTerrainSeed()).toBe(99999);
  });

  it('0 입력 시 기본 12345 fallback (잘못된 시드 방어)', () => {
    setTerrainSeed(0);
    expect(getTerrainSeed()).toBe(12345);
  });
});
