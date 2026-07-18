import { describe, it, expect, beforeEach } from "vitest";
import {
  TOXIC_DA_THRESHOLD,
  SUSPICIOUS_DA_THRESHOLD,
  TOXIC_SPAM_THRESHOLD,
  SUSPICIOUS_SPAM_THRESHOLD,
  normalize,
  extractDomain,
  classifyAnchor,
  splitCsvRow,
  parseCsv,
  parseJson,
  parseAuto,
  toxicityReasons,
  computeQualityScore,
  scoreBacklink,
  scoreAll,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Backlink,
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

describe("backlink-quality-scorer constants", () => {
  it("has thresholds", () => {
    expect(TOXIC_DA_THRESHOLD).toBe(10);
    expect(SUSPICIOUS_DA_THRESHOLD).toBe(25);
    expect(TOXIC_SPAM_THRESHOLD).toBe(60);
    expect(SUSPICIOUS_SPAM_THRESHOLD).toBe(30);
  });
});

describe("backlink-quality-scorer normalize", () => {
  it("lowercases and collapses whitespace", () => {
    expect(normalize("  Best   SEO  ")).toBe("best seo");
  });
});

describe("backlink-quality-scorer extractDomain", () => {
  it("strips protocol", () => {
    expect(extractDomain("https://www.example.com/path")).toBe("example.com");
  });
  it("handles bare domain", () => {
    expect(extractDomain("example.com")).toBe("example.com");
  });
});

describe("backlink-quality-scorer classifyAnchor", () => {
  it("classifies generic anchors", () => {
    expect(classifyAnchor("click here")).toBe("generic");
    expect(classifyAnchor("read more")).toBe("generic");
  });
  it("classifies branded anchors when target provided", () => {
    expect(classifyAnchor("example", "https://example.com")).toBe("branded");
    expect(classifyAnchor("example.com", "https://example.com")).toBe("branded");
  });
  it("classifies exact-match (1-2 words, no brand)", () => {
    expect(classifyAnchor("seo tools")).toBe("exact");
  });
  it("classifies commercial exact", () => {
    expect(classifyAnchor("buy seo software")).toBe("exact");
  });
  it("classifies partial (3+ words, no money)", () => {
    expect(classifyAnchor("best seo tools for small business")).toBe("partial");
  });
  it("returns generic for empty", () => {
    expect(classifyAnchor("")).toBe("generic");
  });
});

describe("backlink-quality-scorer splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
});

describe("backlink-quality-scorer parseCsv", () => {
  it("parses headerless rows", () => {
    const input = "https://example.com/p1,click here,source.com,80,5,dofollow";
    const { backlinks, errors } = parseCsv(input);
    expect(backlinks).toHaveLength(1);
    expect(errors).toHaveLength(0);
    expect(backlinks[0].da).toBe(80);
  });
  it("parses with header", () => {
    const input = "url,anchor,source_domain,da,spam_score,link_type\nhttps://example.com/p1,click here,source.com,80,5,dofollow";
    const { backlinks } = parseCsv(input);
    expect(backlinks).toHaveLength(1);
    expect(backlinks[0].sourceDomain).toBe("source.com");
  });
  it("handles empty input", () => {
    expect(parseCsv("")).toEqual({ backlinks: [], errors: [] });
  });
  it("collects errors for missing urls", () => {
    const input = "url,anchor\n,click here";
    const { backlinks, errors } = parseCsv(input);
    expect(backlinks).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });
});

describe("backlink-quality-scorer parseJson", () => {
  it("parses array of objects", () => {
    const input = '[{"url":"https://example.com","anchor":"click here","source_domain":"src.com","da":80,"spam_score":5,"link_type":"dofollow"}]';
    const { backlinks, errors } = parseJson(input);
    expect(backlinks).toHaveLength(1);
    expect(errors).toHaveLength(0);
  });
  it("errors on non-array", () => {
    const { errors } = parseJson('{"foo":1}');
    expect(errors.length).toBeGreaterThan(0);
  });
  it("errors on invalid JSON", () => {
    const { errors } = parseJson("not json");
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("backlink-quality-scorer parseAuto", () => {
  it("detects JSON", () => {
    const { backlinks } = parseAuto('[{"url":"https://example.com","da":50}]');
    expect(backlinks).toHaveLength(1);
  });
  it("detects CSV", () => {
    const { backlinks } = parseAuto("https://example.com,click here,src.com,50,5,dofollow");
    expect(backlinks).toHaveLength(1);
  });
  it("handles empty", () => {
    expect(parseAuto("")).toEqual({ backlinks: [], errors: [] });
  });
});

describe("backlink-quality-scorer toxicityReasons", () => {
  it("flags high spam score", () => {
    const b: Backlink = { url: "https://example.com", anchor: "seo", sourceDomain: "src.com", da: 50, spamScore: 70, linkType: "dofollow" };
    const reasons = toxicityReasons(b, "exact");
    expect(reasons.some((r) => r.includes("High spam score"))).toBe(true);
  });
  it("flags very low DA", () => {
    const b: Backlink = { url: "https://example.com", anchor: "seo", sourceDomain: "src.com", da: 5, spamScore: 0, linkType: "dofollow" };
    const reasons = toxicityReasons(b, "exact");
    expect(reasons.some((r) => r.includes("Very low DA"))).toBe(true);
  });
  it("flags exact match anchor", () => {
    const b: Backlink = { url: "https://example.com", anchor: "buy seo", sourceDomain: "src.com", da: 50, spamScore: 0, linkType: "dofollow" };
    const reasons = toxicityReasons(b, "exact");
    expect(reasons.some((r) => r.includes("Exact-match"))).toBe(true);
  });
  it("returns empty for clean links", () => {
    const b: Backlink = { url: "https://example.com", anchor: "example", sourceDomain: "src.com", da: 80, spamScore: 0, linkType: "dofollow" };
    const reasons = toxicityReasons(b, "branded");
    expect(reasons).toHaveLength(0);
  });
});

describe("backlink-quality-scorer computeQualityScore", () => {
  it("scores high for high-DA branded dofollow", () => {
    const b: Backlink = { url: "https://example.com", anchor: "example", sourceDomain: "src.com", da: 90, spamScore: 0, linkType: "dofollow" };
    const score = computeQualityScore(b, "branded");
    expect(score).toBeGreaterThan(65);
  });
  it("scores low for spammy low-DA exact match", () => {
    const b: Backlink = { url: "https://example.com", anchor: "buy seo", sourceDomain: "src.com", da: 5, spamScore: 80, linkType: "dofollow" };
    const score = computeQualityScore(b, "exact");
    expect(score).toBeLessThan(30);
  });
  it("is within 0-100", () => {
    const b: Backlink = { url: "https://example.com", anchor: "x", sourceDomain: "src.com", da: 50, spamScore: 50, linkType: "dofollow" };
    const score = computeQualityScore(b, "partial");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("backlink-quality-scorer scoreBacklink", () => {
  it("flags toxic when spam ≥ 60", () => {
    const b: Backlink = { url: "https://example.com", anchor: "click here", sourceDomain: "src.com", da: 50, spamScore: 70, linkType: "dofollow" };
    const s = scoreBacklink(b);
    expect(s.isToxic).toBe(true);
    expect(s.category).toBe("toxic");
  });
  it("flags toxic when DA < 10", () => {
    const b: Backlink = { url: "https://example.com", anchor: "click here", sourceDomain: "src.com", da: 5, spamScore: 0, linkType: "dofollow" };
    const s = scoreBacklink(b);
    expect(s.isToxic).toBe(true);
  });
  it("flags suspicious for elevated spam + exact anchor", () => {
    const b: Backlink = { url: "https://example.com", anchor: "seo tools", sourceDomain: "src.com", da: 50, spamScore: 35, linkType: "dofollow" };
    const s = scoreBacklink(b);
    expect(s.category).toBe("suspicious");
  });
  it("marks good for clean branded", () => {
    const b: Backlink = { url: "https://example.com", anchor: "example", sourceDomain: "src.com", da: 80, spamScore: 0, linkType: "dofollow" };
    const s = scoreBacklink(b, "https://example.com");
    expect(s.category).toBe("good");
    expect(s.isToxic).toBe(false);
  });
  it("includes recommendation", () => {
    const b: Backlink = { url: "https://example.com", anchor: "click here", sourceDomain: "src.com", da: 50, spamScore: 70, linkType: "dofollow" };
    const s = scoreBacklink(b);
    expect(s.recommendation).toBeTruthy();
  });
});

describe("backlink-quality-scorer scoreAll", () => {
  const links: Backlink[] = [
    { url: "https://example.com/p1", anchor: "example", sourceDomain: "src.com", da: 80, spamScore: 0, linkType: "dofollow" },
    { url: "https://example.com/p2", anchor: "buy seo", sourceDomain: "spam.xyz", da: 5, spamScore: 80, linkType: "dofollow" },
    { url: "https://example.com/p3", anchor: "click here", sourceDomain: "src.com", da: 40, spamScore: 30, linkType: "nofollow" },
  ];
  const result = scoreAll(links, "https://example.com");
  it("returns all scored", () => {
    expect(result.scored).toHaveLength(3);
    expect(result.total).toBe(3);
  });
  it("computes byCategory counts", () => {
    expect(result.byCategory.good + result.byCategory.suspicious + result.byCategory.toxic).toBe(3);
    expect(result.byCategory.toxic).toBeGreaterThanOrEqual(1);
  });
  it("computes average score", () => {
    expect(result.averageScore).toBeGreaterThan(0);
    expect(result.averageScore).toBeLessThanOrEqual(100);
  });
  it("computes topToxic list", () => {
    expect(result.topToxic.length).toBeLessThanOrEqual(20);
    expect(result.topToxic.length).toBeGreaterThanOrEqual(1);
  });
  it("computes DA distribution", () => {
    expect(result.daDistribution.low + result.daDistribution.medium + result.daDistribution.high).toBe(3);
  });
  it("computes spam distribution", () => {
    expect(result.spamDistribution.clean + result.spamDistribution.low + result.spamDistribution.medium + result.spamDistribution.high).toBe(3);
  });
  it("computes anchor type counts", () => {
    expect(Object.values(result.anchorTypeCounts).reduce((a, b) => a + b, 0)).toBe(3);
  });
  it("returns empty for empty input", () => {
    expect(scoreAll([]).total).toBe(0);
  });
});

describe("backlink-quality-scorer renderCsv", () => {
  it("renders summary header", () => {
    const csv = renderCsv(scoreAll([]));
    expect(csv).toContain("# Summary");
    expect(csv).toContain("total,0");
  });
  it("renders scored rows", () => {
    const links: Backlink[] = [
      { url: "https://example.com", anchor: "click here", sourceDomain: "src.com", da: 80, spamScore: 0, linkType: "dofollow" },
    ];
    const csv = renderCsv(scoreAll(links));
    expect(csv).toContain("# Scored backlinks");
    expect(csv).toContain("https://example.com");
  });
});

describe("backlink-quality-scorer history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, total: 5, toxic: 1, suspicious: 2, good: 2, averageScore: 65 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, total: 1, toxic: 0, suspicious: 0, good: 1, averageScore: 80 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, total: 1, toxic: 0, suspicious: 0, good: 1, averageScore: 80 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("backlink-quality-scorer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("data", "example.com");
    expect(url).toContain("data=data");
    expect(url).toContain("target=example.com");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("data=foo&target=bar.com");
    expect(p.data).toBe("foo");
    expect(p.target).toBe("bar.com");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ data: "", target: "" });
  });
});
