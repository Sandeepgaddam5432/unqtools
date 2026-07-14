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
