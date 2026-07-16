/**
 * Hreflang Tag Generator — pure logic.
 */

export interface HreflangEntry {
  hreflang: string; // e.g. "en-US" or "x-default"
  url: string;
}

export interface HreflangInput {
  entries: HreflangEntry[];
  includeXDefault?: boolean;
  xDefaultUrl?: string;
}

// ISO 639-1 language codes (subset of common ones)
export const LANGUAGE_CODES: { code: string; name: string }[] = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ru", name: "Russian" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "zh", name: "Chinese" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
  { code: "bn", name: "Bengali" },
  { code: "tr", name: "Turkish" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
  { code: "sv", name: "Swedish" },
  { code: "no", name: "Norwegian" },
  { code: "da", name: "Danish" },
  { code: "fi", name: "Finnish" },
  { code: "cs", name: "Czech" },
  { code: "el", name: "Greek" },
  { code: "he", name: "Hebrew" },
  { code: "th", name: "Thai" },
  { code: "vi", name: "Vietnamese" },
  { code: "id", name: "Indonesian" },
  { code: "ms", name: "Malay" },
  { code: "uk", name: "Ukrainian" },
  { code: "ro", name: "Romanian" },
  { code: "hu", name: "Hungarian" },
];

// ISO 3166-1 alpha-2 region codes (subset of common ones)
export const REGION_CODES: { code: string; name: string }[] = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "IE", name: "Ireland" },
  { code: "ZA", name: "South Africa" },
  { code: "IN", name: "India" },
  { code: "PK", name: "Pakistan" },
  { code: "BD", name: "Bangladesh" },
  { code: "BR", name: "Brazil" },
  { code: "PT", name: "Portugal" },
  { code: "MX", name: "Mexico" },
  { code: "AR", name: "Argentina" },
  { code: "ES", name: "Spain" },
  { code: "FR", name: "France" },
  { code: "BE", name: "Belgium" },
  { code: "CH", name: "Switzerland" },
  { code: "DE", name: "Germany" },
  { code: "AT", name: "Austria" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "RU", name: "Russia" },
  { code: "UA", name: "Ukraine" },
  { code: "PL", name: "Poland" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "CN", name: "China" },
  { code: "HK", name: "Hong Kong" },
  { code: "TW", name: "Taiwan" },
  { code: "SG", name: "Singapore" },
  { code: "MY", name: "Malaysia" },
  { code: "ID", name: "Indonesia" },
  { code: "TH", name: "Thailand" },
  { code: "VN", name: "Vietnam" },
  { code: "PH", name: "Philippines" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "EG", name: "Egypt" },
  { code: "TR", name: "Turkey" },
  { code: "IL", name: "Israel" },
];

export function isValidLanguageCode(code: string): boolean {
  if (!code) return false;
  return LANGUAGE_CODES.some((l) => l.code === code.toLowerCase());
}

export function isValidRegionCode(code: string): boolean {
  if (!code) return false;
  return REGION_CODES.some((r) => r.code === code.toUpperCase());
}

/** Validate an hreflang value — accepts "en", "en-US", "x-default". */
export function isValidHreflangValue(value: string): boolean {
  if (!value) return false;
  if (value === "x-default") return true;
  const parts = value.split("-");
  if (parts.length === 1) {
    return isValidLanguageCode(parts[0]);
  }
  if (parts.length === 2) {
    return isValidLanguageCode(parts[0]) && isValidRegionCode(parts[1]);
  }
  return false;
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

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface HreflangFinding {
  severity: "high" | "medium" | "low" | "info";
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  findings: HreflangFinding[];
  duplicates: string[];
}

export function validateInput(input: HreflangInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const findings: HreflangFinding[] = [];
  const duplicates: string[] = [];
  if (input.entries.length === 0) {
    errors.push("At least one hreflang entry is required");
  }
  const seen = new Set<string>();
  for (let i = 0; i < input.entries.length; i++) {
    const e = input.entries[i];
    if (!isValidHreflangValue(e.hreflang)) {
      errors.push(`Entry #${i + 1}: invalid hreflang value "${e.hreflang}"`);
    }
    if (!isValidUrl(e.url)) {
      errors.push(`Entry #${i + 1}: URL is invalid`);
    }
    if (seen.has(e.hreflang)) {
      duplicates.push(e.hreflang);
    }
    seen.add(e.hreflang);
  }
  if (duplicates.length > 0) {
    warnings.push(`Duplicate hreflang values detected: ${duplicates.join(", ")}`);
    findings.push({ severity: "medium", message: `Duplicates: ${duplicates.join(", ")}` });
  }
  // Check that x-default is included if requested
  const hasXDefault = input.entries.some((e) => e.hreflang === "x-default");
  if (input.includeXDefault && !hasXDefault && !input.xDefaultUrl) {
    warnings.push("x-default is enabled but no x-default URL provided");
  }
  // Best practice: include a self-referencing hreflang
  findings.push({
    severity: "info",
    message: "Each page should include a self-referencing hreflang tag (page → its own language).",
  });
  // Best practice: include x-default
  if (!hasXDefault) {
    findings.push({
      severity: "low",
      message: "Consider adding an x-default entry for users whose language doesn't match any other.",
    });
  }
  return { ok: errors.length === 0, errors, warnings, findings, duplicates };
}

export function buildTag(entry: HreflangEntry): string {
  return `<link rel="alternate" hreflang="${escapeHtml(entry.hreflang)}" href="${escapeHtml(entry.url)}" />`;
}

export function generateTags(input: HreflangInput): string {
  const v = validateInput(input);
  if (!v.ok) throw new Error(v.errors.join("; "));
  const lines: string[] = [];
  for (const e of input.entries) {
    lines.push(buildTag(e));
  }
  if (input.includeXDefault && input.xDefaultUrl && isValidUrl(input.xDefaultUrl)) {
    if (!input.entries.some((e) => e.hreflang === "x-default")) {
      lines.push(buildTag({ hreflang: "x-default", url: input.xDefaultUrl }));
    }
  }
  return lines.join("\n");
}

/** Parse a batch paste — one entry per line: hreflang URL or hreflang|URL. */
export function parseBatch(text: string): HreflangEntry[] {
  if (!text || !text.trim()) return [];
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const out: HreflangEntry[] = [];
  for (const line of lines) {
    const parts = line.split(/[|\t,\s]+/);
    if (parts.length >= 2) {
      const hreflang = parts[0];
      const url = parts.slice(1).join(" ");
      if (isValidHreflangValue(hreflang) && isValidUrl(url)) {
        out.push({ hreflang, url });
      }
    }
  }
  return out;
}

export function detectDuplicates(entries: HreflangEntry[]): string[] {
  const seen = new Set<string>();
  const dups: string[] = [];
  for (const e of entries) {
    if (seen.has(e.hreflang)) {
      if (!dups.includes(e.hreflang)) dups.push(e.hreflang);
    }
    seen.add(e.hreflang);
  }
  return dups;
}

// ---- History ----
const HISTORY_KEY = "unqtools:hreflang-tag-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
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

export function buildShareUrl(input: HreflangInput): string {
  const params = new URLSearchParams();
  params.set("entries", JSON.stringify(input.entries));
  if (input.includeXDefault) params.set("xdefault", "1");
  if (input.xDefaultUrl) params.set("xurl", input.xDefaultUrl);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<HreflangInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<HreflangInput> = {};
  const entries = params.get("entries");
  if (entries) {
    try {
      out.entries = JSON.parse(entries) as HreflangEntry[];
    } catch {
      // ignore
    }
  }
  if (params.get("xdefault") === "1") out.includeXDefault = true;
  const xurl = params.get("xurl");
  if (xurl) out.xDefaultUrl = xurl;
  return out;
}
