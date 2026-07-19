/**
 * AI Git Commit Message Generator — pure logic.
 *
 * Turns a staged git diff into a well-formed Conventional Commits
 * message: type / scope / subject / body / footer. Pure functions
 * only — no DOM, no network. The optional LLM call (BYO API key)
 * lives in ui.tsx because it touches the network.
 *
 * Honesty clause: AI infers intent from the diff and can miss the
 * *why*. Review the generated message before committing. On-device
 * heuristics are weaker than a BYO-key LLM for nuance; keys stay
 * client-side; nothing is uploaded or logged by us.
 */

// ---------- Types ----------

export type ChangeType =
  | "feat"
  | "fix"
  | "docs"
  | "refactor"
  | "test"
  | "chore"
  | "perf"
  | "style"
  | "ci"
  | "build";

export type CommitStyle = "conventional" | "conventional-body" | "gitmoji" | "plain";

export type FileChangeKind = "added" | "modified" | "deleted" | "renamed";

export interface FileChange {
  path: string;
  oldPath?: string;           // for renames
  kind: FileChangeKind;
  language: string;
  additions: number;
  deletions: number;
  hunks: number;
  /** Names of functions/classes touched (best-effort, from hunk headers). */
  symbols: string[];
}

export interface ParsedDiff {
  files: FileChange[];
  totalAdditions: number;
  totalDeletions: number;
  totalLines: number;
  fileCount: number;
  /** True if the diff is too large to inspect line-by-line and was summarized. */
  summarized: boolean;
}

export interface ChunkSummary {
  fileCount: number;
  additions: number;
  deletions: number;
  topPaths: string[];
  topSymbols: string[];
}

export interface ClassificationResult {
  type: ChangeType;
  scope: string;
  confidence: number;
  reasons: string[];
}

export interface BreakingChangeInfo {
  isBreaking: boolean;
  reason: string;
}

export interface CommitMessage {
  type: ChangeType;
  scope: string;
  subject: string;
  body: string;
  footer: string;
  isBreaking: boolean;
  issueRefs: string[];
  style: CommitStyle;
  /** Full paste-ready message text. */
  full: string;
  warnings: string[];
  generatedAt: number;
}

export interface ValidationReport {
  valid: boolean;
  errors: string[];
}

export interface HistoryEntry {
  ts: number;
  type: ChangeType;
  scope: string;
  subject: string;
  style: CommitStyle;
  fileCount: number;
  additions: number;
  deletions: number;
  isBreaking: boolean;
}

// ---------- Constants ----------

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  feat: "feat — new feature",
  fix: "fix — bug fix",
  docs: "docs — documentation",
  refactor: "refactor — code restructuring",
  test: "test — tests",
  chore: "chore — maintenance",
  perf: "perf — performance",
  style: "style — formatting",
  ci: "ci — CI/CD",
  build: "build — build system",
};

export const COMMIT_STYLES: CommitStyle[] = [
  "conventional",
  "conventional-body",
  "gitmoji",
  "plain",
];

export const STYLE_LABELS: Record<CommitStyle, string> = {
  conventional: "Conventional (subject)",
  "conventional-body": "Conventional + body",
  gitmoji: "Gitmoji",
  plain: "Plain",
};

export const GITMOJI_MAP: Record<ChangeType, string> = {
  feat: "✨",
  fix: "🐛",
  docs: "📝",
  refactor: "♻️",
  test: "✅",
  chore: "🔨",
  perf: "⚡️",
  style: "🎨",
  ci: "👷",
  build: "📦",
};

export const LANGUAGE_MAP: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
  mjs: "javascript", cjs: "javascript", py: "python", rb: "ruby",
  go: "go", rs: "rust", java: "java", kt: "kotlin", swift: "swift",
  c: "c", h: "c", cpp: "cpp", cc: "cpp", hpp: "cpp",
  cs: "csharp", php: "php", scala: "scala", clj: "clojure",
  sh: "shell", bash: "shell", zsh: "shell", fish: "shell",
  md: "markdown", markdown: "markdown", rst: "rst",
  json: "json", yml: "yaml", yaml: "yaml", toml: "toml",
  xml: "xml", html: "html", css: "css", scss: "scss",
  sql: "sql", dockerfile: "dockerfile",
};

export const LARGE_DIFF_LINE_THRESHOLD = 5000;
export const LARGE_DIFF_FILE_THRESHOLD = 50;
export const SUBJECT_MAX = 72;
export const BODY_WRAP = 100;

export const HONESTY_NOTE =
  "AI infers intent from the diff and can miss the why — review before committing. On-device heuristics are weaker than a BYO-key LLM for nuance; keys stay client-side; nothing is uploaded or logged by us.";

export const LLM_KEY_STORAGE = "unqtools:ai-git-commit-message-generator:llm-key";
export const PRESET_STORAGE = "unqtools:ai-git-commit-message-generator:preset";

// ---------- Diff parser ----------

/** Detect a file's programming language from its extension. */
export function detectLanguage(filename: string): string {
  const base = filename.split("/").pop() ?? filename;
  if (base.toLowerCase() === "dockerfile") return "dockerfile";
  if (base.toLowerCase() === "makefile") return "makefile";
  const ext = base.includes(".") ? base.split(".").pop()!.toLowerCase() : base.toLowerCase();
  return LANGUAGE_MAP[ext] ?? "text";
}

/** Parse a unified-diff string into structured file changes. */
export function parseDiff(diff: string): ParsedDiff {
  if (!diff || !diff.trim()) {
    return {
      files: [],
      totalAdditions: 0,
      totalDeletions: 0,
      totalLines: 0,
      fileCount: 0,
      summarized: false,
    };
  }

  const lines = diff.split("\n");
  const totalLines = lines.length;
  const summarized = totalLines > LARGE_DIFF_LINE_THRESHOLD;

  const files: FileChange[] = [];
  let current: FileChange | null = null;
  let hunks = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // File header lines
    if (line.startsWith("diff --git ")) {
      // Save previous file
      if (current) {
        current.hunks = hunks;
        files.push(current);
      }
      hunks = 0;
      // Parse: "diff --git a/path b/path"
      const m = line.match(/^diff --git a\/(.+) b\/(.+)$/);
      if (m) {
        current = {
          path: m[2],
          kind: "modified",
          language: detectLanguage(m[2]),
          additions: 0,
          deletions: 0,
          hunks: 0,
          symbols: [],
        };
      } else {
        const m2 = line.match(/^diff --git (\S+) (\S+)$/);
        const path = m2 ? m2[2] : "unknown";
        current = {
          path,
          kind: "modified",
          language: detectLanguage(path),
          additions: 0,
          deletions: 0,
          hunks: 0,
          symbols: [],
        };
      }
      continue;
    }
    // Rename / new file / deleted file markers
    if (line.startsWith("rename from ")) {
      if (current) {
        current.oldPath = line.slice("rename from ".length);
        current.kind = "renamed";
      }
      continue;
    }
    if (line.startsWith("rename to ")) {
      if (current) current.kind = "renamed";
      continue;
    }
    if (line.startsWith("new file mode ")) {
      if (current) current.kind = "added";
      continue;
    }
    if (line.startsWith("deleted file mode ")) {
      if (current) current.kind = "deleted";
      continue;
    }
    // Hunk header: @@ -a,b +c,d @@ <section>
    if (line.startsWith("@@")) {
      hunks += 1;
      const sm = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+\d+(?:,\d+)?\s+@@\s*(.*)$/);
      if (sm && sm[1] && current) {
        const sym = extractSymbol(sm[1]);
        if (sym && !current.symbols.includes(sym)) {
          current.symbols.push(sym);
        }
      }
      continue;
    }
    // Count additions / deletions in hunks (must skip +++ / --- file headers)
    if (current && (line.startsWith("+") && !line.startsWith("+++"))) {
      current.additions += 1;
      // Scan added lines for new function/class declarations to enrich symbols
      const sm = line.match(/^\+\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class|def|fn|method)\s+([A-Za-z_][A-Za-z0-9_]*)/);
      if (sm && sm[1] && !current.symbols.includes(sm[1])) {
        current.symbols.push(sm[1]);
      }
    } else if (current && (line.startsWith("-") && !line.startsWith("---"))) {
      current.deletions += 1;
    }
  }
  if (current) {
    current.hunks = hunks;
    files.push(current);
  }

  const totalAdditions = files.reduce((a, f) => a + f.additions, 0);
  const totalDeletions = files.reduce((a, f) => a + f.deletions, 0);

  return {
    files,
    totalAdditions,
    totalDeletions,
    totalLines,
    fileCount: files.length,
    summarized,
  };
}

/** Extract a function / class / section name from a hunk section header. */
export function extractSymbol(section: string): string | null {
  if (!section) return null;
  // Try common patterns: "function name(", "class Name ", "def name(", "fn name(", "method name("
  const patterns: RegExp[] = [
    /\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/,
    /\bclass\s+([A-Za-z_][A-Za-z0-9_]*)\b/,
    /\bdef\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/,
    /\bfn\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/,
    /\bmethod\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/,
    /\b(?:public|private|protected|static)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/,
  ];
  for (const p of patterns) {
    const m = section.match(p);
    if (m && m[1]) return m[1];
  }
  // Fallback: first identifier-looking token
  const m2 = section.match(/\b([A-Za-z_][A-Za-z0-9_]+)\b/);
  return m2 ? m2[1] : null;
}

// ---------- Classification ----------

const PATH_TYPE_HINTS: Array<{ pattern: RegExp; type: ChangeType }> = [
  { pattern: /(^|\/)(docs?|documentation)(\/|$)/i, type: "docs" },
  { pattern: /\.(md|markdown|rst|txt)$/i, type: "docs" },
  { pattern: /(^|\/)(tests?|spec|specs|__tests?__)(\/|\.|_|-)/i, type: "test" },
  { pattern: /\.(test|spec)\.(ts|tsx|js|jsx|py|rb|go|rs|java)$/i, type: "test" },
  { pattern: /(^|\/)\.github\/workflows\//i, type: "ci" },
  { pattern: /\.(ya?ml)$/i, type: "ci" },
  { pattern: /(^|\/)(dockerfile|docker-compose)/i, type: "build" },
  { pattern: /(^|\/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|cargo\.toml|cargo\.lock|gemfile|gemfile\.lock|go\.mod|go\.sum|requirements\.txt|setup\.py|pyproject\.toml|pom\.xml|build\.gradle|build\.xml|makefile|cmakelists\.txt)/i, type: "build" },
  { pattern: /\.(css|scss|sass|less)$/i, type: "style" },
  { pattern: /(^|\/)(license|changelog|contributing|readme|authors)/i, type: "docs" },
  { pattern: /\.(json|toml|ya?ml)$/i, type: "chore" },
];

const CONTENT_TYPE_HINTS: Array<{ pattern: RegExp; type: ChangeType }> = [
  { pattern: /\bfix(ed|es)?\b/i, type: "fix" },
  { pattern: /\bbug\b/i, type: "fix" },
  { pattern: /\b(feature|add|support|implement|introduce)\b/i, type: "feat" },
  { pattern: /\b(refactor|restructure|cleanup|clean up|reorganize)\b/i, type: "refactor" },
  { pattern: /\b(perf|optimi[sz]e|speedup|faster)\b/i, type: "perf" },
  { pattern: /\btest\b/i, type: "test" },
  { pattern: /\b(document|doc|readme)\b/i, type: "docs" },
  { pattern: /\b(format|prettier|eslint|lint|whitespace)\b/i, type: "style" },
];

/** Classify the overall change type from a parsed diff + raw text. */
export function classifyChangeType(parsed: ParsedDiff, raw: string): ClassificationResult {
  const reasons: string[] = [];
  const scores: Record<ChangeType, number> = {
    feat: 0, fix: 0, docs: 0, refactor: 0, test: 0,
    chore: 0, perf: 0, style: 0, ci: 0, build: 0,
  };

  // Per-file path-based scoring. Test files are down-weighted because
  // tests often accompany features/fixes and shouldn't dominate the type.
  for (const f of parsed.files) {
    for (const hint of PATH_TYPE_HINTS) {
      if (hint.pattern.test(f.path)) {
        const weight = hint.type === "test" ? 0.4 : 1.0;
        scores[hint.type] += weight + Math.min(2, (f.additions + f.deletions) / 100);
        reasons.push(`file ${f.path} matches ${hint.type} pattern`);
        break;
      }
    }
  }

  // Strong signal: ALL files share a category
  if (parsed.files.length > 0) {
    const isTestFile = (p: string) => /\.(test|spec)\./.test(p) || /(^|\/)(tests?|spec|specs|__tests?__)(\/|\.|_|-)/i.test(p);
    const isDocFile = (p: string) => /\.(md|markdown|rst|txt)$/i.test(p) || /(^|\/)(docs?|documentation)(\/|$)/i.test(p) || /(^|\/)(license|changelog|contributing|readme|authors)/i.test(p);
    const allTest = parsed.files.every((f) => isTestFile(f.path));
    const allDocs = parsed.files.every((f) => isDocFile(f.path));
    if (allTest) {
      scores.test += 5;
      reasons.push("all files are test files → strong test signal");
    }
    if (allDocs) {
      scores.docs += 5;
      reasons.push("all files are docs → strong docs signal");
    }
  }

  // Content-based scoring: only look at added/removed body lines (skip
  // file headers / hunk headers / index lines so filenames don't dominate).
  const contentLines = raw.split("\n").filter((l) =>
    (l.startsWith("+") && !l.startsWith("+++")) ||
    (l.startsWith("-") && !l.startsWith("---")),
  ).slice(0, 500);
  const sample = contentLines.join("\n");
  for (const hint of CONTENT_TYPE_HINTS) {
    const matches = sample.match(new RegExp(hint.pattern.source, "gi"));
    if (matches) {
      scores[hint.type] += Math.min(5, matches.length);
      if (matches.length > 0) reasons.push(`content matches ${hint.type} (${matches.length}x)`);
    }
  }

  // File-kind signals
  if (parsed.files.length > 0) {
    const allAdded = parsed.files.every((f) => f.kind === "added");
    const allDeleted = parsed.files.every((f) => f.kind === "deleted");
    if (allAdded) {
      scores.feat += 2;
      reasons.push("all files newly added → feat lean");
    }
    if (allDeleted) {
      scores.chore += 1;
      scores.refactor += 1;
      reasons.push("all files deleted → cleanup/refactor lean");
    }
  }

  // Find the top type
  let best: ChangeType = "chore";
  let bestScore = -1;
  for (const t of Object.keys(scores) as ChangeType[]) {
    if (scores[t] > bestScore) {
      bestScore = scores[t];
      best = t;
    }
  }
  if (bestScore <= 0) {
    // No signals — default to chore for tiny config-only diffs, feat for net additions, fix otherwise
    best = parsed.totalAdditions > parsed.totalDeletions ? "feat" : "chore";
    reasons.push(`no strong signal — defaulting to ${best}`);
  }

  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const confidence = total > 0 ? Math.round((bestScore / total) * 100) : 0;

  return { type: best, scope: deriveScope(parsed), confidence, reasons };
}

/** Derive a sensible scope from the most common top-level directory. */
export function deriveScope(parsed: ParsedDiff): string {
  if (parsed.files.length === 0) return "";
  const GENERIC_DIRS = new Set(["src", "lib", "app", "tests", "test", "source"]);
  const dirs = parsed.files.map((f) => {
    const parts = f.path.split("/");
    if (parts.length === 1) return "root";
    if (parts.length === 2) {
      // path like "src/file.ts" → use the top dir
      return parts[0];
    }
    // path like "src/parser/file.ts" → use "parser" (skip generic dirs)
    const meaningful = parts.slice(0, -1).filter((p) => !GENERIC_DIRS.has(p.toLowerCase()));
    return meaningful.length > 0 ? meaningful[0] : parts[0];
  });
  // Pick most common
  const counts: Record<string, number> = {};
  for (const d of dirs) counts[d] = (counts[d] ?? 0) + 1;
  let best = "";
  let bestCount = 0;
  for (const [d, c] of Object.entries(counts)) {
    if (c > bestCount) {
      best = d;
      bestCount = c;
    }
  }
  // Normalize: lowercase, kebab-case, strip non-alphanumerics
  return best.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);
}

// ---------- Breaking change + issue refs ----------

/** Detect breaking-change markers. */
export function detectBreakingChange(raw: string, parsed: ParsedDiff): BreakingChangeInfo {
  // 1. Explicit "BREAKING CHANGE:" or "BREAKING-CHANGE:" footer
  const m = raw.match(/BREAKING[- ]CHANGE:\s*(.+)/i);
  if (m) return { isBreaking: true, reason: m[1].trim().slice(0, 200) };
  // 2. "!:" marker in commit-like text within the diff
  if (/^[a-z]+(\([^)]+\))?!:/im.test(raw)) {
    return { isBreaking: true, reason: "Commit subject contains a ! suffix indicating a breaking API change." };
  }
  // 3. Deleted public exports (heuristic: removed "export " or "def " or "func " or "public " lines)
  const removedExports: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("-") && !line.startsWith("---")) {
      const em = line.match(/^-\s*(export\s+(default\s+)?(function|class|const|let|var)\s+[A-Za-z_][A-Za-z0-9_]*)/);
      if (em) removedExports.push(em[1]);
    }
  }
  if (removedExports.length > 0) {
    return {
      isBreaking: true,
      reason: `Removed public exports: ${removedExports.slice(0, 3).join(", ")}${removedExports.length > 3 ? "…" : ""}`,
    };
  }
  return { isBreaking: false, reason: "" };
}

/** Extract issue references like #123, ABC-123, GH-456. */
export function extractIssueRefs(raw: string, parsed: ParsedDiff): string[] {
  const refs = new Set<string>();
  // GitHub-style #123
  const gh = raw.match(/(?:^|\s|#)issue\s+\d+|(?:fixes|closes|resolves|refs|see)\s+#?\d+|#\d+/gi);
  if (gh) for (const r of gh) {
    const m = r.match(/#?(\d+)/);
    if (m) refs.add(`#${m[1]}`);
  }
  // JIRA-style ABC-123
  const jira = raw.match(/\b[A-Z][A-Z0-9]+-\d+\b/g);
  if (jira) for (const r of jira) refs.add(r);
  return Array.from(refs).slice(0, 10);
}

// ---------- Subject + body + footer generation ----------

export interface CommitOptions {
  style: CommitStyle;
  /** Optional manual override of the change type. */
  typeOverride?: ChangeType;
  /** Optional manual override of the scope. */
  scopeOverride?: string;
  /** Optional manual subject override (skips generation). */
  subjectOverride?: string;
  /** Include body paragraph. */
  includeBody?: boolean;
  /** Include footer (issue refs + breaking change). */
  includeFooter?: boolean;
  /** Wrap body at BODY_WRAP columns. */
  wrapBody?: boolean;
}

/** Generate a concise subject line from the parsed diff. */
export function generateSubject(parsed: ParsedDiff, classification: ClassificationResult): string {
  if (parsed.files.length === 0) return "update code";
  const topFile = parsed.files[0];
  const symbols = topFile.symbols.length > 0 ? topFile.symbols.slice(0, 2) : [];

  // Build a verb phrase by change type
  let verb: string;
  switch (classification.type) {
    case "feat":
      verb = parsed.files.every((f) => f.kind === "added") ? "add" : "introduce";
      break;
    case "fix":
      verb = "fix";
      break;
    case "docs":
      verb = "document";
      break;
    case "refactor":
      verb = "refactor";
      break;
    case "test":
      verb = "test";
      break;
    case "chore":
      verb = "update";
      break;
    case "perf":
      verb = "optimize";
      break;
    case "style":
      verb = "format";
      break;
    case "ci":
      verb = "update CI for";
      break;
    case "build":
      verb = "update build for";
      break;
    default:
      verb = "update";
  }

  // Object: function name if available, else file basename, else directory
  let object: string;
  if (symbols.length > 0) {
    object = symbols.join(" and ");
  } else if (parsed.files.length === 1) {
    const base = topFile.path.split("/").pop() ?? topFile.path;
    object = base.replace(/\.[^.]+$/, "");
  } else {
    // Group by top dir
    const dirs = new Set(parsed.files.map((f) => f.path.split("/")[0] ?? "root"));
    object = dirs.size === 1 ? Array.from(dirs)[0] : `${parsed.files.length} files`;
  }

  // Special phrasing per type
  let subject: string;
  switch (classification.type) {
    case "feat":
      subject = `${verb} ${object}${symbols.length > 0 ? "" : parsed.files.length === 1 ? "" : ""}`;
      break;
    case "fix":
      subject = `${verb} ${symbols.length > 0 ? `bug in ${object}` : object}`;
      break;
    case "test":
      subject = `${verb} ${object}`;
      break;
    case "refactor":
      subject = `${verb} ${object}`;
      break;
    case "docs":
      subject = `${verb} ${object}`;
      break;
    case "perf":
      subject = `${verb} ${object}`;
      break;
    case "style":
      subject = `${verb} ${object}`;
      break;
    default:
      subject = `${verb} ${object}`;
  }

  // Pluralize for multi-file
  if (parsed.files.length > 1 && !symbols.length) {
    // Keep singular noun
  }

  // Cap at SUBJECT_MAX - (type + scope + ": ") overhead
  const maxObj = SUBJECT_MAX - 20;
  if (subject.length > maxObj) subject = subject.slice(0, maxObj - 1).trimEnd();

  return subject;
}

/** Generate a body paragraph summarizing the change. */
export function generateBody(parsed: ParsedDiff, classification: ClassificationResult, raw: string): string {
  const lines: string[] = [];
  // Summary line
  lines.push(
    `${parsed.fileCount} file${parsed.fileCount === 1 ? "" : "s"} changed, ` +
    `+${parsed.totalAdditions} −${parsed.totalDeletions} lines ` +
    `(${classification.confidence}% confidence on type=${classification.type}).`,
  );
  // Top files
  if (parsed.files.length > 0) {
    lines.push("");
    lines.push("Files:");
    for (const f of parsed.files.slice(0, 6)) {
      const sym = f.symbols.length > 0 ? ` (${f.symbols.slice(0, 2).join(", ")})` : "";
      lines.push(`- ${f.kind} ${f.path}${sym}  +${f.additions} −${f.deletions}`);
    }
    if (parsed.files.length > 6) lines.push(`- … and ${parsed.files.length - 6} more`);
  }
  // Reason hints (top 3)
  if (classification.reasons.length > 0) {
    lines.push("");
    lines.push("Why this type:");
    for (const r of classification.reasons.slice(0, 3)) lines.push(`- ${r}`);
  }
  if (parsed.summarized) {
    lines.push("");
    lines.push("> Note: large diff was summarized — review the body for accuracy.");
  }
  return lines.join("\n");
}

/** Generate the footer (issue refs + breaking change). */
export function generateFooter(issueRefs: string[], breaking: BreakingChangeInfo): string {
  const lines: string[] = [];
  if (breaking.isBreaking) {
    lines.push(`BREAKING CHANGE: ${breaking.reason}`);
  }
  if (issueRefs.length > 0) {
    lines.push(`Refs: ${issueRefs.join(", ")}`);
  }
  return lines.join("\n");
}

/** Assemble the full commit message in the chosen style. */
export function generateCommit(diff: string, options: CommitOptions): CommitMessage {
  const warnings: string[] = [];
  const parsed = parseDiff(diff);
  if (parsed.fileCount === 0) {
    warnings.push("No files detected in the diff — paste a `git diff` output.");
  }
  const classification = classifyChangeType(parsed, diff);
  const type = options.typeOverride ?? classification.type;
  const scope = (options.scopeOverride ?? classification.scope).trim();
  const subject = (options.subjectOverride ?? generateSubject(parsed, classification)).trim();
  const breaking = detectBreakingChange(diff, parsed);
  const issueRefs = extractIssueRefs(diff, parsed);

  const body = options.includeBody !== false
    ? generateBody(parsed, classification, diff)
    : "";
  const footer = options.includeFooter !== false
    ? generateFooter(issueRefs, breaking)
    : "";

  const full = assembleFull({
    type, scope, subject, body, footer, isBreaking: breaking.isBreaking,
    style: options.style, wrapBody: options.wrapBody ?? true,
  });

  // Validate
  const report = validateConventional(full);
  if (!report.valid && options.style !== "plain") {
    warnings.push(...report.errors);
  }
  if (parsed.summarized) {
    warnings.push("Large diff was summarized — verify the subject and body are accurate.");
  }

  return {
    type, scope, subject, body, footer,
    isBreaking: breaking.isBreaking,
    issueRefs,
    style: options.style,
    full,
    warnings,
    generatedAt: Date.now(),
  };
}

interface AssembleArgs {
  type: ChangeType;
  scope: string;
  subject: string;
  body: string;
  footer: string;
  isBreaking: boolean;
  style: CommitStyle;
  wrapBody: boolean;
}

/** Assemble the final multi-line message string in the chosen style. */
export function assembleFull(args: AssembleArgs): string {
  const { type, scope, subject, body, footer, isBreaking, style, wrapBody } = args;
  const breakingMark = isBreaking ? "!" : "";
  const scopePart = scope ? `(${scope})` : "";
  const lines: string[] = [];

  if (style === "plain") {
    // Plain: imperative sentence, capitalized, no prefix
    lines.push(capitalize(subject));
  } else if (style === "gitmoji") {
    const emoji = GITMOJI_MAP[type] ?? "";
    lines.push(`${emoji} ${type}${scopePart}${breakingMark}: ${subject}`);
  } else {
    // conventional or conventional-body
    lines.push(`${type}${scopePart}${breakingMark}: ${subject}`);
  }

  if ((style === "conventional-body" || style === "gitmoji") && body) {
    lines.push("");
    lines.push(wrapBody ? wrapText(body, BODY_WRAP) : body);
  }
  if (footer) {
    lines.push("");
    lines.push(footer);
  }
  return lines.join("\n");
}

// ---------- Validator ----------

/** Validate a commit message against the Conventional Commits spec. */
export function validateConventional(message: string): ValidationReport {
  const errors: string[] = [];
  if (!message || !message.trim()) {
    return { valid: false, errors: ["Message is empty."] };
  }
  const firstLine = message.split("\n")[0];
  // Skip plain-style messages (no type prefix)
  if (!/^[a-z]+(\([^)]+\))?(!)?:\s+/.test(firstLine)) {
    // Allow plain sentences (capitalized, no prefix) — only fail if it LOOKS conventional but is malformed
    if (/^[a-z]/.test(firstLine) && !firstLine.includes(":")) {
      errors.push("Subject line does not follow Conventional Commits format `type(scope): subject`.");
    }
  } else {
    // Type must be a known type
    const typeMatch = firstLine.match(/^([a-z]+)(?:\([^)]+\))?(!)?:/);
    if (typeMatch) {
      const knownTypes: ChangeType[] = ["feat", "fix", "docs", "refactor", "test", "chore", "perf", "style", "ci", "build"];
      if (!knownTypes.includes(typeMatch[1] as ChangeType)) {
        errors.push(`Type "${typeMatch[1]}" is not a recognized Conventional Commits type.`);
      }
    }
  }
  // Subject length
  if (firstLine.length > SUBJECT_MAX) {
    errors.push(`Subject line is ${firstLine.length} chars (max ${SUBJECT_MAX}).`);
  }
  // Subject should be lowercase imperative (skip if plain style capitalized)
  // Blank line between subject and body
  const lines = message.split("\n");
  if (lines.length > 1 && lines[1] !== "") {
    errors.push("Missing blank line between subject and body.");
  }
  // Footer separation
  for (let i = 2; i < lines.length - 1; i++) {
    if (lines[i] === "" && /^(BREAKING[- ]CHANGE:|Refs:|Reviewed-by:|Co-authored-by:|Signed-off-by:)/.test(lines[i + 1])) {
      // OK — footer separator
      break;
    }
  }
  return { valid: errors.length === 0, errors };
}

// ---------- Large-diff chunking ----------

/** Split a large diff into chunks of approximately maxLines each. */
export function chunkLargeDiff(diff: string, maxLines: number = 1000): string[] {
  if (!diff) return [];
  const lines = diff.split("\n");
  if (lines.length <= maxLines) return [diff];
  const chunks: string[] = [];
  let i = 0;
  while (i < lines.length) {
    // Try to break at a "diff --git" boundary
    let end = Math.min(i + maxLines, lines.length);
    if (end < lines.length) {
      // Search backwards for a file boundary
      for (let j = end; j > i; j--) {
        if (lines[j].startsWith("diff --git ")) {
          end = j;
          break;
        }
      }
    }
    chunks.push(lines.slice(i, end).join("\n"));
    i = end;
  }
  return chunks;
}

/** Summarize a chunk into a compact descriptor. */
export function summarizeChunk(chunk: string): ChunkSummary {
  const parsed = parseDiff(chunk);
  const topPaths = parsed.files
    .slice()
    .sort((a, b) => (b.additions + b.deletions) - (a.additions + a.deletions))
    .slice(0, 5)
    .map((f) => f.path);
  const topSymbols = Array.from(new Set(parsed.files.flatMap((f) => f.symbols))).slice(0, 8);
  return {
    fileCount: parsed.fileCount,
    additions: parsed.totalAdditions,
    deletions: parsed.totalDeletions,
    topPaths,
    topSymbols,
  };
}

/** Map-reduce: summarize a large diff by chunking then combining summaries. */
export function summarizeLargeDiff(diff: string, maxLines: number = 1000): ChunkSummary {
  const chunks = chunkLargeDiff(diff, maxLines);
  if (chunks.length === 0) {
    return { fileCount: 0, additions: 0, deletions: 0, topPaths: [], topSymbols: [] };
  }
  const summaries = chunks.map(summarizeChunk);
  const topPaths = Array.from(new Set(summaries.flatMap((s) => s.topPaths))).slice(0, 10);
  const topSymbols = Array.from(new Set(summaries.flatMap((s) => s.topSymbols))).slice(0, 12);
  return {
    fileCount: summaries.reduce((a, s) => a + s.fileCount, 0),
    additions: summaries.reduce((a, s) => a + s.additions, 0),
    deletions: summaries.reduce((a, s) => a + s.deletions, 0),
    topPaths,
    topSymbols,
  };
}

// ---------- Hook snippet ----------

/** Generate a prepare-commit-msg hook snippet that wires this tool into git. */
export function generateHookSnippet(toolUrl: string = "https://unqtools.local/tools/ai-git-commit-message-generator"): string {
  return [
    "#!/usr/bin/env bash",
    "# prepare-commit-msg hook — generates a Conventional Commits message",
    "# Install: cp this file to .git/hooks/prepare-commit-msg && chmod +x .git/hooks/prepare-commit-msg",
    "# Or: add to your core.hooksPath",
    "",
    "set -euo pipefail",
    "",
    "COMMIT_MSG_FILE=\"$1\"",
    "COMMIT_SOURCE=\"${2:-}\"",
    "",
    "# Skip for merge / squash / amend",
    "case \"$COMMIT_SOURCE\" in",
    "  merge|squash|commit|template|message)",
    "    exit 0",
    "    ;;",
    "esac",
    "",
    "# Get staged diff",
    "DIFF=\"$(git diff --cached)\"",
    "if [ -z \"$DIFF\" ]; then",
    "  exit 0",
    "fi",
    "",
    "# If the user already wrote a message, leave it alone",
    "if [ -s \"$COMMIT_MSG_FILE\" ] && ! head -1 \"$COMMIT_MSG_FILE\" | grep -q '^$'; then",
    "  exit 0",
    "fi",
    "",
    "# Open the browser-based generator with the diff in the clipboard",
    `# Tool: ${toolUrl}`,
    "echo \"$DIFF\" | pbcopy 2>/dev/null || echo \"$DIFF\" | xclip -selection clipboard 2>/dev/null || true",
    "echo \"[ai-commit] Diff copied to clipboard. Paste it at: ${toolUrl}\" >&2",
    "echo \"[ai-commit] Then paste the generated message here and save.\" >&2",
    "exit 0",
  ].join("\n");
}

// ---------- Renderers ----------

export function renderText(msg: CommitMessage): string {
  return msg.full;
}

export function renderMarkdown(msg: CommitMessage): string {
  const lines: string[] = [];
  lines.push("### Commit message");
  lines.push("");
  lines.push("```");
  lines.push(msg.full);
  lines.push("```");
  lines.push("");
  lines.push(`**Type:** ${msg.type}  `);
  if (msg.scope) lines.push(`**Scope:** ${msg.scope}  `);
  lines.push(`**Style:** ${STYLE_LABELS[msg.style]}  `);
  lines.push(`**Breaking:** ${msg.isBreaking ? "yes" : "no"}  `);
  if (msg.issueRefs.length > 0) lines.push(`**Refs:** ${msg.issueRefs.join(", ")}  `);
  if (msg.warnings.length > 0) {
    lines.push("");
    lines.push("**Warnings:**");
    for (const w of msg.warnings) lines.push(`- ${w}`);
  }
  return lines.join("\n");
}

export function renderJson(msg: CommitMessage): string {
  return JSON.stringify(msg, null, 2);
}

// ---------- History (localStorage) ----------

const HISTORY_KEY = "unqtools:ai-git-commit-message-generator:history";
export const HISTORY_MAX = 20;

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

// ---------- Preset (localStorage) ----------

export interface TeamPreset {
  scope: string;
  style: CommitStyle;
  includeBody: boolean;
  includeFooter: boolean;
  wrapBody: boolean;
}

export function loadPreset(): TeamPreset | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(PRESET_STORAGE);
    if (!raw) return null;
    return JSON.parse(raw) as TeamPreset;
  } catch {
    return null;
  }
}

export function savePreset(preset: TeamPreset): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PRESET_STORAGE, JSON.stringify(preset));
  } catch {
    // ignore
  }
}

export function clearPreset(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(PRESET_STORAGE);
  } catch {
    // ignore
  }
}

// ---------- Shareable URL ----------

export interface ShareState {
  style: CommitStyle;
  typeOverride?: ChangeType;
  scopeOverride?: string;
  includeBody: boolean;
  includeFooter: boolean;
}

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  params.set("style", state.style);
  if (state.typeOverride) params.set("type", state.typeOverride);
  if (state.scopeOverride) params.set("scope", state.scopeOverride);
  params.set("body", state.includeBody ? "1" : "0");
  params.set("footer", state.includeFooter ? "1" : "0");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState | null {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return null;
  const params = new URLSearchParams(clean);
  const style = (params.get("style") as CommitStyle) ?? "conventional";
  const knownStyles: CommitStyle[] = ["conventional", "conventional-body", "gitmoji", "plain"];
  if (!knownStyles.includes(style)) return null;
  const typeStr = params.get("type");
  const knownTypes: ChangeType[] = ["feat", "fix", "docs", "refactor", "test", "chore", "perf", "style", "ci", "build"];
  const typeOverride = typeStr && knownTypes.includes(typeStr as ChangeType) ? (typeStr as ChangeType) : undefined;
  const scopeOverride = params.get("scope") ?? undefined;
  const includeBody = params.get("body") !== "0";
  const includeFooter = params.get("footer") !== "0";
  return { style, typeOverride, scopeOverride, includeBody, includeFooter };
}

// ---------- LLM prompt (BYO-key; the call itself lives in ui.tsx) ----------

export function buildLlmPrompt(parsed: ParsedDiff, classification: ClassificationResult, raw: string): string {
  const lines: string[] = [];
  lines.push("You are a senior engineer writing a Conventional Commits message. From the diff below, generate:");
  lines.push("1. A subject line in the form `type(scope): imperative subject` (max 72 chars)");
  lines.push("2. A body paragraph (wrapped at 100 cols) explaining what and why");
  lines.push("3. A footer with `BREAKING CHANGE:` (if any) and `Refs:` (issue numbers)");
  lines.push("");
  lines.push(`Suggested type: ${classification.type} (confidence ${classification.confidence}%)`);
  lines.push(`Suggested scope: ${classification.scope || "(none)"}`);
  lines.push(`Files changed: ${parsed.fileCount}`);
  lines.push(`Additions: +${parsed.totalAdditions}  Deletions: -${parsed.totalDeletions}`);
  lines.push("");
  lines.push("Top files:");
  for (const f of parsed.files.slice(0, 8)) {
    lines.push(`  ${f.kind} ${f.path}  +${f.additions} −${f.deletions}`);
  }
  lines.push("");
  lines.push("Diff (first 3000 lines):");
  lines.push("```diff");
  lines.push(raw.split("\n").slice(0, 3000).join("\n"));
  lines.push("```");
  return lines.join("\n");
}

export interface LlmEnhancement {
  message: string;
  raw: string;
  model: string;
}

/** Parse an LLM response into a commit message string. */
export function parseLlmResult(raw: string, model: string): LlmEnhancement {
  // Try to extract a code block
  const m = raw.match(/```(?:\w+)?\n([\s\S]+?)\n```/);
  const message = m ? m[1].trim() : raw.trim();
  return { message, raw, model };
}

export function renderLlmResult(en: LlmEnhancement): string {
  const lines: string[] = [];
  lines.push(`LLM-polished message (model: ${en.model}):`);
  lines.push("");
  lines.push("```");
  lines.push(en.message);
  lines.push("```");
  return lines.join("\n");
}

// ---------- Helpers ----------

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function wrapText(text: string, width: number): string {
  return text
    .split("\n")
    .map((line) => {
      if (line.startsWith("- ") || line.startsWith("> ") || line.length <= width) return line;
      const words = line.split(/\s+/);
      const out: string[] = [];
      let cur = "";
      for (const w of words) {
        if ((cur + " " + w).trim().length > width) {
          if (cur) out.push(cur);
          cur = w;
        } else {
          cur = (cur + " " + w).trim();
        }
      }
      if (cur) out.push(cur);
      return out.join("\n");
    })
    .join("\n");
}
