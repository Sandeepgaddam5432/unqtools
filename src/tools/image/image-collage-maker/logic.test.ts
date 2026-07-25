import { describe, it, expect } from "vitest";
import { computeCollageLayout, fitContain, fitCover, COLLAGE_PRESETS } from "./logic";

describe("computeCollageLayout", () => {
  it("computes a 2x2 grid", () => {
    const r = computeCollageLayout({
      imageCount: 4,
      columns: 2,
      canvasWidth: 1000,
      canvasHeight: 1000,
      gap: 10,
    });
    expect(r).toMatchObject({ rows: 2, columns: 2 });
    expect((r as { cells: unknown[] }).cells.length).toBe(4);
  });

  it("handles partial last row", () => {
    const r = computeCollageLayout({
      imageCount: 5,
      columns: 2,
      canvasWidth: 1000,
      canvasHeight: 1000,
      gap: 10,
    });
    expect((r as { rows: number }).rows).toBe(3);
    expect((r as { cells: unknown[] }).cells.length).toBe(5);
  });

  it("respects gap", () => {
    const r = computeCollageLayout({
      imageCount: 2,
      columns: 2,
      canvasWidth: 220,
      canvasHeight: 100,
      gap: 20,
    });
    const cell0 = (r as { cells: { x: number; width: number }[] }).cells[0];
    const cell1 = (r as { cells: { x: number; width: number }[] }).cells[1];
    expect(cell0.x).toBe(20);
    expect(cell1.x - (cell0.x + cell0.width)).toBe(20);
  });

  it("errors on non-positive image count", () => {
    expect(
      computeCollageLayout({ imageCount: 0, columns: 2, canvasWidth: 100, canvasHeight: 100, gap: 0 }),
    ).toHaveProperty("error");
  });

  it("errors on non-positive columns", () => {
    expect(
      computeCollageLayout({ imageCount: 4, columns: 0, canvasWidth: 100, canvasHeight: 100, gap: 0 }),
    ).toHaveProperty("error");
  });

  it("errors on negative gap", () => {
    expect(
      computeCollageLayout({ imageCount: 4, columns: 2, canvasWidth: 100, canvasHeight: 100, gap: -1 }),
    ).toHaveProperty("error");
  });
});

describe("fitContain", () => {
  it("fits a landscape image in a square cell", () => {
    const r = fitContain(200, 100, 100, 100) as { width: number; height: number };
    expect(r.width).toBe(100);
    expect(r.height).toBe(50);
  });

  it("centers the image", () => {
    const r = fitContain(200, 100, 100, 100) as { x: number; y: number };
    expect(r.x).toBe(0);
    expect(r.y).toBe(25);
  });

  it("errors on invalid dims", () => {
    expect(fitContain(0, 100, 100, 100)).toHaveProperty("error");
  });
});

describe("fitCover", () => {
  it("covers the cell", () => {
    const r = fitCover(200, 100, 100, 100) as { width: number; height: number };
    expect(r.width).toBe(200);
    expect(r.height).toBe(100);
  });

  it("errors on invalid dims", () => {
    expect(fitCover(100, 0, 100, 100)).toHaveProperty("error");
  });
});

describe("COLLAGE_PRESETS", () => {
  it("provides presets", () => {
    expect(COLLAGE_PRESETS.length).toBeGreaterThan(0);
    expect(COLLAGE_PRESETS[0]).toHaveProperty("columns");
  });
});
