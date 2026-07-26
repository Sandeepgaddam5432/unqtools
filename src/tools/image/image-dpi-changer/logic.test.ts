import { describe, it, expect } from "vitest";
import {
  convertDpi,
  pixelsFromInches,
  printSizeInches,
  inchesToCm,
  inchesToMm,
  qualityFromDpi,
  aspectRatio,
  megapixels,
  validateInput,
  changeDpi,
  batchChangeDpi,
  statsToCsv,
  suggestDpi,
  DPI_PRESETS,
  PRINT_SIZES,
  type DpiChangeInput,
} from "./logic";

const BASE: DpiChangeInput = { width: 3000, height: 2000, targetDpi: 300, metadataOnly: true };

describe("convertDpi", () => {
  it("is identity for same unit", () => {
    expect(convertDpi(300, "dpi", "dpi")).toBe(300);
  });
  it("converts DPI → DPCM", () => {
    expect(convertDpi(300, "dpi", "dpcm")).toBeCloseTo(300 / 2.54, 3);
  });
  it("converts DPCM → DPMM", () => {
    expect(convertDpi(100, "dpcm", "dpmm")).toBeCloseTo(10, 5);
  });
  it("converts DPMM → DPI", () => {
    expect(convertDpi(10, "dpmm", "dpi")).toBeCloseTo(254, 1);
  });
});

describe("pixelsFromInches", () => {
  it("computes pixels from inches and DPI", () => {
    expect(pixelsFromInches(8, 10, 300)).toEqual({ width: 2400, height: 3000 });
  });
});

describe("printSizeInches", () => {
  it("computes print size from pixels and DPI", () => {
    const p = printSizeInches(3000, 2000, 300);
    expect(p.width).toBeCloseTo(10, 5);
    expect(p.height).toBeCloseTo(6.6667, 3);
  });
  it("returns 0 for zero DPI", () => {
    expect(printSizeInches(100, 100, 0)).toEqual({ width: 0, height: 0 });
  });
});

describe("inchesToCm / inchesToMm", () => {
  it("converts inches to cm", () => {
    expect(inchesToCm(1)).toBeCloseTo(2.54, 5);
  });
  it("converts inches to mm", () => {
    expect(inchesToMm(1)).toBeCloseTo(25.4, 5);
  });
});

describe("qualityFromDpi", () => {
  it("returns good for ≥300", () => {
    expect(qualityFromDpi(300)).toBe("good");
    expect(qualityFromDpi(600)).toBe("good");
  });
  it("returns fair for 150-299", () => {
    expect(qualityFromDpi(150)).toBe("fair");
    expect(qualityFromDpi(200)).toBe("fair");
  });
  it("returns poor for <150", () => {
    expect(qualityFromDpi(72)).toBe("poor");
    expect(qualityFromDpi(100)).toBe("poor");
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

describe("validateInput", () => {
  it("accepts valid input", () => {
    expect(validateInput(BASE)).toEqual({ ok: true });
  });
  it("rejects non-positive dimensions", () => {
    expect(validateInput({ ...BASE, width: 0, height: 0 })).toHaveProperty("error");
  });
  it("rejects bad DPI", () => {
    expect(validateInput({ ...BASE, targetDpi: 0 })).toHaveProperty("error");
    expect(validateInput({ ...BASE, targetDpi: 99999 })).toHaveProperty("error");
  });
});

describe("changeDpi", () => {
  it("metadata-only mode keeps pixel dimensions", () => {
    const r = changeDpi({ ...BASE, metadataOnly: true });
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.width).toBe(3000);
    expect(r.height).toBe(2000);
    expect(r.resampled).toBe(false);
  });
  it("metadata-only mode computes print size correctly", () => {
    const r = changeDpi({ ...BASE, metadataOnly: true });
    if ("error" in r) throw new Error("unexpected");
    expect(r.printSizeInches.width).toBeCloseTo(10, 3);
    expect(r.printSizeInches.height).toBeCloseTo(6.6667, 3);
  });
  it("resample mode changes pixel dimensions", () => {
    const r = changeDpi({ ...BASE, metadataOnly: false, targetDpi: 600 });
    if ("error" in r) throw new Error("unexpected");
    expect(r.resampled).toBe(true);
    expect(r.width).toBeGreaterThan(3000);
  });
  it("resample with explicit targets", () => {
    const r = changeDpi({ ...BASE, metadataOnly: false, targetWidth: 1000, targetHeight: 500 });
    if ("error" in r) throw new Error("unexpected");
    expect(r.width).toBe(1000);
    expect(r.height).toBe(500);
  });
  it("returns error on bad input", () => {
    expect("error" in changeDpi({ ...BASE, width: 0, height: 0 })).toBe(true);
  });
  it("warns on low DPI", () => {
    const r = changeDpi({ ...BASE, targetDpi: 50 });
    if ("error" in r) throw new Error("unexpected");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("computes quality from target DPI", () => {
    const r = changeDpi({ ...BASE, targetDpi: 300 });
    if ("error" in r) throw new Error("unexpected");
    expect(r.quality).toBe("good");
  });
  it("stats include megapixels and aspect ratio", () => {
    const r = changeDpi(BASE);
    if ("error" in r) throw new Error("unexpected");
    expect(r.stats.megapixels).toBe(6);
    expect(r.stats.aspectRatio).toBeCloseTo(1.5, 3);
  });
});

describe("batchChangeDpi", () => {
  it("runs over multiple inputs", () => {
    const r = batchChangeDpi([BASE, BASE]);
    expect(r.length).toBe(2);
  });
});

describe("statsToCsv", () => {
  it("produces CSV with header", () => {
    const r = changeDpi(BASE);
    if ("error" in r) throw new Error("unexpected");
    const csv = statsToCsv(r.stats);
    expect(csv.startsWith("Field,Value")).toBe(true);
    expect(csv).toContain("DPI");
    expect(csv).toContain("Megapixels");
  });
});

describe("suggestDpi", () => {
  it("returns ≥300 for very close viewing", () => {
    expect(suggestDpi(1)).toBeGreaterThanOrEqual(300);
  });
  it("returns smaller DPI for far viewing", () => {
    const close = suggestDpi(2);
    const far = suggestDpi(20);
    expect(far).toBeLessThan(close);
  });
  it("returns 300 for invalid distance", () => {
    expect(suggestDpi(0)).toBe(300);
  });
});

describe("DPI_PRESETS", () => {
  it("has 6 presets", () => {
    expect(DPI_PRESETS.length).toBe(6);
  });
  it("includes 72, 96, 300, 600, 1200", () => {
    const values = DPI_PRESETS.map((p) => p.value);
    expect(values).toContain(72);
    expect(values).toContain(96);
    expect(values).toContain(300);
    expect(values).toContain(600);
    expect(values).toContain(1200);
  });
});

describe("PRINT_SIZES", () => {
  it("has multiple sizes", () => {
    expect(PRINT_SIZES.length).toBeGreaterThanOrEqual(5);
  });
  it("includes Letter and Tabloid", () => {
    expect(PRINT_SIZES.some((p) => p.name.includes("Letter"))).toBe(true);
    expect(PRINT_SIZES.some((p) => p.name.includes("Tabloid"))).toBe(true);
  });
});
