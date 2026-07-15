/**
 * ODS to PDF Converter — pure-JS ODS parser + pdf-lib renderer.
 *
 * ODS (OpenDocument Spreadsheet) is a ZIP containing XML files:
 *   - content.xml — sheets (table:table) with rows (table:table-row) and cells
 *   - styles.xml  — cell styles (we don't apply inheritance)
 *   - meta.xml    — document metadata
 *
 * We parse content.xml into a tree, walk it to extract tables, then render
 * each table to a PDF page using pdf-lib. Cell width is auto-fitted to content.
 */

import { PDFDocument, StandardFonts, PageSizes, rgb } from "pdf-lib";
import {
  parseZipEntries as parseZipEntriesBase,
  decompressEntry as decompressEntryBase,
  parseXml,
  type ZipEntry as BaseZipEntry,
  type XmlNode,
} from "../excel-to-csv-converter/logic";
import type { ToolResult } from "../../../lib/tool";

// ===== Types =====

export interface OdsCell {
  /** Cell text content. */
  value: string;
  /** Whether the cell is a number (for right-alignment). */
  isNumber: boolean;
}

export interface OdsRow {
  cells: OdsCell[];
}

export interface OdsSheet {
  /** Sheet name from table:name attribute. */
  name: string;
  rows: OdsRow[];
  /** Max column count across all rows. */
  columnCount: number;
}

export interface OdsMetadata {
  title: string;
  author: string;
  subject: string;
  generator: string;
  creationDate: string;
  metaFound: boolean;
}

export interface OdsStats {
  sheetCount: number;
  rowCount: number;
  cellCount: number;
  maxColumnCount: number;
  pageCount: number;
  pdfBytes: number;
}

export interface ConvertOptions {
  /** Which sheet to render (0-indexed). -1 means all sheets. */
  sheetIndex: number;
  orientation: "portrait" | "landscape";
  margin: number;
  fontSize: number;
  boldHeader: boolean;
  /** Maximum rows per sheet to render (safety cap). */
  maxRowsPerSheet: number;
}

export const DEFAULT_OPTIONS: ConvertOptions = {
  sheetIndex: -1,
  orientation: "portrait",
  margin: 36,
  fontSize: 9,
  boldHeader: true,
  maxRowsPerSheet: 200,
};

// ===== ZIP / XML helpers =====

export async function readZipEntry(bytes: Uint8Array, name: string): Promise<Uint8Array | null> {
  const entries = parseZipEntriesBase(bytes);
  const entry = entries.find((e) => e.name === name);
  if (!entry) return null;
  return decompressEntryBase(entry);
}

export function isOdsArchive(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 && bytes[1] === 0x4b &&
    bytes[2] === 0x03 && bytes[3] === 0x04
  );
}

// ===== Sheet extraction =====

export function extractSheets(contentXml: string): OdsSheet[] {
  const root = parseXml(contentXml);
  const body = findDescendant(root, "office:body");
  if (!body) return [];
  const spreadsheet = findDescendant(body, "office:spreadsheet");
  if (!spreadsheet) return [];
  const sheets: OdsSheet[] = [];
  for (const child of spreadsheet.children) {
    if (child.name === "table:table") {
      sheets.push(parseSheet(child));
    }
  }
  return sheets;
}

function parseSheet(tableNode: XmlNode): OdsSheet {
  const name = tableNode.attributes["table:name"] ?? "Sheet";
  const rows: OdsRow[] = [];
  let maxColCount = 0;
  for (const child of tableNode.children) {
    if (child.name === "table:table-row") {
      const row = parseRow(child);
      if (row.cells.length > 0) {
        rows.push(row);
        if (row.cells.length > maxColCount) maxColCount = row.cells.length;
      }
    }
  }
  return { name, rows, columnCount: maxColCount };
}

function parseRow(rowNode: XmlNode): OdsRow {
  const cells: OdsCell[] = [];
  for (const child of rowNode.children) {
    if (child.name === "table:table-cell" || child.name === "table:covered-table-cell") {
      const repeat = parseInt(child.attributes["table:number-columns-repeated"] ?? "1", 10) || 1;
      const value = extractCellValue(child);
      const cell: OdsCell = { value, isNumber: isNumeric(value) };
      // Cap repeat to 256 (LibreOffice sometimes emits huge repeats for empty trailing cells).
      const cappedRepeat = Math.min(repeat, 256);
      for (let i = 0; i < cappedRepeat; i++) {
        cells.push(i === 0 ? cell : { value: cell.value, isNumber: cell.isNumber });
      }
    }
  }
  // Strip trailing empty cells
  while (cells.length > 0 && cells[cells.length - 1]!.value === "") {
    cells.pop();
  }
  return { cells };
}

function extractCellValue(cellNode: XmlNode): string {
  const valueType = cellNode.attributes["office:value-type"] ?? "";
  if (valueType === "float" || valueType === "currency" || valueType === "percentage") {
    const v = cellNode.attributes["office:value"] ?? cellNode.attributes["calcext:value"] ?? "";
    if (v) return v;
  }
  if (valueType === "boolean") {
    return cellNode.attributes["office:boolean-value"] === "true" ? "TRUE" : "FALSE";
  }
  if (valueType === "date") {
    return cellNode.attributes["office:date-value"] ?? "";
  }
  // Default: collect text content (text:p children)
  return collectText(cellNode).trim();
}

function collectText(node: XmlNode): string {
  let out = node.text || "";
  for (const child of node.children) {
    if (child.name === "text:line-break") out += "\n";
    else if (child.name === "text:tab") out += "\t";
    else if (child.name === "text:s") {
      const count = parseInt(child.attributes["text:c"] ?? "1", 10) || 1;
      out += " ".repeat(count);
    } else {
      out += collectText(child);
    }
  }
  return out;
}

function isNumeric(s: string): boolean {
  if (!s) return false;
  return /^-?\d+(\.\d+)?$/.test(s);
}

function findDescendant(node: XmlNode, name: string): XmlNode | null {
  for (const c of node.children) {
    if (c.name === name) return c;
    const found = findDescendant(c, name);
    if (found) return found;
  }
  return null;
}

// ===== Metadata =====

export function parseMeta(metaXml: string): OdsMetadata {
  const result: OdsMetadata = {
    title: "", author: "", subject: "", generator: "",
    creationDate: "", metaFound: true,
  };
  const root = parseXml(metaXml);
  const meta = findDescendant(root, "office:meta");
  if (!meta) return result;
  for (const child of meta.children) {
    const text = collectText(child);
    switch (child.name) {
      case "dc:title": result.title = text; break;
      case "dc:creator": result.author = text; break;
      case "dc:subject": result.subject = text; break;
      case "meta:generator": result.generator = text; break;
      case "meta:creation-date": result.creationDate = text; break;
    }
  }
  return result;
}

// ===== Stats =====

export function computeStats(sheets: OdsSheet[], pageCount: number, pdfBytes: number): OdsStats {
  let rowCount = 0;
  let cellCount = 0;
  let maxColumnCount = 0;
  for (const s of sheets) {
    rowCount += s.rows.length;
    for (const r of s.rows) cellCount += r.cells.length;
    if (s.columnCount > maxColumnCount) maxColumnCount = s.columnCount;
  }
  return {
    sheetCount: sheets.length,
    rowCount,
    cellCount,
    maxColumnCount,
    pageCount,
    pdfBytes,
  };
}

// ===== PDF rendering =====

export async function convertOdsToPdf(
  odsBytes: Uint8Array,
  opts: ConvertOptions = DEFAULT_OPTIONS,
): Promise<ToolResult<{ bytes: Uint8Array; stats: OdsStats; metadata: OdsMetadata }>> {
  if (!isOdsArchive(odsBytes)) {
    return { ok: false, error: "Not an ODS file — missing ZIP signature." };
  }
  try {
    const contentBytes = await readZipEntry(odsBytes, "content.xml");
    if (!contentBytes) {
      return { ok: false, error: "ODS is missing content.xml — the file may be corrupted." };
    }
    const contentXml = new TextDecoder("utf-8").decode(contentBytes);
    const allSheets = extractSheets(contentXml);
    if (allSheets.length === 0) {
      return { ok: false, error: "No sheets found in the ODS file." };
    }
    const sheets = opts.sheetIndex >= 0 ? [allSheets[opts.sheetIndex]!].filter(Boolean) : allSheets;

    let metadata: OdsMetadata = {
      title: "", author: "", subject: "", generator: "",
      creationDate: "", metaFound: false,
    };
    try {
      const metaBytes = await readZipEntry(odsBytes, "meta.xml");
      if (metaBytes) {
        const metaXml = new TextDecoder("utf-8").decode(metaBytes);
        metadata = parseMeta(metaXml);
      }
    } catch {
      /* optional */
    }

    const doc = await PDFDocument.create();
    const regularFont = await doc.embedFont(StandardFonts.Helvetica);
    const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

    const base = PageSizes.A4;
    const isLandscape = opts.orientation === "landscape";
    const pageW = isLandscape ? Math.max(base[0], base[1]) : Math.min(base[0], base[1]);
    const pageH = isLandscape ? Math.min(base[0], base[1]) : Math.max(base[0], base[1]);
    const margin = Math.max(20, Math.min(80, opts.margin));
    const fs = Math.max(7, Math.min(14, opts.fontSize));

    for (const sheet of sheets) {
      const page = doc.addPage([pageW, pageH]);
      let y = pageH - margin;
      // Sheet name as a header
      page.drawText(sheet.name, {
        x: margin, y: y - fs, size: fs + 2, font: boldFont,
        color: rgb(0, 0, 0),
      });
      y -= (fs + 2) * 1.5;

      // Truncate rows if too many
      const rowsToRender = sheet.rows.slice(0, opts.maxRowsPerSheet);
      if (sheet.rows.length > opts.maxRowsPerSheet) {
        // Just truncate
      }

      // Compute column widths based on content
      const colCount = sheet.columnCount;
      const colWidths: number[] = new Array(colCount).fill(0);
      for (const row of rowsToRender) {
        for (let c = 0; c < row.cells.length && c < colCount; c++) {
          const cellText = row.cells[c]!.value;
          const w = regularFont.widthOfTextAtSize(cellText, fs);
          if (w > colWidths[c]!) colWidths[c] = w;
        }
      }
      // Add padding and cap each column width
      const padding = 4;
      const maxWidth = (pageW - margin * 2) / colCount;
      let totalWidth = 0;
      for (let c = 0; c < colCount; c++) {
        colWidths[c] = Math.min(colWidths[c]! + padding * 2, maxWidth);
        totalWidth += colWidths[c]!;
      }
      // Scale down if total exceeds available width
      const availW = pageW - margin * 2;
      if (totalWidth > availW) {
        const scale = availW / totalWidth;
        for (let c = 0; c < colCount; c++) colWidths[c]! *= scale;
      }

      const rowHeight = fs * 1.5;
      let x = margin;
      const drawHeader = opts.boldHeader && rowsToRender.length > 0;

      // Render rows
      for (let r = 0; r < rowsToRender.length; r++) {
        if (y - rowHeight < margin) {
          // Out of page space — stop rendering this sheet
          break;
        }
        const row = rowsToRender[r]!;
        const isHeader = drawHeader && r === 0;
        const font = isHeader ? boldFont : regularFont;
        x = margin;
        for (let c = 0; c < colCount; c++) {
          const cell = row.cells[c];
          const text = cell?.value ?? "";
          if (text) {
            // Truncate text if wider than column
            let displayText = text;
            const colW = colWidths[c]! - padding * 2;
            while (font.widthOfTextAtSize(displayText, fs) > colW && displayText.length > 1) {
              displayText = displayText.slice(0, -1);
            }
            const textX = cell?.isNumber ? x + colWidths[c]! - padding - font.widthOfTextAtSize(displayText, fs) : x + padding;
            page.drawText(displayText, {
              x: textX, y: y - fs, size: fs, font, color: rgb(0, 0, 0),
            });
          }
          x += colWidths[c]!;
        }
        // Draw row separator
        page.drawLine({
          start: { x: margin, y: y - rowHeight + 2 },
          end: { x: margin + Math.min(totalWidth, availW), y: y - rowHeight + 2 },
          thickness: 0.5,
          color: rgb(0.7, 0.7, 0.7),
        });
        y -= rowHeight;
      }
    }

    doc.setTitle(metadata.title || "Converted from ODS");
    if (metadata.author) doc.setAuthor(metadata.author);
    doc.setProducer("UnQTools — ODS to PDF");
    doc.setCreator("UnQTools — ODS to PDF");
    doc.setCreationDate(new Date());
    doc.setModificationDate(new Date());

    const pageCount = doc.getPageCount();
    const pdfBytes = await doc.save();
    const stats = computeStats(sheets, pageCount, pdfBytes.length);
    return { ok: true, output: { bytes: pdfBytes, stats, metadata } };
  } catch (e) {
    return { ok: false, error: `ODS to PDF conversion failed: ${(e as Error).message}` };
  }
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

const HISTORY_KEY = "unqtools-ods-to-pdf-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  odsBytes: number;
  pdfBytes: number;
  sheetCount: number;
  rowCount: number;
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

export function buildShareUrl(opts: ConvertOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("sheet", String(opts.sheetIndex));
  params.set("orient", opts.orientation);
  params.set("margin", String(opts.margin));
  params.set("fs", String(opts.fontSize));
  params.set("bold", String(opts.boldHeader));
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ConvertOptions | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("sheet") && !params.has("orient")) return null;
  const sheet = parseInt(params.get("sheet") ?? "-1", 10);
  const orient = (params.get("orient") ?? "portrait") as ConvertOptions["orientation"];
  const margin = parseInt(params.get("margin") ?? "36", 10);
  const fs = parseInt(params.get("fs") ?? "9", 10);
  const bold = params.get("bold") !== "false";
  return {
    sheetIndex: isNaN(sheet) ? -1 : sheet,
    orientation: orient === "landscape" ? "landscape" : "portrait",
    margin: isNaN(margin) ? 36 : Math.max(20, Math.min(80, margin)),
    fontSize: isNaN(fs) ? 9 : Math.max(7, Math.min(14, fs)),
    boldHeader: bold,
    maxRowsPerSheet: 200,
  };
}
