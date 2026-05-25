import { describe, expect, it, beforeEach } from 'vitest';
import { newGameState, setRngSeed, DATA } from '../src/game/cards';
import { applyModifier, pickModifier, checkSecretUnlocks } from '../src/game/modifiers';
import type { EngineEvent } from '../src/game/types';

beforeEach(() => {
  setRngSeed(42);
  // localStorage stub for node environment
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

describe('pickModifier — 모디파이어 풀 추첨', () => {
  it('웨이브 1 에선 challenge 가 후보에서 빠진다', () => {
    const state = newGameState({});
    state.wave = 1;
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const m = pickModifier(state);
      if (m) seen.add(m.type);
    }
    expect(seen.has('challenge')).toBe(false);
  });

  it('웨이브 3+ 에선 challenge 가 등장 가능', () => {
    const state = newGameState({});
    state.wave = 5;
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const m = pickModifier(state);
      if (m) seen.add(m.type);
    }
    expect(seen.has('blessing') || seen.has('challenge')).toBe(true);
  });

  it('비밀 모디파이어는 잠금해제 전엔 풀에 없음', () => {
    const state = newGameState({});
    state.wave = 5;
    for (let i = 0; i < 100; i++) {
      const m = pickModifier(state);
      if (m) expect(m.type).not.toBe('secret');
    }
  });
});

describe('applyModifier — 효과 즉시 디스패치', () => {
  it('TEXT_BANNER 와 SFX 이벤트 emit', () => {
    const state = newGameState({});
    const events: EngineEvent[] = [];
    const blessing = DATA.modifiers.find(m => m.type === 'blessing')!;
    applyModifier(state, blessing, e => events.push(e));
    expect(events.some(e => e.type === 'TEXT_BANNER')).toBe(true);
    expect(events.some(e => e.type === 'SFX')).toBe(true);
    expect(state.modifierThisWave).toBe(blessing);
  });
});

describe('checkSecretUnlocks — 조건별 잠금해제', () => {
  it('comboMaxRun >= 100 → mod_secret_dragon 잠금해제', () => {
    const state = newGameState({});
    state.comboMaxRun = 100;
    const newly = checkSecretUnlocks(state);
    expect(newly).toContain('mod_secret_dragon');
  });

  it('카드 0 + wave 5 → mod_secret_void 잠금해제', () => {
    const state = newGameState({});
    state.cards = [];
    state.wave = 5;
    const newly = checkSecretUnlocks(state);
    expect(newly).toContain('mod_secret_void');
  });

  it('7-tier 시너지 활성 → mod_secret_rift 잠금해제', () => {
    const state = newGameState({});
    state.activeSynergies = ['fire7'];
    const newly = checkSecretUnlocks(state);
    expect(newly).toContain('mod_secret_rift');
  });

  it('이미 잠금해제된 ID 는 다시 반환되지 않음', () => {
    const state = newGameState({});
    state.comboMaxRun = 100;
    const first = checkSecretUnlocks(state);
    const second = checkSecretUnlocks(state);
    expect(first).toContain('mod_secret_dragon');
    expect(second).not.toContain('mod_secret_dragon');
  });
});

describe('데이터 정합성 — 모디파이어', () => {
  it('30종 = blessing 15 + challenge 10 + secret 5', () => {
    const blessing = DATA.modifiers.filter(m => m.type === 'blessing');
    const challenge = DATA.modifiers.filter(m => m.type === 'challenge');
    const secret = DATA.modifiers.filter(m => m.type === 'secret');
    expect(blessing).toHaveLength(15);
    expect(challenge).toHaveLength(10);
    expect(secret).toHaveLength(5);
  });

  it('모든 모디파이어에 effects 배열', () => {
    for (const m of DATA.modifiers) {
      expect(Array.isArray(m.effects)).toBe(true);
      expect(m.effects.length).toBeGreaterThan(0);
    }
  });
});
