// SAMSARA · 윤회 — 월드 시뮬레이션 (서바이벌 모드)
//
// 무한 필드. 플레이어(호랑이) 중앙에 + 카메라가 따라간다.
// 적은 화면 가장자리에서 스폰 → 플레이어로 이동.
// 무기는 자동 발사 (cards.ts 의 카드를 weapons.ts 가 무기로 변환).

import type { Card, GameState } from './types.js';
import type { Weapon } from './weapons.js';
import { rng } from './cards.js';
import type { BossKind } from './boss.js';
import { attachBossRuntime, isBossInvuln, stepBossPattern, type BossRuntime, type FsmEvent } from './bossPatterns.js';
import {
  biomeAt, biomeWeight, elevationAt, getTerrainSeed,
  PEAK_THRESHOLD, RIDGE_THRESHOLD, slopeSpeedMul,
  type BiomeKind, type PropKindLike,
} from './terrain.js';

export type EnemyKind = 'jab' | 'dokkaebi' | 'wonwi' | 'jangsan' | 'boss' | 'shooter' | 'exploder' | 'charger' | 'summoner';

export interface Vec { x: number; y: number; }

export interface Player {
  pos: Vec;
  vel: Vec;
  speed: number;        // px/s
  radius: number;
  facing: number;       // radians
  facingX: number;
  invulnUntil: number;
  hitFlashUntil: number;
  lastAttackTime: number;
  walkPhase: number;
  staggerUntil: number;     // 비틀거림 애니
  staggerDir: Vec;          // 넉백 방향
  hp: number;
  hpMax: number;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  pos: Vec;
  vel: Vec;
  hp: number;
  hpMax: number;
  speed: number;
  radius: number;
  damage: number;
  coinDrop: number;
  xpDrop: number;
  color: string;
  spawnTime: number;
  slow: number;
  slowUntil: number;
  burning: number;
  burnUntil: number;
  hitFlashUntil: number;
  spawning: number; // 0~1 (스폰 텔레그래프 진행도)
  attackCd: number;
  chargeUntil: number;
  chargeDir: Vec;
  exploded: boolean;
  summonCd: number;
  // ⭐ Elite 마커 — 매 3 웨이브마다 1체. 빨간 외곽 + RP 폭탄 드롭.
  elite?: boolean;
}

export interface DamageNumber {
  id: number;
  pos: Vec;
  vel: Vec;
  text: string;
  color: string;
  size: number;
  life: number;
  lifeMax: number;
}

export interface DeadAnim {
  id: number;
  pos: Vec;
  color: string;
  radius: number;
  life: number;
  lifeMax: number;
  rot: number;
}

export interface Projectile {
  id: number;
  pos: Vec;
  vel: Vec;
  radius: number;
  damage: number;
  life: number;       // remaining seconds
  color: string;
  kind: 'bullet' | 'orb' | 'mirror' | 'coin';
  pierce: number;     // 관통 횟수
  homing: boolean;
  bounces: number;
  hitIds: Set<number>;
  burnFor?: number;   // 적중 시 burn 부여 초 수
  slowFor?: number;
  trail?: Vec[];      // 잔상 궤적 (coin/orb 만 활성, 최근 5점)
}

export interface Pickup {
  id: number;
  kind: 'coin' | 'xp' | 'gem' | 'heart' | 'magnet' | 'bomb' | 'chest';
  pos: Vec;
  value: number;
  radius: number;
  vel: Vec;
}

export interface AreaEffect {
  id: number;
  pos: Vec;        // 따라가는지 여부는 followPlayer
  radius: number;
  damage: number;  // per second
  life: number;
  color: string;
  followPlayer: boolean;
  orbitAngle?: number;  // 플레이어 기준 회전 각도
  orbitRadius?: number; // 플레이어 기준 회전 반경
  orbitSpeed?: number;  // 각속도 (rad/s)
  kind: 'aura' | 'nova' | 'rift';
  slowFactor: number; // 1 = no slow
  burnDps?: number;
  hitInterval: number; // 같은 적 재타격 쿨다운
  lastHit: Map<number, number>;
}

// ─────────────────────────── 월드 오브젝트 (인터랙티브 데코) ───────────────────────────
// 게임이론 풀파워 리디자인 (2026-05-11):
//
// ── 단순 보상/위험 (6 종) ──
//  - blackhole: 인력장 (player + enemy 빨려들어감). 적 흡수 시 +2 코인 + 콤보 추가. Risk-Reward.
//  - shrine:    파괴=황금 폭발 + 코인 폭우. **OR** 60px 내 3초 정지 = 영구 +1 maxHP (Pray Mode).
//               두 모드는 상호 배타. **Stag Hunt** — 큰 보상엔 commitment.
//  - wreck:     점진 채굴 — 1히트 = heart, 2~3히트 = 코인, 0HP = 폭발+빅 코인. **Coordination**.
//  - asteroid:  Kinetic Pinball — 발사체 맞으면 그 방향으로 가속. 적 충돌 = 질량×속도 데미지. **Emergent**.
//  - lantern:   80px Stronghold — 플레이어 attack speed +30% + 적 slow. 단, 적이 30px 이내 2s = 5s 어두워짐. **Tragedy of Commons**.
//  - stardust:  Adaptive — Full HP = 1.5s 가속+무적, 1 HP 손상 = heal 1, 다중 손상 = heal 2 + 1s shield. **Information Asymmetry**.
//
// ── 솔리드 지형 (3 종) — 이제 모두 destructible ──
//  - monolith:  HP 200. 50/100/150 HP 마다 코인 + 보석 균열. 0HP = RP폭탄(gem×2 + chest). **Stag Hunt** — 5~10s 위험.
//  - rocks:     HP 60. 0HP = 80px 흙폭발(20 데미지) + 3 코인. **Ricochet** — 적 발사체 반사. 엄폐+자원 양면성.
//  - ruins:     HP 100. 0HP = 5s 동안 atk +40% + 이동 +20% 버프. **Loss for Power** — 엄폐 잃고 화력 얻기.
//
// ── 신규 게임이론 props (4 종) ──
//  - pressure_plate: 압전판. 플레이어/적 접촉 → 0.8s 텔레그래프 → 220px 노바 (적 데미지 50, 플레이어 -1 HP).
//                    **Chicken Game** — 적을 유인하고 본인은 빠지기.
//  - beacon:        봉화. 250px 내 = +50% 코인 + 30% 스폰 증가. HP 60. **Greed vs Safety**.
//  - mirror_shard:  거울 파편. 솔리드 + 발사체 반사 (적 포함). 적 shooter 의 빨간 발사체가 적에게 되돌아감.
//                   **Spatial Mind Game** — 위치 게임.
//  - cursed_totem:  저주 토템. HP 80. 0HP = RP폭탄(gem×3 + chest×2 + 큰 코인) **AND** elite 3마리 즉시 스폰.
//                   **Stag Hunt 극단** — 완전 commit 아니면 건드리지 말 것.
export type PropKind = 'blackhole' | 'shrine' | 'wreck' | 'asteroid' | 'lantern' | 'stardust'
                     | 'monolith' | 'rocks' | 'ruins'
                     | 'pressure_plate' | 'beacon' | 'mirror_shard' | 'cursed_totem';

// 솔리드(통과 불가) prop set — 충돌 처리에서 자주 비교
const SOLID_KINDS = new Set<PropKind>(['monolith', 'rocks', 'ruins', 'mirror_shard']);
// 파괴 가능 prop set — 발사체/영역효과가 데미지 줄 수 있음
export const DESTRUCTIBLE_KINDS = new Set<PropKind>(['shrine', 'wreck', 'asteroid', 'monolith', 'rocks', 'ruins', 'beacon', 'cursed_totem']);

export interface WorldProp {
  id: number;
  kind: PropKind;
  pos: Vec;
  radius: number;        // 충돌/효과 반경
  hp: number;            // 0 = 파괴됨 (lantern/blackhole/stardust 는 정의되어도 무시)
  hpMax: number;
  rot: number;
  size: number;
  seed: number;
  hitFlashUntil: number; // 피격 흰 플래시
  consumed: boolean;     // stardust 1회 소비 플래그
  cooldown: number;      // lantern 슬로우 적용 주기 (0 시 적용)
  destroyedAt?: number;  // 파괴 애니용 timestamp
  // ⭐ 게임이론 메커니즘용 상태 (대부분 optional, 사용 prop 만 set)
  prayProgress?: number;     // shrine: pray 누적 시간(s, 0~3)
  prayerCompleted?: boolean; // shrine: prayer 보상 이미 지급
  wreckHits?: number;        // wreck: 점진 채굴 카운터 (1=heart, 2=coin, 3=destroy)
  darkUntil?: number;        // lantern: 적 점거로 비활성된 만료 시각(ms)
  enemyCloseSince?: number;  // lantern: 적이 30px 진입 시점(ms)
  plateFuse?: number;        // pressure_plate: 폭발까지 남은 초 (>0 = active fuse)
  plateRearm?: number;       // pressure_plate: 재무장 쿨다운(초)
  vel?: Vec;                 // asteroid: kinetic 운동 속도(px/s)
  mass?: number;             // asteroid: 질량 (size 비례)
  monolithCracks?: number;   // monolith: 보상 균열 카운터 (0~3, HP 임계마다 +1)
  // ⭐ 다음 균열 발동 시점 (HP 비례). monolithCracks 와 함께 사용.
  // crackStops 는 createMonolith 시 [0.75, 0.5, 0.25] * hpMax 로 세팅.
  crackStops?: number[];
}

export interface World {
  player: Player;
  enemies: Enemy[];
  projectiles: Projectile[];
  pickups: Pickup[];
  areaEffects: AreaEffect[];
  weapons: Weapon[];
  damageNumbers: DamageNumber[];
  deadAnims: DeadAnim[];
  enemyKills: number;
  spawnTimer: number;
  spawnInterval: number;
  miniBossTimer: number;
  bossInstance: Enemy | null;
  bossRuntime: BossRuntime | null;     // 보스 패턴 FSM (bossInstance 와 라이프타임 동기화)
  camera: Vec;
  fieldTime: number;
  killStreak: number;
  lastKillTime: number;
  // 대시
  dashCooldown: number;
  dashUntil: number;
  // 슬로우모션 (피격 시 brief)
  slowMoUntil: number;
  // 카메라 줌 (보스 시 1.2)
  cameraZoom: number;
  cameraZoomTarget: number;
  // XP/레벨
  xp: number;
  xpForNext: number;
  level: number;
  pendingLevelUps: number; // 레벨업 누적 (UI 가 처리)
  // 인터랙티브 맵 오브젝트
  props: WorldProp[];
  // 부스트 (stardust 흡수 시 일시 가속)
  boostUntil: number;
  // 이번 틱 최대 단일 데미지 (main.ts 가 hit-stop tier 판정에 사용)
  maxDmgThisTick: number;
  // ⭐ Elite 스폰 타이머 — 매 30초 1체 (W3+ 활성)
  eliteTimer: number;
  // ⭐ 게임이론 버프 (props 가 트리거하는 일시 효과)
  buffAtkUntil: number;       // ruins 파괴 → 5s 데미지 +40%
  buffSpdUntil: number;       // ruins 파괴 → 5s 이동속도 +20%
  buffHasteUntil: number;     // lantern stronghold → 무기 cooldown -30%
  shieldUntil: number;        // stardust adaptive → 1s 무적
  beaconBoostMul: number;     // beacon 영역 내 = 1.5, 외 = 1.0 (코인 배율)
  beaconSpawnMul: number;     // beacon 영역 내 = 1.3 (스폰 가속)
  beaconActive: boolean;      // beacon 안에 플레이어가 있는지
}

let _enemyId = 1;
let _projId = 1;
let _pickupId = 1;
let _areaId = 1;

export function createWorld(): World {
  return {
    player: {
      pos: { x: 0, y: 0 },
      vel: { x: 0, y: 0 },
      speed: 220,
      // ⭐ 캐릭터 가시성 — 18 → 24 (33% 확대)
      radius: 24,
      facing: 0,
      facingX: 1,
      invulnUntil: 0,
      hitFlashUntil: 0,
      lastAttackTime: 0,
      walkPhase: 0,
      staggerUntil: 0,
      staggerDir: { x: 0, y: 0 },
      hp: 3, hpMax: 3,
    },
    enemies: [],
    projectiles: [],
    pickups: [],
    areaEffects: [],
    weapons: [],
    damageNumbers: [],
    deadAnims: [],
    enemyKills: 0,
    spawnTimer: 0,
    spawnInterval: 1.0,
    miniBossTimer: 60,
    bossInstance: null,
    bossRuntime: null,
    camera: { x: 0, y: 0 },
    fieldTime: 0,
    killStreak: 0,
    lastKillTime: 0,
    dashCooldown: 0,
    dashUntil: 0,
    slowMoUntil: 0,
    cameraZoom: 1,
    cameraZoomTarget: 1,
    xp: 0,
    xpForNext: 16, // 10→16: 첫 카드를 ~30초(첫 보상 리듬, CLAUDE §6.4)에 맞춤. 기존 10은 광속(~10초)이라 성취감 희박(사용자 #6).
    level: 1,
    pendingLevelUps: 0,
    props: generateProps(),
    boostUntil: 0,
    maxDmgThisTick: 0,
    eliteTimer: 30,
    buffAtkUntil: 0,
    buffSpdUntil: 0,
    buffHasteUntil: 0,
    shieldUntil: 0,
    beaconBoostMul: 1,
    beaconSpawnMul: 1,
    beaconActive: false,
  };
}

// ─────────────────────────── Props 생성 ───────────────────────────
let _propId = 1;

// ⭐ 단일 prop 생성 헬퍼 — formation 함수와 산개 배치 양쪽에서 공용.
function makeProp(kind: PropKind, x: number, y: number, baseR: number, hp: number, sz: number): WorldProp {
  const p: WorldProp = {
    id: _propId++,
    kind,
    pos: { x, y },
    radius: baseR * sz,
    hp, hpMax: hp,
    rot: (Math.random() - 0.5) * Math.PI,
    size: sz,
    seed: Math.random() * 1000,
    hitFlashUntil: 0,
    consumed: false,
    cooldown: 0,
  };
  // ⭐ 종류별 game-theory 초기 상태
  if (kind === 'monolith') {
    p.monolithCracks = 0;
    // HP 200 기준: 150/100/50 마다 보상 균열 (3단계). hpMax 비례로 일반화.
    p.crackStops = [hp * 0.75, hp * 0.50, hp * 0.25];
  } else if (kind === 'shrine') {
    p.prayProgress = 0;
    p.prayerCompleted = false;
  } else if (kind === 'wreck') {
    p.wreckHits = 0;
  } else if (kind === 'asteroid') {
    p.vel = { x: 0, y: 0 };
    p.mass = 1 + sz * 0.5; // 크기에 비례
  } else if (kind === 'pressure_plate') {
    p.plateFuse = -1;     // -1 = idle
    p.plateRearm = 0;
  }
  return p;
}

// ⭐ 지형지물 군집(formation) — "그냥 벽 하나 딸랑" 이 아니라 성벽/돌무더기/유적처럼 보이게.
// 각 formation 은 중심점 (cx, cy) 기준으로 여러 prop 을 한 번에 배치.
type FormationKind = 'castle_wall' | 'rock_cluster' | 'temple_ruins' | 'broken_archway';

function buildFormation(kind: FormationKind, cx: number, cy: number, out: WorldProp[]): { x: number; y: number; r: number } {
  // 회전 각도 — 각 formation 마다 자연스러운 무작위 방향
  const ang = Math.random() * Math.PI * 2;
  const cos = Math.cos(ang), sin = Math.sin(ang);
  const rot = (lx: number, ly: number) => ({ x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos });

  switch (kind) {
    case 'castle_wall': {
      // 일자/L자 성벽 — monolith 4~6개 일렬. 한 칸은 출입구처럼 비움.
      // HP 200 (destructible) — Stag Hunt: 10초 commitment 로 RP 폭탄 + 진로 개척.
      const n = 4 + Math.floor(Math.random() * 3);
      const gap = 70 + Math.random() * 8;
      const skip = 1 + Math.floor(Math.random() * (n - 1));
      for (let i = 0; i < n; i++) {
        if (i === skip) continue; // 출입구
        const lx = (i - n / 2 + 0.5) * gap;
        const sz = 1.7 + Math.random() * 0.4;
        const p = rot(lx, 0);
        out.push(makeProp('monolith', p.x, p.y, 32, 200, sz));
      }
      // L자 분기 (50% 확률)
      if (Math.random() < 0.5) {
        const m = 2 + Math.floor(Math.random() * 2);
        for (let i = 1; i <= m; i++) {
          const lx = (n / 2 - 0.5) * gap;
          const ly = i * gap;
          const sz = 1.7 + Math.random() * 0.4;
          const p = rot(lx, ly);
          out.push(makeProp('monolith', p.x, p.y, 32, 200, sz));
        }
      }
      return { x: cx, y: cy, r: n * gap * 0.7 };
    }
    case 'rock_cluster': {
      // 무작위 5~8 바위가 모인 돌무더기. HP 60 (destructible) — 적 발사체 반사(Ricochet).
      const n = 5 + Math.floor(Math.random() * 4);
      const baseR = 70 + Math.random() * 30;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.8;
        const r = baseR * (0.4 + Math.random() * 0.7);
        const lx = Math.cos(a) * r;
        const ly = Math.sin(a) * r;
        const sz = 1.4 + Math.random() * 0.6;
        const p = rot(lx, ly);
        out.push(makeProp('rocks', p.x, p.y, 28, 60, sz));
      }
      // 가운데 큰 바위 1개 (조금 더 단단)
      out.push(makeProp('rocks', cx, cy, 36, 100, 2.0 + Math.random() * 0.4));
      return { x: cx, y: cy, r: baseR + 60 };
    }
    case 'temple_ruins': {
      // 원형 사원 유적 — ruins 6개가 원으로 둘러싸고 가운데에 사당(shrine) 1개.
      // ruins HP 100 (destructible) — 파괴 시 일시 atk +40% / spd +20% 버프 5s.
      const n = 6;
      const r = 110;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const lx = Math.cos(a) * r;
        const ly = Math.sin(a) * r;
        const sz = 1.7 + Math.random() * 0.3;
        const p = rot(lx, ly);
        out.push(makeProp('ruins', p.x, p.y, 26, 100, sz));
      }
      // 중앙에 황금 사당 (보상 동기)
      out.push(makeProp('shrine', cx, cy, 38, 50, 2.2));
      return { x: cx, y: cy, r: r + 60 };
    }
    case 'broken_archway': {
      // 무너진 아치 — ruins 2개가 서로 마주보고, 사이에 작은 ruins 잔해 1~2개.
      const halfGap = 80;
      const a = rot(-halfGap, 0);
      const b = rot(+halfGap, 0);
      out.push(makeProp('ruins', a.x, a.y, 32, 100, 2.3));
      out.push(makeProp('ruins', b.x, b.y, 32, 100, 2.3));
      // 잔해 — 깨진 바위 (HP 60)
      const debris = 1 + Math.floor(Math.random() * 2);
      for (let i = 0; i < debris; i++) {
        const lx = (Math.random() - 0.5) * halfGap * 1.6;
        const ly = (Math.random() - 0.5) * 30;
        const p = rot(lx, ly);
        out.push(makeProp('rocks', p.x, p.y, 22, 60, 1.3 + Math.random() * 0.3));
      }
      return { x: cx, y: cy, r: halfGap + 60 };
    }
  }
}

// ⭐ Formation → 선호 biome 매핑.
// 무작위로 곳곳에 흩뿌리지 않고 — 적절한 biome 영역으로 끌어당김.
const FORMATION_PREFERRED_BIOME: Record<FormationKind, BiomeKind[]> = {
  castle_wall:    ['mountain'],                 // 성벽 — 산악
  rock_cluster:   ['mountain', 'plains'],       // 돌무더기 — 산악/평원 경계
  temple_ruins:   ['sanctuary'],                // 사원 유적 — 성역
  broken_archway: ['sanctuary', 'mountain'],    // 무너진 아치 — 성역/산악
};

function generateProps(): WorldProp[] {
  const out: WorldProp[] = [];
  const placed: { x: number; y: number; minD: number }[] = [];
  const seed = getTerrainSeed();

  // 0) 안전구역 — 플레이어 근처(반경 350px) 는 빈 공간 보장
  const SAFE_RADIUS = 350;

  // 1) ⭐ Formation 배치 — biome 선호도에 따라 후보 위치 가중 샘플링.
  // 무작위 18회 시도 중 biome 적합도 최고점 채택 (vs 단순 첫 통과 채택 → spatial coherence).
  const formations: { kind: FormationKind; count: number; minDist: number }[] = [
    { kind: 'castle_wall',     count: 4, minDist: 700 },
    { kind: 'rock_cluster',    count: 6, minDist: 480 },
    { kind: 'temple_ruins',    count: 3, minDist: 700 },
    { kind: 'broken_archway',  count: 4, minDist: 500 },
  ];
  for (const f of formations) {
    const preferred = FORMATION_PREFERRED_BIOME[f.kind];
    for (let i = 0; i < f.count; i++) {
      let bestCx = 0, bestCy = 0, bestScore = -1;
      // ⭐ 24회 biome-가중 탐색. 비선호 biome 도 score 0.5 로 받아들임 (이전 0.2 — 너무 강한 페널티).
      for (let attempt = 0; attempt < 24; attempt++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 500 + Math.random() * 2200;
        const cx = Math.cos(ang) * dist;
        const cy = Math.sin(ang) * dist;
        if (Math.hypot(cx, cy) < SAFE_RADIUS) continue;
        // 충돌 회피
        let collides = false;
        for (const p of placed) {
          if (Math.hypot(p.x - cx, p.y - cy) < Math.max(p.minD, f.minDist)) { collides = true; break; }
        }
        if (collides) continue;
        const b = biomeAt(cx, cy, seed);
        const score = preferred.includes(b) ? 1.0 : 0.5;
        if (score > bestScore) { bestScore = score; bestCx = cx; bestCy = cy; }
        if (score >= 1.0 && attempt >= 6) break;
      }
      // ⭐ Fallback — biome-가중 24회로 못 찾으면 biome 무시하고 첫 non-collision 채택 (formation 등록 보장).
      // 이전 버그: 비선호 biome 페널티 0.2 + 충돌로 일부 formation 이 0개 등록 → "패턴이 안 보임".
      if (bestScore < 0) {
        for (let attempt = 0; attempt < 30; attempt++) {
          const ang = Math.random() * Math.PI * 2;
          const dist = 500 + Math.random() * 2200;
          const cx = Math.cos(ang) * dist, cy = Math.sin(ang) * dist;
          if (Math.hypot(cx, cy) < SAFE_RADIUS) continue;
          let collides = false;
          for (const p of placed) {
            if (Math.hypot(p.x - cx, p.y - cy) < Math.max(p.minD, f.minDist)) { collides = true; break; }
          }
          if (collides) continue;
          bestCx = cx; bestCy = cy; bestScore = 0.1;
          break;
        }
      }
      if (bestScore < 0) continue;  // 정말로 자리 없음 (맵 꽉참)
      const bbox = buildFormation(f.kind, bestCx, bestCy, out);
      placed.push({ x: bbox.x, y: bbox.y, minD: bbox.r + 100 });
    }
  }

  // ⭐ 1.5) Ridge Chain — 펄린 노이즈 elevation 임계 셀에 솔리드 prop 을 연속 spawn.
  // 80px 그리드로 맵 전체를 스캔, elevation > RIDGE_THRESHOLD 셀에 rocks/monolith 를 밀집 배치.
  // 결과: 단순 산개가 아닌 **연속적인 산맥/절벽** 형태. 펄린 노이즈의 자연 ridge 형태를 따라간다.
  //
  // 밀도 곡선:
  //  - elevation = 0.40 (경계): spawnChance ~ 35% (산기슭 — 듬성)
  //  - elevation = 0.55 (peak): spawnChance ~ 90% (정상부 — 빽빽, monolith)
  //  - elevation = 1.00 (최정상): spawnChance ~ 100%
  // ⭐ Ridge Chain 강화 (사용자 피드백 — 연속적인 띠 형태 산맥).
  //  - 60px 그리드 → 80px 대비 +44% 밀도. 인접 prop 들이 자연스럽게 겹쳐 "산맥" 띠 형성.
  //  - 임계 0.35 (이전 0.40) → 산기슭 영역도 포함, 띠 폭 확장.
  //  - 산기슭 (0.35~0.45) = 듬성, 본체 (0.45~0.55) = 빽빽, peak (>0.55) = monolith.
  //  - 인접 cell 둘 다 ridge 면 두 prop 겹쳐 spawn (한 cell 에 최대 2개) — 띠 연속성 강화.
  {
    const RIDGE_RANGE = 2400;
    const RIDGE_GRID = 60;
    const RIDGE_MIN = 0.35;
    for (let gx = -RIDGE_RANGE; gx <= RIDGE_RANGE; gx += RIDGE_GRID) {
      for (let gy = -RIDGE_RANGE; gy <= RIDGE_RANGE; gy += RIDGE_GRID) {
        const r2 = gx * gx + gy * gy;
        if (r2 < SAFE_RADIUS * SAFE_RADIUS) continue;
        if (r2 > RIDGE_RANGE * RIDGE_RANGE) continue;
        const e = elevationAt(gx, gy, seed);
        if (e < RIDGE_MIN) continue;
        // 산기슭(낮은 ridge) 듬성, 본체/정상부 빽빽 — 자연 띠 그라데이션.
        const ratio = (e - RIDGE_MIN) / (1 - RIDGE_MIN);  // 0..1
        const spawnChance = 0.45 + ratio * 0.55;          // 0.45..1.0
        if (Math.random() > spawnChance) continue;
        // jitter — 그리드 패턴 깨기, 자연스러운 노이즈
        const x = gx + (Math.random() - 0.5) * RIDGE_GRID * 0.8;
        const y = gy + (Math.random() - 0.5) * RIDGE_GRID * 0.8;
        // 형성/recipe prop 과는 38px 회피. ridge 내부 prop 끼리는 24px (겹침 허용 = 연속 띠).
        let tooCloseFar = false;
        for (const p of placed) {
          const minSep = p.minD <= 42 ? 22 : 38;  // ridge 내부(minD=40) 일 땐 22px 만 (겹침)
          if (Math.hypot(p.x - x, p.y - y) < minSep) { tooCloseFar = true; break; }
        }
        if (tooCloseFar) continue;
        const isPeak = e > PEAK_THRESHOLD;
        const sz = isPeak ? 1.7 + Math.random() * 0.4 : 1.3 + Math.random() * 0.5;
        const kind: PropKind = isPeak ? 'monolith' : 'rocks';
        const baseR = isPeak ? 32 : 28;
        const hp = isPeak ? 200 : 60;
        out.push(makeProp(kind, x, y, baseR, hp, sz));
        placed.push({ x, y, minD: 40 });
      }
    }
  }

  // 2) 인터랙티브 prop (보상/위험) — biome-biased 산개 배치.
  // 각 prop 종류에 BIOME_PROP_WEIGHTS 기반 후보 가중 샘플링.
  const recipes: { k: PropKind; count: number; hp: number; r: number; sizeMin: number; sizeMax: number; minDist: number }[] = [
    { k: 'shrine',   count: 6,  hp: 50, r: 44, sizeMin: 2.1, sizeMax: 2.7, minDist: 480 },
    { k: 'wreck',    count: 10, hp: 30, r: 38, sizeMin: 1.8, sizeMax: 2.4, minDist: 380 },
    { k: 'stardust', count: 12, hp: 1,  r: 24, sizeMin: 1.5, sizeMax: 2.1, minDist: 320 },
    { k: 'asteroid', count: 12, hp: 20, r: 36, sizeMin: 1.8, sizeMax: 2.5, minDist: 360 },
    { k: 'blackhole', count: 3, hp: 999, r: 36, sizeMin: 2.4, sizeMax: 3.1, minDist: 700 },
    { k: 'lantern',  count: 6,  hp: 999, r: 22, sizeMin: 1.8, sizeMax: 2.2, minDist: 360 },
    { k: 'rocks',    count: 6,  hp: 60,  r: 32, sizeMin: 1.4, sizeMax: 2.0, minDist: 380 },
    { k: 'ruins',    count: 3,  hp: 100, r: 30, sizeMin: 1.6, sizeMax: 2.2, minDist: 460 },
    { k: 'pressure_plate', count: 5, hp: 999, r: 28, sizeMin: 1.6, sizeMax: 2.0, minDist: 500 },
    { k: 'beacon',         count: 4, hp: 60,  r: 30, sizeMin: 1.8, sizeMax: 2.2, minDist: 700 },
    { k: 'mirror_shard',   count: 6, hp: 999, r: 24, sizeMin: 1.6, sizeMax: 2.0, minDist: 420 },
    { k: 'cursed_totem',   count: 2, hp: 80,  r: 32, sizeMin: 2.0, sizeMax: 2.4, minDist: 900 },
  ];
  for (const r of recipes) {
    for (let i = 0; i < r.count; i++) {
      let bestX = 0, bestY = 0, bestScore = -1;
      // 14회 샘플 + biome 가중 + 충돌 회피. 가장 높은 점수 채택.
      for (let attempt = 0; attempt < 14; attempt++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 280 + Math.random() * 2400;
        const x = Math.cos(ang) * dist, y = Math.sin(ang) * dist;
        if (Math.hypot(x, y) < SAFE_RADIUS) continue;
        let collides = false;
        for (const p of placed) {
          if (Math.hypot(p.x - x, p.y - y) < Math.max(p.minD, r.minDist)) { collides = true; break; }
        }
        if (collides) continue;
        const score = biomeWeight(r.k as PropKindLike, x, y, seed);
        if (score > bestScore) { bestScore = score; bestX = x; bestY = y; }
        if (score >= 3.0 && attempt >= 4) break;
      }
      // ⭐ Fallback 1단계 — biome 무시하고 non-collision 위치 채택 (50회).
      if (bestScore < 0) {
        for (let attempt = 0; attempt < 50; attempt++) {
          const ang = Math.random() * Math.PI * 2;
          const dist = 280 + Math.random() * 2400;
          const x = Math.cos(ang) * dist, y = Math.sin(ang) * dist;
          if (Math.hypot(x, y) < SAFE_RADIUS) continue;
          let collides = false;
          for (const p of placed) {
            if (Math.hypot(p.x - x, p.y - y) < Math.max(p.minD, r.minDist)) { collides = true; break; }
          }
          if (collides) continue;
          bestX = x; bestY = y; bestScore = 0.1;
          break;
        }
      }
      // ⭐ Fallback 2단계 — minDist 절반으로 완화 (큰 prop 등록 보장: cursed_totem 등).
      if (bestScore < 0) {
        const relaxedDist = Math.max(180, r.minDist * 0.4);
        for (let attempt = 0; attempt < 50; attempt++) {
          const ang = Math.random() * Math.PI * 2;
          const dist = 280 + Math.random() * 2400;
          const x = Math.cos(ang) * dist, y = Math.sin(ang) * dist;
          if (Math.hypot(x, y) < SAFE_RADIUS) continue;
          let collides = false;
          for (const p of placed) {
            if (Math.hypot(p.x - x, p.y - y) < Math.max(p.minD * 0.4, relaxedDist)) { collides = true; break; }
          }
          if (collides) continue;
          bestX = x; bestY = y; bestScore = 0.05;
          break;
        }
      }
      // ⭐ Fallback 3단계 — collision 무시, 안전구역만 보장. 시각 겹침이 prop 누락보다 나음.
      if (bestScore < 0) {
        for (let attempt = 0; attempt < 20; attempt++) {
          const ang = Math.random() * Math.PI * 2;
          const dist = 280 + Math.random() * 2400;
          const x = Math.cos(ang) * dist, y = Math.sin(ang) * dist;
          if (Math.hypot(x, y) < SAFE_RADIUS) continue;
          bestX = x; bestY = y; bestScore = 0.01;
          break;
        }
      }
      if (bestScore < 0) continue;
      placed.push({ x: bestX, y: bestY, minD: r.minDist });
      const sz = r.sizeMin + Math.random() * (r.sizeMax - r.sizeMin);
      out.push(makeProp(r.k, bestX, bestY, r.r, r.hp, sz));
    }
  }
  return out;
}

// ─────────────────────────── 스폰 ───────────────────────────

// ⭐ 적 가시성 — 모든 radius +30% (사용자 피드백). 색은 5색 약속 정렬:
//  - shooter: 시안→연보라 (시안은 ice 무기 색, 혼동 방지)
//  - 나머지는 어두운 무채/진한 색조 유지하되 외곽선 강조
const ENEMY_DEF: Record<EnemyKind, Omit<Enemy, 'id' | 'pos' | 'vel' | 'spawnTime' | 'slow' | 'slowUntil' | 'burning' | 'burnUntil' | 'hitFlashUntil' | 'spawning' | 'attackCd' | 'chargeUntil' | 'chargeDir' | 'exploded' | 'summonCd'>> = {
  jab:       { kind: 'jab',       hp: 1,  hpMax: 1,  speed: 60,  radius: 13, damage: 5,  coinDrop: 1,  xpDrop: 1, color: '#7080a0' },
  wonwi:     { kind: 'wonwi',     hp: 2,  hpMax: 2,  speed: 110, radius: 16, damage: 8,  coinDrop: 3,  xpDrop: 2, color: '#90ff90' },
  dokkaebi:  { kind: 'dokkaebi',  hp: 3,  hpMax: 3,  speed: 70,  radius: 18, damage: 12, coinDrop: 5,  xpDrop: 3, color: '#b14aff' },
  shooter:   { kind: 'shooter',   hp: 4,  hpMax: 4,  speed: 40,  radius: 17, damage: 10, coinDrop: 6,  xpDrop: 3, color: '#a855f7' },
  charger:   { kind: 'charger',   hp: 6,  hpMax: 6,  speed: 80,  radius: 18, damage: 15, coinDrop: 8,  xpDrop: 4, color: '#ff6f00' },
  exploder:  { kind: 'exploder',  hp: 2,  hpMax: 2,  speed: 100, radius: 17, damage: 20, coinDrop: 10, xpDrop: 5, color: '#ffaa00' },
  summoner:  { kind: 'summoner',  hp: 12, hpMax: 12, speed: 35,  radius: 23, damage: 8,  coinDrop: 20, xpDrop: 8, color: '#d300c5' },
  jangsan:   { kind: 'jangsan',   hp: 30, hpMax: 30, speed: 90,  radius: 28, damage: 25, coinDrop: 50, xpDrop: 20, color: '#ff3366' },
  boss:      { kind: 'boss',      hp: 300, hpMax: 300, speed: 50, radius: 60, damage: 50, coinDrop: 500, xpDrop: 100, color: '#ff2a6d' },
};

const MAX_ENEMIES = 200;
const MAX_PROJECTILES = 400;
const MAX_PICKUPS = 300;

export function spawnEnemy(world: World, kind: EnemyKind, t: number, pos?: Vec, hpScale: number = 1): Enemy {
  // 한도 — 가장 멀리 있는 적 한 마리 제거 후 spawn
  if (world.enemies.length >= MAX_ENEMIES) {
    let farthestIdx = -1; let farthestD2 = 0;
    for (let i = 0; i < world.enemies.length; i++) {
      const e = world.enemies[i];
      if (e.kind === 'boss' || e.kind === 'jangsan') continue; // 보스류 제외
      const dx = e.pos.x - world.player.pos.x;
      const dy = e.pos.y - world.player.pos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > farthestD2) { farthestD2 = d2; farthestIdx = i; }
    }
    if (farthestIdx >= 0) world.enemies.splice(farthestIdx, 1);
  }
  const def = ENEMY_DEF[kind];
  // 화면 밖 무작위 위치 (카메라 기준 반경 밖)
  const angle = rng() * Math.PI * 2;
  const dist = 480 + rng() * 200;
  const p: Vec = pos ?? {
    x: world.player.pos.x + Math.cos(angle) * dist,
    y: world.player.pos.y + Math.sin(angle) * dist,
  };
  const e: Enemy = {
    ...def,
    hp: def.hpMax * hpScale,
    hpMax: def.hpMax * hpScale,
    coinDrop: Math.ceil(def.coinDrop * Math.min(2, hpScale)),
    id: _enemyId++,
    pos: { ...p },
    vel: { x: 0, y: 0 },
    spawnTime: t,
    slow: 1, slowUntil: 0,
    burning: 0, burnUntil: 0,
    hitFlashUntil: 0,
    spawning: 0,
    attackCd: 0, chargeUntil: 0, chargeDir: { x: 0, y: 0 },
    exploded: false, summonCd: 4,
  };
  world.enemies.push(e);
  return e;
}

/** ⭐ 시간대 변종 — wave 진행에 따라 적 색조 + 속도 미세 변형. 새 스프라이트 0장으로 wave 인식 강화.
 *  팔레트: 모든 적은 wave 5+ 부터 hue-shift (붉어짐) + 속도 +5%/5wave (cap 30%).
 */
export function applyWaveVariant(e: Enemy, wave: number): void {
  if (wave <= 3) return;
  // 속도 (자연스럽게 점점 빨라짐)
  const speedBoost = Math.min(0.30, Math.floor(wave / 5) * 0.05);
  e.speed = Math.round(e.speed * (1 + speedBoost));
  // 색조 — 적의 RGB 를 부분적으로 빨강 쪽으로 shift (분노/부패 분위기)
  const c = parseHex(e.color);
  if (c) {
    const intensity = Math.min(0.45, Math.floor(wave / 5) * 0.08);
    // R 채널은 +intensity, G/B 는 -intensity*0.5 — 붉은 톤 강조
    const r = Math.min(255, Math.round(c.r + 255 * intensity));
    const g = Math.max(0,   Math.round(c.g - 255 * intensity * 0.5));
    const b = Math.max(0,   Math.round(c.b - 255 * intensity * 0.4));
    e.color = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
}
function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  const v = parseInt(m[1], 16);
  return { r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff };
}
function toHex(n: number): string { return n.toString(16).padStart(2, '0'); }

/** ⭐ Elite 변종 — 일반 적 1.8x HP + 1.4x 데미지 + 5x 코인 + 외곽 빨강. 처치 시 hit-stop 강화 + RP 폭탄 (코인 별도 큰 드롭). */
export function spawnEliteEnemy(world: World, kind: EnemyKind, t: number, hpScale: number = 1, pos?: Vec): Enemy {
  const e = spawnEnemy(world, kind, t, pos, hpScale);
  e.hp *= 1.8; e.hpMax *= 1.8;
  e.damage = Math.ceil(e.damage * 1.4);
  e.coinDrop = Math.ceil(e.coinDrop * 5);
  e.xpDrop = Math.ceil(e.xpDrop * 3);
  e.radius = Math.floor(e.radius * 1.25);
  e.elite = true;
  return e;
}

/** 보스 웨이브 실패/종료 시 호출 — 보스 엔티티를 강제 제거해 다음 웨이브 스폰을 풀어준다. */
export function clearBoss(world: World): void {
  if (world.bossInstance) {
    const idx = world.enemies.indexOf(world.bossInstance);
    if (idx >= 0) world.enemies.splice(idx, 1);
    world.bossInstance = null;
  }
  world.bossRuntime = null;
  world.cameraZoomTarget = 1;
}

export function spawnBoss(world: World, t: number, hpMult: number = 1, kind: BossKind = 'normal'): Enemy {
  if (world.bossInstance && world.bossInstance.hp > 0) return world.bossInstance;
  const def = ENEMY_DEF.boss;
  const angle = rng() * Math.PI * 2;
  const dist = 360;
  // ⭐ kind 별 HP 배율 — 기존엔 hpMult(웨이브 비례)만 적용되고 mega/divine 의 '격'이 HP 에 0 반영
  //   이라 후반 보스가 플레이어 DPS 대비 물렁했음(사용자 #1 "보스 너무 쉬움"). normal=1 유지,
  //   mega/divine 은 클라이맥스 전투답게 묵직하게. (divine 은 25/50/75 희소 → 과하지 않게 4.0.)
  const kindHpMult = kind === 'divine' ? 4.0 : kind === 'mega' ? 2.2 : 1.0;
  const bossHp = def.hpMax * hpMult * kindHpMult;
  const e: Enemy = {
    ...def,
    hp: bossHp,
    hpMax: bossHp,
    id: _enemyId++,
    pos: {
      x: world.player.pos.x + Math.cos(angle) * dist,
      y: world.player.pos.y + Math.sin(angle) * dist,
    },
    vel: { x: 0, y: 0 },
    spawnTime: t,
    slow: 1, slowUntil: 0,
    burning: 0, burnUntil: 0,
    hitFlashUntil: 0,
    spawning: 1,
    attackCd: 0, chargeUntil: 0, chargeDir: { x: 0, y: 0 },
    exploded: false, summonCd: 4,
  };
  world.enemies.push(e);
  world.bossInstance = e;
  world.bossRuntime = attachBossRuntime(e, kind);
  // 보스 등장 카메라 줌
  world.cameraZoomTarget = 1.2;
  setTimeout(() => { world.cameraZoomTarget = 1; }, 1000);
  return e;
}

// ⭐ 5단계 tier 컬러 — 인크리멘털 게임 표준 (1~999 흰 / 1K~ 시안 / 1M~ 핑크 / 1B~ 황금 / 1T+ 무지개).
// 호출자가 명시적으로 색을 줘도 (ex. burn 오렌지) 우선 적용. 색 미지정 시 자동 tier.
function dmgTierColor(dmg: number): string {
  if (dmg >= 1e12) return '#ffffff'; // T+ — 무지개는 size/별도 효과로 표현
  if (dmg >= 1e9)  return '#ffd700'; // B
  if (dmg >= 1e6)  return '#ff2a6d'; // M
  if (dmg >= 1e3)  return '#05d9e8'; // K
  return '#ffffff';
}
function dmgTierSize(dmg: number): number {
  if (dmg >= 1e12) return 36;
  if (dmg >= 1e9)  return 32;
  if (dmg >= 1e6)  return 28;
  if (dmg >= 1e3)  return 24;
  if (dmg >= 100)  return 20;
  if (dmg >= 50)   return 18;
  return 14;
}
// ⭐ 색약 모드 더블코딩 — tier 별 도형 마커 (●○◆◇★) 추가.
// 색만으로 의존하지 않고 형상으로도 구분 가능 — itch.io a11y 표준.
function dmgTierShape(dmg: number): string {
  if (dmg >= 1e12) return '★';
  if (dmg >= 1e9)  return '◆';
  if (dmg >= 1e6)  return '◇';
  if (dmg >= 1e3)  return '●';
  return '';
}
// 큰 숫자는 K/M/B 약어 (incremental 표준).
function dmgTierText(dmg: number): string {
  if (dmg >= 1e12) return (dmg / 1e12).toFixed(1) + 'T';
  if (dmg >= 1e9)  return (dmg / 1e9).toFixed(1)  + 'B';
  if (dmg >= 1e6)  return (dmg / 1e6).toFixed(1)  + 'M';
  if (dmg >= 1e4)  return (dmg / 1e3).toFixed(1)  + 'K';
  if (dmg >= 1e3)  return Math.round(dmg).toString();
  if (dmg >= 100)  return Math.round(dmg).toString();
  return dmg.toFixed(0);
}

// ⭐ 색약 모드 전역 플래그 — main.ts에서 메타 변경 시 setColorblindMode()로 토글.
// 모듈 분리 유지를 위해 world 내부에서만 참조.
let _colorblind = false;
export function setColorblindMode(on: boolean): void { _colorblind = !!on; }
export function getColorblindMode(): boolean { return _colorblind; }

let _dmgId = 1;
export function spawnDamageNumber(world: World, pos: Vec, dmg: number, color?: string): void {
  if (dmg > world.maxDmgThisTick) world.maxDmgThisTick = dmg;
  // 색약 모드 → 빨강(#ff2a6d)/시안(#05d9e8) 조합을 주황/노랑으로 치환.
  let c = color ?? dmgTierColor(dmg);
  if (_colorblind) {
    if (c === '#ff2a6d') c = '#ff8a2a';
    else if (c === '#05d9e8') c = '#fff352';
  }
  const sz = dmgTierSize(dmg);
  // 큰 데미지(1K+)는 위로 더 강하게 튀고 horizontal drift 줄임 (가독성)
  const big = dmg >= 1000;
  // 색약 모드 + 1K+ → 도형 마커 prefix (●○◆◇★)로 색에 의존 안 함
  const shape = _colorblind ? dmgTierShape(dmg) : '';
  const text = shape ? `${shape}${dmgTierText(dmg)}` : dmgTierText(dmg);
  world.damageNumbers.push({
    id: _dmgId++,
    pos: { x: pos.x + (rng() - 0.5) * (big ? 8 : 16), y: pos.y - 12 },
    vel: { x: (rng() - 0.5) * (big ? 30 : 60), y: -110 - rng() * (big ? 30 : 40) },
    text,
    color: c, size: sz,
    life: big ? 1.0 : 0.7, lifeMax: big ? 1.0 : 0.7,
  });
  // 동시 다수 폭딜 시 글리치 방지 — 가장 오래된 것부터 제거
  while (world.damageNumbers.length > 30) world.damageNumbers.shift();
}

let _deadId = 1;
export function spawnDeadAnim(world: World, pos: Vec, color: string, radius: number): void {
  world.deadAnims.push({
    id: _deadId++,
    pos: { ...pos },
    color, radius,
    life: 0.5, lifeMax: 0.5,
    rot: rng() * Math.PI * 2,
  });
  if (world.deadAnims.length > 60) world.deadAnims.shift();
}

export function pickEnemyKind(wave: number): EnemyKind {
  const r = rng();
  if (wave >= 12) {
    if (r < 0.20) return 'jab';
    if (r < 0.35) return 'wonwi';
    if (r < 0.50) return 'dokkaebi';
    if (r < 0.65) return 'shooter';
    if (r < 0.80) return 'charger';
    if (r < 0.92) return 'exploder';
    return 'summoner';
  } else if (wave >= 8) {
    if (r < 0.30) return 'jab';
    if (r < 0.50) return 'wonwi';
    if (r < 0.68) return 'dokkaebi';
    if (r < 0.82) return 'shooter';
    if (r < 0.94) return 'charger';
    return 'exploder';
  } else if (wave >= 5) {
    if (r < 0.40) return 'jab';
    if (r < 0.65) return 'wonwi';
    if (r < 0.83) return 'dokkaebi';
    if (r < 0.95) return 'shooter';
    return 'charger';
  } else if (wave >= 3) {
    if (r < 0.55) return 'jab';
    if (r < 0.80) return 'wonwi';
    if (r < 0.95) return 'dokkaebi';
    return 'shooter';
  } else {
    if (r < 0.85) return 'jab';
    return 'wonwi';
  }
}

// ─────────────────────────── 발사체 / 영역 ───────────────────────────

export function spawnProjectile(world: World, init: Omit<Projectile, 'id' | 'hitIds'>): Projectile {
  if (world.projectiles.length >= MAX_PROJECTILES) {
    // 가장 오래된 것 제거 (life 가장 적은)
    let oldest = 0;
    for (let i = 1; i < world.projectiles.length; i++) {
      if (world.projectiles[i].life < world.projectiles[oldest].life) oldest = i;
    }
    world.projectiles.splice(oldest, 1);
  }
  const p: Projectile = { ...init, id: _projId++, hitIds: new Set() };
  if (init.kind === 'coin' || init.kind === 'orb') p.trail = [];
  world.projectiles.push(p);
  return p;
}

export function spawnAreaEffect(world: World, init: Omit<AreaEffect, 'id' | 'lastHit'>): AreaEffect {
  const a: AreaEffect = { ...init, id: _areaId++, lastHit: new Map() };
  world.areaEffects.push(a);
  return a;
}

export function spawnPickup(world: World, kind: Pickup['kind'], pos: Vec, value: number): Pickup {
  if (world.pickups.length >= MAX_PICKUPS) {
    // 가장 멀리 있는 픽업 제거
    let farthestIdx = 0; let farthestD2 = 0;
    for (let i = 0; i < world.pickups.length; i++) {
      const pp = world.pickups[i];
      if (pp.kind !== 'coin') continue;
      const dx = pp.pos.x - world.player.pos.x;
      const dy = pp.pos.y - world.player.pos.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > farthestD2) { farthestD2 = d2; farthestIdx = i; }
    }
    world.pickups.splice(farthestIdx, 1);
  }
  // ⭐ 픽업 가시성 — 모든 픽업 시각/충돌 반경 확대 (사용자 피드백). 작은 점이 아니라 명확한 아이템.
  const radius = kind === 'coin' ? 10 : kind === 'xp' ? 11 : kind === 'heart' ? 16 : kind === 'chest' ? 20 : kind === 'gem' ? 14 : 14;
  const p: Pickup = {
    id: _pickupId++,
    kind, pos: { ...pos }, value, radius,
    vel: { x: 0, y: 0 },
  };
  world.pickups.push(p);
  return p;
}

// ─────────────────────────── 월드 오브젝트 (Props) 인터랙션 ───────────────────────────
//
// 게임이론 풀파워 — 각 prop 은 단순 보상/장식이 아니라 결정 트리(decision tree).
// 자세한 설계 의도는 PropKind 정의 주석 참고.

function tickProps(world: World, dt: number, t: number, events: WorldEvent[]) {
  const player = world.player;
  // beacon 상태 — 매 틱 재계산 (위치 의존)
  let beaconActive = false;

  for (let i = world.props.length - 1; i >= 0; i--) {
    const p = world.props[i];
    p.cooldown = Math.max(0, p.cooldown - dt);

    // 거리/방향 (플레이어 기준)
    const dx = player.pos.x - p.pos.x;
    const dy = player.pos.y - p.pos.y;
    const d2 = dx * dx + dy * dy;
    const d = Math.sqrt(d2) || 1;

    switch (p.kind) {
      case 'blackhole': {
        const PULL_R = 280, KILL_R = 38;
        // 플레이어 인력 (대시 중엔 면역)
        if (d < PULL_R && world.dashUntil <= t) {
          const force = (1 - d / PULL_R) * 540;
          player.vel.x -= (dx / d) * force * dt;
          player.vel.y -= (dy / d) * force * dt;
          // 중심 닿으면 큰 데미지 + 텔레포트 밖으로
          if (d < KILL_R && player.invulnUntil <= t) {
            events.push({ type: 'playerHit', payload: { dmg: 1, kind: 'blackhole' } });
            player.invulnUntil = t + 1200;
            player.hitFlashUntil = t + 400;
            // 밖으로 튕겨내기
            player.pos.x = p.pos.x + (dx / d) * (PULL_R + 20);
            player.pos.y = p.pos.y + (dy / d) * (PULL_R + 20);
          }
        }
        // 적 인력 — spawning 끝난 적만
        for (const e of world.enemies) {
          if (e.spawning < 1 || e.hp <= 0 || e.kind === 'boss') continue;
          const edx = e.pos.x - p.pos.x;
          const edy = e.pos.y - p.pos.y;
          const ed = Math.hypot(edx, edy) || 1;
          if (ed < PULL_R) {
            const force = (1 - ed / PULL_R) * 600;
            e.vel.x -= (edx / ed) * force * dt;
            e.vel.y -= (edy / ed) * force * dt;
            if (ed < KILL_R) {
              // 흡수 — 즉사 + 보너스 코인 + 콤보 streak. **Game Theory**: 적을 끌어들이는 게 이득.
              if (e.kind === 'jangsan') {
                e.hp -= 8;
                e.hitFlashUntil = t + 150;
              } else {
                e.hp = 0;
                spawnDeadAnim(world, e.pos, e.color, e.radius);
                // 보너스 +2 코인 (일반 처치 대비 인센티브) + 빨려들기 이벤트
                spawnPickup(world, 'coin', { x: p.pos.x, y: p.pos.y }, e.coinDrop + 2);
                // 콤보 streak 도 갱신 — 블랙홀로 farming 가능하게
                if (t - world.lastKillTime < 500) world.killStreak += 1;
                else world.killStreak = 1;
                world.lastKillTime = t;
                events.push({ type: 'blackholeKill', payload: { x: p.pos.x, y: p.pos.y, coin: e.coinDrop + 2, streak: world.killStreak, kind: e.kind } });
              }
            }
          }
        }
        break;
      }

      case 'shrine': {
        // ⭐ Pray Mode (Stag Hunt) — 60px 내 + 거의 정지 + 3s = 영구 +1 maxHP.
        // 파괴 모드와 상호 배타. 기도 중에 데미지 입거나 움직이면 progress 리셋.
        const PRAY_R = 60, PRAY_TIME = 3.0;
        const moving = Math.hypot(player.vel.x, player.vel.y) > 40;
        if (!p.prayerCompleted && d < PRAY_R && !moving && player.hitFlashUntil < t) {
          p.prayProgress = (p.prayProgress ?? 0) + dt;
          if (p.prayProgress >= PRAY_TIME) {
            p.prayerCompleted = true;
            events.push({ type: 'prayerComplete', payload: { x: p.pos.x, y: p.pos.y } });
            // 황금 광채 (시각 보상)
            spawnAreaEffect(world, {
              pos: { ...p.pos }, radius: 120, damage: 0, life: 0.6,
              color: '#ffd700', followPlayer: false, kind: 'nova',
              slowFactor: 1, hitInterval: 1,
            });
          }
        } else if (!p.prayerCompleted) {
          // 멀어지거나 움직이면 progress 천천히 decay
          p.prayProgress = Math.max(0, (p.prayProgress ?? 0) - dt * 0.5);
        }
        // 영역 효과 (오라/노바) 데미지 — 발사체 충돌은 발사체 루프에서 처리 (이동 후 정확)
        for (const a of world.areaEffects) {
          const adx = a.pos.x - p.pos.x;
          const ady = a.pos.y - p.pos.y;
          const ad = Math.hypot(adx, ady);
          if (ad < a.radius + p.radius) {
            const last = a.lastHit.get(p.id + 200000) ?? 0;
            if (t - last >= a.hitInterval * 1000) {
              a.lastHit.set(p.id + 200000, t);
              p.hp -= a.damage;
              p.hitFlashUntil = t + 100;
              if (p.hp <= 0) destroyProp(world, p, t, events, 'shrine');
            }
          }
        }
        break;
      }

      case 'wreck': {
        // 영역 효과 — 발사체 충돌은 발사체 루프에서 처리 (점진 채굴 트리거)
        for (const a of world.areaEffects) {
          const adx = a.pos.x - p.pos.x;
          const ady = a.pos.y - p.pos.y;
          const ad = Math.hypot(adx, ady);
          if (ad < a.radius + p.radius) {
            const last = a.lastHit.get(p.id + 200000) ?? 0;
            if (t - last >= a.hitInterval * 1000) {
              a.lastHit.set(p.id + 200000, t);
              p.hp -= a.damage;
              p.hitFlashUntil = t + 100;
              if (p.hp <= 0) destroyProp(world, p, t, events, p.kind);
            }
          }
        }
        break;
      }

      case 'asteroid': {
        // ⭐ Kinetic 운동 — 발사체 맞으면 가속, 적과 충돌 시 데미지 + 친근감 있는 패배.
        // 마찰 (서서히 감속). vel 적용.
        if (p.vel) {
          p.pos.x += p.vel.x * dt;
          p.pos.y += p.vel.y * dt;
          const speed = Math.hypot(p.vel.x, p.vel.y);
          if (speed > 0) {
            const friction = Math.max(0, 1 - dt * 1.2);  // ~1초에 30% 감속
            p.vel.x *= friction;
            p.vel.y *= friction;
            if (Math.hypot(p.vel.x, p.vel.y) < 10) { p.vel.x = 0; p.vel.y = 0; }
          }
          // 운석이 빠르게 움직이면 적과 충돌 시 큰 데미지
          if (speed > 50) {
            for (const e of world.enemies) {
              if (e.hp <= 0 || e.spawning < 1) continue;
              const edx = e.pos.x - p.pos.x;
              const edy = e.pos.y - p.pos.y;
              const ed2 = edx * edx + edy * edy;
              const r = e.radius + p.radius;
              if (ed2 < r * r) {
                // 질량 × 속도 — 큰 운석 빠르면 한 방
                const kineticDmg = (p.mass ?? 2) * speed * 0.08;
                e.hp -= kineticDmg;
                e.hitFlashUntil = t + 120;
                spawnDamageNumber(world, e.pos, kineticDmg, '#b14aff');
                // 운석 감속 (튕김)
                const ed = Math.sqrt(ed2) || 1;
                p.vel.x -= (edx / ed) * speed * 0.4;
                p.vel.y -= (edy / ed) * speed * 0.4;
                // 적도 살짝 밀려남
                e.vel.x += (-edx / ed) * 200;
                e.vel.y += (-edy / ed) * 200;
              }
            }
          }
        }
        // 영역 효과 데미지
        for (const a of world.areaEffects) {
          const adx = a.pos.x - p.pos.x;
          const ady = a.pos.y - p.pos.y;
          const ad = Math.hypot(adx, ady);
          if (ad < a.radius + p.radius) {
            const last = a.lastHit.get(p.id + 200000) ?? 0;
            if (t - last >= a.hitInterval * 1000) {
              a.lastHit.set(p.id + 200000, t);
              p.hp -= a.damage;
              p.hitFlashUntil = t + 100;
              if (p.hp <= 0) destroyProp(world, p, t, events, p.kind);
            }
          }
        }
        // 운석은 플레이어와 충돌 시 데미지 (속도 무관 — 충돌 자체가 위험)
        if (d < p.radius + player.radius) {
          if (player.invulnUntil <= t && world.dashUntil <= t) {
            events.push({ type: 'playerHit', payload: { dmg: 1, kind: 'asteroid' } });
            player.invulnUntil = t + 800;
            player.hitFlashUntil = t + 300;
            // 밀어내기
            player.pos.x += (dx / d) * 30;
            player.pos.y += (dy / d) * 30;
          }
        }
        break;
      }

      case 'lantern': {
        // ⭐ Stronghold + Tragedy of Commons.
        // 적이 30px 이내 2초 점거 = 5초 어두워짐. 어두워지면 효과 X.
        const STRONGHOLD_R = 80;
        const OCCUPY_R = 30;
        const isDark = (p.darkUntil ?? 0) > t;

        // 적 점거 체크
        let enemyClose = false;
        for (const e of world.enemies) {
          if (e.spawning < 1 || e.hp <= 0) continue;
          const edx = e.pos.x - p.pos.x;
          const edy = e.pos.y - p.pos.y;
          if (edx * edx + edy * edy < OCCUPY_R * OCCUPY_R) { enemyClose = true; break; }
        }
        if (enemyClose && !isDark) {
          if (!p.enemyCloseSince) p.enemyCloseSince = t;
          else if (t - p.enemyCloseSince > 2000) {
            p.darkUntil = t + 5000;
            p.enemyCloseSince = 0;
            events.push({ type: 'lanternDark', payload: { x: p.pos.x, y: p.pos.y } });
          }
        } else {
          p.enemyCloseSince = 0;
        }

        if (!isDark) {
          // 플레이어 stronghold 진입 — 무기 cooldown 30% 감소 (haste)
          if (d < STRONGHOLD_R) {
            world.buffHasteUntil = Math.max(world.buffHasteUntil, t + 200);  // 0.2s rolling refresh
          }
          // 슬로우 오라 — 1.5초 쿨다운
          if (p.cooldown <= 0) {
            p.cooldown = 1.5;
            for (const e of world.enemies) {
              const edx = e.pos.x - p.pos.x;
              const edy = e.pos.y - p.pos.y;
              if (edx * edx + edy * edy < 100 * 100) {
                e.slowUntil = Math.max(e.slowUntil, t + 3000);
              }
            }
          }
        }
        break;
      }

      case 'stardust': {
        // ⭐ Adaptive Reward — Information Asymmetry. 플레이어 HP 상태에 따라 다른 보상.
        if (!p.consumed && d < p.radius + player.radius) {
          p.consumed = true;
          // 외부 state.life 정보가 직접 없으므로 player.hp 기반 추정.
          // 실제 라이프는 state 에 있으나 hp 는 1=거의-새-게임이라 main.ts 에 라이프 정보 전달 필요.
          // 단순화 — propBoost payload 에 'stardust' kind 첨부, main.ts 가 state.life 보고 처리.
          events.push({ type: 'propBoost', payload: { x: p.pos.x, y: p.pos.y, kind: 'stardust' } });
          // 기본 부스트 (Full HP 시 효과)
          world.boostUntil = t + 1500;
          world.shieldUntil = Math.max(world.shieldUntil, t + 800);
          spawnDeadAnim(world, p.pos, '#b14aff', p.radius);
        }
        break;
      }
      // ⭐ 솔리드 지형지물 — 플레이어/적 모두 push-out (통과 불가). 이제 destructible.
      case 'monolith':
      case 'rocks':
      case 'ruins':
      case 'mirror_shard': {
        const minDist = p.radius + player.radius;
        if (d < minDist) {
          // 플레이어를 prop 외곽으로 밀어냄 (대시 중에도 적용 — 벽은 진짜 벽).
          // dx,dy = (player - prop) → outward normal = (dx/d, dy/d). 그 방향으로 push (= prop 으로부터 멀어지게).
          // ⚠ 이전 버그: (-dx/d) 를 사용해 plyaer 가 prop 안으로 밀려 들어가 진동(shake)이 발생했음. 부호 수정.
          const push = (minDist - d) + 0.5;          // 0.5 epsilon 으로 경계 고착(jitter) 방지
          const nx = dx / d, ny = dy / d;            // outward normal (prop → player)
          player.pos.x += nx * push;
          player.pos.y += ny * push;
          // 벽 향(inward) 속도 성분 제거 — 평행 성분(슬라이드) 유지.
          const dot = player.vel.x * nx + player.vel.y * ny;
          if (dot < 0) {
            player.vel.x -= nx * dot;
            player.vel.y -= ny * dot;
          }
        }
        // 적도 같은 처리 (단순화 — 모든 적)
        for (const e of world.enemies) {
          if (e.spawning < 1 || e.hp <= 0) continue;
          const edx = e.pos.x - p.pos.x;
          const edy = e.pos.y - p.pos.y;
          const ed = Math.hypot(edx, edy) || 1;
          const eMin = p.radius + e.radius;
          if (ed < eMin) {
            const ePush = eMin - ed;
            e.pos.x += (edx / ed) * ePush;
            e.pos.y += (edy / ed) * ePush;
            // 적 속도도 평행 성분만 유지
            const enx = edx / ed, eny = edy / ed;
            const edot = e.vel.x * enx + e.vel.y * eny;
            if (edot < 0) {
              e.vel.x -= enx * edot;
              e.vel.y -= eny * edot;
            }
          }
        }
        // ⭐ monolith 균열 보상 — HP 임계 도달 시 코인/보석 폭우.
        if (p.kind === 'monolith' && p.crackStops && (p.monolithCracks ?? 0) < p.crackStops.length) {
          const idx = p.monolithCracks ?? 0;
          if (p.hp <= p.crackStops[idx]) {
            p.monolithCracks = idx + 1;
            // 균열마다 코인 4개 + 마지막 균열은 보석 1
            for (let ci = 0; ci < 4; ci++) {
              const ang = (ci / 4) * Math.PI * 2 + Math.random();
              spawnPickup(world, 'coin', {
                x: p.pos.x + Math.cos(ang) * 18,
                y: p.pos.y + Math.sin(ang) * 18,
              }, 8);
            }
            if (idx === p.crackStops.length - 1) {
              spawnPickup(world, 'gem', { x: p.pos.x, y: p.pos.y }, 1);
            }
            events.push({ type: 'monolithCrack', payload: { x: p.pos.x, y: p.pos.y, tier: idx + 1 } });
          }
        }
        break;
      }

      case 'beacon': {
        // ⭐ Greed vs Safety — 250px 내 = +50% 코인 + +30% 스폰 가속.
        // HP 60. 발사체/영역으로 파괴 가능.
        const BEACON_R = 250;
        if (d < BEACON_R) beaconActive = true;
        // 영역 효과 데미지
        for (const a of world.areaEffects) {
          const adx = a.pos.x - p.pos.x;
          const ady = a.pos.y - p.pos.y;
          const ad = Math.hypot(adx, ady);
          if (ad < a.radius + p.radius) {
            const last = a.lastHit.get(p.id + 200000) ?? 0;
            if (t - last >= a.hitInterval * 1000) {
              a.lastHit.set(p.id + 200000, t);
              p.hp -= a.damage;
              p.hitFlashUntil = t + 100;
              if (p.hp <= 0) destroyProp(world, p, t, events, p.kind);
            }
          }
        }
        break;
      }

      case 'pressure_plate': {
        // ⭐ Chicken Game — 압전판. 0.8s 텔레그래프 후 220px 폭발.
        // 플레이어 또는 적 접촉 시 활성화. 활성화되면 시각 경고.
        const PLATE_R = p.radius + 8;
        const ARM_R = 220;
        if (p.plateRearm && p.plateRearm > 0) {
          p.plateRearm = Math.max(0, p.plateRearm - dt);
        } else if ((p.plateFuse ?? -1) < 0) {
          // idle — 접촉 체크 (플레이어 OR 적)
          let triggered = false;
          if (d < PLATE_R) triggered = true;
          if (!triggered) {
            for (const e of world.enemies) {
              if (e.spawning < 1 || e.hp <= 0) continue;
              const edx = e.pos.x - p.pos.x;
              const edy = e.pos.y - p.pos.y;
              if (edx * edx + edy * edy < PLATE_R * PLATE_R) { triggered = true; break; }
            }
          }
          if (triggered) {
            p.plateFuse = 0.8;
            events.push({ type: 'plateArm', payload: { x: p.pos.x, y: p.pos.y } });
          }
        } else {
          // active fuse — 카운트다운
          p.plateFuse = (p.plateFuse ?? 0) - dt;
          if (p.plateFuse <= 0) {
            // 폭발 — 220px nova
            spawnAreaEffect(world, {
              pos: { ...p.pos }, radius: ARM_R, damage: 50, life: 0.35,
              color: '#ffaa00', followPlayer: false, kind: 'nova',
              slowFactor: 1, hitInterval: 0.5,
            });
            // 플레이어가 영역 내면 데미지
            if (d < ARM_R && player.invulnUntil <= t && world.dashUntil <= t) {
              events.push({ type: 'playerHit', payload: { dmg: 1, kind: 'pressure_plate' } });
              player.invulnUntil = t + 1400;
              player.hitFlashUntil = t + 350;
              world.slowMoUntil = t + 200;
            }
            events.push({ type: 'plateBoom', payload: { x: p.pos.x, y: p.pos.y } });
            p.plateFuse = -1;
            p.plateRearm = 4;  // 4초 쿨다운 후 재무장
          }
        }
        break;
      }

      case 'cursed_totem': {
        // ⭐ Stag Hunt 극단 — 파괴 시 거대 보상 + elite 3마리 즉시 스폰.
        // 영역효과로 파괴 가능. 발사체 충돌은 발사체 루프에서 처리.
        for (const a of world.areaEffects) {
          const adx = a.pos.x - p.pos.x;
          const ady = a.pos.y - p.pos.y;
          const ad = Math.hypot(adx, ady);
          if (ad < a.radius + p.radius) {
            const last = a.lastHit.get(p.id + 200000) ?? 0;
            if (t - last >= a.hitInterval * 1000) {
              a.lastHit.set(p.id + 200000, t);
              p.hp -= a.damage;
              p.hitFlashUntil = t + 100;
              if (p.hp <= 0) destroyProp(world, p, t, events, p.kind);
            }
          }
        }
        break;
      }
    }

    // 파괴 후 1초 지나면 prop 제거
    if (p.destroyedAt && t - p.destroyedAt > 1000) {
      world.props.splice(i, 1);
    } else if (p.kind === 'stardust' && p.consumed && t - (p.destroyedAt ?? t) > 600) {
      world.props.splice(i, 1);
    }
  }

  // 매 틱 beacon 상태 갱신
  world.beaconActive = beaconActive;
  world.beaconBoostMul = beaconActive ? 1.5 : 1;
  world.beaconSpawnMul = beaconActive ? 1.3 : 1;
}

function destroyProp(world: World, p: WorldProp, t: number, events: WorldEvent[], kind: PropKind) {
  if (p.destroyedAt) return;
  p.destroyedAt = t;
  events.push({ type: 'propDestroyed', payload: { x: p.pos.x, y: p.pos.y, kind } });

  switch (kind) {
    case 'shrine': {
      // 황금 폭발 — 200px 반경 적 데미지 100
      spawnAreaEffect(world, {
        pos: { ...p.pos }, radius: 200, damage: 100, life: 0.4,
        color: '#ffd700', followPlayer: false, kind: 'nova',
        slowFactor: 1, hitInterval: 0.1,
      });
      // 코인 폭우 + RP (RP 는 reducer 가 처리하지 않으므로 큰 코인으로 대체)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        spawnPickup(world, 'coin', {
          x: p.pos.x + Math.cos(a) * 30,
          y: p.pos.y + Math.sin(a) * 30,
        }, 25);
      }
      // 황금 보상상자 1개 (체력 회복 가능성)
      spawnPickup(world, 'chest', { ...p.pos }, 1);
      break;
    }
    case 'wreck': {
      // ⭐ 점진 채굴 종착 — 마지막 한 방 = 큰 폭발 + 코인 폭우 + heart 보장 (아직 안 떨어졌으면).
      spawnAreaEffect(world, {
        pos: { ...p.pos }, radius: 80, damage: 25, life: 0.25,
        color: '#ff8866', followPlayer: false, kind: 'nova',
        slowFactor: 1, hitInterval: 0.1,
      });
      // 마지막 히트 보너스 — heart 가 아직 안 떨어졌으면 보장
      if ((p.wreckHits ?? 0) < 1) {
        spawnPickup(world, 'heart', { ...p.pos }, 1);
      }
      // 큰 코인 폭우 (점진 채굴보다 마지막 일격 보상 큼 → 끝까지 파괴 인센티브)
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        spawnPickup(world, 'coin', {
          x: p.pos.x + Math.cos(a) * 22,
          y: p.pos.y + Math.sin(a) * 22,
        }, 15);
      }
      break;
    }
    case 'asteroid': {
      // 코인 5개 + 작은 데미지 폭발
      spawnAreaEffect(world, {
        pos: { ...p.pos }, radius: 80, damage: 20, life: 0.2,
        color: '#b14aff', followPlayer: false, kind: 'nova',
        slowFactor: 1, hitInterval: 0.1,
      });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        spawnPickup(world, 'coin', {
          x: p.pos.x + Math.cos(a) * 18,
          y: p.pos.y + Math.sin(a) * 18,
        }, 5);
      }
      break;
    }
    case 'monolith': {
      // ⭐ RP 폭탄 — gem×2 + chest + 큰 코인 + 220px 황금 노바.
      spawnAreaEffect(world, {
        pos: { ...p.pos }, radius: 220, damage: 80, life: 0.4,
        color: '#ffd700', followPlayer: false, kind: 'nova',
        slowFactor: 1, hitInterval: 0.1,
      });
      spawnPickup(world, 'gem', { ...p.pos }, 1);
      spawnPickup(world, 'gem', { x: p.pos.x + 24, y: p.pos.y }, 1);
      spawnPickup(world, 'chest', { x: p.pos.x - 24, y: p.pos.y }, 1);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        spawnPickup(world, 'coin', {
          x: p.pos.x + Math.cos(a) * 32, y: p.pos.y + Math.sin(a) * 32,
        }, 20);
      }
      break;
    }
    case 'rocks': {
      // ⭐ 흙폭발 (80px, 데미지 20) + 코인 3개.
      spawnAreaEffect(world, {
        pos: { ...p.pos }, radius: 80, damage: 20, life: 0.2,
        color: '#7a6850', followPlayer: false, kind: 'nova',
        slowFactor: 1, hitInterval: 0.1,
      });
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        spawnPickup(world, 'coin', {
          x: p.pos.x + Math.cos(a) * 16, y: p.pos.y + Math.sin(a) * 16,
        }, 5);
      }
      break;
    }
    case 'ruins': {
      // ⭐ Loss for Power — 일시 atk +40% + spd +20% 5초.
      world.buffAtkUntil = Math.max(world.buffAtkUntil, t + 5000);
      world.buffSpdUntil = Math.max(world.buffSpdUntil, t + 5000);
      events.push({ type: 'ruinsBuff', payload: { x: p.pos.x, y: p.pos.y } });
      // 작은 흙폭발 + 황금 광채
      spawnAreaEffect(world, {
        pos: { ...p.pos }, radius: 100, damage: 15, life: 0.3,
        color: '#ffd700', followPlayer: false, kind: 'nova',
        slowFactor: 1, hitInterval: 0.1,
      });
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        spawnPickup(world, 'coin', {
          x: p.pos.x + Math.cos(a) * 16, y: p.pos.y + Math.sin(a) * 16,
        }, 8);
      }
      break;
    }
    case 'beacon': {
      // ⭐ 봉화 파괴 — 큰 코인 + chest. 안전성 회복 (이제 스폰 가속 X).
      spawnAreaEffect(world, {
        pos: { ...p.pos }, radius: 150, damage: 30, life: 0.3,
        color: '#ff6f00', followPlayer: false, kind: 'nova',
        slowFactor: 1, hitInterval: 0.1,
      });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        spawnPickup(world, 'coin', {
          x: p.pos.x + Math.cos(a) * 22, y: p.pos.y + Math.sin(a) * 22,
        }, 18);
      }
      spawnPickup(world, 'chest', { ...p.pos }, 1);
      break;
    }
    case 'cursed_totem': {
      // ⭐ 잭팟 — 거대 보상 + elite 3마리 즉시 스폰. 풀 commitment 만이 보상.
      spawnAreaEffect(world, {
        pos: { ...p.pos }, radius: 200, damage: 60, life: 0.4,
        color: '#d300c5', followPlayer: false, kind: 'nova',
        slowFactor: 1, hitInterval: 0.1,
      });
      // 보석 3 + chest 2 + 코인 폭우
      spawnPickup(world, 'gem', { ...p.pos }, 1);
      spawnPickup(world, 'gem', { x: p.pos.x + 22, y: p.pos.y - 16 }, 1);
      spawnPickup(world, 'gem', { x: p.pos.x - 22, y: p.pos.y - 16 }, 1);
      spawnPickup(world, 'chest', { x: p.pos.x + 20, y: p.pos.y + 20 }, 1);
      spawnPickup(world, 'chest', { x: p.pos.x - 20, y: p.pos.y + 20 }, 1);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        spawnPickup(world, 'coin', {
          x: p.pos.x + Math.cos(a) * 40, y: p.pos.y + Math.sin(a) * 40,
        }, 30);
      }
      // ⭐ 저주 — elite 3마리 즉시 스폰 (totem 둘레)
      // hpScale 은 현재 wave 가 없어 1배수 — wave 와 곱해 줄 책임은 caller. 단순화 위해 1x.
      for (let ei = 0; ei < 3; ei++) {
        const ang = (ei / 3) * Math.PI * 2;
        const ekPool: EnemyKind[] = ['dokkaebi', 'charger', 'exploder'];
        const ek = ekPool[Math.floor(Math.random() * ekPool.length)];
        const ex = p.pos.x + Math.cos(ang) * 120;
        const ey = p.pos.y + Math.sin(ang) * 120;
        spawnEliteEnemy(world, ek, t, 1, { x: ex, y: ey });
      }
      events.push({ type: 'cursedSummon', payload: { x: p.pos.x, y: p.pos.y } });
      break;
    }
  }
}

// ─────────────────────────── 시뮬 한 틱 ───────────────────────────

export interface WorldEvent {
  type: 'enemyKill' | 'pickup' | 'playerHit' | 'bossKill' | 'projectileHit' | 'propDestroyed' | 'propBoost'
      | 'bossTelegraph' | 'bossSummon' | 'bossCharge' | 'bossRadial'
      // ⭐ 신규 게임이론 이벤트 (props 메커니즘)
      | 'blackholeKill'    // blackhole 적 흡수 = +코인 + streak
      | 'prayerComplete'   // shrine 기도 완료 = lifeMax +1 (main.ts 가 dispatch)
      | 'monolithCrack'    // monolith HP 임계 도달 = 균열 보상
      | 'ruinsBuff'        // ruins 파괴 = 5s atk/spd 버프 활성
      | 'wreckScavenge'    // wreck 점진 채굴 (tier 1/2)
      | 'plateArm'         // pressure_plate 활성 시작 (텔레그래프)
      | 'plateBoom'        // pressure_plate 폭발
      | 'lanternDark'      // lantern tragedy — 어두워짐
      | 'cursedSummon'     // cursed_totem 파괴 시 elite 3 스폰
      | 'mirrorReflect';   // mirror_shard 반사
  payload: any;
}

const PICKUP_MAGNET_RADIUS = 80;
const PICKUP_PICK_RADIUS = 22;

export function tickWorld(world: World, dt: number, t: number, state: GameState, input: Vec, applyWeapons: (w: World, dt: number, t: number, state: GameState) => void, dashRequested: boolean = false): WorldEvent[] {
  const events: WorldEvent[] = [];
  world.fieldTime += dt;
  world.maxDmgThisTick = 0;

  // ── 대시 처리 ──
  world.dashCooldown = Math.max(0, world.dashCooldown - dt);
  if (dashRequested && world.dashCooldown <= 0) {
    world.dashUntil = t + 200;
    world.dashCooldown = 2;
    world.player.invulnUntil = Math.max(world.player.invulnUntil, t + 250);
  }
  const dashing = world.dashUntil > t;
  // ⭐ ruins 파괴 buff = 이동속도 +20%
  const ruinsSpd = world.buffSpdUntil > t ? 1.2 : 1;
  const speedMul = (dashing ? 4 : 1) * ruinsSpd;

  // ── 플레이어 이동 (input vector, length 0~1) ──
  const ilen = Math.hypot(input.x, input.y);
  if (ilen > 0.05) {
    const nx = input.x / ilen, ny = input.y / ilen;
    world.player.vel.x = nx * world.player.speed * speedMul;
    world.player.vel.y = ny * world.player.speed * speedMul;
    world.player.facing = Math.atan2(ny, nx);
    if (Math.abs(nx) > 0.1) world.player.facingX = nx > 0 ? 1 : -1;
    world.player.walkPhase += dt * 14;
  } else if (dashing) {
    // 대시인데 입력 없으면 facing 방향으로
    world.player.vel.x = Math.cos(world.player.facing) * world.player.speed * speedMul;
    world.player.vel.y = Math.sin(world.player.facing) * world.player.speed * speedMul;
  } else {
    world.player.vel.x *= 0.85;
    world.player.vel.y *= 0.85;
    world.player.walkPhase *= 0.92;
  }
  // 부스트 (stardust = ⚡ 별먼지 흡수 시) — 카메라가 못 따라가지 않도록 약하게(1.25×) + 짧게
  const boosting = world.boostUntil > t;
  if (boosting) {
    world.player.vel.x *= 1.25;
    world.player.vel.y *= 1.25;
  }
  // ⭐ 경사도 보정 — 펄린 elevation 차이 기반. 오르막 느려지고 내리막 빨라짐.
  // 30px 전방 샘플. 대시 중엔 면역 (관성 유지). 실력감 영향: 정상부 진입 시 ~0.7배.
  if (!dashing) {
    const pSpd = Math.hypot(world.player.vel.x, world.player.vel.y);
    if (pSpd > 1) {
      const dxN = world.player.vel.x / pSpd, dyN = world.player.vel.y / pSpd;
      const sMul = slopeSpeedMul(
        world.player.pos.x, world.player.pos.y,
        world.player.pos.x + dxN * 30, world.player.pos.y + dyN * 30,
      );
      world.player.vel.x *= sMul;
      world.player.vel.y *= sMul;
    }
  }
  world.player.pos.x += world.player.vel.x * dt;
  world.player.pos.y += world.player.vel.y * dt;

  // ── 월드 오브젝트 인터랙션 (블랙홀/사당/잔해/운석/등불/별먼지) ──
  tickProps(world, dt, t, events);

  // ── 카메라 lerp + 약한 lookahead (이동 방향 30px 시야 + 느린 lerp) ──
  const speed = Math.hypot(world.player.vel.x, world.player.vel.y);
  const leadAmt = speed > 30 ? 30 : 0;
  const leadX = speed > 0 ? (world.player.vel.x / speed) * leadAmt : 0;
  const leadY = speed > 0 ? (world.player.vel.y / speed) * leadAmt : 0;
  // 카메라 자체도 부드럽게 lookahead 보간 (즉시 반응 X)
  if (!('leadX' in world.camera)) (world.camera as any).leadX = 0;
  if (!('leadY' in world.camera)) (world.camera as any).leadY = 0;
  (world.camera as any).leadX += (leadX - (world.camera as any).leadX) * Math.min(1, dt * 1.5);
  (world.camera as any).leadY += (leadY - (world.camera as any).leadY) * Math.min(1, dt * 1.5);
  const targetX = world.player.pos.x + (world.camera as any).leadX;
  const targetY = world.player.pos.y + (world.camera as any).leadY;
  // 부스트/대시 중엔 카메라 lerp 강화 — 캐릭터가 화면 밖으로 빠지는 문제 방지
  const camLerp = (boosting || dashing) ? 9 : 4;
  world.camera.x += (targetX - world.camera.x) * Math.min(1, dt * camLerp);
  world.camera.y += (targetY - world.camera.y) * Math.min(1, dt * camLerp);

  // ── 적 스폰 ──
  // ⭐ beacon 영역 내 = 1.3배 스폰 가속 (Greed vs Safety)
  if (!world.bossInstance) {
    world.spawnTimer += dt * world.beaconSpawnMul;
    const interval = Math.max(0.15, world.spawnInterval - state.wave * 0.05);
    // 웨이브 진행 HP 스케일 — 강한 빌드의 점수 폭주 억제 (선형 +0.35x/wave)
    const hpScale = 1 + Math.max(0, state.wave - 1) * 0.35;
    while (world.spawnTimer >= interval) {
      world.spawnTimer -= interval;
      const burst = 1 + Math.floor(state.wave / 3);
      for (let i = 0; i < burst; i++) {
        const e = spawnEnemy(world, pickEnemyKind(state.wave), t, undefined, hpScale);
        applyWaveVariant(e, state.wave);
      }
    }
    // 미니보스 (장산범) 매 60초
    world.miniBossTimer -= dt;
    if (world.miniBossTimer <= 0) {
      world.miniBossTimer = 60;
      spawnEnemy(world, 'jangsan', t, undefined, hpScale);
    }
    // ⭐ Elite 스폰 — W3+ 매 30초 1체 (일반 적 변종 — 빨간 외곽 + RP 폭탄)
    if (state.wave >= 3) {
      world.eliteTimer -= dt;
      if (world.eliteTimer <= 0) {
        world.eliteTimer = 30;
        // dokkaebi/charger/exploder 중에서 무작위 선택 (잡몹은 너무 약하고 summoner는 너무 까다로움)
        const eliteKinds: EnemyKind[] = state.wave >= 8 ? ['dokkaebi', 'charger', 'exploder', 'summoner'] : ['dokkaebi', 'charger'];
        const k = eliteKinds[Math.floor(rng() * eliteKinds.length)];
        const ee = spawnEliteEnemy(world, k, t, hpScale);
        applyWaveVariant(ee, state.wave);
      }
    }
  }

  // ── 무기 자동 발사 ──
  applyWeapons(world, dt, t, state);

  // ⭐ 직접 hp 차감 무기(발톱·체인 등)로 hp<=0 된 파괴가능 프롭 파괴 — 충돌 루프 밖 단일 sweep.
  //   이전엔 이 sweep 이 없어 발톱이 hp 만 깎고 프롭이 안 부서지던 버그(좀비 프롭).
  //   wreck 은 hits 기반(hp 미사용)이라 제외. destroyProp 은 destroyedAt 마킹만(splice X) → for-of 안전.
  for (const p of world.props) {
    if (p.destroyedAt || p.kind === 'wreck') continue;
    if (p.hpMax > 0 && p.hp <= 0 && DESTRUCTIBLE_KINDS.has(p.kind)) {
      destroyProp(world, p, t, events, p.kind);
    }
  }

  // ── 보스 패턴 FSM (vel 을 직접 세팅하므로 AI 루프 보다 먼저) ──
  if (world.bossRuntime && world.bossInstance) {
    const fsmEvents: FsmEvent[] = [];
    stepBossPattern(world, world.bossRuntime, dt, t, fsmEvents);
    for (const fe of fsmEvents) events.push({ type: fe.type, payload: fe.payload });
  }

  // ── 적 AI: 종류별 행동 ──
  const TELEGRAPH_MS = 350;
  for (const e of world.enemies) {
    if (e.spawning < 1) {
      e.spawning = Math.min(1, (t - e.spawnTime) / TELEGRAPH_MS);
      continue;
    }
    const dx = world.player.pos.x - e.pos.x;
    const dy = world.player.pos.y - e.pos.y;
    const d = Math.hypot(dx, dy) || 1;
    if (e.slowUntil > t) e.slow = 0.5; else e.slow = 1;

    switch (e.kind) {
      case 'shooter': {
        // 250 거리 유지, 1.5초마다 사격
        const desired = 250;
        const drift = d - desired;
        const moveScale = Math.abs(drift) > 30 ? Math.sign(drift) * 0.6 : 0;
        e.vel.x = (dx / d) * e.speed * e.slow * moveScale;
        e.vel.y = (dy / d) * e.speed * e.slow * moveScale;
        e.attackCd -= dt;
        if (e.attackCd <= 0 && d < 400) {
          e.attackCd = 1.6;
          spawnProjectile(world, {
            pos: { ...e.pos }, vel: { x: (dx / d) * 240, y: (dy / d) * 240 },
            // ⭐ 5색 약속: 적 발사체 = 빨강 (#ff3366) 강제. 시안은 ice 무기 색이라 혼동 방지.
            radius: 6, damage: 0, life: 2, color: '#ff3366',
            kind: 'orb', pierce: 0, homing: false, bounces: 0,
          });
          // 적 발사체는 별도 처리 필요 — 여기선 색만 다른 enemyShot 으로 마커
          (world.projectiles[world.projectiles.length - 1] as any).enemyShot = true;
          (world.projectiles[world.projectiles.length - 1] as any).enemyDamage = e.damage;
        }
        break;
      }
      case 'charger': {
        // 평소엔 천천히 따라가다가 2초마다 0.4초간 4배속 돌진
        e.attackCd -= dt;
        if (e.chargeUntil > t) {
          // 돌진 중
          e.vel.x = e.chargeDir.x * e.speed * 4;
          e.vel.y = e.chargeDir.y * e.speed * 4;
        } else {
          if (e.attackCd <= 0 && d < 350) {
            e.attackCd = 3;
            e.chargeUntil = t + 400;
            e.chargeDir = { x: dx / d, y: dy / d };
          }
          e.vel.x = (dx / d) * e.speed * 0.5 * e.slow;
          e.vel.y = (dy / d) * e.speed * 0.5 * e.slow;
        }
        break;
      }
      case 'exploder': {
        // 빠르게 따라가서 가까워지면 자폭 (영역)
        e.vel.x = (dx / d) * e.speed * e.slow;
        e.vel.y = (dy / d) * e.speed * e.slow;
        if (d < 60 && !e.exploded) {
          e.exploded = true;
          e.hp = 0;
          spawnAreaEffect(world, {
            pos: { ...e.pos },
            radius: 90, damage: e.damage * 2, life: 0.3, color: '#ffaa00',
            followPlayer: false, kind: 'nova', slowFactor: 1, hitInterval: 0.5,
          });
          // 플레이어 데미지 직접
          const pdx = world.player.pos.x - e.pos.x;
          const pdy = world.player.pos.y - e.pos.y;
          if (pdx * pdx + pdy * pdy < 90 * 90 && world.player.invulnUntil <= t) {
            events.push({ type: 'playerHit', payload: { dmg: e.damage * 2, kind: 'exploder' } });
            world.player.invulnUntil = t + 1400;
            world.player.hitFlashUntil = t + 350;
            world.player.staggerUntil = t + 200;
            world.slowMoUntil = t + 200;
          }
        }
        break;
      }
      case 'summoner': {
        // 멀리서 머물며 5초마다 잡귀 2마리 소환
        const desired = 320;
        const drift = d - desired;
        const moveScale = Math.abs(drift) > 30 ? Math.sign(drift) * 0.4 : 0;
        e.vel.x = (dx / d) * e.speed * e.slow * moveScale;
        e.vel.y = (dy / d) * e.speed * e.slow * moveScale;
        e.summonCd -= dt;
        if (e.summonCd <= 0) {
          e.summonCd = 5;
          for (let i = 0; i < 2; i++) {
            const a = rng() * Math.PI * 2;
            spawnEnemy(world, 'jab', t, { x: e.pos.x + Math.cos(a) * 30, y: e.pos.y + Math.sin(a) * 30 });
          }
        }
        break;
      }
      case 'boss': {
        // 보스는 bossRuntime FSM 이 vel 을 제어. idle 페이즈일 때만 천천히 추적.
        if (!world.bossRuntime || world.bossRuntime.phase === 'idle') {
          e.vel.x = (dx / d) * e.speed * e.slow * 0.6;
          e.vel.y = (dy / d) * e.speed * e.slow * 0.6;
        }
        break;
      }
      default: {
        // 기본 추적 (jab/wonwi/dokkaebi/jangsan)
        e.vel.x = (dx / d) * e.speed * e.slow;
        e.vel.y = (dy / d) * e.speed * e.slow;
        break;
      }
    }
    // ⭐ 적도 경사 보정 — 산맥 오르막에서 느려져 플레이어가 kiting 가능.
    // 보스/elite 는 면역 (불공정 회피 방지).
    if (e.kind !== 'boss' && !e.elite) {
      const esp = Math.hypot(e.vel.x, e.vel.y);
      if (esp > 1) {
        const dxN = e.vel.x / esp, dyN = e.vel.y / esp;
        const sMul = slopeSpeedMul(e.pos.x, e.pos.y, e.pos.x + dxN * 30, e.pos.y + dyN * 30);
        e.vel.x *= sMul;
        e.vel.y *= sMul;
      }
    }
    e.pos.x += e.vel.x * dt;
    e.pos.y += e.vel.y * dt;

    if (e.burnUntil > t && e.burning > 0) {
      const burnDmg = e.burning * dt;
      e.hp -= burnDmg;
      if (Math.random() < 0.08) spawnDamageNumber(world, e.pos, burnDmg * 5, '#ff6f00');
    }
  }

  // ⭐ 메타 데미지 stack — meta.metaDmgStacks 당 +5% (50단계 = +250%)
  const dmgStacks = (state.meta as any).metaDmgStacks ?? 0;
  const dmgMul = 1 + dmgStacks * 0.05;

  // ── 발사체 이동 + 충돌 ──
  for (let i = world.projectiles.length - 1; i >= 0; i--) {
    const p = world.projectiles[i];
    p.life -= dt;
    if (p.life <= 0) { world.projectiles.splice(i, 1); continue; }

    // 적 발사체 처리 (shooter 가 쏜 것)
    if ((p as any).enemyShot) {
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      // ⭐ mirror_shard 반사 — 적 발사체가 거울에 닿으면 시안색 아군 발사체로 변환.
      let reflected = false;
      for (const prop of world.props) {
        if (prop.kind !== 'mirror_shard' || prop.destroyedAt) continue;
        const ddx = prop.pos.x - p.pos.x;
        const ddy = prop.pos.y - p.pos.y;
        const r = prop.radius + p.radius;
        if (ddx * ddx + ddy * ddy < r * r) {
          const ndx = -ddx, ndy = -ddy;
          const nd = Math.hypot(ndx, ndy) || 1;
          const nx = ndx / nd, ny = ndy / nd;
          p.pos.x = prop.pos.x + nx * (r + 1);
          p.pos.y = prop.pos.y + ny * (r + 1);
          const vdotn = p.vel.x * nx + p.vel.y * ny;
          p.vel.x -= 2 * vdotn * nx;
          p.vel.y -= 2 * vdotn * ny;
          (p as any).enemyShot = false;
          p.color = '#05d9e8';
          p.damage = (p as any).enemyDamage ?? 5;
          p.hitIds.clear();
          prop.hitFlashUntil = t + 80;
          events.push({ type: 'mirrorReflect', payload: { x: prop.pos.x, y: prop.pos.y } });
          reflected = true;
          break;
        }
      }
      if (reflected) continue;
      const pdx = world.player.pos.x - p.pos.x;
      const pdy = world.player.pos.y - p.pos.y;
      const r = world.player.radius + p.radius;
      if (pdx * pdx + pdy * pdy < r * r && world.player.invulnUntil <= t) {
        events.push({ type: 'playerHit', payload: { dmg: (p as any).enemyDamage ?? 5, kind: 'shooter' } });
        world.player.invulnUntil = t + 1400;
        world.player.hitFlashUntil = t + 350;
        world.player.staggerUntil = t + 200;
        world.slowMoUntil = t + 200;
        spawnDamageNumber(world, world.player.pos, 1, '#ff3366');
        world.projectiles.splice(i, 1);
      }
      continue;
    }

    // 호밍 — 적 우선 + 박스(파괴 가능 prop) fallback
    if (p.homing) {
      const tgt = nearestTarget(world, p.pos);
      if (tgt) {
        const dx = tgt.pos.x - p.pos.x;
        const dy = tgt.pos.y - p.pos.y;
        const d = Math.hypot(dx, dy) || 1;
        const speed = Math.hypot(p.vel.x, p.vel.y) || 200;
        p.vel.x += (dx / d) * speed * dt * 4;
        p.vel.y += (dy / d) * speed * dt * 4;
        const nv = Math.hypot(p.vel.x, p.vel.y);
        if (nv > 0) { p.vel.x = p.vel.x / nv * speed; p.vel.y = p.vel.y / nv * speed; }
      }
    }

    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;

    // trail 기록 (coin/orb 만)
    if (p.trail) {
      p.trail.push({ x: p.pos.x, y: p.pos.y });
      if (p.trail.length > 5) p.trail.shift();
    }

    // 적 충돌
    let dead = false;
    for (const e of world.enemies) {
      if (dead) break;
      if (e.hp <= 0 || e.spawning < 1) continue;
      if (p.hitIds.has(e.id)) continue;
      // 보스 무적 페이즈(소환 중) 동안 데미지 무효
      if (e === world.bossInstance && isBossInvuln(world, t)) continue;
      const dx = e.pos.x - p.pos.x;
      const dy = e.pos.y - p.pos.y;
      const r = e.radius + p.radius;
      if (dx * dx + dy * dy < r * r) {
        // ⭐ ruins 파괴 buff = 데미지 +40%
        const atkBuff = world.buffAtkUntil > t ? 1.4 : 1;
        const dmg = p.damage * dmgMul * atkBuff;
        e.hp -= dmg;
        e.hitFlashUntil = t + 80;
        p.hitIds.add(e.id);
        if (p.burnFor) { e.burning = Math.max(e.burning, dmg * 0.3); e.burnUntil = t + p.burnFor; }
        if (p.slowFor) { e.slowUntil = t + p.slowFor; }
        spawnDamageNumber(world, e.pos, dmg, p.color);
        events.push({ type: 'projectileHit', payload: { x: e.pos.x, y: e.pos.y, kind: p.kind } });
        if (p.pierce <= 0) { dead = true; }
        else p.pierce -= 1;
      }
    }

    // ⭐ Mirror Shard 반사 — 솔리드 + 발사체 반사. 적/플레이어 발사체 모두 반사.
    // 발사체 이동 후 mirror 와 충돌 검사 → 법선 기준 반사 + hitIds 클리어 (재히트 가능).
    if (!dead) {
      for (const prop of world.props) {
        if (prop.kind !== 'mirror_shard' || prop.destroyedAt) continue;
        const dx = prop.pos.x - p.pos.x;
        const dy = prop.pos.y - p.pos.y;
        const r = prop.radius + p.radius;
        if (dx * dx + dy * dy < r * r) {
          // 법선 = (p.pos - prop.pos) 정규화
          const ndx = -dx, ndy = -dy;
          const nd = Math.hypot(ndx, ndy) || 1;
          const nx = ndx / nd, ny = ndy / nd;
          // 발사체를 mirror 밖으로 밀어내기
          p.pos.x = prop.pos.x + nx * (r + 1);
          p.pos.y = prop.pos.y + ny * (r + 1);
          // 속도 반사 — v' = v - 2(v·n)n
          const vdotn = p.vel.x * nx + p.vel.y * ny;
          p.vel.x -= 2 * vdotn * nx;
          p.vel.y -= 2 * vdotn * ny;
          // 적 발사체가 반사되면 데미지 캐스터 뒤집기 — 적에게 데미지 줌
          if ((p as any).enemyShot) {
            (p as any).enemyShot = false;
            p.color = '#05d9e8'; // 시안으로 (아군 발사체 색)
            p.damage = (p as any).enemyDamage ?? 5;
          }
          // hitIds 리셋 (반사된 발사체는 같은 적/벽 재히트 가능)
          p.hitIds.clear();
          prop.hitFlashUntil = t + 80;
          events.push({ type: 'mirrorReflect', payload: { x: prop.pos.x, y: prop.pos.y } });
          // 반사 후 충돌 검사 종료
          break;
        }
      }
    }

    // ⭐ 박스(prop) 충돌 — destructible props 전체. wreck 는 점진 채굴 로직 분기.
    if (!dead) {
      for (const prop of world.props) {
        if (prop.hp <= 0 || prop.destroyedAt) continue;
        if (!DESTRUCTIBLE_KINDS.has(prop.kind)) continue;
        const propKey = prop.id + 100000;
        if (p.hitIds.has(propKey)) continue;
        const dx = prop.pos.x - p.pos.x;
        const dy = prop.pos.y - p.pos.y;
        const r = prop.radius + p.radius;
        if (dx * dx + dy * dy < r * r) {
          // ⭐ wreck 점진 채굴 (Coordination) — 1히트=heart, 2히트=코인, 3히트=파괴
          if (prop.kind === 'wreck') {
            prop.wreckHits = (prop.wreckHits ?? 0) + 1;
            prop.hitFlashUntil = t + 120;
            p.hitIds.add(propKey);
            if (prop.wreckHits === 1) {
              // 첫 히트 = heart 보장 + 작은 spark
              spawnPickup(world, 'heart', { ...prop.pos }, 1);
              spawnDamageNumber(world, prop.pos, 1, '#ff8866');
              events.push({ type: 'wreckScavenge', payload: { x: prop.pos.x, y: prop.pos.y, tier: 1 } });
            } else if (prop.wreckHits === 2) {
              // 둘째 히트 = 코인 3개
              for (let ci = 0; ci < 3; ci++) {
                const a = (ci / 3) * Math.PI * 2;
                spawnPickup(world, 'coin', { x: prop.pos.x + Math.cos(a) * 16, y: prop.pos.y + Math.sin(a) * 16 }, 8);
              }
              events.push({ type: 'wreckScavenge', payload: { x: prop.pos.x, y: prop.pos.y, tier: 2 } });
            } else {
              // 셋째 히트 = 완전 파괴 (큰 보상)
              destroyProp(world, prop, t, events, prop.kind);
            }
            if (p.pierce <= 0) { dead = true; break; }
            p.pierce -= 1;
            continue;
          }
          // ⭐ asteroid kinetic — 발사체 맞으면 발사체 방향으로 가속 (질량 보존).
          if (prop.kind === 'asteroid') {
            prop.hp -= p.damage;
            prop.hitFlashUntil = t + 120;
            p.hitIds.add(propKey);
            // 속도 임팩트 — 발사체 운동량을 운석에 전달.
            if (prop.vel) {
              const vmag = Math.hypot(p.vel.x, p.vel.y) || 1;
              const impulse = (p.damage * 4) / (prop.mass ?? 2);
              prop.vel.x += (p.vel.x / vmag) * impulse;
              prop.vel.y += (p.vel.y / vmag) * impulse;
              // 최대 속도 제한 (제어 가능성)
              const cap = 360;
              const sp = Math.hypot(prop.vel.x, prop.vel.y);
              if (sp > cap) { prop.vel.x = (prop.vel.x / sp) * cap; prop.vel.y = (prop.vel.y / sp) * cap; }
            }
            spawnDamageNumber(world, prop.pos, p.damage, p.color);
            events.push({ type: 'projectileHit', payload: { x: prop.pos.x, y: prop.pos.y, kind: p.kind } });
            if (prop.hp <= 0) destroyProp(world, prop, t, events, prop.kind);
            if (p.pierce <= 0) { dead = true; break; }
            p.pierce -= 1;
            continue;
          }
          // 일반 destructible (shrine/monolith/rocks/ruins/beacon/cursed_totem)
          // 적 발사체는 props 손상 X — 아군 친화적
          if ((p as any).enemyShot) continue;
          prop.hp -= p.damage;
          prop.hitFlashUntil = t + 120;
          p.hitIds.add(propKey);
          spawnDamageNumber(world, prop.pos, p.damage, p.color);
          events.push({ type: 'projectileHit', payload: { x: prop.pos.x, y: prop.pos.y, kind: p.kind } });
          // ⭐ monolith crack 검사 — 발사체로 HP 임계 도달 시 즉시 보상.
          if (prop.kind === 'monolith' && prop.crackStops && (prop.monolithCracks ?? 0) < prop.crackStops.length) {
            const idx = prop.monolithCracks ?? 0;
            if (prop.hp <= prop.crackStops[idx]) {
              prop.monolithCracks = idx + 1;
              for (let ci = 0; ci < 4; ci++) {
                const ang = (ci / 4) * Math.PI * 2 + Math.random();
                spawnPickup(world, 'coin', {
                  x: prop.pos.x + Math.cos(ang) * 18,
                  y: prop.pos.y + Math.sin(ang) * 18,
                }, 8);
              }
              if (idx === prop.crackStops.length - 1) {
                spawnPickup(world, 'gem', { x: prop.pos.x, y: prop.pos.y }, 1);
              }
              events.push({ type: 'monolithCrack', payload: { x: prop.pos.x, y: prop.pos.y, tier: idx + 1 } });
            }
          }
          if (prop.hp <= 0) destroyProp(world, prop, t, events, prop.kind);
          if (p.pierce <= 0) { dead = true; break; }
          p.pierce -= 1;
        }
      }
    }

    if (dead) { world.projectiles.splice(i, 1); }
  }

  // ── 영역 효과 적용 ──
  for (let i = world.areaEffects.length - 1; i >= 0; i--) {
    const a = world.areaEffects[i];
    a.life -= dt;
    if (a.life <= 0) { world.areaEffects.splice(i, 1); continue; }
    if (a.followPlayer) {
      if (a.orbitAngle != null && a.orbitRadius != null && a.orbitSpeed != null) {
        a.orbitAngle += a.orbitSpeed * dt;
        a.pos.x = world.player.pos.x + Math.cos(a.orbitAngle) * a.orbitRadius;
        a.pos.y = world.player.pos.y + Math.sin(a.orbitAngle) * a.orbitRadius;
      } else {
        a.pos.x = world.player.pos.x;
        a.pos.y = world.player.pos.y;
      }
    }
    for (const e of world.enemies) {
      if (e.hp <= 0 || e.spawning < 1) continue;
      if (e === world.bossInstance && isBossInvuln(world, t)) continue;
      const dx = e.pos.x - a.pos.x;
      const dy = e.pos.y - a.pos.y;
      const rr = (e.radius + a.radius) * (e.radius + a.radius);
      if (dx * dx + dy * dy < rr) {
        const last = a.lastHit.get(e.id) ?? 0;
        if (t - last >= a.hitInterval) {
          a.lastHit.set(e.id, t);
          const atkBuff = world.buffAtkUntil > t ? 1.4 : 1;
          const dmg = a.damage * dmgMul * atkBuff;
          e.hp -= dmg;
          e.hitFlashUntil = t + 80;
          spawnDamageNumber(world, e.pos, dmg, a.color);
          if (a.slowFactor < 1) { e.slowUntil = t + 0.4; }
          if (a.burnDps) { e.burning = Math.max(e.burning, a.burnDps * dmgMul); e.burnUntil = t + 1; }
        }
      }
    }
  }

  // ── 처치 처리 ──
  for (let i = world.enemies.length - 1; i >= 0; i--) {
    const e = world.enemies[i];
    if (e.hp <= 0) {
      world.enemies.splice(i, 1);
      world.enemyKills += 1;
      // 죽음 애니메이션
      spawnDeadAnim(world, e.pos, e.color, e.radius);
      if (e === world.bossInstance) {
        world.bossInstance = null;
        events.push({ type: 'bossKill', payload: { x: e.pos.x, y: e.pos.y, coinDrop: e.coinDrop } });
      }
      // ⭐ 웨이브 마지막 5초 — 픽업 폭우 (코인 2x + 추가 코인 1개). 카드 픽 직전 텐션 + 보상.
      const tensionPhase = state.waveTimeRemaining > 0 && state.waveTimeRemaining <= 5 && (state.phase === 'playing' || state.phase === 'boss');
      const coinMul = (tensionPhase ? 2 : 1) * world.beaconBoostMul;  // ⭐ beacon +50%
      // 코인 + xp 드랍
      spawnPickup(world, 'coin', e.pos, e.coinDrop * coinMul);
      if (e.xpDrop > 0) spawnPickup(world, 'xp', { x: e.pos.x + (rng() - 0.5) * 12, y: e.pos.y + (rng() - 0.5) * 12 }, e.xpDrop);
      // 텐션 페이즈 — 추가 코인 1개 (작은 보너스)
      if (tensionPhase) {
        spawnPickup(world, 'coin', { x: e.pos.x + (rng() - 0.5) * 24, y: e.pos.y + (rng() - 0.5) * 24 }, Math.ceil(e.coinDrop * 0.5));
      }
      // ⭐ Elite 적 — 추가 보상 (보석 1 + 보장된 chest 1 + 추가 코인 5개 폭우)
      if (e.elite) {
        spawnPickup(world, 'gem', e.pos, 1);
        spawnPickup(world, 'chest', { x: e.pos.x + 16, y: e.pos.y }, 1);
        for (let bi = 0; bi < 5; bi++) {
          const ang = (bi / 5) * Math.PI * 2;
          spawnPickup(world, 'coin', {
            x: e.pos.x + Math.cos(ang) * 24, y: e.pos.y + Math.sin(ang) * 24,
          }, Math.ceil(e.coinDrop * 0.3));
        }
        // 빨간 폭발 시각
        spawnAreaEffect(world, {
          pos: { ...e.pos }, radius: 100, damage: 0, life: 0.25,
          color: '#ff0044', followPlayer: false, kind: 'nova', slowFactor: 1, hitInterval: 1,
        });
      }
      // 특수 픽업 (작은 확률 + 강한 적일수록 ↑)
      const luck = e.elite ? 0.7 : e.hpMax >= 30 ? 0.5 : e.hpMax >= 10 ? 0.18 : 0.02;
      const r = rng();
      if (r < luck * 0.4) spawnPickup(world, 'heart', e.pos, 1);
      // ⭐ 자석 픽업 W5+ 잠금 — 초반에 자석이 OP면 이동 의사결정이 사라진다 (research).
      else if (r < luck * 0.6 && state.wave >= 5) spawnPickup(world, 'magnet', e.pos, 1);
      else if (r < luck * 0.8) spawnPickup(world, 'bomb', e.pos, 1);
      else if (r < luck) spawnPickup(world, 'chest', e.pos, 1);
      // 콤보(처치 streak)
      if (t - world.lastKillTime < 0.5) world.killStreak += 1;
      else world.killStreak = 1;
      world.lastKillTime = t;
      events.push({ type: 'enemyKill', payload: { x: e.pos.x, y: e.pos.y, coin: e.coinDrop, kind: e.kind, streak: world.killStreak, elite: !!e.elite } });
    }
  }

  // ── 플레이어 ↔ 적 충돌 (피격) ──
  // 넉백 제거 — 무적 1.4초 + 적은 가볍게 밀려남 + 짧은 stagger 비주얼만
  const tMs = t;
  if (world.player.invulnUntil <= tMs) {
    for (const e of world.enemies) {
      const dx = e.pos.x - world.player.pos.x;
      const dy = e.pos.y - world.player.pos.y;
      const r = e.radius + world.player.radius;
      if (dx * dx + dy * dy < r * r) {
        events.push({ type: 'playerHit', payload: { dmg: e.damage, kind: e.kind } });
        world.player.invulnUntil = tMs + 1400;
        world.player.hitFlashUntil = tMs + 350;
        world.player.staggerUntil = tMs + 200;
        const d = Math.hypot(dx, dy) || 1;
        world.player.staggerDir = { x: -(dx / d), y: -(dy / d) };
        // 적만 살짝 밀려남 (충돌 풀림 — 플레이어 위치 고정)
        e.pos.x += (dx / d) * 30;
        e.pos.y += (dy / d) * 30;
        // 슬로우모션 200ms
        world.slowMoUntil = tMs + 200;
        // 큰 -1 ♥ 데미지 숫자
        spawnDamageNumber(world, world.player.pos, 1, '#ff3366');
        break;
      }
    }
  }

  // ⭐ 메타 자석 stack — meta.metaMagnetStacks 당 +5% 반경 (50단계 = +250%)
  const magnetStacks = (state.meta as any).metaMagnetStacks ?? 0;
  const magnetR = PICKUP_MAGNET_RADIUS * (1 + magnetStacks * 0.05);
  // ── 픽업 자석 + 수집 ──
  for (let i = world.pickups.length - 1; i >= 0; i--) {
    const p = world.pickups[i];
    const dx = world.player.pos.x - p.pos.x;
    const dy = world.player.pos.y - p.pos.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < magnetR) {
      const speed = 350 * (1 - d / magnetR) + 80;
      p.pos.x += (dx / d) * speed * dt;
      p.pos.y += (dy / d) * speed * dt;
    }
    if (d < PICKUP_PICK_RADIUS + p.radius) {
      if (p.kind === 'xp') {
        world.xp += p.value;
        while (world.xp >= world.xpForNext) {
          world.xp -= world.xpForNext;
          world.level += 1;
          world.xpForNext = Math.floor(world.xpForNext * 1.46);
          world.pendingLevelUps += 1;
        }
      } else if (p.kind === 'magnet') {
        // 모든 코인/XP 즉시 흡수
        for (const pp of world.pickups) {
          if (pp.kind === 'coin' || pp.kind === 'xp') {
            const ddx = world.player.pos.x - pp.pos.x;
            const ddy = world.player.pos.y - pp.pos.y;
            const dd = Math.hypot(ddx, ddy) || 1;
            pp.vel.x = (ddx / dd) * 800;
            pp.vel.y = (ddy / dd) * 800;
          }
        }
      } else if (p.kind === 'bomb') {
        // 화면상 모든 적 큰 데미지
        for (const e of world.enemies) {
          if (e.hp <= 0 || e.spawning < 1) continue;
          const ex = e.pos.x - world.player.pos.x;
          const ey = e.pos.y - world.player.pos.y;
          if (ex * ex + ey * ey < 600 * 600) {
            e.hp -= 999;
            e.hitFlashUntil = t + 100;
          }
        }
        spawnAreaEffect(world, {
          pos: { ...world.player.pos },
          radius: 600, damage: 1, life: 0.4, color: '#ffaa00',
          followPlayer: false, kind: 'nova', slowFactor: 1, hitInterval: 1,
        });
      } else if (p.kind === 'chest') {
        // 코인 50 + xp 30 + 1/3 확률 heart
        // (외부 dispatch 가 처리해야 하므로 이벤트 페이로드에 bonus 추가)
      }
      // heart 는 외부 dispatch 가 처리 (state.life += 1)
      events.push({ type: 'pickup', payload: { kind: p.kind, value: p.value, x: p.pos.x, y: p.pos.y } });
      world.pickups.splice(i, 1);
    }
  }

  // ── 데미지 숫자 애니 ──
  for (let i = world.damageNumbers.length - 1; i >= 0; i--) {
    const d = world.damageNumbers[i];
    d.life -= dt;
    if (d.life <= 0) { world.damageNumbers.splice(i, 1); continue; }
    d.pos.x += d.vel.x * dt;
    d.pos.y += d.vel.y * dt;
    d.vel.y += 240 * dt; // 중력
  }

  // ── 죽음 애니 ──
  for (let i = world.deadAnims.length - 1; i >= 0; i--) {
    const a = world.deadAnims[i];
    a.life -= dt;
    if (a.life <= 0) world.deadAnims.splice(i, 1);
  }

  // ── 자동 카메라 줌 — 적 밀도 기반 ──
  // ⭐ 기본 1.0 (개체는 이미 +30% 확대됨). 적 100+ 시만 점진 줌아웃.
  if (!world.bossInstance) {
    const n = world.enemies.length;
    let auto = 1;
    if (n >= 200) auto = 0.85;
    else if (n >= 120) auto = 0.92;
    else if (n >= 60) auto = 0.96;
    world.cameraZoomTarget = auto;
  }
  // 카메라 줌 lerp
  world.cameraZoom += (world.cameraZoomTarget - world.cameraZoom) * Math.min(1, dt * 4);

  return events;
}

export function nearestEnemy(world: World, pos: Vec, exclude?: Set<number>): Enemy | null {
  let best: Enemy | null = null;
  let bestD = Infinity;
  for (const e of world.enemies) {
    if (e.hp <= 0) continue;
    if (exclude?.has(e.id)) continue;
    const dx = e.pos.x - pos.x;
    const dy = e.pos.y - pos.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

/** 파괴 가능한 박스(prop) 중 가장 가까운 것. exclude 로 다중 발사 시 중복 회피. */
export function nearestDestructibleProp(world: World, pos: Vec, exclude?: Set<number>): WorldProp | null {
  let best: WorldProp | null = null;
  let bestD = Infinity;
  for (const p of world.props) {
    if (p.hp <= 0 || p.destroyedAt) continue;
    if (p.kind !== 'shrine' && p.kind !== 'wreck' && p.kind !== 'asteroid') continue;
    if (exclude?.has(p.id)) continue;
    const dx = p.pos.x - pos.x;
    const dy = p.pos.y - pos.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

/**
 * 무기/호밍 발사체의 통합 타겟 검색.
 * 사용자 피드백 (2026-05-07): 박스를 우선시하지 말고, 박스 포함해서 진짜 가까운 대상을 타겟으로.
 * → 박스/적 거리만 비교해 더 가까운 쪽 반환. 동률이면 적 우선(처치 보상이 더 가치 있음).
 *
 * 반환값에 kind/id 가 포함되므로 호출자가 다중 발사 시 중복 타겟 회피에 사용 가능.
 */
export type NearestTarget =
  | { kind: 'enemy'; id: number; pos: Vec; radius: number }
  | { kind: 'prop'; id: number; pos: Vec; radius: number };

export function nearestTarget(
  world: World,
  pos: Vec,
  enemyExclude?: Set<number>,
  propExclude?: Set<number>,
): NearestTarget | null {
  const enemy = nearestEnemy(world, pos, enemyExclude);
  const prop = nearestDestructibleProp(world, pos, propExclude);
  let dEnemy = Infinity, dProp = Infinity;
  if (enemy) {
    const dx = enemy.pos.x - pos.x, dy = enemy.pos.y - pos.y;
    dEnemy = dx * dx + dy * dy;
  }
  if (prop) {
    const dx = prop.pos.x - pos.x, dy = prop.pos.y - pos.y;
    dProp = dx * dx + dy * dy;
  }
  if (!enemy && !prop) return null;
  if (dEnemy <= dProp) return { kind: 'enemy', id: enemy!.id, pos: enemy!.pos, radius: enemy!.radius };
  return { kind: 'prop', id: prop!.id, pos: prop!.pos, radius: prop!.radius };
}

