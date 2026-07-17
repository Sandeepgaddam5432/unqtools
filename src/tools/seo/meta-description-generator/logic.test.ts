import { describe, it, expect, beforeEach } from "vitest";
import {
  DESCRIPTION_MAX,
  escapeHtml,
  estimatePixelWidth,
  computeStats,
  truncateForPixelLimit,
  buildDescriptionTag,
  estimateCtr,
  generateSuggestions,
  compareAB,
  buildSerpPreview,
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

describe("meta-description-generator escapeHtml", () => {
  it("escapes & < > \" '", () => {
    expect(escapeHtml(`<a>"&'</a>`)).toBe("&lt;a&gt;&quot;&amp;&#39;&lt;/a&gt;");
  });
  it("preserves plain text", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });
});

describe("meta-description-generator estimatePixelWidth", () => {
  it("returns 0 for empty", () => {
    expect(estimatePixelWidth("")).toBe(0);
  });
  it("is positive for plain text", () => {
    expect(estimatePixelWidth("hello")).toBeGreaterThan(0);
  });
  it("W counts more than i", () => {
    expect(estimatePixelWidth("WWWW")).toBeGreaterThan(estimatePixelWidth("iiii"));
  });
  it("CJK chars count higher than ASCII", () => {
    expect(estimatePixelWidth("中文")).toBeGreaterThan(estimatePixelWidth("ab"));
  });
});

describe("meta-description-generator computeStats", () => {
  it("computes stats for normal text", () => {
    const s = computeStats("This is a test description for SEO.");
    expect(s.charCount).toBe(35);
    expect(s.wordCount).toBe(7);
    expect(s.remaining).toBe(DESCRIPTION_MAX - 35);
    expect(s.isOver).toBe(false);
    expect(s.isWarn).toBe(false);
  });
  it("flags over", () => {
    const long = "x".repeat(DESCRIPTION_MAX + 5);
    const s = computeStats(long);
    expect(s.isOver).toBe(true);
    expect(s.remaining).toBe(-5);
  });
  it("flags warn (90-100%)", () => {
    const s = computeStats("x".repeat(DESCRIPTION_MAX - 5));
    expect(s.isWarn).toBe(true);
    expect(s.isOver).toBe(false);
  });
  it("detects pixel truncation", () => {
    const s = computeStats("x".repeat(200));
    expect(s.pixelTruncated).toBe(true);
  });
  it("handles empty input", () => {
    const s = computeStats("");
    expect(s.charCount).toBe(0);
    expect(s.wordCount).toBe(0);
  });
});

describe("meta-description-generator truncateForPixelLimit", () => {
  it("returns short strings unchanged", () => {
    expect(truncateForPixelLimit("short")).toBe("short");
  });
  it("truncates long strings at word boundary with ellipsis", () => {
    const long = "word ".repeat(50);
    const out = truncateForPixelLimit(long, 200);
    expect(out.endsWith("…")).toBe(true);
    expect(out.length).toBeLessThan(long.length);
  });
  it("handles empty input", () => {
    expect(truncateForPixelLimit("")).toBe("");
  });
});

describe("meta-description-generator buildDescriptionTag", () => {
  it("builds meta tag", () => {
    const tag = buildDescriptionTag("My description");
    expect(tag).toBe('<meta name="description" content="My description" />');
  });
  it("escapes HTML in description", () => {
    const tag = buildDescriptionTag("A & B");
    expect(tag).toContain("&amp;");
  });
  it("returns empty for empty input", () => {
    expect(buildDescriptionTag("")).toBe("");
  });
});

describe("meta-description-generator estimateCtr", () => {
  it("returns 0 for empty", () => {
    expect(estimateCtr("")).toBe(0);
  });
  it("gives a baseline score for plain text", () => {
    const score = estimateCtr("A normal description here.");
    expect(score).toBeGreaterThanOrEqual(50);
    expect(score).toBeLessThanOrEqual(100);
  });
  it("boosts keyword presence", () => {
    const noKw = estimateCtr("A description about tools.");
    const withKw = estimateCtr("A description about tools.", "tools");
    expect(withKw).toBeGreaterThan(noKw);
  });
  it("boosts numbers and CTA", () => {
    const score = estimateCtr("Discover 10 top tools today.");
    expect(score).toBeGreaterThan(50);
  });
  it("penalizes over-limit length", () => {
    const over = estimateCtr("x".repeat(170));
    expect(over).toBeLessThan(60);
  });
});

describe("meta-description-generator generateSuggestions", () => {
  it("generates 6 template-based suggestions", () => {
    const s = generateSuggestions({
      title: "SEO Guide",
      content: "Learn SEO step by step. Practical tips for beginners and pros.",
      keyword: "SEO",
    });
    expect(s.length).toBe(6);
    for (const r of s) {
      expect(r.text.length).toBeGreaterThan(0);
      expect(r.template).toBeTruthy();
      expect(r.stats.charCount).toBeLessThanOrEqual(DESCRIPTION_MAX);
    }
  });
  it("includes keyword in concise suggestion", () => {
    const s = generateSuggestions({
      title: "T",
      content: "Some content here.",
      keyword: "BestTool",
    });
    const concise = s.find((r) => r.template === "concise");
    expect(concise?.text.toLowerCase()).toContain("besttool");
  });
  it("handles empty content", () => {
    const s = generateSuggestions({ title: "", content: "" });
    expect(s).toHaveLength(6);
  });
});

describe("meta-description-generator compareAB", () => {
  it("declares A as winner when CTR higher", () => {
    const a = "Discover the 10 best tools today. Free guide. Fast results.";
    const b = "stuff stuff stuff stuff stuff stuff stuff stuff stuff stuff stuff stuff stuff stuff stuff stuff stuff";
    const c = compareAB(a, b, "tools");
    expect(["A", "B", "tie"]).toContain(c.winner);
    expect(c.reasons.length).toBeGreaterThan(0);
  });
  it("returns tie for identical", () => {
    const c = compareAB("same text", "same text", "text");
    expect(c.winner).toBe("tie");
  });
  it("flags pixel truncation difference", () => {
    const c = compareAB("x".repeat(200), "short", "x");
    expect(c.reasons.some((r) => /pixel/i.test(r))).toBe(true);
  });
  it("returns stats for both", () => {
    const c = compareAB("hello world", "hi there");
    expect(c.a.charCount).toBe(11);
    expect(c.b.charCount).toBe(8);
  });
});

describe("meta-description-generator buildSerpPreview", () => {
  it("builds preview with breadcrumb", () => {
    const p = buildSerpPreview("desc", "Title", "https://example.com/blog/post");
    expect(p.title).toBe("Title");
    expect(p.breadcrumb).toContain("example.com");
    expect(p.breadcrumb).toContain("›");
  });
  it("uses defaults when empty", () => {
    const p = buildSerpPreview("desc", "", "");
    expect(p.title).toContain("Sample");
    expect(p.url).toContain("example.com");
  });
  it("truncates long descriptions", () => {
    const long = "word ".repeat(80);
    const p = buildSerpPreview(long, "T", "https://x.com");
    expect(p.truncatedDescription.length).toBeLessThan(long.length);
  });
});

describe("meta-description-generator renderCsv", () => {
  it("renders CSV with header", () => {
    const s = generateSuggestions({ title: "T", content: "C", keyword: "K" });
    const csv = renderCsv(s);
    expect(csv).toContain("template,text,char_count");
    expect(csv.split("\n").length).toBe(7);
  });
  it("escapes commas in text", () => {
    const csv = renderCsv([
      {
        text: "Hello, World",
        template: "concise",
        stats: computeStats("Hello, World"),
      },
    ]);
    expect(csv).toContain('"Hello, World"');
  });
});

describe("meta-description-generator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, title: "T", description: "D", keyword: "K" });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].description).toBe("D");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, title: `T${i}`, description: `D${i}`, keyword: "K" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, title: "T", description: "D", keyword: "K" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("meta-description-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      title: "T",
      content: "C",
      keyword: "K",
      brand: "B",
      versionA: "A",
      versionB: "B",
    });
    expect(url).toContain("title=T");
    expect(url).toContain("a=A");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to input", () => {
    const parsed = parseShareUrl("title=Hello&content=World&keyword=KW&brand=Brand&a=VA&b=VB");
    expect(parsed.title).toBe("Hello");
    expect(parsed.content).toBe("World");
    expect(parsed.keyword).toBe("KW");
    expect(parsed.brand).toBe("Brand");
    expect(parsed.versionA).toBe("VA");
    expect(parsed.versionB).toBe("VB");
  });
  it("handles empty hash", () => {
    const parsed = parseShareUrl("");
    expect(parsed.title).toBe("");
    expect(parsed.versionA).toBe("");
  });
  it("omits empty fields", () => {
    const url = buildShareUrl({
      title: "T",
      content: "",
      keyword: "",
      brand: "",
      versionA: "",
      versionB: "",
    });
    expect(url).toContain("title=T");
    expect(url).not.toContain("content=");
  });
});
