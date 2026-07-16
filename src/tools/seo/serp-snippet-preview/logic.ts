/**
 * SERP Snippet Preview — pure logic.
 */

export interface SerpInput {
  title: string;
  url: string;
  description: string;
  datePrefix?: string; // e.g. "Jan 1, 2026"
  richResult?: boolean;
  breadcrumb?: string; // e.g. "Home › Blog › Article"
  faviconUrl?: string;
}

export const TITLE_MAX_CHARS = 60;
export const DESCRIPTION_MAX_CHARS = 160;
export const TITLE_MAX_PX_DESKTOP = 600;
export const TITLE_MAX_PX_MOBILE = 600;
export const DESCRIPTION_MAX_PX_DESKTOP = 980;
export const DESCRIPTION_MAX_PX_MOBILE = 1200;

/** Approximate average pixel width per character (Google uses Arial for SERP). */
const PIXEL_PER_CHAR = 9;

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Estimate pixel width of a string using Google's approximate character widths. */
export function estimatePixelWidth(value: string, charsPerPx = PIXEL_PER_CHAR): number {
  if (!value) return 0;
  let width = 0;
  for (const ch of value) {
    if (/[\u1100-\u11FF\u3000-\u9FFF\uAC00-\uD7A3\u{1F000}-\u{1FAFF}]/u.test(ch)) {
      width += charsPerPx * 2;
    } else if (ch === "i" || ch === "l" || ch === "1" || ch === "|" || ch === ".") {
      width += charsPerPx * 0.5;
    } else if (ch === "W" || ch === "M" || ch === "O" || ch === "0" || ch === "@") {
      width += charsPerPx * 1.4;
    } else if (ch === " ") {
      width += charsPerPx * 0.5;
    } else {
      width += charsPerPx;
    }
  }
  return Math.round(width);
}

export interface CharCount {
  value: number;
  max: number;
  remaining: number;
  isOver: boolean;
  isWarn: boolean;
}

export function countChars(value: string, max: number): CharCount {
  const v = value ?? "";
  return {
    value: v.length,
    max,
    remaining: max - v.length,
    isOver: v.length > max,
    isWarn: v.length > max * 0.9 && v.length <= max,
  };
}

/** Truncate a string to fit within maxPx pixels. */
export function truncateForPixelLimit(value: string, maxPx: number): string {
  if (!value) return "";
  let width = 0;
  let out = "";
  for (const ch of value) {
    const w = estimatePixelWidth(ch);
    if (width + w > maxPx - 12) {
      return out + "…";
    }
    out += ch;
    width += w;
  }
  return out;
}

/** Truncate a string to a character limit. */
export function truncateForCharLimit(value: string, max: number): string {
  if (!value) return "";
  if (value.length <= max) return value;
  return value.slice(0, max - 1) + "…";
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

/** Format the URL display — strip protocol, show as Google does. */
export function formatUrlDisplay(url: string): { host: string; path: string; full: string } {
  if (!url) return { host: "", path: "", full: "" };
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      path: u.pathname === "/" ? "" : u.pathname,
      full: `${u.hostname}${u.pathname}${u.search}`,
    };
  } catch {
    return { host: url, path: "", full: url };
  }
}

export interface SerpPreview {
  title: string;
  truncatedTitle: string;
  urlDisplay: string;
  host: string;
  path: string;
  breadcrumb: string;
  description: string;
  truncatedDescription: string;
  datePrefix: string;
  richResult: boolean;
  faviconUrl: string;
  titleOverLimit: boolean;
  descOverLimit: boolean;
}

export function buildSerpPreview(input: SerpInput, mode: "desktop" | "mobile" = "desktop"): SerpPreview {
  const urlDisplay = formatUrlDisplay(input.url);
  const titleMaxPx = mode === "desktop" ? TITLE_MAX_PX_DESKTOP : TITLE_MAX_PX_MOBILE;
  const descMaxPx = mode === "desktop" ? DESCRIPTION_MAX_PX_DESKTOP : DESCRIPTION_MAX_PX_MOBILE;
  const truncatedTitle = truncateForPixelLimit(input.title || "", titleMaxPx);
  let truncatedDesc = truncateForPixelLimit(input.description || "", descMaxPx);
  if (input.datePrefix) {
    const prefix = `${input.datePrefix} — `;
    const remainingPx = descMaxPx - estimatePixelWidth(prefix);
    const descBody = truncateForPixelLimit(input.description || "", remainingPx);
    truncatedDesc = `${prefix}${descBody}`;
  }
  return {
    title: input.title || "",
    truncatedTitle,
    urlDisplay: urlDisplay.full,
    host: urlDisplay.host,
    path: urlDisplay.path,
    breadcrumb: input.breadcrumb || "",
    description: input.description || "",
    truncatedDescription: truncatedDesc,
    datePrefix: input.datePrefix || "",
    richResult: !!input.richResult,
    faviconUrl: input.faviconUrl || "",
    titleOverLimit: input.title.length > TITLE_MAX_CHARS || estimatePixelWidth(input.title) > titleMaxPx,
    descOverLimit: input.description.length > DESCRIPTION_MAX_CHARS || estimatePixelWidth(input.description) > descMaxPx,
  };
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateSerpInput(input: SerpInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!input.title || !input.title.trim()) {
    errors.push("Title is required");
  } else if (input.title.length > TITLE_MAX_CHARS + 20) {
    warnings.push("Title is very long and will be truncated in SERPs");
  }
  if (!input.url || !input.url.trim()) {
    errors.push("URL is required");
  } else if (!isValidUrl(input.url)) {
    errors.push("URL is invalid");
  }
  if (!input.description || !input.description.trim()) {
    warnings.push("Description is empty — Google may auto-generate one from page content");
  } else if (input.description.length > DESCRIPTION_MAX_CHARS + 30) {
    warnings.push("Description is very long and will be truncated");
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** Compute a click-through-rate estimate based on title length, description length, and rich result. */
export function estimateCtr(input: SerpInput): { score: number; label: string } {
  let score = 50;
  if (input.title && input.title.length >= 30 && input.title.length <= TITLE_MAX_CHARS) {
    score += 15;
  } else if (input.title && input.title.length > TITLE_MAX_CHARS) {
    score -= 10;
  }
  if (input.description && input.description.length >= 70 && input.description.length <= DESCRIPTION_MAX_CHARS) {
    score += 15;
  } else if (input.description && input.description.length > DESCRIPTION_MAX_CHARS) {
    score -= 5;
  }
  if (input.richResult) score += 20;
  if (input.datePrefix) score += 5;
  if (input.breadcrumb) score += 5;
  if (score > 100) score = 100;
  if (score < 0) score = 0;
  let label = "Low";
  if (score >= 80) label = "Excellent";
  else if (score >= 65) label = "Good";
  else if (score >= 50) label = "Fair";
  return { score, label };
}

// ---- History ----
const HISTORY_KEY = "unqtools:serp-snippet-preview:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  title: string;
  url: string;
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

export function buildShareUrl(input: SerpInput): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "boolean") {
      if (v) params.set(k, "1");
    } else {
      params.set(k, String(v));
    }
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<SerpInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) {
    out[k] = v;
  }
  const result = out as Partial<SerpInput>;
  if (out.richResult) {
    result.richResult = out.richResult === "1" || out.richResult === "true";
  }
  return result;
}
