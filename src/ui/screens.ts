// SAMSARA · 윤회 — 화면 컴포넌트 (DOM 직접 조작 — 라이브러리 X)
//
// 각 화면은 `mount(host) -> unmount` 패턴. 라우터가 전환 시 unmount/mount.

import type { Engine } from '../game/core.js';
import { dailySeed, saveMeta } from '../game/core.js';
import { drawLegendaryChoices, drawRitualChoices, RITUAL_CARDS } from '../game/boss.js';
import { allCards, allSynergies, allRunIdentities, allModifierDefs, formatNum, tagCounts } from '../game/cards.js';
import { BIOME_KINDS } from '../game/terrain.js';
import type { Card, CardTag, Rarity } from '../game/types.js';
import { setBgmVolume } from '../audio/bgm.js';
import { setSfxVolume } from '../audio/sfx.js';
import { go } from './router.js';
import { setLang, t } from '../i18n.js';
import { allAchievements, loadTracker, saveTracker, trackCardPick } from '../game/achievements.js';
import { buildReelPng, clearReel } from '../fx/highlight.js';
import { buildSharePng, shareImage } from '../fx/share.js';
import { setColorblindMode as setWorldColorblind } from '../game/world.js';
import { getDailyChallengeDefs } from '../game/modifiers.js';

const TAG_EMOJI: Record<string, string> = { fire: '🔥', ice: '❄️', gold: '💰', time: '⏱️', chaos: '🌀', echo: '🪞' };
const RARITY_COLOR: Record<Rarity, string> = { common: 'var(--text-dim)', rare: 'var(--rare)', epic: 'var(--epic)', legendary: 'var(--legendary)' };

// ⭐ localStorage safe wrappers — privacy mode / 쿼터 초과 시 throw 회피.
// (achievements.ts / cards.ts / modifiers.ts / core.ts 와 동일한 typeof + try 가드 패턴.)
function lsGetItem(k: string): string | null {
  try { if (typeof localStorage !== 'undefined') return localStorage.getItem(k); } catch { /* private mode SecurityError */ }
  return null;
}
function lsSetItem(k: string, v: string): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v); } catch { /* quota / privacy */ }
}

// ─────────────────────────── 공통 ───────────────────────────

function el(tag: string, style: string, html: string = ''): HTMLElement {
  const e = document.createElement(tag);
  e.style.cssText = style;
  e.innerHTML = html;
  return e;
}

function btn(text: string, onClick: () => void, primary = false): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = text;
  b.className = primary ? 'btn btn-primary' : 'btn btn-ghost';
  b.onclick = onClick;
  return b;
}

// ─────────────────────────── 공통 — 우주 배경 + 글래스 패널 ───────────────────────────

/**
 * Home/Tutorial 톤(별 + 성운 + 스캔라인)을 메뉴 화면에 일괄 주입.
 * Settings/MetaShop/Leaderboard/Achievements/Ritual 5개 화면에서 동일 호출.
 */
function injectCosmicKeyframes() {
  if (document.getElementById('samsara-menu-keyframes')) return;
  const kf = document.createElement('style');
  kf.id = 'samsara-menu-keyframes';
  kf.textContent = `
    @keyframes mn-twinkle { 0%,100% { opacity: 0.25; } 50% { opacity: 0.95; } }
    @keyframes mn-fade-up { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
    @keyframes mn-glow-pulse { 0%,100% { box-shadow: 0 0 16px rgba(5,217,232,0.2); } 50% { box-shadow: 0 0 28px rgba(5,217,232,0.4); } }
    @keyframes mn-scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100vh); } }
    @keyframes mn-back-arrow { 0%,100% { transform: translateX(0); } 50% { transform: translateX(-4px); } }
  `;
  document.head.appendChild(kf);
}

function cosmicBackdrop(starCount = 100, accentColor = 'rgba(5,217,232,0.4)'): HTMLElement[] {
  const layers: HTMLElement[] = [];
  // L0: 그라데이션
  layers.push(el('div', `
    position:absolute;inset:0;pointer-events:none;
    background:
      radial-gradient(ellipse at 25% 30%, rgba(177,74,255,0.20), transparent 45%),
      radial-gradient(ellipse at 75% 70%, rgba(5,217,232,0.16), transparent 50%),
      radial-gradient(ellipse at 50% 95%, rgba(255,42,109,0.14), transparent 50%),
      radial-gradient(ellipse at center, #0e0822 0%, #02010a 75%);
  `));
  // L1: 별
  const stars = el('div', 'position:absolute;inset:0;pointer-events:none');
  let h = '';
  for (let i = 0; i < starCount; i++) {
    const sz = Math.random() < 0.08 ? 2 : 1;
    const dur = 2 + Math.random() * 4;
    const dl = Math.random() * 4;
    const col = Math.random() < 0.15 ? '#ffd7e0' : Math.random() < 0.3 ? '#aaccff' : '#ffffff';
    h += `<div style="position:absolute;left:${Math.random()*100}%;top:${Math.random()*100}%;width:${sz}px;height:${sz}px;background:${col};border-radius:50%;animation:mn-twinkle ${dur}s ease-in-out ${dl}s infinite alternate;box-shadow:0 0 ${sz*2}px ${col}"></div>`;
  }
  stars.innerHTML = h;
  layers.push(stars);
  // L2: 스캔라인
  layers.push(el('div', `
    position:absolute;left:0;right:0;height:2px;pointer-events:none;
    background:linear-gradient(90deg, transparent, ${accentColor}, transparent);
    animation:mn-scan 9s linear infinite;
    opacity:0.5;
  `));
  return layers;
}

/** 화면 좌상단 ← 메인 백 버튼 (글래스 + 호버 화살표 흔들림) */
function cosmicBackButton(onClick: () => void = () => go('home'), label: string = '메인'): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'tap-press';
  b.innerHTML = `<span style="display:inline-block;animation:mn-back-arrow 1.4s ease-in-out infinite">◀</span>  ${label}`;
  b.style.cssText = `
    position:fixed;top:calc(env(safe-area-inset-top, 0) + 14px);left:14px;
    background:rgba(10,10,26,0.65);
    color:var(--text);
    border:1px solid rgba(255,255,255,0.15);
    padding:11px 18px;border-radius:8px;
    min-height:44px;
    font-family:Galmuri11,monospace;font-size:13px;
    letter-spacing:2px;cursor:pointer;
    backdrop-filter:blur(8px);
    transition:background .15s, border-color .15s, transform .15s;
    z-index:30;
  `;
  b.onmouseenter = () => { b.style.background = 'rgba(46,32,76,0.85)'; b.style.borderColor = 'rgba(5,217,232,0.5)'; b.style.transform = 'translateY(-1px)'; };
  b.onmouseleave = () => { b.style.background = 'rgba(10,10,26,0.65)'; b.style.borderColor = 'rgba(255,255,255,0.15)'; b.style.transform = ''; };
  b.onclick = onClick;
  return b;
}

/** ⭐ 스크롤 cue 자동 부착 — 긴 화면 하단에 "↓ 더보기" 페이드 표시.
 * root 가 overflow:auto 인 컨테이너여야 함. 콘텐츠가 화면보다 짧으면 cue 미표시. */
function attachScrollCue(root: HTMLElement): () => void {
  root.classList.add('scroll-host');
  const cue = document.createElement('div');
  cue.className = 'scroll-cue';
  root.appendChild(cue);
  const update = () => {
    // 콘텐츠가 짧으면 cue 자체 숨김
    const overflows = root.scrollHeight - root.clientHeight > 12;
    cue.style.display = overflows ? '' : 'none';
    // 바닥 근접 시 페이드 아웃
    const atBottom = root.scrollTop + root.clientHeight >= root.scrollHeight - 24;
    root.classList.toggle('at-bottom', atBottom);
  };
  root.addEventListener('scroll', update, { passive: true });
  // 다음 프레임에 측정 (DOM mount 후 layout 완료)
  requestAnimationFrame(update);
  // resize 도 케이스 추적
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
  ro?.observe(root);
  return () => { ro?.disconnect(); };
}

/** 화면 헤더 (그라데이션 큰 한자/타이틀 + 부제 + 분리선) */
function cosmicHeader(title: string, subtitle?: string, accentColor: string = '#05d9e8'): HTMLElement {
  const wrap = el('div', `
    text-align:center;margin-bottom:clamp(16px,3vh,28px);
    animation:mn-fade-up .7s ease-out both;
    position:relative;z-index:5;
  `);
  wrap.appendChild(el('h2', `
    font-family:Galmuri11,monospace;
    font-size:clamp(28px,4.5vw,48px);
    margin:0;letter-spacing:clamp(4px,1vw,10px);
    background:linear-gradient(90deg, #05d9e8 0%, #ffd700 50%, #ff2a6d 100%);
    -webkit-background-clip:text;background-clip:text;
    color:transparent;
    text-shadow:0 0 30px ${accentColor}66;
    font-weight:bold;
  `, title));
  if (subtitle) {
    wrap.appendChild(el('div', `
      width:60px;height:1.5px;
      background:linear-gradient(90deg, transparent, ${accentColor}, transparent);
      margin:10px auto;
    `));
    wrap.appendChild(el('div', `
      color:var(--text-dim);font-family:Galmuri11,monospace;
      font-size:clamp(11px,1.2vw,14px);letter-spacing:3px;
    `, subtitle));
  }
  return wrap;
}

/** 글래스 패널 — Home/Tutorial 톤 일관 */
function cosmicPanel(content: string | HTMLElement, accentColor: string = 'rgba(5,217,232,0.35)'): HTMLElement {
  const panel = el('div', `
    position:relative;
    background:linear-gradient(160deg, rgba(20,12,46,0.85) 0%, rgba(10,10,26,0.92) 100%);
    border:1.5px solid ${accentColor};
    border-radius:12px;
    padding:clamp(16px,2.5vw,24px);
    box-shadow:0 8px 30px rgba(0,0,0,0.5), 0 0 40px ${accentColor.replace(/[\d.]+\)$/,'0.12)')}, inset 0 0 0 1px rgba(255,255,255,0.04);
    overflow:hidden;
    animation:mn-fade-up .7s ease-out .15s both;
  `);
  // 코너 장식
  const cornerCSS = (pos: string) => `position:absolute;${pos};width:16px;height:16px;border:1.5px solid ${accentColor};pointer-events:none;opacity:0.7`;
  panel.appendChild(el('div', `${cornerCSS('top:6px;left:6px')};border-right:none;border-bottom:none`));
  panel.appendChild(el('div', `${cornerCSS('top:6px;right:6px')};border-left:none;border-bottom:none`));
  panel.appendChild(el('div', `${cornerCSS('bottom:6px;left:6px')};border-right:none;border-top:none`));
  panel.appendChild(el('div', `${cornerCSS('bottom:6px;right:6px')};border-left:none;border-top:none`));
  if (typeof content === 'string') {
    const inner = el('div', 'position:relative;z-index:1');
    inner.innerHTML = content;
    panel.appendChild(inner);
  } else {
    content.style.position = 'relative';
    content.style.zIndex = '1';
    panel.appendChild(content);
  }
  return panel;
}

/**
 * 윤회 도감 진행 패널 — 평생 발견한 Run Identity / Synergy 비율 (+ 선택적으로 모디파이어/biome).
 * 게임오버·메인·리더보드·도감 4곳 공용. meta 를 읽기만 하고 변형하지 않음 (ui-code.md 준수).
 * 색만으로 정보 전달 X — ◆/⚡/◈/⬡ 글리프 + 숫자 동반 (색약 안전).
 *
 * opts.newRI / opts.newSyn 은 게임오버 컨텍스트(이번 런 신규 발견)에서만 전달.
 * opts.containerAnim / opts.barAnim 으로 화면별 애니메이션 키프레임을 주입 (스코프 격리).
 */
function discoveryCodexPanel(
  meta: {
    seenIdentityIds?: string[]; seenSynergyIds?: string[];
    seenModifierIds?: string[]; seenBiomeIds?: string[];
  },
  opts: {
    newRI?: boolean; newSyn?: number; newMod?: number; newBiome?: number;
    containerAnim?: string; barAnim?: string;
    showExtended?: boolean; modifierTotal?: number; biomeTotal?: number;
  } = {},
): HTMLElement {
  const totalRI = allRunIdentities().length;     // 28
  const totalSyn = allSynergies().length;         // 18
  const seenRI = Math.min(totalRI, (meta.seenIdentityIds ?? []).length);
  const seenSyn = Math.min(totalSyn, (meta.seenSynergyIds ?? []).length);
  const newRI = !!opts.newRI;
  const newSyn = opts.newSyn ?? 0;
  const newMod = opts.newMod ?? 0;
  const newBiome = opts.newBiome ?? 0;
  const pct = (a: number, b: number) => Math.round((a / Math.max(1, b)) * 100);
  const containerAnim = opts.containerAnim ?? '';
  const barAnim = opts.barAnim ?? '';

  const panel = el('div', `
    width:100%;
    background:linear-gradient(160deg, rgba(177,74,255,0.10), rgba(10,10,26,0.92));
    border:1.5px solid rgba(177,74,255,0.45);
    border-radius:12px;padding:clamp(14px,2vw,20px);
    box-shadow:0 0 22px rgba(177,74,255,0.18), inset 0 0 0 1px rgba(177,74,255,0.08);
    ${containerAnim}
  `);

  const newBits: string[] = [];
  if (newRI) newBits.push('운명');
  if (newSyn > 0) newBits.push(`시너지 ${newSyn}`);
  if (newMod > 0) newBits.push(`모디 ${newMod}`);
  if (newBiome > 0) newBits.push(`생태계 ${newBiome}`);
  const newBadge = newBits.length > 0
    ? `<span style="background:linear-gradient(90deg,#b3ff00,#05d9e8);color:#000;font-family:Galmuri11,monospace;font-size:10px;font-weight:bold;letter-spacing:2px;padding:3px 9px;border-radius:10px;box-shadow:0 0 14px rgba(179,255,0,0.6)">✦ 이번 런 신규 ${newBits.join('+')} 발견</span>`
    : '';

  const bar = (label: string, glyph: string, seen: number, total: number, col: string) => `
    <div style="margin-top:12px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;font-family:Galmuri11,monospace;font-size:clamp(11px,1.1vw,13px);margin-bottom:5px">
        <span style="color:var(--text-dim);letter-spacing:1.5px"><span style="color:${col};filter:drop-shadow(0 0 4px ${col})">${glyph}</span> ${label}</span>
        <span style="color:${col};font-weight:bold;text-shadow:0 0 6px ${col}66">${seen} <span style="color:var(--text-dim);font-weight:normal">/ ${total}</span> · ${pct(seen,total)}%</span>
      </div>
      <div style="height:12px;background:rgba(0,0,0,0.5);border-radius:6px;overflow:hidden;border:1px solid ${col}44">
        <div style="height:100%;width:${pct(seen,total)}%;background:linear-gradient(90deg,${col}aa,${col});border-radius:5px;box-shadow:0 0 8px ${col};${barAnim};--w:${pct(seen,total)}%"></div>
      </div>
    </div>
  `;

  // 확장 행 (모디파이어 / biome) — 데이터가 plumbing 된 경우에만 표시
  let extended = '';
  if (opts.showExtended) {
    const totalMod = opts.modifierTotal ?? 0;
    const totalBiome = opts.biomeTotal ?? 0;
    const seenMod = Math.min(totalMod, (meta.seenModifierIds ?? []).length);
    const seenBiome = Math.min(totalBiome, (meta.seenBiomeIds ?? []).length);
    if (totalMod > 0) extended += bar('모디파이어 (Modifier)', '◈', seenMod, totalMod, '#ff6f00');
    if (totalBiome > 0) extended += bar('생태계 (Biome)', '⬡', seenBiome, totalBiome, '#00ff88');
  }

  const remain = Math.max(0, totalRI - seenRI);
  // 부제 카피 — 신규 플레이어 (seenRI 0) 는 *전부 미발견* 강조, 진행 중 플레이어는 *남은 수* 강조
  const subtitle = seenRI === 0
    ? `매 런이 구조적으로 다른 게임 — <strong style="color:#c98bff;font-weight:bold">28 운명 · 18 시너지</strong>가 모두 잠겨 있다`
    : `매 런이 구조적으로 다른 게임 — 아직 못 본 운명이 <strong style="color:#c98bff;font-weight:bold">${remain}개</strong> 더 있다`;
  panel.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="font-size:22px;filter:drop-shadow(0 0 8px #b14aff)">◆</span>
      <div style="flex:1;min-width:140px">
        <div style="font-family:Galmuri11,monospace;color:#c98bff;font-size:clamp(13px,1.4vw,16px);font-weight:bold;letter-spacing:2px;text-shadow:0 0 8px rgba(177,74,255,0.6)">윤회 도감</div>
        <div style="font-size:11px;color:rgba(220,210,240,0.85);margin-top:3px;letter-spacing:1.2px;line-height:1.4">${subtitle}</div>
      </div>
      ${newBadge}
    </div>
    ${bar('운명 (Run Identity)', '◆', seenRI, totalRI, '#b14aff')}
    ${bar('시너지 (Synergy)', '⚡', seenSyn, totalSyn, '#ffd700')}
    ${extended}
  `;
  return panel;
}

// 효과 1개 → 자연어 설명. value/mult/bonus/duration 키 모두 호환 + chance/interval 부가 표시.
// 출시급 톤: "탭 시 +1 코인" 같은 무미건조한 라벨 X → "별의 인장이 깨어나 매 손짓마다 +1 영혼을 거둔다" 같은 서사형.
function describeEffect(e: any): string {
  // op 마다 의미가 다른 핵심 수치를 자동 추출. freezeTime/buffTap 같은 duration 기반 op 도 커버.
  const num: number | null = e.value ?? e.mult ?? e.bonus ?? e.duration ?? null;
  const dur: number | null = e.duration ?? null;
  const fmt = (n: number | null | undefined, suffix = '') => {
    if (n == null || !Number.isFinite(n)) return '?';
    return Number.isInteger(n) ? `${n}${suffix}` : `${Number(n.toFixed(2))}${suffix}`;
  };
  const pct = (n: number | null | undefined) => {
    if (n == null || !Number.isFinite(n)) return '?';
    return `${Math.round(n * 100)}%`;
  };
  const tag = (e.tag ?? '').toString();
  const tagName: Record<string, string> = {
    fire: '화염성', ice: '빙결성', gold: '황금성', time: '시간성', chaos: '혼돈성', echo: '반향성',
  };
  const tagN = tagName[tag] ?? tag;

  // op → 자연어 서술 (서브젝트 + 효과 + 수치). 모두 한 문장으로 완결.
  const map: Record<string, (e: any) => string> = {
    addCoins: () => {
      const v = fmt(num);
      const trig = e.trigger === 'onTap' ? '손짓할 때마다'
        : e.trigger === 'onTapNth' ? `${e.everyN ?? 5}번 손짓할 때마다`
        : e.trigger === 'onTick' ? `${e.interval ?? 1}초마다`
        : e.trigger === 'onWaveStart' ? '웨이브 시작 시'
        : e.trigger === 'onWaveEnd' ? '웨이브 종료 시'
        : '';
      const scaleNote = e.scale === 'comboBuckets5' ? ' (콤보 5단계마다 누적되어 강해진다)'
        : e.scale === 'comboBuckets10' ? ' (콤보 10단계마다 누적되어 강해진다)'
        : e.scale === 'tagsCount' ? ' (보유한 태그 수에 비례한다)' : '';
      return `${trig} +${v} 영혼을 거둔다.${scaleNote}`;
    },
    addCombo: () => `${e.trigger === 'onTap' ? '손짓할 때마다' : ''} 콤보 카운트가 +${fmt(num)} 증가한다.`,
    addLife: () => `라이프가 ${fmt(num, '개')} 회복된다.`,
    autoTap: () => `별의 그림자가 깃들어, 매초 ${fmt(num)}회 자동으로 손짓을 발한다.`,
    coinGainMult: () => `모든 영혼 획득량이 ${fmt(num)}배가 된다.`,
    globalScoreMult: () => `전체 점수 배수가 ${fmt(num)}배로 증폭된다.`,
    buffSynergy: () => `${tagN} 별자리 시너지의 효과가 ${fmt(num)}배로 강화된다.`,
    buffTagEffects: () => `${tagN} 계열 카드의 모든 효과가 ${fmt(num)}배가 된다.`,
    buffOneCardEffect: () => `보유한 카드 중 하나의 효과가 ${fmt(num)}배로 영구 증폭된다.`,
    buffAllCardEffects: () => `보유한 모든 카드의 효과가 ${fmt(num)}배가 된다.`,
    buffAutoEffects: () => `자동으로 발동되는 모든 효과가 ${fmt(num)}배로 강해진다.`,
    buffComboBonus: () => `콤보 임계값에서 발생하는 보너스가 ${fmt(num)}배가 된다.`,
    buffPerSameRarity: () => `같은 등급의 카드를 보유할수록 ${fmt(num)}배씩 누적되어 강해진다.`,
    comboPerTap: () => `손짓 한 번에 콤보가 +${fmt(num)} 추가로 오른다.`,
    extendComboWindow: () => `콤보 유지 시간이 +${fmt(num)}초 길어진다.`,
    extendWaveTime: () => `웨이브 시간이 +${fmt(num)}초 연장된다.`,
    extraCardChoice: () => `카드 선택 시 보이는 후보가 +${fmt(num)}장 추가된다.`,
    extraModifierPerWave: () => `매 웨이브 적용되는 모디파이어가 +${fmt(num)}개 추가된다.`,
    extraTriggerCount: () => `각 효과의 발동 횟수가 +${fmt(num)}회 추가된다.`,
    forceNextCardRarity: () => `다음 카드 선택지가 ${e.rarity ?? '?'} 등급 이상으로 보장된다.`,
    freezeTime: () => `${tagN} 마법을 발현하여 ${fmt(dur ?? num)}초 동안 시간이 멈춘다.`,
    buffTap: () => `각 손짓의 영혼 회수량이 ×${fmt(e.mult ?? num)}배로 증폭된다${dur ? ` (${fmt(dur)}초간)` : ''}.`,
    hotspotMult: () => `핫스팟 적중 시 받는 보너스가 ${fmt(num)}배가 된다.`,
    invertEffectsChance: () => `${pct(num)} 확률로 효과가 역전되어 적용된다.`,
    negateFirstLifeLoss: () => `첫 번째 라이프 손실을 1회 무효화한다 — 별의 가호.`,
    preserveCombo: () => `콤보가 끊길 위기에서 ${fmt(num)}회 보호된다.`,
    rerollAllowed: () => `카드 선택 시 다시 뽑기를 +${fmt(num)}회 사용할 수 있다.`,
    revive: () => `라이프가 0이 되면 1회 부활한다.`,
    reviveWithMult: () => `부활 시 점수 배수가 ${fmt(num)}배로 폭발한다 — 불사조의 의식.`,
    rewindWave: () => `웨이브 시간을 처음으로 되돌린다 — 시간의 굴레.`,
    rewindWaveOnDeath: () => `사망 시 자동으로 웨이브가 처음으로 되감긴다 — 윤회의 보호.`,
    scoreMult: () => `점수에 ${fmt(num)}배의 배수가 곱해진다.`,
    scoreMultOnComboBreak: () => `콤보가 끊기는 순간 점수에 ${fmt(num)}배 보너스가 한 번 폭발한다.`,
    slowField: () => `${tagN} 마법을 배워 주변에 ${fmt(num)}초간 슬로우 필드를 펼친다.`,
    spawnAreaEffect: () => `${tagN} 마법을 배워 주변에 영역 효과를 발산하여 적을 휩쓴다.`,
    spawnProjectile: () => `${tagN} 발사체가 자동으로 발사되어 적을 추적한다.`,
    tapMult: () => `손짓의 가치가 ×${fmt(num)}배로 증폭된다.`,
    transmuteRandomCard: () => `무작위 카드 1장을 같은 등급의 다른 카드로 변환한다 — 별의 변신.`,
    swapRandomCard: () => `무작위 카드 1장을 새로 뽑은 카드로 교체한다.`,
    upgradeCardRarity: () => `무작위 카드 1장의 등급을 한 단계 끌어올린다 — 별의 승격.`,
    addRandomTagToAllCards: () => `모든 카드에 무작위 태그가 1개씩 추가되어 시너지가 폭발한다.`,
    doubleRandomCardEffect: () => `무작위 카드 1장의 모든 효과가 두 배로 복제된다.`,
    duplicateEffect: () => `이번 발동의 효과가 한 번 더 메아리친다.`,
    echoAuto: () => `자동 효과가 ${fmt(num)}배의 메아리를 남기며 반복된다.`,
    echoTap: () => `손짓 후 ${fmt(e.delay, '초')} 뒤 메아리처럼 한 번 더 울려 퍼진다.`,
    carryRemaining: () => `웨이브에 남은 시간이 다음 웨이브로 이월된다 — 시간의 비축.`,
    comboInverse: () => `콤보가 역전되어 — 콤보 수치가 적을수록 보상이 커진다.`,
    flipScreenH: () => `화면이 좌우로 뒤집혀 도전이 시작된다.`,
    ultimate: () => `별자리가 완성되어 궁극기가 깨어난다 — 압도적 효과 1회 발동.`,
    skipToEnd: () => `웨이브 시작 시 즉시 종료로 건너뛰며 점수가 ${fmt(e.scoreMult ?? 5)}배 상승한다 — 시간의 역설.`,
    tapMultPerEmptySlot: () => `빈 카드 슬롯 하나당 손짓 배수가 ${fmt(e.mult ?? 5)} 늘어난다 — 공허의 힘.`,
    // ⭐ 추가 ops (이전 fallback 으로 빠지던 항목들).
    triggerRandomCardEffect: () => `손짓할 때마다 보유 카드 중 하나의 효과가 무작위로 깨어난다 — 나비의 날갯짓.`,
    crossTriggerAllCards: () => `손짓 한 번에 보유한 모든 카드의 효과가 동시에 메아리친다 — 별자리의 합창.`,
    setWaveTime: () => `웨이브 시간을 ${fmt(num)}초로 재설정한다.`,
    timeScale: () => `시간의 흐름이 ${fmt(num)}배로 ${num != null && num < 1 ? '느려진다' : '빨라진다'}.`,
    darkMode: () => `이번 웨이브 화면이 어두워진다 — 시야 도전.`,
    hideScore: () => `이번 웨이브 점수 표시가 가려진다 — 감각만으로 손짓하라.`,
    muteSfx: () => `이번 웨이브 효과음이 사라진다 — 침묵 속의 의식.`,
    disableCardEffects: () => `이번 웨이브 모든 카드 효과가 봉인된다 — 순수한 손짓의 시험.`,
    screenShake: () => `매 손짓에 화면이 흔들린다 — 별의 진동.`,
    reviveOnce: () => `1회 부활 — 라이프 0에서 한 번 되돌아온다.`,
    tapMultGamble: () => `${pct(e.chance ?? 0.3)} 확률로 손짓 배수가 ×${fmt(e.mult ?? 10)} 폭발한다 — 운명의 도박.`,
    flickerCard: () => `보유 카드 1장이 잠시 꺼졌다 다시 켜진다 — 점멸의 인장.`,
  };

  const f = (map as any)[e.op];
  let body = f ? f(e) : `별의 인장이 깨어나 ${num != null ? `${fmt(num)} ` : ''}효과를 발휘한다.`;

  // 부가 정보 — 확률, 조건
  if (e.chance != null) body += ` (${Math.round(e.chance * 100)}% 확률)`;
  if (e.condition) {
    const cm: Record<string, string> = {
      'comboGte:10': '콤보 10 이상일 때',
      'comboGte:25': '콤보 25 이상일 때',
      'comboGte:50': '콤보 50 이상일 때',
      'remainingLte:5': '시간이 5초 이하일 때',
      'remainingLte:10': '시간이 10초 이하일 때',
      'remainingGte:20': '시간이 20초 이상 남았을 때',
      'lifeEq:1': '라이프가 마지막 1개일 때',
      'lifeLte:1': '라이프가 1 이하일 때',
    };
    const condText = cm[e.condition] ?? e.condition;
    body += ` — ${condText} 발동.`;
  }
  return body;
}

/**
 * 카드 1장 잡았을 때 발현될 시너지 미리보기 — 현재 보유 카드 + 이 카드 가정.
 * 사용자 피드백 "세트 안내가 없다" → 카드 픽 화면에 "🔥 4/5 → 잡으면 5/5 PHOENIX 발동" 표시.
 */
function synergyPreview(c: Card, ownedCards: Card[]): { tag: CardTag; cur: number; next: number; nextTier: 3 | 5 | 7 | null; nextSynergyName?: string; alreadyActive: { tier: number; name: string }[] }[] {
  const counts = tagCounts(ownedCards);
  const synergies = allSynergies();
  const out: ReturnType<typeof synergyPreview> = [];
  for (const tag of c.tags) {
    const cur = counts[tag] ?? 0;
    const next = cur + 1;
    let nextTier: 3 | 5 | 7 | null = null;
    if (cur < 3 && next >= 3) nextTier = 3;
    else if (cur < 5 && next >= 5) nextTier = 5;
    else if (cur < 7 && next >= 7) nextTier = 7;
    const upcoming = nextTier ? synergies.find(s => s.tag === tag && s.tier === nextTier) : undefined;
    const active = synergies
      .filter(s => s.tag === tag && cur >= s.tier)
      .map(s => ({ tier: s.tier, name: s.name_ko }));
    out.push({ tag, cur, next, nextTier, nextSynergyName: upcoming?.name_ko, alreadyActive: active });
  }
  return out;
}

function cardEl(c: Card, onClick: () => void, ownedCards: Card[] = []): HTMLElement {
  const tag = c.tags[0] ?? 'common';
  const tagColor = `var(--${tag})`;
  // 카드 키프레임 (한 번만 주입)
  if (!document.getElementById('samsara-card-keyframes')) {
    const kf = document.createElement('style');
    kf.id = 'samsara-card-keyframes';
    kf.textContent = `
      @keyframes card-shimmer {
        0% { transform: translateX(-100%) skewX(-20deg); }
        100% { transform: translateX(200%) skewX(-20deg); }
      }
      @keyframes card-pulse-border {
        0%,100% { box-shadow:0 4px 18px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.06); }
        50% { box-shadow:0 6px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.12); }
      }
      @keyframes card-rare-particle {
        0% { transform: translate(0,0) scale(1); opacity: 0; }
        20% { opacity: 1; }
        100% { transform: translate(var(--tx), var(--ty)) scale(0.2); opacity: 0; }
      }
    `;
    document.head.appendChild(kf);
  }
  // 반응형 — clamp 로 220~360px (좁은 화면 ~ 넓은 화면). 높이도 크게.
  const wrapper = el('div', `
    width:clamp(220px, 38vw, 360px);
    min-height:clamp(360px, 56vh, 520px);
    background:linear-gradient(160deg, rgba(26,20,46,0.95) 0%, rgba(10,10,26,0.98) 100%);
    border:2px solid ${tagColor};border-radius:18px;padding:clamp(16px, 2.5vw, 26px);
    color:var(--text);font-family:Galmuri11,monospace;cursor:pointer;
    display:flex;flex-direction:column;gap:clamp(10px, 1.5vw, 16px);
    transition:transform .22s cubic-bezier(.2,.9,.3,1.2), box-shadow .22s ease-out, border-color .22s;
    position:relative;overflow:hidden;
    box-shadow:0 4px 18px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.06);
    animation:card-pulse-border 3s ease-in-out infinite;
  `);

  // 태그 배경 글로우
  const glow = el('div', `position:absolute;inset:0;background:radial-gradient(ellipse at top, ${tagColor}66, transparent 65%);pointer-events:none`);
  wrapper.appendChild(glow);

  // 코너 장식 (4 모서리)
  const cornerCSS = (pos: string) => `position:absolute;${pos};width:18px;height:18px;border:1.5px solid ${tagColor};opacity:0.6;pointer-events:none`;
  wrapper.appendChild(el('div', `${cornerCSS('top:8px;left:8px')};border-right:none;border-bottom:none`));
  wrapper.appendChild(el('div', `${cornerCSS('top:8px;right:8px')};border-left:none;border-bottom:none`));
  wrapper.appendChild(el('div', `${cornerCSS('bottom:8px;left:8px')};border-right:none;border-top:none`));
  wrapper.appendChild(el('div', `${cornerCSS('bottom:8px;right:8px')};border-left:none;border-top:none`));

  // shimmer 띠 (rare/epic/legendary 만)
  if (c.rarity !== 'common') {
    const shimmer = el('div', `
      position:absolute;top:0;left:0;width:50%;height:100%;
      background:linear-gradient(90deg, transparent, ${tagColor}55, transparent);
      pointer-events:none;
      animation:card-shimmer ${c.rarity === 'legendary' ? 2 : c.rarity === 'epic' ? 3 : 4}s ease-in-out infinite;
    `);
    wrapper.appendChild(shimmer);
  }

  // 효과 설명 리스트 — 폰트 키움 + 좌측 컬러 바
  const effectsHTML = c.effects.map((e, i) =>
    `<div style="font-size:clamp(13px, 1.3vw, 16px);color:var(--text);line-height:1.55;padding:8px 0 8px 12px;border-left:2px solid ${tagColor};margin:${i === 0 ? '0' : '6px 0 0'};opacity:0.95">${describeEffect(e)}</div>`
  ).join('');

  // 듀얼 태그 표시
  const allTags = c.tags.map(tg => TAG_EMOJI[tg] ?? '✨').join('');

  // ── 시너지 세트 미리보기 (사용자 피드백: "세트 안내가 없어") ──
  // 이 카드를 잡았을 때 각 태그가 몇 장이 되는지 + 시너지 발동/근접 정보
  const previews = synergyPreview(c, ownedCards);
  const synergyHTML = previews.map(pv => {
    const tagC = `var(--${pv.tag})`;
    const emoji = TAG_EMOJI[pv.tag] ?? '✨';
    const ICON: Record<string, string> = { 3: '◆', 5: '◇◆', 7: '◇◇◆' };
    const reachLine = pv.nextTier
      ? `<span style="color:${tagC};font-weight:bold">${pv.cur}→${pv.next}/${pv.nextTier}</span> · 발동 → <span style="color:${tagC}">${pv.nextSynergyName ?? ''}</span> ${ICON[pv.nextTier] ?? ''}`
      : `<span style="color:var(--text-dim)">${pv.cur}→${pv.next}장</span>${pv.cur < 3 ? ` · 다음 시너지까지 ${3 - pv.next}장` : pv.cur < 5 ? ` · 다음 시너지까지 ${5 - pv.next}장` : pv.cur < 7 ? ` · 다음 시너지까지 ${7 - pv.next}장` : ' · 최대 등급 도달'}`;
    const activeLine = pv.alreadyActive.length
      ? `<div style="font-size:clamp(9px,0.85vw,11px);color:var(--text-dim);opacity:0.7;margin-top:2px">활성: ${pv.alreadyActive.map(a => `${a.name}(${a.tier})`).join(' · ')}</div>`
      : '';
    return `<div style="font-size:clamp(10px,0.95vw,12px);color:var(--text);line-height:1.4;padding:5px 0">${emoji} ${reachLine}${activeLine}</div>`;
  }).join('');

  const inner = document.createElement('div');
  inner.style.cssText = 'position:relative;z-index:1;display:flex;flex-direction:column;gap:clamp(8px,1.2vw,14px);height:100%';
  inner.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:clamp(36px, 4.5vw, 56px);line-height:1;filter:drop-shadow(0 0 8px ${tagColor})">${allTags}</span>
      <span style="font-size:clamp(11px, 1.1vw, 14px);color:${RARITY_COLOR[c.rarity]};text-transform:uppercase;letter-spacing:3px;font-weight:bold;text-shadow:0 0 8px ${RARITY_COLOR[c.rarity]}">${c.rarity}</span>
    </div>
    <div style="text-align:center;font-size:clamp(22px, 2.6vw, 36px);font-weight:bold;color:${tagColor};letter-spacing:2px;text-shadow:0 0 14px ${tagColor},0 0 28px ${tagColor}55;line-height:1.1">${(c as any).name_ko ?? c.id}</div>
    <div style="text-align:center;font-size:clamp(9px, 0.9vw, 11px);color:var(--text-dim);letter-spacing:3px;opacity:0.55;margin-top:-4px">${c.id}</div>
    <div style="height:1px;background:linear-gradient(90deg, transparent, ${tagColor}, transparent);margin:0 -4px"></div>
    <div style="background:linear-gradient(180deg, rgba(0,0,0,0.4), rgba(0,0,0,0.25));border-radius:10px;padding:clamp(10px, 1.5vw, 16px) clamp(12px, 1.8vw, 20px);border:1px solid rgba(255,255,255,0.05)">${effectsHTML}</div>
    ${synergyHTML ? `
      <div style="margin-top:auto;background:rgba(0,0,0,0.35);border-radius:8px;padding:clamp(8px,1.2vw,12px) clamp(10px,1.4vw,14px);border:1px dashed ${tagColor}55">
        <div style="font-size:clamp(9px,0.85vw,11px);color:${tagColor};letter-spacing:3px;opacity:0.85;margin-bottom:4px;font-family:Galmuri11,monospace">★ 시너지 세트</div>
        ${synergyHTML}
      </div>
    ` : ''}
  `;
  wrapper.appendChild(inner);

  wrapper.onmouseenter = () => {
    wrapper.style.transform = 'translateY(-12px) scale(1.05)';
    wrapper.style.boxShadow = `0 24px 50px ${tagColor}, 0 0 60px ${tagColor}88, inset 0 0 0 1px rgba(255,255,255,0.15)`;
    wrapper.style.borderColor = '#ffffff';
    wrapper.style.animation = 'none';
  };
  wrapper.onmouseleave = () => {
    wrapper.style.transform = '';
    wrapper.style.boxShadow = '';
    wrapper.style.borderColor = '';
    wrapper.style.animation = 'card-pulse-border 3s ease-in-out infinite';
  };
  // ⭐ 터치/마우스 누름 즉시 시각 피드백 — :hover 가 안 트리거되는 모바일에서 결정적.
  // pointerdown 으로 즉시 스케일 다운 + 밝기 + 100ms 후 클릭 (사용자가 '눌림' 확실히 감지).
  wrapper.style.setProperty('-webkit-tap-highlight-color', 'transparent');
  let _pressed = false;
  wrapper.addEventListener('pointerdown', () => {
    _pressed = true;
    wrapper.style.transform = 'translateY(-4px) scale(0.97)';
    wrapper.style.filter = 'brightness(1.15)';
  });
  const release = () => {
    if (!_pressed) return;
    _pressed = false;
    wrapper.style.filter = '';
    // 호버 상태였다면 호버 transform 으로 복귀, 아니면 reset
    wrapper.style.transform = '';
  };
  wrapper.addEventListener('pointerup', release);
  wrapper.addEventListener('pointercancel', release);
  wrapper.addEventListener('pointerleave', release);
  wrapper.onclick = onClick;
  return wrapper;
}

// ─────────────────────────── HOME ───────────────────────────

export function mountHome(host: HTMLElement, engine: Engine): () => void {
  host.innerHTML = '';
  const meta = engine.getState().meta;
  const seenTutorial = !!lsGetItem('samsara.tutorial.done');
  const character = ((meta as any).character ?? 'tiger') as 'tiger' | 'magpie' | 'dokkaebi' | 'gumiho' | 'dragon';

  // 키프레임 한 번만 주입 — 다양한 애니
  if (!document.getElementById('samsara-keyframes')) {
    const kf = document.createElement('style');
    kf.id = 'samsara-keyframes';
    kf.textContent = `
      @keyframes float { 0%{transform:translateY(0)} 100%{transform:translateY(-14px)} }
      @keyframes twinkle { 0%{opacity:.2} 100%{opacity:.9} }
      @keyframes pulse { 0%{transform:scale(1)} 50%{transform:scale(1.06)} 100%{transform:scale(1)} }
      @keyframes nebula-drift { 0%{transform:translate(0,0)} 50%{transform:translate(30px,-20px)} 100%{transform:translate(0,0)} }
      @keyframes title-glow { 0%,100%{filter:drop-shadow(0 0 6px rgba(255,42,109,0.85)) drop-shadow(0 0 14px rgba(255,42,109,0.35))} 50%{filter:drop-shadow(0 0 6px rgba(5,217,232,0.9)) drop-shadow(0 0 16px rgba(5,217,232,0.4))} }
      @keyframes title-letter { 0%{opacity:0;transform:translateY(20px)} 100%{opacity:1;transform:translateY(0)} }
      @keyframes orbit { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      @keyframes shooting-star {
        0% { transform: translate(0, 0); opacity: 0; }
        10% { opacity: 1; }
        100% { transform: translate(-200px, 200px); opacity: 0; }
      }
      @keyframes panel-rise { 0%{opacity:0;transform:translateY(20px)} 100%{opacity:1;transform:translateY(0)} }
      @keyframes scan-line {
        0% { transform: translateY(-100%); }
        100% { transform: translateY(100vh); }
      }
    `;
    document.head.appendChild(kf);
  }

  // 시네마틱 풀스크린 컨테이너
  const root = el('div', `
    position:fixed;inset:0;overflow-y:auto;overflow-x:hidden;
    background:#02010a;
    color:var(--text);
    font-family:'Pretendard',system-ui,sans-serif;
    -webkit-overflow-scrolling:touch;
  `);

  // ── L0: 우주 깊이 그라디언트 + 4색 성운 ──
  const cosmic = el('div', `
    position:absolute;inset:-10%;pointer-events:none;
    background:
      radial-gradient(ellipse at 20% 30%, rgba(177,74,255,0.28), transparent 40%),
      radial-gradient(ellipse at 80% 70%, rgba(5,217,232,0.22), transparent 45%),
      radial-gradient(ellipse at 50% 90%, rgba(255,42,109,0.18), transparent 50%),
      radial-gradient(ellipse at 70% 15%, rgba(255,215,0,0.15), transparent 35%),
      radial-gradient(ellipse at center, #0e0822 0%, #02010a 70%);
    animation:nebula-drift 18s ease-in-out infinite;
  `);
  root.appendChild(cosmic);

  // ── L1: 별 (200개) ──
  const stars = el('div', 'position:absolute;inset:0;pointer-events:none');
  const starCount = 200;
  let starsHTML = '';
  for (let i = 0; i < starCount; i++) {
    const sz = Math.random() < 0.05 ? 2.5 : Math.random() < 0.2 ? 1.6 : 1;
    const op = 0.25 + Math.random() * 0.7;
    const dur = 2 + Math.random() * 4;
    const delay = Math.random() * 4;
    const color = Math.random() < 0.1 ? '#ffd7e0' : Math.random() < 0.3 ? '#aaccff' : '#ffffff';
    starsHTML += `<div style="position:absolute;left:${Math.random() * 100}%;top:${Math.random() * 100}%;width:${sz}px;height:${sz}px;background:${color};border-radius:50%;opacity:${op};animation:twinkle ${dur}s ease-in-out ${delay}s infinite alternate;box-shadow:0 0 ${sz * 2}px ${color}"></div>`;
  }
  stars.innerHTML = starsHTML;
  root.appendChild(stars);

  // ── L2: 유성 (3 streaks) ──
  const meteors = el('div', 'position:absolute;inset:0;pointer-events:none;overflow:hidden');
  for (let i = 0; i < 3; i++) {
    const m = el('div', `
      position:absolute;
      top:${10 + Math.random() * 40}%;
      left:${50 + Math.random() * 50}%;
      width:120px;height:2px;
      background:linear-gradient(90deg, transparent, #ffffff, #aaccff, transparent);
      transform-origin:right;
      animation:shooting-star ${3 + Math.random() * 3}s linear ${i * 4 + Math.random() * 4}s infinite;
      opacity:0.7;box-shadow:0 0 10px white;
    `);
    meteors.appendChild(m);
  }
  root.appendChild(meteors);

  // ── L3: 스캔 라인 (네오펑크 톤) ──
  root.appendChild(el('div', `
    position:absolute;left:0;right:0;height:2px;pointer-events:none;
    background:linear-gradient(90deg, transparent, rgba(5,217,232,0.4), transparent);
    animation:scan-line 8s linear infinite;
    opacity:0.5;
  `));

  // ── 사이클별 진화 (오랜 플레이어 보상) ──
  const tc = meta.totalCycles;
  if (tc >= 10000) {
    root.appendChild(el('div', `
      position:absolute;top:14px;right:14px;
      background:linear-gradient(135deg,#ffd700,#ff2a6d,#05d9e8);
      color:#000;padding:6px 14px;border-radius:20px;
      font-family:Galmuri11,monospace;font-size:11px;font-weight:bold;letter-spacing:2px;
      box-shadow:0 0 20px rgba(255,215,0,0.6);
      animation:pulse 2.4s ease-in-out infinite;
    `, '✦ TRANSCENDED ✦'));
  }
  if (tc >= 1000) {
    // 떠도는 영혼 (학)
    root.appendChild(el('div', `
      position:absolute;top:18%;left:8%;font-size:36px;opacity:0.45;pointer-events:none;
      animation:float 6s ease-in-out infinite alternate;
      filter:drop-shadow(0 0 8px #05d9e8);
    `, '🕊️'));
  }
  if (tc >= 250) {
    // 화면 하단 산 실루엣 (사후 우주의 별산)
    root.appendChild(el('div', `
      position:absolute;bottom:0;left:0;right:0;height:140px;pointer-events:none;
      background:linear-gradient(180deg, transparent, rgba(2,1,10,0.95));
      clip-path:polygon(0 65%, 12% 35%, 22% 55%, 35% 25%, 48% 50%, 60% 30%, 72% 55%, 84% 25%, 100% 45%, 100% 100%, 0 100%);
      opacity:0.7;
    `));
  }

  // ── 메인 컨텐츠 (중앙 정렬, panel-rise 애니) ──
  // ⭐ PC 세로 잘림 fix: 콘텐츠가 뷰포트보다 크면 justify-content:center 가 위/아래를 동시에
  // 잘라먹음(로고+메뉴 클립). `safe center` = 들어가면 중앙, 넘치면 위 정렬+스크롤 → 절대 안 잘림.
  const main = el('div', `
    position:relative;z-index:5;
    height:100%;
    overflow-y:auto;overflow-x:hidden;
    display:flex;flex-direction:column;
    align-items:center;justify-content:safe center;
    padding:clamp(16px, 3vh, 40px) clamp(16px, 4vw, 40px);
    box-sizing:border-box;
    -webkit-overflow-scrolling:touch;
  `);

  // 윤회 링 (회전 광채 — 캐릭터 뒤에)
  const ring = el('div', `
    position:absolute;
    width:clamp(320px, 38vw, 620px);
    height:clamp(320px, 38vw, 620px);
    top:50%;left:50%;transform:translate(-50%,-50%);
    border:1px solid rgba(177,74,255,0.18);
    border-radius:50%;
    box-shadow:inset 0 0 60px rgba(177,74,255,0.18), 0 0 80px rgba(5,217,232,0.12);
    animation:orbit 60s linear infinite;
    pointer-events:none;z-index:0;
  `);
  // 작은 별을 링 위에 박아 "회전" 보이게
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * 360;
    ring.appendChild(el('div', `
      position:absolute;left:50%;top:0;
      width:4px;height:4px;background:#fafafa;border-radius:50%;
      transform:translate(-50%,-50%) rotate(${a}deg) translateY(${a}px);
      box-shadow:0 0 8px rgba(255,215,0,0.8);
    `));
  }
  ring.style.transform = 'translate(-50%,-50%)';
  // 단순화 — 외부 링 1개만
  ring.innerHTML = '';
  for (let i = 0; i < 12; i++) {
    const dot = document.createElement('div');
    const ang = (i / 12) * Math.PI * 2;
    const r = 50;
    dot.style.cssText = `
      position:absolute;
      left:calc(50% + ${Math.cos(ang) * r}%);
      top:calc(50% + ${Math.sin(ang) * r}%);
      width:6px;height:6px;
      background:${i % 3 === 0 ? '#ff2a6d' : i % 3 === 1 ? '#05d9e8' : '#ffd700'};
      border-radius:50%;
      box-shadow:0 0 10px currentColor;
      transform:translate(-50%,-50%);
    `;
    ring.appendChild(dot);
  }
  main.appendChild(ring);

  // ── 타이틀 — ⭐ 가독성 우선 (그라데이션 끝색을 흰색으로 빼고, 흰색 외곽 스트로크 + 짙은 베이스 그림자 추가) ──
  const title = el('h1', `
    position:relative;z-index:2;
    font-family:Galmuri11,monospace;
    font-size:clamp(44px, 7.5vw, 108px);
    margin:0;letter-spacing:clamp(4px, 0.8vw, 12px);
    background:linear-gradient(90deg, #ff5b8f 0%, #ffe055 32%, #ffffff 50%, #4ee3f0 68%, #c490ff 100%);
    -webkit-background-clip:text;background-clip:text;
    -webkit-text-fill-color:transparent;
    color:transparent;
    -webkit-text-stroke:1.5px rgba(255,255,255,0.22);
    animation:title-glow 4s ease-in-out infinite;
  `, 'SAMSARA');
  // 타이틀 뒤 어두운 베이스 글로우 — 그라데이션 글자 모서리를 또렷하게
  const titleWrap = el('div', `
    position:relative;z-index:2;
    filter:drop-shadow(0 2px 0 rgba(0,0,0,0.85)) drop-shadow(0 0 24px rgba(2,1,10,0.95));
  `);
  titleWrap.appendChild(title);
  main.appendChild(titleWrap);

  // 부제 — ⭐ 색 한 단계 밝힘 (#aabaff → #e2e7ff) + 굵게
  main.appendChild(el('div', `
    position:relative;z-index:2;
    font-family:Galmuri11,monospace;
    font-size:clamp(18px, 2.2vw, 28px);
    font-weight:bold;
    color:#e2e7ff;letter-spacing:clamp(5px, 1.2vw, 14px);margin:14px 0 0;
    text-shadow:0 1px 0 #000, 0 0 12px rgba(120,150,255,0.55);
    animation:panel-rise .8s ease-out .2s both;
  `, '윤회  ·  CYCLE OF FATE'));

  // 카피 — ⭐ 핵심 슬로건. 블러 줄이고 짙은 베이스 그림자로 또렷하게
  main.appendChild(el('div', `
    position:relative;z-index:2;
    font-size:clamp(24px, 3vw, 40px);
    font-weight:700;
    color:#ffffff;margin:20px 0 10px;text-align:center;
    letter-spacing:0.5px;
    animation:panel-rise .8s ease-out .35s both;
    text-shadow:0 2px 0 rgba(0,0,0,0.9), 0 0 10px rgba(5,217,232,0.7), 0 0 22px rgba(5,217,232,0.35);
  `, '30초마다 새 운명을 짠다'));

  main.appendChild(el('div', `
    position:relative;z-index:2;
    font-size:clamp(16px, 1.7vw, 22px);
    color:#d8e1ff;margin:0 0 20px;text-align:center;
    font-family:Galmuri11,monospace;letter-spacing:2px;
    text-shadow:0 1px 0 #000, 0 0 8px rgba(170,204,255,0.45);
    animation:panel-rise .8s ease-out .5s both;
  `, '— 죽은 자의 별빛이 다시 깨어나는 곳 —'));

  // ── 캐릭터 (중앙 큰 에이전트) — PC 세로 절약 위해 max 축소 (모바일은 min 값 유지) ──
  const charBox = el('div', `
    position:relative;z-index:3;
    width:clamp(140px, 14vw, 210px);
    height:clamp(140px, 14vw, 210px);
    background:url(/character/${character}.svg) no-repeat center/contain;
    image-rendering:pixelated;
    margin:4px 0 16px;
    animation:float 3s ease-in-out infinite alternate, panel-rise 1s ease-out .6s both;
    filter:drop-shadow(0 8px 24px rgba(255,42,109,0.5));
  `);
  main.appendChild(charBox);

  // ── 메타 스탯 패널 (3 카드) ──
  const stats = el('div', `
    position:relative;z-index:2;
    display:flex;gap:clamp(8px, 1.5vw, 18px);
    margin:0 0 28px;flex-wrap:wrap;justify-content:center;
    animation:panel-rise .8s ease-out .65s both;
  `);
  const statCards: [string, string, string][] = [
    ['사이클', String(meta.totalCycles), '#05d9e8'],
    ['윤회 점수 (RP)', String(meta.rp), '#ffd700'],
    ['최고 점수', formatNum(meta.bestScore), '#ff2a6d'],
  ];
  for (const [label, val, color] of statCards) {
    const card = el('div', `
      background:rgba(10,10,26,0.65);
      border:1px solid ${color}66;
      border-radius:8px;
      padding:clamp(8px, 1.2vw, 14px) clamp(14px, 2vw, 22px);
      text-align:center;
      min-width:96px;
      backdrop-filter:blur(6px);
      box-shadow:0 0 20px ${color}22;
    `);
    card.innerHTML = `
      <div style="color:${color};font-family:Galmuri11,monospace;font-size:clamp(28px, 3.4vw, 44px);font-weight:bold;text-shadow:0 0 12px ${color}aa">${val}</div>
      <div style="color:#bcbcd0;font-size:clamp(14px, 1.4vw, 18px);margin-top:7px;letter-spacing:1.8px;font-family:Galmuri11,monospace;text-transform:uppercase;font-weight:600">${label}</div>
    `;
    stats.appendChild(card);
  }
  // FTUE: 첫 방문(아직 1런도 안 함)엔 0/0/0 stat 카드가 "넌 아무것도 못 했다" 인상 → 숨김.
  // 한 번이라도 사이클을 돈 뒤부터 노출 (research: "don't show zeroes").
  if (meta.totalCycles > 0) main.appendChild(stats);

  // ⭐ 신규 플레이어 환영 메시지 — totalCycles 0 일 때 0/0/0 stat 카드만으론 동기부여 약함
  // 세계관 톤 (윤회 + 한국 신화) 으로 첫 인상 격려.
  if (meta.totalCycles === 0) {
    const welcome = el('div', `
      position:relative;z-index:2;
      width:min(420px, 88vw);
      background:linear-gradient(135deg, rgba(255,42,109,0.12), rgba(5,217,232,0.08));
      border:1px dashed rgba(255,42,109,0.45);
      border-radius:10px;padding:11px 16px;
      margin:0 0 14px;
      text-align:center;
      animation:panel-rise .8s ease-out .67s both;
      backdrop-filter:blur(6px);
    `);
    welcome.innerHTML = `
      <div style="font-family:Galmuri11,monospace;font-size:11px;color:rgba(255,42,109,0.95);letter-spacing:3px;margin-bottom:4px;font-weight:bold">✦ 첫 윤회의 문 ✦</div>
      <div style="font-family:Galmuri11,monospace;font-size:13px;color:#fff;letter-spacing:1.5px;line-height:1.5">별의 인장이 그대를 기다린다.<br><span style="color:rgba(255,255,255,0.7);font-size:11px">시작 버튼을 눌러 30초의 운명을 짜라.</span></div>
    `;
    main.appendChild(welcome);
  }

  // ⭐ RP 진척 바 + 다음 잠금 해제 미리보기 (메타 진행 가시화)
  // 현재 RP → 다음 큰 잠금 해제 (캐릭터 unlock 임계값 또는 사원 다음 단계) 까지 거리
  const RP_MILESTONES: { rp: number; label: string; emoji: string }[] = [
    { rp: 30,  label: '도깨비 캐릭터',  emoji: '👹' },
    { rp: 60,  label: '구미호 캐릭터',  emoji: '🦊' },
    { rp: 100, label: '용 캐릭터',      emoji: '🐉' },
    { rp: 200, label: '카드 슬롯 +1',   emoji: '🃏' },
    { rp: 500, label: '메타 풀 강화',   emoji: '✨' },
    { rp: 1000, label: '초월의 길',     emoji: '🌟' },
  ];
  const nextMs = RP_MILESTONES.find(m => meta.rp < m.rp);
  if (nextMs) {
    const prevRp = (() => {
      const idx = RP_MILESTONES.indexOf(nextMs);
      return idx > 0 ? RP_MILESTONES[idx - 1].rp : 0;
    })();
    const ratio = Math.max(0, Math.min(1, (meta.rp - prevRp) / (nextMs.rp - prevRp)));
    const rpBar = el('div', `
      position:relative;z-index:2;
      width:min(420px, 88vw);
      background:rgba(20,12,46,0.7);border:1.5px solid rgba(255,215,0,0.4);
      border-radius:10px;padding:10px 16px;
      margin:0 0 12px;
      box-shadow:0 0 16px rgba(255,215,0,0.15);
      animation:panel-rise .8s ease-out .68s both;
      backdrop-filter:blur(6px);
    `);
    rpBar.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;font-family:Galmuri11,monospace;font-size:11px;color:rgba(255,215,0,0.7);letter-spacing:2px;margin-bottom:6px">
        <span>다음 잠금 해제</span>
        <span style="color:#ffd700;font-weight:bold">${meta.rp} / ${nextMs.rp} RP</span>
      </div>
      <div style="height:8px;background:rgba(0,0,0,0.5);border-radius:4px;overflow:hidden;border:1px solid rgba(255,215,0,0.25);box-shadow:inset 0 0 4px rgba(0,0,0,0.4)">
        <div style="height:100%;width:${ratio*100}%;background:linear-gradient(90deg,#ff2a6d,#ffd700);box-shadow:0 0 10px #ffd700;border-radius:3px;transition:width .6s ease-out"></div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:8px;font-family:Galmuri11,monospace;font-size:12px;color:var(--text)">
        <span style="font-size:18px;filter:drop-shadow(0 0 6px #ffd700)">${nextMs.emoji}</span>
        <span style="font-weight:bold">${nextMs.label}</span>
        <span style="margin-left:auto;color:var(--text-dim);font-size:10px;letter-spacing:1.5px">${Math.max(0, nextMs.rp - meta.rp)} RP 남음</span>
      </div>
    `;
    main.appendChild(rpBar);
  }

  // ⭐ 윤회 도감 진행 — 평생 발견 운명/시너지 비율 (게임오버 패널과 동일 룩).
  // FTUE: 첫 방문엔 0/28·0% 막대 4개가 "벽 같은 0 더미" → 숨김. 단일 RP 잠금 티저(위)가
  // 깊이 암시 역할을 대신. 1런 뒤 (totalCycles>0) 부터 수집 진척을 노출 → 점진적 공개.
  if (meta.totalCycles > 0) {
    const codexPanel = discoveryCodexPanel(meta, {
      containerAnim: 'position:relative;z-index:2;width:min(420px,88vw);margin:0 0 12px;animation:panel-rise .8s ease-out .685s both;',
      showExtended: true, modifierTotal: allModifierDefs().length, biomeTotal: BIOME_KINDS.length,
    });
    main.appendChild(codexPanel);
  }

  // ⭐ 일일 시련 — 매일 자정 모든 플레이어 동일 3 모디파이어 (W1/2/3 강제). research P0
  // FTUE: 첫 방문엔 숨김(점진적 공개). 1런 뒤부터 노출 — 그때 "오늘의 경쟁" 이 의미를 가짐.
  const dailyMods = getDailyChallengeDefs();
  if (dailyMods.length > 0 && meta.totalCycles > 0) {
    const TYPE_COLOR: Record<string, string> = { blessing: '#00ff88', challenge: '#ff6f00', secret: '#b14aff' };
    const TYPE_LABEL: Record<string, string> = { blessing: '축복', challenge: '시련', secret: '비밀' };
    const dailyPanel = el('div', `
      position:relative;z-index:2;
      width:min(420px, 88vw);
      background:linear-gradient(135deg, rgba(20,12,46,0.85), rgba(46,20,76,0.85));
      border:1.5px solid rgba(255,111,0,0.5);
      border-radius:10px;padding:12px 16px;
      margin:0 0 12px;
      box-shadow:0 0 22px rgba(255,111,0,0.18);
      animation:panel-rise .8s ease-out .69s both;
      backdrop-filter:blur(8px);
    `);
    const seedNum = dailySeed();
    let modsHtml = '';
    dailyMods.forEach((m, i) => {
      const c = TYPE_COLOR[m.type] ?? '#fff';
      const lbl = TYPE_LABEL[m.type] ?? '';
      // 효과 hint — 첫 effect 만 짧은 한국어 서술. 첫 사용자가 무슨 의미인지 알 수 있게.
      // describeEffect 가 한 문장 (예: "5초마다 +500 영혼을 거둔다") → 줄임표 처리.
      const firstEff = (m.effects ?? [])[0];
      const effHint = firstEff ? describeEffect(firstEff) : '';
      modsHtml += `
        <div style="min-width:0;background:rgba(0,0,0,0.4);border:1px solid ${c}55;border-radius:6px;padding:7px 9px;text-align:left">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
            <div style="font-family:Galmuri11,monospace;font-size:9px;color:${c};letter-spacing:1.5px;opacity:0.9">W${i+1} · ${lbl}</div>
          </div>
          <div style="font-family:Galmuri11,monospace;font-size:11.5px;color:#fff;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.name_ko}</div>
          <div style="font-family:Pretendard,sans-serif;font-size:9.5px;color:rgba(255,255,255,0.62);margin-top:3px;line-height:1.35;letter-spacing:0.2px;word-break:keep-all" title="${effHint}">${effHint}</div>
        </div>`;
    });
    dailyPanel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:6px;font-family:Galmuri11,monospace;font-size:11px;color:rgba(255,111,0,0.95);letter-spacing:2.5px">
          <span style="font-size:14px;filter:drop-shadow(0 0 6px #ff6f00)">⚔</span>
          <span style="font-weight:bold">오늘의 시련</span>
        </div>
        <div style="font-family:Galmuri11,monospace;font-size:10px;color:var(--text-dim);letter-spacing:1.5px">SEED #${seedNum.toString(36).slice(-5).toUpperCase()}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">${modsHtml}</div>
      <div style="font-family:Galmuri11,monospace;font-size:9.5px;color:var(--text-dim);text-align:center;margin-top:8px;letter-spacing:1.5px;opacity:0.75">매일 자정 갱신 · 글로벌 리더보드 동일 조건</div>
    `;
    main.appendChild(dailyPanel);
  }

  // ⭐ 윤회 계승 — 직전 런의 도미넌트 카드가 다음 런에 부여됨을 알림 (있을 때만)
  const legacyId = (meta as any).legacyCardId;
  if (legacyId && meta.totalCycles > 0) {
    const lcard = allCards().find(c => c.id === legacyId);
    if (lcard) {
      const TAG_COLOR_MAP: Record<string, string> = { fire:'#ff2a6d',ice:'#05d9e8',gold:'#ffd700',time:'#d300c5',chaos:'#ff6f00',echo:'#b3ff00' };
      const tg = lcard.tags[0] ?? 'echo';
      const col = TAG_COLOR_MAP[tg] ?? '#b14aff';
      const legacy = el('div', `
        position:relative;z-index:2;
        display:flex;align-items:center;gap:10px;
        background:rgba(20,12,46,0.7);border:1.5px solid ${col}88;
        border-radius:10px;padding:10px 18px;
        margin:0 0 16px;
        max-width:min(420px, 88vw);
        box-shadow:0 0 20px ${col}33;
        animation:panel-rise .8s ease-out .7s both;
        backdrop-filter:blur(6px);
      `);
      legacy.innerHTML = `
        <span style="font-size:24px;filter:drop-shadow(0 0 6px ${col})">${(TAG_EMOJI[tg] ?? '✨')}</span>
        <div style="flex:1">
          <div style="font-family:Galmuri11,monospace;font-size:10px;color:${col};letter-spacing:3px;opacity:0.85">◆ 전생의 술법 (다음 런 자동 발현)</div>
          <div style="font-family:Galmuri11,monospace;font-size:14px;color:#fff;font-weight:bold;letter-spacing:1.5px;margin-top:2px">${(lcard as any).name_ko ?? lcard.id}</div>
        </div>
      `;
      main.appendChild(legacy);
    }
  }

  // ── 메뉴 ──
  const menu = el('div', `
    position:relative;z-index:2;
    display:flex;flex-direction:column;
    gap:clamp(10px, 1.3vw, 16px);
    width:clamp(280px, 34vw, 460px);
    animation:panel-rise .8s ease-out .8s both;
  `);
  // ⭐ 첫 플레이 강조 — 처음 접속한 플레이어에게 시각적 안내 (research C1: 신규 리텐션 +18~50%)
  if (!seenTutorial) {
    if (!document.getElementById('samsara-firstplay-kf')) {
      const kf = document.createElement('style');
      kf.id = 'samsara-firstplay-kf';
      kf.textContent = `
        @keyframes firstplay-glow {
          0%,100%{box-shadow:0 0 14px rgba(255,215,0,0.45),inset 0 0 8px rgba(255,215,0,0.2);transform:scale(1)}
          50%{box-shadow:0 0 28px rgba(255,215,0,0.85),inset 0 0 14px rgba(255,215,0,0.35);transform:scale(1.03)}
        }
        @keyframes firstplay-arrow { 0%,100%{transform:translateY(0)} 50%{transform:translateY(6px)} }
      `;
      document.head.appendChild(kf);
    }
    const firstHint = el('div', `
      position:relative;z-index:2;
      display:flex;align-items:center;gap:10px;justify-content:center;
      background:linear-gradient(135deg, rgba(255,215,0,0.18), rgba(255,42,109,0.12));
      border:1.5px solid rgba(255,215,0,0.6);
      border-radius:10px;padding:10px 18px;margin:0 0 4px;
      font-family:Galmuri11,monospace;font-size:13px;letter-spacing:1.5px;color:#ffd700;
      animation:firstplay-glow 2.4s ease-in-out infinite;
      backdrop-filter:blur(8px);
    `);
    firstHint.innerHTML = `
      <span style="font-size:18px;filter:drop-shadow(0 0 4px #ffd700)">✦</span>
      <span>처음이라면 <b style="color:#fff">튜토리얼</b>을 권합니다 — 60초면 충분합니다</span>
      <span style="font-size:18px;animation:firstplay-arrow 1.4s ease-in-out infinite">↓</span>
    `;
    menu.appendChild(firstHint);
  }

  // 큰 시작 버튼 — 모바일 탭 타깃 ≥56px (메인 CTA)
  const startBtn = document.createElement('button');
  startBtn.className = 'tap-press';
  startBtn.textContent = seenTutorial ? '▶  시작' : '▶  튜토리얼';
  startBtn.style.cssText = `
    background:linear-gradient(135deg, #ff2a6d 0%, #b14aff 50%, #05d9e8 100%);
    color:#fff;border:none;
    padding:clamp(22px, 2.6vw, 30px);
    min-height:64px;
    border-radius:14px;
    font-family:Galmuri11,monospace;
    font-size:clamp(22px, 2.4vw, 32px);
    font-weight:bold;letter-spacing:5px;
    cursor:pointer;
    box-shadow:0 6px 26px rgba(255,42,109,0.5);
    transition:transform .15s, box-shadow .15s;
    text-shadow:0 0 14px rgba(255,255,255,0.4);
  `;
  startBtn.onmouseenter = () => { startBtn.style.transform = 'translateY(-2px) scale(1.02)'; startBtn.style.boxShadow = '0 10px 30px rgba(255,42,109,0.7)'; };
  startBtn.onmouseleave = () => { startBtn.style.transform = ''; startBtn.style.boxShadow = '0 6px 24px rgba(255,42,109,0.45)'; };
  startBtn.onclick = () => go(seenTutorial ? 'play' : 'tutorial');
  menu.appendChild(startBtn);

  // ⭐ 신규 플레이어용 "튜토리얼 건너뛰기" 보조 옵션 (research C1 — 베테랑 차단 방지)
  if (!seenTutorial) {
    const skipLink = document.createElement('button');
    skipLink.className = 'tap-press';
    skipLink.textContent = '튜토리얼 건너뛰기 → 바로 플레이';
    skipLink.style.cssText = `
      background:transparent;color:var(--text-dim);border:none;
      padding:10px 8px;margin-top:2px;
      min-height:36px;
      font-family:Galmuri11,monospace;font-size:12px;letter-spacing:1.5px;
      cursor:pointer;text-decoration:underline;text-underline-offset:3px;
      transition:color .15s;
    `;
    skipLink.onmouseenter = () => { skipLink.style.color = '#fff'; };
    skipLink.onmouseleave = () => { skipLink.style.color = 'var(--text-dim)'; };
    skipLink.onclick = () => { lsSetItem('samsara.tutorial.done', '1'); go('play'); };
    menu.appendChild(skipLink);
  }

  // 작은 메뉴 버튼들 (2열 그리드)
  const subMenu = el('div', `display:grid;grid-template-columns:1fr 1fr;gap:clamp(6px, 1vw, 10px)`);
  const items: [string, string, () => void][] = [
    ['🎭', '캐릭터', () => go('characterSelect')],
    ['🏆', `상점 (${meta.rp} RP)`, () => go('metaShop')],
    ['📚', '도감', () => go('codex')],
    ['👑', '리더보드', () => go('leaderboard')],
    ['📜', '업적', () => go('achievements')],
    ['⚙️', '설정', () => go('settings')],
  ];
  if (seenTutorial) items.push(['📖', '튜토리얼', () => go('tutorial')]);
  for (const [icon, label, click] of items) {
    const b = document.createElement('button');
    b.className = 'tap-press';
    b.style.cssText = `
      background:rgba(26,20,46,0.7);
      color:var(--text);
      border:1px solid rgba(255,255,255,0.12);
      padding:clamp(14px, 1.6vw, 18px) clamp(10px, 1.2vw, 16px);
      min-height:48px;
      border-radius:10px;
      font-family:Galmuri11,monospace;
      font-size:clamp(13px, 1.2vw, 17px);
      cursor:pointer;
      transition:background .15s, border .15s;
      backdrop-filter:blur(8px);
      display:flex;align-items:center;gap:8px;justify-content:center;
    `;
    b.innerHTML = `<span style="font-size:1.3em">${icon}</span> <span>${label}</span>`;
    b.onmouseenter = () => { b.style.background = 'rgba(46,32,76,0.85)'; b.style.borderColor = 'rgba(5,217,232,0.5)'; };
    b.onmouseleave = () => { b.style.background = 'rgba(26,20,46,0.7)'; b.style.borderColor = 'rgba(255,255,255,0.12)'; };
    b.onclick = click;
    subMenu.appendChild(b);
  }
  menu.appendChild(subMenu);
  main.appendChild(menu);

  // ── 하단 정보 (일일 시드 + 버전) ──
  main.appendChild(el('div', `
    position:absolute;bottom:clamp(16px, 3vh, 32px);
    color:var(--text-dim);
    font-family:Galmuri11,monospace;
    font-size:clamp(11px, 1.0vw, 14px);
    letter-spacing:2px;text-align:center;
    animation:panel-rise .8s ease-out 1s both;
  `, `오늘의 윤회 #${dailySeed()}  ·  v1.0`));

  root.appendChild(main);
  host.appendChild(root);
  return () => { try { host.removeChild(root); } catch {} };
}

// ─────────────────────────── TUTORIAL ───────────────────────────

export function mountTutorial(host: HTMLElement, _engine: Engine): () => void {
  host.innerHTML = '';

  // 키프레임 주입 (한 번만)
  if (!document.getElementById('samsara-tutorial-keyframes')) {
    const kf = document.createElement('style');
    kf.id = 'samsara-tutorial-keyframes';
    kf.textContent = `
      @keyframes tut-twinkle { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
      @keyframes tut-orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      @keyframes tut-step-in {
        0% { opacity: 0; transform: translateY(20px); }
        100% { opacity: 1; transform: translateY(0); }
      }
      @keyframes tut-cursor { 0%,49% { opacity: 1; } 50%,100% { opacity: 0; } }
      @keyframes tut-shooting {
        0% { transform: translate(-200px, 0); opacity: 0; }
        15% { opacity: 1; }
        100% { transform: translate(60vw, 30vh); opacity: 0; }
      }
      @keyframes tut-icon-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      @keyframes tut-glyph-spin { from { transform: translate(-50%,-50%) rotate(0deg); } to { transform: translate(-50%,-50%) rotate(360deg); } }
    `;
    document.head.appendChild(kf);
  }

  const steps = [
    {
      t: '환생 — REINCARNATION',
      glyph: 'REBIRTH',
      icon: '🐯',
      story: '죽음의 별이 폭발했고, 너는 작은 짐승의 몸으로 깨어났다.',
      d: 'WASD · 방향키로 이동. 모바일은 화면 드래그 = 가상 조이스틱.\n네 영혼이 갈 곳을 정한다.',
    },
    {
      t: '운명의 무기 — DESTINY',
      glyph: 'FATE',
      icon: '⚔️',
      story: '카드 한 장이 곧 너의 운명이며, 무기다.',
      d: '🔥 화염오라 · ❄️ 빙결노바 · 💰 호밍코인\n⏱️ 시간균열 · 🌀 카오스구체 · 🪞 거울가속\n자동 공격이 발현된다.',
    },
    {
      t: '사후의 적 — ENEMIES',
      glyph: 'SOUL',
      icon: '👹',
      story: '도깨비, 원귀, 잡귀가 너의 영혼을 노린다.',
      d: '화면 가장자리에서 무리 스폰. 처치 시 코인이\n자력으로 흡수되어 점수로 환산된다.',
    },
    {
      t: '정체성 발현 — IDENTITY',
      glyph: 'PATH',
      icon: '✨',
      story: '같은 길을 다섯 번 걷는 자는 그 길과 하나가 된다.',
      d: '30초마다 카드 1장 선택 → 무기 강화.\n같은 태그 5장 = 정체성 발현\n캐릭터가 영구 변신한다.',
    },
    {
      t: '윤회 — SAMSARA',
      glyph: 'CYCLE',
      icon: '🌌',
      story: '죽음은 끝이 아니다. 다시 태어나는 문이다.',
      d: '라이프 0 = 게임 오버 → RP(윤회점수) 환산\n→ 영구 잠금해제 → 새 사이클이 시작된다.\n매 죽음마다 강해진다.',
    },
  ];
  let idx = 0;

  // 풀스크린 컨테이너 (작은 화면에선 스크롤 허용)
  const root = el('div', `
    position:fixed;inset:0;overflow-y:auto;overflow-x:hidden;
    background:#02010a;
    color:var(--text);
    font-family:Pretendard,system-ui,sans-serif;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    padding:clamp(20px, 4vh, 48px) clamp(16px, 4vw, 40px);
    box-sizing:border-box;
    -webkit-overflow-scrolling:touch;
  `);

  // ── L0: 우주 그라디언트 ──
  root.appendChild(el('div', `
    position:absolute;inset:0;pointer-events:none;
    background:
      radial-gradient(ellipse at 25% 30%, rgba(177,74,255,0.22), transparent 45%),
      radial-gradient(ellipse at 75% 70%, rgba(5,217,232,0.18), transparent 50%),
      radial-gradient(ellipse at 50% 95%, rgba(255,42,109,0.14), transparent 50%),
      radial-gradient(ellipse at center, #0e0822 0%, #02010a 75%);
  `));

  // ── L1: 별 (140개) ──
  const stars = el('div', 'position:absolute;inset:0;pointer-events:none');
  let starHTML = '';
  for (let i = 0; i < 140; i++) {
    const sz = Math.random() < 0.08 ? 2.2 : 1;
    const dur = 2 + Math.random() * 4;
    const dl = Math.random() * 4;
    const col = Math.random() < 0.15 ? '#ffd7e0' : Math.random() < 0.3 ? '#aaccff' : '#ffffff';
    starHTML += `<div style="position:absolute;left:${Math.random()*100}%;top:${Math.random()*100}%;width:${sz}px;height:${sz}px;background:${col};border-radius:50%;animation:tut-twinkle ${dur}s ease-in-out ${dl}s infinite;box-shadow:0 0 ${sz*2}px ${col}"></div>`;
  }
  stars.innerHTML = starHTML;
  root.appendChild(stars);

  // ── L2: 유성 ──
  for (let i = 0; i < 2; i++) {
    root.appendChild(el('div', `
      position:absolute;
      top:${15 + i * 40}%;
      left:0;
      width:140px;height:1.5px;
      background:linear-gradient(90deg, transparent, #ffffff, transparent);
      animation:tut-shooting ${5 + i * 2}s linear ${i * 3}s infinite;
      opacity:0.6;box-shadow:0 0 8px white;
    `));
  }

  // ── L3: 회전 한자 (배경 깊이) ──
  const bgGlyph = el('div', `
    position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
    font-family:Galmuri11,monospace;
    font-size:clamp(120px, 18vw, 240px);
    font-weight:bold;letter-spacing:14px;
    color:rgba(177,74,255,0.06);
    pointer-events:none;
    animation:tut-glyph-spin 60s linear infinite;
    text-shadow:0 0 60px rgba(177,74,255,0.3);
    user-select:none;
  `, 'SAMSARA');
  root.appendChild(bgGlyph);

  // ── 메인 컨테이너 (z-index 위) ──
  const main = el('div', `
    position:relative;z-index:5;
    display:flex;flex-direction:column;align-items:center;
    width:100%;max-width:min(560px, 92vw);
    margin:auto;
  `);

  // ── 상단 스텝 인디케이터 (5점 + 라벨) ──
  const steps_dots = el('div', `
    display:flex;gap:clamp(6px, 1.5vw, 14px);align-items:center;
    margin-bottom:clamp(12px, 2vh, 24px);
    flex-wrap:wrap;justify-content:center;
  `);
  for (let i = 0; i < steps.length; i++) {
    const dot = el('div', `
      width:clamp(24px, 5vw, 36px);height:5px;border-radius:3px;
      background:rgba(255,255,255,0.12);
      transition:background .3s, box-shadow .3s;
      flex-shrink:0;
    `);
    dot.dataset.step = String(i);
    steps_dots.appendChild(dot);
  }
  main.appendChild(steps_dots);

  // 상단 라벨 (TUTORIAL · STEP X / 5)
  const stepLabel = el('div', `
    font-family:Galmuri11,monospace;
    color:rgba(5,217,232,0.85);
    font-size:14px;letter-spacing:6px;
    margin-bottom:14px;font-weight:bold;
  `, '');
  main.appendChild(stepLabel);

  // ── 카드 패널 (글래스모피즘 우주 픽셀 UI) ──
  const panel = el('div', `
    position:relative;
    width:100%;box-sizing:border-box;
    background:linear-gradient(160deg, rgba(20,12,46,0.85) 0%, rgba(10,10,26,0.92) 100%);
    border:2px solid rgba(5,217,232,0.35);
    border-radius:14px;
    padding:clamp(20px, 3.5vw, 40px) clamp(20px, 3.5vw, 40px);
    box-shadow:0 8px 40px rgba(0,0,0,0.6), 0 0 60px rgba(5,217,232,0.15), inset 0 0 0 1px rgba(255,255,255,0.05);
    overflow:hidden;
    animation:tut-step-in .5s cubic-bezier(.2,.7,.3,1.2) both;
  `);
  // 코너 장식 (4 ㄱ자)
  const corner = (pos: string) => `position:absolute;${pos};width:22px;height:22px;border:1.5px solid rgba(5,217,232,0.55);pointer-events:none`;
  panel.appendChild(el('div', `${corner('top:8px;left:8px')};border-right:none;border-bottom:none`));
  panel.appendChild(el('div', `${corner('top:8px;right:8px')};border-left:none;border-bottom:none`));
  panel.appendChild(el('div', `${corner('bottom:8px;left:8px')};border-right:none;border-top:none`));
  panel.appendChild(el('div', `${corner('bottom:8px;right:8px')};border-left:none;border-top:none`));

  // 큰 한자 글리프 (배경 우측, overflow hidden 으로 절대 안 깨짐)
  const stepGlyph = el('div', `
    position:absolute;right:-15%;top:50%;transform:translateY(-50%);
    font-family:Galmuri11,monospace;
    font-size:clamp(160px, 26vw, 240px);
    color:rgba(255,215,0,0.06);
    pointer-events:none;user-select:none;
    text-shadow:0 0 40px rgba(255,215,0,0.2);
    line-height:1;
    z-index:0;
  `, '');
  panel.appendChild(stepGlyph);

  // 컨텐츠
  const content = el('div', 'position:relative;z-index:1;text-align:center');
  // 아이콘
  const stepIcon = el('div', `
    font-size:clamp(48px, 7vw, 72px);
    margin-bottom:14px;
    animation:tut-icon-float 2.4s ease-in-out infinite;
    filter:drop-shadow(0 0 16px rgba(255,215,0,0.6)) drop-shadow(0 0 32px rgba(255,42,109,0.3));
  `, '');
  content.appendChild(stepIcon);

  // 타이틀
  const stepTitle = el('h2', `
    font-family:Galmuri11,monospace;
    margin:0 0 12px;
    font-size:clamp(26px, 4vw, 38px);
    letter-spacing:clamp(2px, 0.6vw, 6px);
    background:linear-gradient(90deg, #05d9e8, #ffd700, #ff2a6d);
    -webkit-background-clip:text;background-clip:text;
    color:transparent;
    text-shadow:0 0 30px rgba(5,217,232,0.4);
    font-weight:bold;
  `, '');
  content.appendChild(stepTitle);

  // 분리선
  content.appendChild(el('div', `
    width:60px;height:1.5px;
    background:linear-gradient(90deg, transparent, rgba(5,217,232,0.7), transparent);
    margin:0 auto 18px;
  `));

  // 스토리 (이탤릭, 황금)
  const stepStory = el('div', `
    color:#ffd700;
    font-family:Galmuri11,monospace;
    font-size:clamp(15px, 1.7vw, 19px);
    line-height:1.6;letter-spacing:1px;
    margin-bottom:18px;
    text-shadow:0 0 8px rgba(255,215,0,0.45);
    font-style:italic;
    font-weight:bold;
  `, '');
  content.appendChild(stepStory);

  // 설명 (메인 텍스트 — 터미널 스타일)
  const stepDesc = el('div', `
    color:var(--text);
    font-family:Pretendard,sans-serif;
    font-size:clamp(15px, 1.7vw, 18px);
    line-height:1.75;
    white-space:pre-line;
    word-break:keep-all;
    padding:18px 20px;
    background:rgba(0,0,0,0.4);
    border-left:3px solid rgba(5,217,232,0.6);
    border-radius:0 6px 6px 0;
    text-align:left;
    position:relative;
    box-sizing:border-box;
    width:100%;
    font-weight:500;
  `, '');
  // 터미널 프리픽스
  const terminalPrefix = el('span', `
    color:rgba(5,217,232,0.6);
    font-family:Galmuri11,monospace;
    font-size:11px;
    margin-right:6px;letter-spacing:1px;
  `, '> ');
  stepDesc.prepend(terminalPrefix);
  content.appendChild(stepDesc);

  panel.appendChild(content);
  main.appendChild(panel);

  // ── 네비게이션 버튼 ──
  const nav = el('div', 'display:flex;gap:12px;margin-top:clamp(20px, 3vh, 32px);align-items:center');

  const navBtn = (label: string, onClick: () => void, primary: boolean = false) => {
    const b = document.createElement('button');
    b.style.cssText = primary ? `
      background:linear-gradient(135deg, #ff2a6d 0%, #b14aff 50%, #05d9e8 100%);
      color:#fff;border:none;
      padding:16px 36px;border-radius:10px;
      font-family:Galmuri11,monospace;
      font-size:18px;font-weight:bold;letter-spacing:3px;
      cursor:pointer;
      box-shadow:0 6px 20px rgba(255,42,109,0.45);
      transition:transform .15s, box-shadow .15s;
    ` : `
      background:rgba(26,20,46,0.7);
      color:var(--text);
      border:1px solid rgba(255,255,255,0.15);
      padding:14px 28px;border-radius:8px;
      font-family:Galmuri11,monospace;
      font-size:16px;letter-spacing:2px;
      cursor:pointer;
      backdrop-filter:blur(8px);
      transition:background .15s, border-color .15s;
    `;
    b.textContent = label;
    if (primary) {
      b.onmouseenter = () => { b.style.transform = 'translateY(-2px) scale(1.03)'; b.style.boxShadow = '0 10px 28px rgba(255,42,109,0.7)'; };
      b.onmouseleave = () => { b.style.transform = ''; b.style.boxShadow = '0 6px 20px rgba(255,42,109,0.45)'; };
    } else {
      b.onmouseenter = () => { b.style.background = 'rgba(46,32,76,0.85)'; b.style.borderColor = 'rgba(5,217,232,0.5)'; };
      b.onmouseleave = () => { b.style.background = 'rgba(26,20,46,0.7)'; b.style.borderColor = 'rgba(255,255,255,0.15)'; };
    }
    b.onclick = onClick;
    return b;
  };

  const back = navBtn('◀  이전', () => { if (idx > 0) { idx--; render(); } });
  const next = navBtn('다음  ▶', () => {
    if (idx < steps.length - 1) { idx++; render(); }
    else { lsSetItem('samsara.tutorial.done', '1'); go('play'); }
  }, true);
  nav.appendChild(back); nav.appendChild(next);
  main.appendChild(nav);

  // 건너뛰기
  const skip = navBtn('건너뛰기 — SKIP', () => { lsSetItem('samsara.tutorial.done', '1'); go('play'); });
  skip.style.marginTop = '14px';
  skip.style.opacity = '0.6';
  skip.style.fontSize = '14px';
  skip.style.padding = '10px 22px';
  skip.onmouseenter = () => { skip.style.opacity = '1'; };
  skip.onmouseleave = () => { skip.style.opacity = '0.55'; };
  main.appendChild(skip);

  root.appendChild(main);

  function render() {
    const s = steps[idx];
    stepLabel.textContent = `TUTORIAL  ·  STEP ${idx + 1} / ${steps.length}`;
    stepIcon.textContent = s.icon;
    stepTitle.textContent = s.t;
    stepStory.textContent = `「 ${s.story} 」`;
    // 터미널 프리픽스 + 본문 다시
    stepDesc.innerHTML = '';
    const pref = el('span', `color:rgba(5,217,232,0.7);font-family:Galmuri11,monospace;font-size:11px;margin-right:6px;letter-spacing:1px`, '> ');
    stepDesc.appendChild(pref);
    stepDesc.appendChild(document.createTextNode(s.d));
    // 깜빡이는 커서
    const cursor = el('span', `display:inline-block;width:7px;height:14px;background:#05d9e8;margin-left:4px;vertical-align:middle;animation:tut-cursor 1s step-end infinite;box-shadow:0 0 6px #05d9e8`, '');
    stepDesc.appendChild(cursor);
    stepGlyph.textContent = s.glyph;
    bgGlyph.textContent = s.glyph;
    next.textContent = idx === steps.length - 1 ? '시작 ▶' : '다음 ▶';
    back.style.opacity = idx === 0 ? '0.3' : '1';
    back.style.pointerEvents = idx === 0 ? 'none' : 'auto';
    // 스텝 도트 갱신
    Array.from(steps_dots.children).forEach((d, i) => {
      const elD = d as HTMLElement;
      if (i < idx) {
        elD.style.background = 'rgba(5,217,232,0.5)';
        elD.style.boxShadow = '0 0 8px rgba(5,217,232,0.4)';
      } else if (i === idx) {
        elD.style.background = 'linear-gradient(90deg, #05d9e8, #ffd700)';
        elD.style.boxShadow = '0 0 14px rgba(5,217,232,0.8)';
      } else {
        elD.style.background = 'rgba(255,255,255,0.12)';
        elD.style.boxShadow = 'none';
      }
    });
    // 카드 페이드 리셋
    panel.style.animation = 'none';
    void panel.offsetWidth;
    panel.style.animation = 'tut-step-in .5s cubic-bezier(.2,.7,.3,1.2) both';
  }

  render();

  // 키보드 네비
  const keyHandler = (e: KeyboardEvent) => {
    if (e.code === 'ArrowRight' || e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); next.click(); }
    else if (e.code === 'ArrowLeft') { e.preventDefault(); back.click(); }
    else if (e.code === 'Escape') { e.preventDefault(); skip.click(); }
  };
  window.addEventListener('keydown', keyHandler);

  host.appendChild(root);
  return () => {
    window.removeEventListener('keydown', keyHandler);
    try { host.removeChild(root); } catch {}
  };
}

// ─────────────────────────── CARD PICK ───────────────────────────

export function mountCardPick(host: HTMLElement, engine: Engine): () => void {
  host.innerHTML = '';
  const state = engine.getState();
  const choices = engine.drawCardChoices(3 + state.extraCardChoiceCount);

  const root = el('div', `
    position:fixed;inset:0;
    background:radial-gradient(ellipse at center, rgba(14,8,34,0.96), rgba(2,1,10,0.98));
    z-index:20;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    padding:clamp(16px,3vh,32px) clamp(12px,2vw,24px);
    overflow-y:auto;overflow-x:hidden;
    -webkit-overflow-scrolling:touch;
    backdrop-filter:blur(8px);
  `);

  // 우주 픽셀 헤더 — 압축
  const header = el('div', 'text-align:center;margin-bottom:clamp(14px,2vh,22px);position:relative;z-index:1');
  header.innerHTML = `
    <div style="font-family:Galmuri11,monospace;color:rgba(5,217,232,0.7);font-size:11px;letter-spacing:6px;margin-bottom:6px">◆ DESTINY · 운명의 갈래 ◆</div>
    <h2 style="font-family:Galmuri11,monospace;margin:0;font-size:clamp(24px, 3.4vw, 36px);letter-spacing:6px;background:linear-gradient(90deg, #05d9e8, #ffd700, #ff2a6d);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 0 30px rgba(5,217,232,0.5);font-weight:bold">카드 선택</h2>
    <div style="width:80px;height:1px;background:linear-gradient(90deg,transparent,var(--ice),transparent);margin:8px auto"></div>
    <p style="color:var(--text-dim);font-size:clamp(11px,1.2vw,13px);margin:0;letter-spacing:1px">한 장을 선택해 빌드를 완성하라</p>
  `;
  root.appendChild(header);

  // 진입 컨텍스트 캡처 — pick 후엔 phase 가 'playing' 으로 변하므로 사전에 기록.
  // 레벨업 픽: 일시정지 상태 + 웨이브 시간 남음 → RESUME (새 웨이브 시작 X)
  // 웨이브 종료 픽: cardPick 페이즈 → 다음 웨이브 시작
  const wasLevelUp = state.phase === 'paused' && state.waveTimeRemaining > 0.5;

  const cards = el('div', 'display:flex;gap:clamp(14px, 2vw, 28px);flex-wrap:wrap;justify-content:center;max-width:min(1280px, 96vw);padding:0 clamp(8px, 1.5vw, 24px)');
  const ownedCards = state.cards as Card[];
  for (const c of choices) {
    cards.appendChild(cardEl(c, () => {
      engine.dispatch({ type: 'PICK_CARD', card: c });
      // 업적 트래킹
      const tr = loadTracker();
      trackCardPick(c, tr);
      saveTracker(tr);
      go('play');
      setTimeout(() => {
        if (wasLevelUp) {
          // PICK_CARD 가 phase='playing' 으로 바꿨으므로 RESUME 불필요. 진행 중인 웨이브 유지.
        } else {
          const fn = (window as any).__samsara_startNextWave;
          if (fn) fn(); else engine.startWave();
        }
      }, 200);
    }, ownedCards));
  }
  root.appendChild(cards);

  // 액션 바 (리롤 + 스킵 — 명확한 라벨, 색 구분)
  const actionBar = el('div', `
    margin-top:clamp(20px,3vh,28px);
    display:flex;gap:clamp(8px,1.2vw,14px);align-items:center;justify-content:center;
    flex-wrap:wrap;
  `);
  // 리롤 (있을 때만, 황금)
  if (state.rerollsRemaining > 0) {
    const rerollBtn = document.createElement('button');
    rerollBtn.innerHTML = `🎲  리롤  <span style="opacity:0.7;font-size:0.85em">(${state.rerollsRemaining}회 남음)</span>`;
    rerollBtn.style.cssText = `
      background:linear-gradient(135deg, rgba(255,215,0,0.85), rgba(255,136,0,0.85));
      color:#000;border:none;
      padding:11px 22px;border-radius:8px;
      font-family:Galmuri11,monospace;font-size:13px;font-weight:bold;letter-spacing:2px;
      cursor:pointer;
      box-shadow:0 4px 14px rgba(255,215,0,0.4);
      transition:transform .15s, box-shadow .15s;
    `;
    rerollBtn.onmouseenter = () => { rerollBtn.style.transform = 'translateY(-1px)'; rerollBtn.style.boxShadow = '0 6px 20px rgba(255,215,0,0.6)'; };
    rerollBtn.onmouseleave = () => { rerollBtn.style.transform = ''; rerollBtn.style.boxShadow = '0 4px 14px rgba(255,215,0,0.4)'; };
    rerollBtn.onclick = () => {
      const mut = engine.getState() as import('../game/types.js').GameState;
      mut.rerollsRemaining -= 1;
      go('cardPick'); // 다시 mount → 새 추첨
    };
    actionBar.appendChild(rerollBtn);
  }
  // 스킵 (회색 ghost)
  const skipBtn = document.createElement('button');
  skipBtn.innerHTML = '✕  건너뛰기';
  skipBtn.style.cssText = `
    background:rgba(26,20,46,0.7);
    color:var(--text-dim);
    border:1px solid rgba(255,255,255,0.15);
    padding:11px 22px;border-radius:8px;
    font-family:Galmuri11,monospace;font-size:13px;letter-spacing:2px;
    cursor:pointer;
    backdrop-filter:blur(8px);
    transition:background .15s, color .15s, border-color .15s;
  `;
  skipBtn.onmouseenter = () => { skipBtn.style.background = 'rgba(46,32,76,0.85)'; skipBtn.style.color = 'var(--text)'; skipBtn.style.borderColor = 'rgba(255,255,255,0.3)'; };
  skipBtn.onmouseleave = () => { skipBtn.style.background = 'rgba(26,20,46,0.7)'; skipBtn.style.color = 'var(--text-dim)'; skipBtn.style.borderColor = 'rgba(255,255,255,0.15)'; };
  skipBtn.onclick = () => {
    engine.dispatch({ type: 'SKIP_CARD' });
    go('play');
    setTimeout(() => {
      if (!wasLevelUp) engine.startWave();
    }, 200);
  };
  actionBar.appendChild(skipBtn);
  root.appendChild(actionBar);

  host.appendChild(root);
  return () => { try { host.removeChild(root); } catch {} };
}

// ─────────────────────────── RITUAL (보스 격파 후) ───────────────────────────

export function mountRitual(host: HTMLElement, engine: Engine): () => void {
  host.innerHTML = '';
  injectCosmicKeyframes();
  const choices = drawRitualChoices();

  // 추가 키프레임 (의식 분위기)
  if (!document.getElementById('samsara-ritual-keyframes')) {
    const kf = document.createElement('style');
    kf.id = 'samsara-ritual-keyframes';
    kf.textContent = `
      @keyframes ri-sigil-rotate { from { transform: translate(-50%,-50%) rotate(0deg); } to { transform: translate(-50%,-50%) rotate(360deg); } }
      @keyframes ri-card-glow { 0%,100% { box-shadow: 0 0 24px rgba(255,215,0,0.3), inset 0 0 0 1px rgba(255,215,0,0.15); } 50% { box-shadow: 0 0 40px rgba(255,215,0,0.6), inset 0 0 0 1px rgba(255,215,0,0.3); } }
      @keyframes ri-flame { 0%,100% { transform: translateY(0) scaleY(1); opacity: 0.7; } 50% { transform: translateY(-6px) scaleY(1.15); opacity: 1; } }
    `;
    document.head.appendChild(kf);
  }

  const root = el('div', `
    position:fixed;inset:0;overflow-y:auto;overflow-x:hidden;
    background:radial-gradient(ellipse at center, #1a0a0a 0%, #02010a 70%);
    color:var(--text);font-family:Pretendard,system-ui,sans-serif;
    z-index:20;
    -webkit-overflow-scrolling:touch;
  `);

  // 어두운 우주 배경 + 황금 톤
  for (const layer of cosmicBackdrop(60, 'rgba(255,215,0,0.5)')) root.appendChild(layer);

  // 회전 인장 (배경 글리프)
  root.appendChild(el('div', `
    position:absolute;left:50%;top:42%;
    width:clamp(400px,50vw,720px);height:clamp(400px,50vw,720px);
    border:1px solid rgba(255,215,0,0.08);border-radius:50%;
    pointer-events:none;
    animation:ri-sigil-rotate 80s linear infinite;
    box-shadow:inset 0 0 80px rgba(255,215,0,0.05);
  `));
  root.appendChild(el('div', `
    position:absolute;left:50%;top:42%;
    font-family:Galmuri11,monospace;
    font-size:clamp(140px,22vw,280px);
    color:rgba(255,215,0,0.05);font-weight:bold;letter-spacing:30px;
    transform:translate(-50%,-50%);
    pointer-events:none;user-select:none;
    text-shadow:0 0 60px rgba(255,215,0,0.15);
  `, 'RITUAL'));

  const main = el('div', `
    position:relative;z-index:5;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    min-height:100%;padding:clamp(32px,5vh,56px) clamp(16px,3vw,32px);
    box-sizing:border-box;
  `);

  // 헤더 — 의식 / RITUAL
  const header = el('div', `
    text-align:center;margin-bottom:clamp(24px,4vh,40px);
    animation:mn-fade-up .8s ease-out both;
  `);
  header.innerHTML = `
    <div style="font-family:Galmuri11,monospace;color:rgba(255,215,0,0.7);font-size:11px;letter-spacing:6px;margin-bottom:6px">◆ RITUAL · 보스 격파의 보상 ◆</div>
    <h2 style="font-family:Galmuri11,monospace;font-size:clamp(36px,5.5vw,64px);margin:0;letter-spacing:clamp(6px,1.5vw,16px);background:linear-gradient(90deg,#ffd700,#ff2a6d,#ffd700);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 0 40px rgba(255,215,0,0.5);font-weight:bold;animation:hl-pb-shimmer 3s linear infinite">의 식</h2>
    <div style="width:80px;height:1.5px;background:linear-gradient(90deg,transparent,#ffd700,transparent);margin:14px auto"></div>
    <div style="color:var(--text);font-family:Galmuri11,monospace;font-size:clamp(13px,1.4vw,16px);letter-spacing:2px">영구 런 버프 한 가지를 선택하라</div>
  `;
  main.appendChild(header);

  const cards = el('div', `
    display:flex;gap:clamp(14px,2vw,22px);flex-wrap:wrap;justify-content:center;
    max-width:min(900px,96vw);
    animation:mn-fade-up .8s ease-out .2s both;
  `);

  const RITUAL_ICONS = ['🔥', '⚡', '💎', '🌟', '🩸', '⚔️', '🛡️', '👁️', '🌙'];

  for (let i = 0; i < choices.length; i++) {
    const r = choices[i];
    const icon = RITUAL_ICONS[i % RITUAL_ICONS.length];
    const c = el('div', `
      position:relative;
      width:clamp(220px,28vw,280px);
      min-height:clamp(280px,38vh,340px);
      background:linear-gradient(160deg, rgba(40,28,8,0.9) 0%, rgba(20,12,4,0.95) 100%);
      border:2px solid #ffd700;
      border-radius:14px;padding:clamp(16px,2.2vw,22px);
      cursor:pointer;
      display:flex;flex-direction:column;align-items:center;text-align:center;gap:14px;
      transition:transform .25s cubic-bezier(.2,.9,.3,1.2), box-shadow .25s;
      animation:ri-card-glow 3.5s ease-in-out infinite;
      overflow:hidden;
    `);

    // 코너 인장
    const cornerCSS = (pos: string) => `position:absolute;${pos};width:18px;height:18px;border:1.5px solid #ffd700;pointer-events:none;opacity:0.7`;
    c.appendChild(el('div', `${cornerCSS('top:8px;left:8px')};border-right:none;border-bottom:none`));
    c.appendChild(el('div', `${cornerCSS('top:8px;right:8px')};border-left:none;border-bottom:none`));
    c.appendChild(el('div', `${cornerCSS('bottom:8px;left:8px')};border-right:none;border-top:none`));
    c.appendChild(el('div', `${cornerCSS('bottom:8px;right:8px')};border-left:none;border-top:none`));

    // 배경 글로우
    c.appendChild(el('div', `position:absolute;inset:0;background:radial-gradient(ellipse at top, rgba(255,215,0,0.15), transparent 60%);pointer-events:none`));

    const inner = el('div', 'position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:14px;width:100%;height:100%;justify-content:space-between');
    inner.innerHTML = `
      <div style="font-size:clamp(48px,5.5vw,68px);filter:drop-shadow(0 0 16px #ffd700) drop-shadow(0 0 32px rgba(255,42,109,0.4));animation:ri-flame 2.4s ease-in-out infinite">${icon}</div>
      <div style="font-family:Galmuri11,monospace;font-size:clamp(16px,1.8vw,20px);color:#ffd700;font-weight:bold;letter-spacing:2px;text-shadow:0 0 12px rgba(255,215,0,0.7);line-height:1.3">${r.name_ko}</div>
      <div style="height:1px;width:48px;background:linear-gradient(90deg,transparent,rgba(255,215,0,0.7),transparent)"></div>
      <div style="font-size:clamp(12px,1.2vw,14px);color:var(--text);line-height:1.6;letter-spacing:0.5px">${r.desc_ko}</div>
      <div style="margin-top:auto;padding:8px 14px;border:1px dashed rgba(255,215,0,0.4);border-radius:6px;font-family:Galmuri11,monospace;font-size:10px;color:rgba(255,215,0,0.7);letter-spacing:3px">▼ 선택 ▼</div>
    `;
    c.appendChild(inner);

    c.onmouseenter = () => {
      c.style.transform = 'translateY(-8px) scale(1.04)';
      c.style.boxShadow = '0 16px 40px rgba(0,0,0,0.6), 0 0 60px rgba(255,215,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.15)';
      c.style.animation = 'none';
    };
    c.onmouseleave = () => {
      c.style.transform = '';
      c.style.boxShadow = '';
      c.style.animation = 'ri-card-glow 3.5s ease-in-out infinite';
    };
    c.onclick = () => {
      r.apply(engine.getState() as any);
      go('play');
      setTimeout(() => {
        const phase = engine.getState().phase;
        if (phase === 'paused') {
          engine.dispatch({ type: 'RESUME' });
        } else {
          const fn = (window as any).__samsara_startNextWave;
          if (fn) fn(); else engine.startWave();
        }
      }, 200);
    };
    cards.appendChild(c);
  }
  main.appendChild(cards);

  // 안내
  main.appendChild(el('div', `
    margin-top:clamp(20px,3vh,32px);
    color:var(--text-dim);font-family:Galmuri11,monospace;font-size:11px;
    letter-spacing:3px;text-align:center;
    animation:mn-fade-up .7s ease-out .4s both;
  `, '※ 선택한 버프는 이번 런이 끝날 때까지 지속된다'));

  root.appendChild(main);
  host.appendChild(root);
  return () => { try { host.removeChild(root); } catch {} };
}

// ─────────────────────────── META SHOP ───────────────────────────

const META_PRICES = {
  unlockCard: 5,
  unlockMod: 8,
  unlockSkin: 30,
  unlockBgm: 50,
  startLife: 100,
  startSlot: 200,
  // startCoins 50→5: 50RP=50만 코인 들여 +500 코인 = 1000:1 손해였음 (디자인 결함).
  // 5RP=5만 코인 들여 +500 코인 = 100:1. 여전히 부드러운 진입 부스트지만 trap 가격은 아님.
  // 5단계 다 사면 25RP=25만 코인으로 +2,500 코인 영구 → 후속 런 가속.
  startCoins: 5,
  rpRate: 75,
};

export function mountMetaShop(host: HTMLElement, engine: Engine): () => void {
  host.innerHTML = '';
  injectCosmicKeyframes();
  const meta = engine.getState().meta;

  const root = el('div', `
    position:fixed;inset:0;overflow-y:auto;overflow-x:hidden;
    background:#02010a;color:var(--text);font-family:Pretendard,system-ui,sans-serif;
    -webkit-overflow-scrolling:touch;
  `);
  for (const layer of cosmicBackdrop(120, 'rgba(255,215,0,0.4)')) root.appendChild(layer);

  // 회전 한자 배경 (사원 분위기)
  root.appendChild(el('div', `
    position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);
    font-family:Galmuri11,monospace;
    font-size:clamp(160px,24vw,300px);
    color:rgba(255,215,0,0.04);font-weight:bold;
    pointer-events:none;user-select:none;letter-spacing:20px;
    text-shadow:0 0 60px rgba(255,215,0,0.2);
  `, 'SAMSARA'));

  const main = el('div', `
    position:relative;z-index:5;
    display:flex;flex-direction:column;align-items:center;
    padding:clamp(60px,8vh,90px) clamp(16px,3vw,32px) clamp(32px,5vh,48px);
    width:100%;max-width:min(900px,96vw);margin:auto;box-sizing:border-box;
  `);
  main.appendChild(cosmicHeader('환생의 사원', '윤회 점수로 영구히 강해진다', '#ffd700'));

  // RP 상태 패널
  const rpPanel = el('div', `
    width:100%;max-width:420px;
    background:linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,42,109,0.10));
    border:1.5px solid rgba(255,215,0,0.5);
    border-radius:12px;
    padding:clamp(14px,2vw,20px);
    margin-bottom:clamp(20px,3vh,28px);
    text-align:center;
    box-shadow:0 0 28px rgba(255,215,0,0.2), inset 0 0 0 1px rgba(255,255,255,0.04);
    animation:mn-fade-up .7s ease-out .15s both, mn-glow-pulse 4s ease-in-out infinite;
    backdrop-filter:blur(6px);
  `);
  rpPanel.innerHTML = `
    <div style="color:rgba(255,215,0,0.7);font-family:Galmuri11,monospace;font-size:11px;letter-spacing:4px;margin-bottom:6px">보유 윤회 점수</div>
    <div style="font-family:Galmuri11,monospace;font-size:clamp(36px,5vw,52px);color:#ffd700;font-weight:bold;text-shadow:0 0 18px rgba(255,215,0,0.8);line-height:1">${meta.rp} <span style="font-size:0.5em;color:rgba(255,215,0,0.7)">RP</span></div>
  `;
  main.appendChild(rpPanel);

  // 아이템 그리드
  const itemsEl = el('div', `
    width:100%;
    display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
    gap:clamp(10px,1.5vw,14px);
    animation:mn-fade-up .7s ease-out .3s both;
  `);

  const m2: any = meta;
  const items: { id: string; icon: string; label: string; desc: string; cost: number; max?: number; current: number; apply: () => void; tagColor: string }[] = [
    // 큰 강화 4종 (기존)
    { id: 'startLife',  icon: '❤️', label: '시작 라이프 +1',     desc: '매 런 시작 시 라이프 +1',  cost: META_PRICES.startLife, max: 3, current: meta.startingLifeBonus,                       apply: () => meta.startingLifeBonus += 1,         tagColor: '#ff2a6d' },
    { id: 'startSlot',  icon: '🃏', label: '시작 카드 슬롯 +1',  desc: '카드 보유 한도 +1 (한 번만)', cost: META_PRICES.startSlot, max: 1, current: meta.startingCardSlotBonus,                  apply: () => meta.startingCardSlotBonus += 1,     tagColor: '#b14aff' },
    { id: 'startCoins', icon: '💰', label: '시작 코인 +500',    desc: '런 시작 시 영혼 +500 부여',   cost: META_PRICES.startCoins, max: 5, current: Math.floor(meta.startingCoinsBonus / 500),  apply: () => meta.startingCoinsBonus += 500,      tagColor: '#ffd700' },
    { id: 'rpRate',     icon: '✨', label: 'RP 환산 효율 +10%', desc: '점수 → RP 환산률 영구 증가', cost: META_PRICES.rpRate,    max: 3, current: Math.round(meta.rpRateBonus * 10),            apply: () => meta.rpRateBonus += 0.1,             tagColor: '#05d9e8' },
    // ⭐ 미세 강화 4종 (50단계, 각 +5%, RP 5/단계). VS 패턴.
    { id: 'mHp',     icon: '🛡️', label: '체력 +5%',       desc: '최대 라이프 영구 +5% (50단계)', cost: 5,  max: 50, current: m2.metaHpStacks ?? 0,     apply: () => m2.metaHpStacks = (m2.metaHpStacks ?? 0) + 1,         tagColor: '#ff6688' },
    { id: 'mDmg',    icon: '⚔️', label: '데미지 +5%',     desc: '모든 무기 데미지 영구 +5% (50단계)', cost: 5,  max: 50, current: m2.metaDmgStacks ?? 0,    apply: () => m2.metaDmgStacks = (m2.metaDmgStacks ?? 0) + 1,        tagColor: '#ff8800' },
    { id: 'mSpeed',  icon: '🏃', label: '이동 속도 +5%',  desc: '플레이어 이동 영구 +5% (6단계 cap)', cost: 8,  max: 6,  current: m2.metaSpeedStacks ?? 0,  apply: () => m2.metaSpeedStacks = (m2.metaSpeedStacks ?? 0) + 1,    tagColor: '#05d9e8' },
    { id: 'mMagnet', icon: '🧲', label: '픽업 자력 +5%',   desc: '코인/XP 자석 반경 영구 +5% (50단계)', cost: 4,  max: 50, current: m2.metaMagnetStacks ?? 0, apply: () => m2.metaMagnetStacks = (m2.metaMagnetStacks ?? 0) + 1,  tagColor: '#b3ff00' },
  ];

  for (const item of items) {
    const limited = item.max != null && item.current >= item.max;
    const affordable = meta.rp >= item.cost && !limited;
    const card = el('div', `
      position:relative;
      background:linear-gradient(160deg, rgba(20,12,46,0.85), rgba(10,10,26,0.92));
      border:1.5px solid ${limited ? '#ffd700' : item.tagColor + '55'};
      border-radius:12px;
      padding:clamp(14px,2vw,18px);
      box-shadow:0 4px 16px rgba(0,0,0,0.4), 0 0 24px ${item.tagColor}22, inset 0 0 0 1px rgba(255,255,255,0.04);
      transition:transform .2s, box-shadow .2s, border-color .2s;
      overflow:hidden;
      ${limited ? 'opacity:0.85' : ''}
    `);

    // 진행 막대 (max가 있는 항목만)
    const progressHTML = item.max != null
      ? `<div style="height:5px;background:rgba(0,0,0,0.5);border-radius:3px;overflow:hidden;margin:8px 0;border:1px solid ${item.tagColor}33"><div style="height:100%;width:${(item.current/item.max)*100}%;background:linear-gradient(90deg,${item.tagColor}aa,${item.tagColor});box-shadow:0 0 6px ${item.tagColor};border-radius:2px"></div></div>`
      : '';

    card.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:8px">
        <div style="font-size:36px;filter:drop-shadow(0 0 10px ${item.tagColor})">${item.icon}</div>
        <div style="flex:1">
          <div style="font-family:Galmuri11,monospace;font-size:14px;color:${item.tagColor};font-weight:bold;letter-spacing:1.5px;text-shadow:0 0 6px ${item.tagColor}66">${item.label}</div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:4px;line-height:1.5">${item.desc}</div>
        </div>
      </div>
      ${progressHTML}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-family:Galmuri11,monospace;font-size:11px">
        <span style="color:var(--text-dim);letter-spacing:1.5px">진행: <span style="color:var(--text)">${item.current}${item.max != null ? `/${item.max}` : ''}</span></span>
        <span style="color:#ffd700;font-weight:bold;text-shadow:0 0 6px rgba(255,215,0,0.5)">${item.cost} RP</span>
      </div>
    `;

    const buyBtn = document.createElement('button');
    buyBtn.textContent = limited ? '★  최대 도달' : (affordable ? '구매' : 'RP 부족');
    buyBtn.disabled = !affordable;
    buyBtn.style.cssText = limited
      ? `width:100%;margin-top:10px;padding:10px;background:linear-gradient(135deg,#ffd700,#ff8800);color:#000;border:none;border-radius:8px;font-family:Galmuri11,monospace;font-size:12px;font-weight:bold;letter-spacing:3px;cursor:default;box-shadow:0 0 12px rgba(255,215,0,0.5)`
      : affordable
        ? `width:100%;margin-top:10px;padding:10px;background:linear-gradient(135deg,${item.tagColor},${item.tagColor}88);color:#fff;border:none;border-radius:8px;font-family:Galmuri11,monospace;font-size:12px;font-weight:bold;letter-spacing:3px;cursor:pointer;transition:transform .15s, box-shadow .15s;box-shadow:0 4px 12px ${item.tagColor}44`
        : `width:100%;margin-top:10px;padding:10px;background:rgba(255,255,255,0.05);color:var(--text-dim);border:1px solid rgba(255,255,255,0.1);border-radius:8px;font-family:Galmuri11,monospace;font-size:12px;letter-spacing:3px;cursor:not-allowed;opacity:0.6`;
    if (affordable) {
      buyBtn.onmouseenter = () => { buyBtn.style.transform = 'translateY(-1px)'; buyBtn.style.boxShadow = `0 6px 18px ${item.tagColor}77`; };
      buyBtn.onmouseleave = () => { buyBtn.style.transform = ''; buyBtn.style.boxShadow = `0 4px 12px ${item.tagColor}44`; };
      buyBtn.onclick = () => {
        meta.rp -= item.cost;
        item.apply();
        saveMeta(meta);
        go('home'); setTimeout(() => go('metaShop'), 0);
      };
    }
    card.appendChild(buyBtn);

    if (affordable) {
      card.onmouseenter = () => { card.style.transform = 'translateY(-3px)'; card.style.boxShadow = `0 8px 28px rgba(0,0,0,0.5), 0 0 32px ${item.tagColor}55, inset 0 0 0 1px rgba(255,255,255,0.08)`; };
      card.onmouseleave = () => { card.style.transform = ''; card.style.boxShadow = `0 4px 16px rgba(0,0,0,0.4), 0 0 24px ${item.tagColor}22, inset 0 0 0 1px rgba(255,255,255,0.04)`; };
    }
    itemsEl.appendChild(card);
  }
  main.appendChild(itemsEl);

  // 안내 메시지
  main.appendChild(el('div', `
    margin-top:clamp(20px,3vh,28px);text-align:center;
    color:var(--text-dim);font-family:Galmuri11,monospace;font-size:11px;
    letter-spacing:2px;line-height:1.7;
    animation:mn-fade-up .7s ease-out .5s both;
  `, '윤회를 거듭할수록, 다음 생은 더 강해진다.<br>매 죽음마다 점수의 1/10000이 RP로 환산된다.'));

  root.appendChild(main);
  root.appendChild(cosmicBackButton());
  host.appendChild(root);
  return () => { try { host.removeChild(root); } catch {} };
}

// ─────────────────────────── LEADERBOARD ───────────────────────────

export function mountLeaderboard(host: HTMLElement, engine: Engine): () => void {
  host.innerHTML = '';
  injectCosmicKeyframes();
  const myNick = (typeof localStorage !== 'undefined' && localStorage.getItem('samsara.nick')) || '';

  const root = el('div', `
    position:fixed;inset:0;overflow-y:auto;overflow-x:hidden;
    background:#02010a;color:var(--text);font-family:Pretendard,system-ui,sans-serif;
    -webkit-overflow-scrolling:touch;
  `);
  for (const layer of cosmicBackdrop(80, 'rgba(5,217,232,0.4)')) root.appendChild(layer);

  const main = el('div', `
    position:relative;z-index:5;
    display:flex;flex-direction:column;align-items:center;
    padding:clamp(60px,8vh,90px) clamp(16px,3vw,32px) clamp(32px,5vh,48px);
    width:100%;max-width:min(560px,94vw);margin:auto;box-sizing:border-box;
  `);
  main.appendChild(cosmicHeader('오늘의 챔피언', `일일 시드 #${dailySeed()}`, '#05d9e8'));

  // 자기 베스트 표시 카드
  const myBox = el('div', `
    width:100%;max-width:380px;
    background:linear-gradient(135deg, rgba(255,215,0,0.12), rgba(5,217,232,0.08));
    border:1.5px solid rgba(255,215,0,0.4);
    border-radius:12px;padding:14px 18px;margin-bottom:16px;
    text-align:center;
    box-shadow:0 0 24px rgba(255,215,0,0.15);
    animation:mn-fade-up .7s ease-out .15s both;
    backdrop-filter:blur(6px);
  `);
  myBox.innerHTML = `
    <div style="font-family:Galmuri11,monospace;color:rgba(255,215,0,0.7);font-size:10px;letter-spacing:3px;margin-bottom:4px">★ 내 최고 점수</div>
    <div style="font-family:Galmuri11,monospace;font-size:28px;color:#ffd700;font-weight:bold;text-shadow:0 0 12px rgba(255,215,0,0.6)">${formatNum(engine.getState().meta.bestScore)}</div>
  `;
  main.appendChild(myBox);

  const listPanel = el('div', `
    width:100%;
    background:linear-gradient(160deg, rgba(20,12,46,0.85), rgba(10,10,26,0.92));
    border:1.5px solid rgba(5,217,232,0.3);
    border-radius:12px;padding:8px 14px;
    box-shadow:0 8px 30px rgba(0,0,0,0.5), 0 0 40px rgba(5,217,232,0.12), inset 0 0 0 1px rgba(255,255,255,0.04);
    animation:mn-fade-up .7s ease-out .25s both;
    min-height:220px;
  `);
  listPanel.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:60px 0;font-family:Galmuri11,monospace;font-size:13px;letter-spacing:3px">불러오는 중…</div>';
  main.appendChild(listPanel);

  // 비동기 채움
  import('../services/leaderboard.js').then(async (m) => {
    const rows = await m.topToday(10);
    if (rows.length === 0) {
      listPanel.innerHTML = `
        <div style="text-align:center;padding:48px 16px;font-family:Galmuri11,monospace">
          <div style="font-size:48px;margin-bottom:12px;opacity:0.3">👻</div>
          <div style="color:var(--text-dim);letter-spacing:2px">아직 기록이 없습니다.</div>
          <div style="color:var(--ice);margin-top:14px;font-size:13px;letter-spacing:2px">최초의 챔피언이 되어보세요.</div>
          ${m.isLeaderboardEnabled() ? '' : '<div style="color:var(--warn);margin-top:18px;font-size:10px;letter-spacing:1.5px">⚠ Supabase 미설정 — 로컬 랭킹만 표시</div>'}
        </div>
      `;
      return;
    }
    listPanel.innerHTML = '';
    rows.forEach((r, i) => {
      const isMe = myNick && r.nickname === myNick;
      const tier: [string, string] = i === 0 ? ['🥇', '#ffd700'] : i === 1 ? ['🥈', '#dddddd'] : i === 2 ? ['🥉', '#cd7f32'] : [String(i + 1), 'rgba(255,255,255,0.4)'];
      const row = el('div', `
        display:grid;grid-template-columns:36px 1fr auto;gap:10px;align-items:center;
        padding:10px 8px;border-bottom:1px solid rgba(255,255,255,0.05);
        font-family:Galmuri11,monospace;
        ${isMe ? 'background:linear-gradient(90deg, rgba(255,215,0,0.18), transparent);border-left:3px solid #ffd700;padding-left:10px;' : ''}
        animation:mn-fade-up .4s ease-out ${i * 0.05}s both;
        transition:background .15s;
      `);
      if (!isMe) {
        row.onmouseenter = () => { row.style.background = 'rgba(255,255,255,0.04)'; };
        row.onmouseleave = () => { row.style.background = ''; };
      }
      row.innerHTML = `
        <span style="color:${tier[1]};font-size:${i < 3 ? '20px' : '14px'};font-weight:bold;text-align:center;${i < 3 ? `text-shadow:0 0 10px ${tier[1]}aa` : ''}">${tier[0]}</span>
        <div style="overflow:hidden">
          <div style="color:${isMe ? '#ffd700' : 'var(--text)'};font-size:14px;letter-spacing:1px;font-weight:${isMe ? 'bold' : 'normal'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(r.nickname)}${isMe ? '  <span style="font-size:9px;color:#ffd700;letter-spacing:2px">[YOU]</span>' : ''}</div>
          ${r.run_identity ? `<div style="color:var(--text-dim);font-size:10px;margin-top:1px;letter-spacing:1px">${escapeHtml(r.run_identity)}</div>` : ''}
        </div>
        <span style="color:#ffd700;font-size:15px;font-weight:bold;text-shadow:0 0 6px rgba(255,215,0,0.4)">${formatNum(r.score)}</span>
      `;
      listPanel.appendChild(row);
    });
  }).catch(err => {
    listPanel.innerHTML = `<div style="color:var(--bad);text-align:center;padding:32px;font-family:Galmuri11,monospace;letter-spacing:2px">⚠ 로드 실패: ${err.message}</div>`;
  });

  // 어떻게 등록? 가이드
  main.appendChild(el('div', `
    margin-top:18px;color:var(--text-dim);font-family:Galmuri11,monospace;font-size:11px;
    letter-spacing:2px;text-align:center;line-height:1.7;
    animation:mn-fade-up .7s ease-out .5s both;
  `, '게임 오버 후 닉네임을 등록하면<br>여기에 점수가 기록됩니다.'));

  // ⭐ 윤회 도감 진행 — 점수 경쟁 옆에 "수집/깊이" 축을 함께 노출 (재플레이 동기).
  main.appendChild(discoveryCodexPanel(engine.getState().meta, {
    containerAnim: 'margin-top:18px;animation:mn-fade-up .7s ease-out .55s both;',
    showExtended: true, modifierTotal: allModifierDefs().length, biomeTotal: BIOME_KINDS.length,
  }));

  root.appendChild(main);
  root.appendChild(cosmicBackButton());
  host.appendChild(root);
  return () => { try { host.removeChild(root); } catch {} };
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

// ─────────────────────────── SETTINGS ───────────────────────────

export function mountSettings(host: HTMLElement, engine: Engine): () => void {
  host.innerHTML = '';
  injectCosmicKeyframes();
  const meta = engine.getState().meta;

  // 커스텀 슬라이더 키프레임 (한 번만)
  if (!document.getElementById('samsara-slider-style')) {
    const st = document.createElement('style');
    st.id = 'samsara-slider-style';
    st.textContent = `
      .samsara-slider { -webkit-appearance:none;appearance:none;width:100%;height:6px;background:transparent;cursor:pointer;outline:none; }
      .samsara-slider::-webkit-slider-runnable-track { height:6px;background:linear-gradient(90deg,#05d9e8 var(--p,50%),rgba(255,255,255,0.12) var(--p,50%));border-radius:3px;box-shadow:0 0 8px rgba(5,217,232,0.3); }
      .samsara-slider::-moz-range-track { height:6px;background:linear-gradient(90deg,#05d9e8 var(--p,50%),rgba(255,255,255,0.12) var(--p,50%));border-radius:3px;box-shadow:0 0 8px rgba(5,217,232,0.3); }
      .samsara-slider::-webkit-slider-thumb { -webkit-appearance:none;appearance:none;width:18px;height:18px;background:linear-gradient(135deg,#ffd700,#ff2a6d);border-radius:50%;border:2px solid #fff;cursor:grab;margin-top:-7px;box-shadow:0 0 12px rgba(255,215,0,0.6); }
      .samsara-slider::-moz-range-thumb { width:18px;height:18px;background:linear-gradient(135deg,#ffd700,#ff2a6d);border-radius:50%;border:2px solid #fff;cursor:grab;box-shadow:0 0 12px rgba(255,215,0,0.6); }
      .samsara-slider:active::-webkit-slider-thumb { transform:scale(1.15);cursor:grabbing; }
    `;
    document.head.appendChild(st);
  }

  const root = el('div', `
    position:fixed;inset:0;overflow-y:auto;overflow-x:hidden;
    background:#02010a;color:var(--text);font-family:Pretendard,system-ui,sans-serif;
    -webkit-overflow-scrolling:touch;
  `);
  for (const layer of cosmicBackdrop(80, 'rgba(5,217,232,0.4)')) root.appendChild(layer);

  const main = el('div', `
    position:relative;z-index:5;
    display:flex;flex-direction:column;align-items:center;
    padding:clamp(60px,8vh,90px) clamp(16px,3vw,32px) clamp(32px,5vh,48px);
    width:100%;max-width:min(560px,94vw);margin:auto;box-sizing:border-box;
  `);
  main.appendChild(cosmicHeader('설정', 'SETTINGS · 환경 조정'));

  // ── 오디오 섹션 ──
  const audioPanel = el('div', 'display:flex;flex-direction:column;gap:18px');
  const audioWrap = cosmicPanel(audioPanel, 'rgba(5,217,232,0.3)');
  audioWrap.style.width = '100%';
  audioWrap.style.marginBottom = '14px';

  const sectionTitle = (icon: string, label: string) => el('div', `
    font-family:Galmuri11,monospace;color:rgba(5,217,232,0.85);font-size:11px;
    letter-spacing:4px;margin-bottom:6px
  `, `${icon}  ${label}`);

  audioPanel.appendChild(sectionTitle('🎵', 'AUDIO'));

  function makeSlider(label: string, key: 'bgmVol' | 'sfxVol', initial: number, onChange: (v: number) => void): HTMLElement {
    const wrap = el('div', '');
    const labelRow = el('div', 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-family:Galmuri11,monospace;font-size:13px');
    const lblSpan = el('span', 'color:var(--text)', label);
    const valSpan = el('span', 'color:var(--gold);font-weight:bold;font-size:14px;text-shadow:0 0 6px rgba(255,215,0,0.5)', `${Math.round(initial * 100)}`);
    labelRow.appendChild(lblSpan); labelRow.appendChild(valSpan);
    wrap.appendChild(labelRow);
    const input = document.createElement('input');
    input.type = 'range'; input.min = '0'; input.max = '100'; input.value = String(Math.round(initial * 100));
    input.className = 'samsara-slider';
    input.style.setProperty('--p', `${Math.round(initial * 100)}%`);
    input.oninput = () => {
      const v = Number(input.value) / 100;
      meta[key] = v;
      onChange(v);
      input.style.setProperty('--p', `${input.value}%`);
      valSpan.textContent = String(Math.round(v * 100));
      saveMeta(meta);
    };
    wrap.appendChild(input);
    return wrap;
  }
  audioPanel.appendChild(makeSlider('BGM 볼륨', 'bgmVol', meta.bgmVol, setBgmVolume));
  audioPanel.appendChild(makeSlider('SFX 볼륨', 'sfxVol', meta.sfxVol, setSfxVolume));
  main.appendChild(audioWrap);

  // ── 비주얼 섹션 ──
  const visualPanel = el('div', 'display:flex;flex-direction:column;gap:14px');
  const visualWrap = cosmicPanel(visualPanel, 'rgba(177,74,255,0.3)');
  visualWrap.style.width = '100%';
  visualWrap.style.marginBottom = '14px';
  visualPanel.appendChild(sectionTitle('🎨', 'VISUAL'));

  function makeToggle(label: string, hint: string, key: 'shakeEnabled' | 'flashEnabled' | 'reducedMotion' | 'colorblindMode' | 'showFps'): HTMLElement {
    const wrap = el('div', `
      display:flex;justify-content:space-between;align-items:center;
      padding:8px 12px;background:rgba(0,0,0,0.3);border-radius:8px;
      border:1px solid rgba(255,255,255,0.06);
    `);
    const labelBox = el('div', '');
    labelBox.innerHTML = `
      <div style="font-family:Galmuri11,monospace;font-size:13px;color:var(--text)">${label}</div>
      <div style="font-size:10px;color:var(--text-dim);margin-top:2px;letter-spacing:1px">${hint}</div>
    `;
    wrap.appendChild(labelBox);
    const b = document.createElement('button');
    const update = () => {
      const on = !!meta[key];
      b.innerHTML = on
        ? `<span style="display:inline-block;width:22px;height:22px;border-radius:11px;background:linear-gradient(135deg,#00ff88,#05d9e8);box-shadow:0 0 10px rgba(0,255,136,0.6)"></span>  <span style="color:#00ff88;font-weight:bold">ON</span>`
        : `<span style="display:inline-block;width:22px;height:22px;border-radius:11px;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.2)"></span>  <span style="color:var(--text-dim)">OFF</span>`;
    };
    b.style.cssText = `
      background:transparent;border:none;
      display:flex;align-items:center;gap:8px;
      font-family:Galmuri11,monospace;font-size:12px;letter-spacing:2px;
      cursor:pointer;padding:4px 8px;border-radius:6px;
      transition:background .15s;
    `;
    b.onmouseenter = () => { b.style.background = 'rgba(255,255,255,0.05)'; };
    b.onmouseleave = () => { b.style.background = 'transparent'; };
    b.onclick = () => {
      meta[key] = !meta[key];
      update();
      saveMeta(meta);
      // ⭐ 색약 모드는 즉시 world.ts 전역 + body 클래스 반영 (다음 데미지 숫자부터 적용)
      if (key === 'colorblindMode') {
        try { setWorldColorblind(!!meta.colorblindMode); } catch {}
        document.body.classList.toggle('samsara-colorblind', !!meta.colorblindMode);
      }
      // ⭐ FPS 표시 — body 클래스 토글로 HUD #hud-fps-frame 의 가시성 즉시 반영
      if (key === 'showFps') {
        document.body.classList.toggle('samsara-show-fps', !!meta.showFps);
      }
    };
    update();
    wrap.appendChild(b);
    return wrap;
  }
  visualPanel.appendChild(makeToggle('화면 흔들림', '피격/타격 시 카메라 셰이크', 'shakeEnabled'));
  visualPanel.appendChild(makeToggle('색 플래시', '콤보 임계 시 화면 플래시', 'flashEnabled'));
  visualPanel.appendChild(makeToggle('모션 최소화', '접근성 — 애니메이션 완전 비활성', 'reducedMotion'));
  visualPanel.appendChild(makeToggle('색약 모드', '데미지 숫자에 모양 추가 (●○◆◇★) + 식별성 팔레트', 'colorblindMode'));
  visualPanel.appendChild(makeToggle('FPS 표시', '디버그 — 우하단에 실시간 프레임 (기본 OFF)', 'showFps'));
  main.appendChild(visualWrap);

  // ── 언어 섹션 ──
  const langPanel = el('div', 'display:flex;flex-direction:column;gap:10px');
  const langWrap = cosmicPanel(langPanel, 'rgba(255,215,0,0.3)');
  langWrap.style.width = '100%';
  langWrap.style.marginBottom = '14px';
  langPanel.appendChild(sectionTitle('🌐', 'LANGUAGE'));
  const langRow = el('div', 'display:grid;grid-template-columns:1fr 1fr;gap:8px');
  const makeLangBtn = (code: 'ko' | 'en', label: string, sub: string) => {
    const b = document.createElement('button');
    const isActive = meta.language === code;
    b.style.cssText = `
      background:${isActive ? 'linear-gradient(135deg,#ffd700aa,#ff2a6daa)' : 'rgba(0,0,0,0.4)'};
      color:${isActive ? '#fff' : 'var(--text)'};
      border:1.5px solid ${isActive ? '#ffd700' : 'rgba(255,255,255,0.15)'};
      padding:14px;border-radius:8px;
      font-family:Galmuri11,monospace;cursor:pointer;
      transition:transform .15s, border-color .15s;
      ${isActive ? 'box-shadow:0 0 18px rgba(255,215,0,0.4);' : ''}
    `;
    b.innerHTML = `
      <div style="font-size:16px;font-weight:bold;letter-spacing:2px">${label}</div>
      <div style="font-size:10px;color:${isActive ? '#fff' : 'var(--text-dim)'};margin-top:4px;opacity:0.8;letter-spacing:1px">${sub}</div>
    `;
    b.onclick = () => {
      meta.language = code;
      setLang(code);
      saveMeta(meta);
      // 화면 다시 그리기 (활성 표시 갱신)
      go('home'); setTimeout(() => go('settings'), 0);
    };
    return b;
  };
  langRow.appendChild(makeLangBtn('ko', '한국어', 'KOREAN'));
  langRow.appendChild(makeLangBtn('en', 'English', 'ENGLISH'));
  langPanel.appendChild(langRow);
  main.appendChild(langWrap);

  // ── 키보드 가이드 (작게, 정보용) ──
  const keysWrap = el('div', `
    margin-top:8px;
    color:var(--text-dim);font-family:Galmuri11,monospace;font-size:11px;
    text-align:center;letter-spacing:2px;line-height:1.8;
    animation:mn-fade-up .7s ease-out .35s both;
  `);
  keysWrap.innerHTML = `
    <div style="margin-bottom:6px;color:rgba(5,217,232,0.7);letter-spacing:3px">⌨ KEYBOARD</div>
    <span style="color:var(--text)">WASD / 방향키</span> 이동 ·
    <span style="color:var(--text)">ESC</span> 일시정지 ·
    <span style="color:var(--text)">SPACE</span> 대시
  `;
  main.appendChild(keysWrap);

  root.appendChild(main);
  root.appendChild(cosmicBackButton());
  host.appendChild(root);
  const detachCue = attachScrollCue(root);
  return () => { detachCue(); try { host.removeChild(root); } catch {} };
}

// ─────────────────────────── CHARACTER SELECT ───────────────────────────

const CHARACTERS = [
  { id: 'tiger',    name: '호랑이',   weapon: '발톱 휘두르기',   desc: '근접 부채꼴',          unlock: '기본', emoji: '🐯' },
  { id: 'magpie',   name: '까치',     weapon: '쪼기 (호밍)',     desc: '원거리 호밍 단발',     unlock: '사이클 100', emoji: '🐦' },
  { id: 'dokkaebi', name: '도깨비',   weapon: '방망이 (영역)',   desc: '근접 강타',            unlock: 'RP 30', emoji: '👹' },
  { id: 'gumiho',   name: '구미호',   weapon: '여우불 (3발)',    desc: '호밍 + 화상',          unlock: 'RP 60', emoji: '🦊' },
  { id: 'dragon',   name: '용',       weapon: '용숨 (cone)',      desc: '5발 부채꼴 관통',     unlock: 'RP 100', emoji: '🐉' },
];

export function mountCharacterSelect(host: HTMLElement, engine: Engine): () => void {
  host.innerHTML = '';
  injectCosmicKeyframes();
  const meta = engine.getState().meta as any;

  const root = el('div', `
    position:fixed;inset:0;overflow-y:auto;overflow-x:hidden;
    background:#02010a;color:var(--text);font-family:Pretendard,system-ui,sans-serif;
    -webkit-overflow-scrolling:touch;
  `);
  for (const layer of cosmicBackdrop(80, 'rgba(5,217,232,0.4)')) root.appendChild(layer);

  const main = el('div', `
    position:relative;z-index:5;
    display:flex;flex-direction:column;align-items:center;
    padding:clamp(60px,8vh,90px) clamp(16px,3vw,32px) clamp(32px,5vh,48px);
    width:100%;max-width:min(1000px,96vw);margin:auto;box-sizing:border-box;
  `);
  main.appendChild(cosmicHeader('캐릭터 선택', '시작 무기는 카드 0장이어도 항상 발동된다', '#05d9e8'));

  const grid = el('div', `
    width:100%;
    display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));
    gap:clamp(10px,1.5vw,14px);
    animation:mn-fade-up .7s ease-out .25s both;
  `);
  for (const c of CHARACTERS) {
    const isUnlocked = c.id === 'tiger'
      || (c.id === 'dokkaebi' && meta.rp >= 30)
      || (c.id === 'gumiho' && meta.rp >= 60)
      || (c.id === 'dragon' && meta.rp >= 100)
      || (c.id === 'magpie' && meta.totalCycles >= 100);
    const isSelected = (meta.character ?? 'tiger') === c.id;
    const card = el('div', `
      position:relative;
      background:linear-gradient(160deg, ${isSelected ? 'rgba(40,28,8,0.85), rgba(20,12,4,0.92)' : 'rgba(20,12,46,0.85), rgba(10,10,26,0.92)'});
      border:2px solid ${isSelected ? '#ffd700' : isUnlocked ? 'rgba(5,217,232,0.4)' : 'rgba(255,255,255,0.08)'};
      border-radius:12px;padding:clamp(14px,2vw,18px);
      cursor:${isUnlocked ? 'pointer' : 'not-allowed'};
      opacity:${isUnlocked ? '1' : '0.45'};
      transition:transform .2s, box-shadow .2s, border-color .2s;
      box-shadow:0 4px 16px rgba(0,0,0,0.4)${isSelected ? ', 0 0 28px rgba(255,215,0,0.4), inset 0 0 0 1px rgba(255,215,0,0.15)' : ''};
      overflow:hidden;
    `);

    // 선택 인장
    if (isSelected) {
      card.appendChild(el('div', `
        position:absolute;top:8px;right:8px;
        background:linear-gradient(135deg,#ffd700,#ff2a6d);
        color:#000;font-family:Galmuri11,monospace;font-size:9px;font-weight:bold;
        padding:3px 8px;border-radius:8px;letter-spacing:2px;
        box-shadow:0 0 12px rgba(255,215,0,0.6);z-index:1;
      `, '★ 선택'));
    }

    // 캐릭터 이미지 영역 (SVG가 있으면 사용, 없으면 emoji)
    const imgWrap = el('div', `
      width:clamp(80px,10vw,120px);height:clamp(80px,10vw,120px);
      margin:0 auto 10px;
      background:url(/character/${c.id}.svg) no-repeat center/contain;
      image-rendering:pixelated;
      filter:drop-shadow(0 4px 16px ${isSelected ? 'rgba(255,215,0,0.6)' : 'rgba(5,217,232,0.4)'});
      ${isUnlocked ? '' : 'filter:grayscale(0.8) brightness(0.5);'}
    `);
    card.appendChild(imgWrap);
    // SVG 로드 실패 시 emoji fallback
    const fallback = el('div', `
      position:absolute;top:clamp(14px,2vw,18px);left:50%;transform:translateX(-50%);
      font-size:clamp(56px,7vw,80px);pointer-events:none;
      ${isUnlocked ? '' : 'opacity:0.5'}
    `, c.emoji);
    fallback.style.zIndex = '0';
    fallback.style.display = 'none';
    // 간단한 fallback 토글 — 이미지 onload는 background이라 직접 못 거는 Image() 사용
    const probe = new Image();
    probe.onerror = () => { imgWrap.style.background = ''; fallback.style.display = 'block'; };
    probe.src = `/character/${c.id}.svg`;
    card.appendChild(fallback);

    const info = el('div', 'position:relative;z-index:1;text-align:center');
    info.innerHTML = `
      <div style="font-family:Galmuri11,monospace;font-size:18px;color:${isSelected ? '#ffd700' : 'var(--text)'};font-weight:bold;letter-spacing:2px;text-shadow:0 0 10px ${isSelected ? '#ffd700' : 'transparent'}">${c.name}</div>
      <div style="font-size:12px;color:#05d9e8;margin:6px 0;letter-spacing:1px;text-shadow:0 0 6px rgba(5,217,232,0.4)">${c.weapon}</div>
      <div style="font-size:10px;color:var(--text-dim);line-height:1.5">${c.desc}</div>
      <div style="margin-top:10px;padding:5px 10px;border-radius:6px;font-family:Galmuri11,monospace;font-size:10px;letter-spacing:1.5px;
        ${isUnlocked
          ? 'background:rgba(0,255,136,0.12);color:#00ff88;border:1px solid rgba(0,255,136,0.3)'
          : 'background:rgba(255,51,102,0.1);color:#ff6688;border:1px solid rgba(255,51,102,0.3)'
        }">${isUnlocked ? '✓ 잠금 해제' : `🔒 ${c.unlock}`}</div>
    `;
    card.appendChild(info);

    if (isUnlocked) {
      card.onclick = () => {
        const m = engine.getState().meta as any;
        m.character = c.id;
        saveMeta(engine.getState().meta);
        go('home');
      };
      card.onmouseenter = () => { card.style.transform = 'translateY(-4px)'; card.style.boxShadow = `0 8px 28px rgba(0,0,0,0.5), 0 0 32px ${isSelected ? 'rgba(255,215,0,0.6)' : 'rgba(5,217,232,0.4)'}, inset 0 0 0 1px rgba(255,255,255,0.08)`; };
      card.onmouseleave = () => { card.style.transform = ''; card.style.boxShadow = `0 4px 16px rgba(0,0,0,0.4)${isSelected ? ', 0 0 28px rgba(255,215,0,0.4), inset 0 0 0 1px rgba(255,215,0,0.15)' : ''}`; };
    }
    grid.appendChild(card);
  }
  main.appendChild(grid);

  root.appendChild(main);
  root.appendChild(cosmicBackButton());
  host.appendChild(root);
  return () => { try { host.removeChild(root); } catch {} };
}

// ─────────────────────────── ACHIEVEMENTS ───────────────────────────

export function mountAchievements(host: HTMLElement, _engine: Engine): () => void {
  host.innerHTML = '';
  injectCosmicKeyframes();
  const tr = loadTracker();
  const all = allAchievements();
  const unlockedCount = tr.unlocked.length;
  const totalCount = all.length;
  const pct = (unlockedCount / Math.max(1, totalCount)) * 100;

  const root = el('div', `
    position:fixed;inset:0;overflow-y:auto;overflow-x:hidden;
    background:#02010a;color:var(--text);font-family:Pretendard,system-ui,sans-serif;
    -webkit-overflow-scrolling:touch;
  `);
  for (const layer of cosmicBackdrop(100, 'rgba(255,215,0,0.4)')) root.appendChild(layer);

  const main = el('div', `
    position:relative;z-index:5;
    display:flex;flex-direction:column;align-items:center;
    padding:clamp(60px,8vh,90px) clamp(16px,3vw,32px) clamp(32px,5vh,48px);
    width:100%;max-width:min(960px,96vw);margin:auto;box-sizing:border-box;
  `);
  main.appendChild(cosmicHeader('업적', `ACHIEVEMENTS · ${unlockedCount} / ${totalCount}`, '#ffd700'));

  // 진행 막대 (전체 달성률)
  const progressWrap = el('div', `
    width:100%;max-width:480px;margin-bottom:clamp(16px,2.5vh,24px);
    animation:mn-fade-up .7s ease-out .15s both;
  `);
  progressWrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;font-family:Galmuri11,monospace;font-size:11px;color:var(--text-dim);letter-spacing:2px;margin-bottom:6px">
      <span>전체 진행률</span>
      <span style="color:#ffd700;font-weight:bold">${pct.toFixed(1)}%</span>
    </div>
    <div style="height:10px;background:rgba(0,0,0,0.5);border-radius:5px;overflow:hidden;border:1px solid rgba(255,215,0,0.3);box-shadow:inset 0 0 6px rgba(0,0,0,0.4)">
      <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#ff2a6d,#ffd700,#05d9e8);box-shadow:0 0 12px #ffd700;border-radius:4px;transition:width .6s ease-out"></div>
    </div>
  `;
  main.appendChild(progressWrap);

  // 업적 그리드 (4열 → 모바일 1열)
  const grid = el('div', `
    width:100%;
    display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
    gap:clamp(8px,1.2vw,12px);
    animation:mn-fade-up .7s ease-out .3s both;
  `);
  // 잠금해제된 것 먼저
  const sorted = [...all].sort((a, b) => {
    const aGot = tr.unlocked.includes(a.id) ? 1 : 0;
    const bGot = tr.unlocked.includes(b.id) ? 1 : 0;
    return bGot - aGot;
  });
  for (const a of sorted) {
    const got = tr.unlocked.includes(a.id);
    const card = el('div', `
      position:relative;
      background:linear-gradient(160deg, ${got ? 'rgba(40,28,8,0.85), rgba(20,12,4,0.92)' : 'rgba(20,12,46,0.65), rgba(10,10,26,0.78)'});
      border:1.5px solid ${got ? '#ffd700' : 'rgba(255,255,255,0.08)'};
      border-radius:10px;padding:12px;
      ${got ? 'box-shadow:0 0 16px rgba(255,215,0,0.25), inset 0 0 0 1px rgba(255,215,0,0.15);' : 'opacity:0.55;'}
      transition:transform .15s, box-shadow .15s;
      overflow:hidden;
    `);
    if (got) {
      card.onmouseenter = () => { card.style.transform = 'translateY(-2px)'; card.style.boxShadow = '0 4px 24px rgba(255,215,0,0.45), inset 0 0 0 1px rgba(255,215,0,0.25)'; };
      card.onmouseleave = () => { card.style.transform = ''; card.style.boxShadow = '0 0 16px rgba(255,215,0,0.25), inset 0 0 0 1px rgba(255,215,0,0.15)'; };
    }
    card.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:10px">
        <div style="font-size:24px;width:32px;text-align:center;flex-shrink:0;${got ? 'filter:drop-shadow(0 0 8px #ffd700)' : 'opacity:0.5'}">${got ? '🏆' : '🔒'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-family:Galmuri11,monospace;font-size:13px;color:${got ? '#ffd700' : 'var(--text-dim)'};font-weight:bold;letter-spacing:1px;line-height:1.3">${a.name_ko}</div>
          <div style="font-size:10px;color:var(--text-dim);margin-top:4px;line-height:1.5;letter-spacing:0.5px">${a.desc_ko}</div>
        </div>
      </div>
    `;
    grid.appendChild(card);
  }
  main.appendChild(grid);

  root.appendChild(main);
  root.appendChild(cosmicBackButton());
  host.appendChild(root);
  return () => { try { host.removeChild(root); } catch {} };
}

// ─────────────────────────── CODEX (시너지/카드 도감) ───────────────────────────
//
// 60카드 + 18시너지 잠금 해제 상태 표시. Vampire Survivors 의 weapon 도감 패턴.
// 잠금 = 실루엣, 해제 = 컬러. 수집 욕구 자극 → "한 판 더" 동기.

export function mountCodex(host: HTMLElement, engine: Engine): () => void {
  host.innerHTML = '';
  injectCosmicKeyframes();
  const tr = loadTracker();
  const codexMeta = engine.getState().meta;
  const synergies = allSynergies();
  const cards = (window as any).__samsara_allCards as Card[] | undefined; // 빈약 fallback — 동적 import 우회

  const root = el('div', `
    position:fixed;inset:0;overflow-y:auto;overflow-x:hidden;
    background:#02010a;color:var(--text);font-family:Pretendard,system-ui,sans-serif;
    -webkit-overflow-scrolling:touch;
  `);
  for (const layer of cosmicBackdrop(100, 'rgba(177,74,255,0.4)')) root.appendChild(layer);

  const main = el('div', `
    position:relative;z-index:5;
    display:flex;flex-direction:column;align-items:center;
    padding:clamp(60px,8vh,90px) clamp(16px,3vw,32px) clamp(32px,5vh,48px);
    width:100%;max-width:min(960px,96vw);margin:auto;box-sizing:border-box;
  `);
  {
    const seenRI = Math.min(allRunIdentities().length, (codexMeta.seenIdentityIds ?? []).length);
    const seenSyn = Math.min(synergies.length, (codexMeta.seenSynergyIds ?? []).length);
    main.appendChild(cosmicHeader('도감', `CODEX · 운명 ${seenRI}/${allRunIdentities().length}  ·  시너지 ${seenSyn}/${synergies.length}`, '#b14aff'));
  }

  // ⭐ 평생 발견 진행 패널 — 게임오버/메인/리더보드와 동일 룩 (4곳 공용 헬퍼).
  main.appendChild(discoveryCodexPanel(codexMeta, {
    containerAnim: 'max-width:min(560px,94vw);margin-bottom:18px;animation:mn-fade-up .7s ease-out .12s both;',
    showExtended: true, modifierTotal: allModifierDefs().length, biomeTotal: BIOME_KINDS.length,
  }));

  // 탭 (시너지 / 카드 / 모디파이어 / 생태계) — 도감 진행바가 가리키는 4축을 실제로 열람 가능하게.
  let tab: 'synergy' | 'card' | 'modifier' | 'biome' = 'synergy';
  const tabBar = el('div', 'display:flex;flex-wrap:wrap;justify-content:center;gap:8px;margin-bottom:18px;animation:mn-fade-up .7s ease-out .15s both');
  const makeTab = (id: typeof tab, label: string) => {
    const b = document.createElement('button');
    b.style.cssText = `
      background:rgba(20,12,46,0.7);color:var(--text);
      border:1.5px solid rgba(177,74,255,0.4);
      padding:10px 22px;border-radius:8px;
      font-family:Galmuri11,monospace;font-size:13px;letter-spacing:3px;cursor:pointer;
      transition:background .15s, border-color .15s, color .15s;
    `;
    const setActive = (active: boolean) => {
      b.style.background = active ? 'linear-gradient(135deg,#b14aff,#ff2a6d)' : 'rgba(20,12,46,0.7)';
      b.style.color = active ? '#fff' : 'var(--text)';
      b.style.borderColor = active ? '#b14aff' : 'rgba(177,74,255,0.4)';
      b.style.boxShadow = active ? '0 0 16px rgba(177,74,255,0.5)' : 'none';
    };
    b.textContent = label;
    b.dataset.id = id;
    b.onclick = () => {
      tab = id;
      tabBar.querySelectorAll('button').forEach(x => {
        const xb = x as HTMLButtonElement;
        const on = xb.dataset.id === id;
        xb.style.background = on ? 'linear-gradient(135deg,#b14aff,#ff2a6d)' : 'rgba(20,12,46,0.7)';
        xb.style.color = on ? '#fff' : 'var(--text)';
        xb.style.borderColor = on ? '#b14aff' : 'rgba(177,74,255,0.4)';
        xb.style.boxShadow = on ? '0 0 16px rgba(177,74,255,0.5)' : 'none';
      });
      render();
    };
    setActive(id === tab);
    return b;
  };
  const modifierDefs = allModifierDefs();
  tabBar.appendChild(makeTab('synergy', `시너지 ${synergies.length}`));
  tabBar.appendChild(makeTab('card', `카드 ${(cards?.length ?? 60)}`));
  tabBar.appendChild(makeTab('modifier', `모디 ${modifierDefs.length}`));
  tabBar.appendChild(makeTab('biome', `생태계 ${BIOME_KINDS.length}`));
  main.appendChild(tabBar);

  // 컨텐츠 컨테이너
  const grid = el('div', `
    width:100%;display:grid;
    grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
    gap:clamp(8px,1.2vw,12px);
    animation:mn-fade-up .7s ease-out .25s both;
  `);
  main.appendChild(grid);

  const TAG_COLOR_MAP: Record<string, string> = { fire:'#ff2a6d',ice:'#05d9e8',gold:'#ffd700',time:'#d300c5',chaos:'#ff6f00',echo:'#b3ff00' };

  // 모디파이어 type → 한글 라벨 + 색 (게임 내 톤과 일치: 축복=시안, 시련=핑크, 비밀=보라)
  const MOD_TYPE: Record<string, { ko: string; col: string }> = {
    blessing:  { ko: '축복', col: '#05d9e8' },
    challenge: { ko: '시련', col: '#ff2a6d' },
    secret:    { ko: '비밀', col: '#b14aff' },
  };
  // 4 생태계 — main.ts BIOME_CUE 와 색/글리프 일치 + 도감용 플레이 특성 설명.
  const BIOME_INFO: Record<string, { glyph: string; ko: string; col: string; desc: string }> = {
    mountain:  { glyph: '🏔', ko: '산맥 지대',   col: '#7fb0ff', desc: '솔리드 벽·바위·운석이 밀집한 엄폐 지형. 장애물 뒤로 적을 유인해 카이팅하기 좋다.' },
    plains:    { glyph: '🌾', ko: '평원',        col: '#b3ff00', desc: '잔해·별먼지·등불이 풍부한 보상형 안전 지대. 자원 수급의 거점.' },
    cursed:    { glyph: '🌑', ko: '저주받은 땅', col: '#ff2a6d', desc: '저주 토템·블랙홀·압전판의 고위험 고보상 지대. 엘리트 소환에 주의.' },
    sanctuary: { glyph: '✨', ko: '성역',        col: '#ffd700', desc: '신단과 거울 파편이 모인 정화된 신성 공간. 기도로 영구 강화가 가능.' },
  };

  function render() {
    grid.innerHTML = '';
    if (tab === 'synergy') {
      // 18 시너지 = 6 태그 × 3 tier (3/5/7)
      // 발동된 적 있으면 컬러, 없으면 실루엣
      // 태그별로 묶음 (태그 그룹 헤더)
      const TAG_ORDER: ('fire'|'ice'|'gold'|'time'|'chaos'|'echo')[] = ['fire','ice','gold','time','chaos','echo'];
      for (const tag of TAG_ORDER) {
        const ofTag = synergies.filter(s => s.tag === tag).sort((a, b) => a.tier - b.tier);
        if (ofTag.length === 0) continue;
        for (const s of ofTag) {
          const got = tr.synergyTriggers.includes(s.id);
          const tagC = TAG_COLOR_MAP[s.tag] ?? '#fff';
          const card = el('div', `
            position:relative;
            background:linear-gradient(160deg, ${got ? `rgba(40,28,8,0.85), rgba(20,12,4,0.92)` : `rgba(20,12,46,0.6), rgba(10,10,26,0.78)`});
            border:1.5px solid ${got ? tagC : 'rgba(255,255,255,0.08)'};
            border-radius:10px;padding:12px;
            ${got ? `box-shadow:0 0 16px ${tagC}55, inset 0 0 0 1px ${tagC}22;` : 'opacity:0.55;'}
            transition:transform .15s, box-shadow .15s;
          `);
          if (got) {
            card.onmouseenter = () => { card.style.transform = 'translateY(-2px)'; card.style.boxShadow = `0 4px 24px ${tagC}88, inset 0 0 0 1px ${tagC}44`; };
            card.onmouseleave = () => { card.style.transform = ''; card.style.boxShadow = `0 0 16px ${tagC}55, inset 0 0 0 1px ${tagC}22`; };
          }
          card.innerHTML = `
            <div style="display:flex;align-items:flex-start;gap:10px">
              <div style="font-size:24px;width:32px;text-align:center;flex-shrink:0;${got ? `filter:drop-shadow(0 0 8px ${tagC})` : 'opacity:0.5'}">${(TAG_EMOJI[s.tag] ?? '✨')}</div>
              <div style="flex:1;min-width:0">
                <div style="font-family:Galmuri11,monospace;font-size:13px;color:${got ? tagC : 'var(--text-dim)'};font-weight:bold;letter-spacing:1px;line-height:1.3">${(s as any).name_ko ?? s.id}</div>
                <div style="font-size:9px;color:var(--text-dim);margin-top:2px;letter-spacing:2px">TIER ${s.tier} · ${s.tier === 7 ? '◇◇◆ 궁극' : s.tier === 5 ? '◇◆ 진화' : '◆ 발동'}</div>
                <div style="font-size:10px;color:var(--text-dim);margin-top:4px;line-height:1.5;letter-spacing:0.5px">${got ? ((s as any).desc_ko ?? '효과 발동') : '— 잠금 — 같은 태그 카드 ' + s.tier + '장 보유 시 발동'}</div>
              </div>
            </div>
          `;
          grid.appendChild(card);
        }
      }
    } else if (tab === 'card') {
      // 카드 60장 — cards.ts 는 static import 됨 (allCards)
      {
        const all = allCards();
        grid.innerHTML = '';
        // 잠금해제 우선 정렬 (uniqueCardsPicked = 한 번이라도 픽한 카드)
        const unlocked = new Set(tr.uniqueCardsPicked ?? []);
        const sorted = [...all].sort((a, b) => {
          const ag = unlocked.has(a.id) ? 1 : 0;
          const bg = unlocked.has(b.id) ? 1 : 0;
          if (bg !== ag) return bg - ag;
          // 같은 그룹 내에서는 태그 → 등급 순
          return (a.tags[0] ?? '').localeCompare(b.tags[0] ?? '');
        });
        for (const c of sorted) {
          const got = unlocked.has(c.id);
          const tagC = TAG_COLOR_MAP[c.tags[0]] ?? '#fff';
          const allTags = c.tags.map(tg => TAG_EMOJI[tg] ?? '✨').join('');
          const card = el('div', `
            position:relative;
            background:linear-gradient(160deg, ${got ? 'rgba(20,12,46,0.85), rgba(10,10,26,0.92)' : 'rgba(20,12,46,0.4), rgba(10,10,26,0.5)'});
            border:1.5px solid ${got ? tagC + '88' : 'rgba(255,255,255,0.05)'};
            border-radius:10px;padding:12px;
            ${got ? `box-shadow:0 0 12px ${tagC}33;` : 'opacity:0.5;'}
            transition:transform .15s, box-shadow .15s;
          `);
          card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span style="font-size:18px;${got ? `filter:drop-shadow(0 0 6px ${tagC})` : 'opacity:0.5'}">${got ? allTags : '🔒'}</span>
              <span style="font-size:8px;letter-spacing:2px;color:${got ? RARITY_COLOR[c.rarity] : 'var(--text-dim)'};text-transform:uppercase">${c.rarity}</span>
            </div>
            <div style="font-family:Galmuri11,monospace;font-size:12px;color:${got ? tagC : 'var(--text-dim)'};font-weight:bold;letter-spacing:1px;line-height:1.3;${got ? `text-shadow:0 0 6px ${tagC}aa` : ''}">${got ? ((c as any).name_ko ?? c.id) : '???'}</div>
            <div style="font-size:9px;color:var(--text-dim);margin-top:3px;letter-spacing:1px">${c.id}</div>
          `;
          grid.appendChild(card);
        }
      }
    } else if (tab === 'modifier') {
      // 모디파이어 30종 — 평생 만나본 적 있으면 컬러, 없으면 실루엣. 비밀형은 미발견 시 이름도 가린다.
      const seen = new Set(codexMeta.seenModifierIds ?? []);
      const ORDER: ('blessing' | 'challenge' | 'secret')[] = ['blessing', 'challenge', 'secret'];
      const ordered = [...modifierDefs].sort((a, b) => {
        const ai = ORDER.indexOf(a.type as any), bi = ORDER.indexOf(b.type as any);
        if (ai !== bi) return ai - bi;
        const ag = seen.has(a.id) ? 0 : 1, bg = seen.has(b.id) ? 0 : 1;
        return ag - bg;
      });
      for (const m of ordered) {
        const got = seen.has(m.id);
        const ty = MOD_TYPE[m.type] ?? { ko: m.type, col: '#fff' };
        const isSecret = m.type === 'secret';
        const card = el('div', `
          position:relative;
          background:linear-gradient(160deg, ${got ? `${ty.col}1a, rgba(10,10,26,0.92)` : 'rgba(20,12,46,0.5), rgba(10,10,26,0.65)'});
          border:1.5px solid ${got ? ty.col + '88' : 'rgba(255,255,255,0.06)'};
          border-radius:10px;padding:12px;
          ${got ? `box-shadow:0 0 14px ${ty.col}44;` : 'opacity:0.5;'}
          transition:transform .15s, box-shadow .15s;
        `);
        if (got) {
          card.onmouseenter = () => { card.style.transform = 'translateY(-2px)'; card.style.boxShadow = `0 4px 22px ${ty.col}77`; };
          card.onmouseleave = () => { card.style.transform = ''; card.style.boxShadow = `0 0 14px ${ty.col}44`; };
        }
        const effText = got
          ? (m.effects ?? []).map(e => describeEffect(e)).join(' ')
          : (isSecret ? '— 비밀 모디파이어 — 특정 조건을 만족하면 모습을 드러낸다.' : '— 잠금 — 웨이브에서 이 모디파이어를 만나면 도감에 새겨진다.');
        const title = got ? (m.name_ko ?? m.id) : (isSecret ? '??? 비밀' : '???');
        card.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:18px;${got ? `filter:drop-shadow(0 0 6px ${ty.col})` : 'opacity:0.5'}">${got ? (isSecret ? '🔮' : m.type === 'blessing' ? '🌟' : '⚔️') : '🔒'}</span>
            <span style="font-size:8px;letter-spacing:2px;color:${got ? ty.col : 'var(--text-dim)'};text-transform:uppercase">${ty.ko}</span>
          </div>
          <div style="font-family:Galmuri11,monospace;font-size:13px;color:${got ? ty.col : 'var(--text-dim)'};font-weight:bold;letter-spacing:1px;line-height:1.3;${got ? `text-shadow:0 0 6px ${ty.col}aa` : ''}">${title}</div>
          <div style="font-size:10px;color:var(--text-dim);margin-top:5px;line-height:1.55;letter-spacing:0.3px">${effText}</div>
        `;
        grid.appendChild(card);
      }
    } else {
      // 생태계 4종 — 평생 밟아본 적 있으면 컬러, 없으면 실루엣.
      const seen = new Set(codexMeta.seenBiomeIds ?? []);
      for (const b of BIOME_KINDS) {
        const got = seen.has(b);
        const info = BIOME_INFO[b] ?? { glyph: '⬡', ko: b, col: '#05d9e8', desc: '' };
        const card = el('div', `
          position:relative;
          background:linear-gradient(160deg, ${got ? `${info.col}1f, rgba(10,10,26,0.92)` : 'rgba(20,12,46,0.5), rgba(10,10,26,0.65)'});
          border:1.5px solid ${got ? info.col + '99' : 'rgba(255,255,255,0.06)'};
          border-radius:10px;padding:14px;
          ${got ? `box-shadow:0 0 16px ${info.col}44;` : 'opacity:0.5;'}
          transition:transform .15s, box-shadow .15s;
        `);
        if (got) {
          card.onmouseenter = () => { card.style.transform = 'translateY(-2px)'; card.style.boxShadow = `0 4px 24px ${info.col}88`; };
          card.onmouseleave = () => { card.style.transform = ''; card.style.boxShadow = `0 0 16px ${info.col}44`; };
        }
        card.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px">
            <div style="font-size:30px;width:40px;text-align:center;flex-shrink:0;${got ? `filter:drop-shadow(0 0 10px ${info.col})` : 'opacity:0.45'}">${got ? info.glyph : '🔒'}</div>
            <div style="flex:1;min-width:0">
              <div style="font-family:Galmuri11,monospace;font-size:14px;color:${got ? info.col : 'var(--text-dim)'};font-weight:bold;letter-spacing:1.5px;${got ? `text-shadow:0 0 8px ${info.col}aa` : ''}">${got ? info.ko : '??? 미답 지대'}</div>
              <div style="font-size:8px;color:var(--text-dim);margin-top:2px;letter-spacing:2px">절차적 생성 · FBM 노이즈</div>
            </div>
          </div>
          <div style="font-size:10px;color:var(--text-dim);margin-top:8px;line-height:1.6;letter-spacing:0.3px">${got ? info.desc : '— 미답 — 윤회를 거듭하다 이 생태계에 발을 들이면 도감에 새겨진다.'}</div>
        `;
        grid.appendChild(card);
      }
    }
  }

  render();
  root.appendChild(main);
  root.appendChild(cosmicBackButton());
  host.appendChild(root);
  const detachCue = attachScrollCue(root);
  return () => { detachCue(); try { host.removeChild(root); } catch {} };
}

// ─────────────────────────── HIGHLIGHT (게임 오버 후) ───────────────────────────

export function mountHighlight(host: HTMLElement, engine: Engine): () => void {
  host.innerHTML = '';
  const state = engine.getState();
  const events = state.stats.highlightEvents;
  const meta = state.meta;
  const elapsed = state.stats.startedAt > 0 ? (performance.now() - state.stats.startedAt) / 1000 : state.elapsed;
  const dps = elapsed > 0 ? Math.round(state.totalScore / elapsed) : 0;
  // 실제 메타에 누적된 RP(점수분 + 첫5런 보너스)를 그대로 표시 — handleGameOver 가 set.
  // (점수분만 표시하면 첫 5런 동안 보너스 +20~100 을 받고도 "+0 RP" 로 보이는 버그)
  const rpGained = Math.max(0, state.stats.rpEarnedThisRun ?? Math.floor(state.totalScore / 10000));
  const isPB = state.totalScore > meta.bestScore;

  // 키프레임 한 번만
  if (!document.getElementById('samsara-highlight-keyframes')) {
    const kf = document.createElement('style');
    kf.id = 'samsara-highlight-keyframes';
    kf.textContent = `
      @keyframes hl-fade-up { 0%{opacity:0;transform:translateY(20px)} 100%{opacity:1;transform:translateY(0)} }
      @keyframes hl-die-bloom { 0%{opacity:0;transform:scale(2.4) rotate(-8deg);filter:blur(20px)} 60%{opacity:1;transform:scale(1) rotate(0deg);filter:blur(0)} 100%{opacity:1;transform:scale(1)} }
      @keyframes hl-die-pulse { 0%,100%{filter:drop-shadow(0 0 32px rgba(255,42,109,0.7)) drop-shadow(0 0 64px rgba(255,42,109,0.4))} 50%{filter:drop-shadow(0 0 60px rgba(255,42,109,0.95)) drop-shadow(0 0 90px rgba(255,42,109,0.55))} }
      @keyframes hl-twinkle { 0%,100%{opacity:.25} 50%{opacity:.95} }
      @keyframes hl-pb-shimmer { 0%{background-position:0% 50%} 100%{background-position:200% 50%} }
      @keyframes hl-tag-bar { 0%{width:0%} 100%{width:var(--w)} }
      @keyframes hl-confetti { 0%{transform:translate(0,0) rotate(0)} 100%{transform:translate(var(--cx),120vh) rotate(720deg)} }
      @keyframes hl-rp-tick { 0%{transform:scale(.5);opacity:0} 50%{transform:scale(1.4);opacity:1} 100%{transform:scale(1);opacity:1} }
    `;
    document.head.appendChild(kf);
  }

  // 시네마틱 풀스크린
  const root = el('div', `
    position:fixed;inset:0;overflow-y:auto;overflow-x:hidden;
    background:#02010a;color:var(--text);
    font-family:Pretendard,system-ui,sans-serif;
    -webkit-overflow-scrolling:touch;
  `);

  // L0: 우주 그라데이션 (사망 분위기 — 적색 도미넌트)
  root.appendChild(el('div', `
    position:absolute;inset:-10%;pointer-events:none;
    background:
      radial-gradient(ellipse at 50% 25%, rgba(255,42,109,0.32), transparent 50%),
      radial-gradient(ellipse at 20% 80%, rgba(177,74,255,0.22), transparent 45%),
      radial-gradient(ellipse at 80% 70%, rgba(5,217,232,0.16), transparent 50%),
      radial-gradient(ellipse at center, #1a0612 0%, #02010a 70%);
  `));

  // L1: 별 (스킵: perfMode 제외)
  const stars = el('div', 'position:absolute;inset:0;pointer-events:none');
  let sH = '';
  for (let i = 0; i < 120; i++) {
    const sz = Math.random() < 0.08 ? 2 : 1;
    const dur = 2 + Math.random() * 4;
    const dl = Math.random() * 4;
    const col = Math.random() < 0.2 ? '#ffd7e0' : '#ffffff';
    sH += `<div style="position:absolute;left:${Math.random()*100}%;top:${Math.random()*100}%;width:${sz}px;height:${sz}px;background:${col};border-radius:50%;animation:hl-twinkle ${dur}s ease-in-out ${dl}s infinite alternate;box-shadow:0 0 ${sz*2}px ${col}"></div>`;
  }
  stars.innerHTML = sH;
  root.appendChild(stars);

  // PB일 때만 컨페티 (참신성 + 보상감)
  if (isPB) {
    const conf = el('div', 'position:absolute;inset:0;pointer-events:none;overflow:hidden');
    for (let i = 0; i < 30; i++) {
      const colors = ['#ff2a6d','#ffd700','#05d9e8','#b14aff','#b3ff00'];
      const col = colors[i % colors.length];
      const cx = (Math.random() - 0.5) * 800;
      const dur = 2.4 + Math.random() * 2;
      const dl = Math.random() * 1.2;
      conf.appendChild(el('div', `
        position:absolute;left:${30+Math.random()*40}%;top:-20px;
        width:8px;height:14px;background:${col};opacity:0.85;
        --cx:${cx}px;
        animation:hl-confetti ${dur}s linear ${dl}s forwards;
      `));
    }
    root.appendChild(conf);
  }

  // ── 메인 컨테이너 ──
  const main = el('div', `
    position:relative;z-index:5;
    display:flex;flex-direction:column;align-items:center;
    width:100%;max-width:min(720px, 94vw);
    margin:auto;padding:clamp(24px,5vh,56px) clamp(16px,3vw,32px);
    box-sizing:border-box;
  `);

  // ── GAME OVER 헤더 (한자 미사용 — 한글/영문 + 큰 그래픽) ──
  const deathHeader = el('div', `
    text-align:center;margin-bottom:clamp(16px,3vh,28px);
    animation:hl-fade-up .8s ease-out both;
  `);
  deathHeader.innerHTML = `
    <div style="font-family:Galmuri11,monospace;font-size:clamp(72px,11vw,140px);color:#ff2a6d;line-height:0.9;letter-spacing:clamp(6px,1.5vw,16px);font-weight:bold;animation:hl-die-bloom 1.4s cubic-bezier(.16,1,.3,1) both, hl-die-pulse 3s ease-in-out 1.4s infinite;text-shadow:0 0 32px rgba(255,42,109,0.6),0 6px 0 rgba(0,0,0,0.4)">사 망</div>
    <div style="font-family:Galmuri11,monospace;color:rgba(255,42,109,0.85);font-size:clamp(14px,1.5vw,18px);letter-spacing:clamp(6px,1.2vw,12px);margin-top:14px;font-weight:bold;text-shadow:0 0 12px rgba(255,42,109,0.5)">GAME OVER</div>
    <div style="color:var(--text-dim);font-size:clamp(11px,1vw,13px);letter-spacing:3px;margin-top:6px">— 영혼이 사라졌다, 그러나 끝이 아니다 —</div>
  `;
  main.appendChild(deathHeader);

  // ── 점수 패널 (글래스 + 카운트업) ──
  const scorePanel = el('div', `
    position:relative;width:100%;
    background:linear-gradient(160deg, rgba(20,12,46,0.85), rgba(10,10,26,0.92));
    border:2px solid ${isPB ? '#ffd700' : 'rgba(255,215,0,0.35)'};
    border-radius:14px;
    padding:clamp(20px,3vw,32px);
    box-shadow:0 8px 40px rgba(0,0,0,0.6), 0 0 60px rgba(255,215,0,${isPB ? '0.3' : '0.12'}), inset 0 0 0 1px rgba(255,255,255,0.05);
    text-align:center;margin-bottom:clamp(16px,2.5vh,24px);
    animation:hl-fade-up .8s ease-out .3s both;
    overflow:hidden;
  `);
  // 코너 장식
  const cornerCSS = (pos: string) => `position:absolute;${pos};width:18px;height:18px;border:1.5px solid ${isPB ? '#ffd700' : 'rgba(255,215,0,0.6)'};pointer-events:none`;
  scorePanel.appendChild(el('div', `${cornerCSS('top:8px;left:8px')};border-right:none;border-bottom:none`));
  scorePanel.appendChild(el('div', `${cornerCSS('top:8px;right:8px')};border-left:none;border-bottom:none`));
  scorePanel.appendChild(el('div', `${cornerCSS('bottom:8px;left:8px')};border-right:none;border-top:none`));
  scorePanel.appendChild(el('div', `${cornerCSS('bottom:8px;right:8px')};border-left:none;border-top:none`));

  if (isPB) {
    scorePanel.appendChild(el('div', `
      position:absolute;top:10px;left:50%;transform:translateX(-50%);
      background:linear-gradient(90deg,#ffd700,#ff2a6d,#05d9e8,#ffd700);
      background-size:200% auto;
      color:#000;font-family:Galmuri11,monospace;font-size:11px;
      padding:4px 12px;border-radius:12px;letter-spacing:3px;font-weight:bold;
      animation:hl-pb-shimmer 2s linear infinite;
      box-shadow:0 0 20px rgba(255,215,0,0.6);
      z-index:2;
    `, '★ NEW BEST ★'));
  }

  const scoreLabel = el('div', `
    color:var(--text-dim);font-family:Galmuri11,monospace;font-size:clamp(10px,1vw,12px);
    letter-spacing:4px;margin-bottom:8px;text-transform:uppercase
  `, '최종 점수');
  scorePanel.appendChild(scoreLabel);
  const scoreNum = el('div', `
    font-family:Galmuri11,monospace;
    font-size:clamp(48px,8vw,96px);
    color:var(--gold);font-weight:bold;
    text-shadow:0 0 24px rgba(255,215,0,0.7), 0 0 48px rgba(255,215,0,0.3);
    letter-spacing:2px;line-height:1;
  `, '0');
  scorePanel.appendChild(scoreNum);

  // 카운트업 애니
  const target = state.totalScore;
  const t0 = performance.now();
  const dur = 1100;
  function tickScore() {
    const k = Math.min(1, (performance.now() - t0) / dur);
    const eased = 1 - Math.pow(1 - k, 3);
    scoreNum.textContent = formatNum(Math.floor(target * eased));
    if (k < 1) requestAnimationFrame(tickScore);
    else scoreNum.textContent = formatNum(target);
  }
  setTimeout(() => requestAnimationFrame(tickScore), 600);

  // RP 획득 강조 (윤회 보상)
  const rpRow = el('div', `
    display:flex;align-items:center;justify-content:center;gap:10px;margin-top:12px
  `);
  rpRow.innerHTML = `
    <span style="color:var(--text-dim);font-size:clamp(11px,1.1vw,13px);letter-spacing:2px;font-family:Galmuri11,monospace">+ 윤회 점수</span>
    <span style="color:#b3ff00;font-family:Galmuri11,monospace;font-size:clamp(20px,2.6vw,32px);font-weight:bold;text-shadow:0 0 14px rgba(179,255,0,0.7);animation:hl-rp-tick .6s cubic-bezier(.34,1.56,.64,1) 1.5s both">+${rpGained} RP</span>
  `;
  scorePanel.appendChild(rpRow);

  main.appendChild(scorePanel);

  // ⭐ "모든 런이 영구 진보됐다" 패널 — 짧은 런 좌절 차단 (research B1, Megabonk 패턴)
  // RP 획득 + 카드 빌드 + 시너지 트리거 누적을 명시적으로 보여줌.
  {
    const progressPanel = el('div', `
      width:100%;
      background:linear-gradient(135deg, rgba(0,255,136,0.10), rgba(20,12,46,0.85));
      border:1.5px solid rgba(0,255,136,0.45);
      border-radius:12px;padding:clamp(14px,2vw,20px);
      margin-bottom:clamp(16px,2.5vh,22px);
      animation:hl-fade-up .8s ease-out .45s both;
      box-shadow:0 0 22px rgba(0,255,136,0.18), inset 0 0 0 1px rgba(0,255,136,0.08);
    `);
    progressPanel.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="font-size:22px;filter:drop-shadow(0 0 8px #00ff88)">✦</span>
        <div style="flex:1">
          <div style="font-family:Galmuri11,monospace;color:#00ff88;font-size:clamp(13px,1.4vw,16px);font-weight:bold;letter-spacing:2px;text-shadow:0 0 8px rgba(0,255,136,0.6)">이번 런이 영구로 남는다</div>
          <div style="font-size:10px;color:var(--text-dim);margin-top:2px;letter-spacing:1.5px">짧은 런도 메타에 누적 — 죽음은 끝이 아니라 다음 런의 시작</div>
        </div>
        <div style="text-align:right">
          <div style="font-family:Galmuri11,monospace;color:#b3ff00;font-size:clamp(20px,2.4vw,30px);font-weight:bold;line-height:1;text-shadow:0 0 12px rgba(179,255,0,0.7)">+${rpGained}</div>
          <div style="font-size:9px;color:var(--text-dim);letter-spacing:2px;margin-top:2px">RP 누적</div>
        </div>
      </div>
    `;

    // ⭐ 카드 빌드 그리드 (최대 6장, 실제 카드 시각화) — 동료 개발자 표 60% 직격
    if (state.cards.length > 0) {
      const TAG_COLOR2: Record<string, string> = { fire:'#ff2a6d',ice:'#05d9e8',gold:'#ffd700',time:'#d300c5',chaos:'#ff6f00',echo:'#b3ff00' };
      const RARITY_TINT: Record<string, string> = { common:'rgba(255,255,255,0.3)', rare:'#4a90e2', epic:'#b14aff', legendary:'#ffaa00' };
      const cardsToShow = state.cards.slice(0, 6);
      const grid = el('div', `
        display:grid;grid-template-columns:repeat(auto-fill, minmax(72px, 1fr));
        gap:6px;margin-top:6px;
      `);
      cardsToShow.forEach((c, i) => {
        const tg = c.tags[0] ?? 'echo';
        const col = TAG_COLOR2[tg] ?? '#fff';
        const rty = RARITY_TINT[c.rarity] ?? 'rgba(255,255,255,0.3)';
        const cell = el('div', `
          background:linear-gradient(160deg, ${col}22, rgba(0,0,0,0.5));
          border:1.5px solid ${rty};
          border-radius:8px;padding:8px 4px;text-align:center;
          box-shadow:0 0 10px ${col}33;
          animation:hl-fade-up .4s ease-out ${0.5 + i * 0.05}s both;
        `);
        cell.innerHTML = `
          <div style="font-size:18px;filter:drop-shadow(0 0 4px ${col});line-height:1">${(TAG_EMOJI[tg] ?? '✨')}</div>
          <div style="font-family:Galmuri11,monospace;font-size:9px;color:#fff;margin-top:4px;line-height:1.2;height:22px;overflow:hidden">${(c as any).name_ko ?? c.id}</div>
        `;
        grid.appendChild(cell);
      });
      if (state.cards.length > 6) {
        const more = el('div', `
          display:flex;align-items:center;justify-content:center;
          background:rgba(255,255,255,0.05);
          border:1.5px dashed rgba(255,255,255,0.25);
          border-radius:8px;color:var(--text-dim);
          font-family:Galmuri11,monospace;font-size:11px;letter-spacing:1px;
          padding:8px 4px;
        `, `+${state.cards.length - 6}장`);
        grid.appendChild(more);
      }
      progressPanel.appendChild(grid);
    }

    // ⭐ 시너지 트리거 횟수 (있을 때만) — 빌드 임팩트 가시화
    const synTotal = Object.values(state.stats.synergyTriggers ?? {}).reduce((a, b) => a + (b ?? 0), 0);
    if (synTotal > 0) {
      const synBar = el('div', `
        display:flex;justify-content:space-between;align-items:center;
        margin-top:10px;padding:6px 10px;
        background:rgba(255,215,0,0.08);border-radius:6px;
        border-left:2px solid #ffd700;
        font-family:Galmuri11,monospace;font-size:11px;
      `);
      synBar.innerHTML = `
        <span style="color:var(--text-dim);letter-spacing:1.5px">⚡ 시너지 발동</span>
        <span style="color:#ffd700;font-weight:bold;text-shadow:0 0 6px rgba(255,215,0,0.6)">${synTotal}회 (${Object.keys(state.stats.synergyTriggers).length}종)</span>
      `;
      progressPanel.appendChild(synBar);
    }

    main.appendChild(progressPanel);
  }

  // ── 통계 그리드 (3x2 또는 2x3 — 반응형) ──
  const statsPanel = el('div', `
    width:100%;
    display:grid;grid-template-columns:repeat(auto-fit, minmax(120px, 1fr));
    gap:10px;margin-bottom:clamp(16px,2.5vh,22px);
    animation:hl-fade-up .8s ease-out .55s both;
  `);
  const stats: { label: string; value: string; color: string; emoji: string }[] = [
    { emoji: '🌊', label: '도달 웨이브', value: `W${state.wave}`,                                         color: '#05d9e8' },
    { emoji: '⏱️', label: '생존 시간',  value: `${Math.floor(elapsed/60)}:${String(Math.floor(elapsed%60)).padStart(2,'0')}`, color: '#d300c5' },
    { emoji: '⚡',  label: '최고 콤보',  value: `×${state.comboMaxRun}`,                                    color: '#ff2a6d' },
    { emoji: '💥', label: '평균 DPS',    value: formatNum(dps),                                              color: '#ff6f00' },
    { emoji: '🃏', label: '카드 수',     value: `${state.cards.length}`,                                    color: '#b14aff' },
    { emoji: '👹', label: '보스 격파',   value: `${state.stats.bossesDefeated}`,                            color: '#b3ff00' },
  ];
  for (const st of stats) {
    const cell = el('div', `
      background:rgba(10,10,26,0.65);
      border:1px solid ${st.color}55;
      border-radius:10px;padding:clamp(10px,1.5vw,14px) clamp(8px,1.2vw,12px);
      text-align:center;
      backdrop-filter:blur(6px);
      box-shadow:0 0 16px ${st.color}22, inset 0 0 0 1px rgba(255,255,255,0.04);
      transition:transform .15s, box-shadow .15s;
    `);
    cell.innerHTML = `
      <div style="font-size:clamp(18px,2vw,24px);margin-bottom:4px;filter:drop-shadow(0 0 8px ${st.color})">${st.emoji}</div>
      <div style="font-family:Galmuri11,monospace;font-size:clamp(18px,2.2vw,26px);color:${st.color};font-weight:bold;text-shadow:0 0 8px ${st.color}66;line-height:1">${st.value}</div>
      <div style="font-size:clamp(9px,0.9vw,11px);color:var(--text-dim);margin-top:4px;letter-spacing:1.5px;font-family:Galmuri11,monospace">${st.label}</div>
    `;
    cell.onmouseenter = () => { cell.style.transform = 'translateY(-2px)'; cell.style.boxShadow = `0 0 24px ${st.color}55, inset 0 0 0 1px rgba(255,255,255,0.08)`; };
    cell.onmouseleave = () => { cell.style.transform = ''; cell.style.boxShadow = `0 0 16px ${st.color}22, inset 0 0 0 1px rgba(255,255,255,0.04)`; };
    statsPanel.appendChild(cell);
  }
  main.appendChild(statsPanel);

  // ⭐ 사망 원인 (Death Recap) — 무엇이 너를 끝냈는가
  if (state.stats.lastHitCause) {
    const CAUSE_LABEL: Record<string, { name: string; icon: string; color: string; tip: string }> = {
      jab:        { name: '잡귀',      icon: '👻', color: '#7080a0', tip: '약한 적이지만 무리로 압박. 화염 오라로 청소' },
      wonwi:      { name: '원귀',      icon: '🟢', color: '#90ff90', tip: '빠른 추격자. 슬로우 효과로 거리 두기' },
      dokkaebi:   { name: '도깨비',    icon: '👹', color: '#b14aff', tip: '근접 강타. 거리 유지가 핵심' },
      shooter:    { name: '원거리 사수', icon: '🎯', color: '#a855f7', tip: '먼 거리에서 발사. 엄폐물 활용 + 빠른 처치' },
      charger:    { name: '돌진자',    icon: '⚡', color: '#ff6f00', tip: '2초 주기 돌진. 빨간 라인 보이면 옆으로 회피' },
      exploder:   { name: '자폭자',    icon: '💥', color: '#ffaa00', tip: '근접 시 자폭. 원거리 무기로 먼저 처치' },
      summoner:   { name: '소환사',    icon: '🌀', color: '#d300c5', tip: '5초마다 잡귀 소환. 우선 처치 권장' },
      jangsan:    { name: '장산범 (미니보스)', icon: '🐯', color: '#ff3366', tip: '강한 미니보스. 빌드 강화 후 도전' },
      boss:       { name: '거대 보스',  icon: '👑', color: '#ff2a6d', tip: '보스 패턴 텔레그래프 잘 보고 회피' },
      blackhole:  { name: '블랙홀',    icon: '🕳️', color: '#b14aff', tip: '인력장 + 중심 즉사. 대시(SPACE)로 탈출' },
      asteroid:   { name: '운석',      icon: '☄️', color: '#b14aff', tip: '충돌 시 데미지. 우회 + 발사체로 파괴' },
    };
    const c = CAUSE_LABEL[state.stats.lastHitCause] ?? { name: state.stats.lastHitCause, icon: '?', color: '#888', tip: '' };
    const recap = el('div', `
      width:100%;
      background:linear-gradient(135deg, ${c.color}22, rgba(10,10,26,0.7));
      border:1.5px solid ${c.color}88;
      border-radius:12px;padding:clamp(12px,1.8vw,18px);
      margin-bottom:clamp(16px,2.5vh,22px);
      animation:hl-fade-up .8s ease-out .65s both;
      box-shadow:0 0 20px ${c.color}33;
    `);
    const lhTime = state.stats.lastHitTime ?? 0;
    const lhWave = state.stats.lastHitWave ?? state.wave;
    recap.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:14px">
        <div style="font-size:clamp(36px,4.5vw,48px);filter:drop-shadow(0 0 12px ${c.color})">${c.icon}</div>
        <div style="flex:1;min-width:0">
          <div style="font-family:Galmuri11,monospace;color:rgba(255,255,255,0.55);font-size:11px;letter-spacing:3px;margin-bottom:4px">⚰️ DEATH BY</div>
          <div style="font-family:Galmuri11,monospace;color:${c.color};font-size:clamp(16px,1.8vw,22px);font-weight:bold;letter-spacing:1px;text-shadow:0 0 8px ${c.color}66">${c.name}</div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:4px;letter-spacing:1px">W${lhWave} · ${Math.floor(lhTime)}초 시점 · ${state.stats.lastHitDmg ?? 1} 데미지</div>
          ${c.tip ? `<div style="font-size:11px;color:var(--text);margin-top:8px;line-height:1.5;padding:6px 10px;background:rgba(0,0,0,0.4);border-left:2px solid ${c.color};border-radius:0 4px 4px 0">💡 <span style="opacity:0.85">${c.tip}</span></div>` : ''}
        </div>
      </div>
    `;
    main.appendChild(recap);
  }

  // ── 빌드 비주얼라이저 (Run Identity + 태그 분포 막대) ──
  if (state.runIdentity || state.cards.length > 0) {
    const buildPanel = el('div', `
      width:100%;
      background:linear-gradient(160deg, rgba(20,12,46,0.85), rgba(10,10,26,0.92));
      border:1px solid rgba(255,215,0,0.35);
      border-radius:12px;padding:clamp(14px,2vw,20px);
      margin-bottom:clamp(16px,2.5vh,22px);
      animation:hl-fade-up .8s ease-out .7s both;
      box-shadow:0 4px 16px rgba(0,0,0,0.4);
    `);
    if (state.runIdentity) {
      buildPanel.appendChild(el('div', `
        text-align:center;margin-bottom:14px;
        font-family:Galmuri11,monospace;
        font-size:clamp(16px,2vw,22px);
        color:var(--gold);font-weight:bold;letter-spacing:3px;
        text-shadow:0 0 12px rgba(255,215,0,0.7), 0 0 24px rgba(255,215,0,0.4);
      `, `✦ ${state.runIdentity} ✦`));
    } else {
      buildPanel.appendChild(el('div', `
        text-align:center;margin-bottom:14px;
        color:var(--text-dim);font-family:Galmuri11,monospace;
        font-size:clamp(13px,1.4vw,16px);letter-spacing:2px;
      `, '— 정체성 미발현 —'));
    }
    const tagCounts: Record<string, number> = {};
    for (const c of state.cards) for (const tg of c.tags) tagCounts[tg] = (tagCounts[tg] ?? 0) + 1;
    const TAG_COLOR: Record<string,string> = { fire:'#ff2a6d',ice:'#05d9e8',gold:'#ffd700',time:'#d300c5',chaos:'#ff6f00',echo:'#b3ff00' };
    const sorted = Object.entries(tagCounts).sort((a,b) => b[1] - a[1]);
    const maxCount = Math.max(1, ...sorted.map(([,n]) => n));
    if (sorted.length > 0) {
      const bars = el('div', 'display:flex;flex-direction:column;gap:6px');
      sorted.forEach(([tg, n], i) => {
        const w = (n / maxCount) * 100;
        const tier = n >= 7 ? 7 : n >= 5 ? 5 : n >= 3 ? 3 : null;
        const tierLabel = tier ? `<span style="color:${TAG_COLOR[tg]};font-weight:bold;text-shadow:0 0 6px ${TAG_COLOR[tg]}">${tier}-tier</span>` : '<span style="color:var(--text-dim)">미발동</span>';
        const row = el('div', 'display:flex;align-items:center;gap:10px;font-family:Galmuri11,monospace;font-size:clamp(11px,1.1vw,13px)');
        row.innerHTML = `
          <span style="font-size:18px;width:24px;text-align:center;filter:drop-shadow(0 0 6px ${TAG_COLOR[tg]})">${(TAG_EMOJI[tg] ?? '✨')}</span>
          <div style="flex:1;height:14px;background:rgba(0,0,0,0.5);border-radius:7px;overflow:hidden;position:relative;border:1px solid ${TAG_COLOR[tg]}44">
            <div style="height:100%;width:${w}%;background:linear-gradient(90deg,${TAG_COLOR[tg]}aa,${TAG_COLOR[tg]});border-radius:6px;box-shadow:0 0 8px ${TAG_COLOR[tg]};animation:hl-tag-bar 1s cubic-bezier(.16,1,.3,1) ${0.8 + i * 0.1}s both;--w:${w}%"></div>
          </div>
          <span style="color:${TAG_COLOR[tg]};font-weight:bold;min-width:28px;text-align:right">${n}장</span>
          <span style="min-width:64px;text-align:right">${tierLabel}</span>
        `;
        bars.appendChild(row);
      });
      buildPanel.appendChild(bars);
    }
    main.appendChild(buildPanel);
  }

  // ⭐ 깊이 도감 (Discovery) — 10분 플레이로 안 보이는 시스템 폭을 명시.
  // "N / 28 운명 발견" → 본 적 없는 빌드가 더 있다는 걸 즉시 전달.
  // 동료 개발자 표 60% 직격 (rubric 참신성 20점). 색만으로 정보 X (◆/⚡ + 숫자).
  // 메인/리더보드/도감과 동일한 공용 헬퍼 — 4곳에서 같은 데이터·룩.
  main.appendChild(discoveryCodexPanel(meta, {
    newRI: !!state.stats.newIdentityThisRun,
    newSyn: state.stats.newSynergyThisRun ?? 0,
    newMod: state.stats.newModifierThisRun ?? 0,
    newBiome: state.stats.newBiomeThisRun ?? 0,
    containerAnim: 'margin-bottom:clamp(16px,2.5vh,22px);animation:hl-fade-up .8s ease-out .78s both;',
    barAnim: 'animation:hl-tag-bar 1s cubic-bezier(.16,1,.3,1) 1s both',
    showExtended: true, modifierTotal: allModifierDefs().length, biomeTotal: BIOME_KINDS.length,
  }));

  // ── 한 끗 부족 / 격려 메시지 ──
  let almostMsg = '';
  if (isPB) almostMsg = `🎉 자기 기록 갱신! +${formatNum(state.totalScore - meta.bestScore)}`;
  else if (meta.bestScore - state.totalScore > 0 && meta.bestScore - state.totalScore < state.totalScore * 0.15) {
    almostMsg = `최고 기록까지 ${formatNum(meta.bestScore - state.totalScore)} 코인 부족 — 다시!`;
  } else if (state.totalScore > meta.yesterdayScore && meta.yesterdayScore > 0) {
    almostMsg = `어제 점수 ${formatNum(meta.yesterdayScore)} 돌파!`;
  } else {
    almostMsg = `다음 RP 100까지 ${100 - (meta.rp % 100)} 부족`;
  }
  main.appendChild(el('div', `
    color:var(--gold);font-family:Galmuri11,monospace;
    font-size:clamp(13px,1.4vw,16px);text-align:center;
    margin-bottom:clamp(16px,2.5vh,22px);letter-spacing:1px;
    text-shadow:0 0 10px rgba(255,215,0,0.4);
    animation:hl-fade-up .8s ease-out .85s both;
  `, almostMsg));

  // ── 닉네임 + 리더보드 등록 (강조 박스) ──
  const lbPanel = el('div', `
    width:100%;
    background:rgba(10,10,26,0.6);
    border:1px solid rgba(5,217,232,0.3);
    border-radius:10px;padding:clamp(12px,1.8vw,18px);
    margin-bottom:clamp(12px,1.8vh,16px);
    animation:hl-fade-up .8s ease-out 1s both;
    backdrop-filter:blur(6px);
  `);
  lbPanel.appendChild(el('div', `
    color:rgba(5,217,232,0.85);font-family:Galmuri11,monospace;
    font-size:clamp(11px,1.1vw,13px);letter-spacing:3px;margin-bottom:10px;text-align:center
  `, '👑 오늘의 챔피언에 도전'));
  const nickRow = el('div', 'display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap');
  const nickInput = document.createElement('input');
  nickInput.type = 'text';
  nickInput.placeholder = '닉네임 (1-16자)';
  nickInput.maxLength = 16;
  nickInput.value = (typeof localStorage !== 'undefined' && localStorage.getItem('samsara.nick')) || '';
  nickInput.style.cssText = `
    background:rgba(0,0,0,0.5);color:var(--text);
    border:1.5px solid rgba(5,217,232,0.4);
    padding:10px 14px;border-radius:8px;
    font-family:Galmuri11,monospace;font-size:14px;
    width:200px;max-width:60vw;
    transition:border-color .15s, box-shadow .15s;
  `;
  nickInput.onfocus = () => { nickInput.style.borderColor = '#05d9e8'; nickInput.style.boxShadow = '0 0 12px rgba(5,217,232,0.4)'; };
  nickInput.onblur = () => { nickInput.style.borderColor = 'rgba(5,217,232,0.4)'; nickInput.style.boxShadow = ''; };

  const submitBtn = document.createElement('button');
  submitBtn.textContent = '리더보드 등록';
  submitBtn.style.cssText = `
    background:linear-gradient(135deg, #05d9e8, #b3ff00);
    color:#000;border:none;padding:10px 18px;border-radius:8px;
    font-family:Galmuri11,monospace;font-size:13px;font-weight:bold;letter-spacing:2px;
    cursor:pointer;transition:transform .15s, box-shadow .15s;
    box-shadow:0 4px 14px rgba(5,217,232,0.4);
  `;
  submitBtn.onmouseenter = () => { submitBtn.style.transform = 'translateY(-1px)'; submitBtn.style.boxShadow = '0 6px 20px rgba(5,217,232,0.6)'; };
  submitBtn.onmouseleave = () => { submitBtn.style.transform = ''; submitBtn.style.boxShadow = '0 4px 14px rgba(5,217,232,0.4)'; };
  submitBtn.onclick = async () => {
    const nick = nickInput.value.trim();
    if (!nick) { nickInput.focus(); return; }
    if (typeof localStorage !== 'undefined') localStorage.setItem('samsara.nick', nick);
    submitBtn.textContent = '제출 중…';
    submitBtn.disabled = true;
    const lb = await import('../services/leaderboard.js');
    const res = await lb.submitScore({
      nickname: nick,
      score: state.totalScore,
      run_identity: state.runIdentity,
      card_ids: state.cards.map(c => c.id),
      surviveSec: state.elapsed,
    });
    submitBtn.textContent = res.ok ? '✓ 등록됨' : `실패: ${res.reason ?? ''}`;
    submitBtn.style.background = res.ok ? 'linear-gradient(135deg, #b3ff00, #05d9e8)' : 'var(--bad)';
  };
  nickRow.appendChild(nickInput);
  nickRow.appendChild(submitBtn);
  lbPanel.appendChild(nickRow);
  main.appendChild(lbPanel);

  // ── 액션 버튼 그룹 (재시작 강조 + 보조) ──
  const navWrap = el('div', `
    width:100%;display:flex;flex-direction:column;gap:10px;
    animation:hl-fade-up .8s ease-out 1.15s both;
  `);
  const restart = () => {
    clearReel();
    engine.newRun({ seed: dailySeed(), meta });
    go('play');
    setTimeout(() => engine.startWave(1), 200);
  };
  const restartBtn = document.createElement('button');
  restartBtn.innerHTML = '↺  다시 시작 <span style="opacity:0.7;font-size:0.85em">(Enter)</span>';
  restartBtn.style.cssText = `
    background:linear-gradient(135deg, #ff2a6d 0%, #b14aff 50%, #05d9e8 100%);
    color:#fff;border:none;padding:16px;border-radius:10px;
    font-family:Galmuri11,monospace;font-size:clamp(15px,1.6vw,18px);font-weight:bold;letter-spacing:4px;
    cursor:pointer;box-shadow:0 6px 24px rgba(255,42,109,0.45);
    transition:transform .15s, box-shadow .15s;
  `;
  restartBtn.onmouseenter = () => { restartBtn.style.transform = 'translateY(-2px) scale(1.01)'; restartBtn.style.boxShadow = '0 10px 30px rgba(255,42,109,0.7)'; };
  restartBtn.onmouseleave = () => { restartBtn.style.transform = ''; restartBtn.style.boxShadow = '0 6px 24px rgba(255,42,109,0.45)'; };
  restartBtn.onclick = restart;
  navWrap.appendChild(restartBtn);

  const subRow = el('div', 'display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px');
  const subItems: [string, () => void][] = [
    ['📸  공유 이미지', async () => {
      const dataUrl = buildSharePng(state as any);
      await shareImage(dataUrl, `samsara-${dailySeed()}.png`);
    }],
    ['🎬  하이라이트', () => {
      const dataUrl = buildReelPng();
      const a = document.createElement('a'); a.href = dataUrl; a.download = `samsara-reel-${dailySeed()}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }],
    ['🏛️  환생의 사원', () => go('metaShop')],
    ['⌂  메인', () => go('home')],
  ];
  for (const [label, click] of subItems) {
    const b = document.createElement('button');
    b.innerHTML = label;
    b.style.cssText = `
      background:rgba(26,20,46,0.7);color:var(--text);
      border:1px solid rgba(255,255,255,0.15);
      padding:12px;border-radius:8px;
      font-family:Galmuri11,monospace;font-size:clamp(12px,1.1vw,14px);
      letter-spacing:1.5px;cursor:pointer;
      backdrop-filter:blur(8px);
      transition:background .15s, border-color .15s, transform .15s;
    `;
    b.onmouseenter = () => { b.style.background = 'rgba(46,32,76,0.85)'; b.style.borderColor = 'rgba(5,217,232,0.5)'; b.style.transform = 'translateY(-1px)'; };
    b.onmouseleave = () => { b.style.background = 'rgba(26,20,46,0.7)'; b.style.borderColor = 'rgba(255,255,255,0.15)'; b.style.transform = ''; };
    b.onclick = click;
    subRow.appendChild(b);
  }
  navWrap.appendChild(subRow);
  main.appendChild(navWrap);

  // 하이라이트 이벤트 (디버그성, 작게)
  if (events.length > 0) {
    const reel = el('details', `
      width:100%;margin-top:clamp(16px,2.5vh,22px);
      background:rgba(0,0,0,0.4);border:1px solid rgba(255,255,255,0.08);
      border-radius:8px;padding:8px 12px;
      font-family:Galmuri11,monospace;color:var(--text-dim);font-size:11px;
      animation:hl-fade-up .8s ease-out 1.3s both;
    `);
    reel.innerHTML = `<summary style="cursor:pointer;color:var(--text-dim);letter-spacing:2px;font-size:11px">▸ 하이라이트 로그 (${Math.min(5, events.length)}건)</summary>`;
    const top5 = events.slice(-5);
    for (const ev of top5) {
      reel.appendChild(el('div', 'padding:3px 0;font-size:10px;border-bottom:1px solid rgba(255,255,255,0.05);word-break:break-all',
        `${ev.t.toFixed(1)}s · ${ev.type} · ${JSON.stringify(ev.payload)}`));
    }
    main.appendChild(reel);
  }

  root.appendChild(main);

  // Enter / Space 빠른 재시작 (단, 닉네임 입력란 포커스 시는 무시)
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const tgt = e.target as HTMLElement | null;
    if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return;
    e.preventDefault();
    restart();
  };
  window.addEventListener('keydown', onKey);

  host.appendChild(root);
  const detachCue = attachScrollCue(root);
  return () => {
    window.removeEventListener('keydown', onKey);
    detachCue();
    try { host.removeChild(root); } catch {}
  };
}

// ─────────────────────────── TRANSCEND ───────────────────────────

export function mountTranscend(host: HTMLElement, engine: Engine): () => void {
  host.innerHTML = '';
  const root = el('div', `
    position:fixed;inset:0;background:#000;display:flex;flex-direction:column;
    align-items:center;justify-content:center;padding:24px;color:white;
    animation:fadeIn 1s ease-out;
  `);

  // 별빛
  const stars = el('div', 'position:fixed;inset:0;pointer-events:none');
  for (let i = 0; i < 200; i++) {
    const s = el('div', `
      position:absolute;left:${Math.random() * 100}%;top:${Math.random() * 100}%;
      width:${Math.random() < 0.1 ? 3 : 1}px;height:${Math.random() < 0.1 ? 3 : 1}px;
      background:white;border-radius:50%;
      opacity:${0.3 + Math.random() * 0.7};
      animation:twinkle ${2 + Math.random() * 4}s ease-in-out ${Math.random() * 2}s infinite alternate;
    `);
    stars.appendChild(s);
  }
  root.appendChild(stars);

  root.appendChild(el('h1', `
    font-family:Galmuri11,monospace;font-size:48px;
    background:linear-gradient(90deg,#ffd700,#ff2a6d,#05d9e8,#b3ff00);
    -webkit-background-clip:text;background-clip:text;color:transparent;
    margin:0;
  `, 'TRANSCENDENCE'));

  root.appendChild(el('p', 'font-family:Galmuri11,monospace;color:#fff;font-size:18px;margin:16px 0;text-align:center', '당신은 윤회의 굴레를 끊었습니다.'));
  root.appendChild(el('p', 'font-family:Galmuri11,monospace;color:#888;font-size:14px;margin:4px 0;text-align:center', 'You have broken the cycle of Samsara.'));

  root.appendChild(el('p', 'color:var(--gold);font-size:20px;margin:32px 0', `최종 점수: ${formatNum(engine.getState().totalScore)}`));

  root.appendChild(btn('메인 화면으로', () => go('home'), true));

  host.appendChild(root);
  return () => { try { host.removeChild(root); } catch {} };
}
