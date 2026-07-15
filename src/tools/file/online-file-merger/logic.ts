/**
 * File Merger — pure logic for part sorting, merging, and checksum verification.
 *
 * Pure functions only — no React, no DOM access. UI handles file reads + download.
 */

export interface PartEntry {
  /** Stable id. */
  id: string;
  /** Original filename (e.g. "myfile.001"). */
  name: string;
  /** Parsed part number from extension (1, 2, 3, ...). NaN if unparseable. */
  partNumber: number;
  /** File size in bytes. */
  size: number;
  /** Last modified (ms). */
  lastModified: number;
  /** Reference to underlying File. */
  file: File;
}

export interface ManifestEntry {
  filename: string;
  sha256?: string;
  crc32?: string;
}

export interface MergeStats {
  partCount: number;
  mergedSize: number;
  baseName: string;
  missingParts: number[];
  verified: boolean;
  verificationErrors: string[];
}

export interface MergeResult {
  bytes: Uint8Array;
  stats: MergeStats;
}

/** Parse a part number from a filename's extension. Returns NaN if not a number. */
export function parsePartNumber(filename: string): number {
  // Match trailing .NNN where NNN is digits
  const match = filename.match(/\.(\d+)$/);
  if (!match) return NaN;
  return parseInt(match[1], 10);
}

/** Extract the base name (filename without the trailing .NNN part). */
export function extractBaseName(filename: string): string {
  const match = filename.match(/^(.+)\.(\d+)$/);
  if (!match) return filename;
  return match[1];
}

/**
 * Sort parts by their part number (ascending). Unparseable parts sort to the end.
 */
export function sortParts(parts: PartEntry[]): PartEntry[] {
  return [...parts].sort((a, b) => {
    const aValid = !Number.isNaN(a.partNumber);
    const bValid = !Number.isNaN(b.partNumber);
    if (!aValid && !bValid) return a.name.localeCompare(b.name);
    if (!aValid) return 1;
    if (!bValid) return -1;
    return a.partNumber - b.partNumber;
  });
}

/**
 * Detect missing parts in a sequence. Expects parts already sorted by partNumber.
 * Returns an array of missing part numbers.
 */
export function detectMissingParts(sortedParts: PartEntry[]): number[] {
  const validParts = sortedParts.filter((p) => !Number.isNaN(p.partNumber));
  if (validParts.length === 0) return [];
  const numbers = validParts.map((p) => p.partNumber);
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const set = new Set(numbers);
  const missing: number[] = [];
  for (let i = min; i <= max; i++) {
    if (!set.has(i)) missing.push(i);
  }
  return missing;
}

/** Convert bytes to lowercase hex string. */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Format bytes as human-readable. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
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

/** Parse a manifest file content into ManifestEntry[]. */
export function parseManifest(content: string): ManifestEntry[] {
  const entries: ManifestEntry[] = [];
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    // Match: <hex>  <filename>  OR  crc32:<hex>  <filename>
    const shaMatch = trimmed.match(/^([0-9a-fA-F]{64})\s+\*?(.+)$/);
    if (shaMatch) {
      const existing = entries.find((e) => e.filename === shaMatch[2].trim());
      if (existing) {
        existing.sha256 = shaMatch[1].toLowerCase();
      } else {
        entries.push({ filename: shaMatch[2].trim(), sha256: shaMatch[1].toLowerCase() });
      }
      continue;
    }
    const crcMatch = trimmed.match(/^crc32:([0-9a-fA-F]{8})\s+\*?(.+)$/i);
    if (crcMatch) {
      const existing = entries.find((e) => e.filename === crcMatch[2].trim());
      if (existing) {
        existing.crc32 = crcMatch[1].toLowerCase();
      } else {
        entries.push({ filename: crcMatch[2].trim(), crc32: crcMatch[1].toLowerCase() });
      }
      continue;
    }
  }
  return entries;
}

/** Build a map from filename → ManifestEntry for quick lookup. */
export function manifestMap(entries: ManifestEntry[]): Map<string, ManifestEntry> {
  return new Map(entries.map((e) => [e.filename, e]));
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

/**
 * Verify a part's bytes against a manifest entry. Returns null if OK, error message otherwise.
 */
export async function verifyPart(
  bytes: Uint8Array,
  entry: ManifestEntry | undefined,
): Promise<string | null> {
  if (!entry) return null; // No manifest entry → skip verification
  const errors: string[] = [];
  if (entry.sha256) {
    const computed = await sha256(bytes);
    if (computed !== entry.sha256) {
      errors.push(`SHA-256 mismatch (expected ${entry.sha256.slice(0, 16)}..., got ${computed.slice(0, 16)}...)`);
    }
  }
  if (entry.crc32) {
    const computed = crc32(bytes);
    if (computed !== entry.crc32) {
      errors.push(`CRC32 mismatch (expected ${entry.crc32}, got ${computed})`);
    }
  }
  return errors.length === 0 ? null : errors.join("; ");
}

/**
 * Concatenate an array of Uint8Arrays into one.
 */
export function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/**
 * Merge the parts (as bytes arrays) in order. Optionally verify each against the manifest.
 * onProgress(percent 0-100, partIndex, partCount).
 */
export async function mergeParts(
  parts: Array<{ entry: PartEntry; bytes: Uint8Array }>,
  manifest: Map<string, ManifestEntry>,
  onProgress?: (percent: number, partIndex: number, partCount: number) => void,
): Promise<MergeResult> {
  const sorted = sortParts(parts.map((p) => p.entry));
  const sortedByName = new Map(parts.map((p) => [p.entry.id, p.bytes]));
  const byteParts: Uint8Array[] = [];
  const verificationErrors: string[] = [];
  let verified = true;

  for (let i = 0; i < sorted.length; i++) {
    const entry = sorted[i];
    const bytes = sortedByName.get(entry.id);
    if (!bytes) continue;
    byteParts.push(bytes);
    const manifestEntry = manifest.get(entry.name);
    const err = await verifyPart(bytes, manifestEntry);
    if (err) {
      verified = false;
      verificationErrors.push(`${entry.name}: ${err}`);
    }
    if (onProgress) onProgress(Math.round(((i + 1) / sorted.length) * 100), i, sorted.length);
  }

  const merged = concatBytes(byteParts);
  const missing = detectMissingParts(sorted);
  return {
    bytes: merged,
    stats: {
      partCount: sorted.length,
      mergedSize: merged.length,
      baseName: sorted.length > 0 ? extractBaseName(sorted[0].name) : "",
      missingParts: missing,
      verified,
      verificationErrors,
    },
  };
}

/** Trigger a browser download for merged bytes. */
export function downloadMerged(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ===== History (localStorage) =====
const HISTORY_KEY = "unqtools-online-file-merger-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  baseName: string;
  partCount: number;
  mergedSize: number;
  verified: boolean;
  errorCount: number;
  mergedAt: string;
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

/** Build a shareable URL with merge settings. */
export function buildShareUrl(settings: { outputName: string; verify: boolean }): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  if (settings.outputName) params.set("out", settings.outputName);
  params.set("verify", String(settings.verify));
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

/** Parse a shareable URL hash back into settings. */
export function parseShareUrl(hash: string): { outputName?: string; verify?: boolean } | null {
  if (!hash) return null;
  const cleaned = hash.replace(/^#/, "");
  const params = new URLSearchParams(cleaned);
  if (params.toString() === "") return null;
  const out: { outputName?: string; verify?: boolean } = {};
  if (params.has("out")) out.outputName = params.get("out")!;
  if (params.has("verify")) out.verify = params.get("verify") === "true";
  return out;
}
