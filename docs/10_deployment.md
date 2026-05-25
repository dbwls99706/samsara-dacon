# 10 — 배포 전략

## 1. 호스팅 — Vercel (1순위)

### 이유
- Git 푸시 = 자동 배포 (수동 단계 0)
- 무료 플랜으로 충분
- 글로벌 CDN
- HTTPS 자동
- preview URL 자동 (PR/브랜치별)

### 셋업
1. https://vercel.com 가입 (GitHub 계정으로)
2. New Project → GitHub 저장소 연결
3. Framework: Vite (자동 감지)
4. Build command: `pnpm build`
5. Output directory: `dist`
6. 환경 변수 입력 (있다면)
7. Deploy

기본 URL: `<프로젝트명>.vercel.app`

### 대안

- **Netlify**: 동등 — Vercel과 차이 적음
- **Cloudflare Pages**: 더 빠름 — 약간의 셋업 차이
- **GitHub Pages**: 정적 라우팅 한정 — SPA 라우팅이 까다로움

## 2. 도메인

기본 vercel 도메인으로 충분. 커스텀 도메인 불필요.
- 심사자가 보는 URL: `https://daker-minigame.vercel.app` 같은 형태
- 커스텀 도메인을 사다 쓰면 살짝 인상은 좋아지지만, 1만원 이상 비용 + DNS 셋업 시간 → 점수에 도움 안 됨.

## 3. 빌드 설정

### `vite.config.ts`

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',  // 상대 경로 — 어떤 호스팅에서도 작동
  build: {
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: true,
    cssCodeSplit: false, // 1개 CSS 파일로 → 요청 수 줄임
    rollupOptions: {
      output: {
        manualChunks: undefined, // 단일 청크로 → 1인 게임은 분할 불필요
      },
    },
  },
  server: {
    host: '0.0.0.0', // 모바일 실기기 테스트용
    port: 5173,
  },
});
```

### `index.html` 머리말 필수

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <meta name="theme-color" content="#0d0221" />
    <meta name="description" content="SAMSARA · 윤회 — 30초마다 새 운명을 짠다. 도파민 로그라이트 클리커." />

    <!-- OpenGraph (대중 투표 공유 시 인상 결정) -->
    <meta property="og:title" content="SAMSARA · 윤회" />
    <meta property="og:description" content="30초마다 새 운명을 짠다 · Every 30 seconds, a new fate." />
    <meta property="og:image" content="/og-image.png" />
    <meta property="og:url" content="https://samsara-dacon.vercel.app" />
    <meta property="og:type" content="website" />

    <meta name="twitter:card" content="summary_large_image" />

    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

    <title>SAMSARA · 윤회</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

> **OG 이미지는 1200x630 PNG**. 게임 메인 화면 캡처를 사용. 카카오/슬랙/디스코드 공유 시 카드 인상 결정.

## 4. 배포 자동화

GitHub → Vercel 자동 통합이면 별도 액션 불필요. 하지만 빌드 검증을 위해:

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
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
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

## 5. PWA (선택)

### 의의

- 사용자가 홈 화면에 추가 가능 → 다음 진입 1탭
- "별도 설치 없이"의 정신과 충돌 없음 (선택사항)

### 구현 (시간 남으면)

```ts
// vite-plugin-pwa 사용
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'SAMSARA · 윤회',
        short_name: 'SAMSARA',
        theme_color: '#0d0221',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
});
```

## 6. 정적 자산 최적화

### 이미지

- PNG → WebP 변환 (squoosh.app)
- SVG는 그대로 (텍스트 → 압축)
- 큰 이미지는 < 100KB

### 폰트

- woff2만 사용 (woff X)
- subset (한국어 폰트는 필수 — 통자 → 11MB, 자주 쓰는 자만 → 1MB 이하)
- `font-display: swap` 적용

```css
@font-face {
  font-family: 'Pretendard';
  src: url('/fonts/Pretendard-subset.woff2') format('woff2');
  font-display: swap;
}
```

### 오디오

- MP3 또는 OGG (브라우저 호환)
- BGM: 96kbps 모노 (작아도 OK)
- SFX: 짧게 (< 2초), 합쳐서 < 200KB

## 7. 캐시 / 헤더

Vercel은 정적 자산 캐시 자동. 추가 설정 X.

## 8. 점검 체크리스트 (배포 후)

- [ ] HTTPS로 접근 가능
- [ ] 모바일 (실기기) 정상 동작
- [ ] 데스크톱 4종 브라우저 정상
- [ ] OG 카드 정상 (https://opengraph.xyz 로 검증)
- [ ] Lighthouse 모바일 점수 80+ (Performance / Best Practice / SEO)
- [ ] 콘솔 에러 0
- [ ] 새로고침 후 진행 보존
- [ ] 음소거 가능
- [ ] 외부 링크가 새 탭에서 열림 (rel="noopener")
- [ ] favicon, apple-touch-icon 정상

## 9. 모니터링 (선택)

- **Vercel Analytics**: 배포에서 켜기만 하면 자동
- **Plausible** (privacy-friendly, $9/mo): 무료 대안: GoatCounter
- **Sentry**: 무료 플랜 — 에러 트래킹

> 모니터링은 보너스. 게임 자체가 더 중요.

## 10. 심사자용 빠른 시작 (README 섹션)

```markdown
## 심사자용 빠른 시작

1. 아래 URL 클릭
2. 별도 가입 / 결제 없이 바로 플레이
3. 모바일에서도 동일 URL 접속

배포 URL: https://samsara-dacon.vercel.app
시연 영상: https://youtu.be/[ID]

브라우저: Chrome, Safari, Firefox, Edge 최신 버전 권장
```

## 11. 비상 대응 (배포 후 깨졌을 때)

- Vercel 대시보드 → 이전 배포로 즉시 롤백 (1탭)
- 매일 변경 후 즉시 모바일에서 테스트 (배포 후 5분 안에)
- 6/8 마감 직전에 새 푸시 X (안전 마진 24시간)

## 12. 마감 절차 (6/8 09:00 ~ 10:00)

- 09:00 — 마지막 빌드 검증 (모바일 + 데스크톱)
- 09:15 — Vercel 배포 상태 확인
- 09:20 — DACON 산출물 페이지에 URL · GitHub · YouTube 입력
- 09:30 — 제출 확인 (이메일 / 알림)
- 09:40 — 다른 디바이스에서 한 번 더 접속 테스트
- 10:00 — 마감

> **6/8 09:00에 할 일은 사실 어제까지 다 끝나 있어야 한다.**
