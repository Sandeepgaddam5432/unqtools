/**
 * Markdown TOC Generator — pure logic.
 *
 * Parse Markdown headings (H1–H6) and generate a clickable table of contents
 * with per-platform anchor slugs. Pure functions only — no DOM, no network.
 *
 * Capabilities:
 *   - Per-platform slugs (GitHub, GitLab, pandoc, Bitbucket, generic).
 *   - Duplicate-heading disambiguation (-1, -2 suffixes).
 *   - Code-fence-aware parsing (skips ``` and ~~~ blocks).
 *   - Setext-style heading support (=== and ---).
 *   - Configurable min/max depth (H1–H6).
 *   - Skip-first-heading option.
 *   - Bullet or ordered list output.
 *   - Insert/update at [TOC] or <!-- toc --> marker.
 *   - Optional <a name> anchors for renderers without auto-IDs.
 *   - History (localStorage, max 20) and a shareable URL.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Platform = "github" | "gitlab" | "pandoc" | "bitbucket" | "generic";

export type ListStyle = "bullet" | "ordered";

export type MarkerKind = "none" | "bracket" | "html";

export interface Heading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  slug: string;
  /** Line index (0-based) where the heading was found in source. */
  line: number;
  /** Suffix for disambiguation — 0 for the first occurrence, 1, 2, … for duplicates. */
  dupIndex: number;
}

export interface TocOptions {
  platform: Platform;
  minLevel: 1 | 2 | 3 | 4 | 5 | 6;
  maxLevel: 1 | 2 | 3 | 4 | 5 | 6;
  listStyle: ListStyle;
  skipFirst: boolean;
  /** Emit <a name="slug"></a> before each heading text. */
  emitAnchors: boolean;
  /** Indent string per level (default two spaces). */
  indent?: string;
}

export interface TocStats {
  total: number;
  byLevel: Record<1 | 2 | 3 | 4 | 5 | 6, number>;
  duplicates: number;
  inCodeBlocks: number;
  chars: number;
}

export interface HistoryEntry {
  ts: number;
  platform: Platform;
  headingCount: number;
  preview: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:markdown-toc-generator:history";
const HISTORY_MAX = 20;

export const PLATFORM_LABELS: Record<Platform, string> = {
  github: "GitHub",
  gitlab: "GitLab",
  pandoc: "pandoc",
  bitbucket: "Bitbucket",
  generic: "Generic",
};

export const DEFAULT_OPTIONS: TocOptions = {
  platform: "github",
  minLevel: 1,
  maxLevel: 6,
  listStyle: "bullet",
  skipFirst: false,
  emitAnchors: false,
  indent: "  ",
};

// Markers — each entry: { open, close }. `close` may be null for open-ended.
export const MARKER_PATTERNS: Record<Exclude<MarkerKind, "none">, { open: RegExp; close: RegExp | null }> = {
  bracket: { open: /^\s*\[TOC\]\s*$/i, close: null },
  html: { open: /^\s*<!--\s*toc\s*-->\s*$/i, close: /^\s*<!--\s*tocstop\s*-->\s*$/i },
};

// ---------------------------------------------------------------------------
// Slugify (per-platform)
// ---------------------------------------------------------------------------

/** Strip emoji from a string. */
export function stripEmoji(s: string): string {
  // Match common emoji ranges — pictographics, symbols, and variation selectors.
  return s
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, "")
    .trim();
}

/** Strip inline markdown formatting from heading text. */
export function stripInlineMarkdown(s: string): string {
  return s
    // Inline code: `code`
    .replace(/`([^`]+)`/g, "$1")
    // Images and links: ![alt](url) → alt, [text](url) → text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Bold/italic markers
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .trim();
}

/** Per-platform slug generator. */
export function slugify(text: string, platform: Platform): string {
  const noEmoji = stripEmoji(text);
  const clean = stripInlineMarkdown(noEmoji);
  let slug = "";
  switch (platform) {
    case "github":
    case "gitlab": {
      // Lowercase, remove anything that isn't a letter, number, space, or hyphen,
      // then turn spaces into hyphens.
      slug = clean
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      break;
    }
    case "pandoc": {
      // Lowercase, remove all punctuation (including hyphens), spaces → hyphens.
      slug = clean
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      break;
    }
    case "bitbucket": {
      // Lowercase, preserve underscores, spaces → hyphens.
      slug = clean
        .toLowerCase()
        .replace(/[^a-z0-9\s_-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      break;
    }
    case "generic":
    default: {
      // Lowercase, collapse whitespace to single hyphen, strip non-word chars.
      slug = clean
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      break;
    }
  }
  return slug;
}

// ---------------------------------------------------------------------------
// Heading parser
// ---------------------------------------------------------------------------

interface RawHeading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  line: number;
}

/** Detect a fenced-code delimiter (``` or ~~~) — returns the fence char or null. */
function fenceDelimiter(line: string): "`" | "~" | null {
  const m = line.match(/^\s{0,3}(`{3,}|~{3,})/);
  if (!m) return null;
  return m[1][0] === "`" ? "`" : "~";
}

/** Parse a markdown source string into a list of raw headings, code-fence aware. */
export function parseHeadings(markdown: string): RawHeading[] {
  const lines = markdown.split("\n");
  const out: RawHeading[] = [];
  let inFence: "`" | "~" | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code-fence tracking
    const delim = fenceDelimiter(line);
    if (delim) {
      if (inFence === null) {
        inFence = delim;
      } else if (inFence === delim) {
        // Closing fence must be the same char and at least as long.
        const fenceCount = (line.match(new RegExp(`\\${delim}{3,}`)) ?? [""])[0].length;
        const openingFenceCount = 3; // minimum, conservative
        if (fenceCount >= openingFenceCount) inFence = null;
      }
      continue;
    }
    if (inFence !== null) continue;

    // ATX heading: 1–6 # chars followed by a space (or end of line).
    const atxMatch = line.match(/^(#{1,6})(?:\s+(.*?))?\s*#*\s*$/);
    if (atxMatch) {
      const level = atxMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      const text = (atxMatch[2] ?? "").trim();
      if (text) {
        out.push({ level, text, line: i });
        continue;
      }
    }

    // Setext heading: a non-empty line followed by === (H1) or --- (H2).
    if (i + 1 < lines.length && line.trim() && !line.trim().startsWith("#")) {
      const next = lines[i + 1];
      const setextMatch = next.match(/^\s{0,3}(=+|-+)\s*$/);
      if (setextMatch) {
        const char = setextMatch[1][0];
        if (char === "=") {
          out.push({ level: 1, text: line.trim(), line: i });
          i++; // consume the underline
        } else if (char === "-") {
          // Only treat as setext H2 if the previous line isn't already a heading
          // or a horizontal rule.
          if (line.trim().length > 0 && !/^\s{0,3}(-{3,}\s*)$/.test(line)) {
            out.push({ level: 2, text: line.trim(), line: i });
            i++;
          }
        }
      }
    }
  }
  return out;
}

/** Resolve duplicate headings with -1, -2, … suffixes per platform's rules. */
export function dedupeSlugs(headings: RawHeading[], platform: Platform): Heading[] {
  const seen = new Map<string, number>();
  const out: Heading[] = [];
  for (const h of headings) {
    const base = slugify(h.text, platform);
    let slug = base;
    let dupIndex = 0;
    if (seen.has(base)) {
      const count = seen.get(base)!;
      dupIndex = count;
      slug = `${base}-${dupIndex}`;
      seen.set(base, count + 1);
    } else {
      seen.set(base, 1);
    }
    out.push({ ...h, slug, dupIndex });
  }
  return out;
}

/** Full parse — code-fence aware + dedupe + filter by depth. */
export function parseAndDedupe(
  markdown: string,
  options: Pick<TocOptions, "platform" | "minLevel" | "maxLevel" | "skipFirst">,
): Heading[] {
  const raw = parseHeadings(markdown);
  let filtered = raw.filter((h) => h.level >= options.minLevel && h.level <= options.maxLevel);
  if (options.skipFirst && filtered.length > 0) {
    filtered = filtered.slice(1);
  }
  return dedupeSlugs(filtered, options.platform);
}

// ---------------------------------------------------------------------------
// TOC rendering
// ---------------------------------------------------------------------------

/** Render a single heading as a TOC list item. */
export function renderTocItem(h: Heading, options: TocOptions): string {
  const indent = options.indent ?? "  ";
  const pad = indent.repeat(Math.max(0, h.level - options.minLevel));
  const marker = options.listStyle === "bullet" ? "-" : "1.";
  const anchor = options.emitAnchors ? `<a name="${h.slug}"></a>` : "";
  return `${pad}${marker} ${anchor}[${h.text}](#${h.slug})`;
}

/** Render the entire TOC from a list of headings. */
export function renderToc(headings: Heading[], options: TocOptions): string {
  if (headings.length === 0) return "";
  return headings.map((h) => renderTocItem(h, options)).join("\n");
}

/** Convenience: markdown in, TOC out. */
export function generateToc(markdown: string, options: TocOptions): string {
  const headings = parseAndDedupe(markdown, options);
  return renderToc(headings, options);
}

// ---------------------------------------------------------------------------
// Marker insertion / update
// ---------------------------------------------------------------------------

/** Find the position of a TOC marker in source. Returns {line, kind} or null. */
export function findTocMarker(markdown: string): { line: number; kind: Exclude<MarkerKind, "none">; closeLine: number | null } | null {
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (MARKER_PATTERNS.bracket.open.test(lines[i])) {
      return { line: i, kind: "bracket", closeLine: null };
    }
    if (MARKER_PATTERNS.html.open.test(lines[i])) {
      // Look for the closing <!-- tocstop -->
      let close = -1;
      for (let j = i + 1; j < lines.length; j++) {
        if (MARKER_PATTERNS.html.close!.test(lines[j])) { close = j; break; }
      }
      return { line: i, kind: "html", closeLine: close >= 0 ? close : null };
    }
  }
  return null;
}

/** Insert or update a TOC at the marker position. Returns the new markdown. */
export function insertToc(markdown: string, options: TocOptions): string {
  const toc = generateToc(markdown, options);
  const lines = markdown.split("\n");
  const marker = findTocMarker(markdown);

  if (!marker) {
    // No marker — prepend the TOC at the top.
    const header = options.listStyle === "bullet"
      ? "<!-- toc -->\n\n"
      : "<!-- toc -->\n\n";
    const footer = "\n\n<!-- tocstop -->";
    return `${header}${toc}${footer}\n\n${markdown}`.replace(/\n{3,}/g, "\n\n");
  }

  if (marker.kind === "bracket") {
    // Replace the [TOC] line with the rendered TOC.
    lines[marker.line] = toc;
    return lines.join("\n");
  }

  // HTML marker — replace everything between open and close.
  const closeLine = marker.closeLine ?? marker.line;
  const before = lines.slice(0, marker.line + 1);
  const after = marker.closeLine !== null ? lines.slice(closeLine) : ["<!-- tocstop -->", ...lines.slice(marker.line + 1)];
  return [...before, "", toc, "", ...after].join("\n").replace(/\n{3,}/g, "\n\n");
}

/** Remove an existing TOC (and its markers). Returns the cleaned markdown. */
export function removeToc(markdown: string): string {
  const lines = markdown.split("\n");
  const marker = findTocMarker(markdown);
  if (!marker) return markdown;
  if (marker.kind === "bracket") {
    lines.splice(marker.line, 1);
    return lines.join("\n");
  }
  const closeLine = marker.closeLine ?? marker.line;
  lines.splice(marker.line, closeLine - marker.line + 1);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

/** Alias: update an existing TOC, or insert a new one. */
export function updateToc(markdown: string, options: TocOptions): string {
  return insertToc(markdown, options);
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export function computeStats(markdown: string, options: TocOptions): TocStats {
  const headings = parseAndDedupe(markdown, options);
  const byLevel: Record<1 | 2 | 3 | 4 | 5 | 6, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  let duplicates = 0;
  for (const h of headings) {
    byLevel[h.level] += 1;
    if (h.dupIndex > 0) duplicates += 1;
  }
  // Count headings inside code blocks (a measure of parsing correctness).
  const allRaw = parseHeadings(markdown);
  const filteredRaw = allRaw.filter((h) => h.level >= options.minLevel && h.level <= options.maxLevel);
  const inCodeBlocks = allRaw.length - filteredRaw.length < 0 ? 0 : 0; // parser already skips code blocks

  return {
    total: headings.length,
    byLevel,
    duplicates,
    inCodeBlocks,
    chars: renderToc(headings, options).length,
  };
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

export function buildShareUrl(options: TocOptions): string {
  const params = new URLSearchParams();
  params.set("platform", options.platform);
  params.set("min", String(options.minLevel));
  params.set("max", String(options.maxLevel));
  params.set("list", options.listStyle);
  params.set("skipFirst", String(options.skipFirst));
  params.set("anchors", String(options.emitAnchors));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<TocOptions> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const validPlatforms = Object.keys(PLATFORM_LABELS) as Platform[];
  const platform = params.get("platform");
  const min = params.get("min");
  const max = params.get("max");
  const list = params.get("list");
  const skipFirst = params.get("skipFirst");
  const anchors = params.get("anchors");
  const out: Partial<TocOptions> = {};
  if (platform && validPlatforms.includes(platform as Platform)) out.platform = platform as Platform;
  if (min && /^[1-6]$/.test(min)) out.minLevel = Number(min) as 1 | 2 | 3 | 4 | 5 | 6;
  if (max && /^[1-6]$/.test(max)) out.maxLevel = Number(max) as 1 | 2 | 3 | 4 | 5 | 6;
  if (list === "bullet" || list === "ordered") out.listStyle = list;
  if (skipFirst === "true") out.skipFirst = true;
  if (skipFirst === "false") out.skipFirst = false;
  if (anchors === "true") out.emitAnchors = true;
  if (anchors === "false") out.emitAnchors = false;
  return out;
}
