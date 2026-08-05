/**
 * PDF to DjVu Converter — pure-JS simplified DjVu text-format generator.
 *
 * HONEST DISCLOSURE: This is a SIMPLIFIED text-only DjVu. It does NOT contain
 * wavelet-compressed images of the PDF pages. The output is NOT readable by
 * standard DjVu viewers (DjView, Okular, WinDjView). It is a binary archive
 * of the PDF's text content, structured as a series of text chunks with
 * page break markers. See the tool FAQ for why.
 *
 * Simplified structure:
 *   1. Header (64 bytes):
 *        - Magic: "AT&T DjVu Simplified\n\0" (24 bytes)
 *        - Version (4 bytes BE)
 *        - Page count (4 bytes BE)
 *        - Metadata offset (4 bytes BE)
 *        - Text chunk offset (4 bytes BE)
 *        - Total file size (4 bytes BE)
 *        - Compression method: 'STOR' or 'TEXT' (8 bytes ASCII)
 *        - Reserved (16 bytes, all zero)
 *   2. Metadata chunk:
 *        - 'META' (4 bytes)
 *        - Length (4 bytes BE)
 *        - JSON metadata: {title, author, language, createdAt}
 *   3. Per-page text chunks:
 *        - 'TEXT' (4 bytes)
 *        - Page number (4 bytes BE)
 *        - Length (4 bytes BE)
 *        - UTF-8 text content
 *   4. End marker:
 *        - 'ENDS' (4 bytes)
 */

import {
  extractPdfText,
  formatBytes,
  type ConvertOptions as TextOptions,
} from "../pdf-to-text-converter/logic";
import {
  writeU16BE, writeU32BE, writeAscii, readAscii,
} from "../pdf-to-mobi-converter/logic";
import type { ToolResult } from "../../../lib/tool";

// Re-export helpers
export { writeU16BE, writeU32BE, writeAscii, readAscii };

// ===== Types =====

export type DjvuEncoding = "utf-8" | "latin-1";

export interface DjvuOptions {
  /** Page range (e.g. "1-3,5"). Empty = all pages. */
  pageRange: string;
  /** Custom document title. */
  title: string;
  /** Custom document author. */
  author: string;
  /** Text encoding. */
  encoding: DjvuEncoding;
  /** Language code. */
  language: string;
  /** Insert page-break markers between PDF pages. */
  insertPageBreaks: boolean;
}

export const DEFAULT_OPTIONS: DjvuOptions = {
  pageRange: "",
  title: "Converted from PDF",
  author: "UnQTools",
  encoding: "utf-8",
  language: "en",
  insertPageBreaks: true,
};

export interface DjvuResult {
  blob: Blob;
  fileName: string;
  pageCount: number;
  wordCount: number;
  charCount: number;
  djvuBytes: number;
}

// ===== Constants =====

const DJVU_MAGIC = "AT&T DjVu Simplified";
const DJVU_VERSION = 1;
const HEADER_SIZE = 64;
const COMPRESSION_METHOD = "STOR";

// ===== Header generation =====

/** Generate the 64-byte DjVu header. */
export function generateHeader(pageCount: number, metadataOffset: number, textOffset: number, totalSize: number): Uint8Array {
  const bytes = new Uint8Array(HEADER_SIZE);
  // Magic (24 bytes including null terminator and newline)
  const magic = DJVU_MAGIC + "\n";
  for (let i = 0; i < magic.length && i < 24; i++) {
    bytes[i] = magic.charCodeAt(i);
  }
  // Version (4 bytes BE)
  writeU32BE(bytes, 24, DJVU_VERSION);
  // Page count (4 bytes BE)
  writeU32BE(bytes, 28, pageCount);
  // Metadata offset (4 bytes BE)
  writeU32BE(bytes, 32, metadataOffset);
  // Text chunk offset (4 bytes BE)
  writeU32BE(bytes, 36, textOffset);
  // Total file size (4 bytes BE)
  writeU32BE(bytes, 40, totalSize);
  // Compression method (8 bytes ASCII)
  writeAscii(bytes, 44, COMPRESSION_METHOD);
  // Reserved (16 bytes, all zero) — already zero
  return bytes;
}

// ===== Metadata chunk =====

/** Generate the META chunk (4-byte type + 4-byte length + JSON content). */
export function generateMetaChunk(opts: DjvuOptions): Uint8Array {
  const meta = {
    title: opts.title,
    author: opts.author,
    language: opts.language,
    encoding: opts.encoding,
    createdAt: new Date().toISOString(),
  };
  const enc = new TextEncoder();
  const jsonBytes = enc.encode(JSON.stringify(meta));
  const chunk = new Uint8Array(8 + jsonBytes.length);
  writeAscii(chunk, 0, "META");
  writeU32BE(chunk, 4, jsonBytes.length);
  chunk.set(jsonBytes, 8);
  return chunk;
}

// ===== Text chunk =====

/** Generate a TEXT chunk for one page. */
export function generateTextChunk(pageNumber: number, text: string, encoding: DjvuEncoding): Uint8Array {
  const encoder = encoding === "utf-8" ? new TextEncoder() : new Latin1Encoder();
  const textBytes = encoder.encode(text);
  const chunk = new Uint8Array(12 + textBytes.length);
  writeAscii(chunk, 0, "TEXT");
  writeU32BE(chunk, 4, pageNumber);
  writeU32BE(chunk, 8, textBytes.length);
  chunk.set(textBytes, 12);
  return chunk;
}

/** Generate a page-break marker chunk (4 bytes). */
export function generatePageBreakChunk(): Uint8Array {
  const chunk = new Uint8Array(4);
  writeAscii(chunk, 0, "PGBR");
  return chunk;
}

/** Generate the end marker (4 bytes). */
export function generateEndChunk(): Uint8Array {
  const chunk = new Uint8Array(4);
  writeAscii(chunk, 0, "ENDS");
  return chunk;
}

// ===== Latin-1 encoder (fallback for non-UTF-8) =====

class Latin1Encoder {
  encode(str: string): Uint8Array {
    const out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
    return out;
  }
}

// ===== Top-level assembly =====

/** Assemble the full simplified DjVu file. */
export function assembleDjvu(pageTexts: string[], opts: DjvuOptions): Uint8Array {
  const metaChunk = generateMetaChunk(opts);
  // Build text chunks
  const textChunks: Uint8Array[] = [];
  for (let i = 0; i < pageTexts.length; i++) {
    const text = pageTexts[i] ?? "";
    if (text.trim() === "") continue;
    textChunks.push(generateTextChunk(i + 1, text, opts.encoding));
    if (opts.insertPageBreaks && i < pageTexts.length - 1) {
      textChunks.push(generatePageBreakChunk());
    }
  }
  const endChunk = generateEndChunk();
  // Compute offsets
  const metadataOffset = HEADER_SIZE;
  const textOffset = metadataOffset + metaChunk.length;
  const totalSize = textOffset + textChunks.reduce((s, c) => s + c.length, 0) + endChunk.length;
  // Build the file
  const out = new Uint8Array(totalSize);
  const header = generateHeader(pageTexts.length, metadataOffset, textOffset, totalSize);
  out.set(header, 0);
  out.set(metaChunk, metadataOffset);
  let pos = textOffset;
  for (const chunk of textChunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  out.set(endChunk, pos);
  return out;
}

// ===== Top-level conversion =====

export async function convertPdfToDjvu(
  pdfBytes: Uint8Array,
  opts: DjvuOptions = DEFAULT_OPTIONS,
  outputFileName: string = "converted.djvu",
): Promise<ToolResult<DjvuResult>> {
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
  const pageTexts = textResult.output.pages.map((p) => p.text);
  if (pageTexts.every((p) => p.trim() === "")) {
    return { ok: false, error: "No text content found in the PDF." };
  }
  const djvuBytes = assembleDjvu(pageTexts, opts);
  const blob = new Blob([djvuBytes as BlobPart], { type: "image/vnd.djvu" });
  return {
    ok: true,
    output: {
      blob,
      fileName: outputFileName,
      pageCount: textResult.output.pageCount,
      wordCount: textResult.output.totalWordCount,
      charCount: textResult.output.totalCharCount,
      djvuBytes: djvuBytes.length,
    },
  };
}

// ===== Hex viewer =====

/** Convert bytes to a hex-dump string (offset + hex + ASCII). */
export function hexDump(bytes: Uint8Array, maxBytes: number = 512): string {
  const limit = Math.min(bytes.length, maxBytes);
  const lines: string[] = [];
  for (let i = 0; i < limit; i += 16) {
    const offset = i.toString(16).padStart(8, "0");
    let hex = "";
    let ascii = "";
    for (let j = 0; j < 16; j++) {
      if (i + j < limit) {
        const b = bytes[i + j]!;
        hex += b.toString(16).padStart(2, "0") + " ";
        ascii += b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".";
      } else {
        hex += "   ";
        ascii += " ";
      }
    }
    lines.push(`${offset}  ${hex} |${ascii}|`);
  }
  if (bytes.length > maxBytes) {
    lines.push(`...(truncated, ${bytes.length} bytes total)`);
  }
  return lines.join("\n");
}

// ===== Utilities =====

export { formatBytes };

// ===== History =====

const HISTORY_KEY = "unqtools-pdf-to-djvu-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  pdfBytes: number;
  djvuBytes: number;
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

export function buildShareUrl(opts: DjvuOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  if (opts.pageRange) params.set("pages", opts.pageRange);
  params.set("enc", opts.encoding);
  params.set("lang", opts.language);
  params.set("pb", String(opts.insertPageBreaks));
  if (opts.title && opts.title !== DEFAULT_OPTIONS.title) params.set("title", opts.title);
  if (opts.author && opts.author !== DEFAULT_OPTIONS.author) params.set("author", opts.author);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<DjvuOptions> | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("enc") && !params.has("pages")) return null;
  const enc = (params.get("enc") ?? "utf-8") as DjvuEncoding;
  const validEncs: DjvuEncoding[] = ["utf-8", "latin-1"];
  return {
    pageRange: params.get("pages") ?? "",
    encoding: validEncs.includes(enc) ? enc : "utf-8",
    language: params.get("lang") ?? "en",
    insertPageBreaks: params.get("pb") !== "false",
    title: params.get("title") ?? "",
    author: params.get("author") ?? "",
  };
}
