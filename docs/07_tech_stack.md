# 07 — 기술 스택 결정

## 결정 원칙

- **5주 1인 개발**에 최적화. 새 도구 학습 시간 최소화.
- **정적 호스팅 가능**. 백엔드 없이도 핵심 게임은 작동해야 함.
- **모바일 + 데스크톱** 동시 지원.
- **빠른 로딩 (LCP < 2초)**.
- **타입 안전** (1인 개발에서 버그 가장 빨리 잡는 방법).

## 결정 사항

### 언어 / 프레임워크

| 항목 | 선택 | 대안 | 이유 |
|---|---|---|---|
| 언어 | **TypeScript** | JavaScript | 타입 안전성, IDE 보조 |
| 빌드 | **Vite** | webpack, parcel | 빠르고 학습 비용 낮음, 정적 빌드 OK |
| 패키지 매니저 | **pnpm** | npm, yarn | 디스크 절약, 속도 |
| 코드 스타일 | **Biome** | Prettier+ESLint | 1개 도구로 lint+format |
| 테스트 | **Vitest** | Jest | Vite 친화 |

### 게임 엔진 / 렌더링 — **컨셉 확정 후 결정**

후보 분석:

#### 1. Canvas 2D + 자체 게임 루프

- **장점**: 의존성 최소, 풀 제어, 번들 작음 (~10KB)
- **단점**: 모든 걸 직접 구현
- **적합 컨셉**: 30초 클리커, 단순 퍼즐

#### 2. Phaser 3

- **장점**: 게임 엔진 풀 기능 (씬, 물리, 입력, 카메라)
- **단점**: 번들 ~700KB, 학습 곡선
- **적합 컨셉**: 액션, 플랫포머, 스크롤러

#### 3. PixiJS

- **장점**: 빠른 렌더링 (WebGL), 비교적 작음 (~250KB)
- **단점**: 게임 로직은 직접 작성
- **적합 컨셉**: 시각 효과 풍부한 게임

#### 4. Matter.js + Canvas 2D

- **장점**: 물리 엔진 강력, Suika류에 최적
- **단점**: 물리 외엔 직접 구현
- **적합 컨셉**: Suika 머지, 디펜스 혼합

#### 추천 매트릭스 (컨셉 → 엔진)

| 컨셉 | 추천 |
|---|---|
| 후보 A 한글런 (리듬) | Canvas 2D + Web Audio API |
| 후보 B 30초 클리커 | Canvas 2D 또는 PixiJS |
| 후보 C 타워머지 | Matter.js + Canvas 2D / PixiJS |

### 호스팅

| 항목 | 선택 | 대안 | 이유 |
|---|---|---|---|
| 정적 호스팅 | **Vercel** | Netlify, GitHub Pages, Cloudflare Pages | Git 푸시 = 자동 배포, 무료, 빠름 |
| 도메인 | Vercel 기본 (xxx.vercel.app) | 커스텀 도메인 | 추가 비용 X |

대안: **Netlify**도 동등. **Cloudflare Pages**가 가장 빠르지만 학습 부담. GitHub Pages는 최후의 옵션 (배포 단계가 한 단계 더 길어짐).

### 백엔드 (선택 — 글로벌 리더보드 시)

| 항목 | 선택 | 비고 |
|---|---|---|
| 데이터베이스 | **Supabase** (익명 사용자 모드) | Postgres + 익명 인증 + Realtime |
| 또는 | **Cloudflare Workers + KV** | 더 가볍지만 코드 작성 필요 |
| 또는 | **Firebase Realtime DB** | 빠르지만 키 노출 우려 |

**원칙**: 심사자가 키 없이 확인 가능해야 한다 → 공개 anon key + RLS(Row Level Security) 설정으로 익명 점수만 INSERT 가능, SELECT 가능, UPDATE/DELETE 차단.

> **백엔드는 처음엔 만들지 않는다.** localStorage만으로 1차 완성. 시간 남으면 추가.

### 자산 도구

| 도구 | 용도 |
|---|---|
| **Aseprite** ($20) | 도트/픽셀 아트 (구매 추천) |
| **Figma** | UI 와이어프레임, SVG 추출 |
| **Audacity** | 오디오 편집 |
| **BFXR** (web) | 8비트 효과음 즉석 생성 |
| **Chrome DevTools** | 성능 측정 (FPS, 메모리) |

### 폰트 (저작권 안전)

| 폰트 | 출처 | 라이선스 |
|---|---|---|
| Pretendard | https://github.com/orioncactus/pretendard | OFL 1.1 (상업 OK) |
| Noto Sans KR | Google Fonts | OFL 1.1 |
| 나눔스퀘어 | 네이버 | 상업 OK (일부 조건) |
| Galmuri (도트) | 눈누 | OFL — 도트풍에 매우 좋음 |
| Press Start 2P (영어 도트) | Google Fonts | OFL |

### 사운드 (저작권 안전)

| 출처 | 비고 |
|---|---|
| **Freesound.org** | CC0 / CC-BY 필터링 |
| **Zapsplat** | 무료 가입 후 다운로드 (출처 표기) |
| **Free Music Archive** | CC 라이선스 BGM |
| **Incompetech (Kevin MacLeod)** | CC-BY BGM |
| **BFXR / sfxr.me** | 자체 생성 (라이선스 X) |
| **자체 Web Audio API 생성** | 라이선스 X (chiptune) |

### 분석 / 모니터링 (선택)

- **Plausible Analytics** (privacy-friendly) — 페이지뷰만 추적, 결제·광고 X. 배포 후 트래픽 확인용.
- **Sentry** (에러 트래킹) — 무료 플랜으로 충분.

> 둘 다 선택. 코어 게임이 안 깨지는 게 우선.

## 의존성 표 (현재 시점)

```json
{
  "dependencies": {
    "[게임 엔진 — 컨셉 확정 후]": "..."
  },
  "devDependencies": {
    "vite": "^5",
    "typescript": "^5",
    "@types/node": "^20",
    "vitest": "^1",
    "@biomejs/biome": "^1"
  }
}
```

## 환경 변수

> 심사자가 키 없이 확인해야 하므로 **공개해도 안전한 키만** 사용.

| 키 | 용도 | 공개 가능? |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase 엔드포인트 | OK |
| `VITE_SUPABASE_ANON_KEY` | Supabase 익명 키 (RLS로 보호) | OK |
| `VITE_SENTRY_DSN` | Sentry 에러 트래킹 | OK |

> Supabase 비밀 키 (`service_role`) 는 절대 클라이언트에 포함 X.

## 성능 예산 (Performance Budget)

| 지표 | 목표 |
|---|---|
| 번들 크기 (gzip) | < 200KB |
| LCP | < 2.0s |
| FID / INP | < 100ms |
| FPS | 60 (모바일 30 이상) |
| 메모리 | < 80MB |

## 브라우저 지원 매트릭스

| 브라우저 | 버전 | 지원 |
|---|---|---|
| Chrome (데스크톱/모바일) | 최신 -2 | ✅ 우선 |
| Safari (데스크톱/iOS) | 최신 -2 | ✅ 우선 |
| Firefox | 최신 -2 | ✅ |
| Edge | 최신 | ✅ |
| 삼성 인터넷 | 최신 | ✅ (한국 사용자) |

> Internet Explorer 미지원.

## 빌드/배포 자동화

```yaml
# .github/workflows/deploy.yml (예시)
name: Deploy
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      # Vercel은 Git 통합으로 자동 배포되므로 생략 가능
```

## 확정 사항 (2026-05-04 — 컨셉 B "30초 클리커" 기준)

- [x] **렌더링: Canvas 2D + DOM 하이브리드**
  - 게임 영역(파티클, 셰이크, 숫자 팝업) = Canvas 2D
  - UI(메뉴, HUD, 카드 선택) = DOM + CSS
  - 이유: 클리커는 거대한 게임 영역 X, 외부 엔진 의존성 비용 회수 안 됨. 번들 작게 유지.
- [x] **물리 엔진 X** — 30초 클리커는 물리 불필요
- [x] **사운드: Web Audio API + 자체 생성** (BFXR/Beepbox) — 라이선스 무관
- [x] **폰트: Pretendard + Galmuri** (둘 다 OFL)
- [x] **다국어 인프라: 단순 JSON + 자체 t() 함수** (i18next 도입 X — 1인 5주에 학습비용 회수 X)
- [ ] **글로벌 리더보드 백엔드: 보류** — Week 4까지 코어 안정화 후 재평가. 시간 남으면 Supabase 익명 추가.
