/**
 * Large File Generator — pure logic for size parsing, pattern generation,
 * file creation, and templating.
 *
 * Pure functions only — no React, no DOM access. The UI layer handles progress.
 */

export type FillPattern = "zeros" | "random" | "0xff" | "sequential" | "text";
export type SizeUnit = "B" | "KB" | "MB" | "GB";

export interface CreateOptions {
  size: number;
  unit: SizeUnit;
  pattern: FillPattern;
  /** For pattern='text': the text to repeat. */
  text: string;
  extension: string;
  filenameTemplate: string; // supports {n} placeholder
  startIndex: number;
  padWidth: number; // for {n} padding (e.g. 3 → "001")
}

export const DEFAULT_OPTIONS: CreateOptions = {
  size: 10,
  unit: "MB",
  pattern: "zeros",
  text: "The quick brown fox jumps over the lazy dog. ",
  extension: "bin",
  filenameTemplate: "largefile-{n}",
  startIndex: 1,
  padWidth: 3,
};

export const SIZE_PRESETS: Array<{ label: string; size: number; unit: SizeUnit; bytes: number }> = [
  { label: "1 KB", size: 1, unit: "KB", bytes: 1024 },
  { label: "100 KB", size: 100, unit: "KB", bytes: 100 * 1024 },
  { label: "1 MB", size: 1, unit: "MB", bytes: 1024 * 1024 },
  { label: "10 MB", size: 10, unit: "MB", bytes: 10 * 1024 * 1024 },
  { label: "100 MB", size: 100, unit: "MB", bytes: 100 * 1024 * 1024 },
  { label: "1 GB", size: 1, unit: "GB", bytes: 1024 * 1024 * 1024 },
];

export const UNIT_MULTIPLIERS: Record<SizeUnit, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
};

/** Convert a size + unit to absolute bytes. */
export function toBytes(size: number, unit: SizeUnit): number {
  return Math.floor(size * UNIT_MULTIPLIERS[unit]);
}

/** Parse a size string like "1.5 MB" or "100KB" into bytes. */
export function parseSizeString(input: string): number | null {
  const match = input.trim().match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)?$/i);
  if (!match) return null;
  const size = parseFloat(match[1]);
  const unit = (match[2] ?? "B").toUpperCase() as SizeUnit;
  return toBytes(size, unit);
}

/** Format bytes as human-readable. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Format milliseconds as human-readable. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)} s`;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

/**
 * Fill a Uint8Array with the given pattern. Returns the same array, modified in place.
 * The chunkSize parameter is used for chunked random generation (caller controls).
 */
export function fillBytes(bytes: Uint8Array, pattern: FillPattern, text: string = ""): Uint8Array {
  switch (pattern) {
    case "zeros":
      bytes.fill(0);
      return bytes;
    case "0xff":
      bytes.fill(0xff);
      return bytes;
    case "sequential":
      for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;
      return bytes;
    case "text": {
      const encoded = new TextEncoder().encode(text || "x");
      if (encoded.length === 0) return bytes;
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = encoded[i % encoded.length];
      }
      return bytes;
    }
    case "random": {
      const crypto = globalThis.crypto;
      if (crypto && crypto.getRandomValues) {
        const CHUNK = 65536;
        for (let i = 0; i < bytes.length; i += CHUNK) {
          crypto.getRandomValues(bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
        }
      } else {
        for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
      }
      return bytes;
    }
    default:
      return bytes;
  }
}

/**
 * Generate a Uint8Array of the given size filled with the pattern.
 * Calls onProgress(percent 0-100) if provided.
 */
export function generateBytes(
  size: number,
  pattern: FillPattern,
  text: string = "",
  onProgress?: (percent: number) => void,
): Uint8Array {
  const bytes = new Uint8Array(size);
  // For patterns that can be chunked, call onProgress
  if (pattern === "random" || pattern === "sequential") {
    const CHUNK = 1024 * 1024; // 1MB chunks for progress reporting
    for (let i = 0; i < size; i += CHUNK) {
      const end = Math.min(i + CHUNK, size);
      fillBytes(bytes.subarray(i, end), pattern, text);
      if (onProgress) onProgress(Math.round((end / size) * 100));
    }
  } else {
    fillBytes(bytes, pattern, text);
    if (onProgress) onProgress(100);
  }
  return bytes;
}

/** Render a filename template, replacing {n} with a padded index. */
export function renderTemplate(template: string, index: number, padWidth: number): string {
  const padded = padWidth > 0 ? String(index).padStart(padWidth, "0") : String(index);
  return template.replace(/\{n\}/g, padded);
}

/** Append extension if not present in the name. */
export function ensureExtension(filename: string, extension: string): string {
  if (!extension) return filename;
  const ext = extension.startsWith(".") ? extension.slice(1) : extension;
  if (filename.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) return filename;
  return `${filename}.${ext}`;
}

/** Convert bytes to lowercase hex string. */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Format the preview hex as a multi-row dump. */
export function formatHexPreview(hex: string, bytesPerRow: number = 16): string {
  const bytes = hex.match(/.{1,2}/g) || [];
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += bytesPerRow) {
    lines.push(bytes.slice(i, i + bytesPerRow).join(" "));
  }
  return lines.join("\n");
}

export interface GeneratedFile {
  filename: string;
  bytes: Uint8Array;
  size: number;
  pattern: FillPattern;
  previewHex: string; // first 64 bytes as hex
  durationMs: number; // how long it took to generate
}

/** Generate a single file with the given options and index. */
export function generateFile(
  options: CreateOptions,
  index: number,
  onProgress?: (percent: number) => void,
): GeneratedFile {
  const size = toBytes(options.size, options.unit);
  const start = Date.now();
  const bytes = generateBytes(size, options.pattern, options.text, onProgress);
  const durationMs = Date.now() - start;
  const name = renderTemplate(options.filenameTemplate, index, options.padWidth);
  const filename = ensureExtension(name, options.extension);
  const previewHex = bytesToHex(bytes.slice(0, 64));
  return { filename, bytes, size, pattern: options.pattern, previewHex, durationMs };
}

/**
 * Generate multiple files (batch). onProgress(percent, fileIndex, fileTotal).
 * Note: the UI typically calls generateFile one at a time with await-able delays
 * to keep the browser responsive. This function is for tests / small batches.
 */
export function generateBatch(
  options: CreateOptions,
  count: number,
  onProgress?: (percent: number, fileIndex: number, fileTotal: number) => void,
): GeneratedFile[] {
  const out: GeneratedFile[] = [];
  for (let i = 0; i < count; i++) {
    const file = generateFile(options, options.startIndex + i, (p) => {
      if (onProgress) onProgress(p, i, count);
    });
    out.push(file);
  }
  return out;
}

/** Serialize file info to a JSON string (for copy-to-clipboard / history). */
export function fileInfoToJson(files: GeneratedFile[]): string {
  return JSON.stringify({
    count: files.length,
    totalSize: files.reduce((s, f) => s + f.size, 0),
    files: files.map((f) => ({
      filename: f.filename,
      size: f.size,
      sizeHuman: formatBytes(f.size),
      pattern: f.pattern,
      durationMs: f.durationMs,
      previewHex: f.previewHex,
    })),
  }, null, 2);
}

/** Create a Blob from a GeneratedFile (for download). */
export function toBlob(file: GeneratedFile): Blob {
  return new Blob([file.bytes], { type: "application/octet-stream" });
}

/** Trigger a browser download for a generated file. */
export function downloadFile(file: GeneratedFile): void {
  const blob = toBlob(file);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Build the shareable URL fragment (settings only, never file data). */
export function buildShareFragment(options: CreateOptions, count: number): string {
  const params = new URLSearchParams({
    size: String(options.size),
    unit: options.unit,
    pattern: options.pattern,
    text: options.text,
    ext: options.extension,
    template: options.filenameTemplate,
    start: String(options.startIndex),
    pad: String(options.padWidth),
    count: String(count),
  });
  return params.toString();
}

/** Build a shareable URL with the options encoded (no file data). */
export function buildShareUrl(options: CreateOptions, count: number): string {
  if (typeof window === "undefined") return `#${buildShareFragment(options, count)}`;
  return `${window.location.origin}/tools/large-file-generator#${buildShareFragment(options, count)}`;
}

/** Parse a shareable URL fragment back into options + count. */
export function parseShareUrl(hash: string): { options: Partial<CreateOptions>; count: number } | null {
  if (!hash) return null;
  const cleaned = hash.replace(/^#/, "");
  const params = new URLSearchParams(cleaned);
  if (params.toString() === "") return null;
  const options: Partial<CreateOptions> = {};
  if (params.has("size")) options.size = parseFloat(params.get("size")!);
  if (params.has("unit")) options.unit = params.get("unit") as SizeUnit;
  if (params.has("pattern")) options.pattern = params.get("pattern") as FillPattern;
  if (params.has("text")) options.text = params.get("text")!;
  if (params.has("ext")) options.extension = params.get("ext")!;
  if (params.has("template")) options.filenameTemplate = params.get("template")!;
  if (params.has("start")) options.startIndex = parseInt(params.get("start")!, 10);
  if (params.has("pad")) options.padWidth = parseInt(params.get("pad")!, 10);
  const count = params.has("count") ? parseInt(params.get("count")!, 10) : 1;
  return { options, count };
}

// ===== History (localStorage) =====
const HISTORY_KEY = "unqtools-large-file-generator-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  count: number;
  totalSize: number;
  pattern: FillPattern;
  extension: string;
  durationMs: number;
  createdAt: string;
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
