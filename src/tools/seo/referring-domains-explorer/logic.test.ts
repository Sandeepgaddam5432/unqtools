import { describe, it, expect, beforeEach } from "vitest";
import {
  normalize,
  extractDomain,
  extractTld,
  estimateDa,
  splitCsvRow,
  parseInput,
  buildDomainStats,
  sortDomains,
  filterDomains,
  computeTldDistribution,
  explore,
  renderCsv,
  renderReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type BacklinkRow,
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

describe("referring-domains-explorer normalize", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalize("  Hello   World  ")).toBe("hello world");
  });
});

describe("referring-domains-explorer extractDomain", () => {
  it("strips https:// and www.", () => {
    expect(extractDomain("https://www.example.com/path/page")).toBe("example.com");
  });
  it("strips http://", () => {
    expect(extractDomain("http://example.com")).toBe("example.com");
  });
  it("handles bare domain", () => {
    expect(extractDomain("example.com")).toBe("example.com");
  });
  it("strips port", () => {
    expect(extractDomain("https://example.com:8080/path")).toBe("example.com");
  });
  it("returns empty for empty input", () => {
    expect(extractDomain("")).toBe("");
  });
});

describe("referring-domains-explorer extractTld", () => {
  it("extracts simple TLD", () => {
    expect(extractTld("example.com")).toBe("com");
    expect(extractTld("sub.example.org")).toBe("org");
  });
  it("handles multi-part TLDs", () => {
    expect(extractTld("example.co.uk")).toBe("co.uk");
    expect(extractTld("example.com.au")).toBe("com.au");
  });
  it("returns empty for single segment", () => {
    expect(extractTld("localhost")).toBe("");
  });
});

describe("referring-domains-explorer estimateDa", () => {
  it("estimates 80 for gov/edu", () => {
    expect(estimateDa("nasa.gov")).toBe(80);
    expect(estimateDa("mit.edu")).toBe(80);
  });
  it("estimates 50 for common TLDs", () => {
    expect(estimateDa("example.com")).toBe(50);
    expect(estimateDa("example.io")).toBe(50);
  });
  it("estimates 15 for spam-prone TLDs", () => {
    expect(estimateDa("example.xyz")).toBe(15);
    expect(estimateDa("example.top")).toBe(15);
  });
  it("defaults to 30 for unknown TLDs", () => {
    expect(estimateDa("example.us")).toBe(30);
  });
});

describe("referring-domains-explorer splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
  it("handles escaped quotes", () => { expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]); });
});

describe("referring-domains-explorer parseInput", () => {
  it("parses headerless rows", () => {
    const input = "https://forbes.com/p1,https://example.com/article,brand anchor,90";
    const { rows, errors } = parseInput(input);
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(0);
    expect(rows[0].sourceUrl).toBe("https://forbes.com/p1");
    expect(rows[0].anchor).toBe("brand anchor");
    expect(rows[0].domainAuthority).toBe(90);
  });
  it("parses with header", () => {
    const input = "source_url,target_url,anchor,da\nhttps://forbes.com/p1,https://example.com/a,brand,90";
    const { rows, errors } = parseInput(input);
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(0);
    expect(rows[0].sourceUrl).toBe("https://forbes.com/p1");
  });
  it("skips rows with missing source URL", () => {
    const input = ",https://example.com/a,brand,90";
    const { rows, errors } = parseInput(input);
    expect(rows).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });
  it("returns empty for empty input", () => {
    const { rows, errors } = parseInput("");
    expect(rows).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });
  it("handles missing DA column gracefully", () => {
    const input = "https://forbes.com/p1,https://example.com/a";
    const { rows } = parseInput(input);
    expect(rows).toHaveLength(1);
    expect(rows[0].domainAuthority).toBeUndefined();
  });
});

describe("referring-domains-explorer buildDomainStats", () => {
  it("groups rows by domain", () => {
    const rows: BacklinkRow[] = [
      { sourceUrl: "https://forbes.com/a", targetUrl: "https://example.com" },
      { sourceUrl: "https://forbes.com/b", targetUrl: "https://example.com" },
      { sourceUrl: "https://moz.com/c", targetUrl: "https://example.com" },
    ];
    const stats = buildDomainStats(rows);
    expect(stats).toHaveLength(2);
    const forbes = stats.find((s) => s.domain === "forbes.com")!;
    expect(forbes.linkCount).toBe(2);
    expect(forbes.sourceUrls).toHaveLength(2);
  });
  it("collects anchors", () => {
    const rows: BacklinkRow[] = [
      { sourceUrl: "https://forbes.com/a", targetUrl: "https://example.com", anchor: "click here" },
      { sourceUrl: "https://forbes.com/b", targetUrl: "https://example.com", anchor: "click here" },
      { sourceUrl: "https://forbes.com/c", targetUrl: "https://example.com", anchor: "best tools" },
    ];
    const stats = buildDomainStats(rows);
    const forbes = stats.find((s) => s.domain === "forbes.com")!;
    expect(forbes.anchors).toHaveLength(2);
    expect(forbes.anchors).toContain("click here");
    expect(forbes.anchors).toContain("best tools");
  });
  it("uses provided DA average", () => {
    const rows: BacklinkRow[] = [
      { sourceUrl: "https://forbes.com/a", targetUrl: "x", domainAuthority: 80 },
      { sourceUrl: "https://forbes.com/b", targetUrl: "x", domainAuthority: 90 },
    ];
    const stats = buildDomainStats(rows);
    expect(stats[0].daEstimate).toBe(85);
  });
  it("falls back to estimate when no DA provided", () => {
    const rows: BacklinkRow[] = [
      { sourceUrl: "https://example.gov/a", targetUrl: "x" },
    ];
    const stats = buildDomainStats(rows);
    expect(stats[0].daEstimate).toBe(80);
  });
});

describe("referring-domains-explorer sortDomains", () => {
  const sample: BacklinkRow[] = [
    { sourceUrl: "https://forbes.com/a", targetUrl: "x" },
    { sourceUrl: "https://forbes.com/b", targetUrl: "x" },
    { sourceUrl: "https://moz.com/c", targetUrl: "x" },
  ];
  it("sorts by linkCount desc by default", () => {
    const stats = buildDomainStats(sample);
    const sorted = sortDomains(stats);
    expect(sorted[0].domain).toBe("forbes.com");
  });
  it("sorts by domain asc", () => {
    const stats = buildDomainStats(sample);
    const sorted = sortDomains(stats, "domain", "asc");
    expect(sorted[0].domain).toBe("forbes.com");
  });
});

describe("referring-domains-explorer filterDomains", () => {
  it("filters by substring", () => {
    const rows: BacklinkRow[] = [
      { sourceUrl: "https://forbes.com/a", targetUrl: "x" },
      { sourceUrl: "https://moz.com/b", targetUrl: "x" },
    ];
    const stats = buildDomainStats(rows);
    expect(filterDomains(stats, "moz")).toHaveLength(1);
  });
  it("returns all for empty query", () => {
    const rows: BacklinkRow[] = [
      { sourceUrl: "https://forbes.com/a", targetUrl: "x" },
    ];
    const stats = buildDomainStats(rows);
    expect(filterDomains(stats, "")).toHaveLength(1);
  });
});

describe("referring-domains-explorer computeTldDistribution", () => {
  it("counts TLDs", () => {
    const rows: BacklinkRow[] = [
      { sourceUrl: "https://forbes.com/a", targetUrl: "x" },
      { sourceUrl: "https://cnn.com/b", targetUrl: "x" },
      { sourceUrl: "https://example.org/c", targetUrl: "x" },
    ];
    const stats = buildDomainStats(rows);
    const dist = computeTldDistribution(stats);
    expect(dist.com).toBe(2);
    expect(dist.org).toBe(1);
  });
});

describe("referring-domains-explorer explore", () => {
  it("computes summary stats", () => {
    const rows: BacklinkRow[] = [
      { sourceUrl: "https://forbes.com/a", targetUrl: "x", anchor: "brand" },
      { sourceUrl: "https://forbes.com/b", targetUrl: "x", anchor: "brand" },
      { sourceUrl: "https://moz.com/c", targetUrl: "x", anchor: "click here" },
    ];
    const result = explore(rows);
    expect(result.totalBacklinks).toBe(3);
    expect(result.uniqueDomains).toBe(2);
    expect(result.averageLinksPerDomain).toBe(1.5);
    expect(result.totalAnchors).toBe(3);
    expect(result.topDomains[0].domain).toBe("forbes.com");
  });
  it("handles empty input", () => {
    const result = explore([]);
    expect(result.totalBacklinks).toBe(0);
    expect(result.uniqueDomains).toBe(0);
  });
  it("computes DA buckets", () => {
    const rows: BacklinkRow[] = [
      { sourceUrl: "https://example.gov/a", targetUrl: "x" }, // 80 (high)
      { sourceUrl: "https://forbes.com/b", targetUrl: "x" },  // 50 (medium)
      { sourceUrl: "https://spam.xyz/c", targetUrl: "x" },    // 15 (low)
    ];
    const result = explore(rows);
    expect(result.byDaBucket.high).toBe(1);
    expect(result.byDaBucket.medium).toBe(1);
    expect(result.byDaBucket.low).toBe(1);
  });
});

describe("referring-domains-explorer renderCsv", () => {
  it("produces CSV with summary + top domains", () => {
    const rows: BacklinkRow[] = [
      { sourceUrl: "https://forbes.com/a", targetUrl: "x" },
    ];
    const result = explore(rows);
    const csv = renderCsv(result);
    expect(csv).toContain("total_backlinks,1");
    expect(csv).toContain("# Top domains");
    expect(csv).toContain("forbes.com");
  });
});

describe("referring-domains-explorer renderReport", () => {
  it("produces human-readable report", () => {
    const rows: BacklinkRow[] = [
      { sourceUrl: "https://forbes.com/a", targetUrl: "x" },
    ];
    const result = explore(rows);
    const report = renderReport(result);
    expect(report).toContain("Referring Domains Report");
    expect(report).toContain("Total backlinks: 1");
  });
});

describe("referring-domains-explorer history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, totalBacklinks: 10, uniqueDomains: 5, topDomain: "forbes.com", topDomainCount: 3 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, totalBacklinks: i, uniqueDomains: 1, topDomain: "x.com", topDomainCount: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, totalBacklinks: 1, uniqueDomains: 1, topDomain: "x.com", topDomainCount: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("referring-domains-explorer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("https://forbes.com/a,https://example.com/x");
    expect(url).toContain("data=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const parsed = parseShareUrl("data=https%3A%2F%2Fforbes.com");
    expect(parsed.data).toBe("https://forbes.com");
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({ data: "" });
  });
});
