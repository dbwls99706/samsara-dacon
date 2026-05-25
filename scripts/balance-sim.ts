// SAMSARA · 윤회 — 밸런스 시뮬레이터
//
// 헤드리스로 자동 플레이어 N 런 → RI별 평균 점수 / 생존 / 카드 픽률 측정.
// 사용: `npx tsx scripts/balance-sim.ts [runs=200] [maxWaves=8]`
//
// 자동 플레이어 정책:
//  - 60fps 시뮬, 가장 가까운 적을 향해 지그재그 이동
//  - 카드 선택 시 최우선 태그를 강화 (탐욕 알고리즘)
//  - 보스 페이즈에선 정지 사격
//
// 무기 데미지/적 HP/카드 효과는 실제 게임 코드를 그대로 호출 → 결과는 곧 실제 밸런스.

import { newGameState, setRngSeed, drawCards, evalRunIdentity, formatNum } from '../src/game/cards.js';
import { reduce } from '../src/game/state.js';
import { applyWeapons, buildWeapons, type CharacterId } from '../src/game/weapons.js';
import { createWorld, tickWorld, type World } from '../src/game/world.js';
import type { Card, GameState } from '../src/game/types.js';

interface RunResult {
  seed: number;
  character: CharacterId;
  finalScore: number;
  wave: number;
  surviveSec: number;
  cards: string[];
  runIdentity: string | null;
  dominantTag: string;
}

function pickBestCard(state: GameState, choices: Card[]): Card {
  // 가장 많은 태그 카운트의 태그를 우선 → 시너지 도달 가속
  const tagCounts: Record<string, number> = {};
  for (const c of state.cards) for (const t of c.tags) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  let best = choices[0];
  let bestScore = -1;
  for (const c of choices) {
    let score = 0;
    for (const t of c.tags) score += (tagCounts[t] ?? 0) + 1;
    // 같은 점수면 rare 보다 legendary 선호
    score *= (c.rarity === 'legendary' ? 1.5 : c.rarity === 'epic' ? 1.2 : c.rarity === 'rare' ? 1.05 : 1);
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

function aiMove(world: World, dt: number): { x: number; y: number } {
  // 가장 가까운 적과 일정 거리 유지 (200~280px)
  let nearest = null as any; let nd = Infinity;
  for (const e of world.enemies) {
    if (e.hp <= 0) continue;
    const dx = e.pos.x - world.player.pos.x;
    const dy = e.pos.y - world.player.pos.y;
    const d = dx * dx + dy * dy;
    if (d < nd) { nd = d; nearest = e; }
  }
  if (!nearest) return { x: 0, y: 0 };
  const dx = nearest.pos.x - world.player.pos.x;
  const dy = nearest.pos.y - world.player.pos.y;
  const d = Math.sqrt(nd);
  const ideal = 240;
  const dir = d < ideal ? -1 : 1;
  const t = world.fieldTime;
  // 지그재그 회피 (60도 회전 + 직선 dir)
  const ang = Math.atan2(dy, dx) + Math.sin(t * 2) * 0.6;
  return { x: Math.cos(ang) * dir, y: Math.sin(ang) * dir };
}

function runOne(seed: number, character: CharacterId, maxWaves: number): RunResult {
  setRngSeed(seed);
  let state = newGameState({});
  let world = createWorld();
  const fixedDt = 1 / 60;
  let t = 0;

  for (let wave = 1; wave <= maxWaves; wave++) {
    state = reduce(state, { type: 'START_WAVE', wave }).state;
    world.weapons = buildWeapons(state.cards, state, character);

    while (state.waveTimeRemaining > 0 && state.life > 0) {
      t += fixedDt * 1000;
      const input = aiMove(world, fixedDt);
      const events = tickWorld(world, fixedDt, t, state, input, applyWeapons, false);
      // events 처리 — reducer 와 동일하게 매핑
      for (const ev of events) {
        if (ev.type === 'enemyKill') {
          state = reduce(state, { type: 'ENEMY_KILLED', coins: ev.payload.coin, streak: ev.payload.streak }).state;
        } else if (ev.type === 'pickup') {
          state = reduce(state, {
            type: 'PICKUP',
            coins: ev.payload.kind === 'coin' ? ev.payload.value : 0,
            xp: ev.payload.kind === 'xp' ? ev.payload.value : 0,
            kind: ev.payload.kind,
          }).state;
        } else if (ev.type === 'playerHit') {
          state = reduce(state, { type: 'PLAYER_HIT', dmg: ev.payload.dmg }).state;
        } else if (ev.type === 'bossKill') {
          state = reduce(state, { type: 'BOSS_DEFEATED', timeUsed: state.waveTimeMax - state.waveTimeRemaining }).state;
        }
      }
      state = reduce(state, { type: 'TICK', dt: fixedDt, t }).state;

      // 레벨업 자동 카드 픽
      while (world.pendingLevelUps > 0) {
        world.pendingLevelUps -= 1;
        const choices = drawCards(3);
        if (choices.length === 0) break;
        const pick = pickBestCard(state, choices);
        state = reduce(state, { type: 'PICK_CARD', card: pick }).state;
        world.weapons = buildWeapons(state.cards, state, character);
      }
    }

    if (state.life <= 0) break;

    // 웨이브 끝 → 카드 선택
    if (state.phase === 'cardPick') {
      const choices = drawCards(3);
      if (choices.length > 0) {
        const pick = pickBestCard(state, choices);
        state = reduce(state, { type: 'PICK_CARD', card: pick }).state;
        world.weapons = buildWeapons(state.cards, state, character);
      }
    }
  }

  const ri = evalRunIdentity(state.cards);
  const tagCount: Record<string, number> = {};
  for (const c of state.cards) for (const tg of c.tags) tagCount[tg] = (tagCount[tg] ?? 0) + 1;
  const dominantTag = Object.entries(tagCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-';

  return {
    seed,
    character,
    finalScore: state.totalScore + state.coins,
    wave: state.wave,
    surviveSec: t / 1000,
    cards: state.cards.map(c => c.id),
    runIdentity: ri?.id ?? null,
    dominantTag,
  };
}

function main() {
  const argRuns = parseInt(process.argv[2] ?? '200', 10);
  const argWaves = parseInt(process.argv[3] ?? '8', 10);
  const characters: CharacterId[] = ['tiger', 'magpie', 'dokkaebi', 'gumiho', 'dragon'];
  const results: RunResult[] = [];

  console.log(`[sim] runs=${argRuns}, maxWaves=${argWaves}, chars=${characters.join(',')}`);
  const t0 = Date.now();
  for (let i = 0; i < argRuns; i++) {
    const ch = characters[i % characters.length];
    results.push(runOne(i + 1000, ch, argWaves));
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${argRuns}`);
  }
  console.log(`[sim] ${argRuns} runs done in ${(Date.now() - t0) / 1000}s\n`);

  // 집계 — RI별
  const byRI: Record<string, RunResult[]> = {};
  for (const r of results) {
    const key = r.runIdentity ?? '(none)';
    (byRI[key] ??= []).push(r);
  }
  console.log('=== RI 별 평균 ===');
  const riStats: Array<{ ri: string; n: number; mean: number; median: number; survive: number }> = [];
  for (const [ri, rs] of Object.entries(byRI)) {
    const scores = rs.map(r => r.finalScore).sort((a, b) => a - b);
    const mean = scores.reduce((s, x) => s + x, 0) / scores.length;
    const median = scores[Math.floor(scores.length / 2)];
    const survive = rs.reduce((s, r) => s + r.surviveSec, 0) / rs.length;
    riStats.push({ ri, n: rs.length, mean, median, survive });
  }
  riStats.sort((a, b) => b.mean - a.mean);
  for (const s of riStats) {
    console.log(`  ${s.ri.padEnd(28)} n=${String(s.n).padStart(3)}  mean=${formatNum(Math.round(s.mean)).padStart(8)}  median=${formatNum(Math.round(s.median)).padStart(8)}  survive=${s.survive.toFixed(1)}s`);
  }

  // 캐릭터별 평균
  console.log('\n=== 캐릭터 별 평균 ===');
  const byChar: Record<string, RunResult[]> = {};
  for (const r of results) (byChar[r.character] ??= []).push(r);
  for (const [ch, rs] of Object.entries(byChar)) {
    const mean = rs.reduce((s, r) => s + r.finalScore, 0) / rs.length;
    const survive = rs.reduce((s, r) => s + r.surviveSec, 0) / rs.length;
    console.log(`  ${ch.padEnd(10)} n=${rs.length}  mean=${formatNum(Math.round(mean)).padStart(8)}  survive=${survive.toFixed(1)}s`);
  }

  // 격차 진단
  if (riStats.length >= 2) {
    const top = riStats[0].mean;
    const bot = riStats[riStats.length - 1].mean;
    const ratio = bot > 0 ? top / bot : Infinity;
    console.log(`\n=== 격차 ===`);
    console.log(`  최고/최저 점수 비율: ${ratio.toFixed(2)}x  (목표: ≤ 2.0x)`);
    if (ratio > 2.0) console.log(`  ⚠ 밸런스 조정 필요 — top=${riStats[0].ri}, bot=${riStats[riStats.length - 1].ri}`);
    else console.log(`  ✓ 격차 양호`);
  }

  // 카드 픽률
  console.log('\n=== 카드 픽률 (상위 10) ===');
  const cardCount: Record<string, number> = {};
  for (const r of results) for (const c of r.cards) cardCount[c] = (cardCount[c] ?? 0) + 1;
  const totalCards = Object.values(cardCount).reduce((s, x) => s + x, 0);
  const cardRanking = Object.entries(cardCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [id, n] of cardRanking) {
    console.log(`  ${id.padEnd(6)} ${n}회 (${(n / totalCards * 100).toFixed(1)}%)`);
  }
}

main();
