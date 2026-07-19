import { describe, it, expect, beforeEach } from "vitest";
import {
  STANDARDS,
  STANDARD_LABELS,
  STANDARD_CHECKS,
  CHECK_LEVELS,
  CHECK_LEVEL_LABELS,
  CHECK_IDS,
  CHECK_DESCRIPTIONS,
  CATEGORY_LABELS,
  WCAG_CRITERIA,
  DEFAULT_OPTIONS,
  normalizePageRangeSpec,
  resolveAllRange,
  normalizeRgb,
  hexToRgb,
  rgbToHex,
  relativeLuminance,
  contrastRatio,
  meetsAa,
  meetsAaa,
  classifyContrast,
  checkTitle,
  checkLanguage,
  checkStructureTree,
  checkMarkInfo,
  checkImageAltText,
  checkFormLabels,
  checkReadingOrder,
  checkColorContrast,
  checkBookmarks,
  checkTabOrder,
  checkMetadata,
  checkDisplayDocTitle,
  runAllChecks,
  filterByLevel,
  computeCompliance,
  computeAllCompliance,
  compareStandards,
  computeSummaryStats,
  criticalIssues,
  generateRecommendations,
  renderTextReport,
  renderCsvReport,
  renderJsonReport,
  renderHtmlReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type AccessibilityStandard,
  type CheckLevel,
  type DocumentA11yData,
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

function data(partial: Partial<DocumentA11yData> = {}): DocumentA11yData {
  return {
    pageCount: partial.pageCount ?? 3,
    hasTitle: partial.hasTitle ?? true,
    title: partial.title ?? "Test Document",
    hasLanguage: partial.hasLanguage ?? true,
    language: partial.language ?? "en-US",
    hasStructureTree: partial.hasStructureTree ?? true,
    hasMarkInfo: partial.hasMarkInfo ?? true,
    marked: partial.marked ?? true,
    hasOutline: partial.hasOutline ?? true,
    outlineCount: partial.outlineCount ?? 5,
    hasMetadata: partial.hasMetadata ?? true,
    hasDisplayDocTitle: partial.hasDisplayDocTitle ?? true,
    hasAcroForm: partial.hasAcroForm ?? false,
    formFieldCount: partial.formFieldCount ?? 0,
    formFieldsWithLabel: partial.formFieldsWithLabel ?? 0,
    imageCount: partial.imageCount ?? 0,
    imagesWithAltText: partial.imagesWithAltText ?? 0,
    pagesWithTabOrder: partial.pagesWithTabOrder ?? 3,
    contrastByPage: partial.contrastByPage ?? [],
    annotationsByPage: partial.annotationsByPage ?? [],
  };
}

// ---------------------------------------------------------------------------
describe("pdf-a11y constants", () => {
  it("exposes 5 accessibility standards", () => {
    expect(STANDARDS).toHaveLength(5);
    expect(STANDARDS).toContain("wcag-2.1-aa");
    expect(STANDARDS).toContain("wcag-2.1-aaa");
    expect(STANDARDS).toContain("pdf-ua-1");
    expect(STANDARDS).toContain("section-508");
    expect(STANDARDS).toContain("all");
  });

  it("standard labels cover every standard", () => {
    for (const s of STANDARDS) expect(typeof STANDARD_LABELS[s]).toBe("string");
  });

  it("exposes 3 check levels", () => {
    expect(CHECK_LEVELS).toHaveLength(3);
    expect(CHECK_LEVELS).toContain("errors-only");
    expect(CHECK_LEVELS).toContain("errors-and-warnings");
    expect(CHECK_LEVELS).toContain("full");
  });

  it("check-level labels cover every level", () => {
    for (const l of CHECK_LEVELS) expect(typeof CHECK_LEVEL_LABELS[l]).toBe("string");
  });

  it("exposes 12 check IDs with descriptions", () => {
    expect(CHECK_IDS).toHaveLength(12);
    for (const id of CHECK_IDS) {
      expect(typeof CHECK_DESCRIPTIONS[id]).toBe("string");
      expect(typeof WCAG_CRITERIA[id]).toBe("string");
    }
  });

  it("category labels cover every category", () => {
    expect(Object.keys(CATEGORY_LABELS).length).toBeGreaterThanOrEqual(8);
  });

  it("each standard has a list of required checks", () => {
    for (const s of STANDARDS) {
      expect(Array.isArray(STANDARD_CHECKS[s])).toBe(true);
      expect(STANDARD_CHECKS[s].length).toBeGreaterThan(0);
    }
  });

  it("'all' standard includes every check", () => {
    expect(STANDARD_CHECKS["all"]).toHaveLength(CHECK_IDS.length);
  });

  it("default options are sensible", () => {
    expect(DEFAULT_OPTIONS.standard).toBe("all");
    expect(DEFAULT_OPTIONS.checkLevel).toBe("full");
    expect(DEFAULT_OPTIONS.pageRange).toBe("all");
    expect(DEFAULT_OPTIONS.includeRecommendations).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-a11y page-range normalization", () => {
  it("returns 'all' for empty", () => {
    expect(normalizePageRangeSpec("")).toBe("all");
    expect(normalizePageRangeSpec("   ")).toBe("all");
  });

  it("passes 'all' through", () => {
    expect(normalizePageRangeSpec("all")).toBe("all");
    expect(normalizePageRangeSpec("ALL")).toBe("all");
  });

  it("lowercases and collapses whitespace", () => {
    expect(normalizePageRangeSpec("  1-3,  5 , 8-10 ")).toBe("1-3, 5 , 8-10");
  });

  it("resolves 'all' to 1-N", () => {
    expect(resolveAllRange("all", 5)).toBe("1-5");
    expect(resolveAllRange("all", 0)).toBe("1");
  });

  it("passes through non-all specs", () => {
    expect(resolveAllRange("1-3, 5", 10)).toBe("1-3, 5");
  });
});

// ---------------------------------------------------------------------------
describe("pdf-a11y color contrast", () => {
  it("normalizes 0–1 RGB to 0–255", () => {
    expect(normalizeRgb(1, 0, 0.5)).toEqual({ r: 255, g: 0, b: 128 });
    expect(normalizeRgb(0, 0, 0)).toEqual({ r: 0, g: 0, b: 0 });
    expect(normalizeRgb(2, -1, 0.5)).toEqual({ r: 255, g: 0, b: 128 }); // clamped
  });

  it("parses hex strings", () => {
    expect(hexToRgb("#000")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb("#FFFFFF")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("#FF8800")).toEqual({ r: 255, g: 136, b: 0 });
  });

  it("converts RGB to hex", () => {
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe("#000000");
    expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe("#ffffff");
    expect(rgbToHex({ r: 255, g: 136, b: 0 })).toBe("#ff8800");
  });

  it("computes relative luminance correctly", () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
  });

  it("computes contrast ratio 21:1 for black on white", () => {
    const r = contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    expect(r).toBeCloseTo(21, 0);
  });

  it("computes contrast ratio 1:1 for same color", () => {
    const r = contrastRatio({ r: 100, g: 100, b: 100 }, { r: 100, g: 100, b: 100 });
    expect(r).toBeCloseTo(1, 5);
  });

  it("meetsAa and meetsAaa thresholds", () => {
    expect(meetsAa(4.5)).toBe(true);
    expect(meetsAa(4.49)).toBe(false);
    expect(meetsAaa(7)).toBe(true);
    expect(meetsAaa(6.99)).toBe(false);
  });

  it("classifies contrast into severity buckets", () => {
    expect(classifyContrast(3)).toBe("error");
    expect(classifyContrast(4.5)).toBe("warning");
    expect(classifyContrast(7)).toBe("info");
  });
});

// ---------------------------------------------------------------------------
describe("pdf-a11y individual checks", () => {
  it("checkTitle passes with non-empty title", () => {
    const r = checkTitle(data({ title: "Hello" }));
    expect(r.passed).toBe(true);
    expect(r.severity).toBe("info");
    expect(r.id).toBe("has-title");
  });

  it("checkTitle fails with empty title", () => {
    const r = checkTitle(data({ hasTitle: false, title: "" }));
    expect(r.passed).toBe(false);
    expect(r.severity).toBe("error");
    expect(r.recommendation).toBeTruthy();
  });

  it("checkLanguage passes with language", () => {
    const r = checkLanguage(data({ language: "fr-FR" }));
    expect(r.passed).toBe(true);
  });

  it("checkLanguage fails without language", () => {
    const r = checkLanguage(data({ hasLanguage: false, language: "" }));
    expect(r.passed).toBe(false);
    expect(r.severity).toBe("error");
  });

  it("checkStructureTree passes when present", () => {
    expect(checkStructureTree(data({ hasStructureTree: true })).passed).toBe(true);
    expect(checkStructureTree(data({ hasStructureTree: false })).passed).toBe(false);
  });

  it("checkMarkInfo passes when marked", () => {
    expect(checkMarkInfo(data({ hasMarkInfo: true, marked: true })).passed).toBe(true);
    expect(checkMarkInfo(data({ hasMarkInfo: false, marked: false })).passed).toBe(false);
  });

  it("checkImageAltText skips when no images", () => {
    const r = checkImageAltText(data({ imageCount: 0 }));
    expect(r.passed).toBe(true);
    expect(r.message).toContain("No images");
  });

  it("checkImageAltText fails when missing alt text", () => {
    const r = checkImageAltText(data({ imageCount: 5, imagesWithAltText: 3 }));
    expect(r.passed).toBe(false);
    expect(r.severity).toBe("error");
    expect(r.message).toContain("2 of 5");
  });

  it("checkFormLabels skips when no form", () => {
    const r = checkFormLabels(data({ hasAcroForm: false, formFieldCount: 0 }));
    expect(r.passed).toBe(true);
  });

  it("checkFormLabels fails when labels missing", () => {
    const r = checkFormLabels(data({ hasAcroForm: true, formFieldCount: 4, formFieldsWithLabel: 1 }));
    expect(r.passed).toBe(false);
    expect(r.message).toContain("3 of 4");
  });

  it("checkReadingOrder passes with structure tree", () => {
    expect(checkReadingOrder(data({ hasStructureTree: true })).passed).toBe(true);
  });

  it("checkReadingOrder fails without structure or tab order", () => {
    const r = checkReadingOrder(data({ hasStructureTree: false, pagesWithTabOrder: 0 }));
    expect(r.passed).toBe(false);
    expect(r.severity).toBe("warning");
  });

  it("checkColorContrast passes when no failing pairs", () => {
    const r = checkColorContrast(data({
      contrastByPage: [
        { pageNumber: 1, pairsChecked: 5, failingPairs: 0, lowestRatio: 12 },
      ],
    }));
    expect(r.passed).toBe(true);
  });

  it("checkColorContrast fails when pairs fail", () => {
    const r = checkColorContrast(data({
      contrastByPage: [
        { pageNumber: 1, pairsChecked: 5, failingPairs: 2, lowestRatio: 3.2 },
      ],
    }));
    expect(r.passed).toBe(false);
    expect(r.severity).toBe("error");
    expect(r.message).toContain("3.20");
  });

  it("checkBookmarks skips single-page documents", () => {
    const r = checkBookmarks(data({ pageCount: 1 }));
    expect(r.passed).toBe(true);
  });

  it("checkBookmarks warns for multi-page without outline", () => {
    const r = checkBookmarks(data({ pageCount: 10, hasOutline: false, outlineCount: 0 }));
    expect(r.passed).toBe(false);
    expect(r.severity).toBe("warning");
  });

  it("checkTabOrder passes when all pages have tab order", () => {
    const r = checkTabOrder(data({ pageCount: 3, pagesWithTabOrder: 3 }));
    expect(r.passed).toBe(true);
  });

  it("checkTabOrder warns when some pages missing", () => {
    const r = checkTabOrder(data({ pageCount: 3, pagesWithTabOrder: 1 }));
    expect(r.passed).toBe(false);
    expect(r.message).toContain("1/3");
  });

  it("checkMetadata passes when XMP present", () => {
    expect(checkMetadata(data({ hasMetadata: true })).passed).toBe(true);
    expect(checkMetadata(data({ hasMetadata: false })).passed).toBe(false);
  });

  it("checkDisplayDocTitle passes when set", () => {
    expect(checkDisplayDocTitle(data({ hasDisplayDocTitle: true })).passed).toBe(true);
    expect(checkDisplayDocTitle(data({ hasDisplayDocTitle: false })).passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-a11y runAllChecks", () => {
  it("runs all 12 checks", () => {
    const results = runAllChecks(data());
    expect(results).toHaveLength(12);
    const ids = new Set(results.map((r) => r.id));
    for (const id of CHECK_IDS) expect(ids.has(id)).toBe(true);
  });

  it("all checks pass with a fully accessible document", () => {
    const results = runAllChecks(data());
    expect(results.every((r) => r.passed)).toBe(true);
  });

  it("flags failures in an inaccessible document", () => {
    const results = runAllChecks(data({
      hasTitle: false,
      title: "",
      hasLanguage: false,
      language: "",
      hasStructureTree: false,
      hasMarkInfo: false,
      marked: false,
      imageCount: 5,
      imagesWithAltText: 0,
      hasAcroForm: true,
      formFieldCount: 3,
      formFieldsWithLabel: 0,
      hasOutline: false,
      outlineCount: 0,
      hasMetadata: false,
      hasDisplayDocTitle: false,
      pagesWithTabOrder: 0,
      contrastByPage: [{ pageNumber: 1, pairsChecked: 4, failingPairs: 2, lowestRatio: 2.5 }],
    }));
    const passedCount = results.filter((r) => r.passed).length;
    expect(passedCount).toBeLessThan(results.length);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-a11y filterByLevel", () => {
  const results = runAllChecks(data({
    hasTitle: false,
    title: "",
    hasOutline: false,
    outlineCount: 0,
    pageCount: 10,
    hasMetadata: false,
    hasDisplayDocTitle: false,
  }));

  it("errors-only returns only errors", () => {
    const filtered = filterByLevel(results, "errors-only");
    expect(filtered.every((r) => r.severity === "error")).toBe(true);
    expect(filtered.length).toBeGreaterThan(0);
  });

  it("errors-and-warnings returns errors and warnings", () => {
    const filtered = filterByLevel(results, "errors-and-warnings");
    expect(filtered.every((r) => r.severity === "error" || r.severity === "warning")).toBe(true);
  });

  it("full returns everything", () => {
    const filtered = filterByLevel(results, "full");
    expect(filtered.length).toBe(results.length);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-a11y compliance calculation", () => {
  it("computes compliance for a single standard", () => {
    const results = runAllChecks(data());
    const c = computeCompliance(results, "wcag-2.1-aa");
    expect(c.standard).toBe("wcag-2.1-aa");
    expect(c.totalChecks).toBe(STANDARD_CHECKS["wcag-2.1-aa"].length);
    expect(c.compliancePct).toBe(100);
  });

  it("reports 0% compliance when all checks fail", () => {
    const results = runAllChecks(data({
      hasTitle: false,
      title: "",
      hasLanguage: false,
      language: "",
      hasStructureTree: false,
      hasMarkInfo: false,
      marked: false,
      imageCount: 5,
      imagesWithAltText: 0,
      hasAcroForm: true,
      formFieldCount: 3,
      formFieldsWithLabel: 0,
      hasOutline: false,
      outlineCount: 0,
      hasMetadata: false,
      hasDisplayDocTitle: false,
      pagesWithTabOrder: 0,
      contrastByPage: [{ pageNumber: 1, pairsChecked: 4, failingPairs: 4, lowestRatio: 2 }],
    }));
    const c = computeCompliance(results, "pdf-ua-1");
    expect(c.compliancePct).toBeLessThan(50);
  });

  it("computeAllCompliance returns one entry per standard when 'all'", () => {
    const results = runAllChecks(data());
    const cs = computeAllCompliance(results, "all");
    expect(cs).toHaveLength(4);
    const labels = cs.map((c) => c.standard);
    expect(labels).toContain("wcag-2.1-aa");
    expect(labels).toContain("wcag-2.1-aaa");
    expect(labels).toContain("pdf-ua-1");
    expect(labels).toContain("section-508");
  });

  it("computeAllCompliance returns one entry when single standard", () => {
    const results = runAllChecks(data());
    expect(computeAllCompliance(results, "wcag-2.1-aa")).toHaveLength(1);
  });

  it("compareStandards returns best and worst", () => {
    const cs = computeAllCompliance(runAllChecks(data()), "all");
    const { best, worst } = compareStandards(cs);
    expect(best).toBeTruthy();
    expect(worst).toBeTruthy();
    expect(best!.compliancePct).toBeGreaterThanOrEqual(worst!.compliancePct);
  });

  it("compareStandards handles empty input", () => {
    expect(compareStandards([])).toEqual({ best: null, worst: null });
  });
});

// ---------------------------------------------------------------------------
describe("pdf-a11y summary stats & critical issues", () => {
  it("computes summary stats", () => {
    const results = runAllChecks(data({
      hasTitle: false,
      title: "",
      hasOutline: false,
      outlineCount: 0,
      pageCount: 10,
      hasMetadata: false,
    }));
    const s = computeSummaryStats(results, 10);
    expect(s.totalChecks).toBe(12);
    expect(s.passed).toBeLessThan(12);
    expect(s.failed).toBeGreaterThan(0);
    expect(s.warnings).toBeGreaterThan(0);
    expect(s.compliancePct).toBeLessThan(100);
    expect(s.criticalIssues).toBe(s.failed);
  });

  it("groups failures by category", () => {
    const results = runAllChecks(data({
      hasTitle: false,
      title: "",
      hasOutline: false,
      outlineCount: 0,
      pageCount: 10,
    }));
    const s = computeSummaryStats(results, 10);
    expect(s.byCategory["document"]).toBeGreaterThan(0);
    expect(s.byCategory["navigation"]).toBeGreaterThan(0);
  });

  it("groups failures by page", () => {
    const results = runAllChecks(data({
      hasTitle: false,
      title: "",
    }));
    const s = computeSummaryStats(results, 3);
    // Document-level failures map to page 0.
    expect(s.byPage.find((p) => p.pageNumber === 0)?.count ?? 0).toBeGreaterThan(0);
  });

  it("criticalIssues returns only failed errors", () => {
    const results = runAllChecks(data({
      hasTitle: false,
      title: "",
      hasOutline: false,
      outlineCount: 0,
      pageCount: 10,
      hasMetadata: false,
    }));
    const critical = criticalIssues(results);
    expect(critical.length).toBeGreaterThan(0);
    expect(critical.every((r) => !r.passed && r.severity === "error")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-a11y recommendations", () => {
  it("generates recommendations for failed checks", () => {
    const results = runAllChecks(data({
      hasTitle: false,
      title: "",
      hasStructureTree: false,
    }));
    const recs = generateRecommendations(results);
    expect(recs.length).toBeGreaterThan(0);
    // Errors should be sorted first.
    const firstErrorIdx = recs.findIndex((r) => r.severity === "error");
    const firstWarnIdx = recs.findIndex((r) => r.severity === "warning");
    if (firstWarnIdx >= 0 && firstErrorIdx >= 0) {
      expect(firstErrorIdx).toBeLessThan(firstWarnIdx);
    }
  });

  it("returns empty when all checks pass", () => {
    const results = runAllChecks(data());
    expect(generateRecommendations(results)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-a11y renderers", () => {
  it("renderTextReport produces a readable report", () => {
    const results = runAllChecks(data());
    const summary = computeSummaryStats(results, 3);
    const compliance = computeAllCompliance(results, "all");
    const text = renderTextReport(results, summary, compliance);
    expect(text).toContain("PDF Accessibility Report");
    expect(text).toContain("Compliance by standard");
    expect(text).toContain("WCAG 2.1 AA");
  });

  it("renderCsvReport produces a CSV header", () => {
    const csv = renderCsvReport([]);
    expect(csv).toContain("check_id,category,status,severity,page,wcag,message");
  });

  it("renderCsvReport produces rows", () => {
    const results = runAllChecks(data());
    const csv = renderCsvReport(results);
    expect(csv.split("\n").length).toBe(results.length + 1);
  });

  it("renderJsonReport produces valid JSON", () => {
    const results = runAllChecks(data());
    const summary = computeSummaryStats(results, 3);
    const compliance = computeAllCompliance(results, "all");
    const json = renderJsonReport(results, summary, compliance);
    const parsed = JSON.parse(json);
    expect(parsed.summary.totalChecks).toBe(12);
    expect(parsed.compliance).toHaveLength(4);
    expect(parsed.checks).toHaveLength(12);
  });

  it("renderHtmlReport produces an HTML document", () => {
    const results = runAllChecks(data());
    const summary = computeSummaryStats(results, 3);
    const compliance = computeAllCompliance(results, "all");
    const html = renderHtmlReport(results, summary, compliance);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("PDF Accessibility Report");
    expect(html).toContain("<table>");
  });
});

// ---------------------------------------------------------------------------
describe("pdf-a11y history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      fileName: "test.pdf",
      pageCount: 5,
      standard: "wcag-2.1-aa",
      compliancePct: 80,
      criticalIssues: 2,
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
        standard: "all",
        compliancePct: 80,
        criticalIssues: 2,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });

  it("clears", () => {
    saveHistory({
      ts: 1,
      fileName: "test.pdf",
      pageCount: 5,
      standard: "all",
      compliancePct: 80,
      criticalIssues: 2,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
describe("pdf-a11y shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, standard: "pdf-ua-1", checkLevel: "errors-only", pageRange: "1-5" });
    expect(url).toContain("standard=pdf-ua-1");
    expect(url).toContain("level=errors-only");
    expect(url).toContain("range=1-5");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("parses share URL back", () => {
    const p = parseShareUrl("standard=wcag-2.1-aaa&level=full&range=all&recs=1");
    expect(p.standard).toBe("wcag-2.1-aaa");
    expect(p.checkLevel).toBe("full");
    expect(p.pageRange).toBe("all");
    expect(p.includeRecommendations).toBe(true);
  });

  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });

  it("filters unknown standards", () => {
    const p = parseShareUrl("standard=invalid");
    expect(p.standard).toBeUndefined();
  });

  it("filters unknown levels", () => {
    const p = parseShareUrl("level=invalid");
    expect(p.checkLevel).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
describe("pdf-a11y validateOptions", () => {
  it("validates default options", () => {
    const r = validateOptions(DEFAULT_OPTIONS, 5);
    expect(r.ok).toBe(true);
  });

  it("rejects unknown standard", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, standard: "bogus" as AccessibilityStandard }, 5);
    expect(r.ok).toBe(false);
  });

  it("rejects unknown level", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, checkLevel: "bogus" as CheckLevel }, 5);
    expect(r.ok).toBe(false);
  });

  it("rejects invalid page range", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, pageRange: "abc" }, 5);
    expect(r.ok).toBe(false);
  });

  it("accepts valid page range", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, pageRange: "1-3, 5" }, 5);
    expect(r.ok).toBe(true);
  });

  it("normalizes 'all' page range", () => {
    const r = validateOptions({ ...DEFAULT_OPTIONS, pageRange: "ALL" }, 5);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output.pageRange).toBe("all");
  });
});
