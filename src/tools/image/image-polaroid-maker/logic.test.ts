import { describe, it, expect } from "vitest";
import {
  hexToRgb,
  aspectFromPreset,
  computeImageArea,
  computeCaptionArea,
  autoFontSize,
  polaroidCssFilter,
  validateInput,
  generatePolaroid,
  batchGeneratePolaroid,
  statsToCsv,
  PRESETS,
  type PolaroidInput,
} from "./logic";

const BASE: PolaroidInput = {
  width: 600, height: 700,
  border: { top: 20, right: 20, bottom: 80, left: 20 },
  caption: "Hello World", captionPosition: "bottom", captionFontSize: 18,
  captionColor: "#333333", frameColor: "#ffffff",
  rotation: 0, vintage: 0, sepia: 0, vignette: 0, grain: 0, aspect: "square",
};

describe("hexToRgb", () => {
  it("parses #RRGGBB", () => {
    expect(hexToRgb("#FF8800")).toEqual({ r: 255, g: 136, b: 0 });
  });
  it("parses without #", () => {
    expect(hexToRgb("00FF00")).toEqual({ r: 0, g: 255, b: 0 });
  });
  it("errors on invalid", () => {
    expect(hexToRgb("xyz")).toHaveProperty("error");
  });
});

describe("aspectFromPreset", () => {
  it("returns 1 for square", () => {
    expect(aspectFromPreset("square")).toBe(1);
  });
  it("returns 4/3 for wide", () => {
    expect(aspectFromPreset("wide")).toBeCloseTo(4 / 3, 5);
  });
  it("returns 1.25 for classic", () => {
    expect(aspectFromPreset("classic")).toBeCloseTo(1.25, 5);
  });
});

describe("computeImageArea", () => {
  it("fits image within borders", () => {
    const a = computeImageArea(600, 700, { top: 20, right: 20, bottom: 80, left: 20 }, "square");
    expect(a.width).toBeGreaterThan(0);
    expect(a.height).toBeGreaterThan(0);
    expect(a.x).toBeGreaterThanOrEqual(20);
    expect(a.y).toBeGreaterThanOrEqual(20);
    expect(a.x + a.width).toBeLessThanOrEqual(580);
    expect(a.y + a.height).toBeLessThanOrEqual(620);
  });
  it("preserves aspect ratio (square)", () => {
    const a = computeImageArea(600, 700, { top: 20, right: 20, bottom: 80, left: 20 }, "square");
    expect(a.width).toBeCloseTo(a.height, 0);
  });
});

describe("computeCaptionArea", () => {
  it("places caption at bottom", () => {
    const a = computeCaptionArea(600, 700, { top: 20, right: 20, bottom: 80, left: 20 }, "bottom");
    expect(a.y).toBeGreaterThan(600);
    expect(a.height).toBeLessThanOrEqual(80);
  });
  it("places caption at top", () => {
    const a = computeCaptionArea(600, 700, { top: 20, right: 20, bottom: 80, left: 20 }, "top");
    expect(a.y).toBeLessThan(20);
  });
  it("places caption in center", () => {
    const a = computeCaptionArea(600, 700, { top: 20, right: 20, bottom: 80, left: 20 }, "center");
    expect(a.y).toBeGreaterThan(100);
    expect(a.y).toBeLessThan(500);
  });
});

describe("autoFontSize", () => {
  it("returns base size if text fits", () => {
    expect(autoFontSize("Hi", 1000, 18)).toBe(18);
  });
  it("shrinks when text is too long", () => {
    const size = autoFontSize("Very long caption that does not fit", 100, 18);
    expect(size).toBeLessThan(18);
  });
  it("returns at least 8", () => {
    const size = autoFontSize("Very long caption", 10, 18);
    expect(size).toBeGreaterThanOrEqual(8);
  });
  it("returns base size for empty text", () => {
    expect(autoFontSize("", 100, 18)).toBe(18);
  });
});

describe("polaroidCssFilter", () => {
  it("returns identity filter when vintage is 0", () => {
    const f = polaroidCssFilter(BASE);
    expect(f).toContain("sepia(0%)");
  });
  it("includes sepia when vintage > 0", () => {
    const f = polaroidCssFilter({ ...BASE, vintage: 0.5, sepia: 1 });
    expect(f).toContain("sepia(50%)");
  });
});

describe("validateInput", () => {
  it("accepts valid input", () => {
    expect(validateInput(BASE)).toEqual({ ok: true });
  });
  it("rejects non-positive dimensions", () => {
    expect(validateInput({ ...BASE, width: 0 })).toHaveProperty("error");
  });
  it("rejects negative borders", () => {
    expect(validateInput({ ...BASE, border: { top: -1, right: 0, bottom: 0, left: 0 } })).toHaveProperty("error");
  });
  it("rejects borders exceeding dimensions", () => {
    expect(validateInput({ ...BASE, width: 50, border: { top: 20, right: 20, bottom: 20, left: 20 } })).toHaveProperty("error");
  });
  it("rejects bad rotation", () => {
    expect(validateInput({ ...BASE, rotation: 90 })).toHaveProperty("error");
  });
  it("rejects bad vintage", () => {
    expect(validateInput({ ...BASE, vintage: 2 })).toHaveProperty("error");
  });
  it("rejects unknown aspect", () => {
    expect(validateInput({ ...BASE, aspect: "bogus" as never })).toHaveProperty("error");
  });
});

describe("generatePolaroid", () => {
  it("returns result with image and caption areas", () => {
    const r = generatePolaroid(BASE);
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.imageArea.width).toBeGreaterThan(0);
    expect(r.captionArea.width).toBeGreaterThan(0);
    expect(r.captionFontSize).toBeGreaterThan(0);
    expect(r.stats.aspectRatio).toBeCloseTo(600 / 700, 3);
  });
  it("errors on bad input", () => {
    expect("error" in generatePolaroid({ ...BASE, width: 0 })).toBe(true);
  });
  it("warns on narrow bottom border with caption", () => {
    const r = generatePolaroid({ ...BASE, caption: "hello", border: { top: 20, right: 20, bottom: 30, left: 20 } });
    if ("error" in r) throw new Error("unexpected");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("warns when rotation is set", () => {
    const r = generatePolaroid({ ...BASE, rotation: 5 });
    if ("error" in r) throw new Error("unexpected");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("uses provided caption font size when > 0", () => {
    const r = generatePolaroid({ ...BASE, captionFontSize: 24 });
    if ("error" in r) throw new Error("unexpected");
    expect(r.captionFontSize).toBe(24);
  });
  it("auto-sizes caption font when 0", () => {
    const r = generatePolaroid({ ...BASE, caption: "very long caption text here", captionFontSize: 0 });
    if ("error" in r) throw new Error("unexpected");
    expect(r.captionFontSize).toBeGreaterThan(0);
  });
});

describe("batchGeneratePolaroid", () => {
  it("runs over multiple inputs", () => {
    const r = batchGeneratePolaroid([BASE, BASE]);
    expect(r.length).toBe(2);
  });
});

describe("statsToCsv", () => {
  it("produces CSV with header", () => {
    const r = generatePolaroid(BASE);
    if ("error" in r) throw new Error("unexpected");
    const csv = statsToCsv(r.stats);
    expect(csv.startsWith("Field,Value")).toBe(true);
    expect(csv).toContain("AspectRatio");
  });
});

describe("PRESETS", () => {
  it("has 4 presets", () => {
    expect(PRESETS.length).toBe(4);
  });
  it("includes Classic and Vintage", () => {
    expect(PRESETS.some((p) => p.name === "Classic")).toBe(true);
    expect(PRESETS.some((p) => p.name === "Vintage")).toBe(true);
  });
});
