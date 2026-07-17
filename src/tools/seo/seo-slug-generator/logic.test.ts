import { describe, it, expect, beforeEach } from "vitest";
import {
  STOP_WORDS,
  stripDiacritics,
  tokenize,
  filterStopWords,
  generateSlug,
  validateSlug,
  computeStats,
  buildUrlPreview,
  generateBatch,
  renderBatchCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SlugOptions,
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

describe("seo-slug-generator stripDiacritics", () => {
  it("strips accents", () => {
    expect(stripDiacritics("café")).toBe("cafe");
  });
  it("strips umlauts", () => {
    expect(stripDiacritics("über")).toBe("uber");
  });
  it("returns empty for empty input", () => {
    expect(stripDiacritics("")).toBe("");
  });
});

describe("seo-slug-generator tokenize", () => {
  it("splits on non-alphanumeric", () => {
    expect(tokenize("Hello, World!")).toEqual(["Hello", "World"]);
  });
  it("returns empty array for empty input", () => {
    expect(tokenize("")).toEqual([]);
  });
  it("handles numbers", () => {
    expect(tokenize("top 10 tools")).toEqual(["top", "10", "tools"]);
  });
});

describe("seo-slug-generator filterStopWords", () => {
  it("removes stop words", () => {
    expect(filterStopWords(["the", "best", "of", "tools"])).toEqual(["best", "tools"]);
  });
  it("preserves all words if no stop words", () => {
    expect(filterStopWords(["hello", "world"])).toEqual(["hello", "world"]);
  });
  it("STOP_WORDS contains common words", () => {
    expect(STOP_WORDS.has("the")).toBe(true);
    expect(STOP_WORDS.has("a")).toBe(true);
  });
});

describe("seo-slug-generator generateSlug", () => {
  it("generates basic slug", () => {
    expect(generateSlug("Hello World")).toBe("hello-world");
  });
  it("removes stop words by default", () => {
    expect(generateSlug("The Best of Tools")).toBe("best-tools");
  });
  it("preserves stop words when option off", () => {
    expect(generateSlug("The Best of Tools", { removeStopWords: false })).toBe("the-best-of-tools");
  });
  it("uses underscore separator", () => {
    expect(generateSlug("Hello World", { separator: "_" })).toBe("hello_world");
  });
  it("strips diacritics by default", () => {
    expect(generateSlug("Café Résumé")).toBe("cafe-resume");
  });
  it("respects max length without cutting words", () => {
    const slug = generateSlug("A Very Long Title About Many Things To Discuss", { maxLength: 20 });
    expect(slug.length).toBeLessThanOrEqual(20);
    expect(slug.endsWith("-")).toBe(false);
  });
  it("returns empty for empty input", () => {
    expect(generateSlug("")).toBe("");
  });
  it("returns empty when only stop words", () => {
    expect(generateSlug("the of a an")).toBe("");
  });
  it("handles special characters", () => {
    expect(generateSlug("Hello! @World #123")).toBe("hello-world-123");
  });
  it("preserves case when lower=false", () => {
    expect(generateSlug("Hello World", { lower: false })).toBe("Hello-World");
  });
  it("trims leading/trailing separators", () => {
    expect(generateSlug("!!! Hello World !!!")).toBe("hello-world");
  });
});

describe("seo-slug-generator validateSlug", () => {
  it("accepts valid slug", () => {
    const r = validateSlug("hello-world");
    expect(r.ok).toBe(true);
    expect(r.issues).toHaveLength(0);
  });
  it("rejects uppercase", () => {
    const r = validateSlug("Hello-World");
    expect(r.ok).toBe(false);
    expect(r.issues.some((s) => /uppercase/i.test(s))).toBe(true);
  });
  it("rejects special chars", () => {
    const r = validateSlug("hello@world");
    expect(r.ok).toBe(false);
    expect(r.issues.some((s) => /special/i.test(s))).toBe(true);
  });
  it("rejects empty", () => {
    const r = validateSlug("");
    expect(r.ok).toBe(false);
  });
  it("rejects consecutive separators", () => {
    const r = validateSlug("hello--world");
    expect(r.ok).toBe(false);
    expect(r.issues.some((s) => /consecutive/i.test(s))).toBe(true);
  });
});

describe("seo-slug-generator computeStats", () => {
  it("computes stats correctly", () => {
    const s = computeStats("hello-world-123");
    expect(s.length).toBe(15);
    expect(s.wordCount).toBe(3);
    expect(s.alphaCount).toBe(10);
    expect(s.digitCount).toBe(3);
    expect(s.sepCount).toBe(2);
    expect(s.isLowercase).toBe(true);
    expect(s.hasInvalidChars).toBe(false);
  });
  it("flags uppercase", () => {
    expect(computeStats("Hello").isLowercase).toBe(false);
  });
  it("flags invalid chars", () => {
    expect(computeStats("hello@world").hasInvalidChars).toBe(true);
  });
  it("handles empty slug", () => {
    const s = computeStats("");
    expect(s.length).toBe(0);
    expect(s.wordCount).toBe(0);
  });
});

describe("seo-slug-generator buildUrlPreview", () => {
  it("builds URL with no trailing slash", () => {
    expect(buildUrlPreview("hello-world", "https://example.com", false)).toBe(
      "https://example.com/hello-world",
    );
  });
  it("builds URL with trailing slash", () => {
    expect(buildUrlPreview("hello-world", "https://example.com", true)).toBe(
      "https://example.com/hello-world/",
    );
  });
  it("uses default domain if empty", () => {
    expect(buildUrlPreview("hello", "", false)).toContain("example.com");
  });
  it("strips trailing slashes from domain", () => {
    expect(buildUrlPreview("hello", "https://example.com///", false)).toBe(
      "https://example.com/hello",
    );
  });
  it("returns empty for empty slug", () => {
    expect(buildUrlPreview("", "https://example.com", false)).toBe("");
  });
});

describe("seo-slug-generator generateBatch", () => {
  it("generates slugs for multiple titles", () => {
    const rows = generateBatch("Hello World\nThe Best Tools\n");
    expect(rows).toHaveLength(2);
    expect(rows[0].slug).toBe("hello-world");
    expect(rows[1].slug).toBe("best-tools");
  });
  it("handles empty input", () => {
    expect(generateBatch("")).toEqual([]);
  });
  it("skips blank lines", () => {
    expect(generateBatch("a\n\nb\n\n")).toHaveLength(2);
  });
});

describe("seo-slug-generator renderBatchCsv", () => {
  it("renders CSV with header", () => {
    const csv = renderBatchCsv([
      { title: "Hello, World", slug: "hello-world" },
      { title: "Foo", slug: "foo" },
    ]);
    expect(csv).toContain("title,slug");
    expect(csv).toContain('"Hello, World",hello-world');
  });
  it("escapes quotes", () => {
    const csv = renderBatchCsv([{ title: 'Say "Hi"', slug: "say-hi" }]);
    expect(csv).toContain('""Hi""');
  });
});

describe("seo-slug-generator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      title: "Hello",
      slug: "hello",
      separator: "-",
      maxLength: 75,
      removeStopWords: true,
    });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].slug).toBe("hello");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        title: `T${i}`,
        slug: `t${i}`,
        separator: "-",
        maxLength: 75,
        removeStopWords: true,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      title: "x",
      slug: "x",
      separator: "-",
      maxLength: 75,
      removeStopWords: true,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("seo-slug-generator shareable URL", () => {
  const opts: SlugOptions = { separator: "-", maxLength: 75, removeStopWords: true };
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ title: "Hello World", domain: "https://example.com", options: opts });
    expect(url).toContain("title=Hello+World");
    expect(url).toContain("separator=-");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to input", () => {
    const parsed = parseShareUrl("title=Hello+World&domain=https%3A%2F%2Fexample.com&separator=-&removeStopWords=1");
    expect(parsed.title).toBe("Hello World");
    expect(parsed.domain).toBe("https://example.com");
    expect(parsed.options.separator).toBe("-");
    expect(parsed.options.removeStopWords).toBe(true);
  });
  it("parses trailing slash", () => {
    const parsed = parseShareUrl("title=x&trailingSlash=1");
    expect(parsed.trailingSlash).toBe(true);
  });
  it("parses underscore separator", () => {
    const parsed = parseShareUrl("title=x&separator=_");
    expect(parsed.options.separator).toBe("_");
  });
  it("handles empty hash", () => {
    const parsed = parseShareUrl("");
    expect(parsed.title).toBe("");
    expect(parsed.trailingSlash).toBe(false);
  });
  it("parses maxLength", () => {
    const parsed = parseShareUrl("title=x&maxLength=50");
    expect(parsed.options.maxLength).toBe(50);
  });
});
