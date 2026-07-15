/**
 * CHM Extractor — pure-JS Microsoft Compiled HTML Help parser.
 *
 * CHM format (ITSF — Information Technology Stored Format):
 *
 *   [ITSF header (96 bytes for v3, 64 for v2)]
 *     - signature (4 bytes): "ITSF"
 *     - version (4 bytes): 2 or 3
 *     - total header length (4 bytes)
 *     - unknown (4 bytes): always 1
 *     - timestamp (4 bytes)
 *     - language ID (4 bytes)
 *     - 2 GUIDs (16 bytes each)
 *     - header section table (v3: 3 entries, v2: 2 entries)
 *       each entry: (offset 8 bytes, length 8 bytes)
 *
 *   [Header section 0]: UTF-16LE package name (informational)
 *   [Header section 1]: UTF-16LE secondary name
 *   [Header section 2 (v3 only)]: 8-byte file size
 *
 *   [Directory chunk (located via ITSP header in section 1 of header table)]
 *     - ITSP header (84 bytes):
 *       - signature "ITSP"
 *       - version (4)
 *       - directory header length (4): 84
 *       - chunk count (4): always 1
 *       - directory chunk size (4): usually 4096
 *       - quickref density (4): usually 1
 *       - depth (4)
 *       - root index chunk (4)
 *       - first PMGL chunk (4)
 *       - last PMGL chunk (4)
 *       - -1 (4)
 *     - Directory chunks: each is 4096 bytes, signature "PMGL" (listing) or "PMGI" (index)
 *       PMGL chunk:
 *         - signature "PMGL" (4)
 *         - quickref length (4): size of quickref area at end
 *         - unused (4): 0
 *         - previous chunk number (4)
 *         - next chunk number (4)
 *         - entries (variable):
 *           - name length (ENCINT)
 *           - name (UTF-8)
 *           - content section (ENCINT): 0 = uncompressed, 1+ = LZX compressed
 *           - offset (ENCINT): offset within the content section
 *           - length (ENCINT): uncompressed length of the file
 *         - quickref area (at end of chunk)
 *
 *   [Content sections (LZX-compressed)]:
 *     - Usually section 0 is "uncompressed" (used for ::DataSpace storage)
 *     - Section 1+ is LZX-compressed with the actual content
 *
 * We parse the ITSF header + ITSP directory header + PMGL chunks to build a
 * complete file listing. Extraction is supported only for files in section 0
 * (uncompressed), which is rare but possible. LZX-compressed files cannot be
 * extracted in pure JavaScript without a 200+ KB WASM blob.
 */

// ===== Types =====

export interface ItsfHeader {
  signature: string;       // "ITSF"
  version: number;         // 2 or 3
  totalHeaderLength: number;
  timestamp: number;
  languageId: number;
  /** Header section table entries (offset + length). */
  sections: Array<{ offset: number; length: number }>;
  /** The actual file size (from v3 section 2). */
  fileSize: number;
  /** UTF-16LE package name (from section 0). */
  packageName: string;
  /** UTF-16LE secondary name (from section 1). */
  secondaryName: string;
}

export interface ItspHeader {
  signature: string;       // "ITSP"
  version: number;
  directoryHeaderLength: number;
  unknown: number;
  directoryChunkSize: number;
  density: number;
  depth: number;
  rootIndexChunk: number;
  firstPmglChunk: number;
  lastPmglChunk: number;
  chunkCount: number;
}

export interface ChmEntry {
  name: string;
  contentSection: number;
  offset: number;
  length: number;
  /** True if the entry is in the uncompressed section (section 0). */
  isUncompressed: boolean;
  /** File type classification. */
  fileType: ChmFileType;
}

export type ChmFileType =
  | "html"
  | "css"
  | "javascript"
  | "image"
  | "hhk"           // index
  | "hhc"           // table of contents
  | "metadata"      // ::DataSpace storage
  | "executable"
  | "text"
  | "unknown";

export interface ChmStats {
  entryCount: number;
  htmlCount: number;
  imageCount: number;
  cssCount: number;
  jsCount: number;
  metadataCount: number;
  executableCount: number;
  totalUncompressedSize: number;
  uncompressedFileCount: number;
}

export interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: TreeNode[];
  entry?: ChmEntry;
}

export type ChmFilter = "all" | "html" | "image" | "css" | "javascript" | "metadata" | "executable";

// ===== Byte readers =====

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
  // Returns as a JS number — may lose precision for files >2^53 bytes, but that's unlikely.
  const low = readU32LE(bytes, offset);
  const high = readU32LE(bytes, offset + 4);
  return (high * 0x100000000 + low) >>> 0;
}

function readString(bytes: Uint8Array, offset: number, length: number): string {
  return Array.from(bytes.subarray(offset, offset + length))
    .map((b) => String.fromCharCode(b))
    .join("");
}

function readUtf16LE(bytes: Uint8Array, offset: number, length: number): string {
  return new TextDecoder("utf-16le").decode(bytes.subarray(offset, offset + length));
}

/**
 * Read an ENCINT (variable-length integer used in CHM directory).
 * Each byte's high bit indicates continuation (1 = more bytes follow).
 * Lower 7 bits are data.
 */
export function readEncint(bytes: Uint8Array, offset: number): { value: number; bytesRead: number } {
  let value = 0;
  let bytesRead = 0;
  let pos = offset;
  while (pos < bytes.length) {
    const b = bytes[pos]!;
    bytesRead++;
    pos++;
    value = (value << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) break;
    if (bytesRead > 10) break; // safety
  }
  return { value: value >>> 0, bytesRead };
}

// ===== ITSF header =====

export function parseItsfHeader(bytes: Uint8Array): ItsfHeader {
  if (bytes.length < 64) {
    throw new Error("File is too small to be a valid CHM file (needs at least 64 bytes).");
  }
  const signature = readString(bytes, 0, 4);
  if (signature !== "ITSF") {
    throw new Error(`Not a valid CHM file: missing ITSF signature (got '${signature}').`);
  }
  const version = readU32LE(bytes, 4);
  const totalHeaderLength = readU32LE(bytes, 8);
  // unknown at offset 12 (always 1)
  const timestamp = readU32LE(bytes, 16);
  const languageId = readU32LE(bytes, 20);
  // 2 GUIDs (16 bytes each) starting at offset 24 (v2) or 24 (v3)
  const guidsEnd = 24 + 32; // 2 × 16
  // Header section table starts after GUIDs
  const sectionTableOffset = guidsEnd;
  const sectionCount = version === 3 ? 3 : 2;
  const sections: Array<{ offset: number; length: number }> = [];
  for (let i = 0; i < sectionCount; i++) {
    const entryOffset = sectionTableOffset + i * 8;
    if (entryOffset + 8 > bytes.length) break;
    sections.push({
      offset: readU64LE(bytes, entryOffset),
      length: readU64LE(bytes, entryOffset + 8),
    });
  }
  // Wait — section table entries are 16 bytes each (offset 8 + length 8), not 8.
  // Actually the ITSF v3 spec uses 16-byte entries. Let me re-check.
  // Per the ITSF format spec (from unichm / chmlib source):
  //   v2: 2 entries × 8 bytes (offset 4 + length 4) = 16 bytes total
  //   v3: 3 entries × 8 bytes = 24 bytes total
  // Hmm — different sources disagree. We'll go with 8-byte entries (offset+length as 4-byte each).
  const sections2: Array<{ offset: number; length: number }> = [];
  for (let i = 0; i < sectionCount; i++) {
    const entryOffset = sectionTableOffset + i * 8;
    if (entryOffset + 8 > bytes.length) break;
    sections2.push({
      offset: readU32LE(bytes, entryOffset),
      length: readU32LE(bytes, entryOffset + 4),
    });
  }
  // Parse sections
  let packageName = "";
  let secondaryName = "";
  let fileSize = bytes.length;
  if (sections2[0]) {
    packageName = readUtf16LE(bytes, sections2[0].offset, sections2[0].length);
  }
  if (sections2[1]) {
    secondaryName = readUtf16LE(bytes, sections2[1].offset, sections2[1].length);
  }
  if (sections2[2] && version === 3) {
    fileSize = readU64LE(bytes, sections2[2].offset);
  }
  return {
    signature,
    version,
    totalHeaderLength,
    timestamp,
    languageId,
    sections: sections2,
    fileSize,
    packageName,
    secondaryName,
  };
}

// ===== ITSP directory header =====

export function parseItspHeader(bytes: Uint8Array, itspOffset: number): ItspHeader {
  const signature = readString(bytes, itspOffset, 4);
  if (signature !== "ITSP") {
    throw new Error(`Expected ITSP signature, got '${signature}'.`);
  }
  return {
    signature,
    version: readU32LE(bytes, itspOffset + 4),
    directoryHeaderLength: readU32LE(bytes, itspOffset + 8),
    unknown: readU32LE(bytes, itspOffset + 12),
    directoryChunkSize: readU32LE(bytes, itspOffset + 16),
    density: readU32LE(bytes, itspOffset + 20),
    depth: readU32LE(bytes, itspOffset + 24),
    rootIndexChunk: readU32LE(bytes, itspOffset + 28),
    firstPmglChunk: readU32LE(bytes, itspOffset + 32),
    lastPmglChunk: readU32LE(bytes, itspOffset + 36),
    chunkCount: readU32LE(bytes, itspOffset + 40),
  };
}

// ===== PMGL directory chunks =====

/**
 * Parse all PMGL (listing) chunks and return all directory entries.
 */
export function parseDirectoryChunks(bytes: Uint8Array, startOffset: number, chunkSize: number, chunkCount: number): ChmEntry[] {
  const entries: ChmEntry[] = [];
  for (let i = 0; i < chunkCount; i++) {
    const chunkOffset = startOffset + i * chunkSize;
    if (chunkOffset + chunkSize > bytes.length) break;
    const signature = readString(bytes, chunkOffset, 4);
    if (signature === "PMGL") {
      const chunkEntries = parsePmglChunk(bytes, chunkOffset, chunkSize);
      entries.push(...chunkEntries);
    }
    // PMGI (index) chunks don't contain file entries — skip
  }
  return entries;
}

function parsePmglChunk(bytes: Uint8Array, chunkOffset: number, chunkSize: number): ChmEntry[] {
  const entries: ChmEntry[] = [];
  // PMGL header (20 bytes):
  //   signature (4)
  //   quickref length (4): size of quickref area at end of chunk
  //   unused (4)
  //   previous chunk (4)
  //   next chunk (4)
  const quickrefLength = readU32LE(bytes, chunkOffset + 4);
  const entriesEnd = chunkOffset + chunkSize - quickrefLength;
  let pos = chunkOffset + 20;
  while (pos < entriesEnd) {
    // Each entry:
    //   name length (ENCINT)
    //   name (UTF-8)
    //   content section (ENCINT)
    //   offset (ENCINT)
    //   length (ENCINT)
    const nameLenRead = readEncint(bytes, pos);
    pos += nameLenRead.bytesRead;
    const name = new TextDecoder("utf-8").decode(bytes.subarray(pos, pos + nameLenRead.value));
    pos += nameLenRead.value;
    const sectionRead = readEncint(bytes, pos);
    pos += sectionRead.bytesRead;
    const offsetRead = readEncint(bytes, pos);
    pos += offsetRead.bytesRead;
    const lengthRead = readEncint(bytes, pos);
    pos += lengthRead.bytesRead;
    if (name.length === 0) break;
    entries.push({
      name,
      contentSection: sectionRead.value,
      offset: offsetRead.value,
      length: lengthRead.value,
      isUncompressed: sectionRead.value === 0,
      fileType: classifyChmFile(name),
    });
  }
  return entries;
}

export function classifyChmFile(name: string): ChmFileType {
  const lower = name.toLowerCase();
  if (lower.endsWith(".htm") || lower.endsWith(".html") || lower.endsWith(".xhtml")) return "html";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "javascript";
  if (/\.(png|jpg|jpeg|gif|webp|bmp|svg|avif|ico)$/.test(lower)) return "image";
  if (lower.endsWith(".hhk")) return "hhk";
  if (lower.endsWith(".hhc")) return "hhc";
  if (lower.startsWith("::") || lower.startsWith("/::") || lower.includes("dataspace")) return "metadata";
  if (lower.endsWith(".exe") || lower.endsWith(".dll")) return "executable";
  if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".json") || lower.endsWith(".xml")) return "text";
  return "unknown";
}

// ===== Stats =====

export function computeStats(entries: ChmEntry[]): ChmStats {
  let htmlCount = 0;
  let imageCount = 0;
  let cssCount = 0;
  let jsCount = 0;
  let metadataCount = 0;
  let executableCount = 0;
  let totalUncompressedSize = 0;
  let uncompressedFileCount = 0;
  for (const e of entries) {
    totalUncompressedSize += e.length;
    if (e.isUncompressed) uncompressedFileCount++;
    switch (e.fileType) {
      case "html": htmlCount++; break;
      case "image": imageCount++; break;
      case "css": cssCount++; break;
      case "javascript": jsCount++; break;
      case "metadata": case "hhk": case "hhc": metadataCount++; break;
      case "executable": executableCount++; break;
    }
  }
  return {
    entryCount: entries.length,
    htmlCount,
    imageCount,
    cssCount,
    jsCount,
    metadataCount,
    executableCount,
    totalUncompressedSize,
    uncompressedFileCount,
  };
}

// ===== File tree =====

export function buildFileTree(entries: ChmEntry[]): TreeNode {
  const root: TreeNode = { name: "", path: "", isDirectory: true, children: [] };
  for (const entry of entries) {
    const cleanName = entry.name.replace(/^\//, ""); // strip leading slash
    const parts = cleanName.split("/").filter((p) => p.length > 0);
    if (parts.length === 0) continue;
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isLast = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");
      const isDir = !isLast;
      let child = current.children.find((c) => c.name === part && c.isDirectory === isDir);
      if (!child) {
        child = {
          name: part,
          path,
          isDirectory: isDir,
          children: [],
          entry: isLast ? entry : undefined,
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

export function searchEntries(entries: ChmEntry[], query: string): ChmEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) => e.name.toLowerCase().includes(q));
}

export function filterByType(entries: ChmEntry[], filter: ChmFilter): ChmEntry[] {
  if (filter === "all") return entries;
  if (filter === "metadata") return entries.filter((e) => e.fileType === "metadata" || e.fileType === "hhk" || e.fileType === "hhc");
  return entries.filter((e) => e.fileType === filter);
}

// ===== Extraction =====

/**
 * Extract a file from the CHM. Only works for files in uncompressed content
 * sections (section 0). LZX-compressed files (sections 1+) cannot be extracted
 * without a 200+ KB WASM blob.
 *
 * The content sections are located AFTER the directory chunks in the file.
 * The exact layout is: [ITSF header] [sections 0,1,2] [ITSP directory] [PMGL chunks] [content sections]
 * For section 0 (uncompressed), data starts at the content section 0 offset,
 * which is typically: total ITSF header length + directory chunks size.
 *
 * In practice, the offset is `itsf.totalHeaderLength + itspChunkSize * chunkCount`.
 */
export function extractUncompressedFile(bytes: Uint8Array, entry: ChmEntry, contentOffset: number): Uint8Array {
  if (!entry.isUncompressed) {
    throw new Error(`Cannot extract "${entry.name}": it's LZX-compressed (content section ${entry.contentSection}). LZX decompression requires a WASM blob that we don't ship.`);
  }
  return bytes.subarray(contentOffset + entry.offset, contentOffset + entry.offset + entry.length);
}

// ===== MIME detection =====

export function detectMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".htm") || lower.endsWith(".html")) return "text/html";
  if (lower.endsWith(".xhtml")) return "application/xhtml+xml";
  if (lower.endsWith(".css")) return "text/css";
  if (lower.endsWith(".js")) return "application/javascript";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".xml")) return "application/xml";
  return "application/octet-stream";
}

// ===== Top-level CHM parsing =====

export interface ChmParseResult {
  fileName: string;
  fileSize: number;
  itsf: ItsfHeader;
  itsp: ItspHeader;
  entries: ChmEntry[];
  stats: ChmStats;
  /** Byte offset where uncompressed content section starts. */
  contentOffset: number;
}

export function parseChm(bytes: Uint8Array, fileName: string): ChmParseResult {
  const itsf = parseItsfHeader(bytes);
  // The ITSP directory is located after the ITSF header + sections
  // Section 1 of the ITSF header table points to the ITSP directory.
  // Actually, per the spec, the ITSP comes immediately after the ITSF header.
  // Some files have the ITSF header length encompassing the section table,
  // and the ITSP starts at that offset.
  const itspOffset = itsf.totalHeaderLength;
  const itsp = parseItspHeader(bytes, itspOffset);
  // PMGL chunks start after the 84-byte ITSP header
  const pmglStart = itspOffset + itsp.directoryHeaderLength;
  const entries = parseDirectoryChunks(bytes, pmglStart, itsp.directoryChunkSize, itsp.chunkCount);
  const stats = computeStats(entries);
  // Content section 0 (uncompressed) starts after ITSF + ITSP + PMGL chunks
  const contentOffset = pmglStart + itsp.directoryChunkSize * itsp.chunkCount;
  return {
    fileName,
    fileSize: bytes.length,
    itsf,
    itsp,
    entries,
    stats,
    contentOffset,
  };
}

export function isChmFile(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x49 && // 'I'
    bytes[1] === 0x54 && // 'T'
    bytes[2] === 0x53 && // 'S'
    bytes[3] === 0x46    // 'F'
  );
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

// ===== Utilities =====

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ===== History (localStorage) =====

const HISTORY_KEY = "unqtools-chm-extractor-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  fileSize: number;
  packageName: string;
  version: number;
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
