/**
 * Hex Viewer — pure logic for hex formatting, ASCII rendering, search,
 * entropy, endian swap, and file stats.
 */

export type Endian = "big" | "little";
export type BytesPerLine = 8 | 16 | 32;

export interface HexOptions {
  bytesPerLine: BytesPerLine;
  endian: Endian;
  showAscii: boolean;
  upperCase: boolean;
}

export const DEFAULT_OPTIONS: HexOptions = {
  bytesPerLine: 16,
  endian: "big",
  showAscii: true,
  upperCase: false,
};

/** Convert bytes to lowercase hex string. */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

/** Format a single byte as 2-char hex (respecting upperCase option). */
export function formatByte(b: number, upperCase: boolean = false): string {
  const hex = b.toString(16).padStart(2, "0");
  return upperCase ? hex.toUpperCase() : hex;
}

/** Format an offset as 8-char hex (classic hex dump style). */
export function formatOffset(offset: number): string {
  return offset.toString(16).padStart(8, "0");
}

/** Render a byte as ASCII char, or '.' if non-printable. */
export function byteToAscii(b: number): string {
  return (b >= 32 && b < 127) ? String.fromCharCode(b) : ".";
}

/** Generate a hex dump string for a slice of bytes. */
export function hexDump(bytes: Uint8Array, options: HexOptions, maxLines: number = 16): string {
  const lines: string[] = [];
  const bpl = options.bytesPerLine;
  const total = Math.min(bytes.length, maxLines * bpl);
  for (let i = 0; i < total; i += bpl) {
    const slice = bytes.slice(i, Math.min(i + bpl, total));
    const offset = formatOffset(i);
    const hexPart = Array.from(slice)
      .map((b) => formatByte(b, options.upperCase))
      .join(" ")
      .padEnd(bpl * 3 - 1, " ");
    const asciiPart = options.showAscii ? `  |${Array.from(slice).map(byteToAscii).join("")}|` : "";
    lines.push(`${offset}  ${hexPart}${asciiPart}`);
  }
  if (bytes.length > total) {
    lines.push(`... (${(bytes.length - total).toLocaleString()} more bytes truncated — use scroll)`);
  }
  return lines.join("\n");
}

/** Generate hex dump lines as structured rows (for interactive UI). */
export interface HexRow {
  offset: number;
  offsetHex: string;
  bytes: number[];
  hex: string[];
  ascii: string[];
}

export function hexRows(bytes: Uint8Array, options: HexOptions, maxLines: number = 16): HexRow[] {
  const rows: HexRow[] = [];
  const bpl = options.bytesPerLine;
  const total = Math.min(bytes.length, maxLines * bpl);
  for (let i = 0; i < total; i += bpl) {
    const slice = bytes.slice(i, Math.min(i + bpl, total));
    const arr = Array.from(slice);
    rows.push({
      offset: i,
      offsetHex: formatOffset(i),
      bytes: arr,
      hex: arr.map((b) => formatByte(b, options.upperCase)),
      ascii: arr.map(byteToAscii),
    });
  }
  return rows;
}

/** Search for a hex string within bytes. Returns byte offsets of matches. */
export function searchHex(bytes: Uint8Array, query: string): number[] {
  const cleaned = query.replace(/\s+/g, "").toLowerCase();
  if (cleaned.length === 0 || cleaned.length % 2 !== 0) return [];
  const needle: number[] = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    const byte = parseInt(cleaned.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) return [];
    needle.push(byte);
  }
  const matches: number[] = [];
  for (let i = 0; i <= bytes.length - needle.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) { match = false; break; }
    }
    if (match) matches.push(i);
  }
  return matches;
}

/** Search for an ASCII string within bytes. Returns byte offsets of matches. */
export function searchAscii(bytes: Uint8Array, query: string): number[] {
  if (!query) return [];
  const needle = new TextEncoder().encode(query);
  const matches: number[] = [];
  for (let i = 0; i <= bytes.length - needle.length; i++) {
    let match = true;
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) { match = false; break; }
    }
    if (match) matches.push(i);
  }
  return matches;
}

/** Parse an offset string (decimal or hex with 0x prefix). Returns null if invalid. */
export function parseOffset(input: string, maxOffset: number): number | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  let n: number;
  if (trimmed.startsWith("0x")) {
    n = parseInt(trimmed.slice(2), 16);
  } else {
    n = parseInt(trimmed, 10);
  }
  if (Number.isNaN(n) || n < 0 || n >= maxOffset) return null;
  return n;
}

/** Swap endianness of a slice (treats bytes as 32-bit words). */
export function swapEndian(bytes: Uint8Array, wordSize: 2 | 4 | 8 = 4): Uint8Array {
  const out = new Uint8Array(bytes.length);
  out.set(bytes);
  for (let i = 0; i + wordSize <= bytes.length; i += wordSize) {
    for (let j = 0; j < wordSize / 2; j++) {
      const tmp = out[i + j];
      out[i + j] = out[i + wordSize - 1 - j];
      out[i + wordSize - 1 - j] = tmp;
    }
  }
  return out;
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

/** Calculate entropy per chunk of fixed size. */
export function entropyPerChunk(bytes: Uint8Array, chunkSize: number = 1024): Array<{ offset: number; entropy: number }> {
  const out: Array<{ offset: number; entropy: number }> = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.slice(i, i + chunkSize);
    out.push({ offset: i, entropy: shannonEntropy(slice) });
  }
  return out;
}

/** Interpret entropy value as a human-readable hint. */
export function entropyHint(entropy: number): string {
  if (entropy < 1) return "Very low — structured/repetitive (e.g. plain text, zeros).";
  if (entropy < 3) return "Low — text or simple structured data.";
  if (entropy < 5) return "Moderate — code, structured binary, or natural language.";
  if (entropy < 7) return "High — compressed, encrypted, or random binary.";
  return "Very high — encrypted, compressed, or truly random.";
}

export interface FileStats {
  size: number;
  sizeHuman: string;
  mime: string | null;
  ext: string | null;
  signature: { bytes: string; mime: string; ext: string } | null;
  magicBytesHex: string;
  entropy: number;
  entropyHint: string;
  uniqueBytes: number;
}

/** Detect file type from magic bytes (first 8 bytes). */
export function detectSignature(bytes: Uint8Array): { bytes: string; mime: string; ext: string } | null {
  if (bytes.length < 4) return null;
  const hex = bytesToHex(bytes.slice(0, Math.min(8, bytes.length)));
  const sorted = [...MAGIC_BYTES].sort((a, b) => b.bytes.length - a.bytes.length);
  for (const m of sorted) {
    if (hex.startsWith(m.bytes)) return m;
  }
  return null;
}

/** File signature database. */
export const MAGIC_BYTES: Array<{ bytes: string; mime: string; ext: string }> = [
  { bytes: "89504e47", mime: "image/png", ext: "png" },
  { bytes: "ffd8ffe0", mime: "image/jpeg", ext: "jpg" },
  { bytes: "ffd8ffe1", mime: "image/jpeg", ext: "jpg" },
  { bytes: "474946383761", mime: "image/gif", ext: "gif" },
  { bytes: "474946383961", mime: "image/gif", ext: "gif" },
  { bytes: "424d", mime: "image/bmp", ext: "bmp" },
  { bytes: "25504446", mime: "application/pdf", ext: "pdf" },
  { bytes: "504b0304", mime: "application/zip", ext: "zip" },
  { bytes: "1f8b", mime: "application/gzip", ext: "gz" },
  { bytes: "526172211a07", mime: "application/vnd.rar", ext: "rar" },
  { bytes: "494433", mime: "audio/mpeg", ext: "mp3" },
  { bytes: "52494646", mime: "audio/wav", ext: "wav" },
  { bytes: "4f676753", mime: "audio/ogg", ext: "ogg" },
  { bytes: "1a45dfa3", mime: "video/webm", ext: "webm" },
  { bytes: "4d5a", mime: "application/x-msdownload", ext: "exe" },
  { bytes: "7f454c46", mime: "application/x-executable", ext: "elf" },
  { bytes: "cafebabe", mime: "application/x-java-applet", ext: "class" },
  { bytes: "53514c697465", mime: "application/x-sqlite3", ext: "sqlite" },
  { bytes: "3c3f786d6c", mime: "application/xml", ext: "xml" },
  { bytes: "7b5c727466", mime: "application/rtf", ext: "rtf" },
];

/** Format bytes as human-readable. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Compute full file stats from bytes. */
export function computeStats(bytes: Uint8Array): FileStats {
  const sig = detectSignature(bytes);
  const sigBytes = bytes.slice(0, 16);
  const uniqueSet = new Set<number>();
  for (const b of bytes) uniqueSet.add(b);
  const entropy = shannonEntropy(bytes);
  return {
    size: bytes.length,
    sizeHuman: formatBytes(bytes.length),
    mime: sig?.mime ?? null,
    ext: sig?.ext ?? null,
    signature: sig,
    magicBytesHex: bytesToHex(sigBytes),
    entropy,
    entropyHint: entropyHint(entropy),
    uniqueBytes: uniqueSet.size,
  };
}

/** Convert a hex dump to a downloadable text string. */
export function hexDumpToText(bytes: Uint8Array, options: HexOptions): string {
  // Generate the full dump (no truncation) — caller may want to limit size
  return hexDump(bytes, options, Math.ceil(bytes.length / options.bytesPerLine));
}

// ===== History (localStorage) =====
const HISTORY_KEY = "unqtools-hex-viewer-history";
const MAX_HISTORY = 10;

export interface HistoryEntry {
  filename: string;
  size: number;
  ext: string | null;
  entropy: number;
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
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
}

/** Read a slice of a File using chunked reads (for very large files). */
export async function readFileSlice(file: File, start: number, end: number): Promise<Uint8Array> {
  const slice = file.slice(start, end);
  const buf = await slice.arrayBuffer();
  return new Uint8Array(buf);
}

/** Read entire file into a Uint8Array (with size warning). */
export async function readFileBytes(file: File, maxSize: number = 100 * 1024 * 1024): Promise<Uint8Array> {
  if (file.size > maxSize) {
    throw new Error(`File too large (${formatBytes(file.size)}). Maximum supported is ${formatBytes(maxSize)}.`);
  }
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}
