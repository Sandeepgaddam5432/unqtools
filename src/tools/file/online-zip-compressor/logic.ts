/**
 * ZIP Compressor — pure-JS ZIP writer (STORE method, no compression).
 *
 * Reuses the proven `createZipBlob` writer from `csv-to-excel-converter` for
 * the low-level ZIP structure (local file headers, central directory, EOCD).
 * This module wraps that with a higher-level API for managing a file list,
 * computing archive stats, and saving to history.
 *
 * ZIP format overview:
 *   [Local File Header 1][File Data 1]
 *   [Local File Header 2][File Data 2]
 *   ...
 *   [Central Directory Entry 1]
 *   [Central Directory Entry 2]
 *   ...
 *   [End of Central Directory Record (EOCD)]
 *
 * Every local file header (signature 0x04034b50) is 30 bytes + filename
 * length. The central directory entry (signature 0x02014b50) is 46 bytes +
 * filename length. The EOCD (signature 0x06054b50) is 22 bytes and contains
 * the file count, central dir size, and offset.
 */

import {
  createZipBlob as createZipBlobBase,
  type ZipFile,
} from "../csv-to-excel-converter/logic";

// ===== Types =====

export interface FileEntry {
  /** Internal unique id (used for React keys + reordering). */
  id: string;
  /** Filename inside the ZIP. May include path separators ('subdir/file.txt'). */
  name: string;
  /** Original file size (uncompressed). */
  size: number;
  /** Raw file bytes. */
  data: Uint8Array;
  /** MIME type detected from filename (informational only). */
  mime: string;
  /** When the file was added (ISO timestamp). */
  addedAt: string;
}

export interface ArchiveStats {
  fileCount: number;
  totalUncompressed: number;
  /** Archive size in bytes (for STORE method, this is roughly the sum of file
   *  sizes + per-file overhead of ~30 + name + 46 + name + 22 bytes EOCD). */
  archiveSize: number;
  /** Ratio of total uncompressed to archive size. For STORE method, this is
   *  typically < 1.0 (the archive is slightly larger due to header overhead). */
  ratio: number;
  /** Estimated archive size before building (sum of file sizes + overhead). */
  estimatedSize: number;
}

export interface ArchiveBuildResult {
  blob: Blob;
  fileName: string;
  stats: ArchiveStats;
}

// ===== File management =====

let idCounter = 0;
const nextId = (): string => {
  idCounter += 1;
  return `file-${Date.now()}-${idCounter}`;
};

/** Convert a browser File into a FileEntry. Reads the file's bytes. */
export async function fileToEntry(file: File): Promise<FileEntry> {
  const data = new Uint8Array(await file.arrayBuffer());
  return {
    id: nextId(),
    name: file.name || "unnamed",
    size: file.size,
    data,
    mime: file.type || detectMimeFromName(file.name),
    addedAt: new Date().toISOString(),
  };
}

/** Convert a list of browser Files into FileEntries. */
export async function filesToEntries(files: File[] | FileList): Promise<FileEntry[]> {
  const arr = Array.from(files);
  return Promise.all(arr.map(fileToEntry));
}

// ===== Reordering =====

/** Move a file up in the list (swap with previous). Returns new list. */
export function moveUp(entries: FileEntry[], id: string): FileEntry[] {
  const idx = entries.findIndex((e) => e.id === id);
  if (idx <= 0) return entries;
  const copy = [...entries];
  [copy[idx - 1]!, copy[idx]!] = [copy[idx]!, copy[idx - 1]!];
  return copy;
}

/** Move a file down in the list (swap with next). Returns new list. */
export function moveDown(entries: FileEntry[], id: string): FileEntry[] {
  const idx = entries.findIndex((e) => e.id === id);
  if (idx < 0 || idx >= entries.length - 1) return entries;
  const copy = [...entries];
  [copy[idx]!, copy[idx + 1]!] = [copy[idx + 1]!, copy[idx]!];
  return copy;
}

/** Remove a file from the list. */
export function removeEntry(entries: FileEntry[], id: string): FileEntry[] {
  return entries.filter((e) => e.id !== id);
}

/** Rename a file in the list. */
export function renameEntry(entries: FileEntry[], id: string, newName: string): FileEntry[] {
  return entries.map((e) => (e.id === id ? { ...e, name: newName } : e));
}

/** Detect duplicate filenames. Returns a Set of names that appear more than once. */
export function findDuplicates(entries: FileEntry[]): Set<string> {
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
  const dups = new Set<string>();
  for (const [name, count] of counts) if (count > 1) dups.add(name);
  return dups;
}

/** Sanitize filenames by stripping path separators (force flat archive). */
export function flattenNames(entries: FileEntry[]): FileEntry[] {
  return entries.map((e) => ({
    ...e,
    name: e.name.replace(/\\/g, "/").split("/").pop() ?? e.name,
  }));
}

// ===== Archive name =====

/** Sanitize an archive name. Ensures it ends with .zip and contains no invalid chars. */
export function sanitizeArchiveName(name: string): string {
  const cleaned = (name || "archive").trim().replace(/[\\/:*?"<>|]/g, "_");
  const withoutZip = cleaned.replace(/\.zip$/i, "");
  return `${withoutZip || "archive"}.zip`;
}

// ===== Stats =====

/** Per-entry ZIP overhead: local header (30) + name + central dir entry (46) + name. */
export function estimateEntryOverhead(name: string): number {
  const nameBytes = new TextEncoder().encode(name).length;
  return 30 + nameBytes + 46 + nameBytes;
}

/** Estimate the archive size without building it. */
export function estimateArchiveSize(entries: FileEntry[]): number {
  let total = 0;
  for (const e of entries) total += e.size + estimateEntryOverhead(e.name);
  total += 22; // EOCD
  return total;
}

/** Compute stats for a list of entries (without building the archive). */
export function computeStats(entries: FileEntry[], archiveSize?: number): ArchiveStats {
  const totalUncompressed = entries.reduce((s, e) => s + e.size, 0);
  const estimatedSize = estimateArchiveSize(entries);
  const actualSize = archiveSize ?? estimatedSize;
  const ratio = actualSize > 0 ? totalUncompressed / actualSize : 0;
  return {
    fileCount: entries.length,
    totalUncompressed,
    archiveSize: actualSize,
    ratio,
    estimatedSize,
  };
}

// ===== Build archive =====

/**
 * Build a ZIP archive from a list of FileEntries. Returns a Blob and stats.
 * The archive uses STORE method (no compression) — files are stored verbatim.
 *
 * Honesty clause: STORE method only. DEFLATE compression is not applied —
 * see manifest FAQ for the rationale.
 */
export function buildArchive(entries: FileEntry[], archiveName: string): ArchiveBuildResult {
  if (entries.length === 0) {
    throw new Error("Cannot build archive: no files added.");
  }
  // Detect >4GB total (would require ZIP64 — documented limitation).
  const totalSize = entries.reduce((s, e) => s + e.size, 0);
  if (totalSize > 0xffffffff) {
    throw new Error(
      `Total uncompressed size (${formatBytes(totalSize)}) exceeds 4GB. ZIP64 is not currently enabled — split the archive or remove some files.`,
    );
  }
  for (const e of entries) {
    if (e.size > 0xffffffff) {
      throw new Error(
        `File "${e.name}" (${formatBytes(e.size)}) exceeds 4GB. ZIP64 is not currently enabled — remove this file or split it first.`,
      );
    }
    if (new TextEncoder().encode(e.name).length > 65535) {
      throw new Error(`Filename "${e.name.slice(0, 40)}..." is too long (max 65535 bytes).`);
    }
  }
  const dupNames = findDuplicates(entries);
  if (dupNames.size > 0) {
    throw new Error(
      `Duplicate filenames in archive: ${Array.from(dupNames).slice(0, 5).join(", ")}${dupNames.size > 5 ? "..." : ""}. Rename files to make them unique.`,
    );
  }

  const files: ZipFile[] = entries.map((e) => ({ name: e.name, data: e.data }));
  const blob = createZipBlobBase(files);
  const stats = computeStats(entries, blob.size);
  return { blob, fileName: sanitizeArchiveName(archiveName), stats };
}

// ===== MIME detection =====

/** Detect MIME type from filename extension. */
export function detectMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".log")) return "text/plain";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".xml")) return "application/xml";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".css")) return "text/css";
  if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
  if (lower.endsWith(".ts")) return "application/typescript";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".tar")) return "application/x-tar";
  if (lower.endsWith(".gz")) return "application/gzip";
  return "application/octet-stream";
}

// ===== Utilities =====

/** Format bytes as human-readable. */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Format a ratio (e.g. 0.97 -> "0.97x" — files are 97% of the archive size). */
export function formatRatio(value: number): string {
  return `${value.toFixed(2)}×`;
}

// ===== History (localStorage) =====

const HISTORY_KEY = "unqtools-zip-compressor-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  archiveName: string;
  fileCount: number;
  totalUncompressed: number;
  archiveSize: number;
  createdAt: string;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

export function saveToHistory(entry: HistoryEntry): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const updated = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    /* ignore */
  }
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}

// ===== Shareable URL =====

export interface ShareOptions {
  archiveName: string;
}

export function buildShareUrl(opts: ShareOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  if (opts.archiveName) params.set("name", opts.archiveName);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareOptions | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("name")) return null;
  return { archiveName: params.get("name") ?? "" };
}

// ===== Re-exports for tests =====

export { createZipBlobBase };
export type { ZipFile };
