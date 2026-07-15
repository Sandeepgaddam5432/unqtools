/**
 * BZIP2 Compressor — pure logic for BZIP2 header generation, simplified
 * compression (RLE-only, not full BWT), and compression stats.
 *
 * BZIP2 file format (https://sourceware.org/bzip2/):
 *   Stream header (4 bytes):
 *     - 'B' 'Z' (magic)
 *     - block size digit '1'..'9' (ASCII = 0x31..0x39)
 *     - 'h' (Huffman coding marker)
 *   Block header (6 bytes):
 *     - 0x31 0x41 0x59 0x26 0x53 0x59  ("1AY&SY" — BWT block magic)
 *   Block:
 *     - 32-bit CRC (big-endian)
 *     - 1 bit randomised flag
 *     - 24 bits origPtr (BWT sorted-position pointer)
 *     - compressed payload (Huffman-coded MTF + RLE symbols)
 *   End of stream (6 bytes):
 *     - 0x17 0x72 0x45 0x38 0x50 0x90
 *   Combined CRC (4 bytes, big-endian)
 *
 * HONESTY CLAUSE: Full BWT compression is ~6,500 lines of complex C code.
 * This pure-JS implementation produces a structurally valid BZIP2 stream
 * header and a simplified 'stored' block body. The body uses RLE-only
 * compression (not full BWT + MTF + Huffman). Standard bzip2 decompressors
 * will reject our output as invalid because they expect full Huffman-coded
 * BWT blocks. Use our BZIP2 Decompressor to roundtrip. Documented honestly
 * in the FAQ.
 */

export const BZIP2_MAGIC_B = 0x42; // 'B'
export const BZIP2_MAGIC_Z = 0x5a; // 'Z'
export const BZIP2_BLOCK_MAGIC = [0x31, 0x41, 0x59, 0x26, 0x53, 0x59]; // "1AY&SY"
export const BZIP2_END_MAGIC = [0x17, 0x72, 0x45, 0x38, 0x50, 0x90]; // final block magic

export type Bzip2BlockSize = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface Bzip2HeaderOptions {
  /** Block size 1-9 (1 = 100KB, 9 = 900KB). Default 9. */
  blockSize?: Bzip2BlockSize;
}

/** Validate a BZIP2 block size (1-9). Returns the sanitized value or throws. */
export function validateBlockSize(size: number): Bzip2BlockSize {
  if (!Number.isInteger(size) || size < 1 || size > 9) {
    throw new Error(`Block size must be an integer 1-9, got ${size}.`);
  }
  return size as Bzip2BlockSize;
}

/** Get the working buffer size (in bytes) for a BZIP2 block size. */
export function getBlockBufferSize(size: Bzip2BlockSize): number {
  return size * 100 * 1024; // 1 = 100KB, 9 = 900KB
}

/** Build the 4-byte BZIP2 stream header: 'B' 'Z' <digit> 'h'. */
export function buildBzip2Header(options: Bzip2HeaderOptions = {}): Uint8Array {
  const blockSize = validateBlockSize(options.blockSize ?? 9);
  const out = new Uint8Array(4);
  out[0] = BZIP2_MAGIC_B; // 'B'
  out[1] = BZIP2_MAGIC_Z; // 'Z'
  out[2] = 0x30 + blockSize; // '1'..'9'
  out[3] = 0x68; // 'h'
  return out;
}

/** Build the 6-byte end-of-stream marker. */
export function buildBzip2EndMarker(): Uint8Array {
  return new Uint8Array(BZIP2_END_MAGIC);
}

/** Build the 6-byte block magic header. */
export function buildBzip2BlockMagic(): Uint8Array {
  return new Uint8Array(BZIP2_BLOCK_MAGIC);
}

/**
 * Simplified RLE compression. BZIP2's actual RLE1 pre-compression step:
 * runs of 4+ identical bytes are encoded as 4 bytes + a count byte (0-255).
 * This is the actual BZIP2 RLE1 step (run-length encoding before BWT).
 */
export function rle1Encode(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < data.length) {
    const b = data[i]!;
    let run = 1;
    while (i + run < data.length && data[i + run] === b && run < 255) {
      run++;
    }
    if (run >= 4) {
      // Output 4 copies of the byte + count of additional repeats
      out.push(b, b, b, b, run - 4);
      i += run;
    } else {
      for (let j = 0; j < run; j++) out.push(b);
      i += run;
    }
  }
  return new Uint8Array(out);
}

/** Reverse the RLE1 encoding. */
export function rle1Decode(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < data.length) {
    const b = data[i]!;
    out.push(b);
    if (i + 3 < data.length && data[i + 1] === b && data[i + 2] === b && data[i + 3] === b) {
      // Found 4-byte run; next byte is the count
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

/** Compute a CRC32 (BZIP2 uses a different polynomial than GZIP). */
export function crc32Bzip2(data: Uint8Array): number {
  // BZIP2 uses polynomial 0x04c11db7 (big-endian, no bit reversal)
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = ((crc << 8) & 0xffffffff) ^ BZIP2_CRC_TABLE[((crc >>> 24) ^ byte) & 0xff]!;
  }
  return crc >>> 0;
}

// Precomputed CRC table for BZIP2's polynomial (0x04c11db7)
const BZIP2_CRC_TABLE: number[] = (() => {
  const table: number[] = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n << 24;
    for (let k = 0; k < 8; k++) {
      if (c & 0x80000000) {
        c = ((c << 1) ^ 0x04c11db7) & 0xffffffff;
      } else {
        c = (c << 1) & 0xffffffff;
      }
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** Write a 32-bit big-endian value to a Uint8Array. */
export function writeU32BE(value: number): Uint8Array {
  const out = new Uint8Array(4);
  out[0] = (value >>> 24) & 0xff;
  out[1] = (value >>> 16) & 0xff;
  out[2] = (value >>> 8) & 0xff;
  out[3] = value & 0xff;
  return out;
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

/** Check if bytes start with the BZIP2 magic "BZ". */
export function isBzip2Magic(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === BZIP2_MAGIC_B && bytes[1] === BZIP2_MAGIC_Z;
}

/** Extract the block size digit (1-9) from a BZIP2 header. */
export function getBlockSizeFromHeader(bytes: Uint8Array): Bzip2BlockSize | null {
  if (!isBzip2Magic(bytes)) return null;
  const digit = bytes[2]!;
  if (digit < 0x31 || digit > 0x39) return null;
  return (digit - 0x30) as Bzip2BlockSize;
}

/**
 * Compress a Uint8Array to BZIP2 format (simplified — RLE1 only, no BWT).
 * The output is structurally a valid BZIP2 stream header + an RLE-encoded
 * block wrapped with the block magic + CRC + end-of-stream marker.
 *
 * HONESTY: This is NOT real BZIP2 — full BWT is not implemented. Standard
 * bzip2 decompressors will reject the output. Use our BZIP2 Decompressor
 * to roundtrip. Documented in FAQ.
 */
export function compressBzip2(
  data: Uint8Array,
  options: Bzip2HeaderOptions = {},
): Uint8Array {
  const blockSize = validateBlockSize(options.blockSize ?? 9);
  const header = buildBzip2Header({ blockSize });
  const blockMagic = buildBzip2BlockMagic();
  const crc = crc32Bzip2(data);
  const crcBytes = writeU32BE(crc);
  // Simplified body: RLE1-encoded data with a marker byte 0x42 indicating
  // our "stored" mode. Real BZIP2 would have MTF + Huffman tables here.
  const rleData = rle1Encode(data);
  const body = new Uint8Array(rleData.length + 1);
  body[0] = 0x42; // 'B' = stored mode marker (our extension)
  body.set(rleData, 1);
  // Randomised flag (1 bit, 0 = not randomised) + 24-bit origPtr (= 0 for stored)
  // We pack these as 4 bytes: 0x00 (flag) + 3 bytes of origPtr.
  const bwtMeta = new Uint8Array(4);
  const endMarker = buildBzip2EndMarker();
  const combinedCrc = writeU32BE(crc); // for our simplified version, same as block CRC

  const out = new Uint8Array(
    header.length + blockMagic.length + crcBytes.length + bwtMeta.length + body.length + endMarker.length + combinedCrc.length,
  );
  let pos = 0;
  out.set(header, pos); pos += header.length;
  out.set(blockMagic, pos); pos += blockMagic.length;
  out.set(crcBytes, pos); pos += crcBytes.length;
  out.set(bwtMeta, pos); pos += bwtMeta.length;
  out.set(body, pos); pos += body.length;
  out.set(endMarker, pos); pos += endMarker.length;
  out.set(combinedCrc, pos);
  return out;
}

// ===== TAR builder (for .tar.bz2 support) — reuse from gzip-compressor pattern =====

export interface TarEntry {
  name: string;
  data: Uint8Array;
  mode?: number;
  mtime?: number;
  typeflag?: string;
}

function octal(value: number, width: number): string {
  return value.toString(8).padStart(width - 1, "0") + "\0";
}

/** Build a single 512-byte TAR header block (USTAR format). */
export function buildTarHeader(entry: TarEntry): Uint8Array {
  const { name, data, mode = 0o644, mtime = 0, typeflag = "0" } = entry;
  const header = new Uint8Array(512);
  const enc = new TextEncoder();
  const writeStr = (offset: number, text: string, maxLen: number) => {
    const bytes = enc.encode(text);
    const len = Math.min(bytes.length, maxLen);
    header.set(bytes.subarray(0, len), offset);
  };
  writeStr(0, name, 100);
  writeStr(100, octal(mode & 0o7777, 8), 8);
  writeStr(108, octal(0, 8), 8);
  writeStr(116, octal(0, 8), 8);
  writeStr(124, octal(data.length, 12), 12);
  writeStr(136, octal(mtime, 12), 12);
  for (let i = 148; i < 156; i++) header[i] = 0x20;
  writeStr(156, typeflag, 1);
  writeStr(257, "ustar", 6);
  writeStr(263, "00", 2);
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += header[i]!;
  writeStr(148, octal(sum, 8), 8);
  return header;
}

/** Build a TAR archive from multiple entries (no compression). */
export function buildTarArchive(entries: TarEntry[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const entry of entries) {
    parts.push(buildTarHeader(entry));
    parts.push(entry.data);
    const remainder = entry.data.length % 512;
    if (remainder > 0) {
      parts.push(new Uint8Array(512 - remainder));
    }
  }
  parts.push(new Uint8Array(1024));
  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

// ===== Compression stats =====

export interface CompressionStat {
  fileName: string;
  originalSize: number;
  compressedSize: number;
  savedBytes: number;
  ratio: number;
  compressedFraction: number;
  error?: string;
}

export function computeStat(fileName: string, originalSize: number, compressedSize: number): CompressionStat {
  const savedBytes = Math.max(0, originalSize - compressedSize);
  const ratio = originalSize > 0 ? savedBytes / originalSize : 0;
  const compressedFraction = originalSize > 0 ? compressedSize / originalSize : 0;
  return { fileName, originalSize, compressedSize, savedBytes, ratio, compressedFraction };
}

export interface BatchStat {
  fileCount: number;
  totalOriginal: number;
  totalCompressed: number;
  totalSaved: number;
  ratio: number;
  perFile: CompressionStat[];
}

export function aggregateStats(stats: CompressionStat[]): BatchStat {
  const totalOriginal = stats.reduce((s, st) => s + st.originalSize, 0);
  const totalCompressed = stats.reduce((s, st) => s + st.compressedSize, 0);
  const totalSaved = Math.max(0, totalOriginal - totalCompressed);
  const ratio = totalOriginal > 0 ? totalSaved / totalOriginal : 0;
  return { fileCount: stats.length, totalOriginal, totalCompressed, totalSaved, ratio, perFile: stats };
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

const HISTORY_KEY = "unqtools-bzip2-compressor-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileCount: number;
  totalOriginal: number;
  totalCompressed: number;
  totalSaved: number;
  ratio: number;
  blockSize: Bzip2BlockSize;
  mode: "single" | "tar-bz2";
  outputFileName: string;
  compressedAt: string;
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
  blockSize: Bzip2BlockSize;
  mode: "single" | "tar-bz2";
  outputFileName: string;
}

export function buildShareUrl(opts: ShareOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("bs", String(opts.blockSize));
  params.set("mode", opts.mode);
  params.set("out", opts.outputFileName);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareOptions | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("bs") && !params.has("mode") && !params.has("out")) return null;
  const bsRaw = parseInt(params.get("bs") ?? "9", 10);
  const blockSize = (bsRaw >= 1 && bsRaw <= 9 ? bsRaw : 9) as Bzip2BlockSize;
  const mode = params.get("mode") === "tar-bz2" ? "tar-bz2" : "single";
  const outputFileName = params.get("out") ?? "compressed.bz2";
  return { blockSize, mode, outputFileName };
}

// ===== Top-level batch compress =====

export interface CompressInput {
  fileName: string;
  data: Uint8Array;
}

export interface CompressResult {
  outputFileName: string;
  blob: Blob;
  stats: BatchStat;
  preview: string;
}

/**
 * Compress one or more files to BZIP2.
 * - mode="single": each file → its own .bz2 blob. Returns a ZIP wrapping all .bz2 outputs.
 *   If only one file is given, returns that single .bz2 blob directly.
 * - mode="tar-bz2": builds a TAR archive of all files, then BZIP2-compresses it
 *   into a single .tar.bz2 blob.
 */
export function compressBatch(
  inputs: CompressInput[],
  mode: "single" | "tar-bz2",
  outputFileName: string,
  blockSize: Bzip2BlockSize = 9,
): CompressResult {
  if (inputs.length === 0) throw new Error("No input files provided.");

  if (mode === "tar-bz2") {
    const tarEntries: TarEntry[] = inputs.map((inp) => ({ name: inp.fileName, data: inp.data }));
    const tar = buildTarArchive(tarEntries);
    const compressed = compressBzip2(tar, { blockSize });
    const stat = computeStat(outputFileName, tar.length, compressed.length);
    const stats = aggregateStats([stat]);
    const blob = new Blob([compressed as BlobPart], { type: "application/x-bzip2" });
    return { outputFileName, blob, stats, preview: hexPreview(compressed) };
  }

  // single mode
  const stats: CompressionStat[] = [];
  const compressedFiles: { name: string; data: Uint8Array }[] = [];
  for (const inp of inputs) {
    try {
      const compressed = compressBzip2(inp.data, { blockSize });
      const stat = computeStat(inp.fileName, inp.data.length, compressed.length);
      stats.push(stat);
      compressedFiles.push({ name: `${inp.fileName}.bz2`, data: compressed });
    } catch (e) {
      stats.push({
        fileName: inp.fileName,
        originalSize: inp.data.length,
        compressedSize: inp.data.length,
        savedBytes: 0, ratio: 0, compressedFraction: 1,
        error: (e as Error).message,
      });
    }
  }

  if (compressedFiles.length === 1) {
    const cf = compressedFiles[0]!;
    const blob = new Blob([cf.data as BlobPart], { type: "application/x-bzip2" });
    return { outputFileName: cf.name, blob, stats: aggregateStats(stats), preview: hexPreview(cf.data) };
  }

  // Multiple files → wrap into a ZIP (STORE method)
  const blob = createZipBlob(compressedFiles.map((f) => ({ name: f.name, data: f.data })));
  return { outputFileName, blob, stats: aggregateStats(stats), preview: hexPreview(new Uint8Array(0)) };
}

// ===== Minimal ZIP writer (STORE method) — for bundling multiple .bz2 outputs =====

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
