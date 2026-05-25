import { describe, expect, it, beforeEach } from 'vitest';
import { newGameState, setRngSeed } from '../src/game/cards';
import { reduce } from '../src/game/state';
import { applyWeapons, buildWeapons } from '../src/game/weapons';
import {
  createWorld,
  spawnBoss,
  spawnEnemy,
  spawnPickup,
  spawnProjectile,
  tickWorld,
  type World,
} from '../src/game/world';

beforeEach(() => setRngSeed(42));

function ready(): { world: World; state: ReturnType<typeof newGameState> } {
  const state = reduce(newGameState({}), { type: 'START_WAVE', wave: 1 }).state;
  const world = createWorld();
  world.weapons = buildWeapons([], state, 'tiger');
  return { world, state };
}

describe('createWorld', () => {
  it('초기 상태 — 적/발사체/픽업 비어 있음, 플레이어 풀 hp', () => {
    const w = createWorld();
    expect(w.enemies).toHaveLength(0);
    expect(w.projectiles).toHaveLength(0);
    expect(w.pickups).toHaveLength(0);
    expect(w.player.hp).toBe(w.player.hpMax);
    expect(w.level).toBe(1);
    expect(w.xp).toBe(0);
  });
});

describe('spawnEnemy — HP 스케일링', () => {
  it('hpScale 인자가 hp/hpMax 에 곱해진다', () => {
    const w = createWorld();
    const e1 = spawnEnemy(w, 'jab', 0);
    expect(e1.hp).toBe(1);
    const e2 = spawnEnemy(w, 'jab', 0, undefined, 2.5);
    expect(e2.hp).toBe(2.5);
    expect(e2.hpMax).toBe(2.5);
  });

  it('coinDrop 은 hpScale 에 따라 증가하되 2배까지만', () => {
    const w = createWorld();
    const e1 = spawnEnemy(w, 'wonwi', 0); // base coinDrop=3
    expect(e1.coinDrop).toBe(3);
    const e2 = spawnEnemy(w, 'wonwi', 0, undefined, 5); // 5x → cap 2x → 6
    expect(e2.coinDrop).toBe(6);
  });
});

describe('spawnBoss', () => {
  it('보스 1마리만 유지 — 중복 호출시 동일 instance', () => {
    const w = createWorld();
    const b1 = spawnBoss(w, 0, 1);
    const b2 = spawnBoss(w, 100, 1);
    expect(b1).toBe(b2);
    expect(w.bossInstance).toBe(b1);
  });
});

describe('spawnProjectile + spawnPickup', () => {
  it('coin/orb 발사체에 trail 배열 자동 부여', () => {
    const w = createWorld();
    const p = spawnProjectile(w, {
      pos: { x: 0, y: 0 }, vel: { x: 100, y: 0 }, radius: 5,
      damage: 10, life: 1, color: '#fff', kind: 'coin',
      pierce: 0, homing: false, bounces: 0,
    });
    expect(p.trail).toEqual([]);
  });

  it('bullet 발사체는 trail 없음', () => {
    const w = createWorld();
    const p = spawnProjectile(w, {
      pos: { x: 0, y: 0 }, vel: { x: 100, y: 0 }, radius: 5,
      damage: 10, life: 1, color: '#fff', kind: 'bullet',
      pierce: 0, homing: false, bounces: 0,
    });
    expect(p.trail).toBeUndefined();
  });

  it('spawnPickup — 픽업 추가', () => {
    const w = createWorld();
    spawnPickup(w, 'coin', { x: 10, y: 10 }, 1);
    expect(w.pickups).toHaveLength(1);
    expect(w.pickups[0].kind).toBe('coin');
  });
});

describe('tickWorld — 적 이동', () => {
  it('느린 적은 플레이어 쪽으로 이동', () => {
    const { world, state } = ready();
    const e = spawnEnemy(world, 'jab', 0, { x: 100, y: 0 });
    e.spawning = 1; // 스폰 텔레그래프 종료
    const beforeX = e.pos.x;
    tickWorld(world, 0.1, 100, state, { x: 0, y: 0 }, applyWeapons);
    expect(e.pos.x).toBeLessThan(beforeX);
  });

  it('플레이어와 충돌 시 playerHit 이벤트 (무적 풀린 상태)', () => {
    const { world, state } = ready();
    world.player.invulnUntil = 0;
    // 무기 비활성화 — 충돌 검증만
    world.weapons = [];
    const e = spawnEnemy(world, 'jab', 0, { x: 5, y: 0 });
    e.spawning = 1;
    e.hp = 999; // 무기에 안 죽도록
    const events = tickWorld(world, 0.01, 1000, state, { x: 0, y: 0 }, applyWeapons);
    const hit = events.find(ev => ev.type === 'playerHit');
    expect(hit).toBeDefined();
  });

  it('대시 중에는 무적', () => {
    const { world, state } = ready();
    world.player.invulnUntil = 0;
    const e = spawnEnemy(world, 'jab', 0, { x: 5, y: 0 });
    e.spawning = 1;
    tickWorld(world, 0.001, 100, state, { x: 1, y: 0 }, applyWeapons, true);
    expect(world.dashUntil).toBeGreaterThan(100);
    expect(world.player.invulnUntil).toBeGreaterThan(100);
  });
});

describe('tickWorld — 픽업 자석', () => {
  it('자석 반경 안의 픽업은 플레이어로 끌려옴', () => {
    const { world, state } = ready();
    spawnPickup(world, 'coin', { x: 50, y: 0 }, 1);
    const before = world.pickups[0].pos.x;
    tickWorld(world, 0.1, 100, state, { x: 0, y: 0 }, applyWeapons);
    expect(world.pickups[0].pos.x).toBeLessThan(before);
  });

  it('수집 반경 안의 픽업은 pickup 이벤트로 변환', () => {
    const { world, state } = ready();
    spawnPickup(world, 'coin', { x: 5, y: 0 }, 1);
    const events = tickWorld(world, 0.01, 100, state, { x: 0, y: 0 }, applyWeapons);
    const pickup = events.find(e => e.type === 'pickup');
    expect(pickup).toBeDefined();
    expect(world.pickups).toHaveLength(0);
  });
});

describe('tickWorld — XP/레벨업', () => {
  it('xp 누적이 xpForNext 도달하면 레벨업 + pendingLevelUps 증가', () => {
    const { world, state } = ready();
    world.xp = 0; world.xpForNext = 5; world.level = 1; world.pendingLevelUps = 0;
    spawnPickup(world, 'xp', { x: 5, y: 0 }, 10);
    tickWorld(world, 0.01, 100, state, { x: 0, y: 0 }, applyWeapons);
    expect(world.level).toBeGreaterThan(1);
    expect(world.pendingLevelUps).toBeGreaterThan(0);
  });
});

describe('tickWorld — 박스(prop) 발사체 충돌 (회귀)', () => {
  it('빠른 발사체가 prop 옆을 통과해도 충돌 등록 + hp 차감', () => {
    const { world, state } = ready();
    world.weapons = []; // 무기 자동 발사 차단
    // shrine 1개를 플레이어 앞에 배치
    world.props = [{
      id: 9999, kind: 'shrine', pos: { x: 60, y: 0 },
      radius: 30, hp: 50, hpMax: 50,
      rot: 0, size: 1, seed: 0, hitFlashUntil: 0, consumed: false, cooldown: 0,
    }];
    const before = world.props[0].hp;
    spawnProjectile(world, {
      pos: { x: 0, y: 0 }, vel: { x: 800, y: 0 }, radius: 6,
      damage: 25, life: 1, color: '#ffd700', kind: 'coin',
      pierce: 0, homing: false, bounces: 0,
    });
    tickWorld(world, 0.1, 1000, state, { x: 0, y: 0 }, applyWeapons);
    expect(world.props[0].hp).toBeLessThan(before);
  });

  it('non-piercing 발사체는 prop 적중 후 사라짐', () => {
    const { world, state } = ready();
    world.weapons = [];
    world.props = [{
      id: 8888, kind: 'asteroid', pos: { x: 60, y: 0 },
      radius: 25, hp: 100, hpMax: 100,
      rot: 0, size: 1, seed: 0, hitFlashUntil: 0, consumed: false, cooldown: 0,
    }];
    spawnProjectile(world, {
      pos: { x: 0, y: 0 }, vel: { x: 600, y: 0 }, radius: 5,
      damage: 5, life: 2, color: '#fff', kind: 'bullet',
      pierce: 0, homing: false, bounces: 0,
    });
    tickWorld(world, 0.1, 1000, state, { x: 0, y: 0 }, applyWeapons);
    expect(world.projectiles.length).toBe(0);
  });
});

describe('buildWeapons — 보너스 스킬 잠금해제', () => {
  it('echo 5장 시 전기 사슬(chain) 활성', async () => {
    const { getCard } = await import('../src/game/cards');
    const card = getCard('E01')!; // echo 단일태그 카드
    const ws = buildWeapons([card, card, card, card, card], newGameState({}), 'tiger');
    expect(ws.find(w => w.id === 'chain')).toBeDefined();
  });

  it('echo 4장 이하 시 전기 사슬 비활성', async () => {
    const { getCard } = await import('../src/game/cards');
    const card = getCard('E01')!;
    const ws = buildWeapons([card, card, card, card], newGameState({}), 'tiger');
    expect(ws.find(w => w.id === 'chain')).toBeUndefined();
  });

  it('6 태그 모두 1장 이상 시 수호 결계(shield) 활성', async () => {
    const { getCard } = await import('../src/game/cards');
    const tagCards = ['F01', 'I01', 'G01', 'T01', 'C01', 'E01']
      .map(id => getCard(id))
      .filter(Boolean) as any[];
    const ws = buildWeapons(tagCards, newGameState({}), 'tiger');
    expect(ws.find(w => w.id === 'shield')).toBeDefined();
  });
});
