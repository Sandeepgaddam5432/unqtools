import { describe, it, expect, beforeEach } from "vitest";
import {
  tokenizeWords,
  generatePhrases,
  phraseHasStopWord,
  countPhrases,
  filterPhrases,
  detectStuffing,
  analyze,
  renderCsv,
  generateCloudData,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  STOP_WORDS,
  STUFFING_THRESHOLD,
  TOP_LIMIT,
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

describe("keyword-density-analyzer tokenizeWords", () => {
  it("returns empty for empty", () => {
    expect(tokenizeWords("")).toEqual([]);
  });
  it("splits and lowercases", () => {
    expect(tokenizeWords("Hello, WORLD!")).toEqual(["hello", "world"]);
  });
});

describe("keyword-density-analyzer generatePhrases", () => {
  it("returns empty for empty words", () => {
    expect(generatePhrases([], 1)).toEqual([]);
  });
  it("generates 1-word phrases (identity)", () => {
    expect(generatePhrases(["a", "b", "c"], 1)).toEqual(["a", "b", "c"]);
  });
  it("generates 2-word phrases", () => {
    expect(generatePhrases(["a", "b", "c"], 2)).toEqual(["a b", "b c"]);
  });
  it("generates 3-word phrases", () => {
    expect(generatePhrases(["a", "b", "c", "d"], 3)).toEqual(["a b c", "b c d"]);
  });
  it("returns empty when n > words length", () => {
    expect(generatePhrases(["a"], 2)).toEqual([]);
  });
  it("returns empty for n < 1", () => {
    expect(generatePhrases(["a"], 0)).toEqual([]);
  });
});

describe("keyword-density-analyzer phraseHasStopWord", () => {
  it("returns true for phrase with stop word", () => {
    expect(phraseHasStopWord("the cat")).toBe(true);
    expect(phraseHasStopWord("cat the dog")).toBe(true);
  });
  it("returns false for phrase without stop words", () => {
    expect(phraseHasStopWord("cat dog")).toBe(false);
  });
});

describe("keyword-density-analyzer countPhrases", () => {
  it("returns empty for empty input", () => {
    expect(countPhrases([])).toEqual([]);
  });
  it("counts and sorts desc by count", () => {
    const out = countPhrases(["a", "b", "a", "c", "a", "b"]);
    expect(out[0].phrase).toBe("a");
    expect(out[0].count).toBe(3);
    expect(out[1].phrase).toBe("b");
    expect(out[1].count).toBe(2);
  });
  it("respects limit", () => {
    const out = countPhrases(["a", "b", "c", "d", "e"], 3);
    expect(out.length).toBeLessThanOrEqual(3);
  });
  it("computes density as percentage", () => {
    const out = countPhrases(["a", "a", "b"]);
    expect(out[0].density).toBeCloseTo(66.67, 1);
  });
});

describe("keyword-density-analyzer filterPhrases", () => {
  it("returns all when no filtering", () => {
    expect(filterPhrases(["a", "b"], false)).toEqual(["a", "b"]);
  });
  it("filters stop words", () => {
    const out = filterPhrases(["the", "cat", "dog"], true);
    expect(out).toEqual(["cat", "dog"]);
  });
  it("filters custom exclude list", () => {
    const out = filterPhrases(["cat", "dog", "bird"], false, ["cat"]);
    expect(out).toEqual(["dog", "bird"]);
  });
  it("filters both stop words and custom", () => {
    const out = filterPhrases(["the", "cat", "dog"], true, ["dog"]);
    expect(out).toEqual(["cat"]);
  });
});

describe("keyword-density-analyzer detectStuffing", () => {
  it("returns empty when all under threshold", () => {
    const hits = [{ phrase: "a", count: 5, density: 2 }];
    expect(detectStuffing(hits)).toEqual([]);
  });
  it("flags phrases over threshold", () => {
    const hits = [{ phrase: "spam", count: 50, density: 10 }];
    const out = detectStuffing(hits);
    expect(out.length).toBe(1);
    expect(out[0]).toContain("spam");
  });
  it("respects custom threshold", () => {
    const hits = [{ phrase: "a", count: 5, density: 2 }];
    expect(detectStuffing(hits, 1).length).toBe(1);
  });
});

describe("keyword-density-analyzer analyze", () => {
  it("returns zero stats for empty text", () => {
    const r = analyze("");
    expect(r.totalWords).toBe(0);
    expect(r.oneWord).toEqual([]);
  });
  it("counts total and unique words", () => {
    const r = analyze("cat cat dog");
    expect(r.totalWords).toBe(3);
    expect(r.uniqueWords).toBe(2);
  });
  it("produces 1-word, 2-word, 3-word arrays", () => {
    const r = analyze("the cat sat on the mat the cat ran");
    expect(Array.isArray(r.oneWord)).toBe(true);
    expect(Array.isArray(r.twoWord)).toBe(true);
    expect(Array.isArray(r.threeWord)).toBe(true);
  });
  it("excludes stop words by default in 1-word", () => {
    const r = analyze("the cat the dog");
    expect(r.oneWord.find((h) => h.phrase === "the")).toBeUndefined();
  });
  it("includes stop words when excludeStopWords=false", () => {
    const r = analyze("the cat the dog", { excludeStopWords: false });
    expect(r.oneWord.find((h) => h.phrase === "the")).toBeDefined();
  });
  it("respects custom exclude list", () => {
    const r = analyze("cat dog bird", { customExclude: ["cat"] });
    expect(r.oneWord.find((h) => h.phrase === "cat")).toBeUndefined();
  });
  it("detects stuffing in 1-word", () => {
    // Repeat "spam" many times to push density above 3%
    const r = analyze(Array.from({ length: 50 }, () => "spam").join(" ") + " cat dog");
    expect(r.stuffingWarnings.length).toBeGreaterThan(0);
    expect(r.stuffingWarnings.some((w) => w.includes("spam"))).toBe(true);
  });
  it("respects limit option", () => {
    const r = analyze("a b c d e f g h i j k l m n o", { limit: 5 });
    expect(r.oneWord.length).toBeLessThanOrEqual(5);
  });
});

describe("keyword-density-analyzer renderCsv", () => {
  it("returns header for empty result", () => {
    const csv = renderCsv({ totalWords: 0, uniqueWords: 0, oneWord: [], twoWord: [], threeWord: [], stuffingWarnings: [] });
    expect(csv.startsWith("type,phrase,count,density_percent")).toBe(true);
  });
  it("includes rows for each hit", () => {
    const csv = renderCsv({
      totalWords: 10,
      uniqueWords: 5,
      oneWord: [{ phrase: "cat", count: 3, density: 30 }],
      twoWord: [],
      threeWord: [],
      stuffingWarnings: [],
    });
    expect(csv).toContain("1-word,cat,3,30.00");
  });
  it("escapes commas in phrases", () => {
    const csv = renderCsv({
      totalWords: 10,
      uniqueWords: 5,
      oneWord: [{ phrase: "hello,world", count: 1, density: 10 }],
      twoWord: [],
      threeWord: [],
      stuffingWarnings: [],
    });
    expect(csv).toContain('"hello,world"');
  });
});

describe("keyword-density-analyzer generateCloudData", () => {
  it("returns empty for empty input", () => {
    expect(generateCloudData([])).toEqual([]);
  });
  it("maps hits to cloud data", () => {
    const out = generateCloudData([{ phrase: "cat", count: 5, density: 10 }]);
    expect(out[0].text).toBe("cat");
    expect(out[0].value).toBe(5);
  });
});

describe("keyword-density-analyzer constants", () => {
  it("has STOP_WORDS set", () => {
    expect(STOP_WORDS.has("the")).toBe(true);
  });
  it("has 3% stuffing threshold", () => {
    expect(STUFFING_THRESHOLD).toBe(3);
  });
  it("has top limit of 20", () => {
    expect(TOP_LIMIT).toBe(20);
  });
});

describe("keyword-density-analyzer history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, wordCount: 100, uniqueWords: 50, stuffingWarnings: 1, snippet: "x" });
    saveHistory({ ts: 2, wordCount: 200, uniqueWords: 80, stuffingWarnings: 0, snippet: "y" });
    expect(loadHistory()).toHaveLength(2);
    expect(loadHistory()[0].wordCount).toBe(200);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, wordCount: 1, uniqueWords: 1, stuffingWarnings: 0, snippet: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, wordCount: 1, uniqueWords: 1, stuffingWarnings: 0, snippet: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("keyword-density-analyzer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("hello world");
    expect(url).toContain("text=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to text", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("hello world");
    const hash = url.replace(/^\?/, "#");
    const parsed = parseShareUrl(hash);
    expect(parsed.text).toBe("hello world");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
});
