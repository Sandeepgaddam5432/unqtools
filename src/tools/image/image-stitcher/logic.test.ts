import { describe, it, expect } from "vitest";
import {
  computeLayout,
  applyAlignment,
  summarize,
  type AlignOption,
} from "./logic";

describe("computeLayout — horizontal", () => {
  it("sums widths, uses max height", () => {
    const r = computeLayout(
      [
        { width: 100, height: 50 },
        { width: 200, height: 80 },
      ],
      "horizontal",
    );
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
});

describe("computeLayout — vertical", () => {
  it("sums heights, uses max width", () => {
    const r = computeLayout(
      [
        { width: 100, height: 50 },
        { width: 200, height: 80 },
      ],
      "vertical",
    );
    if ("error" in r) throw new Error("err");
    expect(r.width).toBe(200);
    expect(r.height).toBe(130);
    expect(r.positions[1]).toEqual({ x: 0, y: 50, width: 200, height: 80 });
  });
});

describe("computeLayout — errors", () => {
  it("errors on empty input", () => {
    expect("error" in computeLayout([], "horizontal")).toBe(true);
  });

  it("errors on zero dimensions", () => {
    expect("error" in computeLayout([{ width: 0, height: 100 }], "horizontal")).toBe(true);
  });
});

describe("applyAlignment", () => {
  const layout = computeLayout(
    [
      { width: 100, height: 50 },
      { width: 100, height: 80 },
    ],
    "horizontal",
  );
  if ("error" in layout) throw new Error("bad layout");

  it("center aligns vertically", () => {
    const r = applyAlignment(layout, "horizontal", "center" as AlignOption);
    expect(r.positions[0].y).toBe(15); // (80-50)/2
    expect(r.positions[1].y).toBe(0);
  });

  it("end aligns to bottom", () => {
    const r = applyAlignment(layout, "horizontal", "end" as AlignOption);
    expect(r.positions[0].y).toBe(30); // 80-50
    expect(r.positions[1].y).toBe(0);
  });

  it("start aligns to top", () => {
    const r = applyAlignment(layout, "horizontal", "start" as AlignOption);
    expect(r.positions[0].y).toBe(0);
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
