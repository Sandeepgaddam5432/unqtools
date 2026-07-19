import { describe, it, expect, beforeEach } from "vitest";
import {
  MM_TO_POINTS,
  INCH_TO_POINTS,
  BLEED_PRESETS,
  BLEED_SIDES_LIST,
  BLEED_SIDES_LABELS,
  PRINT_STANDARDS,
  mmToPoints,
  inchesToPoints,
  toPoints,
  applyBleedSides,
  hasAnyBleed,
  calculateNewSize,
  calculateContentOffset,
  validatePageExtension,
  generateCropMarks,
  generateBleedMarks,
  calculateTrimBox,
  calculateBleedAreaPercent,
  parseBackgroundColor,
  verifyPrintReady,
  computeSummaryStats,
  renderTextReport,
  renderCsvReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type BleedSides,
  type BleedPageResult,
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

describe("bleed-adder constants", () => {
  it("MM_TO_POINTS equals 2.83465", () => {
    expect(MM_TO_POINTS).toBeCloseTo(2.83465, 5);
  });
  it("INCH_TO_POINTS equals 72", () => {
    expect(INCH_TO_POINTS).toBe(72);
  });
  it("has 3 bleed presets", () => {
    expect(BLEED_PRESETS).toHaveLength(3);
    expect(BLEED_PRESETS.map((p) => p.id)).toEqual(["3mm", "5mm", "0.125in"]);
  });
  it("has 7 bleed-side options with labels", () => {
    expect(BLEED_SIDES_LIST).toHaveLength(7);
    for (const s of BLEED_SIDES_LIST) {
      expect(typeof BLEED_SIDES_LABELS[s]).toBe("string");
      expect(BLEED_SIDES_LABELS[s].length).toBeGreaterThan(0);
    }
  });
  it("has 3 print standards with positive minimum bleed", () => {
    expect(Object.keys(PRINT_STANDARDS)).toHaveLength(3);
    for (const k of Object.keys(PRINT_STANDARDS) as (keyof typeof PRINT_STANDARDS)[]) {
      expect(PRINT_STANDARDS[k].minBleedPt).toBeGreaterThan(0);
    }
  });
});

describe("bleed-adder unit conversions", () => {
  it("mmToPoints converts mm to points", () => {
    expect(mmToPoints(1)).toBeCloseTo(2.83465, 5);
    expect(mmToPoints(3)).toBeCloseTo(8.50395, 5);
    expect(mmToPoints(0)).toBe(0);
  });
  it("inchesToPoints converts inches to points", () => {
    expect(inchesToPoints(1)).toBe(72);
    expect(inchesToPoints(0.125)).toBeCloseTo(9, 0);
  });
  it("toPoints dispatches by unit", () => {
    expect(toPoints(10, "mm")).toBeCloseTo(28.3465, 4);
    expect(toPoints(1, "inch")).toBe(72);
    expect(toPoints(50, "pt")).toBe(50);
  });
});

describe("bleed-adder applyBleedSides", () => {
  const v = 10;
  it("all-sides applies bleed to every side", () => {
    expect(applyBleedSides(v, "all-sides")).toEqual({ top: v, bottom: v, left: v, right: v });
  });
  it("top-bottom only applies to top and bottom", () => {
    const r = applyBleedSides(v, "top-bottom");
    expect(r.top).toBe(v); expect(r.bottom).toBe(v);
    expect(r.left).toBe(0); expect(r.right).toBe(0);
  });
  it("left-right only applies to left and right", () => {
    const r = applyBleedSides(v, "left-right");
    expect(r.left).toBe(v); expect(r.right).toBe(v);
    expect(r.top).toBe(0); expect(r.bottom).toBe(0);
  });
  it("top-only / bottom-only / left-only / right-only isolate a single side", () => {
    expect(applyBleedSides(v, "top-only")).toEqual({ top: v, bottom: 0, left: 0, right: 0 });
    expect(applyBleedSides(v, "bottom-only")).toEqual({ top: 0, bottom: v, left: 0, right: 0 });
    expect(applyBleedSides(v, "left-only")).toEqual({ top: 0, bottom: 0, left: v, right: 0 });
    expect(applyBleedSides(v, "right-only")).toEqual({ top: 0, bottom: 0, left: 0, right: v });
  });
  it("hasAnyBleed detects non-zero sides", () => {
    expect(hasAnyBleed(applyBleedSides(v, "top-only"))).toBe(true);
    expect(hasAnyBleed(applyBleedSides(0, "all-sides"))).toBe(false);
  });
});

describe("bleed-adder calculateNewSize + offset", () => {
  it("calculates new size for all-sides bleed", () => {
    const next = calculateNewSize({ width: 100, height: 200 }, applyBleedSides(10, "all-sides"));
    expect(next).toEqual({ width: 120, height: 220 });
  });
  it("calculates new size for top-bottom only", () => {
    const next = calculateNewSize({ width: 100, height: 200 }, applyBleedSides(10, "top-bottom"));
    expect(next).toEqual({ width: 100, height: 220 });
  });
  it("calculates new size for left-only", () => {
    const next = calculateNewSize({ width: 100, height: 200 }, applyBleedSides(10, "left-only"));
    expect(next).toEqual({ width: 110, height: 200 });
  });
  it("content offset equals (left, bottom) bleed", () => {
    const off = calculateContentOffset(applyBleedSides(10, "all-sides"));
    expect(off).toEqual({ x: 10, y: 10 });
  });
  it("content offset for left-only is (10, 0)", () => {
    const off = calculateContentOffset(applyBleedSides(10, "left-only"));
    expect(off).toEqual({ x: 10, y: 0 });
  });
});

describe("bleed-adder validatePageExtension", () => {
  it("accepts a positive page with positive bleed", () => {
    const r = validatePageExtension({ width: 100, height: 200 }, applyBleedSides(10, "all-sides"));
    expect(r.ok).toBe(true);
  });
  it("rejects a zero-size original page", () => {
    const r = validatePageExtension({ width: 0, height: 200 }, applyBleedSides(10, "all-sides"));
    expect(r.ok).toBe(false);
  });
  it("rejects a negative bleed", () => {
    const r = validatePageExtension({ width: 100, height: 200 }, { top: -1, bottom: 0, left: 0, right: 0 });
    expect(r.ok).toBe(false);
  });
  it("accepts zero bleed", () => {
    const r = validatePageExtension({ width: 100, height: 200 }, applyBleedSides(0, "all-sides"));
    expect(r.ok).toBe(true);
  });
});

describe("bleed-adder generateCropMarks", () => {
  const bleed = applyBleedSides(10, "all-sides");
  it("generates 8 lines (4 corners × 2 lines)", () => {
    const marks = generateCropMarks(100, 200, bleed, 3, 10);
    expect(marks).toHaveLength(8);
  });
  it("bottom-left corner marks are below and left of trim", () => {
    const marks = generateCropMarks(100, 200, bleed, 3, 10);
    // First two lines are bottom-left corner
    const vLine = marks[0]; // vertical (below trim)
    const hLine = marks[1]; // horizontal (left of trim)
    expect(vLine.x1).toBe(10); // x = bleed.left
    expect(vLine.y1).toBe(10 - 3); // y = bleed.bottom - offset
    expect(vLine.y2).toBe(10 - 3 - 10); // minus markLength
    expect(hLine.y1).toBe(10); // y = bleed.bottom
    expect(hLine.x1).toBe(10 - 3);
    expect(hLine.x2).toBe(10 - 3 - 10);
  });
  it("top-right corner marks are above and right of trim", () => {
    const marks = generateCropMarks(100, 200, bleed, 3, 10);
    // Last two lines are top-right corner
    const vLine = marks[6]; // vertical above trim
    const hLine = marks[7]; // horizontal right of trim
    const top = 10 + 200; // bleed.bottom + trimH
    const right = 10 + 100; // bleed.left + trimW
    expect(vLine.x1).toBe(right);
    expect(vLine.y1).toBe(top + 3);
    expect(hLine.y1).toBe(top);
    expect(hLine.x1).toBe(right + 3);
  });
});

describe("bleed-adder generateBleedMarks", () => {
  it("generates 4 marks (one per edge midpoint)", () => {
    const marks = generateBleedMarks({ width: 120, height: 220 }, 10);
    expect(marks).toHaveLength(4);
  });
  it("top mark is at page top, drawn downward", () => {
    const marks = generateBleedMarks({ width: 120, height: 220 }, 10);
    const top = marks[0];
    expect(top.y1).toBe(220);
    expect(top.y2).toBe(210);
    expect(top.x1).toBe(60);
  });
  it("clamps mark length when page is too small", () => {
    const marks = generateBleedMarks({ width: 20, height: 20 }, 100);
    // markLength clamped to min(100, 5, 5) = 5
    expect(marks[0].y1 - marks[0].y2).toBe(5);
  });
});

describe("bleed-adder calculateTrimBox", () => {
  it("returns trim box with original dimensions and offset by bleed", () => {
    const newSize = calculateNewSize({ width: 100, height: 200 }, applyBleedSides(10, "all-sides"));
    const trim = calculateTrimBox(newSize, applyBleedSides(10, "all-sides"));
    expect(trim).toEqual({ x: 10, y: 10, width: 100, height: 200 });
  });
  it("for left-only bleed, x offset equals bleed and width equals original", () => {
    const newSize = calculateNewSize({ width: 100, height: 200 }, applyBleedSides(10, "left-only"));
    const trim = calculateTrimBox(newSize, applyBleedSides(10, "left-only"));
    expect(trim.x).toBe(10);
    expect(trim.y).toBe(0);
    expect(trim.width).toBe(100);
    expect(trim.height).toBe(200);
  });
});

describe("bleed-adder calculateBleedAreaPercent", () => {
  it("returns 0 when new area equals original", () => {
    expect(calculateBleedAreaPercent(100, 200, 100, 200)).toBe(0);
  });
  it("returns correct percent for all-sides 10pt bleed on 100×200", () => {
    // new area = 120 * 220 = 26400; original = 20000; bleed = 6400; percent = 24.24
    const p = calculateBleedAreaPercent(100, 200, 120, 220);
    expect(p).toBeCloseTo(24.2, 1);
  });
  it("returns 0 for zero-size page", () => {
    expect(calculateBleedAreaPercent(0, 0, 0, 0)).toBe(0);
  });
});

describe("bleed-adder parseBackgroundColor", () => {
  it("parses #RRGGBB", () => {
    const r = parseBackgroundColor("#FF0000");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.r).toBeCloseTo(1, 3);
      expect(r.output.g).toBeCloseTo(0, 3);
      expect(r.output.b).toBeCloseTo(0, 3);
    }
  });
  it("parses without leading #", () => {
    const r = parseBackgroundColor("00FF00");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.g).toBeCloseTo(1, 3);
  });
  it("parses short #RGB form", () => {
    const r = parseBackgroundColor("#F00");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.r).toBeCloseTo(1, 3);
  });
  it("rejects invalid input", () => {
    expect(parseBackgroundColor("not-a-color").ok).toBe(false);
    expect(parseBackgroundColor("#12345").ok).toBe(false);
    expect(parseBackgroundColor("").ok).toBe(false);
  });
});

describe("bleed-adder verifyPrintReady", () => {
  it("passes ISO 3 mm when bleed >= 3 mm", () => {
    const r = verifyPrintReady(applyBleedSides(mmToPoints(3), "all-sides"), "iso-3mm");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.meets).toBe(true);
  });
  it("fails ISO 3 mm when bleed < 3 mm", () => {
    const r = verifyPrintReady(applyBleedSides(mmToPoints(2), "all-sides"), "iso-3mm");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.meets).toBe(false);
  });
  it("errors when no bleed applied", () => {
    const r = verifyPrintReady(applyBleedSides(0, "all-sides"), "iso-3mm");
    expect(r.ok).toBe(false);
  });
  it("passes US 0.125in standard", () => {
    const r = verifyPrintReady(applyBleedSides(inchesToPoints(0.125), "all-sides"), "us-0.125in");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.meets).toBe(true);
  });
});

describe("bleed-adder computeSummaryStats", () => {
  it("returns zero-stats for empty input", () => {
    const s = computeSummaryStats([]);
    expect(s.totalPages).toBe(0);
    expect(s.marksAdded).toBe(0);
  });
  it("computes total bleed area and mark count", () => {
    const pages: BleedPageResult[] = [
      {
        pageNum: 1, originalWidth: 100, originalHeight: 200,
        newWidth: 120, newHeight: 220, bleedAmountPt: 10, sides: "all-sides",
        cropMarksAdded: true, bleedMarksAdded: true, backgroundFilled: true,
      },
      {
        pageNum: 2, originalWidth: 100, originalHeight: 200,
        newWidth: 120, newHeight: 220, bleedAmountPt: 10, sides: "all-sides",
        cropMarksAdded: true, bleedMarksAdded: false, backgroundFilled: true,
      },
    ];
    const s = computeSummaryStats(pages);
    expect(s.totalPages).toBe(2);
    expect(s.originalSize).toEqual({ width: 100, height: 200 });
    expect(s.newSize).toEqual({ width: 120, height: 220 });
    // 8 crop marks × 2 pages + 4 bleed marks × 1 page = 20
    expect(s.marksAdded).toBe(20);
    expect(s.totalBleedAreaPt).toBeCloseTo(6400 * 2, 1);
  });
});

describe("bleed-adder renderers", () => {
  const pages: BleedPageResult[] = [
    {
      pageNum: 1, originalWidth: 100, originalHeight: 200,
      newWidth: 120, newHeight: 220, bleedAmountPt: 10, sides: "all-sides",
      cropMarksAdded: true, bleedMarksAdded: false, backgroundFilled: true,
    },
  ];
  it("renderTextReport includes header and page line", () => {
    const txt = renderTextReport(pages);
    expect(txt).toContain("PDF Bleed Adder");
    expect(txt).toContain("Page 1");
    expect(txt).toContain("100.0×200.0pt");
    expect(txt).toContain("120.0×220.0pt");
    expect(txt).toContain("crop ✓");
  });
  it("renderTextReport handles empty input", () => {
    expect(renderTextReport([])).toBe("No pages processed.");
  });
  it("renderCsvReport has header row", () => {
    const csv = renderCsvReport([]);
    expect(csv.split("\n")[0]).toContain("page_num");
    expect(csv.split("\n")[0]).toContain("original_width_pt");
    expect(csv.split("\n")[0]).toContain("sides");
  });
  it("renderCsvReport emits one row per page", () => {
    const csv = renderCsvReport(pages);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2); // header + 1 row
    expect(lines[1]).toContain("1,100.00,200.00,120.00,220.00,10.00,all-sides");
    expect(lines[1]).toContain("yes,no,yes");
  });
});

describe("bleed-adder history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, fileName: "a.pdf", pageCount: 3, bleedMm: 3,
      sides: "all-sides", cropMarks: true, bleedMarks: false, extendBackground: true,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, fileName: `${i}.pdf`, pageCount: 1, bleedMm: 3,
        sides: "all-sides", cropMarks: true, bleedMarks: false, extendBackground: false,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, fileName: "a.pdf", pageCount: 1, bleedMm: 3,
      sides: "all-sides", cropMarks: true, bleedMarks: false, extendBackground: true,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("bleed-adder shareable URL", () => {
  it("builds share URL with all params", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      bleedMm: 3, sides: "all-sides", extendBackground: true,
      backgroundColor: "#FFFFFF", includeCropMarks: true, includeBleedMarks: false,
    });
    expect(url).toContain("bleed=3");
    expect(url).toContain("sides=all-sides");
    expect(url).toContain("bg=1");
    expect(url).toContain("color=%23FFFFFF");
    expect(url).toContain("crop=1");
    expect(url).toContain("bmk=0");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("bleed=5&sides=top-bottom&bg=1&color=%23FF0000&crop=1&bmk=1");
    expect(p.bleedMm).toBe(5);
    expect(p.sides).toBe("top-bottom");
    expect(p.extendBackground).toBe(true);
    expect(p.backgroundColor).toBe("#FF0000");
    expect(p.includeCropMarks).toBe(true);
    expect(p.includeBleedMarks).toBe(true);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown sides value", () => {
    const p = parseShareUrl("bleed=3&sides=unknown-side");
    expect(p.sides).toBeUndefined();
    expect(p.bleedMm).toBe(3);
  });
});

// Suppress unused-import lint
export type _Unused = BleedSides;
