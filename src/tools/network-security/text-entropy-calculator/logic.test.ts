import { describe, it, expect } from "vitest";
import {
  process,
  processBatch,
  toCsv,
  toAsciiHistogram,
  formatSummary,
  randomnessVerdict,
  validateOptions,
} from "./logic";

describe("process — basic", () => {
  it("computes 0 entropy for empty input", () => {
    const r = process("");
    expect(r.shannonEntropy).toBe(0);
    expect(r.charCount).toBe(0);
  });
  it("computes 0 entropy for single repeated char", () => {
    const r = process("aaaa");
    expect(r.shannonEntropy).toBe(0);
  });
  it("computes 1 bit per char for 50/50 binary", () => {
    const r = process("0101");
    expect(r.shannonEntropy).toBeCloseTo(1, 3);
  });
  it("computes 2 bits per char for 4 unique equal chars", () => {
    const r = process("abcd");
    expect(r.shannonEntropy).toBeCloseTo(2, 3);
  });
});

describe("process — case sensitivity", () => {
  it("is case-sensitive by default", () => {
    const r = process("AaAa");
    expect(r.uniqueChars).toBe(2);
  });
  it("is case-insensitive when option set", () => {
    const r = process("AaAa", { caseSensitive: false });
    expect(r.uniqueChars).toBe(1);
  });
});

describe("process — frequency", () => {
  it("tracks top chars", () => {
    const r = process("aaabb");
    expect(r.topChars[0]!.char).toBe("a");
    expect(r.topChars[0]!.count).toBe(3);
    expect(r.topChars[1]!.count).toBe(2);
  });
  it("computes frequency", () => {
    const r = process("aab");
    expect(r.topChars[0]!.frequency).toBeCloseTo(2 / 3, 3);
  });
  it("computes percentage", () => {
    const r = process("aaabb");
    expect(r.topChars[0]!.percentage).toBeCloseTo(60, 1);
  });
});

describe("process — randomness", () => {
  it("gives 100 for uniform distribution", () => {
    const r = process("abcd");
    expect(r.randomnessScore).toBe(100);
  });
  it("gives lower score for skewed distribution", () => {
    const r = process("aaaaabcd");
    expect(r.randomnessScore).toBeLessThan(100);
  });
  it("warns on small sample", () => {
    const r = process("ab");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("warns on single unique char", () => {
    const r = process("aaaa");
    expect(r.warnings.some((w) => w.includes("Only one unique"))).toBe(true);
  });
});

describe("process — entropy ratio & max", () => {
  it("computes max entropy = log2(unique)", () => {
    const r = process("abcd");
    expect(r.maxEntropy).toBeCloseTo(2, 3);
  });
  it("computes entropy ratio = 1 for uniform", () => {
    const r = process("abcd");
    expect(r.entropyRatio).toBeCloseTo(1, 3);
  });
  it("computes total bits = entropy × chars", () => {
    const r = process("abcd");
    expect(r.totalBits).toBeCloseTo(8, 3);
  });
});

describe("process — ignore whitespace", () => {
  it("ignores whitespace when option set", () => {
    const r = process("a b c d", { ignoreWhitespace: true });
    expect(r.charCount).toBe(4);
  });
});

describe("process — alphabet restriction", () => {
  it("filters chars to alphabet", () => {
    const r = process("abc123", { alphabet: ["a", "b", "c"] });
    expect(r.charCount).toBe(3);
  });
});

describe("process — histogram", () => {
  it("returns histogram bars", () => {
    const r = process("aaabb");
    expect(r.histogram.length).toBe(2);
    expect(r.histogram[0]!.char).toBe("a");
    expect(r.histogram[0]!.normalizedHeight).toBeCloseTo(1, 3);
  });
});

describe("processBatch", () => {
  it("processes multiple inputs", () => {
    const results = processBatch(["aaaa", "abcd"]);
    expect(results.length).toBe(2);
    expect(results[0].shannonEntropy).toBe(0);
    expect(results[1].shannonEntropy).toBeCloseTo(2, 3);
  });
});

describe("toCsv", () => {
  it("generates CSV with header", () => {
    const csv = toCsv(process("aaabb"));
    expect(csv.split("\n")[0]).toBe("Char,Count,Frequency,Percentage");
    expect(csv).toContain('"a",3');
  });
});

describe("toAsciiHistogram", () => {
  it("generates ASCII bar chart", () => {
    const out = toAsciiHistogram(process("aaabb"));
    expect(out).toContain("█");
    expect(out).toContain("a");
  });
});

describe("formatSummary", () => {
  it("includes key metrics", () => {
    const s = formatSummary(process("abcd"));
    expect(s).toContain("Shannon entropy");
    expect(s).toContain("Randomness score");
  });
});

describe("randomnessVerdict", () => {
  it("returns verdict for uniform input", () => {
    expect(randomnessVerdict(process("abcd"))).toContain("Excellent");
  });
  it("returns verdict for empty input", () => {
    expect(randomnessVerdict(process(""))).toContain("Empty");
  });
  it("returns verdict for low-entropy input", () => {
    expect(randomnessVerdict(process("aaaa"))).toContain("Very low");
  });
});

describe("validateOptions", () => {
  it("accepts valid options", () => {
    expect(validateOptions({ base: 2 })).toEqual({ ok: true });
  });
  it("rejects base 1", () => {
    expect("error" in validateOptions({ base: 1 })).toBe(true);
  });
  it("rejects negative base", () => {
    expect("error" in validateOptions({ base: -1 })).toBe(true);
  });
});
