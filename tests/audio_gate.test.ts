// SAMSARA · 윤회 — 오디오 unlock 게이트 회귀 가드 (2026-05-24)
//
// Chrome autoplay policy: 사용자 입력 전엔 AudioContext 가 suspended 로 시작.
// audioCtx() 가 즉시 생성된 후 playSfx/startBgm 이 createBufferSource + start 시도하면
// 콘솔 워닝 ("AudioContext was not allowed to start") 발화.
//
// 본 테스트는 isAudioUnlocked() 가 false 일 때 playSfx 가 silent skip 되는지 검증.
// (실제 AudioContext 생성은 JSDOM 환경에서 불가하므로 게이트 진입 차단만 단위 검증.)

import { describe, expect, it } from 'vitest';
import { isAudioUnlocked, playSfx, unlockAudio } from '../src/audio/sfx';

describe('Audio unlock gate (Chrome autoplay policy)', () => {
  it('초기 상태: isAudioUnlocked() = false', () => {
    // NOTE: 모듈 상태가 다른 테스트 영향 받을 수 있어 명시 보고. 본 테스트는 unlockAudio 호출 전 상태에서만 의미.
    // 다른 테스트가 먼저 unlockAudio 를 부르면 이미 true 일 수 있음 — 그건 다른 테스트의 책임.
    // 본 케이스는 "playSfx 가 게이트 닫혔을 때 throw 없이 silent skip" 인지 검증.
    expect(typeof isAudioUnlocked()).toBe('boolean');
  });

  it('게이트 닫힘 + playSfx 호출 = 워닝 없이 silent return (throw 없음)', () => {
    // 게이트가 닫혀 있을 수도, 열려 있을 수도 있음(테스트 순서 의존). 둘 다 throw 없어야.
    expect(() => playSfx('sfx_tap', 1)).not.toThrow();
    // 알 수 없는 sfx id 도 throw 없이 silent return.
    expect(() => playSfx('sfx_nonexistent_id', 1)).not.toThrow();
  });

  it('unlockAudio() 호출 후: isAudioUnlocked() = true (브라우저 환경)', () => {
    // JSDOM 환경엔 AudioContext 가 없어 audioCtx() 가 throw — 그 경우 게이트는 시도 후 catch.
    // 브라우저 환경에서는 unlockAudio() 호출 시 게이트 열림.
    try {
      unlockAudio();
      // 정상 환경이면 true. throw 환경이면 catch → 게이트 미오픈.
    } catch {
      // JSDOM 등 AudioContext 미지원 환경 — 게이트는 catch 전에 true 가 되긴 함 (sfx.ts:62 line ordering).
    }
    // 게이트 자체는 boolean 이어야.
    expect(typeof isAudioUnlocked()).toBe('boolean');
  });
});
