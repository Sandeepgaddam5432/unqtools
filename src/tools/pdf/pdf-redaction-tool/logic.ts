/**
 * PDF Redaction Tool — pure logic.
 *
 * Pure functions only — no DOM, no pdf-lib. The actual PDF drawing lives in
 * ui.tsx; this module handles parsing, validation, reporting, statistics,
 * history and shareable URLs.
 */
import type { ToolResult } from "../../../lib/tool";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type RedactColor = "black" | "white" | "dark-gray";

export type RedactMode = "text-search" | "area-coordinates" | "both";

export type SensitiveCategory =
  | "credit-card"
  | "ssn"
  | "email"
  | "phone"
  | "iban"
  | "ipv4";

export interface AreaRedaction {
  /** 1-based page number. */
  page: number;
  /** X coordinate of the rectangle's bottom-left corner (PDF user space). */
  x: number;
  /** Y coordinate of the rectangle's bottom-left corner (PDF user space). */
  y: number;
  width: number;
  height: number;
}

export interface TextRedaction {
  /** Original phrase the user wants to redact. */
  text: string;
  /** Number of occurrences located in the document. */
  foundCount: number;
}

export interface AppliedRedaction {
  type: "text" | "area";
  /** 1-based page number. */
  page: number;
  /** For text redactions: the matched phrase. For area redactions: empty. */
  text: string;
  /** Bounding rectangle drawn over the content (PDF user space). */
  rect: { x: number; y: number; width: number; height: number };
}

export interface PageBounds {
  page: number;
  width: number;
  height: number;
}

export interface SensitiveMatch {
  category: SensitiveCategory;
  value: string;
  /** 1-based page number where the match was found (0 if unknown). */
  page: number;
  /** 0-based character index inside the page text (-1 if unknown). */
  index: number;
}

export interface SummaryStats {
  totalRedactions: number;
  textRedactions: number;
  areaRedactions: number;
  pagesAffected: number;
  totalAreaRedacted: number;
  /** Average area per redaction (rounded). */
  avgAreaPerRedaction: number;
  /** 0-100 — what fraction of requested text phrases were actually found. */
  completenessScore: number;
  metadataStripped: boolean;
}

export interface RedactOptions {
  textToRedact: string;
  areaRedactions: string;
  redactColor: RedactColor;
  redactMode: RedactMode;
  removeMetadata: boolean;
  /** Page-range spec ("all" or "1-3, 5, 8-10") to restrict redaction. */
  pageRange: string;
}

export const REDACT_COLORS: RedactColor[] = ["black", "white", "dark-gray"];

export const REDACT_MODES: RedactMode[] = [
  "text-search",
  "area-coordinates",
  "both",
];

export const COLOR_LABELS: Record<RedactColor, string> = {
  black: "Black (default)",
  white: "White",
  "dark-gray": "Dark gray",
};

export const MODE_LABELS: Record<RedactMode, string> = {
  "text-search": "Text search (find & redact phrases)",
  "area-coordinates": "Area coordinates (rectangles by position)",
  both: "Both text + area",
};

/** RGB triplets in 0–1 range for pdf-lib's `rgb()` helper. */
export const COLOR_RGB: Record<RedactColor, { r: number; g: number; b: number }> = {
  black: { r: 0, g: 0, b: 0 },
  white: { r: 1, g: 1, b: 1 },
  "dark-gray": { r: 0.25, g: 0.25, b: 0.25 },
};

export const DEFAULT_OPTIONS: RedactOptions = {
  textToRedact: "",
  areaRedactions: "",
  redactColor: "black",
  redactMode: "text-search",
  removeMetadata: true,
  pageRange: "all",
};

export const METADATA_FIELDS = [
  "Title",
  "Author",
  "Subject",
  "Keywords",
  "Creator",
  "Producer",
  "CreationDate",
  "ModDate",
] as const;

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

/**
 * Parse the "text to redact" textarea (one phrase per line).
 * Trims each line, drops blanks and exact duplicates (case-sensitive).
 */
export function parseTextToRedact(input: string): string[] {
  if (!input) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/\r\n|\r|\n/)) {
    const phrase = raw.trim();
    if (!phrase) continue;
    if (seen.has(phrase)) continue;
    seen.add(phrase);
    out.push(phrase);
  }
  return out;
}

/**
 * Parse the "area redactions" textarea.
 * Accepts one rectangle per line in the form: page,x,y,width,height
 * Allows whitespace around numbers; supports leading `#` comment lines.
 */
export function parseAreaRedactions(
  input: string
): ToolResult<AreaRedaction[]> {
  if (!input || !input.trim()) return { ok: true, output: [] };
  const out: AreaRedaction[] = [];
  const lines = input.split(/\r\n|\r|\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(",").map((s) => s.trim());
    if (parts.length !== 5) {
      return {
        ok: false,
        error: `Line ${i + 1}: expected 5 comma-separated values (page,x,y,width,height), got ${parts.length}.`,
      };
    }
    const nums = parts.map((p) => Number(p));
    if (nums.some((n) => !Number.isFinite(n))) {
      return {
        ok: false,
        error: `Line ${i + 1}: all values must be numbers — got "${line}".`,
      };
    }
    const [page, x, y, width, height] = nums;
    if (!Number.isInteger(page) || page < 1) {
      return {
        ok: false,
        error: `Line ${i + 1}: page must be a positive integer (got ${page}).`,
      };
    }
    if (width <= 0 || height <= 0) {
      return {
        ok: false,
        error: `Line ${i + 1}: width and height must be positive (got ${width}×${height}).`,
      };
    }
    out.push({ page, x, y, width, height });
  }
  return { ok: true, output: out };
}

// ---------------------------------------------------------------------------
// Color lookup & rectangle helpers
// ---------------------------------------------------------------------------

/** Get the RGB triplet for a redact color (defaults to black on unknown). */
export function getRedactColorRgb(color: RedactColor): { r: number; g: number; b: number } {
  return COLOR_RGB[color] ?? COLOR_RGB.black;
}

/** True when a redaction rectangle fits entirely inside the given page bounds. */
export function isWithinBounds(
  area: Pick<AreaRedaction, "x" | "y" | "width" | "height">,
  pageWidth: number,
  pageHeight: number
): boolean {
  if (area.width <= 0 || area.height <= 0) return false;
  if (area.x < 0 || area.y < 0) return false;
  if (area.x + area.width > pageWidth + 0.5) return false;
  if (area.y + area.height > pageHeight + 0.5) return false;
  return true;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  /** Redactions that passed bounds checking. */
  valid: AreaRedaction[];
  /** Redactions that failed bounds checking. */
  invalid: AreaRedaction[];
}

/** Validate a list of area redactions against page bounds. */
export function validateRedactions(
  areas: AreaRedaction[],
  pageBounds: PageBounds[]
): ValidationResult {
  const errors: string[] = [];
  const valid: AreaRedaction[] = [];
  const invalid: AreaRedaction[] = [];
  const boundsByPage = new Map<number, PageBounds>();
  for (const pb of pageBounds) boundsByPage.set(pb.page, pb);
  for (const a of areas) {
    const bounds = boundsByPage.get(a.page);
    if (!bounds) {
      errors.push(`Page ${a.page} does not exist in the document.`);
      invalid.push(a);
      continue;
    }
    if (!isWithinBounds(a, bounds.width, bounds.height)) {
      errors.push(
        `Redaction on page ${a.page} at (${a.x}, ${a.y}) size ${a.width}×${a.height} exceeds page bounds (${bounds.width}×${bounds.height}).`
      );
      invalid.push(a);
      continue;
    }
    valid.push(a);
  }
  return { ok: errors.length === 0, errors, valid, invalid };
}

/**
 * Generate the actual rectangle parameters to pass to pdf-lib's
 * `page.drawRectangle`. Mostly a passthrough today, but centralizes the
 * boundary-clamping behavior so callers can rely on safe rectangles.
 */
export function generateRedactionRectangles(
  areas: AreaRedaction[],
  pageBounds: PageBounds[]
): AppliedRedaction[] {
  const boundsByPage = new Map<number, PageBounds>();
  for (const pb of pageBounds) boundsByPage.set(pb.page, pb);
  const out: AppliedRedaction[] = [];
  for (const a of areas) {
    const bounds = boundsByPage.get(a.page);
    if (!bounds) continue;
    const clampedWidth = Math.max(0, Math.min(a.width, bounds.width - a.x));
    const clampedHeight = Math.max(0, Math.min(a.height, bounds.height - a.y));
    if (clampedWidth <= 0 || clampedHeight <= 0) continue;
    out.push({
      type: "area",
      page: a.page,
      text: "",
      rect: { x: a.x, y: a.y, width: clampedWidth, height: clampedHeight },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Metadata stripper (pure description — the actual API calls live in ui.tsx)
// ---------------------------------------------------------------------------

export interface MetadataStripPlan {
  fields: readonly string[];
  /** New values to assign to each field. */
  values: Record<string, string>;
}

/** Build a metadata-strip plan that empties all known document-info fields. */
export function buildMetadataStripPlan(): MetadataStripPlan {
  const values: Record<string, string> = {};
  for (const f of METADATA_FIELDS) values[f] = "";
  return { fields: METADATA_FIELDS, values };
}

// ---------------------------------------------------------------------------
// Page-bounds checker
// ---------------------------------------------------------------------------

/** True when every redaction's page exists in the page-bounds list. */
export function checkPageBounds(
  areas: AreaRedaction[],
  pageBounds: PageBounds[]
): { ok: boolean; missing: number[] } {
  const valid = new Set(pageBounds.map((p) => p.page));
  const missing: number[] = [];
  for (const a of areas) {
    if (!valid.has(a.page) && !missing.includes(a.page)) missing.push(a.page);
  }
  return { ok: missing.length === 0, missing };
}

// ---------------------------------------------------------------------------
// Counters
// ---------------------------------------------------------------------------

/** Count total redactions that will be applied. */
export function countRedactions(
  text: TextRedaction[],
  areas: AreaRedaction[]
): number {
  const textCount = text.reduce((sum, t) => sum + t.foundCount, 0);
  return textCount + areas.length;
}

export interface AreaStats {
  perPage: Record<number, number>;
  total: number;
}

/** Calculate total redacted area, broken down per page. */
export function calculateRedactedArea(
  redactions: AppliedRedaction[]
): AreaStats {
  const perPage: Record<number, number> = {};
  let total = 0;
  for (const r of redactions) {
    const a = r.rect.width * r.rect.height;
    perPage[r.page] = (perPage[r.page] ?? 0) + a;
    total += a;
  }
  return { perPage, total };
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

/** Render applied redactions as a plain-text report. */
export function renderTextReport(
  textRedactions: TextRedaction[],
  areaRedactions: AreaRedaction[],
  applied: AppliedRedaction[],
  metadataStripped: boolean
): string {
  const lines: string[] = [];
  lines.push("=== PDF Redaction Report ===");
  lines.push("");
  lines.push(`Mode: text + area`);
  lines.push(`Color: (see options)`);
  lines.push(`Metadata stripped: ${metadataStripped ? "yes" : "no"}`);
  lines.push("");
  lines.push("--- Text redactions ---");
  if (textRedactions.length === 0) {
    lines.push("(none)");
  } else {
    for (const t of textRedactions) {
      lines.push(`• "${t.text}" → ${t.foundCount} occurrence(s)`);
    }
  }
  lines.push("");
  lines.push("--- Area redactions ---");
  if (areaRedactions.length === 0) {
    lines.push("(none)");
  } else {
    for (const a of areaRedactions) {
      lines.push(
        `• page ${a.page}: (${a.x}, ${a.y}) ${a.width}×${a.height}`
      );
    }
  }
  lines.push("");
  lines.push("--- Applied rectangles ---");
  if (applied.length === 0) {
    lines.push("(none)");
  } else {
    for (const r of applied) {
      lines.push(
        `• [${r.type}] page ${r.page}: (${r.rect.x}, ${r.rect.y}) ${r.rect.width}×${r.rect.height}${r.text ? ` "${r.text}"` : ""}`
      );
    }
  }
  lines.push("");
  const areaStats = calculateRedactedArea(applied);
  lines.push(`Total redacted area: ${areaStats.total.toFixed(1)} unit²`);
  for (const [page, area] of Object.entries(areaStats.perPage)) {
    lines.push(`  page ${page}: ${area.toFixed(1)} unit²`);
  }
  return lines.join("\n");
}

function escapeCsvCell(s: string): string {
  const str = s ?? "";
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/** Render redactions as CSV: type,page,x,y,width,height,original. */
export function renderCsvReport(
  textRedactions: TextRedaction[],
  areaRedactions: AreaRedaction[],
  applied: AppliedRedaction[]
): string {
  const rows: string[] = [
    "type,page,x,y,width,height,original_value_or_area",
  ];
  for (const t of textRedactions) {
    for (let i = 0; i < t.foundCount; i++) {
      rows.push(
        [
          "text",
          "",
          "",
          "",
          "",
          "",
          escapeCsvCell(t.text),
        ].join(",")
      );
    }
  }
  for (const a of areaRedactions) {
    rows.push(
      [
        "area",
        String(a.page),
        String(a.x),
        String(a.y),
        String(a.width),
        String(a.height),
        escapeCsvCell(`${a.width}x${a.height}`),
      ].join(",")
    );
  }
  for (const r of applied) {
    rows.push(
      [
        `applied:${r.type}`,
        String(r.page),
        String(r.rect.x),
        String(r.rect.y),
        String(r.rect.width),
        String(r.rect.height),
        escapeCsvCell(r.text),
      ].join(",")
    );
  }
  return rows.join("\n");
}

// ---------------------------------------------------------------------------
// Summary stats & completeness
// ---------------------------------------------------------------------------

/** Compute aggregate summary stats from the redaction plan. */
export function computeSummaryStats(
  textRedactions: TextRedaction[],
  areaRedactions: AreaRedaction[],
  applied: AppliedRedaction[],
  metadataStripped: boolean
): SummaryStats {
  const pages = new Set<number>();
  for (const a of areaRedactions) pages.add(a.page);
  for (const a of applied) pages.add(a.page);
  const { total } = calculateRedactedArea(applied);
  const totalRedactions = applied.length;
  const textApplied = applied.filter((a) => a.type === "text").length;
  const areaApplied = applied.filter((a) => a.type === "area").length;
  const requestedPhrases = textRedactions.length;
  const foundPhrases = textRedactions.filter((t) => t.foundCount > 0).length;
  const completenessScore =
    requestedPhrases === 0 ? 100 : Math.round((foundPhrases / requestedPhrases) * 100);
  return {
    totalRedactions,
    textRedactions: textApplied,
    areaRedactions: areaApplied,
    pagesAffected: pages.size,
    totalAreaRedacted: Math.round(total),
    avgAreaPerRedaction: totalRedactions > 0 ? Math.round(total / totalRedactions) : 0,
    completenessScore,
    metadataStripped,
  };
}

export interface CompletenessReport {
  allFound: boolean;
  found: string[];
  missing: string[];
  partial: { text: string; foundCount: number }[];
}

/**
 * Check whether every requested text-phrase was found at least once.
 * Phrases with foundCount > 0 are 'found'; those with 0 are 'missing'.
 * Phrases with foundCount > 0 but flagged partial (e.g. < expected) go to 'partial'.
 */
export function checkRedactionCompleteness(
  textRedactions: TextRedaction[],
  expectedCounts?: Record<string, number>
): CompletenessReport {
  const found: string[] = [];
  const missing: string[] = [];
  const partial: { text: string; foundCount: number }[] = [];
  for (const t of textRedactions) {
    if (t.foundCount === 0) {
      missing.push(t.text);
    } else {
      found.push(t.text);
      const expected = expectedCounts?.[t.text];
      if (expected !== undefined && t.foundCount < expected) {
        partial.push({ text: t.text, foundCount: t.foundCount });
      }
    }
  }
  return { allFound: missing.length === 0, found, missing, partial };
}

// ---------------------------------------------------------------------------
// Page-range filter
// ---------------------------------------------------------------------------

/** Filter area redactions to only those whose page appears in `indices` (0-based). */
export function filterAreasByPageIndices(
  areas: AreaRedaction[],
  indices: number[]
): AreaRedaction[] {
  const allowed = new Set(indices.map((i) => i + 1));
  return areas.filter((a) => allowed.has(a.page));
}

// ---------------------------------------------------------------------------
// Sensitive-data pattern detector
// ---------------------------------------------------------------------------

interface PatternDef {
  category: SensitiveCategory;
  regex: RegExp;
  /** Strip whitespace and dashes before testing. */
  normalize?: boolean;
}

const PATTERNS: PatternDef[] = [
  // Credit card (13–19 digits, optional dashes/spaces, basic Luhn skipped)
  {
    category: "credit-card",
    regex: /\b(?:\d[ -]*?){13,19}\b/g,
    normalize: true,
  },
  // US SSN (XXX-XX-XXXX, not 000/666/9XX series)
  {
    category: "ssn",
    regex: /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g,
  },
  // Email
  {
    category: "email",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  // Phone (US + international basic)
  {
    category: "phone",
    regex: /(?:\+?\d[\d\s().-]{7,}\d)/g,
  },
  // IBAN (basic — 2 letters + 2 digits + 11–30 alphanumerics)
  {
    category: "iban",
    regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g,
  },
  // IPv4
  {
    category: "ipv4",
    regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  },
];

const CATEGORY_LABELS: Record<SensitiveCategory, string> = {
  "credit-card": "Credit card number",
  ssn: "US Social Security Number",
  email: "Email address",
  phone: "Phone number",
  iban: "IBAN",
  ipv4: "IPv4 address",
};

export { CATEGORY_LABELS as SENSITIVE_CATEGORY_LABELS };

/**
 * Detect sensitive-data patterns in a chunk of text.
 * Returns one match per occurrence, with the page number supplied by the caller.
 */
export function detectSensitiveData(
  text: string,
  page: number = 0
): SensitiveMatch[] {
  const out: SensitiveMatch[] = [];
  const t = text ?? "";
  for (const def of PATTERNS) {
    def.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = def.regex.exec(t)) !== null) {
      const value = m[0];
      // For credit cards, sanity-check that there are 13–19 digits.
      if (def.category === "credit-card") {
        const digits = value.replace(/\D/g, "");
        if (digits.length < 13 || digits.length > 19) continue;
      }
      // For phone, require at least 7 digits.
      if (def.category === "phone") {
        const digits = value.replace(/\D/g, "");
        if (digits.length < 7) continue;
      }
      // For IPv4, validate each octet 0–255.
      if (def.category === "ipv4") {
        const octets = value.split(".").map(Number);
        if (octets.some((o) => !Number.isFinite(o) || o < 0 || o > 255)) continue;
      }
      out.push({
        category: def.category,
        value,
        page,
        index: m.index,
      });
    }
  }
  return out;
}

export interface SensitiveSuggestion {
  category: SensitiveCategory;
  /** Unique values found (deduped). */
  values: string[];
  totalOccurrences: number;
}

/** Suggest phrases that should be redacted based on detected sensitive data. */
export function suggestAutoRedactions(
  matches: SensitiveMatch[]
): SensitiveSuggestion[] {
  const byCat = new Map<SensitiveCategory, SensitiveSuggestion>();
  for (const m of matches) {
    let s = byCat.get(m.category);
    if (!s) {
      s = { category: m.category, values: [], totalOccurrences: 0 };
      byCat.set(m.category, s);
    }
    if (!s.values.includes(m.value)) s.values.push(m.value);
    s.totalOccurrences += 1;
  }
  return Array.from(byCat.values()).sort((a, b) =>
    a.category.localeCompare(b.category)
  );
}

// ---------------------------------------------------------------------------
// Redaction-strength verifier
// ---------------------------------------------------------------------------

export interface TextBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Verify that a redaction rectangle fully covers the given text bounds.
 * Returns true when the rectangle contains the text bounds (with a small
 * tolerance for floating-point error).
 */
export function verifyRedactionStrength(
  redaction: { x: number; y: number; width: number; height: number },
  textBounds: TextBounds,
  tolerance: number = 0.5
): boolean {
  const coversX = redaction.x - tolerance <= textBounds.x;
  const coversY = redaction.y - tolerance <= textBounds.y;
  const coversRight =
    redaction.x + redaction.width + tolerance >= textBounds.x + textBounds.width;
  const coversTop =
    redaction.y + redaction.height + tolerance >= textBounds.y + textBounds.height;
  return coversX && coversY && coversRight && coversTop;
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-redaction-tool:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  fileName: string;
  textCount: number;
  areaCount: number;
  appliedCount: number;
  color: RedactColor;
  mode: RedactMode;
  metadataStripped: boolean;
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
      // ignore quota errors
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

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

const VALID_COLORS = new Set<RedactColor>(REDACT_COLORS);
const VALID_MODES = new Set<RedactMode>(REDACT_MODES);

export function buildShareUrl(opts: RedactOptions): string {
  const params = new URLSearchParams();
  if (opts.textToRedact) params.set("text", opts.textToRedact);
  if (opts.areaRedactions) params.set("areas", opts.areaRedactions);
  if (opts.redactColor !== "black") params.set("color", opts.redactColor);
  if (opts.redactMode !== "text-search") params.set("mode", opts.redactMode);
  if (!opts.removeMetadata) params.set("meta", "0");
  if (opts.pageRange && opts.pageRange !== "all") params.set("range", opts.pageRange);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<RedactOptions> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<RedactOptions> = {};
  const text = params.get("text");
  if (text) out.textToRedact = text;
  const areas = params.get("areas");
  if (areas) out.areaRedactions = areas;
  const color = params.get("color");
  if (color && VALID_COLORS.has(color as RedactColor)) out.redactColor = color as RedactColor;
  const mode = params.get("mode");
  if (mode && VALID_MODES.has(mode as RedactMode)) out.redactMode = mode as RedactMode;
  const meta = params.get("meta");
  if (meta !== null) out.removeMetadata = meta !== "0";
  const range = params.get("range");
  if (range) out.pageRange = range;
  return out;
}

// ---------------------------------------------------------------------------
// Convenience validator for the full options object
// ---------------------------------------------------------------------------

export function validateOptions(
  opts: RedactOptions
): ToolResult<RedactOptions> {
  if (!opts) return { ok: false, error: "Missing options." };
  if (!VALID_COLORS.has(opts.redactColor)) {
    return { ok: false, error: `Unknown redact color: ${opts.redactColor}` };
  }
  if (!VALID_MODES.has(opts.redactMode)) {
    return { ok: false, error: `Unknown redact mode: ${opts.redactMode}` };
  }
  const phrases = parseTextToRedact(opts.textToRedact);
  const areas = parseAreaRedactions(opts.areaRedactions);
  if (!areas.ok) return areas;
  if (opts.redactMode === "text-search" && phrases.length === 0) {
    return { ok: false, error: "Enter at least one phrase to redact (one per line)." };
  }
  if (opts.redactMode === "area-coordinates" && areas.output.length === 0) {
    return { ok: false, error: "Enter at least one area redaction (page,x,y,width,height)." };
  }
  if (opts.redactMode === "both" && phrases.length === 0 && areas.output.length === 0) {
    return { ok: false, error: "Enter text to redact and/or area redactions." };
  }
  return { ok: true, output: { ...opts } };
}
