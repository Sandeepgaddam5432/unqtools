/**
 * DMG Extractor — pure-JS macOS DMG (UDIF) trailer inspector.
 *
 * DMG format (UDIF — Universal Disk Image Format):
 *   - File structure: [data fork] [resource fork] [XML plist] [koly trailer]
 *   - The 'koly' trailer is always 512 bytes at the END of the file
 *   - The trailer's first 4 bytes are the ASCII signature 'koly'
 *
 * Koly trailer (big-endian, 512 bytes total):
 *    0  signature        4 bytes  ("koly" = 0x6B 0x6F 0x6C 0x79)
 *    4  version          4 bytes  (usually 4)
 *    8  headerSize       4 bytes  (always 512)
 *   12  flags            4 bytes  (bit flags)
 *   16  runningDataForkOffset  8 bytes
 *   24  dataForkOffset   8 bytes  (typically 0)
 *   32  dataForkLength   8 bytes
 *   40  resourceForkOffset  8 bytes
 *   48  resourceForkLength  8 bytes
 *   56  segmentNumber    4 bytes
 *   60  segmentCount     4 bytes
 *   64  uuid            16 bytes
 *   80  plistOffset      8 bytes  (XML plist for block table)
 *   88  plistLength      8 bytes
 *   96  checksumType     4 bytes
 *   100 checksumBits     4 bytes  (size of checksum in bits)
 *   104 checksumData    32 bytes
 *   136 ... (reserved / variant header)
 *
 * HONESTY CLAUSE: We parse the koly trailer correctly and detect compression
 * schemes from the resource fork's plist. We do NOT extract file contents
 * from the HFS+/APFS filesystem inside the data fork — that requires
 * filesystem drivers (HFS+ B-tree or APFS container) and block-level
 * decompression (UDZO/UDBZ/ULFO/UFBI). Documented in FAQ.
 */

// ===== Constants =====

export const KOLY_SIGNATURE = "koly"; // 4 bytes: 0x6B 0x6F 0x6C 0x79
export const KOLY_SIGNATURE_BYTES = [0x6b, 0x6f, 0x6c, 0x79];
export const KOLY_TRAILER_SIZE = 512;
export const KOLY_DEFAULT_VERSION = 4;
export const KOLY_DEFAULT_HEADER_SIZE = 512;

// Known UDIF compression schemes (4-char markers in the resource fork plist)
export const UDIF_COMPRESSION_SCHEMES: Record<string, string> = {
  "UDZO": "zlib (DEFLATE)",
  "UDBZ": "bzip2",
  "ULFO": "LZFSE",
  "UFBI": "ADC (Apple Data Compression)",
  "UDRO": "Raw (uncompressed)",
  "UDCM": "Custom (proprietary)",
  "UDUC": "UDUC (unknown)",
};

// ===== Types =====

export interface KolyTrailer {
  /** 4-byte signature string ("koly" if valid). */
  signature: string;
  /** Trailer version (usually 4). */
  version: number;
  /** Header size in bytes (always 512). */
  headerSize: number;
  /** Bit flags. */
  flags: number;
  /** Running data fork offset (for multi-segment DMGs). */
  runningDataForkOffset: number;
  /** Offset of the data fork from the start of the file. */
  dataForkOffset: number;
  /** Length of the data fork in bytes. */
  dataForkLength: number;
  /** Offset of the resource fork. */
  resourceForkOffset: number;
  /** Length of the resource fork in bytes. */
  resourceForkLength: number;
  /** Segment number (1-indexed, for multi-segment DMGs). */
  segmentNumber: number;
  /** Total number of segments (1 = single-segment). */
  segmentCount: number;
  /** Volume UUID (16 bytes as hex). */
  uuid: string;
  /** Offset of the XML plist. */
  plistOffset: number;
  /** Length of the XML plist in bytes. */
  plistLength: number;
  /** Checksum type ID. */
  checksumType: number;
  /** Checksum size in bits. */
  checksumBits: number;
  /** True if the signature is valid. */
  isValid: boolean;
}

export interface DmgPartition {
  /** Partition name (from plist, if available). */
  name: string;
  /** Partition type (e.g., "Apple_HFS", "Apple_APFS", "Apple_partition_map"). */
  type: string;
  /** Starting block. */
  startBlock: number;
  /** Block count. */
  blockCount: number;
}

export interface DmgArchiveInfo {
  /** True if the koly signature was found at the file tail. */
  isValid: boolean;
  /** Parsed koly trailer (or null if not present). */
  trailer: KolyTrailer | null;
  /** Detected compression scheme (e.g., "UDZO"). */
  compressionScheme: string | null;
  /** Human-readable compression name. */
  compressionName: string;
  /** True if the DMG is multi-segment. */
  isMultiSegment: boolean;
  /** True if the DMG is encrypted. */
  isEncrypted: boolean;
  /** Partition hints (from plist, if parseable). */
  partitions: DmgPartition[];
  /** File size in bytes. */
  fileSize: number;
  /** Error message if parsing failed. */
  error?: string;
}

// ===== Byte readers (big-endian) =====

function readU8(bytes: Uint8Array, offset: number): number {
  return bytes[offset] ?? 0;
}

function readU32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

function readU64BE(bytes: Uint8Array, offset: number): number {
  // JavaScript numbers can safely represent up to 2^53, and DMG forks can
  // exceed that for very large images. We use Number for simplicity —
  // for files >8PB we'd lose precision, but real DMGs are well under that.
  const high = readU32BE(bytes, offset);
  const low = readU32BE(bytes, offset + 4);
  return high * 0x100000000 + low;
}

function readString(bytes: Uint8Array, offset: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    const b = bytes[offset + i];
    if (b === undefined) break;
    out += String.fromCharCode(b);
  }
  return out;
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) {
    out += b.toString(16).padStart(2, "0");
  }
  return out;
}

// ===== Signature detection =====

/** Check if the last 512 bytes of the file start with the 'koly' signature. */
export function hasKolyTrailer(bytes: Uint8Array): boolean {
  if (bytes.length < KOLY_TRAILER_SIZE) return false;
  const start = bytes.length - KOLY_TRAILER_SIZE;
  for (let i = 0; i < KOLY_SIGNATURE_BYTES.length; i++) {
    if (bytes[start + i] !== KOLY_SIGNATURE_BYTES[i]) return false;
  }
  return true;
}

/** Check if bytes look like a DMG file (koly trailer at end). */
export function isDmgFile(bytes: Uint8Array): boolean {
  return hasKolyTrailer(bytes);
}

// ===== Trailer parsing =====

/** Parse the 512-byte koly trailer at the end of the file. */
export function parseKolyTrailer(bytes: Uint8Array): KolyTrailer {
  if (bytes.length < KOLY_TRAILER_SIZE) {
    return {
      signature: "",
      version: 0, headerSize: 0, flags: 0,
      runningDataForkOffset: 0, dataForkOffset: 0, dataForkLength: 0,
      resourceForkOffset: 0, resourceForkLength: 0,
      segmentNumber: 0, segmentCount: 0,
      uuid: "", plistOffset: 0, plistLength: 0,
      checksumType: 0, checksumBits: 0,
      isValid: false,
    };
  }
  const start = bytes.length - KOLY_TRAILER_SIZE;
  const signature = readString(bytes, start + 0, 4);
  const version = readU32BE(bytes, start + 4);
  const headerSize = readU32BE(bytes, start + 8);
  const flags = readU32BE(bytes, start + 12);
  const runningDataForkOffset = readU64BE(bytes, start + 16);
  const dataForkOffset = readU64BE(bytes, start + 24);
  const dataForkLength = readU64BE(bytes, start + 32);
  const resourceForkOffset = readU64BE(bytes, start + 40);
  const resourceForkLength = readU64BE(bytes, start + 48);
  const segmentNumber = readU32BE(bytes, start + 56);
  const segmentCount = readU32BE(bytes, start + 60);
  const uuid = bytesToHex(bytes.subarray(start + 64, start + 80));
  const plistOffset = readU64BE(bytes, start + 80);
  const plistLength = readU64BE(bytes, start + 88);
  const checksumType = readU32BE(bytes, start + 96);
  const checksumBits = readU32BE(bytes, start + 100);
  return {
    signature,
    version,
    headerSize,
    flags,
    runningDataForkOffset,
    dataForkOffset,
    dataForkLength,
    resourceForkOffset,
    resourceForkLength,
    segmentNumber,
    segmentCount,
    uuid,
    plistOffset,
    plistLength,
    checksumType,
    checksumBits,
    isValid: signature === KOLY_SIGNATURE,
  };
}

// ===== Plist parsing (limited — detect compression scheme + partitions) =====

/**
 * Attempt to extract compression scheme + partition info from the XML plist.
 * The plist is a small XML blob referenced from the koly trailer.
 * HONESTY: We do regex-based extraction. Full plist parsing is out of scope.
 */
export function parsePlist(plistXml: string): {
  compressionScheme: string | null;
  partitions: DmgPartition[];
} {
  let compressionScheme: string | null = null;
  // Look for a 4-character compression marker (e.g., "UDZO", "UDBZ")
  const compMatch = plistXml.match(/\b(UDZO|UDBZ|ULFO|UFBI|UDRO|UDCM|UDUC)\b/);
  if (compMatch) compressionScheme = compMatch[1]!;

  // Look for partition entries ( plist can have <key>Name</key><string>...</string> pairs )
  const partitions: DmgPartition[] = [];
  // Try to find <dict> blocks that look like partitions
  const dictRe = /<dict>([\s\S]*?)<\/dict>/gi;
  let dm: RegExpExecArray | null;
  while ((dm = dictRe.exec(plistXml)) !== null) {
    const block = dm[1]!;
    const nameMatch = block.match(/<key>Name<\/key>\s*<string>([^<]+)<\/string>/i);
    const typeMatch = block.match(/<key>PartitionName<\/key>\s*<string>([^<]+)<\/string>/i)
      ?? block.match(/<key>Content<\/key>\s*<string>([^<]+)<\/string>/i);
    const startMatch = block.match(/<key>StartBlock<\/key>\s*<integer>(\d+)<\/integer>/i)
      ?? block.match(/<key>StartingSector<\/key>\s*<integer>(\d+)<\/integer>/i);
    const countMatch = block.match(/<key>BlockCount<\/key>\s*<integer>(\d+)<\/integer>/i)
      ?? block.match(/<key>SectorCount<\/key>\s*<integer>(\d+)<\/integer>/i);
    if (nameMatch || typeMatch) {
      partitions.push({
        name: nameMatch?.[1] ?? "(unnamed)",
        type: typeMatch?.[1] ?? "(unknown)",
        startBlock: startMatch ? parseInt(startMatch[1]!, 10) : 0,
        blockCount: countMatch ? parseInt(countMatch[1]!, 10) : 0,
      });
    }
  }
  return { compressionScheme, partitions };
}

/** Try to read the XML plist referenced by the koly trailer. Returns "" if not present. */
export function readPlistXml(bytes: Uint8Array, trailer: KolyTrailer): string {
  if (trailer.plistLength === 0) return "";
  if (trailer.plistOffset + trailer.plistLength > bytes.length) return "";
  const slice = bytes.subarray(trailer.plistOffset, trailer.plistOffset + trailer.plistLength);
  return new TextDecoder("utf-8", { fatal: false }).decode(slice);
}

// ===== Compression name =====

export function getCompressionName(scheme: string | null): string {
  if (!scheme) return "Unknown";
  return UDIF_COMPRESSION_SCHEMES[scheme] ?? `Unknown (${scheme})`;
}

// ===== Flags interpretation =====

/** True if the DMG is flagged as read-only (no writable flag set). */
export function isReadOnly(trailer: KolyTrailer): boolean {
  // UDIF flag bits: 0x01 = compressed, 0x02 = encrypted, 0x04 = kernel-safe,
  // 0x08 = read-only, 0x10 = Internet-enabled, 0x20 = multi-segment
  return (trailer.flags & 0x08) !== 0 || trailer.flags === 0;
}

/** True if the DMG is flagged as encrypted. */
export function isEncryptedFlag(trailer: KolyTrailer): boolean {
  return (trailer.flags & 0x02) !== 0;
}

// ===== Top-level parse =====

/** Parse a DMG file. Returns archive info. */
export function parseDmg(bytes: Uint8Array): DmgArchiveInfo {
  const fileSize = bytes.length;
  if (!hasKolyTrailer(bytes)) {
    return {
      isValid: false,
      trailer: null,
      compressionScheme: null,
      compressionName: "Unknown",
      isMultiSegment: false,
      isEncrypted: false,
      partitions: [],
      fileSize,
      error: "Not a valid DMG file — missing 'koly' UDIF trailer at file end (last 512 bytes).",
    };
  }
  const trailer = parseKolyTrailer(bytes);
  // Try to read the plist for compression + partition info
  let compressionScheme: string | null = null;
  let partitions: DmgPartition[] = [];
  try {
    const plistXml = readPlistXml(bytes, trailer);
    if (plistXml) {
      const result = parsePlist(plistXml);
      compressionScheme = result.compressionScheme;
      partitions = result.partitions;
    }
  } catch {
    // plist parsing failed — ignore
  }
  const isMultiSegment = trailer.segmentCount > 1;
  const isEncrypted = isEncryptedFlag(trailer);
  return {
    isValid: true,
    trailer,
    compressionScheme,
    compressionName: getCompressionName(compressionScheme),
    isMultiSegment,
    isEncrypted,
    partitions,
    fileSize,
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

const HISTORY_KEY = "unqtools-dmg-extractor-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  fileSize: number;
  version: number;
  compressionScheme: string | null;
  segmentCount: number;
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

// ===== Shareable URL =====

export function buildShareUrl(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}`;
}

export function parseShareUrl(hash: string): boolean | null {
  if (!hash || !hash.startsWith("#")) return null;
  return hash === "#inspect";
}

// Re-export for tests
export { readU8, readU32BE, readU64BE, readString, bytesToHex };
