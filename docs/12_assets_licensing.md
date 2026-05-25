# 12 — 자산 및 라이선스 트래킹

> **저작권 위반 = 실격 또는 감점.** 모든 외부 자산은 **이 표에 즉시 기록**한다.

## 1. 자산 트래킹 표 (2026-05-13 실측 갱신)

### 폰트

| 파일명 | 출처 | 라이선스 | 출처 표기 필요 | 사용 위치 |
|---|---|---|---|---|
| Pretendard (`pretendard.min.css` v1.3.9) | https://github.com/orioncactus/pretendard | OFL 1.1 | 매너상 README 표기 | `index.html` `<link rel="stylesheet">` — 전 UI 본문 |
| Galmuri11 (`Galmuri11.css`) | https://galmuri.quiple.dev (jsDelivr 호스팅) | OFL 1.1 | 매너상 README 표기 | `index.html` preload + stylesheet — HUD/도트 강조 |

### 효과음 (SFX)

| 파일명 | 출처 | 라이선스 | 출처 표기 필요 | 사용 위치 |
|---|---|---|---|---|
| `src/data/sfx.json` (67 파라미터) | 자체 (BFXR 알고리즘) | 자체 생성 (라이선스 X) | X | `src/audio/sfx.ts` 런타임 합성 — 모든 SFX 채널 |

> SFX 는 자산 파일 0KB. 런타임에 Web Audio API 로 합성.

### BGM

| 파일명 | 출처 | 라이선스 | 출처 표기 필요 | 사용 위치 |
|---|---|---|---|---|
| `src/audio/bgm.ts` (5 레이어 chiptune) | 자체 (Web Audio 합성) | 자체 생성 | X | A 마이너 / 128 BPM / 페이즈별 레이어 자동 활성화 |

> BGM 도 자산 파일 0KB. 작곡 가이드: `docs/20_bgm_composition_guide.md`, `docs/24_beepbox_prompts.md`.

### 이미지 / SVG

| 파일명 | 출처 | 라이선스 | 출처 표기 필요 | 사용 위치 |
|---|---|---|---|---|
| `public/character/*.svg` (5종 × 4 포즈 = 20 SVG) | 자체 도트 | 자체 제작 | X | 호랑이/까치/도깨비/구미호/용 — idle/attack/walk1/walk2 |
| `public/enemy/boss.svg` `dokkaebi_e.svg` `jab.svg` `jangsan.svg` `wonwi.svg` | 자체 도트 | 자체 제작 | X | 사령호랑이/사이버도깨비/jab/장산범/원귀/Death Lord |
| `public/pickup/*.svg` (7종) | 자체 도트 | 자체 제작 | X | coin/gem/heart/magnet/bomb/chest/xp |
| `public/og-image.svg` (1200×630) | 자체 SVG | 자체 제작 | X | OG 공유 이미지 |
| `public/manifest.webmanifest` | 자체 | — | X | PWA 매니페스트 |
| `public/sw.js` | 자체 | MIT (코드 일부) | X | Service Worker 오프라인 캐시 |

### 데이터 JSON (자산 아님 — 코드 동등)

| 파일명 | 출처 | 라이선스 | 비고 |
|---|---|---|---|
| `src/data/cards.json` (60카드 + 18시너지 + 30모디 + 28 RI) | 자체 | MIT (프로젝트 라이선스) | 데이터 주도 카드 엔진 |
| `src/data/i18n/{ko,en}.json` | 자체 | MIT | 한국어 + 영어 풀 번역 |
| `src/data/achievements.json` | 자체 | MIT | 업적 50개 정의 |

### 코드 / 라이브러리 (`package.json` 실측)

| 라이브러리 | 종류 | 라이선스 | 비고 |
|---|---|---|---|
| Vite | devDep | MIT | 빌드 + 핫리로드 |
| TypeScript | devDep | Apache 2.0 | strict mode |
| Vitest | devDep | MIT | 단위 테스트 149/149 |
| marked | devDep | MIT | 마크다운 → HTML (도감/크레딧 화면) |
| @supabase/supabase-js | dep | MIT | 익명 리더보드 (lazy-loaded, 52KB gzip) |

> 모든 의존성 라이선스 호환 (MIT/Apache 2.0). GPL/AGPL 0건.

## 2. 안전한 출처 사전 정리

### 폰트 — 한국어 (상업용 OK)

| 폰트 | 출처 | 라이선스 |
|---|---|---|
| Pretendard | https://github.com/orioncactus/pretendard | OFL 1.1 |
| Noto Sans KR | https://fonts.google.com | OFL 1.1 |
| 나눔스퀘어 | https://hangeul.naver.com | 상업 OK (조건) |
| Galmuri (도트) | https://galmuri.quiple.dev | OFL 1.1 |
| 마루 부리 | 눈누 | 상업 OK |
| 본명조 | https://www.adobe.com/kr/fonts | OFL |
| 카페24 폰트 | https://fonts.cafe24.com | 상업 OK |

> **OFL 폰트는 출처 표기 없이도 임베딩 가능**. 단, README에 폰트명 명시는 매너.

### 폰트 — 영문 도트/픽셀

| 폰트 | 출처 | 라이선스 |
|---|---|---|
| Press Start 2P | Google Fonts | OFL |
| VT323 | Google Fonts | OFL |
| Pixelify Sans | Google Fonts | OFL |
| Silkscreen | Google Fonts | OFL |

### 효과음 (SFX)

| 출처 | URL | 라이선스 |
|---|---|---|
| **Freesound** | https://freesound.org | CC0 / CC-BY (필터링 필수) |
| **Zapsplat** | https://zapsplat.com | 무료 가입 후, 출처 표기 |
| **Mixkit** | https://mixkit.co/free-sound-effects | 자유 사용 |
| **OpenGameArt** | https://opengameart.org | 다양 (CC0 ~ CC-BY-SA) |

### BGM

| 출처 | URL | 라이선스 |
|---|---|---|
| **Free Music Archive** | https://freemusicarchive.org | CC 다양 (필터링) |
| **Incompetech** | https://incompetech.com | CC-BY (출처 표기) |
| **Pixabay Music** | https://pixabay.com/music | 자유 사용 |
| **YouTube Audio Library** | https://studio.youtube.com | 무료 (영상에 한정 권장) |
| **Bensound** | https://bensound.com | 무료 (제한 있음 — 확인 필수) |

### 자체 생성 (라이선스 X)

| 도구 | 용도 | URL |
|---|---|---|
| **BFXR / sfxr.me** | 8비트 효과음 | https://sfxr.me |
| **ChipTone** | 효과음 | https://sfbgames.itch.io/chiptone |
| **Beepbox** | BGM (chiptune) | https://www.beepbox.co |
| **Bosca Ceoil** | BGM | https://boscaceoil.net |
| **Web Audio API** | 코드로 직접 생성 | (직접 작성) |

> **자체 생성 = 가장 안전**. 1인 개발자에게 강추.

### 아이콘 / SVG

| 출처 | URL | 라이선스 |
|---|---|---|
| **Tabler Icons** | https://tabler.io/icons | MIT |
| **Phosphor Icons** | https://phosphoricons.com | MIT |
| **Lucide** | https://lucide.dev | ISC |
| **Heroicons** | https://heroicons.com | MIT |
| **Game Icons** | https://game-icons.net | CC-BY 3.0 |

### 도트/픽셀 자산

| 출처 | URL | 라이선스 |
|---|---|---|
| **OpenGameArt** | https://opengameart.org | 다양 |
| **Itch.io 무료 자산** | https://itch.io/game-assets/free | 자산별 다름 |
| **Kenney.nl** | https://kenney.nl | CC0 (전부 자유) |
| **PixelFrog** | itch.io | 무료/유료 혼합 |

> **Kenney.nl은 모두 CC0** — 1인 개발자에게 보석.

## 3. CC 라이선스 빠른 참조

| 라이선스 | 자유도 | 출처 표기 | 상업 OK | 변형 OK | 동일 라이선스 |
|---|---|---|---|---|---|
| CC0 / Public Domain | 최대 | X | ✅ | ✅ | X |
| CC-BY | 높음 | ✅ | ✅ | ✅ | X |
| CC-BY-SA | 중간 | ✅ | ✅ | ✅ | ✅ (같은 SA로 배포) |
| CC-BY-NC | 낮음 | ✅ | **❌** | ✅ | X |
| CC-BY-ND | 낮음 | ✅ | ✅ | **❌** | X |
| CC-BY-NC-ND | 매우 낮음 | ✅ | **❌** | **❌** | X |

> **CC-BY-NC는 절대 사용 X**. 대회 수상 시 스폰서가 시범 운영(Pilot Test) 가능 권리를 받기 때문에, 비상업 한정 자산은 위험.
>
> **CC0 또는 CC-BY가 안전.**

## 4. 코드 라이선스

### 라이브러리 라이선스 매트릭스

- **MIT** ✅ 전부 OK
- **Apache 2.0** ✅ OK
- **BSD-2-Clause / BSD-3-Clause** ✅ OK
- **ISC** ✅ OK
- **GPL / LGPL / AGPL** ⚠️ 신중 — 우리 코드도 GPL이 됨 (라이선스 전염)
- **MPL 2.0** ⚠️ 파일 단위 전염

> **GPL/AGPL 라이브러리는 사용 X.** 우리 코드 라이선스가 강제됨.

### 우리 프로젝트 라이선스

- **MIT 권장**: 가장 단순, 가장 친숙
- **Apache 2.0**: 특허 조항 추가 (대규모 회사 친화)

> README에 명시. `LICENSE` 파일로 추가.

## 5. 출처 표기 위치

CC-BY 자산을 사용할 때 출처 표기는:

1. **README.md** 의 "Credits" 섹션 (필수)
2. **게임 내 옵션 → 크레딧** 화면 (권장)
3. **YouTube 영상 설명 / 종료 컷** (BGM 사용 시)

### 표기 예시

```markdown
## Credits

### Fonts
- Pretendard (OFL 1.1) — https://github.com/orioncactus/pretendard
- Galmuri (OFL 1.1) — https://galmuri.quiple.dev

### Music
- "Cyberpunk Moonlight Sonata" by Joth (CC-BY 4.0) — https://...

### Sound Effects
- All SFX generated with sfxr.me / Web Audio API

### Code Libraries
- Vite, TypeScript, Vitest — see package.json
```

## 6. 위반 위험 사례 (피해야 할 것)

❌ Google 이미지 검색에서 다운받아 사용
❌ Pinterest에서 가져온 도트 그림
❌ 유튜브에서 추출한 BGM
❌ 게임 사운드를 다른 게임에서 추출
❌ 폰트 다운 사이트에서 출처 불명 폰트
❌ "free download" 검색해서 받은 자산
❌ AI 생성 자산을 라이선스 확인 없이 사용 (각 AI 도구의 약관 확인 필수)

## 7. AI 생성 자산 사용 시

- **DACON은 생성형 AI 도구 사용 허용**
- 단, AI 생성물의 라이선스는 도구마다 다름:

| 도구 | 결과물 라이선스 |
|---|---|
| DALL-E (OpenAI) | 사용자에게 권리 양도 (단 약관 변동 가능 — 확인 필수) |
| Midjourney | 유료 플랜 = 상업 OK |
| Stable Diffusion (로컬) | 모델 라이선스 + 학습 데이터 권리 |
| Suno (음악) | 유료 플랜 = 상업 OK |
| AI 코드 (Copilot, Claude) | 사용자에게 권리 |

> **AI 생성물 사용 시 README에 명시 권장**: "이 게임의 X 자산은 DALL-E로 생성되었습니다."

## 8. 구현 단계별 체크포인트

### 자산 추가 시 즉시 할 것

1. 출처 URL 복사
2. 라이선스 텍스트 복사
3. 위 표에 1줄 추가
4. 파일명을 의미 있게 (`background_music_freemusicarchive_xxx.mp3`)
5. `assets/LICENSES.md` 에도 동일 정보 추가

### 5/26 기획서 제출 전

- 사용 예정 자산 출처 정리 → 기획서 §10 에 명시

### 6/8 산출물 제출 전

- README "Credits" 섹션 업데이트 완료
- LICENSE 파일 추가
- 게임 내 크레딧 화면 작동 확인
- 의심 자산 0건 (모두 출처 명확)

## 9. 빠른 의사결정 트리

```
새 자산 도입?
  ├── 라이선스가 CC0 / MIT / Apache 2.0?
  │     └── ✅ 사용 가능. 표에 기록만.
  ├── CC-BY?
  │     └── ✅ 사용 가능. 출처 표기 필수.
  ├── CC-BY-SA?
  │     └── ⚠️ 신중. 우리 게임도 BY-SA로 배포 (가능).
  ├── CC-BY-NC, NC-ND, ND?
  │     └── ❌ 사용 X (수상 시 라이선스 충돌).
  ├── 출처/라이선스 불명?
  │     └── ❌ 절대 사용 X.
  └── 자체 제작?
        └── ✅ 100% OK.
```

## 10. 의심스러운 경우

- 자체 생성 도구 (BFXR, Beepbox, Web Audio) 로 대체
- Kenney.nl (CC0) 자산으로 대체
- AI 도구로 새로 생성 (라이선스 확인 후)

> **의심되면 사용하지 말고 만들어라.** 1시간 만에 자체 제작이 가능한 단순 자산은 그게 더 안전하다.
