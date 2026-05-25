# CLAUDE.md — DACON 월간 해커톤: 웹 미니게임 챌린지

> **Mission:** 1등 수상 (상금 60만원) — DACON "10분 안에 중독시켜라" 웹 미니게임 챌린지
>
> **🛑 새 세션이라면 먼저 `RESUME.md` 를 읽어라.** (2026-05-04 종료 시점 작업 상태 + 다음 진행 가이드)

이 파일은 Claude Code가 매 세션 자동으로 읽는 프로젝트 지시서다. 새 작업을 시작할 때 이 문서와 `docs/` 하위 문서들을 먼저 참조한 뒤 작업을 진행한다.

---

## 1. 프로젝트 한 줄 요약

**별도 설치/회원가입/결제 없이 브라우저에서 바로 실행 가능한 웹 미니게임을 만들어 DACON 월간 해커톤에서 1등을 차지한다.**

- 주최: DACON
- 상금: 1등 60만 / 2등 30만 / 3등 10만 (총 100만원)
- 참가 형태: 개인 참가 확정
- 기준일: 2026-05-04 대회 개시
- 관리 디렉터리: `D:/minigame_dacon`

## 2. 절대 사수해야 할 마감일

| # | 일정 | 마감 (KST) | 산출물 |
|---|---|---|---|
| 1 | 기획서 제출 | **2026-05-26 10:00** | PDF 기획서 |
| 2 | 최종 산출물 | **2026-06-08 10:00** | 배포 URL + GitHub + YouTube |
| 3 | 1차 대중 투표 | 2026-06-08 ~ 06-12 | (투표 결과만) |
| 4 | 2차 내부 평가 | 2026-06-12 ~ 06-19 | (심사) |

> **D-day 메모**: 오늘이 2026-05-04이므로 기획서까지 22일, 산출물까지 35일 남았다. 매 세션 시작 시 `docs/15_timeline.md`로 진척 현황을 확인한다.

## 3. 평가 룩업 테이블 (총 100점)

| 항목 | 배점 | 핵심 키워드 |
|---|---|---|
| 완성도 및 안정성 | **25** | 오류 0건, 모든 핵심 기능 정상 작동 |
| 참신성 | **20** | 독창성, 차별성, 새로운 경험 |
| 사용성/UI/UX | **20** | 직관성, 명확성, 학습 부담 최소화 |
| 기획·구현 완성도 | **20** | 기획 의도 ↔ 구현 결과 일관성 |
| 재미·몰입도 | **15** | 10분 안에 핵심 재미 전달, 반복 플레이 |

**1차 점수 가중치(상위 10팀 선정 단계)**: 제출팀 60% / 참가팀 20% / 대중 20% → **다른 개발팀에게 매력적이어야 한다**(기술·디테일이 보여야 함). 이게 가장 중요한 인사이트다.

**최종 순위는 2차 내부 심사위원 정성 평가 점수만으로 결정된다.** → 즉, 1차는 컷오프(상위 10팀 통과)이고 진짜 승부는 2차 정성 평가다.

## 4. 절대 금지 (하나라도 어기면 실격)

- 사행성, 불법 행위 미화, 데이팅/매칭, 과도한 폭력/선정성, 혐오 콘텐츠
- 결제·광고·외부 수익화 연동
- 회원가입/유료 결제 후에야 심사 가능한 구조
- 외부 API 키 없이는 작동 안 하는 구조 (심사자가 키 없이 확인 가능해야 함)
- 저작권/라이선스 위반 자산 (이미지/폰트/아이콘/사운드/코드 전부)

## 5. 해커톤 컨셉의 핵심 인사이트

> "10분 안에 중독시켜라" — 제목이 곧 사양서다.

- **10분 = 첫 세션 길이**. 그 안에 "한 판 더" 욕구를 만들지 못하면 진다.
- **반복 플레이 유도**가 평가 항목에 명시 → 짧은 세션을 여러 번 돌리는 루프가 핵심.
- **차별화된 아이디어 + 적절한 난이도 + 자연스러운 게임 흐름** 세 단어가 공식 설명에 명시되어 있다.

## 6. 작업 시 의사결정 원칙

1. **완성도 우선** (25점, 최고 배점). 기능을 더 넣지 말고 있는 걸 깎아라. 깨지는 기능 한 개가 새 기능 다섯 개보다 점수에 치명적.
2. **참신성 = 한 줄 요약 가능한 트위스트**. 알려진 장르 + 한 가지 비틀기. 아무도 못 본 장르 새로 만들지 말 것.
3. **모바일 + 데스크톱 둘 다 동작해야 한다.** 심사자가 폰으로 열 가능성 높음. 터치/마우스 양쪽 입력 처리.
4. **3초 안에 첫 입력**, **30초 안에 첫 보상**, **3분 안에 첫 메타 진보**. 이 리듬을 모든 디자인 결정의 기준으로 삼는다.
5. **로딩 < 2초.** 정적 호스팅 (Vercel/Netlify/GitHub Pages) + 코드 분할.
6. **튜토리얼은 텍스트가 아니라 첫 판이어야 한다.** "읽고 시작하세요" 화면은 평가 직격탄.
7. **점수/리더보드/공유 기능**은 반복 플레이 점수(15점)에 직결. 글로벌 리더보드는 키 없는 백엔드(Supabase 익명 / Firebase / Cloudflare Workers + KV) 사용.
8. **단일 페이지 앱(SPA)**, 새로고침해도 진행 보존 (localStorage), 광고/팝업/회원가입 0건.

## 7. 디렉터리 구조

```
D:/minigame_dacon/
├── CLAUDE.md                      # 이 파일 (마스터 지시서)
├── docs/                          # 모든 기획·전략 문서 (총 19종)
│   ├── 00_competition_brief.md    # 대회 규정 정리
│   ├── 01_winning_strategy.md     # 1등 의사결정 트리
│   ├── 02_addiction_research.md   # 10분 중독 심리학
│   ├── 03_genre_analysis.md       # 장르 분석 매트릭스
│   ├── 04_concept_candidates.md   # 컨셉 후보 (선정 완료)
│   ├── 05_concept_selected.md     # ✅ 선정 컨셉 10/10 풀 사양
│   ├── 06_proposal_outline.md     # 5/26 기획서 PDF 본문
│   ├── 07_tech_stack.md           # 기술 스택 (확정)
│   ├── 08_architecture.md         # 코드 구조
│   ├── 09_uiux_guidelines.md      # UI/UX 원칙
│   ├── 10_deployment.md           # 배포 전략
│   ├── 11_demo_video.md           # 시연 영상 스크립트
│   ├── 12_assets_licensing.md     # 자산/라이선스
│   ├── 13_qa_test_plan.md         # QA 체크리스트
│   ├── 14_voting_promotion.md     # 1차 투표 홍보
│   ├── 15_timeline.md             # D-day + 일일 루틴
│   ├── 16_card_pool.md            # ⭐ 60카드 + 18시너지 풀 사양
│   ├── 17_dopamine_systems.md     # ⭐ 7 도파민 레이어 상세
│   └── 18_audio_visual_spec.md    # ⭐ BGM 4 레이어 + 60 SFX 사양
├── .claude/
│   ├── settings.json              # 권한 / 환경변수 / 마감일
│   └── skills/                    # 커스텀 스킬 (필요 시)
├── src/                           # (구현 시작 시 생성, 5/26~)
├── public/                        # (구현 시작 시 생성)
└── tests/                         # (구현 시작 시 생성)
```

## 8. 작업 모드별 가이드

### "기획" 모드 (지금 ~ 5/26)
- 모든 결정은 `docs/`에 기록. 머릿속에 두지 말고 문서화.
- 컨셉을 일찍 못 박지 말 것. 5/8까지는 최소 3개 후보를 살려둔다.
- 기획서 PDF는 사용자가 직접 PDF로 변환하므로, `docs/06_proposal_outline.md` 는 그대로 PDF 변환 가능한 마크다운으로 작성.

### "구현" 모드 (5/26 ~ 6/8)
- 5/26부터는 기획 변경 동결. 새 기능 추가는 1차 검토 후에만.
- 매 작업 후 즉시 배포 URL에서 확인 (로컬 빌드만 OK 처리 금지).
- 6/5에는 코드 동결 + 3일간 QA·시연영상·배포 검증.

### "제출" 모드 (6/5 ~ 6/8)
- 모바일 Safari/Chrome, 데스크톱 Chrome/Firefox/Edge 4종 실기기/에뮬 검증.
- 시연영상은 최종 배포 URL의 라이브 플레이로 녹화 (로컬 캡처 금지 — 사실 검증 가능).
- README에 "심사자용 빠른 시작" 섹션 필수.

## 9. 사용자 컨텍스트 (yujinhong3@gmail.com)

- DACON 닉네임: 닉네임2 (Silver tier, Lv.1, 12,355 XP)
- 휴대폰 인증: 완료 (****9719)
- 참가 신청: 완료, 개인 참가 확정
- 대시보드 URL은 daker.ai / dacon.io 양 플랫폼 모두 사용 가능

## 10. 운영 룰 (Claude 행동 지침)

- **새 세션 시작 시**: 이 문서 → `docs/15_timeline.md` → 마지막 작업 단계 문서 순으로 읽는다.
- **결정을 내릴 때**: 위 §3 평가 항목 표를 기준으로 트레이드오프를 명시한다.
- **새 기능을 제안받을 때**: §6의 의사결정 원칙으로 필터링한다. "재미있을 것 같다" 이유로 추가하지 않는다.
- **기록**: 중요한 결정은 즉시 해당 `docs/` 파일에 반영. 결정한 뒤 잊으면 같은 논의를 또 한다.
- **외부 자산 도입 시**: 라이선스를 `docs/12_assets_licensing.md`에 즉시 기록. 출처 불명 자산 절대 금지.
- **destructive 작업 (rm -rf, force push 등)**: 사용자 명시 승인 없이는 실행하지 않는다.

## 11. 컨셉 / 브랜딩 확정 (2026-05-04)

> **게임명: SAMSARA (윤회 / 輪廻)**
> **한 줄 카피**: "30초마다 새 운명을 짠다" / "Every 30 seconds, a new fate."
> **비주얼 톤**: 네오펑크 + 한국 모티브 (호랑이/까치/도깨비/구미호/용)
> **메인 컬러**: #0a0a1a (배경) / #ff2a6d (핑크) / #05d9e8 (시안) / #ffd700 (황금)
> **폰트**: Pretendard + Galmuri
> **배포 URL 가안**: https://samsara-dacon.vercel.app
>
> **10/10 풀 사양 — 7 도파민 레이어 + 60카드 + 18시너지 + 28 Run Identity + 일일 시드 + 윤회 메타**
>
> 상세: `docs/05_concept_selected.md`, `docs/16_card_pool.md`, `docs/17_dopamine_systems.md`, `docs/18_audio_visual_spec.md`

## 12. 핵심 시스템 요약 (디테일은 docs 참조)

- **3 페이즈 곡선**: 발아(W1-3) → 개화(W4-8) → 승천(W9+) — 점수 1 → 1e15
- **7 도파민 레이어**: 탭 / 콤보(×3~×500) / 카드시너지 / 모디파이어룰렛(30종) / 보스+의식 / 메타RP / 일일시드+리더보드
- **카드 60장**: 6태그(🔥❄️💰⏱️🌀🪞), 듀얼태그 9장 (태그 인스턴스 분포 11~12). + **비밀카드 5장**(S01–S05, 도전 조건 달성 시 풀 합류 — `cards.ts checkSecretCardUnlocks`, 별도 `secret_cards` 배열, 기본 60에 미포함).
- **시너지 18종**: 6태그 × 3티어(3장/5장/7장)
- **Run Identity 28**: 단일태그 6 + 듀얼 15 + 조화 1 + 궁극 6 (`src/data/cards.json:run_identities` 실측)
- **메타 진보**: RP → 카드/모디/스킨/BGM 영구 잠금해제, 메인 화면 사이클별 진화
- **일일 시드 + Supabase 글로벌 리더보드** (익명 + RLS, 키 노출 OK)
- **하이라이트 릴 자동 편집** (게임 오버 시 5초)
- **초월 엔딩** (점수 1e15 도달 시)

## 13. 작업 분할 — AI vs 사용자

### AI(Claude) 처리 (~74시간 분량 → 실제 12~20시간 만에 완료)

카드 효과 엔진, 시너지 트리거, 모디파이어 30개, 보스 시스템, Run Identity 엔진, 메타 RP 상점, 일일 시드 RNG + Supabase + RLS, i18n JSON, BFXR 60 파라미터, BGM 4 레이어 작곡 가이드, 게임 루프 + 상태 reducer, Canvas + 파티클 풀, 카메라/셰이크/줌, HUD 컴포넌트, 9 화면 라우팅, 핫스팟/QTE, 하이라이트 릴, 공유 이미지, 비밀 트리거, 업적 50개, 비속어 필터, README, 시연 스크립트, 단위 테스트, 빌드/배포.

### 사용자 직접 (~50시간, 35일 분산 = 평균 1.5시간/일)

비주얼 톤 결정(5/8), 게임명+카피 결정(5/8), 캐릭터 도트 1마리, 스킨 4종, BGM 검수, 시연 영상 녹화/편집, QA 매일 30분, 디자인 폴리시, GitHub/Vercel/Supabase 셋업, DACON 제출, 1차 투표 홍보.

## 14. 다음 액션 (D-22)

1. 🟡 **5/8까지**: 게임명 + 비주얼 톤 + 한 줄 카피 1개씩 확정 (사용자)
2. 🟡 **5/9~10**: 카드 60장 플레이버 텍스트 다듬기 (AI)
3. 🟡 **5/11~22**: 기획서 본문 다듬기 + 와이어프레임 9화면 (AI + 사용자)
4. 🟡 **5/23**: 기획서 본문 동결
5. 🟡 **5/24~25**: PDF 변환 + 검수
6. 🟡 **5/26 09:00**: 1차 제출
7. 🟡 **5/26 오후~6/1**: 코어 + 카드 시스템 (Week 4)
8. 🟡 **6/2~6/4**: Juice + 사운드 + 1차 산출물 업로드
9. 🟡 **6/5~6/7**: P1 추가 + 시연 영상 + 최종 QA
10. 🟡 **6/8 09:55**: 최종 제출

자세한 일정: `docs/15_timeline.md`.

## 15. Claude Code Game Studios 템플릿 통합 (2026-05-13)

`Donchitos/Claude-Code-Game-Studios` 의 워크플로우/에이전트 정의를 `.claude/` 에 통합. SAMSARA D-13 시점에 QA·릴리스 게이트·문서 일관성 검사를 체계화하기 위함.

### 통합된 자산 (자동 실행 없음 — 호출 시만)

| 위치 | 개수 | 용도 |
|---|---|---|
| `.claude/agents/` | 49 | 에이전트 정의 (Agent 도구 호출 시 참조). godot/unity/unreal 전문가 15종은 SAMSARA 무관하지만 함께 들어있음 — 무시. |
| `.claude/skills/` | 73 | 슬래시 명령어 정의 (`/qa-plan`, `/release-checklist`, `/balance-check` 등). Skill 도구로 호출. |
| `.claude/rules/` | 11 | 경로별 코딩 표준 (ai/engine/gameplay/ui/test 등). 명시 참조 시만 적용. |
| `.claude/_backup_20260513/` | — | 통합 전 백업 (settings.json, settings.local.json, skills/) |

### 미설치 (사용자 직접 복사 필요)

자동 실행되는 컴포넌트는 안전상 Claude 가 직접 설치하지 못함. 사용자가 PowerShell 에서 직접 실행:

```powershell
Copy-Item -Recurse -Force "D:\temp\ccgs\.claude\hooks" "D:\minigame_dacon\.claude\hooks"
Copy-Item -Recurse -Force "D:\temp\ccgs\.claude\agent-memory" "D:\minigame_dacon\.claude\agent-memory"
Copy-Item -Recurse -Force "D:\temp\ccgs\.claude\docs" "D:\minigame_dacon\.claude\_ccgs_docs"
Copy-Item -Force "D:\temp\ccgs\.claude\statusline.sh" "D:\minigame_dacon\.claude\statusline.sh"
```

- **hooks/** 는 디스크에만 있어도 무해 — `.claude/settings.json` 의 `"hooks"` 섹션에 등록해야 자동 발동. 등록 전엔 그냥 파일들.
- **statusline.sh** 도 `settings.json` 의 `"statusLine"` 에 명시 등록해야 동작.
- **_ccgs_docs/templates/** 는 41종 마크다운 템플릿 (GDD/ADR/UX spec/release checklist 등). 명시 참조용.

### SAMSARA D-13 ~ D-26 에서 유용한 슬래시 명령어

기획서 마감 (5/26) 전:
- `/review-all-gdds` — `docs/` 21종 교차 일관성 검사
- `/design-review` — 단일 문서 (예: `docs/06_proposal_outline.md`) 완성도 검토
- `/consistency-check` — 카드/시너지/RI 데이터 ↔ 문서 일치 확인

코드 동결 (6/5) ~ 산출물 마감 (6/8):
- `/balance-check` — 60카드 + 18시너지 + 30모디파이어 밸런스 outlier 검출
- `/qa-plan` — D-1 직전 QA 게이트 계획
- `/smoke-check` — 빌드 통과 + 핵심 경로 자동 테스트
- `/regression-suite` — `tests/` 135 케이스 + 미커버 경로 식별
- `/perf-profile` — 모바일 FPS / gzip 사이즈 / 로딩 < 2초 검증
- `/security-audit` — Supabase 익명 리더보드 RLS / sanity check / 비속어 필터 점검
- `/launch-checklist` — 6/8 제출 직전 30+ 항목 게이트
- `/asset-audit` — 17 SVG + i18n JSON + sfx.json 라이선스/네이밍 검사
- `/changelog` + `/patch-notes` — README 업데이트 / DACON 제출 노트

### 호출 규칙
- 슬래시 명령어는 `Skill` 도구로 호출. 예: `Skill(skill="qa-plan", args="...")`
- 49 에이전트는 `Agent` 도구의 `subagent_type` 으로 호출 가능 (현재는 일반 agent 만 자동 등록, 추가 등록 시 `.claude/agents/<name>.md` 참조).
- 모든 호출은 §6 의사결정 원칙에 따라 결과를 SAMSARA 평가 5축으로 필터링한 뒤 적용.
