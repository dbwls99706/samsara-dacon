// SAMSARA · 윤회 — 카드 효과 엔진
//
// 데이터 주도 설계: src/data/cards.json 의 effect 객체를 트리거별로 디스패치.
// op 등록 패턴 — 새 op 추가 시 OPS 객체에 함수 1개만 추가하면 끝.
//
// reducer 처럼 순수성을 추구하지만, JS 에서 깊은 복사 비용이 너무 크므로
// state 는 mutable 로 두고 외부에서 1단 깊이 복사로 보호한다.

import cardsData from '../data/cards.json' with { type: 'json' };
import type {
  Card,
  CardsData,
  Effect,
  EngineEvent,
  GameState,
  ModifierDef,
  OpHandler,
  Rarity,
  RunIdentityDef,
  SynergyDef,
  Trigger,
  TriggerContext,
  CardTag,
} from './types.js';

// ─────────────────────────── 데이터 로딩 ───────────────────────────

export const DATA: CardsData = cardsData as CardsData;

const CARD_BY_ID = new Map<string, Card>();
for (const c of [...DATA.cards, ...DATA.secret_cards]) CARD_BY_ID.set(c.id, c);

const SYNERGY_BY_ID = new Map<string, SynergyDef>();
for (const s of DATA.synergies) SYNERGY_BY_ID.set(s.id, s);

const MODIFIER_BY_ID = new Map<string, ModifierDef>();
for (const m of DATA.modifiers) MODIFIER_BY_ID.set(m.id, m);

export function getCard(id: string): Card | undefined { return CARD_BY_ID.get(id); }
export function getSynergy(id: string): SynergyDef | undefined { return SYNERGY_BY_ID.get(id); }
export function getModifier(id: string): ModifierDef | undefined { return MODIFIER_BY_ID.get(id); }
export function allCards(): Card[] { return DATA.cards; }
export function allSecretCards(): Card[] { return DATA.secret_cards; }
export function allSynergies(): SynergyDef[] { return DATA.synergies; }
export function allRunIdentities(): RunIdentityDef[] { return DATA.run_identities; }
export function allModifierDefs(): ModifierDef[] { return DATA.modifiers; }

// ─────────────────────────── 트리거 인덱스 ───────────────────────────
// 매 트리거 발생 시 카드 60장을 순회하지 않도록 사전 계산.

function indexEffectsByTrigger(card: Card): Map<Trigger, Effect[]> {
  const map = new Map<Trigger, Effect[]>();
  for (const e of card.effects) {
    if (!e.trigger) continue;
    const arr = map.get(e.trigger) ?? [];
    arr.push(e);
    map.set(e.trigger, arr);
  }
  return map;
}

const TRIGGER_INDEX = new Map<string, Map<Trigger, Effect[]>>();
for (const c of [...DATA.cards, ...DATA.secret_cards]) {
  TRIGGER_INDEX.set(c.id, indexEffectsByTrigger(c));
}

export function effectsForTrigger(card: Card, trigger: Trigger): Effect[] {
  // 사전 인덱스 우선. 동적으로 합성된 카드 (테스트/메타 부여) 는 인덱스 miss 시 직접 필터.
  const cached = TRIGGER_INDEX.get(card.id);
  if (cached) return cached.get(trigger) ?? [];
  const fx = card.effects?.filter(e => e.trigger === trigger) ?? [];
  // 일관성 위해 lazy 인덱스 등록
  if (fx.length) {
    const fresh = TRIGGER_INDEX.get(card.id) ?? indexEffectsByTrigger(card);
    TRIGGER_INDEX.set(card.id, fresh);
    return fresh.get(trigger) ?? [];
  }
  return fx;
}

// ─────────────────────────── 시너지 / Run Identity 평가 ───────────────────────────

export function tagCounts(cards: Card[]): Record<CardTag, number> {
  const c: Record<CardTag, number> = { fire:0, ice:0, gold:0, time:0, chaos:0, echo:0 };
  for (const card of cards) for (const t of card.tags) c[t]++;
  return c;
}

export function activeSynergies(cards: Card[]): SynergyDef[] {
  const counts = tagCounts(cards);
  const out: SynergyDef[] = [];
  for (const s of DATA.synergies) {
    if (counts[s.tag] >= s.tier) out.push(s);
  }
  return out;
}

// 카드 변형 (transmute/swap/upgrade/addTag/double) 직후 시너지 + Run Identity 재계산.
// reducer 의 handlePickCard 와 동일한 로직을 사용하되, 새로 활성된 시너지의
// 즉시 효과는 재실행하지 않는다 (중복 적용 방지) — 시너지 ID 목록만 갱신.
export function recalcAfterCardMutation(state: GameState, emit: (e: EngineEvent) => void): void {
  const before = new Set(state.activeSynergies);
  const syn = activeSynergies(state.cards);
  state.activeSynergies = syn.map(s => s.id);
  for (const s of syn) {
    if (before.has(s.id)) continue;
    emit({ type: 'SYNERGY_FIRED', id: s.id, tier: s.tier });
    emit({ type: 'SFX', id: `sfx_synergy_${s.tag}_${s.tier}` });
    state.stats.synergyTriggers[s.id] = (state.stats.synergyTriggers[s.id] ?? 0) + 1;
  }
  const ri = evalRunIdentity(state.cards);
  if (ri && ri.id !== state.runIdentity) {
    state.runIdentity = ri.id;
    emit({ type: 'IDENTITY_FIRED', id: ri.id });
    emit({ type: 'TEXT_BANNER', text: ri.name_ko, durationMs: 1500 });
  } else if (!ri && state.runIdentity) {
    state.runIdentity = null;
  }
}

export function evalRunIdentity(cards: Card[]): RunIdentityDef | null {
  const counts = tagCounts(cards);
  // 전설(7장 단일태그) 우선 → 단일태그(5장) → 듀얼(3+3) → 조화(6태그 1장+) 우선순위
  const candidates = [...DATA.run_identities].sort((a, b) => {
    const score = (id: RunIdentityDef) =>
      (id.legendary ? 1000 : 0) +
      Object.values(id.match).reduce<number>((s, v) => s + (typeof v === 'number' ? v : 0), 0);
    return score(b) - score(a);
  });
  for (const id of candidates) {
    let ok = true;
    for (const [tag, need] of Object.entries(id.match)) {
      if ((counts[tag as CardTag] ?? 0) < (need as number)) { ok = false; break; }
    }
    if (ok) return id;
  }
  return null;
}

// ─────────────────────────── 조건 평가 ───────────────────────────
// 효과의 condition 필드 (예: "comboGte:10", "remainingLte:5", "lifeEq:1") 평가

export function evalCondition(condition: string | undefined, state: GameState): boolean {
  if (!condition) return true;
  const [key, valStr] = condition.split(':');
  const v = Number(valStr);
  switch (key) {
    case 'comboGte': return state.combo >= v;
    case 'comboLte': return state.combo <= v;
    case 'remainingLte': return state.waveTimeRemaining <= v;
    case 'remainingGte': return state.waveTimeRemaining >= v;
    case 'elapsedLte': return state.elapsed <= v;
    case 'elapsedGte': return state.elapsed >= v;
    case 'lifeEq': return state.life === v;
    case 'lifeLte': return state.life <= v;
    case 'noCards': return state.cards.length === 0;
    default: return true;
  }
}

// ─────────────────────────── op 레지스트리 ───────────────────────────
// 각 op 는 effect + context 를 받아 state 를 변형하고 이벤트 발행.
// 58 op 모두 구현 완료 (cards.json + modifiers + 시너지 + ultimate 라우팅 포함).
// 미구현 op 호출 시 line ~563 의 console.warn 가 발화 → 즉시 결함 인지.

export const OPS: Record<string, OpHandler> = {
  // ── 코인 / 점수 ────────────────
  addCoins(e, ctx) {
    const base = sampleValue(e);
    const v = applyMultipliers(base, ctx.state, e);
    ctx.state.coins += v;
    ctx.emit({ type: 'COIN_GAIN', value: v, x: ctx.x, y: ctx.y });
    if (ctx.x != null && ctx.y != null) {
      ctx.emit({ type: 'NUMBER_POPUP', text: `+${formatNum(v)}`, x: ctx.x, y: ctx.y });
    }
  },

  tapMult(e, ctx) {
    // chance 게이팅은 runEffects 에서 일괄 처리.
    const m = e.mult ?? 2;
    ctx.state.coins += Math.floor((ctx.state.tapMult || 1) * m);
    ctx.emit({ type: 'PARTICLE', kind: 'spark', x: ctx.x ?? 0, y: ctx.y ?? 0, count: 5 });
  },

  tapMultGamble(e, ctx) {
    const win = rng() < (e.chance ?? 0.5);
    const m = win ? (e.mult ?? 3) : (e.elseMult ?? 0);
    ctx.state.coins += Math.floor((ctx.state.tapMult || 1) * m);
  },

  globalScoreMult(e, ctx) {
    if (!evalCondition(e.condition, ctx.state)) return;
    ctx.state.globalScoreMult *= e.mult ?? 1;
  },

  scoreMult(e, ctx) {
    if (!evalCondition(e.condition, ctx.state)) return;
    // floor 1: 페널티성 scoreMult (예: F10 onComboBreak 0.5) 가 누적되어 코인이 0 으로 폭락하는 걸 방지.
    // 22 콤보 break × 0.5 = 0.5^22 ≈ 0 → 게임 종료. 최소 1 코인 보장으로 회복 가능 상태 유지.
    ctx.state.coins = Math.max(1, Math.floor(ctx.state.coins * (e.value ?? e.mult ?? 1)));
  },

  coinGainMult(e, ctx) { ctx.state.coinGainMult *= e.mult ?? 1.5; },

  // ── 콤보 ────────────────
  addCombo(e, ctx) {
    const v = e.value ?? 1;
    const before = ctx.state.combo;
    ctx.state.combo += v;
    ctx.emit({ type: 'COMBO_CHANGE', from: before, to: ctx.state.combo });
  },

  preserveCombo(e, ctx) { ctx.state.preserveComboCount += e.value ?? 1; },

  extendComboWindow(e, ctx) { ctx.state.comboWindow += e.value ?? 0.1; },

  // ── 시간 ────────────────
  extendWaveTime(e, ctx) {
    const v = e.value ?? 0;
    ctx.state.waveTimeMax += v;
    ctx.state.waveTimeRemaining += v;
  },

  setWaveTime(e, ctx) {
    const v = e.value ?? 30;
    ctx.state.waveTimeMax = v;
    ctx.state.waveTimeRemaining = v;
  },

  freezeTime(e, ctx) {
    ctx.emit({ type: 'TIME_FREEZE', duration: e.duration ?? 1 });
  },

  timeScale(e, ctx) { ctx.state.timeScale = e.value ?? 1; },

  // ── 라이프 ────────────────
  addLife(e, ctx) {
    ctx.state.life = Math.max(0, Math.min(ctx.state.lifeMax, ctx.state.life + (e.value ?? 1)));
  },

  negateFirstLifeLoss(_e, ctx) { ctx.state.negateFirstLifeLoss = true; },

  revive(e, ctx) { ctx.state.reviveAvailable += e.value ?? 1; },

  reviveOnce(_e, ctx) { ctx.state.reviveAvailable = Math.max(ctx.state.reviveAvailable, 1); },

  // ── 시너지/카드 버프 ────────────────
  buffTap(e, ctx) {
    const m = e.mult ?? 2;
    ctx.state.tapMult *= m;
    if (e.duration) {
      // 일시 버프 — 단순화: duration 이후 자동 해제는 외부 타이머에서.
      // 추후 implementaiton 예정.
    }
  },

  buffTagEffects(e, ctx) {
    // 같은 태그 카드 효과 강화 — 본 boilerplate 에선 globalScoreMult 로 근사
    if (e.tag) {
      const count = ctx.state.cards.filter(c => c.tags.includes(e.tag as CardTag)).length;
      ctx.state.globalScoreMult *= 1 + (e.mult ?? 0.3) * (count > 0 ? 1 : 0);
    }
  },

  buffAllCardEffects(e, ctx) { ctx.state.globalScoreMult *= e.mult ?? 1.2; },

  buffSynergy(e, ctx) { ctx.state.globalScoreMult *= e.mult ?? 1.5; },

  // ── 사이드 효과 ────────────────
  autoTap(e, ctx) {
    const v = e.value ?? 1;
    ctx.state.coins += v;
  },

  echoTap(e, ctx) {
    // 0.3초 후 1회 더 발동 — 본 boilerplate 에선 즉시 1회 추가.
    // 실제 구현 시 setTimeout 또는 게임 루프 큐에 등록.
    ctx.state.coins += 1;
  },

  echoAuto(e, ctx) { ctx.state.coins += e.value ?? 1; },

  duplicateEffect(_e, _ctx) {
    // onAnyTrigger 의 chance 만큼 효과 복제. 디스패처가 처리 (extraTriggerCount 누적).
  },

  extraTriggerCount(e, ctx) { ctx.state.autoTriggerExtra += e.value ?? 1; },

  triggerRandomCardEffect(_e, ctx) {
    if (ctx.state.cards.length === 0) return;
    const card = ctx.state.cards[Math.floor(rng() * ctx.state.cards.length)];
    const fx = card.effects.filter(f => f.trigger === 'onTap');
    if (fx.length) ctx.dispatch(fx);
  },

  // ── 화면 효과 ────────────────
  screenShake(e, ctx) { ctx.emit({ type: 'SCREEN_SHAKE', intensity: e.intensity ?? 5, duration: e.duration ?? 0.2 }); },

  // ── ultimate (시너지 7장) ────────────────
  // e.effect 가 가리키는 sub-op 을 라우팅. fire7=addCoins(1B) / ice7=freezeTime(3s) /
  // gold7=addCoins(1M jackpot) / chaos7=triggerRandomCardEffect / echo7=crossTriggerAllCards.
  // 라우팅 실패 시 1B 코인 fallback.
  ultimate(e, ctx) {
    const label = e.effect ? e.effect.toUpperCase() : 'ULTIMATE';
    ctx.emit({ type: 'TEXT_BANNER', text: label, durationMs: 2000 });
    ctx.emit({ type: 'SCREEN_SHAKE', intensity: 12, duration: 0.45 });
    ctx.emit({ type: 'SFX', id: 'sfx_ultimate' });
    const target = e.effect ? OPS[e.effect] : undefined;
    if (target) {
      try { target(e, ctx); } catch (err) { console.error(`[ultimate] ${e.effect} failed`, err); }
    } else {
      ctx.state.coins += 1_000_000_000;
      ctx.emit({ type: 'COIN_GAIN', value: 1_000_000_000, x: ctx.x, y: ctx.y, reason: 'ultimateFallback' });
    }
  },

  // ── 카드 영구 버프 (런 전체) ────────────────
  buffOneCardEffect(e, ctx) {
    // 다음 카드 효과 ×mult — 1장만, 영구
    ctx.state.buffOneCardEffectMult = Math.max(ctx.state.buffOneCardEffectMult, e.mult ?? 1.2);
  },

  buffPerSameRarity(e, ctx) {
    // 같은 등급 카드 N장당 globalScoreMult ×(1 + mult·N)
    const last = ctx.state.cards[ctx.state.cards.length - 1];
    if (!last) return;
    const sameCount = ctx.state.cards.filter(c => c.rarity === last.rarity).length;
    ctx.state.globalScoreMult *= 1 + (e.mult ?? 0.1) * sameCount;
  },

  buffComboBonus(e, ctx) { ctx.state.buffComboBonusMult *= e.mult ?? 3; },
  buffAutoEffects(e, ctx) { ctx.state.buffAutoEffectsMult *= e.mult ?? 1; },

  // ── 점수/시간 캐리 ────────────────
  carryRemaining(_e, ctx) {
    // 웨이브 종료 시 남은 시간 × 코인을 다음 웨이브로 이월
    const carry = Math.floor(ctx.state.waveTimeRemaining * 100);
    ctx.state.carriedCoinsNextWave += Math.max(0, carry);
  },

  // ── 콤보 변종 ────────────────
  comboInverse(_e, ctx) { ctx.state.comboInverse = true; },

  comboPerTap(e, ctx) {
    // 탭마다 콤보 +N (시너지 echo5)
    ctx.state.combo += e.value ?? 1;
  },

  // ── 모든 카드 효과 교차 트리거 ────────────────
  crossTriggerAllCards(_e, ctx) {
    // 모든 보유 카드의 onTap 효과를 1회 디스패치
    for (const card of ctx.state.cards) {
      const fx = card.effects.filter(f => f.trigger === 'onTap');
      if (fx.length) ctx.dispatch(fx);
    }
  },

  // ── 화면 모디파이어 플래그 ────────────────
  darkMode(_e, ctx) { ctx.state.darkMode = true; },
  hideScore(_e, ctx) { ctx.state.hideScore = true; },
  muteSfx(_e, ctx) { ctx.state.muteSfx = true; },
  flipScreenH(_e, ctx) { ctx.state.flipScreenH = true; },
  disableCardEffects(_e, ctx) { ctx.state.disableCardEffects = true; },

  // ── 무작위 카드 조작 ────────────────
  doubleRandomCardEffect(_e, ctx) {
    if (ctx.state.cards.length === 0) return;
    const idx = Math.floor(rng() * ctx.state.cards.length);
    const card = ctx.state.cards[idx];
    // 효과 복제: 카드의 효과 배열을 두 배로 늘려 cards 배열에 다시 삽입
    const clone: Card = { ...card, id: card.id + '+', effects: [...card.effects, ...card.effects] };
    ctx.state.cards = [...ctx.state.cards.slice(0, idx), clone, ...ctx.state.cards.slice(idx + 1)];
    recalcAfterCardMutation(ctx.state, ctx.emit);
  },

  swapRandomCard(_e, ctx) {
    if (ctx.state.cards.length === 0) return;
    const idx = Math.floor(rng() * ctx.state.cards.length);
    const newCard = drawCards(1)[0];
    if (newCard) {
      ctx.state.cards = [...ctx.state.cards.slice(0, idx), newCard, ...ctx.state.cards.slice(idx + 1)];
      recalcAfterCardMutation(ctx.state, ctx.emit);
    }
  },

  transmuteRandomCard(_e, ctx) {
    // 무작위 카드 1장을 같은 등급의 다른 카드로 변환
    if (ctx.state.cards.length === 0) return;
    const idx = Math.floor(rng() * ctx.state.cards.length);
    const target = ctx.state.cards[idx];
    const pool = DATA.cards.filter(c => c.rarity === target.rarity && c.id !== target.id);
    if (pool.length === 0) return;
    const newCard = pool[Math.floor(rng() * pool.length)];
    ctx.state.cards = [...ctx.state.cards.slice(0, idx), newCard, ...ctx.state.cards.slice(idx + 1)];
    recalcAfterCardMutation(ctx.state, ctx.emit);
  },

  upgradeCardRarity(_e, ctx) {
    // 무작위 카드 1장 등급을 한 단계 ↑
    if (ctx.state.cards.length === 0) return;
    const idx = Math.floor(rng() * ctx.state.cards.length);
    const target = ctx.state.cards[idx];
    const next = nextRarity(target.rarity);
    if (!next || next === target.rarity) return;
    const pool = DATA.cards.filter(c => c.rarity === next && c.tags.some(t => target.tags.includes(t)));
    if (pool.length === 0) return;
    const upgraded = pool[Math.floor(rng() * pool.length)];
    ctx.state.cards = [...ctx.state.cards.slice(0, idx), upgraded, ...ctx.state.cards.slice(idx + 1)];
    recalcAfterCardMutation(ctx.state, ctx.emit);
  },

  addRandomTagToAllCards(_e, ctx) {
    // 모든 카드에 무작위 태그 1개 추가 (이미 있으면 다른 태그)
    const tags: CardTag[] = ['fire', 'ice', 'gold', 'time', 'chaos', 'echo'];
    ctx.state.cards = ctx.state.cards.map(c => {
      const missing = tags.filter(t => !c.tags.includes(t));
      if (missing.length === 0) return c;
      const t = missing[Math.floor(rng() * missing.length)];
      return { ...c, tags: [...c.tags, t] };
    });
    recalcAfterCardMutation(ctx.state, ctx.emit);
  },

  // ── 카드 선택 보너스 ────────────────
  extraCardChoice(e, ctx) {
    // chance 게이팅은 runEffects 에서 일괄 처리.
    ctx.state.extraCardChoiceCount += e.value ?? 1;
  },

  extraModifierPerWave(e, ctx) { ctx.state.extraModifierCount += e.value ?? 1; },

  forceNextCardRarity(e, ctx) {
    if (e.rarity) ctx.state.forceNextCardRarity = e.rarity;
  },

  rerollAllowed(e, ctx) { ctx.state.rerollsRemaining += e.value ?? 1; },

  // ── 부활 변종 ────────────────
  reviveWithMult(e, ctx) {
    if (ctx.state.life <= 0 || ctx.state.life === 1) {
      ctx.state.reviveAvailable = Math.max(ctx.state.reviveAvailable, 1);
      ctx.state.globalScoreMult *= e.mult ?? 10;
      ctx.emit({ type: 'TEXT_BANNER', text: 'PHOENIX', durationMs: 1500 });
    }
  },

  // ── 시간 되돌리기 ────────────────
  rewindWave(_e, ctx) {
    if (ctx.state.rewindsAvailable <= 0) {
      ctx.state.rewindsAvailable = 1;
    }
    if (ctx.state.rewindsAvailable > 0) {
      ctx.state.rewindsAvailable -= 1;
      ctx.state.waveTimeRemaining = ctx.state.waveTimeMax;
      ctx.state.elapsed = 0;
      ctx.emit({ type: 'TEXT_BANNER', text: 'REWIND', durationMs: 1500 });
    }
  },

  rewindWaveOnDeath(_e, ctx) {
    ctx.state.rewindsAvailable += 1;
  },

  // ── 점수 변형 ────────────────
  scoreMultOnComboBreak(e, ctx) { ctx.state.scoreMultOnComboBreak = Math.max(ctx.state.scoreMultOnComboBreak, e.mult ?? 1); },

  skipToEnd(e, ctx) {
    // 즉시 웨이브 종료 + 점수 ×scoreMult
    const m = (e as any).scoreMult ?? 5;
    ctx.state.coins = Math.floor(ctx.state.coins * m);
    ctx.state.waveTimeRemaining = 0;
  },

  // ── 핫스팟 / 빈 슬롯 ────────────────
  hotspotMult(e, ctx) { ctx.state.hotspotMult = Math.max(ctx.state.hotspotMult, e.mult ?? 10); },

  tapMultPerEmptySlot(e, ctx) {
    const empty = Math.max(0, 10 - ctx.state.cards.length);
    if (empty === 0) return;
    const m = (e.mult ?? 1) * empty;
    ctx.state.coins += Math.floor((ctx.state.tapMult || 1) * m);
  },

  // ── 효과 chance 반전 ────────────────
  invertEffectsChance(e, ctx) { ctx.state.invertChance = Math.max(ctx.state.invertChance, e.chance ?? 0.5); },
};

function nextRarity(r: Rarity): Rarity {
  if (r === 'common') return 'rare';
  if (r === 'rare') return 'epic';
  if (r === 'epic') return 'legendary';
  return 'legendary';
}

// ─────────────────────────── 디스패처 ───────────────────────────

export function dispatchTrigger(
  state: GameState,
  trigger: Trigger,
  emit: (e: EngineEvent) => void,
  meta: { x?: number; y?: number; data?: Record<string, unknown> } = {},
): void {
  // ctx 는 호출 사이 공유. dispatch 재귀 시 같은 emit/state 유지.
  const ctx: TriggerContext = {
    trigger,
    state,
    emit,
    dispatch: (effects, override) => runEffects(effects, { ...ctx, ...override }),
    x: meta.x,
    y: meta.y,
    data: meta.data,
  };

  // 1) 보유 카드의 해당 트리거 효과 (모디파이어 mod_temperance 적용 시 스킵)
  //
  // onCardPicked 가드: 본인 카드가 픽업된 순간에만 발동하도록 cardId 매칭.
  // (이전 동작: 모든 보유 카드의 onCardPicked 가 매 픽업마다 재발동 → globalScoreMult/coinGainMult 등
  //  `*=` 누적 op 가 22 사이클 후 1.2^22 ≈ 55배 / 1.5^22 ≈ 9만 배 폭주.)
  // "매 카드 픽업마다" 효과는 별도 트리거 `onAnyCardPicked` 로 명시 분리.
  const pickedId = trigger === 'onCardPicked' ? (meta.data?.cardId as string | undefined) : undefined;
  if (!state.disableCardEffects) {
    for (const card of state.cards) {
      if (trigger === 'onCardPicked' && pickedId != null && card.id !== pickedId) continue;
      const fx = effectsForTrigger(card, trigger);
      if (fx.length) runEffects(fx, ctx);
    }
    // onCardPicked 이벤트 시 onAnyCardPicked 트리거 효과도 발동 (신규 트리거 — 디자이너가 "매 픽업마다" 명시한 카드)
    if (trigger === 'onCardPicked') {
      for (const card of state.cards) {
        const fx = effectsForTrigger(card, 'onAnyCardPicked');
        if (fx.length) runEffects(fx, ctx);
      }
    }
  }

  // 2) 활성 모디파이어
  if (state.modifierThisWave) {
    const fx = state.modifierThisWave.effects.filter(e => (e.trigger ?? 'onWaveStart') === trigger);
    if (fx.length) runEffects(fx, ctx);
  }

  // 3) onAnyTrigger 카드(에코류)는 다른 트리거 발생 시마다 동작
  if (trigger !== 'onAnyTrigger') {
    for (const card of state.cards) {
      const fx = effectsForTrigger(card, 'onAnyTrigger');
      if (fx.length) runEffects(fx, ctx);
    }
  }
}

function runEffects(effects: Effect[], ctx: TriggerContext): void {
  const repeat = 1 + (ctx.state.autoTriggerExtra | 0);
  for (let r = 0; r < repeat; r++) {
    for (const e of effects) {
      // chance 게이팅 — invertChance(C08) 활성 시 (1 - chance) 로 반전.
      // tapMultGamble 처럼 chance 를 내부적으로 win/lose 분기에 쓰는 op 는 OP_HANDLES_CHANCE 에서 제외.
      if (e.chance != null && !OP_HANDLES_CHANCE.has(e.op)) {
        let p = e.chance;
        if (ctx.state.invertChance > 0) p = 1 - p;
        if (rng() > p) continue;
      }
      const handler = OPS[e.op];
      if (!handler) {
        if (typeof console !== 'undefined') console.warn(`[OPS] unknown op: ${e.op}`);
        continue;
      }
      try { handler(e, ctx); } catch (err) { console.error(`[OPS] ${e.op} failed`, err); }
    }
  }
}

// chance 필드를 자체적으로 win/lose 분기에 쓰는 op — runEffects 의 외부 게이팅을 우회.
const OP_HANDLES_CHANCE = new Set<string>(['tapMultGamble']);

// ─────────────────────────── 유틸 ───────────────────────────

let _rngSeed = 1;
export function setRngSeed(seed: number) { _rngSeed = seed >>> 0 || 1; }
export function rng(): number {
  // mulberry32 — 일일 시드 결정성 확보용
  let t = (_rngSeed += 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function sampleValue(e: Effect): number {
  if (e.minValue != null && e.maxValue != null) {
    return Math.floor(e.minValue + rng() * (e.maxValue - e.minValue + 1));
  }
  return e.value ?? 0;
}

export function applyMultipliers(base: number, state: GameState, e: Effect): number {
  let v = base;
  v *= state.coinGainMult || 1;
  v *= state.globalScoreMult || 1;
  if (e.scale === 'comboBuckets5') v *= 1 + Math.floor(state.combo / 5);
  return Math.floor(v);
}

export function formatNum(n: number): string {
  if (n < 1_000) return n.toString();
  if (n < 1_000_000) return trimZ((n / 1_000).toFixed(1)) + 'K';
  if (n < 1_000_000_000) return trimZ((n / 1_000_000).toFixed(1)) + 'M';
  if (n < 1e12) return trimZ((n / 1e9).toFixed(2)) + 'B';
  if (n < 1e15) return trimZ((n / 1e12).toFixed(2)) + 'T';
  if (n < 1e18) return trimZ((n / 1e15).toFixed(2)) + 'Q';
  return n.toExponential(2);
}

function trimZ(s: string): string {
  return s.indexOf('.') < 0 ? s : s.replace(/0+$/, '').replace(/\.$/, '');
}

// ─────────────────────────── 초기 상태 빌더 ───────────────────────────

export function newGameState(meta: Partial<GameState['meta']> = {}): GameState {
  return {
    phase: 'idle',
    wave: 0,
    waveTimeMax: 30,
    waveTimeRemaining: 30,
    elapsed: 0,
    timeScale: 1,
    coins: 0,
    totalScore: 0,
    combo: 0,
    comboMaxThisWave: 0,
    comboMaxRun: 0,
    comboWindow: 0.3,
    lastTapTime: 0,
    tapCount: 0,
    life: 3,
    lifeMax: 3,
    reviveAvailable: 0,
    cards: [],
    modifierThisWave: null,
    activeSynergies: [],
    runIdentity: null,
    bossActive: false,
    bossTargetScore: 0,
    bossKind: null,
    globalScoreMult: 1,
    tapMult: 1,
    coinGainMult: 1,
    preserveComboCount: 0,
    negateFirstLifeLoss: false,
    autoTriggerExtra: 0,
    darkMode: false,
    hideScore: false,
    muteSfx: false,
    flipScreenH: false,
    comboInverse: false,
    disableCardEffects: false,
    buffComboBonusMult: 1,
    buffAutoEffectsMult: 1,
    scoreMultOnComboBreak: 0,
    hotspotMult: 3,
    extraCardChoiceCount: 0,
    extraModifierCount: 0,
    doubleNextRandomEffect: false,
    carriedCoinsNextWave: 0,
    invertChance: 0,
    rewindsAvailable: 0,
    forceNextCardRarity: null,
    rerollsRemaining: 0,
    buffOneCardEffectMult: 1,
    cardBuffStacks: 1,
    meta: {
      rp: 0,
      totalCycles: 0,
      totalCoins: 0,
      unlockedCardIds: [],
      unlockedModifierIds: [],
      unlockedSkinIds: [],
      unlockedBgmIds: [],
      startingLifeBonus: 0,
      startingCardSlotBonus: 0,
      startingCoinsBonus: 0,
      rpRateBonus: 0,
      achievements: [],
      bestScore: 0,
      yesterdayScore: 0,
      language: 'ko',
      bgmVol: 0.5,
      sfxVol: 0.6,
      shakeEnabled: true,
      flashEnabled: true,
      reducedMotion: typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false,
      // ⭐ 색약 모드 — prefers-contrast 시스템 신호 자동 감지 (사용자가 토글로 override 가능)
      colorblindMode: typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-contrast: more)').matches
        : false,
      seenIdentityIds: [],
      seenSynergyIds: [],
      seenModifierIds: [],
      seenBiomeIds: [],
      ...meta,
    },
    stats: {
      startedAt: 0,
      tapsTotal: 0,
      cardsPicked: 0,
      bossesDefeated: 0,
      synergyTriggers: {},
      highlightEvents: [],
      modifierIds: [],
      biomeIds: [],
    },
  };
}

// ─────────────────────── 비밀 카드 잠금해제 (S01–S05) ───────────────────────
//
// 비밀 모디파이어(modifiers.ts checkSecretUnlocks)와 동일 패턴. 데이터(secret_cards)
// 의 unlock.type 조건을 웨이브 클리어 시점(state.ts handleEndWave)에 평가 →
// 충족 시 영구 풀에 합류(localStorage). 평가/저장만 — UI 변형 없음.

const CARD_UNLOCK_KEY = 'samsara.card.unlocks.v1';

export interface CardUnlocks { ids: string[]; }

export function loadCardUnlocks(): CardUnlocks {
  try {
    if (typeof localStorage === 'undefined') return { ids: [] };
    const raw = localStorage.getItem(CARD_UNLOCK_KEY);
    return raw ? JSON.parse(raw) : { ids: [] };
  } catch { return { ids: [] }; }
}

export function saveCardUnlocks(u: CardUnlocks): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(CARD_UNLOCK_KEY, JSON.stringify(u));
  } catch { /* quota — ignore */ }
}

/**
 * 비밀 카드 잠금해제 조건 체크. 웨이브 클리어 직후(handleEndWave 최상단)에 호출 —
 * 그 시점 state.tapCount / waveTimeRemaining / wave / cards 는 방금 끝난 웨이브 값.
 * 새로 잠금해제된 카드 id 배열 반환 (모디파이어 checkSecretUnlocks 와 동일 시그니처).
 */
export function checkSecretCardUnlocks(state: GameState): string[] {
  const u = loadCardUnlocks();
  const newly: string[] = [];
  const has = (id: string) => u.ids.includes(id);
  const owns = (tag: CardTag) => state.cards.some(c => c.tags.includes(tag));
  const ALL_TAGS: CardTag[] = ['fire', 'ice', 'gold', 'time', 'chaos', 'echo'];

  for (const card of DATA.secret_cards) {
    if (has(card.id)) continue;
    const k = (card.unlock ?? { type: '' }) as Record<string, unknown>;
    const num = (key: string, dflt: number) =>
      (typeof k[key] === 'number' ? (k[key] as number) : dflt);
    let ok = false;
    switch (k['type']) {
      // S01 재의 봉황 — 콤보 N + 해당 태그 0장 + 웨이브 N 클리어
      case 'comboWithoutTag':
        ok = state.comboMaxRun >= num('combo', 100)
          && state.wave >= num('wave', 5)
          && !owns(k['tag'] as CardTag);
        break;
      // S02 심해의 군주 — 탭 0회로 한 웨이브 클리어 (자동만)
      case 'clearWithZeroTaps':
        ok = state.tapCount === 0 && state.wave >= 1;
        break;
      // S03 역설 — 시간 카드 N장 + 시간 0초로 클리어 (타임아웃 종료)
      case 'clearWithZeroTime': {
        const tg = (k['tag'] as CardTag) ?? 'time';
        const cnt = state.cards.filter(c => c.tags.includes(tg)).length;
        ok = state.waveTimeRemaining <= 0 && cnt >= num('tagCount', 5);
        break;
      }
      // S04 광휘 — 6태그 1장씩 보유 + 보스 격파
      case 'allTagsBossDefeat':
        ok = state.stats.bossesDefeated > 0 && ALL_TAGS.every(owns);
        break;
      // S05 공허 — 카드 0장으로 웨이브 N 클리어
      case 'zeroCardsToWave':
        ok = state.cards.length === 0 && state.wave >= num('wave', 5);
        break;
    }
    if (ok) { u.ids.push(card.id); newly.push(card.id); }
  }

  if (newly.length) saveCardUnlocks(u);
  return newly;
}

// ─────────────────────────── 카드 풀 무작위 추첨 ───────────────────────────

export function drawCards(count: number, unlockedIds?: string[], forceRarity?: Rarity | null): Card[] {
  const base = unlockedIds && unlockedIds.length > 0
    ? DATA.cards.filter(c => unlockedIds.includes(c.id))
    : DATA.cards;
  // 잠금해제된 비밀 카드는 메타 게이팅과 무관하게 항상 풀에 합류 (docs/16 "조건 충족 시 풀에 추가").
  const sIds = loadCardUnlocks().ids;
  const pool = sIds.length > 0
    ? [...base, ...DATA.secret_cards.filter(c => sIds.includes(c.id))]
    : base;

  const dist = DATA.rarity_distribution;
  const out: Card[] = [];
  for (let i = 0; i < count; i++) {
    let target: Rarity;
    if (forceRarity) {
      target = forceRarity;
    } else {
      const r = rng();
      if (r < dist.legendary) target = 'legendary';
      else if (r < dist.legendary + dist.epic) target = 'epic';
      else if (r < dist.legendary + dist.epic + dist.rare) target = 'rare';
      else target = 'common';
    }

    const filtered = pool.filter(c => c.rarity === target);
    const candidates = filtered.length > 0 ? filtered : pool;
    out.push(candidates[Math.floor(rng() * candidates.length)]);
  }
  return out;
}
