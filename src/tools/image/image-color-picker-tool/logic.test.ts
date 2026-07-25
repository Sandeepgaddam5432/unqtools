import { describe, it, expect } from "vitest";
import {
  rgbToHsl,
  hslToRgb,
  rgbToHsv,
  rgbToCmyk,
  rgbToHex,
  hexToRgb,
  rgbToCssString,
  hslToCssString,
  hsvToString,
  cmykToString,
  relativeLuminance,
  contrastRatio,
  wcagGrade,
  contrastText,
  averageColor,
  pixelAt,
  computeLoupeRegion,
  detectEyeDropperSupport,
  addToHistory,
  paletteToCssVars,
  paletteToJson,
  complementary,
  analogous,
  buildPaletteFilename,
  buildColorFilename,
} from "./logic";

describe("rgbToHsl", () => {
  it("red is h=0, s=1, l=0.5", () => {
    const { h, s, l } = rgbToHsl({ r: 255, g: 0, b: 0 });
    expect(h).toBeCloseTo(0, 0); expect(s).toBeCloseTo(1, 1); expect(l).toBeCloseTo(0.5, 1);
  });
  it("gray is s=0", () => expect(rgbToHsl({ r: 128, g: 128, b: 128 }).s).toBe(0));
});

describe("hslToRgb round trip", () => {
  it("recovers original RGB", () => {
    const orig = { r: 123, g: 200, b: 50 };
    const back = hslToRgb(rgbToHsl(orig));
    expect(back.r).toBeCloseTo(orig.r, 0);
    expect(back.g).toBeCloseTo(orig.g, 0);
    expect(back.b).toBeCloseTo(orig.b, 0);
  });
});

describe("rgbToHsv", () => {
  it("white is v=1, s=0", () => {
    const hsv = rgbToHsv({ r: 255, g: 255, b: 255 });
    expect(hsv.v).toBe(1);
    expect(hsv.s).toBe(0);
  });
  it("red is h=0", () => expect(rgbToHsv({ r: 255, g: 0, b: 0 }).h).toBeCloseTo(0, 0));
});

describe("rgbToCmyk", () => {
  it("white is k=0 (no ink needed)", () => {
    const cmyk = rgbToCmyk({ r: 255, g: 255, b: 255 });
    expect(cmyk.k).toBe(0);
    expect(cmyk.c).toBe(0);
  });
  it("black has k=1", () => {
    const cmyk = rgbToCmyk({ r: 0, g: 0, b: 0 });
    expect(cmyk.k).toBe(1);
  });
  it("pure cyan → c=1, others 0", () => {
    const cmyk = rgbToCmyk({ r: 0, g: 255, b: 255 });
    expect(cmyk.c).toBeCloseTo(1, 1);
    expect(cmyk.m).toBeCloseTo(0, 1);
    expect(cmyk.y).toBeCloseTo(0, 1);
    expect(cmyk.k).toBeCloseTo(0, 1);
  });
});

describe("rgbToHex", () => {
  it("formats 6-digit hex", () => expect(rgbToHex({ r: 255, g: 0, b: 128 })).toBe("#ff0080"));
  it("zero-pads", () => expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe("#000000"));
});

describe("hexToRgb", () => {
  it("parses 6-digit hex", () => expect(hexToRgb("#ff0080")).toEqual({ r: 255, g: 0, b: 128 }));
  it("parses 3-digit hex", () => expect(hexToRgb("#f00")).toEqual({ r: 255, g: 0, b: 0 }));
  it("returns null for invalid input", () => expect(hexToRgb("nope")).toBeNull());
});

describe("format strings", () => {
  it("rgbToCssString", () => expect(rgbToCssString({ r: 10, g: 20, b: 30 })).toBe("rgb(10, 20, 30)"));
  it("hslToCssString", () => expect(hslToCssString({ h: 120, s: 0.5, l: 0.4 })).toBe("hsl(120, 50%, 40%)"));
  it("hsvToString", () => expect(hsvToString({ h: 0, s: 1, v: 1 })).toBe("hsv(0, 100%, 100%)"));
  it("cmykToString", () => expect(cmykToString({ c: 0.5, m: 0.25, y: 0.1, k: 0.3 })).toBe("cmyk(50%, 25%, 10%, 30%)"));
});

describe("relativeLuminance", () => {
  it("white is 1", () => expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 2));
  it("black is 0", () => expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0));
});

describe("contrastRatio", () => {
  it("identical colors have ratio 1", () => {
    expect(contrastRatio({ r: 100, g: 100, b: 100 }, { r: 100, g: 100, b: 100 })).toBeCloseTo(1, 2);
  });
  it("black on white is 21", () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 0);
  });
  it("is symmetric", () => {
    const a = { r: 30, g: 60, b: 90 };
    const b = { r: 200, g: 220, b: 240 };
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 5);
  });
});

describe("wcagGrade", () => {
  it("21 → AAA", () => expect(wcagGrade(21)).toBe("AAA"));
  it("7 → AAA", () => expect(wcagGrade(7)).toBe("AAA"));
  it("4.5 → AA", () => expect(wcagGrade(4.5)).toBe("AA"));
  it("3 → AA Large", () => expect(wcagGrade(3)).toBe("AA Large"));
  it("2 → Fail", () => expect(wcagGrade(2)).toBe("Fail"));
});

describe("contrastText", () => {
  it("returns black for white background", () => expect(contrastText({ r: 255, g: 255, b: 255 })).toBe("#000000"));
  it("returns white for black background", () => expect(contrastText({ r: 0, g: 0, b: 0 })).toBe("#ffffff"));
});

describe("averageColor", () => {
  it("averages an NxN region", () => {
    const rgba = new Uint8ClampedArray([
      0, 0, 0, 255, 100, 100, 100, 255,
      0, 0, 0, 255, 100, 100, 100, 255,
    ]);
    const avg = averageColor(rgba, 2, 2, 0, 0, 3);
    expect(avg.r).toBeGreaterThanOrEqual(0);
    expect(avg.r).toBeLessThanOrEqual(100);
  });
  it("handles edge out-of-bounds", () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4).fill(128);
    const avg = averageColor(rgba, 4, 4, 0, 0, 5);
    expect(avg.r).toBe(128);
  });
});

describe("pixelAt", () => {
  it("returns the correct pixel color", () => {
    const rgba = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255]);
    expect(pixelAt(rgba, 2, 0, 0)).toEqual({ r: 10, g: 20, b: 30 });
    expect(pixelAt(rgba, 2, 1, 0)).toEqual({ r: 40, g: 50, b: 60 });
  });
});

describe("computeLoupeRegion", () => {
  it("returns a region centered on (cx,cy)", () => {
    const r = computeLoupeRegion(50, 50, 100, 100, 20, 4);
    expect(r.sw).toBe(5);
    expect(r.sh).toBe(5);
  });
  it("clamps to image bounds", () => {
    const r = computeLoupeRegion(0, 0, 100, 100, 20, 4);
    expect(r.sx).toBe(0);
    expect(r.sy).toBe(0);
  });
});

describe("detectEyeDropperSupport", () => {
  it("returns boolean", () => {
    expect(typeof detectEyeDropperSupport()).toBe("boolean");
  });
});

describe("addToHistory", () => {
  it("adds new colors to the front", () => {
    const history = [{ r: 1, g: 1, b: 1 }];
    const next = addToHistory(history, { r: 2, g: 2, b: 2 });
    expect(next[0]).toEqual({ r: 2, g: 2, b: 2 });
    expect(next.length).toBe(2);
  });
  it("deduplicates identical colors", () => {
    const history = [{ r: 1, g: 1, b: 1 }, { r: 2, g: 2, b: 2 }];
    const next = addToHistory(history, { r: 1, g: 1, b: 1 });
    expect(next.length).toBe(2);
    expect(next[0]).toEqual({ r: 1, g: 1, b: 1 });
  });
  it("caps at max length", () => {
    const history = Array.from({ length: 25 }, (_, i) => ({ r: i, g: i, b: i }));
    const next = addToHistory(history, { r: 99, g: 99, b: 99 }, 10);
    expect(next.length).toBe(10);
  });
});

describe("paletteToCssVars", () => {
  it("emits CSS variables", () => {
    const out = paletteToCssVars([{ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 }]);
    expect(out).toContain("--color-1: #ff0000;");
    expect(out).toContain("--color-2: #00ff00;");
  });
});

describe("paletteToJson", () => {
  it("emits valid JSON with hex/rgb/hsl", () => {
    const json = paletteToJson([{ r: 255, g: 255, b: 255 }]);
    const parsed = JSON.parse(json);
    expect(parsed[0].hex).toBe("#ffffff");
    expect(parsed[0].rgb).toBe("rgb(255, 255, 255)");
  });
});

describe("complementary", () => {
  it("returns a different color", () => {
    const c = complementary({ r: 255, g: 0, b: 0 });
    expect(c).not.toEqual({ r: 255, g: 0, b: 0 });
  });
});

describe("analogous", () => {
  it("returns two distinct colors", () => {
    const a = analogous({ r: 0, g: 128, b: 255 });
    expect(a.left).toBeDefined();
    expect(a.right).toBeDefined();
  });
});

describe("buildPaletteFilename / buildColorFilename", () => {
  it("builds palette filenames", () => {
    expect(buildPaletteFilename("css")).toBe("palette.css");
    expect(buildPaletteFilename("json")).toBe("palette.json");
  });
  it("builds color filenames", () => {
    expect(buildColorFilename({ r: 255, g: 0, b: 128 })).toBe("color-ff0080.txt");
  });
});
