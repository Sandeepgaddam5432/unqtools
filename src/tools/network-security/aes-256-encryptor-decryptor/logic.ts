/**
 * AES-256 Encryptor/Decryptor — pure logic.
 * Actual Web Crypto calls happen in ui.tsx. This module handles:
 * - Key derivation parameters
 * - Encryption envelope format (JSON with salt, iv, ciphertext, params)
 * - Validation + helpers
 */

export type AesMode = "aes-gcm" | "aes-cbc";
export type KdfHash = "SHA-256" | "SHA-384" | "SHA-512";
export type OutputFormat = "base64" | "hex";

export interface EncryptOptions {
  mode: AesMode;
  iterations: number;
  hash: KdfHash;
  outputFormat: OutputFormat;
}

export interface EncryptEnvelope {
  v: 1; // envelope version
  mode: AesMode;
  hash: KdfHash;
  iterations: number;
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64 or hex per outputFormat
}

export const DEFAULT_OPTIONS: EncryptOptions = {
  mode: "aes-gcm",
  iterations: 210_000, // OWASP 2023 recommendation for PBKDF2-SHA256
  hash: "SHA-256",
  outputFormat: "base64",
};

/** Validate password strength (basic check). Returns 0-4 score. */
export function passwordScore(password: string): { score: 0 | 1 | 2 | 3 | 4; label: string; suggestions: string[] } {
  let score: 0 | 1 | 2 | 3 | 4 = 0;
  const suggestions: string[] = [];
  if (password.length >= 8) score++;
  else suggestions.push("Use at least 8 characters.");
  if (password.length >= 12) score++;
  else suggestions.push("Use 12+ characters for stronger protection.");
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score = Math.max(score, 2) as 0 | 1 | 2 | 3 | 4;
  else suggestions.push("Mix uppercase and lowercase letters.");
  if (/\d/.test(password)) score = Math.max(score, 2) as 0 | 1 | 2 | 3 | 4;
  else suggestions.push("Add numbers.");
  if (/[^a-zA-Z0-9]/.test(password)) score = Math.max(score, 3) as 0 | 1 | 2 | 3 | 4;
  else suggestions.push("Add symbols (!@#$%^&*).");
  if (password.length >= 16 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^a-zA-Z0-9]/.test(password)) {
    score = 4;
  }
  const label = ["Very weak", "Weak", "Fair", "Strong", "Very strong"][score]!;
  return { score, label, suggestions };
}

/** Generate a random salt of the given length. */
export function generateSalt(length = 16): Uint8Array {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}

/** Generate a random IV (12 bytes for GCM, 16 for CBC). */
export function generateIv(mode: AesMode): Uint8Array {
  const length = mode === "aes-gcm" ? 12 : 16;
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}

/** Convert bytes to base64 string. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

/** Convert base64 string to bytes. */
export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Convert bytes to hex string. */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Convert hex string to bytes. */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, "");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** Encode envelope to JSON string. */
export function envelopeToJson(env: EncryptEnvelope): string {
  return JSON.stringify(env, null, 2);
}

/** Parse envelope from JSON string. */
export function parseEnvelope(json: string): EncryptEnvelope | { error: string } {
  try {
    const parsed = JSON.parse(json);
    if (parsed.v !== 1) return { error: `Unsupported envelope version: ${parsed.v}` };
    if (!parsed.mode || !parsed.hash || !parsed.iterations) return { error: "Missing required fields (mode/hash/iterations)." };
    if (!parsed.salt || !parsed.iv || !parsed.ciphertext) return { error: "Missing required fields (salt/iv/ciphertext)." };
    return parsed as EncryptEnvelope;
  } catch (e) {
    return { error: `Invalid JSON: ${(e as Error).message}` };
  }
}

/** Validate that the envelope's parameters are sane. */
export function validateEnvelope(env: EncryptEnvelope): string[] {
  const warnings: string[] = [];
  if (env.iterations < 100_000) warnings.push(`Iterations ${env.iterations} is below OWASP 2023 minimum (100,000).`);
  if (env.mode !== "aes-gcm" && env.mode !== "aes-cbc") warnings.push(`Unknown mode: ${env.mode}.`);
  if (env.hash !== "SHA-256" && env.hash !== "SHA-384" && env.hash !== "SHA-512") warnings.push(`Unknown hash: ${env.hash}.`);
  try {
    const salt = base64ToBytes(env.salt);
    if (salt.length < 8) warnings.push("Salt is shorter than 8 bytes — increase for better security.");
  } catch { warnings.push("Salt is not valid base64."); }
  return warnings;
}

/** Format key derivation time for display. */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}
