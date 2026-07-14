/**
 * File Metadata Viewer — pure logic for metadata extraction, hex dump,
 * entropy, magic bytes lookup, and basic JPEG EXIF parsing.
 *
 * Pure functions operating on Uint8Array + File metadata.
 */

export interface FileSignature {
  ext: string;
  description: string;
  mime: string;
  /** Hex string of magic bytes (lowercase, no spaces). */
  offset: number;
  bytes: string;
  category: "image" | "document" | "archive" | "audio" | "video" | "executable" | "other";
}

/** File signature database — 50+ common formats. */
export const FILE_SIGNATURES: FileSignature[] = [
  { ext: "png", description: "PNG image", mime: "image/png", offset: 0, bytes: "89504e47", category: "image" },
  { ext: "jpg", description: "JPEG image (JFIF)", mime: "image/jpeg", offset: 0, bytes: "ffd8ffe0", category: "image" },
  { ext: "jpg", description: "JPEG image (EXIF)", mime: "image/jpeg", offset: 0, bytes: "ffd8ffe1", category: "image" },
  { ext: "jpg", description: "JPEG image (raw SPIFF)", mime: "image/jpeg", offset: 0, bytes: "ffd8ffe8", category: "image" },
  { ext: "gif", description: "GIF image (87a)", mime: "image/gif", offset: 0, bytes: "474946383761", category: "image" },
  { ext: "gif", description: "GIF image (89a)", mime: "image/gif", offset: 0, bytes: "474946383961", category: "image" },
  { ext: "bmp", description: "Bitmap image", mime: "image/bmp", offset: 0, bytes: "424d", category: "image" },
  { ext: "webp", description: "WebP image", mime: "image/webp", offset: 0, bytes: "52494646", category: "image" },
  { ext: "tiff", description: "TIFF image (little-endian)", mime: "image/tiff", offset: 0, bytes: "49492a00", category: "image" },
  { ext: "tiff", description: "TIFF image (big-endian)", mime: "image/tiff", offset: 0, bytes: "4d4d002a", category: "image" },
  { ext: "heic", description: "HEIC image", mime: "image/heic", offset: 4, bytes: "6674797068656963", category: "image" },
  { ext: "svg", description: "SVG image (XML text)", mime: "image/svg+xml", offset: 0, bytes: "3c3f786d6c", category: "image" },
  { ext: "ico", description: "Windows icon", mime: "image/x-icon", offset: 0, bytes: "00000100", category: "image" },
  { ext: "pdf", description: "PDF document", mime: "application/pdf", offset: 0, bytes: "25504446", category: "document" },
  { ext: "doc", description: "Word document (legacy)", mime: "application/msword", offset: 0, bytes: "d0cf11e0", category: "document" },
  { ext: "docx", description: "Word document (OOXML)", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", offset: 0, bytes: "504b0304", category: "document" },
  { ext: "xlsx", description: "Excel spreadsheet (OOXML)", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", offset: 0, bytes: "504b0304", category: "document" },
  { ext: "pptx", description: "PowerPoint (OOXML)", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", offset: 0, bytes: "504b0304", category: "document" },
  { ext: "rtf", description: "Rich Text Format", mime: "application/rtf", offset: 0, bytes: "7b5c727466", category: "document" },
  { ext: "epub", description: "EPUB ebook", mime: "application/epub+zip", offset: 0, bytes: "504b0304", category: "document" },
  { ext: "ps", description: "PostScript", mime: "application/postscript", offset: 0, bytes: "25215053", category: "document" },
  { ext: "zip", description: "ZIP archive", mime: "application/zip", offset: 0, bytes: "504b0304", category: "archive" },
  { ext: "zip", description: "ZIP archive (empty)", mime: "application/zip", offset: 0, bytes: "504b0506", category: "archive" },
  { ext: "zip", description: "ZIP archive (spanned)", mime: "application/zip", offset: 0, bytes: "504b0708", category: "archive" },
  { ext: "rar", description: "RAR archive v5", mime: "application/vnd.rar", offset: 0, bytes: "526172211a0700", category: "archive" },
  { ext: "rar", description: "RAR archive v4", mime: "application/vnd.rar", offset: 0, bytes: "526172211a070100", category: "archive" },
  { ext: "gz", description: "GZIP archive", mime: "application/gzip", offset: 0, bytes: "1f8b", category: "archive" },
  { ext: "bz2", description: "BZIP2 archive", mime: "application/x-bzip2", offset: 0, bytes: "425a68", category: "archive" },
  { ext: "7z", description: "7-Zip archive", mime: "application/x-7z-compressed", offset: 0, bytes: "377abcaf271c", category: "archive" },
  { ext: "tar", description: "POSIX tar archive", mime: "application/x-tar", offset: 257, bytes: "7573746172", category: "archive" },
  { ext: "xz", description: "XZ archive", mime: "application/x-xz", offset: 0, bytes: "fd377a585a00", category: "archive" },
  { ext: "mp3", description: "MP3 audio (ID3)", mime: "audio/mpeg", offset: 0, bytes: "494433", category: "audio" },
  { ext: "mp3", description: "MP3 audio (frame sync)", mime: "audio/mpeg", offset: 0, bytes: "fffb", category: "audio" },
  { ext: "wav", description: "WAV audio", mime: "audio/wav", offset: 0, bytes: "52494646", category: "audio" },
  { ext: "flac", description: "FLAC audio", mime: "audio/flac", offset: 0, bytes: "664c6143", category: "audio" },
  { ext: "ogg", description: "Ogg media", mime: "audio/ogg", offset: 0, bytes: "4f676753", category: "audio" },
  { ext: "mp4", description: "MP4 video", mime: "video/mp4", offset: 4, bytes: "66747970", category: "video" },
  { ext: "avi", description: "AVI video", mime: "video/x-msvideo", offset: 0, bytes: "52494646", category: "video" },
  { ext: "mkv", description: "Matroska video", mime: "video/x-matroska", offset: 0, bytes: "1a45dfa3", category: "video" },
  { ext: "webm", description: "WebM video", mime: "video/webm", offset: 0, bytes: "1a45dfa3", category: "video" },
  { ext: "mov", description: "QuickTime video", mime: "video/quicktime", offset: 0, bytes: "0000001466747970717420", category: "video" },
  { ext: "flv", description: "Flash video", mime: "video/x-flv", offset: 0, bytes: "464c56", category: "video" },
  { ext: "exe", description: "Windows executable", mime: "application/x-msdownload", offset: 0, bytes: "4d5a", category: "executable" },
  { ext: "elf", description: "Linux ELF executable", mime: "application/x-executable", offset: 0, bytes: "7f454c46", category: "executable" },
  { ext: "class", description: "Java class file", mime: "application/x-java-applet", offset: 0, bytes: "cafebabe", category: "executable" },
  { ext: "jar", description: "Java archive (ZIP)", mime: "application/java-archive", offset: 0, bytes: "504b0304", category: "archive" },
  { ext: "swf", description: "Shockwave Flash", mime: "application/x-shockwave-flash", offset: 0, bytes: "465753", category: "other" },
  { ext: "sqlite", description: "SQLite database", mime: "application/x-sqlite3", offset: 0, bytes: "53514c69746520666f726d617420", category: "other" },
  { ext: "pcap", description: "Packet capture", mime: "application/vnd.tcpdump.pcap", offset: 0, bytes: "a1b2c3d4", category: "other" },
  { ext: "ttf", description: "TrueType font", mime: "font/ttf", offset: 0, bytes: "00010000", category: "other" },
  { ext: "otf", description: "OpenType font", mime: "font/otf", offset: 0, bytes: "4f54544f", category: "other" },
  { ext: "woff", description: "WOFF font", mime: "font/woff", offset: 0, bytes: "774f4646", category: "other" },
  { ext: "woff2", description: "WOFF2 font", mime: "font/woff2", offset: 0, bytes: "774f4632", category: "other" },
];

/** Look up a file signature from the first N bytes. */
export function lookupSignature(bytes: Uint8Array): FileSignature | null {
  if (bytes.length < 4) return null;
  const hex = bytesToHex(bytes.slice(0, Math.min(16, bytes.length)));
  // Sort signatures: longer bytes first (more specific match wins)
  const sorted = [...FILE_SIGNATURES].sort((a, b) => b.bytes.length - a.bytes.length);
  for (const sig of sorted) {
    const start = sig.offset * 2;
    const slice = hex.slice(start, start + sig.bytes.length);
    if (slice === sig.bytes) return sig;
  }
  return null;
}

/** Convert bytes to lowercase hex string. */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Convert bytes to Base64 string. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** Format bytes as human-readable. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Generate a hex dump with offset addresses (16 bytes per line). */
export function hexDump(bytes: Uint8Array, maxLines: number = 16): string {
  const lines: string[] = [];
  const total = Math.min(bytes.length, maxLines * 16);
  for (let i = 0; i < total; i += 16) {
    const slice = bytes.slice(i, Math.min(i + 16, total));
    const offset = i.toString(16).padStart(8, "0");
    const hexPart = Array.from(slice).map((b) => b.toString(16).padStart(2, "0")).join(" ").padEnd(48, " ");
    const asciiPart = Array.from(slice).map((b) => (b >= 32 && b < 127) ? String.fromCharCode(b) : ".").join("");
    lines.push(`${offset}  ${hexPart}  |${asciiPart}|`);
  }
  if (bytes.length > total) {
    lines.push(`... (${bytes.length - total} more bytes truncated)`);
  }
  return lines.join("\n");
}

/** Calculate Shannon entropy of a byte sequence (0-8 bits/byte). */
export function shannonEntropy(bytes: Uint8Array): number {
  if (bytes.length === 0) return 0;
  const freq = new Array(256).fill(0);
  for (const b of bytes) freq[b]++;
  let entropy = 0;
  for (const f of freq) {
    if (f === 0) continue;
    const p = f / bytes.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/** Interpret entropy value as a human-readable hint. */
export function entropyHint(entropy: number): string {
  if (entropy < 1) return "Very low — likely structured/repetitive (e.g. plain text, zeros).";
  if (entropy < 3) return "Low — likely text or simple structured data.";
  if (entropy < 5) return "Moderate — likely code, structured binary, or natural language.";
  if (entropy < 7) return "High — likely compressed, encrypted, or random binary.";
  return "Very high — likely encrypted, compressed, or truly random.";
}

/** Detect text encoding from BOM. */
export function detectEncoding(bytes: Uint8Array): { encoding: string; hasBom: boolean } {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { encoding: "UTF-8", hasBom: true };
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { encoding: "UTF-16LE", hasBom: true };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { encoding: "UTF-16BE", hasBom: true };
  }
  return { encoding: "UTF-8 (assumed)", hasBom: false };
}

export interface ExifEntry {
  tag: string;
  value: string;
}

/** Parse basic JPEG EXIF (APP1 segment) — extracts common tags. */
export function parseJpegExif(bytes: Uint8Array): ExifEntry[] {
  // JPEG must start with FFD8
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return [];
  let pos = 2;
  while (pos < bytes.length - 4) {
    if (bytes[pos] !== 0xff) { pos++; continue; }
    const marker = bytes[pos + 1];
    // APP1 marker = 0xe1
    if (marker !== 0xe1) {
      // Skip this marker
      if (pos + 4 > bytes.length) break;
      const segLen = (bytes[pos + 2] << 8) | bytes[pos + 3];
      pos += 2 + segLen;
      continue;
    }
    // APP1 found
    const segLen = (bytes[pos + 2] << 8) | bytes[pos + 3];
    const segStart = pos + 4;
    const segEnd = Math.min(segStart + segLen - 2, bytes.length);
    // Check "Exif\0\0" header
    if (segEnd - segStart < 6) return [];
    const exifHeader = bytes.slice(segStart, segStart + 6);
    const isExif = exifHeader[0] === 0x45 && exifHeader[1] === 0x78 && exifHeader[2] === 0x69 &&
                   exifHeader[3] === 0x66 && exifHeader[4] === 0x00 && exifHeader[5] === 0x00;
    if (!isExif) return [];
    return parseTiff(bytes, segStart + 6, segEnd);
  }
  return [];
}

/** Parse TIFF header (the actual EXIF data) — minimal, reads IFD0. */
function parseTiff(bytes: Uint8Array, tiffStart: number, end: number): ExifEntry[] {
  if (tiffStart + 8 > end) return [];
  const byteOrder = bytes[tiffStart] === 0x49 && bytes[tiffStart + 1] === 0x49 ? "LE" : "BE";
  const read16 = (offset: number) => byteOrder === "LE"
    ? (bytes[offset] | (bytes[offset + 1] << 8))
    : ((bytes[offset] << 8) | bytes[offset + 1]);
  const read32 = (offset: number) => byteOrder === "LE"
    ? (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24))
    : ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]);

  const ifdOffset = tiffStart + read32(tiffStart + 4);
  if (ifdOffset + 2 > end) return [];
  const entryCount = read16(ifdOffset);
  const entries: ExifEntry[] = [];
  const tagNames: Record<number, string> = {
    0x010e: "ImageDescription",
    0x010f: "Make",
    0x0110: "Model",
    0x0112: "Orientation",
    0x011a: "XResolution",
    0x011b: "YResolution",
    0x0131: "Software",
    0x0132: "DateTime",
    0x013e: "WhitePoint",
    0x8298: "Copyright",
    0x829a: "ExposureTime",
    0x829d: "FNumber",
    0x8822: "ExposureProgram",
    0x8827: "ISOSpeedRatings",
    0x9003: "DateTimeOriginal",
    0x9004: "DateTimeDigitized",
    0x9201: "ShutterSpeedValue",
    0x9202: "ApertureValue",
    0x9204: "ExposureBiasValue",
    0x9207: "MeteringMode",
    0x9208: "LightSource",
    0x9209: "Flash",
    0x920a: "FocalLength",
    0xa002: "PixelXDimension",
    0xa003: "PixelYDimension",
    0xa210: "FocalPlaneResolutionUnit",
  };

  for (let i = 0; i < entryCount; i++) {
    const entryOffset = ifdOffset + 2 + i * 12;
    if (entryOffset + 12 > end) break;
    const tag = read16(entryOffset);
    const type = read16(entryOffset + 2);
    const count = read32(entryOffset + 4);
    const valueOffset = read32(entryOffset + 8);
    const name = tagNames[tag];
    if (!name) continue;
    let value = "";
    // Type 2 = ASCII
    if (type === 2) {
      const strOffset = count <= 4 ? entryOffset + 8 : tiffStart + valueOffset;
      const strEnd = Math.min(strOffset + count, end);
      let s = "";
      for (let j = strOffset; j < strEnd; j++) {
        if (bytes[j] === 0) break;
        s += String.fromCharCode(bytes[j]);
      }
      value = s;
    } else if (type === 3) {
      // SHORT
      value = count <= 2 ? String(read16(entryOffset + 8)) : String(read16(tiffStart + valueOffset));
    } else if (type === 4) {
      // LONG
      value = count <= 1 ? String(read32(entryOffset + 8)) : String(read32(tiffStart + valueOffset));
    } else if (type === 5) {
      // RATIONAL
      const num = read32(tiffStart + valueOffset);
      const den = read32(tiffStart + valueOffset + 4);
      value = den === 0 ? String(num) : `${num}/${den}`;
    } else {
      value = `(type ${type}, count ${count})`;
    }
    entries.push({ tag: name, value });
  }
  return entries;
}

/** Check if EXIF contains potentially sensitive info (GPS, dates). */
export function hasSensitiveExif(exif: ExifEntry[]): { sensitive: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (exif.some((e) => e.tag === "DateTimeOriginal")) reasons.push("date taken");
  if (exif.some((e) => e.tag === "Make" || e.tag === "Model")) reasons.push("device info");
  if (exif.some((e) => e.tag === "GPSInfo" || e.tag.includes("GPS"))) reasons.push("GPS coordinates");
  return { sensitive: reasons.length > 0, reasons };
}

export interface FileMetadata {
  name: string;
  size: number;
  sizeHuman: string;
  type: string; // browser-reported MIME
  lastModified: number;
  lastModifiedISO: string;
  detectedType: FileSignature | null;
  encoding: { encoding: string; hasBom: boolean };
  entropy: number;
  entropyHint: string;
  magicBytesHex: string;
  hexDump: string;
  base64Preview: string;
  exif: ExifEntry[];
  sensitiveExif: { sensitive: boolean; reasons: string[] };
}

/** Extract full metadata from a File. */
export async function extractMetadata(file: File): Promise<FileMetadata> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const previewBytes = bytes.slice(0, 1024); // first 1KB for previews
  const sigBytes = bytes.slice(0, 16);
  const detectedType = lookupSignature(sigBytes);
  const encoding = detectEncoding(sigBytes);
  const entropy = shannonEntropy(previewBytes.length > 0 ? previewBytes : bytes);
  const exif = detectedType?.ext === "jpg" || detectedType?.ext === "tiff" ? parseJpegExif(bytes) : [];
  const sensitiveExif = hasSensitiveExif(exif);

  return {
    name: file.name,
    size: file.size,
    sizeHuman: formatBytes(file.size),
    type: file.type || "unknown",
    lastModified: file.lastModified,
    lastModifiedISO: new Date(file.lastModified).toISOString(),
    detectedType,
    encoding,
    entropy,
    entropyHint: entropyHint(entropy),
    magicBytesHex: bytesToHex(sigBytes),
    hexDump: hexDump(bytes.slice(0, 256)),
    base64Preview: bytesToBase64(previewBytes),
    exif,
    sensitiveExif,
  };
}

/** Serialize metadata to a JSON string (for copy/export). */
export function metadataToJson(meta: FileMetadata): string {
  return JSON.stringify({
    name: meta.name,
    size: meta.size,
    sizeHuman: meta.sizeHuman,
    type: meta.type,
    lastModified: meta.lastModifiedISO,
    detectedType: meta.detectedType ? {
      ext: meta.detectedType.ext,
      description: meta.detectedType.description,
      mime: meta.detectedType.mime,
    } : null,
    encoding: meta.encoding,
    entropy: meta.entropy,
    entropyHint: meta.entropyHint,
    magicBytesHex: meta.magicBytesHex,
    exif: meta.exif,
    sensitiveExif: meta.sensitiveExif,
  }, null, 2);
}

// ===== History (localStorage) =====
const HISTORY_KEY = "unqtools-file-metadata-history";
const MAX_HISTORY = 10;

export interface MetadataHistoryEntry {
  name: string;
  size: number;
  type: string;
  detectedExt: string | null;
  inspectedAt: string;
}

export function loadHistory(): MetadataHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY) : [];
  } catch { return []; }
}

export function saveToHistory(entry: MetadataHistoryEntry): MetadataHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const updated = [entry, ...loadHistory()].slice(0, MAX_HISTORY);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
}

/** Build a shareable URL pointing to the file signature reference anchor. */
export function buildShareUrl(signature?: FileSignature): string {
  if (typeof window === "undefined") return "";
  if (signature) {
    return `${window.location.origin}${window.location.pathname}#sig=${signature.ext}`;
  }
  return `${window.location.origin}${window.location.pathname}#signatures`;
}
