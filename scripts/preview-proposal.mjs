#!/usr/bin/env node
// 기획서 HTML 을 A4 폭으로 렌더해 PNG 캡처 (LLM 시각 검수용)
import { existsSync, mkdirSync, writeFileSync, statSync, rmSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { marked } from 'marked';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MD_PATH = resolve(ROOT, 'docs/06_proposal_outline.md');
const TMP = resolve(ROOT, '.tmp-pdf');
const HTML = resolve(TMP, 'preview.html');
const OUT_DIR = resolve(TMP, 'previews');
const fwd = (p) => p.replace(/\\/g, '/');

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(existsSync);
if (!CHROME) { console.error('Chrome 없음'); process.exit(1); }

mkdirSync(OUT_DIR, { recursive: true });

const md = readFileSync(MD_PATH, 'utf8');
const body = marked.parse(md);

// 같은 스타일로 HTML 생성 (PDF 빌더와 일치 — 페이지 break 만 무력화해서 한 흐름으로 본다)
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/fonts-archive/Galmuri11/Galmuri11.css">
<style>
  html,body{margin:0;padding:24px 32px;background:#fff;color:#1a1a24;
    font-family:'Pretendard Variable',Pretendard,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;
    font-size:14px;line-height:1.62;word-break:keep-all;}
  h1{font-size:28px;border-bottom:2px solid #c92a4e;padding-bottom:8px;margin:0 0 18px}
  h2{font-size:21px;border-bottom:1px solid #d8dae3;padding-bottom:5px;margin:32px 0 12px}
  h3{font-size:17px;margin:22px 0 8px}
  h4{font-size:15px;margin:18px 0 6px}
  blockquote{border-left:3px solid #c92a4e;background:#faf4f6;padding:8px 14px;margin:12px 0}
  code{background:#f4f5f8;padding:1px 5px;border-radius:3px;font-family:Galmuri11,Consolas,monospace;font-size:90%}
  pre{background:#f4f5f8;border:1px solid #d8dae3;border-radius:4px;padding:12px;font-size:11px;
    font-family:Galmuri11,Consolas,monospace;line-height:1.4;white-space:pre-wrap;word-break:break-all;overflow:hidden}
  pre code{background:transparent;padding:0;font-size:inherit}
  table{border-collapse:collapse;width:100%;margin:10px 0;font-size:12.5px}
  th,td{border:1px solid #d8dae3;padding:6px 10px;vertical-align:top;text-align:left}
  th{background:#eef0f6;font-weight:700}
  ul,ol{padding-left:22px;margin:6px 0}
  li{margin:3px 0}
  hr{border:0;border-top:1px solid #d8dae3;margin:22px 0}
  strong{color:#0a0a1a}
</style></head><body>${body}</body></html>`;
writeFileSync(HTML, html, 'utf8');
console.log('HTML 작성:', (html.length/1024).toFixed(1), 'KB');

// A4 폭(@96dpi)=794px. 캡처 폭을 그대로 794 로, 높이는 분할 캡처.
const VIEW_W = 794;
const VIEW_H = 1123; // A4 높이 (96dpi)
const PAGES = 4;     // 첫 4페이지만 — 표지 / 정체성 / 카드 / 게임이론
const userData = resolve(TMP, 'chrome-profile-preview');
mkdirSync(userData, { recursive: true });

// Chrome 의 --screenshot 은 viewport 만 캡처. 스크롤 위치를 변경하려면 JS 필요.
// 우회: 큰 window-size 로 통째 캡처 후 crop — 그러나 Chrome 은 max viewport ≈ 16384px.
// 4페이지면 4×1123=4492px 충분히 가능.
const TOTAL_H = VIEW_H * PAGES;
const fullShot = resolve(OUT_DIR, 'full.png');
if (existsSync(fullShot)) rmSync(fullShot);

const args = [
  '--headless=new','--disable-gpu','--no-sandbox','--hide-scrollbars',
  '--disable-extensions','--disable-background-networking',
  `--user-data-dir=${fwd(userData)}`,
  `--window-size=${VIEW_W},${TOTAL_H}`,
  '--virtual-time-budget=12000',
  `--screenshot=${fwd(fullShot)}`,
  `file:///${fwd(HTML)}`,
];
console.log('Chrome 스크린샷 (1×', VIEW_W, '×', TOTAL_H, 'px)…');
spawnSync(CHROME, args, { stdio: ['ignore','pipe','pipe'] });

// 폴링
const start = Date.now();
let stable = 0, last = -1;
while (Date.now() - start < 30_000) {
  if (existsSync(fullShot)) {
    const s = statSync(fullShot).size;
    if (s > 0 && s === last) { stable++; if (stable >= 3) break; }
    else stable = 0;
    last = s;
  }
  await new Promise(r => setTimeout(r, 250));
}
if (!last || last < 1000) { console.error('스크린샷 실패'); process.exit(1); }
console.log('✅ 전체 캡처:', fullShot, `(${(last/1024).toFixed(1)} KB)`);
