/**
 * CBZ Comic Book Reader — pure logic for ZIP (STORE method) parsing, page
 * extraction, navigation state, and bookmark management.
 *
 * CBZ files are ZIP archives containing image files. We parse the local file
 * headers (signature 0x04034b50), extract only STORE-method entries (no
 * decompression needed — most CBZs use STORE since images are already
 * compressed), and filter to image MIME types.
 */

export interface ZipEntry {
  name: string;
  compressionMethod: number; // 0 = STORE, 8 = DEFLATE
  compressedSize: number;
  uncompressedSize: number;
  crc32: number;
  /** Byte offset into the source array where the file data begins. */
  dataOffset: number;
}

export interface ExtractedPage {
  name: string;
  index: number;
  blob: Blob;
  url: string;
  mime: string;
  size: number;
}

export interface CbzInfo {
  fileName: string;
  fileSize: number;
  pageCount: number;
  pages: ExtractedPage[];
  imageTypes: Record<string, number>;
  totalImageBytes: number;
}

export type ReadingMode = "single" | "double" | "scroll";
export type FitMode = "original" | "width" | "height";

export interface NavigationState {
  currentPage: number;     // 0-indexed
  totalPages: number;
  canGoPrev: boolean;
  canGoNext: boolean;
}

// ===== ZIP parsing (STORE method only — DEFLATE unsupported in pure JS) =====

/** Parse a CBZ/ZIP file's local file headers. */
export function parseZipEntries(bytes: Uint8Array): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let pos = 0;
  while (pos < bytes.length - 4) {
    // Look for local file header signature 0x04034b50
    if (bytes[pos] !== 0x50 || bytes[pos + 1] !== 0x4b || bytes[pos + 2] !== 0x03 || bytes[pos + 3] !== 0x04) {
      pos++;
      continue;
    }
    // Local file header structure
    if (pos + 30 > bytes.length) break;
    const dv = new DataView(bytes.buffer, bytes.byteOffset + pos, Math.min(bytes.length - pos, 30 + 65535));
    const versionNeeded = dv.getUint16(4, true);
    const flags = dv.getUint16(6, true);
    const compressionMethod = dv.getUint16(8, true);
    const crc = dv.getUint32(14, true);
    const compressedSize = dv.getUint32(18, true);
    const uncompressedSize = dv.getUint32(22, true);
    const nameLen = dv.getUint16(26, true);
    const extraLen = dv.getUint16(28, true);
    if (pos + 30 + nameLen + extraLen > bytes.length) {
      pos++;
      continue;
    }
    const nameBytes = bytes.subarray(pos + 30, pos + 30 + nameLen);
    const name = new TextDecoder("utf-8").decode(nameBytes);
    const dataOffset = pos + 30 + nameLen + extraLen;
    // Skip data
    const dataEnd = dataOffset + compressedSize;
    entries.push({
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      crc32: crc,
      dataOffset,
    });
    void versionNeeded;
    void flags;
    if (dataEnd <= bytes.length) {
      pos = dataEnd;
    } else {
      pos++;
    }
  }
  return entries;
}

/** Detect image MIME type from filename extension. Returns null for non-images. */
export function detectImageMime(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".avif")) return "image/avif";
  return null;
}

/** Natural sort comparator: 'page2.jpg' < 'page10.jpg'. */
export function naturalCompare(a: string, b: string): number {
  const aParts = a.match(/\d+|\D+/g) ?? [a];
  const bParts = b.match(/\d+|\D+/g) ?? [b];
  for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
    const an = /^\d+$/.test(aParts[i]) ? parseInt(aParts[i], 10) : null;
    const bn = /^\d+$/.test(bParts[i]) ? parseInt(bParts[i], 10) : null;
    if (an !== null && bn !== null) {
      if (an !== bn) return an - bn;
    } else {
      const cmp = aParts[i].localeCompare(bParts[i]);
      if (cmp !== 0) return cmp;
    }
  }
  return aParts.length - bParts.length;
}

/** Extract image pages from a CBZ (ZIP) byte array. */
export function extractPages(bytes: Uint8Array): ExtractedPage[] {
  const entries = parseZipEntries(bytes);
  const imageEntries = entries
    .filter((e) => detectImageMime(e.name) !== null)
    .filter((e) => e.compressionMethod === 0) // STORE only
    .sort((a, b) => naturalCompare(a.name, b.name));

  const pages: ExtractedPage[] = [];
  imageEntries.forEach((entry, i) => {
    const data = bytes.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
    // Copy into a fresh ArrayBuffer to satisfy Blob's view requirements.
    const copy = new Uint8Array(data.length);
    copy.set(data);
    const mime = detectImageMime(entry.name)!;
    const blob = new Blob([copy as BlobPart], { type: mime });
    pages.push({
      name: entry.name,
      index: i,
      blob,
      url: URL.createObjectURL(blob),
      mime,
      size: entry.compressedSize,
    });
  });
  return pages;
}

/** Build a summary info object from extracted pages. */
export function buildInfo(fileName: string, fileSize: number, pages: ExtractedPage[]): CbzInfo {
  const imageTypes: Record<string, number> = {};
  let totalImageBytes = 0;
  for (const p of pages) {
    const ext = p.mime.split("/")[1] ?? "unknown";
    imageTypes[ext] = (imageTypes[ext] ?? 0) + 1;
    totalImageBytes += p.size;
  }
  return {
    fileName,
    fileSize,
    pageCount: pages.length,
    pages,
    imageTypes,
    totalImageBytes,
  };
}

// ===== Navigation =====

export function buildNavigationState(currentPage: number, totalPages: number): NavigationState {
  return {
    currentPage: Math.max(0, Math.min(currentPage, Math.max(0, totalPages - 1))),
    totalPages,
    canGoPrev: currentPage > 0,
    canGoNext: currentPage < totalPages - 1,
  };
}

/** Compute next page in single-page mode. */
export function nextPage(current: number, total: number, mode: ReadingMode): number {
  if (mode === "double") {
    return Math.min(current + 2, total - 1);
  }
  return Math.min(current + 1, total - 1);
}

/** Compute previous page in single-page mode. */
export function prevPage(current: number, _total: number, mode: ReadingMode): number {
  if (mode === "double") {
    return Math.max(current - 2, 0);
  }
  return Math.max(current - 1, 0);
}

/** Compute the reading-progress percentage (0-100). */
export function readingProgress(current: number, total: number): number {
  if (total === 0) return 0;
  return Math.round(((current + 1) / total) * 100);
}

/** For double-page mode: the pages displayed at a given index. */
export function pagesForMode(current: number, total: number, mode: ReadingMode): number[] {
  if (mode === "single") return [current].filter((p) => p >= 0 && p < total);
  if (mode === "double") {
    const pages: number[] = [];
    if (current >= 0 && current < total) pages.push(current);
    if (current + 1 < total) pages.push(current + 1);
    return pages;
  }
  // scroll mode — show all
  return Array.from({ length: total }, (_, i) => i);
}

// ===== ZIP writer (STORE method) for "extract all as ZIP" =====

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Build a ZIP archive (STORE method) from extracted page blobs. */
export async function createZipFromPages(pages: ExtractedPage[]): Promise<Blob> {
  const enc = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const page of pages) {
    const fileData = new Uint8Array(await page.blob.arrayBuffer());
    const nameBytes = enc.encode(page.name);
    const crc = crc32(fileData);
    const size = fileData.length;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);     // STORE
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader);
    localParts.push(fileData);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + fileData.length;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const centralOffset = offset;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, pages.length, true);
  ev.setUint16(10, pages.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  ev.setUint16(20, 0, true);

  const allParts = [...localParts, ...centralParts, eocd];
  const totalLength = allParts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(totalLength);
  let pos = 0;
  for (const p of allParts) { out.set(p, pos); pos += p.length; }
  return new Blob([out as BlobPart], { type: "application/zip" });
}

// ===== Bookmarks + history (localStorage) =====
const BOOKMARK_KEY = "unqtools-cbz-bookmarks";
const HISTORY_KEY = "unqtools-cbz-history";
const MAX_HISTORY = 10;

export interface Bookmark {
  fileName: string;
  page: number;
  totalPages: number;
  savedAt: string;
}

export interface CbzHistoryEntry {
  fileName: string;
  fileSize: number;
  pageCount: number;
  openedAt: string;
}

export function loadBookmarks(): Bookmark[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(BOOKMARK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function saveBookmark(bookmark: Bookmark): Bookmark[] {
  if (typeof localStorage === "undefined") return [];
  // Replace existing bookmark for same fileName
  const others = loadBookmarks().filter((b) => b.fileName !== bookmark.fileName);
  const updated = [bookmark, ...others].slice(0, MAX_HISTORY);
  try { localStorage.setItem(BOOKMARK_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function getBookmark(fileName: string): Bookmark | null {
  return loadBookmarks().find((b) => b.fileName === fileName) ?? null;
}

export function removeBookmark(fileName: string): Bookmark[] {
  if (typeof localStorage === "undefined") return [];
  const updated = loadBookmarks().filter((b) => b.fileName !== fileName);
  try { localStorage.setItem(BOOKMARK_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function clearBookmarks(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(BOOKMARK_KEY); } catch {}
}

export function loadHistory(): CbzHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch { return []; }
}

export function saveToHistory(entry: CbzHistoryEntry): CbzHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const others = loadHistory().filter((e) => e.fileName !== entry.fileName);
  const updated = [entry, ...others].slice(0, MAX_HISTORY);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
}

// ===== Utilities =====

/** Format bytes as human-readable. */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Build a shareable URL with reader-mode preset. */
export function buildShareUrl(mode: ReadingMode, fit: FitMode): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("mode", mode);
  params.set("fit", fit);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

/** Parse reader settings from URL hash. */
export function parseShareUrl(hash: string): { mode: ReadingMode; fit: FitMode } | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("mode") && !params.has("fit")) return null;
  const mode = (params.get("mode") as ReadingMode) || "single";
  const fit = (params.get("fit") as FitMode) || "original";
  return { mode, fit };
}

/** Revoke object URLs to free memory. */
export function revokePages(pages: ExtractedPage[]): void {
  for (const p of pages) {
    try { URL.revokeObjectURL(p.url); } catch {}
  }
}
