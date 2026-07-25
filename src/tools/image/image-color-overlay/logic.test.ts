import { describe, it, expect } from "vitest";
import { blendChannel, blendPixel, parseHex, BLEND_MODES, type BlendMode } from "./logic";

describe("blendChannel", () => {
  it("normal mode returns the top value", () => {
    expect(blendChannel(0.2, 0.8, "normal")).toBeCloseTo(0.8, 6);
  });

  it("multiply darkens", () => {
    expect(blendChannel(0.5, 0.5, "multiply")).toBeCloseTo(0.25, 6);
  });

  it("screen lightens", () => {
    expect(blendChannel(0.5, 0.5, "screen")).toBeCloseTo(0.75, 6);
  });

  it("overlay: base < 0.5 doubles multiply", () => {
    expect(blendChannel(0.25, 0.5, "overlay")).toBeCloseTo(0.25, 6);
  });

  it("overlay: base >= 0.5 doubles screen", () => {
    expect(blendChannel(0.75, 0.5, "overlay")).toBeCloseTo(0.75, 6);
  });

  it("soft-light moves toward top", () => {
    const out = blendChannel(0.5, 0.75, "soft-light");
    expect(out).toBeGreaterThan(0.5);
    expect(out).toBeLessThan(1);
  });
});

describe("blendPixel", () => {
  it("normal at full opacity returns overlay color", () => {
    const out = blendPixel({ r: 0, g: 0, b: 0 }, { r: 200, g: 100, b: 50 }, 1, "normal");
    expect(out).toEqual({ r: 200, g: 100, b: 50 });
  });

  it("normal at zero opacity returns base", () => {
    const out = blendPixel({ r: 100, g: 100, b: 100 }, { r: 200, g: 0, b: 0 }, 0, "normal");
    expect(out).toEqual({ r: 100, g: 100, b: 100 });
  });

  it("clamps opacity above 1 and below 0", () => {
    const hi = blendPixel({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }, 2, "normal");
    const lo = blendPixel({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 }, -1, "normal");
    expect(hi).toEqual({ r: 255, g: 255, b: 255 });
    expect(lo).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe("parseHex", () => {
  it("parses 6-digit hex", () => {
    expect(parseHex("#ff8800")).toEqual({ r: 255, g: 136, b: 0 });
  });

  it("parses 3-digit hex", () => {
    expect(parseHex("#f80")).toEqual({ r: 255, g: 136, b: 0 });
  });

  it("parses without leading hash", () => {
    expect(parseHex("ffffff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("errors on invalid input", () => {
    expect("error" in parseHex("#xyz")).toBe(true);
    expect("error" in parseHex("#12")).toBe(true);
  });
});

describe("BLEND_MODES", () => {
  it("includes the five standard modes", () => {
    const values = BLEND_MODES.map((m) => m.value);
    expect(values).toContain("multiply");
    expect(values).toContain("screen");
    expect(values).toContain("overlay");
    expect(values).toContain("soft-light");
    expect(values).toContain("normal");
  });
});
