import { describe, it, expect, beforeEach } from "vitest";
import {
  SUPPORTED_TYPES,
  SCHEMA_SPECS,
  stripScriptTag,
  detectType,
  isPresent,
  isValidUrl,
  isValidIsoDate,
  isValidNumber,
  validateSchema,
  validate,
  getRequiredFields,
  getRecommendedFields,
  buildGoogleRichResultsLink,
  buildSchemaDocsLink,
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

describe("structured-data-validator constants", () => {
  it("has 12 supported types", () => {
    expect(SUPPORTED_TYPES.length).toBe(12);
    expect(SUPPORTED_TYPES).toContain("Article");
    expect(SUPPORTED_TYPES).toContain("Product");
    expect(SUPPORTED_TYPES).toContain("FAQPage");
  });
  it("each spec has fields", () => {
    for (const t of SUPPORTED_TYPES) {
      expect(SCHEMA_SPECS[t].fields.length).toBeGreaterThan(0);
    }
  });
});

describe("structured-data-validator stripScriptTag", () => {
  it("returns input as-is when no script tag", () => {
    expect(stripScriptTag('{"@type":"Article"}')).toBe('{"@type":"Article"}');
  });
  it("strips script wrapper", () => {
    const input = `<script type="application/ld+json">{"@type":"Article"}</script>`;
    expect(stripScriptTag(input)).toBe('{"@type":"Article"}');
  });
  it("returns empty for empty input", () => {
    expect(stripScriptTag("")).toBe("");
  });
});

describe("structured-data-validator detectType", () => {
  it("returns string @type", () => {
    expect(detectType({ "@type": "Article" })).toBe("Article");
  });
  it("returns first of array @type", () => {
    expect(detectType({ "@type": ["Article", "NewsArticle"] })).toBe("Article");
  });
  it("returns null when no @type", () => {
    expect(detectType({ name: "x" })).toBeNull();
  });
  it("returns null for non-object", () => {
    expect(detectType(null)).toBeNull();
    expect(detectType("string")).toBeNull();
  });
});

describe("structured-data-validator isPresent", () => {
  it("returns false for undefined/null", () => {
    expect(isPresent(undefined)).toBe(false);
    expect(isPresent(null)).toBe(false);
  });
  it("returns false for empty string", () => {
    expect(isPresent("")).toBe(false);
    expect(isPresent("  ")).toBe(false);
  });
  it("returns false for empty array/object", () => {
    expect(isPresent([])).toBe(false);
    expect(isPresent({})).toBe(false);
  });
  it("returns true for non-empty values", () => {
    expect(isPresent("x")).toBe(true);
    expect(isPresent([1])).toBe(true);
    expect(isPresent({ a: 1 })).toBe(true);
    expect(isPresent(42)).toBe(true);
  });
});

describe("structured-data-validator type validators", () => {
  it("isValidUrl — valid", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
  });
  it("isValidUrl — invalid", () => {
    expect(isValidUrl("nope")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
  it("isValidIsoDate — valid", () => {
    expect(isValidIsoDate("2026-01-15")).toBe(true);
    expect(isValidIsoDate("2026-01-15T10:30")).toBe(true);
  });
  it("isValidIsoDate — invalid", () => {
    expect(isValidIsoDate("Jan 15, 2026")).toBe(false);
    expect(isValidIsoDate("")).toBe(false);
  });
  it("isValidNumber — number type", () => {
    expect(isValidNumber(42)).toBe(true);
  });
  it("isValidNumber — string number", () => {
    expect(isValidNumber("42.5")).toBe(true);
  });
  it("isValidNumber — invalid", () => {
    expect(isValidNumber("abc")).toBe(false);
    expect(isValidNumber(null)).toBe(false);
  });
});

describe("structured-data-validator validateSchema", () => {
  it("errors when @type missing", () => {
    const r = validateSchema({});
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.field === "@type")).toBe(true);
  });
  it("errors for unsupported type", () => {
    const r = validateSchema({ "@type": "FooBar" });
    expect(r.isSupported).toBe(false);
    expect(r.ok).toBe(false);
  });
  it("passes for valid Article", () => {
    const r = validateSchema({
      "@type": "Article",
      headline: "Test",
      image: "https://example.com/img.jpg",
      datePublished: "2026-01-01",
      author: { "@type": "Person", name: "Joe" },
      publisher: { "@type": "Organization", name: "Pub" },
    });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });
  it("errors when required field missing", () => {
    const r = validateSchema({ "@type": "Article", headline: "Test" });
    expect(r.ok).toBe(false);
    expect(r.missingRequired).toContain("image");
    expect(r.missingRequired).toContain("datePublished");
  });
  it("warns when recommended field missing", () => {
    const r = validateSchema({
      "@type": "Article",
      headline: "Test",
      image: "https://example.com/img.jpg",
      datePublished: "2026-01-01",
      author: { "@type": "Person", name: "Joe" },
      publisher: { "@type": "Organization", name: "Pub" },
    });
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.missingRecommended).toContain("dateModified");
  });
  it("errors when URL field is invalid", () => {
    const r = validateSchema({
      "@type": "Article",
      headline: "Test",
      image: "not-a-url",
      datePublished: "2026-01-01",
      author: { "@type": "Person", name: "Joe" },
      publisher: { "@type": "Organization", name: "Pub" },
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.field === "image")).toBe(true);
  });
  it("errors when date field is invalid", () => {
    const r = validateSchema({
      "@type": "Article",
      headline: "Test",
      image: "https://example.com/img.jpg",
      datePublished: "Jan 1",
      author: { "@type": "Person", name: "Joe" },
      publisher: { "@type": "Organization", name: "Pub" },
    });
    expect(r.ok).toBe(false);
  });
  it("errors when array field is not array", () => {
    const r = validateSchema({
      "@type": "FAQPage",
      mainEntity: "not an array",
    });
    expect(r.ok).toBe(false);
  });
});

describe("structured-data-validator validate (full pipeline)", () => {
  it("returns parseError for empty input", () => {
    const r = validate("");
    expect(r.ok).toBe(false);
    expect(r.parseError).toBeTruthy();
  });
  it("returns parseError for invalid JSON", () => {
    const r = validate("{not valid json}");
    expect(r.ok).toBe(false);
    expect(r.parseError).toBeTruthy();
  });
  it("validates single schema", () => {
    const r = validate(JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: "Test",
      image: "https://example.com/img.jpg",
      datePublished: "2026-01-01",
      author: { "@type": "Person", name: "Joe" },
      publisher: { "@type": "Organization", name: "Pub" },
    }));
    expect(r.ok).toBe(true);
    expect(r.schemas).toHaveLength(1);
  });
  it("validates @graph multi-schema", () => {
    const r = validate(JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Article", headline: "A", image: "https://x/y.jpg", datePublished: "2026-01-01", author: { "@type": "Person", name: "X" }, publisher: { "@type": "Organization", name: "Y" } },
        { "@type": "Person", name: "Joe" },
      ],
    }));
    expect(r.schemas).toHaveLength(2);
    expect(r.ok).toBe(true);
  });
  it("validates JSON array of schemas", () => {
    const r = validate(JSON.stringify([
      { "@type": "Person", name: "Joe" },
    ]));
    expect(r.schemas).toHaveLength(1);
  });
  it("strips script wrapper before parsing", () => {
    const r = validate(`<script type="application/ld+json">${JSON.stringify({ "@type": "Person", name: "Joe" })}</script>`);
    expect(r.ok).toBe(true);
  });
  it("totals errors and warnings across schemas", () => {
    const r = validate(JSON.stringify({
      "@graph": [
        { "@type": "Article" }, // missing required fields
        { "@type": "Person", name: "Joe" },
      ],
    }));
    expect(r.totalErrors).toBeGreaterThan(0);
    expect(r.totalWarnings).toBeGreaterThanOrEqual(0);
  });
  it("errors when no @type or @graph", () => {
    const r = validate(JSON.stringify({ foo: "bar" }));
    expect(r.ok).toBe(false);
    expect(r.parseError).toBeTruthy();
  });
});

describe("structured-data-validator getRequiredFields / getRecommendedFields", () => {
  it("returns required fields for Article", () => {
    const req = getRequiredFields("Article");
    expect(req.length).toBeGreaterThan(0);
    expect(req.some((f) => f.key === "headline")).toBe(true);
  });
  it("returns recommended fields for Article", () => {
    const rec = getRecommendedFields("Article");
    expect(rec.some((f) => f.key === "dateModified")).toBe(true);
  });
});

describe("structured-data-validator links", () => {
  it("builds Google Rich Results link", () => {
    expect(buildGoogleRichResultsLink()).toContain("search.google.com/test/rich-results");
  });
  it("builds Schema.org docs link", () => {
    expect(buildSchemaDocsLink("Article")).toBe("https://schema.org/Article");
  });
});

describe("structured-data-validator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, schemaCount: 2, totalErrors: 0, totalWarnings: 3, types: ["Article", "Person"] });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, schemaCount: 1, totalErrors: 0, totalWarnings: 0, types: ["Article"] });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, schemaCount: 1, totalErrors: 0, totalWarnings: 0, types: ["Article"] });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("structured-data-validator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl('{"@type":"Person","name":"Joe"}');
    expect(url).toContain("ld=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("ld=%7B%22%40type%22%3A%22Person%22%7D");
    expect(p.input).toContain("Person");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ input: "" });
  });
  it("omits empty input", () => {
    const url = buildShareUrl("");
    expect(url).not.toContain("ld=");
  });
});
