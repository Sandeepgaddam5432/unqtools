import { describe, it, expect } from "vitest";
import {
  process, convertAll, convertBatch, toCsv, batchToCsv, swap, normalize,
  normalizeRad, complement, supplement, sinOf, cosOf, tanOf, toDMS, formatDMS,
  cardinal, bestFitUnit, validateOptions, formatAngle, sumAngles, roundTo,
  TO_DEG, UNIT_LABELS, PRESETS, ALL_UNITS, CARDINALS,
} from "./logic";

describe("process — basic", () => {
  it("converts deg to rad", () => {
    const r = process(180, { from: "deg", to: "rad" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(Math.PI, 6);
  });
  it("converts rad to deg", () => {
    const r = process(Math.PI, { from: "rad", to: "deg" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(180, 6);
  });
  it("converts grad to deg", () => {
    const r = process(200, { from: "grad", to: "deg" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(180, 6);
  });
  it("converts turn to deg", () => {
    const r = process(1, { from: "turn", to: "deg" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(360, 6);
  });
  it("converts deg to arcmin", () => {
    const r = process(1, { from: "deg", to: "arcmin" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(60, 6);
  });
  it("converts arcsec to deg", () => {
    const r = process(3600, { from: "arcsec", to: "deg" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(1, 6);
  });
});

describe("process — edge", () => {
  it("errors on NaN", () => {
    expect("error" in process(NaN, { from: "deg", to: "rad" })).toBe(true);
  });
  it("errors on Infinity", () => {
    expect("error" in process(Infinity, { from: "deg", to: "rad" })).toBe(true);
  });
  it("returns same value for same unit", () => {
    const r = process(42, { from: "deg", to: "deg" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(42);
  });
  it("warns on >360 deg", () => {
    const r = process(720, { from: "deg", to: "rad" });
    if ("error" in r) throw new Error("err");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("convertAll", () => {
  it("returns 6 unit conversions", () => {
    expect(convertAll(360, "deg").length).toBe(6);
  });
  it("rad value for 360 deg = 2π", () => {
    const all = convertAll(360, "deg");
    const rad = all.find((r) => r.unit === "rad")!;
    expect(rad.value).toBeCloseTo(2 * Math.PI, 6);
  });
});

describe("convertBatch", () => {
  it("processes multiple inputs", () => {
    const r = convertBatch([90, 180], "deg", "rad");
    expect(r.length).toBe(2);
  });
  it("propagates errors", () => {
    const r = convertBatch([1, NaN], "deg", "rad");
    expect("error" in r[1]!).toBe(true);
  });
});

describe("normalize", () => {
  it("wraps negative angles", () => { expect(normalize(-90)).toBeCloseTo(270, 6); });
  it("wraps over-360 angles", () => { expect(normalize(450)).toBeCloseTo(90, 6); });
  it("keeps 0 as 0", () => { expect(normalize(0)).toBe(0); });
  it("wraps 360 to 0", () => { expect(normalize(360)).toBe(0); });
});

describe("normalizeRad", () => {
  it("wraps negative radians", () => {
    expect(normalizeRad(-Math.PI / 2)).toBeCloseTo(3 * Math.PI / 2, 5);
  });
  it("wraps over-2π radians", () => {
    expect(normalizeRad(3 * Math.PI)).toBeCloseTo(Math.PI, 5);
  });
});

describe("complement + supplement", () => {
  it("complement = 90 − x", () => { expect(complement(30)).toBe(60); });
  it("supplement = 180 − x", () => { expect(supplement(30)).toBe(150); });
});

describe("sinOf + cosOf + tanOf", () => {
  it("sin(30°) = 0.5", () => { expect(sinOf(30, "deg")).toBeCloseTo(0.5, 6); });
  it("cos(60°) = 0.5", () => { expect(cosOf(60, "deg")).toBeCloseTo(0.5, 6); });
  it("tan(45°) = 1", () => {
    const t = tanOf(45, "deg");
    if (typeof t === "object") throw new Error("err");
    expect(t).toBeCloseTo(1, 6);
  });
  it("tan(90°) errors", () => {
    expect(typeof tanOf(90, "deg") === "object").toBe(true);
  });
});

describe("toDMS + formatDMS", () => {
  it("converts 45.5° to 45°30′0″", () => {
    const d = toDMS(45.5);
    expect(d.deg).toBe(45); expect(d.min).toBe(30); expect(d.sec).toBe(0);
  });
  it("handles negative", () => {
    const d = toDMS(-30.25);
    expect(d.sign).toBe("-"); expect(d.deg).toBe(30); expect(d.min).toBe(15);
  });
  it("formats DMS string", () => {
    expect(formatDMS(45.5)).toContain("45°30′");
  });
});

describe("cardinal", () => {
  it("0° = N", () => { expect(cardinal(0)).toBe("N"); });
  it("90° = E", () => { expect(cardinal(90)).toBe("E"); });
  it("180° = S", () => { expect(cardinal(180)).toBe("S"); });
  it("270° = W", () => { expect(cardinal(270)).toBe("W"); });
  it("45° = NE", () => { expect(cardinal(45)).toBe("NE"); });
});

describe("bestFitUnit", () => {
  it("returns arcsec for tiny", () => { expect(bestFitUnit(0.0001)).toBe("arcsec"); });
  it("returns arcmin for small", () => { expect(bestFitUnit(0.01)).toBe("arcmin"); });
  it("returns rad for <1 deg", () => { expect(bestFitUnit(0.5)).toBe("rad"); });
  it("returns deg for moderate", () => { expect(bestFitUnit(45)).toBe("deg"); });
  it("returns deg for 0", () => { expect(bestFitUnit(0)).toBe("deg"); });
});

describe("validateOptions", () => {
  it("accepts valid", () => { expect(validateOptions({ from: "deg", to: "rad" })).toEqual({ ok: true }); });
  it("rejects invalid", () => {
    expect(validateOptions({ from: "bogus" as never, to: "deg" })).toHaveProperty("error");
  });
});

describe("swap", () => {
  it("swaps", () => { expect(swap({ from: "deg", to: "rad" })).toEqual({ from: "rad", to: "deg" }); });
});

describe("formatAngle", () => {
  it("formats with unit", () => { expect(formatAngle(180, "deg")).toBe("180 deg"); });
});

describe("sumAngles", () => {
  it("sums across units", () => {
    const s = sumAngles([{ value: 180, unit: "deg" }, { value: Math.PI, unit: "rad" }], "deg");
    expect(s).toBeCloseTo(360, 5);
  });
});

describe("toCsv + batchToCsv", () => {
  it("toCsv has header", () => {
    expect(toCsv(convertAll(180, "deg")).split("\n")[0]).toBe("Unit,Value");
  });
  it("batchToCsv has header", () => {
    const inputs = [1, 2];
    const results = convertBatch(inputs, "deg", "rad");
    const csv = batchToCsv(inputs, "deg", "rad", results);
    expect(csv.split("\n")[0]).toBe("Input,From,Output,Unit,Warnings");
    expect(csv).toContain("deg");
  });
});

describe("roundTo", () => {
  it("rounds to significant digits", () => { expect(roundTo(3.14159265, 4)).toBe(3.142); });
});

describe("constants", () => {
  it("TO_DEG has 6 units", () => { expect(Object.keys(TO_DEG).length).toBe(6); });
  it("UNIT_LABELS has 6 units", () => { expect(Object.keys(UNIT_LABELS).length).toBe(6); });
  it("ALL_UNITS has 6 units", () => { expect(ALL_UNITS.length).toBe(6); });
  it("CARDINALS has 16 entries", () => { expect(CARDINALS.length).toBe(16); });
  it("PRESETS has 9 entries", () => { expect(PRESETS.length).toBe(9); });
});
