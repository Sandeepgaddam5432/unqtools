import { describe, it, expect } from "vitest";
import {
  validateCost,
  generateSalt,
  hashPassword,
  hashPasswordWithSalt,
  verifyPassword,
  parseHash,
  MIN_COST,
  MAX_COST,
  DEFAULT_COST,
} from "./logic";

describe("bcrypt validateCost", () => {
  it("accepts valid cost factors", () => {
    for (let c = MIN_COST; c <= MAX_COST; c++) {
      expect(validateCost(c)).toBeNull();
    }
  });

  it("rejects out-of-range cost", () => {
    expect(validateCost(MIN_COST - 1)).toMatch(/at least/);
    expect(validateCost(MAX_COST + 1)).toMatch(/cannot exceed/);
  });

  it("rejects non-integers", () => {
    expect(validateCost(1.5)).toMatch(/integer/);
    expect(validateCost(NaN)).toMatch(/integer/);
  });
});

describe("bcrypt generateSalt", () => {
  it("generates a salt with default cost", () => {
    const salt = generateSalt();
    expect(salt).toMatch(new RegExp(`^\\$2[abxy]\\$${String(DEFAULT_COST).padStart(2, "0")}\\$[A-Za-z0-9./]{22}$`));
  });

  it("generates a salt with custom cost", () => {
    const salt = generateSalt(8);
    expect(salt).toMatch(/^\$2[abxy]\$08\$[A-Za-z0-9./]{22}$/);
  });

  it("generates unique salts", () => {
    const salts = new Set<string>();
    for (let i = 0; i < 10; i++) {
      salts.add(generateSalt(4));
    }
    // Salts should be unique (probability of collision is astronomically low)
    expect(salts.size).toBeGreaterThan(8);
  });

  it("throws on invalid cost", () => {
    expect(() => generateSalt(2)).toThrow();
    expect(() => generateSalt(33)).toThrow();
  });
});

describe("bcrypt hashPassword", () => {
  it("hashes a password with default cost", () => {
    const hash = hashPassword("hello123");
    expect(hash).toMatch(/^\$2[abxy]\$12\$[A-Za-z0-9./]{53}$/);
  });

  it("hashes a password with custom cost", () => {
    const hash = hashPassword("hello123", 4);
    expect(hash).toMatch(/^\$2[abxy]\$04\$[A-Za-z0-9./]{53}$/);
  });

  it("produces different hashes for the same password (random salt)", () => {
    const h1 = hashPassword("same-password", 4);
    const h2 = hashPassword("same-password", 4);
    expect(h1).not.toBe(h2);
  });

  it("throws on empty password", () => {
    expect(() => hashPassword("")).toThrow(/empty/);
  });

  it("throws on password longer than 72 bytes", () => {
    const longPwd = "a".repeat(73);
    expect(() => hashPassword(longPwd)).toThrow(/72 bytes/);
  });

  it("accepts a 72-byte password exactly", () => {
    const pwd72 = "a".repeat(72);
    const hash = hashPassword(pwd72, 4);
    expect(hash).toMatch(/^\$2[abxy]/);
  });
});

describe("bcrypt hashPasswordWithSalt", () => {
  it("hashes with explicit salt", () => {
    const salt = generateSalt(4);
    const h1 = hashPasswordWithSalt("password", salt);
    const h2 = hashPasswordWithSalt("password", salt);
    // Same salt → same hash (deterministic)
    expect(h1).toBe(h2);
  });

  it("throws on invalid salt", () => {
    expect(() => hashPasswordWithSalt("password", "not-a-salt")).toThrow(/salt/i);
  });
});

describe("bcrypt verifyPassword", () => {
  it("returns true for correct password", () => {
    const hash = hashPassword("correct-horse-battery-staple", 4);
    expect(verifyPassword("correct-horse-battery-staple", hash)).toBe(true);
  });

  it("returns false for wrong password", () => {
    const hash = hashPassword("correct-password", 4);
    expect(verifyPassword("wrong-password", hash)).toBe(false);
  });

  it("returns false for empty password against non-empty hash", () => {
    const hash = hashPassword("something", 4);
    expect(verifyPassword("", hash)).toBe(false);
  });

  it("throws on invalid hash format", () => {
    expect(() => verifyPassword("password", "not-a-hash")).toThrow(/hash/i);
  });

  it("verifies across different cost factors", () => {
    for (const cost of [4, 6, 8, 10]) {
      const hash = hashPassword(`test-${cost}`, cost);
      expect(verifyPassword(`test-${cost}`, hash)).toBe(true);
    }
  });
});

describe("bcrypt parseHash", () => {
  it("extracts metadata from a valid hash", () => {
    const hash = hashPassword("test", 10);
    const parsed = parseHash(hash);
    expect(parsed.cost).toBe(10);
    expect(parsed.salt).toHaveLength(22);
    expect(parsed.hash).toHaveLength(31);
    expect(parsed.version).toMatch(/^2[abxy]$/);
  });

  it("throws on invalid hash format", () => {
    expect(() => parseHash("invalid")).toThrow();
    expect(() => parseHash("$2b$12$short")).toThrow();
  });
});

describe("bcrypt integration: hash and verify round-trip", () => {
  it("hashes then verifies a password", () => {
    const pwd = "integration-test-123!";
    const hash = hashPassword(pwd, 4);
    expect(verifyPassword(pwd, hash)).toBe(true);
    expect(verifyPassword(`${pwd}-wrong`, hash)).toBe(false);
  });

  it("preserves cost factor through hash parsing", () => {
    for (const cost of [4, 6, 8]) {
      const hash = hashPassword("test", cost);
      expect(parseHash(hash).cost).toBe(cost);
    }
  });
});
