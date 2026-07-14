/**
 * Base64 File Encoder — pure logic for Base64 encoding, data URL generation,
 * URL-safe conversion, line wrapping, and stats.
 *
 * No DOM dependency — works in both browser and Node test environments.
 */

export type OutputMode = "raw" | "dataUrl" | "urlSafe" | "wrapped";

export interface EncodeOptions {
  mode: OutputMode;
  wrapWidth: number; // line wrap width (default 76)
}

export const DEFAULT_OPTIONS: EncodeOptions = {
  mode: "raw",
  wrapWidth: 76,
};

/** Convert bytes (Uint8Array) to a Base64 string. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Convert a Base64 string to bytes (Uint8Array). */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Convert a standard Base64 string to URL-safe form (- and _ instead of + and /, no padding). */
export function toUrlSafe(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Convert a URL-safe Base64 string back to standard form. */
export function fromUrlSafe(urlSafe: string): string {
  let s = urlSafe.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4 !== 0) s += "=";
  return s;
}

/** Wrap a string at the given line width (RFC 2045 style). */
export function wrapLines(text: string, width: number): string {
  if (width <= 0) return text;
  const out: string[] = [];
  for (let i = 0; i < text.length; i += width) {
    out.push(text.slice(i, i + width));
  }
  return out.join("\n");
}

/** Unwrap line-wrapped Base64 (remove all whitespace). */
export function unwrapLines(text: string): string {
  return text.replace(/\s+/g, "");
}

/** Detect MIME type from filename or magic bytes. */
export function detectMimeType(filename: string, bytes: Uint8Array): string {
  // Try magic bytes first
  const detected = detectFromMagicBytes(bytes);
  if (detected) return detected;
  // Fall back to extension
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME_FROM_EXT[ext] ?? "application/octet-stream";
}

/** Detect MIME from magic bytes (first 8 bytes). */
export function detectFromMagicBytes(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;
  const hex = bytesToHex(bytes.slice(0, Math.min(8, bytes.length)));
  const sorted = [...MAGIC_BYTES].sort((a, b) => b.bytes.length - a.bytes.length);
  for (const m of sorted) {
    if (hex.startsWith(m.bytes)) return m.mime;
  }
  return null;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Magic byte signatures → MIME type. */
export const MAGIC_BYTES: Array<{ bytes: string; mime: string; ext: string }> = [
  { bytes: "89504e47", mime: "image/png", ext: "png" },
  { bytes: "ffd8ffe0", mime: "image/jpeg", ext: "jpg" },
  { bytes: "ffd8ffe1", mime: "image/jpeg", ext: "jpg" },
  { bytes: "ffd8ffe8", mime: "image/jpeg", ext: "jpg" },
  { bytes: "474946383761", mime: "image/gif", ext: "gif" },
  { bytes: "474946383961", mime: "image/gif", ext: "gif" },
  { bytes: "424d", mime: "image/bmp", ext: "bmp" },
  { bytes: "25504446", mime: "application/pdf", ext: "pdf" },
  { bytes: "504b0304", mime: "application/zip", ext: "zip" },
  { bytes: "1f8b", mime: "application/gzip", ext: "gz" },
  { bytes: "526172211a07", mime: "application/vnd.rar", ext: "rar" },
  { bytes: "377abcaf271c", mime: "application/x-7z-compressed", ext: "7z" },
  { bytes: "494433", mime: "audio/mpeg", ext: "mp3" },
  { bytes: "52494646", mime: "audio/wav", ext: "wav" },
  { bytes: "664c6143", mime: "audio/flac", ext: "flac" },
  { bytes: "4f676753", mime: "audio/ogg", ext: "ogg" },
  { bytes: "0000001866747970", mime: "video/mp4", ext: "mp4" },
  { bytes: "0000002066747970", mime: "video/mp4", ext: "mp4" },
  { bytes: "1a45dfa3", mime: "video/webm", ext: "webm" },
  { bytes: "4d5a", mime: "application/x-msdownload", ext: "exe" },
  { bytes: "7f454c46", mime: "application/x-executable", ext: "elf" },
  { bytes: "cafebabe", mime: "application/x-java-applet", ext: "class" },
  { bytes: "53514c697465", mime: "application/x-sqlite3", ext: "sqlite" },
  { bytes: "3c3f786d6c", mime: "application/xml", ext: "xml" },
  { bytes: "7b5c727466", mime: "application/rtf", ext: "rtf" },
];

/** MIME types by file extension (fallback). */
export const MIME_FROM_EXT: Record<string, string> = {
  txt: "text/plain",
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "text/javascript",
  mjs: "text/javascript",
  json: "application/json",
  xml: "application/xml",
  csv: "text/csv",
  md: "text/markdown",
  pdf: "application/pdf",
  zip: "application/zip",
  gz: "application/gzip",
  bz2: "application/x-bzip2",
  "7z": "application/x-7z-compressed",
  rar: "application/vnd.rar",
  tar: "application/x-tar",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  webp: "image/webp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
  ogg: "audio/ogg",
  mp4: "video/mp4",
  webm: "video/webm",
  avi: "video/x-msvideo",
  mov: "video/quicktime",
  exe: "application/x-msdownload",
  bin: "application/octet-stream",
};

/** Suggest a filename extension from a MIME type. */
export function extFromMime(mime: string): string {
  const entry = MAGIC_BYTES.find((m) => m.mime === mime);
  if (entry) return entry.ext;
  for (const [ext, m] of Object.entries(MIME_FROM_EXT)) {
    if (m === mime) return ext;
  }
  return "bin";
}

/** Build a data: URL from bytes + MIME type. */
export function buildDataUrl(bytes: Uint8Array, mime: string): string {
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

/** Encode bytes with the given options. Returns the encoded string. */
export function encodeBytes(bytes: Uint8Array, mime: string, options: EncodeOptions): string {
  switch (options.mode) {
    case "dataUrl":
      return buildDataUrl(bytes, mime);
    case "urlSafe":
      return toUrlSafe(bytesToBase64(bytes));
    case "wrapped":
      return wrapLines(bytesToBase64(bytes), options.wrapWidth);
    case "raw":
    default:
      return bytesToBase64(bytes);
  }
}

export interface EncodeResult {
  filename: string;
  size: number;
  sizeHuman: string;
  mime: string;
  base64: string;
  outputSize: number;
  outputSizeHuman: string;
  overhead: number; // percentage
  preview: string; // first 500 chars
}

/** Format bytes as human-readable. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Encode a single File into an EncodeResult. */
export async function encodeFile(file: File, options: EncodeOptions): Promise<EncodeResult> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const mime = detectMimeType(file.name, bytes);
  const base64 = encodeBytes(bytes, mime, options);
  const overhead = bytes.length === 0 ? 0 : ((base64.length - bytes.length) / bytes.length) * 100;
  return {
    filename: file.name,
    size: bytes.length,
    sizeHuman: formatBytes(bytes.length),
    mime,
    base64,
    outputSize: base64.length,
    outputSizeHuman: formatBytes(base64.length),
    overhead,
    preview: base64.slice(0, 500),
  };
}

/** Encode multiple files in batch. */
export async function encodeFiles(
  files: File[],
  options: EncodeOptions,
  onProgress?: (fileIndex: number, percent: number) => void,
): Promise<EncodeResult[]> {
  const results: EncodeResult[] = [];
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i, Math.round((i / files.length) * 100));
    results.push(await encodeFile(files[i], options));
  }
  onProgress?.(files.length - 1, 100);
  return results;
}

/** Check whether a file is "large" (warn user before encoding). */
export function isLargeFile(size: number, threshold: number = 2 * 1024 * 1024): boolean {
  return size > threshold;
}

/** Read a file as text (used for loading .b64 files into decoder). */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// ===== History (localStorage) =====
const HISTORY_KEY = "unqtools-base64-encode-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  filename: string;
  size: number;
  mime: string;
  mode: OutputMode;
  outputSize: number;
  encodedAt: string;
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
