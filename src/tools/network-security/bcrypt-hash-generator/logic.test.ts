import { describe, it, expect, beforeEach } from "vitest";
import {
  validateCost,
  generateSalt,
  generateRandomSalt,
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

// ===== PBKDF2 + extras tests =====

import {
  hashPbkdf2,
  verifyPbkdf2,
  bytesToBase64,
  base64ToBytes,
  constantTimeEqual,
  rehashWithSalt,
  batchVerify,
  loadHashHistory,
  saveHashToHistory,
  clearHashHistory,
  estimateCrackTime,
  estimatePasswordStrength,
  compareHashes,
  hashesToCsv,
  detectHashFormat,
  recommendCost,
  buildHashShareUrl,
  extractHashFromFragment,
  ALGORITHM_REFERENCE,
} from "./logic";

describe("pbkdf2 hashPbkdf2 / verifyPbkdf2", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPbkdf2("test123", 1000);
    expect(hash).toMatch(/^pbkdf2-sha256\$1000\$/);
    expect(await verifyPbkdf2("test123", hash)).toBe(true);
    expect(await verifyPbkdf2("wrong", hash)).toBe(false);
  });
  it("throws on empty password", async () => {
    await expect(hashPbkdf2("")).rejects.toThrow(/empty/i);
  });
  it("produces different hashes for same password (random salt)", async () => {
    const h1 = await hashPbkdf2("same", 1000);
    const h2 = await hashPbkdf2("same", 1000);
    expect(h1).not.toBe(h2);
  });
});

describe("pbkdf2 bytesToBase64 / base64ToBytes", () => {
  it("round-trips bytes", () => {
    const original = new Uint8Array([0, 1, 2, 255, 128, 64]);
    const b64 = bytesToBase64(original);
    const decoded = base64ToBytes(b64);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });
});

describe("pbkdf2 constantTimeEqual", () => {
  it("returns true for equal strings", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
  });
  it("returns false for different strings", () => {
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "ab")).toBe(false);
  });
});

describe("pbkdf2 generateRandomSalt", () => {
  it("generates a base64 salt of correct length", () => {
    const salt = generateRandomSalt(16);
    const bytes = base64ToBytes(salt);
    expect(bytes.length).toBe(16);
  });
  it("throws on too-short length", () => {
    expect(() => generateRandomSalt(4)).toThrow();
  });
  it("generates unique salts", () => {
    const s1 = generateRandomSalt(16);
    const s2 = generateRandomSalt(16);
    expect(s1).not.toBe(s2);
  });
});

describe("pbkdf2 rehashWithSalt", () => {
  it("re-hashes a password with the same cost factor", () => {
    const original = hashPassword("test", 4);
    const rehashed = rehashWithSalt("newpassword", original);
    expect(rehashed).toMatch(/^\$2[abxy]\$04\$/);
    expect(verifyPassword("newpassword", rehashed)).toBe(true);
  });
});

describe("pbkdf2 batchVerify", () => {
  it("verifies one password against multiple hashes", async () => {
    const h1 = hashPassword("password1", 4);
    const h2 = hashPassword("password2", 4);
    const results = await batchVerify("password1", [h1, h2]);
    expect(results).toHaveLength(2);
    expect(results[0].matches).toBe(true);
    expect(results[1].matches).toBe(false);
  });
  it("handles mixed bcrypt + pbkdf2", async () => {
    const bcryptHash = hashPassword("test", 4);
    const pbkdf2Hash = await hashPbkdf2("test", 1000);
    const results = await batchVerify("test", [bcryptHash, pbkdf2Hash]);
    expect(results[0].matches).toBe(true);
    expect(results[1].matches).toBe(true);
  });
});

describe("pbkdf2 hash history", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    };
  });
  it("saves and loads", () => {
    saveHashToHistory("hash1", "bcrypt");
    const h = loadHashHistory();
    expect(h).toHaveLength(1);
    expect(h[0].hash).toBe("hash1");
  });
  it("deduplicates", () => {
    saveHashToHistory("hash1", "bcrypt");
    saveHashToHistory("hash1", "bcrypt");
    expect(loadHashHistory()).toHaveLength(1);
  });
  it("clears", () => {
    saveHashToHistory("hash1", "bcrypt");
    clearHashHistory();
    expect(loadHashHistory()).toEqual([]);
  });
});

describe("pbkdf2 estimateCrackTime", () => {
  it("returns a CrackTime object", () => {
    const ct = estimateCrackTime("bcrypt", 12);
    expect(ct.algorithm).toBe("bcrypt");
    expect(ct.guessesPerSecond).toBeGreaterThan(0);
    expect(ct.seconds).toBeGreaterThan(0);
    expect(ct.humanReadable).toBeTruthy();
  });
});

describe("pbkdf2 estimatePasswordStrength", () => {
  it("rates weak passwords as weak", () => {
    const s = estimatePasswordStrength("1234");
    expect(s.bits).toBeLessThan(40);
  });
  it("rates strong passwords as strong", () => {
    const s = estimatePasswordStrength("X7#kP9$mL2!qR4vN8wB");
    expect(s.bits).toBeGreaterThan(80);
  });
  it("returns Very Weak for empty", () => {
    const s = estimatePasswordStrength("");
    expect(s.label).toBe("Very Weak");
  });
});

describe("pbkdf2 compareHashes", () => {
  it("finds differences", () => {
    const h1 = hashPassword("test", 4);
    const h2 = hashPassword("test", 5);
    const diff = compareHashes(h1, h2);
    const costDiff = diff.find((d) => d.field === "cost");
    expect(costDiff?.same).toBe(false);
  });
});

describe("pbkdf2 hashesToCsv", () => {
  it("formats as CSV with header", () => {
    const csv = hashesToCsv(["hash1", "hash2"], "bcrypt");
    expect(csv).toContain("hash,algorithm,created_at");
    expect(csv).toContain("hash1");
  });
});

describe("pbkdf2 detectHashFormat", () => {
  it("detects bcrypt", () => {
    expect(detectHashFormat("$2b$12$abc")).toBe("bcrypt");
  });
  it("detects pbkdf2", () => {
    expect(detectHashFormat("pbkdf2-sha256$100000$salt$hash")).toBe("pbkdf2");
  });
  it("detects argon2", () => {
    expect(detectHashFormat("$argon2id$v=19$m=65536,t=3,p=1$")).toBe("argon2");
  });
  it("detects md5 (32 hex chars)", () => {
    expect(detectHashFormat("d41d8cd98f00b204e9800998ecf8427e")).toBe("md5");
  });
  it("detects sha256 (64 hex chars)", () => {
    expect(detectHashFormat("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")).toBe("sha256");
  });
  it("returns unknown for unrecognized", () => {
    expect(detectHashFormat("not a hash")).toBe("unknown");
  });
});

describe("pbkdf2 recommendCost", () => {
  it("returns a recommendation", async () => {
    const r = await recommendCost(250);
    expect(r.recommended).toBeGreaterThanOrEqual(4);
    expect(r.recommended).toBeLessThanOrEqual(31);
    expect(r.reason).toBeTruthy();
  });
});

describe("pbkdf2 buildHashShareUrl / extractHashFromFragment", () => {
  it("builds and extracts share URL", () => {
    const origWindow = globalThis.window;
    (globalThis as any).window = {
      location: { origin: "https://unqtools.pages.dev", pathname: "/tools/bcrypt-hash-generator", hash: "" },
    };
    const url = buildHashShareUrl("$2b$12$abc");
    expect(url).toContain("#hash=");
    (globalThis as any).window = { location: { hash: "#hash=%242b%2412%24abc" } };
    expect(extractHashFromFragment()).toBe("$2b$12$abc");
    (globalThis as any).window = origWindow;
  });
});

describe("pbkdf2 ALGORITHM_REFERENCE", () => {
  it("includes bcrypt, pbkdf2, argon2, scrypt", () => {
    const names = ALGORITHM_REFERENCE.map((a) => a.name);
    expect(names).toContain("bcrypt");
    expect(names).toContain("PBKDF2");
    expect(names).toContain("Argon2id");
    expect(names).toContain("scrypt");
  });
});
