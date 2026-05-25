#!/usr/bin/env node
// SAMSARA 기획서 PDF 빌더 (정석 제출본 사양)
//   md → HTML (marked) → PDF (Chrome headless, --no-pdf-header-footer)
// 사용: node scripts/build-proposal-pdf.mjs
// 산출: docs/06_proposal_outline.pdf
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { marked } from 'marked';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const MD_PATH = resolve(ROOT, 'docs/06_proposal_outline.md');
const OUT_DIR = resolve(ROOT, 'docs');
const TMP_DIR = resolve(ROOT, '.tmp-pdf');
const HTML_PATH = resolve(TMP_DIR, 'proposal.html');
const PDF_PATH = resolve(OUT_DIR, '06_proposal_outline.pdf');

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const chrome = CHROME_CANDIDATES.find((p) => existsSync(p));
if (!chrome) {
  console.error('Chrome/Edge 실행 파일을 찾지 못함:', CHROME_CANDIDATES);
  process.exit(1);
}

if (!existsSync(MD_PATH)) {
  console.error('기획서 마크다운이 없음:', MD_PATH);
  process.exit(1);
}
if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });

let md = readFileSync(MD_PATH, 'utf8');

// 정석 typography: 숫자-숫자 범위의 ASCII 틸드(~)를 en-dash(–)로 치환.
// 예: 30~35, 1~3, 9~12.5 → 30–35, 1–3, 9–12.5
md = md.replace(/(\d(?:\.\d+)?)~(\d(?:\.\d+)?)/g, '$1–$2');

marked.setOptions({ gfm: true, breaks: false });
const body = marked.parse(md);

// 본문 H2 섹션 헤더 정석화:
//   - 본문 §은 "1. 게임 개요" → 배지 "01" + 제목 "게임 개요" (중복 "1." 제거)
//   - "목차" / "부록 …" 은 배지 없이 plain h2 (counter 도 증가 X)
const bodyWithBadges = body.replace(/<h2(?:\s+id="[^"]*")?>(.+?)<\/h2>/g, (_, inner) => {
  // 본문 §: "1. …" / "12. …" 패턴
  const numbered = inner.match(/^(\d+)\.\s+(.+)$/);
  if (numbered) {
    const num = numbered[1].padStart(2, '0');
    const title = numbered[2];
    return `<h2 class="sec"><span class="sec-num">${num}</span><span class="sec-text">${title}</span></h2>`;
  }
  // 메타 §(목차 / 부록 …): plain h2 — 배지 없음
  return `<h2 class="sec sec-plain"><span class="sec-text">${inner}</span></h2>`;
});

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>SAMSARA — DACON 월간 해커톤 기획서</title>
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/fonts-archive/Galmuri11/Galmuri11.css">
<style>
  /* =========================================================
     @page · 페이지 박스 + 자체 페이지 번호 (Chrome 기본 헤더/푸터는 CLI 플래그로 제거)
     ========================================================= */
  @page {
    size: A4;
    margin: 20mm 18mm 22mm;
    @bottom-center {
      content: counter(page);
      font-family: 'Pretendard Variable', Pretendard, sans-serif;
      font-size: 9pt;
      color: #888;
    }
  }
  /* 표지에는 페이지 번호 표기 안 함 */
  @page :first {
    @bottom-center { content: ''; }
  }

  :root {
    --ink: #1a1a24;
    --ink-soft: #2a2d3a;
    --muted: #555a6e;
    --line: #d8dae3;
    --line-soft: #eef0f6;
    --accent: #c92a4e;
    --accent-soft: #faf4f6;
    --code-bg: #f4f5f8;
  }

  /* =========================================================
     기본 타이포
     ========================================================= */
  html, body {
    margin: 0;
    padding: 0;
    color: var(--ink);
    font-family: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
    font-size: 10.5pt;
    line-height: 1.7;
    -webkit-font-smoothing: antialiased;
    word-break: keep-all;
    overflow-wrap: anywhere;
  }
  p {
    margin: 0.55em 0;
    text-align: justify;
    text-justify: inter-character;
  }
  strong { color: #0a0a1a; font-weight: 700; }
  em { color: var(--ink-soft); }
  a { color: var(--accent); text-decoration: none; }

  /* =========================================================
     표지 (cover)
     ========================================================= */
  .cover {
    page-break-after: always;
    padding: 18mm 4mm 0;
    text-align: center;
  }
  .cover-eyebrow {
    font-size: 10.5pt;
    letter-spacing: 0.35em;
    color: var(--accent);
    margin-bottom: 28mm;
    font-weight: 600;
  }
  .cover-title {
    font-size: 68pt;
    font-weight: 900;
    margin: 0;
    letter-spacing: -0.02em;
    line-height: 1;
    color: #0a0a1a;
    border: 0;
    padding: 0;
  }
  .cover-subtitle {
    font-size: 18pt;
    color: var(--muted);
    margin: 6mm 0 0;
    letter-spacing: 0.1em;
    font-weight: 400;
  }
  .cover-accent {
    width: 30mm;
    height: 2px;
    background: var(--accent);
    margin: 14mm auto;
  }
  .cover-tagline-ko {
    font-size: 22pt;
    font-weight: 700;
    color: var(--accent);
    margin-bottom: 3mm;
    letter-spacing: -0.01em;
  }
  .cover-tagline-en {
    font-size: 11pt;
    color: #888;
    font-style: italic;
    margin-bottom: 14mm;
  }
  .cover-genre {
    display: inline-block;
    padding: 3mm 8mm;
    border-top: 1px solid var(--line);
    border-bottom: 1px solid var(--line);
    font-size: 11pt;
    color: var(--ink-soft);
    margin-bottom: 14mm;
    letter-spacing: 0.05em;
  }
  .cover-capsule {
    margin: 0 auto 16mm;
    padding: 9mm 11mm 8mm;
    background: var(--accent-soft);
    border-left: 4px solid var(--accent);
    border-radius: 1.5mm;
    text-align: left;
    max-width: 145mm;
  }
  .cover-capsule-label {
    font-size: 8.5pt;
    letter-spacing: 0.3em;
    color: var(--accent);
    margin-bottom: 3mm;
    font-weight: 700;
  }
  .cover-capsule p {
    margin: 0 0 4mm;
    font-size: 11pt;
    line-height: 1.75;
    text-align: left;
  }
  .cover-pillars {
    margin: 0;
    font-size: 9pt;
    line-height: 1.9;
  }
  .cover-pillars span {
    display: inline-block;
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 1.2mm;
    padding: 0.8mm 2.8mm;
    color: var(--ink-soft);
    margin: 0 1.5mm 1.5mm 0;
  }
  .cover-meta {
    margin-top: 14mm;
  }
  .cover-meta-label {
    font-size: 16pt;
    font-weight: 700;
    letter-spacing: 0.4em;
    color: var(--ink);
    margin-bottom: 6mm;
  }
  .cover-meta-table {
    margin: 0 auto;
    border-collapse: collapse;
    font-size: 10pt;
    color: var(--ink-soft);
  }
  .cover-meta-table th,
  .cover-meta-table td {
    border: 0;
    padding: 1.2mm 4mm;
    text-align: left;
  }
  .cover-meta-table th {
    color: var(--muted);
    font-weight: 600;
    text-align: right;
    background: transparent;
    letter-spacing: 0.15em;
    font-size: 9pt;
  }

  /* =========================================================
     본문 헤딩
     ========================================================= */
  h1, h3, h4, h5, h6 {
    font-weight: 700;
    color: var(--ink);
    line-height: 1.3;
    page-break-after: avoid;
  }
  h1 {
    font-size: 22pt;
    border-bottom: 2px solid var(--accent);
    padding-bottom: 6pt;
    margin: 0 0 0.5em;
  }
  /* 본문 H2 = 섹션 헤더 (배지 + 액센트 라인). 자연 흐름 + orphan 방지. */
  h2.sec {
    margin: 1.6em 0 0.9em;
    padding-bottom: 5pt;
    border-bottom: 1px solid var(--line);
    font-size: 17pt;
    line-height: 1.25;
    page-break-after: avoid;       /* 헤더 직후 본문이 다음 페이지로 가지 않게 */
    page-break-before: auto;       /* 강제 분기 X — 짧은 §은 같은 페이지에 흐름 */
    page-break-inside: avoid;      /* 헤더 자체가 페이지 경계에 걸리지 않게 */
    display: block;
  }
  h2.sec .sec-num {
    display: inline-block;
    min-width: 14mm;
    padding: 1mm 3mm;
    background: var(--accent);
    color: #fff;
    border-radius: 1mm;
    font-size: 10pt;
    font-weight: 700;
    letter-spacing: 0.05em;
    margin-right: 4mm;
    vertical-align: middle;
    text-align: center;
  }
  h2.sec .sec-text {
    vertical-align: middle;
    color: var(--ink);
    font-weight: 700;
  }
  h3 {
    font-size: 13pt;
    color: var(--ink-soft);
    margin: 1.5em 0 0.4em;
    page-break-after: avoid;
    break-after: avoid;
  }
  h4 {
    font-size: 11.5pt;
    color: var(--ink-soft);
    margin: 1.3em 0 0.3em;
    page-break-after: avoid;
    break-after: avoid;
  }
  /* 문단/리스트 widow & orphan: 한 줄만 페이지 끝에 외롭게 떨어지지 않게 */
  p, li { orphans: 2; widows: 2; }

  /* =========================================================
     리스트 / blockquote
     ========================================================= */
  ul, ol { padding-left: 1.5em; margin: 0.5em 0; }
  li { margin: 0.22em 0; }
  li > p { margin: 0.15em 0; }
  blockquote {
    border-left: 3px solid var(--accent);
    padding: 0.5em 1em;
    margin: 0.8em 0;
    background: var(--accent-soft);
    color: var(--ink-soft);
    page-break-inside: avoid;
  }
  blockquote p { margin: 0.2em 0; text-align: left; }
  blockquote p:last-child { margin-bottom: 0; }

  /* =========================================================
     코드
     ========================================================= */
  code {
    font-family: 'Galmuri11', 'D2Coding', Consolas, 'Courier New', monospace;
    background: var(--code-bg);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 95%;
  }
  pre {
    font-family: 'Galmuri11', 'D2Coding', Consolas, 'Courier New', monospace;
    background: var(--code-bg);
    border: 1px solid var(--line);
    border-radius: 3px;
    padding: 8pt 11pt;
    font-size: 8.5pt;
    line-height: 1.55;
    overflow-x: hidden;
    white-space: pre-wrap;
    word-break: break-all;
    page-break-inside: avoid;
    color: var(--ink-soft);
  }
  pre code { background: transparent; padding: 0; font-size: inherit; }

  /* =========================================================
     표
     ========================================================= */
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 0.7em 0;
    font-size: 9.5pt;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid var(--line);
    padding: 5pt 8pt;
    vertical-align: top;
    text-align: left;
    line-height: 1.55;
  }
  th {
    background: var(--line-soft);
    font-weight: 700;
    color: var(--ink);
  }

  hr {
    border: 0;
    border-top: 1px solid var(--line);
    margin: 1.4em 0;
  }
</style>
</head>
<body>
${bodyWithBadges}
</body>
</html>`;

writeFileSync(HTML_PATH, html, 'utf8');
console.log('[1/2] HTML 작성 완료 →', HTML_PATH, `(${(html.length / 1024).toFixed(1)} KB)`);

// 기존 PDF 삭제 (잠긴 경우 명시적 경고)
if (existsSync(PDF_PATH)) {
  try { rmSync(PDF_PATH); }
  catch (e) {
    console.error('PDF 파일이 다른 프로세스(뷰어)에 잠겨 있음:', PDF_PATH);
    console.error('  → PDF 뷰어를 닫고 다시 실행하세요.');
    process.exit(1);
  }
}

const fwd = (p) => p.replace(/\\/g, '/');
const fileUrl = `file:///${fwd(HTML_PATH)}`;
const userDataDir = resolve(TMP_DIR, 'chrome-profile');
mkdirSync(userDataDir, { recursive: true });
const args = [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  '--disable-extensions',
  '--disable-background-networking',
  `--user-data-dir=${fwd(userDataDir)}`,
  '--virtual-time-budget=10000',
  '--no-pdf-header-footer',          // Chrome 기본 print 헤더(=title+date) / 푸터(=URL+page) 제거
  '--print-to-pdf-no-header',        // 일부 Chromium 빌드 호환 alias
  `--print-to-pdf=${fwd(PDF_PATH)}`,
  fileUrl,
];

console.log('[2/2] Chrome headless → PDF…');
const result = spawnSync(chrome, args, { stdio: ['ignore', 'pipe', 'pipe'] });

// Windows 의 chrome.exe 는 런처 → 실제 프로세스로 detach 후 launcher 만 즉시 exit 한다.
// 따라서 spawnSync 가 반환해도 백그라운드에선 PDF 가 아직 안 만들어졌을 수 있다 → 폴링.
const POLL_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 250;
const POLL_STABLE_MS = 750; // 같은 사이즈가 3틱 이상 유지되면 완료로 판정
const start = Date.now();
let lastSize = -1;
let stableSince = 0;
let finalSize = 0;
while (Date.now() - start < POLL_TIMEOUT_MS) {
  if (existsSync(PDF_PATH)) {
    const s = statSync(PDF_PATH).size;
    if (s > 0 && s === lastSize) {
      if (stableSince === 0) stableSince = Date.now();
      if (Date.now() - stableSince >= POLL_STABLE_MS) { finalSize = s; break; }
    } else {
      stableSince = 0;
    }
    lastSize = s;
  }
  await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
}

if (!finalSize) {
  console.error('Chrome 이 PDF 를 시간 안에 생성하지 못함.');
  if (result.stderr?.length) console.error('stderr:', result.stderr.toString());
  if (result.stdout?.length) console.error('stdout:', result.stdout.toString());
  console.error('exit code:', result.status);
  process.exit(1);
}

console.log('✅ PDF 생성:', PDF_PATH, `(${(finalSize / 1024).toFixed(1)} KB,`,
  `폴링 ${((Date.now() - start) / 1000).toFixed(1)}s)`);
rmSync(TMP_DIR, { recursive: true, force: true });
