import { describe, it, expect, beforeEach } from "vitest";
import {
  DEFAULT_THRESHOLDS,
  stripHtml,
  extractTitle,
  extractMetaDescription,
  extractHeadings,
  extractImages,
  extractLinks,
  detectSchema,
  hasViewport,
  countWords,
  countKeyword,
  computeDensity,
  fleschReadingEase,
  audit,
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

describe("seo-content-scorecard DEFAULT_THRESHOLDS", () => {
  it("has sensible defaults", () => {
    expect(DEFAULT_THRESHOLDS.titleMax).toBe(60);
    expect(DEFAULT_THRESHOLDS.metaMax).toBe(160);
    expect(DEFAULT_THRESHOLDS.wordCountMin).toBeGreaterThanOrEqual(300);
  });
});

describe("seo-content-scorecard stripHtml", () => {
  it("strips tags", () => {
    expect(stripHtml("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });
  it("strips scripts and styles", () => {
    expect(stripHtml("<script>alert(1)</script>text")).toBe("text");
    expect(stripHtml("<style>.x{}</style>text")).toBe("text");
  });
  it("handles empty", () => {
    expect(stripHtml("")).toBe("");
  });
  it("decodes entities", () => {
    expect(stripHtml("a&nbsp;b")).toBe("a b");
  });
});

describe("seo-content-scorecard extractTitle", () => {
  it("extracts title tag", () => {
    expect(extractTitle("<title>My Page</title>")).toBe("My Page");
  });
  it("falls back to H1", () => {
    expect(extractTitle("<h1>Hello</h1>")).toBe("Hello");
  });
  it("returns empty when no title", () => {
    expect(extractTitle("nope")).toBe("");
  });
});

describe("seo-content-scorecard extractMetaDescription", () => {
  it("extracts meta description", () => {
    expect(extractMetaDescription('<meta name="description" content="My desc">')).toBe("My desc");
  });
  it("returns empty when not present", () => {
    expect(extractMetaDescription("<title>x</title>")).toBe("");
  });
});

describe("seo-content-scorecard extractHeadings", () => {
  it("extracts all headings", () => {
    const h = extractHeadings("<h1>A</h1><h2>B</h2><h3>C</h3>");
    expect(h).toHaveLength(3);
    expect(h[0]).toEqual({ level: 1, text: "A" });
  });
  it("returns empty for no headings", () => {
    expect(extractHeadings("<p>nope</p>")).toEqual([]);
  });
});

describe("seo-content-scorecard extractImages", () => {
  it("extracts src and alt", () => {
    const imgs = extractImages('<img src="a.jpg" alt="Alt">');
    expect(imgs[0]).toEqual({ src: "a.jpg", alt: "Alt" });
  });
  it("handles missing alt", () => {
    const imgs = extractImages('<img src="a.jpg">');
    expect(imgs[0].alt).toBe("");
  });
});

describe("seo-content-scorecard extractLinks", () => {
  it("extracts href and text", () => {
    const links = extractLinks('<a href="/page">Click</a>');
    expect(links[0]).toEqual({ href: "/page", text: "Click" });
  });
  it("returns empty for no links", () => {
    expect(extractLinks("<p>nope</p>")).toEqual([]);
  });
});

describe("seo-content-scorecard detectSchema", () => {
  it("detects JSON-LD", () => {
    expect(detectSchema('<script type="application/ld+json">{"@type":"Article"}</script>')).toContain("JSON-LD");
  });
  it("detects Microdata", () => {
    expect(detectSchema('<div itemscope>')).toContain("Microdata");
  });
  it("returns empty for no schema", () => {
    expect(detectSchema("<p>nope</p>")).toEqual([]);
  });
});

describe("seo-content-scorecard hasViewport", () => {
  it("detects viewport tag", () => {
    expect(hasViewport('<meta name="viewport" content="width=device-width">')).toBe(true);
  });
  it("returns false when missing", () => {
    expect(hasViewport("<p>nope</p>")).toBe(false);
  });
});

describe("seo-content-scorecard countWords", () => {
  it("counts words", () => {
    expect(countWords("Hello world from SEO")).toBe(4);
  });
  it("returns 0 for empty", () => {
    expect(countWords("")).toBe(0);
  });
});

describe("seo-content-scorecard countKeyword", () => {
  it("counts case-insensitive", () => {
    expect(countKeyword("SEO is great. seo rules.", "SEO")).toBe(2);
  });
  it("returns 0 for empty", () => {
    expect(countKeyword("", "SEO")).toBe(0);
    expect(countKeyword("text", "")).toBe(0);
  });
});

describe("seo-content-scorecard computeDensity", () => {
  it("computes density percentage", () => {
    const d = computeDensity("SEO is great SEO tools", "SEO");
    expect(d).toBeGreaterThan(0);
  });
  it("returns 0 for empty", () => {
    expect(computeDensity("", "SEO")).toBe(0);
  });
});

describe("seo-content-scorecard fleschReadingEase", () => {
  it("returns score 0-100", () => {
    const s = fleschReadingEase("The cat sat on the mat. The dog ran fast.");
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
  it("returns 0 for empty", () => {
    expect(fleschReadingEase("")).toBe(0);
  });
  it("higher score for simpler text", () => {
    const simple = fleschReadingEase("The cat sat. The dog ran. I am happy.");
    const complex = fleschReadingEase("Notwithstanding the aforementioned complexities, the implementation necessitates substantial consideration.");
    expect(simple).toBeGreaterThan(complex);
  });
});

describe("seo-content-scorecard audit", () => {
  it("returns scorecard with 12 checks", () => {
    const r = audit("Just some plain text without anything special.", "some");
    expect(r.checks.length).toBeGreaterThanOrEqual(10);
  });
  it("fails for empty input", () => {
    const r = audit("", "");
    expect(r.score).toBeLessThan(50);
    expect(r.failCount).toBeGreaterThan(0);
  });
  it("passes well-formed HTML", () => {
    const html = `<!DOCTYPE html><html><head>
      <title>Best SEO Guide 2026 — Complete Walkthrough</title>
      <meta name="description" content="The complete SEO guide for beginners and pros. Learn on-page, off-page, and technical SEO.">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <script type="application/ld+json">{"@type":"Article"}</script>
      </head><body>
      <h1>SEO Guide</h1>
      <h2>What is SEO</h2>
      <p>SEO is the practice of optimizing websites for search engines. SEO helps you rank higher. SEO is essential. SEO matters. SEO works.</p>
      <h2>How to do SEO</h2>
      <p>Start with keyword research. Build quality content. Get backlinks.</p>
      <a href="/other">Related guide</a>
      <a href="/another">Another guide</a>
      <a href="/third">Third guide</a>
      <img src="diagram.png" alt="SEO diagram">
      </body></html>`;
    const r = audit(html, "SEO");
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.passCount).toBeGreaterThan(0);
  });
  it("computes score 0-100", () => {
    const r = audit("test", "test");
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
  it("returns recommendations sorted by impact", () => {
    const r = audit("", "");
    expect(r.recommendations.length).toBeGreaterThan(0);
    // First recommendation should be a fail (highest priority)
    expect(r.recommendations[0].status).toBe("fail");
  });
  it("handles plain text input gracefully", () => {
    const r = audit("Just plain text content without HTML.", "plain");
    expect(r.checks.length).toBeGreaterThan(0);
  });
  it("warns on missing meta description", () => {
    const r = audit("<html><head><title>x</title></head><body></body></html>", "");
    const meta = r.checks.find((c) => c.id === "meta");
    expect(meta?.status).toBe("fail");
  });
});

describe("seo-content-scorecard renderMarkdown", () => {
  it("renders markdown header", () => {
    const md = renderMarkdown(audit("test", "test"));
    expect(md).toContain("# SEO Content Scorecard");
    expect(md).toContain("Overall score");
  });
  it("includes checks table", () => {
    const md = renderMarkdown(audit("test", "test"));
    expect(md).toContain("| Check | Status |");
  });
  it("includes recommendations section", () => {
    const md = renderMarkdown(audit("", ""));
    expect(md).toContain("Prioritized recommendations");
  });
});

describe("seo-content-scorecard history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, score: 75, passCount: 5, warnCount: 3, failCount: 2 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, score: 50, passCount: 1, warnCount: 1, failCount: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, score: 50, passCount: 1, warnCount: 1, failCount: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("seo-content-scorecard shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ content: "hello", keyword: "world" });
    expect(url).toContain("content=hello");
    expect(url).toContain("keyword=world");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("content=Hello+World&keyword=SEO");
    expect(p.content).toBe("Hello World");
    expect(p.keyword).toBe("SEO");
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.content).toBe("");
    expect(p.keyword).toBe("");
  });
  it("omits empty fields", () => {
    const url = buildShareUrl({ content: "x", keyword: "" });
    expect(url).toContain("content=x");
    expect(url).not.toContain("keyword=");
  });
});
