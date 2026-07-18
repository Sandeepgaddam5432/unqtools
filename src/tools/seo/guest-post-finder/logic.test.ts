import { describe, it, expect, beforeEach } from "vitest";
import {
  FOOTPRINTS,
  NICHE_PRESETS,
  CATEGORY_LABELS,
  normalizeNiche,
  parseNiches,
  buildGoogleUrl,
  generateForNiche,
  generateForNiches,
  computeStats,
  renderText,
  renderCsv,
  splitCsvRow,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type FootprintCategory,
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

describe("guest-post-finder constants", () => {
  it("has 32 footprints", () => {
    expect(FOOTPRINTS).toHaveLength(32);
  });
  it("has 5 write-for-us footprints", () => {
    expect(FOOTPRINTS.filter((f) => f.category === "write-for-us")).toHaveLength(5);
  });
  it("has 8 guest-post footprints", () => {
    expect(FOOTPRINTS.filter((f) => f.category === "guest-post")).toHaveLength(8);
  });
  it("has 6 contribute footprints", () => {
    expect(FOOTPRINTS.filter((f) => f.category === "contribute")).toHaveLength(6);
  });
  it("has 5 submit-article footprints", () => {
    expect(FOOTPRINTS.filter((f) => f.category === "submit-article")).toHaveLength(5);
  });
  it("has 4 become-contributor footprints", () => {
    expect(FOOTPRINTS.filter((f) => f.category === "become-contributor")).toHaveLength(4);
  });
  it("has 4 guest-column footprints", () => {
    expect(FOOTPRINTS.filter((f) => f.category === "guest-column")).toHaveLength(4);
  });
  it("has 6 category labels", () => {
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(6);
  });
  it("has niche presets", () => {
    expect(NICHE_PRESETS.length).toBeGreaterThanOrEqual(5);
    expect(NICHE_PRESETS).toContain("seo");
  });
});

describe("guest-post-finder normalizeNiche", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalizeNiche("  Best   SEO  ")).toBe("best seo");
  });
  it("handles empty", () => {
    expect(normalizeNiche("")).toBe("");
  });
});

describe("guest-post-finder parseNiches", () => {
  it("parses newline-separated", () => {
    expect(parseNiches("seo\nmarketing\ntech")).toEqual(["seo", "marketing", "tech"]);
  });
  it("parses comma-separated", () => {
    expect(parseNiches("seo, marketing, tech")).toEqual(["seo", "marketing", "tech"]);
  });
  it("skips blank entries", () => {
    expect(parseNiches("seo\n\nmarketing")).toEqual(["seo", "marketing"]);
  });
  it("returns empty for empty input", () => {
    expect(parseNiches("")).toEqual([]);
  });
});

describe("guest-post-finder buildGoogleUrl", () => {
  it("encodes query", () => {
    const url = buildGoogleUrl('seo "write for us"');
    expect(url).toContain("https://www.google.com/search?q=");
    expect(url).toContain(encodeURIComponent('seo "write for us"'));
  });
});

describe("guest-post-finder generateForNiche", () => {
  it("generates queries for a niche", () => {
    const queries = generateForNiche("seo");
    expect(queries).toHaveLength(32);
    expect(queries[0].niche).toBe("seo");
    expect(queries[0].query).toContain("seo");
    expect(queries[0].googleUrl).toContain("google.com");
  });
  it("generates queries for specific categories", () => {
    const queries = generateForNiche("seo", ["write-for-us", "guest-post"]);
    expect(queries).toHaveLength(13); // 5 + 8
    expect(queries.every((q) => q.category === "write-for-us" || q.category === "guest-post")).toBe(true);
  });
  it("returns empty for empty niche", () => {
    expect(generateForNiche("")).toEqual([]);
  });
  it("returns empty for empty categories when filter provided", () => {
    expect(generateForNiche("seo", [])).toEqual([]);
  });
  it("normalizes niche", () => {
    const queries = generateForNiche("  SEO  ");
    expect(queries[0].niche).toBe("seo");
  });
});

describe("guest-post-finder generateForNiches", () => {
  it("generates for multiple niches", () => {
    const queries = generateForNiches(["seo", "marketing"]);
    expect(queries).toHaveLength(64); // 32 × 2
    expect(queries.some((q) => q.niche === "seo")).toBe(true);
    expect(queries.some((q) => q.niche === "marketing")).toBe(true);
  });
  it("handles empty list", () => {
    expect(generateForNiches([])).toEqual([]);
  });
});

describe("guest-post-finder computeStats", () => {
  it("computes per-niche stats", () => {
    const queries = generateForNiches(["seo", "marketing"]);
    const stats = computeStats(queries);
    expect(stats).toHaveLength(2);
    expect(stats[0].queryCount).toBe(32);
    expect(stats[0].byCategory["write-for-us"]).toBe(5);
    expect(stats[0].byCategory["guest-post"]).toBe(8);
  });
  it("returns empty for empty input", () => {
    expect(computeStats([])).toEqual([]);
  });
  it("sorts by niche alphabetically", () => {
    const queries = generateForNiches(["marketing", "seo"]);
    const stats = computeStats(queries);
    expect(stats[0].niche).toBe("marketing");
    expect(stats[1].niche).toBe("seo");
  });
});

describe("guest-post-finder renderText", () => {
  it("renders queries one per line", () => {
    const queries = generateForNiche("seo", ["write-for-us"]);
    const text = renderText(queries);
    expect(text).toContain('seo "write for us"');
    expect(text.split("\n").length).toBe(5);
  });
  it("returns empty for empty input", () => {
    expect(renderText([])).toBe("");
  });
});

describe("guest-post-finder renderCsv", () => {
  it("renders header", () => {
    const csv = renderCsv([]);
    expect(csv).toContain("niche,category,footprint,query,google_url");
  });
  it("renders query rows", () => {
    const queries = generateForNiche("seo", ["write-for-us"]);
    const csv = renderCsv(queries);
    expect(csv).toContain("seo,write-for-us");
    // The query 'seo "write for us"' is CSV-escaped with doubled quotes
    expect(csv).toContain('seo ""write for us""');
  });
  it("escapes commas in footprints", () => {
    const csv = renderCsv(generateForNiche("seo"));
    // Footprints contain quotes which are escaped in CSV
    expect(csv).toContain('""');
  });
});

describe("guest-post-finder splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
});

describe("guest-post-finder history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, niches: ["seo"], totalQueries: 32 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, niches: ["x"], totalQueries: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, niches: ["x"], totalQueries: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("guest-post-finder shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("seo,marketing", ["write-for-us", "guest-post"]);
    expect(url).toContain("niches=seo%2Cmarketing");
    expect(url).toContain("cats=write-for-us%2Cguest-post");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("niches=seo%2Cmarketing&cats=write-for-us%2Cguest-post");
    expect(p.niches).toBe("seo,marketing");
    expect(p.categories).toEqual(["write-for-us", "guest-post"]);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ niches: "", categories: [] });
  });
  it("filters unknown categories", () => {
    const p = parseShareUrl("niches=seo&cats=write-for-us%2Cunknown-cat");
    expect(p.categories).toEqual(["write-for-us"]);
  });
});

// Suppress unused-import lint
export type _Unused = FootprintCategory;
