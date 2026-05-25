# 25 — 시연 영상 보이스오버 / 자막 스크립트 (2-Act 깊이 노출판)

> `docs/22_demo_video_shotlist.md` 의 **15컷 (총 72초 · 2-Act)** 과 1:1 정합. 한국어 + 영어 풀 트랙.
>
> **첫 3초 후킹**: YouTube 자동재생 / SNS 미리보기에서 첫 3초 안에 "이게 뭔데?" 답이 나와야 한다.
>
> **Act 전환(0:33)**: VO 톤이 "재미 소개" → "기술 브리핑"으로 한 단계 차분·확신으로 바뀐다.
> 표심의 60%가 개발자이므로 Act II 의 카피는 *과장 없이, 검증 가능하게*.
>
> **금지 키워드 0건 검증**: 구독·결제·결제하기·광고·배너·회원가입·도박·베팅·매칭·데이팅 —
> 본 문서 전체 어디에도 없음.

## 0. 보이스오버 톤 가이드

- **속도**: 한국어 분당 약 290~320 음절 / 영어 분당 약 165~180 단어. 72초에 약 360음절 / 205단어.
- **감정 곡선**: 차분 시작(0:00) → 흥분(0:16, Act I 절정) → **전환·확신(0:33, Act II)** → 임팩트(0:54 조합 수식) → 신뢰·담백(1:03 검증 카드) → 마침(1:08).
- **Act II 핵심**: 자랑이 아니라 *사실 진술*. "직접 해보세요"의 톤. 개발자는 영업당하는 걸 싫어한다.
- **녹음**: 한국어 = 직접 또는 TTS(Edge "InJoon"/"SunHi", Naver Clova). 영어 = ElevenLabs / Edge "Aria"/"Guy".
- **dB**: VO -6dB, BGM -18dB. 단 0:54 조합 수식 순간은 BGM -24dB 덕킹.

---

## 1. 한국어 버전 (72초 풀 스크립트)

### ━━ ACT I — THE LOOP ━━

#### 컷 1 · 0:00–0:03 — 메인 (후킹)
**VO**: "30초마다, 새 운명을 짠다."
**자막**: SAMSARA · 윤회 / **30초마다 새 운명을 짠다**
**비고**: 첫 음절 "30초"가 0.5초에. 무거운 베이스 1음 동시.

#### 컷 2 · 0:03–0:07 — 첫 입력
**VO**: "탭 한 번. 3초 안에 첫 손짓. 읽어야 할 설명은 없다."
**자막**: 탭 = 코인 · 튜토리얼이 곧 첫 판

#### 컷 3 · 0:07–0:12 — 콤보 ×10
**VO**: "리듬을 타면 콤보가 자라고, 화면이 깨어난다."
**자막**: 콤보 ×3 → ×10 · 가장자리 오라

#### 컷 4 · 0:12–0:16 — 카드 드래프트
**VO**: "30초가 끝나면 카드를 한 장 짠다. 예순 장 중 한 장."
**자막**: 60카드 중 1장 · 6태그

#### 컷 5 · 0:16–0:21 — 콤보 ×25 QTE
**VO**: "콤보 스물다섯, 시간이 멈춘다. 화살표 넷을 정확히 — 콤보가 백."
**자막**: ×25 → 시간정지 → ↑→↓← = ×100

#### 컷 6 · 0:21–0:26 — 시너지 의식
**VO**: "같은 태그 세 장. 시너지가 스스로 터진다."
**자막**: 🔥×3 → 시너지 자동 발동

#### 컷 7 · 0:26–0:33 — Run Identity
**VO**: "같은 태그 다섯 장이면, 빌드가 정체성을 얻는다 — 불의 황제. 스물여덟 운명 중 하나."
**자막**: 🔥×5 = 불의 황제 · 28 운명 중 1

### ━━ ACT II — THE DEPTH ━━ (톤 전환: 차분·확신)

#### 컷 8 · 0:33–0:39 — 보스 FSM
**VO**: "보스는 단순한 큰 적이 아니다. 소환·돌진·방사 — 텔레그래프를 가진 상태기계다."
**자막**: 보스 = FSM · 3 패턴 + 무적 윈도우
**오버레이**: `summon → charge → radial`

#### 컷 9 · 0:39–0:44 — 게임이론 지형
**VO**: "지형 열세 종은 장식이 아니다. 전부 위험과 보상을 저울질하는 결정이다."
**자막**: 13 지형 = 결정 트리
**오버레이**: `pressure_plate · 0.8s telegraph · risk↔reward`

#### 컷 10 · 0:44–0:49 — 절차적 biome
**VO**: "생태계 네 종은 노이즈 함수로 매번 새로 그려진다."
**자막**: 4 생태계 · value-noise FBM 절차 생성
**오버레이**: `mountain / plains / cursed / sanctuary`

#### 컷 11 · 0:49–0:54 — 윤회 도감
**VO**: "게임 오버. 윤회 도감이 평생 본 운명과 시너지를 추적한다 — 아직 못 본 게 더 많다."
**자막**: 윤회 도감 · 운명 N/28 · 시너지 N/18
**오버레이**: `못 본 운명 N개 — 매 런이 구조적으로 다름`

#### 컷 12 · 0:54–0:59 — 조합 머니샷
**VO**: "운명 스물여덟, 모디파이어 서른, 생태계 넷, 매일의 시드 — 같은 판은 두 번 없다."
**자막**: 같은 판은 두 번 없다
**오버레이 (大)**: `28 × 30 × 4 × 365 = 1,226,400 시작 — × 60카드 × 13 지형`

#### 컷 13 · 0:59–1:03 — 메타 윤회
**VO**: "모든 코인은 환생 포인트로 다시 태어나, 카드와 모디와 스킨을 영구히 연다."
**자막**: 코인 → RP → 영구 잠금해제 · 메인 진화

#### 컷 14 · 1:03–1:08 — 개발자 신뢰 카드
**VO**: "외부 자산 영, 오디오는 런타임 합성, 코어 백십일 킬로바이트, 테스트 백구십이 개 — 직접 돌려 확인하세요."
**자막**: 0 자산 · 합성 오디오 · 111KB · 192 테스트
**오버레이**: `git clone → npm i → npm test → 192 passed`

### ━━ OUTRO ━━

#### 컷 15 · 1:08–1:12 — 마무리
**VO**: "samsara-dacon.vercel.app."
**자막**: samsara-dacon.vercel.app / Open. Tap. Reborn.
**비고**: 전 BGM 레이어 0.8s 페이드아웃 + 0.2s 정적.

---

## 2. English Version (72-second full script)

### ━━ ACT I — THE LOOP ━━

**Cut 1 · 0:00–0:03** — "Every thirty seconds — a new fate is woven."
*Sub*: SAMSARA / **Every 30 seconds, a new fate**

**Cut 2 · 0:03–0:07** — "One tap. First input within three seconds. Nothing to read."
*Sub*: Tap = coin · the tutorial is the first run

**Cut 3 · 0:07–0:12** — "Find the rhythm — the combo grows, the screen wakes up."
*Sub*: Combo x3 → x10 · edge aura

**Cut 4 · 0:12–0:16** — "Every thirty seconds you draft one card — one of sixty."
*Sub*: 1 of 60 cards · 6 tags

**Cut 5 · 0:16–0:21** — "Hit twenty-five and time freezes. Four arrows, perfect — combo jumps to a hundred."
*Sub*: x25 → freeze → arrows = x100

**Cut 6 · 0:21–0:26** — "Three of a tag. The synergy fires on its own."
*Sub*: Fire x3 → synergy auto-fires

**Cut 7 · 0:26–0:33** — "Five of a tag and the build earns an identity — Fire Emperor. One of twenty-eight."
*Sub*: Fire x5 = Fire Emperor · 1 of 28 identities

### ━━ ACT II — THE DEPTH ━━ (tone shift: calm, factual)

**Cut 8 · 0:33–0:39** — "The boss isn't just a big enemy. Summon, charge, radial — it's a telegraphed state machine."
*Sub*: Boss = FSM · 3 patterns + invuln window
*Overlay*: `summon → charge → radial`

**Cut 9 · 0:39–0:44** — "The thirteen props aren't decoration. Every one is a risk-versus-reward decision."
*Sub*: 13 props = decision trees
*Overlay*: `pressure_plate · 0.8s telegraph · risk↔reward`

**Cut 10 · 0:44–0:49** — "Four biomes, redrawn every run by a noise function."
*Sub*: 4 biomes · procedural value-noise FBM
*Overlay*: `mountain / plains / cursed / sanctuary`

**Cut 11 · 0:49–0:54** — "Game over. The Codex tracks every identity and synergy you've ever seen — most you haven't."
*Sub*: Codex · identities N/28 · synergies N/18
*Overlay*: `N runs unseen — every run structurally different`

**Cut 12 · 0:54–0:59** — "Twenty-eight identities, thirty modifiers, four biomes, a daily seed — no two runs alike."
*Sub*: No two runs alike
*Overlay (large)*: `28 × 30 × 4 × 365 = 1,226,400 starts — × 60 cards × 13 props`

**Cut 13 · 0:59–1:03** — "Every coin is reborn as Rebirth Points, unlocking cards, mods and skins for good."
*Sub*: Coins → RP → permanent meta

**Cut 14 · 1:03–1:08** — "Zero external assets. Synthesized audio. A 111-kilobyte core. 192 tests. Run it yourself."
*Sub*: 0 assets · synth audio · 111KB · 192 tests
*Overlay*: `git clone → npm i → npm test → 192 passed`

### ━━ OUTRO ━━

**Cut 15 · 1:08–1:12** — "samsara-dacon.vercel.app."
*Sub*: samsara-dacon.vercel.app / Open. Tap. Reborn.

---

## 3. 컷별 한·영 자막 동시 표시 매트릭스

CapCut: 한국어(위, 18px Galmuri11) + 영어(아래, 14px Press Start 2P) 동시. Act II 는 monospace 오버레이 트랙 추가.

| Cut | KO (위) | EN (아래) | Act II 오버레이 |
|---|---|---|---|
| 1 | 30초마다 새 운명을 짠다 | Every 30 seconds, a new fate | — |
| 2 | 탭 = 코인 · 설명 없음 | Tap = coin · no reading | — |
| 3 | 콤보 ×10 + 오라 | Combo x10 + aura | — |
| 4 | 60카드 중 1장 | 1 of 60 cards | — |
| 5 | QTE ↑→↓← = ×100 | QTE arrows = x100 | — |
| 6 | 🔥×3 시너지 | Fire x3 synergy | — |
| 7 | 🔥×5 = 불의 황제 | Fire x5 = Fire Emperor | — |
| 8 | 보스 FSM 3패턴 | Boss FSM · 3 patterns | `summon→charge→radial` |
| 9 | 13 지형 = 결정 트리 | 13 props = decisions | `0.8s telegraph · risk↔reward` |
| 10 | 4 생태계 FBM 절차생성 | 4 biomes · FBM noise | `mountain/plains/cursed/sanctuary` |
| 11 | 윤회 도감 N/28 · N/18 | Codex N/28 · N/18 | `못 본 운명 N개` |
| 12 | 같은 판은 두 번 없다 | No two runs alike | **`28×30×4×365 = 1,226,400`** |
| 13 | RP → 영구 잠금해제 | RP → permanent meta | — |
| 14 | 0 자산 · 111KB · 192 테스트 | 0 assets · 111KB · 192 tests | `npm test → 192 passed` |
| 15 | samsara-dacon.vercel.app | samsara-dacon.vercel.app | — |

## 4. 검증 체크리스트

- [ ] 한국어 VO 실측 72초 ± 2초 / 영어 VO 실측 72초 ± 2초
- [ ] 첫 3초 안에 "30초마다 새 운명을 짠다" 들림
- [ ] 0:33 Act 전환에서 VO 톤이 차분·확신으로 바뀜 (영업톤 아님)
- [ ] 컷 12·14 오버레이 숫자 = docs/22 §0 표 = 소스 실측 (28/30/4/365/111/192) 완전 일치
- [ ] 컷 14 "직접 돌려 확인" 메시지가 명확 (개발자 신뢰)
- [ ] 자막 한·영 동시 · 한자 0건
- [ ] BGM dB < VO dB · 컷 12 덕킹 처리
- [ ] 마지막 컷 배포 URL 음성 + 자막
- [ ] **금지 키워드 0건** (구독·결제·광고·배너·회원가입·도박·베팅·매칭·데이팅)
- [ ] CapCut export 1080p 60fps MP4 30Mbps · YouTube 제목/설명 동일 URL

## 5. 녹음·합성 가이드 (사용자 직접)

### 한국어 (택 1)
- **A 직접 녹음**: 핸드폰 Voice Memos, 조용한 방, 입에서 15cm. 컷별로 끊어 녹음.
- **B Edge TTS**: "읽어주기" → "InJoon(남)"/"SunHi(여)" → 시스템 오디오 OBS 캡처 → MP3.
- **C Naver Clova**: clovavoice.naver.com (월 1만자 무료, 캐주얼 톤).

### 영어 (택 1)
- **A ElevenLabs**: 무료 1만자/월, "Adam"/"Bella". · **B Edge TTS**: "Aria(US)"/"Guy(US)". · **C 직접 녹음**.

### 후작업 (Audacity)
1. import → 2. Noise Reduction 12dB → 3. Normalize -3dB → 4. Compressor (Thr -12dB, 3:1) → 5. Export MP3 192kbps mono.

### CapCut 배치
1. Video1: OBS 게임 플레이 · 2. Audio1: 게임 BGM/SFX(-18dB) · 3. Audio2: VO(-6dB) · 4. Subtitle: 한·영 동시 · 5. Overlay: Act II monospace(§3).

## 6. 60초 / 90초 변형

### 60초 단축 (SNS / Shorts)
- 컷 2+3 통합(4초) · 컷 9 생략 · 컷 10 → 3초 · 컷 13 생략.
- **컷 12(조합 수식)·14(검증 카드)는 절대 자르지 않는다** — 60% 표심 핵심.

### 90초 확장 (여유 시)
- 컷 8(보스 FSM) → 10초: 3 패턴 각각 또렷이 + 무적 윈도우 시각화.
- 컷 11(도감) → 8초: 메인/리더보드의 도감 패널도 함께 (어디서나 깊이가 보임).
- 컷 14(검증) → 8초: `npm run build` → 111KB gzip 출력까지 PiP.

> 60초·90초 두 버전 모두 export 권장 (Shorts < 60s, 일반 < 90s 둘 다 커버).
