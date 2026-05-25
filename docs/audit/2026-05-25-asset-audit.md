# 자산 / 라이선스 / 의존성 audit — 2026-05-25

> SAMSARA 자산 인벤토리 + 라이선스 호환성 + CDN 가용성 + npm 의존성 보안. 사용자 부재 중 안전 fix 적용.

## 1. SVG 인벤토리

### 33 SVG 총합

| 카테고리 | 수 | 파일 |
|---|---|---|
| **캐릭터** | 20 | 5종 × 4 frame (idle/attack/walk1/walk2): tiger / magpie / dokkaebi / gumiho / dragon |
| **적** | 5 | boss / jab(잡귀) / jangsan(장산범) / wonwi(원귀) / dokkaebi_e |
| **픽업** | 7 | bomb / chest / coin / gem / heart / magnet / xp |
| **OG 이미지** | 1 | 1200×630 |

기획서 §11 약속:
- 캐릭터 5종 ✓
- 적 5종 ✓
- 픽업 7종 ✓
- OG 이미지 ✓

**파일 사이즈**: 모두 < 8KB 각, public/ 총 164KB. 기획서 약속 "각 SVG < 4KB" 보다 일부 큼(tiger.svg 8KB) — 마이크로 갭, Q2/A2 답변상 OK.

## 2. 폰트

| 폰트 | 경로 | 라이선스 | 용도 |
|---|---|---|---|
| Pretendard | `cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9` | **OFL 1.1** | 본문 |
| Galmuri11 | `cdn.jsdelivr.net/gh/fonts-archive/Galmuri11` | **OFL 1.1** | 도트 / 코드 / 표지 |

### CDN Live Check (2026-05-25 13:35)
- Pretendard `.min.css` — **200 OK / 0.10s** ✓
- Galmuri11 `.css` — **200 OK / 0.26s** ✓

### 회귀 위험 (5/20 사례 후속)
- 2026-05-20: `cdn.jsdelivr.net/gh/projectnoonnu/...` 가 404 → `fonts-archive` 로 교체.
- 현재 경로는 fonts-archive 가 보관하는 OFL 라이선스 원본 미러 — 안정성 양호하지만 *외부 의존* 한계는 남음.
- 회귀 가드: `npm run test:e2e` Playwright headless 가 404 즉시 검출 (request_failures: 0 강제).

## 3. 사운드 / BGM

| 자산 | 출처 | 라이선스 |
|---|---|---|
| BFXR SFX 67종 | Web Audio API 런타임 합성 (자체) | 자체 제작 |
| BGM 5 레이어 | Web Audio chiptune (자체) | 자체 제작 |

**자산 0KB** (모두 런타임 합성). 외부 자산 의존 0건 ✓.

## 4. npm 의존성 라이선스

### 선언된 deps (package.json)
| 패키지 | 버전 | 라이선스 |
|---|---|---|
| @supabase/supabase-js | ^2.46.1 | MIT |
| marked | ^18.0.3 | MIT |
| playwright | ^1.49.0 | Apache-2.0 |
| typescript | ^5.6.3 | Apache-2.0 |
| vite | ^5.4.10 | MIT |
| vitest | ^2.1.4 | MIT |

**GPL/AGPL 의존성 0건** ✓. 모두 MIT 또는 Apache-2.0 — 우리 MIT 라이선스와 충돌 없음.

### 🔴 발견 + Fix: Playwright 미선언 → 추가 완료

**문제**:
- `scripts/e2e-smoke.mjs` + `scripts/e2e-impression.mjs` 가 `playwright` 모듈 사용
- 그러나 `package.json` 에 미선언 → fresh clone 시 `npm install` 가 가져오지 않음
- 결과: 1차 60% 동료 개발자가 `npm install && npm run test:e2e` 시도 → **즉시 ERR_MODULE_NOT_FOUND**

**Fix (적용 완료)**:
- `package.json` devDependencies 에 `"playwright": "^1.49.0"` 추가
- `package-lock.json` 동기화 (`npm install --package-lock-only`)
- 회귀 검증: vitest 195/15 PASS / 빌드 PASS / 번들 111.42KB 불변 ✓

## 5. npm audit 결과

### Before: 7건 (6 moderate + 1 high)

### `npm audit fix` 후 (적용 완료): **5 moderate**
- ✓ rollup 4.0.0-4.58.0 path traversal (HIGH) → 4.59+ 로 fix
- ✓ ws 8.0.0-8.20.0 memory disclosure (MODERATE) → 8.21+ 로 fix

### 남은 5 moderate (transitive, dev-only)
- esbuild ≤0.24.2 — dev 서버 한정, 프로덕션 영향 0
- vite (esbuild 의존)
- vitest / @vitest/mocker / vite-node — vite cascade
- 모두 dev-time only — 브라우저 런타임 영향 0

### 결정
`npm audit fix --force` 는 vite v8 로 메이저 업그레이드 = breaking. **6/5 코드 동결 임박, 회피**. 남은 5 moderate 는 dev 환경 한정 — 프로덕션/심사 영향 0. 양해 수준.

## 6. 종합 헬스: **HEALTHY** ✅

### 점검 결과
- 자산 인벤토리 ✓ (33 SVG / 폰트 2 / 사운드 자체)
- 라이선스 호환성 ✓ (OFL + MIT + Apache-2.0)
- CDN 가용성 ✓ (live 200 OK)
- GPL/AGPL 0건 ✓

### 적용된 안전 fix
1. **Playwright 미선언 → devDependencies 추가** (1차 60% 동료 개발자가 `npm install` 후 깨지지 않게)
2. **npm audit fix** → rollup HIGH + ws MODERATE 해소

### 권장 액션 (사용자 결정용)
1. **README 의 "Quick Start" 섹션** — `npm install && npm test && npm run test:e2e` 명령 명시. 1차 60% 동료 개발자가 즉시 검증 가능하게.
2. **자산 audit 결과 README 한 줄**: "라이선스: MIT + OFL + Apache-2.0, GPL 0건" — 1차 voter 신뢰 시그널.
