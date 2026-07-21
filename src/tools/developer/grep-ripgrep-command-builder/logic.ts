/**
 * grep / ripgrep Command Builder — pure logic.
 *
 * Build grep and ripgrep (rg) commands side-by-side from a visual UI
 * config, test the pattern against sample text live with the correct
 * regex flavor, explain each flag in plain English, and provide a
 * translation table between grep and rg semantics.
 *
 * Pure functions only — no DOM, no network.
 */

// ---- Types ----

export type RegexFlavor = "bre" | "ere" | "pcre" | "rust";

export interface BuilderConfig {
  pattern: string;
  flavor: RegexFlavor;
  ignoreCase: boolean;
  wholeWord: boolean;
  invert: boolean;
  count: boolean;
  lineNumbers: boolean;
  recursive: boolean;
  fixedString: boolean;
  onlyMatching: boolean;
  multiline: boolean;
  noFiltering: boolean; // rg -uuu / grep -a
  includes: string[];
  excludes: string[];
  excludeDirs: string[];
  rgType: string; // rg -t <type>
  rgTypeNot: string; // rg -T <type>
  contextBefore: number; // -B
  contextAfter: number; // -A
  contextBoth: number; // -C (overrides A/B if >0)
  replace: string; // rg --replace (preview only)
  paths: string[];
}

export interface BuiltCommand {
  command: string;
  notes: string[];
}

export interface BuiltCommands {
  grep: BuiltCommand;
  rg: BuiltCommand;
}

export interface FlagExplanation {
  flag: string;
  tool: "grep" | "rg" | "both";
  explanation: string;
}

export interface TranslationEntry {
  intent: string;
  grep: string;
  rg: string;
  notes: string;
}

export interface MatchResult {
  ok: boolean;
  matches: { line: number; text: string; ranges: [number, number][] }[];
  error?: string;
  count: number;
}

export interface Recipe {
  id: string;
  label: string;
  description: string;
  config: Partial<BuilderConfig>;
  sample: string;
}

export interface SampleText {
  id: string;
  label: string;
  text: string;
}

export interface HistoryEntry {
  ts: number;
  pattern: string;
  flavor: RegexFlavor;
  matchCount: number;
}

// ---- Constants ----

export const DEFAULT_CONFIG: BuilderConfig = {
  pattern: "TODO",
  flavor: "ere",
  ignoreCase: false,
  wholeWord: false,
  invert: false,
  count: false,
  lineNumbers: true,
  recursive: true,
  fixedString: false,
  onlyMatching: false,
  multiline: false,
  noFiltering: false,
  includes: [],
  excludes: [],
  excludeDirs: [],
  rgType: "",
  rgTypeNot: "",
  contextBefore: 0,
  contextAfter: 0,
  contextBoth: 0,
  replace: "",
  paths: ["."],
};

export const FLAVOR_LABELS: Record<RegexFlavor, string> = {
  bre: "BRE (basic — grep default)",
  ere: "ERE (extended — grep -E / egrep)",
  pcre: "PCRE (Perl — grep -P, GNU only)",
  rust: "Rust regex (rg default)",
};

export const FLAVOR_HINTS: Record<RegexFlavor, string> = {
  bre: 'Default grep. Metacharacters ?+(){}| are literal — escape with backslash. Use \\( \\) for groups, \\{ \\} for repetition.',
  ere: 'grep -E or egrep. Metacharacters () {} + ? | work without backslash. Escape to make literal. Closer to modern regex.',
  pcre: 'grep -P. Full Perl-compatible regex: \\d \\w \\s, lookahead/lookbehind, named groups. GNU grep only — NOT on BSD/macOS by default.',
  rust: 'rg default. Rust regex crate. Unicode-aware by default. Supports \\d \\w \\s, look-around via regex crate 2.x optional. Fastest.',
};

export const SAMPLE_TEXTS: SampleText[] = [
  {
    id: "log",
    label: "Server log",
    text: `2026-01-15 09:14:22 INFO  worker[1234] starting up
2026-01-15 09:14:23 DEBUG worker[1234] connected to db
2026-01-15 09:15:01 ERROR worker[1234] TODO: retry logic for timeout
2026-01-15 09:15:42 WARN  worker[1234] slow query (1243ms)
2026-01-15 09:16:10 ERROR worker[1234] connection refused
2026-01-15 09:17:00 INFO  worker[1234] retrying (1/3)
2026-01-15 09:18:33 TODO  worker[1234] add metrics export`,
  },
  {
    id: "code",
    label: "Source code (Python)",
    text: `def fetch_user(user_id):
    # TODO: add caching layer
    user = db.query(User, user_id)
    if not user:
        return None
    return user

def update_user(user_id, payload):
    # FIXME: validation missing
    user = fetch_user(user_id)
    if not user:
        raise NotFoundError("user not found")
    user.update(payload)
    db.commit()
    return user`,
  },
  {
    id: "csv",
    label: "CSV",
    text: `id,name,email,role
1,Alice Brown,alice@example.com,admin
2,Bob Smith,bob@example.com,user
3,Charlie Lee,charlie@example.com,user
4,Dana White,dana@example.com,admin`,
  },
  {
    id: "config",
    label: "INI config",
    text: `[server]
host = 0.0.0.0
port = 8080
debug = false

[database]
url = postgres://localhost:5432/app
pool_size = 10
timeout = 5000`,
  },
];

export const RECIPES: Recipe[] = [
  {
    id: "case-insensitive-todo",
    label: "Find TODO (case-insensitive)",
    description: "Search for TODO/Todo/todo in current dir recursively.",
    config: {
      pattern: "TODO",
      flavor: "ere",
      ignoreCase: true,
      recursive: true,
      lineNumbers: true,
      paths: ["."],
    },
    sample: SAMPLE_TEXTS[1].text,
  },
  {
    id: "whole-word-error",
    label: "Whole-word 'error' in logs",
    description: "Match 'error' as a whole word, not 'errors' or 'errored'.",
    config: {
      pattern: "error",
      flavor: "ere",
      ignoreCase: true,
      wholeWord: true,
      recursive: false,
      lineNumbers: true,
      paths: ["app.log"],
    },
    sample: SAMPLE_TEXTS[0].text,
  },
  {
    id: "python-files-only",
    label: "Search only .py files",
    description: "Recursive search restricted to Python files via include glob.",
    config: {
      pattern: "def ",
      flavor: "ere",
      recursive: true,
      lineNumbers: true,
      includes: ["*.py"],
      paths: ["."],
    },
    sample: SAMPLE_TEXTS[1].text,
  },
  {
    id: "exclude-node-modules",
    label: "Exclude node_modules",
    description: "Recursive search but skip the node_modules and .git dirs.",
    config: {
      pattern: "console.log",
      flavor: "ere",
      recursive: true,
      lineNumbers: true,
      excludeDirs: ["node_modules", ".git"],
      paths: ["."],
    },
    sample: SAMPLE_TEXTS[1].text,
  },
  {
    id: "context-lines",
    label: "Context: 2 lines before+after",
    description: "Show 2 lines of context around each match with -C 2.",
    config: {
      pattern: "ERROR",
      flavor: "ere",
      recursive: false,
      contextBoth: 2,
      lineNumbers: true,
      paths: ["app.log"],
    },
    sample: SAMPLE_TEXTS[0].text,
  },
  {
    id: "invert-match",
    label: "Lines NOT matching",
    description: "Print lines that do NOT match (invert).",
    config: {
      pattern: "^#",
      flavor: "ere",
      invert: true,
      lineNumbers: true,
      paths: ["config.ini"],
    },
    sample: SAMPLE_TEXTS[3].text,
  },
  {
    id: "count-matches",
    label: "Count matches per file",
    description: "Print only the match count (-c).",
    config: {
      pattern: "ERROR",
      flavor: "ere",
      count: true,
      recursive: true,
      paths: ["."],
    },
    sample: SAMPLE_TEXTS[0].text,
  },
  {
    id: "fixed-string-ip",
    label: "Fixed-string search (IP)",
    description: "Treat pattern as a literal string — dots don't match anything.",
    config: {
      pattern: "192.168.1.1",
      flavor: "bre",
      fixedString: true,
      lineNumbers: true,
      paths: ["access.log"],
    },
    sample: "192.168.1.1 - - [15/Jan/2026:09:14:22] GET /",
  },
  {
    id: "pcre-digits",
    label: "PCRE: \\d+ numbers",
    description: "Use grep -P for \\d shortcut. Falls back to rg automatically.",
    config: {
      pattern: "\\d+",
      flavor: "pcre",
      lineNumbers: true,
      onlyMatching: true,
      paths: ["data.txt"],
    },
    sample: "lines 12 and 348 contain 7 numbers in 99 places",
  },
  {
    id: "multiline-block",
    label: "Multiline block (rg -U)",
    description: "Use ripgrep multiline mode to match across newlines.",
    config: {
      pattern: "def fetch_user\\(.*?\\):.*?return user",
      flavor: "rust",
      multiline: true,
      recursive: false,
      paths: ["app.py"],
    },
    sample: SAMPLE_TEXTS[1].text,
  },
];

export const TRANSLATION_TABLE: TranslationEntry[] = [
  {
    intent: "Ignore case",
    grep: "-i",
    rg: "-i",
    notes: "Same in both tools.",
  },
  {
    intent: "Whole word",
    grep: "-w",
    rg: "-w",
    notes: "Same — anchors to word boundaries (\\b).",
  },
  {
    intent: "Invert match",
    grep: "-v",
    rg: "-v",
    notes: "Same — print non-matching lines.",
  },
  {
    intent: "Count only",
    grep: "-c",
    rg: "-c",
    notes: "Same — per-file count when recursive.",
  },
  {
    intent: "Line numbers",
    grep: "-n",
    rg: "-n",
    notes: "rg prints line numbers by default when searching stdin/tty.",
  },
  {
    intent: "Recursive",
    grep: "-r (or -R for symlink-follow)",
    rg: "(default)",
    notes: "rg searches recursively by default. Use -g '!dir' to skip dirs.",
  },
  {
    intent: "Fixed string (literal)",
    grep: "-F (fgrep)",
    rg: "-F / --fixed-strings",
    notes: "Same — disables regex interpretation.",
  },
  {
    intent: "Only matching part",
    grep: "-o",
    rg: "-o",
    notes: "Same — print only the matched substring.",
  },
  {
    intent: "Extended regex (ERE)",
    grep: "-E (egrep)",
    rg: "(default)",
    notes: "rg is ERE-like by default. grep needs -E for + ? | ( ) { }.",
  },
  {
    intent: "PCRE (Perl)",
    grep: "-P (GNU only)",
    rg: "-P (optional, on by default for some features)",
    notes: "grep -P unavailable on BSD/macOS. rg uses Rust regex by default which is PCRE-ish.",
  },
  {
    intent: "Include glob",
    grep: "--include='*.py'",
    rg: "-g '*.py' / -t py",
    notes: "grep's --include matches basename. rg's -g is gitignore-style; -t uses built-in types.",
  },
  {
    intent: "Exclude glob",
    grep: "--exclude='*.log'",
    rg: "-g '!*.log'",
    notes: "rg uses leading ! to negate a glob.",
  },
  {
    intent: "Exclude dir",
    grep: "--exclude-dir=node_modules",
    rg: "-g '!node_modules/**'",
    notes: "rg can also skip via .gitignore; -uu to disable.",
  },
  {
    intent: "Context after",
    grep: "-A N",
    rg: "-A N",
    notes: "Same — N lines of trailing context.",
  },
  {
    intent: "Context before",
    grep: "-B N",
    rg: "-B N",
    notes: "Same — N lines of leading context.",
  },
  {
    intent: "Context both",
    grep: "-C N",
    rg: "-C N",
    notes: "Same — N lines on each side.",
  },
  {
    intent: "Multiline match",
    grep: "-Pzo (PCRE multiline, GNU)",
    rg: "-U / --multiline",
    notes: "grep -z uses NUL separator. rg -U enables \\. to match \\n.",
  },
  {
    intent: "No filtering (search everything)",
    grep: "-a -r",
    rg: "-uuu",
    notes: "rg -u = hidden, -uu = +gitignore, -uuu = +binary. grep -a forces binary as text.",
  },
  {
    intent: "Replace (preview only)",
    grep: "n/a (use sed)",
    rg: "-r 'replacement' / --replace",
    notes: "rg can preview replacements inline. grep cannot — pipe to sed.",
  },
];

// ---- Shell quoting ----

/** Shell-quote a string for safe inclusion in a command. Single-quoted. */
export function shellQuote(s: string): string {
  if (s === "") return "''";
  // If the string is "safe" (alphanumerics + a few punctuation chars), no quoting needed.
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(s)) return s;
  // Wrap in single quotes, escape any embedded single quotes via '\''.
  return `'${s.replace(/'/g, "'\\''")}'`;
}

// ---- Pattern → JS RegExp (per flavor) ----

/** Convert a BRE pattern to a JS-compatible regex source (approximate). */
export function breToJsSource(pattern: string): string {
  // In BRE, these are special only when escaped: \? \+ \{ \} \( \) \|
  // In JS, ?+(){}| are special UNLESS escaped.
  // Strategy: scan, when we see \? \+ \{ \} \( \) \| convert to unescaped form.
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "\\" && i + 1 < pattern.length) {
      const next = pattern[i + 1];
      if (next === "?" || next === "+" || next === "{" || next === "}" || next === "(" || next === ")" || next === "|") {
        out += next; // unescape — BRE escaped metachar becomes JS metachar
        i++;
      } else {
        out += "\\" + next;
        i++;
      }
    } else if (ch === "?" || ch === "+" || ch === "{" || ch === "}" || ch === "(" || ch === ")" || ch === "|") {
      // In BRE these are literal — escape them in JS.
      out += "\\" + ch;
    } else {
      out += ch;
    }
  }
  return out;
}

/** ERE → JS: nearly identical syntax. Pass through, escape any non-meta backslashes carefully. */
export function ereToJsSource(pattern: string): string {
  // ERE is close to JS regex. \d \w \s are NOT in POSIX ERE (those are PCRE),
  // but JS supports them. For testing purposes, pass through.
  return pattern;
}

/** PCRE → JS: pass through; JS supports most PCRE features. */
export function pcreToJsSource(pattern: string): string {
  return pattern;
}

/** Rust regex → JS: pass through; Rust regex is close to JS. */
export function rustToJsSource(pattern: string): string {
  // Rust regex doesn't support backreferences by default; JS does. Approximation.
  return pattern;
}

/** Convert a pattern in the given flavor to a JS RegExp source string. */
export function flavorToJsSource(pattern: string, flavor: RegexFlavor): string {
  switch (flavor) {
    case "bre": return breToJsSource(pattern);
    case "ere": return ereToJsSource(pattern);
    case "pcre": return pcreToJsSource(pattern);
    case "rust": return rustToJsSource(pattern);
  }
}

/** Build a JS RegExp for live testing. Returns null on invalid pattern. */
export function buildTestRegex(
  pattern: string,
  flavor: RegexFlavor,
  opts: { ignoreCase?: boolean; wholeWord?: boolean; multiline?: boolean; fixedString?: boolean } = {},
): RegExp | null {
  if (!pattern) return null;
  try {
    let src: string;
    if (opts.fixedString) {
      src = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    } else {
      src = flavorToJsSource(pattern, flavor);
    }
    if (opts.wholeWord) src = `\\b${src}\\b`;
    let flags = "g";
    if (opts.ignoreCase) flags += "i";
    if (opts.multiline) flags += "s"; // dotall — \n matches .
    return new RegExp(src, flags);
  } catch {
    return null;
  }
}

// ---- Live match ----

/** Run the pattern against sample text, returning per-line matches with ranges. */
export function runMatch(
  pattern: string,
  text: string,
  config: Partial<BuilderConfig>,
): MatchResult {
  if (!pattern) return { ok: true, matches: [], count: 0 };
  const flavor = config.flavor ?? "ere";
  const re = buildTestRegex(pattern, flavor, {
    ignoreCase: config.ignoreCase,
    wholeWord: config.wholeWord,
    multiline: config.multiline,
    fixedString: config.fixedString,
  });
  if (!re) {
    return { ok: false, matches: [], error: `Invalid ${flavor.toUpperCase()} pattern`, count: 0 };
  }
  const lines = text.split("\n");
  const matches: MatchResult["matches"] = [];
  let totalCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // In multiline mode, treat the entire text as one string and report ranges by line.
    if (config.multiline) {
      // Whole-text search; collect every match and find which line each falls on.
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        if (m[0].length === 0) { re.lastIndex++; continue; }
        const start = m.index;
        const end = m.index + m[0].length;
        // Find which line `start` is on.
        let lineNo = 1;
        let acc = 0;
        for (let j = 0; j < lines.length; j++) {
          const lineLen = lines[j].length + 1;
          if (acc + lineLen > start) { lineNo = j + 1; break; }
          acc += lineLen;
        }
        const lineText = lines[lineNo - 1] ?? "";
        // Skip if we've already recorded this line (multiline match may span).
        if (!matches.some((mm) => mm.line === lineNo)) {
          matches.push({ line: lineNo, text: lineText, ranges: [[0, lineText.length]] });
        }
        totalCount++;
        if (re.lastIndex === start) re.lastIndex++;
      }
      break; // only one pass over the entire text
    }
    // Per-line match.
    re.lastIndex = 0;
    const ranges: [number, number][] = [];
    let m: RegExpExecArray | null;
    let inverted = false;
    while ((m = re.exec(line)) !== null) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      ranges.push([m.index, m.index + m[0].length]);
      totalCount++;
      if (re.lastIndex === m.index) re.lastIndex++;
    }
    const isMatch = ranges.length > 0;
    if (config.invert) {
      if (!isMatch) {
        matches.push({ line: i + 1, text: line, ranges: [] });
        inverted = true;
      }
    } else if (isMatch) {
      matches.push({ line: i + 1, text: line, ranges });
    }
    void inverted;
  }
  if (config.count) {
    // For count mode, return a single pseudo-entry showing the count.
    return {
      ok: true,
      matches: [],
      count: config.invert
        ? lines.length - totalCount
        : totalCount,
    };
  }
  return { ok: true, matches, count: totalCount };
}

/** Highlight ranges in a line, returning HTML-safe segments. */
export function highlightRanges(
  line: string,
  ranges: [number, number][],
): { text: string; match: boolean }[] {
  if (ranges.length === 0) return [{ text: line, match: false }];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: { text: string; match: boolean }[] = [];
  let cursor = 0;
  for (const [start, end] of sorted) {
    if (start > cursor) out.push({ text: line.slice(cursor, start), match: false });
    out.push({ text: line.slice(start, end), match: true });
    cursor = end;
  }
  if (cursor < line.length) out.push({ text: line.slice(cursor), match: false });
  return out;
}

// ---- Command builders ----

/** Build the grep command from the config. */
export function buildGrepCommand(config: BuilderConfig): BuiltCommand {
  const parts: string[] = ["grep"];
  const notes: string[] = [];
  // Flavor.
  if (config.flavor === "ere") parts.push("-E");
  else if (config.flavor === "pcre") {
    parts.push("-P");
    notes.push("grep -P is GNU-only. On BSD/macOS, install grep via Homebrew or use ripgrep.");
  }
  // Fixed-string trumps flavor (no -E needed).
  if (config.fixedString) {
    parts.push("-F");
    notes.push("-F treats the pattern as a literal string (fgrep). Regex metacharacters lose meaning.");
  }
  if (config.ignoreCase) parts.push("-i");
  if (config.wholeWord) parts.push("-w");
  if (config.invert) parts.push("-v");
  if (config.count) parts.push("-c");
  if (config.lineNumbers) parts.push("-n");
  if (config.onlyMatching) parts.push("-o");
  if (config.recursive) {
    parts.push("-r");
    notes.push("-r does NOT follow symlinks. Use -R to follow them.");
  }
  if (config.noFiltering) {
    parts.push("-a");
    notes.push("-a forces binary files to be treated as text (otherwise grep prints 'Binary file matches').");
  }
  if (config.multiline) {
    parts.push("-Pzo");
    notes.push("grep -z uses NUL-separated input (whole file as one record). -P enables PCRE multiline. Combine with -o to extract blocks.");
  }
  // Context lines.
  if (config.contextBoth > 0) parts.push("-C", String(config.contextBoth));
  else {
    if (config.contextBefore > 0) parts.push("-B", String(config.contextBefore));
    if (config.contextAfter > 0) parts.push("-A", String(config.contextAfter));
  }
  // Includes.
  for (const inc of config.includes) {
    parts.push(`--include=${shellQuote(inc)}`);
  }
  for (const exc of config.excludes) {
    parts.push(`--exclude=${shellQuote(exc)}`);
  }
  for (const dir of config.excludeDirs) {
    parts.push(`--exclude-dir=${shellQuote(dir)}`);
  }
  // Pattern + paths.
  parts.push(shellQuote(config.pattern));
  for (const p of config.paths) parts.push(shellQuote(p));
  // Replace is not supported by grep — note it.
  if (config.replace) {
    notes.push(`grep cannot do replace preview. Use: sed ${shellQuote(`s/${config.pattern}/${config.replace}/g`)} <files>`);
  }
  // rg-only features.
  if (config.rgType) notes.push(`grep has no -t type system — use --include='*.${config.rgType}' instead.`);
  return { command: parts.join(" "), notes };
}

/** Build the ripgrep command from the config. */
export function buildRgCommand(config: BuilderConfig): BuiltCommand {
  const parts: string[] = ["rg"];
  const notes: string[] = [];
  // rg default = ERE-ish Rust regex. No flag needed for ERE/rust flavors.
  if (config.flavor === "bre") {
    notes.push("rg has no BRE mode — it always uses Rust regex (ERE-like). BRE-escaped metachars (\\+ \\?) become ERE metachars; double-check your pattern.");
  } else if (config.flavor === "pcre") {
    parts.push("-P");
    notes.push("rg -P uses the optional PCRE2 engine (build-time flag). Most rg builds support full PCRE lookaround; if not, use Rust regex defaults.");
  }
  if (config.fixedString) {
    parts.push("-F");
    notes.push("-F / --fixed-strings treats pattern as literal text.");
  }
  if (config.ignoreCase) parts.push("-i");
  if (config.wholeWord) parts.push("-w");
  if (config.invert) parts.push("-v");
  if (config.count) parts.push("-c");
  if (config.lineNumbers) parts.push("-n");
  else notes.push("rg shows line numbers by default on a tty; -n forces them on (e.g. when piped).");
  if (config.onlyMatching) parts.push("-o");
  // rg is recursive by default — no flag needed. If user deselected recursive, use --max-depth 0.
  if (!config.recursive) {
    parts.push("--max-depth", "0");
    notes.push("rg searches recursively by default. --max-depth 0 limits to the listed paths only.");
  }
  if (config.noFiltering) {
    parts.push("-uuu");
    notes.push("-u searches hidden files; -uu also ignores .gitignore; -uuu also searches binary files.");
  }
  if (config.multiline) {
    parts.push("-U");
    notes.push("-U / --multiline lets . match newlines. Use (?s) at the start of the pattern instead for finer control.");
  }
  // Context.
  if (config.contextBoth > 0) parts.push("-C", String(config.contextBoth));
  else {
    if (config.contextBefore > 0) parts.push("-B", String(config.contextBefore));
    if (config.contextAfter > 0) parts.push("-A", String(config.contextAfter));
  }
  // Includes/excludes.
  for (const inc of config.includes) {
    parts.push("-g", shellQuote(inc));
  }
  for (const exc of config.excludes) {
    parts.push("-g", shellQuote(`!${exc}`));
    notes.push(`rg negates globs with a leading ! — '-g !${exc}' excludes matches.`);
  }
  for (const dir of config.excludeDirs) {
    parts.push("-g", shellQuote(`!${dir}/**`));
  }
  // rg -t/-T types.
  if (config.rgType) parts.push("-t", config.rgType);
  if (config.rgTypeNot) parts.push("-T", config.rgTypeNot);
  // Replace.
  if (config.replace) {
    parts.push("-r", shellQuote(config.replace));
    notes.push("-r / --replace PREVIEW replaces matches in output only. It does NOT modify files. Use `sed -i` for in-place edits.");
  }
  // Pattern + paths.
  parts.push(shellQuote(config.pattern));
  for (const p of config.paths) parts.push(shellQuote(p));
  return { command: parts.join(" "), notes };
}

/** Build both commands. */
export function buildCommands(config: BuilderConfig): BuiltCommands {
  return {
    grep: buildGrepCommand(config),
    rg: buildRgCommand(config),
  };
}

/** Plain-English summary of the command's intent. */
export function explainIntent(config: BuilderConfig): string {
  const bits: string[] = [];
  if (config.fixedString) bits.push("literal-string");
  else bits.push(config.flavor.toUpperCase());
  bits.push("pattern");
  if (config.ignoreCase) bits.push("(case-insensitive)");
  if (config.wholeWord) bits.push("(whole-word)");
  if (config.invert) bits.push("(non-matching lines)");
  if (config.count) bits.push("(count only)");
  if (config.onlyMatching) bits.push("(only the match)");
  const head = `Search for ${config.pattern || "<pattern>"} as a ${bits.join(" ")}.`;
  const tail: string[] = [];
  if (config.recursive) tail.push("Search recursively");
  else tail.push("Search the listed files only");
  tail.push(`in ${config.paths.length === 0 ? "(no paths)" : config.paths.join(", ")}`);
  if (config.includes.length > 0) tail.push(`including only ${config.includes.join(", ")}`);
  if (config.excludes.length > 0) tail.push(`excluding ${config.excludes.join(", ")}`);
  if (config.excludeDirs.length > 0) tail.push(`skipping dirs ${config.excludeDirs.join(", ")}`);
  if (config.rgType) tail.push(`rg file type: ${config.rgType}`);
  if (config.contextBoth > 0) tail.push(`with ${config.contextBoth} lines of context on each side`);
  else {
    if (config.contextBefore > 0) tail.push(`with ${config.contextBefore} lines before`);
    if (config.contextAfter > 0) tail.push(`with ${config.contextAfter} lines after`);
  }
  if (config.multiline) tail.push("in multiline mode (cross-newline matches)");
  if (config.noFiltering) tail.push("ignoring gitignore/hidden/binary filters");
  if (config.replace) tail.push(`replacing matches with "${config.replace}" (preview only)`);
  return `${head} ${tail.join(", ")}.`;
}

/** Per-flag explanations for the active config (both tools). */
export function explainFlags(config: BuilderConfig): FlagExplanation[] {
  const out: FlagExplanation[] = [];
  if (config.flavor === "ere") {
    out.push({ flag: "-E", tool: "grep", explanation: "Use Extended Regular Expressions (ERE). Same as egrep. Enables + ? | ( ) { } without backslash." });
  } else if (config.flavor === "pcre") {
    out.push({ flag: "-P", tool: "grep", explanation: "Use Perl-Compatible Regular Expressions (PCRE). Supports \\d \\w \\s, lookahead/lookbehind, named groups. GNU grep only." });
    out.push({ flag: "-P", tool: "rg", explanation: "Use PCRE2 engine (ripgrep must be built with PCRE2 support). Enables look-around not in Rust regex." });
  } else if (config.flavor === "bre") {
    out.push({ flag: "(default)", tool: "grep", explanation: "Basic Regular Expressions (BRE). Metacharacters ?+(){}| are literal — escape with \\ to activate." });
    out.push({ flag: "(n/a)", tool: "rg", explanation: "rg has no BRE mode — always Rust regex (ERE-like). Your BRE pattern may behave differently." });
  } else {
    out.push({ flag: "(default)", tool: "rg", explanation: "Rust regex crate — Unicode-aware, PCRE-ish, fast. No backreferences by default." });
  }
  if (config.fixedString) out.push({ flag: "-F", tool: "both", explanation: "Treat pattern as a fixed literal string — no regex interpretation. Same as fgrep." });
  if (config.ignoreCase) out.push({ flag: "-i", tool: "both", explanation: "Case-insensitive match. ABC matches abc, ABC, AbC." });
  if (config.wholeWord) out.push({ flag: "-w", tool: "both", explanation: "Match only whole words (anchored to \\b word boundaries). 'error' won't match 'errors'." });
  if (config.invert) out.push({ flag: "-v", tool: "both", explanation: "Invert — print lines that do NOT match." });
  if (config.count) out.push({ flag: "-c", tool: "both", explanation: "Print only the count of matching lines per file (not the lines themselves)." });
  if (config.lineNumbers) out.push({ flag: "-n", tool: "both", explanation: "Prefix each match with its 1-based line number." });
  if (config.onlyMatching) out.push({ flag: "-o", tool: "both", explanation: "Print only the matching substring, not the whole line." });
  if (config.recursive) {
    out.push({ flag: "-r", tool: "grep", explanation: "Recurse into subdirectories (does not follow symlinks — use -R for that)." });
    out.push({ flag: "(default)", tool: "rg", explanation: "rg recurses by default. Use --max-depth 0 to disable." });
  } else {
    out.push({ flag: "--max-depth 0", tool: "rg", explanation: "Disable rg's default recursion — search only the listed paths." });
  }
  if (config.noFiltering) {
    out.push({ flag: "-a", tool: "grep", explanation: "Treat binary files as text. Without -a, grep prints 'Binary file X matches'." });
    out.push({ flag: "-uuu", tool: "rg", explanation: "Disable all rg default filters: hidden files (-u), .gitignore (-uu), binary files (-uuu)." });
  }
  if (config.multiline) {
    out.push({ flag: "-Pzo", tool: "grep", explanation: "PCRE multiline + NUL-separated input. Whole file is one record; . matches \\n. Combine with -o to extract blocks." });
    out.push({ flag: "-U", tool: "rg", explanation: "Multiline mode — . matches \\n. Use (?s) inline for finer control." });
  }
  if (config.contextBoth > 0) out.push({ flag: `-C ${config.contextBoth}`, tool: "both", explanation: `${config.contextBoth} lines of context before AND after each match.` });
  if (config.contextBefore > 0) out.push({ flag: `-B ${config.contextBefore}`, tool: "both", explanation: `${config.contextBefore} lines of context before each match.` });
  if (config.contextAfter > 0) out.push({ flag: `-A ${config.contextAfter}`, tool: "both", explanation: `${config.contextAfter} lines of context after each match.` });
  for (const inc of config.includes) {
    out.push({ flag: `--include=${inc}`, tool: "grep", explanation: `Only search files whose basename matches the glob '${inc}'.` });
    out.push({ flag: `-g '${inc}'`, tool: "rg", explanation: `Only search files matching the gitignore-style glob '${inc}'.` });
  }
  for (const exc of config.excludes) {
    out.push({ flag: `--exclude=${exc}`, tool: "grep", explanation: `Skip files whose basename matches the glob '${exc}'.` });
    out.push({ flag: `-g '!${exc}'`, tool: "rg", explanation: `Skip files matching the glob '${exc}' (rg negates with leading !).` });
  }
  for (const dir of config.excludeDirs) {
    out.push({ flag: `--exclude-dir=${dir}`, tool: "grep", explanation: `Do not descend into directories named '${dir}'.` });
    out.push({ flag: `-g '!${dir}/**'`, tool: "rg", explanation: `Skip everything under '${dir}/'.` });
  }
  if (config.rgType) {
    out.push({ flag: `-t ${config.rgType}`, tool: "rg", explanation: `Only search files of rg's built-in type '${config.rgType}' (e.g. py, js, markdown).` });
    out.push({ flag: `--include='*.${config.rgType}'`, tool: "grep", explanation: `grep has no -t type system — use an include glob as an approximation.` });
  }
  if (config.rgTypeNot) {
    out.push({ flag: `-T ${config.rgTypeNot}`, tool: "rg", explanation: `Exclude files of rg's built-in type '${config.rgTypeNot}'.` });
  }
  if (config.replace) {
    out.push({ flag: `-r '${config.replace}'`, tool: "rg", explanation: `Preview replace — substitute matches with '${config.replace}' in the OUTPUT only. Does NOT modify files.` });
    out.push({ flag: "n/a", tool: "grep", explanation: `grep cannot preview replaces. Use: sed 's/PATTERN/${config.replace}/g' file.` });
  }
  return out;
}

/** Validate the config; return a list of warnings/errors. */
export function validateConfig(config: BuilderConfig): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!config.pattern) errors.push("Pattern is empty.");
  // Test-compile the pattern.
  const re = buildTestRegex(config.pattern, config.flavor, {
    ignoreCase: config.ignoreCase,
    wholeWord: config.wholeWord,
    multiline: config.multiline,
    fixedString: config.fixedString,
  });
  if (!re) errors.push(`Pattern is not a valid ${config.flavor.toUpperCase()} regex.`);
  if (config.flavor === "pcre") warnings.push("grep -P is GNU-only. On BSD/macOS use ripgrep or `brew install grep`.");
  if (config.flavor === "bre" && /[+?{}()|]/.test(config.pattern) && !/\\[+?{}()|]/.test(config.pattern)) {
    warnings.push("In BRE, ?+{}()| are literal. Did you mean to escape them or use -E?");
  }
  if (config.replace && config.flavor === "bre") {
    warnings.push("Replace preview uses Rust regex (rg). Your BRE pattern may behave differently.");
  }
  if (config.paths.length === 0) warnings.push("No paths specified — grep will read from stdin; rg will search the current directory.");
  return { errors, warnings };
}

/** Format the translation table as plain text. */
export function formatTranslationTable(): string {
  const rows = [
    "Intent | grep | rg | Notes",
    ...TRANSLATION_TABLE.map((t) => `${t.intent} | ${t.grep} | ${t.rg} | ${t.notes}`),
  ];
  return rows.join("\n");
}

/** Render recipes as plain text for download. */
export function renderRecipesText(): string {
  return RECIPES.map((r) => `${r.label}\n  ${r.description}\n  pattern: ${r.config.pattern ?? ""}\n  flavor: ${r.config.flavor ?? ""}`).join("\n\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:grep-ripgrep-command-builder:history";
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

// ---- Shareable URL ----

export function buildShareUrl(config: BuilderConfig, sample: string): string {
  const params = new URLSearchParams();
  params.set("p", config.pattern);
  params.set("f", config.flavor);
  const flags: string[] = [];
  if (config.ignoreCase) flags.push("i");
  if (config.wholeWord) flags.push("w");
  if (config.invert) flags.push("v");
  if (config.count) flags.push("c");
  if (config.lineNumbers) flags.push("n");
  if (config.recursive) flags.push("r");
  if (config.fixedString) flags.push("F");
  if (config.onlyMatching) flags.push("o");
  if (config.multiline) flags.push("U");
  if (config.noFiltering) flags.push("uuu");
  if (flags.length > 0) params.set("x", flags.join(""));
  if (config.includes.length > 0) params.set("inc", config.includes.join(","));
  if (config.excludes.length > 0) params.set("exc", config.excludes.join(","));
  if (config.excludeDirs.length > 0) params.set("exd", config.excludeDirs.join(","));
  if (config.rgType) params.set("t", config.rgType);
  if (config.rgTypeNot) params.set("tn", config.rgTypeNot);
  if (config.contextBefore > 0) params.set("B", String(config.contextBefore));
  if (config.contextAfter > 0) params.set("A", String(config.contextAfter));
  if (config.contextBoth > 0) params.set("C", String(config.contextBoth));
  if (config.replace) params.set("rep", config.replace);
  if (config.paths.length > 0) params.set("paths", config.paths.join(","));
  if (sample) params.set("s", sample);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { config: Partial<BuilderConfig>; sample: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { config: {}, sample: "" };
  const params = new URLSearchParams(clean);
  const config: Partial<BuilderConfig> = {};
  if (params.has("p")) config.pattern = params.get("p")!;
  if (params.has("f")) {
    const f = params.get("f") as RegexFlavor | null;
    if (f && ["bre", "ere", "pcre", "rust"].includes(f)) config.flavor = f;
  }
  const flags = params.get("x") ?? "";
  if (flags) {
    config.ignoreCase = flags.includes("i");
    config.wholeWord = flags.includes("w");
    config.invert = flags.includes("v");
    config.count = flags.includes("c");
    config.lineNumbers = flags.includes("n");
    config.recursive = flags.includes("r");
    config.fixedString = flags.includes("F");
    config.onlyMatching = flags.includes("o");
    config.multiline = flags.includes("U");
    config.noFiltering = flags.includes("u");
  }
  if (params.has("inc")) config.includes = params.get("inc")!.split(",").filter(Boolean);
  if (params.has("exc")) config.excludes = params.get("exc")!.split(",").filter(Boolean);
  if (params.has("exd")) config.excludeDirs = params.get("exd")!.split(",").filter(Boolean);
  if (params.has("t")) config.rgType = params.get("t")!;
  if (params.has("tn")) config.rgTypeNot = params.get("tn")!;
  if (params.has("B")) config.contextBefore = Math.max(0, parseInt(params.get("B")!, 10) || 0);
  if (params.has("A")) config.contextAfter = Math.max(0, parseInt(params.get("A")!, 10) || 0);
  if (params.has("C")) config.contextBoth = Math.max(0, parseInt(params.get("C")!, 10) || 0);
  if (params.has("rep")) config.replace = params.get("rep")!;
  if (params.has("paths")) config.paths = params.get("paths")!.split(",").filter(Boolean);
  const sample = params.get("s") ?? "";
  return { config, sample };
}
