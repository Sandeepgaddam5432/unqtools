import { describe, it, expect, beforeEach } from "vitest";
import {
  PAPER_SIZES,
  PAPER_SIZE_LABELS,
  BOOKLET_TYPE_LABELS,
  DEFAULT_SHEETS_PER_SIGNATURE,
  padToMultiple,
  padToMultipleOf4,
  getPaperSize,
  isPaperSizeId,
  saddleStitchOrder,
  perfectBoundOrder,
  gateFoldOrder,
  computeLayout,
  sheetCount,
  signatureCount,
  validatePageCount,
  blankPadderCount,
  duplexArrangement,
  pagePositions,
  cropMarks,
  bindingMarginPt,
  spineWidth,
  pointsToMm,
  signatureSeparator,
  validatePageOrder,
  computeSummary,
  renderText,
  renderCsv,
  renderHtml,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type BookletType,
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

describe("pdf-booklet-maker constants", () => {
  it("has 6 paper sizes", () => {
    expect(PAPER_SIZES).toHaveLength(6);
  });
  it("has a4-portrait and a3-landscape", () => {
    expect(PAPER_SIZES.some((p) => p.id === "a4-portrait")).toBe(true);
    expect(PAPER_SIZES.some((p) => p.id === "a3-landscape")).toBe(true);
  });
  it("labels match paper sizes", () => {
    for (const p of PAPER_SIZES) {
      expect(PAPER_SIZE_LABELS[p.id]).toBe(p.label);
    }
  });
  it("has 3 booklet type labels", () => {
    expect(Object.keys(BOOKLET_TYPE_LABELS)).toHaveLength(3);
    expect(BOOKLET_TYPE_LABELS["saddle-stitch"]).toContain("Saddle");
    expect(BOOKLET_TYPE_LABELS["perfect-bound"]).toContain("Perfect");
    expect(BOOKLET_TYPE_LABELS["gate-fold"]).toContain("Gate");
  });
  it("has default sheets per signature", () => {
    expect(DEFAULT_SHEETS_PER_SIGNATURE).toBeGreaterThanOrEqual(1);
  });
});

describe("pdf-booklet-maker padToMultiple", () => {
  it("rounds up to next multiple of 4", () => {
    expect(padToMultiple(1, 4)).toBe(4);
    expect(padToMultiple(5, 4)).toBe(8);
    expect(padToMultiple(8, 4)).toBe(8);
    expect(padToMultiple(0, 4)).toBe(0);
  });
  it("padToMultipleOf4 is alias for m=4", () => {
    expect(padToMultipleOf4(7)).toBe(8);
    expect(padToMultipleOf4(12)).toBe(12);
  });
  it("handles multiples of 6", () => {
    expect(padToMultiple(5, 6)).toBe(6);
    expect(padToMultiple(7, 6)).toBe(12);
  });
});

describe("pdf-booklet-maker paper sizes", () => {
  it("getPaperSize returns the paper size", () => {
    const a4 = getPaperSize("a4-portrait");
    expect(a4.width).toBeCloseTo(595.28);
    expect(a4.height).toBeCloseTo(841.89);
    expect(a4.orientation).toBe("portrait");
  });
  it("getPaperSize throws for unknown id", () => {
    expect(() => getPaperSize("unknown" as PaperSizeId)).toThrow();
  });
  it("isPaperSizeId validates", () => {
    expect(isPaperSizeId("a4-portrait")).toBe(true);
    expect(isPaperSizeId("unknown")).toBe(false);
  });
  it("landscape sizes have width > height", () => {
    const ls = getPaperSize("a4-landscape");
    expect(ls.width).toBeGreaterThan(ls.height);
  });
});

describe("pdf-booklet-maker saddleStitchOrder", () => {
  it("returns empty for 0 pages", () => {
    expect(saddleStitchOrder(0)).toEqual([]);
  });
  it("arranges 8 pages correctly", () => {
    const sides = saddleStitchOrder(8);
    expect(sides).toHaveLength(4); // 2 sheets × 2 sides
    // Sheet 0 front: [8, 1]
    expect(sides[0]).toMatchObject({ sheetNum: 0, side: "front", pages: [8, 1] });
    // Sheet 0 back: [2, 7]
    expect(sides[1]).toMatchObject({ sheetNum: 0, side: "back", pages: [2, 7] });
    // Sheet 1 front: [6, 3]
    expect(sides[2]).toMatchObject({ sheetNum: 1, side: "front", pages: [6, 3] });
    // Sheet 1 back: [4, 5]
    expect(sides[3]).toMatchObject({ sheetNum: 1, side: "back", pages: [4, 5] });
  });
  it("pads non-multiple-of-4 page count with blanks", () => {
    // 5 pages → pad to 8
    const sides = saddleStitchOrder(5);
    expect(sides).toHaveLength(4);
    // Page 6, 7, 8 are blanks (0)
    const allPages = sides.flatMap((s) => s.pages);
    expect(allPages).toContain(0);
    expect(allPages.filter((p) => p > 0)).toEqual([1, 2, 3, 4, 5]);
  });
  it("places all source pages exactly once", () => {
    for (const n of [4, 8, 12, 16, 20]) {
      const sides = saddleStitchOrder(n);
      const pages = sides.flatMap((s) => s.pages).filter((p) => p > 0);
      expect(pages.sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
    }
  });
  it("every side has exactly 2 pages", () => {
    const sides = saddleStitchOrder(16);
    for (const s of sides) {
      expect(s.pages).toHaveLength(2);
    }
  });
});

describe("pdf-booklet-maker perfectBoundOrder", () => {
  it("returns empty for 0 pages", () => {
    expect(perfectBoundOrder(0, 4)).toEqual([]);
  });
  it("groups into signatures", () => {
    // 32 pages, 2 sheets per signature = 8 pages per sig = 4 signatures
    const sides = perfectBoundOrder(32, 2);
    expect(sides).toHaveLength(16); // 8 sheets × 2 sides
    // Each signature has 2 sheets = 4 sides
    // Signature 0: sheet 0, 1
    expect(sides[0].sheetNum).toBe(0);
    expect(sides[1].sheetNum).toBe(0);
    expect(sides[2].sheetNum).toBe(1);
    expect(sides[3].sheetNum).toBe(1);
    // Signature 1 starts at sheet 2
    expect(sides[4].sheetNum).toBe(2);
  });
  it("places all source pages exactly once", () => {
    const sides = perfectBoundOrder(20, 2);
    const pages = sides.flatMap((s) => s.pages).filter((p) => p > 0);
    expect(pages.sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
  it("pads within signatures", () => {
    // 17 pages, 2 sheets per signature (8 pages each) → 3 sigs (24 total)
    const sides = perfectBoundOrder(17, 2);
    const pages = sides.flatMap((s) => s.pages);
    expect(pages).toContain(0);
    expect(pages.filter((p) => p > 0)).toHaveLength(17);
  });
  it("uses default sheetsPerSignature", () => {
    const sides = perfectBoundOrder(8); // default 4 sheets/sig = 16 pages/sig → 1 sig padded to 16 pages = 4 sheets
    expect(sides).toHaveLength(8); // 4 sheets × 2 sides
    // Pages 9-16 are blanks
    const pages = sides.flatMap((s) => s.pages);
    expect(pages.filter((p) => p === 0)).toHaveLength(8);
  });
  it("handles 1 sheet per signature", () => {
    const sides = perfectBoundOrder(8, 1); // 4 pages/sig → 2 sigs
    expect(sides).toHaveLength(4);
  });
});

describe("pdf-booklet-maker gateFoldOrder", () => {
  it("returns empty for 0 pages", () => {
    expect(gateFoldOrder(0)).toEqual([]);
  });
  it("arranges 6 pages in one sheet", () => {
    const sides = gateFoldOrder(6);
    expect(sides).toHaveLength(2); // 1 sheet × 2 sides
    expect(sides[0].pages).toHaveLength(3);
    expect(sides[1].pages).toHaveLength(3);
    // Front: [6, 1, 2], Back: [5, 4, 3]
    expect(sides[0].pages).toEqual([6, 1, 2]);
    expect(sides[1].pages).toEqual([5, 4, 3]);
  });
  it("pads to multiple of 6", () => {
    const sides = gateFoldOrder(7); // pad to 12
    expect(sides).toHaveLength(4); // 2 sheets × 2 sides
    const pages = sides.flatMap((s) => s.pages);
    expect(pages).toContain(0);
    expect(pages.filter((p) => p > 0).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it("places all source pages exactly once", () => {
    for (const n of [6, 12, 18, 24]) {
      const sides = gateFoldOrder(n);
      const pages = sides.flatMap((s) => s.pages).filter((p) => p > 0);
      expect(pages.sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
    }
  });
  it("every side has exactly 3 pages", () => {
    const sides = gateFoldOrder(12);
    for (const s of sides) {
      expect(s.pages).toHaveLength(3);
    }
  });
});

describe("pdf-booklet-maker computeLayout", () => {
  it("returns empty layout for 0 pages", () => {
    const layout = computeLayout(0, { type: "saddle-stitch" });
    expect(layout.sheetCount).toBe(0);
    expect(layout.sides).toEqual([]);
  });
  it("computes saddle-stitch layout", () => {
    const layout = computeLayout(8, { type: "saddle-stitch" });
    expect(layout.paddedPageCount).toBe(8);
    expect(layout.sheetCount).toBe(2);
    expect(layout.signatureCount).toBe(1);
    expect(layout.blankPages).toBe(0);
    expect(layout.sides).toHaveLength(4);
  });
  it("computes perfect-bound layout with multiple signatures", () => {
    const layout = computeLayout(32, { type: "perfect-bound", sheetsPerSignature: 2 });
    expect(layout.signatureCount).toBe(4);
    expect(layout.sheetCount).toBe(8);
  });
  it("computes gate-fold layout", () => {
    const layout = computeLayout(12, { type: "gate-fold" });
    expect(layout.paddedPageCount).toBe(12);
    expect(layout.sheetCount).toBe(2);
    expect(layout.sides).toHaveLength(4);
    expect(layout.sides[0].pages).toHaveLength(3);
  });
  it("pads blank pages", () => {
    const layout = computeLayout(5, { type: "saddle-stitch" });
    expect(layout.blankPages).toBe(3);
    expect(layout.paddedPageCount).toBe(8);
  });
});

describe("pdf-booklet-maker sheetCount + signatureCount", () => {
  it("computes saddle-stitch sheets", () => {
    expect(sheetCount(8, "saddle-stitch")).toBe(2);
    expect(sheetCount(16, "saddle-stitch")).toBe(4);
    expect(sheetCount(5, "saddle-stitch")).toBe(2); // pad to 8
  });
  it("computes gate-fold sheets", () => {
    expect(sheetCount(6, "gate-fold")).toBe(1);
    expect(sheetCount(12, "gate-fold")).toBe(2);
    expect(sheetCount(7, "gate-fold")).toBe(2); // pad to 12
  });
  it("signatureCount returns 1 for non-perfect-bound", () => {
    expect(signatureCount(32, "saddle-stitch")).toBe(1);
    expect(signatureCount(32, "gate-fold")).toBe(1);
  });
  it("signatureCount computes for perfect-bound", () => {
    expect(signatureCount(32, "perfect-bound", 2)).toBe(4); // 8 pages/sig
    expect(signatureCount(16, "perfect-bound", 4)).toBe(1); // 16 pages/sig
    expect(signatureCount(32, "perfect-bound", 4)).toBe(2); // 16 pages/sig
  });
});

describe("pdf-booklet-maker validatePageCount", () => {
  it("validates multiple of 4 for saddle-stitch", () => {
    const v = validatePageCount(8, "saddle-stitch");
    expect(v.valid).toBe(true);
    expect(v.padded).toBe(8);
    expect(v.blanks).toBe(0);
    expect(v.multiple).toBe(4);
  });
  it("flags non-multiple of 4", () => {
    const v = validatePageCount(7, "saddle-stitch");
    expect(v.valid).toBe(false);
    expect(v.padded).toBe(8);
    expect(v.blanks).toBe(1);
  });
  it("validates multiple of 6 for gate-fold", () => {
    expect(validatePageCount(6, "gate-fold").valid).toBe(true);
    expect(validatePageCount(12, "gate-fold").valid).toBe(true);
    expect(validatePageCount(7, "gate-fold").valid).toBe(false);
    expect(validatePageCount(7, "gate-fold").multiple).toBe(6);
  });
  it("handles 0 pages", () => {
    const v = validatePageCount(0, "saddle-stitch");
    expect(v.valid).toBe(false);
  });
});

describe("pdf-booklet-maker blankPadderCount", () => {
  it("returns 0 when already a multiple", () => {
    expect(blankPadderCount(8, "saddle-stitch")).toBe(0);
    expect(blankPadderCount(6, "gate-fold")).toBe(0);
  });
  it("returns padding for non-multiple", () => {
    expect(blankPadderCount(5, "saddle-stitch")).toBe(3);
    expect(blankPadderCount(7, "gate-fold")).toBe(5);
  });
});

describe("pdf-booklet-maker duplexArrangement", () => {
  it("groups sides into front/back pairs", () => {
    const sides = saddleStitchOrder(8);
    const pairs = duplexArrangement(sides);
    expect(pairs).toHaveLength(2);
    expect(pairs[0].front.side).toBe("front");
    expect(pairs[0].back.side).toBe("back");
    expect(pairs[0].sheetNum).toBe(0);
    expect(pairs[1].sheetNum).toBe(1);
  });
  it("returns empty for empty sides", () => {
    expect(duplexArrangement([])).toEqual([]);
  });
  it("skips odd-length sides gracefully", () => {
    const pairs = duplexArrangement([
      { sheetNum: 0, side: "front", pages: [1, 2] },
    ]);
    expect(pairs).toEqual([]);
  });
});

describe("pdf-booklet-maker pagePositions", () => {
  it("returns 2 positions for 2-up", () => {
    const a4 = getPaperSize("a4-portrait");
    const pos = pagePositions(a4, 2);
    expect(pos).toHaveLength(2);
    expect(pos[0].x).toBeLessThan(pos[1].x);
    expect(pos[0].width).toBeCloseTo(pos[1].width);
  });
  it("returns 3 positions for 3-up", () => {
    const a4 = getPaperSize("a4-landscape");
    const pos = pagePositions(a4, 3);
    expect(pos).toHaveLength(3);
  });
  it("positions respect binding margin", () => {
    const a4 = getPaperSize("a4-portrait");
    const pos = pagePositions(a4, 2, 18);
    expect(pos[0].x).toBe(18);
    expect(pos[0].y).toBe(18);
  });
});

describe("pdf-booklet-maker cropMarks", () => {
  it("generates 8 lines for 4 corners", () => {
    const marks = cropMarks(100, 100, 200, 300);
    expect(marks).toHaveLength(8);
  });
  it("each line has start and end coordinates", () => {
    const marks = cropMarks(0, 0, 100, 100);
    for (const m of marks) {
      expect(m).toHaveProperty("x1");
      expect(m).toHaveProperty("y1");
      expect(m).toHaveProperty("x2");
      expect(m).toHaveProperty("y2");
    }
  });
  it("respects custom length and offset", () => {
    const marks = cropMarks(0, 0, 100, 100, 20, 10);
    expect(marks).toHaveLength(8);
  });
});

describe("pdf-booklet-maker binding + spine", () => {
  it("bindingMarginPt returns positive value", () => {
    expect(bindingMarginPt()).toBeGreaterThan(0);
  });
  it("spineWidth scales with sheet count", () => {
    const small = spineWidth(4);
    const large = spineWidth(40);
    expect(large).toBeGreaterThan(small);
  });
  it("spineWidth increases with sheetsPerSignature (glue)", () => {
    const noGlue = spineWidth(20, 1);
    const withGlue = spineWidth(20, 4);
    expect(withGlue).toBeGreaterThanOrEqual(noGlue);
  });
  it("pointsToMm converts correctly", () => {
    // 72 pt = 1 inch = 25.4 mm
    expect(pointsToMm(72)).toBeCloseTo(25.4, 1);
  });
});

describe("pdf-booklet-maker signatureSeparator", () => {
  it("assigns signature indices per side", () => {
    const sides = perfectBoundOrder(16, 2); // 2 sheets per sig → 2 sigs
    const sigs = signatureSeparator(sides, 2);
    expect(sigs).toHaveLength(sides.length);
    expect(Math.max(...sigs)).toBe(1);
    expect(Math.min(...sigs)).toBe(0);
  });
  it("all in sig 0 for single signature", () => {
    const sides = saddleStitchOrder(8);
    const sigs = signatureSeparator(sides, 4);
    expect(sigs.every((s) => s === 0)).toBe(true);
  });
});

describe("pdf-booklet-maker validatePageOrder", () => {
  it("validates a correct saddle-stitch order", () => {
    const sides = saddleStitchOrder(8);
    const v = validatePageOrder(sides, 8);
    expect(v.valid).toBe(true);
    expect(v.duplicates).toEqual([]);
    expect(v.missing).toEqual([]);
  });
  it("validates a correct gate-fold order", () => {
    const sides = gateFoldOrder(12);
    const v = validatePageOrder(sides, 12);
    expect(v.valid).toBe(true);
  });
  it("detects duplicates", () => {
    const sides: { sheetNum: number; side: "front" | "back"; pages: number[] }[] = [
      { sheetNum: 0, side: "front", pages: [1, 1] },
      { sheetNum: 0, side: "back", pages: [2, 3] },
    ];
    const v = validatePageOrder(sides, 3);
    expect(v.duplicates).toContain(1);
    expect(v.valid).toBe(false);
  });
  it("detects missing pages", () => {
    const sides: { sheetNum: number; side: "front" | "back"; pages: number[] }[] = [
      { sheetNum: 0, side: "front", pages: [1, 2] },
      { sheetNum: 0, side: "back", pages: [3, 4] },
    ];
    const v = validatePageOrder(sides, 5); // page 5 is missing
    expect(v.missing).toContain(5);
    expect(v.valid).toBe(false);
  });
});

describe("pdf-booklet-maker computeSummary", () => {
  it("computes summary stats", () => {
    const layout = computeLayout(8, { type: "saddle-stitch" });
    const s = computeSummary(layout, "a4-portrait", true, false);
    expect(s.sourcePageCount).toBe(8);
    expect(s.sheetCount).toBe(2);
    expect(s.signatureCount).toBe(1);
    expect(s.bookletType).toBe("saddle-stitch");
    expect(s.paperSizeLabel).toContain("A4");
    expect(s.duplex).toBe(true);
    expect(s.cropMarks).toBe(false);
    expect(s.spineWidthMm).toBeGreaterThan(0);
    expect(s.spineWidthPt).toBeGreaterThan(0);
    expect(s.bindingMarginPt).toBeGreaterThan(0);
  });
});

describe("pdf-booklet-maker renderers", () => {
  const layout = computeLayout(8, { type: "saddle-stitch" });

  it("renderText includes header and side lines", () => {
    const text = renderText(layout);
    expect(text).toContain("Booklet Layout");
    expect(text).toContain("Saddle-stitch");
    expect(text).toContain("Sheet 1 FRONT");
    expect(text).toContain("Sheet 1 BACK");
    expect(text).toContain("Source pages: 8");
  });
  it("renderText shows BLANK for padding pages", () => {
    const padded = computeLayout(5, { type: "saddle-stitch" });
    const text = renderText(padded);
    expect(text).toContain("BLANK");
  });
  it("renderCsv has header row", () => {
    const csv = renderCsv(layout);
    expect(csv).toContain("sheet_num,side,position,page_num");
    expect(csv.split("\n").length).toBe(1 + 8); // header + 4 sides × 2 pages
  });
  it("renderCsv shows BLANK for padding", () => {
    const padded = computeLayout(5, { type: "saddle-stitch" });
    const csv = renderCsv(padded);
    expect(csv).toContain("BLANK");
  });
  it("renderHtml produces a table", () => {
    const html = renderHtml(layout);
    expect(html).toContain("<table");
    expect(html).toContain("<th>Sheet</th>");
    expect(html).toContain("<th>Side</th>");
    expect(html).toContain("slot");
  });
  it("renderHtml marks blanks", () => {
    const padded = computeLayout(5, { type: "saddle-stitch" });
    const html = renderHtml(padded);
    expect(html).toContain("blank");
    expect(html).toContain("—");
  });
});

describe("pdf-booklet-maker history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      fileName: "doc.pdf",
      bookletType: "saddle-stitch",
      sourcePageCount: 8,
      sheetCount: 2,
      signatureCount: 1,
      paperSize: "a4-portrait",
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].fileName).toBe("doc.pdf");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        fileName: `doc${i}.pdf`,
        bookletType: "saddle-stitch",
        sourcePageCount: 8,
        sheetCount: 2,
        signatureCount: 1,
        paperSize: "a4-portrait",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      fileName: "doc.pdf",
      bookletType: "saddle-stitch",
      sourcePageCount: 8,
      sheetCount: 2,
      signatureCount: 1,
      paperSize: "a4-portrait",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("pdf-booklet-maker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("saddle-stitch", 4, "a4-portrait", true, false);
    expect(url).toContain("type=saddle-stitch");
    expect(url).toContain("sig=4");
    expect(url).toContain("paper=a4-portrait");
    expect(url).toContain("duplex=true");
    expect(url).toContain("crops=false");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("type=perfect-bound&sig=3&paper=a3-landscape&duplex=false&crops=true");
    expect(p?.bookletType).toBe("perfect-bound");
    expect(p?.sheetsPerSignature).toBe(3);
    expect(p?.paperSize).toBe("a3-landscape");
    expect(p?.duplex).toBe(false);
    expect(p?.cropMarks).toBe(true);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("returns null for missing required params", () => {
    expect(parseShareUrl("sig=4")).toBeNull();
  });
  it("returns null for invalid booklet type", () => {
    expect(parseShareUrl("type=invalid&paper=a4-portrait")).toBeNull();
  });
  it("returns null for invalid paper size", () => {
    expect(parseShareUrl("type=saddle-stitch&paper=unknown")).toBeNull();
  });
  it("defaults duplex=true and cropMarks=false when missing", () => {
    const p = parseShareUrl("type=saddle-stitch&sig=4&paper=a4-portrait");
    expect(p?.duplex).toBe(true);
    expect(p?.cropMarks).toBe(false);
  });
  it("defaults sig to 4 when missing or invalid", () => {
    const p = parseShareUrl("type=saddle-stitch&paper=a4-portrait");
    expect(p?.sheetsPerSignature).toBe(DEFAULT_SHEETS_PER_SIGNATURE);
  });
});

// Suppress unused-import lint
export type _Unused = BookletType | PaperSizeId;
