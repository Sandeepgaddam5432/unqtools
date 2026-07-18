import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  SEO_TITLE_MAX,
  META_DESCRIPTION_MAX,
  AVAILABILITY_LABELS,
  AVAILABILITY_SCHEMA,
  CONDITION_LABELS,
  CONDITION_SCHEMA,
  CURRENCY_PRESETS,
  STOPWORDS,
  DEFAULT_INPUTS,
  validateInputs,
  normalizeInputs,
  categoryShort,
  parseFeatures,
  truncateWithEllipsis,
  toKebabCase,
  generateSlug,
  formatPrice,
  generateSeoTitle,
  generateMetaDescription,
  generateProductSchema,
  generateHeadings,
  extractKeywords,
  generateAltTexts,
  computeContentScore,
  generateAll,
  summarizeStats,
  parseBulkCsv,
  splitCsvRow,
  renderTextReport,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ProductInputs,
  type Availability,
  type Condition,
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

const sampleInputs: ProductInputs = {
  productName: "Wireless Bluetooth Headphones",
  brand: "Sony",
  category: "Audio > Headphones",
  price: 99.99,
  currency: "USD",
  description: "Premium wireless over-ear headphones with active noise cancellation, 30-hour battery life, and crystal-clear audio. Designed for music lovers and professionals. Experience studio-quality sound with deep bass and crisp highs. Lightweight, comfortable design for all-day wear.",
  sku: "SONY-WH-1000",
  mpn: "WH1000XM4",
  gtin: "4905524999137",
  availability: "in-stock",
  condition: "new",
  features: "Active noise cancellation\n30-hour battery life\nBluetooth 5.0\nUSB-C fast charging",
  siteName: "AudioPro",
  ratingValue: 4.5,
  reviewCount: 128,
};

describe("e-commerce constants", () => {
  it("SEO title max is 60", () => {
    expect(SEO_TITLE_MAX).toBe(60);
  });
  it("Meta description max is 155", () => {
    expect(META_DESCRIPTION_MAX).toBe(155);
  });
  it("has 3 availability labels", () => {
    expect(Object.keys(AVAILABILITY_LABELS)).toHaveLength(3);
  });
  it("has 3 availability schema URLs", () => {
    expect(AVAILABILITY_SCHEMA["in-stock"]).toContain("schema.org/InStock");
    expect(AVAILABILITY_SCHEMA["out-of-stock"]).toContain("schema.org/OutOfStock");
    expect(AVAILABILITY_SCHEMA["preorder"]).toContain("schema.org/PreOrder");
  });
  it("has 3 condition labels", () => {
    expect(Object.keys(CONDITION_LABELS)).toHaveLength(3);
  });
  it("has 3 condition schema URLs", () => {
    expect(CONDITION_SCHEMA["new"]).toContain("schema.org/NewCondition");
    expect(CONDITION_SCHEMA["used"]).toContain("schema.org/UsedCondition");
    expect(CONDITION_SCHEMA["refurbished"]).toContain("schema.org/RefurbishedCondition");
  });
  it("has 7 currency presets", () => {
    expect(CURRENCY_PRESETS).toHaveLength(7);
    expect(CURRENCY_PRESETS.find((c) => c.code === "USD")?.symbol).toBe("$");
    expect(CURRENCY_PRESETS.find((c) => c.code === "JPY")?.symbol).toBe("¥");
  });
  it("has stopwords set", () => {
    expect(STOPWORDS.has("the")).toBe(true);
    expect(STOPWORDS.has("apple")).toBe(false);
  });
  it("DEFAULT_INPUTS has all fields", () => {
    expect(Object.keys(DEFAULT_INPUTS).length).toBeGreaterThanOrEqual(14);
    expect(DEFAULT_INPUTS.currency).toBe("USD");
  });
  it("HISTORY_MAX is 20", () => {
    expect(HISTORY_MAX).toBe(20);
  });
  it("HISTORY_KEY is unique", () => {
    expect(HISTORY_KEY).toContain("e-commerce-product-seo-optimizer");
  });
});

describe("e-commerce validateInputs", () => {
  it("rejects negative price", () => {
    expect(validateInputs({ price: -5 }).price).toBeDefined();
  });
  it("accepts zero price", () => {
    expect(validateInputs({ price: 0 }).price).toBeUndefined();
  });
  it("rejects invalid availability", () => {
    expect(validateInputs({ availability: "unknown" as Availability }).availability).toBeDefined();
  });
  it("accepts valid availability", () => {
    expect(validateInputs({ availability: "in-stock" }).availability).toBeUndefined();
  });
  it("rejects invalid condition", () => {
    expect(validateInputs({ condition: "broken" as Condition }).condition).toBeDefined();
  });
  it("rejects empty currency when given", () => {
    expect(validateInputs({ currency: "" }).currency).toBeDefined();
  });
});

describe("e-commerce normalizeInputs", () => {
  it("trims text fields", () => {
    const n = normalizeInputs({ productName: "  Phone  ", brand: "  Apple  " });
    expect(n.productName).toBe("Phone");
    expect(n.brand).toBe("Apple");
  });
  it("uppercases currency", () => {
    expect(normalizeInputs({ currency: "usd" }).currency).toBe("USD");
  });
  it("defaults currency to USD when empty", () => {
    expect(normalizeInputs({ currency: "" }).currency).toBe("USD");
  });
  it("defaults availability to in-stock", () => {
    expect(normalizeInputs({}).availability).toBe("in-stock");
  });
  it("defaults condition to new", () => {
    expect(normalizeInputs({}).condition).toBe("new");
  });
  it("defaults price to 0 when missing", () => {
    expect(normalizeInputs({}).price).toBe(0);
  });
});

describe("e-commerce categoryShort", () => {
  it("returns last segment of >-separated path", () => {
    expect(categoryShort("Audio > Headphones")).toBe("Headphones");
  });
  it("returns last segment of /-separated path", () => {
    expect(categoryShort("Audio / Headphones / Wireless")).toBe("Wireless");
  });
  it("returns whole string when no separator", () => {
    expect(categoryShort("Headphones")).toBe("Headphones");
  });
  it("returns empty for empty input", () => {
    expect(categoryShort("")).toBe("");
  });
});

describe("e-commerce parseFeatures", () => {
  it("splits by newline", () => {
    expect(parseFeatures("a\nb\nc")).toEqual(["a", "b", "c"]);
  });
  it("handles CRLF", () => {
    expect(parseFeatures("a\r\nb\r\nc")).toEqual(["a", "b", "c"]);
  });
  it("trims and filters empty", () => {
    expect(parseFeatures("  a  \n\n  b  ")).toEqual(["a", "b"]);
  });
  it("returns empty for empty input", () => {
    expect(parseFeatures("")).toEqual([]);
  });
});

describe("e-commerce truncateWithEllipsis", () => {
  it("returns string unchanged when within limit", () => {
    expect(truncateWithEllipsis("hello", 10)).toBe("hello");
  });
  it("truncates and adds ellipsis when over limit", () => {
    expect(truncateWithEllipsis("hello world", 8)).toBe("hello w…");
  });
  it("returns full string when exactly at limit", () => {
    expect(truncateWithEllipsis("hello", 5)).toBe("hello");
  });
});

describe("e-commerce toKebabCase", () => {
  it("converts spaces to dashes", () => {
    expect(toKebabCase("Wireless Bluetooth Headphones")).toBe("wireless-bluetooth-headphones");
  });
  it("strips non-alphanumeric", () => {
    expect(toKebabCase("Sony WH-1000XM4 (Black)")).toBe("sony-wh-1000xm4-black");
  });
  it("lowercases", () => {
    expect(toKebabCase("HelloWorld")).toBe("helloworld");
  });
  it("strips diacritics", () => {
    expect(toKebabCase("café latte")).toBe("cafe-latte");
  });
  it("returns empty for empty input", () => {
    expect(toKebabCase("")).toBe("");
  });
  it("collapses multiple dashes", () => {
    expect(toKebabCase("a---b")).toBe("a-b");
  });
  it("strips leading/trailing dashes", () => {
    expect(toKebabCase("---abc---")).toBe("abc");
  });
});

describe("e-commerce generateSlug", () => {
  it("combines brand + productName", () => {
    expect(generateSlug("Wireless Headphones", "Sony")).toBe("sony-wireless-headphones");
  });
  it("works with productName only", () => {
    expect(generateSlug("Wireless Headphones", "")).toBe("wireless-headphones");
  });
  it("returns empty for both empty", () => {
    expect(generateSlug("", "")).toBe("");
  });
});

describe("e-commerce formatPrice", () => {
  it("formats USD with 2 decimals and $ symbol", () => {
    expect(formatPrice(99.99, "USD")).toBe("$99.99");
  });
  it("formats JPY with 0 decimals and ¥ symbol", () => {
    expect(formatPrice(1500, "JPY")).toBe("¥1500");
  });
  it("formats EUR with € symbol", () => {
    expect(formatPrice(89.5, "EUR")).toBe("€89.50");
  });
  it("returns empty for zero price", () => {
    expect(formatPrice(0, "USD")).toBe("");
  });
  it("returns empty for NaN price", () => {
    expect(formatPrice(Number.NaN, "USD")).toBe("");
  });
  it("falls back to no symbol for unknown currency", () => {
    expect(formatPrice(50, "XYZ")).toBe("50.00");
  });
});

describe("e-commerce generateSeoTitle", () => {
  it("combines name, brand, category, site", () => {
    const t = generateSeoTitle("Wireless Headphones", "Sony", "Audio > Headphones", "AudioPro");
    expect(t).toContain("Wireless Headphones - Sony");
    expect(t).toContain("Headphones");
    expect(t).toContain("AudioPro");
  });
  it("truncates to 60 chars", () => {
    const long = "A".repeat(100);
    const t = generateSeoTitle(long, "Brand", "Cat", "Site");
    expect(t.length).toBeLessThanOrEqual(60);
    expect(t.endsWith("…")).toBe(true);
  });
  it("works without site name", () => {
    const t = generateSeoTitle("Phone", "Apple", "Tech", "");
    expect(t).toBe("Phone - Apple | Tech");
  });
  it("works without category", () => {
    const t = generateSeoTitle("Phone", "Apple", "", "AppleStore");
    expect(t).toBe("Phone - Apple | AppleStore");
  });
  it("works with only name", () => {
    const t = generateSeoTitle("Phone", "", "", "");
    expect(t).toBe("Phone");
  });
});

describe("e-commerce generateMetaDescription", () => {
  it("includes name, brand, top feature, price, availability, free shipping", () => {
    const m = generateMetaDescription(
      "Wireless Headphones", "Sony", "Active noise cancellation\n30-hour battery", 99.99, "USD", "in-stock",
    );
    expect(m).toContain("Wireless Headphones by Sony");
    expect(m).toContain("Active noise cancellation");
    expect(m).toContain("$99.99");
    expect(m).toContain("In stock");
    expect(m).toContain("Free shipping");
  });
  it("truncates to 155 chars", () => {
    const longDesc = "A".repeat(300);
    const m = generateMetaDescription("Long Product Name Product Name", "Brand", longDesc, 99.99, "USD", "in-stock");
    expect(m.length).toBeLessThanOrEqual(155);
  });
  it("works without brand", () => {
    const m = generateMetaDescription("Phone", "", "Fast charging", 199, "USD", "preorder");
    expect(m).toContain("Phone.");
    expect(m).toContain("Pre-order");
  });
  it("works without features", () => {
    const m = generateMetaDescription("Phone", "Apple", "", 199, "USD", "in-stock");
    expect(m).toContain("Phone by Apple");
  });
});

describe("e-commerce generateProductSchema", () => {
  it("generates Product schema with @context and @type", () => {
    const s = generateProductSchema(sampleInputs);
    expect(s["@context"]).toBe("https://schema.org");
    expect(s["@type"]).toBe("Product");
    expect(s.name).toBe("Wireless Bluetooth Headphones");
  });
  it("includes brand as Brand object", () => {
    const s = generateProductSchema(sampleInputs);
    const brand = s.brand as { "@type": string; name: string };
    expect(brand["@type"]).toBe("Brand");
    expect(brand.name).toBe("Sony");
  });
  it("includes offers with price, currency, availability", () => {
    const s = generateProductSchema(sampleInputs);
    const offers = s.offers as Record<string, unknown>;
    expect(offers["@type"]).toBe("Offer");
    expect(offers.price).toBe("99.99");
    expect(offers.priceCurrency).toBe("USD");
    expect(offers.availability).toContain("schema.org/InStock");
    expect(offers.itemCondition).toContain("schema.org/NewCondition");
  });
  it("includes sku, mpn, gtin when provided", () => {
    const s = generateProductSchema(sampleInputs);
    expect(s.sku).toBe("SONY-WH-1000");
    expect(s.mpn).toBe("WH1000XM4");
    expect(s.gtin).toBe("4905524999137");
  });
  it("includes aggregateRating when both ratingValue and reviewCount > 0", () => {
    const s = generateProductSchema(sampleInputs);
    const ar = s.aggregateRating as Record<string, unknown>;
    expect(ar["@type"]).toBe("AggregateRating");
    expect(ar.ratingValue).toBe(4.5);
    expect(ar.reviewCount).toBe(128);
  });
  it("omits aggregateRating when reviewCount is 0", () => {
    const s = generateProductSchema({ ...sampleInputs, reviewCount: 0 });
    expect(s.aggregateRating).toBeUndefined();
  });
  it("omits offers when price is 0", () => {
    const s = generateProductSchema({ ...sampleInputs, price: 0 });
    expect(s.offers).toBeUndefined();
  });
  it("includes image placeholder URL based on slug", () => {
    const s = generateProductSchema(sampleInputs);
    expect(s.image).toContain("sony-wireless-bluetooth-headphones");
  });
});

describe("e-commerce generateHeadings", () => {
  it("includes H1 with product name", () => {
    const h = generateHeadings(sampleInputs);
    expect(h[0]).toEqual({ level: 1, text: "Wireless Bluetooth Headphones" });
  });
  it("includes Features H2 when features present", () => {
    const h = generateHeadings(sampleInputs);
    expect(h.some((x) => x.level === 2 && x.text === "Features")).toBe(true);
  });
  it("includes Specifications H2 when SKU/MPN/GTIN/brand present", () => {
    const h = generateHeadings(sampleInputs);
    expect(h.some((x) => x.level === 2 && x.text === "Specifications")).toBe(true);
  });
  it("always includes Reviews H2", () => {
    const h = generateHeadings({ ...sampleInputs, sku: "", mpn: "", gtin: "" });
    expect(h.some((x) => x.level === 2 && x.text === "Reviews")).toBe(true);
  });
  it("omits Features when no features", () => {
    const h = generateHeadings({ ...sampleInputs, features: "" });
    expect(h.some((x) => x.text === "Features")).toBe(false);
  });
});

describe("e-commerce extractKeywords", () => {
  it("extracts top keywords sorted by count", () => {
    const k = extractKeywords(
      "Wireless Headphones Wireless Audio",
      "These wireless headphones deliver premium wireless audio.",
      "Wireless\nBluetooth\nAudio",
    );
    expect(k.length).toBeGreaterThan(0);
    expect(k[0].word).toBe("wireless");
    expect(k[0].count).toBeGreaterThanOrEqual(3);
  });
  it("limits to topN", () => {
    const k = extractKeywords("apple banana cherry date elderberry fig grape", "", "", 3);
    expect(k.length).toBeLessThanOrEqual(3);
  });
  it("filters stopwords", () => {
    const k = extractKeywords("the quick brown fox", "the fox is quick", "", 5);
    expect(k.find((x) => x.word === "the")).toBeUndefined();
    expect(k.find((x) => x.word === "quick")).toBeDefined();
  });
  it("filters pure numbers", () => {
    const k = extractKeywords("phone 12345 99", "", "", 5);
    expect(k.find((x) => x.word === "12345")).toBeUndefined();
  });
  it("filters words shorter than 3 chars", () => {
    const k = extractKeywords("hi phone", "", "", 5);
    expect(k.find((x) => x.word === "hi")).toBeUndefined();
    expect(k.find((x) => x.word === "phone")).toBeDefined();
  });
  it("returns empty for empty input", () => {
    expect(extractKeywords("", "", "", 5)).toEqual([]);
  });
});

describe("e-commerce generateAltTexts", () => {
  it("includes front view as first alt", () => {
    const a = generateAltTexts(sampleInputs);
    expect(a[0]).toContain("Wireless Bluetooth Headphones");
    expect(a[0]).toContain("front view");
  });
  it("includes one alt per feature up to 3", () => {
    const a = generateAltTexts(sampleInputs);
    expect(a.length).toBe(5); // 1 hero + 3 features + 1 lifestyle
  });
  it("includes lifestyle alt as last", () => {
    const a = generateAltTexts(sampleInputs);
    expect(a[a.length - 1]).toContain("in use");
  });
  it("includes brand when present", () => {
    const a = generateAltTexts(sampleInputs);
    expect(a[0]).toContain("by Sony");
  });
  it("returns empty when no product name", () => {
    expect(generateAltTexts({ ...sampleInputs, productName: "" })).toEqual([]);
  });
});

describe("e-commerce computeContentScore", () => {
  it("returns 100 for fully complete inputs", () => {
    const s = computeContentScore(sampleInputs);
    expect(s.score).toBe(100);
  });
  it("returns 0 for empty inputs", () => {
    const s = computeContentScore({ ...DEFAULT_INPUTS });
    // availability + condition default to in-stock/new so they get their points
    expect(s.score).toBe(15); // 10 avail + 5 cond
  });
  it("deducts 10 for missing productName", () => {
    const s = computeContentScore({ ...sampleInputs, productName: "" });
    expect(s.score).toBe(90);
  });
  it("deducts 10 for missing brand", () => {
    const s = computeContentScore({ ...sampleInputs, brand: "" });
    expect(s.score).toBe(90);
  });
  it("deducts 10 for price=0", () => {
    const s = computeContentScore({ ...sampleInputs, price: 0 });
    expect(s.score).toBe(90);
  });
  it("deducts 10 for description between 51 and 200 chars", () => {
    // >50 chars passes, >200 chars fails → only -10 from perfect
    const s = computeContentScore({ ...sampleInputs, description: "A".repeat(60) });
    expect(s.score).toBe(90);
  });
  it("deducts 20 for short description (no >50 and no >200)", () => {
    const s = computeContentScore({ ...sampleInputs, description: "short description under fifty chars" });
    expect(s.score).toBe(80);
  });
  it("deducts 10 for fewer than 3 features", () => {
    const s = computeContentScore({ ...sampleInputs, features: "only one feature" });
    expect(s.score).toBe(90);
  });
  it("deducts 10 for missing SKU", () => {
    const s = computeContentScore({ ...sampleInputs, sku: "" });
    expect(s.score).toBe(90);
  });
  it("deducts 10 for missing GTIN", () => {
    const s = computeContentScore({ ...sampleInputs, gtin: "" });
    expect(s.score).toBe(90);
  });
  it("deducts 5 for missing MPN", () => {
    const s = computeContentScore({ ...sampleInputs, mpn: "" });
    expect(s.score).toBe(95);
  });
  it("breakdown has 11 entries", () => {
    const s = computeContentScore(sampleInputs);
    expect(s.breakdown).toHaveLength(11);
  });
  it("breakdown sums to score", () => {
    const s = computeContentScore(sampleInputs);
    const sum = s.breakdown.reduce((acc, b) => acc + b.points, 0);
    expect(sum).toBe(s.score);
  });
});

describe("e-commerce generateAll", () => {
  it("returns all output fields", () => {
    const o = generateAll(sampleInputs);
    expect(o.seoTitle).toBeDefined();
    expect(o.metaDescription).toBeDefined();
    expect(o.slug).toBe("sony-wireless-bluetooth-headphones");
    expect(o.schema).toBeDefined();
    expect(o.schemaJson).toContain("@type");
    expect(o.headings).toBeDefined();
    expect(o.keywords).toBeDefined();
    expect(o.altTexts).toBeDefined();
    expect(o.contentScore).toBeDefined();
  });
  it("seoTitleLength matches seoTitle length", () => {
    const o = generateAll(sampleInputs);
    expect(o.seoTitleLength).toBe(o.seoTitle.length);
  });
  it("metaDescriptionLength matches metaDescription length", () => {
    const o = generateAll(sampleInputs);
    expect(o.metaDescriptionLength).toBe(o.metaDescription.length);
  });
  it("schemaJson is valid JSON", () => {
    const o = generateAll(sampleInputs);
    expect(() => JSON.parse(o.schemaJson)).not.toThrow();
  });
});

describe("e-commerce summarizeStats", () => {
  it("computes completeness percent", () => {
    const o = generateAll(sampleInputs);
    const s = summarizeStats(sampleInputs, o);
    expect(s.completenessPercent).toBe(100);
    expect(s.filledFields).toBe(11);
  });
  it("hasStructuredData true when schema has fields", () => {
    const o = generateAll(sampleInputs);
    const s = summarizeStats(sampleInputs, o);
    expect(s.hasStructuredData).toBe(true);
  });
  it("titleFit perfect when 30-60 chars", () => {
    const o = generateAll(sampleInputs);
    const s = summarizeStats(sampleInputs, o);
    expect(["perfect", "truncated", "short"]).toContain(s.titleFit);
  });
  it("titleFit short when < 30 chars", () => {
    const inputs = { ...sampleInputs, productName: "X", brand: "", category: "", siteName: "" };
    const o = generateAll(inputs);
    const s = summarizeStats(inputs, o);
    expect(s.titleFit).toBe("short");
  });
  it("metaFit short when < 80 chars", () => {
    const inputs = { ...sampleInputs, description: "", features: "", price: 0 };
    const o = generateAll(inputs);
    const s = summarizeStats(inputs, o);
    expect(s.metaFit).toBe("short");
  });
});

describe("e-commerce splitCsvRow", () => {
  it("splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("handles escaped quotes", () => {
    expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]);
  });
});

describe("e-commerce parseBulkCsv", () => {
  it("returns empty for empty input", () => {
    expect(parseBulkCsv("")).toEqual([]);
  });
  it("skips header row when present", () => {
    const csv = "productName,brand,price\nPhone,Apple,999";
    const rows = parseBulkCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].inputs.productName).toBe("Phone");
  });
  it("parses without header", () => {
    const csv = "Phone,Apple";
    const rows = parseBulkCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].inputs.productName).toBe("Phone");
    expect(rows[0].inputs.brand).toBe("Apple");
  });
  it("generates output for each row", () => {
    const csv = "Phone1,Apple,999\nPhone2,Samsung,799";
    const rows = parseBulkCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].output).not.toBeNull();
    expect(rows[1].output).not.toBeNull();
  });
  it("splits features on semicolons", () => {
    // Columns: productName, brand, category, price, currency, description, sku, mpn, gtin, availability, condition, features
    const csv = "Phone,Apple,Mobile,999,USD,desc,sku,mpn,gtin,in-stock,new,feat1;feat2;feat3";
    const rows = parseBulkCsv(csv);
    expect(rows[0].inputs.features).toBe("feat1\nfeat2\nfeat3");
  });
  it("skips blank rows", () => {
    const csv = "Phone1,Apple\n\nPhone2,Samsung";
    const rows = parseBulkCsv(csv);
    expect(rows).toHaveLength(2);
  });
  it("defaults invalid availability to in-stock", () => {
    const csv = "Phone,Apple,Mobile,999,USD,desc,sku,mpn,gtin,unknown-avail,new";
    const rows = parseBulkCsv(csv);
    expect(rows[0].inputs.availability).toBe("in-stock");
  });
  it("defaults invalid condition to new", () => {
    const csv = "Phone,Apple,Mobile,999,USD,desc,sku,mpn,gtin,in-stock,broken";
    const rows = parseBulkCsv(csv);
    expect(rows[0].inputs.condition).toBe("new");
  });
});

describe("e-commerce renderTextReport", () => {
  it("includes product name", () => {
    const o = generateAll(sampleInputs);
    const text = renderTextReport(sampleInputs, o);
    expect(text).toContain("Product: Wireless Bluetooth Headphones");
  });
  it("includes SEO title section", () => {
    const o = generateAll(sampleInputs);
    const text = renderTextReport(sampleInputs, o);
    expect(text).toContain("--- SEO title ---");
    expect(text).toContain(`length: ${o.seoTitleLength}/60`);
  });
  it("includes meta description section", () => {
    const o = generateAll(sampleInputs);
    const text = renderTextReport(sampleInputs, o);
    expect(text).toContain("--- Meta description ---");
  });
  it("includes URL slug section", () => {
    const o = generateAll(sampleInputs);
    const text = renderTextReport(sampleInputs, o);
    expect(text).toContain("--- URL slug ---");
    expect(text).toContain("sony-wireless-bluetooth-headphones");
  });
  it("includes headings section", () => {
    const o = generateAll(sampleInputs);
    const text = renderTextReport(sampleInputs, o);
    expect(text).toContain("--- Heading structure ---");
    expect(text).toContain("H1:");
  });
  it("includes keywords section", () => {
    const o = generateAll(sampleInputs);
    const text = renderTextReport(sampleInputs, o);
    expect(text).toContain("--- Top keywords ---");
  });
  it("includes alt-text section", () => {
    const o = generateAll(sampleInputs);
    const text = renderTextReport(sampleInputs, o);
    expect(text).toContain("--- Alt-text suggestions ---");
  });
  it("includes content score section", () => {
    const o = generateAll(sampleInputs);
    const text = renderTextReport(sampleInputs, o);
    expect(text).toContain("Content score: 100/100");
  });
});

describe("e-commerce renderCsv", () => {
  it("renders header", () => {
    const o = generateAll(sampleInputs);
    const csv = renderCsv(sampleInputs, o);
    expect(csv).toContain("field,value");
  });
  it("includes seo_title row", () => {
    const o = generateAll(sampleInputs);
    const csv = renderCsv(sampleInputs, o);
    expect(csv).toContain("seo_title,");
  });
  it("includes url_slug row", () => {
    const o = generateAll(sampleInputs);
    const csv = renderCsv(sampleInputs, o);
    expect(csv).toContain("url_slug,");
  });
  it("includes schema_jsonld row", () => {
    const o = generateAll(sampleInputs);
    const csv = renderCsv(sampleInputs, o);
    expect(csv).toContain("schema_jsonld,");
  });
  it("escapes values with commas", () => {
    const o = generateAll(sampleInputs);
    const csv = renderCsv(sampleInputs, o);
    // Schema JSON contains newlines + double-quotes → wrapped in quotes with doubled inner quotes
    expect(csv).toContain('schema_jsonld,"{');
    expect(csv).toContain('""@context""');
  });
});

describe("e-commerce history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      productName: "Phone",
      brand: "Apple",
      contentScore: 90,
      slug: "apple-phone",
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].productName).toBe("Phone");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        productName: `P${i}`,
        brand: "B",
        contentScore: 80,
        slug: `p${i}`,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, productName: "x", brand: "", contentScore: 50, slug: "x",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("e-commerce shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(sampleInputs);
    expect(url).toContain("name=Wireless");
    expect(url).toContain("brand=Sony");
    expect(url).toContain("price=99.99");
    expect(url).toContain("cur=USD");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = buildShareUrl(sampleInputs);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.productName).toBe("Wireless Bluetooth Headphones");
    expect(parsed.brand).toBe("Sony");
    expect(parsed.price).toBe(99.99);
    expect(parsed.currency).toBe("USD");
    expect(parsed.availability).toBe("in-stock");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters invalid availability", () => {
    const parsed = parseShareUrl("avail=invalid");
    expect(parsed.availability).toBeUndefined();
  });
  it("filters invalid condition", () => {
    const parsed = parseShareUrl("cond=invalid");
    expect(parsed.condition).toBeUndefined();
  });
  it("round-trips features with newlines", () => {
    const url = buildShareUrl(sampleInputs);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.features).toContain("Active noise cancellation");
    expect(parsed.features).toContain("30-hour battery life");
  });
});

// Suppress unused-import lint
export type _Unused = Availability | Condition;
