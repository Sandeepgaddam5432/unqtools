/**
 * PDF to ODS Converter — pure-JS OpenDocument Spreadsheet generator.
 *
 * ODS structure (ZIP):
 *   - mimetype (STORE, first, uncompressed)
 *   - META-INF/manifest.xml
 *   - content.xml — sheets, rows, cells (with automatic styles)
 *   - styles.xml — named styles (header, default)
 *   - meta.xml — document metadata
 *
 * Each PDF text line becomes one row. Cells are split by the chosen
 * delimiter. Each PDF page becomes either a row block (single-sheet mode)
 * or its own sheet (multi-sheet mode).
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

export type OdsDelimiter = "tab" | "comma" | "semicolon" | "pipe" | "none";
export type OdsSheetMode = "single" | "multi";

export interface OdsOptions {
  /** Page range (e.g. "1-3,5"). Empty = all pages. */
  pageRange: string;
  /** Cell delimiter. */
  delimiter: OdsDelimiter;
  /** Sheet mode. */
  sheetMode: OdsSheetMode;
  /** Sheet name (for single-sheet mode). */
  sheetName: string;
  /** Treat first row of each sheet as header (bold + frozen). */
  hasHeader: boolean;
  /** Custom document title. */
  title: string;
  /** Custom document author. */
  author: string;
}

export const DEFAULT_OPTIONS: OdsOptions = {
  pageRange: "",
  delimiter: "tab",
  sheetMode: "single",
  sheetName: "Sheet1",
  hasHeader: true,
  title: "Converted from PDF",
  author: "UnQTools",
};

export interface OdsSheet {
  name: string;
  rows: string[][];
}

export interface OdsResult {
  blob: Blob;
  fileName: string;
  sheetCount: number;
  rowCount: number;
  columnCount: number;
  cellCount: number;
  pageCount: number;
  odsBytes: number;
  sheets: OdsSheet[];
}

// ===== Delimiter helpers =====

const DELIM_CHARS: Record<OdsDelimiter, string | null> = {
  tab: "\t",
  comma: ",",
  semicolon: ";",
  pipe: "|",
  none: null,
};

/** Get the actual delimiter character (or null for 'none' = one cell per line). */
export function getDelimiterChar(d: OdsDelimiter): string | null {
  return DELIM_CHARS[d] ?? null;
}

/** Sanitize a sheet name (ODS limits: 31 chars, no : \ / ? * [ ]). */
export function sanitizeSheetName(name: string): string {
  const cleaned = name
    .replace(/[:\\/?*\[\]]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31);
  return cleaned || "Sheet1";
}

/** Split a text line into cells using the chosen delimiter. */
export function splitLine(line: string, delim: OdsDelimiter): string[] {
  const ch = getDelimiterChar(delim);
  if (ch === null) return [line];
  return line.split(ch).map((c) => c.trim());
}

// ===== Sheet building =====

/** Build OdsSheet objects from PDF page texts. */
export function buildSheets(pageTexts: string[], opts: OdsOptions): OdsSheet[] {
  const sheets: OdsSheet[] = [];
  if (opts.sheetMode === "multi") {
    for (let i = 0; i < pageTexts.length; i++) {
      const text = pageTexts[i] ?? "";
      const rows = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l !== "")
        .map((l) => splitLine(l, opts.delimiter));
      if (rows.length === 0) continue;
      sheets.push({
        name: sanitizeSheetName(`Page ${i + 1}`),
        rows,
      });
    }
    return sheets;
  }
  // single mode — merge all pages into one sheet
  const allRows: string[][] = [];
  for (const pageText of pageTexts) {
    for (const line of pageText.split("\n")) {
      const trimmed = line.trim();
      if (trimmed === "") continue;
      allRows.push(splitLine(trimmed, opts.delimiter));
    }
  }
  if (allRows.length === 0) return [];
  sheets.push({
    name: sanitizeSheetName(opts.sheetName),
    rows: allRows,
  });
  return sheets;
}

// ===== Content.xml =====

const OFFICE_NS = "urn:oasis:names:tc:opendocument:xmlns:office:1.0";
const TABLE_NS = "urn:oasis:names:tc:opendocument:xmlns:table:1.0";
const TEXT_NS = "urn:oasis:names:tc:opendocument:xmlns:text:1.0";
const STYLE_NS = "urn:oasis:names:tc:opendocument:xmlns:style:1.0";
const FO_NS = "urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0";

/** Generate content.xml for the ODS file. */
export function generateContentXml(sheets: OdsSheet[], opts: OdsOptions): string {
  const autoStyles = opts.hasHeader
    ? `<style:style style:name="HeaderCell" style:family="table-cell">
      <style:text-properties fo:font-weight="bold"/>
      <style:table-cell-properties fo:background-color="#DDDDDD"/>
    </style:style>`
    : "";
  const sheetsXml = sheets.map((sheet, sIdx) => {
    void sIdx;
    const rowsXml = sheet.rows.map((row, rIdx) => {
      const isHeader = opts.hasHeader && rIdx === 0;
      const cellsXml = row.map((cell) => {
        const escaped = xmlEscape(cell);
        const style = isHeader ? ' table:style-name="HeaderCell"' : "";
        // Detect number vs string
        const isNum = /^-?\d+(\.\d+)?$/.test(cell);
        if (cell === "") {
          return `<table:table-cell/>`;
        }
        if (isNum) {
          return `<table:table-cell${style} office:value-type="float" office:value="${xmlAttrEscape(cell)}"><text:p>${escaped}</text:p></table:table-cell>`;
        }
        return `<table:table-cell${style} office:value-type="string"><text:p>${escaped}</text:p></table:table-cell>`;
      }).join("");
      const rowStyle = isHeader ? ' table:default-cell-style-name="HeaderCell"' : "";
      return `<table:table-row${rowStyle}>${cellsXml}</table:table-row>`;
    }).join("");
    const repeat = sheets.length > 1 ? ` table:print="true"` : "";
    return `<table:table table:name="${xmlAttrEscape(sheet.name)}"${repeat}>
${rowsXml}
</table:table>`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="${OFFICE_NS}" xmlns:table="${TABLE_NS}" xmlns:text="${TEXT_NS}" xmlns:style="${STYLE_NS}" xmlns:fo="${FO_NS}" office:version="1.2">
  <office:automatic-styles>
    ${autoStyles}
  </office:automatic-styles>
  <office:body>
    <office:spreadsheet>
${sheetsXml}
    </office:spreadsheet>
  </office:body>
</office:document-content>`;
}

// ===== Styles.xml =====

export function generateStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="${OFFICE_NS}" xmlns:style="${STYLE_NS}" xmlns:fo="${FO_NS}" xmlns:table="${TABLE_NS}" office:version="1.2">
  <office:font-face-decls>
    <style:font-face style:name="Liberation Sans" svg:font-family="Liberation Sans" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"/>
  </office:font-face-decls>
  <office:styles>
    <style:default-style style:family="table-cell">
      <style:table-cell-properties style:vertical-align="automatic"/>
      <style:text-properties style:font-name="Liberation Sans" fo:font-size="11pt"/>
    </style:default-style>
  </office:styles>
</office:document-styles>`;
}

// ===== Meta.xml =====

export function generateMetaXml(opts: OdsOptions, stats: { rowCount: number; columnCount: number; sheetCount: number }): string {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="${OFFICE_NS}" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" office:version="1.2">
  <office:meta>
    <meta:generator>UnQTools PDF to ODS Converter</meta:generator>
    <dc:title>${xmlEscape(opts.title)}</dc:title>
    <dc:creator>${xmlEscape(opts.author)}</dc:creator>
    <meta:creation-date>${now}</meta:creation-date>
    <dc:date>${now}</dc:date>
    <meta:document-statistic meta:table-count="${stats.sheetCount}" meta:cell-count="${stats.rowCount * stats.columnCount}"/>
  </office:meta>
</office:document-meta>`;
}

// ===== META-INF/manifest.xml =====

export function generateManifestXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:media-type="application/vnd.oasis.opendocument.spreadsheet" manifest:full-path="/"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="content.xml"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="styles.xml"/>
  <manifest:file-entry manifest:media-type="text/xml" manifest:full-path="meta.xml"/>
</manifest:manifest>`;
}

// ===== Top-level conversion =====

export async function convertPdfToOds(
  pdfBytes: Uint8Array,
  opts: OdsOptions = DEFAULT_OPTIONS,
  outputFileName: string = "converted.ods",
): Promise<ToolResult<OdsResult>> {
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
  const sheets = buildSheets(pageTexts, opts);
  if (sheets.length === 0) {
    return { ok: false, error: "No text content found in the PDF." };
  }
  const rowCount = sheets.reduce((s, sh) => s + sh.rows.length, 0);
  const columnCount = sheets.reduce((s, sh) => s + sh.rows.reduce((m, r) => Math.max(m, r.length), 0), 0);
  const cellCount = sheets.reduce((s, sh) => s + sh.rows.reduce((c, r) => c + r.length, 0), 0);
  const enc = new TextEncoder();
  const files: ZipFile[] = [];
  files.push({ name: "mimetype", data: enc.encode("application/vnd.oasis.opendocument.spreadsheet") });
  files.push({ name: "META-INF/manifest.xml", data: enc.encode(generateManifestXml()) });
  files.push({ name: "content.xml", data: enc.encode(generateContentXml(sheets, opts)) });
  files.push({ name: "styles.xml", data: enc.encode(generateStylesXml()) });
  files.push({ name: "meta.xml", data: enc.encode(generateMetaXml(opts, { rowCount, columnCount, sheetCount: sheets.length })) });
  const blob = createZipBlob(files);
  return {
    ok: true,
    output: {
      blob,
      fileName: outputFileName,
      sheetCount: sheets.length,
      rowCount,
      columnCount,
      cellCount,
      pageCount: textResult.output.pageCount,
      odsBytes: blob.size,
      sheets,
    },
  };
}

// ===== Utilities =====

export { formatBytes, xmlEscape, xmlAttrEscape };

// ===== History =====

const HISTORY_KEY = "unqtools-pdf-to-ods-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  pdfBytes: number;
  odsBytes: number;
  sheetCount: number;
  rowCount: number;
  cellCount: number;
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

export function buildShareUrl(opts: OdsOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  if (opts.pageRange) params.set("pages", opts.pageRange);
  params.set("delim", opts.delimiter);
  params.set("mode", opts.sheetMode);
  params.set("header", String(opts.hasHeader));
  if (opts.sheetName && opts.sheetName !== DEFAULT_OPTIONS.sheetName) params.set("sheet", opts.sheetName);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<OdsOptions> | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("delim") && !params.has("pages") && !params.has("mode")) return null;
  const delim = (params.get("delim") ?? "tab") as OdsDelimiter;
  const validDelims: OdsDelimiter[] = ["tab", "comma", "semicolon", "pipe", "none"];
  const mode = (params.get("mode") ?? "single") as OdsSheetMode;
  const validModes: OdsSheetMode[] = ["single", "multi"];
  return {
    pageRange: params.get("pages") ?? "",
    delimiter: validDelims.includes(delim) ? delim : "tab",
    sheetMode: validModes.includes(mode) ? mode : "single",
    hasHeader: params.get("header") !== "false",
    sheetName: params.get("sheet") ?? DEFAULT_OPTIONS.sheetName,
  };
}
