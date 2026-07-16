import { describe, it, expect, beforeEach } from "vitest";
import {
  isValidUrl,
  isAbsoluteUrl,
  normalizeUrl,
  escapeHtml,
  buildCanonicalTag,
  buildPrevTag,
  buildNextTag,
  analyzeCanonical,
  analyzeBatch,
  buildAllTags,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CanonicalInput,
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

describe("canonical-tag-generator URL validators", () => {
  it("isValidUrl accepts https", () => {
    expect(isValidUrl("https://example.com/x")).toBe(true);
  });
  it("isValidUrl rejects bare strings", () => {
    expect(isValidUrl("not a url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
  it("isAbsoluteUrl detects protocol", () => {
    expect(isAbsoluteUrl("https://example.com")).toBe(true);
    expect(isAbsoluteUrl("http://example.com")).toBe(true);
    expect(isAbsoluteUrl("/relative/path")).toBe(false);
    expect(isAbsoluteUrl("example.com")).toBe(false);
  });
});

describe("canonical-tag-generator normalizeUrl", () => {
  it("lowercases host", () => {
    expect(normalizeUrl("https://EXAMPLE.com/Path")).toContain("example.com");
  });
  it("strips default https port 443", () => {
    expect(normalizeUrl("https://example.com:443/x")).toBe("https://example.com/x");
  });
  it("strips default http port 80", () => {
    expect(normalizeUrl("http://example.com:80/x")).toBe("http://example.com/x");
  });
  it("preserves non-default ports", () => {
    expect(normalizeUrl("https://example.com:8443/x")).toBe("https://example.com:8443/x");
  });
  it("removes duplicate slashes in path", () => {
    expect(normalizeUrl("https://example.com//a///b")).toBe("https://example.com/a/b");
  });
  it("strips tracking params when option set", () => {
    const out = normalizeUrl("https://example.com/x?utm_source=google&id=1", { stripTrackingParams: true });
    expect(out).not.toContain("utm_source");
    expect(out).toContain("id=1");
  });
  it("preserves non-tracking params when option not set", () => {
    const out = normalizeUrl("https://example.com/x?utm_source=google&id=1");
    expect(out).toContain("utm_source");
  });
  it("returns input for invalid URL", () => {
    expect(normalizeUrl("not-a-url")).toBe("not-a-url");
  });
});

describe("canonical-tag-generator escapeHtml", () => {
  it("escapes HTML special chars", () => {
    expect(escapeHtml(`<a>"&'</a>`)).toContain("&amp;");
  });
});

describe("canonical-tag-generator tag builders", () => {
  it("buildCanonicalTag returns valid link tag", () => {
    const tag = buildCanonicalTag("https://example.com/x");
    expect(tag).toBe('<link rel="canonical" href="https://example.com/x" />');
  });
  it("buildCanonicalTag returns null for invalid URL", () => {
    expect(buildCanonicalTag("not-a-url")).toBeNull();
    expect(buildCanonicalTag("")).toBeNull();
  });
  it("buildPrevTag returns rel=prev tag", () => {
    expect(buildPrevTag("https://example.com/p1")).toContain('rel="prev"');
  });
  it("buildNextTag returns rel=next tag", () => {
    expect(buildNextTag("https://example.com/p3")).toContain('rel="next"');
  });
  it("escapes HTML in tag", () => {
    const tag = buildCanonicalTag("https://example.com/x?a=1&b=2");
    expect(tag).toContain("&amp;");
  });
});

describe("canonical-tag-generator analyzeCanonical", () => {
  it("flags empty canonical URL", () => {
    const a = analyzeCanonical({ canonicalUrl: "" });
    expect(a.findings.some((f) => /empty/i.test(f.message))).toBe(true);
  });
  it("flags relative canonical URL", () => {
    const a = analyzeCanonical({ canonicalUrl: "/relative/path" });
    expect(a.findings.some((f) => /relative/i.test(f.message))).toBe(true);
  });
  it("flags non-HTTPS canonical", () => {
    const a = analyzeCanonical({ canonicalUrl: "http://example.com/x" });
    expect(a.findings.some((f) => /HTTPS/i.test(f.message))).toBe(true);
  });
  it("flags tracking params in canonical", () => {
    const a = analyzeCanonical({ canonicalUrl: "https://example.com/x?utm_source=google" });
    expect(a.findings.some((f) => /tracking/i.test(f.message))).toBe(true);
  });
  it("flags cross-domain canonical", () => {
    const a = analyzeCanonical({
      canonicalUrl: "https://other.com/x",
      pageUrl: "https://example.com/x",
    });
    expect(a.findings.some((f) => /hostname/i.test(f.message))).toBe(true);
  });
  it("flags trailing slash mismatch", () => {
    const a = analyzeCanonical({
      canonicalUrl: "https://example.com/x",
      pageUrl: "https://example.com/x/",
    });
    expect(a.findings.some((f) => /trailing/i.test(f.message))).toBe(true);
  });
  it("flags www vs non-www mismatch", () => {
    const a = analyzeCanonical({
      canonicalUrl: "https://example.com/x",
      pageUrl: "https://www.example.com/x",
    });
    expect(a.findings.some((f) => /www/i.test(f.message))).toBe(true);
  });
  it("returns normalized URL", () => {
    const a = analyzeCanonical({ canonicalUrl: "HTTPS://EXAMPLE.COM/x" });
    expect(a.normalizedUrl).toBe("https://example.com/x");
  });
  it("returns canonical, prev, next tags", () => {
    const a = analyzeCanonical({
      canonicalUrl: "https://example.com/x",
      prevUrl: "https://example.com/prev",
      nextUrl: "https://example.com/next",
    });
    expect(a.tag).toContain('rel="canonical"');
    expect(a.prevTag).toContain('rel="prev"');
    expect(a.nextTag).toContain('rel="next"');
  });
  it("sets isHttps flag correctly", () => {
    const a = analyzeCanonical({ canonicalUrl: "https://example.com/x" });
    expect(a.isHttps).toBe(true);
  });
  it("sets hasWww flag correctly", () => {
    const a = analyzeCanonical({ canonicalUrl: "https://www.example.com/x" });
    expect(a.hasWww).toBe(true);
  });
  it("sets hasTrailingSlash flag correctly", () => {
    const a = analyzeCanonical({ canonicalUrl: "https://example.com/x/" });
    expect(a.hasTrailingSlash).toBe(true);
  });
  it("does not flag tracking params when not present", () => {
    const a = analyzeCanonical({ canonicalUrl: "https://example.com/x" });
    expect(a.findings.some((f) => /tracking/i.test(f.message))).toBe(false);
  });
  it("strips tracking params when option set", () => {
    const a = analyzeCanonical({
      canonicalUrl: "https://example.com/x?utm_source=google",
      stripTrackingParams: true,
    });
    expect(a.normalizedUrl).not.toContain("utm_source");
  });
});

describe("canonical-tag-generator analyzeBatch", () => {
  it("analyzes multiple URLs", () => {
    const results = analyzeBatch([
      "https://example.com/a",
      "https://example.com/b?utm_source=x",
      "/relative",
    ]);
    expect(results).toHaveLength(3);
    expect(results[0].tag).toContain('rel="canonical"');
    expect(results[2].tag).toBeNull();
  });
});

describe("canonical-tag-generator buildAllTags", () => {
  it("combines canonical, prev, next", () => {
    const out = buildAllTags({
      canonicalUrl: "https://example.com/x",
      prevUrl: "https://example.com/prev",
      nextUrl: "https://example.com/next",
    });
    expect(out).toContain('rel="canonical"');
    expect(out).toContain('rel="prev"');
    expect(out).toContain('rel="next"');
  });
  it("returns only canonical when prev/next absent", () => {
    const out = buildAllTags({ canonicalUrl: "https://example.com/x" });
    expect(out).toContain('rel="canonical"');
    expect(out).not.toContain('rel="prev"');
  });
});

describe("canonical-tag-generator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, url: "https://example.com/x", tag: "<link>" });
    saveHistory({ ts: 2, url: "https://example.com/y", tag: "<link>" });
    expect(loadHistory()).toHaveLength(2);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, url: "x", tag: "t" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, url: "x", tag: "t" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("canonical-tag-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ canonicalUrl: "https://example.com/x" });
    expect(url).toContain("canonicalUrl=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to input", () => {
    const parsed = parseShareUrl("canonicalUrl=https%3A%2F%2Fexample.com");
    expect(parsed.canonicalUrl).toBe("https://example.com");
  });
  it("parses boolean stripTrackingParams", () => {
    const parsed = parseShareUrl("canonicalUrl=https%3A%2F%2Fexample.com&stripTrackingParams=1");
    expect(parsed.stripTrackingParams).toBe(true);
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("omits empty fields", () => {
    const url = buildShareUrl({ canonicalUrl: "https://example.com/x", prevUrl: "" });
    expect(url).toContain("canonicalUrl=");
    expect(url).not.toContain("prevUrl=");
  });
});
