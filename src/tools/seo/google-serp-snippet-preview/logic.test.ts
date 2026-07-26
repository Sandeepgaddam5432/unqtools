/**
 * Google SERP Snippet Preview — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  estimatePixelWidth,
  truncateToPixels,
  buildBreadcrumbPath,
  displayUrl,
  tokenizeQuery,
  findBoldRanges,
  buildSerpPreview,
  importFromHtml,
  stripHtml,
  segmentsForBold,
  encodePreset,
  decodePreset,
  SERP_LIMITS,
  type SerpInput,
} from "./logic";

const BASE: SerpInput = {
  title: "Best Running Shoes 2026 — Reviews & Buying Guide",
  url: "https://example.com/best-running-shoes",
  description: "We tested 47 running shoes for 200+ miles each. These are the best for road, trail, and racing in 2026.",
};

describe("estimatePixelWidth", () => {
  it("returns 0 for empty string", () => {
    expect(estimatePixelWidth("")).toBe(0);
  });
  it("weights uppercase wider than lowercase", () => {
    expect(estimatePixelWidth("AAAA")).toBeGreaterThan(estimatePixelWidth("aaaa"));
  });
  it("weights m/w/M/W wider than narrow chars", () => {
    expect(estimatePixelWidth("mm")).toBeGreaterThan(estimatePixelWidth("ii"));
  });
  it("handles CJK characters with larger width", () => {
    expect(estimatePixelWidth("你好")).toBeGreaterThan(20);
  });
  it("applies font scale", () => {
    const base = estimatePixelWidth("hello");
    const scaled = estimatePixelWidth("hello", 2);
    expect(scaled).toBeGreaterThanOrEqual(base * 2 - 1);
  });
});

describe("truncateToPixels", () => {
  it("returns original text when under limit", () => {
    const t = truncateToPixels("hello", 1000);
    expect(t.text).toBe("hello");
    expect(t.truncated).toBe(false);
  });
  it("truncates with ellipsis when over limit", () => {
    const t = truncateToPixels("a".repeat(200), 100);
    expect(t.truncated).toBe(true);
    expect(t.text.endsWith("…")).toBe(true);
    expect(t.text.length).toBeLessThan(200);
  });
  it("trims trailing punctuation when truncating", () => {
    const t = truncateToPixels("Hello, world! This is a very long sentence that needs cutting.", 80);
    expect(t.truncated).toBe(true);
    expect(t.text.endsWith("…")).toBe(true);
  });
});

describe("buildBreadcrumbPath", () => {
  it("joins parts with ›", () => {
    expect(buildBreadcrumbPath(["Home", "Blog", "Post"])).toBe("Home › Blog › Post");
  });
  it("filters empty parts", () => {
    expect(buildBreadcrumbPath(["", "Blog", ""])).toBe("Blog");
  });
});

describe("displayUrl", () => {
  it("strips protocol and www", () => {
    expect(displayUrl("https://www.example.com/page")).toBe("example.com/page");
  });
  it("lowercases host", () => {
    expect(displayUrl("https://EXAMPLE.COM/Path")).toBe("example.com/Path");
  });
  it("handles invalid url gracefully", () => {
    expect(displayUrl("not a url")).toBe("not a url");
  });
});

describe("tokenizeQuery + findBoldRanges", () => {
  it("tokenizes to lowercase terms >=2 chars", () => {
    expect(tokenizeQuery("Best Running Shoes 2026")).toEqual(["best", "running", "shoes", "2026"]);
  });
  it("finds bold ranges for matching terms", () => {
    const ranges = findBoldRanges("Best running shoes for men", ["running", "shoes"]);
    expect(ranges.length).toBe(2);
  });
  it("merges overlapping ranges", () => {
    const ranges = findBoldRanges("aaa", ["a", "aa"]);
    expect(ranges.length).toBe(1);
    expect(ranges[0]!.start).toBe(0);
    expect(ranges[0]!.end).toBe(3);
  });
  it("returns empty array when no terms", () => {
    expect(findBoldRanges("hello world", [])).toEqual([]);
  });
});

describe("buildSerpPreview", () => {
  it("errors on missing title", () => {
    expect("error" in buildSerpPreview({ ...BASE, title: "" })).toBe(true);
  });
  it("errors on missing description", () => {
    expect("error" in buildSerpPreview({ ...BASE, description: "" })).toBe(true);
  });
  it("returns desktop + mobile previews", () => {
    const r = buildSerpPreview(BASE);
    if ("error" in r) throw new Error("should not error");
    expect(r.desktop.device).toBe("desktop");
    expect(r.mobile.device).toBe("mobile");
  });
  it("flags truncation when title exceeds desktop limit", () => {
    const r = buildSerpPreview({ ...BASE, title: "A".repeat(100) });
    if ("error" in r) throw new Error("should not error");
    expect(r.titlePixelWidth).toBeGreaterThan(SERP_LIMITS.titleDesktopPx);
    expect(r.desktop.titleTruncated).toBe(true);
  });
  it("includes warnings array", () => {
    const r = buildSerpPreview({ ...BASE, title: "A".repeat(100) });
    if ("error" in r) throw new Error("should not error");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("sets richElements flags based on input", () => {
    const r = buildSerpPreview({
      ...BASE,
      breadcrumb: ["Home", "Blog"],
      date: "Jan 1, 2026",
      rating: { value: 4.5, count: 100 },
      sitelinks: ["About", "Contact"],
      faq: [{ q: "What?", a: "This." }],
      favicon: true,
    });
    if ("error" in r) throw new Error("should not error");
    expect(r.richElements.hasBreadcrumb).toBe(true);
    expect(r.richElements.hasDate).toBe(true);
    expect(r.richElements.hasRating).toBe(true);
    expect(r.richElements.hasSitelinks).toBe(true);
    expect(r.richElements.hasFaq).toBe(true);
    expect(r.richElements.hasFavicon).toBe(true);
  });
  it("errors on invalid rating", () => {
    expect("error" in buildSerpPreview({ ...BASE, rating: { value: 6, count: 10 } })).toBe(true);
  });
  it("bolds query terms in title + description ranges", () => {
    const r = buildSerpPreview({ ...BASE, query: "running shoes" });
    if ("error" in r) throw new Error("should not error");
    expect(r.desktop.boldRanges.length).toBeGreaterThan(0);
  });
});

describe("importFromHtml", () => {
  it("extracts title and description", () => {
    const html = `<html><head><title>My Page</title><meta name="description" content="A description."></head></html>`;
    const r = importFromHtml(html);
    expect(r.title).toBe("My Page");
    expect(r.description).toBe("A description.");
  });
  it("extracts canonical URL", () => {
    const html = `<link rel="canonical" href="https://example.com/page">`;
    expect(importFromHtml(html).url).toBe("https://example.com/page");
  });
  it("returns empty strings when missing", () => {
    const r = importFromHtml("<html></html>");
    expect(r.title).toBe("");
    expect(r.description).toBe("");
  });
});

describe("stripHtml", () => {
  it("removes tags and decodes entities", () => {
    expect(stripHtml("<p>Hello&nbsp;world &amp; goodbye</p>")).toBe("Hello world & goodbye");
  });
  it("removes script and style blocks", () => {
    expect(stripHtml("<style>.a{}</style><script>let x=1;</script>Hi")).toBe("Hi");
  });
});

describe("segmentsForBold", () => {
  it("returns single segment when no ranges", () => {
    const segs = segmentsForBold("hello", []);
    expect(segs).toEqual([{ text: "hello", bold: false }]);
  });
  it("splits text into bold + non-bold segments", () => {
    const segs = segmentsForBold("Best shoes ever", [{ start: 5, end: 10 }]);
    expect(segs.length).toBe(3);
    expect(segs[1]!.bold).toBe(true);
    expect(segs[1]!.text).toBe("shoes");
  });
});

describe("encodePreset / decodePreset roundtrip", () => {
  it("round-trips a full input", () => {
    const encoded = encodePreset(BASE);
    const decoded = decodePreset(encoded);
    expect("error" in decoded).toBe(false);
    if (!("error" in decoded)) {
      expect(decoded.title).toBe(BASE.title);
      expect(decoded.description).toBe(BASE.description);
    }
  });
  it("errors on invalid preset", () => {
    expect("error" in decodePreset("!!!not base64!!!")).toBe(true);
  });
});
