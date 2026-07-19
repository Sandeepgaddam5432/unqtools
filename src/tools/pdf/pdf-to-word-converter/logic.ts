/**
 * PDF to Word Converter — pure logic.
 *
 * Pure functions only — no DOM, no pdf-lib. The PDF content-stream parsing
 * lives in ui.tsx; this module handles heading detection, paragraph grouping,
 * DOCX/HTML/Markdown/text rendering, ZIP packaging, history, and shareable URLs.
 */

export type OutputFormat = "docx" | "html" | "markdown" | "plain-text";

export const OUTPUT_FORMATS: OutputFormat[] = ["docx", "html", "markdown", "plain-text"];

export const FORMAT_LABELS: Record<OutputFormat, string> = {
  docx: "Word (.docx)",
  html: "HTML (.html)",
  markdown: "Markdown (.md)",
  "plain-text": "Plain text (.txt)",
};

export const FORMAT_EXTENSIONS: Record<OutputFormat, string> = {
  docx: "docx",
  html: "html",
  markdown: "md",
  "plain-text": "txt",
};

export const FORMAT_MIME: Record<OutputFormat, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  html: "text/html",
  markdown: "text/markdown",
  "plain-text": "text/plain",
};

export type HeadingLevel = "h1" | "h2" | "h3" | "body";

/** A single extracted text fragment with font size and basic styling. */
export interface TextItem {
  text: string;
  /** Font size in PDF points. 0 if unknown. */
  fontSize: number;
  /** 1-based page number in the source PDF. */
  pageNumber: number;
  bold?: boolean;
  italic?: boolean;
}

/** A paragraph (group of consecutive text items on the same page). */
export interface Paragraph {
  /** Heading level or "body". */
  level: HeadingLevel;
  text: string;
  pageNumber: number;
  bold?: boolean;
  italic?: boolean;
}

/** A page's worth of paragraphs. */
export interface PageBlock {
  pageNumber: number;
  paragraphs: Paragraph[];
}

/** Whole converted document. */
export interface DocumentStructure {
  pages: PageBlock[];
  bodyFontSize: number;
  headingFontSizes: number[];
}

export interface ConvertOptions {
  pageRange: string;
  outputFormat: OutputFormat;
  includePageBreaks: boolean;
  preserveHeadings: boolean;
}

export const DEFAULT_OPTIONS: ConvertOptions = {
  pageRange: "all",
  outputFormat: "docx",
  includePageBreaks: true,
  preserveHeadings: true,
};

export interface SummaryStats {
  totalPages: number;
  totalParagraphs: number;
  totalHeadings: number;
  totalWords: number;
  totalChars: number;
  avgWordsPerPage: number;
}

export interface HistoryEntry {
  ts: number;
  fileName: string;
  pageCount: number;
  paragraphCount: number;
  headingCount: number;
  format: OutputFormat;
}

export interface TextStructureStats {
  paragraphs: number;
  sentences: number;
  words: number;
  chars: number;
}

// ---------------------------------------------------------------------------
// Page-range spec normalization
// ---------------------------------------------------------------------------

export function normalizePageRangeSpec(spec: string): string {
  const trimmed = (spec ?? "").trim().toLowerCase();
  if (!trimmed) return "all";
  if (trimmed === "all") return "all";
  return trimmed.replace(/\s+/g, " ");
}

export function resolveAllRange(spec: string, pageCount: number): string {
  const normalized = normalizePageRangeSpec(spec);
  if (normalized === "all") return pageCount > 0 ? `1-${pageCount}` : "1";
  return normalized;
}

// ---------------------------------------------------------------------------
// Font-size analysis
// ---------------------------------------------------------------------------

/**
 * Analyze font sizes across a list of text items.
 * Returns the most common (body) size and a sorted list of larger sizes.
 */
export function analyzeFontSizes(items: TextItem[]): { bodyFontSize: number; headingFontSizes: number[] } {
  if (items.length === 0) return { bodyFontSize: 0, headingFontSizes: [] };
  const counts = new Map<number, number>();
  let totalChars = 0;
  for (const it of items) {
    if (it.fontSize <= 0) continue;
    const len = it.text.length;
    counts.set(it.fontSize, (counts.get(it.fontSize) ?? 0) + len);
    totalChars += len;
  }
  if (counts.size === 0 || totalChars === 0) {
    return { bodyFontSize: 0, headingFontSizes: [] };
  }
  // Body = size covering most characters
  let body = 0;
  let bodyChars = -1;
  for (const [size, chars] of counts) {
    if (chars > bodyChars) {
      body = size;
      bodyChars = chars;
    }
  }
  const headingFontSizes = Array.from(counts.keys())
    .filter((s) => s > body * 1.15)
    .sort((a, b) => b - a);
  return { bodyFontSize: body, headingFontSizes };
}

/** Classify a font size as H1/H2/H3/body given the body size and thresholds. */
export function classifyHeadingLevel(
  fontSize: number,
  bodyFontSize: number,
  headingSizes: number[] = [],
): HeadingLevel {
  if (bodyFontSize <= 0 || fontSize <= bodyFontSize * 1.15) return "body";
  // Sort heading sizes descending — largest is H1, next H2, next H3
  const sorted = [...headingSizes].sort((a, b) => b - a);
  if (sorted.length === 0) {
    // Fall back to ratio thresholds
    const ratio = fontSize / bodyFontSize;
    if (ratio >= 2) return "h1";
    if (ratio >= 1.5) return "h2";
    return "h3";
  }
  if (fontSize >= sorted[0]) return "h1";
  if (sorted.length >= 2 && fontSize >= sorted[1]) return "h2";
  if (sorted.length >= 3 && fontSize >= sorted[2]) return "h3";
  // If fontSize is bigger than body but smaller than 3rd-largest heading, still call it h3
  if (fontSize > bodyFontSize * 1.15) return "h3";
  return "body";
}

// ---------------------------------------------------------------------------
// Paragraph grouping
// ---------------------------------------------------------------------------

/** Detect paragraphs from a flat list of text items on one page. */
export function detectParagraphs(items: TextItem[], bodyFontSize: number, headingSizes: number[]): Paragraph[] {
  const out: Paragraph[] = [];
  let current = "";
  let currentPage = 0;
  let currentSize = 0;
  let currentBold = false;
  let currentItalic = false;
  const flush = () => {
    const trimmed = current.trim();
    if (trimmed) {
      out.push({
        level: classifyHeadingLevel(currentSize, bodyFontSize, headingSizes),
        text: trimmed,
        pageNumber: currentPage,
        bold: currentBold,
        italic: currentItalic,
      });
    }
    current = "";
  };
  for (const it of items) {
    if (current && (it.fontSize !== currentSize || it.bold !== currentBold || it.italic !== currentItalic)) {
      flush();
    }
    // Pre-split on paragraph breaks (blank lines)
    const parts = it.text.split(/\n\s*\n/);
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) flush();
      current += parts[i].replace(/\s+/g, " ");
    }
    currentSize = it.fontSize;
    currentPage = it.pageNumber;
    currentBold = it.bold ?? false;
    currentItalic = it.italic ?? false;
    // Sentence-ending period followed by 2+ spaces → paragraph break (rare in PDFs but possible)
    if (/\.\s{2,}/.test(current)) {
      flush();
    }
  }
  flush();
  return out;
}

// ---------------------------------------------------------------------------
// Body text formatting
// ---------------------------------------------------------------------------

/** Normalize whitespace in body text. */
export function formatBodyText(text: string): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

/** Insert a page-break marker between page blocks (for non-DOCX outputs). */
export function insertPageBreak(parts: string[], format: OutputFormat): string {
  const sep = format === "markdown" ? "\n\n---\n\n" : format === "html" ? '<hr style="page-break-after:always;"/>' : "\n\n";
  return parts.join(sep);
}

// ---------------------------------------------------------------------------
// Style detection (basic)
// ---------------------------------------------------------------------------

/** Detect bold/italic by inspecting font flags — basic implementation. */
export function detectBoldItalic(items: TextItem[]): { hasBold: boolean; hasItalic: boolean } {
  let hasBold = false;
  let hasItalic = false;
  for (const it of items) {
    if (it.bold) hasBold = true;
    if (it.italic) hasItalic = true;
    if (hasBold && hasItalic) break;
  }
  return { hasBold, hasItalic };
}

/**
 * Basic table detector — looks for runs of text items where consecutive items
 * have similar Y coordinates and evenly spaced X coordinates. This is a
 * heuristic; PDFs without explicit table structure won't be detected.
 */
export function detectTable(items: TextItem[]): boolean {
  if (items.length < 6) return false;
  // Group by approximate line (we only have font size, not positions, so this is a stub)
  // In practice, ui.tsx may attach positional data; here we return false by default.
  return false;
}

// ---------------------------------------------------------------------------
// Text structure analysis
// ---------------------------------------------------------------------------

export function analyzeTextStructure(text: string): TextStructureStats {
  const t = text ?? "";
  const paragraphs = t.split(/\n\s*\n/).filter((s) => s.trim().length > 0).length;
  const sentences = (t.match(/[^.!?]+[.!?]+/g) ?? []).length;
  const words = (t.match(/\S+/g) ?? []).length;
  const chars = t.length;
  return { paragraphs, sentences, words, chars };
}

export function analyzeDocumentStructure(pages: PageBlock[]): DocumentStructure {
  const allItems: TextItem[] = [];
  for (const p of pages) {
    for (const para of p.paragraphs) {
      allItems.push({
        text: para.text,
        fontSize: para.level === "body" ? 0 : 999, // placeholder — real analysis happens in ui.tsx
        pageNumber: p.pageNumber,
        bold: para.bold,
        italic: para.italic,
      });
    }
  }
  return {
    pages,
    bodyFontSize: 0,
    headingFontSizes: [],
  };
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

export function computeSummaryStats(structure: DocumentStructure): SummaryStats {
  let totalParagraphs = 0;
  let totalHeadings = 0;
  let totalWords = 0;
  let totalChars = 0;
  for (const page of structure.pages) {
    for (const p of page.paragraphs) {
      totalParagraphs += 1;
      if (p.level !== "body") totalHeadings += 1;
      const words = (p.text.match(/\S+/g) ?? []).length;
      totalWords += words;
      totalChars += p.text.length;
    }
  }
  const totalPages = structure.pages.length;
  return {
    totalPages,
    totalParagraphs,
    totalHeadings,
    totalWords,
    totalChars,
    avgWordsPerPage: totalPages > 0 ? Math.round(totalWords / totalPages) : 0,
  };
}

// ---------------------------------------------------------------------------
// Escaping
// ---------------------------------------------------------------------------

export function escapeXml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function escapeMarkdown(s: string): string {
  // Escape characters that have meaning in Markdown
  return (s ?? "").replace(/([\\`*_{\}\[\]()#+\-.!|>])/g, "\\$1");
}

// ---------------------------------------------------------------------------
// Output renderers
// ---------------------------------------------------------------------------

/** Render the document as plain text. */
export function renderPlainText(structure: DocumentStructure, opts: ConvertOptions): string {
  const parts: string[] = [];
  for (const page of structure.pages) {
    const pageParts: string[] = [];
    for (const p of page.paragraphs) {
      const prefix = opts.preserveHeadings && p.level === "h1" ? "# "
        : opts.preserveHeadings && p.level === "h2" ? "## "
        : opts.preserveHeadings && p.level === "h3" ? "### "
        : "";
      pageParts.push(prefix + formatBodyText(p.text));
    }
    parts.push(pageParts.join("\n\n"));
  }
  return insertPageBreak(parts, opts.includePageBreaks ? "plain-text" : "markdown").replace(/\n{3,}/g, "\n\n").trim();
}

/** Render the document as HTML with h1/h2/h3 and p tags. */
export function renderHtml(structure: DocumentStructure, opts: ConvertOptions): string {
  const parts: string[] = [];
  for (const page of structure.pages) {
    const pageParts: string[] = [];
    for (const p of page.paragraphs) {
      const text = escapeHtml(formatBodyText(p.text));
      const tag = opts.preserveHeadings && p.level !== "body" ? p.level : "p";
      pageParts.push(`<${tag}>${text}</${tag}>`);
    }
    parts.push(pageParts.join("\n"));
  }
  const body = opts.includePageBreaks
    ? parts.join('\n<hr style="page-break-after:always;"/>\n')
    : parts.join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Converted PDF</title>
</head>
<body>
${body}
</body>
</html>`;
}

/** Render the document as Markdown. */
export function renderMarkdown(structure: DocumentStructure, opts: ConvertOptions): string {
  const parts: string[] = [];
  for (const page of structure.pages) {
    const pageParts: string[] = [];
    for (const p of page.paragraphs) {
      const text = formatBodyText(p.text);
      if (opts.preserveHeadings && p.level === "h1") pageParts.push(`# ${text}\n`);
      else if (opts.preserveHeadings && p.level === "h2") pageParts.push(`## ${text}\n`);
      else if (opts.preserveHeadings && p.level === "h3") pageParts.push(`### ${text}\n`);
      else pageParts.push(text);
    }
    parts.push(pageParts.join("\n\n"));
  }
  return opts.includePageBreaks
    ? parts.join("\n\n---\n\n").replace(/\n{3,}/g, "\n\n").trim()
    : parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Generate minimal OOXML document.xml content. */
export function generateDocumentXml(structure: DocumentStructure, opts: ConvertOptions): string {
  const paragraphs: string[] = [];
  for (let pi = 0; pi < structure.pages.length; pi++) {
    const page = structure.pages[pi];
    for (const p of page.paragraphs) {
      const text = escapeXml(formatBodyText(p.text));
      const isHeading = opts.preserveHeadings && p.level !== "body";
      const outlineLvl = p.level === "h1" ? 0 : p.level === "h2" ? 1 : p.level === "h3" ? 2 : -1;
      const rPr = isHeading
        ? `<w:rPr><w:b/><w:sz w:val="${p.level === "h1" ? 36 : p.level === "h2" ? 30 : 26}"/></w:rPr>`
        : (p.bold || p.italic)
          ? `<w:rPr>${p.bold ? "<w:b/>" : ""}${p.italic ? "<w:i/>" : ""}</w:rPr>`
          : "";
      const pPr = isHeading
        ? `<w:pPr><w:outlineLvl w:val="${outlineLvl}"/></w:pPr>`
        : "";
      paragraphs.push(
        `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`,
      );
    }
    if (opts.includePageBreaks && pi < structure.pages.length - 1) {
      paragraphs.push(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${paragraphs.join("\n")}
</w:body>
</w:document>`;
}

/** Generate [Content_Types].xml for the DOCX package. */
export function generateContentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
}

/** Generate _rels/.rels for the DOCX package. */
export function generateRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
}

// ---------------------------------------------------------------------------
// ZIP file builder (store mode, no compression)
// ---------------------------------------------------------------------------

/** CRC-32 table (polynomial 0xEDB88320). */
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** Compute CRC-32 of a byte array. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/** Encode a string as UTF-8 bytes. */
export function utf8Encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** Write a Uint32 value (little-endian) into a number array. */
function pushU32(arr: number[], val: number): void {
  arr.push(val & 0xFF, (val >>> 8) & 0xFF, (val >>> 16) & 0xFF, (val >>> 24) & 0xFF);
}

/** Write a Uint16 value (little-endian) into a number array. */
function pushU16(arr: number[], val: number): void {
  arr.push(val & 0xFF, (val >>> 8) & 0xFF);
}

export interface ZipFile {
  name: string;
  bytes: Uint8Array;
}

/**
 * Build a minimal valid ZIP archive (store mode, no compression).
 * Returns the archive bytes.
 */
export function buildZip(files: ZipFile[]): Uint8Array {
  const out: number[] = [];
  const centralDir: number[] = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = utf8Encode(file.name);
    const crc = crc32(file.bytes);
    const size = file.bytes.length;
    // Local file header (signature 0x04034b50)
    pushU32(out, 0x04034b50);
    pushU16(out, 20);       // version needed
    pushU16(out, 0);        // flags
    pushU16(out, 0);        // compression: store
    pushU16(out, 0);        // mod time
    pushU16(out, 0);        // mod date
    pushU32(out, crc);
    pushU32(out, size);     // compressed size
    pushU32(out, size);     // uncompressed size
    pushU16(out, nameBytes.length);
    pushU16(out, 0);        // extra field length
    for (const b of nameBytes) out.push(b);
    for (const b of file.bytes) out.push(b);
    // Central directory entry (signature 0x02014b50)
    pushU32(centralDir, 0x02014b50);
    pushU16(centralDir, 20); // version made by
    pushU16(centralDir, 20); // version needed
    pushU16(centralDir, 0);  // flags
    pushU16(centralDir, 0);  // compression
    pushU16(centralDir, 0);  // mod time
    pushU16(centralDir, 0);  // mod date
    pushU32(centralDir, crc);
    pushU32(centralDir, size);
    pushU32(centralDir, size);
    pushU16(centralDir, nameBytes.length);
    pushU16(centralDir, 0);  // extra
    pushU16(centralDir, 0);  // comment
    pushU16(centralDir, 0);  // disk number
    pushU16(centralDir, 0);  // internal attrs
    pushU32(centralDir, 0);  // external attrs
    pushU32(centralDir, offset); // local header offset
    for (const b of nameBytes) centralDir.push(b);
    offset = out.length;
  }
  const cdStart = out.length;
  const cdSize = centralDir.length;
  for (const b of centralDir) out.push(b);
  // End of central directory record (signature 0x06054b50)
  pushU32(out, 0x06054b50);
  pushU16(out, 0);          // disk number
  pushU16(out, 0);          // disk with CD
  pushU16(out, files.length); // entries on disk
  pushU16(out, files.length); // total entries
  pushU32(out, cdSize);
  pushU32(out, cdStart);
  pushU16(out, 0);          // comment length
  return new Uint8Array(out);
}

// ---------------------------------------------------------------------------
// DOCX package assembly
// ---------------------------------------------------------------------------

/** Build a complete .docx file (ZIP of OOXML XML parts). */
export function buildDocxPackage(structure: DocumentStructure, opts: ConvertOptions): Uint8Array {
  const files: ZipFile[] = [
    { name: "[Content_Types].xml", bytes: utf8Encode(generateContentTypesXml()) },
    { name: "_rels/.rels", bytes: utf8Encode(generateRelsXml()) },
    { name: "word/document.xml", bytes: utf8Encode(generateDocumentXml(structure, opts)) },
  ];
  return buildZip(files);
}

/** Dispatch to the renderer matching the chosen format. Returns string for text-based formats. */
export function renderOutput(structure: DocumentStructure, opts: ConvertOptions): string {
  switch (opts.outputFormat) {
    case "plain-text": return renderPlainText(structure, opts);
    case "html": return renderHtml(structure, opts);
    case "markdown": return renderMarkdown(structure, opts);
    case "docx":
      // DOCX is binary — return a placeholder text. UI calls buildDocxPackage directly.
      return "(DOCX is a binary file — use the Download button.)";
    default: return renderPlainText(structure, opts);
  }
}

/** Build the download filename for a given format and original PDF name. */
export function getOutputFilename(format: OutputFormat, originalName: string): string {
  const base = (originalName ?? "output").replace(/\.pdf$/i, "").replace(/[^\w.-]+/g, "_") || "output";
  return `${base}.${FORMAT_EXTENSIONS[format]}`;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-to-word-converter:history";
const HISTORY_MAX = 20;

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore quota errors
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

const VALID_FORMATS = new Set<OutputFormat>(["docx", "html", "markdown", "plain-text"]);

export function buildShareUrl(opts: ConvertOptions): string {
  const params = new URLSearchParams();
  if (opts.pageRange && opts.pageRange !== "all") params.set("range", opts.pageRange);
  if (opts.outputFormat !== "docx") params.set("format", opts.outputFormat);
  if (!opts.includePageBreaks) params.set("pageBreaks", "0");
  if (!opts.preserveHeadings) params.set("headings", "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ConvertOptions> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ConvertOptions> = {};
  const range = params.get("range");
  if (range) out.pageRange = range;
  const format = params.get("format");
  if (format && VALID_FORMATS.has(format as OutputFormat)) out.outputFormat = format as OutputFormat;
  const pageBreaks = params.get("pageBreaks");
  if (pageBreaks !== null) out.includePageBreaks = pageBreaks !== "0";
  const headings = params.get("headings");
  if (headings !== null) out.preserveHeadings = headings !== "0";
  return out;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

import type { ToolResult } from "../../../lib/tool";

export function validateOptions(opts: ConvertOptions, pageCount: number): ToolResult<ConvertOptions> {
  if (!opts) return { ok: false, error: "Missing options." };
  if (!OUTPUT_FORMATS.includes(opts.outputFormat)) {
    return { ok: false, error: `Unknown output format: ${opts.outputFormat}` };
  }
  const normalized = normalizePageRangeSpec(opts.pageRange);
  if (normalized !== "all" && pageCount > 0) {
    if (!/^[0-9,\-\s]+$/.test(normalized)) {
      return { ok: false, error: `Invalid page range "${opts.pageRange}". Use "all" or e.g. "1-3, 5, 8-".` };
    }
  }
  return { ok: true, output: { ...opts, pageRange: normalized } };
}
