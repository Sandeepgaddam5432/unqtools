import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  CLASSIFICATION_LABELS,
  CLASSIFICATION_ORDER,
  splitCsvRow,
  parseCsv,
  normalizeUrl,
  isSelfCanonical,
  findDuplicateCanonicalGroups,
  detectCanonicalChains,
  findMissingCanonicals,
  classifyRecord,
  classifyRecords,
  summarizeCoverage,
  generateRecommendations,
  filterByClassification,
  renderTextReport,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type UrlRecord,
  type ClassificationFilter,
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

function rec(opts: Partial<UrlRecord> = {}): UrlRecord {
  return {
    url: opts.url ?? "https://example.com/page1",
    canonical: opts.canonical ?? "https://example.com/page1",
    noindex: opts.noindex ?? false,
    robotsBlocked: opts.robotsBlocked ?? false,
    statusCode: opts.statusCode ?? 200,
    lineNumber: opts.lineNumber ?? 1,
  };
}

describe("index-coverage-reporter constants", () => {
  it("has 6 classification labels", () => {
    expect(Object.keys(CLASSIFICATION_LABELS)).toHaveLength(6);
  });
  it("has 6 classifications in order", () => {
    expect(CLASSIFICATION_ORDER).toHaveLength(6);
    expect(CLASSIFICATION_ORDER).toContain("indexable");
    expect(CLASSIFICATION_ORDER).toContain("duplicate_canonical");
  });
  it("exposes HISTORY_KEY + HISTORY_MAX", () => {
    expect(HISTORY_KEY).toBe("unqtools:index-coverage-reporter:history");
    expect(HISTORY_MAX).toBe(20);
  });
});

describe("index-coverage-reporter splitCsvRow", () => {
  it("splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("handles escaped quotes", () => {
    expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]);
  });
  it("trims fields", () => {
    expect(splitCsvRow("  a , b ")).toEqual(["a", "b"]);
  });
});

describe("index-coverage-reporter parseCsv", () => {
  it("parses header-less CSV", () => {
    const input = [
      "https://example.com/a,https://example.com/a,no,no,200",
      "https://example.com/b,https://example.com/a,no,no,200",
    ].join("\n");
    const parsed = parseCsv(input);
    expect(parsed.records).toHaveLength(2);
    expect(parsed.records[0].url).toBe("https://example.com/a");
    expect(parsed.records[0].noindex).toBe(false);
  });
  it("skips header row", () => {
    const input = [
      "url,canonical,noindex,robots_blocked,status_code",
      "https://example.com/a,https://example.com/a,no,no,200",
    ].join("\n");
    const parsed = parseCsv(input);
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0].url).toBe("https://example.com/a");
  });
  it("parses yes/no booleans", () => {
    const input = "https://example.com/a,,yes,no,200\nhttps://example.com/b,,no,yes,200";
    const parsed = parseCsv(input);
    expect(parsed.records[0].noindex).toBe(true);
    expect(parsed.records[1].robotsBlocked).toBe(true);
  });
  it("accepts true/1/y as booleans", () => {
    const input = "https://example.com/a,,true,no,200\nhttps://example.com/b,,1,no,200\nhttps://example.com/c,,y,no,200";
    const parsed = parseCsv(input);
    expect(parsed.records[0].noindex).toBe(true);
    expect(parsed.records[1].noindex).toBe(true);
    expect(parsed.records[2].noindex).toBe(true);
  });
  it("defaults status_code to 200 when empty", () => {
    const input = "https://example.com/a,https://example.com/a,no,no,";
    const parsed = parseCsv(input);
    expect(parsed.records[0].statusCode).toBe(200);
  });
  it("reports error for invalid status code", () => {
    const input = "https://example.com/a,https://example.com/a,no,no,999";
    const parsed = parseCsv(input);
    expect(parsed.records).toHaveLength(0);
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors[0].message).toContain("Invalid status_code");
  });
  it("reports error for missing URL", () => {
    const input = ",https://example.com/a,no,no,200";
    const parsed = parseCsv(input);
    expect(parsed.records).toHaveLength(0);
    expect(parsed.errors[0].message).toContain("Missing URL");
  });
  it("handles empty input", () => {
    expect(parseCsv("")).toEqual({ records: [], errors: [], totalLines: 0 });
  });
  it("skips blank lines", () => {
    const input = "https://example.com/a,https://example.com/a,no,no,200\n\nhttps://example.com/b,https://example.com/b,no,no,200";
    const parsed = parseCsv(input);
    expect(parsed.records).toHaveLength(2);
  });
  it("handles CRLF line endings", () => {
    const input = "https://example.com/a,https://example.com/a,no,no,200\r\nhttps://example.com/b,https://example.com/b,no,no,200";
    const parsed = parseCsv(input);
    expect(parsed.records).toHaveLength(2);
  });
  it("preserves line numbers in errors", () => {
    const input = "url,canonical,noindex,robots_blocked,status_code\nhttps://example.com/a,https://example.com/a,no,no,abc";
    const parsed = parseCsv(input);
    expect(parsed.errors[0].line).toBe(2);
  });
});

describe("index-coverage-reporter normalizeUrl", () => {
  it("lowercases host", () => {
    expect(normalizeUrl("https://EXAMPLE.com/Path")).toContain("example.com");
  });
  it("strips trailing slash (non-root)", () => {
    expect(normalizeUrl("https://example.com/page/")).toBe("https://example.com/page");
  });
  it("keeps root slash", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });
  it("handles empty", () => {
    expect(normalizeUrl("")).toBe("");
  });
  it("leaves relative URLs as-is", () => {
    expect(normalizeUrl("/page")).toBe("/page");
  });
});

describe("index-coverage-reporter isSelfCanonical", () => {
  it("returns true when canonical matches url", () => {
    expect(isSelfCanonical("https://example.com/a", "https://example.com/a")).toBe(true);
  });
  it("returns true even with trailing slash differences", () => {
    expect(isSelfCanonical("https://example.com/a", "https://example.com/a/")).toBe(true);
  });
  it("returns true ignoring case in host", () => {
    expect(isSelfCanonical("https://example.com/a", "https://EXAMPLE.com/a")).toBe(true);
  });
  it("returns false when canonical points elsewhere", () => {
    expect(isSelfCanonical("https://example.com/a", "https://example.com/b")).toBe(false);
  });
  it("returns false when canonical is empty", () => {
    expect(isSelfCanonical("https://example.com/a", "")).toBe(false);
  });
});

describe("index-coverage-reporter findDuplicateCanonicalGroups", () => {
  it("finds groups with 2+ sources", () => {
    const records = [
      rec({ url: "https://example.com/a", canonical: "https://example.com/canonical" }),
      rec({ url: "https://example.com/b", canonical: "https://example.com/canonical" }),
      rec({ url: "https://example.com/c", canonical: "https://example.com/canonical" }),
    ];
    const groups = findDuplicateCanonicalGroups(records);
    expect(groups).toHaveLength(1);
    expect(groups[0].target).toBe("https://example.com/canonical");
    expect(groups[0].sources).toHaveLength(3);
  });
  it("excludes self-canonical URLs", () => {
    const records = [
      rec({ url: "https://example.com/a", canonical: "https://example.com/a" }),
      rec({ url: "https://example.com/b", canonical: "https://example.com/a" }),
    ];
    const groups = findDuplicateCanonicalGroups(records);
    // b points to a, but a is self-canonical → only 1 source (b)
    expect(groups).toHaveLength(0);
  });
  it("returns empty for empty input", () => {
    expect(findDuplicateCanonicalGroups([])).toEqual([]);
  });
  it("sorts by source count descending", () => {
    const records = [
      rec({ url: "https://example.com/a", canonical: "https://example.com/t1" }),
      rec({ url: "https://example.com/b", canonical: "https://example.com/t1" }),
      rec({ url: "https://example.com/c", canonical: "https://example.com/t2" }),
      rec({ url: "https://example.com/d", canonical: "https://example.com/t2" }),
      rec({ url: "https://example.com/e", canonical: "https://example.com/t2" }),
    ];
    const groups = findDuplicateCanonicalGroups(records);
    expect(groups[0].target).toBe("https://example.com/t2");
    expect(groups[0].sources).toHaveLength(3);
  });
});

describe("index-coverage-reporter detectCanonicalChains", () => {
  it("detects a 3-step chain A→B→C", () => {
    const records = [
      rec({ url: "https://example.com/a", canonical: "https://example.com/b" }),
      rec({ url: "https://example.com/b", canonical: "https://example.com/c" }),
      rec({ url: "https://example.com/c", canonical: "https://example.com/c" }),
    ];
    const chains = detectCanonicalChains(records);
    expect(chains).toHaveLength(1);
    expect(chains[0].steps).toEqual([
      "https://example.com/a",
      "https://example.com/b",
      "https://example.com/c",
    ]);
    expect(chains[0].cyclic).toBe(false);
  });
  it("detects cyclic chains", () => {
    const records = [
      rec({ url: "https://example.com/a", canonical: "https://example.com/b" }),
      rec({ url: "https://example.com/b", canonical: "https://example.com/a" }),
    ];
    const chains = detectCanonicalChains(records);
    expect(chains).toHaveLength(1);
    expect(chains[0].cyclic).toBe(true);
  });
  it("ignores single-hop canonicals (A→B where B is self-canonical)", () => {
    const records = [
      rec({ url: "https://example.com/a", canonical: "https://example.com/b" }),
      rec({ url: "https://example.com/b", canonical: "https://example.com/b" }),
    ];
    const chains = detectCanonicalChains(records);
    expect(chains).toHaveLength(0);
  });
  it("handles canonical pointing to URL not in dataset", () => {
    const records = [
      rec({ url: "https://example.com/a", canonical: "https://example.com/b" }),
      // b not in records
    ];
    const chains = detectCanonicalChains(records);
    expect(chains).toHaveLength(0);
  });
  it("returns empty for empty input", () => {
    expect(detectCanonicalChains([])).toEqual([]);
  });
});

describe("index-coverage-reporter findMissingCanonicals", () => {
  it("finds URLs with empty canonical", () => {
    const records = [
      rec({ url: "https://example.com/a", canonical: "" }),
      rec({ url: "https://example.com/b", canonical: "https://example.com/b" }),
      rec({ url: "https://example.com/c", canonical: "   " }),
    ];
    const missing = findMissingCanonicals(records);
    expect(missing).toHaveLength(2);
  });
});

describe("index-coverage-reporter classifyRecord", () => {
  it("classifies indexable URL", () => {
    const r = rec({});
    const dupSources = new Set<string>();
    const c = classifyRecord(r, dupSources);
    expect(c.classification).toBe("indexable");
    expect(c.selfCanonical).toBe(true);
  });
  it("classifies noindex URL", () => {
    const r = rec({ noindex: true });
    const c = classifyRecord(r, new Set());
    expect(c.classification).toBe("noindex");
  });
  it("classifies robots_blocked URL", () => {
    const r = rec({ robotsBlocked: true });
    const c = classifyRecord(r, new Set());
    expect(c.classification).toBe("robots_blocked");
  });
  it("classifies error_status URL (non-2xx)", () => {
    const r = rec({ statusCode: 404 });
    const c = classifyRecord(r, new Set());
    expect(c.classification).toBe("error_status");
  });
  it("classifies canonicalized URL (canonical points elsewhere)", () => {
    const r = rec({ canonical: "https://example.com/other" });
    const c = classifyRecord(r, new Set());
    expect(c.classification).toBe("canonicalized");
  });
  it("classifies duplicate_canonical when URL is in dup set", () => {
    const r = rec({ url: "https://example.com/a", canonical: "https://example.com/canonical" });
    const c = classifyRecord(r, new Set(["https://example.com/a"]));
    expect(c.classification).toBe("duplicate_canonical");
  });
  it("classifies missing canonical as duplicate_canonical (risk)", () => {
    const r = rec({ canonical: "" });
    const c = classifyRecord(r, new Set());
    expect(c.classification).toBe("duplicate_canonical");
    expect(c.reason).toContain("Missing canonical");
  });
  it("error status takes precedence over noindex", () => {
    const r = rec({ statusCode: 500, noindex: true });
    const c = classifyRecord(r, new Set());
    expect(c.classification).toBe("error_status");
  });
  it("robots_blocked takes precedence over noindex (per classification order)", () => {
    const r = rec({ robotsBlocked: true, noindex: true });
    const c = classifyRecord(r, new Set());
    expect(c.classification).toBe("robots_blocked");
  });
});

describe("index-coverage-reporter classifyRecords", () => {
  it("classifies all and sorts by severity", () => {
    const records = [
      rec({ url: "https://example.com/ok", canonical: "https://example.com/ok" }),
      rec({ url: "https://example.com/err", statusCode: 500, canonical: "https://example.com/err" }),
      rec({ url: "https://example.com/noi", noindex: true, canonical: "https://example.com/noi" }),
    ];
    const classified = classifyRecords(records);
    expect(classified[0].classification).toBe("error_status");
    expect(classified[1].classification).toBe("noindex");
    expect(classified[2].classification).toBe("indexable");
  });
  it("marks duplicate canonical sources correctly", () => {
    const records = [
      rec({ url: "https://example.com/a", canonical: "https://example.com/canonical" }),
      rec({ url: "https://example.com/b", canonical: "https://example.com/canonical" }),
    ];
    const classified = classifyRecords(records);
    expect(classified.every((c) => c.classification === "duplicate_canonical")).toBe(true);
  });
});

describe("index-coverage-reporter summarizeCoverage", () => {
  it("computes summary stats", () => {
    const records = [
      rec({ url: "https://example.com/a", canonical: "https://example.com/a" }),
      rec({ url: "https://example.com/b", canonical: "https://example.com/a" }),
      rec({ url: "https://example.com/c", canonical: "https://example.com/c", noindex: true }),
      rec({ url: "https://example.com/d", canonical: "https://example.com/d", robotsBlocked: true }),
      rec({ url: "https://example.com/e", canonical: "https://example.com/e", statusCode: 500 }),
    ];
    const classified = classifyRecords(records);
    const summary = summarizeCoverage(classified);
    expect(summary.total).toBe(5);
    expect(summary.indexable).toBe(1);
    expect(summary.canonicalized).toBe(1);
    expect(summary.noindex).toBe(1);
    expect(summary.robotsBlocked).toBe(1);
    expect(summary.errorStatus).toBe(1);
    expect(summary.indexablePercent).toBe(20);
    expect(summary.blockedPercent).toBe(60);
    expect(summary.selfCanonicalCount).toBe(4);
    expect(summary.nonSelfCanonicalCount).toBe(1);
    expect(summary.missingCanonicalCount).toBe(0);
  });
  it("computes duplicate groups + chains counts", () => {
    const records = [
      rec({ url: "https://example.com/a", canonical: "https://example.com/b" }),
      rec({ url: "https://example.com/b", canonical: "https://example.com/c" }),
      rec({ url: "https://example.com/c", canonical: "https://example.com/c" }),
      rec({ url: "https://example.com/d", canonical: "https://example.com/c" }),
    ];
    const classified = classifyRecords(records);
    const summary = summarizeCoverage(classified);
    expect(summary.chainCount).toBe(1);
    expect(summary.duplicateGroups).toBe(1);
  });
  it("handles empty input", () => {
    const summary = summarizeCoverage([]);
    expect(summary.total).toBe(0);
    expect(summary.indexablePercent).toBe(0);
    expect(summary.blockedPercent).toBe(0);
  });
});

describe("index-coverage-reporter generateRecommendations", () => {
  it("generates high-severity rec for error status", () => {
    const records = classifyRecords([
      rec({ url: "https://example.com/err", statusCode: 500, canonical: "https://example.com/err" }),
    ]);
    const recs = generateRecommendations(records, [], [], []);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].severity).toBe("high");
    expect(recs[0].message).toContain("500");
  });
  it("generates recommendation for canonical chains", () => {
    const chains = [{
      start: "https://example.com/a",
      steps: ["https://example.com/a", "https://example.com/b", "https://example.com/c"],
      cyclic: false,
    }];
    const recs = generateRecommendations([], chains, [], []);
    expect(recs.some((r) => r.message.includes("Canonical chain"))).toBe(true);
  });
  it("generates recommendation for duplicate canonicals", () => {
    const dupGroups = [{
      target: "https://example.com/canonical",
      sources: ["https://example.com/a", "https://example.com/b"],
    }];
    const recs = generateRecommendations([], [], dupGroups, []);
    expect(recs.some((r) => r.message.includes("canonicalize to"))).toBe(true);
  });
  it("generates recommendation for missing canonicals", () => {
    const missing = [rec({ url: "https://example.com/a", canonical: "" })];
    const recs = generateRecommendations([], [], [], missing);
    expect(recs.some((r) => r.message.includes("Add a self-canonical"))).toBe(true);
  });
  it("sorts by severity (high → medium → low)", () => {
    const records = classifyRecords([
      rec({ url: "https://example.com/err", statusCode: 500, canonical: "https://example.com/err" }),
      rec({ url: "https://example.com/rb", robotsBlocked: true, canonical: "https://example.com/rb" }),
    ]);
    const missing = [rec({ url: "https://example.com/missing", canonical: "" })];
    const recs = generateRecommendations(records, [], [], missing);
    const order = recs.map((r) => r.severity);
    expect(order[0]).toBe("high");
    // Last should be low (robots blocked)
    expect(order[order.length - 1]).toBe("low");
  });
  it("returns empty for clean records", () => {
    const records = classifyRecords([
      rec({ url: "https://example.com/a", canonical: "https://example.com/a" }),
    ]);
    const recs = generateRecommendations(records, [], [], []);
    expect(recs).toEqual([]);
  });
});

describe("index-coverage-reporter filterByClassification", () => {
  const records = classifyRecords([
    rec({ url: "https://example.com/ok", canonical: "https://example.com/ok" }),
    rec({ url: "https://example.com/noi", noindex: true, canonical: "https://example.com/noi" }),
  ]);
  it("returns all when filter is 'all'", () => {
    expect(filterByClassification(records, "all")).toHaveLength(2);
  });
  it("filters by classification", () => {
    expect(filterByClassification(records, "noindex")).toHaveLength(1);
    expect(filterByClassification(records, "noindex")[0].url).toBe("https://example.com/noi");
  });
  it("returns empty when no match", () => {
    expect(filterByClassification(records, "error_status")).toHaveLength(0);
  });
});

describe("index-coverage-reporter renderTextReport", () => {
  it("renders report with summary", () => {
    const records = classifyRecords([
      rec({ url: "https://example.com/a", canonical: "https://example.com/a" }),
      rec({ url: "https://example.com/b", canonical: "https://example.com/a" }),
    ]);
    const summary = summarizeCoverage(records);
    const txt = renderTextReport(records, summary, [], [], [], []);
    expect(txt).toContain("Index Coverage Report");
    expect(txt).toContain("Total URLs: 2");
    expect(txt).toContain("Indexable: 1");
    expect(txt).toContain("Canonicalized: 1");
  });
  it("includes duplicate groups section when present", () => {
    const records = classifyRecords([
      rec({ url: "https://example.com/a", canonical: "https://example.com/canonical" }),
      rec({ url: "https://example.com/b", canonical: "https://example.com/canonical" }),
    ]);
    const summary = summarizeCoverage(records);
    const dupGroups = findDuplicateCanonicalGroups(records);
    const txt = renderTextReport(records, summary, [], dupGroups, [], []);
    expect(txt).toContain("Duplicate canonical groups");
    expect(txt).toContain("https://example.com/canonical");
  });
  it("includes recommendations section when present", () => {
    const records = classifyRecords([
      rec({ url: "https://example.com/err", statusCode: 500, canonical: "https://example.com/err" }),
    ]);
    const summary = summarizeCoverage(records);
    const recs = generateRecommendations(records, [], [], []);
    const txt = renderTextReport(records, summary, [], [], [], recs);
    expect(txt).toContain("Recommendations");
    expect(txt).toContain("[HIGH]");
  });
});

describe("index-coverage-reporter renderCsv", () => {
  it("renders header only for empty input", () => {
    const csv = renderCsv([]);
    expect(csv).toBe("url,classification,canonical_target,status_code,noindex,robots_blocked,reason");
  });
  it("renders rows for classified records", () => {
    const records = classifyRecords([
      rec({ url: "https://example.com/a", canonical: "https://example.com/a" }),
    ]);
    const csv = renderCsv(records);
    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toContain("https://example.com/a,indexable");
  });
  it("escapes commas in reasons", () => {
    const records = classifyRecords([
      rec({ url: "https://example.com/a", canonical: "https://example.com/a", robotsBlocked: true }),
    ]);
    const csv = renderCsv(records);
    // The reason for robots_blocked contains a comma → should be quoted
    expect(csv).toContain('"');
  });
});

describe("index-coverage-reporter history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, total: 100, indexable: 80, blocked: 10, recommendations: 5 });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].total).toBe(100);
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, total: i, indexable: 0, blocked: 0, recommendations: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, total: 1, indexable: 1, blocked: 0, recommendations: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("index-coverage-reporter shareable URL", () => {
  it("builds share URL with records encoded", () => {
    const records = [
      rec({ url: "https://example.com/a", canonical: "https://example.com/a" }),
      rec({ url: "https://example.com/b", canonical: "https://example.com/a", noindex: true }),
    ];
    const url = buildShareUrl(records);
    expect(url).toContain("d=");
    expect(url).toContain("https%3A%2F%2Fexample.com");
  });
  it("parses share URL back into records", () => {
    const records = [
      rec({ url: "https://example.com/a", canonical: "https://example.com/a" }),
      rec({ url: "https://example.com/b", canonical: "https://example.com/a", noindex: true }),
    ];
    const url = buildShareUrl(records);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].url).toBe("https://example.com/a");
    expect(parsed[1].noindex).toBe(true);
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual([]);
  });
  it("returns empty when no d param", () => {
    expect(parseShareUrl("foo=bar")).toEqual([]);
  });
  it("caps at 100 records in URL", () => {
    const records: UrlRecord[] = [];
    for (let i = 0; i < 150; i++) {
      records.push(rec({ url: `https://example.com/${i}`, canonical: `https://example.com/${i}` }));
    }
    const url = buildShareUrl(records);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed).toHaveLength(100);
  });
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl([rec({})]);
    expect(url.startsWith("?")).toBe(true);
    (globalThis as Record<string, unknown>).window = origWindow;
  });
});

// Suppress unused-import lint for type-only imports
export type _Unused = ClassificationFilter;
