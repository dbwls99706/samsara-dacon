import { describe, expect, it } from 'vitest';
import ko from '../src/data/i18n/ko.json';
import en from '../src/data/i18n/en.json';
import ach from '../src/data/achievements.json';

function flatten(obj: unknown, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    out[prefix] = obj;
    return out;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${k}` : k;
    flatten(v, next, out);
  }
  return out;
}

describe('i18n 키 동기화 (regression guard)', () => {
  it('ko.json 와 en.json 의 키 집합이 정확히 일치한다', () => {
    const fk = Object.keys(flatten(ko)).sort();
    const fe = Object.keys(flatten(en)).sort();

    const missingInEn = fk.filter(k => !fe.includes(k));
    const missingInKo = fe.filter(k => !fk.includes(k));

    expect(missingInEn, `EN 누락: ${missingInEn.slice(0, 5).join(', ')}`).toEqual([]);
    expect(missingInKo, `KO 누락: ${missingInKo.slice(0, 5).join(', ')}`).toEqual([]);
  });

  it('모든 i18n 값이 빈 문자열이 아니다', () => {
    const fk = flatten(ko);
    const fe = flatten(en);

    const koEmpty = Object.entries(fk).filter(([, v]) => typeof v === 'string' && v.trim() === '');
    const enEmpty = Object.entries(fe).filter(([, v]) => typeof v === 'string' && v.trim() === '');

    expect(koEmpty.map(([k]) => k), `KO 빈 값: ${koEmpty.slice(0, 3).map(([k]) => k).join(', ')}`).toEqual([]);
    expect(enEmpty.map(([k]) => k), `EN 빈 값: ${enEmpty.slice(0, 3).map(([k]) => k).join(', ')}`).toEqual([]);
  });
});

describe('업적 카탈로그 (기획서 일치)', () => {
  const list = (ach as { achievements: { id: string }[] }).achievements;

  it('achievements.json 은 정확히 50개 업적을 정의한다', () => {
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(50);
  });

  it('업적 ID 는 고유하다', () => {
    const ids = list.map(a => a.id);
    const unique = new Set(ids);

    expect(unique.size).toBe(ids.length);
  });
});
