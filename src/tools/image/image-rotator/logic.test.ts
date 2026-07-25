import { describe, it, expect } from "vitest";
import { calculateRotation, toRadians } from "./logic";

describe("calculateRotation", () => {
  it("returns same dims for 0 degrees", () => {
    const r = calculateRotation({ originalWidth: 100, originalHeight: 50, degrees: 0 });
    expect(r).toEqual({ width: 100, height: 50, angle: 0, swapsDimensions: false });
  });

  it("swaps dims for 90 degrees", () => {
    const r = calculateRotation({ originalWidth: 100, originalHeight: 50, degrees: 90 });
    expect(r).toEqual({ width: 50, height: 100, angle: 90, swapsDimensions: true });
  });

  it("keeps dims for 180 degrees", () => {
    const r = calculateRotation({ originalWidth: 100, originalHeight: 50, degrees: 180 });
    expect(r).toEqual({ width: 100, height: 50, angle: 180, swapsDimensions: false });
  });

  it("swaps dims for 270 degrees", () => {
    const r = calculateRotation({ originalWidth: 100, originalHeight: 50, degrees: 270 });
    expect(r).toEqual({ width: 50, height: 100, angle: 270, swapsDimensions: true });
  });

  it("normalizes negative angles", () => {
    const r = calculateRotation({ originalWidth: 100, originalHeight: 50, degrees: -90 });
    expect((r as { angle: number }).angle).toBe(270);
  });

  it("normalizes > 360 angles", () => {
    const r = calculateRotation({ originalWidth: 100, originalHeight: 50, degrees: 450 });
    expect((r as { angle: number }).angle).toBe(90);
  });

  it("computes bounding box for arbitrary angle 45deg", () => {
    const r = calculateRotation({ originalWidth: 100, originalHeight: 100, degrees: 45 });
    const result = r as { width: number; height: number };
    expect(result.width).toBeGreaterThan(100);
    expect(result.height).toBeGreaterThan(100);
  });

  it("errors on invalid dims", () => {
    expect(calculateRotation({ originalWidth: 0, originalHeight: 50, degrees: 90 })).toHaveProperty("error");
  });

  it("errors on non-finite degrees", () => {
    expect(
      calculateRotation({ originalWidth: 100, originalHeight: 50, degrees: Number.NaN }),
    ).toHaveProperty("error");
  });

  it("toRadians converts correctly", () => {
    expect(toRadians(180)).toBeCloseTo(Math.PI);
    expect(toRadians(90)).toBeCloseTo(Math.PI / 2);
  });
});
