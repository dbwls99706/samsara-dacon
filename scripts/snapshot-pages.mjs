#!/usr/bin/env node
// 본문 페이지 2-3(목차 + §1 게임 개요 + §1-2 컨셉) 시각 검수용 캡처
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { marked } from 'marked';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TMP = resolve(ROOT, '.tmp-pdf');
mkdirSync(TMP, { recursive: true });
const fwd = (p) => p.replace(/\\/g, '/');
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(existsSync);

let md = readFileSync(resolve(ROOT, 'docs/06_proposal_outline.md'), 'utf8');
md = md.replace(/(\d(?:\.\d+)?)~(\d(?:\.\d+)?)/g, '$1–$2');
marked.setOptions({ gfm: true, breaks: false });
let body = marked.parse(md);

// 빌더와 동일한 섹션 배지 로직
body = body.replace(/<h2(?:\s+id="[^"]*")?>(.+?)<\/h2>/g, (_, inner) => {
  const numbered = inner.match(/^(\d+)\.\s+(.+)$/);
  if (numbered) {
    const num = numbered[1].padStart(2, '0');
    return `<h2 class="sec"><span class="sec-num">${num}</span><span class="sec-text">${numbered[2]}</span></h2>`;
  }
  return `<h2 class="sec sec-plain"><span class="sec-text">${inner}</span></h2>`;
});

// 표지를 숨겨서 본문부터 보이게
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/fonts-archive/Galmuri11/Galmuri11.css">
<style>
:root { --ink:#1a1a24; --ink-soft:#2a2d3a; --muted:#555a6e; --line:#d8dae3; --line-soft:#eef0f6; --accent:#c92a4e; --accent-soft:#faf4f6; --code-bg:#f4f5f8; }
html,body { margin:0; padding:0; font-family:'Pretendard Variable',Pretendard,sans-serif; color:var(--ink); font-size:10.5pt; line-height:1.7; word-break:keep-all; background:#fff; }
body { width:794px; padding:20mm 18mm 22mm; box-sizing:border-box; }
.cover { display:none; }
p { margin:0.55em 0; text-align:justify; }
strong { color:#0a0a1a; font-weight:700; }
em { color:var(--ink-soft); }
h1 { font-size:22pt; border-bottom:2px solid var(--accent); padding-bottom:6pt; margin:0 0 0.5em; font-weight:700; }
h2.sec { margin:1.8em 0 0.9em; padding-bottom:5pt; border-bottom:1px solid var(--line); font-size:17pt; line-height:1.25; }
h2.sec .sec-num { display:inline-block; min-width:14mm; padding:1mm 3mm; background:var(--accent); color:#fff; border-radius:1mm; font-size:10pt; font-weight:700; letter-spacing:0.05em; margin-right:4mm; vertical-align:middle; text-align:center; }
h2.sec .sec-text { vertical-align:middle; font-weight:700; }
h3 { font-size:13pt; color:var(--ink-soft); margin:1.5em 0 0.4em; font-weight:700; }
h4 { font-size:11.5pt; color:var(--ink-soft); margin:1.3em 0 0.3em; font-weight:700; }
ul,ol { padding-left:1.5em; margin:0.5em 0; }
li { margin:0.22em 0; }
blockquote { border-left:3px solid var(--accent); padding:0.5em 1em; margin:0.8em 0; background:var(--accent-soft); color:var(--ink-soft); }
blockquote p { text-align:left; margin:0.2em 0; }
code { font-family:'Galmuri11','D2Coding',Consolas,monospace; background:var(--code-bg); padding:1px 4px; border-radius:3px; font-size:95%; }
pre { font-family:'Galmuri11','D2Coding',Consolas,monospace; background:var(--code-bg); border:1px solid var(--line); border-radius:3px; padding:8pt 11pt; font-size:8.5pt; line-height:1.55; white-space:pre-wrap; word-break:break-all; color:var(--ink-soft); }
table { border-collapse:collapse; width:100%; margin:0.7em 0; font-size:9.5pt; }
th,td { border:1px solid var(--line); padding:5pt 8pt; vertical-align:top; text-align:left; line-height:1.55; }
th { background:var(--line-soft); font-weight:700; color:var(--ink); }
hr { border:0; border-top:1px solid var(--line); margin:1.4em 0; }
</style></head><body>${body}</body></html>`;
const htmlPath = resolve(TMP, 'preview-body.html');
writeFileSync(htmlPath, html);

const OUT = resolve(TMP, 'body-preview.png');
if (existsSync(OUT)) rmSync(OUT);
const profile = resolve(TMP, 'chrome-profile-body');
mkdirSync(profile, { recursive: true });
spawnSync(CHROME, [
  '--headless=new','--disable-gpu','--no-sandbox','--hide-scrollbars',
  '--disable-extensions','--disable-background-networking',
  `--user-data-dir=${fwd(profile)}`,
  '--window-size=794,2400',  // 약 2 A4 페이지 분량
  '--virtual-time-budget=8000',
  `--screenshot=${fwd(OUT)}`,
  `file:///${fwd(htmlPath)}`,
], { stdio: ['ignore','pipe','pipe'] });

const start = Date.now();
let stable = 0, last = -1;
while (Date.now() - start < 25_000) {
  if (existsSync(OUT)) {
    const s = statSync(OUT).size;
    if (s > 0 && s === last) { stable++; if (stable >= 3) break; }
    else stable = 0;
    last = s;
  }
  await new Promise(r => setTimeout(r, 250));
}
console.log('body preview:', OUT, last > 0 ? `(${(last/1024).toFixed(1)} KB)` : '(없음)');
