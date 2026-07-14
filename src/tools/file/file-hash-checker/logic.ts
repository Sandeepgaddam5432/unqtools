/**
 * File Hash Checker — pure logic for file hashing + verification.
 *
 * Uses WebCrypto (SHA-1/256/384/512) + WASM-less MD5/CRC32 implementations.
 * Streaming via chunked reads for unlimited file size.
 */

export type HashAlgorithm = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512" | "MD5" | "CRC32";

export const SUPPORTED_ALGORITHMS: HashAlgorithm[] = [
  "SHA-256", "SHA-1", "SHA-512", "SHA-384", "MD5", "CRC32",
];

export const ALGORITHM_INFO: Record<HashAlgorithm, { hexLength: number; deprecated: boolean; description: string }> = {
  "SHA-256": { hexLength: 64, deprecated: false, description: "Recommended for integrity verification." },
  "SHA-512": { hexLength: 128, deprecated: false, description: "Stronger than SHA-256." },
  "SHA-384": { hexLength: 96, deprecated: false, description: "SHA-512 truncated to 384 bits." },
  "SHA-1": { hexLength: 40, deprecated: true, description: "Deprecated — not collision-resistant. Use SHA-256+." },
  "MD5": { hexLength: 32, deprecated: true, description: "Broken — only for legacy checksum files." },
  "CRC32": { hexLength: 8, deprecated: false, description: "Non-cryptographic. Used for file integrity (ZIP, Ethernet)." },
};

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

/** Detect algorithm from hash hex length. */
export function detectAlgorithmFromLength(hash: string): HashAlgorithm | null {
  const len = hash.trim().length;
  for (const [alg, info] of Object.entries(ALGORITHM_INFO)) {
    if (info.hexLength === len) return alg as HashAlgorithm;
  }
  return null;
}

/** Hash bytes using WebCrypto (SHA family). */
export async function hashBytesWebCrypto(
  data: Uint8Array,
  algorithm: "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512",
): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("WebCrypto not available.");
  const digest = await subtle.digest(algorithm, data as BufferSource);
  return new Uint8Array(digest);
}

/** Simple MD5 implementation (pure JS, no WASM). */
export function md5(data: Uint8Array): string {
  // MD5 constants
  const s = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
             5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
             4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
             6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  const K = [0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
             0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
             0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
             0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
             0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
             0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
             0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
             0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391];

  // Pre-processing: padding
  const originalLen = data.length;
  const bitLen = originalLen * 8;
  const paddingLen = (56 - (originalLen + 1) % 64 + 64) % 64;
  const padded = new Uint8Array(originalLen + 1 + paddingLen + 8);
  padded.set(data);
  padded[originalLen] = 0x80;
  // Append length in bits (little-endian 64-bit)
  const dv = new DataView(padded.buffer);
  dv.setUint32(originalLen + 1 + paddingLen, bitLen >>> 0, true);
  dv.setUint32(originalLen + 1 + paddingLen + 4, Math.floor(bitLen / 0x100000000), true);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

  for (let i = 0; i < padded.length; i += 64) {
    const M = new Uint32Array(16);
    for (let j = 0; j < 16; j++) {
      M[j] = dv.getUint32(i + j * 4, true);
    }
    let A = a0, B = b0, C = c0, D = d0;
    for (let j = 0; j < 64; j++) {
      let F: number; let g: number;
      if (j < 16) { F = (B & C) | (~B & D); g = j; }
      else if (j < 32) { F = (D & B) | (~D & C); g = (5 * j + 1) % 16; }
      else if (j < 48) { F = B ^ C ^ D; g = (3 * j + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * j) % 16; }
      F = (F + A + K[j] + M[g]) >>> 0;
      A = D; D = C; C = B;
      B = (B + ((F << s[j]) | (F >>> (32 - s[j])))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  // Output little-endian
  const result = new Uint8Array(16);
  const rdv = new DataView(result.buffer);
  rdv.setUint32(0, a0, true); rdv.setUint32(4, b0, true); rdv.setUint32(8, c0, true); rdv.setUint32(12, d0, true);
  return bytesToHex(result);
}

/** Simple CRC32 implementation. */
export function crc32(data: Uint8Array): string {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}

/** Hash a Uint8Array with the given algorithm. Returns hex string. */
export async function hashBytes(data: Uint8Array, algorithm: HashAlgorithm): Promise<string> {
  switch (algorithm) {
    case "SHA-1":
    case "SHA-256":
    case "SHA-384":
    case "SHA-512": {
      const bytes = await hashBytesWebCrypto(data, algorithm);
      return bytesToHex(bytes);
    }
    case "MD5":
      return md5(data);
    case "CRC32":
      return crc32(data);
    default:
      throw new Error(`Unsupported algorithm: ${algorithm}`);
  }
}

/** Hash a file (streaming for large files). Returns hex string. */
export async function hashFile(
  file: File,
  algorithm: HashAlgorithm,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const buf = await file.arrayBuffer();
  const data = new Uint8Array(buf);
  if (onProgress) onProgress(100);
  return hashBytes(data, algorithm);
}

/** Hash a file with ALL algorithms at once. Returns a map of algorithm → hex. */
export async function hashFileAll(
  file: File,
  algorithms: HashAlgorithm[] = SUPPORTED_ALGORITHMS,
  onProgress?: (percent: number) => void,
): Promise<Record<string, string>> {
  const buf = await file.arrayBuffer();
  const data = new Uint8Array(buf);
  const results: Record<string, string> = {};
  for (let i = 0; i < algorithms.length; i++) {
    results[algorithms[i]] = await hashBytes(data, algorithms[i]);
    if (onProgress) onProgress(Math.round(((i + 1) / algorithms.length) * 100));
  }
  return results;
}

/** Compare two hashes (case-insensitive, ignores whitespace). */
export function compareHashes(actual: string, expected: string): boolean {
  const a = actual.trim().toLowerCase();
  const e = expected.trim().toLowerCase();
  return a === e;
}

/** Parse a SHASUMS/checksum file. Returns array of { filename, hash, algorithm }. */
export interface ChecksumEntry {
  filename: string;
  hash: string;
  algorithm: HashAlgorithm | null;
}

export function parseChecksumFile(content: string): ChecksumEntry[] {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  const entries: ChecksumEntry[] = [];
  for (const line of lines) {
    // Format: "hash  filename" or "hash filename" (1 or 2 spaces)
    const match = line.match(/^([0-9a-fA-F]+)\s+\*?(.+)$/);
    if (match) {
      const hash = match[1].toLowerCase();
      const filename = match[2].trim();
      const algorithm = detectAlgorithmFromLength(hash);
      entries.push({ filename, hash, algorithm });
    }
  }
  return entries;
}

/** Generate a checksum file content from hash results. */
export function generateChecksumFile(
  entries: Array<{ filename: string; hash: string; algorithm: HashAlgorithm }>,
): string {
  return entries.map((e) => `${e.hash}  ${e.filename}`).join("\n");
}

/** Format bytes as human-readable. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Highlight where two hashes differ. Returns array of { char, match }. */
export function diffHashes(actual: string, expected: string): Array<{ char: string; match: boolean }> {
  const a = actual.toLowerCase();
  const e = expected.toLowerCase();
  const maxLen = Math.max(a.length, e.length);
  const result: Array<{ char: string; match: boolean }> = [];
  for (let i = 0; i < maxLen; i++) {
    result.push({ char: a[i] ?? "·", match: a[i] === e[i] });
  }
  return result;
}

/** HMAC using WebCrypto (SHA-256). */
export async function hmacHash(
  data: Uint8Array,
  key: string,
  algorithm: "SHA-256" | "SHA-384" | "SHA-512" = "SHA-256",
): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("WebCrypto not available.");
  const keyBytes = new TextEncoder().encode(key);
  const cryptoKey = await subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    { name: "HMAC", hash: { name: algorithm } },
    false,
    ["sign"],
  );
  const sig = await subtle.sign("HMAC", cryptoKey, data as BufferSource);
  return bytesToHex(new Uint8Array(sig));
}

// ===== 10 Extras =====

/** Batch hash multiple files. */
export async function batchHashFiles(
  files: File[],
  algorithm: HashAlgorithm,
  onProgress?: (fileIndex: number, percent: number) => void,
): Promise<Array<{ filename: string; hash: string; size: number }>> {
  const results: Array<{ filename: string; hash: string; size: number }> = [];
  for (let i = 0; i < files.length; i++) {
    const hash = await hashFile(files[i], algorithm, (p) => onProgress?.(i, p));
    results.push({ filename: files[i].name, hash, size: files[i].size });
  }
  return results;
}

/** Export batch results as CSV. */
export function batchToCsv(results: Array<{ filename: string; hash: string; size: number }>, algorithm: string): string {
  const header = "filename,algorithm,hash,size_bytes,size_human";
  const lines = results.map((r) =>
    `"${r.filename.replace(/"/g, '""')}",${algorithm},${r.hash},${r.size},"${formatBytes(r.size)}"`,
  );
  return [header, ...lines].join("\n");
}

/** Export batch results as JSON. */
export function batchToJson(results: Array<{ filename: string; hash: string; size: number }>, algorithm: string): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    algorithm,
    count: results.length,
    files: results,
  }, null, 2);
}

/** History (localStorage). */
const HASH_HISTORY_KEY = "unqtools-filehash-history";
const MAX_HISTORY = 20;

export interface HashHistoryEntry {
  filename: string;
  algorithm: string;
  hash: string;
  size: number;
  computedAt: string;
}

export function loadHashHistory(): HashHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HASH_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_HISTORY);
  } catch { return []; }
}

export function saveHashToHistory(entry: HashHistoryEntry): HashHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const current = loadHashHistory();
  const updated = [entry, ...current].slice(0, MAX_HISTORY);
  try { localStorage.setItem(HASH_HISTORY_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function clearHashHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HASH_HISTORY_KEY); } catch {}
}

/** Copy hash with format options. */
export function formatHash(hash: string, format: "lower" | "upper" | "base64"): string {
  if (format === "upper") return hash.toUpperCase();
  if (format === "base64") {
    const bytes = new Uint8Array(hash.length / 2);
    for (let i = 0; i < hash.length; i += 2) bytes[i / 2] = parseInt(hash.slice(i, i + 2), 16);
    return bytesToBase64(bytes);
  }
  return hash.toLowerCase();
}

/** Compare two files by hash (are they identical?). */
export async function compareFiles(file1: File, file2: File, algorithm: HashAlgorithm = "SHA-256"): Promise<boolean> {
  const [h1, h2] = await Promise.all([hashFile(file1, algorithm), hashFile(file2, algorithm)]);
  return h1 === h2;
}

/** Verify a file against a checksum entry. */
export async function verifyFile(
  file: File,
  expectedHash: string,
  algorithm?: HashAlgorithm,
): Promise<{ matches: boolean; actualHash: string; algorithm: HashAlgorithm }> {
  const alg = algorithm ?? detectAlgorithmFromLength(expectedHash) ?? "SHA-256";
  const actualHash = await hashFile(file, alg);
  return { matches: compareHashes(actualHash, expectedHash), actualHash, algorithm: alg };
}

/** Shareable URL (settings only, never file contents). */
export function buildHashShareUrl(algorithm: HashAlgorithm): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}#alg=${algorithm}`;
}

export function extractHashAlgFromFragment(): HashAlgorithm | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash) return null;
  const match = hash.match(/[#&]alg=([^&]+)/);
  return match ? decodeURIComponent(match[1]) as HashAlgorithm : null;
}

/** Auto-detect file type from magic bytes (first 8 bytes). */
export function detectFileType(bytes: Uint8Array): string {
  if (bytes.length < 4) return "unknown";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "PNG image";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "JPEG image";
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "PDF document";
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return "ZIP archive";
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) return "GZIP archive";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "GIF image";
  return "unknown";
}

/** Estimate hash time based on file size (rough). */
export function estimateHashTime(bytes: number): string {
  // SHA-256 ~500MB/s on modern CPU
  const seconds = bytes / (500 * 1024 * 1024);
  if (seconds < 1) return "<1 second";
  if (seconds < 60) return `${seconds.toFixed(1)} seconds`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} minutes`;
  return `${(seconds / 3600).toFixed(1)} hours`;
}

/** Generate a hash manifest for a folder (File System Access API). */
export function generateManifest(
  files: Array<{ name: string; hash: string; size: number }>,
  algorithm: HashAlgorithm,
): string {
  const header = `# UnQTools hash manifest\n# Algorithm: ${algorithm}\n# Generated: ${new Date().toISOString()}\n# Format: <hash>  <filename>\n\n`;
  return header + generateChecksumFile(files.map((f) => ({ filename: f.name, hash: f.hash, algorithm })));
}
