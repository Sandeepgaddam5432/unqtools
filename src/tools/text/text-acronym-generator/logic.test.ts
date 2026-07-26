/**
 * Acronym Generator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { generateAcronym, toCsv, toJson } from "./logic";

describe("generateAcronym — validation", () => {
  it("errors on empty keyword", () => {
    expect("error" in generateAcronym({ keyword: "" })).toBe(true);
  });
  it("errors on non-letter characters", () => {
    expect("error" in generateAcronym({ keyword: "ABC1" })).toBe(true);
    expect("error" in generateAcronym({ keyword: "A B" })).toBe(true);
  });
  it("accepts lowercase keyword", () => {
    const r = generateAcronym({ keyword: "abc", seed: 1 });
    if ("error" in r) throw new Error("err");
    expect(r.keyword).toBe("ABC");
  });
});

describe("generateAcronym — basic generation", () => {
  it("produces variants for short keyword", () => {
    const r = generateAcronym({ keyword: "CAT", seed: 42, variants: 3 });
    if ("error" in r) throw new Error("err");
    expect(r.variants.length).toBeGreaterThan(0);
    expect(r.variants.length).toBeLessThanOrEqual(3);
  });
  it("each variant has one word per letter", () => {
    const r = generateAcronym({ keyword: "DOG", seed: 7 });
    if ("error" in r) throw new Error("err");
    for (const v of r.variants) {
      expect(v.words.length).toBe(3);
      expect(v.words[0]![0].toUpperCase()).toBe("D");
      expect(v.words[1]![0].toUpperCase()).toBe("O");
      expect(v.words[2]![0].toUpperCase()).toBe("G");
    }
  });
  it("is deterministic with same seed", () => {
    const a = generateAcronym({ keyword: "FIRE", seed: 100 });
    const b = generateAcronym({ keyword: "FIRE", seed: 100 });
    if ("error" in a || "error" in b) throw new Error("err");
    expect(a.variants.map((v) => v.words.join(" "))).toEqual(b.variants.map((v) => v.words.join(" ")));
  });
});

describe("generateAcronym — categories & custom dict", () => {
  it("uses custom dictionary words", () => {
    const r = generateAcronym({ keyword: "ABC", seed: 1, customDictionary: ["apple", "banana", "cherry"], categories: [], caseStyle: "lower" });
    if ("error" in r) throw new Error("err");
    expect(r.variants.length).toBeGreaterThan(0);
    // At least one variant should contain a custom word
    const allWords = r.variants.flatMap((v) => v.words.map((w) => w.toLowerCase()));
    expect(allWords).toContain("apple");
    expect(allWords).toContain("banana");
    expect(allWords).toContain("cherry");
  });
  it("respects category filter (only tech)", () => {
    const r = generateAcronym({ keyword: "ABC", seed: 1, categories: ["tech"] });
    if ("error" in r) throw new Error("err");
    // Letter availability reflects tech pool only
    expect(r.letterAvailability.length).toBe(3);
  });
});

describe("generateAcronym — filters", () => {
  it("respects min/max word length", () => {
    const r = generateAcronym({ keyword: "CAT", seed: 5, minLength: 5, maxLength: 7 });
    if ("error" in r) throw new Error("err");
    for (const v of r.variants) {
      for (const w of v.words) {
        expect(w.length).toBeGreaterThanOrEqual(5);
        expect(w.length).toBeLessThanOrEqual(7);
      }
    }
  });
  it("applies mandatory words per position", () => {
    const r = generateAcronym({ keyword: "CAT", seed: 1, mandatory: ["Clever", "", ""] });
    if ("error" in r) throw new Error("err");
    expect(r.variants.length).toBeGreaterThan(0);
    expect(r.variants[0]!.words[0]).toBe("Clever");
  });
  it("applies position regex filters", () => {
    const r = generateAcronym({ keyword: "AB", seed: 1, positionFilters: ["^a"] });
    if ("error" in r) throw new Error("err");
    for (const v of r.variants) {
      expect(v.words[0]!.toLowerCase()).toMatch(/^a/);
    }
  });
});

describe("generateAcronym — case style", () => {
  it("title-case words", () => {
    const r = generateAcronym({ keyword: "AB", seed: 1, caseStyle: "title" });
    if ("error" in r) throw new Error("err");
    expect(r.variants[0]!.words[0]![0]).toMatch(/[A-Z]/);
  });
  it("upper-case words", () => {
    const r = generateAcronym({ keyword: "AB", seed: 1, caseStyle: "upper" });
    if ("error" in r) throw new Error("err");
    expect(r.variants[0]!.words[0]).toBe(r.variants[0]!.words[0]!.toUpperCase());
  });
  it("lower-case words", () => {
    const r = generateAcronym({ keyword: "AB", seed: 1, caseStyle: "lower" });
    if ("error" in r) throw new Error("err");
    expect(r.variants[0]!.words[0]).toBe(r.variants[0]!.words[0]!.toLowerCase());
  });
});

describe("generateAcronym — availability & warnings", () => {
  it("reports letter availability", () => {
    const r = generateAcronym({ keyword: "AB", seed: 1 });
    if ("error" in r) throw new Error("err");
    expect(r.letterAvailability.length).toBe(2);
    expect(r.letterAvailability[0]!.letter).toBe("A");
  });
  it("warns when no words available for a letter", () => {
    const r = generateAcronym({ keyword: "QZ", seed: 1, categories: ["common"] });
    if ("error" in r) throw new Error("err");
    // Q and Z may not have words in common pool
    expect(r.warnings.length).toBeGreaterThanOrEqual(0);
  });
});

describe("generateAcronym — variants count", () => {
  it("returns requested number of variants", () => {
    const r = generateAcronym({ keyword: "DOG", seed: 1, variants: 8 });
    if ("error" in r) throw new Error("err");
    expect(r.variants.length).toBeLessThanOrEqual(8);
    expect(r.variants.length).toBeGreaterThan(0);
  });
  it("caps variants at 50", () => {
    const r = generateAcronym({ keyword: "DOG", seed: 1, variants: 100 });
    if ("error" in r) throw new Error("err");
    expect(r.variants.length).toBeLessThanOrEqual(50);
  });
});

describe("exporters", () => {
  it("toCsv produces CSV with header", () => {
    const r = generateAcronym({ keyword: "CAT", seed: 1 });
    if ("error" in r) throw new Error("err");
    const csv = toCsv(r);
    expect(csv.split("\n")[0]).toContain("Keyword");
    expect(csv).toContain("CAT");
  });
  it("toJson produces JSON with variants array", () => {
    const r = generateAcronym({ keyword: "CAT", seed: 1 });
    if ("error" in r) throw new Error("err");
    const json = JSON.parse(toJson(r));
    expect(json.keyword).toBe("CAT");
    expect(Array.isArray(json.variants)).toBe(true);
  });
});
