import { describe, it, expect } from "vitest";
import {
  areaRectangle,
  areaCircle,
  areaTriangle,
  areaTrapezoid,
  areaEllipse,
  areaParallelogram,
  computeArea,
  computeAreaWithUnit,
  validateAreaInput,
  fillFormula,
  SHAPE_FORMULAS,
  SHAPE_PARAMS,
  convertArea,
  batchCompute,
  batchStats,
  formatArea,
  batchToCsv,
  convertAllToCsv,
  UNIT_LABELS,
  TO_M2,
  type AreaInput,
} from "./logic";

describe("areaRectangle", () => {
  it("computes length × width", () => {
    expect(areaRectangle(4, 5)).toBe(20);
  });
  it("returns 0 if either is 0", () => {
    expect(areaRectangle(0, 5)).toBe(0);
  });
});

describe("areaCircle", () => {
  it("computes πr²", () => {
    expect(areaCircle(1)).toBeCloseTo(Math.PI, 5);
  });
  it("returns 0 for r=0", () => {
    expect(areaCircle(0)).toBe(0);
  });
});

describe("areaTriangle", () => {
  it("computes 0.5 × base × height", () => {
    expect(areaTriangle(10, 6)).toBe(30);
  });
});

describe("areaTrapezoid", () => {
  it("computes 0.5 × (a+b) × h", () => {
    expect(areaTrapezoid(4, 6, 5)).toBe(25);
  });
});

describe("areaEllipse", () => {
  it("computes π × a × b", () => {
    expect(areaEllipse(2, 3)).toBeCloseTo(Math.PI * 6, 5);
  });
});

describe("areaParallelogram", () => {
  it("computes base × height", () => {
    expect(areaParallelogram(7, 4)).toBe(28);
  });
});

describe("computeArea", () => {
  it("dispatches by shape", () => {
    expect(computeArea({ shape: "rectangle", values: [3, 4] })).toBe(12);
    expect(computeArea({ shape: "circle", values: [1] })).toBeCloseTo(Math.PI, 5);
  });
});

describe("validateAreaInput", () => {
  it("accepts valid input", () => {
    expect(validateAreaInput({ shape: "rectangle", values: [3, 4] })).toEqual({ ok: true });
  });
  it("rejects negative", () => {
    expect(validateAreaInput({ shape: "rectangle", values: [-1, 4] })).toHaveProperty("error");
  });
  it("rejects too few dimensions", () => {
    expect(validateAreaInput({ shape: "trapezoid", values: [1, 2] })).toHaveProperty("error");
  });
  it("accepts circle with 1 dimension", () => {
    expect(validateAreaInput({ shape: "circle", values: [3] })).toEqual({ ok: true });
  });
});

describe("fillFormula", () => {
  it("fills rectangle", () => {
    expect(fillFormula("rectangle", [3, 4])).toBe("3 × 4");
  });
  it("fills circle", () => {
    expect(fillFormula("circle", [2])).toBe("π × 2²");
  });
  it("fills trapezoid", () => {
    expect(fillFormula("trapezoid", [4, 6, 5])).toBe("0.5 × (4 + 6) × 5");
  });
  it("uses ? for missing values", () => {
    expect(fillFormula("rectangle", [])).toBe("? × ?");
  });
});

describe("SHAPE_FORMULAS / SHAPE_PARAMS", () => {
  it("covers every shape", () => {
    const shapes: AreaInput["shape"][] = ["rectangle", "circle", "triangle", "trapezoid", "ellipse", "parallelogram"];
    for (const s of shapes) {
      expect(SHAPE_FORMULAS[s]).toBeTruthy();
      expect(SHAPE_PARAMS[s].length).toBeGreaterThan(0);
    }
  });
});

describe("computeAreaWithUnit", () => {
  it("returns formula and unit", () => {
    const r = computeAreaWithUnit({ shape: "rectangle", values: [3, 4] }, "m2");
    if ("error" in r) throw new Error("err");
    expect(r.area).toBe(12);
    expect(r.unit).toBe("m2");
    expect(r.formula).toContain("×");
    expect(r.formulaFilled).toBe("3 × 4");
  });
  it("propagates validation errors", () => {
    expect("error" in computeAreaWithUnit({ shape: "rectangle", values: [-1, 4] }, "m2")).toBe(true);
  });
});

describe("convertArea", () => {
  it("converts m² to cm²", () => {
    expect(convertArea(1, "m2", "cm2")).toBe(10000);
  });
  it("converts ft² to in²", () => {
    expect(convertArea(1, "ft2", "in2")).toBeCloseTo(144, 1);
  });
  it("converts acre to m²", () => {
    expect(convertArea(1, "acre", "m2")).toBeCloseTo(4046.8564, 3);
  });
  it("is identity for same unit", () => {
    expect(convertArea(42, "m2", "m2")).toBe(42);
  });
});

describe("batchCompute", () => {
  it("computes multiple shapes", () => {
    const r = batchCompute([
      { shape: "rectangle", values: [3, 4] },
      { shape: "circle", values: [1] },
    ], "m2");
    expect(r).toHaveLength(2);
    expect(r[0]!.area).toBe(12);
  });
  it("skips invalid rows", () => {
    const r = batchCompute([
      { shape: "rectangle", values: [3, 4] },
      { shape: "rectangle", values: [-1, 4] },
    ], "m2");
    expect(r).toHaveLength(1);
  });
});

describe("batchStats", () => {
  it("aggregates stats", () => {
    const r = batchCompute([
      { shape: "rectangle", values: [3, 4] },
      { shape: "rectangle", values: [2, 2] },
    ], "m2");
    const s = batchStats(r);
    expect(s.count).toBe(2);
    expect(s.total).toBe(16);
    expect(s.mean).toBe(8);
    expect(s.min).toBe(4);
    expect(s.max).toBe(12);
  });
  it("returns zeros for empty batch", () => {
    const s = batchStats([]);
    expect(s.count).toBe(0);
  });
});

describe("formatArea", () => {
  it("formats with unit", () => {
    expect(formatArea(12, "m2")).toBe("12.0000 m2");
  });
  it("returns dash for non-finite", () => {
    expect(formatArea(NaN, "m2")).toBe("—");
  });
});

describe("batchToCsv", () => {
  it("generates CSV with header", () => {
    const r = batchCompute([{ shape: "rectangle", values: [3, 4] }], "m2");
    const csv = batchToCsv(r);
    expect(csv.split("\n")[0]).toBe("Shape,Area,Unit,Formula");
    expect(csv).toContain("rectangle");
    expect(csv).toContain("3 × 4");
  });
});

describe("convertAllToCsv", () => {
  it("lists every unit", () => {
    const csv = convertAllToCsv(1, "m2");
    expect(csv.split("\n")[0]).toBe("Unit,Value");
    expect(csv).toContain("cm2,10000");
    expect(csv).toContain("acre");
  });
});

describe("constants", () => {
  it("has labels for every unit", () => {
    for (const u of Object.keys(TO_M2) as (keyof typeof TO_M2)[]) {
      expect(UNIT_LABELS[u]).toBeTruthy();
    }
  });
});
