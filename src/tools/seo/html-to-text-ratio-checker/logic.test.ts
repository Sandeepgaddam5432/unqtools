import { describe, it, expect, beforeEach } from "vitest";
import {
  stripScripts,
  stripStyles,
  stripComments,
  stripTags,
  decodeEntities,
  normalizeWhitespace,
  countTags,
  countTag,
  extractText,
  countWords,
  computeRatio,
  generateRecommendations,
  computeScore,
  analyze,
  renderReport,
  buildBarData,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HtmlStats,
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

describe("html-to-text-ratio strip functions", () => {
  it("stripScripts removes script blocks", () => {
    const html = '<p>hi</p><script>alert(1)</script><p>bye</p>';
    expect(stripScripts(html)).toBe("<p>hi</p><p>bye</p>");
  });
  it("stripScripts removes multiple script blocks", () => {
    const html = '<script>a</script><div>x</div><script>b</script>';
    expect(stripScripts(html)).toBe("<div>x</div>");
  });
  it("stripStyles removes style blocks", () => {
    const html = '<style>.a{color:red}</style><p>hi</p>';
    expect(stripStyles(html)).toBe("<p>hi</p>");
  });
  it("stripComments removes HTML comments", () => {
    const html = '<!-- comment --><p>hi</p>';
    expect(stripComments(html)).toBe("<p>hi</p>");
  });
  it("stripTags removes all tags", () => {
    expect(stripTags("<p>hello <b>world</b></p>")).toBe("hello world");
  });
  it("stripTags handles empty", () => {
    expect(stripTags("")).toBe("");
  });
});

describe("html-to-text-ratio decodeEntities", () => {
  it("decodes &amp;", () => {
    expect(decodeEntities("a &amp; b")).toBe("a & b");
  });
  it("decodes &lt; and &gt;", () => {
    expect(decodeEntities("&lt;tag&gt;")).toBe("<tag>");
  });
  it("decodes &nbsp;", () => {
    expect(decodeEntities("hello&nbsp;world")).toBe("hello world");
  });
  it("decodes &quot; and &#39;", () => {
    expect(decodeEntities("&quot;hi&#39;s&quot;")).toBe('"hi\'s"');
  });
  it("decodes numeric entities", () => {
    expect(decodeEntities("&#65;")).toBe("A");
  });
  it("decodes hex entities", () => {
    expect(decodeEntities("&#x41;")).toBe("A");
  });
  it("decodes common entities", () => {
    expect(decodeEntities("&copy;&reg;&trade;")).toBe("©®™");
  });
});

describe("html-to-text-ratio normalizeWhitespace", () => {
  it("collapses multiple spaces", () => {
    expect(normalizeWhitespace("a    b")).toBe("a b");
  });
  it("collapses newlines", () => {
    expect(normalizeWhitespace("a\n\n\nb")).toBe("a b");
  });
  it("trims leading/trailing whitespace", () => {
    expect(normalizeWhitespace("   hi   ")).toBe("hi");
  });
  it("handles empty", () => {
    expect(normalizeWhitespace("")).toBe("");
  });
});

describe("html-to-text-ratio countTags", () => {
  it("counts opening and closing tags", () => {
    expect(countTags("<p>hi</p>")).toBe(2);
  });
  it("counts self-closing tags", () => {
    expect(countTags('<img src="x">')).toBe(1);
  });
  it("counts nested tags", () => {
    expect(countTags("<div><p>hi</p></div>")).toBe(4);
  });
  it("returns 0 for empty", () => {
    expect(countTags("")).toBe(0);
  });
  it("returns 0 for plain text", () => {
    expect(countTags("just text")).toBe(0);
  });
});

describe("html-to-text-ratio countTag", () => {
  it("counts specific tag case-insensitively", () => {
    expect(countTag("<P>a</P><p>b</p>", "p")).toBe(2);
  });
  it("counts img tags", () => {
    expect(countTag('<img src="a"><img src="b">', "img")).toBe(2);
  });
  it("returns 0 when tag not present", () => {
    expect(countTag("<p>hi</p>", "img")).toBe(0);
  });
});

describe("html-to-text-ratio extractText", () => {
  it("extracts visible text from simple HTML", () => {
    expect(extractText("<p>Hello world</p>")).toBe("Hello world");
  });
  it("strips scripts and styles from text", () => {
    const html = '<p>visible</p><script>alert(1)</script><style>.a{}</style>';
    expect(extractText(html)).toBe("visible");
  });
  it("strips comments", () => {
    expect(extractText("<p>hi</p><!-- comment -->")).toBe("hi");
  });
  it("decodes entities in extracted text", () => {
    expect(extractText("<p>café &amp; bar</p>")).toBe("café & bar");
  });
  it("preserves block boundaries as spaces", () => {
    const html = "<p>one</p><p>two</p>";
    expect(extractText(html)).toContain("one");
    expect(extractText(html)).toContain("two");
  });
  it("handles empty", () => {
    expect(extractText("")).toBe("");
  });
});

describe("html-to-text-ratio countWords", () => {
  it("counts words", () => {
    expect(countWords("one two three")).toBe(3);
  });
  it("returns 0 for empty", () => {
    expect(countWords("")).toBe(0);
  });
  it("returns 0 for whitespace only", () => {
    expect(countWords("   ")).toBe(0);
  });
});

describe("html-to-text-ratio computeRatio", () => {
  it("computes percentage", () => {
    expect(computeRatio(100, 25)).toBe(25);
  });
  it("returns 0 for zero html size", () => {
    expect(computeRatio(0, 0)).toBe(0);
  });
  it("returns 100 when text size equals html size", () => {
    expect(computeRatio(50, 50)).toBe(100);
  });
});

describe("html-to-text-ratio generateRecommendations", () => {
  const makeStats = (overrides: Partial<HtmlStats>): HtmlStats => ({
    htmlSize: 1000,
    textSize: 250,
    ratio: 25,
    wordCount: 500,
    charCount: 250,
    tagCount: 30,
    scriptCount: 2,
    styleCount: 1,
    imgCount: 5,
    linkCount: 10,
    headingCount: 5,
    paragraphCount: 8,
    listCount: 2,
    ...overrides,
  });

  it("gives good feedback for healthy ratio", () => {
    const recs = generateRecommendations(makeStats({ ratio: 30 }));
    expect(recs.some((r) => r.level === "good" && /ratio/i.test(r.message))).toBe(true);
  });
  it("warns on low ratio", () => {
    const recs = generateRecommendations(makeStats({ ratio: 12 }));
    expect(recs.some((r) => r.level === "warning")).toBe(true);
  });
  it("gives bad feedback on very low ratio", () => {
    const recs = generateRecommendations(makeStats({ ratio: 5 }));
    expect(recs.some((r) => r.level === "bad")).toBe(true);
  });
  it("warns on low word count", () => {
    const recs = generateRecommendations(makeStats({ wordCount: 50 }));
    expect(recs.some((r) => /word/i.test(r.message))).toBe(true);
  });
  it("warns on no headings with content", () => {
    const recs = generateRecommendations(makeStats({ headingCount: 0, wordCount: 200 }));
    expect(recs.some((r) => /heading/i.test(r.message))).toBe(true);
  });
  it("warns on too many scripts", () => {
    const recs = generateRecommendations(makeStats({ scriptCount: 8 }));
    expect(recs.some((r) => /script/i.test(r.message))).toBe(true);
  });
});

describe("html-to-text-ratio computeScore", () => {
  const makeStats = (overrides: Partial<HtmlStats>): HtmlStats => ({
    htmlSize: 1000,
    textSize: 250,
    ratio: 25,
    wordCount: 500,
    charCount: 250,
    tagCount: 30,
    scriptCount: 2,
    styleCount: 1,
    imgCount: 5,
    linkCount: 10,
    headingCount: 5,
    paragraphCount: 8,
    listCount: 2,
    ...overrides,
  });
  it("returns high score for healthy page", () => {
    const score = computeScore(makeStats({ ratio: 30, wordCount: 1500, headingCount: 5 }));
    expect(score).toBeGreaterThanOrEqual(85);
  });
  it("returns low score for thin content", () => {
    const score = computeScore(makeStats({ ratio: 5, wordCount: 50, headingCount: 0 }));
    expect(score).toBeLessThan(60);
  });
  it("score is between 0 and 100", () => {
    const score = computeScore(makeStats({ ratio: 80, wordCount: 5000, scriptCount: 30 }));
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("html-to-text-ratio analyze", () => {
  it("analyzes a full HTML document", () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head><title>Test</title></head>
      <body>
        <h1>Hello World</h1>
        <p>This is a paragraph with some content for testing.</p>
        <img src="x.jpg" alt="test">
        <a href="#">link</a>
      </body>
      </html>
    `;
    const r = analyze(html);
    expect(r.stats.htmlSize).toBeGreaterThan(0);
    expect(r.stats.textSize).toBeGreaterThan(0);
    expect(r.stats.ratio).toBeGreaterThan(0);
    expect(r.stats.wordCount).toBeGreaterThan(5);
    expect(r.stats.imgCount).toBe(1);
    expect(r.stats.headingCount).toBe(1);
    expect(r.stats.linkCount).toBe(1);
    expect(r.text).toContain("Hello World");
    expect(r.recommendations.length).toBeGreaterThan(0);
    expect(r.score).toBeGreaterThan(0);
  });
  it("returns zero stats for empty input", () => {
    const r = analyze("");
    expect(r.stats.htmlSize).toBe(0);
    expect(r.stats.textSize).toBe(0);
    expect(r.score).toBe(0);
    expect(r.text).toBe("");
  });
  it("handles HTML with scripts and styles correctly", () => {
    const html = '<p>visible text here</p><script>alert(1)</script><style>.x{}</style>';
    const r = analyze(html);
    expect(r.stats.scriptCount).toBe(1);
    expect(r.stats.styleCount).toBe(1);
    expect(r.text).toBe("visible text here");
  });
});

describe("html-to-text-ratio renderReport", () => {
  it("renders a markdown report with stats", () => {
    const r = analyze("<p>Hello world</p>");
    const report = renderReport(r);
    expect(report).toContain("# HTML to Text Ratio Report");
    expect(report).toContain("**HTML size:**");
    expect(report).toContain("**Ratio:**");
    expect(report).toContain("## Tag counts");
    expect(report).toContain("## Recommendations");
  });
});

describe("html-to-text-ratio buildBarData", () => {
  it("returns text and markup values", () => {
    const r = analyze("<p>Hello world</p>");
    const data = buildBarData(r);
    expect(data).toHaveLength(2);
    expect(data[0].label).toBe("Text");
    expect(data[1].label).toBe("Markup");
    expect(data[0].value + data[1].value).toBe(r.stats.htmlSize);
  });
});

describe("html-to-text-ratio history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, htmlSize: 1000, ratio: 25, wordCount: 500, score: 80 });
    saveHistory({ ts: 2, htmlSize: 2000, ratio: 30, wordCount: 600, score: 85 });
    expect(loadHistory()).toHaveLength(2);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, htmlSize: 100, ratio: 20, wordCount: 50, score: 60 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, htmlSize: 100, ratio: 20, wordCount: 50, score: 60 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("html-to-text-ratio shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("<p>hi</p>");
    expect(url).toContain("html=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const parsed = parseShareUrl("html=%3Cp%3Ehi%3C%2Fp%3E");
    expect(parsed.html).toBe("<p>hi</p>");
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
});
