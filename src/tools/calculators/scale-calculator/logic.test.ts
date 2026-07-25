import { describe, it, expect } from "vitest";
import {
  validateScale, scaleFactor, formatScale, realToModel, modelToReal,
  mapToReal, realToMap, areaScale, volumeScale, fmtNum, convert,
  UNIT_FACTORS_TO_M, ALL_UNITS, UNITS_BY_SYSTEM, COMMON_SCALES,
  formula, batchRealToModel, batchModelToReal, batchToCsv,
  systemOf, defaultUnits,
} from "./logic";

describe("validateScale", () => {
  it("passes valid input", () => {
    expect(validateScale({ real: 100, model: 1 })).toEqual({ real: 100, model: 1 });
  });
  it("errors on non-positive real", () => {
    expect(validateScale({ real: 0, model: 1 })).toHaveProperty("error");
    expect(validateScale({ real: -1, model: 1 })).toHaveProperty("error");
  });
  it("errors on non-positive model", () => {
    expect(validateScale({ real: 100, model: 0 })).toHaveProperty("error");
  });
  it("errors on negative dimension", () => {
    expect(validateScale({ real: 100, model: 1, realDim: -5 })).toHaveProperty("error");
  });
});

describe("scaleFactor", () => {
  it("computes real/model", () => {
    expect(scaleFactor(100, 1)).toBe(100);
    expect(scaleFactor(1, 100)).toBeCloseTo(0.01);
  });
});

describe("formatScale", () => {
  it("formats 1:N for factor >= 1", () => {
    expect(formatScale(100)).toBe("1:100");
    expect(formatScale(50000)).toBe("1:50000");
  });
  it("formats N:1 for factor < 1", () => {
    expect(formatScale(0.5)).toBe("2:1");
    expect(formatScale(0.1)).toBe("10:1");
  });
  it("trims trailing .00", () => {
    expect(formatScale(1.5)).toBe("1:1.5");
  });
});

describe("realToModel / modelToReal", () => {
  it("divides real by factor", () => {
    expect(realToModel(100, 100)).toBe(1);
    expect(realToModel(200, 50)).toBe(4);
  });
  it("multiplies model by factor", () => {
    expect(modelToReal(1, 100)).toBe(100);
    expect(modelToReal(2, 50)).toBe(100);
  });
});

describe("mapToReal / realToMap", () => {
  it("multiplies map distance by N", () => {
    expect(mapToReal(2, 50000)).toBe(100000);
  });
  it("returns map distance when N=1", () => {
    expect(mapToReal(5, 1)).toBe(5);
  });
  it("realToMap inverts mapToReal", () => {
    expect(realToMap(100000, 50000)).toBe(2);
  });
  it("realToMap returns NaN for N=0", () => {
    expect(realToMap(5, 0)).toBeNaN();
  });
});

describe("areaScale / volumeScale", () => {
  it("squares the factor", () => {
    expect(areaScale(100)).toBe(10000);
  });
  it("cubes the factor", () => {
    expect(volumeScale(100)).toBe(1000000);
  });
});

describe("fmtNum", () => {
  it("trims trailing zeros", () => {
    expect(fmtNum(1.5)).toBe("1.5");
    expect(fmtNum(2)).toBe("2");
    expect(fmtNum(0.123456)).toBe("0.1235");
  });
  it("renders em-dash for non-finite", () => {
    expect(fmtNum(NaN)).toBe("—");
    expect(fmtNum(Infinity)).toBe("—");
  });
});

describe("UNIT_FACTORS_TO_M", () => {
  it("has 8 units (metric + imperial + yd + mi)", () => {
    expect(Object.keys(UNIT_FACTORS_TO_M).length).toBe(8);
  });
  it("m = 1", () => {
    expect(UNIT_FACTORS_TO_M.m).toBe(1);
  });
});

describe("convert", () => {
  it("m → cm", () => {
    expect(convert(1, "m", "cm")).toBe(100);
  });
  it("km → m", () => {
    expect(convert(1, "km", "m")).toBe(1000);
  });
  it("ft → in", () => {
    expect(convert(1, "ft", "in")).toBeCloseTo(12);
  });
  it("yd → ft", () => {
    expect(convert(1, "yd", "ft")).toBeCloseTo(3);
  });
  it("mi → km", () => {
    expect(convert(1, "mi", "km")).toBeCloseTo(1.609344);
  });
  it("errors on unknown unit", () => {
    expect(convert(1, "miles", "m")).toHaveProperty("error");
  });
});

describe("UNITS_BY_SYSTEM & ALL_UNITS", () => {
  it("metric has 4 units", () => {
    expect(UNITS_BY_SYSTEM.metric).toHaveLength(4);
  });
  it("imperial has 4 units", () => {
    expect(UNITS_BY_SYSTEM.imperial).toHaveLength(4);
  });
  it("ALL_UNITS lists 8", () => {
    expect(ALL_UNITS).toHaveLength(8);
  });
});

describe("COMMON_SCALES", () => {
  it("has at least 10 presets", () => {
    expect(COMMON_SCALES.length).toBeGreaterThanOrEqual(10);
  });
  it("includes 1:100", () => {
    expect(COMMON_SCALES.some((s) => s.factor === 100)).toBe(true);
  });
});

describe("formula", () => {
  it("renders readable formula", () => {
    const s = formula(100, 1, 100);
    expect(s).toContain("100");
    expect(s).toContain("factor");
  });
});

describe("batchRealToModel / batchModelToReal", () => {
  it("returns converted model sizes", () => {
    const r = batchRealToModel([100, 200, 300], 100);
    expect(r.map((x) => x.model)).toEqual([1, 2, 3]);
  });
  it("reports errors for invalid input", () => {
    const r = batchRealToModel([-1, 100], 100);
    expect(r[0]!.model).toHaveProperty("error");
  });
  it("batchModelToReal mirrors batchRealToModel", () => {
    const r = batchModelToReal([1, 2], 100);
    expect(r.map((x) => x.real)).toEqual([100, 200]);
  });
});

describe("batchToCsv", () => {
  it("renders CSV with header", () => {
    const csv = batchToCsv(batchRealToModel([100, 200], 100));
    expect(csv.split("\n")[0]).toBe("dimension,model");
    expect(csv.split("\n")[1]).toBe("100,1");
  });
  it("renders error string in CSV", () => {
    const csv = batchToCsv(batchRealToModel([-1], 100));
    expect(csv).toContain("error");
  });
});

describe("systemOf & defaultUnits", () => {
  it("detects metric", () => {
    expect(systemOf("m")).toBe("metric");
    expect(systemOf("cm")).toBe("metric");
  });
  it("detects imperial", () => {
    expect(systemOf("ft")).toBe("imperial");
    expect(systemOf("mi")).toBe("imperial");
  });
  it("returns null for unknown unit", () => {
    expect(systemOf("lightyear")).toBeNull();
  });
  it("default metric units are m and cm", () => {
    expect(defaultUnits("metric")).toEqual({ real: "m", model: "cm" });
  });
  it("default imperial units are ft and in", () => {
    expect(defaultUnits("imperial")).toEqual({ real: "ft", model: "in" });
  });
});
