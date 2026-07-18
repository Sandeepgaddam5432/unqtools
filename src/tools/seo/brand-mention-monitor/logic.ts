/**
 * Brand Mention Monitor — pure logic.
 *
 * Generate brand mention monitoring queries for Google Alerts,
 * social platforms, news search, competitor/niche/founder/backlink
 * queries. Pure functions only — no DOM, no network.
 */

export type QueryType =
  | "brand"
  | "competitor"
  | "niche"
  | "founder"
  | "backlink-opportunity";

export type Platform =
  | "google-alerts"
  | "twitter"
  | "reddit"
  | "linkedin"
  | "youtube"
  | "hackernews"
  | "producthunt"
  | "google-news"
  | "bing-news"
  | "google-search";

export interface MentionQuery {
  queryType: QueryType;
  platform: Platform;
  subject: string;
  query: string;
  url: string;
}

export interface MonitorInput {
  brandName: string;
  brandAliases?: string[];
  founderNames?: string[];
  competitorNames?: string[];
  nicheKeywords?: string[];
  negativeKeywords?: string[];
}

export interface PlatformInfo {
  platform: Platform;
  label: string;
  type: "social" | "news" | "alerts" | "search";
  urlTemplate: (query: string) => string;
}

export const PLATFORMS: PlatformInfo[] = [
  {
    platform: "google-alerts",
    label: "Google Alerts",
    type: "alerts",
    urlTemplate: (q) => `https://www.google.com/alerts#source=web&q=${encodeURIComponent(q)}`,
  },
  {
    platform: "twitter",
    label: "Twitter / X",
    type: "social",
    urlTemplate: (q) => `https://twitter.com/search?q=${encodeURIComponent(q)}&src=typed_query`,
  },
  {
    platform: "reddit",
    label: "Reddit",
    type: "social",
    urlTemplate: (q) => `https://www.reddit.com/search/?q=${encodeURIComponent(q)}`,
  },
  {
    platform: "linkedin",
    label: "LinkedIn",
    type: "social",
    urlTemplate: (q) => `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(q)}`,
  },
  {
    platform: "youtube",
    label: "YouTube",
    type: "social",
    urlTemplate: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  },
  {
    platform: "hackernews",
    label: "Hacker News",
    type: "social",
    urlTemplate: (q) => `https://hn.algolia.com/?q=${encodeURIComponent(q)}`,
  },
  {
    platform: "producthunt",
    label: "Product Hunt",
    type: "social",
    urlTemplate: (q) => `https://www.producthunt.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    platform: "google-news",
    label: "Google News",
    type: "news",
    urlTemplate: (q) => `https://news.google.com/search?q=${encodeURIComponent(q)}`,
  },
  {
    platform: "bing-news",
    label: "Bing News",
    type: "news",
    urlTemplate: (q) => `https://www.bing.com/news/search?q=${encodeURIComponent(q)}`,
  },
  {
    platform: "google-search",
    label: "Google Search",
    type: "search",
    urlTemplate: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  },
];

export const DEFAULT_NEGATIVE_KEYWORDS: string[] = [
  "coupon",
  "discount",
  "promo",
  "review",
  "scam",
];

export const BACKLINK_OPPORTUNITY_TEMPLATES: string[] = [
  "best {niche} tools",
  "top {niche} tools",
  "best {niche} tools 2026",
  "free {niche} tools",
  "alternatives to {competitor}",
  "{niche} tools comparison",
  "online {niche} tools",
  "{niche} software list",
];

export const PLATFORM_LABELS: Record<Platform, string> = {
  "google-alerts": "Google Alerts",
  "twitter": "Twitter / X",
  "reddit": "Reddit",
  "linkedin": "LinkedIn",
  "youtube": "YouTube",
  "hackernews": "Hacker News",
  "producthunt": "Product Hunt",
  "google-news": "Google News",
  "bing-news": "Bing News",
  "google-search": "Google Search",
};

export const QUERY_TYPE_LABELS: Record<QueryType, string> = {
  "brand": "Brand",
  "competitor": "Competitor",
  "niche": "Niche",
  "founder": "Founder",
  "backlink-opportunity": "Backlink Opportunity",
};

/** Trim + de-dupe a comma-separated list. */
export function parseList(input: string | string[] | undefined): string[] {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : input.split(/[,\n;]/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    const v = (raw || "").trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/** Build the OR query for brand + aliases: ("Brand" OR "Alias 1" OR "Alias 2"). */
export function buildBrandOrQuery(brand: string, aliases: string[]): string {
  const all = [brand, ...aliases].filter(Boolean);
  if (all.length === 0) return "";
  if (all.length === 1) return `"${all[0]}"`;
  return `(${all.map((n) => `"${n}"`).join(" OR ")})`;
}

/** Append negative keyword filters: "query -coupon -review". */
export function applyNegatives(query: string, negatives: string[]): string {
  if (!query) return "";
  const neg = negatives.filter(Boolean).map((n) => `-${n.trim()}`);
  return neg.length > 0 ? `${query} ${neg.join(" ")}` : query;
}

/** Look up platform info by id. */
export function getPlatform(p: Platform): PlatformInfo {
  const found = PLATFORMS.find((x) => x.platform === p);
  if (!found) throw new Error(`Unknown platform: ${p}`);
  return found;
}

/** Build a query URL for a given platform + query string. */
export function buildUrl(platform: Platform, query: string): string {
  return getPlatform(platform).urlTemplate(query);
}

/** Generate brand mention queries — Google Alerts + social + news. */
export function generateBrandQueries(input: MonitorInput): MentionQuery[] {
  const out: MentionQuery[] = [];
  if (!input.brandName?.trim()) return out;
  const aliases = input.brandAliases ?? [];
  const negatives = input.negativeKeywords ?? DEFAULT_NEGATIVE_KEYWORDS;
  const orQuery = buildBrandOrQuery(input.brandName, aliases);
  if (!orQuery) return out;
  const withNegatives = applyNegatives(orQuery, negatives);
  // Google Alerts uses the version with negatives
  out.push({
    queryType: "brand",
    platform: "google-alerts",
    subject: input.brandName,
    query: withNegatives,
    url: buildUrl("google-alerts", withNegatives),
  });
  // Social + news platforms use the plain OR query (no negatives — search UIs filter themselves)
  const socialPlatforms: Platform[] = [
    "twitter", "reddit", "linkedin", "youtube", "hackernews", "producthunt",
  ];
  for (const p of socialPlatforms) {
    out.push({
      queryType: "brand",
      platform: p,
      subject: input.brandName,
      query: orQuery,
      url: buildUrl(p, orQuery),
    });
  }
  const newsPlatforms: Platform[] = ["google-news", "bing-news"];
  for (const p of newsPlatforms) {
    out.push({
      queryType: "brand",
      platform: p,
      subject: input.brandName,
      query: input.brandName,
      url: buildUrl(p, input.brandName),
    });
  }
  return out;
}

/** Generate competitor mention queries — Google Alerts + social. */
export function generateCompetitorQueries(input: MonitorInput): MentionQuery[] {
  const out: MentionQuery[] = [];
  const competitors = input.competitorNames ?? [];
  for (const comp of competitors) {
    const q = `"${comp}"`;
    out.push({
      queryType: "competitor",
      platform: "google-alerts",
      subject: comp,
      query: q,
      url: buildUrl("google-alerts", q),
    });
    const socialPlatforms: Platform[] = ["twitter", "reddit", "youtube"];
    for (const p of socialPlatforms) {
      out.push({
        queryType: "competitor",
        platform: p,
        subject: comp,
        query: comp,
        url: buildUrl(p, comp),
      });
    }
  }
  return out;
}

/** Generate niche keyword mention queries — Google search + news. */
export function generateNicheQueries(input: MonitorInput): MentionQuery[] {
  const out: MentionQuery[] = [];
  const niches = input.nicheKeywords ?? [];
  for (const niche of niches) {
    const q = niche;
    out.push({
      queryType: "niche",
      platform: "google-search",
      subject: niche,
      query: q,
      url: buildUrl("google-search", q),
    });
    out.push({
      queryType: "niche",
      platform: "google-news",
      subject: niche,
      query: q,
      url: buildUrl("google-news", q),
    });
  }
  return out;
}

/** Generate founder mention queries — Google Alerts + social. */
export function generateFounderQueries(input: MonitorInput): MentionQuery[] {
  const out: MentionQuery[] = [];
  const founders = input.founderNames ?? [];
  for (const founder of founders) {
    const q = `"${founder}"`;
    out.push({
      queryType: "founder",
      platform: "google-alerts",
      subject: founder,
      query: q,
      url: buildUrl("google-alerts", q),
    });
    const socialPlatforms: Platform[] = ["twitter", "linkedin", "youtube"];
    for (const p of socialPlatforms) {
      out.push({
        queryType: "founder",
        platform: p,
        subject: founder,
        query: founder,
        url: buildUrl(p, founder),
      });
    }
  }
  return out;
}

/** Generate backlink opportunity queries — 'best <niche> tools' type. */
export function generateBacklinkOpportunityQueries(input: MonitorInput): MentionQuery[] {
  const out: MentionQuery[] = [];
  const niches = input.nicheKeywords ?? [];
  const competitors = input.competitorNames ?? [];
  for (const niche of niches) {
    for (const tmpl of BACKLINK_OPPORTUNITY_TEMPLATES) {
      // Skip competitor-templated queries if no competitors provided
      if (tmpl.includes("{competitor}") && competitors.length === 0) continue;
      let q = tmpl.replace("{niche}", niche);
      if (tmpl.includes("{competitor}")) {
        q = q.replace("{competitor}", competitors[0]);
      }
      out.push({
        queryType: "backlink-opportunity",
        platform: "google-search",
        subject: niche,
        query: q,
        url: buildUrl("google-search", q),
      });
    }
  }
  return out;
}

/** Generate all queries based on input. */
export function generateAllQueries(input: MonitorInput): MentionQuery[] {
  return [
    ...generateBrandQueries(input),
    ...generateCompetitorQueries(input),
    ...generateNicheQueries(input),
    ...generateFounderQueries(input),
    ...generateBacklinkOpportunityQueries(input),
  ];
}

/** Filter queries by type. */
export function filterByType(
  queries: MentionQuery[],
  type: QueryType | "all",
): MentionQuery[] {
  if (type === "all") return queries;
  return queries.filter((q) => q.queryType === type);
}

export interface QueryStats {
  total: number;
  byType: Record<QueryType, number>;
  byPlatform: Partial<Record<Platform, number>>;
  uniqueSubjects: number;
}

/** Compute summary stats. */
export function computeStats(queries: MentionQuery[]): QueryStats {
  const byType: Record<QueryType, number> = {
    brand: 0,
    competitor: 0,
    niche: 0,
    founder: 0,
    "backlink-opportunity": 0,
  };
  const byPlatform: Partial<Record<Platform, number>> = {};
  const subjects = new Set<string>();
  for (const q of queries) {
    byType[q.queryType] += 1;
    byPlatform[q.platform] = (byPlatform[q.platform] ?? 0) + 1;
    subjects.add(q.subject);
  }
  return {
    total: queries.length,
    byType,
    byPlatform,
    uniqueSubjects: subjects.size,
  };
}

/** Render queries as plain text report. */
export function renderText(queries: MentionQuery[]): string {
  const lines: string[] = [];
  const grouped = new Map<QueryType, MentionQuery[]>();
  for (const q of queries) {
    if (!grouped.has(q.queryType)) grouped.set(q.queryType, []);
    grouped.get(q.queryType)!.push(q);
  }
  for (const [type, list] of grouped) {
    lines.push(`=== ${QUERY_TYPE_LABELS[type]} (${list.length}) ===`);
    for (const q of list) {
      lines.push(`  [${PLATFORM_LABELS[q.platform]}] ${q.subject}`);
      lines.push(`    Query: ${q.query}`);
      lines.push(`    URL:   ${q.url}`);
      lines.push("");
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

/** Render queries as CSV. */
export function renderCsv(queries: MentionQuery[]): string {
  const lines = ["query_type,platform,subject,query,url"];
  for (const q of queries) {
    lines.push([
      q.queryType,
      q.platform,
      escapeCsv(q.subject),
      escapeCsv(q.query),
      escapeCsv(q.url),
    ].join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Split CSV row with quoted values. */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(current); current = "";
    } else { current += ch; }
  }
  out.push(current);
  return out;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:brand-mention-monitor:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  brandName: string;
  aliasCount: number;
  competitorCount: number;
  nicheCount: number;
  founderCount: number;
  totalQueries: number;
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

export function buildShareUrl(input: MonitorInput): string {
  const params = new URLSearchParams();
  if (input.brandName) params.set("brand", input.brandName);
  if (input.brandAliases?.length) params.set("aliases", input.brandAliases.join(","));
  if (input.founderNames?.length) params.set("founders", input.founderNames.join(","));
  if (input.competitorNames?.length) params.set("competitors", input.competitorNames.join(","));
  if (input.nicheKeywords?.length) params.set("niches", input.nicheKeywords.join(","));
  if (input.negativeKeywords?.length) params.set("negatives", input.negativeKeywords.join(","));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<MonitorInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<MonitorInput> = {};
  const brand = params.get("brand");
  if (brand) out.brandName = brand;
  const aliases = params.get("aliases");
  if (aliases) out.brandAliases = parseList(aliases);
  const founders = params.get("founders");
  if (founders) out.founderNames = parseList(founders);
  const competitors = params.get("competitors");
  if (competitors) out.competitorNames = parseList(competitors);
  const niches = params.get("niches");
  if (niches) out.nicheKeywords = parseList(niches);
  const negatives = params.get("negatives");
  if (negatives) out.negativeKeywords = parseList(negatives);
  return out;
}
