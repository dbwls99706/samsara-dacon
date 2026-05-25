import { describe, expect, it, beforeEach } from 'vitest';
import {
  DATA,
  dispatchTrigger,
  getCard,
  newGameState,
  setRngSeed,
} from '../src/game/cards';
import type { EngineEvent, GameState } from '../src/game/types';

beforeEach(() => setRngSeed(42));

function emitNoop(_e: EngineEvent): void { /* discard */ }

function fresh(): GameState {
  return newGameState({});
}

/** 보유 카드 가져와서 state.cards 에 직접 푸시 (PICK_CARD 액션 없이 dispatcher 직접 검증용). */
function giveCard(state: GameState, id: string): void {
  const card = getCard(id);
  if (!card) throw new Error(`card not found: ${id}`);
  state.cards.push(card);
}

describe('onCardPicked 가드 (regression — 폭주 차단)', () => {
  it('22 회 픽업 후에도 I07 "결정" 의 buffAllCardEffects 가 1회만 발동되어 globalScoreMult ≈ 1.2 유지', () => {
    // Arrange: I07 만 보유. globalScoreMult 시작 1.
    const state = fresh();
    giveCard(state, 'I07');
    const before = state.globalScoreMult;

    // Act: 22 회 다른 카드 픽업 트리거. 본인 카드가 아니므로 발동 X 여야 함.
    for (let i = 0; i < 22; i++) {
      dispatchTrigger(state, 'onCardPicked', emitNoop, { data: { cardId: 'F01' } });
    }

    // Assert: globalScoreMult 가 변하지 않음 (본인 카드 픽업이 아니므로).
    expect(state.globalScoreMult).toBeCloseTo(before, 5);
  });

  it('I07 자기 자신이 픽업될 때만 globalScoreMult 가 정확히 1회 1.2 배 적용', () => {
    const state = fresh();
    giveCard(state, 'I07');
    const before = state.globalScoreMult;

    dispatchTrigger(state, 'onCardPicked', emitNoop, { data: { cardId: 'I07' } });

    expect(state.globalScoreMult).toBeCloseTo(before * 1.2, 5);
  });

  it('I02 "얼음 갑옷" addLife 가 다른 카드 픽업으로 누적되지 않음', () => {
    const state = fresh();
    giveCard(state, 'I02');
    const beforeLife = state.life;

    // 다른 카드 22번 픽업
    for (let i = 0; i < 22; i++) {
      dispatchTrigger(state, 'onCardPicked', emitNoop, { data: { cardId: 'F01' } });
    }

    // 라이프는 22 증가하지 않음. 본인 픽업 시만 +1 이 의도.
    expect(state.life).toBe(beforeLife);
  });

  it('F08 "화신" buffTagEffects 가 다른 카드 픽업으로 누적되지 않음', () => {
    const state = fresh();
    giveCard(state, 'F08');
    // fire 카드 1장 추가 (buffTagEffects 의 count 가 1 이상이어야 효과 발현)
    giveCard(state, 'F01');
    const before = state.globalScoreMult;

    // 다른 카드 픽업 22번 (F08 자체 픽업이 아니므로 발동 X)
    for (let i = 0; i < 22; i++) {
      dispatchTrigger(state, 'onCardPicked', emitNoop, { data: { cardId: 'I01' } });
    }

    // F08 의 onCardPicked 발동 0회 → globalScoreMult 변동 없음
    expect(state.globalScoreMult).toBeCloseTo(before, 5);
  });
});

describe('onAnyCardPicked 신 트리거 (디자이너 명시 매-픽업 발동)', () => {
  it('onAnyCardPicked 트리거를 가진 효과는 다른 카드 픽업 시에도 발동', () => {
    const state = fresh();
    // 임시로 onAnyCardPicked 효과 가진 카드를 직접 합성
    const fakeCard = {
      id: 'TEST_ANY',
      name_ko: 'TEST',
      name_en: 'TEST',
      tags: ['fire' as const],
      rarity: 'common' as const,
      effects: [{ trigger: 'onAnyCardPicked' as const, op: 'addCoins', value: 100 }],
    };
    state.cards.push(fakeCard);
    const before = state.coins;

    // 다른 카드 5회 픽업
    for (let i = 0; i < 5; i++) {
      dispatchTrigger(state, 'onCardPicked', emitNoop, { data: { cardId: 'F01' } });
    }

    // onAnyCardPicked 가 5번 발동 = +500 코인
    expect(state.coins).toBe(before + 500);
  });
});

describe('scoreMult floor 가드 (F10 페널티 폭락 차단)', () => {
  it('scoreMult 0.5 가 누적 적용되어도 coins 가 1 미만으로 떨어지지 않음', () => {
    const state = fresh();
    state.coins = 1_000_000;
    giveCard(state, 'F10');

    // 100 회 콤보 break — 페널티 chance 0.2 로 평균 20번 발동 가능
    for (let i = 0; i < 100; i++) {
      dispatchTrigger(state, 'onComboBreak', emitNoop);
    }

    expect(state.coins).toBeGreaterThanOrEqual(1);
  });

  it('F10 페널티의 chance 게이팅으로 실제 발동률은 ~20%', () => {
    const state = fresh();
    state.coins = 1e18; // 큰 수로 시작, 비율 측정
    giveCard(state, 'F10');

    let triggers = 0;
    const startCoins = state.coins;
    for (let i = 0; i < 500; i++) {
      const before = state.coins;
      dispatchTrigger(state, 'onComboBreak', emitNoop);
      if (state.coins !== before) triggers++;
    }

    // 500 회 × 0.2 = 100 회. 시드 고정이므로 결정적. ±50% 허용 (시드별 분산)
    expect(triggers).toBeGreaterThan(50);
    expect(triggers).toBeLessThan(150);
    expect(state.coins).toBeLessThan(startCoins);
  });
});

describe('F10 데이터 정합성', () => {
  it('F10 의 onComboBreak 페널티는 chance 0.2 게이팅을 가진다 (회귀 가드)', () => {
    const f10 = DATA.cards.find(c => c.id === 'F10');
    expect(f10).toBeDefined();
    const penalty = f10!.effects.find(e => e.trigger === 'onComboBreak' && e.op === 'scoreMult');
    expect(penalty).toBeDefined();
    expect(penalty!.chance).toBeCloseTo(0.2, 5);
  });
});
