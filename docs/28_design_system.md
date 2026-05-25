# 28. SAMSARA Design System (디자인 시스템 카탈로그)

> 토큰 SSOT: `src/styles/tokens.css` — 색·타입·스페이싱·모션·엘리베이션·z-index 모두 여기서.
> 컴포넌트: `src/styles/components.css` — `.btn`, `.panel`, `.card-mini`, `.badge` 등 재사용 클래스.
> 애니메이션: `src/styles/animations.css` — `@keyframes` 통합 + `.anim-*` 유틸.
>
> **결정 룰**: 색·치수·시간 값을 코드에 하드코딩하지 말고 항상 `var(--...)` 참조한다.
> tokens.css 에 없으면 **추가한 뒤** 사용한다. 인라인 cssText 신규 도입 금지 (기존 화면 유지보수만 허용).

---

## 0. 디자인 원칙 (5)

1. **신비롭지만 명료하다.** 네오펑크 글로우 + 한국 모티브 캐릭터, 그러나 정보 위계는 절대 흐리지 않는다.
2. **3초 안에 첫 입력, 30초 안에 첫 보상**: 가장 빛나는 색(`--gold`/`--fire`)은 보상·임계 순간에만 쓴다. 일상 UI는 차분한 시안/보라.
3. **태그 색은 의미다.** `--fire`/`--ice`/`--gold`/`--time`/`--chaos`/`--echo` 6색은 **카드 태그 = 무기 = 시너지** 시각적으로 일관 매칭. 다른 의미로 재사용 금지.
4. **모션은 페이즈 신호**: 발아(W1-3) 에선 잔잔, 개화(W4-8)에선 펄스, 승천(W9+)에선 카메라 흔들림 + glow lg.
5. **접근성 기본값**: `prefers-reduced-motion`, `prefers-contrast`, 16px 인풋, 색맹 백업(아이콘/모양) 항상 켜둔다.

---

## 1. Color (`tokens.css` §1)

### 1.1 Palette

| 토큰 | 값 | 사용처 |
|---|---|---|
| `--bg` | `#0a0a1a` | 메인 배경 (모든 화면) |
| `--bg-elevated` | `#02010a` | 시네마틱 풀스크린 (home / transcend) |
| `--surface` | `#14142a` | 카드/패널 1단계 |
| `--surface-2` | `#1f1f3d` | 보더/구분선/패널 2단계 |
| `--surface-3` | `#2a2a52` | 호버/선택 강조 |
| `--text` | `#f0f0ff` | 본문 |
| `--text-strong` | `#ffffff` | 헤드라인 / 결정적 강조 |
| `--text-dim` | `#8888aa` | 보조 / 캡션 |
| `--text-mute` | `#5a5a78` | 비활성 / 메타 |

### 1.2 Tag Colors (의미 고정)

| 태그 | 토큰 | dim 변형 | 의미 |
|---|---|---|---|
| 🔥 fire | `--fire` `#ff2a6d` | `--fire-dim` | 화력 / 콤보 / 폭발 |
| ❄️ ice | `--ice` `#05d9e8` | `--ice-dim` | 빙결 / 시간 정지 / 정보 |
| 💰 gold | `--gold` `#ffd700` | `--gold-dim` | 보상 / 점수 / 황금 트레일 |
| ⏱️ time | `--time` `#d300c5` | `--time-dim` | 시간 가속/되감기 |
| 🌀 chaos | `--chaos` `#ff6f00` | `--chaos-dim` | 무작위 / 모디파이어 |
| 🪞 echo | `--echo` `#b3ff00` | `--echo-dim` | 복제 / 반향 |

> **금지**: tag 색을 "그냥 예뻐서" UI 강조에 쓰지 말 것. 의미 혼동 → 평가 일관성 -20점 직격.

### 1.3 Rarity (카드 등급)

`--rare` `#4a90e2` · `--epic` `#b14aff` · `--legendary` `#ffaa00`
별칭 `--rarity-c/r/e/l` 사용 가능. 레전더리는 `--glow-legendary` 셰도우 자동 페어링.

### 1.4 Semantic

`--ok` `--warn` `--bad` `--info`(ice 별칭). 상태 전용 — 브랜드용 사용 금지.

### 1.5 Overlay & Glass

- `--overlay-soft/medium/hard`: 어둠 오버레이 50%/75%/92%
- `--glass-thin/glass/glass-strong`: 흰색 4%/8%/14% (아이스/유리 패널)

### 1.6 Gradients

- `--grad-brand`: 브랜드 (fire→ice→gold) — 로고/타이틀
- `--grad-fire/ice/gold`: 태그 페어 — 버튼/CTA
- `--grad-bg`: 메인 배경 라디얼
- `--grad-cinematic`: 부트/홈 라디얼

---

## 2. Typography (`tokens.css` §2)

### 2.1 Family

| 토큰 | 폰트 | 용도 |
|---|---|---|
| `--font-body` | Pretendard | 본문, 한글 가독 |
| `--font-pixel` | Galmuri11 | 픽셀 헤딩, 버튼 라벨 |
| `--font-mono` | Galmuri11 (mono fallback) | 숫자, 코드, kbd |

### 2.2 Scale (Body, clamp 반응형)

| 토큰 | 모바일 | 데스크톱 |
|---|---|---|
| `--fs-xs` | 10px | 11px |
| `--fs-sm` | 11px | 13px |
| `--fs-md` | 13px | 15px |
| `--fs-base` | 14px | 16px |
| `--fs-lg` | 16px | 18px |
| `--fs-xl` | 18px | 22px |
| `--fs-2xl` | 22px | 32px |
| `--fs-3xl` | 28px | 44px |
| `--fs-4xl` | 36px | 56px |
| `--fs-display` | 44px | 80px |

### 2.3 Pixel Scale (정수, Galmuri 권장)

`--fp-8` `--fp-10` `--fp-12` `--fp-14` `--fp-18` `--fp-24`

### 2.4 Weight / Leading / Tracking

- Weight: `--fw-regular` `--fw-medium` `--fw-bold` `--fw-black`
- Leading: `--lh-tight 1.1` / `--lh-snug 1.3` / `--lh-normal 1.5` / `--lh-relaxed 1.7`
- Tracking: `--ls-tight` (-0.01em) / `--ls-normal` / `--ls-wide` (0.05em) / `--ls-wider` (0.12em) / `--ls-widest` (0.25em)

### 2.5 사용 가이드

- 한글 본문은 `--font-body` + `--lh-normal` + `--ls-normal`
- 픽셀 라벨/CTA는 `--font-pixel` + `--ls-wider` 이상 (자간 좁으면 도트 뭉침)
- 숫자 카운터/타이머는 `--font-mono` + 고정 폭

---

## 3. Space (`tokens.css` §3)

### 3.1 4-base scale

| 토큰 | px |
|---|---|
| `--sp-1` | 2 |
| `--sp-2` | 4 |
| `--sp-3` | 8 |
| `--sp-4` | 12 |
| `--sp-5` | 16 |
| `--sp-6` | 20 |
| `--sp-7` | 24 |
| `--sp-8` | 32 |
| `--sp-10` | 40 |
| `--sp-12` | 48 |
| `--sp-16` | 64 |

### 3.2 Viewport-aware

- `--sp-vw-sm`: clamp(8, 1.4vw, 12)
- `--sp-vw-md`: clamp(12, 2.0vw, 20)
- `--sp-vw-lg`: clamp(20, 3.0vw, 32)

> 패널 내부 패딩은 `--sp-vw-md` 기본. 좁은 화면에서 자동 축소.

### 3.3 Safe Area

`--safe-top/bottom/left/right` — iOS notch / Android gesture-bar.
HUD 상하 padding/inset 반드시 사용 (이미 `index.html`에 적용).

---

## 4. Radius (`tokens.css` §4)

`--r-xs 2` · `--r-sm 4` · `--r-md 8` · `--r-lg 12` · `--r-xl 16` · `--r-2xl 24` · `--r-pill 999` · `--r-full 50%`

기본 패널/카드 = `--r-lg`. 버튼 = `--r-md`. 배지 = `--r-pill`.

---

## 5. Elevation & Glow (`tokens.css` §5)

### 5.1 Shadow (수직 깊이)

`--shadow-1`/`-2`/`-3`/`-4` — 1=hairline, 4=floating modal.

### 5.2 Tag Glow (발광)

각 태그별 `sm`/`md`/`lg` 3단계:
- fire: `--glow-fire-sm/md/lg`
- ice: `--glow-ice-sm/md/lg`
- gold: `--glow-gold-sm/md/lg`
- time/chaos/echo: `sm` 만 (시너지 보조용)
- legendary: `--glow-legendary` (호박색 펄스)

### 5.3 Inner

`--inset-highlight` (1px 흰색 inset) / `--inset-soft` (1px top inset).
버튼 primary 에 페어링하면 미세 반사광 + 입체감.

---

## 6. Motion (`tokens.css` §6)

### 6.1 Duration

| 토큰 | 값 | 사용처 |
|---|---|---|
| `--dur-instant` | 80ms | 탭 hitstop, micro feedback |
| `--dur-fast` | 150ms | hover, focus |
| `--dur-base` | 250ms | panel transition |
| `--dur-slow` | 400ms | screen enter |
| `--dur-slower` | 600ms | meta achievement toast |
| `--dur-cinema` | 900ms | transcend, boss spawn |

### 6.2 Easing

- `--ease-out` (기본): UI 진입, 패널 등장
- `--ease-in`: UI 퇴장, 페이드아웃
- `--ease-in-out`: 양방향 자연 (펄스, 호흡)
- `--ease-bounce`: badge bounce, achievement
- `--ease-snap`: 카드 픽 줌 (강한 응답감)

### 6.3 prefers-reduced-motion

자동으로 모든 `--dur-*` 가 1ms 로 떨어지므로 별도 처리 불필요.
**단** 핵심 액션 피드백(hitstop / 비네팅)은 컴포넌트 단위로 조건 분기 (`body.perf #lowhp.active` 등).

---

## 7. Z-index (`tokens.css` §7)

`--z-canvas 0` < `--z-world-fx 1` < `--z-hud 10` < `--z-popup 20` < `--z-overlay 30` < `--z-modal 40` < `--z-toast 50` < `--z-boot 999`

**규칙**: z-index 새로 도입 금지. 토큰 사용. 새 레이어가 필요하면 토큰 추가 후 사용.

---

## 8. Components (`components.css`)

### 8.1 Button

```html
<button class="btn">기본</button>
<button class="btn btn-primary">결정적 액션</button>
<button class="btn btn-ghost">보조</button>
<button class="btn btn-danger">파괴적</button>
<button class="btn btn-huge btn-primary">시작</button>
```

크기: `.btn-sm` / `.btn-lg` / `.btn-huge`.
상태: `disabled` 속성 또는 `.is-disabled` 클래스.

### 8.2 Panel

```html
<div class="panel">기본 (surface)</div>
<div class="panel-glass">유리 효과 (블러)</div>
<div class="panel-elevated">엘리베이티드 (그림자)</div>
```

### 8.3 HUD Tile

```html
<div class="hud-tile gold">
  <div class="label">SCORE</div>
  <div class="value">12,345</div>
</div>
```

`.gold` `.fire` 변형 가능.

### 8.4 Badge

```html
<span class="badge badge-ok">PERFECT</span>
<span class="badge badge-gold">+1.2k</span>
```

### 8.5 Combo Tag

```html
<span class="combo-tag tier-frenzy">×100 콤보</span>
```

티어: `tier-mid` (×25) / `tier-frenzy` (×100) / `tier-god` (×500).

### 8.6 Identity Banner / Modifier Banner

```html
<div class="identity-banner">불의 황제 발현</div>
<div class="modifier-banner">화염 강화 +25%</div>
```

### 8.7 Card Mini / Card Big

```html
<div class="card-mini" data-tag="fire">
  <span class="tag">🔥</span>
  <div class="name">불꽃 인장</div>
  <div class="desc">탭당 +1</div>
</div>

<div class="card-big" data-rarity="legendary">…</div>
```

### 8.8 Screen Title

```html
<h2 class="screen-title">의식의 시간</h2>
<h2 class="screen-title gold">전설의 카드</h2>
<h2 class="screen-title death">윤회</h2>
```

### 8.9 Progress

```html
<div class="progress thick">
  <div class="fill" style="width:65%"></div>
</div>
```

### 8.10 KBD

```html
<span class="kbd">W</span> <span class="kbd">A</span> <span class="kbd">S</span> <span class="kbd">D</span>
```

### 8.11 Toast

`.toast` 는 자동으로 하단 중앙 + safe-area 보정. 5초 후 직접 제거 (animations.css 의 `toast-rise` 사용).

### 8.12 Divider / Scanline / Stars

`.divider` (옵션 `.fire`/`.ice`/`.gold`), `.scanline`, `.bg-stars`.

### 8.13 Utility

- 태그 색: `.t-fire .t-ice .t-gold .t-time .t-chaos .t-echo`
- 배경: `.bg-surface .bg-bg .bg-glass .bg-overlay`
- 모션: `.anim-fade-in .anim-slide-up .anim-panel-rise .anim-pulse .anim-float`

---

## 9. Animations (`animations.css`)

| 키프레임 | 사용처 |
|---|---|
| `logo-pulse` | 로고/타이틀 발광 호흡 |
| `title-glow` | 메인 타이틀 fire↔ice 글로우 |
| `title-letter` | 글자 stagger 진입 |
| `panel-rise` | 패널 페이드 + 위로 |
| `combo-pulse` | 콤보 태그 펄스 |
| `badge-bounce` | 배지 통통 |
| `float-up` | 데미지/코인 숫자 떠오름 |
| `ripple` | 탭 링 |
| `hotspot` | 황금 영역 호흡 |
| `tap-bounce` | 호랑이 탭 반응 |
| `legendary-shimmer` | 전설 카드 |
| `identity-glow` | Run Identity 발현 배너 |
| `ritual-pulse` | 의식 화면 라디얼 |
| `card-shimmer` / `card-pulse-border` | 카드 hover 강조 |
| `stars` / `nebula-drift` / `shooting-star` | 배경 우주 |
| `scan-line` | CRT 스캔라인 |
| `orbit` / `float` / `twinkle` / `pulse` | 일반 |
| `boot-spin` / `fade-out` / `fade-in` / `slide-up` / `toast-rise` | 부트/전환 |
| `lowhp-breathe` | 라이프 1 비네팅 |

---

## 10. 화면별 토큰 사용 매트릭스

| 화면 | 배경 | 주 텍스트 | 강조 색 | 모션 |
|---|---|---|---|---|
| Home | `--bg-elevated` + `--bg-stars` | `--text` | `--grad-brand` 로고 | logo-pulse + nebula |
| Tutorial | `--bg` + scanline | `--text-dim` 가이드 | `--ice` 키 표시 | slide-up |
| Play (Canvas HUD) | 캔버스 + `--overlay-medium` HUD | `--text` | `--gold` 점수 / `--fire` 콤보 | combo-pulse + lowhp-breathe |
| Card Pick | `--overlay-hard` + `--ritual-pulse` | `--text` | `--rarity-*` 카드 별 | card-pulse-border + shimmer |
| Ritual | `--bg-elevated` + ritual-glow | `--gold` 헤딩 | `--legendary` 카드 | ritual-pulse + legendary-shimmer |
| Meta Shop | `--bg` + 별 | `--text` | `--gold` RP | panel-rise |
| Leaderboard | `--bg` + scanline | `--text` | `--ice` 1위 | slide-up |
| Settings | `--bg` | `--text-dim` | `--ice` 슬라이더 | fade-in |
| Highlight | `--bg-elevated` | `--text` | `--gold` 점수 | float-up + pulse |
| Transcend | `--grad-cinematic` + 별 | `--gold` | `--grad-brand` 타이틀 | logo-pulse 4s |

---

## 11. 컴포넌트 변경 시 절차

1. **토큰 추가가 필요한가?** → `tokens.css` 에 먼저 추가 (이름 컨벤션 준수: `--<카테고리>-<변형>`)
2. 그 토큰을 **components.css 의 새/기존 클래스**로 노출
3. 사용처에서 **클래스 적용** (인라인 cssText 신규 도입 금지)
4. `mockup/styles.css` 는 자동으로 `@import` 로 따라감 (별도 작업 없음)
5. `docs/28_design_system.md` (이 파일) **§1~§10 갱신** — 토큰 추가 시 표 추가
6. 빌드 + Vitest + 모바일 미리보기 확인

---

## 12. 금지 사항

- ❌ HEX 색을 컴포넌트/화면 코드에 직접 박지 말 것 (`#ff2a6d` → `var(--fire)`)
- ❌ `style.cssText = '...'` 신규 도입 금지 — 클래스 사용
- ❌ 새 키프레임을 컴포넌트 파일에 인라인 정의 금지 — `animations.css` 통합
- ❌ Tag 색을 의미와 다르게 재사용 금지 (예: `--fire` 를 단순 강조용으로)
- ❌ `--font-pixel` 본문 사용 금지 (가독 -50% 직격)
- ❌ z-index 매직 넘버 (`9999`) 사용 금지 — `--z-*` 토큰 사용

---

## 13. 향후 추가 (P2, 6/5 이전 검토)

- `--theme-light` 변형 (라이트모드 가능 시) — DACON 심사위원 화면 환경 미상 대비
- 텍스트 콘트라스트 비율 자동 검증 스크립트 (`scripts/contrast-check.ts`)
- 모션 토큰을 JS 에서도 읽을 수 있도록 `src/styles/tokens.ts` 미러 export
- Storybook 대신 `mockup/index.html` 에 컴포넌트 카탈로그 섹션 추가
