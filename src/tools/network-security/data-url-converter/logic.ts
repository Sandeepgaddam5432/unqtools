/**
 * Data URL Converter — pure logic.
 *
 * Pure functions for encoding/decoding data: URLs (RFC 2397). File reading
 * (FileReader API) is left to the UI layer; this module only handles the
 * string transformations.
 *
 * Data URL format: data:[<mediatype>][;base64],<data>
 */

export interface ParsedDataUrl {
  mimeType: string;        // e.g. "image/png" — defaults to "text/plain"
  isBase64: boolean;
  data: string;            // raw data (decoded if base64)
  isValid: boolean;
  error?: string;
}

/** Encode a string as a base64 data URL. */
export function encodeText(text: string, mimeType: string = "text/plain"): string {
  if (typeof text !== "string") throw new Error("Text must be a string.");
  if (!mimeType) mimeType = "text/plain";
  // Use UTF-8 safe base64 encoding
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 = btoa(binary);
  return `data:${mimeType};base64,${base64}`;
}

/** Encode raw bytes (Uint8Array) as a base64 data URL. */
export function encodeBytes(bytes: Uint8Array, mimeType: string = "application/octet-stream"): string {
  if (!(bytes instanceof Uint8Array)) throw new Error("Bytes must be a Uint8Array.");
  if (!mimeType) mimeType = "application/octet-stream";
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 = btoa(binary);
  return `data:${mimeType};base64,${base64}`;
}

/** Encode raw bytes as a plain (non-base64) data URL. Useful for SVG/text. */
export function encodeBytesPlain(bytes: Uint8Array, mimeType: string = "text/plain"): string {
  if (!(bytes instanceof Uint8Array)) throw new Error("Bytes must be a Uint8Array.");
  if (!mimeType) mimeType = "text/plain";
  const text = new TextDecoder("utf-8").decode(bytes);
  // URL-encode special characters
  const encoded = encodeURIComponent(text);
  return `data:${mimeType},${encoded}`;
}

/** Validate the structure of a data URL. Returns null if valid, error message otherwise. */
export function validateDataUrl(url: string): string | null {
  if (!url || typeof url !== "string") return "URL is empty.";
  if (!url.startsWith("data:")) return "URL must start with 'data:'.";
  const commaIdx = url.indexOf(",");
  if (commaIdx < 0) return "Missing comma separator before data.";
  if (commaIdx === 5) return "Missing metadata before comma."; // "data:,"
  return null;
}

/** Parse a data URL into its components. Never throws. */
export function parseDataUrl(url: string): ParsedDataUrl {
  const err = validateDataUrl(url);
  if (err) {
    return {
      mimeType: "",
      isBase64: false,
      data: "",
      isValid: false,
      error: err,
    };
  }

  // Strip "data:" prefix
  const withoutPrefix = url.slice(5);
  const commaIdx = withoutPrefix.indexOf(",");
  const meta = withoutPrefix.slice(0, commaIdx);
  const data = withoutPrefix.slice(commaIdx + 1);

  // meta format: [mimetype][;base64]
  // e.g. "image/png;base64" or "text/plain" or ";base64" or ""
  let mimeType = "text/plain";
  let isBase64 = false;

  if (meta) {
    const parts = meta.split(";");
    // The first part (if not "base64") is the MIME type
    if (parts[0] && parts[0] !== "base64") {
      mimeType = parts[0];
    }
    if (parts.includes("base64")) {
      isBase64 = true;
    }
  }

  let decodedData: string;
  if (isBase64) {
    try {
      // Use atob for base64 decode, then convert to UTF-8
      const binary = atob(data);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      decodedData = new TextDecoder("utf-8").decode(bytes);
    } catch (e) {
      return {
        mimeType,
        isBase64,
        data: "",
        isValid: false,
        error: `Invalid base64 data: ${(e as Error).message}`,
      };
    }
  } else {
    // URL-encoded text
    try {
      decodedData = decodeURIComponent(data);
    } catch (e) {
      return {
        mimeType,
        isBase64,
        data: data, // return raw
        isValid: true, // still valid, just couldn't decode
        error: `Could not URL-decode: ${(e as Error).message}`,
      };
    }
  }

  return {
    mimeType,
    isBase64,
    data: decodedData,
    isValid: true,
  };
}

/** Get the file size (in bytes) of the data in a data URL. */
export function getDataUrlSize(url: string): number {
  const parsed = parseDataUrl(url);
  if (!parsed.isValid) return 0;
  return new TextEncoder().encode(parsed.data).length;
}

/** Get the URL length (useful for showing how big the data URL is). */
export function getUrlLength(url: string): number {
  return url.length;
}

/** Format bytes as human-readable. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Detect MIME type from a data URL. */
export function getMimeType(url: string): string | null {
  const parsed = parseDataUrl(url);
  return parsed.isValid ? parsed.mimeType : null;
}

/** Check if a data URL is binary (image, audio, video, etc.). */
export function isBinaryMimeType(mimeType: string): boolean {
  if (!mimeType) return false;
  return (
    mimeType.startsWith("image/") ||
    mimeType.startsWith("audio/") ||
    mimeType.startsWith("video/") ||
    mimeType.startsWith("font/") ||
    mimeType === "application/octet-stream" ||
    mimeType.startsWith("application/pdf") ||
    mimeType.startsWith("application/zip") ||
    mimeType.startsWith("application/x-")
  );
}

/** Suggest a file extension from a MIME type. */
export function suggestExtension(mimeType: string): string {
  if (!mimeType) return "bin";
  const map: Record<string, string> = {
    "text/plain": "txt",
    "text/html": "html",
    "text/css": "css",
    "text/javascript": "js",
    "text/csv": "csv",
    "text/xml": "xml",
    "text/markdown": "md",
    "text/yaml": "yaml",
    "application/json": "json",
    "application/xml": "xml",
    "application/pdf": "pdf",
    "application/zip": "zip",
    "application/gzip": "gz",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
    "image/bmp": "bmp",
    "image/x-icon": "ico",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "font/woff": "woff",
    "font/woff2": "woff2",
    "font/ttf": "ttf",
    "font/otf": "otf",
  };
  return map[mimeType] ?? "bin";
}
