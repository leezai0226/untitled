#!/usr/bin/env node
/**
 * sales/render.mjs — 마크다운 → A4 PDF 변환 (한글 폰트 안전)
 *
 * 사용법:
 *   node sales/render.mjs <input.md> [output.pdf]
 *
 * - 의존성 없음. 내장 미니 마크다운 파서(제목/목록/표/굵게/인용/구분선) 사용.
 * - 시스템에 설치된 Chrome 헤드리스로 PDF를 뽑는다.
 *   폰트는 Pretendard → Apple SD Gothic Neo → Noto Sans KR 순서로 폴백되어
 *   한글이 깨지지 않는다.
 * - 랜딩페이지와 같은 브랜드 컬러(#9999FF)와 UNTITLED PRODUCTION 로고 텍스트 사용.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync } from "fs";
import { execFileSync } from "child_process";
import { dirname, resolve } from "path";
import { tmpdir } from "os";

const CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
];

function findChrome() {
  for (const p of CHROME_PATHS) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    "Chrome을 찾을 수 없습니다. Google Chrome을 설치하거나 CHROME_PATH 환경변수를 지정하세요."
  );
}

/* ── 미니 마크다운 파서 ── */
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>");
}

function mdToHtml(md) {
  const lines = md.split("\n");
  const out = [];
  let list = null; // "ul" | "ol" | null
  let table = []; // 테이블 행 버퍼

  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  const flushTable = () => {
    if (table.length === 0) return;
    const rows = table.filter((r) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(r));
    const cells = (row) =>
      row
        .replace(/^\s*\|/, "")
        .replace(/\|\s*$/, "")
        .split("|")
        .map((c) => inline(c.trim()));
    let html = "<table>";
    rows.forEach((row, i) => {
      const tag = i === 0 ? "th" : "td";
      html += `<tr>${cells(row)
        .map((c) => `<${tag}>${c}</${tag}>`)
        .join("")}</tr>`;
    });
    html += "</table>";
    out.push(html);
    table = [];
  };

  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");

    if (/^\s*\|.*\|\s*$/.test(line)) {
      closeList();
      table.push(line);
      continue;
    }
    flushTable();

    if (/^\s*$/.test(line)) {
      closeList();
      continue;
    }
    if (/^---+\s*$/.test(line)) {
      closeList();
      out.push("<hr>");
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      closeList();
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    const bq = line.match(/^>\s?(.*)$/);
    if (bq) {
      closeList();
      out.push(`<blockquote>${inline(bq[1])}</blockquote>`);
      continue;
    }
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (ul) {
      if (list !== "ul") {
        closeList();
        out.push("<ul>");
        list = "ul";
      }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) {
      if (list !== "ol") {
        closeList();
        out.push("<ol>");
        list = "ol";
      }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  flushTable();
  return out.join("\n");
}

/* ── HTML 래퍼 (A4, 브랜드 컬러) ── */
function wrapHtml(bodyHtml) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<style>
  :root { --primary: #9999FF; --ink: #1a1a2e; --sub: #555; }
  * { box-sizing: border-box; }
  body {
    font-family: "Pretendard", "Pretendard Variable", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
    color: var(--ink);
    font-size: 11pt;
    line-height: 1.7;
    margin: 0;
    padding: 0;
  }
  .brand {
    display: flex; justify-content: space-between; align-items: baseline;
    border-bottom: 3px solid var(--primary);
    padding-bottom: 10px; margin-bottom: 28px;
  }
  .brand .logo { font-weight: 800; font-size: 13pt; letter-spacing: -0.02em; }
  .brand .logo span { color: var(--primary); }
  .brand .date { font-size: 9pt; color: var(--sub); }
  h1 { font-size: 19pt; margin: 0 0 16px; letter-spacing: -0.02em; }
  h2 { font-size: 13pt; margin: 26px 0 10px; color: var(--ink); border-left: 4px solid var(--primary); padding-left: 10px; }
  h3 { font-size: 11.5pt; margin: 18px 0 8px; }
  p { margin: 6px 0; }
  ul, ol { margin: 6px 0; padding-left: 22px; }
  li { margin: 3px 0; }
  blockquote {
    margin: 10px 0; padding: 8px 14px;
    background: #f4f4ff; border-left: 4px solid var(--primary);
    color: var(--sub); font-size: 10pt;
  }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10pt; }
  th, td { border: 1px solid #ddd; padding: 7px 10px; text-align: left; }
  th { background: #f4f4ff; font-weight: 700; }
  hr { border: none; border-top: 1px solid #e5e5e5; margin: 22px 0; }
  strong { font-weight: 700; }
  code { background: #f4f4f4; padding: 1px 5px; border-radius: 4px; font-size: 9.5pt; }
  @page { size: A4; margin: 18mm 16mm; }
</style>
</head>
<body>
  <div class="brand">
    <div class="logo"><span>UNTITLED</span>PRODUCTION</div>
    <div class="date">${new Date().toISOString().slice(0, 10)}</div>
  </div>
${bodyHtml}
</body>
</html>`;
}

/* ── 실행 ── */
const [, , inputPath, outputPathArg] = process.argv;
if (!inputPath) {
  console.error("사용법: node sales/render.mjs <input.md> [output.pdf]");
  process.exit(1);
}

const input = resolve(inputPath);
const output = resolve(outputPathArg ?? input.replace(/\.md$/, ".pdf"));
const md = readFileSync(input, "utf8");
const html = wrapHtml(mdToHtml(md));

mkdirSync(dirname(output), { recursive: true });
const tmpHtml = resolve(tmpdir(), `render-${Date.now()}.html`);
writeFileSync(tmpHtml, html, "utf8");

const chrome = process.env.CHROME_PATH || findChrome();
execFileSync(chrome, [
  "--headless",
  "--disable-gpu",
  "--no-pdf-header-footer",
  `--print-to-pdf=${output}`,
  `file://${tmpHtml}`,
]);
unlinkSync(tmpHtml);
console.log(`PDF 생성 완료: ${output}`);
