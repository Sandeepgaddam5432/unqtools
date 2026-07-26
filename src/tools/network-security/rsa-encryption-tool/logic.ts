/**
 * RSA Encryption Tool — pure logic.
 *
 * Provides RSA key sizing helpers, OAEP/PKCS1v15 padding mode descriptions,
 * JWK field planning, key-fingerprint planning, and security-level
 * indicators. The actual encryption is performed in the UI layer using the
 * WebCrypto API; this module keeps all logic pure and testable.
 *
 * Pure only — no DOM, no crypto.subtle calls.
 */

export type KeySize = 1024 | 2048 | 4096;
export type PaddingMode = "OAEP-SHA1" | "OAEP-SHA256" | "OAEP-SHA384" | "OAEP-SHA512" | "PKCS1-v1.5";

export interface KeyGenParams {
  keySize: KeySize;
  /** Public exponent — 65537 recommended. */
  publicExponent: number;
  /** Whether to make the key extractable. */
  extractable: boolean;
}

export interface SecurityInfo {
  keySize: KeySize;
  /** Approximate symmetric-equivalent strength in bits (NIST SP 800-57). */
  symmetricBits: number;
  /** NIST security level. */
  level: "deprecated" | "acceptable" | "strong" | "very-strong";
  /** Estimated brute-force cost in years (very rough). */
  estimateYears: number;
  notes: string[];
}

export interface KeyFingerprintPlan {
  /** SHA-256 fingerprint of the SPKI / PKCS8 DER bytes (computed in UI). */
  fingerprintHex: string;
  /** Truncated fingerprint for short display. */
  shortId: string;
  /** Algorithm tag. */
  algorithm: string;
}

export interface JwkShape {
  kty: "RSA";
  n?: string; // public modulus (base64url)
  e?: string; // public exponent (base64url)
  d?: string; // private exponent
  p?: string; // first prime
  q?: string; // second prime
  dp?: string;
  dq?: string;
  qi?: string;
  key_ops: string[];
  ext: boolean;
  alg: string;
}

/** Look up security info for a key size. Pure. */
export function securityInfoFor(keySize: KeySize): SecurityInfo {
  switch (keySize) {
    case 1024:
      return {
        keySize, symmetricBits: 80, level: "deprecated",
        estimateYears: 1,
        notes: ["1024-bit RSA is deprecated (NIST SP 800-131A).", "Equivalent to ~80-bit symmetric security.", "Use only for legacy interop."],
      };
    case 2048:
      return {
        keySize, symmetricBits: 112, level: "acceptable",
        estimateYears: 1e6,
        notes: ["2048-bit RSA is acceptable through 2030.", "Equivalent to ~112-bit symmetric security.", "Recommended minimum for new deployments."],
      };
    case 4096:
      return {
        keySize, symmetricBits: 152, level: "very-strong",
        estimateYears: 1e12,
        notes: ["4096-bit RSA offers long-term security.", "Equivalent to ~152-bit symmetric security.", "Slower than 2048-bit; use when strongest security needed."],
      };
    default:
      return { keySize, symmetricBits: 0, level: "deprecated", estimateYears: 0, notes: ["Unsupported key size."] };
  }
}

/** Map a padding mode to a WebCrypto algorithm name. */
export function paddingToAlgorithm(mode: PaddingMode): string {
  switch (mode) {
    case "OAEP-SHA1": return "RSA-OAEP";
    case "OAEP-SHA256": return "RSA-OAEP";
    case "OAEP-SHA384": return "RSA-OAEP";
    case "OAEP-SHA512": return "RSA-OAEP";
    case "PKCS1-v1.5": return "RSASSA-PKCS1-v1_5";
  }
}

/** Map a padding mode to the hash function name. */
export function paddingToHash(mode: PaddingMode): string {
  switch (mode) {
    case "OAEP-SHA1": return "SHA-1";
    case "OAEP-SHA256": return "SHA-256";
    case "OAEP-SHA384": return "SHA-384";
    case "OAEP-SHA512": return "SHA-512";
    case "PKCS1-v1.5": return "SHA-256";
  }
}

/** Compute the maximum plaintext size for OAEP padding given a key size and hash. */
export function maxPlaintextBytes(keySize: KeySize, mode: PaddingMode): number {
  const keyBytes = keySize / 8;
  if (mode === "PKCS1-v1.5") return keyBytes - 11;
  const hashBytes = mode === "OAEP-SHA1" ? 20 : mode === "OAEP-SHA256" ? 32 : mode === "OAEP-SHA384" ? 48 : 64;
  return keyBytes - 2 * hashBytes - 2;
}

/** Build a WebCrypto KeyAlgorithm identifier for generateKey. */
export function keyAlgorithm(params: KeyGenParams): RsaHashedKeyAlgorithm {
  return {
    name: "RSA-OAEP",
    modulusLength: params.keySize,
    publicExponent: new Uint8Array(toBytes(params.publicExponent)),
    hash: "SHA-256",
  };
}

/** Convert an integer to big-endian bytes. Pure. */
export function toBytes(n: number): number[] {
  if (n === 0) return [0];
  const out: number[] = [];
  let v = n;
  while (v > 0) {
    out.unshift(v & 0xff);
    v = Math.floor(v / 256);
  }
  return out;
}

/** Plan a JWK shape from key params (placeholder values to be filled by UI). */
export function planJwkShape(params: KeyGenParams, mode: PaddingMode, isPublic: boolean): JwkShape {
  const alg = paddingToAlgorithm(mode) === "RSA-OAEP"
    ? `RSA-OAEP-${paddingToHash(mode).replace("-", "")}`
    : "RSASSA-PKCS1-v1_5-SHA256";
  const key_ops = isPublic ? ["encrypt"] : ["decrypt"];
  return {
    kty: "RSA",
    key_ops,
    ext: params.extractable,
    alg,
    ...(isPublic ? { n: "", e: "" } : { d: "", p: "", q: "", dp: "", dq: "", qi: "", n: "", e: "" }),
  };
}

/** Plan a key fingerprint (placeholder fingerprint computed by UI). */
export function planFingerprint(keySize: KeySize, publicModulusHex = ""): KeyFingerprintPlan {
  const shortId = publicModulusHex.slice(0, 16) || `${keySize}-bit`;
  return {
    fingerprintHex: publicModulusHex,
    shortId,
    algorithm: `RSA-${keySize}`,
  };
}

/** Convert a Uint8Array to a hex string. Pure. */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Convert a hex string to Uint8Array. Pure. Returns empty array on invalid input. */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "").replace(/\s+/g, "");
  if (!/^[0-9a-fA-F]*$/.test(clean) || clean.length % 2 !== 0) return new Uint8Array();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Encode bytes as base64url (no padding). Pure. */
export function bytesToBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  const b64 = typeof btoa === "function" ? btoa(s) : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface EncryptJob {
  plaintext: string;
  keySize: KeySize;
  mode: PaddingMode;
}

export interface EncryptPlan {
  job: EncryptJob;
  plaintextBytes: number;
  maxBytes: number;
  fits: boolean;
  warnings: string[];
  notes: string[];
}

/** Plan an encryption operation — pure validation only. */
export function planEncrypt(job: EncryptJob): EncryptPlan {
  const warnings: string[] = [];
  const notes: string[] = [];
  const plaintextBytes = new TextEncoder().encode(job.plaintext).length;
  const maxBytes = maxPlaintextBytes(job.keySize, job.mode);
  const fits = plaintextBytes <= maxBytes;
  if (!fits) warnings.push(`Plaintext (${plaintextBytes} B) exceeds max for ${job.keySize}/${job.mode} (${maxBytes} B). Split input or use larger key.`);
  if (job.mode === "OAEP-SHA1") notes.push("SHA-1 OAEP is acceptable but SHA-256+ is recommended.");
  if (job.mode === "PKCS1-v1.5") notes.push("PKCS1-v1.5 is vulnerable to padding oracle attacks — prefer OAEP.");
  return { job, plaintextBytes, maxBytes, fits, warnings, notes };
}

export interface BatchResult {
  plans: EncryptPlan[];
  stats: {
    count: number; valid: number; invalid: number;
    totalPlaintextBytes: number;
  };
}

/** Plan a batch of encryption jobs. */
export function planBatch(jobs: EncryptJob[]): BatchResult {
  const plans = jobs.map(planEncrypt);
  const stats = {
    count: plans.length,
    valid: plans.filter((p) => p.fits).length,
    invalid: plans.filter((p) => !p.fits).length,
    totalPlaintextBytes: plans.reduce((s, p) => s + p.plaintextBytes, 0),
  };
  return { plans, stats };
}

/** Render a CSV from a batch plan. */
export function renderBatchCsv(batch: BatchResult): string {
  const lines = ["index,key_size,mode,plaintext_bytes,max_bytes,fits"];
  batch.plans.forEach((p, i) => {
    lines.push([String(i + 1), p.job.keySize, p.job.mode, p.plaintextBytes, p.maxBytes, p.fits].join(","));
  });
  return lines.join("\n");
}

/** Render a plain-text report for an encryption plan. */
export function renderReport(plan: EncryptPlan, sec: SecurityInfo): string {
  const lines: string[] = [];
  lines.push("RSA Encryption Plan Report");
  lines.push("=".repeat(40));
  lines.push(`Key size: ${sec.keySize}-bit (${sec.symmetricBits}-bit symmetric equiv.)`);
  lines.push(`Security level: ${sec.level}`);
  lines.push(`Mode: ${plan.job.mode}`);
  lines.push(`Plaintext: ${plan.plaintextBytes} B / max ${plan.maxBytes} B`);
  lines.push(`Fits: ${plan.fits ? "yes" : "no"}`);
  sec.notes.forEach((n) => lines.push(`  • ${n}`));
  if (plan.warnings.length) { lines.push(""); lines.push("Warnings:"); plan.warnings.forEach((w) => lines.push(`  ! ${w}`)); }
  if (plan.notes.length) { lines.push(""); lines.push("Notes:"); plan.notes.forEach((n) => lines.push(`  • ${n}`)); }
  return lines.join("\n");
}

export const PADDING_MODES: PaddingMode[] = [
  "OAEP-SHA256", "OAEP-SHA512", "OAEP-SHA384", "OAEP-SHA1", "PKCS1-v1.5",
];

export const KEY_SIZES: KeySize[] = [1024, 2048, 4096];

/** Build a comparison table for the supported key sizes. */
export function keySizeComparisonTable(): string {
  const lines = ["Key size,Symmetric bits,Level,Est. years"];
  for (const k of KEY_SIZES) {
    const s = securityInfoFor(k);
    lines.push([String(k), String(s.symmetricBits), s.level, String(s.estimateYears)].join(","));
  }
  return lines.join("\n");
}
