/**
 * Product Review Schema Generator — pure logic.
 *
 * Generate Product + Review + AggregateRating JSON-LD for product review
 * pages. Pure functions only — no DOM, no network.
 */

export type Currency = "USD" | "EUR" | "GBP" | "INR" | "JPY" | "AUD" | "CAD";

export const CURRENCIES: Currency[] = [
  "USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD",
];

export const CURRENCY_LABELS: Record<Currency, string> = {
  USD: "US Dollar ($)",
  EUR: "Euro (€)",
  GBP: "British Pound (£)",
  INR: "Indian Rupee (₹)",
  JPY: "Japanese Yen (¥)",
  AUD: "Australian Dollar (A$)",
  CAD: "Canadian Dollar (C$)",
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  JPY: "¥",
  AUD: "A$",
  CAD: "C$",
};

export type Availability =
  | "InStock"
  | "OutOfStock"
  | "PreOrder"
  | "BackOrder";

export const AVAILABILITIES: Availability[] = [
  "InStock", "OutOfStock", "PreOrder", "BackOrder",
];

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  InStock: "In Stock",
  OutOfStock: "Out of Stock",
  PreOrder: "Pre-Order",
  BackOrder: "Back-Order",
};

export const AVAILABILITY_SCHEMA_URLS: Record<Availability, string> = {
  InStock: "https://schema.org/InStock",
  OutOfStock: "https://schema.org/OutOfStock",
  PreOrder: "https://schema.org/PreOrder",
  BackOrder: "https://schema.org/BackOrder",
};

export interface ReviewInput {
  // Product fields
  productName: string;
  productBrand: string;
  productImageUrl: string;
  productUrl: string;
  productDescription: string;
  productCategory: string;
  productSku: string;
  productGtin: string;
  productPrice: string; // keep as string for flexibility
  productCurrency: Currency;
  productAvailability: Availability;
  // Single review fields
  reviewAuthor: string;
  reviewRating: string; // 1-5
  reviewBody: string;
  reviewDate: string; // YYYY-MM-DD
  // Aggregate rating fields
  aggregateRatingCount: string;
  aggregateRatingValue: string;
}

export function defaultInput(): ReviewInput {
  return {
    productName: "",
    productBrand: "",
    productImageUrl: "",
    productUrl: "",
    productDescription: "",
    productCategory: "",
    productSku: "",
    productGtin: "",
    productPrice: "",
    productCurrency: "USD",
    productAvailability: "InStock",
    reviewAuthor: "",
    reviewRating: "",
    reviewBody: "",
    reviewDate: "",
    aggregateRatingCount: "",
    aggregateRatingValue: "",
  };
}

export interface ValidationIssue {
  field: string;
  message: string;
  level: "error" | "warning";
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  issues: ValidationIssue[];
}

/** Required per Google Product Review schema spec. */
export const REQUIRED_FIELDS: readonly { field: keyof ReviewInput; label: string }[] = [
  { field: "productName", label: "Product name" },
  { field: "reviewRating", label: "Review rating" },
  { field: "reviewAuthor", label: "Review author" },
] as const;

/** Recommended per Google Product Review schema spec. */
export const RECOMMENDED_FIELDS: readonly { field: keyof ReviewInput; label: string }[] = [
  { field: "productBrand", label: "Product brand" },
  { field: "productImageUrl", label: "Product image URL" },
  { field: "productUrl", label: "Product URL" },
  { field: "productPrice", label: "Product price" },
] as const;

export function isValidUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidDate(d: string): boolean {
  if (!d) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const dt = new Date(d + "T00:00:00Z");
  return !isNaN(dt.getTime());
}

export function isValidPrice(p: string): boolean {
  if (!p) return false;
  const n = Number(p);
  return !isNaN(n) && isFinite(n) && n >= 0;
}

export function isValidRating(r: string): boolean {
  if (r === "") return false;
  const n = Number(r);
  return !isNaN(n) && isFinite(n) && n >= 1 && n <= 5;
}

export function isValidRatingCount(c: string): boolean {
  if (c === "") return false;
  if (!/^\d+$/.test(c.trim())) return false;
  const n = parseInt(c, 10);
  return !isNaN(n) && isFinite(n) && n >= 1;
}

export function clampRating(r: number): number {
  if (isNaN(r) || !isFinite(r)) return 1;
  if (r < 1) return 1;
  if (r > 5) return 5;
  // Round to 1 decimal place
  return Math.round(r * 10) / 10;
}

/** Validate required + recommended fields per Google spec. */
export function validate(input: ReviewInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const issues: ValidationIssue[] = [];

  // Required fields
  for (const { field, label } of REQUIRED_FIELDS) {
    const v = input[field];
    if (!v || !String(v).trim()) {
      const msg = `${label} is required`;
      errors.push(msg);
      issues.push({ field, message: msg, level: "error" });
    }
  }

  // Rating validation
  if (input.reviewRating && !isValidRating(input.reviewRating)) {
    const msg = "Review rating must be a number between 1 and 5";
    errors.push(msg);
    issues.push({ field: "reviewRating", message: msg, level: "error" });
  }

  // Aggregate rating validation (if provided)
  if (input.aggregateRatingCount && !isValidRatingCount(input.aggregateRatingCount)) {
    const msg = "Aggregate rating count must be an integer ≥ 1";
    errors.push(msg);
    issues.push({ field: "aggregateRatingCount", message: msg, level: "error" });
  }
  if (input.aggregateRatingValue && !isValidRating(input.aggregateRatingValue)) {
    const msg = "Aggregate rating value must be between 1 and 5";
    errors.push(msg);
    issues.push({ field: "aggregateRatingValue", message: msg, level: "error" });
  }
  // If one of count/value is provided, the other is required too
  if (
    (input.aggregateRatingCount && !input.aggregateRatingValue) ||
    (!input.aggregateRatingCount && input.aggregateRatingValue)
  ) {
    const msg = "Both aggregateRatingCount and aggregateRatingValue must be provided together";
    errors.push(msg);
    issues.push({ field: "aggregateRatingValue", message: msg, level: "error" });
  }

  // URL validations
  if (input.productUrl && !isValidUrl(input.productUrl)) {
    const msg = "Product URL must be a valid http(s) URL";
    errors.push(msg);
    issues.push({ field: "productUrl", message: msg, level: "error" });
  }
  if (input.productImageUrl && !isValidUrl(input.productImageUrl)) {
    const msg = "Product image URL must be a valid http(s) URL";
    errors.push(msg);
    issues.push({ field: "productImageUrl", message: msg, level: "error" });
  }

  // Date validation
  if (input.reviewDate && !isValidDate(input.reviewDate)) {
    const msg = "Review date must be YYYY-MM-DD";
    errors.push(msg);
    issues.push({ field: "reviewDate", message: msg, level: "error" });
  }

  // Price validation
  if (input.productPrice && !isValidPrice(input.productPrice)) {
    const msg = "Product price must be a non-negative number";
    errors.push(msg);
    issues.push({ field: "productPrice", message: msg, level: "error" });
  }

  // Recommended fields warnings
  for (const { field, label } of RECOMMENDED_FIELDS) {
    const v = input[field];
    if (!v || !String(v).trim()) {
      const msg = `${label} is recommended for Google rich results`;
      warnings.push(msg);
      issues.push({ field, message: msg, level: "warning" });
    }
  }

  // Description length warning
  if (input.reviewBody && input.reviewBody.length < 50) {
    const msg = "Review body is short — Google recommends detailed reviews (≥ 200 chars)";
    warnings.push(msg);
    issues.push({ field: "reviewBody", message: msg, level: "warning" });
  }

  return { ok: errors.length === 0, errors, warnings, issues };
}

/** Build the Product JSON-LD object with nested Review + AggregateRating. */
export function buildProductJsonLd(input: ReviewInput): Record<string, unknown> {
  const v = validate(input);
  if (!v.ok) throw new Error(v.errors.join("; "));

  const obj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.productName.trim(),
  };

  if (input.productBrand.trim()) {
    obj.brand = {
      "@type": "Brand",
      name: input.productBrand.trim(),
    };
  }
  if (input.productImageUrl.trim()) obj.image = input.productImageUrl.trim();
  if (input.productUrl.trim()) obj.url = input.productUrl.trim();
  if (input.productDescription.trim()) obj.description = input.productDescription.trim();
  if (input.productCategory.trim()) obj.category = input.productCategory.trim();
  if (input.productSku.trim()) obj.sku = input.productSku.trim();
  if (input.productGtin.trim()) obj.gtin = input.productGtin.trim();

  // Offers
  if (input.productPrice && isValidPrice(input.productPrice)) {
    obj.offers = {
      "@type": "Offer",
      price: Number(input.productPrice),
      priceCurrency: input.productCurrency,
      availability: AVAILABILITY_SCHEMA_URLS[input.productAvailability],
      ...(input.productUrl.trim() ? { url: input.productUrl.trim() } : {}),
    };
  }

  // Nested Review
  const reviewObj: Record<string, unknown> = {
    "@type": "Review",
    author: {
      "@type": "Person",
      name: input.reviewAuthor.trim(),
    },
    reviewRating: {
      "@type": "Rating",
      ratingValue: clampRating(Number(input.reviewRating)),
      bestRating: 5,
      worstRating: 1,
    },
  };
  if (input.reviewBody.trim()) reviewObj.reviewBody = input.reviewBody.trim();
  if (input.reviewDate.trim()) reviewObj.datePublished = input.reviewDate.trim();
  obj.review = reviewObj;

  // Aggregate rating (only if both provided)
  if (
    input.aggregateRatingCount &&
    input.aggregateRatingValue &&
    isValidRatingCount(input.aggregateRatingCount) &&
    isValidRating(input.aggregateRatingValue)
  ) {
    obj.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: clampRating(Number(input.aggregateRatingValue)),
      reviewCount: parseInt(input.aggregateRatingCount, 10),
    };
  }

  return obj;
}

/** Build a nested Review object alone (without Product wrapper). */
export function buildReviewObject(input: ReviewInput): Record<string, unknown> {
  if (!input.reviewAuthor.trim()) throw new Error("Review author is required");
  if (!isValidRating(input.reviewRating)) throw new Error("Review rating must be 1-5");
  const obj: Record<string, unknown> = {
    "@type": "Review",
    author: {
      "@type": "Person",
      name: input.reviewAuthor.trim(),
    },
    reviewRating: {
      "@type": "Rating",
      ratingValue: clampRating(Number(input.reviewRating)),
      bestRating: 5,
      worstRating: 1,
    },
  };
  if (input.reviewBody.trim()) obj.reviewBody = input.reviewBody.trim();
  if (input.reviewDate.trim()) obj.datePublished = input.reviewDate.trim();
  return obj;
}

/** Build an AggregateRating object alone. */
export function buildAggregateRating(input: ReviewInput): Record<string, unknown> | null {
  if (
    !input.aggregateRatingCount ||
    !input.aggregateRatingValue ||
    !isValidRatingCount(input.aggregateRatingCount) ||
    !isValidRating(input.aggregateRatingValue)
  ) {
    return null;
  }
  return {
    "@type": "AggregateRating",
    ratingValue: clampRating(Number(input.aggregateRatingValue)),
    reviewCount: parseInt(input.aggregateRatingCount, 10),
  };
}

/** Generate a BreadcrumbList companion schema (Home > Reviews > Product). */
export function buildBreadcrumbJsonLd(input: ReviewInput): Record<string, unknown> {
  const productName = input.productName.trim() || "Product";
  const items: unknown[] = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: input.productUrl.trim() ? new URL(input.productUrl.trim()).origin : "https://example.com",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Reviews",
      item: input.productUrl.trim() ? `${new URL(input.productUrl.trim()).origin}/reviews` : "https://example.com/reviews",
    },
    {
      "@type": "ListItem",
      position: 3,
      name: productName,
      ...(input.productUrl.trim() ? { item: input.productUrl.trim() } : {}),
    },
  ];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}

/** Generate 3 common FAQ questions for the product. */
export function generateFaqQuestions(input: ReviewInput): { q: string; a: string }[] {
  const name = input.productName.trim() || "this product";
  const category = input.productCategory.trim() || "this category";
  const brand = input.productBrand.trim() || "the manufacturer";
  return [
    {
      q: `Is the ${name} worth buying?`,
      a: `Based on our review of the ${name} by ${brand}, we evaluated its performance, features, and value for money in the ${category} category. Read the full review above for our verdict and detailed analysis.`,
    },
    {
      q: `How does the ${name} compare to other ${category}?`,
      a: `We compared the ${name} against the top alternatives in ${category}. Our review covers pros, cons, key differences, and which use cases each product fits best.`,
    },
    {
      q: `What are the pros and cons of the ${name}?`,
      a: `Our ${name} review highlights the main advantages and disadvantages based on hands-on testing. See the verdict section above for a quick summary of pros and cons.`,
    },
  ];
}

/** Build a FAQPage companion schema. */
export function buildFaqJsonLd(input: ReviewInput): Record<string, unknown> {
  const faqs = generateFaqQuestions(input);
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a,
      },
    })),
  };
}

/** Wrap any JSON-LD object in a <script type="application/ld+json"> tag. */
export function buildScriptTag(json: Record<string, unknown>): string {
  return `<script type="application/ld+json">\n${JSON.stringify(json, null, 2)}\n</script>`;
}

/** Build the full output: Product script tag. */
export function generateProductScript(input: ReviewInput): string {
  return buildScriptTag(buildProductJsonLd(input));
}

/** Build a combined HTML output with Product + Breadcrumb + optional FAQ. */
export function generateCombinedHtml(input: ReviewInput, includeFaq: boolean): string {
  const product = buildScriptTag(buildProductJsonLd(input));
  const breadcrumb = buildScriptTag(buildBreadcrumbJsonLd(input));
  const parts = [product, breadcrumb];
  if (includeFaq) parts.push(buildScriptTag(buildFaqJsonLd(input)));
  return parts.join("\n\n");
}

/** Generate a Google Rich Results test link (manual — user pastes code). */
export function buildGoogleRichResultsLink(): string {
  return "https://search.google.com/test/rich-results";
}

/** Generate Schema.org Product docs link. */
export function buildSchemaDocsLink(): string {
  return "https://schema.org/Product";
}

/** Generate Schema.org Review docs link. */
export function buildReviewDocsLink(): string {
  return "https://schema.org/Review";
}

/** Generate Google Product Review snippet docs link. */
export function buildGoogleProductReviewDocsLink(): string {
  return "https://developers.google.com/search/docs/appearance/structured-data/product";
}

export interface ComplianceCheck {
  compliant: boolean;
  passed: string[];
  failed: string[];
  recommendations: string[];
}

/** Check Google rich results compliance. */
export function checkCompliance(input: ReviewInput): ComplianceCheck {
  const passed: string[] = [];
  const failed: string[] = [];
  const recommendations: string[] = [];

  // Required checks
  if (input.productName.trim()) passed.push("Product name provided");
  else failed.push("Product name missing");

  if (input.reviewAuthor.trim()) passed.push("Review author provided");
  else failed.push("Review author missing");

  if (isValidRating(input.reviewRating)) passed.push(`Review rating valid (${clampRating(Number(input.reviewRating))}/5)`);
  else failed.push("Review rating missing or invalid (must be 1-5)");

  // Recommended checks
  if (input.productBrand.trim()) passed.push("Product brand provided");
  else recommendations.push("Add a product brand for richer snippets");

  if (input.productImageUrl.trim() && isValidUrl(input.productImageUrl)) passed.push("Valid product image URL");
  else recommendations.push("Add a valid product image URL (≥ 1 recommended)");

  if (input.productUrl.trim() && isValidUrl(input.productUrl)) passed.push("Valid product URL");
  else recommendations.push("Add a valid product URL");

  if (input.productPrice && isValidPrice(input.productPrice)) passed.push(`Price provided (${input.productCurrency} ${input.productPrice})`);
  else recommendations.push("Add price + currency for Offer-rich snippets");

  // Aggregate rating
  if (
    input.aggregateRatingCount &&
    input.aggregateRatingValue &&
    isValidRatingCount(input.aggregateRatingCount) &&
    isValidRating(input.aggregateRatingValue)
  ) {
    passed.push(`AggregateRating provided (${input.aggregateRatingValue}/5 from ${input.aggregateRatingCount} reviews)`);
  } else {
    recommendations.push("Add aggregate rating for star-rating rich results");
  }

  // Date
  if (input.reviewDate && isValidDate(input.reviewDate)) passed.push("Valid review date");
  else recommendations.push("Add review date (YYYY-MM-DD) for freshness signals");

  return {
    compliant: failed.length === 0,
    passed,
    failed,
    recommendations,
  };
}

export interface SummaryStats {
  requiredProvided: number;
  requiredTotal: number;
  recommendedProvided: number;
  recommendedTotal: number;
  validationStatus: "pass" | "fail";
  errorCount: number;
  warningCount: number;
  complianceStatus: "compliant" | "non-compliant";
  extras: { label: string; value: string }[];
}

/** Compute summary stats. */
export function computeSummaryStats(input: ReviewInput): SummaryStats {
  const v = validate(input);
  const c = checkCompliance(input);

  const requiredProvided = REQUIRED_FIELDS.filter((f) => {
    const val = input[f.field];
    return val && String(val).trim();
  }).length;
  const recommendedProvided = RECOMMENDED_FIELDS.filter((f) => {
    const val = input[f.field];
    return val && String(val).trim();
  }).length;

  return {
    requiredProvided,
    requiredTotal: REQUIRED_FIELDS.length,
    recommendedProvided,
    recommendedTotal: RECOMMENDED_FIELDS.length,
    validationStatus: v.ok ? "pass" : "fail",
    errorCount: v.errors.length,
    warningCount: v.warnings.length,
    complianceStatus: c.compliant ? "compliant" : "non-compliant",
    extras: [
      { label: "Currency", value: input.productCurrency },
      { label: "Availability", value: input.productAvailability },
      { label: "Has price", value: input.productPrice ? "Yes" : "No" },
      { label: "Has SKU", value: input.productSku ? "Yes" : "No" },
      { label: "Has GTIN", value: input.productGtin ? "Yes" : "No" },
      { label: "Has review body", value: input.reviewBody ? "Yes" : "No" },
    ],
  };
}

/** Render as a text report (JSON-LD + script tag). */
export function renderTextReport(input: ReviewInput, includeFaq: boolean): string {
  const v = validate(input);
  if (!v.ok) {
    return `VALIDATION FAILED\n${v.errors.join("\n")}`;
  }
  const lines: string[] = [];
  lines.push("=== PRODUCT REVIEW SCHEMA REPORT ===");
  lines.push("");
  lines.push("--- Product JSON-LD ---");
  lines.push(JSON.stringify(buildProductJsonLd(input), null, 2));
  lines.push("");
  lines.push("--- Product Script Tag ---");
  lines.push(generateProductScript(input));
  lines.push("");
  lines.push("--- BreadcrumbList Schema ---");
  lines.push(JSON.stringify(buildBreadcrumbJsonLd(input), null, 2));
  if (includeFaq) {
    lines.push("");
    lines.push("--- FAQPage Schema ---");
    lines.push(JSON.stringify(buildFaqJsonLd(input), null, 2));
  }
  lines.push("");
  lines.push("--- Compliance ---");
  const c = checkCompliance(input);
  lines.push(`Status: ${c.compliant ? "COMPLIANT" : "NON-COMPLIANT"}`);
  if (c.failed.length > 0) {
    lines.push(`Failed: ${c.failed.length}`);
    c.failed.forEach((f) => lines.push(`  ✗ ${f}`));
  }
  if (c.recommendations.length > 0) {
    lines.push(`Recommendations: ${c.recommendations.length}`);
    c.recommendations.forEach((r) => lines.push(`  → ${r}`));
  }
  return lines.join("\n");
}

/** Render as CSV (field, value). */
export function renderCsv(input: ReviewInput): string {
  const v = validate(input);
  const lines: string[] = ["field,value"];
  const pushRow = (field: string, value: string) => {
    const escaped = /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    lines.push(`${field},${escaped}`);
  };
  pushRow("productName", input.productName);
  pushRow("productBrand", input.productBrand);
  pushRow("productImageUrl", input.productImageUrl);
  pushRow("productUrl", input.productUrl);
  pushRow("productDescription", input.productDescription);
  pushRow("productCategory", input.productCategory);
  pushRow("productSku", input.productSku);
  pushRow("productGtin", input.productGtin);
  pushRow("productPrice", input.productPrice);
  pushRow("productCurrency", input.productCurrency);
  pushRow("productAvailability", input.productAvailability);
  pushRow("reviewAuthor", input.reviewAuthor);
  pushRow("reviewRating", input.reviewRating);
  pushRow("reviewBody", input.reviewBody);
  pushRow("reviewDate", input.reviewDate);
  pushRow("aggregateRatingCount", input.aggregateRatingCount);
  pushRow("aggregateRatingValue", input.aggregateRatingValue);
  pushRow("validationStatus", v.ok ? "pass" : "fail");
  pushRow("errorCount", String(v.errors.length));
  pushRow("warningCount", String(v.warnings.length));
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:product-review-schema-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  productName: string;
  productBrand: string;
  reviewRating: string;
  currency: Currency;
  hasAggregate: boolean;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
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

export function buildShareUrl(input: Partial<ReviewInput>): string {
  const params = new URLSearchParams();
  const fields: (keyof ReviewInput)[] = [
    "productName", "productBrand", "productImageUrl", "productUrl",
    "productDescription", "productCategory", "productSku", "productGtin",
    "productPrice", "productCurrency", "productAvailability",
    "reviewAuthor", "reviewRating", "reviewBody", "reviewDate",
    "aggregateRatingCount", "aggregateRatingValue",
  ];
  for (const f of fields) {
    const v = input[f];
    if (v === undefined || v === null || v === "") continue;
    params.set(f, String(v));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ReviewInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ReviewInput> = {};
  const validCurrencies = CURRENCIES as readonly string[];
  const validAvailabilities = AVAILABILITIES as readonly string[];
  for (const [k, v] of params.entries()) {
    if (k === "productCurrency") {
      if (validCurrencies.includes(v)) out.productCurrency = v as Currency;
    } else if (k === "productAvailability") {
      if (validAvailabilities.includes(v)) out.productAvailability = v as Availability;
    } else if (k === "productDescription" || k === "reviewBody") {
      // Try to decode +newlines preserved by URLSearchParams (already decoded)
      (out as Record<string, unknown>)[k] = v;
    } else {
      (out as Record<string, unknown>)[k] = v;
    }
  }
  return out;
}
