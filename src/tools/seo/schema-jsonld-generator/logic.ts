/**
 * Schema.org JSON-LD Generator — pure logic.
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

export interface SchemaField {
  key: string;
  label: string;
  required: boolean;
  type: "string" | "url" | "date" | "number" | "image" | "array";
  placeholder?: string;
}

export interface SchemaTemplate {
  type: SchemaType;
  description: string;
  fields: SchemaField[];
}

export const SCHEMA_TEMPLATES: Record<SchemaType, SchemaTemplate> = {
  Article: {
    type: "Article",
    description: "News article, blog post, or long-form content.",
    fields: [
      { key: "headline", label: "Headline", required: true, type: "string", placeholder: "Article title (max 110 chars)" },
      { key: "image", label: "Image URL", required: true, type: "image", placeholder: "https://example.com/article.jpg" },
      { key: "datePublished", label: "Date published", required: true, type: "date" },
      { key: "dateModified", label: "Date modified", required: false, type: "date" },
      { key: "author", label: "Author name", required: true, type: "string" },
      { key: "publisher", label: "Publisher name", required: true, type: "string" },
      { key: "url", label: "Article URL", required: false, type: "url" },
      { key: "description", label: "Description", required: false, type: "string" },
    ],
  },
  Product: {
    type: "Product",
    description: "Retail product listing with offers.",
    fields: [
      { key: "name", label: "Product name", required: true, type: "string" },
      { key: "image", label: "Image URL", required: true, type: "image" },
      { key: "description", label: "Description", required: false, type: "string" },
      { key: "sku", label: "SKU", required: false, type: "string" },
      { key: "brand", label: "Brand", required: true, type: "string" },
      { key: "price", label: "Price", required: true, type: "number" },
      { key: "priceCurrency", label: "Currency (ISO 4217)", required: true, type: "string", placeholder: "USD" },
      { key: "availability", label: "Availability", required: false, type: "string", placeholder: "https://schema.org/InStock" },
    ],
  },
  Event: {
    type: "Event",
    description: "An upcoming event with location and dates.",
    fields: [
      { key: "name", label: "Event name", required: true, type: "string" },
      { key: "startDate", label: "Start date", required: true, type: "date" },
      { key: "endDate", label: "End date", required: false, type: "date" },
      { key: "location", label: "Location name", required: true, type: "string" },
      { key: "address", label: "Address", required: false, type: "string" },
      { key: "description", label: "Description", required: false, type: "string" },
      { key: "image", label: "Image URL", required: false, type: "image" },
      { key: "url", label: "Event URL", required: false, type: "url" },
      { key: "offersPrice", label: "Ticket price", required: false, type: "number" },
      { key: "offersCurrency", label: "Currency", required: false, type: "string", placeholder: "USD" },
    ],
  },
  Organization: {
    type: "Organization",
    description: "A company, non-profit, or other organization.",
    fields: [
      { key: "name", label: "Name", required: true, type: "string" },
      { key: "url", label: "Website URL", required: true, type: "url" },
      { key: "logo", label: "Logo URL", required: true, type: "image" },
      { key: "description", label: "Description", required: false, type: "string" },
      { key: "email", label: "Email", required: false, type: "string" },
      { key: "telephone", label: "Telephone", required: false, type: "string" },
      { key: "address", label: "Address", required: false, type: "string" },
    ],
  },
  LocalBusiness: {
    type: "LocalBusiness",
    description: "A physical store or service business.",
    fields: [
      { key: "name", label: "Business name", required: true, type: "string" },
      { key: "image", label: "Image URL", required: true, type: "image" },
      { key: "address", label: "Address", required: true, type: "string" },
      { key: "telephone", label: "Telephone", required: true, type: "string" },
      { key: "url", label: "Website", required: false, type: "url" },
      { key: "priceRange", label: "Price range", required: false, type: "string", placeholder: "$$, $$$" },
      { key: "openingHours", label: "Opening hours", required: false, type: "string", placeholder: "Mo-Fr 09:00-17:00" },
    ],
  },
  Person: {
    type: "Person",
    description: "An individual (author, founder, public figure).",
    fields: [
      { key: "name", label: "Full name", required: true, type: "string" },
      { key: "url", label: "Website", required: false, type: "url" },
      { key: "image", label: "Photo URL", required: false, type: "image" },
      { key: "jobTitle", label: "Job title", required: false, type: "string" },
      { key: "email", label: "Email", required: false, type: "string" },
      { key: "worksFor", label: "Works for", required: false, type: "string" },
    ],
  },
  Recipe: {
    type: "Recipe",
    description: "A cooking recipe with ingredients and instructions.",
    fields: [
      { key: "name", label: "Recipe name", required: true, type: "string" },
      { key: "image", label: "Image URL", required: true, type: "image" },
      { key: "author", label: "Author", required: true, type: "string" },
      { key: "datePublished", label: "Date published", required: true, type: "date" },
      { key: "prepTime", label: "Prep time", required: false, type: "string", placeholder: "PT15M" },
      { key: "cookTime", label: "Cook time", required: false, type: "string", placeholder: "PT30M" },
      { key: "recipeYield", label: "Yield", required: false, type: "string", placeholder: "4 servings" },
      { key: "recipeIngredients", label: "Ingredients (comma-separated)", required: true, type: "array" },
      { key: "recipeInstructions", label: "Instructions (semicolon-separated)", required: true, type: "array" },
    ],
  },
  Review: {
    type: "Review",
    description: "A review of an item, business, or content.",
    fields: [
      { key: "itemReviewed", label: "Item reviewed", required: true, type: "string" },
      { key: "reviewBody", label: "Review body", required: false, type: "string" },
      { key: "author", label: "Author", required: true, type: "string" },
      { key: "datePublished", label: "Date published", required: true, type: "date" },
      { key: "ratingValue", label: "Rating value (1-5)", required: true, type: "number" },
      { key: "bestRating", label: "Best rating", required: false, type: "number", placeholder: "5" },
      { key: "publisher", label: "Publisher", required: false, type: "string" },
    ],
  },
  FAQPage: {
    type: "FAQPage",
    description: "A page of frequently asked questions.",
    fields: [
      { key: "faqs", label: "Q&A pairs (one per line: Question? | Answer)", required: true, type: "array" },
    ],
  },
  HowTo: {
    type: "HowTo",
    description: "Step-by-step instructions for a task.",
    fields: [
      { key: "name", label: "How-to title", required: true, type: "string" },
      { key: "description", label: "Description", required: false, type: "string" },
      { key: "totalTime", label: "Total time", required: false, type: "string", placeholder: "PT45M" },
      { key: "steps", label: "Steps (one per line)", required: true, type: "array" },
    ],
  },
  BreadcrumbList: {
    type: "BreadcrumbList",
    description: "Breadcrumb navigation trail.",
    fields: [
      { key: "breadcrumbs", label: "Breadcrumbs (one per line: Name | URL)", required: true, type: "array" },
    ],
  },
  VideoObject: {
    type: "VideoObject",
    description: "A video clip or movie.",
    fields: [
      { key: "name", label: "Video title", required: true, type: "string" },
      { key: "description", label: "Description", required: false, type: "string" },
      { key: "thumbnailUrl", label: "Thumbnail URL", required: true, type: "image" },
      { key: "contentUrl", label: "Content URL", required: true, type: "url" },
      { key: "uploadDate", label: "Upload date", required: true, type: "date" },
      { key: "duration", label: "Duration (ISO 8601)", required: false, type: "string", placeholder: "PT5M30S" },
    ],
  },
};

export const SCHEMA_TYPES = Object.keys(SCHEMA_TEMPLATES) as SchemaType[];

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
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
  // Accept YYYY-MM-DD or YYYY-MM-DDTHH:mm
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/.test(value);
}

/** Convert a raw form value into the right JSON-LD value. */
function coerceValue(value: string, type: SchemaField["type"]): unknown {
  if (type === "number") {
    const n = parseFloat(value);
    return isNaN(n) ? value : n;
  }
  if (type === "array") {
    // Split on newline, semicolon, or pipe — depending on the field's intent
    return value
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return value;
}

/** Validate the form values against the template's required fields. */
export function validateValues(type: SchemaType, values: Record<string, string>): ValidationResult {
  const tmpl = SCHEMA_TEMPLATES[type];
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const f of tmpl.fields) {
    const v = values[f.key] || "";
    if (f.required && !v.trim()) {
      errors.push(`${f.label} is required`);
      continue;
    }
    if (!v.trim()) continue;
    if (f.type === "url" && !isValidUrl(v)) {
      errors.push(`${f.label} must be a valid http(s) URL`);
    }
    if (f.type === "image" && !isValidUrl(v)) {
      errors.push(`${f.label} must be a valid image URL`);
    }
    if (f.type === "date" && !isValidIsoDate(v)) {
      errors.push(`${f.label} must be a valid ISO date (YYYY-MM-DD)`);
    }
    if (f.type === "number" && isNaN(parseFloat(v))) {
      warnings.push(`${f.label} should be numeric`);
    }
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** Build a JSON-LD object for the given type and values. */
export function buildJsonLd(
  type: SchemaType,
  values: Record<string, string>,
  customProps: Record<string, unknown> = {},
): Record<string, unknown> {
  const v = validateValues(type, values);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const tmpl = SCHEMA_TEMPLATES[type];
  const obj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": type,
  };
  for (const f of tmpl.fields) {
    const raw = values[f.key] || "";
    if (!raw.trim()) continue;
    if (type === "FAQPage" && f.key === "faqs") {
      const lines = raw.split(/\n+/).map((s) => s.trim()).filter(Boolean);
      obj.mainEntity = lines.map((line) => {
        const [q, ...a] = line.split("|");
        return {
          "@type": "Question",
          name: (q || "").trim(),
          acceptedAnswer: { "@type": "Answer", text: a.join("|").trim() },
        };
      });
      continue;
    }
    if (type === "BreadcrumbList" && f.key === "breadcrumbs") {
      const lines = raw.split(/\n+/).map((s) => s.trim()).filter(Boolean);
      obj.itemListElement = lines.map((line, i) => {
        const [name, url] = line.split("|");
        return {
          "@type": "ListItem",
          position: i + 1,
          name: (name || "").trim(),
          item: (url || "").trim(),
        };
      });
      continue;
    }
    if (type === "HowTo" && f.key === "steps") {
      const lines = raw.split(/\n+/).map((s) => s.trim()).filter(Boolean);
      obj.step = lines.map((line, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: line,
      }));
      continue;
    }
    if (type === "Recipe" && f.key === "recipeIngredients") {
      obj.recipeIngredient = raw.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean);
      continue;
    }
    if (type === "Recipe" && f.key === "recipeInstructions") {
      obj.recipeInstructions = raw.split(/[;\n]+/).map((s) => s.trim()).filter(Boolean);
      continue;
    }
    if (f.key === "author" || f.key === "publisher" || f.key === "brand") {
      obj[f.key] = { "@type": type === "Review" && f.key === "author" ? "Person" : "Organization", name: raw };
      continue;
    }
    obj[f.key] = coerceValue(raw, f.type);
  }
  // Merge custom properties
  for (const [k, v] of Object.entries(customProps)) {
    if (v !== undefined && v !== null && v !== "") obj[k] = v;
  }
  return obj;
}

/** Build a JSON-LD script tag (string). */
export function buildScriptTag(json: Record<string, unknown>): string {
  return `<script type="application/ld+json">\n${JSON.stringify(json, null, 2)}\n</script>`;
}

export function generateSchema(
  type: SchemaType,
  values: Record<string, string>,
  customProps: Record<string, unknown> = {},
): string {
  const json = buildJsonLd(type, values, customProps);
  return buildScriptTag(json);
}

/** Build a @graph multi-schema script tag. */
export function generateMultiSchema(
  schemas: Array<{ type: SchemaType; values: Record<string, string> }>,
): string {
  if (schemas.length === 0) throw new Error("At least one schema is required");
  const graph = schemas.map((s) => buildJsonLd(s.type, s.values));
  const wrapper = {
    "@context": "https://schema.org",
    "@graph": graph,
  };
  return buildScriptTag(wrapper);
}

export function getRequiredFields(type: SchemaType): SchemaField[] {
  return SCHEMA_TEMPLATES[type].fields.filter((f) => f.required);
}

export function buildGoogleRichResultsLink(url: string): string {
  return `https://search.google.com/test/rich-results?url=${encodeURIComponent(url || "https://example.com")}`;
}

export function buildSchemaDocsLink(type: SchemaType): string {
  return `https://schema.org/${type}`;
}

// ---- History ----
const HISTORY_KEY = "unqtools:schema-jsonld-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  type: SchemaType;
  snippet: string;
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

export function buildShareUrl(type: SchemaType, values: Record<string, string>): string {
  const params = new URLSearchParams();
  params.set("type", type);
  for (const [k, v] of Object.entries(values)) {
    if (v) params.set(k, v);
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { type?: SchemaType; values: Record<string, string> } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { values: {} };
  const params = new URLSearchParams(clean);
  const values: Record<string, string> = {};
  let type: SchemaType | undefined;
  for (const [k, v] of params.entries()) {
    if (k === "type") {
      type = v as SchemaType;
    } else {
      values[k] = v;
    }
  }
  return { type, values };
}
