#!/usr/bin/env node
/**
 * GOLX Backend — PDF Report Generator
 * Converts REPORT_BACKEND_FULL_AUDIT_AR.md → beautiful HTML → PDF
 * Uses only built-in Node.js modules (no npm install needed)
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT      = __dirname;
const MD_PATH   = path.join(ROOT, 'REPORT_BACKEND_FULL_AUDIT_AR.md');
const HTML_PATH = path.join(ROOT, 'REPORT_BACKEND_FULL_AUDIT_AR.html');
const PDF_PATH  = path.join(ROOT, 'REPORT_BACKEND_FULL_AUDIT_AR.pdf');

// ═══════════════════════════════════════════════════════════════════════
//  Markdown → HTML (handles all patterns used in the report)
// ═══════════════════════════════════════════════════════════════════════

function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inlineFmt(s) {
    // Bold
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    // Inline code — escape HTML inside it
    s = s.replace(/`([^`\n]+)`/g, (_, inner) => `<code>${escHtml(inner)}</code>`);
    // Links → show only label (no hyperlinks in print)
    s = s.replace(/\[([^\]\n]+)\]\([^)\n]+\)/g, '<span class="ref">$1</span>');
    // Checkboxes
    s = s.replace(/ *\[ \] */g, '<span class="cb">☐ </span>');
    s = s.replace(/ *\[x\] */gi, '<span class="cb done">☑ </span>');
    return s;
}

function isTableRow(s) { return s.startsWith('|') && s.endsWith('|') && s.length > 2; }
function isSepRow(s)   { return /^\|[\s\-:|]+\|$/.test(s); }
function splitCells(s) { return s.slice(1, -1).split('|'); }

function mdToHtml(md) {
    const lines = md.split('\n');
    const out   = [];
    let state   = 'normal'; // normal | code | table
    let codeBuf = [];
    let codeLang = '';
    let tHeaders = [];
    let tRows    = [];
    let listType = '';
    let paraBuf  = [];

    const flushPara = () => {
        if (!paraBuf.length) return;
        const txt = paraBuf.join(' ').trim();
        if (txt) out.push(`<p>${inlineFmt(txt)}</p>`);
        paraBuf = [];
    };

    const flushList = () => {
        if (listType) { out.push(`</${listType}>`); listType = ''; }
    };

    const flushTable = () => {
        if (!tHeaders.length) return;
        let t = '<div class="tbl-wrap"><table><thead><tr>';
        tHeaders.forEach(h => (t += `<th>${inlineFmt(h.trim())}</th>`));
        t += '</tr></thead><tbody>';
        tRows.forEach(r => {
            t += '<tr>';
            r.forEach(c => (t += `<td>${inlineFmt(c.trim())}</td>`));
            t += '</tr>';
        });
        t += '</tbody></table></div>';
        out.push(t);
        tHeaders = []; tRows = [];
    };

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const t   = raw.trim();

        // ── code block toggle ──────────────────────────────────────────
        if (t.startsWith('```')) {
            if (state !== 'code') {
                flushPara(); flushList(); flushTable();
                codeLang = t.slice(3).trim();
                codeBuf  = []; state = 'code';
            } else {
                const cls = codeLang ? ` class="lang-${escHtml(codeLang)}"` : '';
                out.push(`<pre><code${cls}>${escHtml(codeBuf.join('\n'))}</code></pre>`);
                state = 'normal'; codeBuf = [];
            }
            continue;
        }
        if (state === 'code') { codeBuf.push(raw); continue; }

        // ── table with lookahead for header row ────────────────────────
        if (isTableRow(t) && i + 1 < lines.length && isSepRow(lines[i + 1].trim())) {
            flushPara(); flushList(); flushTable();
            tHeaders = splitCells(t);
            i++; // skip separator
            state = 'table';
            continue;
        }
        if (state === 'table' && isTableRow(t)) {
            tRows.push(splitCells(t));
            continue;
        }
        if (state === 'table') {
            flushTable(); state = 'normal';
        }

        // ── horizontal rule ────────────────────────────────────────────
        if (/^---+$/.test(t)) {
            flushPara(); flushList();
            out.push('<hr>'); continue;
        }

        // ── headings ───────────────────────────────────────────────────
        const hm = t.match(/^(#{1,4}) (.+)$/);
        if (hm) {
            flushPara(); flushList();
            const lvl = hm[1].length;
            out.push(`<h${lvl}>${inlineFmt(hm[2])}</h${lvl}>`);
            continue;
        }

        // ── unordered list ─────────────────────────────────────────────
        const ulm = t.match(/^[-*] (.+)$/);
        if (ulm) {
            flushPara();
            if (listType !== 'ul') { flushList(); out.push('<ul>'); listType = 'ul'; }
            out.push(`<li>${inlineFmt(ulm[1])}</li>`); continue;
        }

        // ── ordered list ───────────────────────────────────────────────
        const olm = t.match(/^\d+[.)]\s+(.+)$/);
        if (olm) {
            flushPara();
            if (listType !== 'ol') { flushList(); out.push('<ol>'); listType = 'ol'; }
            out.push(`<li>${inlineFmt(olm[1])}</li>`); continue;
        }

        // ── empty line ─────────────────────────────────────────────────
        if (t === '') { flushPara(); flushList(); continue; }

        // ── paragraph buffer ───────────────────────────────────────────
        flushList();
        paraBuf.push(t);
    }

    flushPara(); flushList(); flushTable();
    return out.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════
//  CSS — Arabic RTL, professional report style
// ═══════════════════════════════════════════════════════════════════════

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --primary:  #1a365d;
  --accent:   #2b6cb0;
  --light:    #ebf8ff;
  --red:      #c53030;
  --orange:   #c05621;
  --green:    #276749;
  --border:   #e2e8f0;
  --code-bg:  #1a202c;
  --row-alt:  #f7fafc;
  --text:     #2d3748;
  --muted:    #718096;
}

body {
  font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.85;
  color: var(--text);
  direction: rtl;
  unicode-bidi: embed;
  background: #fff;
}

/* ── Cover Page ── */
.cover {
  min-height: 100vh;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; text-align: center;
  background: linear-gradient(160deg, #0f2544 0%, #1e4080 55%, #0f2544 100%);
  color: #fff;
  padding: 60px 48px;
  page-break-after: always;
}
.cover-badge {
  display: inline-block;
  border: 2px solid rgba(255,255,255,.45);
  border-radius: 50px;
  padding: 5px 28px;
  font-size: 9pt; letter-spacing: 3px;
  text-transform: uppercase; color: #bee3f8;
  margin-bottom: 44px;
}
.cover h1 {
  font-size: 30pt; font-weight: 800; color: #fff;
  border: none; padding: 0; margin: 0 0 12px;
}
.cover h2 {
  font-size: 14pt; font-weight: 300; color: #90cdf4;
  border: none; margin: 0 0 40px;
}
.cover-line {
  width: 72px; height: 3px;
  background: linear-gradient(90deg, #4299e1, #90cdf4);
  border-radius: 4px; margin: 0 auto 44px;
}
.cover-meta { display: flex; gap: 56px; justify-content: center; flex-wrap: wrap; }
.cover-meta-item { text-align: center; }
.cover-meta-item .lbl {
  font-size: 8pt; letter-spacing: 2px; text-transform: uppercase;
  color: #90cdf4; margin-bottom: 5px;
}
.cover-meta-item .val { font-size: 13pt; font-weight: 700; color: #fff; }
.cover-footer {
  margin-top: 60px; font-size: 9pt; color: rgba(255,255,255,.45);
  letter-spacing: 1px;
}

/* ── Page Wrapper ── */
.page-wrap { max-width: 820px; margin: 0 auto; padding: 32px 48px 48px; }

/* ── Headings ── */
h1 {
  font-size: 20pt; font-weight: 800; color: var(--primary);
  border-bottom: 3px solid var(--primary);
  padding-bottom: 10px; margin: 44px 0 20px;
}
h2 {
  font-size: 14.5pt; font-weight: 700; color: var(--primary);
  border-right: 5px solid var(--accent); padding-right: 14px;
  margin: 34px 0 16px; padding-bottom: 0;
}
h3 {
  font-size: 12pt; font-weight: 700; color: var(--accent);
  border-bottom: 1px dashed var(--border);
  padding-bottom: 4px; margin: 26px 0 12px;
}
h4 {
  font-size: 11pt; font-weight: 700; color: var(--text);
  margin: 18px 0 8px;
}

/* ── Body text ── */
p { margin: 8px 0; }
strong { font-weight: 700; color: var(--primary); }
.ref   { color: var(--accent); font-style: italic; }
hr { border: none; border-top: 2px solid var(--border); margin: 28px 0; }

/* ── Code ── */
code {
  font-family: 'IBM Plex Mono', 'Courier New', monospace;
  font-size: 8.5pt;
  background: var(--row-alt); border: 1px solid var(--border);
  border-radius: 4px; padding: 1px 5px;
  direction: ltr; unicode-bidi: embed;
}
pre {
  background: var(--code-bg); border-radius: 10px;
  padding: 18px 22px; margin: 16px 0;
  direction: ltr; text-align: left;
  border: 1px solid #2d3748;
  overflow-x: auto;
}
pre code {
  background: none; border: none; color: #e2e8f0;
  font-size: 8.5pt; padding: 0; white-space: pre;
  line-height: 1.6;
}

/* ── Tables ── */
.tbl-wrap { overflow-x: auto; margin: 16px 0; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
table {
  width: 100%; border-collapse: collapse;
  font-size: 9.5pt; direction: rtl;
}
th {
  background: var(--primary); color: #fff;
  padding: 10px 14px; font-weight: 600;
  border: 1px solid #234375; text-align: right;
  font-size: 9.5pt;
}
td {
  padding: 9px 14px; border: 1px solid var(--border);
  text-align: right; vertical-align: top;
}
tr:nth-child(even) td { background: var(--row-alt); }
tr:hover td { background: var(--light); }

/* ── Lists ── */
ul, ol { margin: 10px 0; padding-right: 28px; }
li { margin: 5px 0; line-height: 1.75; }

/* ── Checkboxes ── */
.cb      { color: var(--red);   font-size: 12pt; }
.cb.done { color: var(--green); }

/* ── Risk Badges (🔴🟠🟡) ── */
h3 { white-space: pre-wrap; }

/* ── Print rules ── */
@media print {
  body { font-size: 10pt; }
  .cover { min-height: 297mm; }
  h1, h2, h3, h4 { page-break-after: avoid; }
  pre, table, .tbl-wrap { page-break-inside: avoid; }
  a { color: inherit; text-decoration: none; }

  @page {
    size: A4;
    margin: 18mm 15mm 22mm 15mm;
  }
  @page :first {
    margin: 0;
  }
}
`;

// ═══════════════════════════════════════════════════════════════════════
//  HTML Template
// ═══════════════════════════════════════════════════════════════════════

function buildHtml(bodyHtml) {
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تقرير مراجعة GOLX Backend — مارس 2026</title>
  <style>${CSS}</style>
</head>
<body>

<!-- ═══ COVER PAGE ═══ -->
<div class="cover">
  <div class="cover-badge">Security &amp; Architecture Audit Report</div>
  <h1>تقرير مراجعة شاملة</h1>
  <h2>GOLX Sports Academy Platform — Backend API</h2>
  <div class="cover-line"></div>
  <div class="cover-meta">
    <div class="cover-meta-item">
      <div class="lbl">المشروع</div>
      <div class="val">golx-backend</div>
    </div>
    <div class="cover-meta-item">
      <div class="lbl">تاريخ التقرير</div>
      <div class="val">مارس 2026</div>
    </div>
    <div class="cover-meta-item">
      <div class="lbl">نوع المراجعة</div>
      <div class="val">Static Code Analysis</div>
    </div>
    <div class="cover-meta-item">
      <div class="lbl">الحالة</div>
      <div class="val">للاطلاع — بدون تعديل</div>
    </div>
  </div>
  <div class="cover-footer">CONFIDENTIAL — For Internal Use Only</div>
</div>

<!-- ═══ REPORT BODY ═══ -->
<div class="page-wrap">
${bodyHtml}
</div>

</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════
//  Browser discovery (Edge / Chrome on Windows)
// ═══════════════════════════════════════════════════════════════════════

function findBrowser() {
    const candidates = [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

// ═══════════════════════════════════════════════════════════════════════
//  Main
// ═══════════════════════════════════════════════════════════════════════

function main() {
    if (!fs.existsSync(MD_PATH)) {
        console.error('❌ Markdown file not found:', MD_PATH);
        process.exit(1);
    }

    console.log('📄  Reading markdown...');
    const md = fs.readFileSync(MD_PATH, 'utf8');

    console.log('🔄  Converting to HTML...');
    const bodyHtml = mdToHtml(md);
    const fullHtml = buildHtml(bodyHtml);
    fs.writeFileSync(HTML_PATH, fullHtml, 'utf8');
    console.log(`✅  HTML saved  →  ${HTML_PATH}`);

    const browser = findBrowser();
    if (!browser) {
        console.warn('\n⚠️   No browser found for headless PDF generation.');
        console.log('     Open the HTML file in your browser → Ctrl+P → Save as PDF\n');
        return;
    }

    console.log(`🖨️   Generating PDF with ${path.basename(browser)}...`);

    // Normalise path for file:// URL
    const fileUrl = 'file:///' + HTML_PATH.replace(/\\/g, '/');

    const args = [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--run-all-compositor-stages-before-draw',
        '--virtual-time-budget=8000',
        '--no-pdf-header-footer',
        `--print-to-pdf=${PDF_PATH}`,
        fileUrl,
    ];

    try {
        execFileSync(browser, args, { timeout: 40_000, stdio: 'pipe' });
        console.log(`✅  PDF saved   →  ${PDF_PATH}`);
        // Clean up intermediate HTML
        fs.unlinkSync(HTML_PATH);
        console.log('🗑️   Cleaned up HTML file.');
    } catch (err) {
        // Older headless flag fallback
        try {
            const argsOld = args.map(a => a === '--headless=new' ? '--headless' : a);
            execFileSync(browser, argsOld, { timeout: 40_000, stdio: 'pipe' });
            console.log(`✅  PDF saved   →  ${PDF_PATH}`);
            fs.unlinkSync(HTML_PATH);
            console.log('🗑️   Cleaned up HTML file.');
        } catch (err2) {
            console.error('❌  PDF generation failed:', err2.message);
            console.log(`\n     The HTML file is ready at:\n     ${HTML_PATH}`);
            console.log('     Open it in your browser → Ctrl+P → Save as PDF\n');
        }
    }
}

main();
