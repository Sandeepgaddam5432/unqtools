/**
 * Password Generator — pure logic.
 *
 * Uses the browser's crypto.getRandomValues API (CSPRNG). All functions are
 * pure and side-effect-free, so they're trivially testable. The randomness
 * source is cryptographically secure — never Math.random().
 */

export interface PasswordOptions {
  length: number;
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;
}

export const DEFAULT_OPTIONS: PasswordOptions = {
  length: 16,
  lowercase: true,
  uppercase: true,
  numbers: true,
  symbols: true,
  excludeAmbiguous: false,
};

/** Character pools. */
const POOLS = {
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  numbers: "0123456789",
  symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?",
};

/** Characters that look similar (excluded when excludeAmbiguous is true). */
const AMBIGUOUS = new Set("il1Lo0O");

/** Get a cryptographically secure random integer in [0, max). */
export function secureRandomInt(max: number): number {
  if (max <= 0) throw new Error("max must be positive");
  if (max > 2 ** 32) throw new Error("max too large");
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.getRandomValues) {
    throw new Error("Web Crypto API not available in this environment.");
  }
  // Rejection sampling to eliminate modulo bias
  const maxUint32 = 0xffffffff;
  const limit = maxUint32 - (maxUint32 % max);
  const buf = new Uint32Array(1);
  let x: number;
  do {
    cryptoObj.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return x % max;
}

/** Build the character pool based on options. */
export function buildPool(opts: PasswordOptions): string {
  let pool = "";
  if (opts.lowercase) pool += POOLS.lowercase;
  if (opts.uppercase) pool += POOLS.uppercase;
  if (opts.numbers) pool += POOLS.numbers;
  if (opts.symbols) pool += POOLS.symbols;
  if (opts.excludeAmbiguous) {
    pool = Array.from(pool)
      .filter((c) => !AMBIGUOUS.has(c))
      .join("");
  }
  return pool;
}

/** Validate options — returns error message or null if valid. */
export function validateOptions(opts: PasswordOptions): string | null {
  if (opts.length < 4) return "Password must be at least 4 characters long.";
  if (opts.length > 256) return "Password cannot exceed 256 characters.";
  if (!opts.lowercase && !opts.uppercase && !opts.numbers && !opts.symbols) {
    return "At least one character type must be enabled.";
  }
  return null;
}

/** Generate a password using the given options. */
export function generatePassword(opts: PasswordOptions): string {
  const err = validateOptions(opts);
  if (err) throw new Error(err);
  const pool = buildPool(opts);
  if (pool.length === 0) {
    throw new Error("Character pool is empty — enable at least one character type.");
  }
  const chars: string[] = [];
  for (let i = 0; i < opts.length; i++) {
    const idx = secureRandomInt(pool.length);
    chars.push(pool[idx]);
  }
  return chars.join("");
}

/**
 * Estimate password strength in bits of entropy.
 * Returns { bits, label } where label is one of:
 * "Weak" | "Fair" | "Good" | "Strong" | "Very Strong".
 */
export function estimateStrength(
  password: string,
  opts: PasswordOptions,
): { bits: number; label: string } {
  const poolSize = buildPool(opts).length;
  const bits = Math.round(password.length * Math.log2(Math.max(poolSize, 2)));
  let label: string;
  if (bits < 40) label = "Weak";
  else if (bits < 60) label = "Fair";
  else if (bits < 80) label = "Good";
  else if (bits < 120) label = "Strong";
  else label = "Very Strong";
  return { bits, label };
}

/** Generate multiple passwords at once (for batch generation). */
export function generateMultiple(
  opts: PasswordOptions,
  count: number,
): string[] {
  if (count < 1) throw new Error("Count must be at least 1.");
  if (count > 100) throw new Error("Count cannot exceed 100.");
  return Array.from({ length: count }, () => generatePassword(opts));
}
