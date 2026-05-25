// SAMSARA · 윤회 — 게임 코어 루프 (engine)
//
// reducer + RAF 루프를 묶어 외부에 단일 인터페이스 제공.
// - dispatch(action): reducer 통과 → state 갱신 + 이벤트 발행
// - subscribeState(fn): state 변화 구독 (UI/렌더 용)
// - subscribeEvents(fn): 사이드 이펙트 이벤트 구독 (오디오/파티클/카메라 용)
// - start() / stop() / pause() / resume()
//
// RAF 루프는 매 프레임 TICK action 을 dispatch. dt 는 ms.
// 백그라운드 탭 시 dt 가 폭주할 수 있으므로 50ms 로 클램프.

import { drawCards, newGameState, setRngSeed } from './cards.js';
import { reduce } from './state.js';
import type { Action, Card, EngineEvent, GameState } from './types.js';

export type StateListener = (s: GameState) => void;
export type EventListener = (e: EngineEvent) => void;

const MAX_DT_MS = 50;          // 폭주 방지 (모바일 백그라운드 복귀 등)
const TARGET_FPS = 60;

export interface EngineOptions {
  seed?: number;
  meta?: Partial<GameState['meta']>;
}

export class Engine {
  private state: GameState;
  private stateListeners = new Set<StateListener>();
  private eventListeners = new Set<EventListener>();
  private rafId: number | null = null;
  private lastFrameMs = 0;
  private fpsAcc = 0;
  private fpsCount = 0;
  private fpsLast = 0;
  fps = TARGET_FPS;

  constructor(opts: EngineOptions = {}) {
    if (opts.seed != null) setRngSeed(opts.seed);
    this.state = newGameState(opts.meta);
  }

  /** 외부 read-only 접근 — 변경 X. (테스트 외엔 mutate 금지) */
  getState(): Readonly<GameState> { return this.state; }

  /** state 변경 구독. 즉시 1회 콜백. */
  subscribeState(fn: StateListener): () => void {
    this.stateListeners.add(fn);
    fn(this.state);
    return () => this.stateListeners.delete(fn);
  }

  /** 사이드 이펙트 이벤트 구독 (오디오/파티클/카메라/UI). */
  subscribeEvents(fn: EventListener): () => void {
    this.eventListeners.add(fn);
    return () => this.eventListeners.delete(fn);
  }

  /** action 디스패치 — 동기. 호출 즉시 state/events 반영. */
  dispatch(action: Action): void {
    const { state, events } = reduce(this.state, action);
    this.state = state;
    for (const e of events) for (const l of this.eventListeners) l(e);
    for (const l of this.stateListeners) l(this.state);
  }

  /** RAF 게임 루프 시작. 이미 동작 중이면 no-op. */
  start(): void {
    if (this.rafId != null) return;
    this.lastFrameMs = performance.now();
    this.fpsLast = this.lastFrameMs;
    const tick = (now: number) => {
      const rawDt = now - this.lastFrameMs;
      this.lastFrameMs = now;
      const dtMs = Math.min(MAX_DT_MS, rawDt);
      const dtSec = dtMs / 1000;
      this.dispatch({ type: 'TICK', dt: dtSec, t: now });

      // FPS 측정 (1초 평균)
      this.fpsAcc += dtMs;
      this.fpsCount += 1;
      if (now - this.fpsLast >= 1000) {
        this.fps = Math.round((this.fpsCount * 1000) / Math.max(1, this.fpsAcc));
        this.fpsAcc = 0;
        this.fpsCount = 0;
        this.fpsLast = now;
      }

      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** 새 사이클 시작 (게임 시작 / 게임 오버 후 다시). 100ms 내 재호출은 무시 (더블 클릭 가드). */
  private _lastNewRunMs = 0;
  newRun(opts: EngineOptions = {}): void {
    const now = performance.now();
    if (now - this._lastNewRunMs < 100) return;
    this._lastNewRunMs = now;
    if (opts.seed != null) setRngSeed(opts.seed);
    this.state = newGameState({ ...this.state.meta, ...opts.meta });
    for (const l of this.stateListeners) l(this.state);
  }

  /** 카드 선택지 N 장 드로우 (cards 헬퍼 위임) — forceNextCardRarity 가 있으면 소비.
   *  ⭐ 같은 태그 3장 방지 + 시너지 임계 직전 태그 가중 (Pick-1-of-3 design 개선).
   */
  drawCardChoices(count: number = 3): Card[] {
    const unlocked = this.state.meta.unlockedCardIds.length > 0 ? this.state.meta.unlockedCardIds : undefined;
    const forced = this.state.forceNextCardRarity;

    // 후보 풀을 더 많이 뽑아 다양성 + 시너지 가중 적용
    const overdraw = Math.max(count + 3, count * 2);
    const pool = drawCards(overdraw, unlocked, forced);
    if (forced) this.state.forceNextCardRarity = null;

    // 보유 카드의 태그 분포 → 다음 시너지(3/5/7) 까지 거리 계산
    const ownedCounts: Record<string, number> = { fire: 0, ice: 0, gold: 0, time: 0, chaos: 0, echo: 0 };
    for (const c of this.state.cards as Card[]) for (const tg of c.tags) ownedCounts[tg] = (ownedCounts[tg] ?? 0) + 1;
    const distanceToNextSynergy = (tag: string): number => {
      const n = ownedCounts[tag] ?? 0;
      if (n < 3) return 3 - n;
      if (n < 5) return 5 - n;
      if (n < 7) return 7 - n;
      return 99; // 이미 7+ 인 태그는 페널티
    };

    // 카드 점수 = (시너지 임계 거리 가까울수록 +) - (이미 picked 동일 태그면 -)
    const picked: Card[] = [];
    const usedTagFreq: Record<string, number> = {};
    while (picked.length < count && pool.length > 0) {
      let bestIdx = 0; let bestScore = -Infinity;
      for (let i = 0; i < pool.length; i++) {
        const c = pool[i];
        let score = 0;
        for (const tg of c.tags) {
          const d = distanceToNextSynergy(tg);
          // 시너지 1장 직전 = +5, 2장 직전 = +2, 그 외 +0
          if (d === 1) score += 5;
          else if (d === 2) score += 2;
          // 이미 picked 같은 태그면 강한 페널티 (다양성)
          score -= (usedTagFreq[tg] ?? 0) * 4;
        }
        // 동률 방지 + 약간의 무작위성
        score += Math.random() * 0.5;
        if (score > bestScore) { bestScore = score; bestIdx = i; }
      }
      const chosen = pool.splice(bestIdx, 1)[0];
      picked.push(chosen);
      for (const tg of chosen.tags) usedTagFreq[tg] = (usedTagFreq[tg] ?? 0) + 1;
    }
    return picked;
  }

  /** 입력 좌표 → TAP action (캔버스 좌표는 호출자가 변환) */
  tap(x?: number, y?: number, t: number = performance.now()): void {
    this.dispatch({ type: 'TAP', x, y, t });
  }

  /** 다음 웨이브 시작 */
  startWave(wave?: number): void {
    this.dispatch({ type: 'START_WAVE', wave: wave ?? this.state.wave + 1 });
  }
}

// ─────────────────────────── 일일 시드 ───────────────────────────

/** 지역 자정 기준 yyyymmdd 해시 → mulberry32 시드. */
export function dailySeed(date: Date = new Date()): number {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return hash32(`${y}${m}${d}`);
}

function hash32(s: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0 || 1;
}

// ─────────────────────────── localStorage 메타 영속화 ───────────────────────────

const META_KEY = 'samsara.meta.v1';
const META_KEY_V2 = 'samsara.meta.v2';
const SCHEMA_VERSION = 2;

interface MetaEnvelope {
  schema: number;
  data: any;
  savedAt: string;
}

type Migration = (data: any) => any;

const MIGRATIONS: Record<number, Migration> = {
  // 1 → 2: character 필드 추가, language → ko/en 정규화
  2: (data: any) => ({
    ...data,
    character: data.character ?? 'tiger',
    language: data.language === 'en' ? 'en' : 'ko',
  }),
};

export function loadMeta(): Partial<GameState['meta']> | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    // v2 우선 시도
    const v2raw = localStorage.getItem(META_KEY_V2);
    if (v2raw) {
      const env = JSON.parse(v2raw) as MetaEnvelope;
      let data = env.data;
      // 미래 버전 마이그레이션 체인
      for (let v = (env.schema ?? 1) + 1; v <= SCHEMA_VERSION; v++) {
        if (MIGRATIONS[v]) data = MIGRATIONS[v](data);
      }
      return data;
    }
    // v1 호환 (legacy 평문 객체)
    const v1raw = localStorage.getItem(META_KEY);
    if (v1raw) {
      let data = JSON.parse(v1raw);
      for (let v = 2; v <= SCHEMA_VERSION; v++) {
        if (MIGRATIONS[v]) data = MIGRATIONS[v](data);
      }
      // v2 로 저장 + v1 정리
      const env: MetaEnvelope = { schema: SCHEMA_VERSION, data, savedAt: new Date().toISOString() };
      localStorage.setItem(META_KEY_V2, JSON.stringify(env));
      try { localStorage.removeItem(META_KEY); } catch {}
      return data;
    }
    return null;
  } catch (err) {
    console.warn('[meta load failed]', err);
    return null;
  }
}

export function saveMeta(meta: GameState['meta']): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const env: MetaEnvelope = {
      schema: SCHEMA_VERSION,
      data: meta,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(META_KEY_V2, JSON.stringify(env));
  } catch (err) {
    console.warn('[meta save failed — quota exceeded?]', err);
    // quota 초과 시 단순 통계만 보존
    try {
      const minimal = {
        rp: meta.rp, totalCycles: meta.totalCycles, bestScore: meta.bestScore,
        unlockedCardIds: meta.unlockedCardIds.slice(-10),
      };
      localStorage.setItem(META_KEY_V2, JSON.stringify({ schema: SCHEMA_VERSION, data: minimal, savedAt: new Date().toISOString() }));
    } catch { /* total give up */ }
  }
}
