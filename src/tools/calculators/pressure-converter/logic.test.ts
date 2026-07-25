import { describe, it, expect } from "vitest";
import { process, convertAll, toCsv, UNIT_LABELS } from "./logic";

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
});

describe("process — edge", () => {
  it("warns on negative", () => {
    const r = process(-5, { from: "Pa", to: "kPa" });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("errors on NaN", () => {
    const r = process(NaN, { from: "Pa", to: "psi" });
    expect("error" in r).toBe(true);
  });

  it("returns same value for same unit", () => {
    const r = process(42, { from: "Pa", to: "Pa" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(42);
  });
});

describe("convertAll", () => {
  it("returns all unit conversions", () => {
    const all = convertAll(1, "atm");
    expect(all.length).toBeGreaterThanOrEqual(8);
    const pa = all.find((r) => r.unit === "Pa")!;
    expect(pa.value).toBeCloseTo(101325, 0);
  });
});

describe("toCsv", () => {
  it("generates CSV with header", () => {
    const csv = toCsv(convertAll(1, "atm"));
    expect(csv.split("\n")[0]).toBe("Unit,Value");
    expect(csv).toContain("Pa,101325");
  });
});

describe("UNIT_LABELS", () => {
  it("has labels for every unit", () => {
    expect(Object.keys(UNIT_LABELS).length).toBeGreaterThanOrEqual(8);
  });
});
