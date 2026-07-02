/**
 * Image Compressor — pure logic. No DOM access (the Canvas operations live in
 * ui.tsx and worker.ts because OffscreenCanvas is required for worker-side
 * image processing).
 *
 * This module contains the testable pure helpers: format detection, MIME
 * types, size formatting, target-size quality tuning (binary search), and
 * ZIP manifest building.
 */

export type OutputFormat = "image/jpeg" | "image/png" | "image/webp";

export interface CompressOptions {
  format: OutputFormat;
  /** 0-1 quality (ignored for PNG). */
  quality: number;
  /** Optional max dimension; image will be downscaled preserving aspect ratio. */
  maxDimension?: number;
  /** Strip EXIF (always true for Canvas re-encode; flag kept for future WASM path). */
  stripExif: boolean;
}

export interface CompressResult {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  savedBytes: number;
  savedPct: number;
  format: OutputFormat;
}

export const ACCEPTED_INPUT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
] as const;

/** Detect output MIME from file extension or input MIME. */
export function detectFormat(filename: string, mime: string): OutputFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg") || mime === "image/jpeg")
    return "image/jpeg";
  if (lower.endsWith(".png") || mime === "image/png") return "image/png";
  if (lower.endsWith(".webp") || mime === "image/webp") return "image/webp";
  return null;
}

/** Format bytes human-readable. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Compute new dimensions preserving aspect ratio if maxDimension is set. */
export function computeResizedDimensions(
  originalWidth: number,
  originalHeight: number,
  maxDimension?: number,
): { width: number; height: number } {
  if (!maxDimension || maxDimension <= 0) {
    return { width: originalWidth, height: originalHeight };
  }
  const longest = Math.max(originalWidth, originalHeight);
  if (longest <= maxDimension) {
    return { width: originalWidth, height: originalHeight };
  }
  const scale = maxDimension / longest;
  return {
    width: Math.round(originalWidth * scale),
    height: Math.round(originalHeight * scale),
  };
}

/**
 * Target-size quality tuner: binary-search the quality parameter to hit a
 * target byte size. Caller provides a `compressAtQuality` function that
 * does the actual canvas encode.
 *
 * Returns the best-quality result that fits under targetBytes, or the
 * smallest result if none fit.
 */
export async function tuneForTargetSize(
  targetBytes: number,
  compressAtQuality: (q: number) => Promise<{ blob: Blob; quality: number }>,
  opts: { maxIterations?: number; minQuality?: number; maxQuality?: number } = {},
): Promise<{ blob: Blob; quality: number }> {
  const { maxIterations = 8, minQuality = 0.1, maxQuality = 1.0 } = opts;
  let lo = minQuality;
  let hi = maxQuality;
  let best: { blob: Blob; quality: number } | null = null;
  let bestUnder: { blob: Blob; quality: number } | null = null;

  for (let i = 0; i < maxIterations; i++) {
    const mid = (lo + hi) / 2;
    const result = await compressAtQuality(mid);
    if (!best || result.blob.size < best.blob.size) best = result;
    if (result.blob.size <= targetBytes) {
      bestUnder = result;
      lo = mid; // try higher quality
    } else {
      hi = mid; // try lower quality
    }
    if (hi - lo < 0.025) break;
  }

  return bestUnder ?? best!;
}

/**
 * Build a minimal ZIP file from a list of {name, bytes} entries.
 * Implements the "stored" (no compression) ZIP format — useful because
 * images are already compressed, so DEFLATE would add no benefit and
 * would require bundling a zip library.
 *
 * Each entry: local file header + file data + central directory header.
 * Trailing: end-of-central-directory record.
 *
 * Spec: PKWARE APPNOTE 6.3.10.
 */
export async function buildStoredZip(entries: { name: string; blob: Blob }[]): Promise<Blob> {
  if (entries.length === 0) return new Blob([], { type: "application/zip" });

  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  // CRC32 lookup table
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c >>> 0;
  }
  function crc32(bytes: Uint8Array): number {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      crc = crcTable[(crc ^ bytes[i]!) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name);
    const dataBytes = new Uint8Array(await entry.blob.arrayBuffer());
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    // Local file header (30 bytes + name)
    const lfh = new DataView(new ArrayBuffer(30 + nameBytes.length));
    lfh.setUint32(0, 0x04034b50, true); // signature
    lfh.setUint16(4, 20, true); // version needed
    lfh.setUint16(6, 0, true); // flags
    lfh.setUint16(8, 0, true); // compression: stored
    lfh.setUint16(10, 0, true); // mod time
    lfh.setUint16(12, 0, true); // mod date
    lfh.setUint32(14, crc, true);
    lfh.setUint32(18, size, true); // compressed size
    lfh.setUint32(22, size, true); // uncompressed size
    lfh.setUint16(26, nameBytes.length, true);
    lfh.setUint16(28, 0, true); // extra field length
    new Uint8Array(lfh.buffer).set(nameBytes, 30);

    chunks.push(new Uint8Array(lfh.buffer));
    chunks.push(dataBytes);

    // Central directory header (46 bytes + name)
    const cdh = new DataView(new ArrayBuffer(46 + nameBytes.length));
    cdh.setUint32(0, 0x02014b50, true); // signature
    cdh.setUint16(4, 20, true); // version made by
    cdh.setUint16(6, 20, true); // version needed
    cdh.setUint16(8, 0, true); // flags
    cdh.setUint16(10, 0, true); // compression
    cdh.setUint16(12, 0, true); // mod time
    cdh.setUint16(14, 0, true); // mod date
    cdh.setUint32(16, crc, true);
    cdh.setUint32(20, size, true); // compressed size
    cdh.setUint32(24, size, true); // uncompressed size
    cdh.setUint16(28, nameBytes.length, true);
    cdh.setUint16(30, 0, true); // extra field length
    cdh.setUint16(32, 0, true); // comment length
    cdh.setUint16(34, 0, true); // disk number
    cdh.setUint16(36, 0, true); // internal attrs
    cdh.setUint32(38, 0, true); // external attrs
    cdh.setUint32(42, offset, true); // local header offset
    new Uint8Array(cdh.buffer).set(nameBytes, 46);
    central.push(new Uint8Array(cdh.buffer));

    offset += lfh.buffer.byteLength + dataBytes.length;
  }

  // End of central directory
  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const centralOffset = offset;
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(4, 0, true); // disk number
  eocd.setUint16(6, 0, true); // disk with CD
  eocd.setUint16(8, entries.length, true); // entries on this disk
  eocd.setUint16(10, entries.length, true); // total entries
  eocd.setUint32(12, centralSize, true);
  eocd.setUint32(16, centralOffset, true);
  eocd.setUint16(20, 0, true); // comment length

  // Combine all chunks
  const totalSize = chunks.reduce((s, c) => s + c.length, 0) + centralSize + 22;
  const out = new Uint8Array(totalSize);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  for (const c of central) {
    out.set(c, pos);
    pos += c.length;
  }
  out.set(new Uint8Array(eocd.buffer), pos);

  return new Blob([out], { type: "application/zip" });
}

/** Build a default output filename from input + format. */
export function buildOutputFilename(
  inputName: string,
  format: OutputFormat,
  suffix = "-compressed",
): string {
  const dot = inputName.lastIndexOf(".");
  const base = dot > 0 ? inputName.slice(0, dot) : inputName;
  const ext = format === "image/jpeg" ? "jpg" : format === "image/png" ? "png" : "webp";
  return `${base}${suffix}.${ext}`;
}
