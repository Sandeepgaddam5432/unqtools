import { describe, it, expect } from "vitest";
import { validateCrop, centerCropForAspect, ASPECT_PRESETS } from "./logic";

describe("validateCrop", () => {
  it("accepts a valid in-bounds crop", () => {
    expect(validateCrop({ x: 10, y: 10, width: 100, height: 100, imageWidth: 200, imageHeight: 200 })).toEqual({
      x: 10,
      y: 10,
      width: 100,
      height: 100,
    });
  });

  it("clamps x and y to image bounds", () => {
    expect(validateCrop({ x: -5, y: -10, width: 50, height: 50, imageWidth: 100, imageHeight: 100 })).toEqual({
      x: 0,
      y: 0,
      width: 50,
      height: 50,
    });
  });

  it("clamps width when crop exceeds image", () => {
    expect(validateCrop({ x: 80, y: 80, width: 100, height: 100, imageWidth: 100, imageHeight: 100 })).toEqual({
      x: 80,
      y: 80,
      width: 20,
      height: 20,
    });
  });

  it("errors on non-positive width", () => {
    expect(validateCrop({ x: 0, y: 0, width: 0, height: 50, imageWidth: 100, imageHeight: 100 })).toHaveProperty(
      "error",
    );
  });

  it("errors when crop is fully outside the image", () => {
    expect(
      validateCrop({ x: 200, y: 200, width: 50, height: 50, imageWidth: 100, imageHeight: 100 }),
    ).toHaveProperty("error");
  });

  it("errors on invalid image bounds", () => {
    expect(validateCrop({ x: 0, y: 0, width: 50, height: 50, imageWidth: 0, imageHeight: 0 })).toHaveProperty(
      "error",
    );
  });
});

describe("centerCropForAspect", () => {
  it("centers 1:1 in landscape image", () => {
    const r = centerCropForAspect(200, 100, 1, 1);
    expect(r.width).toBe(100);
    expect(r.height).toBe(100);
    expect(r.x).toBe(50);
    expect(r.y).toBe(0);
  });

  it("centers 1:3 in portrait image", () => {
    // Source 100x200 (aspect 0.5), target 1:3 (aspect 0.333). sourceAspect > targetAspect, so fill height.
    const r = centerCropForAspect(100, 200, 1, 3);
    expect(r.height).toBe(200);
    expect(r.width).toBe(Math.round(200 * (1 / 3)));
  });

  it("returns full image when aspect is 0", () => {
    const r = centerCropForAspect(200, 100, 0, 0);
    expect(r).toEqual({ x: 0, y: 0, width: 200, height: 100 });
  });

  it("provides presets", () => {
    expect(ASPECT_PRESETS.length).toBeGreaterThan(0);
    expect(ASPECT_PRESETS.find((p) => p.label === "1:1")).toBeDefined();
  });
});
