import { describe, it, expect, beforeEach } from "vitest";
import {
  SOURCE_MEDIUM_PRESETS,
  CAMPAIGN_TEMPLATES,
  isValidUrl,
  isLowercaseAlphaNumericDash,
  normalizeUtmValue,
  validateUtmInput,
  buildUtmUrl,
  buildBulkUtmUrls,
  parseUtmUrl,
  buildQrDataUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type UtmInput,
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

describe("utm-url-builder presets", () => {
  it("has source/medium presets", () => {
    expect(SOURCE_MEDIUM_PRESETS.length).toBeGreaterThanOrEqual(8);
    expect(SOURCE_MEDIUM_PRESETS.some((p) => p.source === "google")).toBe(true);
  });
  it("has campaign templates", () => {
    expect(CAMPAIGN_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    expect(CAMPAIGN_TEMPLATES.some((c) => /sale/i.test(c.label))).toBe(true);
  });
});

describe("utm-url-builder validators", () => {
  it("isValidUrl accepts https", () => {
    expect(isValidUrl("https://example.com/x")).toBe(true);
  });
  it("isValidUrl rejects bare strings", () => {
    expect(isValidUrl("not a url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
  it("isLowercaseAlphaNumericDash accepts valid", () => {
    expect(isLowercaseAlphaNumericDash("google")).toBe(true);
    expect(isLowercaseAlphaNumericDash("my-source_1")).toBe(true);
  });
  it("isLowercaseAlphaNumericDash rejects spaces and caps", () => {
    expect(isLowercaseAlphaNumericDash("Google Search")).toBe(false);
  });
  it("normalizeUtmValue lowercases and replaces spaces", () => {
    expect(normalizeUtmValue("Summer Sale 2026")).toBe("summer_sale_2026");
  });
  it("normalizeUtmValue strips special chars", () => {
    expect(normalizeUtmValue("hello@world!")).toBe("helloworld");
  });
  it("normalizeUtmValue returns empty for empty", () => {
    expect(normalizeUtmValue("")).toBe("");
  });
});

describe("utm-url-builder validateUtmInput", () => {
  const valid: UtmInput = {
    baseUrl: "https://example.com/landing",
    source: "google",
    medium: "cpc",
    campaign: "summer_sale",
  };
  it("passes for valid input", () => {
    const r = validateUtmInput(valid);
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });
  it("errors on missing base URL", () => {
    const r = validateUtmInput({ ...valid, baseUrl: "" });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /base url/i.test(e))).toBe(true);
  });
  it("errors on invalid base URL", () => {
    const r = validateUtmInput({ ...valid, baseUrl: "not-a-url" });
    expect(r.ok).toBe(false);
  });
  it("errors on missing source", () => {
    const r = validateUtmInput({ ...valid, source: "" });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /source/i.test(e))).toBe(true);
  });
  it("errors on missing medium", () => {
    const r = validateUtmInput({ ...valid, medium: "" });
    expect(r.ok).toBe(false);
  });
  it("errors on missing campaign", () => {
    const r = validateUtmInput({ ...valid, campaign: "" });
    expect(r.ok).toBe(false);
  });
  it("warns on uppercase source", () => {
    const r = validateUtmInput({ ...valid, source: "Google" });
    expect(r.warnings.some((w) => /source/i.test(w))).toBe(true);
  });
});

describe("utm-url-builder buildUtmUrl", () => {
  const valid: UtmInput = {
    baseUrl: "https://example.com/landing",
    source: "google",
    medium: "cpc",
    campaign: "summer_sale",
    term: "running shoes",
    content: "banner_ad",
  };
  it("builds a URL with utm_source, medium, campaign", () => {
    const out = buildUtmUrl(valid);
    expect(out).toContain("utm_source=google");
    expect(out).toContain("utm_medium=cpc");
    expect(out).toContain("utm_campaign=summer_sale");
  });
  it("includes utm_term and utm_content when provided", () => {
    const out = buildUtmUrl(valid);
    expect(out).toContain("utm_term=running_shoes");
    expect(out).toContain("utm_content=banner_ad");
  });
  it("preserves existing query params on base URL", () => {
    const out = buildUtmUrl({
      ...valid,
      baseUrl: "https://example.com/landing?ref=friend",
    });
    expect(out).toContain("ref=friend");
    expect(out).toContain("utm_source=google");
  });
  it("normalizes uppercase values", () => {
    const out = buildUtmUrl({
      ...valid,
      source: "Google",
      campaign: "Summer Sale",
    });
    expect(out).toContain("utm_source=google");
    expect(out).toContain("utm_campaign=summer_sale");
  });
  it("omits utm_term and utm_content when not set", () => {
    const out = buildUtmUrl({
      baseUrl: "https://example.com/x",
      source: "google",
      medium: "cpc",
      campaign: "c",
    });
    expect(out).not.toContain("utm_term");
    expect(out).not.toContain("utm_content");
  });
  it("throws on invalid input", () => {
    expect(() => buildUtmUrl({ ...valid, baseUrl: "" })).toThrow();
  });
  it("URL-encodes special characters in values", () => {
    const out = buildUtmUrl({
      ...valid,
      source: "google",
      medium: "cpc",
      campaign: "campaign+plus",
    });
    expect(out).toContain("utm_campaign=campaign%2Bplus");
  });
});

describe("utm-url-builder buildBulkUtmUrls", () => {
  it("builds URLs for all valid inputs", () => {
    const results = buildBulkUtmUrls(
      ["https://example.com/a", "https://example.com/b"],
      { source: "google", medium: "cpc", campaign: "x" },
    );
    expect(results).toHaveLength(2);
    expect(results[0].result).toContain("utm_source=google");
    expect(results[1].result).toContain("utm_source=google");
  });
  it("returns null with error for invalid URL", () => {
    const results = buildBulkUtmUrls(
      ["not-a-url"],
      { source: "google", medium: "cpc", campaign: "x" },
    );
    expect(results[0].result).toBeNull();
    expect(results[0].error).toBeDefined();
  });
  it("skips empty lines", () => {
    const results = buildBulkUtmUrls(
      ["", "https://example.com/x"],
      { source: "google", medium: "cpc", campaign: "x" },
    );
    expect(results[0].result).toBeNull();
    expect(results[1].result).toBeTruthy();
  });
});

describe("utm-url-builder parseUtmUrl", () => {
  it("parses UTMs from a URL", () => {
    const parsed = parseUtmUrl("https://example.com/x?utm_source=google&utm_medium=cpc&utm_campaign=sale");
    expect(parsed.source).toBe("google");
    expect(parsed.medium).toBe("cpc");
    expect(parsed.campaign).toBe("sale");
  });
  it("returns baseUrl for URL without UTMs", () => {
    const parsed = parseUtmUrl("https://example.com/x");
    expect(parsed.baseUrl).toContain("example.com");
    expect(parsed.source).toBeUndefined();
  });
  it("returns baseUrl only for invalid URL", () => {
    const parsed = parseUtmUrl("not-a-url");
    expect(parsed.baseUrl).toBe("not-a-url");
  });
});

describe("utm-url-builder buildQrDataUrl", () => {
  it("returns empty for empty input", () => {
    expect(buildQrDataUrl("")).toBe("");
  });
  it("produces an SVG data URL", () => {
    const out = buildQrDataUrl("https://example.com");
    expect(out.startsWith("data:image/svg+xml")).toBe(true);
    expect(out).toContain("svg");
  });
  it("is deterministic for the same input", () => {
    const a = buildQrDataUrl("https://example.com");
    const b = buildQrDataUrl("https://example.com");
    expect(a).toBe(b);
  });
  it("produces different QR for different inputs", () => {
    const a = buildQrDataUrl("https://example.com/a");
    const b = buildQrDataUrl("https://example.com/b");
    expect(a).not.toBe(b);
  });
});

describe("utm-url-builder history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, url: "https://example.com", source: "google", campaign: "sale" });
    saveHistory({ ts: 2, url: "https://example.com/x", source: "facebook", campaign: "launch" });
    expect(loadHistory()).toHaveLength(2);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, url: "x", source: "s", campaign: "c" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, url: "x", source: "s", campaign: "c" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("utm-url-builder shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      baseUrl: "https://example.com",
      source: "google",
      medium: "cpc",
      campaign: "sale",
    });
    expect(url).toContain("baseUrl=");
    expect(url).toContain("source=google");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to input", () => {
    const parsed = parseShareUrl("baseUrl=https%3A%2F%2Fexample.com&source=google");
    expect(parsed.baseUrl).toBe("https://example.com");
    expect(parsed.source).toBe("google");
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("omits empty fields", () => {
    const url = buildShareUrl({
      baseUrl: "https://example.com",
      source: "google",
      medium: "",
      campaign: "",
    });
    expect(url).toContain("baseUrl=");
    expect(url).toContain("source=google");
    expect(url).not.toContain("medium=");
  });
});
