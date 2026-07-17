import { describe, it, expect, beforeEach } from "vitest";
import {
  validateItem,
  validateInput,
  parseBulkItems,
  buildJsonLd,
  buildScriptTag,
  generateBreadcrumbSchema,
  generateMultiBreadcrumb,
  renderPreview,
  buildGoogleRichResultsLink,
  buildSchemaDocsLink,
  moveItem,
  moveUp,
  moveDown,
  isValidUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  NAME_MAX,
  MIN_ITEMS,
  type BreadcrumbInput,
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

describe("breadcrumb-schema-generator isValidUrl", () => {
  it("accepts http(s) URLs", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("http://example.com")).toBe(true);
  });
  it("rejects malformed URLs", () => {
    expect(isValidUrl("not-a-url")).toBe(false);
    expect(isValidUrl("ftp://example.com")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
});

describe("breadcrumb-schema-generator validateItem", () => {
  it("errors on empty name", () => {
    const r = validateItem({ name: "", url: "https://example.com" }, 0);
    expect(r.errors.some((e) => /name/i.test(e))).toBe(true);
  });
  it("errors on empty URL", () => {
    const r = validateItem({ name: "Home", url: "" }, 0);
    expect(r.errors.some((e) => /url/i.test(e))).toBe(true);
  });
  it("errors on invalid URL", () => {
    const r = validateItem({ name: "Home", url: "not-a-url" }, 0);
    expect(r.errors.some((e) => /invalid/i.test(e))).toBe(true);
  });
  it("warns on long name", () => {
    const r = validateItem({ name: "x".repeat(NAME_MAX + 10), url: "https://example.com" }, 0);
    expect(r.warnings.some((w) => /long/i.test(w))).toBe(true);
  });
  it("passes for valid item", () => {
    const r = validateItem({ name: "Home", url: "https://example.com" }, 0);
    expect(r.errors).toHaveLength(0);
  });
});

describe("breadcrumb-schema-generator validateInput", () => {
  it("errors on empty items", () => {
    const r = validateInput({ items: [] });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /at least one/i.test(e))).toBe(true);
  });
  it("warns when fewer than min items", () => {
    const r = validateInput({ items: [{ name: "Home", url: "https://example.com" }] });
    expect(r.errors.some((e) => /2 breadcrumb items/i.test(e))).toBe(true);
  });
  it("passes with at least 2 valid items", () => {
    const r = validateInput({
      items: [
        { name: "Home", url: "https://example.com" },
        { name: "Blog", url: "https://example.com/blog" },
      ],
    });
    expect(r.ok).toBe(true);
  });
  it("warns on duplicate URLs", () => {
    const r = validateInput({
      items: [
        { name: "Home", url: "https://example.com" },
        { name: "Home2", url: "https://example.com" },
      ],
    });
    expect(r.warnings.some((w) => /duplicate/i.test(w))).toBe(true);
  });
  it("aggregates errors across items", () => {
    const r = validateInput({
      items: [
        { name: "", url: "" },
        { name: "Home", url: "https://example.com" },
      ],
    });
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe("breadcrumb-schema-generator parseBulkItems", () => {
  it("parses pipe-separated", () => {
    const out = parseBulkItems("Home | https://example.com\nBlog | https://example.com/blog");
    expect(out).toHaveLength(2);
    expect(out[0].name).toBe("Home");
    expect(out[0].url).toBe("https://example.com");
  });
  it("parses comma-separated when URL valid", () => {
    const out = parseBulkItems("Home, https://example.com");
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Home");
    expect(out[0].url).toBe("https://example.com");
  });
  it("parses tab-separated", () => {
    const out = parseBulkItems("Home\thttps://example.com");
    expect(out).toHaveLength(1);
  });
  it("parses space-separated with URL detection", () => {
    const out = parseBulkItems("Home https://example.com");
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Home");
  });
  it("returns empty for empty input", () => {
    expect(parseBulkItems("")).toEqual([]);
    expect(parseBulkItems("   ")).toEqual([]);
  });
  it("skips invalid lines", () => {
    const out = parseBulkItems("Just a name\nHome | https://example.com");
    expect(out).toHaveLength(1);
  });
});

describe("breadcrumb-schema-generator buildJsonLd", () => {
  it("produces BreadcrumbList with @context and @type", () => {
    const out = buildJsonLd({
      items: [
        { name: "Home", url: "https://example.com" },
        { name: "Blog", url: "https://example.com/blog" },
      ],
    }) as Record<string, unknown>;
    expect(out["@context"]).toBe("https://schema.org");
    expect(out["@type"]).toBe("BreadcrumbList");
  });
  it("builds itemListElement array with positions", () => {
    const out = buildJsonLd({
      items: [
        { name: "Home", url: "https://example.com" },
        { name: "Blog", url: "https://example.com/blog" },
      ],
    }) as { itemListElement: Array<{ position: number; name: string }> };
    expect(out.itemListElement).toHaveLength(2);
    expect(out.itemListElement[0].position).toBe(1);
    expect(out.itemListElement[1].position).toBe(2);
  });
  it("throws on invalid input", () => {
    expect(() => buildJsonLd({ items: [] })).toThrow();
  });
});

describe("breadcrumb-schema-generator buildScriptTag", () => {
  it("wraps JSON in script tag", () => {
    const tag = buildScriptTag({ "@type": "BreadcrumbList" });
    expect(tag.startsWith('<script type="application/ld+json">')).toBe(true);
    expect(tag.endsWith("</script>")).toBe(true);
  });
  it("contains valid JSON inside", () => {
    const tag = buildScriptTag({ hello: "world" });
    const json = tag.replace(/<\/?script[^>]*>/g, "").trim();
    expect(JSON.parse(json)).toEqual({ hello: "world" });
  });
});

describe("breadcrumb-schema-generator generateBreadcrumbSchema", () => {
  it("returns a complete script tag string", () => {
    const out = generateBreadcrumbSchema({
      items: [
        { name: "Home", url: "https://example.com" },
        { name: "Blog", url: "https://example.com/blog" },
      ],
    });
    expect(out).toContain("BreadcrumbList");
    expect(out).toContain("https://example.com");
  });
});

describe("breadcrumb-schema-generator generateMultiBreadcrumb", () => {
  it("wraps multiple BreadcrumbList blocks in @graph", () => {
    const out = generateMultiBreadcrumb([
      { items: [{ name: "A", url: "https://example.com/a" }, { name: "B", url: "https://example.com/b" }] },
      { items: [{ name: "C", url: "https://example.com/c" }, { name: "D", url: "https://example.com/d" }] },
    ]);
    expect(out).toContain("@graph");
    expect(out).toContain("A");
    expect(out).toContain("C");
  });
  it("throws on empty array", () => {
    expect(() => generateMultiBreadcrumb([])).toThrow();
  });
});

describe("breadcrumb-schema-generator renderPreview", () => {
  it("renders breadcrumb trail joined by ›", () => {
    const preview = renderPreview({
      items: [
        { name: "Home", url: "https://example.com" },
        { name: "Blog", url: "https://example.com/blog" },
        { name: "Post", url: "https://example.com/blog/post" },
      ],
    });
    expect(preview).toContain("›");
    expect(preview).toContain("Home");
    expect(preview).toContain("Post");
  });
  it("returns empty for no items", () => {
    expect(renderPreview({ items: [] })).toBe("");
  });
});

describe("breadcrumb-schema-generator links and utils", () => {
  it("builds Google Rich Results link", () => {
    const link = buildGoogleRichResultsLink("https://example.com");
    expect(link).toContain("search.google.com/test/rich-results");
  });
  it("builds Schema.org docs link", () => {
    expect(buildSchemaDocsLink()).toContain("schema.org/BreadcrumbList");
  });
});

describe("breadcrumb-schema-generator reorder", () => {
  const items = [
    { name: "A", url: "https://example.com/a" },
    { name: "B", url: "https://example.com/b" },
    { name: "C", url: "https://example.com/c" },
  ];
  it("moves item up", () => {
    const moved = moveUp(items, 1);
    expect(moved[0].name).toBe("B");
    expect(moved[1].name).toBe("A");
  });
  it("moves item down", () => {
    const moved = moveDown(items, 0);
    expect(moved[0].name).toBe("B");
    expect(moved[1].name).toBe("A");
  });
  it("no-op when moving first up", () => {
    const moved = moveUp(items, 0);
    expect(moved[0].name).toBe("A");
  });
  it("no-op when moving last down", () => {
    const moved = moveDown(items, 2);
    expect(moved[2].name).toBe("C");
  });
  it("moveItem with invalid indexes returns same array", () => {
    expect(moveItem(items, -1, 0)).toEqual(items);
    expect(moveItem(items, 0, 99)).toEqual(items);
  });
});

describe("breadcrumb-schema-generator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, itemCount: 2, snippet: "x", preview: "Home › Blog" });
    saveHistory({ ts: 2, itemCount: 3, snippet: "y", preview: "Home › Blog › Post" });
    expect(loadHistory()).toHaveLength(2);
    expect(loadHistory()[0].itemCount).toBe(3);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, itemCount: 1, snippet: "x", preview: "p" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, itemCount: 1, snippet: "x", preview: "p" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("breadcrumb-schema-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      items: [{ name: "Home", url: "https://example.com" }],
    });
    expect(url).toContain("items=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to items", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      items: [
        { name: "Home", url: "https://example.com" },
        { name: "Blog", url: "https://example.com/blog" },
      ],
    });
    const hash = url.replace(/^\?/, "#");
    const parsed = parseShareUrl(hash) as BreadcrumbInput;
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items?.[0].name).toBe("Home");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("returns empty for malformed JSON", () => {
    expect(parseShareUrl("items=notjson")).toEqual({});
  });
  it("returns empty when items is not an array", () => {
    expect(parseShareUrl("items=%7B%7D")).toEqual({});
  });
});
