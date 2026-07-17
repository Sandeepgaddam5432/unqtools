import { describe, it, expect, beforeEach } from "vitest";
import {
  GENERIC_ANCHORS,
  parseBacklinks,
  looksLikeUrl,
  isBranded,
  isExactMatch,
  isPartialMatch,
  isImageAnchor,
  isGenericAnchor,
  categorizeBacklink,
  analyze,
  renderCsv,
  buildChartData,
  HEALTHY_PROFILE,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Backlink,
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

describe("anchor-text-distribution parseBacklinks", () => {
  it("parses pipe-separated", () => {
    const text = "https://a.com | best running shoes";
    expect(parseBacklinks(text)).toEqual([{ url: "https://a.com", anchor: "best running shoes" }]);
  });
  it("parses tab-separated", () => {
    const text = "https://a.com\tbest running shoes";
    expect(parseBacklinks(text)).toEqual([{ url: "https://a.com", anchor: "best running shoes" }]);
  });
  it("parses multiple lines", () => {
    const text = "https://a.com | anchor1\nhttps://b.com | anchor2";
    expect(parseBacklinks(text)).toHaveLength(2);
  });
  it("skips comments", () => {
    const text = "# comment\nhttps://a.com | anchor";
    expect(parseBacklinks(text)).toHaveLength(1);
  });
  it("skips lines without anchor", () => {
    const text = "https://a.com\nhttps://b.com | anchor";
    expect(parseBacklinks(text)).toHaveLength(1);
  });
  it("handles empty input", () => {
    expect(parseBacklinks("")).toEqual([]);
  });
});

describe("anchor-text-distribution looksLikeUrl", () => {
  it("accepts http(s) URLs", () => {
    expect(looksLikeUrl("https://example.com")).toBe(true);
    expect(looksLikeUrl("http://example.com/x")).toBe(true);
  });
  it("accepts www URLs", () => {
    expect(looksLikeUrl("www.example.com")).toBe(true);
  });
  it("accepts bare domains", () => {
    expect(looksLikeUrl("example.com")).toBe(true);
    expect(looksLikeUrl("example.com/page")).toBe(true);
  });
  it("rejects plain text", () => {
    expect(looksLikeUrl("best running shoes")).toBe(false);
    expect(looksLikeUrl("click here")).toBe(false);
  });
  it("rejects empty", () => {
    expect(looksLikeUrl("")).toBe(false);
  });
});

describe("anchor-text-distribution isBranded", () => {
  it("detects brand in anchor", () => {
    expect(isBranded("Nike running shoes", "nike")).toBe(true);
    expect(isBranded("Visit Nike today", "Nike")).toBe(true);
  });
  it("returns false when brand not present", () => {
    expect(isBranded("best running shoes", "nike")).toBe(false);
  });
  it("returns false when brand empty", () => {
    expect(isBranded("nike shoes", "")).toBe(false);
  });
});

describe("anchor-text-distribution isExactMatch", () => {
  it("matches exact keyword", () => {
    expect(isExactMatch("running shoes", "running shoes")).toBe(true);
    expect(isExactMatch("Running Shoes", "running shoes")).toBe(true);
  });
  it("rejects partial matches", () => {
    expect(isExactMatch("best running shoes", "running shoes")).toBe(false);
  });
  it("rejects empty inputs", () => {
    expect(isExactMatch("", "running shoes")).toBe(false);
    expect(isExactMatch("running shoes", "")).toBe(false);
  });
});

describe("anchor-text-distribution isPartialMatch", () => {
  it("detects keyword in anchor", () => {
    expect(isPartialMatch("best running shoes 2026", "running shoes")).toBe(true);
  });
  it("rejects when keyword not in anchor", () => {
    expect(isPartialMatch("best sneakers", "running shoes")).toBe(false);
  });
});

describe("anchor-text-distribution isImageAnchor", () => {
  it("detects image: prefix", () => {
    expect(isImageAnchor("image:logo.png")).toBe(true);
  });
  it("detects (image)", () => {
    expect(isImageAnchor("(image)")).toBe(true);
  });
  it("detects [image]", () => {
    expect(isImageAnchor("[image]")).toBe(true);
  });
  it("returns false for text", () => {
    expect(isImageAnchor("best running shoes")).toBe(false);
  });
});

describe("anchor-text-distribution isGenericAnchor", () => {
  it("detects 'click here'", () => {
    expect(isGenericAnchor("click here")).toBe(true);
    expect(isGenericAnchor("Click Here")).toBe(true);
  });
  it("detects 'read more'", () => {
    expect(isGenericAnchor("read more")).toBe(true);
  });
  it("rejects descriptive text", () => {
    expect(isGenericAnchor("best running shoes")).toBe(false);
  });
  it("rejects empty", () => {
    expect(isGenericAnchor("")).toBe(false);
  });
  it("has comprehensive generic list", () => {
    expect(GENERIC_ANCHORS.size).toBeGreaterThanOrEqual(10);
  });
});

describe("anchor-text-distribution categorizeBacklink", () => {
  it("categorizes image anchor", () => {
    const b: Backlink = { url: "https://a.com", anchor: "image:logo.png" };
    expect(categorizeBacklink(b, {})).toBe("image");
  });
  it("categorizes naked URL", () => {
    const b: Backlink = { url: "https://a.com", anchor: "https://example.com" };
    expect(categorizeBacklink(b, {})).toBe("naked-url");
  });
  it("categorizes exact match", () => {
    const b: Backlink = { url: "https://a.com", anchor: "running shoes" };
    expect(categorizeBacklink(b, { keyword: "running shoes" })).toBe("exact-match");
  });
  it("categorizes partial match", () => {
    const b: Backlink = { url: "https://a.com", anchor: "best running shoes 2026" };
    expect(categorizeBacklink(b, { keyword: "running shoes" })).toBe("partial-match");
  });
  it("categorizes branded", () => {
    const b: Backlink = { url: "https://a.com", anchor: "Visit Nike" };
    expect(categorizeBacklink(b, { keyword: "running shoes", brand: "nike" })).toBe("branded");
  });
  it("categorizes generic", () => {
    const b: Backlink = { url: "https://a.com", anchor: "click here" };
    expect(categorizeBacklink(b, { keyword: "running shoes", brand: "nike" })).toBe("generic");
  });
  it("defaults to generic when nothing matches", () => {
    const b: Backlink = { url: "https://a.com", anchor: "some random text" };
    expect(categorizeBacklink(b, {})).toBe("generic");
  });
});

describe("anchor-text-distribution analyze", () => {
  const backlinks: Backlink[] = [
    { url: "https://a1.com", anchor: "running shoes" },           // exact
    { url: "https://a2.com", anchor: "best running shoes 2026" }, // partial
    { url: "https://a3.com", anchor: "Nike running" },            // branded
    { url: "https://a4.com", anchor: "click here" },              // generic
    { url: "https://a5.com", anchor: "https://example.com" },     // naked
    { url: "https://a6.com", anchor: "image:logo.png" },          // image
  ];
  it("categorizes all backlinks", () => {
    const r = analyze(backlinks, { keyword: "running shoes", brand: "nike" });
    expect(r.total).toBe(6);
    expect(r.perCategory["exact-match"].count).toBe(1);
    expect(r.perCategory["partial-match"].count).toBe(1);
    expect(r.perCategory["branded"].count).toBe(1);
    expect(r.perCategory["generic"].count).toBe(1);
    expect(r.perCategory["naked-url"].count).toBe(1);
    expect(r.perCategory["image"].count).toBe(1);
  });
  it("computes percentages", () => {
    const r = analyze(backlinks, { keyword: "running shoes", brand: "nike" });
    expect(r.perCategory["exact-match"].percentage).toBeCloseTo(100 / 6, 1);
  });
  it("dedups by default", () => {
    const dupBacklinks: Backlink[] = [
      { url: "https://a.com", anchor: "running shoes" },
      { url: "https://a.com", anchor: "running shoes" },
    ];
    const r = analyze(dupBacklinks, { keyword: "running shoes" });
    expect(r.total).toBe(1);
  });
  it("can disable dedup", () => {
    const dupBacklinks: Backlink[] = [
      { url: "https://a.com", anchor: "running shoes" },
      { url: "https://a.com", anchor: "running shoes" },
    ];
    const r = analyze(dupBacklinks, { keyword: "running shoes", dedup: false });
    expect(r.total).toBe(2);
  });
  it("warns on over-optimization (>50% exact)", () => {
    const r = analyze(
      [
        { url: "https://a1.com", anchor: "running shoes" },
        { url: "https://a2.com", anchor: "running shoes" },
        { url: "https://a3.com", anchor: "running shoes" },
        { url: "https://a4.com", anchor: "click here" },
      ],
      { keyword: "running shoes" },
    );
    expect(r.warnings.some((w) => /over-optimization/i.test(w))).toBe(true);
  });
  it("warns on low branded ratio", () => {
    const r = analyze(
      [
        { url: "https://a1.com", anchor: "click here" },
        { url: "https://a2.com", anchor: "click here" },
      ],
      { brand: "nike" },
    );
    expect(r.warnings.some((w) => /low branded/i.test(w))).toBe(true);
  });
  it("computes top anchors", () => {
    const r = analyze(
      [
        { url: "https://a1.com", anchor: "running shoes" },
        { url: "https://a2.com", anchor: "running shoes" },
        { url: "https://a3.com", anchor: "click here" },
      ],
      {},
    );
    expect(r.topAnchors[0].anchor).toBe("running shoes");
    expect(r.topAnchors[0].count).toBe(2);
  });
  it("handles empty input", () => {
    const r = analyze([], {});
    expect(r.total).toBe(0);
    expect(r.warnings).toHaveLength(0);
  });
  it("limits topAnchors to 10", () => {
    const many: Backlink[] = Array.from({ length: 15 }, (_, i) => ({
      url: `https://a${i}.com`,
      anchor: `anchor-${i}`,
    }));
    const r = analyze(many, {});
    expect(r.topAnchors.length).toBeLessThanOrEqual(10);
  });
});

describe("anchor-text-distribution renderCsv", () => {
  it("renders CSV with headers", () => {
    const r = analyze(
      [{ url: "https://a.com", anchor: "running shoes" }],
      { keyword: "running shoes" },
    );
    const csv = renderCsv(r);
    expect(csv).toContain("url,anchor,category");
    expect(csv).toContain("https://a.com,running shoes,exact-match");
  });
  it("escapes commas in anchors", () => {
    const r = analyze(
      [{ url: "https://a.com", anchor: "running, shoes" }],
      {},
    );
    const csv = renderCsv(r);
    expect(csv).toContain('"running, shoes"');
  });
});

describe("anchor-text-distribution buildChartData", () => {
  it("returns data for all categories", () => {
    const r = analyze(
      [{ url: "https://a.com", anchor: "running shoes" }],
      { keyword: "running shoes" },
    );
    const data = buildChartData(r);
    expect(data).toHaveLength(6);
    expect(data.every((d) => typeof d.percentage === "number")).toBe(true);
    expect(data.every((d) => d.color.startsWith("#"))).toBe(true);
  });
});

describe("anchor-text-distribution HEALTHY_PROFILE", () => {
  it("has entries for all categories", () => {
    expect(Object.keys(HEALTHY_PROFILE)).toHaveLength(6);
    expect(HEALTHY_PROFILE["exact-match"].max).toBeLessThanOrEqual(20);
  });
  it("branded has highest min", () => {
    expect(HEALTHY_PROFILE["branded"].min).toBeGreaterThanOrEqual(30);
  });
});

describe("anchor-text-distribution history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, total: 100, exactPct: 25, brandedPct: 40, warningCount: 1, snippet: "..." });
    saveHistory({ ts: 2, total: 50, exactPct: 15, brandedPct: 50, warningCount: 0, snippet: "..." });
    expect(loadHistory()).toHaveLength(2);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, total: 1, exactPct: 0, brandedPct: 0, warningCount: 0, snippet: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, total: 1, exactPct: 0, brandedPct: 0, warningCount: 0, snippet: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("anchor-text-distribution shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ text: "https://a.com | anchor", keyword: "shoes", brand: "nike" });
    expect(url).toContain("text=");
    expect(url).toContain("keyword=shoes");
    expect(url).toContain("brand=nike");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const parsed = parseShareUrl("text=x&keyword=shoes&brand=nike");
    expect(parsed.text).toBe("x");
    expect(parsed.keyword).toBe("shoes");
    expect(parsed.brand).toBe("nike");
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
});
