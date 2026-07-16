import { describe, it, expect, beforeEach } from "vitest";
import {
  LANGUAGE_CODES,
  REGION_CODES,
  isValidLanguageCode,
  isValidRegionCode,
  isValidHreflangValue,
  isValidUrl,
  escapeHtml,
  validateInput,
  buildTag,
  generateTags,
  parseBatch,
  detectDuplicates,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HreflangInput,
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

describe("hreflang-tag-generator code lists", () => {
  it("has language codes", () => {
    expect(LANGUAGE_CODES.length).toBeGreaterThanOrEqual(20);
    expect(LANGUAGE_CODES.some((l) => l.code === "en")).toBe(true);
    expect(LANGUAGE_CODES.some((l) => l.code === "fr")).toBe(true);
  });
  it("has region codes", () => {
    expect(REGION_CODES.length).toBeGreaterThanOrEqual(20);
    expect(REGION_CODES.some((r) => r.code === "US")).toBe(true);
    expect(REGION_CODES.some((r) => r.code === "GB")).toBe(true);
  });
});

describe("hreflang-tag-generator validators", () => {
  it("isValidLanguageCode accepts valid", () => {
    expect(isValidLanguageCode("en")).toBe(true);
    expect(isValidLanguageCode("EN")).toBe(true);
    expect(isValidLanguageCode("fr")).toBe(true);
  });
  it("isValidLanguageCode rejects unknown", () => {
    expect(isValidLanguageCode("xx")).toBe(false);
    expect(isValidLanguageCode("")).toBe(false);
  });
  it("isValidRegionCode accepts valid", () => {
    expect(isValidRegionCode("US")).toBe(true);
    expect(isValidRegionCode("us")).toBe(true);
    expect(isValidRegionCode("GB")).toBe(true);
  });
  it("isValidRegionCode rejects unknown", () => {
    expect(isValidRegionCode("XX")).toBe(false);
    expect(isValidRegionCode("")).toBe(false);
  });
  it("isValidHreflangValue accepts language only", () => {
    expect(isValidHreflangValue("en")).toBe(true);
    expect(isValidHreflangValue("fr")).toBe(true);
  });
  it("isValidHreflangValue accepts language-region", () => {
    expect(isValidHreflangValue("en-US")).toBe(true);
    expect(isValidHreflangValue("fr-CA")).toBe(true);
  });
  it("isValidHreflangValue accepts x-default", () => {
    expect(isValidHreflangValue("x-default")).toBe(true);
  });
  it("isValidHreflangValue rejects invalid", () => {
    expect(isValidHreflangValue("xyz")).toBe(false);
    expect(isValidHreflangValue("en-US-CA")).toBe(false);
    expect(isValidHreflangValue("")).toBe(false);
  });
  it("isValidUrl accepts https", () => {
    expect(isValidUrl("https://example.com/x")).toBe(true);
  });
  it("isValidUrl rejects bare strings", () => {
    expect(isValidUrl("not a url")).toBe(false);
  });
});

describe("hreflang-tag-generator escapeHtml", () => {
  it("escapes HTML special chars", () => {
    expect(escapeHtml(`<a href="x">A & B</a>`)).toContain("&amp;");
  });
});

describe("hreflang-tag-generator validateInput", () => {
  it("errors on empty entries", () => {
    const r = validateInput({ entries: [] });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /at least one/i.test(e))).toBe(true);
  });
  it("errors on invalid hreflang value", () => {
    const r = validateInput({
      entries: [{ hreflang: "invalid", url: "https://example.com" }],
    });
    expect(r.ok).toBe(false);
  });
  it("errors on invalid URL", () => {
    const r = validateInput({
      entries: [{ hreflang: "en", url: "not-a-url" }],
    });
    expect(r.ok).toBe(false);
  });
  it("warns on duplicates", () => {
    const r = validateInput({
      entries: [
        { hreflang: "en", url: "https://example.com/en" },
        { hreflang: "en", url: "https://example.com/en2" },
      ],
    });
    expect(r.duplicates).toContain("en");
    expect(r.warnings.some((w) => /duplicate/i.test(w))).toBe(true);
  });
  it("passes for valid input", () => {
    const r = validateInput({
      entries: [
        { hreflang: "en-US", url: "https://example.com/en-us" },
        { hreflang: "en-GB", url: "https://example.com/en-gb" },
        { hreflang: "x-default", url: "https://example.com/en" },
      ],
    });
    expect(r.ok).toBe(true);
  });
  it("includes info finding about self-reference", () => {
    const r = validateInput({
      entries: [{ hreflang: "en", url: "https://example.com/en" }],
    });
    expect(r.findings.some((f) => /self-reference|self-referencing/i.test(f.message))).toBe(true);
  });
  it("warns when x-default enabled but URL missing", () => {
    const r = validateInput({
      entries: [{ hreflang: "en", url: "https://example.com/en" }],
      includeXDefault: true,
    });
    expect(r.warnings.some((w) => /x-default/i.test(w))).toBe(true);
  });
});

describe("hreflang-tag-generator buildTag", () => {
  it("builds a link rel=alternate tag", () => {
    const tag = buildTag({ hreflang: "en-US", url: "https://example.com/en-us" });
    expect(tag).toBe('<link rel="alternate" hreflang="en-US" href="https://example.com/en-us" />');
  });
  it("builds x-default tag", () => {
    const tag = buildTag({ hreflang: "x-default", url: "https://example.com" });
    expect(tag).toContain('hreflang="x-default"');
  });
  it("escapes HTML in URL", () => {
    const tag = buildTag({ hreflang: "en", url: "https://example.com/x?a=1&b=2" });
    expect(tag).toContain("&amp;");
  });
});

describe("hreflang-tag-generator generateTags", () => {
  it("generates a tag per entry", () => {
    const out = generateTags({
      entries: [
        { hreflang: "en-US", url: "https://example.com/en-us" },
        { hreflang: "fr-FR", url: "https://example.com/fr-fr" },
      ],
    });
    expect(out).toContain('hreflang="en-US"');
    expect(out).toContain('hreflang="fr-FR"');
  });
  it("adds x-default when includeXDefault and xDefaultUrl set", () => {
    const out = generateTags({
      entries: [{ hreflang: "en", url: "https://example.com/en" }],
      includeXDefault: true,
      xDefaultUrl: "https://example.com",
    });
    expect(out).toContain('hreflang="x-default"');
  });
  it("does not duplicate x-default if already in entries", () => {
    const out = generateTags({
      entries: [
        { hreflang: "en", url: "https://example.com/en" },
        { hreflang: "x-default", url: "https://example.com" },
      ],
      includeXDefault: true,
      xDefaultUrl: "https://example.com",
    });
    const matches = out.match(/x-default/g);
    expect(matches).toHaveLength(1);
  });
  it("throws on invalid input", () => {
    expect(() => generateTags({ entries: [] })).toThrow();
  });
});

describe("hreflang-tag-generator parseBatch", () => {
  it("parses pipe-separated entries", () => {
    const out = parseBatch("en-US|https://example.com/en-us\nfr-FR|https://example.com/fr-fr");
    expect(out).toHaveLength(2);
    expect(out[0].hreflang).toBe("en-US");
  });
  it("parses whitespace-separated entries", () => {
    const out = parseBatch("en-US https://example.com/en-us");
    expect(out).toHaveLength(1);
  });
  it("skips invalid lines", () => {
    const out = parseBatch("invalid-entry\nen-US|https://example.com/en-us");
    expect(out).toHaveLength(1);
  });
  it("returns empty for empty input", () => {
    expect(parseBatch("")).toEqual([]);
    expect(parseBatch("   ")).toEqual([]);
  });
});

describe("hreflang-tag-generator detectDuplicates", () => {
  it("returns empty when no duplicates", () => {
    expect(detectDuplicates([
      { hreflang: "en-US", url: "https://example.com/en-us" },
      { hreflang: "fr-FR", url: "https://example.com/fr-fr" },
    ])).toEqual([]);
  });
  it("detects duplicates", () => {
    const dups = detectDuplicates([
      { hreflang: "en-US", url: "https://example.com/en-us" },
      { hreflang: "en-US", url: "https://example.com/en-us2" },
    ]);
    expect(dups).toContain("en-US");
  });
  it("returns unique duplicates only", () => {
    const dups = detectDuplicates([
      { hreflang: "en", url: "https://example.com/en" },
      { hreflang: "en", url: "https://example.com/en2" },
      { hreflang: "en", url: "https://example.com/en3" },
    ]);
    expect(dups).toEqual(["en"]);
  });
});

describe("hreflang-tag-generator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, snippet: "x" });
    saveHistory({ ts: 2, snippet: "y" });
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

describe("hreflang-tag-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      entries: [{ hreflang: "en", url: "https://example.com/en" }],
    });
    expect(url).toContain("entries=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to input", () => {
    const input: HreflangInput = {
      entries: [{ hreflang: "en-US", url: "https://example.com/en-us" }],
      includeXDefault: true,
      xDefaultUrl: "https://example.com",
    };
    const url = buildShareUrl(input);
    // Strip the leading ? (window is undefined in test)
    const hash = url.replace(/^\?/, "#");
    const parsed = parseShareUrl(hash);
    expect(parsed.entries).toBeDefined();
    expect(parsed.entries?.[0].hreflang).toBe("en-US");
    expect(parsed.includeXDefault).toBe(true);
    expect(parsed.xDefaultUrl).toBe("https://example.com");
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("omits xDefaultUrl when not set", () => {
    const url = buildShareUrl({
      entries: [{ hreflang: "en", url: "https://example.com/en" }],
    });
    expect(url).not.toContain("xurl=");
  });
});
