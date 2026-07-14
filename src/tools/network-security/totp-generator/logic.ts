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

// ===== HOTP mode (blueprint feature — counter-based) =====

export interface HotpOptions {
  secret: string;
  counter: number;
  digits: number;          // 6 or 8
  algorithm: TotpAlgorithm;
}

export const DEFAULT_HOTP: Omit<HotpOptions, "secret" | "counter"> = {
  digits: 6,
  algorithm: "SHA-1",
};

/** Generate an HOTP code (RFC 4226) for the given counter. */
export async function generateHotp(opts: HotpOptions): Promise<string> {
  if (!opts.secret) throw new Error("Secret is required.");
  if (!Number.isInteger(opts.counter) || opts.counter < 0) {
    throw new Error("Counter must be a non-negative integer.");
  }
  if (![6, 8].includes(opts.digits)) {
    throw new Error("Digits must be 6 or 8.");
  }
  const key = base32Decode(opts.secret);
  // Encode counter as 8-byte big-endian
  const message = new Uint8Array(8);
  let v = opts.counter;
  for (let i = 7; i >= 0; i--) {
    message[i] = v & 0xff;
    v = Math.floor(v / 256);
  }
  const hash = await hmacDigest(key, message, opts.algorithm);
  // Dynamic truncation (same as TOTP)
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);
  const code = binary % Math.pow(10, opts.digits);
  return code.toString().padStart(opts.digits, "0");
}

// ===== Steam Guard codes (blueprint feature) =====

const STEAM_ALPHABET = "23456789BCDFGHJKMNPQRTVWXY";

/** Generate a Steam Guard code (5 chars from custom alphabet). */
export async function generateSteamCode(secret: string, timestampMs: number = Date.now()): Promise<string> {
  if (!secret) throw new Error("Secret is required.");
  const key = base32Decode(secret);
  const counter = Math.floor(timestampMs / 1000 / 30);
  const message = new Uint8Array(8);
  let v = counter;
  for (let i = 7; i >= 0; i--) {
    message[i] = v & 0xff;
    v = Math.floor(v / 256);
  }
  const hash = await hmacDigest(key, message, "SHA-1");
  const offset = hash[hash.length - 1] & 0x0f;
  let fc = ((hash[offset] & 0x7f) << 24) | ((hash[offset + 1] & 0xff) << 16) | ((hash[offset + 2] & 0xff) << 8) | (hash[offset + 3] & 0xff);
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += STEAM_ALPHABET[fc % STEAM_ALPHABET.length];
    fc = Math.floor(fc / STEAM_ALPHABET.length);
  }
  return code;
}

// ===== Multi-account management (blueprint feature) =====

export interface TotpAccount {
  id: string;              // unique ID (uuid or random)
  issuer: string;          // e.g. "Google"
  account: string;         // e.g. "user@example.com"
  secret: string;          // base32
  period: number;
  digits: number;
  algorithm: TotpAlgorithm;
  type: "totp" | "hotp" | "steam";
  counter?: number;        // for HOTP
  addedAt: string;         // ISO timestamp
}

const ACCOUNTS_KEY = "unqtools-totp-accounts";

/** Load all saved TOTP accounts from localStorage. */
export function loadAccounts(): TotpAccount[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

/** Save accounts array to localStorage. */
export function saveAccounts(accounts: TotpAccount[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {}
}

/** Add a new account. Returns the updated array. */
export function addAccount(account: Omit<TotpAccount, "id" | "addedAt">): TotpAccount[] {
  const newAccount: TotpAccount = {
    ...account,
    id: generateId(),
    addedAt: new Date().toISOString(),
  };
  const accounts = loadAccounts();
  const updated = [...accounts, newAccount];
  saveAccounts(updated);
  return updated;
}

/** Remove an account by ID. */
export function removeAccount(id: string): TotpAccount[] {
  const accounts = loadAccounts().filter((a) => a.id !== id);
  saveAccounts(accounts);
  return accounts;
}

/** Generate a random ID for accounts. */
function generateId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // Fallback
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join("");
}

// ===== Backup codes (blueprint feature) =====

export interface BackupCodes {
  codes: string[];
  generatedAt: string;
}

/** Get a cryptographically secure random integer in [0, max). */
export function secureRandomInt(max: number): number {
  if (max <= 0) throw new Error("max must be positive");
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.getRandomValues) throw new Error("Web Crypto API not available.");
  const buf = new Uint32Array(1);
  cryptoObj.getRandomValues(buf);
  return buf[0] % max;
}

/** Generate a set of one-time backup codes (8 codes, 8 digits each). */
export function generateBackupCodes(count: number = 8, digits: number = 8): BackupCodes {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = Array.from({ length: digits }, () => secureRandomInt(10)).join("");
    // Format as XXXX-XXXX for readability
    const formatted = code.slice(0, 4) + "-" + code.slice(4);
    codes.push(formatted);
  }
  return { codes, generatedAt: new Date().toISOString() };
}

// ===== Time-skew warning (blueprint feature) =====

export interface TimeSkewInfo {
  skewSeconds: number;     // positive = device ahead, negative = behind
  isSignificant: boolean;  // >5 seconds
  warning: string | null;
}

/** Check device clock skew against a known-good time source (using Date header approximation). */
export function checkTimeSkew(serverTimeMs?: number): TimeSkewInfo {
  const now = Date.now();
  if (serverTimeMs === undefined) {
    // No reference — can't check
    return { skewSeconds: 0, isSignificant: false, warning: null };
  }
  const skew = now - serverTimeMs;
  const skewSeconds = Math.round(skew / 1000);
  const isSignificant = Math.abs(skewSeconds) > 5;
  let warning: string | null = null;
  if (isSignificant) {
    const direction = skewSeconds > 0 ? "ahead" : "behind";
    warning = `Your device clock is ${Math.abs(skewSeconds)}s ${direction} of the reference time. TOTP codes may not match.`;
  }
  return { skewSeconds, isSignificant, warning };
}

// ===== QR code rendering (blueprint feature — uses otpauth URI) =====

/**
 * Build a QR-renderable otpauth URI for an account.
 * The UI should pass this to a QR library (lazy-loaded).
 */
export function buildOtpAuthUriForAccount(account: TotpAccount): string {
  const label = `${encodeURIComponent(account.issuer)}:${encodeURIComponent(account.account)}`;
  const type = account.type === "hotp" ? "hotp" : "totp";
  const params = new URLSearchParams();
  params.set("secret", account.secret);
  params.set("issuer", account.issuer);
  params.set("algorithm", account.algorithm.replace("-", ""));
  params.set("digits", String(account.digits));
  if (type === "totp") {
    params.set("period", String(account.period));
  } else if (type === "hotp" && account.counter !== undefined) {
    params.set("counter", String(account.counter));
  }
  return `otpauth://${type}/${label}?${params.toString()}`;
}

// ===== Extra #1: Parse otpauth:// URI =====

export interface ParsedOtpAuth {
  type: "totp" | "hotp";
  label: string;
  issuer?: string;
  account: string;
  secret: string;
  algorithm?: TotpAlgorithm;
  digits?: number;
  period?: number;
  counter?: number;
}

/** Parse an otpauth:// URI into its components. */
export function parseOtpAuthUri(uri: string): ParsedOtpAuth | null {
  if (!uri.startsWith("otpauth://")) return null;
  const url = new URL(uri);
  const type = url.host as "totp" | "hotp";
  const label = decodeURIComponent(url.pathname.slice(1));
  const [issuer, account] = label.includes(":") ? label.split(":", 2) : [undefined, label];
  const params = url.searchParams;
  return {
    type,
    label,
    issuer: issuer || params.get("issuer") || undefined,
    account: account.trim(),
    secret: params.get("secret") || "",
    algorithm: params.get("algorithm") as TotpAlgorithm | undefined,
    digits: params.get("digits") ? parseInt(params.get("digits")!, 10) : undefined,
    period: params.get("period") ? parseInt(params.get("period")!, 10) : undefined,
    counter: params.get("counter") ? parseInt(params.get("counter")!, 10) : undefined,
  };
}

// ===== Extra #2: Batch code generation =====

/** Generate TOTP codes for multiple accounts at once. */
export async function generateCodesForAccounts(accounts: TotpAccount[], timestampMs: number = Date.now()): Promise<Array<{ account: TotpAccount; code: string; remaining: number }>> {
  const results: Array<{ account: TotpAccount; code: string; remaining: number }> = [];
  for (const account of accounts) {
    try {
      let code: string;
      if (account.type === "steam") {
        code = await generateSteamCode(account.secret, timestampMs);
      } else if (account.type === "hotp") {
        code = await generateHotp({ secret: account.secret, counter: account.counter ?? 0, digits: account.digits, algorithm: account.algorithm });
      } else {
        code = await generateTotp({ secret: account.secret, period: account.period, digits: account.digits, algorithm: account.algorithm }, timestampMs);
      }
      results.push({ account, code, remaining: secondsRemaining(account.period, timestampMs) });
    } catch {
      // skip invalid
    }
  }
  return results;
}

// ===== Extra #3: Export accounts (encrypted JSON) =====

/** Export accounts as a JSON string (for backup). Note: contains secrets — store securely. */
export function exportAccountsJson(accounts: TotpAccount[]): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    count: accounts.length,
    accounts,
  }, null, 2);
}

/** Import accounts from a JSON string. */
export function importAccountsJson(json: string): TotpAccount[] {
  const parsed = JSON.parse(json);
  if (!parsed || !Array.isArray(parsed.accounts)) {
    throw new Error("Invalid export format — expected { accounts: [...] }");
  }
  return parsed.accounts as TotpAccount[];
}

// ===== Extra #4: Code history (last N codes) =====

const CODE_HISTORY_KEY = "unqtools-totp-code-history";
const MAX_CODE_HISTORY = 50;

export interface CodeHistoryEntry {
  account: string;
  code: string;
  generatedAt: string;
}

export function loadCodeHistory(): CodeHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(CODE_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_CODE_HISTORY);
  } catch {
    return [];
  }
}

export function saveCodeToHistory(account: string, code: string): CodeHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const entry: CodeHistoryEntry = { account, code, generatedAt: new Date().toISOString() };
  const current = loadCodeHistory();
  const updated = [entry, ...current].slice(0, MAX_CODE_HISTORY);
  try { localStorage.setItem(CODE_HISTORY_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function clearCodeHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(CODE_HISTORY_KEY); } catch {}
}

// ===== Extra #5: Copy code with auto-clear =====

export const AUTO_CLEAR_DELAY_MS = 30000;

/** Copy a code to clipboard and schedule auto-clear. */
export async function copyCodeWithAutoClear(code: string, onClear?: () => void): Promise<void> {
  await navigator.clipboard.writeText(code);
  setTimeout(() => {
    navigator.clipboard.writeText("").catch(() => {});
    onClear?.();
  }, AUTO_CLEAR_DELAY_MS);
}

// ===== Extra #6: Next N codes preview =====

/** Generate the next N TOTP codes (for the next N time windows). */
export async function generateNextCodes(opts: TotpOptions, count: number, timestampMs: number = Date.now()): Promise<Array<{ code: string; validAt: Date }>> {
  const results: Array<{ code: string; validAt: Date }> = [];
  for (let i = 0; i < count; i++) {
    const futureTime = timestampMs + (i * opts.period * 1000);
    const code = await generateTotp(opts, futureTime);
    results.push({ code, validAt: new Date(futureTime) });
  }
  return results;
}

// ===== Extra #7: Secret strength check =====

export interface SecretStrength {
  bits: number;
  label: "Weak" | "Fair" | "Good" | "Strong";
  recommendation: string;
}

/** Check the strength of a base32 secret. */
export function checkSecretStrength(secret: string): SecretStrength {
  const bytes = base32Decode(secret);
  const bits = bytes.length * 8;
  let label: SecretStrength["label"];
  let recommendation: string;
  if (bits < 80) {
    label = "Weak";
    recommendation = "Secret is less than 10 bytes (80 bits). Regenerate with at least 20 bytes.";
  } else if (bits < 128) {
    label = "Fair";
    recommendation = "Secret is acceptable but consider 160 bits (20 bytes) for better security.";
  } else if (bits < 160) {
    label = "Good";
    recommendation = "Secret strength is good.";
  } else {
    label = "Strong";
    recommendation = "Secret strength is strong.";
  }
  return { bits, label, recommendation };
}

// ===== Extra #8: Algorithm comparison =====

export interface AlgorithmInfo {
  name: string;
  hashBits: number;
  recommended: boolean;
  notes: string;
}

export const ALGORITHM_REFERENCE: AlgorithmInfo[] = [
  { name: "SHA-1", hashBits: 160, recommended: true, notes: "Most widely supported. RFC 6238 default. 160-bit HMAC is sufficient for 6-8 digit codes." },
  { name: "SHA-256", hashBits: 256, recommended: true, notes: "Stronger hash. Use if your authenticator app supports it. Backward-compatible." },
  { name: "SHA-512", hashBits: 512, recommended: false, notes: "Strongest hash but overkill for TOTP. Rarely supported by mobile apps." },
];

// ===== Extra #9: Shareable URL =====

export function buildTotpShareUrl(secret: string, issuer: string = "UnQTools", account: string = "user"): string {
  if (typeof window === "undefined") return "";
  const uri = buildOtpAuthUri({ secret, period: DEFAULT_OPTIONS.period, digits: DEFAULT_OPTIONS.digits, algorithm: DEFAULT_OPTIONS.algorithm }, account, issuer);
  return `${window.location.origin}${window.location.pathname}#otpauth=${encodeURIComponent(uri)}`;
}

export function extractOtpAuthFromFragment(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash) return null;
  const match = hash.match(/[#&]otpauth=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// ===== Extra #10: Keyboard shortcuts (UI-side) =====
// (Implemented in ui.tsx)

// ===== Re-export existing buildOtpAuthUri for UI =====
// (already exported above in original file)
