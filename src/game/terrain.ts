// SAMSARA · 윤회 — 펄린 노이즈 지형 시스템 (2026-05-11)
//
// 단순 무작위 prop 산개 → biome 기반 spatial coherence.
//
// 설계:
//  1) 2D value noise (해시 기반, deterministic) + smoothstep 보간 + 4 옥타브 FBM.
//  2) 두 채널 — elevation(고도) + corruption(부패도) 로 4 biome 분류.
//  3) 각 biome 에 prop 가중치 매핑 → generateProps 가 후보 위치 샘플 시 biome 검사.
//  4) render 측은 biomeAt 호출해 그리드 배경에 미세 컬러 틴트 (mountain=차가운 회색, cursed=마젠타,
//     sanctuary=황금, plains=중성).
//
// 외부 deps 0. simplex/perlin 라이브러리 사용 안 함 — 자체 hash + bilinear value noise + FBM.
// 결정론적(시드 고정) 이므로 회귀 테스트 가능.

// ─────────────────────────── Hash (32-bit integer mix) ───────────────────────────
// xxhash 류 — Math.imul 사용해 32-bit 모듈러 곱셈 정확도 보장.
function hash2(ix: number, iy: number, seed: number): number {
  let h = seed | 0;
  h = Math.imul(h ^ ix, 374761393);
  h = Math.imul(h ^ iy, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  // 부호 없는 32-bit → 0..1 부동소수.
  return (h >>> 0) / 4294967295;
}

function smoothstep(t: number): number { return t * t * (3 - 2 * t); }

/** 2D value noise — 4개 격자점 hash + smoothstep bilinear 보간. 0..1 반환. */
export function valueNoise2d(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const v00 = hash2(ix,     iy,     seed);
  const v10 = hash2(ix + 1, iy,     seed);
  const v01 = hash2(ix,     iy + 1, seed);
  const v11 = hash2(ix + 1, iy + 1, seed);
  const sx = smoothstep(fx);
  const sy = smoothstep(fy);
  const top = v00 + (v10 - v00) * sx;
  const bot = v01 + (v11 - v01) * sx;
  return top + (bot - top) * sy;
}

// ─────────────────────────── 등고선 임계값 ───────────────────────────
// 산맥/절벽 생성 + 등고선 렌더 + 경사도 이동 보정에 공용.
// elevation 범위는 [-1, +1]. 양수=고지대, 음수=저지대.
export const RIDGE_THRESHOLD = 0.40;      // 이 이상 = 산맥 형성 (rocks 밀집)
export const PEAK_THRESHOLD  = 0.55;      // 이 이상 = 정상부 (monolith)
export const CONTOUR_LEVELS = [-0.30, 0.00, 0.30, RIDGE_THRESHOLD, PEAK_THRESHOLD] as const;

/** Fractal Brownian Motion — 4 옥타브 누적. 0..1 반환. lacunarity=2, persistence=0.5. */
export function fbm2d(x: number, y: number, seed: number, octaves: number = 4): number {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2d(x * freq, y * freq, seed + i * 7919) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

// ─────────────────────────── Biome ───────────────────────────

export type BiomeKind = 'mountain' | 'plains' | 'cursed' | 'sanctuary';

/** 전체 biome 종류 — 도감 분모(총 4종)의 단일 출처. biomeAt 의 반환 도메인과 일치 유지. */
export const BIOME_KINDS: readonly BiomeKind[] = ['mountain', 'plains', 'cursed', 'sanctuary'];

// 노이즈 스케일 — biome 크기. 작을수록 큰 영역.
// 800px = 1 노이즈 단위 → 1 옥타브 cell ~ 800px, FBM 후 실효 biome 폭 ~ 600~1200px (스크린 1~2배).
const NOISE_SCALE = 1 / 800;
// corruption 채널은 seed 오프셋으로 elevation 과 독립.
const CORRUPTION_SEED_OFFSET = 31337;

/** ⭐ elevation 만 빠르게 샘플 ([-1, +1] 범위). corruption 무시 — 산맥/이동 보정용.
 *  fbm2d 호출 1번. NOISE_SCALE 적용 후 [0,1] → [-1,+1] 매핑. */
export function elevationAt(x: number, y: number, seed: number = getTerrainSeed()): number {
  return fbm2d(x * NOISE_SCALE, y * NOISE_SCALE, seed) * 2 - 1;
}

/** ⭐ 경사도 기반 이동 속도 multiplier.
 *  (fromX,fromY) → (toX,toY) 방향 이동 시 고도차 측정.
 *  - 오르막 (toE > fromE) → 느려짐
 *  - 내리막 (toE < fromE) → 빨라짐
 *  - 클램프 [0.7, 1.25] — 극단 방지 (덫에 빠지지 않게).
 *
 *  factor 0.8 = 고도차 0.5 이상 시 mul 0.6 까지 → 0.7 클램프.
 */
export function slopeSpeedMul(
  fromX: number, fromY: number, toX: number, toY: number,
  seed: number = getTerrainSeed(),
): number {
  const fromE = elevationAt(fromX, fromY, seed);
  const toE   = elevationAt(toX, toY, seed);
  const slope = Math.max(-0.5, Math.min(0.5, toE - fromE));
  return Math.max(0.7, Math.min(1.25, 1 - slope * 0.8));
}

/** 결정론적 biome 분류. (x, y) 월드 좌표 + seed. */
export function biomeAt(x: number, y: number, seed: number = 1): BiomeKind {
  const e = fbm2d(x * NOISE_SCALE, y * NOISE_SCALE, seed) * 2 - 1;           // -1..1
  const c = fbm2d(x * NOISE_SCALE, y * NOISE_SCALE, seed + CORRUPTION_SEED_OFFSET) * 2 - 1;
  // cursed 가 가장 강한 분류 — corruption 우선
  if (c > 0.35) return 'cursed';
  // sanctuary — elevation 낮고 corruption 음수 (정화된 평지)
  if (e < -0.25 && c < -0.10) return 'sanctuary';
  // mountain — elevation 높음
  if (e > 0.30) return 'mountain';
  // 나머지는 plains
  return 'plains';
}

/** biome 별 raw 노이즈 값 — 시각 렌더용 (틴트 강도 결정). */
export function sampleNoiseRaw(x: number, y: number, seed: number = 1): { elevation: number; corruption: number; biome: BiomeKind } {
  const e = fbm2d(x * NOISE_SCALE, y * NOISE_SCALE, seed) * 2 - 1;
  const c = fbm2d(x * NOISE_SCALE, y * NOISE_SCALE, seed + CORRUPTION_SEED_OFFSET) * 2 - 1;
  let biome: BiomeKind;
  if (c > 0.35) biome = 'cursed';
  else if (e < -0.25 && c < -0.10) biome = 'sanctuary';
  else if (e > 0.30) biome = 'mountain';
  else biome = 'plains';
  return { elevation: e, corruption: c, biome };
}

// ─────────────────────────── Biome → Prop 가중치 ───────────────────────────
// PropKind 는 world.ts 가 owner. 여기선 string 으로 두고 타입은 호출자가 보장.
// 가중치 — 높을수록 그 biome 에서 자주 등장. 0 = 등장 X.

export type PropKindLike =
  | 'blackhole' | 'shrine' | 'wreck' | 'asteroid' | 'lantern' | 'stardust'
  | 'monolith' | 'rocks' | 'ruins'
  | 'pressure_plate' | 'beacon' | 'mirror_shard' | 'cursed_totem';

export const BIOME_PROP_WEIGHTS: Record<BiomeKind, Partial<Record<PropKindLike, number>>> = {
  // 산악 지대 — 솔리드 벽 + 운석. 엄폐+자원 풍부. cursed 적 침입 시 kiting 좋음.
  mountain: {
    monolith:       3.0,
    rocks:          4.0,
    ruins:          2.5,
    asteroid:       1.5,
    wreck:          0.6,
    stardust:       0.4,
    mirror_shard:   0.5,
  },
  // 평원 — 보상형 props 가 많은 안전 지대. 잔해/별먼지/등불.
  plains: {
    wreck:          3.5,
    stardust:       3.0,
    lantern:        2.5,
    asteroid:       1.0,
    rocks:          0.5,
    mirror_shard:   1.0,
    beacon:         0.3,
  },
  // 저주 지대 — 고위험/고보상. 토템/봉화/압전판/블랙홀.
  cursed: {
    cursed_totem:   3.0,
    blackhole:      2.5,
    beacon:         2.5,
    pressure_plate: 3.5,
    asteroid:       1.0,
    monolith:       0.5,
  },
  // 성역 — shrine + lantern + mirror_shard 클러스터. 정화된 신성 공간.
  sanctuary: {
    shrine:         4.0,
    mirror_shard:   2.5,
    lantern:        2.0,
    stardust:       1.5,
    ruins:          1.0,
  },
};

/** prop placement 시 후보 위치(x,y) 에서 prop 종류의 적합도 점수. 0..N — 높을수록 좋음. */
export function biomeWeight(propKind: PropKindLike, x: number, y: number, seed: number = 1): number {
  const b = biomeAt(x, y, seed);
  return BIOME_PROP_WEIGHTS[b][propKind] ?? 0.2;  // 0.2 = 비선호 biome 의 기본값 (완전 배제 안 함)
}

// ─────────────────────────── 시각 렌더 — 틴트 컬러 ───────────────────────────

/** biome 별 그리드 배경 틴트 (RGB 0..255 + 알파 강도).
 *  ⭐ 알파 0.10~0.25 — 우주 배경 위에서 biome 영역이 뚜렷이 식별되도록 강화. */
export const BIOME_TINT: Record<BiomeKind, { r: number; g: number; b: number; a: number }> = {
  mountain:  { r: 110, g: 130, b: 165, a: 0.18 },   // 차가운 파란 회색 (산악)
  plains:    { r: 80,  g: 110, b: 120, a: 0.10 },   // 어두운 시안 (평원)
  cursed:    { r: 200, g: 40,  b: 175, a: 0.24 },   // 짙은 마젠타 (위험)
  sanctuary: { r: 240, g: 200, b:  90, a: 0.22 },   // 황금 (성역)
};

// ─────────────────────────── World seed 헬퍼 ───────────────────────────
// 게임 entire 세션 동안 같은 시드 — 한 런 안에선 같은 biome 맵.
// daily seed 와 분리 — 일일 시드는 카드 RNG, 지형은 별도.
// 단순화 — 모듈-전역 시드 1 (또는 호출자가 매번 인자로). 다음 patch 에서 daily-seed 연결.

let _terrainSeed: number = 12345;
export function setTerrainSeed(seed: number): void { _terrainSeed = (seed | 0) || 12345; }
export function getTerrainSeed(): number { return _terrainSeed; }
