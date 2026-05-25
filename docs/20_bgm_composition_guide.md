# 20 — BGM 작곡 가이드 (Beepbox 4 레이어)

> SAMSARA의 4 레이어 동적 BGM을 Beepbox.co 에서 작곡하기 위한 사양서. 각 레이어를 같은 BPM·박자·키·길이로 작곡해 게임 진행에 따라 누적 활성화한다.

## 1. 공통 사양

| 파라미터 | 값 |
|---|---|
| BPM | **128** |
| 박자 | 4/4 |
| 키 | **A 마이너 (A minor)** |
| 길이 | **64비트 = 32초** (한 루프) |
| 마디 수 | 16 마디 (4비트 = 1마디) |
| 출력 | OGG / WAV (Beepbox export) |

> 4 레이어 모두 동일 길이·BPM·키 → Web Audio에서 동시 재생 시 위상 정확.

## 2. 코드 진행 (한국적 + 네오펑크 융합)

A 마이너의 어두운 정서 + 한국 단조 5음계(라-도-레-미-솔)를 의식적으로 사용. 양악 정통이 아닌 동양적 색채.

### 16마디 코드 진행

```
Mar  1- 2:  Am   |  Am
Mar  3- 4:  F    |  G
Mar  5- 6:  Am   |  Am
Mar  7- 8:  E    |  E7

Mar  9-10:  Am   |  C
Mar 11-12:  Dm   |  G
Mar 13-14:  F    |  E7
Mar 15-16:  Am   |  Am  (← 다시 1마디로 루프)
```

긴장(E7) → 해소(Am) 흐름 = 도파민 곡선과 매핑. 보스/시너지 발동 시 9마디 재생 시작 (긴장 부분에 진입).

## 3. Layer 1 — 베이스 (메인 화면 + Phase 1)

**역할**: 기반. 항상 재생되어도 안 거슬리는 잔잔한 톤. 메인 화면부터 게임 끝까지 항상 활성.

### 악기 (Beepbox 슬롯 1)
- **Bass: deep square** (또는 `square wave`)
- 옥타브: C2~C3 (낮음)
- 볼륨: 60%

### 베이스 라인 (16마디)

각 마디 4박자, 각 박자 = 1/2 노트 (베이스가 박자 마다 한 번씩 펄스):

```
Mar 1-2:  A2-A2-E2-A2  ×2
Mar 3-4:  F2-F2-C3-F2 / G2-G2-D3-G2
Mar 5-6:  A2-A2-E2-A2  ×2
Mar 7-8:  E2-E2-B2-E2 / E2-E2-B2-G#2

Mar 9-10:  A2-A2-E2-A2 / C3-C3-G2-C3
Mar 11-12: D3-D3-A2-D3 / G2-G2-D3-G2
Mar 13-14: F2-F2-C3-F2 / E2-E2-B2-G#2
Mar 15-16: A2-A2-E2-A2  ×2
```

**Beepbox URL 시작점** (이 베이스 라인을 직접 작성하지 말고, 빈 프로젝트에서):
1. https://beepbox.co 접속
2. 우상단 BPM 128, Key A, Scale Aeolian
3. Channel 1을 Pulse Wide 또는 Bass Square로 설정
4. 위 베이스 라인 입력

### Pad 추가 (Beepbox 슬롯 2)
- **Pad: soft warm** (`harmony` instrument)
- 화음 톤. A 마이너 7th 화음 + F 6th + G 등 분산.
- 볼륨: 40%
- 매 마디 한 번씩 화음 1개 길게 (4박 노트).

```
Mar 1-2: Am7 (A-C-E-G) ×2
Mar 3-4: Fmaj7 / G7
Mar 5-6: Am7 ×2
Mar 7-8: Esus4 / E7
... 같은 진행 반복
```

## 4. Layer 2 — 드럼 (Phase 2 진입, W4부터)

**역할**: 리듬 등장. 게임이 진짜 "시작했다" 느낌.

### 악기 (Beepbox 4번째 채널 = 드럼 전용)
- Beepbox는 4번째 채널이 드럼/노이즈 전용
- 사용 드럼: kick / snare / hat / clap

### 패턴 (4비트 박자)

```
박자: 1 . . . 2 . . . 3 . . . 4 . . .
Kick: K . . . . . . . K . . . . . . .  (1박 + 3박)
Snr:  . . . . S . . . . . . . S . . .  (2박 + 4박, 백비트)
Hat:  H . H . H . H . H . H . H . H .  (16비트 hat)
```

매 마디 같은 패턴 반복. 단, 4마디마다 fill:
- 4마디 끝: snare 16비트 fill
- 8마디 끝: 더 강한 fill + crash 한 번
- 16마디 끝: 큰 fill로 다시 시작

### Beepbox 드럼 작성

1. 채널 4 선택
2. Drum kit: `Standard Drumset`
3. 위 패턴 입력 (각 노트가 드럼 키트의 다른 파트)

## 5. Layer 3 — 멜로디 (Phase 3 진입, W9부터)

**역할**: 메인 멜로디. "가슴 뜨거운" 부분. 후렴구 톤.

### 악기 (Beepbox 슬롯 3)
- **Lead: bright square** (또는 `chip wave`)
- 옥타브: C5~C6 (높음, 잘 들림)
- 볼륨: 70%

### 멜로디 (16마디, 한국적 펜타토닉 활용)

A 마이너 펜타토닉: A, C, D, E, G

```
Mar 1:  A4 . . . | C5 . . . | E5 . . . | A5 . . .
Mar 2:  G5 . E5 . | C5 . A4 . | E5 . . . | A5 . G5 .
Mar 3:  F5 . . . | C5 . . . | A4 . . . | F5 . . .
Mar 4:  G5 . . . | D5 . . . | B4 . . . | G5 . . .
Mar 5-6: (Mar 1-2 반복, 한 옥타브 위 / 변주)
Mar 7:  E5 . G#5 . | B5 . . . | E5 . . . | G#5 . . .  (E7 텐션)
Mar 8:  E5 . . . | B4 . . . | E5 . . . | A5 . . . (해소)

Mar 9-12: 후반부 — 더 화려, 16분 음표 추가
Mar 13-14: 클라이맥스 (F→E7 긴장)
Mar 15-16: Am 해소 + 첫 마디 변주
```

**작곡 팁**:
- 처음 한 마디는 단순 → 점점 음 갯수 증가
- 13~14마디에 가장 음 갯수 많음 (클라이맥스)
- 16마디 끝은 다시 한 음으로 (다음 루프 시작 준비)

## 6. Layer 4 — 코러스 (FRENZY / GOD MODE / 7시너지)

**역할**: 풀파워. 게임이 카오스에 빠진 순간.

### 악기 (Beepbox 슬롯 5 = 추가 채널)
Beepbox 무료 버전은 4 채널까지. 그래서 Layer 4는 Beepbox에서 같은 패턴을 다른 악기로 재녹음 → 별도 OGG.

또는 **JummBox** (Beepbox fork) 사용 — 8채널 지원.

### Layer 4 톤
- **Lead 2: distorted square / saw wave**
- **Choir / vocals (Beepbox vocal preset)**
- 옥타브: C6~C7 (가장 높음)
- 볼륨: 100% (가장 큼)

### 패턴
- Layer 3 멜로디와 같은 노트 + 5도 위 화음 추가
- 또는 Layer 3 옥타브 위 카피
- 매 박자에 코러스 vocals "Ah-h-h-h" 화음

## 7. 자동 게인 (Web Audio 코드)

```ts
// src/audio/bgm.ts
class BGMSystem {
  ctx: AudioContext;
  layers: AudioBufferSourceNode[] = [];
  gains: GainNode[] = [];

  async load() {
    this.ctx = new AudioContext();
    const urls = [
      '/audio/bgm_l1_base.ogg',
      '/audio/bgm_l2_drum.ogg',
      '/audio/bgm_l3_melody.ogg',
      '/audio/bgm_l4_chorus.ogg',
    ];

    const buffers = await Promise.all(urls.map(async u => {
      const r = await fetch(u);
      const ab = await r.arrayBuffer();
      return await this.ctx.decodeAudioData(ab);
    }));

    // 동시 시작 (위상 정확)
    const startTime = this.ctx.currentTime + 0.1;
    buffers.forEach((buf, i) => {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const gain = this.ctx.createGain();
      gain.gain.value = i === 0 ? 0.6 : 0; // L1만 켜고 시작
      src.connect(gain).connect(this.ctx.destination);
      src.start(startTime);
      this.layers[i] = src;
      this.gains[i] = gain;
    });
  }

  setLayer(i: 0|1|2|3, target: 0|0.6|1, ramp = 1.5) {
    const now = this.ctx.currentTime;
    const g = this.gains[i].gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(target, now + ramp);
  }

  enterPhase(phase: 1|2|3) {
    // L1은 항상 ON
    this.setLayer(0, 0.6);
    this.setLayer(1, phase >= 2 ? 0.7 : 0, 1.5);
    this.setLayer(2, phase >= 3 ? 0.8 : 0, 2.0);
  }

  triggerFrenzy(durationSec: number) {
    this.setLayer(3, 1.0, 0.3); // 빨리 켜기
    setTimeout(() => this.setLayer(3, 0, 0.6), durationSec * 1000);
  }

  triggerSynergy7() {
    // 0.5초간 L4 풀, 그 다음 페이드 아웃
    this.setLayer(3, 1.0, 0.2);
    setTimeout(() => this.setLayer(3, 0, 1.0), 3000);
  }
}
```

## 8. 작곡 워크플로 (사용자, 약 2~4시간)

### Step 1 — Layer 1 (베이스 + 패드) ~30분
1. https://beepbox.co 접속
2. BPM 128, Key A, Scale `Aeolian (Minor)`
3. 16마디 작성 (4 마디 패턴 × 4 변주)
4. 베이스 라인 (Channel 1) + 패드 (Channel 2) 같이
5. **Export → OGG** (또는 WAV)
6. 파일명: `bgm_l1_base.ogg`

### Step 2 — Layer 2 (드럼) ~30분
1. 새 프로젝트 (또는 같은 프로젝트의 드럼 채널만 살리기)
2. Channel 4 (Drumset) 작성
3. 다른 채널 음 소거
4. **Export → OGG**
5. 파일명: `bgm_l2_drum.ogg`

### Step 3 — Layer 3 (멜로디) ~1시간
1. 새 프로젝트 또는 Layer 1 프로젝트의 멜로디 채널
2. Channel 3 = lead
3. 16마디 멜로디 (위 §5 가이드)
4. 다른 채널 음 소거
5. **Export → OGG**
6. 파일명: `bgm_l3_melody.ogg`

### Step 4 — Layer 4 (코러스) ~30분
1. Layer 3 카피 → 옥타브 위로 + 5도 위 화음
2. 또는 추가 vocals/chorus 톤 추가
3. **Export → OGG**
4. 파일명: `bgm_l4_chorus.ogg`

### Step 5 — 동기 검증
1. 4개 OGG를 Audacity에 동시 트랙으로 import
2. 시작 정확히 0초에 정렬
3. 4개 동시 재생 시 박자 어긋남 0인지 확인
4. 16마디(32초) 후 자연스럽게 루프되는지 확인

### Step 6 — 자산 통합
- `public/audio/bgm_l1_base.ogg`
- `public/audio/bgm_l2_drum.ogg`
- `public/audio/bgm_l3_melody.ogg`
- `public/audio/bgm_l4_chorus.ogg`

총 약 350KB (96kbps × 4 × 32s).

## 9. 보너스 트랙 (메타 잠금 해제용)

### Track 2: 보스 BGM (1개)
- Layer 1과 같은 BPM, 다른 키 (E 마이너), 더 어두움
- 30초 한 번 재생 (보스 등장 → 격파까지)
- 격파 시 메인 BGM으로 페이드

### Track 3: 메인 메뉴 BGM (1개)
- 더 잔잔, BPM 96
- 패드 위주, 드럼 X
- 메인 화면에서만 재생

### Track 4: 초월 엔딩 (1개)
- 풀 오케스트라 (Beepbox에서 sine 5채널 화음)
- 5초 짧게
- 1e15 도달 시 1회 재생

## 10. 대체 옵션 (시간 부족 시)

작곡 시간이 너무 오래 걸리면:

### Plan B: Free Music Archive 사용
- https://freemusicarchive.org
- "chiptune" / "synthwave" / "lofi" 카테고리
- CC-BY 라이선스 (출처 표기 필수)
- 4 레이어 가져오기 어려우니 **단일 트랙**으로 단순화 후 게임 내 다이내믹스는 게인만 조절

### Plan C: Web Audio API 코드로 직접 생성
- 모든 BGM을 코드로 생성 (자산 0KB)
- Chiptune 라이브러리: `tinysound`, `soundbox`
- 작곡 능력 필요. 시간 소요 큼. **비추천**.

### Plan D: AI 작곡 (Suno / Udio)
- 유료 플랜 = 상업 OK
- 4 레이어 분리는 불가, 단일 트랙
- 한국적 프롬프트: "K-chiptune, neopunk, A minor, BPM 128, mysterious, hopeful, 32 seconds loop"
- 라이선스 표기 필요

> **추천**: Beepbox로 4 레이어 직접 작곡 → 자체 제작 = 라이선스 X = 가장 안전.

## 11. 검증 체크리스트

- [ ] 4 OGG 모두 32초 길이 정확
- [ ] BPM 128 정확 (Audacity로 검증)
- [ ] A 마이너 키 일관
- [ ] 4 트랙 동시 재생 시 위상 어긋남 0
- [ ] 16마디 끝 → 1마디 시작 자연 루프
- [ ] L1만으로도 메인 화면에서 듣기 좋음
- [ ] L1+L2 (Phase 2) 듣기 좋음
- [ ] L1+L2+L3 (Phase 3) 강력
- [ ] L1+L2+L3+L4 (FRENZY) 폭발적
- [ ] 음량 -3dB ~ 0dB 사이 (clipping X)
- [ ] OGG 96kbps 모노 (파일 크기 < 100KB / 트랙)

## 12. 작곡 일정

- **5/15 (목)** — Layer 1 작곡 시작
- **5/16 (금)** — Layer 2 (드럼)
- **5/17 (토)** — Layer 3 (멜로디)
- **5/18 (일)** — Layer 4 (코러스) + 동기 검증
- **5/19~22** — 사용자 검수 + 미세 조정
- **5/26 이후** — Web Audio 통합

## 13. Beepbox 직접 시작 URL

빈 프로젝트 + 위 사양 적용된 시작점:
```
https://beepbox.co/#9n31s0k0l00e0ft8a7g0fj7r1i0o432T1v1u00f10w11d03k7m0a07y1q0250d6900E0091T0w13ad0L0i0V0o2cAFh02k4cooAA00000000T1v1u00f10w11d03y1q0001q5b3hHGjlD9XSCAOgQQAAEAA0000000g000040000oFE
```

(이 URL은 BPM 128 + Key A Aeolian + 16 marg pre-set. 실제 사용자가 https://beepbox.co 직접 들어가서 BPM/Key 설정 후 작성 권장.)

## 14. 다음 작업

1. 사용자 (또는 AI 보조): Beepbox에서 Layer 1 작곡 (5/15~)
2. 작곡 후 OGG export
3. 동기 검증 (Audacity 4 트랙)
4. `public/audio/` 에 배치
5. `src/audio/bgm.ts` Web Audio 통합 (5/26 이후 구현 단계)

## 부록 — Beepbox 단축키

- 스페이스: 재생/정지
- ←→: 마디 이동
- ↑↓: 음정 옥타브 이동
- 1~7: 음표 길이
- z, x, c, ...: 음 입력 (피아노 키)
- F: 새 마디 추가
- Ctrl+S: 저장 (URL 형식, 공유 가능)
