import { describe, it, expect, beforeEach } from "vitest";
import {
  escapeHtml,
  countCharacters,
  estimatePixelWidth,
  truncateForPixelLimit,
  isValidUrl,
  buildTitleTag,
  buildDescriptionTag,
  buildKeywordsTag,
  buildAuthorTag,
  buildRobotsTag,
  buildViewportTag,
  buildCharsetTag,
  buildCanonicalTag,
  buildThemeColorTag,
  buildAppleWebAppTags,
  buildOpenGraphTags,
  buildTwitterCardTags,
  validateInput,
  generateMetaTags,
  buildPreviewData,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  TITLE_MAX,
  DESCRIPTION_MAX,
  type MetaTagInput,
} from "./logic";

beforeEach(() => {
  // Mock localStorage
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

describe("meta-tag-generator escapeHtml", () => {
  it("escapes ampersand, angle brackets, quotes", () => {
    expect(escapeHtml(`<a href="x">A & B</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;A &amp; B&lt;/a&gt;",
    );
  });
  it("returns empty string for empty input", () => {
    expect(escapeHtml("")).toBe("");
  });
});

describe("meta-tag-generator countCharacters", () => {
  it("returns correct counts within limit", () => {
    const c = countCharacters("Hello", 60);
    expect(c.value).toBe(5);
    expect(c.remaining).toBe(55);
    expect(c.isOver).toBe(false);
    expect(c.isWarn).toBe(false);
  });
  it("flags over-limit", () => {
    const c = countCharacters("x".repeat(70), 60);
    expect(c.isOver).toBe(true);
  });
  it("flags near-limit warning", () => {
    const c = countCharacters("x".repeat(58), 60);
    expect(c.isWarn).toBe(true);
    expect(c.isOver).toBe(false);
  });
});

describe("meta-tag-generator estimatePixelWidth", () => {
  it("returns 0 for empty string", () => {
    expect(estimatePixelWidth("")).toBe(0);
  });
  it("approximates width for latin text", () => {
    const w = estimatePixelWidth("Hello World");
    expect(w).toBeGreaterThan(50);
    expect(w).toBeLessThan(200);
  });
  it("doubles width for CJK characters", () => {
    const wCJK = estimatePixelWidth("中文");
    const wLatin = estimatePixelWidth("ab");
    expect(wCJK).toBeGreaterThan(wLatin);
  });
});

describe("meta-tag-generator truncateForPixelLimit", () => {
  it("returns full string when within limit", () => {
    const s = truncateForPixelLimit("Short", 600);
    expect(s).toBe("Short");
  });
  it("truncates with ellipsis when over limit", () => {
    const long = "x".repeat(200);
    const s = truncateForPixelLimit(long, 100);
    expect(s.endsWith("…")).toBe(true);
    expect(s.length).toBeLessThan(long.length);
  });
});

describe("meta-tag-generator isValidUrl", () => {
  it("accepts http URLs", () => {
    expect(isValidUrl("http://example.com")).toBe(true);
  });
  it("accepts https URLs", () => {
    expect(isValidUrl("https://example.com/page")).toBe(true);
  });
  it("rejects non-URL strings", () => {
    expect(isValidUrl("not a url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
  it("rejects ftp URLs", () => {
    expect(isValidUrl("ftp://example.com")).toBe(false);
  });
  it("accepts protocol-relative URLs", () => {
    expect(isValidUrl("//example.com/x")).toBe(true);
  });
});

describe("meta-tag-generator tag builders", () => {
  it("builds title tag", () => {
    expect(buildTitleTag("Hello")).toBe("<title>Hello</title>");
  });
  it("returns empty for blank title", () => {
    expect(buildTitleTag("")).toBe("");
    expect(buildTitleTag("   ")).toBe("");
  });
  it("escapes HTML in title", () => {
    expect(buildTitleTag("A & B <C>")).toBe("<title>A &amp; B &lt;C&gt;</title>");
  });
  it("builds description tag", () => {
    expect(buildDescriptionTag("My desc")).toBe(
      '<meta name="description" content="My desc" />',
    );
  });
  it("builds keywords tag", () => {
    expect(buildKeywordsTag("seo, html")).toBe(
      '<meta name="keywords" content="seo, html" />',
    );
  });
  it("builds author tag", () => {
    expect(buildAuthorTag("Jane Doe")).toBe('<meta name="author" content="Jane Doe" />');
  });
  it("builds robots tag with each directive", () => {
    expect(buildRobotsTag("index, follow")).toBe(
      '<meta name="robots" content="index, follow" />',
    );
    expect(buildRobotsTag("noindex, nofollow")).toBe(
      '<meta name="robots" content="noindex, nofollow" />',
    );
  });
  it("returns empty for missing robots", () => {
    expect(buildRobotsTag(undefined)).toBe("");
  });
  it("builds viewport tag with default", () => {
    expect(buildViewportTag(undefined)).toContain("width=device-width");
  });
  it("builds charset tag with default UTF-8", () => {
    expect(buildCharsetTag(undefined)).toBe('<meta charset="UTF-8" />');
  });
  it("builds canonical tag for valid URL", () => {
    expect(buildCanonicalTag("https://example.com/page")).toBe(
      '<link rel="canonical" href="https://example.com/page" />',
    );
  });
  it("returns null for invalid canonical", () => {
    expect(buildCanonicalTag("not a url")).toBeNull();
  });
  it("builds theme-color tag", () => {
    expect(buildThemeColorTag("#ff0000")).toBe(
      '<meta name="theme-color" content="#ff0000" />',
    );
  });
  it("builds apple-mobile-web-app tags when enabled", () => {
    const tags = buildAppleWebAppTags(true);
    expect(tags).toContain("apple-mobile-web-app-capable");
    expect(tags).toContain("apple-mobile-web-app-status-bar-style");
  });
  it("returns empty for apple-web-app when disabled", () => {
    expect(buildAppleWebAppTags(false)).toBe("");
  });
});

describe("meta-tag-generator Open Graph", () => {
  it("builds og tags from explicit values", () => {
    const out = buildOpenGraphTags({
      title: "T",
      description: "D",
      ogTitle: "OG T",
      ogDescription: "OG D",
      ogImage: "https://example.com/img.png",
      ogUrl: "https://example.com",
      ogSiteName: "Example",
    });
    expect(out).toContain('property="og:title"');
    expect(out).toContain("OG T");
    expect(out).toContain('property="og:image"');
    expect(out).toContain("img.png");
    expect(out).toContain('property="og:site_name"');
  });
  it("falls back to title/description when og values missing", () => {
    const out = buildOpenGraphTags({ title: "Fallback", description: "Desc" });
    expect(out).toContain("Fallback");
    expect(out).toContain("Desc");
  });
  it("throws on invalid og:image URL", () => {
    expect(() => buildOpenGraphTags({ ogImage: "not-a-url" })).toThrow(/invalid/i);
  });
  it("defaults og:type to website", () => {
    const out = buildOpenGraphTags({ title: "T" });
    expect(out).toContain('content="website"');
  });
});

describe("meta-tag-generator Twitter Card", () => {
  it("builds summary card by default", () => {
    const out = buildTwitterCardTags({ title: "T" });
    expect(out).toContain('name="twitter:card" content="summary"');
  });
  it("supports summary_large_image", () => {
    const out = buildTwitterCardTags({ title: "T", twitterCard: "summary_large_image" });
    expect(out).toContain("summary_large_image");
  });
  it("prepends @ to site handle if missing", () => {
    const out = buildTwitterCardTags({ title: "T", twitterSite: "example" });
    expect(out).toContain('content="@example"');
  });
  it("does not double-prepend @ when already present", () => {
    const out = buildTwitterCardTags({ title: "T", twitterSite: "@example" });
    expect(out).toContain('content="@example"');
    expect(out).not.toContain("@@example");
  });
});

describe("meta-tag-generator validateInput", () => {
  it("returns ok for valid input", () => {
    const r = validateInput({ title: "Hello", description: "World" });
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it("errors on missing title", () => {
    const r = validateInput({ title: "", description: "World" });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /title/i.test(e))).toBe(true);
  });
  it("warns on missing description", () => {
    const r = validateInput({ title: "Hello", description: "" });
    expect(r.warnings.some((w) => /description/i.test(w))).toBe(true);
  });
  it("errors on invalid canonical", () => {
    const r = validateInput({ title: "T", canonical: "bad-url" });
    expect(r.ok).toBe(false);
  });
  it("warns on very long title", () => {
    const r = validateInput({ title: "x".repeat(TITLE_MAX + 25), description: "d" });
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("warns on very long description", () => {
    const r = validateInput({
      title: "T",
      description: "x".repeat(DESCRIPTION_MAX + 50),
    });
    expect(r.warnings.some((w) => /description/i.test(w))).toBe(true);
  });
});

describe("meta-tag-generator generateMetaTags", () => {
  const baseInput: MetaTagInput = {
    title: "Hello World",
    description: "A sample page about the world.",
    keywords: "hello, world",
    author: "Jane",
    robots: "index, follow",
    canonical: "https://example.com/hello",
    themeColor: "#ffffff",
    appleWebApp: true,
  };

  it("produces a multi-line meta block", () => {
    const out = generateMetaTags(baseInput);
    expect(out).toContain("<title>Hello World</title>");
    expect(out).toContain('<meta charset="UTF-8" />');
    expect(out).toContain('<meta name="viewport"');
    expect(out).toContain('<meta name="description"');
    expect(out).toContain('<meta name="keywords"');
    expect(out).toContain('<meta name="author"');
    expect(out).toContain('<meta name="robots"');
    expect(out).toContain('<link rel="canonical"');
    expect(out).toContain('<meta name="theme-color"');
    expect(out).toContain("apple-mobile-web-app-capable");
  });
  it("throws on missing title", () => {
    expect(() => generateMetaTags({ title: "", description: "x" })).toThrow();
  });
  it("omits canonical when URL is invalid", () => {
    // Invalid canonical URL causes validation error — generateMetaTags throws
    expect(() => generateMetaTags({ title: "T", description: "D", canonical: "bad" })).toThrow();
  });
  it("includes Open Graph and Twitter tags", () => {
    const out = generateMetaTags({
      title: "T",
      description: "D",
      ogImage: "https://example.com/i.png",
    });
    expect(out).toContain("og:title");
    expect(out).toContain("twitter:card");
  });
});

describe("meta-tag-generator preview", () => {
  it("truncates long title in preview", () => {
    const p = buildPreviewData({ title: "x".repeat(200), description: "d" });
    expect(p.truncatedTitle.endsWith("…")).toBe(true);
  });
  it("preserves URL when present", () => {
    const p = buildPreviewData({
      title: "T",
      description: "D",
      canonical: "https://example.com/x",
    });
    expect(p.url).toBe("https://example.com/x");
  });
});

describe("meta-tag-generator history", () => {
  it("loads empty history initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads entries", () => {
    saveHistory({ ts: 1, title: "T1", description: "D1", snippet: "<title>T1</title>" });
    saveHistory({ ts: 2, title: "T2", description: "D2", snippet: "<title>T2</title>" });
    const h = loadHistory();
    expect(h).toHaveLength(2);
    expect(h[0].title).toBe("T2");
  });
  it("caps history at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, title: `T${i}`, description: "D", snippet: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({ ts: 1, title: "T", description: "D", snippet: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("meta-tag-generator shareable URL", () => {
  it("builds a query string when window is unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ title: "T", description: "D" });
    expect(url).toContain("title=T");
    expect(url).toContain("description=D");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to input", () => {
    const parsed = parseShareUrl("title=Hello&description=World");
    expect(parsed.title).toBe("Hello");
    expect(parsed.description).toBe("World");
  });
  it("parses boolean fields correctly", () => {
    const parsed = parseShareUrl("title=T&appleWebApp=1");
    expect(parsed.appleWebApp).toBe(true);
  });
  it("returns empty object for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
});
