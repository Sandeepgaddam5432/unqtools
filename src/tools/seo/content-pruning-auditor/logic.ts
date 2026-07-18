/**
 * Content Pruning Auditor — pure logic.
 *
 * Pure functions only — no DOM, no network.
 * Audits a content inventory and emits per-URL decisions:
 * keep / improve / merge / redirect / delete.
 */

export type Decision = "keep" | "improve" | "merge" | "redirect" | "delete";
export type Preset = "conservative" | "balanced" | "aggressive";

export interface ContentItem {
  url: string;
  traffic: number;
  backlinks: number;
  wordCount: number;
  ageMonths: number;
  lastUpdatedMonthsAgo: number;
}

export interface AuditedItem extends ContentItem {
  decision: Decision;
  pruningScore: number;
  reason: string;
  redirectTo?: string;
  mergeWith?: string;
  keywordSlug: string;
}

export interface Thresholds {
  keepTraffic: number;
  keepBacklinks: number;
  improveTrafficLow: number;
  improveTrafficHigh: number;
  improveWordCount: number;
  mergeTraffic: number;
  redirectAgeMonths: number;
  redirectBacklinks: number;
  deleteAgeMonths: number;
  deleteWordCount: number;
}

export interface AuditSummary {
  total: number;
  keep: number;
  improve: number;
  merge: number;
  redirect: number;
  delete: number;
  totalTraffic: number;
  totalBacklinks: number;
  avgPruningScore: number;
  highRiskCount: number;
}

export interface HistoryEntry {
  ts: number;
  total: number;
  keep: number;
  improve: number;
  merge: number;
  redirect: number;
  delete: number;
  avgScore: number;
}

// ---- Constants ----

export const HISTORY_KEY = "unqtools:content-pruning-auditor:history";
export const HISTORY_MAX = 20;

export const DEFAULT_TRAFFIC = 0;
export const DEFAULT_BACKLINKS = 0;
export const DEFAULT_WORDCOUNT = 500;
export const DEFAULT_AGE_MONTHS = 6;
export const DEFAULT_LAST_UPDATED = 1;

/** Score weights — traffic 40%, backlinks 30%, age 15%, word_count 15%. */
export const WEIGHTS = {
  traffic: 0.4,
  backlinks: 0.3,
  age: 0.15,
  wordCount: 0.15,
} as const;

export const PRESET_THRESHOLDS: Record<Preset, Thresholds> = {
  conservative: {
    keepTraffic: 500,
    keepBacklinks: 10,
    improveTrafficLow: 50,
    improveTrafficHigh: 500,
    improveWordCount: 400,
    mergeTraffic: 50,
    redirectAgeMonths: 30,
    redirectBacklinks: 5,
    deleteAgeMonths: 36,
    deleteWordCount: 200,
  },
  balanced: {
    keepTraffic: 500,
    keepBacklinks: 10,
    improveTrafficLow: 50,
    improveTrafficHigh: 500,
    improveWordCount: 500,
    mergeTraffic: 50,
    redirectAgeMonths: 24,
    redirectBacklinks: 5,
    deleteAgeMonths: 24,
    deleteWordCount: 300,
  },
  aggressive: {
    keepTraffic: 700,
    keepBacklinks: 15,
    improveTrafficLow: 100,
    improveTrafficHigh: 700,
    improveWordCount: 700,
    mergeTraffic: 100,
    redirectAgeMonths: 18,
    redirectBacklinks: 8,
    deleteAgeMonths: 18,
    deleteWordCount: 500,
  },
};

export const PRESET_LABELS: Record<Preset, string> = {
  conservative: "Conservative",
  balanced: "Balanced",
  aggressive: "Aggressive",
};

// ---- CSV parsing ----

/** Split a CSV row, honoring double-quoted fields with embedded commas. */
export function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function parseNumber(s: string | undefined): number | undefined {
  if (s === undefined) return undefined;
  const t = s.trim();
  if (t === "") return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

/** Parse multi-line CSV input into ContentItem[], filling defaults for missing fields. */
export function parseContentItems(input: string): ContentItem[] {
  if (!input) return [];
  const lines = input.split(/\n+/);
  const out: ContentItem[] = [];
  let startIndex = 0;
  // Detect & skip header row
  if (lines.length > 0) {
    const first = lines[0].toLowerCase();
    if (first.includes("url") && (first.includes("traffic") || first.includes("backlink"))) {
      startIndex = 1;
    }
  }
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = splitCsvRow(line);
    if (cols.length === 0) continue;
    const url = cols[0].trim();
    if (!url) continue;
    out.push({
      url,
      traffic: parseNumber(cols[1]) ?? DEFAULT_TRAFFIC,
      backlinks: parseNumber(cols[2]) ?? DEFAULT_BACKLINKS,
      wordCount: parseNumber(cols[3]) ?? DEFAULT_WORDCOUNT,
      ageMonths: parseNumber(cols[4]) ?? DEFAULT_AGE_MONTHS,
      lastUpdatedMonthsAgo: parseNumber(cols[5]) ?? DEFAULT_LAST_UPDATED,
    });
  }
  return out;
}

/** Normalize URL: lowercase host, strip trailing slash (except root), trim. */
export function normalizeUrl(url: string): string {
  if (!url) return "";
  let u = url.trim();
  try {
    const parsed = new URL(u);
    parsed.hostname = parsed.hostname.toLowerCase();
    u = parsed.toString();
  } catch {
    // not absolute — leave as is
  }
  if (u.length > 1 && u.endsWith("/")) u = u.slice(0, -1);
  return u;
}

/** Extract a "keyword slug" from the URL path for merge similarity detection. */
export function extractKeywordSlug(url: string): string {
  if (!url) return "";
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    // strip protocol/host manually
    const idx = url.indexOf("://");
    if (idx !== -1) {
      const after = url.slice(idx + 3);
      const slash = after.indexOf("/");
      path = slash !== -1 ? after.slice(slash) : "";
    }
  }
  const segments = path.split("/").filter(Boolean);
  // skip paging segments, pure numbers, and very short tokens
  const PAGING_TOKENS = new Set(["page", "p", "pg", "page-num", "pagination", "category", "tag", "tags"]);
  const meaningful = segments.filter((s) => {
    const lower = s.toLowerCase();
    return !/^\d+$/.test(s) && s.length > 2 && !PAGING_TOKENS.has(lower);
  });
  if (meaningful.length === 0) return "";
  // last meaningful segment, ignore common extensions
  let last = meaningful[meaningful.length - 1].toLowerCase();
  last = last.replace(/\.(html?|php|aspx?|jsp)$/i, "");
  return last;
}

/** Normalize a slug for similarity comparison — strips versioning suffixes. */
export function normalizeSlugForCompare(slug: string): string {
  if (!slug) return "";
  return slug.replace(/-(v?\d+|new|old|updated|copy|final|draft|v\d+)$/i, "");
}

// ---- Scoring ----

function clamp100(n: number): number {
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

/** Traffic contribution: 0 traffic → 100, 1000+ traffic → 0. */
export function trafficScore(traffic: number): number {
  if (traffic <= 0) return 100;
  if (traffic >= 1000) return 0;
  return clamp100(100 - (traffic / 1000) * 100);
}

/** Backlink contribution: 0 backlinks → 100, 50+ backlinks → 0. */
export function backlinkScore(backlinks: number): number {
  if (backlinks <= 0) return 100;
  if (backlinks >= 50) return 0;
  return clamp100(100 - (backlinks / 50) * 100);
}

/** Age contribution: 0 months → 0, 48+ months → 100. */
export function ageScore(ageMonths: number): number {
  if (ageMonths <= 0) return 0;
  if (ageMonths >= 48) return 100;
  return clamp100((ageMonths / 48) * 100);
}

/** Word-count contribution: <100 words → 100, 2000+ words → 0. */
export function wordCountScore(wordCount: number): number {
  if (wordCount <= 100) return 100;
  if (wordCount >= 2000) return 0;
  return clamp100(100 - ((wordCount - 100) / 1900) * 100);
}

/** Weighted pruning score (0..100, higher = more likely to prune). */
export function computePruningScore(item: ContentItem): number {
  const t = trafficScore(item.traffic) * WEIGHTS.traffic;
  const b = backlinkScore(item.backlinks) * WEIGHTS.backlinks;
  const a = ageScore(item.ageMonths) * WEIGHTS.age;
  const w = wordCountScore(item.wordCount) * WEIGHTS.wordCount;
  return Math.round((t + b + a + w) * 10) / 10;
}

// ---- Decision matrix ----

/** Get effective thresholds for a preset, optionally with overrides. */
export function getThresholds(preset: Preset, overrides?: Partial<Thresholds>): Thresholds {
  return { ...PRESET_THRESHOLDS[preset], ...(overrides ?? {}) };
}

/** Find another URL with the same keyword slug (merge candidate). */
export function findMergeCandidate(
  item: ContentItem,
  all: ContentItem[],
  thresholds: Thresholds,
): ContentItem | undefined {
  if (!item.url) return undefined;
  const slug = normalizeSlugForCompare(extractKeywordSlug(item.url));
  if (!slug) return undefined;
  for (const other of all) {
    if (other.url === item.url) continue;
    const otherSlug = normalizeSlugForCompare(extractKeywordSlug(other.url));
    if (!otherSlug) continue;
    if (otherSlug !== slug) continue;
    // merge into a stronger page (higher traffic or backlinks)
    if (other.traffic > item.traffic || other.backlinks > item.backlinks) {
      if (other.traffic >= thresholds.keepTraffic || other.backlinks >= thresholds.keepBacklinks) {
        return other;
      }
    }
  }
  return undefined;
}

/** Find a keep/improve URL to redirect to (preferably same hostname). */
export function findRedirectTarget(
  item: ContentItem,
  audited: AuditedItem[],
): AuditedItem | undefined {
  let host = "";
  try {
    host = new URL(item.url).hostname;
  } catch {
    host = "";
  }
  // Prefer same-host keep/improve pages with highest traffic.
  const candidates = audited.filter(
    (a) =>
      a.url !== item.url &&
      (a.decision === "keep" || a.decision === "improve") &&
      (host === "" || a.url.includes(host)),
  );
  if (candidates.length === 0) {
    // fall back to any keep/improve page
    const any = audited.filter((a) => a.url !== item.url && (a.decision === "keep" || a.decision === "improve"));
    if (any.length === 0) return undefined;
    any.sort((a, b) => b.traffic - a.traffic);
    return any[0];
  }
  candidates.sort((a, b) => b.traffic - a.traffic);
  return candidates[0];
}

/** Decide the action for a single item given all items + thresholds. */
export function decideAction(
  item: ContentItem,
  all: ContentItem[],
  thresholds: Thresholds,
): { decision: Decision; reason: string } {
  // 1. delete — zero traffic + zero backlinks + old + thin content
  if (
    item.traffic === 0 &&
    item.backlinks === 0 &&
    item.ageMonths > thresholds.deleteAgeMonths &&
    item.wordCount < thresholds.deleteWordCount
  ) {
    return {
      decision: "delete",
      reason: `Zero traffic & backlinks, ${item.ageMonths}mo old, ${item.wordCount} words — delete and disavow.`,
    };
  }
  // 2. redirect — low traffic + low backlinks + old
  if (
    item.traffic < thresholds.mergeTraffic &&
    item.backlinks < thresholds.redirectBacklinks &&
    item.ageMonths > thresholds.redirectAgeMonths
  ) {
    return {
      decision: "redirect",
      reason: `Low traffic (${item.traffic}) + ${item.backlinks} backlinks + ${item.ageMonths}mo old — redirect to stronger page.`,
    };
  }
  // 3. merge — low traffic + has similar URL in inventory
  if (item.traffic < thresholds.mergeTraffic) {
    const mergeCand = findMergeCandidate(item, all, thresholds);
    if (mergeCand) {
      return {
        decision: "merge",
        reason: `Low traffic (${item.traffic}); same-keyword page "${mergeCand.url}" has more authority — merge.`,
      };
    }
  }
  // 4. keep — high traffic OR high backlinks
  if (item.traffic >= thresholds.keepTraffic || item.backlinks >= thresholds.keepBacklinks) {
    return {
      decision: "keep",
      reason: `Strong signals (${item.traffic} traffic / ${item.backlinks} backlinks) — keep.`,
    };
  }
  // 5. improve — medium traffic + low word count
  if (
    item.traffic >= thresholds.improveTrafficLow &&
    item.traffic <= thresholds.improveTrafficHigh &&
    item.wordCount < thresholds.improveWordCount
  ) {
    return {
      decision: "improve",
      reason: `Medium traffic (${item.traffic}) + thin content (${item.wordCount} words) — improve/expand.`,
    };
  }
  // 6. fallback — keep
  return {
    decision: "keep",
    reason: `Within thresholds (${item.traffic} traffic / ${item.wordCount} words) — keep.`,
  };
}

/** Run the full audit pipeline. */
export function auditItems(
  items: ContentItem[],
  preset: Preset = "balanced",
  overrides?: Partial<Thresholds>,
): AuditedItem[] {
  const thresholds = getThresholds(preset, overrides);
  const audited: AuditedItem[] = [];
  for (const item of items) {
    const { decision, reason } = decideAction(item, items, thresholds);
    audited.push({
      ...item,
      url: normalizeUrl(item.url),
      decision,
      pruningScore: computePruningScore(item),
      reason,
      keywordSlug: extractKeywordSlug(item.url),
    });
  }
  // Resolve mergeWith & redirectTo after we know every decision.
  for (const a of audited) {
    if (a.decision === "merge") {
      const cand = findMergeCandidate(a, items, thresholds);
      if (cand) a.mergeWith = normalizeUrl(cand.url);
    } else if (a.decision === "redirect") {
      const target = findRedirectTarget(a, audited);
      if (target) a.redirectTo = target.url;
    }
  }
  // Sort: delete > redirect > merge > improve > keep; within same, higher score first.
  const order: Record<Decision, number> = { delete: 0, redirect: 1, merge: 2, improve: 3, keep: 4 };
  audited.sort((a, b) => order[a.decision] - order[b.decision] || b.pruningScore - a.pruningScore);
  return audited;
}

/** Summarize audited items. */
export function summarizeAudit(items: AuditedItem[]): AuditSummary {
  const sum: AuditSummary = {
    total: items.length,
    keep: 0,
    improve: 0,
    merge: 0,
    redirect: 0,
    delete: 0,
    totalTraffic: 0,
    totalBacklinks: 0,
    avgPruningScore: 0,
    highRiskCount: 0,
  };
  let scoreSum = 0;
  for (const it of items) {
    sum[it.decision]++;
    sum.totalTraffic += it.traffic;
    sum.totalBacklinks += it.backlinks;
    scoreSum += it.pruningScore;
    if (it.pruningScore >= 60) sum.highRiskCount++;
  }
  sum.avgPruningScore = items.length > 0 ? Math.round((scoreSum / items.length) * 10) / 10 : 0;
  return sum;
}

// ---- Rendering ----

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

/** Render audit as an aligned text table. */
export function renderTextTable(items: AuditedItem[]): string {
  if (items.length === 0) return "No items.";
  const header = ["URL", "TRAFFIC", "BACKLINKS", "WORDS", "AGE", "SCORE", "DECISION"];
  const rows: string[][] = [header];
  for (const it of items) {
    rows.push([
      it.url,
      String(it.traffic),
      String(it.backlinks),
      String(it.wordCount),
      `${it.ageMonths}mo`,
      String(it.pruningScore),
      it.decision.toUpperCase(),
    ]);
  }
  const colWidths = header.map((h, i) =>
    Math.min(60, Math.max(h.length, ...rows.map((r) => r[i].length))),
  );
  const lines = rows.map((r) => r.map((c, i) => pad(c, colWidths[i])).join("  "));
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render audit as CSV. */
export function renderCsv(items: AuditedItem[]): string {
  const lines = [
    "url,traffic,backlinks,word_count,age_months,pruning_score,decision,redirect_to,merge_with,reason",
  ];
  for (const it of items) {
    lines.push(
      [
        escapeCsv(it.url),
        it.traffic,
        it.backlinks,
        it.wordCount,
        it.ageMonths,
        it.pruningScore,
        it.decision,
        escapeCsv(it.redirectTo ?? ""),
        escapeCsv(it.mergeWith ?? ""),
        escapeCsv(it.reason),
      ].join(","),
    );
  }
  return lines.join("\n");
}

// ---- History (localStorage) ----

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, HISTORY_MAX);
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

export function buildShareUrl(input: string, preset: Preset): string {
  const params = new URLSearchParams();
  if (input) params.set("input", input);
  if (preset && preset !== "balanced") params.set("preset", preset);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { input: string; preset: Preset } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { input: "", preset: "balanced" };
  const params = new URLSearchParams(clean);
  const presetRaw = params.get("preset");
  const preset: Preset =
    presetRaw === "conservative" || presetRaw === "aggressive" ? presetRaw : "balanced";
  return { input: params.get("input") ?? "", preset };
}
