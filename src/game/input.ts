// SAMSARA · 윤회 — 입력 시스템
//
// 데스크톱: WASD / 방향키
// 모바일: 가상 조이스틱 (드래그 방향)
// 출력: 정규화된 (-1..1, -1..1) 벡터.

export interface InputState {
  x: number; y: number;        // 정규화 방향 (-1..1)
  active: boolean;
}

const keys: Record<string, boolean> = {};
let touchOrigin: { x: number; y: number } | null = null;
let touchCurrent: { x: number; y: number } | null = null;
let dashRequested = false;

export function consumeDash(): boolean {
  if (dashRequested) { dashRequested = false; return true; }
  return false;
}

let joystickEl: HTMLDivElement | null = null;
let knobEl: HTMLDivElement | null = null;

export function initInput(host: HTMLElement): void {
  // 키보드
  window.addEventListener('keydown', (e) => {
    const k = e.code.toLowerCase();
    keys[k] = true;
    if (['keyw', 'keya', 'keys', 'keyd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'space'].includes(k)) {
      e.preventDefault();
    }
    if (k === 'space' && !e.repeat) dashRequested = true;
    if (k === 'shiftleft' && !e.repeat) dashRequested = true;
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code.toLowerCase()] = false;
  });
  window.addEventListener('blur', () => { for (const k of Object.keys(keys)) keys[k] = false; });

  // 터치 조이스틱 (왼쪽 1/2 화면 어디든 터치 시작 → 드래그 = 방향)
  joystickEl = document.createElement('div');
  joystickEl.style.cssText = `
    position:fixed;display:none;width:120px;height:120px;
    border:3px solid rgba(255,255,255,0.4);border-radius:50%;
    pointer-events:none;z-index:8;
    transform:translate(-50%,-50%);
  `;
  knobEl = document.createElement('div');
  knobEl.style.cssText = `
    position:absolute;left:50%;top:50%;width:48px;height:48px;
    background:rgba(255,255,255,0.6);border-radius:50%;
    transform:translate(-50%,-50%);
  `;
  joystickEl.appendChild(knobEl);
  host.appendChild(joystickEl);

  // 터치 시작 — 화면 어디든 터치하면 거기서 조이스틱 origin
  host.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // 모바일/터치만 조이스틱 사용 (마우스는 혹시 시연용)
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      touchOrigin = { x: e.clientX, y: e.clientY };
      touchCurrent = { x: e.clientX, y: e.clientY };
      if (joystickEl) {
        joystickEl.style.left = e.clientX + 'px';
        joystickEl.style.top = e.clientY + 'px';
        joystickEl.style.display = 'block';
      }
    }
  });
  host.addEventListener('pointermove', (e) => {
    if (!touchOrigin) return;
    touchCurrent = { x: e.clientX, y: e.clientY };
    if (knobEl && joystickEl) {
      let dx = touchCurrent.x - touchOrigin.x;
      let dy = touchCurrent.y - touchOrigin.y;
      const max = 50;
      const d = Math.hypot(dx, dy);
      if (d > max) { dx = dx / d * max; dy = dy / d * max; }
      knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }
  });
  const endTouch = () => {
    touchOrigin = null;
    touchCurrent = null;
    if (joystickEl) joystickEl.style.display = 'none';
    if (knobEl) knobEl.style.transform = 'translate(-50%,-50%)';
  };
  host.addEventListener('pointerup', endTouch);
  host.addEventListener('pointercancel', endTouch);
}

export function readInput(): InputState {
  let x = 0, y = 0;
  if (keys['keya'] || keys['arrowleft']) x -= 1;
  if (keys['keyd'] || keys['arrowright']) x += 1;
  if (keys['keyw'] || keys['arrowup']) y -= 1;
  if (keys['keys'] || keys['arrowdown']) y += 1;
  // 정규화
  const k = Math.hypot(x, y);
  if (k > 1) { x /= k; y /= k; }

  // 터치 조이스틱 — 12px 데드존 + 곡선 응답 (작은 입력 더 정밀, 큰 입력 빠름)
  if (touchOrigin && touchCurrent) {
    const dx = touchCurrent.x - touchOrigin.x;
    const dy = touchCurrent.y - touchOrigin.y;
    const d = Math.hypot(dx, dy);
    const deadzone = 12;
    const max = 56;
    if (d > deadzone) {
      const eff = (d - deadzone) / (max - deadzone);
      const curved = Math.min(1, Math.pow(eff, 0.85)); // 약간 더 즉각적
      x = (dx / d) * curved;
      y = (dy / d) * curved;
    }
  }

  return { x, y, active: x !== 0 || y !== 0 };
}
