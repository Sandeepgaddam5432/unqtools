import { describe, it, expect } from "vitest";
import {
  clampRadius,
  clampRadii,
  uniformRadii,
  cornerAlpha,
  squircleAlpha,
  applyRounded,
  applyToRgba,
  dimensionsForPreset,
  buildCheckerboardCss,
  validateRoundedOptions,
  buildRoundedFilename,
  DEFAULT_OPTIONS,
  PRESET_SUBTLE,
  PRESET_ROUNDED,
  PRESET_CIRCLE,
  PRESET_SQUIRCLE,
  type RoundedOptions,
} from "./logic";

const baseOpts = (over: Partial<RoundedOptions> = {}): RoundedOptions => ({ ...DEFAULT_OPTIONS, ...over });

describe("clampRadius", () => {
  it("returns the radius when within bounds", () => expect(clampRadius(20, 100, 100)).toBe(20));
  it("clamps to half the smaller dimension", () => expect(clampRadius(80, 100, 50)).toBe(25));
  it("clamps to 0 for negative", () => expect(clampRadius(-5, 100, 100)).toBe(0));
  it("handles 0 radius", () => expect(clampRadius(0, 100, 100)).toBe(0));
});

describe("clampRadii", () => {
  it("preserves radii within bounds", () => {
    const r = clampRadii(uniformRadii(10), 100, 100);
    expect(r.topLeft).toBe(10);
  });
  it("clamps all four corners", () => {
    const r = clampRadii({ topLeft: 200, topRight: 200, bottomRight: 200, bottomLeft: 200 }, 100, 100);
    expect(r.topLeft).toBeLessThanOrEqual(50);
    expect(r.topRight).toBeLessThanOrEqual(50);
  });
});

describe("uniformRadii", () => {
  it("sets all four corners equal", () => {
    const r = uniformRadii(15);
    expect(r).toEqual({ topLeft: 15, topRight: 15, bottomRight: 15, bottomLeft: 15 });
  });
});

describe("cornerAlpha", () => {
  it("returns 1 at center", () => {
    expect(cornerAlpha(50, 50, 100, 100, uniformRadii(20), 1)).toBe(1);
  });
  it("returns 1 at center of an edge (non-corner)", () => {
    expect(cornerAlpha(50, 0, 100, 100, uniformRadii(20), 1)).toBe(1);
  });
  it("returns 0 outside the corner arc", () => {
    expect(cornerAlpha(0, 0, 100, 100, uniformRadii(20), 1)).toBe(0);
  });
  it("returns 1 when radius is 0", () => {
    expect(cornerAlpha(0, 0, 100, 100, uniformRadii(0), 0)).toBe(1);
  });
  it("smoothly transitions with feather", () => {
    const inside = cornerAlpha(19, 19, 100, 100, uniformRadii(20), 2);
    const outside = cornerAlpha(1, 1, 100, 100, uniformRadii(20), 2);
    expect(inside).toBeGreaterThan(outside);
  });
  it("supports per-corner radii", () => {
    const r = { topLeft: 30, topRight: 0, bottomRight: 30, bottomLeft: 0 };
    expect(cornerAlpha(0, 0, 100, 100, r, 0)).toBe(0); // top-left is rounded
    expect(cornerAlpha(99, 0, 100, 100, r, 0)).toBe(1); // top-right is sharp
  });
});

describe("squircleAlpha", () => {
  it("returns 1 at center", () => {
    expect(squircleAlpha(50, 50, 100, 100, 0)).toBe(1);
  });
  it("returns 0 at extreme corner", () => {
    expect(squircleAlpha(0, 0, 100, 100, 0)).toBe(0);
  });
  it("smoothly fades with feather > 0", () => {
    const inside = squircleAlpha(45, 45, 100, 100, 50);
    const outside = squircleAlpha(2, 2, 100, 100, 50);
    expect(inside).toBeGreaterThanOrEqual(outside);
  });
});

describe("applyRounded", () => {
  it("multiplies alpha by factor", () => expect(applyRounded(200, 0.5)).toBe(100));
  it("clamps to byte range", () => expect(applyRounded(300, 1)).toBe(255));
  it("preserves 0 alpha", () => expect(applyRounded(0, 0.5)).toBe(0));
});

describe("applyToRgba", () => {
  it("returns same length buffer", () => {
    const rgba = new Uint8ClampedArray(10 * 10 * 4).fill(255);
    const out = applyToRgba(rgba, 10, 10, baseOpts({ radii: uniformRadii(0) }));
    expect(out.length).toBe(rgba.length);
  });
  it("no-ops with 0 radius and no feather", () => {
    const rgba = new Uint8ClampedArray(10 * 10 * 4).fill(255);
    const out = applyToRgba(rgba, 10, 10, baseOpts({ radii: uniformRadii(0), feather: 0 }));
    expect(out[3]).toBe(255); // alpha untouched
  });
  it("zeros alpha at extreme corner when radius > 0", () => {
    const rgba = new Uint8ClampedArray(100 * 100 * 4).fill(255);
    const out = applyToRgba(rgba, 100, 100, baseOpts({ radii: uniformRadii(20), feather: 0 }));
    expect(out[3]).toBe(0); // (0,0) is outside the arc
  });
  it("supports squircle shape", () => {
    const rgba = new Uint8ClampedArray(100 * 100 * 4).fill(255);
    const out = applyToRgba(rgba, 100, 100, baseOpts({ shape: "squircle" }));
    expect(out[3]).toBe(0); // corner cut
  });
  it("supports circle shape", () => {
    const rgba = new Uint8ClampedArray(100 * 100 * 4).fill(255);
    const out = applyToRgba(rgba, 100, 100, baseOpts({ shape: "circle" }));
    expect(out[3]).toBe(0); // corner outside circle
  });
  it("applies background fill when enabled", () => {
    const rgba = new Uint8ClampedArray(100 * 100 * 4).fill(255);
    const out = applyToRgba(rgba, 100, 100, baseOpts({
      radii: uniformRadii(20), feather: 0,
      background: { enabled: true, color: { r: 0, g: 0, b: 0, a: 255 } },
    }));
    // (0,0) corner — bg fills with black, alpha stays 255
    expect(out[0]).toBe(0);
    expect(out[3]).toBe(255);
  });
  it("applies padding inset", () => {
    const rgba = new Uint8ClampedArray(100 * 100 * 4).fill(255);
    const out = applyToRgba(rgba, 100, 100, baseOpts({ radii: uniformRadii(0), padding: 5 }));
    // pixel at (0,0) is in padding — alpha should be 0
    expect(out[3]).toBe(0);
  });
  it("applies border ring", () => {
    const rgba = new Uint8ClampedArray(100 * 100 * 4).fill(255);
    const out = applyToRgba(rgba, 100, 100, baseOpts({
      radii: uniformRadii(0),
      border: { enabled: true, width: 4, color: { r: 255, g: 0, b: 0, a: 255 } },
    }));
    // pixel at (0,0) is in border ring — red
    expect(out[0]).toBe(255);
    expect(out[1]).toBe(0);
    expect(out[2]).toBe(0);
  });
});

describe("dimensionsForPreset", () => {
  it("returns 256 for avatar-256", () => {
    expect(dimensionsForPreset("avatar-256")).toEqual({ width: 256, height: 256 });
  });
  it("returns 1024 for app-icon-1024", () => {
    expect(dimensionsForPreset("app-icon-1024")).toEqual({ width: 1024, height: 1024 });
  });
});

describe("buildCheckerboardCss", () => {
  it("returns a CSS conic-gradient string", () => {
    const s = buildCheckerboardCss();
    expect(s).toContain("repeating-conic-gradient");
  });
});

describe("validateRoundedOptions", () => {
  it("accepts valid options", () => {
    expect(validateRoundedOptions(baseOpts(), 100, 100)).toEqual({ ok: true });
  });
  it("rejects negative radius", () => {
    expect(validateRoundedOptions(baseOpts({ radii: { topLeft: -1, topRight: 0, bottomRight: 0, bottomLeft: 0 } }), 100, 100)).toHaveProperty("error");
  });
  it("rejects radius too large", () => {
    expect(validateRoundedOptions(baseOpts({ radii: uniformRadii(100) }), 100, 100)).toHaveProperty("error");
  });
  it("rejects feather out of range", () => {
    expect(validateRoundedOptions(baseOpts({ feather: 200 }), 100, 100)).toHaveProperty("error");
  });
  it("rejects unknown shape", () => {
    expect(validateRoundedOptions(baseOpts({ shape: "bogus" as RoundedOptions["shape"] }), 100, 100)).toHaveProperty("error");
  });
});

describe("buildRoundedFilename", () => {
  it("builds filename with shape suffix", () => {
    expect(buildRoundedFilename("photo.png", "rounded", "image/png")).toBe("photo-rounded-rounded.png");
    expect(buildRoundedFilename("logo", "circle", "image/jpeg")).toBe("logo-rounded-circle.jpg");
  });
});

describe("presets", () => {
  it("subtle has small radius", () => expect(PRESET_SUBTLE.radii.topLeft).toBe(4));
  it("rounded has larger radius", () => expect(PRESET_ROUNDED.radii.topLeft).toBeGreaterThan(PRESET_SUBTLE.radii.topLeft));
  it("circle uses circle shape", () => expect(PRESET_CIRCLE.shape).toBe("circle"));
  it("squircle uses squircle shape", () => expect(PRESET_SQUIRCLE.shape).toBe("squircle"));
});
