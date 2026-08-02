/**
 * Hashing Tool (MD5, SHA-1, SHA-256) — pure logic.
 * MD5 pure-JS impl, SHA via WebCrypto.
 */

export interface HashResult {
  algorithm: string;
  hex: string;
  base64: string;
  size: number;
}

// --- MD5 (RFC 1321) pure JS implementation ---
const MD5_S = [7,12,17,22, 7,12,17,22, 7,12,17,22, 7,12,17,22, 5,9,14,20, 5,9,14,20, 5,9,14,20, 5,9,14,20, 4,11,16,23, 4,11,16,23, 4,11,16,23, 4,11,16,23, 6,10,15,21, 6,10,15,21, 6,10,15,21, 6,10,15,21];
const MD5_K = [-680876936,-389564586,606105819,-1044525330,-176418897,1200080426,-1473231341,-45705983,1770035416,-1958414417,-42063,-1990404162,1804603682,-40341101,-1502002290,1236535329,-165796510,-1069501632,643717713,-373897302,-701558691,38016083,-660478335,-405537848,568446438,-1019803690,-187363961,1163531501,-1444681467,-51403784,1735328473,-1926607734,-378558,2022574463,1839030562,-35309556,-1530992060,1272893353,-155497632,-1094730640,681279174,-358537222,-722521979,76029189,-640364487,-421815835,530742520,-995338651,-198630844,1126891415,-1416354905,-57434055,1700485571,-1894986606,-1051523,-2054922799,1873313359,-30611744,-1560198380,1309151649,-145523070,-1120210379,718787259,-343485551];

function md5Cycle(x: number[], k: number[]): void {
  let [a,b,c,d] = x;
  for (let i = 0; i < 64; i++) {
    let f: number, g: number;
    if (i < 16) { f = (b & c) | (~b & d); g = i; }
    else if (i < 32) { f = (d & b) | (~d & c); g = (5*i+1) % 16; }
    else if (i < 48) { f = b ^ c ^ d; g = (3*i+5) % 16; }
    else { f = c ^ (b | ~d); g = (7*i) % 16; }
    const temp = d; d = c; c = b;
    const u = (a + f + MD5_K[i] + k[g]) >>> 0;
    b = (b + ((u << MD5_S[i]) | (u >>> (32 - MD5_S[i])))) >>> 0;
    a = temp;
  }
  x[0] = (x[0] + a) >>> 0; x[1] = (x[1] + b) >>> 0; x[2] = (x[2] + c) >>> 0; x[3] = (x[3] + d) >>> 0;
}

export function md5(data: Uint8Array): string {
  const state = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  const bitCount = data.length * 8;
  const paddingLen = 64 - ((data.length + 9) % 64);
  const padded = new Uint8Array(data.length + 1 + paddingLen + 8);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, bitCount >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(bitCount / 0x100000000), true);
  for (let i = 0; i < padded.length; i += 64) {
    const k = new Array(16).fill(0);
    for (let j = 0; j < 16; j++) k[j] = view.getUint32(i + j * 4, true);
    md5Cycle(state, k);
  }
  const bytes: number[] = [];
  for (const word of state) { bytes.push(word & 0xff, (word >>> 8) & 0xff, (word >>> 16) & 0xff, (word >>> 24) & 0xff); }
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- WebCrypto wrappers ---
export async function sha(algorithm: string, data: Uint8Array): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) throw new Error("WebCrypto not available");
  const hashBuffer = await crypto.subtle.digest(algorithm, data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export async function hashText(text: string, algorithms: string[] = ["MD5", "SHA-1", "SHA-256", "SHA-512"]): Promise<HashResult[]> {
  const bytes = new TextEncoder().encode(text);
  const results: HashResult[] = [];
  for (const alg of algorithms) {
    if (alg === "MD5") {
      const hex = md5(bytes);
      results.push({ algorithm: "MD5", hex, base64: bytesToBase64(hexToBytes(hex)), size: bytes.length });
    } else {
      try {
        const hex = await sha(alg, bytes);
        results.push({ algorithm: alg, hex, base64: bytesToBase64(hexToBytes(hex)), size: bytes.length });
      } catch { /* skip */ }
    }
  }
  return results;
}

export async function hashFile(file: File, algorithms: string[] = ["MD5", "SHA-1", "SHA-256"]): Promise<HashResult[]> {
  const buffer = await file.arrayBuffer();
  return hashText(new TextDecoder().decode(buffer), algorithms);
}

export function verifyHash(actual: string, expected: string): boolean {
  return actual.trim().toLowerCase() === expected.trim().toLowerCase();
}

export function detectAlgorithm(hash: string): string {
  const len = hash.replace(/\s+/g, "").length;
  const map: Record<number, string> = { 32: "MD5", 40: "SHA-1", 64: "SHA-256", 96: "SHA-384", 128: "SHA-512" };
  return map[len] || "Unknown";
}

export function getAlgorithms(): string[] {
  return ["MD5", "SHA-1", "SHA-256", "SHA-384", "SHA-512"];
}

// === Backward-compat stubs ===

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function getStats(input: string, output: string): {
  inputSize: number;
  outputSize: number;
} {
  return {
    inputSize: new Blob([input]).size,
    outputSize: new Blob([output]).size,
  };
}

export function validate(input: string): string[] {
  const issues: string[] = [];
  if (!input || input.trim().length === 0) {
    issues.push("Input is empty.");
  }
  return issues;
}

export function process(input: string): { output: string; error: string | null } {
  try {
    const result = detectAlgorithm(input);
    if (typeof result === "string") {
      return { output: result, error: null };
    }
    if (result && typeof result === "object") {
      const r = result as Record<string, unknown>;
      const output =
        (typeof r.output === "string" && r.output) ||
        (typeof r.html === "string" && r.html) ||
        (typeof r.result === "string" && r.result) ||
        (typeof r.text === "string" && r.text) ||
        (typeof r.code === "string" && r.code) ||
        (typeof r.value === "string" && r.value) ||
        JSON.stringify(result, null, 2);
      const error =
        (typeof r.error === "string" && r.error) ||
        (r.ok === false && typeof r.message === "string" && r.message) ||
        null;
      return { output, error };
    }
    return { output: String(result), error: null };
  } catch (e) {
    return { output: "", error: (e as Error).message };
  }
}
