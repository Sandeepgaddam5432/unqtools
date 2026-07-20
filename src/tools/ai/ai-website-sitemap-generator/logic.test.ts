import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  MAX_URLS_PER_SITEMAP,
  SITE_TYPE_LABELS,
  SITE_TYPE_TEMPLATES,
  CHANGEFREQ_VALUES,
  CHANGEFREQ_LABELS,
  loadTemplate,
  normalizeUrl,
  validateUrl,
  parseUrls,
  dedupeUrls,
  sortUrls,
  pathDepth,
  urlSection,
  defaultPriorityForUrl,
  defaultChangefreqForUrl,
  mergeUrls,
  applyExcludePatterns,
  buildSitemapUrls,
  buildSitemap,
  buildTree,
  computeStats,
  splitIntoChunks,
  renderXmlSitemap,
  renderSitemapIndex,
  renderAllXmlChunks,
  renderHtmlSitemap,
  renderVisualTree,
  renderJson,
  renderMarkdown,
  renderTextList,
  escapeXml,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type SiteType,
  type SitemapUrl,
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

describe("sitemap constants", () => {
  it("has 5 site types", () => {
    expect(Object.keys(SITE_TYPE_LABELS)).toHaveLength(5);
    expect(Object.keys(SITE_TYPE_TEMPLATES)).toHaveLength(5);
  });
  it("blog template has 16 entries", () => {
    expect(SITE_TYPE_TEMPLATES.blog).toHaveLength(16);
  });
  it("ecommerce template has 23 entries", () => {
    expect(SITE_TYPE_TEMPLATES.ecommerce).toHaveLength(23);
  });
  it("saas template has 23 entries", () => {
    expect(SITE_TYPE_TEMPLATES.saas).toHaveLength(23);
  });
  it("portfolio template has 14 entries", () => {
    expect(SITE_TYPE_TEMPLATES.portfolio).toHaveLength(14);
  });
  it("docs template has 23 entries", () => {
    expect(SITE_TYPE_TEMPLATES.docs).toHaveLength(23);
  });
  it("has 7 changefreq values", () => {
    expect(CHANGEFREQ_VALUES).toHaveLength(7);
    expect(Object.keys(CHANGEFREQ_LABELS)).toHaveLength(7);
  });
  it("MAX_URLS_PER_SITEMAP is 50000", () => {
    expect(MAX_URLS_PER_SITEMAP).toBe(50000);
  });
  it("HISTORY_MAX is 20", () => {
    expect(HISTORY_MAX).toBe(20);
  });
});

describe("sitemap normalizeUrl", () => {
  it("adds https:// if missing", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com/");
  });
  it("lowercases hostname", () => {
    expect(normalizeUrl("HTTPS://Example.COM/About")).toBe("https://example.com/About");
  });
  it("strips trailing slash (non-root)", () => {
    expect(normalizeUrl("https://example.com/about/")).toBe("https://example.com/about");
  });
  it("keeps root trailing slash", () => {
    expect(normalizeUrl("https://example.com")).toBe("https://example.com/");
  });
  it("returns empty for invalid", () => {
    expect(normalizeUrl("")).toBe("");
    expect(normalizeUrl("   ")).toBe("");
  });
  it("strips default port 443 on https", () => {
    expect(normalizeUrl("https://example.com:443/about")).toBe("https://example.com/about");
  });
});

describe("sitemap validateUrl", () => {
  it("validates a good URL", () => {
    expect(validateUrl("https://example.com")).toBe(true);
    expect(validateUrl("http://example.com/about")).toBe(true);
  });
  it("rejects empty", () => {
    expect(validateUrl("")).toBe(false);
  });
  it("rejects garbage", () => {
    expect(validateUrl("not a url at all")).toBe(false);
  });
});

describe("sitemap parseUrls", () => {
  it("parses newline-separated", () => {
    expect(parseUrls("https://a.com\nhttps://b.com")).toEqual(["https://a.com/", "https://b.com/"]);
  });
  it("parses comma-separated", () => {
    expect(parseUrls("https://a.com, https://b.com")).toEqual(["https://a.com/", "https://b.com/"]);
  });
  it("parses whitespace-separated", () => {
    expect(parseUrls("https://a.com https://b.com")).toEqual(["https://a.com/", "https://b.com/"]);
  });
  it("filters blank entries", () => {
    expect(parseUrls("https://a.com\n\n  \nhttps://b.com")).toEqual(["https://a.com/", "https://b.com/"]);
  });
  it("returns empty for empty input", () => {
    expect(parseUrls("")).toEqual([]);
  });
  it("normalizes each URL", () => {
    expect(parseUrls("a.com/about/")).toEqual(["https://a.com/about"]);
  });
});

describe("sitemap dedupeUrls", () => {
  it("removes duplicates", () => {
    expect(dedupeUrls(["https://a.com/", "https://a.com/", "https://b.com/"])).toEqual([
      "https://a.com/", "https://b.com/",
    ]);
  });
});

describe("sitemap sortUrls", () => {
  it("sorts alphabetically", () => {
    expect(sortUrls(["https://b.com/", "https://a.com/"])).toEqual([
      "https://a.com/", "https://b.com/",
    ]);
  });
});

describe("sitemap path helpers", () => {
  it("pathDepth: root = 0", () => {
    expect(pathDepth("https://example.com/")).toBe(0);
  });
  it("pathDepth: single segment = 1", () => {
    expect(pathDepth("https://example.com/about")).toBe(1);
  });
  it("pathDepth: nested = 2", () => {
    expect(pathDepth("https://example.com/blog/post")).toBe(2);
  });
  it("urlSection: returns first segment", () => {
    expect(urlSection("https://example.com/blog/post-1")).toBe("blog");
  });
  it("urlSection: returns 'root' for home", () => {
    expect(urlSection("https://example.com/")).toBe("root");
  });
  it("defaultPriorityForUrl: home = 1.0", () => {
    expect(defaultPriorityForUrl("https://example.com/")).toBe(1.0);
  });
  it("defaultPriorityForUrl: blog list = 0.8", () => {
    expect(defaultPriorityForUrl("https://example.com/blog")).toBe(0.8);
  });
  it("defaultChangefreqForUrl: home = daily", () => {
    expect(defaultChangefreqForUrl("https://example.com/")).toBe("daily");
  });
  it("defaultChangefreqForUrl: blog = weekly", () => {
    expect(defaultChangefreqForUrl("https://example.com/blog")).toBe("weekly");
  });
});

describe("sitemap loadTemplate", () => {
  it("loads blog template against a root URL", () => {
    const t = loadTemplate("blog", "https://example.com");
    expect(t.length).toBe(16);
    expect(t[0].loc).toBe("https://example.com/");
    expect(t[0].priority).toBe(1.0);
    expect(t[0].changefreq).toBe("daily");
    expect(t[0].section).toBe("root");
  });
  it("returns empty for empty root", () => {
    expect(loadTemplate("blog", "")).toEqual([]);
  });
  it("docs template has docs section entries", () => {
    const t = loadTemplate("docs", "https://docs.example.com");
    expect(t.some((e) => e.section === "docs")).toBe(true);
    expect(t.some((e) => e.section === "api")).toBe(true);
  });
});

describe("sitemap mergeUrls", () => {
  it("dedupes template + custom", () => {
    const tmpl = loadTemplate("blog", "https://example.com");
    const custom = ["https://example.com/about", "https://example.com/custom-page"];
    const merged = mergeUrls(tmpl, custom);
    // about is in template; custom-page is new → 16 + 1 = 17
    expect(merged).toHaveLength(17);
    expect(merged.some((m) => m.loc === "https://example.com/custom-page")).toBe(true);
  });
  it("applies default priority to custom entries", () => {
    const merged = mergeUrls([], ["https://example.com/"]);
    expect(merged[0].priority).toBe(1.0);
    expect(merged[0].changefreq).toBe("daily");
  });
});

describe("sitemap applyExcludePatterns", () => {
  it("filters URLs matching regex", () => {
    const urls = ["https://a.com/blog/1", "https://a.com/about", "https://a.com/contact"];
    expect(applyExcludePatterns(urls, ["/blog/"])).toEqual([
      "https://a.com/about", "https://a.com/contact",
    ]);
  });
  it("returns all when no patterns", () => {
    const urls = ["https://a.com/x", "https://a.com/y"];
    expect(applyExcludePatterns(urls, [])).toEqual(urls);
  });
  it("skips invalid regex without throwing", () => {
    const urls = ["https://a.com/x"];
    expect(applyExcludePatterns(urls, ["("])).toEqual(urls);
  });
});

describe("sitemap buildSitemapUrls", () => {
  it("applies default lastmod when provided", () => {
    const entries = [{ loc: "https://a.com/", priority: 1.0, changefreq: "daily" as const, section: "root" }];
    const urls = buildSitemapUrls(entries, { defaultLastmod: "2024-01-01" });
    expect(urls[0].lastmod).toBe("2024-01-01");
  });
  it("applies per-URL overrides", () => {
    const entries = [{ loc: "https://a.com/", priority: 1.0, changefreq: "daily" as const, section: "root" }];
    const urls = buildSitemapUrls(entries, {
      overrides: [{ loc: "https://a.com/", priority: 0.4, changefreq: "yearly", lastmod: "2023-05-05" }],
    });
    expect(urls[0].priority).toBe(0.4);
    expect(urls[0].changefreq).toBe("yearly");
    expect(urls[0].lastmod).toBe("2023-05-05");
  });
  it("clamps priority to [0,1]", () => {
    const entries = [{ loc: "https://a.com/", priority: 5, changefreq: "daily" as const, section: "root" }];
    const urls = buildSitemapUrls(entries);
    expect(urls[0].priority).toBe(1);
  });
  it("computes depth and section", () => {
    const entries = [{ loc: "https://a.com/blog/post-1", priority: 0.6, changefreq: "weekly" as const, section: "blog" }];
    const urls = buildSitemapUrls(entries);
    expect(urls[0].depth).toBe(2);
    expect(urls[0].section).toBe("blog");
  });
});

describe("sitemap buildSitemap (full)", () => {
  it("builds a sitemap result with tree and stats", () => {
    const result = buildSitemap({
      siteType: "blog",
      rootUrl: "https://example.com",
      customUrls: ["https://example.com/extra"],
      excludes: [],
      defaultLastmod: "2024-06-01",
      useTemplate: true,
    });
    expect(result.urls.length).toBeGreaterThanOrEqual(16);
    expect(result.tree).toBeDefined();
    expect(result.stats.total).toBe(result.urls.length);
    expect(result.chunked).toHaveLength(1);
    expect(result.needsIndex).toBe(false);
    expect(result.urls.every((u) => u.lastmod === "2024-06-01")).toBe(true);
  });
  it("skips template when useTemplate is false", () => {
    const result = buildSitemap({
      siteType: "blog",
      rootUrl: "https://example.com",
      customUrls: ["https://example.com/extra"],
      excludes: [],
      useTemplate: false,
    });
    expect(result.urls).toHaveLength(1);
    expect(result.urls[0].loc).toBe("https://example.com/extra");
  });
  it("applies exclude patterns", () => {
    const result = buildSitemap({
      siteType: "blog",
      rootUrl: "https://example.com",
      customUrls: [],
      excludes: ["/blog/category/"],
      useTemplate: true,
    });
    expect(result.urls.every((u) => !u.loc.includes("/blog/category/"))).toBe(true);
  });
});

describe("sitemap buildTree", () => {
  it("builds hierarchical tree", () => {
    const urls: SitemapUrl[] = [
      { loc: "https://a.com/", changefreq: "daily", priority: 1.0, depth: 0, section: "root" },
      { loc: "https://a.com/blog", changefreq: "weekly", priority: 0.8, depth: 1, section: "blog" },
      { loc: "https://a.com/blog/post-1", changefreq: "monthly", priority: 0.6, depth: 2, section: "blog" },
      { loc: "https://a.com/about", changefreq: "monthly", priority: 0.6, depth: 1, section: "about" },
    ];
    const tree = buildTree(urls);
    expect(tree.children.length).toBeGreaterThan(0);
    const blog = tree.children.find((c) => c.loc === "https://a.com/blog");
    expect(blog).toBeDefined();
    expect(blog!.children.length).toBe(1);
    expect(blog!.children[0].loc).toBe("https://a.com/blog/post-1");
  });
});

describe("sitemap computeStats", () => {
  it("computes stats correctly", () => {
    const urls: SitemapUrl[] = [
      { loc: "https://a.com/", changefreq: "daily", priority: 1.0, depth: 0, section: "root" },
      { loc: "https://a.com/blog", changefreq: "weekly", priority: 0.8, depth: 1, section: "blog" },
      { loc: "https://a.com/blog/post-1", changefreq: "weekly", priority: 0.6, depth: 2, section: "blog" },
    ];
    const stats = computeStats(urls);
    expect(stats.total).toBe(3);
    expect(stats.bySection.root).toBe(1);
    expect(stats.bySection.blog).toBe(2);
    expect(stats.byDepth[0]).toBe(1);
    expect(stats.byDepth[1]).toBe(1);
    expect(stats.byDepth[2]).toBe(1);
    expect(stats.byChangefreq.daily).toBe(1);
    expect(stats.byChangefreq.weekly).toBe(2);
    expect(stats.avgPriority).toBe(0.8); // (1.0 + 0.8 + 0.6) / 3 = 0.8
  });
  it("returns zeroed stats for empty", () => {
    const stats = computeStats([]);
    expect(stats.total).toBe(0);
    expect(stats.avgPriority).toBe(0);
  });
});

describe("sitemap splitIntoChunks", () => {
  it("returns empty for empty input", () => {
    expect(splitIntoChunks([])).toEqual([]);
  });
  it("returns single chunk under limit", () => {
    const urls = Array.from({ length: 100 }, (_, i) => ({
      loc: `https://a.com/p${i}`, changefreq: "weekly" as const, priority: 0.5, depth: 1, section: "p",
    }));
    const chunks = splitIntoChunks(urls);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(100);
  });
  it("splits at limit", () => {
    const urls = Array.from({ length: 5 }, (_, i) => ({
      loc: `https://a.com/p${i}`, changefreq: "weekly" as const, priority: 0.5, depth: 1, section: "p",
    }));
    const chunks = splitIntoChunks(urls, 2);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(2);
    expect(chunks[1]).toHaveLength(2);
    expect(chunks[2]).toHaveLength(1);
  });
});

describe("sitemap renderXmlSitemap", () => {
  it("produces valid XML structure", () => {
    const urls: SitemapUrl[] = [
      { loc: "https://a.com/", changefreq: "daily", priority: 1.0, depth: 0, section: "root", lastmod: "2024-01-01" },
    ];
    const xml = renderXmlSitemap(urls);
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain("<urlset");
    expect(xml).toContain("<url>");
    expect(xml).toContain("<loc>https://a.com/</loc>");
    expect(xml).toContain("<lastmod>2024-01-01</lastmod>");
    expect(xml).toContain("<changefreq>daily</changefreq>");
    expect(xml).toContain("<priority>1.0</priority>");
    expect(xml).toContain("</urlset>");
  });
  it("escapes special characters in URLs", () => {
    const urls: SitemapUrl[] = [
      { loc: "https://a.com/?a=1&b=2", changefreq: "daily", priority: 1.0, depth: 0, section: "root" },
    ];
    const xml = renderXmlSitemap(urls);
    expect(xml).toContain("&amp;");
    expect(xml).not.toContain("?a=1&b=2<");
  });
  it("renders image sitemap entries", () => {
    const urls: SitemapUrl[] = [
      { loc: "https://a.com/", changefreq: "daily", priority: 1.0, depth: 0, section: "root", images: ["https://a.com/img.jpg"] },
    ];
    const xml = renderXmlSitemap(urls);
    expect(xml).toContain("<image:image>");
    expect(xml).toContain("<image:loc>https://a.com/img.jpg</image:loc>");
  });
  it("renders hreflang alternates", () => {
    const urls: SitemapUrl[] = [
      {
        loc: "https://a.com/", changefreq: "daily", priority: 1.0, depth: 0, section: "root",
        alternates: [{ hreflang: "es", href: "https://a.com/es/" }],
      },
    ];
    const xml = renderXmlSitemap(urls);
    expect(xml).toContain('hreflang="es"');
    expect(xml).toContain('href="https://a.com/es/"');
  });
});

describe("sitemap renderSitemapIndex", () => {
  it("renders index pointing at chunks", () => {
    const urls: SitemapUrl[] = Array.from({ length: 2 }, (_, i) => ({
      loc: `https://a.com/p${i}`, changefreq: "weekly" as const, priority: 0.5, depth: 1, section: "p",
    }));
    const chunks = splitIntoChunks(urls, 1);
    const xml = renderSitemapIndex(chunks, "https://a.com/", "2024-01-01");
    expect(xml).toContain("<sitemapindex");
    expect(xml).toContain("<sitemap>");
    expect(xml).toContain("<loc>https://a.com/sitemap-1.xml</loc>");
    expect(xml).toContain("<loc>https://a.com/sitemap-2.xml</loc>");
    expect(xml).toContain("<lastmod>2024-01-01</lastmod>");
  });
});

describe("sitemap renderAllXmlChunks", () => {
  it("renders one XML per chunk", () => {
    const urls: SitemapUrl[] = Array.from({ length: 3 }, (_, i) => ({
      loc: `https://a.com/p${i}`, changefreq: "weekly" as const, priority: 0.5, depth: 1, section: "p",
    }));
    const chunks = splitIntoChunks(urls, 2);
    const all = renderAllXmlChunks(chunks);
    expect(all).toHaveLength(2);
    expect(all[0]).toContain("<urlset");
    expect(all[1]).toContain("<urlset");
  });
});

describe("sitemap renderHtmlSitemap", () => {
  it("renders valid HTML with URLs", () => {
    const urls: SitemapUrl[] = [
      { loc: "https://a.com/", changefreq: "daily", priority: 1.0, depth: 0, section: "root" },
      { loc: "https://a.com/blog", changefreq: "weekly", priority: 0.8, depth: 1, section: "blog" },
    ];
    const html = renderHtmlSitemap(urls);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<title>Sitemap</title>");
    expect(html).toContain('href="https://a.com/"');
    expect(html).toContain('href="https://a.com/blog"');
    expect(html).toContain("2 URLs");
  });
});

describe("sitemap renderVisualTree", () => {
  it("renders indented tree", () => {
    const urls: SitemapUrl[] = [
      { loc: "https://a.com/", changefreq: "daily", priority: 1.0, depth: 0, section: "root" },
      { loc: "https://a.com/blog", changefreq: "weekly", priority: 0.8, depth: 1, section: "blog" },
      { loc: "https://a.com/blog/post-1", changefreq: "monthly", priority: 0.6, depth: 2, section: "blog" },
    ];
    const tree = buildTree(urls);
    const text = renderVisualTree(tree);
    expect(text).toContain("https://a.com/");
    expect(text).toContain("https://a.com/blog");
    expect(text).toContain("[weekly, 0.8]");
  });
});

describe("sitemap renderJson", () => {
  it("renders valid JSON", () => {
    const urls: SitemapUrl[] = [
      { loc: "https://a.com/", changefreq: "daily", priority: 1.0, depth: 0, section: "root" },
    ];
    const json = renderJson(urls);
    const parsed = JSON.parse(json) as { count: number; urls: unknown[] };
    expect(parsed.count).toBe(1);
    expect(parsed.urls).toHaveLength(1);
  });
});

describe("sitemap renderMarkdown", () => {
  it("renders markdown with sections", () => {
    const urls: SitemapUrl[] = [
      { loc: "https://a.com/", changefreq: "daily", priority: 1.0, depth: 0, section: "root" },
      { loc: "https://a.com/blog", changefreq: "weekly", priority: 0.8, depth: 1, section: "blog" },
    ];
    const md = renderMarkdown(urls);
    expect(md).toContain("# Sitemap");
    expect(md).toContain("## root");
    expect(md).toContain("## blog");
    expect(md).toContain("| URL | Priority |");
  });
});

describe("sitemap renderTextList", () => {
  it("renders one URL per line", () => {
    const urls: SitemapUrl[] = [
      { loc: "https://a.com/", changefreq: "daily", priority: 1.0, depth: 0, section: "root" },
      { loc: "https://a.com/blog", changefreq: "weekly", priority: 0.8, depth: 1, section: "blog" },
    ];
    expect(renderTextList(urls)).toBe("https://a.com/\nhttps://a.com/blog");
  });
});

describe("sitemap escapeXml", () => {
  it("escapes special chars", () => {
    expect(escapeXml("a&b<c>\"d'e")).toBe("a&amp;b&lt;c&gt;&quot;d&apos;e");
  });
});

describe("sitemap history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, siteType: "blog", urlCount: 16, chunkCount: 1,
      needsIndex: false, topSection: "blog",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, siteType: "blog", urlCount: i, chunkCount: 1,
        needsIndex: false, topSection: "blog",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, siteType: "blog", urlCount: 1, chunkCount: 1,
      needsIndex: false, topSection: "blog",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("uses correct storage key", () => {
    saveHistory({
      ts: 1, siteType: "blog", urlCount: 1, chunkCount: 1,
      needsIndex: false, topSection: "blog",
    });
    expect(localStorage.getItem(HISTORY_KEY)).not.toBeNull();
  });
});

describe("sitemap shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      siteType: "blog",
      customUrls: "https://a.com\nhttps://b.com",
      excludes: "/tag/",
      defaultLastmod: "2024-01-01",
      useTemplate: true,
    });
    expect(url).toContain("type=blog");
    expect(url).toContain("urls=");
    expect(url).toContain("ex=%2Ftag%2F");
    expect(url).toContain("lm=2024-01-01");
    expect(url).toContain("tmpl=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const state = parseShareUrl("type=docs&urls=https%3A%2F%2Fa.com&ex=&lm=2024-02-02&tmpl=0");
    expect(state.siteType).toBe("docs");
    expect(state.customUrls).toBe("https://a.com");
    expect(state.defaultLastmod).toBe("2024-02-02");
    expect(state.useTemplate).toBe(false);
  });
  it("handles empty hash with defaults", () => {
    const state = parseShareUrl("");
    expect(state.siteType).toBe("blog");
    expect(state.useTemplate).toBe(true);
  });
  it("filters invalid site type", () => {
    const state = parseShareUrl("type=unknown");
    expect(state.siteType).toBe("blog");
  });
});

describe("sitemap LLM helpers", () => {
  it("buildLlmPrompt includes root URL and site type", () => {
    const prompt = buildLlmPrompt("https://example.com", "blog", 16);
    expect(prompt).toContain("https://example.com");
    expect(prompt).toContain("blog");
    expect(prompt).toContain("16");
    expect(prompt).toContain("JSON");
  });
  it("renderLlmResult parses valid JSON array", () => {
    const text = `Here are some URLs: ${JSON.stringify([
      { loc: "https://a.com/x", priority: 0.8, changefreq: "weekly", section: "blog" },
      { loc: "https://a.com/y", priority: 0.6, changefreq: "monthly", section: "about" },
    ])}`;
    const out = renderLlmResult(text);
    expect(out).toHaveLength(2);
    expect(out[0].loc).toBe("https://a.com/x");
    expect(out[0].priority).toBe(0.8);
    expect(out[0].changefreq).toBe("weekly");
  });
  it("renderLlmResult returns empty for no JSON", () => {
    expect(renderLlmResult("no json here")).toEqual([]);
  });
  it("renderLlmResult clamps invalid priority", () => {
    const text = JSON.stringify([
      { loc: "https://a.com/x", priority: 5, changefreq: "weekly", section: "blog" },
    ]);
    const out = renderLlmResult(text);
    expect(out[0].priority).toBe(1);
  });
  it("renderLlmResult falls back to monthly for invalid changefreq", () => {
    const text = JSON.stringify([
      { loc: "https://a.com/x", priority: 0.5, changefreq: "invalid", section: "blog" },
    ]);
    const out = renderLlmResult(text);
    expect(out[0].changefreq).toBe("monthly");
  });
});

// Suppress unused-import lint
export type _Unused = SiteType;
