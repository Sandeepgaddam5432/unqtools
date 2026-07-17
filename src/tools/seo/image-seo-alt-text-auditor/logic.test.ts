import { describe, it, expect, beforeEach } from "vitest";
import {
  ALT_MIN_LENGTH,
  ALT_MAX_LENGTH,
  extractImages,
  getAttribute,
  classifyAlt,
  isNonDescriptive,
  buildIssue,
  auditImages,
  renderCsv,
  renderReport,
  generateAccessibilityIssues,
  generateSeoIssues,
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

describe("image-seo-alt-text-auditor extractImages", () => {
  it("extracts a single img", () => {
    const html = '<img src="a.jpg" alt="A photo">';
    const imgs = extractImages(html);
    expect(imgs).toHaveLength(1);
    expect(imgs[0].src).toBe("a.jpg");
    expect(imgs[0].alt).toBe("A photo");
  });
  it("extracts multiple imgs", () => {
    const html = '<img src="a.jpg"><img src="b.jpg">';
    expect(extractImages(html)).toHaveLength(2);
  });
  it("handles empty HTML", () => {
    expect(extractImages("")).toEqual([]);
  });
  it("handles HTML with no images", () => {
    expect(extractImages("<p>no images</p>")).toEqual([]);
  });
  it("preserves raw tag", () => {
    const html = '<img src="x.jpg" alt="x">';
    expect(extractImages(html)[0].raw).toBe('<img src="x.jpg" alt="x">');
  });
  it("indexes images sequentially", () => {
    const html = '<img src="a"><img src="b"><img src="c">';
    const imgs = extractImages(html);
    expect(imgs.map((i) => i.index)).toEqual([0, 1, 2]);
  });
});

describe("image-seo-alt-text-auditor getAttribute", () => {
  it("gets attribute with double quotes", () => {
    expect(getAttribute('<img src="x.jpg">', "src")).toBe("x.jpg");
  });
  it("gets attribute with single quotes", () => {
    expect(getAttribute("<img src='x.jpg'>", "src")).toBe("x.jpg");
  });
  it("returns null when attribute missing", () => {
    expect(getAttribute("<img>", "src")).toBeNull();
  });
  it("gets alt attribute", () => {
    expect(getAttribute('<img alt="description">', "alt")).toBe("description");
  });
  it("gets empty string for empty attribute", () => {
    expect(getAttribute('<img alt="">', "alt")).toBe("");
  });
  it("handles attributes case-insensitively", () => {
    expect(getAttribute('<IMG SRC="x.jpg">', "src")).toBe("x.jpg");
  });
});

describe("image-seo-alt-text-auditor classifyAlt", () => {
  it("classifies missing alt", () => {
    expect(classifyAlt({ src: "x", alt: null, title: null, isDecorative: false, raw: "", index: 0 })).toBe("missing-alt");
  });
  it("classifies empty alt (decorative)", () => {
    expect(classifyAlt({ src: "x", alt: "", title: null, isDecorative: true, raw: "", index: 0 })).toBe("empty-alt");
  });
  it("classifies too short alt", () => {
    expect(classifyAlt({ src: "x", alt: "ab", title: null, isDecorative: false, raw: "", index: 0 })).toBe("too-short");
  });
  it("classifies too long alt", () => {
    const longAlt = "a".repeat(ALT_MAX_LENGTH + 10);
    expect(classifyAlt({ src: "x", alt: longAlt, title: null, isDecorative: false, raw: "", index: 0 })).toBe("too-long");
  });
  it("classifies non-descriptive alt", () => {
    expect(classifyAlt({ src: "x", alt: "image", title: null, isDecorative: false, raw: "", index: 0 })).toBe("non-descriptive");
  });
  it("classifies good alt", () => {
    expect(classifyAlt({ src: "x", alt: "A red sports car on a highway", title: null, isDecorative: false, raw: "", index: 0 })).toBe("good");
  });
});

describe("image-seo-alt-text-auditor isNonDescriptive", () => {
  it("returns true for single generic word", () => {
    expect(isNonDescriptive("image")).toBe(true);
    expect(isNonDescriptive("photo")).toBe(true);
    expect(isNonDescriptive("icon")).toBe(true);
  });
  it("returns false for descriptive text", () => {
    expect(isNonDescriptive("A red sports car")).toBe(false);
  });
  it("returns false when mixed with descriptive words", () => {
    expect(isNonDescriptive("image of a car")).toBe(false);
  });
  it("returns true for empty string", () => {
    expect(isNonDescriptive("")).toBe(true);
  });
});

describe("image-seo-alt-text-auditor buildIssue", () => {
  it("builds issue for missing alt", () => {
    const issue = buildIssue({ src: "x.jpg", alt: null, title: null, isDecorative: false, raw: "", index: 0 });
    expect(issue.type).toBe("missing-alt");
    expect(issue.message).toContain("Missing");
  });
  it("builds issue for good alt", () => {
    const issue = buildIssue({ src: "x.jpg", alt: "A red car", title: null, isDecorative: false, raw: "", index: 0 });
    expect(issue.type).toBe("good");
    expect(issue.message).toContain("Good alt text");
  });
  it("builds issue for too long alt with length in message", () => {
    const longAlt = "a".repeat(200);
    const issue = buildIssue({ src: "x.jpg", alt: longAlt, title: null, isDecorative: false, raw: "", index: 0 });
    expect(issue.message).toContain("200");
  });
});

describe("image-seo-alt-text-auditor auditImages", () => {
  it("audits a full HTML document", () => {
    const html = `
      <img src="good.jpg" alt="A red car on the road" width="200" height="100">
      <img src="missing.jpg">
      <img src="empty.jpg" alt="">
      <img src="short.jpg" alt="ab">
      <img src="long.jpg" alt="${"a".repeat(150)}">
      <img src="generic.jpg" alt="image">
    `;
    const r = auditImages(html);
    expect(r.stats.totalImages).toBe(6);
    expect(r.stats.good).toBe(1);
    expect(r.stats.missingAlt).toBe(1);
    expect(r.stats.emptyAlt).toBe(1);
    expect(r.stats.tooShort).toBe(1);
    expect(r.stats.tooLong).toBe(1);
    expect(r.stats.nonDescriptive).toBe(1);
    expect(r.stats.withWidth).toBe(1);
    expect(r.stats.withHeight).toBe(1);
  });
  it("computes alt length stats", () => {
    const html = `
      <img src="a" alt="hello world">
      <img src="b" alt="short">
      <img src="c" alt="a much longer description here">
    `;
    const r = auditImages(html);
    expect(r.stats.altLengthMin).toBeGreaterThan(0);
    expect(r.stats.altLengthMax).toBeGreaterThan(r.stats.altLengthMin);
    expect(r.stats.altLengthAvg).toBeGreaterThan(0);
  });
  it("returns empty stats for no images", () => {
    const r = auditImages("<p>no images</p>");
    expect(r.stats.totalImages).toBe(0);
    expect(r.stats.good).toBe(0);
    expect(r.images).toEqual([]);
  });
  it("handles empty HTML", () => {
    const r = auditImages("");
    expect(r.stats.totalImages).toBe(0);
  });
});

describe("image-seo-alt-text-auditor renderCsv", () => {
  it("renders CSV with headers", () => {
    const r = auditImages('<img src="x.jpg" alt="good text">');
    const csv = renderCsv(r);
    expect(csv).toContain("index,src,alt,status,length");
    expect(csv).toContain("0,x.jpg,good text,good");
  });
  it("escapes commas in alt text", () => {
    const r = auditImages('<img src="x.jpg" alt="hello, world">');
    const csv = renderCsv(r);
    expect(csv).toContain('"hello, world"');
  });
});

describe("image-seo-alt-text-auditor renderReport", () => {
  it("renders markdown report", () => {
    const r = auditImages('<img src="x.jpg" alt="A car">');
    const report = renderReport(r);
    expect(report).toContain("# Image SEO & Alt Text Audit Report");
    expect(report).toContain("**Total images:**");
    expect(report).toContain("## Issues");
    expect(report).toContain("## SEO recommendations");
  });
  it("includes no-images message when empty", () => {
    const r = auditImages("");
    const report = renderReport(r);
    expect(report).toContain("No images found");
  });
});

describe("image-seo-alt-text-auditor generateAccessibilityIssues", () => {
  it("reports WCAG issues for missing alt", () => {
    const r = auditImages('<img src="x.jpg">');
    const issues = generateAccessibilityIssues(r);
    expect(issues.some((i) => i.includes("WCAG"))).toBe(true);
  });
  it("reports no issues for good images", () => {
    const r = auditImages('<img src="x.jpg" alt="A descriptive text">');
    const issues = generateAccessibilityIssues(r);
    expect(issues).toHaveLength(0);
  });
  it("reports too-long issue", () => {
    const r = auditImages(`<img src="x" alt="${"a".repeat(150)}">`);
    const issues = generateAccessibilityIssues(r);
    expect(issues.some((i) => /too long/i.test(i) || /over/i.test(i))).toBe(true);
  });
});

describe("image-seo-alt-text-auditor generateSeoIssues", () => {
  it("reports missing dimensions", () => {
    const r = auditImages('<img src="x.jpg" alt="good alt text">');
    const issues = generateSeoIssues(r);
    expect(issues.some((i) => /width\/height/i.test(i))).toBe(true);
  });
  it("reports non-descriptive alt", () => {
    const r = auditImages('<img src="x.jpg" alt="image">');
    const issues = generateSeoIssues(r);
    expect(issues.some((i) => /non-descriptive/i.test(i))).toBe(true);
  });
  it("reports no issues for perfect image", () => {
    const r = auditImages('<img src="x.jpg" alt="A descriptive text" width="100" height="50">');
    const issues = generateSeoIssues(r);
    expect(issues).toHaveLength(0);
  });
});

describe("image-seo-alt-text-auditor history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, imageCount: 5, issueCount: 2, goodCount: 3 });
    saveHistory({ ts: 2, imageCount: 10, issueCount: 4, goodCount: 6 });
    expect(loadHistory()).toHaveLength(2);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, imageCount: 1, issueCount: 0, goodCount: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, imageCount: 1, issueCount: 0, goodCount: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("image-seo-alt-text-auditor shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("<img>");
    expect(url).toContain("html=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const parsed = parseShareUrl("html=%3Cimg%3E");
    expect(parsed.html).toBe("<img>");
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
});

describe("image-seo-alt-text-auditor constants", () => {
  it("ALT_MIN_LENGTH is sensible (>= 3)", () => {
    expect(ALT_MIN_LENGTH).toBeGreaterThanOrEqual(3);
  });
  it("ALT_MAX_LENGTH is sensible (>= 100)", () => {
    expect(ALT_MAX_LENGTH).toBeGreaterThanOrEqual(100);
  });
});
