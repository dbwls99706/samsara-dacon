import { describe, expect, it, beforeEach } from 'vitest';
import { newGameState, setRngSeed } from '../src/game/cards';
import { reduce, waveDuration, phaseFromWave } from '../src/game/state';
import type { GameState } from '../src/game/types';

beforeEach(() => setRngSeed(42));

function freshState(): GameState {
  return newGameState({});
}

describe('웨이브 시간 곡선', () => {
  it('W1 = 30s, W2 = 45s, W3+ = 60s', () => {
    expect(waveDuration(1)).toBe(30);
    expect(waveDuration(2)).toBe(45);
    expect(waveDuration(3)).toBe(60);
    expect(waveDuration(7)).toBe(60);
    expect(waveDuration(20)).toBe(60);
  });
});

describe('phaseFromWave', () => {
  it('1~3 = 발아, 4~8 = 개화, 9+ = 승천', () => {
    expect(phaseFromWave(1)).toBe(1);
    expect(phaseFromWave(3)).toBe(1);
    expect(phaseFromWave(4)).toBe(2);
    expect(phaseFromWave(8)).toBe(2);
    expect(phaseFromWave(9)).toBe(3);
  });
});

describe('START_WAVE — 웨이브 진입', () => {
  it('웨이브 시간이 곡선에 따라 설정', () => {
    const s0 = freshState();
    const { state: s1 } = reduce(s0, { type: 'START_WAVE', wave: 1 });
    // W1/2 모디파이어 풀은 blessing 전용. mod_extra_time(+5) 만이 waveTime 에 영향 (단일 +5).
    // 따라서 W1 baseline 30, 가능한 modifier extension 최대 +5 → 30~35 범위.
    expect(s1.waveTimeMax).toBeGreaterThanOrEqual(30);
    expect(s1.waveTimeMax).toBeLessThanOrEqual(35);
    expect(s1.waveTimeRemaining).toBe(s1.waveTimeMax);
    expect(s1.wave).toBe(1);

    const { state: s2 } = reduce(s1, { type: 'END_WAVE' });
    const { state: s3 } = reduce(s2, { type: 'START_WAVE', wave: 2 });
    // W2 도 blessing 풀. baseline 45, 가능 extension +5 → 45~50.
    expect(s3.waveTimeMax).toBeGreaterThanOrEqual(45);
    expect(s3.waveTimeMax).toBeLessThanOrEqual(50);
  });

  it('멱등성: 같은 웨이브로 즉시 재진입은 무시', () => {
    const s0 = freshState();
    const { state: s1 } = reduce(s0, { type: 'START_WAVE', wave: 1 });
    s1.coins = 100; // 중간 진행
    const { state: s2 } = reduce(s1, { type: 'START_WAVE', wave: 1 });
    // coins 가 0 으로 리셋되지 않고 보존되어야 한다 (재진입 무시)
    expect(s2.coins).toBe(100);
  });
});

describe('ENEMY_KILLED — 처치 보상 + 콤보', () => {
  it('streak 가 콤보로 매핑되고 코인 증가', () => {
    const s0 = freshState();
    const { state: s1 } = reduce(s0, { type: 'START_WAVE', wave: 1 });
    const { state: s2 } = reduce(s1, { type: 'ENEMY_KILLED', coins: 5, streak: 3 });
    expect(s2.combo).toBe(3);
    expect(s2.coins).toBeGreaterThanOrEqual(5);
  });

  it('콤보 임계값 도달 시 보너스 코인', () => {
    const s0 = freshState();
    const { state: s1 } = reduce(s0, { type: 'START_WAVE', wave: 1 });
    const { state: s2, events } = reduce(s1, { type: 'ENEMY_KILLED', coins: 1, streak: 10 });
    // 콤보 ×10 임계값 통과
    expect(s2.combo).toBe(10);
    const thresholdEvt = events.find(e => e.type === 'COMBO_THRESHOLD');
    expect(thresholdEvt).toBeDefined();
  });
});

describe('PICKUP — 픽업 종류별 효과', () => {
  it('heart → life +1 (lifeMax 까지)', () => {
    const s0 = freshState();
    const { state: s1 } = reduce(s0, { type: 'START_WAVE', wave: 1 });
    s1.life = 1; s1.lifeMax = 3;
    const { state: s2 } = reduce(s1, { type: 'PICKUP', kind: 'heart' });
    expect(s2.life).toBe(2);
  });

  it('chest → coins +50', () => {
    const s0 = freshState();
    const { state: s1 } = reduce(s0, { type: 'START_WAVE', wave: 1 });
    const before = s1.coins;
    const { state: s2 } = reduce(s1, { type: 'PICKUP', kind: 'chest' });
    expect(s2.coins).toBeGreaterThanOrEqual(before + 50);
  });

  it('coin xp 같은 SFX 분리 emit', () => {
    const s0 = freshState();
    const { state: s1 } = reduce(s0, { type: 'START_WAVE', wave: 1 });
    const { events: evCoin } = reduce(s1, { type: 'PICKUP', kind: 'coin', coins: 1 });
    const { events: evXp } = reduce(s1, { type: 'PICKUP', kind: 'xp' });
    const sfxCoin = evCoin.find(e => e.type === 'SFX') as any;
    const sfxXp = evXp.find(e => e.type === 'SFX') as any;
    expect(sfxCoin?.id).toBe('sfx_pickup_coin');
    expect(sfxXp?.id).toBe('sfx_pickup_xp');
  });
});

describe('PLAYER_HIT — 라이프 손실 + 콤보 끊김', () => {
  it('단발 피격으로 life -1, 콤보 0', () => {
    const s0 = freshState();
    const { state: s1 } = reduce(s0, { type: 'START_WAVE', wave: 1 });
    // START_WAVE 가 무작위 모디파이어 1+ 개를 적용. 시드 분포에 따라
    // negateFirstLifeLoss 모디파이어(cards.json mod_aegis 등)가 활성화될 수 있어
    // 본 케이스 (피격→life-1) 의 결정론을 위해 명시 false 리셋.
    s1.negateFirstLifeLoss = false;
    s1.combo = 25;
    const beforeLife = s1.life;
    const { state: s2 } = reduce(s1, { type: 'PLAYER_HIT', dmg: 1 });
    expect(s2.life).toBe(beforeLife - 1);
    expect(s2.combo).toBe(0);
  });

  it('negateFirstLifeLoss 가 활성이면 라이프 보존', () => {
    const s0 = freshState();
    const { state: s1 } = reduce(s0, { type: 'START_WAVE', wave: 1 });
    s1.negateFirstLifeLoss = true;
    const beforeLife = s1.life;
    const { state: s2 } = reduce(s1, { type: 'PLAYER_HIT', dmg: 1 });
    expect(s2.life).toBe(beforeLife);
    expect(s2.negateFirstLifeLoss).toBe(false);
  });
});
