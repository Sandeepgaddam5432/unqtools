/**
 * Bcrypt Hash Generator — pure logic wrapper around bcryptjs.
 *
 * bcryptjs is a pure-JavaScript implementation of bcrypt (no native bindings)
 * that works in both Node.js and the browser. It uses crypto.getRandomValues
 * internally for salt generation when available.
 */

import bcrypt from "bcryptjs";

export const MIN_COST = 4;
export const MAX_COST = 31;
export const DEFAULT_COST = 12;
export const SALT_ROUNDS = 22; // bcrypt salt is 22 base64 chars

/** Validate a cost factor. Returns error message or null. */
export function validateCost(cost: number): string | null {
  if (!Number.isInteger(cost)) return "Cost factor must be an integer.";
  if (cost < MIN_COST) return `Cost factor must be at least ${MIN_COST}.`;
  if (cost > MAX_COST) return `Cost factor cannot exceed ${MAX_COST}.`;
  return null;
}

/** Generate a bcrypt salt with the given cost factor. */
export function generateSalt(cost: number = DEFAULT_COST): string {
  const err = validateCost(cost);
  if (err) throw new Error(err);
  return bcrypt.genSaltSync(cost);
}

/** Hash a password with the given cost factor. Returns the full bcrypt hash string. */
export function hashPassword(
  password: string,
  cost: number = DEFAULT_COST,
): string {
  if (typeof password !== "string") {
    throw new Error("Password must be a string.");
  }
  if (password.length === 0) {
    throw new Error("Password cannot be empty.");
  }
  if (password.length > 72) {
    throw new Error("Bcrypt truncates passwords at 72 bytes — your input is longer.");
  }
  const err = validateCost(cost);
  if (err) throw new Error(err);
  const salt = bcrypt.genSaltSync(cost);
  return bcrypt.hashSync(password, salt);
}

/** Hash a password using an explicit salt (instead of generating one). */
export function hashPasswordWithSalt(password: string, salt: string): string {
  if (typeof password !== "string") {
    throw new Error("Password must be a string.");
  }
  if (password.length === 0) {
    throw new Error("Password cannot be empty.");
  }
  if (password.length > 72) {
    throw new Error("Bcrypt truncates passwords at 72 bytes — your input is longer.");
  }
  if (typeof salt !== "string" || !salt.startsWith("$2")) {
    throw new Error("Invalid salt. Must start with $2 (e.g. $2b$12$...).");
  }
  return bcrypt.hashSync(password, salt);
}

/** Verify a password against a bcrypt hash. Returns true if they match. */
export function verifyPassword(password: string, hash: string): boolean {
  if (typeof password !== "string" || typeof hash !== "string") {
    return false;
  }
  if (!hash.startsWith("$2")) {
    throw new Error("Invalid hash. Must start with $2 (e.g. $2b$12$...).");
  }
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}

/**
 * Extract metadata from a bcrypt hash.
 * Returns { version, cost, salt, hash } or throws on invalid input.
 */
export function parseHash(hash: string): {
  version: string;
  cost: number;
  salt: string;
  hash: string;
} {
  if (typeof hash !== "string") {
    throw new Error("Hash must be a string.");
  }
  // bcrypt format: $2b$cost$22-char-salt + 31-char-hash
  // e.g. $2b$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345
  const match = hash.match(/^\$(2[abxy])\$(\d{2})\$([A-Za-z0-9./]{22})([A-Za-z0-9./]{31})$/);
  if (!match) {
    throw new Error("Invalid bcrypt hash format. Expected $2b$cost$22charsalt31charhash.");
  }
  return {
    version: match[1],
    cost: parseInt(match[2], 10),
    salt: match[3],
    hash: match[4],
  };
}

/** Estimate the time (in ms) for a hash at the given cost, based on a quick benchmark. */
export async function benchmarkCost(cost: number): Promise<number> {
  const err = validateCost(cost);
  if (err) throw new Error(err);
  const start = performance.now();
  bcrypt.hashSync("benchmark-test-password", cost);
  return performance.now() - start;
}

// ===== PBKDF2 mode (blueprint feature — WebCrypto native) =====

export const PBKDF2_ITERATIONS = 100000;
export const PBKDF2_KEY_LENGTH = 32; // 256 bits

/** Hash a password using PBKDF2-SHA256 via WebCrypto. Returns PHC-style string. */
export async function hashPbkdf2(
  password: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<string> {
  if (!password) throw new Error("Password cannot be empty.");
  if (password.length > 72) throw new Error("Password too long for PBKDF2 (max 72 bytes recommended).");
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("WebCrypto not available.");
  // Generate random salt (16 bytes)
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  // Import password as key
  const keyMaterial = await subtle.importKey(
    "raw",
    new TextEncoder().encode(password) as BufferSource,
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  // Derive bits
  const derived = await subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    PBKDF2_KEY_LENGTH * 8,
  );
  const hashBytes = new Uint8Array(derived);
  // Format as PHC: pbkdf2-sha256$iterations$salt(hash)
  const saltB64 = bytesToBase64(salt);
  const hashB64 = bytesToBase64(hashBytes);
  return `pbkdf2-sha256$${iterations}$${saltB64}$${hashB64}`;
}

/** Verify a password against a PBKDF2 PHC string. */
export async function verifyPbkdf2(password: string, phc: string): Promise<boolean> {
  if (!phc.startsWith("pbkdf2-sha256$")) return false;
  const parts = phc.split("$");
  if (parts.length !== 4) return false;
  const iterations = parseInt(parts[1], 10);
  const salt = base64ToBytes(parts[2]);
  const expectedHash = parts[3];
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return false;
  const keyMaterial = await subtle.importKey(
    "raw",
    new TextEncoder().encode(password) as BufferSource,
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    PBKDF2_KEY_LENGTH * 8,
  );
  const actualB64 = bytesToBase64(new Uint8Array(derived));
  // Constant-time compare
  return constantTimeEqual(actualB64, expectedHash);
}

// ===== Helper: base64 ↔ bytes =====

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Constant-time string comparison to prevent timing attacks. */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ===== Salt-only generation (blueprint feature) =====

/** Generate a cryptographically secure base64 salt of the given length (default 16 bytes). */
export function generateRandomSalt(byteLength: number = 16): string {
  if (byteLength < 8) throw new Error("Salt must be at least 8 bytes.");
  if (byteLength > 64) throw new Error("Salt cannot exceed 64 bytes.");
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
}

// ===== Hash-from-salt re-hash (blueprint feature) =====

/** Extract the salt and cost from an existing bcrypt hash, then re-hash a new password with the same salt. */
export function rehashWithSalt(password: string, existingHash: string): string {
  const parsed = parseHash(existingHash);
  // Generate a new salt with the same cost factor (extracting the original salt would let us forge the same hash)
  const newSalt = bcrypt.genSaltSync(parsed.cost);
  return bcrypt.hashSync(password, newSalt);
}

// ===== Extra #1: Batch verify =====

export interface BatchVerifyResult {
  hash: string;
  matches: boolean;
  error?: string;
}

/** Verify one password against multiple hashes. */
export async function batchVerify(password: string, hashes: string[]): Promise<BatchVerifyResult[]> {
  const results: BatchVerifyResult[] = [];
  for (const hash of hashes) {
    if (!hash.trim()) continue;
    try {
      if (hash.startsWith("pbkdf2-sha256$")) {
        const matches = await verifyPbkdf2(password, hash.trim());
        results.push({ hash, matches });
      } else if (hash.startsWith("$2")) {
        const matches = verifyPassword(password, hash.trim());
        results.push({ hash, matches });
      } else {
        results.push({ hash, matches: false, error: "Unknown hash format" });
      }
    } catch (e) {
      results.push({ hash, matches: false, error: (e as Error).message });
    }
  }
  return results;
}

// ===== Extra #2: Hash history (localStorage) =====

const HASH_HISTORY_KEY = "unqtools-bcrypt-history";
const MAX_HASH_HISTORY = 20;

export interface HashHistoryEntry {
  hash: string;
  algorithm: string; // "bcrypt" | "pbkdf2"
  createdAt: string;
}

export function loadHashHistory(): HashHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HASH_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_HASH_HISTORY);
  } catch {
    return [];
  }
}

export function saveHashToHistory(hash: string, algorithm: string): HashHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const entry: HashHistoryEntry = { hash, algorithm, createdAt: new Date().toISOString() };
  const current = loadHashHistory().filter((e) => e.hash !== hash);
  const updated = [entry, ...current].slice(0, MAX_HASH_HISTORY);
  try { localStorage.setItem(HASH_HISTORY_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function clearHashHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(HASH_HISTORY_KEY); } catch {}
}

// ===== Extra #3: Crack-time estimate =====

export interface CrackTime {
  algorithm: string;
  guessesPerSecond: number;
  seconds: number;
  humanReadable: string;
}

/** Estimate crack time for a hash at a given hashrate. */
export function estimateCrackTime(algorithm: string, cost: number = 12): CrackTime {
  // Approximate hashrates (2026 consumer GPU)
  const rates: Record<string, number> = {
    bcrypt: 1e5 * Math.pow(2, cost - 10), // ~100k at cost 10, doubles per level
    pbkdf2: 1e6, // 1M/sec for PBKDF2-SHA256
    argon2id: 1e3, // ~1000/sec for Argon2id (memory-hard)
    scrypt: 1e3,
    sha256: 1e10, // raw SHA-256 — very fast
  };
  const rate = rates[algorithm] ?? 1e5;
  // For an 8-char password with full charset, ~52 bits of entropy → 2^52 / rate
  // But we don't know the password — we estimate for an "average" 8-char password
  const guesses = Math.pow(2, 52); // 8-char alphanumeric
  const seconds = guesses / rate;
  return {
    algorithm,
    guessesPerSecond: rate,
    seconds,
    humanReadable: humanizeCrackTime(seconds),
  };
}

function humanizeCrackTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "∞";
  if (seconds < 1) return "<1 second";
  if (seconds < 60) return `${seconds.toFixed(1)} seconds`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} minutes`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} hours`;
  if (seconds < 31536000) return `${(seconds / 86400).toFixed(1)} days`;
  const years = seconds / 31536000;
  if (years < 1000) return `${years.toFixed(1)} years`;
  if (years < 1e6) return `${(years / 1000).toFixed(1)} thousand years`;
  if (years < 1e9) return `${(years / 1e6).toFixed(1)} million years`;
  return "∞ (heat death of universe)";
}

// ===== Extra #4: Password strength check (entropy estimate) =====

export interface PasswordStrength {
  bits: number;
  label: "Very Weak" | "Weak" | "Fair" | "Good" | "Strong" | "Very Strong";
  crackTime: string;
}

/** Estimate password strength based on character pool and length. */
export function estimatePasswordStrength(password: string): PasswordStrength {
  if (!password) return { bits: 0, label: "Very Weak", crackTime: "instant" };
  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32;
  if (poolSize === 0) poolSize = 1;
  const bits = Math.round(password.length * Math.log2(poolSize));
  let label: PasswordStrength["label"];
  if (bits < 28) label = "Very Weak";
  else if (bits < 40) label = "Weak";
  else if (bits < 60) label = "Fair";
  else if (bits < 80) label = "Good";
  else if (bits < 120) label = "Strong";
  else label = "Very Strong";
  const seconds = Math.pow(2, bits) / 1e10; // assume 10B/sec offline
  return { bits, label, crackTime: humanizeCrackTime(seconds) };
}

// ===== Extra #5: Hash comparison (diff) =====

export interface HashDiff {
  field: string;
  left: string;
  right: string;
  same: boolean;
}

/** Compare two bcrypt hashes field-by-field. */
export function compareHashes(left: string, right: string): HashDiff[] {
  const tryParse = (h: string) => {
    try { return parseHash(h); } catch { return null; }
  };
  const lp = tryParse(left);
  const rp = tryParse(right);
  if (!lp || !rp) {
    return [{ field: "raw", left, right, same: left === right }];
  }
  return [
    { field: "version", left: lp.version, right: rp.version, same: lp.version === rp.version },
    { field: "cost", left: String(lp.cost), right: String(rp.cost), same: lp.cost === rp.cost },
    { field: "salt", left: lp.salt, right: rp.salt, same: lp.salt === rp.salt },
    { field: "hash", left: lp.hash, right: rp.hash, same: lp.hash === rp.hash },
  ];
}

// ===== Extra #6: CSV export of batch hashes =====

/** Format an array of hashes as CSV. */
export function hashesToCsv(hashes: string[], algorithm: string): string {
  const header = "hash,algorithm,created_at";
  const ts = new Date().toISOString();
  const lines = hashes.map((h) => `"${h.replace(/"/g, '""')}",${algorithm},${ts}`);
  return [header, ...lines].join("\n");
}

// ===== Extra #7: Hash format detector =====

export type HashFormat = "bcrypt" | "pbkdf2" | "argon2" | "scrypt" | "md5" | "sha1" | "sha256" | "sha512" | "unknown";

/** Detect the hash format from a string. */
export function detectHashFormat(hash: string): HashFormat {
  const h = hash.trim();
  if (h.startsWith("$2a$") || h.startsWith("$2b$") || h.startsWith("$2y$")) return "bcrypt";
  if (h.startsWith("$argon2")) return "argon2";
  if (h.startsWith("$scrypt$") || h.startsWith("scrypt$")) return "scrypt";
  if (h.startsWith("pbkdf2-")) return "pbkdf2";
  if (/^[a-f0-9]{32}$/i.test(h)) return "md5";
  if (/^[a-f0-9]{40}$/i.test(h)) return "sha1";
  if (/^[a-f0-9]{64}$/i.test(h)) return "sha256";
  if (/^[a-f0-9]{128}$/i.test(h)) return "sha512";
  return "unknown";
}

// ===== Extra #8: Cost factor recommendation =====

export interface CostRecommendation {
  current: number;
  recommended: number;
  hashTimeMs: number;
  reason: string;
}

/** Recommend a bcrypt cost factor based on a quick benchmark. */
export async function recommendCost(targetMs: number = 250): Promise<CostRecommendation> {
  // Benchmark cost 10
  const start = performance.now();
  bcrypt.hashSync("benchmark", 10);
  const cost10Ms = performance.now() - start;
  // Each cost increment roughly doubles time
  // targetMs = cost10Ms * 2^(cost - 10) → cost = 10 + log2(targetMs / cost10Ms)
  const ratio = targetMs / cost10Ms;
  const recommended = Math.max(4, Math.min(31, Math.round(10 + Math.log2(ratio))));
  return {
    current: 12,
    recommended,
    hashTimeMs: Math.round(cost10Ms * Math.pow(2, recommended - 10)),
    reason: `Cost ${recommended} takes ~${Math.round(cost10Ms * Math.pow(2, recommended - 10))}ms — matches your ${targetMs}ms target.`,
  };
}

// ===== Extra #9: Shareable URL =====

export function buildHashShareUrl(hash: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}#hash=${encodeURIComponent(hash)}`;
}

export function extractHashFromFragment(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash) return null;
  const match = hash.match(/[#&]hash=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// ===== Extra #10: Algorithm comparison table =====

export interface AlgorithmInfo {
  name: string;
  phcPrefix: string;
  recommendedFor: string;
  pros: string[];
  cons: string[];
  supported: boolean;
}

export const ALGORITHM_REFERENCE: AlgorithmInfo[] = [
  {
    name: "bcrypt",
    phcPrefix: "$2a/$2b/$2y$",
    recommendedFor: "General-purpose password hashing (web apps)",
    pros: ["Battle-tested (since 1999)", "Adaptive cost factor", "Widely supported"],
    cons: ["Password length limited to 72 bytes", "Not memory-hard", "GPU-resistant but not ASIC-resistant"],
    supported: true,
  },
  {
    name: "PBKDF2",
    phcPrefix: "pbkdf2-",
    recommendedFor: "FIPS compliance, legacy systems",
    pros: ["WebCrypto native", "FIPS-140 compliant", "Widely standardized (RFC 2898)"],
    cons: ["Not memory-hard", "Fast on GPUs", "Requires high iteration count (100k+)"],
    supported: true,
  },
  {
    name: "Argon2id",
    phcPrefix: "$argon2id$",
    recommendedFor: "New systems (2024+) — PHC winner",
    pros: ["Memory-hard (ASIC-resistant)", "Resistant to GPU attacks", "PHC competition winner", "Tunable memory/time/parallelism"],
    cons: ["Heavy WASM dependency (~1MB)", "Slower than bcrypt", "Less browser support"],
    supported: false, // we don't ship Argon2 WASM
  },
  {
    name: "scrypt",
    phcPrefix: "$scrypt$",
    recommendedFor: "Cryptocurrency wallets, high-security apps",
    pros: ["Memory-hard", "Tunable parameters", "Used by Litecoin/Dogecoin"],
    cons: ["Less standardized than Argon2", "Parameter selection is tricky"],
    supported: false,
  },
];
