import { describe, it, expect, beforeEach } from "vitest";
import {
  escapeHtml,
  isValidUrl,
  isImageUrl,
  normalizeHandle,
  countChars,
  validateOgInput,
  buildOgTags,
  buildTwitterTags,
  generateOgBlock,
  buildPreviewCard,
  buildDebugLinks,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  OG_TITLE_MAX,
  OG_DESCRIPTION_MAX,
  type OgInput,
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

describe("open-graph-generator escapeHtml", () => {
  it("escapes basic HTML chars", () => {
    expect(escapeHtml(`a < b & c > d "e" 'f'`)).toContain("&amp;");
    expect(escapeHtml(`<a>`)).toBe("&lt;a&gt;");
  });
});

describe("open-graph-generator URL validators", () => {
  it("accepts https URLs", () => {
    expect(isValidUrl("https://example.com/x")).toBe(true);
  });
  it("rejects bare strings", () => {
    expect(isValidUrl("hello world")).toBe(false);
  });
  it("isImageUrl detects png", () => {
    expect(isImageUrl("https://example.com/img.png")).toBe(true);
  });
  it("isImageUrl detects jpg with query", () => {
    expect(isImageUrl("https://example.com/i.jpg?w=100")).toBe(true);
  });
  it("isImageUrl rejects non-image extensions", () => {
    expect(isImageUrl("https://example.com/page.html")).toBe(false);
  });
});

describe("open-graph-generator normalizeHandle", () => {
  it("prepends @ if missing", () => {
    expect(normalizeHandle("example")).toBe("@example");
  });
  it("keeps existing @", () => {
    expect(normalizeHandle("@example")).toBe("@example");
  });
  it("returns empty for blank", () => {
    expect(normalizeHandle("")).toBe("");
  });
});

describe("open-graph-generator countChars", () => {
  it("returns expected counts", () => {
    const c = countChars("Hello", 60);
    expect(c.value).toBe(5);
    expect(c.remaining).toBe(55);
    expect(c.isOver).toBe(false);
  });
  it("flags over-limit", () => {
    expect(countChars("x".repeat(70), 60).isOver).toBe(true);
  });
});

describe("open-graph-generator validateOgInput", () => {
  const valid: OgInput = {
    ogTitle: "Hello",
    ogDescription: "World",
    ogImage: "https://example.com/i.png",
    ogUrl: "https://example.com",
  };
  it("returns ok for valid input", () => {
    const r = validateOgInput(valid);
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it("errors on missing title", () => {
    const r = validateOgInput({ ...valid, ogTitle: "" });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /title/i.test(e))).toBe(true);
  });
  it("errors on invalid image URL", () => {
    const r = validateOgInput({ ...valid, ogImage: "not-a-url" });
    expect(r.ok).toBe(false);
  });
  it("warns on missing image", () => {
    const r = validateOgInput({ ...valid, ogImage: "" });
    expect(r.warnings.some((w) => /image/i.test(w))).toBe(true);
  });
  it("warns on non-image URL extension", () => {
    const r = validateOgInput({ ...valid, ogImage: "https://example.com/page.html" });
    expect(r.warnings.some((w) => /image/i.test(w))).toBe(true);
  });
  it("errors on invalid og:url", () => {
    const r = validateOgInput({ ...valid, ogUrl: "bad" });
    expect(r.ok).toBe(false);
  });
  it("warns on long title", () => {
    const r = validateOgInput({ ...valid, ogTitle: "x".repeat(OG_TITLE_MAX + 30) });
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("open-graph-generator buildOgTags", () => {
  const valid: OgInput = {
    ogTitle: "Hello",
    ogDescription: "World",
    ogImage: "https://example.com/i.png",
    ogUrl: "https://example.com",
    ogImageAlt: "Alt text",
    ogType: "article",
    ogSiteName: "Example",
    ogLocale: "en_US",
    articlePublishedTime: "2026-01-01T00:00:00Z",
    articleAuthor: "Jane",
  };
  it("emits og:title, description, image, url, type", () => {
    const out = buildOgTags(valid);
    expect(out).toContain('property="og:title"');
    expect(out).toContain('property="og:description"');
    expect(out).toContain('property="og:image"');
    expect(out).toContain('property="og:url"');
    expect(out).toContain('content="article"');
  });
  it("emits og:image:alt when provided", () => {
    expect(buildOgTags(valid)).toContain('property="og:image:alt"');
  });
  it("emits og:site_name and og:locale when provided", () => {
    const out = buildOgTags(valid);
    expect(out).toContain('property="og:site_name"');
    expect(out).toContain('property="og:locale"');
  });
  it("emits article:published_time for article type", () => {
    expect(buildOgTags(valid)).toContain("article:published_time");
  });
  it("does not emit article:published_time for website type", () => {
    const out = buildOgTags({ ...valid, ogType: "website" });
    expect(out).not.toContain("article:published_time");
  });
  it("escapes HTML in values", () => {
    const out = buildOgTags({ ...valid, ogTitle: "A & B <C>" });
    expect(out).toContain("A &amp; B &lt;C&gt;");
  });
  it("throws on invalid input", () => {
    expect(() => buildOgTags({ ...valid, ogTitle: "" })).toThrow();
  });
  it("emits fb:app_id when provided", () => {
    const out = buildOgTags({ ...valid, appId: "12345" });
    expect(out).toContain('property="fb:app_id"');
  });
});

describe("open-graph-generator buildTwitterTags", () => {
  const valid: OgInput = {
    ogTitle: "Hello",
    ogDescription: "World",
    ogImage: "https://example.com/i.png",
    ogUrl: "https://example.com",
    twitterCard: "summary_large_image",
    twitterSite: "example",
    twitterCreator: "@janedoe",
  };
  it("emits twitter:card with chosen type", () => {
    expect(buildTwitterTags(valid)).toContain('content="summary_large_image"');
  });
  it("normalizes site handle", () => {
    expect(buildTwitterTags(valid)).toContain('content="@example"');
  });
  it("emits twitter:image", () => {
    expect(buildTwitterTags(valid)).toContain('name="twitter:image"');
  });
  it("defaults to summary card", () => {
    const out = buildTwitterTags({ ...valid, twitterCard: undefined });
    expect(out).toContain('content="summary"');
  });
});

describe("open-graph-generator generateOgBlock", () => {
  it("combines og and twitter tags", () => {
    const out = generateOgBlock({
      ogTitle: "T",
      ogDescription: "D",
      ogImage: "https://example.com/i.png",
      ogUrl: "https://example.com",
    });
    expect(out).toContain("og:title");
    expect(out).toContain("twitter:card");
  });
});

describe("open-graph-generator buildPreviewCard", () => {
  it("returns preview object", () => {
    const p = buildPreviewCard({
      ogTitle: "T",
      ogDescription: "D",
      ogImage: "https://example.com/i.png",
      ogUrl: "https://example.com",
      twitterCard: "summary_large_image",
      twitterSite: "ex",
    });
    expect(p.card).toBe("summary_large_image");
    expect(p.title).toBe("T");
    expect(p.site).toBe("@ex");
  });
});

describe("open-graph-generator buildDebugLinks", () => {
  it("builds facebook, twitter, linkedin links", () => {
    const links = buildDebugLinks("https://example.com");
    expect(links.facebook).toContain("developers.facebook.com");
    expect(links.twitter).toContain("twitter.com");
    expect(links.linkedin).toContain("linkedin.com");
  });
  it("encodes the target URL", () => {
    const links = buildDebugLinks("https://example.com/?x=1");
    expect(links.facebook).toContain(encodeURIComponent("https://example.com/?x=1"));
  });
});

describe("open-graph-generator history", () => {
  it("loads empty when none", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, title: "T1", snippet: "x" });
    saveHistory({ ts: 2, title: "T2", snippet: "y" });
    const h = loadHistory();
    expect(h).toHaveLength(2);
    expect(h[0].title).toBe("T2");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, title: `T${i}`, snippet: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, title: "T", snippet: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("open-graph-generator shareable URL", () => {
  it("builds query when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      ogTitle: "T",
      ogDescription: "D",
      ogImage: "",
      ogUrl: "",
    });
    expect(url).toContain("ogTitle=T");
    expect(url).not.toContain("ogImage");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL", () => {
    const parsed = parseShareUrl("ogTitle=Hello&ogDescription=World");
    expect(parsed.ogTitle).toBe("Hello");
    expect(parsed.ogDescription).toBe("World");
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("builds URL containing image when present", () => {
    const url = buildShareUrl({
      ogTitle: "T",
      ogDescription: "D",
      ogImage: "https://example.com/i.png",
      ogUrl: "https://example.com",
    });
    expect(url).toContain("ogImage=");
    expect(url).toContain("ogUrl=");
  });
});
