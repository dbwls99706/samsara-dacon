// SAMSARA · 윤회 — 9 화면 라우터
//
// 화면 종류: home / tutorial / play / cardPick / boss / ritual / metaShop / leaderboard / settings / highlight / over / transcend
// 단순 hash-less SPA — phase 와 user nav 의 조합으로 표시 결정.

export type Screen =
  | 'home'
  | 'tutorial'
  | 'play'
  | 'cardPick'
  | 'ritual'
  | 'metaShop'
  | 'leaderboard'
  | 'settings'
  | 'highlight'
  | 'achievements'
  | 'codex'
  | 'characterSelect'
  | 'over'
  | 'transcend';

type Listener = (s: Screen) => void;

let current: Screen = 'home';
const listeners = new Set<Listener>();

export function getScreen(): Screen { return current; }

export function go(s: Screen): void {
  if (current === s) return;
  current = s;
  for (const l of listeners) l(s);
}

export function onScreen(fn: Listener): () => void {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}
