/**
 * MOBI Reader — pure-JS binary MOBI parser.
 *
 * MOBI format (Palm Database + MOBI header):
 *   - PalmDB header (78 bytes):
 *     - name (32 bytes)
 *     - attributes (2 bytes)
 *     - version (2 bytes)
 *     - created / modified / backup / modnum timestamps (4 bytes each)
 *     - appInfoOffset / sortInfoOffset (4 bytes each)
 *     - type (4 bytes) — should be 'BOOK' (0x424f4f4b)
 *     - creator (4 bytes) — should be 'MOBI' (0x4d4f4249) or 'TEXt'
 *     - uniqueIDSeed (4 bytes)
 *     - nextRecordListId (4 bytes)
 *     - recordCount (2 bytes)
 *     - record info table (recordCount × 8 bytes: offset, attributes, uniqueID)
 *     - padding (2 bytes)
 *   - Records: each record is at the offset specified in the table.
 *   - Record 0: MOBI header (starts with PalmDOC header, then MOBI header, then EXTH)
 *     - PalmDOC header (16 bytes):
 *       - compression (2 bytes): 0=none, 1=PalmDOC, 2=HuffCDic
 *       - unused (2 bytes)
 *       - textLength (4 bytes): total uncompressed text length
 *       - recordCount (2 bytes): number of text records
 *       - recordSize (2 bytes): max size per text record (usually 4096)
 *       - encryptionType (2 bytes): 0=none, 1=old Mobipocket, 2=DRM
 *     - MOBI header (variable, starts at offset 16):
 *       - identifier (4 bytes): 'MOBI' (0x4d4f4249)
 *       - headerLength (4 bytes)
 *       - mobiType (4 bytes)
 *       - textEncoding (4 bytes): 1252=CP1252, 65001=UTF-8
 *       - uniqueId (4 bytes)
 *       - fileVersion (4 bytes)
 *       - ...many more fields...
 *       - firstImageRecord (4 bytes)
 *       - firstHuffTableRecord (4 bytes)
 *     - EXTH header (optional, follows MOBI header):
 *       - identifier (4 bytes): 'EXTH' (0x45585448)
 *       - headerLength (4 bytes)
 *       - recordCount (4 bytes)
 *       - records: each is type (4 bytes) + length (4 bytes) + data
 *   - Records 1..N: text records (HTML, possibly compressed)
 *   - Records N+1..: images, fonts, etc.
 *
 * We support:
 *   - PalmDB header parsing
 *   - MOBI header parsing (identifier, encoding, compression)
 *   - EXTH metadata extraction (title=100, author=100, language, etc.)
 *   - PalmDOC compression method 0 (none) and 1 (RLE)
 *   - Text concatenation + chapter detection via <h1>, <h2>, <mbp:pagebreak/>
 */

// ===== Types =====

export interface PalmDbHeader {
  name: string;
  attributes: number;
  version: number;
  type: string;       // 4-char string, e.g. 'BOOK'
  creator: string;    // 4-char string, e.g. 'MOBI'
  recordCount: number;
  uniqueIdSeed: number;
}

export interface MobiRecord {
  offset: number;
  attributes: number;
  uniqueId: number;
  /** Raw bytes of this record. */
  data: Uint8Array;
}

export interface PalmDocHeader {
  compression: number;       // 0=none, 1=PalmDOC, 2=HuffCDic
  textLength: number;        // total uncompressed text length
  textRecordCount: number;   // number of text records
  recordSize: number;        // max size per text record (usually 4096)
  encryptionType: number;    // 0=none, 1=old Mobipocket, 2=DRM
}

export interface MobiHeader {
  identifier: string;        // 'MOBI' if present
  headerLength: number;
  mobiType: number;
  textEncoding: number;      // 1252=CP1252, 65001=UTF-8
  uniqueId: number;
  fileVersion: number;
  firstImageRecord: number;
  firstHuffTableRecord: number;
  isMobi: boolean;
}

export interface ExthRecord {
  type: number;
  data: Uint8Array;
}

export interface ExthHeader {
  isPresent: boolean;
  records: ExthRecord[];
  /** Parsed metadata (decoded strings for known types). */
  metadata: MobiExthMetadata;
}

export interface MobiExthMetadata {
  author: string;
  publisher: string;
  imprint: string;
  description: string;
  isbn: string;
  subject: string;
  publishingDate: string;
  review: string;
  contributor: string;
  rights: string;
  language: string;
}

export interface MobiMetadata {
  /** Book title (from PalmDB name field; EXTH 100 may override). */
  title: string;
  /** Author (from EXTH 100). */
  author: string;
  /** Language code (from EXTH 3 or MOBI header). */
  language: string;
  /** Text encoding (1252 or 65001). */
  encoding: string;
  /** Compression method name. */
  compression: string;
  /** File version. */
  fileVersion: string;
  /** ISBN (from EXTH 104). */
  isbn: string;
  /** Publisher (from EXTH 101). */
  publisher: string;
  /** Publishing date (from EXTH 106). */
  publishingDate: string;
}

export interface MobiChapter {
  index: number;
  title: string;
  html: string;
  text: string;
}

export interface MobiBook {
  metadata: MobiMetadata;
  chapters: MobiChapter[];
  fileName: string;
  fileSize: number;
  totalChars: number;
  /** True if the book is DRM-protected. */
  isEncrypted: boolean;
  /** True if the compression is unsupported (HuffCDic). */
  unsupportedCompression: boolean;
}

// ===== Byte readers =====

function readU8(bytes: Uint8Array, offset: number): number {
  return bytes[offset] ?? 0;
}

function readU16BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function readU32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

function readString(bytes: Uint8Array, offset: number, length: number): string {
  return Array.from(bytes.subarray(offset, offset + length))
    .map((b) => String.fromCharCode(b))
    .join("");
}

function readCString(bytes: Uint8Array, offset: number, maxLength: number): string {
  const end = Math.min(offset + maxLength, bytes.length);
  let actualEnd = end;
  for (let i = offset; i < end; i++) {
    if (bytes[i] === 0) { actualEnd = i; break; }
  }
  // Decode as Latin-1 (PalmDB uses ASCII for name field)
  return Array.from(bytes.subarray(offset, actualEnd))
    .map((b) => String.fromCharCode(b))
    .join("")
    .trim();
}

// ===== PalmDB header =====

export function parsePalmDbHeader(bytes: Uint8Array): PalmDbHeader {
  if (bytes.length < 78) {
    throw new Error("File is too small to be a valid PalmDB (needs at least 78 bytes).");
  }
  const name = readCString(bytes, 0, 32);
  const attributes = readU16BE(bytes, 32);
  const version = readU16BE(bytes, 34);
  const type = readString(bytes, 60, 4);
  const creator = readString(bytes, 64, 4);
  const uniqueIdSeed = readU32BE(bytes, 68);
  const recordCount = readU16BE(bytes, 76);
  return { name, attributes, version, type, creator, recordCount, uniqueIdSeed };
}

// ===== Record info table =====

export function parseRecordInfoTable(bytes: Uint8Array, recordCount: number, baseOffset: number): Array<{ offset: number; attributes: number; uniqueId: number }> {
  const records: Array<{ offset: number; attributes: number; uniqueId: number }> = [];
  for (let i = 0; i < recordCount; i++) {
    const offset = baseOffset + i * 8;
    if (offset + 8 > bytes.length) break;
    const recordOffset = readU32BE(bytes, offset);
    const attributes = readU8(bytes, offset + 4);
    const uniqueId = (readU8(bytes, offset + 5) << 16) | (readU8(bytes, offset + 6) << 8) | readU8(bytes, offset + 7);
    records.push({ offset: recordOffset, attributes, uniqueId });
  }
  return records;
}

/** Extract record data for all records, given the info table. */
export function extractRecords(bytes: Uint8Array, recordInfos: Array<{ offset: number; attributes: number; uniqueId: number }>): MobiRecord[] {
  const records: MobiRecord[] = [];
  for (let i = 0; i < recordInfos.length; i++) {
    const info = recordInfos[i]!;
    const nextOffset = i + 1 < recordInfos.length ? recordInfos[i + 1]!.offset : bytes.length;
    const dataLength = Math.max(0, nextOffset - info.offset);
    records.push({
      offset: info.offset,
      attributes: info.attributes,
      uniqueId: info.uniqueId,
      data: bytes.subarray(info.offset, info.offset + dataLength),
    });
  }
  return records;
}

// ===== PalmDOC header =====

export function parsePalmDocHeader(record0: Uint8Array): PalmDocHeader {
  if (record0.length < 16) {
    throw new Error("Record 0 is too small to be a valid PalmDOC header.");
  }
  return {
    compression: readU16BE(record0, 0),
    textLength: readU32BE(record0, 4),
    textRecordCount: readU16BE(record0, 8),
    recordSize: readU16BE(record0, 10),
    encryptionType: readU16BE(record0, 12),
  };
}

// ===== MOBI header =====

export function parseMobiHeader(record0: Uint8Array): MobiHeader {
  // MOBI header starts at offset 16 in record 0
  if (record0.length < 24) {
    return {
      identifier: "",
      headerLength: 0,
      mobiType: 0,
      textEncoding: 1252,
      uniqueId: 0,
      fileVersion: 0,
      firstImageRecord: 0,
      firstHuffTableRecord: 0,
      isMobi: false,
    };
  }
  const identifier = readString(record0, 16, 4);
  const isMobi = identifier === "MOBI";
  if (!isMobi) {
    return {
      identifier,
      headerLength: 0,
      mobiType: 0,
      textEncoding: 1252,
      uniqueId: 0,
      fileVersion: 0,
      firstImageRecord: 0,
      firstHuffTableRecord: 0,
      isMobi: false,
    };
  }
  const headerLength = readU32BE(record0, 20);
  const mobiType = readU32BE(record0, 24);
  const textEncoding = readU32BE(record0, 28);
  const uniqueId = readU32BE(record0, 32);
  const fileVersion = readU32BE(record0, 36);
  // firstImageRecord is at offset 108 (from start of MOBI header, so 108+16 = 124 from record0 start)
  const firstImageRecord = record0.length >= 128 ? readU32BE(record0, 124) : 0;
  // firstHuffTableRecord is at offset 112 (so 112+16 = 128 from record0 start)
  const firstHuffTableRecord = record0.length >= 132 ? readU32BE(record0, 128) : 0;
  return {
    identifier,
    headerLength,
    mobiType,
    textEncoding,
    uniqueId,
    fileVersion,
    firstImageRecord,
    firstHuffTableRecord,
    isMobi: true,
  };
}

// ===== EXTH header =====

const EXTH_TYPES: Record<number, keyof MobiExthMetadata> = {
  3: "language",
  100: "author",
  101: "publisher",
  102: "imprint",
  103: "description",
  104: "isbn",
  105: "subject",
  106: "publishingDate",
  107: "review",
  108: "contributor",
  109: "rights",
};

export function parseExthHeader(record0: Uint8Array, mobiHeaderLength: number): ExthHeader {
  // EXTH starts at offset 16 (PalmDOC) + 16 (MOBI identifier) + headerLength
  // Actually: PalmDOC is 16 bytes, MOBI header is 16 + headerLength bytes (headerLength excludes the 16-byte identifier+length field)
  // So EXTH (if present) starts at: 16 + 16 + headerLength
  const exthOffset = 16 + 16 + mobiHeaderLength;
  if (record0.length < exthOffset + 12) {
    return { isPresent: false, records: [], metadata: emptyExthMetadata() };
  }
  const identifier = readString(record0, exthOffset, 4);
  if (identifier !== "EXTH") {
    return { isPresent: false, records: [], metadata: emptyExthMetadata() };
  }
  const headerLength = readU32BE(record0, exthOffset + 4);
  const recordCount = readU32BE(record0, exthOffset + 8);
  const records: ExthRecord[] = [];
  let pos = exthOffset + 12;
  for (let i = 0; i < recordCount && pos + 8 <= record0.length; i++) {
    const type = readU32BE(record0, pos);
    const length = readU32BE(record0, pos + 4);
    if (length < 8) break;
    const dataLength = length - 8;
    if (pos + 8 + dataLength > record0.length) break;
    records.push({
      type,
      data: record0.subarray(pos + 8, pos + 8 + dataLength),
    });
    pos += length;
  }
  void headerLength;
  const metadata = emptyExthMetadata();
  for (const rec of records) {
    const key = EXTH_TYPES[rec.type];
    if (key) {
      metadata[key] = decodeExthString(rec.data);
    }
  }
  return { isPresent: true, records, metadata };
}

function emptyExthMetadata(): MobiExthMetadata {
  return {
    author: "",
    publisher: "",
    imprint: "",
    description: "",
    isbn: "",
    subject: "",
    publishingDate: "",
    review: "",
    contributor: "",
    rights: "",
    language: "",
  };
}

function decodeExthString(data: Uint8Array): string {
  // Most EXTH strings are UTF-8 (or sometimes CP1252). Try UTF-8 first.
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(data).trim();
  } catch {
    return new TextDecoder("windows-1252").decode(data).trim();
  }
}

// ===== PalmDOC decompression =====

/**
 * Decompress PalmDOC RLE (compression method 1).
 * Format: compressed stream is a series of bytes. Special bytes:
 *   - 0x00: literal space + next byte (no, actually 0x00 is just a NUL)
 *   - 0x01..0x08: copy next N bytes literally
 *   - 0x09..0x7F: literal byte (just output it)
 *   - 0x80..0xBF: copy from previous output (self-reference, length + distance packed)
 *   - 0xC0..0xFF: space + ASCII char (the byte XOR 0x80)
 */
export function decompressPalmDoc(compressed: Uint8Array, expectedLength?: number): Uint8Array {
  const out: number[] = [];
  let i = 0;
  const len = compressed.length;
  while (i < len) {
    const b = compressed[i]!;
    i++;
    if (b === 0) {
      out.push(0);
    } else if (b <= 8) {
      // Copy next b bytes literally
      for (let j = 0; j < b && i < len; j++) {
        out.push(compressed[i]!);
        i++;
      }
    } else if (b <= 0x7f) {
      // Literal byte
      out.push(b);
    } else if (b <= 0xbf) {
      // Copy from previous output: 2-byte sequence
      if (i < len) {
        const next = compressed[i]!;
        i++;
        // Combine b and next into a 16-bit value
        const combined = ((b << 8) | next) & 0x3fff;
        const distance = (combined >> 3) + 1;
        const count = (combined & 0x7) + 3;
        const startIdx = out.length - distance;
        if (startIdx < 0) {
          // Invalid — just skip
          continue;
        }
        for (let j = 0; j < count; j++) {
          out.push(out[startIdx + j] ?? 0);
        }
      }
    } else {
      // 0xC0..0xFF: space + ASCII char (b XOR 0x80)
      out.push(0x20); // space
      out.push(b & 0x7f);
    }
    if (expectedLength && out.length >= expectedLength) break;
  }
  return new Uint8Array(out);
}

/** Decompress a text record based on compression method. */
export function decompressTextRecord(record: Uint8Array, compression: number, expectedLength?: number): Uint8Array {
  if (compression === 0) {
    // No compression — return as-is
    return record;
  }
  if (compression === 1) {
    return decompressPalmDoc(record, expectedLength);
  }
  if (compression === 2) {
    throw new Error("HuffCDic compression (method 2) is not supported. Convert the MOBI to plain text with Calibre.");
  }
  throw new Error(`Unsupported compression method: ${compression}`);
}

// ===== Text assembly =====

/** Decode a Uint8Array as text using the specified encoding. */
export function decodeText(bytes: Uint8Array, encoding: number): string {
  if (encoding === 65001) {
    return new TextDecoder("utf-8").decode(bytes);
  }
  if (encoding === 1252) {
    return new TextDecoder("windows-1252").decode(bytes);
  }
  // Default to UTF-8
  return new TextDecoder("utf-8").decode(bytes);
}

/**
 * Extract text content from text records.
 * Concatenates all text records (decompressed), then decodes as text.
 */
export function extractText(records: MobiRecord[], palmDoc: PalmDocHeader, mobiHeader: MobiHeader): string {
  const textRecords = records.slice(1, 1 + palmDoc.textRecordCount);
  const chunks: Uint8Array[] = [];
  for (const rec of textRecords) {
    try {
      const decompressed = decompressTextRecord(rec.data, palmDoc.compression, palmDoc.recordSize);
      chunks.push(decompressed);
    } catch (e) {
      // Skip records that fail to decompress
      void e;
    }
  }
  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const combined = new Uint8Array(totalLen);
  let pos = 0;
  for (const c of chunks) {
    combined.set(c, pos);
    pos += c.length;
  }
  return decodeText(combined, mobiHeader.textEncoding);
}

// ===== Chapter detection =====

/**
 * Split the book's HTML text into chapters.
 * Looks for <h1>, <h2>, or <mbp:pagebreak/> tags as chapter boundaries.
 * If no chapter markers are found, the entire text is one chapter.
 */
export function splitChapters(html: string): MobiChapter[] {
  // Find all chapter boundary positions
  const boundaries: Array<{ pos: number; title: string }> = [];
  // Match <h1>...</h1> or <h2>...</h2>
  const headingRe = /<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi;
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(html)) !== null) {
    const title = m[1]!.replace(/<[^>]+>/g, "").trim() || `Chapter ${boundaries.length + 1}`;
    boundaries.push({ pos: m.index, title });
  }
  // Match <mbp:pagebreak/> as additional boundaries
  const pagebreakRe = /<mbp:pagebreak[^>]*\/?>/gi;
  while ((m = pagebreakRe.exec(html)) !== null) {
    boundaries.push({ pos: m.index, title: `Section ${boundaries.length + 1}` });
  }
  // Sort boundaries by position
  boundaries.sort((a, b) => a.pos - b.pos);

  if (boundaries.length === 0) {
    return [{
      index: 0,
      title: "Full text",
      html,
      text: stripHtml(html),
    }];
  }

  // If the first boundary doesn't start at 0, add a preface chapter
  const chapters: MobiChapter[] = [];
  if (boundaries[0]!.pos > 0) {
    const prefaceHtml = html.slice(0, boundaries[0]!.pos);
    if (prefaceHtml.trim().length > 50) {
      chapters.push({
        index: 0,
        title: "Preface",
        html: prefaceHtml,
        text: stripHtml(prefaceHtml),
      });
    }
  }
  // Split at each boundary
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i]!.pos;
    const end = i + 1 < boundaries.length ? boundaries[i + 1]!.pos : html.length;
    const chunkHtml = html.slice(start, end);
    chapters.push({
      index: chapters.length,
      title: boundaries[i]!.title,
      html: chunkHtml,
      text: stripHtml(chunkHtml),
    });
  }
  return chapters;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ===== Top-level MOBI parsing =====

export function parseMobi(bytes: Uint8Array, fileName: string, fileSize: number): MobiBook {
  const palmDb = parsePalmDbHeader(bytes);
  if (palmDb.type !== "BOOK" && palmDb.creator !== "MOBI" && palmDb.creator !== "TEXt") {
    throw new Error(`Not a valid MOBI file: type='${palmDb.type}', creator='${palmDb.creator}'. Expected type=BOOK, creator=MOBI.`);
  }
  // Record info table starts at offset 78
  const recordInfos = parseRecordInfoTable(bytes, palmDb.recordCount, 78);
  const records = extractRecords(bytes, recordInfos);
  if (records.length === 0) {
    throw new Error("MOBI file has no records.");
  }
  // Record 0: PalmDOC + MOBI headers
  const record0 = records[0]!.data;
  const palmDoc = parsePalmDocHeader(record0);
  const mobiHeader = parseMobiHeader(record0);
  let exth: ExthHeader = { isPresent: false, records: [], metadata: emptyExthMetadata() };
  if (mobiHeader.isMobi) {
    exth = parseExthHeader(record0, mobiHeader.headerLength);
  }
  // Check for encryption
  if (palmDoc.encryptionType !== 0) {
    return {
      metadata: {
        title: palmDb.name || "(encrypted)",
        author: "",
        language: "",
        encoding: mobiHeader.textEncoding === 65001 ? "UTF-8" : "CP1252",
        compression: compressionName(palmDoc.compression),
        fileVersion: String(mobiHeader.fileVersion),
        isbn: "",
        publisher: "",
        publishingDate: "",
      },
      chapters: [{
        index: 0,
        title: "DRM-protected",
        html: "<p>This MOBI file is DRM-protected and cannot be read.</p>",
        text: "DRM-protected",
      }],
      fileName,
      fileSize,
      totalChars: 0,
      isEncrypted: true,
      unsupportedCompression: false,
    };
  }
  // Check for unsupported compression
  if (palmDoc.compression === 2) {
    return {
      metadata: {
        title: palmDb.name,
        author: "",
        language: "",
        encoding: mobiHeader.textEncoding === 65001 ? "UTF-8" : "CP1252",
        compression: "HuffCDic (unsupported)",
        fileVersion: String(mobiHeader.fileVersion),
        isbn: "",
        publisher: "",
        publishingDate: "",
      },
      chapters: [{
        index: 0,
        title: "Unsupported compression",
        html: "<p>This MOBI uses HuffCDic compression (method 2), which is not supported. Convert to plain text or HTML with Calibre.</p>",
        text: "HuffCDic unsupported",
      }],
      fileName,
      fileSize,
      totalChars: 0,
      isEncrypted: false,
      unsupportedCompression: true,
    };
  }
  // Extract text
  const html = extractText(records, palmDoc, mobiHeader);
  const chapters = splitChapters(html);
  // Build metadata
  const metadata: MobiMetadata = {
    title: palmDb.name || "(untitled)",
    author: exth.metadata.author || "(unknown author)",
    language: exth.metadata.language || "",
    encoding: mobiHeader.textEncoding === 65001 ? "UTF-8" : "CP1252",
    compression: compressionName(palmDoc.compression),
    fileVersion: String(mobiHeader.fileVersion),
    isbn: exth.metadata.isbn,
    publisher: exth.metadata.publisher,
    publishingDate: exth.metadata.publishingDate,
  };
  const totalChars = chapters.reduce((s, c) => s + c.text.length, 0);
  return {
    metadata,
    chapters,
    fileName,
    fileSize,
    totalChars,
    isEncrypted: false,
    unsupportedCompression: false,
  };
}

function compressionName(method: number): string {
  switch (method) {
    case 0: return "None";
    case 1: return "PalmDOC RLE";
    case 2: return "HuffCDic (unsupported)";
    default: return `Method ${method}`;
  }
}

// ===== Validation =====

export function isMobiFile(bytes: Uint8Array): boolean {
  if (bytes.length < 78) return false;
  try {
    const header = parsePalmDbHeader(bytes);
    return header.creator === "MOBI" || header.creator === "TEXt" || header.type === "BOOK";
  } catch {
    return false;
  }
}

// ===== Search =====

export interface SearchResult {
  chapterIndex: number;
  chapterTitle: string;
  snippet: string;
  matchIndex: number;
}

export function searchBook(book: MobiBook, query: string): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const results: SearchResult[] = [];
  for (let i = 0; i < book.chapters.length; i++) {
    const chapter = book.chapters[i]!;
    const text = chapter.text;
    const lower = text.toLowerCase();
    let idx = lower.indexOf(q);
    while (idx >= 0 && results.length < 200) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(text.length, idx + q.length + 40);
      const snippet = (start > 0 ? "..." : "") + text.slice(start, end) + (end < text.length ? "..." : "");
      results.push({
        chapterIndex: i,
        chapterTitle: chapter.title,
        snippet,
        matchIndex: idx,
      });
      idx = lower.indexOf(q, idx + q.length);
    }
  }
  return results;
}

export function readingProgress(currentChapter: number, totalChapters: number): number {
  if (totalChapters === 0) return 0;
  return Math.round(((currentChapter + 1) / totalChapters) * 100);
}

// ===== Utilities =====

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ===== Bookmarks + history (localStorage) =====

const BOOKMARK_KEY = "unqtools-mobi-bookmarks";
const HISTORY_KEY = "unqtools-mobi-history";
const MAX_HISTORY = 10;

export interface MobiBookmark {
  fileName: string;
  title: string;
  author: string;
  chapterIndex: number;
  totalChapters: number;
  savedAt: string;
}

export interface MobiHistoryEntry {
  fileName: string;
  title: string;
  author: string;
  chapterCount: number;
  fileSize: number;
  openedAt: string;
}

export function loadBookmarks(): MobiBookmark[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(BOOKMARK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveBookmark(bookmark: MobiBookmark): MobiBookmark[] {
  if (typeof localStorage === "undefined") return [];
  const others = loadBookmarks().filter((b) => b.fileName !== bookmark.fileName);
  const updated = [bookmark, ...others].slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(updated));
  } catch {
    /* ignore */
  }
  return updated;
}

export function getBookmark(fileName: string): MobiBookmark | null {
  return loadBookmarks().find((b) => b.fileName === fileName) ?? null;
}

export function clearBookmarks(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(BOOKMARK_KEY);
  } catch {
    /* ignore */
  }
}

export function loadHistory(): MobiHistoryEntry[] {
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

export function saveToHistory(entry: MobiHistoryEntry): MobiHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const others = loadHistory().filter((e) => e.fileName !== entry.fileName);
  const updated = [entry, ...others].slice(0, MAX_HISTORY);
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

// ===== Shareable URL (reader settings) =====

export interface ShareOptions {
  fontSize: string;
  theme: string;
}

export function buildShareUrl(opts: ShareOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("size", opts.fontSize);
  params.set("theme", opts.theme);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareOptions | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("size") && !params.has("theme")) return null;
  return {
    fontSize: params.get("size") ?? "md",
    theme: params.get("theme") ?? "light",
  };
}
