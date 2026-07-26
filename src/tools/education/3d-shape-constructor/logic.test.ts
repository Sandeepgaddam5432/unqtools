/**
 * 3D Shape Constructor — unit tests.
 */
import { describe, it, expect } from "vitest";
import { calculateShape, resultToText, resultToCsv, netBuildPlan } from "./logic";

describe("calculateShape — cube", () => {
  it("computes surface area 6s²", () => {
    const r = calculateShape({ shape: "cube", side: 3 });
    if ("error" in r) throw new Error("should not error");
    expect(r.surfaceArea).toBe(54);
  });
  it("computes volume s³", () => {
    const r = calculateShape({ shape: "cube", side: 3 });
    if ("error" in r) throw new Error("should not error");
    expect(r.volume).toBe(27);
  });
  it("errors on non-positive side", () => {
    expect("error" in calculateShape({ shape: "cube", side: 0 })).toBe(true);
  });
  it("net has 6 square faces", () => {
    const r = calculateShape({ shape: "cube", side: 2 });
    if ("error" in r) throw new Error("should not error");
    expect(r.net.length).toBe(1);
    expect(r.net[0]!.count).toBe(6);
  });
});

describe("calculateShape — sphere", () => {
  it("computes surface area 4πr²", () => {
    const r = calculateShape({ shape: "sphere", radius: 2 });
    if ("error" in r) throw new Error("should not error");
    expect(r.surfaceArea).toBeCloseTo(4 * Math.PI * 4, 4);
  });
  it("computes volume (4/3)πr³", () => {
    const r = calculateShape({ shape: "sphere", radius: 2 });
    if ("error" in r) throw new Error("should not error");
    expect(r.volume).toBeCloseTo((4 / 3) * Math.PI * 8, 4);
  });
  it("errors on zero radius", () => {
    expect("error" in calculateShape({ shape: "sphere", radius: 0 })).toBe(true);
  });
});

describe("calculateShape — cylinder", () => {
  it("computes surface area 2πr(r+h)", () => {
    const r = calculateShape({ shape: "cylinder", radius: 2, height: 5 });
    if ("error" in r) throw new Error("should not error");
    expect(r.surfaceArea).toBeCloseTo(2 * Math.PI * 2 * (2 + 5), 4);
  });
  it("computes volume πr²h", () => {
    const r = calculateShape({ shape: "cylinder", radius: 2, height: 5 });
    if ("error" in r) throw new Error("should not error");
    expect(r.volume).toBeCloseTo(Math.PI * 4 * 5, 4);
  });
  it("errors when height is zero", () => {
    expect("error" in calculateShape({ shape: "cylinder", radius: 2, height: 0 })).toBe(true);
  });
  it("net has 2 circles + 1 rectangle", () => {
    const r = calculateShape({ shape: "cylinder", radius: 1, height: 4 });
    if ("error" in r) throw new Error("should not error");
    expect(r.net.length).toBe(2);
    expect(r.net.find((n) => n.face === "circle")!.count).toBe(2);
  });
});

describe("calculateShape — cone", () => {
  it("computes slant height √(r²+h²)", () => {
    const r = calculateShape({ shape: "cone", radius: 3, height: 4 });
    if ("error" in r) throw new Error("should not error");
    const slant = r.properties.find((p) => p.name === "Slant height")!;
    expect(slant.value).toBe(5);
  });
  it("computes volume (1/3)πr²h", () => {
    const r = calculateShape({ shape: "cone", radius: 3, height: 4 });
    if ("error" in r) throw new Error("should not error");
    expect(r.volume).toBeCloseTo((1 / 3) * Math.PI * 9 * 4, 4);
  });
  it("net has 1 circle + 1 sector", () => {
    const r = calculateShape({ shape: "cone", radius: 2, height: 3 });
    if ("error" in r) throw new Error("should not error");
    expect(r.net.find((n) => n.face === "circle")!.count).toBe(1);
    expect(r.net.find((n) => n.face === "sector")).toBeDefined();
  });
});

describe("calculateShape — pyramid", () => {
  it("computes surface area b² + 2bℓ", () => {
    const r = calculateShape({ shape: "pyramid", side: 4, height: 3 });
    if ("error" in r) throw new Error("should not error");
    // slant = sqrt(2² + 3²) = sqrt(13); lateral = 2 * 4 * sqrt(13); base = 16
    const slant = Math.sqrt(13);
    expect(r.surfaceArea).toBeCloseTo(16 + 2 * 4 * slant, 4);
  });
  it("computes volume (1/3)b²h", () => {
    const r = calculateShape({ shape: "pyramid", side: 4, height: 3 });
    if ("error" in r) throw new Error("should not error");
    expect(r.volume).toBeCloseTo((1 / 3) * 16 * 3, 4);
  });
  it("net has 1 square + 4 triangles", () => {
    const r = calculateShape({ shape: "pyramid", side: 2, height: 3 });
    if ("error" in r) throw new Error("should not error");
    expect(r.net.find((n) => n.face === "square")!.count).toBe(1);
    expect(r.net.find((n) => n.face === "triangle")!.count).toBe(4);
  });
});

describe("calculateShape — meta", () => {
  it("includes formulas in every result", () => {
    for (const shape of ["cube", "sphere", "cylinder", "cone", "pyramid"] as const) {
      const r = calculateShape({ shape, side: 2, radius: 2, height: 2 });
      if ("error" in r) throw new Error("should not error");
      expect(r.formulas.surface.length).toBeGreaterThan(0);
      expect(r.formulas.volume.length).toBeGreaterThan(0);
    }
  });
  it("errors on unknown shape", () => {
    // @ts-expect-error testing runtime guard
    expect("error" in calculateShape({ shape: "torus" })).toBe(true);
  });
});

describe("exports", () => {
  it("resultToText includes surface area and volume", () => {
    const r = calculateShape({ shape: "cube", side: 2 });
    if ("error" in r) throw new Error("should not error");
    const text = resultToText(r);
    expect(text).toContain("Surface area");
    expect(text).toContain("Volume");
    expect(text).toContain("Net layout");
  });
  it("resultToCsv produces a CSV with header", () => {
    const r = calculateShape({ shape: "cube", side: 2 });
    if ("error" in r) throw new Error("should not error");
    const csv = resultToCsv(r);
    expect(csv.split("\n")[0]).toBe("Property,Value,Unit");
  });
  it("netBuildPlan lists step-by-step instructions", () => {
    const r = calculateShape({ shape: "pyramid", side: 4, height: 3 });
    if ("error" in r) throw new Error("should not error");
    const plan = netBuildPlan(r);
    expect(plan).toContain("Net build plan");
    expect(plan).toContain("Cut");
    expect(plan).toContain("assemble");
  });
});
