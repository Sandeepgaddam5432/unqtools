/**
 * Image to Base64 — pure logic. No DOM access.
 */

export type ImageMime = "image/png" | "image/jpeg" | "image/webp" | "image/gif" | "image/bmp" | "image/svg+xml";

/** Detect MIME type from filename extension. */
export function detectMime(filename: string): ImageMime | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return null;
}

export interface Base64Result {
  dataUrl: string;
  /** Raw base64 without the data: prefix. */
  raw: string;
  mime: string;
  /** Approximate byte size of the decoded data. */
  sizeBytes: number;
}

/** Parse a data URL into its parts. */
export function parseDataUrl(dataUrl: string): { mime: string; raw: string; sizeBytes: number } | { error: string } {
  const m = /^data:([^;,]+)(?:;base64)?,(.*)$/i.exec(dataUrl.trim());
  if (!m) return { error: "Not a valid data URL" };
  const mime = m[1] || "application/octet-stream";
  const raw = m[2] || "";
  // Decoded byte size estimate (4 base64 chars = 3 bytes, minus padding).
  const padding = raw.endsWith("==") ? 2 : raw.endsWith("=") ? 1 : 0;
  const sizeBytes = Math.max(0, Math.floor((raw.length * 3) / 4) - padding);
  return { mime, raw, sizeBytes };
}

/** Build a Base64Result from a raw base64 string + mime. */
export function buildBase64Result(raw: string, mime: string): Base64Result {
  const dataUrl = `data:${mime};base64,${raw}`;
  const padding = raw.endsWith("==") ? 2 : raw.endsWith("=") ? 1 : 0;
  const sizeBytes = Math.max(0, Math.floor((raw.length * 3) / 4) - padding);
  return { dataUrl, raw, mime, sizeBytes };
}

/** Format byte count as a human-readable string. */
export function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
