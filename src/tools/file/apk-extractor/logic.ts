/**
 * APK Extractor — pure-JS APK parser.
 *
 * APK = ZIP archive with a specific structure. We reuse the proven
 * `parseZipEntries` + `decompressEntry` from the excel-to-csv-converter tool
 * to handle ZIP parsing (STORE + DEFLATE via DecompressionStream).
 *
 * APK-specific extras:
 *   - Detect binary AndroidManifest.xml (AXML) by file path.
 *   - Parse the AXML string pool to extract package name, version code/name,
 *     and declared permissions.
 *   - Classify files by type (DEX, resources, native libs, assets, etc.).
 *
 * AXML (Android Binary XML) format:
 *   - Header: magic 0x03 0x00, file size (4 bytes LE).
 *   - String pool chunk: type 0x001C, header size, chunk size, string count,
 *     style count, flags (UTF-8 or UTF-16), strings offset, styles offset.
 *   - String offsets array (string_count * 4 bytes).
 *   - String data (UTF-8 or UTF-16 encoded).
 *   - Resource map chunk (type 0x0180) — array of resource IDs.
 *   - XML tree chunks (type 0x0010 START_NS, 0x0100 START_TAG, etc.).
 *
 * We only parse the string pool — enough to extract the package name, version
 * info, and permissions. Full AXML tree parsing would require ~2x more code.
 */

import {
  parseZipEntries as parseZipEntriesBase,
  decompressEntry as decompressEntryBase,
  type ZipEntry as BaseZipEntry,
} from "../excel-to-csv-converter/logic";

// ===== Types =====

export interface ApkEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  compressionName: string;
  isExtractable: boolean;
  isEncrypted: boolean;
  /** APK-specific file type classification. */
  apkType: ApkFileType;
  /** Raw bytes (for extraction). */
  bytes: Uint8Array;
  dataOffset: number;
}

export type ApkFileType =
  | "manifest"
  | "dex"
  | "resources"
  | "native-lib"
  | "asset"
  | "resource-xml"
  | "resource-image"
  | "signature"
  | "metadata"
  | "unknown";

export interface AppInfo {
  /** Detected package name (e.g. "com.example.myapp"). */
  packageName: string;
  /** Version name (e.g. "1.2.3"). */
  versionName: string;
  /** Version code (integer). */
  versionCode: string;
  /** Min SDK version (Android API level). */
  minSdkVersion: string;
  /** Target SDK version. */
  targetSdkVersion: string;
  /** List of declared permissions (e.g. "android.permission.INTERNET"). */
  permissions: string[];
  /** True if the manifest was found and parsed. */
  manifestFound: boolean;
}

export interface ApkStats {
  entryCount: number;
  totalCompressed: number;
  totalUncompressed: number;
  ratio: number;
  dexCount: number;
  nativeLibCount: number;
  resourceCount: number;
  assetCount: number;
  imageCount: number;
  signatureCount: number;
}

export interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: TreeNode[];
  entry?: ApkEntry;
}

export type ApkFilter = "all" | "dex" | "resources" | "native-lib" | "asset" | "image" | "signature";

// ===== Constants =====

const COMPRESSION_NAMES: Record<number, string> = {
  0: "STORE",
  8: "DEFLATE",
  99: "AES encrypted",
};

// ===== ZIP parsing =====

export function parseZipEntries(bytes: Uint8Array): ApkEntry[] {
  const baseEntries: BaseZipEntry[] = parseZipEntriesBase(bytes);
  return baseEntries.map((e) => enrichEntry(e));
}

function enrichEntry(e: BaseZipEntry): ApkEntry {
  const isEncrypted = e.compressionMethod === 99;
  const isExtractable = e.compressionMethod === 0 || e.compressionMethod === 8;
  return {
    name: e.name,
    compressionMethod: e.compressionMethod,
    compressedSize: e.compressedSize,
    uncompressedSize: e.uncompressedSize,
    compressionName: COMPRESSION_NAMES[e.compressionMethod] ?? `Method ${e.compressionMethod}`,
    isExtractable,
    isEncrypted,
    apkType: classifyApkFile(e.name),
    bytes: e.bytes,
    dataOffset: e.dataOffset,
  };
}

/** Classify an APK file by its path/extension. */
export function classifyApkFile(name: string): ApkFileType {
  const lower = name.toLowerCase();
  if (name === "AndroidManifest.xml") return "manifest";
  if (lower.endsWith(".dex")) return "dex";
  if (lower === "resources.arsc") return "resources";
  if (lower.startsWith("lib/") && (lower.endsWith(".so") || lower.endsWith(".dbg"))) return "native-lib";
  if (lower.startsWith("assets/")) return "asset";
  if (lower.startsWith("meta-inf/")) {
    if (lower.endsWith(".rsa") || lower.endsWith(".dsa") || lower.endsWith(".ec") || lower.endsWith(".sf")) return "signature";
    return "metadata";
  }
  if (lower.startsWith("res/")) {
    if (lower.endsWith(".xml")) return "resource-xml";
    if (/\.(png|jpg|jpeg|gif|webp|bmp|svg|avif)$/.test(lower)) return "resource-image";
    return "resource-xml";
  }
  if (/\.(png|jpg|jpeg|gif|webp|bmp|svg|avif)$/.test(lower)) return "resource-image";
  if (lower.endsWith(".xml")) return "resource-xml";
  return "unknown";
}

export async function decompressEntry(entry: ApkEntry): Promise<Uint8Array> {
  if (!entry.isExtractable) {
    if (entry.isEncrypted) {
      throw new Error(`Cannot extract "${entry.name}": entry is encrypted.`);
    }
    throw new Error(`Cannot extract "${entry.name}": unsupported compression method ${entry.compressionMethod}.`);
  }
  return decompressEntryBase(entry as BaseZipEntry);
}

export function isZipArchive(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

// ===== AXML parsing (binary AndroidManifest.xml) =====

interface AxmlStringPool {
  strings: string[];
  isUtf8: boolean;
}

/** Parse the string pool chunk of a binary AXML file. */
export function parseAxmlStringPool(bytes: Uint8Array): AxmlStringPool {
  // Header: magic (2 bytes) = 0x03 0x00, filesize (4 bytes)
  if (bytes.length < 8 || bytes[0] !== 0x03 || bytes[1] !== 0x00) {
    return { strings: [], isUtf8: false };
  }
  // First chunk header: type (2 bytes), header size (2 bytes), chunk size (4 bytes)
  // For string pool: string count (4), style count (4), flags (4), strings offset (4), styles offset (4)
  if (bytes.length < 28) return { strings: [], isUtf8: false };
  const chunkType = readU16(bytes, 8);
  if (chunkType !== 0x0001) return { strings: [], isUtf8: false };
  const headerSize = readU16(bytes, 10);
  const stringCount = readU32(bytes, 16);
  const flags = readU32(bytes, 24);
  const stringsOffset = readU32(bytes, 28);
  const isUtf8 = (flags & 0x100) !== 0;
  // String offsets array starts at headerSize, each entry 4 bytes
  const offsetsBase = headerSize;
  const stringsBase = stringsOffset;
  const strings: string[] = [];
  for (let i = 0; i < stringCount && i < 100000; i++) {
    const off = readU32(bytes, offsetsBase + i * 4);
    const strStart = stringsBase + off;
    if (strStart >= bytes.length) {
      strings.push("");
      continue;
    }
    if (isUtf8) {
      // UTF-8: 2 length bytes (chars, then bytes — each varint, but most files use single-byte lengths)
      let len = bytes[strStart]!;
      let charsLen = len;
      let byteStart = strStart + 1;
      if (len & 0x80) {
        charsLen = ((len & 0x7f) << 8) | (bytes[strStart + 1]!);
        byteStart = strStart + 2;
      }
      // Then byte length
      let byteLen = bytes[byteStart]!;
      let dataStart = byteStart + 1;
      if (byteLen & 0x80) {
        byteLen = ((byteLen & 0x7f) << 8) | (bytes[byteStart + 1]!);
        dataStart = byteStart + 2;
      }
      void charsLen;
      const strBytes = bytes.subarray(dataStart, dataStart + byteLen);
      strings.push(new TextDecoder("utf-8").decode(strBytes));
    } else {
      // UTF-16: 2 length bytes (u16)
      let len = readU16(bytes, strStart);
      let dataStart = strStart + 2;
      if (len & 0x8000) {
        len = ((len & 0x7fff) << 16) | readU16(bytes, strStart + 2);
        dataStart = strStart + 4;
      }
      const strBytes = bytes.subarray(dataStart, dataStart + len * 2);
      strings.push(new TextDecoder("utf-16le").decode(strBytes));
    }
  }
  return { strings, isUtf8 };
}

function readU16(bytes: Uint8Array, offset: number): number {
  if (offset + 2 > bytes.length) return 0;
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
  if (offset + 4 > bytes.length) return 0;
  return (
    (bytes[offset]!) |
    (bytes[offset + 1]! << 8) |
    (bytes[offset + 2]! << 16) |
    (bytes[offset + 3]! << 24)
  ) >>> 0;
}

/** Detect if bytes look like binary AXML (magic 0x03 0x00). */
export function isBinaryXml(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x03 && bytes[1] === 0x00;
}

/** Parse app info from a binary AndroidManifest.xml. */
export function parseAppInfoFromManifest(manifestBytes: Uint8Array): AppInfo {
  const empty: AppInfo = {
    packageName: "",
    versionName: "",
    versionCode: "",
    minSdkVersion: "",
    targetSdkVersion: "",
    permissions: [],
    manifestFound: false,
  };
  if (!isBinaryXml(manifestBytes)) return empty;
  const { strings } = parseAxmlStringPool(manifestBytes);
  if (strings.length === 0) return { ...empty, manifestFound: true };

  // Find package name: it's a string that matches /^com\./ or has dots and is in the manifest tag
  const packagePattern = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i;
  const candidatePackages = strings.filter((s) => packagePattern.test(s) && s.length < 200);
  // The package name is typically the first string matching this pattern
  // that's NOT a permission (which starts with android.permission.)
  const packageName = candidatePackages.find((s) => !s.startsWith("android.permission.")) ?? "";

  // Permissions: all strings starting with "android.permission." or matching a permission pattern
  const permissions = Array.from(new Set(
    strings.filter((s) => s.startsWith("android.permission.") || s.startsWith("com.android.permission.")),
  )).sort();

  // Version info: harder to extract reliably without parsing the XML tree.
  // We try to find versionName (a string like "1.0.0") and versionCode (a numeric string).
  const versionNamePattern = /^\d+\.\d+(\.\d+)?([.-][a-zA-Z0-9]+)?$/;
  const versionName = strings.find((s) => versionNamePattern.test(s) && s.length < 30) ?? "";

  return {
    packageName,
    versionName,
    versionCode: "", // Would require parsing the XML attributes — left empty.
    minSdkVersion: "",
    targetSdkVersion: "",
    permissions,
    manifestFound: true,
  };
}

// ===== Stats =====

export function computeStats(entries: ApkEntry[]): ApkStats {
  let totalCompressed = 0;
  let totalUncompressed = 0;
  let dexCount = 0;
  let nativeLibCount = 0;
  let resourceCount = 0;
  let assetCount = 0;
  let imageCount = 0;
  let signatureCount = 0;
  for (const e of entries) {
    if (e.name.endsWith("/")) continue;
    totalCompressed += e.compressedSize;
    totalUncompressed += e.uncompressedSize;
    switch (e.apkType) {
      case "dex": dexCount++; break;
      case "native-lib": nativeLibCount++; break;
      case "resources":
      case "resource-xml": resourceCount++; break;
      case "asset": assetCount++; break;
      case "resource-image": imageCount++; break;
      case "signature": signatureCount++; break;
    }
  }
  return {
    entryCount: entries.length,
    totalCompressed,
    totalUncompressed,
    ratio: totalCompressed > 0 ? totalUncompressed / totalCompressed : 0,
    dexCount,
    nativeLibCount,
    resourceCount,
    assetCount,
    imageCount,
    signatureCount,
  };
}

// ===== File tree =====

export function buildFileTree(entries: ApkEntry[]): TreeNode {
  const root: TreeNode = { name: "", path: "", isDirectory: true, children: [] };
  for (const entry of entries) {
    const parts = entry.name.split("/").filter((p) => p.length > 0);
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isLast = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");
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

export function searchEntries(entries: ApkEntry[], query: string): ApkEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) => e.name.toLowerCase().includes(q));
}

export function filterByType(entries: ApkEntry[], filter: ApkFilter): ApkEntry[] {
  if (filter === "all") return entries;
  if (filter === "image") return entries.filter((e) => e.apkType === "resource-image");
  if (filter === "signature") return entries.filter((e) => e.apkType === "signature");
  return entries.filter((e) => e.apkType === filter);
}

// ===== MIME detection =====

export function detectMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".dex")) return "application/x-dex";
  if (lower.endsWith(".arsc")) return "application/x-android-resources";
  if (lower.endsWith(".so")) return "application/x-sharedlib";
  if (lower.endsWith(".xml")) return "application/xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return "text/plain";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".rsa") || lower.endsWith(".dsa") || lower.endsWith(".ec")) return "application/x-pkcs7";
  if (lower.endsWith(".sf")) return "text/plain";
  if (lower.endsWith(".mf")) return "text/plain";
  return "application/octet-stream";
}

// ===== ZIP writer (re-zip extracted files) =====

function crc32Zip(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

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
    lv.setUint16(8, 0, true);
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
    cv.setUint32(16, c, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
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
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  const all = [...localParts, ...centralParts, eocd];
  const total = all.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of all) { out.set(p, pos); pos += p.length; }
  return new Blob([out as BlobPart], { type: "application/zip" });
}

export async function buildZipFromEntries(entries: ApkEntry[]): Promise<Blob> {
  const files: Array<{ name: string; data: Uint8Array }> = [];
  for (const e of entries) {
    if (e.name.endsWith("/") || !e.isExtractable) continue;
    const data = await decompressEntry(e);
    files.push({ name: e.name, data });
  }
  return createZipBlob(files);
}

// ===== Top-level APK parsing =====

export interface ApkParseResult {
  fileName: string;
  fileSize: number;
  entries: ApkEntry[];
  stats: ApkStats;
  appInfo: AppInfo;
  /** The AndroidManifest.xml entry, if found. */
  manifestEntry: ApkEntry | null;
}

export async function parseApk(bytes: Uint8Array, fileName: string): Promise<ApkParseResult> {
  if (!isZipArchive(bytes)) {
    throw new Error(`${fileName}: not a valid APK file (missing ZIP signature).`);
  }
  const entries = parseZipEntries(bytes);
  if (entries.length === 0) {
    throw new Error(`${fileName}: APK archive is empty or could not be parsed.`);
  }
  const stats = computeStats(entries);
  // Find and parse AndroidManifest.xml
  const manifestEntry = entries.find((e) => e.name === "AndroidManifest.xml") ?? null;
  let appInfo: AppInfo = {
    packageName: "",
    versionName: "",
    versionCode: "",
    minSdkVersion: "",
    targetSdkVersion: "",
    permissions: [],
    manifestFound: false,
  };
  if (manifestEntry) {
    try {
      const manifestBytes = await decompressEntry(manifestEntry);
      appInfo = parseAppInfoFromManifest(manifestBytes);
    } catch {
      // Manifest may be DEFLATE-compressed; we tried.
      appInfo.manifestFound = true;
    }
  }
  return {
    fileName,
    fileSize: bytes.length,
    entries,
    stats,
    appInfo,
    manifestEntry,
  };
}

// ===== Utilities =====

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatRatio(value: number): string {
  return `${value.toFixed(2)}×`;
}

// ===== History (localStorage) =====

const HISTORY_KEY = "unqtools-apk-extractor-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  fileSize: number;
  packageName: string;
  versionName: string;
  entryCount: number;
  permissionCount: number;
  inspectedAt: string;
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
