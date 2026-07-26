/**
 * File Hash Validator — pure logic.
 * WebCrypto-based hashing + pure-JS MD5.
 */

export interface HashResult {
  algorithm: string;
  hex: string;
  base64: string;
  size: number;
}

export interface VerifyResult {
  algorithm: string;
  expected: string;
  actual: string;
  match: boolean;
}

const MD5_S: number[] = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const MD5_K: number[] = [
  -680876936, -389564586, 606105819, -1044525330, -176418897, 1200080426, -1473231341, -45705983,
  1770035416, -1958414417, -42063, -1990404162, 1804603682, -40341101, -1502002290, 1236535329,
  -165796510, -1069501632, 643717713, -373897302, -701558691, 38016083, -660478335, -405537848,
  568446438, -1019803690, -187363961, 1163531501, -1444681467, -51403784, 1735328473, -1926607734,
  -378558, -2022574463, 1839030562, -35309556, -1530992060, 1272893353, -155497632, -1094730640,
  681279174, -358537222, -722521979, 76029189, -640364487, -421815835, 530742520, -995338651,
  -198630844, 1126891415, -1416354905, -57434055, 1700485571, -1894986606, -1051523, -2054922799,
  1873313359, -30611744, -1560198380, 1309151649, -145523070, -1120210379, 718787259, -343485551,
];

function md5Cycle(x: number[], k: number[]): void {
  let [a, b, c, d] = x;

  for (let i = 0; i < 64; i++) {
    let f: number;
    let g: number;
    if (i < 16) {
      f = (b & c) | (~b & d);
      g = i;
    } else if (i < 32) {
      f = (d & b) | (~d & c);
      g = (5 * i + 1) % 16;
    } else if (i < 48) {
      f = b ^ c ^ d;
      g = (3 * i + 5) % 16;
    } else {
      f = c ^ (b | ~d);
      g = (7 * i) % 16;
    }

    const temp = d;
    d = c;
    c = b;
    const u = (a + f + MD5_K[i] + k[g]) >>> 0;
    b = (b + ((u << MD5_S[i]) | (u >>> (32 - MD5_S[i])))) >>> 0;
    a = temp;
  }

  x[0] = (x[0] + a) >>> 0;
  x[1] = (x[1] + b) >>> 0;
  x[2] = (x[2] + c) >>> 0;
  x[3] = (x[3] + d) >>> 0;
}

function md5BlockSize(): number {
  return 64;
}

function md5Finalize(state: number[], msg: Uint8Array): number[] {
  const bitCount = msg.length * 8;
  // Append 0x80 then zeros then 64-bit length
  const paddingLen = md5BlockSize() - ((msg.length + 9) % md5BlockSize());
  const padded = new Uint8Array(msg.length + 1 + paddingLen + 8);
  padded.set(msg);
  padded[msg.length] = 0x80;
  // Set 64-bit length (little-endian, low 32 bits only for JS-safe sizes)
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, bitCount >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(bitCount / 0x100000000), true);

  for (let i = 0; i < padded.length; i += 64) {
    const k = new Array(16).fill(0);
    for (let j = 0; j < 16; j++) {
      k[j] = view.getUint32(i + j * 4, true);
    }
    md5Cycle(state, k);
  }
  return state;
}

export function md5(data: Uint8Array): string {
  const state = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  md5Finalize(state, data);
  // Convert state to hex (little-endian per 4 bytes)
  const bytes: number[] = [];
  for (const word of state) {
    bytes.push((word >>> 0) & 0xff);
    bytes.push((word >>> 8) & 0xff);
    bytes.push((word >>> 16) & 0xff);
    bytes.push((word >>> 24) & 0xff);
  }
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function webCryptoHash(algorithm: string, data: Uint8Array): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("WebCrypto not available");
  }
  const hashBuffer = await crypto.subtle.digest(algorithm, data);
  const bytes = new Uint8Array(hashBuffer);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

const ALGORITHMS = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;

export async function hashFile(file: File, algorithms: string[] = ["SHA-256", "SHA-1", "MD5"]): Promise<HashResult[]> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const results: HashResult[] = [];

  for (const alg of algorithms) {
    if (alg === "MD5") {
      const hex = md5(bytes);
      results.push({
        algorithm: "MD5",
        hex,
        base64: bytesToBase64(hexToBytes(hex)),
        size: bytes.length,
      });
    } else if (ALGORITHMS.includes(alg as any)) {
      try {
        const hex = await webCryptoHash(alg, bytes);
        results.push({
          algorithm: alg,
          hex,
          base64: bytesToBase64(hexToBytes(hex)),
          size: bytes.length,
        });
      } catch (e) {
        // skip
      }
    }
  }
  return results;
}

export async function hashText(text: string, algorithms: string[] = ["SHA-256"]): Promise<HashResult[]> {
  const bytes = new TextEncoder().encode(text);
  const fakeFile = new File([bytes], "text.txt");
  return hashFile(fakeFile, algorithms);
}

export function verifyHash(actual: string, expected: string): VerifyResult {
  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "");
  return {
    algorithm: "unknown",
    expected,
    actual,
    match: normalize(actual) === normalize(expected),
  };
}

export function detectAlgorithmFromHash(hash: string): string {
  const len = hash.replace(/\s+/g, "").length;
  switch (len) {
    case 32: return "MD5";
    case 40: return "SHA-1";
    case 64: return "SHA-256";
    case 96: return "SHA-384";
    case 128: return "SHA-512";
    default: return "Unknown";
  }
}

export function formatHashList(results: HashResult[]): string {
  // GNU sha256sum-style output
  return results.map((r) => `${r.hex}  file-${r.size}`).join("\n");
}

export function parseHashList(text: string): { hash: string; filename: string }[] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((line) => {
      const m = line.match(/^([0-9a-fA-F]+)\s+\*?(.+)$/);
      if (m) return { hash: m[1].toLowerCase(), filename: m[2] };
      return null;
    })
    .filter(Boolean) as { hash: string; filename: string }[];
}

export function generateChecksumFile(filename: string, results: HashResult[]): string {
  return results.map((r) => `${r.hex}  ${filename}`).join("\n");
}
