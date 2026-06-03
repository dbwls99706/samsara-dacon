// SAMSARA · 윤회 — 게임 런타임 싱글톤
//
// 엔진 + 월드 + 입력 + 무기를 한 자리에서 관리하는 컨트롤러.
// main.ts 의 글로벌 (window as any) 안티패턴 제거 — 모듈 export 만 사용.

import { Engine, dailySeed, loadMeta, saveMeta } from '../game/core.js';
import { applyWeapons, buildWeapons } from '../game/weapons.js';
import { isBossWave, bossKind } from '../game/boss.js';
import { createWorld, spawnBoss, spawnEnemy, tickWorld, type World } from '../game/world.js';
import { consumeDash, readInput } from '../game/input.js';
import type { GameState } from '../game/types.js';

export interface GameRuntime {
  engine: Engine;
  getWorld: () => World;
  rebuildWeapons: () => void;
  startNewWave: (wave: number) => void;
  newRun: () => void;
  tick: (dt: number, t: number) => ReturnType<typeof tickWorld> | [];
  getCharacter: () => 'tiger' | 'magpie' | 'dokkaebi' | 'gumiho' | 'dragon';
}

export function createGameRuntime(): GameRuntime {
  const meta = loadMeta() ?? {};
  const engine = new Engine({ seed: dailySeed(), meta });

  // 시작 보너스
  const s0 = engine.getState() as GameState;
  s0.life = 3 + s0.meta.startingLifeBonus;
  s0.lifeMax = 3 + s0.meta.startingLifeBonus;
  s0.coins = s0.meta.startingCoinsBonus;

  let world = createWorld();

  const getCharacter = () =>
    ((engine.getState().meta as any).character ?? 'tiger') as 'tiger' | 'magpie' | 'dokkaebi' | 'gumiho' | 'dragon';

  function rebuildWeapons() {
    world.weapons = buildWeapons(engine.getState().cards as any[], engine.getState() as GameState, getCharacter());
  }

  function startNewWave(wave: number) {
    if (wave === 1) {
      world = createWorld();
      // 환영 카드 (첫 사이클만)
      const choices = engine.drawCardChoices(1);
      if (choices[0]) engine.dispatch({ type: 'PICK_CARD', card: choices[0] });
    }
    if (isBossWave(wave)) {
      spawnBoss(world, performance.now(), 1 + wave * 0.24, bossKind(wave) ?? 'normal');
    }
    rebuildWeapons();
    engine.dispatch({ type: 'START_WAVE', wave });
    if (wave === 1) {
      // 즉시 5마리 — 첫 3초 임팩트
      const t = performance.now();
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const dist = 220;
        spawnEnemy(world, 'jab', t, {
          x: world.player.pos.x + Math.cos(angle) * dist,
          y: world.player.pos.y + Math.sin(angle) * dist,
        });
      }
    }
  }

  function newRun() {
    engine.newRun({ seed: dailySeed(), meta: engine.getState().meta });
    world = createWorld();
    saveMeta(engine.getState().meta);
  }

  function tick(dt: number, t: number) {
    const s = engine.getState();
    if (s.phase !== 'playing' && s.phase !== 'boss') return [];
    const input = readInput();
    const slowMo = world.slowMoUntil > t ? 0.35 : 1;
    const dash = consumeDash();
    return tickWorld(world, dt * slowMo, t, s, input, applyWeapons, dash);
  }

  return {
    engine,
    getWorld: () => world,
    rebuildWeapons,
    startNewWave,
    newRun,
    tick,
    getCharacter,
  };
}
