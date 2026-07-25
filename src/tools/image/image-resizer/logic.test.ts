import { describe, it, expect } from "vitest";
import { calculateResize, RESIZE_PRESETS } from "./logic";

describe("calculateResize", () => {
  it("scales by percent", () => {
    const r = calculateResize({ originalWidth: 1000, originalHeight: 500, lockAspect: true, scalePercent: 50 });
    expect(r).toEqual({ width: 500, height: 250, scale: 0.5 });
  });

  it("locks aspect by width", () => {
    const r = calculateResize({ originalWidth: 1000, originalHeight: 500, targetWidth: 200, lockAspect: true });
    expect(r).toEqual({ width: 200, height: 100, scale: 0.2 });
  });

  it("locks aspect by height", () => {
    const r = calculateResize({ originalWidth: 1000, originalHeight: 500, targetHeight: 100, lockAspect: true });
    expect(r).toEqual({ width: 200, height: 100, scale: 0.2 });
  });

  it("uses smaller scale when both dims provided and locked", () => {
    const r = calculateResize({
      originalWidth: 1000,
      originalHeight: 500,
      targetWidth: 200,
      targetHeight: 200,
      lockAspect: true,
    });
    expect((r as { width: number }).width).toBe(200);
    expect((r as { height: number }).height).toBe(100);
  });

  it("allows independent dims when lockAspect is false", () => {
    const r = calculateResize({
      originalWidth: 1000,
      originalHeight: 500,
      targetWidth: 300,
      targetHeight: 150,
      lockAspect: false,
    });
    expect(r).toEqual({ width: 300, height: 150, scale: 0.3 });
  });

  it("errors when nothing provided", () => {
    expect(calculateResize({ originalWidth: 100, originalHeight: 100, lockAspect: true })).toHaveProperty("error");
  });

  it("errors on non-positive original", () => {
    expect(
      calculateResize({ originalWidth: 0, originalHeight: 100, targetWidth: 50, lockAspect: true }),
    ).toHaveProperty("error");
  });

  it("clamps minimum dimension to 1", () => {
    const r = calculateResize({ originalWidth: 1000, originalHeight: 500, scalePercent: 0.001, lockAspect: true });
    expect((r as { width: number }).width).toBeGreaterThanOrEqual(1);
    expect((r as { height: number }).height).toBeGreaterThanOrEqual(1);
  });

  it("provides presets", () => {
    expect(RESIZE_PRESETS.length).toBeGreaterThan(0);
    expect(RESIZE_PRESETS[0]).toHaveProperty("width");
  });
});
