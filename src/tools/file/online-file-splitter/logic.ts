/**
 * File Splitter — pure logic for file splitting, HJSplit naming, and
 * checksum (CRC32 + SHA-256) manifest generation.
 *
 * Pure functions only — no React, no DOM access. UI handles progress + download.
 */

export type SizeUnit = "B" | "KB" | "MB" | "GB";
export type SplitMode = "partSize" | "partCount";

export interface SplitOptions {
  mode: SplitMode;
  /** For mode='partSize': target bytes per part. */
  partSize: number;
  /** For mode='partCount': number of parts. */
  partCount: number;
  /** Custom naming template. Supports {base}, {n}, {index}. */
  template: string;
  /** Pad width for the part number (default 3 → 001, 002). */
  padWidth: number;
}

export const DEFAULT_OPTIONS: SplitOptions = {
  mode: "partSize",
  partSize: 1024 * 1024, // 1MB
  partCount: 2,
  template: "{base}.{n}",
  padWidth: 3,
};

export const UNIT_MULTIPLIERS: Record<SizeUnit, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
};

export const PART_SIZE_PRESETS: Array<{ label: string; bytes: number }> = [
  { label: "100 KB", bytes: 100 * 1024 },
  { label: "1 MB", bytes: 1024 * 1024 },
  { label: "10 MB", bytes: 10 * 1024 * 1024 },
  { label: "50 MB", bytes: 50 * 1024 * 1024 },
  { label: "100 MB", bytes: 100 * 1024 * 1024 },
  { label: "500 MB", bytes: 500 * 1024 * 1024 },
  { label: "1 GB", bytes: 1024 * 1024 * 1024 },
];

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

/** Strip extension from a filename. */
export function stripExtension(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i > 0 ? filename.slice(0, i) : filename;
}

/** Sanitize a string for use as a filename (alphanumeric + dash + underscore). */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9\-_.]/g, "_");
}

/** Compute the number of parts given a file size + options. */
export function computePartCount(fileSize: number, options: SplitOptions): number {
  if (options.mode === "partCount") {
    return Math.max(1, Math.floor(options.partCount));
  }
  // partSize mode
  if (options.partSize <= 0) return 1;
  return Math.max(1, Math.ceil(fileSize / options.partSize));
}

/** Compute the actual byte size of a given part (last part may be smaller). */
export function computePartByteSize(fileSize: number, partIndex: number, partCount: number, partSize: number): number {
  if (partIndex < 0 || partIndex >= partCount) return 0;
  const start = partIndex * partSize;
  const end = Math.min(start + partSize, fileSize);
  return Math.max(0, end - start);
}

/** Generate HJSplit-style part filename. */
export function partFilename(template: string, baseName: string, partIndex: number, padWidth: number): string {
  const padded = String(partIndex + 1).padStart(padWidth, "0");
  return template
    .replace(/\{base\}/g, baseName)
    .replace(/\{index\}/g, padded)
    .replace(/\{n\}/g, padded);
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

/** Simple CRC32 implementation (returns 8-char lowercase hex). */
export function crc32(data: Uint8Array): string {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}

/** SHA-256 hash using WebCrypto (returns 64-char lowercase hex). */
export async function sha256(data: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("WebCrypto not available");
  const digest = await subtle.digest("SHA-256", data as BufferSource);
  return bytesToHex(new Uint8Array(digest));
}

export interface PartInfo {
  /** Filename for this part (e.g. "myfile.001"). */
  filename: string;
  /** 1-based part number (matches the extension number). */
  partNumber: number;
  /** Byte offset in the source file. */
  start: number;
  /** Byte size of this part. */
  size: number;
  /** CRC32 hex (8 chars). */
  crc32: string;
  /** SHA-256 hex (64 chars). */
  sha256: string;
  /** First 16 bytes as hex for preview. */
  previewHex: string;
  /** The actual bytes (for in-memory splits — UI may swap with Blob slice). */
  bytes: Uint8Array;
}

export interface SplitResult {
  baseName: string;
  parts: PartInfo[];
  totalSize: number;
  partCount: number;
  partSize: number;
  lastPartSize: number;
  manifest: string;
}

/**
 * Split a Uint8Array into parts with checksums.
 */
export async function splitBytes(
  bytes: Uint8Array,
  baseName: string,
  options: SplitOptions,
  onProgress?: (percent: number, partIndex: number, partCount: number) => void,
): Promise<SplitResult> {
  const fileSize = bytes.length;
  const partCount = computePartCount(fileSize, options);
  const partSize = options.mode === "partCount"
    ? Math.ceil(fileSize / partCount)
    : options.partSize;
  const parts: PartInfo[] = [];

  for (let i = 0; i < partCount; i++) {
    const start = i * partSize;
    const end = Math.min(start + partSize, fileSize);
    const slice = bytes.slice(start, end);
    const filename = partFilename(options.template, baseName, i, options.padWidth);
    const crc = crc32(slice);
    const sha = await sha256(slice);
    parts.push({
      filename,
      partNumber: i + 1,
      start,
      size: slice.length,
      crc32: crc,
      sha256: sha,
      previewHex: bytesToHex(slice.slice(0, 16)),
      bytes: slice,
    });
    if (onProgress) onProgress(Math.round(((i + 1) / partCount) * 100), i, partCount);
  }

  const manifest = buildManifest(baseName, parts, fileSize, partSize);
  return {
    baseName,
    parts,
    totalSize: fileSize,
    partCount,
    partSize,
    lastPartSize: parts[parts.length - 1]?.size ?? 0,
    manifest,
  };
}

/** Build a SHA-256 + CRC32 manifest file (compatible with sha256sum format). */
export function buildManifest(baseName: string, parts: PartInfo[], totalSize: number, partSize: number): string {
  const lines: string[] = [];
  lines.push(`# UnQTools File Splitter manifest`);
  lines.push(`# Original file: ${baseName}`);
  lines.push(`# Total size: ${totalSize} bytes (${formatBytes(totalSize)})`);
  lines.push(`# Part size: ${partSize} bytes (${formatBytes(partSize)})`);
  lines.push(`# Parts: ${parts.length}`);
  lines.push(`# Format: HJSplit-compatible (.001, .002, ...)`);
  lines.push(`#`);
  lines.push(`# sha256sum format: <hex>  <filename>`);
  lines.push(`# crc32 format:     crc32:<hex>  <filename>`);
  lines.push(``);
  for (const p of parts) {
    lines.push(`${p.sha256}  ${p.filename}`);
    lines.push(`crc32:${p.crc32}  ${p.filename}`);
  }
  lines.push(``);
  lines.push(`# To rejoin: use the UnQTools File Merger, or 7-Zip, or HJSplit.`);
  return lines.join("\n");
}

/** Build the manifest filename (e.g. "myfile.sha256"). */
export function manifestFilename(baseName: string): string {
  return `${baseName}.sha256`;
}

/** Generate merge instructions text for display. */
export function mergeInstructions(baseName: string, partCount: number): string {
  return [
    `To rejoin the ${partCount} part(s) of "${baseName}":`,
    ``,
    `Option 1 — UnQTools File Merger:`,
    `  Open the File Merger tool, drop all parts (.001, .002, ...), click Merge.`,
    ``,
    `Option 2 — 7-Zip:`,
    `  Right-click the .001 file → "7-Zip" → "Extract here".`,
    ``,
    `Option 3 — HJSplit (Windows/Mac/Linux):`,
    `  Open HJSplit → "Join" → select the .001 file → "Join".`,
    ``,
    `Option 4 — Command line (cat):`,
    `  cat ${baseName}.??? > ${baseName}`,
    ``,
    `Option 5 — Command line (with checksum verification):`,
    `  sha256sum -c ${baseName}.sha256 && cat ${baseName}.??? > ${baseName}`,
  ].join("\n");
}

/** Trigger a browser download for a part (Blob). */
export function downloadPart(part: PartInfo): void {
  const blob = new Blob([part.bytes], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = part.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Trigger a download for the manifest text. */
export function downloadManifest(baseName: string, manifest: string): void {
  const blob = new Blob([manifest], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = manifestFilename(baseName);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ===== History (localStorage) =====
const HISTORY_KEY = "unqtools-online-file-splitter-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  filename: string;
  totalSize: number;
  partCount: number;
  partSize: number;
  mode: SplitMode;
  splitAt: string;
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

/** Build a shareable URL with split options. */
export function buildShareUrl(options: SplitOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("mode", options.mode);
  params.set("size", String(options.partSize));
  params.set("count", String(options.partCount));
  params.set("tpl", options.template);
  params.set("pad", String(options.padWidth));
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

/** Parse a shareable URL hash back into options. */
export function parseShareUrl(hash: string): Partial<SplitOptions> | null {
  if (!hash) return null;
  const cleaned = hash.replace(/^#/, "");
  const params = new URLSearchParams(cleaned);
  if (params.toString() === "") return null;
  const options: Partial<SplitOptions> = {};
  if (params.has("mode")) options.mode = params.get("mode") as SplitMode;
  if (params.has("size")) options.partSize = parseInt(params.get("size")!, 10);
  if (params.has("count")) options.partCount = parseInt(params.get("count")!, 10);
  if (params.has("tpl")) options.template = params.get("tpl")!;
  if (params.has("pad")) options.padWidth = parseInt(params.get("pad")!, 10);
  return options;
}
