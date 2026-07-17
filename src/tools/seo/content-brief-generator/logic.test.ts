import { describe, it, expect, beforeEach } from "vitest";
import {
  isValidUrl,
  validateInput,
  suggestLsiKeywords,
  suggestOutline,
  renderMarkdown,
  renderHtml,
  parseList,
  parseLinks,
  INTENT_LABELS,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ContentBriefInput,
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

const validInput: ContentBriefInput = {
  targetKeyword: "email marketing",
  title: "The Complete Guide to Email Marketing",
  searchIntent: "informational",
  wordCountTarget: 1500,
  audience: "Small business owners",
  tone: "Professional but friendly",
  outline: [
    { heading: "Introduction", notes: "Hook + problem" },
    { heading: "What is email marketing?", notes: "Define" },
    { heading: "Conclusion", notes: "Recap" },
  ],
  keyPoints: ["Define email marketing", "List 3 best practices"],
  lsiKeywords: ["drip campaign", "newsletter", "automation"],
  internalLinks: [{ url: "https://example.com/blog", anchor: "our blog" }],
  externalLinks: [{ url: "https://example.com/source", anchor: "source" }],
  competitorUrls: ["https://competitor.com/article"],
  notes: "Keep it concise.",
};

describe("content-brief-generator isValidUrl", () => {
  it("accepts http/https", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("http://example.com")).toBe(true);
  });
  it("rejects malformed", () => {
    expect(isValidUrl("not-a-url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
});

describe("content-brief-generator validateInput", () => {
  it("errors on missing keyword", () => {
    const r = validateInput({ ...validInput, targetKeyword: "" });
    expect(r.errors.some((e) => /keyword/i.test(e))).toBe(true);
  });
  it("errors on missing title", () => {
    const r = validateInput({ ...validInput, title: "" });
    expect(r.errors.some((e) => /title/i.test(e))).toBe(true);
  });
  it("warns on long title", () => {
    const r = validateInput({ ...validInput, title: "x".repeat(80) });
    expect(r.warnings.some((w) => /title is long/i.test(w))).toBe(true);
  });
  it("warns on low word count", () => {
    const r = validateInput({ ...validInput, wordCountTarget: 50 });
    expect(r.warnings.some((w) => /too short/i.test(w))).toBe(true);
  });
  it("warns on high word count", () => {
    const r = validateInput({ ...validInput, wordCountTarget: 6000 });
    expect(r.warnings.some((w) => /very long/i.test(w))).toBe(true);
  });
  it("warns on empty outline", () => {
    const r = validateInput({ ...validInput, outline: [] });
    expect(r.warnings.some((w) => /outline/i.test(w))).toBe(true);
  });
  it("warns on no key points", () => {
    const r = validateInput({ ...validInput, keyPoints: [] });
    expect(r.warnings.some((w) => /key points/i.test(w))).toBe(true);
  });
  it("warns on no LSI keywords", () => {
    const r = validateInput({ ...validInput, lsiKeywords: [] });
    expect(r.warnings.some((w) => /LSI/i.test(w))).toBe(true);
  });
  it("warns on invalid internal link URL", () => {
    const r = validateInput({
      ...validInput,
      internalLinks: [{ url: "not-a-url", anchor: "x" }],
    });
    expect(r.warnings.some((w) => /internal link/i.test(w))).toBe(true);
  });
  it("warns on invalid external link URL", () => {
    const r = validateInput({
      ...validInput,
      externalLinks: [{ url: "bad", anchor: "x" }],
    });
    expect(r.warnings.some((w) => /external link/i.test(w))).toBe(true);
  });
  it("warns on invalid competitor URL", () => {
    const r = validateInput({ ...validInput, competitorUrls: ["bad"] });
    expect(r.warnings.some((w) => /competitor/i.test(w))).toBe(true);
  });
  it("passes for valid input", () => {
    expect(validateInput(validInput).ok).toBe(true);
  });
});

describe("content-brief-generator suggestLsiKeywords", () => {
  it("returns empty for empty keyword", () => {
    expect(suggestLsiKeywords("")).toEqual([]);
  });
  it("returns suggestions", () => {
    const out = suggestLsiKeywords("email marketing");
    expect(out.length).toBeGreaterThan(5);
    expect(out.some((s) => s.includes("email marketing"))).toBe(true);
  });
});

describe("content-brief-generator suggestOutline", () => {
  it("returns empty for empty keyword", () => {
    expect(suggestOutline("")).toEqual([]);
  });
  it("returns outline items", () => {
    const out = suggestOutline("Email Marketing");
    expect(out.length).toBeGreaterThan(3);
    expect(out.some((s) => s.heading.includes("Email Marketing"))).toBe(true);
  });
});

describe("content-brief-generator renderMarkdown", () => {
  it("renders title as H1", () => {
    const md = renderMarkdown(validInput);
    expect(md).toMatch(/^# Content Brief:/);
    expect(md).toContain("The Complete Guide to Email Marketing");
  });
  it("includes target keyword", () => {
    expect(renderMarkdown(validInput)).toContain("**Target keyword:** email marketing");
  });
  it("includes intent label", () => {
    expect(renderMarkdown(validInput)).toContain(INTENT_LABELS.informational);
  });
  it("includes outline sections", () => {
    expect(renderMarkdown(validInput)).toContain("### Introduction");
  });
  it("includes key points as bullets", () => {
    expect(renderMarkdown(validInput)).toContain("- Define email marketing");
  });
  it("includes LSI keywords", () => {
    expect(renderMarkdown(validInput)).toContain("`drip campaign`");
  });
  it("includes internal links", () => {
    expect(renderMarkdown(validInput)).toContain("[our blog](https://example.com/blog)");
  });
  it("includes competitor URLs", () => {
    expect(renderMarkdown(validInput)).toContain("https://competitor.com/article");
  });
  it("throws on invalid input", () => {
    expect(() => renderMarkdown({ ...validInput, targetKeyword: "" })).toThrow();
  });
});

describe("content-brief-generator renderHtml", () => {
  it("renders article with h1", () => {
    const html = renderHtml(validInput);
    expect(html).toContain("<article");
    expect(html).toContain("<h1>");
  });
  it("escapes HTML in content", () => {
    const html = renderHtml({ ...validInput, title: "A&B <C>" });
    expect(html).toContain("A&amp;B &lt;C&gt;");
  });
  it("includes internal links", () => {
    const html = renderHtml(validInput);
    expect(html).toContain('href="https://example.com/blog"');
  });
  it("throws on invalid input", () => {
    expect(() => renderHtml({ ...validInput, title: "" })).toThrow();
  });
});

describe("content-brief-generator parseList", () => {
  it("returns empty for empty", () => {
    expect(parseList("")).toEqual([]);
  });
  it("parses comma-separated", () => {
    expect(parseList("a, b, c")).toEqual(["a", "b", "c"]);
  });
  it("parses newline-separated", () => {
    expect(parseList("a\nb\nc")).toEqual(["a", "b", "c"]);
  });
});

describe("content-brief-generator parseLinks", () => {
  it("returns empty for empty", () => {
    expect(parseLinks("")).toEqual([]);
  });
  it("parses anchor | URL format", () => {
    const out = parseLinks("Our blog | https://example.com/blog");
    expect(out).toHaveLength(1);
    expect(out[0].anchor).toBe("Our blog");
    expect(out[0].url).toBe("https://example.com/blog");
  });
  it("parses URL with optional anchor", () => {
    const out = parseLinks("https://example.com Our Blog");
    expect(out[0].url).toBe("https://example.com");
    expect(out[0].anchor).toBe("Our Blog");
  });
  it("parses URL only", () => {
    const out = parseLinks("https://example.com");
    expect(out[0].url).toBe("https://example.com");
  });
});

describe("content-brief-generator INTENT_LABELS", () => {
  it("has all 4 intents", () => {
    expect(Object.keys(INTENT_LABELS)).toHaveLength(4);
    expect(INTENT_LABELS.informational).toBeDefined();
    expect(INTENT_LABELS.transactional).toBeDefined();
  });
});

describe("content-brief-generator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, title: "A", keyword: "kw1", wordCount: 1000, snippet: "x" });
    saveHistory({ ts: 2, title: "B", keyword: "kw2", wordCount: 2000, snippet: "y" });
    expect(loadHistory()).toHaveLength(2);
    expect(loadHistory()[0].title).toBe("B");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, title: "X", keyword: "k", wordCount: 100, snippet: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, title: "A", keyword: "k", wordCount: 100, snippet: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("content-brief-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(validInput);
    expect(url).toContain("data=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to input", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(validInput);
    const hash = url.replace(/^\?/, "#");
    const parsed = parseShareUrl(hash) as ContentBriefInput;
    expect(parsed.targetKeyword).toBe("email marketing");
    expect(parsed.title).toBe("The Complete Guide to Email Marketing");
    expect(parsed.outline).toHaveLength(3);
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("returns empty for malformed JSON", () => {
    expect(parseShareUrl("data=notjson")).toEqual({});
  });
});
