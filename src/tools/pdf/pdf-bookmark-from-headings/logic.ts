/**
 * PDF Bookmark from Headings — pure logic.
 *
 * Pure functions only — no DOM, no pdf-lib. The actual PDF content-stream
 * parsing and outline writing lives in ui.tsx; this module handles heading
 * detection, tree building, dedupe, validation, multi-format rendering,
 * history (localStorage), and shareable URLs.
 */
import type { ToolResult } from "../../../lib/tool";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type DetectionMethod = "by-font-size" | "by-bold-text" | "by-text-pattern" | "manual";

export type HeadingLevel = 1 | 2 | 3;

export interface FontSizeThresholds {
  /** Text at or above this size is H1. */
  h1: number;
  /** Text at or above this size (and below h1) is H2. */
  h2: number;
  /** Text at or above this size (and below h2) is H3. */
  h3: number;
}

/** Raw text item extracted by ui.tsx from a PDF content stream. */
export interface TextItem {
  text: string;
  fontSize: number;
  isBold: boolean;
  /** 1-indexed page number. */
  pageNumber: number;
  /** X coordinate (PDF points, from left). */
  x: number;
  /** Y coordinate (PDF points, from bottom). */
  y: number;
}

export interface HeadingCandidate {
  text: string;
  level: HeadingLevel;
  pageNumber: number;
  fontSize: number;
  isBold: boolean;
  x: number;
  y: number;
}

export interface BookmarkNode {
  title: string;
  level: HeadingLevel;
  page: number;
  x: number;
  y: number;
  children: BookmarkNode[];
}

export interface SummaryStats {
  totalBookmarks: number;
  byLevel: Record<HeadingLevel, number>;
  byPage: Record<number, number>;
  maxDepth: number;
  orphanCount: number;
  duplicateCount: number;
}

export interface CompiledPattern {
  regex: RegExp;
  level: HeadingLevel;
}

export interface BookmarkOptions {
  detectionMethod: DetectionMethod;
  thresholds: FontSizeThresholds;
  /** Multi-line text-pattern spec (one rule per line). */
  textPatterns: string;
  includePageNumbers: boolean;
  maxHeadingLevel: HeadingLevel;
  /** Minimum font size for bold detection (only used by by-bold-text). */
  minBoldSize: number;
}

export interface HistoryEntry {
  ts: number;
  fileName: string;
  pageCount: number;
  bookmarkCount: number;
  detectionMethod: DetectionMethod;
}

export const DETECTION_METHODS: DetectionMethod[] = [
  "by-font-size",
  "by-bold-text",
  "by-text-pattern",
  "manual",
];

export const DETECTION_METHOD_LABELS: Record<DetectionMethod, string> = {
  "by-font-size": "By font size",
  "by-bold-text": "By bold text",
  "by-text-pattern": "By text pattern (regex)",
  "manual": "Manual (no auto-detect)",
};

export const DEFAULT_THRESHOLDS: FontSizeThresholds = {
  h1: 24,
  h2: 18,
  h3: 14,
};

export const DEFAULT_OPTIONS: BookmarkOptions = {
  detectionMethod: "by-font-size",
  thresholds: DEFAULT_THRESHOLDS,
  textPatterns: "",
  includePageNumbers: true,
  maxHeadingLevel: 3,
  minBoldSize: 14,
};

export const HEADING_LEVELS: HeadingLevel[] = [1, 2, 3];

export const HEADING_LEVEL_LABELS: Record<HeadingLevel, string> = {
  1: "H1 (top)",
  2: "H2 (section)",
  3: "H3 (subsection)",
};

// ---------------------------------------------------------------------------
// Text cleaning
// ---------------------------------------------------------------------------

export function normalizeText(s: string): string {
  return (s ?? "").replace(/\r\n/g, "\n");
}

/** Strip extra whitespace, normalize to single spaces, trim. */
export function cleanHeadingText(text: string): string {
  if (!text) return "";
  return text.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Font-size classifier
// ---------------------------------------------------------------------------

/** Classify a font size into H1/H2/H3 or null (below all thresholds). */
export function classifyFontSize(size: number, thresholds: FontSizeThresholds): HeadingLevel | null {
  if (!Number.isFinite(size) || size <= 0) return null;
  if (size >= thresholds.h1) return 1;
  if (size >= thresholds.h2) return 2;
  if (size >= thresholds.h3) return 3;
  return null;
}

// ---------------------------------------------------------------------------
// Bold text detector
// ---------------------------------------------------------------------------

export function isBoldText(item: TextItem): boolean {
  return !!item.isBold;
}

// ---------------------------------------------------------------------------
// Regex pattern matcher
// ---------------------------------------------------------------------------

/**
 * Parse a multi-line pattern spec. Each non-empty line can be either:
 *   - "H1: regex" / "H2: regex" / "H3: regex" / "1: regex" / "2: ..." / "3: ..."
 *   - bare regex (defaults to H1)
 *
 * Invalid regexes produce an error result.
 */
export function parseTextPatterns(input: string): ToolResult<CompiledPattern[]> {
  const lines = normalizeText(input)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const out: CompiledPattern[] = [];
  for (const line of lines) {
    let level: HeadingLevel = 1;
    let patternStr = line;
    const m = /^(H?[123])\s*[:\s]\s*(.+)$/i.exec(line);
    if (m) {
      const lvlStr = m[1].toUpperCase().replace("H", "");
      const n = Number(lvlStr);
      if (n === 1 || n === 2 || n === 3) {
        level = n as HeadingLevel;
        patternStr = m[2];
      }
    }
    let regex: RegExp;
    try {
      regex = new RegExp(patternStr);
    } catch {
      return { ok: false, error: `Invalid regex: "${patternStr}"` };
    }
    out.push({ regex, level });
  }
  return { ok: true, output: out };
}

/** Test a text against a list of compiled patterns; return first matching level or null. */
export function matchRegexPatterns(text: string, patterns: CompiledPattern[]): HeadingLevel | null {
  for (const p of patterns) {
    if (p.regex.test(text)) return p.level;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Heading detection
// ---------------------------------------------------------------------------

export function detectHeadings(
  items: TextItem[],
  method: DetectionMethod,
  options: { thresholds?: FontSizeThresholds; patterns?: CompiledPattern[]; minBoldSize?: number },
): HeadingCandidate[] {
  const out: HeadingCandidate[] = [];
  const thresholds = options.thresholds ?? DEFAULT_THRESHOLDS;
  const minBoldSize = options.minBoldSize ?? 14;
  for (const item of items) {
    const text = cleanHeadingText(item.text);
    if (!text) continue;
    let level: HeadingLevel | null = null;
    if (method === "by-font-size") {
      level = classifyFontSize(item.fontSize, thresholds);
    } else if (method === "by-bold-text") {
      if (item.isBold && item.fontSize >= minBoldSize) {
        level = classifyFontSize(item.fontSize, thresholds) ?? 2;
      }
    } else if (method === "by-text-pattern") {
      level = matchRegexPatterns(text, options.patterns ?? []);
    } else {
      // manual: no auto-detection
      continue;
    }
    if (level !== null) {
      out.push({
        text,
        level,
        pageNumber: item.pageNumber,
        fontSize: item.fontSize,
        isBold: item.isBold,
        x: item.x,
        y: item.y,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Bookmark tree builder
// ---------------------------------------------------------------------------

/**
 * Build a hierarchical bookmark tree from a flat list of headings.
 * Headings above maxLevel are dropped. The tree is constructed by maintaining
 * a stack of open ancestors; a new node becomes a child of the deepest open
 * ancestor whose level is strictly less than the new node's level.
 */
export function buildBookmarkTree(headings: HeadingCandidate[], maxLevel: HeadingLevel): BookmarkNode[] {
  const filtered = headings.filter((h) => h.level <= maxLevel);
  const root: BookmarkNode[] = [];
  const stack: BookmarkNode[] = [];
  for (const h of filtered) {
    const node: BookmarkNode = {
      title: h.text,
      level: h.level,
      page: h.pageNumber,
      x: h.x,
      y: h.y,
      children: [],
    };
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      root.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }
  return root;
}

export function formatBookmarkTitle(heading: HeadingCandidate): string {
  return cleanHeadingText(heading.text);
}

export function validateBookmarkLevel(level: number, maxLevel: HeadingLevel): ToolResult<HeadingLevel> {
  if (level !== 1 && level !== 2 && level !== 3) {
    return { ok: false, error: `Invalid heading level: ${level}. Must be 1, 2, or 3.` };
  }
  if (level > maxLevel) {
    return { ok: false, error: `Heading level ${level} exceeds max level ${maxLevel}.` };
  }
  return { ok: true, output: level as HeadingLevel };
}

export function extractHeadingCoordinate(item: TextItem): { x: number; y: number } {
  return { x: item.x, y: item.y };
}

// ---------------------------------------------------------------------------
// Orphan & duplicate detection
// ---------------------------------------------------------------------------

export interface OrphanHeading {
  node: BookmarkNode;
  reason: string;
}

/** Detect headings that appear without an ancestor at the immediately-preceding level. */
export function detectOrphanHeadings(tree: BookmarkNode[]): OrphanHeading[] {
  const orphans: OrphanHeading[] = [];
  function walk(node: BookmarkNode, parentLevel: 0 | HeadingLevel) {
    if (node.level > parentLevel + 1) {
      orphans.push({
        node,
        reason: `H${node.level} appears without a parent H${node.level - 1}`,
      });
    }
    for (const c of node.children) walk(c, node.level);
  }
  for (const root of tree) walk(root, 0);
  return orphans;
}

export interface DedupeResult {
  tree: BookmarkNode[];
  removed: number;
}

/** Remove bookmarks that share the same level+page+title (case-insensitive). */
export function removeDuplicateBookmarks(tree: BookmarkNode[]): DedupeResult {
  const seen = new Set<string>();
  let removed = 0;
  function dedupe(node: BookmarkNode): BookmarkNode | null {
    const key = `${node.level}|${node.page}|${node.title.toLowerCase()}`;
    if (seen.has(key)) {
      removed++;
      return null;
    }
    seen.add(key);
    const newChildren: BookmarkNode[] = [];
    for (const c of node.children) {
      const nc = dedupe(c);
      if (nc) newChildren.push(nc);
    }
    return { ...node, children: newChildren };
  }
  const out: BookmarkNode[] = [];
  for (const root of tree) {
    const n = dedupe(root);
    if (n) out.push(n);
  }
  return { tree: out, removed };
}

// ---------------------------------------------------------------------------
// Distribution & summary
// ---------------------------------------------------------------------------

export function analyzeHeadingDistribution(headings: HeadingCandidate[]): Record<number, number> {
  const byPage: Record<number, number> = {};
  for (const h of headings) {
    byPage[h.pageNumber] = (byPage[h.pageNumber] ?? 0) + 1;
  }
  return byPage;
}

export function computeSummaryStats(tree: BookmarkNode[], duplicateCount = 0): SummaryStats {
  let total = 0;
  const byLevel: Record<HeadingLevel, number> = { 1: 0, 2: 0, 3: 0 };
  const byPage: Record<number, number> = {};
  let maxDepth = 0;
  function walk(node: BookmarkNode, depth: number) {
    total++;
    byLevel[node.level]++;
    byPage[node.page] = (byPage[node.page] ?? 0) + 1;
    if (depth > maxDepth) maxDepth = depth;
    for (const c of node.children) walk(c, depth + 1);
  }
  for (const root of tree) walk(root, 1);
  const orphans = detectOrphanHeadings(tree);
  return {
    totalBookmarks: total,
    byLevel,
    byPage,
    maxDepth,
    orphanCount: orphans.length,
    duplicateCount,
  };
}

// ---------------------------------------------------------------------------
// Destination validation
// ---------------------------------------------------------------------------

export function validateBookmarkDestinations(
  tree: BookmarkNode[],
  pageCount: number,
): ToolResult<BookmarkNode[]> {
  function check(node: BookmarkNode): boolean {
    if (node.page < 1 || node.page > pageCount) return false;
    return node.children.every(check);
  }
  for (const root of tree) {
    if (!check(root)) {
      return {
        ok: false,
        error: `Bookmark "${root.title}" points to page ${root.page}, which is outside the PDF (1–${pageCount}).`,
      };
    }
  }
  return { ok: true, output: tree };
}

// ---------------------------------------------------------------------------
// Flatten tree (for CSV)
// ---------------------------------------------------------------------------

export interface FlatBookmark {
  title: string;
  level: HeadingLevel;
  page: number;
  parent: string | null;
}

export function flattenTree(tree: BookmarkNode[]): FlatBookmark[] {
  const out: FlatBookmark[] = [];
  function walk(node: BookmarkNode, parent: string | null) {
    out.push({ title: node.title, level: node.level, page: node.page, parent });
    for (const c of node.children) walk(c, node.title);
  }
  for (const root of tree) walk(root, null);
  return out;
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render a tree as an ASCII tree (lines starting with # / ## / ###). */
export function renderTextTree(tree: BookmarkNode[], includePageNumbers = true): string {
  const lines: string[] = [];
  function walk(node: BookmarkNode, indent: string) {
    const bullet = node.level === 1 ? "#" : node.level === 2 ? "##" : "###";
    const suffix = includePageNumbers ? `  (p.${node.page})` : "";
    lines.push(`${indent}${bullet} ${node.title}${suffix}`);
    for (const c of node.children) walk(c, indent + "  ");
  }
  for (const root of tree) walk(root, "");
  return lines.join("\n");
}

export function renderCsvTree(tree: BookmarkNode[]): string {
  const flat = flattenTree(tree);
  const lines = ["level,title,page,parent"];
  for (const f of flat) {
    lines.push([`H${f.level}`, escapeCsv(f.title), f.page, escapeCsv(f.parent ?? "")].join(","));
  }
  return lines.join("\n");
}

export function renderJsonTree(tree: BookmarkNode[]): string {
  return JSON.stringify(tree, null, 2);
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-bookmark-from-headings:history";
const HISTORY_MAX = 20;

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

const VALID_METHODS = new Set<DetectionMethod>(DETECTION_METHODS);

export function buildShareUrl(opts: BookmarkOptions): string {
  const params = new URLSearchParams();
  if (opts.detectionMethod !== DEFAULT_OPTIONS.detectionMethod) params.set("method", opts.detectionMethod);
  if (opts.thresholds.h1 !== DEFAULT_THRESHOLDS.h1) params.set("h1", String(opts.thresholds.h1));
  if (opts.thresholds.h2 !== DEFAULT_THRESHOLDS.h2) params.set("h2", String(opts.thresholds.h2));
  if (opts.thresholds.h3 !== DEFAULT_THRESHOLDS.h3) params.set("h3", String(opts.thresholds.h3));
  if (opts.textPatterns) params.set("pat", opts.textPatterns);
  if (!opts.includePageNumbers) params.set("pn", "0");
  if (opts.maxHeadingLevel !== 3) params.set("ml", String(opts.maxHeadingLevel));
  if (opts.minBoldSize !== DEFAULT_OPTIONS.minBoldSize) params.set("mbs", String(opts.minBoldSize));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<BookmarkOptions> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<BookmarkOptions> = {};
  const method = params.get("method");
  if (method && VALID_METHODS.has(method as DetectionMethod)) out.detectionMethod = method as DetectionMethod;
  const h1 = params.get("h1");
  const h2 = params.get("h2");
  const h3 = params.get("h3");
  const thresholds: Partial<FontSizeThresholds> = {};
  if (h1 !== null) {
    const n = Number(h1);
    if (Number.isFinite(n) && n > 0) thresholds.h1 = n;
  }
  if (h2 !== null) {
    const n = Number(h2);
    if (Number.isFinite(n) && n > 0) thresholds.h2 = n;
  }
  if (h3 !== null) {
    const n = Number(h3);
    if (Number.isFinite(n) && n > 0) thresholds.h3 = n;
  }
  if (Object.keys(thresholds).length > 0) out.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const pat = params.get("pat");
  if (pat !== null) out.textPatterns = pat;
  const pn = params.get("pn");
  if (pn === "0") out.includePageNumbers = false;
  const ml = params.get("ml");
  if (ml !== null) {
    const n = Number(ml);
    if (n === 1 || n === 2 || n === 3) out.maxHeadingLevel = n as HeadingLevel;
  }
  const mbs = params.get("mbs");
  if (mbs !== null) {
    const n = Number(mbs);
    if (Number.isFinite(n) && n > 0) out.minBoldSize = n;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateOptions(opts: BookmarkOptions): ToolResult<BookmarkOptions> {
  if (!opts) return { ok: false, error: "Missing options." };
  if (!VALID_METHODS.has(opts.detectionMethod)) {
    return { ok: false, error: `Unknown detection method: ${opts.detectionMethod}` };
  }
  if (opts.thresholds.h1 <= 0 || opts.thresholds.h2 <= 0 || opts.thresholds.h3 <= 0) {
    return { ok: false, error: "Font size thresholds must be positive." };
  }
  if (opts.thresholds.h1 < opts.thresholds.h2 || opts.thresholds.h2 < opts.thresholds.h3) {
    return { ok: false, error: "Thresholds must satisfy H1 ≥ H2 ≥ H3." };
  }
  if (opts.maxHeadingLevel !== 1 && opts.maxHeadingLevel !== 2 && opts.maxHeadingLevel !== 3) {
    return { ok: false, error: "Max heading level must be 1, 2, or 3." };
  }
  if (opts.minBoldSize < 0) {
    return { ok: false, error: "Minimum bold size cannot be negative." };
  }
  if (opts.detectionMethod === "by-text-pattern" && opts.textPatterns.trim()) {
    const r = parseTextPatterns(opts.textPatterns);
    if (!r.ok) return r;
  }
  return { ok: true, output: opts };
}
