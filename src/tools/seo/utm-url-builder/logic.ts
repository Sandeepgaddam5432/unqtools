/**
 * UTM URL Builder — pure logic.
 */

export interface UtmInput {
  baseUrl: string;
  source: string;
  medium: string;
  campaign: string;
  term?: string;
  content?: string;
}

export interface SourceMediumPreset {
  label: string;
  source: string;
  medium: string;
}

export const SOURCE_MEDIUM_PRESETS: SourceMediumPreset[] = [
  { label: "Google paid search", source: "google", medium: "cpc" },
  { label: "Bing paid search", source: "bing", medium: "cpc" },
  { label: "Facebook ad", source: "facebook", medium: "social" },
  { label: "Instagram ad", source: "instagram", medium: "social" },
  { label: "Twitter/X ad", source: "twitter", medium: "social" },
  { label: "LinkedIn ad", source: "linkedin", medium: "social" },
  { label: "Email newsletter", source: "newsletter", medium: "email" },
  { label: "Email blast", source: "email", medium: "email" },
  { label: "Organic social", source: "facebook", medium: "organic-social" },
  { label: "Referral", source: "partner-site", medium: "referral" },
  { label: "Display ad", source: "google", medium: "display" },
  { label: "QR code (offline)", source: "qr-code", medium: "offline" },
];

export interface CampaignTemplate {
  label: string;
  campaign: string;
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  { label: "Summer sale", campaign: "summer_sale_2026" },
  { label: "Black Friday", campaign: "black_friday_2026" },
  { label: "Product launch", campaign: "product_launch_q1_2026" },
  { label: "Webinar signup", campaign: "webinar_signup_jan_2026" },
  { label: "Newsletter signup", campaign: "newsletter_signup" },
  { label: "Holiday promo", campaign: "holiday_promo_2026" },
  { label: "Free trial", campaign: "free_trial_offer" },
  { label: "Demo request", campaign: "demo_request" },
];

export function isValidUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function isLowercaseAlphaNumericDash(s: string): boolean {
  return /^[a-z0-9_\-]+$/.test(s);
}

export function normalizeUtmValue(value: string): string {
  if (!value) return "";
  // Lowercase, replace spaces with underscores, keep URL-safe chars
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_\-+\.]/g, "");
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateUtmInput(input: UtmInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!input.baseUrl || !input.baseUrl.trim()) {
    errors.push("Base URL is required");
  } else if (!isValidUrl(input.baseUrl.trim())) {
    errors.push("Base URL must be a valid http(s) URL");
  }
  if (!input.source || !input.source.trim()) {
    errors.push("utm_source is required");
  } else if (!isLowercaseAlphaNumericDash(input.source.trim())) {
    warnings.push("utm_source should be lowercase, alphanumeric, dash or underscore");
  }
  if (!input.medium || !input.medium.trim()) {
    errors.push("utm_medium is required");
  } else if (!isLowercaseAlphaNumericDash(input.medium.trim())) {
    warnings.push("utm_medium should be lowercase, alphanumeric, dash or underscore");
  }
  if (!input.campaign || !input.campaign.trim()) {
    errors.push("utm_campaign is required");
  } else if (!isLowercaseAlphaNumericDash(input.campaign.trim())) {
    warnings.push("utm_campaign should be lowercase, alphanumeric, dash or underscore");
  }
  return { ok: errors.length === 0, errors, warnings };
}

export function buildUtmUrl(input: UtmInput): string {
  const v = validateUtmInput(input);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const url = new URL(input.baseUrl.trim());
  const params = url.searchParams;
  // Don't overwrite existing UTMs — append fresh
  params.set("utm_source", normalizeUtmValue(input.source) || input.source);
  params.set("utm_medium", normalizeUtmValue(input.medium) || input.medium);
  params.set("utm_campaign", normalizeUtmValue(input.campaign) || input.campaign);
  if (input.term && input.term.trim()) {
    params.set("utm_term", normalizeUtmValue(input.term) || input.term);
  }
  if (input.content && input.content.trim()) {
    params.set("utm_content", normalizeUtmValue(input.content) || input.content);
  }
  return url.toString();
}

/** Bulk builder — apply same UTMs to a list of URLs. */
export function buildBulkUtmUrls(urls: string[], template: Omit<UtmInput, "baseUrl">): Array<{ url: string; result: string | null; error?: string }> {
  return urls.map((u) => {
    if (!u.trim()) return { url: u, result: null };
    try {
      const result = buildUtmUrl({ ...template, baseUrl: u });
      return { url: u, result };
    } catch (e) {
      return { url: u, result: null, error: (e as Error).message };
    }
  });
}

/** Parse a UTM URL back to its components. */
export function parseUtmUrl(url: string): Partial<UtmInput> & { baseUrl?: string } {
  if (!isValidUrl(url)) {
    return { baseUrl: url };
  }
  const u = new URL(url);
  const params = u.searchParams;
  // Strip UTMs to get base URL
  const baseUrl = `${u.origin}${u.pathname}${u.hash ? "" : ""}`;
  return {
    baseUrl,
    source: params.get("utm_source") || undefined,
    medium: params.get("utm_medium") || undefined,
    campaign: params.get("utm_campaign") || undefined,
    term: params.get("utm_term") || undefined,
    content: params.get("utm_content") || undefined,
  };
}

/** Build a QR code as an SVG data URL (very minimal — module draws a grid based on a hash). */
export function buildQrDataUrl(text: string, size = 200): string {
  if (!text) return "";
  // Simple deterministic pseudo-QR pattern (not a real QR code, but visually distinct)
  // Use a hash to seed the pattern
  const hash = simpleHash(text);
  const cells = 21; // QR-like 21x21 grid
  const cellSize = size / cells;
  const modules: boolean[] = [];
  for (let i = 0; i < cells * cells; i++) {
    modules.push(((hash >> (i % 31)) & 1) === 1);
  }
  // Finder patterns at corners (top-left, top-right, bottom-left)
  const drawFinder = (x: number, y: number, grid: boolean[]): void => {
    for (let dy = 0; dy < 7; dy++) {
      for (let dx = 0; dx < 7; dx++) {
        const onBorder = dx === 0 || dy === 0 || dx === 6 || dy === 6;
        const onInner = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
        grid[(y + dy) * cells + (x + dx)] = onBorder || onInner;
      }
    }
  };
  drawFinder(0, 0, modules);
  drawFinder(cells - 7, 0, modules);
  drawFinder(0, cells - 7, modules);

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
  svg += `<rect width="${size}" height="${size}" fill="white"/>`;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      if (modules[y * cells + x]) {
        svg += `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
      }
    }
  }
  svg += `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function simpleHash(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// ---- History ----
const HISTORY_KEY = "unqtools:utm-url-builder:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  url: string;
  source: string;
  campaign: string;
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

export function buildShareUrl(input: UtmInput): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(input)) {
    if (v) params.set(k, String(v));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<UtmInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) {
    out[k] = v;
  }
  return out as Partial<UtmInput>;
}
