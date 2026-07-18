/**
 * Structured Data Validator — pure logic.
 *
 * Validate JSON-LD structured data against Schema.org types. Pure functions
 * only — no DOM, no network.
 */

export type SchemaType =
  | "Article"
  | "Product"
  | "Event"
  | "Organization"
  | "LocalBusiness"
  | "Person"
  | "Recipe"
  | "Review"
  | "FAQPage"
  | "HowTo"
  | "BreadcrumbList"
  | "VideoObject";

export interface FieldSpec {
  key: string;
  label: string;
  required: boolean;
  type: "string" | "url" | "date" | "number" | "image" | "array" | "object";
  recommended?: boolean;
}

export interface SchemaSpec {
  type: SchemaType;
  description: string;
  fields: FieldSpec[];
}

export const SCHEMA_SPECS: Record<SchemaType, SchemaSpec> = {
  Article: {
    type: "Article",
    description: "News article, blog post, or long-form content.",
    fields: [
      { key: "headline", label: "headline", required: true, type: "string" },
      { key: "image", label: "image", required: true, type: "image" },
      { key: "datePublished", label: "datePublished", required: true, type: "date" },
      { key: "author", label: "author", required: true, type: "object" },
      { key: "publisher", label: "publisher", required: true, type: "object" },
      { key: "dateModified", label: "dateModified", required: false, type: "date", recommended: true },
      { key: "url", label: "url", required: false, type: "url", recommended: true },
      { key: "description", label: "description", required: false, type: "string", recommended: true },
    ],
  },
  Product: {
    type: "Product",
    description: "Retail product listing with offers.",
    fields: [
      { key: "name", label: "name", required: true, type: "string" },
      { key: "image", label: "image", required: true, type: "image" },
      { key: "brand", label: "brand", required: true, type: "object" },
      { key: "offers", label: "offers", required: true, type: "object" },
      { key: "description", label: "description", required: false, type: "string", recommended: true },
      { key: "sku", label: "sku", required: false, type: "string", recommended: true },
      { key: "aggregateRating", label: "aggregateRating", required: false, type: "object", recommended: true },
    ],
  },
  Event: {
    type: "Event",
    description: "An upcoming event with location and dates.",
    fields: [
      { key: "name", label: "name", required: true, type: "string" },
      { key: "startDate", label: "startDate", required: true, type: "date" },
      { key: "location", label: "location", required: true, type: "object" },
      { key: "endDate", label: "endDate", required: false, type: "date", recommended: true },
      { key: "description", label: "description", required: false, type: "string", recommended: true },
      { key: "image", label: "image", required: false, type: "image", recommended: true },
      { key: "offers", label: "offers", required: false, type: "object", recommended: true },
    ],
  },
  Organization: {
    type: "Organization",
    description: "A company, non-profit, or other organization.",
    fields: [
      { key: "name", label: "name", required: true, type: "string" },
      { key: "url", label: "url", required: true, type: "url" },
      { key: "logo", label: "logo", required: true, type: "image" },
      { key: "description", label: "description", required: false, type: "string", recommended: true },
      { key: "email", label: "email", required: false, type: "string", recommended: true },
      { key: "telephone", label: "telephone", required: false, type: "string", recommended: true },
      { key: "address", label: "address", required: false, type: "object", recommended: true },
    ],
  },
  LocalBusiness: {
    type: "LocalBusiness",
    description: "A physical store or service business.",
    fields: [
      { key: "name", label: "name", required: true, type: "string" },
      { key: "image", label: "image", required: true, type: "image" },
      { key: "address", label: "address", required: true, type: "object" },
      { key: "telephone", label: "telephone", required: true, type: "string" },
      { key: "url", label: "url", required: false, type: "url", recommended: true },
      { key: "priceRange", label: "priceRange", required: false, type: "string", recommended: true },
      { key: "openingHoursSpecification", label: "openingHoursSpecification", required: false, type: "array", recommended: true },
      { key: "geo", label: "geo", required: false, type: "object", recommended: true },
    ],
  },
  Person: {
    type: "Person",
    description: "An individual (author, founder, public figure).",
    fields: [
      { key: "name", label: "name", required: true, type: "string" },
      { key: "url", label: "url", required: false, type: "url", recommended: true },
      { key: "image", label: "image", required: false, type: "image", recommended: true },
      { key: "jobTitle", label: "jobTitle", required: false, type: "string", recommended: true },
      { key: "email", label: "email", required: false, type: "string", recommended: true },
      { key: "worksFor", label: "worksFor", required: false, type: "object", recommended: true },
    ],
  },
  Recipe: {
    type: "Recipe",
    description: "A cooking recipe with ingredients and instructions.",
    fields: [
      { key: "name", label: "name", required: true, type: "string" },
      { key: "image", label: "image", required: true, type: "image" },
      { key: "author", label: "author", required: true, type: "object" },
      { key: "datePublished", label: "datePublished", required: true, type: "date" },
      { key: "recipeIngredient", label: "recipeIngredient", required: true, type: "array" },
      { key: "recipeInstructions", label: "recipeInstructions", required: true, type: "array" },
      { key: "prepTime", label: "prepTime", required: false, type: "string", recommended: true },
      { key: "cookTime", label: "cookTime", required: false, type: "string", recommended: true },
      { key: "recipeYield", label: "recipeYield", required: false, type: "string", recommended: true },
    ],
  },
  Review: {
    type: "Review",
    description: "A review of an item, business, or content.",
    fields: [
      { key: "itemReviewed", label: "itemReviewed", required: true, type: "object" },
      { key: "author", label: "author", required: true, type: "object" },
      { key: "datePublished", label: "datePublished", required: true, type: "date" },
      { key: "reviewRating", label: "reviewRating", required: true, type: "object" },
      { key: "reviewBody", label: "reviewBody", required: false, type: "string", recommended: true },
      { key: "publisher", label: "publisher", required: false, type: "object", recommended: true },
    ],
  },
  FAQPage: {
    type: "FAQPage",
    description: "A page of frequently asked questions.",
    fields: [
      { key: "mainEntity", label: "mainEntity", required: true, type: "array" },
    ],
  },
  HowTo: {
    type: "HowTo",
    description: "Step-by-step instructions for a task.",
    fields: [
      { key: "name", label: "name", required: true, type: "string" },
      { key: "step", label: "step", required: true, type: "array" },
      { key: "description", label: "description", required: false, type: "string", recommended: true },
      { key: "totalTime", label: "totalTime", required: false, type: "string", recommended: true },
    ],
  },
  BreadcrumbList: {
    type: "BreadcrumbList",
    description: "Breadcrumb navigation trail.",
    fields: [
      { key: "itemListElement", label: "itemListElement", required: true, type: "array" },
    ],
  },
  VideoObject: {
    type: "VideoObject",
    description: "A video clip or movie.",
    fields: [
      { key: "name", label: "name", required: true, type: "string" },
      { key: "thumbnailUrl", label: "thumbnailUrl", required: true, type: "image" },
      { key: "contentUrl", label: "contentUrl", required: true, type: "url" },
      { key: "uploadDate", label: "uploadDate", required: true, type: "date" },
      { key: "description", label: "description", required: false, type: "string", recommended: true },
      { key: "duration", label: "duration", required: false, type: "string", recommended: true },
    ],
  },
};

export const SUPPORTED_TYPES = Object.keys(SCHEMA_SPECS) as SchemaType[];

export interface SchemaIssue {
  level: "error" | "warning";
  field: string;
  message: string;
}

export interface SchemaValidationResult {
  type: SchemaType | string | null;
  isSupported: boolean;
  errors: SchemaIssue[];
  warnings: SchemaIssue[];
  missingRequired: string[];
  missingRecommended: string[];
  ok: boolean;
}

export interface ValidationResult {
  ok: boolean;
  parseError: string | null;
  schemas: Array<{ index: number; type: string | null; result: SchemaValidationResult }>;
  totalErrors: number;
  totalWarnings: number;
}

/** Strip a <script type="application/ld+json">…</script> wrapper if present. */
export function stripScriptTag(input: string): string {
  if (!input) return "";
  const m = input.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i);
  if (m) return m[1].trim();
  return input.trim();
}

/** Detect the @type of a JSON-LD object. */
export function detectType(obj: unknown): SchemaType | string | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const t = o["@type"];
  if (typeof t === "string") return t;
  if (Array.isArray(t)) return t[0] ?? null;
  return null;
}

/** Check if a value is "present" (non-empty). */
export function isPresent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

export function isValidUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidIsoDate(value: string): boolean {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/.test(value);
}

export function isValidNumber(value: unknown): boolean {
  if (typeof value === "number") return !isNaN(value);
  if (typeof value === "string") return !isNaN(parseFloat(value));
  return false;
}

/** Validate a single schema object against its spec. */
export function validateSchema(obj: Record<string, unknown>): SchemaValidationResult {
  const type = detectType(obj);
  if (!type) {
    return {
      type: null,
      isSupported: false,
      errors: [{ level: "error", field: "@type", message: "Missing or invalid @type field" }],
      warnings: [],
      missingRequired: [],
      missingRecommended: [],
      ok: false,
    };
  }
  if (!SUPPORTED_TYPES.includes(type as SchemaType)) {
    return {
      type,
      isSupported: false,
      errors: [{ level: "error", field: "@type", message: `Unsupported schema type: ${type}` }],
      warnings: [],
      missingRequired: [],
      missingRecommended: [],
      ok: false,
    };
  }
  const spec = SCHEMA_SPECS[type as SchemaType];
  const errors: SchemaIssue[] = [];
  const warnings: SchemaIssue[] = [];
  const missingRequired: string[] = [];
  const missingRecommended: string[] = [];
  for (const f of spec.fields) {
    const value = obj[f.key];
    if (!isPresent(value)) {
      if (f.required) {
        errors.push({ level: "error", field: f.key, message: `Missing required field: ${f.label}` });
        missingRequired.push(f.key);
      } else if (f.recommended) {
        warnings.push({ level: "warning", field: f.key, message: `Missing recommended field: ${f.label}` });
        missingRecommended.push(f.key);
      }
      continue;
    }
    // Type checks (only for present values)
    if (f.type === "url" && !isValidUrl(String(value))) {
      errors.push({ level: "error", field: f.key, message: `${f.label} must be a valid http(s) URL` });
    }
    if (f.type === "image" && !isValidUrl(String(value))) {
      errors.push({ level: "error", field: f.key, message: `${f.label} must be a valid image URL` });
    }
    if (f.type === "date" && !isValidIsoDate(String(value))) {
      errors.push({ level: "error", field: f.key, message: `${f.label} must be a valid ISO date (YYYY-MM-DD)` });
    }
    if (f.type === "number" && !isValidNumber(value)) {
      errors.push({ level: "error", field: f.key, message: `${f.label} must be numeric` });
    }
    if (f.type === "array" && !Array.isArray(value)) {
      errors.push({ level: "error", field: f.key, message: `${f.label} must be an array` });
    }
    if (f.type === "object" && (typeof value !== "object" || Array.isArray(value))) {
      errors.push({ level: "error", field: f.key, message: `${f.label} must be an object` });
    }
  }
  return {
    type,
    isSupported: true,
    errors,
    warnings,
    missingRequired,
    missingRecommended,
    ok: errors.length === 0,
  };
}

/** Validate a JSON-LD string (single object OR @graph array). */
export function validate(input: string): ValidationResult {
  const cleaned = stripScriptTag(input);
  if (!cleaned) {
    return {
      ok: false,
      parseError: "Input is empty",
      schemas: [],
      totalErrors: 0,
      totalWarnings: 0,
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return {
      ok: false,
      parseError: e instanceof Error ? e.message : "Invalid JSON",
      schemas: [],
      totalErrors: 1,
      totalWarnings: 0,
    };
  }
  // Handle @graph array
  const obj = parsed as Record<string, unknown>;
  let schemasToValidate: Record<string, unknown>[];
  if (Array.isArray(obj)) {
    schemasToValidate = obj as Record<string, unknown>[];
  } else if (obj["@graph"] && Array.isArray(obj["@graph"])) {
    schemasToValidate = obj["@graph"] as Record<string, unknown>[];
  } else if (obj["@type"]) {
    schemasToValidate = [obj];
  } else {
    return {
      ok: false,
      parseError: "No @type or @graph found in JSON-LD",
      schemas: [],
      totalErrors: 1,
      totalWarnings: 0,
    };
  }
  const results = schemasToValidate.map((s, i) => {
    const r = validateSchema(s);
    return { index: i, type: r.type, result: r };
  });
  const totalErrors = results.reduce((acc, r) => acc + r.result.errors.length, 0);
  const totalWarnings = results.reduce((acc, r) => acc + r.result.warnings.length, 0);
  return {
    ok: totalErrors === 0,
    parseError: null,
    schemas: results,
    totalErrors,
    totalWarnings,
  };
}

/** Get required fields for a type. */
export function getRequiredFields(type: SchemaType): FieldSpec[] {
  return SCHEMA_SPECS[type].fields.filter((f) => f.required);
}

/** Get recommended (optional) fields for a type. */
export function getRecommendedFields(type: SchemaType): FieldSpec[] {
  return SCHEMA_SPECS[type].fields.filter((f) => !f.required && f.recommended);
}

/** Build a Google Rich Results test link. */
export function buildGoogleRichResultsLink(): string {
  return "https://search.google.com/test/rich-results";
}

/** Build a Schema.org docs link. */
export function buildSchemaDocsLink(type: string): string {
  return `https://schema.org/${type}`;
}

// ---- History ----

const HISTORY_KEY = "unqtools:structured-data-validator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  schemaCount: number;
  totalErrors: number;
  totalWarnings: number;
  types: string[];
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

export function buildShareUrl(input: string): string {
  const params = new URLSearchParams();
  if (input) params.set("ld", input);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { input: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { input: "" };
  const params = new URLSearchParams(clean);
  return { input: params.get("ld") ?? "" };
}
