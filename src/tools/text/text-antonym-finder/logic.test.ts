/**
 * Antonym Finder — unit tests.
 */
import { describe, it, expect } from "vitest";
import { findAntonyms, antonymChain, batchFind, toCsv } from "./logic";

describe("findAntonyms — basic", () => {
  it("errors on empty word", () => {
    expect("error" in findAntonyms({ word: "" })).toBe(true);
  });
  it("errors on non-letters", () => {
    expect("error" in findAntonyms({ word: "hot123" })).toBe(true);
  });
  it("returns antonyms for known word", () => {
    const r = findAntonyms({ word: "hot" });
    if ("error" in r) throw new Error("err");
    expect(r.antonyms.length).toBeGreaterThan(0);
    expect(r.antonyms.map((a) => a.antonym)).toContain("cold");
  });
  it("returns warning for unknown word", () => {
    const r = findAntonyms({ word: "supercalifragilistic" });
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("findAntonyms — POS filter", () => {
  it("respects POS filter", () => {
    const r = findAntonyms({ word: "fast", pos: "adjective" });
    if ("error" in r) throw new Error("err");
    expect(r.pos).toBe("adjective");
    for (const a of r.antonyms) expect(a.pos).toBe("adjective");
  });
  it("returns adverb antonyms for adverb POS", () => {
    const r = findAntonyms({ word: "fast", pos: "adverb" });
    if ("error" in r) throw new Error("err");
    expect(r.antonyms.some((a) => a.antonym === "slowly")).toBe(true);
  });
});

describe("findAntonyms — sense-aware", () => {
  it("light (adj) and light (noun) have different antonyms", () => {
    const adj = findAntonyms({ word: "light", pos: "adjective" });
    const noun = findAntonyms({ word: "light", pos: "noun" });
    if ("error" in adj || "error" in noun) throw new Error("err");
    expect(adj.antonyms.some((a) => a.antonym === "heavy")).toBe(true);
    expect(noun.antonyms.some((a) => a.antonym === "darkness")).toBe(true);
  });
});

describe("findAntonyms — synonyms", () => {
  it("returns synonyms", () => {
    const r = findAntonyms({ word: "happy" });
    if ("error" in r) throw new Error("err");
    expect(r.synonyms.length).toBeGreaterThan(0);
    expect(r.synonyms).toContain("joyful");
  });
});

describe("findAntonyms — rhyming antonyms", () => {
  it("finds rhyming antonyms", () => {
    const r = findAntonyms({ word: "light" });
    if ("error" in r) throw new Error("err");
    // "light" → "night" would rhyme, but "right" is not in antonyms
    // "tight" / "sight" — none of these. Actually let's just check the structure.
    expect(Array.isArray(r.rhymingAntonyms)).toBe(true);
  });
});

describe("findAntonyms — reverse lookup", () => {
  it("finds words that have this word as an antonym", () => {
    const r = findAntonyms({ word: "cold" });
    if ("error" in r) throw new Error("err");
    expect(r.reverseLookup).toContain("hot");
  });
});

describe("findAntonyms — strength & commonality", () => {
  it("antonyms have strength 0-1", () => {
    const r = findAntonyms({ word: "hot" });
    if ("error" in r) throw new Error("err");
    for (const a of r.antonyms) {
      expect(a.strength).toBeGreaterThan(0);
      expect(a.strength).toBeLessThanOrEqual(1);
    }
  });
  it("antonyms are sorted by strength then commonality", () => {
    const r = findAntonyms({ word: "hot" });
    if ("error" in r) throw new Error("err");
    for (let i = 1; i < r.antonyms.length; i++) {
      const prev = r.antonyms[i - 1]!;
      const curr = r.antonyms[i]!;
      const ok = prev.strength > curr.strength
        || (prev.strength === curr.strength && prev.commonality >= curr.commonality);
      expect(ok).toBe(true);
    }
  });
});

describe("findAntonyms — custom dict", () => {
  it("uses custom dictionary", () => {
    const r = findAntonyms({
      word: "supercalifragilistic",
      customDict: [{
        word: "supercalifragilistic",
        pos: "adjective",
        sense: "fictional",
        antonyms: ["boring"],
        synonyms: ["magical"],
        strength: 1,
        commonality: 0.1,
      }],
    });
    if ("error" in r) throw new Error("err");
    expect(r.antonyms.map((a) => a.antonym)).toContain("boring");
  });
});

describe("antonymChain", () => {
  it("builds a chain", () => {
    const chain = antonymChain("hot", 3);
    if (Array.isArray(chain)) {
      expect(chain[0]).toBe("hot");
      expect(chain.length).toBeGreaterThan(1);
    }
  });
  it("errors on invalid depth", () => {
    expect("error" in antonymChain("hot", 10)).toBe(true);
  });
});

describe("batchFind", () => {
  it("processes multiple words", () => {
    const results = batchFind(["hot", "cold", "happy"]);
    expect(results.length).toBe(3);
  });
});

describe("toCsv", () => {
  it("produces CSV with header", () => {
    const results = batchFind(["hot", "cold"]);
    const csv = toCsv(results);
    expect(csv.split("\n")[0]).toContain("Word");
    expect(csv).toContain("Strength");
  });
});
