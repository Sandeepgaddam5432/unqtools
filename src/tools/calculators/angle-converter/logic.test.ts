import { describe, it, expect } from "vitest";
import { process, convertAll, normalize, toCsv, UNIT_LABELS } from "./logic";

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
    const r = process(NaN, { from: "deg", to: "rad" });
    expect("error" in r).toBe(true);
  });

  it("returns same value for same unit", () => {
    const r = process(42, { from: "deg", to: "deg" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(42);
  });
});

describe("convertAll", () => {
  it("returns all unit conversions", () => {
    const all = convertAll(360, "deg");
    expect(all.length).toBeGreaterThanOrEqual(6);
    const rad = all.find((r) => r.unit === "rad")!;
    expect(rad.value).toBeCloseTo(2 * Math.PI, 6);
  });
});

describe("normalize", () => {
  it("wraps negative angles", () => {
    expect(normalize(-90)).toBeCloseTo(270, 6);
  });

  it("wraps over-360 angles", () => {
    expect(normalize(450)).toBeCloseTo(90, 6);
  });
});

describe("toCsv", () => {
  it("generates CSV with header", () => {
    const csv = toCsv(convertAll(180, "deg"));
    expect(csv.split("\n")[0]).toBe("Unit,Value");
  });
});

describe("UNIT_LABELS", () => {
  it("has labels for every unit", () => {
    expect(Object.keys(UNIT_LABELS).length).toBeGreaterThanOrEqual(6);
  });
});
