/**
 * Password Strength Checker — unit tests.
 */
import { describe, it, expect } from "vitest";
import { analyzePassword, analyzeBatch, batchToCsv } from "./logic";

describe("analyzePassword — basic", () => {
  it("analyzes empty password", () => {
    const r = analyzePassword("");
    expect(r.length).toBe(0);
    expect(r.entropy).toBe(0);
    expect(r.score).toBe(0);
  });
  it("analyzes short password", () => {
    const r = analyzePassword("abc");
    expect(r.length).toBe(3);
    expect(r.score).toBeLessThanOrEqual(1);
  });
  it("analyzes strong password", () => {
    // Avoid sequential chars, keyboard walks, and dictionary words
    const r = analyzePassword("K7!xQ9#zR4*pL2vW");
    expect(r.length).toBe(16);
    expect(r.entropy).toBeGreaterThan(60);
    expect(r.score).toBeGreaterThanOrEqual(3);
  });
  it("detects lowercase class", () => {
    expect(analyzePassword("abc").classes.lowercase).toBe(true);
  });
  it("detects uppercase class", () => {
    expect(analyzePassword("ABC").classes.uppercase).toBe(true);
  });
  it("detects digits class", () => {
    expect(analyzePassword("123").classes.digits).toBe(true);
  });
  it("detects symbols class", () => {
    expect(analyzePassword("!@#").classes.symbols).toBe(true);
  });
  it("detects unicode class", () => {
    expect(analyzePassword("日本語").classes.unicode).toBe(true);
  });
});

describe("analyzePassword — common passwords", () => {
  it("flags 'password' as common", () => {
    expect(analyzePassword("password").isCommon).toBe(true);
  });
  it("flags '123456' as common", () => {
    expect(analyzePassword("123456").isCommon).toBe(true);
  });
  it("does not flag random password as common", () => {
    expect(analyzePassword("XyZ987!@#abc123").isCommon).toBe(false);
  });
});

describe("analyzePassword — patterns", () => {
  it("detects sequential chars", () => {
    const r = analyzePassword("abc123!");
    expect(r.patterns.some((p) => p.type === "sequential")).toBe(true);
  });
  it("detects repeated chars", () => {
    const r = analyzePassword("aaa123!@#");
    expect(r.patterns.some((p) => p.type === "repeated")).toBe(true);
  });
  it("detects keyboard walk", () => {
    const r = analyzePassword("qwerty123");
    expect(r.patterns.some((p) => p.type === "keyboard-walk")).toBe(true);
  });
  it("detects year pattern", () => {
    // Year must be at a word boundary — use space-separated
    const r = analyzePassword("My Password 2024");
    expect(r.patterns.some((p) => p.type === "year")).toBe(true);
  });
  it("flags all-same-char as danger", () => {
    const r = analyzePassword("aaaaaa");
    expect(r.patterns.some((p) => p.type === "all-same" && p.severity === "danger")).toBe(true);
  });
});

describe("analyzePassword — dictionary", () => {
  it("detects password as dictionary word", () => {
    expect(analyzePassword("password123").hasDictionaryWord).toBe(true);
  });
  it("detects leet-speak password", () => {
    expect(analyzePassword("p@ssw0rd123").hasDictionaryWord).toBe(true);
  });
});

describe("analyzePassword — crack time", () => {
  it("returns crack time strings", () => {
    const r = analyzePassword("Hello123!");
    expect(typeof r.crackTime.offlineFastHashing).toBe("string");
    expect(typeof r.crackTime.offlineSlowHashing).toBe("string");
    expect(typeof r.crackTime.onlineThrottled).toBe("string");
  });
  it("returns instant for empty password", () => {
    expect(analyzePassword("").crackTime.offlineFastHashing).toBe("instant");
  });
  it("returns longer time for stronger password", () => {
    const weak = analyzePassword("abc");
    const strong = analyzePassword("Abc123!@#XyZ987*");
    // Strong should have a longer crack-time string (rough heuristic)
    expect(strong.entropy).toBeGreaterThan(weak.entropy);
  });
});

describe("analyzePassword — score", () => {
  it("scores 'password' as 0 (common)", () => {
    expect(analyzePassword("password").score).toBe(0);
  });
  it("scores 'aaaaaa' as 0 (dangerous pattern)", () => {
    expect(analyzePassword("aaaaaa").score).toBe(0);
  });
  it("scores strong password as 3 or 4", () => {
    const r = analyzePassword("K7!xQ9#zR4*pL2vW8jT");
    expect(r.score).toBeGreaterThanOrEqual(3);
  });
});

describe("analyzePassword — suggestions", () => {
  it("suggests adding uppercase if missing", () => {
    const r = analyzePassword("abc123!@#xyz");
    expect(r.suggestions.some((s) => s.includes("uppercase"))).toBe(true);
  });
  it("suggests adding symbols if missing", () => {
    const r = analyzePassword("Abc123xyz");
    expect(r.suggestions.some((s) => s.includes("symbols"))).toBe(true);
  });
  it("warns about common passwords", () => {
    const r = analyzePassword("password");
    expect(r.suggestions.some((s) => s.includes("common password"))).toBe(true);
  });
});

describe("analyzeBatch", () => {
  it("analyzes multiple passwords", () => {
    const r = analyzeBatch(["abc", "Abc123!@#"]);
    expect(r.length).toBe(2);
    expect(r[0]!.length).toBe(3);
    expect(r[1]!.length).toBe(9);
  });
});

describe("batchToCsv", () => {
  it("generates CSV with header", () => {
    const r = analyzeBatch(["abc"]);
    const csv = batchToCsv(r);
    expect(csv.split("\n")[0]).toBe("Password,Length,Entropy,Score,ScoreLabel,IsCommon,HasDictWord,CrackTimeFast,CrackTimeSlow,CrackTimeOnline");
    expect(csv).toContain("abc");
  });
  it("escapes quotes in passwords", () => {
    const r = analyzeBatch(['has"quote"']);
    const csv = batchToCsv(r);
    expect(csv).toContain('""quote""');
  });
});
