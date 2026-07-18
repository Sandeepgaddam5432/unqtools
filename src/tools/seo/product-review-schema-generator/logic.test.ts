import { describe, it, expect, beforeEach } from "vitest";
import {
  CURRENCIES,
  CURRENCY_LABELS,
  CURRENCY_SYMBOLS,
  AVAILABILITIES,
  AVAILABILITY_LABELS,
  AVAILABILITY_SCHEMA_URLS,
  REQUIRED_FIELDS,
  RECOMMENDED_FIELDS,
  defaultInput,
  isValidUrl,
  isValidDate,
  isValidPrice,
  isValidRating,
  isValidRatingCount,
  clampRating,
  validate,
  buildProductJsonLd,
  buildReviewObject,
  buildAggregateRating,
  buildBreadcrumbJsonLd,
  generateFaqQuestions,
  buildFaqJsonLd,
  buildScriptTag,
  generateProductScript,
  generateCombinedHtml,
  buildGoogleRichResultsLink,
  buildSchemaDocsLink,
  buildReviewDocsLink,
  buildGoogleProductReviewDocsLink,
  checkCompliance,
  computeSummaryStats,
  renderTextReport,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ReviewInput,
  type Currency,
  type Availability,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

function validInput(overrides: Partial<ReviewInput> = {}): ReviewInput {
  return {
    ...defaultInput(),
    productName: "Wireless Headphones X1",
    productBrand: "AudioPro",
    productImageUrl: "https://example.com/headphones.jpg",
    productUrl: "https://example.com/headphones-x1",
    productDescription: "Premium wireless headphones with active noise cancellation.",
    productCategory: "Headphones",
    productSku: "AP-X1-BLK",
    productGtin: "0123456789012",
    productPrice: "199.99",
    productCurrency: "USD",
    productAvailability: "InStock",
    reviewAuthor: "Jane Reviewer",
    reviewRating: "4.5",
    reviewBody: "These headphones are excellent. The sound quality is crisp, bass is deep, and noise cancellation works perfectly. Battery life is impressive at 30 hours. Highly recommended for the price.",
    reviewDate: "2024-01-15",
    aggregateRatingCount: "127",
    aggregateRatingValue: "4.5",
    ...overrides,
  };
}

describe("product-review-schema-generator constants", () => {
  it("has 7 currencies", () => {
    expect(CURRENCIES).toHaveLength(7);
    expect(CURRENCIES).toEqual(["USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD"]);
  });
  it("has labels for all currencies", () => {
    for (const c of CURRENCIES) {
      expect(CURRENCY_LABELS[c]).toBeTruthy();
      expect(CURRENCY_SYMBOLS[c]).toBeTruthy();
    }
  });
  it("has 4 availabilities", () => {
    expect(AVAILABILITIES).toHaveLength(4);
    expect(AVAILABILITIES).toEqual(["InStock", "OutOfStock", "PreOrder", "BackOrder"]);
  });
  it("has labels + schema URLs for all availabilities", () => {
    for (const a of AVAILABILITIES) {
      expect(AVAILABILITY_LABELS[a]).toBeTruthy();
      expect(AVAILABILITY_SCHEMA_URLS[a]).toMatch(/^https:\/\/schema\.org\/(InStock|OutOfStock|PreOrder|BackOrder)$/);
    }
  });
  it("has 3 required fields", () => {
    expect(REQUIRED_FIELDS).toHaveLength(3);
  });
  it("has 4 recommended fields", () => {
    expect(RECOMMENDED_FIELDS).toHaveLength(4);
  });
  it("defaultInput returns all empty strings + defaults", () => {
    const d = defaultInput();
    expect(d.productName).toBe("");
    expect(d.productCurrency).toBe("USD");
    expect(d.productAvailability).toBe("InStock");
  });
});

describe("product-review-schema-generator validators", () => {
  it("isValidUrl accepts http(s)", () => {
    expect(isValidUrl("https://example.com")).toBe(true);
    expect(isValidUrl("http://example.com")).toBe(true);
  });
  it("isValidUrl rejects ftp + invalid", () => {
    expect(isValidUrl("ftp://example.com")).toBe(false);
    expect(isValidUrl("not-a-url")).toBe(false);
    expect(isValidUrl("")).toBe(false);
  });
  it("isValidDate accepts YYYY-MM-DD", () => {
    expect(isValidDate("2024-01-15")).toBe(true);
  });
  it("isValidDate rejects invalid format + bad date", () => {
    expect(isValidDate("15-01-2024")).toBe(false);
    expect(isValidDate("2024-13-45")).toBe(false);
    expect(isValidDate("")).toBe(false);
  });
  it("isValidPrice accepts non-negative numbers", () => {
    expect(isValidPrice("199.99")).toBe(true);
    expect(isValidPrice("0")).toBe(true);
  });
  it("isValidPrice rejects negatives + non-numbers", () => {
    expect(isValidPrice("-1")).toBe(false);
    expect(isValidPrice("abc")).toBe(false);
    expect(isValidPrice("")).toBe(false);
  });
  it("isValidRating accepts 1-5", () => {
    expect(isValidRating("1")).toBe(true);
    expect(isValidRating("5")).toBe(true);
    expect(isValidRating("3.5")).toBe(true);
  });
  it("isValidRating rejects 0, 6, non-numbers", () => {
    expect(isValidRating("0")).toBe(false);
    expect(isValidRating("6")).toBe(false);
    expect(isValidRating("abc")).toBe(false);
    expect(isValidRating("")).toBe(false);
  });
  it("isValidRatingCount accepts integers ≥ 1", () => {
    expect(isValidRatingCount("1")).toBe(true);
    expect(isValidRatingCount("127")).toBe(true);
  });
  it("isValidRatingCount rejects 0, negatives, decimals", () => {
    expect(isValidRatingCount("0")).toBe(false);
    expect(isValidRatingCount("-1")).toBe(false);
    expect(isValidRatingCount("1.5")).toBe(false);
    expect(isValidRatingCount("")).toBe(false);
  });
});

describe("product-review-schema-generator clampRating", () => {
  it("clamps below 1 to 1", () => {
    expect(clampRating(0)).toBe(1);
    expect(clampRating(-5)).toBe(1);
  });
  it("clamps above 5 to 5", () => {
    expect(clampRating(6)).toBe(5);
    expect(clampRating(10)).toBe(5);
  });
  it("preserves values within 1-5 with 1 decimal rounding", () => {
    expect(clampRating(4.5)).toBe(4.5);
    expect(clampRating(4.567)).toBe(4.6);
  });
  it("returns 1 for NaN/Infinity", () => {
    expect(clampRating(NaN)).toBe(1);
    expect(clampRating(Infinity)).toBe(1);
  });
});

describe("product-review-schema-generator validate", () => {
  it("passes for valid input", () => {
    expect(validate(validInput()).ok).toBe(true);
  });
  it("fails when productName is missing", () => {
    const v = validate(validInput({ productName: "" }));
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes("Product name"))).toBe(true);
  });
  it("fails when reviewRating is missing", () => {
    const v = validate(validInput({ reviewRating: "" }));
    expect(v.ok).toBe(false);
  });
  it("fails when reviewRating is out of range", () => {
    const v = validate(validInput({ reviewRating: "6" }));
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes("1 and 5"))).toBe(true);
  });
  it("fails when reviewAuthor is missing", () => {
    const v = validate(validInput({ reviewAuthor: "" }));
    expect(v.ok).toBe(false);
  });
  it("fails when aggregateRatingCount provided without value", () => {
    const v = validate(validInput({ aggregateRatingValue: "" }));
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes("together"))).toBe(true);
  });
  it("fails when aggregateRatingCount is invalid", () => {
    const v = validate(validInput({ aggregateRatingCount: "0" }));
    expect(v.ok).toBe(false);
  });
  it("fails when productUrl is invalid", () => {
    const v = validate(validInput({ productUrl: "not-a-url" }));
    expect(v.ok).toBe(false);
  });
  it("fails when reviewDate is invalid format", () => {
    const v = validate(validInput({ reviewDate: "01/15/2024" }));
    expect(v.ok).toBe(false);
  });
  it("fails when productPrice is invalid", () => {
    const v = validate(validInput({ productPrice: "-10" }));
    expect(v.ok).toBe(false);
  });
  it("warns when recommended fields are missing", () => {
    const v = validate(validInput({ productBrand: "", productImageUrl: "", productUrl: "", productPrice: "" }));
    expect(v.warnings.length).toBeGreaterThanOrEqual(4);
  });
  it("warns when reviewBody is short", () => {
    const v = validate(validInput({ reviewBody: "Good" }));
    expect(v.warnings.some((w) => w.includes("short"))).toBe(true);
  });
  it("issues array matches errors + warnings", () => {
    const v = validate(validInput({ productName: "", productBrand: "" }));
    expect(v.issues.length).toBe(v.errors.length + v.warnings.length);
  });
});

describe("product-review-schema-generator buildProductJsonLd", () => {
  it("builds product JSON-LD with @context + @type Product", () => {
    const j = buildProductJsonLd(validInput());
    expect(j["@context"]).toBe("https://schema.org");
    expect(j["@type"]).toBe("Product");
    expect(j.name).toBe("Wireless Headphones X1");
  });
  it("includes brand as nested Brand object", () => {
    const j = buildProductJsonLd(validInput());
    expect(j.brand).toEqual({ "@type": "Brand", name: "AudioPro" });
  });
  it("includes offers with price, currency, availability", () => {
    const j = buildProductJsonLd(validInput());
    const offers = j.offers as Record<string, unknown>;
    expect(offers["@type"]).toBe("Offer");
    expect(offers.price).toBe(199.99);
    expect(offers.priceCurrency).toBe("USD");
    expect(offers.availability).toBe("https://schema.org/InStock");
  });
  it("includes nested Review object", () => {
    const j = buildProductJsonLd(validInput());
    const review = j.review as Record<string, unknown>;
    expect(review["@type"]).toBe("Review");
    expect((review.author as Record<string, unknown>).name).toBe("Jane Reviewer");
    const rr = review.reviewRating as Record<string, unknown>;
    expect(rr.ratingValue).toBe(4.5);
    expect(rr.bestRating).toBe(5);
    expect(rr.worstRating).toBe(1);
  });
  it("includes reviewBody + datePublished when provided", () => {
    const j = buildProductJsonLd(validInput());
    const review = j.review as Record<string, unknown>;
    expect(review.reviewBody).toContain("headphones are excellent");
    expect(review.datePublished).toBe("2024-01-15");
  });
  it("includes aggregateRating when both provided", () => {
    const j = buildProductJsonLd(validInput());
    const ar = j.aggregateRating as Record<string, unknown>;
    expect(ar.ratingValue).toBe(4.5);
    expect(ar.reviewCount).toBe(127);
  });
  it("omits aggregateRating when not provided", () => {
    const j = buildProductJsonLd(validInput({ aggregateRatingCount: "", aggregateRatingValue: "" }));
    expect(j.aggregateRating).toBeUndefined();
  });
  it("includes sku, gtin, category when provided", () => {
    const j = buildProductJsonLd(validInput());
    expect(j.sku).toBe("AP-X1-BLK");
    expect(j.gtin).toBe("0123456789012");
    expect(j.category).toBe("Headphones");
  });
  it("throws when validation fails", () => {
    expect(() => buildProductJsonLd(validInput({ productName: "" }))).toThrow();
  });
});

describe("product-review-schema-generator buildReviewObject", () => {
  it("builds a Review object alone", () => {
    const r = buildReviewObject(validInput());
    expect(r["@type"]).toBe("Review");
    expect((r.author as Record<string, unknown>).name).toBe("Jane Reviewer");
  });
  it("throws when review author missing", () => {
    expect(() => buildReviewObject(validInput({ reviewAuthor: "" }))).toThrow();
  });
  it("throws when rating invalid", () => {
    expect(() => buildReviewObject(validInput({ reviewRating: "6" }))).toThrow();
  });
});

describe("product-review-schema-generator buildAggregateRating", () => {
  it("builds aggregate rating when both provided", () => {
    const ar = buildAggregateRating(validInput());
    expect(ar).not.toBeNull();
    expect(ar!.ratingValue).toBe(4.5);
    expect(ar!.reviewCount).toBe(127);
  });
  it("returns null when missing", () => {
    expect(buildAggregateRating(validInput({ aggregateRatingCount: "" }))).toBeNull();
  });
  it("returns null when invalid", () => {
    expect(buildAggregateRating(validInput({ aggregateRatingValue: "10" }))).toBeNull();
  });
});

describe("product-review-schema-generator buildBreadcrumbJsonLd", () => {
  it("builds BreadcrumbList with 3 items", () => {
    const b = buildBreadcrumbJsonLd(validInput());
    expect(b["@type"]).toBe("BreadcrumbList");
    const items = b.itemListElement as unknown[];
    expect(items).toHaveLength(3);
  });
  it("first item is Home", () => {
    const b = buildBreadcrumbJsonLd(validInput());
    const items = b.itemListElement as Record<string, unknown>[];
    expect(items[0].name).toBe("Home");
    expect(items[0].position).toBe(1);
  });
  it("second item is Reviews", () => {
    const b = buildBreadcrumbJsonLd(validInput());
    const items = b.itemListElement as Record<string, unknown>[];
    expect(items[1].name).toBe("Reviews");
  });
  it("third item is product name", () => {
    const b = buildBreadcrumbJsonLd(validInput());
    const items = b.itemListElement as Record<string, unknown>[];
    expect(items[2].name).toBe("Wireless Headphones X1");
  });
  it("uses fallback product name when empty", () => {
    const b = buildBreadcrumbJsonLd(validInput({ productName: "" }));
    const items = b.itemListElement as Record<string, unknown>[];
    expect(items[2].name).toBe("Product");
  });
});

describe("product-review-schema-generator generateFaqQuestions", () => {
  it("generates 3 questions", () => {
    const qs = generateFaqQuestions(validInput());
    expect(qs).toHaveLength(3);
    qs.forEach((q) => {
      expect(q.q.length).toBeGreaterThan(0);
      expect(q.a.length).toBeGreaterThan(0);
    });
  });
  it("includes product name in questions", () => {
    const qs = generateFaqQuestions(validInput());
    expect(qs.every((q) => q.q.includes("Wireless Headphones X1") || q.a.includes("Wireless Headphones X1"))).toBe(true);
  });
  it("handles empty input gracefully", () => {
    const qs = generateFaqQuestions(defaultInput());
    expect(qs).toHaveLength(3);
    expect(qs[0].q).toContain("this product");
  });
});

describe("product-review-schema-generator buildFaqJsonLd", () => {
  it("builds FAQPage with 3 mainEntity", () => {
    const f = buildFaqJsonLd(validInput());
    expect(f["@type"]).toBe("FAQPage");
    const main = f.mainEntity as Record<string, unknown>[];
    expect(main).toHaveLength(3);
    main.forEach((m) => {
      expect(m["@type"]).toBe("Question");
      expect(m.name).toBeTruthy();
      const ans = m.acceptedAnswer as Record<string, unknown>;
      expect(ans["@type"]).toBe("Answer");
      expect(ans.text).toBeTruthy();
    });
  });
});

describe("product-review-schema-generator buildScriptTag + generate", () => {
  it("wraps JSON in script tag", () => {
    const tag = buildScriptTag({ foo: "bar" });
    expect(tag.startsWith('<script type="application/ld+json">')).toBe(true);
    expect(tag.endsWith("</script>")).toBe(true);
    expect(tag).toContain('"foo": "bar"');
  });
  it("generateProductScript wraps product JSON-LD", () => {
    const s = generateProductScript(validInput());
    expect(s).toContain('<script type="application/ld+json">');
    expect(s).toContain('"@type": "Product"');
  });
  it("generateCombinedHtml includes product + breadcrumb by default", () => {
    const html = generateCombinedHtml(validInput(), false);
    expect(html).toContain('"@type": "Product"');
    expect(html).toContain('"@type": "BreadcrumbList"');
    expect(html).not.toContain('"@type": "FAQPage"');
  });
  it("generateCombinedHtml includes FAQ when requested", () => {
    const html = generateCombinedHtml(validInput(), true);
    expect(html).toContain('"@type": "FAQPage"');
  });
});

describe("product-review-schema-generator docs links", () => {
  it("buildGoogleRichResultsLink returns search.google.com URL", () => {
    expect(buildGoogleRichResultsLink()).toBe("https://search.google.com/test/rich-results");
  });
  it("buildSchemaDocsLink returns schema.org Product", () => {
    expect(buildSchemaDocsLink()).toBe("https://schema.org/Product");
  });
  it("buildReviewDocsLink returns schema.org Review", () => {
    expect(buildReviewDocsLink()).toBe("https://schema.org/Review");
  });
  it("buildGoogleProductReviewDocsLink returns Google docs URL", () => {
    expect(buildGoogleProductReviewDocsLink()).toMatch(/^https:\/\/developers\.google\.com/);
  });
});

describe("product-review-schema-generator checkCompliance", () => {
  it("returns compliant for valid input", () => {
    const c = checkCompliance(validInput());
    expect(c.compliant).toBe(true);
    expect(c.failed).toHaveLength(0);
  });
  it("fails when required field missing", () => {
    const c = checkCompliance(validInput({ productName: "" }));
    expect(c.compliant).toBe(false);
    expect(c.failed.some((f) => f.includes("Product name"))).toBe(true);
  });
  it("adds recommendations for missing recommended fields", () => {
    const c = checkCompliance(validInput({ productBrand: "", productImageUrl: "", productUrl: "", productPrice: "" }));
    expect(c.recommendations.length).toBeGreaterThanOrEqual(4);
  });
  it("adds recommendation for missing aggregate rating", () => {
    const c = checkCompliance(validInput({ aggregateRatingCount: "", aggregateRatingValue: "" }));
    expect(c.recommendations.some((r) => r.includes("aggregate"))).toBe(true);
  });
  it("lists passed checks", () => {
    const c = checkCompliance(validInput());
    expect(c.passed.length).toBeGreaterThan(5);
  });
});

describe("product-review-schema-generator computeSummaryStats", () => {
  it("computes required + recommended counts", () => {
    const s = computeSummaryStats(validInput());
    expect(s.requiredProvided).toBe(3);
    expect(s.requiredTotal).toBe(3);
    expect(s.recommendedProvided).toBe(4);
    expect(s.recommendedTotal).toBe(4);
  });
  it("validation status pass for valid input", () => {
    expect(computeSummaryStats(validInput()).validationStatus).toBe("pass");
  });
  it("validation status fail for invalid input", () => {
    expect(computeSummaryStats(validInput({ productName: "" })).validationStatus).toBe("fail");
  });
  it("compliance status reflects check", () => {
    expect(computeSummaryStats(validInput()).complianceStatus).toBe("compliant");
    expect(computeSummaryStats(validInput({ productName: "" })).complianceStatus).toBe("non-compliant");
  });
  it("extras array has 6 entries", () => {
    expect(computeSummaryStats(validInput()).extras).toHaveLength(6);
  });
});

describe("product-review-schema-generator renderTextReport", () => {
  it("renders report with sections for valid input", () => {
    const t = renderTextReport(validInput(), true);
    expect(t).toContain("PRODUCT REVIEW SCHEMA REPORT");
    expect(t).toContain("Product JSON-LD");
    expect(t).toContain("Product Script Tag");
    expect(t).toContain("BreadcrumbList Schema");
    expect(t).toContain("FAQPage Schema");
    expect(t).toContain("COMPLIANT");
  });
  it("omits FAQ when includeFaq=false", () => {
    const t = renderTextReport(validInput(), false);
    expect(t).not.toContain("FAQPage Schema");
  });
  it("shows validation failure when invalid", () => {
    const t = renderTextReport(validInput({ productName: "" }), false);
    expect(t).toContain("VALIDATION FAILED");
  });
});

describe("product-review-schema-generator renderCsv", () => {
  it("renders header + field rows", () => {
    const csv = renderCsv(validInput());
    expect(csv).toContain("field,value");
    expect(csv).toContain("productName,Wireless Headphones X1");
    expect(csv).toContain("productCurrency,USD");
  });
  it("escapes commas in values", () => {
    const csv = renderCsv(validInput({ productDescription: "Has, comma" }));
    expect(csv).toContain('"Has, comma"');
  });
  it("includes validation status", () => {
    expect(renderCsv(validInput())).toContain("validationStatus,pass");
    expect(renderCsv(validInput({ productName: "" }))).toContain("validationStatus,fail");
  });
});

describe("product-review-schema-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      productName: "Test",
      productBrand: "Brand",
      reviewRating: "4",
      currency: "USD",
      hasAggregate: true,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, productName: `P${i}`, productBrand: "B", reviewRating: "4", currency: "USD", hasAggregate: false });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, productName: "X", productBrand: "Y", reviewRating: "5", currency: "USD", hasAggregate: false });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("product-review-schema-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ productName: "Test", reviewRating: "4" });
    expect(url).toContain("productName=Test");
    expect(url).toContain("reviewRating=4");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("productName=Test&reviewRating=4&productCurrency=EUR");
    expect(p.productName).toBe("Test");
    expect(p.reviewRating).toBe("4");
    expect(p.productCurrency).toBe("EUR");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown currency", () => {
    const p = parseShareUrl("productCurrency=XYZ");
    expect(p.productCurrency).toBeUndefined();
  });
  it("filters unknown availability", () => {
    const p = parseShareUrl("productAvailability=Discontinued");
    expect(p.productAvailability).toBeUndefined();
  });
  it("preserves long text fields with newlines", () => {
    const encoded = new URLSearchParams({ reviewBody: "line1\nline2" }).toString();
    const p = parseShareUrl(encoded);
    expect(p.reviewBody).toBe("line1\nline2");
  });
});

// Suppress unused-import lint
export type _Unused = Currency | Availability;
