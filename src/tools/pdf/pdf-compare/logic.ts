/**
 * PDF Compare — pure logic.
 *
 * Pure functions only — no DOM, no pdf-lib. The actual PDF text/metadata
 * extraction lives in ui.tsx; this module handles parsing, comparison,
 * formatting, statistics, history and shareable URLs.
 */
import type { ToolResult } from "../../../lib/tool";
import { parsePageRanges } from "../_shared/page-ranges";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type ComparisonMode = "text-only" | "metadata-only" | "full" | "structure";

export interface CompareOptions {
  comparisonMode: ComparisonMode;
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
  /** "all" or "1-3, 5" — only compare these pages (0-based indices resolved later). */
  pageRange: string;
}

export const COMPARISON_MODES: ComparisonMode[] = [
  "text-only",
  "metadata-only",
  "full",
  "structure",
];

export const MODE_LABELS: Record<ComparisonMode, string> = {
  "text-only": "Text only (per-page line diff)",
  "metadata-only": "Metadata only (title, author, etc.)",
  full: "Full (text + metadata + structure)",
  structure: "Structure only (page count, sizes, fonts)",
};

export const DEFAULT_OPTIONS: CompareOptions = {
  comparisonMode: "full",
  ignoreWhitespace: true,
  ignoreCase: false,
  pageRange: "all",
};

export type DiffLineType = "added" | "removed" | "unchanged" | "modified";

export interface DiffLine {
  type: DiffLineType;
  /** 1-based line number in the source document (added → doc2, removed → doc1). */
  lineNum: number;
  content: string;
  /** For "modified" lines, the matching content from the other doc. */
  oldContent?: string;
}

export interface PageDiff {
  /** 1-based page number. */
  page: number;
  /** True when the page exists in both documents. */
  bothExist: boolean;
  /** Lines of the diff (empty if either page is missing). */
  lines: DiffLine[];
  /** 0-100 similarity score for the page. */
  similarity: number;
  /** Count of added lines. */
  added: number;
  /** Count of removed lines. */
  removed: number;
  /** Count of modified lines. */
  modified: number;
  /** Count of unchanged lines. */
  unchanged: number;
}

export interface MetadataField {
  field: string;
  value1: string;
  value2: string;
  same: boolean;
}

export interface MetadataDiff {
  fields: MetadataField[];
  /** Number of fields that differ. */
  differences: number;
}

export interface StructureDiff {
  pageCount1: number;
  pageCount2: number;
  pageCountDelta: number;
  /** Unique page sizes in doc1 (as "WxH"). */
  pageSizes1: string[];
  /** Unique page sizes in doc2. */
  pageSizes2: string[];
  /** True when the set of page sizes differs. */
  sizesDiffer: boolean;
  /** Font names embedded in doc1. */
  fonts1: string[];
  /** Font names embedded in doc2. */
  fonts2: string[];
  /** True when the set of font names differs. */
  fontsDiffer: boolean;
  /** Per-page image counts in doc1. */
  imageCounts1: number[];
  /** Per-page image counts in doc2. */
  imageCounts2: number[];
  /** True when any per-page image count differs. */
  imageCountsDiffer: boolean;
}

export interface FontUsageEntry {
  font: string;
  count1: number;
  count2: number;
  delta: number;
}

export interface PageCountDiff {
  count1: number;
  count2: number;
  delta: number;
  /** Pages added in doc2 (count2 - min(count1, count2) if count2 > count1). */
  added: number;
  /** Pages removed from doc1 (count1 - min(count1, count2) if count1 > count2). */
  removed: number;
}

export interface SignificantChange {
  page: number;
  diffCount: number;
  similarity: number;
}

export interface SummaryStats {
  mode: ComparisonMode;
  pagesCompared: number;
  textDifferences: number;
  metadataDifferences: number;
  structureDifferences: number;
  /** Overall document similarity, 0-100. */
  overallSimilarity: number;
  /** Pages with most differences (top 5). */
  significantChanges: SignificantChange[];
}

export interface ComparisonResult {
  mode: ComparisonMode;
  options: CompareOptions;
  pageDiffs: PageDiff[];
  metadataDiff: MetadataDiff;
  structureDiff: StructureDiff;
  pageCountDiff: PageCountDiff;
  fontUsageDiff: FontUsageEntry[];
  summary: SummaryStats;
}

export interface PdfSnapshot {
  pageCount: number;
  pageTexts: string[];
  pageSizes: string[];
  fonts: string[];
  imageCounts: number[];
  metadata: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Page-range parsing
// ---------------------------------------------------------------------------

/** Parse a page-range spec ("all" or "1-3, 5") into 0-based indices. */
export function parseComparePageRange(
  spec: string,
  pageCount: number
): ToolResult<number[]> {
  const trimmed = (spec ?? "").trim().toLowerCase();
  if (!trimmed || trimmed === "all") {
    if (pageCount < 1) return { ok: false, error: "The document has no pages." };
    return {
      ok: true,
      output: Array.from({ length: pageCount }, (_, i) => i),
    };
  }
  return parsePageRanges(trimmed, pageCount);
}

/** Compute the overlap of two page indices (the pages present in both docs). */
export function computePageOverlap(
  indices1: number[],
  indices2: number[]
): number[] {
  const set2 = new Set(indices2);
  return indices1.filter((i) => set2.has(i));
}

// ---------------------------------------------------------------------------
// Text normalizers
// ---------------------------------------------------------------------------

/** Collapse runs of whitespace and trim — used by the whitespace normalizer. */
export function normalizeWhitespace(text: string): string {
  return (text ?? "").replace(/[ \t]+/g, " ").replace(/\r\n?/g, "\n").trim();
}

/** Lowercase text — used by the case normalizer. */
export function normalizeCase(text: string): string {
  return (text ?? "").toLowerCase();
}

/** Apply the user's normalization options to a chunk of text. */
export function normalizeText(text: string, opts: CompareOptions): string {
  let out = text ?? "";
  if (opts.ignoreWhitespace) out = normalizeWhitespace(out);
  if (opts.ignoreCase) out = normalizeCase(out);
  return out;
}

// ---------------------------------------------------------------------------
// Levenshtein distance & similarity
// ---------------------------------------------------------------------------

/** Classic Levenshtein edit distance between two strings. */
export function levenshteinDistance(s1: string, s2: string): number {
  const a = s1 ?? "";
  const b = s2 ?? "";
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  // Two-row optimization
  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1, // insertion
        prev[j] + 1, // deletion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Similarity score 0–100 based on Levenshtein distance. */
export function similarityScore(s1: string, s2: string): number {
  const a = s1 ?? "";
  const b = s2 ?? "";
  if (a.length === 0 && b.length === 0) return 100;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;
  const dist = levenshteinDistance(a, b);
  return Math.round((1 - dist / maxLen) * 100);
}

// ---------------------------------------------------------------------------
// Line-by-line diff
// ---------------------------------------------------------------------------

/**
 * Compute a line-by-line diff between two text blocks.
 * Uses a simple LCS-based algorithm; lines that don't appear in the other
 * block are emitted as added/removed. Identical lines are "unchanged".
 * Modified detection: when an added and a removed line have similarity ≥ 50%,
 * they are emitted as a single "modified" line.
 */
export function compareTextLines(text1: string, text2: string, opts: CompareOptions): DiffLine[] {
  const lines1 = normalizeText(text1, opts).split("\n");
  const lines2 = normalizeText(text2, opts).split("\n");
  // Build LCS table
  const m = lines1.length;
  const n = lines2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (lines1[i - 1] === lines2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  // Backtrack to build the diff
  const raw: DiffLine[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (lines1[i - 1] === lines2[j - 1]) {
      raw.push({ type: "unchanged", lineNum: j, content: lines2[j - 1] });
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      raw.push({ type: "removed", lineNum: i, content: lines1[i - 1] });
      i--;
    } else {
      raw.push({ type: "added", lineNum: j, content: lines2[j - 1] });
      j--;
    }
  }
  while (i > 0) { raw.push({ type: "removed", lineNum: i, content: lines1[i - 1] }); i--; }
  while (j > 0) { raw.push({ type: "added", lineNum: j, content: lines2[j - 1] }); j--; }
  raw.reverse();
  // Pair adjacent removed+added into "modified" when similarity ≥ 50%.
  // Accept either ordering (removed-then-added OR added-then-removed) since
  // the LCS backtrack may produce either after reversal.
  const out: DiffLine[] = [];
  let k = 0;
  while (k < raw.length) {
    const cur = raw[k];
    const next = raw[k + 1];
    if (cur && next) {
      const isModifiedPair =
        (cur.type === "removed" && next.type === "added") ||
        (cur.type === "added" && next.type === "removed");
      if (isModifiedPair) {
        const removed = cur.type === "removed" ? cur : next;
        const added = cur.type === "added" ? cur : next;
        const sim = similarityScore(removed.content, added.content);
        if (sim >= 50) {
          out.push({
            type: "modified",
            lineNum: added.lineNum,
            content: added.content,
            oldContent: removed.content,
          });
          k += 2;
          continue;
        }
      }
    }
    out.push(cur);
    k++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Diff statistics
// ---------------------------------------------------------------------------

export interface DiffStats {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
  total: number;
}

/** Compute counts of each diff-line type. */
export function computeDiffStats(lines: DiffLine[]): DiffStats {
  const s: DiffStats = { added: 0, removed: 0, modified: 0, unchanged: 0, total: lines.length };
  for (const l of lines) {
    if (l.type === "added") s.added += 1;
    else if (l.type === "removed") s.removed += 1;
    else if (l.type === "modified") s.modified += 1;
    else if (l.type === "unchanged") s.unchanged += 1;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Page-by-page diff
// ---------------------------------------------------------------------------

/** Build a PageDiff for a single page. */
export function buildPageDiff(
  page: number,
  text1: string,
  text2: string,
  bothExist: boolean,
  opts: CompareOptions
): PageDiff {
  if (!bothExist) {
    return {
      page,
      bothExist: false,
      lines: [],
      similarity: 0,
      added: 0,
      removed: 0,
      modified: 0,
      unchanged: 0,
    };
  }
  const lines = compareTextLines(text1, text2, opts);
  const stats = computeDiffStats(lines);
  const sim = similarityScore(
    normalizeText(text1, opts),
    normalizeText(text2, opts)
  );
  return {
    page,
    bothExist: true,
    lines,
    similarity: sim,
    added: stats.added,
    removed: stats.removed,
    modified: stats.modified,
    unchanged: stats.unchanged,
  };
}

// ---------------------------------------------------------------------------
// Metadata comparison
// ---------------------------------------------------------------------------

const METADATA_KEYS = [
  "Title",
  "Author",
  "Subject",
  "Keywords",
  "Creator",
  "Producer",
  "CreationDate",
  "ModDate",
] as const;

/** Compare metadata dictionaries field by field. */
export function compareMetadata(
  meta1: Record<string, string>,
  meta2: Record<string, string>
): MetadataDiff {
  const fields: MetadataField[] = [];
  let differences = 0;
  for (const k of METADATA_KEYS) {
    const v1 = meta1[k] ?? "";
    const v2 = meta2[k] ?? "";
    const same = v1 === v2;
    if (!same) differences += 1;
    fields.push({ field: k, value1: v1, value2: v2, same });
  }
  return { fields, differences };
}

// ---------------------------------------------------------------------------
// Structure comparison
// ---------------------------------------------------------------------------

function uniqueSorted(arr: string[]): string[] {
  return Array.from(new Set(arr)).sort();
}

/** Compare structural properties of two PDFs. */
export function compareStructure(snap1: PdfSnapshot, snap2: PdfSnapshot): StructureDiff {
  const sizes1 = uniqueSorted(snap1.pageSizes);
  const sizes2 = uniqueSorted(snap2.pageSizes);
  const fonts1 = uniqueSorted(snap1.fonts);
  const fonts2 = uniqueSorted(snap2.fonts);
  const sizesDiffer =
    sizes1.length !== sizes2.length ||
    sizes1.some((s, i) => s !== sizes2[i]);
  const fontsDiffer =
    fonts1.length !== fonts2.length ||
    fonts1.some((s, i) => s !== fonts2[i]);
  const imageCounts1 = snap1.imageCounts;
  const imageCounts2 = snap2.imageCounts;
  const maxLen = Math.max(imageCounts1.length, imageCounts2.length);
  let imageCountsDiffer = false;
  for (let i = 0; i < maxLen; i++) {
    if ((imageCounts1[i] ?? 0) !== (imageCounts2[i] ?? 0)) {
      imageCountsDiffer = true;
      break;
    }
  }
  return {
    pageCount1: snap1.pageCount,
    pageCount2: snap2.pageCount,
    pageCountDelta: snap2.pageCount - snap1.pageCount,
    pageSizes1: sizes1,
    pageSizes2: sizes2,
    sizesDiffer,
    fonts1,
    fonts2,
    fontsDiffer,
    imageCounts1,
    imageCounts2,
    imageCountsDiffer,
  };
}

/** Compute page-count delta and added/removed pages. */
export function computePageCountDiff(count1: number, count2: number): PageCountDiff {
  const delta = count2 - count1;
  const min = Math.min(count1, count2);
  return {
    count1,
    count2,
    delta,
    added: count2 > count1 ? count2 - min : 0,
    removed: count1 > count2 ? count1 - min : 0,
  };
}

/** Compute per-font usage deltas (count per font in each doc). */
export function computeFontUsageDiff(
  fonts1: string[],
  fonts2: string[]
): FontUsageEntry[] {
  const counts1 = new Map<string, number>();
  const counts2 = new Map<string, number>();
  for (const f of fonts1) counts1.set(f, (counts1.get(f) ?? 0) + 1);
  for (const f of fonts2) counts2.set(f, (counts2.get(f) ?? 0) + 1);
  const all = Array.from(new Set([...counts1.keys(), ...counts2.keys()])).sort();
  return all.map((font) => {
    const count1 = counts1.get(font) ?? 0;
    const count2 = counts2.get(font) ?? 0;
    return { font, count1, count2, delta: count2 - count1 };
  });
}

// ---------------------------------------------------------------------------
// Significant-change finder
// ---------------------------------------------------------------------------

/** Find the pages with the most differences (top N, default 5). */
export function findSignificantChanges(
  pageDiffs: PageDiff[],
  topN: number = 5
): SignificantChange[] {
  return pageDiffs
    .filter((p) => p.bothExist)
    .map((p) => ({
      page: p.page,
      diffCount: p.added + p.removed + p.modified,
      similarity: p.similarity,
    }))
    .filter((c) => c.diffCount > 0)
    .sort((a, b) => b.diffCount - a.diffCount || a.page - b.page)
    .slice(0, Math.max(1, topN));
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

/** Compute aggregate summary stats across all comparison categories. */
export function computeSummaryStats(
  mode: ComparisonMode,
  pageDiffs: PageDiff[],
  metadataDiff: MetadataDiff,
  structureDiff: StructureDiff
): SummaryStats {
  const compared = pageDiffs.filter((p) => p.bothExist);
  const textDifferences = compared.reduce(
    (sum, p) => sum + p.added + p.removed + p.modified,
    0
  );
  const overallSimilarity =
    compared.length > 0
      ? Math.round(compared.reduce((s, p) => s + p.similarity, 0) / compared.length)
      : 100;
  const structureDifferences =
    (structureDiff.pageCountDelta !== 0 ? 1 : 0) +
    (structureDiff.sizesDiffer ? 1 : 0) +
    (structureDiff.fontsDiffer ? 1 : 0) +
    (structureDiff.imageCountsDiffer ? 1 : 0);
  return {
    mode,
    pagesCompared: compared.length,
    textDifferences,
    metadataDifferences: metadataDiff.differences,
    structureDifferences,
    overallSimilarity,
    significantChanges: findSignificantChanges(pageDiffs, 5),
  };
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

/** Render a unified-diff style text report. */
export function renderTextDiff(
  pageDiffs: PageDiff[],
  metadataDiff: MetadataDiff,
  structureDiff: StructureDiff,
  pageCountDiff: PageCountDiff
): string {
  const lines: string[] = [];
  lines.push("=== PDF Comparison Report ===");
  lines.push("");
  lines.push("--- Page count ---");
  lines.push(
    `doc1: ${pageCountDiff.count1} page(s) → doc2: ${pageCountDiff.count2} page(s) (Δ ${pageCountDiff.delta >= 0 ? "+" : ""}${pageCountDiff.delta})`
  );
  if (pageCountDiff.added > 0) lines.push(`Pages added in doc2: ${pageCountDiff.added}`);
  if (pageCountDiff.removed > 0) lines.push(`Pages removed from doc1: ${pageCountDiff.removed}`);
  lines.push("");
  lines.push("--- Structure ---");
  lines.push(`Page sizes differ: ${structureDiff.sizesDiffer ? "yes" : "no"}`);
  if (structureDiff.sizesDiffer) {
    lines.push(`  doc1 sizes: ${structureDiff.pageSizes1.join(", ") || "(none)"}`);
    lines.push(`  doc2 sizes: ${structureDiff.pageSizes2.join(", ") || "(none)"}`);
  }
  lines.push(`Fonts differ: ${structureDiff.fontsDiffer ? "yes" : "no"}`);
  if (structureDiff.fontsDiffer) {
    lines.push(`  doc1 fonts: ${structureDiff.fonts1.join(", ") || "(none)"}`);
    lines.push(`  doc2 fonts: ${structureDiff.fonts2.join(", ") || "(none)"}`);
  }
  lines.push(`Image counts differ: ${structureDiff.imageCountsDiffer ? "yes" : "no"}`);
  lines.push("");
  lines.push("--- Metadata ---");
  if (metadataDiff.differences === 0) {
    lines.push("All metadata fields identical.");
  } else {
    lines.push(`${metadataDiff.differences} field(s) differ:`);
    for (const f of metadataDiff.fields) {
      if (!f.same) {
        lines.push(`  ${f.field}: "${f.value1 || "(empty)"}" → "${f.value2 || "(empty)"}"`);
      }
    }
  }
  lines.push("");
  lines.push("--- Per-page text diff ---");
  for (const p of pageDiffs) {
    lines.push("");
    lines.push(`@@ Page ${p.page} @@ (similarity ${p.similarity}%)`);
    if (!p.bothExist) {
      lines.push("(page missing from one document)");
      continue;
    }
    if (p.lines.length === 0) {
      lines.push("(no text differences)");
      continue;
    }
    for (const l of p.lines) {
      if (l.type === "added") lines.push(`+ ${l.content}`);
      else if (l.type === "removed") lines.push(`- ${l.content}`);
      else if (l.type === "modified") lines.push(`! ${l.oldContent} → ${l.content}`);
      else lines.push(`  ${l.content}`);
    }
  }
  return lines.join("\n");
}

/** Escape HTML special characters in text content. */
function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Render diffs as colored HTML (green for additions, red for removals, yellow for modifications). */
export function renderHtmlDiff(pageDiffs: PageDiff[]): string {
  const parts: string[] = [];
  for (const p of pageDiffs) {
    parts.push(
      `<div class="page-diff" data-page="${p.page}"><h4>Page ${p.page} — ${p.similarity}% similar</h4>`
    );
    if (!p.bothExist) {
      parts.push('<p class="missing">(page missing from one document)</p>');
      parts.push("</div>");
      continue;
    }
    if (p.lines.length === 0) {
      parts.push('<p class="same">(no text differences)</p>');
      parts.push("</div>");
      continue;
    }
    parts.push("<pre>");
    for (const l of p.lines) {
      const text = escapeHtml(l.content);
      const oldText = l.oldContent ? escapeHtml(l.oldContent) : "";
      if (l.type === "added") {
        parts.push(`<span class="add">+ ${text}</span>`);
      } else if (l.type === "removed") {
        parts.push(`<span class="del">- ${text}</span>`);
      } else if (l.type === "modified") {
        parts.push(`<span class="mod">! ${oldText} → ${text}</span>`);
      } else {
        parts.push(`<span class="ctx">  ${text}</span>`);
      }
      parts.push("\n");
    }
    parts.push("</pre></div>");
  }
  return parts.join("");
}

function escapeCsvCell(s: string): string {
  const str = s ?? "";
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/** Render diffs as CSV: page,line_num,type,content,old_content. */
export function renderCsvDiff(pageDiffs: PageDiff[]): string {
  const rows: string[] = ["page,line_num,type,content,old_content"];
  for (const p of pageDiffs) {
    if (!p.bothExist) {
      rows.push(`${p.page},,missing,,`);
      continue;
    }
    for (const l of p.lines) {
      rows.push(
        [
          String(p.page),
          String(l.lineNum),
          l.type,
          escapeCsvCell(l.content),
          escapeCsvCell(l.oldContent ?? ""),
        ].join(",")
      );
    }
  }
  return rows.join("\n");
}

/** Render the entire comparison as JSON. */
export function renderJsonDiff(result: ComparisonResult): string {
  return JSON.stringify(result, null, 2);
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-compare:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  fileName1: string;
  fileName2: string;
  mode: ComparisonMode;
  pagesCompared: number;
  overallSimilarity: number;
  textDifferences: number;
  metadataDifferences: number;
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
      // ignore quota errors
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

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

const VALID_MODES = new Set<ComparisonMode>(COMPARISON_MODES);

export function buildShareUrl(opts: CompareOptions): string {
  const params = new URLSearchParams();
  if (opts.comparisonMode !== "full") params.set("mode", opts.comparisonMode);
  if (!opts.ignoreWhitespace) params.set("ws", "0");
  if (opts.ignoreCase) params.set("case", "0");
  if (opts.pageRange && opts.pageRange !== "all") params.set("range", opts.pageRange);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<CompareOptions> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<CompareOptions> = {};
  const mode = params.get("mode");
  if (mode && VALID_MODES.has(mode as ComparisonMode)) out.comparisonMode = mode as ComparisonMode;
  const ws = params.get("ws");
  if (ws !== null) out.ignoreWhitespace = ws !== "0";
  const caseFlag = params.get("case");
  if (caseFlag !== null) out.ignoreCase = caseFlag === "0";
  const range = params.get("range");
  if (range) out.pageRange = range;
  return out;
}

// ---------------------------------------------------------------------------
// Convenience: validate a CompareOptions object
// ---------------------------------------------------------------------------

export function validateOptions(opts: CompareOptions): ToolResult<CompareOptions> {
  if (!opts) return { ok: false, error: "Missing options." };
  if (!VALID_MODES.has(opts.comparisonMode)) {
    return { ok: false, error: `Unknown comparison mode: ${opts.comparisonMode}` };
  }
  // Light page-range syntax check (only if not "all")
  const normalized = (opts.pageRange ?? "").trim().toLowerCase();
  if (normalized && normalized !== "all" && !/^[0-9,\-\s]+$/.test(normalized)) {
    return {
      ok: false,
      error: `Invalid page range "${opts.pageRange}". Use "all" or e.g. "1-3, 5".`,
    };
  }
  return { ok: true, output: { ...opts, pageRange: normalized || "all" } };
}
