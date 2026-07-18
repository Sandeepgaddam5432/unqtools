/**
 * Link Prospecting List Builder — pure logic.
 *
 * Generate search footprints, prospect template, and track outreach status.
 * Pure functions only — no DOM, no network.
 */

export type FootprintCategory =
  | "guest-post"
  | "resource"
  | "broken-link"
  | "infographic"
  | "podcast"
  | "interview";

export type OutreachStatus =
  | "pending"
  | "contacted"
  | "replied"
  | "yes"
  | "no";

export type Priority = "high" | "medium" | "low";

export interface Prospect {
  id: string;
  query: string;
  category: FootprintCategory;
  niche: string;
  status: OutreachStatus;
  priority: Priority;
  notes: string;
  url?: string;
}

export interface QueryResult {
  query: string;
  category: FootprintCategory;
  niche: string;
  googleUrl: string;
}

export const FOOTPRINTS: Record<FootprintCategory, string[]> = {
  "guest-post": [
    '"write for us"',
    '"guest post"',
    '"guest article"',
    '"contribute to"',
    '"submit article"',
    '"become a contributor"',
    '"guest column"',
    '"submit a guest post"',
  ],
  "resource": [
    '"resources"',
    '"useful resources"',
    '"useful links"',
    '"recommended sites"',
    '"helpful resources"',
    '"further reading"',
    '"additional resources"',
  ],
  "broken-link": [
    '"resources" + "dead link"',
    '"useful links" + "broken"',
    '"recommended sites" + "404"',
    '"partner with us"',
    '"site closed"',
  ],
  "infographic": [
    '"submit infographic"',
    '"infographic submission"',
    '"infographic directory"',
    '"accept infographics"',
  ],
  "podcast": [
    '"submit podcast"',
    '"be a guest on podcast"',
    '"podcast guest"',
    '"podcast submission"',
  ],
  "interview": [
    '"expert interview"',
    '"interview with"',
    '"submit interview"',
    '"be interviewed"',
  ],
};

export const NICHE_PRESETS: string[] = [
  "seo", "fitness", "finance", "travel", "tech",
  "marketing", "cooking", "parenting", "pets", "health",
];

export const STATUS_LABELS: Record<OutreachStatus, string> = {
  pending: "Pending",
  contacted: "Contacted",
  replied: "Replied",
  yes: "Yes!",
  no: "No",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Normalize a niche string. */
export function normalizeNiche(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Build a Google search URL for a query. */
export function buildGoogleUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

/** Generate queries for a niche + category. */
export function generateQueries(niche: string, category: FootprintCategory): QueryResult[] {
  const n = normalizeNiche(niche);
  if (!n) return [];
  const fps = FOOTPRINTS[category] ?? [];
  return fps.map((fp) => {
    const query = `${n} ${fp}`;
    return {
      query,
      category,
      niche: n,
      googleUrl: buildGoogleUrl(query),
    };
  });
}

/** Generate queries for multiple categories. */
export function generateAllQueries(niche: string, categories: FootprintCategory[]): QueryResult[] {
  const out: QueryResult[] = [];
  for (const c of categories) {
    out.push(...generateQueries(niche, c));
  }
  return out;
}

/** Generate an ID for a prospect. */
export function makeId(query: string, niche: string): string {
  return `${normalizeNiche(niche)}|${query}`.slice(0, 200);
}

/** Build a prospect from a query. */
export function buildProspect(query: QueryResult, status: OutreachStatus = "pending", priority: Priority = "medium", notes = "", url?: string): Prospect {
  return {
    id: makeId(query.query, query.niche),
    query: query.query,
    category: query.category,
    niche: query.niche,
    status,
    priority,
    notes,
    url,
  };
}

/** Deduplicate prospects by ID. */
export function dedupProspects(prospects: Prospect[]): { unique: Prospect[]; removed: number } {
  const seen = new Set<string>();
  const out: Prospect[] = [];
  let removed = 0;
  for (const p of prospects) {
    if (seen.has(p.id)) { removed += 1; continue; }
    seen.add(p.id);
    out.push(p);
  }
  return { unique: out, removed };
}

/** Update a prospect's status. */
export function updateStatus(prospects: Prospect[], id: string, status: OutreachStatus): Prospect[] {
  return prospects.map((p) => (p.id === id ? { ...p, status } : p));
}

/** Update a prospect's priority. */
export function updatePriority(prospects: Prospect[], id: string, priority: Priority): Prospect[] {
  return prospects.map((p) => (p.id === id ? { ...p, priority } : p));
}

/** Update a prospect's notes. */
export function updateNotes(prospects: Prospect[], id: string, notes: string): Prospect[] {
  return prospects.map((p) => (p.id === id ? { ...p, notes } : p));
}

/** Update a prospect's URL. */
export function updateUrl(prospects: Prospect[], id: string, url: string): Prospect[] {
  return prospects.map((p) => (p.id === id ? { ...p, url } : p));
}

/** Remove a prospect. */
export function removeProspect(prospects: Prospect[], id: string): Prospect[] {
  return prospects.filter((p) => p.id !== id);
}

/** Filter prospects by category / status / priority. */
export interface FilterOptions {
  category?: FootprintCategory;
  status?: OutreachStatus;
  priority?: Priority;
  query?: string;
}

export function filterProspects(prospects: Prospect[], opts: FilterOptions): Prospect[] {
  return prospects.filter((p) => {
    if (opts.category && p.category !== opts.category) return false;
    if (opts.status && p.status !== opts.status) return false;
    if (opts.priority && p.priority !== opts.priority) return false;
    if (opts.query) {
      const q = opts.query.toLowerCase();
      if (!p.query.toLowerCase().includes(q) && !p.notes.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

/** Compute stats per status. */
export interface ProspectStats {
  total: number;
  byStatus: Record<OutreachStatus, number>;
  byPriority: Record<Priority, number>;
  byCategory: Record<FootprintCategory, number>;
  successRate: number; // yes / total
  contactRate: number; // (contacted + replied + yes + no) / total
}

export function computeStats(prospects: Prospect[]): ProspectStats {
  const byStatus: Record<OutreachStatus, number> = { pending: 0, contacted: 0, replied: 0, yes: 0, no: 0 };
  const byPriority: Record<Priority, number> = { high: 0, medium: 0, low: 0 };
  const byCategory: Record<FootprintCategory, number> = {
    "guest-post": 0, "resource": 0, "broken-link": 0, "infographic": 0, "podcast": 0, "interview": 0,
  };
  for (const p of prospects) {
    byStatus[p.status] += 1;
    byPriority[p.priority] += 1;
    byCategory[p.category] += 1;
  }
  const total = prospects.length;
  const yesCount = byStatus.yes;
  const contactedCount = byStatus.contacted + byStatus.replied + byStatus.yes + byStatus.no;
  return {
    total,
    byStatus,
    byPriority,
    byCategory,
    successRate: total > 0 ? Math.round((yesCount / total) * 1000) / 10 : 0,
    contactRate: total > 0 ? Math.round((contactedCount / total) * 1000) / 10 : 0,
  };
}

/** Render prospects as CSV. */
export function renderCsv(prospects: Prospect[]): string {
  const lines = ["id,niche,category,query,status,priority,notes,url"];
  for (const p of prospects) {
    lines.push([
      escapeCsv(p.id),
      escapeCsv(p.niche),
      p.category,
      escapeCsv(p.query),
      p.status,
      p.priority,
      escapeCsv(p.notes),
      escapeCsv(p.url ?? ""),
    ].join(","));
  }
  return lines.join("\n");
}

/** Parse CSV back into prospects. */
export function parseCsv(input: string): { prospects: Prospect[]; errors: string[] } {
  if (!input || !input.trim()) return { prospects: [], errors: [] };
  const errors: string[] = [];
  const lines = input.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { prospects: [], errors: [] };
  // Detect header
  const firstLine = lines[0].toLowerCase();
  const hasHeader = /id|niche|category|query|status/.test(firstLine);
  const startIdx = hasHeader ? 1 : 0;
  const prospects: Prospect[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    if (cols.length < 6) { errors.push(`Row ${i + 1}: too few columns`); continue; }
    const id = cols[0];
    const niche = cols[1];
    const category = cols[2] as FootprintCategory;
    const query = cols[3];
    const status = cols[4] as OutreachStatus;
    const priority = cols[5] as Priority;
    const notes = cols[6] ?? "";
    const url = cols[7] ?? "";
    if (!query) { errors.push(`Row ${i + 1}: missing query`); continue; }
    prospects.push({
      id: id || makeId(query, niche),
      niche, category, query, status, priority, notes, url: url || undefined,
    });
  }
  return { prospects, errors };
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

const HISTORY_KEY = "unqtools:link-prospecting-builder:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  niche: string;
  totalProspects: number;
  successRate: number;
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

// ---- Persisted prospects (localStorage) ----

const PROSPECTS_KEY = "unqtools:link-prospecting-builder:prospects";

export function loadProspects(): Prospect[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROSPECTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Prospect[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveProspects(prospects: Prospect[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PROSPECTS_KEY, JSON.stringify(prospects));
  } catch {
    // ignore
  }
}

export function clearProspects(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(PROSPECTS_KEY);
  } catch {
    // ignore
  }
}

// ---- Shareable URL ----

export function buildShareUrl(niche: string, categories: FootprintCategory[]): string {
  const params = new URLSearchParams();
  if (niche) params.set("niche", niche);
  if (categories.length > 0) params.set("cats", categories.join(","));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { niche: string; categories: FootprintCategory[] } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { niche: "", categories: [] };
  const params = new URLSearchParams(clean);
  const niche = params.get("niche") ?? "";
  const catsStr = params.get("cats") ?? "";
  const categories = catsStr
    ? catsStr.split(",").filter((c) => c in FOOTPRINTS) as FootprintCategory[]
    : [];
  return { niche, categories };
}
