/**
 * Meta Tag Generator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { generateMetaTags, generateHreflang } from "./logic";

const BASE_INPUT = {
  title: "Test Page",
  description: "A test page for unit testing.",
};

describe("generateMetaTags — basic validation", () => {
  it("errors on missing title", () => {
    expect("error" in generateMetaTags({ ...BASE_INPUT, title: "" })).toBe(true);
  });
  it("errors on missing description", () => {
    expect("error" in generateMetaTags({ ...BASE_INPUT, description: "" })).toBe(true);
  });
  it("errors on too-long title", () => {
    expect("error" in generateMetaTags({ ...BASE_INPUT, title: "x".repeat(201) })).toBe(true);
  });
  it("errors on too-long description", () => {
    expect("error" in generateMetaTags({ ...BASE_INPUT, description: "x".repeat(501) })).toBe(true);
  });
});

describe("generateMetaTags — basic tags", () => {
  it("generates charset, viewport, title, description", () => {
    const r = generateMetaTags(BASE_INPUT);
    if ("error" in r) throw new Error("Should not error");
    expect(r.basic).toContain("charset");
    expect(r.basic).toContain("viewport");
    expect(r.basic).toContain(`<title>${BASE_INPUT.title}</title>`);
    expect(r.basic).toContain(`name="description"`);
  });
  it("escapes HTML in title and description", () => {
    const r = generateMetaTags({ title: 'Test "quotes" & <tags>', description: 'Has < > & " characters' });
    if ("error" in r) throw new Error("Should not error");
    expect(r.basic).toContain("&quot;");
    expect(r.basic).toContain("&amp;");
    expect(r.basic).toContain("&lt;");
    expect(r.basic).toContain("&gt;");
  });
  it("includes author and keywords when provided", () => {
    const r = generateMetaTags({ ...BASE_INPUT, author: "John Doe", keywords: ["test", "demo"] });
    if ("error" in r) throw new Error("Should not error");
    expect(r.basic).toContain(`name="author"`);
    expect(r.basic).toContain(`name="keywords"`);
    expect(r.basic).toContain("test, demo");
  });
  it("defaults robots to index,follow", () => {
    const r = generateMetaTags(BASE_INPUT);
    if ("error" in r) throw new Error("Should not error");
    expect(r.basic).toContain(`name="robots" content="index, follow"`);
  });
  it("respects noindex,nofollow", () => {
    const r = generateMetaTags({ ...BASE_INPUT, robots: { index: false, follow: false } });
    if ("error" in r) throw new Error("Should not error");
    expect(r.basic).toContain("noindex, nofollow");
  });
  it("includes canonical when provided", () => {
    const r = generateMetaTags({ ...BASE_INPUT, canonical: "https://example.com/page" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.basic).toContain(`rel="canonical"`);
  });
});

describe("generateMetaTags — Open Graph", () => {
  it("generates basic OG tags", () => {
    const r = generateMetaTags({ ...BASE_INPUT, url: "https://example.com", siteName: "My Site", image: "https://example.com/img.png" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.openGraph).toContain(`property="og:title"`);
    expect(r.openGraph).toContain(`property="og:description"`);
    expect(r.openGraph).toContain(`property="og:type"`);
    expect(r.openGraph).toContain(`property="og:url"`);
    expect(r.openGraph).toContain(`property="og:site_name"`);
    expect(r.openGraph).toContain(`property="og:image"`);
  });
  it("adds article tags when ogType=article", () => {
    const r = generateMetaTags({
      ...BASE_INPUT,
      ogType: "article",
      author: "Jane",
      publishedTime: "2024-01-01T00:00:00Z",
      section: "Tech",
      tag: ["a", "b"],
    });
    if ("error" in r) throw new Error("Should not error");
    expect(r.openGraph).toContain(`property="article:published_time"`);
    expect(r.openGraph).toContain(`property="article:author"`);
    expect(r.openGraph).toContain(`property="article:section"`);
    expect(r.openGraph).toContain(`property="article:tag"`);
  });
  it("includes image:alt when imageAlt provided", () => {
    const r = generateMetaTags({ ...BASE_INPUT, image: "img.png", imageAlt: "Alt text" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.openGraph).toContain(`property="og:image:alt"`);
  });
});

describe("generateMetaTags — Twitter", () => {
  it("generates twitter card tags", () => {
    const r = generateMetaTags({ ...BASE_INPUT, twitterCard: "summary_large_image", twitterSite: "@mysite", twitterCreator: "@me" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.twitter).toContain(`name="twitter:card" content="summary_large_image"`);
    expect(r.twitter).toContain(`name="twitter:site" content="@mysite"`);
    expect(r.twitter).toContain(`name="twitter:creator" content="@me"`);
  });
});

describe("generateMetaTags — extras", () => {
  it("includes theme-color, favicon, manifest", () => {
    const r = generateMetaTags({
      ...BASE_INPUT,
      themeColor: "#ffffff",
      favicon: "/favicon.ico",
      appleTouchIcon: "/apple.png",
      manifest: "/manifest.json",
    });
    if ("error" in r) throw new Error("Should not error");
    expect(r.extras).toContain(`name="theme-color"`);
    expect(r.extras).toContain(`rel="icon"`);
    expect(r.extras).toContain(`rel="apple-touch-icon"`);
    expect(r.extras).toContain(`rel="manifest"`);
  });
  it("includes refresh meta when refreshSeconds provided", () => {
    const r = generateMetaTags({ ...BASE_INPUT, refreshSeconds: 5, refreshUrl: "https://example.com/new" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.extras).toContain(`http-equiv="refresh"`);
    expect(r.extras).toContain(`url=https://example.com/new`);
  });
  it("includes hreflang alternates", () => {
    const r = generateMetaTags({
      ...BASE_INPUT,
      url: "https://example.com",
      hreflang: [{ lang: "es", url: "https://example.com/es/" }, { lang: "fr", url: "https://example.com/fr/" }],
    });
    if ("error" in r) throw new Error("Should not error");
    expect(r.extras).toContain(`hreflang="es"`);
    expect(r.extras).toContain(`hreflang="fr"`);
    expect(r.extras).toContain(`hreflang="x-default"`);
  });
});

describe("generateMetaTags — JSON-LD", () => {
  it("generates WebSite schema by default", () => {
    const r = generateMetaTags({ ...BASE_INPUT, url: "https://example.com" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.jsonLd).toContain(`"@type": "WebSite"`);
    expect(r.jsonLd).toContain(`"@context"`);
  });
  it("generates Article schema when ogType=article", () => {
    const r = generateMetaTags({ ...BASE_INPUT, ogType: "article", publishedTime: "2024-01-01" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.jsonLd).toContain(`"@type": "Article"`);
    expect(r.jsonLd).toContain(`datePublished`);
  });
});

describe("generateMetaTags — SERP preview", () => {
  it("returns title and description for preview", () => {
    const r = generateMetaTags(BASE_INPUT);
    if ("error" in r) throw new Error("Should not error");
    expect(r.serpPreview.title).toBe(BASE_INPUT.title);
    expect(r.serpPreview.description).toBe(BASE_INPUT.description);
  });
  it("flags truncated title when pixel width exceeds 580px", () => {
    const r = generateMetaTags({ ...BASE_INPUT, title: "A".repeat(100) });
    if ("error" in r) throw new Error("Should not error");
    expect(r.titlePixelWidth).toBeGreaterThan(580);
    expect(r.serpPreview.truncated).toBe(true);
    expect(r.serpPreview.title).toContain("…");
  });
});

describe("generateMetaTags — warnings", () => {
  it("warns when title exceeds 60 chars", () => {
    const r = generateMetaTags({ ...BASE_INPUT, title: "A".repeat(70) });
    if ("error" in r) throw new Error("Should not error");
    expect(r.warnings.some((w) => w.includes("60 chars"))).toBe(true);
  });
  it("warns when description exceeds 160 chars", () => {
    const r = generateMetaTags({ ...BASE_INPUT, description: "A".repeat(180) });
    if ("error" in r) throw new Error("Should not error");
    expect(r.warnings.some((w) => w.includes("160 chars"))).toBe(true);
  });
});

describe("generateMetaTags — fullHtml", () => {
  it("combines all sections", () => {
    const r = generateMetaTags({ ...BASE_INPUT, url: "https://example.com", image: "img.png" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.fullHtml).toContain(`<title>`);
    expect(r.fullHtml).toContain(`og:title`);
    expect(r.fullHtml).toContain(`twitter:card`);
    expect(r.fullHtml).toContain(`application/ld+json`);
  });
});

describe("generateHreflang", () => {
  it("generates hreflang pairs from locales", () => {
    const r = generateHreflang("https://example.com", ["en_US", "es_ES", "fr_FR"]);
    expect(r.length).toBe(3);
    expect(r[0]!.lang).toBe("en_US");
    expect(r[0]!.url).toContain("example.com");
  });
});
