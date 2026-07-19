import { describe, it, expect, beforeEach } from "vitest";
import {
  PAPER_SIZES,
  PAPER_SIZE_LABELS,
  IMPOSITION_TYPE_LABELS,
  PAGE_ORDER_LABELS,
  DEFAULT_MARGIN,
  DEFAULT_COST_PER_SHEET,
  DEFAULT_BLEED_PT,
  PRINT_TIME_PER_SHEET_SEC,
  padToMultiple,
  getPaperSize,
  isPaperSizeId,
  gridFor,
  pagesPerSheet,
  sheetCount,
  sequentialOrder,
  snakeFoldOrder,
  bookletOrder,
  computeLayout,
  pagePositions,
  cutMarks,
  cutMarksForSheet,
  marginCalculator,
  scalePage,
  blankPadderCount,
  validateImposition,
  paperWastePercent,
  printTimeEstimator,
  costEstimator,
  bleedArea,
  computeSummary,
  renderText,
  renderCsv,
  renderHtml,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ImpositionType,
  type PageOrder,
  type PaperSizeId,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

describe("pdf-imposition constants", () => {
  it("has 5 paper sizes", () => {
    expect(PAPER_SIZES).toHaveLength(5);
  });
  it("has a4 and tabloid", () => {
    expect(PAPER_SIZES.some((p) => p.id === "a4")).toBe(true);
    expect(PAPER_SIZES.some((p) => p.id === "tabloid")).toBe(true);
  });
  it("labels match paper sizes", () => {
    for (const p of PAPER_SIZES) {
      expect(PAPER_SIZE_LABELS[p.id]).toBe(p.label);
    }
  });
  it("has 5 imposition type labels", () => {
    expect(Object.keys(IMPOSITION_TYPE_LABELS)).toHaveLength(5);
    expect(IMPOSITION_TYPE_LABELS["2-up"]).toContain("2-up");
    expect(IMPOSITION_TYPE_LABELS["custom"]).toContain("Custom");
  });
  it("has 3 page order labels", () => {
    expect(Object.keys(PAGE_ORDER_LABELS)).toHaveLength(3);
  });
  it("has default constants", () => {
    expect(DEFAULT_MARGIN).toBeGreaterThan(0);
    expect(DEFAULT_COST_PER_SHEET).toBeGreaterThan(0);
    expect(DEFAULT_BLEED_PT).toBeGreaterThan(0);
    expect(PRINT_TIME_PER_SHEET_SEC).toBeGreaterThan(0);
  });
});

describe("pdf-imposition padToMultiple", () => {
  it("rounds up to next multiple", () => {
    expect(padToMultiple(5, 4)).toBe(8);
    expect(padToMultiple(8, 4)).toBe(8);
    expect(padToMultiple(0, 4)).toBe(0);
  });
  it("handles multiples of 6", () => {
    expect(padToMultiple(7, 6)).toBe(12);
  });
});

describe("pdf-imposition paper sizes", () => {
  it("getPaperSize returns the paper size", () => {
    const a4 = getPaperSize("a4");
    expect(a4.width).toBeCloseTo(595.28);
    expect(a4.height).toBeCloseTo(841.89);
  });
  it("getPaperSize throws for unknown id", () => {
    expect(() => getPaperSize("unknown" as PaperSizeId)).toThrow();
  });
  it("isPaperSizeId validates", () => {
    expect(isPaperSizeId("a4")).toBe(true);
    expect(isPaperSizeId("unknown")).toBe(false);
  });
});

describe("pdf-imposition gridFor", () => {
  it("returns 1×2 for 2-up", () => {
    expect(gridFor("2-up")).toEqual({ rows: 1, cols: 2 });
  });
  it("returns 2×2 for 4-up", () => {
    expect(gridFor("4-up")).toEqual({ rows: 2, cols: 2 });
  });
  it("returns 2×4 for 8-up", () => {
    expect(gridFor("8-up")).toEqual({ rows: 2, cols: 4 });
  });
  it("returns 4×4 for 16-up", () => {
    expect(gridFor("16-up")).toEqual({ rows: 4, cols: 4 });
  });
  it("returns custom rows/cols for custom", () => {
    expect(gridFor("custom", 3, 5)).toEqual({ rows: 3, cols: 5 });
  });
  it("clamps custom to at least 1", () => {
    expect(gridFor("custom", 0, 0)).toEqual({ rows: 1, cols: 1 });
    expect(gridFor("custom", -2, 4)).toEqual({ rows: 1, cols: 4 });
  });
});

describe("pdf-imposition pagesPerSheet + sheetCount", () => {
  it("computes pagesPerSheet", () => {
    expect(pagesPerSheet({ rows: 2, cols: 2 })).toBe(4);
    expect(pagesPerSheet({ rows: 4, cols: 4 })).toBe(16);
  });
  it("computes sheetCount", () => {
    expect(sheetCount(8, 4)).toBe(2);
    expect(sheetCount(9, 4)).toBe(3);
    expect(sheetCount(0, 4)).toBe(0);
  });
});

describe("pdf-imposition sequentialOrder", () => {
  it("lays out pages in order", () => {
    const sheets = sequentialOrder(8, { rows: 2, cols: 2 }, 2);
    expect(sheets).toHaveLength(2);
    expect(sheets[0].pages).toEqual([1, 2, 3, 4]);
    expect(sheets[1].pages).toEqual([5, 6, 7, 8]);
  });
  it("pads with blanks", () => {
    const sheets = sequentialOrder(7, { rows: 2, cols: 2 }, 2);
    expect(sheets[1].pages).toEqual([5, 6, 7, 0]);
  });
  it("returns empty for 0 sheets", () => {
    expect(sequentialOrder(0, { rows: 2, cols: 2 }, 0)).toEqual([]);
  });
});

describe("pdf-imposition snakeFoldOrder", () => {
  it("alternates row direction", () => {
    // 4-up grid, 4 pages → 1 sheet, row 0 = [1,2], row 1 reversed = [4,3]
    const sheets = snakeFoldOrder(4, { rows: 2, cols: 2 }, 1);
    expect(sheets[0].pages[0]).toBe(1); // row 0, col 0
    expect(sheets[0].pages[1]).toBe(2); // row 0, col 1
    expect(sheets[0].pages[2]).toBe(4); // row 1, col 0 (reversed)
    expect(sheets[0].pages[3]).toBe(3); // row 1, col 1 (reversed)
  });
  it("handles multiple sheets", () => {
    const sheets = snakeFoldOrder(8, { rows: 1, cols: 2 }, 4);
    expect(sheets).toHaveLength(4);
    // Row 0 is even, so left-to-right
    expect(sheets[0].pages).toEqual([1, 2]);
  });
  it("preserves page count", () => {
    const sheets = snakeFoldOrder(8, { rows: 2, cols: 2 }, 2);
    const pages = sheets.flatMap((s) => s.pages).filter((p) => p > 0);
    expect(pages.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe("pdf-imposition bookletOrder", () => {
  it("places pages from both ends of document", () => {
    // 4-up, 4 pages → 1 sheet. Pattern: [N, 1, 2, N-1] = [4, 1, 2, 3]
    const sheets = bookletOrder(4, { rows: 2, cols: 2 }, 1);
    expect(sheets).toHaveLength(1);
    expect(sheets[0].pages[0]).toBe(4);
    expect(sheets[0].pages[1]).toBe(1);
    expect(sheets[0].pages[2]).toBe(2);
    expect(sheets[0].pages[3]).toBe(3);
  });
  it("places all source pages exactly once", () => {
    const sheets = bookletOrder(8, { rows: 2, cols: 2 }, 2);
    const pages = sheets.flatMap((s) => s.pages).filter((p) => p > 0);
    expect(pages.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it("handles blanks for non-multiple page counts", () => {
    const sheets = bookletOrder(5, { rows: 2, cols: 2 }, 2);
    const pages = sheets.flatMap((s) => s.pages);
    expect(pages).toContain(0);
    expect(pages.filter((p) => p > 0)).toHaveLength(5);
  });
});

describe("pdf-imposition computeLayout", () => {
  it("returns empty layout for 0 pages", () => {
    const layout = computeLayout(0, { type: "4-up", pageOrder: "sequential" });
    expect(layout.sheetCount).toBe(0);
    expect(layout.sheets).toEqual([]);
  });
  it("computes 4-up sequential layout", () => {
    const layout = computeLayout(8, { type: "4-up", pageOrder: "sequential" });
    expect(layout.perSheet).toBe(4);
    expect(layout.sheetCount).toBe(2);
    expect(layout.blankPages).toBe(0);
    expect(layout.sheets).toHaveLength(2);
  });
  it("computes 8-up snake-fold layout", () => {
    const layout = computeLayout(16, { type: "8-up", pageOrder: "snake-fold" });
    expect(layout.grid).toEqual({ rows: 2, cols: 4 });
    expect(layout.sheetCount).toBe(2);
  });
  it("computes 16-up booklet layout", () => {
    const layout = computeLayout(16, { type: "16-up", pageOrder: "booklet" });
    expect(layout.perSheet).toBe(16);
    expect(layout.sheetCount).toBe(1);
  });
  it("computes custom layout", () => {
    const layout = computeLayout(9, {
      type: "custom",
      pageOrder: "sequential",
      customRows: 3,
      customCols: 3,
    });
    expect(layout.grid).toEqual({ rows: 3, cols: 3 });
    expect(layout.perSheet).toBe(9);
    expect(layout.sheetCount).toBe(1);
  });
  it("pads blank pages when not multiple", () => {
    const layout = computeLayout(5, { type: "4-up", pageOrder: "sequential" });
    expect(layout.blankPages).toBe(3);
    expect(layout.paddedPageCount).toBe(8);
  });
});

describe("pdf-imposition pagePositions", () => {
  it("returns correct number of positions", () => {
    const a4 = getPaperSize("a4");
    const pos = pagePositions(a4, { rows: 2, cols: 2 }, 10);
    expect(pos).toHaveLength(4);
  });
  it("positions are within page bounds", () => {
    const a4 = getPaperSize("a4");
    const pos = pagePositions(a4, { rows: 2, cols: 2 }, 10);
    for (const p of pos) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + p.width).toBeLessThanOrEqual(a4.width);
      expect(p.y + p.height).toBeLessThanOrEqual(a4.height);
    }
  });
  it("row 0 is at the top (highest y)", () => {
    const a4 = getPaperSize("a4");
    const pos = pagePositions(a4, { rows: 2, cols: 2 }, 10);
    const row0 = pos.filter((p) => p.row === 0);
    const row1 = pos.filter((p) => p.row === 1);
    expect(Math.min(...row0.map((p) => p.y))).toBeGreaterThan(Math.max(...row1.map((p) => p.y)));
  });
  it("cols go left-to-right", () => {
    const a4 = getPaperSize("a4");
    const pos = pagePositions(a4, { rows: 1, cols: 3 }, 10);
    expect(pos[0].x).toBeLessThan(pos[1].x);
    expect(pos[1].x).toBeLessThan(pos[2].x);
  });
});

describe("pdf-imposition cutMarks", () => {
  it("generates 8 lines per cell", () => {
    const marks = cutMarks(100, 100, 200, 300);
    expect(marks).toHaveLength(8);
  });
  it("cutMarksForSheet generates for all positions", () => {
    const a4 = getPaperSize("a4");
    const pos = pagePositions(a4, { rows: 2, cols: 2 }, 10);
    const marks = cutMarksForSheet(pos);
    expect(marks).toHaveLength(32); // 4 cells × 8 lines
  });
  it("respects custom length and offset", () => {
    const marks = cutMarks(0, 0, 100, 100, 20, 5);
    expect(marks).toHaveLength(8);
  });
});

describe("pdf-imposition marginCalculator", () => {
  it("computes positive printable area", () => {
    const a4 = getPaperSize("a4");
    const m = marginCalculator(a4, { rows: 2, cols: 2 }, 10);
    expect(m.printableArea).toBeGreaterThan(0);
    expect(m.totalMarginArea).toBeGreaterThan(0);
    expect(m.marginPercent).toBeGreaterThan(0);
  });
  it("totalArea = printableArea + totalMarginArea", () => {
    const a4 = getPaperSize("a4");
    const m = marginCalculator(a4, { rows: 2, cols: 2 }, 10);
    const totalArea = a4.width * a4.height;
    expect(m.printableArea + m.totalMarginArea).toBeCloseTo(totalArea, 1);
  });
  it("larger margins mean smaller printable area", () => {
    const a4 = getPaperSize("a4");
    const small = marginCalculator(a4, { rows: 2, cols: 2 }, 5);
    const large = marginCalculator(a4, { rows: 2, cols: 2 }, 30);
    expect(large.printableArea).toBeLessThan(small.printableArea);
  });
});

describe("pdf-imposition scalePage", () => {
  it("scales to fit while preserving aspect ratio", () => {
    const r = scalePage(200, 100, 50, 25);
    expect(r.scale).toBeCloseTo(0.25);
    expect(r.width).toBeCloseTo(50);
    expect(r.height).toBeCloseTo(25);
  });
  it("scales to fit when source is taller than cell ratio", () => {
    const r = scalePage(100, 200, 50, 50);
    expect(r.scale).toBeCloseTo(0.25);
    expect(r.width).toBeCloseTo(25);
    expect(r.height).toBeCloseTo(50);
  });
  it("returns 0 for zero source", () => {
    const r = scalePage(0, 100, 50, 50);
    expect(r.scale).toBe(0);
    expect(r.width).toBe(0);
    expect(r.height).toBe(0);
  });
});

describe("pdf-imposition blankPadderCount", () => {
  it("returns 0 when already multiple", () => {
    expect(blankPadderCount(8, 4)).toBe(0);
    expect(blankPadderCount(16, 8)).toBe(0);
  });
  it("returns padding for non-multiple", () => {
    expect(blankPadderCount(5, 4)).toBe(3);
    expect(blankPadderCount(7, 8)).toBe(1);
  });
  it("returns 0 for 0 pages", () => {
    expect(blankPadderCount(0, 4)).toBe(0);
  });
});

describe("pdf-imposition validateImposition", () => {
  it("validates 4-up grid", () => {
    expect(validateImposition("4-up", { rows: 2, cols: 2 }).valid).toBe(true);
  });
  it("rejects wrong grid for typed imposition", () => {
    const v = validateImposition("4-up", { rows: 1, cols: 2 });
    expect(v.valid).toBe(false);
    expect(v.reason).toContain("4-up");
  });
  it("custom is always valid", () => {
    expect(validateImposition("custom", { rows: 7, cols: 3 }).valid).toBe(true);
  });
  it("16-up expects 4×4", () => {
    expect(validateImposition("16-up", { rows: 4, cols: 4 }).valid).toBe(true);
    expect(validateImposition("16-up", { rows: 2, cols: 8 }).valid).toBe(false);
  });
});

describe("pdf-imposition estimators", () => {
  it("paperWastePercent computes blank ratio", () => {
    expect(paperWastePercent(8, 4)).toBe(0);
    expect(paperWastePercent(5, 4)).toBe(37.5); // 3/8
  });
  it("printTimeEstimator returns minutes", () => {
    const min = printTimeEstimator(10, 6); // 60s = 1 min
    expect(min).toBe(1);
  });
  it("printTimeEstimator handles 0 sheets", () => {
    expect(printTimeEstimator(0)).toBe(0);
  });
  it("costEstimator computes cost", () => {
    expect(costEstimator(10, 0.1)).toBe(1);
    expect(costEstimator(0, 0.1)).toBe(0);
  });
  it("costEstimator rounds to 2 decimals", () => {
    expect(costEstimator(7, 0.15)).toBe(1.05);
  });
  it("bleedArea returns positive value", () => {
    const a4 = getPaperSize("a4");
    expect(bleedArea(a4, 9)).toBeGreaterThan(0);
  });
  it("bleedArea scales with paper size", () => {
    const a4 = getPaperSize("a4");
    const a3 = getPaperSize("a3");
    expect(bleedArea(a3, 9)).toBeGreaterThan(bleedArea(a4, 9));
  });
});

describe("pdf-imposition computeSummary", () => {
  it("computes summary stats", () => {
    const layout = computeLayout(8, { type: "4-up", pageOrder: "sequential" });
    const s = computeSummary(layout, "a4", 10, true);
    expect(s.sourcePageCount).toBe(8);
    expect(s.sheetCount).toBe(2);
    expect(s.perSheet).toBe(4);
    expect(s.paperSizeLabel).toContain("A4");
    expect(s.pageOrder).toBe("sequential");
    expect(s.includeCutMarks).toBe(true);
    expect(s.paperWastePercent).toBe(0);
    expect(s.printTimeMinutes).toBeGreaterThan(0);
    expect(s.estimatedCost).toBeGreaterThan(0);
    expect(s.bleedAreaPt2).toBeGreaterThan(0);
  });
  it("summary reflects waste when padding", () => {
    const layout = computeLayout(5, { type: "4-up", pageOrder: "sequential" });
    const s = computeSummary(layout, "a4", 10, false);
    expect(s.blankPages).toBe(3);
    expect(s.paperWastePercent).toBeGreaterThan(0);
  });
});

describe("pdf-imposition renderers", () => {
  const layout = computeLayout(8, { type: "4-up", pageOrder: "sequential" });

  it("renderText includes header and sheet info", () => {
    const text = renderText(layout);
    expect(text).toContain("Imposition Layout");
    expect(text).toContain("4-up");
    expect(text).toContain("Sheet 1");
    expect(text).toContain("Source pages: 8");
  });
  it("renderText shows — for blank pages", () => {
    const padded = computeLayout(5, { type: "4-up", pageOrder: "sequential" });
    expect(renderText(padded)).toContain("—");
  });
  it("renderCsv has header row", () => {
    const csv = renderCsv(layout);
    expect(csv).toContain("sheet_num,position,row,col,page_num");
    expect(csv.split("\n").length).toBe(1 + 8); // header + 2 sheets × 4 pages
  });
  it("renderCsv shows BLANK for padding", () => {
    const padded = computeLayout(5, { type: "4-up", pageOrder: "sequential" });
    expect(renderCsv(padded)).toContain("BLANK");
  });
  it("renderHtml produces div + table", () => {
    const html = renderHtml(layout);
    expect(html).toContain("imposition-layout");
    expect(html).toContain("<table");
    expect(html).toContain("Sheet 1");
  });
  it("renderHtml marks blanks", () => {
    const padded = computeLayout(5, { type: "4-up", pageOrder: "sequential" });
    expect(renderHtml(padded)).toContain("blank");
  });
});

describe("pdf-imposition history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      fileName: "doc.pdf",
      impositionType: "4-up",
      pageOrder: "sequential",
      sourcePageCount: 8,
      sheetCount: 2,
      perSheet: 4,
      paperSize: "a4",
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].fileName).toBe("doc.pdf");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        fileName: `doc${i}.pdf`,
        impositionType: "4-up",
        pageOrder: "sequential",
        sourcePageCount: 8,
        sheetCount: 2,
        perSheet: 4,
        paperSize: "a4",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      fileName: "doc.pdf",
      impositionType: "4-up",
      pageOrder: "sequential",
      sourcePageCount: 8,
      sheetCount: 2,
      perSheet: 4,
      paperSize: "a4",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("pdf-imposition shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("4-up", "sequential", "a4", 2, 2, 10, true);
    expect(url).toContain("type=4-up");
    expect(url).toContain("order=sequential");
    expect(url).toContain("paper=a4");
    expect(url).toContain("margin=10");
    expect(url).toContain("cuts=true");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("includes custom rows/cols when type is custom", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("custom", "snake-fold", "a3", 3, 5, 8, false);
    expect(url).toContain("rows=3");
    expect(url).toContain("cols=5");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("type=8-up&order=booklet&paper=tabloid&margin=15&cuts=true");
    expect(p?.impositionType).toBe("8-up");
    expect(p?.pageOrder).toBe("booklet");
    expect(p?.paperSize).toBe("tabloid");
    expect(p?.margin).toBe(15);
    expect(p?.includeCutMarks).toBe(true);
  });
  it("parses custom rows/cols", () => {
    const p = parseShareUrl("type=custom&order=sequential&paper=a4&rows=3&cols=5&margin=10&cuts=false");
    expect(p?.impositionType).toBe("custom");
    expect(p?.customRows).toBe(3);
    expect(p?.customCols).toBe(5);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("returns null for missing required params", () => {
    expect(parseShareUrl("type=4-up")).toBeNull();
  });
  it("returns null for invalid imposition type", () => {
    expect(parseShareUrl("type=invalid&order=sequential&paper=a4")).toBeNull();
  });
  it("returns null for invalid page order", () => {
    expect(parseShareUrl("type=4-up&order=invalid&paper=a4")).toBeNull();
  });
  it("returns null for invalid paper size", () => {
    expect(parseShareUrl("type=4-up&order=sequential&paper=unknown")).toBeNull();
  });
  it("defaults margin + cuts when missing", () => {
    const p = parseShareUrl("type=4-up&order=sequential&paper=a4");
    expect(p?.margin).toBe(DEFAULT_MARGIN);
    expect(p?.includeCutMarks).toBe(false);
  });
  it("defaults custom rows/cols to 2 when missing", () => {
    const p = parseShareUrl("type=custom&order=sequential&paper=a4");
    expect(p?.customRows).toBe(2);
    expect(p?.customCols).toBe(2);
  });
});

// Suppress unused-import lint
export type _Unused = ImpositionType | PageOrder | PaperSizeId;
