import { describe, it, expect } from "vitest";
import { calculateFlip, parseFlipType } from "./logic";

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

  it("errors on non-positive width", () => {
    expect(calculateFlip(0, 50, "horizontal")).toHaveProperty("error");
  });

  it("errors on non-positive height", () => {
    expect(calculateFlip(100, 0, "horizontal")).toHaveProperty("error");
  });
});

describe("parseFlipType", () => {
  it("accepts canonical names", () => {
    expect(parseFlipType("horizontal")).toBe("horizontal");
    expect(parseFlipType("vertical")).toBe("vertical");
    expect(parseFlipType("both")).toBe("both");
  });

  it("accepts short aliases", () => {
    expect(parseFlipType("h")).toBe("horizontal");
    expect(parseFlipType("v")).toBe("vertical");
    expect(parseFlipType("x")).toBe("horizontal");
    expect(parseFlipType("y")).toBe("vertical");
    expect(parseFlipType("hv")).toBe("both");
  });

  it("is case-insensitive and trims", () => {
    expect(parseFlipType("  HORIZONTAL  ")).toBe("horizontal");
  });

  it("errors on unknown", () => {
    expect(parseFlipType("diagonal")).toHaveProperty("error");
  });
});
