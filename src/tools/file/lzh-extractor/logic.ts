/**
 * LZH Extractor — pure logic for LZH/LHA archive parsing (level 0, no compression).
 */

export interface LzhEntry {
  filename: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: string; // "-lh0-" = stored, "-lh1-" etc = compressed
  crc: number;
  timestamp: Date;
  offset: number;
}

export interface LzhArchive {
  entries: LzhEntry[];
  isValid: boolean;
  error?: string;
}

/** Parse an LZH/LHA archive header (level 0). */
export function parseLzh(bytes: Uint8Array): LzhArchive {
  if (bytes.length < 23) {
    return { entries: [], isValid: false, error: "File too small to be an LZH archive." };
  }
  const entries: LzhEntry[] = [];
  let offset = 0;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  while (offset < bytes.length) {
    // Level 0 header: headerSize (1 byte) + checksum (1) + method (5) + compressedSize (4) + uncompressedSize (4) + timestamp (4) + attributes (1) + level (1) + filename length (1) + filename + ... 
    const headerSize = bytes[offset];
    if (headerSize === 0) break; // End of archive
    if (offset + headerSize + 2 > bytes.length) break;

    const method = String.fromCharCode(...bytes.slice(offset + 2, offset + 7));
    if (!method.startsWith("-lh")) {
      // Not a valid LZH entry
      offset += headerSize + 2;
      continue;
    }

    const compressedSize = dv.getUint32(offset + 7, true); // little-endian
    const uncompressedSize = dv.getUint32(offset + 11, true);
    const timestamp = new Date(dv.getUint32(offset + 15, true) * 1000);

    const level = bytes[offset + 20];
    if (level !== 0) {
      // Only level 0 supported
      offset += headerSize + 2 + compressedSize;
      continue;
    }

    const nameLen = bytes[offset + 21];
    const filename = String.fromCharCode(...bytes.slice(offset + 22, offset + 22 + nameLen));

    const crc = dv.getUint16(offset + 22 + nameLen, true);

    entries.push({
      filename,
      compressedSize,
      uncompressedSize,
      compressionMethod: method,
      crc,
      timestamp,
      offset: offset + headerSize + 2,
    });

    offset += headerSize + 2 + compressedSize;
  }

  if (entries.length === 0) {
    return { entries: [], isValid: false, error: "No valid LZH entries found. Only level 0 (stored) is supported." };
  }

  return { entries, isValid: true };
}

/** Extract a single file from LZH archive (level 0 / stored only). */
export function extractLzhEntry(bytes: Uint8Array, entry: LzhEntry): Uint8Array | null {
  if (entry.compressionMethod !== "-lh0-") {
    return null; // Only stored (uncompressed) is supported
  }
  const end = entry.offset + entry.uncompressedSize;
  if (end > bytes.length) return null;
  return bytes.slice(entry.offset, end);
}

/** Check if LZH archive has compressed entries. */
export function hasCompressedEntries(archive: LzhArchive): boolean {
  return archive.entries.some((e) => e.compressionMethod !== "-lh0-");
}

/** Get archive stats. */
export function getLzhStats(archive: LzhArchive) {
  const fileCount = archive.entries.length;
  const totalUncompressed = archive.entries.reduce((sum, e) => sum + e.uncompressedSize, 0);
  const totalCompressed = archive.entries.reduce((sum, e) => sum + e.compressedSize, 0);
  const compressedCount = archive.entries.filter((e) => e.compressionMethod !== "-lh0-").length;
  return { fileCount, totalUncompressed, totalCompressed, compressedCount };
}

/** Format bytes. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** History (localStorage). */
const HISTORY_KEY = "unqtools-lzh-history";
const MAX_HISTORY = 10;

export interface HistoryEntry { filename: string; fileCount: number; extractedAt: string; }

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try { const raw = localStorage.getItem(HISTORY_KEY); if (!raw) return []; return JSON.parse(raw).slice(0, MAX_HISTORY) ?? []; } catch { return []; }
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

/** Build shareable URL. */
export function buildShareUrl(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}`;
}
