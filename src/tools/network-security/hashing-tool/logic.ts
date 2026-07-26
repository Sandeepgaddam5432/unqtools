/**
 * Hashing Tool — pure logic.
 *
 * WebCrypto computes SHA-1/256/384/512 and HMAC-SHA-*; a pure-JS MD5
 * (RFC 1321) implementation handles MD5 because WebCrypto dropped it.
 * Encoding helpers, compare-to-expected, hash-length detection, CSV/JSON
 * export. No network, no React.
 */

export type HashAlgorithm = "MD5" | "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";
export type InputEncoding = "utf-8" | "hex" | "base64";
export type OutputEncoding = "hex" | "base64";

export interface HashResult {
  algorithm: HashAlgorithm;
  hex: string;
  base64: string;
  bitLength: number;
  brokenForSecurity: boolean;
}

export interface HashOutput {
  inputBytes: number;
  inputEncoding: InputEncoding;
  results: HashResult[];
  error?: string;
}

export const ALGORITHM_BITS: Record<HashAlgorithm, number> = {
  MD5: 128,
  "SHA-1": 160,
  "SHA-256": 256,
  "SHA-384": 384,
  "SHA-512": 512,
};

export const BROKEN_ALGORITHMS: Set<HashAlgorithm> = new Set(["MD5", "SHA-1"]);

/** Known empty-string hashes (so users can sanity-check). */
export const EMPTY_HASHES: Record<HashAlgorithm, string> = {
  MD5: "d41d8cd98f00b204e9800998ecf8427e",
  "SHA-1": "da39a3ee5e6b4b0d3255bfef95601890afd80709",
  "SHA-256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "SHA-384": "38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b",
  "SHA-512": "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e",
};

/** Decode an input string into bytes per the chosen encoding. */
export function decodeInput(text: string, encoding: InputEncoding): Uint8Array {
  if (encoding === "utf-8") return new TextEncoder().encode(text);
  if (encoding === "hex") return hexToBytes(text);
  // base64 — tolerate url-safe and missing padding
  return base64ToBytes(text);
}

/** Hex string → bytes. Tolerates spaces, colons, dashes, 0x prefix. */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[\s:-]/g, "").replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]*$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error("Invalid hex string");
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

/** Base64 / base64url → bytes. */
export function base64ToBytes(b64: string): Uint8Array {
  let s = b64.trim().replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Bytes → lowercase hex. */
export function bytesToHex(bytes: Uint8Array | ArrayBuffer): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u.length; i++) s += u[i]!.toString(16).padStart(2, "0");
  return s;
}

/** Bytes → standard base64 (with padding). */
export function bytesToBase64(bytes: Uint8Array | ArrayBuffer): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < u.length; i++) bin += String.fromCharCode(u[i]!);
  return btoa(bin);
}

/** Format a hash per requested output encoding. */
export function formatHash(hash: HashResult, encoding: OutputEncoding): string {
  return encoding === "hex" ? hash.hex : hash.base64;
}

/** Normalize a hash string for comparison (strip separators, lowercase). */
export function normalizeHash(s: string): string {
  return s.replace(/[\s:-]/g, "").toLowerCase();
}

/** Compare a computed hash against an expected value, case-insensitive, ignoring separators. */
export function compareHashes(computed: string, expected: string): boolean {
  if (!expected.trim()) return false;
  return normalizeHash(computed) === normalizeHash(expected);
}

/** Detect a hash algorithm from the length of a hex hash. */
export function detectAlgorithmFromLength(hash: string): HashAlgorithm | null {
  const len = normalizeHash(hash).length;
  switch (len) {
    case 32: return "MD5";
    case 40: return "SHA-1";
    case 64: return "SHA-256";
    case 96: return "SHA-384";
    case 128: return "SHA-512";
    default: return null;
  }
}

/** Auto-detect which computed algorithm matches an expected hash. */
export function findMatch(results: HashResult[], expected: string, encoding: OutputEncoding = "hex"): HashAlgorithm | null {
  for (const r of results) {
    if (compareHashes(formatHash(r, encoding), expected)) return r.algorithm;
  }
  return null;
}

/** Compute SHA-* via WebCrypto. Returns hex string. */
export async function computeSha(algorithm: HashAlgorithm, bytes: Uint8Array): Promise<string> {
  const algName = algorithm === "SHA-1" ? "SHA-1" : algorithm;
  const digest = await crypto.subtle.digest(algName, bytes as BufferSource);
  return bytesToHex(digest);
}

/** Compute HMAC-SHA-* via WebCrypto. Returns hex string. */
export async function computeHmac(algorithm: HashAlgorithm, bytes: Uint8Array, key: Uint8Array): Promise<string> {
  if (algorithm === "MD5") throw new Error("HMAC-MD5 is not supported (MD5 is broken).");
  const hash = algorithm === "SHA-1" ? "SHA-1" : algorithm;
  const cryptoKey = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, bytes as BufferSource);
  return bytesToHex(sig);
}

/** Compute all algorithms at once for the same input. */
export async function computeAll(bytes: Uint8Array): Promise<HashResult[]> {
  const out: HashResult[] = [];
  // MD5 (pure JS)
  const md5Hex = md5(bytes);
  out.push({ algorithm: "MD5", hex: md5Hex, base64: bytesToBase64(hexToBytes(md5Hex)), bitLength: 128, brokenForSecurity: true });
  // SHA family
  for (const alg of ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as HashAlgorithm[]) {
    const hex = await computeSha(alg, bytes);
    out.push({ algorithm: alg, hex, base64: bytesToBase64(hexToBytes(hex)), bitLength: ALGORITHM_BITS[alg], brokenForSecurity: alg === "SHA-1" });
  }
  return out;
}

/** Convert results to CSV. */
export function resultsToCsv(results: HashResult[], inputEncoding: InputEncoding, inputBytes: number): string {
  const header = `Algorithm,BitLength,Hex,Base64,SecurityStatus,InputEncoding,InputBytes`;
  const rows = results.map((r) =>
    `${r.algorithm},${r.bitLength},${r.hex},${r.base64},${r.brokenForSecurity ? "broken-checksum-only" : "ok"},${inputEncoding},${inputBytes}`,
  );
  return [header, ...rows].join("\n");
}

/** Convert results to a plain text report. */
export function resultsToText(results: HashResult[], inputEncoding: InputEncoding, inputBytes: number): string {
  const lines: string[] = [
    `# Hash Report`,
    `Input encoding: ${inputEncoding}`,
    `Input bytes: ${inputBytes}`,
    ``,
  ];
  for (const r of results) {
    lines.push(`${r.algorithm} (${r.bitLength}-bit)${r.brokenForSecurity ? " [broken — checksum only]" : ""}`);
    lines.push(`  hex:   ${r.hex}`);
    lines.push(`  base64: ${r.base64}`);
    lines.push(``);
  }
  return lines.join("\n");
}

/**
 * Pure-JS MD5 implementation per RFC 1321. Operates on a Uint8Array of bytes.
 * Returns a 32-char lowercase hex string.
 */
export function md5(input: Uint8Array): string {
  // Per-round shift amounts
  const s = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
             5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20, 5,  9, 14, 20,
             4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
             6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  // Constants
  const K: number[] = [];
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000);
  // Initial hash
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

  // Pre-processing: padding
  const msgLen = input.length;
  const bitLen = msgLen * 8;
  const withOne = msgLen + 1;
  // pad so that (msgLen + 1 + padLen) ≡ 56 (mod 64); then +8 for the length
  const padLen = ((56 - (withOne % 64)) % 64 + 64) % 64;
  const paddedLen = withOne + padLen + 8;
  const bytes = new Uint8Array(paddedLen);
  bytes.set(input);
  bytes[msgLen] = 0x80;
  // length as 64-bit little-endian (we only handle ≤2^32 bits which is fine)
  const dv = new DataView(bytes.buffer);
  dv.setUint32(paddedLen - 8, bitLen >>> 0, true);
  dv.setUint32(paddedLen - 4, Math.floor(bitLen / 0x100000000), true);

  const rotl = (x: number, n: number) => (x << n) | (x >>> (32 - n));

  // Process each 512-bit (64-byte) chunk
  for (let off = 0; off < paddedLen; off += 64) {
    const M: number[] = [];
    for (let i = 0; i < 16; i++) M[i] = dv.getUint32(off + i * 4, true);
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F: number; let g: number;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i]! + M[g]!) >>> 0;
      A = D; D = C; C = B;
      B = (B + rotl(F, s[i]!)) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  // Output as little-endian hex per word
  const toHexLe = (x: number) => {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, x, true);
    return bytesToHex(b);
  };
  return toHexLe(a0) + toHexLe(b0) + toHexLe(c0) + toHexLe(d0);
}

/** Format file size human-readable. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** Empty-string hash lookup (for sanity-check display). */
export function getEmptyHash(algorithm: HashAlgorithm): string {
  return EMPTY_HASHES[algorithm];
}
