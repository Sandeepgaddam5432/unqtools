/**
 * PDF to HTML Converter — wraps PDF text extraction in semantic HTML.
 *
 * Reuses the PDF text extraction pipeline from pdf-to-text-converter.
 * Output is a complete HTML5 document with <section> per page and <p> per line.
 */

import {
  extractPdfText, formatBytes,
  type ConvertOptions as TextOptions, type PdfTextResult,
} from "../pdf-to-text-converter/logic";
import type { ToolResult } from "../../../lib/tool";

// ===== Types =====

export interface HtmlOptions {
  /** Page range (e.g. "1-3,5"). Empty = all pages. */
  pageRange: string;
  /** Custom CSS injected into the HTML head. */
  customCss: string;
  /** Document title (goes into <title>). */
  title: string;
  /** Page separator style. */
  pageSeparator: "hr" | "div" | "none";
  /** Encoding BOM. */
  addBom: boolean;
}

export const DEFAULT_OPTIONS: HtmlOptions = {
  pageRange: "",
  customCss: `body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1a1a1a; }
section { margin-bottom: 2rem; }
.page-break { border: none; border-top: 2px dashed #ccc; margin: 2rem 0; }
p { margin: 0.5em 0; }`,
  title: "Converted from PDF",
  pageSeparator: "hr",
  addBom: false,
};

export interface HtmlResult {
  html: string;
  pageCount: number;
  wordCount: number;
  charCount: number;
  lineCount: number;
  htmlBytes: number;
}

// ===== HTML generation =====

/** Escape special HTML characters in text. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Generate the page separator HTML based on the chosen style. */
function pageSeparatorHtml(style: HtmlOptions["pageSeparator"]): string {
  if (style === "hr") return '<hr class="page-break">';
  if (style === "div") return '<div class="page-break" aria-hidden="true"></div>';
  return "";
}

/** Convert a PdfTextResult into a complete HTML5 document. */
export function generateHtml(result: PdfTextResult, opts: HtmlOptions): HtmlResult {
  const sections: string[] = [];
  for (const page of result.pages) {
    const paragraphs = page.text
      .split("\n")
      .filter((l) => l !== "")
      .map((l) => `      <p>${escapeHtml(l)}</p>`)
      .join("\n");
    const sectionId = `page-${page.pageNumber}`;
    const section = `  <section id="${sectionId}" data-page="${page.pageNumber}">
    <h2>Page ${page.pageNumber}</h2>
${paragraphs}
  </section>`;
    sections.push(section);
  }
  const separator = pageSeparatorHtml(opts.pageSeparator);
  const body = separator ? sections.join(`\n  ${separator}\n`) : sections.join("\n");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(opts.title)}</title>
  <style>
${opts.customCss}
  </style>
</head>
<body>
  <h1>${escapeHtml(opts.title)}</h1>
${body}
</body>
</html>`;
  const htmlBytes = new TextEncoder().encode(opts.addBom ? "\uFEFF" + html : html).length;
  return {
    html,
    pageCount: result.pageCount,
    wordCount: result.totalWordCount,
    charCount: result.totalCharCount,
    lineCount: result.totalLineCount,
    htmlBytes,
  };
}

// ===== Top-level conversion =====

export async function convertPdfToHtml(
  pdfBytes: Uint8Array,
  opts: HtmlOptions = DEFAULT_OPTIONS,
): Promise<ToolResult<HtmlResult>> {
  const textOptions: TextOptions = {
    pageRange: opts.pageRange,
    lineSeparator: "\n",
    pageSeparator: "",
    trimLines: true,
    removeEmptyLines: false,
    lineNumbers: false,
    addBom: false,
  };
  const textResult = await extractPdfText(pdfBytes, textOptions);
  if (!textResult.ok) {
    return { ok: false, error: textResult.error };
  }
  const html = generateHtml(textResult.output, opts);
  return { ok: true, output: html };
}

// ===== Utilities =====

export { formatBytes };

// ===== History =====

const HISTORY_KEY = "unqtools-pdf-to-html-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  pdfBytes: number;
  htmlBytes: number;
  pageCount: number;
  wordCount: number;
  convertedAt: string;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch { return []; }
}

export function saveToHistory(entry: HistoryEntry): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const updated = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
}

// ===== Shareable URL =====

export function buildShareUrl(opts: HtmlOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  if (opts.pageRange) params.set("pages", opts.pageRange);
  if (opts.title && opts.title !== "Converted from PDF") params.set("title", opts.title);
  params.set("sep", opts.pageSeparator);
  params.set("bom", String(opts.addBom));
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<HtmlOptions> | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("pages") && !params.has("sep")) return null;
  const sep = (params.get("sep") ?? "hr") as HtmlOptions["pageSeparator"];
  const validSeps: HtmlOptions["pageSeparator"][] = ["hr", "div", "none"];
  return {
    pageRange: params.get("pages") ?? "",
    title: params.get("title") ?? "",
    pageSeparator: validSeps.includes(sep) ? sep : "hr",
    addBom: params.get("bom") === "true",
  };
}
