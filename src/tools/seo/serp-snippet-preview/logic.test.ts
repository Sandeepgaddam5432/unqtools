import { describe, it, expect, beforeEach } from "vitest";
import {
  escapeHtml,
  estimatePixelWidth,
  countChars,
  truncateForPixelLimit,
  truncateForCharLimit,
  isValidUrl,
  formatUrlDisplay,
  buildSerpPreview,
  validateSerpInput,
  estimateCtr,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  TITLE_MAX_CHARS,
  DESCRIPTION_MAX_CHARS,
  type SerpInput,
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

describe("serp-snippet-preview escapeHtml", () => {
  it("escapes HTML special chars", () => {
    expect(escapeHtml(`<a href="x">A & B</a>`)).toContain("&amp;");
  });
});

describe("serp-snippet-preview estimatePixelWidth", () => {
  it("returns 0 for empty string", () => {
    expect(estimatePixelWidth("")).toBe(0);
  });
  it("approximates width for latin text", () => {
    const w = estimatePixelWidth("Hello World");
    expect(w).toBeGreaterThan(50);
    expect(w).toBeLessThan(200);
  });
  it("doubles width for CJK characters", () => {
    const wCJK = estimatePixelWidth("中文");
    const wLatin = estimatePixelWidth("ab");
    expect(wCJK).toBeGreaterThan(wLatin);
  });
  it("narrow chars (i, l, 1) get half width", () => {
    const wWide = estimatePixelWidth("WWW");
    const wNarrow = estimatePixelWidth("iii");
    expect(wNarrow).toBeLessThan(wWide);
  });
});

describe("serp-snippet-preview countChars", () => {
  it("returns expected counts", () => {
    const c = countChars("Hello", 60);
    expect(c.value).toBe(5);
    expect(c.remaining).toBe(55);
    expect(c.isOver).toBe(false);
    expect(c.isWarn).toBe(false);
  });
  it("flags over-limit", () => {
    expect(countChars("x".repeat(70), 60).isOver).toBe(true);
  });
  it("flags near-limit warning", () => {
    expect(countChars("x".repeat(58), 60).isWarn).toBe(true);
  });
});

describe("serp-snippet-preview truncateForPixelLimit", () => {
  it("returns full string when within limit", () => {
    expect(truncateForPixelLimit("Short", 600)).toBe("Short");
  });
  it("truncates with ellipsis when over limit", () => {
    const long = "x".repeat(200);
    const s = truncateForPixelLimit(long, 100);
    expect(s.endsWith("…")).toBe(true);
    expect(s.length).toBeLessThan(long.length);
  });
  it("returns empty for empty input", () => {
    expect(truncateForPixelLimit("", 600)).toBe("");
  });
});

describe("serp-snippet-preview truncateForCharLimit", () => {
  it("returns full string when within limit", () => {
    expect(truncateForCharLimit("Hello", 60)).toBe("Hello");
  });
  it("truncates with ellipsis when over limit", () => {
    expect(truncateForCharLimit("Hello World This Is Long", 10)).toBe("Hello Wor…");
  });
});

describe("serp-snippet-preview isValidUrl", () => {
  it("accepts https URLs", () => {
    expect(isValidUrl("https://example.com/x")).toBe(true);
  });
  it("rejects bare strings", () => {
    expect(isValidUrl("not a url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
});

describe("serp-snippet-preview formatUrlDisplay", () => {
  it("strips protocol and shows host + path", () => {
    const out = formatUrlDisplay("https://example.com/blog/article");
    expect(out.host).toBe("example.com");
    expect(out.path).toBe("/blog/article");
    expect(out.full).toContain("example.com");
  });
  it("handles root URL", () => {
    const out = formatUrlDisplay("https://example.com/");
    expect(out.host).toBe("example.com");
    expect(out.path).toBe("");
  });
  it("returns input for invalid URL", () => {
    const out = formatUrlDisplay("not-a-url");
    expect(out.host).toBe("not-a-url");
  });
});

describe("serp-snippet-preview buildSerpPreview", () => {
  const baseInput: SerpInput = {
    title: "Hello World",
    url: "https://example.com/article",
    description: "A description of the page.",
  };
  it("builds preview with truncated title and description", () => {
    const p = buildSerpPreview(baseInput);
    expect(p.truncatedTitle).toBe("Hello World");
    expect(p.host).toBe("example.com");
    expect(p.truncatedDescription).toBe("A description of the page.");
  });
  it("truncates long titles", () => {
    const p = buildSerpPreview({ ...baseInput, title: "x".repeat(200) });
    expect(p.truncatedTitle.endsWith("…")).toBe(true);
  });
  it("truncates long descriptions", () => {
    const p = buildSerpPreview({ ...baseInput, description: "x".repeat(300) });
    expect(p.truncatedDescription.endsWith("…")).toBe(true);
  });
  it("includes date prefix when set", () => {
    const p = buildSerpPreview({ ...baseInput, datePrefix: "Jan 1, 2026" });
    expect(p.truncatedDescription.startsWith("Jan 1, 2026 — ")).toBe(true);
  });
  it("includes breadcrumb when set", () => {
    const p = buildSerpPreview({ ...baseInput, breadcrumb: "Home › Blog" });
    expect(p.breadcrumb).toBe("Home › Blog");
  });
  it("flags title over limit", () => {
    const p = buildSerpPreview({ ...baseInput, title: "x".repeat(80) });
    expect(p.titleOverLimit).toBe(true);
  });
  it("flags description over limit", () => {
    const p = buildSerpPreview({ ...baseInput, description: "x".repeat(200) });
    expect(p.descOverLimit).toBe(true);
  });
  it("supports mobile mode", () => {
    const p = buildSerpPreview({ ...baseInput, description: "x".repeat(180) }, "mobile");
    expect(p).toBeDefined();
  });
  it("returns empty title for empty input", () => {
    const p = buildSerpPreview({ title: "", url: "https://x.com", description: "" });
    expect(p.truncatedTitle).toBe("");
  });
});

describe("serp-snippet-preview validateSerpInput", () => {
  const valid: SerpInput = {
    title: "Hello",
    url: "https://example.com",
    description: "World",
  };
  it("passes for valid input", () => {
    const r = validateSerpInput(valid);
    expect(r.ok).toBe(true);
  });
  it("errors on missing title", () => {
    const r = validateSerpInput({ ...valid, title: "" });
    expect(r.ok).toBe(false);
  });
  it("errors on missing URL", () => {
    const r = validateSerpInput({ ...valid, url: "" });
    expect(r.ok).toBe(false);
  });
  it("errors on invalid URL", () => {
    const r = validateSerpInput({ ...valid, url: "not-a-url" });
    expect(r.ok).toBe(false);
  });
  it("warns on missing description", () => {
    const r = validateSerpInput({ ...valid, description: "" });
    expect(r.warnings.some((w) => /description/i.test(w))).toBe(true);
  });
  it("warns on very long title", () => {
    const r = validateSerpInput({ ...valid, title: "x".repeat(TITLE_MAX_CHARS + 25) });
    expect(r.warnings.some((w) => /title/i.test(w))).toBe(true);
  });
  it("warns on very long description", () => {
    const r = validateSerpInput({ ...valid, description: "x".repeat(DESCRIPTION_MAX_CHARS + 50) });
    expect(r.warnings.some((w) => /description/i.test(w))).toBe(true);
  });
});

describe("serp-snippet-preview estimateCtr", () => {
  it("returns a score and label", () => {
    const ctr = estimateCtr({
      title: "A good title",
      url: "https://example.com",
      description: "A good description that is the right length for clickability.",
    });
    expect(ctr.score).toBeGreaterThan(0);
    expect(ctr.score).toBeLessThanOrEqual(100);
    expect(["Low", "Fair", "Good", "Excellent"]).toContain(ctr.label);
  });
  it("boosts score for rich result", () => {
    const noRich = estimateCtr({ title: "T", url: "https://example.com", description: "D" });
    const withRich = estimateCtr({ title: "T", url: "https://example.com", description: "D", richResult: true });
    expect(withRich.score).toBeGreaterThan(noRich.score);
  });
  it("penalizes very long titles", () => {
    const short = estimateCtr({ title: "Good Title", url: "https://example.com", description: "D" });
    const long = estimateCtr({ title: "x".repeat(80), url: "https://example.com", description: "D" });
    expect(long.score).toBeLessThanOrEqual(short.score);
  });
  it("boosts score for optimal-length title and description", () => {
    const optimal = estimateCtr({
      title: "x".repeat(40),
      url: "https://example.com",
      description: "x".repeat(120),
    });
    expect(optimal.score).toBeGreaterThanOrEqual(80);
  });
});

describe("serp-snippet-preview history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, title: "T1", url: "https://x.com" });
    saveHistory({ ts: 2, title: "T2", url: "https://y.com" });
    expect(loadHistory()).toHaveLength(2);
    expect(loadHistory()[0].title).toBe("T2");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, title: "T", url: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, title: "T", url: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("serp-snippet-preview shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ title: "T", url: "https://example.com", description: "D" });
    expect(url).toContain("title=T");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to input", () => {
    const parsed = parseShareUrl("title=Hello&url=https%3A%2F%2Fexample.com");
    expect(parsed.title).toBe("Hello");
    expect(parsed.url).toBe("https://example.com");
  });
  it("parses boolean richResult correctly", () => {
    const parsed = parseShareUrl("title=T&richResult=1");
    expect(parsed.richResult).toBe(true);
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("omits empty fields", () => {
    const url = buildShareUrl({ title: "T", url: "https://example.com", description: "" });
    expect(url).toContain("title=T");
    expect(url).not.toContain("description=");
  });
});
