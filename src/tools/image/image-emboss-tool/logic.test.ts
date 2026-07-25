import { describe, it, expect } from "vitest";
import { embossKernel, applyKernel, validateEmbossOptions, luma, type EmbossDirection } from "./logic";

describe("embossKernel", () => {
  it("is 3x3", () => {
    const k = embossKernel("top");
    expect(k.length).toBe(3);
    k.forEach((row) => expect(row.length).toBe(3));
  });
  it("center is always 0", () => {
    (["top", "left", "topleft", "bottomright"] as EmbossDirection[]).forEach((d) => {
      expect(embossKernel(d)[1]![1]).toBe(0);
    });
  });
  it("top has -1 at (0,1) and +1 at (2,1)", () => {
    const k = embossKernel("top");
    expect(k[0]![1]).toBe(-1);
    expect(k[2]![1]).toBe(1);
  });
  it("topleft has -1 at (0,0) and +1 at (2,2)", () => {
    const k = embossKernel("topleft");
    expect(k[0]![0]).toBe(-1);
    expect(k[2]![2]).toBe(1);
  });
});

describe("applyKernel", () => {
  it("returns 128 baseline when neighbors equal center", () => {
    const k = embossKernel("top");
    const v = applyKernel(k, 100, [100, 100, 100, 100, 100, 100, 100, 100], 100);
    expect(v).toBe(128);
  });
  it("clamps to 0..255", () => {
    const k = embossKernel("top");
    const v = applyKernel(k, 0, [255, 255, 255, 255, 255, 255, 255, 255], 200);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThanOrEqual(255);
  });
});

describe("validateEmbossOptions", () => {
  it("accepts valid options", () => {
    expect(validateEmbossOptions({ direction: "top", amount: 100 })).toEqual({ ok: true });
  });
  it("rejects invalid direction", () => {
    expect(validateEmbossOptions({ direction: "x" as never, amount: 100 })).toHaveProperty("error");
  });
  it("rejects out-of-range amount", () => {
    expect(validateEmbossOptions({ direction: "top", amount: 300 })).toHaveProperty("error");
  });
});

describe("luma", () => {
  it("black is 0", () => expect(luma(0, 0, 0)).toBe(0));
  it("white is 255", () => expect(luma(255, 255, 255)).toBeCloseTo(255, 0));
});
