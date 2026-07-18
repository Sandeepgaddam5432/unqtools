import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeUrl,
  extractDomain,
  splitCsvRow,
  parseCsv,
  parseJson,
  parseAuto,
  diff,
  topAnchors,
  renderCsv,
  renderReport,
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

describe("lost-new-backlink-tracker normalizeUrl", () => {
  it("lowercases", () => {
    expect(normalizeUrl("HTTPS://Example.com/Path")).toBe("example.com/path");
  });
  it("strips protocol and www", () => {
    expect(normalizeUrl("https://www.example.com/page")).toBe("example.com/page");
  });
  it("strips trailing slash", () => {
    expect(normalizeUrl("https://example.com/page/")).toBe("example.com/page");
  });
  it("handles empty", () => {
    expect(normalizeUrl("")).toBe("");
  });
});

describe("lost-new-backlink-tracker extractDomain", () => {
  it("strips protocol and path", () => {
    expect(extractDomain("https://www.example.com/path")).toBe("example.com");
  });
  it("handles bare domain", () => {
    expect(extractDomain("example.com")).toBe("example.com");
  });
});

describe("lost-new-backlink-tracker splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
});

describe("lost-new-backlink-tracker parseCsv", () => {
  it("parses headerless", () => {
    const { backlinks, errors } = parseCsv("https://example.com/p1,click here,src.com,80,dofollow");
    expect(backlinks).toHaveLength(1);
    expect(errors).toHaveLength(0);
    expect(backlinks[0].da).toBe(80);
  });
  it("parses with header", () => {
    const input = "url,anchor,source_domain,da,link_type\nhttps://example.com/p1,click here,src.com,80,dofollow";
    const { backlinks } = parseCsv(input);
    expect(backlinks).toHaveLength(1);
    expect(backlinks[0].sourceDomain).toBe("src.com");
  });
  it("handles empty input", () => {
    expect(parseCsv("")).toEqual({ backlinks: [], errors: [] });
  });
  it("collects errors for missing url", () => {
    const input = "url,anchor\n,click here";
    const { backlinks, errors } = parseCsv(input);
    expect(backlinks).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });
});

describe("lost-new-backlink-tracker parseJson", () => {
  it("parses array", () => {
    const input = '[{"url":"https://example.com","anchor":"x","source_domain":"src.com","da":80,"link_type":"dofollow"}]';
    const { backlinks, errors } = parseJson(input);
    expect(backlinks).toHaveLength(1);
    expect(errors).toHaveLength(0);
  });
  it("errors on non-array", () => {
    expect(parseJson('{"foo":1}').errors.length).toBeGreaterThan(0);
  });
  it("errors on invalid JSON", () => {
    expect(parseJson("not json").errors.length).toBeGreaterThan(0);
  });
});

describe("lost-new-backlink-tracker parseAuto", () => {
  it("detects JSON", () => {
    const { backlinks } = parseAuto('[{"url":"https://example.com","da":50}]');
    expect(backlinks).toHaveLength(1);
  });
  it("detects CSV", () => {
    const { backlinks } = parseAuto("https://example.com,x,src.com,50,dofollow");
    expect(backlinks).toHaveLength(1);
  });
});

describe("lost-new-backlink-tracker diff", () => {
  const previous: Backlink[] = [
    { url: "https://example.com/p1", anchor: "a", sourceDomain: "src1.com", da: 80, linkType: "dofollow" },
    { url: "https://example.com/p2", anchor: "b", sourceDomain: "src2.com", da: 50, linkType: "dofollow" },
    { url: "https://example.com/p3", anchor: "c", sourceDomain: "src3.com", da: 30, linkType: "nofollow" },
  ];
  const current: Backlink[] = [
    { url: "https://example.com/p1", anchor: "a", sourceDomain: "src1.com", da: 80, linkType: "dofollow" }, // kept
    { url: "https://example.com/p3", anchor: "c", sourceDomain: "src3.com", da: 30, linkType: "nofollow" }, // kept
    { url: "https://example.com/p4", anchor: "d", sourceDomain: "src4.com", da: 90, linkType: "dofollow" }, // new
    { url: "https://example.com/p5", anchor: "e", sourceDomain: "src5.com", da: 60, linkType: "dofollow" }, // new
  ];
  const result = diff(previous, current);
  it("identifies new backlinks", () => {
    expect(result.newLinks).toHaveLength(2);
    expect(result.newLinks.some((b) => b.url.endsWith("/p4"))).toBe(true);
  });
  it("identifies lost backlinks", () => {
    expect(result.lostLinks).toHaveLength(1);
    expect(result.lostLinks[0].url.endsWith("/p2")).toBe(true);
  });
  it("identifies kept backlinks", () => {
    expect(result.keptLinks).toHaveLength(2);
  });
  it("computes stats counts", () => {
    expect(result.stats.previousTotal).toBe(3);
    expect(result.stats.currentTotal).toBe(4);
    expect(result.stats.newCount).toBe(2);
    expect(result.stats.lostCount).toBe(1);
    expect(result.stats.keptCount).toBe(2);
  });
  it("computes percentages", () => {
    expect(result.stats.newPercentage).toBeCloseTo(66.7, 0);
    expect(result.stats.lostPercentage).toBeCloseTo(33.3, 0);
  });
  it("computes net change", () => {
    expect(result.stats.netChange).toBe(1);
  });
  it("computes top new by DA", () => {
    expect(result.topNewByDa[0].da).toBe(90);
  });
  it("computes top lost by DA", () => {
    expect(result.topLostByDa[0].da).toBe(50);
  });
  it("normalizes url variations (trailing slash, case)", () => {
    const prev: Backlink[] = [{ url: "https://Example.com/p1/", anchor: "a", sourceDomain: "x", da: 1, linkType: "dofollow" }];
    const curr: Backlink[] = [{ url: "https://example.com/p1", anchor: "a", sourceDomain: "x", da: 1, linkType: "dofollow" }];
    expect(diff(prev, curr).keptLinks).toHaveLength(1);
  });
  it("returns empty for empty inputs", () => {
    const r = diff([], []);
    expect(r.newLinks).toHaveLength(0);
    expect(r.lostLinks).toHaveLength(0);
    expect(r.stats.previousTotal).toBe(0);
  });
  it("handles all new (empty previous)", () => {
    const r = diff([], current);
    expect(r.newLinks).toHaveLength(4);
    expect(r.lostLinks).toHaveLength(0);
  });
  it("handles all lost (empty current)", () => {
    const r = diff(previous, []);
    expect(r.lostLinks).toHaveLength(3);
    expect(r.newLinks).toHaveLength(0);
  });
});

describe("lost-new-backlink-tracker topAnchors", () => {
  it("counts anchors and sorts by frequency", () => {
    const links: Backlink[] = [
      { url: "u1", anchor: "a", sourceDomain: "x", da: 1, linkType: "dofollow" },
      { url: "u2", anchor: "b", sourceDomain: "x", da: 1, linkType: "dofollow" },
      { url: "u3", anchor: "a", sourceDomain: "x", da: 1, linkType: "dofollow" },
    ];
    const out = topAnchors(links);
    expect(out[0].anchor).toBe("a");
    expect(out[0].count).toBe(2);
  });
  it("handles empty anchors", () => {
    const links: Backlink[] = [
      { url: "u1", anchor: "", sourceDomain: "x", da: 1, linkType: "dofollow" },
    ];
    expect(topAnchors(links)[0].anchor).toBe("(empty)");
  });
  it("limits to provided limit", () => {
    const links: Backlink[] = Array.from({ length: 15 }, (_, i) => ({
      url: `u${i}`, anchor: `a${i}`, sourceDomain: "x", da: 1, linkType: "dofollow" as const,
    }));
    expect(topAnchors(links, 5)).toHaveLength(5);
  });
});

describe("lost-new-backlink-tracker renderCsv", () => {
  it("renders summary header", () => {
    const csv = renderCsv(diff([], []));
    expect(csv).toContain("# Summary");
    expect(csv).toContain("previous_total,0");
  });
  it("renders new backlinks section", () => {
    const csv = renderCsv(diff([], [{ url: "https://x.com", anchor: "a", sourceDomain: "x.com", da: 50, linkType: "dofollow" }]));
    expect(csv).toContain("# New backlinks");
    expect(csv).toContain("https://x.com");
  });
  it("renders lost backlinks section", () => {
    const csv = renderCsv(diff([{ url: "https://x.com", anchor: "a", sourceDomain: "x.com", da: 50, linkType: "dofollow" }], []));
    expect(csv).toContain("# Lost backlinks");
    expect(csv).toContain("https://x.com");
  });
});

describe("lost-new-backlink-tracker renderReport", () => {
  it("renders report header", () => {
    const report = renderReport(diff([], []));
    expect(report).toContain("Lost & New Backlink Tracker Report");
  });
  it("includes stats", () => {
    const report = renderReport(diff([], [{ url: "https://x.com", anchor: "a", sourceDomain: "x.com", da: 50, linkType: "dofollow" }]));
    expect(report).toContain("New: 1");
  });
});

describe("lost-new-backlink-tracker history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, previousTotal: 5, currentTotal: 7, newCount: 3, lostCount: 1, netChange: 2 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, previousTotal: 1, currentTotal: 1, newCount: 0, lostCount: 0, netChange: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, previousTotal: 1, currentTotal: 1, newCount: 0, lostCount: 0, netChange: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("lost-new-backlink-tracker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("prev", "curr");
    expect(url).toContain("prev=prev");
    expect(url).toContain("curr=curr");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("prev=hello&curr=world");
    expect(p.prev).toBe("hello");
    expect(p.curr).toBe("world");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ prev: "", curr: "" });
  });
});
