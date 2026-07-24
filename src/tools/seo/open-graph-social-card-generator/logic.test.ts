/**
 * Open Graph Social Card Generator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { CARD_SIZES, DEFAULT_CONFIG, wrapText, generateOgTags } from "./logic";

// Mock CanvasRenderingContext2D for testing wrapText
function makeMockCtx(measureWidths: Record<string, number> = {}): { ctx: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = [];
  const ctx = {
    canvas: { width: 0, height: 0 },
    fillStyle: "",
    font: "",
    textAlign: "left",
    textBaseline: "top",
    globalAlpha: 1,
    fillRect: () => { calls.push("fillRect"); },
    fillText: (text: string) => { calls.push(`fillText:${text}`); },
    measureText: (text: string) => ({ width: measureWidths[text] ?? text.length * 10 }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

describe("CARD_SIZES", () => {
  it("contains at least 5 sizes", () => {
    expect(CARD_SIZES.length).toBeGreaterThanOrEqual(5);
  });
  it("includes standard OG 1200x630", () => {
    const og = CARD_SIZES.find((s) => s.id === "og-1200x630");
    expect(og?.width).toBe(1200);
    expect(og?.height).toBe(630);
  });
  it("all sizes have positive dimensions", () => {
    for (const s of CARD_SIZES) {
      expect(s.width).toBeGreaterThan(0);
      expect(s.height).toBeGreaterThan(0);
    }
  });
});

describe("DEFAULT_CONFIG", () => {
  it("has required fields", () => {
    expect(DEFAULT_CONFIG.title).toBeTruthy();
    expect(DEFAULT_CONFIG.brandName).toBeTruthy();
    expect(DEFAULT_CONFIG.backgroundColor).toMatch(/^#/);
    expect(DEFAULT_CONFIG.textColor).toMatch(/^#/);
  });
  it("defaults to standard OG size", () => {
    expect(DEFAULT_CONFIG.size).toBe("og-1200x630");
  });
});

describe("wrapText", () => {
  it("returns single line when text fits", () => {
    const { ctx } = makeMockCtx({ "Hello": 50, "Hello World": 110, "World": 60 });
    // Default measure = text.length * 10; "Hello World" = 110 chars width
    const lines = wrapText(ctx, "Hello", 200);
    expect(lines).toEqual(["Hello"]);
  });
  it("wraps long text into multiple lines", () => {
    const { ctx } = makeMockCtx({});
    // Each char is 10 wide; maxWidth 50 → ~5 chars per word
    // Use multiple words so wrapText can split
    const lines = wrapText(ctx, "aaaaa bbbbb ccccc ddddd", 50);
    expect(lines.length).toBeGreaterThan(1);
  });
  it("handles empty input", () => {
    const { ctx } = makeMockCtx({});
    expect(wrapText(ctx, "", 200)).toEqual([]);
  });
});

describe("generateOgTags", () => {
  it("generates og:title and twitter:card tags", () => {
    const tags = generateOgTags("https://example.com", "My Title", "Description", "https://example.com/img.png");
    expect(tags).toContain('property="og:title"');
    expect(tags).toContain('property="og:image"');
    expect(tags).toContain('name="twitter:card"');
    expect(tags).toContain('content="summary_large_image"');
  });
  it("escapes HTML entities in attributes", () => {
    const tags = generateOgTags("https://x.com", 'A & B "quotes"', "desc", "img.png");
    expect(tags).toContain("&amp;");
    expect(tags).toContain("&quot;");
  });
});
