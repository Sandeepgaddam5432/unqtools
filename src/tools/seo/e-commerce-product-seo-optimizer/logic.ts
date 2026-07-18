/**
 * E-commerce Product SEO Optimizer — pure logic.
 *
 * Generate SEO outputs for an e-commerce product page:
 *   - SEO title (≤60 chars)
 *   - Meta description (≤155 chars)
 *   - URL slug (kebab-case)
 *   - Product JSON-LD schema
 *   - Heading structure
 *   - Top keywords
 *   - Alt-text suggestions
 *   - Content score with breakdown
 *
 * Pure functions only — no DOM, no network.
 */

// ---- Types ----

export type Availability = "in-stock" | "out-of-stock" | "preorder";
export type Condition = "new" | "used" | "refurbished";

export interface ProductInputs {
  productName: string;
  brand: string;
  category: string;
  price: number;
  currency: string;
  description: string;
  sku: string;
  mpn: string;
  gtin: string;
  availability: Availability;
  condition: Condition;
  features: string; // newline-separated
  siteName: string;
  ratingValue: number; // optional aggregateRating
  reviewCount: number;
}

export interface ProductOutput {
  seoTitle: string;
  seoTitleLength: number;
  seoTitleTruncated: boolean;
  metaDescription: string;
  metaDescriptionLength: number;
  metaDescriptionTruncated: boolean;
  slug: string;
  schema: Record<string, unknown>;
  schemaJson: string;
  headings: { level: number; text: string }[];
  keywords: { word: string; count: number }[];
  altTexts: string[];
  contentScore: ContentScore;
}

export interface ContentScore {
  score: number;
  breakdown: { field: string; points: number; max: number; ok: boolean }[];
}

export interface SummaryStats {
  totalFields: number;
  filledFields: number;
  completenessPercent: number;
  hasStructuredData: boolean;
  titleFit: "perfect" | "truncated" | "short";
  metaFit: "perfect" | "truncated" | "short";
}

export interface HistoryEntry {
  ts: number;
  productName: string;
  brand: string;
  contentScore: number;
  slug: string;
}

export interface InputErrors {
  productName?: string;
  price?: string;
  currency?: string;
  availability?: string;
  condition?: string;
}

// ---- Constants ----

export const HISTORY_KEY = "unqtools:e-commerce-product-seo-optimizer:history";
export const HISTORY_MAX = 20;

export const SEO_TITLE_MAX = 60;
export const META_DESCRIPTION_MAX = 155;

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  "in-stock": "In stock",
  "out-of-stock": "Out of stock",
  "preorder": "Pre-order",
};

export const AVAILABILITY_SCHEMA: Record<Availability, string> = {
  "in-stock": "https://schema.org/InStock",
  "out-of-stock": "https://schema.org/OutOfStock",
  "preorder": "https://schema.org/PreOrder",
};

export const CONDITION_LABELS: Record<Condition, string> = {
  "new": "New",
  "used": "Used",
  "refurbished": "Refurbished",
};

export const CONDITION_SCHEMA: Record<Condition, string> = {
  "new": "https://schema.org/NewCondition",
  "used": "https://schema.org/UsedCondition",
  "refurbished": "https://schema.org/RefurbishedCondition",
};

export interface CurrencyPreset {
  code: string;
  symbol: string;
  label: string;
}

export const CURRENCY_PRESETS: CurrencyPreset[] = [
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "INR", symbol: "₹", label: "Indian Rupee" },
  { code: "JPY", symbol: "¥", label: "Japanese Yen" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar" },
];

// Common English stopwords to filter from keyword extraction
export const STOPWORDS = new Set<string>([
  "a", "an", "the", "and", "or", "but", "for", "with", "to", "of", "in", "on",
  "at", "by", "is", "it", "as", "be", "are", "from", "this", "that", "these",
  "those", "your", "you", "we", "our", "they", "their", "his", "her", "its",
  "into", "than", "then", "so", "if", "not", "no", "yes", "up", "down", "out",
  "off", "over", "under", "all", "any", "can", "has", "had", "was", "were",
  "been", "being", "have", "having", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "must", "shall", "i", "me", "my", "mine",
]);

export const DEFAULT_INPUTS: ProductInputs = {
  productName: "",
  brand: "",
  category: "",
  price: 0,
  currency: "USD",
  description: "",
  sku: "",
  mpn: "",
  gtin: "",
  availability: "in-stock",
  condition: "new",
  features: "",
  siteName: "",
  ratingValue: 0,
  reviewCount: 0,
};

// ---- Validation & normalization ----

export function validateInputs(inputs: Partial<ProductInputs>): InputErrors {
  const errors: InputErrors = {};
  if (inputs.productName !== undefined && inputs.productName.trim() === "") {
    // productName can be empty (user just opened tool) — only error if provided but somehow invalid
  }
  if (inputs.price !== undefined && (!Number.isFinite(inputs.price) || inputs.price < 0)) {
    errors.price = "Price must be a non-negative number";
  }
  if (inputs.currency !== undefined && inputs.currency.trim() === "") {
    errors.currency = "Currency is required when price > 0";
  }
  if (inputs.availability !== undefined && !["in-stock", "out-of-stock", "preorder"].includes(inputs.availability)) {
    errors.availability = "Availability must be in-stock / out-of-stock / preorder";
  }
  if (inputs.condition !== undefined && !["new", "used", "refurbished"].includes(inputs.condition)) {
    errors.condition = "Condition must be new / used / refurbished";
  }
  return errors;
}

export function normalizeInputs(inputs: Partial<ProductInputs>): ProductInputs {
  return {
    productName: (inputs.productName ?? "").trim(),
    brand: (inputs.brand ?? "").trim(),
    category: (inputs.category ?? "").trim(),
    price: Number.isFinite(inputs.price) ? Number(inputs.price) : 0,
    currency: (inputs.currency ?? "USD").trim().toUpperCase() || "USD",
    description: (inputs.description ?? "").trim(),
    sku: (inputs.sku ?? "").trim(),
    mpn: (inputs.mpn ?? "").trim(),
    gtin: (inputs.gtin ?? "").trim(),
    availability: (inputs.availability as Availability) ?? "in-stock",
    condition: (inputs.condition as Condition) ?? "new",
    features: (inputs.features ?? "").trim(),
    siteName: (inputs.siteName ?? "").trim(),
    ratingValue: Number.isFinite(inputs.ratingValue) ? Number(inputs.ratingValue) : 0,
    reviewCount: Number.isFinite(inputs.reviewCount) ? Number(inputs.reviewCount) : 0,
  };
}

// ---- Helpers ----

/** Get the last segment of a category path, e.g. "Audio > Headphones" → "Headphones". */
export function categoryShort(category: string): string {
  if (!category) return "";
  const parts = category.split(/[>\/]/).map((s) => s.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

/** Split features text into an array of feature strings. */
export function parseFeatures(features: string): string[] {
  if (!features) return [];
  return features
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Truncate a string to a max length, optionally adding ellipsis. */
export function truncateWithEllipsis(s: string, max: number): string {
  if (s.length <= max) return s;
  if (max <= 1) return s.slice(0, max);
  return s.slice(0, max - 1).trimEnd() + "…";
}

/** Convert a string to kebab-case URL slug. */
export function toKebabCase(s: string): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/** Generate the URL slug from productName + brand. */
export function generateSlug(productName: string, brand: string): string {
  const parts: string[] = [];
  if (brand) parts.push(brand);
  if (productName) parts.push(productName);
  const combined = parts.join(" ");
  if (!combined) return "";
  return toKebabCase(combined);
}

/** Format a price with currency. */
export function formatPrice(price: number, currency: string): string {
  if (!Number.isFinite(price) || price === 0) return "";
  const preset = CURRENCY_PRESETS.find((c) => c.code === currency);
  const symbol = preset?.symbol ?? "";
  // JPY has no decimals; others typically use 2 decimals
  const decimals = currency === "JPY" ? 0 : 2;
  return `${symbol}${price.toFixed(decimals)}`;
}

// ---- Generators ----

/** Generate SEO title: "<productName> - <brand> | <category-short> | <site>" truncated to 60 chars. */
export function generateSeoTitle(
  productName: string,
  brand: string,
  category: string,
  siteName: string,
): string {
  const parts: string[] = [];
  if (productName) parts.push(productName);
  if (brand) parts.push(brand);
  const head = parts.join(" - ");
  const tail: string[] = [];
  const cs = categoryShort(category);
  if (cs) tail.push(cs);
  if (siteName) tail.push(siteName);
  const full = tail.length > 0 ? `${head} | ${tail.join(" | ")}` : head;
  return truncateWithEllipsis(full, SEO_TITLE_MAX);
}

/** Generate meta description: "<productName> by <brand>. <topFeature>. <price>. <availability>. Free shipping." truncated to 155 chars. */
export function generateMetaDescription(
  productName: string,
  brand: string,
  features: string,
  price: number,
  currency: string,
  availability: Availability,
): string {
  const sentences: string[] = [];
  if (productName && brand) sentences.push(`${productName} by ${brand}.`);
  else if (productName) sentences.push(`${productName}.`);
  // Top feature
  const featureList = parseFeatures(features);
  if (featureList.length > 0) {
    sentences.push(`${featureList[0]}.`);
  }
  const priceStr = formatPrice(price, currency);
  if (priceStr) sentences.push(priceStr + ".");
  sentences.push(`${AVAILABILITY_LABELS[availability]}.`);
  sentences.push("Free shipping.");
  const full = sentences.join(" ");
  return truncateWithEllipsis(full, META_DESCRIPTION_MAX);
}

/** Generate Product JSON-LD schema object. */
export function generateProductSchema(inputs: ProductInputs): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: inputs.productName,
  };
  if (inputs.description) schema.description = inputs.description;
  if (inputs.brand) {
    schema.brand = { "@type": "Brand", name: inputs.brand };
  }
  if (inputs.category) schema.category = inputs.category;
  if (inputs.sku) schema.sku = inputs.sku;
  if (inputs.mpn) schema.mpn = inputs.mpn;
  if (inputs.gtin) schema.gtin = inputs.gtin;
  schema.image = `https://example.com/images/${generateSlug(inputs.productName, inputs.brand)}.jpg`;
  // Offers
  if (inputs.price > 0) {
    schema.offers = {
      "@type": "Offer",
      price: inputs.price.toFixed(2),
      priceCurrency: inputs.currency,
      availability: AVAILABILITY_SCHEMA[inputs.availability],
      itemCondition: CONDITION_SCHEMA[inputs.condition],
    };
  }
  // aggregateRating (if provided)
  if (inputs.ratingValue > 0 && inputs.reviewCount > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: inputs.ratingValue,
      reviewCount: inputs.reviewCount,
    };
  }
  return schema;
}

/** Generate heading structure suggestion. */
export function generateHeadings(inputs: ProductInputs): { level: number; text: string }[] {
  const out: { level: number; text: string }[] = [];
  if (inputs.productName) {
    out.push({ level: 1, text: inputs.productName });
  }
  const features = parseFeatures(inputs.features);
  if (features.length > 0) {
    out.push({ level: 2, text: "Features" });
  }
  // Specs section
  if (inputs.sku || inputs.mpn || inputs.gtin || inputs.brand) {
    out.push({ level: 2, text: "Specifications" });
  }
  // Reviews section
  out.push({ level: 2, text: "Reviews" });
  return out;
}

/** Extract top N keywords from name + description + features. */
export function extractKeywords(
  productName: string,
  description: string,
  features: string,
  topN = 5,
): { word: string; count: number }[] {
  const text = [productName, description, features].join(" ");
  if (!text.trim()) return [];
  // Tokenize: lowercase words, strip punctuation
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const counts = new Map<string, number>();
  for (const t of tokens) {
    if (t.length < 3) continue;
    if (STOPWORDS.has(t)) continue;
    if (/^\d+$/.test(t)) continue; // skip pure numbers
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const arr = Array.from(counts.entries()).map(([word, count]) => ({ word, count }));
  arr.sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
  return arr.slice(0, topN);
}

/** Generate alt-text suggestions for product images. */
export function generateAltTexts(inputs: ProductInputs): string[] {
  const out: string[] = [];
  if (!inputs.productName) return out;
  const featureList = parseFeatures(inputs.features);
  // Main hero image
  const brandPart = inputs.brand ? ` by ${inputs.brand}` : "";
  out.push(`${inputs.productName}${brandPart} — front view`);
  // One alt per feature (up to 3)
  for (const f of featureList.slice(0, 3)) {
    out.push(`${inputs.productName}${brandPart} — ${f}`);
  }
  // Lifestyle
  out.push(`${inputs.productName}${brandPart} — in use`);
  return out;
}

// ---- Content score ----

/** Compute content completeness score with breakdown. */
export function computeContentScore(inputs: ProductInputs): ContentScore {
  const breakdown: { field: string; points: number; max: number; ok: boolean }[] = [];
  let score = 0;
  // +10 productName
  const hasName = inputs.productName.length > 0;
  if (hasName) score += 10;
  breakdown.push({ field: "Product name", points: hasName ? 10 : 0, max: 10, ok: hasName });
  // +10 brand
  const hasBrand = inputs.brand.length > 0;
  if (hasBrand) score += 10;
  breakdown.push({ field: "Brand", points: hasBrand ? 10 : 0, max: 10, ok: hasBrand });
  // +10 price
  const hasPrice = inputs.price > 0;
  if (hasPrice) score += 10;
  breakdown.push({ field: "Price", points: hasPrice ? 10 : 0, max: 10, ok: hasPrice });
  // +10 description > 50 chars
  const descOk = inputs.description.length > 50;
  if (descOk) score += 10;
  breakdown.push({ field: "Description (>50 chars)", points: descOk ? 10 : 0, max: 10, ok: descOk });
  // +10 features (>=3)
  const featureCount = parseFeatures(inputs.features).length;
  const featuresOk = featureCount >= 3;
  if (featuresOk) score += 10;
  breakdown.push({ field: "Features (3+)", points: featuresOk ? 10 : 0, max: 10, ok: featuresOk });
  // +10 SKU
  const hasSku = inputs.sku.length > 0;
  if (hasSku) score += 10;
  breakdown.push({ field: "SKU", points: hasSku ? 10 : 0, max: 10, ok: hasSku });
  // +10 GTIN
  const hasGtin = inputs.gtin.length > 0;
  if (hasGtin) score += 10;
  breakdown.push({ field: "GTIN", points: hasGtin ? 10 : 0, max: 10, ok: hasGtin });
  // +10 availability
  const hasAvail = inputs.availability.length > 0;
  if (hasAvail) score += 10;
  breakdown.push({ field: "Availability", points: hasAvail ? 10 : 0, max: 10, ok: hasAvail });
  // +5 MPN
  const hasMpn = inputs.mpn.length > 0;
  if (hasMpn) score += 5;
  breakdown.push({ field: "MPN", points: hasMpn ? 5 : 0, max: 5, ok: hasMpn });
  // +5 condition
  const hasCond = inputs.condition.length > 0;
  if (hasCond) score += 5;
  breakdown.push({ field: "Condition", points: hasCond ? 5 : 0, max: 5, ok: hasCond });
  // +10 description > 200 chars
  const descLong = inputs.description.length > 200;
  if (descLong) score += 10;
  breakdown.push({ field: "Description (>200 chars)", points: descLong ? 10 : 0, max: 10, ok: descLong });
  return { score, breakdown };
}

// ---- Orchestration ----

/** Run all generators and return a complete output object. */
export function generateAll(inputs: ProductInputs): ProductOutput {
  const seoTitleFull = generateSeoTitle(inputs.productName, inputs.brand, inputs.category, inputs.siteName);
  const metaFull = generateMetaDescription(
    inputs.productName, inputs.brand, inputs.features, inputs.price, inputs.currency, inputs.availability,
  );
  const slug = generateSlug(inputs.productName, inputs.brand);
  const schema = generateProductSchema(inputs);
  const headings = generateHeadings(inputs);
  const keywords = extractKeywords(inputs.productName, inputs.description, inputs.features, 5);
  const altTexts = generateAltTexts(inputs);
  const contentScore = computeContentScore(inputs);
  return {
    seoTitle: seoTitleFull,
    seoTitleLength: seoTitleFull.length,
    seoTitleTruncated: seoTitleFull.length >= SEO_TITLE_MAX && (inputs.productName + " - " + inputs.brand).length > SEO_TITLE_MAX,
    metaDescription: metaFull,
    metaDescriptionLength: metaFull.length,
    metaDescriptionTruncated: metaFull.length >= META_DESCRIPTION_MAX,
    slug,
    schema,
    schemaJson: JSON.stringify(schema, null, 2),
    headings,
    keywords,
    altTexts,
    contentScore,
  };
}

// ---- Summary stats ----

export function summarizeStats(inputs: ProductInputs, output: ProductOutput): SummaryStats {
  const totalFields = 11; // name, brand, price, desc, features, sku, gtin, avail, mpn, cond, descLong
  const filledFields = output.contentScore.breakdown.filter((b) => b.ok).length;
  const completenessPercent = Math.round((filledFields / totalFields) * 1000) / 10;
  const hasStructuredData = Object.keys(output.schema).length > 2;
  const titleFit: "perfect" | "truncated" | "short" =
    output.seoTitleTruncated ? "truncated"
    : output.seoTitleLength < 30 ? "short"
    : "perfect";
  const metaFit: "perfect" | "truncated" | "short" =
    output.metaDescriptionTruncated ? "truncated"
    : output.metaDescriptionLength < 80 ? "short"
    : "perfect";
  return {
    totalFields,
    filledFields,
    completenessPercent,
    hasStructuredData,
    titleFit,
    metaFit,
  };
}

// ---- Bulk mode ----

export interface BulkProductRow {
  inputs: ProductInputs;
  output: ProductOutput | null;
  error?: string;
}

/** Parse bulk CSV input. Expected columns (header optional):
 *  productName, brand, category, price, currency, description, sku, mpn, gtin, availability, condition, features, siteName
 *  Features field can use semicolons within the cell to separate feature lines.
 */
export function parseBulkCsv(csv: string): BulkProductRow[] {
  if (!csv.trim()) return [];
  const lines = csv.split(/\r?\n/);
  let startIndex = 0;
  let hasHeader = false;
  if (lines.length > 0) {
    const first = splitCsvRow(lines[0]).map((s) => s.toLowerCase().trim());
    if (first.includes("productname") || first.includes("product_name")) {
      startIndex = 1;
      hasHeader = true;
    }
  }
  const out: BulkProductRow[] = [];
  for (let i = startIndex; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const cols = splitCsvRow(raw);
    if (cols.length < 1 || !cols[0]?.trim()) {
      out.push({ inputs: { ...DEFAULT_INPUTS }, output: null, error: `Row ${i + 1}: missing product name` });
      continue;
    }
    const inputs: ProductInputs = {
      productName: (cols[0] ?? "").trim(),
      brand: (cols[1] ?? "").trim(),
      category: (cols[2] ?? "").trim(),
      price: Number(cols[3] ?? 0) || 0,
      currency: ((cols[4] ?? "USD").trim().toUpperCase()) || "USD",
      description: (cols[5] ?? "").trim(),
      sku: (cols[6] ?? "").trim(),
      mpn: (cols[7] ?? "").trim(),
      gtin: (cols[8] ?? "").trim(),
      availability: ((cols[9] ?? "in-stock").trim().toLowerCase() as Availability) || "in-stock",
      condition: ((cols[10] ?? "new").trim().toLowerCase() as Condition) || "new",
      features: ((cols[11] ?? "").trim()).split(/[;]+/).map((s) => s.trim()).filter(Boolean).join("\n"),
      siteName: (cols[12] ?? "").trim(),
      ratingValue: 0,
      reviewCount: 0,
    };
    if (!["in-stock", "out-of-stock", "preorder"].includes(inputs.availability)) {
      inputs.availability = "in-stock";
    }
    if (!["new", "used", "refurbished"].includes(inputs.condition)) {
      inputs.condition = "new";
    }
    try {
      const output = generateAll(inputs);
      out.push({ inputs, output });
    } catch (e) {
      out.push({ inputs, output: null, error: `Row ${i + 1}: ${(e as Error).message}` });
    }
  }
  return out;
}

// ---- Rendering ----

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Split CSV row with quoted values. */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else { cur += ch; }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Render a complete text SEO report. */
export function renderTextReport(inputs: ProductInputs, output: ProductOutput): string {
  const lines: string[] = [];
  lines.push("=== E-commerce Product SEO Report ===");
  lines.push("");
  lines.push(`Product: ${inputs.productName || "(empty)"}`);
  if (inputs.brand) lines.push(`Brand: ${inputs.brand}`);
  if (inputs.category) lines.push(`Category: ${inputs.category}`);
  lines.push("");
  lines.push("--- SEO title ---");
  lines.push(output.seoTitle);
  lines.push(`(length: ${output.seoTitleLength}/${SEO_TITLE_MAX}${output.seoTitleTruncated ? " — TRUNCATED" : ""})`);
  lines.push("");
  lines.push("--- Meta description ---");
  lines.push(output.metaDescription);
  lines.push(`(length: ${output.metaDescriptionLength}/${META_DESCRIPTION_MAX}${output.metaDescriptionTruncated ? " — TRUNCATED" : ""})`);
  lines.push("");
  lines.push("--- URL slug ---");
  lines.push(output.slug || "(empty)");
  lines.push("");
  lines.push("--- Heading structure ---");
  for (const h of output.headings) {
    lines.push(`${"  ".repeat(h.level - 1)}H${h.level}: ${h.text}`);
  }
  lines.push("");
  lines.push("--- Top keywords ---");
  if (output.keywords.length === 0) {
    lines.push("(none — add description and features)");
  } else {
    for (const k of output.keywords) {
      lines.push(`  ${k.word} (${k.count}x)`);
    }
  }
  lines.push("");
  lines.push("--- Alt-text suggestions ---");
  if (output.altTexts.length === 0) {
    lines.push("(none — add product name first)");
  } else {
    for (const a of output.altTexts) {
      lines.push(`  alt="${a}"`);
    }
  }
  lines.push("");
  lines.push(`--- Content score: ${output.contentScore.score}/100 ---`);
  for (const b of output.contentScore.breakdown) {
    const mark = b.ok ? "✓" : "✗";
    lines.push(`  ${mark} ${b.field.padEnd(28)} ${b.points}/${b.max}`);
  }
  return lines.join("\n");
}

/** Render the SEO output as CSV (field, value). */
export function renderCsv(inputs: ProductInputs, output: ProductOutput): string {
  const lines = ["field,value"];
  lines.push(`seo_title,${escapeCsv(output.seoTitle)}`);
  lines.push(`seo_title_length,${output.seoTitleLength}`);
  lines.push(`meta_description,${escapeCsv(output.metaDescription)}`);
  lines.push(`meta_description_length,${output.metaDescriptionLength}`);
  lines.push(`url_slug,${escapeCsv(output.slug)}`);
  lines.push(`headings,${escapeCsv(output.headings.map((h) => `H${h.level}: ${h.text}`).join(" | "))}`);
  lines.push(`keywords,${escapeCsv(output.keywords.map((k) => `${k.word} (${k.count})`).join(", "))}`);
  lines.push(`alt_texts,${escapeCsv(output.altTexts.join(" | "))}`);
  lines.push(`content_score,${output.contentScore.score}`);
  lines.push(`content_breakdown,${escapeCsv(output.contentScore.breakdown.map((b) => `${b.field}:${b.points}/${b.max}`).join("; "))}`);
  lines.push(`schema_jsonld,${escapeCsv(output.schemaJson)}`);
  return lines.join("\n");
}

// ---- History (localStorage) ----

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, HISTORY_MAX);
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---- Shareable URL ----

export function buildShareUrl(inputs: ProductInputs): string {
  const params = new URLSearchParams();
  if (inputs.productName) params.set("name", inputs.productName);
  if (inputs.brand) params.set("brand", inputs.brand);
  if (inputs.category) params.set("cat", inputs.category);
  if (inputs.price > 0) params.set("price", String(inputs.price));
  if (inputs.currency) params.set("cur", inputs.currency);
  if (inputs.description) params.set("desc", inputs.description);
  if (inputs.sku) params.set("sku", inputs.sku);
  if (inputs.mpn) params.set("mpn", inputs.mpn);
  if (inputs.gtin) params.set("gtin", inputs.gtin);
  if (inputs.availability) params.set("avail", inputs.availability);
  if (inputs.condition) params.set("cond", inputs.condition);
  if (inputs.features) params.set("feat", inputs.features);
  if (inputs.siteName) params.set("site", inputs.siteName);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ProductInputs> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ProductInputs> = {};
  if (params.has("name")) out.productName = params.get("name") ?? "";
  if (params.has("brand")) out.brand = params.get("brand") ?? "";
  if (params.has("cat")) out.category = params.get("cat") ?? "";
  if (params.has("price")) {
    const n = Number(params.get("price"));
    if (Number.isFinite(n)) out.price = n;
  }
  if (params.has("cur")) out.currency = (params.get("cur") ?? "").toUpperCase();
  if (params.has("desc")) out.description = params.get("desc") ?? "";
  if (params.has("sku")) out.sku = params.get("sku") ?? "";
  if (params.has("mpn")) out.mpn = params.get("mpn") ?? "";
  if (params.has("gtin")) out.gtin = params.get("gtin") ?? "";
  if (params.has("avail")) {
    const v = params.get("avail");
    if (v === "in-stock" || v === "out-of-stock" || v === "preorder") out.availability = v;
  }
  if (params.has("cond")) {
    const v = params.get("cond");
    if (v === "new" || v === "used" || v === "refurbished") out.condition = v;
  }
  if (params.has("feat")) out.features = params.get("feat") ?? "";
  if (params.has("site")) out.siteName = params.get("site") ?? "";
  return out;
}
