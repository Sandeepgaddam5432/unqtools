/**
 * SERP Competitor Analysis Tool — pure logic.
 *
 * Parse competitor HTML, extract word count, heading structure, keyword
 * usage, meta tags, and detect content gaps. Pure functions only — no DOM,
 * no network.
 */

export interface CompetitorAnalysis {
  label: string; // "Primary" | "Competitor 1" | ...
  html: string;
  wordCount: number;
  headings: Array<{ level: number; text: string }>;
  title: string;
  metaDescription: string;
  keywordCount: number; // occurrences of target keyword
  keywordDensity: number; // % of words that are the keyword
  linkCount: number;
  imageCount: number;
}

export interface GapItem {
  text: string;
  competitorsWithIt: string[]; // labels
}

export interface AnalysisResult {
  targetKeyword: string;
  competitors: CompetitorAnalysis[];
  contentGaps: GapItem[]; // headings in competitors but missing in primary
  sharedHeadings: string[]; // headings present in all competitors
  averageWordCount: number;
  statsTable: Array<{ label: string; wordCount: number; keywordCount: number; keywordDensity: number; headings: number; links: number; images: number }>;
}

/** Strip HTML tags, return visible text. */
export function stripTags(html: string): string {
  if (!html) return "";
  return html
    // Remove scripts and styles entirely
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    // Replace tags with spaces
    .replace(/<[^>]+>/g, " ")
    // Decode common entities
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract all headings (H1-H6) with level + text. */
export function extractHeadings(html: string): Array<{ level: number; text: string }> {
  if (!html) return [];
  const re = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const out: Array<{ level: number; text: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const level = parseInt(m[1], 10);
    const text = stripTags(m[2]).trim();
    if (text) out.push({ level, text });
  }
  return out;
}

/** Extract <title> tag content. */
export function extractTitle(html: string): string {
  if (!html) return "";
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripTags(m[1]).trim() : "";
}

/** Extract <meta name="description" content="..."> */
export function extractMetaDescription(html: string): string {
  if (!html) return "";
  const m = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']/i);
  if (m) return stripTags(m[1]).trim();
  // Try content-first ordering
  const m2 = html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["']/i);
  return m2 ? stripTags(m2[1]).trim() : "";
}

/** Count words in a text string. */
export function countWords(text: string): number {
  if (!text) return 0;
  const words = text.match(/[A-Za-z0-9']+/g);
  return words ? words.length : 0;
}

/** Count occurrences of a keyword (case-insensitive, whole-word match). */
export function countKeyword(text: string, keyword: string): number {
  if (!text || !keyword) return 0;
  const k = keyword.trim().toLowerCase();
  if (!k) return 0;
  // Escape regex special chars
  const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match as whole words
  const re = new RegExp(`\\b${escaped}\\b`, "gi");
  const m = text.toLowerCase().match(re);
  return m ? m.length : 0;
}

/** Count <a> tags. */
export function countLinks(html: string): number {
  if (!html) return 0;
  const m = html.match(/<a\b[^>]*>/gi);
  return m ? m.length : 0;
}

/** Count <img> tags. */
export function countImages(html: string): number {
  if (!html) return 0;
  const m = html.match(/<img\b[^>]*>/gi);
  return m ? m.length : 0;
}

/** Analyze a single competitor's HTML. */
export function analyzeCompetitor(
  label: string,
  html: string,
  keyword: string,
): CompetitorAnalysis {
  const text = stripTags(html);
  const wordCount = countWords(text);
  const keywordCount = countKeyword(text, keyword);
  const keywordDensity = wordCount > 0 ? (keywordCount / wordCount) * 100 : 0;
  return {
    label,
    html,
    wordCount,
    headings: extractHeadings(html),
    title: extractTitle(html),
    metaDescription: extractMetaDescription(html),
    keywordCount,
    keywordDensity,
    linkCount: countLinks(html),
    imageCount: countImages(html),
  };
}

/** Normalize heading text for gap matching (lowercase, collapse whitespace). */
export function normalizeHeading(text: string): string {
  return (text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Detect content gaps: headings present in competitors but missing in primary. */
export function detectContentGaps(
  primary: CompetitorAnalysis,
  competitors: CompetitorAnalysis[],
): GapItem[] {
  const primaryHeadings = new Set(primary.headings.map((h) => normalizeHeading(h.text)));
  const competitorHeadingMap = new Map<string, string[]>(); // normalized → original labels
  for (const c of competitors) {
    for (const h of c.headings) {
      const norm = normalizeHeading(h.text);
      if (primaryHeadings.has(norm)) continue;
      const existing = competitorHeadingMap.get(norm) || [];
      if (!existing.includes(c.label)) existing.push(c.label);
      competitorHeadingMap.set(norm, existing);
    }
  }
  const gaps: GapItem[] = [];
  for (const [text, labels] of competitorHeadingMap.entries()) {
    if (labels.length >= 1) {
      gaps.push({ text, competitorsWithIt: labels });
    }
  }
  gaps.sort((a, b) => b.competitorsWithIt.length - a.competitorsWithIt.length);
  return gaps;
}

/** Find headings present in ALL competitors (including primary). */
export function findSharedHeadings(all: CompetitorAnalysis[]): string[] {
  if (all.length === 0) return [];
  const sets = all.map((c) => new Set(c.headings.map((h) => normalizeHeading(h.text))));
  const first = sets[0];
  const shared: string[] = [];
  for (const h of first) {
    if (sets.every((s) => s.has(h))) shared.push(h);
  }
  return shared;
}

/** Run the full analysis pipeline. */
export function analyze(
  keyword: string,
  inputs: Array<{ label: string; html: string }>,
): AnalysisResult {
  const competitors = inputs
    .filter((i) => i.html && i.html.trim())
    .map((i) => analyzeCompetitor(i.label, i.html, keyword));
  if (competitors.length === 0) {
    return {
      targetKeyword: keyword,
      competitors: [],
      contentGaps: [],
      sharedHeadings: [],
      averageWordCount: 0,
      statsTable: [],
    };
  }
  const primary = competitors[0];
  const rest = competitors.slice(1);
  const contentGaps = rest.length > 0 ? detectContentGaps(primary, rest) : [];
  const sharedHeadings = findSharedHeadings(competitors);
  const averageWordCount = Math.round(
    competitors.reduce((acc, c) => acc + c.wordCount, 0) / competitors.length,
  );
  const statsTable = competitors.map((c) => ({
    label: c.label,
    wordCount: c.wordCount,
    keywordCount: c.keywordCount,
    keywordDensity: c.keywordDensity,
    headings: c.headings.length,
    links: c.linkCount,
    images: c.imageCount,
  }));
  return {
    targetKeyword: keyword,
    competitors,
    contentGaps,
    sharedHeadings,
    averageWordCount,
    statsTable,
  };
}

/** Render the analysis as a Markdown report. */
export function renderMarkdown(result: AnalysisResult): string {
  const lines: string[] = [];
  lines.push(`# SERP Competitor Analysis Report`);
  lines.push("");
  lines.push(`**Target keyword:** ${result.targetKeyword || "(none)"}`);
  lines.push(`**Competitors analyzed:** ${result.competitors.length}`);
  lines.push(`**Average word count:** ${result.averageWordCount}`);
  lines.push("");
  lines.push("## Stats table");
  lines.push("");
  lines.push("| Source | Words | Keyword | Density | Headings | Links | Images |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const s of result.statsTable) {
    lines.push(
      `| ${s.label} | ${s.wordCount} | ${s.keywordCount} | ${s.keywordDensity.toFixed(2)}% | ${s.headings} | ${s.links} | ${s.images} |`,
    );
  }
  lines.push("");
  if (result.sharedHeadings.length > 0) {
    lines.push("## Shared headings (in all sources)");
    lines.push("");
    for (const h of result.sharedHeadings) {
      lines.push(`- ${h}`);
    }
    lines.push("");
  }
  if (result.contentGaps.length > 0) {
    lines.push("## Content gaps (headings in competitors missing from primary)");
    lines.push("");
    for (const g of result.contentGaps) {
      lines.push(`- **${g.text}** — in ${g.competitorsWithIt.join(", ")}`);
    }
    lines.push("");
  }
  lines.push("## Per-competitor heading structure");
  lines.push("");
  for (const c of result.competitors) {
    lines.push(`### ${c.label}`);
    lines.push(`- **Title:** ${c.title || "(none)"}`);
    lines.push(`- **Meta description:** ${c.metaDescription || "(none)"}`);
    lines.push(`- **Word count:** ${c.wordCount}`);
    lines.push(`- **Keyword count:** ${c.keywordCount} (${c.keywordDensity.toFixed(2)}% density)`);
    lines.push("- **Headings:**");
    for (const h of c.headings) {
      lines.push(`  - ${"#".repeat(h.level)} ${h.text}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ---- History ----

const HISTORY_KEY = "unqtools:serp-competitor-analysis:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  keyword: string;
  competitorCount: number;
  averageWordCount: number;
  gapCount: number;
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

export function buildShareUrl(input: { keyword: string; competitors: Array<{ label: string; html: string }> }): string {
  const params = new URLSearchParams();
  if (input.keyword) params.set("kw", input.keyword);
  input.competitors.forEach((c, i) => {
    if (c.html) params.set(`h${i + 1}`, c.html);
  });
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { keyword: string; competitors: Array<{ label: string; html: string }> } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { keyword: "", competitors: [] };
  const params = new URLSearchParams(clean);
  const keyword = params.get("kw") ?? "";
  const competitors: Array<{ label: string; html: string }> = [];
  const labels = ["Primary", "Competitor 1", "Competitor 2", "Competitor 3"];
  for (let i = 1; i <= 4; i++) {
    const h = params.get(`h${i}`);
    if (h) competitors.push({ label: labels[i - 1] ?? `Source ${i}`, html: h });
  }
  return { keyword, competitors };
}
