/**
 * PDF to Text Converter — pure-JS PDF content-stream text extractor.
 *
 * PDF text is stored inside content streams (one or more per page). A content
 * stream is a sequence of operators and operands. The text-showing operators
 * we look for are:
 *
 *   Tj   — show text (one string operand)
 *   TJ   — show text with individual glyph positioning (array of strings/numbers)
 *   '    — move to next line and show text (one string operand)
 *   "    — set word and char spacing, move to next line, show text (aw, ac, string)
 *   BT   — begin text object
 *   ET   — end text object
 *   Td   — move text position (tx, ty)
 *   TD   — move and set leading (tx, ty)
 *   Tm   — set text matrix (a, b, c, d, e, f)
 *   T*   — move to next line
 *
 * String operands come in two flavors:
 *   - Literal strings: (Hello) — bytes inside parens, with escapes
 *   - Hex strings: <48656C6C6F> — hex-encoded bytes
 *
 * Strings may use PDFDocEncoding (Latin-1-like) or UTF-16BE (with 0xFE 0xFF BOM).
 * We detect UTF-16BE by the BOM and decode accordingly.
 *
 * Content streams are typically FlateDecode-compressed. We decompress with
 * DecompressionStream("deflate-raw") before parsing.
 */

import { PDFDocument, PDFRawStream, PDFRef, PDFContentStream, PDFOperator } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

// ===== Types =====

export interface PageText {
  /** 1-indexed page number. */
  pageNumber: number;
  /** Extracted text (lines joined with '\n'). */
  text: string;
  /** Number of lines extracted. */
  lineCount: number;
  /** Number of words extracted. */
  wordCount: number;
  /** Number of characters extracted. */
  charCount: number;
}

export interface PdfTextResult {
  pages: PageText[];
  pageCount: number;
  totalWordCount: number;
  totalCharCount: number;
  totalLineCount: number;
}

export interface ConvertOptions {
  /** Page range (e.g. "1-3,5,7-9"). Empty = all pages. */
  pageRange: string;
  /** Line separator (default '\n'). */
  lineSeparator: string;
  /** Page separator (inserted between pages). */
  pageSeparator: string;
  /** Trim whitespace from each line. */
  trimLines: boolean;
  /** Remove empty lines from output. */
  removeEmptyLines: boolean;
  /** Prepend line numbers to each line. */
  lineNumbers: boolean;
  /** Prepend UTF-8 BOM to output. */
  addBom: boolean;
}

export const DEFAULT_OPTIONS: ConvertOptions = {
  pageRange: "",
  lineSeparator: "\n",
  pageSeparator: "\n\n--- Page Break ---\n\n",
  trimLines: true,
  removeEmptyLines: false,
  lineNumbers: false,
  addBom: false,
};

// ===== Page range parser =====

/**
 * Parse a page range string like "1-3,5,7-9" into a sorted unique list
 * of 1-indexed page numbers. Empty string returns null (= all pages).
 */
export function parsePageRange(range: string, totalPages: number): number[] | null {
  const trimmed = range.trim();
  if (!trimmed) return null;
  const result = new Set<number>();
  for (const part of trimmed.split(",")) {
    const p = part.trim();
    if (!p) continue;
    const dashIdx = p.indexOf("-");
    if (dashIdx >= 0) {
      const start = parseInt(p.slice(0, dashIdx), 10);
      const end = parseInt(p.slice(dashIdx + 1), 10);
      if (!isNaN(start) && !isNaN(end)) {
        const s = Math.max(1, Math.min(start, end));
        const e = Math.min(totalPages, Math.max(start, end));
        for (let i = s; i <= e; i++) result.add(i);
      }
    } else {
      const n = parseInt(p, 10);
      if (!isNaN(n) && n >= 1 && n <= totalPages) result.add(n);
    }
  }
  return Array.from(result).sort((a, b) => a - b);
}

// ===== PDF content stream access =====

/** Get the raw content stream bytes for a single page. Returns concatenated bytes from all streams. */
async function getPageContentBytes(doc: PDFDocument, pageIndex: number): Promise<Uint8Array[]> {
  const pages = doc.getPages();
  const page = pages[pageIndex];
  if (!page) return [];
  const node = page.node;
  const contents = node.Contents();
  if (!contents) return [];
  const streams: Uint8Array[] = [];
  // contents may be a single stream, a single ref, or an array
  const arr = (contents as { array?: unknown[] }).array;
  if (Array.isArray(arr)) {
    for (const elem of arr) {
      const looked = elem instanceof PDFRef ? doc.context.lookup(elem) : elem;
      if (looked instanceof PDFRawStream) {
        streams.push(looked.contents);
      } else if (looked instanceof PDFContentStream) {
        // Unwrap content stream's underlying stream
        const unwrapped = (looked as unknown as { stream?: { contents?: Uint8Array } }).stream;
        if (unwrapped?.contents) streams.push(unwrapped.contents);
      }
    }
  } else {
    // Single stream or ref
    const looked = contents instanceof PDFRef ? doc.context.lookup(contents) : contents;
    if (looked instanceof PDFRawStream) {
      streams.push(looked.contents);
    } else if (looked instanceof PDFContentStream) {
      const unwrapped = (looked as unknown as { stream?: { contents?: Uint8Array } }).stream;
      if (unwrapped?.contents) streams.push(unwrapped.contents);
    }
  }
  return streams;
}

/** Inflate a FlateDecode-compressed stream using DecompressionStream.
 * PDF spec uses zlib-wrapped DEFLATE (RFC 1950), so we try "deflate" first.
 * Some PDFs use raw DEFLATE (no zlib header), so we fall back to "deflate-raw". */
export async function inflateRawDeflate(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("DecompressionStream is not available in this environment.");
  }
  // Detect zlib header: 0x78 followed by 0x01, 0x9c, 0xda, or 0x5e (typical zlib CMF/FLG)
  const hasZlibHeader = bytes.length >= 2 && bytes[0] === 0x78 && [0x01, 0x5e, 0x9c, 0xda].includes(bytes[1]!);
  const format = hasZlibHeader ? "deflate" : "deflate-raw";
  return inflateWithFormat(bytes, format);
}

/** Inflate bytes using a specific DecompressionStream format. */
async function inflateWithFormat(bytes: Uint8Array, format: "deflate" | "deflate-raw"): Promise<Uint8Array> {
  const stream = new DecompressionStream(format);
  const writer = stream.writable.getWriter();
  // Capture the writer's closed promise to handle async errors.
  const writerClosed = writer.closed.catch(() => { /* swallow async errors */ });
  const reader = stream.readable.getReader();
  const readerClosed = reader.closed.catch(() => { /* swallow async errors */ });
  const chunks: Uint8Array[] = [];
  let total = 0;
  let readErr: Error | null = null;
  try {
    await writer.write(bytes);
    await writer.close();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.length;
      }
    }
  } catch (err) {
    readErr = err as Error;
  }
  try { reader.releaseLock(); } catch { /* ignore */ }
  try { writer.releaseLock(); } catch { /* ignore */ }
  await Promise.allSettled([writerClosed, readerClosed]);
  if (readErr) {
    throw readErr;
  }
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

// ===== PDF string decoding =====

/**
 * Decode a PDF string operand (literal or hex) into a JavaScript string.
 * Strings may be UTF-16BE (starts with 0xFE 0xFF) or PDFDocEncoding (Latin-1).
 */
export function decodePdfString(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  // UTF-16BE BOM
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let out = "";
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      const code = (bytes[i]! << 8) | bytes[i + 1]!;
      out += String.fromCharCode(code);
    }
    return out;
  }
  // UTF-16LE BOM (rare in PDF but possible)
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    let out = "";
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      const code = bytes[i]! | (bytes[i + 1]! << 8);
      out += String.fromCharCode(code);
    }
    return out;
  }
  // PDFDocEncoding ≈ Latin-1 for the printable range
  let out = "";
  for (const b of bytes) {
    out += String.fromCharCode(b);
  }
  return out;
}

/** Parse a literal string starting at offset (after the opening '('). Returns [bytes, newOffset]. */
function parseLiteralString(content: Uint8Array, start: number): [Uint8Array, number] {
  const out: number[] = [];
  let i = start;
  let parenDepth = 1;
  while (i < content.length) {
    const b = content[i]!;
    if (b === 0x5c) {
      // Backslash escape
      const next = content[i + 1];
      if (next === 0x6e) { out.push(0x0a); i += 2; }
      else if (next === 0x72) { out.push(0x0d); i += 2; }
      else if (next === 0x74) { out.push(0x09); i += 2; }
      else if (next === 0x62) { out.push(0x08); i += 2; }
      else if (next === 0x66) { out.push(0x0c); i += 2; }
      else if (next === 0x28) { out.push(0x28); i += 2; }
      else if (next === 0x29) { out.push(0x29); i += 2; }
      else if (next === 0x5c) { out.push(0x5c); i += 2; }
      else if (next === 0x0a) { i += 2; } // line continuation
      else if (next === 0x0d) {
        i += 2;
        if (content[i] === 0x0a) i++;
      } else if (next !== undefined && next >= 0x30 && next <= 0x37) {
        // Octal escape: \ddd (1-3 octal digits)
        let oct = String.fromCharCode(next);
        let j = i + 2;
        for (let k = 0; k < 2 && j < content.length; k++, j++) {
          const d = content[j];
          if (d === undefined || d < 0x30 || d > 0x37) break;
          oct += String.fromCharCode(d);
        }
        out.push(parseInt(oct, 8) & 0xff);
        i = j;
      } else {
        // Unknown escape — keep the next char literally
        if (next !== undefined) out.push(next);
        i += 2;
      }
    } else if (b === 0x28) {
      parenDepth++;
      out.push(b);
      i++;
    } else if (b === 0x29) {
      parenDepth--;
      if (parenDepth === 0) {
        i++;
        break;
      }
      out.push(b);
      i++;
    } else {
      out.push(b);
      i++;
    }
  }
  return [new Uint8Array(out), i];
}

/** Parse a hex string starting at offset (after the opening '<'). Returns [bytes, newOffset]. */
function parseHexString(content: Uint8Array, start: number): [Uint8Array, number] {
  const out: number[] = [];
  let i = start;
  let nibble: number | null = null;
  while (i < content.length) {
    const b = content[i]!;
    if (b === 0x3e) { // '>'
      i++;
      break;
    }
    if (b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d) { i++; continue; }
    const digit = hexDigit(b);
    if (digit >= 0) {
      if (nibble === null) {
        nibble = digit;
      } else {
        out.push((nibble << 4) | digit);
        nibble = null;
      }
    }
    i++;
  }
  if (nibble !== null) out.push(nibble << 4); // odd hex digits — pad with 0
  return [new Uint8Array(out), i];
}

function hexDigit(b: number): number {
  if (b >= 0x30 && b <= 0x39) return b - 0x30;
  if (b >= 0x41 && b <= 0x46) return b - 0x41 + 10;
  if (b >= 0x61 && b <= 0x66) return b - 0x61 + 10;
  return -1;
}

// ===== Content stream parser =====

/**
 * Parse a single content stream and extract text-showing operations.
 * Returns a list of text strings, with line breaks at Td/TD/Tm/T*' operators.
 */
export function extractTextFromContentStream(content: Uint8Array): string[] {
  const lines: string[] = [];
  let currentLine = "";
  const i = 0;
  void i;
  const len = content.length;
  let pos = 0;
  let inTextBlock = false;

  while (pos < len) {
    const b = content[pos]!;
    // Skip whitespace
    if (b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d) {
      pos++;
      continue;
    }
    // Comment
    if (b === 0x25) { // '%'
      while (pos < len && content[pos] !== 0x0a && content[pos] !== 0x0d) pos++;
      continue;
    }
    // Literal string
    if (b === 0x28) { // '('
      const [bytes, newPos] = parseLiteralString(content, pos + 1);
      pos = newPos;
      if (inTextBlock) {
        currentLine += decodePdfString(bytes);
      }
      continue;
    }
    // Hex string
    if (b === 0x3c) { // '<'
      // Could be '<<' (dict start) — check
      if (content[pos + 1] === 0x3c) {
        pos += 2;
        continue;
      }
      const [bytes, newPos] = parseHexString(content, pos + 1);
      pos = newPos;
      if (inTextBlock) {
        currentLine += decodePdfString(bytes);
      }
      continue;
    }
    // Array
    if (b === 0x5b) { // '['
      // Could be TJ array — parse until ']' and extract strings
      const [arrayStrings, newPos] = parseTjArray(content, pos + 1, inTextBlock);
      pos = newPos;
      if (inTextBlock) {
        currentLine += arrayStrings;
      }
      continue;
    }
    // Number
    if ((b >= 0x30 && b <= 0x39) || b === 0x2b || b === 0x2d || b === 0x2e) {
      pos = skipNumber(content, pos);
      continue;
    }
    // Name (e.g. /Hello)
    if (b === 0x2f) {
      pos++;
      while (pos < len && !isDelimiter(content[pos]!)) pos++;
      continue;
    }
    // Operator (sequence of letters)
    if ((b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a) || b === 0x27 || b === 0x22 || b === 0x2a) {
      const opStart = pos;
      while (pos < len && (isAlpha(content[pos]!) || content[pos] === 0x27 || content[pos] === 0x22 || content[pos] === 0x2a)) pos++;
      const op = new TextDecoder("ascii").decode(content.subarray(opStart, pos));
      switch (op) {
        case "BT": inTextBlock = true; break;
        case "ET":
          inTextBlock = false;
          if (currentLine !== "") {
            lines.push(currentLine);
            currentLine = "";
          }
          break;
        case "Tj":
        case "'":
        case "\"":
          // Last operand was a string — already added. Move to next line for ' and ".
          if (op === "'" || op === "\"") {
            if (currentLine !== "") {
              lines.push(currentLine);
              currentLine = "";
            }
          }
          break;
        case "TJ":
          // Last operand was an array — already concatenated.
          break;
        case "Td":
        case "TD":
        case "T*":
        case "Tm":
          // Text positioning — start a new line if we have content.
          if (currentLine !== "") {
            lines.push(currentLine);
            currentLine = "";
          }
          break;
        default:
          // Unknown operator — ignore.
          break;
      }
      continue;
    }
    // Unknown byte — skip
    pos++;
  }
  if (currentLine !== "") {
    lines.push(currentLine);
  }
  return lines;
}

function parseTjArray(content: Uint8Array, start: number, inTextBlock: boolean): [string, number] {
  let out = "";
  let pos = start;
  const len = content.length;
  while (pos < len) {
    const b = content[pos]!;
    if (b === 0x5d) { pos++; break; } // ']'
    if (b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d) { pos++; continue; }
    if (b === 0x28) {
      const [bytes, newPos] = parseLiteralString(content, pos + 1);
      pos = newPos;
      if (inTextBlock) out += decodePdfString(bytes);
    } else if (b === 0x3c) {
      if (content[pos + 1] === 0x3c) { pos += 2; continue; }
      const [bytes, newPos] = parseHexString(content, pos + 1);
      pos = newPos;
      if (inTextBlock) out += decodePdfString(bytes);
    } else if ((b >= 0x30 && b <= 0x39) || b === 0x2b || b === 0x2d || b === 0x2e) {
      pos = skipNumber(content, pos);
      // Numeric operand in TJ = horizontal shift; ignore.
    } else {
      pos++;
    }
  }
  return [out, pos];
}

function skipNumber(content: Uint8Array, start: number): number {
  let pos = start;
  while (pos < content.length) {
    const b = content[pos]!;
    if ((b >= 0x30 && b <= 0x39) || b === 0x2b || b === 0x2d || b === 0x2e || b === 0x45 || b === 0x65) {
      pos++;
    } else {
      break;
    }
  }
  return pos;
}

function isAlpha(b: number): boolean {
  return (b >= 0x41 && b <= 0x5a) || (b >= 0x61 && b <= 0x7a);
}

function isDelimiter(b: number): boolean {
  return b === 0x20 || b === 0x09 || b === 0x0a || b === 0x0d || b === 0x28 || b === 0x29 ||
    b === 0x3c || b === 0x3e || b === 0x5b || b === 0x5d || b === 0x7b || b === 0x7d ||
    b === 0x2f || b === 0x25;
}

// ===== Top-level extraction =====

export async function extractPdfText(
  pdfBytes: Uint8Array,
  opts: ConvertOptions = DEFAULT_OPTIONS,
): Promise<ToolResult<PdfTextResult>> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  } catch {
    return { ok: false, error: "Could not load PDF — it may be corrupted or password-protected." };
  }
  const totalPages = doc.getPageCount();
  if (totalPages === 0) {
    return { ok: false, error: "The PDF has no pages." };
  }
  const pageIndices = parsePageRange(opts.pageRange, totalPages);
  const indices = pageIndices ?? Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: PageText[] = [];
  let totalWordCount = 0;
  let totalCharCount = 0;
  let totalLineCount = 0;
  for (const pageNum of indices) {
    const pageIndex = pageNum - 1;
    let allText: string[] = [];
    try {
      const streams = await getPageContentBytes(doc, pageIndex);
      for (const stream of streams) {
        try {
          // Most PDF content streams are FlateDecode-compressed.
          // Try inflating; if it fails, treat as raw.
          let content: Uint8Array;
          try {
            content = await inflateRawDeflate(stream);
          } catch {
            content = stream;
          }
          const lines = extractTextFromContentStream(content);
          allText = allText.concat(lines);
        } catch {
          // Skip this stream.
        }
      }
    } catch {
      // Page extraction failed — continue.
    }
    // Apply post-processing
    let text = allText.join("\n");
    if (opts.trimLines) {
      text = text.split("\n").map((l) => l.trim()).join("\n");
    }
    if (opts.removeEmptyLines) {
      text = text.split("\n").filter((l) => l !== "").join("\n");
    }
    if (opts.lineNumbers) {
      text = text.split("\n").map((l, i) => `${i + 1}: ${l}`).join("\n");
    }
    const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
    const charCount = text.length;
    const lineCount = text === "" ? 0 : text.split("\n").length;
    pages.push({
      pageNumber: pageNum,
      text,
      lineCount,
      wordCount,
      charCount,
    });
    totalWordCount += wordCount;
    totalCharCount += charCount;
    totalLineCount += lineCount;
  }
  return {
    ok: true,
    output: {
      pages,
      pageCount: pages.length,
      totalWordCount,
      totalCharCount,
      totalLineCount,
    },
  };
}

// ===== Output formatting =====

export function formatAsPlainText(result: PdfTextResult, opts: ConvertOptions): string {
  const parts: string[] = [];
  for (let i = 0; i < result.pages.length; i++) {
    if (i > 0 && opts.pageSeparator) parts.push(opts.pageSeparator);
    parts.push(result.pages[i]!.text);
  }
  const text = parts.join(opts.lineSeparator);
  if (opts.addBom) {
    return "\uFEFF" + text;
  }
  return text;
}

// ===== Stats =====

export interface ExtractStats {
  pageCount: number;
  wordCount: number;
  charCount: number;
  lineCount: number;
}

export function computeStats(result: PdfTextResult): ExtractStats {
  return {
    pageCount: result.pageCount,
    wordCount: result.totalWordCount,
    charCount: result.totalCharCount,
    lineCount: result.totalLineCount,
  };
}

// ===== Utilities =====

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ===== History =====

const HISTORY_KEY = "unqtools-pdf-to-text-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  pdfBytes: number;
  pageCount: number;
  wordCount: number;
  extractedAt: string;
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

export function buildShareUrl(opts: ConvertOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  if (opts.pageRange) params.set("pages", opts.pageRange);
  params.set("trim", String(opts.trimLines));
  params.set("empty", String(opts.removeEmptyLines));
  params.set("ln", String(opts.lineNumbers));
  params.set("bom", String(opts.addBom));
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ConvertOptions> | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("pages") && !params.has("trim")) return null;
  return {
    pageRange: params.get("pages") ?? "",
    trimLines: params.get("trim") !== "false",
    removeEmptyLines: params.get("empty") === "true",
    lineNumbers: params.get("ln") === "true",
    addBom: params.get("bom") === "true",
  };
}

// Re-export PDFOperator so it isn't dropped from the type-checker's view.
export type { PDFOperator };
