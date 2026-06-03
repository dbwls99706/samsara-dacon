// SAMSARA · 윤회 — 무기 시스템
//
// 보유 카드 → 무기로 변환.
// 같은 태그 카드 N장 = 그 무기 레벨 N.
// 시너지 3/5/7 발동 시 무기 변형 (radius/damage/projectile count 강화).

import { rng } from './cards.js';
import type { Card, CardTag, GameState } from './types.js';
import { DESTRUCTIBLE_KINDS, isPropWeaponImmune, nearestTarget, spawnAreaEffect, spawnProjectile, type Vec, type World } from './world.js';
import { spawnAttackFx } from '../render/attacks.js';

export interface Weapon {
  id: string;
  tag: CardTag;
  level: number;
  cooldown: number;
  cooldownMax: number;
  apply: (w: World, t: number, state: GameState) => void;
  evolved?: boolean;
  displayName?: string;
  // ⭐ HUD/툴팁용 상세 정보
  desc?: string;           // 한줄 메커니즘 설명 ("주변 적에 지속 데미지")
  damageHint?: string;     // 현재 수치 ("DPS ~24, 반경 84px")
  evolutionHint?: string;  // 다음 진화 조건 ("3장 = 발화, 5장 = 진화")
}

const WEAPON_COLOR: Record<CardTag, string> = {
  fire: '#ff2a6d', ice: '#05d9e8', gold: '#ffd700',
  time: '#d300c5', chaos: '#ff6f00', echo: '#b3ff00',
};

// ─────────────────────────── 카드 → 무기 변환 ───────────────────────────

/** 캐릭터별 시작 무기 — 카드 0장이어도 항상 발동 */
export type CharacterId = 'tiger' | 'magpie' | 'dokkaebi' | 'gumiho' | 'dragon';

export interface StarterDef {
  id: CharacterId;
  name_ko: string;
  weaponName: string;
  weapon: () => Weapon;
}

export const STARTERS: Record<CharacterId, StarterDef> = {
  tiger:    { id: 'tiger',    name_ko: '호랑이', weaponName: '발톱 휘두르기', weapon: () => makeClaw(),   },
  magpie:   { id: 'magpie',   name_ko: '까치',   weaponName: '쪼기',           weapon: () => makePeck(),   },
  dokkaebi: { id: 'dokkaebi', name_ko: '도깨비', weaponName: '방망이',         weapon: () => makeClub(),   },
  gumiho:   { id: 'gumiho',   name_ko: '구미호', weaponName: '여우불',         weapon: () => makeFoxFire(),},
  dragon:   { id: 'dragon',   name_ko: '용',     weaponName: '용숨',           weapon: () => makeBreath(), },
};

// ─────────────────────────── 시작 무기들 ───────────────────────────

// 발톱 휘두르기 — 짧은 반경 부채꼴 데미지
function makeClaw(): Weapon {
  return {
    id: 'starter_claw', tag: 'fire' as CardTag, level: 1,
    cooldown: 0, cooldownMax: 0.7,
    displayName: '발톱 휘두르기',
    desc: '맹수의 발톱이 가장 가까운 영혼의 살갗을 가르는, 짧고 사나운 일격',
    damageHint: '데미지 11 · 부채꼴 반경 90px · 0.7초마다',
    apply(w, t) {
      // 가까운 적을 향해 부채꼴 — 적 없으면 박스(prop) 도 타겟
      const tgt = nearestTarget(w, w.player.pos);
      if (!tgt) return;
      const dx = tgt.pos.x - w.player.pos.x;
      const dy = tgt.pos.y - w.player.pos.y;
      const a0 = Math.atan2(dy, dx);
      const range = 90;
      const dmg = 11;
      // 부채꼴 적용 (다중 적)
      for (const e of w.enemies) {
        if (e.hp <= 0) continue;
        const ex = e.pos.x - w.player.pos.x;
        const ey = e.pos.y - w.player.pos.y;
        const d = Math.hypot(ex, ey);
        if (d > range + e.radius) continue;
        const ea = Math.atan2(ey, ex);
        let da = Math.abs(ea - a0);
        if (da > Math.PI) da = Math.PI * 2 - da;
        if (da < Math.PI / 3) {
          e.hp -= dmg;
        }
      }
      // ⭐ 파괴 가능한 프롭(박스/장애물)도 부채꼴로 타격 (이전: 적만 때려 발톱이 오브젝트
      //   피격 안 되던 버그). 적이 없으면 nearestTarget 이 프롭을 조준 → 부숨. 부채꼴은 적보다
      //   살짝 넓게(피격 판정 관대 — 게임필). 파괴는 다음 틱 prop 검사에 위임(weapons.ts 패턴).
      for (const p of w.props) {
        if (p.hp <= 0 || p.destroyedAt || !DESTRUCTIBLE_KINDS.has(p.kind) || isPropWeaponImmune(p)) continue;
        const px = p.pos.x - w.player.pos.x;
        const py = p.pos.y - w.player.pos.y;
        const d = Math.hypot(px, py);
        if (d > range + p.radius) continue;
        const pa = Math.atan2(py, px);
        let da = Math.abs(pa - a0);
        if (da > Math.PI) da = Math.PI * 2 - da;
        if (da < Math.PI / 2.5) {
          p.hp -= dmg;
          p.hitFlashUntil = t + 100;
          if (p.hp < 0) p.hp = 0;
        }
      }
      // 시각 효과를 위해 player.facing 갱신
      w.player.facing = a0;
      spawnAttackFx({ kind: 'claw', pos: { ...w.player.pos }, angle: a0, range: 80, color: '#ff8866', duration: 0.3, thickness: 4 });
    },
  };
}

// 까치 쪼기 — 작은 호밍 발사체
function makePeck(): Weapon {
  return {
    id: 'starter_peck', tag: 'ice' as CardTag, level: 1,
    cooldown: 0, cooldownMax: 0.65,
    displayName: '쪼기',
    desc: '허공을 가르며 표적을 끝까지 쫓는 까치의 부리, 한 번 노린 영혼은 결코 놓치지 않는다',
    damageHint: '데미지 9 · 비행속도 420 · 호밍 추적 · 0.65초마다',
    apply(w) {
      const tgt = nearestTarget(w, w.player.pos);
      if (!tgt) return;
      const dx = tgt.pos.x - w.player.pos.x;
      const dy = tgt.pos.y - w.player.pos.y;
      const d = Math.hypot(dx, dy) || 1;
      spawnProjectile(w, {
        pos: { ...w.player.pos }, vel: { x: (dx / d) * 420, y: (dy / d) * 420 },
        radius: 5, damage: 9, life: 1.5, color: '#05d9e8',
        kind: 'bullet', pierce: 0, homing: true, bounces: 0,
      });
      const a = Math.atan2(dy, dx);
      spawnAttackFx({ kind: 'beam', pos: { ...w.player.pos }, angle: a, range: 50, color: '#05d9e8', duration: 0.15, thickness: 3 });
    },
  };
}

// 도깨비 방망이 — 강한 단발 + 큰 넉백 (영역)
function makeClub(): Weapon {
  return {
    id: 'starter_club', tag: 'chaos' as CardTag, level: 1,
    cooldown: 0, cooldownMax: 1.7,
    displayName: '방망이',
    desc: '도깨비의 방망이가 땅을 내리쳐 사방으로 뻗어나가는 묵직한 충격파, 모든 것을 흔들어 놓는다',
    damageHint: '데미지 18 · 충격 반경 80px · 1.7초마다',
    apply(w) {
      spawnAreaEffect(w, {
        pos: { x: w.player.pos.x, y: w.player.pos.y },
        radius: 80, damage: 18, life: 0.25, color: '#ff6f00',
        followPlayer: false, kind: 'nova', slowFactor: 1, hitInterval: 1,
      });
      spawnAttackFx({ kind: 'pulse', pos: { ...w.player.pos }, angle: 0, range: 80, color: '#ff6f00', duration: 0.4, thickness: 0 });
    },
  };
}

// 구미호 여우불 — 자동 호밍 다발
function makeFoxFire(): Weapon {
  return {
    id: 'starter_fox', tag: 'fire' as CardTag, level: 1,
    cooldown: 0, cooldownMax: 1.0,
    displayName: '여우불',
    desc: '구미호의 보랏빛 도깨비불 세 줄기가 영혼을 추적하며 식지 않는 화상의 자취를 남긴다',
    damageHint: '발당 데미지 6 · 3발 동시 · 화상 0.8초 · 관통 1 · 1.0초마다',
    apply(w) {
      for (let i = 0; i < 3; i++) {
        const tgt = nearestTarget(w, w.player.pos);
        const dx = tgt ? tgt.pos.x - w.player.pos.x : Math.cos(i * 2) * 100;
        const dy = tgt ? tgt.pos.y - w.player.pos.y : Math.sin(i * 2) * 100;
        const d = Math.hypot(dx, dy) || 1;
        const angle = Math.atan2(dy, dx) + (i - 1) * 0.3;
        spawnProjectile(w, {
          pos: { ...w.player.pos },
          vel: { x: Math.cos(angle) * 320, y: Math.sin(angle) * 320 },
          radius: 6, damage: 6, life: 1.4, color: '#d300c5',
          kind: 'orb', pierce: 1, homing: true, bounces: 0, burnFor: 0.8,
        });
      }
    },
  };
}

// 용숨 — 정면 cone (큰 데미지 + 관통)
function makeBreath(): Weapon {
  return {
    id: 'starter_breath', tag: 'fire' as CardTag, level: 1,
    cooldown: 0, cooldownMax: 1.5,
    displayName: '용숨',
    desc: '용의 입에서 뿜어져 나오는 다섯 줄기 화염 부채꼴, 닿는 모든 것을 한꺼번에 꿰뚫는다',
    damageHint: '발당 데미지 10 · 5발 부채꼴 · 관통 3 · 화상 1초 · 1.5초마다',
    apply(w) {
      const tgt = nearestTarget(w, w.player.pos);
      const a0 = tgt ? Math.atan2(tgt.pos.y - w.player.pos.y, tgt.pos.x - w.player.pos.x) : w.player.facing;
      // 5발 부채꼴 발사
      for (let i = -2; i <= 2; i++) {
        const a = a0 + i * 0.18;
        spawnProjectile(w, {
          pos: { ...w.player.pos }, vel: { x: Math.cos(a) * 380, y: Math.sin(a) * 380 },
          radius: 8, damage: 10, life: 0.7, color: '#ff2a6d',
          kind: 'bullet', pierce: 3, homing: false, bounces: 0, burnFor: 1,
        });
      }
      spawnAttackFx({ kind: 'cone', pos: { ...w.player.pos }, angle: a0, range: 200, color: '#ff2a6d', duration: 0.35, thickness: 0 });
    },
  };
}

export function buildWeapons(cards: Card[], state: GameState, character: CharacterId = 'tiger'): Weapon[] {
  const counts: Record<CardTag, number> = { fire: 0, ice: 0, gold: 0, time: 0, chaos: 0, echo: 0 };
  for (const c of cards) for (const tag of c.tags) counts[tag] += 1;

  // 항상 시작 무기 1개 포함 (카드 0장이어도 공격 가능)
  const ws: Weapon[] = [STARTERS[character].weapon()];
  for (const tag of Object.keys(counts) as CardTag[]) {
    const lv = counts[tag];
    if (lv <= 0) continue;
    ws.push(makeWeapon(tag, lv, state));
  }

  // ── 보너스 스킬 (특수 잠금해제 조건) ──
  // 전기 사슬 — echo 5장 이상 시 자동 활성. 적/박스 사이를 도약하며 타격.
  if (counts.echo >= 5) ws.push(makeChainLightning(counts.echo));

  // 수호 결계 — 6 태그 모두 1장 이상 보유 시 활성 (조화의 길). 플레이어 주변 회전 보호막.
  const allTags = (['fire', 'ice', 'gold', 'time', 'chaos', 'echo'] as CardTag[]).every(t => counts[t] >= 1);
  if (allTags) ws.push(makeOrbitalShield(cards.length));

  return ws;
}

// ─────────────────────────── 보너스 무기 ───────────────────────────

// ── ⚡ 전기 사슬 — echo×5 잠금해제. 가까운 적부터 시작해 N번 도약 ──
function makeChainLightning(echoLevel: number): Weapon {
  const chains = 3 + Math.min(5, echoLevel - 5);  // 5장=3 도약, 10장=5 도약
  const dmg = 14 + echoLevel * 5;
  return {
    id: 'chain', tag: 'echo', level: echoLevel,
    evolved: false, displayName: '전기 사슬',
    desc: `적의 영혼 사이를 ${chains}번 도약하며 떨어지는 푸른 천뢰, 매 도약마다 잔향이 옅어진다`,
    damageHint: `초기 데미지 ${dmg.toFixed(0)} · 도약마다 0.85배 감쇠 · 1.4초마다`,
    evolutionHint: '🪞 거울(echo) 카드를 더 모으면 도약 횟수가 한 번씩 늘어난다',
    cooldown: 0, cooldownMax: 1.4,
    apply(w, t) {
      const enemyHit = new Set<number>();
      const propHit = new Set<number>();
      let from: { pos: Vec; r: number } = { pos: { x: w.player.pos.x, y: w.player.pos.y }, r: w.player.radius };
      for (let chain = 0; chain < chains; chain++) {
        const tgt = nearestTarget(w, from.pos, enemyHit, propHit);
        if (!tgt) break;
        if (tgt.kind === 'enemy') enemyHit.add(tgt.id);
        else propHit.add(tgt.id);
        // 도약 반경 제한 — 너무 멀리는 점프 X (300px)
        const dx = tgt.pos.x - from.pos.x;
        const dy = tgt.pos.y - from.pos.y;
        if (dx * dx + dy * dy > 300 * 300) break;
        // 데미지 적용 — 발사체 대신 직접 hp 차감
        const fallDmg = dmg * Math.pow(0.85, chain);
        if (tgt.kind === 'enemy') {
          const e = w.enemies.find(en => en.id === tgt.id);
          if (e && e.hp > 0) {
            e.hp -= fallDmg;
            e.hitFlashUntil = t + 80;
          }
        } else {
          const p = w.props.find(pr => pr.id === tgt.id);
          if (p && p.hp > 0 && !isPropWeaponImmune(p)) {
            p.hp -= fallDmg;
            p.hitFlashUntil = t + 100;
            if (p.hp <= 0) {
              // destroyProp 는 world.ts 내부 함수 — 데미지만 적용하고 파괴는 다음 틱의 prop 검사에 맡긴다
              p.hp = 0;
            }
          }
        }
        // 시각 — 라인 fx
        const ang = Math.atan2(dy, dx);
        const dist = Math.hypot(dx, dy);
        spawnAttackFx({ kind: 'beam', pos: { ...from.pos }, angle: ang, range: dist, color: '#b3ff00', duration: 0.18, thickness: 3 });
        from = { pos: { x: tgt.pos.x, y: tgt.pos.y }, r: tgt.radius };
      }
      spawnAttackFx({ kind: 'flash', pos: { ...w.player.pos }, angle: 0, range: 40, color: '#b3ff00', duration: 0.15, thickness: 0 });
    },
  };
}

// ── 🛡 수호 결계 — 6 태그 모두 보유 시 활성. 플레이어 주변 회전 영역효과 ──
function makeOrbitalShield(cardCount: number): Weapon {
  const dmg = 8 + cardCount * 2;
  return {
    id: 'shield', tag: 'echo', level: 1,
    evolved: true, displayName: '수호 결계',
    desc: '플레이어 주위를 끊임없이 회전하는 네 개의 황금 결계, 가까이 다가오는 영혼을 베고 묶는다',
    damageHint: `회전 데미지 ${dmg.toFixed(0)} · 궤도 반경 90px · 슬로우 30%`,
    evolutionHint: '여섯 태그를 모두 보유한 자만이 얻는, 조화의 길의 증표',
    cooldown: 0, cooldownMax: 0.5,
    apply(w, t) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        spawnAreaEffect(w, {
          pos: { x: w.player.pos.x, y: w.player.pos.y },
          radius: 36, damage: dmg, life: 0.55,
          color: '#ffd700', followPlayer: true, 
          orbitAngle: a, orbitRadius: 90, orbitSpeed: 3.0,
          kind: 'aura',
          slowFactor: 0.7, hitInterval: 0.4,
        });
      }
    },
  };
}

function makeWeapon(tag: CardTag, level: number, _state: GameState): Weapon {
  const synergy3 = level >= 3;
  const synergy5 = level >= 5;
  const synergy7 = level >= 7;

  switch (tag) {
    case 'fire': return makeFire(level, synergy3, synergy5, synergy7);
    case 'ice': return makeIce(level, synergy3, synergy5, synergy7);
    case 'gold': return makeGold(level, synergy3, synergy5, synergy7);
    case 'time': return makeTime(level, synergy3, synergy5, synergy7);
    case 'chaos': return makeChaos(level, synergy3, synergy5, synergy7);
    case 'echo': return makeEcho(level, synergy3, synergy5, synergy7);
  }
}

// ── 🔥 화염 — 플레이어 주변 burning aura (지속 데미지) ──
function makeFire(level: number, s3: boolean, s5: boolean, s7: boolean): Weapon {
  const radius = 70 + level * 14 + (s5 ? 30 : 0);
  // 초반 너프: L1 14→9, L7 50→39 (저레벨이 두드러지게 약해짐)
  const dps = (4 + level * 5) * (s5 ? 1.4 : 1);
  const burnDps = s5 ? dps * 0.6 : 0;
  return {
    id: 'fire', tag: 'fire', level,
    evolved: s5, displayName: s5 ? '불의 심장 (진화)' : s3 ? '화염 오라+ (발화)' : '화염 오라',
    desc: s5
      ? '심장에서 끝없이 솟구치는 검붉은 불의 강 — 닿는 영혼은 발화의 잔열에 천천히 녹아내린다'
      : s3
        ? '한층 사나워진 화염의 결계 — 매 4초마다 진폭하는 격렬한 폭발이 적의 진영을 갈가리 찢는다'
        : '플레이어를 둘러싼 붉은 화염의 결계, 가까이 다가오는 모든 영혼을 천천히 태운다',
    damageHint: `초당 데미지 ${dps.toFixed(0)} · 반경 ${radius}px${s5 ? ` · 발화 잔열 ${burnDps.toFixed(0)}/초` : ''}`,
    evolutionHint: s7
      ? '⭐ 7장 도달 — 불사조의 부활 (5초마다 거대 폭발 + HP 절반 회복 + 1B 코인 폭우)'
      : s5
        ? '🔥 7장 = 불사조의 부활: 거대 폭발과 함께 절반의 생명이 되돌아온다'
        : s3
          ? '🔥 5장 = 진화: 불의 심장 — 데미지 +40% + 발화 잔열 추가'
          : '🔥 3장 = 발화 각성: 4초마다 강력한 폭발이 더해진다',
    cooldown: 0, cooldownMax: s5 ? 0.25 : 0.3,
    apply(w, t) {
      // aura 가 매 프레임 새로 생성되면 비싸므로 — 영속 효과로 1개만 유지
      // weapons array 가 매 PICK_CARD 시 재생성되므로 여기선 매 발사마다 짧은 nova 만 발사
      spawnAreaEffect(w, {
        pos: { x: w.player.pos.x, y: w.player.pos.y },
        radius, damage: dps,
        life: 0.35, color: '#ff2a6d',
        followPlayer: true,
        kind: 'aura',
        slowFactor: 1,
        burnDps,
        hitInterval: 0.25,
      });
      // s3 — 발화 폭발: 4초마다 작은 강한 폭발 추가 (반경 50% / 대미지 2.5x)
      if (s3 && t >= ((w as any)._fire3Ready ?? 0)) {
        (w as any)._fire3Ready = t + 4000;
        spawnAreaEffect(w, {
          pos: { x: w.player.pos.x, y: w.player.pos.y },
          radius: radius * 0.55, damage: dps * 2.5,
          life: 0.3, color: '#ffaa00',
          followPlayer: false, kind: 'nova', slowFactor: 1,
          burnDps: dps * 0.4, hitInterval: 0.1,
        });
        spawnAttackFx({ kind: 'flash', pos: { ...w.player.pos }, angle: 0, range: radius * 0.55, color: '#ffaa00', duration: 0.3, thickness: 0 });
      }
      // 7장 Phoenix — 5초 쿨다운 (이전: 매 발동 → OP). dps 1.5x → 1.0x
      if (s7 && t >= ((w as any)._fire7Ready ?? 0)) {
        (w as any)._fire7Ready = t + 5000;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          spawnProjectile(w, {
            pos: { x: w.player.pos.x, y: w.player.pos.y },
            vel: { x: Math.cos(a) * 360, y: Math.sin(a) * 360 },
            radius: 8, damage: dps * 1.0, life: 0.8, color: '#ff2a6d',
            kind: 'bullet', pierce: 2, homing: false, bounces: 0,
            burnFor: 1.5,
          });
        }
        spawnAttackFx({ kind: 'flash', pos: { ...w.player.pos }, angle: 0, range: 160, color: '#ff2a6d', duration: 0.4, thickness: 0 });
      }
    },
  };
}

// ── ❄️ 얼음 — 주기적 nova (반경 슬로우 + 데미지) ──
// 밸런스 튜닝: 7-tier glacier freeze 가 매 nova 발동 시 트리거되어 OP. 별도 쿨다운 도입.
// 다른 무기와 동일하게 world-scoped 쿨다운 (`(w as any)._ice7Ready`) 사용 — 다음 런에서 carry-over 방지.
function makeIce(level: number, s3: boolean, s5: boolean, s7: boolean): Weapon {
  const radius = 100 + level * 18 + (s5 ? 35 : 0);
  // 초반 너프: L1 11→8 (-30%)
  const dmg = (5 + level * 3) * (s5 ? 1.4 : 1);
  return {
    id: 'ice', tag: 'ice', level,
    evolved: s5, displayName: s5 ? '빙하의 심판 (진화)' : s3 ? '얼음 노바+ (서리 가시)' : '얼음 노바',
    desc: s5
      ? '한 순간 모든 영혼의 시간을 멈추는 거대한 빙하의 심판 — 천 년의 정적이 한꺼번에 내려앉는다'
      : s3
        ? '얼음의 파동이 퍼진 자리에서 솟아나는 네 방향의 날카로운 서리 가시, 닿는 적의 발걸음을 묶는다'
        : '주기적으로 사방으로 퍼지는 차가운 얼음의 파동, 적의 시간을 절반으로 늦춘다',
    damageHint: `데미지 ${dmg.toFixed(0)} · 반경 ${radius}px · 슬로우 ${s5 ? 70 : 40}%`,
    evolutionHint: s7
      ? '⭐ 7장 도달 — 빙하 정지: 3초간 화면 위 모든 시간이 멈춘다 (5초 쿨)'
      : s5
        ? '❄️ 7장 = 빙하 정지: 모든 시간을 3초간 결빙'
        : s3
          ? '❄️ 5장 = 진화: 빙하의 심판 — 데미지 +40% + 슬로우 70%'
          : '❄️ 3장 = 서리 가시: 노바 후 4방향 가시 추가',
    cooldown: 0, cooldownMax: Math.max(1.0, 2.5 - level * 0.18),
    apply(w, t) {
      spawnAreaEffect(w, {
        pos: { x: w.player.pos.x, y: w.player.pos.y },
        radius, damage: dmg, life: 0.5, color: '#05d9e8',
        followPlayer: false,
        kind: 'nova',
        slowFactor: s5 ? 0.3 : 0.6,
        hitInterval: 0.5,
      });
      spawnAttackFx({ kind: 'pulse', pos: { ...w.player.pos }, angle: 0, range: radius, color: '#05d9e8', duration: 0.5, thickness: 0 });
      // s3 — 서리 가시: nova 후 4방향 얼음 가시 (slow 부여)
      if (s3) {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + (rng() - 0.5) * 0.2;
          spawnProjectile(w, {
            pos: { x: w.player.pos.x, y: w.player.pos.y },
            vel: { x: Math.cos(a) * 360, y: Math.sin(a) * 360 },
            radius: 6, damage: dmg * 0.7, life: 1.2, color: '#a8eaff',
            kind: 'bullet', pierce: 1, homing: false, bounces: 0, slowFor: 800,
          });
        }
      }
      // Glacier — 6초 쿨다운, 0.6초 정지
      if (s7 && t >= ((w as any)._ice7Ready ?? 0)) {
        (w as any)._ice7Ready = t + 6000;
        for (const e of w.enemies) e.slowUntil = Math.max(e.slowUntil, t + 600);
        spawnAttackFx({ kind: 'flash', pos: { ...w.player.pos }, angle: 0, range: 250, color: '#05d9e8', duration: 0.5, thickness: 0 });
      }
    },
  };
}

// ── 💰 황금 — 호밍 코인 미사일 ──
function makeGold(level: number, s3: boolean, s5: boolean, s7: boolean): Weapon {
  // s3 — 황금 비: count +1 (도박꾼 — 추가 1발 보장)
  const count = 1 + Math.floor(level / 2) + (s5 ? 2 : 0) + (s3 ? 1 : 0);
  // 초반 너프: L1 18→14 (-22%)
  const dmg = (8 + level * 6) * (s5 ? 1.4 : 1);
  return {
    id: 'gold', tag: 'gold', level,
    evolved: s5, displayName: s5 ? '미다스의 손 (진화)' : s3 ? '황금 미사일+ (도박꾼)' : '황금 미사일',
    desc: s5
      ? '닿는 모든 영혼이 황금으로 변해 두 배의 코인을 토해내는 — 미다스의 손길'
      : s3
        ? '한 발이 더 늘어난 황금의 도박, 호밍 미사일이 비처럼 쏟아진다'
        : '표적을 끝까지 추적하는 황금빛 코인 미사일 — 처치 시 더 많은 코인이 떨어진다',
    damageHint: `발당 데미지 ${dmg.toFixed(0)} · ${count}발 · 호밍 추적`,
    evolutionHint: s7
      ? '⭐ 7장 도달 — 황금비: 단 한 번 1M 코인이 즉시 소환된다'
      : s5
        ? '💰 7장 = 황금비: 즉시 100만 코인'
        : s3
          ? '💰 5장 = 진화: 미다스의 손 — 적 처치 시 코인 두 배'
          : '💰 3장 = 도박꾼: 미사일 +1 (탐욕의 보너스)',
    cooldown: 0, cooldownMax: Math.max(0.3, 1.5 - level * 0.12),
    apply(w, t) {
      // 박스/적 통합 타겟 — 거리만 비교해 더 가까운 쪽부터. 다중 발사 시 같은 대상에 몰리지 않게 제외.
      const enemyFired = new Set<number>();
      const propFired = new Set<number>();
      for (let i = 0; i < count; i++) {
        const tgt = nearestTarget(w, w.player.pos, enemyFired, propFired);
        if (!tgt) break;
        if (tgt.kind === 'enemy') enemyFired.add(tgt.id);
        else propFired.add(tgt.id);
        const dx = tgt.pos.x - w.player.pos.x;
        const dy = tgt.pos.y - w.player.pos.y;
        const d = Math.hypot(dx, dy) || 1;
        spawnProjectile(w, {
          pos: { x: w.player.pos.x, y: w.player.pos.y },
          vel: { x: (dx / d) * 360, y: (dy / d) * 360 },
          radius: 7, damage: dmg, life: 2, color: '#ffd700',
          kind: 'coin', pierce: s5 ? 2 : 0, homing: true, bounces: 0,
        });
      }
      // King Midas — 코인 소나기 (4초 쿨다운, 5발)
      if (s7 && t >= ((w as any)._gold7Ready ?? 0)) {
        (w as any)._gold7Ready = t + 4000;
        for (let i = 0; i < 5; i++) {
          const a = rng() * Math.PI * 2;
          spawnProjectile(w, {
            pos: { x: w.player.pos.x, y: w.player.pos.y },
            vel: { x: Math.cos(a) * 280, y: Math.sin(a) * 280 },
            radius: 8, damage: dmg, life: 1.5, color: '#ffd700',
            kind: 'coin', pierce: 1, homing: true, bounces: 0,
          });
        }
      }
    },
  };
}

// ── ⏱️ 시간 — 슬로우 존 (큰 영역) ──
function makeTime(level: number, s3: boolean, s5: boolean, s7: boolean): Weapon {
  const radius = 130 + level * 18 + (s5 ? 40 : 0);
  // s3 — 시간 정지: rift 슬로우가 거의 정지 수준 (0.05). 단 데미지/적용은 동일.
  const slowFactor = s5 ? 0.2 : (s3 ? 0.1 : 0.5);
  return {
    id: 'time', tag: 'time', level,
    evolved: s5, displayName: s5 ? '시간의 굴레 (진화)' : s3 ? '시간 균열+ (정지)' : '시간 균열',
    desc: s5
      ? '거대한 시간의 굴레가 영혼을 영원에 가까운 정체에 가둔다 — 빠져나갈 수 없는 시공의 사슬'
      : s3
        ? '균열이 깊어져 그 안의 영혼들은 사실상 정지한다, 95% 둔화'
        : '주변 시공간이 일그러지는 보랏빛 시간 균열, 닿는 적의 움직임을 절반으로 가둔다',
    damageHint: `데미지 ${(5 + level * 2)} · 반경 ${radius}px · 슬로우 ${Math.round((1 - slowFactor) * 100)}%`,
    evolutionHint: s7
      ? '⭐ 7장 도달 — 시간 정지: 0.4초 화면 위 모든 시간이 멈춘다 (5초 쿨)'
      : s5
        ? '⏱️ 7장 = 시간 정지: 0.4초 절대 정지'
        : s3
          ? '⏱️ 5장 = 진화: 시간의 굴레 — 거대해진 균열, 영원의 정체'
          : '⏱️ 3장 = 균열 심화: 슬로우 90% (거의 정지)',
    cooldown: 0, cooldownMax: Math.max(1.5, 5 - level * 0.3),
    apply(w, t) {
      // 가장 적 많은 곳(또는 박스) 근처에 시간 균열
      const tgt = nearestTarget(w, w.player.pos);
      const center = tgt ? tgt.pos : w.player.pos;
      spawnAreaEffect(w, {
        pos: { x: center.x, y: center.y },
        radius, damage: 5 + level * 2, life: 3, color: '#d300c5',
        followPlayer: false,
        kind: 'rift',
        slowFactor,
        hitInterval: 0.5,
      });
      // 시간 동결 0.4초 — 5초 쿨다운
      if (s7 && t >= ((w as any)._time7Ready ?? 0)) {
        (w as any)._time7Ready = t + 5000;
        for (const e of w.enemies) e.slowUntil = Math.max(e.slowUntil, t + 400);
      }
    },
  };
}

// ── 🌀 카오스 — 화면 튕기는 발사체 ──
function makeChaos(level: number, s3: boolean, s5: boolean, s7: boolean): Weapon {
  // s3 — 분열: count +2 (혼돈 추가 발사)
  const count = 2 + Math.floor(level / 2) + (s5 ? 2 : 0) + (s3 ? 2 : 0);
  // 초반 너프: L1 26→20 (-23%)
  const dmg = (12 + level * 8) * (s5 ? 1.5 : 1);
  return {
    id: 'chaos', tag: 'chaos', level,
    evolved: s5, displayName: s5 ? '광란의 폭풍 (진화)' : s3 ? '카오스 구체+ (분열)' : '카오스 구체',
    desc: s5
      ? '관통을 멈추지 않는 무한의 카오스 폭풍 — 닿는 모든 것을 꿰뚫고도 사라지지 않는 광기'
      : s3
        ? '구체가 분열하여 두 발이 더 흩어진다, 한층 광폭해진 혼돈의 산란'
        : '예측 불가능한 방향으로 튕겨나가는 오렌지빛 카오스 구체, 네 번이나 벽을 튕긴다',
    damageHint: `발당 데미지 ${dmg.toFixed(0)} · ${count}발 · 관통 ${s5 ? '∞' : 3} · 4회 반사`,
    evolutionHint: s7
      ? '⭐ 7장 도달 — 광란의 폭풍: 추가 8발 + 무작위 카드 효과 발동 (5초 쿨)'
      : s5
        ? '🌀 7장 = 광란 폭풍: 무작위 카드 효과 자동 발동'
        : s3
          ? '🌀 5장 = 진화: 광란 폭풍 — 관통 무한, 모든 것을 꿰뚫는다'
          : '🌀 3장 = 분열의 광기: 발수 +2',
    cooldown: 0, cooldownMax: Math.max(0.4, 1.6 - level * 0.13),
    apply(w, t) {
      for (let i = 0; i < count; i++) {
        const a = rng() * Math.PI * 2;
        spawnProjectile(w, {
          pos: { x: w.player.pos.x, y: w.player.pos.y },
          vel: { x: Math.cos(a) * 320, y: Math.sin(a) * 320 },
          radius: 9, damage: dmg, life: 2.5, color: '#ff6f00',
          kind: 'orb', pierce: s5 ? 99 : 3, homing: false, bounces: 4,
        });
      }
      // 7장 — 카오스 구체 8발 추가 (5초 쿨다운)
      if (s7 && t >= ((w as any)._chaos7Ready ?? 0)) {
        (w as any)._chaos7Ready = t + 5000;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          spawnProjectile(w, {
            pos: { x: w.player.pos.x, y: w.player.pos.y },
            vel: { x: Math.cos(a) * 280, y: Math.sin(a) * 280 },
            radius: 10, damage: dmg * 1.2, life: 3, color: '#ff6f00',
            kind: 'orb', pierce: 5, homing: false, bounces: 6,
          });
        }
      }
    },
  };
}

// ── 🪞 거울 — 다른 무기 효과 복제 ──
function makeEcho(level: number, s3: boolean, s5: boolean, _s7: boolean): Weapon {
  return {
    id: 'echo', tag: 'echo', level,
    evolved: s5, displayName: s5 ? '거울의 미궁 (진화)' : s3 ? '거울 메아리+ (반사탄)' : '거울 메아리',
    desc: s5
      ? '무수한 거울이 무기의 시간을 한층 강하게 가속하는 — 끝없이 반사되는 거울의 미궁'
      : s3
        ? '메아리에 사방으로 흩어지는 네 줄기 반사탄이 더해진다'
        : '플레이어 곁에 머무는 거울의 메아리, 다른 모든 무기의 쿨다운을 미세하게 단축한다',
    damageHint: `쿨 단축 ${Math.round((0.04 + level * 0.04 + (s3 ? 0.05 : 0)) * 100)}% · ${s5 ? '0.5' : '1'}초마다`,
    evolutionHint: '🪞 5장 도달 — 전기 사슬이 자동으로 활성화된다 (보너스 무기)',
    cooldown: 0, cooldownMax: s5 ? 0.5 : 1,
    apply(w, t, _state) {
      // 모든 다른 무기 쿨 (level × 5%) 만큼 앞당김 + s3 시 추가 가속
      const accel = 0.04 + level * 0.04 + (s3 ? 0.05 : 0);
      for (const ww of w.weapons) {
        if (ww.id === 'echo') continue;
        ww.cooldown = Math.max(0, ww.cooldown - accel);
      }
      // s3 — 반사탄: 가장 가까운 적/박스에 거울 발사체 1발 (다른 무기 효과의 메아리)
      if (s3) {
        const tgt = nearestTarget(w, w.player.pos);
        if (tgt) {
          const dx = tgt.pos.x - w.player.pos.x;
          const dy = tgt.pos.y - w.player.pos.y;
          const d = Math.hypot(dx, dy) || 1;
          spawnProjectile(w, {
            pos: { x: w.player.pos.x, y: w.player.pos.y },
            vel: { x: (dx / d) * 380, y: (dy / d) * 380 },
            radius: 7, damage: 6 + level * 4, life: 1.6, color: '#b3ff00',
            kind: 'mirror', pierce: 2, homing: true, bounces: 1,
          });
        }
      }
    },
  };
}

// ─────────────────────────── 매 틱 호출 ───────────────────────────

export function applyWeapons(world: World, dt: number, t: number, state: GameState): void {
  // ⭐ lantern stronghold haste — 무기 cooldown -30%. buffHasteUntil 이 매 0.2s rolling refresh 됨.
  const haste = world.buffHasteUntil > t ? 1.3 : 1;
  const dtEff = dt * haste;
  for (const w of world.weapons) {
    w.cooldown -= dtEff;
    if (w.cooldown <= 0) {
      w.cooldown = w.cooldownMax;
      try {
        w.apply(world, t, state);
        world.player.lastAttackTime = t;
      } catch (err) { console.error('[weapon]', w.id, err); }
    }
  }
}
