// SAMSARA · 윤회 — 보스 패턴 FSM
//
// 단일 거대 적(world.bossInstance) 위에 얹는 행동 트리:
//  - normal (W5/15/30/40)  → radial 만
//  - mega   (W10/20/35)    → radial + charge 회전
//  - divine (W25/50/75)    → summon + radial + charge 회전
//
// 각 패턴은 (텔레그래프 ms → 실행 → 회복) 3단 페이즈.
// 텔레그래프 동안은 시각 경고만(즉살 방지). 실행 페이즈에서 발사체 / 부하 spawn / 돌진 vel.
// 회복 동안 보스 본체가 추격을 멈춘다 → 플레이어가 한숨 돌릴 틈.
//
// 시간 단위: 모두 performance.now() ms 기준 (tickWorld 의 t 인자와 동일).

import { rng } from './cards.js';
import type { Enemy, Vec, World } from './world.js';
import { spawnEnemy, spawnProjectile } from './world.js';
import type { BossKind } from './boss.js';

export type BossPatternId = 'summon' | 'charge' | 'radial';
export type BossPhase = 'idle' | 'telegraph' | 'active' | 'recover';

export interface TelegraphSpec {
  kind: 'beam' | 'ring' | 'circle';
  pos: Vec;
  dir?: Vec;
  len?: number;
  width?: number;
  radius?: number;
  ttl: number;     // 초 단위 잔여 시간 (렌더 페이드용)
  ttlMax: number;
  color: string;
}

export interface BossRuntime {
  perfMode: boolean;
  patternQueue: BossPatternId[];
  patternIdx: number;
  phase: BossPhase;
  phaseUntilT: number;                 // ms (performance.now())
  current: BossPatternId | null;
  telegraphData: TelegraphSpec[];
  invulnUntilT: number;                // ms
  chargeDir: Vec;                      // charge 패턴용
}

const PATTERN_POOL: Record<BossKind, BossPatternId[]> = {
  normal: ['radial'],
  mega:   ['radial', 'charge'],
  divine: ['summon', 'radial', 'charge'],
};

let _perfMode = false;
export function setBossPerfMode(on: boolean): void { _perfMode = on; }

export function attachBossRuntime(_boss: Enemy, kind: BossKind): BossRuntime {
  return {
    perfMode: _perfMode,
    patternQueue: [...PATTERN_POOL[kind]],
    patternIdx: 0,
    phase: 'idle',
    phaseUntilT: 0,
    current: null,
    telegraphData: [],
    invulnUntilT: 0,
    chargeDir: { x: 0, y: 0 },
  };
}

export function isBossInvuln(world: World, t: number): boolean {
  return !!world.bossRuntime && world.bossRuntime.invulnUntilT > t;
}

// ─────────────────────────── FSM 드라이버 ───────────────────────────

export interface FsmEvent {
  type: 'bossTelegraph' | 'bossSummon' | 'bossCharge' | 'bossRadial';
  payload: { x: number; y: number; pattern?: BossPatternId; count?: number };
}

export function stepBossPattern(world: World, rt: BossRuntime, dt: number, t: number, events: FsmEvent[]): void {
  const boss = world.bossInstance;
  if (!boss || boss.spawning < 1 || boss.hp <= 0) return;

  // perfMode 라이브 갱신 — 게임 중 FPS 회복 시 즉시 반영
  rt.perfMode = _perfMode;

  // 텔레그래프 잔여 시간 감소 (렌더 페이드)
  for (let i = rt.telegraphData.length - 1; i >= 0; i--) {
    rt.telegraphData[i].ttl -= dt;
    if (rt.telegraphData[i].ttl <= 0) rt.telegraphData.splice(i, 1);
  }

  if (rt.phase === 'idle') startNextPattern(world, rt, t, events);

  switch (rt.current) {
    case 'summon': stepSummon(world, rt, boss, t, events); break;
    case 'charge': stepCharge(world, rt, boss, t, events); break;
    case 'radial': stepRadial(world, rt, boss, t, events); break;
    default: break;
  }
}

function startNextPattern(world: World, rt: BossRuntime, t: number, events: FsmEvent[]) {
  const boss = world.bossInstance!;
  rt.current = rt.patternQueue[rt.patternIdx % rt.patternQueue.length];
  rt.patternIdx += 1;
  rt.phase = 'telegraph';

  const TELEGRAPH_MS = rt.current === 'radial' ? 600 : 700;
  rt.phaseUntilT = t + TELEGRAPH_MS;
  rt.invulnUntilT = 0;

  if (rt.current === 'summon') {
    rt.telegraphData = [{
      kind: 'circle', pos: { ...boss.pos }, radius: 90, ttl: 0.7, ttlMax: 0.7, color: '#d300c5',
    }];
  } else if (rt.current === 'charge') {
    const dx = world.player.pos.x - boss.pos.x;
    const dy = world.player.pos.y - boss.pos.y;
    const d = Math.hypot(dx, dy) || 1;
    rt.chargeDir = { x: dx / d, y: dy / d };
    rt.telegraphData = [{
      kind: 'beam', pos: { ...boss.pos }, dir: rt.chargeDir, len: 700, width: 28, ttl: 0.7, ttlMax: 0.7, color: '#ff2a6d',
    }];
  } else if (rt.current === 'radial') {
    rt.telegraphData = [{
      kind: 'ring', pos: { ...boss.pos }, radius: 70, ttl: 0.6, ttlMax: 0.6, color: '#ff2a6d',
    }];
  }

  events.push({ type: 'bossTelegraph', payload: { x: boss.pos.x, y: boss.pos.y, pattern: rt.current ?? undefined } });
}

function finishPattern(rt: BossRuntime, _t: number) {
  rt.phase = 'idle';
  rt.current = null;
  rt.invulnUntilT = 0;
  // 텔레그래프는 자연 페이드 — splice 하지 않음
}

// ── 패턴 1: 소환 — 4 부하 spawn, 본체 잠시 무적 ──
function stepSummon(world: World, rt: BossRuntime, boss: Enemy, t: number, events: FsmEvent[]) {
  if (rt.phase === 'telegraph') {
    boss.vel.x = 0; boss.vel.y = 0;
    if (t >= rt.phaseUntilT) {
      const count = rt.perfMode ? 2 : 4;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + rng() * 0.3;
        const px = boss.pos.x + Math.cos(a) * 80;
        const py = boss.pos.y + Math.sin(a) * 80;
        spawnEnemy(world, 'jab', t, { x: px, y: py }, 0.8);
      }
      rt.invulnUntilT = t + 2200;          // 활성 + 회복 동안 무적
      rt.phase = 'active';
      rt.phaseUntilT = t + 200;
      events.push({ type: 'bossSummon', payload: { x: boss.pos.x, y: boss.pos.y, count } });
    }
  } else if (rt.phase === 'active' && t >= rt.phaseUntilT) {
    rt.phase = 'recover';
    rt.phaseUntilT = t + 1500;
  } else if (rt.phase === 'recover' && t >= rt.phaseUntilT) {
    finishPattern(rt, t);
  }
}

// ── 패턴 2: 돌진 — 텔레그래프 빔 후 직선 6배속 1.2초 ──
function stepCharge(world: World, rt: BossRuntime, boss: Enemy, t: number, events: FsmEvent[]) {
  if (rt.phase === 'telegraph') {
    boss.vel.x = 0; boss.vel.y = 0;
    // 텔레그래프 빔의 시작점은 보스 위치, 방향은 시작 시점의 chargeDir 고정
    if (rt.telegraphData[0]) rt.telegraphData[0].pos = { ...boss.pos };
    if (t >= rt.phaseUntilT) {
      rt.phase = 'active';
      rt.phaseUntilT = t + 1200;
      events.push({ type: 'bossCharge', payload: { x: boss.pos.x, y: boss.pos.y } });
    }
  } else if (rt.phase === 'active') {
    boss.vel.x = rt.chargeDir.x * boss.speed * 6;
    boss.vel.y = rt.chargeDir.y * boss.speed * 6;
    if (t >= rt.phaseUntilT) {
      rt.phase = 'recover';
      rt.phaseUntilT = t + 500;
    }
  } else if (rt.phase === 'recover') {
    boss.vel.x *= 0.85;
    boss.vel.y *= 0.85;
    if (t >= rt.phaseUntilT) finishPattern(rt, t);
  }
}

// ── 패턴 3: 링형 탄막 — 8발 + 위상 시프트 8발 (perfMode 시 wave 2 스킵) ──
function stepRadial(world: World, rt: BossRuntime, boss: Enemy, t: number, events: FsmEvent[]) {
  if (rt.phase === 'telegraph') {
    boss.vel.x *= 0.4; boss.vel.y *= 0.4;
    if (rt.telegraphData[0]) rt.telegraphData[0].pos = { ...boss.pos };
    if (t >= rt.phaseUntilT) {
      fireRing(world, boss, 8, 0);
      rt.phase = 'active';
      rt.phaseUntilT = t + 500;
      events.push({ type: 'bossRadial', payload: { x: boss.pos.x, y: boss.pos.y } });
    }
  } else if (rt.phase === 'active' && t >= rt.phaseUntilT) {
    if (!rt.perfMode) fireRing(world, boss, 8, Math.PI / 8);
    rt.phase = 'recover';
    rt.phaseUntilT = t + 600;
  } else if (rt.phase === 'recover' && t >= rt.phaseUntilT) {
    finishPattern(rt, t);
  }
}

function fireRing(world: World, boss: Enemy, count: number, phaseOffset: number) {
  // 풀 포화 시 새 발사체 생략 (플레이어 발사체 우선)
  if (world.projectiles.length > 350) return;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + phaseOffset;
    const sp = spawnProjectile(world, {
      pos: { ...boss.pos },
      vel: { x: Math.cos(a) * 180, y: Math.sin(a) * 180 },
      radius: 8,
      damage: 0,
      life: 3,
      // ⭐ 5색 약속: 적/보스 발사체 = 빨강 (#ff3366). #ff2a6d (핑크) 는 내 fire 발사체용.
      color: '#ff3366',
      kind: 'orb',
      pierce: 99,
      homing: false,
      bounces: 0,
    });
    if (sp) {
      (sp as any).enemyShot = true;
      (sp as any).enemyDamage = boss.damage * 0.4;
      (sp as any).bossShot = true;
    }
  }
}
