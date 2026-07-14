/**
 * Base64 File Decoder — pure logic for Base64 decoding, data URL parsing,
 * MIME detection, magic bytes verification, and stats.
 */

import {
  toUrlSafe, fromUrlSafe, base64ToBytes, detectFromMagicBytes, extFromMime,
  formatBytes, MAGIC_BYTES, MIME_FROM_EXT,
} from "../base64-file-encoder/logic";

export { toUrlSafe, fromUrlSafe, base64ToBytes, detectFromMagicBytes, extFromMime, formatBytes, MAGIC_BYTES, MIME_FROM_EXT };

/** Validate a Base64 string (standard or URL-safe, padded or unpadded, line-wrapped). */
export function isValidBase64(input: string): boolean {
  if (!input) return false;
  // Strip data URL prefix
  const stripped = stripDataUrlPrefix(input).value;
  // Strip whitespace (line-wrapped form)
  const cleaned = stripped.replace(/\s+/g, "");
  if (!cleaned) return false;
  // Allow URL-safe characters
  return /^[A-Za-z0-9+/_-]+={0,2}$/.test(cleaned) && cleaned.length % 4 === 0 || /^[A-Za-z0-9+/_-]+$/.test(cleaned);
}

/** Try to normalize a Base64 string (handle URL-safe, line-wrapped, missing padding). */
export function normalizeBase64(input: string): string {
  let s = input;
  // Strip data URL prefix if present
  const stripped = stripDataUrlPrefix(s);
  s = stripped.value;
  // Remove all whitespace (line-wrapped form)
  s = s.replace(/\s+/g, "");
  // Convert URL-safe → standard
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  // Re-pad to multiple of 4
  while (s.length % 4 !== 0) s += "=";
  return s;
}

export interface DataUrlInfo {
  isDataUrl: boolean;
  mime: string | null;
  isBase64: boolean;
  value: string; // base64 payload (or raw text if not base64)
}

/** Strip the data: URL prefix and return the parsed info. */
export function stripDataUrlPrefix(input: string): DataUrlInfo {
  const trimmed = input.trim();
  const match = trimmed.match(/^data:([^;,]+)?((?:;[^;,]+)*)(?:,(.*))?$/s);
  if (!match) {
    return { isDataUrl: false, mime: null, isBase64: false, value: input };
  }
  const mime = match[1] || "text/plain";
  const params = match[2] || "";
  const payload = match[3] ?? "";
  const isBase64 = params.includes(";base64");
  return { isDataUrl: true, mime, isBase64, value: payload };
}

/** Detect MIME from data URL or magic bytes. */
export function detectMime(input: string, decoded: Uint8Array): string | null {
  const info = stripDataUrlPrefix(input);
  if (info.isDataUrl && info.mime) return info.mime;
  return detectFromMagicBytes(decoded);
}

/** Find the matching signature entry (full record) from MAGIC_BYTES. */
export function findSignature(bytes: Uint8Array): { bytes: string; mime: string; ext: string } | null {
  if (bytes.length < 4) return null;
  const hex = bytesToHex(bytes.slice(0, Math.min(8, bytes.length)));
  const sorted = [...MAGIC_BYTES].sort((a, b) => b.bytes.length - a.bytes.length);
  for (const m of sorted) {
    if (hex.startsWith(m.bytes)) return m;
  }
  return null;
}

export type DecodeResult =
  | {
      ok: true;
      bytes: Uint8Array;
      mime: string;
      ext: string;
      inputSize: number;
      outputSize: number;
      outputSizeHuman: string;
      overhead: number; // negative number = decoded is smaller than input
      hexPreview: string; // first 256 bytes as hex
      signature: { ext: string; mime: string } | null;
    }
  | { ok: false; error: string };

/** Decode a Base64 string or data URL. Returns a DecodeResult. */
export function decodeBase64(input: string): DecodeResult {
  if (!input || !input.trim()) return { ok: false, error: "Empty input." };
  const info = stripDataUrlPrefix(input);
  try {
    const normalized = normalizeBase64(input);
    const bytes = base64ToBytes(normalized);
    const mime = detectMime(input, bytes) ?? "application/octet-stream";
    const ext = extFromMime(mime);
    const sig = findSignature(bytes);
    const hexPreview = bytesToHex(bytes.slice(0, 256));
    return {
      ok: true,
      bytes,
      mime,
      ext,
      inputSize: info.value.length,
      outputSize: bytes.length,
      outputSizeHuman: formatBytes(bytes.length),
      overhead: info.value.length === 0 ? 0 : ((bytes.length - info.value.length) / info.value.length) * 100,
      hexPreview,
      signature: sig ? { ext: sig.ext, mime: sig.mime } : null,
    };
  } catch (e) {
    return { ok: false, error: `Invalid Base64: ${(e as Error).message}` };
  }
}

/** Convert bytes to lowercase hex string. */
export function bytesToHex(bytes: Uint8Array, separator: string = ""): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0") + separator;
  return separator ? hex.slice(0, -separator.length) : hex;
}

/** Suggest a filename from MIME or extension. */
export function suggestFilename(mime: string, ext: string, baseName: string = "decoded"): string {
  return `${baseName}.${ext}`;
}

/** Format hex preview into rows of 16 bytes. */
export function formatHexPreview(hex: string): string {
  const bytes = hex.match(/.{1,2}/g) || [];
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const offset = i.toString(16).padStart(8, "0");
    const hexPart = bytes.slice(i, i + 16).join(" ").padEnd(48, " ");
    const asciiPart = bytes.slice(i, i + 16).map((b) => {
      const code = parseInt(b, 16);
      return (code >= 32 && code < 127) ? String.fromCharCode(code) : ".";
    }).join("");
    lines.push(`${offset}  ${hexPart}  |${asciiPart}|`);
  }
  return lines.join("\n");
}

/** Read a .b64 file as text. */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// ===== History (localStorage) =====
const HISTORY_KEY = "unqtools-base64-decode-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  inputSize: number;
  outputSize: number;
  mime: string;
  ext: string;
  decodedAt: string;
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

/** Decode multiple inputs in batch. */
export function decodeBatch(inputs: string[]): Array<{ input: string; result: DecodeResult }> {
  return inputs.map((input) => ({ input, result: decodeBase64(input) }));
}

/** Check if input looks like a data URL. */
export function isDataUrl(input: string): boolean {
  return stripDataUrlPrefix(input).isDataUrl;
}
