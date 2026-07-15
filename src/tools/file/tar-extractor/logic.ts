/**
 * TAR Extractor — pure-JS TAR (USTAR) parser. No WASM, no native deps.
 *
 * TAR format (USTAR — POSIX IEEE P1003.2):
 *   Each entry = 512-byte header block + N×512-byte data blocks.
 *   End-of-archive marker = two 512-byte zero blocks.
 *
 * Header layout (offsets in bytes):
 *    0   name        100 bytes
 *  100   mode          8 bytes (octal)
 *  108   uid           8 bytes (octal)
 *  116   gid           8 bytes (octal)
 *  124   size         12 bytes (octal)
 *  136   mtime        12 bytes (octal, Unix seconds)
 *  148   checksum      8 bytes (octal; sum of all header bytes with checksum field as spaces)
 *  156   typeflag      1 byte  ('0' or '\0' = regular file, '1' = hard link, '2' = symlink, '5' = dir)
 *  157   linkname    100 bytes
 *  257   magic         6 bytes ("ustar\0" or "ustar  \0")
 *  263   version       2 bytes ("00")
 *  265   uname        32 bytes
 *  297   gname        32 bytes
 *  329   devmajor      8 bytes
 *  337   devminor      8 bytes
 *  345   prefix      155 bytes (prepended to name with '/')
 *  500   padding      12 bytes
 *
 * GNU extensions (typeflag):
 *   'L' — Long name: next entry's data is the long filename for the entry after it
 *   'K' — Long linkname: similar but for linkname
 *
 * PAX extensions (typeflag):
 *   'x' — PAX extended header (key=value records in the data block)
 *   'g' — PAX global extended header
 */

export type TarFileType =
  | "regular"
  | "hardlink"
  | "symlink"
  | "chardev"
  | "blockdev"
  | "directory"
  | "fifo"
  | "contiguous"
  | "gnu-longname"
  | "gnu-longlink"
  | "pax-header"
  | "pax-global"
  | "unknown";

const TAR_TYPE_MAP: Record<string, TarFileType> = {
  "0": "regular",
  "\0": "regular",
  "1": "hardlink",
  "2": "symlink",
  "3": "chardev",
  "4": "blockdev",
  "5": "directory",
  "6": "fifo",
  "7": "contiguous",
  L: "gnu-longname",
  K: "gnu-longlink",
  x: "pax-header",
  g: "pax-global",
};

export interface TarEntry {
  /** Full file path (prefix + '/' + name for USTAR). */
  name: string;
  /** Original name field (without prefix). */
  baseName: string;
  /** Prefix field from USTAR header. */
  prefix: string;
  /** File size in bytes. */
  size: number;
  /** Type flag byte (raw character). */
  typeflag: string;
  /** Decoded type description. */
  type: TarFileType;
  /** Whether this entry is a regular file we can extract. */
  isRegularFile: boolean;
  /** File mode (permissions) as octal number. */
  mode: number;
  /** Modification time (Unix seconds). */
  mtime: number;
  /** Owner UID. */
  uid: number;
  /** Group GID. */
  gid: number;
  /** Owner username (from uname field). */
  uname: string;
  /** Group name (from gname field). */
  gname: string;
  /** Link target (for symlinks and hard links). */
  linkname: string;
  /** Magic field ("ustar" for USTAR archives). */
  magic: string;
  /** Whether this entry uses the USTAR format. */
  isUstar: boolean;
  /** Byte offset where the file data starts in the archive. */
  dataOffset: number;
  /** Computed header checksum (for validation). */
  computedChecksum: number;
  /** Stored header checksum (from the checksum field). */
  storedChecksum: number;
  /** True if the stored checksum matches the computed checksum. */
  checksumValid: boolean;
}

// ===== Field decoding =====

/** Parse a NUL/space-terminated octal field. Returns 0 on empty/invalid. */
export function parseOctal(bytes: Uint8Array, offset: number, width: number): number {
  let s = "";
  for (let i = 0; i < width; i++) {
    const b = bytes[offset + i];
    if (b === 0 || b === 0x20) break;
    if (b < 0x30 || b > 0x37) {
      // Non-octal character — stop. Some producers (old GNU) put binary here
      // for sizes >8GB but we don't support that.
      break;
    }
    s += String.fromCharCode(b);
  }
  return s.length === 0 ? 0 : parseInt(s, 8);
}

/** Decode a NUL-terminated string field. */
export function decodeField(bytes: Uint8Array, offset: number, width: number): string {
  const end = offset + width;
  let nul = end;
  for (let i = offset; i < end; i++) {
    if (bytes[i] === 0) { nul = i; break; }
  }
  return new TextDecoder("utf-8").decode(bytes.subarray(offset, nul));
}

/** Compute the checksum of a 512-byte TAR header block. */
export function computeChecksum(header: Uint8Array): number {
  // The checksum field (offset 148, 8 bytes) is treated as 8 spaces (0x20).
  let sum = 0;
  for (let i = 0; i < 512; i++) {
    if (i >= 148 && i < 156) {
      sum += 0x20;
    } else if (i < header.length) {
      sum += header[i]!;
    }
  }
  return sum;
}

/** Format an octal mode as a 4-digit string (e.g. "0644"). */
export function formatMode(mode: number): string {
  const octal = (mode & 0o7777).toString(8);
  // Pad to at least 3 digits, then prepend '0' for the typical 4-char display.
  return "0" + octal.padStart(3, "0");
}

/** Convert Unix seconds to ISO date string. */
export function formatMtime(seconds: number): string {
  if (seconds === 0) return "—";
  try {
    return new Date(seconds * 1000).toISOString();
  } catch {
    return "—";
  }
}

// ===== TAR header parsing =====

/**
 * Parse a TAR archive into a list of entries. Handles GNU long-name records
 * (typeflag 'L') and skips PAX extended headers (typeflag 'x' / 'g').
 * Stops at the end-of-archive marker (two consecutive zero blocks).
 */
export function parseTarEntries(bytes: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  let pos = 0;
  // Pending long-name from a GNU 'L' entry that applies to the NEXT entry.
  let pendingLongName: string | null = null;
  let pendingLongLink: string | null = null;

  while (pos + 512 <= bytes.length) {
    // Check for end-of-archive marker (all-zero block)
    let allZero = true;
    for (let i = pos; i < pos + 512; i++) {
      if (bytes[i] !== 0) { allZero = false; break; }
    }
    if (allZero) break;

    const header = bytes.subarray(pos, pos + 512);
    const baseName = decodeField(bytes, pos, 100);
    const mode = parseOctal(bytes, pos + 100, 8);
    const uid = parseOctal(bytes, pos + 108, 8);
    const gid = parseOctal(bytes, pos + 116, 8);
    const size = parseOctal(bytes, pos + 124, 12);
    const mtime = parseOctal(bytes, pos + 136, 12);
    const storedChecksum = parseOctal(bytes, pos + 148, 8);
    const computedChecksum = computeChecksum(header);
    const typeflagByte = bytes[pos + 156] ?? 0;
    const typeflag = String.fromCharCode(typeflagByte);
    const linkname = decodeField(bytes, pos + 157, 100);
    const magic = decodeField(bytes, pos + 257, 6);
    const version = decodeField(bytes, pos + 263, 2);
    const uname = decodeField(bytes, pos + 265, 32);
    const gname = decodeField(bytes, pos + 297, 32);
    const prefix = decodeField(bytes, pos + 345, 155);

    const isUstar = magic.startsWith("ustar");
    const type = TAR_TYPE_MAP[typeflag] ?? "unknown";
    const dataOffset = pos + 512;
    const fullName = prefix && isUstar ? `${prefix}/${baseName}` : baseName;
    void version;

    // Handle GNU long-name records: their data is the long name for the next entry
    if (type === "gnu-longname" || type === "gnu-longlink") {
      const dataBytes = bytes.subarray(dataOffset, dataOffset + size);
      const longStr = new TextDecoder("utf-8").decode(dataBytes).replace(/\0.*$/, "");
      if (type === "gnu-longname") pendingLongName = longStr;
      else pendingLongLink = longStr;
      // Advance past header + data
      const dataBlocks = Math.ceil(size / 512);
      pos += 512 + dataBlocks * 512;
      continue;
    }

    // Skip PAX extended headers (we don't process key/value records, but
    // we respect their data size to advance past them).
    if (type === "pax-header" || type === "pax-global") {
      const dataBlocks = Math.ceil(size / 512);
      pos += 512 + dataBlocks * 512;
      continue;
    }

    const effectiveName = pendingLongName ?? fullName;
    const effectiveLink = pendingLongLink ?? linkname;
    pendingLongName = null;
    pendingLongLink = null;

    entries.push({
      name: effectiveName,
      baseName,
      prefix,
      size,
      typeflag,
      type,
      isRegularFile: type === "regular" || type === "contiguous",
      mode,
      mtime,
      uid,
      gid,
      uname,
      gname,
      linkname: effectiveLink,
      magic,
      isUstar,
      dataOffset,
      computedChecksum,
      storedChecksum,
      checksumValid: computedChecksum === storedChecksum,
    });

    // Advance past header + data, rounded up to 512-byte boundary
    const dataBlocks = Math.ceil(size / 512);
    pos += 512 + dataBlocks * 512;
  }

  return entries;
}

/** Extract the data for a single TAR entry. Returns the raw bytes. */
export function extractTarEntry(bytes: Uint8Array, entry: TarEntry): Uint8Array {
  return bytes.subarray(entry.dataOffset, entry.dataOffset + entry.size);
}

// ===== Archive validation =====

/** Check if bytes look like a TAR archive (USTAR magic at offset 257). */
export function isTarArchive(bytes: Uint8Array): boolean {
  if (bytes.length < 265) return false;
  const magic = decodeField(bytes, 257, 6);
  if (magic.startsWith("ustar")) return true;
  // For non-USTAR (old V7 format), accept if checksum is valid
  return validateChecksum(bytes, 0);
}

/** Validate the checksum of a single 512-byte TAR header block. */
export function validateChecksum(bytes: Uint8Array, offset: number): boolean {
  if (offset + 512 > bytes.length) return false;
  const header = bytes.subarray(offset, offset + 512);
  const stored = parseOctal(bytes, offset + 148, 8);
  const computed = computeChecksum(header);
  return stored === computed && stored !== 0;
}

// ===== File tree =====

export interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: TreeNode[];
  entry?: TarEntry;
}

/**
 * Build a file tree from TAR entries. Directories are inferred from path
 * components even if no explicit directory entry exists in the TAR.
 */
export function buildFileTree(entries: TarEntry[]): TreeNode {
  const root: TreeNode = { name: "", path: "", isDirectory: true, children: [] };
  for (const entry of entries) {
    const parts = entry.name.split("/").filter((p) => p.length > 0);
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isLast = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");
      let child = current.children.find((c) => c.name === part && c.isDirectory === (!isLast || entry.type === "directory"));
      if (!child) {
        child = {
          name: part,
          path,
          isDirectory: !isLast || entry.type === "directory",
          children: [],
          entry: isLast && entry.type !== "directory" ? entry : undefined,
        };
        current.children.push(child);
      }
      current = child;
    }
  }
  // Sort: directories first, then alphabetically
  const sortRecursive = (node: TreeNode) => {
    node.children.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const c of node.children) sortRecursive(c);
  };
  sortRecursive(root);
  return root;
}

// ===== Stats =====

export interface TarStats {
  entryCount: number;
  regularFileCount: number;
  directoryCount: number;
  symlinkCount: number;
  otherCount: number;
  totalExtractedSize: number;
  archiveSize: number;
  /** Ratio of extracted size to archive size (>= 1.0 typically, since TAR has no compression). */
  ratio: number;
  largestFileName: string;
  largestFileSize: number;
  invalidChecksumCount: number;
}

export function computeStats(entries: TarEntry[], archiveSize: number): TarStats {
  let regularFileCount = 0;
  let directoryCount = 0;
  let symlinkCount = 0;
  let otherCount = 0;
  let totalExtractedSize = 0;
  let largestFileName = "";
  let largestFileSize = 0;
  let invalidChecksumCount = 0;

  for (const e of entries) {
    if (!e.checksumValid) invalidChecksumCount++;
    if (e.type === "regular" || e.type === "contiguous") {
      regularFileCount++;
      totalExtractedSize += e.size;
      if (e.size > largestFileSize) {
        largestFileSize = e.size;
        largestFileName = e.name;
      }
    } else if (e.type === "directory") {
      directoryCount++;
    } else if (e.type === "symlink") {
      symlinkCount++;
    } else {
      otherCount++;
    }
  }
  const ratio = archiveSize > 0 ? totalExtractedSize / archiveSize : 0;
  return {
    entryCount: entries.length,
    regularFileCount,
    directoryCount,
    symlinkCount,
    otherCount,
    totalExtractedSize,
    archiveSize,
    ratio,
    largestFileName,
    largestFileSize,
    invalidChecksumCount,
  };
}

// ===== MIME detection from filename =====

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
  if (lower.endsWith(".gz")) return "application/gzip";
  if (lower.endsWith(".tar")) return "application/x-tar";
  return "application/octet-stream";
}

// ===== Preview =====

export interface PreviewResult {
  text: string;
  isText: boolean;
  hex: string;
  previewSize: number;
  totalSize: number;
  truncated: boolean;
}

/** Generate a preview of file contents (text or hex dump). */
export function previewFile(data: Uint8Array, maxBytes = 8192): PreviewResult {
  const previewSize = Math.min(data.length, maxBytes);
  const slice = data.subarray(0, previewSize);
  const isText = looksLikeText(slice);
  let text = "";
  let hex = "";
  if (isText) {
    text = new TextDecoder("utf-8", { fatal: false }).decode(slice);
  } else {
    // Hex dump (16 bytes per line)
    const lines: string[] = [];
    for (let i = 0; i < slice.length; i += 16) {
      const lineBytes = slice.subarray(i, Math.min(i + 16, slice.length));
      const hexPart = Array.from(lineBytes).map((b) => b.toString(16).padStart(2, "0")).join(" ");
      const asciiPart = Array.from(lineBytes).map((b) => b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : ".").join("");
      lines.push(`${i.toString(16).padStart(8, "0")}  ${hexPart.padEnd(48, " ")}  ${asciiPart}`);
    }
    hex = lines.join("\n");
  }
  return {
    text,
    isText,
    hex,
    previewSize,
    totalSize: data.length,
    truncated: data.length > maxBytes,
  };
}

/** Heuristic: check if a buffer is mostly ASCII printable / common whitespace. */
export function looksLikeText(bytes: Uint8Array, sampleSize = 1024): boolean {
  const sample = bytes.subarray(0, Math.min(bytes.length, sampleSize));
  if (sample.length === 0) return false;
  let printable = 0;
  for (const b of sample) {
    if (b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b <= 0x7e)) printable++;
  }
  return printable / sample.length > 0.85;
}

// ===== Filtering / search =====

export function searchEntries(entries: TarEntry[], query: string): TarEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) => e.name.toLowerCase().includes(q));
}

export type FileTypeFilter = "all" | "regular" | "directory" | "symlink" | "other";

export function filterByType(entries: TarEntry[], filter: FileTypeFilter): TarEntry[] {
  if (filter === "all") return entries;
  if (filter === "regular") return entries.filter((e) => e.type === "regular" || e.type === "contiguous");
  if (filter === "directory") return entries.filter((e) => e.type === "directory");
  if (filter === "symlink") return entries.filter((e) => e.type === "symlink");
  return entries.filter((e) => e.type !== "regular" && e.type !== "contiguous" && e.type !== "directory" && e.type !== "symlink");
}

// ===== Utilities =====

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatRatio(value: number): string {
  return `${value.toFixed(2)}×`;
}

// ===== History (localStorage) =====

const HISTORY_KEY = "unqtools-tar-extractor-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  archiveSize: number;
  entryCount: number;
  regularFileCount: number;
  totalExtractedSize: number;
  extractedAt: string;
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
  filter: FileTypeFilter;
  search: string;
}

export function buildShareUrl(opts: ShareOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  if (opts.filter !== "all") params.set("filter", opts.filter);
  if (opts.search) params.set("q", opts.search);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareOptions | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("filter") && !params.has("q")) return null;
  const filter = (params.get("filter") ?? "all") as FileTypeFilter;
  const validFilters: FileTypeFilter[] = ["all", "regular", "directory", "symlink", "other"];
  return {
    filter: validFilters.includes(filter) ? filter : "all",
    search: params.get("q") ?? "",
  };
}

// ===== ZIP writer (for "download all as ZIP") =====

function crc32Zip(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function createZipBlob(files: Array<{ name: string; data: Uint8Array }>): Blob {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const enc = new TextEncoder();

  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const c = crc32Zip(file.data);
    const size = file.data.length;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true); // STORE
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, c, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader);
    localParts.push(file.data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, c, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + file.data.length;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const centralOffset = offset;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  ev.setUint16(20, 0, true);

  const allParts = [...localParts, ...centralParts, eocd];
  const totalLength = allParts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(totalLength);
  let pos = 0;
  for (const p of allParts) {
    out.set(p, pos);
    pos += p.length;
  }
  return new Blob([out as BlobPart], { type: "application/zip" });
}

/** Build a ZIP from all regular-file TAR entries. */
export function buildZipFromTar(bytes: Uint8Array, entries: TarEntry[]): Blob {
  const files: Array<{ name: string; data: Uint8Array }> = [];
  for (const e of entries) {
    if (e.isRegularFile) {
      files.push({ name: e.name, data: extractTarEntry(bytes, e) });
    }
  }
  return createZipBlob(files);
}
