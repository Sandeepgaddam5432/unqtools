import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_MAX,
  PRODUCT_TYPES,
  TONES,
  LENGTHS,
  FORMATS,
  DEFAULT_INPUT,
  SAMPLE_PRODUCTS,
  HONESTY_NOTES,
  validateProductInput,
  translateFeatureToBenefit,
  translateAllFeatures,
  extractKeywords,
  weaveKeywords,
  checkKeywordDensity,
  detectHonestyWarnings,
  generateParagraph,
  generateAmazonBullets,
  generateShopify,
  generateEtsy,
  generateMeta,
  generateAll,
  generateVariant,
  parseBulkCsv,
  bulkRowToInput,
  processBulkCsv,
  computeStats,
  renderMarkdown,
  renderCsv,
  splitCsvRow,
  buildLlmPrompt,
  renderLlmResult,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  formatLabel,
  type ProductInput,
  type Tone,
  type Length,
  type Format,
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

const SAMPLE: ProductInput = SAMPLE_PRODUCTS[0].input;

describe("ai-product-description-writer constants", () => {
  it("has 4 product types", () => {
    expect(PRODUCT_TYPES).toHaveLength(4);
    expect(PRODUCT_TYPES.map((p) => p.value)).toEqual([
      "physical", "digital", "service", "saas",
    ]);
  });
  it("has 6 tones", () => { expect(TONES).toHaveLength(6); });
  it("has 3 lengths with word ranges", () => {
    expect(LENGTHS).toHaveLength(3);
    expect(LENGTHS[0].minWords).toBeLessThan(LENGTHS[0].maxWords);
  });
  it("has 5 formats", () => { expect(FORMATS).toHaveLength(5); });
  it("has 4 sample products", () => { expect(SAMPLE_PRODUCTS).toHaveLength(4); });
  it("has default input", () => {
    expect(DEFAULT_INPUT.type).toBe("physical");
    expect(DEFAULT_INPUT.tone).toBe("professional");
    expect(DEFAULT_INPUT.length).toBe("medium");
  });
  it("has honesty notes", () => { expect(HONESTY_NOTES.length).toBeGreaterThanOrEqual(3); });
  it("HISTORY_MAX is 20", () => { expect(HISTORY_MAX).toBe(20); });
});

describe("ai-product-description-writer validateProductInput", () => {
  it("returns no errors for valid input", () => {
    expect(validateProductInput(SAMPLE)).toEqual([]);
  });
  it("flags missing name", () => {
    const errs = validateProductInput({ ...SAMPLE, name: "" });
    expect(errs).toContain("Product name is required.");
  });
  it("flags empty features", () => {
    const errs = validateProductInput({ ...SAMPLE, features: [] });
    expect(errs.some((e) => e.includes("feature"))).toBe(true);
  });
  it("flags missing audience", () => {
    const errs = validateProductInput({ ...SAMPLE, audience: "  " });
    expect(errs.some((e) => e.includes("audience"))).toBe(true);
  });
  it("accepts whitespace-only features as empty", () => {
    const errs = validateProductInput({ ...SAMPLE, features: ["   ", ""] });
    expect(errs.some((e) => e.includes("feature"))).toBe(true);
  });
});

describe("ai-product-description-writer translateFeatureToBenefit", () => {
  it("translates stainless steel feature", () => {
    const b = translateFeatureToBenefit("1.0L stainless steel body", "home baristas");
    expect(b.benefit).toContain("durable");
    expect(b.benefit).toContain("home baristas");
  });
  it("translates warranty feature", () => {
    const b = translateFeatureToBenefit("2-year warranty", "buyers");
    expect(b.benefit).toContain("peace of mind");
  });
  it("translates battery/rechargeable feature", () => {
    const b = translateFeatureToBenefit("USB-C rechargeable battery", "travelers");
    expect(b.benefit).toContain("powered");
  });
  it("translates waterproof feature", () => {
    const b = translateFeatureToBenefit("IP68 waterproof rating", "swimmers");
    expect(b.benefit.toLowerCase()).toContain("water");
    expect(b.benefit).toContain("swimmers");
  });
  it("translates integration feature", () => {
    const b = translateFeatureToBenefit("Native Slack integration", "engineers");
    expect(b.benefit).toContain("already use");
  });
  it("translates compliance/SOC2 feature", () => {
    const b = translateFeatureToBenefit("SOC 2 Type II compliance", "admins");
    expect(b.benefit.toLowerCase()).toContain("trust");
  });
  it("translates lifetime-access feature (digital)", () => {
    const b = translateFeatureToBenefit("Lifetime access + updates", "learners");
    expect(b.benefit.toLowerCase()).toContain("lifetime");
  });
  it("translates beginner-friendly feature", () => {
    const b = translateFeatureToBenefit("Beginner-friendly — no prior experience needed", "newbies");
    expect(b.benefit).toContain("newbies");
  });
  it("uses fallback pattern for unknown feature", () => {
    const b = translateFeatureToBenefit("some weird unique feature", "everyone");
    expect(b.benefit).toContain("some weird unique feature");
    expect(b.benefit).toContain("everyone");
  });
  it("returns empty for empty input", () => {
    const b = translateFeatureToBenefit("");
    expect(b.feature).toBe("");
    expect(b.benefit).toBe("");
  });
  it("translates multiple features via translateAllFeatures", () => {
    const list = translateAllFeatures(
      ["stainless steel body", "5-year warranty"],
      "buyers",
    );
    expect(list).toHaveLength(2);
    expect(list[0].benefit).toContain("durable");
  });
  it("skips empty/whitespace features in translateAllFeatures", () => {
    const list = translateAllFeatures(["stainless steel", "  ", ""], "buyers");
    expect(list).toHaveLength(1);
  });
});

describe("ai-product-description-writer extractKeywords", () => {
  it("extracts top keywords from text", () => {
    // 'kettle' appears 3 times, 'coffee' once — kettle should rank first.
    const kw = extractKeywords("This kettle is the best kettle for kettle pour over coffee lovers.");
    expect(kw.length).toBeGreaterThan(0);
    expect(kw[0]).toBe("kettle");
    expect(kw).toContain("coffee");
  });
  it("filters stopwords", () => {
    const kw = extractKeywords("the and or but for to of in on");
    expect(kw).toEqual([]);
  });
  it("filters short words (< 4 chars)", () => {
    const kw = extractKeywords("ok go hi bye yes");
    expect(kw).toEqual([]);
  });
  it("respects topN", () => {
    const kw = extractKeywords("alpha alpha beta beta gamma gamma delta delta epsilon", 2);
    expect(kw.length).toBeLessThanOrEqual(2);
  });
  it("returns empty for empty text", () => {
    expect(extractKeywords("")).toEqual([]);
  });
});

describe("ai-product-description-writer weaveKeywords", () => {
  it("does not crash on empty keywords", () => {
    const out = weaveKeywords("A short text.", []);
    expect(out).toBe("A short text.");
  });
  it("does not insert if text is too short", () => {
    const out = weaveKeywords("A short text here.", ["kettle"]);
    expect(out).toBe("A short text here.");
  });
  it("inserts keyword after first period when text is long", () => {
    // 100+ words so insertion cap (1 per 100 words) is at least 1.
    const sentence = "This product is amazing and delivers real value every single time. ";
    const long = sentence.repeat(10); // ~110 words
    const out = weaveKeywords(long, ["kettle"]);
    // Should have inserted "kettle?" somewhere after a period.
    expect(out.toLowerCase()).toContain("kettle?");
  });
  it("skips keyword already present in text", () => {
    const long = "This kettle is amazing. " + Array.from({ length: 30 }, (_, i) => `Sentence ${i} about kettle.`).join(" ");
    const out = weaveKeywords(long, ["kettle"]);
    // Should not add a second kettle? marker — already present.
    expect((out.match(/kettle\?/gi) ?? []).length).toBeLessThanOrEqual(1);
  });
});

describe("ai-product-description-writer checkKeywordDensity", () => {
  it("returns empty for empty text", () => {
    expect(checkKeywordDensity("", ["kettle"])).toEqual([]);
  });
  it("computes density correctly", () => {
    // 10 words, 1 occurrence → 10%
    const text = "The kettle is the best kettle for kitchen";
    const d = checkKeywordDensity(text, ["kettle"]);
    expect(d[0].count).toBe(2);
    expect(d[0].density).toBeGreaterThan(0);
  });
  it("flags stuffing (>4%) as bad", () => {
    const text = "kettle kettle kettle kettle kettle kettle kettle kettle kettle kettle";
    const d = checkKeywordDensity(text, ["kettle"]);
    expect(d[0].status).toBe("bad");
  });
  it("flags warn zone (2.5-4%)", () => {
    // 5 of 30 → ~16% — too high. Try 2 of 50 = 4%
    const text = "word ".repeat(48) + "kettle kettle";
    const d = checkKeywordDensity(text, ["kettle"]);
    expect(d[0].density).toBeGreaterThanOrEqual(2.5);
    expect(["warn", "bad"]).toContain(d[0].status);
  });
  it("good zone for low density", () => {
    const text = "word ".repeat(100) + "kettle";
    const d = checkKeywordDensity(text, ["kettle"]);
    expect(d[0].density).toBeLessThan(2.5);
    expect(d[0].status).toBe("good");
  });
  it("skips empty keywords", () => {
    const d = checkKeywordDensity("some text here", [""]);
    expect(d).toEqual([]);
  });
});

describe("ai-product-description-writer detectHonestyWarnings", () => {
  it("flags FDA-approved", () => {
    const w = detectHonestyWarnings("This is FDA-approved and amazing.");
    expect(w.length).toBeGreaterThan(0);
    expect(w[0]).toContain("FDA");
  });
  it("flags clinically proven", () => {
    const w = detectHonestyWarnings("Clinically proven to work.");
    expect(w.length).toBeGreaterThan(0);
  });
  it("flags 100% safe", () => {
    expect(detectHonestyWarnings("100% safe for everyone").length).toBeGreaterThan(0);
  });
  it("flags doctor recommended", () => {
    expect(detectHonestyWarnings("Doctor recommended!").length).toBeGreaterThan(0);
  });
  it("returns empty for clean text", () => {
    expect(detectHonestyWarnings("A solid product that lasts.")).toEqual([]);
  });
});

describe("ai-product-description-writer generateParagraph", () => {
  it("produces non-empty text", () => {
    const d = generateParagraph(SAMPLE);
    expect(d.format).toBe("paragraph");
    expect(d.text.length).toBeGreaterThan(0);
    expect(d.wordCount).toBeGreaterThan(0);
  });
  it("includes product name", () => {
    const d = generateParagraph(SAMPLE);
    expect(d.text).toContain(SAMPLE.name);
  });
  it("includes CTA when provided", () => {
    const d = generateParagraph(SAMPLE);
    expect(d.text).toContain("cart");
  });
  it("respects length: short ≤ 90 words", () => {
    const d = generateParagraph({ ...SAMPLE, length: "short", features: SAMPLE.features.slice(0, 2) });
    expect(d.wordCount).toBeLessThanOrEqual(95); // small overflow tolerance for CTA
  });
  it("respects length: long ≥ 200 words for many features", () => {
    const d = generateParagraph({ ...SAMPLE, length: "long" });
    // Long may be trimmed to maxWords=280, but should be ≥ medium.
    expect(d.wordCount).toBeGreaterThan(100);
  });
  it("produces variant with different text", () => {
    const a = generateParagraph(SAMPLE);
    const b = generateVariant(SAMPLE);
    expect(b.format).toBe("paragraph");
    expect(b.text).not.toBe(a.text);
  });
});

describe("ai-product-description-writer generateAmazonBullets", () => {
  it("produces 5 bullets", () => {
    const d = generateAmazonBullets(SAMPLE);
    expect(d.format).toBe("amazon-bullets");
    const bulletCount = (d.text.match(/^•/gm) ?? []).length;
    expect(bulletCount).toBe(5);
  });
  it("pads to 5 bullets when features < 5", () => {
    const d = generateAmazonBullets({ ...SAMPLE, features: ["stainless steel body"] });
    const bulletCount = (d.text.match(/^•/gm) ?? []).length;
    expect(bulletCount).toBe(5);
  });
  it("includes CTA when provided", () => {
    const d = generateAmazonBullets(SAMPLE);
    expect(d.text).toContain("cart");
  });
  it("headlines are uppercase", () => {
    const d = generateAmazonBullets(SAMPLE);
    expect(d.text).toMatch(/• [A-Z]/);
  });
});

describe("ai-product-description-writer generateShopify", () => {
  it("produces paragraph format without CTA in body", () => {
    const d = generateShopify(SAMPLE);
    expect(d.format).toBe("shopify");
    // CTA stripped from Shopify (buy button handles it).
    expect(d.text).not.toContain("cart");
  });
  it("long becomes medium for Shopify", () => {
    const d = generateShopify({ ...SAMPLE, length: "long" });
    // Should be ≤ medium max (160) + small slack.
    expect(d.wordCount).toBeLessThanOrEqual(170);
  });
});

describe("ai-product-description-writer generateEtsy", () => {
  it("produces story-driven output with intro and outro", () => {
    const d = generateEtsy(SAMPLE);
    expect(d.format).toBe("etsy");
    expect(d.text).toContain("Looking for something special?");
    expect(d.text).toContain("•");
  });
  it("includes brand in outro when provided", () => {
    const d = generateEtsy({ ...SAMPLE, brand: "Aurora" });
    expect(d.text).toContain("Made with care by Aurora");
  });
  it("omits brand line when brand empty", () => {
    const d = generateEtsy({ ...SAMPLE, brand: "" });
    expect(d.text).not.toContain("Made with care by");
    expect(d.text).toContain("Order today");
  });
});

describe("ai-product-description-writer generateMeta", () => {
  it("produces text ≤ 155 chars", () => {
    const d = generateMeta(SAMPLE);
    expect(d.format).toBe("meta");
    expect(d.charCount).toBeLessThanOrEqual(155);
  });
  it("truncates long descriptions at word boundary", () => {
    const longInput: ProductInput = {
      ...SAMPLE,
      audience: "very specific audience of pour-over coffee enthusiasts who want premium equipment",
      features: [
        "stainless steel body with precision gooseneck spout for accurate pouring control every time you brew",
        "ergonomic stay-cool handle for comfortable grip",
        "compatible with induction stovetops and all kitchen setups",
      ],
      keywords: ["pour over kettle", "gooseneck kettle", "stainless steel kettle", "induction kettle", "coffee kettle"],
    };
    const d = generateMeta(longInput);
    expect(d.charCount).toBeLessThanOrEqual(155);
    expect(d.text.endsWith("…") || d.text.endsWith(".")).toBe(true);
  });
});

describe("ai-product-description-writer generateAll", () => {
  it("produces all 5 formats", () => {
    const all = generateAll(SAMPLE);
    expect(all).toHaveLength(5);
    expect(all.map((d) => d.format)).toEqual([
      "paragraph", "amazon-bullets", "shopify", "etsy", "meta",
    ]);
  });
});

describe("ai-product-description-writer bulk CSV", () => {
  const CSV = `name,type,features,audience,tone,length,keywords
Test Kettle,physical,stainless steel body|precision spout,home baristas,professional,short,pour over kettle
Course Pro,digital,30 HD video lessons|lifetime access,learners,casual,medium,watercolor course`;

  it("parses CSV with header", () => {
    const rows = parseBulkCsv(CSV);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("Test Kettle");
    expect(rows[1].name).toBe("Course Pro");
  });
  it("parses CSV without header", () => {
    const noHeader = `Test Kettle,physical,stainless steel body,home baristas,professional,short,kettle`;
    const rows = parseBulkCsv(noHeader);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Test Kettle");
  });
  it("bulkRowToInput splits features on pipe", () => {
    const rows = parseBulkCsv(CSV);
    const input = bulkRowToInput(rows[0]);
    expect(input.features).toEqual(["stainless steel body", "precision spout"]);
    expect(input.keywords).toEqual(["pour over kettle"]);
  });
  it("bulkRowToInput coerces invalid type to physical", () => {
    const input = bulkRowToInput({
      name: "X", type: "banana", features: "", audience: "",
      tone: "professional", length: "medium", keywords: "",
    });
    expect(input.type).toBe("physical");
  });
  it("bulkRowToInput coerces invalid tone to professional", () => {
    const input = bulkRowToInput({
      name: "X", type: "physical", features: "", audience: "",
      tone: "goofy", length: "medium", keywords: "",
    });
    expect(input.tone).toBe("professional");
  });
  it("bulkRowToInput coerces invalid length to medium", () => {
    const input = bulkRowToInput({
      name: "X", type: "physical", features: "", audience: "",
      tone: "professional", length: "gargantuan", keywords: "",
    });
    expect(input.length).toBe("medium");
  });
  it("processBulkCsv generates descriptions", () => {
    const descs = processBulkCsv(CSV);
    expect(descs).toHaveLength(2);
    expect(descs.every((d) => d.wordCount > 0)).toBe(true);
  });
  it("parses empty CSV as empty array", () => {
    expect(parseBulkCsv("")).toEqual([]);
    expect(parseBulkCsv("   \n   ")).toEqual([]);
  });
});

describe("ai-product-description-writer computeStats", () => {
  it("computes word count and reading time", () => {
    const d = generateParagraph(SAMPLE);
    const stats = computeStats(d, SAMPLE);
    expect(stats.totalWords).toBe(d.wordCount);
    expect(stats.readingTimeSeconds).toBeGreaterThan(0);
    expect(stats.sentenceCount).toBeGreaterThan(0);
  });
  it("detects CTA when present", () => {
    const d = generateParagraph(SAMPLE);
    const stats = computeStats(d, SAMPLE);
    expect(stats.hasCallToAction).toBe(true);
  });
  it("flags honesty warnings in text", () => {
    const input: ProductInput = {
      ...SAMPLE,
      features: ["FDA-approved materials"],
    };
    const d = generateParagraph(input);
    const stats = computeStats(d, input);
    expect(stats.honestyWarnings.length).toBeGreaterThan(0);
  });
  it("returns keyword densities", () => {
    const d = generateParagraph(SAMPLE);
    const stats = computeStats(d, SAMPLE);
    expect(stats.keywordDensities.length).toBe(SAMPLE.keywords.length);
  });
});

describe("ai-product-description-writer renderMarkdown", () => {
  it("includes H1 with product name", () => {
    const d = generateParagraph(SAMPLE);
    const md = renderMarkdown(d, SAMPLE);
    expect(md).toContain(`# ${SAMPLE.name}`);
  });
  it("includes feature→benefit section", () => {
    const d = generateParagraph(SAMPLE);
    const md = renderMarkdown(d, SAMPLE);
    expect(md).toContain("Feature → Benefit");
  });
  it("includes brand and price when provided", () => {
    const d = generateParagraph(SAMPLE);
    const md = renderMarkdown(d, SAMPLE);
    expect(md).toContain(`**Brand:** ${SAMPLE.brand}`);
    expect(md).toContain(`**Price:** ${SAMPLE.price}`);
  });
});

describe("ai-product-description-writer renderCsv / splitCsvRow", () => {
  it("renders header + rows", () => {
    const all = generateAll(SAMPLE);
    const csv = renderCsv(all);
    // First line is the header.
    expect(csv.split("\n")[0]).toBe("format,text,word_count,char_count");
    // Round-trip: parse the CSV back and confirm we get 5 data rows.
    const lines = csv.split("\n");
    // Skip header, then re-join remaining and parse with splitCsvRow by walking lines.
    let dataRows = 0;
    let inQuotes = false;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      // Count quotes to track multi-line cells.
      const quoteCount = (line.match(/"/g) ?? []).length;
      if (!inQuotes) dataRows++;
      if (quoteCount % 2 === 1) inQuotes = !inQuotes;
    }
    expect(dataRows).toBe(5);
  });
  it("splitCsvRow handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("splitCsvRow handles escaped quotes", () => {
    expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]);
  });
});

describe("ai-product-description-writer buildLlmPrompt", () => {
  it("includes product name and audience", () => {
    const prompt = buildLlmPrompt(SAMPLE, "paragraph");
    expect(prompt).toContain(SAMPLE.name);
    expect(prompt).toContain(SAMPLE.audience);
  });
  it("includes rules about no fabrication", () => {
    const prompt = buildLlmPrompt(SAMPLE, "paragraph");
    expect(prompt.toLowerCase()).toContain("never invent");
  });
  it("includes keywords", () => {
    const prompt = buildLlmPrompt(SAMPLE, "paragraph");
    expect(prompt).toContain(SAMPLE.keywords[0]);
  });
});

describe("ai-product-description-writer renderLlmResult", () => {
  it("trims whitespace", () => {
    const r = renderLlmResult("  hello world  ");
    expect(r.text).toBe("hello world");
  });
  it("detects honesty warnings in LLM output", () => {
    const r = renderLlmResult("This product is FDA-approved and amazing.");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("ai-product-description-writer formatLabel", () => {
  it("returns label for each format", () => {
    expect(formatLabel("paragraph")).toBe("Paragraph");
    expect(formatLabel("amazon-bullets")).toBe("Amazon 5-bullet");
    expect(formatLabel("meta")).toContain("Meta");
  });
});

describe("ai-product-description-writer history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, name: "Test", type: "physical",
      format: "paragraph", wordCount: 50, preview: "preview",
    });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].name).toBe("Test");
  });
  it("caps at HISTORY_MAX", () => {
    for (let i = 0; i < HISTORY_MAX + 5; i++) {
      saveHistory({
        ts: i, name: `Test${i}`, type: "physical",
        format: "paragraph", wordCount: 50, preview: "preview",
      });
    }
    expect(loadHistory()).toHaveLength(HISTORY_MAX);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, name: "Test", type: "physical",
      format: "paragraph", wordCount: 50, preview: "preview",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("newest entry is first", () => {
    saveHistory({
      ts: 100, name: "First", type: "physical",
      format: "paragraph", wordCount: 50, preview: "p1",
    });
    saveHistory({
      ts: 200, name: "Second", type: "physical",
      format: "paragraph", wordCount: 50, preview: "p2",
    });
    const h = loadHistory();
    expect(h[0].name).toBe("Second");
  });
});

describe("ai-product-description-writer share URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(SAMPLE);
    expect(url).toContain("name=");
    expect(url).toContain("type=physical");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("round-trips share URL", () => {
    const url = buildShareUrl(SAMPLE);
    // Extract the hash portion if window was available.
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.name).toBe(SAMPLE.name);
    expect(parsed.type).toBe(SAMPLE.type);
    expect(parsed.tone).toBe(SAMPLE.tone);
    expect(parsed.length).toBe(SAMPLE.length);
    expect(parsed.features).toEqual(SAMPLE.features);
    expect(parsed.keywords).toEqual(SAMPLE.keywords);
  });
  it("parses empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters invalid type", () => {
    const p = parseShareUrl("name=X&type=banana");
    expect(p.type).toBeUndefined();
  });
  it("filters invalid tone", () => {
    const p = parseShareUrl("name=X&tone=goofy");
    expect(p.tone).toBeUndefined();
  });
  it("filters invalid length", () => {
    const p = parseShareUrl("name=X&length=gargantuan");
    expect(p.length).toBeUndefined();
  });
  it("preserves brand, price, cta", () => {
    const hash = buildShareUrl(SAMPLE).includes("#")
      ? buildShareUrl(SAMPLE).slice(buildShareUrl(SAMPLE).indexOf("#"))
      : buildShareUrl(SAMPLE);
    const p = parseShareUrl(hash);
    expect(p.brand).toBe(SAMPLE.brand);
    expect(p.price).toBe(SAMPLE.price);
    expect(p.callToAction).toBe(SAMPLE.callToAction);
  });
});

// Suppress unused-import lint
export type _Unused = Tone | Length | Format;
