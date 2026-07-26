import { describe, it, expect } from "vitest";
import {
  fromMm, toMm, printSize, qualityFromDpi, minDpiForGoodPrint,
  maxPrintAt300Dpi, aspectRatio, megapixels, fitsOnPaper,
  validateInput, calculatePrintSize, batchCalculate, statsToCsv,
  PAPER_SIZES, type PrintCalcInput,
} from "./logic";

const BASE: PrintCalcInput = { width: 3000, height: 2000, dpi: 300, unit: "mm" };

describe("fromMm / toMm", () => {
  it("converts mm to inches", () => {
    expect(fromMm(25.4, "in")).toBeCloseTo(1, 5);
  });
  it("converts mm to cm", () => {
    expect(fromMm(10, "cm")).toBeCloseTo(1, 5);
  });
  it("is identity for mm", () => {
    expect(fromMm(100, "mm")).toBe(100);
  });
  it("round-trips inches → mm → inches", () => {
    const mm = toMm(2, "in");
    expect(fromMm(mm, "in")).toBeCloseTo(2, 5);
  });
  it("round-trips cm → mm → cm", () => {
    const mm = toMm(5, "cm");
    expect(fromMm(mm, "cm")).toBeCloseTo(5, 5);
  });
});

describe("printSize", () => {
  it("computes print size in mm", () => {
    const p = printSize(3000, 2000, 300, "mm");
    expect(p.width).toBeCloseTo(254, 1);
    expect(p.height).toBeCloseTo(169.33, 1);
  });
  it("computes print size in inches", () => {
    const p = printSize(3000, 2000, 300, "in");
    expect(p.width).toBeCloseTo(10, 5);
  });
  it("returns 0 for zero DPI", () => {
    expect(printSize(100, 100, 0, "mm")).toEqual({ width: 0, height: 0 });
  });
});

describe("qualityFromDpi", () => {
  it("returns good for ≥300", () => {
    expect(qualityFromDpi(300)).toBe("good");
    expect(qualityFromDpi(600)).toBe("good");
  });
  it("returns fair for 150-299", () => {
    expect(qualityFromDpi(150)).toBe("fair");
    expect(qualityFromDpi(250)).toBe("fair");
  });
  it("returns poor for <150", () => {
    expect(qualityFromDpi(72)).toBe("poor");
  });
});

describe("minDpiForGoodPrint", () => {
  it("computes minimum DPI for given print size", () => {
    const dpi = minDpiForGoodPrint(254, 169, 3000, 2000);
    // For 254mm × 3000px, dpi = 3000 / (254/25.4) = 3000 / 10 = 300
    expect(dpi).toBeGreaterThanOrEqual(250);
    expect(dpi).toBeLessThanOrEqual(350);
  });
  it("returns 300 for invalid dimensions", () => {
    expect(minDpiForGoodPrint(0, 0, 100, 100)).toBe(300);
  });
});

describe("maxPrintAt300Dpi", () => {
  it("computes max print at 300 DPI", () => {
    const p = maxPrintAt300Dpi(3000, 2000, "mm");
    expect(p.width).toBeCloseTo(254, 1);
    expect(p.height).toBeCloseTo(169.33, 1);
  });
  it("computes in inches", () => {
    const p = maxPrintAt300Dpi(3000, 2000, "in");
    expect(p.width).toBeCloseTo(10, 5);
  });
});

describe("aspectRatio / megapixels", () => {
  it("computes aspect ratio", () => {
    expect(aspectRatio(3000, 2000)).toBeCloseTo(1.5, 5);
  });
  it("returns 0 for zero height", () => {
    expect(aspectRatio(100, 0)).toBe(0);
  });
  it("computes megapixels", () => {
    expect(megapixels(3000, 2000)).toBe(6);
  });
});

describe("fitsOnPaper", () => {
  it("fits A4 portrait", () => {
    // A4 = 210 × 297 mm. 200×280 fits.
    expect(fitsOnPaper(200, 280, "A4")).toBe(true);
  });
  it("rejects oversized", () => {
    expect(fitsOnPaper(500, 500, "A4")).toBe(false);
  });
  it("fits with rotation (landscape)", () => {
    // A4 = 210 × 297. 280×200 fits with rotation.
    expect(fitsOnPaper(280, 200, "A4")).toBe(true);
  });
  it("returns false for unknown paper", () => {
    expect(fitsOnPaper(100, 100, "Bogus")).toBe(false);
  });
});

describe("validateInput", () => {
  it("accepts valid input", () => {
    expect(validateInput(BASE)).toEqual({ ok: true });
  });
  it("rejects non-positive dimensions", () => {
    expect(validateInput({ ...BASE, width: 0 })).toHaveProperty("error");
  });
  it("rejects bad DPI", () => {
    expect(validateInput({ ...BASE, dpi: 0 })).toHaveProperty("error");
    expect(validateInput({ ...BASE, dpi: 99999 })).toHaveProperty("error");
  });
  it("rejects unknown unit", () => {
    expect(validateInput({ ...BASE, unit: "bogus" as never })).toHaveProperty("error");
  });
});

describe("calculatePrintSize", () => {
  it("returns full result for valid input", () => {
    const r = calculatePrintSize(BASE);
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.printSize.unit).toBe("mm");
    expect(r.printSize.width).toBeCloseTo(254, 1);
    expect(r.quality).toBe("good");
    expect(r.minDpiForGood).toBeGreaterThan(0);
    expect(r.recommendations.length).toBeGreaterThanOrEqual(0);
  });
  it("errors on bad input", () => {
    expect("error" in calculatePrintSize({ ...BASE, width: 0 })).toBe(true);
  });
  it("warns on low DPI", () => {
    const r = calculatePrintSize({ ...BASE, dpi: 100 });
    if ("error" in r) throw new Error("unexpected");
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.quality).toBe("poor");
  });
  it("recommends better DPI for fair quality", () => {
    const r = calculatePrintSize({ ...BASE, dpi: 200 });
    if ("error" in r) throw new Error("unexpected");
    expect(r.recommendations.length).toBeGreaterThan(0);
  });
  it("stats include megapixels", () => {
    const r = calculatePrintSize(BASE);
    if ("error" in r) throw new Error("unexpected");
    expect(r.stats.megapixels).toBe(6);
  });
});

describe("batchCalculate", () => {
  it("runs over multiple inputs", () => {
    const r = batchCalculate([BASE, BASE]);
    expect(r.length).toBe(2);
  });
});

describe("statsToCsv", () => {
  it("produces CSV with header", () => {
    const r = calculatePrintSize(BASE);
    if ("error" in r) throw new Error("unexpected");
    const csv = statsToCsv(r.stats);
    expect(csv.startsWith("Field,Value")).toBe(true);
    expect(csv).toContain("DPI");
  });
});

describe("PAPER_SIZES", () => {
  it("includes A4, A3, Letter, Legal, Tabloid", () => {
    const names = PAPER_SIZES.map((p) => p.name);
    expect(names).toContain("A3");
    expect(names).toContain("A4");
    expect(names).toContain("Letter");
    expect(names).toContain("Legal");
    expect(names).toContain("Tabloid");
  });
  it("A4 has correct dimensions", () => {
    const a4 = PAPER_SIZES.find((p) => p.name === "A4")!;
    expect(a4.widthMm).toBe(210);
    expect(a4.heightMm).toBe(297);
  });
});
