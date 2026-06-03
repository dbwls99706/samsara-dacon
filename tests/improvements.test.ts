// 2026-05-07 세션 개선 사항 회귀 테스트
//  - ultimate OPS 라우팅 (fire7/ice7/gold7/chaos7/echo7)
//  - forceNextCardRarity → drawCards 반영
//  - invertEffectsChance + chance 게이팅
//  - 보스 패턴 FSM (attachBossRuntime / stepBossPattern 페이즈 전이)

import { beforeEach, describe, expect, it } from 'vitest';
import {
  OPS,
  allCards,
  drawCards,
  getSynergy,
  newGameState,
  setRngSeed,
} from '../src/game/cards';
import { reduce } from '../src/game/state';
import { attachBossRuntime, stepBossPattern, isBossInvuln, type FsmEvent } from '../src/game/bossPatterns';
import { createWorld, spawnBoss } from '../src/game/world';
import type { EngineEvent, TriggerContext } from '../src/game/types';

beforeEach(() => setRngSeed(42));

describe('ultimate OPS 라우팅', () => {
  function ctxFor(state: ReturnType<typeof newGameState>, emit: (e: EngineEvent) => void): TriggerContext {
    return { trigger: 'onSynergy', state, emit, dispatch: () => {} };
  }

  it('fire7 ultimate → addCoins 1B', () => {
    const s = newGameState();
    const evs: EngineEvent[] = [];
    const syn = getSynergy('fire7')!;
    OPS.ultimate(syn.effects[0], ctxFor(s, e => evs.push(e)));
    expect(s.coins).toBe(1_000_000_000);
    expect(evs.find(e => e.type === 'TEXT_BANNER' && e.text === 'ADDCOINS')).toBeTruthy();
  });

  it('ice7 ultimate → TIME_FREEZE 이벤트 발행', () => {
    const s = newGameState();
    const evs: EngineEvent[] = [];
    const syn = getSynergy('ice7')!;
    OPS.ultimate(syn.effects[0], ctxFor(s, e => evs.push(e)));
    const tf = evs.find(e => e.type === 'TIME_FREEZE');
    expect(tf).toBeTruthy();
    if (tf && tf.type === 'TIME_FREEZE') expect(tf.duration).toBe(3);
  });

  it('gold7 ultimate → addCoins 1M', () => {
    const s = newGameState();
    const evs: EngineEvent[] = [];
    const syn = getSynergy('gold7')!;
    OPS.ultimate(syn.effects[0], ctxFor(s, e => evs.push(e)));
    expect(s.coins).toBe(1_000_000);
  });

  it('echo7 ultimate → crossTriggerAllCards 호출 (카드 0장이면 no-op)', () => {
    const s = newGameState();
    const evs: EngineEvent[] = [];
    const syn = getSynergy('echo7')!;
    OPS.ultimate(syn.effects[0], ctxFor(s, e => evs.push(e)));
    // crossTriggerAllCards 는 보유카드 onTap 효과 디스패치 — 0장이면 안전 no-op
    expect(evs.find(e => e.type === 'TEXT_BANNER' && e.text === 'CROSSTRIGGERALLCARDS')).toBeTruthy();
  });

  it('알 수 없는 effect 라벨 → 1B 코인 fallback', () => {
    const s = newGameState();
    const evs: EngineEvent[] = [];
    OPS.ultimate({ op: 'ultimate', effect: 'doesNotExist' }, ctxFor(s, e => evs.push(e)));
    expect(s.coins).toBe(1_000_000_000);
    expect(evs.find(e => e.type === 'COIN_GAIN' && e.reason === 'ultimateFallback')).toBeTruthy();
  });
});

describe('forceNextCardRarity', () => {
  it('drawCards 의 3번째 인자 = 강제 등급', () => {
    const drawn = drawCards(3, undefined, 'legendary');
    expect(drawn).toHaveLength(3);
    expect(drawn.every(c => c.rarity === 'legendary')).toBe(true);
  });

  it('forceRarity 미지정 시 분포 기반 추첨 (회귀)', () => {
    const drawn = drawCards(20);
    // 20장 중 common 비중이 가장 높아야 (분포 ~65%)
    const common = drawn.filter(c => c.rarity === 'common').length;
    expect(common).toBeGreaterThan(8);
  });
});

describe('invertEffectsChance + chance 게이팅', () => {
  it('invertEffectsChance op → state.invertChance 세팅', () => {
    const s = newGameState();
    OPS.invertEffectsChance({ op: 'invertEffectsChance', chance: 0.7 }, {
      trigger: 'onSynergy', state: s, emit: () => {}, dispatch: () => {},
    });
    expect(s.invertChance).toBe(0.7);
  });

  it('invertChance 누적 — Math.max 만 갱신', () => {
    const s = newGameState();
    s.invertChance = 0.5;
    OPS.invertEffectsChance({ op: 'invertEffectsChance', chance: 0.3 }, {
      trigger: 'onSynergy', state: s, emit: () => {}, dispatch: () => {},
    });
    expect(s.invertChance).toBe(0.5); // 0.3 < 0.5 → 무시
  });

  it('tapMult 는 더이상 자체 chance 게이팅 X (runEffects 위임)', () => {
    const s = newGameState();
    s.tapMult = 10;
    OPS.tapMult({ op: 'tapMult', mult: 3, chance: 0 }, {
      trigger: 'onTap', state: s, emit: () => {}, dispatch: () => {},
    });
    expect(s.coins).toBe(30); // chance=0 무시 — 게이팅은 dispatcher 책임
  });

  it('extraCardChoice 도 자체 chance 게이팅 X', () => {
    const s = newGameState();
    OPS.extraCardChoice({ op: 'extraCardChoice', value: 1, chance: 0 }, {
      trigger: 'onSynergy', state: s, emit: () => {}, dispatch: () => {},
    });
    expect(s.extraCardChoiceCount).toBe(1);
  });
});

describe('보스 패턴 FSM', () => {
  it('attachBossRuntime — kind 별 패턴 풀', () => {
    const w = createWorld();
    const boss = spawnBoss(w, 0, 1, 'normal');
    const rt = attachBossRuntime(boss, 'normal');
    expect(rt.patternQueue).toEqual(['radial']);
    expect(rt.phase).toBe('idle');
    const mega = attachBossRuntime(boss, 'mega');
    expect(mega.patternQueue.length).toBe(2);
    const div = attachBossRuntime(boss, 'divine');
    expect(div.patternQueue.length).toBe(3);
  });

  it('isBossInvuln — invulnUntilT 만료 전/후', () => {
    const w = createWorld();
    spawnBoss(w, 0, 1, 'divine'); // bossRuntime 도 attach
    expect(w.bossRuntime).not.toBeNull();
    expect(isBossInvuln(w, 0)).toBe(false);
    w.bossRuntime!.invulnUntilT = 1000;
    expect(isBossInvuln(w, 500)).toBe(true);
    expect(isBossInvuln(w, 1500)).toBe(false);
  });

  it('stepBossPattern — radial 패턴 telegraph → active → recover → idle', () => {
    const w = createWorld();
    const boss = spawnBoss(w, 0, 1, 'normal');
    boss.spawning = 1; // 즉시 활성
    const rt = w.bossRuntime!;
    const evs: FsmEvent[] = [];

    // t=0: idle → telegraph (current='radial', phaseUntilT = 600)
    stepBossPattern(w, rt, 0.016, 0, evs);
    expect(rt.phase).toBe('telegraph');
    expect(rt.current).toBe('radial');
    expect(evs.find(e => e.type === 'bossTelegraph')).toBeTruthy();

    // t=700ms: telegraph 종료 → active + 발사체 8발
    const projBefore = w.projectiles.length;
    stepBossPattern(w, rt, 0.016, 700, evs);
    expect(rt.phase).toBe('active');
    expect(w.projectiles.length).toBe(projBefore + 8);
    expect(evs.find(e => e.type === 'bossRadial')).toBeTruthy();

    // t=1300ms: active 종료 → recover (+ wave2 발사체 8)
    stepBossPattern(w, rt, 0.016, 1300, evs);
    expect(rt.phase).toBe('recover');

    // t=2000ms: recover 종료 → idle
    stepBossPattern(w, rt, 0.016, 2000, evs);
    expect(rt.phase === 'idle' || rt.phase === 'telegraph').toBe(true); // idle 또는 다음 패턴 시작
  });

  it('stepBossPattern — summon 패턴 동안 invuln 활성', () => {
    const w = createWorld();
    const boss = spawnBoss(w, 0, 1, 'divine');
    boss.spawning = 1;
    const rt = w.bossRuntime!;
    // divine = ['summon','radial','charge'] — 첫 패턴 = summon
    const evs: FsmEvent[] = [];
    stepBossPattern(w, rt, 0.016, 0, evs); // telegraph 진입
    expect(rt.current).toBe('summon');

    // telegraph 종료 → active (소환 + invuln set)
    const enemyCountBefore = w.enemies.length;
    stepBossPattern(w, rt, 0.016, 800, evs);
    expect(rt.phase).toBe('active');
    expect(rt.invulnUntilT).toBeGreaterThan(800);
    expect(w.enemies.length).toBeGreaterThan(enemyCountBefore); // jab 부하 spawn
    expect(isBossInvuln(w, 1000)).toBe(true);
  });
});

describe('윤회 부활 카드 교체 (회귀 — 무기 재구축 버그 가드)', () => {
  it('부활 시 카드 개수는 불변·내용(id 시그니처)은 변경된다', () => {
    // Arrange — 같은 등급(common) 카드 4장 보유 + 부활 1회 가용, 잔여 생명 1
    const s = newGameState();
    const commons = allCards().filter(c => c.rarity === 'common');
    expect(commons.length).toBeGreaterThan(4); // 교체 풀이 존재해야 의미 있음
    s.cards = commons.slice(0, 4).map(c => ({ ...c }));
    s.reviveAvailable = 1;
    s.life = 1;
    const lenBefore = s.cards.length;
    const sigBefore = s.cards.map(c => c.id).slice().sort().join(',');

    // Act — 생명 0 → 부활 트리거 (BOSS_FAILED → handleLifeLoss)
    const after = reduce(s, { type: 'BOSS_FAILED' }).state;

    // Assert — 부활 소비 + 생명 복구 + 개수 불변 + 내용(시그니처) 변경
    //   ⚠ 개수 불변이라 과거 main.ts length 게이트는 무기 재구축을 못 했음. 이제 id 시그니처
    //   변화로 재구축되므로, '내용이 바뀐다'는 이 단언이 그 수정의 회귀 가드다.
    expect(after.reviveAvailable).toBe(0);
    expect(after.life).toBe(1);
    expect(after.cards.length).toBe(lenBefore);
    const sigAfter = after.cards.map(c => c.id).slice().sort().join(',');
    expect(sigAfter).not.toBe(sigBefore);
  });
});
