import { describe, it, expect } from "vitest";
import {
  leetChar, toLeet, toLeetCustom, fromLeet, fromLeetCustom,
  validateLevel, buildInverse, batchToLeet, batchToCsv, stats,
  mergeMap, fmt, LEET_BASIC, LEET_INTERMEDIATE, LEET_ADVANCED,
} from "./logic";

describe("Leet tables", () => {
  it("basic has 6 entries", () => {
    expect(Object.keys(LEET_BASIC).length).toBe(6);
  });
  it("intermediate extends basic", () => {
    expect(LEET_INTERMEDIATE.a).toBe("4");
    expect(LEET_INTERMEDIATE.b).toBe("8");
  });
  it("advanced has more entries than intermediate", () => {
    expect(Object.keys(LEET_ADVANCED).length).toBeGreaterThan(Object.keys(LEET_INTERMEDIATE).length);
  });
});

describe("leetChar", () => {
  it("converts a → 4 in basic", () => {
    expect(leetChar("a", "basic")).toBe("4");
  });
  it("preserves non-mapped chars", () => {
    expect(leetChar("x", "basic")).toBe("x");
  });
  it("handles empty string", () => {
    expect(leetChar("", "basic")).toBe("");
  });
  it("uses uppercase letter for matching", () => {
    expect(leetChar("A", "basic")).toBe("4");
  });
});

describe("toLeet", () => {
  it("basic substitution", () => {
    expect(toLeet("leet", "basic")).toBe("l337");
  });
  it("preserves case of non-mapped chars", () => {
    expect(toLeet("LEET", "basic")).toBe("L337");
  });
  it("advanced uses @ for a", () => {
    expect(toLeet("a", "advanced")).toBe("@");
  });
  it("handles empty string", () => {
    expect(toLeet("", "basic")).toBe("");
  });
  it("intermediate adds b → 8", () => {
    expect(toLeet("bob", "intermediate")).toBe("808");
  });
});

describe("toLeetCustom", () => {
  it("uses custom map", () => {
    expect(toLeetCustom("hello", { h: "|-|" })).toBe("|-|ello");
  });
  it("handles empty input", () => {
    expect(toLeetCustom("", { a: "4" })).toBe("");
  });
});

describe("buildInverse", () => {
  it("returns inverse pairs sorted by key length", () => {
    const inv = buildInverse("advanced");
    expect(inv.length).toBeGreaterThan(0);
    // Longest keys come first
    for (let i = 1; i < inv.length; i++) {
      expect(inv[i]!.key.length).toBeLessThanOrEqual(inv[i - 1]!.key.length);
    }
  });
  it("returns 4 → a for basic", () => {
    const inv = buildInverse("basic");
    const found = inv.find((p) => p.value === "a");
    expect(found?.key).toBe("4");
  });
});

describe("fromLeet", () => {
  it("reverses basic leet", () => {
    expect(fromLeet("l337", "basic")).toBe("leet");
  });
  it("handles empty string", () => {
    expect(fromLeet("", "basic")).toBe("");
  });
  it("preserves non-mapped chars", () => {
    expect(fromLeet("x", "basic")).toBe("x");
  });
  it("reverses multi-char advanced substitutions", () => {
    const enc = toLeet("cat", "advanced");
    expect(fromLeet(enc, "advanced")).toBe("cat");
  });
});

describe("fromLeetCustom", () => {
  it("reverses custom map", () => {
    expect(fromLeetCustom("|-|ello", { h: "|-|" })).toBe("hello");
  });
  it("preserves non-mapped chars", () => {
    expect(fromLeetCustom("xyz", { a: "4" })).toBe("xyz");
  });
});

describe("validateLevel", () => {
  it("accepts basic", () => {
    expect(validateLevel("basic")).toEqual({ ok: true, level: "basic" });
  });
  it("accepts intermediate", () => {
    expect(validateLevel("intermediate")).toEqual({ ok: true, level: "intermediate" });
  });
  it("accepts advanced", () => {
    expect(validateLevel("advanced")).toEqual({ ok: true, level: "advanced" });
  });
  it("rejects unknown", () => {
    expect(validateLevel("ultra")).toHaveProperty("error");
  });
});

describe("batchToLeet / batchToCsv", () => {
  it("encodes multiple inputs", () => {
    const r = batchToLeet(["leet", "hacker"], "basic");
    expect(r).toHaveLength(2);
    expect(r[0]!.output).toBe("l337");
  });
  it("renders CSV with header", () => {
    const csv = batchToCsv(batchToLeet(["leet"], "basic"));
    expect(csv.split("\n")[0]).toBe("index,output");
    expect(csv).toContain("l337");
  });
});

describe("stats", () => {
  it("counts substituted and unchanged", () => {
    const s = stats("leet", "basic");
    expect(s.total).toBe(4);
    expect(s.substituted).toBe(3);
    expect(s.unchanged).toBe(1);
  });
  it("handles empty input", () => {
    const s = stats("", "basic");
    expect(s.total).toBe(0);
    expect(s.ratio).toBe(0);
  });
  it("computes ratio in [0,1]", () => {
    const s = stats("hello", "basic");
    expect(s.ratio).toBeGreaterThanOrEqual(0);
    expect(s.ratio).toBeLessThanOrEqual(1);
  });
});

describe("mergeMap", () => {
  it("merges overrides", () => {
    const merged = mergeMap("basic", { x: "X" });
    expect(merged.x).toBe("X");
    expect(merged.a).toBe("4");
  });
});

describe("fmt", () => {
  it("trims precision", () => {
    expect(fmt(1.23456, 2)).toBe("1.23");
  });
  it("em-dash for NaN", () => {
    expect(fmt(NaN)).toBe("—");
  });
});
