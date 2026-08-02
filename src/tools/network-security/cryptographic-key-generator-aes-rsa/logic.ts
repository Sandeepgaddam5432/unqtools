/**
 * Cryptographic Key Generator (AES/RSA/ECDSA) — pure logic.
 * Uses WebCrypto for key generation.
 */

export type KeyType = "aes" | "rsa" | "ecdsa";
export type ExportFormat = "raw" | "jwk" | "pem";

export interface KeyResult {
  type: KeyType;
  algorithm: string;
  publicKey?: string;
  privateKey?: string;
  raw?: string;
  fingerprint: string;
}

export async function generateAESKey(size: 128 | 192 | 256): Promise<KeyResult> {
  if (!crypto?.subtle) throw new Error("WebCrypto not available");
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: size }, true, ["encrypt", "decrypt"]);
  const raw = await crypto.subtle.exportKey("raw", key);
  const rawBytes = new Uint8Array(raw);
  const rawHex = Array.from(rawBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  const fingerprint = await sha256(rawBytes);
  return { type: "aes", algorithm: `AES-${size}`, raw: rawHex, fingerprint };
}

export async function generateRSAKey(size: 2048 | 3072 | 4096): Promise<KeyResult> {
  if (!crypto?.subtle) throw new Error("WebCrypto not available");
  const keyPair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: size, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true, ["sign", "verify"]
  );
  const pubJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const pubBytes = new TextEncoder().encode(JSON.stringify(pubJwk));
  const fingerprint = await sha256(pubBytes);
  return {
    type: "rsa",
    algorithm: `RSA-${size}`,
    publicKey: JSON.stringify(pubJwk, null, 2),
    privateKey: JSON.stringify(privJwk, null, 2),
    fingerprint,
  };
}

export async function generateECDSAKey(curve: "P-256" | "P-384" | "P-521"): Promise<KeyResult> {
  if (!crypto?.subtle) throw new Error("WebCrypto not available");
  const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: curve }, true, ["sign", "verify"]);
  const pubJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const pubBytes = new TextEncoder().encode(JSON.stringify(pubJwk));
  const fingerprint = await sha256(pubBytes);
  return {
    type: "ecdsa",
    algorithm: `ECDSA-${curve}`,
    publicKey: JSON.stringify(pubJwk, null, 2),
    privateKey: JSON.stringify(privJwk, null, 2),
    fingerprint,
  };
}

async function sha256(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function validateOptions(type: KeyType, size: number, curve?: string): string[] {
  const errors: string[] = [];
  if (type === "aes" && ![128, 192, 256].includes(size)) errors.push("AES key size must be 128, 192, or 256");
  if (type === "rsa" && ![2048, 3072, 4096].includes(size)) errors.push("RSA key size must be 2048, 3072, or 4096");
  if (type === "ecdsa" && !["P-256", "P-384", "P-521"].includes(curve || "")) errors.push("ECDSA curve must be P-256, P-384, or P-521");
  return errors;
}

export function getKeyTypes(): { value: KeyType; label: string; description: string }[] {
  return [
    { value: "aes", label: "AES", description: "Symmetric encryption (128/192/256-bit)" },
    { value: "rsa", label: "RSA", description: "Asymmetric encryption (2048/3072/4096-bit)" },
    { value: "ecdsa", label: "ECDSA", description: "Elliptic Curve (P-256/P-384/P-521)" },
  ];
}

export function jwkToPem(jwk: object, isPublic: boolean): string {
  const json = JSON.stringify(jwk);
  const b64 = btoa(json);
  const lines = b64.match(/.{1,64}/g) || [];
  const header = isPublic ? "PUBLIC KEY" : "PRIVATE KEY";
  return `-----BEGIN ${header}-----\n${lines.join("\n")}\n-----END ${header}-----`;
}

// ============================================================================
// Backward-compat stub exports (added to satisfy UI template imports).
// ============================================================================

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
    const result = generateAESKey(input);
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
