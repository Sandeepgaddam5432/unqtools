import { describe, it, expect, beforeEach } from "vitest";
import {
  parseUrlList,
  parseInternalLinks,
  extractHref,
  extractAnchorText,
  normalizeUrl,
  isInternalLink,
  buildLinkIndex,
  countLinks,
  topLinkedPages,
  bottomLinkedPages,
  filterOrphans,
  buildReport,
  renderTextTable,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  HISTORY_KEY,
  HISTORY_MAX,
  TOP_N,
  BOTTOM_N,
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

describe("orphan-page-detector constants", () => {
  it("history key is namespaced", () => {
    expect(HISTORY_KEY).toContain("orphan-page-detector");
  });
  it("history max is 20", () => {
    expect(HISTORY_MAX).toBe(20);
  });
  it("exposes top/bottom N defaults", () => {
    expect(TOP_N).toBe(5);
    expect(BOTTOM_N).toBe(5);
  });
});

describe("orphan-page-detector parseUrlList", () => {
  it("splits lines and trims", () => {
    expect(parseUrlList("https://a.com\n  https://b.com  ")).toEqual([
      "https://a.com",
      "https://b.com",
    ]);
  });
  it("skips blank lines", () => {
    expect(parseUrlList("a\n\nb")).toEqual(["a", "b"]);
  });
  it("returns empty for empty input", () => {
    expect(parseUrlList("")).toEqual([]);
  });
});

describe("orphan-page-detector extractHref & extractAnchorText", () => {
  it("extracts href from double-quoted anchor", () => {
    expect(extractHref('<a href="https://a.com">x</a>')).toBe("https://a.com");
  });
  it("extracts href from single-quoted anchor", () => {
    expect(extractHref("<a href='https://a.com'>x</a>")).toBe("https://a.com");
  });
  it("extracts href with extra attributes", () => {
    expect(extractHref('<a class="link" href="https://a.com" target="_blank">x</a>')).toBe(
      "https://a.com",
    );
  });
  it("returns null for plain URL", () => {
    expect(extractHref("https://a.com")).toBeNull();
  });
  it("extracts plain anchor text", () => {
    expect(extractAnchorText('<a href="https://a.com">Click here</a>')).toBe("Click here");
  });
  it("strips inner tags from anchor text", () => {
    expect(extractAnchorText('<a href="https://a.com"><span>Read</span> more</a>')).toBe(
      "Read more",
    );
  });
  it("returns empty for plain URL", () => {
    expect(extractAnchorText("https://a.com")).toBe("");
  });
});

describe("orphan-page-detector normalizeUrl", () => {
  it("strips fragment", () => {
    expect(normalizeUrl("https://a.com/x#section")).toBe("https://a.com/x");
  });
  it("strips query", () => {
    expect(normalizeUrl("https://a.com/x?utm=foo")).toBe("https://a.com/x");
  });
  it("strips trailing slash", () => {
    expect(normalizeUrl("https://a.com/x/")).toBe("https://a.com/x");
  });
  it("lowercases host", () => {
    expect(normalizeUrl("https://EXAMPLE.com/Path")).toBe("https://example.com/Path");
  });
  it("preserves root slash", () => {
    expect(normalizeUrl("https://a.com/")).toBe("https://a.com/");
  });
  it("handles relative URL", () => {
    expect(normalizeUrl("/about/")).toBe("/about");
  });
  it("handles empty input", () => {
    expect(normalizeUrl("")).toBe("");
  });
});

describe("orphan-page-detector isInternalLink", () => {
  it("flags absolute path as internal", () => {
    expect(isInternalLink("/about")).toBe(true);
  });
  it("flags http(s) URL as internal", () => {
    expect(isInternalLink("https://a.com/x")).toBe(true);
  });
  it("flags protocol-relative URL as internal", () => {
    expect(isInternalLink("//a.com/x")).toBe(true);
  });
  it("rejects mailto", () => {
    expect(isInternalLink("mailto:foo@bar.com")).toBe(false);
  });
  it("rejects tel", () => {
    expect(isInternalLink("tel:+15551234")).toBe(false);
  });
  it("rejects javascript", () => {
    expect(isInternalLink("javascript:void(0)")).toBe(false);
  });
  it("rejects fragment-only", () => {
    expect(isInternalLink("#section")).toBe(false);
  });
});

describe("orphan-page-detector parseInternalLinks", () => {
  it("parses plain URLs", () => {
    const links = parseInternalLinks("https://a.com/x\nhttps://b.com/y");
    expect(links).toHaveLength(2);
    expect(links[0].href).toBe("https://a.com/x");
    expect(links[0].anchorText).toBe("");
  });
  it("parses HTML anchors with anchor text", () => {
    const links = parseInternalLinks('<a href="https://a.com/x">Click</a>');
    expect(links).toHaveLength(1);
    expect(links[0].href).toBe("https://a.com/x");
    expect(links[0].anchorText).toBe("Click");
  });
  it("normalizes hrefs", () => {
    const links = parseInternalLinks('<a href="https://A.com/x/?utm=foo">x</a>');
    expect(links[0].normalized).toBe("https://a.com/x");
  });
  it("flags internal vs external", () => {
    const links = parseInternalLinks("https://a.com/x\nmailto:foo@bar.com");
    expect(links[0].isInternal).toBe(true);
    expect(links[1].isInternal).toBe(false);
  });
  it("skips blank lines", () => {
    expect(parseInternalLinks("a\n\nb")).toHaveLength(2);
  });
  it("returns empty for empty input", () => {
    expect(parseInternalLinks("")).toEqual([]);
  });
});

describe("orphan-page-detector buildLinkIndex & countLinks", () => {
  it("groups links by normalized URL", () => {
    const links = parseInternalLinks(
      "https://a.com/x\nhttps://A.com/x/?utm=foo\nhttps://b.com/y",
    );
    const idx = buildLinkIndex(links);
    expect(idx.size).toBe(2);
    expect(idx.get("https://a.com/x")).toHaveLength(2);
  });
  it("counts link occurrences per URL", () => {
    const urls = ["https://a.com/x", "https://a.com/y"];
    const links = parseInternalLinks(
      "https://a.com/x\nhttps://a.com/x\n<a href='https://A.com/x/'>link</a>",
    );
    const entries = countLinks(urls, links);
    expect(entries[0].count).toBe(3);
    expect(entries[1].count).toBe(0);
  });
  it("marks orphans", () => {
    const urls = ["https://a.com/x", "https://a.com/orphan"];
    const links = parseInternalLinks("https://a.com/x");
    const entries = countLinks(urls, links);
    expect(entries[0].isOrphan).toBe(false);
    expect(entries[1].isOrphan).toBe(true);
  });
  it("collects anchor texts (deduped)", () => {
    const urls = ["https://a.com/x"];
    const links = parseInternalLinks(
      '<a href="https://a.com/x">Click</a>\n<a href="https://a.com/x">Click</a>\n<a href="https://a.com/x">Read</a>',
    );
    const entries = countLinks(urls, links);
    expect(entries[0].count).toBe(3);
    expect(entries[0].anchorTexts).toEqual(["Click", "Read"]);
  });
});

describe("orphan-page-detector topLinkedPages & bottomLinkedPages & filterOrphans", () => {
  const urls = [
    "https://a.com/x",
    "https://a.com/y",
    "https://a.com/z",
    "https://a.com/orphan1",
    "https://a.com/orphan2",
  ];
  const links = parseInternalLinks(
    "https://a.com/x\nhttps://a.com/x\nhttps://a.com/x\nhttps://a.com/y\nhttps://a.com/y\nhttps://a.com/z",
  );
  const entries = countLinks(urls, links);

  it("topLinkedPages returns most-linked first", () => {
    const top = topLinkedPages(entries, 3);
    expect(top[0].count).toBe(3);
    expect(top[1].count).toBe(2);
    expect(top.length).toBeLessThanOrEqual(3);
  });
  it("topLinkedPages excludes orphans", () => {
    const top = topLinkedPages(entries, 10);
    expect(top.every((e) => e.count > 0)).toBe(true);
  });
  it("bottomLinkedPages returns least-linked first", () => {
    const bottom = bottomLinkedPages(entries, 3);
    expect(bottom[0].count).toBe(0);
  });
  it("filterOrphans returns only count===0", () => {
    const orphans = filterOrphans(entries);
    expect(orphans).toHaveLength(2);
    expect(orphans.every((e) => e.isOrphan)).toBe(true);
  });
});

describe("orphan-page-detector buildReport", () => {
  it("computes summary stats", () => {
    const urls = ["https://a.com/x", "https://a.com/y", "https://a.com/orphan"];
    const links = parseInternalLinks("https://a.com/x\nhttps://a.com/x\nhttps://a.com/y");
    const report = buildReport(urls, links);
    expect(report.totalUrls).toBe(3);
    expect(report.totalLinks).toBe(3);
    expect(report.orphanCount).toBe(1);
    expect(report.linkedCount).toBe(2);
    expect(report.maxLinks).toBe(2);
    expect(report.avgLinksPerUrl).toBe(1);
  });
  it("handles empty input", () => {
    const report = buildReport([], []);
    expect(report.totalUrls).toBe(0);
    expect(report.orphanCount).toBe(0);
    expect(report.avgLinksPerUrl).toBe(0);
  });
  it("classifies internal vs external links", () => {
    const urls = ["https://a.com/x"];
    const links = parseInternalLinks("https://a.com/x\nmailto:foo@bar.com");
    const report = buildReport(urls, links);
    expect(report.totalLinks).toBe(2);
    expect(report.internalLinks).toBe(1);
  });
});

describe("orphan-page-detector renderTextTable & renderCsv", () => {
  const urls = ["https://a.com/x", "https://a.com/orphan"];
  const links = parseInternalLinks("https://a.com/x");
  const entries = countLinks(urls, links);

  it("renders text table with header", () => {
    const txt = renderTextTable(entries);
    expect(txt).toContain("URL");
    expect(txt).toContain("LINKS");
    expect(txt).toContain("STATUS");
    expect(txt).toContain("https://a.com/x");
    expect(txt).toContain("ORPHAN");
  });
  it("truncates long URLs", () => {
    const longUrl = "https://a.com/" + "x".repeat(120);
    const txt = renderTextTable([{ original: longUrl, normalized: longUrl, count: 0, isOrphan: true, anchorTexts: [] }]);
    expect(txt).toContain("…");
  });
  it("renders CSV with header", () => {
    const csv = renderCsv(entries);
    expect(csv).toContain("url,link_count,status,anchor_texts");
    expect(csv).toContain("https://a.com/x");
    expect(csv).toContain("orphan");
  });
  it("escapes commas in anchor_texts", () => {
    const entries2 = [
      { original: "x", normalized: "https://a.com/x", count: 1, isOrphan: false, anchorTexts: ["click, here"] },
    ];
    const csv = renderCsv(entries2);
    expect(csv).toContain('"click, here"');
  });
  it("returns placeholder for empty", () => {
    expect(renderTextTable([])).toBe("No URLs.");
  });
});

describe("orphan-page-detector history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, totalUrls: 5, totalLinks: 10, orphanCount: 2, linkedCount: 3 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, totalUrls: 1, totalLinks: 1, orphanCount: 0, linkedCount: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, totalUrls: 1, totalLinks: 1, orphanCount: 0, linkedCount: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("orphan-page-detector shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("https://a.com\nhttps://b.com", "https://a.com");
    expect(url).toContain("urls=");
    expect(url).toContain("links=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("urls=https%3A%2F%2Fa.com&links=https%3A%2F%2Fa.com");
    expect(p.urls).toBe("https://a.com");
    expect(p.links).toBe("https://a.com");
  });
  it("omits empty params", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("", "");
    expect(url).not.toContain("urls=");
    expect(url).not.toContain("links=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.urls).toBe("");
    expect(p.links).toBe("");
  });
});
