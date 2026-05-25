// SAMSARA · 윤회 — 모디파이어 시스템
//
// 매 웨이브 시작 시 무작위 1개 배정 (+ 시너지/카드로 추가). 효과는 즉시 dispatch.
// 비밀 모디파이어 5개는 잠금 해제 조건 만족 시에만 풀에 등장.

import { DATA, OPS, rng } from './cards.js';
import type { GameState, ModifierDef, EngineEvent, TriggerContext } from './types.js';

const SECRET_UNLOCK_KEY = 'samsara.modifier.unlocks.v1';

export interface ModifierUnlocks {
  ids: string[];
}

export function loadModifierUnlocks(): ModifierUnlocks {
  try {
    if (typeof localStorage === 'undefined') return { ids: [] };
    const raw = localStorage.getItem(SECRET_UNLOCK_KEY);
    return raw ? JSON.parse(raw) : { ids: [] };
  } catch { return { ids: [] }; }
}

export function saveModifierUnlocks(u: ModifierUnlocks): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SECRET_UNLOCK_KEY, JSON.stringify(u));
  } catch { /* quota — ignore */ }
}

/** 비밀 모디파이어 잠금해제 조건 체크 (런 진행 중 호출). 새로 잠금해제된 ID 반환. */
export function checkSecretUnlocks(state: GameState): string[] {
  const u = loadModifierUnlocks();
  const newly: string[] = [];
  const has = (id: string) => u.ids.includes(id);
  const unlock = (id: string) => { if (!has(id)) { u.ids.push(id); newly.push(id); } };

  // mod_secret_dice — 라이프 1 으로 보스 격파 (state.life === 1 + bossesDefeated 증가 시)
  if (state.life === 1 && state.stats.bossesDefeated > 0) unlock('mod_secret_dice');
  // mod_secret_dragon — 콤보 100 도달
  if (state.comboMaxRun >= 100) unlock('mod_secret_dragon');
  // mod_secret_void — 카드 0장으로 W5 도달
  if (state.cards.length === 0 && state.wave >= 5) unlock('mod_secret_void');
  // mod_secret_rift — 7 시너지 1개라도 발동
  if (state.activeSynergies.some(id => id.endsWith('7'))) unlock('mod_secret_rift');
  // mod_secret_fate — 일일 시드 1위 (외부 리더보드 신호 필요 — 일단 누적사이클 100+ 로 가짜 조건)
  if (state.meta.totalCycles >= 100) unlock('mod_secret_fate');

  if (newly.length) saveModifierUnlocks(u);
  return newly;
}

/** 본 웨이브에 적용할 모디파이어 1개 추첨. */
export function pickModifier(state: GameState): ModifierDef | null {
  const u = loadModifierUnlocks();
  const pool = DATA.modifiers.filter(m => {
    if (m.type !== 'secret') return true;
    return u.ids.includes(m.id);
  });
  if (pool.length === 0) return null;

  // ⭐ 일일 시련 — W1/2/3 은 일일 시드 결정 모디파이어 강제 (research P0)
  // 매일 모든 플레이어가 같은 3 모디파이어로 시작 → 글로벌 리더보드 공정성 + 매일 재방문 동기.
  // (W4+ 부터 일반 추첨 — 카드 빌드 + 일일 시련 조합의 다양성 확보)
  if (state.wave >= 1 && state.wave <= 3) {
    const daily = getDailyChallengeMods();
    const picked = daily[state.wave - 1];
    if (picked) {
      const def = DATA.modifiers.find(m => m.id === picked);
      if (def) return def;
    }
  }

  // 도전형은 W3 부터 등장, 비밀은 잠금해제 후
  const filtered = pool.filter(m => {
    if (m.type === 'challenge' && state.wave < 3) return false;
    return true;
  });
  const picked = filtered.length ? filtered : pool;
  return picked[Math.floor(rng() * picked.length)];
}

// ⭐ 일일 시련 — 매일 자정 기준 결정적 3 모디파이어 선택.
// W1=축복 (가벼운 시작) / W2=축복+도전 혼합 / W3=도전 (시련의 절정)
// 캐시: 메모리 (호출 패턴이 반복적이므로 fresh date 검증)
let _dailyModsCache: { dateKey: string; ids: string[] } | null = null;

export function getDailyChallengeMods(date: Date = new Date()): string[] {
  const dk = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  if (_dailyModsCache && _dailyModsCache.dateKey === dk) return _dailyModsCache.ids;

  // 결정적 PRNG (FNV-1a + LCG, seedable)
  let h = 0x811c9dc5;
  for (let i = 0; i < dk.length; i++) { h ^= dk.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  let s = h >>> 0 || 1;
  const next = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s & 0xffff) / 0x10000; };

  const blessings = DATA.modifiers.filter(m => m.type === 'blessing');
  const challenges = DATA.modifiers.filter(m => m.type === 'challenge');
  const pickFrom = (arr: ModifierDef[]): ModifierDef | undefined => arr.length ? arr[Math.floor(next() * arr.length)] : undefined;

  // W1: 축복 / W2: 축복(다른 것) / W3: 도전
  const w1 = pickFrom(blessings);
  const w2 = pickFrom(blessings.filter(m => m.id !== w1?.id));
  const w3 = pickFrom(challenges);

  const ids = [w1?.id, w2?.id, w3?.id].filter((x): x is string => !!x);
  _dailyModsCache = { dateKey: dk, ids };
  return ids;
}

/** 일일 시련 모디파이어 정의 3개 (UI 표시용). */
export function getDailyChallengeDefs(date: Date = new Date()): ModifierDef[] {
  return getDailyChallengeMods(date)
    .map(id => DATA.modifiers.find(m => m.id === id))
    .filter((m): m is ModifierDef => !!m);
}

/** 모디파이어 효과 즉시 적용 — 트리거 onWaveStart 효과만 즉시 발동. 그 외는 보유 상태로만. */
export function applyModifier(state: GameState, mod: ModifierDef, emit: (e: EngineEvent) => void): void {
  state.modifierThisWave = mod;
  emit({ type: 'TEXT_BANNER', text: mod.name_ko, durationMs: 1500 });
  emit({
    type: 'SFX',
    id: mod.type === 'blessing' ? 'sfx_modifier_blessing'
      : mod.type === 'challenge' ? 'sfx_modifier_challenge'
      : 'sfx_modifier_secret',
  });

  // onWaveStart 트리거가 명시된 효과는 즉시. 트리거가 없거나 그 외는 즉시 1회 적용.
  for (const eff of mod.effects) {
    if (eff.trigger && eff.trigger !== 'onWaveStart') continue;
    const handler = OPS[eff.op];
    if (!handler) continue;
    const ctx: TriggerContext = {
      trigger: 'onWaveStart',
      state,
      emit,
      dispatch: () => {},
    };
    try { handler(eff, ctx); } catch (err) { console.error('[modifier]', mod.id, eff.op, err); }
  }
}
