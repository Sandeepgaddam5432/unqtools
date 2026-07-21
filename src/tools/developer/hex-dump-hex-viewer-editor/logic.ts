/**
 * Hex Dump Viewer & Editor — pure logic.
 *
 * Pure-JS functions for displaying, editing, searching, and inspecting binary
 * data as a classic hex dump. 100% client-side. No DOM, no network — pure
 * functions only (FileReader / Blob lives in the UI layer).
 */

// ---------- Types ----------

export type Endian = "be" | "le";
export type DisplayFormat = "hex" | "dec" | "bin" | "oct";
export type InspectorType =
  | "int8" | "uint8"
  | "int16" | "uint16"
  | "int32" | "uint32"
  | "int64" | "uint64"
  | "float32" | "float64"
  | "uleb128" | "sleb128"
  | "ascii" | "utf8" | "utf16be" | "utf16le";

export interface HexDumpOptions {
  /** Bytes per line. Default 16. */
  bytesPerLine?: number;
  /** Byte grouping within a line (e.g. 1, 2, 4, 8). Default 1. */
  groupSize?: number;
  /** Uppercase hex digits. Default true. */
  upperCase?: boolean;
  /** Show ASCII gutter. Default true. */
  showAscii?: boolean;
  /** Offset base: hex (default) or decimal. */
  offsetBase?: "hex" | "dec";
  /** Maximum bytes to render (safety). Default 1_000_000. */
  maxBytes?: number;
  /** Starting offset (for virtualized views). Default 0. */
  startOffset?: number;
}

export interface HexDumpLine {
  offset: number;
  hex: string;
  ascii: string;
  bytes: number[]; // raw byte values for this line
}

export interface SearchMatch {
  offset: number;
  length: number;
}

export type SearchMode = "hex" | "text" | "regex";

export interface SearchResult {
  matches: SearchMatch[];
  error?: string;
}

export interface InspectorValue {
  type: InspectorType;
  endian: Endian;
  /** Decoded value as a string. */
  value: string;
  /** Number of bytes consumed. */
  bytesConsumed: number;
}

export interface HistoryEntry {
  ts: number;
  name: string;
  size: number;
  /** Hex preview (first 32 bytes) for quick recognition. */
  hexPreview: string;
}

// ---------- Constants ----------

export const SUPPORTED_BYTES_PER_LINE = [8, 16, 32] as const;
export const SUPPORTED_GROUP_SIZES = [1, 2, 4, 8] as const;
export const INSPECTOR_TYPES: InspectorType[] = [
  "int8", "uint8",
  "int16", "uint16",
  "int32", "uint32",
  "int64", "uint64",
  "float32", "float64",
  "uleb128", "sleb128",
  "ascii", "utf8", "utf16be", "utf16le",
];

// ---------- Conversion helpers ----------

/** Convert a hex string (with or without spaces) to a Uint8Array. */
export function hexStringToBytes(hex: string): Uint8Array {
  const cleaned = hex.replace(/\s+/g, "").replace(/0x/gi, "");
  if (cleaned.length === 0) return new Uint8Array(0);
  if (cleaned.length % 2 !== 0) throw new Error("hex string has odd number of digits");
  if (!/^[0-9a-fA-F]+$/.test(cleaned)) throw new Error("hex string contains non-hex characters");
  const out = new Uint8Array(cleaned.length / 2);
  for (let i = 0; i < cleaned.length; i += 2) {
    out[i / 2] = parseInt(cleaned.slice(i, i + 2), 16);
  }
  return out;
}

/** Convert a Uint8Array to a hex string. */
export function bytesToHexString(bytes: Uint8Array, upperCase = true, separator = ""): string {
  const arr: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const h = bytes[i].toString(16).padStart(2, "0");
    arr.push(upperCase ? h.toUpperCase() : h);
  }
  return arr.join(separator);
}

/** Convert a single byte to its 2-digit hex representation. */
export function byteToHex(b: number, upperCase = true): string {
  const h = (b & 0xff).toString(16).padStart(2, "0");
  return upperCase ? h.toUpperCase() : h;
}

/** Convert a single byte to its ASCII character or '.' if non-printable. */
export function byteToAscii(b: number): string {
  if (b >= 32 && b <= 126) return String.fromCharCode(b);
  return ".";
}

/** Encode an ASCII / UTF-8 string to bytes. */
export function stringToBytes(s: string): Uint8Array {
  // Use TextEncoder for UTF-8 (default)
  return new TextEncoder().encode(s);
}

/** Format a byte size in human-readable form (B / KB / MB / GB). */
export function formatByteSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Parse an offset string (hex like '0x1F' or '1F' or decimal like '31'). Returns -1 if invalid. */
export function parseOffset(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return -1;
  if (/^0x[0-9a-fA-F]+$/.test(trimmed)) return parseInt(trimmed.slice(2), 16);
  if (/^[0-9a-fA-F]+$/i.test(trimmed) && /[a-fA-F]/.test(trimmed)) return parseInt(trimmed, 16);
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  return -1;
}

// ---------- Hex dump rendering ----------

/** Render binary data as a list of hex dump lines. */
export function renderHexDump(bytes: Uint8Array, opts: HexDumpOptions = {}): HexDumpLine[] {
  const bytesPerLine = opts.bytesPerLine ?? 16;
  const groupSize = opts.groupSize ?? 1;
  const upperCase = opts.upperCase ?? true;
  const showAscii = opts.showAscii ?? true;
  const offsetBase = opts.offsetBase ?? "hex";
  const maxBytes = opts.maxBytes ?? 1_000_000;
  const startOffset = opts.startOffset ?? 0;
  // startOffset is a display label only — it does not slice into the bytes.
  // Callers that virtualize a window of a large file should slice BEFORE
  // calling renderHexDump and pass startOffset = byte position of the slice.
  const slice = bytes.subarray(0, maxBytes);
  const lines: HexDumpLine[] = [];
  for (let i = 0; i < slice.length; i += bytesPerLine) {
    const lineBytes: number[] = [];
    const hexGroups: string[] = [];
    let ascii = "";
    const lineEnd = Math.min(i + bytesPerLine, slice.length);
    for (let g = 0; g < bytesPerLine; g += groupSize) {
      const group: string[] = [];
      for (let j = 0; j < groupSize; j++) {
        const idx = i + g + j;
        if (idx < lineEnd) {
          const b = slice[idx];
          lineBytes.push(b);
          group.push(byteToHex(b, upperCase));
          ascii += showAscii ? byteToAscii(b) : "";
        } else {
          group.push("  ");
          if (showAscii) ascii += " ";
        }
      }
      hexGroups.push(group.join(""));
    }
    const offset = startOffset + i;
    const offsetStr = offsetBase === "hex"
      ? offset.toString(16).padStart(8, "0").toUpperCase()
      : offset.toString(10).padStart(10, "0");
    lines.push({
      offset,
      hex: hexGroups.join(" "),
      ascii,
      bytes: lineBytes,
    });
  }
  return lines;
}

/** Render a hex dump as plain text (for copying / downloading). */
export function renderHexDumpText(bytes: Uint8Array, opts: HexDumpOptions = {}): string {
  const lines = renderHexDump(bytes, opts);
  return lines.map((l) => {
    const offsetStr = (opts.offsetBase ?? "hex") === "hex"
      ? l.offset.toString(16).padStart(8, "0").toUpperCase()
      : l.offset.toString(10).padStart(10, "0");
    return `${offsetStr}  ${l.hex}  ${l.ascii}`;
  }).join("\n");
}

/** Parse a hex dump text back into bytes. Tolerant of common formats. */
export function parseHexDumpText(text: string): Uint8Array {
  const out: number[] = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    // Common formats: "00000000  FF D8 FF E0  ...." or "00000000: FF D8 FF E0 ...."
    const m = line.match(/^\s*(?:0x)?[0-9a-fA-F]+\s*[:\s]\s*(.+?)(?:\s{2,}.*)?$/);
    if (!m) continue;
    const hexPart = m[1];
    const hexes = hexPart.match(/[0-9a-fA-F]{2}/g);
    if (!hexes) continue;
    for (const h of hexes) out.push(parseInt(h, 16));
  }
  return new Uint8Array(out);
}

// ---------- Editing ----------

/** Overwrite a single byte in place. Returns a new Uint8Array. */
export function setByte(bytes: Uint8Array, offset: number, value: number): Uint8Array {
  if (offset < 0 || offset >= bytes.length) throw new Error(`offset ${offset} out of range`);
  const out = new Uint8Array(bytes.length);
  out.set(bytes);
  out[offset] = value & 0xff;
  return out;
}

/** Overwrite a contiguous range of bytes. Returns a new Uint8Array. */
export function setBytes(bytes: Uint8Array, offset: number, values: number[] | Uint8Array): Uint8Array {
  if (offset < 0 || offset + values.length > bytes.length) {
    throw new Error(`range ${offset}..${offset + values.length} out of bounds (length ${bytes.length})`);
  }
  const out = new Uint8Array(bytes.length);
  out.set(bytes);
  for (let i = 0; i < values.length; i++) out[offset + i] = values[i] & 0xff;
  return out;
}

/** Insert bytes at the given offset (shifting later bytes right). Returns a new Uint8Array. */
export function insertBytes(bytes: Uint8Array, offset: number, values: number[] | Uint8Array): Uint8Array {
  if (offset < 0 || offset > bytes.length) throw new Error(`offset ${offset} out of range`);
  const vals = Array.from(values);
  const out = new Uint8Array(bytes.length + vals.length);
  out.set(bytes.subarray(0, offset), 0);
  for (let i = 0; i < vals.length; i++) out[offset + i] = vals[i] & 0xff;
  out.set(bytes.subarray(offset), offset + vals.length);
  return out;
}

/** Delete a range of bytes. Returns a new Uint8Array. */
export function deleteBytes(bytes: Uint8Array, offset: number, length: number): Uint8Array {
  if (offset < 0 || offset + length > bytes.length) {
    throw new Error(`range ${offset}..${offset + length} out of bounds (length ${bytes.length})`);
  }
  if (length < 0) throw new Error("length must be non-negative");
  const out = new Uint8Array(bytes.length - length);
  out.set(bytes.subarray(0, offset), 0);
  out.set(bytes.subarray(offset + length), offset);
  return out;
}

/** Replace a range of bytes with new values (length may differ). Returns a new Uint8Array. */
export function replaceBytes(
  bytes: Uint8Array,
  offset: number,
  length: number,
  values: number[] | Uint8Array,
): Uint8Array {
  const before = bytes.subarray(0, offset);
  const after = bytes.subarray(offset + length);
  const vals = Array.from(values);
  const out = new Uint8Array(before.length + vals.length + after.length);
  out.set(before, 0);
  for (let i = 0; i < vals.length; i++) out[offset + i] = vals[i] & 0xff;
  out.set(after, offset + vals.length);
  return out;
}

// ---------- Search ----------

/** Search for hex bytes or text in the data. */
export function search(bytes: Uint8Array, query: string, mode: SearchMode): SearchResult {
  if (mode === "hex") {
    let needle: Uint8Array;
    try {
      needle = hexStringToBytes(query);
    } catch (e) {
      return { matches: [], error: e instanceof Error ? e.message : String(e) };
    }
    if (needle.length === 0) return { matches: [] };
    const matches: SearchMatch[] = [];
    for (let i = 0; i <= bytes.length - needle.length; i++) {
      let found = true;
      for (let j = 0; j < needle.length; j++) {
        if (bytes[i + j] !== needle[j]) { found = false; break; }
      }
      if (found) matches.push({ offset: i, length: needle.length });
    }
    return { matches };
  }
  if (mode === "text") {
    const needle = stringToBytes(query);
    if (needle.length === 0) return { matches: [] };
    const matches: SearchMatch[] = [];
    for (let i = 0; i <= bytes.length - needle.length; i++) {
      let found = true;
      for (let j = 0; j < needle.length; j++) {
        if (bytes[i + j] !== needle[j]) { found = false; break; }
      }
      if (found) matches.push({ offset: i, length: needle.length });
    }
    return { matches };
  }
  // regex (against ASCII representation)
  try {
    const re = new RegExp(query, "g");
    const matches: SearchMatch[] = [];
    const ascii = bytesToAsciiString(bytes);
    let m: RegExpExecArray | null;
    let safety = 0;
    while ((m = re.exec(ascii)) !== null) {
      if (m[0].length === 0) {
        // zero-length match — bump to avoid infinite loop
        re.lastIndex++;
        continue;
      }
      matches.push({ offset: m.index, length: m[0].length });
      if (++safety > 100000) break; // hard safety bound
    }
    return { matches };
  } catch (e) {
    return { matches: [], error: e instanceof Error ? e.message : String(e) };
  }
}

/** Convert bytes to an ASCII string with '.' for non-printable. */
export function bytesToAsciiString(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += byteToAscii(bytes[i]);
  return out;
}

/** Find the next match at or after a given offset. Returns -1 if none. */
export function findNextMatch(
  matches: SearchMatch[],
  fromOffset: number,
): number {
  for (let i = 0; i < matches.length; i++) {
    if (matches[i].offset >= fromOffset) return i;
  }
  return -1;
}

/** Find the previous match before a given offset. Returns -1 if none. */
export function findPrevMatch(
  matches: SearchMatch[],
  fromOffset: number,
): number {
  for (let i = matches.length - 1; i >= 0; i--) {
    if (matches[i].offset < fromOffset) return i;
  }
  return -1;
}

// ---------- Display formats ----------

/** Render a single byte in the chosen display format. */
export function formatByte(b: number, format: DisplayFormat): string {
  switch (format) {
    case "hex": return byteToHex(b, true);
    case "dec": return (b & 0xff).toString(10).padStart(3, "0");
    case "bin": return (b & 0xff).toString(2).padStart(8, "0");
    case "oct": return (b & 0xff).toString(8).padStart(3, "0");
  }
}

/** Render a contiguous slice of bytes in the chosen format. */
export function formatBytes(bytes: Uint8Array, format: DisplayFormat, separator = " "): string {
  const arr: string[] = [];
  for (let i = 0; i < bytes.length; i++) arr.push(formatByte(bytes[i], format));
  return arr.join(separator);
}

// ---------- Data inspector ----------

/** Decode bytes at `offset` as the given type and endianness. */
export function inspect(bytes: Uint8Array, offset: number, type: InspectorType): InspectorValue {
  if (offset < 0 || offset >= bytes.length) {
    return { type, endian: "be", value: "(out of range)", bytesConsumed: 0 };
  }
  switch (type) {
    case "int8": {
      const v = bytes[offset] | 0;
      const signed = v > 127 ? v - 256 : v;
      return { type, endian: "be", value: signed.toString(10), bytesConsumed: 1 };
    }
    case "uint8":
      return { type, endian: "be", value: (bytes[offset] & 0xff).toString(10), bytesConsumed: 1 };
    case "int16":
      return { type, endian: "be", value: readInt16(bytes, offset, "be").toString(10), bytesConsumed: 2 };
    case "uint16":
      return { type, endian: "be", value: readUint16(bytes, offset, "be").toString(10), bytesConsumed: 2 };
    case "int32":
      return { type, endian: "be", value: readInt32(bytes, offset, "be").toString(10), bytesConsumed: 4 };
    case "uint32":
      return { type, endian: "be", value: readUint32(bytes, offset, "be").toString(10), bytesConsumed: 4 };
    case "int64":
      return { type, endian: "be", value: readInt64(bytes, offset, "be").toString(10), bytesConsumed: 8 };
    case "uint64":
      return { type, endian: "be", value: readUint64(bytes, offset, "be").toString(10), bytesConsumed: 8 };
    case "float32":
      return { type, endian: "be", value: readFloat32(bytes, offset, "be").toString(), bytesConsumed: 4 };
    case "float64":
      return { type, endian: "be", value: readFloat64(bytes, offset, "be").toString(), bytesConsumed: 8 };
    case "uleb128": {
      const { value, bytesConsumed } = readUleb128(bytes, offset);
      return { type, endian: "be", value: value.toString(10), bytesConsumed };
    }
    case "sleb128": {
      const { value, bytesConsumed } = readSleb128(bytes, offset);
      return { type, endian: "be", value: value.toString(10), bytesConsumed };
    }
    case "ascii":
      return { type, endian: "be", value: readString(bytes, offset, "ascii", 32), bytesConsumed: Math.min(32, bytes.length - offset) };
    case "utf8":
      return { type, endian: "be", value: readString(bytes, offset, "utf8", 32), bytesConsumed: Math.min(32, bytes.length - offset) };
    case "utf16be":
      return { type, endian: "be", value: readString(bytes, offset, "utf16be", 32), bytesConsumed: Math.min(32, bytes.length - offset) };
    case "utf16le":
      return { type, endian: "le", value: readString(bytes, offset, "utf16le", 32), bytesConsumed: Math.min(32, bytes.length - offset) };
  }
}

/** Decode bytes at `offset` as the given type for both endiannesses. */
export function inspectBoth(bytes: Uint8Array, offset: number, type: InspectorType): InspectorValue[] {
  const be = inspect(bytes, offset, type);
  if (type === "int16" || type === "uint16" || type === "int32" || type === "uint32" || type === "int64" || type === "uint64" || type === "float32" || type === "float64") {
    const leValue = inspectLE(bytes, offset, type);
    return [be, leValue];
  }
  return [be];
}

function inspectLE(bytes: Uint8Array, offset: number, type: InspectorType): InspectorValue {
  switch (type) {
    case "int16": return { type, endian: "le", value: readInt16(bytes, offset, "le").toString(10), bytesConsumed: 2 };
    case "uint16": return { type, endian: "le", value: readUint16(bytes, offset, "le").toString(10), bytesConsumed: 2 };
    case "int32": return { type, endian: "le", value: readInt32(bytes, offset, "le").toString(10), bytesConsumed: 4 };
    case "uint32": return { type, endian: "le", value: readUint32(bytes, offset, "le").toString(10), bytesConsumed: 4 };
    case "int64": return { type, endian: "le", value: readInt64(bytes, offset, "le").toString(10), bytesConsumed: 8 };
    case "uint64": return { type, endian: "le", value: readUint64(bytes, offset, "le").toString(10), bytesConsumed: 8 };
    case "float32": return { type, endian: "le", value: readFloat32(bytes, offset, "le").toString(), bytesConsumed: 4 };
    case "float64": return { type, endian: "le", value: readFloat64(bytes, offset, "le").toString(), bytesConsumed: 8 };
    default: return { type, endian: "le", value: "(n/a)", bytesConsumed: 0 };
  }
}

function readUint16(bytes: Uint8Array, offset: number, endian: Endian): number {
  if (offset + 2 > bytes.length) return 0;
  return endian === "be" ? (bytes[offset] << 8) | bytes[offset + 1] : (bytes[offset + 1] << 8) | bytes[offset];
}

function readInt16(bytes: Uint8Array, offset: number, endian: Endian): number {
  const v = readUint16(bytes, offset, endian);
  return v > 0x7fff ? v - 0x10000 : v;
}

function readUint32(bytes: Uint8Array, offset: number, endian: Endian): number {
  if (offset + 4 > bytes.length) return 0;
  return endian === "be"
    ? ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
    : ((bytes[offset + 3] << 24) | (bytes[offset + 2] << 16) | (bytes[offset + 1] << 8) | bytes[offset]) >>> 0;
}

function readInt32(bytes: Uint8Array, offset: number, endian: Endian): number {
  const v = readUint32(bytes, offset, endian);
  return v > 0x7fffffff ? v - 0x100000000 : v;
}

function readUint64(bytes: Uint8Array, offset: number, endian: Endian): bigint {
  if (offset + 8 > bytes.length) return 0n;
  const dv = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
  if (endian === "be") {
    const hi = BigInt(dv.getUint32(0, false));
    const lo = BigInt(dv.getUint32(4, false));
    return (hi << 32n) | lo;
  } else {
    const hi = BigInt(dv.getUint32(4, true));
    const lo = BigInt(dv.getUint32(0, true));
    return (hi << 32n) | lo;
  }
}

function readInt64(bytes: Uint8Array, offset: number, endian: Endian): bigint {
  const u = readUint64(bytes, offset, endian);
  if (u > 0x7fffffffffffffffn) return u - 0x10000000000000000n;
  return u;
}

function readFloat32(bytes: Uint8Array, offset: number, endian: Endian): number {
  if (offset + 4 > bytes.length) return 0;
  const dv = new DataView(bytes.buffer, bytes.byteOffset + offset, 4);
  return dv.getFloat32(0, endian === "le");
}

function readFloat64(bytes: Uint8Array, offset: number, endian: Endian): number {
  if (offset + 8 > bytes.length) return 0;
  const dv = new DataView(bytes.buffer, bytes.byteOffset + offset, 8);
  return dv.getFloat64(0, endian === "le");
}

function readUleb128(bytes: Uint8Array, offset: number): { value: bigint; bytesConsumed: number } {
  let result = 0n;
  let shift = 0n;
  let i = offset;
  while (i < bytes.length) {
    const b = bytes[i];
    result |= BigInt(b & 0x7f) << shift;
    i += 1;
    if ((b & 0x80) === 0) return { value: result, bytesConsumed: i - offset };
    shift += 7n;
    if (i - offset > 10) break; // safety
  }
  return { value: result, bytesConsumed: i - offset };
}

function readSleb128(bytes: Uint8Array, offset: number): { value: bigint; bytesConsumed: number } {
  let result = 0n;
  let shift = 0n;
  let i = offset;
  let lastByte = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    result |= BigInt(b & 0x7f) << shift;
    shift += 7n;
    i += 1;
    lastByte = b;
    if ((b & 0x80) === 0) break;
    if (i - offset > 10) break;
  }
  // Sign extend if the last byte's high bit is set
  if ((lastByte & 0x40) !== 0) {
    result |= -(1n << shift);
  }
  return { value: result, bytesConsumed: i - offset };
}

function readString(bytes: Uint8Array, offset: number, encoding: "ascii" | "utf8" | "utf16be" | "utf16le", maxLen: number): string {
  const end = Math.min(offset + maxLen, bytes.length);
  const slice = bytes.subarray(offset, end);
  if (encoding === "ascii") {
    let out = "";
    for (let i = 0; i < slice.length; i++) out += byteToAscii(slice[i]);
    return out;
  }
  if (encoding === "utf8") {
    try { return new TextDecoder("utf-8", { fatal: false }).decode(slice); }
    catch { return "(decode error)"; }
  }
  if (encoding === "utf16be" || encoding === "utf16le") {
    try { return new TextDecoder(encoding === "utf16be" ? "utf-16be" : "utf-16le", { fatal: false }).decode(slice); }
    catch { return "(decode error)"; }
  }
  return "";
}

// ---------- Checksums ----------

export type ChecksumAlgorithm = "sum8" | "sum16" | "sum32" | "xor8" | "crc32" | "adler32";

export function checksum(bytes: Uint8Array, algo: ChecksumAlgorithm): string {
  switch (algo) {
    case "sum8": {
      let s = 0;
      for (const b of bytes) s = (s + b) & 0xff;
      return s.toString(16).padStart(2, "0").toUpperCase();
    }
    case "sum16": {
      let s = 0;
      for (const b of bytes) s = (s + b) & 0xffff;
      return s.toString(16).padStart(4, "0").toUpperCase();
    }
    case "sum32": {
      let s = 0;
      for (const b of bytes) s = (s + b) >>> 0;
      return s.toString(16).padStart(8, "0").toUpperCase();
    }
    case "xor8": {
      let x = 0;
      for (const b of bytes) x ^= b;
      return x.toString(16).padStart(2, "0").toUpperCase();
    }
    case "crc32":
      return crc32(bytes).toString(16).padStart(8, "0").toUpperCase();
    case "adler32":
      return adler32(bytes).toString(16).padStart(8, "0").toUpperCase();
  }
}

const CRC32_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC32_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  const MOD = 65521;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % MOD;
    b = (b + a) % MOD;
  }
  return ((b << 16) | a) >>> 0;
}

/** Compute all checksums for the given bytes. */
export function allChecksums(bytes: Uint8Array): Record<ChecksumAlgorithm, string> {
  return {
    sum8: checksum(bytes, "sum8"),
    sum16: checksum(bytes, "sum16"),
    sum32: checksum(bytes, "sum32"),
    xor8: checksum(bytes, "xor8"),
    crc32: checksum(bytes, "crc32"),
    adler32: checksum(bytes, "adler32"),
  };
}

// ---------- File helpers ----------

/** Read a File (or Blob) into a Uint8Array. Promise-based. */
export function readFileToBytes(file: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === "undefined") {
      reject(new Error("FileReader is not available in this environment"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error("unexpected FileReader result"));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.readAsArrayBuffer(file);
  });
}

/** Trigger a download of a Uint8Array as a binary file. (UI-layer helper.) */
export function makeDownloadBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes], { type: "application/octet-stream" });
}

// ---------- History (localStorage) ----------

const HISTORY_KEY = "unqtools:hex-dump-editor:history";
const HISTORY_MAX = 20;

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------- Shareable URL ----------

const SHARE_MAX_BYTES = 1024; // cap share-URL size at 1KB

export function buildShareUrl(bytes: Uint8Array): string {
  const params = new URLSearchParams();
  if (bytes.length > 0 && bytes.length <= SHARE_MAX_BYTES) {
    params.set("hex", bytesToHexString(bytes, true, ""));
  } else if (bytes.length > SHARE_MAX_BYTES) {
    params.set("truncated", "1");
    params.set("size", bytes.length.toString(10));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { bytes: Uint8Array; truncated: boolean; originalSize: number } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { bytes: new Uint8Array(0), truncated: false, originalSize: 0 };
  const params = new URLSearchParams(clean);
  const hex = params.get("hex");
  if (hex) {
    try {
      return { bytes: hexStringToBytes(hex), truncated: false, originalSize: hex.length / 2 };
    } catch {
      return { bytes: new Uint8Array(0), truncated: false, originalSize: 0 };
    }
  }
  const truncated = params.get("truncated") === "1";
  const size = parseInt(params.get("size") ?? "0", 10);
  return { bytes: new Uint8Array(0), truncated, originalSize: size };
}

// ---------- Magic-byte file type detection ----------

export interface MagicMatch {
  name: string;
  mime: string;
  ext: string;
}

const MAGIC_SIGNATURES: { bytes: number[]; offset: number; match: MagicMatch }[] = [
  { bytes: [0xff, 0xd8, 0xff], offset: 0, match: { name: "JPEG image", mime: "image/jpeg", ext: "jpg" } },
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], offset: 0, match: { name: "PNG image", mime: "image/png", ext: "png" } },
  { bytes: [0x47, 0x49, 0x46, 0x38], offset: 0, match: { name: "GIF image", mime: "image/gif", ext: "gif" } },
  { bytes: [0x25, 0x50, 0x44, 0x46], offset: 0, match: { name: "PDF document", mime: "application/pdf", ext: "pdf" } },
  { bytes: [0x50, 0x4b, 0x03, 0x04], offset: 0, match: { name: "ZIP archive", mime: "application/zip", ext: "zip" } },
  { bytes: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07], offset: 0, match: { name: "RAR archive", mime: "application/x-rar-compressed", ext: "rar" } },
  { bytes: [0x1f, 0x8b], offset: 0, match: { name: "GZIP archive", mime: "application/gzip", ext: "gz" } },
  { bytes: [0x42, 0x4d], offset: 0, match: { name: "BMP image", mime: "image/bmp", ext: "bmp" } },
  { bytes: [0x49, 0x49, 0x2a, 0x00], offset: 0, match: { name: "TIFF image (LE)", mime: "image/tiff", ext: "tif" } },
  { bytes: [0x4d, 0x4d, 0x00, 0x2a], offset: 0, match: { name: "TIFF image (BE)", mime: "image/tiff", ext: "tif" } },
  { bytes: [0x7f, 0x45, 0x4c, 0x46], offset: 0, match: { name: "ELF executable", mime: "application/x-elf", ext: "elf" } },
  { bytes: [0x4d, 0x5a], offset: 0, match: { name: "DOS / Windows executable", mime: "application/x-msdownload", ext: "exe" } },
  { bytes: [0xca, 0xfe, 0xba, 0xbe], offset: 0, match: { name: "Java class file", mime: "application/java-vm", ext: "class" } },
  { bytes: [0x4f, 0x67, 0x67, 0x53], offset: 0, match: { name: "Ogg media", mime: "application/ogg", ext: "ogg" } },
  { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, match: { name: "RIFF (WAV/AVI/WebP)", mime: "application/x-riff", ext: "riff" } },
  { bytes: [0x00, 0x00, 0x01, 0xba], offset: 0, match: { name: "MPEG program stream", mime: "video/mpeg", ext: "mpg" } },
];

/** Detect the file type from the first bytes. */
export function detectFileType(bytes: Uint8Array): MagicMatch | null {
  for (const sig of MAGIC_SIGNATURES) {
    if (bytes.length < sig.offset + sig.bytes.length) continue;
    let matches = true;
    for (let i = 0; i < sig.bytes.length; i++) {
      if (bytes[sig.offset + i] !== sig.bytes[i]) { matches = false; break; }
    }
    if (matches) return sig.match;
  }
  return null;
}

// ---------- Undo / redo ----------

export interface UndoState {
  past: Uint8Array[];
  present: Uint8Array;
  future: Uint8Array[];
}

export function undo(state: UndoState): UndoState {
  if (state.past.length === 0) return state;
  const past = state.past.slice(0, -1);
  const present = state.past[state.past.length - 1];
  const future = [state.present, ...state.future];
  return { past, present, future };
}

export function redo(state: UndoState): UndoState {
  if (state.future.length === 0) return state;
  const [present, ...future] = state.future;
  const past = [...state.past, state.present];
  return { past, present, future };
}

export function pushUndo(state: UndoState, next: Uint8Array): UndoState {
  const past = [...state.past, state.present].slice(-100); // cap past at 100
  return { past, present: next, future: [] };
}

export function initUndo(bytes: Uint8Array): UndoState {
  return { past: [], present: bytes, future: [] };
}
