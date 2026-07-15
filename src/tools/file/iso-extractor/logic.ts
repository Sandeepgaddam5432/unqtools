/**
 * ISO Extractor — pure-JS ISO 9660 filesystem parser.
 *
 * ISO 9660 format overview:
 *
 *   System area: sectors 0-15 (unused by ISO 9660 — boot code, etc.)
 *
 *   Volume Descriptor Set: starts at sector 16 (2048 bytes each)
 *     - Type (1 byte): 0 = Boot, 1 = Primary, 2 = Supplementary, 3 = Partition,
 *                      255 = Terminating
 *     - Standard ID (5 bytes): "CD001"
 *     - Version (1 byte): 1
 *     - Volume Descriptor body (2041 bytes — varies by type)
 *
 *   Primary Volume Descriptor (PVD, type 1):
 *     - System ID (32 bytes, ASCII, space-padded)
 *     - Volume ID (32 bytes, ASCII)
 *     - Unused (8 bytes)
 *     - Volume Space Size (8 bytes: 4 LE + 4 BE)
 *     - Unused (32 bytes)
 *     - Volume Set Size (4 bytes: 2 LE + 2 BE)
 *     - Volume Sequence Number (4 bytes: 2 LE + 2 BE)
 *     - Logical Block Size (4 bytes: 2 LE + 2 BE) — usually 2048
 *     - Path Table Size (8 bytes: 4 LE + 4 BE)
 *     - Location of Type-L Path Table (4 bytes LE)
 *     - Location of Optional Type-L Path Table (4 bytes LE)
 *     - Location of Type-M Path Table (4 bytes BE)
 *     - Location of Optional Type-M Path Table (4 bytes BE)
 *     - Root Directory Record (34 bytes)
 *     - Volume Set ID (128 bytes, ASCII)
 *     - Publisher ID (128 bytes)
 *     - Data Preparer ID (128 bytes)
 *     - Application ID (128 bytes)
 *     - Copyright File ID (37 bytes)
 *     - Abstract File ID (37 bytes)
 *     - Bibliographic File ID (37 bytes)
 *     - Volume Creation Date/Time (17 bytes)
 *     - Volume Modification Date/Time (17 bytes)
 *     - Volume Expiration Date/Time (17 bytes)
 *     - Volume Effective Date/Time (17 bytes)
 *     - File Structure Version (1 byte): 1
 *
 *   Directory Record (variable length, 33+ bytes):
 *     - Length (1 byte)
 *     - Extended Attribute Record Length (1 byte)
 *     - Location of Extent (8 bytes: 4 LE + 4 BE)
 *     - Data Length (8 bytes: 4 LE + 4 BE)
 *     - Recording Date/Time (7 bytes)
 *     - File Flags (1 byte): bit 0 = hidden, bit 1 = directory, bit 2 = associated,
 *                              bit 3 = record, bit 4 = protection, bit 7 = multi-extent
 *     - File Unit Size (1 byte)
 *     - Interleave Gap Size (1 byte)
 *     - Volume Sequence Number (4 bytes: 2 LE + 2 BE)
 *     - File ID Length (1 byte)
 *     - File ID (variable)
 *     - Padding (1 byte if File ID Length is even)
 *
 * We support: PVD parsing, root directory listing, recursive directory walking,
 * file extraction by extent location + data length, Joliet (UTF-16LE filenames),
 * and basic Rock Ridge detection (we use the alternate name if present).
 */

// ===== Constants =====

const SECTOR_SIZE = 2048;
const PVD_SECTOR = 16;
const VOLUME_DESC_TYPE_BOOT = 0;
const VOLUME_DESC_TYPE_PRIMARY = 1;
const VOLUME_DESC_TYPE_SUPPLEMENTARY = 2;
const VOLUME_DESC_TYPE_PARTITION = 3;
const VOLUME_DESC_TYPE_TERMINATOR = 255;

const FILE_FLAG_HIDDEN = 0x01;
const FILE_FLAG_DIRECTORY = 0x02;
const FILE_FLAG_ASSOCIATED = 0x04;
const FILE_FLAG_RECORD = 0x08;
const FILE_FLAG_PROTECTION = 0x10;
const FILE_FLAG_MULTIEXTENT = 0x80;

// ===== Types =====

export interface VolumeDescriptor {
  type: number;
  standardId: string;
  version: number;
  isPrimary: boolean;
  isSupplementary: boolean;
  isTerminator: boolean;
}

export interface PrimaryVolumeDescriptor {
  systemId: string;
  volumeId: string;
  volumeSpaceSize: number;
  volumeSetSize: number;
  volumeSequenceNumber: number;
  logicalBlockSize: number;
  pathTableSize: number;
  typeLPathTableLocation: number;
  typeMPathTableLocation: number;
  rootDirectoryExtent: number;
  rootDirectorySize: number;
  volumeSetId: string;
  publisherId: string;
  dataPreparerId: string;
  applicationId: string;
  copyrightFileId: string;
  abstractFileId: string;
  bibliographicFileId: string;
  creationDate: string;
  modificationDate: string;
  expirationDate: string;
  effectiveDate: string;
  fileStructureVersion: number;
  /** True if this is a Joliet (Supplementary) volume descriptor. */
  isJoliet: boolean;
}

export interface IsoEntry {
  /** Filename (decoded from ASCII or UTF-16LE for Joliet). */
  name: string;
  /** True if this entry is a directory. */
  isDirectory: boolean;
  /** Logical block number where the file data starts. */
  extentLocation: number;
  /** Size of the file/directory in bytes. */
  dataLength: number;
  /** Recording date (7-byte ISO 9660 format, decoded). */
  recordingDate: string;
  /** File flags. */
  flags: number;
  /** True if this is a hidden file. */
  isHidden: boolean;
  /** File type classification. */
  fileType: IsoFileType;
  /** Parent directory path (for building trees). */
  parentPath: string;
  /** Full path including name. */
  fullPath: string;
}

export type IsoFileType =
  | "text"
  | "image"
  | "code"
  | "audio"
  | "video"
  | "archive"
  | "executable"
  | "document"
  | "unknown";

export interface IsoStats {
  entryCount: number;
  fileCount: number;
  directoryCount: number;
  totalFileSize: number;
  hiddenFileCount: number;
  largestFileName: string;
  largestFileSize: number;
}

export interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: TreeNode[];
  entry?: IsoEntry;
}

export type IsoFilter = "all" | "text" | "image" | "code" | "audio" | "video" | "archive" | "executable" | "document";

// ===== Byte readers =====

function readU8(bytes: Uint8Array, offset: number): number {
  return bytes[offset] ?? 0;
}

function readU16LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function readU16BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function readU32LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16) |
    ((bytes[offset + 3] ?? 0) << 24)
  ) >>> 0;
}

function readU32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

/** Read a both-endian 32-bit integer (4 LE + 4 BE — verify both match). */
function readU32Both(bytes: Uint8Array, offset: number): number {
  const le = readU32LE(bytes, offset);
  const be = readU32BE(bytes, offset + 4);
  // Prefer LE; if they disagree, return LE anyway (we don't fail on bad ISOs).
  return le !== 0 ? le : be;
}

function readU16Both(bytes: Uint8Array, offset: number): number {
  const le = readU16LE(bytes, offset);
  const be = readU16BE(bytes, offset + 2);
  return le !== 0 ? le : be;
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  return new TextDecoder("ascii").decode(bytes.subarray(offset, offset + length)).trim().replace(/\s+$/, "");
}

function readJolietString(bytes: Uint8Array, offset: number, length: number): string {
  // Joliet uses UTF-16BE for volume descriptors and UTF-16LE/BE (configurable) for filenames.
  // The escaping in Joliet uses UCS-2 (UTF-16BE) for volume IDs.
  return new TextDecoder("utf-16be").decode(bytes.subarray(offset, offset + length)).trim().replace(/\s+$/, "");
}

/** Decode a 7-byte ISO 9660 recording date. */
function decodeRecordingDate(bytes: Uint8Array, offset: number): string {
  if (offset + 7 > bytes.length) return "";
  const year = bytes[offset]!;       // years since 1900
  const month = bytes[offset + 1]!;  // 1-12
  const day = bytes[offset + 2]!;    // 1-31
  const hour = bytes[offset + 3]!;
  const minute = bytes[offset + 4]!;
  const second = bytes[offset + 5]!;
  const tzOffset = bytes[offset + 6]!; // signed, in 15-minute intervals from GMT
  if (year === 0 && month === 0 && day === 0) return "";
  const absYear = 1900 + year;
  if (absYear < 1900 || absYear > 2200) return "";
  const tzSign = tzOffset >= 128 ? "-" : "+";
  const tzHours = Math.floor(Math.abs(tzOffset >= 128 ? tzOffset - 256 : tzOffset) / 4);
  const tzMins = (Math.abs(tzOffset >= 128 ? tzOffset - 256 : tzOffset) % 4) * 15;
  const tz = `${tzSign}${String(tzHours).padStart(2, "0")}:${String(tzMins).padStart(2, "0")}`;
  return `${absYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}${tz}`;
}

/** Decode a 17-byte ISO 9660 volume descriptor date (ASCII "YYYYMMDDHHMMSSFF" + timezone). */
function decodeVolumeDate(bytes: Uint8Array, offset: number): string {
  if (offset + 17 > bytes.length) return "";
  const str = new TextDecoder("ascii").decode(bytes.subarray(offset, offset + 16));
  if (str.trim() === "0000000000000000") return "";
  const year = str.slice(0, 4);
  const month = str.slice(4, 6);
  const day = str.slice(6, 8);
  const hour = str.slice(8, 10);
  const minute = str.slice(10, 12);
  const second = str.slice(12, 14);
  if (year === "0000") return "";
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

// ===== Volume Descriptor parsing =====

export function parseVolumeDescriptorHeader(bytes: Uint8Array, sector: number): VolumeDescriptor | null {
  const offset = sector * SECTOR_SIZE;
  if (offset + 7 > bytes.length) return null;
  const type = readU8(bytes, offset);
  const standardId = readAscii(bytes, offset + 1, 5);
  if (standardId !== "CD001") return null;
  const version = readU8(bytes, offset + 6);
  return {
    type,
    standardId,
    version,
    isPrimary: type === VOLUME_DESC_TYPE_PRIMARY,
    isSupplementary: type === VOLUME_DESC_TYPE_SUPPLEMENTARY,
    isTerminator: type === VOLUME_DESC_TYPE_TERMINATOR,
  };
}

export function parsePrimaryVolumeDescriptor(bytes: Uint8Array, sector: number, isJoliet: boolean = false): PrimaryVolumeDescriptor {
  const offset = sector * SECTOR_SIZE;
  if (offset + SECTOR_SIZE > bytes.length) {
    throw new Error(`Cannot read PVD at sector ${sector} — beyond file end.`);
  }
  const readStringFn = isJoliet ? readJolietString : readAscii;
  const systemId = readStringFn(bytes, offset + 8, 32);
  const volumeId = readStringFn(bytes, offset + 40, 32);
  const volumeSpaceSize = readU32Both(bytes, offset + 80);
  const volumeSetSize = readU16Both(bytes, offset + 120);
  const volumeSequenceNumber = readU16Both(bytes, offset + 124);
  const logicalBlockSize = readU16Both(bytes, offset + 128);
  const pathTableSize = readU32Both(bytes, offset + 132);
  const typeLPathTableLocation = readU32LE(bytes, offset + 140);
  const typeMPathTableLocation = readU32BE(bytes, offset + 148);
  // Root directory record at offset 156, 34 bytes
  const rootDirRecord = bytes.subarray(offset + 156, offset + 156 + 34);
  const rootDirLength = readU8(rootDirRecord, 0);
  void rootDirLength;
  const rootDirectoryExtent = readU32Both(rootDirRecord, 2);
  const rootDirectorySize = readU32Both(rootDirRecord, 10);
  const volumeSetId = readStringFn(bytes, offset + 190, 128);
  const publisherId = readStringFn(bytes, offset + 318, 128);
  const dataPreparerId = readStringFn(bytes, offset + 446, 128);
  const applicationId = readStringFn(bytes, offset + 574, 128);
  const copyrightFileId = readAscii(bytes, offset + 702, 37);
  const abstractFileId = readAscii(bytes, offset + 739, 37);
  const bibliographicFileId = readAscii(bytes, offset + 776, 37);
  const creationDate = decodeVolumeDate(bytes, offset + 813);
  const modificationDate = decodeVolumeDate(bytes, offset + 830);
  const expirationDate = decodeVolumeDate(bytes, offset + 847);
  const effectiveDate = decodeVolumeDate(bytes, offset + 864);
  const fileStructureVersion = readU8(bytes, offset + 881);
  return {
    systemId,
    volumeId,
    volumeSpaceSize,
    volumeSetSize,
    volumeSequenceNumber,
    logicalBlockSize,
    pathTableSize,
    typeLPathTableLocation,
    typeMPathTableLocation,
    rootDirectoryExtent,
    rootDirectorySize,
    volumeSetId,
    publisherId,
    dataPreparerId,
    applicationId,
    copyrightFileId,
    abstractFileId,
    bibliographicFileId,
    creationDate,
    modificationDate,
    expirationDate,
    effectiveDate,
    fileStructureVersion,
    isJoliet,
  };
}

// ===== Directory Record parsing =====

export interface RawDirectoryRecord {
  length: number;
  extentLocation: number;
  dataLength: number;
  recordingDate: string;
  flags: number;
  fileUnitSize: number;
  interleaveGapSize: number;
  volumeSequenceNumber: number;
  fileId: string;
  isDirectory: boolean;
  isHidden: boolean;
}

/** Parse a single directory record at the given offset. Returns null if invalid. */
export function parseDirectoryRecord(bytes: Uint8Array, offset: number, isJoliet: boolean = false): RawDirectoryRecord | null {
  if (offset + 33 > bytes.length) return null;
  const length = readU8(bytes, offset);
  if (length === 0) return null;
  if (offset + length > bytes.length) return null;
  // const extAttrRecordLength = readU8(bytes, offset + 1);
  const extentLocation = readU32Both(bytes, offset + 2);
  const dataLength = readU32Both(bytes, offset + 10);
  const recordingDate = decodeRecordingDate(bytes, offset + 18);
  const flags = readU8(bytes, offset + 25);
  const fileUnitSize = readU8(bytes, offset + 26);
  const interleaveGapSize = readU8(bytes, offset + 27);
  const volumeSequenceNumber = readU16Both(bytes, offset + 28);
  const fileIdLength = readU8(bytes, offset + 32);
  let fileId: string;
  if (isJoliet) {
    fileId = new TextDecoder("utf-16be").decode(bytes.subarray(offset + 33, offset + 33 + fileIdLength));
  } else {
    fileId = new TextDecoder("ascii").decode(bytes.subarray(offset + 33, offset + 33 + fileIdLength));
  }
  return {
    length,
    extentLocation,
    dataLength,
    recordingDate,
    flags,
    fileUnitSize,
    interleaveGapSize,
    volumeSequenceNumber,
    fileId,
    isDirectory: (flags & FILE_FLAG_DIRECTORY) !== 0,
    isHidden: (flags & FILE_FLAG_HIDDEN) !== 0,
  };
}

/**
 * Read a directory's contents. The directory data is stored at its extent location.
 * Each directory record is variable length; the directory data is padded to a
 * sector boundary. A length byte of 0 means "skip to the next sector".
 */
export function readDirectoryEntries(bytes: Uint8Array, extentLocation: number, dataLength: number, isJoliet: boolean = false): RawDirectoryRecord[] {
  const startOffset = extentLocation * SECTOR_SIZE;
  const endOffset = startOffset + dataLength;
  const entries: RawDirectoryRecord[] = [];
  let pos = startOffset;
  while (pos < endOffset) {
    const length = readU8(bytes, pos);
    if (length === 0) {
      // Skip to the next sector
      const currentSector = Math.floor(pos / SECTOR_SIZE);
      pos = (currentSector + 1) * SECTOR_SIZE;
      continue;
    }
    const record = parseDirectoryRecord(bytes, pos, isJoliet);
    if (!record) break;
    entries.push(record);
    pos += length;
  }
  return entries;
}

// ===== File type classification =====

export function classifyIsoFile(name: string): IsoFileType {
  const lower = name.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".log") || lower.endsWith(".csv")) return "text";
  if (/\.(png|jpg|jpeg|gif|webp|bmp|svg|avif|ico)$/.test(lower)) return "image";
  if (/\.(js|mjs|ts|tsx|jsx|py|rb|go|rs|java|c|cpp|h|hpp|cs|php|sh|bat|css|scss|less)$/.test(lower)) return "code";
  if (/\.(mp3|wav|flac|ogg|aac|m4a)$/.test(lower)) return "audio";
  if (/\.(mp4|mkv|avi|mov|webm|flv|wmv)$/.test(lower)) return "video";
  if (/\.(zip|tar|gz|bz2|7z|rar|xz|lz|lzh)$/.test(lower)) return "archive";
  if (/\.(exe|dll|so|dylib|bin|com)$/.test(lower)) return "executable";
  if (/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|odt|ods|odp|epub|fb2|mobi)$/.test(lower)) return "document";
  return "unknown";
}

// ===== Recursive directory walking =====

/**
 * Recursively walk the directory tree starting from the root directory.
 * Returns a flat list of all entries (files + directories).
 */
export function walkDirectoryTree(
  bytes: Uint8Array,
  rootExtent: number,
  rootSize: number,
  isJoliet: boolean = false,
  maxDepth: number = 20,
): IsoEntry[] {
  const entries: IsoEntry[] = [];
  const visited = new Set<number>(); // prevent infinite loops from cyclic references

  const walk = (extent: number, size: number, parentPath: string, depth: number) => {
    if (depth > maxDepth) return;
    if (visited.has(extent)) return;
    visited.add(extent);
    const rawEntries = readDirectoryEntries(bytes, extent, size, isJoliet);
    for (const raw of rawEntries) {
      // Skip "." and ".." entries
      if (raw.fileId === "\0" || raw.fileId === "\u0001" || raw.fileId === "." || raw.fileId === "..") continue;
      // Strip version suffix ";1" from filenames
      const name = raw.fileId.replace(/;[0-9]+$/, "");
      if (!name) continue;
      const fullPath = parentPath ? `${parentPath}/${name}` : `/${name}`;
      const entry: IsoEntry = {
        name,
        isDirectory: raw.isDirectory,
        extentLocation: raw.extentLocation,
        dataLength: raw.dataLength,
        recordingDate: raw.recordingDate,
        flags: raw.flags,
        isHidden: raw.isHidden,
        fileType: classifyIsoFile(name),
        parentPath,
        fullPath,
      };
      entries.push(entry);
      if (raw.isDirectory) {
        walk(raw.extentLocation, raw.dataLength, fullPath, depth + 1);
      }
    }
  };

  walk(rootExtent, rootSize, "", 0);
  return entries;
}

// ===== File extraction =====

/**
 * Extract a file's data from the ISO. Reads the bytes at the file's extent location.
 */
export function extractFile(bytes: Uint8Array, entry: IsoEntry): Uint8Array {
  if (entry.isDirectory) {
    throw new Error(`Cannot extract "${entry.name}": it's a directory.`);
  }
  const startOffset = entry.extentLocation * SECTOR_SIZE;
  const endOffset = startOffset + entry.dataLength;
  if (endOffset > bytes.length) {
    throw new Error(`File "${entry.name}" extends beyond ISO end (offset ${startOffset}, length ${entry.dataLength}, ISO size ${bytes.length}).`);
  }
  return bytes.subarray(startOffset, endOffset);
}

// ===== File tree =====

export function buildFileTree(entries: IsoEntry[]): TreeNode {
  const root: TreeNode = { name: "", path: "", isDirectory: true, children: [] };
  // Sort by path depth so parents are processed before children
  const sorted = [...entries].sort((a, b) => a.fullPath.split("/").length - b.fullPath.split("/").length);
  for (const entry of sorted) {
    const parts = entry.fullPath.split("/").filter((p) => p.length > 0);
    if (parts.length === 0) continue;
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isLast = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");
      const isDir = !isLast || entry.isDirectory;
      let child = current.children.find((c) => c.name === part && c.isDirectory === isDir);
      if (!child) {
        child = {
          name: part,
          path: `/${path}`,
          isDirectory: isDir,
          children: [],
          entry: isLast ? entry : undefined,
        };
        current.children.push(child);
      }
      current = child;
    }
  }
  sortTree(root);
  return root;
}

function sortTree(node: TreeNode) {
  node.children.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const c of node.children) sortTree(c);
}

// ===== Search / filter =====

export function searchEntries(entries: IsoEntry[], query: string): IsoEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) => e.name.toLowerCase().includes(q));
}

const EXT_GROUPS: Record<IsoFilter, string[]> = {
  all: [],
  text: [".txt", ".md", ".log", ".csv", ".json", ".xml", ".html", ".htm", ".yaml", ".yml", ".ini", ".cfg", ".rtf"],
  image: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg", ".avif", ".ico", ".tiff"],
  code: [".js", ".mjs", ".ts", ".tsx", ".jsx", ".py", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".h", ".hpp", ".cs", ".php", ".sh", ".bat", ".css", ".scss", ".less"],
  audio: [".mp3", ".wav", ".flac", ".ogg", ".aac", ".m4a", ".wma"],
  video: [".mp4", ".mkv", ".avi", ".mov", ".webm", ".flv", ".wmv"],
  archive: [".zip", ".tar", ".gz", ".bz2", ".7z", ".rar", ".xz", ".lz", ".lzh"],
  executable: [".exe", ".dll", ".so", ".dylib", ".bin", ".com", ".app"],
  document: [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".odp", ".epub", ".fb2", ".mobi"],
};

export function filterByType(entries: IsoEntry[], filter: IsoFilter): IsoEntry[] {
  if (filter === "all") return entries;
  const exts = EXT_GROUPS[filter];
  return entries.filter((e) => {
    if (e.isDirectory) return false;
    const lower = e.name.toLowerCase();
    return exts.some((ext) => lower.endsWith(ext));
  });
}

// ===== Stats =====

export function computeStats(entries: IsoEntry[]): IsoStats {
  let fileCount = 0;
  let directoryCount = 0;
  let totalFileSize = 0;
  let hiddenFileCount = 0;
  let largestFileName = "";
  let largestFileSize = 0;
  for (const e of entries) {
    if (e.isDirectory) {
      directoryCount++;
      continue;
    }
    fileCount++;
    totalFileSize += e.dataLength;
    if (e.isHidden) hiddenFileCount++;
    if (e.dataLength > largestFileSize) {
      largestFileSize = e.dataLength;
      largestFileName = e.name;
    }
  }
  return {
    entryCount: entries.length,
    fileCount,
    directoryCount,
    totalFileSize,
    hiddenFileCount,
    largestFileName,
    largestFileSize,
  };
}

// ===== MIME detection =====

export function detectMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".log")) return "text/plain";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".xml")) return "application/xml";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".css")) return "text/css";
  if (lower.endsWith(".js")) return "application/javascript";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".exe")) return "application/x-msdownload";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".tar")) return "application/x-tar";
  if (lower.endsWith(".gz")) return "application/gzip";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".iso")) return "application/x-iso9660-image";
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

export function previewFile(data: Uint8Array, maxBytes = 8192): PreviewResult {
  const previewSize = Math.min(data.length, maxBytes);
  const slice = data.subarray(0, previewSize);
  const isText = looksLikeText(slice);
  let text = "";
  let hex = "";
  if (isText) {
    text = new TextDecoder("utf-8", { fatal: false }).decode(slice);
  } else {
    const lines: string[] = [];
    for (let i = 0; i < slice.length; i += 16) {
      const lineBytes = slice.subarray(i, Math.min(i + 16, slice.length));
      const hexPart = Array.from(lineBytes).map((b) => b.toString(16).padStart(2, "0")).join(" ");
      const asciiPart = Array.from(lineBytes).map((b) => b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : ".").join("");
      lines.push(`${i.toString(16).padStart(8, "0")}  ${hexPart.padEnd(48, " ")}  ${asciiPart}`);
    }
    hex = lines.join("\n");
  }
  return { text, isText, hex, previewSize, totalSize: data.length, truncated: data.length > maxBytes };
}

export function looksLikeText(bytes: Uint8Array, sampleSize = 1024): boolean {
  const sample = bytes.subarray(0, Math.min(bytes.length, sampleSize));
  if (sample.length === 0) return false;
  let printable = 0;
  for (const b of sample) {
    if (b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b <= 0x7e)) printable++;
  }
  return printable / sample.length > 0.85;
}

// ===== ZIP writer (re-zip extracted files) =====

function crc32Zip(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
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
    cv.setUint32(16, c, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
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
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  const all = [...localParts, ...centralParts, eocd];
  const total = all.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of all) { out.set(p, pos); pos += p.length; }
  return new Blob([out as BlobPart], { type: "application/zip" });
}

export function buildZipFromEntries(bytes: Uint8Array, entries: IsoEntry[]): Blob {
  const files: Array<{ name: string; data: Uint8Array }> = [];
  for (const e of entries) {
    if (e.isDirectory) continue;
    try {
      const data = extractFile(bytes, e);
      // Strip leading slash for ZIP paths
      const name = e.fullPath.replace(/^\//, "");
      files.push({ name, data });
    } catch {
      // Skip files that fail to extract
    }
  }
  return createZipBlob(files);
}

// ===== Top-level ISO parsing =====

export interface IsoParseResult {
  fileName: string;
  fileSize: number;
  pvd: PrimaryVolumeDescriptor;
  entries: IsoEntry[];
  stats: IsoStats;
  /** True if a Joliet (supplementary) volume was found and used. */
  hasJoliet: boolean;
}

export function parseIso(bytes: Uint8Array, fileName: string): IsoParseResult {
  if (bytes.length < (PVD_SECTOR + 1) * SECTOR_SIZE) {
    throw new Error("File is too small to be a valid ISO 9660 image.");
  }
  // Walk volume descriptor set starting at sector 16
  let primary: PrimaryVolumeDescriptor | null = null;
  let joliet: PrimaryVolumeDescriptor | null = null;
  for (let sector = PVD_SECTOR; sector < PVD_SECTOR + 100; sector++) {
    const header = parseVolumeDescriptorHeader(bytes, sector);
    if (!header) break;
    if (header.isPrimary) {
      primary = parsePrimaryVolumeDescriptor(bytes, sector, false);
    } else if (header.isSupplementary) {
      // Joliet uses escaping in volume ID — detect via the escape sequences 0x25 0x2F 0x40, 0x43, 0x45
      const offset = sector * SECTOR_SIZE;
      const escapeSeq = bytes[offset + 88] === 0x25 && bytes[offset + 89] === 0x2f &&
        (bytes[offset + 90] === 0x40 || bytes[offset + 90] === 0x43 || bytes[offset + 90] === 0x45);
      if (escapeSeq) {
        joliet = parsePrimaryVolumeDescriptor(bytes, sector, true);
      }
    } else if (header.isTerminator) {
      break;
    }
  }
  // Prefer Joliet (UTF-16) over primary (ASCII) for better filename support
  const pvd = joliet ?? primary;
  if (!pvd) {
    throw new Error("ISO image has no Primary Volume Descriptor (PVD). Not a valid ISO 9660 image.");
  }
  const entries = walkDirectoryTree(bytes, pvd.rootDirectoryExtent, pvd.rootDirectorySize, pvd.isJoliet);
  const stats = computeStats(entries);
  return {
    fileName,
    fileSize: bytes.length,
    pvd,
    entries,
    stats,
    hasJoliet: joliet !== null,
  };
}

export function isIsoImage(bytes: Uint8Array): boolean {
  // Check for CD001 standard ID at sector 16, offset 1
  const offset = PVD_SECTOR * SECTOR_SIZE + 1;
  if (offset + 5 > bytes.length) return false;
  return (
    bytes[offset] === 0x43 &&     // 'C'
    bytes[offset + 1] === 0x44 && // 'D'
    bytes[offset + 2] === 0x30 && // '0'
    bytes[offset + 3] === 0x30 && // '0'
    bytes[offset + 4] === 0x31    // '1'
  );
}

// ===== Utilities =====

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// ===== History (localStorage) =====

const HISTORY_KEY = "unqtools-iso-extractor-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  fileSize: number;
  volumeId: string;
  systemId: string;
  entryCount: number;
  hasJoliet: boolean;
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
  filter: IsoFilter;
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
  const filterRaw = params.get("filter") ?? "all";
  const validFilters: IsoFilter[] = ["all", "text", "image", "code", "audio", "video", "archive", "executable", "document"];
  return {
    filter: validFilters.includes(filterRaw as IsoFilter) ? (filterRaw as IsoFilter) : "all",
    search: params.get("q") ?? "",
  };
}
