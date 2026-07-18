/**
 * Backlink Quality & Toxicity Scorer — pure logic.
 *
 * Score backlinks 0-100 for quality and flag toxicity. Pure functions
 * only — no DOM, no network.
 */

export interface Backlink {
  url: string;
  anchor: string;
  sourceDomain: string;
  da: number; // 0-100
  spamScore: number; // 0-100
  linkType: "dofollow" | "nofollow";
}

export type AnchorType = "branded" | "exact" | "partial" | "generic";
export type QualityCategory = "good" | "suspicious" | "toxic";

export interface ScoredBacklink extends Backlink {
  qualityScore: number; // 0-100
  isToxic: boolean;
  category: QualityCategory;
  anchorType: AnchorType;
  reasons: string[]; // toxicity reasons
  recommendation: string;
}

export interface ScoringResult {
  scored: ScoredBacklink[];
  total: number;
  byCategory: Record<QualityCategory, number>;
  averageScore: number;
  topToxic: ScoredBacklink[];
  daDistribution: { low: number; medium: number; high: number };
  spamDistribution: { clean: number; low: number; medium: number; high: number };
  anchorTypeCounts: Record<AnchorType, number>;
}

export const TOXIC_DA_THRESHOLD = 10;
export const SUSPICIOUS_DA_THRESHOLD = 25;
export const TOXIC_SPAM_THRESHOLD = 60;
export const SUSPICIOUS_SPAM_THRESHOLD = 30;

const GENERIC_ANCHORS = ["click here", "read more", "learn more", "here", "this post", "this article", "more", "link"];
const BRAND_SUFFIXES = [".com", ".org", ".net", ".io", ".co"];

/** Normalize a string. */
export function normalize(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Extract domain from URL. */
export function extractDomain(input: string): string {
  if (!input) return "";
  const s = input.toLowerCase().trim();
  const cleaned = s.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const slash = cleaned.indexOf("/");
  return slash >= 0 ? cleaned.slice(0, slash) : cleaned;
}

/** Classify anchor type. */
export function classifyAnchor(anchor: string, targetDomain?: string): AnchorType {
  const a = normalize(anchor);
  if (!a) return "generic";
  if (GENERIC_ANCHORS.includes(a)) return "generic";
  // Brand check: anchor matches target domain's brand (root domain without TLD)
  if (targetDomain) {
    const brand = extractDomain(targetDomain).split(".")[0];
    if (brand && (a === brand || a.includes(brand))) return "branded";
  }
  // Heuristic: 1-2 words with no spaces = exact match; 3+ words = partial; with money words = exact
  const words = a.split(" ").filter(Boolean);
  const moneyWords = ["buy", "cheap", "best", "price", "review", "discount", "deal"];
  if (moneyWords.some((w) => words.includes(w)) && words.length <= 4) return "exact";
  if (words.length <= 2) return "exact";
  return "partial";
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

/** Parse CSV into Backlink[]. */
export function parseCsv(input: string, targetDomain?: string): { backlinks: Backlink[]; errors: string[] } {
  if (!input || !input.trim()) return { backlinks: [], errors: [] };
  const errors: string[] = [];
  const lines = input.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { backlinks: [], errors: [] };
  const firstLine = lines[0].toLowerCase();
  // Header detection: first cell must look like a column name (no protocol, no path)
  const firstCell = splitCsvRow(firstLine)[0]?.trim() ?? "";
  const hasHeader = /^(url|target_url|anchor|source_domain|source|domain|referring_domain|da|domain_authority|dr|spam_score|spam|link_type|type)$/.test(firstCell);
  let colMap: Record<string, number> | null = null;
  let startIdx = 0;
  if (hasHeader) {
    const headers = splitCsvRow(lines[0]).map((h) => h.toLowerCase().trim());
    colMap = {};
    headers.forEach((h, i) => {
      if (h === "url" || h === "target_url") colMap!.url = i;
      else if (h === "anchor" || h === "anchor_text") colMap!.anchor = i;
      else if (h === "source_domain" || h === "source" || h === "domain" || h === "referring_domain") colMap!.sourceDomain = i;
      else if (h === "da" || h === "domain_authority" || h === "dr") colMap!.da = i;
      else if (h === "spam_score" || h === "spam") colMap!.spamScore = i;
      else if (h === "link_type" || h === "type") colMap!.linkType = i;
    });
    if (colMap.url === undefined) colMap = null;
    startIdx = 1;
  } else {
    colMap = { url: 0, anchor: 1, sourceDomain: 2, da: 3, spamScore: 4, linkType: 5 };
  }
  const backlinks: Backlink[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i]);
    const url = (cols[colMap!.url] ?? "").trim();
    if (!url) { errors.push(`Row ${i + 1}: missing url — skipped`); continue; }
    const anchor = (cols[colMap!.anchor ?? -1] ?? "").trim();
    const sourceDomain = extractDomain((cols[colMap!.sourceDomain ?? -1] ?? "").trim());
    const da = parseFloat(cols[colMap!.da ?? -1] ?? "0") || 0;
    const spamScore = parseFloat(cols[colMap!.spamScore ?? -1] ?? "0") || 0;
    const linkTypeRaw = (cols[colMap!.linkType ?? -1] ?? "").trim().toLowerCase();
    const linkType: Backlink["linkType"] = linkTypeRaw === "nofollow" ? "nofollow" : "dofollow";
    backlinks.push({ url, anchor, sourceDomain, da, spamScore, linkType });
  }
  return { backlinks, errors };
}

/** Parse JSON array into Backlink[]. */
export function parseJson(input: string): { backlinks: Backlink[]; errors: string[] } {
  if (!input || !input.trim()) return { backlinks: [], errors: [] };
  try {
    const parsed = JSON.parse(input);
    if (!Array.isArray(parsed)) return { backlinks: [], errors: ["JSON must be an array"] };
    const backlinks: Backlink[] = [];
    const errors: string[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i] as Record<string, unknown>;
      if (!item || typeof item !== "object") { errors.push(`Item ${i}: not an object`); continue; }
      const url = String(item.url ?? item.target_url ?? "").trim();
      if (!url) { errors.push(`Item ${i}: missing url`); continue; }
      backlinks.push({
        url,
        anchor: String(item.anchor ?? item.anchor_text ?? "").trim(),
        sourceDomain: extractDomain(String(item.source_domain ?? item.source ?? item.domain ?? "").trim()),
        da: typeof item.da === "number" ? item.da : parseFloat(String(item.da ?? 0)) || 0,
        spamScore: typeof item.spam_score === "number" ? item.spam_score : parseFloat(String(item.spam_score ?? 0)) || 0,
        linkType: String(item.link_type ?? item.type ?? "dofollow").toLowerCase() === "nofollow" ? "nofollow" : "dofollow",
      });
    }
    return { backlinks, errors };
  } catch (e) {
    return { backlinks: [], errors: [e instanceof Error ? e.message : "Invalid JSON"] };
  }
}

/** Auto-detect format and parse. */
export function parseAuto(input: string, targetDomain?: string): { backlinks: Backlink[]; errors: string[] } {
  const trimmed = input.trim();
  if (!trimmed) return { backlinks: [], errors: [] };
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) return parseJson(input);
  return parseCsv(input, targetDomain);
}

/** Compute toxicity reasons for a backlink. */
export function toxicityReasons(b: Backlink, anchorType: AnchorType): string[] {
  const reasons: string[] = [];
  if (b.spamScore >= TOXIC_SPAM_THRESHOLD) reasons.push(`High spam score (${b.spamScore})`);
  if (b.da < TOXIC_DA_THRESHOLD) reasons.push(`Very low DA (${b.da})`);
  if (anchorType === "exact") reasons.push("Exact-match commercial anchor");
  if (b.spamScore >= SUSPICIOUS_SPAM_THRESHOLD && b.spamScore < TOXIC_SPAM_THRESHOLD) {
    reasons.push(`Elevated spam score (${b.spamScore})`);
  }
  if (b.da >= TOXIC_DA_THRESHOLD && b.da < SUSPICIOUS_DA_THRESHOLD) {
    reasons.push(`Low DA (${b.da})`);
  }
  return reasons;
}

/** Compute quality score 0-100 for a backlink. */
export function computeQualityScore(b: Backlink, anchorType: AnchorType): number {
  // DA contributes up to 40
  const daScore = Math.min(40, (b.da / 100) * 40);
  // Spam score reduces up to 30 (100 spam = -30)
  const spamPenalty = (b.spamScore / 100) * 30;
  // Anchor type: branded 20, partial 15, generic 8, exact 5 (suspicious)
  const anchorScore = anchorType === "branded" ? 20 : anchorType === "partial" ? 15 : anchorType === "generic" ? 8 : 5;
  // Link type: dofollow 10, nofollow 5
  const linkScore = b.linkType === "dofollow" ? 10 : 5;
  // Source domain present: 5, missing: 0
  const domainScore = b.sourceDomain ? 5 : 0;
  const total = daScore + anchorScore + linkScore + domainScore - spamPenalty;
  return Math.max(0, Math.min(100, Math.round(total)));
}

/** Score a single backlink. */
export function scoreBacklink(b: Backlink, targetDomain?: string): ScoredBacklink {
  const anchorType = classifyAnchor(b.anchor, targetDomain);
  const reasons = toxicityReasons(b, anchorType);
  const isToxic = b.spamScore >= TOXIC_SPAM_THRESHOLD ||
    b.da < TOXIC_DA_THRESHOLD;
  const isSuspicious = !isToxic && (
    b.spamScore >= SUSPICIOUS_SPAM_THRESHOLD ||
    b.da < SUSPICIOUS_DA_THRESHOLD ||
    anchorType === "exact"
  );
  const category: QualityCategory = isToxic ? "toxic" : isSuspicious ? "suspicious" : "good";
  const qualityScore = computeQualityScore(b, anchorType);
  let recommendation: string;
  if (isToxic) recommendation = "Disavow this link — review and add to disavow file";
  else if (isSuspicious) recommendation = "Monitor — investigate before disavowing";
  else recommendation = "Keep — healthy backlink";
  return {
    ...b,
    qualityScore,
    isToxic,
    category,
    anchorType,
    reasons,
    recommendation,
  };
}

/** Score a list of backlinks and compute summary stats. */
export function scoreAll(backlinks: Backlink[], targetDomain?: string): ScoringResult {
  const scored = backlinks.map((b) => scoreBacklink(b, targetDomain));
  const byCategory: Record<QualityCategory, number> = { good: 0, suspicious: 0, toxic: 0 };
  const anchorTypeCounts: Record<AnchorType, number> = { branded: 0, exact: 0, partial: 0, generic: 0 };
  for (const s of scored) {
    byCategory[s.category] += 1;
    anchorTypeCounts[s.anchorType] += 1;
  }
  const averageScore = scored.length > 0
    ? Math.round((scored.reduce((acc, s) => acc + s.qualityScore, 0) / scored.length) * 10) / 10
    : 0;
  const topToxic = scored
    .filter((s) => s.isToxic)
    .sort((a, b) => a.qualityScore - b.qualityScore)
    .slice(0, 20);
  const daDistribution = {
    low: scored.filter((s) => s.da < 30).length,
    medium: scored.filter((s) => s.da >= 30 && s.da < 60).length,
    high: scored.filter((s) => s.da >= 60).length,
  };
  const spamDistribution = {
    clean: scored.filter((s) => s.spamScore < 10).length,
    low: scored.filter((s) => s.spamScore >= 10 && s.spamScore < 30).length,
    medium: scored.filter((s) => s.spamScore >= 30 && s.spamScore < 60).length,
    high: scored.filter((s) => s.spamScore >= 60).length,
  };
  return {
    scored,
    total: scored.length,
    byCategory,
    averageScore,
    topToxic,
    daDistribution,
    spamDistribution,
    anchorTypeCounts,
  };
}

/** Render result as CSV. */
export function renderCsv(result: ScoringResult): string {
  const lines: string[] = [];
  lines.push("# Summary");
  lines.push(`total,${result.total}`);
  lines.push(`good,${result.byCategory.good}`);
  lines.push(`suspicious,${result.byCategory.suspicious}`);
  lines.push(`toxic,${result.byCategory.toxic}`);
  lines.push(`average_score,${result.averageScore}`);
  lines.push("");
  lines.push("# Scored backlinks");
  lines.push("url,anchor,source_domain,da,spam_score,link_type,anchor_type,quality_score,category,toxic,reasons");
  for (const s of result.scored) {
    lines.push([
      escapeCsv(s.url),
      escapeCsv(s.anchor),
      escapeCsv(s.sourceDomain),
      s.da,
      s.spamScore,
      s.linkType,
      s.anchorType,
      s.qualityScore,
      s.category,
      s.isToxic ? 1 : 0,
      escapeCsv(s.reasons.join("; ")),
    ].join(","));
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:backlink-quality-scorer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  total: number;
  toxic: number;
  suspicious: number;
  good: number;
  averageScore: number;
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

export function buildShareUrl(payload: string, targetDomain?: string): string {
  const params = new URLSearchParams();
  if (payload) params.set("data", payload);
  if (targetDomain) params.set("target", targetDomain);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { data: string; target: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { data: "", target: "" };
  const params = new URLSearchParams(clean);
  return { data: params.get("data") ?? "", target: params.get("target") ?? "" };
}

// Suppress unused export lint
export const _BRAND_SUFFIXES = BRAND_SUFFIXES;
