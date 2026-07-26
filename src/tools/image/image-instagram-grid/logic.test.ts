import { describe, it, expect } from "vitest";
import {
  gridDimensions,
  tileDimensions,
  padNumber,
  tileFileName,
  postOrder,
  validateInput,
  computeGrid,
  batchComputeGrid,
  statsToCsv,
  aspectRatio,
  previewSnippet,
  type GridInput,
} from "./logic";

const BASE: GridInput = { width: 1080, height: 1080, mode: "3x3", gap: 0, baseName: "tile" };

describe("gridDimensions", () => {
  it("returns 3×1 for 3x1 mode", () => {
    expect(gridDimensions("3x1")).toEqual({ cols: 3, rows: 1 });
  });
  it("returns 3×3 for 3x3 mode", () => {
    expect(gridDimensions("3x3")).toEqual({ cols: 3, rows: 3 });
  });
  it("returns 3×9 for 3x9 mode", () => {
    expect(gridDimensions("3x9")).toEqual({ cols: 3, rows: 9 });
  });
});

describe("tileDimensions", () => {
  it("computes square tiles for 3x3", () => {
    const { tileW, tileH } = tileDimensions(1080, 1080, "3x3");
    expect(tileW).toBe(360);
    expect(tileH).toBe(360);
  });
  it("tiles are square regardless of source", () => {
    const { tileW, tileH } = tileDimensions(1500, 500, "3x1");
    expect(tileW).toBe(tileH);
  });
});

describe("padNumber", () => {
  it("pads single digit with leading zero for 2-digit total", () => {
    expect(padNumber(5, 9)).toBe("5");
  });
  it("pads to 2 digits when total is 2 digits", () => {
    expect(padNumber(5, 27)).toBe("05");
  });
});

describe("tileFileName", () => {
  it("generates filename with index", () => {
    expect(tileFileName("tile", 0, 9)).toBe("tile_1.png");
    expect(tileFileName("tile", 8, 9)).toBe("tile_9.png");
  });
  it("generates filename with padded index for larger total", () => {
    expect(tileFileName("photo", 3, 27)).toBe("photo_04.png");
  });
});

describe("postOrder", () => {
  it("is 1-based", () => {
    expect(postOrder(0)).toBe(1);
    expect(postOrder(8)).toBe(9);
  });
});

describe("validateInput", () => {
  it("accepts valid input", () => {
    expect(validateInput(BASE)).toEqual({ ok: true });
  });
  it("rejects non-positive dimensions", () => {
    expect(validateInput({ ...BASE, width: 0 })).toHaveProperty("error");
  });
  it("rejects unknown mode", () => {
    expect(validateInput({ ...BASE, mode: "bogus" as never })).toHaveProperty("error");
  });
  it("rejects bad gap", () => {
    expect(validateInput({ ...BASE, gap: 100 })).toHaveProperty("error");
  });
  it("rejects empty base name", () => {
    expect(validateInput({ ...BASE, baseName: "" })).toHaveProperty("error");
  });
  it("rejects base name with special chars", () => {
    expect(validateInput({ ...BASE, baseName: "my tiles!" })).toHaveProperty("error");
  });
  it("rejects overly long base name", () => {
    expect(validateInput({ ...BASE, baseName: "x".repeat(101) })).toHaveProperty("error");
  });
});

describe("computeGrid", () => {
  it("returns 9 tiles for 3x3 mode", () => {
    const r = computeGrid(BASE);
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.tiles.length).toBe(9);
  });
  it("returns 3 tiles for 3x1 mode", () => {
    const r = computeGrid({ ...BASE, mode: "3x1" });
    if ("error" in r) throw new Error("unexpected");
    expect(r.tiles.length).toBe(3);
  });
  it("returns 27 tiles for 3x9 mode", () => {
    const r = computeGrid({ ...BASE, mode: "3x9" });
    if ("error" in r) throw new Error("unexpected");
    expect(r.tiles.length).toBe(27);
  });
  it("errors on bad input", () => {
    expect("error" in computeGrid({ ...BASE, width: 0 })).toBe(true);
  });
  it("tile positions are sequential", () => {
    const r = computeGrid(BASE);
    if ("error" in r) throw new Error("unexpected");
    expect(r.tiles[0]!.x).toBe(0);
    expect(r.tiles[1]!.x).toBe(r.tiles[0]!.width);
    expect(r.tiles[1]!.y).toBe(0);
  });
  it("generates zip file list", () => {
    const r = computeGrid(BASE);
    if ("error" in r) throw new Error("unexpected");
    expect(r.zipFileList.length).toBe(9);
    expect(r.zipFileList[0]).toBe("tile_1.png");
  });
  it("generates CSV manifest with header", () => {
    const r = computeGrid(BASE);
    if ("error" in r) throw new Error("unexpected");
    expect(r.csvManifest.startsWith("Index,Row,Col,PostOrder")).toBe(true);
  });
  it("warns on small source width", () => {
    const r = computeGrid({ ...BASE, width: 500 });
    if ("error" in r) throw new Error("unexpected");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("warns on 3x9 mode", () => {
    const r = computeGrid({ ...BASE, mode: "3x9" });
    if ("error" in r) throw new Error("unexpected");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("batchComputeGrid", () => {
  it("runs over multiple inputs", () => {
    const r = batchComputeGrid([BASE, BASE]);
    expect(r.length).toBe(2);
  });
});

describe("statsToCsv", () => {
  it("produces CSV with header", () => {
    const r = computeGrid(BASE);
    if ("error" in r) throw new Error("unexpected");
    const csv = statsToCsv(r.stats);
    expect(csv.startsWith("Field,Value")).toBe(true);
    expect(csv).toContain("TotalTiles");
  });
});

describe("aspectRatio", () => {
  it("computes aspect ratio", () => {
    expect(aspectRatio(1080, 1080)).toBeCloseTo(1, 5);
    expect(aspectRatio(1920, 1080)).toBeCloseTo(16 / 9, 5);
  });
  it("returns 0 for zero height", () => {
    expect(aspectRatio(100, 0)).toBe(0);
  });
});

describe("previewSnippet", () => {
  it("generates a preview for 3x3", () => {
    const s = previewSnippet("3x3", 360, 360);
    expect(s).toContain("[1]");
    expect(s).toContain("[9]");
    expect(s).toContain("-");
  });
  it("generates a preview for 3x1", () => {
    const s = previewSnippet("3x1", 360, 360);
    expect(s).toContain("[1]");
    expect(s).toContain("[3]");
    expect(s).not.toContain("-");
  });
});
