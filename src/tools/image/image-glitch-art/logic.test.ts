import { describe, it, expect } from "vitest";
import {
  makeRng,
  validateGlitchParams,
  luma,
  datamoshBlocks,
  channelShiftOffsets,
  sortByBrightness,
  scanlineIntensity,
  vhsNoise,
  corruptByte,
  sliceDisplacements,
  isIdentity,
  batchValidate,
  preservesAlpha,
  nudgeValue,
  findPreset,
  PRESETS,
  DEFAULT_PARAMS,
  clampByte,
} from "./logic";

describe("makeRng", () => {
  it("is deterministic for same seed", () => {
    const r1 = makeRng(123)();
    const r2 = makeRng(123)();
    expect(r1).toBe(r2);
  });
  it("produces different values for different seeds", () => {
    const r1 = makeRng(1)();
    const r2 = makeRng(2)();
    expect(r1).not.toBe(r2);
  });
  it("produces 0..1 values", () => {
    const rng = makeRng(42);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("luma", () => {
  it("black is 0", () => expect(luma(0, 0, 0)).toBe(0));
  it("white is 255", () => expect(luma(255, 255, 255)).toBeCloseTo(255, 0));
  it("weights green most", () => {
    expect(luma(0, 255, 0)).toBeGreaterThan(luma(255, 0, 0));
  });
});

describe("validateGlitchParams", () => {
  it("accepts valid params", () => {
    expect(validateGlitchParams(DEFAULT_PARAMS)).toEqual({ ok: true });
  });
  it("rejects unknown mode", () => {
    expect(validateGlitchParams({ ...DEFAULT_PARAMS, mode: "unknown" as never })).toHaveProperty("error");
  });
  it("rejects bad intensity", () => {
    expect(validateGlitchParams({ ...DEFAULT_PARAMS, intensity: 200 })).toHaveProperty("error");
  });
  it("rejects bad shift", () => {
    expect(validateGlitchParams({ ...DEFAULT_PARAMS, shift: -1 })).toHaveProperty("error");
  });
  it("rejects non-finite seed", () => {
    expect(validateGlitchParams({ ...DEFAULT_PARAMS, seed: Number.NaN })).toHaveProperty("error");
  });
});

describe("datamoshBlocks", () => {
  it("returns blocks with y0, y1, dy", () => {
    const rng = makeRng(1);
    const blocks = datamoshBlocks(100, 50, rng);
    expect(blocks.length).toBeGreaterThan(0);
    for (const b of blocks) {
      expect(b.y0).toBeGreaterThanOrEqual(0);
      expect(b.y1).toBeLessThanOrEqual(100);
      expect(b.y1).toBeGreaterThan(b.y0);
    }
  });
  it("returns at least 1 block", () => {
    const rng = makeRng(1);
    expect(datamoshBlocks(100, 0, rng).length).toBeGreaterThanOrEqual(1);
  });
});

describe("channelShiftOffsets", () => {
  it("returns r, g, b offsets", () => {
    const rng = makeRng(1);
    const o = channelShiftOffsets(20, rng);
    expect(o).toHaveProperty("r");
    expect(o).toHaveProperty("g");
    expect(o).toHaveProperty("b");
  });
  it("offsets are within ±shift", () => {
    const rng = makeRng(1);
    const o = channelShiftOffsets(20, rng);
    expect(Math.abs(o.r)).toBeLessThanOrEqual(20);
  });
});

describe("sortByBrightness", () => {
  it("sorts by brightness descending", () => {
    expect(sortByBrightness([0, 0, 0], [255, 255, 255])).toBeGreaterThan(0);
  });
  it("returns 0 for equal brightness", () => {
    expect(sortByBrightness([100, 100, 100], [100, 100, 100])).toBe(0);
  });
});

describe("scanlineIntensity + vhsNoise + corruptByte + sliceDisplacements", () => {
  it("scanlineIntensity is 1 for even rows", () => {
    expect(scanlineIntensity(0, 50)).toBe(1);
    expect(scanlineIntensity(2, 50)).toBe(1);
  });
  it("scanlineIntensity is < 1 for odd rows", () => {
    expect(scanlineIntensity(1, 50)).toBeLessThan(1);
  });
  it("vhsNoise returns 0..255", () => {
    const v = vhsNoise(128, 0.5, 50);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(255);
  });
  it("vhsNoise is identity for 0 intensity", () => {
    expect(vhsNoise(128, 0.5, 0)).toBe(128);
  });
  it("corruptByte returns 0..255", () => {
    const v = corruptByte(128, makeRng(1), 100);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(255);
  });
  it("corruptByte is identity for 0 intensity", () => {
    expect(corruptByte(128, makeRng(1), 0)).toBe(128);
  });
  it("sliceDisplacements returns Int16Array", () => {
    const out = sliceDisplacements(100, 20, 50, makeRng(1));
    expect(out.length).toBe(100);
    expect(out).toBeInstanceOf(Int16Array);
  });
});

describe("isIdentity + batch + format + nudge + presets + clampByte", () => {
  it("isIdentity true when intensity and shift 0", () => {
    expect(isIdentity({ ...DEFAULT_PARAMS, intensity: 0, shift: 0 })).toBe(true);
    expect(isIdentity(DEFAULT_PARAMS)).toBe(false);
  });
  it("batchValidate validates each file", () => {
    const r = batchValidate([{ name: "a.png" }], DEFAULT_PARAMS);
    expect(r[0]!.result).toEqual({ ok: true });
  });
  it("preservesAlpha correct", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
  it("nudgeValue increments and decrements", () => {
    expect(nudgeValue(50, "arrowup", false)).toBe(51);
    expect(nudgeValue(50, "arrowdown", true)).toBe(40);
  });
  it("findPreset returns matching", () => {
    expect(findPreset("vhs")?.params.mode).toBe("vhs");
  });
  it("has at least 6 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(6);
  });
  it("clampByte rounds and clamps", () => {
    expect(clampByte(-5)).toBe(0);
    expect(clampByte(300)).toBe(255);
  });
});
