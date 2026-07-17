import { describe, it, expect, beforeEach } from "vitest";
import {
  tokenizeWords,
  buildFrequency,
  freqToSortedArray,
  computeOverlap,
  analyzeGap,
  renderCsv,
  renderMarkdown,
  buildVisualDiff,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  STOP_WORDS,
  TOP_LIMIT,
  type CompetitorContent,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
});

describe("content-gap-analyzer tokenizeWords", () => {
  it("returns empty for empty", () => {
    expect(tokenizeWords("")).toEqual([]);
  });
  it("splits and lowercases", () => {
    expect(tokenizeWords("Hello, WORLD!")).toEqual(["hello", "world"]);
  });
});

describe("content-gap-analyzer buildFrequency", () => {
  it("returns empty map for empty text", () => {
    expect(buildFrequency("").size).toBe(0);
  });
  it("counts word frequencies", () => {
    const f = buildFrequency("cat cat dog", false);
    expect(f.get("cat")).toBe(2);
    expect(f.get("dog")).toBe(1);
  });
  it("excludes stop words by default", () => {
    const f = buildFrequency("the cat the dog");
    expect(f.has("the")).toBe(false);
    expect(f.get("cat")).toBe(1);
  });
  it("includes stop words when excludeStopWords=false", () => {
    const f = buildFrequency("the cat", false);
    expect(f.get("the")).toBe(1);
  });
  it("excludes custom words", () => {
    const f = buildFrequency("cat dog bird", false, ["cat"]);
    expect(f.has("cat")).toBe(false);
    expect(f.get("dog")).toBe(1);
  });
  it("skips 1-char words", () => {
    const f = buildFrequency("a bc def", false);
    expect(f.has("a")).toBe(false);
    expect(f.get("bc")).toBe(1);
  });
});

describe("content-gap-analyzer freqToSortedArray", () => {
  it("returns empty for empty map", () => {
    expect(freqToSortedArray(new Map())).toEqual([]);
  });
  it("sorts by count descending", () => {
    const m = new Map([["a", 1], ["b", 3], ["c", 2]]);
    const out = freqToSortedArray(m);
    expect(out[0].word).toBe("b");
    expect(out[1].word).toBe("c");
    expect(out[2].word).toBe("a");
  });
  it("respects limit", () => {
    const m = new Map([["a", 1], ["b", 2], ["c", 3], ["d", 4]]);
    expect(freqToSortedArray(m, 2)).toHaveLength(2);
  });
});

describe("content-gap-analyzer computeOverlap", () => {
  it("returns 0 for two empty sets", () => {
    expect(computeOverlap(new Set(), new Set())).toBe(0);
  });
  it("returns 100 for identical sets", () => {
    expect(computeOverlap(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(100);
  });
  it("returns 0 for disjoint sets", () => {
    expect(computeOverlap(new Set(["a"]), new Set(["b"]))).toBe(0);
  });
  it("returns percentage for partial overlap", () => {
    // intersection: 1 (cat). union: 3 (cat, dog, bird). 1/3 = 33.33%
    const pct = computeOverlap(new Set(["cat", "dog"]), new Set(["cat", "bird"]));
    expect(pct).toBeCloseTo(33.33, 1);
  });
});

describe("content-gap-analyzer analyzeGap", () => {
  const yours = "cat dog bird fish";
  const competitors: CompetitorContent[] = [
    { label: "Comp 1", text: "cat dog elephant fox" },
    { label: "Comp 2", text: "cat elephant giraffe horse" },
  ];

  it("returns zero stats for empty content", () => {
    const r = analyzeGap("", []);
    expect(r.yourWordCount).toBe(0);
    expect(r.gaps).toEqual([]);
    expect(r.unique).toEqual([]);
  });
  it("counts your words", () => {
    const r = analyzeGap(yours, [], { excludeStopWords: false });
    expect(r.yourWordCount).toBe(4);
  });
  it("counts competitor words", () => {
    const r = analyzeGap(yours, competitors, { excludeStopWords: false });
    expect(r.competitorWordCounts["Comp 1"]).toBe(4);
    expect(r.competitorWordCounts["Comp 2"]).toBe(4);
  });
  it("computes overlap percentage", () => {
    const r = analyzeGap(yours, competitors, { excludeStopWords: false });
    expect(r.overlapPercentage).toBeGreaterThan(0);
    expect(r.overlapPercentage).toBeLessThanOrEqual(100);
  });
  it("finds gaps (in competitors not in yours)", () => {
    const r = analyzeGap(yours, competitors, { excludeStopWords: false });
    const gapWords = r.gaps.map((g) => g.word);
    expect(gapWords).toContain("elephant");
    expect(gapWords).toContain("fox");
    expect(gapWords).toContain("giraffe");
    expect(gapWords).toContain("horse");
  });
  it("gaps do not include words in your content", () => {
    const r = analyzeGap(yours, competitors, { excludeStopWords: false });
    const gapWords = r.gaps.map((g) => g.word);
    expect(gapWords).not.toContain("cat");
    expect(gapWords).not.toContain("dog");
  });
  it("finds unique keywords (in yours not in competitors)", () => {
    const r = analyzeGap(yours, competitors, { excludeStopWords: false });
    const uniqueWords = r.unique.map((u) => u.word);
    expect(uniqueWords).toContain("bird");
    expect(uniqueWords).toContain("fish");
  });
  it("finds shared keywords", () => {
    const r = analyzeGap(yours, competitors, { excludeStopWords: false });
    const sharedWords = r.shared.map((s) => s.word);
    expect(sharedWords).toContain("cat");
    expect(sharedWords).toContain("dog");
  });
  it("calculates priority for gaps", () => {
    const r = analyzeGap(yours, competitors, { excludeStopWords: false });
    const elephant = r.gaps.find((g) => g.word === "elephant");
    expect(elephant).toBeDefined();
    expect(elephant?.priority).toBeGreaterThan(0);
    expect(elephant?.competitors).toHaveLength(2);
  });
  it("computes total unique across all", () => {
    const r = analyzeGap(yours, competitors, { excludeStopWords: false });
    expect(r.totalUniqueAcrossAll).toBeGreaterThan(0);
  });
  it("respects stop word filtering", () => {
    const r = analyzeGap("the cat the dog", [{ label: "C", text: "the bird" }], { excludeStopWords: true });
    expect(r.gaps.find((g) => g.word === "the")).toBeUndefined();
  });
  it("respects custom exclude", () => {
    const r = analyzeGap("cat dog", [{ label: "C", text: "cat bird" }], {
      excludeStopWords: false,
      customExclude: ["bird"],
    });
    expect(r.gaps.find((g) => g.word === "bird")).toBeUndefined();
  });
});

describe("content-gap-analyzer renderCsv", () => {
  it("returns header for empty result", () => {
    const csv = renderCsv({
      yourWordCount: 0,
      competitorWordCounts: {},
      overlapPercentage: 0,
      gaps: [],
      unique: [],
      shared: [],
      totalUniqueAcrossAll: 0,
    });
    expect(csv.startsWith("category,word")).toBe(true);
  });
  it("includes gap rows", () => {
    const csv = renderCsv({
      yourWordCount: 10,
      competitorWordCounts: {},
      overlapPercentage: 50,
      gaps: [{ word: "foo", competitors: ["C1"], totalCompetitorCount: 3, priority: 50 }],
      unique: [],
      shared: [],
      totalUniqueAcrossAll: 5,
    });
    expect(csv).toContain("gap,foo,0,3");
  });
  it("escapes commas in words", () => {
    const csv = renderCsv({
      yourWordCount: 10,
      competitorWordCounts: {},
      overlapPercentage: 50,
      gaps: [{ word: "foo,bar", competitors: ["C1"], totalCompetitorCount: 1, priority: 25 }],
      unique: [],
      shared: [],
      totalUniqueAcrossAll: 5,
    });
    expect(csv).toContain('"foo,bar"');
  });
});

describe("content-gap-analyzer renderMarkdown", () => {
  it("produces a markdown report with title", () => {
    const r = analyzeGap("cat dog", [{ label: "C", text: "cat bird" }], { excludeStopWords: false });
    const md = renderMarkdown("cat dog", [{ label: "C", text: "cat bird" }], r);
    expect(md).toContain("# Content Gap Analysis Report");
    expect(md).toContain("**Your content word count");
    expect(md).toContain("## Gap keywords");
    expect(md).toContain("## Unique keywords");
    expect(md).toContain("## Shared keywords");
  });
  it("includes 'No gaps found' when no gaps", () => {
    const r = analyzeGap("cat dog bird", [{ label: "C", text: "cat dog" }], { excludeStopWords: false });
    const md = renderMarkdown("cat dog bird", [{ label: "C", text: "cat dog" }], r);
    expect(md).toContain("No gaps found");
  });
});

describe("content-gap-analyzer buildVisualDiff", () => {
  it("returns counts and overlap", () => {
    const r = analyzeGap("cat dog", [{ label: "C", text: "cat bird" }], { excludeStopWords: false });
    const diff = buildVisualDiff(r);
    expect(diff.gaps).toBe(r.gaps.length);
    expect(diff.unique).toBe(r.unique.length);
    expect(diff.shared).toBe(r.shared.length);
    expect(diff.overlapPct).toBe(r.overlapPercentage);
  });
});

describe("content-gap-analyzer constants", () => {
  it("has STOP_WORDS set", () => {
    expect(STOP_WORDS.has("the")).toBe(true);
  });
  it("has TOP_LIMIT of 50", () => {
    expect(TOP_LIMIT).toBe(50);
  });
});

describe("content-gap-analyzer history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, yourWordCount: 100, competitorCount: 2, gapCount: 10, uniqueCount: 5, snippet: "x" });
    saveHistory({ ts: 2, yourWordCount: 200, competitorCount: 3, gapCount: 20, uniqueCount: 8, snippet: "y" });
    expect(loadHistory()).toHaveLength(2);
    expect(loadHistory()[0].yourWordCount).toBe(200);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, yourWordCount: 1, competitorCount: 1, gapCount: 1, uniqueCount: 1, snippet: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, yourWordCount: 1, competitorCount: 1, gapCount: 1, uniqueCount: 1, snippet: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("content-gap-analyzer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("my text", [{ label: "Comp 1", text: "comp text" }]);
    expect(url).toContain("yours=");
    expect(url).toContain("c0_label=Comp+1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to inputs", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("my text", [
      { label: "Comp 1", text: "comp text 1" },
      { label: "Comp 2", text: "comp text 2" },
    ]);
    const hash = url.replace(/^\?/, "#");
    const parsed = parseShareUrl(hash);
    expect(parsed.yours).toBe("my text");
    expect(parsed.competitors).toHaveLength(2);
    expect(parsed.competitors[0].label).toBe("Comp 1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("returns empty competitors for empty hash", () => {
    expect(parseShareUrl("")).toEqual({ competitors: [] });
  });
});
