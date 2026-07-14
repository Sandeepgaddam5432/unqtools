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

// ===== v8.1 upgrade — blueprint features + 10 extras =====

// ===== Size warning (blueprint feature) =====

export interface SizeWarning {
  severity: "info" | "warning" | "error";
  message: string;
  recommendation: string;
}

/** Check if a data URL is too large for safe use. */
export function checkDataUrlSize(url: string): SizeWarning | null {
  const len = url.length;
  if (len > 2 * 1024 * 1024) {
    return {
      severity: "error",
      message: `Data URL is ${formatBytes(len)} — exceeds the 2MB browser limit.`,
      recommendation: "Use object URLs (URL.createObjectURL) instead, or split the file.",
    };
  }
  if (len > 100 * 1024) {
    return {
      severity: "warning",
      message: `Data URL is ${formatBytes(len)} — bloats HTML/CSS and can't be cached separately.`,
      recommendation: "Consider serving as a separate file for better caching and performance.",
    };
  }
  if (len > 10 * 1024) {
    return {
      severity: "info",
      message: `Data URL is ${formatBytes(len)} — acceptable for inlining but monitor size.`,
      recommendation: "Fine for small assets. Avoid for large files.",
    };
  }
  return null;
}

// ===== SVG optimization (blueprint feature) =====

/** Optimize a data URL for SVGs — use plain encoding when smaller than base64. */
export function optimizeSvgDataUrl(svgText: string): { url: string; encoding: "base64" | "plain"; savings: number } {
  // Try both encodings and pick the smaller one
  const bytes = new TextEncoder().encode(svgText);
  const base64Url = encodeBytes(bytes, "image/svg+xml");
  const plainUrl = encodeBytesPlain(bytes, "image/svg+xml");
  if (plainUrl.length < base64Url.length) {
    return {
      url: plainUrl,
      encoding: "plain",
      savings: base64Url.length - plainUrl.length,
    };
  }
  return {
    url: base64Url,
    encoding: "base64",
    savings: 0,
  };
}

// ===== Copy-as-img-tag (blueprint feature) =====

/** Generate an <img> tag with the data URL embedded. */
export function toImgTag(url: string, alt: string = "", width?: number, height?: number): string {
  const attrs: string[] = [`src="${url}"`];
  if (alt) attrs.push(`alt="${alt.replace(/"/g, "&quot;")}"`);
  if (width) attrs.push(`width="${width}"`);
  if (height) attrs.push(`height="${height}"`);
  return `<img ${attrs.join(" ")} />`;
}

/** Generate a CSS background-image rule with the data URL. */
export function toCssBackground(url: string, selector: string = ".element"): string {
  return `${selector} {\n  background-image: url("${url}");\n}`;
}

/** Generate a <link> tag for favicon use. */
export function toFaviconLink(url: string): string {
  return `<link rel="icon" type="${getMimeType(url) || "image/x-icon"}" href="${url}" />`;
}

// ===== Extra #1: History =====

const DATAURL_HISTORY_KEY = "unqtools-dataurl-history";
const MAX_DATAURL_HISTORY = 20;

export interface DataUrlHistoryEntry {
  url: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export function loadDataUrlHistory(): DataUrlHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(DATAURL_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_DATAURL_HISTORY);
  } catch {
    return [];
  }
}

export function saveDataUrlToHistory(url: string): DataUrlHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const mimeType = getMimeType(url) ?? "unknown";
  const size = getDataUrlSize(url);
  const entry: DataUrlHistoryEntry = { url, mimeType, size, createdAt: new Date().toISOString() };
  // Don't store the full URL if it's huge — just metadata
  if (url.length > 10000) {
    entry.url = url.slice(0, 100) + "...(truncated)";
  }
  const current = loadDataUrlHistory().filter((e) => e.url !== entry.url);
  const updated = [entry, ...current].slice(0, MAX_DATAURL_HISTORY);
  try { localStorage.setItem(DATAURL_HISTORY_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function clearDataUrlHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(DATAURL_HISTORY_KEY); } catch {}
}

// ===== Extra #2: Batch encode (multiple files → JSON) =====

export interface BatchEncodeResult {
  filename: string;
  mimeType: string;
  dataUrl: string;
  size: number;
}

/** Encode multiple files into data URLs and return as a batch result. */
export async function batchEncodeFiles(files: File[]): Promise<BatchEncodeResult[]> {
  const results: BatchEncodeResult[] = [];
  for (const file of files) {
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const url = encodeBytes(bytes, file.type || "application/octet-stream");
      results.push({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        dataUrl: url,
        size: bytes.length,
      });
    } catch {
      // skip invalid
    }
  }
  return results;
}

/** Convert batch results to a JSON file for download. */
export function batchToJson(results: BatchEncodeResult[]): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    count: results.length,
    files: results,
  }, null, 2);
}

// ===== Extra #3: Decode to blob (for download) =====

/** Convert a data URL to a Blob object (for downloading the decoded file). */
export function dataUrlToBlob(url: string): Blob | null {
  const parsed = parseDataUrl(url);
  if (!parsed.isValid) return null;
  const bytes = new TextEncoder().encode(parsed.data);
  return new Blob([bytes as BlobPart], { type: parsed.mimeType || "application/octet-stream" });
}

// ===== Extra #4: Data URL comparison =====

export interface DataUrlDiff {
  field: string;
  left: string;
  right: string;
  same: boolean;
}

/** Compare two data URLs field-by-field. */
export function compareDataUrls(left: string, right: string): DataUrlDiff[] {
  const lp = parseDataUrl(left);
  const rp = parseDataUrl(right);
  if (!lp.isValid || !rp.isValid) {
    return [{ field: "raw", left, right, same: left === right }];
  }
  return [
    { field: "mimeType", left: lp.mimeType, right: rp.mimeType, same: lp.mimeType === rp.mimeType },
    { field: "isBase64", left: String(lp.isBase64), right: String(rp.isBase64), same: lp.isBase64 === rp.isBase64 },
    { field: "data", left: lp.data.slice(0, 100), right: rp.data.slice(0, 100), same: lp.data === rp.data },
    { field: "size", left: String(lp.data.length), right: String(rp.data.length), same: lp.data.length === rp.data.length },
  ];
}

// ===== Extra #5: Embed in HTML/CSS/JSON templates =====

export interface EmbedTemplate {
  name: string;
  language: string;
  code: string;
}

/** Generate code snippets for embedding a data URL in different contexts. */
export function generateEmbedTemplates(url: string, filename: string = "file"): EmbedTemplate[] {
  const mime = getMimeType(url) ?? "application/octet-stream";
  const isImage = mime.startsWith("image/");
  const isSvg = mime === "image/svg+xml";
  return [
    {
      name: "HTML <img>",
      language: "html",
      code: toImgTag(url, filename),
    },
    {
      name: "CSS background",
      language: "css",
      code: toCssBackground(url),
    },
    {
      name: "HTML <link> favicon",
      language: "html",
      code: toFaviconLink(url),
    },
    {
      name: "JS string",
      language: "javascript",
      code: `const dataUrl = "${url}";`,
    },
    {
      name: "JSON value",
      language: "json",
      code: JSON.stringify({ dataUrl: url }, null, 2),
    },
    ...(isSvg ? [{
      name: "HTML inline SVG",
      language: "html",
      code: parseDataUrl(url).data,
    }] : []),
    ...(isImage ? [{
      name: "Markdown image",
      language: "markdown",
      code: `![${filename}](${url})`,
    }] : []),
  ];
}

// ===== Extra #6: Validate data URL =====

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/** Thoroughly validate a data URL. */
export function validateDataUrlDeep(url: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const parsed = parseDataUrl(url);
  if (!parsed.isValid) {
    errors.push(parsed.error ?? "Invalid data URL");
    return { isValid: false, errors, warnings };
  }
  // Size check
  const sizeWarn = checkDataUrlSize(url);
  if (sizeWarn) {
    if (sizeWarn.severity === "error") errors.push(sizeWarn.message);
    else warnings.push(sizeWarn.message);
  }
  // MIME type check
  if (!parsed.mimeType) {
    warnings.push("No MIME type specified — defaults to text/plain.");
  }
  // Sniffing risk
  const sniff = checkSniffingRisk(parsed.mimeType);
  if (sniff) warnings.push(sniff.message);
  return { isValid: errors.length === 0, errors, warnings };
}

// ===== Extra #7: Sniffing risk (re-use from logic) =====
// (already defined as checkSniffingRisk — wait, that's in mime-type-lookup)
// Let me define a simple version here:

export function checkSniffingRisk(mimeType: string): { severity: "medium"; message: string; recommendation: string } | null {
  if (mimeType === "application/octet-stream") {
    return {
      severity: "medium",
      message: "Generic binary type — browsers may sniff the actual type.",
      recommendation: "Use a specific MIME type if known. Send X-Content-Type-Options: nosniff.",
    };
  }
  return null;
}

// ===== Extra #8: Size calculator (before encoding) =====

export interface SizeEstimate {
  inputBytes: number;
  base64UrlBytes: number;
  plainUrlBytes: number;
  overhead: number;        // base64 overhead percentage
  recommendation: "base64" | "plain";
}

/** Estimate the size of a data URL before encoding. */
export function estimateDataUrlSize(inputBytes: number, mimeType: string): SizeEstimate {
  const base64Bytes = Math.ceil(inputBytes * 4 / 3) + mimeType.length + 20; // overhead for "data:...;base64,"
  const plainBytes = inputBytes * 3 + mimeType.length + 10; // worst case URL-encoding (3x for non-ASCII)
  const overhead = Math.round((base64Bytes / inputBytes - 1) * 100);
  return {
    inputBytes,
    base64UrlBytes: base64Bytes,
    plainUrlBytes: plainBytes,
    overhead,
    recommendation: base64Bytes < plainBytes ? "base64" : "plain",
  };
}

// ===== Extra #9: Drag-drop file detection =====

export interface FileInfo {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

/** Extract file info from a dropped File object. */
export function getFileInfo(file: File): FileInfo {
  return {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
  };
}

// ===== Extra #10: Shareable URL =====

export function buildDataUrlShareUrl(url: string): string {
  if (typeof window === "undefined") return "";
  // Data URLs can be very long — only share if small enough
  if (url.length > 2000) return "";
  return `${window.location.origin}${window.location.pathname}#dataurl=${encodeURIComponent(url)}`;
}

export function extractDataUrlFromFragment(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash) return null;
  const match = hash.match(/[#&]dataurl=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
