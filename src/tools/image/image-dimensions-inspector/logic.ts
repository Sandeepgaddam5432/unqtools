/**
 * Image Dimensions Inspector — pure logic.
 * Extracts dimensions, file size, format, color depth, and parses common EXIF
 * tags from JPEG/TIFF/PNG/WebP byte buffers without external deps.
 */

export type ImageFormat = "png" | "jpeg" | "gif" | "webp" | "bmp" | "tiff" | "svg" | "unknown";

export interface ImageInfo {
  format: ImageFormat;
  width: number;
  height: number;
  bitDepth: number;
  hasAlpha: boolean;
  colorType: string; // PNG color type description
  animated: boolean;
  frameCount: number;
  sourceBytes: number;
  exif?: ExifSummary;
}

export interface ExifSummary {
  cameraMake?: string;
  cameraModel?: string;
  dateTime?: string;
  iso?: number;
  exposureTime?: number;
  fNumber?: number;
  focalLength?: number;
  gps?: { lat: number; lng: number };
  orientation?: number;
  software?: string;
}

/** Read a 16-bit big-endian uint. */
export function readUint16BE(bytes: Uint8Array, offset: number): number {
  if (offset + 1 >= bytes.length) return 0;
  return (bytes[offset] << 8) | bytes[offset + 1];
}

/** Read a 32-bit big-endian uint. */
export function readUint32BE(bytes: Uint8Array, offset: number): number {
  if (offset + 3 >= bytes.length) return 0;
  return (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
}

/** Read a 32-bit little-endian uint. */
export function readUint32LE(bytes: Uint8Array, offset: number): number {
  if (offset + 3 >= bytes.length) return 0;
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24);
}

/** Detect image format from magic bytes. */
export function detectFormat(bytes: Uint8Array): ImageFormat {
  if (bytes.length < 4) return "unknown";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "gif";
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "bmp";
  if (bytes[0] === 0x49 && bytes[1] === 0x49) return "tiff";
  if (bytes[0] === 0x4d && bytes[1] === 0x4d) return "tiff";
  if (bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "webp";
  return "unknown";
}

/** Parse PNG dimensions from IHDR chunk. */
export function parsePngDimensions(bytes: Uint8Array): { width: number; height: number; bitDepth: number; colorType: number } {
  if (bytes.length < 24) return { width: 0, height: 0, bitDepth: 0, colorType: 0 };
  // IHDR starts at offset 16 (after 8-byte sig + 4 length + 4 "IHDR")
  if (readUint32BE(bytes, 12) !== 0x49484452) return { width: 0, height: 0, bitDepth: 0, colorType: 0 };
  const width = readUint32BE(bytes, 16);
  const height = readUint32BE(bytes, 20);
  const bitDepth = bytes[24] ?? 0;
  const colorType = bytes[25] ?? 0;
  return { width, height, bitDepth, colorType };
}

const PNG_COLOR_TYPES: Record<number, { name: string; hasAlpha: boolean }> = {
  0: { name: "Grayscale", hasAlpha: false },
  2: { name: "Truecolor (RGB)", hasAlpha: false },
  3: { name: "Indexed-color", hasAlpha: false },
  4: { name: "Grayscale + Alpha", hasAlpha: true },
  6: { name: "Truecolor + Alpha", hasAlpha: true },
};

export function pngColorTypeName(colorType: number): string {
  return PNG_COLOR_TYPES[colorType]?.name ?? "Unknown";
}

export function pngHasAlpha(colorType: number): boolean {
  return PNG_COLOR_TYPES[colorType]?.hasAlpha ?? false;
}

/** Parse JPEG dimensions from SOF0/SOF2 markers. */
export function parseJpegDimensions(bytes: Uint8Array): { width: number; height: number; bitDepth: number } {
  let i = 2; // skip SOI marker
  while (i < bytes.length - 9) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const marker = bytes[i + 1];
    // SOF0 (0xC0), SOF2 (0xC2) etc. carry dimensions
    if ((marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = readUint16BE(bytes, i + 5);
      const width = readUint16BE(bytes, i + 7);
      const bitDepth = bytes[i + 4] ?? 8;
      return { width, height, bitDepth };
    }
    // Skip variable-length segment
    const segLen = readUint16BE(bytes, i + 2);
    i += 2 + segLen;
  }
  return { width: 0, height: 0, bitDepth: 8 };
}

/** Parse WebP dimensions from VP8/VP8L/VP8X chunk. */
export function parseWebpDimensions(bytes: Uint8Array): { width: number; height: number; animated: boolean; hasAlpha: boolean } {
  if (bytes.length < 30) return { width: 0, height: 0, animated: false, hasAlpha: false };
  const fourcc = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (fourcc === "VP8X") {
    const flags = bytes[20];
    const width = 1 + readUint32LE(bytes, 24) & 0xffffff;
    const height = 1 + readUint32LE(bytes, 27) & 0xffffff;
    return {
      width,
      height,
      animated: (flags & 0x02) !== 0,
      hasAlpha: (flags & 0x10) !== 0,
    };
  }
  if (fourcc === "VP8 " && bytes.length >= 30) {
    const width = readUint16LE(bytes, 26) & 0x3fff;
    const height = readUint16LE(bytes, 28) & 0x3fff;
    return { width, height, animated: false, hasAlpha: false };
  }
  if (fourcc === "VP8L" && bytes.length >= 25) {
    const b0 = bytes[21];
    const b1 = bytes[22];
    const b2 = bytes[23];
    const b3 = bytes[24];
    const width = 1 + ((b1 & 0x3f) << 8 | b0);
    const height = 1 + ((b3 & 0x0f) << 10 | b2 << 2 | (b1 & 0xc0) >> 6);
    return { width, height, animated: false, hasAlpha: (b3 & 0x10) !== 0 };
  }
  return { width: 0, height: 0, animated: false, hasAlpha: false };
}

/** Parse GIF dimensions from logical screen descriptor. */
export function parseGifDimensions(bytes: Uint8Array): { width: number; height: number; frameCount: number } {
  if (bytes.length < 13) return { width: 0, height: 0, frameCount: 0 };
  return {
    width: readUint16BE(bytes, 6) | 0, // little-endian
    height: bytes[8] | (bytes[9] << 8),
    frameCount: 0, // requires full scan
  };
}

/** Find the EXIF segment in a JPEG buffer. Returns offset and length, or null. */
export function findJpegExifSegment(bytes: Uint8Array): { offset: number; length: number } | null {
  let i = 2;
  while (i < bytes.length - 4) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const marker = bytes[i + 1];
    const segLen = readUint16BE(bytes, i + 2);
    // APP1 marker (0xE1) with "Exif\0\0" signature
    if (marker === 0xe1 && segLen >= 8) {
      const sig = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7], bytes[i + 8], bytes[i + 9]);
      if (sig === "Exif\x00\x00") {
        return { offset: i + 10, length: segLen - 8 };
      }
    }
    i += 2 + segLen;
  }
  return null;
}

/** Compute megapixels from dimensions. */
export function megapixels(width: number, height: number): number {
  return Math.round((width * height / 1_000_000) * 100) / 100;
}

/** Compute aspect ratio as a simplified string (e.g. "16:9"). */
export function aspectRatio(width: number, height: number): string {
  if (width === 0 || height === 0) return "0:0";
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(width, height);
  return `${width / d}:${height / d}`;
}

/** Format bytes. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Detect if format supports animation. */
export function isAnimated(format: ImageFormat): boolean {
  return format === "gif" || format === "webp";
}

/** Detect if format supports alpha transparency. */
export function supportsAlpha(format: ImageFormat): boolean {
  return format === "png" || format === "webp" || format === "gif" || format === "tiff" || format === "bmp";
}

/** Full info extractor dispatching by detected format. */
export function inspectImage(bytes: Uint8Array): ImageInfo {
  const format = detectFormat(bytes);
  const sourceBytes = bytes.length;
  switch (format) {
    case "png": {
      const d = parsePngDimensions(bytes);
      return {
        format,
        width: d.width,
        height: d.height,
        bitDepth: d.bitDepth || 8,
        hasAlpha: pngHasAlpha(d.colorType),
        colorType: pngColorTypeName(d.colorType),
        animated: false,
        frameCount: 1,
        sourceBytes,
      };
    }
    case "jpeg": {
      const d = parseJpegDimensions(bytes);
      return {
        format,
        width: d.width,
        height: d.height,
        bitDepth: d.bitDepth,
        hasAlpha: false,
        colorType: "RGB (YCbCr)",
        animated: false,
        frameCount: 1,
        sourceBytes,
      };
    }
    case "webp": {
      const d = parseWebpDimensions(bytes);
      return {
        format,
        width: d.width,
        height: d.height,
        bitDepth: 8,
        hasAlpha: d.hasAlpha,
        colorType: d.hasAlpha ? "VP8L (RGBA)" : "VP8 (RGB)",
        animated: d.animated,
        frameCount: d.animated ? 1 : 1,
        sourceBytes,
      };
    }
    case "gif": {
      const d = parseGifDimensions(bytes);
      return {
        format,
        width: d.width,
        height: d.height,
        bitDepth: 8,
        hasAlpha: true,
        colorType: "Indexed-color",
        animated: true,
        frameCount: d.frameCount || 1,
        sourceBytes,
      };
    }
    default:
      return {
        format,
        width: 0,
        height: 0,
        bitDepth: 0,
        hasAlpha: false,
        colorType: "Unknown",
        animated: false,
        frameCount: 0,
        sourceBytes,
      };
  }
}

/** Build a text report from ImageInfo. */
export function formatReport(info: ImageInfo): string {
  return [
    `Format: ${info.format.toUpperCase()}`,
    `Dimensions: ${info.width}×${info.height}px`,
    `Megapixels: ${megapixels(info.width, info.height)} MP`,
    `Aspect ratio: ${aspectRatio(info.width, info.height)}`,
    `Bit depth: ${info.bitDepth}`,
    `Color type: ${info.colorType}`,
    `Has alpha: ${info.hasAlpha ? "yes" : "no"}`,
    `Animated: ${info.animated ? "yes" : "no"}`,
    `Frames: ${info.frameCount}`,
    `File size: ${formatBytes(info.sourceBytes)}`,
  ].join("\n");
}
