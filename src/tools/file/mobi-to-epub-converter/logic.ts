/**
 * MOBI to EPUB Converter — pure-JS MOBI parser + EPUB generator.
 *
 * Pipeline:
 *   1. Parse MOBI using mobi-reader's parseMobi (PalmDB + MOBI + EXTH + text).
 *   2. Extract chapter text from each MOBI chapter (strip HTML tags).
 *   3. Convert each chapter to a page-text (one string per chapter).
 *   4. Generate EPUB using pdf-to-epub-converter's splitIntoChapters + EPUB
 *      generators (mimetype + container.xml + content.opf + toc.ncx +
 *      nav.xhtml + chapter*.xhtml).
 */

import {
  parseMobi,
  isMobiFile,
  type MobiBook,
  type MobiChapter,
} from "../mobi-reader/logic";
import {
  splitIntoChapters,
  generateMimetype,
  generateContainerXml,
  generateContentOpf,
  generateNcx,
  generateNav,
  generateChapterXhtml,
  generateStylesheet,
  generateUuid,
  type Chapter,
  type ChapterMode,
} from "../pdf-to-epub-converter/logic";
import {
  createZipBlob,
  xmlEscape,
  xmlAttrEscape,
  type ZipFile,
} from "../csv-to-excel-converter/logic";
import type { ToolResult } from "../../../lib/tool";

// ===== Types =====

export interface MobiToEpubOptions {
  title: string;
  author: string;
  language: string;
  chapterMode: ChapterMode;
  fontSize: number;
  customCss: string;
}

export const DEFAULT_OPTIONS: MobiToEpubOptions = {
  title: "Converted from MOBI",
  author: "Unknown",
  language: "en",
  chapterMode: "heading",
  fontSize: 16,
  customCss: "",
};

export interface MobiToEpubResult {
  blob: Blob;
  fileName: string;
  metadata: { title: string; author: string; language: string; encoding: string };
  chapterCount: number;
  wordCount: number;
  charCount: number;
  epubBytes: number;
  /** True if the source MOBI was DRM-protected. */
  isEncrypted: boolean;
  /** True if the source MOBI used unsupported compression. */
  unsupportedCompression: boolean;
  previewText: string;
}

// ===== MOBI chapter to text =====

/** Strip HTML tags from a MOBI chapter's HTML. */
export function chapterToText(chapter: MobiChapter): string {
  return chapter.text;
}

/** Convert MOBI chapters to page-texts (one string per chapter). */
export function chaptersToPageTexts(chapters: MobiChapter[]): string[] {
  return chapters.map((c) => {
    const title = c.title || `Chapter ${c.index + 1}`;
    return `${title}\n${c.text}`;
  });
}

/** Count words in a string. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((s) => s.length > 0).length;
}

// ===== EPUB generation (reuse from pdf-to-epub-converter) =====

export interface EpubOptionsAdapter {
  title: string;
  author: string;
  language: string;
  fontSize: number;
  customCss: string;
}

export function generateEpub(
  pageTexts: string[],
  opts: EpubOptionsAdapter,
): { blob: Blob; chapters: Chapter[]; bookId: string } {
  // Use "page" mode: each MOBI chapter (already split by the MOBI parser via
  // <h1>/<h2>/<mbp:pagebreak/> tags) becomes one EPUB chapter. "heading" mode
  // would re-split on heading patterns and could miss chapters when body text
  // starts with "Chapter N" (matched by the heading regex).
  const chapters = splitIntoChapters(pageTexts, "page");
  const epubOpts = {
    pageRange: "",
    chapterMode: "page" as ChapterMode,
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

export async function convertMobiToEpub(
  mobiBytes: Uint8Array,
  opts: MobiToEpubOptions = DEFAULT_OPTIONS,
  outputFileName: string = "converted.epub",
): Promise<ToolResult<MobiToEpubResult>> {
  if (!isMobiFile(mobiBytes)) {
    return { ok: false, error: "Not a valid MOBI file (missing PalmDB/BOOK signature)." };
  }
  let book: MobiBook;
  try {
    book = parseMobi(mobiBytes, outputFileName, mobiBytes.length);
  } catch (e) {
    return { ok: false, error: `Could not parse MOBI: ${(e as Error).message}` };
  }
  if (book.chapters.length === 0) {
    return { ok: false, error: "MOBI file has no chapters." };
  }

  // If encrypted or unsupported compression, return early with the diagnostic info
  if (book.isEncrypted) {
    return {
      ok: false,
      error: "MOBI file is DRM-protected and cannot be converted. Removing DRM requires the device's PID + serial number and may be legally restricted.",
    };
  }
  if (book.unsupportedCompression) {
    return {
      ok: false,
      error: "MOBI uses HuffCDic compression (method 2), which is not supported. Convert to plain text or HTML with Calibre first.",
    };
  }

  const pageTexts = chaptersToPageTexts(book.chapters);
  if (pageTexts.every((p) => p.trim() === "")) {
    return { ok: false, error: "MOBI chapters contain no extractable text." };
  }

  const effectiveOpts: EpubOptionsAdapter = {
    title: opts.title && opts.title !== DEFAULT_OPTIONS.title
      ? opts.title
      : (book.metadata.title || DEFAULT_OPTIONS.title),
    author: opts.author && opts.author !== DEFAULT_OPTIONS.author
      ? opts.author
      : (book.metadata.author || DEFAULT_OPTIONS.author),
    language: opts.language !== "en" ? opts.language : (book.metadata.language || "en"),
    fontSize: opts.fontSize,
    customCss: opts.customCss,
  };

  const { blob, chapters } = generateEpub(pageTexts, effectiveOpts);
  const totalText = pageTexts.join("\n");
  const wordCount = countWords(totalText);
  const charCount = totalText.length;

  return {
    ok: true,
    output: {
      blob,
      fileName: outputFileName,
      metadata: {
        title: effectiveOpts.title,
        author: effectiveOpts.author,
        language: effectiveOpts.language,
        encoding: book.metadata.encoding,
      },
      chapterCount: chapters.length,
      wordCount,
      charCount,
      epubBytes: blob.size,
      isEncrypted: book.isEncrypted,
      unsupportedCompression: book.unsupportedCompression,
      previewText: pageTexts[0]?.slice(0, 2000) ?? "",
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

const HISTORY_KEY = "unqtools-mobi-to-epub-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  mobiBytes: number;
  epubBytes: number;
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
  } catch {
    return [];
  }
}

export function saveToHistory(entry: HistoryEntry): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const updated = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    /* ignore */
  }
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}

// ===== Shareable URL =====

export function buildShareUrl(opts: MobiToEpubOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("mode", opts.chapterMode);
  if (opts.title && opts.title !== DEFAULT_OPTIONS.title) params.set("title", opts.title);
  if (opts.author && opts.author !== DEFAULT_OPTIONS.author) params.set("author", opts.author);
  params.set("fs", String(opts.fontSize));
  params.set("lang", opts.language);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<MobiToEpubOptions> | null {
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
