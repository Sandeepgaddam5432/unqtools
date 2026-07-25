import { describe, it, expect } from "vitest";
import { process, convertAll, toCsv, UNIT_LABELS } from "./logic";

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
    expect(r.output).toBeCloseTo(1055.05585262, 4);
  });

  it("converts ft_lb to J", () => {
    const r = process(1, { from: "ft_lb", to: "J" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBeCloseTo(1.3558179483314004, 8);
  });

  it("converts kWh to Wh", () => {
    const r = process(1, { from: "kWh", to: "Wh" });
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
    const r = process(NaN, { from: "J", to: "kWh" });
    expect("error" in r).toBe(true);
  });

  it("returns same value for same unit", () => {
    const r = process(42, { from: "J", to: "J" });
    if ("error" in r) throw new Error("err");
    expect(r.output).toBe(42);
  });
});

describe("convertAll", () => {
  it("returns all unit conversions", () => {
    const all = convertAll(1, "J");
    expect(all.length).toBeGreaterThanOrEqual(7);
    const cal = all.find((r) => r.unit === "cal")!;
    expect(cal.value).toBeCloseTo(1 / 4.184, 6);
  });
});

describe("toCsv", () => {
  it("generates CSV with header", () => {
    const csv = toCsv(convertAll(1, "kWh"));
    expect(csv.split("\n")[0]).toBe("Unit,Value");
    expect(csv).toContain("J,3600000");
  });
});

describe("UNIT_LABELS", () => {
  it("has labels for every unit", () => {
    expect(Object.keys(UNIT_LABELS).length).toBeGreaterThanOrEqual(7);
  });
});
