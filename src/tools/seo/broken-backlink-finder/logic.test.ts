import { describe, it, expect, beforeEach } from "vitest";
import {
  STATUS_CODE_REFERENCE,
  categorizeStatus,
  lookupStatus,
  isBrokenStatus,
  opportunityScore,
  brokenReason,
  recommendation,
  scoreEntry,
  splitCsvRow,
  parseCsv,
  scoreAll,
  renderCsv,
  renderReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type BacklinkEntry,
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

describe("broken-backlink-finder STATUS_CODE_REFERENCE", () => {
  it("includes 200, 301, 404, 500", () => {
    expect(STATUS_CODE_REFERENCE[200]).toBeDefined();
    expect(STATUS_CODE_REFERENCE[301]).toBeDefined();
    expect(STATUS_CODE_REFERENCE[404]).toBeDefined();
    expect(STATUS_CODE_REFERENCE[500]).toBeDefined();
  });
});

describe("broken-backlink-finder categorizeStatus", () => {
  it("categorizes 2xx", () => {
    expect(categorizeStatus(200)).toBe("2xx");
    expect(categorizeStatus(204)).toBe("2xx");
  });
  it("categorizes 3xx", () => {
    expect(categorizeStatus(301)).toBe("3xx");
    expect(categorizeStatus(302)).toBe("3xx");
  });
  it("categorizes 4xx", () => {
    expect(categorizeStatus(404)).toBe("4xx");
    expect(categorizeStatus(403)).toBe("4xx");
  });
  it("categorizes 5xx", () => {
    expect(categorizeStatus(500)).toBe("5xx");
    expect(categorizeStatus(503)).toBe("5xx");
  });
  it("returns unknown for out-of-range", () => {
    expect(categorizeStatus(99)).toBe("unknown");
    expect(categorizeStatus(600)).toBe("unknown");
    expect(categorizeStatus(NaN)).toBe("unknown");
  });
});

describe("broken-backlink-finder lookupStatus", () => {
  it("returns reference info for known codes", () => {
    const info = lookupStatus(404);
    expect(info.label).toBe("Not Found");
    expect(info.isBroken).toBe(true);
  });
  it("returns fallback for unknown codes", () => {
    const info = lookupStatus(418);
    expect(info.category).toBe("4xx");
    expect(info.isBroken).toBe(true);
    expect(info.label).toBe("Unknown");
  });
});

describe("broken-backlink-finder isBrokenStatus", () => {
  it("returns true for 4xx and 5xx", () => {
    expect(isBrokenStatus(404)).toBe(true);
    expect(isBrokenStatus(500)).toBe(true);
    expect(isBrokenStatus(503)).toBe(true);
  });
  it("returns false for 2xx and 3xx", () => {
    expect(isBrokenStatus(200)).toBe(false);
    expect(isBrokenStatus(301)).toBe(false);
  });
  it("returns false for 429 (rate limited — temporary)", () => {
    expect(isBrokenStatus(429)).toBe(false);
  });
});

describe("broken-backlink-finder opportunityScore", () => {
  it("returns 0 for healthy links", () => {
    expect(opportunityScore({ url: "x", statusCode: 200 })).toBe(0);
    expect(opportunityScore({ url: "x", statusCode: 301 })).toBe(0);
  });
  it("scores 404 highest", () => {
    const score = opportunityScore({ url: "x", statusCode: 404, anchor: "brand", sourceDomain: "forbes.com" });
    expect(score).toBe(100); // 50 + 30 (404) + 10 (anchor) + 10 (source)
  });
  it("scores 410 high", () => {
    const score = opportunityScore({ url: "x", statusCode: 410, anchor: "brand", sourceDomain: "forbes.com" });
    expect(score).toBe(95); // 50 + 25 + 10 + 10
  });
  it("scores 5xx lower than 404", () => {
    const score = opportunityScore({ url: "x", statusCode: 500 });
    expect(score).toBe(60); // 50 + 10
  });
  it("caps at 100", () => {
    const score = opportunityScore({ url: "x", statusCode: 404, anchor: "x", sourceDomain: "x" });
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("broken-backlink-finder brokenReason", () => {
  it("returns OK for healthy", () => {
    expect(brokenReason({ url: "x", statusCode: 200 })).toBe("OK");
  });
  it("returns label + code for broken", () => {
    const r = brokenReason({ url: "x", statusCode: 404 });
    expect(r).toContain("404");
    expect(r).toContain("Not Found");
  });
});

describe("broken-backlink-finder recommendation", () => {
  it("recommends reclaim for 404", () => {
    const r = recommendation({ url: "x", statusCode: 404 });
    expect(r.toLowerCase()).toContain("reclaim");
  });
  it("recommends investigate for 5xx", () => {
    const r = recommendation({ url: "x", statusCode: 500 });
    expect(r.toLowerCase()).toContain("investigate");
  });
  it("recommends no action for healthy", () => {
    const r = recommendation({ url: "x", statusCode: 200 });
    expect(r.toLowerCase()).toContain("no action");
  });
});

describe("broken-backlink-finder scoreEntry", () => {
  it("scores an entry end-to-end", () => {
    const e = scoreEntry({ url: "https://example.com/dead", statusCode: 404, anchor: "click here", sourceDomain: "forbes.com" });
    expect(e.isBroken).toBe(true);
    expect(e.category).toBe("4xx");
    expect(e.opportunityScore).toBe(100);
    expect(e.reason).toContain("Not Found");
  });
});

describe("broken-backlink-finder splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
});

describe("broken-backlink-finder parseCsv", () => {
  it("parses headerless rows", () => {
    const input = "https://example.com/p1,404,click here,https://forbes.com/a,forbes.com";
    const { entries, errors } = parseCsv(input);
    expect(entries).toHaveLength(1);
    expect(errors).toHaveLength(0);
    expect(entries[0].statusCode).toBe(404);
    expect(entries[0].anchor).toBe("click here");
  });
  it("parses with header", () => {
    const input = "url,status_code,anchor,source_url,source_domain\nhttps://example.com/p1,404,brand,https://forbes.com/a,forbes.com";
    const { entries, errors } = parseCsv(input);
    expect(entries).toHaveLength(1);
    expect(errors).toHaveLength(0);
  });
  it("skips invalid status codes", () => {
    const input = "https://example.com/p1,notnumber,brand";
    const { entries, errors } = parseCsv(input);
    expect(entries).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });
  it("skips missing URL", () => {
    const input = ",404,brand";
    const { entries, errors } = parseCsv(input);
    expect(entries).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });
  it("returns empty for empty input", () => {
    const { entries, errors } = parseCsv("");
    expect(entries).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });
});

describe("broken-backlink-finder scoreAll", () => {
  it("computes summary stats", () => {
    const entries: BacklinkEntry[] = [
      { url: "https://example.com/a", statusCode: 200 },
      { url: "https://example.com/b", statusCode: 404, anchor: "x", sourceDomain: "forbes.com" },
      { url: "https://example.com/c", statusCode: 500 },
      { url: "https://example.com/d", statusCode: 301 },
    ];
    const r = scoreAll(entries);
    expect(r.total).toBe(4);
    expect(r.broken).toBe(2);
    expect(r.healthy).toBe(2);
    expect(r.byCategory["2xx"]).toBe(1);
    expect(r.byCategory["3xx"]).toBe(1);
    expect(r.byCategory["4xx"]).toBe(1);
    expect(r.byCategory["5xx"]).toBe(1);
    expect(r.uniqueBrokenDomains).toBe(1);
  });
  it("returns top opportunities sorted by score", () => {
    const entries: BacklinkEntry[] = [
      { url: "https://example.com/a", statusCode: 500 },
      { url: "https://example.com/b", statusCode: 404, anchor: "x", sourceDomain: "forbes.com" },
    ];
    const r = scoreAll(entries);
    expect(r.topOpportunities[0].statusCode).toBe(404);
  });
  it("handles empty input", () => {
    const r = scoreAll([]);
    expect(r.total).toBe(0);
    expect(r.broken).toBe(0);
  });
});

describe("broken-backlink-finder renderCsv", () => {
  it("produces CSV with summary + broken links", () => {
    const r = scoreAll([{ url: "https://example.com/x", statusCode: 404 }]);
    const csv = renderCsv(r);
    expect(csv).toContain("total,1");
    expect(csv).toContain("broken,1");
    expect(csv).toContain("https://example.com/x");
  });
});

describe("broken-backlink-finder renderReport", () => {
  it("produces human-readable report", () => {
    const r = scoreAll([{ url: "https://example.com/x", statusCode: 404 }]);
    const report = renderReport(r);
    expect(report).toContain("Broken Backlink Report");
    expect(report).toContain("Total: 1");
  });
});

describe("broken-backlink-finder history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, total: 10, broken: 5, healthy: 5, averageOpportunity: 75 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, total: i, broken: 1, healthy: 1, averageOpportunity: 50 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, total: 1, broken: 1, healthy: 0, averageOpportunity: 50 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("broken-backlink-finder shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("https://example.com/x,404");
    expect(url).toContain("data=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const parsed = parseShareUrl("data=https%3A%2F%2Fexample.com");
    expect(parsed.data).toBe("https://example.com");
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({ data: "" });
  });
});
