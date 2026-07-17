/**
 * Responsive Search Ad Builder — pure logic.
 *
 * Build Google Responsive Search Ads (RSA) with headlines (max 15, 30 chars each),
 * descriptions (max 4, 90 chars each), final URL, display URL, path fields.
 * Pin headlines to positions, count characters, estimate ad strength.
 *
 * Pure functions only — no DOM, no network.
 */

export type PinPosition = "pinned-h1" | "pinned-h2" | "pinned-h3" | "pinned-d1" | "pinned-d2" | "none";

export interface Headline {
  id: number;
  text: string;
  pin: Exclude<PinPosition, "pinned-d1" | "pinned-d2">;
}

export interface Description {
  id: number;
  text: string;
  pin: Exclude<PinPosition, "pinned-h1" | "pinned-h2" | "pinned-h3">;
}

export interface RsaInput {
  headlines: Headline[];
  descriptions: Description[];
  finalUrl: string;
  displayUrl?: string;
  path1?: string;
  path2?: string;
}

export const HEADLINE_MAX = 30;
export const DESCRIPTION_MAX = 90;
export const PATH_MAX = 15;
export const MAX_HEADLINES = 15;
export const MAX_DESCRIPTIONS = 4;
export const MIN_HEADLINES = 3;
export const MIN_DESCRIPTIONS = 2;

export type StrengthLevel = "poor" | "average" | "good" | "excellent";

export interface StrengthEstimate {
  level: StrengthLevel;
  score: number; // 0-100
  reason: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface CharCount {
  text: string;
  length: number;
  max: number;
  remaining: number;
  isOver: boolean;
  isWarn: boolean;
}

/** Validate a URL. */
export function isValidUrl(url: string): boolean {
  if (!url || !url.trim()) return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Compute character count for a text field. */
export function charCount(text: string, max: number): CharCount {
  const t = text ?? "";
  return {
    text: t,
    length: t.length,
    max,
    remaining: max - t.length,
    isOver: t.length > max,
    isWarn: t.length > max * 0.9 && t.length <= max,
  };
}

/** Validate headlines: count, length, pin positions. */
export function validateHeadlines(headlines: Headline[]): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nonEmpty = headlines.filter((h) => h.text.trim());
  if (nonEmpty.length < MIN_HEADLINES) {
    errors.push(`Need at least ${MIN_HEADLINES} headlines, have ${nonEmpty.length}.`);
  }
  if (nonEmpty.length > MAX_HEADLINES) {
    errors.push(`Too many headlines: ${nonEmpty.length} (max ${MAX_HEADLINES}).`);
  }
  // Character length checks
  for (const h of nonEmpty) {
    if (h.text.length > HEADLINE_MAX) {
      errors.push(`Headline "${h.text.slice(0, 20)}..." is ${h.text.length} chars (max ${HEADLINE_MAX}).`);
    }
  }
  // Duplicate headlines
  const seen = new Set<string>();
  for (const h of nonEmpty) {
    const key = h.text.toLowerCase().trim();
    if (seen.has(key)) {
      warnings.push(`Duplicate headline: "${h.text}".`);
    }
    seen.add(key);
  }
  // Pin position validation: each pin position can hold max 3 headlines
  const pinCounts: Record<string, number> = { "pinned-h1": 0, "pinned-h2": 0, "pinned-h3": 0, "none": 0 };
  for (const h of nonEmpty) {
    pinCounts[h.pin] = (pinCounts[h.pin] || 0) + 1;
  }
  for (const pos of ["pinned-h1", "pinned-h2", "pinned-h3"]) {
    if (pinCounts[pos] > 3) {
      warnings.push(`${pinCounts[pos]} headlines pinned to position ${pos.replace("pinned-", "").toUpperCase()} (max 3 per position).`);
    }
  }
  return { errors, warnings };
}

/** Validate descriptions: count, length, pin positions. */
export function validateDescriptions(descriptions: Description[]): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nonEmpty = descriptions.filter((d) => d.text.trim());
  if (nonEmpty.length < MIN_DESCRIPTIONS) {
    errors.push(`Need at least ${MIN_DESCRIPTIONS} descriptions, have ${nonEmpty.length}.`);
  }
  if (nonEmpty.length > MAX_DESCRIPTIONS) {
    errors.push(`Too many descriptions: ${nonEmpty.length} (max ${MAX_DESCRIPTIONS}).`);
  }
  for (const d of nonEmpty) {
    if (d.text.length > DESCRIPTION_MAX) {
      errors.push(`Description "${d.text.slice(0, 20)}..." is ${d.text.length} chars (max ${DESCRIPTION_MAX}).`);
    }
  }
  const seen = new Set<string>();
  for (const d of nonEmpty) {
    const key = d.text.toLowerCase().trim();
    if (seen.has(key)) {
      warnings.push(`Duplicate description: "${d.text}".`);
    }
    seen.add(key);
  }
  const pinCounts: Record<string, number> = { "pinned-d1": 0, "pinned-d2": 0, "none": 0 };
  for (const d of nonEmpty) {
    pinCounts[d.pin] = (pinCounts[d.pin] || 0) + 1;
  }
  for (const pos of ["pinned-d1", "pinned-d2"]) {
    if (pinCounts[pos] > 2) {
      warnings.push(`${pinCounts[pos]} descriptions pinned to ${pos.replace("pinned-", "").toUpperCase()} (max 2 per position).`);
    }
  }
  return { errors, warnings };
}

/** Validate paths: length and characters. */
export function validatePaths(path1?: string, path2?: string): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const [label, p] of [["Path 1", path1], ["Path 2", path2]]) {
    if (!p) continue;
    if (p.length > PATH_MAX) {
      errors.push(`${label} "${p}" is ${p.length} chars (max ${PATH_MAX}).`);
    }
    // Path fields don't allow spaces or special chars except hyphens
    if (!/^[a-z0-9-]+$/i.test(p)) {
      warnings.push(`${label} "${p}" contains characters Google may strip. Use letters, numbers, hyphens.`);
    }
  }
  if (path2 && !path1) {
    warnings.push("Path 2 set but Path 1 is empty — Path 2 won't show without Path 1.");
  }
  return { errors, warnings };
}

/** Validate the entire RSA input. */
export function validateInput(input: RsaInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!input.finalUrl || !isValidUrl(input.finalUrl)) {
    errors.push("Final URL is required and must be a valid http(s) URL.");
  }
  if (input.displayURL && !isValidUrl(input.displayURL)) {
    warnings.push("Display URL looks invalid.");
  }
  const h = validateHeadlines(input.headlines);
  errors.push(...h.errors);
  warnings.push(...h.warnings);
  const d = validateDescriptions(input.descriptions);
  errors.push(...d.errors);
  warnings.push(...d.warnings);
  const p = validatePaths(input.path1, input.path2);
  errors.push(...p.errors);
  warnings.push(...p.warnings);
  return { ok: errors.length === 0, errors, warnings };
}

/** Estimate ad strength based on headlines/descriptions count and uniqueness. */
export function estimateStrength(input: RsaInput): StrengthEstimate {
  const headlines = input.headlines.filter((h) => h.text.trim());
  const descriptions = input.descriptions.filter((d) => d.text.trim());
  let score = 0;
  const reasons: string[] = [];

  // Headline count
  if (headlines.length >= 12) { score += 30; }
  else if (headlines.length >= 8) { score += 20; }
  else if (headlines.length >= 5) { score += 10; }
  else { reasons.push("Add more headlines for better strength."); }

  // Description count
  if (descriptions.length >= 4) { score += 20; }
  else if (descriptions.length >= 3) { score += 15; }
  else if (descriptions.length >= 2) { score += 10; }

  // Unique words across headlines
  const allWords = new Set<string>();
  for (const h of headlines) {
    for (const w of h.text.toLowerCase().split(/\s+/)) {
      if (w) allWords.add(w);
    }
  }
  if (allWords.size >= 15) { score += 20; }
  else if (allWords.size >= 10) { score += 10; }
  else { reasons.push("Use more unique words across headlines for variety."); }

  // Pinning diversity
  const pinCount = headlines.filter((h) => h.pin !== "none").length;
  if (pinCount >= 2 && pinCount <= 6) { score += 10; }
  else if (pinCount > 6) { reasons.push("Too many pinned headlines reduces variety."); }

  // Has paths
  if (input.path1) { score += 5; }

  // Has display URL
  if (input.displayURL) { score += 5; }

  // Headlines with near-max length (more visible)
  const longHeadlines = headlines.filter((h) => h.text.length >= 20).length;
  if (longHeadlines >= 5) { score += 10; }

  let level: StrengthLevel;
  if (score >= 80) level = "excellent";
  else if (score >= 60) level = "good";
  else if (score >= 40) level = "average";
  else level = "poor";

  const reason = reasons.length > 0 ? reasons.join(" ") : "Ad has good variety and coverage.";
  return { level, score: Math.min(100, score), reason };
}

/** Build ad preview data — what the ad would look like on desktop or mobile. */
export interface AdPreview {
  headlines: string[];     // first 3 shown
  descriptions: string[];  // first 2 shown
  displayUrl: string;
  finalUrl: string;
}

/** Build a desktop ad preview (3 headlines + 2 descriptions). */
export function buildDesktopPreview(input: RsaInput): AdPreview {
  const headlines = input.headlines
    .filter((h) => h.text.trim())
    .map((h) => h.text);
  const descriptions = input.descriptions
    .filter((d) => d.text.trim())
    .map((d) => d.text);
  const domain = input.finalUrl ? safeGetDomain(input.finalUrl) : "example.com";
  const displayUrl = input.displayURL || domain;
  let fullDisplayUrl = displayUrl;
  if (input.path1) fullDisplayUrl += `/${input.path1}`;
  if (input.path2) fullDisplayUrl += `/${input.path2}`;
  return {
    headlines: headlines.slice(0, 3),
    descriptions: descriptions.slice(0, 2),
    displayUrl: fullDisplayUrl,
    finalUrl: input.finalUrl,
  };
}

/** Build a mobile ad preview (2 headlines + 1 description by default). */
export function buildMobilePreview(input: RsaInput): AdPreview {
  const headlines = input.headlines
    .filter((h) => h.text.trim())
    .map((h) => h.text);
  const descriptions = input.descriptions
    .filter((d) => d.text.trim())
    .map((d) => d.text);
  const domain = input.finalUrl ? safeGetDomain(input.finalUrl) : "example.com";
  const displayUrl = input.displayURL || domain;
  let fullDisplayUrl = displayUrl;
  if (input.path1) fullDisplayUrl += `/${input.path1}`;
  if (input.path2) fullDisplayUrl += `/${input.path2}`;
  return {
    headlines: headlines.slice(0, 2),
    descriptions: descriptions.slice(0, 1),
    displayUrl: fullDisplayUrl,
    finalUrl: input.finalUrl,
  };
}

function safeGetDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "example.com";
  }
}

/** Render ad text as plain copy. */
export function renderAdText(input: RsaInput): string {
  const preview = buildDesktopPreview(input);
  const lines: string[] = [];
  lines.push(`Headlines:`);
  preview.headlines.forEach((h, i) => lines.push(`  ${i + 1}. ${h}`));
  lines.push("");
  lines.push(`Descriptions:`);
  preview.descriptions.forEach((d, i) => lines.push(`  ${i + 1}. ${d}`));
  lines.push("");
  lines.push(`Display URL: ${preview.displayUrl}`);
  lines.push(`Final URL: ${preview.finalUrl}`);
  return lines.join("\n");
}

/** Export the ad as CSV (one row per headline/description). */
export function renderCsv(input: RsaInput): string {
  const lines: string[] = ["type,position,text,pin"];
  input.headlines.filter((h) => h.text.trim()).forEach((h) => {
    lines.push(`headline,${h.id},${escapeCsv(h.text)},${h.pin === "none" ? "" : h.pin.replace("pinned-", "")}`);
  });
  input.descriptions.filter((d) => d.text.trim()).forEach((d) => {
    lines.push(`description,${d.id},${escapeCsv(d.text)},${d.pin === "none" ? "" : d.pin.replace("pinned-", "")}`);
  });
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ---- History ----

const HISTORY_KEY = "unqtools:responsive-search-ad-builder:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  headlineCount: number;
  descriptionCount: number;
  strength: StrengthLevel;
  score: number;
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

export interface ShareState {
  input: RsaInput;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  params.set("finalUrl", state.input.finalUrl);
  if (state.input.displayURL) params.set("displayURL", state.input.displayURL);
  if (state.input.path1) params.set("path1", state.input.path1);
  if (state.input.path2) params.set("path2", state.input.path2);
  const headlines = state.input.headlines.filter((h) => h.text.trim());
  params.set("headlines", JSON.stringify(headlines));
  const descriptions = state.input.descriptions.filter((d) => d.text.trim());
  params.set("descriptions", JSON.stringify(descriptions));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<RsaInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<RsaInput> = {};
  const finalUrl = params.get("finalUrl");
  if (finalUrl !== null) out.finalUrl = finalUrl;
  const displayURL = params.get("displayURL");
  if (displayURL !== null) out.displayURL = displayURL;
  const path1 = params.get("path1");
  if (path1 !== null) out.path1 = path1;
  const path2 = params.get("path2");
  if (path2 !== null) out.path2 = path2;
  const headlinesRaw = params.get("headlines");
  if (headlinesRaw) {
    try {
      out.headlines = JSON.parse(headlinesRaw);
    } catch {
      // ignore
    }
  }
  const descriptionsRaw = params.get("descriptions");
  if (descriptionsRaw) {
    try {
      out.descriptions = JSON.parse(descriptionsRaw);
    } catch {
      // ignore
    }
  }
  return out;
}

export const GOOGLE_RSA_DOCS_URL = "https://support.google.com/google-ads/answer/7361401";
