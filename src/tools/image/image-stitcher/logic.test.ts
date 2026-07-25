import { describe, it, expect } from "vitest";
import {
  computeLayout, applyAlignment, applyPadding, summarize,
  validateHexColor, gridLayout, batchValidate, layoutToCsv,
  totalArea, sourceArea, scaleToFit, fmt,
} from "./logic";
import type { AlignOption } from "./logic";

const imgs = [{ width: 100, height: 50 }, { width: 200, height: 80 }];

describe("computeLayout — horizontal", () => {
  it("sums widths, uses max height", () => {
    const r = computeLayout(imgs, "horizontal");
    if ("error" in r) throw new Error("err");
    expect(r.width).toBe(300);
    expect(r.height).toBe(80);
    expect(r.positions[0]).toEqual({ x: 0, y: 0, width: 100, height: 50 });
    expect(r.positions[1]).toEqual({ x: 100, y: 0, width: 200, height: 80 });
  });
  it("handles single image", () => {
    const r = computeLayout([{ width: 50, height: 50 }], "horizontal");
    if ("error" in r) throw new Error("err");
    expect(r.width).toBe(50);
    expect(r.height).toBe(50);
  });
  it("applies gap between images", () => {
    const r = computeLayout(imgs, "horizontal", 10);
    if ("error" in r) throw new Error("err");
    expect(r.width).toBe(310);
    expect(r.positions[1]!.x).toBe(110);
  });
});

describe("computeLayout — vertical", () => {
  it("sums heights, uses max width", () => {
    const r = computeLayout(imgs, "vertical");
    if ("error" in r) throw new Error("err");
    expect(r.width).toBe(200);
    expect(r.height).toBe(130);
    expect(r.positions[1]).toEqual({ x: 0, y: 50, width: 200, height: 80 });
  });
  it("applies gap between images", () => {
    const r = computeLayout(imgs, "vertical", 10);
    if ("error" in r) throw new Error("err");
    expect(r.height).toBe(140);
  });
});

describe("computeLayout — errors", () => {
  it("errors on empty input", () => {
    expect("error" in computeLayout([], "horizontal")).toBe(true);
  });
  it("errors on zero dimensions", () => {
    expect("error" in computeLayout([{ width: 0, height: 100 }], "horizontal")).toBe(true);
  });
  it("errors on negative gap", () => {
    expect("error" in computeLayout(imgs, "horizontal", -1)).toBe(true);
  });
});

describe("applyAlignment", () => {
  const layout = computeLayout([{ width: 100, height: 50 }, { width: 100, height: 80 }], "horizontal");
  if ("error" in layout) throw new Error("bad layout");

  it("center aligns vertically", () => {
    const r = applyAlignment(layout, "horizontal", "center" as AlignOption);
    expect(r.positions[0]!.y).toBe(15);
    expect(r.positions[1]!.y).toBe(0);
  });
  it("end aligns to bottom", () => {
    const r = applyAlignment(layout, "horizontal", "end" as AlignOption);
    expect(r.positions[0]!.y).toBe(30);
  });
  it("start aligns to top", () => {
    const r = applyAlignment(layout, "horizontal", "start" as AlignOption);
    expect(r.positions[0]!.y).toBe(0);
  });
});

describe("applyPadding", () => {
  it("applies padding around canvas", () => {
    const layout = computeLayout([{ width: 100, height: 100 }], "horizontal");
    if ("error" in layout) throw new Error("err");
    const padded = applyPadding(layout, 20);
    if ("error" in padded) throw new Error("err");
    expect(padded.width).toBe(140);
    expect(padded.height).toBe(140);
    expect(padded.positions[0]!.x).toBe(20);
  });
  it("errors on negative padding", () => {
    const layout = computeLayout([{ width: 100, height: 100 }], "horizontal");
    if ("error" in layout) throw new Error("err");
    expect("error" in applyPadding(layout, -1)).toBe(true);
  });
});

describe("summarize", () => {
  it("returns a readable summary", () => {
    expect(summarize([{ width: 100, height: 50 }], "horizontal")).toContain("100×50px");
    expect(summarize([{ width: 100, height: 50 }], "horizontal")).toContain("1 images");
  });
  it("errors cleanly on empty", () => {
    expect(summarize([], "horizontal")).toMatch(/Need|error/i);
  });
});

describe("validateHexColor", () => {
  it("accepts #RRGGBB", () => {
    expect(validateHexColor("#FF8000")).toEqual({ ok: true, r: 255, g: 128, b: 0 });
  });
  it("accepts #RGB (short form)", () => {
    expect(validateHexColor("#F80")).toEqual({ ok: true, r: 255, g: 136, b: 0 });
  });
  it("accepts hex without #", () => {
    expect(validateHexColor("FF8000").ok).toBe(true);
  });
  it("rejects invalid hex", () => {
    expect(validateHexColor("xyz")).toHaveProperty("error");
  });
});

describe("gridLayout", () => {
  it("arranges images in a grid", () => {
    const r = gridLayout([{ width: 50, height: 50 }, { width: 50, height: 50 }, { width: 50, height: 50 }, { width: 50, height: 50 }], 2);
    if ("error" in r) throw new Error("err");
    expect(r.width).toBe(100);
    expect(r.height).toBe(100);
    expect(r.positions).toHaveLength(4);
  });
  it("applies gap between cells", () => {
    const r = gridLayout([{ width: 50, height: 50 }, { width: 50, height: 50 }], 2, 10);
    if ("error" in r) throw new Error("err");
    expect(r.width).toBe(110);
  });
  it("errors on empty input", () => {
    expect("error" in gridLayout([], 2)).toBe(true);
  });
  it("errors on non-positive cols", () => {
    expect("error" in gridLayout([{ width: 50, height: 50 }], 0)).toBe(true);
  });
});

describe("batchValidate", () => {
  it("returns ok:true for valid images", () => {
    const r = batchValidate([{ width: 100, height: 100 }]);
    expect(r[0]!.ok).toBe(true);
  });
  it("flags invalid dimensions", () => {
    const r = batchValidate([{ width: 0, height: 100 }]);
    expect(r[0]!.ok).toBe(false);
  });
});

describe("layoutToCsv", () => {
  it("renders CSV with header", () => {
    const layout = computeLayout(imgs, "horizontal");
    if ("error" in layout) throw new Error("err");
    const csv = layoutToCsv(layout);
    expect(csv.split("\n")[0]).toBe("index,x,y,width,height");
    expect(csv).toContain("0,0,0,100,50");
  });
});

describe("totalArea / sourceArea", () => {
  it("computes canvas area", () => {
    const layout = computeLayout(imgs, "horizontal");
    if ("error" in layout) throw new Error("err");
    expect(totalArea(layout)).toBe(300 * 80);
  });
  it("computes source area sum", () => {
    expect(sourceArea(imgs)).toBe(100 * 50 + 200 * 80);
  });
});

describe("scaleToFit", () => {
  it("scales down to fit", () => {
    const layout = computeLayout([{ width: 200, height: 100 }], "horizontal");
    if ("error" in layout) throw new Error("err");
    expect(scaleToFit(layout, 100, 100)).toBeCloseTo(0.5, 2);
  });
  it("returns 1 when layout fits", () => {
    const layout = computeLayout([{ width: 50, height: 50 }], "horizontal");
    if ("error" in layout) throw new Error("err");
    expect(scaleToFit(layout, 100, 100)).toBe(1);
  });
});

describe("fmt", () => {
  it("trims precision", () => {
    expect(fmt(1.23456, 2)).toBe("1.23");
  });
  it("em-dash for NaN", () => {
    expect(fmt(NaN)).toBe("—");
  });
});
