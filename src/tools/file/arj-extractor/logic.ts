/**
 * ARJ Extractor — pure-JS ARJ archive inspector.
 *
 * ARJ format (https://files.programmersheaven.com/.../ARJ_TECH.DOC):
 *   Each archive starts with a main header, followed by per-file headers.
 *   Every header begins with the 2-byte magic 0x60 0xEA.
 *
 * Main archive header layout (after the 2-byte magic):
 *   - 2-byte basic header size (LE)
 *   - 1-byte first header size
 *   - 1-byte archiver version (e.g., 0x06 = 0.06)
 *   - 1-byte min version to extract
 *   - 1-byte host OS (0=MSDOS, 2=UNIX, 3=AMIGA, ...)
 *   - 1-byte archive flags
 *   - 1-byte security version
 *   - 1-byte file type
 *   - 1-byte creator
 *   - 4-byte creation time (DOS format)
 *   - 4-byte modification time
 *   - 4-byte archive size
 *   - 4-byte security envelope offset
 *   - 2-byte filespec position in filename
 *   - 2-byte length of security envelope data
 *   - 4-byte encryption version
 *   - 12-byte comment (last 12 bytes)
 *
 * File header layout (after the 2-byte magic):
 *   - 2-byte basic header size (LE)
 *   - 1-byte first header size
 *   - 1-byte archiver version
 *   - 1-byte min version to extract
 *   - 1-byte host OS
 *   - 1-byte archive flags
 *   - 1-byte method (0=stored, 1=most compressed, 2=compressed, 3=fastest, 4=fastest)
 *   - 1-byte file type (0=binary, 1=text, 2=comment, 3=directory, 4=volume label)
 *   - 4-byte date/time (DOS format)
 *   - 4-byte compressed size
 *   - 4-byte original size
 *   - 4-byte original file CRC32
 *   - 4-byte file spec position in filename
 *   - 2-byte file accessibility mode
 *   - 1-byte host data
 *
 * HONESTY CLAUSE: We parse the ARJ header and list file entries. Method 0
 * (stored) files can be extracted. Methods 1-4 use proprietary dictionary
 * compression; we cannot extract those without a full ARJ decoder. Documented
 * in FAQ.
 */

// ===== Magic =====

export const ARJ_MAGIC1 = 0x60;
export const ARJ_MAGIC2 = 0xea;

// ===== Host OS names =====

const HOST_OS_NAMES: Record<number, string> = {
  0: "MSDOS",
  1: "PRIMOS",
  2: "UNIX",
  3: "AMIGA",
  4: "MAC-OS",
  5: "OS/2",
  6: "APPLE GS",
  7: "ATARI ST",
  8: "NEXT",
  9: "VAX VMS",
  10: "WIN95",
  11: "WIN32",
};

// ===== Compression method names =====

const METHOD_NAMES: Record<number, string> = {
  0: "Stored",
  1: "Most compressed",
  2: "Compressed",
  3: "Fastest",
  4: "Fastest (no CRC)",
};

// ===== Types =====

export interface ArjEntry {
  /** Filename (from header). */
  name: string;
  /** Original (uncompressed) size. */
  originalSize: number;
  /** Compressed size. */
  compressedSize: number;
  /** Compression method (0-4). */
  method: number;
  /** Method name. */
  methodName: string;
  /** CRC32 of original file. */
  crc32: number;
  /** File type (0=binary, 1=text, 3=directory, etc). */
  fileType: number;
  /** True if the entry is a directory. */
  isDirectory: boolean;
  /** True if the entry uses stored method (extractable). */
  isStored: boolean;
  /** DOS-format timestamp. */
  dateTime: number;
  /** Byte offset where compressed file data begins. */
  dataOffset: number;
}

export interface ArjMainHeader {
  /** Archiver version (major.minor as single byte each). */
  archiverVersion: number;
  /** Min version to extract. */
  minVersionToExtract: number;
  /** Host OS code. */
  hostOs: number;
  /** Host OS name. */
  hostOsName: string;
  /** Archive flags. */
  archiveFlags: number;
  /** Creation time (DOS format). */
  creationTime: number;
  /** Modification time (DOS format). */
  modificationTime: number;
  /** Archive size. */
  archiveSize: number;
  /** Comment (if any). */
  comment: string;
}

export interface ArjArchiveInfo {
  /** True if the ARJ magic was found. */
  isValid: boolean;
  /** Main archive header. */
  mainHeader: ArjMainHeader | null;
  /** File entries. */
  entries: ArjEntry[];
  /** File count (excluding directories). */
  fileCount: number;
  /** Directory count. */
  directoryCount: number;
  /** Sum of original sizes. */
  totalOriginalSize: number;
  /** Sum of compressed sizes. */
  totalCompressedSize: number;
  /** True if any entry uses a non-stored compression method. */
  hasCompressedEntries: boolean;
  /** Compression methods used (unique). */
  methods: number[];
  /** Error message if parsing failed. */
  error?: string;
}

// ===== Byte readers =====

function readU16LE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8)) & 0xffff;
}

function readU32LE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16) |
    ((bytes[offset + 3] ?? 0) << 24))
  ) >>> 0;
}

// ===== Magic detection =====

/** Check if bytes start with the ARJ magic 0x60 0xEA. */
export function isArjMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === ARJ_MAGIC1 && bytes[1] === ARJ_MAGIC2;
}

/** Check if bytes look like an ARJ file. */
export function isArjFile(bytes: Uint8Array): boolean {
  return isArjMagic(bytes);
}

// ===== Host OS / method name helpers =====

export function getHostOsName(code: number): string {
  return HOST_OS_NAMES[code] ?? `Unknown (${code})`;
}

export function getMethodName(method: number): string {
  return METHOD_NAMES[method] ?? `Unknown (${method})`;
}

// ===== Header parsing =====

/** Parse the main ARJ archive header. Returns null on error. */
export function parseMainHeader(bytes: Uint8Array): ArjMainHeader | null {
  if (!isArjMagic(bytes)) return null;
  if (bytes.length < 4) return null;
  const basicHeaderSize = readU16LE(bytes, 2);
  if (basicHeaderSize < 10) return null;
  const headerStart = 4;
  if (headerStart + basicHeaderSize > bytes.length) return null;
  const archiverVersion = bytes[headerStart + 1] ?? 0;
  const minVersionToExtract = bytes[headerStart + 2] ?? 0;
  const hostOs = bytes[headerStart + 3] ?? 0;
  const archiveFlags = bytes[headerStart + 4] ?? 0;
  // Skip security version (1), file type (1), creator (1)
  const creationTime = readU32LE(bytes, headerStart + 8);
  const modificationTime = readU32LE(bytes, headerStart + 12);
  const archiveSize = readU32LE(bytes, headerStart + 16);
  // Comment is at the end of the header (last 12 bytes typically)
  const commentEnd = headerStart + basicHeaderSize;
  const commentStart = Math.max(headerStart, commentEnd - 12);
  const commentBytes = bytes.subarray(commentStart, commentEnd);
  const comment = new TextDecoder("utf-8", { fatal: false }).decode(commentBytes).replace(/\0.*$/, "").trim();
  return {
    archiverVersion,
    minVersionToExtract,
    hostOs,
    hostOsName: getHostOsName(hostOs),
    archiveFlags,
    creationTime,
    modificationTime,
    archiveSize,
    comment,
  };
}

/**
 * Parse all file entries in an ARJ archive.
 * Skips the main header, then iterates through file headers.
 */
export function parseFileEntries(bytes: Uint8Array): ArjEntry[] {
  const entries: ArjEntry[] = [];
  if (!isArjMagic(bytes)) return entries;
  // Skip the main header: 2 (magic) + 2 (basic size) + basic size + 4 (CRC)
  if (bytes.length < 4) return entries;
  const mainBasicSize = readU16LE(bytes, 2);
  let pos = 2 + 2 + mainBasicSize + 4; // magic + size + header + CRC
  // Iterate through file headers
  while (pos + 4 < bytes.length) {
    if (bytes[pos] !== ARJ_MAGIC1 || bytes[pos + 1] !== ARJ_MAGIC2) break;
    const basicHeaderSize = readU16LE(bytes, pos + 2);
    if (basicHeaderSize === 0) break; // end-of-archive marker
    if (pos + 4 + basicHeaderSize > bytes.length) break;
    const headerStart = pos + 4;
    const archiverVersion = bytes[headerStart] ?? 0;
    const minVersionToExtract = bytes[headerStart + 1] ?? 0;
    const hostOs = bytes[headerStart + 2] ?? 0;
    const archiveFlags = bytes[headerStart + 3] ?? 0;
    const method = bytes[headerStart + 4] ?? 0;
    const fileType = bytes[headerStart + 5] ?? 0;
    const dateTime = readU32LE(bytes, headerStart + 6);
    const compressedSize = readU32LE(bytes, headerStart + 10);
    const originalSize = readU32LE(bytes, headerStart + 14);
    const crc32 = readU32LE(bytes, headerStart + 18);
    // Skip filespec position (4), accessibility mode (2), host data (1)
    // Then extended filename (variable length, null-terminated)
    let nameStart = headerStart + 25;
    let nameEnd = nameStart;
    while (nameEnd < bytes.length && bytes[nameEnd] !== 0) nameEnd++;
    const name = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(nameStart, nameEnd));
    void archiverVersion; void minVersionToExtract; void hostOs; void archiveFlags;
    // Data begins after: 4-byte CRC of header + extended header (if any)
    let dataOffset = pos + 2 + 2 + basicHeaderSize + 4; // magic + size + header + CRC
    // Check for extended header (4-byte size after header CRC)
    if (dataOffset + 4 <= bytes.length) {
      const extHeaderSize = readU32LE(bytes, dataOffset);
      if (extHeaderSize > 0 && extHeaderSize < 100000) {
        dataOffset += 4 + extHeaderSize + 4; // size + data + CRC
      }
    }
    entries.push({
      name,
      originalSize,
      compressedSize,
      method,
      methodName: getMethodName(method),
      crc32,
      fileType,
      isDirectory: fileType === 3,
      isStored: method === 0,
      dateTime,
      dataOffset,
    });
    // Advance past compressed data
    pos = dataOffset + compressedSize;
    if (pos <= headerStart - 4) break; // sanity check
  }
  return entries;
}

/** Extract data for a stored ARJ entry (method 0). Returns the raw bytes. */
export function extractStoredEntry(bytes: Uint8Array, entry: ArjEntry): Uint8Array | null {
  if (!entry.isStored) return null;
  const end = entry.dataOffset + entry.originalSize;
  if (end > bytes.length) return null;
  return bytes.subarray(entry.dataOffset, end);
}

// ===== Top-level parse =====

/** Parse an ARJ archive. Returns the archive info. */
export function parseArj(bytes: Uint8Array): ArjArchiveInfo {
  if (!isArjMagic(bytes)) {
    return {
      isValid: false, mainHeader: null, entries: [],
      fileCount: 0, directoryCount: 0,
      totalOriginalSize: 0, totalCompressedSize: 0,
      hasCompressedEntries: false, methods: [],
      error: "Not a valid ARJ file (missing 0x60 0xEA magic).",
    };
  }
  const mainHeader = parseMainHeader(bytes);
  const entries = parseFileEntries(bytes);
  let fileCount = 0;
  let directoryCount = 0;
  let totalOriginalSize = 0;
  let totalCompressedSize = 0;
  let hasCompressedEntries = false;
  const methodsSet = new Set<number>();
  for (const e of entries) {
    if (e.isDirectory) {
      directoryCount++;
    } else {
      fileCount++;
      totalOriginalSize += e.originalSize;
      totalCompressedSize += e.compressedSize;
      if (e.method !== 0) hasCompressedEntries = true;
      methodsSet.add(e.method);
    }
  }
  return {
    isValid: true, mainHeader, entries,
    fileCount, directoryCount,
    totalOriginalSize, totalCompressedSize,
    hasCompressedEntries,
    methods: Array.from(methodsSet).sort((a, b) => a - b),
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

const HISTORY_KEY = "unqtools-arj-extractor-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  fileSize: number;
  fileCount: number;
  hasCompressedEntries: boolean;
  inspectedAt: string;
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

export function buildShareUrl(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}`;
}

export function parseShareUrl(hash: string): boolean | null {
  if (!hash || !hash.startsWith("#")) return null;
  return hash === "#inspect";
}
