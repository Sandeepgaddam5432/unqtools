/**
 * Excel to CSV Converter — pure-JS XLSX parser. No SheetJS, no WASM.
 *
 * Pipeline:
 *   1. Parse the XLSX ZIP container (local file headers).
 *   2. Decompress each entry (STORE or DEFLATE via DecompressionStream).
 *   3. Parse [Content_Types].xml, workbook.xml, workbook.xml.rels to find sheets.
 *   4. Parse sharedStrings.xml for the shared text table.
 *   5. Parse styles.xml for number formats (date detection).
 *   6. Parse each sheetN.xml: read cells, types, and values.
 *   7. Convert to CSV (RFC 4180: quoted fields, escaped quotes, embedded newlines).
 */

// ===== ZIP parsing (STORE + DEFLATE) =====

export interface ZipEntry {
  name: string;
  compressionMethod: number; // 0 = STORE, 8 = DEFLATE
  compressedSize: number;
  uncompressedSize: number;
  dataOffset: number;
  bytes: Uint8Array;
}

export function parseZipEntries(bytes: Uint8Array): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let pos = 0;
  while (pos < bytes.length - 4) {
    if (bytes[pos] !== 0x50 || bytes[pos + 1] !== 0x4b || bytes[pos + 2] !== 0x03 || bytes[pos + 3] !== 0x04) {
      pos++;
      continue;
    }
    if (pos + 30 > bytes.length) break;
    const dv = new DataView(bytes.buffer, bytes.byteOffset + pos, Math.min(bytes.length - pos, 30 + 65535));
    const compressionMethod = dv.getUint16(8, true);
    const compressedSize = dv.getUint32(18, true);
    const uncompressedSize = dv.getUint32(22, true);
    const nameLen = dv.getUint16(26, true);
    const extraLen = dv.getUint16(28, true);
    if (pos + 30 + nameLen + extraLen > bytes.length) {
      pos++;
      continue;
    }
    const nameBytes = bytes.subarray(pos + 30, pos + 30 + nameLen);
    const name = new TextDecoder("utf-8").decode(nameBytes);
    const dataOffset = pos + 30 + nameLen + extraLen;
    const dataEnd = dataOffset + compressedSize;
    if (dataEnd > bytes.length) {
      pos++;
      continue;
    }
    const data = bytes.subarray(dataOffset, dataEnd);
    entries.push({
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      dataOffset,
      bytes: data,
    });
    pos = dataEnd;
  }
  return entries;
}

/** Decompress a ZIP entry (STORE or DEFLATE). Returns raw bytes. */
export async function decompressEntry(entry: ZipEntry): Promise<Uint8Array> {
  if (entry.compressionMethod === 0) {
    // STORE — return bytes as-is
    const out = new Uint8Array(entry.bytes.length);
    out.set(entry.bytes);
    return out;
  }
  if (entry.compressionMethod === 8) {
    // DEFLATE — use browser's native DecompressionStream
    const stream = new DecompressionStream("deflate-raw");
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    const writerClosed = writer.closed.catch(() => { /* swallow async errors */ });
    const readerClosed = reader.closed.catch(() => { /* swallow async errors */ });
    const chunks: Uint8Array[] = [];
    let totalLen = 0;
    let readErr: Error | null = null;
    try {
      writer.write(entry.bytes);
      writer.close();
       
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          totalLen += value.length;
        }
      }
    } catch (err) {
      readErr = err as Error;
    }
    try { reader.releaseLock(); } catch { /* ignore */ }
    try { writer.releaseLock(); } catch { /* ignore */ }
    await Promise.allSettled([writerClosed, readerClosed]);
    if (readErr) {
      throw new Error(`Failed to decompress ${entry.name}: ${readErr.message}`);
    }
    const out = new Uint8Array(totalLen);
    let pos = 0;
    for (const c of chunks) {
      out.set(c, pos);
      pos += c.length;
    }
    return out;
  }
  throw new Error(`Unsupported compression method ${entry.compressionMethod} for ${entry.name}`);
}

// ===== Minimal XML parser =====

export interface XmlNode {
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text: string;
}

const ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&[a-z]+;/g, (m) => ENTITY_MAP[m] ?? m);
}

/**
 * Parse an XML string into a tree. This is a minimal parser supporting:
 *   - Elements with attributes (single and double quotes)
 *   - Self-closing tags
 *   - Text content (with entity decoding)
 *   - CDATA sections
 *   - XML declaration and comments are skipped
 *   - Namespaces are preserved in tag names (e.g. "a:sst")
 */
export function parseXml(xml: string): XmlNode {
  const root: XmlNode = { name: "#root", attributes: {}, children: [], text: "" };
  const stack: XmlNode[] = [root];
  let i = 0;
  const len = xml.length;
  while (i < len) {
    // Skip whitespace between tags
    while (i < len && /\s/.test(xml[i]!)) i++;
    if (i >= len) break;
    if (xml[i] !== "<") {
      // Text content
      let textEnd = xml.indexOf("<", i);
      if (textEnd === -1) textEnd = len;
      const text = decodeEntities(xml.slice(i, textEnd));
      if (text.length > 0) {
        const top = stack[stack.length - 1]!;
        top.text += text;
      }
      i = textEnd;
      continue;
    }
    // We're at '<'
    if (xml.startsWith("<?", i)) {
      // XML declaration — skip
      const end = xml.indexOf("?>", i);
      i = end === -1 ? len : end + 2;
      continue;
    }
    if (xml.startsWith("<!--", i)) {
      // Comment — skip
      const end = xml.indexOf("-->", i);
      i = end === -1 ? len : end + 3;
      continue;
    }
    if (xml.startsWith("<![CDATA[", i)) {
      const end = xml.indexOf("]]>", i);
      const cdata = end === -1 ? xml.slice(i + 9) : xml.slice(i + 9, end);
      const top = stack[stack.length - 1]!;
      top.text += cdata;
      i = end === -1 ? len : end + 3;
      continue;
    }
    if (xml[i + 1] === "/") {
      // Closing tag
      const end = xml.indexOf(">", i);
      i = end === -1 ? len : end + 1;
      stack.pop();
      continue;
    }
    // Opening tag
    const end = xml.indexOf(">", i);
    if (end === -1) break;
    let tagContent = xml.slice(i + 1, end);
    const selfClosing = tagContent.endsWith("/");
    if (selfClosing) tagContent = tagContent.slice(0, -1);
    // Parse name and attributes
    const nameMatch = tagContent.match(/^([^\s/]+)/);
    const name = nameMatch ? nameMatch[1]! : "";
    const attributes: Record<string, string> = {};
    let attrStr = tagContent.slice(name.length).trim();
    const attrRegex = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let m: RegExpExecArray | null;
    while ((m = attrRegex.exec(attrStr)) !== null) {
      attributes[m[1]!] = decodeEntities(m[2] ?? m[3] ?? "");
    }
    const node: XmlNode = { name, attributes, children: [], text: "" };
    const top = stack[stack.length - 1]!;
    top.children.push(node);
    if (!selfClosing) {
      stack.push(node);
    }
    i = end + 1;
  }
  return root;
}

/** Find first child element with the given tag name (ignoring namespace prefix). */
export function findChild(node: XmlNode, localName: string): XmlNode | undefined {
  for (const c of node.children) {
    const local = c.name.includes(":") ? c.name.split(":")[1]! : c.name;
    if (local === localName) return c;
  }
  return undefined;
}

/** Find all child elements with the given tag name (ignoring namespace prefix). */
export function findChildren(node: XmlNode, localName: string): XmlNode[] {
  return node.children.filter((c) => {
    const local = c.name.includes(":") ? c.name.split(":")[1]! : c.name;
    return local === localName;
  });
}

// ===== XLSX-specific parsing =====

export interface SheetInfo {
  /** Sheet name from workbook.xml. */
  name: string;
  /** r:id from workbook.xml (e.g. "rId1"). */
  rId: string;
  /** Sheet ID (sheetId attribute). */
  sheetId: string;
  /** Target path inside the ZIP (e.g. "xl/worksheets/sheet1.xml"). */
  targetPath: string;
  /** Index of the sheet in the workbook (0-based). */
  index: number;
}

export interface ParsedWorkbook {
  sheets: SheetInfo[];
}

/** Parse xl/workbook.xml to get the list of sheets. */
export function parseWorkbook(xml: string): ParsedWorkbook {
  const root = parseXml(xml);
  const workbookEl = findChild(root, "workbook") ?? root;
  const sheetsEl = findChild(workbookEl, "sheets");
  const sheets: SheetInfo[] = [];
  if (sheetsEl) {
    const sheetEls = findChildren(sheetsEl, "sheet");
    sheetEls.forEach((s, i) => {
      sheets.push({
        name: s.attributes.name ?? `Sheet${i + 1}`,
        rId: s.attributes["r:id"] ?? "",
        sheetId: s.attributes.sheetId ?? "",
        targetPath: "", // Filled in by parseWorkbookRels
        index: i,
      });
    });
  }
  return { sheets };
}

/** Parse xl/_rels/workbook.xml.rels to map rId → target path. */
export function parseWorkbookRels(xml: string): Record<string, string> {
  const root = parseXml(xml);
  const relsEl = findChild(root, "Relationships") ?? root;
  const rels: Record<string, string> = {};
  for (const r of findChildren(relsEl, "Relationship")) {
    if (r.attributes.Id) {
      rels[r.attributes.Id] = r.attributes.Target ?? "";
    }
  }
  return rels;
}

/** Resolve a sheet's target path. Returns the absolute path inside the ZIP. */
export function resolveSheetPath(sheet: SheetInfo, rels: Record<string, string>): string {
  const target = rels[sheet.rId] ?? "";
  if (!target) return "";
  // Target is relative to "xl/" (where workbook.xml lives).
  if (target.startsWith("/")) return target.slice(1);
  return `xl/${target}`;
}

export interface SharedStrings {
  strings: string[];
}

/** Parse xl/sharedStrings.xml. */
export function parseSharedStrings(xml: string): SharedStrings {
  const root = parseXml(xml);
  const sst = findChild(root, "sst") ?? root;
  const strings: string[] = [];
  for (const si of findChildren(sst, "si")) {
    // Each <si> may contain one or more <t> elements (rich text runs).
    let text = "";
    const collectText = (node: XmlNode) => {
      const local = node.name.includes(":") ? node.name.split(":")[1]! : node.name;
      if (local === "t") {
        text += node.text;
      }
      for (const c of node.children) collectText(c);
    };
    collectText(si);
    strings.push(text);
  }
  return { strings };
}

export interface CellStyle {
  numFmtId: number;
}

/** Parse xl/styles.xml. Returns the cellXfs array (numFmtId per style index). */
export function parseStyles(xml: string): CellStyle[] {
  const root = parseXml(xml);
  const styleSheet = findChild(root, "styleSheet") ?? root;
  const cellXfs = findChild(styleSheet, "cellXfs");
  if (!cellXfs) return [];
  const styles: CellStyle[] = [];
  for (const xf of findChildren(cellXfs, "xf")) {
    const numFmtId = parseInt(xf.attributes.numFmtId ?? "0", 10);
    styles.push({ numFmtId });
  }
  return styles;
}

const BUILTIN_DATE_FORMATS = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22,  // date/datetime formats
  30, 31, 45, 46, 47,                   // additional date/time formats
]);

/** Detect if a numFmtId corresponds to a date format (built-in or custom). */
export function isDateFormat(numFmtId: number, customFormats: Record<number, string>): boolean {
  if (BUILTIN_DATE_FORMATS.has(numFmtId)) return true;
  const fmt = customFormats[numFmtId];
  if (fmt) {
    // Check for date/time format codes (case-insensitive)
    const lower = fmt.toLowerCase();
    // Skip if format contains quoted text that might falsely match
    // (Excel escapes literal chars with quotes; we strip them)
    const unquoted = lower.replace(/"[^"]*"/g, "").replace(/\\./g, "");
    return /[ymdhs]/.test(unquoted);
  }
  return false;
}

/** Parse <numFmts> custom formats from styles.xml. Returns numFmtId → format string. */
export function parseCustomFormats(xml: string): Record<number, string> {
  const root = parseXml(xml);
  const styleSheet = findChild(root, "styleSheet") ?? root;
  const numFmtsEl = findChild(styleSheet, "numFmts");
  if (!numFmtsEl) return {};
  const out: Record<number, string> = {};
  for (const nf of findChildren(numFmtsEl, "numFmt")) {
    const id = parseInt(nf.attributes.numFmtId ?? "0", 10);
    const code = nf.attributes.formatCode ?? "";
    out[id] = code;
  }
  return out;
}

/** Convert an Excel date serial number to an ISO date string. */
export function excelSerialToDate(serial: number): string {
  // Excel uses 1900-01-01 as day 1, with the famous 1900-leap-year bug.
  // The conventional formula: serial = days since 1899-12-30.
  const epoch = Date.UTC(1899, 11, 30);
  const ms = epoch + serial * 86400000;
  const date = new Date(ms);
  if (isNaN(date.getTime())) return "";
  // If the serial has a fractional part, include time
  if (serial % 1 !== 0) {
    return date.toISOString().replace(/\.000Z$/, "Z");
  }
  return date.toISOString().slice(0, 10);
}

// ===== Cell parsing =====

export type CellType = "string" | "number" | "boolean" | "date" | "error" | "empty";

export interface Cell {
  ref: string;        // e.g. "A1"
  type: CellType;
  value: string;      // The displayable string value
}

/** Convert a column letter (A, B, ..., AA, AB, ...) to a 0-based index. */
export function columnToIndex(col: string): number {
  let n = 0;
  for (let i = 0; i < col.length; i++) {
    n = n * 26 + (col.charCodeAt(i) - 64);
  }
  return n - 1;
}

/** Convert a 0-based column index to a letter (A, B, ..., AA, ...). */
export function indexToColumn(index: number): string {
  let s = "";
  let n = index;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/** Parse a cell reference (e.g. "A1") into { col, row }. */
export function parseCellRef(ref: string): { col: string; row: number; colIndex: number } {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  if (!m) return { col: "A", row: 1, colIndex: 0 };
  const col = m[1]!;
  const row = parseInt(m[2]!, 10);
  return { col, row, colIndex: columnToIndex(col) };
}

export interface SheetData {
  name: string;
  rows: Cell[][];
  rowCount: number;
  columnCount: number;
}

/**
 * Parse a worksheet XML. Reads <c> elements inside <sheetData>, resolves
 * shared strings, applies date formatting, and returns a 2D array of cells.
 */
export function parseSheet(
  xml: string,
  sheetName: string,
  sharedStrings: SharedStrings,
  styles: CellStyle[],
  customFormats: Record<number, string>,
): SheetData {
  const root = parseXml(xml);
  const worksheet = findChild(root, "worksheet") ?? root;
  const sheetDataEl = findChild(worksheet, "sheetData");
  const rows: Cell[][] = [];
  let maxColIndex = -1;

  // Collect all <t> text from an <is> (inline string) or <si> (rich text) element.
  const collectInlineText = (node: XmlNode): string => {
    let text = "";
    const visit = (n: XmlNode) => {
      const local = n.name.includes(":") ? n.name.split(":")[1]! : n.name;
      if (local === "t") {
        text += n.text;
      }
      for (const c of n.children) visit(c);
    };
    visit(node);
    return text;
  };

  if (sheetDataEl) {
    for (const rowEl of findChildren(sheetDataEl, "row")) {
      const row: Cell[] = [];
      for (const c of findChildren(rowEl, "c")) {
        const ref = c.attributes.r ?? "";
        const cellType = c.attributes.t ?? "n"; // default: number
        const styleStr = c.attributes.s ?? "0";
        const styleIdx = parseInt(styleStr, 10);
        const vEl = findChild(c, "v");
        const isEl = findChild(c, "is"); // inline string
        const rawValue = vEl?.text ?? "";
        const inlineText = isEl ? collectInlineText(isEl) : "";
        const colInfo = parseCellRef(ref);
        if (colInfo.colIndex > maxColIndex) maxColIndex = colInfo.colIndex;

        // Pad row with empty cells up to the current column
        while (row.length < colInfo.colIndex) {
          row.push({ ref: `${indexToColumn(row.length)}1`, type: "empty", value: "" });
        }

        let type: CellType = "empty";
        let value = "";

        if (rawValue === "" && !isEl) {
          type = "empty";
          value = "";
        } else if (cellType === "s") {
          // Shared string
          const idx = parseInt(rawValue, 10);
          type = "string";
          value = sharedStrings.strings[idx] ?? "";
        } else if (cellType === "inlineStr" || cellType === "str") {
          type = "string";
          value = inlineText || rawValue;
        } else if (cellType === "b") {
          type = "boolean";
          value = rawValue === "1" ? "TRUE" : "FALSE";
        } else if (cellType === "e") {
          type = "error";
          value = rawValue;
        } else {
          // Number — check if it's a date via style
          const style = styles[styleIdx];
          if (style && isDateFormat(style.numFmtId, customFormats)) {
            const serial = parseFloat(rawValue);
            if (!isNaN(serial)) {
              type = "date";
              value = excelSerialToDate(serial);
            } else {
              type = "number";
              value = rawValue;
            }
          } else {
            type = "number";
            value = rawValue;
          }
        }
        row.push({ ref, type, value });
      }
      rows.push(row);
    }
  }

  return {
    name: sheetName,
    rows,
    rowCount: rows.length,
    columnCount: maxColIndex + 1,
  };
}

// ===== CSV generation (RFC 4180) =====

export type CsvDelimiter = "," | "\t" | ";" | "|";

/** Quote a CSV field per RFC 4180. Quotes are added only when needed. */
export function quoteCsv(value: string, delimiter: string): string {
  if (value === "") return "";
  const needsQuote = value.includes(delimiter) || value.includes('"') || value.includes("\n") || value.includes("\r");
  if (!needsQuote) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

/** Convert a SheetData to a CSV string. */
export function sheetToCsv(sheet: SheetData, delimiter: CsvDelimiter = ","): string {
  const lines: string[] = [];
  for (const row of sheet.rows) {
    // Pad row to max column count
    const padded = [...row];
    while (padded.length < sheet.columnCount) {
      padded.push({ ref: "", type: "empty", value: "" });
    }
    const line = padded.map((c) => quoteCsv(c.value, delimiter)).join(delimiter);
    lines.push(line);
  }
  return lines.join("\n");
}

// ===== Encoding detection =====

export function detectEncoding(bytes: Uint8Array): { encoding: string; hasBom: boolean } {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { encoding: "UTF-8", hasBom: true };
  }
  return { encoding: "UTF-8", hasBom: false };
}

// ===== Stats / preview =====

export interface ConversionStats {
  sheetCount: number;
  totalRows: number;
  totalCells: number;
  csvBytes: number;
}

export interface PreviewRow {
  [key: string]: string;
}

/** Generate preview rows (first N rows as objects keyed by column letter). */
export function previewRows(sheet: SheetData, limit: number = 10): PreviewRow[] {
  return sheet.rows.slice(0, limit).map((row) => {
    const obj: PreviewRow = {};
    row.forEach((c, i) => {
      const key = indexToColumn(i);
      obj[key] = c.value;
    });
    return obj;
  });
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ===== History (localStorage) =====

const HISTORY_KEY = "unqtools-excel-to-csv-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  sheetCount: number;
  totalRows: number;
  totalCells: number;
  csvBytes: number;
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

export interface ShareOptions {
  delimiter: CsvDelimiter;
  convertAllSheets: boolean;
}

export function buildShareUrl(opts: ShareOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("delim", opts.delimiter === "\t" ? "\\t" : opts.delimiter);
  params.set("all", String(opts.convertAllSheets));
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareOptions | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("delim") && !params.has("all")) return null;
  const delimRaw = params.get("delim") ?? ",";
  const delimiter: CsvDelimiter = delimRaw === "\\t" ? "\t" : (delimRaw as CsvDelimiter);
  return {
    delimiter,
    convertAllSheets: params.get("all") === "true",
  };
}

// ===== ZIP writer (for "download all sheets as ZIP") =====

function crc32Zip(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function createZipBlob(files: Array<{ name: string; data: Uint8Array }>): Blob {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const enc = new TextEncoder();

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const c = crc32Zip(file.data);
    const size = file.data.length;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true); // STORE
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, c, true);
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
    cv.setUint32(16, c, true);
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
  for (const p of allParts) {
    out.set(p, pos);
    pos += p.length;
  }
  return new Blob([out as BlobPart], { type: "application/zip" });
}

// ===== Top-level conversion =====

export interface ConversionInput {
  fileName: string;
  bytes: Uint8Array;
}

export interface SheetResult {
  sheetName: string;
  csv: string;
  rowCount: number;
  columnCount: number;
  csvBytes: number;
}

export interface ConversionResult {
  fileName: string;
  sheets: SheetResult[];
  totalRows: number;
  totalCells: number;
  totalCsvBytes: number;
  blob: Blob | null;
  outputFileName: string;
}

/**
 * Convert one XLSX file to CSV. If `sheetIndex` is provided, only that sheet
 * is converted (single CSV blob). If `convertAllSheets` is true, every sheet
 * is converted and bundled into a ZIP. Otherwise, only the first sheet is
 * converted (single CSV blob).
 */
export async function convertXlsxToCsv(
  input: ConversionInput,
  delimiter: CsvDelimiter,
  sheetIndex: number | null,
  convertAllSheets: boolean,
  outputFileName?: string,
): Promise<ConversionResult> {
  const entries = parseZipEntries(input.bytes);
  if (entries.length === 0) {
    throw new Error(`${input.fileName}: not a valid XLSX file (no ZIP entries found).`);
  }

  // Build a map: path → decompressed bytes (lazy: only decompress what we need)
  const entryMap = new Map<string, ZipEntry>();
  for (const e of entries) entryMap.set(e.name, e);

  const getEntryText = async (path: string): Promise<string> => {
    const e = entryMap.get(path);
    if (!e) return "";
    const bytes = await decompressEntry(e);
    return new TextDecoder("utf-8").decode(bytes);
  };

  // Parse workbook.xml
  const workbookXml = await getEntryText("xl/workbook.xml");
  if (!workbookXml) {
    throw new Error(`${input.fileName}: missing xl/workbook.xml — not a valid XLSX file.`);
  }
  const workbook = parseWorkbook(workbookXml);
  if (workbook.sheets.length === 0) {
    throw new Error(`${input.fileName}: workbook has no sheets.`);
  }

  // Parse workbook.xml.rels to map rId → target path
  const relsXml = await getEntryText("xl/_rels/workbook.xml.rels");
  const rels = relsXml ? parseWorkbookRels(relsXml) : {};

  // Resolve each sheet's target path
  for (const s of workbook.sheets) {
    s.targetPath = resolveSheetPath(s, rels);
  }

  // Parse sharedStrings.xml (optional — may not exist if no string cells)
  const sharedStringsXml = await getEntryText("xl/sharedStrings.xml");
  const sharedStrings = sharedStringsXml ? parseSharedStrings(sharedStringsXml) : { strings: [] };

  // Parse styles.xml (optional — may not exist)
  const stylesXml = await getEntryText("xl/styles.xml");
  const styles = stylesXml ? parseStyles(stylesXml) : [];
  const customFormats = stylesXml ? parseCustomFormats(stylesXml) : {};

  // Determine which sheets to convert
  let sheetsToConvert: SheetInfo[];
  if (sheetIndex !== null) {
    const s = workbook.sheets[sheetIndex];
    if (!s) throw new Error(`${input.fileName}: sheet index ${sheetIndex} out of range.`);
    sheetsToConvert = [s];
  } else if (convertAllSheets) {
    sheetsToConvert = workbook.sheets;
  } else {
    sheetsToConvert = [workbook.sheets[0]!];
  }

  const sheetResults: SheetResult[] = [];
  for (const sheet of sheetsToConvert) {
    if (!sheet.targetPath) {
      throw new Error(`${input.fileName}: could not resolve target path for sheet "${sheet.name}".`);
    }
    const sheetXml = await getEntryText(sheet.targetPath);
    if (!sheetXml) {
      throw new Error(`${input.fileName}: missing ${sheet.targetPath}.`);
    }
    const data = parseSheet(sheetXml, sheet.name, sharedStrings, styles, customFormats);
    const csv = sheetToCsv(data, delimiter);
    const csvBytes = new TextEncoder().encode(csv).length;
    sheetResults.push({
      sheetName: sheet.name,
      csv,
      rowCount: data.rowCount,
      columnCount: data.columnCount,
      csvBytes,
    });
  }

  const totalRows = sheetResults.reduce((s, r) => s + r.rowCount, 0);
  const totalCells = sheetResults.reduce((s, r) => s + r.rowCount * r.columnCount, 0);
  const totalCsvBytes = sheetResults.reduce((s, r) => s + r.csvBytes, 0);

  let blob: Blob | null = null;
  let outName: string;
  const baseName = input.fileName.replace(/\.xlsx$/i, "");
  if (sheetResults.length === 1) {
    const r = sheetResults[0]!;
    blob = new Blob([r.csv], { type: "text/csv;charset=utf-8" });
    outName = outputFileName ?? `${baseName}_${r.sheetName}.csv`;
  } else {
    const enc = new TextEncoder();
    const files = sheetResults.map((r) => ({
      name: `${baseName}_${r.sheetName}.csv`,
      data: enc.encode(r.csv),
    }));
    blob = createZipBlob(files);
    outName = outputFileName ?? `${baseName}_sheets.zip`;
  }

  return {
    fileName: input.fileName,
    sheets: sheetResults,
    totalRows,
    totalCells,
    totalCsvBytes,
    blob,
    outputFileName: outName,
  };
}
