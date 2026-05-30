// SAMSARA · 윤회 — 글로벌 오류 처리
//
// 게임 루프 try/catch + window.onerror + unhandledrejection.
// 치명적 오류 시 사용자에게 복구 화면 + localStorage 초기화 옵션.

import { track } from '../services/analytics.js';

interface ErrorBoundaryState {
  errorCount: number;
  uniqueErrors: Set<string>;
  lastError: Error | null;
  recoveryShown: boolean;
}

const state: ErrorBoundaryState = {
  errorCount: 0,
  uniqueErrors: new Set(),
  lastError: null,
  recoveryShown: false,
};

// 같은 메시지는 1회만 카운트 — 매 프레임 동일 오류 누적 방지
const MAX_UNIQUE_ERRORS_BEFORE_RECOVERY = 8;

export function installErrorHandlers(): void {
  window.addEventListener('error', (e) => {
    handleError(e.error ?? new Error(e.message));
  });
  window.addEventListener('unhandledrejection', (e) => {
    const err = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
    handleError(err);
  });
}

export function handleError(err: Error): void {
  const sig = err?.message ?? String(err);
  const wasNew = !state.uniqueErrors.has(sig);
  state.uniqueErrors.add(sig);
  state.errorCount += 1;
  state.lastError = err;
  if (wasNew) {
    console.error('[SAMSARA error]', err);
    try { track({ type: 'error', data: { message: sig, stack: err?.stack } }); } catch {}
  }

  try { (window as any).__samsara_error?.(err); } catch {}

  if (state.uniqueErrors.size >= MAX_UNIQUE_ERRORS_BEFORE_RECOVERY && !state.recoveryShown) {
    showRecoveryScreen(err);
  }
}

export function safeLoop<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch (err: any) {
    handleError(err);
    return fallback;
  }
}

function showRecoveryScreen(err: Error): void {
  state.recoveryShown = true;
  const overlay = document.createElement('div');
  overlay.id = 'recovery-screen';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(10,10,26,0.95);z-index:9999;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    font-family:Galmuri11,monospace;color:#f0f0ff;padding:24px;text-align:center;
    -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);
  `;
  overlay.innerHTML = `
    <div style="font-size:64px;color:#ff2a6d;margin-bottom:8px">⚠</div>
    <h2 style="font-size:24px;color:#ff2a6d;margin:0 0 12px">예기치 않은 오류</h2>
    <p style="color:#8888aa;max-width:480px;font-size:13px;line-height:1.6">
      게임에서 ${state.uniqueErrors.size}종류의 오류가 발생했습니다. 페이지를 새로고침하거나 데이터를 초기화하세요.
    </p>
    <pre style="background:rgba(0,0,0,0.4);padding:12px;border-radius:6px;font-size:10px;color:#ff6688;max-width:480px;overflow:auto;margin:16px 0;text-align:left">${escapeHtml(err.message ?? String(err))}</pre>
    <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">
      <button id="rec-reload" style="background:linear-gradient(135deg,#ff2a6d,#05d9e8);color:#fff;border:none;padding:12px 24px;border-radius:8px;font-family:inherit;cursor:pointer">새로고침</button>
      <button id="rec-clear" style="background:#1a1a2e;color:#fff;border:1px solid #ff3366;padding:12px 24px;border-radius:8px;font-family:inherit;cursor:pointer">데이터 초기화 + 새로고침</button>
      <button id="rec-dismiss" style="background:#1a1a2e;color:#8888aa;border:1px solid #8888aa;padding:12px 24px;border-radius:8px;font-family:inherit;cursor:pointer">계속 시도</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('rec-reload')!.onclick = () => location.reload();
  document.getElementById('rec-clear')!.onclick = () => {
    try { localStorage.clear(); } catch {}
    location.reload();
  };
  document.getElementById('rec-dismiss')!.onclick = () => {
    state.errorCount = 0;
    state.uniqueErrors.clear();
    state.recoveryShown = false;
    overlay.remove();
  };
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

export function getErrorState(): Readonly<ErrorBoundaryState> { return state; }
