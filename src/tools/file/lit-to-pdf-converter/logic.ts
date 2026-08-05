/**
 * LIT to PDF Converter — pure-JS LIT (Microsoft Reader) parser + pdf-lib PDF generator.
 *
 * LIT format (DRM-free subset we support):
 *   - 8-byte signature: "ITOLITLS"
 *   - 4-byte version (little-endian, usually 1)
 *   - 4-byte header size (little-endian)
 *   - 4-byte section count (little-endian)
 *   - For each section: 4-byte offset + 4-byte size + 4-byte flags (little-endian)
 *   - Section 0: metadata (UTF-8 XML with <title> and <author>)
 *   - Sections 1..N: chapter text (UTF-8 HTML or plain text)
 *
 * HONESTY CLAUSE: Real LIT files may use LZX compression (flag bit 0 = compressed).
 * We skip those sections and only extract uncompressed text. Documented in FAQ.
 *
 * PDF rendering uses pdf-lib (Helvitica font, configurable page size + font size + margins).
 */

import {
  LIT_SIGNATURE,
  LIT_HEADER_MIN_SIZE,
  isLitFile,
  parseLitHeader,
  parseSectionTable,
  extractSectionData,
  parseMetadata,
  decodeSectionText,
  extractAllText,
  computeStats,
  type LitSection,
  type LitMetadata,
  type LitStats,
} from "../lit-to-epub-converter/logic";
import { PDFDocument, StandardFonts, rgb, PageSizes } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

// ===== Types =====

export type LitPdfPageSize = "a4" | "letter";
export type LitPdfOrientation = "portrait" | "landscape";

export interface LitConvertOptions {
  title: string;
  author: string;
  language: string;
  pageSize: LitPdfPageSize;
  orientation: LitPdfOrientation;
  fontSize: number;
  margin: number;
}

export const DEFAULT_OPTIONS: LitConvertOptions = {
  title: "Converted from LIT",
  author: "Unknown",
  language: "en",
  pageSize: "letter",
  orientation: "portrait",
  fontSize: 12,
  margin: 50,
};

export interface LitConvertResult {
  blob: Blob;
  fileName: string;
  metadata: LitMetadata;
  sections: LitSection[];
  stats: LitStats & { pageCount: number };
  /** First chapter's extracted text (for preview). */
  previewText: string;
}

// ===== Heading detection (reused from lit-to-epub) =====

export function isHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 100) return false;
  if (/^#{1,6}\s+/.test(trimmed)) return true;
  if (/^chapter\s+\d+/i.test(trimmed)) return true;
  if (/^part\s+\d+/i.test(trimmed)) return true;
  if (
    trimmed.length >= 5 &&
    /^[A-Z0-9\s\-:,.!?']+$/.test(trimmed) &&
    /[A-Z]/.test(trimmed) &&
    !/^[0-9\s]+$/.test(trimmed)
  ) {
    return true;
  }
  return false;
}

/** Split text into chapters by heading patterns. */
export function splitIntoChapters(text: string): Array<{ title: string; body: string }> {
  const lines = text.split("\n");
  const chapters: Array<{ title: string; body: string }> = [];
  let currentTitle = "Introduction";
  let currentLines: string[] = [];
  let foundAnyHeading = false;
  const flush = () => {
    if (currentLines.length === 0) return;
    chapters.push({
      title: currentTitle,
      body: currentLines.join("\n"),
    });
    currentLines = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    if (isHeading(trimmed)) {
      flush();
      currentTitle = trimmed.replace(/^#{1,6}\s+/, "");
      foundAnyHeading = true;
    } else {
      currentLines.push(trimmed);
    }
  }
  flush();
  // If no headings were found and we have a single chapter, name it "Full Text"
  if (chapters.length === 1 && !foundAnyHeading) {
    chapters[0]!.title = "Full Text";
  }
  if (chapters.length === 0) {
    chapters.push({ title: "Full Text", body: text });
  }
  return chapters;
}

/** Count words in a string. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((s) => s.length > 0).length;
}

// ===== PDF rendering =====

function getPageDimensions(
  pageSize: LitPdfPageSize,
  orientation: LitPdfOrientation,
): { width: number; height: number } {
  const base = pageSize === "a4" ? PageSizes.A4 : PageSizes.Letter;
  const [w, h] = base;
  if (orientation === "landscape") {
    return { width: Math.max(w, h), height: Math.min(w, h) };
  }
  return { width: Math.min(w, h), height: Math.max(w, h) };
}

export async function renderChaptersToPdf(
  chapters: Array<{ title: string; body: string }>,
  opts: LitConvertOptions,
): Promise<{ bytes: Uint8Array; pageCount: number }> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const bodyFont = await doc.embedFont(StandardFonts.Helvetica);
  const fs = Math.max(8, Math.min(opts.fontSize, 24));
  const margin = Math.max(20, opts.margin);
  const { width, height } = getPageDimensions(opts.pageSize, opts.orientation);
  const availW = width - margin * 2;
  const headingSize = fs + 4;
  const lineHeight = fs * 1.4;

  let y = height - margin;
  let page = doc.addPage([width, height]);
  let pageCount = 1;

  for (const chapter of chapters) {
    // Chapter heading
    if (y < margin + headingSize + 20) {
      page = doc.addPage([width, height]);
      y = height - margin;
      pageCount++;
    }
    const headingLines = wrapText(chapter.title, font, headingSize, availW);
    for (const line of headingLines) {
      if (y < margin) {
        page = doc.addPage([width, height]);
        y = height - margin;
        pageCount++;
      }
      page.drawText(line, { x: margin, y: y - headingSize, size: headingSize, font, color: rgb(0, 0, 0) });
      y -= headingSize + 4;
    }
    y -= 10;

    // Body
    const bodyLines = chapter.body.split("\n");
    for (const rawLine of bodyLines) {
      const wrappedLines = wrapText(rawLine, bodyFont, fs, availW);
      for (const wLine of wrappedLines) {
        if (y < margin) {
          page = doc.addPage([width, height]);
          y = height - margin;
          pageCount++;
        }
        if (wLine) {
          page.drawText(wLine, { x: margin, y: y - fs, size: fs, font: bodyFont, color: rgb(0.1, 0.1, 0.1) });
        }
        y -= lineHeight;
      }
    }
    y -= lineHeight; // spacer between chapters
  }
  doc.setProducer("UnQTools — LIT to PDF Converter");
  doc.setCreator("UnQTools — LIT to PDF Converter");
  doc.setCreationDate(new Date());
  doc.setModificationDate(new Date());
  const bytes = await doc.save();
  return { bytes, pageCount };
}

function wrapText(text: string, font: { widthOfTextAtSize: (s: string, n: number) => number }, size: number, maxWidth: number): string[] {
  if (!text) return [""];
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? current + " " + word : word;
    const w = font.widthOfTextAtSize(test, size);
    if (w > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length === 0 ? [""] : lines;
}

// ===== Top-level conversion =====

export async function convertLitToPdf(
  bytes: Uint8Array,
  opts: LitConvertOptions = DEFAULT_OPTIONS,
  outputFileName: string = "converted.pdf",
): Promise<ToolResult<LitConvertResult>> {
  if (!isLitFile(bytes)) {
    return { ok: false, error: `Not a valid LIT file: missing "${LIT_SIGNATURE}" signature.` };
  }
  let header;
  let sections: LitSection[];
  try {
    header = parseLitHeader(bytes);
    sections = parseSectionTable(bytes, header.sectionCount, LIT_HEADER_MIN_SIZE);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (sections.length === 0) {
    return { ok: false, error: "LIT file has no sections." };
  }

  // Extract metadata
  let metadata: LitMetadata = { title: "", author: "", language: "" };
  if (sections.length > 0) {
    try {
      metadata = parseMetadata(extractSectionData(bytes, sections[0]!));
    } catch {
      // leave defaults
    }
  }

  // Extract text
  const pageTexts = extractAllText(bytes, sections);
  if (pageTexts.length === 0 || pageTexts.every((t) => t.trim() === "")) {
    return {
      ok: false,
      error: "No text content found in the LIT file (sections may be LZX-compressed).",
    };
  }

  // Apply user overrides
  const effectiveOpts: LitConvertOptions = {
    ...opts,
    title: opts.title && opts.title !== DEFAULT_OPTIONS.title
      ? opts.title
      : (metadata.title || DEFAULT_OPTIONS.title),
    author: opts.author && opts.author !== DEFAULT_OPTIONS.author
      ? opts.author
      : (metadata.author || DEFAULT_OPTIONS.author),
    language: opts.language !== "en" ? opts.language : (metadata.language || "en"),
  };

  // Split into chapters
  const allText = pageTexts.join("\n\n");
  const chapters = splitIntoChapters(allText);
  const totalWordCount = countWords(allText);

  // Render PDF
  const { bytes: pdfBytes, pageCount } = await renderChaptersToPdf(chapters, effectiveOpts);
  const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
  const stats = computeStats(sections, [], pdfBytes.length);
  return {
    ok: true,
    output: {
      blob,
      fileName: outputFileName,
      metadata: { title: effectiveOpts.title, author: effectiveOpts.author, language: effectiveOpts.language },
      sections,
      stats: { ...stats, chapterCount: chapters.length, wordCount: totalWordCount, pageCount },
      previewText: chapters[0]?.body.slice(0, 2000) ?? "",
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

const HISTORY_KEY = "unqtools-lit-to-pdf-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  litBytes: number;
  pdfBytes: number;
  sectionCount: number;
  chapterCount: number;
  wordCount: number;
  pageCount: number;
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

export function buildShareUrl(opts: LitConvertOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("size", opts.pageSize);
  params.set("orient", opts.orientation);
  params.set("fs", String(opts.fontSize));
  params.set("margin", String(opts.margin));
  if (opts.title && opts.title !== DEFAULT_OPTIONS.title) params.set("t", opts.title);
  if (opts.author && opts.author !== DEFAULT_OPTIONS.author) params.set("a", opts.author);
  params.set("lang", opts.language);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<LitConvertOptions> | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("size") && !params.has("fs")) return null;
  const size = (params.get("size") ?? "letter") as LitPdfPageSize;
  const orient = (params.get("orient") ?? "portrait") as LitPdfOrientation;
  const fs = parseInt(params.get("fs") ?? "12", 10);
  const margin = parseInt(params.get("margin") ?? "50", 10);
  return {
    pageSize: size === "a4" ? "a4" : "letter",
    orientation: orient === "landscape" ? "landscape" : "portrait",
    fontSize: isNaN(fs) ? 12 : Math.max(8, Math.min(24, fs)),
    margin: isNaN(margin) ? 50 : Math.max(20, Math.min(100, margin)),
    title: params.get("t") ?? "",
    author: params.get("a") ?? "",
    language: params.get("lang") ?? "en",
  };
}
