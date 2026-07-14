/**
 * TOTP Generator — RFC 6238 Time-based One-Time Passwords.
 *
 * Uses Web Crypto (HMAC-SHA1/SHA256/SHA512) for the HMAC step. All functions
 * are pure and testable. The clock is injected as a parameter so tests are
 * deterministic.
 */

export type TotpAlgorithm = "SHA-1" | "SHA-256" | "SHA-512";

export interface TotpOptions {
  secret: string;          // base32-encoded secret (no spaces)
  period: number;          // seconds (default 30)
  digits: number;          // 6 or 8 (default 6)
  algorithm: TotpAlgorithm; // default SHA-1
}

export const DEFAULT_OPTIONS: Omit<TotpOptions, "secret"> = {
  period: 30,
  digits: 6,
  algorithm: "SHA-1",
};

/** RFC 4648 base32 alphabet (no padding). */
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Decode a base32 string to a Uint8Array. Throws on invalid input. */
export function base32Decode(input: string): Uint8Array {
  if (typeof input !== "string") throw new Error("Secret must be a string.");
  // Strip whitespace, pad chars, and uppercase
  const clean = input.replace(/[\s=]/g, "").toUpperCase();
  if (clean.length === 0) throw new Error("Secret is empty.");

  // Validate
  for (const c of clean) {
    if (!BASE32_ALPHABET.includes(c)) {
      throw new Error(`Invalid base32 character: "${c}".`);
    }
  }

  // Pad to multiple of 8
  const padded = clean + "=".repeat((8 - (clean.length % 8)) % 8);

  const bytes: number[] = [];
  let buffer = 0;
  let bitsLeft = 0;
  for (const c of padded) {
    if (c === "=") break;
    const value = BASE32_ALPHABET.indexOf(c);
    buffer = (buffer << 5) | value;
    bitsLeft += 5;
    if (bitsLeft >= 8) {
      bitsLeft -= 8;
      bytes.push((buffer >> bitsLeft) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

/** Encode a Uint8Array as base32 (no padding). */
export function base32Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return output;
}

/** Generate a random base32 secret of the given byte length (default 20). */
export function generateRandomSecret(byteLength: number = 20): string {
  if (byteLength < 10) throw new Error("Secret length must be at least 10 bytes.");
  if (byteLength > 128) throw new Error("Secret length cannot exceed 128 bytes.");
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.getRandomValues) {
    throw new Error("Web Crypto API not available.");
  }
  const bytes = new Uint8Array(byteLength);
  cryptoObj.getRandomValues(bytes);
  return base32Encode(bytes);
}

/** Validate TOTP options. Returns error message or null. */
export function validateOptions(opts: TotpOptions): string | null {
  if (!opts.secret) return "Secret is required.";
  if (!Number.isInteger(opts.period) || opts.period < 1 || opts.period > 600) {
    return "Period must be an integer between 1 and 600 seconds.";
  }
  if (![6, 8].includes(opts.digits)) {
    return "Digits must be 6 or 8.";
  }
  if (!["SHA-1", "SHA-256", "SHA-512"].includes(opts.algorithm)) {
    return "Algorithm must be SHA-1, SHA-256, or SHA-512.";
  }
  return null;
}

/**
 * Compute the HMAC of a message using Web Crypto.
 * Returns the digest as a Uint8Array.
 */
export async function hmacDigest(
  key: Uint8Array,
  message: Uint8Array,
  algorithm: TotpAlgorithm,
): Promise<Uint8Array> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto API not available.");
  const cryptoKey = await subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: { name: algorithm } },
    false,
    ["sign"],
  );
  const sig = await subtle.sign("HMAC", cryptoKey, message as BufferSource);
  return new Uint8Array(sig);
}

/**
 * Generate a TOTP code for the given timestamp.
 * @param opts - TOTP options
 * @param timestampMs - current time in milliseconds (default: Date.now())
 */
export async function generateTotp(
  opts: TotpOptions,
  timestampMs: number = Date.now(),
): Promise<string> {
  const err = validateOptions(opts);
  if (err) throw new Error(err);

  // Decode secret
  const key = base32Decode(opts.secret);

  // Compute counter (RFC 6238: counter = floor(time / period))
  const counter = Math.floor(timestampMs / 1000 / opts.period);
  // Encode counter as 8-byte big-endian
  const message = new Uint8Array(8);
  let v = counter;
  for (let i = 7; i >= 0; i--) {
    message[i] = v & 0xff;
    v = Math.floor(v / 256);
  }

  // HMAC
  const hash = await hmacDigest(key, message, opts.algorithm);

  // Dynamic truncation (RFC 4226)
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  // Modulo 10^digits
  const code = binary % Math.pow(10, opts.digits);
  return code.toString().padStart(opts.digits, "0");
}

/** Time remaining (in seconds) until the next TOTP code refreshes. */
export function secondsRemaining(period: number, timestampMs: number = Date.now()): number {
  return period - (Math.floor(timestampMs / 1000) % period);
}

/** Build an otpauth:// URI for QR code generation. */
export function buildOtpAuthUri(
  opts: TotpOptions,
  account: string = "user@example.com",
  issuer: string = "UnQTools",
): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    secret: opts.secret,
    issuer,
    algorithm: opts.algorithm.replace("-", ""),
    digits: String(opts.digits),
    period: String(opts.period),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Known-answer test vector from RFC 6238 appendix B. */
export const RFC6238_TEST_VECTORS = [
  { time: 59, expected: "94287082", algorithm: "SHA-1" as TotpAlgorithm, secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" },
  { time: 1111111109, expected: "07081804", algorithm: "SHA-1" as TotpAlgorithm, secret: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" },
];
