import { describe, it, expect } from "vitest";
import {
  perimeterRectangle, perimeterCircle, perimeterTriangle, perimeterPolygon,
  perimeterEllipse, areaRectangle, areaCircle, areaTriangle, areaPolygon,
  areaEllipse, satisfiesTriangleInequality, convertLength, roundTo,
  validatePerimeterInput, derivePerimeter, computePerimeter, computeBatch,
  batchToCsv, formatResult, perimeterInAllUnits, apothemToSide, FORMULAS,
  SHAPE_LABELS, TO_METERS, UNIT_LABELS, PARAMS,
  type PerimeterInput, type Shape,
} from "./logic";

describe("perimeterRectangle", () => {
  it("computes 2×(l+w)", () => { expect(perimeterRectangle(3, 4)).toBe(14); });
  it("returns 0 for zero dimensions", () => { expect(perimeterRectangle(0, 0)).toBe(0); });
});

describe("perimeterCircle", () => {
  it("computes 2πr", () => { expect(perimeterCircle(1)).toBeCloseTo(2 * Math.PI, 5); });
  it("returns 0 for r=0", () => { expect(perimeterCircle(0)).toBe(0); });
});

describe("perimeterTriangle", () => {
  it("sums sides", () => { expect(perimeterTriangle(3, 4, 5)).toBe(12); });
});

describe("perimeterPolygon", () => {
  it("multiplies side by count", () => { expect(perimeterPolygon(5, 6)).toBe(30); });
});

describe("perimeterEllipse", () => {
  it("returns 0 when both axes are 0", () => { expect(perimeterEllipse(0, 0)).toBe(0); });
  it("approximates circumference of a circle when a=b", () => {
    expect(perimeterEllipse(1, 1)).toBeCloseTo(2 * Math.PI, 1);
  });
});

describe("area functions", () => {
  it("areaRectangle = l×w", () => { expect(areaRectangle(3, 4)).toBe(12); });
  it("areaCircle = πr²", () => { expect(areaCircle(2)).toBeCloseTo(4 * Math.PI, 5); });
  it("areaTriangle 3-4-5 = 6", () => { expect(areaTriangle(3, 4, 5)).toBeCloseTo(6, 5); });
  it("areaPolygon for square side=2 = 4", () => { expect(areaPolygon(2, 4)).toBeCloseTo(4, 5); });
  it("areaEllipse = πab", () => { expect(areaEllipse(2, 3)).toBeCloseTo(6 * Math.PI, 5); });
});

describe("satisfiesTriangleInequality", () => {
  it("valid 3-4-5", () => { expect(satisfiesTriangleInequality(3, 4, 5)).toBe(true); });
  it("invalid 1-2-10", () => { expect(satisfiesTriangleInequality(1, 2, 10)).toBe(false); });
});

describe("convertLength", () => {
  it("converts m to cm", () => { expect(convertLength(1, "m", "cm")).toBe(100); });
  it("converts in to cm", () => { expect(convertLength(1, "in", "cm")).toBeCloseTo(2.54, 4); });
  it("converts km to m", () => { expect(convertLength(1, "km", "m")).toBe(1000); });
});

describe("roundTo", () => {
  it("rounds to 2 decimals", () => { expect(roundTo(3.14159, 2)).toBe(3.14); });
  it("rounds to 0 decimals", () => { expect(roundTo(3.6, 0)).toBe(4); });
});

describe("validatePerimeterInput", () => {
  it("accepts valid rectangle", () => {
    expect(validatePerimeterInput({ shape: "rectangle", values: [3, 4] })).toEqual({ ok: true });
  });
  it("rejects negative values", () => {
    expect(validatePerimeterInput({ shape: "circle", values: [-1] })).toHaveProperty("error");
  });
  it("rejects polygon with too few sides", () => {
    expect(validatePerimeterInput({ shape: "polygon", values: [5, 2] })).toHaveProperty("error");
  });
  it("rejects invalid triangle", () => {
    expect(validatePerimeterInput({ shape: "triangle", values: [1, 2, 10] })).toHaveProperty("error");
  });
});

describe("derivePerimeter", () => {
  it("derives rectangle", () => {
    const d = derivePerimeter({ shape: "rectangle", values: [3, 4] });
    expect(d.length).toBe(3);
    expect(d[2]).toContain("14");
  });
  it("derives circle", () => {
    const d = derivePerimeter({ shape: "circle", values: [1] });
    expect(d[1]).toContain("π");
  });
});

describe("computePerimeter", () => {
  it("computes rectangle with area + formula", () => {
    const r = computePerimeter({ shape: "rectangle", values: [3, 4], unit: "m" });
    expect(r.perimeter).toBe(14); expect(r.area).toBe(12);
    expect(r.formula).toContain("P = 2");
    expect(r.unit).toBe("m");
  });
  it("warns on ellipse when a≠b", () => {
    const r = computePerimeter({ shape: "ellipse", values: [2, 1] });
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("warns on degenerate triangle", () => {
    const r = computePerimeter({ shape: "triangle", values: [1, 2, 3] });
    expect(r.warnings.some((w) => w.includes("Degenerate"))).toBe(true);
  });
});

describe("computeBatch + batchToCsv", () => {
  it("computes multiple inputs", () => {
    const inputs: PerimeterInput[] = [
      { shape: "rectangle", values: [3, 4] },
      { shape: "circle", values: [1] },
    ];
    const results = computeBatch(inputs);
    expect(results.length).toBe(2);
    expect(results[0]!.perimeter).toBe(14);
  });
  it("emits CSV with header + rows", () => {
    const inputs: PerimeterInput[] = [{ shape: "rectangle", values: [3, 4] }];
    const csv = batchToCsv(computeBatch(inputs), inputs);
    expect(csv.split("\n")[0]).toBe("Shape,Unit,Perimeter,Area,Formula");
    expect(csv).toContain("rectangle");
  });
});

describe("formatResult", () => {
  it("includes perimeter, area, formula, derivation", () => {
    const r = computePerimeter({ shape: "rectangle", values: [3, 4] });
    const s = formatResult(r);
    expect(s).toContain("Perimeter: 14");
    expect(s).toContain("Area: 12");
    expect(s).toContain("Formula:");
    expect(s).toContain("Derivation:");
  });
});

describe("perimeterInAllUnits", () => {
  it("returns 8 unit conversions", () => {
    const r = computePerimeter({ shape: "circle", values: [1], unit: "m" });
    const all = perimeterInAllUnits(r);
    expect(all.length).toBe(8);
    const cm = all.find((x) => x.unit === "cm")!;
    expect(cm.value).toBeCloseTo(2 * Math.PI * 100, 1);
  });
});

describe("apothemToSide", () => {
  it("returns 0 for sides < 3", () => { expect(apothemToSide(5, 2)).toBe(0); });
  it("computes side length for square (apothem=1, sides=4)", () => {
    expect(apothemToSide(1, 4)).toBeCloseTo(2, 5);
  });
});

describe("constants", () => {
  it("FORMULAS has all 5 shapes", () => {
    const shapes: Shape[] = ["rectangle", "circle", "triangle", "polygon", "ellipse"];
    for (const s of shapes) expect(typeof FORMULAS[s]).toBe("string");
  });
  it("PARAMS has labels for all shapes", () => {
    expect(PARAMS.rectangle.length).toBe(2);
    expect(PARAMS.circle.length).toBe(1);
    expect(PARAMS.triangle.length).toBe(3);
  });
  it("TO_METERS has 8 units", () => {
    expect(Object.keys(TO_METERS).length).toBe(8);
  });
  it("UNIT_LABELS has 8 units", () => {
    expect(Object.keys(UNIT_LABELS).length).toBe(8);
  });
  it("SHAPE_LABELS has 5 shapes", () => {
    expect(Object.keys(SHAPE_LABELS).length).toBe(5);
  });
});
