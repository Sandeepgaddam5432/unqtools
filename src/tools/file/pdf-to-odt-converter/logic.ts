/**
 * PDF to ODT Converter — pure-JS OpenDocument Text generator.
 *
 * ODT structure (ZIP archive):
 *   - mimetype (STORE method, must be first, uncompressed)
 *   - META-INF/manifest.xml — declares all files in the archive
 *   - content.xml — actual text content + automatic styles
 *   - styles.xml — named styles (Heading 1, etc.)
 *   - meta.xml — document metadata (title, author, generator)
 *
 * We extract text from the PDF, wrap each non-empty line in a <text:p>,
 * insert a page-break paragraph between PDF pages, and style the first
 * paragraph of each page as a Heading 1.
 */

import {
  extractPdfText,
  formatBytes,
  type ConvertOptions as TextOptions,
} from "../pdf-to-text-converter/logic";
import {
  createZipBlob,
  type ZipFile,
  xmlEscape,
  xmlAttrEscape,
} from "../csv-to-excel-converter/logic";
import type { ToolResult } from "../../../lib/tool";

// ===== Types =====

export type OdtFontSize = 10 | 11 | 12 | 14 | 16 | 18 | 20 | 22 | 24;
export type OdtFontFamily = "serif" | "sans" | "mono";
export type OdtPageSize = "a4" | "letter" | "legal";

export interface OdtOptions {
  /** Page range (e.g. "1-3,5"). Empty = all pages. */
  pageRange: string;
  /** Custom document title. */
  title: string;
  /** Custom document author. */
  author: string;
  /** Base font size in points. */
  fontSize: number;
  /** Font family. */
  fontFamily: OdtFontFamily;
  /** Page size. */
  pageSize: OdtPageSize;
  /** Page margins in cm. */
  margin: number;
  /** Insert page-break paragraphs between PDF pages. */
  insertPageBreaks: boolean;
  /** Style first paragraph of each page as Heading 1. */
  markPageHeadings: boolean;
}

export const DEFAULT_OPTIONS: OdtOptions = {
  pageRange: "",
  title: "Converted from PDF",
  author: "UnQTools",
  fontSize: 12,
  fontFamily: "serif",
  pageSize: "a4",
  margin: 2.54, // 1 inch
  insertPageBreaks: true,
  markPageHeadings: true,
};

export interface OdtResult {
  blob: Blob;
  fileName: string;
  paragraphCount: number;
  wordCount: number;
  charCount: number;
  pageCount: number;
  odtBytes: number;
}

// ===== Page dimensions =====

const CM_TO_INCH = 1 / 2.54;
const POINTS_PER_INCH = 72;

/** Get page dimensions in points for content.xml's <office:document-content> layout. */
export function getPageSizePoints(size: OdtPageSize): { width: number; height: number } {
  // A4 = 21x29.7 cm, Letter = 21.59x27.94 cm, Legal = 21.59x35.56 cm
  if (size === "a4") return { width: 595.276, height: 841.89 }; // 21x29.7cm in points
  if (size === "legal") return { width: 612, height: 1008 }; // 8.5x14 inch
  return { width: 612, height: 792 }; // Letter 8.5x11 inch
}

/** Convert cm to points (1 inch = 72 points, 1 inch = 2.54 cm). */
export function cmToPoints(cm: number): number {
  return Math.round(cm * CM_TO_INCH * POINTS_PER_INCH);
}

/** Get the CSS font-family name for an ODT font family. */
export function getFontFamilyName(family: OdtFontFamily): string {
  switch (family) {
    case "sans": return "Liberation Sans";
    case "mono": return "Liberation Mono";
    case "serif":
    default: return "Liberation Serif";
  }
}

// ===== content.xml =====

/** Escape text for XML — also strips control chars except \t \n. */
export function escapeXmlText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Build the <text:p> paragraphs for content.xml. */
export function buildParagraphs(pageTexts: string[], opts: OdtOptions): string[] {
  const paragraphs: string[] = [];
  for (let pi = 0; pi < pageTexts.length; pi++) {
    const pageText = pageTexts[pi] ?? "";
    const lines = pageText.split("\n").map((l) => l.trim());
    let firstNonEmpty = true;
    let emittedAny = false;
    for (const line of lines) {
      if (line === "") continue;
      const style = opts.markPageHeadings && firstNonEmpty ? ' text:style-name="Heading_20_1"' : "";
      paragraphs.push(`<text:p${style}>${escapeXmlText(line)}</text:p>`);
      firstNonEmpty = false;
      emittedAny = true;
    }
    if (emittedAny && opts.insertPageBreaks && pi < pageTexts.length - 1) {
      paragraphs.push(`<text:p text:style-name="PageBreak"/>`);
    }
  }
  return paragraphs;
}

/** Generate content.xml. */
export function generateContentXml(paragraphs: string[], opts: OdtOptions): string {
  const dims = getPageSizePoints(opts.pageSize);
  const margin = cmToPoints(opts.margin);
  const fontName = getFontFamilyName(opts.fontFamily);
  const fontSize = Math.max(8, Math.min(36, opts.fontSize));
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" office:version="1.2">
  <office:automatic-styles>
    <style:style style:name="PageBreak" style:family="paragraph">
      <style:paragraph-properties fo:break-before="page"/>
    </style:style>
  </office:automatic-styles>
  <office:body>
    <office:text>
      ${paragraphs.join("\n      ")}
    </office:text>
  </office:body>
</office:document-content>`;
}

// ===== styles.xml =====

export function generateStylesXml(opts: OdtOptions): string {
  const dims = getPageSizePoints(opts.pageSize);
  const margin = cmToPoints(opts.margin);
  const fontName = getFontFamilyName(opts.fontFamily);
  const fontSize = Math.max(8, Math.min(36, opts.fontSize));
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2">
  <office:font-face-decls>
    <style:font-face style:name="${xmlAttrEscape(fontName)}" svg:font-family="${xmlAttrEscape(fontName)}" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"/>
  </office:font-face-decls>
  <office:styles>
    <style:style style:name="Standard" style:family="paragraph">
      <style:text-properties style:font-name="${xmlAttrEscape(fontName)}" fo:font-size="${fontSize}pt" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"/>
    </style:style>
    <style:style style:name="Heading_20_1" style:display-name="Heading 1" style:family="paragraph" style:parent-style-name="Standard" style:next-style-name="Text_20_Body" style:default-outline-level="1">
      <style:text-properties style:font-name="${xmlAttrEscape(fontName)}" fo:font-size="${fontSize + 6}pt" fo:font-weight="bold"/>
    </style:style>
  </office:styles>
  <office:automatic-styles>
    <style:page-layout style:name="Mpm1">
      <style:page-layout-properties fo:page-width="${dims.width}pt" fo:page-height="${dims.height}pt" fo:margin-top="${margin}pt" fo:margin-bottom="${margin}pt" fo:margin-left="${margin}pt" fo:margin-right="${margin}pt"/>
    </style:page-layout>
  </office:automatic-styles>
  <office:master-styles>
    <style:master-page style:name="Standard" style:page-layout-name="Mpm1"/>
  </office:master-styles>
</office:document-styles>`;
}

// ===== meta.xml =====

export function generateMetaXml(opts: OdtOptions): string {
  const now = new Date().toISOString();
  const wordCount = 0; // placeholder — actual count computed in convert function
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" office:version="1.2">
  <office:meta>
    <meta:generator>UnQTools PDF to ODT Converter</meta:generator>
    <dc:title>${xmlEscape(opts.title)}</dc:title>
    <dc:creator>${xmlEscape(opts.author)}</dc:creator>
    <meta:creation-date>${now}</meta:creation-date>
    <dc:date>${now}</dc:date>
  </office:meta>
</office:document-meta>`;
}

// ===== META-INF/manifest.xml =====

export function generateManifestXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:media-type="application/vnd.oasis.opendocument.text" manifest:full-path="/"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="content.xml"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="styles.xml"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="meta.xml"/>
</manifest:manifest>`;
}

// ===== Top-level conversion =====

export async function convertPdfToOdt(
  pdfBytes: Uint8Array,
  opts: OdtOptions = DEFAULT_OPTIONS,
  outputFileName: string = "converted.odt",
): Promise<ToolResult<OdtResult>> {
  const textOptions: TextOptions = {
    pageRange: opts.pageRange,
    lineSeparator: "\n",
    pageSeparator: "",
    trimLines: true,
    removeEmptyLines: false,
    lineNumbers: false,
    addBom: false,
  };
  const textResult = await extractPdfText(pdfBytes, textOptions);
  if (!textResult.ok) {
    return { ok: false, error: textResult.error };
  }
  const pageTexts = textResult.output.pages.map((p) => p.text);
  const paragraphs = buildParagraphs(pageTexts, opts);
  if (paragraphs.length === 0) {
    return { ok: false, error: "No text content found in the PDF." };
  }
  const enc = new TextEncoder();
  const files: ZipFile[] = [];
  // mimetype MUST be first and uncompressed
  files.push({ name: "mimetype", data: enc.encode("application/vnd.oasis.opendocument.text") });
  files.push({ name: "META-INF/manifest.xml", data: enc.encode(generateManifestXml()) });
  files.push({ name: "content.xml", data: enc.encode(generateContentXml(paragraphs, opts)) });
  files.push({ name: "styles.xml", data: enc.encode(generateStylesXml(opts)) });
  files.push({ name: "meta.xml", data: enc.encode(generateMetaXml(opts)) });
  const blob = createZipBlob(files);
  const wordCount = textResult.output.totalWordCount;
  const charCount = textResult.output.totalCharCount;
  return {
    ok: true,
    output: {
      blob,
      fileName: outputFileName,
      paragraphCount: paragraphs.filter((p) => !p.includes('PageBreak')).length,
      wordCount,
      charCount,
      pageCount: textResult.output.pageCount,
      odtBytes: blob.size,
    },
  };
}

// ===== Utilities =====

export { formatBytes, xmlEscape, xmlAttrEscape };

// ===== History =====

const HISTORY_KEY = "unqtools-pdf-to-odt-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  pdfBytes: number;
  odtBytes: number;
  paragraphCount: number;
  wordCount: number;
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

export function buildShareUrl(opts: OdtOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  if (opts.pageRange) params.set("pages", opts.pageRange);
  params.set("fs", String(opts.fontSize));
  params.set("font", opts.fontFamily);
  params.set("page", opts.pageSize);
  params.set("margin", String(opts.margin));
  params.set("pb", String(opts.insertPageBreaks));
  params.set("head", String(opts.markPageHeadings));
  if (opts.title && opts.title !== DEFAULT_OPTIONS.title) params.set("title", opts.title);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<OdtOptions> | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("pages") && !params.has("fs") && !params.has("font")) return null;
  const font = (params.get("font") ?? "serif") as OdtFontFamily;
  const validFonts: OdtFontFamily[] = ["serif", "sans", "mono"];
  const page = (params.get("page") ?? "a4") as OdtPageSize;
  const validPages: OdtPageSize[] = ["a4", "letter", "legal"];
  const fs = parseInt(params.get("fs") ?? "12", 10);
  const margin = parseFloat(params.get("margin") ?? "2.54");
  return {
    pageRange: params.get("pages") ?? "",
    fontSize: isNaN(fs) ? 12 : Math.max(8, Math.min(36, fs)),
    fontFamily: validFonts.includes(font) ? font : "serif",
    pageSize: validPages.includes(page) ? page : "a4",
    margin: isNaN(margin) ? 2.54 : Math.max(0, Math.min(5, margin)),
    insertPageBreaks: params.get("pb") !== "false",
    markPageHeadings: params.get("head") !== "false",
    title: params.get("title") ?? "",
  };
}
