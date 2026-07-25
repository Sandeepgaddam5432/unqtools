import { describe, it, expect } from "vitest";
import { process, convertAll, toCsv, UNIT_LABELS } from "./logic";

describe("process — basic", () => {
  it("converts N to dyn", () => {
    const r = process(1, { from: "N", to: "dyn" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(100000);
  });

  it("converts kgf to N", () => {
    const r = process(1, { from: "kgf", to: "N" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(9.80665, 5);
  });

  it("converts lbf to N", () => {
    const r = process(1, { from: "lbf", to: "N" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(4.4482216152605, 6);
  });

  it("converts kip to lbf", () => {
    const r = process(1, { from: "kip", to: "lbf" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(1000, 3);
  });

  it("converts poundal to N", () => {
    const r = process(1, { from: "poundal", to: "N" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(0.138254954376, 8);
  });

  it("converts dyn to N", () => {
    const r = process(100000, { from: "dyn", to: "N" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(1, 6);
  });
});

describe("process — edge", () => {
  it("warns on negative", () => {
    const r = process(-5, { from: "N", to: "lbf" });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("errors on NaN", () => {
    const r = process(NaN, { from: "N", to: "kgf" });
    expect("error" in r).toBe(true);
  });

  it("returns same value for same unit", () => {
    const r = process(42, { from: "N", to: "N" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(42);
  });
});

describe("convertAll", () => {
  it("returns all unit conversions", () => {
    const all = convertAll(1, "N");
    expect(all.length).toBeGreaterThanOrEqual(6);
    const dyn = all.find((r) => r.unit === "dyn")!;
    expect(dyn.value).toBe(100000);
  });
});

describe("toCsv", () => {
  it("generates CSV with header", () => {
    const csv = toCsv(convertAll(1, "N"));
    expect(csv.split("\n")[0]).toBe("Unit,Value");
    expect(csv).toContain("dyn,100000");
  });
});

describe("UNIT_LABELS", () => {
  it("has labels for every unit", () => {
    expect(Object.keys(UNIT_LABELS).length).toBeGreaterThanOrEqual(6);
  });
});
