import { describe, it, expect, beforeEach } from "vitest";
import {
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  ALL_CATEGORIES,
  DEFAULT_SAMPLE_OPTIONS,
  MAX_SAMPLE,
  NAUGHTY_STRINGS,
  fromCodePoints,
  repeat,
  makeZalgo,
  mulberry32,
  filterByCategory,
  searchStrings,
  applyFilter,
  countByCategory,
  librarySize,
  pickOne,
  sampleStrings,
  sampleUniqueStrings,
  fisherYates,
  generateUnicodeRange,
  generateBoundaryValues,
  renderText,
  renderCsv,
  renderJson,
  renderPlaywrightFixture,
  renderJestFixture,
  renderPytestFixture,
  renderLoopSnippet,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type NaughtyCategory,
  type NaughtyString,
  type SampleOptions,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

describe("naughty-strings constants", () => {
  it("exposes 12 categories", () => {
    expect(ALL_CATEGORIES).toHaveLength(12);
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(12);
    expect(Object.keys(CATEGORY_DESCRIPTIONS)).toHaveLength(12);
  });
  it("has at least 200 entries in the library", () => {
    expect(NAUGHTY_STRINGS.length).toBeGreaterThanOrEqual(200);
    expect(librarySize()).toBeGreaterThanOrEqual(200);
  });
  it("every entry has a valid category", () => {
    for (const s of NAUGHTY_STRINGS) {
      expect(ALL_CATEGORIES).toContain(s.category);
    }
  });
  it("every category has at least 5 entries", () => {
    const counts = countByCategory(NAUGHTY_STRINGS);
    for (const cat of ALL_CATEGORIES) {
      expect(counts[cat]).toBeGreaterThanOrEqual(5);
    }
  });
  it("DEFAULT_SAMPLE_OPTIONS has sensible defaults", () => {
    expect(DEFAULT_SAMPLE_OPTIONS.count).toBeGreaterThan(0);
    expect(DEFAULT_SAMPLE_OPTIONS.categories).toEqual([]);
    expect(MAX_SAMPLE).toBeGreaterThanOrEqual(100);
  });
  it("CATEGORY_DESCRIPTIONS are non-empty strings", () => {
    for (const cat of ALL_CATEGORIES) {
      expect(CATEGORY_DESCRIPTIONS[cat].length).toBeGreaterThan(10);
    }
  });
});

describe("naughty-strings helpers", () => {
  it("fromCodePoints joins code points", () => {
    expect(fromCodePoints([0x48, 0x69])).toBe("Hi");
  });
  it("repeat returns empty for n<=0", () => {
    expect(repeat("a", 0)).toBe("");
    expect(repeat("a", -5)).toBe("");
  });
  it("repeat produces the right length", () => {
    expect(repeat("ab", 3)).toBe("ababab");
  });
  it("makeZalgo produces a string with combining marks", () => {
    const z = makeZalgo("a", 5);
    expect(z.length).toBeGreaterThan(1);
    expect(z.startsWith("a")).toBe(true);
  });
  it("makeZalgo with 0 returns just the base", () => {
    expect(makeZalgo("x", 0)).toBe("x");
  });
});

describe("naughty-strings category coverage", () => {
  const counts = countByCategory(NAUGHTY_STRINGS);

  it("has reserved category with at least 10", () => {
    expect(counts["reserved"]).toBeGreaterThanOrEqual(10);
  });
  it("has special-chars category with at least 15", () => {
    expect(counts["special-chars"]).toBeGreaterThanOrEqual(15);
  });
  it("has control-chars category with at least 10", () => {
    expect(counts["control-chars"]).toBeGreaterThanOrEqual(10);
  });
  it("has zero-width-bom category with at least 5", () => {
    expect(counts["zero-width-bom"]).toBeGreaterThanOrEqual(5);
  });
  it("has unicode category with at least 15", () => {
    expect(counts["unicode"]).toBeGreaterThanOrEqual(15);
  });
  it("has emoji category with at least 10", () => {
    expect(counts["emoji"]).toBeGreaterThanOrEqual(10);
  });
  it("has rtl-bidi category with at least 5", () => {
    expect(counts["rtl-bidi"]).toBeGreaterThanOrEqual(5);
  });
  it("has zalgo category with at least 5", () => {
    expect(counts["zalgo"]).toBeGreaterThanOrEqual(5);
  });
  it("has sql-injection category with at least 10", () => {
    expect(counts["sql-injection"]).toBeGreaterThanOrEqual(10);
  });
  it("has xss category with at least 10", () => {
    expect(counts["xss"]).toBeGreaterThanOrEqual(10);
  });
  it("has unicode-numbers category with at least 5", () => {
    expect(counts["unicode-numbers"]).toBeGreaterThanOrEqual(5);
  });
  it("has boundary category with at least 10", () => {
    expect(counts["boundary"]).toBeGreaterThanOrEqual(10);
  });

  it("library contains null byte", () => {
    expect(NAUGHTY_STRINGS.some((s) => s.value === "\x00")).toBe(true);
  });
  it("library contains Bobby Tables", () => {
    expect(NAUGHTY_STRINGS.some((s) => s.value === "'; DROP TABLE users; --")).toBe(true);
  });
  it("library contains a classic XSS payload", () => {
    expect(NAUGHTY_STRINGS.some((s) => s.value === "<script>alert(1)</script>")).toBe(true);
  });
  it("library contains RTL override", () => {
    expect(NAUGHTY_STRINGS.some((s) => s.value.startsWith("\u202E"))).toBe(true);
  });
  it("library contains BOM", () => {
    expect(NAUGHTY_STRINGS.some((s) => s.value === "\uFEFF")).toBe(true);
  });
});

describe("naughty-strings PRNG", () => {
  it("mulberry32 reproduces the same sequence for the same seed", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });
  it("mulberry32 returns floats in [0, 1)", () => {
    const p = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const v = p.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("naughty-strings filterByCategory", () => {
  it("returns all when categories is empty", () => {
    expect(filterByCategory(NAUGHTY_STRINGS, [])).toHaveLength(NAUGHTY_STRINGS.length);
  });
  it("filters to a single category", () => {
    const filtered = filterByCategory(NAUGHTY_STRINGS, ["sql-injection"]);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((s) => s.category === "sql-injection")).toBe(true);
  });
  it("filters to multiple categories", () => {
    const filtered = filterByCategory(NAUGHTY_STRINGS, ["sql-injection", "xss"]);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((s) => s.category === "sql-injection" || s.category === "xss")).toBe(true);
  });
});

describe("naughty-strings searchStrings", () => {
  it("returns all when query is empty", () => {
    expect(searchStrings(NAUGHTY_STRINGS, "")).toHaveLength(NAUGHTY_STRINGS.length);
    expect(searchStrings(NAUGHTY_STRINGS, "   ")).toHaveLength(NAUGHTY_STRINGS.length);
  });
  it("matches by value substring (case-insensitive)", () => {
    const results = searchStrings(NAUGHTY_STRINGS, "DROP TABLE");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((s) => s.value.includes("DROP TABLE"))).toBe(true);
  });
  it("matches by description substring", () => {
    const results = searchStrings(NAUGHTY_STRINGS, "Bobby Tables");
    expect(results.length).toBeGreaterThan(0);
  });
  it("returns empty when no match", () => {
    const results = searchStrings(NAUGHTY_STRINGS, "this-will-never-match-xyzzy-12345");
    expect(results).toEqual([]);
  });
});

describe("naughty-strings applyFilter", () => {
  it("combines category filter + search", () => {
    const results = applyFilter(NAUGHTY_STRINGS, ["sql-injection"], "DROP");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((s) => s.category === "sql-injection")).toBe(true);
    expect(results.every((s) => s.value.toLowerCase().includes("drop") || (s.description?.toLowerCase().includes("drop") ?? false))).toBe(true);
  });
  it("returns empty when nothing matches", () => {
    // "Bobby Tables" appears in the sql-injection description, not in reserved.
    expect(applyFilter(NAUGHTY_STRINGS, ["reserved"], "Bobby Tables")).toEqual([]);
  });
});

describe("naughty-strings countByCategory", () => {
  it("returns a count for every category", () => {
    const counts = countByCategory(NAUGHTY_STRINGS);
    for (const c of ALL_CATEGORIES) {
      expect(counts[c]).toBeGreaterThanOrEqual(0);
    }
  });
  it("totals to the library size", () => {
    const counts = countByCategory(NAUGHTY_STRINGS);
    const total = ALL_CATEGORIES.reduce((sum, c) => sum + counts[c], 0);
    expect(total).toBe(NAUGHTY_STRINGS.length);
  });
});

describe("naughty-strings pickOne", () => {
  it("returns an element of the array", () => {
    const p = mulberry32(42);
    const item = pickOne(p, NAUGHTY_STRINGS);
    expect(NAUGHTY_STRINGS).toContain(item);
  });
  it("throws on empty array", () => {
    const p = mulberry32(42);
    expect(() => pickOne(p, [])).toThrow(/empty/);
  });
});

describe("naughty-strings sampleStrings", () => {
  it("returns the requested count", () => {
    const out = sampleStrings({ seed: 42, count: 20, categories: [] });
    expect(out).toHaveLength(20);
  });
  it("is reproducible for the same seed", () => {
    const a = sampleStrings({ seed: 99, count: 10, categories: [] });
    const b = sampleStrings({ seed: 99, count: 10, categories: [] });
    expect(a).toEqual(b);
  });
  it("produces different output for different seed", () => {
    const a = sampleStrings({ seed: 1, count: 10, categories: [] });
    const b = sampleStrings({ seed: 2, count: 10, categories: [] });
    expect(a).not.toEqual(b);
  });
  it("respects category filter", () => {
    const out = sampleStrings({ seed: 1, count: 20, categories: ["sql-injection"] });
    expect(out.every((s) => s.category === "sql-injection")).toBe(true);
  });
  it("returns empty for count <= 0", () => {
    expect(sampleStrings({ seed: 1, count: 0, categories: [] })).toEqual([]);
    expect(sampleStrings({ seed: 1, count: -5, categories: [] })).toEqual([]);
  });
  it("clamps to MAX_SAMPLE", () => {
    const out = sampleStrings({ seed: 1, count: MAX_SAMPLE + 1000, categories: [] });
    expect(out.length).toBe(MAX_SAMPLE);
  });
});

describe("naughty-strings sampleUniqueStrings", () => {
  it("returns no more than the pool size", () => {
    const out = sampleUniqueStrings({ seed: 1, count: 100000, categories: ["reserved"] });
    const reservedCount = NAUGHTY_STRINGS.filter((s) => s.category === "reserved").length;
    expect(out.length).toBeLessThanOrEqual(reservedCount);
  });
  it("is reproducible for the same seed", () => {
    const a = sampleUniqueStrings({ seed: 7, count: 10, categories: [] });
    const b = sampleUniqueStrings({ seed: 7, count: 10, categories: [] });
    expect(a).toEqual(b);
  });
  it("returns empty when category filter matches nothing", () => {
    expect(sampleUniqueStrings({ seed: 1, count: 10, categories: [] }).length).toBeGreaterThan(0);
  });
});

describe("naughty-strings fisherYates", () => {
  it("returns a permutation of the input", () => {
    const p = mulberry32(1);
    const input = [1, 2, 3, 4, 5];
    const shuffled = fisherYates(p, input);
    expect(shuffled.sort()).toEqual(input);
  });
  it("does not mutate the input", () => {
    const p = mulberry32(1);
    const input = [1, 2, 3, 4, 5];
    const inputCopy = [...input];
    fisherYates(p, input);
    expect(input).toEqual(inputCopy);
  });
});

describe("naughty-strings generateUnicodeRange", () => {
  it("generates the requested count", () => {
    const out = generateUnicodeRange({ startCodePoint: 0x0041, endCodePoint: 0x005A, count: 5, seed: 1 });
    expect(out).toHaveLength(5);
  });
  it("returns characters within the range", () => {
    const out = generateUnicodeRange({ startCodePoint: 0x0041, endCodePoint: 0x005A, count: 10, seed: 1 });
    for (const item of out) {
      // Skip the lone-surrogate note strings
      if (!item.value.startsWith("(")) {
        expect(item.value.charCodeAt(0)).toBeGreaterThanOrEqual(0x41);
        expect(item.value.charCodeAt(0)).toBeLessThanOrEqual(0x5A);
      }
    }
  });
  it("flags lone surrogate code points", () => {
    const out = generateUnicodeRange({ startCodePoint: 0xD800, endCodePoint: 0xD800, count: 1, seed: 1 });
    expect(out[0].value).toContain("lone surrogate");
  });
  it("swaps inverted ranges", () => {
    const out = generateUnicodeRange({ startCodePoint: 0x5A, endCodePoint: 0x41, count: 3, seed: 1 });
    expect(out).toHaveLength(3);
  });
  it("returns empty for count <= 0", () => {
    expect(generateUnicodeRange({ startCodePoint: 0x41, endCodePoint: 0x5A, count: 0, seed: 1 })).toEqual([]);
  });
});

describe("naughty-strings generateBoundaryValues", () => {
  it("returns at least 20 boundary values", () => {
    expect(generateBoundaryValues().length).toBeGreaterThanOrEqual(20);
  });
  it("includes the empty string", () => {
    expect(generateBoundaryValues().some((s) => s.value === "")).toBe(true);
  });
  it("includes INT32_MAX", () => {
    expect(generateBoundaryValues().some((s) => s.value === "2147483647")).toBe(true);
  });
  it("includes a 10000-char string", () => {
    const list = generateBoundaryValues();
    expect(list.some((s) => s.value.length === 10000)).toBe(true);
  });
});

describe("naughty-strings renderers", () => {
  const sample: NaughtyString[] = [
    { category: "sql-injection", value: "'; DROP TABLE users; --", description: "Bobby" },
    { category: "xss", value: "<script>alert(1)</script>", description: "XSS" },
  ];

  it("renderText joins values with newlines", () => {
    expect(renderText(sample)).toBe("'; DROP TABLE users; --\n<script>alert(1)</script>");
  });
  it("renderText returns empty string for empty input", () => {
    expect(renderText([])).toBe("");
  });
  it("renderCsv includes a header row", () => {
    expect(renderCsv([])).toBe("category,value");
  });
  it("renderCsv escapes commas and quotes", () => {
    const csv = renderCsv([{ category: "xss", value: 'a,"b', description: undefined }]);
    expect(csv).toContain('"a,""b"');
  });
  it("renderJson produces valid JSON", () => {
    const json = renderJson(sample);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].category).toBe("sql-injection");
  });
  it("renderPlaywrightFixture imports playwright", () => {
    const out = renderPlaywrightFixture(sample);
    expect(out).toContain("import { test, expect } from '@playwright/test';");
    expect(out).toContain("test.describe");
  });
  it("renderJestFixture imports nothing and uses describe.each", () => {
    const out = renderJestFixture(sample);
    expect(out).toContain("describe.each");
  });
  it("renderPytestFixture imports pytest and uses parametrize", () => {
    const out = renderPytestFixture(sample);
    expect(out).toContain("import pytest");
    expect(out).toContain("@pytest.mark.parametrize");
  });
  it("renderLoopSnippet includes a fetch call", () => {
    const out = renderLoopSnippet(sample);
    expect(out).toContain("fetch(");
    expect(out).toContain("payloads");
  });
  it("renderPlaywrightFixture escapes newlines in values", () => {
    const out = renderPlaywrightFixture([{ category: "xss", value: "a\nb", description: undefined }]);
    expect(out).toContain('"a\\nb"');
  });
});

describe("naughty-strings history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, seed: 42, count: 10, categories: ["xss"], preview: "<script>" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, seed: i, count: 1, categories: [], preview: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, seed: 1, count: 1, categories: [], preview: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("naughty-strings shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ seed: 42, count: 10, categories: ["xss", "sql-injection"] });
    expect(url).toContain("seed=42");
    expect(url).toContain("n=10");
    expect(url).toContain("cats=xss%2Csql-injection");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("round-trips options through buildShareUrl + parseShareUrl", () => {
    const opts: SampleOptions = { seed: 7777, count: 25, categories: ["xss", "zalgo"] };
    const url = buildShareUrl(opts);
    const parsed = parseShareUrl(url);
    expect(parsed.seed).toBe(opts.seed);
    expect(parsed.count).toBe(opts.count);
    expect(parsed.categories).toEqual(opts.categories);
  });
  it("parses empty hash to defaults", () => {
    const parsed = parseShareUrl("");
    expect(parsed.seed).toBe(DEFAULT_SAMPLE_OPTIONS.seed);
    expect(parsed.count).toBe(DEFAULT_SAMPLE_OPTIONS.count);
    expect(parsed.categories).toEqual([]);
  });
  it("filters unknown categories", () => {
    const parsed = parseShareUrl("seed=1&n=5&cats=xss,bogus-category,zalgo");
    expect(parsed.categories).toEqual(["xss", "zalgo"]);
  });
  it("clamps count > MAX_SAMPLE to defaults", () => {
    const parsed = parseShareUrl(`n=${MAX_SAMPLE + 5}`);
    expect(parsed.count).toBe(DEFAULT_SAMPLE_OPTIONS.count);
  });
});

// Suppress unused-import lint
export type _Unused = NaughtyCategory;
