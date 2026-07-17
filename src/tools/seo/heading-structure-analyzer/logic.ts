/**
 * Heading Structure Analyzer — pure logic.
 *
 * Extract H1-H6 from HTML, build an outline tree, detect SEO issues.
 * Pure functions only — no DOM, no network.
 */

export interface Heading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  position: number; // index in document
}

export interface HeadingNode extends Heading {
  children: HeadingNode[];
}

export interface SeoIssue {
  level: "error" | "warning";
  type: string;
  message: string;
  heading?: Heading;
}

export interface HeadingCounts {
  h1: number;
  h2: number;
  h3: number;
  h4: number;
  h5: number;
  h6: number;
  total: number;
}

export interface AnalysisResult {
  headings: Heading[];
  tree: HeadingNode[];
  counts: HeadingCounts;
  issues: SeoIssue[];
  wordsPerHeading: number[];
}

export const HEADING_LENGTH_MAX = 60;

const HEADING_REGEX = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;

/** Strip HTML tags and decode entities from a heading's inner HTML. */
export function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, "") // strip inner tags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract all H1-H6 headings from HTML. */
export function extractHeadings(html: string): Heading[] {
  if (!html) return [];
  const headings: Heading[] = [];
  let m: RegExpExecArray | null;
  let pos = 0;
  HEADING_REGEX.lastIndex = 0;
  while ((m = HEADING_REGEX.exec(html)) !== null) {
    const level = parseInt(m[1], 10) as 1 | 2 | 3 | 4 | 5 | 6;
    const text = stripHtml(m[2]);
    headings.push({ level, text, position: pos++ });
  }
  return headings;
}

/** Build a heading tree (H2 nests under H1, H3 under H2, etc.). */
export function buildTree(headings: Heading[]): HeadingNode[] {
  const roots: HeadingNode[] = [];
  const stack: HeadingNode[] = [];
  for (const h of headings) {
    const node: HeadingNode = { ...h, children: [] };
    // Pop stack until we find a parent with a lower level
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }
  return roots;
}

/** Count headings per level. */
export function countHeadings(headings: Heading[]): HeadingCounts {
  const counts: HeadingCounts = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0, total: 0 };
  for (const h of headings) {
    counts[`h${h.level}` as keyof Omit<HeadingCounts, "total">]++;
    counts.total++;
  }
  return counts;
}

/** Count words per heading. */
export function countWordsPerHeading(headings: Heading[]): number[] {
  return headings.map((h) => (h.text ? h.text.split(/\s+/).filter(Boolean).length : 0));
}

/** Detect SEO issues in the heading structure. */
export function detectIssues(headings: Heading[]): SeoIssue[] {
  const issues: SeoIssue[] = [];
  const counts = countHeadings(headings);
  // Multiple H1s
  if (counts.h1 > 1) {
    issues.push({
      level: "warning",
      type: "multiple-h1",
      message: `Multiple H1 tags detected (${counts.h1}). Best practice is one H1 per page.`,
    });
  }
  // Missing H1
  if (counts.h1 === 0 && counts.total > 0) {
    issues.push({
      level: "error",
      type: "missing-h1",
      message: "No H1 tag found. Every page should have exactly one H1.",
    });
  }
  // Skipped levels (e.g., H2 → H4) or H3 before H2
  let prevLevel = 0;
  for (const h of headings) {
    if (prevLevel > 0 && h.level > prevLevel + 1) {
      issues.push({
        level: "warning",
        type: "skipped-level",
        message: `Skipped heading level: H${prevLevel} → H${h.level}. Don't skip levels for styling.`,
        heading: h,
      });
    }
    prevLevel = h.level;
  }
  // Long headings
  for (const h of headings) {
    if (h.text.length > HEADING_LENGTH_MAX) {
      issues.push({
        level: "warning",
        type: "long-heading",
        message: `H${h.level} is too long (${h.text.length} chars > ${HEADING_LENGTH_MAX}): "${h.text.slice(0, 60)}…"`,
        heading: h,
      });
    }
  }
  // Empty headings
  for (const h of headings) {
    if (!h.text || !h.text.trim()) {
      issues.push({
        level: "error",
        type: "empty-heading",
        message: `H${h.level} is empty.`,
        heading: h,
      });
    }
  }
  return issues;
}

/** Render the heading tree as a markdown outline. */
export function renderMarkdownOutline(tree: HeadingNode[], indent: number = 0): string {
  const lines: string[] = [];
  for (const node of tree) {
    const prefix = "  ".repeat(indent) + "#".repeat(node.level) + " ";
    lines.push(prefix + node.text);
    if (node.children.length > 0) {
      lines.push(renderMarkdownOutline(node.children, indent + 1));
    }
  }
  return lines.join("\n");
}

/** Render the headings as a flat numbered outline (1, 1.1, 1.1.1, ...). */
export function renderNumberedOutline(tree: HeadingNode[]): string {
  const lines: string[] = [];
  const walk = (nodes: HeadingNode[], prefix: string): void => {
    nodes.forEach((n, i) => {
      const num = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
      lines.push(`${num}  ${"#".repeat(n.level)} ${n.text}`);
      walk(n.children, num);
    });
  };
  walk(tree, "");
  return lines.join("\n");
}

/** Run the full analysis. */
export function analyze(html: string): AnalysisResult {
  const headings = extractHeadings(html);
  const tree = buildTree(headings);
  const counts = countHeadings(headings);
  const issues = detectIssues(headings);
  const wordsPerHeading = countWordsPerHeading(headings);
  return { headings, tree, counts, issues, wordsPerHeading };
}

// ---- History ----

const HISTORY_KEY = "unqtools:heading-structure-analyzer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  totalHeadings: number;
  issueCount: number;
  snippet: string;
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

export function buildShareUrl(html: string): string {
  const params = new URLSearchParams();
  params.set("html", html);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { html?: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const html = params.get("html");
  if (html === null) return {};
  return { html };
}
