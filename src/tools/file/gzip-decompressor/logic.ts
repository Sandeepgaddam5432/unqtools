/**
 * GZIP Decompressor — pure logic for GZIP header parsing (filename extraction),
 * decompression via DecompressionStream, TAR extraction (USTAR format), and
 * magic bytes MIME detection.
 *
 * GZIP format (RFC 1952):
 *   Header (10+ bytes):
 *     - ID1 (0x1f), ID2 (0x8b) — magic
 *     - CM (compression method, 8 = deflate)
 *     - FLG (flags)
 *     - MTIME (4 bytes)
 *     - XFL (extra flags)
 *     - OS (operating system)
 *   Optional fields based on FLG:
 *     - FEXTRA: 2-byte XLEN + XLEN bytes of extra data
 *     - FNAME: zero-terminated original filename
 *     - FCOMMENT: zero-terminated comment
 *     - FHCRC: 2-byte CRC16 of header
 *   Body: deflate-compressed data
 *   Footer (8 bytes): CRC32 + ISIZE
 */

export const GZIP_MAGIC1 = 0x1f;
export const GZIP_MAGIC2 = 0x8b;

export const FTEXT = 0x01;
export const FHCRC = 0x02;
export const FEXTRA = 0x04;
export const FNAME = 0x08;
export const FCOMMENT = 0x10;

export interface ParsedGzipHeader {
  /** Magic byte 1 (always 0x1f). */
  id1: number;
  /** Magic byte 2 (always 0x8b). */
  id2: number;
  /** Compression method (8 = deflate). */
  compressionMethod: number;
  /** Flags byte. */
  flags: number;
  /** MTIME field (Unix timestamp in seconds; 0 = unknown). */
  mtime: number;
  /** Extra flags. */
  xfl: number;
  /** Operating system. */
  os: number;
  /** Original filename extracted from FNAME field, or null if absent. */
  filename: string | null;
  /** Comment extracted from FCOMMENT field, or null if absent. */
  comment: string | null;
  /** Extra field bytes from FEXTRA, or null if absent. */
  extra: Uint8Array | null;
  /** Byte offset where the deflate body starts. */
  bodyOffset: number;
  /** True if magic bytes are valid (1f 8b). */
  isValid: boolean;
  /** Error message if parsing failed. */
  error?: string;
}

/** Validate that bytes start with the GZIP magic (1f 8b). */
export function isGzipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === GZIP_MAGIC1 && bytes[1] === GZIP_MAGIC2;
}

/**
 * Parse a GZIP header. Returns the parsed header with bodyOffset pointing to
 * the start of the deflate body.
 */
export function parseGzipHeader(bytes: Uint8Array): ParsedGzipHeader {
  if (bytes.length < 10) {
    return {
      id1: 0, id2: 0, compressionMethod: 0, flags: 0,
      mtime: 0, xfl: 0, os: 0,
      filename: null, comment: null, extra: null,
      bodyOffset: 0, isValid: false,
      error: "File too short for GZIP header (need at least 10 bytes).",
    };
  }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
  const id1 = bytes[0]!;
  const id2 = bytes[1]!;
  if (id1 !== GZIP_MAGIC1 || id2 !== GZIP_MAGIC2) {
    return {
      id1, id2, compressionMethod: bytes[2]!, flags: bytes[3]!,
      mtime: dv.getUint32(4, true), xfl: bytes[8]!, os: bytes[9]!,
      filename: null, comment: null, extra: null,
      bodyOffset: 0, isValid: false,
      error: `Invalid GZIP magic: expected 1f 8b, got ${id1.toString(16)} ${id2.toString(16)}.`,
    };
  }
  const compressionMethod = bytes[2]!;
  const flags = bytes[3]!;
  const mtime = dv.getUint32(4, true);
  const xfl = bytes[8]!;
  const os = bytes[9]!;

  let offset = 10;
  let extra: Uint8Array | null = null;
  let filename: string | null = null;
  let comment: string | null = null;

  // FEXTRA
  if (flags & FEXTRA) {
    if (offset + 2 > bytes.length) {
      return { id1, id2, compressionMethod, flags, mtime, xfl, os, filename, comment, extra, bodyOffset: offset, isValid: false, error: "Truncated FEXTRA length." };
    }
    const xlen = dv.getUint16(offset, true);
    offset += 2;
    if (offset + xlen > bytes.length) {
      return { id1, id2, compressionMethod, flags, mtime, xfl, os, filename, comment, extra, bodyOffset: offset, isValid: false, error: "Truncated FEXTRA data." };
    }
    extra = bytes.subarray(offset, offset + xlen);
    offset += xlen;
  }

  // FNAME (zero-terminated string)
  if (flags & FNAME) {
    const start = offset;
    while (offset < bytes.length && bytes[offset] !== 0) offset++;
    if (offset >= bytes.length) {
      return { id1, id2, compressionMethod, flags, mtime, xfl, os, filename, comment, extra, bodyOffset: offset, isValid: false, error: "Truncated FNAME (no null terminator)." };
    }
    filename = new TextDecoder("utf-8").decode(bytes.subarray(start, offset));
    offset++; // skip null terminator
  }

  // FCOMMENT (zero-terminated string)
  if (flags & FCOMMENT) {
    const start = offset;
    while (offset < bytes.length && bytes[offset] !== 0) offset++;
    if (offset >= bytes.length) {
      return { id1, id2, compressionMethod, flags, mtime, xfl, os, filename, comment, extra, bodyOffset: offset, isValid: false, error: "Truncated FCOMMENT (no null terminator)." };
    }
    comment = new TextDecoder("utf-8").decode(bytes.subarray(start, offset));
    offset++; // skip null terminator
  }

  // FHCRC (2 bytes)
  if (flags & FHCRC) {
    if (offset + 2 > bytes.length) {
      return { id1, id2, compressionMethod, flags, mtime, xfl, os, filename, comment, extra, bodyOffset: offset, isValid: false, error: "Truncated FHCRC." };
    }
    offset += 2;
  }

  return {
    id1, id2, compressionMethod, flags, mtime, xfl, os,
    filename, comment, extra,
    bodyOffset: offset, isValid: true,
  };
}

/**
 * Decompress a GZIP byte array using DecompressionStream.
 * Returns the decompressed bytes. Throws on invalid GZIP input.
 */
export async function decompressGzip(data: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream("gzip");
  const blob = new Blob([data as BlobPart]);
  // Attach a closed promise handler so the writer's async errors never
  // surface as unhandled rejections (which can crash Node test runs).
  const writer = stream.writable.getWriter();
  const writerClosedPromise = writer.closed.catch(() => { /* swallow async errors */ });
  const reader = stream.readable.getReader();
  // Attach a reader.closed promise handler for the same reason.
  const readerClosedPromise = reader.closed.catch(() => { /* swallow async errors */ });
  const chunks: Uint8Array[] = [];
  let totalLen = 0;
  let readErr: Error | null = null;
  try {
    writer.write(await blob.arrayBuffer());
    writer.close();
     
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        totalLen += value.length;
      }
    }
  } catch (err) {
    readErr = err as Error;
  }
  // Always release the locks and await the close promises so any
  // background error is observed (prevents unhandled-rejection crashes).
  try { reader.releaseLock(); } catch { /* ignore */ }
  try { writer.releaseLock(); } catch { /* ignore */ }
  await Promise.allSettled([writerClosedPromise, readerClosedPromise]);
  if (readErr) {
    throw new Error(
      `Failed to decompress GZIP: ${readErr.message || "invalid input"}`,
    );
  }
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

/** Guess an output filename from the GZIP header + input filename. */
export function guessOutputFilename(header: ParsedGzipHeader, inputFileName: string): string {
  if (header.filename && header.filename.length > 0) {
    return header.filename;
  }
  // Strip .gz / .gzip extension
  const stripped = inputFileName.replace(/\.(gz|gzip)$/i, "");
  if (stripped && stripped !== inputFileName) return stripped;
  return "decompressed.bin";
}

// ===== TAR parsing (USTAR format) =====

export interface TarEntry {
  name: string;
  size: number;
  typeflag: string;
  mode: number;
  mtime: number;
  uid: number;
  gid: number;
  /** Typeflag description (regular file, directory, symlink, etc). */
  typeDescription: string;
  /** Byte offset where the file data starts in the archive. */
  dataOffset: number;
  /** Whether this entry is a regular file we can extract. */
  isRegularFile: boolean;
  /** Prefix from USTAR format (prepended to name). */
  prefix: string;
}

const TAR_TYPE_DESCRIPTIONS: Record<string, string> = {
  "0": "Regular file",
  "\0": "Regular file",
  "1": "Hard link",
  "2": "Symbolic link",
  "3": "Character device",
  "4": "Block device",
  "5": "Directory",
  "6": "FIFO",
  "7": "Contiguous file",
  L: "GNU long name",
  K: "GNU long link",
  x: "PAX extended header",
  g: "PAX global extended header",
};

/** Parse octal digits from a fixed-width field (NUL or space terminated). */
function parseOctal(bytes: Uint8Array, offset: number, width: number): number {
  let s = "";
  for (let i = 0; i < width; i++) {
    const b = bytes[offset + i];
    if (b === 0 || b === 0x20) break;
    if (b < 0x30 || b > 0x37) {
      // Non-octal char — stop
      break;
    }
    s += String.fromCharCode(b);
  }
  return s.length === 0 ? 0 : parseInt(s, 8);
}

/** Decode a NUL-terminated string field. */
function decodeField(bytes: Uint8Array, offset: number, width: number): string {
  const end = offset + width;
  let nul = end;
  for (let i = offset; i < end; i++) {
    if (bytes[i] === 0) { nul = i; break; }
  }
  return new TextDecoder("utf-8").decode(bytes.subarray(offset, nul));
}

/**
 * Parse a TAR archive byte array into a list of entries (USTAR format).
 * Skips empty blocks (end-of-archive marker = two 512-byte zero blocks).
 */
export function parseTarEntries(bytes: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  let pos = 0;
  while (pos + 512 <= bytes.length) {
    // Check for end-of-archive (all-zero block)
    let allZero = true;
    for (let i = pos; i < pos + 512; i++) {
      if (bytes[i] !== 0) { allZero = false; break; }
    }
    if (allZero) break;

    const dv = new DataView(bytes.buffer, bytes.byteOffset + pos, 512);
    const name = decodeField(bytes, pos, 100);
    const mode = parseOctal(bytes, pos + 100, 8);
    const uid = parseOctal(bytes, pos + 108, 8);
    const gid = parseOctal(bytes, pos + 116, 8);
    const size = parseOctal(bytes, pos + 124, 12);
    const mtime = parseOctal(bytes, pos + 136, 12);
    const typeflagByte = bytes[pos + 156] ?? 0;
    const typeflag = String.fromCharCode(typeflagByte);
    const linkname = decodeField(bytes, pos + 157, 100);
    const magic = decodeField(bytes, pos + 257, 6);
    const prefix = decodeField(bytes, pos + 345, 155);
    void linkname;

    const isUstar = magic.startsWith("ustar");
    const fullName = prefix && isUstar ? `${prefix}/${name}` : name;
    const typeDescription = TAR_TYPE_DESCRIPTIONS[typeflag] ?? `Unknown (${typeflagByte})`;
    const isRegularFile = typeflag === "0" || typeflag === "\0" || typeflag === "7";

    entries.push({
      name: fullName,
      size,
      typeflag,
      mode,
      mtime,
      uid,
      gid,
      typeDescription,
      dataOffset: pos + 512,
      isRegularFile,
      prefix,
    });

    // Advance past header + data, rounded up to 512 bytes
    const dataBlocks = Math.ceil(size / 512);
    pos += 512 + dataBlocks * 512;
    void dv;
  }
  return entries;
}

/** Extract the data for a single TAR entry. Returns the raw bytes. */
export function extractTarEntry(bytes: Uint8Array, entry: TarEntry): Uint8Array {
  return bytes.subarray(entry.dataOffset, entry.dataOffset + entry.size);
}

/** Check if decompressed bytes look like a TAR archive (USTAR magic at offset 257). */
export function isTarArchive(bytes: Uint8Array): boolean {
  if (bytes.length < 265) return false;
  const magic = new TextDecoder("utf-8").decode(bytes.subarray(257, 263));
  return magic.startsWith("ustar");
}

// ===== Magic bytes → MIME detection =====

export interface MimeDetection {
  mime: string;
  description: string;
  isText: boolean;
}

const MAGIC_BYTES: Array<{ bytes: number[]; mime: string; description: string }> = [
  { bytes: [0x89, 0x50, 0x4e, 0x47], mime: "image/png", description: "PNG image" },
  { bytes: [0xff, 0xd8, 0xff], mime: "image/jpeg", description: "JPEG image" },
  { bytes: [0x47, 0x49, 0x46, 0x38], mime: "image/gif", description: "GIF image" },
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: "image/webp", description: "WebP/RIFF image" },
  { bytes: [0x42, 0x4d], mime: "image/bmp", description: "BMP image" },
  { bytes: [0x25, 0x50, 0x44, 0x46], mime: "application/pdf", description: "PDF document" },
  { bytes: [0x50, 0x4b, 0x03, 0x04], mime: "application/zip", description: "ZIP archive" },
  { bytes: [0x50, 0x4b, 0x05, 0x06], mime: "application/zip", description: "ZIP archive (empty)" },
  { bytes: [0x1f, 0x8b], mime: "application/gzip", description: "GZIP archive" },
  { bytes: [0x75, 0x73, 0x74, 0x61, 0x72], mime: "application/x-tar", description: "TAR archive" },
  { bytes: [0x7f, 0x45, 0x4c, 0x46], mime: "application/x-elf", description: "ELF binary" },
  { bytes: [0x4d, 0x5a], mime: "application/x-msdownload", description: "Windows PE / DOS executable" },
  { bytes: [0xca, 0xfe, 0xba, 0xbe], mime: "application/java-vm", description: "Java class file" },
  { bytes: [0x4f, 0x67, 0x67, 0x53], mime: "audio/ogg", description: "OGG media" },
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: "audio/wav", description: "WAV audio (RIFF)" },
  { bytes: [0x49, 0x44, 0x33], mime: "audio/mpeg", description: "MP3 audio (ID3)" },
];

/** Detect MIME type from the first few bytes of decompressed content. */
export function detectMime(bytes: Uint8Array): MimeDetection {
  if (bytes.length === 0) {
    return { mime: "application/octet-stream", description: "Empty", isText: false };
  }
  for (const m of MAGIC_BYTES) {
    if (bytes.length < m.bytes.length) continue;
    let match = true;
    for (let i = 0; i < m.bytes.length; i++) {
      if (bytes[i] !== m.bytes[i]) { match = false; break; }
    }
    if (match) {
      return { mime: m.mime, description: m.description, isText: false };
    }
  }
  // BOM sniffing
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { mime: "text/plain", description: "UTF-8 text (BOM)", isText: true };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { mime: "text/plain", description: "UTF-16LE text (BOM)", isText: true };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { mime: "text/plain", description: "UTF-16BE text (BOM)", isText: true };
  }
  // ASCII heuristic
  if (looksLikeText(bytes)) {
    return { mime: "text/plain", description: "Plain text", isText: true };
  }
  return { mime: "application/octet-stream", description: "Binary data", isText: false };
}

/** Heuristic: check if a buffer is mostly ASCII printable / common whitespace. */
export function looksLikeText(bytes: Uint8Array, sampleSize = 1024): boolean {
  const sample = bytes.subarray(0, Math.min(bytes.length, sampleSize));
  if (sample.length === 0) return false;
  let printable = 0;
  for (const b of sample) {
    if (b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b <= 0x7e)) printable++;
  }
  return printable / sample.length > 0.85;
}

// ===== Preview (first N bytes as hex + ASCII) =====

export interface PreviewResult {
  hex: string;
  ascii: string;
  previewSize: number;
  totalSize: number;
  truncated: boolean;
}

export function previewBytes(bytes: Uint8Array, maxBytes = 256): PreviewResult {
  const previewSize = Math.min(bytes.length, maxBytes);
  const slice = bytes.subarray(0, previewSize);
  let hex = "";
  let ascii = "";
  for (let i = 0; i < slice.length; i++) {
    const b = slice[i]!;
    if (i > 0) {
      hex += i % 16 === 0 ? "\n" : " ";
    }
    hex += b.toString(16).padStart(2, "0");
    ascii += b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : ".";
  }
  return {
    hex,
    ascii,
    previewSize,
    totalSize: bytes.length,
    truncated: bytes.length > maxBytes,
  };
}

// ===== Decompression stats =====

export interface DecompressionStat {
  fileName: string;
  outputFileName: string;
  compressedSize: number;
  decompressedSize: number;
  /** Expansion ratio: decompressed / compressed. 3.0 = 3x larger. */
  expansionRatio: number;
  /** Fraction: compressed / decompressed. 0.3 = output is 30% of compressed. */
  compressedFraction: number;
  mime: string;
  mimeDescription: string;
  isText: boolean;
  isTar: boolean;
  tarEntryCount: number;
  error?: string;
}

export function computeStat(
  fileName: string,
  outputFileName: string,
  compressedSize: number,
  decompressedSize: number,
  mime: string,
  mimeDescription: string,
  isText: boolean,
  isTar: boolean,
  tarEntryCount: number,
): DecompressionStat {
  const expansionRatio = compressedSize > 0 ? decompressedSize / compressedSize : 0;
  const compressedFraction = decompressedSize > 0 ? compressedSize / decompressedSize : 0;
  return {
    fileName, outputFileName, compressedSize, decompressedSize,
    expansionRatio, compressedFraction,
    mime, mimeDescription, isText, isTar, tarEntryCount,
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

export function formatRatio(value: number): string {
  return `${value.toFixed(2)}×`;
}

// ===== History (localStorage) =====

const HISTORY_KEY = "unqtools-gzip-decompressor-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileCount: number;
  totalCompressed: number;
  totalDecompressed: number;
  tarExtracted: boolean;
  decompressedAt: string;
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
  autoExtractTar: boolean;
  customOutputName: string;
}

export function buildShareUrl(opts: ShareOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("tar", String(opts.autoExtractTar));
  params.set("out", opts.customOutputName);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareOptions | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("tar") && !params.has("out")) return null;
  return {
    autoExtractTar: params.get("tar") === "true",
    customOutputName: params.get("out") ?? "",
  };
}

// ===== Minimal ZIP writer (for bundling decompressed outputs) =====

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
    lv.setUint16(8, 0, true); // STORE
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
  for (const p of allParts) {
    out.set(p, pos);
    pos += p.length;
  }
  return new Blob([out as BlobPart], { type: "application/zip" });
}

// ===== Top-level decompress =====

export interface DecompressInput {
  fileName: string;
  data: Uint8Array;
}

export interface DecompressOutput {
  fileName: string;
  outputFileName: string;
  data: Uint8Array;
  stat: DecompressionStat;
  /** If the output is a TAR archive, the parsed entries (regular files only). */
  tarEntries?: TarEntry[];
}

/**
 * Decompress one .gz file. If the output is a TAR archive (i.e. input was
 * .tar.gz) and autoExtractTar is true, parse the TAR and populate tarEntries.
 */
export async function decompressOne(
  input: DecompressInput,
  autoExtractTar: boolean,
  customOutputName?: string,
): Promise<DecompressOutput> {
  if (!isGzipMagic(input.data)) {
    throw new Error(`${input.fileName}: not a GZIP file (missing 1f 8b magic).`);
  }
  const header = parseGzipHeader(input.data);
  if (!header.isValid) {
    throw new Error(`${input.fileName}: ${header.error ?? "invalid GZIP header"}.`);
  }
  const decompressed = await decompressGzip(input.data);
  const mime = detectMime(decompressed);
  const isTar = autoExtractTar && isTarArchive(decompressed);
  let tarEntries: TarEntry[] | undefined;
  if (isTar) {
    tarEntries = parseTarEntries(decompressed).filter((e) => e.isRegularFile);
  }
  const outputFileName = customOutputName && customOutputName.length > 0
    ? customOutputName
    : guessOutputFilename(header, input.fileName);
  const stat = computeStat(
    input.fileName,
    outputFileName,
    input.data.length,
    decompressed.length,
    mime.mime,
    mime.description,
    mime.isText,
    isTar,
    tarEntries?.length ?? 0,
  );
  return { fileName: input.fileName, outputFileName, data: decompressed, stat, tarEntries };
}

export interface BatchResult {
  outputs: DecompressOutput[];
  totalCompressed: number;
  totalDecompressed: number;
  blob: Blob | null;
}

/**
 * Decompress multiple .gz files. If any output is a TAR archive, its entries
 * are exposed individually. Returns a ZIP bundle when there are 2+ outputs.
 */
export async function decompressBatch(
  inputs: DecompressInput[],
  autoExtractTar: boolean,
  onProgress?: (current: number, total: number) => void,
): Promise<BatchResult> {
  const outputs: DecompressOutput[] = [];
  for (let i = 0; i < inputs.length; i++) {
    try {
      outputs.push(await decompressOne(inputs[i]!, autoExtractTar));
    } catch (e) {
      const header = parseGzipHeader(inputs[i]!.data);
      outputs.push({
        fileName: inputs[i]!.fileName,
        outputFileName: inputs[i]!.fileName,
        data: new Uint8Array(0),
        stat: {
          fileName: inputs[i]!.fileName,
          outputFileName: inputs[i]!.fileName,
          compressedSize: inputs[i]!.data.length,
          decompressedSize: 0,
          expansionRatio: 0,
          compressedFraction: 0,
          mime: "application/octet-stream",
          mimeDescription: "Error",
          isText: false,
          isTar: false,
          tarEntryCount: 0,
          error: (e as Error).message,
        },
      });
      void header;
    }
    onProgress?.(i + 1, inputs.length);
  }

  const totalCompressed = outputs.reduce((s, o) => s + o.stat.compressedSize, 0);
  const totalDecompressed = outputs.reduce((s, o) => s + o.stat.decompressedSize, 0);

  // Build ZIP if multiple files (or one TAR with multiple entries)
  const tarOutputs = outputs.filter((o) => o.tarEntries && o.tarEntries.length > 0);
  let blob: Blob | null = null;
  const zipFiles: Array<{ name: string; data: Uint8Array }> = [];
  for (const o of outputs) {
    if (o.tarEntries && o.tarEntries.length > 0) {
      // Add each TAR entry as a separate file
      for (const e of o.tarEntries) {
        if (e.isRegularFile) {
          zipFiles.push({ name: e.name, data: extractTarEntry(o.data, e) });
        }
      }
    } else if (o.data.length > 0) {
      zipFiles.push({ name: o.outputFileName, data: o.data });
    }
  }
  if (zipFiles.length > 1) {
    blob = createZipBlob(zipFiles);
  } else if (zipFiles.length === 1) {
    blob = new Blob([zipFiles[0]!.data as BlobPart], { type: outputs[0]?.stat.mime ?? "application/octet-stream" });
  }
  void tarOutputs;

  return { outputs, totalCompressed, totalDecompressed, blob };
}
