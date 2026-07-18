import { describe, it, expect, beforeEach } from "vitest";
import {
  PAGINATION_PATTERNS,
  HISTORY_KEY,
  HISTORY_MAX,
  normalizeUrl,
  parseUrlList,
  detectPageNumber,
  splitCsvRow,
  parseMetadataCsv,
  buildMetaLookup,
  detectSequenceGaps,
  detectDuplicateCanonicals,
  urlsAreSamePage,
  validateChain,
  validateCanonical,
  validateStatusCodes,
  rollupSeverity,
  buildReport,
  generateRecommendations,
  filterBySeverity,
  renderTextReport,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PageMeta,
  type Severity,
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

const sampleUrls = [
  "https://example.com/blog/page/1",
  "https://example.com/blog/page/2",
  "https://example.com/blog/page/3",
];

describe("pagination-seo-checker constants", () => {
  it("has 5 pagination patterns", () => {
    expect(PAGINATION_PATTERNS).toHaveLength(5);
  });
  it("history key is set", () => {
    expect(HISTORY_KEY).toBe("unqtools:pagination-seo-checker:history");
  });
  it("history max is 20", () => {
    expect(HISTORY_MAX).toBe(20);
  });
});

describe("pagination-seo-checker normalizeUrl", () => {
  it("trims whitespace", () => {
    expect(normalizeUrl("  https://example.com  ")).toBe("https://example.com");
  });
  it("strips fragments", () => {
    expect(normalizeUrl("https://example.com/page/1#section")).toBe("https://example.com/page/1");
  });
  it("returns empty for hash-only lines", () => {
    expect(normalizeUrl("#comment")).toBe("");
  });
  it("returns empty for empty input", () => {
    expect(normalizeUrl("")).toBe("");
  });
});

describe("pagination-seo-checker parseUrlList", () => {
  it("parses newline-separated", () => {
    expect(parseUrlList("a\nb\nc")).toEqual(["a", "b", "c"]);
  });
  it("filters blanks", () => {
    expect(parseUrlList("a\n\nb")).toEqual(["a", "b"]);
  });
  it("returns empty for empty", () => {
    expect(parseUrlList("")).toEqual([]);
  });
});

describe("pagination-seo-checker detectPageNumber", () => {
  it("detects /page/N pattern", () => {
    expect(detectPageNumber("https://example.com/blog/page/3")).toBe(3);
  });
  it("detects ?page=N pattern", () => {
    expect(detectPageNumber("https://example.com/blog?page=5")).toBe(5);
  });
  it("detects ?p=N pattern", () => {
    expect(detectPageNumber("https://example.com/blog?p=7")).toBe(7);
  });
  it("detects /p/N pattern", () => {
    expect(detectPageNumber("https://example.com/p/2")).toBe(2);
  });
  it("detects ?pg=N pattern", () => {
    expect(detectPageNumber("https://example.com/blog?pg=4")).toBe(4);
  });
  it("returns null when no pattern matched", () => {
    expect(detectPageNumber("https://example.com/blog/intro")).toBeNull();
  });
  it("returns null for empty url", () => {
    expect(detectPageNumber("")).toBeNull();
  });
});

describe("pagination-seo-checker splitCsvRow", () => {
  it("splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
});

describe("pagination-seo-checker parseMetadataCsv", () => {
  it("parses valid metadata", () => {
    const csv = "url,rel_prev,rel_next,canonical,status_code\n" +
      "https://example.com/page/1,,https://example.com/page/2,https://example.com/page/1,200\n" +
      "https://example.com/page/2,https://example.com/page/1,https://example.com/page/3,https://example.com/page/2,200";
    const metas = parseMetadataCsv(csv);
    expect(metas).toHaveLength(2);
    expect(metas[0].url).toBe("https://example.com/page/1");
    expect(metas[0].relNext).toBe("https://example.com/page/2");
    expect(metas[0].statusCode).toBe(200);
  });
  it("returns empty when no url column", () => {
    expect(parseMetadataCsv("foo,bar\n1,2")).toEqual([]);
  });
  it("returns empty for empty input", () => {
    expect(parseMetadataCsv("")).toEqual([]);
  });
  it("handles missing optional columns", () => {
    const csv = "url\nhttps://example.com/page/1";
    const metas = parseMetadataCsv(csv);
    expect(metas).toHaveLength(1);
    expect(metas[0].relPrev).toBeUndefined();
  });
});

describe("pagination-seo-checker buildMetaLookup", () => {
  it("builds url → meta map", () => {
    const metas: PageMeta[] = [
      { url: "https://example.com/page/1", statusCode: 200 },
      { url: "https://example.com/page/2", statusCode: 200 },
    ];
    const lookup = buildMetaLookup(metas);
    expect(lookup.size).toBe(2);
    expect(lookup.get("https://example.com/page/1")?.statusCode).toBe(200);
  });
  it("handles empty input", () => {
    expect(buildMetaLookup([]).size).toBe(0);
  });
});

describe("pagination-seo-checker detectSequenceGaps", () => {
  it("detects no gaps in continuous sequence", () => {
    expect(detectSequenceGaps(sampleUrls)).toEqual([]);
  });
  it("detects single gap", () => {
    const urls = [
      "https://example.com/page/1",
      "https://example.com/page/2",
      "https://example.com/page/4",
    ];
    expect(detectSequenceGaps(urls)).toEqual([3]);
  });
  it("detects multiple gaps", () => {
    const urls = [
      "https://example.com/page/1",
      "https://example.com/page/5",
    ];
    expect(detectSequenceGaps(urls)).toEqual([2, 3, 4]);
  });
  it("returns empty when fewer than 2 URLs", () => {
    expect(detectSequenceGaps(["https://example.com/page/1"])).toEqual([]);
  });
  it("returns empty when no page numbers detected", () => {
    expect(detectSequenceGaps([
      "https://example.com/blog/intro",
      "https://example.com/blog/article",
    ])).toEqual([]);
  });
});

describe("pagination-seo-checker detectDuplicateCanonicals", () => {
  it("detects duplicate canonicals", () => {
    const urls = [
      "https://example.com/page/1",
      "https://example.com/page/2",
    ];
    const metas: PageMeta[] = [
      { url: "https://example.com/page/1", canonical: "https://example.com/page/1" },
      { url: "https://example.com/page/2", canonical: "https://example.com/page/1" },
    ];
    const dupes = detectDuplicateCanonicals(urls, buildMetaLookup(metas));
    expect(dupes).toHaveLength(1);
    expect(dupes[0].count).toBe(2);
  });
  it("returns empty when all canonicals unique", () => {
    const metas: PageMeta[] = [
      { url: "https://example.com/page/1", canonical: "https://example.com/page/1" },
      { url: "https://example.com/page/2", canonical: "https://example.com/page/2" },
    ];
    expect(detectDuplicateCanonicals(sampleUrls, buildMetaLookup(metas))).toEqual([]);
  });
  it("ignores missing canonicals", () => {
    const metas: PageMeta[] = [
      { url: "https://example.com/page/1" },
      { url: "https://example.com/page/2" },
    ];
    expect(detectDuplicateCanonicals(sampleUrls, buildMetaLookup(metas))).toEqual([]);
  });
});

describe("pagination-seo-checker urlsAreSamePage", () => {
  it("matches identical urls", () => {
    expect(urlsAreSamePage("https://example.com/page/1", "https://example.com/page/1")).toBe(true);
  });
  it("matches differing protocols", () => {
    expect(urlsAreSamePage("http://example.com/page/1", "https://example.com/page/1")).toBe(true);
  });
  it("matches with/without trailing slash", () => {
    expect(urlsAreSamePage("https://example.com/page/1/", "https://example.com/page/1")).toBe(true);
  });
  it("returns false for different pages", () => {
    expect(urlsAreSamePage("https://example.com/page/1", "https://example.com/page/2")).toBe(false);
  });
  it("returns false for empty inputs", () => {
    expect(urlsAreSamePage("", "https://example.com/page/2")).toBe(false);
  });
});

describe("pagination-seo-checker validateChain", () => {
  it("flags missing rel_next on non-last page", () => {
    const urls = [
      "https://example.com/page/1",
      "https://example.com/page/2",
    ];
    const metas: PageMeta[] = [
      { url: "https://example.com/page/1", canonical: "https://example.com/page/1" },
      { url: "https://example.com/page/2", relPrev: "https://example.com/page/1", canonical: "https://example.com/page/2" },
    ];
    const issues = validateChain(urls, buildMetaLookup(metas));
    expect(issues.some((i) => i.code === "missing-rel-next")).toBe(true);
  });
  it("flags missing rel_prev on page > 1", () => {
    const urls = [
      "https://example.com/page/1",
      "https://example.com/page/2",
    ];
    const metas: PageMeta[] = [
      { url: "https://example.com/page/1", relNext: "https://example.com/page/2", canonical: "https://example.com/page/1" },
      { url: "https://example.com/page/2", canonical: "https://example.com/page/2" },
    ];
    const issues = validateChain(urls, buildMetaLookup(metas));
    expect(issues.some((i) => i.code === "missing-rel-prev")).toBe(true);
  });
  it("flags broken rel_prev chain", () => {
    const urls = [
      "https://example.com/page/1",
      "https://example.com/page/2",
    ];
    const metas: PageMeta[] = [
      { url: "https://example.com/page/1", relNext: "https://example.com/page/2", canonical: "https://example.com/page/1" },
      { url: "https://example.com/page/2", relPrev: "https://example.com/wrong", relNext: undefined, canonical: "https://example.com/page/2" },
    ];
    const issues = validateChain(urls, buildMetaLookup(metas));
    expect(issues.some((i) => i.code === "broken-rel-prev")).toBe(true);
  });
  it("flags page 1 with rel_prev", () => {
    const urls = [
      "https://example.com/page/1",
      "https://example.com/page/2",
    ];
    const metas: PageMeta[] = [
      { url: "https://example.com/page/1", relPrev: "https://example.com/page/0", relNext: "https://example.com/page/2", canonical: "https://example.com/page/1" },
      { url: "https://example.com/page/2", relPrev: "https://example.com/page/1", canonical: "https://example.com/page/2" },
    ];
    const issues = validateChain(urls, buildMetaLookup(metas));
    expect(issues.some((i) => i.code === "page1-has-rel-prev")).toBe(true);
  });
  it("flags last page with rel_next", () => {
    const urls = [
      "https://example.com/page/1",
      "https://example.com/page/2",
    ];
    const metas: PageMeta[] = [
      { url: "https://example.com/page/1", relNext: "https://example.com/page/2", canonical: "https://example.com/page/1" },
      { url: "https://example.com/page/2", relPrev: "https://example.com/page/1", relNext: "https://example.com/page/3", canonical: "https://example.com/page/2" },
    ];
    const issues = validateChain(urls, buildMetaLookup(metas));
    expect(issues.some((i) => i.code === "last-page-has-rel-next")).toBe(true);
  });
});

describe("pagination-seo-checker validateCanonical", () => {
  it("flags missing canonical", () => {
    const metas: PageMeta[] = [
      { url: "https://example.com/page/1" },
    ];
    const issues = validateCanonical(["https://example.com/page/1"], buildMetaLookup(metas));
    expect(issues.some((i) => i.code === "missing-canonical")).toBe(true);
  });
  it("flags canonical to page 1", () => {
    const metas: PageMeta[] = [
      { url: "https://example.com/page/2", canonical: "https://example.com/page/1" },
    ];
    const issues = validateCanonical(["https://example.com/page/2"], buildMetaLookup(metas));
    expect(issues.some((i) => i.code === "canonical-to-page1")).toBe(true);
  });
  it("flags canonical not pointing to self", () => {
    const metas: PageMeta[] = [
      { url: "https://example.com/page/2", canonical: "https://example.com/page/3" },
    ];
    const issues = validateCanonical(["https://example.com/page/2"], buildMetaLookup(metas));
    expect(issues.some((i) => i.code === "canonical-not-self")).toBe(true);
  });
  it("passes when canonical matches self", () => {
    const metas: PageMeta[] = [
      { url: "https://example.com/page/2", canonical: "https://example.com/page/2" },
    ];
    const issues = validateCanonical(["https://example.com/page/2"], buildMetaLookup(metas));
    expect(issues).toHaveLength(0);
  });
});

describe("pagination-seo-checker validateStatusCodes", () => {
  it("flags missing status code", () => {
    const metas: PageMeta[] = [{ url: "https://example.com/page/1" }];
    const issues = validateStatusCodes(["https://example.com/page/1"], buildMetaLookup(metas));
    expect(issues.some((i) => i.code === "missing-status")).toBe(true);
  });
  it("flags 404 as critical", () => {
    const metas: PageMeta[] = [{ url: "https://example.com/page/1", statusCode: 404 }];
    const issues = validateStatusCodes(["https://example.com/page/1"], buildMetaLookup(metas));
    const issue = issues.find((i) => i.code === "non-200-status")!;
    expect(issue).toBeTruthy();
    expect(issue.severity).toBe("critical");
  });
  it("flags 301 as warning", () => {
    const metas: PageMeta[] = [{ url: "https://example.com/page/1", statusCode: 301 }];
    const issues = validateStatusCodes(["https://example.com/page/1"], buildMetaLookup(metas));
    const issue = issues.find((i) => i.code === "non-200-status")!;
    expect(issue).toBeTruthy();
    expect(issue.severity).toBe("warning");
  });
  it("passes 200", () => {
    const metas: PageMeta[] = [{ url: "https://example.com/page/1", statusCode: 200 }];
    expect(validateStatusCodes(["https://example.com/page/1"], buildMetaLookup(metas))).toHaveLength(0);
  });
});

describe("pagination-seo-checker rollupSeverity", () => {
  it("returns critical when any critical issue", () => {
    expect(rollupSeverity([
      { code: "x", message: "x", severity: "critical" },
      { code: "y", message: "y", severity: "warning" },
    ])).toBe("critical");
  });
  it("returns warning when no critical but has warning", () => {
    expect(rollupSeverity([
      { code: "y", message: "y", severity: "warning" },
      { code: "z", message: "z", severity: "info" },
    ])).toBe("warning");
  });
  it("returns info for empty", () => {
    expect(rollupSeverity([])).toBe("info");
  });
});

describe("pagination-seo-checker buildReport", () => {
  it("builds full report with all checks", () => {
    const urls = [
      "https://example.com/page/1",
      "https://example.com/page/2",
      "https://example.com/page/3",
    ];
    const metas: PageMeta[] = [
      { url: "https://example.com/page/1", relNext: "https://example.com/page/2", canonical: "https://example.com/page/1", statusCode: 200 },
      { url: "https://example.com/page/2", relPrev: "https://example.com/page/1", relNext: "https://example.com/page/3", canonical: "https://example.com/page/2", statusCode: 200 },
      { url: "https://example.com/page/3", relPrev: "https://example.com/page/2", canonical: "https://example.com/page/3", statusCode: 200 },
    ];
    const report = buildReport(urls, metas);
    expect(report.summary.totalPages).toBe(3);
    expect(report.summary.totalPagesDetected).toBe(3);
    expect(report.summary.critical).toBe(0);
    expect(report.sequenceGaps).toEqual([]);
    expect(report.duplicateCanonicals).toEqual([]);
  });
  it("flags issues correctly", () => {
    const urls = [
      "https://example.com/page/1",
      "https://example.com/page/2",
    ];
    const metas: PageMeta[] = [
      { url: "https://example.com/page/1", canonical: "https://example.com/page/1", statusCode: 200 },
      { url: "https://example.com/page/2", relPrev: "https://example.com/page/1", canonical: "https://example.com/page/2", statusCode: 404 },
    ];
    const report = buildReport(urls, metas);
    // page 1 missing rel_next → critical
    expect(report.summary.critical).toBeGreaterThanOrEqual(2);
    expect(report.duplicateCanonicals).toEqual([]);
  });
  it("handles empty inputs", () => {
    const report = buildReport([], []);
    expect(report.summary.totalPages).toBe(0);
    expect(report.pages).toEqual([]);
  });
  it("handles URLs without metadata", () => {
    const report = buildReport(["https://example.com/page/1"], []);
    expect(report.pages[0].issues.some((i) => i.code === "no-metadata")).toBe(true);
  });
});

describe("pagination-seo-checker generateRecommendations", () => {
  it("returns all-clear when no issues", () => {
    const recs = generateRecommendations([], [], []);
    expect(recs).toHaveLength(1);
    expect(recs[0].severity).toBe("info");
  });
  it("recommends fixing missing rel_next", () => {
    const pages = [{
      url: "https://example.com/page/1",
      pageNumber: 1,
      issues: [{ code: "missing-rel-next", message: "missing", severity: "critical" as Severity }],
      severity: "critical" as Severity,
    }];
    const recs = generateRecommendations(pages, [], []);
    expect(recs.some((r) => r.message.includes("Add rel=next"))).toBe(true);
  });
  it("recommends fixing sequence gaps", () => {
    const recs = generateRecommendations([], [3], []);
    expect(recs.some((r) => r.message.includes("sequence gap"))).toBe(true);
  });
  it("recommends fixing duplicate canonicals", () => {
    const recs = generateRecommendations([], [], [{ canonical: "x", count: 2, urls: ["a", "b"] }]);
    expect(recs.some((r) => r.message.includes("duplicate canonical"))).toBe(true);
  });
});

describe("pagination-seo-checker filterBySeverity", () => {
  const pages = [
    { url: "a", pageNumber: 1, issues: [{ code: "x", message: "x", severity: "critical" as Severity }], severity: "critical" as Severity },
    { url: "b", pageNumber: 2, issues: [{ code: "y", message: "y", severity: "warning" as Severity }], severity: "warning" as Severity },
    { url: "c", pageNumber: 3, issues: [], severity: "info" as Severity },
  ];
  it("returns all when sev=all", () => {
    expect(filterBySeverity(pages, "all")).toHaveLength(3);
  });
  it("filters critical", () => {
    expect(filterBySeverity(pages, "critical")).toHaveLength(1);
  });
  it("filters warning", () => {
    expect(filterBySeverity(pages, "warning")).toHaveLength(1);
  });
});

describe("pagination-seo-checker renderTextReport", () => {
  it("includes summary section", () => {
    const report = buildReport(sampleUrls, []);
    const text = renderTextReport(report);
    expect(text).toContain("SUMMARY");
    expect(text).toContain("Total URLs:");
  });
  it("includes per-url issues", () => {
    const report = buildReport(sampleUrls, []);
    const text = renderTextReport(report);
    expect(text).toContain("PER-URL ISSUES");
    expect(text).toContain("https://example.com/blog/page/1");
  });
  it("includes recommendations", () => {
    const report = buildReport(sampleUrls, []);
    const text = renderTextReport(report);
    expect(text).toContain("RECOMMENDATIONS");
  });
});

describe("pagination-seo-checker renderCsv", () => {
  it("has header row", () => {
    const report = buildReport(sampleUrls, []);
    const csv = renderCsv(report);
    expect(csv).toContain("url,page_num,issues,severity");
  });
  it("renders page numbers", () => {
    const report = buildReport(sampleUrls, []);
    const csv = renderCsv(report);
    expect(csv).toContain("https://example.com/blog/page/1");
    expect(csv).toContain(",1,");
  });
  it("escapes commas in URLs", () => {
    const urls = ["https://example.com/page/1,2"];
    const report = buildReport(urls, []);
    const csv = renderCsv(report);
    expect(csv).toContain('"https://example.com/page/1,2"');
  });
});

describe("pagination-seo-checker history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, totalUrls: 3, totalIssues: 5, critical: 2 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, totalUrls: 1, totalIssues: 0, critical: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, totalUrls: 1, totalIssues: 0, critical: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("pagination-seo-checker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("https://example.com/page/1", "");
    expect(url).toContain("urls=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("urls=https%3A%2F%2Fexample.com&meta=foo");
    expect(p.urls).toBe("https://example.com");
    expect(p.meta).toBe("foo");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ urls: "", meta: "" });
  });
  it("handles hash without meta", () => {
    const p = parseShareUrl("urls=https%3A%2F%2Fexample.com");
    expect(p.urls).toBe("https://example.com");
    expect(p.meta).toBe("");
  });
});
