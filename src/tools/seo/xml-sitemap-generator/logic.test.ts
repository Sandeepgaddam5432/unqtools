import { describe, it, expect, beforeEach } from "vitest";
import {
  parseBulkUrls,
  validateUrls,
  buildUrlEntry,
  generateSitemap,
  generateSitemapIndex,
  computeStats,
  formatBytes,
  buildRobotsTxtSnippet,
  priorityPresets,
  escapeXml,
  isValidUrl,
  isValidIsoDate,
  isValidPriority,
  loadHistory,
  saveHistory,
  clearHistory,
  MAX_URLS_PER_SITEMAP,
  CHANGE_FREQS,
  type SitemapUrl,
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

describe("xml-sitemap-generator validators", () => {
  it("isValidUrl accepts https", () => {
    expect(isValidUrl("https://example.com/x")).toBe(true);
  });
  it("isValidUrl rejects bad strings", () => {
    expect(isValidUrl("not a url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
  it("isValidIsoDate accepts YYYY-MM-DD", () => {
    expect(isValidIsoDate("2026-01-01")).toBe(true);
  });
  it("isValidIsoDate accepts full datetime", () => {
    expect(isValidIsoDate("2026-01-01T10:30:00Z")).toBe(true);
  });
  it("isValidIsoDate rejects bad strings", () => {
    expect(isValidIsoDate("Jan 1, 2026")).toBe(false);
  });
  it("isValidPriority accepts 0-1", () => {
    expect(isValidPriority(0)).toBe(true);
    expect(isValidPriority(1)).toBe(true);
    expect(isValidPriority(0.5)).toBe(true);
  });
  it("isValidPriority rejects out of range", () => {
    expect(isValidPriority(1.5)).toBe(false);
    expect(isValidPriority(-0.1)).toBe(false);
  });
});

describe("xml-sitemap-generator escapeXml", () => {
  it("escapes XML special chars", () => {
    expect(escapeXml("a & b < c > d \"e\" 'f'")).toBe("a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;");
  });
});

describe("xml-sitemap-generator parseBulkUrls", () => {
  it("returns empty for empty input", () => {
    expect(parseBulkUrls("")).toEqual([]);
    expect(parseBulkUrls("   ")).toEqual([]);
  });
  it("parses single URL per line", () => {
    const out = parseBulkUrls("https://example.com/a\nhttps://example.com/b");
    expect(out).toHaveLength(2);
    expect(out[0].loc).toBe("https://example.com/a");
  });
  it("skips invalid URLs", () => {
    const out = parseBulkUrls("not-a-url\nhttps://example.com/valid");
    expect(out).toHaveLength(1);
  });
  it("parses pipe-separated lastmod, changefreq, priority", () => {
    const out = parseBulkUrls("https://example.com/x|2026-01-01|daily|0.8");
    expect(out[0].lastmod).toBe("2026-01-01");
    expect(out[0].changefreq).toBe("daily");
    expect(out[0].priority).toBe(0.8);
  });
  it("ignores invalid lastmod", () => {
    const out = parseBulkUrls("https://example.com/x|notadate");
    expect(out[0].lastmod).toBeUndefined();
  });
  it("ignores invalid changefreq", () => {
    const out = parseBulkUrls("https://example.com/x|2026-01-01|invalid|0.8");
    expect(out[0].changefreq).toBeUndefined();
  });
  it("ignores invalid priority", () => {
    const out = parseBulkUrls("https://example.com/x|2026-01-01|daily|5");
    expect(out[0].priority).toBeUndefined();
  });
  it("supports tab-separated values", () => {
    const out = parseBulkUrls("https://example.com/x\t2026-01-01\tdaily\t0.5");
    expect(out[0].lastmod).toBe("2026-01-01");
  });
});

describe("xml-sitemap-generator validateUrls", () => {
  it("errors on empty array", () => {
    const r = validateUrls([]);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /at least one/i.test(e))).toBe(true);
  });
  it("warns on duplicates", () => {
    const r = validateUrls([
      { loc: "https://example.com/x" },
      { loc: "https://example.com/x" },
    ]);
    expect(r.warnings.some((w) => /duplicate/i.test(w))).toBe(true);
  });
  it("errors on invalid priority", () => {
    const r = validateUrls([{ loc: "https://example.com/x", priority: 1.5 }]);
    expect(r.ok).toBe(false);
  });
  it("errors on invalid lastmod", () => {
    const r = validateUrls([{ loc: "https://example.com/x", lastmod: "not-a-date" }]);
    expect(r.ok).toBe(false);
  });
  it("warns when over URL limit", () => {
    const urls: SitemapUrl[] = Array.from({ length: MAX_URLS_PER_SITEMAP + 1 }, (_, i) => ({
      loc: `https://example.com/p${i}`,
    }));
    const r = validateUrls(urls);
    expect(r.warnings.some((w) => /split/i.test(w))).toBe(true);
  });
  it("passes for valid single URL", () => {
    const r = validateUrls([{ loc: "https://example.com/x" }]);
    expect(r.ok).toBe(true);
  });
});

describe("xml-sitemap-generator buildUrlEntry", () => {
  it("builds minimal entry", () => {
    const out = buildUrlEntry({ loc: "https://example.com/x" });
    expect(out).toContain("<url>");
    expect(out).toContain("<loc>https://example.com/x</loc>");
    expect(out).toContain("</url>");
  });
  it("includes optional fields when present", () => {
    const out = buildUrlEntry({
      loc: "https://example.com/x",
      lastmod: "2026-01-01",
      changefreq: "daily",
      priority: 0.8,
    });
    expect(out).toContain("<lastmod>2026-01-01</lastmod>");
    expect(out).toContain("<changefreq>daily</changefreq>");
    expect(out).toContain("<priority>0.8</priority>");
  });
  it("escapes special chars in loc", () => {
    const out = buildUrlEntry({ loc: "https://example.com/x?a=1&b=2" });
    expect(out).toContain("&amp;");
  });
});

describe("xml-sitemap-generator generateSitemap", () => {
  it("produces a complete sitemap XML document", () => {
    const out = generateSitemap([
      { loc: "https://example.com/" },
      { loc: "https://example.com/about", lastmod: "2026-01-01", priority: 0.8 },
    ]);
    expect(out.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(out).toContain("<urlset");
    expect(out).toContain("www.sitemaps.org/schemas/sitemap/0.9");
    expect(out).toContain("<url>");
    expect(out).toContain("</urlset>");
  });
  it("throws on invalid input", () => {
    expect(() => generateSitemap([])).toThrow();
    expect(() => generateSitemap([{ loc: "bad-url" }])).toThrow();
  });
  it("formats priority to one decimal", () => {
    const out = generateSitemap([{ loc: "https://example.com/x", priority: 0.856 }]);
    expect(out).toContain("<priority>0.9</priority>");
  });
});

describe("xml-sitemap-generator generateSitemapIndex", () => {
  it("produces a sitemapindex document", () => {
    const out = generateSitemapIndex([
      { loc: "https://example.com/sitemap1.xml", lastmod: "2026-01-01" },
      { loc: "https://example.com/sitemap2.xml" },
    ]);
    expect(out).toContain("<sitemapindex");
    expect(out).toContain("<sitemap>");
    expect(out).toContain("</sitemapindex>");
    expect(out).toContain("sitemap1.xml");
  });
  it("throws on empty array", () => {
    expect(() => generateSitemapIndex([])).toThrow();
  });
});

describe("xml-sitemap-generator computeStats", () => {
  it("computes byte size and url count", () => {
    const xml = generateSitemap([{ loc: "https://example.com/x" }]);
    const stats = computeStats(xml, 1);
    expect(stats.urlCount).toBe(1);
    expect(stats.byteSize).toBeGreaterThan(100);
    expect(stats.isWithinLimits).toBe(true);
    expect(stats.needsIndex).toBe(false);
  });
  it("flags when over URL limit", () => {
    const stats = computeStats("<x/>", MAX_URLS_PER_SITEMAP + 1);
    expect(stats.needsIndex).toBe(true);
  });
});

describe("xml-sitemap-generator formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
  });
  it("formats KB", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });
  it("formats MB", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.00 MB");
  });
});

describe("xml-sitemap-generator buildRobotsTxtSnippet", () => {
  it("produces a robots.txt snippet with sitemap directive", () => {
    const out = buildRobotsTxtSnippet("https://example.com/sitemap.xml");
    expect(out).toContain("User-agent: *");
    expect(out).toContain("Allow: /");
    expect(out).toContain("Sitemap: https://example.com/sitemap.xml");
  });
  it("returns empty for invalid URL", () => {
    expect(buildRobotsTxtSnippet("not-a-url")).toBe("");
  });
});

describe("xml-sitemap-generator priorityPresets", () => {
  it("returns a list of presets", () => {
    const presets = priorityPresets();
    expect(presets.length).toBeGreaterThan(5);
    expect(presets[0].value).toBe(1.0);
    expect(presets[presets.length - 1].value).toBe(0.0);
  });
});

describe("xml-sitemap-generator CHANGE_FREQS", () => {
  it("contains all 7 frequencies", () => {
    expect(CHANGE_FREQS).toHaveLength(7);
    expect(CHANGE_FREQS).toContain("daily");
    expect(CHANGE_FREQS).toContain("never");
  });
});

describe("xml-sitemap-generator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, urlCount: 10, snippet: "<x/>" });
    saveHistory({ ts: 2, urlCount: 20, snippet: "<y/>" });
    expect(loadHistory()).toHaveLength(2);
    expect(loadHistory()[0].urlCount).toBe(20);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, urlCount: i, snippet: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, urlCount: 1, snippet: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});
