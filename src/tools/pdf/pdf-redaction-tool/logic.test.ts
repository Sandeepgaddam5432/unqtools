import { describe, expect, it, beforeEach } from "vitest";
import {
  REDACT_COLORS,
  REDACT_MODES,
  COLOR_LABELS,
  MODE_LABELS,
  COLOR_RGB,
  DEFAULT_OPTIONS,
  METADATA_FIELDS,
  SENSITIVE_CATEGORY_LABELS,
  parseTextToRedact,
  parseAreaRedactions,
  getRedactColorRgb,
  isWithinBounds,
  validateRedactions,
  generateRedactionRectangles,
  buildMetadataStripPlan,
  checkPageBounds,
  countRedactions,
  calculateRedactedArea,
  renderTextReport,
  renderCsvReport,
  computeSummaryStats,
  checkRedactionCompleteness,
  filterAreasByPageIndices,
  detectSensitiveData,
  suggestAutoRedactions,
  verifyRedactionStrength,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type AreaRedaction,
  type PageBounds,
  type TextRedaction,
  type AppliedRedaction,
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("pdf-redaction-tool constants", () => {
  it("has 3 redact colors", () => {
    expect(REDACT_COLORS).toHaveLength(3);
    expect(REDACT_COLORS).toContain("black");
    expect(REDACT_COLORS).toContain("white");
    expect(REDACT_COLORS).toContain("dark-gray");
  });

  it("has 3 redact modes", () => {
    expect(REDACT_MODES).toHaveLength(3);
    expect(REDACT_MODES).toContain("text-search");
    expect(REDACT_MODES).toContain("area-coordinates");
    expect(REDACT_MODES).toContain("both");
  });

  it("has labels for every color and mode", () => {
    for (const c of REDACT_COLORS) expect(COLOR_LABELS[c]).toBeTruthy();
    for (const m of REDACT_MODES) expect(MODE_LABELS[m]).toBeTruthy();
  });

  it("has RGB triplets in 0–1 range for every color", () => {
    for (const c of REDACT_COLORS) {
      const { r, g, b } = COLOR_RGB[c];
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
    }
  });

  it("has a default options object with sensible defaults", () => {
    expect(DEFAULT_OPTIONS.redactColor).toBe("black");
    expect(DEFAULT_OPTIONS.redactMode).toBe("text-search");
    expect(DEFAULT_OPTIONS.removeMetadata).toBe(true);
    expect(DEFAULT_OPTIONS.pageRange).toBe("all");
  });

  it("lists metadata fields that get stripped", () => {
    expect(METADATA_FIELDS).toContain("Title");
    expect(METADATA_FIELDS).toContain("Author");
    expect(METADATA_FIELDS).toContain("Subject");
    expect(METADATA_FIELDS).toContain("Keywords");
    expect(METADATA_FIELDS).toContain("Creator");
    expect(METADATA_FIELDS).toContain("Producer");
    expect(METADATA_FIELDS.length).toBeGreaterThanOrEqual(6);
  });
});

// ---------------------------------------------------------------------------
// parseTextToRedact
// ---------------------------------------------------------------------------

describe("pdf-redaction-tool parseTextToRedact", () => {
  it("parses one phrase per line", () => {
    expect(parseTextToRedact("alpha\nbeta\ngamma")).toEqual(["alpha", "beta", "gamma"]);
  });

  it("trims whitespace around phrases", () => {
    expect(parseTextToRedact("  alpha  \n  beta ")).toEqual(["alpha", "beta"]);
  });

  it("skips blank lines", () => {
    expect(parseTextToRedact("alpha\n\nbeta\n  \ngamma")).toEqual(["alpha", "beta", "gamma"]);
  });

  it("deduplicates exact (case-sensitive) duplicates", () => {
    expect(parseTextToRedact("alpha\nalpha\nAlpha")).toEqual(["alpha", "Alpha"]);
  });

  it("returns empty for empty input", () => {
    expect(parseTextToRedact("")).toEqual([]);
    expect(parseTextToRedact("   \n  \n")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// parseAreaRedactions
// ---------------------------------------------------------------------------

describe("pdf-redaction-tool parseAreaRedactions", () => {
  it("parses one redaction per line", () => {
    const res = parseAreaRedactions("1,10,20,100,50\n2,30,40,80,60");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.output).toEqual([
        { page: 1, x: 10, y: 20, width: 100, height: 50 },
        { page: 2, x: 30, y: 40, width: 80, height: 60 },
      ]);
    }
  });

  it("trims whitespace around values", () => {
    const res = parseAreaRedactions(" 1 , 10 , 20 , 100 , 50 ");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.output[0]).toEqual({ page: 1, x: 10, y: 20, width: 100, height: 50 });
    }
  });

  it("skips blank lines and # comment lines", () => {
    const res = parseAreaRedactions("# comment\n1,0,0,10,10\n\n# another\n2,0,0,10,10");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.output).toHaveLength(2);
  });

  it("errors on too few values", () => {
    const res = parseAreaRedactions("1,10,20");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/5 comma-separated/);
  });

  it("errors on non-numeric values", () => {
    const res = parseAreaRedactions("1,foo,20,100,50");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/must be numbers/);
  });

  it("errors on non-positive-integer page", () => {
    const res = parseAreaRedactions("0,10,20,100,50");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/page must be a positive integer/);
  });

  it("errors on zero or negative width/height", () => {
    const res = parseAreaRedactions("1,10,20,0,50");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/width and height must be positive/);
  });

  it("returns empty for empty input", () => {
    const res = parseAreaRedactions("");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.output).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Color lookup & bounds checking
// ---------------------------------------------------------------------------

describe("pdf-redaction-tool getRedactColorRgb", () => {
  it("returns RGB for known colors", () => {
    expect(getRedactColorRgb("black")).toEqual({ r: 0, g: 0, b: 0 });
    expect(getRedactColorRgb("white")).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("defaults to black for unknown color", () => {
    expect(getRedactColorRgb("purple" as never)).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe("pdf-redaction-tool isWithinBounds", () => {
  it("returns true when rect is fully inside bounds", () => {
    expect(isWithinBounds({ x: 10, y: 10, width: 50, height: 50 }, 100, 100)).toBe(true);
  });

  it("returns false when rect exceeds right edge", () => {
    expect(isWithinBounds({ x: 80, y: 10, width: 50, height: 50 }, 100, 100)).toBe(false);
  });

  it("returns false when rect exceeds top edge", () => {
    expect(isWithinBounds({ x: 10, y: 80, width: 50, height: 50 }, 100, 100)).toBe(false);
  });

  it("returns false for negative origin", () => {
    expect(isWithinBounds({ x: -5, y: 10, width: 50, height: 50 }, 100, 100)).toBe(false);
  });

  it("returns false for zero or negative dimensions", () => {
    expect(isWithinBounds({ x: 10, y: 10, width: 0, height: 50 }, 100, 100)).toBe(false);
  });

  it("allows a tiny tolerance for floating-point error", () => {
    expect(isWithinBounds({ x: 0, y: 0, width: 100.4, height: 100.4 }, 100, 100)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateRedactions
// ---------------------------------------------------------------------------

describe("pdf-redaction-tool validateRedactions", () => {
  const bounds: PageBounds[] = [
    { page: 1, width: 612, height: 792 },
    { page: 2, width: 612, height: 792 },
  ];

  it("marks fully-bounded redactions valid", () => {
    const areas: AreaRedaction[] = [
      { page: 1, x: 0, y: 0, width: 100, height: 100 },
      { page: 2, x: 50, y: 50, width: 200, height: 100 },
    ];
    const r = validateRedactions(areas, bounds);
    expect(r.ok).toBe(true);
    expect(r.valid).toHaveLength(2);
    expect(r.invalid).toHaveLength(0);
    expect(r.errors).toHaveLength(0);
  });

  it("flags redactions on nonexistent pages", () => {
    const areas: AreaRedaction[] = [{ page: 99, x: 0, y: 0, width: 10, height: 10 }];
    const r = validateRedactions(areas, bounds);
    expect(r.ok).toBe(false);
    expect(r.invalid).toHaveLength(1);
    expect(r.errors[0]).toMatch(/Page 99 does not exist/);
  });

  it("flags out-of-bounds rectangles", () => {
    const areas: AreaRedaction[] = [
      { page: 1, x: 600, y: 700, width: 100, height: 100 },
    ];
    const r = validateRedactions(areas, bounds);
    expect(r.ok).toBe(false);
    expect(r.invalid).toHaveLength(1);
    expect(r.errors[0]).toMatch(/exceeds page bounds/);
  });
});

// ---------------------------------------------------------------------------
// generateRedactionRectangles
// ---------------------------------------------------------------------------

describe("pdf-redaction-tool generateRedactionRectangles", () => {
  it("clamps rectangles that extend past the page edge", () => {
    const bounds: PageBounds[] = [{ page: 1, width: 100, height: 100 }];
    const areas: AreaRedaction[] = [
      { page: 1, x: 80, y: 80, width: 50, height: 50 },
    ];
    const rects = generateRedactionRectangles(areas, bounds);
    expect(rects).toHaveLength(1);
    expect(rects[0].rect.width).toBe(20); // 100 - 80
    expect(rects[0].rect.height).toBe(20);
  });

  it("drops redactions on unknown pages", () => {
    const bounds: PageBounds[] = [{ page: 1, width: 100, height: 100 }];
    const areas: AreaRedaction[] = [
      { page: 99, x: 0, y: 0, width: 10, height: 10 },
    ];
    const rects = generateRedactionRectangles(areas, bounds);
    expect(rects).toHaveLength(0);
  });

  it("drops rectangles that clamp to zero or negative size", () => {
    const bounds: PageBounds[] = [{ page: 1, width: 100, height: 100 }];
    const areas: AreaRedaction[] = [
      { page: 1, x: 200, y: 200, width: 50, height: 50 }, // entirely off-page
    ];
    const rects = generateRedactionRectangles(areas, bounds);
    expect(rects).toHaveLength(0);
  });

  it("emits 'area' type with empty text", () => {
    const bounds: PageBounds[] = [{ page: 1, width: 100, height: 100 }];
    const areas: AreaRedaction[] = [
      { page: 1, x: 0, y: 0, width: 10, height: 10 },
    ];
    const rects = generateRedactionRectangles(areas, bounds);
    expect(rects[0].type).toBe("area");
    expect(rects[0].text).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Metadata strip plan
// ---------------------------------------------------------------------------

describe("pdf-redaction-tool buildMetadataStripPlan", () => {
  it("empties every known metadata field", () => {
    const plan = buildMetadataStripPlan();
    expect(plan.fields.length).toBe(METADATA_FIELDS.length);
    for (const f of plan.fields) {
      expect(plan.values[f]).toBe("");
    }
  });
});

// ---------------------------------------------------------------------------
// Page-bounds checker
// ---------------------------------------------------------------------------

describe("pdf-redaction-tool checkPageBounds", () => {
  it("returns ok when all pages exist", () => {
    const bounds: PageBounds[] = [{ page: 1, width: 100, height: 100 }];
    const r = checkPageBounds(
      [{ page: 1, x: 0, y: 0, width: 10, height: 10 }],
      bounds
    );
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("lists missing pages without duplicates", () => {
    const bounds: PageBounds[] = [{ page: 1, width: 100, height: 100 }];
    const r = checkPageBounds(
      [
        { page: 5, x: 0, y: 0, width: 10, height: 10 },
        { page: 5, x: 20, y: 0, width: 10, height: 10 },
        { page: 7, x: 0, y: 0, width: 10, height: 10 },
      ],
      bounds
    );
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual([5, 7]);
  });
});

// ---------------------------------------------------------------------------
// countRedactions & calculateRedactedArea
// ---------------------------------------------------------------------------

describe("pdf-redaction-tool countRedactions", () => {
  it("sums text occurrences + area rectangles", () => {
    const text: TextRedaction[] = [
      { text: "a", foundCount: 3 },
      { text: "b", foundCount: 0 },
    ];
    const areas: AreaRedaction[] = [
      { page: 1, x: 0, y: 0, width: 10, height: 10 },
      { page: 1, x: 20, y: 0, width: 10, height: 10 },
    ];
    expect(countRedactions(text, areas)).toBe(5);
  });
});

describe("pdf-redaction-tool calculateRedactedArea", () => {
  it("sums area per page and overall", () => {
    const applied: AppliedRedaction[] = [
      { type: "area", page: 1, text: "", rect: { x: 0, y: 0, width: 100, height: 50 } },
      { type: "area", page: 1, text: "", rect: { x: 0, y: 0, width: 20, height: 20 } },
      { type: "area", page: 2, text: "", rect: { x: 0, y: 0, width: 10, height: 10 } },
    ];
    const s = calculateRedactedArea(applied);
    expect(s.perPage[1]).toBe(100 * 50 + 20 * 20);
    expect(s.perPage[2]).toBe(100);
    expect(s.total).toBe(100 * 50 + 20 * 20 + 100);
  });

  it("returns zero total for empty list", () => {
    const s = calculateRedactedArea([]);
    expect(s.total).toBe(0);
    expect(Object.keys(s.perPage)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

describe("pdf-redaction-tool renderTextReport", () => {
  it("includes section headers and applied rectangles", () => {
    const text: TextRedaction[] = [{ text: "secret", foundCount: 2 }];
    const areas: AreaRedaction[] = [{ page: 1, x: 0, y: 0, width: 10, height: 10 }];
    const applied: AppliedRedaction[] = [
      { type: "text", page: 1, text: "secret", rect: { x: 0, y: 0, width: 30, height: 10 } },
      { type: "area", page: 1, text: "", rect: { x: 0, y: 0, width: 10, height: 10 } },
    ];
    const report = renderTextReport(text, areas, applied, true);
    expect(report).toContain("PDF Redaction Report");
    expect(report).toContain("Text redactions");
    expect(report).toContain('"secret" → 2 occurrence(s)');
    expect(report).toContain("Area redactions");
    expect(report).toContain("page 1: (0, 0) 10×10");
    expect(report).toContain("Applied rectangles");
    expect(report).toContain("Metadata stripped: yes");
  });
});

describe("pdf-redaction-tool renderCsvReport", () => {
  it("emits a header row plus one row per text occurrence + area", () => {
    const text: TextRedaction[] = [{ text: "secret", foundCount: 2 }];
    const areas: AreaRedaction[] = [{ page: 1, x: 0, y: 0, width: 10, height: 10 }];
    const applied: AppliedRedaction[] = [];
    const csv = renderCsvReport(text, areas, applied);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("type,page,x,y,width,height,original_value_or_area");
    // 1 header + 2 text occurrences + 1 area = 4 lines
    expect(lines).toHaveLength(4);
    expect(lines[1]).toBe("text,,,,,,secret");
    expect(lines[2]).toBe("text,,,,,,secret");
    expect(lines[3]).toBe("area,1,0,0,10,10,10x10");
  });

  it("escapes commas and quotes in the original value", () => {
    const text: TextRedaction[] = [{ text: 'a, "b"', foundCount: 1 }];
    const csv = renderCsvReport(text, [], []);
    expect(csv).toContain('"a, ""b"""');
  });
});

// ---------------------------------------------------------------------------
// Summary stats & completeness
// ---------------------------------------------------------------------------

describe("pdf-redaction-tool computeSummaryStats", () => {
  it("aggregates redactions and computes averages", () => {
    const text: TextRedaction[] = [{ text: "a", foundCount: 2 }];
    const areas: AreaRedaction[] = [{ page: 1, x: 0, y: 0, width: 10, height: 10 }];
    const applied: AppliedRedaction[] = [
      { type: "text", page: 1, text: "a", rect: { x: 0, y: 0, width: 30, height: 10 } },
      { type: "text", page: 2, text: "a", rect: { x: 0, y: 0, width: 30, height: 10 } },
      { type: "area", page: 1, text: "", rect: { x: 0, y: 0, width: 10, height: 10 } },
    ];
    const s = computeSummaryStats(text, areas, applied, true);
    expect(s.totalRedactions).toBe(3);
    expect(s.textRedactions).toBe(2);
    expect(s.areaRedactions).toBe(1);
    expect(s.pagesAffected).toBe(2); // pages 1 and 2
    expect(s.totalAreaRedacted).toBe(30 * 10 * 2 + 10 * 10);
    expect(s.avgAreaPerRedaction).toBe(Math.round((30 * 10 * 2 + 10 * 10) / 3));
    expect(s.completenessScore).toBe(100);
    expect(s.metadataStripped).toBe(true);
  });

  it("gives a 0% completeness score when no requested phrases were found", () => {
    const text: TextRedaction[] = [{ text: "missing", foundCount: 0 }];
    const s = computeSummaryStats(text, [], [], false);
    expect(s.completenessScore).toBe(0);
    expect(s.metadataStripped).toBe(false);
  });

  it("gives 100% when there are no requested phrases", () => {
    const s = computeSummaryStats([], [], [], true);
    expect(s.completenessScore).toBe(100);
  });
});

describe("pdf-redaction-tool checkRedactionCompleteness", () => {
  it("reports allFound=true when every phrase has foundCount > 0", () => {
    const text: TextRedaction[] = [
      { text: "a", foundCount: 2 },
      { text: "b", foundCount: 1 },
    ];
    const r = checkRedactionCompleteness(text);
    expect(r.allFound).toBe(true);
    expect(r.found).toEqual(["a", "b"]);
    expect(r.missing).toEqual([]);
  });

  it("lists missing phrases", () => {
    const text: TextRedaction[] = [
      { text: "a", foundCount: 0 },
      { text: "b", foundCount: 1 },
    ];
    const r = checkRedactionCompleteness(text);
    expect(r.allFound).toBe(false);
    expect(r.missing).toEqual(["a"]);
    expect(r.found).toEqual(["b"]);
  });

  it("flags partial matches against expected counts", () => {
    const text: TextRedaction[] = [
      { text: "a", foundCount: 1 },
      { text: "b", foundCount: 5 },
    ];
    const r = checkRedactionCompleteness(text, { a: 3, b: 5 });
    expect(r.allFound).toBe(true); // found > 0 for both
    expect(r.partial).toEqual([{ text: "a", foundCount: 1 }]);
  });
});

// ---------------------------------------------------------------------------
// Page-range filter
// ---------------------------------------------------------------------------

describe("pdf-redaction-tool filterAreasByPageIndices", () => {
  it("keeps only redactions on the given 0-based indices", () => {
    const areas: AreaRedaction[] = [
      { page: 1, x: 0, y: 0, width: 10, height: 10 },
      { page: 2, x: 0, y: 0, width: 10, height: 10 },
      { page: 3, x: 0, y: 0, width: 10, height: 10 },
    ];
    const filtered = filterAreasByPageIndices(areas, [0, 2]);
    expect(filtered.map((a) => a.page)).toEqual([1, 3]);
  });

  it("returns empty when no indices match", () => {
    const areas: AreaRedaction[] = [
      { page: 1, x: 0, y: 0, width: 10, height: 10 },
    ];
    const filtered = filterAreasByPageIndices(areas, [5]);
    expect(filtered).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Sensitive-data detector
// ---------------------------------------------------------------------------

describe("pdf-redaction-tool detectSensitiveData", () => {
  it("detects email addresses", () => {
    const matches = detectSensitiveData("Contact me at john.doe@example.com please", 1);
    expect(matches.some((m) => m.category === "email" && m.value === "john.doe@example.com")).toBe(true);
  });

  it("detects US SSNs", () => {
    const matches = detectSensitiveData("SSN: 123-45-6789", 1);
    expect(matches.some((m) => m.category === "ssn")).toBe(true);
  });

  it("rejects 000-series SSNs", () => {
    const matches = detectSensitiveData("SSN: 000-12-3456", 1);
    expect(matches.filter((m) => m.category === "ssn")).toHaveLength(0);
  });

  it("detects credit card numbers", () => {
    const matches = detectSensitiveData("Card: 4111111111111111", 1);
    expect(matches.some((m) => m.category === "credit-card")).toBe(true);
  });

  it("detects phone numbers with at least 7 digits", () => {
    const matches = detectSensitiveData("Call (555) 123-4567 today", 1);
    expect(matches.some((m) => m.category === "phone")).toBe(true);
  });

  it("rejects phone-like strings with too few digits", () => {
    const matches = detectSensitiveData("Call 123-456", 1);
    expect(matches.filter((m) => m.category === "phone")).toHaveLength(0);
  });

  it("detects IPv4 addresses", () => {
    const matches = detectSensitiveData("Server: 192.168.1.1 is up", 1);
    expect(matches.some((m) => m.category === "ipv4" && m.value === "192.168.1.1")).toBe(true);
  });

  it("rejects IPv4 with octets > 255", () => {
    const matches = detectSensitiveData("Bad: 999.1.1.1", 1);
    expect(matches.filter((m) => m.category === "ipv4")).toHaveLength(0);
  });

  it("detects IBAN codes", () => {
    const matches = detectSensitiveData("IBAN: GB82WEST12345698765432", 1);
    expect(matches.some((m) => m.category === "iban")).toBe(true);
  });

  it("returns the supplied page number on each match", () => {
    const matches = detectSensitiveData("a@b.com", 7);
    expect(matches.every((m) => m.page === 7)).toBe(true);
  });

  it("returns no matches for plain prose", () => {
    const matches = detectSensitiveData("The quick brown fox jumps over the lazy dog.", 1);
    expect(matches).toHaveLength(0);
  });
});

describe("pdf-redaction-tool suggestAutoRedactions", () => {
  it("groups matches by category and dedupes values", () => {
    const matches = detectSensitiveData(
      "a@b.com and a@b.com and c@d.com and 192.168.0.1",
      1
    );
    const suggestions = suggestAutoRedactions(matches);
    const emailS = suggestions.find((s) => s.category === "email");
    expect(emailS).toBeTruthy();
    if (emailS) {
      expect(emailS.values).toEqual(["a@b.com", "c@d.com"]);
      expect(emailS.totalOccurrences).toBe(3);
    }
    const ipv4S = suggestions.find((s) => s.category === "ipv4");
    expect(ipv4S).toBeTruthy();
    if (ipv4S) expect(ipv4S.values).toEqual(["192.168.0.1"]);
  });

  it("has labels for every sensitive category", () => {
    for (const cat of ["credit-card", "ssn", "email", "phone", "iban", "ipv4"]) {
      expect(SENSITIVE_CATEGORY_LABELS[cat as never]).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Redaction-strength verifier
// ---------------------------------------------------------------------------

describe("pdf-redaction-tool verifyRedactionStrength", () => {
  it("returns true when redaction covers text bounds", () => {
    expect(
      verifyRedactionStrength(
        { x: 0, y: 0, width: 100, height: 20 },
        { x: 10, y: 5, width: 50, height: 10 }
      )
    ).toBe(true);
  });

  it("returns false when redaction is too narrow", () => {
    expect(
      verifyRedactionStrength(
        { x: 0, y: 0, width: 40, height: 20 },
        { x: 10, y: 5, width: 50, height: 10 }
      )
    ).toBe(false);
  });

  it("returns false when redaction is too short", () => {
    expect(
      verifyRedactionStrength(
        { x: 0, y: 5, width: 100, height: 5 },
        { x: 10, y: 5, width: 50, height: 10 }
      )
    ).toBe(false);
  });

  it("allows a small floating-point tolerance", () => {
    expect(
      verifyRedactionStrength(
        { x: 0, y: 0, width: 50.1, height: 10 },
        { x: 0, y: 0, width: 50, height: 10 }
      )
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

describe("pdf-redaction-tool history", () => {
  it("returns empty when nothing stored", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("saves and reloads entries (newest first)", () => {
    const first = saveHistory({
      ts: 1000,
      fileName: "a.pdf",
      textCount: 1,
      areaCount: 0,
      appliedCount: 1,
      color: "black",
      mode: "text-search",
      metadataStripped: true,
    });
    expect(first).toHaveLength(1);
    const second = saveHistory({
      ts: 2000,
      fileName: "b.pdf",
      textCount: 0,
      areaCount: 2,
      appliedCount: 2,
      color: "white",
      mode: "area-coordinates",
      metadataStripped: false,
    });
    expect(second).toHaveLength(2);
    expect(second[0].fileName).toBe("b.pdf");
    expect(second[1].fileName).toBe("a.pdf");
  });

  it("caps history at HISTORY_MAX=20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        fileName: `f${i}.pdf`,
        textCount: 0,
        areaCount: 0,
        appliedCount: 0,
        color: "black",
        mode: "text-search",
        metadataStripped: false,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });

  it("clearHistory empties the store", () => {
    saveHistory({
      ts: 1,
      fileName: "a.pdf",
      textCount: 0,
      areaCount: 0,
      appliedCount: 0,
      color: "black",
      mode: "text-search",
      metadataStripped: false,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

describe("pdf-redaction-tool shareable URL", () => {
  it("buildShareUrl includes only non-default params", () => {
    const url = buildShareUrl({
      textToRedact: "secret",
      areaRedactions: "",
      redactColor: "black",
      redactMode: "text-search",
      removeMetadata: true,
      pageRange: "all",
    });
    expect(url).toContain("text=secret");
    expect(url).not.toContain("color=");
    expect(url).not.toContain("mode=");
    expect(url).not.toContain("meta=");
    expect(url).not.toContain("range=");
  });

  it("buildShareUrl encodes non-default options", () => {
    const url = buildShareUrl({
      textToRedact: "a&b",
      areaRedactions: "1,0,0,10,10",
      redactColor: "white",
      redactMode: "both",
      removeMetadata: false,
      pageRange: "1-3",
    });
    expect(url).toContain("text=a%26b");
    expect(url).toContain("areas=1%2C0%2C0%2C10%2C10");
    expect(url).toContain("color=white");
    expect(url).toContain("mode=both");
    expect(url).toContain("meta=0");
    expect(url).toContain("range=1-3");
  });

  it("parseShareUrl round-trips the defaults-encoded URL", () => {
    const opts = {
      textToRedact: "secret",
      areaRedactions: "",
      redactColor: "black" as const,
      redactMode: "text-search" as const,
      removeMetadata: true,
      pageRange: "all",
    };
    const url = buildShareUrl(opts);
    const parsed = parseShareUrl(url);
    expect(parsed.textToRedact).toBe("secret");
    expect(parsed.redactColor).toBeUndefined(); // default not encoded
    expect(parsed.removeMetadata).toBeUndefined();
  });

  it("parseShareUrl round-trips non-default options", () => {
    const opts = {
      textToRedact: "a",
      areaRedactions: "1,0,0,10,10",
      redactColor: "dark-gray" as const,
      redactMode: "both" as const,
      removeMetadata: false,
      pageRange: "2-4",
    };
    const parsed = parseShareUrl(buildShareUrl(opts));
    expect(parsed).toEqual(opts);
  });

  it("parseShareUrl ignores unknown color/mode values", () => {
    const parsed = parseShareUrl("#color=purple&mode=weird");
    expect(parsed.redactColor).toBeUndefined();
    expect(parsed.redactMode).toBeUndefined();
  });

  it("parseShareUrl returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
    expect(parseShareUrl("#")).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// validateOptions
// ---------------------------------------------------------------------------

describe("pdf-redaction-tool validateOptions", () => {
  it("passes for a valid text-search plan", () => {
    const r = validateOptions({
      ...DEFAULT_OPTIONS,
      textToRedact: "secret",
    });
    expect(r.ok).toBe(true);
  });

  it("fails for unknown color", () => {
    const r = validateOptions({
      ...DEFAULT_OPTIONS,
      redactColor: "purple" as never,
    });
    expect(r.ok).toBe(false);
  });

  it("fails for unknown mode", () => {
    const r = validateOptions({
      ...DEFAULT_OPTIONS,
      redactMode: "weird" as never,
    });
    expect(r.ok).toBe(false);
  });

  it("fails when text-search mode has no phrases", () => {
    const r = validateOptions({
      ...DEFAULT_OPTIONS,
      redactMode: "text-search",
      textToRedact: "",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Enter at least one phrase/);
  });

  it("fails when area mode has no areas", () => {
    const r = validateOptions({
      ...DEFAULT_OPTIONS,
      redactMode: "area-coordinates",
      areaRedactions: "",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Enter at least one area/);
  });

  it("fails when 'both' mode has neither text nor areas", () => {
    const r = validateOptions({
      ...DEFAULT_OPTIONS,
      redactMode: "both",
      textToRedact: "",
      areaRedactions: "",
    });
    expect(r.ok).toBe(false);
  });

  it("passes for 'both' mode with at least one of each", () => {
    const r = validateOptions({
      ...DEFAULT_OPTIONS,
      redactMode: "both",
      textToRedact: "secret",
      areaRedactions: "1,0,0,10,10",
    });
    expect(r.ok).toBe(true);
  });

  it("propagates area-parser errors", () => {
    const r = validateOptions({
      ...DEFAULT_OPTIONS,
      redactMode: "area-coordinates",
      areaRedactions: "1,foo,0,10,10",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/must be numbers/);
  });
});
