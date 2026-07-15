/**
 * CAB File Extractor — pure-JS Microsoft Cabinet (MSCF) parser.
 *
 * MSCF header layout (36 bytes):
 *    0  signature        4 bytes ("MSCF")
 *    4  reserved1        4 bytes (0)
 *    8  cbCabinet        4 bytes (uint32 LE: total cabinet size)
 *   12  reserved2        4 bytes (0)
 *   16  coffFiles       4 bytes (uint32 LE: offset of first CFFILE)
 *   20  reserved3        4 bytes (0)
 *   24  versionMinor    1 byte  (3)
 *   25  versionMajor    1 byte  (1)
 *   26  cFolders        2 bytes (uint16 LE: number of CFFOLDER entries)
 *   28  cFiles          2 bytes (uint16 LE: number of CFFILE entries)
 *   30  flags           2 bytes (uint16 LE)
 *   32  setID           2 bytes (uint16 LE)
 *   34  iCabinet        2 bytes (uint16 LE: cabinet index in set)
 *
 * Optional fields (when flags has bit 0x0004 set: cfheadPREV_CABINET):
 *   36  szCabinetPrev   N bytes (null-terminated string)
 *   ?   szDiskPrev      N bytes (null-terminated string)
 *
 * Optional fields (when flags has bit 0x0008 set: cfheadNEXT_CABINET):
 *   ?   szCabinetNext   N bytes (null-terminated string)
 *   ?   szDiskNext      N bytes (null-terminated string)
 *
 * Optional fields (when flags has bit 0x0010 set: cfheadRESERVE_PRESENT):
 *   36  cbCFHeader      2 bytes (uint16 LE: size of reserved fields)
 *   38  cbCFFolder      1 byte  (extra bytes per CFFOLDER)
 *   39  cbCFData        1 byte  (extra bytes per CFDATA)
 *   40  abReserve       cbCFHeader bytes (reserved)
 *
 * CFFOLDER entry (8 bytes + cbCFFolder):
 *    0  coffCabStart    4 bytes (uint32 LE: offset of first CFDATA)
 *    4  cCFData         2 bytes (uint16 LE: number of CFDATA blocks)
 *    6  typeCompress    2 bytes (uint16 LE: compression method)
 *      0 = none, 1 = MSZIP, 2 = Quantum, 3 = LZX
 *
 * CFFILE entry (16 bytes + name):
 *    0  cbFile          4 bytes (uint32 LE: uncompressed size)
 *    4  uoffFolderStart 4 bytes (uint32 LE: offset in folder's uncompressed data)
 *    8  iFolder         2 bytes (uint16 LE: folder index)
 *   10  date            2 bytes (uint16 LE: FAT date)
 *   12  time            2 bytes (uint16 LE: FAT time)
 *   14  attribs         2 bytes (uint16 LE: file attributes)
 *   16  szName          N bytes (null-terminated filename)
 */

export const CAB_SIGNATURE = "MSCF";
export const CAB_SIGNATURE_BYTES = new Uint8Array([0x4d, 0x53, 0x43, 0x46]); // M S C F

export const CAB_FLAG_PREV_CABINET = 0x0004;
export const CAB_FLAG_NEXT_CABINET = 0x0008;
export const CAB_FLAG_RESERVE_PRESENT = 0x0010;

export const CAB_ATTR_READONLY = 0x01;
export const CAB_ATTR_HIDDEN = 0x02;
export const CAB_ATTR_SYSTEM = 0x04;
export const CAB_ATTR_ARCH = 0x20;
export const CAB_ATTR_EXEC = 0x40;
export const CAB_ATTR_UTF8 = 0x80;

export type CabCompression = "none" | "mszip" | "quantum" | "lzx" | "unknown";

export interface CabFolder {
  /** Byte offset of the first CFDATA block within the .cab file. */
  coffCabStart: number;
  /** Number of CFDATA blocks in this folder. */
  cCFData: number;
  /** Compression method code. */
  typeCompress: number;
  /** Decoded compression name. */
  compression: CabCompression;
  /** Whether files in this folder are stored (extractable). */
  isStored: boolean;
}

export interface CabFile {
  /** File name (UTF-8 if attribs has UTF8 bit, else Latin1). */
  name: string;
  /** Uncompressed file size in bytes. */
  size: number;
  /** Offset within the folder's uncompressed data. */
  uoffFolderStart: number;
  /** Folder index this file belongs to. */
  iFolder: number;
  /** FAT date (raw 16-bit). */
  date: number;
  /** FAT time (raw 16-bit). */
  time: number;
  /** File attributes (bitmask). */
  attribs: number;
  /** Decoded attributes as human-readable flags. */
  attrFlags: string[];
  /** Whether this file can be extracted (folder is stored + file fits in folder data). */
  isExtractable: boolean;
}

export interface CabInfo {
  signature: string;
  totalSize: number;
  coffFiles: number;
  versionMinor: number;
  versionMajor: number;
  folderCount: number;
  fileCount: number;
  flags: number;
  setID: number;
  cabinetIndex: number;
  hasPrevCabinet: boolean;
  hasNextCabinet: boolean;
  hasReserved: boolean;
  folders: CabFolder[];
  files: CabFile[];
  isValid: boolean;
  error?: string;
}

// ===== Field decoding =====

function readUint16LE(bytes: Uint8Array, offset: number): number {
  if (offset + 2 > bytes.length) return 0;
  return (bytes[offset]! | (bytes[offset + 1]! << 8)) >>> 0;
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  if (offset + 4 > bytes.length) return 0;
  return (
    (bytes[offset]! |
      (bytes[offset + 1]! << 8) |
      (bytes[offset + 2]! << 16) |
      (bytes[offset + 3]! << 24)) >>>
    0
  );
}

function readNullTerminatedString(bytes: Uint8Array, offset: number, maxLen: number = 256): { text: string; nextOffset: number } {
  const end = Math.min(offset + maxLen, bytes.length);
  let i = offset;
  for (; i < end; i++) {
    if (bytes[i] === 0) break;
  }
  const slice = bytes.subarray(offset, i);
  const text = new TextDecoder("latin1").decode(slice);
  return { text, nextOffset: i + 1 };
}

function decodeCompression(code: number): CabCompression {
  // The lower 4 bits hold the compression type.
  const type = code & 0x000f;
  if (type === 0) return "none";
  if (type === 1) return "mszip";
  if (type === 2) return "quantum";
  if (type === 3) return "lzx";
  return "unknown";
}

function decodeAttrFlags(attribs: number): string[] {
  const flags: string[] = [];
  if (attribs & CAB_ATTR_READONLY) flags.push("READONLY");
  if (attribs & CAB_ATTR_HIDDEN) flags.push("HIDDEN");
  if (attribs & CAB_ATTR_SYSTEM) flags.push("SYSTEM");
  if (attribs & CAB_ATTR_ARCH) flags.push("ARCH");
  if (attribs & CAB_ATTR_EXEC) flags.push("EXEC");
  if (attribs & CAB_ATTR_UTF8) flags.push("UTF8");
  return flags;
}

/** Check if bytes start with the MSCF signature. */
export function isCabArchive(bytes: Uint8Array): boolean {
  if (bytes.length < CAB_SIGNATURE_BYTES.length) return false;
  for (let i = 0; i < CAB_SIGNATURE_BYTES.length; i++) {
    if (bytes[i] !== CAB_SIGNATURE_BYTES[i]) return false;
  }
  return true;
}

// ===== Parser =====

export function parseCab(bytes: Uint8Array): CabInfo {
  if (!isCabArchive(bytes)) {
    return {
      signature: "",
      totalSize: 0,
      coffFiles: 0,
      versionMinor: 0,
      versionMajor: 0,
      folderCount: 0,
      fileCount: 0,
      flags: 0,
      setID: 0,
      cabinetIndex: 0,
      hasPrevCabinet: false,
      hasNextCabinet: false,
      hasReserved: false,
      folders: [],
      files: [],
      isValid: false,
      error: "Not a CAB file — missing 'MSCF' signature at offset 0.",
    };
  }
  const totalSize = readUint32LE(bytes, 8);
  const coffFiles = readUint32LE(bytes, 16);
  const versionMinor = bytes[24] ?? 0;
  const versionMajor = bytes[25] ?? 0;
  const cFolders = readUint16LE(bytes, 26);
  const cFiles = readUint16LE(bytes, 28);
  const flags = readUint16LE(bytes, 30);
  const setID = readUint16LE(bytes, 32);
  const cabinetIndex = readUint16LE(bytes, 34);
  const hasPrevCabinet = (flags & CAB_FLAG_PREV_CABINET) !== 0;
  const hasNextCabinet = (flags & CAB_FLAG_NEXT_CABINET) !== 0;
  const hasReserved = (flags & CAB_FLAG_RESERVE_PRESENT) !== 0;

  let pos = 36;
  let cbCFHeader = 0;
  let cbCFFolder = 0;
  let cbCFData = 0;
  if (hasReserved) {
    cbCFHeader = readUint16LE(bytes, pos);
    cbCFFolder = bytes[pos + 2] ?? 0;
    cbCFData = bytes[pos + 3] ?? 0;
    pos += 4 + cbCFHeader;
  }
  if (hasPrevCabinet) {
    const r1 = readNullTerminatedString(bytes, pos);
    pos = r1.nextOffset;
    const r2 = readNullTerminatedString(bytes, pos);
    pos = r2.nextOffset;
  }
  if (hasNextCabinet) {
    const r1 = readNullTerminatedString(bytes, pos);
    pos = r1.nextOffset;
    const r2 = readNullTerminatedString(bytes, pos);
    pos = r2.nextOffset;
  }

  // CFFOLDER entries (8 bytes + cbCFFolder each)
  const folders: CabFolder[] = [];
  for (let i = 0; i < cFolders; i++) {
    if (pos + 8 > bytes.length) break;
    const coffCabStart = readUint32LE(bytes, pos);
    const cCFData = readUint16LE(bytes, pos + 4);
    const typeCompress = readUint16LE(bytes, pos + 6);
    const compression = decodeCompression(typeCompress);
    folders.push({
      coffCabStart,
      cCFData,
      typeCompress,
      compression,
      isStored: compression === "none",
    });
    pos += 8 + cbCFFolder;
  }

  // CFFILE entries start at coffFiles (which the header tells us)
  const fileStartOffset = coffFiles > 0 ? coffFiles : pos;
  pos = fileStartOffset;
  const files: CabFile[] = [];
  for (let i = 0; i < cFiles; i++) {
    if (pos + 16 > bytes.length) break;
    const cbFile = readUint32LE(bytes, pos);
    const uoffFolderStart = readUint32LE(bytes, pos + 4);
    const iFolder = readUint16LE(bytes, pos + 8);
    const date = readUint16LE(bytes, pos + 10);
    const time = readUint16LE(bytes, pos + 12);
    const attribs = readUint16LE(bytes, pos + 14);
    const nameResult = readNullTerminatedString(bytes, pos + 16, 1024);
    const isUtf8 = (attribs & CAB_ATTR_UTF8) !== 0;
    let name = nameResult.text;
    if (isUtf8) {
      // Re-decode the name bytes as UTF-8.
      const nameEnd = pos + 16 + nameResult.text.length;
      name = new TextDecoder("utf-8").decode(bytes.subarray(pos + 16, nameEnd));
    }
    const folder = folders[iFolder];
    const isExtractable = folder ? folder.isStored : false;
    files.push({
      name,
      size: cbFile,
      uoffFolderStart,
      iFolder,
      date,
      time,
      attribs,
      attrFlags: decodeAttrFlags(attribs),
      isExtractable,
    });
    pos = nameResult.nextOffset;
  }

  return {
    signature: CAB_SIGNATURE,
    totalSize,
    coffFiles,
    versionMinor,
    versionMajor,
    folderCount: cFolders,
    fileCount: cFiles,
    flags,
    setID,
    cabinetIndex,
    hasPrevCabinet,
    hasNextCabinet,
    hasReserved,
    folders,
    files,
    isValid: true,
  };
}

// ===== Extraction =====

export interface CabExtractResult {
  bytes: Uint8Array;
  truncated: boolean;
}

/**
 * Extract a stored (uncompressed) file from a CAB archive.
 * For stored folders, the CFDATA blocks contain raw uncompressed bytes
 * (with a per-block 8-byte header: csum, cbData, cbUncomp).
 * We concatenate all CFDATA block contents in order, then slice out
 * the file's range using uoffFolderStart + cbFile.
 */
export function extractCabFile(bytes: Uint8Array, file: CabFile, info: CabInfo): CabExtractResult | null {
  if (!file.isExtractable) return null;
  const folder = info.folders[file.iFolder];
  if (!folder) return null;
  // Reassemble the folder's uncompressed data from its CFDATA blocks.
  // CFDATA block layout: csum (4) + cbData (2) + cbUncomp (2) + abReserve (cbCFData) + data (cbData)
  // We assume cbCFData = 0 (no reserved per-block bytes) for stored folders.
  let pos = folder.coffCabStart;
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < folder.cCFData; i++) {
    if (pos + 8 > bytes.length) break;
    const cbData = readUint16LE(bytes, pos + 4);
    const cbUncomp = readUint16LE(bytes, pos + 6);
    const dataStart = pos + 8;
    const dataEnd = dataStart + Math.min(cbData, cbUncomp, bytes.length - dataStart);
    if (dataEnd <= dataStart) break;
    chunks.push(bytes.subarray(dataStart, dataEnd));
    pos = dataEnd;
  }
  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  if (file.uoffFolderStart + file.size > totalLen) {
    // Truncate to what we have.
    const start = Math.min(file.uoffFolderStart, totalLen);
    const end = totalLen;
    const out = new Uint8Array(end - start);
    let p = 0;
    let consumed = 0;
    for (const c of chunks) {
      if (consumed + c.length <= start) {
        consumed += c.length;
        continue;
      }
      const skip = Math.max(0, start - consumed);
      const take = Math.min(c.length - skip, out.length - p);
      out.set(c.subarray(skip, skip + take), p);
      p += take;
      consumed += c.length;
      if (p >= out.length) break;
    }
    return { bytes: out, truncated: true };
  }
  const out = new Uint8Array(file.size);
  let p = 0;
  let consumed = 0;
  for (const c of chunks) {
    if (consumed + c.length <= file.uoffFolderStart) {
      consumed += c.length;
      continue;
    }
    const skip = Math.max(0, file.uoffFolderStart - consumed);
    const take = Math.min(c.length - skip, file.size - p);
    out.set(c.subarray(skip, skip + take), p);
    p += take;
    consumed += c.length;
    if (p >= file.size) break;
  }
  return { bytes: out, truncated: false };
}

// ===== Stats =====

export interface CabStats {
  fileCount: number;
  folderCount: number;
  totalUncompressedSize: number;
  archiveSize: number;
  storedFileCount: number;
  compressedFileCount: number;
  largestFileName: string;
  largestFileSize: number;
  hasMultiVolume: boolean;
}

export function computeStats(info: CabInfo, archiveSize: number): CabStats {
  let totalUncompressedSize = 0;
  let storedFileCount = 0;
  let compressedFileCount = 0;
  let largestFileName = "";
  let largestFileSize = 0;
  for (const f of info.files) {
    totalUncompressedSize += f.size;
    if (f.isExtractable) storedFileCount++;
    else compressedFileCount++;
    if (f.size > largestFileSize) {
      largestFileSize = f.size;
      largestFileName = f.name;
    }
  }
  return {
    fileCount: info.files.length,
    folderCount: info.folders.length,
    totalUncompressedSize,
    archiveSize,
    storedFileCount,
    compressedFileCount,
    largestFileName,
    largestFileSize,
    hasMultiVolume: info.hasPrevCabinet || info.hasNextCabinet,
  };
}

// ===== Search / filter =====

export function searchFiles(files: CabFile[], query: string): CabFile[] {
  const q = query.trim().toLowerCase();
  if (!q) return files;
  return files.filter((f) => f.name.toLowerCase().includes(q));
}

export type CabFilter = "all" | "stored" | "compressed" | "readonly" | "hidden" | "system";

export function filterFiles(files: CabFile[], filter: CabFilter): CabFile[] {
  if (filter === "all") return files;
  if (filter === "stored") return files.filter((f) => f.isExtractable);
  if (filter === "compressed") return files.filter((f) => !f.isExtractable);
  if (filter === "readonly") return files.filter((f) => f.attribs & CAB_ATTR_READONLY);
  if (filter === "hidden") return files.filter((f) => f.attribs & CAB_ATTR_HIDDEN);
  if (filter === "system") return files.filter((f) => f.attribs & CAB_ATTR_SYSTEM);
  return files;
}

// ===== MIME detection =====

export function detectMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".log")) return "text/plain";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".xml")) return "application/xml";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".css")) return "text/css";
  if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".bmp")) return "image/bmp";
  if (lower.endsWith(".ico")) return "image/x-icon";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".exe") || lower.endsWith(".dll")) return "application/x-msdownload";
  if (lower.endsWith(".inf")) return "application/octet-stream";
  if (lower.endsWith(".cat")) return "application/vnd.ms-pki.seccat";
  return "application/octet-stream";
}

// ===== ZIP writer =====

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

export function buildZipFromCab(bytes: Uint8Array, info: CabInfo): Blob {
  const files: Array<{ name: string; data: Uint8Array }> = [];
  for (const f of info.files) {
    if (!f.isExtractable) continue;
    const result = extractCabFile(bytes, f, info);
    if (result) files.push({ name: f.name, data: result.bytes });
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

/** Decode a FAT date (16-bit) + FAT time (16-bit) into an ISO date string. */
export function formatFatDateTime(date: number, time: number): string {
  if (date === 0 && time === 0) return "—";
  const day = date & 0x1f;
  const month = (date >> 5) & 0x0f;
  const year = ((date >> 9) & 0x7f) + 1980;
  const seconds = (time & 0x1f) * 2;
  const minutes = (time >> 5) & 0x3f;
  const hours = (time >> 11) & 0x1f;
  if (month < 1 || month > 12 || day < 1 || day > 31) return "—";
  try {
    return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds)).toISOString();
  } catch {
    return "—";
  }
}

// ===== History (localStorage) =====

const HISTORY_KEY = "unqtools-cab-extractor-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  archiveSize: number;
  fileCount: number;
  folderCount: number;
  storedFileCount: number;
  inspectedAt: string;
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
  filter: CabFilter;
}

export function buildShareUrl(opts: ShareOptions): string {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams();
  if (opts.search) params.set("q", opts.search);
  if (opts.filter !== "all") params.set("filter", opts.filter);
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareOptions | null {
  if (!hash || !hash.startsWith("#")) return null;
  const params = new URLSearchParams(hash.slice(1));
  if (!params.has("q") && !params.has("filter")) return null;
  const validFilters: CabFilter[] = ["all", "stored", "compressed", "readonly", "hidden", "system"];
  const filter = (params.get("filter") ?? "all") as CabFilter;
  return {
    search: params.get("q") ?? "",
    filter: validFilters.includes(filter) ? filter : "all",
  };
}
