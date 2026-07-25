/**
 * Base64 to Image — pure logic. No DOM access.
 */
export interface ParsedDataUrl {
  mime: string;
  /** Raw base64 content (no prefix). */
  base64: string;
  /** Decoded byte size estimate. */
  sizeBytes: number;
  /** Suggested file extension. */
  extension: string;
}

/** Parse a data URL and extract MIME, base64 payload, and suggested extension. */
export function parseDataUrl(input: string): ParsedDataUrl | { error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { error: "Input is empty" };
  const m = /^data:([^;,]+)(?:;base64)?,(.*)$/is.exec(trimmed);
  if (!m) return { error: "Not a valid data URL (expected 'data:mime;base64,...')" };
  const mime = (m[1] || "").toLowerCase();
  const base64 = m[2] || "";
  if (!base64) return { error: "Data URL has no payload" };
  if (!isLikelyBase64(base64)) return { error: "Payload does not look like base64" };
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const sizeBytes = Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
  const extension = extensionForMime(mime);
  return { mime, base64, sizeBytes, extension };
}

/** Suggest a filename extension for a given MIME type. */
export function extensionForMime(mime: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/bmp": "bmp",
    "image/svg+xml": "svg",
  };
  return map[mime.toLowerCase()] || "bin";
}

/** Heuristic: a string that's mostly base64 alphabet characters. */
export function isLikelyBase64(s: string): boolean {
  const cleaned = s.replace(/=+$/, "");
  if (cleaned.length === 0) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(cleaned);
}

/** Build a suggested filename from a base name + extension. */
export function suggestFilename(base: string, extension: string): string {
  const safeBase = (base || "image").replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 32) || "image";
  const safeExt = extension.replace(/[^a-zA-Z0-9]/g, "") || "bin";
  return `${safeBase}.${safeExt}`;
}
