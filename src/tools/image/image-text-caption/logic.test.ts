import { describe, it, expect } from "vitest";
import {
  computeAnchor,
  estimateTextWidth,
  wrapText,
  computeTextBox,
  computeRenderPosition,
  parseHexColor,
  hexToRgba,
  contrastColor,
  CAPTION_PRESETS,
  computeCaptionLayout,
  validateOptions,
  totalTextHeight,
  estimateBytes,
  positionDescription,
  autoFitFontSize,
  serialize,
  deserialize,
  shadowOffset3D,
  toCssTextShadow,
  type CaptionOptions,
} from "./logic";

describe("computeAnchor", () => {
  it("computes top-left anchor", () => {
    const a = computeAnchor("top-left", 800, 600, 20);
    expect(a).toEqual({ x: 20, y: 20 });
  });
  it("computes middle-center anchor", () => {
    const a = computeAnchor("middle-center", 800, 600);
    expect(a).toEqual({ x: 400, y: 300 });
  });
  it("computes bottom-right anchor", () => {
    const a = computeAnchor("bottom-right", 800, 600, 20);
    expect(a).toEqual({ x: 780, y: 580 });
  });
});

describe("estimateTextWidth", () => {
  it("returns > 0 for any text", () => {
    expect(estimateTextWidth("Hello", 18)).toBeGreaterThan(0);
  });
  it("scales with font size", () => {
    expect(estimateTextWidth("Hello", 24)).toBeGreaterThan(estimateTextWidth("Hello", 12));
  });
  it("bold is wider than normal", () => {
    expect(estimateTextWidth("Hello", 18, "bold")).toBeGreaterThan(estimateTextWidth("Hello", 18, "normal"));
  });
});

describe("wrapText", () => {
  it("returns single line if fits", () => {
    const lines = wrapText("Hello", 1000, 18);
    expect(lines).toEqual(["Hello"]);
  });
  it("wraps long text", () => {
    const lines = wrapText("The quick brown fox jumps over the lazy dog", 100, 18);
    expect(lines.length).toBeGreaterThan(1);
  });
  it("handles single very long word", () => {
    const lines = wrapText("supercalifragilistic", 50, 18);
    expect(lines.length).toBe(1); // one word that doesn't fit, still placed on its own line
  });
});

describe("computeTextBox", () => {
  it("computes width and height", () => {
    const box = computeTextBox(["Hello", "World"], 18, 8, 1.2);
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });
  it("adds padding on both sides", () => {
    const box = computeTextBox(["Hi"], 18, 10);
    expect(box.width).toBeGreaterThanOrEqual(20);
  });
});

describe("computeRenderPosition", () => {
  it("shifts left for right-aligned", () => {
    const pos = computeRenderPosition({ x: 780, y: 580 }, "bottom-right", { width: 100, height: 50 });
    expect(pos.x).toBe(680); // 780 - 100
    expect(pos.y).toBe(530); // 580 - 50
  });
  it("centers for center alignment", () => {
    const pos = computeRenderPosition({ x: 400, y: 300 }, "middle-center", { width: 100, height: 50 });
    expect(pos.x).toBe(350);
    expect(pos.y).toBe(275);
  });
});

describe("parseHexColor", () => {
  it("parses 6-digit hex", () => {
    expect(parseHexColor("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
  });
  it("parses 3-digit hex", () => {
    expect(parseHexColor("#fff")).toEqual({ r: 255, g: 255, b: 255 });
  });
  it("returns null for invalid", () => {
    expect(parseHexColor("red")).toBeNull();
  });
});

describe("hexToRgba", () => {
  it("converts with alpha", () => {
    expect(hexToRgba("#ff0000", 0.5)).toBe("rgba(255, 0, 0, 0.5)");
  });
  it("returns input for non-hex", () => {
    expect(hexToRgba("rgba(0,0,0,1)")).toBe("rgba(0,0,0,1)");
  });
});

describe("contrastColor", () => {
  it("returns black for bright colors", () => {
    expect(contrastColor("#ffffff")).toBe("#000000");
  });
  it("returns white for dark colors", () => {
    expect(contrastColor("#000000")).toBe("#ffffff");
  });
});

describe("CAPTION_PRESETS", () => {
  it("has 10+ presets", () => {
    expect(CAPTION_PRESETS.length).toBeGreaterThanOrEqual(10);
  });
  it("each preset has a name", () => {
    for (const p of CAPTION_PRESETS) expect(p.name).toBeTruthy();
  });
});

describe("computeCaptionLayout", () => {
  it("returns full layout", () => {
    const layout = computeCaptionLayout(800, 600, {
      text: "Hello World",
      position: "bottom-center",
      fontSize: 24,
      fontFamily: "sans-serif",
      fontWeight: "normal",
      fontStyle: "normal",
      color: "#ffffff",
      align: "center",
    });
    expect(layout.lines.length).toBeGreaterThan(0);
    expect(layout.box.width).toBeGreaterThan(0);
    expect(layout.renderPos.x).toBeGreaterThan(0);
  });
});

describe("validateOptions", () => {
  it("flags empty text", () => {
    const errs = validateOptions({
      text: "", position: "top-left", fontSize: 18, fontFamily: "sans", fontWeight: "normal", fontStyle: "normal", color: "#fff", align: "left",
    });
    expect(errs).toContain("Text is required");
  });
  it("flags invalid font size", () => {
    const errs = validateOptions({
      text: "X", position: "top-left", fontSize: 0, fontFamily: "sans", fontWeight: "normal", fontStyle: "normal", color: "#fff", align: "left",
    });
    expect(errs).toContain("Font size must be > 0");
  });
  it("flags invalid color", () => {
    const errs = validateOptions({
      text: "X", position: "top-left", fontSize: 18, fontFamily: "sans", fontWeight: "normal", fontStyle: "normal", color: "not-a-color", align: "left",
    });
    expect(errs).toContain("Invalid color");
  });
  it("passes valid options", () => {
    const errs = validateOptions({
      text: "X", position: "top-left", fontSize: 18, fontFamily: "sans", fontWeight: "normal", fontStyle: "normal", color: "#fff", align: "left",
    });
    expect(errs).toHaveLength(0);
  });
});

describe("totalTextHeight", () => {
  it("sums line heights", () => {
    expect(totalTextHeight(["a", "b", "c"], 18, 1.2)).toBeCloseTo(64.8, 1);
  });
});

describe("estimateBytes", () => {
  it("estimates memory", () => {
    expect(estimateBytes(["ab", "cd"], 18)).toBeGreaterThan(0);
  });
});

describe("positionDescription", () => {
  it("describes a position", () => {
    expect(positionDescription("top-left")).toContain("top");
    expect(positionDescription("bottom-center")).toContain("bottom");
    expect(positionDescription("middle-right")).toContain("right");
  });
});

describe("autoFitFontSize", () => {
  it("reduces font size to fit", () => {
    const fs = autoFitFontSize("very long text that won't fit", 50, 32, 10);
    expect(fs).toBeLessThan(32);
  });
  it("keeps base size if already fits", () => {
    const fs = autoFitFontSize("Hi", 1000, 32, 10);
    expect(fs).toBe(32);
  });
  it("respects minimum size", () => {
    const fs = autoFitFontSize("very long text", 10, 32, 20);
    expect(fs).toBeGreaterThanOrEqual(20);
  });
});

describe("serialize / deserialize", () => {
  it("round-trips options", () => {
    const opts: CaptionOptions = {
      text: "Hi", position: "top-left", fontSize: 18, fontFamily: "sans", fontWeight: "normal", fontStyle: "normal", color: "#fff", align: "left",
    };
    const json = serialize(opts);
    const restored = deserialize(json);
    expect(restored.text).toBe("Hi");
  });
});

describe("shadowOffset3D", () => {
  it("returns x=y=depth", () => {
    expect(shadowOffset3D(5)).toEqual({ x: 5, y: 5 });
  });
});

describe("toCssTextShadow", () => {
  it("returns none when no outline/shadow", () => {
    const css = toCssTextShadow({
      text: "X", position: "top-left", fontSize: 18, fontFamily: "sans", fontWeight: "normal", fontStyle: "normal", color: "#fff", align: "left",
    });
    expect(css).toBe("none");
  });
  it("includes outline color when set", () => {
    const css = toCssTextShadow({
      text: "X", position: "top-left", fontSize: 18, fontFamily: "sans", fontWeight: "normal", fontStyle: "normal", color: "#fff", align: "left",
      outlineColor: "#000", outlineWidth: 2,
    });
    expect(css).toContain("#000");
  });
});
