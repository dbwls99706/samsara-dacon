// SAMSARA — MD → HTML → Chrome headless print to PDF
//
// Usage: node scripts/md-to-pdf.mjs <input.md> <output.pdf>
//
// 한국어 폰트는 시스템 폰트 (Pretendard / 맑은 고딕) + Galmuri11 CDN 임베드.

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const inputPath = resolve(projectRoot, process.argv[2] ?? 'docs/06_proposal_outline.md');
const outputPath = resolve(projectRoot, process.argv[3] ?? 'proposal.pdf');
const tmpHtml = resolve(projectRoot, '.proposal-tmp.html');

if (!existsSync(inputPath)) {
  console.error(`[md-to-pdf] input not found: ${inputPath}`);
  process.exit(1);
}

const md = readFileSync(inputPath, 'utf8');
marked.setOptions({ gfm: true, breaks: false });
const body = marked.parse(md);

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>SAMSARA — 기획서</title>
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/projectnoonnu/noonfonts_galmuri/Galmuri11.css">
<style>
  @page { size: A4; margin: 18mm 16mm 18mm 16mm; }
  * { box-sizing: border-box; }
  html, body {
    font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, "맑은 고딕", "Malgun Gothic", sans-serif;
    color: #1a1a1a; line-height: 1.65; font-size: 11pt;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  h1, h2, h3 { font-family: 'Galmuri11', 'Pretendard', monospace; color: #0a0a26; letter-spacing: 0.5px; page-break-after: avoid; }
  h1 { font-size: 24pt; border-bottom: 3px solid #ff2a6d; padding-bottom: 8pt; margin-top: 24pt; }
  h2 { font-size: 16pt; color: #ff2a6d; margin-top: 20pt; border-left: 4px solid #05d9e8; padding-left: 10px; }
  h3 { font-size: 13pt; color: #0891a8; margin-top: 14pt; }
  h4 { font-size: 11pt; color: #444; }
  p { margin: 8pt 0; }
  ul, ol { margin: 8pt 0; padding-left: 22pt; }
  li { margin: 3pt 0; }
  blockquote {
    border-left: 4px solid #ffd700;
    background: #fffbe6;
    padding: 8pt 12pt; margin: 12pt 0;
    color: #555; font-style: italic;
    page-break-inside: avoid;
  }
  code {
    background: #f4f4f8; padding: 1pt 4pt; border-radius: 3px;
    font-family: 'Galmuri11', 'Consolas', monospace; font-size: 10pt;
    color: #b91c4a;
  }
  pre {
    background: #0a0a1a; color: #e0e0ff; padding: 10pt 12pt; border-radius: 6px;
    font-family: 'Galmuri11', 'Consolas', monospace; font-size: 9pt;
    overflow-x: auto; line-height: 1.4;
    page-break-inside: avoid;
  }
  pre code { background: transparent; color: inherit; padding: 0; }
  table {
    border-collapse: collapse; width: 100%; margin: 10pt 0;
    page-break-inside: avoid; font-size: 10pt;
  }
  th, td { border: 1px solid #ccc; padding: 6pt 8pt; text-align: left; vertical-align: top; }
  th { background: #f0eff5; font-weight: 700; color: #0a0a26; }
  tr:nth-child(even) td { background: #fafaff; }
  hr { border: none; border-top: 1px solid #ccc; margin: 16pt 0; }
  a { color: #0891a8; text-decoration: none; }
  strong { color: #0a0a26; }
  /* 페이지 표지 강조 */
  body > h1:first-child {
    font-size: 32pt; text-align: center;
    background: linear-gradient(90deg, #ff2a6d, #05d9e8);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent; border-bottom: none;
    margin-top: 0;
  }
</style>
</head>
<body>
${body}
</body>
</html>`;

writeFileSync(tmpHtml, html, 'utf8');

// Chrome 위치 자동 탐지
const chromeCandidates = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const chrome = chromeCandidates.find(p => existsSync(p));
if (!chrome) {
  console.error('[md-to-pdf] Chrome/Edge not found');
  process.exit(1);
}

const url = 'file:///' + tmpHtml.replace(/\\/g, '/');
const cmd = `"${chrome}" --headless=new --disable-gpu --no-margins --print-to-pdf="${outputPath}" --no-pdf-header-footer --virtual-time-budget=8000 "${url}"`;
console.log('[md-to-pdf] running headless Chrome…');
try {
  execSync(cmd, { stdio: 'inherit' });
} catch (err) {
  console.error('[md-to-pdf] Chrome exec failed:', err.message);
  process.exit(1);
}

if (existsSync(outputPath)) {
  console.log(`[md-to-pdf] ✓ written: ${outputPath}`);
} else {
  console.error('[md-to-pdf] PDF not written');
  process.exit(1);
}
