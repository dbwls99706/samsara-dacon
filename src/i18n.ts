// SAMSARA · 윤회 — i18n 헬퍼
//
// `t('key', { n: 5 })` 패턴. {var} 치환. 한국어 fallback.
// 언어 변경 시 `setLang(lang)` → 모든 onLangChange 구독자 재호출.

import koData from './data/i18n/ko.json' with { type: 'json' };
import enData from './data/i18n/en.json' with { type: 'json' };

export type Lang = 'ko' | 'en';

const TABLES: Record<Lang, Record<string, string>> = {
  ko: koData as Record<string, string>,
  en: enData as Record<string, string>,
};

let _lang: Lang = 'ko';
const listeners = new Set<(l: Lang) => void>();

export function setLang(lang: Lang): void {
  if (_lang === lang) return;
  _lang = lang;
  for (const l of listeners) l(lang);
}

export function getLang(): Lang { return _lang; }

export function onLangChange(fn: (l: Lang) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const table = TABLES[_lang] ?? TABLES.ko;
  let s = table[key] ?? TABLES.ko[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), String(v));
    }
  }
  return s;
}
