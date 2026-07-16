/**
 * XAR Extractor — pure-JS XAR (eXtensible Archive) parser.
 *
 * XAR format (https://github.com/mackyle/xar/wiki/xarformat):
 *   Magic (4 bytes): 0x78 0x61 0x72 0x21  ("xar!")
 *   Header (28 bytes total):
 *     0   magic           4 bytes
 *     4   header_size     2 bytes (LE) — size of this header (always 28)
 *     6   version         2 bytes (LE) — 1 for old, 2 for hashes
 *     8   toc_clen        8 bytes (LE) — compressed TOC length
 *    16   toc_ulen        8 bytes (LE) — uncompressed TOC length
 *    24   cksum_alg       4 bytes (LE) — checksum algorithm (0=none, 1=sha1, 2=md5)
 *   Followed immediately by the zlib-compressed XML TOC.
 *
 *   After the compressed TOC comes the heap, which contains file data
 *   at offsets/sizes declared inside <data><offset>, <length>, and
 *   <size> elements within the XML TOC.
 *
 * The XML TOC is a tree of <toc> → <file> → (<file> children | <data>) elements.
 * Each <file> has:
 *   - id            (attribute) — unique file id
 *   - <name>        — file name (no path separators; nested by <file> children)
 *   - <type>        — "file", "directory", or "symlink"
 *   - <data>        — present only for "file" type
 *     - <offset>    — byte offset into the heap
 *     - <length>    — byte length in the heap (compressed/stored)
 *     - <size>      — uncompressed size
 *     - <encoding>  — application/x-gzip (zlib) | application/octet-stream (stored)
 *
 * We support zlib (per-file) and STORE. bzip2/LZMA surface a clear error.
 */

// ===== Magic + header constants =====

export const XAR_MAGIC = [0x78, 0x61, 0x72, 0x21]; // "xar!"
export const XAR_HEADER_SIZE = 28;

// ===== Types =====

export interface XarHeader {
  /** 4-byte magic bytes. */
  magic: number[];
  /** Size of the header (always 28). */
  headerSize: number;
  /** XAR format version (1 or 2). */
  version: number;
  /** Compressed TOC length in bytes. */
  tocCompressedLength: number;
  /** Uncompressed TOC length in bytes. */
  tocUncompressedLength: number;
  /** Checksum algorithm (0=none, 1=sha1, 2=md5, 3=sha256, 4=sha512). */
  cksumAlg: number;
  /** Human-readable checksum name. */
  cksumName: string;
  /** True if the magic matches. */
  isValid: boolean;
}

export type XarFileType = "file" | "directory" | "symlink" | "unknown";

export type XarEncoding = "stored" | "zlib" | "bzip2" | "lzma" | "unknown";

export interface XarEntry {
  /** Full path (joined by '/'). */
  path: string;
  /** File name component. */
  name: string;
  /** File type. */
  type: XarFileType;
  /** Unique id from the XML. */
  id: number;
  /** Uncompressed file size (0 for directories). */
  size: number;
  /** Compressed/stored size in the heap. */
  length: number;
  /** Offset into the heap. */
  offset: number;
  /** Encoding. */
  encoding: XarEncoding;
  /** Encoding attribute string from the XML. */
  encodingAttr: string;
  /** True if we can extract this file (stored or zlib). */
  isExtractable: boolean;
  /** Nesting level (0 = top-level). */
  level: number;
}

export interface XarArchiveInfo {
  isValid: boolean;
  header: XarHeader | null;
  entries: XarEntry[];
  /** Raw XML TOC text (decompressed). */
  tocXml: string;
  fileCount: number;
  directoryCount: number;
  symlinkCount: number;
  totalUncompressedSize: number;
  totalCompressedSize: number;
  encodingBreakdown: Record<string, number>;
  /** Error message if parsing failed. */
  error?: string;
}

// ===== Byte readers =====

function readU16LE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8)) & 0xffff;
}

function readU32LE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16) |
    ((bytes[offset + 3] ?? 0) << 24))
  ) >>> 0;
}

function readU64LE(bytes: Uint8Array, offset: number): number {
  const low = readU32LE(bytes, offset);
  const high = readU32LE(bytes, offset + 4);
  return high * 0x100000000 + low;
}

// ===== Signature detection =====

/** Check if bytes start with the XAR magic ("xar!"). */
export function isXarMagic(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  for (let i = 0; i < 4; i++) {
    if (bytes[i] !== XAR_MAGIC[i]) return false;
  }
  return true;
}

/** Alias: isXarFile. */
export function isXarFile(bytes: Uint8Array): boolean {
  return isXarMagic(bytes);
}

// ===== Checksum name lookup =====

const CKSUM_NAMES: Record<number, string> = {
  0: "None",
  1: "SHA-1",
  2: "MD5",
  3: "SHA-256",
  4: "SHA-512",
};

export function getCksumName(alg: number): string {
  return CKSUM_NAMES[alg] ?? `Algorithm ${alg}`;
}

// ===== Header parsing =====

/** Parse the 28-byte XAR header. */
export function parseHeader(bytes: Uint8Array): XarHeader {
  if (bytes.length < XAR_HEADER_SIZE) {
    return {
      magic: [], headerSize: 0, version: 0,
      tocCompressedLength: 0, tocUncompressedLength: 0,
      cksumAlg: 0, cksumName: "None", isValid: false,
    };
  }
  const magic = Array.from(bytes.subarray(0, 4));
  const headerSize = readU16LE(bytes, 4);
  const version = readU16LE(bytes, 6);
  const tocCompressedLength = readU64LE(bytes, 8);
  const tocUncompressedLength = readU64LE(bytes, 16);
  const cksumAlg = readU32LE(bytes, 24);
  return {
    magic, headerSize, version,
    tocCompressedLength, tocUncompressedLength,
    cksumAlg, cksumName: getCksumName(cksumAlg),
    isValid: isXarMagic(bytes),
  };
}

// ===== Zlib decompression =====

/** Decompress zlib (RFC 1950) data using DecompressionStream if available. */
export async function decompressZlib(compressed: Uint8Array, _expectedSize?: number): Promise<Uint8Array> {
  const DS = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
  if (!DS) {
    throw new Error("zlib decompression requires DecompressionStream (not available in this environment).");
  }
  // XAR uses raw zlib (RFC 1950) — zlib format = 2-byte header + deflate stream + 4-byte adler32.
  // DecompressionStream('deflate') expects the zlib wrapper; 'deflate-raw' expects raw deflate.
  const blob = new Blob([compressed as BlobPart]);
  const stream = blob.stream().pipeThrough(new DS("deflate"));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

/** Try to decompress a XAR file entry's heap data. */
export async function decompressEntryData(
  bytes: Uint8Array,
  entry: XarEntry,
): Promise<Uint8Array> {
  if (!entry.isExtractable) {
    throw new Error(`Cannot extract "${entry.path}": unsupported encoding "${entry.encodingAttr}".`);
  }
  if (entry.offset + entry.length > bytes.length) {
    throw new Error(`Cannot extract "${entry.path}": heap offset/length out of bounds.`);
  }
  const data = bytes.subarray(entry.offset, entry.offset + entry.length);
  if (entry.encoding === "stored") {
    // Copy out so callers can detach safely.
    const out = new Uint8Array(data.length);
    out.set(data);
    return out;
  }
  // zlib
  return decompressZlib(data, entry.size);
}

// ===== Minimal XML parser for the TOC =====

interface XmlNode {
  tag: string;
  attrs: Record<string, string>;
  children: XmlNode[];
  text: string;
}

function parseXml(xml: string): XmlNode | null {
  let i = 0;
  const len = xml.length;
  const skipWhitespace = () => {
    while (i < len && /\s/.test(xml[i]!)) i++;
  };
  const parseElement: () => XmlNode | null = () => {
    if (xml[i] !== "<") return null;
    i++;
    // closing tag — caller shouldn't reach here
    if (xml[i] === "/") return null;
    let tagEnd = xml.indexOf(">", i);
    if (tagEnd === -1) return null;
    let tagContent = xml.slice(i, tagEnd);
    const selfClosing = tagContent.endsWith("/");
    if (selfClosing) tagContent = tagContent.slice(0, -1);
    const nameMatch = tagContent.match(/^([^\s/]+)/);
    const tag = nameMatch ? nameMatch[1]! : "";
    const attrs: Record<string, string> = {};
    let attrStr = tagContent.slice(tag.length).trim();
    const attrRegex = /([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let m: RegExpExecArray | null;
    while ((m = attrRegex.exec(attrStr)) !== null) {
      attrs[m[1]!.toLowerCase()] = m[2] ?? m[3] ?? "";
    }
    i = tagEnd + 1;
    const node: XmlNode = { tag, attrs, children: [], text: "" };
    if (selfClosing) return node;
    // Parse children / text until matching close tag
    let text = "";
    while (i < len) {
      if (xml[i] === "<") {
        if (xml[i + 1] === "/") {
          // close
          const end = xml.indexOf(">", i);
          i = end === -1 ? len : end + 1;
          break;
        }
        if (xml.startsWith("<!--", i)) {
          const end = xml.indexOf("-->", i);
          i = end === -1 ? len : end + 3;
          continue;
        }
        if (xml.startsWith("<![CDATA[", i)) {
          const end = xml.indexOf("]]>", i);
          const cdata = end === -1 ? xml.slice(i + 9) : xml.slice(i + 9, end);
          text += cdata;
          i = end === -1 ? len : end + 3;
          continue;
        }
        skipWhitespace();
        const child = parseElement();
        if (child) node.children.push(child);
      } else {
        let textEnd = xml.indexOf("<", i);
        if (textEnd === -1) textEnd = len;
        text += xml.slice(i, textEnd);
        i = textEnd;
      }
    }
    node.text = decodeEntities(text).trim();
    return node;
  };
  skipWhitespace();
  // Skip XML declaration / processing instructions
  while (i < len && xml[i] === "<" && (xml[i + 1] === "?" || xml[i + 1] === "!")) {
    if (xml[i + 1] === "?") {
      const end = xml.indexOf("?>", i);
      i = end === -1 ? len : end + 2;
    } else {
      const end = xml.indexOf(">", i);
      i = end === -1 ? len : end + 1;
    }
    skipWhitespace();
  }
  if (xml[i] !== "<") return null;
  return parseElement();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function findChildren(node: XmlNode, tag: string): XmlNode[] {
  return node.children.filter((c) => c.tag === tag);
}

function findChild(node: XmlNode, tag: string): XmlNode | null {
  return node.children.find((c) => c.tag === tag) ?? null;
}

function childText(node: XmlNode, tag: string): string {
  const c = findChild(node, tag);
  return c ? c.text : "";
}

// ===== TOC walker =====

function decodeEncoding(attr: string): XarEncoding {
  const lower = (attr || "").toLowerCase();
  if (lower === "application/octet-stream" || lower === "" || lower === "none") return "stored";
  if (lower === "application/x-gzip" || lower.includes("gzip") || lower.includes("zlib")) return "zlib";
  if (lower.includes("bzip2") || lower.includes("bzip")) return "bzip2";
  if (lower.includes("lzma") || lower.includes("xz")) return "lzma";
  return "unknown";
}

/** Walk the TOC tree and build XarEntry list with paths. */
export function walkToc(tocXml: string): XarEntry[] {
  const root = parseXml(tocXml);
  if (!root) return [];
  // Root can be <toc> or have <toc> as first child
  const tocNode = root.tag === "toc" ? root : findChild(root, "toc");
  if (!tocNode) return [];
  const entries: XarEntry[] = [];
  const walk = (node: XmlNode, parentPath: string, level: number) => {
    const fileNodes = findChildren(node, "file");
    for (const fileNode of fileNodes) {
      const id = parseInt(fileNode.attrs["id"] ?? "0", 10) || 0;
      const name = childText(fileNode, "name") || `(id ${id})`;
      const type = (childText(fileNode, "type") || "file") as XarFileType;
      const fullPath = parentPath ? `${parentPath}/${name}` : name;
      const dataNode = findChild(fileNode, "data");
      let size = 0;
      let length = 0;
      let offset = 0;
      let encodingAttr = "";
      let encoding: XarEncoding = "stored";
      if (dataNode) {
        size = parseInt(childText(dataNode, "size"), 10) || 0;
        length = parseInt(childText(dataNode, "length"), 10) || 0;
        offset = parseInt(childText(dataNode, "offset"), 10) || 0;
        const encNode = findChild(dataNode, "encoding");
        if (encNode) {
          encodingAttr = encNode.attrs["style"] ?? childText(encNode, "encoding") ?? encNode.text ?? "";
        }
        encoding = decodeEncoding(encodingAttr);
      }
      const isExtractable = (type === "file") && (encoding === "stored" || encoding === "zlib") && length > 0;
      entries.push({
        path: fullPath,
        name,
        type,
        id,
        size,
        length,
        offset,
        encoding,
        encodingAttr,
        isExtractable,
        level,
      });
      // Recurse into nested <file> children
      walk(fileNode, fullPath, level + 1);
    }
  };
  walk(tocNode, "", 0);
  return entries;
}

// ===== Top-level parse =====

/** Parse a XAR archive (header + TOC). Heap data is read on demand. */
export async function parseXar(bytes: Uint8Array): Promise<XarArchiveInfo> {
  if (!isXarMagic(bytes)) {
    return {
      isValid: false, header: null, entries: [], tocXml: "",
      fileCount: 0, directoryCount: 0, symlinkCount: 0,
      totalUncompressedSize: 0, totalCompressedSize: 0, encodingBreakdown: {},
      error: "Not a valid XAR file (missing 'xar!' magic).",
    };
  }
  const header = parseHeader(bytes);
  if (header.tocCompressedLength <= 0 || header.tocCompressedLength > bytes.length) {
    return {
      isValid: true, header, entries: [], tocXml: "",
      fileCount: 0, directoryCount: 0, symlinkCount: 0,
      totalUncompressedSize: 0, totalCompressedSize: 0, encodingBreakdown: {},
      error: "Invalid TOC length in header.",
    };
  }
  const tocStart = XAR_HEADER_SIZE;
  const tocEnd = tocStart + header.tocCompressedLength;
  if (tocEnd > bytes.length) {
    return {
      isValid: true, header, entries: [], tocXml: "",
      fileCount: 0, directoryCount: 0, symlinkCount: 0,
      totalUncompressedSize: 0, totalCompressedSize: 0, encodingBreakdown: {},
      error: "TOC extends past end of file — file may be truncated.",
    };
  }
  const compressedToc = bytes.subarray(tocStart, tocEnd);
  let tocXml = "";
  let entries: XarEntry[] = [];
  // The heap starts immediately after the compressed TOC.
  const heapStart = tocEnd;
  try {
    const tocBytes = await decompressZlib(compressedToc, header.tocUncompressedLength);
    tocXml = new TextDecoder("utf-8").decode(tocBytes);
    entries = walkToc(tocXml);
    // Convert heap-relative offsets to absolute file offsets.
    for (const e of entries) {
      e.offset = e.offset + heapStart;
    }
  } catch (e) {
    return {
      isValid: true, header, entries: [], tocXml: "",
      fileCount: 0, directoryCount: 0, symlinkCount: 0,
      totalUncompressedSize: 0, totalCompressedSize: 0, encodingBreakdown: {},
      error: `Failed to decompress TOC: ${(e as Error).message}`,
    };
  }
  let fileCount = 0;
  let directoryCount = 0;
  let symlinkCount = 0;
  let totalUncompressedSize = 0;
  let totalCompressedSize = 0;
  const encodingBreakdown: Record<string, number> = {};
  for (const e of entries) {
    if (e.type === "file") {
      fileCount++;
      totalUncompressedSize += e.size;
      totalCompressedSize += e.length;
      encodingBreakdown[e.encoding] = (encodingBreakdown[e.encoding] ?? 0) + 1;
    } else if (e.type === "directory") {
      directoryCount++;
    } else if (e.type === "symlink") {
      symlinkCount++;
    }
  }
  return {
    isValid: true, header, entries, tocXml,
    fileCount, directoryCount, symlinkCount,
    totalUncompressedSize, totalCompressedSize, encodingBreakdown,
  };
}

// ===== Stats =====

export interface XarStats {
  entryCount: number;
  fileCount: number;
  directoryCount: number;
  symlinkCount: number;
  totalUncompressed: number;
  totalCompressed: number;
  ratio: number;
  extractableCount: number;
  unsupportedCount: number;
  largestFileName: string;
  largestFileSize: number;
}

export function computeStats(entries: XarEntry[]): XarStats {
  let fileCount = 0;
  let directoryCount = 0;
  let symlinkCount = 0;
  let totalUncompressed = 0;
  let totalCompressed = 0;
  let extractableCount = 0;
  let unsupportedCount = 0;
  let largestFileName = "";
  let largestFileSize = 0;
  for (const e of entries) {
    if (e.type === "file") {
      fileCount++;
      totalUncompressed += e.size;
      totalCompressed += e.length;
      if (e.isExtractable) extractableCount++;
      else unsupportedCount++;
      if (e.size > largestFileSize) {
        largestFileSize = e.size;
        largestFileName = e.path;
      }
    } else if (e.type === "directory") {
      directoryCount++;
    } else if (e.type === "symlink") {
      symlinkCount++;
    }
  }
  return {
    entryCount: entries.length,
    fileCount, directoryCount, symlinkCount,
    totalUncompressed, totalCompressed,
    ratio: totalCompressed > 0 ? totalUncompressed / totalCompressed : 0,
    extractableCount, unsupportedCount,
    largestFileName, largestFileSize,
  };
}

// ===== Search / filter =====

export type XarTypeFilter = "all" | "file" | "directory" | "symlink";

export function searchEntries(entries: XarEntry[], query: string): XarEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return entries;
  return entries.filter((e) => e.path.toLowerCase().includes(q));
}

export function filterByType(entries: XarEntry[], filter: XarTypeFilter): XarEntry[] {
  if (filter === "all") return entries;
  return entries.filter((e) => e.type === filter);
}

// ===== File tree =====

export interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: TreeNode[];
  entry?: XarEntry;
}

export function buildFileTree(entries: XarEntry[]): TreeNode {
  const root: TreeNode = { name: "", path: "", isDirectory: true, children: [] };
  for (const entry of entries) {
    const parts = entry.path.split("/").filter((p) => p.length > 0);
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isLast = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");
      const isDir = !isLast || entry.type === "directory";
      let child = current.children.find((c) => c.name === part && c.isDirectory === isDir);
      if (!child) {
        child = {
          name: part, path, isDirectory: isDir,
          children: [], entry: isLast ? entry : undefined,
        };
        current.children.push(child);
      }
      current = child;
    }
  }
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

// ===== MIME detection =====

export function detectMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return "text/plain";
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
  if (lower.endsWith(".plist")) return "application/x-plist";
  if (lower.endsWith(".pkg")) return "application/octet-stream";
  return "application/octet-stream";
}

// ===== ZIP writer (re-package extracted files as ZIP) =====

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
  for (const p of allParts) { out.set(p, pos); pos += p.length; }
  return new Blob([out as BlobPart], { type: "application/zip" });
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

const HISTORY_KEY = "unqtools-xar-extractor-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  fileName: string;
  archiveSize: number;
  fileCount: number;
  version: number;
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

export interface ShareOptions {
  filter: XarTypeFilter;
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
  const validFilters: XarTypeFilter[] = ["all", "file", "directory", "symlink"];
  return {
    filter: validFilters.includes(filterRaw as XarTypeFilter) ? (filterRaw as XarTypeFilter) : "all",
    search: params.get("q") ?? "",
  };
}
