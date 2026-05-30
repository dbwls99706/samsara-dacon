// SAMSARA · 윤회 — SFX 런타임 합성
//
// jsfxr 의존성 없이 Web Audio API 만으로 BFXR 스타일 SFX 합성.
// 자산 다운 0KB. 60개 SFX 모두 런타임 생성 + 캐시.
//
// 알고리즘 요약 (sfxr.js 변형):
//  - osc: square / saw / sine / triangle / whistle / noise(white)
//  - frequency 변화: base + slide·t + slide²/2·t²
//  - envelope: attack → sustain → decay (linear)
//  - phaser: simple feedback delay
//  - vibrato: lfo on freq

import sfxData from '../data/sfx.json' with { type: 'json' };

export interface SfxParams {
  wave?: number;
  freq?: number;       // 0~1 → 80Hz ~ 4000Hz
  freqSlide?: number;  // -1~1 → 주파수 변화율
  envAttack?: number;  // 0~1 → 0~0.5초
  envSustain?: number; // 0~1 → 0~1초
  envDecay?: number;   // 0~1 → 0~2초
  arpSpeed?: number;   // 0~1 → 빠른 옥타브 점프
  arpMod?: number;
  phaserOffset?: number;
  phaserSweep?: number;
  vibStrength?: number;
  vibSpeed?: number;
  lpFilter?: number;   // 0~1 → 100Hz ~ 8000Hz cutoff
  vol?: number;        // 0~1 마스터
  [k: string]: unknown;
}

const DATA = sfxData as { sfx: Record<string, SfxParams> };

// 동시 재생 한도 + 80ms 중복 차단 (볼륨 누적 방지). 12 채널 — 다발 발사 누락 방지.
const MAX_CONCURRENT = 12;
const DEDUP_MS = 80;

let _ctx: AudioContext | null = null;
const bufferCache = new Map<string, AudioBuffer>();
const lastPlayed = new Map<string, number>();
let activeNodes = 0;
let masterGain: GainNode | null = null;
// ⭐ Chrome autoplay policy 게이트 — unlockAudio() 호출 전엔 audioCtx() 생성도 금지.
// 생성 후 createBufferSource + start 시 콘솔 워닝 ("AudioContext was not allowed to start") 발화.
// 게이트 도입 후 메인 화면 자동 데모 호출은 silent skip, 첫 사용자 입력 시 unlockAudio → 모두 활성화.
let _audioUnlocked = false;

/** unlockAudio() 호출 여부. playSfx/setBgmLayer 같은 라이프사이클 호출이 ctx 생성 워닝 회피용 게이트로 사용. */
export function isAudioUnlocked(): boolean { return _audioUnlocked; }

export function audioCtx(): AudioContext {
  if (!_ctx) {
    const Ctor = (typeof window !== 'undefined' && (window.AudioContext || (window as any).webkitAudioContext)) as typeof AudioContext;
    _ctx = new Ctor();
    masterGain = _ctx.createGain();
    masterGain.gain.value = 0.35; // 마스터 SFX 낮춤 (이전 0.8)
    masterGain.connect(_ctx.destination);
  }
  return _ctx;
}

export function setSfxVolume(v: number): void {
  // ctx 가 아직 없으면 강제 생성하지 않음 (워닝 회피) — masterGain 도 null
  if (!_ctx) return;
  if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, v));
}

/** 일부 브라우저는 사용자 입력 후에만 오디오 재생 가능. 첫 사용자 입력 시(제스처 콜스택 내) 호출. */
export function unlockAudio(): void {
  const ctx = audioCtx();
  // resume 은 매 호출 멱등 — iOS 는 제스처 안에서 resume() 해야 suspended 해제됨.
  if (ctx.state === 'suspended') void ctx.resume();
  if (!_audioUnlocked) {
    _audioUnlocked = true;
    // ⭐ iOS Safari 완전 언락 — 제스처 내 무음 버퍼 1회 재생(고전 패턴). resume() 만으론
    //   일부 iOS 버전이 suspended 로 되돌아가 무음. 무음 버퍼 start 로 확실히 깨운다.
    try {
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch { /* createBuffer 미지원 등 — resume() 만으로 폴백 */ }
  }
}

/** SFX 재생 — 첫 호출 시 합성 + 캐시. */
export interface SfxOpts {
  /** 반음 단위 pitch shift (콤보 ladder용). 양수 = 더 높음. -12 ~ +12 권장. */
  semitones?: number;
}

export function playSfx(id: string, volumeMult: number = 1, opts: SfxOpts = {}): void {
  const params = DATA.sfx[id];
  if (!params) return;

  // ⭐ Chrome autoplay policy — 사용자 입력 전엔 silent skip (워닝 회피).
  if (!_audioUnlocked) return;

  // 동시 재생 한도
  if (activeNodes >= MAX_CONCURRENT) return;

  // 중복 dedup
  const now = performance.now();
  const last = lastPlayed.get(id) ?? 0;
  if (now - last < DEDUP_MS) return;
  lastPlayed.set(id, now);

  const ctx = audioCtx();
  let buf = bufferCache.get(id);
  if (!buf) {
    buf = synthesize(ctx, params);
    bufferCache.set(id, buf);
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;
  // ⭐ pitch shift — playbackRate 비율 = 2^(반음/12)
  if (opts.semitones && opts.semitones !== 0) {
    src.playbackRate.value = Math.pow(2, opts.semitones / 12);
  }
  const g = ctx.createGain();
  g.gain.value = (params.vol ?? 0.6) * volumeMult * 0.55; // per-SFX 도 낮춤
  src.connect(g).connect(masterGain ?? ctx.destination);
  src.start(0);
  activeNodes += 1;
  src.onended = () => { activeNodes = Math.max(0, activeNodes - 1); };
}

// ─────────────────────────── 합성기 ───────────────────────────

function synthesize(ctx: AudioContext, p: SfxParams): AudioBuffer {
  const sr = ctx.sampleRate;
  const attack  = (p.envAttack  ?? 0)    * 0.5;
  const sustain = (p.envSustain ?? 0.15) * 1.0;
  const decay   = (p.envDecay   ?? 0.2)  * 2.0;
  const total = Math.max(0.05, attack + sustain + decay);
  const N = Math.floor(total * sr);
  const buf = ctx.createBuffer(1, N, sr);
  const out = buf.getChannelData(0);

  const wave = p.wave ?? 0;
  const baseFreq = 80 + (p.freq ?? 0.3) * (4000 - 80);
  const slide = (p.freqSlide ?? 0) * 0.0008;
  const arpSpeed = (p.arpSpeed ?? 0) * 25;     // arp 발생 빈도
  const arpMod = (p.arpMod ?? 0) * 1.5;        // 옥타브 추가
  const vibSpeed = (p.vibSpeed ?? 0) * 30;
  const vibStrength = (p.vibStrength ?? 0) * 50;
  const lpCutoff = p.lpFilter ? 100 + (p.lpFilter as number) * 7900 : 0;

  let phase = 0;
  let arpTimer = 0;
  let arpFactor = 1;
  let prev = 0;
  // 단순 1극 LP filter
  const lpAlpha = lpCutoff > 0 ? 1 - Math.exp(-2 * Math.PI * lpCutoff / sr) : 1;

  for (let i = 0; i < N; i++) {
    const t = i / sr;

    // arp 옥타브 점프
    if (arpSpeed > 0) {
      arpTimer += arpSpeed / sr;
      if (arpTimer >= 1) {
        arpTimer = 0;
        arpFactor = arpFactor === 1 ? 1 + arpMod : 1;
      }
    }

    // freq + vib
    const vib = vibStrength > 0 ? Math.sin(2 * Math.PI * vibSpeed * t) * vibStrength : 0;
    const f = Math.max(20, (baseFreq + slide * sr * t) * arpFactor + vib);
    phase += (2 * Math.PI * f) / sr;
    if (phase > 2 * Math.PI) phase -= 2 * Math.PI;

    // wave shape — 약간 더 거친 톤 (squa·saw 에 하모닉 추가, 노이즈에 lo-pass 잔향)
    let s = 0;
    switch (wave) {
      case 0: { // square + 3차 하모닉으로 두꺼운 음색
        const sq = phase < Math.PI ? 1 : -1;
        const h3 = phase < Math.PI / 1.5 || phase > Math.PI * 1.5 ? 0.25 : -0.25;
        s = sq + h3 * 0.4;
        break;
      }
      case 1: { // saw + 옥타브 디톤
        const a = (phase / Math.PI) - 1;
        const b = ((phase * 2.01) % (2 * Math.PI) / Math.PI) - 1;
        s = a * 0.7 + b * 0.35;
        break;
      }
      case 2: s = Math.sin(phase) + Math.sin(phase * 3) * 0.12; break;          // sine + 가벼운 하모닉
      case 3: s = Math.random() * 2 - 1; break;                                  // noise
      case 4: s = Math.abs((phase / Math.PI) - 1) * 2 - 1; break;                // triangle
      case 6: s = Math.sin(phase) * 0.5 + Math.sin(phase * 2) * 0.3 + Math.sin(phase * 3) * 0.2; break;
      default: s = Math.sin(phase);
    }

    // 부드러운 saturation/distortion — 임팩트 강화하되 클립 방지
    s = Math.tanh(s * 1.4) * 0.9;

    // envelope
    let env = 1;
    if (t < attack) env = t / attack;
    else if (t < attack + sustain) env = 1;
    else env = Math.max(0, 1 - (t - attack - sustain) / decay);

    let v = s * env;

    // LP filter
    if (lpCutoff > 0) {
      v = prev + lpAlpha * (v - prev);
      prev = v;
    }

    // 사운드 크기 유지 — 0.35 로 동일 (격함은 음색에서)
    out[i] = v * 0.35;
  }

  return buf;
}
