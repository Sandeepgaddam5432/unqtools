import { describe, it, expect, beforeEach } from "vitest";
import {
  OPPORTUNITY_LABELS,
  THRESHOLDS,
  normalizeUrl,
  normalizeQuery,
  splitCsvRow,
  calculateCtr,
  parseCsv,
  validateRecord,
  filterValid,
  assignOpportunity,
  annotateOpportunities,
  aggregateByUrl,
  aggregateByQuery,
  topPages,
  topQueries,
  findHighImpressionLowCtr,
  findStrikingDistance,
  findLowPositionHighImp,
  findHighPositionLowImp,
  generateRecommendations,
  computeSiteStats,
  filterByOpportunity,
  computeSummaryStats,
  formatNumber,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SearchConsoleRecord,
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

const SAMPLE_CSV = `URL,Query,Clicks,Impressions,CTR,Position
https://example.com/page1,best seo tools,150,5000,3.0,8.5
https://example.com/page1,seo software,80,3000,2.7,12.3
https://example.com/page2,keyword research,200,8000,2.5,5.2
https://example.com/page3,seo audit,5,1500,0.3,14.8
https://example.com/page4,cheap tools,2,50,4.0,3.5`;

const SAMPLE_RECORDS: SearchConsoleRecord[] = [
  { url: "https://example.com/page1", query: "best seo tools", clicks: 150, impressions: 5000, ctr: 3.0, position: 8.5 },
  { url: "https://example.com/page1", query: "seo software", clicks: 80, impressions: 3000, ctr: 2.7, position: 12.3 },
  { url: "https://example.com/page2", query: "keyword research", clicks: 200, impressions: 8000, ctr: 2.5, position: 5.2 },
  { url: "https://example.com/page3", query: "seo audit", clicks: 5, impressions: 1500, ctr: 0.3, position: 14.8 },
  { url: "https://example.com/page4", query: "cheap tools", clicks: 2, impressions: 50, ctr: 4.0, position: 3.5 },
];

describe("search-console-data-analyzer constants", () => {
  it("has labels for all opportunity types", () => {
    expect(Object.keys(OPPORTUNITY_LABELS)).toHaveLength(5);
  });
  it("has thresholds for all opportunity types", () => {
    expect(THRESHOLDS.highImpressionLowCtr.minImpressions).toBe(1000);
    expect(THRESHOLDS.highImpressionLowCtr.maxCtr).toBe(2);
    expect(THRESHOLDS.strikingDistance.minPosition).toBe(5);
    expect(THRESHOLDS.strikingDistance.maxPosition).toBe(15);
    expect(THRESHOLDS.lowPositionHighImp.minPosition).toBe(11);
    expect(THRESHOLDS.highPositionLowImp.maxPosition).toBe(10);
  });
});

describe("search-console-data-analyzer normalize", () => {
  it("normalizeUrl trims and collapses whitespace", () => {
    expect(normalizeUrl("  https://x.com /p  ")).toBe("https://x.com /p");
  });
  it("normalizeQuery lowercases and collapses whitespace", () => {
    expect(normalizeQuery("  Best   SEO  ")).toBe("best seo");
  });
  it("normalizeQuery handles empty", () => {
    expect(normalizeQuery("")).toBe("");
  });
});

describe("search-console-data-analyzer splitCsvRow", () => {
  it("splits simple rows", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("handles escaped quotes", () => {
    expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]);
  });
});

describe("search-console-data-analyzer calculateCtr", () => {
  it("computes CTR percentage", () => {
    expect(calculateCtr(150, 5000)).toBeCloseTo(3);
    expect(calculateCtr(80, 3000)).toBeCloseTo(2.667, 2);
  });
  it("returns 0 when impressions=0", () => {
    expect(calculateCtr(10, 0)).toBe(0);
  });
  it("returns 0 when impressions negative", () => {
    expect(calculateCtr(10, -5)).toBe(0);
  });
});

describe("search-console-data-analyzer parseCsv", () => {
  it("parses a well-formed CSV", () => {
    const records = parseCsv(SAMPLE_CSV);
    expect(records).toHaveLength(5);
    expect(records[0].url).toBe("https://example.com/page1");
    expect(records[0].query).toBe("best seo tools");
    expect(records[0].clicks).toBe(150);
    expect(records[0].impressions).toBe(5000);
    expect(records[0].ctr).toBe(3);
    expect(records[0].position).toBe(8.5);
  });
  it("parses case-insensitive headers", () => {
    const csv = `url,query,clicks,impressions,ctr,position
https://x.com/p,foo,10,100,10,5`;
    const records = parseCsv(csv);
    expect(records).toHaveLength(1);
    expect(records[0].url).toBe("https://x.com/p");
  });
  it("parses alternate column names (page, keyword)", () => {
    const csv = `Page,Keyword,Clicks,Impressions,Position
https://x.com/p,foo,10,100,5`;
    const records = parseCsv(csv);
    expect(records).toHaveLength(1);
    expect(records[0].ctr).toBeCloseTo(10);
  });
  it("calculates CTR when column missing", () => {
    const csv = `URL,Query,Clicks,Impressions,Position
https://x.com/p,foo,10,100,5`;
    const records = parseCsv(csv);
    expect(records).toHaveLength(1);
    expect(records[0].ctr).toBeCloseTo(10);
  });
  it("handles CTR with % sign", () => {
    const csv = `URL,Query,Clicks,Impressions,CTR,Position
https://x.com/p,foo,10,100,10%,5`;
    const records = parseCsv(csv);
    expect(records[0].ctr).toBe(10);
  });
  it("returns empty for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });
  it("returns empty for header only", () => {
    expect(parseCsv("URL,Query,Clicks,Impressions,CTR,Position")).toEqual([]);
  });
  it("returns empty when required columns missing", () => {
    expect(parseCsv("URL,Query\na,b")).toEqual([]);
  });
  it("skips rows with empty url or query", () => {
    const csv = `URL,Query,Clicks,Impressions,CTR,Position
,foo,10,100,10,5
https://x.com/p,,10,100,10,5`;
    expect(parseCsv(csv)).toHaveLength(0);
  });
  it("skips rows with non-numeric values", () => {
    const csv = `URL,Query,Clicks,Impressions,CTR,Position
https://x.com/p,foo,abc,100,10,5`;
    expect(parseCsv(csv)).toHaveLength(0);
  });
});

describe("search-console-data-analyzer validateRecord", () => {
  it("validates a good record", () => {
    expect(validateRecord(SAMPLE_RECORDS[0])).toBe(true);
  });
  it("rejects empty url", () => {
    expect(validateRecord({ ...SAMPLE_RECORDS[0], url: "" })).toBe(false);
  });
  it("rejects empty query", () => {
    expect(validateRecord({ ...SAMPLE_RECORDS[0], query: "" })).toBe(false);
  });
  it("rejects negative clicks", () => {
    expect(validateRecord({ ...SAMPLE_RECORDS[0], clicks: -5 })).toBe(false);
  });
  it("rejects position <= 0", () => {
    expect(validateRecord({ ...SAMPLE_RECORDS[0], position: 0 })).toBe(false);
    expect(validateRecord({ ...SAMPLE_RECORDS[0], position: -1 })).toBe(false);
  });
  it("rejects NaN values", () => {
    expect(validateRecord({ ...SAMPLE_RECORDS[0], clicks: Number.NaN })).toBe(false);
  });
  it("filterValid removes invalid records", () => {
    const mixed = [
      SAMPLE_RECORDS[0],
      { ...SAMPLE_RECORDS[0], url: "" },
    ];
    expect(filterValid(mixed)).toHaveLength(1);
  });
});

describe("search-console-data-analyzer assignOpportunity", () => {
  it("detects striking-distance (position 5-15)", () => {
    expect(assignOpportunity({ url: "u", query: "q", clicks: 10, impressions: 100, ctr: 10, position: 8 })).toBe("striking-distance");
    expect(assignOpportunity({ url: "u", query: "q", clicks: 10, impressions: 100, ctr: 10, position: 5 })).toBe("striking-distance");
    expect(assignOpportunity({ url: "u", query: "q", clicks: 10, impressions: 100, ctr: 10, position: 15 })).toBe("striking-distance");
  });
  it("detects high-imp-low-ctr (outside striking distance)", () => {
    // Position 20 (outside striking), high impressions, low CTR
    expect(assignOpportunity({ url: "u", query: "q", clicks: 10, impressions: 1500, ctr: 0.5, position: 20 })).toBe("high-imp-low-ctr");
  });
  it("detects low-pos-high-imp (page 2+, high impressions, not low ctr)", () => {
    // Position 20, impressions 600, CTR 5% (not low ctr)
    expect(assignOpportunity({ url: "u", query: "q", clicks: 30, impressions: 600, ctr: 5, position: 20 })).toBe("low-pos-high-imp");
  });
  it("detects high-pos-low-imp (page 1, low impressions)", () => {
    // Position 3, impressions 50
    expect(assignOpportunity({ url: "u", query: "q", clicks: 2, impressions: 50, ctr: 4, position: 3 })).toBe("high-pos-low-imp");
  });
  it("returns none when no opportunity matches", () => {
    // Position 4, impressions 200, CTR 5% — page 1 but too many impressions for high-pos-low-imp
    expect(assignOpportunity({ url: "u", query: "q", clicks: 10, impressions: 200, ctr: 5, position: 4 })).toBe("none");
  });
  it("annotateOpportunities labels all records", () => {
    const annotated = annotateOpportunities(SAMPLE_RECORDS);
    expect(annotated).toHaveLength(5);
    expect(annotated.every((r) => "opportunity" in r)).toBe(true);
  });
});

describe("search-console-data-analyzer aggregateByUrl", () => {
  it("aggregates by URL", () => {
    const agg = aggregateByUrl(SAMPLE_RECORDS);
    // 4 unique URLs
    expect(agg).toHaveLength(4);
    const p1 = agg.find((a) => a.url === "https://example.com/page1")!;
    expect(p1.totalClicks).toBe(230); // 150 + 80
    expect(p1.totalImpressions).toBe(8000); // 5000 + 3000
    expect(p1.queryCount).toBe(2);
  });
  it("sorts by total clicks descending", () => {
    const agg = aggregateByUrl(SAMPLE_RECORDS);
    expect(agg[0].totalClicks).toBeGreaterThanOrEqual(agg[1].totalClicks);
  });
  it("returns empty for empty input", () => {
    expect(aggregateByUrl([])).toEqual([]);
  });
});

describe("search-console-data-analyzer aggregateByQuery", () => {
  it("aggregates by query", () => {
    const agg = aggregateByQuery(SAMPLE_RECORDS);
    expect(agg).toHaveLength(5);
    const kr = agg.find((a) => a.query === "keyword research")!;
    expect(kr.totalClicks).toBe(200);
    expect(kr.urlCount).toBe(1);
  });
  it("sorts by total clicks descending", () => {
    const agg = aggregateByQuery(SAMPLE_RECORDS);
    expect(agg[0].totalClicks).toBe(200);
  });
});

describe("search-console-data-analyzer topPages & topQueries", () => {
  it("topPages returns top N", () => {
    const agg = aggregateByUrl(SAMPLE_RECORDS);
    expect(topPages(agg, 3)).toHaveLength(3);
    expect(topPages(agg, 3)[0].totalClicks).toBeGreaterThanOrEqual(topPages(agg, 3)[2].totalClicks);
  });
  it("topQueries returns top N", () => {
    const agg = aggregateByQuery(SAMPLE_RECORDS);
    expect(topQueries(agg, 2)).toHaveLength(2);
  });
  it("topPages handles n larger than list", () => {
    const agg = aggregateByUrl(SAMPLE_RECORDS);
    expect(topPages(agg, 100)).toHaveLength(4);
  });
});

describe("search-console-data-analyzer findHighImpressionLowCtr", () => {
  it("finds records with impressions ≥ 1000 AND ctr < 2%", () => {
    const out = findHighImpressionLowCtr(SAMPLE_RECORDS);
    // page3 seo audit: impressions 1500, ctr 0.3 → matches
    expect(out).toHaveLength(1);
    expect(out[0].query).toBe("seo audit");
  });
  it("returns empty for empty input", () => {
    expect(findHighImpressionLowCtr([])).toEqual([]);
  });
  it("excludes records below impression threshold", () => {
    const records = [
      { url: "u", query: "q", clicks: 1, impressions: 500, ctr: 0.5, position: 20 },
    ];
    expect(findHighImpressionLowCtr(records)).toHaveLength(0);
  });
  it("excludes records with high CTR", () => {
    const records = [
      { url: "u", query: "q", clicks: 100, impressions: 1500, ctr: 5, position: 20 },
    ];
    expect(findHighImpressionLowCtr(records)).toHaveLength(0);
  });
});

describe("search-console-data-analyzer findStrikingDistance", () => {
  it("finds records with position 5-15", () => {
    const out = findStrikingDistance(SAMPLE_RECORDS);
    // page1 best seo tools (8.5), page2 keyword research (5.2), page1 seo software (12.3), page3 seo audit (14.8)
    expect(out).toHaveLength(4);
    expect(out.every((r) => r.position >= 5 && r.position <= 15)).toBe(true);
  });
  it("excludes records outside range", () => {
    const records = [
      { url: "u", query: "q", clicks: 10, impressions: 100, ctr: 10, position: 4 },
      { url: "u", query: "q2", clicks: 10, impressions: 100, ctr: 10, position: 16 },
    ];
    expect(findStrikingDistance(records)).toHaveLength(0);
  });
});

describe("search-console-data-analyzer findLowPositionHighImp", () => {
  it("finds page 2+ records with high impressions", () => {
    const out = findLowPositionHighImp(SAMPLE_RECORDS);
    // page1 seo software: position 12.3, impressions 3000 → matches
    // page3 seo audit: position 14.8, impressions 1500 → matches
    expect(out).toHaveLength(2);
  });
  it("excludes records on page 1", () => {
    const records = [
      { url: "u", query: "q", clicks: 10, impressions: 600, ctr: 5, position: 10 },
    ];
    expect(findLowPositionHighImp(records)).toHaveLength(0);
  });
});

describe("search-console-data-analyzer findHighPositionLowImp", () => {
  it("finds page 1 records with low impressions", () => {
    const out = findHighPositionLowImp(SAMPLE_RECORDS);
    // page4 cheap tools: position 3.5, impressions 50 → matches
    expect(out).toHaveLength(1);
    expect(out[0].query).toBe("cheap tools");
  });
  it("excludes records on page 2+", () => {
    const records = [
      { url: "u", query: "q", clicks: 10, impressions: 50, ctr: 20, position: 11 },
    ];
    expect(findHighPositionLowImp(records)).toHaveLength(0);
  });
});

describe("search-console-data-analyzer generateRecommendations", () => {
  it("generates recommendations for each opportunity type", () => {
    const recs = generateRecommendations(SAMPLE_RECORDS);
    expect(recs.length).toBeGreaterThan(0);
    const types = new Set(recs.map((r) => r.type));
    expect(types.has("high-imp-low-ctr")).toBe(true);
    expect(types.has("low-pos-high-imp")).toBe(true);
    expect(types.has("striking-distance")).toBe(true);
    expect(types.has("high-pos-low-imp")).toBe(true);
  });
  it("includes url and query in recommendations", () => {
    const recs = generateRecommendations(SAMPLE_RECORDS);
    for (const r of recs) {
      expect(r.url.length).toBeGreaterThan(0);
      expect(r.query.length).toBeGreaterThan(0);
      expect(r.message.length).toBeGreaterThan(0);
    }
  });
  it("limits recommendations per type", () => {
    const many: SearchConsoleRecord[] = [];
    for (let i = 0; i < 20; i++) {
      many.push({ url: `https://x.com/p${i}`, query: `q${i}`, clicks: 1, impressions: 2000, ctr: 0.5, position: 20 });
    }
    const recs = generateRecommendations(many, 5);
    const hilCount = recs.filter((r) => r.type === "high-imp-low-ctr").length;
    expect(hilCount).toBeLessThanOrEqual(5);
  });
  it("returns empty for empty input", () => {
    expect(generateRecommendations([])).toEqual([]);
  });
});

describe("search-console-data-analyzer computeSiteStats", () => {
  it("computes site-level totals", () => {
    const stats = computeSiteStats(SAMPLE_RECORDS);
    expect(stats.totalRecords).toBe(5);
    expect(stats.totalClicks).toBe(437); // 150+80+200+5+2
    expect(stats.totalImpressions).toBe(17550); // 5000+3000+8000+1500+50
    expect(stats.urlCount).toBe(4);
    expect(stats.queryCount).toBe(5);
    expect(stats.opportunityCount).toBeGreaterThan(0);
  });
  it("returns zeros for empty input", () => {
    const stats = computeSiteStats([]);
    expect(stats.totalRecords).toBe(0);
    expect(stats.totalClicks).toBe(0);
    expect(stats.avgPosition).toBe(0);
  });
  it("avgCtr is calculated correctly", () => {
    const stats = computeSiteStats(SAMPLE_RECORDS);
    // total clicks / total impressions × 100
    expect(stats.avgCtr).toBeCloseTo(2.49, 1);
  });
});

describe("search-console-data-analyzer filterByOpportunity", () => {
  it("returns all when mode='all'", () => {
    const annotated = annotateOpportunities(SAMPLE_RECORDS);
    expect(filterByOpportunity(annotated, "all")).toHaveLength(5);
  });
  it("filters by specific opportunity type", () => {
    const annotated = annotateOpportunities(SAMPLE_RECORDS);
    const sd = filterByOpportunity(annotated, "striking-distance");
    expect(sd.length).toBeGreaterThan(0);
    expect(sd.every((r) => r.opportunity === "striking-distance")).toBe(true);
  });
});

describe("search-console-data-analyzer computeSummaryStats", () => {
  it("computes summary stats", () => {
    const stats = computeSummaryStats(SAMPLE_RECORDS);
    expect(stats.totalUrls).toBe(4);
    expect(stats.totalQueries).toBe(5);
    expect(stats.totalClicks).toBe(437);
    expect(stats.totalImpressions).toBe(17550);
    expect(stats.opportunityCount).toBeGreaterThan(0);
  });
});

describe("search-console-data-analyzer formatNumber", () => {
  it("formats numbers with separators", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });
  it("handles decimals", () => {
    expect(formatNumber(1234.56)).toBe("1,234.56");
  });
  it("handles non-finite as 0", () => {
    expect(formatNumber(Number.NaN)).toBe("0");
  });
});

describe("search-console-data-analyzer renderText", () => {
  it("renders a full report", () => {
    const recs = generateRecommendations(SAMPLE_RECORDS);
    const text = renderText(SAMPLE_RECORDS, recs);
    expect(text).toContain("SEARCH CONSOLE DATA ANALYZER REPORT");
    expect(text).toContain("Total records: 5");
    expect(text).toContain("TOP 5 PAGES");
    expect(text).toContain("TOP 5 QUERIES");
    expect(text).toContain("RECOMMENDATIONS");
    expect(text).toContain("best seo tools");
  });
  it("renders empty input gracefully", () => {
    const text = renderText([], []);
    expect(text).toContain("Total records: 0");
  });
});

describe("search-console-data-analyzer renderCsv", () => {
  it("renders header", () => {
    expect(renderCsv([])).toContain("url,query,clicks,impressions,ctr,position,opportunity_type");
  });
  it("renders annotated records", () => {
    const annotated = annotateOpportunities(SAMPLE_RECORDS);
    const csv = renderCsv(annotated);
    expect(csv).toContain("https://example.com/page1");
    expect(csv).toContain("best seo tools");
    expect(csv).toContain("striking-distance");
  });
});

describe("search-console-data-analyzer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      records: 5,
      totalClicks: 437,
      totalImpressions: 17550,
      avgPosition: 8.86,
      opportunityCount: 4,
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].records).toBe(5);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        records: 1,
        totalClicks: 0,
        totalImpressions: 0,
        avgPosition: 0,
        opportunityCount: 0,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      records: 1,
      totalClicks: 0,
      totalImpressions: 0,
      avgPosition: 0,
      opportunityCount: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("search-console-data-analyzer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("URL,Query,Clicks\nx,y,1");
    expect(url).toContain("csv=URL");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const csv = "URL,Query,Clicks,Impressions,CTR,Position\nx,y,1,10,10,5";
    const url = buildShareUrl(csv);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed).toBe(csv);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toBe("");
  });
  it("returns empty string for hash without csv param", () => {
    expect(parseShareUrl("foo=bar")).toBe("");
  });
});
