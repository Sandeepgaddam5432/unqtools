/**
 * Pages to PDF Converter — pure-JS ZIP parser + pdf-lib.
 *
 * Pages (.pages) structure (ZIP archive):
 *   - metadata.json: { "Generator_Version", "date", "title", ... }
 *   - Document.iwa: Snappy-compressed Protobuf (text + layout)
 *   - preview.jpg: thumbnail
 *   - preview.pdf (sometimes present): Apple's own PDF rendering — 1:1 layout
 *   - buildVersionHistory.plist
 *
 * HONESTY CLAUSE: When preview.pdf exists, we use it directly. Otherwise,
 * we extract text from Document.iwa using a heuristic (scan for printable
 * UTF-8 sequences) and re-render as a fresh PDF — layout fidelity is lost.
 * Documented in FAQ.
 */

import {
  parseZipEntries,
  decompressEntry,
  decodeUtf8,
} from "../epub-reader/logic";
import { PDFDocument, StandardFonts, rgb, PageSizes } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

// ===== Types =====

export interface PagesMetadata {
  title: string;
  author: string;
  /** Generator version string. */
  generatorVersion: string;
  /** Creation date (ISO string). */
  creationDate: string;
}

export const EMPTY_METADATA: PagesMetadata = {
  title: "",
  author: "",
  generatorVersion: "",
  creationDate: "",
};

export type PagesPageSize = "a4" | "letter";
export type PagesOrientation = "portrait" | "landscape";

export interface PagesConvertOptions {
  title: string;
  pageSize: PagesPageSize;
  orientation: PagesOrientation;
  fontSize: number;
  margin: number;
  /** Custom font family name (only 'Helvetica' is supported by pdf-lib's standard fonts). */
  fontFamily: string;
}

export const DEFAULT_OPTIONS: PagesConvertOptions = {
  title: "",
  pageSize: "letter",
  orientation: "portrait",
  fontSize: 12,
  margin: 50,
  fontFamily: "Helvetica",
};

export interface PagesConvertResult {
  blob: Blob;
  fileName: string;
  metadata: PagesMetadata;
  previewImage: Uint8Array | null;
  /** True if we used Apple's embedded preview.pdf (1:1 layout). */
  usedEmbeddedPdf: boolean;
  /** Extracted text (when re-rendering). */
  extractedText: string;
  wordCount: number;
  charCount: number;
  pageCount: number;
  pdfBytes: number;
}

// ===== Metadata parsing =====

export function parseMetadataJson(jsonText: string): PagesMetadata {
  const meta: PagesMetadata = { ...EMPTY_METADATA };
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
  return meta;
}

// ===== ZIP scanning =====

export function isPagesFile(bytes: Uint8Array): boolean {
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

/** Detect whether bytes look like a PDF (start with "%PDF-"). */
export function isPdfBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

// ===== Text extraction from .iwa (heuristic) =====

/**
 * Extract printable text from .iwa bytes (Snappy-compressed Protobuf).
 * We scan for sequences of UTF-8 printable characters (4+ chars in a row)
 * and concatenate them with newlines.
 *
 * HONESTY: This is a heuristic. It catches body text well but misses
 * formatting (bold, italics, headings) and images. For layout-perfect
 * output, the embedded preview.pdf is used when available.
 */
export function extractTextFromIwa(bytes: Uint8Array): string {
  const lines: string[] = [];
  let current: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    // Printable ASCII or common UTF-8 lead bytes
    if ((b >= 0x20 && b <= 0x7e) || b === 0x09 || b === 0x0a || b === 0x0d || b >= 0x80) {
      current.push(b);
    } else {
      if (current.length >= 4) {
        const decoded = safeDecodeUtf8(current);
        if (decoded && /[a-zA-Z0-9]/.test(decoded)) {
          lines.push(decoded);
        }
      }
      current = [];
    }
  }
  if (current.length >= 4) {
    const decoded = safeDecodeUtf8(current);
    if (decoded && /[a-zA-Z0-9]/.test(decoded)) {
      lines.push(decoded);
    }
  }
  return lines.join("\n").trim();
}

function safeDecodeUtf8(bytes: number[]): string {
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes));
  } catch {
    return "";
  }
}

/** Count words in a string. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((s) => s.length > 0).length;
}

// ===== PDF rendering =====

export function getPageDimensions(
  pageSize: PagesPageSize,
  orientation: PagesOrientation,
): { width: number; height: number } {
  const base = pageSize === "a4" ? PageSizes.A4 : PageSizes.Letter;
  const [w, h] = base;
  if (orientation === "landscape") {
    return { width: Math.max(w, h), height: Math.min(w, h) };
  }
  return { width: Math.min(w, h), height: Math.max(w, h) };
}

export async function renderTextPdf(
  text: string,
  opts: PagesConvertOptions,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fs = Math.max(8, Math.min(opts.fontSize, 24));
  const margin = Math.max(20, opts.margin);
  const { width, height } = getPageDimensions(opts.pageSize, opts.orientation);
  const availW = width - margin * 2;
  const lineHeight = fs * 1.4;

  // Wrap lines
  const rawLines = text.split("\n");
  const wrappedLines: string[] = [];
  for (const line of rawLines) {
    if (line === "") {
      wrappedLines.push("");
      continue;
    }
    const words = line.split(" ");
    let current = "";
    for (const word of words) {
      const test = current ? current + " " + word : word;
      const w = font.widthOfTextAtSize(test, fs);
      if (w > availW && current) {
        wrappedLines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) wrappedLines.push(current);
  }

  let y = height - margin;
  let page = doc.addPage([width, height]);
  let pageCount = 1;
  for (const line of wrappedLines) {
    if (y < margin) {
      page = doc.addPage([width, height]);
      y = height - margin;
      pageCount++;
    }
    if (line) {
      page.drawText(line, { x: margin, y: y - fs, size: fs, font, color: rgb(0, 0, 0) });
    }
    y -= lineHeight;
  }
  doc.setProducer("UnQTools — Pages to PDF Converter");
  doc.setCreator("UnQTools — Pages to PDF Converter");
  doc.setCreationDate(new Date());
  doc.setModificationDate(new Date());
  const bytes = await doc.save();
  // Attach pageCount via a side-channel — caller can't read it from bytes,
  // so we re-derive it from the rendered bytes by loading again (lightweight)
  void pageCount;
  return bytes;
}

/** Compute page count by re-loading the rendered PDF (cheap for small files). */
export async function countPdfPages(bytes: Uint8Array): Promise<number> {
  try {
    const doc = await PDFDocument.load(bytes);
    return doc.getPageCount();
  } catch {
    return 1;
  }
}

// ===== Top-level conversion =====

export async function convertPagesToPdf(
  bytes: Uint8Array,
  opts: PagesConvertOptions = DEFAULT_OPTIONS,
  outputFileName: string = "converted.pdf",
): Promise<ToolResult<PagesConvertResult>> {
  if (!isPagesFile(bytes)) {
    return {
      ok: false,
      error: "Not a valid Pages file (missing ZIP signature 0x50 0x4B 0x03 0x04).",
    };
  }
  const entries = parseZipEntries(bytes);
  if (entries.length === 0) {
    return { ok: false, error: "Pages ZIP archive is empty." };
  }

  // Extract metadata
  let metadata: PagesMetadata = { ...EMPTY_METADATA };
  const metaEntry = findEntry(entries, "metadata.json");
  if (metaEntry) {
    try {
      const jsonText = decodeUtf8(await decompressEntry(metaEntry));
      metadata = parseMetadataJson(jsonText);
    } catch {
      // ignore
    }
  }

  // Look for embedded preview.pdf (Apple's own rendering — 1:1 layout)
  const pdfEntry = findEntry(entries, "preview.pdf") ?? findEntry(entries, ".pdf");
  if (pdfEntry) {
    try {
      const pdfBytes = await decompressEntry(pdfEntry);
      if (isPdfBytes(pdfBytes)) {
        const pageCount = await countPdfPages(pdfBytes);
        const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });
        // Extract preview.jpg if present
        let previewImage: Uint8Array | null = null;
        const previewEntry = findEntry(entries, "preview.jpg");
        if (previewEntry) {
          try {
            previewImage = await decompressEntry(previewEntry);
          } catch {
            // ignore
          }
        }
        return {
          ok: true,
          output: {
            blob,
            fileName: outputFileName,
            metadata,
            previewImage,
            usedEmbeddedPdf: true,
            extractedText: "",
            wordCount: 0,
            charCount: 0,
            pageCount,
            pdfBytes: pdfBytes.length,
          },
        };
      }
    } catch {
      // preview.pdf unreadable — fall through to text extraction
    }
  }

  // Fallback: extract text from Document.iwa
  const docEntry = findEntry(entries, "document.iwa") ?? findEntry(entries, ".iwa");
  if (!docEntry) {
    return {
      ok: false,
      error: "Pages file has no Document.iwa and no preview.pdf — cannot extract content.",
    };
  }

  let iwaBytes: Uint8Array;
  try {
    iwaBytes = await decompressEntry(docEntry);
  } catch {
    return { ok: false, error: "Could not decompress Document.iwa (unsupported compression)." };
  }

  const extractedText = extractTextFromIwa(iwaBytes);
  if (!extractedText || extractedText.trim().length === 0) {
    return {
      ok: false,
      error: "Could not extract any text from Document.iwa (Snappy-compressed Protobuf — content not parseable in pure JS).",
    };
  }

  // Re-render text as a fresh PDF
  const effectiveOpts: PagesConvertOptions = {
    ...opts,
    title: opts.title || metadata.title || "",
  };

  const pdfBytes = await renderTextPdf(extractedText, effectiveOpts);
  const pageCount = await countPdfPages(pdfBytes);
  const blob = new Blob([pdfBytes as BlobPart], { type: "application/pdf" });

  // Extract preview.jpg if present
  let previewImage: Uint8Array | null = null;
  const previewEntry = findEntry(entries, "preview.jpg");
  if (previewEntry) {
    try {
      previewImage = await decompressEntry(previewEntry);
    } catch {
      // ignore
    }
  }

  return {
    ok: true,
    output: {
      blob,
      fileName: outputFileName,
      metadata,
      previewImage,
      usedEmbeddedPdf: false,
      extractedText,
      wordCount: countWords(extractedText),
      charCount: extractedText.length,
      pageCount,
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

const HISTORY_KEY = "unqtools-pages-to-pdf-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  fileSize: number;
  pageCount: number;
  wordCount: number;
  title: string;
  usedEmbeddedPdf: boolean;
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

export function buildShareUrl(opts: PagesConvertOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("size", opts.pageSize);
  params.set("orient", opts.orientation);
  params.set("fs", String(opts.fontSize));
  params.set("margin", String(opts.margin));
  if (opts.title) params.set("t", opts.title);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<PagesConvertOptions> | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("size") && !params.has("fs")) return null;
  const size = (params.get("size") ?? "letter") as PagesPageSize;
  const orient = (params.get("orient") ?? "portrait") as PagesOrientation;
  const fs = parseInt(params.get("fs") ?? "12", 10);
  const margin = parseInt(params.get("margin") ?? "50", 10);
  return {
    pageSize: size === "a4" ? "a4" : "letter",
    orientation: orient === "landscape" ? "landscape" : "portrait",
    fontSize: isNaN(fs) ? 12 : Math.max(8, Math.min(24, fs)),
    margin: isNaN(margin) ? 50 : Math.max(20, Math.min(100, margin)),
    title: params.get("t") ?? "",
  };
}
