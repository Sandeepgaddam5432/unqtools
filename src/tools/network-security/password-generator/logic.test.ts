import { describe, it, expect } from "vitest";
import {
  generatePassword,
  validateOptions,
  buildPool,
  estimateStrength,
  secureRandomInt,
  generateMultiple,
  DEFAULT_OPTIONS,
  type PasswordOptions,
} from "./logic";

describe("password-generator validateOptions", () => {
  it("accepts valid default options", () => {
    expect(validateOptions(DEFAULT_OPTIONS)).toBeNull();
  });

  it("rejects length below 4", () => {
    expect(
      validateOptions({ ...DEFAULT_OPTIONS, length: 3 }),
    ).toMatch(/at least 4/);
  });

  it("rejects length above 256", () => {
    expect(
      validateOptions({ ...DEFAULT_OPTIONS, length: 257 }),
    ).toMatch(/cannot exceed 256/);
  });

  it("rejects when no character types enabled", () => {
    expect(
      validateOptions({
        ...DEFAULT_OPTIONS,
        lowercase: false,
        uppercase: false,
        numbers: false,
        symbols: false,
      }),
    ).toMatch(/At least one character type/i);
  });
});

describe("password-generator buildPool", () => {
  it("includes all char types by default", () => {
    const pool = buildPool(DEFAULT_OPTIONS);
    expect(pool).toMatch(/[a-z]/);
    expect(pool).toMatch(/[A-Z]/);
    expect(pool).toMatch(/[0-9]/);
    expect(pool).toMatch(/[!@#$%^&*]/);
  });

  it("excludes ambiguous chars when requested", () => {
    const pool = buildPool({ ...DEFAULT_OPTIONS, excludeAmbiguous: true });
    expect(pool).not.toContain("i");
    expect(pool).not.toContain("l");
    expect(pool).not.toContain("1");
    expect(pool).not.toContain("L");
    expect(pool).not.toContain("o");
    expect(pool).not.toContain("0");
    expect(pool).not.toContain("O");
  });

  it("respects individual toggles", () => {
    const pool = buildPool({
      ...DEFAULT_OPTIONS,
      uppercase: false,
      symbols: false,
    });
    expect(pool).not.toMatch(/[A-Z]/);
    expect(pool).not.toMatch(/[!@#$]/);
  });
});

describe("password-generator generatePassword", () => {
  it("generates a password of the requested length", () => {
    const opts: PasswordOptions = { ...DEFAULT_OPTIONS, length: 20 };
    const pwd = generatePassword(opts);
    expect(pwd.length).toBe(20);
  });

  it("only uses characters from the pool", () => {
    const opts: PasswordOptions = {
      ...DEFAULT_OPTIONS,
      lowercase: true,
      uppercase: false,
      numbers: false,
      symbols: false,
    };
    const pwd = generatePassword(opts);
    expect(pwd).toMatch(/^[a-z]+$/);
  });

  it("respects excludeAmbiguous", () => {
    const opts: PasswordOptions = {
      ...DEFAULT_OPTIONS,
      lowercase: true,
      uppercase: true,
      numbers: true,
      symbols: false,
      excludeAmbiguous: true,
    };
    // Generate 50 passwords and check none contain ambiguous chars
    for (let i = 0; i < 50; i++) {
      const pwd = generatePassword(opts);
      expect(pwd).not.toMatch(/[il1Lo0O]/);
    }
  });

  it("generates different passwords on subsequent calls (probabilistic)", () => {
    const passwords = new Set<string>();
    for (let i = 0; i < 20; i++) {
      passwords.add(generatePassword({ ...DEFAULT_OPTIONS, length: 32 }));
    }
    // With 32-char passwords, the chance of any collision is astronomically low
    expect(passwords.size).toBeGreaterThan(15);
  });

  it("throws on invalid options", () => {
    expect(() =>
      generatePassword({ ...DEFAULT_OPTIONS, length: 2 }),
    ).toThrow();
  });
});

describe("password-generator secureRandomInt", () => {
  it("returns values in [0, max)", () => {
    for (let i = 0; i < 100; i++) {
      const n = secureRandomInt(10);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(10);
    }
  });

  it("throws on max <= 0", () => {
    expect(() => secureRandomInt(0)).toThrow();
    expect(() => secureRandomInt(-1)).toThrow();
  });
});

describe("password-generator estimateStrength", () => {
  it("returns Weak for short passwords", () => {
    const opts: PasswordOptions = { ...DEFAULT_OPTIONS, length: 4 };
    const { label } = estimateStrength(generatePassword(opts), opts);
    expect(label).toBe("Weak");
  });

  it("returns Very Strong for long passwords", () => {
    const opts: PasswordOptions = { ...DEFAULT_OPTIONS, length: 32 };
    const { label, bits } = estimateStrength(generatePassword(opts), opts);
    expect(label).toBe("Very Strong");
    expect(bits).toBeGreaterThan(120);
  });

  it("increases bits with length", () => {
    const short = estimateStrength(generatePassword({ ...DEFAULT_OPTIONS, length: 8 }), DEFAULT_OPTIONS);
    const long = estimateStrength(generatePassword({ ...DEFAULT_OPTIONS, length: 32 }), DEFAULT_OPTIONS);
    expect(long.bits).toBeGreaterThan(short.bits);
  });
});

describe("password-generator generateMultiple", () => {
  it("generates the requested count", () => {
    const arr = generateMultiple(DEFAULT_OPTIONS, 5);
    expect(arr).toHaveLength(5);
  });

  it("throws on count < 1", () => {
    expect(() => generateMultiple(DEFAULT_OPTIONS, 0)).toThrow();
  });

  it("throws on count > 100", () => {
    expect(() => generateMultiple(DEFAULT_OPTIONS, 101)).toThrow();
  });

  it("generates distinct passwords", () => {
    const arr = generateMultiple({ ...DEFAULT_OPTIONS, length: 32 }, 10);
    expect(new Set(arr).size).toBe(10);
  });
});
