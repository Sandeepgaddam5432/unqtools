import { describe, it, expect, beforeEach } from "vitest";
import {
  SCHEMA_TEMPLATES,
  SCHEMA_TYPES,
  validateValues,
  buildJsonLd,
  buildScriptTag,
  generateSchema,
  generateMultiSchema,
  getRequiredFields,
  buildGoogleRichResultsLink,
  buildSchemaDocsLink,
  isValidUrl,
  isValidIsoDate,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SchemaType,
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

describe("schema-jsonld-generator templates", () => {
  it("includes all 12 schema types", () => {
    expect(SCHEMA_TYPES).toHaveLength(12);
    expect(SCHEMA_TYPES).toContain("Article");
    expect(SCHEMA_TYPES).toContain("FAQPage");
    expect(SCHEMA_TYPES).toContain("HowTo");
  });
  it("each template has at least one required field", () => {
    for (const t of SCHEMA_TYPES) {
      const req = getRequiredFields(t);
      expect(req.length).toBeGreaterThan(0);
    }
  });
});

describe("schema-jsonld-generator URL/date validators", () => {
  it("isValidUrl accepts https", () => {
    expect(isValidUrl("https://example.com/x")).toBe(true);
  });
  it("isValidUrl rejects bad strings", () => {
    expect(isValidUrl("not a url")).toBe(false);
  });
  it("isValidIsoDate accepts YYYY-MM-DD", () => {
    expect(isValidIsoDate("2026-01-01")).toBe(true);
  });
  it("isValidIsoDate accepts YYYY-MM-DDTHH:mm", () => {
    expect(isValidIsoDate("2026-01-01T10:30")).toBe(true);
  });
  it("isValidIsoDate rejects bad strings", () => {
    expect(isValidIsoDate("January 1 2026")).toBe(false);
  });
});

describe("schema-jsonld-generator validateValues", () => {
  it("errors on missing required Article fields", () => {
    const r = validateValues("Article", {});
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /headline/i.test(e))).toBe(true);
  });
  it("passes with all required Article fields", () => {
    const r = validateValues("Article", {
      headline: "Hello",
      image: "https://example.com/i.jpg",
      datePublished: "2026-01-01",
      author: "Jane",
      publisher: "Example",
    });
    expect(r.ok).toBe(true);
  });
  it("errors on invalid URL field", () => {
    const r = validateValues("Article", {
      headline: "T",
      image: "not-a-url",
      datePublished: "2026-01-01",
      author: "Jane",
      publisher: "Example",
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /image/i.test(e))).toBe(true);
  });
  it("errors on invalid date", () => {
    const r = validateValues("Article", {
      headline: "T",
      image: "https://example.com/i.jpg",
      datePublished: "not-a-date",
      author: "Jane",
      publisher: "Example",
    });
    expect(r.ok).toBe(false);
  });
  it("warns on non-numeric price", () => {
    const r = validateValues("Product", {
      name: "P",
      image: "https://example.com/i.jpg",
      brand: "B",
      price: "free",
      priceCurrency: "USD",
    });
    expect(r.warnings.some((w) => /numeric/i.test(w))).toBe(true);
  });
});

describe("schema-jsonld-generator buildJsonLd", () => {
  it("builds Article with @context and @type", () => {
    const out = buildJsonLd("Article", {
      headline: "Hello",
      image: "https://example.com/i.jpg",
      datePublished: "2026-01-01",
      author: "Jane",
      publisher: "Example",
    });
    expect(out["@context"]).toBe("https://schema.org");
    expect(out["@type"]).toBe("Article");
    expect(out.headline).toBe("Hello");
  });
  it("wraps author in Person/Organization object", () => {
    const out = buildJsonLd("Article", {
      headline: "T",
      image: "https://example.com/i.jpg",
      datePublished: "2026-01-01",
      author: "Jane",
      publisher: "Example",
    }) as Record<string, { name: string }>;
    expect(out.author).toEqual({ "@type": "Organization", name: "Jane" });
  });
  it("builds FAQPage with mainEntity array", () => {
    const out = buildJsonLd("FAQPage", {
      faqs: "What is X?|X is Y\nHow does Z work?|Z works like this",
    }) as Record<string, unknown[]>;
    expect(Array.isArray(out.mainEntity)).toBe(true);
    expect(out.mainEntity).toHaveLength(2);
  });
  it("builds BreadcrumbList with itemListElement", () => {
    const out = buildJsonLd("BreadcrumbList", {
      breadcrumbs: "Home|https://example.com\nBlog|https://example.com/blog",
    }) as Record<string, unknown[]>;
    expect(Array.isArray(out.itemListElement)).toBe(true);
    expect(out.itemListElement).toHaveLength(2);
  });
  it("builds HowTo with step array", () => {
    const out = buildJsonLd("HowTo", {
      name: "Cook",
      steps: "Step 1\nStep 2\nStep 3",
    }) as Record<string, unknown[]>;
    expect(out.step).toHaveLength(3);
  });
  it("builds Recipe with recipeIngredient array", () => {
    const out = buildJsonLd("Recipe", {
      name: "Soup",
      image: "https://example.com/soup.jpg",
      author: "Jane",
      datePublished: "2026-01-01",
      recipeIngredients: "salt, pepper, water",
      recipeInstructions: "boil water; add salt; add pepper",
    }) as Record<string, string[]>;
    expect(out.recipeIngredient).toHaveLength(3);
    expect(out.recipeInstructions).toHaveLength(3);
  });
  it("coerces numeric price to number", () => {
    const out = buildJsonLd("Product", {
      name: "P",
      image: "https://example.com/i.jpg",
      brand: "B",
      price: "19.99",
      priceCurrency: "USD",
    }) as Record<string, unknown>;
    expect(out.price).toBe(19.99);
  });
  it("merges custom properties", () => {
    const out = buildJsonLd(
      "Product",
      {
        name: "P",
        image: "https://example.com/i.jpg",
        brand: "B",
        price: "10",
        priceCurrency: "USD",
      },
      { sku: "ABC123", color: "red" },
    ) as Record<string, unknown>;
    expect(out.sku).toBe("ABC123");
    expect(out.color).toBe("red");
  });
  it("throws on invalid input", () => {
    expect(() => buildJsonLd("Article", {})).toThrow();
  });
});

describe("schema-jsonld-generator buildScriptTag", () => {
  it("wraps JSON in script tag", () => {
    const tag = buildScriptTag({ "@context": "https://schema.org", "@type": "Thing" });
    expect(tag.startsWith('<script type="application/ld+json">')).toBe(true);
    expect(tag.endsWith("</script>")).toBe(true);
  });
  it("produces valid JSON inside the tag", () => {
    const tag = buildScriptTag({ hello: "world" });
    const json = tag.replace(/<\/?script[^>]*>/g, "").trim();
    expect(JSON.parse(json)).toEqual({ hello: "world" });
  });
});

describe("schema-jsonld-generator generateSchema", () => {
  it("returns a complete script tag string", () => {
    const out = generateSchema("Article", {
      headline: "T",
      image: "https://example.com/i.jpg",
      datePublished: "2026-01-01",
      author: "Jane",
      publisher: "Example",
    });
    expect(out).toContain("Article");
    expect(out).toContain("T");
  });
});

describe("schema-jsonld-generator generateMultiSchema", () => {
  it("wraps multiple schemas in @graph", () => {
    const out = generateMultiSchema([
      {
        type: "Article",
        values: {
          headline: "T",
          image: "https://example.com/i.jpg",
          datePublished: "2026-01-01",
          author: "Jane",
          publisher: "Example",
        },
      },
      {
        type: "Organization",
        values: {
          name: "Example",
          url: "https://example.com",
          logo: "https://example.com/logo.png",
        },
      },
    ]);
    expect(out).toContain("@graph");
    expect(out).toContain("Article");
    expect(out).toContain("Organization");
  });
  it("throws on empty array", () => {
    expect(() => generateMultiSchema([])).toThrow();
  });
});

describe("schema-jsonld-generator links", () => {
  it("builds Google Rich Results test link", () => {
    const link = buildGoogleRichResultsLink("https://example.com");
    expect(link).toContain("search.google.com/test/rich-results");
    expect(link).toContain(encodeURIComponent("https://example.com"));
  });
  it("builds schema.org docs link per type", () => {
    expect(buildSchemaDocsLink("Article")).toBe("https://schema.org/Article");
    expect(buildSchemaDocsLink("FAQPage")).toBe("https://schema.org/FAQPage");
  });
});

describe("schema-jsonld-generator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, type: "Article", snippet: "x" });
    saveHistory({ ts: 2, type: "Product", snippet: "y" });
    expect(loadHistory()).toHaveLength(2);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, type: "Article", snippet: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, type: "Article", snippet: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("schema-jsonld-generator shareable URL", () => {
  it("builds share URL with type and values", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("Article", { headline: "Hello", author: "Jane" });
    expect(url).toContain("type=Article");
    expect(url).toContain("headline=Hello");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to type and values", () => {
    const { type, values } = parseShareUrl("type=Article&headline=Hello");
    expect(type).toBe("Article");
    expect(values.headline).toBe("Hello");
  });
  it("returns empty values for empty hash", () => {
    expect(parseShareUrl("")).toEqual({ values: {} });
  });
  it("omits empty values when building", () => {
    const url = buildShareUrl("Product", { name: "P", brand: "" });
    expect(url).toContain("name=P");
    expect(url).not.toContain("brand=");
  });
});
