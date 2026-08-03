/**
 * AES Encrypt/Decrypt — pure logic using WebCrypto API.
 * Supports AES-GCM and AES-CBC modes with PBKDF2 key derivation.
 * 100% client-side, no network required.
 */

export type CipherMode = "AES-GCM" | "AES-CBC";
export type KeySize = 128 | 192 | 256;
export type OutputFormat = "base64" | "hex";

export interface EncryptOptions {
  mode: CipherMode;
  keySize: KeySize;
  password: string;
  iterations: number;
  outputFormat: OutputFormat;
}

export interface DecryptOptions {
  mode: CipherMode;
  keySize: KeySize;
  password: string;
  iterations: number;
  inputFormat: OutputFormat;
}

export interface EncryptResult {
  ok: true;
  ciphertext: string;
  salt: string;
  iv: string;
  fullOutput: string; // salt:iv:ciphertext combined for easy sharing
}

export interface DecryptResult {
  ok: true;
  plaintext: string;
}

export type ToolError = { ok: false; error: string };

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuf(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes.buffer;
}

function serialize(format: OutputFormat, buf: ArrayBuffer): string {
  return format === "hex" ? bufToHex(buf) : bufToBase64(buf);
}

function deserialize(format: OutputFormat, str: string): ArrayBuffer {
  return format === "hex" ? hexToBuf(str) : base64ToBuf(str);
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  keySize: KeySize,
  iterations: number,
  mode: CipherMode,
  usage: "encrypt" | "decrypt",
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    { name: mode, length: keySize },
    false,
    [usage],
  );
}

export async function encryptText(plaintext: string, options: EncryptOptions): Promise<EncryptResult | ToolError> {
  if (!plaintext) return { ok: false, error: "Plaintext is empty" };
  if (!options.password) return { ok: false, error: "Password is required" };
  if (options.iterations < 1) return { ok: false, error: "Iterations must be at least 1" };

  try {
    const enc = new TextEncoder();
    const data = enc.encode(plaintext);

    // Random salt (16 bytes) and IV
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const ivLength = options.mode === "AES-GCM" ? 12 : 16;
    const iv = crypto.getRandomValues(new Uint8Array(ivLength));

    const key = await deriveKey(options.password, salt, options.keySize, options.iterations, options.mode, "encrypt");
    const ciphertext = await crypto.subtle.encrypt(
      { name: options.mode, iv },
      key,
      data,
    );

    // Combine: salt + iv + ciphertext for a single portable output
    const saltBuf = salt.buffer;
    const ivBuf = iv.buffer;
    const ctArr = new Uint8Array(ciphertext);
    const combined = new Uint8Array(salt.byteLength + iv.byteLength + ctArr.byteLength);
    combined.set(new Uint8Array(saltBuf), 0);
    combined.set(new Uint8Array(ivBuf), salt.byteLength);
    combined.set(ctArr, salt.byteLength + iv.byteLength);

    const fullOutput = serialize(options.outputFormat, combined.buffer);

    return {
      ok: true,
      ciphertext: serialize(options.outputFormat, ciphertext),
      salt: serialize(options.outputFormat, saltBuf),
      iv: serialize(options.outputFormat, ivBuf),
      fullOutput,
    };
  } catch (e) {
    return { ok: false, error: `Encryption failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

export async function decryptText(fullInput: string, options: DecryptOptions): Promise<DecryptResult | ToolError> {
  if (!fullInput) return { ok: false, error: "Ciphertext is empty" };
  if (!options.password) return { ok: false, error: "Password is required" };
  if (options.iterations < 1) return { ok: false, error: "Iterations must be at least 1" };

  try {
    const combined = new Uint8Array(deserialize(options.inputFormat, fullInput));

    const ivLength = options.mode === "AES-GCM" ? 12 : 16;
    const expectedMinLength = 16 + ivLength + (options.mode === "AES-GCM" ? 16 : 0); // salt + iv + tag/block

    if (combined.byteLength < expectedMinLength) {
      return { ok: false, error: "Input data is too short to contain valid encrypted content" };
    }

    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 16 + ivLength);
    const ciphertext = combined.slice(16 + ivLength);

    const key = await deriveKey(options.password, salt, options.keySize, options.iterations, options.mode, "decrypt");
    const plaintext = await crypto.subtle.decrypt(
      { name: options.mode, iv },
      key,
      ciphertext,
    );

    const dec = new TextDecoder();
    return { ok: true, plaintext: dec.decode(plaintext) };
  } catch (e) {
    return { ok: false, error: `Decryption failed: wrong password or corrupted data` };
  }
}

/** Generate a random password */
export function generatePassword(length: number = 24, includeSymbols: boolean = true): string {
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  let charset = lower + upper + digits;
  if (includeSymbols) charset += symbols;
  const arr = crypto.getRandomValues(new Uint8Array(length));
  let result = "";
  for (let i = 0; i < length; i++) {
    result += charset[arr[i] % charset.length];
  }
  return result;
}

/** Estimate password strength */
export function estimateStrength(password: string): { score: number; label: string } {
  if (!password) return { score: 0, label: "None" };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 2;
  if (password.length >= 20) score += 1;

  if (score <= 2) return { score, label: "Weak" };
  if (score <= 4) return { score, label: "Fair" };
  if (score <= 6) return { score, label: "Good" };
  return { score, label: "Strong" };
}

/** Get stats about the operation */
export function getStats(input: string, output: string) {
  const inputBytes = new TextEncoder().encode(input).length;
  const outputBytes = new TextEncoder().encode(output).length;
  return {
    inputSize: inputBytes,
    outputSize: outputBytes,
    ratio: inputBytes > 0 ? outputBytes / inputBytes : 0,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
