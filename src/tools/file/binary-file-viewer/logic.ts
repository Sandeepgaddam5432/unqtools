/**
 * Binary File Viewer — pure logic for binary parsing, data type decoding,
 * structure templates, magic bytes detection, and entropy stats.
 *
 * Pure functions only — no React, no I/O.
 */

export type Endian = "big" | "little";
export type BytesPerLine = 8 | 16 | 32;
export type DataType =
  | "int8" | "uint8"
  | "int16" | "uint16"
  | "int32" | "uint32"
  | "int64" | "uint64"
  | "float32" | "float64"
  | "ascii" | "utf8" | "hex";

export interface ViewOptions {
  bytesPerLine: BytesPerLine;
  endian: Endian;
  upperCase: boolean;
  showAscii: boolean;
}

export const DEFAULT_OPTIONS: ViewOptions = {
  bytesPerLine: 16,
  endian: "big",
  upperCase: false,
  showAscii: true,
};

// ===== Byte ↔ hex utilities =====

/** Convert bytes to lowercase hex string. */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Format a single byte as 2-char hex. */
export function formatByte(b: number, upperCase: boolean = false): string {
  const hex = b.toString(16).padStart(2, "0");
  return upperCase ? hex.toUpperCase() : hex;
}

/** Format an offset as 8-char hex. */
export function formatOffset(offset: number): string {
  return offset.toString(16).padStart(8, "0");
}

/** Render a byte as ASCII char, or '.' if non-printable. */
export function byteToAscii(b: number): string {
  return (b >= 32 && b < 127) ? String.fromCharCode(b) : ".";
}

// ===== Hex dump rows =====

export interface HexRow {
  offset: number;
  offsetHex: string;
  bytes: number[];
  hex: string[];
  ascii: string[];
}

export function hexRows(bytes: Uint8Array, options: ViewOptions, maxLines: number = 256): HexRow[] {
  const rows: HexRow[] = [];
  const bpl = options.bytesPerLine;
  const total = Math.min(bytes.length, maxLines * bpl);
  for (let i = 0; i < total; i += bpl) {
    const slice = bytes.slice(i, Math.min(i + bpl, total));
    const arr = Array.from(slice);
    rows.push({
      offset: i,
      offsetHex: formatOffset(i),
      bytes: arr,
      hex: arr.map((b) => formatByte(b, options.upperCase)),
      ascii: arr.map(byteToAscii),
    });
  }
  return rows;
}

// ===== Data type decoding =====

/** Read unsigned 8-bit. */
export function readUint8(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 1 > bytes.length) return null;
  return bytes[offset];
}

/** Read signed 8-bit. */
export function readInt8(bytes: Uint8Array, offset: number): number | null {
  const v = readUint8(bytes, offset);
  if (v === null) return null;
  return v >= 128 ? v - 256 : v;
}

/** Read unsigned 16-bit with endianness. */
export function readUint16(bytes: Uint8Array, offset: number, endian: Endian): number | null {
  if (offset < 0 || offset + 2 > bytes.length) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return dv.getUint16(offset, endian === "little");
}

/** Read signed 16-bit with endianness. */
export function readInt16(bytes: Uint8Array, offset: number, endian: Endian): number | null {
  if (offset < 0 || offset + 2 > bytes.length) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return dv.getInt16(offset, endian === "little");
}

/** Read unsigned 32-bit with endianness. */
export function readUint32(bytes: Uint8Array, offset: number, endian: Endian): number | null {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return dv.getUint32(offset, endian === "little");
}

/** Read signed 32-bit with endianness. */
export function readInt32(bytes: Uint8Array, offset: number, endian: Endian): number | null {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return dv.getInt32(offset, endian === "little");
}

/** Read signed 64-bit as BigInt (JS Number can't safely hold full int64). */
export function readInt64(bytes: Uint8Array, offset: number, endian: Endian): bigint | null {
  if (offset < 0 || offset + 8 > bytes.length) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return dv.getBigInt64(offset, endian === "little");
}

/** Read unsigned 64-bit as BigInt. */
export function readUint64(bytes: Uint8Array, offset: number, endian: Endian): bigint | null {
  if (offset < 0 || offset + 8 > bytes.length) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return dv.getBigUint64(offset, endian === "little");
}

/** Read 32-bit float with endianness. */
export function readFloat32(bytes: Uint8Array, offset: number, endian: Endian): number | null {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return dv.getFloat32(offset, endian === "little");
}

/** Read 64-bit float (double) with endianness. */
export function readFloat64(bytes: Uint8Array, offset: number, endian: Endian): number | null {
  if (offset < 0 || offset + 8 > bytes.length) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return dv.getFloat64(offset, endian === "little");
}

/** Read N bytes as ASCII string (errors become dots). */
export function readAscii(bytes: Uint8Array, offset: number, length: number): string | null {
  if (offset < 0 || offset + length > bytes.length) return null;
  let out = "";
  for (let i = 0; i < length; i++) {
    out += byteToAscii(bytes[offset + i]);
  }
  return out;
}

/** Read N bytes as UTF-8 string. */
export function readUtf8(bytes: Uint8Array, offset: number, length: number): string | null {
  if (offset < 0 || offset + length > bytes.length) return null;
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(offset, offset + length));
  } catch {
    return null;
  }
}

/** Decode the byte at the cursor using a data type. */
export function decodeAtCursor(bytes: Uint8Array, offset: number, type: DataType, endian: Endian): string {
  switch (type) {
    case "int8": { const v = readInt8(bytes, offset); return v === null ? "" : String(v); }
    case "uint8": { const v = readUint8(bytes, offset); return v === null ? "" : String(v); }
    case "int16": { const v = readInt16(bytes, offset, endian); return v === null ? "" : String(v); }
    case "uint16": { const v = readUint16(bytes, offset, endian); return v === null ? "" : String(v); }
    case "int32": { const v = readInt32(bytes, offset, endian); return v === null ? "" : String(v); }
    case "uint32": { const v = readUint32(bytes, offset, endian); return v === null ? "" : String(v); }
    case "int64": { const v = readInt64(bytes, offset, endian); return v === null ? "" : v.toString(); }
    case "uint64": { const v = readUint64(bytes, offset, endian); return v === null ? "" : v.toString(); }
    case "float32": { const v = readFloat32(bytes, offset, endian); return v === null ? "" : String(v); }
    case "float64": { const v = readFloat64(bytes, offset, endian); return v === null ? "" : String(v); }
    case "ascii": { const v = readAscii(bytes, offset, Math.min(16, bytes.length - offset)); return v ?? ""; }
    case "utf8": { const v = readUtf8(bytes, offset, Math.min(16, bytes.length - offset)); return v ?? ""; }
    case "hex": { const v = bytesToHex(bytes.slice(offset, Math.min(8, bytes.length - offset))); return v; }
    default: return "";
  }
}

/** Decode all data types at a cursor — for the data type inspector panel. */
export interface CursorDecoding {
  type: DataType;
  value: string;
  byteCount: number;
}

export function decodeAllAtCursor(bytes: Uint8Array, offset: number, endian: Endian): CursorDecoding[] {
  const types: DataType[] = [
    "int8", "uint8", "int16", "uint16",
    "int32", "uint32", "int64", "uint64",
    "float32", "float64", "ascii", "utf8", "hex",
  ];
  const sizes: Record<DataType, number> = {
    int8: 1, uint8: 1, int16: 2, uint16: 2,
    int32: 4, uint32: 4, int64: 8, uint64: 8,
    float32: 4, float64: 8, ascii: 16, utf8: 16, hex: 8,
  };
  return types.map((type) => ({
    type,
    value: decodeAtCursor(bytes, offset, type, endian),
    byteCount: sizes[type],
  }));
}

// ===== Search =====

/** Search for a hex string within bytes. Returns byte offsets of matches. */
export function searchHex(bytes: Uint8Array, query: string): number[] {
  const cleaned = query.replace(/\s+/g, "").toLowerCase();
  if (cleaned.length === 0 || cleaned.length % 2 !== 0) return [];
  const needle: number[] = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    const byte = parseInt(cleaned.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) return [];
    needle.push(byte);
  }
  const matches: number[] = [];
  for (let i = 0; i <= bytes.length - needle.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) { match = false; break; }
    }
    if (match) matches.push(i);
  }
  return matches;
}

/** Search for an ASCII string within bytes. */
export function searchAscii(bytes: Uint8Array, query: string): number[] {
  if (!query) return [];
  const needle = new TextEncoder().encode(query);
  const matches: number[] = [];
  for (let i = 0; i <= bytes.length - needle.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) { match = false; break; }
    }
    if (match) matches.push(i);
  }
  return matches;
}

/** Parse an offset string (decimal or hex with 0x prefix). */
export function parseOffset(input: string, maxOffset: number): number | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  let n: number;
  if (trimmed.startsWith("0x")) {
    n = parseInt(trimmed.slice(2), 16);
  } else {
    n = parseInt(trimmed, 10);
  }
  if (Number.isNaN(n) || n < 0 || n >= maxOffset) return null;
  return n;
}

// ===== Magic bytes detection =====

export interface FileSignature {
  bytes: string;
  mime: string;
  ext: string;
  description: string;
}

export const MAGIC_BYTES: FileSignature[] = [
  { bytes: "89504e47", mime: "image/png", ext: "png", description: "PNG image" },
  { bytes: "ffd8ffe0", mime: "image/jpeg", ext: "jpg", description: "JPEG image (JFIF)" },
  { bytes: "ffd8ffe1", mime: "image/jpeg", ext: "jpg", description: "JPEG image (EXIF)" },
  { bytes: "474946383761", mime: "image/gif", ext: "gif", description: "GIF image (87a)" },
  { bytes: "474946383961", mime: "image/gif", ext: "gif", description: "GIF image (89a)" },
  { bytes: "424d", mime: "image/bmp", ext: "bmp", description: "BMP image" },
  { bytes: "25504446", mime: "application/pdf", ext: "pdf", description: "PDF document" },
  { bytes: "504b0304", mime: "application/zip", ext: "zip", description: "ZIP archive" },
  { bytes: "1f8b", mime: "application/gzip", ext: "gz", description: "GZIP archive" },
  { bytes: "526172211a07", mime: "application/vnd.rar", ext: "rar", description: "RAR archive" },
  { bytes: "494433", mime: "audio/mpeg", ext: "mp3", description: "MP3 audio (ID3)" },
  { bytes: "52494646", mime: "audio/wav", ext: "wav", description: "WAV audio (RIFF)" },
  { bytes: "4f676753", mime: "audio/ogg", ext: "ogg", description: "OGG media" },
  { bytes: "1a45dfa3", mime: "video/webm", ext: "webm", description: "WebM/Matroska" },
  { bytes: "4d5a", mime: "application/x-msdownload", ext: "exe", description: "Windows executable" },
  { bytes: "7f454c46", mime: "application/x-executable", ext: "elf", description: "Linux ELF executable" },
  { bytes: "cafebabe", mime: "application/x-java-applet", ext: "class", description: "Java class file" },
  { bytes: "53514c697465", mime: "application/x-sqlite3", ext: "sqlite", description: "SQLite database" },
  { bytes: "3c3f786d6c", mime: "application/xml", ext: "xml", description: "XML document" },
  { bytes: "7b5c727466", mime: "application/rtf", ext: "rtf", description: "RTF document" },
];

/** Detect file type from magic bytes (first 8 bytes). */
export function detectSignature(bytes: Uint8Array): FileSignature | null {
  if (bytes.length < 4) return null;
  const hex = bytesToHex(bytes.slice(0, Math.min(8, bytes.length)));
  const sorted = [...MAGIC_BYTES].sort((a, b) => b.bytes.length - a.bytes.length);
  for (const m of sorted) {
    if (hex.startsWith(m.bytes)) return m;
  }
  return null;
}

// ===== Structure templates =====

export interface StructureField {
  name: string;
  offset: number;
  size: number; // bytes
  type: DataType | "bytes";
  description?: string;
}

export interface StructureTemplate {
  id: string;
  name: string;
  matches: (bytes: Uint8Array) => boolean;
  fields: StructureField[];
  description: string;
}

export const STRUCTURE_TEMPLATES: StructureTemplate[] = [
  {
    id: "png",
    name: "PNG Image",
    description: "PNG file signature + IHDR chunk header",
    matches: (b) => bytesToHex(b.slice(0, 4)) === "89504e47",
    fields: [
      { name: "Signature", offset: 0, size: 8, type: "bytes", description: "PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)" },
      { name: "IHDR Length", offset: 8, size: 4, type: "uint32", description: "Length of IHDR chunk data (always 13)" },
      { name: "IHDR Type", offset: 12, size: 4, type: "ascii", description: "Chunk type 'IHDR'" },
      { name: "Width", offset: 16, size: 4, type: "uint32", description: "Image width (pixels)" },
      { name: "Height", offset: 20, size: 4, type: "uint32", description: "Image height (pixels)" },
      { name: "Bit depth", offset: 24, size: 1, type: "uint8", description: "Bits per channel" },
      { name: "Color type", offset: 25, size: 1, type: "uint8", description: "0=gray, 2=RGB, 3=palette, 4=gray+alpha, 6=RGBA" },
      { name: "Compression", offset: 26, size: 1, type: "uint8", description: "Always 0 (deflate)" },
      { name: "Filter", offset: 27, size: 1, type: "uint8", description: "Always 0 (adaptive)" },
      { name: "Interlace", offset: 28, size: 1, type: "uint8", description: "0=none, 1=Adam7" },
    ],
  },
  {
    id: "jpeg",
    name: "JPEG Image",
    description: "JPEG SOI marker + first APP0/APP1 segment",
    matches: (b) => bytesToHex(b.slice(0, 2)) === "ffd8",
    fields: [
      { name: "SOI marker", offset: 0, size: 2, type: "bytes", description: "Start of image (FF D8)" },
      { name: "APPn marker", offset: 2, size: 2, type: "bytes", description: "FF E0 = JFIF, FF E1 = EXIF" },
      { name: "Segment length", offset: 4, size: 2, type: "uint16", description: "Length of segment" },
      { name: "JFIF/EXIF id", offset: 6, size: 5, type: "ascii", description: "'JFIF\\0' or 'Exif\\0'" },
    ],
  },
  {
    id: "zip",
    name: "ZIP Archive",
    description: "ZIP local file header",
    matches: (b) => bytesToHex(b.slice(0, 4)) === "504b0304",
    fields: [
      { name: "Signature", offset: 0, size: 4, type: "bytes", description: "PK\\03\\04 (50 4B 03 04)" },
      { name: "Version needed", offset: 4, size: 2, type: "uint16", description: "Minimum ZIP spec version" },
      { name: "Flags", offset: 6, size: 2, type: "uint16", description: "General purpose bit flag" },
      { name: "Compression", offset: 8, size: 2, type: "uint16", description: "0=stored, 8=deflate" },
      { name: "Mod time", offset: 10, size: 2, type: "uint16", description: "MS-DOS time" },
      { name: "Mod date", offset: 12, size: 2, type: "uint16", description: "MS-DOS date" },
      { name: "CRC-32", offset: 14, size: 4, type: "uint32", description: "CRC-32 of uncompressed data" },
      { name: "Compressed size", offset: 18, size: 4, type: "uint32", description: "Compressed size (bytes)" },
      { name: "Uncompressed size", offset: 22, size: 4, type: "uint32", description: "Uncompressed size (bytes)" },
      { name: "Filename length", offset: 26, size: 2, type: "uint16", description: "Length of filename" },
      { name: "Extra length", offset: 28, size: 2, type: "uint16", description: "Length of extra field" },
    ],
  },
  {
    id: "pdf",
    name: "PDF Document",
    description: "PDF header + version",
    matches: (b) => bytesToHex(b.slice(0, 4)) === "25504446",
    fields: [
      { name: "Header", offset: 0, size: 4, type: "ascii", description: "'%PDF'" },
      { name: "Version", offset: 5, size: 3, type: "ascii", description: "PDF version (e.g. '1.7')" },
      { name: "Binary marker", offset: 8, size: 4, type: "bytes", description: "Comment with high bytes" },
    ],
  },
  {
    id: "gif",
    name: "GIF Image",
    description: "GIF header",
    matches: (b) => bytesToHex(b.slice(0, 4)) === "47494638",
    fields: [
      { name: "Signature", offset: 0, size: 3, type: "ascii", description: "'GIF'" },
      { name: "Version", offset: 3, size: 3, type: "ascii", description: "'87a' or '89a'" },
      { name: "Width", offset: 6, size: 2, type: "uint16", description: "Image width (pixels, little-endian)" },
      { name: "Height", offset: 8, size: 2, type: "uint16", description: "Image height (pixels, little-endian)" },
      { name: "Packed field", offset: 10, size: 1, type: "uint8", description: "Color table info" },
      { name: "Background", offset: 11, size: 1, type: "uint8", description: "Background color index" },
      { name: "Pixel ratio", offset: 12, size: 1, type: "uint8", description: "Pixel aspect ratio" },
    ],
  },
  {
    id: "bmp",
    name: "BMP Image",
    description: "BMP file header + DIB header size",
    matches: (b) => bytesToHex(b.slice(0, 2)) === "424d",
    fields: [
      { name: "Signature", offset: 0, size: 2, type: "ascii", description: "'BM'" },
      { name: "File size", offset: 2, size: 4, type: "uint32", description: "File size (bytes, little-endian)" },
      { name: "Reserved", offset: 6, size: 4, type: "uint32", description: "Application-specific" },
      { name: "Pixel offset", offset: 10, size: 4, type: "uint32", description: "Offset to pixel data" },
      { name: "DIB header size", offset: 14, size: 4, type: "uint32", description: "Usually 40 (BITMAPINFOHEADER)" },
      { name: "Width", offset: 18, size: 4, type: "int32", description: "Image width (pixels)" },
      { name: "Height", offset: 22, size: 4, type: "int32", description: "Image height (pixels)" },
    ],
  },
];

/** Decode a structure field's value. */
export function decodeField(bytes: Uint8Array, field: StructureField, endian: Endian): string {
  const slice = bytes.slice(field.offset, field.offset + field.size);
  if (field.type === "bytes") return bytesToHex(slice);
  if (field.type === "ascii") return readAscii(bytes, field.offset, field.size) ?? "";
  if (field.type === "utf8") return readUtf8(bytes, field.offset, field.size) ?? "";
  if (field.type === "hex") return bytesToHex(slice);
  return decodeAtCursor(bytes, field.offset, field.type, endian);
}

/** Auto-detect a template from bytes; returns the first match. */
export function autoDetectTemplate(bytes: Uint8Array): StructureTemplate | null {
  for (const tpl of STRUCTURE_TEMPLATES) {
    if (tpl.matches(bytes)) return tpl;
  }
  return null;
}

export interface ParsedStructure {
  template: StructureTemplate;
  fields: Array<StructureField & { value: string; rawHex: string }>;
}

/** Parse a structure template against a byte array. */
export function parseStructure(bytes: Uint8Array, template: StructureTemplate, endian: Endian = "little"): ParsedStructure {
  const fields = template.fields.map((f) => {
    const value = decodeField(bytes, f, endian);
    const rawHex = bytesToHex(bytes.slice(f.offset, Math.min(f.offset + f.size, bytes.length)));
    return { ...f, value, rawHex };
  });
  return { template, fields };
}

// ===== Entropy =====

/** Calculate Shannon entropy of a byte sequence (0-8 bits/byte). */
export function shannonEntropy(bytes: Uint8Array): number {
  if (bytes.length === 0) return 0;
  const freq = new Array(256).fill(0);
  for (const b of bytes) freq[b]++;
  let entropy = 0;
  for (const f of freq) {
    if (f === 0) continue;
    const p = f / bytes.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

export function entropyHint(entropy: number): string {
  if (entropy < 1) return "Very low — structured/repetitive (e.g. plain text, zeros).";
  if (entropy < 3) return "Low — text or simple structured data.";
  if (entropy < 5) return "Moderate — code, structured binary, or natural language.";
  if (entropy < 7) return "High — compressed, encrypted, or random binary.";
  return "Very high — encrypted, compressed, or truly random.";
}

// ===== File stats =====

export interface FileStats {
  size: number;
  sizeHuman: string;
  mime: string | null;
  ext: string | null;
  signature: FileSignature | null;
  magicBytesHex: string;
  entropy: number;
  entropyHint: string;
  uniqueBytes: number;
  template: StructureTemplate | null;
}

/** Format bytes as human-readable. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function computeStats(bytes: Uint8Array): FileStats {
  const sig = detectSignature(bytes);
  const sigBytes = bytes.slice(0, 16);
  const uniqueSet = new Set<number>();
  for (const b of bytes) uniqueSet.add(b);
  const entropy = shannonEntropy(bytes);
  const template = autoDetectTemplate(bytes);
  return {
    size: bytes.length,
    sizeHuman: formatBytes(bytes.length),
    mime: sig?.mime ?? null,
    ext: sig?.ext ?? null,
    signature: sig,
    magicBytesHex: bytesToHex(sigBytes),
    entropy,
    entropyHint: entropyHint(entropy),
    uniqueBytes: uniqueSet.size,
    template,
  };
}

// ===== Selection export =====

export type CopyFormat = "hex" | "ascii" | "c-array";

/** Format a selection in a given format. */
export function formatSelection(bytes: Uint8Array, format: CopyFormat): string {
  if (format === "hex") {
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(" ");
  }
  if (format === "ascii") {
    return Array.from(bytes).map(byteToAscii).join("");
  }
  // C-array
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += 12) {
    const chunk = Array.from(bytes.slice(i, i + 12));
    const isLast = i + 12 >= bytes.length;
    lines.push("  " + chunk.map((b) => "0x" + b.toString(16).padStart(2, "0")).join(", ") + (isLast ? "" : ","));
  }
  return `unsigned char data[${bytes.length}] = {\n${lines.join("\n")}\n};`;
}

// ===== History (localStorage) =====
const HISTORY_KEY = "unqtools-binary-file-viewer-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  filename: string;
  size: number;
  ext: string | null;
  entropy: number;
  templateId: string | null;
  inspectedAt: string;
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
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
}

// ===== File reading =====

export async function readFileBytes(file: File, maxSize: number = 100 * 1024 * 1024): Promise<Uint8Array> {
  if (file.size > maxSize) {
    throw new Error(`File too large (${formatBytes(file.size)}). Maximum supported is ${formatBytes(maxSize)}.`);
  }
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}

// ===== Shareable URL =====

/** Build a shareable URL with view options (not file data). */
export function buildShareUrl(options: ViewOptions, templateId: string | null): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("bpl", String(options.bytesPerLine));
  params.set("endian", options.endian);
  params.set("upper", String(options.upperCase));
  params.set("ascii", String(options.showAscii));
  if (templateId) params.set("tpl", templateId);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

/** Parse a shareable URL hash back into options. */
export function parseShareUrl(hash: string): { options: Partial<ViewOptions>; templateId: string | null } | null {
  if (!hash) return null;
  const cleaned = hash.replace(/^#/, "");
  const params = new URLSearchParams(cleaned);
  if (params.toString() === "") return null;
  const options: Partial<ViewOptions> = {};
  if (params.has("bpl")) {
    const n = parseInt(params.get("bpl")!, 10);
    if (n === 8 || n === 16 || n === 32) options.bytesPerLine = n as BytesPerLine;
  }
  if (params.has("endian")) options.endian = params.get("endian") as Endian;
  if (params.has("upper")) options.upperCase = params.get("upper") === "true";
  if (params.has("ascii")) options.showAscii = params.get("ascii") === "true";
  const templateId = params.has("tpl") ? params.get("tpl") : null;
  return { options, templateId };
}
