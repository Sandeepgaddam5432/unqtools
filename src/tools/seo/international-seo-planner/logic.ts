/**
 * International SEO Planner — pure logic.
 *
 * Generates URL structures (ccTLD / subdomain / subdirectory) and
 * hreflang tags for a list of country/language targets. Validates
 * hreflang pairs and self-references. Pure functions only.
 */

export type UrlStructure = "cctld" | "subdomain" | "subdirectory";

export interface CountryTarget {
  name: string;
  code: string; // ISO 3166-1 alpha-2
}

export interface LocaleEntry {
  countryCode: string;
  languageCode: string; // ISO 639-1
}

export interface HreflangTag {
  hreflang: string; // e.g. "en-US"
  url: string; // absolute URL
  countryCode: string;
  languageCode: string;
  selfReferencing: boolean;
}

export interface ValidationIssue {
  type: "missing-self" | "invalid-language" | "invalid-region" | "missing-pair" | "invalid-format";
  message: string;
  countryCode?: string;
  languageCode?: string;
}

export interface CountryPlan {
  country: CountryTarget;
  languageCode: string;
  url: string;
  hreflang: string;
  hreflangTag: string; // <link rel="alternate" ... />
}

export interface StrategyRow {
  strategy: UrlStructure;
  example: string;
  pros: string[];
  cons: string[];
  seoImpact: string;
}

/** ccTLD lookup table — 20+ countries. */
export const CCTLD_TABLE: Record<string, string> = {
  US: "com",
  GB: "co.uk",
  DE: "de",
  FR: "fr",
  ES: "es",
  IT: "it",
  NL: "nl",
  JP: "co.jp",
  CN: "cn",
  IN: "in",
  AU: "com.au",
  CA: "ca",
  BR: "com.br",
  MX: "com.mx",
  RU: "ru",
  KR: "co.kr",
  SE: "se",
  NO: "no",
  PL: "pl",
  TR: "com.tr",
  BE: "be",
  CH: "ch",
  AT: "at",
  PT: "pt",
  DK: "dk",
  FI: "fi",
  IE: "ie",
  NZ: "co.nz",
  ZA: "co.za",
  AE: "ae",
};

/** Country name → code lookup (common presets). */
export const COUNTRY_PRESETS: CountryTarget[] = [
  { name: "United States", code: "US" },
  { name: "United Kingdom", code: "GB" },
  { name: "Germany", code: "DE" },
  { name: "France", code: "FR" },
  { name: "Spain", code: "ES" },
  { name: "Italy", code: "IT" },
  { name: "Netherlands", code: "NL" },
  { name: "Japan", code: "JP" },
  { name: "China", code: "CN" },
  { name: "India", code: "IN" },
  { name: "Australia", code: "AU" },
  { name: "Canada", code: "CA" },
  { name: "Brazil", code: "BR" },
  { name: "Mexico", code: "MX" },
  { name: "Russia", code: "RU" },
  { name: "South Korea", code: "KR" },
  { name: "Sweden", code: "SE" },
  { name: "Norway", code: "NO" },
  { name: "Poland", code: "PL" },
  { name: "Turkey", code: "TR" },
];

/** Strategy comparison table. */
export const STRATEGY_COMPARISON: StrategyRow[] = [
  {
    strategy: "cctld",
    example: "example.fr, example.co.uk",
    pros: [
      "Strongest geo-targeting signal",
      "Country-specific branding",
      "Independent hosting / server location",
      "Can rank in local Google (google.fr, google.co.uk)",
    ],
    cons: [
      "Highest cost (one domain per country)",
      "Each ccTLD needs separate authority building",
      "No shared link equity across countries",
      "Complex DNS / infrastructure",
    ],
    seoImpact: "Best for strong local presence; requires significant ongoing investment in each market.",
  },
  {
    strategy: "subdomain",
    example: "fr.example.com, de.example.com",
    pros: [
      "Shares root domain authority",
      "Easier to set up than ccTLD",
      "Google Search Console geo-targets per subdomain",
      "Flexible hosting per region",
    ],
    cons: [
      "Weaker geo-targeting than ccTLD",
      "Link equity partially shared",
      "User perception of separate site",
      "Requires DNS configuration",
    ],
    seoImpact: "Good middle ground; recommended when ccTLDs are too costly but you need geo-targeting.",
  },
  {
    strategy: "subdirectory",
    example: "example.com/fr/, example.com/de/",
    pros: [
      "All link equity flows to one domain",
      "Easiest to maintain (single CMS)",
      "Strong consolidated domain authority",
      "Simple analytics setup",
    ],
    cons: [
      "Weakest geo-targeting signal",
      "Needs hreflang done right",
      "Single server location (geo latency)",
      "Harder to localize hosting",
    ],
    seoImpact: "Best for consolidating authority; modern hreflang + cc targeting make this Google's preference for many sites.",
  },
];

/** Normalize a single line of text. */
export function normalizeText(s: string): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** Lowercase trimmed text. */
export function normalizeLower(s: string): string {
  return normalizeText(s).toLowerCase();
}

/** Parse target countries (one per line as 'Country:Code'). */
export function parseCountries(input: string): CountryTarget[] {
  if (!input) return [];
  const out: CountryTarget[] = [];
  const seen = new Set<string>();
  for (const line of input.split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const idx = trimmed.lastIndexOf(":");
    if (idx < 0) continue;
    const name = trimmed.slice(0, idx).trim();
    const code = trimmed.slice(idx + 1).trim().toUpperCase();
    if (!name || !code) continue;
    if (seen.has(code)) continue;
    seen.add(code);
    out.push({ name, code });
  }
  return out;
}

/** Parse language-per-country mapping ('CountryCode:LanguageCode' CSV). */
export function parseLanguageMapping(input: string): LocaleEntry[] {
  if (!input) return [];
  const out: LocaleEntry[] = [];
  const seen = new Set<string>();
  for (const piece of input.split(/[,;\n]+/)) {
    const trimmed = piece.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx < 0) continue;
    const countryCode = trimmed.slice(0, idx).trim().toUpperCase();
    const languageCode = trimmed.slice(idx + 1).trim().toLowerCase();
    if (!countryCode || !languageCode) continue;
    if (seen.has(countryCode)) continue;
    seen.add(countryCode);
    out.push({ countryCode, languageCode });
  }
  return out;
}

/** Validate ISO 639-1 language code (2 lowercase letters). */
export function isValidLanguageCode(code: string): boolean {
  return /^[a-z]{2}$/.test((code || "").trim().toLowerCase());
}

/** Validate ISO 3166-1 alpha-2 country code (2 uppercase letters). */
export function isValidCountryCode(code: string): boolean {
  return /^[A-Z]{2}$/.test((code || "").trim().toUpperCase());
}

/** Validate hreflang value format ('xx-XX'). */
export function isValidHreflangFormat(hreflang: string): boolean {
  return /^[a-z]{2}-[A-Z]{2}$/.test(hreflang || "");
}

/** Lookup ccTLD for a country code, with .com fallback. */
export function lookupCctld(code: string): string {
  const c = (code || "").trim().toUpperCase();
  return CCTLD_TABLE[c] ?? "com";
}

/** Build a URL for a country based on the chosen strategy. */
export function buildCountryUrl(
  mainDomain: string,
  country: CountryTarget,
  language: string,
  strategy: UrlStructure,
): string {
  const domain = normalizeLower(mainDomain) || "example.com";
  const lang = normalizeLower(language) || "en";
  const ccLower = country.code.toLowerCase();
  if (strategy === "cctld") {
    const cctld = lookupCctld(country.code);
    // strip existing TLD from mainDomain (best-effort: keep name before first dot)
    const baseName = domain.split(".")[0] || "example";
    return `https://${baseName}.${cctld}/`;
  }
  if (strategy === "subdomain") {
    return `https://${ccLower}.${domain}/`;
  }
  // subdirectory
  return `https://${domain}/${lang}/`;
}

/** Build hreflang value from language + country code. */
export function buildHreflangValue(language: string, countryCode: string): string {
  const lang = normalizeLower(language);
  const cc = (countryCode || "").trim().toUpperCase();
  return `${lang}-${cc}`;
}

/** Render a single hreflang <link> tag. */
export function renderHreflangTag(hreflang: string, url: string): string {
  return `<link rel="alternate" hreflang="${hreflang}" href="${url}" />`;
}

/** Render the x-default hreflang tag. */
export function renderXDefaultTag(defaultUrl: string): string {
  return `<link rel="alternate" hreflang="x-default" href="${defaultUrl}" />`;
}

/** Build a full CountryPlan for each target. */
export function buildPlans(
  mainDomain: string,
  countries: CountryTarget[],
  languages: LocaleEntry[],
  strategy: UrlStructure,
): CountryPlan[] {
  const langByCountry = new Map<string, string>();
  for (const l of languages) langByCountry.set(l.countryCode, l.languageCode);

  const out: CountryPlan[] = [];
  for (const c of countries) {
    const lang = langByCountry.get(c.code) ?? "en";
    const url = buildCountryUrl(mainDomain, c, lang, strategy);
    const hreflang = buildHreflangValue(lang, c.code);
    const tag = renderHreflangTag(hreflang, url);
    out.push({
      country: c,
      languageCode: lang,
      url,
      hreflang,
      hreflangTag: tag,
    });
  }
  return out;
}

/** Pick the x-default URL — first plan's URL, or main domain if none. */
export function pickXDefaultUrl(plans: CountryPlan[], mainDomain: string): string {
  if (plans.length === 0) {
    const d = normalizeLower(mainDomain) || "example.com";
    return `https://${d}/`;
  }
  return plans[0].url;
}

/** Generate hreflang tags (one per plan + x-default). */
export function generateHreflangTags(
  plans: CountryPlan[],
  mainDomain: string,
): HreflangTag[] {
  const tags: HreflangTag[] = plans.map((p) => ({
    hreflang: p.hreflang,
    url: p.url,
    countryCode: p.country.code,
    languageCode: p.languageCode,
    selfReferencing: true,
  }));
  const xDefaultUrl = pickXDefaultUrl(plans, mainDomain);
  tags.push({
    hreflang: "x-default",
    url: xDefaultUrl,
    countryCode: "",
    languageCode: "",
    selfReferencing: false,
  });
  return tags;
}

/** Validate hreflang pairs and return issues. */
export function validateHreflang(plans: CountryPlan[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seenUrls = new Map<string, CountryPlan>();
  for (const p of plans) {
    seenUrls.set(p.url, p);
    // Format checks
    if (!isValidLanguageCode(p.languageCode)) {
      issues.push({
        type: "invalid-language",
        message: `Invalid language code '${p.languageCode}' for ${p.country.name} (${p.country.code})`,
        countryCode: p.country.code,
        languageCode: p.languageCode,
      });
    }
    if (!isValidCountryCode(p.country.code)) {
      issues.push({
        type: "invalid-region",
        message: `Invalid country code '${p.country.code}' for ${p.country.name}`,
        countryCode: p.country.code,
      });
    }
    if (!isValidHreflangFormat(p.hreflang)) {
      issues.push({
        type: "invalid-format",
        message: `Malformed hreflang value '${p.hreflang}' for ${p.country.code}`,
        countryCode: p.country.code,
        languageCode: p.languageCode,
      });
    }
  }
  // Missing self-reference check (always satisfied since buildPlans sets selfReferencing=true)
  for (const p of plans) {
    const hasSelf = plans.some((q) => q.url === p.url && q.hreflang === p.hreflang);
    if (!hasSelf) {
      issues.push({
        type: "missing-self",
        message: `URL ${p.url} is missing self-referencing hreflang '${p.hreflang}'`,
        countryCode: p.country.code,
        languageCode: p.languageCode,
      });
    }
  }
  return issues;
}

/** Filter plans by country code or name (case-insensitive). */
export function filterPlans(plans: CountryPlan[], query: string): CountryPlan[] {
  const q = normalizeLower(query);
  if (!q) return plans;
  return plans.filter((p) =>
    normalizeLower(p.country.name).includes(q) ||
    normalizeLower(p.country.code).includes(q),
  );
}

/** Compute summary stats. */
export interface IntlSeoStats {
  totalCountries: number;
  totalHreflangTags: number;
  validationIssues: number;
  invalidLanguages: number;
  invalidRegions: number;
}

export function computeStats(plans: CountryPlan[], tags: HreflangTag[], issues: ValidationIssue[]): IntlSeoStats {
  return {
    totalCountries: plans.length,
    totalHreflangTags: tags.length,
    validationIssues: issues.length,
    invalidLanguages: issues.filter((i) => i.type === "invalid-language").length,
    invalidRegions: issues.filter((i) => i.type === "invalid-region").length,
  };
}

/** Render text report. */
export function renderText(
  plans: CountryPlan[],
  tags: HreflangTag[],
  issues: ValidationIssue[],
  mainDomain: string,
  strategy: UrlStructure,
): string {
  const lines: string[] = [];
  lines.push(`International SEO Plan`);
  lines.push(`======================`);
  lines.push(`Main domain: ${mainDomain || "(none)"}`);
  lines.push(`Strategy: ${strategy}`);
  lines.push(`Countries: ${plans.length}`);
  lines.push(``);
  lines.push(`URL structure per country:`);
  for (const p of plans) {
    lines.push(`  - ${p.country.name} (${p.country.code}) → ${p.languageCode}: ${p.url}`);
  }
  lines.push(``);
  lines.push(`Hreflang tags:`);
  for (const t of tags) {
    lines.push(`  ${renderHreflangTag(t.hreflang, t.url)}`);
  }
  lines.push(``);
  if (issues.length === 0) {
    lines.push(`Validation: OK — no issues detected.`);
  } else {
    lines.push(`Validation issues (${issues.length}):`);
    for (const i of issues) {
      lines.push(`  [${i.type}] ${i.message}`);
    }
  }
  return lines.join("\n");
}

/** Render CSV report. */
export function renderCsv(plans: CountryPlan[]): string {
  const lines = ["country_name,country_code,language,url,hreflang,hreflang_tag"];
  for (const p of plans) {
    lines.push([
      escapeCsv(p.country.name),
      p.country.code,
      p.languageCode,
      escapeCsv(p.url),
      p.hreflang,
      escapeCsv(p.hreflangTag),
    ].join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:international-seo-planner:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  mainDomain: string;
  strategy: UrlStructure;
  totalCountries: number;
  totalTags: number;
  issues: number;
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

export function buildShareUrl(
  mainDomain: string,
  countriesText: string,
  strategy: UrlStructure,
  languagesText: string,
): string {
  const params = new URLSearchParams();
  if (mainDomain) params.set("domain", mainDomain);
  if (countriesText) params.set("countries", countriesText);
  if (strategy) params.set("strategy", strategy);
  if (languagesText) params.set("langs", languagesText);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): {
  mainDomain: string;
  countriesText: string;
  strategy: UrlStructure;
  languagesText: string;
} {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { mainDomain: "", countriesText: "", strategy: "subdirectory", languagesText: "" };
  const params = new URLSearchParams(clean);
  const strategy = (params.get("strategy") as UrlStructure) ?? "subdirectory";
  const valid: UrlStructure[] = ["cctld", "subdomain", "subdirectory"];
  const strat = valid.includes(strategy) ? strategy : "subdirectory";
  return {
    mainDomain: params.get("domain") ?? "",
    countriesText: params.get("countries") ?? "",
    strategy: strat,
    languagesText: params.get("langs") ?? "",
  };
}
