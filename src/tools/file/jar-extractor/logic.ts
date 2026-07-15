/**
 * JAR Extractor — pure-JS JAR parser.
 *
 * JAR = ZIP archive with META-INF/MANIFEST.MF. We reuse the proven
 * `parseZipEntries` + `decompressEntry` from excel-to-csv-converter.
 *
 * JAR-specific extras:
 *   - Parse META-INF/MANIFEST.MF (RFC 822-style headers with line
 *     continuations: lines starting with a space continue the previous value).
 *   - Detect Main-Class attribute (entry point for `java -jar`).
 *   - Identify .class files (compiled Java bytecode).
 *   - Classify files by type (class, manifest, signature, properties, etc.).
 */

import {
  parseZipEntries as parseZipEntriesBase,
  decompressEntry as decompressEntryBase,
  type ZipEntry as BaseZipEntry,
} from "../excel-to-csv-converter/logic";

// ===== Types =====

export interface JarEntry {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  compressionName: string;
  isExtractable: boolean;
  isEncrypted: boolean;
  jarType: JarFileType;
  bytes: Uint8Array;
  dataOffset: number;
}

export type JarFileType =
  | "manifest"
  | "signature"
  | "class"
  | "properties"
  | "xml"
  | "image"
  | "native-lib"
  | "metadata"
  | "service"
  | "other";

export interface ManifestInfo {
  /** Parsed key-value attributes from MANIFEST.MF. */
  attributes: Record<string, string>;
  /** The Main-Class attribute (entry point), if present. */
  mainClass: string;
  /** The Manifest-Version attribute, if present. */
  manifestVersion: string;
  /** The Created-By attribute, if present. */
  createdBy: string;
  /** The Class-Path attribute (space-separated list of dependency JARs). */
  classPath: string[];
  /** True if the manifest file was found and parsed. */
  manifestFound: boolean;
  /** Per-entry attributes (for entries inside the JAR with their own attributes). */
  entryAttributes: Record<string, Record<string, string>>;
}

export interface JarStats {
  entryCount: number;
  classCount: number;
  resourceCount: number;
  signatureCount: number;
  propertiesCount: number;
  serviceCount: number;
  totalCompressed: number;
  totalUncompressed: number;
  ratio: number;
}

export interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: TreeNode[];
  entry?: JarEntry;
}

export type JarFilter = "all" | "class" | "manifest" | "signature" | "properties" | "xml" | "image";

// ===== Constants =====

const COMPRESSION_NAMES: Record<number, string> = {
  0: "STORE",
  8: "DEFLATE",
  99: "AES encrypted",
};

// ===== ZIP parsing =====

export function parseZipEntries(bytes: Uint8Array): JarEntry[] {
  const baseEntries: BaseZipEntry[] = parseZipEntriesBase(bytes);
  return baseEntries.map((e) => enrichEntry(e));
}

function enrichEntry(e: BaseZipEntry): JarEntry {
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
    jarType: classifyJarFile(e.name),
    bytes: e.bytes,
    dataOffset: e.dataOffset,
  };
}

export function classifyJarFile(name: string): JarFileType {
  const lower = name.toLowerCase();
  if (name === "META-INF/MANIFEST.MF") return "manifest";
  if (lower.startsWith("meta-inf/")) {
    if (lower.endsWith(".sf") || lower.endsWith(".rsa") || lower.endsWith(".dsa") || lower.endsWith(".ec")) return "signature";
    if (lower.startsWith("meta-inf/services/")) return "service";
    return "metadata";
  }
  if (lower.endsWith(".class")) return "class";
  if (lower.endsWith(".properties")) return "properties";
  if (lower.endsWith(".xml")) return "xml";
  if (/\.(png|jpg|jpeg|gif|webp|bmp|svg|avif|ico)$/.test(lower)) return "image";
  if (lower.endsWith(".so") || lower.endsWith(".dll") || lower.endsWith(".dylib")) return "native-lib";
  return "other";
}

export async function decompressEntry(entry: JarEntry): Promise<Uint8Array> {
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

// ===== Manifest parsing =====

/**
 * Parse a MANIFEST.MF file into key-value attributes.
 * Format: RFC 822-style headers. Lines starting with a space continue the
 * previous value. Sections are separated by blank lines.
 */
export function parseManifest(text: string): ManifestInfo {
  const result: ManifestInfo = {
    attributes: {},
    mainClass: "",
    manifestVersion: "",
    createdBy: "",
    classPath: [],
    manifestFound: true,
    entryAttributes: {},
  };
  // Normalize line endings
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  // Reassemble continued lines (lines starting with a space continue the previous)
  const logicalLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (logicalLines.length > 0) {
        logicalLines[logicalLines.length - 1] += line.slice(1);
      }
    } else {
      logicalLines.push(line);
    }
  }
  // Parse each logical line as "Key: Value"
  let currentSectionAttrs: Record<string, string> = result.attributes;
  let currentEntryName: string | null = null;
  let sawBlank = false;
  for (const line of logicalLines) {
    if (line.trim() === "") {
      // Section separator
      sawBlank = true;
      currentEntryName = null;
      continue;
    }
    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (sawBlank) {
      // New section — check if "Name" attribute (per-entry section)
      if (key.toLowerCase() === "name") {
        currentEntryName = value;
        currentEntryAttrs = {};
        result.entryAttributes[value] = currentEntryAttrs;
      } else {
        currentSectionAttrs = currentEntryName ? result.entryAttributes[currentEntryName]! : result.attributes;
        currentSectionAttrs[key] = value;
      }
      sawBlank = false;
    } else {
      currentSectionAttrs[key] = value;
    }
  }
  // Extract well-known attributes
  result.manifestVersion = result.attributes["Manifest-Version"] ?? "";
  result.mainClass = result.attributes["Main-Class"] ?? "";
  result.createdBy = result.attributes["Created-By"] ?? "";
  const classPathRaw = result.attributes["Class-Path"] ?? "";
  result.classPath = classPathRaw.split(/\s+/).filter((s) => s.length > 0);
  return result;
}

// ===== Stats =====

export function computeStats(entries: JarEntry[]): JarStats {
  let classCount = 0;
  let resourceCount = 0;
  let signatureCount = 0;
  let propertiesCount = 0;
  let serviceCount = 0;
  let totalCompressed = 0;
  let totalUncompressed = 0;
  for (const e of entries) {
    if (e.name.endsWith("/")) continue;
    totalCompressed += e.compressedSize;
    totalUncompressed += e.uncompressedSize;
    switch (e.jarType) {
      case "class": classCount++; break;
      case "properties": propertiesCount++; break;
      case "signature": signatureCount++; break;
      case "service": serviceCount++; break;
      case "manifest": case "metadata": break;
      default: resourceCount++; break;
    }
  }
  return {
    entryCount: entries.length,
    classCount,
    resourceCount,
    signatureCount,
    propertiesCount,
    serviceCount,
    totalCompressed,
    totalUncompressed,
    ratio: totalCompressed > 0 ? totalUncompressed / totalCompressed : 0,
  };
}

// ===== File tree =====

export function buildFileTree(entries: JarEntry[]): TreeNode {
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

export function searchEntries(entries: JarEntry[], query: string): JarEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) => e.name.toLowerCase().includes(q));
}

export function filterByType(entries: JarEntry[], filter: JarFilter): JarEntry[] {
  if (filter === "all") return entries;
  return entries.filter((e) => e.jarType === filter);
}

// ===== MIME detection =====

export function detectMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".class")) return "application/x-java-applet";
  if (lower.endsWith(".properties")) return "text/x-java-properties";
  if (lower.endsWith(".xml")) return "application/xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".so")) return "application/x-sharedlib";
  if (lower.endsWith(".dll")) return "application/x-msdownload";
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return "text/plain";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".rsa") || lower.endsWith(".dsa") || lower.endsWith(".ec")) return "application/x-pkcs7";
  if (lower.endsWith(".sf")) return "text/plain";
  return "application/octet-stream";
}

// ===== ZIP writer =====

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

export async function buildZipFromEntries(entries: JarEntry[]): Promise<Blob> {
  const files: Array<{ name: string; data: Uint8Array }> = [];
  for (const e of entries) {
    if (e.name.endsWith("/") || !e.isExtractable) continue;
    const data = await decompressEntry(e);
    files.push({ name: e.name, data });
  }
  return createZipBlob(files);
}

// ===== Top-level JAR parsing =====

export interface JarParseResult {
  fileName: string;
  fileSize: number;
  entries: JarEntry[];
  stats: JarStats;
  manifest: ManifestInfo;
  manifestEntry: JarEntry | null;
}

export async function parseJar(bytes: Uint8Array, fileName: string): Promise<JarParseResult> {
  if (!isZipArchive(bytes)) {
    throw new Error(`${fileName}: not a valid JAR file (missing ZIP signature).`);
  }
  const entries = parseZipEntries(bytes);
  if (entries.length === 0) {
    throw new Error(`${fileName}: JAR archive is empty or could not be parsed.`);
  }
  const stats = computeStats(entries);
  const manifestEntry = entries.find((e) => e.name === "META-INF/MANIFEST.MF") ?? null;
  let manifest: ManifestInfo = {
    attributes: {},
    mainClass: "",
    manifestVersion: "",
    createdBy: "",
    classPath: [],
    manifestFound: false,
    entryAttributes: {},
  };
  if (manifestEntry) {
    try {
      const manifestBytes = await decompressEntry(manifestEntry);
      const manifestText = new TextDecoder("utf-8").decode(manifestBytes);
      manifest = parseManifest(manifestText);
    } catch {
      // Manifest may be DEFLATE-compressed; we tried.
      manifest.manifestFound = true;
    }
  }
  return {
    fileName,
    fileSize: bytes.length,
    entries,
    stats,
    manifest,
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

const HISTORY_KEY = "unqtools-jar-extractor-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  fileSize: number;
  mainClass: string;
  manifestVersion: string;
  classCount: number;
  entryCount: number;
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
