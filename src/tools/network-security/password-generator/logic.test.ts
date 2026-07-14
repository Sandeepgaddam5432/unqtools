import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  // Random mode
  generateRandom,
  validateRandom,
  buildPool,
  DEFAULT_RANDOM,
  type RandomOptions,
  // Passphrase
  generatePassphrase,
  validatePassphrase,
  DEFAULT_PASSPHRASE,
  // Pronounceable
  generatePronounceable,
  validatePronounceable,
  DEFAULT_PRONOUNCEABLE,
  // PIN
  generatePin,
  validatePin,
  DEFAULT_PIN,
  // WiFi
  generateWifi,
  validateWifi,
  DEFAULT_WIFI,
  // Diceware
  generateDiceware,
  dicewareFromRolls,
  validateDiceware,
  DEFAULT_DICEWARE,
  // Dispatcher
  generate,
  type PasswordOptions,
  // Entropy
  estimateRandomEntropy,
  estimateStrength,
  humanizeTime,
  // Pattern detection
  detectPatterns,
  // Batch + export
  generateBatch,
  toCsv,
  toJson,
  // Preset encode/decode
  encodePreset,
  decodePreset,
  // History
  loadHistory,
  saveToHistory,
  clearHistory,
  // CSPRNG
  secureRandomInt,
  rollDie,
  rollDice,
  // Backward-compat shims
  generatePassword,
  generateMultiple,
  // EFF wordlist helpers
  EFF_WORD_COUNT,
  ENTROPY_PER_WORD,
} from "./logic";

// ===== CSPRNG =====

describe("secureRandomInt", () => {
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

describe("rollDie", () => {
  it("returns 1-6", () => {
    for (let i = 0; i < 100; i++) {
      const r = rollDie();
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(6);
    }
  });
});

describe("rollDice", () => {
  it("returns array of correct length", () => {
    expect(rollDice(4)).toHaveLength(4);
    expect(rollDice(10)).toHaveLength(10);
  });
  it("throws on out-of-range count", () => {
    expect(() => rollDice(0)).toThrow();
    expect(() => rollDice(101)).toThrow();
  });
});

// ===== Pool construction =====

describe("buildPool", () => {
  it("includes all char types by default", () => {
    const pool = buildPool(DEFAULT_RANDOM);
    expect(pool).toMatch(/[a-z]/);
    expect(pool).toMatch(/[A-Z]/);
    expect(pool).toMatch(/[0-9]/);
    expect(pool).toMatch(/[!@#$%^&*]/);
  });
  it("excludes ambiguous chars when requested", () => {
    const pool = buildPool({ ...DEFAULT_RANDOM, excludeAmbiguous: true });
    expect(pool).not.toContain("i");
    expect(pool).not.toContain("l");
    expect(pool).not.toContain("1");
    expect(pool).not.toContain("L");
    expect(pool).not.toContain("o");
    expect(pool).not.toContain("0");
    expect(pool).not.toContain("O");
  });
});

// ===== Random validation =====

describe("validateRandom", () => {
  it("accepts valid options", () => {
    expect(validateRandom(DEFAULT_RANDOM)).toBeNull();
  });
  it("rejects length < 4", () => {
    expect(validateRandom({ ...DEFAULT_RANDOM, length: 3 })).toMatch(/at least 4/);
  });
  it("rejects length > 256", () => {
    expect(validateRandom({ ...DEFAULT_RANDOM, length: 257 })).toMatch(/256/);
  });
  it("rejects no character types", () => {
    const o: RandomOptions = { ...DEFAULT_RANDOM, lowercase: false, uppercase: false, numbers: false, symbols: false };
    expect(validateRandom(o)).toMatch(/at least one/i);
  });
  it("rejects per-class min sum > length", () => {
    expect(validateRandom({ ...DEFAULT_RANDOM, length: 8, minLower: 3, minUpper: 3, minNumbers: 3 })).toMatch(/exceeds/i);
  });
  it("rejects minLower without lowercase enabled", () => {
    expect(validateRandom({ ...DEFAULT_RANDOM, lowercase: false, minLower: 2 })).toMatch(/minLower/i);
  });
});

// ===== Random generation =====

describe("generateRandom", () => {
  it("generates password of requested length", () => {
    expect(generateRandom({ ...DEFAULT_RANDOM, length: 20 })).toHaveLength(20);
  });
  it("respects character pool", () => {
    const pwd = generateRandom({
      ...DEFAULT_RANDOM,
      uppercase: false, numbers: false, symbols: false,
    });
    expect(pwd).toMatch(/^[a-z]+$/);
  });
  it("respects excludeAmbiguous", () => {
    for (let i = 0; i < 20; i++) {
      const pwd = generateRandom({
        ...DEFAULT_RANDOM,
        lowercase: true, uppercase: true, numbers: true, symbols: false,
        excludeAmbiguous: true,
      });
      expect(pwd).not.toMatch(/[il1Lo0O]/);
    }
  });
  it("enforces per-class minimums", () => {
    const pwd = generateRandom({
      ...DEFAULT_RANDOM,
      length: 16,
      minLower: 3, minUpper: 3, minNumbers: 2, minSymbols: 2,
    });
    // Count chars in each class
    const lower = (pwd.match(/[a-z]/g) ?? []).length;
    const upper = (pwd.match(/[A-Z]/g) ?? []).length;
    const nums = (pwd.match(/[0-9]/g) ?? []).length;
    const syms = (pwd.match(/[^a-zA-Z0-9]/g) ?? []).length;
    expect(lower).toBeGreaterThanOrEqual(3);
    expect(upper).toBeGreaterThanOrEqual(3);
    expect(nums).toBeGreaterThanOrEqual(2);
    expect(syms).toBeGreaterThanOrEqual(2);
  });
  it("produces distinct passwords (probabilistic)", () => {
    const set = new Set<string>();
    for (let i = 0; i < 30; i++) {
      set.add(generateRandom({ ...DEFAULT_RANDOM, length: 32 }));
    }
    expect(set.size).toBeGreaterThan(20);
  });
  it("throws on invalid options", () => {
    expect(() => generateRandom({ ...DEFAULT_RANDOM, length: 2 })).toThrow();
  });
});

// ===== Passphrase =====

describe("generatePassphrase", () => {
  it("generates correct number of words", () => {
    const p = generatePassphrase({ ...DEFAULT_PASSPHRASE, wordCount: 6 });
    expect(p.split("-").length).toBe(6);
  });
  it("uses custom separator", () => {
    const p = generatePassphrase({ ...DEFAULT_PASSPHRASE, separator: "_" });
    expect(p).toContain("_");
    expect(p).not.toContain("-");
  });
  it("capitalizes when requested", () => {
    const p = generatePassphrase({ ...DEFAULT_PASSPHRASE, capitalize: true, includeNumber: false });
    expect(p.charAt(0)).toMatch(/[A-Z]/);
  });
  it("appends a number when requested", () => {
    const p = generatePassphrase({ ...DEFAULT_PASSPHRASE, includeNumber: true });
    expect(p).toMatch(/\d/);
  });
  it("throws on invalid word count", () => {
    expect(() => generatePassphrase({ ...DEFAULT_PASSPHRASE, wordCount: 2 })).toThrow();
    expect(() => generatePassphrase({ ...DEFAULT_PASSPHRASE, wordCount: 13 })).toThrow();
  });
});

// ===== Pronounceable =====

describe("generatePronounceable", () => {
  it("generates correct length", () => {
    expect(generatePronounceable({ ...DEFAULT_PRONOUNCEABLE, length: 12 })).toHaveLength(12);
  });
  it("throws on invalid length", () => {
    expect(() => generatePronounceable({ ...DEFAULT_PRONOUNCEABLE, length: 4 })).toThrow();
    expect(() => generatePronounceable({ ...DEFAULT_PRONOUNCEABLE, length: 50 })).toThrow();
  });
});

// ===== PIN =====

describe("generatePin", () => {
  it("generates 6-digit PIN by default", () => {
    const pin = generatePin(DEFAULT_PIN);
    expect(pin).toHaveLength(6);
    expect(pin).toMatch(/^\d{6}$/);
  });
  it("generates 4-digit PIN", () => {
    expect(generatePin({ digits: 4 })).toMatch(/^\d{4}$/);
  });
  it("generates 8-digit PIN", () => {
    expect(generatePin({ digits: 8 })).toMatch(/^\d{8}$/);
  });
  it("throws on invalid digits", () => {
    expect(() => generatePin({ digits: 3 })).toThrow();
    expect(() => generatePin({ digits: 9 })).toThrow();
  });
});

// ===== WiFi =====

describe("generateWifi", () => {
  it("generates 63-char password by default (WPA2 max)", () => {
    expect(generateWifi(DEFAULT_WIFI)).toHaveLength(63);
  });
  it("uses printable ASCII only (33-126)", () => {
    const w = generateWifi(DEFAULT_WIFI);
    for (const c of w) {
      const code = c.charCodeAt(0);
      expect(code).toBeGreaterThanOrEqual(33);
      expect(code).toBeLessThanOrEqual(126);
    }
  });
  it("throws on invalid length", () => {
    expect(() => generateWifi({ length: 7 })).toThrow();
    expect(() => generateWifi({ length: 64 })).toThrow();
  });
});

// ===== Diceware =====

describe("generateDiceware", () => {
  it("generates correct word count", () => {
    const r = generateDiceware({ ...DEFAULT_DICEWARE, wordCount: 6 });
    expect(r.password.split("-").length).toBe(6);
    expect(r.rolls).toHaveLength(6);
  });
  it("each roll group has 4 dice", () => {
    const r = generateDiceware(DEFAULT_DICEWARE);
    for (const group of r.rolls) {
      expect(group).toHaveLength(4);
      for (const d of group) {
        expect(d).toBeGreaterThanOrEqual(1);
        expect(d).toBeLessThanOrEqual(6);
      }
    }
  });
  it("throws on invalid word count", () => {
    expect(() => generateDiceware({ ...DEFAULT_DICEWARE, wordCount: 3 })).toThrow();
    expect(() => generateDiceware({ ...DEFAULT_DICEWARE, wordCount: 11 })).toThrow();
  });
});

describe("dicewareFromRolls", () => {
  it("builds password from manual rolls", () => {
    // Rolls 1-1-1-1 → index 0 → "acid"
    const r = dicewareFromRolls([[1, 1, 1, 1]]);
    expect(r.password).toBe("acid");
    expect(r.rolls).toEqual([[1, 1, 1, 1]]);
  });
  it("allows 1-10 dice roll groups", () => {
    expect(() => dicewareFromRolls([[1, 1, 1, 1]])).not.toThrow(); // 1 is allowed
    expect(() => dicewareFromRolls([[1, 1, 1, 1], [2, 2, 2, 2], [3, 3, 3, 3]])).not.toThrow(); // 3 is allowed
  });
  it("throws on 0 or 11+ groups", () => {
    expect(() => dicewareFromRolls([])).toThrow();
    const eleven = Array.from({ length: 11 }, () => [1, 1, 1, 1]);
    expect(() => dicewareFromRolls(eleven)).toThrow();
  });
  it("throws on wrong dice count per group", () => {
    expect(() => dicewareFromRolls([[1, 1, 1]])).toThrow();
  });
});

// ===== Dispatcher =====

describe("generate", () => {
  it("dispatches to random mode", () => {
    const r = generate({ mode: "random", random: DEFAULT_RANDOM });
    expect(r.mode).toBe("random");
    expect(r.password.length).toBe(16);
    expect(r.entropyBits).toBeGreaterThan(0);
  });
  it("dispatches to passphrase mode", () => {
    const r = generate({ mode: "passphrase", passphrase: DEFAULT_PASSPHRASE });
    expect(r.mode).toBe("passphrase");
    expect(r.password.split("-").length).toBe(5);
  });
  it("dispatches to pin mode", () => {
    const r = generate({ mode: "pin", pin: DEFAULT_PIN });
    expect(r.password).toMatch(/^\d{6}$/);
  });
  it("dispatches to wifi mode", () => {
    const r = generate({ mode: "wifi", wifi: DEFAULT_WIFI });
    expect(r.password).toHaveLength(63);
  });
  it("dispatches to diceware mode with rolls", () => {
    const r = generate({ mode: "diceware", diceware: DEFAULT_DICEWARE });
    expect(r.diceRolls).toBeDefined();
    expect(r.diceRolls?.[0]).toHaveLength(4);
  });
  it("throws on unknown mode", () => {
    expect(() => generate({ mode: "unknown" as any })).toThrow();
  });
});

// ===== Entropy =====

describe("estimateRandomEntropy", () => {
  it("returns positive bits for any valid options", () => {
    expect(estimateRandomEntropy(DEFAULT_RANDOM)).toBeGreaterThan(0);
  });
  it("increases with length", () => {
    const short = estimateRandomEntropy({ ...DEFAULT_RANDOM, length: 8 });
    const long = estimateRandomEntropy({ ...DEFAULT_RANDOM, length: 32 });
    expect(long).toBeGreaterThan(short);
  });
});

describe("estimateStrength", () => {
  it("returns Weak for low entropy", () => {
    expect(estimateStrength(20).label).toBe("Weak");
  });
  it("returns Very Strong for high entropy", () => {
    expect(estimateStrength(150).label).toBe("Very Strong");
  });
  it("computes crack time seconds", () => {
    const s = estimateStrength(50);
    expect(s.crackTimeSeconds).toBeGreaterThan(0);
  });
});

describe("humanizeTime", () => {
  it("handles sub-second times", () => {
    expect(humanizeTime(0.5)).toMatch(/second/);
  });
  it("handles minutes", () => {
    expect(humanizeTime(120)).toMatch(/minute/);
  });
  it("handles years", () => {
    expect(humanizeTime(60 * 60 * 24 * 365 * 5)).toMatch(/year/);
  });
  it("handles infinity", () => {
    expect(humanizeTime(Infinity)).toBe("∞");
  });
});

// ===== Pattern detection =====

describe("detectPatterns", () => {
  it("detects sequential digits", () => {
    const w = detectPatterns("abc123def");
    expect(w.some((p) => p.type === "sequential")).toBe(true);
  });
  it("detects repeated characters", () => {
    const w = detectPatterns("passwordaaa");
    expect(w.some((p) => p.type === "repeated")).toBe(true);
  });
  it("detects keyboard patterns", () => {
    const w = detectPatterns("qwerty123");
    expect(w.some((p) => p.type === "keyboard")).toBe(true);
  });
  it("returns empty for strong passwords", () => {
    const w = detectPatterns("X7#kP9$mL2!q");
    expect(w).toHaveLength(0);
  });
  it("returns empty for short passwords", () => {
    expect(detectPatterns("ab")).toHaveLength(0);
  });
});

// ===== Batch + export =====

describe("generateBatch", () => {
  it("generates the requested count", () => {
    expect(generateBatch({ mode: "random", random: DEFAULT_RANDOM }, 5)).toHaveLength(5);
  });
  it("throws on count < 1", () => {
    expect(() => generateBatch({ mode: "random", random: DEFAULT_RANDOM }, 0)).toThrow();
  });
  it("throws on count > 100", () => {
    expect(() => generateBatch({ mode: "random", random: DEFAULT_RANDOM }, 101)).toThrow();
  });
});

describe("toCsv", () => {
  it("produces CSV with header", () => {
    const results = generateBatch({ mode: "random", random: DEFAULT_RANDOM }, 3);
    const csv = toCsv(results);
    expect(csv).toMatch(/^password,mode,entropy_bits,generated_at/);
    expect(csv.split("\n").length).toBe(4); // header + 3 rows
  });
  it("escapes quotes in passwords", () => {
    // Manually craft a password with a quote
    const results = [{ password: 'pass"word', mode: "random" as const, entropyBits: 50 }];
    const csv = toCsv(results);
    expect(csv).toContain('"pass""word"');
  });
});

describe("toJson", () => {
  it("produces valid JSON with metadata", () => {
    const results = generateBatch({ mode: "random", random: DEFAULT_RANDOM }, 2);
    const json = toJson(results);
    const parsed = JSON.parse(json);
    expect(parsed.count).toBe(2);
    expect(parsed.passwords).toHaveLength(2);
    expect(parsed.generated_at).toBeDefined();
  });
});

// ===== Preset encode/decode =====

describe("encodePreset / decodePreset", () => {
  it("round-trips options", () => {
    const opts: PasswordOptions = {
      mode: "random",
      random: { ...DEFAULT_RANDOM, length: 24, minLower: 2, minUpper: 2 },
    };
    const encoded = encodePreset(opts);
    const decoded = decodePreset(encoded);
    expect(decoded).toEqual(opts);
  });
  it("round-trips passphrase options", () => {
    const opts: PasswordOptions = {
      mode: "passphrase",
      passphrase: { ...DEFAULT_PASSPHRASE, wordCount: 7, separator: "_" },
    };
    expect(decodePreset(encodePreset(opts))).toEqual(opts);
  });
  it("throws on empty preset", () => {
    expect(() => decodePreset("")).toThrow();
  });
  it("throws on invalid preset format", () => {
    // Valid base64 but not valid JSON-shape
    const bad = btoa("not-an-object");
    expect(() => decodePreset(bad)).toThrow();
  });
});

// ===== History (localStorage mock) =====

describe("history", () => {
  beforeEach(() => {
    // Mock localStorage
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts empty", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    saveToHistory("test123", "random", 50);
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].password).toBe("test123");
  });
  it("deduplicates same password", () => {
    saveToHistory("same", "random", 50);
    saveToHistory("same", "random", 50);
    expect(loadHistory()).toHaveLength(1);
  });
  it("limits to 10 entries", () => {
    for (let i = 0; i < 15; i++) {
      saveToHistory(`pwd-${i}`, "random", 50);
    }
    expect(loadHistory()).toHaveLength(10);
  });
  it("clears all entries", () => {
    saveToHistory("a", "random", 50);
    saveToHistory("b", "random", 50);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ===== EFF wordlist =====

describe("EFF wordlist", () => {
  it("has a reasonable number of words (>=500)", () => {
    // Note: this is a curated short wordlist, not the full EFF 1,296-word list.
    // Entropy per word is log2(count) ≈ 9.15 bits at 569 words.
    expect(EFF_WORD_COUNT).toBeGreaterThanOrEqual(500);
  });
  it("provides ~9+ bits per word", () => {
    expect(ENTROPY_PER_WORD).toBeGreaterThan(9);
  });
});

// ===== Backward compat shims =====

describe("backward compat", () => {
  it("generatePassword works with RandomOptions", () => {
    expect(generatePassword(DEFAULT_RANDOM)).toHaveLength(16);
  });
  it("generateMultiple returns array of strings", () => {
    const arr = generateMultiple(DEFAULT_RANDOM, 5);
    expect(arr).toHaveLength(5);
    expect(arr[0]).toBeTypeOf("string");
  });
});

// ===== Integration: full pipeline =====

describe("integration: random mode with per-class mins", () => {
  it("generates password meeting all minimums and reports entropy", () => {
    const opts: RandomOptions = {
      ...DEFAULT_RANDOM,
      length: 20,
      minLower: 3, minUpper: 3, minNumbers: 2, minSymbols: 2,
    };
    const pwd = generateRandom(opts);
    expect(pwd).toHaveLength(20);
    expect((pwd.match(/[a-z]/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect((pwd.match(/[A-Z]/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect((pwd.match(/[0-9]/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((pwd.match(/[^a-zA-Z0-9]/g) ?? []).length).toBeGreaterThanOrEqual(2);
    const strength = estimateStrength(estimateRandomEntropy(opts));
    expect(strength.bits).toBeGreaterThan(50);
  });
});
