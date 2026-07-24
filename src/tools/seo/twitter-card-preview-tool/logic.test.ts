/**
 * Twitter Card Preview Tool — unit tests.
 */
import { describe, it, expect } from "vitest";
import { validateCard, generateTwitterTags, parseTwitterTagsFromHtml, CARD_DIMENSIONS, saveHistory, loadHistory, clearHistory, type TwitterCardInput } from "./logic";

const VALID: TwitterCardInput = {
  cardType: "summary_large_image",
  site: "@mysite",
  creator: "@me",
  title: "My Title",
  description: "My description",
  imageUrl: "https://example.com/img.png",
  imageAlt: "Alt text",
  url: "https://example.com",
};

describe("validateCard", () => {
  it("passes for valid input", () => {
    const r = validateCard(VALID);
    expect(r.errors.length).toBe(0);
    expect(r.warnings.length).toBe(0);
  });
  it("errors on missing title", () => {
    const r = validateCard({ ...VALID, title: "" });
    expect(r.errors.some((e) => e.includes("title is required"))).toBe(true);
  });
  it("warns on long title", () => {
    const r = validateCard({ ...VALID, title: "x".repeat(80) });
    expect(r.warnings.some((w) => w.includes("70"))).toBe(true);
  });
  it("warns on long description", () => {
    const r = validateCard({ ...VALID, description: "x".repeat(220) });
    expect(r.warnings.some((w) => w.includes("200"))).toBe(true);
  });
  it("errors when summary_large_image missing image", () => {
    const r = validateCard({ ...VALID, imageUrl: undefined });
    expect(r.errors.some((e) => e.includes("requires twitter:image"))).toBe(true);
  });
  it("errors when player card missing playerUrl", () => {
    const r = validateCard({ ...VALID, cardType: "player" });
    expect(r.errors.some((e) => e.includes("twitter:player"))).toBe(true);
  });
  it("errors when app card missing all IDs", () => {
    const r = validateCard({ ...VALID, cardType: "app" });
    expect(r.errors.some((e) => e.includes("app ID"))).toBe(true);
  });
  it("returns char + pixel counts", () => {
    const r = validateCard(VALID);
    expect(r.titleCharCount).toBe(VALID.title.length);
    expect(r.descriptionCharCount).toBe(VALID.description.length);
    expect(r.titlePixelWidth).toBeGreaterThan(0);
  });
});

describe("generateTwitterTags", () => {
  it("generates twitter:card tag", () => {
    const tags = generateTwitterTags(VALID);
    expect(tags).toContain('name="twitter:card"');
    expect(tags).toContain('content="summary_large_image"');
  });
  it("includes all populated fields", () => {
    const tags = generateTwitterTags(VALID);
    expect(tags).toContain('twitter:site');
    expect(tags).toContain('twitter:creator');
    expect(tags).toContain('twitter:title');
    expect(tags).toContain('twitter:image');
    expect(tags).toContain('twitter:image:alt');
  });
  it("escapes HTML in attributes", () => {
    const tags = generateTwitterTags({ ...VALID, title: 'A & B "quotes" <html>' });
    expect(tags).toContain("&amp;");
    expect(tags).toContain("&quot;");
    expect(tags).toContain("&lt;");
  });
  it("includes player tags for player card", () => {
    const tags = generateTwitterTags({ ...VALID, cardType: "player", playerUrl: "https://example.com/v", playerWidth: 480, playerHeight: 270 });
    expect(tags).toContain("twitter:player");
    expect(tags).toContain("480");
    expect(tags).toContain("270");
  });
  it("includes app tags for app card", () => {
    const tags = generateTwitterTags({ ...VALID, cardType: "app", appIphoneId: "id123", appGoogleplayId: "com.example.app" });
    expect(tags).toContain("id123");
    expect(tags).toContain("com.example.app");
  });
});

describe("parseTwitterTagsFromHtml", () => {
  it("parses tags from raw HTML", () => {
    const html = `
      <meta name="twitter:card" content="summary_large_image">
      <meta name="twitter:site" content="@mysite">
      <meta name="twitter:title" content="My Title">
      <meta name="twitter:image" content="https://example.com/img.png">
    `;
    const parsed = parseTwitterTagsFromHtml(html);
    expect(parsed.cardType).toBe("summary_large_image");
    expect(parsed.site).toBe("@mysite");
    expect(parsed.title).toBe("My Title");
    expect(parsed.imageUrl).toBe("https://example.com/img.png");
  });
  it("handles single quotes", () => {
    const html = `<meta name='twitter:title' content='Single Quoted'>`;
    expect(parseTwitterTagsFromHtml(html).title).toBe("Single Quoted");
  });
  it("returns empty object for no tags", () => {
    expect(parseTwitterTagsFromHtml("<html></html>")).toEqual({});
  });
});

describe("CARD_DIMENSIONS", () => {
  it("has dimensions for all card types", () => {
    expect(CARD_DIMENSIONS.summary).toBeDefined();
    expect(CARD_DIMENSIONS.summary_large_image).toBeDefined();
    expect(CARD_DIMENSIONS.player).toBeDefined();
    expect(CARD_DIMENSIONS.app).toBeDefined();
  });
  it("summary is square 1:1", () => {
    expect(CARD_DIMENSIONS.summary.ratio).toBe("1:1");
  });
  it("summary_large_image is 1.91:1", () => {
    expect(CARD_DIMENSIONS.summary_large_image.ratio).toBe("1.91:1");
    expect(CARD_DIMENSIONS.summary_large_image.recommendedWidth).toBe(1200);
  });
});

describe("history (localStorage)", () => {
  // Note: localStorage is not available in vitest node env. These tests
  // are skipped. The logic functions silently no-op when localStorage is
  // unavailable, so the functions are safe to call.
  it.skip("save → load → clear works", () => {
    clearHistory();
    expect(loadHistory().length).toBe(0);
    saveHistory(VALID);
    expect(loadHistory().length).toBe(1);
    clearHistory();
    expect(loadHistory().length).toBe(0);
  });
  it("functions are safe to call when localStorage is undefined", () => {
    // Should not throw
    expect(() => saveHistory(VALID)).not.toThrow();
    expect(() => loadHistory()).not.toThrow();
    expect(() => clearHistory()).not.toThrow();
    expect(loadHistory()).toEqual([]);
  });
});
