import { describe, it, expect, beforeEach } from "vitest";
import {
  fillPlaceholders,
  suggestH2Topics,
  suggestH3Topics,
  validateInput,
  buildH1,
  totalWordTarget,
  renderMarkdown,
  renderHtml,
  renderJson,
  applyTemplate,
  TEMPLATES,
  DEFAULT_TEMPLATES,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type OutlineInput,
  type OutlineTemplate,
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

const validInput: OutlineInput = {
  topic: "Email Marketing",
  keyword: "email marketing tips",
  sections: [
    { heading: "Introduction", level: 2, wordTarget: 100 },
    { heading: "What is {topic}?", level: 2, wordTarget: 200, keyPoints: ["Define", "Why it matters"] },
    { heading: "Best practices", level: 2, wordTarget: 300 },
    { heading: "Conclusion", level: 2, wordTarget: 100 },
  ],
};

describe("content-outline-generator fillPlaceholders", () => {
  it("replaces {topic}", () => {
    expect(fillPlaceholders("What is {topic}?", "Email", "")).toBe("What is Email?");
  });
  it("replaces {keyword}", () => {
    expect(fillPlaceholders("Use {keyword} today", "", "tips")).toBe("Use tips today");
  });
  it("replaces both", () => {
    expect(fillPlaceholders("{topic} for {keyword}", "Email", "tips")).toBe("Email for tips");
  });
  it("returns empty for empty", () => {
    expect(fillPlaceholders("", "x", "y")).toBe("");
  });
  it("is case-insensitive", () => {
    expect(fillPlaceholders("what is {TOPIC}?", "Email", "")).toBe("what is Email?");
  });
});

describe("content-outline-generator suggestH2Topics", () => {
  it("returns empty for empty topic", () => {
    expect(suggestH2Topics("")).toEqual([]);
  });
  it("returns suggestions with topic name", () => {
    const out = suggestH2Topics("SEO");
    expect(out.length).toBeGreaterThan(5);
    expect(out.some((s) => s.includes("SEO"))).toBe(true);
  });
});

describe("content-outline-generator suggestH3Topics", () => {
  it("returns empty for empty h2", () => {
    expect(suggestH3Topics("")).toEqual([]);
  });
  it("returns suggestions", () => {
    const out = suggestH3Topics("Getting started");
    expect(out.length).toBeGreaterThan(2);
    expect(out.some((s) => s.includes("Getting started"))).toBe(true);
  });
});

describe("content-outline-generator validateInput", () => {
  it("errors on missing topic", () => {
    const r = validateInput({ ...validInput, topic: "" });
    expect(r.errors.some((e) => /topic/i.test(e))).toBe(true);
  });
  it("warns on missing keyword", () => {
    const r = validateInput({ ...validInput, keyword: "" });
    expect(r.warnings.some((w) => /keyword/i.test(w))).toBe(true);
  });
  it("warns on no sections", () => {
    const r = validateInput({ ...validInput, sections: [] });
    expect(r.warnings.some((w) => /sections/i.test(w))).toBe(true);
  });
  it("errors on empty heading", () => {
    const r = validateInput({
      ...validInput,
      sections: [{ heading: "", level: 2 }],
    });
    expect(r.errors.some((e) => /heading/i.test(e))).toBe(true);
  });
  it("passes for valid input", () => {
    expect(validateInput(validInput).ok).toBe(true);
  });
});

describe("content-outline-generator buildH1", () => {
  it("builds H1 with topic and keyword", () => {
    const h1 = buildH1("Email Marketing", "tips");
    expect(h1).toContain("Email Marketing");
    expect(h1).toContain("Tips");
  });
  it("builds H1 with topic only", () => {
    expect(buildH1("Email Marketing", "")).toContain("Email Marketing");
  });
  it("returns empty for empty topic", () => {
    expect(buildH1("", "")).toBe("");
  });
});

describe("content-outline-generator totalWordTarget", () => {
  it("returns 0 for empty sections", () => {
    expect(totalWordTarget([])).toBe(0);
  });
  it("sums word targets", () => {
    const sum = totalWordTarget([
      { heading: "A", level: 2, wordTarget: 100 },
      { heading: "B", level: 2, wordTarget: 200 },
      { heading: "C", level: 3 }, // no target
    ]);
    expect(sum).toBe(300);
  });
});

describe("content-outline-generator renderMarkdown", () => {
  it("renders H1", () => {
    const md = renderMarkdown(validInput);
    expect(md).toMatch(/^# /);
    expect(md).toContain("Email Marketing");
  });
  it("includes keyword blockquote", () => {
    const md = renderMarkdown(validInput);
    expect(md).toContain("**Target keyword:**");
  });
  it("includes sections", () => {
    const md = renderMarkdown(validInput);
    expect(md).toContain("## Introduction");
    expect(md).toContain("## What is Email Marketing?");
  });
  it("includes word target", () => {
    const md = renderMarkdown(validInput);
    expect(md).toContain("Target: ~100 words");
  });
  it("includes key points as bullets", () => {
    const md = renderMarkdown(validInput);
    expect(md).toContain("- Define");
  });
  it("throws on invalid input", () => {
    expect(() => renderMarkdown({ ...validInput, topic: "" })).toThrow();
  });
});

describe("content-outline-generator renderHtml", () => {
  it("renders article with h1", () => {
    const html = renderHtml(validInput);
    expect(html).toContain("<article>");
    expect(html).toContain("<h1>");
  });
  it("renders sections as h2/h3", () => {
    const html = renderHtml(validInput);
    expect(html).toContain("<h2>");
  });
  it("escapes HTML", () => {
    const html = renderHtml({ ...validInput, topic: "A&B <C>" });
    expect(html).toContain("A&amp;B &lt;C&gt;");
  });
  it("throws on invalid input", () => {
    expect(() => renderHtml({ ...validInput, topic: "" })).toThrow();
  });
});

describe("content-outline-generator renderJson", () => {
  it("returns valid JSON", () => {
    const json = renderJson(validInput);
    const obj = JSON.parse(json);
    expect(obj.topic).toBe("Email Marketing");
    expect(obj.keyword).toBe("email marketing tips");
  });
  it("includes sections with filled placeholders", () => {
    const json = renderJson(validInput);
    const obj = JSON.parse(json);
    expect(obj.sections[1].heading).toBe("What is Email Marketing?");
  });
  it("includes totalWordTarget", () => {
    const json = renderJson(validInput);
    const obj = JSON.parse(json);
    expect(obj.totalWordTarget).toBe(700);
  });
  it("throws on invalid input", () => {
    expect(() => renderJson({ ...validInput, topic: "" })).toThrow();
  });
});

describe("content-outline-generator applyTemplate", () => {
  it("returns empty for custom template", () => {
    expect(applyTemplate("custom", "x", "y")).toEqual([]);
  });
  it("returns sections for blog-post template", () => {
    const out = applyTemplate("blog-post", "Email", "tips");
    expect(out.length).toBeGreaterThan(0);
    expect(out.some((s) => s.heading.includes("Email"))).toBe(true);
  });
  it("fills placeholders", () => {
    const out = applyTemplate("blog-post", "Email", "tips");
    expect(out.some((s) => s.heading === "What is Email?")).toBe(true);
  });
  it("returns sections for listicle template", () => {
    const out = applyTemplate("listicle", "X", "y");
    expect(out.length).toBe(12); // 10 items + intro + conclusion
  });
});

describe("content-outline-generator TEMPLATES and DEFAULTS", () => {
  it("has all 6 templates", () => {
    expect(Object.keys(TEMPLATES)).toHaveLength(6);
    expect(TEMPLATES["blog-post"]).toBeDefined();
    expect(TEMPLATES["custom"]).toBeDefined();
  });
  it("DEFAULT_TEMPLATES has 5 entries (no custom)", () => {
    expect(Object.keys(DEFAULT_TEMPLATES)).toHaveLength(5);
  });
});

describe("content-outline-generator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, topic: "A", sectionCount: 3, snippet: "x" });
    saveHistory({ ts: 2, topic: "B", sectionCount: 5, snippet: "y" });
    expect(loadHistory()).toHaveLength(2);
    expect(loadHistory()[0].topic).toBe("B");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, topic: "X", sectionCount: 1, snippet: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, topic: "A", sectionCount: 1, snippet: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("content-outline-generator shareable URL", () => {
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
    const parsed = parseShareUrl(hash) as OutlineInput;
    expect(parsed.topic).toBe("Email Marketing");
    expect(parsed.sections).toHaveLength(4);
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("returns empty for malformed JSON", () => {
    expect(parseShareUrl("data=notjson")).toEqual({});
  });
});
