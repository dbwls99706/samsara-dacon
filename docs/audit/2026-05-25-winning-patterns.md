# 1등작 패턴 분석 — 2026-05-25

> 웹서치 + 자료 종합. SAMSARA 가 game jam / 미니게임 챌린지 우승작이 공유하는 디자인 패턴을 어떻게 충족하는지 정량 매핑. DACON 운영진 답변(2026-05-19) + Q1/A1 인사이트 반영.

## 1. 30초 사이클 = 게임 디자인 sweet spot 직격 ✅

### 원천: gamedeveloper.com — "The 30-Second Hook"
> *"Your core loop should be completable in 30 seconds to 3 minutes, as data shows loops in this range maximize the 'just one more' effect."*

### SAMSARA 매핑
- **30~35초 사이클** — 코어 loop 정확히 sweet spot 의 *짧은 쪽*. "한 판 더" 욕구 maximize.
- 정체성 P1 "30초가 신성하다" — 이 원칙이 *디자인 데이터*에 직접 기반 (우연 아님).
- 데이터: *68% higher 1-month retention* with well-defined loops (Designing Addictive Gameplay).

## 2. Variable Reward 모델 (Nir Eyal Hook Model) 100% 충족 ✅

### 4단계 Hook Model
1. **Trigger** — 외부/내부 자극
2. **Action** — 단순 행동
3. **Variable Reward** — 예측 불가능한 보상
4. **Investment** — 다음 trigger 를 강화하는 누적

### SAMSARA 의 7 도파민 레이어 매핑 (기획서 §4-1)

| Hook 단계 | SAMSARA 레이어 | 시간 스케일 |
|---|---|---|
| Trigger | 탭 피드백 폭격 (8가지 동시 효과) | 0.05초 |
| Action | 단탭 + 가상 조이스틱 | 즉발 |
| Variable Reward 1 | 콤보 캐스케이드 ×3 → ×500 임계 폭발 | 1–5초 |
| Variable Reward 2 | 카드 시너지 폭발 (18 명명 능력) | 30초–3분 |
| Variable Reward 3 | 모디파이어 룰렛 (매 웨이브 다른 룰) | 30초/판 |
| Investment 1 | 보스 + 의식 (영구 런 버프) | 2.5분/회 |
| Investment 2 | 메타 진보 (RP / 카드/스킨/BGM 잠금해제) | 세션 사이 |
| Investment 3 | 일일 시드 + 글로벌 리더보드 | 일 단위 |

**Hook Model 4 단계가 7 도파민 레이어로 정확히 매핑됨** — 우연 아님, 의도 설계.

## 3. game jam 우승작 공통 패턴 vs SAMSARA

### js13kgames 2024 평가 기준
| 기준 | DACON 매핑 | SAMSARA |
|---|---|---|
| Innovation | 참신성 (20) | 게임이론 13 prop + 윤회 메타 + 한국 신화 ✓ |
| Theme | 기획·구현 일관성 (20) | "10분 안에 중독시켜라" → 30s × 18–25 cycles = 9–12.5분 ✓ |
| Gameplay | 재미·몰입 (15) | 7 도파민 레이어 + 카드 빌드 + 게임이론 결정 ✓ |
| Graphics | 사용성/UI/UX (20) | 네오펑크 + 한국 단청 + 17 SVG 도트 ✓ |
| Audio | (UX 일부) | 자체 BFXR 67 SFX + chiptune 5 레이어 BGM ✓ |
| Controls | (UX 일부) | 단탭 + 가상 조이스틱 / WASD + Space ✓ |

### Roguelite jam 우승작 핵심 패턴 (itch.io)
| 패턴 | SAMSARA |
|---|---|
| **Replayability is most critical** | 28 RI × 30 모디 × 4 biome × 13 prop = 무한 조합 ✓ |
| **Distinct visual identity** | 네오펑크 + 한국 신화 (전 세계 유일) ✓ |
| **No two runs feel identical** | 카드 풀 RNG + 모디 RNG + biome 절차 생성 ✓ |
| **Persistent progression** | RP / 환생의 사원 / 메인 화면 진화 ✓ |
| **Prestige/reset mechanics** | 라이프 0 → 게임 오버 → 다음 윤회 강화 ✓ |
| **Manual to automation curve** | 탭 → 자동 무기 발사 + onTick 카드 ✓ |

## 4. 30초 hook 디자인 원칙 vs SAMSARA W1

### 원칙
1. **Subvert initial expectations** — 단순 튜토리얼이 게임의 전부라고 오해받지 않게
2. **Showcase unique content early** — 첫 30초에 차별점 노출
3. **Don't let tutorial suggest limited gameplay** — 튜토리얼이 천장으로 보이지 않게
4. **Recontextualize familiar elements** — 친숙한 요소를 새 맥락에서 재해석
5. **Prioritize art quality** — 풍부한 비주얼이 폴리시·정성 시그널
6. **Signal progression** — 다음에 올 깊이를 미리 보여주기

### SAMSARA W1 (첫 30초) 검증
| 원칙 | SAMSARA 답 |
|---|---|
| Subvert expectations | 첫 탭에 즉시 폭발 + 콤보 + 숫자 팝업 → 단순 클리커 아님 |
| Showcase unique content | 0초에 메인 화면 자동 데모 (정체성 즉시 전달) |
| Tutorial = veteran 차단 X | "튜토리얼 건너뛰기 → 바로 플레이" 보조 옵션 (research C1 — 베테랑 차단 방지) |
| Recontextualize | 클리커(친숙) + 로그라이트(친숙) + 게임이론(친숙) → 30초 사이클(새로움) |
| Art quality | 17 SVG 도트 + 네오펑크 + 한국 단청 + 250 별 패럴렉스 |
| Signal progression | W1 끝에 카드 선택 등장 → 빌드 시스템 즉시 노출 |

## 5. 한 가지 우려 — 첫 30초 *생존 학습* 부담

### 발견 (2026-05-25 impression test)
- 자동 시뮬레이션: *순수 탭만* 으로는 W1 약 **13초에 사망** (잡귀에게)
- 가상 조이스틱 이동 추가: 32초+ 생존 가능
- 즉, **이동 학습이 첫 30초 안에 필요** — 정체성 P4 "읽지 않아도 알 수 있다" 위협 신호

### 완화 요인 (이미 구현됨)
- 첫 사용자는 "튜토리얼" 버튼 강조 (기본값) → 5 step 튜토리얼이 이동 학습 담당
- 베테랑은 "튜토리얼 건너뛰기" 보조 옵션 — 의도된 분리
- 가상 조이스틱 = "드래그 시작 지점 기준" → 화면 어디든 드래그하면 동작 (학습 용이)

### 권장 (선택)
- 메인 화면 자동 데모 에 작은 손가락 아이콘 + "드래그로 이동, 탭으로 공격" 0.5초 hint?
- 아니면 *현 상태 유지* (튜토리얼 5 step 이 이미 답)

## 6. 종합: SAMSARA 의 1등작 가능성

### 강점 (game jam 우승작 패턴 8/8 충족)
1. ✅ 30s sweet spot loop
2. ✅ Hook Model 4단계 → 7 도파민 레이어
3. ✅ Replayability 무한 (28 RI × 30 모디 × 4 biome × 13 prop)
4. ✅ Distinct visual (한국 네오펑크 — 전 세계 유일 톤)
5. ✅ No two runs identical (RNG + 절차 생성)
6. ✅ Persistent progression (RP + 환생의 사원)
7. ✅ Prestige/reset (윤회 메타)
8. ✅ Theme adherence 직격 ("10분 안에 중독시켜라" = 9–12.5분 × 18–25 사이클)

### 추가 검증 (DACON 100점 룩업 테이블 매핑)
| 평가 항목 (배점) | SAMSARA 답 | 강도 |
|---|---|---|
| 완성도/안정성 (25) | 195 spec / 14 files PASS / 빌드 워닝 0 / E2E load 1.0초 | **9/10** |
| 참신성 (20) | 게임이론 13 prop + 윤회 메타 + 한국 신화 + 7 게임이론 1:1 매핑 | **9/10** |
| 사용성/UI/UX (20) | 단탭 + 0 텍스트 튜토리얼 + 색약 모드 + iOS notch + 모바일/데스크톱 | **8/10** |
| 기획·구현 일관성 (20) | 기획서 ↔ 코드 1:1 일치 (60/28/30/18/13/4 모두 정확) | **10/10** |
| 재미·몰입 (15) | 7 도파민 레이어 + 콤보 ×500 + 28 RI + 일일 시드 | **8/10** |

**예상 자체 평가: 86/100** — 충분히 *상위 10팀 컷오프 통과 + 2차 정성 평가 경쟁권*.

### 1등 베팅 핵심 리스크
- **2차 정성 평가는 심사위원의 선호** — 우리 한국적 네오펑크 + 게임이론 컨셉이 심사위원에게 "취향" 으로 받아들여지는지가 변수
- **다른 출품팀의 강자** — 156팀 중 우리 같은 풀파워 제출작이 몇 개 있는지 알 수 없음
- **시연 영상의 첫 5초** — 영상 본 사람이 "재미있어 보인다" 결정적

### 결정 (사용자 결정용)
1. ✅ **유지**: 기획서 + 코드 그대로 — 모든 1등작 패턴 충족.
2. ⚠ **결정 필요**: 첫 30초 *이동 학습* hint 추가 여부 (작은 시각적 손가락 아이콘 0.5초). 채택 시 P4 가독성 ↑, 미채택 시 베테랑 친화 유지.
3. 🟢 **고우선 폴리시 영역**: 시연 영상 *첫 5초* 가 1등 결정. 6/6 시연영상 작업 시 W4 보스 격파 / 7-tier ultimate / 28 RI 발현 컷을 가장 앞에 배치 권장.

---

## Sources

- [The 30-Second Hook (Gamedeveloper.com)](https://www.gamedeveloper.com/design/the-30-second-hook)
- [Designing Addictive Gameplay Loops (24-Players)](https://24-players.com/designing-addictive-gameplay-loops/)
- [Game Onboarding and FTUE (HypeHype)](https://learn.hypehype.com/game-design/game-onboarding-and-first-time-user-experience)
- [js13kGames 2024 Winners (Frontend Masters)](https://frontendmasters.com/blog/js13kgames-2024-winners/)
- [Top Roguelite Game Jams (itch.io)](https://itch.io/games/in-jam/tag-roguelite)
- [Top Clicker Game Jams (itch.io)](https://itch.io/games/in-jam/tag-clicker)
- [DACON 월간 해커톤 페이지](https://daker.ai/public/hackathons/monthly-hackathon-web-minigame-challenge)
