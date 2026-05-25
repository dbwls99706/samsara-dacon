import { describe, expect, it, beforeEach } from 'vitest';
import {
  DATA,
  OPS,
  activeSynergies,
  allCards,
  dispatchTrigger,
  drawCards,
  evalCondition,
  evalRunIdentity,
  formatNum,
  getCard,
  getSynergy,
  newGameState,
  setRngSeed,
  tagCounts,
} from '../src/game/cards';
import type { EngineEvent } from '../src/game/types';

beforeEach(() => setRngSeed(42));

describe('데이터 적재', () => {
  it('카드 60장 + 비밀 5장 로딩', () => {
    expect(DATA.cards).toHaveLength(60);
    expect(DATA.secret_cards).toHaveLength(5);
  });

  it('시너지 18종 (6태그 × 3티어)', () => {
    expect(DATA.synergies).toHaveLength(18);
  });

  it('모디파이어 30종 (15+10+5)', () => {
    expect(DATA.modifiers).toHaveLength(30);
  });

  it('Run Identity 28종 (단일6 + 듀얼15 + 조화1 + 전설6)', () => {
    expect(DATA.run_identities.length).toBe(28);
  });

  it('카드 ID 검색', () => {
    expect(getCard('F01')?.tags).toContain('fire');
    expect(getCard('S01')).toBeDefined();
    expect(getCard('NONE')).toBeUndefined();
  });
});

describe('태그 / 시너지 / Run Identity 평가', () => {
  it('태그 갯수 카운트', () => {
    const cards = [getCard('F01')!, getCard('F02')!, getCard('I01')!];
    const counts = tagCounts(cards);
    expect(counts.fire).toBe(2);
    expect(counts.ice).toBe(1);
    expect(counts.gold).toBe(0);
  });

  it('🔥 3장 → fire3 시너지 활성', () => {
    const cards = [getCard('F01')!, getCard('F02')!, getCard('F03')!];
    const fired = activeSynergies(cards);
    expect(fired.map(s => s.id)).toContain('fire3');
    expect(fired.map(s => s.id)).not.toContain('fire5');
  });

  it('🔥 5장 → fire3 + fire5', () => {
    const cards = ['F01','F02','F03','F04','F05'].map(id => getCard(id)!);
    const ids = activeSynergies(cards).map(s => s.id);
    expect(ids).toContain('fire3');
    expect(ids).toContain('fire5');
    expect(ids).not.toContain('fire7');
  });

  it('🔥 7장 → fire3+5+7 모두', () => {
    const cards = ['F01','F02','F03','F04','F05','F06','F07'].map(id => getCard(id)!);
    const ids = activeSynergies(cards).map(s => s.id);
    expect(ids).toContain('fire3');
    expect(ids).toContain('fire5');
    expect(ids).toContain('fire7');
  });

  it('Run Identity — 5🔥 = 불의 황제', () => {
    const cards = ['F01','F02','F03','F04','F05'].map(id => getCard(id)!);
    const ri = evalRunIdentity(cards);
    expect(ri?.id).toBe('id_5fire');
    expect(ri?.name_ko).toBe('불의 황제');
  });

  it('Run Identity — 3🔥 + 3💰 = 황금 화염', () => {
    const cards = ['F01','F02','F03','G01','G02','G03'].map(id => getCard(id)!);
    const ri = evalRunIdentity(cards);
    expect(ri?.id).toBe('id_fg');
    expect(ri?.name_ko).toBe('황금 화염');
  });

  it('Run Identity — 7🔥 = 전설 (최우선)', () => {
    const cards = ['F01','F02','F03','F04','F05','F06','F07'].map(id => getCard(id)!);
    const ri = evalRunIdentity(cards);
    expect(ri?.id).toBe('id_7fire');
    expect(ri?.legendary).toBe(true);
  });
});

describe('조건 평가', () => {
  it('comboGte', () => {
    const s = newGameState();
    s.combo = 12;
    expect(evalCondition('comboGte:10', s)).toBe(true);
    expect(evalCondition('comboGte:20', s)).toBe(false);
  });

  it('remainingLte / lifeEq / noCards', () => {
    const s = newGameState();
    s.waveTimeRemaining = 4;
    s.life = 1;
    expect(evalCondition('remainingLte:5', s)).toBe(true);
    expect(evalCondition('lifeEq:1', s)).toBe(true);
    expect(evalCondition('noCards', s)).toBe(true);
  });
});

describe('OP 실행', () => {
  it('addCoins 기본', () => {
    const s = newGameState();
    const events: EngineEvent[] = [];
    OPS.addCoins({ op: 'addCoins', value: 50 }, {
      trigger: 'onTap', state: s, emit: e => events.push(e), dispatch: () => {},
    });
    expect(s.coins).toBe(50);
    expect(events.some(e => e.type === 'COIN_GAIN' && e.value === 50)).toBe(true);
  });

  it('extendWaveTime — 시간 연장 + 잔여시간 동시 증가', () => {
    const s = newGameState();
    s.waveTimeRemaining = 20;
    s.waveTimeMax = 30;
    OPS.extendWaveTime({ op: 'extendWaveTime', value: 5 }, {
      trigger: 'onWaveStart', state: s, emit: () => {}, dispatch: () => {},
    });
    expect(s.waveTimeMax).toBe(35);
    expect(s.waveTimeRemaining).toBe(25);
  });

  it('addLife — lifeMax 초과 X', () => {
    const s = newGameState();
    s.life = 3;
    s.lifeMax = 3;
    OPS.addLife({ op: 'addLife', value: 5 }, {
      trigger: 'onCardPicked', state: s, emit: () => {}, dispatch: () => {},
    });
    expect(s.life).toBe(3);
  });
});

describe('디스패치 통합', () => {
  it('F01(탭+1) 보유한 상태로 onTap 발생 시 코인 +1', () => {
    const s = newGameState();
    s.cards = [getCard('F01')!];
    const events: EngineEvent[] = [];
    dispatchTrigger(s, 'onTap', e => events.push(e), { x: 10, y: 20 });
    expect(s.coins).toBe(1);
    expect(events.some(e => e.type === 'COIN_GAIN')).toBe(true);
  });

  it('F02(탭+3) 추가 시 누적', () => {
    const s = newGameState();
    s.cards = [getCard('F01')!, getCard('F02')!];
    dispatchTrigger(s, 'onTap', () => {}, { x: 0, y: 0 });
    expect(s.coins).toBe(4);
  });

  it('extraTriggerCount 누적 시 효과 N+1회 반복', () => {
    const s = newGameState();
    s.cards = [getCard('F01')!];
    s.autoTriggerExtra = 2; // 1+2 = 3회
    dispatchTrigger(s, 'onTap', () => {}, {});
    expect(s.coins).toBe(3);
  });
});

describe('카드 풀 추첨', () => {
  it('drawCards 갯수 반환', () => {
    const drawn = drawCards(3);
    expect(drawn).toHaveLength(3);
  });

  it('잠금 해제 ID 만 추첨', () => {
    setRngSeed(1);
    const drawn = drawCards(10, ['F01']);
    expect(drawn.every(c => c.id === 'F01')).toBe(true);
  });
});

describe('숫자 포매팅', () => {
  it.each([
    [123, '123'],
    [1500, '1.5K'],
    [1_234_567, '1.2M'],
    [1.4e9, '1.4B'],
    [1.4e12, '1.4T'],
    [1.4e15, '1.4Q'],
    [1.4e18, '1.40e+18'],
  ])('%i → %s', (input, expected) => {
    expect(formatNum(input)).toBe(expected);
  });
});

describe('시너지 데이터 정합성', () => {
  it('각 태그별 3개 시너지 (3/5/7)', () => {
    const tags = ['fire','ice','gold','time','chaos','echo'] as const;
    for (const t of tags) {
      const sx = DATA.synergies.filter(s => s.tag === t);
      expect(sx).toHaveLength(3);
      expect(sx.map(s => s.tier).sort()).toEqual([3, 5, 7]);
    }
  });

  it('전설 카드 (legendary) 6장 = 각 태그 1장', () => {
    const legendaries = allCards().filter(c => c.rarity === 'legendary');
    expect(legendaries).toHaveLength(6);
  });
});
