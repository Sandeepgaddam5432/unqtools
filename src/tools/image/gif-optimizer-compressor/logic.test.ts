import { describe, it, expect } from "vitest";
import { calculateOptimization, defaultOptions, getColorPresets, formatBytes } from "./logic";

describe("GIF Optimizer", () => {
  it("calculates optimization with defaults", () => {
    const result = calculateOptimization(100000, defaultOptions(), 10);
    expect(result.originalSize).toBe(100000);
    expect(result.optimizedSize).toBeLessThanOrEqual(100000);
  });
  it("reduces size with color reduction", () => {
    const result = calculateOptimization(100000, { ...defaultOptions(), maxColors: 64 }, 10);
    expect(result.savingsPercent).toBeGreaterThan(0);
  });
  it("lists color presets", () => {
    expect(getColorPresets().length).toBeGreaterThan(0);
  });
  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});
