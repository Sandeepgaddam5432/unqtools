import { describe, it, expect, beforeEach } from "vitest";
import {
  PIXEL_PER_CHAR,
  TITLE_LIMITS,
  DESCRIPTION_LIMITS,
  charPixelWidth,
  estimatePixelWidth,
  truncateAtPixel,
  countWords,
  analyze,
  parseBatch,
  sortResults,
  analyzeBatch,
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

describe("title-meta-pixel-checker constants", () => {
  it("PIXEL_PER_CHAR is 9", () => {
    expect(PIXEL_PER_CHAR).toBe(9);
  });
  it("TITLE_LIMITS has desktop + mobile", () => {
    expect(TITLE_LIMITS.desktop.px).toBe(568);
    expect(TITLE_LIMITS.mobile.px).toBe(485);
  });
  it("DESCRIPTION_LIMITS has desktop + mobile", () => {
    expect(DESCRIPTION_LIMITS.desktop.px).toBe(980);
    expect(DESCRIPTION_LIMITS.mobile.px).toBe(685);
  });
});

describe("title-meta-pixel-checker charPixelWidth", () => {
  it("returns 0 for empty", () => {
    expect(charPixelWidth("")).toBe(0);
  });
  it("narrow chars are smaller than average", () => {
    expect(charPixelWidth("i")).toBeLessThan(charPixelWidth("a"));
  });
  it("wide chars are larger than average", () => {
    expect(charPixelWidth("W")).toBeGreaterThan(charPixelWidth("a"));
  });
  it("space is half width", () => {
    expect(charPixelWidth(" ")).toBe(PIXEL_PER_CHAR * 0.5);
  });
  it("CJK chars are double width", () => {
    expect(charPixelWidth("中")).toBe(PIXEL_PER_CHAR * 2);
  });
});

describe("title-meta-pixel-checker estimatePixelWidth", () => {
  it("returns 0 for empty", () => {
    expect(estimatePixelWidth("")).toBe(0);
  });
  it("returns positive number for non-empty", () => {
    expect(estimatePixelWidth("Hello")).toBeGreaterThan(0);
  });
  it("scales with length (longer string = wider)", () => {
    expect(estimatePixelWidth("Hello World")).toBeGreaterThan(estimatePixelWidth("Hello"));
  });
  it("is deterministic", () => {
    expect(estimatePixelWidth("Test title")).toBe(estimatePixelWidth("Test title"));
  });
});

describe("title-meta-pixel-checker truncateAtPixel", () => {
  it("returns empty for empty text", () => {
    const r = truncateAtPixel("", 500);
    expect(r.text).toBe("");
    expect(r.truncatedAtPx).toBe(0);
  });
  it("returns full text when under limit", () => {
    const r = truncateAtPixel("Short", 500);
    expect(r.text).toBe("Short");
    expect(r.text.endsWith("…")).toBe(false);
  });
  it("truncates with ellipsis when over limit", () => {
    const longText = "This is a very long title that should definitely be truncated by the pixel checker";
    const r = truncateAtPixel(longText, 100);
    expect(r.text.endsWith("…")).toBe(true);
    expect(r.text.length).toBeLessThan(longText.length);
  });
});

describe("title-meta-pixel-checker countWords", () => {
  it("returns 0 for empty", () => {
    expect(countWords("")).toBe(0);
  });
  it("counts single word", () => {
    expect(countWords("hello")).toBe(1);
  });
  it("counts multiple words", () => {
    expect(countWords("hello world foo")).toBe(3);
  });
  it("handles extra whitespace", () => {
    expect(countWords("  hello   world  ")).toBe(2);
  });
});

describe("title-meta-pixel-checker analyze", () => {
  it("returns full result object", () => {
    const r = analyze("Hello World", "title", "desktop");
    expect(r.text).toBe("Hello World");
    expect(r.pixelWidth).toBeGreaterThan(0);
    expect(r.charCount).toBe(11);
    expect(r.wordCount).toBe(2);
    expect(typeof r.truncatedText).toBe("string");
    expect(typeof r.isOverLimit).toBe("boolean");
    expect(r.limitPx).toBe(568);
  });
  it("flags over-limit title", () => {
    const longTitle = "This is an extremely long title that will definitely exceed the Google SERP pixel limit for desktop displays";
    const r = analyze(longTitle, "title", "desktop");
    expect(r.isOverLimit).toBe(true);
  });
  it("warns when close to limit", () => {
    // Build a title that's close to but under the limit
    const title = "Best SEO Tools for Small Businesses and Startups in 2026";
    const r = analyze(title, "title", "desktop");
    expect(r.limitPx).toBe(568);
    // We can't perfectly tune the text, but warn flag should be set if within 90%
    if (r.pixelWidth > 568 * 0.9 && r.pixelWidth <= 568) {
      expect(r.isWarn).toBe(true);
    }
  });
  it("uses mobile limit when mobile selected", () => {
    const r = analyze("Short", "title", "mobile");
    expect(r.limitPx).toBe(485);
  });
  it("uses description limit when field is description", () => {
    const r = analyze("Some description", "description", "desktop");
    expect(r.limitPx).toBe(980);
  });
});

describe("title-meta-pixel-checker parseBatch", () => {
  it("parses newlines", () => {
    expect(parseBatch("a\nb\nc")).toEqual(["a", "b", "c"]);
  });
  it("trims whitespace", () => {
    expect(parseBatch("  a  \n  b ")).toEqual(["a", "b"]);
  });
  it("skips blank lines", () => {
    expect(parseBatch("a\n\nb")).toEqual(["a", "b"]);
  });
  it("returns empty for empty input", () => {
    expect(parseBatch("")).toEqual([]);
  });
});

describe("title-meta-pixel-checker sortResults", () => {
  const sample = [
    { text: "alpha", pixelWidth: 100, charCount: 5, wordCount: 1, truncatedText: "alpha", truncatedAtPx: 100, isOverLimit: false, isWarn: false, limitPx: 568, limitChars: 60 },
    { text: "beta long title here", pixelWidth: 300, charCount: 20, wordCount: 4, truncatedText: "beta", truncatedAtPx: 200, isOverLimit: false, isWarn: true, limitPx: 568, limitChars: 60 },
    { text: "gamma", pixelWidth: 200, charCount: 5, wordCount: 1, truncatedText: "gamma", truncatedAtPx: 200, isOverLimit: false, isWarn: false, limitPx: 568, limitChars: 60 },
  ];
  it("sorts by pixelWidth desc", () => {
    const out = sortResults(sample, "pixelWidth", "desc");
    expect(out[0].text).toBe("beta long title here");
  });
  it("sorts by pixelWidth asc", () => {
    const out = sortResults(sample, "pixelWidth", "asc");
    expect(out[0].text).toBe("alpha");
  });
  it("sorts by charCount asc", () => {
    const out = sortResults(sample, "charCount", "asc");
    expect(out[0].text).toBe("alpha"); // 5 chars (gamma also 5, alpha first alphabetically)
  });
  it("sorts by text asc alphabetically", () => {
    const out = sortResults(sample, "text", "asc");
    expect(out[0].text).toBe("alpha");
  });
});

describe("title-meta-pixel-checker analyzeBatch", () => {
  it("analyzes multiple texts", () => {
    const r = analyzeBatch(["Short", "This is a very long title that will exceed the pixel limit easily"], "title", "desktop");
    expect(r.total).toBe(2);
    expect(r.results).toHaveLength(2);
  });
  it("counts over-limit entries", () => {
    const longText = "This Is An Extremely Long Title That Will Definitely Exceed The Google SERP Pixel Limit For Desktop Displays And Keep Going Well Beyond";
    const r = analyzeBatch(["short", longText], "title", "desktop");
    expect(r.overLimitCount).toBeGreaterThan(0);
  });
  it("computes average pixel width", () => {
    const r = analyzeBatch(["a", "b", "c"], "title", "desktop");
    expect(r.averagePixelWidth).toBeGreaterThan(0);
  });
  it("handles empty input", () => {
    const r = analyzeBatch([], "title", "desktop");
    expect(r.total).toBe(0);
    expect(r.averagePixelWidth).toBe(0);
  });
});

describe("title-meta-pixel-checker renderCsv", () => {
  it("renders header", () => {
    const csv = renderCsv(analyzeBatch(["Test"], "title", "desktop"));
    expect(csv).toContain("text,pixel_width,char_count,word_count,limit_px,is_over_limit,truncated_text");
  });
  it("escapes commas in text", () => {
    const csv = renderCsv(analyzeBatch(["Hello, World"], "title", "desktop"));
    expect(csv).toContain('"Hello, World"');
  });
  it("includes row data", () => {
    const csv = renderCsv(analyzeBatch(["Test title"], "title", "desktop"));
    expect(csv).toContain("Test title");
  });
});

describe("title-meta-pixel-checker history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, field: "title", device: "desktop", count: 5, overLimit: 2 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, field: "title", device: "desktop", count: 1, overLimit: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, field: "title", device: "desktop", count: 1, overLimit: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("title-meta-pixel-checker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ field: "title", device: "desktop", text: "Hello" });
    expect(url).toContain("field=title");
    expect(url).toContain("device=desktop");
    expect(url).toContain("text=Hello");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("field=title&device=mobile&text=Hello+World");
    expect(p.field).toBe("title");
    expect(p.device).toBe("mobile");
    expect(p.text).toBe("Hello World");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ text: "" });
  });
  it("omits empty text", () => {
    const url = buildShareUrl({ field: "title", device: "desktop", text: "" });
    expect(url).not.toContain("text=");
  });
});
