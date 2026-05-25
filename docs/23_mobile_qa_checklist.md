# 23 — 모바일 검증 체크리스트 (실기기 + 에뮬레이터)

> 6/5 코드 동결 후 ~6/7 동안 매일 30분 실기기 + 에뮬레이터 검증.

## 디바이스 매트릭스 (필수 4개)

| # | 디바이스 | OS | 브라우저 | 비고 |
|---|---|---|---|---|
| 1 | iPhone (실기기) | iOS 16+ | Safari | safe-area-inset 검증 핵심 |
| 2 | Android (실기기) | Android 12+ | Chrome | 터치 + Vibration 가능 |
| 3 | iPad / 태블릿 | iPadOS | Safari | 가로 모드 viewport |
| 4 | 데스크톱 | macOS / Windows | Chrome / Firefox / Edge | 키보드 (Space/ESC/방향키) |

DevTools 모바일 에뮬레이터로 부족 — 반드시 실기기 1회 이상.

## 자동 점검 (npm)

```bash
npm test         # vitest 31+ 케이스
npm run build    # tsc + vite build PASS
npm run preview  # http://localhost:4173 미리보기
```

## 수동 점검 — 30가지

### 입력 (5)
- [ ] 첫 탭으로 BGM/SFX 동시 시작
- [ ] 빠른 연속 탭 (10회/초) 누락 없음
- [ ] 핫스팟 정확히 인식 (좌표 정확)
- [ ] QTE 4방향 키 모두 인식 (모바일은 onScreen 버튼 추가 필요?)
- [ ] iOS 더블탭 줌 차단 OK

### UI (5)
- [ ] iPhone 노치 영역 침범 X (safe-area-inset)
- [ ] iPad 가로 모드 깨짐 X
- [ ] 키보드 입력 시 viewport 점프 X
- [ ] 작은 화면 (320×568) 에서도 모든 요소 보임
- [ ] 한국어/영어 토글 즉시 반영

### 성능 (5)
- [ ] iPhone 6s 같은 저사양에서 30fps 이상
- [ ] 파티클 풀 500 + 콤보 ×100 시에도 끊김 X
- [ ] BGM 4 레이어 동기 정확 (드리프트 X)
- [ ] 게임 시작 LCP < 2초
- [ ] 백그라운드 → 복귀 시 정상 재개

### 화면 효과 (5)
- [ ] 화면 흔들림 OFF 토글 동작
- [ ] 색 플래시 OFF 토글 동작
- [ ] 시너지 발동 시 화면 모두 보임
- [ ] flipScreenH 모디파이어 시 입력 좌표 정확
- [ ] darkMode 시 핫스팟만 보임

### 데이터 영속 (5)
- [ ] localStorage 메타 정상 저장/복원
- [ ] 새로고침 후 누적 사이클/RP 유지
- [ ] 비밀 모디파이어 잠금해제 영구
- [ ] 업적 50개 잠금해제 영구
- [ ] 일일 시드 자정 자동 갱신

### 외부 의존 (5)
- [ ] Supabase 미설정에서도 게임 풀 동작 (graceful)
- [ ] Supabase 설정 시 리더보드 INSERT 정상
- [ ] 비속어 필터 정상 (욕설 자동 ***)
- [ ] 공유 이미지 PNG Web Share API → 다운로드 fallback
- [ ] 폰트 CDN 차단 시 system-ui fallback

## 알려진 이슈 / 미해결

- iOS PWA 모드에서 audioContext 가 첫 사용자 입력 후에만 활성화 — 메인 화면 BGM 시작은 첫 탭 대기 필요
- Android Chrome 일부 기기에서 Web Audio sample rate 22050 미지원 → 44100 fallback 자동 처리됨
- 매우 낮은 디바이스에서 파티클 500 풀 메모리 부담 — perfMode 자동 다운 (50% 감소)

## 회귀 테스트 (매 빌드)

```bash
npm test && npm run build && du -sh dist
```

목표: 빌드 < 200KB (gzip < 50KB).

## 출시 전 최종 체크

- [ ] 4개 디바이스 모두 PASS
- [ ] 시연 영상에서 사용한 기기 == 심사자가 볼 기기 (데스크톱 Chrome)
- [ ] README "심사자용 빠른 시작" 5초 안에 첫 화면 도달
- [ ] 라이선스 파일 LICENSE 존재
- [ ] docs/ 21+종 문서 모두 코드와 일치
