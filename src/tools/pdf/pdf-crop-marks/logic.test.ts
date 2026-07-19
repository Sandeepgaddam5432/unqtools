import { describe, it, expect, beforeEach } from "vitest";
import {
  MM_TO_POINTS,
  MARK_TYPES,
  MARK_TYPE_LABELS,
  MARK_COLORS,
  MARK_COLOR_LABELS,
  MARK_COLOR_DEFS,
  DENSITY_BAR_COLORS,
  PRINT_STANDARDS,
  includesCornerMarks,
  includesEdgeMarks,
  includesRegistrationCross,
  lookupMarkColor,
  markLengthToPoints,
  markWeightToPoints,
  markOffsetToPoints,
  calculateTrimBox,
  generateCornerCropMarks,
  generateEdgeCropMarks,
  generateRegistrationCrosses,
  generateBleedMarks,
  generateDensityBars,
  checkPrintStandard,
  verifyMarkVisibility,
  computeSummaryStats,
  renderTextReport,
  renderCsvReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type MarkType,
  type MarkColor,
  type MarkPageResult,
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

describe("crop-marks constants", () => {
  it("MM_TO_POINTS equals 2.83465", () => {
    expect(MM_TO_POINTS).toBeCloseTo(2.83465, 5);
  });
  it("has 4 mark types with labels", () => {
    expect(MARK_TYPES).toHaveLength(4);
    for (const t of MARK_TYPES) {
      expect(typeof MARK_TYPE_LABELS[t]).toBe("string");
      expect(MARK_TYPE_LABELS[t].length).toBeGreaterThan(0);
    }
  });
  it("has 4 mark colors with labels and rgb defs", () => {
    expect(MARK_COLORS).toHaveLength(4);
    for (const c of MARK_COLORS) {
      expect(typeof MARK_COLOR_LABELS[c]).toBe("string");
      expect(MARK_COLOR_DEFS[c].rgb).toBeDefined();
      expect(MARK_COLOR_DEFS[c].rgb.r).toBeGreaterThanOrEqual(0);
      expect(MARK_COLOR_DEFS[c].rgb.r).toBeLessThanOrEqual(1);
    }
  });
  it("registration-black has CMYK all-100% equivalent", () => {
    const c = MARK_COLOR_DEFS["registration-black"];
    expect(c.cmyk).toBeDefined();
    expect(c.cmyk!.c).toBe(1);
    expect(c.cmyk!.m).toBe(1);
    expect(c.cmyk!.y).toBe(1);
    expect(c.cmyk!.k).toBe(1);
  });
  it("has 8 density-bar colors", () => {
    expect(Object.keys(DENSITY_BAR_COLORS)).toHaveLength(8);
  });
  it("has 2 print standards with positive minimums", () => {
    expect(Object.keys(PRINT_STANDARDS)).toHaveLength(2);
    for (const k of Object.keys(PRINT_STANDARDS) as (keyof typeof PRINT_STANDARDS)[]) {
      expect(PRINT_STANDARDS[k].minMarkLengthPt).toBeGreaterThan(0);
      expect(PRINT_STANDARDS[k].minMarkOffsetPt).toBeGreaterThan(0);
    }
  });
});

describe("crop-marks mark-type selectors", () => {
  it("includesCornerMarks is true for corner-crop and both", () => {
    expect(includesCornerMarks("corner-crop")).toBe(true);
    expect(includesCornerMarks("both")).toBe(true);
    expect(includesCornerMarks("edge-crop")).toBe(false);
    expect(includesCornerMarks("registration-cross")).toBe(false);
  });
  it("includesEdgeMarks is true for edge-crop and both", () => {
    expect(includesEdgeMarks("edge-crop")).toBe(true);
    expect(includesEdgeMarks("both")).toBe(true);
    expect(includesEdgeMarks("corner-crop")).toBe(false);
    expect(includesEdgeMarks("registration-cross")).toBe(false);
  });
  it("includesRegistrationCross is true only for registration-cross", () => {
    expect(includesRegistrationCross("registration-cross")).toBe(true);
    expect(includesRegistrationCross("both")).toBe(false);
  });
});

describe("crop-marks color lookup", () => {
  it("returns the right def for known color", () => {
    expect(lookupMarkColor("black").rgb).toEqual({ r: 0, g: 0, b: 0 });
    expect(lookupMarkColor("red").rgb.r).toBeCloseTo(0.8, 2);
  });
  it("falls back to black for unknown", () => {
    // @ts-expect-error — intentionally invalid input
    const def = lookupMarkColor("purple");
    expect(def.rgb).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe("crop-marks unit conversions", () => {
  it("markLengthToPoints converts mm to points", () => {
    expect(markLengthToPoints(10)).toBeCloseTo(28.3465, 4);
    expect(markLengthToPoints(0)).toBe(0);
  });
  it("markOffsetToPoints converts mm to points", () => {
    expect(markOffsetToPoints(3)).toBeCloseTo(8.50395, 4);
  });
  it("markWeightToPoints passes through and clamps", () => {
    expect(markWeightToPoints(0.25)).toBe(0.25);
    expect(markWeightToPoints(0)).toBe(0.1); // clamped to min
    expect(markWeightToPoints(10)).toBe(5);   // clamped to max
    expect(markWeightToPoints(-1)).toBe(0.25); // invalid → default
    expect(markWeightToPoints(NaN)).toBe(0.25);
  });
});

describe("crop-marks calculateTrimBox", () => {
  it("returns page bounds when no bleed given", () => {
    expect(calculateTrimBox({ width: 100, height: 200 })).toEqual({ x: 0, y: 0, width: 100, height: 200 });
  });
  it("returns inset trim box when bleed given", () => {
    const t = calculateTrimBox({ width: 120, height: 220 }, { top: 10, bottom: 10, left: 10, right: 10 });
    expect(t).toEqual({ x: 10, y: 10, width: 100, height: 200 });
  });
});

describe("crop-marks generateCornerCropMarks", () => {
  it("generates 8 lines (4 corners × 2 lines)", () => {
    expect(generateCornerCropMarks(100, 200, 3, 10)).toHaveLength(8);
  });
  it("bottom-left corner marks are below and left of trim", () => {
    const lines = generateCornerCropMarks(100, 200, 3, 10);
    const vLine = lines[0];
    const hLine = lines[1];
    expect(vLine.x1).toBe(0);  // x = left trim edge
    expect(vLine.y1).toBe(-3); // below trim by offset
    expect(vLine.y2).toBe(-13); // minus markLength
    expect(hLine.y1).toBe(0);   // y = bottom trim edge
    expect(hLine.x1).toBe(-3);
    expect(hLine.x2).toBe(-13);
  });
  it("top-right corner marks are above and right of trim", () => {
    const lines = generateCornerCropMarks(100, 200, 3, 10);
    const vLine = lines[6];
    const hLine = lines[7];
    expect(vLine.x1).toBe(100);
    expect(vLine.y1).toBe(200 + 3);
    expect(vLine.y2).toBe(200 + 3 + 10);
    expect(hLine.y1).toBe(200);
    expect(hLine.x1).toBe(100 + 3);
    expect(hLine.x2).toBe(100 + 3 + 10);
  });
});

describe("crop-marks generateEdgeCropMarks", () => {
  it("generates 4 lines (one per edge midpoint)", () => {
    expect(generateEdgeCropMarks(100, 200, 3, 10)).toHaveLength(4);
  });
  it("top edge mark sits at trim top + offset, pointing up", () => {
    const lines = generateEdgeCropMarks(100, 200, 3, 10);
    const top = lines[0];
    expect(top.x1).toBe(50);          // midpoint
    expect(top.y1).toBe(200 + 3);
    expect(top.y2).toBe(200 + 3 + 10);
  });
  it("left edge mark sits at trim left - offset, pointing left", () => {
    const lines = generateEdgeCropMarks(100, 200, 3, 10);
    const left = lines[2];
    expect(left.y1).toBe(100);          // midpoint of height
    expect(left.x1).toBe(-3);
    expect(left.x2).toBe(-13);
  });
});

describe("crop-marks generateRegistrationCrosses", () => {
  it("generates 8 lines (4 corners × 2 arms)", () => {
    expect(generateRegistrationCrosses(100, 200, 3, 10)).toHaveLength(8);
  });
  it("bottom-left cross is centred at (-offset, -offset)", () => {
    const lines = generateRegistrationCrosses(100, 200, 3, 10);
    const hArm = lines[0];
    const vArm = lines[1];
    const cx = -3, cy = -3;
    expect(hArm.x1).toBe(cx - 5);
    expect(hArm.x2).toBe(cx + 5);
    expect(hArm.y1).toBe(cy);
    expect(vArm.x1).toBe(cx);
    expect(vArm.y1).toBe(cy - 5);
    expect(vArm.y2).toBe(cy + 5);
  });
  it("top-right cross is centred at (trimW+offset, trimH+offset)", () => {
    const lines = generateRegistrationCrosses(100, 200, 3, 10);
    const hArm = lines[6];
    const cx = 100 + 3, cy = 200 + 3;
    expect(hArm.x1).toBe(cx - 5);
    expect(hArm.x2).toBe(cx + 5);
    expect(hArm.y1).toBe(cy);
  });
});

describe("crop-marks generateBleedMarks", () => {
  it("generates 4 marks at edge midpoints", () => {
    expect(generateBleedMarks(100, 200, 10)).toHaveLength(4);
  });
  it("top bleed mark goes from trim top inward", () => {
    const marks = generateBleedMarks(100, 200, 10);
    expect(marks[0]).toEqual({ x1: 50, y1: 200, x2: 50, y2: 190 });
  });
});

describe("crop-marks generateDensityBars", () => {
  it("generates 8 bars (CMYK + RGB + gray50)", () => {
    const bars = generateDensityBars(100, 200, 5, 10, 6);
    expect(bars).toHaveLength(8);
  });
  it("bars are placed below the trim box", () => {
    const bars = generateDensityBars(100, 200, 5, 10, 6);
    for (const b of bars) {
      expect(b.y).toBeLessThan(0); // all below trim
      expect(b.y).toBe(-5 - 6);    // = -offset - barHeight
    }
  });
  it("bars are centred horizontally on the trim width", () => {
    const bars = generateDensityBars(100, 200, 5, 10, 6);
    const totalWidth = 8 * 10;
    const expectedStart = (100 - totalWidth) / 2;
    expect(bars[0].x).toBe(expectedStart);
    expect(bars[7].x).toBe(expectedStart + 7 * 10);
  });
  it("covers all 8 named colors", () => {
    const bars = generateDensityBars(100, 200, 5, 10, 6);
    const colors = bars.map((b) => b.color);
    expect(colors).toEqual([
      "cyan", "magenta", "yellow", "black",
      "red", "green", "blue", "gray50",
    ]);
  });
});

describe("crop-marks checkPrintStandard", () => {
  it("passes ISO when all params meet minimums", () => {
    const r = checkPrintStandard(5 * MM_TO_POINTS, 3 * MM_TO_POINTS, 0.25, "iso");
    expect(r.meets).toBe(true);
    expect(r.warnings).toHaveLength(0);
  });
  it("fails ISO when mark length too short", () => {
    const r = checkPrintStandard(2, 3 * MM_TO_POINTS, 0.25, "iso");
    expect(r.meets).toBe(false);
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.warnings[0]).toContain("length");
  });
  it("fails ISO when offset too small", () => {
    const r = checkPrintStandard(5 * MM_TO_POINTS, 1, 0.25, "iso");
    expect(r.meets).toBe(false);
    expect(r.warnings[0]).toContain("offset");
  });
  it("fails ISO when weight too small", () => {
    const r = checkPrintStandard(5 * MM_TO_POINTS, 3 * MM_TO_POINTS, 0.1, "iso");
    expect(r.meets).toBe(false);
    expect(r.warnings[0]).toContain("weight");
  });
  it("passes ANSI with 0.25 inch length and 0.0625 inch offset", () => {
    const r = checkPrintStandard(0.25 * 72, 0.0625 * 72, 0.25, "ansi");
    expect(r.meets).toBe(true);
  });
});

describe("crop-marks verifyMarkVisibility", () => {
  it("black marks visible on white background", () => {
    const r = verifyMarkVisibility("black", "#FFFFFF");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.meets).toBe(true);
      expect(r.output.contrast).toBeGreaterThan(0.9);
    }
  });
  it("black marks NOT visible on black background", () => {
    const r = verifyMarkVisibility("black", "#000000");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.meets).toBe(false);
  });
  it("red marks have mid contrast on white", () => {
    const r = verifyMarkVisibility("red", "#FFFFFF");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.contrast).toBeGreaterThan(0.2);
  });
  it("rejects invalid background hex", () => {
    const r = verifyMarkVisibility("black", "not-a-color");
    expect(r.ok).toBe(false);
  });
});

describe("crop-marks computeSummaryStats", () => {
  it("returns zero-stats for empty input", () => {
    const s = computeSummaryStats([]);
    expect(s.totalPages).toBe(0);
    expect(s.totalMarks).toBe(0);
  });
  it("computes total marks and density bars across pages", () => {
    const pages: MarkPageResult[] = [
      {
        pageNum: 1, markType: "corner-crop", markLengthPt: 10, markWeightPt: 0.25,
        markOffsetPt: 3, markColor: "black",
        cornerMarks: 8, edgeMarks: 0, registrationCrosses: 0, bleedMarks: 4, densityBars: 8,
      },
      {
        pageNum: 2, markType: "edge-crop", markLengthPt: 10, markWeightPt: 0.25,
        markOffsetPt: 3, markColor: "red",
        cornerMarks: 0, edgeMarks: 4, registrationCrosses: 0, bleedMarks: 4, densityBars: 8,
      },
    ];
    const s = computeSummaryStats(pages);
    expect(s.totalPages).toBe(2);
    // 8+0+0+4 + 0+4+0+4 = 20 marks
    expect(s.totalMarks).toBe(20);
    expect(s.byType["corner-crop"]).toBe(1);
    expect(s.byType["edge-crop"]).toBe(1);
    expect(s.marksPerPage).toBe(10);
    expect(s.densityBarsPerPage).toBe(8);
  });
});

describe("crop-marks renderers", () => {
  const pages: MarkPageResult[] = [
    {
      pageNum: 1, markType: "corner-crop", markLengthPt: 28.35, markWeightPt: 0.25,
      markOffsetPt: 8.5, markColor: "black",
      cornerMarks: 8, edgeMarks: 0, registrationCrosses: 0, bleedMarks: 0, densityBars: 0,
    },
  ];
  it("renderTextReport includes header and page line", () => {
    const txt = renderTextReport(pages);
    expect(txt).toContain("PDF Crop Marks");
    expect(txt).toContain("Page 1");
    expect(txt).toContain("corner-crop");
    expect(txt).toContain("Corner: 8");
  });
  it("renderTextReport handles empty input", () => {
    expect(renderTextReport([])).toBe("No pages processed.");
  });
  it("renderCsvReport has header row", () => {
    const csv = renderCsvReport([]);
    expect(csv.split("\n")[0]).toContain("page_num");
    expect(csv.split("\n")[0]).toContain("mark_type");
    expect(csv.split("\n")[0]).toContain("density_bars");
  });
  it("renderCsvReport emits one row per page", () => {
    const csv = renderCsvReport(pages);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("1,corner-crop,28.35,0.25,8.50,black");
    expect(lines[1]).toContain("8,0,0,0,0");
  });
});

describe("crop-marks history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, fileName: "a.pdf", pageCount: 3,
      markType: "corner-crop", markLengthMm: 10, markWeight: 0.25,
      markColor: "black", markOffsetMm: 3,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, fileName: `${i}.pdf`, pageCount: 1,
        markType: "corner-crop", markLengthMm: 10, markWeight: 0.25,
        markColor: "black", markOffsetMm: 3,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, fileName: "a.pdf", pageCount: 1,
      markType: "corner-crop", markLengthMm: 10, markWeight: 0.25,
      markColor: "black", markOffsetMm: 3,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("crop-marks shareable URL", () => {
  it("builds share URL with all params", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      markType: "registration-cross", markLengthMm: 10, markWeight: 0.25,
      markColor: "registration-black", markOffsetMm: 3,
      includeBleedMarks: true, includeDensityBars: false,
    });
    expect(url).toContain("type=registration-cross");
    expect(url).toContain("len=10");
    expect(url).toContain("wt=0.25");
    expect(url).toContain("col=registration-black");
    expect(url).toContain("off=3");
    expect(url).toContain("bm=1");
    expect(url).toContain("db=0");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("type=both&len=15&wt=0.5&col=red&off=5&bm=0&db=1");
    expect(p.markType).toBe("both");
    expect(p.markLengthMm).toBe(15);
    expect(p.markWeight).toBe(0.5);
    expect(p.markColor).toBe("red");
    expect(p.markOffsetMm).toBe(5);
    expect(p.includeBleedMarks).toBe(false);
    expect(p.includeDensityBars).toBe(true);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown mark type and color", () => {
    const p = parseShareUrl("type=unknown&col=purple&len=10");
    expect(p.markType).toBeUndefined();
    expect(p.markColor).toBeUndefined();
    expect(p.markLengthMm).toBe(10);
  });
});

// Suppress unused-import lint
export type _Unused = MarkType | MarkColor;
