import { describe, it, expect, beforeEach } from "vitest";
import {
  VARIABLES,
  POSITION_PRESETS,
  POSITION_LABELS,
  PAGE_NUMBER_FORMATS,
  PAGE_NUMBER_FORMAT_LABELS,
  DATE_FORMATS,
  DATE_FORMAT_LABELS,
  DEFAULT_OPTIONS,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  MARGIN_MAX,
  PAGE_COUNT_MAX,
  normalizeText,
  splitMultiline,
  parseVariablesInUse,
  substituteVariables,
  checkVariableAvailability,
  formatDate,
  formatPageNumber,
  validateFontSize,
  parseHexColor,
  calculateMargin,
  validatePageCount,
  calculateX,
  calculateY,
  resolvePageRange,
  pickTextForPage,
  detectCollision,
  computeRenders,
  computeSummaryStats,
  renderTextReport,
  renderCsvReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type HeaderFooterOptions,
  type Position,
  type PageNumberFormat,
  type DateFormat,
  type PdfMetadata,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
});

function makeOpts(overrides: Partial<HeaderFooterOptions> = {}): HeaderFooterOptions {
  return { ...DEFAULT_OPTIONS, ...overrides };
}

function meta(overrides: Partial<PdfMetadata> = {}): PdfMetadata {
  return {
    title: "My Doc",
    author: "Jane",
    filename: "report",
    date: new Date(2024, 11, 31),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("pdf-header-footer-adder constants", () => {
  it("has 6 variables", () => {
    expect(VARIABLES).toHaveLength(6);
    expect(VARIABLES).toContain("{page}");
    expect(VARIABLES).toContain("{filename}");
  });

  it("has 3 position presets and labels", () => {
    expect(POSITION_PRESETS).toEqual(["left", "center", "right"]);
    expect(Object.keys(POSITION_LABELS)).toHaveLength(3);
  });

  it("has 3 page-number formats and labels", () => {
    expect(PAGE_NUMBER_FORMATS).toEqual(["x", "x-of-n", "page-x-of-n"]);
    expect(Object.keys(PAGE_NUMBER_FORMAT_LABELS)).toHaveLength(3);
  });

  it("has 3 date formats and labels", () => {
    expect(DATE_FORMATS).toEqual(["yyyy-mm-dd", "mm/dd/yyyy", "dd/mm/yyyy"]);
    expect(Object.keys(DATE_FORMAT_LABELS)).toHaveLength(3);
  });

  it("has sensible default options", () => {
    expect(DEFAULT_OPTIONS.footerText).toContain("{page}");
    expect(DEFAULT_OPTIONS.footerText).toContain("{total}");
    expect(DEFAULT_OPTIONS.fontSize).toBe(10);
    expect(DEFAULT_OPTIONS.textColor).toBe("#000000");
    expect(DEFAULT_OPTIONS.pageRange).toBe("all");
  });

  it("has font size and margin bounds", () => {
    expect(FONT_SIZE_MIN).toBeGreaterThanOrEqual(1);
    expect(FONT_SIZE_MAX).toBeGreaterThan(FONT_SIZE_MIN);
    expect(MARGIN_MAX).toBeGreaterThan(0);
    expect(PAGE_COUNT_MAX).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

describe("pdf-header-footer-adder normalizeText / splitMultiline", () => {
  it("normalizes CRLF to LF", () => {
    expect(normalizeText("a\r\nb\r\nc")).toBe("a\nb\nc");
  });

  it("splits multiline text into lines", () => {
    expect(splitMultiline("a\nb\nc")).toEqual(["a", "b", "c"]);
  });

  it("returns empty array for empty text", () => {
    expect(splitMultiline("")).toEqual([]);
  });

  it("handles single-line text", () => {
    expect(splitMultiline("hello")).toEqual(["hello"]);
  });
});

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------

describe("pdf-header-footer-adder parseVariablesInUse", () => {
  it("detects all variables", () => {
    const text = "{page} of {total} — {title} by {author} on {date} ({filename})";
    expect(parseVariablesInUse(text)).toEqual(VARIABLES);
  });

  it("returns empty for text without variables", () => {
    expect(parseVariablesInUse("plain text")).toEqual([]);
  });

  it("detects a single variable", () => {
    expect(parseVariablesInUse("Page {page}")).toEqual(["{page}"]);
  });
});

describe("pdf-header-footer-adder substituteVariables", () => {
  it("substitutes all variables", () => {
    const ctx = {
      page: 3,
      total: 10,
      title: "Report",
      author: "Jane",
      date: "2024-12-31",
      filename: "report",
    };
    const text = "{page}/{total} — {title} by {author} on {date} ({filename})";
    expect(substituteVariables(text, ctx)).toBe("3/10 — Report by Jane on 2024-12-31 (report)");
  });

  it("handles missing title/author/filename as empty", () => {
    const ctx = { page: 1, total: 1, title: "", author: "", date: "2024-12-31", filename: "" };
    expect(substituteVariables("{title}|{author}|{filename}", ctx)).toBe("||");
  });

  it("returns empty for empty text", () => {
    expect(substituteVariables("", { page: 1, total: 1, title: "", author: "", date: "", filename: "" })).toBe("");
  });

  it("leaves unknown placeholders untouched", () => {
    const ctx = { page: 1, total: 1, title: "", author: "", date: "", filename: "" };
    expect(substituteVariables("{unknown}", ctx)).toBe("{unknown}");
  });
});

describe("pdf-header-footer-adder checkVariableAvailability", () => {
  it("returns empty list when all variables available", () => {
    const ctx = { page: 1, total: 1, title: "T", author: "A", date: "D", filename: "F" };
    expect(checkVariableAvailability("{title} {author} {filename}", ctx)).toEqual([]);
  });

  it("detects missing title", () => {
    const ctx = { page: 1, total: 1, title: "", author: "A", date: "D", filename: "F" };
    expect(checkVariableAvailability("{title}", ctx)).toEqual(["{title}"]);
  });

  it("detects multiple missing", () => {
    const ctx = { page: 1, total: 1, title: "", author: "", date: "D", filename: "" };
    const missing = checkVariableAvailability("{title}{author}{filename}", ctx);
    expect(missing).toContain("{title}");
    expect(missing).toContain("{author}");
    expect(missing).toContain("{filename}");
  });

  it("page/total/date are always available", () => {
    const ctx = { page: 1, total: 1, title: "", author: "", date: "", filename: "" };
    expect(checkVariableAvailability("{page}{total}{date}", ctx)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

describe("pdf-header-footer-adder formatDate", () => {
  const d = new Date(2024, 11, 31); // Dec 31, 2024
  it("formats yyyy-mm-dd", () => {
    expect(formatDate(d, "yyyy-mm-dd")).toBe("2024-12-31");
  });
  it("formats mm/dd/yyyy", () => {
    expect(formatDate(d, "mm/dd/yyyy")).toBe("12/31/2024");
  });
  it("formats dd/mm/yyyy", () => {
    expect(formatDate(d, "dd/mm/yyyy")).toBe("31/12/2024");
  });
  it("pads single-digit months/days", () => {
    const d2 = new Date(2024, 0, 5); // Jan 5, 2024
    expect(formatDate(d2, "yyyy-mm-dd")).toBe("2024-01-05");
  });
});

describe("pdf-header-footer-adder formatPageNumber", () => {
  it("formats x", () => {
    expect(formatPageNumber("x", 3, 10)).toBe("3");
  });
  it("formats x-of-n", () => {
    expect(formatPageNumber("x-of-n", 3, 10)).toBe("3 of 10");
  });
  it("formats page-x-of-n", () => {
    expect(formatPageNumber("page-x-of-n", 3, 10)).toBe("Page 3 of 10");
  });
});

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

describe("pdf-header-footer-adder validateFontSize", () => {
  it("accepts in-range", () => {
    expect(validateFontSize(12)).toEqual({ ok: true, output: 12 });
  });
  it("rejects too small", () => {
    expect(validateFontSize(FONT_SIZE_MIN - 1).ok).toBe(false);
  });
  it("rejects too large", () => {
    expect(validateFontSize(FONT_SIZE_MAX + 1).ok).toBe(false);
  });
  it("rejects NaN", () => {
    expect(validateFontSize(NaN).ok).toBe(false);
  });
});

describe("pdf-header-footer-adder parseHexColor", () => {
  it("parses #ff0000", () => {
    expect(parseHexColor("#ff0000")).toEqual({ ok: true, output: { r: 255, g: 0, b: 0 } });
  });
  it("parses without #", () => {
    expect(parseHexColor("00ff00")).toEqual({ ok: true, output: { r: 0, g: 255, b: 0 } });
  });
  it("parses uppercase", () => {
    expect(parseHexColor("#AABBCC")).toEqual({ ok: true, output: { r: 170, g: 187, b: 204 } });
  });
  it("rejects invalid", () => {
    expect(parseHexColor("#xyz").ok).toBe(false);
    expect(parseHexColor("#12345").ok).toBe(false);
    expect(parseHexColor("").ok).toBe(false);
  });
});

describe("pdf-header-footer-adder calculateMargin", () => {
  it("clamps below min", () => {
    expect(calculateMargin(-5)).toBe(0);
  });
  it("clamps above max", () => {
    expect(calculateMargin(MARGIN_MAX + 100)).toBe(MARGIN_MAX);
  });
  it("returns value in range", () => {
    expect(calculateMargin(50)).toBe(50);
  });
  it("returns min for NaN", () => {
    expect(calculateMargin(NaN)).toBe(0);
  });
});

describe("pdf-header-footer-adder validatePageCount", () => {
  it("accepts positive count", () => {
    expect(validatePageCount(5)).toEqual({ ok: true, output: 5 });
  });
  it("rejects zero", () => {
    expect(validatePageCount(0).ok).toBe(false);
  });
  it("rejects negative", () => {
    expect(validatePageCount(-3).ok).toBe(false);
  });
  it("rejects too large", () => {
    expect(validatePageCount(PAGE_COUNT_MAX + 1).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Position & margin math
// ---------------------------------------------------------------------------

describe("pdf-header-footer-adder calculateX", () => {
  it("left = margin", () => {
    expect(calculateX("left", 612, 100, 30)).toBe(30);
  });
  it("right = pageWidth - margin - textWidth", () => {
    expect(calculateX("right", 612, 100, 30)).toBe(612 - 30 - 100);
  });
  it("center = (pageWidth - textWidth) / 2", () => {
    expect(calculateX("center", 612, 100, 30)).toBe((612 - 100) / 2);
  });
  it("left clamps negative margin to 0", () => {
    expect(calculateX("left", 612, 100, -10)).toBe(0);
  });
});

describe("pdf-header-footer-adder calculateY", () => {
  it("header y = pageHeight - margin - fontSize", () => {
    expect(calculateY("header", 792, 10, 30)).toBe(792 - 30 - 10);
  });
  it("footer y = margin", () => {
    expect(calculateY("footer", 792, 10, 30)).toBe(30);
  });
  it("header respects lineOffset (multi-line)", () => {
    const fs = 10;
    const lh = fs * 1.2;
    const base = calculateY("header", 792, fs, 30, 0);
    const line1 = calculateY("header", 792, fs, 30, 1, lh);
    expect(line1).toBe(base - lh);
  });
  it("footer respects lineOffset (multi-line, going up)", () => {
    const fs = 10;
    const lh = fs * 1.2;
    const base = calculateY("footer", 792, fs, 30, 0);
    const line1 = calculateY("footer", 792, fs, 30, 1, lh);
    expect(line1).toBe(base + lh);
  });
});

// ---------------------------------------------------------------------------
// Page range
// ---------------------------------------------------------------------------

describe("pdf-header-footer-adder resolvePageRange", () => {
  it("'all' returns every page", () => {
    const r = resolvePageRange("all", 5);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.size).toBe(5);
  });
  it("empty spec returns all", () => {
    const r = resolvePageRange("", 3);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.size).toBe(3);
  });
  it("'1-3, 5' returns 4 pages", () => {
    const r = resolvePageRange("1-3, 5", 5);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Array.from(r.output).sort((a, b) => a - b)).toEqual([0, 1, 2, 4]);
    }
  });
  it("rejects out-of-range page", () => {
    expect(resolvePageRange("1-10", 5).ok).toBe(false);
  });
  it("rejects malformed spec", () => {
    expect(resolvePageRange("abc", 5).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// First-page handler
// ---------------------------------------------------------------------------

describe("pdf-header-footer-adder pickTextForPage", () => {
  it("returns main header/footer when firstPageDifferent is off", () => {
    const opts = makeOpts({ headerText: "H", footerText: "F" });
    expect(pickTextForPage(0, opts)).toEqual({ headerText: "H", footerText: "F" });
    expect(pickTextForPage(5, opts)).toEqual({ headerText: "H", footerText: "F" });
  });
  it("returns first-page header/footer for page 0 when enabled", () => {
    const opts = makeOpts({
      firstPageDifferent: true,
      headerText: "H",
      footerText: "F",
      firstPageHeader: "FH",
      firstPageFooter: "FF",
    });
    expect(pickTextForPage(0, opts)).toEqual({ headerText: "FH", footerText: "FF" });
    expect(pickTextForPage(1, opts)).toEqual({ headerText: "H", footerText: "F" });
  });
  it("handles empty first-page text (means no header/footer on first page)", () => {
    const opts = makeOpts({
      firstPageDifferent: true,
      headerText: "H",
      footerText: "F",
      firstPageHeader: "",
      firstPageFooter: "",
    });
    expect(pickTextForPage(0, opts)).toEqual({ headerText: "", footerText: "" });
  });
});

// ---------------------------------------------------------------------------
// Collision detector
// ---------------------------------------------------------------------------

describe("pdf-header-footer-adder detectCollision", () => {
  it("detects header collision", () => {
    // Page height 792, margin 30, font 10. Header band: [752, 762].
    const bands = [{ yMin: 750, yMax: 760 }];
    expect(detectCollision("header", 792, 10, 30, bands)).toBe(true);
  });
  it("detects footer collision", () => {
    // Footer band: [30, 40].
    const bands = [{ yMin: 35, yMax: 50 }];
    expect(detectCollision("footer", 792, 10, 30, bands)).toBe(true);
  });
  it("no collision when bands don't overlap", () => {
    const bands = [{ yMin: 100, yMax: 200 }];
    expect(detectCollision("header", 792, 10, 30, bands)).toBe(false);
    expect(detectCollision("footer", 792, 10, 30, bands)).toBe(false);
  });
  it("no collision with empty bands", () => {
    expect(detectCollision("header", 792, 10, 30, [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Renders + summary
// ---------------------------------------------------------------------------

describe("pdf-header-footer-adder computeRenders", () => {
  it("computes renders with substituted variables", () => {
    const opts = makeOpts({ headerText: "Title: {title}", footerText: "{page}/{total}" });
    const r = computeRenders(3, opts, meta());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toHaveLength(3);
    expect(r.output[0].headerText).toBe("Title: My Doc");
    expect(r.output[0].footerText).toBe("1/3");
    expect(r.output[2].footerText).toBe("3/3");
    expect(r.output[0].skipped).toBe(false);
  });

  it("skips pages outside the range", () => {
    const opts = makeOpts({ pageRange: "2-3" });
    const r = computeRenders(5, opts, meta());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output[0].skipped).toBe(true);
    expect(r.output[1].skipped).toBe(false);
    expect(r.output[2].skipped).toBe(false);
    expect(r.output[3].skipped).toBe(true);
  });

  it("uses first-page text when enabled", () => {
    const opts = makeOpts({
      firstPageDifferent: true,
      headerText: "H",
      footerText: "F",
      firstPageHeader: "FIRST",
      firstPageFooter: "FP",
    });
    const r = computeRenders(2, opts, meta());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output[0].headerText).toBe("FIRST");
    expect(r.output[0].footerText).toBe("FP");
    expect(r.output[1].headerText).toBe("H");
    expect(r.output[1].footerText).toBe("F");
  });

  it("rejects invalid page count", () => {
    expect(computeRenders(0, makeOpts(), meta()).ok).toBe(false);
  });

  it("rejects invalid page range", () => {
    expect(computeRenders(3, makeOpts({ pageRange: "abc" }), meta()).ok).toBe(false);
  });
});

describe("pdf-header-footer-adder computeSummaryStats", () => {
  it("computes stats correctly", () => {
    const renders = [
      { pageNumber: 1, headerText: "H", footerText: "F", headerPosition: "left" as Position, footerPosition: "right" as Position, skipped: false },
      { pageNumber: 2, headerText: "H", footerText: "F", headerPosition: "left" as Position, footerPosition: "right" as Position, skipped: false },
      { pageNumber: 3, headerText: "", footerText: "", headerPosition: "left" as Position, footerPosition: "right" as Position, skipped: true },
    ];
    const stats = computeSummaryStats(renders);
    expect(stats.totalPages).toBe(3);
    expect(stats.processedPages).toBe(2);
    expect(stats.skippedPages).toBe(1);
    expect(stats.pagesWithHeader).toBe(2);
    expect(stats.pagesWithFooter).toBe(2);
    expect(stats.byHeaderPosition.left).toBe(2);
    expect(stats.byFooterPosition.right).toBe(2);
  });

  it("handles empty renders", () => {
    const stats = computeSummaryStats([]);
    expect(stats.totalPages).toBe(0);
    expect(stats.processedPages).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

describe("pdf-header-footer-adder renderTextReport", () => {
  it("renders header + summary", () => {
    const renders = [
      { pageNumber: 1, headerText: "H", footerText: "F", headerPosition: "left" as Position, footerPosition: "right" as Position, skipped: false },
    ];
    const stats = computeSummaryStats(renders);
    const text = renderTextReport(renders, stats);
    expect(text).toContain("PDF Header/Footer Report");
    expect(text).toContain("Total pages: 1");
    expect(text).toContain("Page 1:");
    expect(text).toContain("Header [left]: H");
    expect(text).toContain("Footer [right]: F");
  });

  it("renders skipped pages", () => {
    const renders = [
      { pageNumber: 1, headerText: "", footerText: "", headerPosition: "left" as Position, footerPosition: "right" as Position, skipped: true },
    ];
    const stats = computeSummaryStats(renders);
    expect(renderTextReport(renders, stats)).toContain("skipped (outside range)");
  });
});

describe("pdf-header-footer-adder renderCsvReport", () => {
  it("renders CSV header row", () => {
    expect(renderCsvReport([])).toContain("page,header_text,footer_text,header_position,footer_position,skipped");
  });

  it("renders rows with escaping", () => {
    const renders = [
      { pageNumber: 1, headerText: 'He said "hi"', footerText: "F", headerPosition: "left" as Position, footerPosition: "right" as Position, skipped: false },
    ];
    const csv = renderCsvReport(renders);
    expect(csv).toContain('1,"He said ""hi""",F,left,right,false');
  });
});

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

describe("pdf-header-footer-adder history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, fileName: "a.pdf", pageCount: 3, headerPreview: "H", footerPreview: "F", pagesProcessed: 3 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, fileName: `f${i}.pdf`, pageCount: 1, headerPreview: "H", footerPreview: "F", pagesProcessed: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, fileName: "a.pdf", pageCount: 1, headerPreview: "H", footerPreview: "F", pagesProcessed: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Share URL
// ---------------------------------------------------------------------------

describe("pdf-header-footer-adder shareable URL", () => {
  it("builds URL with non-default options", () => {
    const opts = makeOpts({ headerText: "Hi", fontSize: 14, textColor: "#ff0000" });
    const url = buildShareUrl(opts);
    expect(url).toContain("h=Hi");
    expect(url).toContain("fs=14");
    expect(url).toContain("tc=%23ff0000");
  });

  it("builds minimal URL when all defaults", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(DEFAULT_OPTIONS);
    // The default footer text is "Page {page} of {total}", so the 'f' param is present.
    expect(url.startsWith("?")).toBe(true);
    expect(url).toContain("f=Page");
    // No other non-default options should appear.
    expect(url).not.toContain("hp=");
    expect(url).not.toContain("fp=");
    expect(url).not.toContain("fs=");
    expect(url).not.toContain("tc=");
    expect(url).not.toContain("mt=");
    expect(url).not.toContain("mb=");
    expect(url).not.toContain("pr=");
    expect(url).not.toContain("fpd=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("parses URL back", () => {
    const hash = "h=Hi&fs=14&tc=%23ff0000&hp=left&fp=right&fpd=1&fph=Cover";
    const p = parseShareUrl(hash);
    expect(p.headerText).toBe("Hi");
    expect(p.fontSize).toBe(14);
    expect(p.textColor).toBe("#ff0000");
    expect(p.headerPosition).toBe("left");
    expect(p.footerPosition).toBe("right");
    expect(p.firstPageDifferent).toBe(true);
    expect(p.firstPageHeader).toBe("Cover");
  });

  it("filters unknown positions and formats", () => {
    const p = parseShareUrl("hp=invalid&pnf=invalid&df=invalid");
    expect(p.headerPosition).toBeUndefined();
    expect(p.pageNumberFormat).toBeUndefined();
    expect(p.dateFormat).toBeUndefined();
  });

  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// validateOptions
// ---------------------------------------------------------------------------

describe("pdf-header-footer-adder validateOptions", () => {
  it("accepts valid options", () => {
    expect(validateOptions(makeOpts(), 5).ok).toBe(true);
  });
  it("rejects invalid font size", () => {
    expect(validateOptions(makeOpts({ fontSize: 1 }), 5).ok).toBe(false);
  });
  it("rejects invalid color", () => {
    expect(validateOptions(makeOpts({ textColor: "xyz" }), 5).ok).toBe(false);
  });
  it("rejects negative margin", () => {
    expect(validateOptions(makeOpts({ marginTop: -10 }), 5).ok).toBe(false);
  });
  it("rejects invalid page range", () => {
    expect(validateOptions(makeOpts({ pageRange: "abc" }), 5).ok).toBe(false);
  });
});

// Suppress unused-import lint
export type _Unused =
  | Position
  | PageNumberFormat
  | DateFormat;
