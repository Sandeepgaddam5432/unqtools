/**
 * PRC to EPUB Converter — reuses the proven MOBI parser (mobi-reader) since
 * PRC and MOBI share the same PalmDB + PalmDOC + MOBI header structure.
 *
 * Differences from MOBI:
 *   - .prc files typically have creator 'TEXt' (PalmDOC) instead of 'MOBI'.
 *   - Some .prc files lack a MOBI header (just PalmDOC).
 *   - Compression is usually PalmDOC RLE (method 1) or none (method 0).
 *
 * Pipeline:
 *   1. Parse PalmDB header + record info table.
 *   2. Extract record 0 (PalmDOC header + optional MOBI header + optional EXTH).
 *   3. Decompress each text record based on the PalmDOC compression method.
 *   4. Decode the concatenated bytes as text (CP1252 or UTF-8).
 *   5. Detect chapters via <h1>/<h2>/<mbp:pagebreak/> tags.
 *   6. Generate EPUB structure (reuse from pdf-to-epub-converter).
 *   7. Package everything into a ZIP.
 */

import {
  parsePalmDbHeader, parseRecordInfoTable, extractRecords,
  parsePalmDocHeader, parseMobiHeader, parseExthHeader,
  decompressTextRecord, decodeText, extractText, splitChapters,
  type PalmDbHeader, type MobiRecord, type PalmDocHeader,
  type MobiHeader, type ExthHeader, type MobiChapter,
} from "../mobi-reader/logic";
import {
  splitIntoChapters as splitIntoEpubChapters,
  generateMimetype, generateContainerXml,
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

export interface PrcMetadata {
  title: string;
  author: string;
  language: string;
  encoding: string;
  compression: string;
}

export interface PrcStats {
  recordCount: number;
  textRecordCount: number;
  chapterCount: number;
  wordCount: number;
  charCount: number;
  epubBytes: number;
}

export interface PrcConvertOptions {
  title: string;
  author: string;
  language: string;
  chapterMode: ChapterMode;
  fontSize: number;
  customCss: string;
}

export const DEFAULT_OPTIONS: PrcConvertOptions = {
  title: "Converted from PRC",
  author: "Unknown",
  language: "en",
  chapterMode: "heading",
  fontSize: 16,
  customCss: "",
};

export interface PrcConvertResult {
  blob: Blob;
  fileName: string;
  metadata: PrcMetadata;
  chapters: Chapter[];
  stats: PrcStats;
  isEncrypted: boolean;
  unsupportedCompression: boolean;
}

// ===== Validation =====

/** Check if bytes look like a PRC/MOBI PalmDB (type=BOOK, creator=TEXt or MOBI). */
export function isPrcFile(bytes: Uint8Array): boolean {
  if (bytes.length < 78) return false;
  try {
    const header = parsePalmDbHeader(bytes);
    if (header.type !== "BOOK") return false;
    return header.creator === "TEXt" || header.creator === "MOBI";
  } catch {
    return false;
  }
}

/** Parse the PRC header (same as PalmDB header). */
export function parsePrcHeader(bytes: Uint8Array): PalmDbHeader {
  return parsePalmDbHeader(bytes);
}

// ===== Top-level parsing =====

export interface PrcBook {
  metadata: PrcMetadata;
  rawText: string;
  mobiChapters: MobiChapter[];
  palmDoc: PalmDocHeader;
  mobiHeader: MobiHeader;
  exth: ExthHeader;
  isEncrypted: boolean;
  unsupportedCompression: boolean;
}

/** Parse a PRC file into a structured book object. */
export function parsePrc(bytes: Uint8Array): PrcBook {
  const palmDb = parsePalmDbHeader(bytes);
  if (palmDb.type !== "BOOK" && palmDb.creator !== "MOBI" && palmDb.creator !== "TEXt") {
    throw new Error(`Not a valid PRC file: type='${palmDb.type}', creator='${palmDb.creator}'.`);
  }
  const recordInfos = parseRecordInfoTable(bytes, palmDb.recordCount, 78);
  const records: MobiRecord[] = extractRecords(bytes, recordInfos);
  if (records.length === 0) {
    throw new Error("PRC file has no records.");
  }
  const record0 = records[0]!.data;
  const palmDoc = parsePalmDocHeader(record0);
  const mobiHeader = parseMobiHeader(record0);
  let exth: ExthHeader = { isPresent: false, records: [], metadata: { author: "", publisher: "", imprint: "", description: "", isbn: "", subject: "", publishingDate: "", review: "", contributor: "", rights: "", language: "" } };
  if (mobiHeader.isMobi) {
    exth = parseExthHeader(record0, mobiHeader.headerLength);
  }
  const isEncrypted = palmDoc.encryptionType !== 0;
  const unsupportedCompression = palmDoc.compression === 2;
  const rawText = isEncrypted || unsupportedCompression
    ? ""
    : extractText(records, palmDoc, mobiHeader);
  const metadata: PrcMetadata = {
    title: palmDb.name || (exth.metadata.author ? palmDb.name : ""),
    author: exth.metadata.author,
    language: exth.metadata.language || (mobiHeader.textEncoding === 65001 ? "en" : ""),
    encoding: mobiHeader.textEncoding === 65001 ? "UTF-8" : "CP1252",
    compression: palmDoc.compression === 0 ? "None" : palmDoc.compression === 1 ? "PalmDOC RLE" : palmDoc.compression === 2 ? "HuffCDic (unsupported)" : "Unknown",
  };
  return {
    metadata,
    rawText,
    mobiChapters: splitChapters(rawText),
    palmDoc,
    mobiHeader,
    exth,
    isEncrypted,
    unsupportedCompression,
  };
}

// ===== Stats =====

export function computeStats(
  palmDoc: PalmDocHeader,
  chapters: Chapter[],
  epubBytes: number,
): PrcStats {
  const wordCount = chapters.reduce((s, c) => s + c.wordCount, 0);
  const charCount = chapters.reduce((s, c) => s + c.charCount, 0);
  return {
    recordCount: palmDoc.textRecordCount,
    textRecordCount: palmDoc.textRecordCount,
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
export function generateEpub(rawText: string, opts: EpubOptionsAdapter): { blob: Blob; chapters: Chapter[]; bookId: string } {
  // For PRC, the entire text is one "page" — splitIntoChapters in heading mode
  // will then subdivide by detected headings.
  const pageTexts = [rawText];
  const chapters = splitIntoEpubChapters(pageTexts, "heading");
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

export async function convertPrcToEpub(
  bytes: Uint8Array,
  opts: PrcConvertOptions = DEFAULT_OPTIONS,
  outputFileName: string = "converted.epub",
): Promise<ToolResult<PrcConvertResult>> {
  if (!isPrcFile(bytes)) {
    return { ok: false, error: "Not a valid PRC file: missing PalmDB header or wrong creator code." };
  }
  let book: PrcBook;
  try {
    book = parsePrc(bytes);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (book.isEncrypted) {
    return { ok: false, error: "This PRC file is DRM-protected and cannot be converted." };
  }
  if (book.unsupportedCompression) {
    return { ok: false, error: "This PRC uses HuffCDic compression (method 2), which is not supported." };
  }
  if (!book.rawText || book.rawText.trim() === "") {
    return { ok: false, error: "No text content found in the PRC file." };
  }
  const effectiveOpts: PrcConvertOptions = {
    ...opts,
    title: opts.title && opts.title !== DEFAULT_OPTIONS.title ? opts.title : (book.metadata.title || DEFAULT_OPTIONS.title),
    author: opts.author && opts.author !== DEFAULT_OPTIONS.author ? opts.author : (book.metadata.author || DEFAULT_OPTIONS.author),
    language: opts.language !== "en" ? opts.language : (book.metadata.language || "en"),
  };
  const { blob, chapters } = generateEpub(book.rawText, effectiveOpts);
  const stats = computeStats(book.palmDoc, chapters, blob.size);
  return {
    ok: true,
    output: {
      blob,
      fileName: outputFileName,
      metadata: { ...book.metadata, title: effectiveOpts.title, author: effectiveOpts.author, language: effectiveOpts.language },
      chapters,
      stats,
      isEncrypted: false,
      unsupportedCompression: false,
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

// ===== History (localStorage) =====

const HISTORY_KEY = "unqtools-prc-to-epub-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  prcBytes: number;
  epubBytes: number;
  recordCount: number;
  chapterCount: number;
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

export function buildShareUrl(opts: PrcConvertOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("mode", opts.chapterMode);
  if (opts.title && opts.title !== DEFAULT_OPTIONS.title) params.set("title", opts.title);
  if (opts.author && opts.author !== DEFAULT_OPTIONS.author) params.set("author", opts.author);
  params.set("fs", String(opts.fontSize));
  params.set("lang", opts.language);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<PrcConvertOptions> | null {
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

// Re-export for tests
export { parsePalmDbHeader, parseRecordInfoTable, extractRecords, parsePalmDocHeader, decompressTextRecord, decodeText, extractText };
