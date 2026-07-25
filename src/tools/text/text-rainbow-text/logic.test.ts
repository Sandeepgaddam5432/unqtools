import { describe, it, expect } from "vitest";
import { PALETTES, colorForIndex, escapeHtml, rainbowHtml, rainbowPlain, type RainbowPalette } from "./logic";

describe("PALETTES", () => {
  it("has 5 palettes", () => {
    expect(Object.keys(PALETTES).length).toBe(5);
  });
  it("each palette has at least 3 colors", () => {
    for (const k of Object.keys(PALETTES) as RainbowPalette[]) {
      expect(PALETTES[k].length).toBeGreaterThanOrEqual(3);
    }
  });
  it("rainbow palette starts red, ends violet", () => {
    expect(PALETTES.rainbow[0]).toBe("#ff0000");
    expect(PALETTES.rainbow[PALETTES.rainbow.length - 1]).toBe("#9400d3");
  });
});

describe("colorForIndex", () => {
  it("returns first color for index 0", () => {
    expect(colorForIndex(0, "rainbow")).toBe("#ff0000");
  });
  it("wraps around for index >= length", () => {
    expect(colorForIndex(7, "rainbow")).toBe(colorForIndex(0, "rainbow"));
    expect(colorForIndex(14, "rainbow")).toBe(colorForIndex(0, "rainbow"));
  });
  it("falls back to rainbow for unknown palette", () => {
    expect(colorForIndex(0, "nonexistent" as RainbowPalette)).toBe("#ff0000");
  });
});

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("a&b")).toBe("a&amp;b");
  });
  it("escapes angle brackets", () => {
    expect(escapeHtml("<b>")).toBe("&lt;b&gt;");
  });
  it("escapes quotes", () => {
    expect(escapeHtml('"hi"')).toBe("&quot;hi&quot;");
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });
  it("preserves normal text", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });
});

describe("rainbowHtml", () => {
  it("wraps each char in a span", () => {
    const html = rainbowHtml("abc", "rainbow", false);
    expect(html).toContain("<span");
    expect(html).toContain('color:#ff0000');
    expect(html).toContain('color:#ff7f00');
    expect(html).toContain('color:#ffff00');
  });
  it("escapes HTML in input", () => {
    const html = rainbowHtml("<a>", "rainbow", false);
    expect(html).toContain("&lt;a&gt;");
    expect(html).not.toContain("<a>");
  });
  it("converts newlines to <br/>", () => {
    expect(rainbowHtml("a\nb", "rainbow", false)).toContain("<br/>");
  });
  it("adds animation when animate=true", () => {
    const html = rainbowHtml("hi", "rainbow", true);
    expect(html).toContain("animation:");
  });
  it("returns empty for empty input", () => {
    expect(rainbowHtml("", "rainbow", false)).toBe("");
  });
  it("handles spaces with nbsp", () => {
    expect(rainbowHtml("a b", "rainbow", false)).toContain("&nbsp;");
  });
});

describe("rainbowPlain", () => {
  it("returns input unchanged", () => {
    expect(rainbowPlain("hello")).toBe("hello");
  });
});
