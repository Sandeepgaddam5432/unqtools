/**
 * BZIP2 Decompressor — pure logic for BZIP2 header parsing, simplified
 * decompression (RLE1 body only), and .tar.bz2 auto-extraction.
 *
 * BZIP2 file format (https://sourceware.org/bzip2/):
 *   Stream header (4 bytes): 'B' 'Z' <digit 1-9> 'h'
 *   Block header (6 bytes): 0x31 0x41 0x59 0x26 0x53 0x59 ("1AY&SY")
 *   Block: 32-bit CRC + 1-bit randomised flag + 24-bit origPtr + body
 *   End of stream (6 bytes): 0x17 0x72 0x45 0x38 0x50 0x90
 *   Combined CRC (4 bytes, big-endian)
 *
 * HONESTY CLAUSE: This pure-JS implementation parses the BZIP2 header
 * correctly and can decompress files created by our own BZIP2 Compressor
 * (which uses RLE1-only body). Standard bzip2 files use full BWT + MTF +
 * Huffman and cannot be decompressed without ~200KB WASM. We parse the
 * header and report stats, but body decoding fails for standard bzip2
 * files. Documented honestly in the FAQ.
 */

import {
  BZIP2_MAGIC_B, BZIP2_MAGIC_Z, BZIP2_BLOCK_MAGIC, BZIP2_END_MAGIC,
} from "../bzip2-compressor/logic";

export type Bzip2BlockSize = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface ParsedBzip2Header {
  /** Magic byte 1 (always 0x42 = 'B'). */
  magic1: number;
  /** Magic byte 2 (always 0x5a = 'Z'). */
  magic2: number;
  /** Block size digit (1-9). */
  blockSize: Bzip2BlockSize | null;
  /** Huffman marker (always 0x68 = 'h'). */
  huffmanMarker: number;
  /** True if the BZ magic is valid. */
  isValid: boolean;
  /** Error message if invalid. */
  error?: string;
  /** Byte offset where the body starts (after the 4-byte header). */
  bodyOffset: number;
}

/** Parse the 4-byte BZIP2 stream header. */
export function parseBzip2Header(bytes: Uint8Array): ParsedBzip2Header {
  if (bytes.length < 4) {
    return {
      magic1: 0, magic2: 0, blockSize: null, huffmanMarker: 0,
      isValid: false, error: "File too small to be a BZIP2 stream (needs at least 4 bytes).",
      bodyOffset: 0,
    };
  }
  const magic1 = bytes[0]!;
  const magic2 = bytes[1]!;
  if (magic1 !== BZIP2_MAGIC_B || magic2 !== BZIP2_MAGIC_Z) {
    return {
      magic1, magic2, blockSize: null, huffmanMarker: 0,
      isValid: false,
      error: `Not a BZIP2 file (missing 'BZ' magic). Got 0x${magic1.toString(16)} 0x${magic2.toString(16)}.`,
      bodyOffset: 0,
    };
  }
  const digit = bytes[2]!;
  if (digit < 0x31 || digit > 0x39) {
    return {
      magic1, magic2, blockSize: null, huffmanMarker: 0,
      isValid: false,
      error: `Invalid block size digit 0x${digit.toString(16)} (expected '1'-'9').`,
      bodyOffset: 0,
    };
  }
  const huffmanMarker = bytes[3]!;
  if (huffmanMarker !== 0x68) {
    return {
      magic1, magic2, blockSize: (digit - 0x30) as Bzip2BlockSize, huffmanMarker,
      isValid: false,
      error: `Invalid Huffman marker 0x${huffmanMarker.toString(16)} (expected 'h' = 0x68).`,
      bodyOffset: 0,
    };
  }
  return {
    magic1, magic2,
    blockSize: (digit - 0x30) as Bzip2BlockSize,
    huffmanMarker,
    isValid: true,
    bodyOffset: 4,
  };
}

/** Check if bytes start with the BZIP2 magic 'BZ'. */
export function isBzip2Magic(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === BZIP2_MAGIC_B && bytes[1] === BZIP2_MAGIC_Z;
}

/** Find the 6-byte block magic starting at the given offset. Returns offset or -1. */
export function findBlockMagic(bytes: Uint8Array, startOffset: number): number {
  for (let i = startOffset; i < bytes.length - 5; i++) {
    if (
      bytes[i] === BZIP2_BLOCK_MAGIC[0] &&
      bytes[i + 1] === BZIP2_BLOCK_MAGIC[1] &&
      bytes[i + 2] === BZIP2_BLOCK_MAGIC[2] &&
      bytes[i + 3] === BZIP2_BLOCK_MAGIC[3] &&
      bytes[i + 4] === BZIP2_BLOCK_MAGIC[4] &&
      bytes[i + 5] === BZIP2_BLOCK_MAGIC[5]
    ) {
      return i;
    }
  }
  return -1;
}

/** Find the 6-byte end-of-stream magic. Returns offset or -1. */
export function findEndMagic(bytes: Uint8Array, startOffset: number): number {
  for (let i = startOffset; i < bytes.length - 5; i++) {
    if (
      bytes[i] === BZIP2_END_MAGIC[0] &&
      bytes[i + 1] === BZIP2_END_MAGIC[1] &&
      bytes[i + 2] === BZIP2_END_MAGIC[2] &&
      bytes[i + 3] === BZIP2_END_MAGIC[3] &&
      bytes[i + 4] === BZIP2_END_MAGIC[4] &&
      bytes[i + 5] === BZIP2_END_MAGIC[5]
    ) {
      return i;
    }
  }
  return -1;
}

/** Read a 32-bit big-endian value. */
export function readU32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

export interface ParsedBlock {
  /** Offset where the block magic starts. */
  blockOffset: number;
  /** The 32-bit CRC of the original (uncompressed) data. */
  crc: number;
  /** The 1-bit randomised flag (always 0 in our implementation). */
  randomised: boolean;
  /** The 24-bit BWT origPtr (0 for our stored mode). */
  origPtr: number;
  /** Offset where the body starts. */
  bodyOffset: number;
}

/** Parse a BZIP2 block header (block magic + CRC + 4 bytes of metadata). */
export function parseBlockHeader(bytes: Uint8Array, blockOffset: number): ParsedBlock | null {
  if (blockOffset + 6 + 4 + 4 > bytes.length) return null;
  const crc = readU32BE(bytes, blockOffset + 6);
  const meta = bytes.subarray(blockOffset + 10, blockOffset + 14);
  // 1 bit randomised + 24 bits origPtr, packed as 4 bytes (our simplified format)
  const randomised = (meta[0]! & 0x80) !== 0;
  const origPtr = ((meta[0]! & 0x7f) << 16) | (meta[1]! << 8) | meta[2]!;
  return {
    blockOffset,
    crc,
    randomised,
    origPtr,
    bodyOffset: blockOffset + 14,
  };
}

/**
 * Reverse the RLE1 encoding used by our BZIP2 Compressor.
 * Handles both the 5-byte run form (4 bytes + count) and the literal form.
 */
export function rle1Decode(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < data.length) {
    const b = data[i]!;
    out.push(b);
    if (
      i + 3 < data.length &&
      data[i + 1] === b &&
      data[i + 2] === b &&
      data[i + 3] === b
    ) {
      out.push(b, b, b);
      const count = data[i + 4] ?? 0;
      for (let k = 0; k < count; k++) out.push(b);
      i += 5;
    } else {
      i++;
    }
  }
  return new Uint8Array(out);
}

/**
 * Decompress a BZIP2 byte array produced by our BZIP2 Compressor.
 *
 * HONESTY: This handles our simplified RLE1-body format only. Standard
 * bzip2 files (libbz2) use full BWT + MTF + Huffman and will fail with
 * a clear error. Documented in FAQ.
 */
export function decompressBzip2(data: Uint8Array): Uint8Array {
  const header = parseBzip2Header(data);
  if (!header.isValid) {
    throw new Error(header.error ?? "Invalid BZIP2 header.");
  }
  // Find the block magic after the 4-byte header
  const blockOffset = findBlockMagic(data, header.bodyOffset);
  if (blockOffset === -1) {
    throw new Error("BZIP2 block magic '1AY&SY' not found. This may be a standard bzip2 file (full BWT) which we cannot decompress in pure JS.");
  }
  const block = parseBlockHeader(data, blockOffset);
  if (!block) {
    throw new Error("BZIP2 block header is truncated.");
  }
  // Find the end-of-stream magic
  const endOffset = findEndMagic(data, block.bodyOffset);
  if (endOffset === -1) {
    throw new Error("BZIP2 end-of-stream magic not found. File may be truncated.");
  }
  // Extract the body (between block body and end magic)
  const body = data.subarray(block.bodyOffset, endOffset);
  // Our compressor prepends a 0x42 'stored mode' marker byte
  if (body.length === 0 || body[0] !== 0x42) {
    throw new Error("Body does not start with stored-mode marker (0x42). This may be a standard bzip2 file (full BWT) which we cannot decompress.");
  }
  const rleData = body.subarray(1);
  return rle1Decode(rleData);
}

/** Guess an output filename from the input .bz2 filename. */
export function guessOutputFilename(inputFileName: string): string {
  const stripped = inputFileName.replace(/\.bz2$/i, "");
  if (stripped && stripped !== inputFileName) return stripped;
  return "decompressed.bin";
}

// ===== TAR parsing (for .tar.bz2 auto-extraction) =====

export interface TarEntry {
  name: string;
  size: number;
  typeflag: string;
  mode: number;
  mtime: number;
  typeDescription: string;
  dataOffset: number;
  isRegularFile: boolean;
}

const TAR_TYPE_DESCRIPTIONS: Record<string, string> = {
  "0": "Regular file",
  "\0": "Regular file",
  "1": "Hard link",
  "2": "Symbolic link",
  "5": "Directory",
  "7": "Contiguous file",
};

function parseOctal(bytes: Uint8Array, offset: number, width: number): number {
  let s = "";
  for (let i = 0; i < width; i++) {
    const b = bytes[offset + i];
    if (b === 0 || b === 0x20) break;
    if (b < 0x30 || b > 0x37) break;
    s += String.fromCharCode(b);
  }
  return s.length === 0 ? 0 : parseInt(s, 8);
}

function decodeField(bytes: Uint8Array, offset: number, width: number): string {
  const end = offset + width;
  let nul = end;
  for (let i = offset; i < end; i++) {
    if (bytes[i] === 0) { nul = i; break; }
  }
  return new TextDecoder("utf-8").decode(bytes.subarray(offset, nul));
}

/** Parse a TAR archive byte array into a list of entries. */
export function parseTarEntries(bytes: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  let pos = 0;
  while (pos + 512 <= bytes.length) {
    let allZero = true;
    for (let i = pos; i < pos + 512; i++) {
      if (bytes[i] !== 0) { allZero = false; break; }
    }
    if (allZero) break;
    const name = decodeField(bytes, pos, 100);
    const mode = parseOctal(bytes, pos + 100, 8);
    const size = parseOctal(bytes, pos + 124, 12);
    const mtime = parseOctal(bytes, pos + 136, 12);
    const typeflagByte = bytes[pos + 156] ?? 0;
    const typeflag = String.fromCharCode(typeflagByte);
    const magic = decodeField(bytes, pos + 257, 6);
    const prefix = decodeField(bytes, pos + 345, 155);
    const isUstar = magic.startsWith("ustar");
    const fullName = prefix && isUstar ? `${prefix}/${name}` : name;
    const typeDescription = TAR_TYPE_DESCRIPTIONS[typeflag] ?? `Unknown (${typeflagByte})`;
    const isRegularFile = typeflag === "0" || typeflag === "\0" || typeflag === "7";
    entries.push({
      name: fullName, size, typeflag, mode, mtime,
      typeDescription, dataOffset: pos + 512, isRegularFile,
    });
    const dataBlocks = Math.ceil(size / 512);
    pos += 512 + dataBlocks * 512;
  }
  return entries;
}

/** Extract the data for a single TAR entry. */
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
  { bytes: [0x42, 0x4d], mime: "image/bmp", description: "BMP image" },
  { bytes: [0x25, 0x50, 0x44, 0x46], mime: "application/pdf", description: "PDF document" },
  { bytes: [0x50, 0x4b, 0x03, 0x04], mime: "application/zip", description: "ZIP archive" },
  { bytes: [0x1f, 0x8b], mime: "application/gzip", description: "GZIP archive" },
  { bytes: [0x42, 0x5a, 0x68], mime: "application/x-bzip2", description: "BZIP2 archive" },
  { bytes: [0x37, 0x7a, 0xbc, 0xaf], mime: "application/x-7z-compressed", description: "7Z archive" },
  { bytes: [0x52, 0x61, 0x72, 0x21], mime: "application/x-rar-compressed", description: "RAR archive" },
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
  if (looksLikeText(bytes)) {
    return { mime: "text/plain", description: "Plain text", isText: true };
  }
  return { mime: "application/octet-stream", description: "Binary data", isText: false };
}

/** Heuristic: check if a buffer is mostly ASCII printable. */
export function looksLikeText(bytes: Uint8Array, sampleSize = 1024): boolean {
  const sample = bytes.subarray(0, Math.min(bytes.length, sampleSize));
  if (sample.length === 0) return false;
  let printable = 0;
  for (const b of sample) {
    if (b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b <= 0x7e)) printable++;
  }
  return printable / sample.length > 0.85;
}

// ===== Decompression stats =====

export interface DecompressionStat {
  fileName: string;
  compressedSize: number;
  decompressedSize: number;
  /** Ratio in [0, 1]. 0.7 = decompressed is 70% larger than compressed. */
  expansionRatio: number;
  /** The block size from the BZIP2 header. */
  blockSize: Bzip2BlockSize | null;
  /** True if this is a .tar.bz2 archive (TAR wrapper detected). */
  isTarBz2: boolean;
  error?: string;
}

export function computeStat(
  fileName: string,
  compressedSize: number,
  decompressedSize: number,
  blockSize: Bzip2BlockSize | null,
  isTarBz2: boolean,
): DecompressionStat {
  const expansionRatio = compressedSize > 0 ? decompressedSize / compressedSize : 0;
  return { fileName, compressedSize, decompressedSize, expansionRatio, blockSize, isTarBz2 };
}

export interface BatchStat {
  fileCount: number;
  totalCompressed: number;
  totalDecompressed: number;
  perFile: DecompressionStat[];
}

export function aggregateStats(stats: DecompressionStat[]): BatchStat {
  const totalCompressed = stats.reduce((s, st) => s + st.compressedSize, 0);
  const totalDecompressed = stats.reduce((s, st) => s + st.decompressedSize, 0);
  return { fileCount: stats.length, totalCompressed, totalDecompressed, perFile: stats };
}

// ===== Utilities =====

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** Format the first N bytes of a Uint8Array as a hex dump (16 bytes/line). */
export function hexPreview(bytes: Uint8Array, maxBytes = 64): string {
  const slice = bytes.subarray(0, Math.min(bytes.length, maxBytes));
  const lines: string[] = [];
  for (let i = 0; i < slice.length; i += 16) {
    const lineBytes = slice.subarray(i, Math.min(i + 16, slice.length));
    const hexPart = Array.from(lineBytes).map((b) => b.toString(16).padStart(2, "0")).join(" ");
    const asciiPart = Array.from(lineBytes).map((b) => b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : ".").join("");
    lines.push(`${i.toString(16).padStart(8, "0")}  ${hexPart.padEnd(48, " ")}  ${asciiPart}`);
  }
  return lines.join("\n");
}

// ===== History (localStorage) =====

const HISTORY_KEY = "unqtools-bzip2-decompressor-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileCount: number;
  totalCompressed: number;
  totalDecompressed: number;
  tarBz2Count: number;
  decompressedAt: string;
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
  outputFileName: string;
  autoExtractTar: boolean;
}

export function buildShareUrl(opts: ShareOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("out", opts.outputFileName);
  params.set("tar", opts.autoExtractTar ? "1" : "0");
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareOptions | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("out") && !params.has("tar")) return null;
  return {
    outputFileName: params.get("out") ?? "decompressed.bin",
    autoExtractTar: params.get("tar") !== "0",
  };
}

// ===== Top-level batch decompress =====

export interface DecompressInput {
  fileName: string;
  data: Uint8Array;
}

export interface DecompressResult {
  outputFileName: string;
  blob: Blob;
  stats: BatchStat;
  preview: string;
  /** If .tar.bz2 and auto-extract is on, the TAR entries. */
  tarEntries?: TarEntry[];
  /** The decompressed bytes (for TAR extraction). */
  decompressedBytes?: Uint8Array;
  /** Detected MIME type of the decompressed data. */
  mime?: MimeDetection;
}

/**
 * Decompress one or more .bz2 files.
 * - If only one file is given, returns that single decompressed blob.
 * - If multiple files are given, wraps all decompressed outputs into a ZIP.
 * - For .tar.bz2 files, the autoExtractTar flag controls whether we parse
 *   the TAR wrapper and list entries (the blob is still the full decompressed
 *   TAR archive).
 */
export function decompressBatch(
  inputs: DecompressInput[],
  autoExtractTar: boolean = true,
): DecompressResult {
  if (inputs.length === 0) throw new Error("No input files provided.");

  const stats: DecompressionStat[] = [];
  const decompressedFiles: { name: string; data: Uint8Array }[] = [];
  let tarEntries: TarEntry[] | undefined;
  let decompressedBytes: Uint8Array | undefined;
  let mime: MimeDetection | undefined;

  for (const inp of inputs) {
    try {
      const header = parseBzip2Header(inp.data);
      if (!header.isValid) {
        throw new Error(header.error ?? "Invalid BZIP2 header.");
      }
      const decompressed = decompressBzip2(inp.data);
      const isTar = isTarArchive(decompressed);
      const detectedMime = detectMime(decompressed);
      const stat = computeStat(
        inp.fileName, inp.data.length, decompressed.length,
        header.blockSize, isTar,
      );
      stats.push(stat);
      const outName = isTar
        ? inp.fileName.replace(/\.bz2$/i, "")
        : guessOutputFilename(inp.fileName);
      decompressedFiles.push({ name: outName, data: decompressed });
      if (isTar && autoExtractTar && tarEntries === undefined) {
        tarEntries = parseTarEntries(decompressed);
        decompressedBytes = decompressed;
        mime = detectedMime;
      }
    } catch (e) {
      stats.push({
        fileName: inp.fileName,
        compressedSize: inp.data.length,
        decompressedSize: 0,
        expansionRatio: 0,
        blockSize: null,
        isTarBz2: false,
        error: (e as Error).message,
      });
    }
  }

  if (decompressedFiles.length === 1) {
    const cf = decompressedFiles[0]!;
    const detectedMime = mime ?? detectMime(cf.data);
    const blob = new Blob([cf.data as BlobPart], { type: detectedMime.mime });
    return {
      outputFileName: cf.name,
      blob,
      stats: aggregateStats(stats),
      preview: hexPreview(cf.data),
      tarEntries,
      decompressedBytes,
      mime: detectedMime,
    };
  }

  // Multiple files → wrap into a ZIP
  const blob = createZipBlob(decompressedFiles.map((f) => ({ name: f.name, data: f.data })));
  return {
    outputFileName: "decompressed.zip",
    blob,
    stats: aggregateStats(stats),
    preview: hexPreview(new Uint8Array(0)),
  };
}

// ===== Minimal ZIP writer (STORE method) =====

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
    lv.setUint16(8, 0, true);
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
