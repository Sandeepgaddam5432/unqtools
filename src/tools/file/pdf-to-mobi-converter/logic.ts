/**
 * PDF to MOBI Converter — pure-JS MOBI (PalmDB + PalmDOC + MOBI header) generator.
 *
 * MOBI structure:
 *   1. PalmDB header (78 bytes):
 *        - name (32 bytes, null-padded)
 *        - attributes (2 bytes BE)
 *        - version (2 bytes BE)
 *        - created, modified, backup, modnum (4 bytes each BE)
 *        - appInfoOffset, sortInfoOffset (4 bytes each BE)
 *        - type (4 bytes BE) — 'BOOK' = 0x424f4f4b
 *        - creator (4 bytes BE) — 'MOBI' = 0x4d4f4249
 *        - uniqueIDSeed (4 bytes BE)
 *        - nextRecordListId (4 bytes BE)
 *        - recordCount (2 bytes BE)
 *   2. Record info table (recordCount × 8 bytes):
 *        - offset (4 bytes BE)
 *        - attributes (1 byte)
 *        - uniqueID (3 bytes BE)
 *   3. Padding (2 bytes)
 *   4. Records (concatenated):
 *        - Record 0: PalmDOC header (16 bytes) + MOBI header (232 bytes) + EXTH
 *        - Records 1..N: text records (max 4096 bytes each)
 *
 * We generate uncompressed (compression=1=none) records containing HTML.
 */

import {
  extractPdfText,
  formatBytes,
  type ConvertOptions as TextOptions,
} from "../pdf-to-text-converter/logic";
import type { ToolResult } from "../../../lib/tool";

// ===== Types =====

export type MobiEncoding = "cp1252" | "utf-8";
export type MobiChapterMode = "page" | "heading" | "single";

export interface MobiOptions {
  /** Page range (e.g. "1-3,5"). Empty = all pages. */
  pageRange: string;
  /** Book title. */
  title: string;
  /** Book author. */
  author: string;
  /** Text encoding. */
  encoding: MobiEncoding;
  /** Chapter splitting mode. */
  chapterMode: MobiChapterMode;
  /** Language code (e.g. "en", "fr"). */
  language: string;
}

export const DEFAULT_OPTIONS: MobiOptions = {
  pageRange: "",
  title: "Converted from PDF",
  author: "UnQTools",
  encoding: "utf-8",
  chapterMode: "page",
  language: "en",
};

export interface MobiResult {
  blob: Blob;
  fileName: string;
  recordCount: number;
  textRecordCount: number;
  wordCount: number;
  charCount: number;
  pageCount: number;
  mobiBytes: number;
}

// ===== Constants =====

const TEXT_RECORD_SIZE = 4096;
const PALMDB_HEADER_SIZE = 78;
const RECORD_INFO_SIZE = 8;
const PALMDOC_HEADER_SIZE = 16;
const MOBI_HEADER_SIZE = 232;
const EXTH_MIN_SIZE = 12;

// ===== Byte writers =====

/** Write a 16-bit big-endian value to a Uint8Array at the given offset. */
export function writeU16BE(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 8) & 0xff;
  bytes[offset + 1] = value & 0xff;
}

/** Write a 32-bit big-endian value to a Uint8Array at the given offset. */
export function writeU32BE(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

/** Write an ASCII string to a Uint8Array at the given offset. Returns the new offset. */
export function writeAscii(bytes: Uint8Array, offset: number, str: string): number {
  for (let i = 0; i < str.length; i++) {
    bytes[offset + i] = str.charCodeAt(i) & 0xff;
  }
  return offset + str.length;
}

/** Write a null-padded ASCII string to a fixed-size field. */
export function writePaddedAscii(bytes: Uint8Array, offset: number, str: string, length: number): void {
  const safe = str.slice(0, length);
  for (let i = 0; i < length; i++) {
    bytes[offset + i] = i < safe.length ? safe.charCodeAt(i) & 0xff : 0;
  }
}

/** Read a 4-char ASCII string from a Uint8Array at the given offset. */
export function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += String.fromCharCode(bytes[offset + i] ?? 0);
  }
  return out;
}

// ===== HTML escaping =====

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ===== Chapter splitting =====

const HEADING_REGEX = /^(#{1,6}\s+.+|chapter\s+\d+|part\s+\d+|[A-Z][A-Z\s\-:]{4,})$/i;

/** Detect lines that look like headings. */
export function isHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 100) return false;
  if (/^#{1,6}\s+/.test(trimmed)) return true;
  if (/^chapter\s+\d+/i.test(trimmed)) return true;
  if (/^part\s+\d+/i.test(trimmed)) return true;
  if (trimmed.length >= 5 && /^[A-Z0-9\s\-:,.!?']+$/.test(trimmed) && /[A-Z]/.test(trimmed) && !/^[0-9\s]+$/.test(trimmed)) return true;
  return false;
}

/** Build the HTML body for the MOBI file from PDF page texts. */
export function buildHtmlBody(pageTexts: string[], opts: MobiOptions): string {
  const parts: string[] = [];
  if (opts.chapterMode === "single") {
    const allText = pageTexts.join("\n");
    parts.push(buildParagraphs(allText));
    return parts.join("\n");
  }
  if (opts.chapterMode === "heading") {
    let currentTitle = "Introduction";
    let currentParas: string[] = [];
    const flush = () => {
      if (currentParas.length === 0) return;
      parts.push(`<h1>${escapeHtml(currentTitle)}</h1>`);
      parts.push(currentParas.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n"));
      parts.push("<mbp:pagebreak/>");
      currentParas = [];
    };
    for (const pageText of pageTexts) {
      for (const line of pageText.split("\n")) {
        const trimmed = line.trim();
        if (trimmed === "") continue;
        if (isHeading(trimmed)) {
          flush();
          currentTitle = trimmed.replace(/^#{1,6}\s+/, "");
        } else {
          currentParas.push(trimmed);
        }
      }
    }
    flush();
    return parts.join("\n");
  }
  // page mode — each PDF page is a chapter
  for (let i = 0; i < pageTexts.length; i++) {
    const text = pageTexts[i] ?? "";
    if (text.trim() === "") continue;
    const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l !== "") ?? `Page ${i + 1}`;
    const title = firstLine.length <= 80 ? firstLine : `Page ${i + 1}`;
    parts.push(`<h1>${escapeHtml(title)}</h1>`);
    parts.push(buildParagraphs(text));
    parts.push("<mbp:pagebreak/>");
  }
  return parts.join("\n");
}

/** Convert plain text into HTML paragraphs (one <p> per non-empty line). */
export function buildParagraphs(text: string): string {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "")
    .map((l) => `<p>${escapeHtml(l)}</p>`)
    .join("\n");
}

// ===== Text record splitting =====

/** Split the HTML body into text records of max TEXT_RECORD_SIZE bytes. */
export function splitTextRecords(html: string, encoding: MobiEncoding): Uint8Array[] {
  const encoder = encoding === "utf-8" ? new TextEncoder() : new Cp1252Encoder();
  const allBytes = encoder.encode(html);
  const records: Uint8Array[] = [];
  for (let i = 0; i < allBytes.length; i += TEXT_RECORD_SIZE) {
    const end = Math.min(i + TEXT_RECORD_SIZE, allBytes.length);
    records.push(allBytes.subarray(i, end));
  }
  if (records.length === 0) records.push(new Uint8Array(0));
  return records;
}

// ===== CP1252 encoder (minimal — uses Latin-1 fallback for unmapped chars) =====

class Cp1252Encoder {
  encode(str: string): Uint8Array {
    const out = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      // CP1252 maps 0x80-0x9F to specific chars. For our purposes, use Latin-1 fallback.
      out[i] = code & 0xff;
    }
    return out;
  }
}

// ===== PalmDB header =====

/** Generate the 78-byte PalmDB header. */
export function generatePalmDbHeader(name: string, recordCount: number): Uint8Array {
  const bytes = new Uint8Array(PALMDB_HEADER_SIZE);
  // Name (32 bytes, null-padded)
  writePaddedAscii(bytes, 0, name, 32);
  // Attributes (2 bytes) — 0
  writeU16BE(bytes, 32, 0);
  // Version (2 bytes) — 0
  writeU16BE(bytes, 34, 0);
  // Created, Modified, Backup, Modnum (4 bytes each) — current time
  const now = Math.floor(Date.now() / 1000);
  // Mac epoch (1904) — PalmDB uses seconds since 1904-01-01
  const macEpochOffset = 2082844800; // seconds between 1904-01-01 and 1970-01-01
  const palmTime = now + macEpochOffset;
  writeU32BE(bytes, 36, palmTime);
  writeU32BE(bytes, 40, palmTime);
  writeU32BE(bytes, 44, palmTime);
  writeU32BE(bytes, 48, 0); // modnum
  // appInfoOffset (4 bytes) — 0
  writeU32BE(bytes, 52, 0);
  // sortInfoOffset (4 bytes) — 0
  writeU32BE(bytes, 56, 0);
  // Type (4 bytes) — 'BOOK'
  writeAscii(bytes, 60, "BOOK");
  // Creator (4 bytes) — 'MOBI'
  writeAscii(bytes, 64, "MOBI");
  // uniqueIDSeed (4 bytes) — recordCount + 1
  writeU32BE(bytes, 68, recordCount + 1);
  // nextRecordListId (4 bytes) — 0
  writeU32BE(bytes, 72, 0);
  // recordCount (2 bytes)
  writeU16BE(bytes, 76, recordCount);
  return bytes;
}

// ===== Record info table =====

/** Generate the record info table — 8 bytes per record. */
export function generateRecordInfoTable(recordOffsets: Array<{ offset: number; uniqueId: number }>): Uint8Array {
  const bytes = new Uint8Array(recordOffsets.length * RECORD_INFO_SIZE);
  for (let i = 0; i < recordOffsets.length; i++) {
    const info = recordOffsets[i]!;
    const baseOffset = i * RECORD_INFO_SIZE;
    writeU32BE(bytes, baseOffset, info.offset);
    bytes[baseOffset + 4] = 0; // attributes
    bytes[baseOffset + 5] = (info.uniqueId >>> 16) & 0xff;
    bytes[baseOffset + 6] = (info.uniqueId >>> 8) & 0xff;
    bytes[baseOffset + 7] = info.uniqueId & 0xff;
  }
  return bytes;
}

// ===== PalmDOC header =====

/** Generate the 16-byte PalmDOC header. */
export function generatePalmDocHeader(textLength: number, textRecordCount: number, encryption: number = 0): Uint8Array {
  const bytes = new Uint8Array(PALMDOC_HEADER_SIZE);
  writeU16BE(bytes, 0, 1); // compression: 1 = none
  writeU16BE(bytes, 2, 0); // unused
  writeU32BE(bytes, 4, textLength);
  writeU16BE(bytes, 8, textRecordCount);
  writeU16BE(bytes, 10, TEXT_RECORD_SIZE);
  writeU16BE(bytes, 12, encryption);
  return bytes;
}

// ===== MOBI header =====

/** Generate the MOBI header (232 bytes minimum). */
export function generateMobiHeader(opts: MobiOptions, textLength: number, textRecordCount: number): Uint8Array {
  const bytes = new Uint8Array(MOBI_HEADER_SIZE);
  // Identifier (4 bytes) — 'MOBI'
  writeAscii(bytes, 0, "MOBI");
  // Header length (4 bytes) — 232
  writeU32BE(bytes, 4, MOBI_HEADER_SIZE);
  // MOBI type (4 bytes) — 2 = MOBI Book
  writeU32BE(bytes, 8, 2);
  // Text encoding (4 bytes) — 1252 = CP1252, 65001 = UTF-8
  writeU32BE(bytes, 12, opts.encoding === "utf-8" ? 65001 : 1252);
  // Unique ID (4 bytes) — random
  writeU32BE(bytes, 16, Math.floor(Math.random() * 0xffffffff));
  // File version (4 bytes) — 6
  writeU32BE(bytes, 20, 6);
  // Index — alphabetical (4 bytes) — 0xFFFFFFFF (no index)
  writeU32BE(bytes, 24, 0xffffffff);
  // Index — next record (4 bytes) — 0xFFFFFFFF
  writeU32BE(bytes, 28, 0xffffffff);
  // Index — next record (4 bytes) — 0xFFFFFFFF
  writeU32BE(bytes, 32, 0xffffffff);
  // First image record (4 bytes) — textRecordCount + 1
  writeU32BE(bytes, 36, textRecordCount + 1);
  // First Huffman record (4 bytes) — 0
  writeU32BE(bytes, 40, 0);
  // Remaining fields — 0 (padding)
  // ... most fields stay zero
  return bytes;
}

// ===== EXTH header =====

/** Generate the EXTH (extended metadata) header. */
export function generateExthHeader(opts: MobiOptions): Uint8Array {
  // EXTH records: type 100 = author, 503 = updated title, 524 = language
  const records: Array<{ type: number; data: Uint8Array }> = [];
  const enc = new TextEncoder();
  records.push({ type: 100, data: enc.encode(opts.author) });
  records.push({ type: 503, data: enc.encode(opts.title) });
  records.push({ type: 524, data: enc.encode(opts.language) });
  // Compute total size: 12 (header) + sum(8 + data.length)
  const recordsSize = records.reduce((s, r) => s + 8 + r.data.length, 0);
  const headerSize = 12 + recordsSize;
  const bytes = new Uint8Array(headerSize);
  // Identifier — 'EXTH'
  writeAscii(bytes, 0, "EXTH");
  // Header length (4 bytes)
  writeU32BE(bytes, 4, headerSize);
  // Record count (4 bytes)
  writeU32BE(bytes, 8, records.length);
  // Records
  let offset = 12;
  for (const r of records) {
    writeU32BE(bytes, offset, r.type);
    writeU32BE(bytes, offset + 4, 8 + r.data.length);
    bytes.set(r.data, offset + 8);
    offset += 8 + r.data.length;
  }
  return bytes;
}

// ===== Record 0 assembly =====

/** Assemble record 0 = PalmDOC header + MOBI header + EXTH header. */
export function assembleRecord0(opts: MobiOptions, textLength: number, textRecordCount: number): Uint8Array {
  const palmDoc = generatePalmDocHeader(textLength, textRecordCount);
  const mobi = generateMobiHeader(opts, textLength, textRecordCount);
  const exth = generateExthHeader(opts);
  const out = new Uint8Array(palmDoc.length + mobi.length + exth.length);
  out.set(palmDoc, 0);
  out.set(mobi, palmDoc.length);
  out.set(exth, palmDoc.length + mobi.length);
  return out;
}

// ===== Top-level MOBI assembly =====

/** Assemble the full MOBI file from PDF page texts and options. */
export function assembleMobi(pageTexts: string[], opts: MobiOptions): Uint8Array {
  const html = buildHtmlBody(pageTexts, opts);
  const textRecords = splitTextRecords(html, opts.encoding);
  const encoder = opts.encoding === "utf-8" ? new TextEncoder() : new Cp1252Encoder();
  const textLength = encoder.encode(html).length;
  // Record 0
  const record0 = assembleRecord0(opts, textLength, textRecords.length);
  // All records: record0 + text records
  const allRecords = [record0, ...textRecords];
  const recordCount = allRecords.length;
  // Compute offsets — each record starts after the previous
  const headerTotal = PALMDB_HEADER_SIZE + recordCount * RECORD_INFO_SIZE + 2; // +2 for padding
  const recordOffsets: Array<{ offset: number; uniqueId: number }> = [];
  let offset = headerTotal;
  for (let i = 0; i < allRecords.length; i++) {
    recordOffsets.push({ offset, uniqueId: i });
    offset += allRecords[i]!.length;
  }
  // Build the file
  const totalSize = headerTotal + allRecords.reduce((s, r) => s + r.length, 0);
  const out = new Uint8Array(totalSize);
  // PalmDB header
  const palmDbHeader = generatePalmDbHeader(opts.title, recordCount);
  out.set(palmDbHeader, 0);
  // Record info table
  const recordInfo = generateRecordInfoTable(recordOffsets);
  out.set(recordInfo, PALMDB_HEADER_SIZE);
  // Padding (2 bytes) — already zero
  // Records
  let pos = headerTotal;
  for (const rec of allRecords) {
    out.set(rec, pos);
    pos += rec.length;
  }
  return out;
}

// ===== Top-level conversion =====

export async function convertPdfToMobi(
  pdfBytes: Uint8Array,
  opts: MobiOptions = DEFAULT_OPTIONS,
  outputFileName: string = "converted.mobi",
): Promise<ToolResult<MobiResult>> {
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
  const mobiBytes = assembleMobi(pageTexts, opts);
  const html = buildHtmlBody(pageTexts, opts);
  const encoder = opts.encoding === "utf-8" ? new TextEncoder() : new Cp1252Encoder();
  const textLength = encoder.encode(html).length;
  const textRecordCount = Math.max(1, Math.ceil(textLength / TEXT_RECORD_SIZE));
  const blob = new Blob([mobiBytes as BlobPart], { type: "application/x-mobipocket-ebook" });
  return {
    ok: true,
    output: {
      blob,
      fileName: outputFileName,
      recordCount: textRecordCount + 1, // +1 for record 0
      textRecordCount,
      wordCount: textResult.output.totalWordCount,
      charCount: textResult.output.totalCharCount,
      pageCount: textResult.output.pageCount,
      mobiBytes: mobiBytes.length,
    },
  };
}

// ===== Utilities =====

export { formatBytes };

// ===== History =====

const HISTORY_KEY = "unqtools-pdf-to-mobi-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  pdfBytes: number;
  mobiBytes: number;
  recordCount: number;
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

export function buildShareUrl(opts: MobiOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  if (opts.pageRange) params.set("pages", opts.pageRange);
  params.set("mode", opts.chapterMode);
  params.set("enc", opts.encoding);
  if (opts.title && opts.title !== DEFAULT_OPTIONS.title) params.set("title", opts.title);
  if (opts.author && opts.author !== DEFAULT_OPTIONS.author) params.set("author", opts.author);
  params.set("lang", opts.language);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<MobiOptions> | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("mode") && !params.has("pages")) return null;
  const mode = (params.get("mode") ?? "page") as MobiChapterMode;
  const validModes: MobiChapterMode[] = ["page", "heading", "single"];
  const enc = (params.get("enc") ?? "utf-8") as MobiEncoding;
  const validEncs: MobiEncoding[] = ["cp1252", "utf-8"];
  return {
    pageRange: params.get("pages") ?? "",
    chapterMode: validModes.includes(mode) ? mode : "page",
    encoding: validEncs.includes(enc) ? enc : "utf-8",
    title: params.get("title") ?? "",
    author: params.get("author") ?? "",
    language: params.get("lang") ?? "en",
  };
}
