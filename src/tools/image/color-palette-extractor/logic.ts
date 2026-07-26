/**
 * Color Palette Extractor — pure logic.
 * Image processing utilities (uses Canvas API in UI).
 */

export interface ImageInfo {
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
  aspectRatio: number;
  megapixels: number;
}

export interface ProcessOptions {
  format: "png" | "jpeg" | "webp" | "avif";
  quality: number; // 0-1 for jpeg/webp/avif
  width?: number;
  height?: number;
  maintainAspect: boolean;
  background?: string; // for jpeg
}

export function defaultOptions(): ProcessOptions {
  return {
    format: "png",
    quality: 0.9,
    maintainAspect: true,
  };
}

export function getImageInfo(width: number, height: number, sizeBytes: number, format: string): ImageInfo {
  return {
    width,
    height,
    format,
    sizeBytes,
    aspectRatio: width / height,
    megapixels: (width * height) / 1000000,
  };
}

export function calculateDimensions(
  original: { width: number; height: number },
  target: { width?: number; height?: number; scale?: number },
  maintainAspect: boolean = true
): { width: number; height: number } {
  if (target.scale) {
    return {
      width: Math.round(original.width * target.scale),
      height: Math.round(original.height * target.scale),
    };
  }
  if (target.width && target.height) {
    if (maintainAspect) {
      const ratio = Math.min(target.width / original.width, target.height / original.height);
      return {
        width: Math.round(original.width * ratio),
        height: Math.round(original.height * ratio),
      };
    }
    return { width: target.width, height: target.height };
  }
  if (target.width) {
    if (maintainAspect) {
      const ratio = target.width / original.width;
      return { width: target.width, height: Math.round(original.height * ratio) };
    }
    return { width: target.width, height: original.height };
  }
  if (target.height) {
    if (maintainAspect) {
      const ratio = target.height / original.height;
      return { width: Math.round(original.width * ratio), height: target.height };
    }
    return { width: original.width, height: target.height };
  }
  return { width: original.width, height: original.height };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatDimensions(width: number, height: number): string {
  return `${width} × ${height} px`;
}

export function getAspectRatioString(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const g = gcd(width, height);
  return `${width / g}:${height / g}`;
}

export function getCommonAspectRatios(): { label: string; ratio: number; width: number; height: number }[] {
  return [
    { label: "1:1 Square", ratio: 1, width: 1080, height: 1080 },
    { label: "4:3 Standard", ratio: 4/3, width: 1024, height: 768 },
    { label: "3:2 Photo", ratio: 3/2, width: 1080, height: 720 },
    { label: "16:9 Widescreen", ratio: 16/9, width: 1920, height: 1080 },
    { label: "21:9 Ultrawide", ratio: 21/9, width: 2560, height: 1080 },
    { label: "9:16 Vertical", ratio: 9/16, width: 1080, height: 1920 },
    { label: "2:3 Vertical Photo", ratio: 2/3, width: 720, height: 1080 },
    { label: "3:4 Vertical", ratio: 3/4, width: 768, height: 1024 },
  ];
}

export function getFaviconSizes(): number[] {
  return [16, 32, 48, 64, 96, 128, 180, 192, 256, 384, 512];
}

export function getAppIconSizes(): { platform: string; size: number; name: string }[] {
  return [
    { platform: "iOS", size: 29, name: "Icon-29.png" },
    { platform: "iOS", size: 40, name: "Icon-40.png" },
    { platform: "iOS", size: 60, name: "Icon-60.png" },
    { platform: "iOS", size: 76, name: "Icon-76.png" },
    { platform: "iOS", size: 80, name: "Icon-80.png" },
    { platform: "iOS", size: 87, name: "Icon-87.png" },
    { platform: "iOS", size: 120, name: "Icon-120.png" },
    { platform: "iOS", size: 152, name: "Icon-152.png" },
    { platform: "iOS", size: 167, name: "Icon-167.png" },
    { platform: "iOS", size: 180, name: "Icon-180.png" },
    { platform: "iOS", size: 1024, name: "Icon-1024.png" },
    { platform: "Android", size: 48, name: "mdpi.png" },
    { platform: "Android", size: 72, name: "hdpi.png" },
    { platform: "Android", size: 96, name: "xhdpi.png" },
    { platform: "Android", size: 144, name: "xxhdpi.png" },
    { platform: "Android", size: 192, name: "xxxhdpi.png" },
  ];
}

export function getQualityPreset(quality: number): string {
  if (quality >= 0.95) return "Maximum";
  if (quality >= 0.85) return "High";
  if (quality >= 0.7) return "Medium";
  if (quality >= 0.5) return "Low";
  return "Minimum";
}

export function estimateBase64Size(byteSize: number): number {
  return Math.ceil(byteSize * 4 / 3);
}

export function getFileExtension(format: string): string {
  switch (format.toLowerCase()) {
    case "jpeg":
    case "jpg": return "jpg";
    case "png": return "png";
    case "webp": return "webp";
    case "avif": return "avif";
    case "gif": return "gif";
    case "bmp": return "bmp";
    case "svg": return "svg";
    case "ico": return "ico";
    default: return format.toLowerCase();
  }
}

export function getMimeType(format: string): string {
  switch (format.toLowerCase()) {
    case "jpeg":
    case "jpg": return "image/jpeg";
    case "png": return "image/png";
    case "webp": return "image/webp";
    case "avif": return "image/avif";
    case "gif": return "image/gif";
    case "bmp": return "image/bmp";
    case "svg": return "image/svg+xml";
    case "ico": return "image/x-icon";
    default: return "application/octet-stream";
  }
}

export function detectFormatFromBytes(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  // GIF: 47 49 46 38
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "gif";
  // WebP: 52 49 46 46 ... 57 45 42 50
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    if (bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "webp";
  }
  // BMP: 42 4D
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return "bmp";
  return null;
}
