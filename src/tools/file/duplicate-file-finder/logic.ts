/**
 * Duplicate File Finder — pure logic for grouping duplicate files by size + hash.
 *
 * Uses WebCrypto (SHA-256). Two-phase: partial hash (first 4KB) as quick filter,
 * then full hash for confirmation.
 */

export type SortKey = "size" | "name" | "date" | "none";

export interface FileEntry {
  /** Stable id (useful for React keys). */
  id: string;
  /** File name (no path). */
  name: string;
  /** Last modified timestamp (ms). */
  lastModified: number;
  /** Byte size. */
  size: number;
  /** Reference to the underlying File (for hashing + delete). */
  file: File;
  /** Partial SHA-256 hash of first 4KB (hex). */
  partialHash?: string;
  /** Full SHA-256 hash (hex). */
  fullHash?: string;
  /** Webkit relative path (if dropped from a folder). */
  relativePath?: string;
}

export interface DuplicateGroup {
  /** The full hash all members share. */
  hash: string;
  /** Size in bytes (all members identical). */
  size: number;
  /** Member files. */
  members: FileEntry[];
  /** Estimated space saved if all but first are removed. */
  spaceSaved: number;
}

export interface ScanStats {
  totalFiles: number;
  totalSize: number;
  duplicateGroups: number;
  duplicateFileCount: number;
  spaceSaved: number;
  skippedBySize: number;
  skippedByPartial: number;
}

export interface ScanOptions {
  /** Ignore files smaller than this many bytes. */
  minSizeBytes: number;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
}

export const DEFAULT_OPTIONS: ScanOptions = {
  minSizeBytes: 0,
  sortKey: "size",
  sortDir: "desc",
};

/** Convert bytes to hex string. */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Hash a Uint8Array with SHA-256 (hex output). */
export async function sha256(data: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("WebCrypto not available.");
  const digest = await subtle.digest("SHA-256", data as BufferSource);
  return bytesToHex(new Uint8Array(digest));
}

/** Read the first N bytes of a file. */
export async function readPartial(file: File, bytes: number = 4096): Promise<Uint8Array> {
  const slice = file.slice(0, Math.min(bytes, file.size));
  const buf = await slice.arrayBuffer();
  return new Uint8Array(buf);
}

/** Read entire file as Uint8Array. */
export async function readFull(file: File): Promise<Uint8Array> {
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}

/** Compute partial hash of first 4KB. */
export async function computePartialHash(file: File): Promise<string> {
  const bytes = await readPartial(file, 4096);
  return sha256(bytes);
}

/** Compute full SHA-256 hash of a file. */
export async function computeFullHash(file: File): Promise<string> {
  const bytes = await readFull(file);
  return sha256(bytes);
}

/** Group files by size. Returns Map<size, FileEntry[]>. */
export function groupBySize(files: FileEntry[]): Map<number, FileEntry[]> {
  const map = new Map<number, FileEntry[]>();
  for (const f of files) {
    if (!map.has(f.size)) map.set(f.size, []);
    map.get(f.size)!.push(f);
  }
  return map;
}

/** Group files by hash (full). Returns Map<hash, FileEntry[]>. */
export function groupByHash(files: FileEntry[]): Map<string, FileEntry[]> {
  const map = new Map<string, FileEntry[]>();
  for (const f of files) {
    if (!f.fullHash) continue;
    if (!map.has(f.fullHash)) map.set(f.fullHash, []);
    map.get(f.fullHash)!.push(f);
  }
  return map;
}

/** Filter files by minimum size. */
export function filterByMinSize(files: FileEntry[], minBytes: number): { kept: FileEntry[]; skipped: FileEntry[] } {
  const kept: FileEntry[] = [];
  const skipped: FileEntry[] = [];
  for (const f of files) {
    if (f.size >= minBytes) kept.push(f);
    else skipped.push(f);
  }
  return { kept, skipped };
}

/** Sort files by key + direction. */
export function sortFiles(files: FileEntry[], key: SortKey, dir: "asc" | "desc" = "desc"): FileEntry[] {
  const sorted = [...files];
  sorted.sort((a, b) => {
    let cmp = 0;
    if (key === "size") cmp = a.size - b.size;
    else if (key === "name") cmp = a.name.localeCompare(b.name);
    else if (key === "date") cmp = a.lastModified - b.lastModified;
    else return 0;
    return dir === "asc" ? cmp : -cmp;
  });
  return sorted;
}

/** Sort members within a duplicate group. */
export function sortGroupMembers(group: DuplicateGroup, key: SortKey, dir: "asc" | "desc"): DuplicateGroup {
  return { ...group, members: sortFiles(group.members, key, dir) };
}

/**
 * Run the full duplicate-finding pipeline.
 * Phase 1: filter by min size.
 * Phase 2: group by size — drop sizes with only one file (skippedBySize).
 * Phase 3: compute partial hash for files in size groups > 1.
 * Phase 4: within each size group, group by partial hash — drop partial groups with one file (skippedByPartial).
 * Phase 5: compute full hash for files in partial groups > 1.
 * Phase 6: group by full hash — groups with > 1 are duplicate groups.
 *
 * `onProgress` reports overall percent (0-100).
 */
export async function findDuplicates(
  files: FileEntry[],
  options: ScanOptions,
  onProgress?: (percent: number, phase: string) => void,
): Promise<{ groups: DuplicateGroup[]; stats: ScanStats }> {
  const { minSizeBytes, sortKey, sortDir } = options;

  // Phase 1: filter by size
  const { kept, skipped: skippedByMin } = filterByMinSize(files, minSizeBytes);
  let stats: ScanStats = {
    totalFiles: files.length,
    totalSize: files.reduce((s, f) => s + f.size, 0),
    duplicateGroups: 0,
    duplicateFileCount: 0,
    spaceSaved: 0,
    skippedBySize: skippedByMin.length,
    skippedByPartial: 0,
  };

  // Phase 2: group by size
  const sizeGroups = groupBySize(kept);
  const sizeCandidates: FileEntry[] = [];
  for (const [, group] of sizeGroups) {
    if (group.length > 1) sizeCandidates.push(...group);
  }
  // Files with unique size are not duplicates (counted as skippedBySize).
  stats.skippedBySize += kept.length - sizeCandidates.length;

  // Phase 3: partial hash
  let processed = 0;
  for (const f of sizeCandidates) {
    if (!f.partialHash) {
      f.partialHash = await computePartialHash(f.file);
    }
    processed++;
    if (onProgress) onProgress(Math.round((processed / sizeCandidates.length) * 50), "Partial hashing");
  }

  // Phase 4: group by partial hash within each size group
  const partialCandidates: FileEntry[] = [];
  for (const [, sizeGroup] of sizeGroups) {
    if (sizeGroup.length === 1) continue;
    const partialMap = new Map<string, FileEntry[]>();
    for (const f of sizeGroup) {
      const k = f.partialHash ?? "";
      if (!partialMap.has(k)) partialMap.set(k, []);
      partialMap.get(k)!.push(f);
    }
    for (const [, partialGroup] of partialMap) {
      if (partialGroup.length > 1) partialCandidates.push(...partialGroup);
      else stats.skippedByPartial++;
    }
  }

  // Phase 5: full hash
  processed = 0;
  for (const f of partialCandidates) {
    if (!f.fullHash) {
      f.fullHash = await computeFullHash(f.file);
    }
    processed++;
    if (onProgress) onProgress(50 + Math.round((processed / partialCandidates.length) * 50), "Full hashing");
  }

  // Phase 6: group by full hash
  const fullMap = groupByHash(partialCandidates);
  const groups: DuplicateGroup[] = [];
  for (const [hash, members] of fullMap) {
    if (members.length > 1) {
      const sortedMembers = sortFiles(members, sortKey, sortDir);
      groups.push({
        hash,
        size: members[0].size,
        members: sortedMembers,
        spaceSaved: members[0].size * (members.length - 1),
      });
    }
  }

  // Sort groups (largest space saved first)
  groups.sort((a, b) => b.spaceSaved - a.spaceSaved);

  stats = {
    ...stats,
    duplicateGroups: groups.length,
    duplicateFileCount: groups.reduce((s, g) => s + g.members.length, 0),
    spaceSaved: groups.reduce((s, g) => s + g.spaceSaved, 0),
  };

  if (onProgress) onProgress(100, "Done");
  return { groups, stats };
}

/** Format bytes as human-readable. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Convert DuplicateGroups to CSV. */
export function groupsToCsv(groups: DuplicateGroup[]): string {
  const header = "group_hash,file_name,size_bytes,size_human,last_modified,relative_path";
  const lines: string[] = [header];
  for (const g of groups) {
    for (const m of g.members) {
      const name = m.name.replace(/"/g, '""');
      const path = (m.relativePath ?? m.name).replace(/"/g, '""');
      lines.push(`"${g.hash}","${name}",${m.size},"${formatBytes(m.size)}",${new Date(m.lastModified).toISOString()},"${path}"`);
    }
  }
  return lines.join("\n");
}

/** Convert DuplicateGroups to JSON. */
export function groupsToJson(groups: DuplicateGroup[], stats: ScanStats): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    stats,
    groups: groups.map((g) => ({
      hash: g.hash,
      size: g.size,
      sizeHuman: formatBytes(g.size),
      spaceSaved: g.spaceSaved,
      members: g.members.map((m) => ({
        name: m.name,
        size: m.size,
        lastModified: new Date(m.lastModified).toISOString(),
        relativePath: m.relativePath ?? m.name,
      })),
    })),
  }, null, 2);
}

/** Generate stable id for a file (useful for React keys). */
export function generateFileId(name: string, size: number, lastModified: number, index: number): string {
  return `${index}-${name}-${size}-${lastModified}`;
}

/** Build a FileEntry[] from a dropped FileList. */
export function buildFileEntries(fileList: File[]): FileEntry[] {
  return fileList.map((file, i) => ({
    id: generateFileId(file.name, file.size, file.lastModified, i),
    name: file.name,
    lastModified: file.lastModified,
    size: file.size,
    file,
    relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || undefined,
  }));
}

// ===== History (localStorage) =====
const HISTORY_KEY = "unqtools-dup-finder-history";
const MAX_HISTORY = 10;

export interface DupHistoryEntry {
  fileCount: number;
  duplicateGroups: number;
  spaceSaved: number;
  scannedAt: string;
}

export function loadHistory(): DupHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch { return []; }
}

export function saveToHistory(entry: DupHistoryEntry): DupHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const updated = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
}

/** Build a shareable URL with scan settings. */
export function buildShareUrl(options: ScanOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  params.set("min", String(options.minSizeBytes));
  params.set("sort", options.sortKey);
  params.set("dir", options.sortDir);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}
