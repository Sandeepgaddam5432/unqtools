/**
 * CSV to Excel Converter — pure-JS XLSX writer (no SheetJS dependency).
 *
 * Pipeline:
 *   1. Parse CSV (RFC 4180: quoted fields, escaped quotes, embedded newlines).
 *   2. Detect cell type per value (boolean / number / date / text).
 *   3. Build shared strings table (Excel deduplicates text cells).
 *   4. Generate sheet XML using SpreadsheetML namespace.
 *   5. Generate workbook.xml, workbook.xml.rels, [Content_Types].xml.
 *   6. Package everything into a ZIP (STORE method, no compression).
 */

export type Delimiter = "," | "\t" | ";" | "|" | "auto";

export type CellType = "text" | "number" | "boolean" | "date";

export interface CellValue {
  type: CellType;
  /** For text: the raw string. For number: the numeric value as string. For date: ISO date. For boolean: "true" / "false". */
  raw: string;
}

export interface CsvParseOptions {
  delimiter: Delimiter;
  hasHeader: boolean;
  trimWhitespace?: boolean;
}

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  rawRowCount: number;
}

export interface Sheet {
  name: string;
  headers: string[];
  rows: string[][];
}

export interface ConversionOptions {
  /** Force all cells to text type (skip type detection). */
  forceText: boolean;
  /** Apply bold style + light fill to the header row. */
  styleHeader: boolean;
  /** Auto-fit column widths based on content. */
  autoFitColumns: boolean;
  /** Treat first row as header. */
  hasHeader: boolean;
}

export const DEFAULT_OPTIONS: ConversionOptions = {
  forceText: false,
  styleHeader: true,
  autoFitColumns: true,
  hasHeader: true,
};

// ===== CSV parsing (RFC 4180) =====

export function detectDelimiter(input: string): Delimiter {
  const firstLine = input.split(/\r?\n/)[0] ?? "";
  const candidates: Array<{ d: Delimiter; count: number }> = [
    { d: ",", count: (firstLine.match(/,/g) ?? []).length },
    { d: "\t", count: (firstLine.match(/\t/g) ?? []).length },
    { d: ";", count: (firstLine.match(/;/g) ?? []).length },
    { d: "|", count: (firstLine.match(/\|/g) ?? []).length },
  ];
  candidates.sort((a, b) => b.count - a.count);
  return candidates[0].count > 0 ? candidates[0].d : ",";
}

export function parseCsvRows(input: string, delimiter: string, trimWhitespace = false): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let i = 0;
  const len = input.length;
  const delim = delimiter.length === 1 ? delimiter : delimiter[0];

  while (i < len) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < len && input[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      currentField += ch;
      i++;
      continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === delim) {
      currentRow.push(trimWhitespace ? currentField.trim() : currentField);
      currentField = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      currentRow.push(trimWhitespace ? currentField.trim() : currentField);
      currentField = "";
      rows.push(currentRow);
      currentRow = [];
      i++;
      if (i < len && input[i] === "\n") i++;
      continue;
    }
    if (ch === "\n") {
      currentRow.push(trimWhitespace ? currentField.trim() : currentField);
      currentField = "";
      rows.push(currentRow);
      currentRow = [];
      i++;
      continue;
    }
    currentField += ch;
    i++;
  }
  if (currentField !== "" || currentRow.length > 0) {
    currentRow.push(trimWhitespace ? currentField.trim() : currentField);
    rows.push(currentRow);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

export function parseCsv(input: string, options: CsvParseOptions): ParsedCsv {
  const delimiter = options.delimiter === "auto" ? detectDelimiter(input) : options.delimiter;
  const { hasHeader, trimWhitespace = false } = options;
  const rows = parseCsvRows(input, delimiter, trimWhitespace);
  const headers = hasHeader && rows.length > 0 ? rows[0].map((h) => (trimWhitespace ? h.trim() : h)) : [];
  const dataRows = hasHeader ? rows.slice(1) : rows;
  return { headers, rows: dataRows, rawRowCount: rows.length };
}

// ===== Cell type detection =====

const BOOLEAN_TRUE = /^(true|yes|y|t)$/i;
const BOOLEAN_FALSE = /^(false|no|n|f)$/i;
const INTEGER = /^-?\d+$/;
const DECIMAL = /^-?\d+\.\d+$/;
const SCIENTIFIC = /^-?\d+(\.\d+)?[eE][-+]?\d+$/;
const PERCENT = /^-?\d+(\.\d+)?%$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLASH_DATE = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/;
const TIME = /^\d{1,2}:\d{2}(:\d{2})?$/;

/** Check if a numeric string has leading zeros (e.g. "00123", "007") — Excel should treat these as text. */
function hasLeadingZero(value: string): boolean {
  if (!/^-?\d+$/.test(value)) return false;
  const digits = value.replace(/^-/, "");
  return digits.length > 1 && digits.startsWith("0");
}

export function detectCellType(value: string): CellType {
  if (value === "" || value == null) return "text";
  if (BOOLEAN_TRUE.test(value) || BOOLEAN_FALSE.test(value)) return "boolean";
  if (hasLeadingZero(value)) return "text";
  if (INTEGER.test(value) || DECIMAL.test(value) || SCIENTIFIC.test(value)) return "number";
  // Percentage — treat as number (Excel will format it as 0%)
  if (PERCENT.test(value)) return "number";
  if (ISO_DATE.test(value) || SLASH_DATE.test(value) || ISO_DATETIME.test(value) || TIME.test(value)) return "date";
  return "text";
}

/** Convert a string value to its typed cell value. */
export function toCellValue(value: string, forceText: boolean = false): CellValue {
  if (forceText) return { type: "text", raw: value };
  const type = detectCellType(value);
  if (type === "boolean") {
    return { type: "boolean", raw: BOOLEAN_TRUE.test(value) ? "true" : "false" };
  }
  if (type === "number") {
    // Strip percent sign and divide
    if (PERCENT.test(value)) {
      const num = parseFloat(value.replace("%", "")) / 100;
      return { type: "number", raw: String(num) };
    }
    return { type: "number", raw: value };
  }
  if (type === "date") {
    // Convert to Excel-friendly ISO date serial
    return { type: "date", raw: value };
  }
  return { type: "text", raw: value };
}

/** Convert an ISO date string to Excel serial number (days since 1900-01-01). */
export function dateToExcelSerial(dateStr: string): number {
  // Excel uses 1900-01-01 as day 1, with the famous 1900-leap-year bug (treats 1900 as leap).
  // The conventional formula: serial = days since 1899-12-30.
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 0;
  const epoch = Date.UTC(1899, 11, 30);
  const diffMs = date.getTime() - epoch;
  return diffMs / (1000 * 60 * 60 * 24);
}

// ===== Shared strings table =====

export class SharedStrings {
  private strings: string[] = [];
  private index = new Map<string, number>();

  add(s: string): number {
    const existing = this.index.get(s);
    if (existing !== undefined) return existing;
    const idx = this.strings.length;
    this.strings.push(s);
    this.index.set(s, idx);
    return idx;
  }

  get size(): number { return this.strings.length; }

  toXml(): string {
    const items = this.strings.map((s) => `<si><t xml:space="preserve">${xmlEscape(s)}</t></si>`).join("");
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${this.strings.length}" uniqueCount="${this.strings.length}">${items}</sst>`;
  }
}

/** XML-escape a string for safe inclusion in XML. */
export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** XML-escape only attribute-value chars. */
export function xmlAttrEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Sanitize a sheet name (Excel limits: 31 chars, no : \ / ? * [ ]). */
export function sanitizeSheetName(name: string): string {
  return name
    .replace(/[:\\/?*\[\]]/g, "_")
    .slice(0, 31) || "Sheet1";
}

/** Generate column letter from index (0=A, 1=B, ...). */
export function columnLetter(index: number): string {
  let letter = "";
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

/** Compute auto-fit width for a column based on cell content. */
export function computeColumnWidth(values: string[], maxRows = 1000): number {
  const sample = values.slice(0, maxRows);
  let maxLen = 0;
  for (const v of sample) {
    if (v.length > maxLen) maxLen = v.length;
  }
  // Excel column width unit ≈ width of one digit. Cap at 50 to avoid runaway.
  return Math.min(50, Math.max(8, maxLen + 2));
}

// ===== Sheet XML generation =====

export interface SheetXmlResult {
  xml: string;
  sharedStringsUsed: number;
}

/** Generate the sheet XML for one CSV sheet. */
export function generateSheetXml(sheet: Sheet, options: ConversionOptions, sharedStrings: SharedStrings): SheetXmlResult {
  const rowsXml: string[] = [];
  const colsXml: string[] = [];
  const initialSharedSize = sharedStrings.size;

  // Build header row
  const headerRow = options.hasHeader ? sheet.headers : [];
  const allRows = options.hasHeader ? [headerRow, ...sheet.rows] : sheet.rows;

  // Compute column widths
  if (options.autoFitColumns) {
    const colCount = allRows.reduce((max, r) => Math.max(max, r.length), 0);
    for (let c = 0; c < colCount; c++) {
      const colValues = allRows.slice(0, 1000).map((r) => r[c] ?? "");
      const width = computeColumnWidth(colValues);
      colsXml.push(`<col min="${c + 1}" max="${c + 1}" width="${width}" customWidth="1"/>`);
    }
  }

  // Build rows
  for (let r = 0; r < allRows.length; r++) {
    const row = allRows[r];
    const cellsXml: string[] = [];
    const isHeader = options.hasHeader && r === 0;
    for (let c = 0; c < row.length; c++) {
      const raw = row[c] ?? "";
      const cellRef = `${columnLetter(c)}${r + 1}`;
      let cellXml: string;

      if (isHeader) {
        // Header row — always text via shared strings, with style
        const idx = sharedStrings.add(raw);
        cellXml = `<c r="${cellRef}" s="1" t="s"><v>${idx}</v></c>`;
      } else if (raw === "") {
        cellXml = `<c r="${cellRef}"/>`;
      } else {
        const value = toCellValue(raw, options.forceText);
        if (value.type === "number") {
          cellXml = `<c r="${cellRef}"><v>${value.raw}</v></c>`;
        } else if (value.type === "boolean") {
          cellXml = `<c r="${cellRef}" t="b"><v>${value.raw === "true" ? "1" : "0"}</v></c>`;
        } else if (value.type === "date") {
          const serial = dateToExcelSerial(value.raw);
          cellXml = `<c r="${cellRef}" s="2"><v>${serial}</v></c>`;
        } else {
          const idx = sharedStrings.add(raw);
          cellXml = `<c r="${cellRef}" t="s"><v>${idx}</v></c>`;
        }
      }
      cellsXml.push(cellXml);
    }
    const rowAttrs = isHeader ? ` r="${r + 1}" ht="20" customHeight="1"` : ` r="${r + 1}"`;
    rowsXml.push(`<row${rowAttrs}>${cellsXml.join("")}</row>`);
  }

  const colsBlock = colsXml.length > 0 ? `<cols>${colsXml.join("")}</cols>` : "";
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${colsBlock}<sheetData>${rowsXml.join("")}</sheetData></worksheet>`;

  return { xml, sharedStringsUsed: sharedStrings.size - initialSharedSize };
}

// ===== Workbook-level XML =====

export function generateWorkbookXml(sheets: Sheet[]): string {
  const sheetTags = sheets.map((s, i) => `<sheet name="${xmlAttrEscape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetTags}</sheets></workbook>`;
}

export function generateWorkbookRelsXml(sheetCount: number): string {
  const rels = [];
  for (let i = 0; i < sheetCount; i++) {
    rels.push(`<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`);
  }
  rels.push(`<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>`);
  rels.push(`<Relationship Id="rId${sheetCount + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>`;
}

export function generateContentTypesXml(sheetCount: number): string {
  const overrides = [
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`,
    `<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>`,
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`,
  ];
  for (let i = 0; i < sheetCount; i++) {
    overrides.push(`<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${overrides.join("")}</Types>`;
}

export function generateRootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
}

export function generateStylesXml(): string {
  // Style index 0: default. Index 1: header (bold + fill). Index 2: date format.
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF4472C4"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

// ===== ZIP writer (STORE method) =====

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipFile { name: string; data: Uint8Array; }

/** Build a ZIP archive (STORE method) from binary entries. Returns a Blob. */
export function createZipBlob(files: ZipFile[]): Blob {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const enc = new TextEncoder();

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);     // STORE
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader);
    localParts.push(file.data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + file.data.length;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const centralOffset = offset;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  ev.setUint16(20, 0, true);

  const allParts = [...localParts, ...centralParts, eocd];
  const totalLength = allParts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(totalLength);
  let pos = 0;
  for (const p of allParts) { out.set(p, pos); pos += p.length; }
  return new Blob([out as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// ===== Top-level conversion =====

export interface ConversionResult {
  blob: Blob;
  fileName: string;
  stats: ConversionStats;
}

export interface ConversionStats {
  sheetCount: number;
  totalRows: number;
  totalCells: number;
  sharedStringsCount: number;
  xlsxBytes: number;
}

export interface InputCsv {
  fileName: string;
  content: string;
}

/** Convert one or more CSVs into a single XLSX file. */
export function convertCsvsToXlsx(
  inputs: Array<{ fileName: string; content: string; sheetName?: string }>,
  options: ConversionOptions = DEFAULT_OPTIONS,
  delimiter: Delimiter = "auto",
  outputFileName: string = "converted.xlsx",
): ConversionResult {
  if (inputs.length === 0) throw new Error("No CSV inputs provided.");

  const sheets: Sheet[] = inputs.map((inp) => {
    const parsed = parseCsv(inp.content, {
      delimiter,
      hasHeader: options.hasHeader,
      trimWhitespace: false,
    });
    const name = sanitizeSheetName(inp.sheetName ?? inp.fileName.replace(/\.csv$/i, ""));
    return { name, headers: parsed.headers, rows: parsed.rows };
  });

  const sharedStrings = new SharedStrings();
  const sheetXmls = sheets.map((s) => generateSheetXml(s, options, sharedStrings).xml);

  const files: ZipFile[] = [];
  const enc = new TextEncoder();
  files.push({ name: "[Content_Types].xml", data: enc.encode(generateContentTypesXml(sheets.length)) });
  files.push({ name: "_rels/.rels", data: enc.encode(generateRootRelsXml()) });
  files.push({ name: "xl/workbook.xml", data: enc.encode(generateWorkbookXml(sheets)) });
  files.push({ name: "xl/_rels/workbook.xml.rels", data: enc.encode(generateWorkbookRelsXml(sheets.length)) });
  files.push({ name: "xl/sharedStrings.xml", data: enc.encode(sharedStrings.toXml()) });
  files.push({ name: "xl/styles.xml", data: enc.encode(generateStylesXml()) });
  sheets.forEach((_, i) => {
    files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(sheetXmls[i]) });
  });

  const blob = createZipBlob(files);

  const stats: ConversionStats = {
    sheetCount: sheets.length,
    totalRows: sheets.reduce((s, sh) => s + sh.rows.length, 0),
    totalCells: sheets.reduce((s, sh) => s + sh.rows.reduce((rs, r) => rs + r.length, 0), 0),
    sharedStringsCount: sharedStrings.size,
    xlsxBytes: blob.size,
  };

  return { blob, fileName: outputFileName, stats };
}

// ===== Encoding detection =====

export function detectEncoding(bytes: Uint8Array): { encoding: string; hasBom: boolean } {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { encoding: "UTF-8", hasBom: true };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { encoding: "UTF-16LE", hasBom: true };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { encoding: "UTF-16BE", hasBom: true };
  }
  return { encoding: "UTF-8", hasBom: false };
}

export function stripBom(input: string): string {
  return input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
}

// ===== Preview =====

export function previewRows(headers: string[], rows: string[][], limit: number = 10): Record<string, string>[] {
  return rows.slice(0, limit).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = row[i] ?? ""; });
    return obj;
  });
}

// ===== Stats / utilities =====

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ===== History (localStorage) =====
const HISTORY_KEY = "unqtools-csv-to-excel-history";
const MAX_HISTORY = 10;

export interface ConversionHistoryEntry {
  outputFileName: string;
  sheetCount: number;
  totalRows: number;
  totalCells: number;
  xlsxBytes: number;
  convertedAt: string;
}

export function loadHistory(): ConversionHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch { return []; }
}

export function saveToHistory(entry: ConversionHistoryEntry): ConversionHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const updated = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
}

/** Build a shareable URL with conversion options. */
export function buildShareUrl(options: ConversionOptions, delimiter: Delimiter): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("forceText", String(options.forceText));
  params.set("styleHeader", String(options.styleHeader));
  params.set("autoFit", String(options.autoFitColumns));
  params.set("header", String(options.hasHeader));
  params.set("delim", delimiter === "\t" ? "\\t" : delimiter);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

/** Parse conversion settings from URL hash. */
export function parseShareUrl(hash: string): { options: ConversionOptions; delimiter: Delimiter } | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("forceText") && !params.has("delim")) return null;
  const delimRaw = params.get("delim") ?? "auto";
  const delimiter: Delimiter = delimRaw === "\\t" ? "\t" : delimRaw as Delimiter;
  return {
    options: {
      forceText: params.get("forceText") === "true",
      styleHeader: params.get("styleHeader") !== "false",
      autoFitColumns: params.get("autoFit") !== "false",
      hasHeader: params.get("header") !== "false",
    },
    delimiter,
  };
}
