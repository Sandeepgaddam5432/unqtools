import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_OPTIONS,
  WCAG_MAX_ALT_LENGTH,
  MIN_DESCRIPTIVE_ALT_LENGTH,
  HARD_MAX_ALT_LENGTH,
  IMAGE_TYPE_LABELS,
  normalizePageRangeSpec,
  resolveAllRange,
  parseAltTextData,
  serializeAltTextData,
  validateAltText,
  scoreAltText,
  generateAutoAltText,
  generateAutoAltEntries,
  findMissingAlt,
  formatImageList,
  buildApplyPlan,
  summarizeApplyResults,
  detectImageType,
  checkWcagCompliance,
  countImagesPerPage,
  computeSummaryStats,
  renderTextReport,
  renderCsvReport,
  renderJsonReport,
  suggestAltText,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type AltTextOptions,
  type ImageEntry,
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

function img(partial: Partial<ImageEntry> = {}): ImageEntry {
  return {
    page: partial.page ?? 1,
    imageIndex: partial.imageIndex ?? 0,
    name: partial.name ?? "Im1",
    width: partial.width ?? 200,
    height: partial.height ?? 200,
    colorSpace: partial.colorSpace ?? "DeviceRGB",
    bitsPerComponent: partial.bitsPerComponent ?? 8,
    hasAlt: partial.hasAlt ?? false,
    existingAlt: partial.existingAlt ?? "",
    isDecorative: partial.isDecorative ?? false,
    isForm: partial.isForm ?? false,
  };
}

// ---------------------------------------------------------------------------
describe("alt-text constants & defaults", () => {
  it("exposes WCAG max length constant", () => {
    expect(WCAG_MAX_ALT_LENGTH).toBe(125);
    expect(MIN_DESCRIPTIVE_ALT_LENGTH).toBe(4);
    expect(HARD_MAX_ALT_LENGTH).toBe(1000);
  });

  it("provides default options", () => {
    expect(DEFAULT_OPTIONS.pageRange).toBe("all");
    expect(DEFAULT_OPTIONS.autoGenerate).toBe(false);
    expect(DEFAULT_OPTIONS.markAsDecorative).toBe(false);
  });

  it("image type labels cover every type", () => {
    const types = ["photo", "diagram", "chart", "decorative", "unknown"] as const;
    for (const t of types) expect(typeof IMAGE_TYPE_LABELS[t]).toBe("string");
  });
});

// ---------------------------------------------------------------------------
describe("alt-text page-range helpers", () => {
  it("normalizePageRangeSpec trims and lowercases", () => {
    expect(normalizePageRangeSpec("  ALL ")).toBe("all");
    expect(normalizePageRangeSpec("1-3, 5")).toBe("1-3, 5");
    expect(normalizePageRangeSpec("")).toBe("all");
  });

  it("resolveAllRange expands 'all' to full range", () => {
    expect(resolveAllRange("all", 5)).toBe("1-5");
    expect(resolveAllRange("1-3", 5)).toBe("1-3");
    expect(resolveAllRange("all", 0)).toBe("1");
  });
});

// ---------------------------------------------------------------------------
describe("alt-text parser", () => {
  it("parses well-formed entries", () => {
    const r = parseAltTextData("1|0|Company logo\n2|1|Chart of sales by quarter");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.entries).toHaveLength(2);
      expect(r.output.entries[0]).toEqual({ page: 1, imageIndex: 0, altText: "Company logo" });
      expect(r.output.entries[1]).toEqual({ page: 2, imageIndex: 1, altText: "Chart of sales by quarter" });
      expect(r.output.skipped).toBe(0);
    }
  });

  it("skips comments and empty lines", () => {
    const r = parseAltTextData("# comment\n\n1|0|Logo");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.entries).toHaveLength(1);
  });

  it("allows spaces and commas in alt text", () => {
    const r = parseAltTextData("3|2|A graph showing x, y, and z values over time");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.entries[0].altText).toBe("A graph showing x, y, and z values over time");
  });

  it("skips malformed lines and returns examples", () => {
    const r = parseAltTextData("not a valid line\n1|0|OK");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.output.entries).toHaveLength(1);
      expect(r.output.skipped).toBe(1);
      expect(r.output.skippedExamples).toContain("not a valid line");
    }
  });

  it("rejects negative page or image index", () => {
    const r = parseAltTextData("-1|0|Foo\n0|0|Bar");
    expect(r.ok).toBe(false);
  });

  it("errors when all lines are malformed", () => {
    const r = parseAltTextData("garbage line one\ngarbage line two");
    expect(r.ok).toBe(false);
  });

  it("serializes entries back to textarea format", () => {
    const entries = [
      { page: 1, imageIndex: 0, altText: "Logo" },
      { page: 2, imageIndex: 1, altText: "Chart" },
    ];
    expect(serializeAltTextData(entries)).toBe("1|0|Logo\n2|1|Chart");
  });
});

// ---------------------------------------------------------------------------
describe("alt-text validation & scoring", () => {
  it("rejects empty alt text", () => {
    expect(validateAltText("").valid).toBe(false);
    expect(validateAltText("   ").valid).toBe(false);
  });

  it("rejects over-long alt text", () => {
    const long = "a".repeat(HARD_MAX_ALT_LENGTH + 1);
    expect(validateAltText(long).valid).toBe(false);
  });

  it("accepts reasonable alt text", () => {
    expect(validateAltText("Company logo").valid).toBe(true);
  });

  it("scores good alt text at 100", () => {
    const s = scoreAltText("A blue circle with a white checkmark in the center");
    expect(s.score).toBe(100);
    expect(s.tooShort).toBe(false);
    expect(s.tooLong).toBe(false);
    expect(s.looksLikeFilename).toBe(false);
    expect(s.looksLikePlaceholder).toBe(false);
    expect(s.suggestion).toBe("");
  });

  it("penalizes too-short alt text", () => {
    const s = scoreAltText("ab");
    expect(s.tooShort).toBe(true);
    expect(s.score).toBeLessThan(100);
    expect(s.suggestion.length).toBeGreaterThan(0);
  });

  it("penalizes filename-like alt text", () => {
    const s = scoreAltText("logo.png");
    expect(s.looksLikeFilename).toBe(true);
    expect(s.score).toBeLessThan(100);
  });

  it("penalizes placeholder-like alt text", () => {
    const s = scoreAltText("image1");
    expect(s.looksLikePlaceholder).toBe(true);
    expect(s.score).toBeLessThan(100);
  });

  it("penalizes too-long alt text", () => {
    const long = "word ".repeat(40).trim();
    const s = scoreAltText(long);
    expect(s.tooLong).toBe(true);
    expect(s.score).toBeLessThan(100);
  });
});

// ---------------------------------------------------------------------------
describe("auto-alt-text generator", () => {
  it("generates the expected placeholder text", () => {
    expect(generateAutoAltText(0, 1)).toBe("Image 1 on page 1");
    expect(generateAutoAltText(2, 5)).toBe("Image 3 on page 5");
  });

  it("generates auto entries only for images missing alt", () => {
    const images = [
      img({ page: 1, imageIndex: 0, hasAlt: true, existingAlt: "Existing" }),
      img({ page: 1, imageIndex: 1 }),
      img({ page: 2, imageIndex: 0, isDecorative: true }),
      img({ page: 2, imageIndex: 1 }),
    ];
    const entries = generateAutoAltEntries(images);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({ page: 1, imageIndex: 1, altText: "Image 2 on page 1" });
    expect(entries[1]).toEqual({ page: 2, imageIndex: 1, altText: "Image 2 on page 2" });
  });
});

// ---------------------------------------------------------------------------
describe("missing-alt finder & image list", () => {
  it("finds images missing alt", () => {
    const images = [
      img({ page: 1, imageIndex: 0, hasAlt: true, existingAlt: "Logo" }),
      img({ page: 1, imageIndex: 1 }),
      img({ page: 2, imageIndex: 0, isDecorative: true }),
    ];
    const missing = findMissingAlt(images);
    expect(missing).toHaveLength(1);
    expect(missing[0].imageIndex).toBe(1);
  });

  it("formats image list with status", () => {
    const images = [
      img({ page: 1, imageIndex: 0, hasAlt: true, existingAlt: "Logo", width: 100, height: 50, name: "Im1" }),
      img({ page: 1, imageIndex: 1, isDecorative: true }),
      img({ page: 2, imageIndex: 0 }),
    ];
    const list = formatImageList(images);
    expect(list).toHaveLength(3);
    expect(list[0]).toContain("[has alt]");
    expect(list[0]).toContain("100×50");
    expect(list[0]).toContain("Im1");
    expect(list[1]).toContain("[decorative]");
    expect(list[2]).toContain("[missing alt]");
  });
});

// ---------------------------------------------------------------------------
describe("apply-plan builder", () => {
  it("applies user-provided entries", () => {
    const images = [img({ page: 1, imageIndex: 0 })];
    const userEntries = [{ page: 1, imageIndex: 0, altText: "My logo" }];
    const plan = buildApplyPlan(images, userEntries, DEFAULT_OPTIONS);
    expect(plan).toHaveLength(1);
    expect(plan[0].action).toBe("applied");
    expect(plan[0].altText).toBe("My logo");
  });

  it("marks decorative when option is set and no alt provided", () => {
    const images = [img({ page: 1, imageIndex: 0 })];
    const plan = buildApplyPlan(images, [], { ...DEFAULT_OPTIONS, markAsDecorative: true });
    expect(plan).toHaveLength(1);
    expect(plan[0].action).toBe("marked-decorative");
    expect(plan[0].altText).toBe("");
  });

  it("auto-generates alt text when option is set", () => {
    const images = [img({ page: 1, imageIndex: 0 })];
    const plan = buildApplyPlan(images, [], { ...DEFAULT_OPTIONS, autoGenerate: true });
    expect(plan).toHaveLength(1);
    expect(plan[0].action).toBe("applied");
    expect(plan[0].altText).toBe("Image 1 on page 1");
  });

  it("leaves existing alt untouched when no user entry", () => {
    const images = [img({ page: 1, imageIndex: 0, hasAlt: true, existingAlt: "Existing" })];
    const plan = buildApplyPlan(images, [], DEFAULT_OPTIONS);
    expect(plan).toHaveLength(0);
  });

  it("user entry overrides existing alt", () => {
    const images = [img({ page: 1, imageIndex: 0, hasAlt: true, existingAlt: "Old" })];
    const userEntries = [{ page: 1, imageIndex: 0, altText: "New" }];
    const plan = buildApplyPlan(images, userEntries, DEFAULT_OPTIONS);
    expect(plan).toHaveLength(1);
    expect(plan[0].altText).toBe("New");
  });

  it("summarizeApplyResults counts actions", () => {
    const results = [
      { page: 1, imageIndex: 0, altText: "A", action: "applied" as const, message: "ok" },
      { page: 1, imageIndex: 1, altText: "", action: "marked-decorative" as const, message: "ok" },
      { page: 2, imageIndex: 0, altText: "", action: "skipped" as const, message: "no image" },
      { page: 2, imageIndex: 1, altText: "", action: "unchanged" as const, message: "had alt" },
      { page: 3, imageIndex: 0, altText: "", action: "error" as const, message: "fail" },
    ];
    const s = summarizeApplyResults(results);
    expect(s).toEqual({ applied: 1, markedDecorative: 1, skipped: 1, unchanged: 1, error: 1 });
  });
});

// ---------------------------------------------------------------------------
describe("image type detector", () => {
  it("detects decorative by isDecorative flag", () => {
    expect(detectImageType(img({ isDecorative: true }))).toBe("decorative");
  });

  it("detects tiny images as decorative", () => {
    expect(detectImageType(img({ width: 16, height: 16 }))).toBe("decorative");
  });

  it("detects chart by name", () => {
    expect(detectImageType(img({ name: "chart1" }))).toBe("chart");
  });

  it("detects diagram by name", () => {
    expect(detectImageType(img({ name: "diagram_x" }))).toBe("diagram");
  });

  it("detects photo by RGB color space", () => {
    expect(detectImageType(img({ colorSpace: "DeviceRGB", name: "Im1" }))).toBe("photo");
  });

  it("detects diagram by grayscale color space", () => {
    expect(detectImageType(img({ colorSpace: "DeviceGray", name: "Im1" }))).toBe("diagram");
  });

  it("detects diagram by 1-bpc", () => {
    expect(detectImageType(img({ bitsPerComponent: 1, colorSpace: "DeviceRGB", name: "Im1" }))).toBe("diagram");
  });
});

// ---------------------------------------------------------------------------
describe("WCAG compliance checker", () => {
  it("reports pass when all informative images have alt", () => {
    const images = [
      img({ page: 1, imageIndex: 0, hasAlt: true, existingAlt: "Logo" }),
      img({ page: 1, imageIndex: 1, isDecorative: true }),
    ];
    const w = checkWcagCompliance(images);
    expect(w.passed).toBe(true);
    expect(w.compliancePct).toBe(100);
    expect(w.withAlt).toBe(1);
    expect(w.decorative).toBe(1);
    expect(w.missing).toBe(0);
  });

  it("reports fail when informative images lack alt", () => {
    const images = [
      img({ page: 1, imageIndex: 0, hasAlt: true, existingAlt: "Logo" }),
      img({ page: 1, imageIndex: 1 }),
      img({ page: 2, imageIndex: 0 }),
    ];
    const w = checkWcagCompliance(images);
    expect(w.passed).toBe(false);
    expect(w.missing).toBe(2);
    expect(w.compliancePct).toBeLessThan(100);
    expect(w.issues).toHaveLength(2);
  });

  it("treats empty alt as missing (unless decorative)", () => {
    const images = [img({ page: 1, imageIndex: 0, hasAlt: true, existingAlt: "   " })];
    const w = checkWcagCompliance(images);
    expect(w.missing).toBe(1);
  });

  it("is 100% compliant when no images exist", () => {
    const w = checkWcagCompliance([]);
    expect(w.compliancePct).toBe(100);
    expect(w.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("count images per page", () => {
  it("groups images by page with alt/decorative/missing counts", () => {
    const images = [
      img({ page: 1, imageIndex: 0, hasAlt: true, existingAlt: "A" }),
      img({ page: 1, imageIndex: 1, isDecorative: true }),
      img({ page: 2, imageIndex: 0 }),
    ];
    const perPage = countImagesPerPage(images);
    expect(perPage).toEqual([
      { page: 1, total: 2, withAlt: 1, decorative: 1, missing: 0 },
      { page: 2, total: 1, withAlt: 0, decorative: 0, missing: 1 },
    ]);
  });
});

// ---------------------------------------------------------------------------
describe("summary stats", () => {
  it("computes summary stats with apply results", () => {
    const images = [
      img({ page: 1, imageIndex: 0, hasAlt: true, existingAlt: "Logo" }),
      img({ page: 1, imageIndex: 1 }),
      img({ page: 2, imageIndex: 0, isDecorative: true }),
    ];
    const applyResults = [
      { page: 1, imageIndex: 1, altText: "Chart", action: "applied" as const, message: "ok" },
    ];
    const s = computeSummaryStats(images, applyResults, 2);
    expect(s.totalPages).toBe(2);
    expect(s.totalImages).toBe(3);
    expect(s.imagesWithAlt).toBe(2); // 1 existing + 1 applied
    expect(s.decorativeCount).toBe(1);
    expect(s.appliedCount).toBe(1);
    expect(s.coveragePct).toBeGreaterThan(0);
    expect(s.byPage).toHaveLength(2);
  });

  it("handles empty image list", () => {
    const s = computeSummaryStats([], [], 0);
    expect(s.totalImages).toBe(0);
    expect(s.coveragePct).toBe(100);
  });
});

// ---------------------------------------------------------------------------
describe("renderers", () => {
  it("renderTextReport produces a readable report", () => {
    const images = [img({ page: 1, imageIndex: 0, hasAlt: true, existingAlt: "Logo" })];
    const applyResults: never[] = [];
    const s = computeSummaryStats(images, applyResults, 1);
    const w = checkWcagCompliance(images);
    const text = renderTextReport(images, [], s, w);
    expect(text).toContain("PDF Alt Text Report");
    expect(text).toContain("Images: 1");
    expect(text).toContain("WCAG 2.1 SC 1.1.1");
  });

  it("renderCsvReport produces a header and row", () => {
    const csv = renderCsvReport([img({ page: 1, imageIndex: 0, existingAlt: "A,B" })]);
    expect(csv.split("\n")[0]).toBe("page,image_index,name,width,height,color_space,has_alt,is_decorative,alt_text");
    expect(csv).toContain('"A,B"'); // alt text with comma is escaped
  });

  it("renderJsonReport produces valid JSON", () => {
    const images = [img({ page: 1, imageIndex: 0 })];
    const s = computeSummaryStats(images, [], 1);
    const w = checkWcagCompliance(images);
    const json = renderJsonReport(images, [], s, w);
    const parsed = JSON.parse(json);
    expect(parsed.summary.totalImages).toBe(1);
    expect(parsed.images).toHaveLength(1);
    expect(parsed.wcag.criterion).toContain("WCAG");
  });
});

// ---------------------------------------------------------------------------
describe("suggestAltText", () => {
  it("uses surrounding text when provided", () => {
    const suggestion = suggestAltText(img({ page: 1, imageIndex: 0 }), "Quarterly revenue chart for Q1 2024.");
    expect(suggestion).toBe("Quarterly revenue chart for Q1 2024");
  });

  it("falls back to auto-generated text when no surrounding text", () => {
    const suggestion = suggestAltText(img({ page: 1, imageIndex: 0 }));
    expect(suggestion).toBe("Image 1 on page 1");
  });
});

// ---------------------------------------------------------------------------
describe("history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      fileName: "test.pdf",
      pageCount: 5,
      totalImages: 10,
      appliedCount: 8,
      decorativeCount: 2,
      wcagPct: 80,
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].fileName).toBe("test.pdf");
  });

  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        fileName: `test-${i}.pdf`,
        pageCount: 5,
        totalImages: 10,
        appliedCount: 8,
        decorativeCount: 2,
        wcagPct: 80,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });

  it("clears", () => {
    saveHistory({
      ts: 1,
      fileName: "test.pdf",
      pageCount: 5,
      totalImages: 10,
      appliedCount: 8,
      decorativeCount: 2,
      wcagPct: 80,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, pageRange: "1-5", autoGenerate: true, markAsDecorative: false });
    expect(url).toContain("range=1-5");
    expect(url).toContain("auto=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("parses share URL back", () => {
    const p = parseShareUrl("range=1-3&auto=1&decorative=1");
    expect(p.pageRange).toBe("1-3");
    expect(p.autoGenerate).toBe(true);
    expect(p.markAsDecorative).toBe(true);
  });

  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
});

// ---------------------------------------------------------------------------
describe("validateOptions", () => {
  it("validates default options", () => {
    const r = validateOptions(DEFAULT_OPTIONS, 5);
    expect(r.ok).toBe(true);
  });

  it("rejects invalid page range", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, pageRange: "abc" }, 5);
    expect(r.ok).toBe(false);
  });

  it("accepts 'all' page range", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, pageRange: "all" }, 5);
    expect(r.ok).toBe(true);
  });

  it("rejects both autoGenerate and markAsDecorative at once", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, autoGenerate: true, markAsDecorative: true }, 5);
    expect(r.ok).toBe(false);
  });

  it("accepts autoGenerate alone", () => {
    const opts: AltTextOptions = { pageRange: "all", autoGenerate: true, markAsDecorative: false };
    const r = validateOptions(opts, 5);
    expect(r.ok).toBe(true);
  });

  it("accepts markAsDecorative alone", () => {
    const opts: AltTextOptions = { pageRange: "all", autoGenerate: false, markAsDecorative: true };
    const r = validateOptions(opts, 5);
    expect(r.ok).toBe(true);
  });
});
