import { describe, it, expect } from "vitest";
import {
  parseHex, toHex, rgbToHsl, hslToRgb, blend, blendWithAlpha,
  generateShadesTints, analogous, harmony, palette, colorsToCsv,
  toCssGradient, BLEND_MODES,
} from "./logic";

describe("parseHex & toHex", () => {
  it("parses #fff", () => {
    expect(parseHex("#fff")).toEqual({ r: 255, g: 255, b: 255 });
  });
  it("parses #00ff00", () => {
    expect(parseHex("#00ff00")).toEqual({ r: 0, g: 255, b: 0 });
  });
  it("returns null on invalid", () => {
    expect(parseHex("#nope")).toBeNull();
  });
  it("toHex round-trips", () => {
    expect(toHex({ r: 10, g: 20, b: 30 })).toBe("#0a141e");
  });
});

describe("rgbToHsl & hslToRgb", () => {
  it("red -> hsl(0,100,50)", () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 });
  });
  it("hslToRgb red", () => {
    expect(hslToRgb({ h: 0, s: 100, l: 50 })).toEqual({ r: 255, g: 0, b: 0 });
  });
  it("gray has 0 saturation", () => {
    expect(rgbToHsl({ r: 128, g: 128, b: 128 }).s).toBe(0);
  });
  it("hslToRgb gray", () => {
    expect(hslToRgb({ h: 0, s: 0, l: 50 })).toEqual({ r: 128, g: 128, b: 128 });
  });
  it("round-trips", () => {
    const c = { r: 123, g: 200, b: 64 };
    const h = rgbToHsl(c);
    const back = hslToRgb(h);
    expect(back.r).toBeGreaterThan(c.r - 2);
    expect(back.r).toBeLessThan(c.r + 2);
  });
});

describe("blend modes", () => {
  const a = { r: 100, g: 100, b: 100 };
  const b = { r: 200, g: 50, b: 0 };
  it("normal returns top color", () => {
    expect(blend(a, b, "normal")).toEqual(b);
  });
  it("multiply darkens", () => {
    const r = blend(a, b, "multiply");
    expect(r.r).toBeLessThan(a.r);
  });
  it("screen lightens", () => {
    const r = blend(a, b, "screen");
    expect(r.r).toBeGreaterThan(a.r);
  });
  it("darken returns min per channel", () => {
    const r = blend(a, b, "darken");
    expect(r.r).toBe(Math.min(a.r, b.r));
  });
  it("lighten returns max per channel", () => {
    const r = blend(a, b, "lighten");
    expect(r.g).toBe(Math.max(a.g, b.g));
  });
  it("difference returns abs diff", () => {
    const r = blend(a, b, "difference");
    expect(r.r).toBe(Math.abs(a.r - b.r));
  });
  it("addition clamps at 255", () => {
    const r = blend({ r: 200, g: 200, b: 200 }, { r: 200, g: 200, b: 200 }, "addition");
    expect(r.r).toBe(255);
  });
  it("subtract clamps at 0", () => {
    const r = blend({ r: 10, g: 10, b: 10 }, { r: 200, g: 200, b: 200 }, "subtract");
    expect(r.r).toBe(0);
  });
});

describe("blendWithAlpha", () => {
  it("alpha=0 returns base", () => {
    expect(blendWithAlpha({ r: 10, g: 20, b: 30 }, { r: 100, g: 100, b: 100 }, 0)).toEqual({ r: 10, g: 20, b: 30 });
  });
  it("alpha=1 returns overlay", () => {
    expect(blendWithAlpha({ r: 10, g: 20, b: 30 }, { r: 100, g: 100, b: 100 }, 1)).toEqual({ r: 100, g: 100, b: 100 });
  });
  it("mid alpha interpolates", () => {
    const r = blendWithAlpha({ r: 0, g: 0, b: 0 }, { r: 100, g: 100, b: 100 }, 0.5);
    expect(r.r).toBe(50);
  });
});

describe("generateShadesTints", () => {
  it("produces 5 tints and 5 shades", () => {
    const { tints, shades } = generateShadesTints({ r: 100, g: 100, b: 100 });
    expect(tints.length).toBe(5);
    expect(shades.length).toBe(5);
  });
  it("tints are lighter than base", () => {
    const { tints } = generateShadesTints({ r: 50, g: 50, b: 50 });
    expect(tints[0].r).toBeGreaterThan(50);
  });
  it("shades are darker than base", () => {
    const { shades } = generateShadesTints({ r: 200, g: 200, b: 200 });
    expect(shades[0].r).toBeLessThan(200);
  });
});

describe("analogous & harmony", () => {
  it("analogous returns count colors", () => {
    const list = analogous({ r: 200, g: 50, b: 50 }, 5);
    expect(list.length).toBe(5);
  });
  it("complementary has 2", () => {
    expect(harmony({ r: 200, g: 50, b: 50 }, "complementary").length).toBe(2);
  });
  it("triadic has 3", () => {
    expect(harmony({ r: 200, g: 50, b: 50 }, "triadic").length).toBe(3);
  });
  it("tetradic has 4", () => {
    expect(harmony({ r: 200, g: 50, b: 50 }, "tetradic").length).toBe(4);
  });
});

describe("palette", () => {
  it("returns requested count", () => {
    expect(palette({ r: 200, g: 50, b: 50 }, "mono", 6).length).toBe(6);
  });
  it("pastel palette is light", () => {
    const p = palette({ r: 200, g: 50, b: 50 }, "pastel", 4);
    for (const c of p) {
      const h = rgbToHsl(c);
      expect(h.l).toBeGreaterThan(60);
    }
  });
});

describe("exporters", () => {
  it("colorsToCsv produces header", () => {
    const csv = colorsToCsv([{ r: 0, g: 0, b: 0 }]);
    expect(csv.startsWith("hex,r,g,b")).toBe(true);
  });
  it("toCssGradient builds gradient string", () => {
    const g = toCssGradient([{ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 }]);
    expect(g).toContain("linear-gradient");
    expect(g).toContain("#ff0000");
    expect(g).toContain("#0000ff");
  });
  it("empty colors produce empty gradient", () => {
    expect(toCssGradient([])).toBe("");
  });
});

describe("BLEND_MODES", () => {
  it("contains at least 14 modes", () => {
    expect(BLEND_MODES.length).toBeGreaterThanOrEqual(14);
  });
});
