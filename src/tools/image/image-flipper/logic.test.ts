/**
 * Image Flipper — unit tests (100% blueprint compliant).
 */
import { describe, it, expect } from "vitest";
import {
  calculateFlip,
  composeFlip,
  applyFlipStep,
  undoFlip,
  redoFlip,
  resetFlip,
  initialFlipState,
  describeFlip,
  flipStepFromKey,
  parseFlipType,
  preservesAlpha,
  beforeAfterFlipDimensions,
  batchFlip,
  flipSuffix,
  type FlipType,
} from "./logic";

describe("calculateFlip", () => {
  it("flips horizontal only", () => {
    expect(calculateFlip(100, 50, "horizontal")).toEqual({ scaleX: -1, scaleY: 1, translateX: 100, translateY: 0 });
  });
  it("flips vertical only", () => {
    expect(calculateFlip(100, 50, "vertical")).toEqual({ scaleX: 1, scaleY: -1, translateX: 0, translateY: 50 });
  });
  it("flips both axes", () => {
    expect(calculateFlip(100, 50, "both")).toEqual({ scaleX: -1, scaleY: -1, translateX: 100, translateY: 50 });
  });
  it("returns identity for none", () => {
    expect(calculateFlip(100, 50, "none")).toEqual({ scaleX: 1, scaleY: 1, translateX: 0, translateY: 0 });
  });
  it("errors on non-positive width", () => {
    expect(calculateFlip(0, 50, "horizontal")).toHaveProperty("error");
  });
  it("errors on non-positive height", () => {
    expect(calculateFlip(100, 0, "horizontal")).toHaveProperty("error");
  });
});

describe("composeFlip (XOR semantics)", () => {
  it("same flip twice cancels", () => {
    expect(composeFlip("horizontal", "horizontal")).toBe("none");
    expect(composeFlip("vertical", "vertical")).toBe("none");
    expect(composeFlip("both", "both")).toBe("none");
  });
  it("horizontal + vertical = both", () => {
    expect(composeFlip("horizontal", "vertical")).toBe("both");
    expect(composeFlip("vertical", "horizontal")).toBe("both");
  });
  it("both + horizontal = vertical", () => {
    expect(composeFlip("both", "horizontal")).toBe("vertical");
    expect(composeFlip("horizontal", "both")).toBe("vertical");
  });
  it("both + vertical = horizontal", () => {
    expect(composeFlip("both", "vertical")).toBe("horizontal");
    expect(composeFlip("vertical", "both")).toBe("horizontal");
  });
  it("none is identity", () => {
    expect(composeFlip("none", "horizontal")).toBe("horizontal");
    expect(composeFlip("horizontal", "none")).toBe("horizontal");
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
    expect(parseFlipType("x")).toBe("horizontal");
    expect(parseFlipType("y")).toBe("vertical");
    expect(parseFlipType("hv")).toBe("both");
    expect(parseFlipType("b")).toBe("both");
    expect(parseFlipType("n")).toBe("none");
  });
  it("is case-insensitive and trims", () => {
    expect(parseFlipType("  HORIZONTAL  ")).toBe("horizontal");
  });
  it("errors on unknown", () => {
    expect(parseFlipType("diagonal")).toHaveProperty("error");
  });
});

describe("Flip state", () => {
  it("initial state is identity", () => {
    const s = initialFlipState();
    expect(s.flip).toBe("none");
    expect(s.history).toHaveLength(0);
    expect(describeFlip(s)).toBe("Identity");
  });
  it("applies a flip step", () => {
    const s = applyFlipStep(initialFlipState(), { flip: "horizontal" });
    expect(s.flip).toBe("horizontal");
    expect(describeFlip(s)).toBe("FlipH ↔");
  });
  it("composes multiple flips", () => {
    let s = initialFlipState();
    s = applyFlipStep(s, { flip: "horizontal" });
    s = applyFlipStep(s, { flip: "horizontal" });
    expect(s.flip).toBe("none");
  });
  it("undo/redo", () => {
    let s = initialFlipState();
    s = applyFlipStep(s, { flip: "horizontal" });
    s = applyFlipStep(s, { flip: "vertical" });
    s = undoFlip(s);
    expect(s.flip).toBe("horizontal");
    s = redoFlip(s);
    expect(s.flip).toBe("both");
  });
  it("reset returns identity", () => {
    let s = initialFlipState();
    s = applyFlipStep(s, { flip: "horizontal" });
    s = resetFlip();
    expect(s.flip).toBe("none");
    expect(s.history).toHaveLength(0);
  });
  it("describeFlip renders all states", () => {
    expect(describeFlip({ flip: "horizontal" as FlipType, history: [], cursor: 0 })).toBe("FlipH ↔");
    expect(describeFlip({ flip: "vertical" as FlipType, history: [], cursor: 0 })).toBe("FlipV ↕");
    expect(describeFlip({ flip: "both" as FlipType, history: [], cursor: 0 })).toBe("FlipHV ↔↕");
  });
});

describe("flipStepFromKey", () => {
  it("maps H/V/B keys", () => {
    expect(flipStepFromKey("h")).toEqual({ flip: "horizontal" });
    expect(flipStepFromKey("v")).toEqual({ flip: "vertical" });
    expect(flipStepFromKey("b")).toEqual({ flip: "both" });
  });
  it("returns null for unknown keys", () => {
    expect(flipStepFromKey("x")).toBeNull();
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

describe("beforeAfterFlipDimensions", () => {
  it("returns identical before/after (pure flip preserves dims)", () => {
    const r = beforeAfterFlipDimensions(100, 50);
    if ("error" in r) throw new Error("Should not error");
    expect(r.before).toEqual({ w: 100, h: 50 });
    expect(r.after).toEqual({ w: 100, h: 50 });
  });
  it("errors on invalid dims", () => {
    expect(beforeAfterFlipDimensions(0, 50)).toHaveProperty("error");
  });
});

describe("batchFlip", () => {
  it("computes params for multiple files", () => {
    const results = batchFlip(
      [
        { name: "a.png", width: 100, height: 50 },
        { name: "b.png", width: 200, height: 100 },
      ],
      "horizontal",
    );
    expect(results).toHaveLength(2);
    expect((results[0]!.result as { translateX: number }).translateX).toBe(100);
    expect((results[1]!.result as { translateX: number }).translateX).toBe(200);
  });
  it("propagates errors", () => {
    const results = batchFlip([{ name: "x.png", width: 0, height: 50 }], "horizontal");
    expect(results[0]!.result).toHaveProperty("error");
  });
});

describe("flipSuffix", () => {
  it("returns suffix for each flip type", () => {
    expect(flipSuffix("horizontal")).toBe("-fliph");
    expect(flipSuffix("vertical")).toBe("-flipv");
    expect(flipSuffix("both")).toBe("-fliphv");
    expect(flipSuffix("none")).toBe("");
  });
});
