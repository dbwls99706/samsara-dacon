#!/usr/bin/env node
// 빌드된 전체 HTML 의 첫 페이지(=표지)를 A4 비율로 PNG 캡처 → 시각 검수용
// 빌더가 .tmp-pdf/proposal.html 를 만들고 지우므로 여기서 빌더 로직 재실행 후 PNG 캡처.
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { marked } from 'marked';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MD_PATH = resolve(ROOT, 'docs/06_proposal_outline.md');
const TMP = resolve(ROOT, '.tmp-pdf');
const OUT = resolve(TMP, 'cover-preview.png');
mkdirSync(TMP, { recursive: true });

const fwd = (p) => p.replace(/\\/g, '/');
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(existsSync);

let md = readFileSync(MD_PATH, 'utf8');
md = md.replace(/(\d(?:\.\d+)?)~(\d(?:\.\d+)?)/g, '$1–$2');
marked.setOptions({ gfm: true, breaks: false });
const body = marked.parse(md);

// 빌더와 동일한 CSS 를 그대로 inline 한다 (단, screen 용으로 @page 는 제거)
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">
<style>
:root { --ink:#1a1a24; --ink-soft:#2a2d3a; --muted:#555a6e; --line:#d8dae3; --accent:#c92a4e; --accent-soft:#faf4f6; }
html,body { margin:0; padding:0; font-family:'Pretendard Variable',Pretendard,sans-serif; color:var(--ink); word-break:keep-all; background:#fff; }
body { width: 794px; }
.cover { page-break-after: always; padding: 18mm 4mm 0; text-align: center; box-sizing: border-box; }
.cover-eyebrow { font-size: 10.5pt; letter-spacing: 0.35em; color: var(--accent); margin-bottom: 28mm; font-weight: 600; }
.cover-title { font-size: 68pt; font-weight: 900; margin: 0; letter-spacing: -0.02em; line-height: 1; color: #0a0a1a; border:0; padding:0; }
.cover-subtitle { font-size: 18pt; color: var(--muted); margin: 6mm 0 0; letter-spacing: 0.1em; }
.cover-accent { width: 30mm; height: 2px; background: var(--accent); margin: 14mm auto; }
.cover-tagline-ko { font-size: 22pt; font-weight: 700; color: var(--accent); margin-bottom: 3mm; }
.cover-tagline-en { font-size: 11pt; color: #888; font-style: italic; margin-bottom: 14mm; }
.cover-genre { display: inline-block; padding: 3mm 8mm; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); font-size: 11pt; color: var(--ink-soft); margin-bottom: 14mm; letter-spacing: 0.05em; }
.cover-capsule { margin: 0 auto 16mm; padding: 9mm 11mm 8mm; background: var(--accent-soft); border-left: 4px solid var(--accent); border-radius: 1.5mm; text-align: left; max-width: 145mm; }
.cover-capsule-label { font-size: 8.5pt; letter-spacing: 0.3em; color: var(--accent); margin-bottom: 3mm; font-weight: 700; }
.cover-capsule p { margin: 0 0 4mm; font-size: 11pt; line-height: 1.75; }
.cover-pillars { font-size: 9pt; line-height: 1.9; }
.cover-pillars span { display: inline-block; background: #fff; border: 1px solid var(--line); border-radius: 1.2mm; padding: 0.8mm 2.8mm; color: var(--ink-soft); margin: 0 1.5mm 1.5mm 0; }
.cover-meta { margin-top: 14mm; }
.cover-meta-label { font-size: 16pt; font-weight: 700; letter-spacing: 0.4em; margin-bottom: 6mm; }
.cover-meta-table { margin: 0 auto; border-collapse: collapse; font-size: 10pt; color: var(--ink-soft); }
.cover-meta-table th, .cover-meta-table td { border: 0; padding: 1.2mm 4mm; }
.cover-meta-table th { color: var(--muted); font-weight: 600; text-align: right; letter-spacing: 0.15em; font-size: 9pt; }
.cover-meta-table td { text-align: left; }
strong { color: #0a0a1a; font-weight: 700; }
</style></head><body>${body}</body></html>`;
const htmlPath = resolve(TMP, 'preview-full.html');
writeFileSync(htmlPath, html);

if (existsSync(OUT)) rmSync(OUT);
const profile = resolve(TMP, 'chrome-profile-snap');
mkdirSync(profile, { recursive: true });
spawnSync(CHROME, [
  '--headless=new','--disable-gpu','--no-sandbox','--hide-scrollbars',
  '--disable-extensions','--disable-background-networking',
  `--user-data-dir=${fwd(profile)}`,
  '--window-size=794,1123',
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
console.log('cover preview:', OUT, last > 0 ? `(${(last/1024).toFixed(1)} KB)` : '(없음)');
