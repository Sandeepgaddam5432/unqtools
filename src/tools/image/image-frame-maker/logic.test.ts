import { describe, it, expect } from "vitest";
import {
  computeOutputSize,
  computeImagePosition,
  computeFilmHoles,
  computeGeometry,
  computeRoundedRectPath,
  FRAME_PRESETS,
  BORDER_COLORS,
  validateOptions,
  toCssShadow,
  estimateSizeImpact,
  serialize,
  deserialize,
  optionsEqual,
  framedAspectRatio,
  gradientStops,
  captionPosition,
  hexToRgba,
  totalBorderThickness,
  hasCaptionArea,
  FRAME_DESCRIPTIONS,
  frameWeight,
  type FrameOptions,
} from "./logic";

describe("computeOutputSize", () => {
  it("adds border on all sides", () => {
    const s = computeOutputSize(100, 100, { type: "classic", borderWidth: 20, borderColor: "#000" });
    expect(s.width).toBe(140);
    expect(s.height).toBe(140);
  });
  it("adds mat width", () => {
    const s = computeOutputSize(100, 100, { type: "classic", borderWidth: 10, borderColor: "#000", matWidth: 20 });
    expect(s.width).toBe(160); // 100 + 10*2 + 20*2
  });
  it("adds polaroid bottom strip", () => {
    const s = computeOutputSize(100, 100, { type: "polaroid", borderWidth: 10, borderColor: "#fff" });
    expect(s.height).toBe(180); // 10*2 + 100 + 60 (polaroid bottom)
  });
  it("adds film perforation strips", () => {
    const s = computeOutputSize(100, 100, { type: "film", borderWidth: 10, borderColor: "#000" });
    expect(s.height).toBe(150); // 10*2 + 100 + 30 = 150
  });
  it("handles zero border", () => {
    const s = computeOutputSize(100, 100, { type: "vignette", borderWidth: 0, borderColor: "rgba(0,0,0,0.5)" });
    expect(s.width).toBe(100);
  });
});

describe("computeImagePosition", () => {
  it("computes position accounting for border", () => {
    const p = computeImagePosition(100, 100, { type: "classic", borderWidth: 20, borderColor: "#000" });
    expect(p.x).toBe(20);
    expect(p.y).toBe(20);
  });
  it("accounts for mat", () => {
    const p = computeImagePosition(100, 100, { type: "classic", borderWidth: 10, borderColor: "#000", matWidth: 15 });
    expect(p.x).toBe(25);
  });
  it("adds offset for film type", () => {
    const p = computeImagePosition(100, 100, { type: "film", borderWidth: 10, borderColor: "#000" });
    expect(p.y).toBe(25); // 10 border + 15 film offset
  });
});

describe("computeFilmHoles", () => {
  it("computes top and bottom holes", () => {
    const r = computeFilmHoles(300, 100, 6);
    expect(r.top.length).toBe(6);
    expect(r.bottom.length).toBe(6);
  });
  it("distributes holes across the width", () => {
    const r = computeFilmHoles(300, 100, 4);
    // First hole at margin=8, last hole should be near the end
    expect(r.top[0].x).toBe(8);
    expect(r.top[3].x).toBeLessThan(300);
  });
});

describe("computeGeometry", () => {
  it("returns full geometry", () => {
    const g = computeGeometry(100, 100, { type: "classic", borderWidth: 20, borderColor: "#000" });
    expect(g.outputWidth).toBe(140);
    expect(g.imageX).toBe(20);
  });
  it("includes mat dimensions when matWidth is set", () => {
    const g = computeGeometry(100, 100, { type: "classic", borderWidth: 10, borderColor: "#000", matWidth: 20 });
    expect(g.matWidth).toBe(140); // 100 + 20*2
    expect(g.matHeight).toBe(140);
  });
  it("includes holes for film type", () => {
    const g = computeGeometry(100, 100, { type: "film", borderWidth: 10, borderColor: "#000", filmHoleCount: 6 });
    expect(g.holes?.length).toBe(12); // 6 top + 6 bottom
  });
});

describe("computeRoundedRectPath", () => {
  it("returns 8 corner points", () => {
    const pts = computeRoundedRectPath(0, 0, 100, 100, 20);
    expect(pts.length).toBe(8);
  });
  it("clamps radius to half the smallest dimension", () => {
    const pts = computeRoundedRectPath(0, 0, 20, 20, 100);
    expect(pts[0].x).toBeLessThan(20); // r is clamped
  });
});

describe("FRAME_PRESETS", () => {
  it("has at least 10 presets", () => {
    expect(FRAME_PRESETS.length).toBeGreaterThanOrEqual(10);
  });
  it("each preset has a name and options", () => {
    for (const p of FRAME_PRESETS) {
      expect(p.name).toBeTruthy();
      expect(p.options.type).toBeTruthy();
    }
  });
});

describe("BORDER_COLORS", () => {
  it("has at least 10 color options", () => {
    expect(BORDER_COLORS.length).toBeGreaterThanOrEqual(10);
  });
});

describe("validateOptions", () => {
  it("flags negative border width", () => {
    expect(validateOptions({ type: "classic", borderWidth: -5, borderColor: "#000" })).toContain("Border width cannot be negative");
  });
  it("flags negative mat width", () => {
    expect(validateOptions({ type: "classic", borderWidth: 10, borderColor: "#000", matWidth: -5 })).toContain("Mat width cannot be negative");
  });
  it("flags invalid color", () => {
    expect(validateOptions({ type: "classic", borderWidth: 10, borderColor: "red" })).toContain("Border color must be a valid hex or rgba");
  });
  it("passes valid options", () => {
    expect(validateOptions({ type: "classic", borderWidth: 10, borderColor: "#000000" })).toHaveLength(0);
  });
  it("accepts rgba color", () => {
    expect(validateOptions({ type: "vignette", borderWidth: 0, borderColor: "rgba(0,0,0,0.5)" })).toHaveLength(0);
  });
});

describe("toCssShadow", () => {
  it("returns none for non-shadow type", () => {
    expect(toCssShadow({ type: "classic", borderWidth: 10, borderColor: "#000" })).toBe("none");
  });
  it("returns CSS shadow for shadow type", () => {
    const css = toCssShadow({ type: "shadow", borderWidth: 10, borderColor: "#fff", shadowBlur: 30 });
    expect(css).toContain("30px");
    expect(css).toContain("rgba");
  });
  it("uses custom offsets", () => {
    const css = toCssShadow({ type: "shadow", borderWidth: 10, borderColor: "#fff", shadowOffsetX: 8, shadowOffsetY: 8 });
    expect(css).toContain("8px 8px");
  });
});

describe("estimateSizeImpact", () => {
  it("estimates output size in bytes", () => {
    const s = estimateSizeImpact(100, 100, { type: "classic", borderWidth: 10, borderColor: "#000" });
    expect(s).toBe(120 * 120 * 4); // (100+20) × (100+20) × 4
  });
});

describe("serialize / deserialize", () => {
  it("round-trips options", () => {
    const opts: FrameOptions = { type: "classic", borderWidth: 10, borderColor: "#000" };
    const json = serialize(opts);
    const restored = deserialize(json);
    expect(restored.type).toBe("classic");
    expect(restored.borderWidth).toBe(10);
  });
});

describe("optionsEqual", () => {
  it("returns true for identical options", () => {
    const a: FrameOptions = { type: "classic", borderWidth: 10, borderColor: "#000" };
    const b: FrameOptions = { type: "classic", borderWidth: 10, borderColor: "#000" };
    expect(optionsEqual(a, b)).toBe(true);
  });
  it("returns false for different options", () => {
    const a: FrameOptions = { type: "classic", borderWidth: 10, borderColor: "#000" };
    const b: FrameOptions = { type: "classic", borderWidth: 20, borderColor: "#000" };
    expect(optionsEqual(a, b)).toBe(false);
  });
});

describe("framedAspectRatio", () => {
  it("computes aspect ratio", () => {
    const r = framedAspectRatio(100, 100, { type: "classic", borderWidth: 10, borderColor: "#000" });
    expect(r).toBe(1); // 120x120 = 1:1
  });
});

describe("gradientStops", () => {
  it("returns 2 stops", () => {
    const stops = gradientStops({ type: "gradient", borderWidth: 10, borderColor: "#000", gradientFrom: "#ff0000", gradientTo: "#0000ff" });
    expect(stops.length).toBe(2);
    expect(stops[0].color).toBe("#ff0000");
    expect(stops[1].color).toBe("#0000ff");
  });
  it("uses defaults when colors not set", () => {
    const stops = gradientStops({ type: "gradient", borderWidth: 10, borderColor: "#000" });
    expect(stops[0].color).toBeTruthy();
  });
});

describe("captionPosition", () => {
  it("computes centered caption position", () => {
    const pos = captionPosition(100, 100, { type: "polaroid", borderWidth: 10, borderColor: "#fff" });
    expect(pos.x).toBe(60); // 120 / 2
    expect(pos.maxWidth).toBe(80); // 120 - 40
  });
});

describe("hexToRgba", () => {
  it("converts 6-digit hex", () => {
    expect(hexToRgba("#ff0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
  });
  it("handles hex without #", () => {
    expect(hexToRgba("00ff00")).toBe("rgba(0, 255, 0, 1)");
  });
  it("returns input as-is for non-hex", () => {
    expect(hexToRgba("rgba(0,0,0,0.5)")).toBe("rgba(0,0,0,0.5)");
  });
});

describe("totalBorderThickness", () => {
  it("sums border + mat", () => {
    expect(totalBorderThickness({ type: "classic", borderWidth: 10, borderColor: "#000", matWidth: 20 })).toBe(30);
  });
  it("returns just border when no mat", () => {
    expect(totalBorderThickness({ type: "classic", borderWidth: 10, borderColor: "#000" })).toBe(10);
  });
});

describe("hasCaptionArea", () => {
  it("returns true for polaroid", () => {
    expect(hasCaptionArea("polaroid")).toBe(true);
  });
  it("returns false for other types", () => {
    expect(hasCaptionArea("classic")).toBe(false);
    expect(hasCaptionArea("film")).toBe(false);
  });
});

describe("FRAME_DESCRIPTIONS", () => {
  it("has descriptions for all types", () => {
    const types = ["classic", "polaroid", "film", "rounded", "vignette", "shadow", "gradient", "double"];
    for (const t of types) {
      expect(FRAME_DESCRIPTIONS[t as keyof typeof FRAME_DESCRIPTIONS]).toBeTruthy();
    }
  });
});

describe("frameWeight", () => {
  it("returns a value 1-10", () => {
    const w = frameWeight({ type: "classic", borderWidth: 20, borderColor: "#000" });
    expect(w).toBeGreaterThanOrEqual(1);
    expect(w).toBeLessThanOrEqual(10);
  });
  it("increases with border width", () => {
    const small = frameWeight({ type: "classic", borderWidth: 5, borderColor: "#000" });
    const large = frameWeight({ type: "classic", borderWidth: 50, borderColor: "#000" });
    expect(large).toBeGreaterThanOrEqual(small);
  });
  it("caps at 10", () => {
    const w = frameWeight({ type: "classic", borderWidth: 1000, borderColor: "#000", matWidth: 200 });
    expect(w).toBeLessThanOrEqual(10);
  });
});
