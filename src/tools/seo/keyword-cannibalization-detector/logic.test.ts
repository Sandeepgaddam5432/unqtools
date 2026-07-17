import { describe, it, expect, beforeEach } from "vitest";
import {
  parseEntries,
  normalizeKeyword,
  dedupEntries,
  detectClusters,
  buildReport,
  renderMarkdown,
  renderCsv,
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

describe("keyword-cannibalization-detector parseEntries", () => {
  it("parses url,keyword per line", () => {
    const entries = parseEntries("https://a.com,seo\nhttps://b.com,seo");
    expect(entries).toHaveLength(2);
    expect(entries[0].url).toBe("https://a.com");
    expect(entries[0].keyword).toBe("seo");
  });
  it("skips lines without comma", () => {
    expect(parseEntries("just-text\nhttps://a.com,seo")).toHaveLength(1);
  });
  it("handles blank lines", () => {
    expect(parseEntries("a,b\n\nc,d")).toHaveLength(2);
  });
  it("returns empty for empty input", () => {
    expect(parseEntries("")).toEqual([]);
  });
  it("handles keyword with commas inside", () => {
    const entries = parseEntries("https://a.com,best, cheap, fast");
    expect(entries[0].keyword).toBe("best, cheap, fast");
  });
});

describe("keyword-cannibalization-detector normalizeKeyword", () => {
  it("lowercases", () => {
    expect(normalizeKeyword("SEO Tools")).toBe("seo tools");
  });
  it("collapses whitespace", () => {
    expect(normalizeKeyword("seo   tools")).toBe("seo tools");
  });
  it("trims", () => {
    expect(normalizeKeyword("  seo  ")).toBe("seo");
  });
  it("handles empty", () => {
    expect(normalizeKeyword("")).toBe("");
  });
});

describe("keyword-cannibalization-detector dedupEntries", () => {
  it("removes identical pairs", () => {
    const { unique, removed } = dedupEntries([
      { url: "https://a.com", keyword: "SEO" },
      { url: "https://a.com", keyword: "seo" },
    ]);
    expect(unique).toHaveLength(1);
    expect(removed).toBe(1);
  });
  it("keeps different URLs", () => {
    const { unique } = dedupEntries([
      { url: "https://a.com", keyword: "SEO" },
      { url: "https://b.com", keyword: "SEO" },
    ]);
    expect(unique).toHaveLength(2);
  });
  it("keeps different keywords", () => {
    const { unique } = dedupEntries([
      { url: "https://a.com", keyword: "SEO" },
      { url: "https://a.com", keyword: "marketing" },
    ]);
    expect(unique).toHaveLength(2);
  });
});

describe("keyword-cannibalization-detector detectClusters", () => {
  it("finds 2-page cluster (medium)", () => {
    const clusters = detectClusters([
      { url: "https://a.com", keyword: "SEO" },
      { url: "https://b.com", keyword: "seo" },
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].severity).toBe("medium");
    expect(clusters[0].count).toBe(2);
  });
  it("finds 3-page cluster (high)", () => {
    const clusters = detectClusters([
      { url: "https://a.com", keyword: "SEO" },
      { url: "https://b.com", keyword: "SEO" },
      { url: "https://c.com", keyword: "SEO" },
    ]);
    expect(clusters[0].severity).toBe("high");
    expect(clusters[0].count).toBe(3);
  });
  it("does not flag single-page keywords", () => {
    const clusters = detectClusters([{ url: "https://a.com", keyword: "SEO" }]);
    expect(clusters).toEqual([]);
  });
  it("sorts by severity desc", () => {
    const clusters = detectClusters([
      { url: "https://a.com", keyword: "x" },
      { url: "https://b.com", keyword: "x" },
      { url: "https://c.com", keyword: "y" },
      { url: "https://d.com", keyword: "y" },
      { url: "https://e.com", keyword: "y" },
    ]);
    expect(clusters[0].severity).toBe("high");
    expect(clusters[0].keyword).toBe("y");
  });
  it("includes recommendation", () => {
    const clusters = detectClusters([
      { url: "https://a.com", keyword: "SEO" },
      { url: "https://b.com", keyword: "SEO" },
    ]);
    expect(clusters[0].recommendation.length).toBeGreaterThan(10);
  });
});

describe("keyword-cannibalization-detector buildReport", () => {
  it("builds full report with stats", () => {
    const r = buildReport([
      { url: "https://a.com", keyword: "SEO" },
      { url: "https://b.com", keyword: "SEO" },
      { url: "https://c.com", keyword: "marketing" },
    ]);
    expect(r.totalEntries).toBe(3);
    expect(r.uniqueKeywords).toBe(2);
    expect(r.mediumSeverityCount).toBe(1);
    expect(r.cleanEntries).toBe(1);
  });
  it("dedups before reporting", () => {
    const r = buildReport([
      { url: "https://a.com", keyword: "SEO" },
      { url: "https://a.com", keyword: "SEO" },
    ]);
    expect(r.totalEntries).toBe(1);
    expect(r.clusters).toEqual([]);
  });
  it("handles empty input", () => {
    const r = buildReport([]);
    expect(r.totalEntries).toBe(0);
    expect(r.clusters).toEqual([]);
  });
});

describe("keyword-cannibalization-detector renderMarkdown", () => {
  it("renders markdown header", () => {
    const md = renderMarkdown(buildReport([]));
    expect(md).toContain("# Keyword Cannibalization Report");
    expect(md).toContain("No cannibalization detected");
  });
  it("renders clusters", () => {
    const md = renderMarkdown(
      buildReport([
        { url: "https://a.com", keyword: "SEO" },
        { url: "https://b.com", keyword: "SEO" },
      ]),
    );
    expect(md).toContain("[MEDIUM]");
    expect(md).toContain('"seo"');
    expect(md).toContain("https://a.com");
  });
  it("includes recommendation", () => {
    const md = renderMarkdown(
      buildReport([
        { url: "https://a.com", keyword: "SEO" },
        { url: "https://b.com", keyword: "SEO" },
      ]),
    );
    expect(md).toContain("Recommendation");
  });
});

describe("keyword-cannibalization-detector renderCsv", () => {
  it("renders CSV header", () => {
    const csv = renderCsv(buildReport([]));
    expect(csv).toContain("keyword,severity,url_count,urls");
  });
  it("escapes commas in urls", () => {
    const csv = renderCsv(
      buildReport([
        { url: "https://a.com", keyword: "SEO" },
        { url: "https://b.com", keyword: "SEO" },
      ]),
    );
    expect(csv).toContain('"https://a.com, https://b.com"');
  });
});

describe("keyword-cannibalization-detector history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, totalEntries: 5, highSeverityCount: 1, mediumSeverityCount: 2, clusterCount: 3 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, totalEntries: 1, highSeverityCount: 0, mediumSeverityCount: 0, clusterCount: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, totalEntries: 1, highSeverityCount: 0, mediumSeverityCount: 0, clusterCount: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("keyword-cannibalization-detector shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("https://a.com,seo");
    expect(url).toContain("input=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("input=https%3A%2F%2Fa.com%2Cseo");
    expect(p.input).toBe("https://a.com,seo");
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.input).toBe("");
  });
  it("omits empty input", () => {
    const url = buildShareUrl("");
    expect(url).not.toContain("input=");
  });
});
