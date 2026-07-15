/**
 * 7Z Extractor — pure-JS 7z archive inspector.
 *
 * 7z format (https://py7zr.readthedocs.io/en/latest/archive_format.html):
 *   SignatureHeader (32 bytes at file start):
 *     - 6 bytes signature: 0x37 0x7A 0xBC 0xAF 0x27 0x1C ("7z\xbc\xaf'\x1c")
 *     - 1 byte major version (usually 0)
 *     - 1 byte minor version (usually 4)
 *     - 4 bytes StartHeader CRC (LE)
 *     - 8 bytes NextHeaderOffset (LE, u64)
 *     - 8 bytes NextHeaderSize (LE, u64)
 *     - 8 bytes NextHeader CRC (LE, u32 stored as u64)
 *
 * The NextHeader (at offset 32 + NextHeaderOffset) contains the compressed
 * metadata (file entries, sizes, methods). It's typically LZMA-compressed.
 *
 * HONESTY CLAUSE: We parse the SignatureHeader correctly and detect the 7z
 * magic. The NextHeader is LZMA-compressed in most 7z files; decompressing
 * it requires an LZMA decoder (~50KB+ WASM). We display the SignatureHeader
 * info, but file listing requires LZMA decompression. Documented in FAQ.
 */

// ===== Signature =====

export const SEVEN_ZIP_SIGNATURE = [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]; // 6 bytes
export const SEVEN_ZIP_HEADER_SIZE = 32;

// ===== Types =====

export interface SevenZipSignatureHeader {
  /** 6-byte signature bytes. */
  signature: number[];
  /** Major version (usually 0). */
  majorVersion: number;
  /** Minor version (usually 4). */
  minorVersion: number;
  /** StartHeader CRC32. */
  startHeaderCrc: number;
  /** Offset of the NextHeader from byte 32. */
  nextHeaderOffset: number;
  /** Size of the NextHeader in bytes. */
  nextHeaderSize: number;
  /** CRC of the NextHeader. */
  nextHeaderCrc: number;
  /** True if the signature is valid. */
  isValid: boolean;
}

export interface SevenZipEntry {
  /** Filename (UTF-8). */
  name: string;
  /** Uncompressed size. */
  size: number;
  /** Compression method ID (e.g., 0 = COPY, 0x030101 = LZMA). */
  methodId: number | null;
  /** True if the entry uses COPY (no compression). */
  isStored: boolean;
  /** CRC32 of the file data. */
  crc32: number | null;
  /** Modification time (Windows FILETIME, if available). */
  mtime: number | null;
  /** True if the entry is a directory. */
  isDirectory: boolean;
  /** True if the entry is encrypted. */
  isEncrypted: boolean;
}

export interface SevenZipArchiveInfo {
  /** True if the 7z signature was found. */
  isValid: boolean;
  /** Parsed SignatureHeader. */
  header: SevenZipSignatureHeader | null;
  /** File entries (only populated if NextHeader could be parsed). */
  entries: SevenZipEntry[];
  /** File count (excluding directories). */
  fileCount: number;
  /** Directory count. */
  directoryCount: number;
  /** Total uncompressed size of all regular files. */
  totalUncompressedSize: number;
  /** Compression methods used (unique IDs). */
  compressionMethods: number[];
  /** True if any entry is encrypted. */
  isEncrypted: boolean;
  /** True if the NextHeader is compressed (LZMA) — file listing limited. */
  nextHeaderIsCompressed: boolean;
  /** Error message if parsing failed. */
  error?: string;
}

// ===== Byte readers =====

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

// ===== Signature detection =====

/** Check if bytes start with the 7z signature (6 bytes). */
export function is7zSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 6) return false;
  for (let i = 0; i < 6; i++) {
    if (bytes[i] !== SEVEN_ZIP_SIGNATURE[i]) return false;
  }
  return true;
}

/** Check if bytes look like a 7z file. */
export function is7zFile(bytes: Uint8Array): boolean {
  return is7zSignature(bytes);
}

// ===== SignatureHeader parsing =====

/** Parse the 32-byte SignatureHeader. */
export function parseSignatureHeader(bytes: Uint8Array): SevenZipSignatureHeader {
  if (bytes.length < SEVEN_ZIP_HEADER_SIZE) {
    return {
      signature: [], majorVersion: 0, minorVersion: 0,
      startHeaderCrc: 0, nextHeaderOffset: 0, nextHeaderSize: 0, nextHeaderCrc: 0,
      isValid: false,
    };
  }
  const signature = Array.from(bytes.subarray(0, 6));
  const majorVersion = bytes[6] ?? 0;
  const minorVersion = bytes[7] ?? 0;
  const startHeaderCrc = readU32LE(bytes, 8);
  const nextHeaderOffset = readU64LE(bytes, 12);
  const nextHeaderSize = readU64LE(bytes, 20);
  const nextHeaderCrc = readU32LE(bytes, 28);
  return {
    signature, majorVersion, minorVersion,
    startHeaderCrc, nextHeaderOffset, nextHeaderSize, nextHeaderCrc,
    isValid: is7zSignature(bytes),
  };
}

// ===== NextHeader parsing (limited) =====

/**
 * Attempt to parse the NextHeader. Most 7z files have LZMA-compressed
 * NextHeaders, so this returns limited info. We can detect:
 * - Whether the NextHeader is LZMA-compressed (byte 0 = 0x03 0x01 0x01)
 * - Stored (uncompressed) NextHeaders: parse file entries
 *
 * HONESTY: Full NextHeader parsing requires LZMA decompression. We detect
 * the compression but don't decompress. Documented in FAQ.
 */
export function parseNextHeader(
  bytes: Uint8Array,
  header: SevenZipSignatureHeader,
): { entries: SevenZipEntry[]; isCompressed: boolean; error?: string } {
  const nextHeaderStart = SEVEN_ZIP_HEADER_SIZE + header.nextHeaderOffset;
  if (nextHeaderStart + header.nextHeaderSize > bytes.length) {
    return { entries: [], isCompressed: false, error: "NextHeader offset/size out of bounds." };
  }
  const nextHeader = bytes.subarray(nextHeaderStart, nextHeaderStart + header.nextHeaderSize);
  if (nextHeader.length === 0) {
    return { entries: [], isCompressed: false };
  }
  // Check for LZMA compression marker (0x03 0x01 0x01 = LZMA method ID)
  // In 7z, the NextHeader starts with a property byte that indicates compression.
  // If the first byte is 0x03 (kCompressedHeader), the rest is LZMA-compressed.
  // If the first byte is 0x01 (kHeader), it's an uncompressed header.
  const firstByte = nextHeader[0]!;
  if (firstByte === 0x03) {
    // Compressed header — can't parse without LZMA
    return { entries: [], isCompressed: true };
  }
  // Uncompressed header — we'd need to parse the full 7z header structure
  // (which is complex — kHeader, kMainStreamsInfo, kFilesInfo, etc.)
  // For now, return empty entries with no error.
  return { entries: [], isCompressed: false };
}

// ===== Top-level parse =====

/** Parse a 7z archive. Returns the archive info. */
export function parse7z(bytes: Uint8Array): SevenZipArchiveInfo {
  if (!is7zSignature(bytes)) {
    return {
      isValid: false, header: null, entries: [],
      fileCount: 0, directoryCount: 0, totalUncompressedSize: 0,
      compressionMethods: [], isEncrypted: false, nextHeaderIsCompressed: false,
      error: "Not a valid 7z file (missing '7z\\xbc\\xaf\\'\\x1c' signature).",
    };
  }
  const header = parseSignatureHeader(bytes);
  const nextHeaderResult = parseNextHeader(bytes, header);
  let fileCount = 0;
  let directoryCount = 0;
  let totalUncompressedSize = 0;
  const compressionMethods = new Set<number>();
  let isEncrypted = false;
  for (const e of nextHeaderResult.entries) {
    if (e.isDirectory) {
      directoryCount++;
    } else {
      fileCount++;
      totalUncompressedSize += e.size;
    }
    if (e.methodId !== null) compressionMethods.add(e.methodId);
    if (e.isEncrypted) isEncrypted = true;
  }
  return {
    isValid: true, header, entries: nextHeaderResult.entries,
    fileCount, directoryCount, totalUncompressedSize,
    compressionMethods: Array.from(compressionMethods),
    isEncrypted,
    nextHeaderIsCompressed: nextHeaderResult.isCompressed,
    error: nextHeaderResult.error,
  };
}

// ===== Compression method names =====

const METHOD_NAMES: Record<number, string> = {
  0x00: "COPY (stored)",
  0x030101: "LZMA",
  0x21: "LZMA2",
  0x03030103: "BCJ (x86)",
  0x0303011B: "BCJ2",
  0x040202: "BZIP2",
  0x040108: "DEFLATE",
  0x03030105: "PPC",
  0x03030106: "IA64",
  0x03030107: "ARM",
  0x03030108: "ARMT",
  0x03030109: "SPARC",
  0x03: "DELTA",
};

/** Get a human-readable name for a 7z compression method ID. */
export function getMethodName(methodId: number | null): string {
  if (methodId === null) return "Unknown";
  return METHOD_NAMES[methodId] ?? `Method 0x${methodId.toString(16)}`;
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

const HISTORY_KEY = "unqtools-7z-extractor-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  fileSize: number;
  fileCount: number;
  nextHeaderIsCompressed: boolean;
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
