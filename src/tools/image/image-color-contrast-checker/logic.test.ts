import { describe, it, expect } from "vitest";
import {
  parseHex,
  toHex,
  relativeLuminance,
  contrastRatio,
  evaluateContrast,
  apcaContrast,
  suggestColors,
  isValidHex,
  formatReport,
  rgbToHsl,
  recommendTextRole,
  adjustLightness,
} from "./logic";

describe("parseHex", () => {
  it("parses #RRGGBB", () => {
    expect(parseHex("#ff8800")).toEqual({ r: 255, g: 136, b: 0 });
  });
  it("parses #RGB short form", () => {
    expect(parseHex("#f80")).toEqual({ r: 255, g: 136, b: 0 });
  });
  it("parses without hash", () => {
    expect(parseHex("ffffff")).toEqual({ r: 255, g: 255, b: 255 });
  });
  it("returns null for invalid", () => {
    expect(parseHex("#zzz")).toBeNull();
    expect(parseHex("xyz")).toBeNull();
  });
});

describe("toHex", () => {
  it("round-trips", () => {
    expect(toHex({ r: 0, g: 128, b: 255 })).toBe("#0080ff");
  });
  it("clamps out-of-range", () => {
    expect(toHex({ r: -10, g: 300, b: 0 })).toBe("#00ff00");
  });
});

describe("relativeLuminance", () => {
  it("black is 0", () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
  });
  it("white is 1", () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
  });
});

describe("contrastRatio", () => {
  it("black vs white is 21", () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 0);
  });
  it("same color is 1", () => {
    expect(contrastRatio({ r: 100, g: 100, b: 100 }, { r: 100, g: 100, b: 100 })).toBeCloseTo(1, 3);
  });
  it("is symmetric", () => {
    const a = { r: 12, g: 34, b: 56 };
    const b = { r: 200, g: 220, b: 230 };
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 5);
  });
});

describe("evaluateContrast", () => {
  it("black on white passes everything", () => {
    const r = evaluateContrast({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    expect(r.aaNormal).toBe(true);
    expect(r.aaaNormal).toBe(true);
    expect(r.aaLarge).toBe(true);
  });
  it("gray on white fails AAA normal", () => {
    const r = evaluateContrast({ r: 180, g: 180, b: 180 }, { r: 255, g: 255, b: 255 });
    expect(r.aaaNormal).toBe(false);
    expect(r.aaNormal).toBe(false);
  });
  it("includes summary text", () => {
    const r = evaluateContrast({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    expect(r.summary).toContain("21");
    expect(r.summary).toContain("AA");
  });
});

describe("apcaContrast", () => {
  it("returns Lc 0 for identical colors", () => {
    const r = apcaContrast({ r: 128, g: 128, b: 128 }, { r: 128, g: 128, b: 128 });
    expect(r.value).toBe(0);
    expect(r.pass).toBe(false);
  });
  it("returns Best level for black on white", () => {
    const r = apcaContrast({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    expect(r.level).toBe("Best");
    expect(r.pass).toBe(true);
  });
  it("clamps within -108..106", () => {
    const r = apcaContrast({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    expect(r.value).toBeLessThanOrEqual(106);
    expect(r.value).toBeGreaterThanOrEqual(-108);
  });
});

describe("suggestColors", () => {
  it("suggests darker variants when other is lighter", () => {
    const res = suggestColors({ r: 200, g: 200, b: 200 }, { r: 255, g: 255, b: 255 }, 4.5);
    expect(res.darker.length).toBeGreaterThan(0);
  });
  it("returns suggestions that meet target", () => {
    const res = suggestColors({ r: 180, g: 180, b: 180 }, { r: 255, g: 255, b: 255 }, 3);
    for (const s of res.darker) {
      expect(s.ratio).toBeGreaterThanOrEqual(3);
    }
  });
  it("returns at most 5 suggestions", () => {
    const res = suggestColors({ r: 128, g: 128, b: 128 }, { r: 255, g: 255, b: 255 }, 4.5);
    expect(res.darker.length).toBeLessThanOrEqual(5);
    expect(res.lighter.length).toBeLessThanOrEqual(5);
  });
});

describe("isValidHex", () => {
  it("validates #fff", () => {
    expect(isValidHex("#fff")).toBe(true);
  });
  it("rejects garbage", () => {
    expect(isValidHex("nope")).toBe(false);
  });
});

describe("formatReport", () => {
  it("contains ratio and pass/fail lines", () => {
    const r = formatReport({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    expect(r).toContain("WCAG contrast");
    expect(r).toContain("AA Normal: PASS");
    expect(r).toContain("APCA");
  });
});

describe("rgbToHsl", () => {
  it("red is 0/100/50", () => {
    const h = rgbToHsl({ r: 255, g: 0, b: 0 });
    expect(h.h).toBe(0);
    expect(h.s).toBe(100);
    expect(h.l).toBe(50);
  });
  it("gray is 0/0/50", () => {
    const h = rgbToHsl({ r: 128, g: 128, b: 128 });
    expect(h.s).toBe(0);
  });
});

describe("recommendTextRole", () => {
  it("picks darker as fg", () => {
    expect(recommendTextRole({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBe("first-as-fg");
  });
  it("picks second as fg when darker", () => {
    expect(recommendTextRole({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 })).toBe("second-as-fg");
  });
});

describe("adjustLightness", () => {
  it("shifts channels", () => {
    expect(adjustLightness({ r: 100, g: 100, b: 100 }, 20)).toEqual({ r: 120, g: 120, b: 120 });
  });
});
