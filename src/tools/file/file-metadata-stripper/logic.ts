/**
 * File Metadata Stripper — pure logic for removing EXIF/GPS/XMP/IPTC/PNG text
 * metadata from JPEG, PNG, and WebP images without re-encoding pixel data.
 *
 * JPEG: We walk the marker stream and drop APP1-EXIF, APP1-XMP, and APP13-IPTC
 * segments while preserving SOI, frame, scan, and EOI.
 * PNG: We walk chunks and drop tEXt/zTXt/iTXt while preserving signature,
 * IHDR, IDAT, and IEND.
 * WebP: We walk RIFF chunks and drop EXIF/XMP sub-chunks while preserving
 * VP8/VP8L/VP8X/ALPH/ANIM/ANMF.
 */

export type StripFormat = "jpeg" | "png" | "webp" | "unknown";

export interface StripOptions {
  /** Strip APP1 EXIF segments from JPEG. Default true. */
  stripExif: boolean;
  /** Strip APP1 XMP segments from JPEG. Default true. */
  stripXmp: boolean;
  /** Strip APP13 IPTC/Photoshop segments from JPEG. Default true. */
  stripIptc: boolean;
  /** Strip PNG text chunks (tEXt/zTXt/iTXt). Default true. */
  stripPngText: boolean;
}

export const DEFAULT_STRIP_OPTIONS: StripOptions = {
  stripExif: true,
  stripXmp: true,
  stripIptc: true,
  stripPngText: true,
};

export interface DetectedMetadata {
  /** Marker / chunk identifier (e.g. "APP1-EXIF"). */
  type: string;
  /** Human-readable description. */
  description: string;
  /** Size in bytes. */
  size: number;
}

export interface StripResult {
  format: StripFormat;
  /** Original byte length. */
  originalSize: number;
  /** Output byte length. */
  strippedSize: number;
  /** Bytes saved (may be 0 if no metadata existed). */
  bytesSaved: number;
  /** True if any metadata was actually removed. */
  changed: boolean;
  /** List of metadata segments/chunks that were removed. */
  removed: DetectedMetadata[];
  /** List of metadata segments/chunks still present (not selected for stripping). */
  remaining: DetectedMetadata[];
  /** Output bytes (the stripped image). */
  output: Uint8Array;
  /** Filename suffix to apply (e.g. "stripped"). */
  suffix: string;
}

/** Detect image format from magic bytes. */
export function detectFormat(bytes: Uint8Array): StripFormat {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "png";
  }
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return "webp";
  }
  return "unknown";
}

// ===== JPEG parsing/stripping =====

interface JpegSegment {
  marker: number;
  markerName: string;
  offset: number;
  length: number; // segment length including 2-byte length field
  description: string;
}

const JPEG_MARKER_NAMES: Record<number, string> = {
  0xd8: "SOI",
  0xd9: "EOI",
  0xe0: "APP0 (JFIF)",
  0xe1: "APP1 (EXIF/XMP)",
  0xe2: "APP2",
  0xed: "APP13 (IPTC/Photoshop)",
  0xe3: "APP3",
  0xe4: "APP4",
  0xe5: "APP5",
  0xe6: "APP6",
  0xe7: "APP7",
  0xe8: "APP8 (SPIFF)",
  0xfe: "COM (comment)",
  0xdb: "DQT (quantization table)",
  0xc0: "SOF0 (baseline DCT)",
  0xc2: "SOF2 (progressive DCT)",
  0xc4: "DHT (Huffman table)",
  0xda: "SOS (start of scan)",
  0xdd: "DRI (restart interval)",
};

/** Walk JPEG segments and return a list of segment descriptors. */
export function parseJpegSegments(bytes: Uint8Array): JpegSegment[] {
  const segments: JpegSegment[] = [];
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return segments;
  // Record SOI as the first segment
  segments.push({
    marker: 0xd8, markerName: JPEG_MARKER_NAMES[0xd8] ?? "SOI",
    offset: 0, length: 2, description: "SOI (start of image)",
  });
  let pos = 2; // after SOI
  while (pos < bytes.length - 1) {
    if (bytes[pos] !== 0xff) { pos++; continue; }
    // Skip fill bytes (0xff 0xff)
    while (pos < bytes.length && bytes[pos] === 0xff) pos++;
    if (pos >= bytes.length) break;
    const marker = bytes[pos];
    pos++;
    // Markers without length: SOI/EOI/RSTn
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      segments.push({
        marker, markerName: JPEG_MARKER_NAMES[marker] ?? `0x${marker.toString(16)}`,
        offset: pos - 2, length: 2, description: JPEG_MARKER_NAMES[marker] ?? "marker",
      });
      continue;
    }
    // SOS: scan data follows, length field exists then entropy-coded data
    if (pos + 1 >= bytes.length) break;
    const segLen = (bytes[pos] << 8) | bytes[pos + 1];
    const segStart = pos;
    segments.push({
      marker, markerName: JPEG_MARKER_NAMES[marker] ?? `0x${marker.toString(16)}`,
      offset: pos - 2, length: segLen + 2, description: JPEG_MARKER_NAMES[marker] ?? "marker",
    });
    if (marker === 0xda) {
      // Entropy-coded scan data — stop walking segments
      break;
    }
    pos = segStart + segLen;
  }
  return segments;
}

/** Determine whether an APP1 segment is EXIF or XMP. */
export function classifyApp1(bytes: Uint8Array, segStart: number): "EXIF" | "XMP" | "unknown" {
  // segStart points to the byte after the marker (the length field start)
  // The payload starts at segStart + 2
  if (segStart + 2 + 6 > bytes.length) return "unknown";
  const payloadStart = segStart + 2;
  const header = bytes.slice(payloadStart, payloadStart + 6);
  // EXIF marker: "Exif\0\0"
  const isExif = header[0] === 0x45 && header[1] === 0x78 && header[2] === 0x69
              && header[3] === 0x66 && header[4] === 0x00 && header[5] === 0x00;
  if (isExif) return "EXIF";
  // XMP marker: "http://ns.adobe.com/xap/1.0/\0" (29 bytes) — check first 28 chars
  if (segStart + 2 + 28 < bytes.length) {
    const xmpId = "http://ns.adobe.com/xap/1.0/\0";
    let isXmp = true;
    for (let i = 0; i < xmpId.length; i++) {
      if (bytes[payloadStart + i] !== xmpId.charCodeAt(i)) { isXmp = false; break; }
    }
    if (isXmp) return "XMP";
    // Alternative: "http://ns.adobe.com/xmp/extension/\0"
    const xmpExt = "http://ns.adobe.com/xmp/extension/\0";
    let isXmpExt = true;
    for (let i = 0; i < xmpExt.length; i++) {
      if (bytes[payloadStart + i] !== xmpExt.charCodeAt(i)) { isXmpExt = false; break; }
    }
    if (isXmpExt) return "XMP";
  }
  return "unknown";
}

/** Strip JPEG metadata. Returns stripped bytes + list of removed segments. */
export function stripJpeg(bytes: Uint8Array, options: StripOptions): { output: Uint8Array; removed: DetectedMetadata[]; remaining: DetectedMetadata[] } {
  const removed: DetectedMetadata[] = [];
  const remaining: DetectedMetadata[] = [];
  const segments = parseJpegSegments(bytes);
  if (segments.length === 0) {
    return { output: bytes, removed, remaining };
  }

  // Determine ranges to drop
  const dropRanges: Array<[number, number]> = []; // [start, end]
  for (const seg of segments) {
    if (seg.marker === 0xe1) {
      const cls = classifyApp1(bytes, seg.offset + 2);
      const wantStrip = (cls === "EXIF" && options.stripExif)
                     || (cls === "XMP" && options.stripXmp);
      const meta: DetectedMetadata = {
        type: `APP1-${cls}`,
        description: cls === "EXIF" ? "EXIF + GPS (APP1 segment)"
                   : cls === "XMP" ? "XMP metadata (APP1 segment)"
                   : "Unknown APP1 segment",
        size: seg.length,
      };
      if (wantStrip) {
        dropRanges.push([seg.offset, seg.offset + seg.length]);
        removed.push(meta);
      } else {
        remaining.push(meta);
      }
    } else if (seg.marker === 0xed && options.stripIptc) {
      dropRanges.push([seg.offset, seg.offset + seg.length]);
      removed.push({
        type: "APP13-IPTC",
        description: "IPTC / Photoshop metadata",
        size: seg.length,
      });
    } else if (seg.marker === 0xed) {
      remaining.push({ type: "APP13-IPTC", description: "IPTC / Photoshop metadata", size: seg.length });
    }
    // COM (comment) — keep; only stripping standard EXIF/XMP/IPTC per blueprint.
  }

  if (dropRanges.length === 0) {
    return { output: bytes, removed, remaining };
  }

  // Build output by concatenating kept ranges
  const out: number[] = [];
  let cursor = 0;
  // Sort drop ranges by start
  dropRanges.sort((a, b) => a[0] - b[0]);
  for (const [start, end] of dropRanges) {
    for (let i = cursor; i < start; i++) out.push(bytes[i]);
    cursor = end;
  }
  for (let i = cursor; i < bytes.length; i++) out.push(bytes[i]);
  return { output: new Uint8Array(out), removed, remaining };
}

// ===== PNG parsing/stripping =====

interface PngChunk {
  type: string;
  offset: number;       // offset of length field (start of chunk)
  totalLength: number;  // length + type + data + crc = 4 + 4 + dataLen + 4
  dataLength: number;
}

const PNG_TEXT_CHUNKS = new Set(["tEXt", "zTXt", "iTXt"]);

/** Walk PNG chunks and return a list. */
export function parsePngChunks(bytes: Uint8Array): PngChunk[] {
  const chunks: PngChunk[] = [];
  if (bytes.length < 8) return chunks;
  // PNG signature is 8 bytes; first chunk starts at offset 8
  let pos = 8;
  while (pos + 8 <= bytes.length) {
    const len = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
    const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
    const totalLength = 4 + 4 + len + 4;
    if (pos + totalLength > bytes.length) break;
    chunks.push({ type, offset: pos, totalLength, dataLength: len });
    pos += totalLength;
    if (type === "IEND") break;
  }
  return chunks;
}

/** Strip PNG text chunks. Returns stripped bytes + removed/remaining lists. */
export function stripPng(bytes: Uint8Array, options: StripOptions): { output: Uint8Array; removed: DetectedMetadata[]; remaining: DetectedMetadata[] } {
  const removed: DetectedMetadata[] = [];
  const remaining: DetectedMetadata[] = [];
  const chunks = parsePngChunks(bytes);
  if (chunks.length === 0) return { output: bytes, removed, remaining };

  const dropRanges: Array<[number, number]> = [];
  for (const chunk of chunks) {
    if (PNG_TEXT_CHUNKS.has(chunk.type)) {
      const meta: DetectedMetadata = {
        type: `PNG-${chunk.type}`,
        description: `PNG ${chunk.type} text chunk`,
        size: chunk.totalLength,
      };
      if (options.stripPngText) {
        dropRanges.push([chunk.offset, chunk.offset + chunk.totalLength]);
        removed.push(meta);
      } else {
        remaining.push(meta);
      }
    } else if (chunk.type === "eXIf") {
      const meta: DetectedMetadata = {
        type: "PNG-eXIf",
        description: "PNG eXIf EXIF chunk",
        size: chunk.totalLength,
      };
      if (options.stripExif) {
        dropRanges.push([chunk.offset, chunk.offset + chunk.totalLength]);
        removed.push(meta);
      } else {
        remaining.push(meta);
      }
    }
  }

  if (dropRanges.length === 0) {
    return { output: bytes, removed, remaining };
  }

  const out: number[] = [];
  let cursor = 0;
  dropRanges.sort((a, b) => a[0] - b[0]);
  for (const [start, end] of dropRanges) {
    for (let i = cursor; i < start; i++) out.push(bytes[i]);
    cursor = end;
  }
  for (let i = cursor; i < bytes.length; i++) out.push(bytes[i]);
  return { output: new Uint8Array(out), removed, remaining };
}

// ===== WebP parsing/stripping =====

interface RiffChunk {
  fourcc: string;
  offset: number;       // offset of the 4-byte FourCC
  size: number;         // declared size (excludes 8-byte header)
  totalLength: number;  // 8 + size (with padding to even)
}

/** Walk top-level RIFF chunks. */
export function parseRiffChunks(bytes: Uint8Array): RiffChunk[] {
  const chunks: RiffChunk[] = [];
  // RIFF header: 4 bytes 'RIFF', 4 bytes size, 4 bytes 'WEBP'
  if (bytes.length < 12) return chunks;
  let pos = 12;
  while (pos + 8 <= bytes.length) {
    const fourcc = String.fromCharCode(bytes[pos], bytes[pos + 1], bytes[pos + 2], bytes[pos + 3]);
    const size = (bytes[pos + 4] | (bytes[pos + 5] << 8) | (bytes[pos + 6] << 16) | (bytes[pos + 7] << 24)) >>> 0;
    const padded = size + (size & 1); // even padding
    chunks.push({ fourcc, offset: pos, size, totalLength: 8 + padded });
    pos += 8 + padded;
  }
  return chunks;
}

/** Strip WebP EXIF/XMP sub-chunks. */
export function stripWebp(bytes: Uint8Array, options: StripOptions): { output: Uint8Array; removed: DetectedMetadata[]; remaining: DetectedMetadata[] } {
  const removed: DetectedMetadata[] = [];
  const remaining: DetectedMetadata[] = [];
  const chunks = parseRiffChunks(bytes);
  if (chunks.length === 0) return { output: bytes, removed, remaining };

  const dropRanges: Array<[number, number]> = [];
  for (const chunk of chunks) {
    if (chunk.fourcc === "EXIF" && options.stripExif) {
      dropRanges.push([chunk.offset, chunk.offset + chunk.totalLength]);
      removed.push({ type: "WebP-EXIF", description: "WebP EXIF chunk", size: chunk.totalLength });
    } else if (chunk.fourcc === "EXIF") {
      remaining.push({ type: "WebP-EXIF", description: "WebP EXIF chunk", size: chunk.totalLength });
    } else if (chunk.fourcc === "XMP " && options.stripXmp) {
      dropRanges.push([chunk.offset, chunk.offset + chunk.totalLength]);
      removed.push({ type: "WebP-XMP", description: "WebP XMP chunk", size: chunk.totalLength });
    } else if (chunk.fourcc === "XMP ") {
      remaining.push({ type: "WebP-XMP", description: "WebP XMP chunk", size: chunk.totalLength });
    }
  }

  if (dropRanges.length === 0) {
    return { output: bytes, removed, remaining };
  }

  // Rewrite RIFF size in header to reflect new total
  const out: number[] = [];
  let cursor = 0;
  dropRanges.sort((a, b) => a[0] - b[0]);
  for (const [start, end] of dropRanges) {
    for (let i = cursor; i < start; i++) out.push(bytes[i]);
    cursor = end;
  }
  for (let i = cursor; i < bytes.length; i++) out.push(bytes[i]);
  const output = new Uint8Array(out);

  // Update RIFF size (bytes 4..7) — total file size minus 8 (the RIFF header)
  const newRiffSize = output.length - 8;
  output[4] = newRiffSize & 0xff;
  output[5] = (newRiffSize >>> 8) & 0xff;
  output[6] = (newRiffSize >>> 16) & 0xff;
  output[7] = (newRiffSize >>> 24) & 0xff;

  return { output, removed, remaining };
}

// ===== Top-level dispatcher =====

/** Strip metadata from a single image byte array. */
export function stripMetadata(bytes: Uint8Array, options: StripOptions = DEFAULT_STRIP_OPTIONS): StripResult {
  const format = detectFormat(bytes);
  if (format === "unknown") {
    throw new Error("Unsupported format. Only JPEG, PNG, and WebP are supported.");
  }

  let stripRes: { output: Uint8Array; removed: DetectedMetadata[]; remaining: DetectedMetadata[] };
  if (format === "jpeg") stripRes = stripJpeg(bytes, options);
  else if (format === "png") stripRes = stripPng(bytes, options);
  else stripRes = stripWebp(bytes, options);

  const originalSize = bytes.length;
  const strippedSize = stripRes.output.length;
  return {
    format,
    originalSize,
    strippedSize,
    bytesSaved: originalSize - strippedSize,
    changed: stripRes.removed.length > 0,
    removed: stripRes.removed,
    remaining: stripRes.remaining,
    output: stripRes.output,
    suffix: "stripped",
  };
}

// ===== Filename helpers =====

/** Append a suffix to the filename before the extension. */
export function applySuffix(filename: string, suffix: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0) return `${filename}-${suffix}`;
  return `${filename.slice(0, dot)}-${suffix}${filename.slice(dot)}`;
}

// ===== Stats / batch =====

export interface BatchStripStats {
  totalFiles: number;
  successCount: number;
  errorCount: number;
  totalBytesSaved: number;
  totalOriginalBytes: number;
  totalStrippedBytes: number;
}

export function computeBatchStats(results: Array<StripResult | { error: string }>): BatchStripStats {
  const stats: BatchStripStats = {
    totalFiles: results.length,
    successCount: 0,
    errorCount: 0,
    totalBytesSaved: 0,
    totalOriginalBytes: 0,
    totalStrippedBytes: 0,
  };
  for (const r of results) {
    if ("error" in r) {
      stats.errorCount++;
    } else {
      stats.successCount++;
      stats.totalBytesSaved += r.bytesSaved;
      stats.totalOriginalBytes += r.originalSize;
      stats.totalStrippedBytes += r.strippedSize;
    }
  }
  return stats;
}

/** Format bytes as human-readable. */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ===== ZIP writer (STORE method, no compression) =====
// Same minimal implementation pattern as csv-file-splitter / file-metadata-stripper.

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry { name: string; data: Uint8Array; }

/** Build a ZIP archive (STORE method) from binary entries. Returns a Blob. */
export function createZipBlob(entries: Array<{ name: string; data: Uint8Array }>): Blob {
  const files: ZipEntry[] = entries.slice();
  const enc = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);     // STORE
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
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
    cv.setUint32(16, crc, true);
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
  for (const p of allParts) { out.set(p, pos); pos += p.length; }
  return new Blob([out as BlobPart], { type: "application/zip" });
}

// ===== History (localStorage) =====
const HISTORY_KEY = "unqtools-metadata-stripper-history";
const MAX_HISTORY = 10;

export interface StripHistoryEntry {
  name: string;
  format: StripFormat;
  originalSize: number;
  strippedSize: number;
  bytesSaved: number;
  removedTypes: string[];
  strippedAt: string;
}

export function loadHistory(): StripHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch { return []; }
}

export function saveToHistory(entry: StripHistoryEntry): StripHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const updated = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
}

/** Build a shareable URL with strip options encoded. */
export function buildShareUrl(options: StripOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("exif", String(options.stripExif));
  params.set("xmp", String(options.stripXmp));
  params.set("iptc", String(options.stripIptc));
  params.set("png", String(options.stripPngText));
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

/** Parse strip options from a URL hash. Returns null if not present. */
export function parseShareUrl(hash: string): StripOptions | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("exif") && !params.has("xmp") && !params.has("iptc") && !params.has("png")) return null;
  return {
    stripExif: params.get("exif") !== "false",
    stripXmp: params.get("xmp") !== "false",
    stripIptc: params.get("iptc") !== "false",
    stripPngText: params.get("png") !== "false",
  };
}
