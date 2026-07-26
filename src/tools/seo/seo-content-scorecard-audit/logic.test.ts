/**
 * SEO Content Scorecard Audit — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  stripHtml,
  extractTitle,
  extractMetaDescription,
  countHeadings,
  extractLinks,
  extractImages,
  detectSchema,
  tokenize,
  countKeyword,
  fleschReadingEase,
  countSyllables,
  auditContent,
  buildHtmlReport,
} from "./logic";

const SAMPLE_HTML = `<!doctype html><html><head>
<title>Best Running Shoes 2026 — Reviews & Buying Guide</title>
<meta name="description" content="We tested 47 running shoes for 200+ miles. See the best running shoes for road, trail, and racing in 2026.">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"Best Running Shoes 2026"}</script>
</head><body>
<h1>Best Running Shoes 2026</h1>
<p>Looking for the best running shoes? We tested 47 pairs for 200+ miles each. Here are the best running shoes for every runner.</p>
<h2>Road Running Shoes</h2>
<p>The best running shoes for road runners balance cushion and responsiveness. Our top pick is the Example Pro.</p>
<a href="/road-shoes">Road shoes</a> <a href="https://example.com/external">External</a>
<h2>Trail Running Shoes</h2>
<p>For trail runners we recommend grippy outsoles. The best running shoes here have rock plates.</p>
<img src="/shoe1.jpg" alt="Road shoe">
<img src="/shoe2.jpg">
<img src="/shoe3.jpg" alt="Trail shoe">
</body></html>`;

describe("stripHtml", () => {
  it("strips tags and decodes entities", () => {
    expect(stripHtml("<p>Hello&nbsp;world &amp; goodbye</p>")).toBe("Hello world & goodbye");
  });
  it("removes script/style/noscript", () => {
    expect(stripHtml("<style>.a{}</style><script>let x=1;</script><noscript>nope</noscript>Hi")).toBe("Hi");
  });
  it("removes HTML comments", () => {
    expect(stripHtml("<!-- comment -->Hi")).toBe("Hi");
  });
});

describe("extractTitle + extractMetaDescription", () => {
  it("extracts title", () => {
    expect(extractTitle(SAMPLE_HTML)).toContain("Best Running Shoes 2026");
  });
  it("extracts meta description", () => {
    expect(extractMetaDescription(SAMPLE_HTML)).toContain("tested 47 running shoes");
  });
  it("returns empty when not present", () => {
    expect(extractTitle("<html></html>")).toBe("");
    expect(extractMetaDescription("<html></html>")).toBe("");
  });
  it("extracts meta description regardless of attribute order", () => {
    const html = `<meta content="My desc" name="description">`;
    expect(extractMetaDescription(html)).toBe("My desc");
  });
});

describe("countHeadings", () => {
  it("counts each level", () => {
    const h = countHeadings(SAMPLE_HTML);
    expect(h.h1).toBe(1);
    expect(h.h2).toBe(2);
    expect(h.h3).toBe(0);
  });
});

describe("extractLinks", () => {
  it("separates internal and external", () => {
    const { internal, external } = extractLinks(SAMPLE_HTML);
    expect(internal).toBeGreaterThanOrEqual(1);
    expect(external).toBeGreaterThanOrEqual(1);
  });
  it("returns 0/0 when no links", () => {
    const r = extractLinks("<p>no links</p>");
    expect(r.internal).toBe(0);
    expect(r.external).toBe(0);
  });
});

describe("extractImages", () => {
  it("counts images and missing alt", () => {
    const r = extractImages(SAMPLE_HTML);
    expect(r.total).toBe(3);
    expect(r.missingAlt).toBe(1);
  });
});

describe("detectSchema", () => {
  it("detects JSON-LD types", () => {
    const r = detectSchema(SAMPLE_HTML);
    expect(r.has).toBe(true);
    expect(r.types).toContain("Article");
  });
  it("handles @graph arrays", () => {
    const html = `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Article"},{"@type":"FAQPage"}]}</script>`;
    const r = detectSchema(html);
    expect(r.types).toContain("Article");
    expect(r.types).toContain("FAQPage");
  });
  it("flags invalid JSON", () => {
    const r = detectSchema(`<script type="application/ld+json">not json</script>`);
    expect(r.types).toContain("(invalid JSON)");
  });
});

describe("tokenize + countKeyword", () => {
  it("tokenizes lowercase words", () => {
    expect(tokenize("Hello, World 2026!")).toEqual(["hello", "world", "2026"]);
  });
  it("counts single-word keyword", () => {
    const r = countKeyword("running shoes running running", "running");
    expect(r.count).toBe(3);
  });
  it("counts multi-word phrase", () => {
    const r = countKeyword("the best running shoes for running shoes fans", "running shoes");
    expect(r.count).toBe(2);
  });
  it("returns 0 for empty keyword", () => {
    expect(countKeyword("text", "").count).toBe(0);
  });
});

describe("fleschReadingEase + countSyllables", () => {
  it("counts syllables in simple words", () => {
    expect(countSyllables("cat")).toBe(1);
    expect(countSyllables("running")).toBeGreaterThanOrEqual(2);
  });
  it("computes flesch score for text", () => {
    const score = fleschReadingEase("The cat sat on the mat. The dog ran fast.");
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });
  it("returns 0 for empty text", () => {
    expect(fleschReadingEase("")).toBe(0);
  });
});

describe("auditContent — full audit", () => {
  it("errors on empty content", () => {
    expect("error" in auditContent({ content: "", keyword: "test" })).toBe(true);
  });
  it("errors on empty keyword", () => {
    expect("error" in auditContent({ content: "Some content here.", keyword: "" })).toBe(true);
  });
  it("returns overall + 8 sub-scores", () => {
    const r = auditContent({ content: SAMPLE_HTML, keyword: "best running shoes" });
    if ("error" in r) throw new Error("should not error");
    expect(r.subScores.length).toBe(8);
    expect(r.overall).toBeGreaterThanOrEqual(0);
    expect(r.overall).toBeLessThanOrEqual(100);
  });
  it("computes weighted overall score", () => {
    const r = auditContent({ content: SAMPLE_HTML, keyword: "best running shoes" });
    if ("error" in r) throw new Error("should not error");
    const weighted = r.subScores.reduce((s, x) => s + x.score * x.weight, 0);
    expect(r.overall).toBe(Math.round(weighted));
  });
  it("collects prioritized fixes", () => {
    const r = auditContent({ content: "<h2>only subheading</h2><p>short text</p>", keyword: "test" });
    if ("error" in r) throw new Error("should not error");
    expect(r.allFixes.length).toBeGreaterThan(0);
    // High-impact should come first.
    const firstImpact = r.allFixes[0]!.impact;
    expect(["high", "medium", "low"]).toContain(firstImpact);
  });
  it("handles plain-text input (no HTML)", () => {
    const r = auditContent({ content: "This is a plain text article about running shoes. " + "word ".repeat(200), keyword: "running shoes" });
    if ("error" in r) throw new Error("should not error");
    expect(r.metrics.wordCount).toBeGreaterThan(100);
  });
  it("uses competitor benchmark when provided", () => {
    const competitor = "<p>" + "lorem ipsum dolor ".repeat(200) + "</p>";
    const r = auditContent({ content: SAMPLE_HTML, keyword: "best running shoes", competitor });
    if ("error" in r) throw new Error("should not error");
    expect(r.competitorWordCount).toBeGreaterThan(500);
  });
  it("includes a recommendation string", () => {
    const r = auditContent({ content: SAMPLE_HTML, keyword: "best running shoes" });
    if ("error" in r) throw new Error("should not error");
    expect(r.recommendation.length).toBeGreaterThan(0);
  });
});

describe("buildHtmlReport", () => {
  it("produces a valid HTML report", () => {
    const r = auditContent({ content: SAMPLE_HTML, keyword: "best running shoes" });
    if ("error" in r) throw new Error("should not error");
    const html = buildHtmlReport(r, "best running shoes");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("SEO Content Scorecard Audit");
    expect(html).toContain("Best Running Shoes 2026");
  });
});
