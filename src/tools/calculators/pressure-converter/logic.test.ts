import { describe, it, expect } from "vitest";
import {
  process, convertAll, convertBatch, toCsv, batchToCsv, swap, bestFitUnit,
  altitudeFromPressure, formatPressure, validateOptions, unitsByClass,
  sumPressure, mmHgToInHg, roundTo, TO_PA, UNIT_LABELS, UNIT_CLASS, PRESETS,
  ALL_UNITS, ALL_CLASSES,
} from "./logic";

describe("process — basic", () => {
  it("converts kPa to Pa", () => {
    const r = process(1, { from: "kPa", to: "Pa" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1000);
  });
  it("converts bar to Pa", () => {
    const r = process(1, { from: "bar", to: "Pa" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(100000);
  });
  it("converts atm to Pa", () => {
    const r = process(1, { from: "atm", to: "Pa" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(101325, 0);
  });
  it("converts psi to Pa", () => {
    const r = process(1, { from: "psi", to: "Pa" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(6894.757, 1);
  });
  it("converts mmHg to torr (equal)", () => {
    const r = process(760, { from: "mmHg", to: "torr" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(760, 6);
  });
  it("converts hPa to Pa", () => {
    const r = process(1, { from: "hPa", to: "Pa" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(100);
  });
  it("converts MPa to bar", () => {
    const r = process(1, { from: "MPa", to: "bar" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(10);
  });
  it("converts mbar to Pa", () => {
    const r = process(1, { from: "mbar", to: "Pa" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(100);
  });
  it("returns class flag", () => {
    const r = process(1, { from: "psi", to: "psi" });
    if ("error" in r) throw new Error("err");
    expect(r.class).toBe("hydraulic");
  });
});

describe("process — edge", () => {
  it("warns on negative", () => {
    const r = process(-5, { from: "Pa", to: "kPa" });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("errors on NaN", () => {
    expect("error" in process(NaN, { from: "Pa", to: "psi" })).toBe(true);
  });
  it("errors on Infinity", () => {
    expect("error" in process(Infinity, { from: "Pa", to: "psi" })).toBe(true);
  });
  it("returns same value for same unit", () => {
    const r = process(42, { from: "Pa", to: "Pa" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(42);
  });
  it("warns on vacuum range", () => {
    const r = process(0.5, { from: "Pa", to: "Pa" });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.some((w) => w.includes("vacuum"))).toBe(true);
  });
  it("warns on hydraulic range", () => {
    const r = process(20, { from: "MPa", to: "Pa" });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.some((w) => w.includes("hydraulic"))).toBe(true);
  });
});

describe("convertAll", () => {
  it("returns 10 unit conversions", () => {
    expect(convertAll(1, "atm").length).toBe(10);
  });
  it("Pa value for 1 atm = 101325", () => {
    const all = convertAll(1, "atm");
    const pa = all.find((r) => r.unit === "Pa")!;
    expect(pa.value).toBeCloseTo(101325, 0);
  });
});

describe("convertBatch", () => {
  it("processes multiple inputs", () => {
    const r = convertBatch([1, 2], "kPa", "Pa");
    expect(r.length).toBe(2);
    const first = r[0]!;
    if ("error" in first) throw new Error("err");
    expect(first.output).toBe(1000);
  });
  it("propagates errors", () => {
    const r = convertBatch([1, NaN], "kPa", "Pa");
    expect("error" in r[1]!).toBe(true);
  });
});

describe("toCsv", () => {
  it("generates CSV with header", () => {
    const csv = toCsv(convertAll(1, "atm"));
    expect(csv.split("\n")[0]).toBe("Unit,Value");
    expect(csv).toContain("Pa,101325");
  });
});

describe("batchToCsv", () => {
  it("emits header + rows", () => {
    const inputs = [1, 2];
    const results = convertBatch(inputs, "kPa", "Pa");
    const csv = batchToCsv(inputs, "kPa", "Pa", results);
    expect(csv.split("\n")[0]).toBe("Input,From,Output,Unit,Class,Warnings");
    expect(csv).toContain("kPa");
  });
});

describe("swap", () => {
  it("swaps from and to", () => {
    expect(swap({ from: "Pa", to: "kPa" })).toEqual({ from: "kPa", to: "Pa" });
  });
});

describe("bestFitUnit", () => {
  it("returns Pa for tiny", () => { expect(bestFitUnit(50)).toBe("Pa"); });
  it("returns hPa for ~1000", () => { expect(bestFitUnit(900)).toBe("hPa"); });
  it("returns kPa for ~1e5", () => { expect(bestFitUnit(50000)).toBe("kPa"); });
  it("returns bar for ~5e5", () => { expect(bestFitUnit(500000)).toBe("bar"); });
  it("returns MPa for huge", () => { expect(bestFitUnit(2e6)).toBe("MPa"); });
  it("returns Pa for 0", () => { expect(bestFitUnit(0)).toBe("Pa"); });
});

describe("altitudeFromPressure", () => {
  it("returns 0 for sea level", () => {
    expect(altitudeFromPressure(101325)).toBeCloseTo(0, 0);
  });
  it("returns positive altitude for lower pressure", () => {
    expect(altitudeFromPressure(50000)).toBeGreaterThan(5000);
  });
  it("returns NaN for 0 pressure", () => {
    expect(Number.isNaN(altitudeFromPressure(0))).toBe(true);
  });
});

describe("formatPressure", () => {
  it("formats with unit", () => {
    expect(formatPressure(1000, "Pa")).toBe("1000 Pa");
  });
});

describe("validateOptions", () => {
  it("accepts valid", () => { expect(validateOptions({ from: "Pa", to: "kPa" })).toEqual({ ok: true }); });
  it("rejects invalid", () => {
    expect(validateOptions({ from: "bogus" as never, to: "Pa" })).toHaveProperty("error");
  });
});

describe("unitsByClass", () => {
  it("groups atmospheric", () => {
    const a = unitsByClass("atmospheric");
    expect(a).toContain("hPa"); expect(a).toContain("atm"); expect(a).toContain("mmHg"); expect(a).toContain("mbar");
  });
  it("groups hydraulic", () => {
    const h = unitsByClass("hydraulic");
    expect(h).toContain("MPa"); expect(h).toContain("psi");
  });
});

describe("sumPressure", () => {
  it("sums across units", () => {
    const s = sumPressure([{ value: 1, unit: "atm" }, { value: 1013, unit: "hPa" }], "atm");
    expect(s).toBeCloseTo(2, 1);
  });
});

describe("mmHgToInHg", () => {
  it("converts 760 mmHg to ~29.92 inHg", () => {
    expect(mmHgToInHg(760)).toBeCloseTo(29.92, 1);
  });
});

describe("roundTo", () => {
  it("rounds to significant digits", () => { expect(roundTo(3.14159265, 4)).toBe(3.142); });
});

describe("constants", () => {
  it("TO_PA has 10 units", () => { expect(Object.keys(TO_PA).length).toBe(10); });
  it("UNIT_LABELS has 10 units", () => { expect(Object.keys(UNIT_LABELS).length).toBe(10); });
  it("UNIT_CLASS has 10 units", () => { expect(Object.keys(UNIT_CLASS).length).toBe(10); });
  it("ALL_UNITS has 10 units", () => { expect(ALL_UNITS.length).toBe(10); });
  it("ALL_CLASSES has 4 classes", () => { expect(ALL_CLASSES.length).toBe(4); });
  it("PRESETS has 7 entries", () => { expect(PRESETS.length).toBe(7); });
});
