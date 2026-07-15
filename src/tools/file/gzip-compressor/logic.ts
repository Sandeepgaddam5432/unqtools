/**
 * GZIP Compressor — pure logic for GZIP header generation, filename embedding,
 * and compression stats. Actual compression uses the browser's native
 * CompressionStream('gzip') API.
 *
 * GZIP format (RFC 1952):
 *   Header (10+ bytes):
 *     - ID1 (0x1f), ID2 (0x8b) — magic
 *     - CM (compression method, 8 = deflate)
 *     - FLG (flags: FTEXT, FHCRC, FEXTRA, FNAME, FCOMMENT)
 *     - MTIME (4 bytes, Unix timestamp; 0 = unknown)
 *     - XFL (extra flags, 0 = default, 2 = best compression, 4 = best speed)
 *     - OS (operating system, 3 = Unix, 0 = FAT, 255 = unknown)
 *   Optional fields based on FLG:
 *     - FNAME: zero-terminated original filename
 *     - FCOMMENT: zero-terminated comment
 *     - FEXTRA: 2-byte length + extra data
 *     - FHCRC: 2-byte CRC16 of header
 *   Body: deflate-compressed data (from CompressionStream)
 *   Footer (8 bytes):
 *     - CRC32 (4 bytes, of uncompressed data)
 *     - ISIZE (4 bytes, uncompressed size mod 2^32)
 */

export interface GzipHeaderOptions {
  /** Original filename to embed in the GZIP header (FNAME flag). */
  filename?: string;
  /** Unix timestamp (seconds). 0 = unknown. */
  mtime?: number;
  /** Extra flags: 0 = default, 2 = best compression, 4 = best speed. */
  xfl?: number;
  /** Operating system: 3 = Unix, 0 = FAT, 255 = unknown. */
  os?: number;
  /** Mark as ASCII text (FTEXT flag). */
  isText?: boolean;
}

export const GZIP_MAGIC1 = 0x1f;
export const GZIP_MAGIC2 = 0x8b;
export const GZIP_METHOD_DEFLATE = 8;

export const FTEXT = 0x01;
export const FHCRC = 0x02;
export const FEXTRA = 0x04;
export const FNAME = 0x08;
export const FCOMMENT = 0x10;

/** Sanitize a filename for embedding in the GZIP header (strip directory path). */
export function sanitizeGzipFilename(name: string): string {
  // RFC 1952: filename should not contain directory components.
  // We strip leading path separators and take the basename.
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "";
  // Strip .gz / .gzip extension if present (we are creating it).
  return base.replace(/\.(gz|gzip)$/i, "");
}

/** Build the GZIP header bytes (10-byte fixed + optional FNAME field). */
export function buildGzipHeader(options: GzipHeaderOptions = {}): Uint8Array {
  const {
    filename,
    mtime = 0,
    xfl = 0,
    os = 3,
    isText = false,
  } = options;

  const cleanName = filename ? sanitizeGzipFilename(filename) : "";
  let flags = 0;
  if (isText) flags |= FTEXT;
  if (cleanName) flags |= FNAME;

  // Header: 10 bytes fixed + name + null terminator
  const nameBytes = cleanName ? new TextEncoder().encode(cleanName) : new Uint8Array(0);
  const headerLen = 10 + nameBytes.length + (cleanName ? 1 : 0);
  const out = new Uint8Array(headerLen);
  const dv = new DataView(out.buffer);

  // Magic
  out[0] = GZIP_MAGIC1;
  out[1] = GZIP_MAGIC2;
  // Compression method (deflate)
  out[2] = GZIP_METHOD_DEFLATE;
  // Flags
  out[3] = flags;
  // MTIME (4 bytes, little-endian)
  dv.setUint32(4, mtime >>> 0, true);
  // XFL
  out[8] = xfl & 0xff;
  // OS
  out[9] = os & 0xff;
  // FNAME field (zero-terminated)
  if (cleanName) {
    out.set(nameBytes, 10);
    out[10 + nameBytes.length] = 0; // null terminator
  }
  return out;
}

/** Build the GZIP footer (8 bytes: CRC32 + ISIZE). */
export function buildGzipFooter(crc32: number, uncompressedSize: number): Uint8Array {
  const out = new Uint8Array(8);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, crc32 >>> 0, true);
  dv.setUint32(4, uncompressedSize >>> 0, true);
  return out;
}

/** CRC32 (RFC 1952 polynomial 0xedb88320). Returns unsigned 32-bit number. */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Validate that bytes start with the GZIP magic (1f 8b). */
export function isGzipMagic(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === GZIP_MAGIC1 && bytes[1] === GZIP_MAGIC2;
}

/**
 * Compress a Uint8Array using CompressionStream('gzip').
 * Returns the GZIP-compressed bytes including header + footer (full .gz file).
 * The CompressionStream output already contains a valid header + footer, so
 * this function returns it as-is. Use `compressWithEmbeddedFilename` if you
 * need to inject a custom filename into the header.
 */
export async function compressGzip(data: Uint8Array): Promise<Uint8Array> {
  // Node 20+ and modern browsers expose CompressionStream globally.
  const stream = new CompressionStream("gzip");
  // Copy into a fresh buffer to satisfy BlobPart typing across runtimes.
  const blob = new Blob([data as BlobPart]);
  const writer = stream.writable.getWriter();
  writer.write(await blob.arrayBuffer());
  writer.close();
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let totalLen = 0;
   
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      totalLen += value.length;
    }
  }
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

/**
 * Compress `data` and rewrite the GZIP header to embed the original `filename`
 * (FNAME flag) and the supplied mtime. The CompressionStream header has FNAME=0,
 * so we strip the 10-byte default header, build a new one with FNAME, and
 * preserve the body + 8-byte footer (CRC32 + ISIZE) verbatim.
 */
export async function compressGzipWithFilename(
  data: Uint8Array,
  filename: string,
  options: Omit<GzipHeaderOptions, "filename"> = {},
): Promise<Uint8Array> {
  const compressed = await compressGzip(data);
  if (compressed.length < 18) {
    // Header (10) + footer (8) minimum. Should never happen.
    return compressed;
  }
  // Strip the 10-byte default header produced by CompressionStream; keep body + 8-byte footer.
  const bodyAndFooter = compressed.subarray(10);
  const newHeader = buildGzipHeader({ ...options, filename });
  const out = new Uint8Array(newHeader.length + bodyAndFooter.length);
  out.set(newHeader, 0);
  out.set(bodyAndFooter, newHeader.length);
  return out;
}

// ===== TAR builder (for .tar.gz support) =====

export interface TarEntry {
  name: string;
  data: Uint8Array;
  /** File mode (permissions). Default 0o644. */
  mode?: number;
  /** Modification time (Unix seconds). Default 0. */
  mtime?: number;
  /** Type flag: "0" or "\0" = regular file. */
  typeflag?: string;
}

/** Pad a number to fixed-width octal string with trailing NUL. */
function octal(value: number, width: number): string {
  return value.toString(8).padStart(width - 1, "0") + "\0";
}

/** Build a single 512-byte TAR header block (USTAR format). */
export function buildTarHeader(entry: TarEntry): Uint8Array {
  const {
    name,
    data,
    mode = 0o644,
    mtime = 0,
    typeflag = "0",
  } = entry;
  const header = new Uint8Array(512);
  const enc = new TextEncoder();
  const writeStr = (offset: number, text: string, maxLen: number) => {
    const bytes = enc.encode(text);
    const len = Math.min(bytes.length, maxLen);
    header.set(bytes.subarray(0, len), offset);
  };
  // name (100 bytes)
  writeStr(0, name, 100);
  // mode (8 bytes, octal)
  writeStr(100, octal(mode & 0o7777, 8), 8);
  // uid (8 bytes, octal) — 0
  writeStr(108, octal(0, 8), 8);
  // gid (8 bytes, octal) — 0
  writeStr(116, octal(0, 8), 8);
  // size (12 bytes, octal)
  writeStr(124, octal(data.length, 12), 12);
  // mtime (12 bytes, octal)
  writeStr(136, octal(mtime, 12), 12);
  // checksum (8 bytes) — fill with spaces for now, compute later
  for (let i = 148; i < 156; i++) header[i] = 0x20;
  // typeflag (1 byte)
  writeStr(156, typeflag, 1);
  // linkname (100 bytes) — empty for regular files
  // magic (6 bytes) — "ustar\0"
  writeStr(257, "ustar", 6);
  // version (2 bytes) — "00"
  writeStr(263, "00", 2);
  // uname (32 bytes) — empty
  // gname (32 bytes) — empty
  // devmajor (8 bytes) — empty
  // devminor (8 bytes) — empty
  // prefix (155 bytes) — empty

  // Compute checksum (sum of all bytes with checksum field treated as spaces)
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += header[i];
  const sumStr = octal(sum, 8);
  writeStr(148, sumStr, 8);
  return header;
}

/** Build a TAR archive from multiple entries (no compression). */
export function buildTarArchive(entries: TarEntry[]): Uint8Array {
  const parts: Uint8Array[] = [];
  for (const entry of entries) {
    parts.push(buildTarHeader(entry));
    parts.push(entry.data);
    // Pad data to 512-byte boundary
    const remainder = entry.data.length % 512;
    if (remainder > 0) {
      parts.push(new Uint8Array(512 - remainder));
    }
  }
  // End-of-archive: two 512-byte zero blocks
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
  /** Ratio in [0, 1]. 0.6 = 60% size reduction. */
  ratio: number;
  /** Relative compressed size; 0.4 = output is 40% of input. */
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
  return {
    fileCount: stats.length,
    totalOriginal,
    totalCompressed,
    totalSaved,
    ratio,
    perFile: stats,
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

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

// ===== History (localStorage) =====

const HISTORY_KEY = "unqtools-gzip-compressor-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileCount: number;
  totalOriginal: number;
  totalCompressed: number;
  totalSaved: number;
  ratio: number;
  mode: "single" | "tar-gz";
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
  mode: "single" | "tar-gz";
  outputFileName: string;
}

export function buildShareUrl(opts: ShareOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("mode", opts.mode);
  params.set("out", opts.outputFileName);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareOptions | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("mode") && !params.has("out")) return null;
  const mode = params.get("mode") === "tar-gz" ? "tar-gz" : "single";
  const outputFileName = params.get("out") ?? "archive.tar.gz";
  return { mode, outputFileName };
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
}

/**
 * Compress one or more files to GZIP.
 * - mode="single": each file → its own .gz blob. Returns a ZIP wrapping all .gz outputs.
 *   If only one file is given, returns that single .gz blob directly.
 * - mode="tar-gz": builds a TAR archive of all files, then GZIP-compresses it
 *   into a single .tar.gz blob.
 */
export async function compressBatch(
  inputs: CompressInput[],
  mode: "single" | "tar-gz",
  outputFileName: string,
  onProgress?: (current: number, total: number) => void,
): Promise<CompressResult> {
  if (inputs.length === 0) throw new Error("No input files provided.");

  if (mode === "tar-gz") {
    const tarEntries: TarEntry[] = inputs.map((inp) => ({
      name: inp.fileName,
      data: inp.data,
    }));
    const tar = buildTarArchive(tarEntries);
    const compressed = await compressGzip(tar);
    const stat = computeStat(outputFileName, tar.length, compressed.length);
    const stats = aggregateStats([stat]);
    const blob = new Blob([compressed as BlobPart], { type: "application/gzip" });
    onProgress?.(1, 1);
    return { outputFileName, blob, stats };
  }

  // single mode
  const stats: CompressionStat[] = [];
  const compressedFiles: { name: string; data: Uint8Array }[] = [];
  for (let i = 0; i < inputs.length; i++) {
    const inp = inputs[i];
    try {
      const compressed = await compressGzipWithFilename(inp.data, inp.fileName);
      const stat = computeStat(inp.fileName, inp.data.length, compressed.length);
      stats.push(stat);
      compressedFiles.push({
        name: `${inp.fileName}.gz`,
        data: compressed,
      });
    } catch (e) {
      stats.push({
        fileName: inp.fileName,
        originalSize: inp.data.length,
        compressedSize: inp.data.length,
        savedBytes: 0,
        ratio: 0,
        compressedFraction: 1,
        error: (e as Error).message,
      });
    }
    onProgress?.(i + 1, inputs.length);
  }

  if (compressedFiles.length === 1) {
    const cf = compressedFiles[0]!;
    const blob = new Blob([cf.data as BlobPart], { type: "application/gzip" });
    return { outputFileName: cf.name, blob, stats: aggregateStats(stats) };
  }

  // Multiple files → wrap into a ZIP
  const blob = createZipBlob(compressedFiles.map((f) => ({ name: f.name, data: f.data })));
  return { outputFileName, blob, stats: aggregateStats(stats) };
}

// ===== Minimal ZIP writer (STORE method) — for bundling multiple .gz outputs =====

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
