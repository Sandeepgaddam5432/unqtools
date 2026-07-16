import { describe, it, expect, beforeEach } from "vitest";
import {
  USER_AGENT_PRESETS,
  isValidUserAgent,
  isValidPath,
  isValidWildcardPath,
  isValidSitemapUrl,
  isValidCrawlDelay,
  validateInput,
  buildGroupBlock,
  generateRobotsTxt,
  computeStats,
  pathMatchesPattern,
  parseRobotsTxt,
  loadHistory,
  saveHistory,
  clearHistory,
  type RobotsInput,
  type RobotsGroup,
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

describe("robots-txt-generator USER_AGENT_PRESETS", () => {
  it("includes common bots", () => {
    const values = USER_AGENT_PRESETS.map((p) => p.value);
    expect(values).toContain("*");
    expect(values).toContain("Googlebot");
    expect(values).toContain("Bingbot");
    expect(values).toContain("GPTBot");
  });
});

describe("robots-txt-generator validators", () => {
  it("isValidUserAgent accepts non-empty strings", () => {
    expect(isValidUserAgent("Googlebot")).toBe(true);
    expect(isValidUserAgent("")).toBe(false);
    expect(isValidUserAgent("  ")).toBe(false);
  });
  it("isValidPath requires leading slash", () => {
    expect(isValidPath("/path")).toBe(true);
    expect(isValidPath("path")).toBe(false);
  });
  it("isValidPath accepts empty", () => {
    expect(isValidPath("")).toBe(false);
  });
  it("isValidWildcardPath accepts simple paths", () => {
    expect(isValidWildcardPath("/private/")).toBe(true);
  });
  it("isValidWildcardPath accepts single wildcard", () => {
    expect(isValidWildcardPath("/*.pdf$")).toBe(true);
    expect(isValidWildcardPath("/*?")).toBe(true);
  });
  it("isValidWildcardPath rejects multiple stars", () => {
    expect(isValidWildcardPath("/*/*")).toBe(false);
  });
  it("isValidWildcardPath rejects $ not at end", () => {
    expect(isValidWildcardPath("/x$y")).toBe(false);
  });
  it("isValidSitemapUrl accepts https", () => {
    expect(isValidSitemapUrl("https://example.com/sitemap.xml")).toBe(true);
  });
  it("isValidSitemapUrl rejects bad strings", () => {
    expect(isValidSitemapUrl("not-a-url")).toBe(false);
  });
  it("isValidCrawlDelay accepts 0-30", () => {
    expect(isValidCrawlDelay(0)).toBe(true);
    expect(isValidCrawlDelay(10)).toBe(true);
    expect(isValidCrawlDelay(30)).toBe(true);
  });
  it("isValidCrawlDelay rejects out-of-range", () => {
    expect(isValidCrawlDelay(31)).toBe(false);
    expect(isValidCrawlDelay(-1)).toBe(false);
  });
});

describe("robots-txt-generator validateInput", () => {
  it("warns on empty input", () => {
    const r = validateInput({ groups: [], sitemaps: [], comments: [] });
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("errors on empty user-agent", () => {
    const r = validateInput({
      groups: [{ userAgent: "", rules: [{ path: "/x", allow: false }] }],
      sitemaps: [],
      comments: [],
    });
    expect(r.ok).toBe(false);
  });
  it("errors on invalid path", () => {
    const r = validateInput({
      groups: [{ userAgent: "*", rules: [{ path: "no-slash", allow: false }] }],
      sitemaps: [],
      comments: [],
    });
    expect(r.ok).toBe(false);
  });
  it("errors on invalid sitemap URL", () => {
    const r = validateInput({
      groups: [],
      sitemaps: ["bad-url"],
      comments: [],
    });
    expect(r.ok).toBe(false);
  });
  it("errors on invalid crawl-delay", () => {
    const r = validateInput({
      groups: [{ userAgent: "*", rules: [], crawlDelay: 100 }],
      sitemaps: [],
      comments: [],
    });
    expect(r.ok).toBe(false);
  });
  it("passes for valid input", () => {
    const r = validateInput({
      groups: [{ userAgent: "*", rules: [{ path: "/private/", allow: false }] }],
      sitemaps: ["https://example.com/sitemap.xml"],
      comments: [],
    });
    expect(r.ok).toBe(true);
  });
});

describe("robots-txt-generator buildGroupBlock", () => {
  it("builds a User-agent + Disallow block", () => {
    const block = buildGroupBlock({
      userAgent: "*",
      rules: [{ path: "/private/", allow: false }],
    });
    expect(block).toContain("User-agent: *");
    expect(block).toContain("Disallow: /private/");
  });
  it("uses Allow for allow rules", () => {
    const block = buildGroupBlock({
      userAgent: "Googlebot",
      rules: [{ path: "/public/", allow: true }],
    });
    expect(block).toContain("Allow: /public/");
  });
  it("includes crawl-delay when set", () => {
    const block = buildGroupBlock({
      userAgent: "*",
      rules: [],
      crawlDelay: 5,
    });
    expect(block).toContain("Crawl-delay: 5");
  });
});

describe("robots-txt-generator generateRobotsTxt", () => {
  it("produces a complete robots.txt with groups and sitemap", () => {
    const out = generateRobotsTxt({
      groups: [
        { userAgent: "*", rules: [{ path: "/private/", allow: false }] },
        { userAgent: "Googlebot", rules: [{ path: "/no-google/", allow: false }] },
      ],
      sitemaps: ["https://example.com/sitemap.xml"],
      comments: ["This is a comment"],
    });
    expect(out).toContain("# This is a comment");
    expect(out).toContain("User-agent: *");
    expect(out).toContain("Disallow: /private/");
    expect(out).toContain("User-agent: Googlebot");
    expect(out).toContain("Sitemap: https://example.com/sitemap.xml");
  });
  it("throws on invalid input", () => {
    expect(() => generateRobotsTxt({
      groups: [{ userAgent: "", rules: [] }],
      sitemaps: [],
      comments: [],
    })).toThrow();
  });
  it("handles multiple rules in one group", () => {
    const out = generateRobotsTxt({
      groups: [{
        userAgent: "*",
        rules: [
          { path: "/private/", allow: false },
          { path: "/public/", allow: true },
        ],
      }],
      sitemaps: [],
      comments: [],
    });
    expect(out).toContain("Disallow: /private/");
    expect(out).toContain("Allow: /public/");
  });
});

describe("robots-txt-generator computeStats", () => {
  it("counts groups, rules, sitemaps, comments", () => {
    const input: RobotsInput = {
      groups: [
        { userAgent: "*", rules: [{ path: "/a", allow: false }, { path: "/b", allow: false }] },
        { userAgent: "Googlebot", rules: [{ path: "/c", allow: false }] },
      ],
      sitemaps: ["https://example.com/s.xml"],
      comments: ["note"],
    };
    const stats = computeStats(input);
    expect(stats.groupCount).toBe(2);
    expect(stats.totalRules).toBe(3);
    expect(stats.sitemapCount).toBe(1);
    expect(stats.commentCount).toBe(1);
  });
});

describe("robots-txt-generator pathMatchesPattern", () => {
  it("matches exact path", () => {
    expect(pathMatchesPattern("/private/x", "/private/")).toBe(true);
  });
  it("matches wildcard *", () => {
    expect(pathMatchesPattern("/any.pdf", "/*.pdf$")).toBe(true);
    expect(pathMatchesPattern("/any.pdf.html", "/*.pdf$")).toBe(false);
  });
  it("matches without $ as prefix", () => {
    expect(pathMatchesPattern("/foo/bar", "/foo")).toBe(true);
    expect(pathMatchesPattern("/baz", "/foo")).toBe(false);
  });
  it("empty pattern matches everything", () => {
    expect(pathMatchesPattern("/anything", "")).toBe(true);
    expect(pathMatchesPattern("/anything", "/")).toBe(true);
  });
});

describe("robots-txt-generator parseRobotsTxt", () => {
  it("parses a simple robots.txt", () => {
    const raw = `User-agent: *\nDisallow: /private/\n\nSitemap: https://example.com/s.xml`;
    const parsed = parseRobotsTxt(raw);
    expect(parsed.groups).toHaveLength(1);
    expect(parsed.groups[0].userAgent).toBe("*");
    expect(parsed.groups[0].rules).toHaveLength(1);
    expect(parsed.sitemaps).toContain("https://example.com/s.xml");
  });
  it("parses comments", () => {
    const parsed = parseRobotsTxt("# Comment\nUser-agent: *\nDisallow: /x");
    expect(parsed.comments).toContain("Comment");
  });
  it("parses Allow directives", () => {
    const parsed = parseRobotsTxt("User-agent: *\nAllow: /public/");
    expect(parsed.groups[0].rules[0].allow).toBe(true);
  });
  it("parses Crawl-delay", () => {
    const parsed = parseRobotsTxt("User-agent: *\nCrawl-delay: 5");
    expect(parsed.groups[0].crawlDelay).toBe(5);
  });
});

describe("robots-txt-generator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, snippet: "User-agent: *" });
    saveHistory({ ts: 2, snippet: "User-agent: G" });
    expect(loadHistory()).toHaveLength(2);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, snippet: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, snippet: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});
