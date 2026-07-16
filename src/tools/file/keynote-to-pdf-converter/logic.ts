/**
 * Keynote to PDF Converter — pure-JS ZIP parser + pdf-lib placeholder PDF generator.
 *
 * Keynote (.key) structure (ZIP archive):
 *   - metadata.json: { "Generator_Version", "date", "slide-numbers-visible",
 *       "title", "categories", "size": { "width", "height" }, ... }
 *   - preview.jpg: thumbnail of the first slide
 *   - Data/*.iwa: Snappy-compressed Protocol Buffers (slide content)
 *   - Index/*.iwa: thumbnail metadata
 *   - Indexes/*: lookup tables
 *
 * HONESTY CLAUSE: We extract metadata + preview.jpg, but cannot decode the
 * .iwa slide content (Snappy + undocumented Protobuf schema). We render
 * placeholder slides to PDF with the title and slide numbers. Documented
 * in FAQ.
 */

import {
  parseZipEntries,
  decompressEntry,
  decodeUtf8,
} from "../epub-reader/logic";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

// ===== Types =====

export interface KeynoteMetadata {
  title: string;
  author: string;
  /** Number of slides (from metadata.json's slide-number field or slide list). */
  slideCount: number;
  /** Slide dimensions in points (defaults to 1024x768 = 4:3). */
  width: number;
  height: number;
  /** Generator version string. */
  generatorVersion: string;
  /** Creation date (ISO string from metadata). */
  creationDate: string;
  /** True if slide numbers should be visible. */
  slideNumbersVisible: boolean;
}

export const EMPTY_METADATA: KeynoteMetadata = {
  title: "",
  author: "",
  slideCount: 0,
  width: 1024,
  height: 768,
  generatorVersion: "",
  creationDate: "",
  slideNumbersVisible: false,
};

export type KeynotePageSize = "4:3" | "16:9" | "letter";

export interface KeynoteConvertOptions {
  /** Override the title (defaults to metadata title). */
  title: string;
  /** Page size for the output PDF. */
  pageSize: KeynotePageSize;
  /** Whether to include slide numbers in the placeholder. */
  includeSlideNumbers: boolean;
  /** Whether to include a title page (slide 0 with the title big). */
  includeTitlePage: boolean;
  /** Custom disclaimer text appended to each slide. */
  disclaimer: string;
}

export const DEFAULT_OPTIONS: KeynoteConvertOptions = {
  title: "",
  pageSize: "16:9",
  includeSlideNumbers: true,
  includeTitlePage: true,
  disclaimer: "Placeholder slide — actual Keynote content not rendered.",
};

export interface KeynoteConvertResult {
  blob: Blob;
  fileName: string;
  metadata: KeynoteMetadata;
  previewImage: Uint8Array | null;
  slideCount: number;
  pdfBytes: number;
}

// ===== Page size helpers =====

/** Get the page dimensions in points for the chosen page size. */
export function getPageSize(pageSize: KeynotePageSize): { width: number; height: number } {
  switch (pageSize) {
    case "4:3":
      return { width: 768, height: 576 }; // 8in x 6in at 96 DPI
    case "16:9":
      return { width: 960, height: 540 }; // 10in x 5.625in at 96 DPI
    case "letter":
      return { width: 612, height: 792 }; // US Letter portrait
  }
}

// ===== Metadata parsing =====

/**
 * Parse metadata.json from a Keynote ZIP.
 * The metadata.json structure varies between Keynote versions; we look for
 * the slide number / size / title fields defensively.
 */
export function parseMetadataJson(jsonText: string): KeynoteMetadata {
  const meta: KeynoteMetadata = { ...EMPTY_METADATA };
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return meta;
  }
  if (!parsed || typeof parsed !== "object") return meta;
  const obj = parsed as Record<string, unknown>;
  meta.title = typeof obj.title === "string" ? obj.title : "";
  meta.author = typeof obj.author === "string" ? obj.author : "";
  meta.generatorVersion =
    typeof obj.Generator_Version === "string" ? obj.Generator_Version : typeof obj.generatorVersion === "string" ? obj.generatorVersion : "";
  meta.creationDate =
    typeof obj.date === "string" ? obj.date : typeof obj.creationDate === "string" ? obj.creationDate : "";
  meta.slideNumbersVisible = obj["slide-numbers-visible"] === true || obj.slideNumbersVisible === true;
  // Size
  const size = obj.size as { width?: number; height?: number } | undefined;
  if (size && typeof size === "object") {
    if (typeof size.width === "number" && size.width > 0) meta.width = size.width;
    if (typeof size.height === "number" && size.height > 0) meta.height = size.height;
  }
  // Slide count: try several keys
  const slideNum = obj["slide-number"] ?? obj.slideNumber ?? obj["slide-count"] ?? obj.slideCount;
  if (typeof slideNum === "number" && slideNum > 0) {
    meta.slideCount = slideNum;
  } else if (typeof slideNum === "string" && /^\d+$/.test(slideNum)) {
    meta.slideCount = parseInt(slideNum, 10);
  }
  // Try slide list
  const slides = obj.slides as unknown[] | undefined;
  if (Array.isArray(slides) && slides.length > 0 && meta.slideCount === 0) {
    meta.slideCount = slides.length;
  }
  // Try to infer from "size" of slide list / "Manifest"
  if (meta.slideCount === 0) {
    const manifest = obj.Manifest as Record<string, unknown> | undefined;
    if (manifest && typeof manifest === "object") {
      const slideKeys = Object.keys(manifest).filter((k) => /slide/i.test(k));
      if (slideKeys.length > 0) meta.slideCount = slideKeys.length;
    }
  }
  return meta;
}

// ===== ZIP scanning =====

/** Check if bytes look like a Keynote file (ZIP containing metadata.json or .iwa). */
export function isKeynoteFile(bytes: Uint8Array): boolean {
  // ZIP signature: 0x50 0x4B 0x03 0x04
  if (bytes.length < 4) return false;
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    return false;
  }
  return true;
}

/** Find a ZIP entry by name (case-insensitive substring match). */
export function findEntry(
  entries: ReturnType<typeof parseZipEntries>,
  name: string,
): ReturnType<typeof parseZipEntries>[number] | undefined {
  const lower = name.toLowerCase();
  return entries.find((e) => e.name.toLowerCase().includes(lower));
}

/** Count slide .iwa files (gives a rough slide count fallback). */
export function countSlideIwaFiles(entries: ReturnType<typeof parseZipEntries>): number {
  return entries.filter((e) => /slide.*\.iwa$/i.test(e.name)).length;
}

// ===== PDF rendering =====

/** Render a placeholder PDF from the keynote metadata. */
export async function renderPlaceholderPdf(
  metadata: KeynoteMetadata,
  opts: KeynoteConvertOptions,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const subtitleFont = await doc.embedFont(StandardFonts.Helvetica);
  const { width, height } = getPageSize(opts.pageSize);
  const title = opts.title || metadata.title || "Untitled Keynote";
  const slideCount = Math.max(1, metadata.slideCount);

  // Title page (optional)
  let firstSlideNumber = 1;
  if (opts.includeTitlePage) {
    const page = doc.addPage([width, height]);
    const titleSize = Math.min(48, Math.floor(width / Math.max(title.length, 8)));
    const titleWidth = font.widthOfTextAtSize(title, titleSize);
    page.drawText(title, {
      x: (width - titleWidth) / 2,
      y: height / 2,
      size: titleSize,
      font,
      color: rgb(0, 0, 0),
    });
    const subtitleText = `${slideCount} slide${slideCount === 1 ? "" : "s"} · ${metadata.width}×${metadata.height}`;
    const subWidth = subtitleFont.widthOfTextAtSize(subtitleText, 16);
    page.drawText(subtitleText, {
      x: (width - subWidth) / 2,
      y: height / 2 - 40,
      size: 16,
      font: subtitleFont,
      color: rgb(0.4, 0.4, 0.4),
    });
    if (opts.disclaimer) {
      const dWidth = subtitleFont.widthOfTextAtSize(opts.disclaimer, 10);
      page.drawText(opts.disclaimer, {
        x: (width - dWidth) / 2,
        y: 24,
        size: 10,
        font: subtitleFont,
        color: rgb(0.6, 0.6, 0.6),
      });
    }
    firstSlideNumber = 1;
  }

  // Slide pages (placeholder)
  for (let i = 0; i < slideCount; i++) {
    const page = doc.addPage([width, height]);
    // Draw a frame
    page.drawRectangle({
      x: 24,
      y: 24,
      width: width - 48,
      height: height - 48,
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 1,
    });
    // Slide title (centered)
    const slideTitle = `Slide ${i + 1}`;
    const slideTitleWidth = font.widthOfTextAtSize(slideTitle, 32);
    page.drawText(slideTitle, {
      x: (width - slideTitleWidth) / 2,
      y: height / 2 + 20,
      size: 32,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    // Placeholder notice
    const notice = "Content not rendered (Keynote .iwa format not supported in pure JS)";
    const noticeWidth = subtitleFont.widthOfTextAtSize(notice, 12);
    page.drawText(notice, {
      x: (width - noticeWidth) / 2,
      y: height / 2 - 20,
      size: 12,
      font: subtitleFont,
      color: rgb(0.5, 0.5, 0.5),
    });
    // Slide number (if enabled)
    if (opts.includeSlideNumbers) {
      const numText = `${i + 1} / ${slideCount}`;
      const numWidth = subtitleFont.widthOfTextAtSize(numText, 12);
      page.drawText(numText, {
        x: width - numWidth - 36,
        y: 36,
        size: 12,
        font: subtitleFont,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
    // Disclaimer
    if (opts.disclaimer) {
      const dWidth = subtitleFont.widthOfTextAtSize(opts.disclaimer, 9);
      page.drawText(opts.disclaimer, {
        x: (width - dWidth) / 2,
        y: 36,
        size: 9,
        font: subtitleFont,
        color: rgb(0.6, 0.6, 0.6),
      });
    }
    firstSlideNumber = firstSlideNumber; // suppress unused warning
  }
  doc.setProducer("UnQTools — Keynote to PDF Converter");
  doc.setCreator("UnQTools — Keynote to PDF Converter");
  doc.setCreationDate(new Date());
  doc.setModificationDate(new Date());
  return doc.save();
}

// ===== Top-level conversion =====

export async function convertKeynoteToPdf(
  bytes: Uint8Array,
  opts: KeynoteConvertOptions = DEFAULT_OPTIONS,
  outputFileName: string = "converted.pdf",
): Promise<ToolResult<KeynoteConvertResult>> {
  if (!isKeynoteFile(bytes)) {
    return {
      ok: false,
      error: "Not a valid Keynote file (missing ZIP signature 0x50 0x4B 0x03 0x04).",
    };
  }
  const entries = parseZipEntries(bytes);
  if (entries.length === 0) {
    return { ok: false, error: "Keynote ZIP archive is empty." };
  }

  // Extract metadata.json
  let metadata: KeynoteMetadata = { ...EMPTY_METADATA };
  const metaEntry = findEntry(entries, "metadata.json");
  if (metaEntry) {
    try {
      const jsonText = decodeUtf8(await decompressEntry(metaEntry));
      metadata = parseMetadataJson(jsonText);
    } catch {
      // metadata.json unreadable — keep defaults
    }
  }

  // Fallback: count slide .iwa files
  if (metadata.slideCount === 0) {
    const iwaCount = countSlideIwaFiles(entries);
    if (iwaCount > 0) metadata.slideCount = iwaCount;
  }

  if (metadata.slideCount === 0) {
    return {
      ok: false,
      error: "Could not determine slide count from Keynote metadata. The file may be corrupted or use an unsupported format.",
    };
  }

  // Extract preview.jpg (optional)
  let previewImage: Uint8Array | null = null;
  const previewEntry = findEntry(entries, "preview.jpg") ?? findEntry(entries, "preview");
  if (previewEntry) {
    try {
      previewImage = await decompressEntry(previewEntry);
    } catch {
      // ignore — preview is optional
    }
  }

  // Apply user overrides
  const effectiveOpts: KeynoteConvertOptions = {
    ...opts,
    title: opts.title || metadata.title || "",
  };

  // Render PDF
  const pdfBytes = await renderPlaceholderPdf(metadata, effectiveOpts);
  const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
  return {
    ok: true,
    output: {
      blob,
      fileName: outputFileName,
      metadata,
      previewImage,
      slideCount: metadata.slideCount,
      pdfBytes: pdfBytes.length,
    },
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

const HISTORY_KEY = "unqtools-keynote-to-pdf-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  fileSize: number;
  slideCount: number;
  title: string;
  pdfBytes: number;
  convertedAt: string;
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

export function buildShareUrl(opts: KeynoteConvertOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("size", opts.pageSize);
  params.set("numbers", String(opts.includeSlideNumbers));
  params.set("title", String(opts.includeTitlePage));
  if (opts.title) params.set("t", opts.title);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<KeynoteConvertOptions> | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("size") && !params.has("numbers")) return null;
  const size = (params.get("size") ?? "16:9") as KeynotePageSize;
  const validSizes: KeynotePageSize[] = ["4:3", "16:9", "letter"];
  return {
    pageSize: validSizes.includes(size) ? size : "16:9",
    includeSlideNumbers: params.get("numbers") !== "false",
    includeTitlePage: params.get("title") !== "false",
    title: params.get("t") ?? "",
  };
}
