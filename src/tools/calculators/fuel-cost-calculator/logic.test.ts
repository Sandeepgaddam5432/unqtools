import { describe, it, expect } from "vitest";
import { process, toCsv } from "./logic";

describe("process — L/100km", () => {
  it("computes fuel cost for L/100km", () => {
    const r = process({ distance: 100, fuelPricePerLiter: 1.5, consumption: 8, consumptionUnit: "l100km" });
    if ("error" in r) throw new Error("err");
    expect(r.litersUsed).toBe(8);
    expect(r.fuelCost).toBeCloseTo(12, 5);
  });
  it("computes CO2", () => {
    const r = process({ distance: 100, fuelPricePerLiter: 1.5, consumption: 8, consumptionUnit: "l100km" });
    if ("error" in r) throw new Error("err");
    expect(r.co2Kg).toBeCloseTo(8 * 2.31, 2);
  });
});

describe("process — kmpl", () => {
  it("converts kmpl to liters used", () => {
    // 12.5 km/l over 100 km → 8 L
    const r = process({ distance: 100, fuelPricePerLiter: 1, consumption: 12.5, consumptionUnit: "kmpl" });
    if ("error" in r) throw new Error("err");
    expect(r.litersUsed).toBeCloseTo(8, 5);
  });
});

describe("process — mpg", () => {
  it("converts mpg to L/100km equivalent", () => {
    // 30 mpg ≈ 7.84 L/100km
    const r = process({ distance: 100, fuelPricePerLiter: 1, consumption: 30, consumptionUnit: "mpg" });
    if ("error" in r) throw new Error("err");
    expect(r.equivalentL100km).toBeCloseTo(7.84, 1);
  });
  it("computes equivalent mpg from L/100km", () => {
    const r = process({ distance: 100, fuelPricePerLiter: 1, consumption: 8, consumptionUnit: "l100km" });
    if ("error" in r) throw new Error("err");
    expect(r.equivalentMpg).toBeCloseTo(29.4, 0);
  });
});

describe("process — errors", () => {
  it("errors on negative distance", () => {
    const r = process({ distance: -10, fuelPricePerLiter: 1, consumption: 8, consumptionUnit: "l100km" });
    expect("error" in r).toBe(true);
  });
  it("errors on zero consumption", () => {
    const r = process({ distance: 100, fuelPricePerLiter: 1, consumption: 0, consumptionUnit: "l100km" });
    expect("error" in r).toBe(true);
  });
});

describe("toCsv", () => {
  it("generates CSV", () => {
    const r = process({ distance: 100, fuelPricePerLiter: 1.5, consumption: 8, consumptionUnit: "l100km" });
    if ("error" in r) throw new Error("err");
    const csv = toCsv(r, 100);
    expect(csv.split("\n")[0]).toBe("Metric,Value");
    expect(csv).toContain("Distance (km),100");
  });
});
