/**
 * Empty File Creator — pure logic for generating dummy files, parsing sizes,
 * filling patterns, and templating filenames.
 */

export type FillPattern = "zeros" | "random" | "0xff" | "sequential";
export type SizeUnit = "B" | "KB" | "MB" | "GB";

export interface CreateOptions {
  size: number;
  unit: SizeUnit;
  pattern: FillPattern;
  extension: string;
  filenameTemplate: string; // supports {n} placeholder
  startIndex: number;
  padWidth: number; // for {n} padding (e.g. 3 → "001")
}

export const DEFAULT_OPTIONS: CreateOptions = {
  size: 1,
  unit: "KB",
  pattern: "zeros",
  extension: "bin",
  filenameTemplate: "file-{n}",
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

/** Apply a fill pattern to a Uint8Array. Returns the same array, modified in place. */
export function fillBytes(bytes: Uint8Array, pattern: FillPattern): Uint8Array {
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
    case "random":
      // crypto.getRandomValues works in both browser + Node
      const crypto = globalThis.crypto;
      if (crypto && crypto.getRandomValues) {
        // chunk to avoid stack overflow on very large arrays
        const CHUNK = 65536;
        for (let i = 0; i < bytes.length; i += CHUNK) {
          crypto.getRandomValues(bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
        }
      } else {
        // Fallback to Math.random
        for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
      }
      return bytes;
    default:
      return bytes;
  }
}

/** Generate a Uint8Array of the given size filled with the pattern. */
export function generateBytes(size: number, pattern: FillPattern): Uint8Array {
  const bytes = new Uint8Array(size);
  return fillBytes(bytes, pattern);
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

export interface GeneratedFile {
  filename: string;
  bytes: Uint8Array;
  size: number;
  pattern: FillPattern;
  previewHex: string; // first 64 bytes as hex
}

/** Generate a single file with the given options and index. */
export function generateFile(options: CreateOptions, index: number): GeneratedFile {
  const size = toBytes(options.size, options.unit);
  const bytes = generateBytes(size, options.pattern);
  const name = renderTemplate(options.filenameTemplate, index, options.padWidth);
  const filename = ensureExtension(name, options.extension);
  const previewHex = bytesToHex(bytes.slice(0, 64));
  return { filename, bytes, size, pattern: options.pattern, previewHex };
}

/** Generate multiple files (batch). */
export function generateBatch(options: CreateOptions, count: number): GeneratedFile[] {
  const out: GeneratedFile[] = [];
  for (let i = 0; i < count; i++) {
    out.push(generateFile(options, options.startIndex + i));
  }
  return out;
}

/** Convert bytes to lowercase hex string. */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Format the preview hex as a multi-row dump (8 bytes per row). */
export function formatHexPreview(hex: string, bytesPerRow: number = 16): string {
  const bytes = hex.match(/.{1,2}/g) || [];
  const lines: string[] = [];
  for (let i = 0; i < bytes.length; i += bytesPerRow) {
    lines.push(bytes.slice(i, i + bytesPerRow).join(" "));
  }
  return lines.join("\n");
}

/** Build the shareable URL fragment (settings only, never file data). */
export function buildShareFragment(options: CreateOptions, count: number): string {
  const params = new URLSearchParams({
    size: String(options.size),
    unit: options.unit,
    pattern: options.pattern,
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
  return `${window.location.origin}/tools/empty-file-creator#${buildShareFragment(options, count)}`;
}

/** Parse a shareable URL fragment back into options + count. */
export function parseShareUrl(hash: string): { options: Partial<CreateOptions>; count: number } | null {
  if (!hash) return null;
  const cleaned = hash.replace(/^#/, "");
  const params = new URLSearchParams(cleaned);
  if (params.toString() === "") return null;
  const options: Partial<CreateOptions> = {};
  if (params.has("size")) options.size = parseInt(params.get("size")!, 10);
  if (params.has("unit")) options.unit = params.get("unit") as SizeUnit;
  if (params.has("pattern")) options.pattern = params.get("pattern") as FillPattern;
  if (params.has("ext")) options.extension = params.get("ext")!;
  if (params.has("template")) options.filenameTemplate = params.get("template")!;
  if (params.has("start")) options.startIndex = parseInt(params.get("start")!, 10);
  if (params.has("pad")) options.padWidth = parseInt(params.get("pad")!, 10);
  const count = params.has("count") ? parseInt(params.get("count")!, 10) : 1;
  return { options, count };
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
      previewHex: f.previewHex,
    })),
  }, null, 2);
}

/** Create a File object from a GeneratedFile (for download). */
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

// ===== History (localStorage) =====
const HISTORY_KEY = "unqtools-empty-file-creator-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  count: number;
  totalSize: number;
  pattern: FillPattern;
  extension: string;
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
