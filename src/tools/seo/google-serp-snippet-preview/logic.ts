/**
 * Google SERP Snippet Preview — pure logic.
 * Pixel-accurate approximation of Google's desktop + mobile SERP truncation,
 * with rich-element helpers (breadcrumb, date, rating, sitelinks, FAQ),
 * query keyword bolding, and HTML import.
 *
 * Reference: blueprint §5 (feature set) and §10 (acceptance criteria).
 * 100% client-side, no network.
 */

/** Pixel cutoffs (versioned — last reviewed Jun 2026 per blueprint). */
export const SERP_LIMITS = {
  titleDesktopPx: 580,
  titleMobilePx: 520,
  descriptionDesktopPx: 920,
  descriptionMobilePx: 990,
  titleSoftCharLimit: 60,
  descriptionSoftCharLimit: 160,
} as const;

export type DeviceMode = "desktop" | "mobile";

export interface SerpInput {
  title: string;
  url: string;
  description: string;
  query?: string;
  breadcrumb?: string[];
  date?: string;          // ISO 8601 or display string
  rating?: { value: number; count: number };
  sitelinks?: string[];
  faq?: { q: string; a: string }[];
  favicon?: boolean;
  darkMode?: boolean;
}

export interface SerpPreview {
  device: DeviceMode;
  title: string;
  titleTruncated: boolean;
  url: string;             // possibly shortened with ellipsis
  breadcrumbPath: string;  // joined with ›
  description: string;
  descriptionTruncated: boolean;
  boldRanges: { field: "title" | "description"; start: number; end: number }[];
  warnings: string[];
}

export interface SerpResult {
  desktop: SerpPreview;
  mobile: SerpPreview;
  titlePixelWidth: number;
  descriptionPixelWidth: number;
  richElements: {
    hasFavicon: boolean;
    hasBreadcrumb: boolean;
    hasDate: boolean;
    hasRating: boolean;
    hasSitelinks: boolean;
    hasFaq: boolean;
  };
  warnings: string[];
}

/**
 * Weighted per-character pixel-width estimator.
 * Approximates Arial/Roboto at typical SERP sizes.
 */
export function estimatePixelWidth(text: string, fontScale = 1): number {
  let width = 0;
  for (const ch of text) {
    if (ch === " ") width += 4;
    else if (ch === "i" || ch === "l" || ch === "1" || ch === "|" || ch === ".") width += 4;
    else if (ch === "I" || ch === "J") width += 5;
    else if (/[mwMW@]/.test(ch)) width += 13;
    else if (/[A-Z]/.test(ch)) width += 10;
    else if (/[a-z]/.test(ch)) width += 7.5;
    else if (/[0-9]/.test(ch)) width += 8;
    else if (/[!,;:]/.test(ch)) width += 4;
    else if (/[“”‘’"'`]/.test(ch)) width += 5;
    else if (ch === "\t") width += 12;
    else if (/[\u4e00-\u9fff]/.test(ch)) width += 16;  // CJK
    else if (/\p{Emoji}/u.test(ch)) width += 18;
    else width += 6;
  }
  return Math.round(width * fontScale);
}

/** Truncate text so its pixel width fits within `maxPx`, appending ellipsis. */
export function truncateToPixels(text: string, maxPx: number): { text: string; truncated: boolean } {
  if (estimatePixelWidth(text) <= maxPx) return { text, truncated: false };
  // Binary-search the longest prefix whose width including "…" fits.
  let lo = 0;
  let hi = text.length;
  const ellipsis = "…";
  const ellipsisPx = estimatePixelWidth(ellipsis);
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = text.slice(0, mid);
    if (estimatePixelWidth(candidate) + ellipsisPx <= maxPx) lo = mid;
    else hi = mid - 1;
  }
  // Skip trailing whitespace/punctuation for clean look.
  let cut = lo;
  while (cut > 0 && /[\s.,;:!?-]/.test(text[cut - 1]!)) cut--;
  if (cut === 0) cut = lo;
  return { text: text.slice(0, cut).trimEnd() + ellipsis, truncated: true };
}

/** Build a breadcrumb path joined with ›. */
export function buildBreadcrumbPath(parts: string[]): string {
  return parts.filter(Boolean).join(" › ");
}

/** Display URL: strip protocol, lowercase host, trim trailing slash (except root). */
export function displayUrl(url: string): string {
  let u = url.trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    const parsed = new URL(u);
    let host = parsed.host.toLowerCase();
    if (host.startsWith("www.")) host = host.slice(4);
    let path = parsed.pathname.replace(/\/$/, "");
    if (parsed.search) path += parsed.search;
    return host + path;
  } catch {
    return u.replace(/^https?:\/\//i, "").toLowerCase();
  }
}

/** Tokenize a query into lowercase term set (for bolding). */
export function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/** Find ranges in `text` matching any term in `terms` (case-insensitive, word-ish boundaries). */
export function findBoldRanges(
  text: string,
  terms: string[]
): { start: number; end: number }[] {
  if (terms.length === 0) return [];
  const ranges: { start: number; end: number }[] = [];
  const lower = text.toLowerCase();
  for (const term of terms) {
    if (!term) continue;
    let idx = lower.indexOf(term);
    while (idx !== -1) {
      ranges.push({ start: idx, end: idx + term.length });
      idx = lower.indexOf(term, idx + term.length);
    }
  }
  // Merge overlapping ranges.
  if (ranges.length === 0) return [];
  ranges.sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [ranges[0]!];
  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1]!;
    const cur = ranges[i]!;
    if (cur.start <= last.end) last.end = Math.max(last.end, cur.end);
    else merged.push(cur);
  }
  return merged;
}

/** Build a single device preview. */
function buildPreview(input: SerpInput, device: DeviceMode): SerpPreview {
  const warnings: string[] = [];
  const titlePx = estimatePixelWidth(input.title);
  const descPx = estimatePixelWidth(input.description);
  const titleLimit = device === "desktop" ? SERP_LIMITS.titleDesktopPx : SERP_LIMITS.titleMobilePx;
  const descLimit = device === "desktop" ? SERP_LIMITS.descriptionDesktopPx : SERP_LIMITS.descriptionMobilePx;

  // Build effective description (with date prefix if present).
  let effectiveDesc = input.description;
  if (input.date) effectiveDesc = `${input.date} — ` + effectiveDesc;

  const titleT = truncateToPixels(input.title, titleLimit);
  const descT = truncateToPixels(effectiveDesc, descLimit);

  if (titlePx > titleLimit) warnings.push(`${device} title will be truncated (~${titlePx}px > ${titleLimit}px).`);
  if (descPx > descLimit) warnings.push(`${device} description will be truncated (~${descPx}px > ${descLimit}px).`);
  if (input.title.length === 0) warnings.push(`${device}: title is empty.`);
  if (input.description.length === 0) warnings.push(`${device}: description is empty.`);

  const terms = tokenizeQuery(input.query ?? "");
  const boldRanges: SerpPreview["boldRanges"] = [];
  const titleRanges = findBoldRanges(titleT.text, terms).map((r) => ({ field: "title" as const, ...r }));
  const descRanges = findBoldRanges(descT.text, terms).map((r) => ({ field: "description" as const, ...r }));
  boldRanges.push(...titleRanges, ...descRanges);

  return {
    device,
    title: titleT.text,
    titleTruncated: titleT.truncated,
    url: displayUrl(input.url),
    breadcrumbPath: buildBreadcrumbPath(input.breadcrumb ?? []),
    description: descT.text,
    descriptionTruncated: descT.truncated,
    boldRanges,
    warnings,
  };
}

/** Main entry: build both desktop + mobile previews + summary. */
export function buildSerpPreview(input: SerpInput): SerpResult | { error: string } {
  if (!input.title) return { error: "Title is required." };
  if (!input.description) return { error: "Description is required." };
  if (input.title.length > 300) return { error: "Title is too long (max 300 chars)." };
  if (input.description.length > 1000) return { error: "Description is too long (max 1000 chars)." };
  if (input.rating && (input.rating.value < 0 || input.rating.value > 5 || input.rating.count < 0)) {
    return { error: "Rating must be 0–5 and count ≥ 0." };
  }

  const desktop = buildPreview(input, "desktop");
  const mobile = buildPreview(input, "mobile");
  const titlePx = estimatePixelWidth(input.title);
  const descPx = estimatePixelWidth(input.description);
  const warnings = Array.from(new Set([...desktop.warnings, ...mobile.warnings]));

  return {
    desktop,
    mobile,
    titlePixelWidth: titlePx,
    descriptionPixelWidth: descPx,
    richElements: {
      hasFavicon: !!input.favicon,
      hasBreadcrumb: (input.breadcrumb?.length ?? 0) > 0,
      hasDate: !!input.date,
      hasRating: !!input.rating,
      hasSitelinks: (input.sitelinks?.length ?? 0) > 0,
      hasFaq: (input.faq?.length ?? 0) > 0,
    },
    warnings,
  };
}

/** Import <title> + <meta name="description"> from pasted HTML. */
export function importFromHtml(html: string): { title: string; description: string; url?: string } {
  let title = "";
  let description = "";
  let url: string | undefined;
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) title = titleMatch[1]!.replace(/\s+/g, " ").trim();
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']/i);
  if (descMatch) description = descMatch[1]!.replace(/\s+/g, " ").trim();
  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([\s\S]*?)["']/i);
  if (canonicalMatch) url = canonicalMatch[1]!.trim();
  return { title, description, url };
}

/** Strip HTML tags from a pasted string (helper for cleaning). */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Render preview text to JSX-friendly segments for bolding (caller composes tags). */
export function segmentsForBold(
  text: string,
  ranges: { start: number; end: number }[]
): { text: string; bold: boolean }[] {
  if (ranges.length === 0) return [{ text, bold: false }];
  const segments: { text: string; bold: boolean }[] = [];
  let cursor = 0;
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  for (const r of sorted) {
    if (r.start > cursor) segments.push({ text: text.slice(cursor, r.start), bold: false });
    segments.push({ text: text.slice(r.start, r.end), bold: true });
    cursor = r.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), bold: false });
  return segments;
}

/** Encode a shareable preset (base64 of JSON) for collaboration. */
export function encodePreset(input: SerpInput): string {
  try {
    return btoa(unescape(encodeURIComponent(JSON.stringify(input))));
  } catch {
    return "";
  }
}

/** Decode a shareable preset. */
export function decodePreset(encoded: string): SerpInput | { error: string } {
  try {
    const json = decodeURIComponent(escape(atob(encoded)));
    const parsed = JSON.parse(json) as SerpInput;
    if (typeof parsed.title !== "string" || typeof parsed.description !== "string") {
      return { error: "Invalid preset." };
    }
    return parsed;
  } catch {
    return { error: "Could not decode preset." };
  }
}
