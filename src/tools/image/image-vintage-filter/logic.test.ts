import { describe, it, expect } from "vitest";
import {
  DEFAULT_PARAMS, PRESETS, adjustContrastBrightness, toGrayscale, toSepia,
  applyFade, applySplitTone, vignetteFactor, addGrain, seedGrain, applyPreset,
  processImage, withPreset, estimatePngBytes, formatBytes, describeSettings,
} from "./logic";

describe("PRESETS", () => {
  it("has all 5 presets", () => {
    expect(Object.keys(PRESETS).length).toBe(5);
  });
  it("each preset has contrast", () => {
    for (const p of Object.values(PRESETS)) {
      expect(p.contrast).toBeDefined();
    }
  });
});

describe("adjustContrastBrightness", () => {
  it("identity preserves value", () => {
    const [r, g, b] = adjustContrastBrightness(128, 128, 128, 1, 1);
    expect(r).toBe(128);
    expect(g).toBe(128);
    expect(b).toBe(128);
  });
  it("brightness scales", () => {
    const [r] = adjustContrastBrightness(100, 100, 100, 1, 1.5);
    expect(r).toBeGreaterThan(100);
  });
  it("clamps to 0..255", () => {
    const [r] = adjustContrastBrightness(250, 250, 250, 2, 2);
    expect(r).toBeLessThanOrEqual(255);
  });
});

describe("toGrayscale", () => {
  it("returns gray value", () => {
    const [r, g, b] = toGrayscale(100, 150, 200);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });
  it("red dominant → grayscale > red component", () => {
    const [r] = toGrayscale(255, 0, 0);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThan(100);
  });
});

describe("toSepia", () => {
  it("produces warm tones", () => {
    const [r, g, b] = toSepia(255, 255, 255);
    expect(r).toBeGreaterThanOrEqual(g);
    expect(g).toBeGreaterThanOrEqual(b);
  });
  it("clamps to 255", () => {
    const [r] = toSepia(255, 255, 255);
    expect(r).toBeLessThanOrEqual(255);
  });
});

describe("applyFade", () => {
  it("lifts dark values", () => {
    const [r] = applyFade(0, 0, 0, 1);
    expect(r).toBeGreaterThan(0);
  });
  it("amount 0 = identity", () => {
    const [r] = applyFade(100, 100, 100, 0);
    expect(r).toBe(100);
  });
});

describe("applySplitTone", () => {
  it("tints highlights and shadows", () => {
    const lightRgb = applySplitTone(255, 255, 255, [255, 200, 100], [50, 50, 100]);
    const darkRgb = applySplitTone(0, 0, 0, [255, 200, 100], [50, 50, 100]);
    expect(lightRgb[0]).toBeGreaterThan(0);
    expect(darkRgb[2]).toBeGreaterThan(0);
  });
});

describe("vignetteFactor", () => {
  it("is 1 at center", () => {
    expect(vignetteFactor(0, 0.5)).toBe(1);
  });
  it("decreases toward edge", () => {
    expect(vignetteFactor(1, 0.5)).toBeLessThan(1);
  });
  it("is 1 when strength 0", () => {
    expect(vignetteFactor(1, 0)).toBe(1);
  });
});

describe("addGrain & seedGrain", () => {
  it("seedGrain is deterministic", () => {
    const a = seedGrain(1);
    const b = seedGrain(1);
    expect(a()).toBe(b());
  });
  it("grain with 0 amount is identity", () => {
    const [r, g, b] = addGrain(100, 100, 100, 0, 0.5);
    expect(r).toBe(100);
    expect(g).toBe(100);
    expect(b).toBe(100);
  });
  it("grain with full amount shifts values", () => {
    const [r] = addGrain(100, 100, 100, 1, 1.0);
    expect(r).toBeGreaterThan(100);
  });
});

describe("applyPreset", () => {
  it("bw produces gray", () => {
    const [r, g, b] = applyPreset(200, 50, 100, { ...DEFAULT_PARAMS, preset: "bw" });
    expect(r).toBe(g);
    expect(g).toBe(b);
  });
  it("sepia produces warm", () => {
    const [r, g, b] = applyPreset(255, 255, 255, { ...DEFAULT_PARAMS, preset: "sepia" });
    expect(r).toBeGreaterThanOrEqual(g);
  });
});

describe("processImage", () => {
  it("returns same-length buffer", () => {
    const px = new Uint8ClampedArray([100, 100, 100, 255, 200, 200, 200, 255]);
    const out = processImage(px, 2, 1, DEFAULT_PARAMS);
    expect(out.length).toBe(px.length);
  });
  it("preserves alpha channel", () => {
    const px = new Uint8ClampedArray([100, 100, 100, 200]);
    const out = processImage(px, 1, 1, DEFAULT_PARAMS);
    expect(out[3]).toBe(200);
  });
});

describe("withPreset", () => {
  it("merges preset into params", () => {
    const p = withPreset("faded");
    expect(p.preset).toBe("faded");
    expect(p.fade).toBeGreaterThan(0);
  });
  it("overrides win", () => {
    const p = withPreset("faded", { fade: 0.5 });
    expect(p.fade).toBe(0.5);
  });
});

describe("estimatePngBytes & formatBytes", () => {
  it("scales", () => {
    expect(estimatePngBytes(512, 512)).toBeGreaterThan(estimatePngBytes(64, 64));
  });
  it("formats", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });
});

describe("describeSettings", () => {
  it("contains all settings", () => {
    const s = describeSettings(DEFAULT_PARAMS);
    expect(s).toContain("Preset:");
    expect(s).toContain("Contrast:");
    expect(s).toContain("Grain:");
  });
});
