import { describe, it, expect } from "vitest";
import { generateBlob, defaultOptions, getPresets } from "./logic";

describe("Blob Shape Generator", () => {
  it("generates SVG blob", () => {
    const svg = generateBlob(defaultOptions());
    expect(svg).toContain("<svg");
    expect(svg).toContain("<path");
  });
  it("generates different blobs with different seeds", () => {
    const svg1 = generateBlob({ ...defaultOptions(), seed: 1 });
    const svg2 = generateBlob({ ...defaultOptions(), seed: 2 });
    expect(svg1).not.toBe(svg2);
  });
  it("generates reproducible blobs with same seed", () => {
    const svg1 = generateBlob({ ...defaultOptions(), seed: 42 });
    const svg2 = generateBlob({ ...defaultOptions(), seed: 42 });
    expect(svg1).toBe(svg2);
  });
  it("lists presets", () => {
    expect(getPresets().length).toBeGreaterThan(0);
  });
});
