# SAMSARA · 윤회 (輪廻)

> **30초마다 새 운명을 짠다 — Every 30 seconds, a new fate.**
>
> DACON 월간 해커톤 출품작 — "10분 안에 중독시켜라" 웹 미니게임 챌린지

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![tests](https://img.shields.io/badge/vitest-207%20passing-brightgreen.svg)](#산출물-요약-검증-가능)
[![bundle](https://img.shields.io/badge/core%20gzip-115KB-blue.svg)](#산출물-요약-검증-가능)
[![lighthouse](https://img.shields.io/badge/FCP-259ms-brightgreen.svg)](#산출물-요약-검증-가능)
[![assets](https://img.shields.io/badge/external%20assets-0%20byte-success.svg)](#라이선스--자산-출처)
[![CI](https://img.shields.io/badge/CI-build%20·%20test%20·%20e2e-blue.svg)](.github/workflows/ci.yml)

---

## 🚀 심사자용 30초 가이드

> **30초 안에 코어 재미를 보여주는 게 우리 약속**입니다. 아래 4줄로 끝납니다.

1. **URL 클릭** → https://samsara-dacon.vercel.app *(배포 예정)* — 로그인/설치/결제 0건.
2. **WASD/방향키 또는 화면 터치 → 호랑이가 자동 공격** (Vampire Survivors 방식, 모바일·데스크톱 동일).
3. **30초마다 카드 1장 선택** — 같은 태그 5장이면 빌드 정체성 발현 (예: 🔥×5 = "불의 황제").
4. **죽으면 RP 적립 → 영구 잠금해제** (윤회). 첫 5런은 RP 보너스 보장 — 짧은 런도 보상.

### 1분 안에 보고 싶다면

- **게임오버 화면**의 "빌드 카드 그리드" + "사망 원인 패널" — 모든 런이 *왜 끝났는지* + *무엇이 누적됐는지* 명시.
- **메인 화면**의 "오늘의 시련" — 매일 자정 모든 플레이어 동일 시드 + 글로벌 리더보드.
- **설정 화면**의 "색약 모드" 토글 + 데미지 숫자 shape 더블코딩 — 접근성.

### 핵심 평가 포인트별 위치 (rubric 100점 ↔ 코드)

| 평가 항목 | 배점 | 어디서 확인 | 검증 방법 |
|---|---|---|---|
| **완성도** | 25 | 207 vitest + 빌드 워닝 0 + 60fps 유지 + CI green | `npm test` → 207 passed / 15 files |
| **참신성** | 20 | **윤회(輪廻): 죽으면 이전 생의 카드가 다음 생으로 계승** + 30초 카드픽 + 28 Run Identity 변신 | `src/data/cards.json` |
| **사용성** | 20 | 첫 입력 < 3초, 첫 보상 < 30초, 색약/모션감쇄 지원 | `src/ui/screens.ts` mountTutorial |
| **일관성** | 20 | docs/ 28종 기획문서 ↔ 코드 1:1, 데이터 주도 설계 | `src/game/cards.ts` (58 op) |
| **재미** | 15 | 콤보 ×3~×500 8단계, 시너지 ULTIMATE, 일일 시드 리더보드 | `src/game/state.ts`, `src/game/boss.ts` |

---

## 🛠️ 기술 디테일 (개발자 심사자 환영)

> 1차 점수 60%가 **다른 출품팀의 표**입니다. 이 섹션의 모든 수치는 `npm install && npm test && npm run build` 로 직접 검증 가능합니다 — 과장 0.

### 데이터 주도 설계 (단일 진실 공급원: `src/data/cards.json`)

| 자원 | 개수 | 비고 |
|---|---|---|
| 카드 | **60장** + 비밀 **5장** | 기본 60 (common 24 / rare 18 / epic 12 / legendary 6, 듀얼 9) · 비밀 5 = 조건 달성 시 풀 합류 (`tests/secret_cards.test.ts`) |
| 시너지 | **18종** | 6태그 × 3티어(3/5/7장). 7장 = ULTIMATE 라우팅 |
| 모디파이어 | **30종** | 축복 / 도전 / 비밀 5. 매 웨이브 무작위 1개 |
| Run Identity | **28종** | 단일 6 + 듀얼 15 + 조화 1 + 궁극 6. 태그 분포 매칭 자동 발현 |
| 업적 | **50개** | progress / collection / build / boss / meta |
| 효과 op | **58종** | JSON `op` 한 단어 → 엔진 핸들러 1:1 |
| 트리거 | **13종** | onTap / onTapNth / onCombo / onComboBreak / onWaveStart … |

> **새 카드 추가 = JSON 한 줄.** 코드 변경 없이 카드/시너지/모디파이어/RI 가 동작합니다 (`tests/cards.test.ts` 가 데이터 적재 ↔ 핸들러 정합성 회귀 가드).

### 엔진 구조 (30초 요약)

```
입력(WASD/터치)                       Web Audio 런타임 합성
   │                                  ┌─ sfx.ts  (72 SFX, 0 byte)
   ▼                                  └─ bgm.ts  (5 레이어, 0 byte)
input.ts ─► state.ts ──EngineEvent──► main.ts ──► render/world.ts (Canvas2D)
            (순수 reducer,  큐         (구독자)     fx/particles.ts (풀 500, GC 0)
             사이드이펙트 0)  │
                             ├─► cards.ts   (58 op 디스패처, 트리거 컨텍스트)
                             ├─► world.ts   (무한 필드 + 13 game-theory props)
                             ├─► terrain.ts (4-옥타브 FBM 노이즈 → 4 biome)
                             └─► bossPatterns.ts (FSM 3패턴 × 텔레그래프)
```

- **순수 reducer + 이벤트 큐** — `state.ts` 는 사이드 이펙트 0. 파티클/사운드/햅틱은 `EngineEvent` 큐로 발행 → `main.ts` 가 구독. reducer 단위 테스트가 게임플레이 전체를 헤드리스로 검증 가능.
- **트리거 컨텍스트 패턴** — 모든 카드 효과가 `(effect, ctx)` 단일 시그니처. `ctx.dispatch()` 로 효과가 다른 효과를 재발행(echo) → 시너지/콤보 누적이 데이터 합성으로 표현.
- **결정론적 일일 시드** — `core.ts` `dailySeed()` = FNV-1a 32-bit(날짜) → mulberry32 RNG. 전 세계가 같은 날 같은 맵/모디파이어/카드풀. 리더보드 공정성의 기반.
- **절차적 지형** — `terrain.ts` 2채널 value-noise + smoothstep + 4-옥타브 FBM → mountain/plains/cursed/sanctuary biome. 외부 라이브러리 0, 결정론적(`tests/terrain.test.ts` 24 spec: 결정론·범위·인접 연속성).
- **게임이론 prop 13종** — 모든 지형지물이 단순 보상이 아닌 **결정 트리**: Stag Hunt(shrine pray) / Risk-Reward(cursed_totem) / Tragedy of Commons(lantern) / Chicken(pressure_plate) / Information Asymmetry(stardust) / Spatial Control(mirror_shard) / Coordination(wreck) — 7개 게임이론 적용 (`tests/props_game_theory.test.ts` 18 spec).
- **보스 패턴 FSM** — `bossPatterns.ts` summon/charge/radial 3패턴 + 텔레그래프 + 무적 가드. normal/mega/divine 보스별 패턴 회전.

### "같은 게임이 다시 안 나온다" — 참신성의 정량적 근거

```
28 Run Identity  ×  30 모디파이어  ×  13 biome-aware prop  ×  365 일일 시드
  + 콤보 8단계 × 18 시너지 라우팅 + 60카드 픽 순열
= 매 런이 구조적으로 다른 게임. (장르: 알려진 로그라이트, 트위스트: 30초 카드 운명)
```

`docs/06_proposal_outline.md §4-1.6` 에 28 RI 전체 카탈로그 + 산출 근거 명시.

### 산출물 요약 (검증 가능)

| 지표 | 수치 | 검증 |
|---|---|---|
| 코어 번들 (gzip) | **113 KB** — 외부 자산 0 byte | `npm run build` → `dist/assets/index-*.js` |
| Supabase 청크 | 52 KB gzip — **lazy**, 리더보드 진입 시만 | 코드 분할, 초기 로드 미포함 |
| 단위/통합 테스트 | **196 passed / 15 files** | `npm test` |
| E2E smoke (모바일 UA) | http 200 / load < 1.1s / 콘솔 errors+warnings 0 | `npm run test:e2e` |
| 심사자 첫 인상 봇 (32s 입력 sim) | 콘솔 errors 0 / W1 진입 / canvas 등장 < 5s | `npm run test:impression` |
| Lighthouse-lite (mobile) | FCP **259ms** / CLS **0** / a11y clean / long-task ≤ 1 | `npm run test:lh` |
| 회귀 가드 | i18n 동기 / 점수 폭주 / 보스 FSM / 지형 결정론 / 모디파이어 이중적용 | `tests/` |
| TypeScript | **strict** 모드, 빌드 워닝 0 | `npm run build` |
| 헤드리스 밸런스 | `scripts/balance-sim.ts` 자동 플레이어 RI별 점수 측정 | `npx tsx scripts/balance-sim.ts` |
| 외부 의존성 | Vite, Vitest, Playwright (dev), Supabase JS (RLS만, 키 노출 OK) | `package.json` |
| CI/CD | GitHub Actions: build · test · e2e · impression 4 게이트 | `.github/workflows/ci.yml` |

### 백엔드 (Supabase, 키 노출형 RLS)

```sql
-- public read, validated insert. anon key 가 노출돼도 안전.
create policy "lb_read"   on leaderboard for select using (true);
create policy "lb_insert" on leaderboard for insert with check (
  length(nickname) between 1 and 16
  and score > 0 and score < 1000000000000000000
);
```

키 없이도 동작 (graceful degradation → 로컬 랭킹). **DACON 규정 "외부 키 없이 작동" 충족** — 심사자가 키 없이 전부 확인 가능.

### 접근성 (a11y)

- `prefers-reduced-motion` / `prefers-contrast` 감지 → 카메라 셰이크/플래시 자동 감쇄
- 색약 모드 (설정 토글) — 빨강 → 주황(#ff6b35), 시안 → 노랑(#fff352)
- 데미지 숫자 shape 더블코딩 (●○◆◇★) — 색만으로 정보 전달 안 함
- 키보드 / 마우스 / 터치 모두 1급 입력 (iOS notch safe-area, 16px input zoom 방지, 가상 조이스틱 곡선 응답)
- i18n 한/영 완비 (`src/data/i18n/{ko,en}.json` 각 112 키, `tests/i18n_sync.test.ts` 가 키 동기 회귀 가드)

### 라이선스 안전성 (저작권 분쟁 가능성 0)

- 모든 코드 MIT (이 저장소)
- 폰트 OFL (Pretendard, Galmuri11)
- 호랑이 등 스프라이트 SVG 자체 제작 (한국 호랑이 모티브 도트)
- SFX 72종 + BGM 5 레이어 **외부 자산 0 byte** — 전부 Web Audio 런타임 합성 (BFXR/Beepbox 스타일 파라미터)
- GPL 의존성 0, 출처 표기 의무 자산 0 (`docs/12_assets_licensing.md` 인벤토리)

---

## 게임 컨셉

**"30초마다 새 운명을 짠다"** — 30초 단위 사이클, 매 사이클 끝에 카드 1장 선택, 같은 태그 5장이 모이면 빌드 정체성(Run Identity)이 발현되고 호랑이가 영구 변신한다.

### 6 태그 × 60 카드

```
🔥 fire   ❄️ ice    💰 gold
⏱️ time   🌀 chaos  🪞 echo
```

### 도파민 7 레이어 (누적)

1. **탭/처치 피드백** — hitstop, ripple, squash, 색 플래시, 파티클, 숫자 팝업, 콤보 pitch ladder
2. **콤보 캐스케이드** — ×3 / ×5 / ×10 / ×25 / ×50(FRENZY) / ×100(GOD) / ×200 / ×500
3. **카드 시너지** — 같은 태그 3/5/7장 자동 발동. 7장 = ULTIMATE (태그별 분기 라우팅)
4. **모디파이어 룰렛** — 매 웨이브 30종 중 무작위 1개
5. **보스 + 의식** — W5/15/30 일반, W10/20/35 메가, W25/50/75 신성. 격파 시 영구 런 버프 3장 중 1장
6. **메타 RP** — 게임 오버 → RP → 카드/모디/스킨/BGM/시작 보너스 영구 잠금해제
7. **일일 시드 + 글로벌 리더보드** — 매일 자정 모든 플레이어 동일 시드, Supabase 익명

---

## 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 코어 | TypeScript (strict) + Vite | 정적 호스팅, 빠른 LCP |
| 렌더 | Canvas 2D + DOM | 60fps 파티클 풀 + 시맨틱 UI |
| 오디오 | Web Audio API | **자산 0 byte** — 72 SFX + 5 레이어 BGM 런타임 합성 |
| 폰트 | Pretendard + Galmuri11 | OFL 한국어 (본문 + 도트) |
| 호스팅 | Vercel | 정적 + Edge |
| 백엔드 | Supabase (RLS, 익명) | 일일 시드 리더보드, lazy 청크 |

---

## 로컬 개발 / 직접 검증

```bash
npm install
npm test                  # vitest — 196 passed / 15 files
npm run build             # tsc(strict) + vite build → dist/, 워닝 0
npm run dev               # http://localhost:5173
npm run preview           # 빌드 결과 미리보기 — http://localhost:4173
npm run test:e2e          # Playwright smoke — 콘솔 errors/warnings 0 게이트
npm run test:impression   # 심사자 첫 32초 인상 봇
npm run test:lh           # Lighthouse-lite — FCP/LCP/CLS/번들/a11y
npm run test:all          # build + test + e2e + impression + lh (CI 동등)
npm run demo:record       # 시연 영상 헤드리스 폴백 녹화 (75초 webm + 컷 메타)
npx tsx scripts/balance-sim.ts  # 헤드리스 밸런스 시뮬레이션
```

### 디렉터리

```
src/
├── audio/     # sfx.ts (72 SFX 합성) · bgm.ts (5 레이어 합성)
├── data/      # cards.json (60+5+18+30+28+50) · sfx.json (72) · i18n/{ko,en}
├── fx/        # particles(풀500) · highlight · share · hotspot
├── game/      # cards · state · core · world · terrain · boss · bossPatterns · modifiers
├── render/    # world.ts (Canvas2D) · attacks.ts
├── runtime/   # errorBoundary · canvasGuard · gameRuntime
├── services/  # leaderboard (Supabase) · analytics (로컬 익명 큐)
├── ui/        # router · screens (12 화면)
└── main.ts    # 부트스트랩 + EngineEvent 구독 + juice
docs/          # 기획·전략 문서 28종
scripts/       # balance-sim · build-proposal-pdf · e2e-smoke · e2e-impression · lighthouse-lite · demo-record · judge-session · check-sfx-orphans
tests/         # vitest 15 파일 / 196 spec
.github/       # workflows/ci.yml (build · test · e2e · impression)
```

### 핵심 파일 빠른 참조

| 무엇이 궁금? | 어디 |
|---|---|
| 60카드 + 18시너지 + 30모디 + 28RI 데이터 | `src/data/cards.json` |
| 카드 효과 엔진 (58 op 디스패처) | `src/game/cards.ts` |
| 게임 상태 reducer (사이드이펙트 0) | `src/game/state.ts` |
| RAF 게임 루프 + FNV-1a 일일 시드 | `src/game/core.ts` |
| 무한 필드 + 13 game-theory props | `src/game/world.ts` |
| 절차적 biome 지형 (FBM 노이즈) | `src/game/terrain.ts` |
| 보스 패턴 FSM | `src/game/bossPatterns.ts` |
| 게임 컨셉 (10/10 풀 사양) | `docs/05_concept_selected.md` |
| 기획서 본문 (28 RI 카탈로그) | `docs/06_proposal_outline.md` |

---

## 배포 (Vercel)

```bash
npx vercel link
npx vercel env add VITE_SUPABASE_URL       # 선택 — 없으면 로컬 랭킹
npx vercel env add VITE_SUPABASE_ANON_KEY  # 선택
npx vercel --prod
```

### Supabase SQL (한 번 실행)

```sql
create table if not exists leaderboard (
  id bigint primary key generated by default as identity,
  date_seed text not null,
  nickname text not null check (length(nickname) between 1 and 16),
  score bigint not null check (score > 0 and score < 1000000000000000000),
  run_identity text,
  card_ids text[],
  created_at timestamptz default now()
);
create index if not exists idx_leaderboard_date_score on leaderboard(date_seed, score desc);
alter table leaderboard enable row level security;
create policy "lb_read" on leaderboard for select using (true);
create policy "lb_insert" on leaderboard for insert with check (
  length(nickname) between 1 and 16 and score > 0 and score < 1000000000000000000
);
```

> Supabase 환경변수 없이도 배포·플레이 가능 — 리더보드만 로컬 랭킹으로 graceful degradation.

---

## 라이선스 / 자산 출처

- **코드**: MIT
- **폰트**: Pretendard (OFL), Galmuri11 (OFL)
- **스프라이트 SVG**: 자체 제작 (한국 호랑이/까치/도깨비/구미호/용 모티브 도트)
- **SFX 72종**: BFXR 스타일 파라미터 + Web Audio 런타임 합성 — **외부 자산 X**
- **BGM 5 레이어**: Beepbox 스타일 chiptune Web Audio 런타임 합성 — **외부 자산 X**

> 모든 자산이 자체 제작 또는 OFL/MIT. 출처 표기 의무 자산 0, GPL 의존성 0. 상세: `docs/12_assets_licensing.md`.

---

## 마감 / 일정

- ✅ 2026-05-26 10:00 — 기획서 PDF 제출 완료 (`docs/06_proposal_outline.pdf` 28p / 1.29 MB)
- ⏳ 2026-06-08 10:00 — 최종 산출물 (배포 URL + GitHub + YouTube)
- 2026-06-08 ~ 06-12 — 1차 대중 투표 (제출팀 60% / 참가팀 20% / 대중 20%)
- 2026-06-12 ~ 06-19 — 2차 내부 정성 평가 (최종 순위 결정)

---

## 크레딧

- 개발 / 기획 / 디자인 — DACON 닉네임2
- AI 페어 프로그래밍 — Claude Code (Opus 4.7)

## 문의 / 피드백

GitHub Issues 또는 DACON 토론 채널.
