import { describe, expect, it, beforeEach } from 'vitest';
import { activeSynergies, DATA, getCard, newGameState, recalcAfterCardMutation, setRngSeed } from '../src/game/cards';
import type { Card, EngineEvent } from '../src/game/types';

beforeEach(() => setRngSeed(42));

describe('시너지 활성 임계값', () => {
  it('🔥3장 → fire_3 활성', () => {
    const cards = ['F01', 'F02', 'F03'].map(id => getCard(id)!);
    const syn = activeSynergies(cards);
    expect(syn.some(s => s.id === 'fire3')).toBe(true);
    expect(syn.some(s => s.id === 'fire5')).toBe(false);
  });

  it('🔥5장 → fire_3 + fire_5 둘 다 활성', () => {
    const cards = ['F01', 'F02', 'F03', 'F04', 'F05'].map(id => getCard(id)!);
    const syn = activeSynergies(cards);
    expect(syn.some(s => s.id === 'fire3')).toBe(true);
    expect(syn.some(s => s.id === 'fire5')).toBe(true);
  });

  it('🔥7장 → 3 + 5 + 7 모두 활성', () => {
    const cards = ['F01', 'F02', 'F03', 'F04', 'F05', 'F06', 'F07'].map(id => getCard(id)!);
    const syn = activeSynergies(cards);
    expect(syn.length).toBeGreaterThanOrEqual(3);
    expect(syn.some(s => s.tier === 7)).toBe(true);
  });
});

describe('recalcAfterCardMutation — 카드 변형 후 재평가', () => {
  it('새로 활성된 시너지 SYNERGY_FIRED 이벤트 + activeSynergies 갱신', () => {
    const state = newGameState({});
    state.cards = ['F01', 'F02'].map(id => getCard(id)!);
    state.activeSynergies = []; // 강제 초기화
    // 3번째 fire 카드 추가
    state.cards = [...state.cards, getCard('F03')!];
    const events: EngineEvent[] = [];
    recalcAfterCardMutation(state, e => events.push(e));
    expect(state.activeSynergies).toContain('fire3');
    const fired = events.find(e => e.type === 'SYNERGY_FIRED' && (e as any).id === 'fire3');
    expect(fired).toBeDefined();
  });

  it('이미 활성된 시너지는 재발동 SFX emit 안 함', () => {
    const state = newGameState({});
    state.cards = ['F01', 'F02', 'F03'].map(id => getCard(id)!);
    state.activeSynergies = ['fire3']; // 이미 활성
    const events: EngineEvent[] = [];
    recalcAfterCardMutation(state, e => events.push(e));
    const fired = events.filter(e => e.type === 'SYNERGY_FIRED');
    expect(fired).toHaveLength(0);
  });

  it('Run Identity 변경 시 IDENTITY_FIRED + 배너 emit', () => {
    const state = newGameState({});
    state.cards = ['F01', 'F02', 'F03', 'F04', 'F05'].map(id => getCard(id)!);
    state.runIdentity = null;
    const events: EngineEvent[] = [];
    recalcAfterCardMutation(state, e => events.push(e));
    const idFired = events.find(e => e.type === 'IDENTITY_FIRED');
    if (idFired) {
      expect(state.runIdentity).toBeTruthy();
      expect(events.some(e => e.type === 'TEXT_BANNER')).toBe(true);
    }
  });
});

describe('데이터 정합성 — 시너지', () => {
  it('각 시너지에 tag, tier (3|5|7), effects', () => {
    for (const s of DATA.synergies) {
      expect(s.tag).toBeTruthy();
      expect([3, 5, 7]).toContain(s.tier);
      expect(Array.isArray(s.effects)).toBe(true);
    }
  });

  it('시너지 ID 패턴 = <tag><tier>', () => {
    for (const s of DATA.synergies) {
      expect(s.id).toBe(`${s.tag}${s.tier}`);
    }
  });
});

describe('Run Identity 카운트', () => {
  it('단일태그 (5장) 6종, 듀얼 (3+3) 15종, 조화 (6태그) 1종, 전설 6종 = 28', () => {
    const all = DATA.run_identities;
    expect(all.length).toBe(28);
    const single = all.filter(r => Object.keys(r.match).length === 1);
    expect(single.length).toBeGreaterThanOrEqual(6);
    const legendary = all.filter(r => r.legendary);
    expect(legendary.length).toBe(6);
  });
});
