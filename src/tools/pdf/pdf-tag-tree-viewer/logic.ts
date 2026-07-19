/**
 * PDF Tag Tree Viewer — pure logic.
 *
 * Pure functions only — no DOM, no pdf-lib. The actual PDF /StructTreeRoot
 * traversal lives in ui.tsx; this module handles tag-type detection,
 * attribute extraction, tree/flat/by-page/by-type formatting, heading
 * hierarchy validation, multi-format rendering, history (localStorage),
 * and shareable URLs.
 */
import type { ToolResult } from "../../../lib/tool";

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

export type ViewMode = "tree" | "flat-list" | "by-page" | "by-type";

export const VIEW_MODES: ViewMode[] = ["tree", "flat-list", "by-page", "by-type"];

export const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  "tree": "Tree (hierarchical)",
  "flat-list": "Flat list",
  "by-page": "By page",
  "by-type": "By type",
};

/** Tag types — 14 PDF standard structure types plus a catch-all 'Other'. */
export type TagType =
  | "Document"
  | "Part"
  | "Section"
  | "Div"
  | "H1"
  | "H2"
  | "H3"
  | "H4"
  | "H5"
  | "H6"
  | "P"
  | "L"
  | "LI"
  | "Table"
  | "TR"
  | "TH"
  | "TD"
  | "Figure"
  | "Caption"
  | "Link"
  | "Quote"
  | "Bibliography"
  | "Code"
  | "Span"
  | "Form"
  | "Other";

export const KNOWN_TAG_TYPES: TagType[] = [
  "Document", "Part", "Section", "Div",
  "H1", "H2", "H3", "H4", "H5", "H6",
  "P", "L", "LI",
  "Table", "TR", "TH", "TD",
  "Figure", "Caption", "Link", "Quote", "Bibliography", "Code", "Span", "Form",
];

export const TAG_TYPE_DESCRIPTIONS: Record<TagType, string> = {
  Document: "Document root element",
  Part: "Large-scale division (part)",
  Section: "Section",
  Div: "Generic block-level division",
  H1: "Heading level 1",
  H2: "Heading level 2",
  H3: "Heading level 3",
  H4: "Heading level 4",
  H5: "Heading level 5",
  H6: "Heading level 6",
  P: "Paragraph",
  L: "List",
  LI: "List item",
  Table: "Table",
  TR: "Table row",
  TH: "Table header cell",
  TD: "Table data cell",
  Figure: "Figure (image)",
  Caption: "Caption",
  Link: "Hyperlink",
  Quote: "Inline quotation",
  Bibliography: "Bibliography entry",
  Code: "Inline or block code",
  Span: "Generic inline span",
  Form: "Form field",
  Other: "Unknown / custom structure type",
};

export type TagTypeFilter = "all" | TagType;

export const TAG_TYPE_FILTERS: TagTypeFilter[] = ["all", ...KNOWN_TAG_TYPES];

export interface TagAttribute {
  key: string;
  value: string;
}

export interface TagNode {
  /** 0-based index in the global tag list (assigned by walk order). */
  id: number;
  /** Structure type (S entry, e.g. /Document, /H1, /Figure). */
  type: TagType;
  /** Raw structure type name (without leading slash). */
  rawType: string;
  /** Attributes extracted from the structure element. */
  attributes: TagAttribute[];
  /** Page numbers (1-based) where this tag's content appears. */
  pages: number[];
  /** 0-based depth in the tree (root = 0). */
  depth: number;
  /** Path of tag types from root to here, e.g. "Document > Section > H1". */
  path: string;
  /** Children (in document order). */
  children: TagNode[];
}

export interface ParsedTree {
  hasStructureTree: boolean;
  root: TagNode | null;
  /** All tags in document order (flattened). */
  all: TagNode[];
  /** Total number of tags (including root). */
  totalTags: number;
  /** Maximum nesting depth. */
  maxDepth: number;
  /** Tags grouped by type. */
  byType: Record<string, TagNode[]>;
  /** Tags grouped by page (each tag may appear on multiple pages). */
  byPage: Record<number, TagNode[]>;
  /** Tag counts per type. */
  countsByType: Record<string, number>;
  /** Number of pages referenced by the structure tree. */
  pageCount: number;
}

export interface TagOptions {
  viewMode: ViewMode;
  tagTypeFilter: TagTypeFilter;
  includeAttributes: boolean;
  expandDepth: number;
}

export const DEFAULT_OPTIONS: TagOptions = {
  viewMode: "tree",
  tagTypeFilter: "all",
  includeAttributes: true,
  expandDepth: 3,
};

export const MIN_EXPAND_DEPTH = 0;
export const MAX_EXPAND_DEPTH = 10;

// ---------------------------------------------------------------------------
// Validation result types
// ---------------------------------------------------------------------------

export type ValidationSeverity = "error" | "warning" | "info";

export interface ValidationIssue {
  severity: ValidationSeverity;
  criterion: string;
  message: string;
  /** Tag id(s) involved (for highlighting in UI). */
  tagIds: number[];
}

// ---------------------------------------------------------------------------
// Page-range normalization (used by share URL)
// ---------------------------------------------------------------------------

// (No page range in this tool — the tree covers the whole document.)

// ---------------------------------------------------------------------------
// Tag-type detector
// ---------------------------------------------------------------------------

/** Classify a raw structure type name into one of the known TagTypes. */
export function parseTagType(raw: string): TagType {
  if (!raw) return "Other";
  const cleaned = raw.startsWith("/") ? raw.slice(1) : raw;
  if (KNOWN_TAG_TYPES.includes(cleaned as TagType)) return cleaned as TagType;
  return "Other";
}

// ---------------------------------------------------------------------------
// Tag attribute extractor
// ---------------------------------------------------------------------------

/**
 * Extract a known set of attributes from a structure-element dictionary.
 * The dictionary is passed in as a plain JS object of key → string value
 * (the ui.tsx layer handles the pdf-lib dict → plain-object conversion so
 * the logic stays pure).
 */
export function extractTagAttributes(dict: Record<string, string>): TagAttribute[] {
  const KNOWN = ["S", "Alt", "ActualText", "Lang", "BBox", "Title", "ID", "Role", "A", "C", "K", "T", "P", "Pg"];
  const out: TagAttribute[] = [];
  for (const key of Object.keys(dict)) {
    if (!KNOWN.includes(key) && !key.startsWith("/")) continue;
    const value = dict[key];
    if (value === undefined || value === null || value === "") continue;
    out.push({ key: key.startsWith("/") ? key.slice(1) : key, value });
  }
  // Sort for deterministic output.
  out.sort((a, b) => a.key.localeCompare(b.key));
  return out;
}

// ---------------------------------------------------------------------------
// Tag-tree walker (operates on a plain-JS tree produced by ui.tsx)
// ---------------------------------------------------------------------------

/**
 * Raw tree node as produced by the ui.tsx pdf-lib walker.
 * The ui.tsx layer converts each PDFObject structure-element dict to this
 * plain shape so the logic layer can stay pure.
 */
export interface RawTagNode {
  rawType: string;
  attributes: Record<string, string>;
  pages: number[];
  children: RawTagNode[];
}

let _idCounter = 0;
function resetIdCounter(): void {
  _idCounter = 0;
}

function nextId(): number {
  const id = _idCounter;
  _idCounter += 1;
  return id;
}

function buildTagNode(raw: RawTagNode, depth: number, pathParts: string[]): TagNode {
  const id = nextId();
  const type = parseTagType(raw.rawType);
  const newPath = [...pathParts, type];
  const path = newPath.join(" > ");
  const attributes = extractTagAttributes(raw.attributes);
  const children = raw.children.map((c) => buildTagNode(c, depth + 1, newPath));
  return {
    id,
    type,
    rawType: raw.rawType.startsWith("/") ? raw.rawType.slice(1) : raw.rawType,
    attributes,
    pages: raw.pages,
    depth,
    path,
    children,
  };
}

/** Flatten a TagNode tree into a depth-first list. */
export function flattenTree(root: TagNode | null): TagNode[] {
  if (!root) return [];
  const out: TagNode[] = [];
  const walk = (n: TagNode) => {
    out.push(n);
    for (const c of n.children) walk(c);
  };
  walk(root);
  return out;
}

/** Build the full ParsedTree from the raw tree (or null). */
export function buildParsedTree(rawRoot: RawTagNode | null): ParsedTree {
  resetIdCounter();
  if (!rawRoot) {
    return {
      hasStructureTree: false,
      root: null,
      all: [],
      totalTags: 0,
      maxDepth: 0,
      byType: {},
      byPage: {},
      countsByType: {},
      pageCount: 0,
    };
  }
  const root = buildTagNode(rawRoot, 0, []);
  const all = flattenTree(root);
  const byType: Record<string, TagNode[]> = {};
  const byPage: Record<number, TagNode[]> = {};
  const countsByType: Record<string, number> = {};
  let maxDepth = 0;
  const pageSet = new Set<number>();
  for (const tag of all) {
    if (!byType[tag.type]) byType[tag.type] = [];
    byType[tag.type].push(tag);
    countsByType[tag.type] = (countsByType[tag.type] ?? 0) + 1;
    for (const p of tag.pages) {
      pageSet.add(p);
      if (!byPage[p]) byPage[p] = [];
      byPage[p].push(tag);
    }
    if (tag.depth > maxDepth) maxDepth = tag.depth;
  }
  return {
    hasStructureTree: true,
    root,
    all,
    totalTags: all.length,
    maxDepth,
    byType,
    byPage,
    countsByType,
    pageCount: pageSet.size,
  };
}

// ---------------------------------------------------------------------------
// Tree depth / counter helpers
// ---------------------------------------------------------------------------

export function calculateMaxDepth(root: TagNode | null): number {
  if (!root) return 0;
  let max = 0;
  const walk = (n: TagNode, d: number) => {
    if (d > max) max = d;
    for (const c of n.children) walk(c, d + 1);
  };
  walk(root, 0);
  return max;
}

export function countTagsByType(all: TagNode[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of all) {
    out[t.type] = (out[t.type] ?? 0) + 1;
  }
  return out;
}

export function countTagsByPage(all: TagNode[]): Record<number, number> {
  const out: Record<number, number> = {};
  for (const t of all) {
    for (const p of t.pages) {
      out[p] = (out[p] ?? 0) + 1;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

export function filterByType(all: TagNode[], filter: TagTypeFilter): TagNode[] {
  if (filter === "all") return all;
  return all.filter((t) => t.type === filter);
}

// ---------------------------------------------------------------------------
// Tag validator — checks proper nesting & required attributes
// ---------------------------------------------------------------------------

export function validateTags(parsed: ParsedTree): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!parsed.hasStructureTree || !parsed.root) {
    issues.push({
      severity: "error",
      criterion: "PDF/UA-1 §5 / WCAG 2.1 SC 1.3.1",
      message: "Document has no structure tree (untagged PDF). Tag the document before accessibility checks.",
      tagIds: [],
    });
    return issues;
  }
  if (parsed.root.type !== "Document") {
    issues.push({
      severity: "warning",
      criterion: "PDF/UA-1 §7.2",
      message: `Structure tree root is of type '${parsed.root.type}' (expected 'Document').`,
      tagIds: [parsed.root.id],
    });
  }
  // Table cells must live inside Table/TR.
  for (const t of parsed.all) {
    if (t.type === "TD" || t.type === "TH") {
      const parent = findParent(parsed.root, t.id);
      if (!parent || parent.type !== "TR") {
        issues.push({
          severity: "warning",
          criterion: "PDF/UA-1 §7.7",
          message: `${t.type} tag (id ${t.id}) is not nested inside a TR.`,
          tagIds: [t.id],
        });
      }
    }
    if (t.type === "TR") {
      const parent = findParent(parsed.root, t.id);
      if (!parent || parent.type !== "Table") {
        issues.push({
          severity: "warning",
          criterion: "PDF/UA-1 §7.7",
          message: `TR tag (id ${t.id}) is not nested inside a Table.`,
          tagIds: [t.id],
        });
      }
    }
    // Figures should have Alt.
    if (t.type === "Figure") {
      const hasAlt = t.attributes.some((a) => a.key === "Alt");
      if (!hasAlt) {
        issues.push({
          severity: "error",
          criterion: "WCAG 2.1 SC 1.1.1 / PDF/UA-1 §7.1",
          message: `Figure tag (id ${t.id}) has no Alt attribute.`,
          tagIds: [t.id],
        });
      }
    }
    // Links should have an action / destination (heuristic — check for Alt or Title).
    if (t.type === "Link") {
      const hasText = t.attributes.some((a) => a.key === "Alt" || a.key === "Title" || a.key === "ActualText");
      if (!hasText && t.children.length === 0) {
        issues.push({
          severity: "warning",
          criterion: "WCAG 2.1 SC 2.4.4",
          message: `Link tag (id ${t.id}) has no text content.`,
          tagIds: [t.id],
        });
      }
    }
  }
  return issues;
}

function findParent(root: TagNode, id: number): TagNode | null {
  const walk = (n: TagNode): TagNode | null => {
    for (const c of n.children) {
      if (c.id === id) return n;
      const found = walk(c);
      if (found) return found;
    }
    return null;
  };
  return walk(root);
}

// ---------------------------------------------------------------------------
// Heading hierarchy checker
// ---------------------------------------------------------------------------

export function checkHeadingHierarchy(parsed: ParsedTree): ValidationIssue[] {
  if (!parsed.hasStructureTree) return [];
  const headings = parsed.all.filter((t) => /^H[1-6]$/.test(t.type));
  const issues: ValidationIssue[] = [];
  let prevLevel = 0;
  for (const h of headings) {
    const level = Number(h.type.slice(1));
    if (prevLevel > 0 && level > prevLevel + 1) {
      issues.push({
        severity: "warning",
        criterion: "PDF/UA-1 §7.4",
        message: `Heading hierarchy jump: ${"H" + prevLevel} → ${h.type} (id ${h.id}). Consider inserting an intermediate heading.`,
        tagIds: [h.id],
      });
    }
    prevLevel = level;
  }
  // No H1 at all → warning.
  if (!headings.some((h) => h.type === "H1")) {
    issues.push({
      severity: "info",
      criterion: "Best practice",
      message: "No H1 heading found in the document. Consider adding a top-level heading.",
      tagIds: [],
    });
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Missing-structure detector
// ---------------------------------------------------------------------------

export function detectMissingStructure(parsed: ParsedTree): ValidationIssue | null {
  if (!parsed.hasStructureTree) {
    return {
      severity: "error",
      criterion: "PDF/UA-1 §5 / WCAG 2.1 SC 1.3.1",
      message: "This PDF is not tagged — it has no /StructTreeRoot. Run an accessibility checker or tag the document in your authoring tool.",
      tagIds: [],
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Reading-order verifier
// ---------------------------------------------------------------------------

/**
 * Verify that page references in the structure tree appear in monotonic order.
 * (If page numbers go backward, the reading order may be wrong.)
 */
export function verifyReadingOrder(parsed: ParsedTree): ValidationIssue[] {
  if (!parsed.hasStructureTree) return [];
  const issues: ValidationIssue[] = [];
  let prevPage = 0;
  for (const t of parsed.all) {
    if (t.pages.length === 0) continue;
    const firstPage = Math.min(...t.pages);
    if (firstPage < prevPage) {
      issues.push({
        severity: "warning",
        criterion: "WCAG 2.1 SC 1.3.2",
        message: `Tag (id ${t.id}, type ${t.type}) on page ${firstPage} appears after a tag on page ${prevPage} — reading order may be inconsistent.`,
        tagIds: [t.id],
      });
    }
    if (firstPage > prevPage) prevPage = firstPage;
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Summary stats
// ---------------------------------------------------------------------------

export interface SummaryStats {
  totalTags: number;
  uniqueTypes: number;
  maxDepth: number;
  pageCount: number;
  topLevelType: string;
  hasStructureTree: boolean;
  headingCount: number;
  figureCount: number;
  tableCount: number;
  listCount: number;
  linkCount: number;
}

export function computeSummaryStats(parsed: ParsedTree): SummaryStats {
  const sum = (...keys: string[]) => keys.reduce((n, k) => n + (parsed.byType[k]?.length ?? 0), 0);
  return {
    totalTags: parsed.totalTags,
    uniqueTypes: Object.keys(parsed.countsByType).length,
    maxDepth: parsed.maxDepth,
    pageCount: parsed.pageCount,
    topLevelType: parsed.root ? parsed.root.type : "—",
    hasStructureTree: parsed.hasStructureTree,
    headingCount: sum("H1", "H2", "H3", "H4", "H5", "H6"),
    figureCount: parsed.byType["Figure"]?.length ?? 0,
    tableCount: parsed.byType["Table"]?.length ?? 0,
    listCount: parsed.byType["L"]?.length ?? 0,
    linkCount: parsed.byType["Link"]?.length ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Multi-format renderers
// ---------------------------------------------------------------------------

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function attrString(tag: TagNode): string {
  return tag.attributes.map((a) => `${a.key}=${a.value}`).join(" ");
}

/** Render the tree as ASCII text with indentation. */
export function renderTextTree(parsed: ParsedTree, opts: TagOptions): string {
  if (!parsed.hasStructureTree) {
    return "PDF Tag Tree Report\n===================\n\nThis PDF has no structure tree (untagged PDF).\n";
  }
  const lines: string[] = [];
  lines.push("PDF Tag Tree Report");
  lines.push("===================");
  lines.push("");
  const summary = computeSummaryStats(parsed);
  lines.push(`Total tags: ${summary.totalTags}`);
  lines.push(`Max depth: ${summary.maxDepth}`);
  lines.push(`Unique types: ${summary.uniqueTypes}`);
  lines.push(`Pages referenced: ${summary.pageCount}`);
  lines.push("");
  if (opts.viewMode === "tree") {
    lines.push("Tree view");
    lines.push("---------");
    const walk = (n: TagNode) => {
      const indent = "  ".repeat(n.depth);
      const attrs = opts.includeAttributes && n.attributes.length > 0 ? ` [${attrString(n)}]` : "";
      const pages = n.pages.length > 0 ? ` (pages: ${n.pages.join(",")})` : "";
      lines.push(`${indent}- ${n.type} (id ${n.id})${attrs}${pages}`);
      if (n.depth <= opts.expandDepth || opts.expandDepth >= MAX_EXPAND_DEPTH) {
        for (const c of n.children) walk(c);
      } else if (n.children.length > 0) {
        const childIndent = "  ".repeat(n.depth + 1);
        lines.push(`${childIndent}… ${n.children.length} child(ren) hidden (depth > ${opts.expandDepth})`);
      }
    };
    if (parsed.root) walk(parsed.root);
  } else if (opts.viewMode === "flat-list") {
    lines.push("Flat list view");
    lines.push("--------------");
    const filtered = filterByType(parsed.all, opts.tagTypeFilter);
    for (const t of filtered) {
      const attrs = opts.includeAttributes && t.attributes.length > 0 ? ` [${attrString(t)}]` : "";
      const pages = t.pages.length > 0 ? ` (pages: ${t.pages.join(",")})` : "";
      lines.push(`id ${t.id} • ${t.type}${attrs}${pages} • path: ${t.path}`);
    }
  } else if (opts.viewMode === "by-page") {
    lines.push("By-page view");
    lines.push("-----------");
    const pages = Object.keys(parsed.byPage).map(Number).sort((a, b) => a - b);
    for (const p of pages) {
      const tags = filterByType(parsed.byPage[p], opts.tagTypeFilter);
      lines.push(`Page ${p} (${tags.length} tag${tags.length === 1 ? "" : "s"}):`);
      for (const t of tags) {
        const attrs = opts.includeAttributes && t.attributes.length > 0 ? ` [${attrString(t)}]` : "";
        lines.push(`  - ${t.type} (id ${t.id})${attrs}`);
      }
    }
  } else if (opts.viewMode === "by-type") {
    lines.push("By-type view");
    lines.push("-----------");
    const types = Object.keys(parsed.byType).sort();
    for (const type of types) {
      const tags = type === opts.tagTypeFilter || opts.tagTypeFilter === "all"
        ? parsed.byType[type]
        : [];
      lines.push(`${type} (${tags.length}):`);
      for (const t of tags) {
        const attrs = opts.includeAttributes && t.attributes.length > 0 ? ` [${attrString(t)}]` : "";
        const pages = t.pages.length > 0 ? ` (pages: ${t.pages.join(",")})` : "";
        lines.push(`  - id ${t.id}${attrs}${pages}`);
      }
    }
  }
  lines.push("");
  lines.push("Tag counts by type");
  lines.push("------------------");
  for (const [type, count] of Object.entries(parsed.countsByType).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${type}: ${count}`);
  }
  return lines.join("\n");
}

/** Render an HTML tree with collapsible <details> elements. */
export function renderHtmlTree(parsed: ParsedTree, opts: TagOptions): string {
  if (!parsed.hasStructureTree) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>PDF Tag Tree</title></head><body><p>This PDF has no structure tree (untagged PDF).</p></body></html>`;
  }
  const summary = computeSummaryStats(parsed);
  const renderNode = (n: TagNode): string => {
    const attrs = opts.includeAttributes && n.attributes.length > 0
      ? ` <em>${escapeHtml(n.attributes.map((a) => `${a.key}=${a.value}`).join(", "))}</em>`
      : "";
    const pages = n.pages.length > 0 ? ` <small>(pages: ${escapeHtml(n.pages.join(","))})</small>` : "";
    if (n.children.length > 0) {
      const open = n.depth < opts.expandDepth ? " open" : "";
      return `<details${open}><summary><strong>${escapeHtml(n.type)}</strong> <small>(id ${n.id})</small>${attrs}${pages}</summary>${n.children.map(renderNode).join("")}</details>`;
    }
    return `<div><strong>${escapeHtml(n.type)}</strong> <small>(id ${n.id})</small>${attrs}${pages}</div>`;
  };
  const rootHtml = parsed.root ? renderNode(parsed.root) : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>PDF Tag Tree</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; margin: 24px; color: #111; }
  details { margin-left: 16px; }
  summary { cursor: pointer; }
  small { color: #666; }
  em { color: #2563eb; }
  .summary { background: #f3f4f6; padding: 10px; border-radius: 6px; font-size: 12px; margin-bottom: 16px; }
</style>
</head>
<body>
<h1>PDF Tag Tree</h1>
<div class="summary">
  Total tags: ${summary.totalTags} • Max depth: ${summary.maxDepth} • Pages: ${summary.pageCount} • Unique types: ${summary.uniqueTypes}
</div>
${rootHtml}
</body>
</html>`;
}

export function renderJsonTree(parsed: ParsedTree, opts: TagOptions): string {
  const summary = computeSummaryStats(parsed);
  const filtered = filterByType(parsed.all, opts.tagTypeFilter);
  const serializeNode = (n: TagNode): unknown => ({
    id: n.id,
    type: n.type,
    rawType: n.rawType,
    attributes: opts.includeAttributes ? n.attributes : undefined,
    pages: n.pages,
    depth: n.depth,
    path: n.path,
    children: n.children.map(serializeNode),
  });
  return JSON.stringify(
    {
      summary: {
        totalTags: summary.totalTags,
        maxDepth: summary.maxDepth,
        pageCount: summary.pageCount,
        uniqueTypes: summary.uniqueTypes,
        topLevelType: summary.topLevelType,
        hasStructureTree: summary.hasStructureTree,
      },
      countsByType: parsed.countsByType,
      root: parsed.root ? serializeNode(parsed.root) : null,
      allTags: filtered.map((t) => ({
        id: t.id,
        type: t.type,
        rawType: t.rawType,
        attributes: opts.includeAttributes ? t.attributes : undefined,
        pages: t.pages,
        depth: t.depth,
        path: t.path,
      })),
    },
    null,
    2,
  );
}

export function renderCsvTags(parsed: ParsedTree, opts: TagOptions): string {
  const rows: string[] = [];
  rows.push("id,type,raw_type,depth,path,pages,attributes");
  for (const t of filterByType(parsed.all, opts.tagTypeFilter)) {
    const attrs = opts.includeAttributes
      ? t.attributes.map((a) => `${a.key}=${a.value}`).join(";")
      : "";
    rows.push([
      t.id,
      escapeCsv(t.type),
      escapeCsv(t.rawType),
      t.depth,
      escapeCsv(t.path),
      escapeCsv(t.pages.join(",")),
      escapeCsv(attrs),
    ].join(","));
  }
  return rows.join("\n");
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:pdf-tag-tree-viewer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  fileName: string;
  pageCount: number;
  totalTags: number;
  maxDepth: number;
  topLevelType: string;
  hasStructureTree: boolean;
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

const VALID_MODES = new Set<ViewMode>(VIEW_MODES);
const VALID_FILTERS = new Set<TagTypeFilter>(TAG_TYPE_FILTERS);

export function buildShareUrl(opts: TagOptions): string {
  const params = new URLSearchParams();
  if (opts.viewMode !== DEFAULT_OPTIONS.viewMode) params.set("mode", opts.viewMode);
  if (opts.tagTypeFilter !== DEFAULT_OPTIONS.tagTypeFilter) params.set("filter", opts.tagTypeFilter);
  if (opts.includeAttributes !== DEFAULT_OPTIONS.includeAttributes) params.set("attrs", opts.includeAttributes ? "1" : "0");
  if (opts.expandDepth !== DEFAULT_OPTIONS.expandDepth) params.set("depth", String(opts.expandDepth));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<TagOptions> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<TagOptions> = {};
  const mode = params.get("mode");
  if (mode && VALID_MODES.has(mode as ViewMode)) out.viewMode = mode as ViewMode;
  const filter = params.get("filter");
  if (filter && VALID_FILTERS.has(filter as TagTypeFilter)) out.tagTypeFilter = filter as TagTypeFilter;
  const attrs = params.get("attrs");
  if (attrs !== null) out.includeAttributes = attrs === "1";
  const depth = params.get("depth");
  if (depth !== null) {
    const n = Number(depth);
    if (Number.isInteger(n) && n >= MIN_EXPAND_DEPTH && n <= MAX_EXPAND_DEPTH) out.expandDepth = n;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateOptions(opts: TagOptions): ToolResult<TagOptions> {
  if (!opts) return { ok: false, error: "Missing options." };
  if (!VALID_MODES.has(opts.viewMode)) {
    return { ok: false, error: `Unknown view mode: ${opts.viewMode}` };
  }
  if (!VALID_FILTERS.has(opts.tagTypeFilter)) {
    return { ok: false, error: `Unknown tag-type filter: ${opts.tagTypeFilter}` };
  }
  if (!Number.isInteger(opts.expandDepth) || opts.expandDepth < MIN_EXPAND_DEPTH || opts.expandDepth > MAX_EXPAND_DEPTH) {
    return { ok: false, error: `Expand depth must be an integer between ${MIN_EXPAND_DEPTH} and ${MAX_EXPAND_DEPTH}.` };
  }
  return { ok: true, output: { ...opts } };
}

// Suppress unused-import lint for escapeHtml — used in renderHtmlTree.
void escapeHtml;
