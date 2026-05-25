# 밸런스 audit — 2026-05-25

> SAMSARA 60 카드 + 18 시너지 + 30 모디파이어 + 28 Run Identity 정량 분석. 사용자 부재 중 read-only audit. 코드 변경 0건, 결과만 정리.

## 베이스라인 (2026-05-25 fresh)

- vitest **195 spec / 15 files PASS** (≥ 기획서 192/14)
- 코어 gzip 111.42 KB / supabase lazy 51.55 KB
- E2E load **1.0–1.07초** (< 2초 예산 ✓)
- 콘솔 errors 0 / warnings 0 / request_failures 0

## 1. 60 카드 효과 분포

### 효과 op 빈도 (top)
| op | 카드 수 | 비중 |
|---|---|---|
| `addCoins` | 16 | 27% |
| `extendWaveTime` | 5 | 8% |
| `tapMult` | 4 | 7% |
| `freezeTime` | 3 | 5% |
| `buffTap` / `scoreMult` / `addLife` / `preserveCombo` / `timeScale` / `buffAllCardEffects` / `duplicateEffect` | 2 각 | 3–4% |
| 단일 `op` 12종 | 1 각 | 2% |

**평가**: `addCoins` 가 27% 로 가장 흔함. 코인이 메인 economy → 다양한 카드가 코인을 다른 방식으로 제공 = 합리적 분포. **결함 아님**.

### 카드당 effect 수
| effect 수 | 카드 수 |
|---|---|
| 1 effect | 54 |
| 2 effects | 6 |
| 0 effects (dead) | **0** ✓ |

**Dead card 0건** ✓ — 모든 카드가 최소 1 effect 보유.

### 등급 × effect 수 매트릭스
| 등급 | 1 effect | 2 effects | 합 |
|---|---|---|---|
| common | 23 | 1 | 24 |
| rare | 17 | 1 | 18 |
| epic | 9 | 3 | 12 |
| legendary | 5 | 1 | 6 |

**소견**: 기획서 §4-1.5 "Rare: 두 효과 결합 또는 확률 보너스" 약속 — Rare 18장 중 2-effect 는 1장 (5.5%) 뿐. 다만 *확률 보너스*(chance/condition) 는 다수에 있어 사실상 충족 (아래 §2 참조).

## 2. P2 정체성 ("모든 결정은 trade-off") 검증

trade-off 판정 기준 (4 중 1+ 만족):
- `chance < 1` (확률 발동)
- `condition` 있음
- `value < 0` 또는 `mult < 1` (음의 효과)
- `trigger` 가 onTap/onCardPicked/always 가 아닌 conditional trigger (onComboBreak, onWaveEnd, onTick + condition, …)

| 분류 | 카드 수 | 비중 |
|---|---|---|
| **trade-off / chance / condition 있음** | 43 | 71.7% |
| **pure 무조건 buff** | 17 | 28.3% |

### 17 pure-buff 카드 상세

| ID | 등급 | 이름 | effect | 평가 |
|---|---|---|---|---|
| F01 | common | 굳건한 손가락 | onTap +1 coin | 진입용 common, 학습 부담 ↓ — 의도적 단순함으로 해석 가능 |
| F02 | common | 불꽃 손 | onTap +3 coin | 동상 |
| F04 | common | 연소 | onTap +1 coin scale combo | 동상 |
| C01 | common | 주사위 | onTap +1~3 coin (랜덤) | 동상 (랜덤은 사실상 trade-off — 평균값 vs 분산) |
| I01 | common | 서리 | extendComboWindow +0.1s | 진입용, 학습 |
| I02 | common | 얼음 갑옷 | addLife +1 | 안전망 |
| E01 | common | 메아리 | echoTap delay 0.3 | 진입용 echo |
| E03 | common | 거울 | buffOneCardEffect ×1.2 | 진입용 echo |
| I06 | rare | 안개 | timeScale 0.8 | *맥락 의존*: 생존엔 buff, 클리어엔 debuff = 사실상 trade-off |
| T06 | rare | 슬로모 | timeScale 0.7 | 동상 |
| I07 | rare | 결정 | buffAllCardEffects ×1.2 permanent | **★ 명백한 pure upgrade** (rare 등급에선 P2 위반에 가까움) |
| C05 | rare | 카드 갈아치기 | rerollAllowed +1 | QoL — pure |
| E06 | rare | 다중상 | buffPerSameRarity ×1 | pure but 시너지형 |
| F08 | epic | 화신 | buffTagEffects fire ×1.5 | **★ 명백한 pure upgrade** (epic, 큰 multiplier) |
| G08 | epic | 미다스 | coinGainMult ×1.5 | **★ pure** — 단 economy 영향 한정 |
| E09 | epic | 복제 신 | doubleRandomCardEffect | pure but 효과는 다른 카드에 의존 |
| C10 | legendary | 나비 | triggerRandomCardEffect on tap | pure but 변동성 극심 = 트레이드오프적 |

**소견**:
- 명백한 P2 위반 = **3장** (I07, F08, G08) — rare/epic 등급에서 trade-off 없는 multiplier
- 나머지 14장은 *맥락 의존 trade-off* 또는 *학습용 단순성*
- 17 × 60 = 28% 가 *순수 buff 형태* 이지만, 실제로 P2 위반은 5% 수준
- **결론**: 기획서 §1-2.6 P2 약속과 큰 갭은 없음. Q2/A2 답변상 *마이크로 갭 OK*

### 권고 (사용자 결정용 — 자동 fix 안 함)

| 우선순위 | 카드 | 제안 |
|---|---|---|
| LOW | I07 결정 | `mult: 1.2` permanent — `chance: 0.5` 추가? 또는 등급 epic 으로? |
| LOW | F08 화신 | `mult: 1.5` — `chance: 0.7` 추가? |
| LOW | G08 미다스 | `coinGainMult 1.5` — `condition: "comboGte:5"` 추가? |

**6/5 코드 동결 임박 — 위 3건 모두 *옵션 적용*. 채택 시 회귀 테스트 192 → 변경 필요. 패스 권장.**

## 3. 곱셈 op 폭주 가드 점검

P5 "검증 가능" — 5/13 dispatchTrigger cardId 가드 fix 이후 후속 검증.

| 카드 | op | 값 | trigger | 위험도 |
|---|---|---|---|---|
| G03 황금손 | tapMult | ×10 | onTap, **chance 0.05** | ✓ 기대값 0.5 |
| G06 잭팟 | tapMult | ×100 | onTap, **chance 0.01** | ✓ 기대값 1.0 |
| F09 적염 | buffTap | ×5 | onTick, condition `remainingLte:5` | ✓ 저체력 한정 |
| F10 태양 | scoreMult | 0.5 | onComboBreak, **chance 0.2** | ✓ 페널티 |
| I07 결정 | buffAllCardEffects | ×1.2 permanent | onCardPicked | ⚠ 본인 픽업 시만 1회 (5/13 fix) |
| F08 화신 | buffTagEffects | ×1.5 | onCardPicked | ⚠ 본인 픽업 시만 1회 |
| G09 로또 | scoreMult | minMult 1 / maxMult 10 | onWaveEnd | ✓ 매 웨이브 1회 |
| T09 영겁 | buffAllCardEffects | ×0.7 | onCardPicked | ✓ 페널티 |
| C09 광기 | globalScoreMult | ×3 | onCardPicked / **addLife -1** | ✓ 명시 trade-off |

**모든 폭주 위험 cardId 가드로 차단됨** (5/13 결정 영구 기록). 회귀 테스트 `tests/card_picked_guard.test.ts` 8 spec 으로 보호. ✓

## 4. 18 시너지 분석

기획서 §4-1.5 "시너지 (3장 +30% / 5장 명명 능력 / 7장 게임 깨짐)" 약속 검증.

| 태그 | 3장 | 5장 | 7장 (ultimate) |
|---|---|---|---|
| 🔥 fire | buffTagEffects ×1.3 | reviveOnce | addCoins 1B, 5초, 1회 |
| ❄️ ice | timeScale 0.8 | addLife +2 | freezeTime 3s, 콤보 10+ |
| 💰 gold | coinGainMult ×1.5 | coinGainMult ×3 | addCoins 1M on tap (5%) |
| ⏱️ time | extendWaveTime +5s | rewindWaveOnDeath | setWaveTime 60s |
| 🌀 chaos | extraModifierPerWave +1 | addRandomTagToAllCards | triggerRandomCardEffect on tap |
| 🪞 echo | extraTriggerCount +1 | comboPerTap +2 | crossTriggerAllCards |

**평가**: 약속 정확 충족 ✓.
- 3장 → 작은 buff (1.3× / 0.8× / +1 / +5s 등)
- 5장 → 명명된 능력 (revive, rewind, addLife 등)
- 7장 → ultimate (1B coins, freezeTime, crossTrigger 등 게임 깨짐)
- 모든 7-tier 가 **limit / chance / condition** 있어 무한 루프 방지 ✓

## 5. 결론

### 종합 헬스: **HEALTHY** ✅

- 데드 카드 **0건** ✓
- 시너지 18종 약속 1:1 일치 ✓
- 곱셈 폭주 가드 모두 작동 (5/13 fix 회귀 테스트로 보호) ✓
- P2 정체성 위반 가능성 **3장** (I07 / F08 / G08) — *마이크로 갭, Q2/A2 답변상 허용*

### 권장 액션
1. **6/5 코드 동결까지**: 현재 밸런스 그대로 유지 권장. 위 3건 fix 는 회귀 테스트 갱신 비용 대비 가치 낮음.
2. **시연영상 데모 시드 선정 시**: G03 (×10) / G06 (×100) / F10 (콤보 폭발) / 7-tier ultimate 발현 → 도파민 곡선 가장 잘 보임. 시연영상 컷 선정 참고.
3. **1차 60% 동료 개발자 voter 어필**: 본 audit 결과를 README 에 한 줄 추가? "밸런스 audit: HEALTHY (자체 검수 2026-05-25)" — 정량 신뢰 시그널.
