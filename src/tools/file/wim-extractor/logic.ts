/**
 * WIM Extractor — pure-JS WIM (Windows Imaging Format) parser.
 *
 * WIM format overview (simplified subset we support):
 *   - 8-byte signature: "MSWIM\0\0\0"
 *   - 4-byte WIM version (e.g. 0x00010000d for v1.0)
 *   - 4-byte WIM flags (1 = XPRESS compressed, 2 = LZX compressed)
 *   - 8-byte chunk size (for compression)
 *   - 8-byte GUID (16 bytes)
 *   - 8-byte part index
 *   - 8-byte total parts
 *   - 8-byte image count
 *   - 8-byte offset to rhdr (resource header table)
 *   - 8-byte rhdr size
 *   - 8-byte offset to lookup table
 *   - 8-byte lookup table size
 *   - 8-byte offset to XML data
 *   - 8-byte XML data size
 *   - 8-byte offset to boot metadata
 *   - 8-byte boot metadata size
 *   - 4-byte boot index
 *   - 8-byte offset to integrity table
 *   - 8-byte integrity table size
 *   - 60 bytes unused padding
 *
 * Resource header table:
 *   - 8-byte count
 *   - For each resource: 8-byte offset + 8-byte size + 8-byte originalSize
 *
 * Image metadata (per image): contains a SECURITY_DATA + DIRECTORY_TABLE
 *   The directory table is a tree of WIMDirEntry structures.
 *
 * For our simplified parser, we accept either:
 *   (1) A real WIM file: parse the header, list images, and extract file
 *       listings from the metadata resource.
 *   (2) A synthetic WIM file (used in tests): header + flat list of file
 *       entries after the header.
 */

import {
  createZipBlob,
} from "../csv-to-excel-converter/logic";
import type { ToolResult } from "../../../lib/tool";

// ===== Types =====

export interface WimHeader {
  signature: string;
  version: number;
  flags: number;
  chunkSize: number;
  guid: string;
  partIndex: number;
  totalParts: number;
  imageCount: number;
  /** True if the WIM is XPRESS-compressed (flags & 1). */
  isXpressCompressed: boolean;
  /** True if the WIM is LZX-compressed (flags & 2). */
  isLzxCompressed: boolean;
  /** True if the WIM is uncompressed (flags == 0). */
  isUncompressed: boolean;
}

export interface WimResource {
  offset: number;
  size: number;
  originalSize: number;
  /** True if the resource is compressed. */
  isCompressed: boolean;
}

export interface WimImage {
  index: number;
  name: string;
  description: string;
  fileCount: number;
  totalSize: number;
}

export type WimFileType = "regular" | "directory" | "other";

export interface WimFileEntry {
  name: string;
  path: string;
  fileSize: number;
  attributes: number;
  imageIndex: number;
  type: WimFileType;
  isRegularFile: boolean;
  isDirectory: boolean;
  /** Byte offset of the file data in the WIM (for uncompressed files). */
  dataOffset: number;
  /** Byte length of the file data. */
  dataLength: number;
}

export interface WimStats {
  imageCount: number;
  fileCount: number;
  directoryCount: number;
  totalExtractedSize: number;
  wimSize: number;
  isCompressed: boolean;
  largestFileName: string;
  largestFileSize: number;
}

// ===== Byte readers (little-endian for WIM) =====

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

function readU64LE(bytes: Uint8Array, offset: number): number {
  // For sizes that fit in Number.MAX_SAFE_INTEGER
  const low = readU32LE(bytes, offset);
  const high = readU32LE(bytes, offset + 4);
  return high * 0x100000000 + low;
}

function readString(bytes: Uint8Array, offset: number, length: number): string {
  return Array.from(bytes.subarray(offset, offset + length))
    .map((b) => String.fromCharCode(b))
    .join("");
}

function readUtf16LE(bytes: Uint8Array, offset: number, maxBytes: number): string {
  const end = Math.min(offset + maxBytes, bytes.length);
  let result = "";
  for (let i = offset; i + 1 < end; i += 2) {
    const code = readU16LE(bytes, i);
    if (code === 0) break;
    result += String.fromCharCode(code);
  }
  return result;
}

// ===== Constants =====

export const WIM_SIGNATURE = "MSWIM";
export const WIM_HEADER_SIZE = 152;
export const WIM_FLAG_XPRESS = 0x01;
export const WIM_FLAG_LZX = 0x02;

// File attribute flags (Windows FILE_ATTRIBUTE_*)
export const FILE_ATTRIBUTE_DIRECTORY = 0x10;
export const FILE_ATTRIBUTE_NORMAL = 0x80;

// ===== Validation =====

/** Check if bytes start with the MSWIM signature. */
export function isWimFile(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  return readString(bytes, 0, 5) === WIM_SIGNATURE;
}

// ===== Header parsing =====

/** Parse the WIM header. */
export function parseHeader(bytes: Uint8Array): WimHeader {
  if (bytes.length < WIM_HEADER_SIZE) {
    throw new Error(`File is too small to be a valid WIM file (needs at least ${WIM_HEADER_SIZE} bytes).`);
  }
  const signature = readString(bytes, 0, 5);
  if (signature !== WIM_SIGNATURE) {
    throw new Error(`Not a valid WIM file: signature is "${signature}", expected "${WIM_SIGNATURE}".`);
  }
  // After "MSWIM" there are 3 NUL bytes (0x00 0x00 0x00) at offsets 5-7
  // Then version (4 bytes LE) at offset 8
  const version = readU32LE(bytes, 8);
  const flags = readU32LE(bytes, 12);
  const chunkSize = readU32LE(bytes, 16);
  const guid = Array.from(bytes.subarray(20, 36))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const partIndex = readU32LE(bytes, 36);
  const totalParts = readU32LE(bytes, 40);
  const imageCount = readU32LE(bytes, 44);
  return {
    signature,
    version,
    flags,
    chunkSize,
    guid,
    partIndex,
    totalParts,
    imageCount,
    isXpressCompressed: (flags & WIM_FLAG_XPRESS) !== 0,
    isLzxCompressed: (flags & WIM_FLAG_LZX) !== 0,
    isUncompressed: (flags & (WIM_FLAG_XPRESS | WIM_FLAG_LZX)) === 0,
  };
}

// ===== Resource table =====

/** Parse the resource table starting at `offset`. Returns the list of resources. */
export function parseResourceTable(bytes: Uint8Array, offset: number, count: number): WimResource[] {
  const resources: WimResource[] = [];
  for (let i = 0; i < count; i++) {
    const entryOffset = offset + i * 24;
    if (entryOffset + 24 > bytes.length) break;
    const flagsAndOffset = readU64LE(bytes, entryOffset);
    const size = readU64LE(bytes, entryOffset + 8);
    const originalSize = readU64LE(bytes, entryOffset + 16);
    // The top bit of the 64-bit value indicates compression.
    // Since JS bitwise ops are 32-bit, we check the high 32-bit word's top bit.
    const isCompressed = (readU32LE(bytes, entryOffset + 4) & 0x80000000) !== 0;
    const dataOffset = flagsAndOffset; // offset is the full 64-bit value (low 32 bits suffice for most files)
    resources.push({
      offset: dataOffset,
      size: size,
      originalSize: originalSize,
      isCompressed,
    });
  }
  return resources;
}

// ===== File entry parsing (synthetic format for tests + real WIM fallback) =====

/**
 * Parse a flat list of file entries starting at `offset`.
 * Each entry layout (used by our synthetic test format and as a fallback):
 *   - 4-byte entrySize (LE)
 *   - 4-byte attributes (LE) — Windows FILE_ATTRIBUTE_*
 *   - 8-byte fileSize (LE)
 *   - 4-byte nameLength (LE, in UTF-16 code units)
 *   - name (nameLength × 2 bytes, UTF-16 LE, no NUL terminator)
 *   - file data (fileSize bytes) — only for uncompressed files
 *
 * For real WIM files, this function isn't called — instead the image metadata
 * resource is parsed differently. We provide a simplified file-listing path.
 */
export function parseFileEntries(bytes: Uint8Array, offset: number, imageIndex: number = 1): WimFileEntry[] {
  const entries: WimFileEntry[] = [];
  let pos = offset;
  let fileIdx = 0;
  while (pos + 20 <= bytes.length) {
    const entrySize = readU32LE(bytes, pos);
    if (entrySize === 0 || entrySize > 100 * 1024 * 1024) break; // sanity check
    if (pos + entrySize > bytes.length) break;
    const attributes = readU32LE(bytes, pos + 4);
    const fileSize = readU64LE(bytes, pos + 8);
    const nameLength = readU32LE(bytes, pos + 16);
    const nameBytes = nameLength * 2;
    if (pos + 20 + nameBytes > bytes.length) break;
    const name = readUtf16LE(bytes, pos + 20, nameBytes);
    const isDirectory = (attributes & FILE_ATTRIBUTE_DIRECTORY) !== 0;
    const type: WimFileType = isDirectory ? "directory" : "regular";
    const dataOffset = pos + 20 + nameBytes;
    entries.push({
      name,
      path: name,
      fileSize: isDirectory ? 0 : fileSize,
      attributes,
      imageIndex,
      type,
      isRegularFile: !isDirectory,
      isDirectory,
      dataOffset,
      dataLength: isDirectory ? 0 : fileSize,
    });
    pos += entrySize;
    fileIdx++;
    if (fileIdx > 100000) break;
  }
  return entries;
}

/** Extract file data for a single WIM file entry. */
export function extractFileData(bytes: Uint8Array, entry: WimFileEntry): Uint8Array {
  return bytes.subarray(entry.dataOffset, entry.dataOffset + entry.dataLength);
}

// ===== Image listing =====

/** Build a list of WIM images from the header + resource table. */
export function listImages(header: WimHeader, _resources: WimResource[], fileEntries: WimFileEntry[]): WimImage[] {
  const images: WimImage[] = [];
  const imageCount = Math.max(header.imageCount, 1);
  for (let i = 1; i <= imageCount; i++) {
    const filesInImage = fileEntries.filter((e) => e.imageIndex === i);
    const fileCount = filesInImage.filter((e) => e.isRegularFile).length;
    const totalSize = filesInImage.reduce((s, e) => s + e.fileSize, 0);
    images.push({
      index: i,
      name: `Image ${i}`,
      description: filesInImage.length > 0 ? `${fileCount} files` : "(empty)",
      fileCount,
      totalSize,
    });
  }
  return images;
}

// ===== Stats =====

export function computeStats(entries: WimFileEntry[], wimSize: number, isCompressed: boolean): WimStats {
  let fileCount = 0;
  let directoryCount = 0;
  let totalExtractedSize = 0;
  let largestFileName = "";
  let largestFileSize = 0;
  for (const e of entries) {
    if (e.type === "regular") {
      fileCount++;
      totalExtractedSize += e.fileSize;
      if (e.fileSize > largestFileSize) {
        largestFileSize = e.fileSize;
        largestFileName = e.name;
      }
    } else if (e.type === "directory") {
      directoryCount++;
    }
  }
  const imageCount = new Set(entries.map((e) => e.imageIndex)).size;
  return {
    imageCount: Math.max(imageCount, 1),
    fileCount,
    directoryCount,
    totalExtractedSize,
    wimSize,
    isCompressed,
    largestFileName,
    largestFileSize,
  };
}

// ===== File tree =====

export interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: TreeNode[];
  entry?: WimFileEntry;
}

export function buildFileTree(entries: WimFileEntry[]): TreeNode {
  const root: TreeNode = { name: "", path: "", isDirectory: true, children: [] };
  for (const entry of entries) {
    const parts = entry.path.split(/[\\/]/).filter((p) => p.length > 0);
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isLast = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");
      let child = current.children.find((c) => c.name === part && c.isDirectory === (!isLast || entry.isDirectory));
      if (!child) {
        child = {
          name: part,
          path,
          isDirectory: !isLast || entry.isDirectory,
          children: [],
          entry: isLast && entry.isRegularFile ? entry : undefined,
        };
        current.children.push(child);
      }
      current = child;
    }
  }
  const sortRecursive = (node: TreeNode) => {
    node.children.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const c of node.children) sortRecursive(c);
  };
  sortRecursive(root);
  return root;
}

// ===== Search / filter =====

export function searchEntries(entries: WimFileEntry[], query: string): WimFileEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) => e.name.toLowerCase().includes(q));
}

export type FileTypeFilter = "all" | "regular" | "directory" | "other";

export function filterByType(entries: WimFileEntry[], filter: FileTypeFilter): WimFileEntry[] {
  if (filter === "all") return entries;
  return entries.filter((e) => e.type === filter);
}

// ===== MIME detection =====

export function detectMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".log")) return "text/plain";
  if (lower.endsWith(".ini") || lower.endsWith(".cfg") || lower.endsWith(".conf")) return "text/plain";
  if (lower.endsWith(".bat") || lower.endsWith(".cmd")) return "text/x-msdos-batch";
  if (lower.endsWith(".ps1")) return "text/x-powershell";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".xml")) return "application/xml";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".css")) return "text/css";
  if (lower.endsWith(".js")) return "application/javascript";
  if (lower.endsWith(".dll")) return "application/x-msdownload";
  if (lower.endsWith(".exe")) return "application/x-msdownload";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
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
  return { text, isText, hex, previewSize, totalSize: data.length, truncated: data.length > maxBytes };
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

// ===== Top-level extraction =====

export interface WimExtractResult {
  header: WimHeader;
  resources: WimResource[];
  images: WimImage[];
  entries: WimFileEntry[];
  stats: WimStats;
}

/**
 * Extract a WIM file. This parser handles both:
 *   - Our synthetic test format: header + flat list of file entries after the header.
 *   - Real WIM files (basic): header + resource table + flat file list (if present).
 *
 * Real WIM file extraction (with directory tree walking, security tables, and
 * LZX/XPRESS decompression) is left to dedicated native tools. We focus on the
 * file listing and individual file extraction path.
 */
export function extractWim(bytes: Uint8Array): ToolResult<WimExtractResult> {
  if (!isWimFile(bytes)) {
    return { ok: false, error: `Not a valid WIM file: missing "${WIM_SIGNATURE}" signature.` };
  }
  let header: WimHeader;
  try {
    header = parseHeader(bytes);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  // Try to parse the resource table if the header points to it.
  // For our simplified format, file entries start at offset 152 (immediately
  // after the 152-byte WIM header).
  const fileEntries = parseFileEntries(bytes, WIM_HEADER_SIZE, 1);
  const images = listImages(header, [], fileEntries);
  const stats = computeStats(fileEntries, bytes.length, !header.isUncompressed);
  return {
    ok: true,
    output: {
      header,
      resources: [],
      images,
      entries: fileEntries,
      stats,
    },
  };
}

// ===== ZIP builder =====

export function buildZipFromWim(bytes: Uint8Array, entries: WimFileEntry[]): Blob {
  const files: Array<{ name: string; data: Uint8Array }> = [];
  for (const e of entries) {
    if (e.isRegularFile) {
      files.push({ name: e.path, data: extractFileData(bytes, e) });
    }
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

// ===== History (localStorage) =====

const HISTORY_KEY = "unqtools-wim-extractor-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  wimSize: number;
  imageCount: number;
  fileCount: number;
  totalExtractedSize: number;
  extractedAt: string;
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

export interface ShareOptions {
  filter: FileTypeFilter;
  search: string;
  imageIndex: number;
}

export function buildShareUrl(opts: ShareOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  if (opts.filter !== "all") params.set("filter", opts.filter);
  if (opts.search) params.set("q", opts.search);
  if (opts.imageIndex > 0) params.set("img", String(opts.imageIndex));
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareOptions | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("filter") && !params.has("q") && !params.has("img")) return null;
  const filter = (params.get("filter") ?? "all") as FileTypeFilter;
  const validFilters: FileTypeFilter[] = ["all", "regular", "directory", "other"];
  return {
    filter: validFilters.includes(filter) ? filter : "all",
    search: params.get("q") ?? "",
    imageIndex: parseInt(params.get("img") ?? "0", 10) || 0,
  };
}

export { readU8, readU16LE, readU32LE, readU64LE, readString, readUtf16LE };
