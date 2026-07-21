/**
 * Glob Pattern Tester — pure logic.
 *
 * Test glob patterns against a list of file paths with selectable flavors
 * (shell, gitignore, minimatch/picomatch, tsconfig). Convert glob to regex,
 * explain each token, highlight matches, and resolve multi-pattern
 * include/exclude sets. 100% client-side — paths never leave the browser.
 *
 * Pure functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type GlobFlavor = "shell" | "gitignore" | "minimatch" | "tsconfig";

export interface ConvertOptions {
  flavor: GlobFlavor;
  /** Case-sensitive match (default false = case-insensitive). */
  caseSensitive: boolean;
  /** Allow `*` to match leading dots in filenames (default false). */
  dot: boolean;
  /** Enable `**` globstar (default true). */
  globstar: boolean;
}

export type TokenKind =
  | "literal"
  | "star"
  | "globstar"
  | "question"
  | "char-class"
  | "brace"
  | "negation"
  | "anchor"
  | "dir-marker";

export interface Token {
  kind: TokenKind;
  /** Original text from the glob. */
  raw: string;
  /** Regex contribution. */
  regex: string;
  /** Human-readable explanation. */
  explanation: string;
}

export interface ConvertResult {
  /** The compiled regex. */
  regex: RegExp;
  /** Regex source string. */
  source: string;
  /** Tokens with explanations. */
  tokens: Token[];
  /** Whether the pattern was negated (gitignore `!`). */
  negated: boolean;
  /** Whether the pattern is directory-only (gitignore trailing `/`). */
  dirOnly: boolean;
  /** Whether the pattern is anchored (gitignore leading `/`). */
  anchored: boolean;
}

export interface MatchResult {
  path: string;
  matched: boolean;
  /** Negated (excluded) by a `!` pattern. */
  excluded: boolean;
}

export interface MatchSet {
  /** All matched paths (after include/exclude resolution). */
  matched: string[];
  /** Unmatched paths. */
  unmatched: string[];
  /** Per-path detail. */
  results: MatchResult[];
}

export interface PatternEntry {
  id: string;
  pattern: string;
  /** If true, this is an exclude (negation) pattern. */
  exclude: boolean;
}

export interface HighlightSegment {
  text: string;
  matched: boolean;
}

export interface HistoryEntry {
  ts: number;
  flavor: GlobFlavor;
  patternCount: number;
  pathCount: number;
  matchCount: number;
}

export interface PresetPattern {
  id: string;
  label: string;
  pattern: string;
  flavor: GlobFlavor;
  description: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const FLAVORS: { id: GlobFlavor; label: string; description: string }[] = [
  { id: "shell",      label: "Shell glob (bash/zsh)",   description: "POSIX shell wildcards: *, **, ?, [abc], [a-z], {a,b}. `**` only crosses `/` if globstar is enabled." },
  { id: "gitignore",  label: ".gitignore",              description: "gitignore semantics: trailing `/` matches dirs, leading `/` anchors to root, `!` negates." },
  { id: "minimatch",  label: "minimatch / picomatch",   description: "Like shell but with the extended features used by npm, webpack, eslint, ripgrep --glob." },
  { id: "tsconfig",   label: "tsconfig (include/exclude)", description: "TypeScript's include/exclude field semantics — equivalent to minimatch with globstar." },
];

export const DEFAULT_OPTIONS: ConvertOptions = {
  flavor: "shell",
  caseSensitive: false,
  dot: false,
  globstar: true,
};

export const SAMPLE_PATHS: string[] = [
  "src/index.ts",
  "src/utils/helpers.ts",
  "src/utils/.hidden.ts",
  "src/components/Button.tsx",
  "src/components/Button.test.tsx",
  "src/data/users.json",
  "src/data/orders.json",
  "test/setup.ts",
  "test/helpers.ts",
  "README.md",
  "package.json",
  ".env",
  ".env.local",
  ".gitignore",
  "dist/bundle.js",
  "dist/bundle.min.js",
  "node_modules/react/index.js",
  "docs/api/v1.md",
  "docs/api/v2.md",
  "images/logo.png",
  "images/logo@2x.png",
  "src/deep/nested/folder/file.ts",
];

export const PRESET_PATTERNS: PresetPattern[] = [
  { id: "all-ts",        label: "All TypeScript",       pattern: "**/*.{ts,tsx}",          flavor: "minimatch", description: "Recursively match every .ts and .tsx file." },
  { id: "src-only",      label: "Only in src/",         pattern: "src/**/*",                flavor: "minimatch", description: "Everything under src/." },
  { id: "test-files",    label: "Test files",           pattern: "**/*.test.{ts,tsx,js}",   flavor: "minimatch", description: "Any *.test.* file anywhere in the tree." },
  { id: "dotfiles",      label: "Dotfiles",             pattern: ".*",                      flavor: "shell",     description: "Files starting with a dot at the root." },
  { id: "gitignore-js",  label: "Ignore JS in dist",    pattern: "dist/*.js",               flavor: "gitignore", description: "Gitignore: any .js file at the top of dist/." },
  { id: "gitignore-node",label: "Ignore node_modules",  pattern: "node_modules/",           flavor: "gitignore", description: "Gitignore: trailing slash = directory only." },
  { id: "images",        label: "Image files",          pattern: "**/*.{png,jpg,jpeg,gif,svg,webp}", flavor: "minimatch", description: "Common raster + vector image formats." },
  { id: "src-tests",     label: "Exclude tests",        pattern: "src/**/*",                flavor: "minimatch", description: "Match src/ files; combine with an exclude of **/*.test.*" },
];

// ---------------------------------------------------------------------------
// Path normalization
// ---------------------------------------------------------------------------

/** Normalize a path: convert backslashes to forward slashes. */
export function normalizePath(p: string): string {
  return (p || "").replace(/\\/g, "/").replace(/\r/g, "").trim();
}

/** Parse a path list (newline or comma separated). */
export function parsePathList(input: string): string[] {
  if (!input) return [];
  return input
    .split(/[\n,]+/)
    .map(normalizePath)
    .filter((p) => p.length > 0);
}

// ---------------------------------------------------------------------------
// Glob → regex conversion
// ---------------------------------------------------------------------------

/** Find the matching closing brace for an opening `{` at position `start`. */
function findMatchingBrace(s: string, start: number): number {
  let depth = 0;
  for (let i = start; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Convert a glob fragment (no top-level gitignore prefix) to a regex string. */
function globFragmentToRegex(
  glob: string,
  opts: ConvertOptions,
  tokens: Token[],
): string {
  let regex = "";
  let i = 0;
  let atSegmentStart = true;
  const len = glob.length;

  while (i < len) {
    const ch = glob[i];

    if (ch === "*") {
      if (glob[i + 1] === "*" && opts.globstar) {
        if (glob[i + 2] === "/") {
          tokens.push({
            kind: "globstar",
            raw: "**/",
            regex: "(?:[^/]+/)*",
            explanation: "Globstar `**/` — match zero or more path segments.",
          });
          regex += "(?:[^/]+/)*";
          i += 3;
          atSegmentStart = true;
        } else {
          tokens.push({
            kind: "globstar",
            raw: "**",
            regex: ".*",
            explanation: "Globstar `**` — match anything including path separators.",
          });
          regex += ".*";
          i += 2;
          atSegmentStart = false;
        }
      } else {
        const starRegex = atSegmentStart && !opts.dot
          ? "(?:[^/.][^/]*)?"
          : "[^/]*";
        tokens.push({
          kind: "star",
          raw: "*",
          regex: starRegex,
          explanation: opts.dot
            ? "Star `*` — match any chars except `/` (incl. leading dot)."
            : "Star `*` — match any chars except `/` (excl. leading dot).",
        });
        regex += starRegex;
        i += 1;
        atSegmentStart = false;
      }
    } else if (ch === "?") {
      const qRegex = atSegmentStart && !opts.dot ? "[^/.]" : "[^/]";
      tokens.push({
        kind: "question",
        raw: "?",
        regex: qRegex,
        explanation: "Question `?` — match a single char (not `/`).",
      });
      regex += qRegex;
      i += 1;
      atSegmentStart = false;
    } else if (ch === "[") {
      const end = glob.indexOf("]", i + 1);
      if (end === -1) {
        tokens.push({
          kind: "literal",
          raw: "[",
          regex: "\\[",
          explanation: "Literal `[` (no closing `]` found).",
        });
        regex += "\\[";
        i += 1;
        atSegmentStart = false;
      } else {
        const classContent = glob.slice(i, end + 1);
        let body = classContent.slice(1, -1);
        let negate = "";
        if (body.startsWith("!") || body.startsWith("^")) {
          negate = "^";
          body = body.slice(1);
          tokens.push({
            kind: "char-class",
            raw: classContent,
            regex: `[${negate}${body}]`,
            explanation: `Negated char class ${classContent} — match any char NOT listed.`,
          });
        } else {
          tokens.push({
            kind: "char-class",
            raw: classContent,
            regex: `[${body}]`,
            explanation: `Char class ${classContent} — match any char listed.`,
          });
        }
        regex += `[${negate}${body}]`;
        i = end + 1;
        atSegmentStart = false;
      }
    } else if (ch === "{") {
      const end = findMatchingBrace(glob, i);
      if (end === -1) {
        tokens.push({
          kind: "literal",
          raw: "{",
          regex: "\\{",
          explanation: "Literal `{` (no closing `}` found).",
        });
        regex += "\\{";
        i += 1;
        atSegmentStart = false;
      } else {
        const braceContent = glob.slice(i + 1, end);
        const parts = braceContent.split(",");
        const partRegexes = parts.map((p) => globFragmentToRegex(p, opts, []));
        const braceRegex = `(?:${partRegexes.join("|")})`;
        tokens.push({
          kind: "brace",
          raw: `{${braceContent}}`,
          regex: braceRegex,
          explanation: `Brace expansion {${braceContent}} — match any of: ${parts.join(" | ")}.`,
        });
        regex += braceRegex;
        i = end + 1;
        atSegmentStart = false;
      }
    } else if (ch === "/") {
      tokens.push({
        kind: "literal",
        raw: "/",
        regex: "/",
        explanation: "Path separator `/`.",
      });
      regex += "/";
      i += 1;
      atSegmentStart = true;
    } else {
      // Escape regex special chars
      const escaped = ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
      tokens.push({
        kind: "literal",
        raw: ch,
        regex: escaped,
        explanation: `Literal "${ch}".`,
      });
      regex += escaped;
      i += 1;
      atSegmentStart = false;
    }
  }

  return regex;
}

/** Convert a glob pattern to a regex with token-level explanation. */
export function globToRegex(
  glob: string,
  opts: ConvertOptions = DEFAULT_OPTIONS,
): ConvertResult {
  const tokens: Token[] = [];
  let pattern = glob;
  let negated = false;
  let dirOnly = false;
  let anchored = false;

  // Gitignore-specific prefixes
  if (opts.flavor === "gitignore") {
    if (pattern.startsWith("!")) {
      negated = true;
      tokens.push({
        kind: "negation",
        raw: "!",
        regex: "",
        explanation: "Negation `!` — un-ignore matching paths (gitignore).",
      });
      pattern = pattern.slice(1);
    }
    if (pattern.endsWith("/")) {
      dirOnly = true;
      tokens.push({
        kind: "dir-marker",
        raw: "/ (trailing)",
        regex: "",
        explanation: "Trailing `/` — match directories only (gitignore).",
      });
      pattern = pattern.slice(0, -1);
    }
    if (pattern.startsWith("/")) {
      anchored = true;
      tokens.push({
        kind: "anchor",
        raw: "/ (leading)",
        regex: "",
        explanation: "Leading `/` — anchor to the gitignore file's directory.",
      });
      pattern = pattern.slice(1);
    }
  }

  const bodyRegex = globFragmentToRegex(pattern, opts, tokens);

  let finalRegex: string;
  if (opts.flavor === "gitignore") {
    if (anchored) {
      finalRegex = `^${bodyRegex}`;
    } else {
      // matches at any depth
      finalRegex = `^(?:.*/)?${bodyRegex}`;
    }
    if (dirOnly) {
      // Directory match: path is exactly this, or this/anything
      finalRegex = `${finalRegex}(?:/.*)?$`;
    } else {
      finalRegex = `${finalRegex}$`;
    }
  } else {
    // shell, minimatch, tsconfig — full match
    finalRegex = `^${bodyRegex}$`;
  }

  const flags = opts.caseSensitive ? "" : "i";
  return {
    regex: new RegExp(finalRegex, flags),
    source: finalRegex,
    tokens,
    negated,
    dirOnly,
    anchored,
  };
}

/** Test if a single glob pattern matches a single path. */
export function matchGlob(
  glob: string,
  path: string,
  opts: ConvertOptions = DEFAULT_OPTIONS,
): boolean {
  const norm = normalizePath(path);
  const result = globToRegex(glob, opts);
  return result.regex.test(norm);
}

// ---------------------------------------------------------------------------
// Multi-pattern matching
// ---------------------------------------------------------------------------

/** Match multiple patterns against a list of paths with include/exclude resolution. */
export function matchMultiPatterns(
  patterns: PatternEntry[],
  paths: string[],
  opts: ConvertOptions = DEFAULT_OPTIONS,
): MatchSet {
  const normPaths = paths.map(normalizePath);
  const includes = patterns.filter((p) => !p.exclude);
  const excludes = patterns.filter((p) => p.exclude);

  // For each path, determine if any include matches and no exclude matches.
  const results: MatchResult[] = normPaths.map((p) => {
    const included = includes.length === 0
      ? true // no include patterns = match everything by default
      : includes.some((pat) => {
          const effectiveOpts = pat.pattern.startsWith("!") && opts.flavor === "gitignore"
            ? opts
            : opts;
          const glob = pat.pattern.startsWith("!") && opts.flavor !== "gitignore"
            ? pat.pattern.slice(1)
            : pat.pattern;
          return matchGlob(glob, p, effectiveOpts);
        });
    const excluded = excludes.some((pat) => {
      const glob = pat.pattern.startsWith("!") ? pat.pattern.slice(1) : pat.pattern;
      return matchGlob(glob, p, opts);
    });
    return {
      path: p,
      matched: included && !excluded,
      excluded,
    };
  });

  const matched = results.filter((r) => r.matched).map((r) => r.path);
  const unmatched = results.filter((r) => !r.matched).map((r) => r.path);

  return { matched, unmatched, results };
}

/** Convenience: match a single pattern against a list of paths. */
export function matchPaths(
  pattern: string,
  paths: string[],
  opts: ConvertOptions = DEFAULT_OPTIONS,
): MatchSet {
  return matchMultiPatterns([{ id: "single", pattern, exclude: false }], paths, opts);
}

// ---------------------------------------------------------------------------
// Token explanation
// ---------------------------------------------------------------------------

/** Explain each token of a glob pattern. */
export function explainPattern(
  glob: string,
  opts: ConvertOptions = DEFAULT_OPTIONS,
): Token[] {
  return globToRegex(glob, opts).tokens;
}

/** Convert a regex source to a brief human description. */
export function describeRegex(source: string): string {
  if (source.startsWith("^") && source.endsWith("$")) {
    return `Full-match regex: ${source}`;
  }
  if (source.startsWith("^")) {
    return `Start-anchored regex: ${source}`;
  }
  return `Regex: ${source}`;
}

// ---------------------------------------------------------------------------
// Match highlighting
// ---------------------------------------------------------------------------

/** Highlight which parts of a path matched which parts of the pattern. */
export function highlightMatch(
  glob: string,
  path: string,
  opts: ConvertOptions = DEFAULT_OPTIONS,
): HighlightSegment[] {
  const norm = normalizePath(path);
  const result = globToRegex(glob, opts);
  // We split the path by the regex capture groups; for simplicity, just walk
  // the tokens and try to match each at the current position.
  const segments: HighlightSegment[] = [];
  let pos = 0;
  const text = norm;
  // Use the global version of the regex to find all matches
  const globalRegex = new RegExp(result.regex.source, opts.caseSensitive ? "g" : "gi");
  let lastEnd = 0;
  let m: RegExpExecArray | null;
  while ((m = globalRegex.exec(text)) !== null) {
    if (m.index > lastEnd) {
      segments.push({ text: text.slice(lastEnd, m.index), matched: false });
    }
    segments.push({ text: m[0], matched: true });
    lastEnd = m.index + m[0].length;
    if (m[0].length === 0) globalRegex.lastIndex++; // avoid infinite loop
    pos = lastEnd;
  }
  if (lastEnd < text.length) {
    segments.push({ text: text.slice(lastEnd), matched: false });
  }
  // If no segments were produced, the whole path is unmatched
  if (segments.length === 0) {
    segments.push({ text, matched: false });
  }
  return segments;
}

// ---------------------------------------------------------------------------
// Tree builder
// ---------------------------------------------------------------------------

export interface TreeNode {
  name: string;
  fullPath: string;
  children: TreeNode[];
  matched: boolean;
  excluded: boolean;
  isDir: boolean;
}

/** Build a tree from a flat list of paths with match info. */
export function buildTree(
  paths: string[],
  matchSet: MatchSet,
): TreeNode {
  const root: TreeNode = {
    name: "/",
    fullPath: "",
    children: [],
    matched: false,
    excluded: false,
    isDir: true,
  };

  const matchMap = new Map<string, MatchResult>();
  for (const r of matchSet.results) matchMap.set(r.path, r);

  for (const path of paths) {
    const norm = normalizePath(path);
    const parts = norm.split("/").filter(Boolean);
    let node = root;
    let currentPath = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLast = i === parts.length - 1;
      let child = node.children.find((c) => c.name === part);
      if (!child) {
        const mr = matchMap.get(currentPath);
        child = {
          name: part,
          fullPath: currentPath,
          children: [],
          matched: isLast ? (mr?.matched ?? false) : false,
          excluded: isLast ? (mr?.excluded ?? false) : false,
          isDir: !isLast,
        };
        node.children.push(child);
      }
      node = child;
    }
  }

  // Sort: dirs first, then alphabetical
  const sortRecursive = (n: TreeNode) => {
    n.children.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    n.children.forEach(sortRecursive);
  };
  sortRecursive(root);

  return root;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface MatchStats {
  total: number;
  matched: number;
  unmatched: number;
  excluded: number;
  byFlavor: Record<GlobFlavor, number>;
}

export function computeStats(
  patterns: PatternEntry[],
  paths: string[],
  matchSet: MatchSet,
  opts: ConvertOptions,
): MatchStats {
  return {
    total: paths.length,
    matched: matchSet.matched.length,
    unmatched: matchSet.unmatched.length,
    excluded: matchSet.results.filter((r) => r.excluded).length,
    byFlavor: {
      shell: opts.flavor === "shell" ? patterns.length : 0,
      gitignore: opts.flavor === "gitignore" ? patterns.length : 0,
      minimatch: opts.flavor === "minimatch" ? patterns.length : 0,
      tsconfig: opts.flavor === "tsconfig" ? patterns.length : 0,
    },
  };
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:glob-pattern-tester:history";
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

export function buildShareUrl(
  patterns: PatternEntry[],
  paths: string,
  opts: ConvertOptions,
): string {
  const params = new URLSearchParams();
  params.set("flavor", opts.flavor);
  params.set("case", String(opts.caseSensitive));
  params.set("dot", String(opts.dot));
  params.set("globstar", String(opts.globstar));
  if (paths) params.set("paths", paths);
  // Encode patterns compactly: "p1|p2|..." for includes, "-p3|-p4" for excludes
  const includePats = patterns.filter((p) => !p.exclude).map((p) => p.pattern);
  const excludePats = patterns.filter((p) => p.exclude).map((p) => p.pattern);
  if (includePats.length > 0) params.set("include", includePats.join("\n"));
  if (excludePats.length > 0) params.set("exclude", excludePats.join("\n"));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(
  hash: string,
): {
  patterns: PatternEntry[];
  paths: string;
  options: ConvertOptions;
} {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { patterns: [], paths: "", options: { ...DEFAULT_OPTIONS } };
  const params = new URLSearchParams(clean);
  const opts: ConvertOptions = {
    flavor: (params.get("flavor") as GlobFlavor) ?? DEFAULT_OPTIONS.flavor,
    caseSensitive: params.get("case") === "true",
    dot: params.get("dot") === "true",
    globstar: params.get("globstar") !== "false",
  };
  const paths = params.get("paths") ?? "";
  const patterns: PatternEntry[] = [];
  const include = params.get("include");
  if (include) {
    include.split("\n").filter(Boolean).forEach((p, i) => {
      patterns.push({ id: `inc-${i}`, pattern: p, exclude: false });
    });
  }
  const exclude = params.get("exclude");
  if (exclude) {
    exclude.split("\n").filter(Boolean).forEach((p, i) => {
      patterns.push({ id: `exc-${i}`, pattern: p, exclude: true });
    });
  }
  return { patterns, paths, options: opts };
}

// ---------------------------------------------------------------------------
// Pattern entry factory
// ---------------------------------------------------------------------------

let patternIdCounter = 0;
export function makePatternEntry(pattern: string, exclude: boolean): PatternEntry {
  patternIdCounter += 1;
  return {
    id: `pat-${Date.now()}-${patternIdCounter}`,
    pattern,
    exclude,
  };
}
