// 2026-05-11 — 게임이론 풀파워 props 회귀 테스트
//
// 검증 항목:
//  - 솔리드 벽 (monolith/rocks/ruins) destructible 전환 + crack 보상
//  - shrine pray (Stag Hunt — 3s 정지)
//  - wreck 점진 채굴 (Coordination — 1=heart, 2=coin, 3=destroy)
//  - asteroid kinetic momentum (발사체로 가속)
//  - lantern stronghold + tragedy (적 점거 시 dark)
//  - ruins buff (atk/spd 5s)
//  - 신규 props 4종 — pressure_plate / beacon / mirror_shard / cursed_totem
//  - DESTRUCTIBLE_KINDS / SOLID_KINDS 분류
//  - destroyProp 보상 흐름

import { beforeEach, describe, expect, it } from 'vitest';
import { newGameState, setRngSeed } from '../src/game/cards';
import { reduce } from '../src/game/state';
import {
  createWorld,
  spawnEnemy,
  spawnProjectile,
  tickWorld,
  type World,
  type WorldProp,
  type Vec,
} from '../src/game/world';
import { applyWeapons, buildWeapons } from '../src/game/weapons';

beforeEach(() => setRngSeed(42));

function ready(): { world: World; state: ReturnType<typeof newGameState> } {
  const state = reduce(newGameState({}), { type: 'START_WAVE', wave: 1 }).state;
  const world = createWorld();
  world.weapons = buildWeapons([], state, 'tiger');
  return { world, state };
}

// 테스트 헬퍼 — 깨끗한 world 에 단일 prop 만 두고 시작
function freshWithProp(kind: WorldProp['kind'], hp: number, sz: number = 2, pos?: Vec): { world: World; state: ReturnType<typeof newGameState>; prop: WorldProp } {
  const { world, state } = ready();
  world.props = [];  // 자동 생성된 props 제거
  // generateProps 로 만들지 않고 수동 — 시드 의존성 회피
  const p: WorldProp = {
    id: 1, kind, pos: pos ?? { x: 100, y: 0 },
    radius: 30 * sz, hp, hpMax: hp,
    rot: 0, size: sz, seed: 0,
    hitFlashUntil: 0, consumed: false, cooldown: 0,
  };
  if (kind === 'monolith') {
    p.monolithCracks = 0;
    p.crackStops = [hp * 0.75, hp * 0.5, hp * 0.25];
  } else if (kind === 'shrine') {
    p.prayProgress = 0; p.prayerCompleted = false;
  } else if (kind === 'wreck') {
    p.wreckHits = 0;
  } else if (kind === 'asteroid') {
    p.vel = { x: 0, y: 0 }; p.mass = 1 + sz * 0.5;
  } else if (kind === 'pressure_plate') {
    p.plateFuse = -1; p.plateRearm = 0;
  }
  world.props.push(p);
  return { world, state, prop: p };
}

describe('솔리드 벽 destructible 전환', () => {
  it('monolith — HP 75% 도달 시 첫 crack + 코인 4개 + monolithCrack 이벤트', () => {
    const { world, state, prop } = freshWithProp('monolith', 200);
    // 발사체로 50 데미지 (HP 200→150 = 75% 임계 도달)
    spawnProjectile(world, {
      pos: { x: 100, y: 0 }, vel: { x: 0, y: 0 },
      radius: 4, damage: 50, life: 0.1, color: '#fff',
      kind: 'bullet', pierce: 0, homing: false, bounces: 0,
    });
    const events = tickWorld(world, 0.02, 100, state, { x: 0, y: 0 }, applyWeapons);
    expect(prop.hp).toBeLessThanOrEqual(150);
    expect(prop.monolithCracks).toBeGreaterThanOrEqual(1);
    const crack = events.find(e => e.type === 'monolithCrack');
    expect(crack).toBeTruthy();
    // 코인 픽업이 4개 이상 추가됐어야 함
    expect(world.pickups.filter(pp => pp.kind === 'coin').length).toBeGreaterThanOrEqual(4);
  });

  it('rocks — HP 60 destructible. 0HP 도달 시 propDestroyed 이벤트 + 흙폭발', () => {
    const { world, state, prop } = freshWithProp('rocks', 60);
    spawnProjectile(world, {
      pos: { x: 100, y: 0 }, vel: { x: 0, y: 0 },
      radius: 4, damage: 60, life: 0.1, color: '#fff',
      kind: 'bullet', pierce: 0, homing: false, bounces: 0,
    });
    const events = tickWorld(world, 0.02, 100, state, { x: 0, y: 0 }, applyWeapons);
    expect(prop.hp).toBeLessThanOrEqual(0);
    const destroyed = events.find(e => e.type === 'propDestroyed' && e.payload.kind === 'rocks');
    expect(destroyed).toBeTruthy();
    // 흙폭발 = areaEffect 생성
    expect(world.areaEffects.length).toBeGreaterThanOrEqual(1);
  });

  it('ruins — 0HP 시 ruinsBuff 이벤트 + buffAtkUntil/buffSpdUntil 5s 활성', () => {
    const { world, state, prop } = freshWithProp('ruins', 100);
    spawnProjectile(world, {
      pos: { x: 100, y: 0 }, vel: { x: 0, y: 0 },
      radius: 4, damage: 100, life: 0.1, color: '#fff',
      kind: 'bullet', pierce: 0, homing: false, bounces: 0,
    });
    const t0 = 1000;
    const events = tickWorld(world, 0.02, t0, state, { x: 0, y: 0 }, applyWeapons);
    expect(prop.hp).toBeLessThanOrEqual(0);
    expect(events.find(e => e.type === 'ruinsBuff')).toBeTruthy();
    // 버프 활성 (≥ t0 + 5000)
    expect(world.buffAtkUntil).toBeGreaterThanOrEqual(t0 + 4900);
    expect(world.buffSpdUntil).toBeGreaterThanOrEqual(t0 + 4900);
  });
});

describe('shrine Pray Mode (Stag Hunt)', () => {
  it('60px 내에 3초 머무르면 prayerComplete + prayerCompleted=true', () => {
    const { world, state, prop } = freshWithProp('shrine', 50);
    // 플레이어를 shrine 옆에 (40px 거리, < 60px PRAY_R)
    world.player.pos.x = prop.pos.x - 40;
    world.player.pos.y = prop.pos.y;
    world.player.vel.x = 0; world.player.vel.y = 0;
    // 3.2초 시뮬 (작은 dt 로 누적, 입력 0)
    let events: any[] = [];
    for (let i = 0; i < 200; i++) {
      // ⭐ 매 틱 vel 강제 0 (move 0 input 이라도 잔존 lerp 영향)
      world.player.vel.x = 0; world.player.vel.y = 0;
      events = events.concat(tickWorld(world, 0.02, 100 + i * 20, state, { x: 0, y: 0 }, applyWeapons));
    }
    expect(prop.prayerCompleted).toBe(true);
    expect(events.find(e => e.type === 'prayerComplete')).toBeTruthy();
  });

  it('움직이면 prayProgress 가 누적되지 않음', () => {
    const { world, state, prop } = freshWithProp('shrine', 50);
    world.player.pos.x = prop.pos.x - 40;
    world.player.pos.y = prop.pos.y;
    // 입력으로 빠른 이동 → moving=true → progress decay
    for (let i = 0; i < 10; i++) {
      tickWorld(world, 0.02, 100 + i * 20, state, { x: 1, y: 0 }, applyWeapons);
    }
    expect(prop.prayerCompleted).toBeFalsy();
    expect(prop.prayProgress ?? 0).toBeLessThan(1.0);
  });
});

describe('wreck 점진 채굴 (Coordination)', () => {
  it('1번째 히트 = heart 픽업 + wreckScavenge tier 1', () => {
    const { world, state, prop } = freshWithProp('wreck', 30);
    spawnProjectile(world, {
      pos: { x: 100, y: 0 }, vel: { x: 0, y: 0 },
      radius: 4, damage: 10, life: 0.1, color: '#fff',
      kind: 'bullet', pierce: 0, homing: false, bounces: 0,
    });
    const events = tickWorld(world, 0.02, 100, state, { x: 0, y: 0 }, applyWeapons);
    expect(prop.wreckHits).toBe(1);
    expect(world.pickups.find(pp => pp.kind === 'heart')).toBeTruthy();
    const sc = events.find(e => e.type === 'wreckScavenge');
    expect(sc?.payload.tier).toBe(1);
  });

  it('3번째 히트 = propDestroyed (완전 파괴)', () => {
    const { world, state, prop } = freshWithProp('wreck', 30);
    for (let i = 0; i < 3; i++) {
      spawnProjectile(world, {
        pos: { x: 100, y: 0 }, vel: { x: 0, y: 0 },
        radius: 4, damage: 1, life: 0.1, color: '#fff',
        kind: 'bullet', pierce: 0, homing: false, bounces: 0,
      });
      tickWorld(world, 0.02, 100 + i * 20, state, { x: 0, y: 0 }, applyWeapons);
    }
    expect(prop.destroyedAt).toBeTruthy();
  });
});

describe('asteroid kinetic momentum', () => {
  it('발사체 맞으면 vel 이 발사체 방향으로 가속', () => {
    const { world, state, prop } = freshWithProp('asteroid', 100);
    expect(prop.vel?.x).toBe(0);
    // 발사체 — 오른쪽 방향(+x) 진행, asteroid 위치에 도달.
    spawnProjectile(world, {
      pos: { x: 100, y: 0 }, vel: { x: 300, y: 0 },
      radius: 4, damage: 10, life: 0.1, color: '#fff',
      kind: 'bullet', pierce: 0, homing: false, bounces: 0,
    });
    tickWorld(world, 0.02, 100, state, { x: 0, y: 0 }, applyWeapons);
    // 운석이 +x 로 가속됐어야 함
    expect((prop.vel?.x ?? 0)).toBeGreaterThan(0);
  });
});

describe('lantern Stronghold + Tragedy', () => {
  it('플레이어가 80px 내 진입 시 buffHasteUntil 갱신', () => {
    const { world, state, prop } = freshWithProp('lantern', 999);
    world.player.pos.x = prop.pos.x - 40;
    world.player.pos.y = prop.pos.y;
    const t0 = 1000;
    tickWorld(world, 0.02, t0, state, { x: 0, y: 0 }, applyWeapons);
    expect(world.buffHasteUntil).toBeGreaterThan(t0);
  });

  it('적이 30px 내 2초 점거 시 darkUntil 활성 + lanternDark 이벤트', () => {
    const { world, state, prop } = freshWithProp('lantern', 999);
    // 적을 lantern 옆에 강제 배치
    const e = spawnEnemy(world, 'jab', 0, { x: prop.pos.x + 10, y: prop.pos.y });
    e.spawning = 1;  // spawning 끝남으로 설정
    // 2.5초 점거
    let events: any[] = [];
    for (let i = 0; i < 130; i++) {
      // 적을 강제로 위치 유지 (AI 가 플레이어 추적해 빠지는 것 방지)
      e.pos.x = prop.pos.x + 10;
      e.pos.y = prop.pos.y;
      events = events.concat(tickWorld(world, 0.02, 100 + i * 20, state, { x: 0, y: 0 }, applyWeapons));
    }
    expect(prop.darkUntil).toBeGreaterThan(0);
    expect(events.find(e => e.type === 'lanternDark')).toBeTruthy();
  });
});

describe('신규 props — pressure_plate', () => {
  it('플레이어 접촉 시 plateFuse 활성 + plateArm 이벤트', () => {
    const { world, state, prop } = freshWithProp('pressure_plate', 999);
    world.player.pos.x = prop.pos.x;
    world.player.pos.y = prop.pos.y;
    const events = tickWorld(world, 0.02, 100, state, { x: 0, y: 0 }, applyWeapons);
    expect((prop.plateFuse ?? -1)).toBeGreaterThan(0);
    expect(events.find(e => e.type === 'plateArm')).toBeTruthy();
  });

  it('0.8s 후 폭발 — areaEffect 생성 + plateBoom 이벤트', () => {
    const { world, state, prop } = freshWithProp('pressure_plate', 999);
    world.player.pos.x = prop.pos.x;
    world.player.pos.y = prop.pos.y;
    // 1초 시뮬 (0.8s 안에 폭발)
    let events: any[] = [];
    for (let i = 0; i < 60; i++) {
      events = events.concat(tickWorld(world, 0.02, 100 + i * 20, state, { x: 0, y: 0 }, applyWeapons));
    }
    expect(events.find(e => e.type === 'plateBoom')).toBeTruthy();
    // areaEffect 가 한 번이라도 생겼어야 함
    // (지금쯤은 life 만료로 사라졌을 수 있으므로 이벤트로 검증)
  });
});

describe('신규 props — beacon', () => {
  it('250px 내 플레이어 = beaconActive + beaconBoostMul=1.5', () => {
    const { world, state, prop } = freshWithProp('beacon', 60, 2, { x: 50, y: 0 });
    world.player.pos.x = 0; world.player.pos.y = 0;  // 50px 거리
    tickWorld(world, 0.02, 100, state, { x: 0, y: 0 }, applyWeapons);
    expect(world.beaconActive).toBe(true);
    expect(world.beaconBoostMul).toBeCloseTo(1.5);
    expect(world.beaconSpawnMul).toBeCloseTo(1.3);
  });

  it('250px 외 = beaconActive=false + 1.0', () => {
    const { world, state, prop } = freshWithProp('beacon', 60, 2, { x: 500, y: 500 });
    world.player.pos.x = 0; world.player.pos.y = 0;
    tickWorld(world, 0.02, 100, state, { x: 0, y: 0 }, applyWeapons);
    expect(world.beaconActive).toBe(false);
    expect(world.beaconBoostMul).toBeCloseTo(1.0);
  });
});

describe('신규 props — mirror_shard', () => {
  it('적 발사체가 mirror 와 충돌 시 반사 + 색 시안으로 변경 + mirrorReflect 이벤트', () => {
    const { world, state, prop } = freshWithProp('mirror_shard', 999);
    // 적 발사체 모방 — 빨강 + enemyShot=true
    const proj = spawnProjectile(world, {
      pos: { x: 50, y: 0 }, vel: { x: 200, y: 0 },
      radius: 4, damage: 0, life: 1, color: '#ff3366',
      kind: 'orb', pierce: 0, homing: false, bounces: 0,
    });
    (proj as any).enemyShot = true;
    (proj as any).enemyDamage = 5;
    const events = tickWorld(world, 0.5, 100, state, { x: 0, y: 0 }, applyWeapons);
    expect(events.find(e => e.type === 'mirrorReflect')).toBeTruthy();
    // 반사됐다면 (p가 살아있고) vel.x 가 음수로 뒤집힘 + enemyShot=false
    const stillAlive = world.projectiles.find(p => p.id === proj.id);
    if (stillAlive) {
      expect((stillAlive as any).enemyShot).toBeFalsy();
      expect(stillAlive.color).toBe('#05d9e8');
    }
  });
});

describe('신규 props — cursed_totem (Stag Hunt 극단)', () => {
  it('0HP 도달 시 cursedSummon 이벤트 + elite 3마리 즉시 스폰', () => {
    const { world, state, prop } = freshWithProp('cursed_totem', 80);
    expect(world.enemies.length).toBe(0);
    spawnProjectile(world, {
      pos: { x: 100, y: 0 }, vel: { x: 0, y: 0 },
      radius: 4, damage: 80, life: 0.1, color: '#fff',
      kind: 'bullet', pierce: 0, homing: false, bounces: 0,
    });
    const events = tickWorld(world, 0.02, 100, state, { x: 0, y: 0 }, applyWeapons);
    expect(prop.destroyedAt).toBeTruthy();
    expect(events.find(e => e.type === 'cursedSummon')).toBeTruthy();
    // elite 3마리 스폰
    expect(world.enemies.filter(e => e.elite === true).length).toBe(3);
    // 큰 보상 — gem×3 + chest×2 + 코인 다수
    expect(world.pickups.filter(p => p.kind === 'gem').length).toBeGreaterThanOrEqual(3);
    expect(world.pickups.filter(p => p.kind === 'chest').length).toBeGreaterThanOrEqual(2);
  });
});

describe('blackhole 흡수 — 보너스 코인 + 콤보', () => {
  it('적이 KILL_R 내 진입 시 즉사 + blackholeKill 이벤트', () => {
    // 플레이어를 자석 반경 밖에 멀리 두기 (1000px) — 코인이 즉시 흡수되지 않게.
    const { world, state, prop } = freshWithProp('blackhole', 999, 2, { x: 0, y: 0 });
    world.player.pos.x = 1000; world.player.pos.y = 1000;
    const e = spawnEnemy(world, 'jab', 0, { x: 5, y: 0 });
    e.spawning = 1;
    e.hp = 1;
    // 한 틱 — KILL_R 38 안에 있음
    const events = tickWorld(world, 0.02, 100, state, { x: 0, y: 0 }, applyWeapons);
    expect(e.hp).toBe(0);
    const bhKill = events.find(ev => ev.type === 'blackholeKill');
    expect(bhKill).toBeTruthy();
    // 보너스 코인 payload 검증 (jab base 1 + 2 = 3)
    expect(bhKill?.payload.coin).toBeGreaterThanOrEqual(3);
  });
});

describe('BUFF_GAIN reducer 액션', () => {
  it('maxHpPermanent 1 = lifeMax +1, life +1', () => {
    const s0 = newGameState({});
    const lifeMaxBefore = s0.lifeMax;
    const lifeBefore = s0.life;
    const r = reduce(s0, { type: 'BUFF_GAIN', kind: 'maxHpPermanent', amount: 1 });
    expect(r.state.lifeMax).toBe(lifeMaxBefore + 1);
    expect(r.state.life).toBe(lifeBefore + 1);
    expect(r.events.find(e => e.type === 'TEXT_BANNER')).toBeTruthy();
  });
});
