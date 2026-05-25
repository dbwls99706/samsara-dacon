# 18 — 오디오·비주얼 사양

> 10/10 도파민 디자인의 감각 레이어 사양. 자체 생성 (BFXR / Beepbox / Web Audio API) 우선 → 라이선스 위험 0.

## 1. BGM — 4 동적 레이어

### 컨셉

음악이 게임 진행에 따라 **누적 활성화**되는 시스템. Vampire Survivors / Hades / 카오스 엔진 게임의 표준.

### 4 레이어 구성

| 레이어 | 진입 조건 | 사운드 |
|---|---|---|
| L1 — 베이스 | 메인 화면 + Phase 1 (W1-3) | 베이스 라인 + 패드. 차분, 지속 |
| L2 — 드럼 | Phase 2 진입 (W4) | 드럼 + 퍼커션. 리듬 등장 |
| L3 — 멜로디 | Phase 3 진입 (W9) | 메인 멜로디 라인. 강한 인상 |
| L4 — 코러스 | FRENZY (콤보 ×50) / GOD MODE (×100) / 7시너지 발동 | 풀 후렴, 강렬, 전쟁 톤 |

### 재생 구조 (Web Audio)

```ts
// 4개 AudioBufferSourceNode 를 동시 재생
// 각각 GainNode 로 볼륨 자동화

const ctx = new AudioContext();
const layers = await Promise.all([
  loadBuffer('/audio/bgm_l1.ogg'),
  loadBuffer('/audio/bgm_l2.ogg'),
  loadBuffer('/audio/bgm_l3.ogg'),
  loadBuffer('/audio/bgm_l4.ogg'),
]);

const sources = layers.map(buf => {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(gain).connect(ctx.destination);
  src.start(0);
  return { src, gain };
});

// 항상 4 레이어가 정확히 동기 재생됨
// 진행에 따라 gain.gain.linearRampToValueAtTime() 으로 페이드 인/아웃

function setLayer(i: number, target: 0 | 1, duration = 1.5) {
  const now = ctx.currentTime;
  sources[i].gain.gain.cancelScheduledValues(now);
  sources[i].gain.gain.setValueAtTime(sources[i].gain.gain.value, now);
  sources[i].gain.gain.linearRampToValueAtTime(target, now + duration);
}
```

### 작곡 도구

- **Beepbox.co** — chiptune. 4 레이어 같은 BPM/박자로 작곡.
- 무료, URL로 공유 가능, 자체 생성 = 라이선스 X.
- 4 레이어 × 60초 루프 = 4분 작곡 시간.

### BPM / 키

- BPM: 128 (액션 게임 표준)
- 키: A 마이너 (한국적 + 글로벌 친숙)
- 박자: 4/4

### 메인 메뉴 BGM

- 별도 트랙 (조용한 패드 + 단일 멜로디)
- 게임 시작 시 페이드 아웃 → 게임 BGM L1 페이드 인 (1.5초)

### 보스 BGM

- 보스 등장 시 별도 짧은 트랙 (30초 한 번 재생)
- 격파 후 게임 BGM 으로 복귀

### 메타 잠금 해제 BGM

- 메타 상점에서 RP 50으로 추가 트랙 잠금 해제 (총 4개)
- 잠금 해제 시 메인 메뉴에서 선택 가능

## 2. SFX — 60개 인벤토리

### 자체 생성 도구

- **sfxr.me / BFXR** — 8비트 효과음. 파라미터 슬라이더 → 즉석 생성 → WAV 다운.
- 무료, URL/JSON 파라미터 공유 가능.
- AI(Claude)가 60개 BFXR 파라미터 일괄 생성 가능.

### SFX 카테고리별 인벤토리

#### 탭 (5)

| ID | 사용 | 톤 |
|---|---|---|
| sfx_tap_low | 기본 탭 | 80Hz, 짧음 |
| sfx_tap_mid | 콤보 ×3+ | 200Hz |
| sfx_tap_high | 콤보 ×10+ | 400Hz |
| sfx_tap_super | 콤보 ×25+ | 800Hz, 화려 |
| sfx_tap_god | 콤보 ×100+ | 풀 화음 |

#### 콤보 임계 (8)

| ID | 사용 |
|---|---|
| sfx_combo_3 | ×3 도달 |
| sfx_combo_5 | ×5 |
| sfx_combo_10 | ×10 (3음) |
| sfx_combo_25 | ×25 (시간 정지 동반) |
| sfx_combo_50 | ×50 FRENZY |
| sfx_combo_100 | ×100 GOD MODE |
| sfx_combo_200 | ×200 |
| sfx_combo_break | 콤보 끊김 |

#### 카드 (6)

| ID | 사용 |
|---|---|
| sfx_card_appear | 카드 선택 화면 등장 |
| sfx_card_hover | 카드 hover/터치 |
| sfx_card_select | 카드 선택 |
| sfx_card_rare | 희귀 카드 |
| sfx_card_epic | 에픽 카드 |
| sfx_card_legendary | 전설 카드 (특별) |

#### 시너지 발동 (18)

태그별 × 티어 (3장/5장/7장):

```
sfx_synergy_fire_3, _fire_5, _fire_7
sfx_synergy_ice_3, _ice_5, _ice_7
sfx_synergy_gold_3, _gold_5, _gold_7
sfx_synergy_time_3, _time_5, _time_7
sfx_synergy_chaos_3, _chaos_5, _chaos_7
sfx_synergy_echo_3, _echo_5, _echo_7
```

#### 보스 (5)

| ID | 사용 |
|---|---|
| sfx_boss_appear | 보스 등장 |
| sfx_boss_hit | 보스 점수 누적 (몇 초마다) |
| sfx_boss_defeat | 보스 격파 |
| sfx_boss_fail | 보스 실패 (시간 만료) |
| sfx_ritual_select | 의식 카드 선택 |

#### 모디파이어 (3)

| ID | 사용 |
|---|---|
| sfx_modifier_blessing | 축복형 모디파이어 |
| sfx_modifier_challenge | 도전형 |
| sfx_modifier_secret | 비밀 |

#### 게임 상태 (8)

| ID | 사용 |
|---|---|
| sfx_wave_start | 웨이브 시작 |
| sfx_wave_end | 웨이브 종료 |
| sfx_life_lost | 라이프 손실 |
| sfx_game_over | 게임 오버 |
| sfx_revive | 부활 |
| sfx_threshold_K | K 단위 도달 |
| sfx_threshold_M | M 단위 도달 |
| sfx_threshold_B | B 단위 도달 |

#### 메타/UI (7)

| ID | 사용 |
|---|---|
| sfx_menu_open | 메뉴 등장 |
| sfx_menu_close | 메뉴 닫기 |
| sfx_button_hover | 버튼 hover |
| sfx_button_click | 버튼 클릭 |
| sfx_purchase | 메타 상점 구매 |
| sfx_unlock | 카드/스킨 잠금 해제 |
| sfx_share | 공유 버튼 |

총 SFX: 5+8+6+18+5+3+8+7 = **60개**.

### SFX 재생 규칙

- 동시 재생 한도: 8개 (그 이상은 큐 폐기)
- 같은 SFX 0.05초 이내 중복 재생 시 두 번째는 폐기
- 핵심 SFX (탭, 콤보)는 우선순위 높음
- 마스터 볼륨 + SFX/BGM 별도 슬라이더

## 3. 폰트

| 폰트 | 용도 | 라이선스 |
|---|---|---|
| **Pretendard** | 본문 한국어 | OFL |
| **Galmuri** | 도트 강조 한국어 | OFL |
| **Press Start 2P** | 도트 영문 | OFL |
| **VT323** | 영문 보조 | OFL |

### 사용 매핑

- 메인 타이틀: Galmuri 48px (도트, 강한 인상)
- 점수 큰 숫자: Galmuri 36px
- HUD 점수: Pretendard Bold 24px
- 본문: Pretendard 16px
- 카드 명칭: Galmuri 18px
- 카드 효과 설명: Pretendard 14px

## 4. 컬러 팔레트 — 네오펑크 + 한국 모티브 (1순위)

### 베이스

```
배경        #0a0a1a (거의 검정, 약간 푸른)
서피스      #1a1a2e (어두운 보라/파랑)
텍스트      #f0f0ff (밝은 백색)
보조 텍스트  #8888aa
```

### 강조

```
🔥 불      #ff2a6d (네온 핑크)
❄️ 얼음    #05d9e8 (네온 시안)
💰 금      #ffd700 (황금)
⏱️ 시간    #d300c5 (네온 보라)
🌀 카오스  #ff6f00 (네온 오렌지)
🪞 에코    #b3ff00 (네온 라임)
```

### 등급

```
Common      #8888aa
Rare        #4a90e2 (파란)
Epic        #b14aff (보라)
Legendary   #ffaa00 (황금 → 무지개 그라디언트)
```

### 상태

```
승리/Up    #00ff88
경고       #ffaa00
실패/Down  #ff3366
```

### 한국 모티브 변종 (옵션)

- 보스 시 단청 색상 적용 (빨강/파랑/노랑/초록/검정 5색)
- 6태그 모두 모인 "조화" 시 단청 색감 발현

## 5. 파티클 시스템

### 파티클 타입

| 타입 | 사용 | 갯수 |
|---|---|---|
| spark | 탭 (기본) | 5~25 |
| burst | 콤보 ×10+ 도달 | 30 |
| explosion | 콤보 ×25 / 보스 격파 | 100 |
| ring | hitstop 방사형 | 1 (큰 링) |
| confetti | 시너지 5장 발동 | 50 |
| supernova | 시너지 7장 / GOD MODE | 200 |
| coin | 코인 획득 | 1~5 (숫자에 비례) |
| 글리치 | 카오스 시너지 | 화면 가득 |

### 객체 풀 (성능)

```ts
// 모든 파티클은 사전 풀에서 재사용
const particlePool = new Array(500).fill(null).map(() => createParticle());
let activeIdx = 0;

function spawn(type: ParticleType, x: number, y: number) {
  const p = particlePool[activeIdx];
  p.init(type, x, y);
  activeIdx = (activeIdx + 1) % 500;
}
```

### 모바일 자동 다운

- FPS < 50 감지 시 파티클 갯수 50% 감소
- FPS < 30 감지 시 추가 50% 감소
- 사용자에게 "성능 모드 ON" 토스트

## 6. 화면 흔들림 (Screen Shake)

### 트리거 매트릭스

| 이벤트 | 강도 | 지속 |
|---|---|---|
| 콤보 ×10 | 약 (2px) | 0.1초 |
| 콤보 ×25 | 중 (5px) | 0.2초 |
| 콤보 ×50 (FRENZY) | 강 (8px) | 0.3초 |
| 콤보 ×100 (GOD) | 강 (10px) | 0.4초 |
| 시너지 5장 발동 | 중 (5px) | 0.2초 |
| 시너지 7장 발동 | 강 (12px) | 0.5초 |
| 보스 격파 | 강 (10px) | 0.3초 |
| 라이프 손실 | 약 (3px) | 0.15초 |
| 폭발 효과 | 약 (3px) | 0.1초 |

### 구현

```ts
function shake(intensity: number, duration: number) {
  const start = performance.now();
  const frame = () => {
    const t = (performance.now() - start) / 1000;
    if (t > duration) {
      camera.x = camera.y = 0;
      return;
    }
    const decay = 1 - t / duration;
    camera.x = (Math.random() - 0.5) * intensity * decay;
    camera.y = (Math.random() - 0.5) * intensity * decay;
    requestAnimationFrame(frame);
  };
  frame();
}
```

## 7. 숫자 팝업

### 사양

```
탭 가치 표시 (예: "+500")

- 위치: 탭 좌표
- 크기: 24px (콤보에 따라 ↑)
- 색: 흰색 → 콤보별 색
- 애니메이션: 위로 호 그리며 (60px 이동, 600ms)
- Fade: 후반 200ms에서 alpha 1 → 0
- 폰트: Galmuri 도트
```

### 변종

- 콤보 보너스: "+500 ×5 = 2,500" 같이 곱셈 표기
- 시너지: 큰 숫자 + 라벨 ("PHOENIX!")
- 핫스팟: 황금 글로우 + 회전
- 잭팟: 화면 중앙 + 풀스크린 흰 플래시

## 8. 카메라 시스템

### 줌 자동화

| 상태 | 줌 |
|---|---|
| 평상시 | 1.0 |
| 콤보 ×25 도달 | 1.05 (0.2초) |
| 콤보 ×50 (FRENZY) | 1.10 (5초) |
| 콤보 ×100 (GOD) | 1.15 (5초) |
| 보스 격파 | 1.20 (1초 후 복귀) |
| 시너지 7장 발동 | 1.30 (1초 시네마틱) |

### 줌 트랜지션

`linearRampToValueAtTime` (Web Audio 처럼 부드러움) 또는 `easeOutCubic`.

## 9. UI 요소

### 카드 컴포넌트

```
┌────────────┐
│ [태그 아이콘]│  ← 우상단 작게 (이모지)
│            │
│   [그림]   │  ← 60×60 SVG 또는 도트 아이콘
│            │
│ 카드 이름   │  ← Galmuri 14px
│            │
│ 효과 설명   │  ← Pretendard 11px
│            │
│ [등급 색상] │  ← 하단 1px 바
└────────────┘
```

크기: 80×120 (모바일) / 120×180 (데스크톱)

### HUD 위치

| 요소 | 위치 |
|---|---|
| 점수 | 좌상 |
| 시간 | 좌상 (점수 옆) |
| 라이프 | 좌상 (시간 아래) |
| 웨이브 번호 | 우상 |
| Run Identity 배너 | 화면 중앙 상단 (얇은 바) |
| 모디파이어 | 우상 (웨이브 아래) |
| 콤보 인디케이터 | 화면 중앙, 큼 (콤보 ×3+ 시 등장) |
| 보유 카드 | 화면 하단 1/4 (우측 정렬) |

## 10. 트랜지션 / 이징

### 이징 함수

```ts
const ease = {
  inQuad:    t => t*t,
  outQuad:   t => t*(2-t),
  inOutQuad: t => t<.5 ? 2*t*t : -1+(4-2*t)*t,
  inCubic:   t => t*t*t,
  outCubic:  t => (--t)*t*t+1,
  outBack:   t => 1+--t*t*(2.7*t+1.7), // 오버슈트
  outElastic: t => Math.pow(2,-10*t)*Math.sin((t-.075)*(2*Math.PI)/.3)+1,
};
```

### 적용 매트릭스

| 적용 | 이징 |
|---|---|
| 카드 등장 | outBack |
| 점수 카운트업 | outCubic |
| 화면 페이드 | outQuad |
| 캐릭터 squash | outElastic |
| 줌 인 | outCubic |
| 시너지 발동 | outElastic + 0.3초 hitstop |

## 11. 캐릭터 디자인

### 기본 캐릭터: 호랑이 (도트 픽셀)

- 24×24 픽셀 (또는 32×32)
- 한국 호랑이 모티브 (검은 줄무늬)
- Aseprite로 제작 또는 AI 생성 후 정리

### 애니메이션 상태

- idle (2 프레임)
- tap (1 프레임, 탭 시 1초 squash)
- victory (3 프레임, 보스 격파)
- death (1 프레임)

### 진화 (메타 사이클)

- 0-100: 새끼 호랑이
- 100-1000: 어른 호랑이
- 1000+: 신성한 호랑이 (빛 발산)
- 5000+: 별의 호랑이
- 10000+: 초월 호랑이

### 스킨 (메타 잠금 해제)

| ID | 명칭 | RP |
|---|---|---|
| 1 | 호랑이 | 기본 |
| 2 | 까치 | 30 |
| 3 | 도깨비 | 30 |
| 4 | 구미호 | 60 |
| 5 | 용 | 100 |

각 스킨 = 30+ 프레임 도트 + 고유 SFX (탭 음 약간 변경).

## 12. 자산 일괄 생성 워크플로 (AI 보조)

### Step 1: BFXR 파라미터 (Claude가 60개 일괄 생성)

```ts
// 각 SFX 의 BFXR 파라미터 JSON
const sfxParams = {
  sfx_tap_low: { wave: 'square', freq: 80, ... },
  sfx_tap_mid: { wave: 'square', freq: 200, ... },
  // ... 60개
};
```

### Step 2: BFXR API 또는 jsfxr 라이브러리로 자동 생성

```ts
import { sfxr } from 'jsfxr';

for (const [id, params] of Object.entries(sfxParams)) {
  const audioBuffer = sfxr.toAudioBuffer(params);
  // → public/audio/sfx/<id>.wav 저장 (또는 메모리 보관)
}
```

런타임 생성도 가능 → 자산 다운 0KB!

### Step 3: BGM 4 레이어

- Beepbox.co 에서 작곡
- 4 레이어를 같은 BPM/길이로 export (각 OGG)
- 또는 같은 패턴을 4 트랙으로 분리 export

### Step 4: 캐릭터 도트

- Aseprite 1시간 작업 (호랑이 24×24)
- 또는 AI 이미지 생성 → 도트 변환 도구
- 또는 https://kenney.nl 무료 자산 (CC0)

## 13. 성능 예산 (10/10 사양 유지)

| 자산 | 예산 |
|---|---|
| BGM 4 레이어 OGG | 60s × 4 × 96kbps = 약 350KB |
| SFX 60개 (또는 런타임 생성) | 0KB (jsfxr 런타임) ~ 200KB (사전 생성) |
| 폰트 (subset) | 200KB |
| 이미지 (캐릭터, UI) | 100KB |
| 코드 (gzip) | 100KB |
| **합계** | **~600KB ~ 1MB** |

> 1MB 이내 유지. LCP < 2초 사수.

## 14. Visual Reference (참조 게임)

- **Vampire Survivors** — 숫자 폭주, BGM 누적, FRENZY 톤
- **Balatro** — 카드 시너지, Run Identity, 글로우
- **Hades** — BGM 4 레이어 시스템, 보스 + 의식 + 영구 진보
- **Hyper Light Drifter** — 도트 + 네오 컬러
- **Celeste** — Juice (squash, 스크린 셰이크)
- **Brotato** — 카드 빌드, 회차 진행

## 15. 작업 분해 (AI vs 사용자)

### AI (Claude) 산출물

- BFXR 파라미터 60개 JSON
- Beepbox 4 레이어 코드 시퀀스 (또는 작곡 가이드)
- 컬러 팔레트 CSS 변수 정의
- 폰트 subset 스크립트
- 이징 함수 라이브러리
- 파티클 풀 + 셰이크 + 줌 코드
- HUD/카드 컴포넌트 코드 (CSS + DOM)
- 트랜지션 시스템

### 사용자 직접

- 비주얼 톤 최종 결정 (5/8)
- 캐릭터 도트 1마리 (Aseprite, 8시간)
  - 또는 Kenney CC0 자산으로 대체 (1시간)
- 스킨 4종 (각 4시간) — 시간 부족 시 색만 다른 변종
- BGM 검수/조정 (Beepbox)
- 시연 영상 편집 (CapCut)

## 16. 검증 체크리스트

- [ ] 60fps 유지 (모바일 30fps 이상)
- [ ] LCP < 2초
- [ ] 자산 합계 < 1MB
- [ ] BGM 4 레이어 동기 정확 (드리프트 0)
- [ ] SFX 60개 모두 트리거 가능 + 충돌 없이
- [ ] 콤보별 시각·청각 단계 명확히 다름
- [ ] 네오펑크 톤 일관성 (모든 화면)
- [ ] 도트 폰트 가독성 OK
- [ ] 모바일 화면에서 모든 UI 깨지지 않음
- [ ] 흔들림이 게임플레이 방해 X (옵션 토글 가능)
