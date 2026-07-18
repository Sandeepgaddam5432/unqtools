import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_TOXIC_DA_THRESHOLD,
  extractDomain,
  splitCsvRow,
  parseCsv,
  parseJson,
  parseAuto,
  computeTop,
  analyze,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
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

describe("backlink-profile-analyzer constants", () => {
  it("DEFAULT_TOXIC_DA_THRESHOLD is 20", () => {
    expect(DEFAULT_TOXIC_DA_THRESHOLD).toBe(20);
  });
});

describe("backlink-profile-analyzer extractDomain", () => {
  it("strips protocol", () => {
    expect(extractDomain("https://example.com/path")).toBe("example.com");
  });
  it("strips www", () => {
    expect(extractDomain("https://www.example.com")).toBe("example.com");
  });
  it("returns input when no protocol", () => {
    expect(extractDomain("example.com")).toBe("example.com");
  });
  it("returns empty for empty", () => {
    expect(extractDomain("")).toBe("");
  });
  it("lowercases", () => {
    expect(extractDomain("HTTPS://Example.COM")).toBe("example.com");
  });
});

describe("backlink-profile-analyzer splitCsvRow", () => {
  it("splits simple comma row", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted values with commas", () => {
    expect(splitCsvRow('"hello, world",b')).toEqual(["hello, world", "b"]);
  });
  it("handles escaped quotes", () => {
    expect(splitCsvRow('"she said ""hi""",b')).toEqual(['she said "hi"', "b"]);
  });
});

describe("backlink-profile-analyzer parseCsv", () => {
  it("returns empty for empty input", () => {
    const r = parseCsv("");
    expect(r.backlinks).toEqual([]);
    expect(r.errors).toEqual([]);
  });
  it("parses with header", () => {
    const csv = "url,anchor,source_domain,da,link_type\nhttps://a.com,click here,https://src.com,50,dofollow\nhttps://b.com,read more,https://src2.com,10,nofollow";
    const r = parseCsv(csv);
    expect(r.backlinks).toHaveLength(2);
    expect(r.backlinks[0].url).toBe("https://a.com");
    expect(r.backlinks[0].anchor).toBe("click here");
    expect(r.backlinks[0].sourceDomain).toBe("src.com");
    expect(r.backlinks[0].da).toBe(50);
    expect(r.backlinks[0].linkType).toBe("dofollow");
    expect(r.backlinks[1].linkType).toBe("nofollow");
  });
  it("parses without header (default order)", () => {
    const csv = "https://a.com,click here,src.com,50,dofollow";
    const r = parseCsv(csv);
    expect(r.backlinks).toHaveLength(1);
    expect(r.backlinks[0].url).toBe("https://a.com");
  });
  it("skips rows missing url", () => {
    const csv = "url,anchor,source_domain,da,link_type\n,click here,src.com,50,dofollow";
    const r = parseCsv(csv);
    expect(r.backlinks).toHaveLength(0);
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it("defaults da to 0 when empty", () => {
    const csv = "url,anchor,source_domain,da,link_type\nhttps://a.com,click,src.com,,dofollow";
    const r = parseCsv(csv);
    expect(r.backlinks[0].da).toBe(0);
  });
  it("defaults linkType to dofollow when not 'nofollow'", () => {
    const csv = "url,anchor,source_domain,da,link_type\nhttps://a.com,click,src.com,50,";
    const r = parseCsv(csv);
    expect(r.backlinks[0].linkType).toBe("dofollow");
  });
});

describe("backlink-profile-analyzer parseJson", () => {
  it("returns empty for empty input", () => {
    expect(parseJson("")).toEqual({ backlinks: [], errors: [] });
  });
  it("parses JSON array of objects", () => {
    const json = JSON.stringify([
      { url: "https://a.com", anchor: "click", source_domain: "src.com", da: 50, link_type: "dofollow" },
      { url: "https://b.com", anchor: "more", sourceDomain: "src2.com", da: 10, linkType: "nofollow" },
    ]);
    const r = parseJson(json);
    expect(r.backlinks).toHaveLength(2);
    expect(r.backlinks[1].sourceDomain).toBe("src2.com");
  });
  it("errors on non-array", () => {
    const r = parseJson('{"foo":"bar"}');
    expect(r.backlinks).toEqual([]);
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it("errors on invalid JSON", () => {
    const r = parseJson("{not valid");
    expect(r.backlinks).toEqual([]);
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it("skips items missing url", () => {
    const r = parseJson(JSON.stringify([{ anchor: "x" }]));
    expect(r.backlinks).toHaveLength(0);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe("backlink-profile-analyzer parseAuto", () => {
  it("detects JSON format", () => {
    const r = parseAuto(JSON.stringify([{ url: "https://a.com" }]));
    expect(r.backlinks).toHaveLength(1);
  });
  it("detects CSV format", () => {
    const r = parseAuto("url,anchor,source_domain,da,link_type\nhttps://a.com,click,src.com,50,dofollow");
    expect(r.backlinks).toHaveLength(1);
  });
  it("returns empty for empty", () => {
    expect(parseAuto("")).toEqual({ backlinks: [], errors: [] });
  });
});

describe("backlink-profile-analyzer computeTop", () => {
  it("returns empty for empty input", () => {
    expect(computeTop([])).toEqual([]);
  });
  it("counts and sorts by frequency", () => {
    const out = computeTop(["a", "b", "a", "c", "a", "b"]);
    expect(out[0].key).toBe("a");
    expect(out[0].count).toBe(3);
  });
  it("respects limit", () => {
    const out = computeTop(["a", "b", "c", "d", "e"], 3);
    expect(out.length).toBeLessThanOrEqual(3);
  });
  it("computes percentages", () => {
    const out = computeTop(["a", "a", "b"]);
    expect(out[0].percentage).toBeCloseTo(66.67, 1);
  });
  it("handles empty-string keys", () => {
    const out = computeTop(["", "a"]);
    expect(out.find((x) => x.key === "(empty)")).toBeDefined();
  });
});

describe("backlink-profile-analyzer analyze", () => {
  const sampleBacklinks = [
    { url: "https://a.com/1", anchor: "click here", sourceDomain: "src1.com", da: 50, linkType: "dofollow" as const },
    { url: "https://a.com/2", anchor: "read more", sourceDomain: "src1.com", da: 70, linkType: "dofollow" as const },
    { url: "https://a.com/3", anchor: "click here", sourceDomain: "src2.com", da: 10, linkType: "nofollow" as const },
    { url: "https://a.com/4", anchor: "visit", sourceDomain: "src3.com", da: 15, linkType: "nofollow" as const },
  ];
  it("returns zero stats for empty input", () => {
    const r = analyze([]);
    expect(r.totalBacklinks).toBe(0);
    expect(r.uniqueDomains).toBe(0);
  });
  it("counts total + unique domains", () => {
    const r = analyze(sampleBacklinks);
    expect(r.totalBacklinks).toBe(4);
    expect(r.uniqueDomains).toBe(3);
  });
  it("computes dofollow/nofollow counts", () => {
    const r = analyze(sampleBacklinks);
    expect(r.dofollowCount).toBe(2);
    expect(r.nofollowCount).toBe(2);
  });
  it("computes dofollow percentage", () => {
    const r = analyze(sampleBacklinks);
    expect(r.dofollowPercentage).toBeCloseTo(50, 1);
  });
  it("computes average DA", () => {
    const r = analyze(sampleBacklinks);
    expect(r.averageDa).toBe(Math.round((50 + 70 + 10 + 15) / 4));
  });
  it("computes top referring domains", () => {
    const r = analyze(sampleBacklinks);
    expect(r.topReferringDomains[0].key).toBe("src1.com");
    expect(r.topReferringDomains[0].count).toBe(2);
  });
  it("computes top anchor texts", () => {
    const r = analyze(sampleBacklinks);
    expect(r.topAnchorTexts[0].key).toBe("click here");
    expect(r.topAnchorTexts[0].count).toBe(2);
  });
  it("computes DA distribution", () => {
    const r = analyze(sampleBacklinks);
    expect(r.daDistribution.low).toBe(2); // DA 10, 15
    expect(r.daDistribution.medium).toBe(1); // DA 50
    expect(r.daDistribution.high).toBe(1); // DA 70
  });
  it("flags toxic links (DA < threshold)", () => {
    const r = analyze(sampleBacklinks);
    expect(r.totalToxic).toBe(2); // DA 10, 15
    expect(r.toxicLinks.every((b) => b.da < 20)).toBe(true);
  });
  it("respects custom toxic threshold", () => {
    const r = analyze(sampleBacklinks, { toxicDaThreshold: 60 });
    expect(r.totalToxic).toBe(3); // DA 10, 15, 50
  });
});

describe("backlink-profile-analyzer renderCsv", () => {
  it("renders summary section", () => {
    const csv = renderCsv(analyze([
      { url: "https://a.com", anchor: "x", sourceDomain: "src.com", da: 50, linkType: "dofollow" },
    ]));
    expect(csv).toContain("# Summary");
    expect(csv).toContain("total_backlinks,1");
  });
  it("renders top referring domains section", () => {
    const csv = renderCsv(analyze([
      { url: "https://a.com", anchor: "x", sourceDomain: "src.com", da: 50, linkType: "dofollow" },
    ]));
    expect(csv).toContain("# Top referring domains");
    expect(csv).toContain("src.com");
  });
  it("renders top anchor texts section", () => {
    const csv = renderCsv(analyze([
      { url: "https://a.com", anchor: "click here", sourceDomain: "src.com", da: 50, linkType: "dofollow" },
    ]));
    expect(csv).toContain("# Top anchor texts");
    expect(csv).toContain("click here");
  });
  it("renders toxic links section", () => {
    const csv = renderCsv(analyze([
      { url: "https://a.com", anchor: "x", sourceDomain: "src.com", da: 10, linkType: "dofollow" },
    ]));
    expect(csv).toContain("# Toxic links");
    expect(csv).toContain("https://a.com");
  });
});

describe("backlink-profile-analyzer history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, totalBacklinks: 100, uniqueDomains: 50, averageDa: 45, totalToxic: 5 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, totalBacklinks: 1, uniqueDomains: 1, averageDa: 50, totalToxic: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, totalBacklinks: 1, uniqueDomains: 1, averageDa: 50, totalToxic: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("backlink-profile-analyzer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("url,anchor\nhttps://a.com,x", "csv");
    expect(url).toContain("data=");
    expect(url).toContain("fmt=csv");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("data=url%2Canchor&fmt=csv");
    expect(p.data).toContain("url");
    expect(p.format).toBe("csv");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ data: "", format: "auto" });
  });
  it("omits empty data", () => {
    const url = buildShareUrl("", "auto");
    expect(url).not.toContain("data=");
  });
});
