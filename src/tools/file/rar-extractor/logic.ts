/**
 * RAR Extractor — pure-JS RAR archive inspector.
 *
 * Reuses the RAR4/RAR5 header parser from cbr-comic-book-reader (which is
 * the canonical RAR parser for this codebase).
 *
 * HONESTY CLAUSE: We parse RAR4 and RAR5 headers and list file entries.
 * RAR compression is proprietary — full extraction requires WASM. Documented
 * in FAQ.
 */

export {
  RAR4_SIGNATURE, RAR5_SIGNATURE,
  isRar4Signature, isRar5Signature, detectRarVersion, isRarFile,
  decodeVint, parseRar4, parseRar5,
  type RarVersion, type RarEntry, type RarArchiveInfo,
} from "../cbr-comic-book-reader/logic";

import {
  parseRar, formatBytes as formatBytesBase,
  buildShareUrl as buildShareUrlBase,
  type RarArchiveInfo,
} from "../cbr-comic-book-reader/logic";

// Re-export commonly used functions with the rar-extractor history key
export { parseRar };
export const formatBytes = formatBytesBase;

// ===== RAR-specific method names =====

const RAR4_METHOD_NAMES: Record<number, string> = {
  0x30: "Stored",
  0x31: "Fastest",
  0x32: "Fast",
  0x33: "Normal",
  0x34: "Good",
  0x35: "Best",
};

const RAR5_METHOD_NAMES: Record<number, string> = {
  0: "Stored",
  1: "Fastest",
  2: "Fast",
  3: "Normal",
  4: "Good",
  5: "Best",
};

/** Get a human-readable method name for a RAR compression method ID. */
export function getRarMethodName(method: number | null, version: "rar4" | "rar5"): string {
  if (method === null) return "Unknown";
  if (version === "rar4") {
    return RAR4_METHOD_NAMES[method] ?? `Method 0x${method.toString(16)}`;
  }
  return RAR5_METHOD_NAMES[method] ?? `Method ${method}`;
}

// ===== History (localStorage) — separate key from CBR =====

const HISTORY_KEY = "unqtools-rar-extractor-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  fileSize: number;
  version: "rar4" | "rar5";
  fileCount: number;
  isEncrypted: boolean;
  isSolid: boolean;
  inspectedAt: string;
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
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
}

// ===== Shareable URL =====

export function buildShareUrl(): string {
  return buildShareUrlBase();
}

export function parseShareUrl(hash: string): boolean | null {
  if (!hash || !hash.startsWith("#")) return null;
  return hash === "#inspect";
}

// ===== Top-level inspect =====

export interface RarInspectResult {
  archive: RarArchiveInfo;
  fileSize: number;
}

/** Inspect a RAR archive. Wraps parseRar with file-size info. */
export function inspectRar(bytes: Uint8Array): RarInspectResult {
  const archive = parseRar(bytes);
  return { archive, fileSize: bytes.length };
}
