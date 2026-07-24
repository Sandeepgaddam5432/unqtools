/**
 * SSH Key Fingerprint Explorer — pure logic.
 * Web Crypto API calls (for SHA-256/512) happen in ui.tsx.
 * This module handles parsing + MD5 (using a simple implementation) + randomart.
 */

export interface SshKeyInfo {
  type: "ssh-rsa" | "ssh-ed25519" | "ssh-ecdsa" | "ssh-dss" | "unknown";
  rawType: string;
  comment: string;
  rawBase64: string;
  rawBytes: Uint8Array;
  bitCount: number;
  isValid: boolean;
  errors: string[];
}

/** Parse an SSH public key line (e.g. "ssh-ed25519 AAAAC3... user@host"). */
export function parseSshKey(input: string): SshKeyInfo | { error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { error: "Empty input." };

  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return { error: "Expected format: <type> <base64-key> [comment]" };

  const rawType = parts[0]!;
  const rawBase64 = parts[1]!;
  const comment = parts.slice(2).join(" ") || "";

  const knownTypes: SshKeyInfo["type"][] = ["ssh-rsa", "ssh-ed25519", "ssh-ecdsa", "ssh-dss"];
  const type = (knownTypes.includes(rawType as never) ? rawType : "unknown") as SshKeyInfo["type"];

  let rawBytes: Uint8Array;
  try {
    rawBytes = base64ToBytes(rawBase64);
  } catch (e) {
    return { error: `Invalid base64: ${(e as Error).message}` };
  }

  const errors: string[] = [];
  if (type === "unknown") errors.push(`Unknown key type: ${rawType}. Known types: ${knownTypes.join(", ")}`);

  // Validate that the first length-prefixed string in rawBytes matches the type
  if (rawBytes.length >= 4) {
    const view = new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
    const typeLen = view.getUint32(0);
    if (typeLen + 4 <= rawBytes.length) {
      const typeInBytes = new TextDecoder().decode(rawBytes.slice(4, 4 + typeLen));
      if (typeInBytes !== rawType) {
        errors.push(`Key type '${rawType}' doesn't match embedded type '${typeInBytes}'.`);
      }
    }
  }

  // Estimate bit count based on type
  let bitCount = 0;
  if (type === "ssh-rsa") {
    // RSA keys: e + n + d + p + q + ...; the modulus (n) is the second length-prefixed blob
    bitCount = estimateRsaBits(rawBytes);
  } else if (type === "ssh-ed25519") {
    bitCount = 256; // Ed25519 is always 256 bits
  } else if (type === "ssh-ecdsa") {
    bitCount = estimateEcdsaBits(rawType);
  } else if (type === "ssh-dss") {
    bitCount = 1024;
  }

  return {
    type, rawType, comment, rawBase64, rawBytes, bitCount,
    isValid: errors.length === 0,
    errors,
  };
}

function base64ToBytes(b64: string): Uint8Array {
  const cleaned = b64.replace(/\s+/g, "");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function estimateRsaBits(bytes: Uint8Array): number {
  // SSH RSA blob format: len(type) + type + len(e) + e + len(n) + n
  if (bytes.length < 4) return 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  const typeLen = view.getUint32(offset); offset += 4 + typeLen;
  if (offset + 4 > bytes.length) return 0;
  const eLen = view.getUint32(offset); offset += 4 + eLen;
  if (offset + 4 > bytes.length) return 0;
  const nLen = view.getUint32(offset);
  // First byte of n might be 0x00 (sign-extension padding); skip it
  const firstByte = bytes[offset + 4]!;
  const effectiveLen = firstByte === 0 ? nLen - 1 : nLen;
  return effectiveLen * 8;
}

function estimateEcdsaBits(rawType: string): number {
  if (rawType.includes("nistp256")) return 256;
  if (rawType.includes("nistp384")) return 384;
  if (rawType.includes("nistp521")) return 521;
  return 0;
}

/** Compute MD5 hash of bytes (simple RFC 1321 implementation). */
export function md5(bytes: Uint8Array): string {
  // Simple MD5 implementation
  const s = (n: number, x: number, y: number) => (x >>> n) | (x << (32 - n));
  const r = (q: number, a: number, b: number, x: number, s: number, t: number) => {
    const c = (a + b + x + t) | 0;
    return (c << s) | (c >>> (32 - s));
  };
  const F = (x: number, y: number, z: number) => (x & y) | (~x & z);
  const G = (x: number, y: number, z: number) => (x & z) | (y & ~z);
  const H = (x: number, y: number, z: number) => x ^ y ^ z;
  const I = (x: number, y: number, z: number) => y ^ (x | ~z);

  // Pad message
  const origLen = bytes.length;
  const bitLen = origLen * 8;
  const padded = new Uint8Array(((origLen + 8) >> 6) * 64 + 64);
  padded.set(bytes);
  padded[origLen] = 0x80;
  // Append length as 64-bit little-endian
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, bitLen >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(bitLen / 0x100000000), true);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

  for (let i = 0; i < padded.length; i += 64) {
    const M: number[] = [];
    for (let j = 0; j < 16; j++) M.push(view.getUint32(i + j * 4, true));
    let A = a0, B = b0, C = c0, D = d0;

    for (let j = 0; j < 64; j++) {
      let f: number, g: number;
      if (j < 16) { f = F(B, C, D); g = j; }
      else if (j < 32) { f = G(B, C, D); g = (5 * j + 1) % 16; }
      else if (j < 48) { f = H(B, C, D); g = (3 * j + 5) % 16; }
      else { f = I(B, C, D); g = (7 * j) % 16; }
      const tmp = D; D = C; C = B;
      const k = MD5_K[j]!;
      const shifts = MD5_S[j]!;
      B = B + r(0, A, f, M[g]! + k, shifts, 0) | 0;
      A = tmp;
    }
    a0 = (a0 + A) | 0;
    b0 = (b0 + B) | 0;
    c0 = (c0 + C) | 0;
    d0 = (d0 + D) | 0;
  }

  const result = new Uint8Array(16);
  const rview = new DataView(result.buffer);
  rview.setUint32(0, a0, true);
  rview.setUint32(4, b0, true);
  rview.setUint32(8, c0, true);
  rview.setUint32(12, d0, true);
  return Array.from(result).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const MD5_S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
                5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
                4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
                6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];

const MD5_K = [
  0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
  0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
  0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
  0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
  0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
  0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
  0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
  0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
];

/** Format MD5 hash as colon-separated hex (SSH style). */
export function formatMd5Fingerprint(hashHex: string): string {
  return hashHex.match(/.{2}/g)!.join(":");
}

/** Generate randomart (ASCII art) visualization for a fingerprint. */
export function generateRandomart(hashHex: string): string {
  // Simple 9x17 ASCII art visualization (similar to OpenSSH randomart)
  const chars = " .o+=*B@XSG$#";
  const fields: number[][] = Array.from({ length: 9 }, () => new Array(17).fill(0));
  let x = 8, y = 4;
  fields[y]![x] = 1; // start

  for (let i = 0; i < hashHex.length; i += 2) {
    const byte = parseInt(hashHex.slice(i, i + 2), 16);
    for (let bit = 0; bit < 8; bit++) {
      const dir = (byte >> bit) & 1;
      if (dir) {
        if (x === 16 || (x < 16 && fields[y]![x + 1]! > 0)) y += y < 8 ? 1 : 0;
        else x++;
      } else {
        if (x === 0 || (x > 0 && fields[y]![x - 1]! > 0)) y += y < 8 ? 1 : 0;
        else x--;
      }
      x = Math.max(0, Math.min(16, x));
      y = Math.max(0, Math.min(8, y));
      if (fields[y]![x]! < chars.length - 2) fields[y]![x]!++;
    }
  }
  fields[4]![8] = chars.length - 2; // start
  // Find end position (last visited cell with max value, excluding start)
  let maxVal = 0, endX = 8, endY = 4;
  for (let i = 0; i < 9; i++) for (let j = 0; j < 17; j++) {
    if (i === 4 && j === 8) continue;
    if (fields[i]![j]! > maxVal) { maxVal = fields[i]![j]!; endX = j; endY = i; }
  }
  if (fields[endY]![endX]! < chars.length - 1) fields[endY]![endX]! = chars.length - 1;

  let out = `+---[IMG]---+\n`;
  for (let i = 0; i < 9; i++) {
    out += `|${fields[i]!.map((v) => chars[Math.min(v, chars.length - 1)]).join("")}|\n`;
  }
  out += `+---[IMG]---+`;
  return out;
}

/** Generate authorized_keys entry. */
export function generateAuthorizedKeysEntry(info: SshKeyInfo): string {
  return `${info.rawType} ${info.rawBase64} ${info.comment}`.trim();
}

/** Convert bytes to hex. */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}
