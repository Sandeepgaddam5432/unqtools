import { describe, it, expect } from "vitest";
import {
  process, convertAll, convertBatch, toCsv, batchToCsv, swap, bestFitUnit,
  formatEnergy, sumEnergy, avgEnergy, validateOptions, unitsByClass,
  roundTo, TO_J, UNIT_LABELS, UNIT_TRIVIA, UNIT_CLASS, PRESETS, ALL_UNITS,
  ALL_CLASSES,
} from "./logic";

describe("process — basic", () => {
  it("converts cal to J", () => {
    const r = process(1, { from: "cal", to: "J" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(4.184, 4);
  });
  it("converts kWh to J", () => {
    const r = process(1, { from: "kWh", to: "J" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(3.6e6);
  });
  it("converts Wh to J", () => {
    const r = process(1, { from: "Wh", to: "J" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(3600);
  });
  it("converts BTU to J", () => {
    const r = process(1, { from: "BTU", to: "J" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(1055.05585262, 2);
  });
  it("converts ft_lb to J", () => {
    const r = process(1, { from: "ft_lb", to: "J" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(1.3558179483314004, 6);
  });
  it("converts kWh to Wh", () => {
    const r = process(1, { from: "kWh", to: "Wh" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1000);
  });
  it("converts therm to J", () => {
    const r = process(1, { from: "therm", to: "J" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(1.05505585262e8, 0);
  });
  it("converts eV to J", () => {
    const r = process(1, { from: "eV", to: "J" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(1.602176634e-19, 30);
  });
  it("converts kJ to J", () => {
    const r = process(1, { from: "kJ", to: "J" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(1000);
  });
});

describe("process — edge", () => {
  it("warns on negative", () => {
    const r = process(-5, { from: "J", to: "cal" });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("errors on NaN", () => {
    expect("error" in process(NaN, { from: "J", to: "kWh" })).toBe(true);
  });
  it("errors on Infinity", () => {
    expect("error" in process(Infinity, { from: "J", to: "kWh" })).toBe(true);
  });
  it("returns same value for same unit", () => {
    const r = process(42, { from: "J", to: "J" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(42);
  });
  it("warns on huge eV output", () => {
    const r = process(1e30, { from: "J", to: "eV" });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("convertAll", () => {
  it("returns 10 unit conversions", () => {
    const all = convertAll(1, "J");
    expect(all.length).toBe(10);
  });
  it("cal value matches 1/4.184", () => {
    const all = convertAll(1, "J");
    const cal = all.find((r) => r.unit === "cal")!;
    expect(cal.value).toBeCloseTo(1 / 4.184, 4);
  });
});

describe("convertBatch", () => {
  it("processes multiple inputs", () => {
    const results = convertBatch([1, 2, 3], "kWh", "J");
    expect(results.length).toBe(3);
    expect("output" in results[0]! ? results[0]!.output : 0).toBe(3.6e6);
  });
  it("propagates errors per item", () => {
    const results = convertBatch([1, NaN, 3], "J", "kWh");
    expect("error" in results[1]!).toBe(true);
  });
});

describe("toCsv", () => {
  it("generates CSV with header", () => {
    const csv = toCsv(convertAll(1, "kWh"));
    expect(csv.split("\n")[0]).toBe("Unit,Value");
    expect(csv).toContain("J,3600000");
  });
});

describe("batchToCsv", () => {
  it("emits header + rows", () => {
    const inputs = [1, 2];
    const results = convertBatch(inputs, "kWh", "J");
    const csv = batchToCsv(inputs, "kWh", "J", results);
    expect(csv.split("\n")[0]).toBe("Input,From,Output,Unit,Warnings");
    expect(csv).toContain("kWh");
    expect(csv).toContain("J");
  });
});

describe("swap", () => {
  it("swaps from and to", () => {
    expect(swap({ from: "J", to: "kWh" })).toEqual({ from: "kWh", to: "J" });
  });
});

describe("bestFitUnit", () => {
  it("returns eV for tiny values", () => {
    expect(bestFitUnit(1e-20)).toBe("eV");
  });
  it("returns J for moderate values", () => {
    expect(bestFitUnit(100)).toBe("J");
  });
  it("returns therm for huge values", () => {
    expect(bestFitUnit(2e8)).toBe("therm");
  });
  it("returns J for zero", () => {
    expect(bestFitUnit(0)).toBe("J");
  });
});

describe("formatEnergy", () => {
  it("formats with unit", () => {
    expect(formatEnergy(1000, "J")).toBe("1000 J");
  });
});

describe("sumEnergy + avgEnergy", () => {
  it("sums across units", () => {
    const sum = sumEnergy([{ value: 1, unit: "kWh" }, { value: 3600, unit: "J" }], "J");
    expect(sum).toBe(3603600);
  });
  it("averages across units", () => {
    const avg = avgEnergy([{ value: 1, unit: "kWh" }, { value: 3600, unit: "J" }], "J");
    expect(avg).toBe(1801800);
  });
  it("avg returns 0 for empty", () => {
    expect(avgEnergy([], "J")).toBe(0);
  });
});

describe("validateOptions", () => {
  it("accepts valid", () => { expect(validateOptions({ from: "J", to: "kWh" })).toEqual({ ok: true }); });
  it("rejects invalid from", () => {
    expect(validateOptions({ from: "bogus" as never, to: "J" })).toHaveProperty("error");
  });
});

describe("unitsByClass", () => {
  it("groups thermal units", () => {
    const t = unitsByClass("thermal");
    expect(t).toContain("cal"); expect(t).toContain("kcal"); expect(t).toContain("BTU"); expect(t).toContain("therm");
  });
  it("groups electrical units", () => {
    const e = unitsByClass("electrical");
    expect(e).toContain("Wh"); expect(e).toContain("kWh");
  });
});

describe("roundTo", () => {
  it("rounds to significant digits", () => {
    expect(roundTo(3.14159265, 4)).toBe(3.142);
  });
  it("returns 0 for 0", () => { expect(roundTo(0)).toBe(0); });
});

describe("constants", () => {
  it("TO_J has 10 units", () => { expect(Object.keys(TO_J).length).toBe(10); });
  it("UNIT_LABELS has 10 units", () => { expect(Object.keys(UNIT_LABELS).length).toBe(10); });
  it("UNIT_TRIVIA has 10 units", () => { expect(Object.keys(UNIT_TRIVIA).length).toBe(10); });
  it("UNIT_CLASS has 10 units", () => { expect(Object.keys(UNIT_CLASS).length).toBe(10); });
  it("PRESETS has 7 entries", () => { expect(PRESETS.length).toBe(7); });
  it("ALL_UNITS has 10 entries", () => { expect(ALL_UNITS.length).toBe(10); });
  it("ALL_CLASSES has 5 entries", () => { expect(ALL_CLASSES.length).toBe(5); });
});
