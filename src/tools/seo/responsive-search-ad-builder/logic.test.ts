import { describe, it, expect, beforeEach } from "vitest";
import {
  HEADLINE_MAX,
  DESCRIPTION_MAX,
  PATH_MAX,
  MAX_HEADLINES,
  MAX_DESCRIPTIONS,
  MIN_HEADLINES,
  MIN_DESCRIPTIONS,
  isValidUrl,
  charCount,
  validateHeadlines,
  validateDescriptions,
  validatePaths,
  validateInput,
  estimateStrength,
  buildDesktopPreview,
  buildMobilePreview,
  renderAdText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  GOOGLE_RSA_DOCS_URL,
  type RsaInput,
  type Headline,
  type Description,
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

const makeHeadlines = (texts: string[]): Headline[] =>
  texts.map((text, i) => ({ id: i + 1, text, pin: "none" as const }));

const makeDescriptions = (texts: string[]): Description[] =>
  texts.map((text, i) => ({ id: i + 1, text, pin: "none" as const }));

const validInput: RsaInput = {
  headlines: makeHeadlines([
    "Buy Running Shoes",
    "Top Running Shoe Deals",
    "Free Shipping Today",
    "Shop Best Running Shoes",
  ]),
  descriptions: makeDescriptions([
    "Get the best running shoes for your training needs. Shop today and save big on top brands.",
    "Free shipping on all orders over $50. Shop our wide selection of premium running shoes.",
  ]),
  finalUrl: "https://example.com/running-shoes",
  displayURL: "https://example.com",
  path1: "running",
  path2: "shoes",
};

describe("rsa-builder constants", () => {
  it("has Google Ads RSA spec constants", () => {
    expect(HEADLINE_MAX).toBe(30);
    expect(DESCRIPTION_MAX).toBe(90);
    expect(PATH_MAX).toBe(15);
    expect(MAX_HEADLINES).toBe(15);
    expect(MAX_DESCRIPTIONS).toBe(4);
    expect(MIN_HEADLINES).toBe(3);
    expect(MIN_DESCRIPTIONS).toBe(2);
  });
  it("points to Google RSA docs", () => {
    expect(GOOGLE_RSA_DOCS_URL).toContain("google.com");
    expect(GOOGLE_RSA_DOCS_URL).toContain("7361401");
  });
});

describe("rsa-builder isValidUrl", () => {
  it("accepts https URLs", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("http://example.com/x")).toBe(true);
  });
  it("rejects invalid", () => {
    expect(isValidUrl("not a url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
});

describe("rsa-builder charCount", () => {
  it("counts characters correctly", () => {
    const c = charCount("hello", 30);
    expect(c.length).toBe(5);
    expect(c.remaining).toBe(25);
    expect(c.isOver).toBe(false);
  });
  it("flags over-limit", () => {
    const c = charCount("a".repeat(35), 30);
    expect(c.isOver).toBe(true);
    expect(c.remaining).toBe(-5);
  });
  it("flags near-limit warning", () => {
    const c = charCount("a".repeat(29), 30);
    expect(c.isWarn).toBe(true);
    expect(c.isOver).toBe(false);
  });
  it("handles empty", () => {
    const c = charCount("", 30);
    expect(c.length).toBe(0);
    expect(c.remaining).toBe(30);
  });
});

describe("rsa-builder validateHeadlines", () => {
  it("passes for 3 valid headlines", () => {
    const r = validateHeadlines(makeHeadlines(["a", "b", "c"]));
    expect(r.errors).toHaveLength(0);
  });
  it("errors on fewer than 3 headlines", () => {
    const r = validateHeadlines(makeHeadlines(["a", "b"]));
    expect(r.errors.some((e) => /at least 3/i.test(e))).toBe(true);
  });
  it("errors on more than 15 headlines", () => {
    const r = validateHeadlines(makeHeadlines(Array.from({ length: 16 }, (_, i) => `h${i}`)));
    expect(r.errors.some((e) => /too many/i.test(e))).toBe(true);
  });
  it("errors on headline over 30 chars", () => {
    const r = validateHeadlines(makeHeadlines(["a".repeat(35), "b", "c"]));
    expect(r.errors.some((e) => /35 chars/i.test(e))).toBe(true);
  });
  it("warns on duplicate headlines", () => {
    const r = validateHeadlines(makeHeadlines(["same", "same", "c"]));
    expect(r.warnings.some((w) => /duplicate/i.test(w))).toBe(true);
  });
});

describe("rsa-builder validateDescriptions", () => {
  it("passes for 2 valid descriptions", () => {
    const r = validateDescriptions(makeDescriptions(["a", "b"]));
    expect(r.errors).toHaveLength(0);
  });
  it("errors on fewer than 2 descriptions", () => {
    const r = validateDescriptions(makeDescriptions(["a"]));
    expect(r.errors.some((e) => /at least 2/i.test(e))).toBe(true);
  });
  it("errors on more than 4 descriptions", () => {
    const r = validateDescriptions(makeDescriptions(["a", "b", "c", "d", "e"]));
    expect(r.errors.some((e) => /too many/i.test(e))).toBe(true);
  });
  it("errors on description over 90 chars", () => {
    const r = validateDescriptions(makeDescriptions(["a".repeat(95), "b"]));
    expect(r.errors.some((e) => /95 chars/i.test(e))).toBe(true);
  });
});

describe("rsa-builder validatePaths", () => {
  it("passes for valid paths", () => {
    const r = validatePaths("running", "shoes");
    expect(r.errors).toHaveLength(0);
  });
  it("errors on path over 15 chars", () => {
    const r = validatePaths("a".repeat(20), undefined);
    expect(r.errors.some((e) => /20 chars/i.test(e))).toBe(true);
  });
  it("warns when path2 set without path1", () => {
    const r = validatePaths(undefined, "shoes");
    expect(r.warnings.some((w) => /Path 2/i.test(w))).toBe(true);
  });
  it("warns on special characters in path", () => {
    const r = validatePaths("running shoes!", undefined);
    expect(r.warnings.some((w) => /characters/i.test(w))).toBe(true);
  });
});

describe("rsa-builder validateInput", () => {
  it("passes for valid input", () => {
    const v = validateInput(validInput);
    expect(v.ok).toBe(true);
    expect(v.errors).toHaveLength(0);
  });
  it("errors on missing final URL", () => {
    const v = validateInput({ ...validInput, finalUrl: "" });
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => /Final URL/i.test(e))).toBe(true);
  });
  it("errors on invalid final URL", () => {
    const v = validateInput({ ...validInput, finalUrl: "not-a-url" });
    expect(v.ok).toBe(false);
  });
  it("aggregates errors from headlines + descriptions + paths", () => {
    const v = validateInput({
      ...validInput,
      headlines: [makeHeadlines(["a"])[0]],
      descriptions: [],
    });
    expect(v.errors.length).toBeGreaterThan(0);
  });
});

describe("rsa-builder estimateStrength", () => {
  it("returns excellent for many headlines + descriptions", () => {
    const manyHeadlines = makeHeadlines([
      "buy running shoes", "best running shoes 2026", "free shipping today",
      "top running shoe deals", "shop premium shoes", "running shoes online",
      "discount running shoes", "marathon training shoes", "best sneakers",
      "running gear sale", "athletic footwear", "best deals on shoes",
      "professional running shoes", "everyday running shoes", "casual sneakers",
    ]);
    const manyDescriptions = makeDescriptions([
      "Get the best running shoes for your training needs. Shop today and save big on top brands.",
      "Free shipping on all orders over $50. Shop our wide selection of premium running shoes.",
      "Top-rated running shoes for every type of runner. Read reviews and find your perfect fit.",
      "Limited-time sale on premium running shoes. Get up to 50% off select styles. Shop now.",
    ]);
    const strength = estimateStrength({
      ...validInput,
      headlines: manyHeadlines,
      descriptions: manyDescriptions,
    });
    expect(strength.score).toBeGreaterThanOrEqual(80);
    expect(["excellent", "good"]).toContain(strength.level);
  });
  it("returns poor for minimal input", () => {
    const strength = estimateStrength({
      ...validInput,
      headlines: makeHeadlines(["a", "b", "c"]),
      descriptions: makeDescriptions(["short", "another short"]),
    });
    expect(strength.score).toBeLessThan(60);
    expect(strength.level).toMatch(/poor|average/);
  });
  it("returns score between 0 and 100", () => {
    const strength = estimateStrength(validInput);
    expect(strength.score).toBeGreaterThanOrEqual(0);
    expect(strength.score).toBeLessThanOrEqual(100);
  });
  it("includes a reason string", () => {
    const strength = estimateStrength(validInput);
    expect(strength.reason).toBeTruthy();
  });
});

describe("rsa-builder buildDesktopPreview", () => {
  it("builds preview with up to 3 headlines", () => {
    const preview = buildDesktopPreview(validInput);
    expect(preview.headlines.length).toBeLessThanOrEqual(3);
  });
  it("builds preview with up to 2 descriptions", () => {
    const preview = buildDesktopPreview(validInput);
    expect(preview.descriptions.length).toBeLessThanOrEqual(2);
  });
  it("includes display URL with paths", () => {
    const preview = buildDesktopPreview(validInput);
    expect(preview.displayUrl).toContain("running");
    expect(preview.displayUrl).toContain("shoes");
  });
  it("extracts domain from final URL when no display URL", () => {
    const preview = buildDesktopPreview({ ...validInput, displayURL: undefined });
    expect(preview.displayUrl).toContain("example.com");
  });
  it("handles empty input gracefully", () => {
    const preview = buildDesktopPreview({
      headlines: [],
      descriptions: [],
      finalUrl: "",
    });
    expect(preview.headlines).toHaveLength(0);
    expect(preview.descriptions).toHaveLength(0);
  });
});

describe("rsa-builder buildMobilePreview", () => {
  it("builds preview with up to 2 headlines (mobile shows fewer)", () => {
    const preview = buildMobilePreview(validInput);
    expect(preview.headlines.length).toBeLessThanOrEqual(2);
  });
  it("builds preview with up to 1 description", () => {
    const preview = buildMobilePreview(validInput);
    expect(preview.descriptions.length).toBeLessThanOrEqual(1);
  });
});

describe("rsa-builder renderAdText", () => {
  it("renders plain text with headlines and descriptions", () => {
    const text = renderAdText(validInput);
    expect(text).toContain("Headlines:");
    expect(text).toContain("Descriptions:");
    expect(text).toContain("Buy Running Shoes");
    expect(text).toContain("Display URL:");
    expect(text).toContain("Final URL:");
  });
});

describe("rsa-builder renderCsv", () => {
  it("renders CSV with headers", () => {
    const csv = renderCsv(validInput);
    expect(csv).toContain("type,position,text,pin");
    expect(csv).toContain("headline,1");
    expect(csv).toContain("description,1");
  });
  it("escapes commas in text", () => {
    const input: RsaInput = {
      ...validInput,
      headlines: makeHeadlines(["hello, world", "b", "c"]),
    };
    const csv = renderCsv(input);
    expect(csv).toContain('"hello, world"');
  });
});

describe("rsa-builder history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, headlineCount: 10, descriptionCount: 4, strength: "excellent", score: 85 });
    saveHistory({ ts: 2, headlineCount: 5, descriptionCount: 2, strength: "average", score: 50 });
    expect(loadHistory()).toHaveLength(2);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, headlineCount: 1, descriptionCount: 1, strength: "poor", score: 10 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, headlineCount: 1, descriptionCount: 1, strength: "poor", score: 10 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("rsa-builder shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ input: validInput });
    expect(url).toContain("finalUrl=");
    expect(url).toContain("headlines=");
    expect(url).toContain("descriptions=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = {
      location: { origin: "https://app.example.com", pathname: "/tools/responsive-search-ad-builder" },
    };
    try {
      const url = buildShareUrl({ input: validInput });
      const hash = url.includes("#") ? `#${url.split("#")[1]}` : "";
      const parsed = parseShareUrl(hash);
      expect(parsed.finalUrl).toBe(validInput.finalUrl);
      expect(parsed.headlines).toBeDefined();
      expect(parsed.headlines?.length).toBeGreaterThan(0);
    } finally {
      (globalThis as Record<string, unknown>).window = origWindow;
    }
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("handles malformed JSON in headlines", () => {
    const parsed = parseShareUrl("headlines=not-json");
    expect(parsed.headlines).toBeUndefined();
  });
});

describe("rsa-builder pin position validation", () => {
  it("warns on more than 3 headlines pinned to same position", () => {
    const headlines: Headline[] = [
      { id: 1, text: "a", pin: "pinned-h1" },
      { id: 2, text: "b", pin: "pinned-h1" },
      { id: 3, text: "c", pin: "pinned-h1" },
      { id: 4, text: "d", pin: "pinned-h1" },
    ];
    const r = validateHeadlines(headlines);
    expect(r.warnings.some((w) => /pinned to position H1/i.test(w))).toBe(true);
  });
  it("warns on more than 2 descriptions pinned to same position", () => {
    const descriptions: Description[] = [
      { id: 1, text: "first description here", pin: "pinned-d1" },
      { id: 2, text: "second description here", pin: "pinned-d1" },
      { id: 3, text: "third description here", pin: "pinned-d1" },
    ];
    const r = validateDescriptions(descriptions);
    expect(r.warnings.some((w) => /pinned to D1/i.test(w))).toBe(true);
  });
});
