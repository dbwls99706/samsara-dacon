// verify-all — self-contained 브라우저 검증 게이트 (단일 진실원).
//
// 문제: e2e-smoke / e2e-impression / lighthouse-lite 는 모두 실행 중인 서버를 전제하는데,
//       `npm run test:all` 도, fresh clone 한 동료 개발자도 서버를 띄우지 않으면 즉시 실패했다
//       (e2e 기본 :5173, preview 는 :4173 → 포트 불일치까지 겹침).
//
// 해결: 이 스크립트가 `vite preview` 를 직접 spawn → ready 폴링 → 3 게이트를 :4173 에 대고
//       순차 실행 → 서버 teardown. Windows(개발) + ubuntu(CI) 동일하게 동작.
//
// 사용:
//   node scripts/verify-all.mjs           # dist/ 가 이미 빌드돼 있어야 함 (test:all 이 선행 build)
//   npm run test:all                      # build + vitest + 본 스크립트 풀체인
//
// Exit code: 0 = 모든 게이트 PASS, 1 = 하나라도 실패 / 서버 부팅 실패.

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const PORT = 4173;
const URL = `http://localhost:${PORT}/`;

// dist/ 가 없으면 preview 가 빈 응답만 줘서 게이트가 헷갈리게 실패한다 — 먼저 명확히 안내.
if (!existsSync('dist/index.html')) {
  console.error('[verify-all] dist/index.html 없음 — 먼저 `npm run build` 를 실행하세요.');
  process.exit(1);
}

const GATES = [
  ['e2e-smoke',      'scripts/e2e-smoke.mjs'],
  ['e2e-impression', 'scripts/e2e-impression.mjs'],
  ['lighthouse-lite','scripts/lighthouse-lite.mjs'],
];

function run(args) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, args, { stdio: 'inherit' });
    p.on('exit', (code) => resolve(code ?? 1));
    p.on('error', () => resolve(1));
  });
}

async function waitForServer(url, timeoutMs = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// vite 바이너리를 node 로 직접 실행 → shell 미경유 → 단일 PID 라 teardown 이 확실.
// (vite 의 exports 맵이 './bin/vite.js' 를 노출하지 않으므로 package.json 위치 기준으로 해석한다.)
const vitePkg = require('vite/package.json');
const viteBin = join(dirname(require.resolve('vite/package.json')), vitePkg.bin.vite);

console.log(`[verify-all] vite preview 부팅 → :${PORT}`);
const server = spawn(
  process.execPath,
  [viteBin, 'preview', '--port', String(PORT), '--strictPort'],
  { stdio: 'ignore' },
);

let exitCode = 0;
try {
  const ready = await waitForServer(URL);
  if (!ready) {
    console.error('[verify-all] preview 서버가 제한 시간 내 준비되지 않음');
    exitCode = 1;
  } else {
    console.log(`[verify-all] 서버 준비 완료 → ${GATES.length} 브라우저 게이트 실행\n`);
    for (const [name, script] of GATES) {
      console.log(`──────── ${name} ────────`);
      const code = await run([script, URL]);
      if (code !== 0) {
        console.error(`[verify-all] ✗ ${name} 실패 (exit ${code})`);
        exitCode = 1; // 게이트는 계속 돌려서 전체 리포트를 남긴다 (break 안 함)
      } else {
        console.log(`[verify-all] ✓ ${name}\n`);
      }
    }
  }
} finally {
  try { server.kill(); } catch { /* already gone */ }
}

console.log(`\n[verify-all] ${exitCode === 0 ? 'ALL GATES PASS ✓' : 'FAILED ✗'}`);
process.exit(exitCode);
