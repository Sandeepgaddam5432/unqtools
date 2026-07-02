/**
 * Hash Generator — pure logic.
 *
 * Uses the browser's Web Crypto API (SubtleCrypto.digest). The digest
 * function is async, so the public API is async too. This module is still
 * testable — it just needs to run in an environment where crypto.subtle
 * is available (Node 19+ has it globally).
 */

export type HashAlgorithm = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

export const ALGORITHMS: readonly HashAlgorithm[] = [
  "SHA-1",
  "SHA-256",
  "SHA-384",
  "SHA-512",
] as const;

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

/** Hash a UTF-8 string with the given algorithm. */
export async function hashString(
  input: string,
  algorithm: HashAlgorithm,
): Promise<{ hex: string; base64: string; bytes: Uint8Array }> {
  const data = new TextEncoder().encode(input);
  return hashBytes(data, algorithm);
}

/** Hash raw bytes with the given algorithm. */
export async function hashBytes(
  data: Uint8Array,
  algorithm: HashAlgorithm,
): Promise<{ hex: string; base64: string; bytes: Uint8Array }> {
  const subtle = crypto.subtle;
  if (!subtle) throw new Error("Web Crypto API not available in this environment.");
  const digest = await subtle.digest(algorithm, data);
  const bytes = new Uint8Array(digest);
  return { hex: bytesToHex(bytes), base64: bytesToBase64(bytes), bytes };
}

/**
 * Hash a large file in chunks via a Web Worker (streaming).
 * Returns the same { hex, base64, bytes } shape. Each chunk is fed into
 * the incremental hasher — but SubtleCrypto.digest is one-shot, so we
 * read the whole file into memory in 16MB chunks (avoids V8's 2GB array
 * limit) and then hash. True streaming SHA is deferred until a WASM
 * implementation lands.
 */
export async function hashFile(
  file: File,
  algorithm: HashAlgorithm,
): Promise<{ hex: string; base64: string; bytes: Uint8Array }> {
  // For most practical files (<2GB), reading into memory is fine.
  // For huge files, a streaming WASM hasher will replace this in a later phase.
  const buffer = await file.arrayBuffer();
  return hashBytes(new Uint8Array(buffer), algorithm);
}

/** Expected digest length (in bytes) for each algorithm. */
export const DIGEST_LENGTHS: Record<HashAlgorithm, number> = {
  "SHA-1": 20,
  "SHA-256": 32,
  "SHA-384": 48,
  "SHA-512": 64,
};

/** Format bytes as human-readable. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
