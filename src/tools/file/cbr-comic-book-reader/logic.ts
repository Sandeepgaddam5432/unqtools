/**
 * CBR Comic Book Reader — pure-JS RAR header parser.
 *
 * RAR format (proprietary):
 *   RAR4 signature (7 bytes): 0x52 0x61 0x72 0x21 0x1A 0x07 0x00 ("Rar!\x1a\x07\x00")
 *   RAR5 signature (8 bytes): 0x52 0x61 0x72 0x21 0x1A 0x07 0x01 0x00 ("Rar!\x1a\x07\x01\x00")
 *
 * RAR4 header structure (after signature):
 *   - 2-byte header CRC (LE)
 *   - 1-byte header type (1=MainArchiveHeader, 2=FileHeader, 3=Comment, ...)
 *   - 2-byte header flags (LE)
 *   - 2-byte header size (LE)
 *   - (type-specific fields)
 *
 * RAR5 header structure (after signature):
 *   - 4-byte header CRC (LE)
 *   - vint header size
 *   - vint header type
 *   - vint header flags
 *   - (type-specific fields, all vint-encoded)
 *
 * vint encoding (RAR5): each byte's high bit is a continuation flag; the
 * remaining 7 bits are the value. Little-endian byte order.
 *
 * HONESTY CLAUSE: RAR compression is proprietary. Full extraction requires
 * WASM (~500KB). We parse the signature + headers to list file entries,
 * but cannot decompress file contents. Documented in FAQ.
 */

// ===== RAR signatures =====

export const RAR4_SIGNATURE = [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00]; // 7 bytes
export const RAR5_SIGNATURE = [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x01, 0x00]; // 8 bytes

export type RarVersion = "rar4" | "rar5";

// ===== RAR4 header types =====

export const RAR4_HEADER_MAIN_ARCHIVE = 0x73;
export const RAR4_HEADER_FILE = 0x74;
export const RAR4_HEADER_COMMENT = 0x75;
export const RAR4_HEADER_AV = 0x76;
export const RAR4_HEADER_SUB = 0x77;
export const RAR4_HEADER_PROTECT = 0x78;
export const RAR4_HEADER_SIGN = 0x79;
export const RAR4_HEADER_NEW_SUB = 0x7a;
export const RAR4_HEADER_END_OF_ARCHIVE = 0x7b;

// ===== RAR5 header types =====

export const RAR5_HEADER_MAIN_ARCHIVE = 0x01;
export const RAR5_HEADER_FILE = 0x02;
export const RAR5_HEADER_SERVICE = 0x03;
export const RAR5_HEADER_ENCRYPTION = 0x04;
export const RAR5_HEADER_END_OF_ARCHIVE = 0x05;

// ===== Types =====

export interface RarEntry {
  /** Filename (UTF-8 decoded). */
  name: string;
  /** Uncompressed file size in bytes. */
  uncompressedSize: number;
  /** Compressed file size in bytes. */
  compressedSize: number;
  /** True if the file is a directory. */
  isDirectory: boolean;
  /** True if the file is encrypted. */
  isEncrypted: boolean;
  /** CRC32 of the file data (if available). */
  crc32: number | null;
  /** Compression method (RAR4: 0x30=store, 0x31-0x35=fastest..best; RAR5: 0=store, 1=fastest, etc). */
  compressionMethod: number | null;
  /** File date (DOS format, 4 bytes). */
  fileDate: number | null;
  /** Header offset in the archive. */
  headerOffset: number;
}

export interface RarArchiveInfo {
  /** RAR version detected. */
  version: RarVersion;
  /** True if the RAR signature was found. */
  isValid: boolean;
  /** All file entries parsed from headers. */
  entries: RarEntry[];
  /** True if the archive is encrypted (header encryption or file encryption). */
  isEncrypted: boolean;
  /** True if the archive is a multi-volume archive. */
  isMultiVolume: boolean;
  /** True if the archive has a recovery record. */
  hasRecoveryRecord: boolean;
  /** True if the archive is solid (files compressed together). */
  isSolid: boolean;
  /** Number of entries that are regular files. */
  fileCount: number;
  /** Number of entries that are directories. */
  directoryCount: number;
  /** Sum of uncompressed sizes of all regular files. */
  totalUncompressedSize: number;
  /** Sum of compressed sizes of all regular files. */
  totalCompressedSize: number;
  /** Error message if parsing failed. */
  error?: string;
}

// ===== Signature detection =====

/** Check if bytes start with the RAR4 signature (7 bytes). */
export function isRar4Signature(bytes: Uint8Array): boolean {
  if (bytes.length < 7) return false;
  for (let i = 0; i < 7; i++) {
    if (bytes[i] !== RAR4_SIGNATURE[i]) return false;
  }
  return true;
}

/** Check if bytes start with the RAR5 signature (8 bytes). */
export function isRar5Signature(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== RAR5_SIGNATURE[i]) return false;
  }
  return true;
}

/** Check if bytes start with any RAR signature. Returns the version or null. */
export function detectRarVersion(bytes: Uint8Array): RarVersion | null {
  if (isRar5Signature(bytes)) return "rar5";
  if (isRar4Signature(bytes)) return "rar4";
  return null;
}

/** Check if bytes look like a RAR file (either RAR4 or RAR5). */
export function isRarFile(bytes: Uint8Array): boolean {
  return detectRarVersion(bytes) !== null;
}

// ===== RAR5 vint decoding =====

/**
 * Decode a RAR5 vint (variable-length integer) at the given offset.
 * Returns the value and the number of bytes consumed.
 */
export function decodeVint(bytes: Uint8Array, offset: number): { value: number; bytesConsumed: number } {
  let result = 0;
  let shift = 0;
  let i = offset;
  let bytesConsumed = 0;
  while (i < bytes.length) {
    const b = bytes[i]!;
    bytesConsumed++;
    // High bit is continuation flag; low 7 bits are value
    result |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) break;
    shift += 7;
    i++;
    if (bytesConsumed > 10) break; // sanity limit
  }
  return { value: result >>> 0, bytesConsumed };
}

// ===== RAR4 header parsing =====

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

function readU64LE(bytes: Uint8Array, offset: number): number {
  const low = readU32LE(bytes, offset);
  const high = readU32LE(bytes, offset + 4);
  return high * 0x100000000 + low;
}

/**
 * Parse a RAR4 archive. Returns all file entries.
 */
export function parseRar4(bytes: Uint8Array): RarArchiveInfo {
  const entries: RarEntry[] = [];
  let isEncrypted = false;
  let isMultiVolume = false;
  let hasRecoveryRecord = false;
  let isSolid = false;
  let pos = 7; // skip signature

  while (pos + 7 <= bytes.length) {
    const headerStart = pos;
    const _headerCrc = readU16LE(bytes, pos);
    const headerType = bytes[pos + 2] ?? 0;
    const headerFlags = readU16LE(bytes, pos + 3);
    const headerSize = readU16LE(bytes, pos + 5);
    if (headerSize === 0) break;
    void _headerCrc;

    // End-of-archive marker
    if (headerType === RAR4_HEADER_END_OF_ARCHIVE) break;

    // Main archive header (0x73)
    if (headerType === RAR4_HEADER_MAIN_ARCHIVE) {
      const mainFlags = readU16LE(bytes, pos + 7 + 2); // AvPos(2) + mainFlags(2)
      isMultiVolume = (headerFlags & 0x01) !== 0;
      hasRecoveryRecord = (mainFlags & 0x40) !== 0;
      isSolid = (mainFlags & 0x10) !== 0;
      isEncrypted = (headerFlags & 0x80) !== 0;
      pos += headerSize;
      continue;
    }

    // File header (0x74)
    if (headerType === RAR4_HEADER_FILE) {
      try {
        const fileFlags = readU16LE(bytes, pos + 7);
        const uncompressedSize = readU32LE(bytes, pos + 9);
        const hostOs = bytes[pos + 13] ?? 0;
        const fileCrc = readU32LE(bytes, pos + 14);
        const fileTime = readU32LE(bytes, pos + 18);
        const unpVer = bytes[pos + 22] ?? 0;
        const compressionMethod = bytes[pos + 23] ?? 0;
        const nameSize = readU16LE(bytes, pos + 24);
        const fileAttrs = readU32LE(bytes, pos + 26);
        // High pack size if flag bit 0x100 set
        let highPackSize = 0;
        let dataOffset = pos + 7 + 25;
        if ((fileFlags & 0x100) !== 0) {
          highPackSize = readU32LE(bytes, pos + 7 + 25);
          dataOffset += 4;
        }
        const compressedSize = readU32LE(bytes, pos + 7) >>> 0; // simplified
        void compressedSize; void hostOs; void unpVer;
        // Read filename (nameSize bytes)
        const nameBytes = bytes.subarray(dataOffset, dataOffset + nameSize);
        const name = new TextDecoder("utf-8").decode(nameBytes);
        const isDirectory = (fileAttrs & 0x10) !== 0; // FILE_ATTRIBUTE_DIRECTORY
        entries.push({
          name,
          uncompressedSize,
          compressedSize: highPackSize * 0x100000000 + readU32LE(bytes, pos + 7),
          isDirectory,
          isEncrypted: (fileFlags & 0x04) !== 0,
          crc32: fileCrc,
          compressionMethod,
          fileDate: fileTime,
          headerOffset: headerStart,
        });
        void dataOffset;
      } catch {
        // ignore parse errors
      }
    }

    pos += headerSize;
  }

  return computeStats("rar4", entries, isEncrypted, isMultiVolume, hasRecoveryRecord, isSolid);
}

// ===== RAR5 header parsing =====

/**
 * Parse a RAR5 archive. Returns all file entries.
 */
export function parseRar5(bytes: Uint8Array): RarArchiveInfo {
  const entries: RarEntry[] = [];
  let isEncrypted = false;
  let isMultiVolume = false;
  let hasRecoveryRecord = false;
  let isSolid = false;
  let pos = 8; // skip signature

  while (pos + 4 <= bytes.length) {
    const headerStart = pos;
    const _headerCrc = readU32LE(bytes, pos);
    pos += 4;
    const headerSizeVi = decodeVint(bytes, pos);
    const headerSize = headerSizeVi.value;
    pos += headerSizeVi.bytesConsumed;
    if (headerSize === 0 || pos + headerSize > bytes.length) break;
    void _headerCrc;

    const headerEnd = pos + headerSize;
    const headerTypeVi = decodeVint(bytes, pos);
    const headerType = headerTypeVi.value;
    pos += headerTypeVi.bytesConsumed;
    const headerFlagsVi = decodeVint(bytes, pos);
    const headerFlags = headerFlagsVi.value;
    pos += headerFlagsVi.bytesConsumed;

    if (headerType === RAR5_HEADER_END_OF_ARCHIVE) break;

    if (headerType === RAR5_HEADER_MAIN_ARCHIVE) {
      const archiveFlagsVi = decodeVint(bytes, pos);
      const archiveFlags = archiveFlagsVi.value;
      isMultiVolume = (archiveFlags & 0x01) !== 0;
      hasRecoveryRecord = (archiveFlags & 0x02) !== 0;
      isSolid = (archiveFlags & 0x04) !== 0;
      pos = headerEnd;
      continue;
    }

    if (headerType === RAR5_HEADER_ENCRYPTION) {
      isEncrypted = true;
      pos = headerEnd;
      continue;
    }

    if (headerType === RAR5_HEADER_FILE) {
      try {
        // fileFlags (vint)
        const fileFlagsVi = decodeVint(bytes, pos);
        const fileFlags = fileFlagsVi.value;
        pos += fileFlagsVi.bytesConsumed;
        const isFileDirectory = (fileFlags & 0x02) !== 0;
        const isFileEncrypted = (fileFlags & 0x04) !== 0;
        // UTC time flag
        const timeFlag = (fileFlags & 0x02) !== 0;
        void timeFlag;
        // uncompressedSize (vint)
        const unpSizeVi = decodeVint(bytes, pos);
        const uncompressedSize = unpSizeVi.value;
        pos += unpSizeVi.bytesConsumed;
        // attributes (vint)
        const attrVi = decodeVint(bytes, pos);
        pos += attrVi.bytesConsumed;
        // mtime (vint, present if time flag set)
        if ((fileFlags & 0x02) !== 0) {
          const mtVi = decodeVint(bytes, pos);
          pos += mtVi.bytesConsumed;
        }
        // CRC (vint, present if bit 0x20 set)
        let fileCrc: number | null = null;
        if ((fileFlags & 0x20) !== 0) {
          const crcVi = decodeVint(bytes, pos);
          fileCrc = crcVi.value;
          pos += crcVi.bytesConsumed;
        }
        // compression info (vint)
        const compVi = decodeVint(bytes, pos);
        const compInfo = compVi.value;
        pos += compVi.bytesConsumed;
        const compressionMethod = compInfo & 0x3f;
        // host OS (vint)
        const hostVi = decodeVint(bytes, pos);
        pos += hostVi.bytesConsumed;
        // name size (vint)
        const nameSizeVi = decodeVint(bytes, pos);
        const nameSize = nameSizeVi.value;
        pos += nameSizeVi.bytesConsumed;
        // name (nameSize bytes, UTF-8)
        const nameBytes = bytes.subarray(pos, pos + nameSize);
        const name = new TextDecoder("utf-8").decode(nameBytes);
        pos += nameSize;
        entries.push({
          name,
          uncompressedSize,
          compressedSize: 0, // RAR5 doesn't store per-file compressed size in the file header directly
          isDirectory: isFileDirectory,
          isEncrypted: isFileEncrypted,
          crc32: fileCrc,
          compressionMethod,
          fileDate: null,
          headerOffset: headerStart,
        });
      } catch {
        // ignore parse errors
      }
    }

    pos = headerEnd;
  }

  return computeStats("rar5", entries, isEncrypted, isMultiVolume, hasRecoveryRecord, isSolid);
}

// ===== Common: stats computation =====

function computeStats(
  version: RarVersion,
  entries: RarEntry[],
  isEncrypted: boolean,
  isMultiVolume: boolean,
  hasRecoveryRecord: boolean,
  isSolid: boolean,
): RarArchiveInfo {
  let fileCount = 0;
  let directoryCount = 0;
  let totalUncompressedSize = 0;
  let totalCompressedSize = 0;
  for (const e of entries) {
    if (e.isDirectory) {
      directoryCount++;
    } else {
      fileCount++;
      totalUncompressedSize += e.uncompressedSize;
      totalCompressedSize += e.compressedSize;
    }
  }
  return {
    version, isValid: true, entries,
    isEncrypted, isMultiVolume, hasRecoveryRecord, isSolid,
    fileCount, directoryCount,
    totalUncompressedSize, totalCompressedSize,
  };
}

// ===== Top-level parse function =====

/** Parse a RAR archive (RAR4 or RAR5). Returns the archive info. */
export function parseRar(bytes: Uint8Array): RarArchiveInfo {
  const version = detectRarVersion(bytes);
  if (version === null) {
    return {
      version: "rar4", isValid: false, entries: [],
      isEncrypted: false, isMultiVolume: false, hasRecoveryRecord: false, isSolid: false,
      fileCount: 0, directoryCount: 0,
      totalUncompressedSize: 0, totalCompressedSize: 0,
      error: "Not a valid RAR file (missing 'Rar!' signature).",
    };
  }
  if (version === "rar5") return parseRar5(bytes);
  return parseRar4(bytes);
}

// ===== Image / page detection =====

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
    const an = /^\d+$/.test(aParts[i]!) ? parseInt(aParts[i]!, 10) : null;
    const bn = /^\d+$/.test(bParts[i]!) ? parseInt(bParts[i]!, 10) : null;
    if (an !== null && bn !== null) {
      if (an !== bn) return an - bn;
    } else {
      const cmp = aParts[i]!.localeCompare(bParts[i]!);
      if (cmp !== 0) return cmp;
    }
  }
  return aParts.length - bParts.length;
}

/** Get the list of image-page entries (sorted naturally). */
export function getPageEntries(entries: RarEntry[]): RarEntry[] {
  return entries
    .filter((e) => !e.isDirectory && detectImageMime(e.name) !== null)
    .sort((a, b) => naturalCompare(a.name, b.name));
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

const HISTORY_KEY = "unqtools-cbr-comic-book-reader-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  fileSize: number;
  version: RarVersion;
  pageCount: number;
  fileCount: number;
  openedAt: string;
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
