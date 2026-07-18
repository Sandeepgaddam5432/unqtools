import { describe, it, expect, beforeEach } from "vitest";
import {
  parseUrl,
  isHttps,
  isHttp,
  estimateHttpsRedirect,
  parseHsts,
  detectMixedContent,
  analyze,
  renderReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
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

describe("ssl-https-checker parseUrl", () => {
  it("parses https URL", () => {
    const r = parseUrl("https://example.com/path");
    expect(r.protocol).toBe("https");
    expect(r.host).toBe("example.com");
    expect(r.valid).toBe(true);
  });
  it("parses http URL", () => {
    const r = parseUrl("http://example.com");
    expect(r.protocol).toBe("http");
  });
  it("parses bare domain by prepending https://", () => {
    const r = parseUrl("example.com");
    expect(r.valid).toBe(true);
    expect(r.host).toBe("example.com");
  });
  it("returns invalid for empty", () => {
    expect(parseUrl("").valid).toBe(false);
  });
  it("returns invalid for malformed", () => {
    expect(parseUrl("%%").valid).toBe(false);
  });
});

describe("ssl-https-checker isHttps / isHttp", () => {
  it("isHttps returns true for https://", () => {
    expect(isHttps("https://example.com")).toBe(true);
    expect(isHttps("http://example.com")).toBe(false);
  });
  it("isHttp returns true for http://", () => {
    expect(isHttp("http://example.com")).toBe(true);
    expect(isHttp("https://example.com")).toBe(false);
  });
});

describe("ssl-https-checker estimateHttpsRedirect", () => {
  it("returns https URL for http input", () => {
    expect(estimateHttpsRedirect("http://example.com/x")).toBe("https://example.com/x");
  });
  it("returns same URL for https input", () => {
    expect(estimateHttpsRedirect("https://example.com")).toBe("https://example.com");
  });
  it("prepends https:// for bare domain", () => {
    expect(estimateHttpsRedirect("example.com")).toBe("https://example.com");
  });
  it("returns empty for empty input", () => {
    expect(estimateHttpsRedirect("")).toBe("");
  });
});

describe("ssl-https-checker parseHsts", () => {
  it("parses complete HSTS header", () => {
    const h = parseHsts("max-age=31536000; includeSubDomains; preload");
    expect(h.maxAge).toBe(31536000);
    expect(h.includeSubDomains).toBe(true);
    expect(h.preload).toBe(true);
    expect(h.valid).toBe(true);
  });
  it("flags missing max-age", () => {
    const h = parseHsts("includeSubDomains; preload");
    expect(h.maxAge).toBeNull();
    expect(h.valid).toBe(false);
  });
  it("flags short max-age", () => {
    const h = parseHsts("max-age=3600");
    expect(h.valid).toBe(false);
    expect(h.issues.some((i) => /too short/.test(i))).toBe(true);
  });
  it("flags missing includeSubDomains", () => {
    const h = parseHsts("max-age=31536000; preload");
    expect(h.includeSubDomains).toBe(false);
    expect(h.valid).toBe(false);
  });
  it("flags missing preload", () => {
    const h = parseHsts("max-age=31536000; includeSubDomains");
    expect(h.preload).toBe(false);
    expect(h.valid).toBe(false);
  });
  it("returns invalid for empty input", () => {
    const h = parseHsts("");
    expect(h.valid).toBe(false);
  });
});

describe("ssl-https-checker detectMixedContent", () => {
  it("detects active mixed content (script)", () => {
    const html = `<script src="http://example.com/evil.js"></script>`;
    const items = detectMixedContent(html, "https://my.com");
    expect(items.length).toBe(1);
    expect(items[0].severity).toBe("active");
    expect(items[0].type).toBe("script");
  });
  it("detects passive mixed content (image)", () => {
    const html = `<img src="http://example.com/img.jpg">`;
    const items = detectMixedContent(html, "https://my.com");
    expect(items.length).toBe(1);
    expect(items[0].severity).toBe("passive");
  });
  it("returns empty when no mixed content", () => {
    const html = `<img src="https://example.com/img.jpg">`;
    expect(detectMixedContent(html, "https://my.com")).toHaveLength(0);
  });
  it("returns empty when base URL is http (not mixed)", () => {
    const html = `<script src="http://example.com/x.js"></script>`;
    expect(detectMixedContent(html, "http://my.com")).toHaveLength(0);
  });
  it("detects stylesheet mixed content", () => {
    const html = `<link rel="stylesheet" href="http://example.com/style.css">`;
    const items = detectMixedContent(html, "https://my.com");
    expect(items[0].type).toBe("stylesheet");
    expect(items[0].severity).toBe("active");
  });
});

describe("ssl-https-checker analyze", () => {
  it("passes for https URL with clean HTML", () => {
    const r = analyze("https://example.com", `<img src="https://cdn.com/x.jpg">`);
    expect(r.isHttps).toBe(true);
    expect(r.protocol).toBe("https");
    expect(r.mixedContent).toHaveLength(0);
  });
  it("fails for http URL", () => {
    const r = analyze("http://example.com");
    expect(r.isHttp).toBe(true);
    expect(r.checks.some((c) => c.name === "protocol" && c.rating === "fail")).toBe(true);
  });
  it("fails for active mixed content", () => {
    const r = analyze("https://example.com", `<script src="http://x.com/e.js"></script>`);
    expect(r.mixedContent.length).toBeGreaterThan(0);
    expect(r.checks.some((c) => c.name === "mixed-content" && c.rating === "fail")).toBe(true);
  });
  it("passes with valid HSTS", () => {
    const r = analyze("https://example.com", "", "max-age=31536000; includeSubDomains; preload");
    expect(r.hstsInfo?.valid).toBe(true);
    expect(r.checks.some((c) => c.name === "hsts" && c.rating === "pass")).toBe(true);
  });
  it("warns for missing HSTS on https", () => {
    const r = analyze("https://example.com");
    expect(r.checks.some((c) => c.name === "hsts" && c.rating === "warn")).toBe(true);
  });
  it("handles invalid URL", () => {
    const r = analyze("");
    expect(r.checks.some((c) => c.name === "url" && c.rating === "fail")).toBe(true);
  });
  it("computes overall score", () => {
    const r = analyze("https://example.com");
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe("ssl-https-checker renderReport", () => {
  it("produces human-readable report with disclaimer", () => {
    const r = analyze("https://example.com");
    const report = renderReport(r);
    expect(report).toContain("SSL & HTTPS Check Report");
    expect(report).toContain("https://example.com");
    expect(report).toContain("NOTE: This tool does NOT make live HTTPS requests");
  });
});

describe("ssl-https-checker history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, url: "https://example.com", score: 90, rating: "pass", isHttps: true, mixedContentCount: 0 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, url: "x", score: 50, rating: "warn", isHttps: true, mixedContentCount: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, url: "x", score: 50, rating: "warn", isHttps: true, mixedContentCount: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ssl-https-checker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ url: "https://example.com", html: "<html></html>", hsts: "" });
    expect(url).toContain("url=https");
    expect(url).toContain("html=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const parsed = parseShareUrl("url=https%3A%2F%2Fexample.com&html=%3Chtml%3E");
    expect(parsed.url).toBe("https://example.com");
    expect(parsed.html).toBe("<html>");
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("omits empty fields", () => {
    const url = buildShareUrl({ url: "https://example.com", html: "", hsts: "" });
    expect(url).not.toContain("html=");
    expect(url).not.toContain("hsts=");
  });
});
