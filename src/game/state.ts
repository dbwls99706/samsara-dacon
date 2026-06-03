// SAMSARA · 윤회 — 게임 상태 reducer
//
// (state, action) => { state, events }. 사이드 이펙트는 events 배열로만.
// 카드 효과 디스패치는 cards.ts 의 dispatchTrigger 가 담당. state 는 mutate 되지만
// reducer 가 매번 얕은 복사로 보호한다.
//
// 디자인 원칙:
//  - reducer 내부에서 RNG/시간/IO 사용 X — TICK action 의 dt 와 t 만 신뢰.
//  - state 는 매번 얕은 복사 후 mutate (deep clone 비용 회피)

import {
  OPS,
  activeSynergies,
  applyMultipliers,
  checkSecretCardUnlocks,
  dispatchTrigger,
  evalRunIdentity,
  getCard,
} from './cards.js';
import { applyModifier, checkSecretUnlocks, pickModifier } from './modifiers.js';
import { bossSpec, isBossWave } from './boss.js';
import type {
  Action,
  Card,
  EngineEvent,
  GameState,
  TriggerContext,
} from './types.js';

// ─────────────────────────── 상수 ───────────────────────────

// ⭐ 큰 수 K/M/B/T 포맷터 — NUMBER_POPUP 의 raw 정수가 9자리 이상 출력되는 문제 방지.
// (이전: "+117440513 ×100" 처럼 읽기 힘든 정수가 화면을 가득 채움)
function fmtBig(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (abs >= 1e9)  return (n / 1e9).toFixed(1)  + 'B';
  if (abs >= 1e6)  return (n / 1e6).toFixed(1)  + 'M';
  if (abs >= 1e4)  return (n / 1e3).toFixed(1)  + 'K';
  return Math.round(n).toString();
}

export const COMBO_THRESHOLDS = [3, 5, 10, 25, 50, 100, 200, 500] as const;
const COMBO_THRESHOLD_SET = new Set<number>(COMBO_THRESHOLDS);

const COMBO_MULT: Record<number, number> = {
  3: 1.1, 5: 1.2, 10: 1.5, 25: 2, 50: 3, 100: 5, 200: 10, 500: 100,
};

const COMBO_SHAKE: Record<number, [number, number]> = {
  10: [2, 0.1], 25: [5, 0.2], 50: [8, 0.3], 100: [10, 0.4], 200: [12, 0.5], 500: [15, 0.7],
};

const COMBO_BGM_L4: Record<number, boolean> = { 50: true, 100: true };

export function phaseFromWave(wave: number): 1 | 2 | 3 {
  if (wave <= 3) return 1;
  if (wave <= 8) return 2;
  return 3;
}

// 웨이브 시간 곡선 — 초반은 짧게(빠른 첫 보상), 중반부터 길게(빌드 구축 여유).
export function waveDuration(wave: number): number {
  if (wave <= 1) return 30;
  if (wave === 2) return 45;
  return 60;
}

// ─────────────────────────── reducer ───────────────────────────

export interface ReducerResult {
  state: GameState;
  events: EngineEvent[];
}

export function reduce(prev: GameState, action: Action): ReducerResult {
  const state: GameState = { ...prev };
  const events: EngineEvent[] = [];
  const emit = (e: EngineEvent) => events.push(e);

  switch (action.type) {
    case 'TAP':            handleTap(state, action, emit); break;
    case 'TICK':           handleTick(state, action.dt, action.t, emit); break;
    case 'START_WAVE':     handleStartWave(state, action.wave, emit); break;
    case 'END_WAVE':       handleEndWave(state, emit); break;
    case 'PICK_CARD':      handlePickCard(state, action.card, emit); break;
    case 'SKIP_CARD':      state.phase = 'playing'; break;
    case 'PAUSE':          if (state.phase === 'playing') state.phase = 'paused'; break;
    case 'RESUME':         if (state.phase === 'paused') state.phase = 'playing'; break;
    case 'BOSS_DEFEATED':  handleBossDefeated(state, action.timeUsed, emit); break;
    case 'BOSS_FAILED':    handleLifeLoss(state, emit); break;
    case 'GAME_OVER':      handleGameOver(state, emit); break;
    case 'ENEMY_KILLED':   handleEnemyKilled(state, action, emit); break;
    case 'PICKUP':         handlePickup(state, action as any, emit); break;
    case 'PLAYER_HIT':     handlePlayerHit(state, action, emit); break;
    case 'BUFF_GAIN':      handleBuffGain(state, action, emit); break;
    case 'BIOME_SEEN': {
      // ⭐ 도감 — 시뮬이 통지한 현재 biome 을 run-scoped 누적 (dedupe).
      //   handleGameOver 가 meta.seenBiomeIds 로 머지 (meta 는 거기서만 변경).
      if (state.phase === 'playing' || state.phase === 'boss') {
        const seen = state.stats.biomeIds ?? (state.stats.biomeIds = []);
        if (!seen.includes(action.biome)) seen.push(action.biome);
      }
      break;
    }
  }

  // 점수 1e15 도달 시 초월 트리거
  if (state.totalScore + state.coins >= 1e15 && state.phase !== 'transcend' && state.phase !== 'over') {
    state.phase = 'transcend';
    emit({ type: 'TRANSCEND' });
  }

  return { state, events };
}

// ─────────────────────────── TAP ───────────────────────────

function handleTap(state: GameState, action: { x?: number; y?: number; t: number }, emit: (e: EngineEvent) => void) {
  if (state.phase !== 'playing' && state.phase !== 'boss') return;

  // 1) 콤보 갱신
  const dt = action.t - state.lastTapTime;
  const inWindow = state.lastTapTime > 0 && dt <= state.comboWindow * 1000;
  const before = state.combo;

  if (inWindow) {
    state.combo += 1;
  } else {
    if (before > 0 && state.preserveComboCount > 0) {
      state.preserveComboCount -= 1;
      // 유지
    } else if (before > 0) {
      emit({ type: 'COMBO_CHANGE', from: before, to: 0, reason: 'window' });
      emit({ type: 'SFX', id: 'sfx_combo_break' });
      // mod_inverse_scale: 콤보 끊김 시 점수 ×N 보너스
      if (state.scoreMultOnComboBreak > 0) {
        const bonus = Math.floor(state.coins * (state.scoreMultOnComboBreak - 1));
        if (bonus > 0) {
          state.coins += bonus;
          emit({ type: 'COIN_GAIN', value: bonus, reason: 'comboBreakBonus' });
        }
      }
      dispatchTrigger(state, 'onComboBreak', emit);
      state.combo = 1;
    } else {
      state.combo = 1;
    }
  }
  state.lastTapTime = action.t;
  state.tapCount += 1;
  state.stats.tapsTotal += 1;

  if (state.combo !== before) emit({ type: 'COMBO_CHANGE', from: before, to: state.combo });
  if (state.combo > state.comboMaxThisWave) state.comboMaxThisWave = state.combo;
  if (state.combo > state.comboMaxRun) {
    state.comboMaxRun = state.combo;
    state.stats.highlightEvents.push({ t: state.elapsed, type: 'maxCombo', payload: { combo: state.combo } });
  }

  // 2) 콤보 임계값 도달 효과
  if (COMBO_THRESHOLD_SET.has(state.combo) && state.combo > before) {
    const lvl = state.combo as 3 | 5 | 10 | 25 | 50 | 100 | 200 | 500;
    emit({ type: 'COMBO_THRESHOLD', level: lvl });
    emit({ type: 'SFX', id: `sfx_combo_${lvl}` });
    const mult = COMBO_MULT[lvl] ?? 1;
    if (mult !== 1) {
      const bonus = Math.floor(applyMultipliers(state.combo * 10, state, { op: 'addCoins' }) * mult);
      state.coins += bonus;
      emit({ type: 'COIN_GAIN', value: bonus, x: action.x, y: action.y, reason: `combo×${lvl}` });
      emit({ type: 'NUMBER_POPUP', text: `+${fmtBig(bonus)} ×${mult}`, x: action.x ?? 0, y: action.y ?? 0, color: '#ffd700', size: lvl >= 25 ? 48 : 32 });
    }
    const shake = COMBO_SHAKE[lvl];
    if (shake) emit({ type: 'SCREEN_SHAKE', intensity: shake[0], duration: shake[1] });
    if (COMBO_BGM_L4[lvl]) emit({ type: 'BGM_LAYER', layer: 3, target: 1, ramp: 0.5 });
    dispatchTrigger(state, 'onCombo', emit, { data: { level: lvl } });
  }

  // 3) 기본 탭 보상
  const tapBase = Math.max(1, state.tapMult);
  const tapValue = applyMultipliers(tapBase, state, { op: 'addCoins' });
  state.coins += tapValue;
  emit({ type: 'COIN_GAIN', value: tapValue, x: action.x, y: action.y, reason: 'tap' });
  if (action.x != null && action.y != null) {
    emit({ type: 'NUMBER_POPUP', text: `+${fmtBig(tapValue)}`, x: action.x, y: action.y });
  }

  // 4) 탭 SFX + 파티클
  emit({ type: 'SFX', id: tapSfxFor(state.combo) });
  emit({ type: 'PARTICLE', kind: state.combo >= 25 ? 'burst' : 'spark', x: action.x ?? 0, y: action.y ?? 0, count: particleCountFor(state.combo) });

  // 5) onTap 트리거 — 카드 효과
  dispatchTrigger(state, 'onTap', emit, { x: action.x, y: action.y });

  // 6) onTapNth — 5번째마다
  if (state.tapCount % 5 === 0) dispatchTrigger(state, 'onTapNth', emit);
}

function tapSfxFor(combo: number): string {
  if (combo >= 100) return 'sfx_tap_god';
  if (combo >= 25) return 'sfx_tap_super';
  if (combo >= 10) return 'sfx_tap_high';
  if (combo >= 3) return 'sfx_tap_mid';
  return 'sfx_tap_low';
}

function particleCountFor(combo: number): number {
  if (combo >= 25) return 25;
  if (combo >= 5) return 10;
  return 5;
}

// ─────────────────────────── TICK ───────────────────────────

function handleTick(state: GameState, dt: number, t: number, emit: (e: EngineEvent) => void) {
  if (state.phase !== 'playing' && state.phase !== 'boss') return;

  const scaledDt = dt * state.timeScale;
  state.elapsed += scaledDt;
  state.waveTimeRemaining -= scaledDt;

  // 보스 격파 체크 — 서바이벌 모드에선 world 의 bossKill 이벤트가 BOSS_DEFEATED 를 디스패치한다.
  // (legacy 클리커 모드의 점수 기반 자동 승리는 제거)

  // 콤보 윈도우 만료 검사 (TAP 이 안 와도 reset)
  if (state.combo > 0 && state.lastTapTime > 0) {
    const sinceTap = (t - state.lastTapTime) / 1000;
    if (sinceTap > state.comboWindow) {
      if (state.preserveComboCount > 0) {
        state.preserveComboCount -= 1;
      } else {
        const before = state.combo;
        state.combo = 0;
        emit({ type: 'COMBO_CHANGE', from: before, to: 0, reason: 'idle' });
        emit({ type: 'SFX', id: 'sfx_combo_break' });
        // 콤보 끊김 → 클라이맥스 BGM 레이어(L4/index3) OFF. 이전엔 웨이브 시작 때만 꺼져
        // 한 번 50콤보 찍으면 웨이브 내내 박혀있던 stickiness 해소(음악 다이내믹 복원).
        emit({ type: 'BGM_LAYER', layer: 3, target: 0, ramp: 1.5 });
        dispatchTrigger(state, 'onComboBreak', emit);
      }
    }
  }

  // onTick 트리거 (자동 탭 카드 등)
  dispatchTrigger(state, 'onTick', emit, { data: { dt: scaledDt } });

  // 웨이브 시간 종료
  if (state.waveTimeRemaining <= 0) {
    if (state.phase === 'boss') {
      // 보스 실패
      state.bossActive = false;
      emit({ type: 'TEXT_BANNER', text: 'BOSS FAILED', durationMs: 1500 });
      emit({ type: 'SFX', id: 'sfx_boss_fail' });
      handleLifeLoss(state, emit);
      // 라이프 잃은 뒤 일반 웨이브 종료 흐름으로
      handleEndWave(state, emit);
    } else {
      handleEndWave(state, emit);
    }
  }
}

// ─────────────────────────── 웨이브 시작/종료 ───────────────────────────

function handleStartWave(state: GameState, wave: number, emit: (e: EngineEvent) => void) {
  // 멱등성: 같은 웨이브로 이미 진입한 직후 (0.5초 미만) 재호출은 무시 — 더블 클릭 가드.
  if ((state.phase === 'playing' || state.phase === 'boss') && state.wave === wave && state.elapsed < 0.5) return;
  // 캐리 코인 (T05) — 다음 웨이브로 이월
  const carry = state.carriedCoinsNextWave;
  state.wave = wave;
  const dur = waveDuration(wave);
  state.waveTimeMax = dur;
  state.waveTimeRemaining = dur;
  state.elapsed = 0;
  state.coins = carry;
  state.combo = 0;
  state.comboMaxThisWave = 0;
  state.tapCount = 0;
  state.lastTapTime = 0;
  state.timeScale = 1;
  state.tapMult = 1;
  state.coinGainMult = 1;
  state.globalScoreMult = 1;
  state.preserveComboCount = 0;
  state.negateFirstLifeLoss = false;
  state.autoTriggerExtra = 0;
  // 웨이브 단위 플래그 리셋
  state.darkMode = false;
  state.hideScore = false;
  state.muteSfx = false;
  state.flipScreenH = false;
  state.comboInverse = false;
  state.disableCardEffects = false;
  state.buffComboBonusMult = 1;
  state.buffAutoEffectsMult = 1;
  state.scoreMultOnComboBreak = 0;
  state.hotspotMult = 3;
  state.doubleNextRandomEffect = false;
  state.carriedCoinsNextWave = 0;
  state.invertChance = 0;
  state.modifierThisWave = null;

  // 보스 웨이브 처리
  const boss = isBossWave(wave) ? bossSpec(wave) : null;
  state.bossActive = !!boss;
  state.bossTargetScore = boss?.targetScore ?? 0;
  state.bossKind = boss?.kind ?? null;
  state.phase = boss ? 'boss' : 'playing';

  // BGM 페이즈 전환
  const phase = phaseFromWave(wave);
  emit({ type: 'BGM_LAYER', layer: 0, target: 1, ramp: 1.5 });
  emit({ type: 'BGM_LAYER', layer: 1, target: phase >= 2 ? 1 : 0, ramp: 1.5 });
  emit({ type: 'BGM_LAYER', layer: 2, target: phase >= 3 ? 1 : 0, ramp: 1.5 });
  emit({ type: 'BGM_LAYER', layer: 3, target: 0, ramp: 1.5 });

  emit({ type: 'WAVE_START', wave });
  emit({ type: 'SFX', id: boss ? 'sfx_boss_appear' : 'sfx_wave_start' });
  if (boss) emit({ type: 'TEXT_BANNER', text: `BOSS · ${boss.kind.toUpperCase()}`, durationMs: 1500 });

  // 모디파이어 1+ 개 무작위 배정 (extraModifierCount 누적시 추가)
  const modCount = 1 + state.extraModifierCount;
  for (let i = 0; i < modCount; i++) {
    const mod = pickModifier(state);
    if (mod) {
      applyModifier(state, mod, emit);
      // ⭐ 도감 — 이번 런에서 발동된 모디파이어 id 누적 (run-scoped, dedupe).
      //   handleGameOver 가 meta.seenModifierIds 로 머지 (meta 는 거기서만 변경).
      const seen = state.stats.modifierIds ?? (state.stats.modifierIds = []);
      if (!seen.includes(mod.id)) seen.push(mod.id);
    }
  }

  // 비밀 모디파이어 잠금해제 체크
  const newly = checkSecretUnlocks(state);
  for (const id of newly) emit({ type: 'TEXT_BANNER', text: `발견! ${id}`, durationMs: 2000 });

  dispatchTrigger(state, 'onWaveStart', emit);
}

function handleEndWave(state: GameState, emit: (e: EngineEvent) => void) {
  if (state.phase !== 'playing' && state.phase !== 'boss') return;

  // ⭐ 비밀 카드 잠금해제 — 방금 끝난 웨이브의 tapCount/waveTimeRemaining/cards 값으로 평가.
  //   조건 충족 시 영구 풀 합류 (cards.ts checkSecretCardUnlocks, 모디파이어 패턴과 동일).
  const newSecrets = checkSecretCardUnlocks(state);
  for (const id of newSecrets) {
    const c = getCard(id);
    emit({ type: 'TEXT_BANNER', text: `비밀 카드 발견 — ${c?.name_ko ?? id}`, durationMs: 2400 });
    emit({ type: 'SFX', id: 'sfx_unlock' });
  }

  state.bossActive = false;
  dispatchTrigger(state, 'onWaveEnd', emit);

  // 모디파이어 onWaveEnd 효과 처리
  if (state.modifierThisWave) {
    for (const eff of state.modifierThisWave.effects) {
      if (eff.trigger !== 'onWaveEnd') continue;
      const handler = OPS[eff.op];
      if (!handler) continue;
      try {
        handler(eff, {
          trigger: 'onWaveEnd',
          state,
          emit,
          dispatch: () => {},
        });
      } catch (err) { console.error('[mod onWaveEnd]', eff.op, err); }
    }
  }

  state.totalScore += state.coins;
  state.stats.highlightEvents.push({ t: state.elapsed, type: 'bigPayout', payload: { wave: state.wave, coins: state.coins } });
  emit({ type: 'WAVE_END', wave: state.wave, coins: state.coins });
  emit({ type: 'SFX', id: 'sfx_wave_end' });
  state.phase = 'cardPick';
}

// ─────────────────────────── 카드 선택 ───────────────────────────

function handlePickCard(state: GameState, card: Card, emit: (e: EngineEvent) => void) {
  state.cards = [...state.cards, card];
  state.stats.cardsPicked += 1;

  // 시너지 재평가 + 새로 활성된 시너지 효과 즉시 1회 적용
  const synBefore = new Set(state.activeSynergies);
  const syn = activeSynergies(state.cards);
  state.activeSynergies = syn.map(s => s.id);
  for (const s of syn) {
    if (synBefore.has(s.id)) continue;
    emit({ type: 'SYNERGY_FIRED', id: s.id, tier: s.tier });
    emit({ type: 'SFX', id: `sfx_synergy_${s.tag}_${s.tier}` });
    state.stats.synergyTriggers[s.id] = (state.stats.synergyTriggers[s.id] ?? 0) + 1;
    state.stats.highlightEvents.push({ t: state.elapsed, type: 'synergy', payload: { id: s.id, tier: s.tier } });
    // 시너지 자체 효과 즉시 1회 실행 (영구 버프류)
    runEffectsImmediate(state, s.effects, emit);
  }

  // Run Identity 평가
  const ri = evalRunIdentity(state.cards);
  if (ri && ri.id !== state.runIdentity) {
    state.runIdentity = ri.id;
    emit({ type: 'IDENTITY_FIRED', id: ri.id });
    // 버프가 있으면 배너에 효과 라벨 동반 → 획득 순간 보상 가시화(전설 6종).
    emit({ type: 'TEXT_BANNER', text: ri.bonusKo ? `${ri.name_ko} — ${ri.bonusKo}` : ri.name_ko, durationMs: ri.bonusKo ? 2200 : 1500 });
    if (ri.legendary) {
      state.stats.highlightEvents.push({ t: state.elapsed, type: 'legendary', payload: { id: ri.id } });
    }
    if (ri.bonus) runEffectsImmediate(state, ri.bonus, emit);
  }

  emit({
    type: 'SFX',
    id: card.rarity === 'legendary' ? 'sfx_card_legendary'
      : card.rarity === 'epic' ? 'sfx_card_epic'
      : card.rarity === 'rare' ? 'sfx_card_rare'
      : 'sfx_card_select',
  });

  dispatchTrigger(state, 'onCardPicked', emit, { data: { cardId: card.id } });
  state.phase = 'playing';
}

// 시너지/Run Identity 의 즉시 효과 실행 (트리거 없는 효과 가정).
function runEffectsImmediate(state: GameState, effects: import('./types.js').Effect[], emit: (e: EngineEvent) => void) {
  const ctx: TriggerContext = {
    trigger: 'onSynergy',
    state,
    emit,
    dispatch: () => {},
  };
  for (const e of effects) {
    const handler = OPS[e.op];
    if (!handler) continue;
    try { handler(e, ctx); } catch (err) { console.error(`[OPS] ${e.op} immediate failed`, err); }
  }
}

// ─────────────────────────── 보스 / 라이프 ───────────────────────────

function handleBossDefeated(state: GameState, timeUsed: number, emit: (e: EngineEvent) => void) {
  state.stats.bossesDefeated += 1;
  const limit = state.waveTimeMax || 30;
  const remaining = Math.max(0, limit - timeUsed);
  const bonus = Math.floor(state.coins * (remaining / limit));
  state.coins += bonus;
  state.bossActive = false;
  state.bossKind = null;
  emit({ type: 'COIN_GAIN', value: bonus, reason: 'bossClear' });
  emit({ type: 'TEXT_BANNER', text: 'VICTORY', durationMs: 1500 });
  emit({ type: 'SFX', id: 'sfx_boss_defeat' });
  emit({ type: 'SCREEN_SHAKE', intensity: 10, duration: 0.3 });
  state.stats.highlightEvents.push({ t: state.elapsed, type: 'bossDefeat', payload: { timeUsed, bonus } });
  // 보스 격파 시 다음 웨이브 시간을 절반쯤 충전 (즉시 cardPick 으로 가지만 ritual 화면용 깔끔)
  state.phase = 'ritual';
}

function handleLifeLoss(state: GameState, emit: (e: EngineEvent) => void) {
  if (state.negateFirstLifeLoss) {
    state.negateFirstLifeLoss = false;
    emit({ type: 'TEXT_BANNER', text: 'NEGATED', durationMs: 800 });
    return;
  }
  state.life -= 1;
  emit({ type: 'LIFE_LOST', remaining: state.life });
  emit({ type: 'SFX', id: 'sfx_life_lost' });
  emit({ type: 'SCREEN_SHAKE', intensity: 3, duration: 0.15 });
  dispatchTrigger(state, 'onLifeLost', emit);
  if (state.life <= 0) {
    if (state.reviveAvailable > 0) {
      state.reviveAvailable -= 1;
      state.life = 1;
      // ⭐ 윤회 — 부활을 '환생'으로 프레이밍(#2). 죽음이 끝이 아니라 새 생으로 돌아옴.
      emit({ type: 'TEXT_BANNER', text: '윤회 · 還生', durationMs: 1600 });
      emit({ type: 'SFX', id: 'sfx_revive' });
      dispatchTrigger(state, 'onRevive', emit);
    } else {
      handleGameOver(state, emit);
    }
  }
}

// ─────────────────────────── 서바이벌 액션 ───────────────────────────

function handleEnemyKilled(state: GameState, a: { coins: number; streak: number; x?: number; y?: number; kind?: string }, emit: (e: EngineEvent) => void) {
  if (state.phase !== 'playing' && state.phase !== 'boss') return;
  // 코인 보상 (모디파이어/시너지 멀티플라이어 적용)
  const base = a.coins;
  const v = Math.max(1, Math.floor(base * (state.coinGainMult || 1) * (state.globalScoreMult || 1)));
  state.coins += v;
  emit({ type: 'COIN_GAIN', value: v, x: a.x, y: a.y, reason: 'kill' });

  // 처치 streak = 콤보로 매핑
  const before = state.combo;
  state.combo = a.streak;
  if (state.combo !== before) emit({ type: 'COMBO_CHANGE', from: before, to: state.combo });
  if (state.combo > state.comboMaxThisWave) state.comboMaxThisWave = state.combo;
  if (state.combo > state.comboMaxRun) {
    state.comboMaxRun = state.combo;
    state.stats.highlightEvents.push({ t: state.elapsed, type: 'maxCombo', payload: { combo: state.combo } });
  }
  // 임계값 도달 시 효과
  if (COMBO_THRESHOLD_SET.has(state.combo) && state.combo > before) {
    const lvl = state.combo as 3 | 5 | 10 | 25 | 50 | 100 | 200 | 500;
    emit({ type: 'COMBO_THRESHOLD', level: lvl });
    emit({ type: 'SFX', id: `sfx_combo_${lvl}` });
    const mult = COMBO_MULT[lvl] ?? 1;
    if (mult !== 1) {
      const bonus = Math.floor(applyMultipliers(state.combo * 10, state, { op: 'addCoins' }) * mult);
      state.coins += bonus;
      emit({ type: 'COIN_GAIN', value: bonus, x: a.x, y: a.y, reason: `combo×${lvl}` });
      emit({ type: 'NUMBER_POPUP', text: `+${fmtBig(bonus)} ×${mult}`, x: a.x ?? 0, y: a.y ?? 0, color: '#ffd700', size: lvl >= 25 ? 48 : 32 });
    }
    const shake = COMBO_SHAKE[lvl];
    if (shake) emit({ type: 'SCREEN_SHAKE', intensity: shake[0], duration: shake[1] });
    if (COMBO_BGM_L4[lvl]) emit({ type: 'BGM_LAYER', layer: 3, target: 1, ramp: 0.5 });
    dispatchTrigger(state, 'onCombo', emit, { data: { level: lvl } });
  }
  emit({ type: 'PARTICLE', kind: 'spark', x: a.x ?? 0, y: a.y ?? 0, count: 6 });
  emit({ type: 'SFX', id: state.combo >= 25 ? 'sfx_tap_super' : state.combo >= 10 ? 'sfx_tap_high' : 'sfx_tap_mid' });
}

function handlePickup(state: GameState, a: { coins?: number; xp?: number; x?: number; y?: number; kind?: string }, emit: (e: EngineEvent) => void) {
  if (a.coins) {
    const v = Math.max(1, Math.floor(a.coins * (state.coinGainMult || 1)));
    state.coins += v;
    emit({ type: 'COIN_GAIN', value: v, x: a.x, y: a.y, reason: 'pickup' });
    emit({ type: 'NUMBER_POPUP', text: `+${fmtBig(v)}`, x: a.x ?? 0, y: a.y ?? 0, color: '#ffd700', size: 18 });
  }
  switch (a.kind) {
    case 'heart':
      state.life = Math.min(state.lifeMax, state.life + 1);
      emit({ type: 'TEXT_BANNER', text: '+1 ♥', durationMs: 800 });
      emit({ type: 'SFX', id: 'sfx_pickup_heart' });
      break;
    case 'magnet':
      emit({ type: 'TEXT_BANNER', text: 'MAGNET', durationMs: 800 });
      emit({ type: 'SFX', id: 'sfx_pickup_magnet' });
      break;
    case 'bomb':
      emit({ type: 'TEXT_BANNER', text: 'BOMB!', durationMs: 800 });
      emit({ type: 'SCREEN_SHAKE', intensity: 8, duration: 0.3 });
      emit({ type: 'SFX', id: 'sfx_pickup_bomb' });
      break;
    case 'chest':
      state.coins += 50;
      if (Math.random() < 0.34) state.life = Math.min(state.lifeMax, state.life + 1);
      emit({ type: 'TEXT_BANNER', text: 'CHEST +50', durationMs: 1000 });
      emit({ type: 'SFX', id: 'sfx_pickup_chest' });
      break;
    case 'xp':
      emit({ type: 'SFX', id: 'sfx_pickup_xp' });
      break;
    default:
      emit({ type: 'SFX', id: 'sfx_pickup_coin' });
  }
}

function handlePlayerHit(state: GameState, a: { dmg: number; cause?: string }, emit: (e: EngineEvent) => void) {
  if (state.phase !== 'playing' && state.phase !== 'boss') return;
  // 단발 — 무적 0.8s 가 worldTick 에서 보장. 부딪히면 무조건 라이프 -1.
  // ⭐ death recap — 마지막 피격 원인 기록
  state.stats.lastHitCause = a.cause ?? 'unknown';
  state.stats.lastHitDmg = a.dmg;
  state.stats.lastHitWave = state.wave;
  state.stats.lastHitTime = state.elapsed;
  handleLifeLoss(state, emit);
  // 콤보 끊김 (피격)
  if (state.combo > 0) {
    const before = state.combo;
    state.combo = 0;
    emit({ type: 'COMBO_CHANGE', from: before, to: 0, reason: 'hit' });
    emit({ type: 'BGM_LAYER', layer: 3, target: 0, ramp: 1.5 }); // 클라이맥스 레이어 OFF (stickiness fix)
  }
}

// ⭐ Prop 가 부여하는 영구 버프 (shrine prayer 등).
function handleBuffGain(state: GameState, a: { kind: 'maxHpPermanent'; amount: number }, emit: (e: EngineEvent) => void) {
  if (a.kind === 'maxHpPermanent') {
    const n = Math.max(1, a.amount | 0);
    state.lifeMax += n;
    state.life = Math.min(state.lifeMax, state.life + n);
    emit({ type: 'TEXT_BANNER', text: `+${n} 최대 ♥ · 기도 완료`, durationMs: 1500 });
    emit({ type: 'SFX', id: 'sfx_synergy_gold_5', volume: 0.8 });
  }
}

function handleGameOver(state: GameState, emit: (e: EngineEvent) => void) {
  state.phase = 'over';
  state.totalScore += state.coins;
  emit({ type: 'GAME_OVER' });
  emit({ type: 'SFX', id: 'sfx_game_over' });
  // RP 환산 — 메타 변화도 reducer 가 책임
  const totalCoinsAfter = state.meta.totalCoins + state.totalScore;
  const rpEarned = Math.floor(state.totalScore / 10000) * (1 + state.meta.rpRateBonus);
  // ⭐ 윤회 계승 — 가장 많이 픽한 태그의 마지막 카드 1장 (없으면 가장 마지막 카드)
  // 카드 0장이면 legacyCardId 미변경 (이전 계승 유지).
  let legacyCardId = state.meta.legacyCardId;
  if (state.cards.length > 0) {
    const counts: Record<string, number> = {};
    for (const c of state.cards) for (const tg of c.tags) counts[tg] = (counts[tg] ?? 0) + 1;
    let dominantTag = '';
    let maxN = 0;
    for (const [tg, n] of Object.entries(counts)) {
      if (n > maxN) { maxN = n; dominantTag = tg; }
    }
    // 도미넌트 태그의 마지막 카드 (가장 늦게 픽한 카드)
    for (let i = state.cards.length - 1; i >= 0; i--) {
      if (state.cards[i].tags.includes(dominantTag as any)) {
        legacyCardId = state.cards[i].id;
        break;
      }
    }
    // 도미넌트 태그가 없으면 (모두 0) 마지막 카드
    if (!legacyCardId) legacyCardId = state.cards[state.cards.length - 1].id;
  }
  // ⭐ 첫 5런 보장 RP 부스트 — 각 런마다 정해진 보너스 RP. retention 핵심.
  // 1: +20 / 2: +30 / 3: +50 / 4: +75 / 5: +100 (총 +275 RP — 첫 사원 강화 충분)
  const cycleAfter = state.meta.totalCycles + 1;
  const FIRST_RUN_BONUS_RP: Record<number, number> = { 1: 20, 2: 30, 3: 50, 4: 75, 5: 100 };
  const bonusRp = FIRST_RUN_BONUS_RP[cycleAfter] ?? 0;
  // ⭐ 게임오버 화면 표시용 — 실제 메타에 누적되는 총 RP(점수분 + 첫5런 보너스)와 동일하게.
  //   이게 없으면 화면은 점수분(floor(score/1e4))만 보여 첫 사망마다 "+0 RP" 로 보이는 버그.
  state.stats.rpEarnedThisRun = Math.floor(rpEarned) + bonusRp;

  // ⭐ 깊이 가시화 — 평생 발견 집합 누적 (RI 28종 / 시너지 18종).
  // 게임오버 화면이 "N / 28 발견" 으로 시스템 폭을 노출. 카드는 누적만 되므로
  // state.runIdentity / state.activeSynergies 는 이 런의 최종 도달 집합 = 경험 집합.
  const prevIds = new Set(state.meta.seenIdentityIds ?? []);
  const prevSyn = new Set(state.meta.seenSynergyIds ?? []);
  const seenIdentityIds = [...prevIds];
  let newIdentityThisRun = false;
  if (state.runIdentity && !prevIds.has(state.runIdentity)) {
    seenIdentityIds.push(state.runIdentity);
    newIdentityThisRun = true;
  }
  const seenSynergyIds = [...prevSyn];
  let newSynergyThisRun = 0;
  for (const sid of state.activeSynergies) {
    if (!prevSyn.has(sid)) { seenSynergyIds.push(sid); newSynergyThisRun++; }
  }
  state.stats.newIdentityThisRun = newIdentityThisRun;
  state.stats.newSynergyThisRun = newSynergyThisRun;

  // ⭐ 모디파이어/biome 평생 발견 누적 + 이번 런 신규 카운트 (RI/시너지와 동일 패턴).
  //   run-scoped 집합(state.stats.modifierIds / biomeIds)을 meta 로 머지하며,
  //   기존 평생 집합에 없던 id 수 = 이번 런 신규 (게임오버 "신규 발견" 배지용).
  const mergeSeenCounting = (
    prev: string[] | undefined, run: string[] | undefined,
  ): { merged: string[]; newCount: number } => {
    const set = new Set(prev ?? []);
    let newCount = 0;
    for (const id of run ?? []) {
      if (!set.has(id)) { set.add(id); newCount++; }
    }
    return { merged: [...set], newCount };
  };
  const modMerge = mergeSeenCounting(state.meta.seenModifierIds, state.stats.modifierIds);
  const biomeMerge = mergeSeenCounting(state.meta.seenBiomeIds, state.stats.biomeIds);
  const seenModifierIds = modMerge.merged;
  const seenBiomeIds = biomeMerge.merged;
  state.stats.newModifierThisRun = modMerge.newCount;
  state.stats.newBiomeThisRun = biomeMerge.newCount;

  state.meta = {
    ...state.meta,
    totalCoins: totalCoinsAfter,
    totalCycles: cycleAfter,
    rp: state.meta.rp + Math.floor(rpEarned) + bonusRp,
    bestScore: Math.max(state.meta.bestScore, state.totalScore),
    legacyCardId,
    seenIdentityIds,
    seenSynergyIds,
    seenModifierIds,
    seenBiomeIds,
  };

  // 보너스 토스트 — main.ts 가 GAME_OVER 이벤트 수신 시 별도 처리. 메모만 추가.
  if (bonusRp > 0) {
    emit({ type: 'TEXT_BANNER', text: `+${bonusRp} RP 보너스  ·  환생 ${cycleAfter}회차`, durationMs: 2200 });
  }
}
