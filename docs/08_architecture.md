# 08 — 코드 아키텍처

> 컨셉 확정 후 보강. 일반적 구조만 먼저 정리. 1인 5주에 적합한 **단순한 분리**가 핵심.

## 디자인 목표

- **2,000~5,000 라인** 안에서 끝낸다 (그 이상 = 리스크)
- **테스트 가능한 순수 함수**로 게임 로직 분리
- **렌더링과 로직 분리** (게임 상태 → 렌더링 결정 단방향)
- **외부 자산 1곳에 모음** (`src/assets/`)
- **저장 형태 분리** (`src/persistence/`)

## 디렉터리 구조 (제안)

```
src/
├── main.ts                    # 진입점 (DOM 마운트, 게임 부트)
├── game/
│   ├── core.ts                # 게임 루프 (requestAnimationFrame)
│   ├── state.ts               # GameState 타입 + 초기 상태
│   ├── reducers.ts            # 순수 함수: (state, action) → state
│   ├── actions.ts             # 액션 타입 정의
│   ├── selectors.ts           # 파생 데이터 (memoize)
│   ├── systems/               # 도메인별 로직
│   │   ├── input.ts           # 입력 → 액션 변환
│   │   ├── physics.ts
│   │   ├── scoring.ts
│   │   ├── progression.ts     # 메타 진보
│   │   └── ai.ts              # (해당 시)
│   └── balance.ts             # 밸런스 상수 (튜닝용 단일 파일)
├── render/
│   ├── canvas.ts              # 캔버스 셋업
│   ├── camera.ts              # 카메라/뷰포트
│   ├── effects.ts             # 파티클, 셰이크, 줌
│   ├── ui.ts                  # HUD (점수, 라이프 등)
│   └── tween.ts               # 이징/트윈
├── audio/
│   ├── engine.ts              # Web Audio Context 관리
│   ├── bgm.ts                 # BGM 로딩/페이드
│   └── sfx.ts                 # 효과음 트리거
├── scenes/                    # 화면 단위
│   ├── splash.ts
│   ├── main_menu.ts
│   ├── game.ts
│   ├── pause.ts
│   ├── game_over.ts
│   └── options.ts
├── i18n/
│   ├── en.json
│   ├── ko.json
│   └── index.ts               # 언어 토글, 키 → 텍스트
├── persistence/
│   ├── localStorage.ts        # 저장 추상화
│   ├── schema.ts              # 저장 스키마 + 마이그레이션
│   └── leaderboard.ts         # (선택) 글로벌 리더보드
├── ui/
│   ├── Button.ts
│   ├── Modal.ts
│   └── styles.css
├── assets/
│   ├── fonts/
│   ├── audio/
│   ├── images/
│   └── manifest.ts            # 자산 매니페스트 (preload용)
└── utils/
    ├── math.ts                # rng, clamp, lerp 등
    ├── events.ts              # 이벤트 버스
    └── debug.ts               # 디버그 토글, 통계 표시

tests/
├── reducers.test.ts
├── scoring.test.ts
└── ...

public/
├── index.html
└── favicon.svg
```

## 게임 루프 (의사 코드)

```ts
// src/game/core.ts
let state: GameState = initialState();
let lastTime = performance.now();

function loop(now: number) {
  const dt = Math.min((now - lastTime) / 1000, 1/30); // 클램프 (탭 비활성)
  lastTime = now;

  const actions = collectInput();
  for (const action of actions) {
    state = reduce(state, action);
  }
  state = tick(state, dt); // 시간 진행

  render(state);
  audioUpdate(state);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
```

## 상태 모델 (예시)

```ts
type GameState = {
  scene: Scene;
  // 게임 진행 상태
  game: {
    phase: 'idle' | 'playing' | 'paused' | 'over';
    elapsed: number;
    score: number;
    combo: number;
    // 컨셉 의존 데이터
  };
  // 메타 (영구) 진보
  meta: {
    bestScore: number;
    coinsTotal: number;
    unlocks: string[];
    settingsLanguage: 'ko' | 'en';
    settingsVolume: number;
  };
  // UI
  ui: {
    notifications: string[];
  };
};
```

## 영구 저장 스키마 (localStorage)

```ts
// 키: 'dacon_minigame_v1'
type SaveData = {
  version: 1;
  meta: GameState['meta'];
};

// 마이그레이션 패턴: 버전 올라갈 때만 변환
function migrate(raw: unknown): SaveData {
  if (typeof raw !== 'object' || raw === null) return defaultSave();
  // version 0 → 1 등 단계별 변환
  return raw as SaveData;
}
```

## 렌더링 패턴

- **상태 → 렌더링은 단방향**. 렌더 함수는 상태를 변경하지 않음.
- **더블 버퍼링 불필요** (Canvas는 자동).
- **카메라**는 흔들림(Shake)/줌(Zoom) 적용 한 곳에 집중.
- **레이어**: BG / Game / FG / UI 순.

## 입력 패턴

- 모바일: `pointerdown/move/up` (touch + mouse 통합)
- 데스크톱: 키보드 `keydown/keyup` 매핑
- **입력 → 액션 변환은 한 함수에서**. 게임 로직은 액션만 본다.

```ts
// src/game/systems/input.ts
function inputToAction(e: InputEvent): Action | null {
  switch (e.type) {
    case 'pointerdown': return { type: 'TAP', x: e.x, y: e.y };
    case 'keydown':
      if (e.key === ' ') return { type: 'TAP' };
      if (e.key === 'Escape') return { type: 'PAUSE' };
      return null;
  }
}
```

## 자산 프리로딩

```ts
// 시작 화면이 보이는 동안 백그라운드 로드
const manifest = [
  { kind: 'audio', src: '/audio/bgm.mp3', key: 'bgm' },
  { kind: 'audio', src: '/audio/tap.wav', key: 'tap' },
  { kind: 'image', src: '/img/sprite.png', key: 'sprite' },
];
```

## 다국어

```ts
// src/i18n/ko.json
{
  "main.start": "시작",
  "main.best": "최고: {score}",
  "game.combo": "콤보 x{n}",
  ...
}
```

훅:
```ts
const t = useT(); // 현재 언어 가져옴
t('main.start'); // "시작"
t('main.best', { score: 1234 }); // "최고: 1,234"
```

## 디버그 모드

```ts
// URL ?debug=1 진입 시 활성
// FPS, 상태 덤프, 레벨 점프, 즉시 게임오버 등
```

배포 빌드에서도 `?debug=1` 활성 가능하게 두면 심사 도중 무언가 깨졌을 때 빨리 대응 가능. 단, 정상 플레이에는 영향 없게 분리.

## 에러 처리

- 저장 데이터 파싱 실패 → 기본 상태로 리셋 + 경고 1회
- 자산 로딩 실패 → 텍스트 fallback ("BGM 로드 실패 — 게임은 계속 진행")
- 글로벌 에러 → Sentry 전송 + 사용자엔 비표시 (게임은 계속)

## 테스트 전략 (1인 개발 현실 버전)

- **단위 테스트는 reducers, scoring, balance 함수에만.** 렌더링은 수동 테스트.
- 새 기능 추가 시 reducer에 테스트 1개. 평균 30분 안에 작성 완료.
- 매 주 1회 풀 시나리오 수동 테스트 (`docs/13_qa_test_plan.md` 체크리스트).

## 버전 관리

- `main` 브랜치만 사용 (1인 개발에 브랜치 분리 부담만 큼)
- 매일 1~3회 커밋
- 큰 변화는 태그 (예: `prototype`, `alpha`, `beta`)

## 보안 / 프라이버시

- 광고 / 트래커 코드 0
- 이메일·전화 등 식별 정보 수집 0
- 글로벌 리더보드 시 닉네임만 (한국어 비속어 필터)
- localStorage만 사용 (쿠키 X)
