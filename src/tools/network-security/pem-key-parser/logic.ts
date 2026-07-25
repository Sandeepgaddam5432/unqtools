/**
 * PEM Key Parser — pure logic.
 * Detects PEM block type, decodes base64 body, and reports basic metadata.
 * Does NOT validate cryptographic correctness — header detection only.
 */

export type PemType = "rsa-private" | "rsa-public" | "ec-private" | "ec-public" | "private-key" | "public-key" | "certificate" | "csr" | "unknown";

export interface PemInfo {
  type: PemType;
  label: string;
  algorithm: "RSA" | "EC" | "X.509" | "PKCS#8" | "Unknown";
  base64Length: number;
  derByteLength: number;
  fingerprint: string; // SHA-256 of DER bytes, hex
  headers: Record<string, string>;
  isValid: boolean;
  error?: string;
}

const PEM_PATTERNS: Array<{ type: PemType; algorithm: PemInfo["algorithm"]; regex: RegExp; label: string }> = [
  { type: "rsa-private", algorithm: "RSA", label: "RSA Private Key", regex: /-----BEGIN RSA PRIVATE KEY-----/ },
  { type: "rsa-public", algorithm: "RSA", label: "RSA Public Key", regex: /-----BEGIN RSA PUBLIC KEY-----/ },
  { type: "ec-private", algorithm: "EC", label: "EC Private Key", regex: /-----BEGIN EC PRIVATE KEY-----/ },
  { type: "ec-public", algorithm: "EC", label: "EC Public Key", regex: /-----BEGIN EC PUBLIC KEY-----/ },
  { type: "private-key", algorithm: "PKCS#8", label: "PKCS#8 Private Key", regex: /-----BEGIN PRIVATE KEY-----/ },
  { type: "public-key", algorithm: "PKCS#8", label: "PKCS#8 Public Key", regex: /-----BEGIN PUBLIC KEY-----/ },
  { type: "certificate", algorithm: "X.509", label: "X.509 Certificate", regex: /-----BEGIN CERTIFICATE-----/ },
  { type: "csr", algorithm: "X.509", label: "Certificate Signing Request", regex: /-----BEGIN CERTIFICATE REQUEST-----/ },
];

/** Strip PEM armor and return the base64 body, plus any headers. */
export function extractPemBody(input: string): {
  body: string;
  headers: Record<string, string>;
  startLabel: string;
  endLabel: string;
} | null {
  const m = input.match(/-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/);
  if (!m) return null;
  const label = m[1].trim();
  const inner = m[2];
  const headers: Record<string, string> = {};
  const headerMatch = inner.match(/^([\s\S]*?)\n([A-Za-z0-9+/=\s]+)$/);
  let body = inner;
  if (headerMatch) {
    const headerBlock = headerMatch[1];
    body = headerMatch[2];
    for (const line of headerBlock.split(/\r?\n/)) {
      const lm = line.match(/^([A-Za-z0-9-]+):\s*(.*)$/);
      if (lm) headers[lm[1]] = lm[2];
    }
  }
  return {
    body: body.replace(/\s+/g, ""),
    headers,
    startLabel: `BEGIN ${label}`,
    endLabel: `END ${label}`,
  };
}

/** Decode base64 to Uint8Array (browser-safe, no Buffer). Long inputs (typical
 *  of real PEM bodies) tolerate missing trailing padding by auto-padding to a
 *  multiple of 4; short malformed tokens are rejected. */
export function base64ToBytes(b64: string): Uint8Array | null {
  if (!b64) return null;
  try {
    let clean = b64.replace(/[^A-Za-z0-9+/=]/g, "");
    if (clean.length === 0) return null;
    // Padding chars must not appear in the middle of the content.
    if (clean.replace(/=+$/, "").includes("=")) return null;
    if (clean.length % 4 !== 0) {
      // Only auto-pad when this looks like a real PEM body (long enough to
      // be more than a stray token). Short malformed inputs are rejected.
      if (clean.length < 32) return null;
      const pad = (4 - (clean.length % 4)) % 4;
      clean += "=".repeat(pad);
    }
    if (typeof globalThis !== "undefined" && typeof globalThis.atob === "function") {
      const bin = globalThis.atob(clean);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return null;
  } catch {
    return null;
  }
}

/** Compute SHA-256 hex fingerprint. Returns "" when crypto not available. */
export async function sha256Fingerprint(bytes: Uint8Array): Promise<string> {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.subtle) {
    const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join(":");
  }
  return "";
}

/** Detect PEM type from text. Pure. */
export function detectPemType(input: string): PemType {
  for (const p of PEM_PATTERNS) {
    if (p.regex.test(input)) return p.type;
  }
  return "unknown";
}

/** Get the human-readable label for a PEM type. */
export function getLabelForType(type: PemType): string {
  const found = PEM_PATTERNS.find((p) => p.type === type);
  return found?.label ?? "Unknown";
}

/** Parse a PEM string into structured info (without fingerprint for sync callers). */
export function parsePemSync(input: string): PemInfo {
  const trimmed = (input || "").trim();
  if (!trimmed) {
    return { type: "unknown", label: "", algorithm: "Unknown", base64Length: 0, derByteLength: 0, fingerprint: "", headers: {}, isValid: false, error: "Empty input." };
  }
  const type = detectPemType(trimmed);
  if (type === "unknown") {
    return { type, label: "Unknown", algorithm: "Unknown", base64Length: 0, derByteLength: 0, fingerprint: "", headers: {}, isValid: false, error: "No recognized PEM block found." };
  }
  const body = extractPemBody(trimmed);
  if (!body) {
    return { type, label: getLabelForType(type), algorithm: algorithmForType(type), base64Length: 0, derByteLength: 0, fingerprint: "", headers: {}, isValid: false, error: "Malformed PEM block." };
  }
  const bytes = base64ToBytes(body.body);
  if (!bytes) {
    return { type, label: getLabelForType(type), algorithm: algorithmForType(type), base64Length: body.body.length, derByteLength: 0, fingerprint: "", headers: body.headers, isValid: false, error: "Invalid base64 body." };
  }
  const label = getLabelForType(type);
  return {
    type,
    label,
    algorithm: algorithmForType(type),
    base64Length: body.body.length,
    derByteLength: bytes.length,
    fingerprint: "",
    headers: body.headers,
    isValid: true,
  };
}

function algorithmForType(type: PemType): PemInfo["algorithm"] {
  const found = PEM_PATTERNS.find((p) => p.type === type);
  return found?.algorithm ?? "Unknown";
}

/** Async parse including fingerprint. */
export async function parsePem(input: string): Promise<PemInfo> {
  const info = parsePemSync(input);
  if (!info.isValid) return info;
  const body = extractPemBody(input);
  const bytes = body ? base64ToBytes(body.body) : null;
  if (bytes) {
    info.fingerprint = await sha256Fingerprint(bytes);
  }
  return info;
}
