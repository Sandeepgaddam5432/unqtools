/**
 * DEB Extractor — pure-JS AR archive parser for Debian .deb packages.
 *
 * AR format (Unix ar, see /usr/include/ar.h):
 *   Global header: 8 bytes magic "!<arch>\n"
 *   Per member: 60-byte header followed by file data.
 *
 * Member header layout (60 bytes):
 *    0  name            16 bytes (terminated by '/' for short names, or "/N" for long names)
 *   16  mtime           12 bytes (decimal Unix seconds)
 *   28  uid              6 bytes (decimal)
 *   34  gid              6 bytes (decimal)
 *   40  mode             8 bytes (octal)
 *   48  size            10 bytes (decimal)
 *   58  fmag             2 bytes ("`\n" — end-of-header marker)
 *
 * Data follows immediately after the 60-byte header, padded to a 2-byte boundary
 * with a single '\n' byte if size is odd.
 *
 * BSD long-name extension: a member named "#1/N" stores the actual long name in
 * the first N bytes of its data. GNU long-name extension: a member named "//"
 * stores a list of long names separated by '/\n'; subsequent members with names
 * like "/N" reference the Nth offset in the long-name table.
 *
 * DEB-specific layout (3 members):
 *   1. debian-binary     — plain text, contains "2.0\n"
 *   2. control.tar.gz    — TAR with control file + maintainer scripts
 *   3. data.tar.gz       — TAR with the actual filesystem payload
 */

export const AR_MAGIC = "!<arch>\n";
export const AR_MAGIC_BYTES = new Uint8Array([0x21, 0x3c, 0x61, 0x72, 0x63, 0x68, 0x3e, 0x0a]);
export const AR_HEADER_SIZE = 60;
export const AR_FMAG = "`\n";

export interface ArMember {
  /** Raw name field (16 bytes, may include trailing '/' or whitespace). */
  rawName: string;
  /** Resolved member name (long-name extension resolved, trailing '/' stripped). */
  name: string;
  /** Modification timestamp (Unix seconds). */
  mtime: number;
  /** Owner UID. */
  uid: number;
  /** Group GID. */
  gid: number;
  /** File mode (octal). */
  mode: number;
  /** File size in bytes. */
  size: number;
  /** Byte offset where member data starts (after the 60-byte header). */
  dataOffset: number;
  /** Whether the header fmag marker is valid. */
  fmagValid: boolean;
  /** True if this member is a special GNU/BSD long-name table. */
  isLongNameTable: boolean;
}

// ===== Field parsing =====

function decodeAscii(bytes: Uint8Array, offset: number, width: number): string {
  const slice = bytes.subarray(offset, offset + width);
  let s = "";
  for (const b of slice) {
    if (b === 0) break;
    s += String.fromCharCode(b);
  }
  return s;
}

function parseDecimalField(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  const n = parseInt(trimmed, 10);
  return isNaN(n) ? 0 : n;
}

function parseOctalField(s: string): number {
  const trimmed = s.trim();
  if (!trimmed) return 0;
  const n = parseInt(trimmed, 8);
  return isNaN(n) ? 0 : n;
}

/** Check whether the bytes start with the AR magic. */
export function isArArchive(bytes: Uint8Array): boolean {
  if (bytes.length < AR_MAGIC_BYTES.length) return false;
  for (let i = 0; i < AR_MAGIC_BYTES.length; i++) {
    if (bytes[i] !== AR_MAGIC_BYTES[i]) return false;
  }
  return true;
}

// ===== Member parsing =====

export function parseArMembers(bytes: Uint8Array): ArMember[] {
  if (!isArArchive(bytes)) {
    throw new Error("Not an AR archive — missing '!<arch>\\n' magic.");
  }
  const members: ArMember[] = [];
  let pos = AR_MAGIC_BYTES.length;
  // GNU long-name table (member named "//")
  let gnuLongNames = "";
  while (pos + AR_HEADER_SIZE <= bytes.length) {
    const rawName = decodeAscii(bytes, pos, 16);
    const mtimeStr = decodeAscii(bytes, pos + 16, 12);
    const uidStr = decodeAscii(bytes, pos + 28, 6);
    const gidStr = decodeAscii(bytes, pos + 34, 6);
    const modeStr = decodeAscii(bytes, pos + 40, 8);
    const sizeStr = decodeAscii(bytes, pos + 48, 10);
    const fmag = decodeAscii(bytes, pos + 58, 2);
    const size = parseDecimalField(sizeStr);
    const dataOffset = pos + AR_HEADER_SIZE;
    if (fmag !== AR_FMAG) {
      // Not a valid header — stop.
      break;
    }
    const trimmedRaw = rawName.trim();
    let resolvedName = trimmedName(rawName);
    const isLongNameTable = trimmedRaw === "//" || trimmedRaw.startsWith("#1/");
    // Handle GNU long-name table: data is a list of names separated by "/\n"
    if (trimmedRaw === "//") {
      const dataBytes = bytes.subarray(dataOffset, dataOffset + size);
      gnuLongNames = new TextDecoder("latin1").decode(dataBytes);
      members.push({
        rawName,
        name: "//",
        mtime: parseDecimalField(mtimeStr),
        uid: parseDecimalField(uidStr),
        gid: parseDecimalField(gidStr),
        mode: parseOctalField(modeStr),
        size,
        dataOffset,
        fmagValid: fmag === AR_FMAG,
        isLongNameTable,
      });
      pos = dataOffset + size + (size % 2);
      continue;
    }
    // Handle GNU long-name reference: "/N" → name at offset N in the long-name table
    if (trimmedRaw.startsWith("/") && /^\d+$/.test(trimmedRaw.slice(1))) {
      const offset = parseInt(trimmedRaw.slice(1), 10);
      const end = gnuLongNames.indexOf("/", offset);
      resolvedName = end >= 0 ? gnuLongNames.slice(offset, end) : gnuLongNames.slice(offset);
    }
    // Handle BSD long-name extension: "#1/N" → actual name is first N bytes of data
    if (trimmedRaw.startsWith("#1/")) {
      const nameLen = parseInt(trimmedRaw.slice(3), 10);
      if (!isNaN(nameLen) && nameLen > 0 && nameLen <= size) {
        const nameBytes = bytes.subarray(dataOffset, dataOffset + nameLen);
        resolvedName = new TextDecoder("utf-8").decode(nameBytes).replace(/\0+$/, "");
      }
    }
    members.push({
      rawName,
      name: resolvedName,
      mtime: parseDecimalField(mtimeStr),
      uid: parseDecimalField(uidStr),
      gid: parseDecimalField(gidStr),
      mode: parseOctalField(modeStr),
      size,
      dataOffset,
      fmagValid: fmag === AR_FMAG,
      isLongNameTable,
    });
    // Move to next member; data is padded to a 2-byte boundary with '\n'
    pos = dataOffset + size + (size % 2);
  }
  return members;
}

function trimmedName(raw: string): string {
  // AR names are often terminated by '/' (GNU) or whitespace.
  // Strip trailing slash and whitespace.
  return raw.replace(/\s+$/, "").replace(/\/$/, "");
}

/** Extract the data bytes of a single AR member. */
export function extractArMember(bytes: Uint8Array, member: ArMember): Uint8Array {
  const end = member.dataOffset + member.size;
  if (end > bytes.length) {
    return bytes.subarray(member.dataOffset);
  }
  return bytes.subarray(member.dataOffset, end);
}

// ===== DEB-specific helpers =====

export interface DebInfo {
  /** All AR members (including the special long-name table if present). */
  members: ArMember[];
  /** The debian-binary member, if present. */
  debianBinary: ArMember | null;
  /** The control.tar.* member, if present. */
  controlArchive: ArMember | null;
  /** The data.tar.* member, if present. */
  dataArchive: ArMember | null;
  /** Format version string from debian-binary (usually "2.0"). */
  debFormatVersion: string;
  /** Compression format of the control archive (gzip, xz, none). */
  controlCompression: "gzip" | "xz" | "zst" | "none";
  /** Compression format of the data archive. */
  dataCompression: "gzip" | "xz" | "zst" | "none";
  /** Total archive size in bytes. */
  archiveSize: number;
}

/** Classify a DEB member's compression based on its name. */
export function detectCompression(name: string): "gzip" | "xz" | "zst" | "none" {
  const lower = name.toLowerCase();
  if (lower.endsWith(".gz")) return "gzip";
  if (lower.endsWith(".xz")) return "xz";
  if (lower.endsWith(".zst")) return "zst";
  return "none";
}

/** Parse a DEB file's AR archive and identify the well-known members. */
export function parseDeb(bytes: Uint8Array): DebInfo {
  const members = parseArMembers(bytes);
  let debianBinary: ArMember | null = null;
  let controlArchive: ArMember | null = null;
  let dataArchive: ArMember | null = null;
  for (const m of members) {
    if (m.name === "debian-binary") debianBinary = m;
    else if (m.name.startsWith("control.tar")) controlArchive = m;
    else if (m.name.startsWith("data.tar")) dataArchive = m;
  }
  let debFormatVersion = "";
  if (debianBinary) {
    const data = extractArMember(bytes, debianBinary);
    debFormatVersion = new TextDecoder("utf-8").decode(data).trim();
  }
  return {
    members,
    debianBinary,
    controlArchive,
    dataArchive,
    debFormatVersion,
    controlCompression: controlArchive ? detectCompression(controlArchive.name) : "none",
    dataCompression: dataArchive ? detectCompression(dataArchive.name) : "none",
    archiveSize: bytes.length,
  };
}

// ===== Control file parsing (RFC 822) =====

export interface ControlInfo {
  /** All key/value fields from the control file (preserved order). */
  fields: Array<{ key: string; value: string }>;
  /** Convenience accessor: get a field value by key (case-insensitive). */
  package: string;
  version: string;
  architecture: string;
  maintainer: string;
  description: string;
  depends: string;
  installedSize: string;
  section: string;
  priority: string;
  homepage: string;
  /** True if a control file was successfully found and parsed. */
  controlFound: boolean;
}

/** Parse an RFC 822-style Debian control file. Handles line continuations (leading space). */
export function parseControl(text: string): ControlInfo {
  const result: ControlInfo = {
    fields: [],
    package: "",
    version: "",
    architecture: "",
    maintainer: "",
    description: "",
    depends: "",
    installedSize: "",
    section: "",
    priority: "",
    homepage: "",
    controlFound: true,
  };
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const logicalLines: string[] = [];
  for (const line of lines) {
    if (line === "") continue;
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (logicalLines.length > 0) {
        logicalLines[logicalLines.length - 1] += "\n" + line.slice(1);
      }
    } else {
      logicalLines.push(line);
    }
  }
  for (const line of logicalLines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    result.fields.push({ key, value });
    const lower = key.toLowerCase();
    if (lower === "package") result.package = value;
    else if (lower === "version") result.version = value;
    else if (lower === "architecture") result.architecture = value;
    else if (lower === "maintainer") result.maintainer = value;
    else if (lower === "description") result.description = value;
    else if (lower === "depends") result.depends = value;
    else if (lower === "installed-size") result.installedSize = value;
    else if (lower === "section") result.section = value;
    else if (lower === "priority") result.priority = value;
    else if (lower === "homepage") result.homepage = value;
  }
  return result;
}

// ===== GZIP decompression via DecompressionStream =====

/** Inflate a GZIP-compressed buffer using the browser's native DecompressionStream. */
export async function inflateGzip(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("DecompressionStream is not available in this environment.");
  }
  const stream = new DecompressionStream("gzip");
  const writer = stream.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) {
    out.set(c, pos);
    pos += c.length;
  }
  return out;
}

// ===== TAR parsing (re-implementation for self-containment) =====

export interface TarEntry {
  name: string;
  size: number;
  typeflag: string;
  dataOffset: number;
}

/** Parse a USTAR TAR archive into entries (without extracting data). */
export function parseTarEntries(bytes: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  let pos = 0;
  while (pos + 512 <= bytes.length) {
    let allZero = true;
    for (let i = pos; i < pos + 512; i++) {
      if (bytes[i] !== 0) { allZero = false; break; }
    }
    if (allZero) break;
    const name = decodeField(bytes, pos, 100);
    const size = parseOctalField(decodeField(bytes, pos + 124, 12));
    const typeflag = String.fromCharCode(bytes[pos + 156] ?? 0);
    const dataOffset = pos + 512;
    entries.push({ name, size, typeflag, dataOffset });
    const dataBlocks = Math.ceil(size / 512);
    pos = dataOffset + dataBlocks * 512;
  }
  return entries;
}

function decodeField(bytes: Uint8Array, offset: number, width: number): string {
  let s = "";
  for (let i = 0; i < width; i++) {
    const b = bytes[offset + i];
    if (b === 0) break;
    s += String.fromCharCode(b);
  }
  return s;
}

/** Find the control file inside a control.tar.* archive (after decompression). */
export function findControlFile(tarEntries: TarEntry[]): TarEntry | null {
  for (const e of tarEntries) {
    const normalized = e.name.replace(/^\.\//, "");
    if (normalized === "control" || normalized === "./control") return e;
  }
  return null;
}

// ===== Stats =====

export interface DebStats {
  memberCount: number;
  totalSize: number;
  archiveSize: number;
  largestMemberName: string;
  largestMemberSize: number;
  debianBinaryFound: boolean;
  controlArchiveFound: boolean;
  dataArchiveFound: boolean;
  hasXz: boolean;
}

export function computeStats(info: DebInfo): DebStats {
  let totalSize = 0;
  let largestName = "";
  let largestSize = 0;
  let hasXz = false;
  for (const m of info.members) {
    if (m.isLongNameTable) continue;
    totalSize += m.size;
    if (m.size > largestSize) {
      largestSize = m.size;
      largestName = m.name;
    }
  }
  if (info.controlCompression === "xz" || info.dataCompression === "xz") hasXz = true;
  return {
    memberCount: info.members.filter((m) => !m.isLongNameTable).length,
    totalSize,
    archiveSize: info.archiveSize,
    largestMemberName: largestName,
    largestMemberSize: largestSize,
    debianBinaryFound: info.debianBinary !== null,
    controlArchiveFound: info.controlArchive !== null,
    dataArchiveFound: info.dataArchive !== null,
    hasXz,
  };
}

// ===== Search / preview =====

export function searchMembers(members: ArMember[], query: string): ArMember[] {
  const q = query.trim().toLowerCase();
  if (!q) return members;
  return members.filter((m) => m.name.toLowerCase().includes(q));
}

export interface PreviewResult {
  text: string;
  isText: boolean;
  size: number;
  truncated: boolean;
}

const TEXT_MAX = 8192;

export function previewMember(bytes: Uint8Array, member: ArMember): PreviewResult {
  const data = extractArMember(bytes, member);
  const size = Math.min(data.length, TEXT_MAX);
  const slice = data.subarray(0, size);
  const isText = looksLikeText(slice);
  const text = isText ? new TextDecoder("utf-8", { fatal: false }).decode(slice) : "";
  return {
    text,
    isText,
    size: data.length,
    truncated: data.length > TEXT_MAX,
  };
}

export function looksLikeText(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  let printable = 0;
  for (const b of bytes) {
    if (b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b <= 0x7e)) printable++;
  }
  return printable / bytes.length > 0.85;
}

// ===== MIME detection =====

export function detectMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".tar.gz")) return "application/gzip";
  if (lower.endsWith(".tar.xz")) return "application/x-xz";
  if (lower.endsWith(".tar.zst")) return "application/zstd";
  if (lower.endsWith(".tar")) return "application/x-tar";
  if (lower.endsWith(".gz")) return "application/gzip";
  if (lower.endsWith(".xz")) return "application/x-xz";
  if (lower.endsWith(".zst")) return "application/zstd";
  if (lower.endsWith(".txt") || lower === "debian-binary" || lower === "control") return "text/plain";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".xml")) return "application/xml";
  return "application/octet-stream";
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
    lv.setUint16(8, 0, true);
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

export function buildZipFromDeb(bytes: Uint8Array, info: DebInfo): Blob {
  const files: Array<{ name: string; data: Uint8Array }> = [];
  for (const m of info.members) {
    if (m.isLongNameTable) continue;
    files.push({ name: m.name, data: extractArMember(bytes, m) });
  }
  return createZipBlob(files);
}

// ===== Utilities =====

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatMode(mode: number): string {
  return "0" + (mode & 0o7777).toString(8).padStart(3, "0");
}

export function formatMtime(seconds: number): string {
  if (seconds === 0) return "—";
  try {
    return new Date(seconds * 1000).toISOString();
  } catch {
    return "—";
  }
}

// ===== History (localStorage) =====

const HISTORY_KEY = "unqtools-deb-extractor-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  archiveSize: number;
  memberCount: number;
  packageName: string;
  packageVersion: string;
  architecture: string;
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
  search: string;
}

export function buildShareUrl(opts: ShareOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  if (opts.search) params.set("q", opts.search);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareOptions | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("q")) return null;
  return { search: params.get("q") ?? "" };
}
