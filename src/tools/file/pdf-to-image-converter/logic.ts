/**
 * PDF to Image Converter — pure logic for PDF page metadata extraction,
 * filename templating, format handling, stats, and ZIP packaging.
 *
 * Actual canvas rendering happens in the UI (browser only). The logic
 * module covers everything that can be tested in Node:
 *   - Page metadata extraction (page count, dimensions)
 *   - Page range parsing
 *   - Filename template expansion ({name}-{page}.{ext})
 *   - Image format / quality validation
 *   - Stats computation (page count, total bytes, average size)
 *   - ZIP packaging of rendered images
 *   - History + shareable URL
 */

import { PDFDocument } from "pdf-lib";
import {
  parsePageRange as parsePageRangeBase,
} from "../pdf-to-text-converter/logic";
import {
  createZipBlob,
  type ZipFile,
} from "../csv-to-excel-converter/logic";
import type { ToolResult } from "../../../lib/tool";

// ===== Types =====

export type ImageFormat = "png" | "jpeg" | "webp";

export interface ImageOptions {
  /** Page range (e.g. "1-3,5"). Empty = all pages. */
  pageRange: string;
  /** Output image format. */
  format: ImageFormat;
  /** Quality for JPEG/WebP (0.1–1.0). Ignored for PNG. */
  quality: number;
  /** Render DPI (72–600). */
  dpi: number;
  /** Filename template — supports {name} and {page} placeholders. */
  filenameTemplate: string;
  /** Background color (hex) for transparent PDF pages rendered as JPEG. */
  backgroundColor: string;
}

export const DEFAULT_OPTIONS: ImageOptions = {
  pageRange: "",
  format: "png",
  quality: 0.92,
  dpi: 150,
  filenameTemplate: "{name}-{page}",
  backgroundColor: "#ffffff",
};

export interface PageMeta {
  /** 1-indexed page number. */
  pageNumber: number;
  /** Width in PDF points (1/72 inch). */
  widthPt: number;
  /** Height in PDF points. */
  heightPt: number;
  /** Width in pixels at the chosen DPI. */
  widthPx: number;
  /** Height in pixels at the chosen DPI. */
  heightPx: number;
  /** Rotation in degrees (0, 90, 180, 270). */
  rotation: number;
}

export interface PdfInfo {
  pageCount: number;
  pages: PageMeta[];
}

export interface RenderedImage {
  pageNumber: number;
  format: ImageFormat;
  widthPx: number;
  heightPx: number;
  bytes: number;
  dataUrl: string;
  /** Filename derived from the template. */
  fileName: string;
}

export interface ImageStats {
  pageCount: number;
  totalBytes: number;
  averageBytes: number;
  smallestBytes: number;
  largestBytes: number;
  zipBytes: number | null;
  format: ImageFormat;
  dpi: number;
}

// ===== Constants =====

const PTS_PER_INCH = 72;
const MIN_DPI = 72;
const MAX_DPI = 600;
const MIN_QUALITY = 0.1;
const MAX_QUALITY = 1.0;

// ===== DPI / dimension helpers =====

/** Clamp DPI to the supported range. */
export function clampDpi(dpi: number): number {
  if (!Number.isFinite(dpi)) return 150;
  return Math.max(MIN_DPI, Math.min(MAX_DPI, Math.round(dpi)));
}

/** Clamp quality to the supported range. */
export function clampQuality(quality: number): number {
  if (!Number.isFinite(quality)) return 0.92;
  return Math.max(MIN_QUALITY, Math.min(MAX_QUALITY, Number(quality.toFixed(2))));
}

/** Convert PDF points to pixels at a given DPI. */
export function ptsToPixels(pts: number, dpi: number): number {
  return Math.round((pts * clampDpi(dpi)) / PTS_PER_INCH);
}

/** Get canvas MIME type for an image format. */
export function getMimeType(format: ImageFormat): string {
  switch (format) {
    case "png": return "image/png";
    case "jpeg": return "image/jpeg";
    case "webp": return "image/webp";
    default: return "image/png";
  }
}

/** Get file extension for an image format. */
export function getExtension(format: ImageFormat): string {
  return format === "jpeg" ? "jpg" : format;
}

// ===== PDF info extraction =====

/** Load a PDF and extract page metadata (dimensions, count) for the chosen range. */
export async function getPdfInfo(
  pdfBytes: Uint8Array,
  opts: ImageOptions = DEFAULT_OPTIONS,
): Promise<ToolResult<PdfInfo>> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  } catch {
    return { ok: false, error: "Could not load PDF — it may be corrupted or password-protected." };
  }
  const totalPages = doc.getPageCount();
  if (totalPages === 0) {
    return { ok: false, error: "The PDF has no pages." };
  }
  const indices = parsePageRangeBase(opts.pageRange, totalPages)
    ?? Array.from({ length: totalPages }, (_, i) => i + 1);
  if (indices.length === 0) {
    return { ok: false, error: "No pages matched the given page range." };
  }
  const dpi = clampDpi(opts.dpi);
  const pages: PageMeta[] = [];
  for (const pageNum of indices) {
    const page = doc.getPage(pageNum - 1);
    if (!page) continue;
    let { width, height } = page.getSize();
    const rotation = page.getRotation().angle;
    // If rotated 90 or 270, swap dimensions
    if (rotation === 90 || rotation === 270) {
      [width, height] = [height, width];
    }
    pages.push({
      pageNumber: pageNum,
      widthPt: width,
      heightPt: height,
      widthPx: ptsToPixels(width, dpi),
      heightPx: ptsToPixels(height, dpi),
      rotation,
    });
  }
  return { ok: true, output: { pageCount: totalPages, pages } };
}

// ===== Filename templating =====

/** Sanitize a string for use as a filename (strip illegal chars). */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/\.pdf$/i, "")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100) || "page";
}

/**
 * Expand a filename template.
 * Placeholders: {name} = base file name, {page} = 1-indexed page number (zero-padded),
 * {page0} = zero-indexed, {ext} = file extension, {format} = format name.
 */
export function expandFilenameTemplate(
  template: string,
  baseName: string,
  pageNumber: number,
  format: ImageFormat,
): string {
  const ext = getExtension(format);
  const page = String(pageNumber);
  const page0 = String(pageNumber - 1);
  const padded = pageNumber.toString().padStart(3, "0");
  const safeBase = sanitizeFileName(baseName);
  let out = template
    .replace(/\{name\}/g, safeBase)
    .replace(/\{page0\}/g, page0)
    .replace(/\{page\}/g, page)
    .replace(/\{padded\}/g, padded)
    .replace(/\{format\}/g, format)
    .replace(/\{ext\}/g, ext);
  // If user didn't include ext, append it
  if (!out.endsWith("." + ext)) {
    out += "." + ext;
  }
  // Final sanitization (preserves the extension since dots are legal)
  return sanitizeFileName(out);
}

// ===== Stats =====

/** Compute summary stats from a list of rendered images. */
export function computeStats(images: RenderedImage[], zipBytes: number | null = null): ImageStats {
  if (images.length === 0) {
    return {
      pageCount: 0,
      totalBytes: 0,
      averageBytes: 0,
      smallestBytes: 0,
      largestBytes: 0,
      zipBytes,
      format: "png",
      dpi: 150,
    };
  }
  const totalBytes = images.reduce((s, img) => s + img.bytes, 0);
  let smallest = images[0]!.bytes;
  let largest = images[0]!.bytes;
  for (const img of images) {
    if (img.bytes < smallest) smallest = img.bytes;
    if (img.bytes > largest) largest = img.bytes;
  }
  return {
    pageCount: images.length,
    totalBytes,
    averageBytes: Math.round(totalBytes / images.length),
    smallestBytes: smallest,
    largestBytes: largest,
    zipBytes,
    format: images[0]!.format,
    dpi: DEFAULT_OPTIONS.dpi,
  };
}

// ===== ZIP packaging =====

/** Package rendered images into a ZIP. dataUrl is parsed back to binary. */
export function packageImagesAsZip(images: RenderedImage[], zipName: string = "pdf-images.zip"): { blob: Blob; fileName: string; bytes: number } | null {
  if (images.length === 0) return null;
  const files: ZipFile[] = [];
  for (const img of images) {
    const bytes = dataUrlToBytes(img.dataUrl);
    files.push({ name: img.fileName, data: bytes });
  }
  const blob = createZipBlob(files);
  return { blob, fileName: zipName, bytes: blob.size };
}

/** Decode a data URL (e.g. data:image/png;base64,...) into a Uint8Array. */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx < 0) return new Uint8Array(0);
  const meta = dataUrl.slice(0, commaIdx);
  const payload = dataUrl.slice(commaIdx + 1);
  if (meta.includes(";base64")) {
    return base64ToBytes(payload);
  }
  // URL-encoded text fallback
  return new TextEncoder().encode(decodeURIComponent(payload));
}

/** Decode Base64 to bytes — handles URL-safe variants and padding. */
export function base64ToBytes(b64: string): Uint8Array {
  const cleaned = b64.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
  // Re-pad
  const padded = cleaned + "=".repeat((4 - (cleaned.length % 4)) % 4);
  if (typeof atob === "function") {
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  // Node fallback
  const buf = Buffer.from(padded, "base64");
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

// ===== Utilities =====

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ===== History =====

const HISTORY_KEY = "unqtools-pdf-to-image-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  pdfBytes: number;
  pageCount: number;
  format: ImageFormat;
  dpi: number;
  totalImageBytes: number;
  convertedAt: string;
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

export function buildShareUrl(opts: ImageOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  if (opts.pageRange) params.set("pages", opts.pageRange);
  params.set("format", opts.format);
  params.set("quality", String(opts.quality));
  params.set("dpi", String(opts.dpi));
  if (opts.filenameTemplate && opts.filenameTemplate !== DEFAULT_OPTIONS.filenameTemplate) {
    params.set("tpl", opts.filenameTemplate);
  }
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ImageOptions> | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("format") && !params.has("pages")) return null;
  const format = (params.get("format") ?? "png") as ImageFormat;
  const validFormats: ImageFormat[] = ["png", "jpeg", "webp"];
  const quality = parseFloat(params.get("quality") ?? "0.92");
  const dpi = parseInt(params.get("dpi") ?? "150", 10);
  return {
    pageRange: params.get("pages") ?? "",
    format: validFormats.includes(format) ? format : "png",
    quality: isNaN(quality) ? 0.92 : clampQuality(quality),
    dpi: isNaN(dpi) ? 150 : clampDpi(dpi),
    filenameTemplate: params.get("tpl") ?? DEFAULT_OPTIONS.filenameTemplate,
  };
}
