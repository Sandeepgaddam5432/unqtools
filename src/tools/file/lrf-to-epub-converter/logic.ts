/**
 * LRF to EPUB Converter — pure-JS LRF (Sony BroadBook) parser + EPUB generator.
 *
 * LRF format overview (simplified subset we support):
 *   - 8-byte signature: "LRF\0\0\0\0\0" (LRF + 5 zeros)
 *   - 4-byte version (little-endian, usually 800-1000)
 *   - 4-byte object count (little-endian)
 *   - 4-byte metadata offset (little-endian)
 *   - For each object: 4-byte type + 4-byte offset + 4-byte size + 4-byte id
 *   - Object types: META=0, BOOK=1, PAGE=2, TEXT=3, IMAGE=4
 *   - META object: UTF-8 XML with <title>, <author>, <language>
 *   - TEXT objects: UTF-8 text content (one per chapter)
 *
 * Real LRF files use compressed objects and a complex PageTree/PageList structure.
 * We support the DRM-free text-extraction path: read the object table, decode each
 * TEXT object as UTF-8, concatenate, split into chapters, and emit EPUB.
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

export type LrfObjectType = "META" | "BOOK" | "PAGE" | "TEXT" | "IMAGE" | "UNKNOWN";

export interface LrfObject {
  index: number;
  type: LrfObjectType;
  typeCode: number;
  offset: number;
  size: number;
  id: number;
}

export interface LrfMetadata {
  title: string;
  author: string;
  language: string;
}

export interface LrfStats {
  objectCount: number;
  textObjectCount: number;
  imageObjectCount: number;
  pageObjectCount: number;
  chapterCount: number;
  wordCount: number;
  charCount: number;
  epubBytes: number;
}

export interface LrfConvertOptions {
  title: string;
  author: string;
  language: string;
  chapterMode: ChapterMode;
  fontSize: number;
  customCss: string;
}

export const DEFAULT_OPTIONS: LrfConvertOptions = {
  title: "Converted from LRF",
  author: "Unknown",
  language: "en",
  chapterMode: "heading",
  fontSize: 16,
  customCss: "",
};

export interface LrfConvertResult {
  blob: Blob;
  fileName: string;
  metadata: LrfMetadata;
  objects: LrfObject[];
  chapters: Chapter[];
  stats: LrfStats;
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

export const LRF_SIGNATURE = "LRF";
export const LRF_HEADER_MIN_SIZE = 20; // sig(8) + version(4) + objCount(4) + metaOffset(4)

export const LRF_TYPE_META = 0;
export const LRF_TYPE_BOOK = 1;
export const LRF_TYPE_PAGE = 2;
export const LRF_TYPE_TEXT = 3;
export const LRF_TYPE_IMAGE = 4;

const TYPE_NAMES: Record<number, LrfObjectType> = {
  [LRF_TYPE_META]: "META",
  [LRF_TYPE_BOOK]: "BOOK",
  [LRF_TYPE_PAGE]: "PAGE",
  [LRF_TYPE_TEXT]: "TEXT",
  [LRF_TYPE_IMAGE]: "IMAGE",
};

// ===== LRF header parsing =====

/** Check if bytes start with the LRF signature. */
export function isLrfFile(bytes: Uint8Array): boolean {
  if (bytes.length < LRF_HEADER_MIN_SIZE) return false;
  const sig = readString(bytes, 0, 3);
  return sig === LRF_SIGNATURE;
}

export interface LrfHeader {
  signature: string;
  version: number;
  objectCount: number;
  metadataOffset: number;
}

/** Parse the LRF header. */
export function parseLrfHeader(bytes: Uint8Array): LrfHeader {
  if (bytes.length < LRF_HEADER_MIN_SIZE) {
    throw new Error("File is too small to be a valid LRF file (needs at least 20 bytes).");
  }
  const signature = readString(bytes, 0, 3);
  if (signature !== LRF_SIGNATURE) {
    throw new Error(`Not a valid LRF file: signature is "${signature}", expected "${LRF_SIGNATURE}".`);
  }
  const version = readU32LE(bytes, 8);
  const objectCount = readU32LE(bytes, 12);
  const metadataOffset = readU32LE(bytes, 16);
  return { signature, version, objectCount, metadataOffset };
}

/** Parse the object table (starts at offset 20). Each entry is 16 bytes. */
export function parseObjectTable(bytes: Uint8Array, objectCount: number, baseOffset: number = 20): LrfObject[] {
  const objects: LrfObject[] = [];
  for (let i = 0; i < objectCount; i++) {
    const offset = baseOffset + i * 16;
    if (offset + 16 > bytes.length) break;
    const typeCode = readU32LE(bytes, offset);
    const objOffset = readU32LE(bytes, offset + 4);
    const objSize = readU32LE(bytes, offset + 8);
    const objId = readU32LE(bytes, offset + 12);
    objects.push({
      index: i,
      type: TYPE_NAMES[typeCode] ?? "UNKNOWN",
      typeCode,
      offset: objOffset,
      size: objSize,
      id: objId,
    });
  }
  return objects;
}

/** Extract raw bytes for an object. */
export function extractObjectData(bytes: Uint8Array, obj: LrfObject): Uint8Array {
  return bytes.subarray(obj.offset, obj.offset + obj.size);
}

// ===== Metadata extraction =====

const EMPTY_METADATA: LrfMetadata = { title: "", author: "", language: "" };

/** Parse the META object's XML to extract title/author/language. */
export function parseMetadata(metaBytes: Uint8Array): LrfMetadata {
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

/** Decode an object's bytes as UTF-8 text. */
export function decodeObjectText(data: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(data);
}

/** Extract text from all TEXT-type objects, in object-index order. */
export function extractAllText(bytes: Uint8Array, objects: LrfObject[]): string[] {
  const texts: string[] = [];
  for (const obj of objects) {
    if (obj.type !== "TEXT") continue;
    const data = extractObjectData(bytes, obj);
    texts.push(decodeObjectText(data));
  }
  return texts;
}

// ===== Stats =====

export function computeStats(
  objects: LrfObject[],
  chapters: Chapter[],
  epubBytes: number,
): LrfStats {
  let textObjectCount = 0;
  let imageObjectCount = 0;
  let pageObjectCount = 0;
  for (const obj of objects) {
    if (obj.type === "TEXT") textObjectCount++;
    else if (obj.type === "IMAGE") imageObjectCount++;
    else if (obj.type === "PAGE") pageObjectCount++;
  }
  const wordCount = chapters.reduce((s, c) => s + c.wordCount, 0);
  const charCount = chapters.reduce((s, c) => s + c.charCount, 0);
  return {
    objectCount: objects.length,
    textObjectCount,
    imageObjectCount,
    pageObjectCount,
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

export async function convertLrfToEpub(
  bytes: Uint8Array,
  opts: LrfConvertOptions = DEFAULT_OPTIONS,
  outputFileName: string = "converted.epub",
): Promise<ToolResult<LrfConvertResult>> {
  if (!isLrfFile(bytes)) {
    return { ok: false, error: `Not a valid LRF file: missing "${LRF_SIGNATURE}" signature.` };
  }
  let header: LrfHeader;
  let objects: LrfObject[];
  try {
    header = parseLrfHeader(bytes);
    objects = parseObjectTable(bytes, header.objectCount, 20);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (objects.length === 0) {
    return { ok: false, error: "LRF file has no objects." };
  }
  // Extract metadata from META-type objects
  let metadata: LrfMetadata = { ...EMPTY_METADATA };
  const metaObj = objects.find((o) => o.type === "META");
  if (metaObj) {
    try {
      metadata = parseMetadata(extractObjectData(bytes, metaObj));
    } catch {
      // leave defaults
    }
  }
  // Extract text from TEXT-type objects
  const pageTexts = extractAllText(bytes, objects);
  if (pageTexts.length === 0 || pageTexts.every((t) => t.trim() === "")) {
    return { ok: false, error: "No text objects found in the LRF file (only images/pages)." };
  }
  const effectiveOpts: LrfConvertOptions = {
    ...opts,
    title: opts.title && opts.title !== DEFAULT_OPTIONS.title ? opts.title : (metadata.title || DEFAULT_OPTIONS.title),
    author: opts.author && opts.author !== DEFAULT_OPTIONS.author ? opts.author : (metadata.author || DEFAULT_OPTIONS.author),
    language: opts.language !== "en" ? opts.language : (metadata.language || "en"),
  };
  const { blob, chapters } = generateEpub(pageTexts, effectiveOpts);
  const stats = computeStats(objects, chapters, blob.size);
  return {
    ok: true,
    output: {
      blob,
      fileName: outputFileName,
      metadata: { title: effectiveOpts.title, author: effectiveOpts.author, language: effectiveOpts.language },
      objects,
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

const HISTORY_KEY = "unqtools-lrf-to-epub-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  lrfBytes: number;
  epubBytes: number;
  objectCount: number;
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

export function buildShareUrl(opts: LrfConvertOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("mode", opts.chapterMode);
  if (opts.title && opts.title !== DEFAULT_OPTIONS.title) params.set("title", opts.title);
  if (opts.author && opts.author !== DEFAULT_OPTIONS.author) params.set("author", opts.author);
  params.set("fs", String(opts.fontSize));
  params.set("lang", opts.language);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<LrfConvertOptions> | null {
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

export { readU8, readU16LE, readU32LE, readString };
