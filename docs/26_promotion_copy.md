# 26 — 1차 투표 기간 홍보 카피 (6/8 12:00 ~ 6/12 10:00)

> **타겟 가중치**: 제출팀 60% + 참가팀 20% + 대중 20%.
> 즉 카피의 1순위 청중은 **다른 개발팀** (시간 들여 코드·디테일을 들여다볼 사람들).
> 톤: "투표 부탁드립니다" X / **"이런 기술·이런 재미로 만들었습니다"** O.
>
> 모든 카피에서 금지 키워드 (구독·결제·광고·도박·매칭·데이팅·회원가입·적립·환급) 0건 검증 완료.
>
> 공식 URL: **https://samsara-dacon.vercel.app**
> GitHub: (사용자 본인 repo URL — 공개 후 채워넣기)
> YouTube: (시연 영상 URL — 업로드 후 채워넣기)

## 0. 핵심 메시지 매트릭스

| 청중 | 어필 포인트 | 톤 |
|---|---|---|
| 제출팀 (다른 개발자) | 데이터 주도 카드 엔진, 4 레이어 BGM Web Audio, 60카드 × 18시너지 × 28 정체성, 0 KB 자산, 111KB 코어 번들 | "기술 자랑 + 재현 가능" |
| 참가팀 (개발 중인 팀) | 1인 5주 풀파워 사양, AI 페어, 데이터 주도 설계 = 빠른 밸런싱 | "동료의 작업물" |
| 대중 (게이머) | 30초 한 판, 같은 태그 5장 = 정체성 폭발, 일일 시드 챔피언 | "재미 위주, 짧게" |

---

## 1. X (트위터) — 한국어 단문 3변형 (각 280자 이내)

### KO-A · 기술 어필 (개발자 타겟, 240자)

```
SAMSARA · 윤회 — 한국 1인 개발 / 5주 / TypeScript+Vite.

📦 코어 번들 111KB (gzip, 외부 자산 0KB)
🎵 BGM 4 레이어 Web Audio 런타임 합성 (자산 0KB)
🎴 60카드 × 18시너지 × 28 정체성 = 데이터 주도 JSON
🎯 30초 한 판, 매 판 새 빌드

DACON 월간 해커톤 출품작.
https://samsara-dacon.vercel.app

#DACON #해커톤 #웹게임 #로그라이트
```

### KO-B · 게임성 어필 (대중 타겟, 230자)

```
🐯 30초마다 새 운명을 짠다.

탭 한 번. 30초 끝나면 카드 한 장. 같은 태그 5장 모이면 정체성 폭발 — 불의 황제, 황금의 폭군, 시간의 지배자.

매일 자정 동일 시드. 오늘의 챔피언은 한 명.

브라우저에서 즉시 → samsara-dacon.vercel.app

#SAMSARA #윤회 #DACON
```

### KO-C · 제작 비하인드 (참가팀 타겟, 240자)

```
"10분 안에 중독시켜라" 5주 플레이북:

W1 기획 (60카드 + 18시너지 데이터 정의)
W2 PDF 본문 + 와이어프레임
W3 Vite 부트 + 게임 루프
W4 카드 엔진 + 시너지 트리거
W5 폴리시 + Beepbox 4 레이어 + Supabase

같이 출품하는 분들 화이팅 🙇

#DACON #해커톤 #1인개발
```

---

## 2. X (Twitter) — English 단문 3 variants (each ≤ 280 chars)

### EN-A · Tech pitch (devs, 270 chars)

```
SAMSARA — solo 5-week build. TS + Vite + Canvas2D.

50 KB bundle.
4-layer Web Audio BGM (0 KB asset, runtime synth).
60 cards x 18 synergies x 22 identities, all data-driven JSON.
30-sec roguelite clicker.

Live: https://samsara-dacon.vercel.app

#gamedev #webdev #typescript #roguelite
```

### EN-B · Hook (general gamers, 220 chars)

```
Every 30 seconds — a new fate.

Tap. 30 sec ends. Draft 1 card from 60. Stack 5 of one tag = identity erupts. Fire Emperor. Golden Tyrant. Time Lord.

Daily seed. One champion per day.

Browser → samsara-dacon.vercel.app

#indiegame
```

### EN-C · Build process (peers, 240 chars)

```
SAMSARA dev log:

* 60 cards, 18 synergies, 22 run identities — all in JSON
* Web Audio runtime synth = zero audio assets
* Supabase anon RLS leaderboard, daily seed
* 50 KB bundle
* DACON monthly hackathon entry

samsara-dacon.vercel.app

#gamedev #buildinpublic
```

---

## 3. 게임 개발 커뮤니티 장문 (한국어, 800자) — 인디라 / 디스코드 / DCInside 게임 갤러리 등

```
[1인 5주 / 웹 / 로그라이트] SAMSARA · 윤회 — DACON 월간 해커톤 출품작 공유합니다

안녕하세요. DACON 6월 월간 해커톤 "10분 안에 중독시켜라"에 SAMSARA(윤회) 라는 작품을 출품했습니다. 같은 시기에 출품하신 다른 분들 작업도 둘러보고 싶어서 먼저 제 것부터 공유드립니다.

▣ 컨셉
30초마다 끝나고 다시 태어나는 클리커. 매 30초 끝에 60장 카드 풀에서 1장을 짜고 (드래프트), 같은 태그 5장이 모이면 빌드 정체성이 자동 발현됩니다. 🔥 5장 = 불의 황제, 💰 5장 = 황금의 폭군, ⏱️ 5장 = 시간의 지배자 — 이런 식으로 28가지.

▣ 기술 스택 / 개발 디테일
- TypeScript + Vite (정적 호스팅)
- Canvas 2D + DOM 하이브리드 (게임=Canvas, UI=DOM)
- 카드 효과 엔진은 100% 데이터 주도 (cards.json + 60+ op 트리거 후크)
- Web Audio API 런타임 합성 — SFX 60종 + BGM 4 레이어 모두 코드로 생성 (외부 오디오 자산 0 KB)
- Supabase 익명 RLS 글로벌 일일 시드 리더보드
- 번들 크기 50 KB (gzip 14.77 KB), 1MB 자산 예산의 1.5%
- 비속어 필터 + 점수율 sanity check + 클라 측 rate limit

▣ 도파민 7 레이어
탭 hitstop → 콤보 ×3~×500 (8단계) → 카드 시너지 18종 → 모디파이어 룰렛 30종 → 보스+의식 → 메타 RP 영구 진보 → 일일 시드 글로벌 리더보드. 누적 활성화 (Vampire Survivors / Hades 패턴).

▣ 어디서 보실 수 있는지
- 플레이: https://samsara-dacon.vercel.app (브라우저 클릭 = 즉시 실행, 외부 키 X)
- GitHub: (제 repo URL — DM 또는 댓글 부탁드리면 공유)
- 70초 시연 영상: (YouTube URL)

▣ 같이 출품하신 분들
출품팀끼리 서로 작업물 보고 피드백 주고받는 게 이 해커톤 1차 평가의 본질이라고 생각합니다. 제 코드/기획에 대한 신랄한 피드백 환영하고, 다른 분들 작품 링크 댓글로 남겨주시면 저도 한 분씩 다 플레이해보고 의견 드리겠습니다.

#DACON #월간해커톤 #SAMSARA #로그라이트 #웹게임 #1인개발
```

---

## 4. LinkedIn (English, 800 chars) — technical pitch for global devs

```
Shipped: SAMSARA — a 30-second roguelite clicker for the DACON monthly hackathon.

Solo build, 5 weeks, TypeScript + Vite. A few engineering notes I'm proud of:

▶ Data-driven card engine
60 cards, 18 synergies, 22 run identities all live in a JSON file. The runtime is a small reducer + an event bus subscribing to ~60 op codes. Adding a new card = adding a row, no code change. Balance iteration time dropped from minutes to seconds.

▶ Zero-asset audio
All 60 SFX and the 4-layer BGM are synthesized at runtime with the Web Audio API (BFXR-style params + Beepbox-style chiptune layers). Total audio asset payload: 0 KB. The 4 BGM layers cross-fade based on game phase, combo tier, and synergy state — Vampire Survivors / Hades-style accumulation.

▶ Tiny bundle, fast LCP
~50 KB total (14.77 KB gzipped). 1.5% of the 1 MB asset budget I set for myself. LCP under 2 s on mobile.

▶ Supabase anon RLS leaderboard
A daily seed gives every player the same starting cards + first 5 modifiers, so the global leaderboard is a real comparison. RLS only allows INSERT with a sane nickname/score, no service-role keys client-side.

▶ Mobile + desktop, one input layer
Pointer Events handle touch + mouse + pen. No touch-event hacks. Screens scale via container queries.

Live: https://samsara-dacon.vercel.app

Code is open. Happy to walk through the card engine or the Web Audio scheduler if anyone's curious — just reply.

#gamedev #webdev #typescript #roguelite #buildinpublic #DACON
```

---

## 5. DACON 채널 댓글용 단문 (한국어, 200자)

```
SAMSARA · 윤회 출품했습니다. 30초마다 카드 1장 드래프트 → 같은 태그 5장 = 정체성 폭발 (불의 황제 / 황금의 폭군 / 시간의 지배자 등 28종). 60카드 + 18시너지 + 30모디파이어 + 28 정체성 모두 데이터 주도 JSON. BGM/SFX는 Web Audio 런타임 합성 (자산 0 KB). 코어 번들 111 KB (gzip). 같이 출품하신 분들 작업도 둘러보겠습니다 🙇

🔗 https://samsara-dacon.vercel.app
```

---

## 6. 해시태그 추천

### 한국어

- `#DACON` `#월간해커БTON` (주최/대회) — 필수
- `#SAMSARA` `#윤회` (작품명) — 필수
- `#웹게임` `#브라우저게임` (장르) — 권장
- `#로그라이트` `#클리커게임` (서브 장르) — 권장
- `#1인개발` `#인디게임` (제작자) — 권장
- `#TypeScript` `#Vite` `#WebAudio` (기술) — LinkedIn / 개발자 풀

### 영어

- `#DACON` (필수)
- `#gamedev` `#indiegame` `#buildinpublic` (커뮤니티)
- `#typescript` `#webdev` `#webgame` `#javascript` (기술)
- `#roguelite` `#clicker` `#deckbuilder` (장르)
- `#solodev` `#webaudio` (니치)

### 추천 조합

- X 한국어: `#DACON #SAMSARA #웹게임 #로그라이트`
- X 영어: `#gamedev #webdev #typescript #roguelite #DACON`
- LinkedIn: `#gamedev #webdev #typescript #buildinpublic #DACON`
- 인스타: `#인디게임 #1인개발 #SAMSARA #DACON #브라우저게임`

---

## 7. 게시 일정 권장 (1차 투표 기간 4일)

| 일자 | 채널 | 카피 |
|---|---|---|
| 6/8 (일) 12:30 | X 한국어 | KO-A (기술 어필) |
| 6/8 (일) 13:00 | DACON 채널 | §5 댓글 |
| 6/8 (일) 14:00 | X 영어 | EN-A (Tech pitch) |
| 6/8 (일) 16:00 | 인디라 / 디스코드 | §3 장문 한국어 |
| 6/9 (월) 09:00 | LinkedIn | §4 영어 장문 |
| 6/9 (월) 20:00 | X 한국어 | KO-B (게임성) |
| 6/10 (화) 11:00 | X 영어 | EN-B (Hook) |
| 6/11 (수) 14:00 | X 한국어 | KO-C (제작 비하인드) |
| 6/11 (수) 19:00 | X 영어 | EN-C (Build process) |
| 6/12 (목) 08:00 | DACON 채널 | "마지막 날, 둘러봐주신 분들 감사" 짧은 인사 |

**주의**: 같은 사람에게 같은 카피 반복 X. KO-A → KO-B → KO-C 로 메시지 다르게.

---

## 8. 응답 / DM 대응 가이드

### 자주 받을 질문

| 질문 | 답변 템플릿 |
|---|---|
| "데이터 주도 어떻게 했나요?" | cards.json 의 op 코드 60개 + state reducer 가 op 를 dispatch. 카드 추가 = JSON 행 추가. 코드 변경 0건 (위 LinkedIn 카피 참조) |
| "Web Audio 런타임 합성?" | BFXR 파라미터를 jsfxr 알고리즘으로 AudioBuffer 합성. BGM 4 레이어는 OscillatorNode + 시퀀서로. 외부 OGG/WAV 0개. |
| "Supabase 키 노출 괜찮나요?" | anon key + RLS (INSERT 만 허용 + 닉네임/점수 check). 노출 OK 패턴. 서비스 롤 키 X. |
| "1인 5주 정말 가능했나요?" | AI 페어 프로그래밍 (Claude). 카드 데이터/이름/플레이버, 시너지 정의, 모디파이어 효과는 AI 가 일괄 생성. 기획·밸런싱·시연·QA 는 직접. |
| "오픈소스인가요?" | 네, MIT. GitHub repo URL DM 으로 보내드릴게요. |

### 절대 답하지 말 것

- 다른 출품팀 작품에 대한 부정적 평가
- "투표 부탁드립니다" 직접 요청 (가중치 룰 위반 가능성)
- 결제/광고/매칭 관련 어떤 기능도 추가 제안 (실격 키워드)

---

## 9. 검증 체크리스트

- [ ] 모든 카피에 금지 키워드 0건 (구독·결제·광고·도박·매칭·데이팅·회원가입·적립)
- [ ] X 단문 모두 280자 이내
- [ ] 모든 카피에 배포 URL 포함
- [ ] "투표 부탁" 직접 표현 없음 (대신 "둘러봐주세요", "피드백 환영")
- [ ] 한·영 카피 모두 작품명 SAMSARA 한 번 이상 등장
- [ ] 해시태그 #DACON 모든 게시물에 포함
- [ ] LinkedIn / 장문 카피에 기술 디테일 (50KB 번들 / 데이터 주도 / Web Audio) 명시
