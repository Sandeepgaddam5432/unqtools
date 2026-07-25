import { describe, it, expect } from "vitest";
import {
  PALETTES,
  getColors,
  colorForIndex,
  escapeHtml,
  rainbowHtml,
  rainbowMarkdown,
  rainbowPlain,
  validateRainbow,
  isIdentity,
  batchValidate,
  rainbowStats,
  palettePreview,
  findPreset,
  PRESETS,
  parseHex,
  mixColors,
  DEFAULT_OPTIONS,
  type RainbowOptions,
} from "./logic";

const OPTS: RainbowOptions = { ...DEFAULT_OPTIONS };

describe("PALETTES", () => {
  it("has 5 built-in palettes", () => {
    expect(Object.keys(PALETTES).length).toBe(5);
  });
  it("each palette has at least 3 colors", () => {
    for (const k of Object.keys(PALETTES) as Array<keyof typeof PALETTES>) {
      expect(PALETTES[k].length).toBeGreaterThanOrEqual(3);
    }
  });
  it("rainbow palette starts red, ends violet", () => {
    expect(PALETTES.rainbow[0]).toBe("#ff0000");
    expect(PALETTES.rainbow[PALETTES.rainbow.length - 1]).toBe("#9400d3");
  });
});

describe("getColors + colorForIndex", () => {
  it("returns palette colors", () => {
    expect(getColors({ palette: "rainbow", customColors: [], reverse: false })).toBe(PALETTES.rainbow);
  });
  it("reverse flips the array", () => {
    const c = getColors({ palette: "rainbow", customColors: [], reverse: true });
    expect(c[0]).toBe(PALETTES.rainbow[PALETTES.rainbow.length - 1]);
  });
  it("custom palette returns customColors", () => {
    expect(getColors({ palette: "custom", customColors: ["#000", "#fff"], reverse: false })).toEqual(["#000", "#fff"]);
  });
  it("custom palette with too few colors falls back to rainbow", () => {
    expect(getColors({ palette: "custom", customColors: [], reverse: false })).toBe(PALETTES.rainbow);
  });
  it("returns first color for index 0", () => {
    expect(colorForIndex(0, OPTS)).toBe("#ff0000");
  });
  it("wraps around for index >= length", () => {
    expect(colorForIndex(7, OPTS)).toBe(colorForIndex(0, OPTS));
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
    const html = rainbowHtml("abc", OPTS);
    expect(html).toContain("<span");
    expect(html).toContain("color:#ff0000");
  });
  it("escapes HTML in input", () => {
    const html = rainbowHtml("<a>", OPTS);
    expect(html).toContain("&lt;a&gt;");
    expect(html).not.toContain("<a>");
  });
  it("converts newlines to <br/>", () => {
    expect(rainbowHtml("a\nb", OPTS)).toContain("<br/>");
  });
  it("adds animation when animate=true", () => {
    const html = rainbowHtml("hi", { ...OPTS, animate: true });
    expect(html).toContain("animation:");
  });
  it("returns empty for empty input", () => {
    expect(rainbowHtml("", OPTS)).toBe("");
  });
  it("handles spaces with nbsp", () => {
    expect(rainbowHtml("a b", OPTS)).toContain("&nbsp;");
  });
  it("per-line mode colors entire line", () => {
    const html = rainbowHtml("a\nb", { ...OPTS, perChar: false });
    expect(html).toContain('color:#ff0000"');
    expect(html).toContain('color:#ff7f00"');
    expect(html).toContain('>a</span>');
    expect(html).toContain('>b</span>');
  });
});

describe("rainbowMarkdown + rainbowPlain", () => {
  it("markdown produces HTML", () => {
    const md = rainbowMarkdown("abc", OPTS);
    expect(md).toContain("<span");
  });
  it("plain returns input unchanged", () => {
    expect(rainbowPlain("hello")).toBe("hello");
  });
});

describe("validateRainbow", () => {
  it("accepts valid opts", () => {
    expect("error" in validateRainbow(OPTS)).toBe(false);
  });
  it("rejects bad palette", () => {
    expect("error" in validateRainbow({ ...OPTS, palette: "bad" as never })).toBe(true);
  });
  it("rejects bad format", () => {
    expect("error" in validateRainbow({ ...OPTS, format: "bad" as never })).toBe(true);
  });
  it("rejects custom palette with too few colors", () => {
    expect("error" in validateRainbow({ ...OPTS, palette: "custom", customColors: [] })).toBe(true);
  });
});

describe("helpers + presets", () => {
  it("isIdentity always false", () => {
    expect(isIdentity(OPTS)).toBe(false);
  });
  it("batchValidate validates each input", () => {
    const r = batchValidate([{ name: "a" }], OPTS);
    expect("error" in r[0]!.result).toBe(false);
  });
  it("rainbowStats returns counts", () => {
    const s = rainbowStats("abc\ndef", OPTS);
    expect(s.chars).toBe(7);
    expect(s.lines).toBe(2);
    expect(s.colors).toBe(7);
  });
  it("palettePreview returns colors", () => {
    expect(palettePreview(OPTS)).toBe(PALETTES.rainbow);
  });
  it("findPreset returns matching", () => {
    expect(findPreset("neon")?.options.palette).toBe("neon");
  });
  it("has at least 5 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
  });
  it("parseHex parses valid hex", () => {
    expect(parseHex("#ff8800")).toEqual([255, 136, 0]);
  });
  it("parseHex returns null for invalid hex", () => {
    expect(parseHex("#xyz")).toBeNull();
    expect(parseHex("#ff")).toBeNull();
  });
  it("mixColors interpolates", () => {
    expect(mixColors("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
  it("mixColors returns null for invalid colors", () => {
    expect(mixColors("bad", "#ffffff", 0.5)).toBeNull();
  });
});
