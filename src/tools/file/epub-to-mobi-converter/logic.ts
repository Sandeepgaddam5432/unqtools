/**
 * EPUB to MOBI Converter — pure-JS EPUB parser + MOBI generator.
 *
 * Pipeline:
 *   1. Parse EPUB (ZIP) using epub-reader's parseEpub.
 *   2. Extract chapter text from each XHTML chapter (strip HTML tags).
 *   3. Wrap chapter text in <h1>title</h1><p>para</p>... HTML.
 *   4. Generate MOBI file using pdf-to-mobi-converter's assembleMobi.
 */

import {
  parseEpub,
  stripXmlTags,
  extractBody,
  type EpubBook,
  type EpubChapter,
} from "../epub-reader/logic";
import {
  assembleMobi,
  buildHtmlBody,
  splitTextRecords,
  escapeHtml,
  type MobiOptions,
  type MobiEncoding,
  type MobiChapterMode,
} from "../pdf-to-mobi-converter/logic";
import type { ToolResult } from "../../../lib/tool";

// ===== Types =====

export interface EpubToMobiOptions {
  title: string;
  author: string;
  language: string;
  encoding: MobiEncoding;
  chapterMode: MobiChapterMode;
}

export const DEFAULT_OPTIONS: EpubToMobiOptions = {
  title: "Converted from EPUB",
  author: "Unknown",
  language: "en",
  encoding: "utf-8",
  chapterMode: "page",
};

export interface EpubToMobiResult {
  blob: Blob;
  fileName: string;
  metadata: { title: string; author: string; language: string };
  chapterCount: number;
  wordCount: number;
  charCount: number;
  recordCount: number;
  textRecordCount: number;
  mobiBytes: number;
  /** First chapter's extracted text (for preview). */
  previewText: string;
}

// ===== EPUB chapter to text =====

/** Strip HTML tags and extract plain text from a chapter's XHTML content. */
export function chapterToText(chapter: EpubChapter): string {
  const body = extractBody(chapter.content);
  return stripXmlTags(body);
}

/** Convert a chapter to page-text format (one string per chapter). */
export function chaptersToPageTexts(chapters: EpubChapter[]): string[] {
  return chapters.map((c) => {
    const title = c.title || `Chapter ${c.index + 1}`;
    const body = chapterToText(c);
    return `${title}\n${body}`;
  });
}

/** Count words in a string. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((s) => s.length > 0).length;
}

// ===== Top-level conversion =====

export async function convertEpubToMobi(
  epubBytes: Uint8Array,
  opts: EpubToMobiOptions = DEFAULT_OPTIONS,
  outputFileName: string = "converted.mobi",
): Promise<ToolResult<EpubToMobiResult>> {
  let book: EpubBook;
  try {
    book = await parseEpub(epubBytes, outputFileName, epubBytes.length);
  } catch (e) {
    return { ok: false, error: `Could not parse EPUB: ${(e as Error).message}` };
  }
  if (book.chapters.length === 0) {
    return { ok: false, error: "EPUB has no chapters." };
  }
  const pageTexts = chaptersToPageTexts(book.chapters);
  if (pageTexts.every((p) => p.trim() === "")) {
    return { ok: false, error: "EPUB chapters contain no extractable text." };
  }

  // Use EPUB metadata if user didn't override
  const effectiveOpts: MobiOptions = {
    pageRange: "",
    title: opts.title && opts.title !== DEFAULT_OPTIONS.title
      ? opts.title
      : (book.metadata.title || DEFAULT_OPTIONS.title),
    author: opts.author && opts.author !== DEFAULT_OPTIONS.author
      ? opts.author
      : (book.metadata.author || DEFAULT_OPTIONS.author),
    encoding: opts.encoding,
    chapterMode: opts.chapterMode,
    language: opts.language !== "en" ? opts.language : (book.metadata.language || "en"),
  };

  const mobiBytes = assembleMobi(pageTexts, effectiveOpts);
  const html = buildHtmlBody(pageTexts, effectiveOpts);
  const textRecordCount = splitTextRecords(html, effectiveOpts.encoding).length;
  const totalText = pageTexts.join("\n");
  const wordCount = countWords(totalText);
  const charCount = totalText.length;
  const blob = new Blob([mobiBytes as BlobPart], { type: "application/x-mobipocket-ebook" });

  return {
    ok: true,
    output: {
      blob,
      fileName: outputFileName,
      metadata: {
        title: effectiveOpts.title,
        author: effectiveOpts.author,
        language: effectiveOpts.language,
      },
      chapterCount: book.chapters.length,
      wordCount,
      charCount,
      recordCount: textRecordCount + 1, // +1 for record 0
      textRecordCount,
      mobiBytes: mobiBytes.length,
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

export { escapeHtml };

// ===== History (localStorage) =====

const HISTORY_KEY = "unqtools-epub-to-mobi-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  epubBytes: number;
  mobiBytes: number;
  chapterCount: number;
  wordCount: number;
  recordCount: number;
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

export function buildShareUrl(opts: EpubToMobiOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("mode", opts.chapterMode);
  params.set("enc", opts.encoding);
  if (opts.title && opts.title !== DEFAULT_OPTIONS.title) params.set("title", opts.title);
  if (opts.author && opts.author !== DEFAULT_OPTIONS.author) params.set("author", opts.author);
  params.set("lang", opts.language);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<EpubToMobiOptions> | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("mode") && !params.has("enc")) return null;
  const mode = (params.get("mode") ?? "page") as MobiChapterMode;
  const validModes: MobiChapterMode[] = ["page", "heading", "single"];
  const enc = (params.get("enc") ?? "utf-8") as MobiEncoding;
  const validEncs: MobiEncoding[] = ["cp1252", "utf-8"];
  return {
    chapterMode: validModes.includes(mode) ? mode : "page",
    encoding: validEncs.includes(enc) ? enc : "utf-8",
    title: params.get("title") ?? "",
    author: params.get("author") ?? "",
    language: params.get("lang") ?? "en",
  };
}
