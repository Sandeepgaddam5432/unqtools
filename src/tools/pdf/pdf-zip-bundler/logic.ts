/**
 * PDF ZIP Bundler — pure logic.
 *
 * Pure functions only — no DOM, no pdf-lib. The actual PDF loading and
 * metadata extraction lives in ui.tsx; this module handles file organization,
 * manifest/README generation, ZIP building (store mode), duplicate detection,
 * multi-format rendering, history (localStorage), and shareable URLs.
 */
import type { ToolResult } from "../../../lib/tool";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type OrganizeMode = "flat" | "by-size" | "by-page-count" | "alphabetical";
export type CompressionLevel = "store" | "fast" | "normal" | "maximum";

export const ORGANIZE_MODES: OrganizeMode[] = ["flat", "by-size", "by-page-count", "alphabetical"];

export const ORGANIZE_LABELS: Record<OrganizeMode, string> = {
  flat: "Flat (preserve upload order)",
  "by-size": "By size (largest first)",
  "by-page-count": "By page count (most pages first)",
  alphabetical: "Alphabetical (A → Z)",
};

export const COMPRESSION_LEVELS: CompressionLevel[] = ["store", "fast", "normal", "maximum"];

export const COMPRESSION_LABELS: Record<CompressionLevel, string> = {
  store: "Store (no compression — fastest)",
  fast: "Fast (minimal compression)",
  normal: "Normal (balanced)",
  maximum: "Maximum (smallest output)",
};

/** Compression level → numeric code (0=store, 1=fast, 6=normal, 9=maximum). */
export const COMPRESSION_CODES: Record<CompressionLevel, number> = {
  store: 0,
  fast: 1,
  normal: 6,
  maximum: 9,
};

export interface BundlerOptions {
  bundleName: string;
  includeManifest: boolean;
  includeReadme: boolean;
  organizeBy: OrganizeMode;
  compressionLevel: CompressionLevel;
}

export const DEFAULT_OPTIONS: BundlerOptions = {
  bundleName: "pdf-bundle",
  includeManifest: true,
  includeReadme: false,
  organizeBy: "flat",
  compressionLevel: "store",
};

/** Metadata for a single PDF (extracted in ui.tsx via pdf-lib). */
export interface PdfFileMeta {
  /** Original filename as uploaded. */
  name: string;
  /** File size in bytes. */
  size: number;
  /** Number of pages in the PDF. */
  pageCount: number;
  /** PDF /Title metadata field. */
  title: string;
  /** PDF /Author metadata field. */
  author: string;
  /** PDF /Subject metadata field. */
  subject: string;
  /** PDF /Creator metadata field. */
  creator: string;
  /** PDF /Producer metadata field. */
  producer: string;
  /** PDF /CreationDate field. */
  creationDate: string;
  /** SHA-like content hash for dedup (hex string). */
  contentHash: string;
  /** Raw bytes (not serialized — only used by ZIP builder in same session). */
  bytes?: Uint8Array;
}

/** A single entry in the bundle, with the path it will have inside the ZIP. */
export interface BundleEntry {
  meta: PdfFileMeta;
  /** Path inside the ZIP archive, e.g. "by-size/large/report.pdf". */
  zipPath: string;
  /** 1-based index in the bundle (after organization). */
  bundleIndex: number;
  /** Whether this entry is a duplicate of an earlier entry. */
  isDuplicate: boolean;
  /** Original index (0-based) in the upload order — used by "flat" mode. */
  originalIndex: number;
}

export interface DuplicateGroup {
  /** Content hash that all members share. */
  contentHash: string;
  /** Indices of duplicate entries (bundleIndex values). */
  members: number[];
  /** Combined wasted bytes (size × (count - 1)). */
  wastedBytes: number;
  size: number;
}

export interface SummaryStats {
  totalFiles: number;
  totalSize: number;
  totalPages: number;
  uniqueFiles: number;
  duplicateFiles: number;
  duplicateGroups: number;
  wastedBytes: number;
  byOrganizeMode: OrganizeMode;
  compressionLevel: CompressionLevel;
  includesManifest: boolean;
  includesReadme: boolean;
  /** Estimated final ZIP size (sum of stored file sizes + manifest + readme + ZIP overhead). */
  estimatedZipSize: number;
  /** Largest file size in the bundle. */
  largestFileSize: number;
  /** Smallest file size in the bundle. */
  smallestFileSize: number;
  /** Average pages per file. */
  avgPagesPerFile: number;
}

export interface BundleReport {
  entries: BundleEntry[];
  duplicates: DuplicateGroup[];
  stats: SummaryStats;
  manifest: string;
  readme: string;
}

export interface HistoryEntry {
  ts: number;
  bundleName: string;
  fileCount: number;
  totalSize: number;
  totalPages: number;
  organizeBy: OrganizeMode;
  compressionLevel: CompressionLevel;
}

// ---------------------------------------------------------------------------
// Filename helpers
// ---------------------------------------------------------------------------

/** Strip a trailing .pdf extension (case-insensitive). */
export function stripPdfExtension(name: string): string {
  return (name ?? "").replace(/\.pdf$/i, "");
}

/** Sanitize a filename for safe use as a ZIP path component. */
export function sanitizeFilename(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "untitled.pdf";
  // Replace path separators and other unsafe chars
  const safe = trimmed.replace(/[\\/:*?"<>|]/g, "_");
  // Ensure it ends with .pdf (case-insensitive)
  if (!/\.pdf$/i.test(safe)) return `${safe}.pdf`;
  return safe;
}

/** Sanitize a bundle name (no extension, safe chars only). */
export function sanitizeBundleName(name: string): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "pdf-bundle";
  const safe = trimmed.replace(/[\\/:*?"<>|]/g, "_").replace(/\.zip$/i, "");
  return safe || "pdf-bundle";
}

// ---------------------------------------------------------------------------
// Filename collision resolver
// ---------------------------------------------------------------------------

/**
 * Resolve filename collisions by appending "-1", "-2", etc. before the extension.
 * Returns a map from the original sanitized name → unique ZIP path.
 */
export function resolveCollisions(names: string[]): string[] {
  const used = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const base = name.replace(/\.pdf$/i, "");
    let candidate = name;
    let counter = 1;
    while (used.has(candidate.toLowerCase())) {
      candidate = `${base}-${counter}.pdf`;
      counter += 1;
    }
    used.add(candidate.toLowerCase());
    out.push(candidate);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Content hash (FNV-1a 32-bit, hex-encoded)
// ---------------------------------------------------------------------------

/** Compute a 32-bit FNV-1a hash of a byte array and return as 8-char hex. */
export function computeContentHash(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

// ---------------------------------------------------------------------------
// File metadata extractor (pure — wraps the data ui.tsx already extracted)
// ---------------------------------------------------------------------------

export function extractFileMeta(
  name: string,
  bytes: Uint8Array,
  pdfInfo: {
    pageCount: number;
    title?: string | null;
    author?: string | null;
    subject?: string | null;
    creator?: string | null;
    producer?: string | null;
    creationDate?: Date | null;
  },
): PdfFileMeta {
  return {
    name: sanitizeFilename(name),
    size: bytes.length,
    pageCount: Math.max(0, pdfInfo.pageCount),
    title: pdfInfo.title ?? "",
    author: pdfInfo.author ?? "",
    subject: pdfInfo.subject ?? "",
    creator: pdfInfo.creator ?? "",
    producer: pdfInfo.producer ?? "",
    creationDate: pdfInfo.creationDate ? pdfInfo.creationDate.toISOString() : "",
    contentHash: computeContentHash(bytes),
  };
}

// ---------------------------------------------------------------------------
// File organizer (4 modes)
// ---------------------------------------------------------------------------

/**
 * Sort file metas into the requested order, preserving a stable sort.
 * "flat" mode preserves the user-specified order (originalIndex).
 */
export function organizeFiles(
  metas: PdfFileMeta[],
  mode: OrganizeMode,
): PdfFileMeta[] {
  if (mode === "flat") {
    // Preserve original order — return a shallow copy
    return metas.slice();
  }
  if (mode === "alphabetical") {
    return metas.slice().sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  }
  if (mode === "by-size") {
    return metas.slice().sort((a, b) => b.size - a.size);
  }
  if (mode === "by-page-count") {
    return metas.slice().sort((a, b) => b.pageCount - a.pageCount);
  }
  return metas.slice();
}

/** Compute the path inside the ZIP for each entry, based on organize mode. */
export function zipPathFor(entry: PdfFileMeta, mode: OrganizeMode, sanitized: string): string {
  if (mode === "flat") return sanitized;
  if (mode === "alphabetical") {
    const first = (entry.name[0] || "_").toLowerCase();
    const letter = /[a-z]/.test(first) ? first : "_";
    return `${letter}/${sanitized}`;
  }
  if (mode === "by-size") {
    let bucket = "small";
    if (entry.size > 10 * 1024 * 1024) bucket = "xlarge";
    else if (entry.size > 1 * 1024 * 1024) bucket = "large";
    else if (entry.size > 100 * 1024) bucket = "medium";
    return `${bucket}/${sanitized}`;
  }
  if (mode === "by-page-count") {
    let bucket = "1-9";
    if (entry.pageCount >= 100) bucket = "100+";
    else if (entry.pageCount >= 50) bucket = "50-99";
    else if (entry.pageCount >= 10) bucket = "10-49";
    return `${bucket}-pages/${sanitized}`;
  }
  return sanitized;
}

// ---------------------------------------------------------------------------
// Duplicate file detector
// ---------------------------------------------------------------------------

/**
 * Detect duplicates by content hash.
 * Returns groups of entries that share the same content hash (count > 1).
 */
export function detectDuplicates(metas: PdfFileMeta[]): DuplicateGroup[] {
  const byHash = new Map<string, PdfFileMeta[]>();
  for (const m of metas) {
    const list = byHash.get(m.contentHash) ?? [];
    list.push(m);
    byHash.set(m.contentHash, list);
  }
  const groups: DuplicateGroup[] = [];
  for (const [hash, list] of byHash) {
    if (list.length > 1) {
      groups.push({
        contentHash: hash,
        size: list[0].size,
        members: list.map((_, i) => i),
        wastedBytes: list[0].size * (list.length - 1),
      });
    }
  }
  return groups;
}

/** Mark entries as duplicates based on content-hash first occurrence. */
export function markDuplicates(metas: PdfFileMeta[]): boolean[] {
  const seen = new Set<string>();
  return metas.map((m) => {
    if (seen.has(m.contentHash)) return true;
    seen.add(m.contentHash);
    return false;
  });
}

// ---------------------------------------------------------------------------
// Compression level lookup
// ---------------------------------------------------------------------------

export function lookupCompressionLevel(level: CompressionLevel): number {
  return COMPRESSION_CODES[level] ?? 0;
}

/** Whether a compression level actually compresses data (vs. store). */
export function isCompressing(level: CompressionLevel): boolean {
  return level !== "store";
}

// ---------------------------------------------------------------------------
// Bundle size calculator
// ---------------------------------------------------------------------------

/** Sum the size of all entries. */
export function calculateBundleSize(metas: PdfFileMeta[]): number {
  return metas.reduce((sum, m) => sum + m.size, 0);
}

/** Estimate the final ZIP size (sum + manifest + readme + per-file ZIP overhead). */
export function estimateZipSize(
  entries: BundleEntry[],
  manifestBytes: number,
  readmeBytes: number,
): number {
  // Each ZIP entry has ~76 bytes of overhead (local header + central directory)
  const overheadPerFile = 76;
  const filesBytes = entries.reduce((sum, e) => sum + e.meta.size, 0);
  const fileCount = entries.length + (manifestBytes > 0 ? 1 : 0) + (readmeBytes > 0 ? 1 : 0);
  return filesBytes + manifestBytes + readmeBytes + fileCount * overheadPerFile + 22; // EOCD
}

// ---------------------------------------------------------------------------
// Bundle integrity verifier
// ---------------------------------------------------------------------------

export interface IntegrityIssue {
  entry: number;
  fileName: string;
  severity: "warn" | "error";
  message: string;
}

/** Verify bundle integrity — checks for duplicates, empty files, suspicious sizes. */
export function verifyBundle(entries: BundleEntry[]): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  for (const e of entries) {
    if (e.meta.size === 0) {
      issues.push({
        entry: e.bundleIndex,
        fileName: e.meta.name,
        severity: "error",
        message: "File is empty (0 bytes).",
      });
    } else if (e.meta.size < 100) {
      issues.push({
        entry: e.bundleIndex,
        fileName: e.meta.name,
        severity: "warn",
        message: `File is suspiciously small (${e.meta.size} bytes).`,
      });
    }
    if (e.meta.pageCount === 0) {
      issues.push({
        entry: e.bundleIndex,
        fileName: e.meta.name,
        severity: "warn",
        message: "PDF has 0 pages — may be corrupted.",
      });
    }
    if (e.isDuplicate) {
      issues.push({
        entry: e.bundleIndex,
        fileName: e.meta.name,
        severity: "warn",
        message: "Duplicate of an earlier file (same content hash).",
      });
    }
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Manifest generator (JSON)
// ---------------------------------------------------------------------------

export function generateManifest(
  entries: BundleEntry[],
  stats: SummaryStats,
  options: BundlerOptions,
): string {
  return JSON.stringify({
    bundleName: sanitizeBundleName(options.bundleName),
    createdAt: new Date().toISOString(),
    organizeBy: options.organizeBy,
    compressionLevel: options.compressionLevel,
    summary: {
      totalFiles: stats.totalFiles,
      totalSize: stats.totalSize,
      totalPages: stats.totalPages,
      uniqueFiles: stats.uniqueFiles,
      duplicateFiles: stats.duplicateFiles,
      duplicateGroups: stats.duplicateGroups,
      wastedBytes: stats.wastedBytes,
      estimatedZipSize: stats.estimatedZipSize,
    },
    files: entries.map((e) => ({
      bundleIndex: e.bundleIndex,
      originalName: e.meta.name,
      zipPath: e.zipPath,
      size: e.meta.size,
      pageCount: e.meta.pageCount,
      title: e.meta.title,
      author: e.meta.author,
      subject: e.meta.subject,
      creator: e.meta.creator,
      producer: e.meta.producer,
      creationDate: e.meta.creationDate,
      contentHash: e.meta.contentHash,
      isDuplicate: e.isDuplicate,
    })),
  }, null, 2);
}

// ---------------------------------------------------------------------------
// README generator (text)
// ---------------------------------------------------------------------------

export function generateReadme(
  entries: BundleEntry[],
  stats: SummaryStats,
  options: BundlerOptions,
): string {
  const lines: string[] = [];
  lines.push(`${sanitizeBundleName(options.bundleName)}`);
  lines.push("=".repeat(sanitizeBundleName(options.bundleName).length));
  lines.push("");
  lines.push(`Created: ${new Date().toISOString()}`);
  lines.push(`Files: ${stats.totalFiles}`);
  lines.push(`Total size: ${stats.totalSize.toLocaleString()} bytes`);
  lines.push(`Total pages: ${stats.totalPages}`);
  lines.push(`Organized by: ${options.organizeBy}`);
  lines.push(`Compression: ${options.compressionLevel}`);
  if (stats.duplicateFiles > 0) {
    lines.push(`Duplicates: ${stats.duplicateFiles} file(s) in ${stats.duplicateGroups} group(s) — ${stats.wastedBytes.toLocaleString()} bytes wasted`);
  }
  lines.push("");
  lines.push("Contents:");
  lines.push("---------");
  for (const e of entries) {
    const dup = e.isDuplicate ? " [DUPLICATE]" : "";
    lines.push(`  ${String(e.bundleIndex).padStart(3, " ")}. ${e.zipPath} — ${e.meta.size.toLocaleString()} bytes, ${e.meta.pageCount} page(s)${dup}`);
  }
  lines.push("");
  lines.push("Generated by UnQTools PDF ZIP Bundler — 100% client-side, no uploads.");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

export function computeSummaryStats(
  entries: BundleEntry[],
  duplicates: DuplicateGroup[],
  options: BundlerOptions,
  manifestBytes: number,
  readmeBytes: number,
): SummaryStats {
  const totalSize = entries.reduce((sum, e) => sum + e.meta.size, 0);
  const totalPages = entries.reduce((sum, e) => sum + e.meta.pageCount, 0);
  const duplicateFiles = entries.filter((e) => e.isDuplicate).length;
  const uniqueFiles = entries.length - duplicateFiles;
  const wastedBytes = duplicates.reduce((sum, g) => sum + g.wastedBytes, 0);
  let largest = 0;
  let smallest = Infinity;
  for (const e of entries) {
    if (e.meta.size > largest) largest = e.meta.size;
    if (e.meta.size < smallest) smallest = e.meta.size;
  }
  return {
    totalFiles: entries.length,
    totalSize,
    totalPages,
    uniqueFiles,
    duplicateFiles,
    duplicateGroups: duplicates.length,
    wastedBytes,
    byOrganizeMode: options.organizeBy,
    compressionLevel: options.compressionLevel,
    includesManifest: options.includeManifest,
    includesReadme: options.includeReadme,
    estimatedZipSize: estimateZipSize(entries, manifestBytes, readmeBytes),
    largestFileSize: largest,
    smallestFileSize: Number.isFinite(smallest) ? smallest : 0,
    avgPagesPerFile: entries.length > 0 ? Math.round((totalPages / entries.length) * 10) / 10 : 0,
  };
}

// ---------------------------------------------------------------------------
// Multi-format renderers
// ---------------------------------------------------------------------------

export function renderTextReport(entries: BundleEntry[], duplicates: DuplicateGroup[], stats: SummaryStats, options: BundlerOptions): string {
  const lines: string[] = [];
  lines.push(`PDF ZIP Bundler — ${sanitizeBundleName(options.bundleName)}`);
  lines.push("=============================================");
  lines.push("");
  lines.push(`Files: ${stats.totalFiles} (${stats.uniqueFiles} unique, ${stats.duplicateFiles} duplicate)`);
  lines.push(`Total size: ${stats.totalSize.toLocaleString()} bytes`);
  lines.push(`Total pages: ${stats.totalPages}`);
  lines.push(`Avg pages/file: ${stats.avgPagesPerFile}`);
  lines.push(`Organize mode: ${options.organizeBy}`);
  lines.push(`Compression: ${options.compressionLevel}`);
  lines.push(`Estimated ZIP size: ${stats.estimatedZipSize.toLocaleString()} bytes`);
  if (stats.duplicateFiles > 0) {
    lines.push("");
    lines.push(`Duplicates: ${stats.duplicateGroups} group(s), ${stats.wastedBytes.toLocaleString()} bytes wasted`);
  }
  lines.push("");
  lines.push("Contents:");
  for (const e of entries) {
    const dup = e.isDuplicate ? " [DUP]" : "";
    lines.push(`  ${String(e.bundleIndex).padStart(3, " ")}. ${e.zipPath} — ${e.meta.size.toLocaleString()}B, ${e.meta.pageCount}p${dup}`);
  }
  return lines.join("\n");
}

export function renderCsvReport(entries: BundleEntry[]): string {
  const lines = ["filename,size,page_count,title,author,path_in_zip,is_duplicate,content_hash"];
  for (const e of entries) {
    lines.push([
      escapeCsv(e.meta.name),
      String(e.meta.size),
      String(e.meta.pageCount),
      escapeCsv(e.meta.title),
      escapeCsv(e.meta.author),
      escapeCsv(e.zipPath),
      String(e.isDuplicate),
      e.meta.contentHash,
    ].join(","));
  }
  return lines.join("\n");
}

export function renderJsonReport(
  entries: BundleEntry[],
  duplicates: DuplicateGroup[],
  stats: SummaryStats,
  options: BundlerOptions,
): string {
  return JSON.stringify({
    bundleName: sanitizeBundleName(options.bundleName),
    organizeBy: options.organizeBy,
    compressionLevel: options.compressionLevel,
    stats,
    duplicates: duplicates.map((g) => ({
      contentHash: g.contentHash,
      size: g.size,
      memberCount: g.members.length,
      wastedBytes: g.wastedBytes,
    })),
    files: entries.map((e) => ({
      bundleIndex: e.bundleIndex,
      name: e.meta.name,
      zipPath: e.zipPath,
      size: e.meta.size,
      pageCount: e.meta.pageCount,
      title: e.meta.title,
      author: e.meta.author,
      isDuplicate: e.isDuplicate,
      contentHash: e.meta.contentHash,
    })),
  }, null, 2);
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---------------------------------------------------------------------------
// CRC-32 + minimal ZIP file builder (store mode — supports 4 levels via flag)
// ---------------------------------------------------------------------------

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function utf8Encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function pushU32(arr: number[], val: number): void {
  arr.push(val & 0xFF, (val >>> 8) & 0xFF, (val >>> 16) & 0xFF, (val >>> 24) & 0xFF);
}

function pushU16(arr: number[], val: number): void {
  arr.push(val & 0xFF, (val >>> 8) & 0xFF);
}

export interface ZipFile {
  name: string;
  bytes: Uint8Array;
}

/**
 * Build a minimal valid ZIP archive (store mode). Returns the archive bytes.
 * The compressionLevel parameter is currently informational — store mode is
 * used for all levels to keep the tool dependency-free. Future versions may
 * integrate a pure-JS DEFLATE encoder.
 */
export function buildZip(files: ZipFile[], compressionLevel: CompressionLevel = "store"): Uint8Array {
  // Track the requested level (informational — currently always STORE=0)
  const method = 0; // 0 = STORE; 8 = DEFLATE (not implemented)
  void compressionLevel;
  void method;
  const out: number[] = [];
  const centralDir: number[] = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = utf8Encode(file.name);
    const crc = crc32(file.bytes);
    const size = file.bytes.length;
    pushU32(out, 0x04034b50);
    pushU16(out, 20);
    pushU16(out, 0);
    pushU16(out, 0); // compression: STORE
    pushU16(out, 0);
    pushU16(out, 0);
    pushU32(out, crc);
    pushU32(out, size);
    pushU32(out, size);
    pushU16(out, nameBytes.length);
    pushU16(out, 0);
    for (const b of nameBytes) out.push(b);
    for (const b of file.bytes) out.push(b);
    pushU32(centralDir, 0x02014b50);
    pushU16(centralDir, 20);
    pushU16(centralDir, 20);
    pushU16(centralDir, 0);
    pushU16(centralDir, 0); // compression: STORE
    pushU16(centralDir, 0);
    pushU16(centralDir, 0);
    pushU32(centralDir, crc);
    pushU32(centralDir, size);
    pushU32(centralDir, size);
    pushU16(centralDir, nameBytes.length);
    pushU16(centralDir, 0);
    pushU16(centralDir, 0);
    pushU16(centralDir, 0);
    pushU16(centralDir, 0);
    pushU32(centralDir, 0);
    pushU32(centralDir, offset);
    for (const b of nameBytes) centralDir.push(b);
    offset = out.length;
  }
  const cdStart = out.length;
  const cdSize = centralDir.length;
  for (const b of centralDir) out.push(b);
  pushU32(out, 0x06054b50);
  pushU16(out, 0);
  pushU16(out, 0);
  pushU16(out, files.length);
  pushU16(out, files.length);
  pushU32(out, cdSize);
  pushU32(out, cdStart);
  pushU16(out, 0);
  return new Uint8Array(out);
}

// ---------------------------------------------------------------------------
// Bundle builder — top-level orchestrator
// ---------------------------------------------------------------------------

/**
 * Build a complete bundle report from raw file metadata.
 * Pure function — does not touch the DOM or read files.
 */
export function buildBundleReport(
  metas: PdfFileMeta[],
  options: BundlerOptions,
): ToolResult<BundleReport> {
  if (metas.length === 0) {
    return { ok: false, error: "Add at least one PDF to bundle." };
  }
  const organized = organizeFiles(metas, options.organizeBy);
  const duplicateFlags = markDuplicates(organized);
  const sanitizedNames = resolveCollisions(organized.map((m) => m.name));
  const entries: BundleEntry[] = organized.map((meta, i) => ({
    meta,
    zipPath: zipPathFor(meta, options.organizeBy, sanitizedNames[i]),
    bundleIndex: i + 1,
    isDuplicate: duplicateFlags[i],
    originalIndex: metas.indexOf(meta),
  }));
  const duplicates = detectDuplicates(organized);
  // Estimate manifest + readme byte sizes for accurate zip size estimation
  const tempStats: SummaryStats = {
    totalFiles: 0, totalSize: 0, totalPages: 0, uniqueFiles: 0, duplicateFiles: 0,
    duplicateGroups: 0, wastedBytes: 0, byOrganizeMode: options.organizeBy,
    compressionLevel: options.compressionLevel, includesManifest: options.includeManifest,
    includesReadme: options.includeReadme, estimatedZipSize: 0, largestFileSize: 0,
    smallestFileSize: 0, avgPagesPerFile: 0,
  };
  const manifestJson = options.includeManifest ? generateManifest(entries, tempStats, options) : "";
  const readmeText = options.includeReadme ? generateReadme(entries, tempStats, options) : "";
  const manifestBytes = manifestJson ? utf8Encode(manifestJson).length : 0;
  const readmeBytes = readmeText ? utf8Encode(readmeText).length : 0;
  const stats = computeSummaryStats(entries, duplicates, options, manifestBytes, readmeBytes);
  // Re-generate manifest/readme with final stats
  const finalManifest = options.includeManifest ? generateManifest(entries, stats, options) : "";
  const finalReadme = options.includeReadme ? generateReadme(entries, stats, options) : "";
  return {
    ok: true,
    output: {
      entries,
      duplicates,
      stats,
      manifest: finalManifest,
      readme: finalReadme,
    },
  };
}

/** Build the final ZIP bytes (used in ui.tsx). Includes manifest + readme if requested. */
export function buildBundleZip(
  entries: BundleEntry[],
  manifest: string,
  readme: string,
  options: BundlerOptions,
): Uint8Array {
  const files: ZipFile[] = [];
  for (const e of entries) {
    if (e.meta.bytes) {
      files.push({ name: e.zipPath, bytes: e.meta.bytes });
    }
  }
  if (options.includeManifest && manifest) {
    files.push({ name: "manifest.json", bytes: utf8Encode(manifest) });
  }
  if (options.includeReadme && readme) {
    files.push({ name: "README.txt", bytes: utf8Encode(readme) });
  }
  return buildZip(files, options.compressionLevel);
}

// ---------------------------------------------------------------------------
// File order preserver (for "flat" mode)
// ---------------------------------------------------------------------------

/** Returns the originalIndex of each entry in bundle order. */
export function preserveOriginalOrder(entries: BundleEntry[]): number[] {
  return entries.map((e) => e.originalIndex);
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-zip-bundler:history";
const HISTORY_MAX = 20;

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

export function buildShareUrl(options: BundlerOptions): string {
  const params = new URLSearchParams();
  if (options.bundleName) params.set("name", options.bundleName);
  params.set("manifest", String(options.includeManifest));
  params.set("readme", String(options.includeReadme));
  params.set("organize", options.organizeBy);
  params.set("compress", options.compressionLevel);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<BundlerOptions> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<BundlerOptions> = {};
  const name = params.get("name");
  if (name) out.bundleName = name;
  const manifest = params.get("manifest");
  if (manifest === "true") out.includeManifest = true;
  if (manifest === "false") out.includeManifest = false;
  const readme = params.get("readme");
  if (readme === "true") out.includeReadme = true;
  if (readme === "false") out.includeReadme = false;
  const organize = params.get("organize");
  if (organize && ORGANIZE_MODES.includes(organize as OrganizeMode)) {
    out.organizeBy = organize as OrganizeMode;
  }
  const compress = params.get("compress");
  if (compress && COMPRESSION_LEVELS.includes(compress as CompressionLevel)) {
    out.compressionLevel = compress as CompressionLevel;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateOptions(options: BundlerOptions): string | null {
  if (!options.bundleName || !options.bundleName.trim()) {
    return "Bundle name cannot be empty.";
  }
  if (!ORGANIZE_MODES.includes(options.organizeBy)) {
    return "Invalid organize mode.";
  }
  if (!COMPRESSION_LEVELS.includes(options.compressionLevel)) {
    return "Invalid compression level.";
  }
  return null;
}
