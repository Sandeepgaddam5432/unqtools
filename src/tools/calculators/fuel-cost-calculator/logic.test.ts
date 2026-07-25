import { describe, it, expect } from "vitest";
import {
  process, toCsv, toL100km, l100kmToMpg, l100kmToKmpl, mpgToL100km,
  compareVehicles, comparisonToCsv, convertCurrency, batchProcess,
  formatCurrency, fmt, CURRENCY_SYMBOL, CO2_BY_FUEL, CURRENCY_RATES,
} from "./logic";

describe("process — L/100km", () => {
  it("computes fuel cost for L/100km", () => {
    const r = process({ distance: 100, fuelPricePerLiter: 1.5, consumption: 8, consumptionUnit: "l100km" });
    if ("error" in r) throw new Error("err");
    expect(r.litersUsed).toBe(8);
    expect(r.fuelCost).toBeCloseTo(12, 5);
  });
  it("computes CO2 with default 2.31 kg/L", () => {
    const r = process({ distance: 100, fuelPricePerLiter: 1.5, consumption: 8, consumptionUnit: "l100km" });
    if ("error" in r) throw new Error("err");
    expect(r.co2Kg).toBeCloseTo(8 * 2.31, 2);
  });
  it("computes cost per km", () => {
    const r = process({ distance: 100, fuelPricePerLiter: 1.5, consumption: 8, consumptionUnit: "l100km" });
    if ("error" in r) throw new Error("err");
    expect(r.costPerKm).toBeCloseTo(0.12, 5);
  });
});

describe("process — kmpl", () => {
  it("converts kmpl to liters used", () => {
    const r = process({ distance: 100, fuelPricePerLiter: 1, consumption: 12.5, consumptionUnit: "kmpl" });
    if ("error" in r) throw new Error("err");
    expect(r.litersUsed).toBeCloseTo(8, 5);
  });
});

describe("process — mpg", () => {
  it("converts mpg to L/100km equivalent", () => {
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
  it("errors on negative price", () => {
    const r = process({ distance: 100, fuelPricePerLiter: -1, consumption: 8, consumptionUnit: "l100km" });
    expect("error" in r).toBe(true);
  });
  it("warns on high fuel use", () => {
    const r = process({ distance: 1000, fuelPricePerLiter: 1, consumption: 20, consumptionUnit: "l100km" });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("toL100km / mpgToL100km / conversions", () => {
  it("L/100km is identity", () => {
    expect(toL100km(8, "l100km")).toBe(8);
  });
  it("kmpl → L/100km", () => {
    expect(toL100km(12.5, "kmpl")).toBeCloseTo(8, 5);
  });
  it("mpg → L/100km", () => {
    expect(toL100km(30, "mpg")).toBeCloseTo(7.84, 1);
  });
  it("errors on zero consumption", () => {
    expect(toL100km(0, "l100km")).toHaveProperty("error");
  });
  it("l100kmToMpg inverts mpgToL100km", () => {
    const l = mpgToL100km(30);
    if (typeof l === "number") expect(l100kmToMpg(l)).toBeCloseTo(30, 1);
  });
  it("l100kmToKmpl", () => {
    expect(l100kmToKmpl(8)).toBeCloseTo(12.5, 1);
  });
});

describe("compareVehicles", () => {
  it("returns cheapest and cleanest", () => {
    const c = compareVehicles([
      { name: "Car A", consumption: 8, unit: "l100km", pricePerLiter: 1.5 },
      { name: "Car B", consumption: 6, unit: "l100km", pricePerLiter: 1.5 },
    ], 500);
    if ("error" in c) throw new Error("err");
    expect(c.cheapest).toBe("Car B");
    expect(c.cleanest).toBe("Car B");
  });
  it("errors on empty list", () => {
    expect(compareVehicles([], 100)).toHaveProperty("error");
  });
});

describe("comparisonToCsv", () => {
  it("renders CSV with header", () => {
    const c = compareVehicles([
      { name: "A", consumption: 8, unit: "l100km", pricePerLiter: 1.5 },
      { name: "B", consumption: 6, unit: "l100km", pricePerLiter: 1.5 },
    ], 100);
    if ("error" in c) throw new Error("err");
    const csv = comparisonToCsv(c);
    expect(csv.split("\n")[0]).toBe("Vehicle,Liters used,Fuel cost,CO2 (kg)");
    expect(csv).toContain("Cheapest");
  });
});

describe("convertCurrency", () => {
  it("converts USD to EUR", () => {
    const v = convertCurrency(100, "USD", "EUR");
    if (typeof v === "number") expect(v).toBeCloseTo(92, 0);
  });
  it("errors on unknown currency", () => {
    expect(convertCurrency(100, "USD", "XXX" as never)).toHaveProperty("error");
  });
});

describe("batchProcess", () => {
  it("returns result per trip", () => {
    const r = batchProcess([
      { distance: 100, fuelPricePerLiter: 1.5, consumption: 8, consumptionUnit: "l100km" },
      { distance: -1, fuelPricePerLiter: 1, consumption: 8, consumptionUnit: "l100km" },
    ]);
    expect(r).toHaveLength(2);
    expect("error" in r[1]!.result).toBe(true);
  });
});

describe("formatCurrency / fmt", () => {
  it("formats with USD symbol", () => {
    expect(formatCurrency(12.5, "USD")).toBe("$12.50");
  });
  it("formats with EUR symbol", () => {
    expect(formatCurrency(12.5, "EUR")).toBe("€12.50");
  });
  it("em-dash for non-finite", () => {
    expect(formatCurrency(NaN, "USD")).toBe("—");
  });
  it("fmt trims precision", () => {
    expect(fmt(1.23456, 2)).toBe("1.23");
  });
});

describe("CURRENCY_SYMBOL / CO2_BY_FUEL / CURRENCY_RATES", () => {
  it("has 8 currencies", () => {
    expect(Object.keys(CURRENCY_SYMBOL).length).toBe(8);
  });
  it("CO2_BY_FUEL has gasoline and diesel", () => {
    expect(CO2_BY_FUEL.gasoline).toBeGreaterThan(0);
    expect(CO2_BY_FUEL.diesel).toBeGreaterThan(CO2_BY_FUEL.gasoline);
  });
  it("USD rate is 1", () => {
    expect(CURRENCY_RATES.USD).toBe(1);
  });
});
