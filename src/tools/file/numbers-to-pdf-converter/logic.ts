/**
 * Numbers to PDF Converter — pure-JS ZIP parser + pdf-lib placeholder PDF generator.
 *
 * Numbers (.numbers) structure (ZIP archive):
 *   - metadata.json: { "Generator_Version", "date", "title", ... }
 *   - Document.iwa: Snappy-compressed Protobuf (sheet/cell data)
 *   - preview.jpg: thumbnail of the first sheet
 *   - Tables/*.iwa: per-table data
 *   - Indexes/: lookup tables
 *
 * HONESTY CLAUSE: We extract metadata + preview.jpg but cannot decode the
 * .iwa sheet/cell content. We render placeholder PDF pages with sheet
 * numbers and an honest disclaimer. Documented in FAQ.
 */

import {
  parseZipEntries,
  decompressEntry,
  decodeUtf8,
} from "../epub-reader/logic";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

// ===== Types =====

export interface NumbersMetadata {
  title: string;
  author: string;
  /** Number of sheets (from metadata or .iwa count). */
  sheetCount: number;
  /** Document dimensions (defaults to landscape letter). */
  width: number;
  height: number;
  /** Generator version string. */
  generatorVersion: string;
  /** Creation date (ISO string). */
  creationDate: string;
}

export const EMPTY_METADATA: NumbersMetadata = {
  title: "",
  author: "",
  sheetCount: 0,
  width: 792,
  height: 612,
  generatorVersion: "",
  creationDate: "",
};

export type NumbersPageSize = "letter-landscape" | "a4-landscape" | "a4-portrait";

export interface NumbersConvertOptions {
  title: string;
  pageSize: NumbersPageSize;
  includeSheetNumbers: boolean;
  includeTitlePage: boolean;
  /** Number of placeholder rows to draw on each sheet page. */
  placeholderRows: number;
  /** Number of placeholder columns to draw on each sheet page. */
  placeholderCols: number;
  disclaimer: string;
}

export const DEFAULT_OPTIONS: NumbersConvertOptions = {
  title: "",
  pageSize: "letter-landscape",
  includeSheetNumbers: true,
  includeTitlePage: true,
  placeholderRows: 20,
  placeholderCols: 8,
  disclaimer: "Placeholder sheet — actual cell content not rendered.",
};

export interface NumbersConvertResult {
  blob: Blob;
  fileName: string;
  metadata: NumbersMetadata;
  previewImage: Uint8Array | null;
  sheetCount: number;
  pdfBytes: number;
}

// ===== Page size helpers =====

export function getPageSize(pageSize: NumbersPageSize): { width: number; height: number } {
  switch (pageSize) {
    case "letter-landscape":
      return { width: 792, height: 612 }; // 11x8.5in
    case "a4-landscape":
      return { width: 842, height: 595 }; // A4 landscape
    case "a4-portrait":
      return { width: 595, height: 842 }; // A4 portrait
  }
}

// ===== Metadata parsing =====

export function parseMetadataJson(jsonText: string): NumbersMetadata {
  const meta: NumbersMetadata = { ...EMPTY_METADATA };
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
  const sheetNum = obj["sheet-count"] ?? obj.sheetCount ?? obj["sheet-number"];
  if (typeof sheetNum === "number" && sheetNum > 0) {
    meta.sheetCount = sheetNum;
  } else if (typeof sheetNum === "string" && /^\d+$/.test(sheetNum)) {
    meta.sheetCount = parseInt(sheetNum, 10);
  }
  const size = obj.size as { width?: number; height?: number } | undefined;
  if (size && typeof size === "object") {
    if (typeof size.width === "number" && size.width > 0) meta.width = size.width;
    if (typeof size.height === "number" && size.height > 0) meta.height = size.height;
  }
  return meta;
}

// ===== ZIP scanning =====

export function isNumbersFile(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    return false;
  }
  return true;
}

export function findEntry(
  entries: ReturnType<typeof parseZipEntries>,
  name: string,
): ReturnType<typeof parseZipEntries>[number] | undefined {
  const lower = name.toLowerCase();
  return entries.find((e) => e.name.toLowerCase().includes(lower));
}

/** Count sheet .iwa files (gives a rough sheet count fallback). */
export function countSheetIwaFiles(entries: ReturnType<typeof parseZipEntries>): number {
  // Numbers stores sheets under Tables/ folder with names like "sheet-1.iwa"
  // or in a "sheets/" subfolder. We match any .iwa file with "sheet" in the name.
  return entries.filter((e) => /sheet/i.test(e.name) && /\.iwa$/i.test(e.name)).length;
}

// ===== PDF rendering =====

export async function renderPlaceholderPdf(
  metadata: NumbersMetadata,
  opts: NumbersConvertOptions,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const subtitleFont = await doc.embedFont(StandardFonts.Helvetica);
  const { width, height } = getPageSize(opts.pageSize);
  const title = opts.title || metadata.title || "Untitled Spreadsheet";
  const sheetCount = Math.max(1, metadata.sheetCount);

  // Title page (optional)
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
    const subtitleText = `${sheetCount} sheet${sheetCount === 1 ? "" : "s"}`;
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
  }

  // Sheet pages (placeholder with table grid)
  const rows = Math.max(1, Math.min(50, opts.placeholderRows));
  const cols = Math.max(1, Math.min(20, opts.placeholderCols));
  const tableLeft = 36;
  const tableTop = height - 60;
  const tableRight = width - 36;
  const tableBottom = 60;
  const tableWidth = tableRight - tableLeft;
  const tableHeight = tableTop - tableBottom;
  const colWidth = tableWidth / cols;
  const rowHeight = tableHeight / rows;

  for (let i = 0; i < sheetCount; i++) {
    const page = doc.addPage([width, height]);
    // Sheet title
    const sheetTitle = `Sheet ${i + 1}`;
    page.drawText(sheetTitle, {
      x: 36,
      y: height - 36,
      size: 16,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    // Draw table grid
    // Column headers (A, B, C, ...)
    for (let c = 0; c < cols; c++) {
      const x = tableLeft + c * colWidth;
      const header = String.fromCharCode(65 + (c % 26));
      const headerWidth = subtitleFont.widthOfTextAtSize(header, 9);
      page.drawText(header, {
        x: x + (colWidth - headerWidth) / 2,
        y: tableTop + 4,
        size: 9,
        font: subtitleFont,
        color: rgb(0.5, 0.5, 0.5),
      });
    }
    // Row numbers (1, 2, 3, ...)
    for (let r = 0; r < rows; r++) {
      const y = tableTop - (r + 1) * rowHeight + 4;
      const numText = String(r + 1);
      const numWidth = subtitleFont.widthOfTextAtSize(numText, 9);
      page.drawText(numText, {
        x: tableLeft - numWidth - 4,
        y,
        size: 9,
        font: subtitleFont,
        color: rgb(0.5, 0.5, 0.5),
      });
    }
    // Vertical lines (column separators)
    for (let c = 0; c <= cols; c++) {
      const x = tableLeft + c * colWidth;
      page.drawLine({
        start: { x, y: tableTop },
        end: { x, y: tableBottom },
        thickness: c === 0 || c === cols ? 1 : 0.5,
        color: c === 0 || c === cols ? rgb(0.4, 0.4, 0.4) : rgb(0.8, 0.8, 0.8),
      });
    }
    // Horizontal lines (row separators)
    for (let r = 0; r <= rows; r++) {
      const y = tableTop - r * rowHeight;
      page.drawLine({
        start: { x: tableLeft, y },
        end: { x: tableRight, y },
        thickness: r === 0 || r === rows ? 1 : 0.5,
        color: r === 0 || r === rows ? rgb(0.4, 0.4, 0.4) : rgb(0.8, 0.8, 0.8),
      });
    }
    // Disclaimer
    if (opts.disclaimer) {
      const dWidth = subtitleFont.widthOfTextAtSize(opts.disclaimer, 9);
      page.drawText(opts.disclaimer, {
        x: (width - dWidth) / 2,
        y: 30,
        size: 9,
        font: subtitleFont,
        color: rgb(0.6, 0.6, 0.6),
      });
    }
    // Sheet number (bottom right)
    if (opts.includeSheetNumbers) {
      const numText = `${i + 1} / ${sheetCount}`;
      const numWidth = subtitleFont.widthOfTextAtSize(numText, 10);
      page.drawText(numText, {
        x: width - numWidth - 36,
        y: 30,
        size: 10,
        font: subtitleFont,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
  }
  doc.setProducer("UnQTools — Numbers to PDF Converter");
  doc.setCreator("UnQTools — Numbers to PDF Converter");
  doc.setCreationDate(new Date());
  doc.setModificationDate(new Date());
  return doc.save();
}

// ===== Top-level conversion =====

export async function convertNumbersToPdf(
  bytes: Uint8Array,
  opts: NumbersConvertOptions = DEFAULT_OPTIONS,
  outputFileName: string = "converted.pdf",
): Promise<ToolResult<NumbersConvertResult>> {
  if (!isNumbersFile(bytes)) {
    return {
      ok: false,
      error: "Not a valid Numbers file (missing ZIP signature 0x50 0x4B 0x03 0x04).",
    };
  }
  const entries = parseZipEntries(bytes);
  if (entries.length === 0) {
    return { ok: false, error: "Numbers ZIP archive is empty." };
  }

  let metadata: NumbersMetadata = { ...EMPTY_METADATA };
  const metaEntry = findEntry(entries, "metadata.json");
  if (metaEntry) {
    try {
      const jsonText = decodeUtf8(await decompressEntry(metaEntry));
      metadata = parseMetadataJson(jsonText);
    } catch {
      // metadata.json unreadable
    }
  }

  if (metadata.sheetCount === 0) {
    const iwaCount = countSheetIwaFiles(entries);
    if (iwaCount > 0) metadata.sheetCount = iwaCount;
  }

  if (metadata.sheetCount === 0) {
    return {
      ok: false,
      error: "Could not determine sheet count from Numbers metadata. The file may be corrupted.",
    };
  }

  let previewImage: Uint8Array | null = null;
  const previewEntry = findEntry(entries, "preview.jpg") ?? findEntry(entries, "preview");
  if (previewEntry) {
    try {
      previewImage = await decompressEntry(previewEntry);
    } catch {
      // ignore
    }
  }

  const effectiveOpts: NumbersConvertOptions = {
    ...opts,
    title: opts.title || metadata.title || "",
  };

  const pdfBytes = await renderPlaceholderPdf(metadata, effectiveOpts);
  const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
  return {
    ok: true,
    output: {
      blob,
      fileName: outputFileName,
      metadata,
      previewImage,
      sheetCount: metadata.sheetCount,
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

const HISTORY_KEY = "unqtools-numbers-to-pdf-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  fileSize: number;
  sheetCount: number;
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

export function buildShareUrl(opts: NumbersConvertOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("size", opts.pageSize);
  params.set("numbers", String(opts.includeSheetNumbers));
  params.set("title", String(opts.includeTitlePage));
  params.set("rows", String(opts.placeholderRows));
  params.set("cols", String(opts.placeholderCols));
  if (opts.title) params.set("t", opts.title);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<NumbersConvertOptions> | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("size") && !params.has("numbers") && !params.has("rows") && !params.has("cols")) {
    return null;
  }
  const size = (params.get("size") ?? "letter-landscape") as NumbersPageSize;
  const validSizes: NumbersPageSize[] = ["letter-landscape", "a4-landscape", "a4-portrait"];
  const rows = parseInt(params.get("rows") ?? "20", 10);
  const cols = parseInt(params.get("cols") ?? "8", 10);
  return {
    pageSize: validSizes.includes(size) ? size : "letter-landscape",
    includeSheetNumbers: params.get("numbers") !== "false",
    includeTitlePage: params.get("title") !== "false",
    placeholderRows: isNaN(rows) ? 20 : Math.max(1, Math.min(50, rows)),
    placeholderCols: isNaN(cols) ? 8 : Math.max(1, Math.min(20, cols)),
    title: params.get("t") ?? "",
  };
}
