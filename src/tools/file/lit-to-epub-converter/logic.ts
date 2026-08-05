/**
 * LIT to EPUB Converter — pure-JS LIT (Microsoft Reader) parser + EPUB generator.
 *
 * LIT format overview (DRM-free subset we support):
 *   - 8-byte signature: "ITOLITLS"
 *   - 4-byte version (little-endian, usually 1)
 *   - 4-byte header size (little-endian)
 *   - 4-byte section count (little-endian)
 *   - For each section: 4-byte offset + 4-byte size + 4-byte flags (little-endian)
 *   - Section 0: metadata (UTF-8 XML with <title> and <author>)
 *   - Sections 1..N: chapter text (UTF-8 HTML or plain text)
 *
 * Real LIT files use OEB PS (Publication Structure) and LZX compression.
 * We support the DRM-free text-extraction path: read the section table,
 * decode each text section as UTF-8, concatenate, split into chapters,
 * and emit EPUB. LZX-compressed sections are flagged as unsupported.
 *
 * EPUB generation reuses the proven generator from pdf-to-epub-converter.
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

export interface LitSection {
  index: number;
  offset: number;
  size: number;
  flags: number;
  /** True if section is compressed with LZX (we can't decode it). */
  isCompressed: boolean;
}

export interface LitMetadata {
  title: string;
  author: string;
  language: string;
}

export interface LitStats {
  sectionCount: number;
  textSectionCount: number;
  compressedSectionCount: number;
  chapterCount: number;
  wordCount: number;
  charCount: number;
  epubBytes: number;
}

export interface LitConvertOptions {
  title: string;
  author: string;
  language: string;
  chapterMode: ChapterMode;
  fontSize: number;
  customCss: string;
}

export const DEFAULT_OPTIONS: LitConvertOptions = {
  title: "Converted from LIT",
  author: "Unknown",
  language: "en",
  chapterMode: "heading",
  fontSize: 16,
  customCss: "",
};

export interface LitConvertResult {
  blob: Blob;
  fileName: string;
  metadata: LitMetadata;
  sections: LitSection[];
  chapters: Chapter[];
  stats: LitStats;
}

// ===== Byte readers (little-endian) =====

function readU8(bytes: Uint8Array, offset: number): number {
  return bytes[offset] ?? 0;
}

function readU16LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readU32LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16) |
    ((bytes[offset + 3] ?? 0) << 24)
  ) >>> 0;
}

function readString(bytes: Uint8Array, offset: number, length: number): string {
  return Array.from(bytes.subarray(offset, offset + length))
    .map((b) => String.fromCharCode(b))
    .join("");
}

// ===== Constants =====

export const LIT_SIGNATURE = "ITOLITLS";
export const LIT_HEADER_MIN_SIZE = 8 + 4 + 4 + 4; // sig + version + headerSize + sectionCount

/** Section flag bit 0 = LZX compressed. */
export const LIT_FLAG_COMPRESSED = 0x01;
/** Section flag bit 1 = text section (vs metadata). */
export const LIT_FLAG_TEXT = 0x02;

// ===== LIT header parsing =====

/** Check if bytes start with the ITOLITLS signature. */
export function isLitFile(bytes: Uint8Array): boolean {
  if (bytes.length < LIT_HEADER_MIN_SIZE) return false;
  return readString(bytes, 0, 8) === LIT_SIGNATURE;
}

export interface LitHeader {
  signature: string;
  version: number;
  headerSize: number;
  sectionCount: number;
}

/** Parse the LIT header (signature + version + headerSize + sectionCount). */
export function parseLitHeader(bytes: Uint8Array): LitHeader {
  if (bytes.length < LIT_HEADER_MIN_SIZE) {
    throw new Error("File is too small to be a valid LIT file (needs at least 20 bytes).");
  }
  const signature = readString(bytes, 0, 8);
  if (signature !== LIT_SIGNATURE) {
    throw new Error(`Not a valid LIT file: signature is "${signature}", expected "${LIT_SIGNATURE}".`);
  }
  const version = readU32LE(bytes, 8);
  const headerSize = readU32LE(bytes, 12);
  const sectionCount = readU32LE(bytes, 16);
  return { signature, version, headerSize, sectionCount };
}

/** Parse the section table (starts at offset 20). */
export function parseSectionTable(bytes: Uint8Array, sectionCount: number, baseOffset: number = 20): LitSection[] {
  const sections: LitSection[] = [];
  for (let i = 0; i < sectionCount; i++) {
    const offset = baseOffset + i * 12;
    if (offset + 12 > bytes.length) break;
    const sectionOffset = readU32LE(bytes, offset);
    const sectionSize = readU32LE(bytes, offset + 4);
    const flags = readU32LE(bytes, offset + 8);
    sections.push({
      index: i,
      offset: sectionOffset,
      size: sectionSize,
      flags,
      isCompressed: (flags & LIT_FLAG_COMPRESSED) !== 0,
    });
  }
  return sections;
}

/** Extract the raw bytes of a single section. */
export function extractSectionData(bytes: Uint8Array, section: LitSection): Uint8Array {
  return bytes.subarray(section.offset, section.offset + section.size);
}

// ===== Metadata extraction =====

const EMPTY_METADATA: LitMetadata = { title: "", author: "", language: "" };

/** Parse metadata section (section 0). The content is treated as XML-ish. */
export function parseMetadata(metaBytes: Uint8Array): LitMetadata {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(metaBytes);
  const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const authorMatch = text.match(/<author[^>]*>([\s\S]*?)<\/author>/i);
  const langMatch = text.match(/<language[^>]*>([\s\S]*?)<\/language>/i);
  return {
    title: titleMatch ? titleMatch[1]!.trim() : "",
    author: authorMatch ? authorMatch[1]!.trim() : "",
    language: langMatch ? langMatch[1]!.trim() : "",
  };
}

// ===== Text extraction =====

/** Decode a section's bytes as UTF-8 text. */
export function decodeSectionText(data: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(data);
}

/**
 * Extract all text from text sections (those with the TEXT flag set, or
 * any section after the metadata section). Compressed sections are skipped.
 */
export function extractAllText(bytes: Uint8Array, sections: LitSection[]): string[] {
  const texts: string[] = [];
  for (let i = 1; i < sections.length; i++) {
    const sec = sections[i]!;
    if (sec.isCompressed) continue;
    const data = extractSectionData(bytes, sec);
    texts.push(decodeSectionText(data));
  }
  return texts;
}

// ===== Stats =====

export function computeStats(
  sections: LitSection[],
  chapters: Chapter[],
  epubBytes: number,
): LitStats {
  let textSectionCount = 0;
  let compressedSectionCount = 0;
  for (let i = 1; i < sections.length; i++) {
    const sec = sections[i]!;
    if (sec.isCompressed) compressedSectionCount++;
    else textSectionCount++;
  }
  const wordCount = chapters.reduce((s, c) => s + c.wordCount, 0);
  const charCount = chapters.reduce((s, c) => s + c.charCount, 0);
  return {
    sectionCount: sections.length,
    textSectionCount,
    compressedSectionCount,
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

/** Build an EPUB Blob from page-texts + options. */
export function generateEpub(pageTexts: string[], opts: EpubOptionsAdapter): { blob: Blob; chapters: Chapter[]; bookId: string } {
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

export async function convertLitToEpub(
  bytes: Uint8Array,
  opts: LitConvertOptions = DEFAULT_OPTIONS,
  outputFileName: string = "converted.epub",
): Promise<ToolResult<LitConvertResult>> {
  if (!isLitFile(bytes)) {
    return { ok: false, error: `Not a valid LIT file: missing "${LIT_SIGNATURE}" signature.` };
  }
  let header: LitHeader;
  let sections: LitSection[];
  try {
    header = parseLitHeader(bytes);
    sections = parseSectionTable(bytes, header.sectionCount, 20);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (sections.length === 0) {
    return { ok: false, error: "LIT file has no sections." };
  }
  // Extract metadata from section 0 (if present)
  let metadata: LitMetadata = { ...EMPTY_METADATA };
  if (sections.length > 0) {
    try {
      metadata = parseMetadata(extractSectionData(bytes, sections[0]!));
    } catch {
      // Section 0 isn't metadata — leave defaults
    }
  }
  // Extract text from sections 1..N
  const pageTexts = extractAllText(bytes, sections);
  if (pageTexts.length === 0 || pageTexts.every((t) => t.trim() === "")) {
    return { ok: false, error: "No text content found in the LIT file (sections may be LZX-compressed)." };
  }
  const effectiveOpts: LitConvertOptions = {
    ...opts,
    title: opts.title && opts.title !== DEFAULT_OPTIONS.title ? opts.title : (metadata.title || DEFAULT_OPTIONS.title),
    author: opts.author && opts.author !== DEFAULT_OPTIONS.author ? opts.author : (metadata.author || DEFAULT_OPTIONS.author),
    language: opts.language !== "en" ? opts.language : (metadata.language || "en"),
  };
  const { blob, chapters } = generateEpub(pageTexts, effectiveOpts);
  const stats = computeStats(sections, chapters, blob.size);
  return {
    ok: true,
    output: {
      blob,
      fileName: outputFileName,
      metadata: { title: effectiveOpts.title, author: effectiveOpts.author, language: effectiveOpts.language },
      sections,
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

// ===== History (localStorage) =====

const HISTORY_KEY = "unqtools-lit-to-epub-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  litBytes: number;
  epubBytes: number;
  sectionCount: number;
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

export function buildShareUrl(opts: LitConvertOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("mode", opts.chapterMode);
  if (opts.title && opts.title !== DEFAULT_OPTIONS.title) params.set("title", opts.title);
  if (opts.author && opts.author !== DEFAULT_OPTIONS.author) params.set("author", opts.author);
  params.set("fs", String(opts.fontSize));
  params.set("lang", opts.language);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<LitConvertOptions> | null {
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
export { readU8, readU16LE, readU32LE, readString };
