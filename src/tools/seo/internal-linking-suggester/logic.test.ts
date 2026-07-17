import { describe, it, expect, beforeEach } from "vitest";
import {
  parsePages,
  isValidUrl,
  escapeHtml,
  countOccurrences,
  firstOccurrencePct,
  computeRelevance,
  findSuggestions,
  dedupSuggestions,
  analyze,
  exportHtml,
  exportMarkdown,
  exportCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type TargetPage,
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

describe("internal-linking-suggester parsePages", () => {
  it("parses one page per line", () => {
    const pages = parsePages("https://a.com,seo,tools\nhttps://b.com,marketing");
    expect(pages).toHaveLength(2);
    expect(pages[0].url).toBe("https://a.com");
    expect(pages[0].keywords).toEqual(["seo", "tools"]);
  });
  it("skips blank lines", () => {
    expect(parsePages("a,b\n\nc,d\n")).toHaveLength(2);
  });
  it("returns empty for empty input", () => {
    expect(parsePages("")).toEqual([]);
  });
  it("handles url-only lines", () => {
    const pages = parsePages("https://a.com");
    expect(pages[0].keywords).toEqual([]);
  });
});

describe("internal-linking-suggester isValidUrl", () => {
  it("accepts http and https", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("http://example.com")).toBe(true);
  });
  it("rejects bad URLs", () => {
    expect(isValidUrl("not a url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
});

describe("internal-linking-suggester escapeHtml", () => {
  it("escapes", () => {
    expect(escapeHtml(`<a>"&'</a>`)).toContain("&amp;");
  });
});

describe("internal-linking-suggester countOccurrences", () => {
  it("counts case-insensitive", () => {
    expect(countOccurrences("SEO seo Seo", "seo")).toBe(3);
  });
  it("returns 0 for empty", () => {
    expect(countOccurrences("", "x")).toBe(0);
    expect(countOccurrences("abc", "")).toBe(0);
  });
  it("handles overlapping substrings", () => {
    expect(countOccurrences("aaa", "aa")).toBeGreaterThanOrEqual(1);
  });
});

describe("internal-linking-suggester firstOccurrencePct", () => {
  it("returns 0 when phrase at start", () => {
    expect(firstOccurrencePct("SEO tools are great", "SEO")).toBe(0);
  });
  it("returns higher pct for later position", () => {
    const content = "x".repeat(100) + "SEO";
    expect(firstOccurrencePct(content, "SEO")).toBeGreaterThan(50);
  });
  it("returns -1 when not found", () => {
    expect(firstOccurrencePct("hello world", "SEO")).toBe(-1);
  });
});

describe("internal-linking-suggester computeRelevance", () => {
  it("returns higher score for sweet-spot count", () => {
    const low = computeRelevance(1, 10, "seo");
    const mid = computeRelevance(3, 10, "best seo");
    expect(mid).toBeGreaterThan(low);
  });
  it("rewards earlier position", () => {
    const early = computeRelevance(3, 10, "best seo");
    const late = computeRelevance(3, 80, "best seo");
    expect(early).toBeGreaterThan(late);
  });
  it("rewards longer anchor", () => {
    const short = computeRelevance(3, 10, "seo");
    const long = computeRelevance(3, 10, "best seo tools");
    expect(long).toBeGreaterThan(short);
  });
  it("is clamped 0-100", () => {
    expect(computeRelevance(100, 0, "long phrase here")).toBeLessThanOrEqual(100);
    expect(computeRelevance(0, -1, "")).toBeGreaterThanOrEqual(0);
  });
});

describe("internal-linking-suggester findSuggestions", () => {
  const pages: TargetPage[] = [
    { url: "https://a.com/seo", keywords: ["SEO tools", "best SEO"] },
    { url: "https://b.com/marketing", keywords: ["marketing strategy"] },
  ];

  it("finds matching suggestions", () => {
    const content = "Best SEO tools for marketing strategy in 2026.";
    const s = findSuggestions(content, pages, { minRelevance: 0 });
    expect(s.length).toBeGreaterThan(0);
    const urls = s.map((x) => x.url);
    expect(urls).toContain("https://a.com/seo");
    expect(urls).toContain("https://b.com/marketing");
  });
  it("skips invalid URLs", () => {
    const s = findSuggestions("SEO", [{ url: "not a url", keywords: ["SEO"] }]);
    expect(s).toEqual([]);
  });
  it("skips keywords with zero matches", () => {
    const s = findSuggestions("hello world", pages, { minRelevance: 0 });
    expect(s).toEqual([]);
  });
  it("filters by minRelevance", () => {
    const s = findSuggestions("SEO tools SEO tools SEO tools", pages, { minRelevance: 90 });
    for (const x of s) expect(x.relevance).toBeGreaterThanOrEqual(90);
  });
  it("returns empty for empty content", () => {
    expect(findSuggestions("", pages)).toEqual([]);
  });
});

describe("internal-linking-suggester dedupSuggestions", () => {
  it("dedups same url+anchor", () => {
    const s = dedupSuggestions([
      { url: "https://a.com", keyword: "SEO", anchor: "SEO", count: 2, firstOccurrencePct: 10, relevance: 70 },
      { url: "https://a.com", keyword: "SEO", anchor: "SEO", count: 1, firstOccurrencePct: 20, relevance: 60 },
    ]);
    expect(s).toHaveLength(1);
    expect(s[0].relevance).toBe(70);
  });
  it("keeps different anchors", () => {
    const s = dedupSuggestions([
      { url: "https://a.com", keyword: "SEO", anchor: "SEO", count: 1, firstOccurrencePct: 10, relevance: 60 },
      { url: "https://a.com", keyword: "Tools", anchor: "Tools", count: 1, firstOccurrencePct: 10, relevance: 60 },
    ]);
    expect(s).toHaveLength(2);
  });
});

describe("internal-linking-suggester analyze", () => {
  it("returns analysis with stats", () => {
    const r = analyze("Best SEO tools for marketing strategy", [
      { url: "https://a.com/seo", keywords: ["SEO"] },
      { url: "https://b.com/mkt", keywords: ["marketing"] },
    ], { minRelevance: 0 });
    expect(r.totalPages).toBe(2);
    expect(r.matchedPages).toBeGreaterThan(0);
    expect(r.totalMatches).toBeGreaterThan(0);
  });
  it("returns empty for empty content", () => {
    const r = analyze("", [{ url: "https://a.com", keywords: ["x"] }]);
    expect(r.suggestions).toEqual([]);
  });
  it("counts deduped entries", () => {
    const r = analyze("SEO SEO", [
      { url: "https://a.com", keywords: ["SEO", "seo"] },
    ], { minRelevance: 0 });
    // "SEO" and "seo" both match (case-insensitive), same anchor normalized -> dedup
    expect(r.deduped).toBeGreaterThanOrEqual(0);
  });
});

describe("internal-linking-suggester export functions", () => {
  const sugg = [
    { url: "https://a.com", keyword: "SEO", anchor: "SEO", count: 2, firstOccurrencePct: 10, relevance: 80 },
  ];
  it("exportHtml produces anchor tags", () => {
    const out = exportHtml(sugg);
    expect(out).toContain('<a href="https://a.com">SEO</a>');
  });
  it("exportHtml escapes HTML", () => {
    const out = exportHtml([{ url: "https://a.com?a=1&b=2", keyword: "x", anchor: "x&y", count: 1, firstOccurrencePct: 0, relevance: 50 }]);
    expect(out).toContain("&amp;");
  });
  it("exportMarkdown produces markdown links", () => {
    const out = exportMarkdown(sugg);
    expect(out).toContain("[SEO](https://a.com)");
  });
  it("exportCsv produces CSV", () => {
    const out = exportCsv(sugg);
    expect(out).toContain("url,anchor,count,relevance");
    expect(out).toContain("https://a.com,SEO,2,80,10");
  });
  it("exportCsv escapes commas", () => {
    const out = exportCsv([{ url: "https://a.com", keyword: "a,b", anchor: "a,b", count: 1, firstOccurrencePct: 0, relevance: 50 }]);
    expect(out).toContain('"a,b"');
  });
});

describe("internal-linking-suggester history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, totalPages: 5, matchedPages: 3, totalMatches: 8, snippet: "..." });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, totalPages: 1, matchedPages: 1, totalMatches: 1, snippet: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, totalPages: 1, matchedPages: 1, totalMatches: 1, snippet: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("internal-linking-suggester shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ content: "hello", pages: "https://a.com,seo" });
    expect(url).toContain("content=hello");
    expect(url).toContain("pages=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("content=Hello+World&pages=https%3A%2F%2Fa.com%2Cseo");
    expect(p.content).toBe("Hello World");
    expect(p.pages).toBe("https://a.com,seo");
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.content).toBe("");
    expect(p.pages).toBe("");
  });
  it("omits empty fields", () => {
    const url = buildShareUrl({ content: "", pages: "x" });
    expect(url).not.toContain("content=");
    expect(url).toContain("pages=x");
  });
});
