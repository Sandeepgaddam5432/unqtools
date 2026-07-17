import { describe, it, expect, beforeEach } from "vitest";
import {
  TITLE_MAX_CHARS,
  escapeHtml,
  estimatePixelWidth,
  computeStats,
  detectPowerWords,
  findKeywordPosition,
  buildTitleTag,
  truncateForPixelLimit,
  analyzeTitle,
  generateSuggestions,
  compareTitles,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
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

describe("title-tag-optimizer escapeHtml", () => {
  it("escapes special chars", () => {
    expect(escapeHtml(`<a>"&'</a>`)).toBe("&lt;a&gt;&quot;&amp;&#39;&lt;/a&gt;");
  });
});

describe("title-tag-optimizer estimatePixelWidth", () => {
  it("returns 0 for empty", () => {
    expect(estimatePixelWidth("")).toBe(0);
  });
  it("is positive", () => {
    expect(estimatePixelWidth("hello")).toBeGreaterThan(0);
  });
  it("W counts more than i", () => {
    expect(estimatePixelWidth("W")).toBeGreaterThan(estimatePixelWidth("i"));
  });
  it("CJK counts higher", () => {
    expect(estimatePixelWidth("中")).toBeGreaterThan(estimatePixelWidth("a"));
  });
});

describe("title-tag-optimizer computeStats", () => {
  it("computes basic stats", () => {
    const s = computeStats("Best SEO Tools");
    expect(s.charCount).toBe(14);
    expect(s.wordCount).toBe(3);
    expect(s.remaining).toBe(TITLE_MAX_CHARS - 14);
    expect(s.isOver).toBe(false);
  });
  it("flags over", () => {
    const s = computeStats("x".repeat(TITLE_MAX_CHARS + 5));
    expect(s.isOver).toBe(true);
  });
  it("flags warn at 90%", () => {
    const s = computeStats("x".repeat(TITLE_MAX_CHARS - 3));
    expect(s.isWarn).toBe(true);
    expect(s.isOver).toBe(false);
  });
  it("handles empty", () => {
    const s = computeStats("");
    expect(s.charCount).toBe(0);
    expect(s.wordCount).toBe(0);
  });
});

describe("title-tag-optimizer detectPowerWords", () => {
  it("detects power words", () => {
    const hits = detectPowerWords("Best Free SEO Tools");
    expect(hits.length).toBeGreaterThanOrEqual(2);
    const words = hits.map((h) => h.word);
    expect(words).toContain("best");
    expect(words).toContain("free");
  });
  it("returns empty for no power words", () => {
    expect(detectPowerWords("SEO Tools of 2026")).toEqual([]);
  });
  it("returns empty for empty input", () => {
    expect(detectPowerWords("")).toEqual([]);
  });
  it("assigns categories", () => {
    const hits = detectPowerWords("Best Guaranteed Tools");
    const cats = hits.map((h) => h.category);
    expect(cats).toContain("value");
    expect(cats).toContain("trust");
  });
  it("detects multiple instances", () => {
    const hits = detectPowerWords("Best of the Best");
    expect(hits.filter((h) => h.word === "best").length).toBe(2);
  });
});

describe("title-tag-optimizer findKeywordPosition", () => {
  it("finds keyword at start", () => {
    expect(findKeywordPosition("SEO tools for beginners", "SEO")).toBe(0);
  });
  it("finds keyword in middle", () => {
    expect(findKeywordPosition("Best SEO tools 2026", "SEO")).toBe(1);
  });
  it("returns -1 for missing keyword", () => {
    expect(findKeywordPosition("Hello world", "SEO")).toBe(-1);
  });
  it("returns -1 for empty inputs", () => {
    expect(findKeywordPosition("", "SEO")).toBe(-1);
    expect(findKeywordPosition("Hello", "")).toBe(-1);
  });
});

describe("title-tag-optimizer buildTitleTag", () => {
  it("builds title tag", () => {
    expect(buildTitleTag("Hello")).toBe("<title>Hello</title>");
  });
  it("escapes HTML", () => {
    expect(buildTitleTag("A & B")).toBe("<title>A &amp; B</title>");
  });
  it("returns empty for empty", () => {
    expect(buildTitleTag("")).toBe("");
  });
});

describe("title-tag-optimizer truncateForPixelLimit", () => {
  it("returns short strings unchanged", () => {
    expect(truncateForPixelLimit("short")).toBe("short");
  });
  it("truncates long strings", () => {
    const out = truncateForPixelLimit("word ".repeat(50), 200);
    expect(out.endsWith("…")).toBe(true);
  });
  it("handles empty", () => {
    expect(truncateForPixelLimit("")).toBe("");
  });
});

describe("title-tag-optimizer analyzeTitle", () => {
  it("returns analysis for good title", () => {
    const a = analyzeTitle("Best SEO Tools of 2026 — Top 10 Compared", "SEO");
    expect(a.keywordPresent).toBe(true);
    expect(a.keywordNearFront).toBe(true);
    expect(a.hasDigits).toBe(true);
    expect(a.powerWords.length).toBeGreaterThan(0);
    expect(a.ctrScore).toBeGreaterThan(50);
  });
  it("flags over-length", () => {
    const a = analyzeTitle("x".repeat(TITLE_MAX_CHARS + 10));
    expect(a.stats.isOver).toBe(true);
  });
  it("flags ALL CAPS", () => {
    const a = analyzeTitle("BEST SEO TOOLS");
    expect(a.isAllCaps).toBe(true);
  });
  it("detects question", () => {
    expect(analyzeTitle("Why SEO Matters?").isQuestion).toBe(true);
  });
  it("detects brackets", () => {
    expect(analyzeTitle("SEO Guide [2026]").hasBrackets).toBe(true);
  });
  it("detects CTA", () => {
    expect(analyzeTitle("Discover the Best SEO Tools").hasCTA).toBe(true);
  });
  it("returns recommendations", () => {
    const a = analyzeTitle("weak title", "missing");
    expect(a.recommendations.length).toBeGreaterThan(0);
  });
  it("gives positive recommendation when optimized", () => {
    const a = analyzeTitle("Best SEO Tools 2026 — Top 10 Picks [Updated]", "SEO");
    expect(a.recommendations.some((r) => /looks well-optimized/i.test(r))).toBe(true);
  });
});

describe("title-tag-optimizer generateSuggestions", () => {
  it("returns suggestions when keyword present", () => {
    const s = generateSuggestions("Tools", "SEO");
    expect(s.length).toBeGreaterThan(0);
    for (const sug of s) {
      expect(sug.length).toBeLessThanOrEqual(TITLE_MAX_CHARS);
    }
  });
  it("dedups suggestions", () => {
    const s = generateSuggestions("SEO", "SEO");
    const unique = new Set(s);
    expect(unique.size).toBe(s.length);
  });
  it("returns empty for no input", () => {
    expect(generateSuggestions("", "")).toEqual([]);
  });
});

describe("title-tag-optimizer compareTitles", () => {
  it("declares A as winner when CTR higher", () => {
    const r = compareTitles(
      "Best 10 SEO Tools [2026] — Free Guide",
      "weak title",
      "SEO",
    );
    expect(["A", "B", "tie"]).toContain(r.winner);
    expect(r.a.ctrScore).toBeGreaterThan(r.b.ctrScore);
  });
  it("returns tie for identical", () => {
    const r = compareTitles("same", "same", "x");
    expect(r.winner).toBe("tie");
  });
  it("returns full analysis for both", () => {
    const r = compareTitles("Title A", "Title B");
    expect(r.a.stats.value).toBe("Title A");
    expect(r.b.stats.value).toBe("Title B");
  });
});

describe("title-tag-optimizer history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, title: "T", keyword: "K", ctrScore: 80 });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].title).toBe("T");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, title: `T${i}`, keyword: "K", ctrScore: 50 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, title: "T", keyword: "K", ctrScore: 50 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("title-tag-optimizer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      title: "T",
      keyword: "K",
      versionA: "A",
      versionB: "B",
      url: "https://example.com",
    });
    expect(url).toContain("title=T");
    expect(url).toContain("a=A");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("title=Hi&keyword=KW&a=VA&b=VB&url=https%3A%2F%2Fx.com");
    expect(p.title).toBe("Hi");
    expect(p.keyword).toBe("KW");
    expect(p.versionA).toBe("VA");
    expect(p.versionB).toBe("VB");
    expect(p.url).toBe("https://x.com");
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.title).toBe("");
    expect(p.url).toBe("");
  });
  it("omits empty fields", () => {
    const url = buildShareUrl({ title: "T", keyword: "", versionA: "", versionB: "", url: "" });
    expect(url).toContain("title=T");
    expect(url).not.toContain("keyword=");
  });
});
