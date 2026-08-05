/**
 * TCR to EPUB Converter — pure-JS TCR (Psion) parser + EPUB generator.
 *
 * TCR format:
 *   - 8-byte magic: "PCF\0\0\0\0\0" (PCF + 5 zeros)
 *   - 256 dictionary entries: each is preceded by a 1-byte length, then
 *     that many bytes. Each entry is 1-2 bytes long.
 *   - Compressed text stream: each byte indexes into the dictionary to
 *     produce the corresponding entry's bytes.
 *   - The decompressed bytes are the raw text (typically CP1252 or UTF-8).
 *
 * Pipeline:
 *   1. Read magic.
 *   2. Read 256 dictionary entries.
 *   3. Decode each byte in the compressed stream using the dictionary.
 *   4. Decode the resulting bytes as UTF-8 (or CP1252 fallback).
 *   5. Split into chapters by heading detection.
 *   6. Generate EPUB structure (reuse from pdf-to-epub-converter).
 *   7. Package everything into a ZIP.
 */

import {
  splitIntoChapters, generateMimetype, generateContainerXml,
  generateContentOpf, generateNcx, generateNav,
  generateChapterXhtml, generateStylesheet,
  generateUuid,
  type Chapter, type ChapterMode,
} from "../pdf-to-epub-converter/logic";
import {
  createZipBlob, xmlEscape, xmlAttrEscape, type ZipFile,
} from "../csv-to-excel-converter/logic";
import type { ToolResult } from "../../../lib/tool";

// ===== Types =====

export interface TcrDictionary {
  entries: Uint8Array[];  // 256 entries, each 1-2 bytes
}

export interface TcrMetadata {
  title: string;
  author: string;
  language: string;
}

export interface TcrStats {
  compressedBytes: number;
  decompressedBytes: number;
  compressionRatio: number;
  chapterCount: number;
  wordCount: number;
  charCount: number;
  epubBytes: number;
}

export interface TcrConvertOptions {
  title: string;
  author: string;
  language: string;
  chapterMode: ChapterMode;
  fontSize: number;
  customCss: string;
}

export const DEFAULT_OPTIONS: TcrConvertOptions = {
  title: "Converted from TCR",
  author: "Unknown",
  language: "en",
  chapterMode: "heading",
  fontSize: 16,
  customCss: "",
};

export interface TcrConvertResult {
  blob: Blob;
  fileName: string;
  metadata: TcrMetadata;
  chapters: Chapter[];
  stats: TcrStats;
}

// ===== Constants =====

export const TCR_MAGIC = "PCF";
export const TCR_HEADER_SIZE = 8;
export const TCR_DICT_ENTRY_COUNT = 256;

// ===== Byte readers =====

function readU8(bytes: Uint8Array, offset: number): number {
  return bytes[offset] ?? 0;
}

function readString(bytes: Uint8Array, offset: number, length: number): string {
  return Array.from(bytes.subarray(offset, offset + length))
    .map((b) => String.fromCharCode(b))
    .join("");
}

// ===== Validation =====

/** Check if bytes start with the PCF magic. */
export function isTcrFile(bytes: Uint8Array): boolean {
  if (bytes.length < TCR_HEADER_SIZE) return false;
  return readString(bytes, 0, 3) === TCR_MAGIC;
}

// ===== Dictionary parsing =====

/** Parse the 256-entry dictionary. Returns the dictionary and the offset where the compressed stream begins. */
export function parseDictionary(bytes: Uint8Array, baseOffset: number = TCR_HEADER_SIZE): { dictionary: TcrDictionary; streamOffset: number } {
  const entries: Uint8Array[] = [];
  let offset = baseOffset;
  for (let i = 0; i < TCR_DICT_ENTRY_COUNT; i++) {
    if (offset + 1 > bytes.length) {
      throw new Error(`TCR dictionary truncated at entry ${i} (offset ${offset}).`);
    }
    const len = readU8(bytes, offset);
    offset += 1;
    if (len === 0 || len > 2) {
      // TCR dictionary entries are 1 or 2 bytes. We allow up to 2 bytes per the spec.
      // Length 0 is invalid; length > 2 is a corrupted dictionary.
      throw new Error(`TCR dictionary entry ${i} has invalid length ${len}.`);
    }
    if (offset + len > bytes.length) {
      throw new Error(`TCR dictionary entry ${i} data truncated (need ${len} bytes at offset ${offset}).`);
    }
    entries.push(bytes.subarray(offset, offset + len));
    offset += len;
  }
  return { dictionary: { entries }, streamOffset: offset };
}

/** Build a default identity dictionary (each byte maps to itself). Useful for tests. */
export function buildIdentityDictionary(): TcrDictionary {
  const entries: Uint8Array[] = [];
  for (let i = 0; i < 256; i++) {
    entries.push(new Uint8Array([i]));
  }
  return { entries };
}

// ===== Decompression =====

/** Decompress the TCR stream using the dictionary. */
export function decompressStream(compressed: Uint8Array, dictionary: TcrDictionary): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < compressed.length; i++) {
    const entry = dictionary.entries[compressed[i]!];
    if (!entry) {
      throw new Error(`Invalid byte ${compressed[i]} at offset ${i} — no dictionary entry.`);
    }
    for (let j = 0; j < entry.length; j++) {
      out.push(entry[j]!);
    }
  }
  return new Uint8Array(out);
}

// ===== Top-level parsing =====

export interface TcrBook {
  dictionary: TcrDictionary;
  compressedBytes: Uint8Array;
  decompressedBytes: Uint8Array;
  text: string;
}

/** Parse a TCR file into a structured book object. */
export function parseTcr(bytes: Uint8Array): TcrBook {
  if (!isTcrFile(bytes)) {
    throw new Error(`Not a valid TCR file: missing "${TCR_MAGIC}" magic.`);
  }
  const { dictionary, streamOffset } = parseDictionary(bytes, TCR_HEADER_SIZE);
  const compressed = bytes.subarray(streamOffset);
  const decompressed = decompressStream(compressed, dictionary);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(decompressed);
  } catch {
    text = new TextDecoder("windows-1252").decode(decompressed);
  }
  return { dictionary, compressedBytes: compressed, decompressedBytes: decompressed, text };
}

// ===== Stats =====

export function computeStats(
  compressedBytes: number,
  decompressedBytes: number,
  chapters: Chapter[],
  epubBytes: number,
): TcrStats {
  const compressionRatio = decompressedBytes > 0 ? compressedBytes / decompressedBytes : 0;
  const wordCount = chapters.reduce((s, c) => s + c.wordCount, 0);
  const charCount = chapters.reduce((s, c) => s + c.charCount, 0);
  return {
    compressedBytes,
    decompressedBytes,
    compressionRatio,
    chapterCount: chapters.length,
    wordCount,
    charCount,
    epubBytes,
  };
}

// ===== EPUB generation (reuse from pdf-to-epub-converter) =====

export interface EpubOptionsAdapter {
  title: string;
  author: string;
  language: string;
  fontSize: number;
  customCss: string;
}

/** Build an EPUB Blob from text + options. */
export function generateEpub(text: string, opts: EpubOptionsAdapter): { blob: Blob; chapters: Chapter[]; bookId: string } {
  const pageTexts = [text];
  const chapters = splitIntoChapters(pageTexts, "heading");
  const epubOpts = {
    pageRange: "",
    chapterMode: "heading" as ChapterMode,
    title: opts.title,
    author: opts.author,
    fontSize: opts.fontSize,
    customCss: opts.customCss,
    language: opts.language,
  };
  const bookId = `urn:uuid:${generateUuid()}`;
  const enc = new TextEncoder();
  const files: ZipFile[] = [];
  files.push({ name: "mimetype", data: enc.encode(generateMimetype()) });
  files.push({ name: "META-INF/container.xml", data: enc.encode(generateContainerXml()) });
  files.push({ name: "OEBPS/content.opf", data: enc.encode(generateContentOpf(epubOpts, chapters, bookId)) });
  files.push({ name: "OEBPS/toc.ncx", data: enc.encode(generateNcx(epubOpts, chapters, bookId)) });
  files.push({ name: "OEBPS/nav.xhtml", data: enc.encode(generateNav(epubOpts, chapters)) });
  files.push({ name: "OEBPS/style.css", data: enc.encode(generateStylesheet(epubOpts)) });
  for (const ch of chapters) {
    files.push({ name: `OEBPS/chapter${ch.number}.xhtml`, data: enc.encode(generateChapterXhtml(ch, epubOpts)) });
  }
  void xmlEscape;
  void xmlAttrEscape;
  return { blob: createZipBlob(files), chapters, bookId };
}

// ===== Top-level conversion =====

export async function convertTcrToEpub(
  bytes: Uint8Array,
  opts: TcrConvertOptions = DEFAULT_OPTIONS,
  outputFileName: string = "converted.epub",
): Promise<ToolResult<TcrConvertResult>> {
  if (!isTcrFile(bytes)) {
    return { ok: false, error: `Not a valid TCR file: missing "${TCR_MAGIC}" magic.` };
  }
  let book: TcrBook;
  try {
    book = parseTcr(bytes);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (!book.text || book.text.trim() === "") {
    return { ok: false, error: "No text content found in the TCR file (decompressed stream is empty)." };
  }
  const { blob, chapters } = generateEpub(book.text, opts);
  const stats = computeStats(
    book.compressedBytes.length,
    book.decompressedBytes.length,
    chapters,
    blob.size,
  );
  return {
    ok: true,
    output: {
      blob,
      fileName: outputFileName,
      metadata: { title: opts.title, author: opts.author, language: opts.language },
      chapters,
      stats,
    },
  };
}

// ===== Utilities =====

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatRatio(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// ===== History (localStorage) =====

const HISTORY_KEY = "unqtools-tcr-to-epub-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  tcrBytes: number;
  epubBytes: number;
  chapterCount: number;
  wordCount: number;
  compressionRatio: number;
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

export function buildShareUrl(opts: TcrConvertOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("mode", opts.chapterMode);
  if (opts.title && opts.title !== DEFAULT_OPTIONS.title) params.set("title", opts.title);
  if (opts.author && opts.author !== DEFAULT_OPTIONS.author) params.set("author", opts.author);
  params.set("fs", String(opts.fontSize));
  params.set("lang", opts.language);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<TcrConvertOptions> | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("mode") && !params.has("fs")) return null;
  const mode = (params.get("mode") ?? "heading") as ChapterMode;
  const validModes: ChapterMode[] = ["page", "heading", "single"];
  const fs = parseInt(params.get("fs") ?? "16", 10);
  return {
    chapterMode: validModes.includes(mode) ? mode : "heading",
    title: params.get("title") ?? "",
    author: params.get("author") ?? "",
    fontSize: isNaN(fs) ? 16 : Math.max(10, Math.min(36, fs)),
    language: params.get("lang") ?? "en",
  };
}
