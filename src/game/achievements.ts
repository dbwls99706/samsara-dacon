// SAMSARA · 윤회 — 업적 50개 트래커
//
// 매 게임 오버 시 + 일부 게임 중 이벤트 발생 시 체크.
// 잠금해제는 localStorage 영구.

import achData from '../data/achievements.json' with { type: 'json' };
import type { GameState } from './types.js';

interface AchDef {
  id: string;
  category: string;
  name_ko: string;
  desc_ko: string;
  check: string;
}

const DATA = achData as { achievements: AchDef[] };
const KEY = 'samsara.achievements.v1';
const TRACK_KEY = 'samsara.tracker.v1';

export interface Tracker {
  unlocked: string[];
  uniqueCardsPicked: string[];
  identityIds: string[];
  cardTagPicked: Record<string, string[]>;
  totalBossesDefeated: number;
  divineBossDefeated: number;
  megaBossDefeated: number;
  bossOneLife: number;
  fastestBossSec: number;
  qteSuccess: number;
  secretCardsFound: number;
  secretModsFound: number;
  legendaryPicked: number;
  cardsThisRun: number;
  noCardsW5: boolean;
  wave30NoLifeLoss: boolean;
  dailyTop1: boolean;
  streakDays: number;
  totalDays: number;
  lastPlayedDate: string;
  transcended: boolean;
  synergyTriggers: string[];
}

const EMPTY_TRACKER: Tracker = {
  unlocked: [],
  uniqueCardsPicked: [],
  identityIds: [],
  cardTagPicked: { fire: [], ice: [], gold: [], time: [], chaos: [], echo: [] },
  totalBossesDefeated: 0,
  divineBossDefeated: 0,
  megaBossDefeated: 0,
  bossOneLife: 0,
  fastestBossSec: Infinity,
  qteSuccess: 0,
  secretCardsFound: 0,
  secretModsFound: 0,
  legendaryPicked: 0,
  cardsThisRun: 0,
  noCardsW5: false,
  wave30NoLifeLoss: false,
  dailyTop1: false,
  streakDays: 0,
  totalDays: 0,
  lastPlayedDate: '',
  transcended: false,
  synergyTriggers: [],
};

export function loadTracker(): Tracker {
  try {
    if (typeof localStorage === 'undefined') return { ...EMPTY_TRACKER };
    const raw = localStorage.getItem(TRACK_KEY);
    if (!raw) return { ...EMPTY_TRACKER };
    const parsed = JSON.parse(raw);
    return { ...EMPTY_TRACKER, ...parsed };
  } catch { return { ...EMPTY_TRACKER }; }
}

export function saveTracker(t: Tracker): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(TRACK_KEY, JSON.stringify(t)); } catch {}
}

/** 매 카드 선택 시 호출 */
export function trackCardPick(card: import('./types.js').Card, tracker: Tracker): void {
  if (!tracker.uniqueCardsPicked.includes(card.id)) tracker.uniqueCardsPicked.push(card.id);
  for (const tag of card.tags) {
    if (!tracker.cardTagPicked[tag]) tracker.cardTagPicked[tag] = [];
    if (!tracker.cardTagPicked[tag].includes(card.id)) tracker.cardTagPicked[tag].push(card.id);
  }
  if (card.rarity === 'legendary') tracker.legendaryPicked += 1;
  tracker.cardsThisRun += 1;
}

/** 업적 평가 — 잠금해제된 업적 ID 배열 반환 */
export function evaluate(state: GameState, tracker: Tracker): string[] {
  const newly: string[] = [];
  const meta = state.meta;
  const ctx: Record<string, any> = {
    totalCycles: meta.totalCycles,
    totalCoins: meta.totalCoins,
    bestScore: meta.bestScore,
    comboMaxRun: state.comboMaxRun,
    tapsTotal: state.stats.tapsTotal,
    bossesDefeated: state.stats.bossesDefeated,
    cardTagPicked: Object.fromEntries(Object.entries(tracker.cardTagPicked).map(([k, v]) => [k, v.length])),
    uniqueCardsPicked: tracker.uniqueCardsPicked.length,
    synergyTriggers: tracker.synergyTriggers.length,
    identityTriggered: tracker.identityIds.length,
    secretCardsFound: tracker.secretCardsFound,
    secretModsFound: tracker.secretModsFound,
    legendaryPicked: tracker.legendaryPicked,
    identityIds: Object.fromEntries(tracker.identityIds.map(id => [id, true])),
    noCardsW5: tracker.noCardsW5,
    cardsThisRun: tracker.cardsThisRun,
    totalBossesDefeated: tracker.totalBossesDefeated,
    divineBossDefeated: tracker.divineBossDefeated,
    megaBossDefeated: tracker.megaBossDefeated,
    bossOneLife: tracker.bossOneLife,
    fastestBossSec: tracker.fastestBossSec,
    qteSuccess: tracker.qteSuccess,
    wave30NoLifeLoss: tracker.wave30NoLifeLoss,
    dailyTop1: tracker.dailyTop1,
    streakDays: tracker.streakDays,
    totalDays: tracker.totalDays,
    transcended: tracker.transcended,
    alwaysTrue: true,
  };

  for (const a of DATA.achievements) {
    if (tracker.unlocked.includes(a.id)) continue;
    if (evalCheck(a.check, ctx)) {
      tracker.unlocked.push(a.id);
      newly.push(a.id);
    }
  }
  return newly;
}

/** 단순 DSL 평가: "key>=value" / "key.subkey" / "key" boolean */
function evalCheck(check: string, ctx: Record<string, any>): boolean {
  // dot notation
  if (check.includes('.')) {
    const [k, sub] = check.split('.');
    return !!(ctx[k]?.[sub]);
  }
  // 비교 연산자
  const ops = ['>=', '<=', '>', '<', '=='];
  for (const op of ops) {
    const i = check.indexOf(op);
    if (i < 0) continue;
    const lhs = check.slice(0, i).trim();
    const rhs = Number(check.slice(i + op.length).trim());
    const lv = Number(ctx[lhs] ?? 0);
    switch (op) {
      case '>=': return lv >= rhs;
      case '<=': return lv <= rhs;
      case '>':  return lv > rhs;
      case '<':  return lv < rhs;
      case '==': return lv === rhs;
    }
  }
  // boolean
  return !!ctx[check];
}

export function achievementById(id: string): AchDef | undefined {
  return DATA.achievements.find(a => a.id === id);
}

export function allAchievements(): AchDef[] { return DATA.achievements; }
