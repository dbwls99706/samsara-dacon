// SAMSARA · 윤회 — BGM 4 레이어 (런타임 합성, 자산 0KB)
//
// Beepbox 스타일 chiptune 4 레이어를 Web Audio 로 합성.
// 모두 같은 BPM (128) / 키 (A 마이너) / 박자 (4/4) / 길이 (16초 1 마디) 로 동기.
// 4 레이어가 항상 동시 재생, gain 으로만 페이드 인/아웃.

import { audioCtx, isAudioUnlocked } from './sfx.js';

interface BgmLayer {
  src: AudioBufferSourceNode;
  gain: GainNode;
  buffer: AudioBuffer;
}

let layers: BgmLayer[] = [];
let bgmStarted = false;
let masterBgm: GainNode | null = null;

const BPM = 128;
const SECS_PER_BEAT = 60 / BPM;
const LOOP_BARS = 4;
const LOOP_BEATS = LOOP_BARS * 4;
const LOOP_SEC = LOOP_BEATS * SECS_PER_BEAT; // ~7.5s
const SAMPLE_RATE_TARGET = 22050;            // 작게 (자산 X 라 메모리만)

// A 마이너 펜타토닉 + 자연단음계
const SCALE_HZ = {
  A2: 110, C3: 130.81, D3: 146.83, E3: 164.81, G3: 196,
  A3: 220, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392,
  A4: 440, C5: 523.25, E5: 659.25,
};

// ─────────────────────────── 합성 ───────────────────────────

function makeBuffer(ctx: AudioContext, fillFn: (out: Float32Array, sr: number) => void): AudioBuffer {
  const sr = SAMPLE_RATE_TARGET;
  const N = Math.floor(LOOP_SEC * sr);
  // 스테레오 — L 채널 그대로, R 채널 약 6ms 지연 + 0.85 게인 (spatial 폭 확장)
  const buf = ctx.createBuffer(2, N, sr);
  const tmp = new Float32Array(N);
  fillFn(tmp, sr);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const delay = Math.floor(sr * 0.006);
  for (let i = 0; i < N; i++) {
    L[i] = tmp[i];
    R[i] = (tmp[Math.max(0, i - delay)] ?? 0) * 0.85;
  }
  return buf;
}

// 보스 모티브 — 어둡고 무거운 베이스 + 불협화음
function lBossMotif(out: Float32Array, sr: number) {
  // A2 - F2(sub) - E2 - Bb2 (어둡고 위협적)
  const F2 = 87.31, Bb2 = 116.54;
  const pattern = [SCALE_HZ.A2, F2, SCALE_HZ.E3, Bb2];
  const beatLen = sr * SECS_PER_BEAT;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const beatIdx = Math.floor(i / beatLen) % pattern.length;
    const f = pattern[beatIdx];
    const phase = (t * f) % 1;
    const sq = phase < 0.5 ? 1 : -1;
    // 트레몰로 (긴장감)
    const trem = 0.7 + 0.3 * Math.sin(2 * Math.PI * 6 * t);
    // 디톤 베이스 (불협화)
    const detuned = ((t * f * 1.012) % 1) < 0.5 ? 1 : -1;
    const beatT = (i % beatLen) / beatLen;
    const env = Math.exp(-beatT * 1.2) * 0.5 + 0.4;
    out[i] = (sq * 0.3 + detuned * 0.2) * env * trem * 0.55;
  }
}

// L1 — 베이스 + 패드 (차분, 지속). 베이스라인: A2 - E3 - C3 - G2-ish 반복.
function l1Bass(out: Float32Array, sr: number) {
  const bassPattern = [SCALE_HZ.A2, SCALE_HZ.E3, SCALE_HZ.C3, SCALE_HZ.G3];
  const beatLen = sr * SECS_PER_BEAT;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const beatIdx = Math.floor(i / beatLen) % bassPattern.length;
    const f = bassPattern[beatIdx];
    // square wave bass
    const phase = (t * f) % 1;
    const sq = phase < 0.5 ? 1 : -1;
    // pad (sine A3)
    const pad = Math.sin(2 * Math.PI * SCALE_HZ.A3 * t) * 0.15;
    // envelope per beat (gentle attack/decay)
    const beatT = (i % beatLen) / beatLen;
    const env = Math.exp(-beatT * 1.5) * 0.5 + 0.3;
    out[i] = (sq * 0.25 * env + pad) * 0.5;
  }
}

// L2 — 드럼 (퍼커션). kick (저주파 sine slide) + hi-hat (white noise pulse)
function l2Drums(out: Float32Array, sr: number) {
  const beatLen = sr * SECS_PER_BEAT;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const beatIdx = Math.floor(i / beatLen);
    const beatT = (i % beatLen) / beatLen;

    // kick on every beat
    let kick = 0;
    if (beatT < 0.1) {
      const kf = 80 * Math.exp(-beatT * 30);
      kick = Math.sin(2 * Math.PI * kf * t) * Math.exp(-beatT * 25) * 0.7;
    }

    // hi-hat on offbeat (1/2 beat)
    let hat = 0;
    const hatPhase = (i % (beatLen / 2)) / (beatLen / 2);
    if (hatPhase < 0.05) {
      hat = (Math.random() * 2 - 1) * Math.exp(-hatPhase * 60) * 0.2;
    }

    // snare on beat 2 and 4
    let snare = 0;
    if (beatIdx % 4 === 1 || beatIdx % 4 === 3) {
      if (beatT < 0.08) {
        snare = (Math.random() * 2 - 1) * Math.exp(-beatT * 18) * 0.4;
      }
    }

    out[i] = kick + hat + snare;
  }
}

// L3 — 멜로디. 펜타토닉 8노트 시퀀스, sine + triangle 믹스.
function l3Melody(out: Float32Array, sr: number) {
  const seq = [SCALE_HZ.A4, SCALE_HZ.C5, SCALE_HZ.E5, SCALE_HZ.D4, SCALE_HZ.E4, SCALE_HZ.G4, SCALE_HZ.A4, SCALE_HZ.E4];
  const noteLen = sr * SECS_PER_BEAT * 2; // 8노트 × 2비트 = 16비트 (1마디 4비트 × 4마디)
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const noteIdx = Math.floor(i / noteLen) % seq.length;
    const f = seq[noteIdx];
    const noteT = (i % noteLen) / noteLen;
    const env = Math.exp(-noteT * 2.5) * (1 - noteT) * 0.6;
    // triangle
    const phase = (t * f) % 1;
    const tri = (Math.abs(phase * 2 - 1) * 2 - 1);
    // sine 한 옥타브 위
    const sine = Math.sin(2 * Math.PI * f * 2 * t) * 0.3;
    out[i] = (tri * 0.5 + sine) * env * 0.6;
  }
}

// L4 — 코러스 (FRENZY/GOD MODE). 강한 saw + 스트링 패드 + 하이 멜로디 옥타브.
function l4Chorus(out: Float32Array, sr: number) {
  const seq = [SCALE_HZ.A4, SCALE_HZ.E5, SCALE_HZ.C5, SCALE_HZ.E5];
  const noteLen = sr * SECS_PER_BEAT * 4;
  for (let i = 0; i < out.length; i++) {
    const t = i / sr;
    const noteIdx = Math.floor(i / noteLen) % seq.length;
    const f = seq[noteIdx];
    // 강한 saw
    const saw = ((t * f) % 1) * 2 - 1;
    // 한 옥타브 위 saw 디튠
    const saw2 = ((t * f * 2.01) % 1) * 2 - 1;
    // 스트링 패드 (사인 + 옥타브)
    const pad = Math.sin(2 * Math.PI * f * 0.5 * t) * 0.4;
    const env = 0.7;
    out[i] = (saw * 0.3 + saw2 * 0.2 + pad) * env * 0.5;
  }
}

// ─────────────────────────── 외부 API ───────────────────────────

export function startBgm(): void {
  if (bgmStarted) return;
  // ⭐ Chrome autoplay policy — unlockAudio() 호출 전엔 시작 금지 (워닝 회피).
  // main.ts 의 첫 사용자 입력 핸들러가 unlockAudio() + startBgm() 을 순서 호출함.
  if (!isAudioUnlocked()) return;
  const ctx = audioCtx();
  masterBgm = ctx.createGain();
  masterBgm.gain.value = 0.18; // 마스터 BGM 낮춤
  masterBgm.connect(ctx.destination);

  const buffers = [
    makeBuffer(ctx, l1Bass),
    makeBuffer(ctx, l2Drums),
    makeBuffer(ctx, l3Melody),
    makeBuffer(ctx, l4Chorus),
    makeBuffer(ctx, lBossMotif), // L5 — 보스 페이즈
  ];
  layers = buffers.map(buf => {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain).connect(masterBgm!);
    src.start(0);
    return { src, gain, buffer: buf };
  });
  bgmStarted = true;
}

/** 보스 페이즈 인/아웃 (별도 L5 레이어 페이드) */
export function setBossLayer(active: boolean, ramp: number = 0.8): void {
  if (!bgmStarted) startBgm();
  if (!bgmStarted) return; // 사용자 입력 전엔 BGM 미시작 — silent skip
  const ctx = audioCtx();
  const layer = layers[4];
  if (!layer) return;
  const now = ctx.currentTime;
  layer.gain.gain.cancelScheduledValues(now);
  layer.gain.gain.setValueAtTime(layer.gain.gain.value, now);
  layer.gain.gain.linearRampToValueAtTime(active ? 1 : 0, now + ramp);
}

export function setBgmLayer(idx: 0 | 1 | 2 | 3 | 4, target: number, ramp: number = 1.5): void {
  if (!bgmStarted) startBgm();
  if (!bgmStarted) return; // 사용자 입력 전엔 BGM 미시작 — silent skip
  const ctx = audioCtx();
  const layer = layers[idx];
  if (!layer) return;
  const now = ctx.currentTime;
  layer.gain.gain.cancelScheduledValues(now);
  layer.gain.gain.setValueAtTime(layer.gain.gain.value, now);
  layer.gain.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, target)), now + Math.max(0.01, ramp));
}

export function setBgmVolume(v: number): void {
  if (!masterBgm) return;
  masterBgm.gain.value = Math.max(0, Math.min(1, v));
}

export function stopBgm(): void {
  if (!bgmStarted) return;
  for (const l of layers) {
    try { l.src.stop(); } catch { /* already stopped */ }
  }
  layers = [];
  bgmStarted = false;
}
