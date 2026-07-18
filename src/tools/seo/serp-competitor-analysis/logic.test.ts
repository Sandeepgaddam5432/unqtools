import { describe, it, expect, beforeEach } from "vitest";
import {
  stripTags,
  extractHeadings,
  extractTitle,
  extractMetaDescription,
  countWords,
  countKeyword,
  countLinks,
  countImages,
  analyzeCompetitor,
  normalizeHeading,
  detectContentGaps,
  findSharedHeadings,
  analyze,
  renderMarkdown,
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

describe("serp-competitor-analysis stripTags", () => {
  it("returns empty for empty", () => {
    expect(stripTags("")).toBe("");
  });
  it("removes tags", () => {
    expect(stripTags("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });
  it("removes scripts and styles", () => {
    expect(stripTags("<script>alert(1)</script>Hello<style>x{}</style>")).toBe("Hello");
  });
  it("decodes entities", () => {
    expect(stripTags("Hello&nbsp;World&amp;Test")).toBe("Hello World&Test");
  });
});

describe("serp-competitor-analysis extractHeadings", () => {
  it("returns empty for empty", () => {
    expect(extractHeadings("")).toEqual([]);
  });
  it("extracts H1-H6", () => {
    const html = "<h1>Title</h1><h2>Sub</h2><h3>Sub sub</h3>";
    const out = extractHeadings(html);
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ level: 1, text: "Title" });
    expect(out[1]).toEqual({ level: 2, text: "Sub" });
  });
  it("strips tags inside heading", () => {
    const out = extractHeadings("<h2>My <b>Bold</b> Heading</h2>");
    expect(out[0].text).toBe("My Bold Heading");
  });
  it("ignores empty headings", () => {
    const out = extractHeadings("<h2></h2><h2>Real</h2>");
    expect(out).toHaveLength(1);
  });
});

describe("serp-competitor-analysis extractTitle", () => {
  it("returns empty for empty", () => {
    expect(extractTitle("")).toBe("");
  });
  it("extracts title text", () => {
    expect(extractTitle("<title>My Page</title>")).toBe("My Page");
  });
  it("returns empty when no title", () => {
    expect(extractTitle("<p>no title here</p>")).toBe("");
  });
});

describe("serp-competitor-analysis extractMetaDescription", () => {
  it("returns empty for empty", () => {
    expect(extractMetaDescription("")).toBe("");
  });
  it("extracts name-then-content form", () => {
    const html = `<meta name="description" content="My description">`;
    expect(extractMetaDescription(html)).toBe("My description");
  });
  it("extracts content-then-name form", () => {
    const html = `<meta content="Alt form" name="description">`;
    expect(extractMetaDescription(html)).toBe("Alt form");
  });
  it("returns empty when missing", () => {
    expect(extractMetaDescription("<p>no meta</p>")).toBe("");
  });
});

describe("serp-competitor-analysis countWords", () => {
  it("returns 0 for empty", () => {
    expect(countWords("")).toBe(0);
  });
  it("counts words", () => {
    expect(countWords("hello world foo bar")).toBe(4);
  });
  it("ignores punctuation-only", () => {
    expect(countWords("... !!! hello")).toBe(1);
  });
});

describe("serp-competitor-analysis countKeyword", () => {
  it("returns 0 for empty text", () => {
    expect(countKeyword("", "seo")).toBe(0);
  });
  it("returns 0 for empty keyword", () => {
    expect(countKeyword("seo seo", "")).toBe(0);
  });
  it("counts case-insensitive whole-word matches", () => {
    expect(countKeyword("SEO is great. seo rocks. Seo!", "seo")).toBe(3);
  });
  it("does not count substrings", () => {
    expect(countKeyword("seasonal seoul", "seo")).toBe(0);
  });
  it("handles multi-word keyword", () => {
    expect(countKeyword("best seo tools and seo tools today", "seo tools")).toBe(2);
  });
});

describe("serp-competitor-analysis countLinks", () => {
  it("returns 0 for empty", () => {
    expect(countLinks("")).toBe(0);
  });
  it("counts <a> tags", () => {
    expect(countLinks('<a href="1">x</a><a href="2">y</a>')).toBe(2);
  });
});

describe("serp-competitor-analysis countImages", () => {
  it("returns 0 for empty", () => {
    expect(countImages("")).toBe(0);
  });
  it("counts <img> tags", () => {
    expect(countImages('<img src="a"><img src="b">')).toBe(2);
  });
});

describe("serp-competitor-analysis analyzeCompetitor", () => {
  it("returns full analysis object", () => {
    const html = `<title>Test</title><meta name="description" content="Desc"><h1>Title</h1><p>SEO is great. SEO rocks.</p><a href="#">link</a><img src="x.jpg">`;
    const r = analyzeCompetitor("Primary", html, "SEO");
    expect(r.label).toBe("Primary");
    expect(r.title).toBe("Test");
    expect(r.metaDescription).toBe("Desc");
    expect(r.wordCount).toBeGreaterThan(0);
    expect(r.keywordCount).toBe(2);
    expect(r.headings).toHaveLength(1);
    expect(r.linkCount).toBe(1);
    expect(r.imageCount).toBe(1);
  });
  it("computes keyword density", () => {
    const r = analyzeCompetitor("X", "<p>seo seo seo tools</p>", "seo");
    expect(r.keywordDensity).toBeCloseTo(75, 1);
  });
  it("returns 0 density for empty content", () => {
    const r = analyzeCompetitor("X", "", "seo");
    expect(r.keywordDensity).toBe(0);
    expect(r.wordCount).toBe(0);
  });
});

describe("serp-competitor-analysis normalizeHeading", () => {
  it("lowercases and collapses", () => {
    expect(normalizeHeading("  Hello   World  ")).toBe("hello world");
  });
});

describe("serp-competitor-analysis detectContentGaps", () => {
  it("finds headings in competitors missing from primary", () => {
    const primary = analyzeCompetitor("Primary", "<h2>Intro</h2>", "seo");
    const c1 = analyzeCompetitor("C1", "<h2>Intro</h2><h2>Pricing</h2>", "seo");
    const c2 = analyzeCompetitor("C2", "<h2>Intro</h2><h2>Pricing</h2><h2>FAQ</h2>", "seo");
    const gaps = detectContentGaps(primary, [c1, c2]);
    const gapTexts = gaps.map((g) => g.text);
    expect(gapTexts).toContain("pricing");
    expect(gapTexts).toContain("faq");
  });
  it("does not flag headings present in primary", () => {
    const primary = analyzeCompetitor("Primary", "<h2>Intro</h2><h2>Pricing</h2>", "seo");
    const c1 = analyzeCompetitor("C1", "<h2>Intro</h2><h2>Pricing</h2>", "seo");
    const gaps = detectContentGaps(primary, [c1]);
    expect(gaps.find((g) => g.text === "pricing")).toBeUndefined();
  });
  it("returns empty when no competitors", () => {
    const primary = analyzeCompetitor("Primary", "<h2>Intro</h2>", "seo");
    expect(detectContentGaps(primary, [])).toEqual([]);
  });
  it("competitorsWithIt lists who has each gap", () => {
    const primary = analyzeCompetitor("Primary", "<h2>Intro</h2>", "seo");
    const c1 = analyzeCompetitor("C1", "<h2>FAQ</h2>", "seo");
    const c2 = analyzeCompetitor("C2", "<h2>FAQ</h2>", "seo");
    const gaps = detectContentGaps(primary, [c1, c2]);
    const faq = gaps.find((g) => g.text === "faq");
    expect(faq?.competitorsWithIt).toEqual(["C1", "C2"]);
  });
});

describe("serp-competitor-analysis findSharedHeadings", () => {
  it("finds headings in all sources", () => {
    const a = analyzeCompetitor("A", "<h2>Intro</h2><h2>Body</h2>", "x");
    const b = analyzeCompetitor("B", "<h2>Intro</h2><h2>FAQ</h2>", "x");
    const shared = findSharedHeadings([a, b]);
    expect(shared).toContain("intro");
    expect(shared).not.toContain("faq");
  });
  it("returns empty for empty input", () => {
    expect(findSharedHeadings([])).toEqual([]);
  });
});

describe("serp-competitor-analysis analyze", () => {
  it("returns full result object", () => {
    const r = analyze("seo", [
      { label: "Primary", html: "<h2>Intro</h2><p>seo content</p>" },
      { label: "Competitor 1", html: "<h2>Intro</h2><h2>Pricing</h2><p>seo content</p>" },
    ]);
    expect(r.targetKeyword).toBe("seo");
    expect(r.competitors).toHaveLength(2);
    expect(Array.isArray(r.contentGaps)).toBe(true);
    expect(Array.isArray(r.sharedHeadings)).toBe(true);
    expect(typeof r.averageWordCount).toBe("number");
    expect(Array.isArray(r.statsTable)).toBe(true);
  });
  it("skips empty HTML inputs", () => {
    const r = analyze("seo", [
      { label: "Primary", html: "" },
      { label: "C1", html: "<p>content</p>" },
    ]);
    expect(r.competitors).toHaveLength(1);
    expect(r.competitors[0].label).toBe("C1");
  });
  it("computes averageWordCount", () => {
    const r = analyze("seo", [
      { label: "A", html: "<p>one two three four five</p>" }, // 5 words
      { label: "B", html: "<p>one two three</p>" }, // 3 words
    ]);
    expect(r.averageWordCount).toBe(4);
  });
  it("returns empty result when no inputs", () => {
    const r = analyze("seo", []);
    expect(r.competitors).toEqual([]);
    expect(r.averageWordCount).toBe(0);
  });
});

describe("serp-competitor-analysis renderMarkdown", () => {
  it("renders report header", () => {
    const r = analyze("seo", [{ label: "Primary", html: "<p>seo content</p>" }]);
    const md = renderMarkdown(r);
    expect(md).toContain("# SERP Competitor Analysis Report");
    expect(md).toContain("**Target keyword:** seo");
  });
  it("renders stats table", () => {
    const r = analyze("seo", [{ label: "Primary", html: "<p>seo content</p>" }]);
    const md = renderMarkdown(r);
    expect(md).toContain("| Source | Words |");
  });
  it("renders content gaps section when present", () => {
    const r = analyze("seo", [
      { label: "Primary", html: "<h2>Intro</h2>" },
      { label: "C1", html: "<h2>FAQ</h2>" },
    ]);
    const md = renderMarkdown(r);
    expect(md).toContain("## Content gaps");
    expect(md).toContain("faq");
  });
  it("renders per-competitor headings", () => {
    const r = analyze("seo", [{ label: "Primary", html: "<h1>My Title</h1>" }]);
    const md = renderMarkdown(r);
    expect(md).toContain("### Primary");
    expect(md).toContain("My Title");
  });
});

describe("serp-competitor-analysis history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, keyword: "seo", competitorCount: 3, averageWordCount: 500, gapCount: 5 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, keyword: "x", competitorCount: 1, averageWordCount: 1, gapCount: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, keyword: "x", competitorCount: 1, averageWordCount: 1, gapCount: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("serp-competitor-analysis shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      keyword: "seo",
      competitors: [{ label: "Primary", html: "<p>seo</p>" }],
    });
    expect(url).toContain("kw=seo");
    expect(url).toContain("h1=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("kw=seo&h1=%3Cp%3Eseo%3C%2Fp%3E&h2=%3Cp%3Ecomp%3C%2Fp%3E");
    expect(p.keyword).toBe("seo");
    expect(p.competitors).toHaveLength(2);
    expect(p.competitors[0].html).toBe("<p>seo</p>");
    expect(p.competitors[1].label).toBe("Competitor 1");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ keyword: "", competitors: [] });
  });
  it("omits empty keyword", () => {
    const url = buildShareUrl({ keyword: "", competitors: [] });
    expect(url).not.toContain("kw=");
  });
});
