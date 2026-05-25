// SAMSARA · 윤회 — 익명 분석 이벤트
//
// 외부 서버에 보내지 않는다 (DACON 규정상 키 없는 백엔드 권장 + 개인정보 보호).
// localStorage 에 누적 → Settings 화면에서 "분석 데이터 내보내기" 가능.
//
// 추적 이벤트:
//  - run_start (캐릭터, RP 잠금해제 카드 수)
//  - run_end (점수, 웨이브, 생존 시간, 사망 사유, 카드 픽 빌드, RI)
//  - boss_defeat (보스 종류, 사용 시간, 남은 라이프)
//  - secret_unlock (시크릿 카드/모디파이어 ID)
//  - achievement_unlock (업적 ID)
//  - error (window.onerror 메시지 — debug 용)

const KEY = 'samsara.analytics.v1';
const MAX_EVENTS = 500;

export type AnalyticsEvent =
  | { type: 'run_start'; t: number; data: { character: string; cycle: number; rp: number } }
  | { type: 'run_end'; t: number; data: { score: number; wave: number; surviveSec: number; cause: 'gameover' | 'transcend'; build: string[]; ri: string | null } }
  | { type: 'boss_defeat'; t: number; data: { kind: string; timeUsed: number; lifeLeft: number } }
  | { type: 'secret_unlock'; t: number; data: { id: string } }
  | { type: 'achievement_unlock'; t: number; data: { id: string } }
  | { type: 'error'; t: number; data: { message: string; stack?: string } };

function load(): AnalyticsEvent[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function save(events: AnalyticsEvent[]) {
  try {
    if (typeof localStorage === 'undefined') return;
    // FIFO — 가장 오래된 것부터 제거
    const trimmed = events.slice(-MAX_EVENTS);
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch { /* quota — drop silently */ }
}

export function track(event: Omit<AnalyticsEvent, 't'>): void {
  const events = load();
  events.push({ ...event, t: Date.now() } as AnalyticsEvent);
  save(events);
  // 개발 빌드에서만 콘솔 출력
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.DEV) {
    console.log('[analytics]', event);
  }
}

export function getEvents(): AnalyticsEvent[] { return load(); }

export function clearEvents(): void {
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY); } catch {}
}

/** Settings 화면에서 사용 — JSON Blob 다운로드 */
export function exportEventsAsJSON(): string {
  return JSON.stringify(load(), null, 2);
}

/** 집계 — 가장 자주 발생한 사망 빌드, 평균 생존 시간 등 */
export function summarize(): {
  totalRuns: number;
  bossDefeats: number;
  avgSurviveSec: number;
  meanScore: number;
  unlockedSecrets: string[];
  unlockedAchievements: string[];
} {
  const events = load();
  const runs = events.filter(e => e.type === 'run_end') as Extract<AnalyticsEvent, { type: 'run_end' }>[];
  const bosses = events.filter(e => e.type === 'boss_defeat').length;
  const survSum = runs.reduce((s, r) => s + r.data.surviveSec, 0);
  const scoreSum = runs.reduce((s, r) => s + r.data.score, 0);
  const secrets = new Set<string>();
  const achs = new Set<string>();
  for (const e of events) {
    if (e.type === 'secret_unlock') secrets.add(e.data.id);
    if (e.type === 'achievement_unlock') achs.add(e.data.id);
  }
  return {
    totalRuns: runs.length,
    bossDefeats: bosses,
    avgSurviveSec: runs.length ? survSum / runs.length : 0,
    meanScore: runs.length ? scoreSum / runs.length : 0,
    unlockedSecrets: [...secrets],
    unlockedAchievements: [...achs],
  };
}
