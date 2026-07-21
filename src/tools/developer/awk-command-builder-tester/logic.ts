/**
 * awk Command Builder & Tester — pure logic.
 *
 * A small pure-JavaScript awk interpreter (no WASM, no network) plus a
 * visual builder, per-option explanation, reverse program explainer,
 * sample-data library, recipe presets, history, and shareable URL.
 *
 * Supported awk subset:
 *   BEGIN { ... } / END { ... }     setup / teardown blocks
 *   <pattern> { <action> }          main rules
 *   $0, $1, $2, ..., $N             field access (assignable)
 *   NR, NF, FNR, FS, OFS, RS        special variables
 *   -F sep  / -v var=val            command-line flags
 *   print a, b, c                   output joined by OFS
 *   printf(fmt, args)               formatted output (subset of %d %s %f %x %o %c)
 *   if / else / while / for / for-in / break / continue / next
 *   + - * / % ^                     arithmetic
 *   == != < > <= >=                 comparison
 *   && || !                         logical
 *   =  += -= *= /= %= ^=            assignment
 *   length(s), length               string length / record length
 *   tolower(s), toupper(s)          case
 *   substr(s, m[, n])               substring (1-indexed)
 *   split(s, arr[, sep])            split (sets arr[1..n], returns n)
 *   int(x), sqrt(x)                 math
 *   index(s, t)                     substring search
 *   sub(re, repl[, s]), gsub(...)   regex replace (subset)
 *   match(s, re)                    regex match (sets RSTART/RLENGTH)
 *   "str" "str"                     concatenation (juxtaposition)
 *   /regex/                         ERE pattern
 *   expr ~ /re/  /  expr !~ /re/    regex test
 *
 * NOT supported: user-defined functions, multi-dimensional arrays,
 * getline, BEGINFILE/ENDFILE, RT, PROCINFO, gawk extensions.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AwkVariable {
  /** Variable name (e.g. OFS, myVar). */
  name: string;
  /** String value as typed in the -v box. */
  value: string;
}

export type AggregationType =
  | "none"
  | "sum"
  | "avg"
  | "min"
  | "max"
  | "count";

export interface AwkConfig {
  /** Field separator flag, e.g. ",", "\t", ":", " ", "[,:]", or "" for default whitespace. */
  fieldSeparator: string;
  /** Output field separator (OFS). Empty string falls back to a single space. */
  outputSeparator: string;
  /** -v variables. */
  variables: AwkVariable[];
  /** BEGIN block (without the `BEGIN { }` wrapper). */
  beginBlock: string;
  /** END block (without the `END { }` wrapper). */
  endBlock: string;
  /** Pattern expression for the main rule (e.g. `$2 > 100`, `/error/`, or empty for unconditional). */
  pattern: string;
  /** Action body for the main rule (e.g. `print $1, $3`). */
  action: string;
  /** Whether to use -E invocation in the generated command (POSIX mode comment). */
  posix: boolean;
  /** Aggregation preset used by the visual builder. */
  aggregation: AggregationType;
  /** Column index for aggregation (1-based). */
  aggregationColumn: number;
}

export interface AwkExplanationItem {
  /** The option/flag/token this explains. */
  option: string;
  /** Plain-English explanation. */
  explanation: string;
}

export interface AwkBuildResult {
  /** The full awk program text (BEGIN/END + main rule). */
  program: string;
  /** Copy-ready shell command, e.g. `awk -F',' '{print $1,$3}' file`. */
  command: string;
  /** Per-option explanation items. */
  explanations: AwkExplanationItem[];
}

export interface AwkRunResult {
  /** Captured stdout (joined with \n). */
  output: string;
  /** Error message if the program failed to parse or run. */
  error: string | null;
  /** Exit status (0 = OK, 1 = error). */
  exitStatus: number;
  /** Number of input lines processed. */
  lineCount: number;
}

export interface HistoryEntry {
  ts: number;
  program: string;
  inputPreview: string;
  command: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export interface SampleDataset {
  label: string;
  input: string;
  description: string;
}

export const SAMPLE_DATA: SampleDataset[] = [
  {
    label: "CSV sales",
    description: "Comma-separated sales records: name,units,price",
    input: "name,units,price\nAlice,10,9.99\nBob,3,14.50\nCarol,7,4.99\nDave,0,99.00\nEve,25,2.50",
  },
  {
    label: "TSV access log",
    description: "Tab-separated: ip, user, status, bytes",
    input: "ip\tuser\tstatus\tbytes\n10.0.0.1\talice\t200\t1024\n10.0.0.2\tbob\t404\t256\n10.0.0.3\tcarol\t500\t8192\n10.0.0.4\talice\t200\t512",
  },
  {
    label: "/etc/passwd",
    description: "Colon-separated: user, x, uid, gid, gecos, home, shell",
    input: "root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nwww-data:x:33:33:www-data:/var/www:/usr/sbin/nologin\nubuntu:x:1000:1000:Ubuntu:/home/ubuntu:/bin/bash",
  },
  {
    label: "Whitespace log",
    description: "Default whitespace FS: timestamp level message",
    input: "2024-01-01 10:00:00 INFO startup\n2024-01-01 10:01:23 WARN slow query\n2024-01-01 10:02:11 ERROR connection refused\n2024-01-01 10:03:00 INFO recovered",
  },
  {
    label: "Numbers",
    description: "One number per line for math demos",
    input: "1\n2\n3\n4\n5\n6\n7\n8\n9\n10",
  },
];

export interface FsPreset {
  label: string;
  value: string;
  description: string;
}

export const FS_PRESETS: FsPreset[] = [
  { label: "Whitespace (default)", value: "", description: "Runs of spaces/tabs; trims leading/trailing" },
  { label: "Comma (CSV)", value: ",", description: "Comma-separated values" },
  { label: "Tab (TSV)", value: "\\t", description: "Tab-separated values" },
  { label: "Colon", value: ":", description: "/etc/passwd, /etc/shadow" },
  { label: "Pipe", value: "|", description: "Pipe-separated values" },
  { label: "Semicolon", value: ";", description: "European CSV" },
  { label: "Regex [,:]", value: "[,:]", description: "Split on either comma or colon" },
  { label: "Regex \\s+", value: "\\\\s+", description: "Any whitespace (explicit)" },
];

export interface Recipe {
  label: string;
  description: string;
  program: string;
  /** Suggested sample dataset label. */
  sampleLabel: string;
  /** Suggested field separator (string value, "" for default whitespace). */
  fieldSeparator: string;
}

export const RECIPE_LIBRARY: Recipe[] = [
  {
    label: "Print first column",
    description: "Print $1 for every record",
    program: "{ print $1 }",
    sampleLabel: "Whitespace log",
    fieldSeparator: "",
  },
  {
    label: "Print columns 1 and 3",
    description: "Print $1 and $3 separated by OFS",
    program: "{ print $1, $3 }",
    sampleLabel: "CSV sales",
    fieldSeparator: ",",
  },
  {
    label: "Last column ($NF)",
    description: "Print the last field of each line",
    program: "{ print $NF }",
    sampleLabel: "/etc/passwd",
    fieldSeparator: ":",
  },
  {
    label: "Filter rows by number",
    description: "Lines where column 2 is greater than 5",
    program: "$2 > 5 { print }",
    sampleLabel: "CSV sales",
    fieldSeparator: ",",
  },
  {
    label: "Filter rows by regex",
    description: "Lines matching /error/i (case-insensitive)",
    program: "tolower($0) ~ /error/ { print }",
    sampleLabel: "Whitespace log",
    fieldSeparator: "",
  },
  {
    label: "Sum a column",
    description: "Sum column 2 across all records",
    program: "{ s += $2 } END { print s }",
    sampleLabel: "CSV sales",
    fieldSeparator: ",",
  },
  {
    label: "Average a column",
    description: "Average column 2 with one decimal",
    program: "{ s += $2 } END { printf \"%.1f\\n\", s/NR }",
    sampleLabel: "CSV sales",
    fieldSeparator: ",",
  },
  {
    label: "Count records",
    description: "Print NR at end (count of records)",
    program: "END { print NR }",
    sampleLabel: "Numbers",
    fieldSeparator: "",
  },
  {
    label: "Line numbers",
    description: "Prefix each line with NR and a tab",
    program: "{ print NR, $0 }",
    sampleLabel: "Numbers",
    fieldSeparator: "",
  },
  {
    label: "Field count",
    description: "Print NF for each record",
    program: "{ print NF }",
    sampleLabel: "Whitespace log",
    fieldSeparator: "",
  },
];

// ---------------------------------------------------------------------------
// Input normalization
// ---------------------------------------------------------------------------

/** Normalize CRLF → LF and trim a single trailing newline. */
export function normalizeInput(input: string): string {
  if (!input) return "";
  const lf = input.replace(/\r\n?/g, "\n");
  return lf.replace(/\n+$/, "");
}

/** Decode escape sequences (\t, \n, \\) from a flag-style FS string. */
export function decodeEscapes(s: string): string {
  if (!s) return s;
  return s
    .replace(/\\t/g, "\t")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\\\/g, "\\");
}

// ---------------------------------------------------------------------------
// Shell quoting
// ---------------------------------------------------------------------------

/** Single-quote a string for the shell, escaping embedded quotes. */
export function shellQuote(s: string): string {
  if (s === "") return "''";
  // If the string has no single quotes, wrap it directly.
  if (!s.includes("'")) return `'${s}'`;
  // Escape each ' as '\''
  return `'${s.replace(/'/g, "'\\''")}'`;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIG: AwkConfig = {
  fieldSeparator: ",",
  outputSeparator: "",
  variables: [],
  beginBlock: "",
  endBlock: "",
  pattern: "",
  action: "print $1, $2",
  posix: false,
  aggregation: "none",
  aggregationColumn: 2,
};

/** Build the awk program text from a config. */
export function buildAwkProgram(config: AwkConfig): string {
  const parts: string[] = [];
  if (config.beginBlock.trim()) {
    parts.push(`BEGIN { ${config.beginBlock.trim()} }`);
  }
  const pattern = config.pattern.trim();
  const action = config.action.trim();
  if (action || pattern) {
    let rule = "";
    if (pattern) rule += `${pattern} `;
    if (action) {
      rule += `{ ${action} }`;
    } else {
      // Pattern without action — default action is print.
      rule += `{ print }`;
    }
    parts.push(rule);
  }
  if (config.endBlock.trim()) {
    parts.push(`END { ${config.endBlock.trim()} }`);
  }
  return parts.join("\n");
}

/** Build the copy-ready shell command. */
export function buildAwkCommand(config: AwkConfig): string {
  const args: string[] = [];
  if (config.fieldSeparator) {
    const fs = config.fieldSeparator;
    args.push(`-F ${shellQuote(fs)}`);
  }
  for (const v of config.variables) {
    if (v.name && /^[A-Za-z_][A-Za-z0-9_]*$/.test(v.name)) {
      args.push(`-v ${v.name}=${shellQuote(v.value)}`);
    }
  }
  const program = buildAwkProgram(config);
  args.push(shellQuote(program));
  return `awk ${args.join(" ")} file`;
}

/** Generate per-option explanations from the config. */
export function explainConfig(config: AwkConfig): AwkExplanationItem[] {
  const out: AwkExplanationItem[] = [];
  if (config.fieldSeparator) {
    out.push({
      option: `-F ${shellQuote(config.fieldSeparator)}`,
      explanation: `Set the field separator (FS) to ${JSON.stringify(config.fieldSeparator)}. Each input line is split into fields $1, $2, … using this separator.`,
    });
  } else {
    out.push({
      option: "(default FS)",
      explanation: "Use the default field separator — runs of spaces and tabs are treated as one separator, and leading/trailing whitespace is trimmed.",
    });
  }
  if (config.outputSeparator) {
    out.push({
      option: `OFS = ${JSON.stringify(config.outputSeparator)}`,
      explanation: `Output field separator: when you write \`print $1, $2\`, the comma joins fields with this string (default is a single space).`,
    });
  }
  for (const v of config.variables) {
    if (v.name && /^[A-Za-z_][A-Za-z0-9_]*$/.test(v.name)) {
      out.push({
        option: `-v ${v.name}=${shellQuote(v.value)}`,
        explanation: `Pre-assign the variable ${v.name} to ${JSON.stringify(v.value)} before the BEGIN block runs. Available in BEGIN, main rules, and END.`,
      });
    }
  }
  if (config.beginBlock.trim()) {
    out.push({
      option: "BEGIN { … }",
      explanation: `Runs once before any input is read. Common uses: initialise counters, set FS/OFS, print headers. Your BEGIN body: ${config.beginBlock.trim()}`,
    });
  }
  if (config.pattern.trim()) {
    out.push({
      option: `${config.pattern.trim()} { … }`,
      explanation: `For each input record, evaluate ${JSON.stringify(config.pattern.trim())}. The action runs only when the pattern is true.`,
    });
  } else if (config.action.trim()) {
    out.push({
      option: "{ … }",
      explanation: "For each input record (no pattern), run the action body unconditionally.",
    });
  }
  if (config.action.trim()) {
    out.push({
      option: `action: ${config.action.trim()}`,
      explanation: `The action body. $1, $2, … are the 1-indexed fields of the current record; $0 is the whole record; NR is the record number; NF is the field count.`,
    });
  }
  if (config.endBlock.trim()) {
    out.push({
      option: "END { … }",
      explanation: `Runs once after all input is consumed. Common uses: print totals, averages, summaries. Your END body: ${config.endBlock.trim()}`,
    });
  }
  if (config.posix) {
    out.push({
      option: "POSIX mode",
      explanation: "POSIX awk (one-true-awk) — avoid gawk-only features like `gensub`, `patsplit`, `asort`. The generated command is portable across macOS/BSD and Linux.",
    });
  }
  return out;
}

/** Run the builder end-to-end. */
export function buildAwk(config: AwkConfig): AwkBuildResult {
  return {
    program: buildAwkProgram(config),
    command: buildAwkCommand(config),
    explanations: explainConfig(config),
  };
}

// ---------------------------------------------------------------------------
// Builder presets — common operations
// ---------------------------------------------------------------------------

/** Generate a config for "print these columns". */
export function presetPrintColumns(columns: number[], fs: string = ","): AwkConfig {
  const cols = columns.filter((c) => c > 0);
  const action = cols.length > 0
    ? `print ${cols.map((c) => `$${c}`).join(", ")}`
    : "print";
  return { ...DEFAULT_CONFIG, fieldSeparator: fs, action };
}

/** Generate a config for "filter rows where column N op value". */
export function presetFilter(
  column: number,
  op: ">" | "<" | ">=" | "<=" | "==" | "!=",
  value: string | number,
  fs: string = ",",
): AwkConfig {
  const isNumeric = typeof value === "number" || /^-?\d+(\.\d+)?$/.test(String(value));
  const rhs = isNumeric ? String(value) : JSON.stringify(String(value));
  const pattern = `$${column} ${op} ${rhs}`;
  return { ...DEFAULT_CONFIG, fieldSeparator: fs, pattern, action: "print" };
}

/** Generate a config for "sum / avg / min / max / count column N". */
export function presetAggregate(
  type: Exclude<AggregationType, "none">,
  column: number,
  fs: string = ",",
): AwkConfig {
  const col = Math.max(1, column);
  switch (type) {
    case "sum":
      return {
        ...DEFAULT_CONFIG,
        fieldSeparator: fs,
        action: `s += $${col}`,
        endBlock: `print s`,
      };
    case "avg":
      return {
        ...DEFAULT_CONFIG,
        fieldSeparator: fs,
        action: `s += $${col}`,
        endBlock: `printf "%.2f\\n", s/NR`,
      };
    case "min":
      return {
        ...DEFAULT_CONFIG,
        fieldSeparator: fs,
        beginBlock: `min = ""`,
        action: `if (min == "" || $${col} < min) min = $${col}`,
        endBlock: `print min`,
      };
    case "max":
      return {
        ...DEFAULT_CONFIG,
        fieldSeparator: fs,
        beginBlock: `max = ""`,
        action: `if (max == "" || $${col} > max) max = $${col}`,
        endBlock: `print max`,
      };
    case "count":
      return {
        ...DEFAULT_CONFIG,
        fieldSeparator: fs,
        action: ``,
        endBlock: `print NR`,
      };
  }
}

// ---------------------------------------------------------------------------
// Reverse program explainer
// ---------------------------------------------------------------------------

export interface ProgramAnnotation {
  token: string;
  explanation: string;
}

/** Annotate each significant token in an awk program (reverse explainer). */
export function explainProgram(program: string): ProgramAnnotation[] {
  const out: ProgramAnnotation[] = [];
  if (!program || !program.trim()) return out;
  const lines = program.split(/\n/);
  const seen = new Set<string>();

  const add = (token: string, explanation: string) => {
    if (seen.has(token)) return;
    seen.add(token);
    out.push({ token, explanation });
  };

  // Whole-program feature detection.
  if (/\bBEGIN\s*\{/.test(program)) {
    add("BEGIN { … }", "Runs once before reading any input. Common for initialising variables, setting FS/OFS, or printing a header row.");
  }
  if (/\bEND\s*\{/.test(program)) {
    add("END { … }", "Runs once after all input is consumed. Common for printing totals, averages, or final summaries.");
  }

  // Field references $0, $1..$N
  const fieldMatches = program.match(/\$(0|[1-9][0-9]*)/g) ?? [];
  for (const f of fieldMatches) {
    const n = Number(f.slice(1));
    if (n === 0) add("$0", "The entire current record (input line).");
    else if (n === 1) add("$1", "The first field of the current record, split by FS.");
    else add(f, `Field number ${n} of the current record (1-indexed).`);
  }

  if (/\bNF\b/.test(program)) add("NF", "Number of Fields in the current record. $NF is the last field.");
  if (/\bNR\b/.test(program)) add("NR", "Number of Records read so far (1-indexed line counter across all files).");
  if (/\bFNR\b/.test(program)) add("FNR", "File Number of Records — line counter reset per input file.");
  if (/\bFS\b/.test(program)) add("FS", "Field Separator — the string/regex used to split each record into fields.");
  if (/\bOFS\b/.test(program)) add("OFS", "Output Field Separator — the string used when `print` joins multiple values with a comma.");
  if (/\bRS\b/.test(program)) add("RS", "Record Separator — the string used to split input into records (default newline).");
  if (/\bORS\b/.test(program)) add("ORS", "Output Record Separator — appended after each `print` (default newline).");

  // Regex patterns /re/
  const regexes = program.match(/\/(\\\/|[^/])+\/[gimsx]*/g) ?? [];
  for (const r of regexes.slice(0, 3)) {
    add(r, "An ERE (extended regular expression) pattern. As a rule pattern, the action runs for records that match.");
  }

  if (/~\s*\//.test(program)) add("expr ~ /re/", "Regex match operator — true if expr matches the regex.");
  if (/!~\s*\//.test(program)) add("expr !~ /re/", "Regex non-match operator — true if expr does NOT match the regex.");

  if (/\bprint\b/.test(program)) add("print", "Outputs its arguments joined by OFS, followed by ORS (newline).");
  if (/\bprintf\b/.test(program)) add("printf", "Formatted output (C-style). Does NOT append a newline automatically — add \\n explicitly.");

  // Built-in functions
  const fnMap: Record<string, string> = {
    length: "length(x) — number of characters in x (or in $0 if no argument).",
    tolower: "tolower(s) — returns s with upper-case letters converted to lower-case.",
    toupper: "toupper(s) — returns s with lower-case letters converted to upper-case.",
    substr: "substr(s, m[, n]) — substring of s starting at position m (1-indexed), length n (or rest).",
    split: "split(s, arr[, sep]) — splits s into arr[1..n] using sep (or FS); returns the count n.",
    int: "int(x) — truncates x toward zero to an integer.",
    sqrt: "sqrt(x) — square root of x.",
    index: "index(s, t) — 1-based position of the first occurrence of t in s, or 0 if not found.",
    sub: "sub(re, repl[, s]) — replaces the first match of re in s (default $0); returns 1 or 0.",
    gsub: "gsub(re, repl[, s]) — replaces ALL matches of re in s (default $0); returns the count.",
    match: "match(s, re) — 1 if re matches s, else 0; sets RSTART and RLENGTH.",
  };
  for (const [fn, desc] of Object.entries(fnMap)) {
    const re = new RegExp(`\\b${fn}\\s*\\(`);
    if (re.test(program)) add(`${fn}()`, desc);
  }

  // Control flow
  if (/\bif\s*\(/.test(program)) add("if (cond) …", "Conditional — runs the then-branch (and optional else-branch) based on cond.");
  if (/\bwhile\s*\(/.test(program)) add("while (cond) …", "Loop — repeats the body while cond is true.");
  if (/\bfor\s*\(/.test(program)) add("for (init; cond; update) …", "C-style for loop.");
  if (/\bfor\s*\([^)]+\s+in\s+/.test(program)) add("for (k in arr) …", "Array iteration — loops over the keys of associative array arr.");
  if (/\bbreak\b/.test(program)) add("break", "Exits the innermost loop immediately.");
  if (/\bcontinue\b/.test(program)) add("continue", "Skips the rest of this loop iteration.");
  if (/\bnext\b/.test(program)) add("next", "Stops processing the current record and moves to the next one.");

  // Compound assignments
  if (/\+=/.test(program)) add("var += expr", "Add-assign: equivalent to var = var + expr.");
  if (/-=/.test(program)) add("var -= expr", "Subtract-assign.");
  if (/\*=/.test(program)) add("var *= expr", "Multiply-assign.");
  if (/\/=/.test(program)) add("var /= expr", "Divide-assign.");
  if (/%=/.test(program)) add("var %= expr", "Modulo-assign.");

  // Per-line context (first 3 non-empty lines as raw text)
  const nonEmpty = lines.filter((l) => l.trim()).slice(0, 3);
  for (const line of nonEmpty) {
    add(line.trim(), `Line as written in your program: \`${line.trim()}\``);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Pure-JS awk interpreter
// ---------------------------------------------------------------------------

// Tokens
type TokenType =
  | "NUMBER"
  | "STRING"
  | "REGEX"
  | "IDENT"
  | "FUNC"        // built-in function name (length, substr, ...)
  | "FIELD"       // $N or $expr
  | "OP"          // operators and punctuation
  | "KEYWORD"     // BEGIN END if else while for in break continue next print printf
  | "NEWLINE"
  | "EOF";

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

const KEYWORDS = new Set([
  "BEGIN", "END", "if", "else", "while", "for", "in",
  "break", "continue", "next", "do", "print", "printf",
]);

const BUILTINS = new Set([
  "length", "tolower", "toupper", "substr", "split",
  "int", "sqrt", "index", "sub", "gsub", "match",
  "sprintf",
]);

/** Tokenize an awk program. */
export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = src.length;
  const isIdentStart = (c: string) => /[A-Za-z_]/.test(c);
  const isIdent = (c: string) => /[A-Za-z0-9_]/.test(c);
  const isDigit = (c: string) => c >= "0" && c <= "9";

  while (i < n) {
    const c = src[i];
    // Whitespace
    if (c === " " || c === "\t") { i++; continue; }
    // Line continuation
    if (c === "\\" && src[i + 1] === "\n") { i += 2; continue; }
    // Newline (statement separator inside blocks)
    if (c === "\n") { tokens.push({ type: "NEWLINE", value: "\n", pos: i }); i++; continue; }
    // Comment
    if (c === "#") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    // String
    if (c === '"') {
      let j = i + 1;
      let str = "";
      while (j < n && src[j] !== '"') {
        if (src[j] === "\\" && j + 1 < n) {
          const e = src[j + 1];
          if (e === "n") str += "\n";
          else if (e === "t") str += "\t";
          else if (e === "r") str += "\r";
          else if (e === "\\") str += "\\";
          else if (e === '"') str += '"';
          else if (e === "/") str += "/";
          else if (e === "0") str += "\0";
          else str += e;
          j += 2;
        } else {
          str += src[j];
          j++;
        }
      }
      if (j >= n) throw new Error("Unterminated string literal");
      tokens.push({ type: "STRING", value: str, pos: i });
      i = j + 1;
      continue;
    }
    // Regex — only when a / is in pattern position (start of statement,
    // after an operator, after `(`, `,`, or `~`/`!~`). Otherwise it's
    // division.
    if (c === "/") {
      const prev = tokens.length > 0 ? tokens[tokens.length - 1] : null;
      const allowRegex =
        !prev ||
        prev.type === "OP" ||
        prev.type === "NEWLINE" ||
        prev.type === "EOF" ||
        (prev.type === "KEYWORD" && prev.value !== "print" && prev.value !== "printf");
      if (allowRegex) {
        let j = i + 1;
        let re = "";
        while (j < n && src[j] !== "/") {
          if (src[j] === "\\" && j + 1 < n) {
            re += src[j] + src[j + 1];
            j += 2;
          } else {
            re += src[j];
            j++;
          }
        }
        if (j >= n) throw new Error("Unterminated regex literal");
        // collect flags
        let flags = "";
        j++;
        while (j < n && /[gimsx]/.test(src[j])) { flags += src[j]; j++; }
        tokens.push({ type: "REGEX", value: `/${re}/${flags}`, pos: i });
        i = j;
        continue;
      }
    }
    // Field reference $N or $(expr)
    if (c === "$") {
      let j = i + 1;
      if (src[j] === "(") {
        // $(expr) — collect until matching )
        let depth = 1;
        j++;
        let inner = "";
        while (j < n && depth > 0) {
          if (src[j] === "(") depth++;
          else if (src[j] === ")") { depth--; if (depth === 0) break; }
          inner += src[j];
          j++;
        }
        if (depth !== 0) throw new Error("Unterminated $(...)");
        tokens.push({ type: "FIELD", value: `(${inner})`, pos: i });
        i = j + 1;
        continue;
      }
      // $N
      let num = "";
      while (j < n && isDigit(src[j])) { num += src[j]; j++; }
      if (num) {
        tokens.push({ type: "FIELD", value: num, pos: i });
        i = j;
        continue;
      }
      // $IDENT — encode as $(IDENT) so the parser handles it as a field with a var index
      let id = "";
      while (j < n && isIdent(src[j])) { id += src[j]; j++; }
      if (id) {
        tokens.push({ type: "FIELD", value: `(${id})`, pos: i });
        i = j;
        continue;
      }
      throw new Error("Expected number, identifier, or ( after $");
    }
    // Number
    if (isDigit(c) || (c === "." && isDigit(src[i + 1]))) {
      let num = "";
      let j = i;
      while (j < n && (isDigit(src[j]) || src[j] === ".")) { num += src[j]; j++; }
      if (j < n && (src[j] === "e" || src[j] === "E")) {
        num += src[j]; j++;
        if (src[j] === "+" || src[j] === "-") { num += src[j]; j++; }
        while (j < n && isDigit(src[j])) { num += src[j]; j++; }
      }
      tokens.push({ type: "NUMBER", value: num, pos: i });
      i = j;
      continue;
    }
    // Identifier / keyword / builtin
    if (isIdentStart(c)) {
      let j = i;
      let id = "";
      while (j < n && isIdent(src[j])) { id += src[j]; j++; }
      if (KEYWORDS.has(id)) {
        tokens.push({ type: "KEYWORD", value: id, pos: i });
      } else if (BUILTINS.has(id)) {
        tokens.push({ type: "FUNC", value: id, pos: i });
      } else {
        tokens.push({ type: "IDENT", value: id, pos: i });
      }
      i = j;
      continue;
    }
    // Multi-char operators
    const two = src.slice(i, i + 2);
    const three = src.slice(i, i + 3);
    if (three === "**=") { tokens.push({ type: "OP", value: "**=", pos: i }); i += 3; continue; }
    if (two === "**") { tokens.push({ type: "OP", value: "**", pos: i }); i += 2; continue; }
    if (["==", "!=", "<=", ">=", "&&", "||", "++", "--", "+=", "-=", "*=", "/=", "%=", "^=", "~>", "!~"].includes(two)) {
      tokens.push({ type: "OP", value: two, pos: i }); i += 2; continue;
    }
    // Single-char operators
    if ("+-*/%^<>=!~&|?:;,(){}[]".includes(c)) {
      tokens.push({ type: "OP", value: c, pos: i });
      i++;
      continue;
    }
    throw new Error(`Unexpected character ${JSON.stringify(c)} at position ${i}`);
  }
  tokens.push({ type: "EOF", value: "", pos: n });
  return tokens;
}

// AST node types
type Expr =
  | { kind: "num"; value: number }
  | { kind: "str"; value: string }
  | { kind: "regex"; source: string; flags: string }
  | { kind: "field"; index: Expr }
  | { kind: "var"; name: string }
  | { kind: "assign"; op: string; target: Expr; value: Expr }
  | { kind: "binary"; op: string; left: Expr; right: Expr }
  | { kind: "unary"; op: string; operand: Expr; prefix: boolean }
  | { kind: "ternary"; cond: Expr; then: Expr; else: Expr }
  | { kind: "call"; name: string; args: Expr[] }
  | { kind: "concat"; parts: Expr[] }
  | { kind: "index"; arr: string; index: Expr }
  | { kind: "in"; key: Expr; arr: string };

type Stmt =
  | { kind: "print"; args: Expr[]; redir: null }
  | { kind: "printf"; args: Expr[]; redir: null }
  | { kind: "expr"; expr: Expr }
  | { kind: "if"; cond: Expr; then: Stmt[]; else: Stmt[] | null }
  | { kind: "while"; cond: Expr; body: Stmt[] }
  | { kind: "doWhile"; body: Stmt[]; cond: Expr }
  | { kind: "for"; init: Stmt | null; cond: Expr | null; update: Stmt | null; body: Stmt[] }
  | { kind: "forIn"; key: string; arr: string; body: Stmt[] }
  | { kind: "break" }
  | { kind: "continue" }
  | { kind: "next" }
  | { kind: "block"; body: Stmt[] };

interface Rule {
  kind: "BEGIN" | "END" | "main";
  pattern: Expr | null;
  /** For main rules with a regex pattern that's the whole pattern. */
  patternType: "expr" | "none";
  action: Stmt[];
}

interface Program {
  rules: Rule[];
}

// Parser
class Parser {
  private tokens: Token[];
  private pos = 0;
  constructor(tokens: Token[]) { this.tokens = tokens; }

  private peek(off = 0): Token { return this.tokens[Math.min(this.pos + off, this.tokens.length - 1)]; }
  private next(): Token { return this.tokens[this.pos++]; }
  private at(type: TokenType, value?: string): boolean {
    const t = this.peek();
    if (t.type !== type) return false;
    if (value !== undefined && t.value !== value) return false;
    return true;
  }
  private eat(type: TokenType, value?: string): Token {
    if (!this.at(type, value)) {
      const t = this.peek();
      throw new Error(`Expected ${type}${value ? ` "${value}"` : ""} but got ${t.type} ${JSON.stringify(t.value)} at ${t.pos}`);
    }
    return this.next();
  }
  private skipNewlines(): void {
    while (this.at("NEWLINE") || this.at("OP", ";")) this.next();
  }

  parseProgram(): Program {
    const rules: Rule[] = [];
    this.skipNewlines();
    while (!this.at("EOF")) {
      const rule = this.parseRule();
      if (rule) rules.push(rule);
      this.skipNewlines();
    }
    return { rules };
  }

  private parseRule(): Rule | null {
    if (this.at("KEYWORD", "BEGIN")) {
      this.next();
      const action = this.parseBlock();
      return { kind: "BEGIN", pattern: null, patternType: "none", action };
    }
    if (this.at("KEYWORD", "END")) {
      this.next();
      const action = this.parseBlock();
      return { kind: "END", pattern: null, patternType: "none", action };
    }
    // Pattern: may be a regex literal, expression, range (a,b), or empty.
    let pattern: Expr | null = null;
    let patternType: "expr" | "none" = "none";
    if (this.at("OP", "{")) {
      // No pattern
    } else {
      pattern = this.parseExpr();
      patternType = "expr";
    }
    // Action
    let action: Stmt[] = [];
    if (this.at("OP", "{")) {
      action = this.parseBlock();
    } else if (pattern) {
      // Pattern without action — default print.
      action = [{ kind: "expr", expr: { kind: "call", name: "__print_dollar0", args: [] } }];
    } else {
      throw new Error("Expected pattern or action");
    }
    return { kind: "main", pattern, patternType, action };
  }

  private parseBlock(): Stmt[] {
    this.eat("OP", "{");
    this.skipNewlines();
    const body: Stmt[] = [];
    while (!this.at("OP", "}") && !this.at("EOF")) {
      const s = this.parseStmt();
      if (s) body.push(s);
      this.skipNewlines();
    }
    this.eat("OP", "}");
    return body;
  }

  private parseStmt(): Stmt | null {
    if (this.at("OP", "{")) return { kind: "block", body: this.parseBlock() };
    if (this.at("OP", ";") || this.at("NEWLINE")) { this.next(); return null; }
    if (this.at("KEYWORD", "if")) return this.parseIf();
    if (this.at("KEYWORD", "while")) return this.parseWhile();
    if (this.at("KEYWORD", "do")) return this.parseDoWhile();
    if (this.at("KEYWORD", "for")) return this.parseFor();
    if (this.at("KEYWORD", "break")) { this.next(); this.eatStmtEnd(); return { kind: "break" }; }
    if (this.at("KEYWORD", "continue")) { this.next(); this.eatStmtEnd(); return { kind: "continue" }; }
    if (this.at("KEYWORD", "next")) { this.next(); this.eatStmtEnd(); return { kind: "next" }; }
    if (this.at("KEYWORD", "print")) return this.parsePrint();
    if (this.at("KEYWORD", "printf")) return this.parsePrintf();
    // Expression statement
    const expr = this.parseExpr();
    this.eatStmtEnd();
    return { kind: "expr", expr };
  }

  private eatStmtEnd(): void {
    if (this.at("OP", ";") || this.at("NEWLINE")) this.next();
  }

  private parseIf(): Stmt {
    this.eat("KEYWORD", "if");
    this.eat("OP", "(");
    const cond = this.parseExpr();
    this.eat("OP", ")");
    this.skipNewlines();
    const then: Stmt[] = this.at("OP", "{") ? this.parseBlock() : compactStmt(this.parseStmt());
    let els: Stmt[] | null = null;
    this.skipNewlines();
    if (this.at("KEYWORD", "else")) {
      this.next();
      this.skipNewlines();
      els = this.at("OP", "{") ? this.parseBlock() : compactStmt(this.parseStmt());
    }
    return { kind: "if", cond, then, else: els };
  }

  private parseWhile(): Stmt {
    this.eat("KEYWORD", "while");
    this.eat("OP", "(");
    const cond = this.parseExpr();
    this.eat("OP", ")");
    this.skipNewlines();
    const body = this.at("OP", "{") ? this.parseBlock() : compactStmt(this.parseStmt());
    return { kind: "while", cond, body };
  }

  private parseDoWhile(): Stmt {
    this.eat("KEYWORD", "do");
    this.skipNewlines();
    const body = this.at("OP", "{") ? this.parseBlock() : compactStmt(this.parseStmt());
    this.skipNewlines();
    this.eat("KEYWORD", "while");
    this.eat("OP", "(");
    const cond = this.parseExpr();
    this.eat("OP", ")");
    this.eatStmtEnd();
    return { kind: "doWhile", body, cond };
  }

  private parseFor(): Stmt {
    this.eat("KEYWORD", "for");
    this.eat("OP", "(");
    // for (k in arr)
    if (this.peek().type === "IDENT" && this.peek(1).type === "KEYWORD" && this.peek(1).value === "in") {
      const key = this.next().value;
      this.next(); // 'in'
      const arr = this.eat("IDENT").value;
      this.eat("OP", ")");
      this.skipNewlines();
      const body = this.at("OP", "{") ? this.parseBlock() : compactStmt(this.parseStmt());
      return { kind: "forIn", key, arr, body };
    }
    // C-style for (init; cond; update)
    let init: Stmt | null = null;
    if (!this.at("OP", ";")) {
      // parse as expr-statement without consuming terminator
      const expr = this.parseExpr();
      init = { kind: "expr", expr };
    }
    this.eat("OP", ";");
    let cond: Expr | null = null;
    if (!this.at("OP", ";")) cond = this.parseExpr();
    this.eat("OP", ";");
    let update: Stmt | null = null;
    if (!this.at("OP", ")")) {
      const expr = this.parseExpr();
      update = { kind: "expr", expr };
    }
    this.eat("OP", ")");
    this.skipNewlines();
    const body = this.at("OP", "{") ? this.parseBlock() : compactStmt(this.parseStmt());
    return { kind: "for", init, cond, update, body };
  }

  private parsePrint(): Stmt {
    this.eat("KEYWORD", "print");
    const args: Expr[] = [];
    if (!this.at("NEWLINE") && !this.at("OP", ";") && !this.at("OP", "}") && !this.at("EOF")) {
      args.push(this.parseExprNoComma());
      while (this.at("OP", ",")) {
        this.next();
        args.push(this.parseExprNoComma());
      }
    }
    this.eatStmtEnd();
    return { kind: "print", args, redir: null };
  }

  private parsePrintf(): Stmt {
    this.eat("KEYWORD", "printf");
    const args: Expr[] = [];
    if (!this.at("NEWLINE") && !this.at("OP", ";") && !this.at("OP", "}") && !this.at("EOF")) {
      args.push(this.parseExprNoComma());
      while (this.at("OP", ",")) {
        this.next();
        args.push(this.parseExprNoComma());
      }
    }
    this.eatStmtEnd();
    return { kind: "printf", args, redir: null };
  }

  /** Parse an expression, but stop at top-level comma (for print args). */
  private parseExprNoComma(): Expr {
    return this.parseTernary();
  }

  private parseExpr(): Expr {
    return this.parseTernary();
  }

  private parseTernary(): Expr {
    const cond = this.parseLogicalOr();
    if (this.at("OP", "?")) {
      this.next();
      const then = this.parseExpr();
      this.eat("OP", ":");
      const els = this.parseExpr();
      return { kind: "ternary", cond, then, else: els };
    }
    return cond;
  }

  private parseLogicalOr(): Expr {
    let left = this.parseLogicalAnd();
    while (this.at("OP", "||")) {
      this.next();
      const right = this.parseLogicalAnd();
      left = { kind: "binary", op: "||", left, right };
    }
    return left;
  }

  private parseLogicalAnd(): Expr {
    let left = this.parseIn();
    while (this.at("OP", "&&")) {
      this.next();
      const right = this.parseIn();
      left = { kind: "binary", op: "&&", left, right };
    }
    return left;
  }

  private parseIn(): Expr {
    let left = this.parseMatch();
    while (this.peek().type === "IDENT" && this.peek(1).type === "KEYWORD" && this.peek(1).value === "in") {
      // Actually `expr in arr` — but only valid when expr is in parentheses
      // in awk. We'll skip this for now since arrays aren't supported.
      break;
    }
    return left;
  }

  private parseMatch(): Expr {
    let left = this.parseComparison();
    while (this.at("OP", "~") || this.at("OP", "!~")) {
      const op = this.next().value;
      const right = this.parseComparison();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseComparison(): Expr {
    let left = this.parseConcat();
    while (this.at("OP", "==") || this.at("OP", "!=") || this.at("OP", "<") || this.at("OP", ">") || this.at("OP", "<=") || this.at("OP", ">=")) {
      const op = this.next().value;
      const right = this.parseConcat();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  /** Concatenation: whitespace juxtaposition of two non-operator primaries. */
  private parseConcat(): Expr {
    const parts: Expr[] = [this.parseAdd()];
    while (this.canStartPrimary()) {
      parts.push(this.parseAdd());
    }
    if (parts.length === 1) return parts[0];
    return { kind: "concat", parts };
  }

  private canStartPrimary(): boolean {
    const t = this.peek();
    if (t.type === "NUMBER" || t.type === "STRING" || t.type === "REGEX" || t.type === "IDENT" || t.type === "FUNC") return true;
    if (t.type === "FIELD") return true;
    if (t.type === "OP" && (t.value === "(" || t.value === "!" || t.value === "-" || t.value === "+")) return true;
    return false;
  }

  private parseAdd(): Expr {
    let left = this.parseMul();
    while (this.at("OP", "+") || this.at("OP", "-")) {
      const op = this.next().value;
      const right = this.parseMul();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseMul(): Expr {
    let left = this.parsePow();
    while (this.at("OP", "*") || this.at("OP", "/") || this.at("OP", "%")) {
      const op = this.next().value;
      const right = this.parsePow();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parsePow(): Expr {
    let left = this.parseUnary();
    while (this.at("OP", "^") || this.at("OP", "**")) {
      const op = this.next().value === "**" ? "^" : "^";
      const right = this.parseUnary();
      left = { kind: "binary", op: "^", left, right };
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.at("OP", "!")) { this.next(); return { kind: "unary", op: "!", operand: this.parseUnary(), prefix: true }; }
    if (this.at("OP", "-")) { this.next(); return { kind: "unary", op: "-", operand: this.parseUnary(), prefix: true }; }
    if (this.at("OP", "+")) { this.next(); return this.parseUnary(); }
    if (this.at("OP", "++") || this.at("OP", "--")) {
      const op = this.next().value;
      const operand = this.parseUnary();
      return { kind: "unary", op, operand, prefix: true };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expr {
    let e = this.parsePrimary();
    // postfix ++ / --
    while (this.at("OP", "++") || this.at("OP", "--")) {
      const op = this.next().value;
      e = { kind: "unary", op, operand: e, prefix: false };
    }
    return e;
  }

  private parsePrimary(): Expr {
    const t = this.peek();
    if (t.type === "NUMBER") { this.next(); return { kind: "num", value: parseFloat(t.value) }; }
    if (t.type === "STRING") { this.next(); return { kind: "str", value: t.value }; }
    if (t.type === "REGEX") {
      this.next();
      const m = /^\/(.*)\/([gimsx]*)$/.exec(t.value)!;
      return { kind: "regex", source: m[1], flags: m[2] };
    }
    if (t.type === "FIELD") {
      this.next();
      if (/^\d+$/.test(t.value)) {
        return { kind: "field", index: { kind: "num", value: parseInt(t.value, 10) } };
      }
      // $(expr)
      const innerTokens = tokenize(t.value.slice(1, -1));
      const inner = new Parser(innerTokens).parseExpr();
      return { kind: "field", index: inner };
    }
    if (t.type === "IDENT") {
      this.next();
      // Array indexing arr[expr]
      if (this.at("OP", "[")) {
        this.next();
        const idx = this.parseExpr();
        this.eat("OP", "]");
        return { kind: "index", arr: t.value, index: idx };
      }
      // Assignment?
      if (this.at("OP", "=") || this.at("OP", "+=") || this.at("OP", "-=") || this.at("OP", "*=") || this.at("OP", "/=") || this.at("OP", "%=") || this.at("OP", "^=") || this.at("OP", "**=")) {
        const op = this.next().value;
        const value = this.parseExpr();
        return { kind: "assign", op, target: { kind: "var", name: t.value }, value };
      }
      return { kind: "var", name: t.value };
    }
    if (t.type === "FUNC") {
      this.next();
      this.eat("OP", "(");
      const args: Expr[] = [];
      if (!this.at("OP", ")")) {
        args.push(this.parseExpr());
        while (this.at("OP", ",")) { this.next(); args.push(this.parseExpr()); }
      }
      this.eat("OP", ")");
      return { kind: "call", name: t.value, args };
    }
    if (t.type === "OP" && t.value === "(") {
      this.next();
      // grouping — but could be $(...) — handled by FIELD
      const e = this.parseExpr();
      this.eat("OP", ")");
      return e;
    }
    throw new Error(`Unexpected token ${t.type} ${JSON.stringify(t.value)} at ${t.pos}`);
  }
}

function compactStmt(s: Stmt | null): Stmt[] {
  if (!s) return [];
  return [s];
}

// ---------------------------------------------------------------------------
// Evaluator
// ---------------------------------------------------------------------------

class BreakSignal { }
class ContinueSignal { }
class NextSignal { }

interface AwkArray {
  // Simple associative array (only used by split / for-in).
  map: Map<string, number | string>;
}

class Interpreter {
  private vars: Map<string, number | string | AwkArray> = new Map();
  private fields: string[] = [""]; // fields[0] = $0, fields[1] = $1, ...
  private output: string[] = [];
  private nr = 0;
  private fnr = 0;
  private nf = 0;
  private rstart = 0;
  private rlength = -1;
  private fs: RegExp;
  private ofs: string;
  private ors: string;
  private rs: string;
  private program: Program;
  private input: string;

  constructor(program: Program, input: string, cliVars: AwkVariable[], fsStr: string, ofsStr: string) {
    this.program = program;
    this.input = input;
    // FS
    this.fs = compileFs(fsStr);
    this.ofs = ofsStr || " ";
    this.ors = "\n";
    this.rs = "\n";
    // Pre-set special vars
    this.vars.set("FS", fsStr || " ");
    this.vars.set("OFS", this.ofs);
    this.vars.set("ORS", this.ors);
    this.vars.set("RS", this.rs);
    this.vars.set("NR", 0);
    this.vars.set("FNR", 0);
    this.vars.set("NF", 0);
    this.vars.set("RSTART", 0);
    this.vars.set("RLENGTH", -1);
    this.vars.set("SUBSEP", "\x1c");
    // Apply -v vars
    for (const v of cliVars) {
      if (v.name && /^[A-Za-z_][A-Za-z0-9_]*$/.test(v.name)) {
        const num = tryParseNumber(v.value);
        this.vars.set(v.name, num !== null ? num : v.value);
      }
    }
  }

  run(): { output: string; error: string | null } {
    try {
      // BEGIN rules
      for (const r of this.program.rules) {
        if (r.kind === "BEGIN") {
          this.execBlock(r.action);
        }
      }
      // Re-read FS in case BEGIN changed it
      const fsVar = this.vars.get("FS");
      if (typeof fsVar === "string") this.fs = compileFs(fsVar);
      const ofsVar = this.vars.get("OFS");
      if (typeof ofsVar === "string") this.ofs = ofsVar || " ";
      const orsVar = this.vars.get("ORS");
      if (typeof orsVar === "string") this.ors = orsVar;
      const rsVar = this.vars.get("RS");
      if (typeof rsVar === "string") this.rs = rsVar || "\n";

      // Main loop — always iterate over records (even with BEGIN/END only)
      // so NR/FNR/NF reflect the input. If there are no main rules, no
      // per-record action runs, but the counters still increment.
      const records = this.input.length === 0 ? [] : this.splitRecords(this.input, this.rs);
      for (const rec of records) {
        this.nr++;
        this.fnr++;
        this.setRecord(rec);
        try {
          for (const r of this.program.rules) {
            if (r.kind !== "main") continue;
            if (r.pattern === null || this.evalPattern(r.pattern)) {
              this.execBlock(r.action);
            }
          }
        } catch (e) {
          if (e instanceof NextSignal) continue;
          throw e;
        }
      }
      // END rules
      for (const r of this.program.rules) {
        if (r.kind === "END") {
          this.execBlock(r.action);
        }
      }
      return { output: this.output.join(""), error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { output: this.output.join(""), error: msg };
    }
  }

  private splitRecords(input: string, rs: string): string[] {
    if (rs === "\n") {
      return input.split("\n");
    }
    if (rs === " ") {
      // awk quirk: RS=" " splits on runs of whitespace including newlines
      return input.split(/\s+/).filter((s, i, arr) => !(i === 0 && s === "") && !(i === arr.length - 1 && s === ""));
    }
    // Regex RS
    try {
      const re = new RegExp(rs, "g");
      return input.split(re);
    } catch {
      return input.split(rs);
    }
  }

  private setRecord(rec: string): void {
    this.fields = [rec];
    const fs = this.fs;
    if (fs.source === "" || (fs.source === "\\s+" && fs.flags === "")) {
      // default whitespace split
      const trimmed = rec.replace(/^\s+/, "");
      if (trimmed === "") {
        // no fields
      } else {
        const parts = trimmed.split(/[ \t]+/);
        for (const p of parts) this.fields.push(p);
      }
    } else {
      // Regex split. JS split with capturing groups includes captures, so
      // we strip them by using a non-capturing transform.
      const parts = rec.split(fs);
      for (const p of parts) this.fields.push(p);
    }
    this.nf = this.fields.length - 1;
    this.vars.set("NF", this.nf);
    this.vars.set("NR", this.nr);
    this.vars.set("FNR", this.fnr);
  }

  private evalPattern(p: Expr): boolean {
    // Bare regex pattern
    if (p.kind === "regex") {
      const re = new RegExp(p.source, p.flags.includes("g") ? p.flags : p.flags + "g");
      re.lastIndex = 0;
      return re.test(this.fields[0]);
    }
    const v = this.evalExpr(p);
    return this.truthy(v);
  }

  private execBlock(stmts: Stmt[]): void {
    for (const s of stmts) {
      this.execStmt(s);
    }
  }

  private execStmt(s: Stmt): void {
    switch (s.kind) {
      case "print": {
        if (s.args.length === 0) {
          this.output.push(this.fields[0] + this.ors);
        } else {
          const parts = s.args.map((a) => this.toStr(this.evalExpr(a)));
          this.output.push(parts.join(this.ofs) + this.ors);
        }
        return;
      }
      case "printf": {
        if (s.args.length === 0) return;
        const fmt = this.toStr(this.evalExpr(s.args[0]));
        const rest = s.args.slice(1).map((a) => this.evalExpr(a));
        this.output.push(awkSprintf(fmt, rest) + "");
        return;
      }
      case "expr": {
        this.evalExpr(s.expr);
        return;
      }
      case "if": {
        if (this.truthy(this.evalExpr(s.cond))) this.execBlock(s.then);
        else if (s.else) this.execBlock(s.else);
        return;
      }
      case "while": {
        while (this.truthy(this.evalExpr(s.cond))) {
          try { this.execBlock(s.body); }
          catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
        }
        return;
      }
      case "doWhile": {
        do {
          try { this.execBlock(s.body); }
          catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
        } while (this.truthy(this.evalExpr(s.cond)));
        return;
      }
      case "for": {
        if (s.init) this.execStmt(s.init);
        while (s.cond === null || this.truthy(this.evalExpr(s.cond))) {
          try { this.execBlock(s.body); }
          catch (e) {
            if (e instanceof BreakSignal) break;
            if (e instanceof ContinueSignal) continue;
            throw e;
          }
          if (s.update) this.execStmt(s.update);
        }
        return;
      }
      case "forIn": {
        const arr = this.vars.get(s.arr);
        if (arr && typeof arr === "object" && "map" in (arr as AwkArray)) {
          const a = arr as AwkArray;
          for (const k of Array.from(a.map.keys())) {
            this.vars.set(s.key, k);
            try { this.execBlock(s.body); }
            catch (e) {
              if (e instanceof BreakSignal) break;
              if (e instanceof ContinueSignal) continue;
              throw e;
            }
          }
        }
        return;
      }
      case "break": throw new BreakSignal();
      case "continue": throw new ContinueSignal();
      case "next": throw new NextSignal();
      case "block": this.execBlock(s.body); return;
    }
  }

  private evalExpr(e: Expr): number | string {
    switch (e.kind) {
      case "num": return e.value;
      case "str": return e.value;
      case "regex": {
        const re = new RegExp(e.source, e.flags.includes("g") ? e.flags : e.flags + "g");
        re.lastIndex = 0;
        return re.test(this.fields[0]) ? 1 : 0;
      }
      case "field": {
        const idx = this.toNum(this.evalExpr(e.index));
        if (idx === 0) return this.fields[0] ?? "";
        return this.fields[idx] ?? "";
      }
      case "var": {
        if (e.name === "NF") return this.nf;
        if (e.name === "NR") return this.nr;
        if (e.name === "FNR") return this.fnr;
        if (e.name === "RSTART") return this.rstart;
        if (e.name === "RLENGTH") return this.rlength;
        const v = this.vars.get(e.name);
        if (v === undefined) return "";
        if (typeof v === "object") return ""; // array
        return v;
      }
      case "assign": {
        const target = e.target;
        if (target.kind !== "var" && target.kind !== "field") {
          throw new Error("Invalid assignment target");
        }
        const cur = e.op === "=" ? 0 : this.toNum(this.readLvalue(target));
        const rhs = this.evalExpr(e.value);
        let result: number | string;
        if (e.op === "=") {
          result = rhs;
        } else {
          const r = this.toNum(rhs);
          if (e.op === "+=") result = cur + r;
          else if (e.op === "-=") result = cur - r;
          else if (e.op === "*=") result = cur * r;
          else if (e.op === "/=") result = cur / r;
          else if (e.op === "%=") result = cur % r;
          else if (e.op === "^=" || e.op === "**=") result = Math.pow(cur, r);
          else throw new Error(`Unknown assignment op ${e.op}`);
        }
        this.writeLvalue(target, result);
        return result;
      }
      case "unary": {
        if (e.op === "!") return this.truthy(this.evalExpr(e.operand)) ? 0 : 1;
        if (e.op === "-") return -this.toNum(this.evalExpr(e.operand));
        if (e.op === "++" || e.op === "--") {
          const cur = this.toNum(this.readLvalue(e.operand));
          const next = e.op === "++" ? cur + 1 : cur - 1;
          this.writeLvalue(e.operand, next);
          return e.prefix ? next : cur;
        }
        throw new Error(`Unknown unary op ${e.op}`);
      }
      case "binary": {
        return this.evalBinary(e.op, e.left, e.right);
      }
      case "ternary": {
        return this.truthy(this.evalExpr(e.cond)) ? this.evalExpr(e.then) : this.evalExpr(e.else);
      }
      case "concat": {
        return e.parts.map((p) => this.toStr(this.evalExpr(p))).join("");
      }
      case "call": {
        return this.evalCall(e.name, e.args);
      }
      case "index": {
        const arr = this.vars.get(e.arr);
        if (arr && typeof arr === "object" && "map" in (arr as AwkArray)) {
          const key = this.toStr(this.evalExpr(e.index));
          const v = (arr as AwkArray).map.get(key);
          return v === undefined ? "" : v;
        }
        return "";
      }
      case "in": {
        const arr = this.vars.get(e.arr);
        if (arr && typeof arr === "object" && "map" in (arr as AwkArray)) {
          const key = this.toStr(this.evalExpr(e.key));
          return (arr as AwkArray).map.has(key) ? 1 : 0;
        }
        return 0;
      }
    }
  }

  private evalBinary(op: string, leftE: Expr, rightE: Expr): number | string {
    // Short-circuit
    if (op === "&&") {
      return this.truthy(this.evalExpr(leftE)) && this.truthy(this.evalExpr(rightE)) ? 1 : 0;
    }
    if (op === "||") {
      return this.truthy(this.evalExpr(leftE)) || this.truthy(this.evalExpr(rightE)) ? 1 : 0;
    }
    const left = this.evalExpr(leftE);
    const right = this.evalExpr(rightE);
    switch (op) {
      case "+": return this.toNum(left) + this.toNum(right);
      case "-": return this.toNum(left) - this.toNum(right);
      case "*": return this.toNum(left) * this.toNum(right);
      case "/": return this.toNum(left) / this.toNum(right);
      case "%": return this.toNum(left) % this.toNum(right);
      case "^": return Math.pow(this.toNum(left), this.toNum(right));
      case "==": return this.cmpEq(left, right) ? 1 : 0;
      case "!=": return !this.cmpEq(left, right) ? 1 : 0;
      case "<": return this.cmpLt(left, right) ? 1 : 0;
      case ">": return this.cmpLt(right, left) ? 1 : 0;
      case "<=": return !this.cmpLt(right, left) ? 1 : 0;
      case ">=": return !this.cmpLt(left, right) ? 1 : 0;
      case "~": {
        const reSrc = rightE.kind === "regex" ? rightE.source : this.toStr(right);
        const reFlg = rightE.kind === "regex" ? rightE.flags : "g";
        try {
          const re = new RegExp(reSrc, reFlg.includes("g") ? reFlg : reFlg + "g");
          re.lastIndex = 0;
          return re.test(this.toStr(left)) ? 1 : 0;
        } catch {
          return 0;
        }
      }
      case "!~": {
        const reSrc = rightE.kind === "regex" ? rightE.source : this.toStr(right);
        const reFlg = rightE.kind === "regex" ? rightE.flags : "g";
        try {
          const re = new RegExp(reSrc, reFlg.includes("g") ? reFlg : reFlg + "g");
          re.lastIndex = 0;
          return re.test(this.toStr(left)) ? 0 : 1;
        } catch {
          return 1;
        }
      }
    }
    throw new Error(`Unknown binary op ${op}`);
  }

  private cmpEq(a: number | string, b: number | string): boolean {
    if (typeof a === "number" && typeof b === "number") return a === b;
    // If both look numeric, compare as numbers
    if (typeof a === "string" && typeof b === "string") {
      const na = tryParseNumber(a);
      const nb = tryParseNumber(b);
      if (na !== null && nb !== null) return na === nb;
      return a === b;
    }
    // Mixed — coerce to number if possible
    const na = typeof a === "number" ? a : tryParseNumber(a);
    const nb = typeof b === "number" ? b : tryParseNumber(b);
    if (na !== null && nb !== null) return na === nb;
    return this.toStr(a) === this.toStr(b);
  }

  private cmpLt(a: number | string, b: number | string): boolean {
    if (typeof a === "number" && typeof b === "number") return a < b;
    if (typeof a === "string" && typeof b === "string") {
      const na = tryParseNumber(a);
      const nb = tryParseNumber(b);
      if (na !== null && nb !== null) return na < nb;
      return a < b;
    }
    const na = typeof a === "number" ? a : tryParseNumber(a);
    const nb = typeof b === "number" ? b : tryParseNumber(b);
    if (na !== null && nb !== null) return na < nb;
    return this.toStr(a) < this.toStr(b);
  }

  private evalCall(name: string, args: Expr[]): number | string {
    switch (name) {
      case "__print_dollar0": {
        this.output.push(this.fields[0] + this.ors);
        return "";
      }
      case "length": {
        if (args.length === 0) return this.fields[0].length;
        const v = this.evalExpr(args[0]);
        return this.toStr(v).length;
      }
      case "tolower": {
        const v = args.length > 0 ? this.evalExpr(args[0]) : this.fields[0];
        return this.toStr(v).toLowerCase();
      }
      case "toupper": {
        const v = args.length > 0 ? this.evalExpr(args[0]) : this.fields[0];
        return this.toStr(v).toUpperCase();
      }
      case "substr": {
        const s = this.toStr(this.evalExpr(args[0]));
        const m = this.toNum(this.evalExpr(args[1]));
        const start = m < 1 ? 1 : m; // awk: 1-indexed; m<=0 → start=1, len adjusted
        let end: number;
        if (args.length >= 3) {
          const n = this.toNum(this.evalExpr(args[2]));
          end = start + n - 1;
          if (m < 1) end = m + n - 1 < 0 ? 0 : m + n;
          if (end < start) end = start - 1;
        } else {
          end = s.length;
        }
        const from = Math.max(0, start - 1);
        const to = Math.max(0, end);
        return s.substring(from, to);
      }
      case "int": {
        const x = this.toNum(this.evalExpr(args[0]));
        return x < 0 ? Math.ceil(x) : Math.floor(x);
      }
      case "sqrt": {
        return Math.sqrt(this.toNum(this.evalExpr(args[0])));
      }
      case "index": {
        const s = this.toStr(this.evalExpr(args[0]));
        const t = this.toStr(this.evalExpr(args[1]));
        const idx = s.indexOf(t);
        return idx < 0 ? 0 : idx + 1;
      }
      case "split": {
        const s = this.toStr(this.evalExpr(args[0]));
        const arrName = args[1].kind === "var" ? args[1].name : "";
        if (!arrName) throw new Error("split: second argument must be an array");
        let sep: RegExp;
        if (args.length >= 3) {
          const sepVal = args[2].kind === "regex" ? args[2].source : this.toStr(this.evalExpr(args[2]));
          sep = compileFs(sepVal);
        } else {
          sep = this.fs;
        }
        const parts = sep.source === "" || (sep.source === "\\s+" && sep.flags === "")
          ? s.replace(/^\s+/, "").split(/[ \t]+/)
          : s.split(sep);
        const arr: AwkArray = { map: new Map() };
        parts.forEach((p, i) => arr.map.set(String(i + 1), p));
        this.vars.set(arrName, arr);
        return parts.length;
      }
      case "sub":
      case "gsub": {
        const reSrc = args[0].kind === "regex" ? args[0].source : this.toStr(this.evalExpr(args[0]));
        const reFlg = args[0].kind === "regex" ? args[0].flags : "";
        const repl = this.toStr(this.evalExpr(args[1]));
        let target: { get: () => string; set: (v: string) => void };
        if (args.length >= 3) {
          const t = args[2];
          target = {
            get: () => this.toStr(this.evalExpr(t)),
            set: (v) => this.writeLvalue(t, v),
          };
        } else {
          target = {
            get: () => this.fields[0],
            set: (v) => { this.fields[0] = v; },
          };
        }
        const s = target.get();
        try {
          const flag = name === "gsub" ? "g" : "";
          const re = new RegExp(reSrc, flag);
          const matches = s.match(re);
          if (!matches) return 0;
          let count = name === "gsub" ? matches.length : 1;
          if (name === "gsub") {
            const newStr = s.replace(re, expandReplacement(repl, matches));
            target.set(newStr);
          } else {
            // Replace only first
            const singleRe = new RegExp(reSrc, "");
            const newStr = s.replace(singleRe, (m) => expandReplacement(repl, [m]));
            target.set(newStr);
          }
          return count;
        } catch {
          return 0;
        }
      }
      case "match": {
        const s = this.toStr(this.evalExpr(args[0]));
        const reSrc = args[1].kind === "regex" ? args[1].source : this.toStr(this.evalExpr(args[1]));
        try {
          const re = new RegExp(reSrc, "");
          const m = s.match(re);
          if (!m) { this.rstart = 0; this.rlength = -1; this.vars.set("RSTART", 0); this.vars.set("RLENGTH", -1); return 0; }
          this.rstart = (m.index ?? 0) + 1;
          this.rlength = m[0].length;
          this.vars.set("RSTART", this.rstart);
          this.vars.set("RLENGTH", this.rlength);
          return this.rstart;
        } catch {
          this.rstart = 0; this.rlength = -1;
          this.vars.set("RSTART", 0); this.vars.set("RLENGTH", -1);
          return 0;
        }
      }
      case "sprintf": {
        const fmt = this.toStr(this.evalExpr(args[0]));
        const rest = args.slice(1).map((a) => this.evalExpr(a));
        return awkSprintf(fmt, rest);
      }
    }
    throw new Error(`Unknown function ${name}`);
  }

  private readLvalue(e: Expr): number | string {
    if (e.kind === "var") {
      if (e.name === "NF") return this.nf;
      if (e.name === "NR") return this.nr;
      if (e.name === "FNR") return this.fnr;
      if (e.name === "RSTART") return this.rstart;
      if (e.name === "RLENGTH") return this.rlength;
      const v = this.vars.get(e.name);
      return v === undefined ? "" : (typeof v === "object" ? "" : v);
    }
    if (e.kind === "field") {
      const idx = this.toNum(this.evalExpr(e.index));
      if (idx === 0) return this.fields[0] ?? "";
      return this.fields[idx] ?? "";
    }
    throw new Error("Not an lvalue");
  }

  private writeLvalue(e: Expr, v: number | string): void {
    if (e.kind === "var") {
      this.vars.set(e.name, v);
      // Side-effect: assigning NF re-splits the record
      if (e.name === "NF") {
        const newNf = this.toNum(v);
        if (newNf < this.nf) {
          this.fields = this.fields.slice(0, newNf + 1);
        } else if (newNf > this.nf) {
          while (this.fields.length - 1 < newNf) this.fields.push("");
        }
        this.nf = newNf;
        this.rebuildDollar0();
      }
      return;
    }
    if (e.kind === "field") {
      const idx = this.toNum(this.evalExpr(e.index));
      if (idx === 0) {
        this.fields[0] = this.toStr(v);
      } else {
        while (this.fields.length - 1 < idx) this.fields.push("");
        this.fields[idx] = this.toStr(v);
        if (idx > this.nf) {
          this.nf = idx;
          this.vars.set("NF", this.nf);
        }
        this.rebuildDollar0();
      }
      return;
    }
    throw new Error("Not an lvalue");
  }

  private rebuildDollar0(): void {
    this.fields[0] = this.fields.slice(1).join(this.ofs);
  }

  private toNum(v: number | string): number {
    if (typeof v === "number") return v;
    if (v === "") return 0;
    const n = tryParseNumber(v);
    return n === null ? 0 : n;
  }

  private toStr(v: number | string): string {
    if (typeof v === "string") return v;
    if (!isFinite(v)) return v > 0 ? "inf" : (v < 0 ? "-inf" : "nan");
    if (Number.isInteger(v)) return String(v);
    // awk uses %.6g by default
    return formatG(v, 6);
  }

  private truthy(v: number | string): boolean {
    if (typeof v === "number") return v !== 0;
    // Non-empty string is true UNLESS it parses as the number 0
    if (v === "") return false;
    const n = tryParseNumber(v);
    if (n !== null) return n !== 0;
    return true;
  }
}

/** Compile an awk FS string into a JS RegExp. */
function compileFs(fs: string): RegExp {
  if (fs === "" || fs === " ") return new RegExp("[ \\t]+", "");
  // Decode escape sequences
  const decoded = fs
    .replace(/\\t/g, "\t")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\\\/g, "\\");
  // If single character, treat as literal
  if (decoded.length === 1) {
    const escaped = decoded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(escaped, "");
  }
  // Multi-character: try as regex first (e.g. [,:])
  try {
    new RegExp(decoded, "");
    return new RegExp(decoded, "");
  } catch {
    // Treat as literal multi-char string
    const escaped = decoded.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(escaped, "");
  }
}

/** Try to parse a string as a number the way awk does. Returns null if not numeric. */
function tryParseNumber(s: string): number | null {
  if (typeof s !== "string") return null;
  // Trim leading whitespace
  const trimmed = s.replace(/^\s+/, "");
  if (trimmed === "") return null;
  // Match a leading numeric prefix
  const m = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?/.exec(trimmed);
  if (!m) return null;
  // The matched prefix must consume at least one digit
  if (!/\d/.test(m[0])) return null;
  // Octal/hex
  const hexM = /^0[xX]([0-9a-fA-F]+)/.exec(trimmed);
  if (hexM) return parseInt(hexM[1], 16);
  return parseFloat(m[0]);
}

/** %g-like formatting (limited precision). */
function formatG(n: number, prec: number): string {
  if (Number.isInteger(n)) return String(n);
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < Math.pow(10, -4) || abs >= Math.pow(10, prec))) {
    return n.toExponential(prec - 1).replace(/\.?0+e/, "e");
  }
  const fixed = n.toFixed(prec);
  // Trim trailing zeros but keep at least one decimal if there is a fractional part
  return fixed.replace(/\.?0+$/, "");
}

/** Awk-style sprintf — supports %d %i %o %x %X %u %c %s %f %e %g %% with optional width/precision/flags. */
export function awkSprintf(fmt: string, args: Array<number | string>): string {
  let out = "";
  let i = 0;
  let argIdx = 0;
  while (i < fmt.length) {
    const c = fmt[i];
    if (c !== "%") { out += c; i++; continue; }
    i++;
    if (fmt[i] === "%") { out += "%"; i++; continue; }
    // Parse spec
    let spec = "%";
    // Flags
    while (i < fmt.length && "-+ #0".includes(fmt[i])) { spec += fmt[i]; i++; }
    // Width
    while (i < fmt.length && /\d/.test(fmt[i])) { spec += fmt[i]; i++; }
    // Precision
    if (fmt[i] === ".") {
      spec += ".";
      i++;
      while (i < fmt.length && /\d/.test(fmt[i])) { spec += fmt[i]; i++; }
    }
    // Conversion
    const conv = fmt[i];
    if (!conv) break;
    i++;
    spec += conv;
    const arg = argIdx < args.length ? args[argIdx++] : "";
    out += formatOne(spec, arg);
  }
  return out;
}

function formatOne(spec: string, arg: number | string): string {
  const m = /^%([-+ #0]*)(\d*)(?:\.(\d*))?([diouxXeEfgGsc])$/.exec(spec);
  if (!m) return spec;
  const [, flags, widthStr, precStr, conv] = m;
  const width = widthStr ? parseInt(widthStr, 10) : 0;
  const prec = precStr !== undefined && precStr !== "" ? parseInt(precStr, 10) : undefined;
  let str: string;
  switch (conv) {
    case "d":
    case "i":
    case "u": {
      const n = typeof arg === "number" ? Math.trunc(arg) : (tryParseNumber(arg) ?? 0) | 0;
      str = Math.abs(n).toString(10);
      if (prec !== undefined) str = str.padStart(prec, "0");
      if (n < 0) str = "-" + str;
      else if (flags.includes("+")) str = "+" + str;
      else if (flags.includes(" ")) str = " " + str;
      break;
    }
    case "o": {
      const n = typeof arg === "number" ? Math.trunc(arg) : (tryParseNumber(arg) ?? 0) | 0;
      str = (n >>> 0).toString(8);
      if (prec !== undefined) str = str.padStart(prec, "0");
      if (flags.includes("#") && str[0] !== "0") str = "0" + str;
      break;
    }
    case "x":
    case "X": {
      const n = typeof arg === "number" ? Math.trunc(arg) : (tryParseNumber(arg) ?? 0) | 0;
      str = (n >>> 0).toString(16);
      if (conv === "X") str = str.toUpperCase();
      if (prec !== undefined) str = str.padStart(prec, "0");
      if (flags.includes("#") && n !== 0) str = "0x" + str;
      break;
    }
    case "c": {
      if (typeof arg === "number") str = String.fromCharCode(arg & 0xff);
      else str = arg.toString().charAt(0);
      break;
    }
    case "s": {
      str = typeof arg === "number" ? formatG(arg, 6) : arg.toString();
      if (prec !== undefined) str = str.slice(0, prec);
      break;
    }
    case "f":
    case "F": {
      const n = typeof arg === "number" ? arg : (tryParseNumber(arg) ?? 0);
      const p = prec ?? 6;
      str = n.toFixed(p);
      if (n >= 0 && flags.includes("+")) str = "+" + str;
      else if (n >= 0 && flags.includes(" ")) str = " " + str;
      break;
    }
    case "e":
    case "E": {
      const n = typeof arg === "number" ? arg : (tryParseNumber(arg) ?? 0);
      const p = prec ?? 6;
      str = n.toExponential(p);
      if (conv === "E") str = str.toUpperCase();
      break;
    }
    case "g":
    case "G": {
      const n = typeof arg === "number" ? arg : (tryParseNumber(arg) ?? 0);
      const p = prec ?? 6;
      str = formatG(n, p);
      if (conv === "G") str = str.toUpperCase();
      break;
    }
    default: return spec;
  }
  // Apply width / justification
  if (str.length < width) {
    if (flags.includes("-")) str = str.padEnd(width, " ");
    else if (flags.includes("0") && !["s", "c"].includes(conv) && prec === undefined) {
      const neg = str.startsWith("-") || str.startsWith("+") || str.startsWith(" ");
      const sign = neg ? str[0] : "";
      str = sign + str.slice(neg ? 1 : 0).padStart(width - sign.length, "0");
    } else str = str.padStart(width, " ");
  }
  return str;
}

/** Expand & and \1..\9 in a sub/gsub replacement string. */
function expandReplacement(repl: string, matches: string[]): string {
  let out = "";
  for (let i = 0; i < repl.length; i++) {
    const c = repl[i];
    if (c === "\\" && i + 1 < repl.length) {
      const next = repl[i + 1];
      if (/[1-9]/.test(next)) {
        const idx = parseInt(next, 10);
        out += matches[idx] ?? "";
        i++;
      } else if (next === "&") { out += "&"; i++; }
      else if (next === "\\") { out += "\\"; i++; }
      else { out += next; i++; }
    } else if (c === "&") {
      out += matches[0] ?? "";
    } else {
      out += c;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public run API
// ---------------------------------------------------------------------------

export interface AwkRunOptions {
  /** Field separator (string). */
  fs?: string;
  /** Output field separator. */
  ofs?: string;
  /** -v variables. */
  variables?: AwkVariable[];
}

/** Parse + run an awk program against input. Pure function — no side effects. */
export function runAwk(programSrc: string, input: string, options: AwkRunOptions = {}): AwkRunResult {
  const normalizedInput = normalizeInput(input);
  const lineCount = normalizedInput === "" ? 0 : normalizedInput.split("\n").length;
  try {
    const tokens = tokenize(programSrc);
    const ast = new Parser(tokens).parseProgram();
    const interp = new Interpreter(
      ast,
      normalizedInput,
      options.variables ?? [],
      options.fs ?? "",
      options.ofs ?? "",
    );
    const { output, error } = interp.run();
    if (error) {
      return { output, error, exitStatus: 1, lineCount };
    }
    return { output, error: null, exitStatus: 0, lineCount };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { output: "", error: msg, exitStatus: 1, lineCount };
  }
}

/** Parse-only check — returns null if OK, error message otherwise. */
export function validateProgram(programSrc: string): string | null {
  try {
    const tokens = tokenize(programSrc);
    new Parser(tokens).parseProgram();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:awk-command-builder-tester:history";
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

export function buildShareUrl(program: string, input: string, fs: string): string {
  const params = new URLSearchParams();
  if (program) params.set("p", program);
  if (input) params.set("i", input);
  if (fs) params.set("f", fs);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export interface ShareParams {
  program: string;
  input: string;
  fs: string;
}

export function parseShareUrl(hash: string): ShareParams {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { program: "", input: "", fs: "" };
  const params = new URLSearchParams(clean);
  return {
    program: params.get("p") ?? "",
    input: params.get("i") ?? "",
    fs: params.get("f") ?? "",
  };
}
