/**
 * RPM Extractor — pure-JS RPM (Red Hat Package Manager) parser + cpio extractor.
 *
 * RPM format:
 *   1. Lead header (96 bytes):
 *      - magic: 0xed 0xab 0xee 0xdb (4 bytes)
 *      - major (1 byte) - usually 3
 *      - minor (1 byte) - usually 0
 *      - type (2 bytes, BE) - 0 = binary, 1 = source
 *      - archnum (2 bytes, BE)
 *      - name (66 bytes, NUL-terminated)
 *      - osnum (2 bytes, BE)
 *      - signature_type (2 bytes, BE) - usually 5
 *      - reserved (16 bytes) - zeros
 *   2. Signature header:
 *      - magic: 0x8e 0xad 0xe8 (3 bytes) + version (1 byte = 1)
 *      - reserved (4 bytes)
 *      - nindex (4 bytes, BE)
 *      - hsize (4 bytes, BE) - data section size
 *      - index entries: 16 bytes each (tag, type, offset, count)
 *      - data store (hsize bytes)
 *      - Padded to 8-byte boundary
 *   3. Regular header (same structure as signature header):
 *      - Contains tags like NAME (1000), VERSION (1001), RELEASE (1002),
 *        SUMMARY (1004), FILENAMES (1027), FILESIZES (1028), etc.
 *   4. Payload (cpio archive, often gzip-compressed)
 *
 * CPIO format (newc, magic "070701"):
 *   Each entry: 110-byte header + filename (NUL-terminated, padded to 4-byte
 *   boundary) + file data (padded to 4-byte boundary).
 *   Trailer: header with name "TRAILER!!!" and zero filesize.
 */

import { decompressGzip, isGzipMagic } from "../gzip-decompressor/logic";
import {
  createZipBlob,
} from "../csv-to-excel-converter/logic";
import type { ToolResult } from "../../../lib/tool";

// ===== Types =====

export interface RpmLead {
  magic: string;
  major: number;
  minor: number;
  type: number;       // 0 = binary, 1 = source
  archnum: number;
  name: string;
  osnum: number;
  signatureType: number;
}

export type RpmTagType = "NULL" | "CHAR" | "INT8" | "INT16" | "INT32" | "INT64" | "STRING" | "BIN" | "STRING_ARRAY" | "I18NSTRING";

export interface RpmIndexEntry {
  tag: number;
  type: number;
  offset: number;
  count: number;
}

export interface RpmHeader {
  magic: string;
  version: number;
  nindex: number;
  hsize: number;
  index: RpmIndexEntry[];
  /** Byte offset where this header's index starts in the RPM file. */
  headerStart: number;
  /** Byte offset where this header's data starts. */
  dataStart: number;
  /** Byte offset where the next header (or payload) starts. */
  nextOffset: number;
}

export interface RpmMetadata {
  name: string;
  version: string;
  release: string;
  summary: string;
  description: string;
  architecture: string;
  os: string;
  license: string;
  group: string;
  vendor: string;
  packager: string;
  url: string;
  /** All filename entries from the regular header. */
  fileNames: string[];
}

export type CpioFileType = "regular" | "directory" | "symlink" | "other";

export interface CpioEntry {
  name: string;
  mode: number;
  fileSize: number;
  uid: number;
  gid: number;
  mtime: number;
  nlink: number;
  type: CpioFileType;
  isRegularFile: boolean;
  /** Byte offset where the file data starts in the cpio archive. */
  dataOffset: number;
}

export interface RpmStats {
  fileCount: number;
  directoryCount: number;
  symlinkCount: number;
  otherCount: number;
  totalExtractedSize: number;
  rpmSize: number;
  payloadCompressed: boolean;
  largestFileName: string;
  largestFileSize: number;
}

// ===== Byte readers (big-endian for RPM) =====

function readU8(bytes: Uint8Array, offset: number): number {
  return bytes[offset] ?? 0;
}

function readU16BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function readU32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

function readString(bytes: Uint8Array, offset: number, length: number): string {
  return Array.from(bytes.subarray(offset, offset + length))
    .map((b) => String.fromCharCode(b))
    .join("");
}

function readCString(bytes: Uint8Array, offset: number, maxLength: number): string {
  const end = Math.min(offset + maxLength, bytes.length);
  let actualEnd = end;
  for (let i = offset; i < end; i++) {
    if (bytes[i] === 0) { actualEnd = i; break; }
  }
  return new TextDecoder("latin1").decode(bytes.subarray(offset, actualEnd)).trim();
}

// ===== Constants =====

export const RPM_LEAD_MAGIC = [0xed, 0xab, 0xee, 0xdb];
export const RPM_HEADER_MAGIC = [0x8e, 0xad, 0xe8];
export const RPM_LEAD_SIZE = 96;
export const CPIO_MAGIC = "070701";

/** RPM regular header tags (from rpmlib.h). */
export const RPM_TAG_NAME = 1000;
export const RPM_TAG_VERSION = 1001;
export const RPM_TAG_RELEASE = 1002;
export const RPM_TAG_SUMMARY = 1004;
export const RPM_TAG_DESCRIPTION = 1005;
export const RPM_TAG_ARCH = 1022;
export const RPM_TAG_OS = 1021;
export const RPM_TAG_LICENSE = 1014;
export const RPM_TAG_GROUP = 1016;
export const RPM_TAG_VENDOR = 1011;
export const RPM_TAG_PACKAGER = 1015;
export const RPM_TAG_URL = 1020;
export const RPM_TAG_FILENAMES = 1027;
export const RPM_TAG_FILESIZES = 1028;
export const RPM_TAG_DIRNAMES = 1116;
export const RPM_TAG_DIRINDEXES = 1116; // alias
export const RPM_TAG_BASENAMES = 1117;

/** RPM tag type IDs. */
export const RPM_TYPE_NULL = 0;
export const RPM_TYPE_CHAR = 1;
export const RPM_TYPE_INT8 = 2;
export const RPM_TYPE_INT16 = 3;
export const RPM_TYPE_INT32 = 4;
export const RPM_TYPE_INT64 = 5;
export const RPM_TYPE_STRING = 6;
export const RPM_TYPE_BIN = 7;
export const RPM_TYPE_STRING_ARRAY = 8;
export const RPM_TYPE_I18NSTRING = 9;

// ===== Validation =====

/** Check if bytes start with the RPM lead magic (ed ab ee db). */
export function isRpmFile(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  return (
    bytes[0] === RPM_LEAD_MAGIC[0] &&
    bytes[1] === RPM_LEAD_MAGIC[1] &&
    bytes[2] === RPM_LEAD_MAGIC[2] &&
    bytes[3] === RPM_LEAD_MAGIC[3]
  );
}

// ===== Lead header =====

/** Parse the 96-byte RPM lead header. */
export function parseLead(bytes: Uint8Array): RpmLead {
  if (bytes.length < RPM_LEAD_SIZE) {
    throw new Error(`File is too small to be a valid RPM file (needs at least ${RPM_LEAD_SIZE} bytes).`);
  }
  if (!isRpmFile(bytes)) {
    throw new Error(`Not a valid RPM file: missing lead magic ed ab ee db.`);
  }
  const major = readU8(bytes, 4);
  const minor = readU8(bytes, 5);
  const type = readU16BE(bytes, 6);
  const archnum = readU16BE(bytes, 8);
  const name = readCString(bytes, 10, 66);
  const osnum = readU16BE(bytes, 76);
  const signatureType = readU16BE(bytes, 78);
  return {
    magic: "ed ab ee db",
    major,
    minor,
    type,
    archnum,
    name,
    osnum,
    signatureType,
  };
}

// ===== Header parsing =====

/**
 * Parse an RPM header (signature or regular) starting at `offset`.
 * Returns the parsed header and the offset of the next header / payload.
 * Headers are padded to 8-byte boundaries.
 */
export function parseHeader(bytes: Uint8Array, offset: number): RpmHeader {
  if (offset + 16 > bytes.length) {
    throw new Error(`RPM header at offset ${offset} is truncated (need at least 16 bytes).`);
  }
  // Magic (3 bytes) + version (1 byte)
  if (
    bytes[offset] !== RPM_HEADER_MAGIC[0] ||
    bytes[offset + 1] !== RPM_HEADER_MAGIC[1] ||
    bytes[offset + 2] !== RPM_HEADER_MAGIC[2]
  ) {
    throw new Error(`Invalid RPM header magic at offset ${offset}: expected 8e ad e8.`);
  }
  const version = readU8(bytes, offset + 3);
  // reserved (4 bytes)
  const nindex = readU32BE(bytes, offset + 8);
  const hsize = readU32BE(bytes, offset + 12);
  if (nindex > 100000) {
    throw new Error(`RPM header at offset ${offset} has unreasonable nindex: ${nindex}.`);
  }
  const headerStart = offset + 16;
  const dataStart = headerStart + nindex * 16;
  const dataEnd = dataStart + hsize;
  const index: RpmIndexEntry[] = [];
  for (let i = 0; i < nindex; i++) {
    const entryOffset = headerStart + i * 16;
    if (entryOffset + 16 > bytes.length) break;
    index.push({
      tag: readU32BE(bytes, entryOffset),
      type: readU32BE(bytes, entryOffset + 4),
      offset: readU32BE(bytes, entryOffset + 8),
      count: readU32BE(bytes, entryOffset + 12),
    });
  }
  // Pad to 8-byte boundary
  const nextOffset = (dataEnd + 7) & ~7;
  return {
    magic: "8e ad e8",
    version,
    nindex,
    hsize,
    index,
    headerStart,
    dataStart,
    nextOffset,
  };
}

/** Read a STRING-typed tag value from the header data section. */
export function readTagString(header: RpmHeader, bytes: Uint8Array, tag: number): string {
  const entry = header.index.find((e) => e.tag === tag);
  if (!entry) return "";
  const offset = header.dataStart + entry.offset;
  if (offset >= bytes.length) return "";
  return readCString(bytes, offset, bytes.length - offset);
}

/** Read a STRING_ARRAY-typed tag value (returns array of strings). */
export function readTagStringArray(header: RpmHeader, bytes: Uint8Array, tag: number): string[] {
  const entry = header.index.find((e) => e.tag === tag);
  if (!entry) return [];
  const result: string[] = [];
  let pos = header.dataStart + entry.offset;
  for (let i = 0; i < entry.count && pos < bytes.length; i++) {
    const end = bytes.indexOf(0, pos);
    const actualEnd = end === -1 ? bytes.length : end;
    result.push(new TextDecoder("latin1").decode(bytes.subarray(pos, actualEnd)));
    pos = actualEnd + 1;
  }
  return result;
}

/** Read an INT32-typed tag value (returns array of numbers). */
export function readTagInt32Array(header: RpmHeader, bytes: Uint8Array, tag: number): number[] {
  const entry = header.index.find((e) => e.tag === tag);
  if (!entry) return [];
  const result: number[] = [];
  let pos = header.dataStart + entry.offset;
  for (let i = 0; i < entry.count && pos + 4 <= bytes.length; i++) {
    result.push(readU32BE(bytes, pos));
    pos += 4;
  }
  return result;
}

// ===== Metadata extraction =====

const EMPTY_METADATA: RpmMetadata = {
  name: "", version: "", release: "", summary: "", description: "",
  architecture: "", os: "", license: "", group: "", vendor: "", packager: "",
  url: "", fileNames: [],
};

/** Extract metadata from the regular header. */
export function extractMetadata(header: RpmHeader, bytes: Uint8Array): RpmMetadata {
  const fileNames = readTagStringArray(header, bytes, RPM_TAG_BASENAMES);
  return {
    name: readTagString(header, bytes, RPM_TAG_NAME),
    version: readTagString(header, bytes, RPM_TAG_VERSION),
    release: readTagString(header, bytes, RPM_TAG_RELEASE),
    summary: readTagString(header, bytes, RPM_TAG_SUMMARY),
    description: readTagString(header, bytes, RPM_TAG_DESCRIPTION),
    architecture: readTagString(header, bytes, RPM_TAG_ARCH),
    os: readTagString(header, bytes, RPM_TAG_OS),
    license: readTagString(header, bytes, RPM_TAG_LICENSE),
    group: readTagString(header, bytes, RPM_TAG_GROUP),
    vendor: readTagString(header, bytes, RPM_TAG_VENDOR),
    packager: readTagString(header, bytes, RPM_TAG_PACKAGER),
    url: readTagString(header, bytes, RPM_TAG_URL),
    fileNames,
  };
}

// ===== CPIO parsing =====

const CPIO_TYPE_MAP: Record<number, CpioFileType> = {
  0o100000: "regular",
  0o040000: "directory",
  0o120000: "symlink",
};

function cpioType(mode: number): CpioFileType {
  const typeBits = mode & 0o170000;
  for (const key of Object.keys(CPIO_TYPE_MAP)) {
    if (Number(key) === typeBits) return CPIO_TYPE_MAP[key]!;
  }
  return "other";
}

function parseHex(bytes: Uint8Array, offset: number, length: number): number {
  let result = 0;
  for (let i = 0; i < length; i++) {
    const b = bytes[offset + i] ?? 0x30;
    const c = String.fromCharCode(b);
    const digit = "0123456789abcdef".indexOf(c.toLowerCase());
    if (digit === -1) return result;
    result = result * 16 + digit;
  }
  return result;
}

/**
 * Parse a cpio (newc format) archive.
 * Returns the list of entries (excluding the TRAILER!!! marker).
 */
export function parseCpio(bytes: Uint8Array): CpioEntry[] {
  const entries: CpioEntry[] = [];
  let pos = 0;
  while (pos + 110 <= bytes.length) {
    const magic = readString(bytes, pos, 6);
    if (magic !== CPIO_MAGIC) break;
    const ino = parseHex(bytes, pos + 6, 8);
    const mode = parseHex(bytes, pos + 14, 8);
    const uid = parseHex(bytes, pos + 22, 8);
    const gid = parseHex(bytes, pos + 30, 8);
    const nlink = parseHex(bytes, pos + 38, 8);
    const mtime = parseHex(bytes, pos + 46, 8);
    const filesize = parseHex(bytes, pos + 54, 8);
    const devmajor = parseHex(bytes, pos + 62, 8);
    const devminor = parseHex(bytes, pos + 70, 8);
    const rdevmajor = parseHex(bytes, pos + 78, 8);
    const rdevminor = parseHex(bytes, pos + 86, 8);
    const namesize = parseHex(bytes, pos + 94, 8);
    const check = parseHex(bytes, pos + 102, 8);
    void ino; void devmajor; void devminor; void rdevmajor; void rdevminor; void check;

    const nameStart = pos + 110;
    const nameEnd = nameStart + namesize - 1; // namesize includes the NUL terminator
    if (nameEnd > bytes.length) break;
    const name = new TextDecoder("latin1").decode(bytes.subarray(nameStart, nameEnd));
    if (name === "TRAILER!!!") break;

    // Pad name to 4-byte boundary (name + NUL, then pad to 4-byte boundary)
    const namePadded = (nameStart + namesize + 3) & ~3;
    const dataOffset = namePadded;
    const dataEnd = dataOffset + filesize;
    const dataPadded = (dataEnd + 3) & ~3;

    const type = cpioType(mode);
    entries.push({
      name,
      mode,
      fileSize: filesize,
      uid,
      gid,
      mtime,
      nlink,
      type,
      isRegularFile: type === "regular",
      dataOffset,
    });
    pos = dataPadded;
  }
  return entries;
}

/** Extract file data for a single cpio entry. */
export function extractCpioEntry(bytes: Uint8Array, entry: CpioEntry): Uint8Array {
  return bytes.subarray(entry.dataOffset, entry.dataOffset + entry.fileSize);
}

// ===== Stats =====

export function computeStats(entries: CpioEntry[], rpmSize: number, payloadCompressed: boolean): RpmStats {
  let fileCount = 0;
  let directoryCount = 0;
  let symlinkCount = 0;
  let otherCount = 0;
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
    } else if (e.type === "symlink") {
      symlinkCount++;
    } else {
      otherCount++;
    }
  }
  return {
    fileCount,
    directoryCount,
    symlinkCount,
    otherCount,
    totalExtractedSize,
    rpmSize,
    payloadCompressed,
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
  entry?: CpioEntry;
}

export function buildFileTree(entries: CpioEntry[]): TreeNode {
  const root: TreeNode = { name: "", path: "", isDirectory: true, children: [] };
  for (const entry of entries) {
    const parts = entry.name.split("/").filter((p) => p.length > 0);
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isLast = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");
      let child = current.children.find((c) => c.name === part && c.isDirectory === (!isLast || entry.type === "directory"));
      if (!child) {
        child = {
          name: part,
          path,
          isDirectory: !isLast || entry.type === "directory",
          children: [],
          entry: isLast && entry.type === "regular" ? entry : undefined,
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

export function searchEntries(entries: CpioEntry[], query: string): CpioEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) => e.name.toLowerCase().includes(q));
}

export type FileTypeFilter = "all" | "regular" | "directory" | "symlink" | "other";

export function filterByType(entries: CpioEntry[], filter: FileTypeFilter): CpioEntry[] {
  if (filter === "all") return entries;
  return entries.filter((e) => e.type === filter);
}

// ===== MIME detection =====

export function detectMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".log")) return "text/plain";
  if (lower.endsWith(".conf") || lower.endsWith(".cfg") || lower.endsWith(".ini")) return "text/plain";
  if (lower.endsWith(".sh") || lower.endsWith(".bash")) return "text/x-shellscript";
  if (lower.endsWith(".py")) return "text/x-python";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".xml")) return "application/xml";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".css")) return "text/css";
  if (lower.endsWith(".js")) return "application/javascript";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".gz")) return "application/gzip";
  if (lower.endsWith(".so") || lower.endsWith(".so.1") || lower.endsWith(".so.2")) return "application/x-sharedlib";
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

export interface RpmExtractResult {
  lead: RpmLead;
  metadata: RpmMetadata;
  payloadCompressed: boolean;
  cpioBytes: Uint8Array;
  entries: CpioEntry[];
  stats: RpmStats;
}

export async function extractRpm(bytes: Uint8Array): Promise<ToolResult<RpmExtractResult>> {
  if (!isRpmFile(bytes)) {
    return { ok: false, error: "Not a valid RPM file: missing lead magic ed ab ee db." };
  }
  let lead: RpmLead;
  let sigHeader: RpmHeader;
  let regHeader: RpmHeader;
  try {
    lead = parseLead(bytes);
    sigHeader = parseHeader(bytes, RPM_LEAD_SIZE);
    regHeader = parseHeader(bytes, sigHeader.nextOffset);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const metadata = extractMetadata(regHeader, bytes);
  let payload = bytes.subarray(regHeader.nextOffset);
  const payloadCompressed = isGzipMagic(payload);
  if (payloadCompressed) {
    try {
      payload = await decompressGzip(payload);
    } catch (e) {
      return { ok: false, error: `Failed to decompress gzip payload: ${(e as Error).message}` };
    }
  }
  const entries = parseCpio(payload);
  const stats = computeStats(entries, bytes.length, payloadCompressed);
  return {
    ok: true,
    output: {
      lead,
      metadata,
      payloadCompressed,
      cpioBytes: payload,
      entries,
      stats,
    },
  };
}

// ===== ZIP builder =====

export function buildZipFromCpio(cpioBytes: Uint8Array, entries: CpioEntry[]): Blob {
  const files: Array<{ name: string; data: Uint8Array }> = [];
  for (const e of entries) {
    if (e.isRegularFile) {
      files.push({ name: e.name, data: extractCpioEntry(cpioBytes, e) });
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

export function formatMode(mode: number): string {
  const octal = (mode & 0o7777).toString(8);
  return "0" + octal.padStart(3, "0");
}

export function formatMtime(seconds: number): string {
  if (seconds === 0) return "—";
  try {
    return new Date(seconds * 1000).toISOString();
  } catch {
    return "—";
  }
}

// ===== History (localStorage) =====

const HISTORY_KEY = "unqtools-rpm-extractor-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  rpmSize: number;
  packageName: string;
  packageVersion: string;
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
  const filter = (params.get("filter") ?? "all") as FileTypeFilter;
  const validFilters: FileTypeFilter[] = ["all", "regular", "directory", "symlink", "other"];
  return {
    filter: validFilters.includes(filter) ? filter : "all",
    search: params.get("q") ?? "",
  };
}
