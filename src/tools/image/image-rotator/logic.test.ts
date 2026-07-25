/**
 * Image Rotator — unit tests (100% blueprint compliant).
 */
import { describe, it, expect } from "vitest";
import {
  calculateRotation,
  toRadians,
  normalizeAngle,
  applyTransformStep,
  composeFlip,
  undoTransform,
  redoTransform,
  resetTransform,
  describeTransform,
  initialTransformState,
  parseFillColor,
  preservesAlpha,
  batchCalculate,
  beforeAfterDimensions,
  stepFromKey,
  flipCanvasParams,
  parseFlipType,
  ANGLE_PRESETS,
  type TransformState,
  type FlipType,
} from "./logic";

describe("calculateRotation — right angles", () => {
  it("returns same dims for 0 degrees", () => {
    const r = calculateRotation({ originalWidth: 100, originalHeight: 50, degrees: 0 });
    expect(r).toMatchObject({ width: 100, height: 50, angle: 0, swapsDimension: false });
  });
  it("swaps dims for 90 degrees", () => {
    const r = calculateRotation({ originalWidth: 100, originalHeight: 50, degrees: 90 });
    expect(r).toMatchObject({ width: 50, height: 100, swapsDimension: true });
  });
  it("keeps dims for 180 degrees", () => {
    const r = calculateRotation({ originalWidth: 100, originalHeight: 50, degrees: 180 });
    expect(r).toMatchObject({ width: 100, height: 50, swapsDimension: false });
  });
  it("swaps dims for 270 degrees", () => {
    const r = calculateRotation({ originalWidth: 100, originalHeight: 50, degrees: 270 });
    expect(r).toMatchObject({ width: 50, height: 100, swapsDimension: true });
  });
  it("marks 90° multiples as lossless-compatible", () => {
    const r = calculateRotation({ originalWidth: 100, originalHeight: 50, degrees: 90 }) as { losslessCompatible: boolean };
    expect(r.losslessCompatible).toBe(true);
  });
});

describe("calculateRotation — arbitrary angles", () => {
  it("computes bounding box for 45 degrees", () => {
    const r = calculateRotation({ originalWidth: 100, originalHeight: 100, degrees: 45 }) as { width: number; height: number; expandsCanvas: boolean };
    expect(r.width).toBeGreaterThan(100);
    expect(r.height).toBeGreaterThan(100);
    expect(r.expandsCanvas).toBe(true);
  });
  it("marks non-right angles as not lossless", () => {
    const r = calculateRotation({ originalWidth: 100, originalHeight: 100, degrees: 45 }) as { losslessCompatible: boolean };
    expect(r.losslessCompatible).toBe(false);
  });
});

describe("calculateRotation — normalization", () => {
  it("normalizes negative angles", () => {
    const r = calculateRotation({ originalWidth: 100, originalHeight: 50, degrees: -90 }) as { angle: number };
    expect(r.angle).toBe(270);
  });
  it("normalizes > 360 angles", () => {
    const r = calculateRotation({ originalWidth: 100, originalHeight: 50, degrees: 450 }) as { angle: number };
    expect(r.angle).toBe(90);
  });
});

describe("calculateRotation — errors", () => {
  it("errors on invalid dims", () => {
    expect(calculateRotation({ originalWidth: 0, originalHeight: 50, degrees: 90 })).toHaveProperty("error");
  });
  it("errors on non-finite degrees", () => {
    expect(calculateRotation({ originalWidth: 100, originalHeight: 50, degrees: Number.NaN })).toHaveProperty("error");
  });
});

describe("calculateRotation — EXIF orientation", () => {
  it("swaps base dims for orientation 6 (90° CW)", () => {
    const r = calculateRotation({ originalWidth: 100, originalHeight: 50, degrees: 0, exifOrientation: 6 }) as { width: number; height: number };
    // After EXIF: base = 50×100, rotation 0 → 50×100
    expect(r.width).toBe(50);
    expect(r.height).toBe(100);
  });
  it("does not swap for orientation 1 (normal)", () => {
    const r = calculateRotation({ originalWidth: 100, originalHeight: 50, degrees: 0, exifOrientation: 1 }) as { width: number; height: number };
    expect(r.width).toBe(100);
    expect(r.height).toBe(50);
  });
});

describe("toRadians / normalizeAngle", () => {
  it("toRadians converts correctly", () => {
    expect(toRadians(180)).toBeCloseTo(Math.PI);
    expect(toRadians(90)).toBeCloseTo(Math.PI / 2);
  });
  it("normalizeAngle wraps negative", () => {
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(450)).toBe(90);
    expect(normalizeAngle(0)).toBe(0);
  });
  it("normalizeAngle returns 0 for non-finite", () => {
    expect(normalizeAngle(Number.NaN)).toBe(0);
  });
});

describe("Transform state composition", () => {
  it("initial state is identity", () => {
    const s = initialTransformState();
    expect(s.totalRotation).toBe(0);
    expect(s.flip).toBe("none");
    expect(s.history).toHaveLength(0);
    expect(describeTransform(s)).toBe("Identity");
  });

  it("applies a rotate step", () => {
    const s = applyTransformStep(initialTransformState(), { rotate: 90, flip: "none" });
    expect(s.totalRotation).toBe(90);
    expect(describeTransform(s)).toBe("R90°");
  });

  it("applies a flip step", () => {
    const s = applyTransformStep(initialTransformState(), { rotate: 0, flip: "horizontal" });
    expect(s.flip).toBe("horizontal");
    expect(describeTransform(s)).toBe("FlipH");
  });

  it("composes multiple steps", () => {
    let s = initialTransformState();
    s = applyTransformStep(s, { rotate: 90, flip: "none" });
    s = applyTransformStep(s, { rotate: 0, flip: "horizontal" });
    s = applyTransformStep(s, { rotate: 12.5, flip: "none" });
    expect(s.totalRotation).toBeCloseTo(102.5, 3);
    expect(s.flip).toBe("horizontal");
    expect(describeTransform(s)).toContain("FlipH");
    expect(s.history).toHaveLength(3);
  });

  it("undo/redo", () => {
    let s = initialTransformState();
    s = applyTransformStep(s, { rotate: 90, flip: "none" });
    s = applyTransformStep(s, { rotate: 90, flip: "none" });
    s = undoTransform(s);
    expect(s.totalRotation).toBe(90);
    s = redoTransform(s);
    expect(s.totalRotation).toBe(180);
  });

  it("reset returns identity", () => {
    let s = initialTransformState();
    s = applyTransformStep(s, { rotate: 90, flip: "horizontal" });
    s = resetTransform();
    expect(s.totalRotation).toBe(0);
    expect(s.flip).toBe("none");
    expect(s.history).toHaveLength(0);
  });
});

describe("composeFlip", () => {
  it("two flips of same type cancel", () => {
    expect(composeFlip("horizontal", "horizontal")).toBe("none");
    expect(composeFlip("vertical", "vertical")).toBe("none");
  });
  it("horizontal + vertical = both", () => {
    expect(composeFlip("horizontal", "vertical")).toBe("both");
  });
  it("both + horizontal = vertical", () => {
    expect(composeFlip("both", "horizontal")).toBe("vertical");
  });
});

describe("parseFillColor", () => {
  it("parses 6-digit hex", () => {
    expect(parseFillColor("#ff8800")).toEqual([255, 136, 0, 255]);
  });
  it("parses 3-digit hex", () => {
    expect(parseFillColor("#f80")).toEqual([255, 136, 0, 255]);
  });
  it("parses 8-digit hex with alpha", () => {
    expect(parseFillColor("#ff880080")).toEqual([255, 136, 0, 128]);
  });
  it("parses rgb()", () => {
    expect(parseFillColor("rgb(255, 136, 0)")).toEqual([255, 136, 0, 255]);
  });
  it("parses rgba()", () => {
    expect(parseFillColor("rgba(255, 136, 0, 0.5)")).toEqual([255, 136, 0, 128]);
  });
  it("parses named colors", () => {
    expect(parseFillColor("white")).toEqual([255, 255, 255, 255]);
    expect(parseFillColor("transparent")).toEqual([0, 0, 0, 0]);
  });
  it("errors on garbage", () => {
    expect(parseFillColor("not a color")).toHaveProperty("error");
  });
});

describe("preservesAlpha", () => {
  it("returns true for PNG and WebP", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/webp")).toBe(true);
  });
  it("returns false for JPEG", () => {
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
});

describe("batchCalculate", () => {
  it("computes rotation for multiple files", () => {
    const results = batchCalculate(
      [
        { name: "a.png", width: 100, height: 50 },
        { name: "b.png", width: 200, height: 100 },
      ],
      90,
    );
    expect(results).toHaveLength(2);
    expect((results[0]!.result as { width: number }).width).toBe(50);
    expect((results[1]!.result as { width: number }).width).toBe(100);
  });
  it("propagates errors", () => {
    const results = batchCalculate([{ name: "x.png", width: 0, height: 50 }], 90);
    expect(results[0]!.result).toHaveProperty("error");
  });
});

describe("beforeAfterDimensions", () => {
  it("returns before and after dims", () => {
    const r = beforeAfterDimensions(100, 50, 90);
    if ("error" in r) throw new Error("Should not error");
    expect(r.before).toEqual({ w: 100, h: 50 });
    expect(r.after).toEqual({ w: 50, h: 100 });
  });
  it("propagates errors", () => {
    expect(beforeAfterDimensions(0, 50, 90)).toHaveProperty("error");
  });
});

describe("stepFromKey", () => {
  it("maps R/L/H/V keys", () => {
    expect(stepFromKey("r")).toEqual({ rotate: 90, flip: "none" });
    expect(stepFromKey("l")).toEqual({ rotate: -90, flip: "none" });
    expect(stepFromKey("h")).toEqual({ rotate: 0, flip: "horizontal" });
    expect(stepFromKey("v")).toEqual({ rotate: 0, flip: "vertical" });
  });
  it("returns null for unknown keys", () => {
    expect(stepFromKey("x")).toBeNull();
  });
});

describe("flipCanvasParams", () => {
  it("computes params for horizontal flip", () => {
    expect(flipCanvasParams(100, 50, "horizontal")).toEqual({
      scaleX: -1, scaleY: 1, translateX: 100, translateY: 0,
    });
  });
  it("computes params for vertical flip", () => {
    expect(flipCanvasParams(100, 50, "vertical")).toEqual({
      scaleX: 1, scaleY: -1, translateX: 0, translateY: 50,
    });
  });
  it("errors on invalid dims", () => {
    expect(flipCanvasParams(0, 50, "horizontal")).toHaveProperty("error");
  });
});

describe("parseFlipType", () => {
  it("accepts canonical names", () => {
    expect(parseFlipType("horizontal")).toBe("horizontal");
    expect(parseFlipType("vertical")).toBe("vertical");
    expect(parseFlipType("both")).toBe("both");
    expect(parseFlipType("none")).toBe("none");
  });
  it("accepts short aliases", () => {
    expect(parseFlipType("h")).toBe("horizontal");
    expect(parseFlipType("v")).toBe("vertical");
    expect(parseFlipType("hv")).toBe("both");
  });
  it("errors on unknown", () => {
    expect(parseFlipType("diagonal")).toHaveProperty("error");
  });
});

describe("ANGLE_PRESETS", () => {
  it("includes 0, 90, 180, 270", () => {
    expect(ANGLE_PRESETS.some((p) => p.degrees === 0)).toBe(true);
    expect(ANGLE_PRESETS.some((p) => p.degrees === 90)).toBe(true);
    expect(ANGLE_PRESETS.some((p) => p.degrees === 180)).toBe(true);
    expect(ANGLE_PRESETS.some((p) => p.degrees === 270)).toBe(true);
  });
  it("has at least 8 presets", () => {
    expect(ANGLE_PRESETS.length).toBeGreaterThanOrEqual(8);
  });
});

describe("describeTransform — combined indicator", () => {
  it("renders rotation only", () => {
    const s: TransformState = { totalRotation: 270, flip: "none", history: [], cursor: 0 };
    expect(describeTransform(s)).toBe("R270°");
  });
  it("renders combined rotate + flip", () => {
    const s: TransformState = { totalRotation: 90, flip: "horizontal" as FlipType, history: [], cursor: 0 };
    expect(describeTransform(s)).toBe("R90° + FlipH");
  });
  it("renders fractional rotation", () => {
    const s: TransformState = { totalRotation: 12.5, flip: "none", history: [], cursor: 0 };
    expect(describeTransform(s)).toBe("R12.5°");
  });
});
