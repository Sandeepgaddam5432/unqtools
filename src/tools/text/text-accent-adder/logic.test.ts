import { describe, it, expect } from "vitest";
import {
  addAccentToChar,
  addAccents,
  addCyclingAccents,
  addRandomAccents,
  applyAccents,
  applyAccentsBatch,
  validateAccentType,
  ACCENT_MAP,
  computeStats,
  perCharBreakdown,
  listVowels,
  breakdownToCsv,
} from "./logic";

describe("ACCENT_MAP", () => {
  it("has all accent types", () => {
    expect(Object.keys(ACCENT_MAP).length).toBe(5);
  });
});

describe("addAccentToChar", () => {
  it("adds acute to a", () => {
    expect(addAccentToChar("a", "acute")).toBe("á");
  });
  it("adds umlaut to u", () => {
    expect(addAccentToChar("u", "umlaut")).toBe("ü");
  });
  it("preserves non-vowel", () => {
    expect(addAccentToChar("b", "acute")).toBe("b");
  });
  it("preserves case", () => {
    expect(addAccentToChar("E", "acute")).toBe("É");
  });
});

describe("addAccents", () => {
  it("adds acute to all vowels", () => {
    expect(addAccents("aeiou", "acute")).toBe("áéíóú");
  });
  it("handles empty string", () => {
    expect(addAccents("", "acute")).toBe("");
  });
  it("preserves consonants", () => {
    expect(addAccents("hello", "acute")).toBe("hélló");
  });
  it("adds tilde to a/o/n", () => {
    expect(addAccents("ano", "tilde")).toBe("ãñõ");
  });
});

describe("addCyclingAccents", () => {
  it("cycles through accents", () => {
    const out = addCyclingAccents("aaaa");
    expect(out[0]).toBe("á");
    expect(out[1]).toBe("à");
    expect(out[2]).toBe("â");
    expect(out[3]).toBe("ä");
  });
  it("preserves non-vowels", () => {
    expect(addCyclingAccents("bbb")).toBe("bbb");
  });
});

describe("addRandomAccents", () => {
  it("is deterministic for same seed", () => {
    const a = addRandomAccents("aeiou", 5);
    const b = addRandomAccents("aeiou", 5);
    expect(a).toBe(b);
  });
  it("produces accented vowels", () => {
    const out = addRandomAccents("aaaa", 7);
    expect(out).not.toBe("aaaa");
    expect(out.length).toBe(4);
  });
});

describe("applyAccents", () => {
  it("dispatches by mode", () => {
    expect(applyAccents("a", "acute")).toBe("á");
    expect(applyAccents("a", "grave")).toBe("à");
    expect(applyAccents("ab", "cycle")).toBe("áb");
  });
  it("random uses seed", () => {
    expect(applyAccents("a", "random", 5)).toBe(applyAccents("a", "random", 5));
  });
});

describe("applyAccentsBatch", () => {
  it("processes multiple lines", () => {
    const out = applyAccentsBatch(["abc", "def"], "acute");
    expect(out).toEqual(["ábc", "déf"]);
  });
});

describe("validateAccentType", () => {
  it("accepts valid type", () => {
    expect(validateAccentType("acute")).toEqual({ ok: true, type: "acute" });
  });
  it("rejects invalid type", () => {
    expect(validateAccentType("weird")).toHaveProperty("error");
  });
});

describe("computeStats", () => {
  it("counts vowels", () => {
    const s = computeStats("hello world", "acute");
    expect(s.chars).toBe(11);
    expect(s.vowelsAccented).toBe(3);
    expect(s.charsPreserved).toBe(8);
    expect(s.mode).toBe("acute");
  });
});

describe("perCharBreakdown", () => {
  it("returns entries for changed chars", () => {
    const b = perCharBreakdown("hello", "acute");
    expect(b.length).toBeGreaterThan(0);
    const e = b.find((e) => e.original === "e");
    expect(e?.accented).toBe("é");
    expect(e?.accent).toBe("acute");
  });
  it("returns empty when no changes", () => {
    expect(perCharBreakdown("bcdfg", "acute")).toEqual([]);
  });
});

describe("listVowels", () => {
  it("lists distinct vowels", () => {
    expect(listVowels("hello world").sort()).toEqual(["e", "o"]);
  });
  it("returns empty for no vowels", () => {
    expect(listVowels("xyz")).toEqual([]);
  });
});

describe("breakdownToCsv", () => {
  it("generates CSV with header", () => {
    const csv = breakdownToCsv(perCharBreakdown("hello", "acute"));
    expect(csv.split("\n")[0]).toBe("Original,Accented,Accent,Count");
    expect(csv).toContain("e");
    expect(csv).toContain("é");
  });
});
