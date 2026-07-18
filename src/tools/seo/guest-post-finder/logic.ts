/**
 * Guest Post Niche Site Finder — pure logic.
 *
 * Generate Google search queries for guest post opportunities. Pure
 * functions only — no DOM, no network.
 */

export type FootprintCategory =
  | "write-for-us"
  | "guest-post"
  | "contribute"
  | "submit-article"
  | "become-contributor"
  | "guest-column";

export interface Footprint {
  category: FootprintCategory;
  text: string;
}

export interface GeneratedQuery {
  niche: string;
  category: FootprintCategory;
  footprint: string;
  query: string;
  googleUrl: string;
}

export interface NicheStats {
  niche: string;
  queryCount: number;
  byCategory: Record<FootprintCategory, number>;
}

export const FOOTPRINTS: Footprint[] = [
  // Write for us (5)
  { category: "write-for-us", text: '"write for us"' },
  { category: "write-for-us", text: '"write for me"' },
  { category: "write-for-us", text: '"write for our blog"' },
  { category: "write-for-us", text: '"become an author"' },
  { category: "write-for-us", text: '"become a writer"' },
  // Guest post (8)
  { category: "guest-post", text: '"guest post"' },
  { category: "guest-post", text: '"guest post guidelines"' },
  { category: "guest-post", text: '"guest post opportunities"' },
  { category: "guest-post", text: '"submit a guest post"' },
  { category: "guest-post", text: '"accepting guest posts"' },
  { category: "guest-post", text: '"guest post by"' },
  { category: "guest-post", text: '"guest author"' },
  { category: "guest-post", text: '"guest blogger"' },
  // Contribute (6)
  { category: "contribute", text: '"contribute to"' },
  { category: "contribute", text: '"contributing writer"' },
  { category: "contribute", text: '"contribute an article"' },
  { category: "contribute", text: '"contribute to our blog"' },
  { category: "contribute", text: '"contributor guidelines"' },
  { category: "contribute", text: '"want to contribute"' },
  // Submit article (5)
  { category: "submit-article", text: '"submit article"' },
  { category: "submit-article", text: '"submit an article"' },
  { category: "submit-article", text: '"submit your article"' },
  { category: "submit-article", text: '"article submission"' },
  { category: "submit-article", text: '"submit a post"' },
  // Become contributor (4)
  { category: "become-contributor", text: '"become a contributor"' },
  { category: "become-contributor", text: '"become a guest contributor"' },
  { category: "become-contributor", text: '"guest contributor"' },
  { category: "become-contributor", text: '"contributor program"' },
  // Guest column (4)
  { category: "guest-column", text: '"guest column"' },
  { category: "guest-column", text: '"guest writer"' },
  { category: "guest-column", text: '"guest post opportunity"' },
  { category: "guest-column", text: '"guest posting guidelines"' },
];

export const NICHE_PRESETS: string[] = [
  "seo", "marketing", "fitness", "finance", "travel",
  "tech", "cooking", "parenting", "pets", "health",
  "business", "real-estate",
];

export const CATEGORY_LABELS: Record<FootprintCategory, string> = {
  "write-for-us": "Write for Us",
  "guest-post": "Guest Post",
  "contribute": "Contribute",
  "submit-article": "Submit Article",
  "become-contributor": "Become Contributor",
  "guest-column": "Guest Column",
};

/** Normalize a niche string. */
export function normalizeNiche(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Parse bulk niches (newline or comma separated). */
export function parseNiches(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,;]+/)
    .map((s) => normalizeNiche(s))
    .filter(Boolean);
}

/** Build a Google search URL for a query. */
export function buildGoogleUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

/** Generate queries for a single niche. */
export function generateForNiche(
  niche: string,
  categories?: FootprintCategory[],
): GeneratedQuery[] {
  const n = normalizeNiche(niche);
  if (!n) return [];
  const filtered = categories
    ? FOOTPRINTS.filter((f) => categories.includes(f.category))
    : FOOTPRINTS;
  return filtered.map((f) => {
    const query = `${n} ${f.text}`;
    return {
      niche: n,
      category: f.category,
      footprint: f.text,
      query,
      googleUrl: buildGoogleUrl(query),
    };
  });
}

/** Generate queries for multiple niches. */
export function generateForNiches(
  niches: string[],
  categories?: FootprintCategory[],
): GeneratedQuery[] {
  const out: GeneratedQuery[] = [];
  for (const n of niches) {
    out.push(...generateForNiche(n, categories));
  }
  return out;
}

/** Compute stats per niche. */
export function computeStats(queries: GeneratedQuery[]): NicheStats[] {
  const byNiche = new Map<string, GeneratedQuery[]>();
  for (const q of queries) {
    if (!byNiche.has(q.niche)) byNiche.set(q.niche, []);
    byNiche.get(q.niche)!.push(q);
  }
  const out: NicheStats[] = [];
  for (const [niche, list] of byNiche) {
    const byCategory: Record<FootprintCategory, number> = {
      "write-for-us": 0,
      "guest-post": 0,
      "contribute": 0,
      "submit-article": 0,
      "become-contributor": 0,
      "guest-column": 0,
    };
    for (const q of list) byCategory[q.category] += 1;
    out.push({ niche, queryCount: list.length, byCategory });
  }
  out.sort((a, b) => a.niche.localeCompare(b.niche));
  return out;
}

/** Render queries as plain text (one per line). */
export function renderText(queries: GeneratedQuery[]): string {
  return queries.map((q) => q.query).join("\n");
}

/** Render queries as CSV. */
export function renderCsv(queries: GeneratedQuery[]): string {
  const lines = ["niche,category,footprint,query,google_url"];
  for (const q of queries) {
    lines.push([
      escapeCsv(q.niche),
      q.category,
      escapeCsv(q.footprint),
      escapeCsv(q.query),
      escapeCsv(q.googleUrl),
    ].join(","));
  }
  return lines.join("\n");
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

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:guest-post-finder:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  niches: string[];
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

export function buildShareUrl(niches: string, categories: FootprintCategory[]): string {
  const params = new URLSearchParams();
  if (niches) params.set("niches", niches);
  if (categories.length > 0) params.set("cats", categories.join(","));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { niches: string; categories: FootprintCategory[] } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { niches: "", categories: [] };
  const params = new URLSearchParams(clean);
  const niches = params.get("niches") ?? "";
  const catsStr = params.get("cats") ?? "";
  const validCats = Object.keys(CATEGORY_LABELS) as FootprintCategory[];
  const categories = catsStr
    ? catsStr.split(",").filter((c) => validCats.includes(c as FootprintCategory)) as FootprintCategory[]
    : [];
  return { niches, categories };
}
