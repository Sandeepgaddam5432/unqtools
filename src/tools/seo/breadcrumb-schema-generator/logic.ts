/**
 * Breadcrumb Schema Generator — pure logic.
 *
 * Generate BreadcrumbList JSON-LD for rich results.
 * Pure functions only — no DOM, no network.
 */

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface BreadcrumbInput {
  items: BreadcrumbItem[];
}

export const NAME_MAX = 80;
export const MIN_ITEMS = 2;
export const MAX_ITEMS = 50;

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

/** Validate a single breadcrumb item. */
export function validateItem(item: BreadcrumbItem, index: number): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!item.name || !item.name.trim()) {
    errors.push(`Item #${index + 1}: name is empty`);
  } else if (item.name.length > NAME_MAX) {
    warnings.push(`Item #${index + 1}: name is long (${item.name.length} chars)`);
  }
  if (!item.url || !item.url.trim()) {
    errors.push(`Item #${index + 1}: URL is empty`);
  } else if (!isValidUrl(item.url.trim())) {
    errors.push(`Item #${index + 1}: URL is invalid (must be http/https)`);
  }
  return { errors, warnings };
}

/** Validate the full breadcrumb input. */
export function validateInput(input: BreadcrumbInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!Array.isArray(input.items) || input.items.length === 0) {
    errors.push("At least one breadcrumb item is required");
    return { ok: false, errors, warnings };
  }
  if (input.items.length < MIN_ITEMS) {
    errors.push(`At least ${MIN_ITEMS} breadcrumb items are recommended for rich results`);
  }
  if (input.items.length > MAX_ITEMS) {
    warnings.push(`Too many breadcrumb items (${input.items.length}) — consider simplifying`);
  }
  for (let i = 0; i < input.items.length; i++) {
    const r = validateItem(input.items[i], i);
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  }
  // Detect duplicate URLs
  const seen = new Set<string>();
  for (let i = 0; i < input.items.length; i++) {
    const u = (input.items[i].url || "").trim().toLowerCase();
    if (u && seen.has(u)) {
      warnings.push(`Item #${i + 1}: duplicate URL detected`);
    }
    seen.add(u);
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** Parse a bulk paste of breadcrumbs, one per line: "Name | URL" or "Name,URL" or "URL Name". */
export function parseBulkItems(text: string): BreadcrumbItem[] {
  if (!text || !text.trim()) return [];
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const items: BreadcrumbItem[] = [];
  for (const line of lines) {
    // Try pipe-separated first
    if (line.includes("|")) {
      const [name, url] = line.split("|").map((s) => s.trim());
      if (name && url) items.push({ name, url });
      continue;
    }
    // Try comma-separated when first part isn't a URL
    if (line.includes(",")) {
      const parts = line.split(",").map((s) => s.trim());
      if (parts.length >= 2 && isValidUrl(parts[1])) {
        items.push({ name: parts[0], url: parts[1] });
        continue;
      }
    }
    // Try tab-separated
    if (line.includes("\t")) {
      const [name, url] = line.split("\t").map((s) => s.trim());
      if (name && url) items.push({ name, url });
      continue;
    }
    // Try space-separated with URL detection
    const match = line.match(/^(.*?)\s+(https?:\/\/\S+)$/);
    if (match) {
      items.push({ name: match[1].trim(), url: match[2].trim() });
      continue;
    }
  }
  return items;
}

/** Build the BreadcrumbList JSON-LD object. */
export function buildJsonLd(input: BreadcrumbInput): Record<string, unknown> {
  const v = validateInput(input);
  // Allow warnings — only block on errors
  if (!v.ok) throw new Error(v.errors.join("; "));
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: input.items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name.trim(),
      item: it.url.trim(),
    })),
  };
}

/** Wrap a JSON-LD object in a <script type="application/ld+json"> tag. */
export function buildScriptTag(json: Record<string, unknown>): string {
  return `<script type="application/ld+json">\n${JSON.stringify(json, null, 2)}\n</script>`;
}

export function generateBreadcrumbSchema(input: BreadcrumbInput): string {
  return buildScriptTag(buildJsonLd(input));
}

/** Combine multiple BreadcrumbList blocks (e.g., multi-language) into a @graph. */
export function generateMultiBreadcrumb(inputs: BreadcrumbInput[]): string {
  if (inputs.length === 0) throw new Error("At least one breadcrumb block is required");
  const graph = inputs.map((i) => buildJsonLd(i));
  return buildScriptTag({
    "@context": "https://schema.org",
    "@graph": graph,
  });
}

/** Render a human-readable preview of the breadcrumb trail. */
export function renderPreview(input: BreadcrumbInput): string {
  if (!input.items || input.items.length === 0) return "";
  return input.items.map((it) => it.name).join("  ›  ");
}

/** Build a Google Rich Results test link. */
export function buildGoogleRichResultsLink(url: string): string {
  return `https://search.google.com/test/rich-results?url=${encodeURIComponent(url || "https://example.com")}`;
}

/** Build a Schema.org docs link. */
export function buildSchemaDocsLink(): string {
  return "https://schema.org/BreadcrumbList";
}

/** Reorder helpers — pure array operations. */
export function moveItem(items: BreadcrumbItem[], from: number, to: number): BreadcrumbItem[] {
  if (from < 0 || from >= items.length) return items;
  if (to < 0 || to >= items.length) return items;
  if (from === to) return items;
  const next = items.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

export function moveUp(items: BreadcrumbItem[], index: number): BreadcrumbItem[] {
  return moveItem(items, index, index - 1);
}

export function moveDown(items: BreadcrumbItem[], index: number): BreadcrumbItem[] {
  return moveItem(items, index, index + 1);
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:breadcrumb-schema-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  itemCount: number;
  snippet: string;
  preview: string;
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

export function buildShareUrl(input: BreadcrumbInput): string {
  const params = new URLSearchParams();
  params.set("items", JSON.stringify(input.items));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<BreadcrumbInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const items = params.get("items");
  if (!items) return {};
  try {
    const parsed = JSON.parse(items);
    if (!Array.isArray(parsed)) return {};
    return { items: parsed as BreadcrumbItem[] };
  } catch {
    return {};
  }
}
