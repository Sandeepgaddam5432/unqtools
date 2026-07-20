import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  ROBOTS_DIRECTIVES,
  OG_TYPES,
  TWITTER_CARDS,
  JSON_LD_TYPES,
  PREVIEW_PLATFORMS,
  CHARACTER_LIMITS,
  PIXEL_LIMITS,
  DEFAULT_INPUT,
  SAMPLE_PAGES,
  HONESTY_NOTES,
  STOP_WORDS,
  normalizeUrl,
  isValidUrl,
  normalizeText,
  measurePixelWidth,
  truncateForPreview,
  measureTitleLength,
  measureDescriptionLength,
  buildTitleTag,
  buildDescriptionTag,
  buildCanonicalTag,
  buildRobotsTag,
  buildOgTags,
  buildTwitterTags,
  buildOtherTags,
  normalizeTwitterHandle,
  buildMetaTags,
  buildJsonLd,
  buildGooglePreview,
  buildFacebookPreview,
  buildXPreview,
  buildLinkedInPreview,
  buildSlackPreview,
  buildDiscordPreview,
  buildAllPreviews,
  prettyUrlForPreview,
  extractDomain,
  extractKeywords,
  suggestTitleFromContent,
  suggestDescriptionFromContent,
  renderHtml,
  renderJsonLdScript,
  buildLlmPrompt,
  renderLlmResult,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PageMetaInput,
  type RobotsDirective,
  type OGType,
  type TwitterCard,
  type PreviewPlatform,
  type JsonLdType,
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

// ---------- Constants ----------

describe("meta-tag-builder constants", () => {
  it("has 6 robots directives", () => {
    expect(ROBOTS_DIRECTIVES).toHaveLength(6);
  });
  it("has 4 OG types", () => {
    expect(OG_TYPES).toHaveLength(4);
  });
  it("has 3 Twitter card types", () => {
    expect(TWITTER_CARDS).toHaveLength(3);
  });
  it("has 4 JSON-LD types", () => {
    expect(JSON_LD_TYPES).toHaveLength(4);
  });
  it("has 6 preview platforms", () => {
    expect(PREVIEW_PLATFORMS).toHaveLength(6);
  });
  it("exposes HISTORY_KEY and HISTORY_MAX=20", () => {
    expect(HISTORY_KEY).toContain("ai-meta-tag-builder");
    expect(HISTORY_MAX).toBe(20);
  });
  it("has character limits for all 6 platforms", () => {
    for (const p of ["google", "facebook", "x", "linkedin", "slack", "discord"] as PreviewPlatform[]) {
      expect(CHARACTER_LIMITS[p].title).toBeGreaterThan(0);
      expect(CHARACTER_LIMITS[p].description).toBeGreaterThan(0);
    }
  });
  it("has pixel limits for all 6 platforms", () => {
    for (const p of ["google", "facebook", "x", "linkedin", "slack", "discord"] as PreviewPlatform[]) {
      expect(PIXEL_LIMITS[p].title).toBeGreaterThan(0);
      expect(PIXEL_LIMITS[p].description).toBeGreaterThan(0);
    }
  });
  it("default input has sane values", () => {
    expect(DEFAULT_INPUT.ogType).toBe("website");
    expect(DEFAULT_INPUT.twitterCard).toBe("summary_large_image");
    expect(DEFAULT_INPUT.robots).toBe("index,follow");
    expect(DEFAULT_INPUT.imageWidth).toBe(1200);
    expect(DEFAULT_INPUT.imageHeight).toBe(630);
  });
  it("has 3 sample pages", () => {
    expect(SAMPLE_PAGES).toHaveLength(3);
  });
  it("has honesty notes", () => {
    expect(HONESTY_NOTES.length).toBeGreaterThanOrEqual(3);
  });
  it("has stop words", () => {
    expect(STOP_WORDS.size).toBeGreaterThan(20);
    expect(STOP_WORDS.has("the")).toBe(true);
  });
});

// ---------- URL helpers ----------

describe("meta-tag-builder normalizeUrl", () => {
  it("returns empty for empty input", () => {
    expect(normalizeUrl("")).toBe("");
  });
  it("preserves https://", () => {
    expect(normalizeUrl("https://example.com")).toBe("https://example.com");
  });
  it("preserves http://", () => {
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
  });
  it("adds https:// when missing scheme", () => {
    expect(normalizeUrl("example.com")).toBe("https://example.com");
  });
  it("handles protocol-relative URLs", () => {
    expect(normalizeUrl("//example.com")).toBe("https://example.com");
  });
  it("trims whitespace", () => {
    expect(normalizeUrl("  https://example.com  ")).toBe("https://example.com");
  });
});

describe("meta-tag-builder isValidUrl", () => {
  it("validates proper URLs", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
  });
  it("validates URLs missing scheme", () => {
    expect(isValidUrl("example.com")).toBe(true);
  });
  it("rejects empty", () => {
    expect(isValidUrl("")).toBe(false);
  });
  it("rejects strings without a hostname dot", () => {
    expect(isValidUrl("not-a-url")).toBe(false);
  });
});

describe("meta-tag-builder normalizeText", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeText("  hello   world  ")).toBe("hello world");
  });
  it("handles empty", () => {
    expect(normalizeText("")).toBe("");
  });
});

// ---------- Pixel width + truncation ----------

describe("meta-tag-builder measurePixelWidth", () => {
  it("returns 0 for empty string", () => {
    expect(measurePixelWidth("")).toBe(0);
  });
  it("returns positive width for non-empty string", () => {
    expect(measurePixelWidth("Hello World")).toBeGreaterThan(0);
  });
  it("narrow chars measure smaller than wide chars of same length", () => {
    expect(measurePixelWidth("iiiii")).toBeLessThan(measurePixelWidth("WWWWW"));
  });
  it("scales with font size", () => {
    const w18 = measurePixelWidth("Hello", 18);
    const w36 = measurePixelWidth("Hello", 36);
    expect(w36).toBeGreaterThan(w18);
  });
});

describe("meta-tag-builder truncateForPreview", () => {
  it("returns text unchanged if within limit", () => {
    const r = truncateForPreview("Short text", 100);
    expect(r.text).toBe("Short text");
    expect(r.truncated).toBe(false);
  });
  it("truncates with ellipsis when over limit", () => {
    const r = truncateForPreview("This is a long sentence that exceeds the limit", 20);
    expect(r.text.endsWith("…")).toBe(true);
    expect(r.truncated).toBe(true);
    expect(r.text.length).toBeLessThanOrEqual(21);
  });
  it("truncates at word boundary when possible", () => {
    const r = truncateForPreview("Hello world this is long", 15);
    expect(r.text).not.toContain("world this");
  });
  it("handles empty text", () => {
    const r = truncateForPreview("", 100);
    expect(r.text).toBe("");
    expect(r.truncated).toBe(false);
  });
});

// ---------- Length checks ----------

describe("meta-tag-builder measureTitleLength", () => {
  it("returns good status for short title", () => {
    const c = measureTitleLength("Hello", "google");
    expect(c.status).toBe("good");
    expect(c.chars).toBe(5);
    expect(c.pixels).toBeGreaterThan(0);
  });
  it("returns bad status for very long title", () => {
    const c = measureTitleLength("A".repeat(100), "google");
    expect(c.status).toBe("bad");
  });
  it("returns warn status near limit", () => {
    // Lowercase 'a' is normal-width (~10px each) → 55 chars = 550px, 550/600 = 0.917 → warn.
    const c = measureTitleLength("a".repeat(55), "google");
    expect(c.status).toBe("warn");
  });
  it("different platforms have different limits", () => {
    const g = measureTitleLength("A".repeat(60), "google");
    const x = measureTitleLength("A".repeat(60), "x");
    expect(g.maxChars).not.toBe(x.maxChars);
  });
});

describe("meta-tag-builder measureDescriptionLength", () => {
  it("returns good status for short description", () => {
    const c = measureDescriptionLength("Short description", "google");
    expect(c.status).toBe("good");
  });
  it("returns bad status for very long description", () => {
    const c = measureDescriptionLength("A".repeat(300), "google");
    expect(c.status).toBe("bad");
  });
});

// ---------- Meta tag builders ----------

describe("meta-tag-builder buildTitleTag / buildDescriptionTag", () => {
  it("builds title with normalized text", () => {
    const title = buildTitleTag({ ...DEFAULT_INPUT, title: "  Hello   World  " });
    expect(title).toBe("Hello World");
  });
  it("builds description with normalized text", () => {
    const desc = buildDescriptionTag({ ...DEFAULT_INPUT, description: "  A   description.  " });
    expect(desc).toBe("A description.");
  });
});

describe("meta-tag-builder buildCanonicalTag", () => {
  it("normalizes URL", () => {
    const c = buildCanonicalTag({ ...DEFAULT_INPUT, url: "example.com" });
    expect(c).toBe("https://example.com");
  });
  it("returns empty for empty URL", () => {
    expect(buildCanonicalTag({ ...DEFAULT_INPUT, url: "" })).toBe("");
  });
});

describe("meta-tag-builder buildRobotsTag", () => {
  it("returns the directive", () => {
    expect(buildRobotsTag({ ...DEFAULT_INPUT, robots: "noindex,follow" })).toBe("noindex,follow");
  });
});

describe("meta-tag-builder buildOgTags", () => {
  it("includes og:title, og:description, og:url, og:type", () => {
    const input: PageMetaInput = {
      ...DEFAULT_INPUT,
      title: "Hello",
      description: "World",
      url: "https://example.com",
      ogType: "article",
    };
    const tags = buildOgTags(input);
    const keys = tags.map((t) => t.key);
    expect(keys).toContain("og:title");
    expect(keys).toContain("og:description");
    expect(keys).toContain("og:url");
    expect(keys).toContain("og:type");
  });
  it("includes og:image and dimensions when image present", () => {
    const input: PageMetaInput = {
      ...DEFAULT_INPUT,
      imageUrl: "https://example.com/img.png",
      imageWidth: 1200,
      imageHeight: 630,
    };
    const tags = buildOgTags(input);
    const keys = tags.map((t) => t.key);
    expect(keys).toContain("og:image");
    expect(keys).toContain("og:image:width");
    expect(keys).toContain("og:image:height");
  });
  it("includes og:site_name and og:locale when present", () => {
    const input: PageMetaInput = {
      ...DEFAULT_INPUT,
      siteName: "My Site",
      locale: "en_US",
    };
    const tags = buildOgTags(input);
    const keys = tags.map((t) => t.key);
    expect(keys).toContain("og:site_name");
    expect(keys).toContain("og:locale");
  });
  it("omits og:title when title empty", () => {
    const tags = buildOgTags({ ...DEFAULT_INPUT, title: "" });
    expect(tags.some((t) => t.key === "og:title")).toBe(false);
  });
});

describe("meta-tag-builder buildTwitterTags", () => {
  it("includes twitter:card always", () => {
    const tags = buildTwitterTags(DEFAULT_INPUT);
    expect(tags.some((t) => t.key === "twitter:card")).toBe(true);
  });
  it("includes twitter:title when title present", () => {
    const tags = buildTwitterTags({ ...DEFAULT_INPUT, title: "Hi" });
    expect(tags.some((t) => t.key === "twitter:title")).toBe(true);
  });
  it("includes twitter:site when present", () => {
    const tags = buildTwitterTags({ ...DEFAULT_INPUT, twitterSite: "@me" });
    expect(tags.some((t) => t.key === "twitter:site")).toBe(true);
  });
});

describe("meta-tag-builder normalizeTwitterHandle", () => {
  it("adds @ if missing", () => {
    expect(normalizeTwitterHandle("me")).toBe("@me");
  });
  it("preserves @", () => {
    expect(normalizeTwitterHandle("@me")).toBe("@me");
  });
  it("returns empty for empty input", () => {
    expect(normalizeTwitterHandle("")).toBe("");
  });
});

describe("meta-tag-builder buildOtherTags", () => {
  it("always includes robots", () => {
    const tags = buildOtherTags(DEFAULT_INPUT);
    expect(tags.some((t) => t.key === "robots")).toBe(true);
  });
  it("includes keywords when provided", () => {
    const tags = buildOtherTags({ ...DEFAULT_INPUT, keywords: ["seo", "meta"] });
    const kw = tags.find((t) => t.key === "keywords");
    expect(kw?.content).toBe("seo, meta");
  });
});

describe("meta-tag-builder buildMetaTags", () => {
  it("returns a complete set", () => {
    const input: PageMetaInput = {
      ...DEFAULT_INPUT,
      title: "Hello",
      description: "World",
      url: "https://example.com",
      ogType: "website",
      twitterCard: "summary_large_image",
      robots: "index,follow",
    };
    const set = buildMetaTags(input);
    expect(set.title).toBe("Hello");
    expect(set.description).toBe("World");
    expect(set.canonical).toBe("https://example.com");
    expect(set.robots).toBe("index,follow");
    expect(set.ogTags.length).toBeGreaterThan(0);
    expect(set.twitterTags.length).toBeGreaterThan(0);
    expect(set.otherTags.length).toBeGreaterThan(0);
  });
  it("returns null jsonLd when type is empty", () => {
    const set = buildMetaTags({ ...DEFAULT_INPUT, jsonLdType: "" });
    expect(set.jsonLd).toBeNull();
  });
  it("returns jsonLd when type is set", () => {
    const set = buildMetaTags({ ...DEFAULT_INPUT, jsonLdType: "Article" });
    expect(set.jsonLd).not.toBeNull();
    expect(set.jsonLd?.["@type"]).toBe("Article");
  });
});

// ---------- JSON-LD ----------

describe("meta-tag-builder buildJsonLd", () => {
  it("builds Article with headline, description, image", () => {
    const ld = buildJsonLd({
      ...DEFAULT_INPUT,
      title: "Hello",
      description: "World",
      url: "https://example.com/a",
      imageUrl: "https://example.com/i.png",
      siteName: "Site",
      jsonLdType: "Article",
    });
    expect(ld?.["@context"]).toBe("https://schema.org");
    expect(ld?.["@type"]).toBe("Article");
    expect(ld?.headline).toBe("Hello");
    expect(ld?.description).toBe("World");
    expect(ld?.image).toBe("https://example.com/i.png");
  });
  it("builds Product with name and brand", () => {
    const ld = buildJsonLd({
      ...DEFAULT_INPUT,
      title: "Widget",
      siteName: "Acme",
      jsonLdType: "Product",
      jsonLdData: { brand: "Acme", price: "9.99" },
    });
    expect(ld?.["@type"]).toBe("Product");
    expect(ld?.name).toBe("Widget");
  });
  it("builds Website with name and url", () => {
    const ld = buildJsonLd({
      ...DEFAULT_INPUT,
      title: "Site",
      url: "https://example.com",
      jsonLdType: "Website",
    });
    expect(ld?.["@type"]).toBe("WebSite");
    expect(ld?.name).toBe("Site");
    expect(ld?.url).toBe("https://example.com");
  });
  it("builds BreadcrumbList", () => {
    const ld = buildJsonLd({
      ...DEFAULT_INPUT,
      siteName: "Home",
      url: "https://example.com",
      jsonLdType: "BreadcrumbList",
    });
    expect(ld?.["@type"]).toBe("BreadcrumbList");
    expect(Array.isArray(ld?.itemListElement)).toBe(true);
  });
  it("merges extra jsonLdData fields", () => {
    const ld = buildJsonLd({
      ...DEFAULT_INPUT,
      jsonLdType: "Article",
      jsonLdData: { author: "Jane", datePublished: "2025-01-01" },
    });
    expect(ld?.author).toBe("Jane");
    expect(ld?.datePublished).toBe("2025-01-01");
  });
  it("returns null for empty type", () => {
    expect(buildJsonLd({ ...DEFAULT_INPUT, jsonLdType: "" })).toBeNull();
  });
});

// ---------- Previews ----------

describe("meta-tag-builder previews", () => {
  const input: PageMetaInput = {
    ...DEFAULT_INPUT,
    title: "Hello World This Is A Title",
    description: "This is a meta description that should be visible in the search results snippet.",
    url: "https://example.com/page",
    siteName: "Example",
    imageUrl: "https://example.com/img.png",
  };
  it("buildGooglePreview strips https://", () => {
    const p = buildGooglePreview(input);
    expect(p.url).toBe("example.com/page");
    expect(p.title.length).toBeLessThanOrEqual(63);
    expect(p.description.length).toBeLessThanOrEqual(163);
  });
  it("buildFacebookPreview includes image", () => {
    const p = buildFacebookPreview(input);
    expect(p.imageUrl).toBe("https://example.com/img.png");
    expect(p.platform).toBe("facebook");
  });
  it("buildXPreview sets platform", () => {
    const p = buildXPreview(input);
    expect(p.platform).toBe("x");
  });
  it("buildLinkedInPreview sets platform", () => {
    const p = buildLinkedInPreview(input);
    expect(p.platform).toBe("linkedin");
  });
  it("buildSlackPreview sets platform", () => {
    const p = buildSlackPreview(input);
    expect(p.platform).toBe("slack");
  });
  it("buildDiscordPreview sets platform", () => {
    const p = buildDiscordPreview(input);
    expect(p.platform).toBe("discord");
  });
  it("buildAllPreviews returns 6 previews", () => {
    const all = buildAllPreviews(input);
    expect(all).toHaveLength(6);
    const platforms = all.map((p) => p.platform);
    expect(platforms).toEqual(["google", "facebook", "x", "linkedin", "slack", "discord"]);
  });
  it("truncates long title in google preview", () => {
    const longInput = { ...input, title: "A".repeat(100) };
    const p = buildGooglePreview(longInput);
    expect(p.titleTruncated).toBe(true);
    expect(p.title.endsWith("…")).toBe(true);
  });
});

describe("meta-tag-builder prettyUrlForPreview + extractDomain", () => {
  it("strips https://", () => {
    expect(prettyUrlForPreview("https://example.com/p")).toBe("example.com/p");
  });
  it("strips http://", () => {
    expect(prettyUrlForPreview("http://example.com/p")).toBe("example.com/p");
  });
  it("returns empty for empty input", () => {
    expect(prettyUrlForPreview("")).toBe("");
  });
  it("extractDomain returns hostname without www.", () => {
    expect(extractDomain("https://www.example.com/p")).toBe("example.com");
  });
  it("extractDomain returns empty for invalid URL", () => {
    expect(extractDomain("not-a-url")).toBe("");
  });
});

// ---------- On-device AI drafting ----------

describe("meta-tag-builder extractKeywords", () => {
  it("extracts top keywords", () => {
    const kw = extractKeywords("SEO is great. SEO matters. Meta tags are great too.");
    expect(kw.length).toBeGreaterThan(0);
    expect(kw).toContain("seo");
  });
  it("filters stop words", () => {
    const kw = extractKeywords("the cat is on the mat");
    expect(kw).not.toContain("the");
    expect(kw).not.toContain("is");
    expect(kw).not.toContain("on");
  });
  it("returns empty for empty text", () => {
    expect(extractKeywords("")).toEqual([]);
  });
  it("respects limit", () => {
    const kw = extractKeywords("alpha beta gamma delta epsilon zeta eta theta iota", 3);
    expect(kw.length).toBeLessThanOrEqual(3);
  });
});

describe("meta-tag-builder suggestTitleFromContent", () => {
  it("suggests a title from first sentence", () => {
    const t = suggestTitleFromContent("The Complete Guide to SEO. This is a long article.");
    expect(t).toContain("Complete Guide to SEO");
    expect(t.length).toBeLessThanOrEqual(63);
  });
  it("returns empty for empty text", () => {
    expect(suggestTitleFromContent("")).toBe("");
  });
});

describe("meta-tag-builder suggestDescriptionFromContent", () => {
  it("suggests a description from first two sentences", () => {
    const d = suggestDescriptionFromContent("First sentence here. Second sentence is here. Third.");
    expect(d).toContain("First sentence");
    expect(d).toContain("Second sentence");
  });
  it("returns empty for empty text", () => {
    expect(suggestDescriptionFromContent("")).toBe("");
  });
});

// ---------- Rendering ----------

describe("meta-tag-builder renderHtml", () => {
  it("renders <title> tag", () => {
    const set = buildMetaTags({ ...DEFAULT_INPUT, title: "Hello" });
    const html = renderHtml(set);
    expect(html).toContain("<title>Hello</title>");
  });
  it("renders canonical link", () => {
    const set = buildMetaTags({ ...DEFAULT_INPUT, url: "https://example.com" });
    const html = renderHtml(set);
    expect(html).toContain('<link rel="canonical" href="https://example.com"');
  });
  it("renders robots meta", () => {
    const set = buildMetaTags({ ...DEFAULT_INPUT });
    const html = renderHtml(set);
    expect(html).toContain('<meta name="robots"');
  });
  it("renders Open Graph tags", () => {
    const set = buildMetaTags({ ...DEFAULT_INPUT, title: "Hi", url: "https://example.com" });
    const html = renderHtml(set);
    expect(html).toContain("og:title");
    expect(html).toContain("og:url");
  });
  it("renders Twitter Card tags", () => {
    const set = buildMetaTags({ ...DEFAULT_INPUT });
    const html = renderHtml(set);
    expect(html).toContain("twitter:card");
  });
  it("renders JSON-LD script when present", () => {
    const set = buildMetaTags({ ...DEFAULT_INPUT, jsonLdType: "Article" });
    const html = renderHtml(set);
    expect(html).toContain("application/ld+json");
  });
  it("escapes HTML in content", () => {
    const set = buildMetaTags({ ...DEFAULT_INPUT, title: '<script>alert(1)</script>' });
    const html = renderHtml(set);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
  });
});

describe("meta-tag-builder renderJsonLdScript", () => {
  it("renders script tag with JSON content", () => {
    const ld = buildJsonLd({ ...DEFAULT_INPUT, jsonLdType: "Article" });
    const script = renderJsonLdScript(ld!);
    expect(script).toContain('type="application/ld+json"');
    expect(script).toContain("@context");
    expect(script).toContain("@type");
  });
});

// ---------- LLM helpers ----------

describe("meta-tag-builder buildLlmPrompt", () => {
  it("includes page content and instructions", () => {
    const prompt = buildLlmPrompt("Page content here", "Current Title", "Current Desc");
    expect(prompt).toContain("PAGE CONTENT:");
    expect(prompt).toContain("Page content here");
    expect(prompt).toContain("Current Title");
    expect(prompt).toContain("Current Desc");
  });
  it("handles empty current title/desc", () => {
    const prompt = buildLlmPrompt("Content", "", "");
    expect(prompt).toContain("(none)");
  });
});

describe("meta-tag-builder renderLlmResult", () => {
  it("parses TITLE and DESCRIPTION", () => {
    const out = renderLlmResult("TITLE: My Title\nDESCRIPTION: My description.");
    expect(out.title).toBe("My Title");
    expect(out.description).toBe("My description.");
  });
  it("returns empty for empty input", () => {
    expect(renderLlmResult("")).toEqual({ title: "", description: "" });
  });
  it("handles missing DESCRIPTION", () => {
    const out = renderLlmResult("TITLE: Just a title");
    expect(out.title).toBe("Just a title");
    expect(out.description).toBe("");
  });
});

// ---------- History ----------

describe("meta-tag-builder history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      title: "Hello",
      description: "World",
      url: "https://example.com",
      ogType: "website",
      twitterCard: "summary_large_image",
      robots: "index,follow",
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].title).toBe("Hello");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        title: `T${i}`,
        description: "D",
        url: "https://example.com",
        ogType: "website",
        twitterCard: "summary",
        robots: "index,follow",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, title: "T", description: "D", url: "https://example.com",
      ogType: "website", twitterCard: "summary", robots: "index,follow",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("prepends new entry", () => {
    saveHistory({
      ts: 1, title: "First", description: "", url: "",
      ogType: "website", twitterCard: "summary", robots: "index,follow",
    });
    saveHistory({
      ts: 2, title: "Second", description: "", url: "",
      ogType: "website", twitterCard: "summary", robots: "index,follow",
    });
    expect(loadHistory()[0].title).toBe("Second");
  });
});

// ---------- Shareable URL ----------

describe("meta-tag-builder shareable URL", () => {
  const input: PageMetaInput = {
    ...DEFAULT_INPUT,
    title: "Hello World",
    description: "Test description",
    url: "https://example.com/page",
    siteName: "Example",
    imageUrl: "https://example.com/img.png",
    imageWidth: 1200,
    imageHeight: 630,
    ogType: "article",
    twitterCard: "summary_large_image",
    robots: "noindex,follow",
    twitterSite: "@me",
    twitterCreator: "@you",
    locale: "en_US",
    keywords: ["seo", "meta"],
    jsonLdType: "Article",
  };
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(input);
    expect(url).toContain("title=Hello+World");
    expect(url).toContain("ogtype=article");
    expect(url).toContain("robots=noindex%2Cfollow");
    expect(url).toContain("ld=Article");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(input);
    const hash = url.slice(url.indexOf("?") + 1);
    const parsed = parseShareUrl(hash);
    expect(parsed.title).toBe("Hello World");
    expect(parsed.url).toBe("https://example.com/page");
    expect(parsed.ogType).toBe("article");
    expect(parsed.robots).toBe("noindex,follow");
    expect(parsed.jsonLdType).toBe("Article");
    expect(parsed.keywords).toEqual(["seo", "meta"]);
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses empty hash to defaults", () => {
    const p = parseShareUrl("");
    expect(p.title).toBe("");
    expect(p.ogType).toBe("website");
    expect(p.robots).toBe("index,follow");
  });
  it("filters unknown enum values", () => {
    const p = parseShareUrl("ogtype=invalid&robots=invalid&twcard=invalid&ld=invalid");
    expect(p.ogType).toBe("website");
    expect(p.robots).toBe("index,follow");
    expect(p.twitterCard).toBe("summary_large_image");
    expect(p.jsonLdType).toBe("");
  });
});

// Suppress unused-import lint
export type _Unused =
  | RobotsDirective | OGType | TwitterCard | PreviewPlatform | JsonLdType;
