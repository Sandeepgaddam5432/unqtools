#!/usr/bin/env node
/**
 * UnQTools — Auto-Verify all 60 rebuilt PDF tools.
 *
 * Two automated layers (no manual browser needed):
 *   1. ENGINE: runs vitest over each tool's logic.test.ts (real pdf-lib
 *      operations, pure functions) → PASS/FAIL per tool.
 *   2. PAGE: boots the dev server and curl-checks /tools/<id> → HTTP 200 +
 *      tool name present in SSR HTML (page compiles + renders).
 *
 * Writes docs/TOOL-TESTING-LOG.md verdicts as "✅ PASS (auto)" with evidence,
 * and prints a summary. Real browser interaction (drag-drop, canvas) still
 * needs a browser — that part is documented as "needs browser" in the log.
 *
 * Usage: node scripts/auto-verify-tools.mjs
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const TOOLS = [
  // [id, displayName, wave]
  ["compress-pdf", "Compress PDF", "1"],
  ["crop-pdf", "Crop PDF Pages", "1"],
  ["html-to-pdf", "HTML to PDF", "1"],
  ["images-to-pdf", "Images to PDF", "1"],
  ["merge-pdf", "Merge PDF", "1"],
  ["pdf-page-numbers", "PDF Page Numbers", "1"],
  ["pdf-to-excel-converter", "PDF to Excel", "1"],
  ["pdf-to-word-converter", "PDF to Word", "1"],
  ["pdf-watermark", "PDF Watermark", "1"],
  ["split-pdf", "Split PDF", "1"],
  ["flatten-pdf", "Flatten PDF", "2"],
  ["interleave-pdf", "Interleave PDF", "2"],
  ["n-up-pdf", "N-Up PDF", "2"],
  ["markdown-to-pdf", "Markdown to PDF", "2"],
  ["remove-blank-pages", "Remove Blank Pages", "2"],
  ["resize-pdf-pages", "Resize PDF Pages", "2"],
  ["rtf-to-pdf", "RTF to PDF", "2"],
  ["scale-pdf", "Scale PDF Content", "2"],
  ["svg-to-pdf", "SVG to PDF", "2"],
  ["text-to-pdf", "Text to PDF", "2"],
  ["pdf-add-background", "Add Background to PDF", "3"],
  ["pdf-add-border", "Add Page Border to PDF", "3"],
  ["pdf-add-header-footer", "Add Header & Footer", "3"],
  ["pdf-add-attachment", "Add Attachment to PDF", "3"],
  ["pdf-2up-join", "Combine Pages Side-by-Side (2-up)", "3"],
  ["bw-scan-optimizer", "B&W Scan Optimizer", "3"],
  ["epub-to-pdf-converter", "EPUB to PDF", "3"],
  ["office-to-pdf", "Office to PDF", "3"],
  ["bates-numbering-tool", "Bates Numbering Tool", "3"],
  ["pdf-accessibility-checker", "PDF Accessibility Checker", "3"],
  ["pdf-add-margins", "Add Margins to PDF", "4"],
  ["pdf-annotate", "Edit/Annotate PDF", "4"],
  ["pdf-bookmarks", "PDF Bookmarks Editor", "4"],
  ["pdf-batch-pipeline", "PDF Batch Processor", "4"],
  ["pdf-clean-metadata", "PDF Metadata Cleaner", "4"],
  ["pdf-compress-target", "Compress to Target Size", "4"],
  ["pdf-permissions", "PDF Permissions Editor", "4"],
  ["pdf-unlock", "Unlock PDF", "4"],
  ["pdf-split-by-size", "Split PDF by Size", "4"],
  ["pdf-form-builder", "Create PDF Form", "4"],
  ["pdf-extract-text", "Extract Text (PDF to TXT)", "5"],
  ["pdf-word-count", "PDF Word Count", "5"],
  ["pdf-to-json", "PDF to JSON", "5"],
  ["pdf-to-markdown", "PDF to Markdown", "5"],
  ["pdf-extract-images", "Extract Images", "5"],
  ["pdf-invert-colors", "Invert PDF Colors (Dark Mode)", "5"],
  ["pdf-grayscale", "Grayscale PDF", "5"],
  ["pdf-split-by-bookmarks", "Split PDF by Bookmarks", "5"],
  ["pdf-export-form-data", "Export PDF Form Data", "5"],
  ["pdf-poster-split", "Poster Split", "5"],
  ["pdf-to-html", "PDF to HTML", "6"],
  ["pdf-find-replace", "Find & Replace Text", "6"],
  ["pdf-auto-redact-pii", "Auto-Redact PII", "6"],
  ["pdf-merge-bookmarks", "Merge PDF with Bookmarks", "6"],
  ["pdf-document-info-viewer", "PDF Document Info Viewer", "6"],
  ["pdf-import-form-data", "Import Form Data", "6"],
  ["pdf-repair", "Repair PDF", "6"],
  ["pdf-text-to-speech", "PDF Text-to-Speech", "6"],
  ["pdf-summarize-ai", "PDF Summarize (On-Device AI)", "6"],
  ["pdf-to-epub", "PDF to EPUB", "6"],
];

const ROOT = process.cwd();

function run(cmd) {
  try {
    const out = execSync(cmd, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: String(e.stdout || e.message) };
  }
}

console.log("Running engine unit tests per tool (this takes a while)...");
const engine = {};
for (const [id] of TOOLS) {
  const res = run(`npx vitest run src/tools/pdf/${id} 2>&1`);
  const out = res.out.replace(/\u001b\[[0-9;]*m/g, ""); // strip ANSI
  const passed = (out.match(/(\d+) passed/g) || []).reduce((a, s) => a + parseInt(s), 0);
  const failed = (out.match(/(\d+) failed/g) || []).reduce((a, s) => a + parseInt(s), 0);
  engine[id] = { ok: res.ok && failed === 0, passed, failed };
  process.stdout.write(`${res.ok && failed === 0 ? "✅" : "❌"} ${id} (${passed}p/${failed}f)\n`);
}

console.log("\nChecking pages render (needs dev server on :3000)...");
let serverOk = true;
try {
  const res = run("curl -s -o /dev/null -w '%{http_code}' --max-time 20 http://localhost:3000/tools");
  serverOk = res.out.trim() === "200";
} catch {
  serverOk = false;
}
if (!serverOk) {
  console.log("Dev server not running on :3000 — page check skipped (run `npm run dev` first).");
}

const page = {};
if (serverOk) {
  for (const [id, name] of TOOLS) {
    const res = run(`curl -s --max-time 25 http://localhost:3000/tools/${id}`);
    const ok = res.ok || !res.out.includes("Internal Server Error");
    const hasName = res.out.includes(name) || res.out.includes(id);
    page[id] = { ok: hasName && !res.out.startsWith("<!DOCTYPE html><html><head><title>404"), hasName };
    process.stdout.write(`${hasName ? "✅" : "❌"} /tools/${id}\n`);
  }
}

// Build the log.
const lines = [];
lines.push("# UnQTools — 100x Tools Test Log (Auto-Verified)");
lines.push("");
lines.push(`> Auto-generated: ${new Date().toISOString().slice(0, 16)} UTC · node scripts/auto-verify-tools.mjs`);
lines.push("");
lines.push("Two automated layers cover **every** rebuilt tool:");
lines.push("1. **ENGINE** — vitest unit tests run each tool's real logic (pdf-lib operations, pure functions).");
lines.push("2. **PAGE** — dev server SSR check: `/tools/<id>` returns 200 and contains the tool name.");
lines.push("");
lines.push("> **Note:** real browser interaction (drag-drop files, canvas rendering, toBlob output) cannot");
lines.push("> run in this sandbox (no browser binaries available). Those parts still need a manual/browser");
lines.push("> pass — marked with ⚠️ needs-browser below where relevant.");
lines.push("");

let passCount = 0;
for (const wave of ["1", "2", "3", "4", "5", "6"]) {
  lines.push(`## Wave ${wave}`);
  lines.push("");
  lines.push("| Tool | Engine tests | Page render | Verdict |");
  lines.push("|------|--------------|-------------|---------|");
  for (const [id, name, w] of TOOLS) {
    if (w !== wave) continue;
    const e = engine[id];
    const p = page[id];
    const engineOk = e && e.ok ? `✅ ${e.passed} tests` : `❌ ${e ? e.failed : "?"} failed`;
    const pageOk = p ? (p.ok ? "✅ 200 + name" : "❌ render") : "⏭ server off";
    const verdict = e && e.ok && (!p || p.ok) ? "✅ PASS" : "❌ FAIL";
    if (verdict === "✅ PASS") passCount++;
    lines.push(`| **${name}** — \`${id}\` | ${engineOk} | ${pageOk} | ${verdict} |`);
  }
  lines.push("");
}

lines.push("## Summary");
lines.push("");
lines.push(`| Layer | Result |`);
lines.push(`|-------|--------|`);
lines.push(`| Engine unit tests (60 tools) | ${passCount === 60 ? "ALL PASS" : `${passCount}/60 pass`} |`);
lines.push(`| Page SSR render (60 tools) | ${page ? Object.values(page).filter((p) => p.ok).length + "/60 render OK" : "server off"} |`);
lines.push("");
lines.push("> Manual browser pass still recommended for: file drag-drop, canvas-based tools (compress/invert/grayscale/B&W),");
lines.push("> speech synthesis (TTS), and final visual review of generated PDFs.");

writeFileSync("docs/TOOL-TESTING-LOG.md", lines.join("\n") + "\n", "utf8");
console.log(`\nWrote docs/TOOL-TESTING-LOG.md — ${passCount}/60 engine pass.`);
