/**
 * ZIP Extractor — pure-JS ZIP reader (STORE + DEFLATE via DecompressionStream).
 *
 * Reuses the proven `parseZipEntries` and `decompressEntry` from the
 * excel-to-csv-converter tool. This module wraps those primitives with a
 * higher-level API for browsing, searching, filtering, previewing, and
 * re-zipping extracted files.
 *
 * ZIP structure:
 *   [Local File Header 1 (sig 0x04034b50)][File Data 1]
 *   [Local File Header 2][File Data 2]
 *   ...
 *   [Central Directory Entry 1 (sig 0x02014b50)]
 *   ...
 *   [End of Central Directory Record (sig 0x06054b50)]
 *
 * Each local file header tells us:
 *   - compression method (0 = STORE, 8 = DEFLATE, 99 = AES encrypted)
 *   - compressed + uncompressed size
 *   - filename length
 *   - extra field length
 *   - CRC32 (for integrity verification)
 *
 * The central directory (at the end of the archive) repeats all of this
 * information plus an "external file attributes" field used for permissions.
 */

import {
  parseZipEntries as parseZipEntriesBase,
  decompressEntry as decompressEntryBase,
  type ZipEntry as BaseZipEntry,
} from "../excel-to-csv-converter/logic";

// ===== Types =====

export interface ZipEntry {
  name: string;
  compressionMethod: number; // 0 = STORE, 8 = DEFLATE, 99 = AES
  compressedSize: number;
  uncompressedSize: number;
  dataOffset: number;
  bytes: Uint8Array;
  /** Decoded compression method name. */
  compressionName: string;
  /** True if the entry can be extracted (STORE or DEFLATE, not encrypted). */
  isExtractable: boolean;
  /** True if the entry is encrypted (compression method 99 or general-purpose bit 0). */
  isEncrypted: boolean;
}

export interface ExtractedFile {
  name: string;
  data: Uint8Array;
  size: number;
  compressedSize: number;
  mime: string;
  compressionName: string;
}

export interface ZipStats {
  entryCount: number;
  regularFileCount: number;
  directoryCount: number;
  totalCompressed: number;
  totalUncompressed: number;
  ratio: number; // uncompressed / compressed
  deflateCount: number;
  storeCount: number;
  encryptedCount: number;
  largestFileName: string;
  largestFileSize: number;
}

export interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: TreeNode[];
  entry?: ZipEntry;
}

export type ExtensionFilter = "all" | "text" | "image" | "code" | "audio" | "video" | "archive" | "other";

// ===== Constants =====

const COMPRESSION_NAMES: Record<number, string> = {
  0: "STORE",
  8: "DEFLATE",
  9: "DEFLATE64",
  12: "BZIP2",
  14: "LZMA",
  98: "PPMd",
  99: "AES encrypted",
};

// ===== ZIP parsing (wraps the base parser) =====

/** Parse all ZIP entries from a byte array. Handles STORE + DEFLATE + detects encryption. */
export function parseZipEntries(bytes: Uint8Array): ZipEntry[] {
  const baseEntries: BaseZipEntry[] = parseZipEntriesBase(bytes);
  return baseEntries.map((e) => enrichEntry(e));
}

function enrichEntry(e: BaseZipEntry): ZipEntry {
  const isEncrypted = e.compressionMethod === 99;
  const isExtractable = e.compressionMethod === 0 || e.compressionMethod === 8;
  return {
    name: e.name,
    compressionMethod: e.compressionMethod,
    compressedSize: e.compressedSize,
    uncompressedSize: e.uncompressedSize,
    dataOffset: e.dataOffset,
    bytes: e.bytes,
    compressionName: COMPRESSION_NAMES[e.compressionMethod] ?? `Method ${e.compressionMethod}`,
    isExtractable,
    isEncrypted,
  };
}

/** Decompress a ZIP entry. STORE → bytes-as-is; DEFLATE → DecompressionStream. */
export async function decompressEntry(entry: ZipEntry): Promise<Uint8Array> {
  if (!entry.isExtractable) {
    if (entry.isEncrypted) {
      throw new Error(`Cannot extract "${entry.name}": entry is encrypted. Password-protected ZIPs are not supported.`);
    }
    throw new Error(`Cannot extract "${entry.name}": unsupported compression method ${entry.compressionMethod} (${entry.compressionName}).`);
  }
  return decompressEntryBase(entry as BaseZipEntry);
}

/** Check if bytes look like a ZIP archive (PK\x03\x04 signature). */
export function isZipArchive(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

/** Detect if bytes contain an empty ZIP (just the EOCD record). */
export function isEmptyZip(bytes: Uint8Array): boolean {
  // An empty ZIP is just the 22-byte EOCD with no entries.
  // EOCD signature: 0x50 0x4b 0x05 0x06
  return (
    bytes.length >= 22 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x05 &&
    bytes[3] === 0x06
  );
}

// ===== File tree =====

/** Build a file tree from ZIP entries. Directories are inferred from path separators. */
export function buildFileTree(entries: ZipEntry[]): TreeNode {
  const root: TreeNode = { name: "", path: "", isDirectory: true, children: [] };
  for (const entry of entries) {
    const parts = entry.name.split("/").filter((p) => p.length > 0);
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isLast = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");
      // Directory entries end with '/' so the last part is empty
      const isDir = !isLast || entry.name.endsWith("/");
      let child = current.children.find((c) => c.name === part && c.isDirectory === isDir);
      if (!child) {
        child = {
          name: part,
          path,
          isDirectory: isDir,
          children: [],
          entry: isLast && !isDir ? entry : undefined,
        };
        current.children.push(child);
      }
      current = child;
    }
  }
  sortTree(root);
  return root;
}

function sortTree(node: TreeNode) {
  node.children.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const c of node.children) sortTree(c);
}

// ===== Search / filter =====

export function searchEntries(entries: ZipEntry[], query: string): ZipEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) => e.name.toLowerCase().includes(q));
}

const EXT_GROUPS: Record<ExtensionFilter, string[]> = {
  all: [],
  text: [".txt", ".md", ".log", ".csv", ".tsv", ".json", ".xml", ".html", ".htm", ".yaml", ".yml", ".ini", ".cfg", ".rtf"],
  image: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".avif", ".ico", ".tiff"],
  code: [".js", ".mjs", ".ts", ".tsx", ".jsx", ".py", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".hpp", ".cs", ".php", ".sh", ".bat", ".ps1", ".css", ".scss", ".less"],
  audio: [".mp3", ".wav", ".flac", ".ogg", ".aac", ".m4a", ".wma", ".opus"],
  video: [".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv", ".m4v"],
  archive: [".zip", ".tar", ".gz", ".bz2", ".7z", ".rar", ".xz", ".lz", ".lzh"],
  other: [],
};

export function filterByExtension(entries: ZipEntry[], filter: ExtensionFilter): ZipEntry[] {
  if (filter === "all") return entries;
  const exts = EXT_GROUPS[filter];
  if (filter === "other") {
    const allExts = new Set<string>();
    for (const group of Object.values(EXT_GROUPS)) for (const e of group) allExts.add(e);
    return entries.filter((e) => {
      const lower = e.name.toLowerCase();
      const dotIdx = lower.lastIndexOf(".");
      if (dotIdx < 0) return true;
      const ext = lower.slice(dotIdx);
      return !allExts.has(ext);
    });
  }
  return entries.filter((e) => {
    const lower = e.name.toLowerCase();
    return exts.some((ext) => lower.endsWith(ext));
  });
}

/** Get all unique file extensions in the archive, sorted by frequency. */
export function listExtensions(entries: ZipEntry[]): Array<{ ext: string; count: number }> {
  const counts = new Map<string, number>();
  for (const e of entries) {
    const lower = e.name.toLowerCase();
    const dotIdx = lower.lastIndexOf(".");
    const ext = dotIdx >= 0 ? lower.slice(dotIdx) : "(no ext)";
    counts.set(ext, (counts.get(ext) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([ext, count]) => ({ ext, count }))
    .sort((a, b) => b.count - a.count);
}

// ===== Stats =====

export function computeStats(entries: ZipEntry[]): ZipStats {
  let regularFileCount = 0;
  let directoryCount = 0;
  let totalCompressed = 0;
  let totalUncompressed = 0;
  let deflateCount = 0;
  let storeCount = 0;
  let encryptedCount = 0;
  let largestFileName = "";
  let largestFileSize = 0;
  for (const e of entries) {
    if (e.name.endsWith("/")) {
      directoryCount++;
      continue;
    }
    regularFileCount++;
    totalCompressed += e.compressedSize;
    totalUncompressed += e.uncompressedSize;
    if (e.compressionMethod === 0) storeCount++;
    else if (e.compressionMethod === 8) deflateCount++;
    else if (e.compressionMethod === 99) encryptedCount++;
    if (e.uncompressedSize > largestFileSize) {
      largestFileSize = e.uncompressedSize;
      largestFileName = e.name;
    }
  }
  const ratio = totalCompressed > 0 ? totalUncompressed / totalCompressed : 0;
  return {
    entryCount: entries.length,
    regularFileCount,
    directoryCount,
    totalCompressed,
    totalUncompressed,
    ratio,
    deflateCount,
    storeCount,
    encryptedCount,
    largestFileName,
    largestFileSize,
  };
}

// ===== Preview =====

export interface PreviewResult {
  text: string;
  isText: boolean;
  hex: string;
  previewSize: number;
  totalSize: number;
  truncated: boolean;
}

export function previewFile(data: Uint8Array, maxBytes = 8192): PreviewResult {
  const previewSize = Math.min(data.length, maxBytes);
  const slice = data.subarray(0, previewSize);
  const isText = looksLikeText(slice);
  let text = "";
  let hex = "";
  if (isText) {
    text = new TextDecoder("utf-8", { fatal: false }).decode(slice);
  } else {
    const lines: string[] = [];
    for (let i = 0; i < slice.length; i += 16) {
      const lineBytes = slice.subarray(i, Math.min(i + 16, slice.length));
      const hexPart = Array.from(lineBytes).map((b) => b.toString(16).padStart(2, "0")).join(" ");
      const asciiPart = Array.from(lineBytes).map((b) => b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : ".").join("");
      lines.push(`${i.toString(16).padStart(8, "0")}  ${hexPart.padEnd(48, " ")}  ${asciiPart}`);
    }
    hex = lines.join("\n");
  }
  return {
    text,
    isText,
    hex,
    previewSize,
    totalSize: data.length,
    truncated: data.length > maxBytes,
  };
}

export function looksLikeText(bytes: Uint8Array, sampleSize = 1024): boolean {
  const sample = bytes.subarray(0, Math.min(bytes.length, sampleSize));
  if (sample.length === 0) return false;
  let printable = 0;
  for (const b of sample) {
    if (b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b <= 0x7e)) printable++;
  }
  return printable / sample.length > 0.85;
}

// ===== MIME detection =====

export function detectMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".log")) return "text/plain";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".tsv")) return "text/tab-separated-values";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".xml")) return "application/xml";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".css")) return "text/css";
  if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
  if (lower.endsWith(".ts")) return "application/typescript";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".ico")) return "image/x-icon";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".tar")) return "application/x-tar";
  if (lower.endsWith(".gz")) return "application/gzip";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  return "application/octet-stream";
}

// ===== ZIP writer (re-zip extracted files) =====

function crc32Zip(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Build a ZIP archive (STORE method) from extracted files. */
export function createZipBlob(files: Array<{ name: string; data: Uint8Array }>): Blob {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const enc = new TextEncoder();
  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const c = crc32Zip(file.data);
    const size = file.data.length;
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, c, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader);
    localParts.push(file.data);
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, c, true);
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
    offset += localHeader.length + file.data.length;
  }
  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const centralOffset = offset;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
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

/** Build a ZIP from a list of extracted files (re-zip). */
export async function buildZipFromEntries(entries: ZipEntry[]): Promise<Blob> {
  const files: Array<{ name: string; data: Uint8Array }> = [];
  for (const e of entries) {
    if (e.name.endsWith("/") || !e.isExtractable) continue;
    const data = await decompressEntry(e);
    files.push({ name: e.name, data });
  }
  return createZipBlob(files);
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
  return `${value.toFixed(2)}×`;
}

// ===== History (localStorage) =====

const HISTORY_KEY = "unqtools-zip-extractor-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  archiveSize: number;
  entryCount: number;
  regularFileCount: number;
  totalUncompressed: number;
  extractedAt: string;
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

export interface ShareOptions {
  filter: ExtensionFilter;
  search: string;
}

export function buildShareUrl(opts: ShareOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  if (opts.filter !== "all") params.set("filter", opts.filter);
  if (opts.search) params.set("q", opts.search);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareOptions | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("filter") && !params.has("q")) return null;
  const filterRaw = params.get("filter") ?? "all";
  const validFilters: ExtensionFilter[] = ["all", "text", "image", "code", "audio", "video", "archive", "other"];
  return {
    filter: validFilters.includes(filterRaw as ExtensionFilter) ? (filterRaw as ExtensionFilter) : "all",
    search: params.get("q") ?? "",
  };
}
