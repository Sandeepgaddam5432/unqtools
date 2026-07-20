/**
 * Test / Dummy File Generator — pure logic.
 *
 * Generates dummy files of an EXACT byte size in 9 formats:
 *   TXT / CSV / JSON / XML / HTML — text-based, encoded via TextEncoder.
 *   binary                        — raw byte array (random/zeros/pattern).
 *   PNG                           — real, openable solid-color PNG padded
 *                                   with tEXt chunks for exact size.
 *   ZIP                           — real ZIP archive with one inner file
 *                                   sized to hit the exact target.
 *   PDF                           — minimal valid PDF padded with a long
 *                                   comment line.
 *
 * Pure functions only — no DOM, no network. The generator uses a seedable
 * mulberry32 PRNG so output is reproducible for golden-master tests.
 */

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

export type FileType = "txt" | "csv" | "json" | "xml" | "html" | "png" | "binary" | "zip" | "pdf";
export type ContentMode = "random" | "zeros" | "lorem" | "pattern";
export type Unit = "B" | "KB" | "MB" | "GB";

export interface GenerateOptions {
  size: number;
  unit: Unit;
  type: FileType;
  contentMode: ContentMode;
  /** Byte pattern for "pattern" mode (string or hex like "0xAA,0xBB"). */
  pattern?: string;
  /** Filename (may contain {n} for bulk numbering). */
  filename: string;
  /** Bulk count (1–100). */
  bulkCount: number;
  /** Optional seed for reproducible content. */
  seed?: string;
  /** PNG: hex color (#RRGGBB). Default #3B82F6. */
  imageColor?: string;
  /** PNG: width in pixels. Default 1. */
  imageWidth?: number;
  /** PNG: height in pixels. Default 1. */
  imageHeight?: number;
  /** CSV: number of columns. Default 5. */
  csvCols?: number;
  /** CSV: target number of rows (approximate; exact-size override). */
  csvRows?: number;
}

export interface GeneratedFile {
  name: string;
  bytes: Uint8Array;
  size: number;
  checksum: string; // FNV-1a-32 hex (display only)
}

export interface HistoryEntry {
  ts: number;
  type: FileType;
  bytes: number;
  bulkCount: number;
  contentMode: ContentMode;
  filename: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────

export const MAX_SIZE_GB = 2;
export const MAX_BULK = 100;
export const HISTORY_MAX = 20;
const HISTORY_KEY = "unqtools:test-dummy-file-generator:history";

export const FILE_TYPES: { value: FileType; label: string; mime: string; ext: string }[] = [
  { value: "txt",    label: "TXT (plain text)",          mime: "text/plain",                 ext: "txt" },
  { value: "csv",    label: "CSV (random table)",        mime: "text/csv",                   ext: "csv" },
  { value: "json",   label: "JSON (nested object)",      mime: "application/json",            ext: "json" },
  { value: "xml",    label: "XML (root + items)",        mime: "application/xml",             ext: "xml" },
  { value: "html",   label: "HTML (basic page)",         mime: "text/html",                  ext: "html" },
  { value: "png",    label: "PNG (solid color image)",   mime: "image/png",                  ext: "png" },
  { value: "binary", label: "Binary (raw bytes)",        mime: "application/octet-stream",   ext: "bin" },
  { value: "zip",    label: "ZIP (real archive)",        mime: "application/zip",            ext: "zip" },
  { value: "pdf",    label: "PDF (minimal valid)",       mime: "application/pdf",            ext: "pdf" },
];

export const CONTENT_MODES: { value: ContentMode; label: string }[] = [
  { value: "random",  label: "Random (PRNG)" },
  { value: "zeros",   label: "Zeros (0x00)" },
  { value: "lorem",   label: "Lorem Ipsum" },
  { value: "pattern", label: "Custom pattern" },
];

export const UNITS: { value: Unit; label: string; factor: number }[] = [
  { value: "B",  label: "Bytes",  factor: 1 },
  { value: "KB", label: "KB",     factor: 1024 },
  { value: "MB", label: "MB",     factor: 1024 * 1024 },
  { value: "GB", label: "GB",     factor: 1024 * 1024 * 1024 },
];

// Lorem Ipsum word pool
const LOREM_WORDS = [
  "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
  "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
  "magna", "aliqua", "ut", "enim", "ad", "minim", "veniam", "quis", "nostrud",
  "exercitation", "ullamco", "laboris", "nisi", "ut", "aliquip", "ex", "ea",
  "commodo", "consequat", "duis", "aute", "irure", "in", "reprehenderit", "voluptate",
  "velit", "esse", "cillum", "eu", "fugiat", "nulla", "pariatur", "excepteur",
  "sint", "occaecat", "cupidatat", "non", "proident", "sunt", "culpa", "qui",
  "officia", "deserunt", "mollit", "anim", "id", "est", "laborum", "at",
];

// ──────────────────────────────────────────────────────────────────────────
// PRNG — mulberry32 + FNV-1a
// ──────────────────────────────────────────────────────────────────────────

export function fnv1a(data: string | Uint8Array): number {
  let h = 0x811c9dc5;
  if (typeof data === "string") {
    for (let i = 0; i < data.length; i++) {
      h ^= data.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  } else {
    for (let i = 0; i < data.length; i++) {
      h ^= data[i];
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers — CRC32, Adler32, encoding, byte ops
// ──────────────────────────────────────────────────────────────────────────

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    c = CRC32_TABLE[(c ^ data[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

export function adler32(data: Uint8Array): number {
  let a = 1, b = 0;
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

const TEXT_ENCODER = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;

export function encodeUtf8(s: string): Uint8Array {
  if (TEXT_ENCODER) return TEXT_ENCODER.encode(s);
  // Manual fallback (UTF-8)
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xC0 | (c >> 6), 0x80 | (c & 0x3F));
    else if (c >= 0xD800 && c <= 0xDBFF) {
      const c2 = s.charCodeAt(++i);
      const cp = 0x10000 + (((c & 0x3FF) << 10) | (c2 & 0x3FF));
      bytes.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3F), 0x80 | ((cp >> 6) & 0x3F), 0x80 | (cp & 0x3F));
    } else {
      bytes.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 0x3F), 0x80 | (c & 0x3F));
    }
  }
  return new Uint8Array(bytes);
}

/** Concatenate multiple Uint8Arrays. */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

export function toHex(bytes: Uint8Array, max = 16): string {
  const slice = bytes.slice(0, max);
  return Array.from(slice).map((b) => b.toString(16).padStart(2, "0")).join(" ");
}

/** Human-readable byte size. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** Parse a user pattern string into a byte array.
 *  Accepts: hex bytes "0xAA,0xBB" or "AA BB" or a literal string "hello". */
export function parsePattern(input: string): Uint8Array {
  if (!input) return new Uint8Array([0x20]);
  const trimmed = input.trim();
  if (/^(0x[0-9a-fA-F]{1,2}[,;\s]+)+0x[0-9a-fA-F]{1,2}$/.test(trimmed)) {
    const parts = trimmed.split(/[,;\s]+/).filter(Boolean);
    return new Uint8Array(parts.map((p) => parseInt(p, 16)));
  }
  if (/^([0-9a-fA-F]{2}[,;\s]+)*[0-9a-fA-F]{2}$/.test(trimmed) && trimmed.split(/[,;\s]+/).length > 1) {
    const parts = trimmed.split(/[,;\s]+/).filter(Boolean);
    return new Uint8Array(parts.map((p) => parseInt(p, 16)));
  }
  // Treat as literal string
  return encodeUtf8(trimmed);
}

// ──────────────────────────────────────────────────────────────────────────
// Sizing & validation
// ──────────────────────────────────────────────────────────────────────────

/** Compute the exact byte count for a size + unit. */
export function computeTargetBytes(size: number, unit: Unit): number {
  const f = UNITS.find((u) => u.value === unit)?.factor ?? 1;
  return Math.floor(size * f);
}

export function validateOptions(opts: GenerateOptions): { ok: true } | { ok: false; error: string } {
  if (!Number.isFinite(opts.size) || opts.size <= 0) {
    return { ok: false, error: "Size must be a positive number." };
  }
  const bytes = computeTargetBytes(opts.size, opts.unit);
  const maxBytes = MAX_SIZE_GB * 1024 * 1024 * 1024;
  if (bytes < 1) {
    return { ok: false, error: "Target size must be at least 1 byte." };
  }
  if (bytes > maxBytes) {
    return { ok: false, error: `Target size must not exceed ${MAX_SIZE_GB} GB.` };
  }
  if (!FILE_TYPES.some((f) => f.value === opts.type)) {
    return { ok: false, error: "Invalid file type." };
  }
  if (!CONTENT_MODES.some((m) => m.value === opts.contentMode)) {
    return { ok: false, error: "Invalid content mode." };
  }
  if (!Number.isFinite(opts.bulkCount) || opts.bulkCount < 1) {
    return { ok: false, error: "Bulk count must be at least 1." };
  }
  if (opts.bulkCount > MAX_BULK) {
    return { ok: false, error: `Bulk count must not exceed ${MAX_BULK}.` };
  }
  // Format-specific minimums
  if (opts.type === "png" && bytes < PNG_MIN_SIZE) {
    return { ok: false, error: `PNG requires at least ${PNG_MIN_SIZE} bytes.` };
  }
  if (opts.type === "pdf" && bytes < PDF_MIN_SIZE) {
    return { ok: false, error: `PDF requires at least ${PDF_MIN_SIZE} bytes.` };
  }
  if (opts.type === "zip" && bytes < ZIP_MIN_OVERHEAD + 1) {
    return { ok: false, error: `ZIP requires at least ${ZIP_MIN_OVERHEAD + 1} bytes.` };
  }
  return { ok: true };
}

// ──────────────────────────────────────────────────────────────────────────
// Content generators (text & binary)
// ──────────────────────────────────────────────────────────────────────────

function rngFromSeed(seed: string | undefined): () => number {
  const s = seed && seed.length > 0 ? fnv1a(seed) : (Math.random() * 0xFFFFFFFF) >>> 0;
  return mulberry32(s);
}

/** Generate `bytes` worth of Lorem Ipsum text. */
function generateLoremText(bytes: number, rng: () => number): Uint8Array {
  if (bytes <= 0) return new Uint8Array(0);
  const out: number[] = [];
  let sentence: number[] = [];
  let wordCount = 0;
  while (out.length < bytes) {
    const w = LOREM_WORDS[Math.floor(rng() * LOREM_WORDS.length)];
    for (let i = 0; i < w.length && (out.length + sentence.length) < bytes; i++) {
      sentence.push(w.charCodeAt(i));
    }
    sentence.push(" ".charCodeAt(0));
    wordCount++;
    if (wordCount % 12 === 11) {
      sentence.push("\n".charCodeAt(0));
    }
    // Flush sentence buffer into out (only as much as we need)
    for (let i = 0; i < sentence.length && out.length < bytes; i++) {
      out.push(sentence[i]);
    }
    sentence = [];
  }
  return new Uint8Array(out.slice(0, bytes));
}

/** Generate `bytes` of random printable ASCII text. */
function generateRandomText(bytes: number, rng: () => number): Uint8Array {
  if (bytes <= 0) return new Uint8Array(0);
  const out = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i++) {
    // Printable ASCII range 0x20-0x7E, occasionally newline
    const r = rng();
    if (r < 0.05) out[i] = 0x0A; // newline
    else out[i] = 0x20 + Math.floor(rng() * 95);
  }
  return out;
}

/** Generate `bytes` of zero ASCII ('0' = 0x30). */
function generateZerosText(bytes: number): Uint8Array {
  const out = new Uint8Array(bytes);
  out.fill(0x30);
  return out;
}

/** Generate `bytes` by repeating a byte pattern. */
function generatePatternText(bytes: number, pattern: Uint8Array): Uint8Array {
  if (bytes <= 0) return new Uint8Array(0);
  if (pattern.length === 0) return generateZerosText(bytes);
  const out = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i++) {
    out[i] = pattern[i % pattern.length];
  }
  return out;
}

/** Generate `bytes` of arbitrary content (for binary file type). */
function generateBinaryBytes(bytes: number, mode: ContentMode, pattern: Uint8Array, rng: () => number): Uint8Array {
  if (bytes <= 0) return new Uint8Array(0);
  const out = new Uint8Array(bytes);
  if (mode === "zeros") {
    out.fill(0);
    return out;
  }
  if (mode === "random") {
    for (let i = 0; i < bytes; i++) out[i] = Math.floor(rng() * 256);
    return out;
  }
  if (mode === "pattern") {
    if (pattern.length === 0) {
      out.fill(0);
      return out;
    }
    for (let i = 0; i < bytes; i++) out[i] = pattern[i % pattern.length];
    return out;
  }
  // lorem (binary) — ASCII text
  return generateLoremText(bytes, rng);
}

// ──────────────────────────────────────────────────────────────────────────
// Text-based format generators (TXT, CSV, JSON, XML, HTML)
// ──────────────────────────────────────────────────────────────────────────

/** Generate the body bytes for a TXT file. */
function generateTxtBody(target: number, mode: ContentMode, pattern: Uint8Array, rng: () => number): Uint8Array {
  if (mode === "lorem") return generateLoremText(target, rng);
  if (mode === "zeros") return generateZerosText(target);
  if (mode === "pattern") return generatePatternText(target, pattern);
  return generateRandomText(target, rng);
}

/** Generate CSV body of approximately `target` bytes. */
function generateCsvBody(target: number, opts: GenerateOptions, rng: () => number): Uint8Array {
  if (target <= 0) return new Uint8Array(0);
  const cols = Math.max(1, opts.csvCols ?? 5);
  const header = Array.from({ length: cols }, (_, i) => `col${i + 1}`).join(",") + "\n";
  const headerBytes = encodeUtf8(header);
  if (headerBytes.length >= target) {
    return headerBytes.slice(0, target);
  }
  const out: number[] = Array.from(headerBytes);
  let rowIndex = 1;
  while (out.length < target) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(`r${rowIndex}c${c + 1}-${Math.floor(rng() * 100000).toString(36)}`);
    }
    const line = row.join(",") + "\n";
    const lineBytes = encodeUtf8(line);
    for (let i = 0; i < lineBytes.length && out.length < target; i++) out.push(lineBytes[i]);
    rowIndex++;
  }
  return new Uint8Array(out.slice(0, target));
}

/** Generate JSON body of approximately `target` bytes. */
function generateJsonBody(target: number, opts: GenerateOptions, rng: () => number): Uint8Array {
  if (target <= 0) return new Uint8Array(0);
  const prefix = encodeUtf8('{\n  "generated": "unqtools-test-dummy-file-generator",\n  "size": ' + target + ',\n  "type": "json",\n  "contentMode": "' + opts.contentMode + '",\n  "items": [\n');
  const suffix = encodeUtf8("\n  ]\n}\n");
  const itemPrefix = encodeUtf8('    {"id":');
  const itemSuffix = encodeUtf8("}");
  if (prefix.length + suffix.length >= target) {
    return prefix.slice(0, target);
  }
  const out: number[] = Array.from(prefix);
  let id = 1;
  let first = true;
  while (out.length < target - suffix.length) {
    if (!first) {
      const comma = encodeUtf8(",");
      for (let i = 0; i < comma.length && out.length < target - suffix.length; i++) out.push(comma[i]);
    }
    first = false;
    const line = `    {"id":${id},"value":"${LOREM_WORDS[Math.floor(rng() * LOREM_WORDS.length)]}-${Math.floor(rng() * 1e9).toString(36)}"}`;
    const lb = encodeUtf8(line);
    for (let i = 0; i < lb.length && out.length < target - suffix.length; i++) out.push(lb[i]);
    id++;
  }
  // Add suffix
  for (let i = 0; i < suffix.length && out.length < target; i++) out.push(suffix[i]);
  return new Uint8Array(out.slice(0, target));
}

/** Generate XML body of approximately `target` bytes. */
function generateXmlBody(target: number, opts: GenerateOptions, rng: () => number): Uint8Array {
  if (target <= 0) return new Uint8Array(0);
  const prefix = encodeUtf8('<?xml version="1.0" encoding="UTF-8"?>\n<root>\n');
  const suffix = encodeUtf8("\n</root>\n");
  if (prefix.length + suffix.length >= target) {
    return prefix.slice(0, target);
  }
  const out: number[] = Array.from(prefix);
  let id = 1;
  while (out.length < target - suffix.length) {
    const line = `  <item id="${id}"><word>${LOREM_WORDS[Math.floor(rng() * LOREM_WORDS.length)]}</word><n>${Math.floor(rng() * 1e9)}</n></item>\n`;
    const lb = encodeUtf8(line);
    for (let i = 0; i < lb.length && out.length < target - suffix.length; i++) out.push(lb[i]);
    id++;
  }
  for (let i = 0; i < suffix.length && out.length < target; i++) out.push(suffix[i]);
  return new Uint8Array(out.slice(0, target));
}

/** Generate HTML body of approximately `target` bytes. */
function generateHtmlBody(target: number, opts: GenerateOptions, rng: () => number): Uint8Array {
  if (target <= 0) return new Uint8Array(0);
  const prefix = encodeUtf8("<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n  <title>Dummy File</title>\n</head>\n<body>\n  <h1>Dummy File</h1>\n");
  const suffix = encodeUtf8("\n</body>\n</html>\n");
  if (prefix.length + suffix.length >= target) {
    return prefix.slice(0, target);
  }
  const out: number[] = Array.from(prefix);
  let id = 1;
  while (out.length < target - suffix.length) {
    const line = `  <p>${LOREM_WORDS[Math.floor(rng() * LOREM_WORDS.length)]} ${LOREM_WORDS[Math.floor(rng() * LOREM_WORDS.length)]} ${LOREM_WORDS[Math.floor(rng() * LOREM_WORDS.length)]} (#${id})</p>\n`;
    const lb = encodeUtf8(line);
    for (let i = 0; i < lb.length && out.length < target - suffix.length; i++) out.push(lb[i]);
    id++;
  }
  for (let i = 0; i < suffix.length && out.length < target; i++) out.push(suffix[i]);
  return new Uint8Array(out.slice(0, target));
}

// ──────────────────────────────────────────────────────────────────────────
// PNG generator (solid color, padded to exact size with tEXt chunks)
// ──────────────────────────────────────────────────────────────────────────

export const PNG_MIN_SIZE = 87; // 73-byte base 1×1 PNG + 14-byte minimum tEXt chunk

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return [0x3B, 0x82, 0xF6];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Build a PNG chunk: length + type + data + CRC. */
function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = encodeUtf8(type);
  const lenBytes = new Uint8Array(4);
  new DataView(lenBytes.buffer).setUint32(0, data.length, false);
  const crcInput = concatBytes(typeBytes, data);
  const crc = crc32(crcInput);
  const crcBytes = new Uint8Array(4);
  new DataView(crcBytes.buffer).setUint32(0, crc, false);
  return concatBytes(lenBytes, typeBytes, data, crcBytes);
}

/** Build an uncompressed deflate stream from raw data.
 *  zlib header (78 01) + N uncompressed blocks + adler32. */
function zlibUncompressed(raw: Uint8Array): Uint8Array {
  const out: number[] = [0x78, 0x01]; // zlib header (deflate, no preset dict, compression level 0)
  let offset = 0;
  while (offset < raw.length) {
    const blockLen = Math.min(65535, raw.length - offset);
    const isLast = offset + blockLen === raw.length;
    out.push(isLast ? 0x01 : 0x00); // BFINAL | BTYPE=00 (no compression)
    out.push(blockLen & 0xFF, (blockLen >> 8) & 0xFF);
    const nlen = (~blockLen) & 0xFFFF;
    out.push(nlen & 0xFF, (nlen >> 8) & 0xFF);
    for (let i = 0; i < blockLen; i++) out.push(raw[offset + i]);
    offset += blockLen;
  }
  if (raw.length === 0) {
    out.push(0x01, 0x00, 0x00, 0xFF, 0xFF); // empty final block
  }
  const adler = adler32(raw);
  out.push((adler >>> 24) & 0xFF, (adler >>> 16) & 0xFF, (adler >>> 8) & 0xFF, adler & 0xFF);
  return new Uint8Array(out);
}

/** Generate a solid-color PNG of exact `target` byte size. */
export function generatePng(target: number, opts: GenerateOptions): Uint8Array {
  if (target < PNG_MIN_SIZE) {
    throw new Error(`PNG requires at least ${PNG_MIN_SIZE} bytes (got ${target}).`);
  }
  const w = Math.max(1, Math.floor(opts.imageWidth ?? 1));
  const h = Math.max(1, Math.floor(opts.imageHeight ?? 1));
  const [r, g, b] = hexToRgb(opts.imageColor ?? "#3B82F6");
  // IHDR
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w, false);
  dv.setUint32(4, h, false);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type (RGBA)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  // Raw pixel data: each row prefixed with filter byte 0x00
  const rowBytes = 1 + w * 4;
  const raw = new Uint8Array(rowBytes * h);
  for (let y = 0; y < h; y++) {
    const rowOff = y * rowBytes;
    raw[rowOff] = 0; // filter: None
    for (let x = 0; x < w; x++) {
      const p = rowOff + 1 + x * 4;
      raw[p] = r;
      raw[p + 1] = g;
      raw[p + 2] = b;
      raw[p + 3] = 0xFF; // alpha
    }
  }
  const compressed = zlibUncompressed(raw);
  const sig = PNG_SIGNATURE;
  const ihdrChunk = pngChunk("IHDR", ihdr);
  const idatChunk = pngChunk("IDAT", compressed);
  const iendChunk = pngChunk("IEND", new Uint8Array(0));
  const base = concatBytes(sig, ihdrChunk, idatChunk, iendChunk);
  if (target === base.length) return base;
  if (target < base.length) {
    throw new Error(`PNG base size ${base.length} exceeds target ${target}. Use a smaller image or larger target.`);
  }
  // Pad with one or more tEXt chunks INSERTED BEFORE IEND (PNG spec requires
  // IEND to be the last chunk in the file).
  let remaining = target - base.length;
  const beforeIend: Uint8Array[] = [sig, ihdrChunk, idatChunk];
  const chunks: Uint8Array[] = [];
  while (remaining > 0) {
    // Minimum tEXt chunk = 12 + 1 (keyword "x") + 1 (null) + 0 (text) = 14 bytes
    if (remaining < 14) {
      // Need to enlarge text of the previous chunk to absorb the remainder.
      // Approach: replace last tEXt chunk with one `remaining` bytes larger.
      const last = chunks.pop()!;
      // The last chunk is a tEXt chunk; re-decode to add `remaining` more bytes.
      // 4-byte len at start. Increase len by `remaining`. Recompute CRC.
      const oldLen = new DataView(last.buffer).getUint32(0, false);
      const newLen = oldLen + remaining;
      const newLenBytes = new Uint8Array(4);
      new DataView(newLenBytes.buffer).setUint32(0, newLen, false);
      // Old data is last[8 .. 8+oldLen). New data appends `remaining` bytes of 0x20 (space).
      const oldData = last.subarray(8, 8 + oldLen);
      const appended = new Uint8Array(remaining).fill(0x20);
      const newData = concatBytes(oldData, appended);
      const typeBytes = encodeUtf8("tEXt");
      const crc = crc32(concatBytes(typeBytes, newData));
      const crcBytes = new Uint8Array(4);
      new DataView(crcBytes.buffer).setUint32(0, crc, false);
      chunks.push(concatBytes(newLenBytes, typeBytes, newData, crcBytes));
      remaining = 0;
      break;
    }
    // Allocate as much as possible to one big tEXt chunk
    const chunkOverhead = 12 + 1 + 1; // len+type+CRC + keyword "x" + null
    const textLen = Math.min(remaining - chunkOverhead, 0x7FFFFFFF);
    const data = new Uint8Array(1 + 1 + textLen);
    data[0] = 0x78; // 'x'
    data[1] = 0x00; // null separator
    data.fill(0x20, 2); // spaces for text
    chunks.push(pngChunk("tEXt", data));
    remaining -= (chunkOverhead + textLen);
  }
  return concatBytes(...beforeIend, ...chunks, iendChunk);
}

// ──────────────────────────────────────────────────────────────────────────
// ZIP generator (real ZIP archive with one inner file sized to hit target)
// ──────────────────────────────────────────────────────────────────────────

export const ZIP_MIN_OVERHEAD = 30 + 11 + 46 + 11 + 22; // local header (30 + "payload.dat") + central dir (46 + name) + EOCD (22) = 120

function uint16le(n: number): Uint8Array {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, n, true);
  return b;
}
function uint32le(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0, true);
  return b;
}

/** Generate a real ZIP archive of exact `target` byte size containing
 *  one inner file with the chosen content mode. */
export function generateZip(target: number, opts: GenerateOptions, rng: () => number): Uint8Array {
  const innerName = "payload.dat";
  const innerNameBytes = encodeUtf8(innerName);
  const overhead = 30 + innerNameBytes.length + 46 + innerNameBytes.length + 22;
  if (target < overhead + 1) {
    throw new Error(`ZIP requires at least ${overhead + 1} bytes (got ${target}).`);
  }
  const innerLen = target - overhead;
  const pattern = parsePattern(opts.pattern ?? "");
  const innerData = generateBinaryBytes(innerLen, opts.contentMode, pattern, rng);
  const crc = crc32(innerData);

  // Local file header (signature PK\x03\x04)
  const localHeader = concatBytes(
    new Uint8Array([0x50, 0x4B, 0x03, 0x04]),
    uint16le(20),             // version needed
    uint16le(0),              // flags
    uint16le(0),              // compression method (stored)
    uint16le(0),              // mod time
    uint16le(0),              // mod date
    uint32le(crc),            // crc-32
    uint32le(innerLen),       // compressed size
    uint32le(innerLen),       // uncompressed size
    uint16le(innerNameBytes.length),
    uint16le(0),              // extra field length
    innerNameBytes,
  );

  // Central directory record (PK\x01\x02)
  const central = concatBytes(
    new Uint8Array([0x50, 0x4B, 0x01, 0x02]),
    uint16le(20),             // version made by
    uint16le(20),             // version needed
    uint16le(0),              // flags
    uint16le(0),              // compression method
    uint16le(0),              // mod time
    uint16le(0),              // mod date
    uint32le(crc),
    uint32le(innerLen),
    uint32le(innerLen),
    uint16le(innerNameBytes.length),
    uint16le(0),              // extra field length
    uint16le(0),              // comment length
    uint16le(0),              // disk number start
    uint16le(0),              // internal attrs
    uint32le(0),              // external attrs
    uint32le(0),              // offset of local header
    innerNameBytes,
  );

  // EOCD (PK\x05\x06)
  const eocd = concatBytes(
    new Uint8Array([0x50, 0x4B, 0x05, 0x06]),
    uint16le(0),              // disk number
    uint16le(0),              // disk with CD start
    uint16le(1),              // entries on this disk
    uint16le(1),              // total entries
    uint32le(central.length), // size of CD
    uint32le(localHeader.length), // offset of CD
    uint16le(0),              // comment length
  );

  return concatBytes(localHeader, innerData, central, eocd);
}

// ──────────────────────────────────────────────────────────────────────────
// PDF generator (minimal valid PDF, padded with one long comment line)
// ──────────────────────────────────────────────────────────────────────────

export const PDF_MIN_SIZE = 80;

export function generatePdf(target: number, _opts: GenerateOptions): Uint8Array {
  if (target < PDF_MIN_SIZE) {
    throw new Error(`PDF requires at least ${PDF_MIN_SIZE} bytes (got ${target}).`);
  }
  // Minimal exact-size PDF: "%PDF-1.4\n" + "%<padding>\n" + "%%EOF"
  // Overhead = 9 + 1 + 1 + 5 = 16 bytes; padding = target - 16 bytes of 'x'.
  const header = encodeUtf8("%PDF-1.4\n");
  const commentStart = encodeUtf8("%");
  const commentEnd = encodeUtf8("\n");
  const trailer = encodeUtf8("%%EOF");
  const overhead = header.length + commentStart.length + commentEnd.length + trailer.length;
  const padLen = target - overhead;
  const pad = new Uint8Array(padLen).fill(0x78); // 'x' padding bytes
  return concatBytes(header, commentStart, pad, commentEnd, trailer);
}

// ──────────────────────────────────────────────────────────────────────────
// File generation dispatcher
// ──────────────────────────────────────────────────────────────────────────

export function generateFile(opts: GenerateOptions): GeneratedFile {
  const v = validateOptions(opts);
  if (!v.ok) throw new Error(v.error);
  const target = computeTargetBytes(opts.size, opts.unit);
  const pattern = parsePattern(opts.pattern ?? "");
  const rng = rngFromSeed(opts.seed);
  let bytes: Uint8Array;
  switch (opts.type) {
    case "txt":    bytes = generateTxtBody(target, opts.contentMode, pattern, rng); break;
    case "csv":    bytes = generateCsvBody(target, opts, rng); break;
    case "json":   bytes = generateJsonBody(target, opts, rng); break;
    case "xml":    bytes = generateXmlBody(target, opts, rng); break;
    case "html":   bytes = generateHtmlBody(target, opts, rng); break;
    case "binary": bytes = generateBinaryBytes(target, opts.contentMode, pattern, rng); break;
    case "png":    bytes = generatePng(target, opts); break;
    case "zip":    bytes = generateZip(target, opts, rng); break;
    case "pdf":    bytes = generatePdf(target, opts); break;
    default: throw new Error(`Unknown file type: ${opts.type}`);
  }
  // Safety: ensure exact byte length
  if (bytes.length !== target) {
    if (bytes.length > target) {
      bytes = bytes.slice(0, target);
    } else {
      const pad = new Uint8Array(target - bytes.length).fill(0x20);
      bytes = concatBytes(bytes, pad);
    }
  }
  return {
    name: resolveFilename(opts.filename, opts.type, 1),
    bytes,
    size: bytes.length,
    checksum: fnv1a(bytes).toString(16).padStart(8, "0"),
  };
}

/** Generate bulk files (1–100). Each gets a unique {n} index in its filename. */
export function generateBulk(opts: GenerateOptions): GeneratedFile[] {
  const v = validateOptions(opts);
  if (!v.ok) throw new Error(v.error);
  const out: GeneratedFile[] = [];
  for (let i = 1; i <= opts.bulkCount; i++) {
    const seed = opts.seed ? `${opts.seed}#${i}` : undefined;
    const fileOpts: GenerateOptions = { ...opts, seed };
    const file = generateFile(fileOpts);
    file.name = resolveFilename(opts.filename, opts.type, i);
    out.push(file);
  }
  return out;
}

/** Resolve a filename — replace {n} with index, ensure extension. */
export function resolveFilename(template: string, type: FileType, index: number): string {
  const meta = FILE_TYPES.find((f) => f.value === type)!;
  let name = (template || "").trim();
  if (!name) name = "dummy";
  name = name.replace(/\{n\}/g, String(index));
  // If no extension, append the type's default
  if (!/\.[a-z0-9]+$/i.test(name)) name += `.${meta.ext}`;
  return name;
}

// ──────────────────────────────────────────────────────────────────────────
// MIME type lookup
// ──────────────────────────────────────────────────────────────────────────

export function mimeType(type: FileType): string {
  return FILE_TYPES.find((f) => f.value === type)?.mime ?? "application/octet-stream";
}

export function fileExtension(type: FileType): string {
  return FILE_TYPES.find((f) => f.value === type)?.ext ?? "bin";
}

export function defaultFilename(type: FileType): string {
  return `dummy.${fileExtension(type)}`;
}

// ──────────────────────────────────────────────────────────────────────────
// Magic byte check (for tests / UI display)
// ──────────────────────────────────────────────────────────────────────────

export function detectMagic(bytes: Uint8Array): string {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return "PNG";
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04) return "ZIP";
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2D) return "PDF";
  if (bytes.length >= 5 && bytes[0] === 0x3C && bytes[1] === 0x3F && bytes[2] === 0x78 && bytes[3] === 0x6D && bytes[4] === 0x6C) return "XML";
  if (bytes.length >= 5 && bytes[0] === 0x3C && bytes[1] === 0x21 && bytes[2] === 0x44 && bytes[3] === 0x4F && bytes[4] === 0x43) return "HTML";
  if (bytes.length >= 1 && bytes[0] === 0x7B) return "JSON"; // starts with '{'
  return "Unknown";
}

// ──────────────────────────────────────────────────────────────────────────
// History (localStorage)
// ──────────────────────────────────────────────────────────────────────────

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

// ──────────────────────────────────────────────────────────────────────────
// Shareable URL
// ──────────────────────────────────────────────────────────────────────────

export function buildShareUrl(opts: GenerateOptions): string {
  const params = new URLSearchParams();
  params.set("size", String(opts.size));
  params.set("unit", opts.unit);
  params.set("type", opts.type);
  params.set("mode", opts.contentMode);
  if (opts.pattern) params.set("pattern", opts.pattern);
  if (opts.filename) params.set("filename", opts.filename);
  if (opts.bulkCount) params.set("bulk", String(opts.bulkCount));
  if (opts.seed) params.set("seed", opts.seed);
  if (opts.imageColor) params.set("color", opts.imageColor);
  if (opts.imageWidth) params.set("w", String(opts.imageWidth));
  if (opts.imageHeight) params.set("h", String(opts.imageHeight));
  if (opts.csvCols) params.set("cols", String(opts.csvCols));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): GenerateOptions {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(clean);
  const validTypes = FILE_TYPES.map((f) => f.value);
  const validModes = CONTENT_MODES.map((m) => m.value);
  const validUnits = UNITS.map((u) => u.value);
  const size = Number(params.get("size") ?? "1");
  return {
    size: Number.isFinite(size) && size > 0 ? size : 1,
    unit: (validUnits.includes(params.get("unit") as Unit) ? params.get("unit") : "B") as Unit,
    type: (validTypes.includes(params.get("type") as FileType) ? params.get("type") : "txt") as FileType,
    contentMode: (validModes.includes(params.get("mode") as ContentMode) ? params.get("mode") : "lorem") as ContentMode,
    pattern: params.get("pattern") ?? undefined,
    filename: params.get("filename") ?? "",
    bulkCount: Math.max(1, Math.min(MAX_BULK, Number(params.get("bulk") ?? "1") || 1)),
    seed: params.get("seed") ?? undefined,
    imageColor: params.get("color") ?? undefined,
    imageWidth: params.get("w") ? Number(params.get("w")) : undefined,
    imageHeight: params.get("h") ? Number(params.get("h")) : undefined,
    csvCols: params.get("cols") ? Number(params.get("cols")) : undefined,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Sample size presets
// ──────────────────────────────────────────────────────────────────────────

export const SIZE_PRESETS: { label: string; size: number; unit: Unit }[] = [
  { label: "1 KB",  size: 1,    unit: "KB" },
  { label: "10 KB", size: 10,   unit: "KB" },
  { label: "100 KB",size: 100,  unit: "KB" },
  { label: "1 MB",  size: 1,    unit: "MB" },
  { label: "10 MB", size: 10,   unit: "MB" },
  { label: "100 MB",size: 100,  unit: "MB" },
  { label: "500 MB",size: 500,  unit: "MB" },
  { label: "1 GB",  size: 1,    unit: "GB" },
];
