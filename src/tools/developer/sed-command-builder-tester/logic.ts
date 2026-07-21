/**
 * sed Command Builder & Tester — pure logic.
 *
 * A small pure-JavaScript sed interpreter (no WASM, no network) plus a
 * visual builder, per-command explanation, reverse program explainer,
 * auto-delimiter selection, GNU-vs-BSD -i guidance, sample-text
 * library, recipe presets, history, and shareable URL.
 *
 * Supported sed subset:
 *
 *   s/search/replace/flags   substitute (flags: g i p N)
 *   d                        delete current line
 *   p                        print current line
 *   i\text                   insert text before line
 *   a\text                   append text after line
 *   c\text                   change (replace) line with text
 *   n                        next — read next input line
 *   q                        quit processing
 *   =                        print line number
 *
 * Addressing:
 *   N                        line number (1-based)
 *   $                        last line
 *   /regex/                  lines matching regex
 *   /regex/i                 case-insensitive address regex
 *   N,M                      range from line N to line M (inclusive)
 *   N,/regex/                from line N to next regex match
 *   /regex/,M                from regex to line M
 *   /re1/,/re2/              from first regex to second regex
 *   N~M                      GNU extension: every Mth line from N
 *
 * Flags & options:
 *   -n                       suppress auto-print
 *   -E / -r                  extended regex (ERE)
 *   -e SCRIPT                multiple scripts
 *   -i [SUFFIX]              in-place (preview only — never edits files)
 *
 * BRE vs ERE:
 *   In BRE (default), the metacharacters ( ) { } + ? | are literal
 *   unless escaped; use \( \) \{ \} \+ \? \| for the special meaning.
 *   In ERE (-E), they are special unescaped (matching JS regex).
 *
 * NOT supported: hold space (h H g G x), branches (b t :label), the
 * N/D multi-line commands, w file, r file, e command, l list, P, y.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SedCommandType =
  | "substitute"
  | "delete"
  | "print"
  | "insert"
  | "append"
  | "change"
  | "next"
  | "quit"
  | "lineNumber";

export type AddressType =
  | "none"
  | "line"
  | "last"
  | "regex"
  | "range";

export interface Address {
  type: AddressType;
  /** For "line": the 1-based line number. */
  line?: number;
  /** For "regex": the regex source (without delimiters). */
  regex?: string;
  /** For "regex": case-insensitive flag. */
  caseInsensitive?: boolean;
  /** For "range": the start address. */
  start?: Address;
  /** For "range": the end address. */
  end?: Address;
  /** For "range" with GNU ~ step: step value. */
  step?: number;
}

export interface SedCommand {
  type: SedCommandType;
  /** Line address (may be "none"). */
  address: Address;
  /** For substitute: the search regex. */
  search?: string;
  /** For substitute: the replacement string. */
  replace?: string;
  /** For substitute: flags string (g, i, p, N). */
  flags?: string;
  /** For substitute: the delimiter character. */
  delimiter?: string;
  /** For insert/append/change: the text. */
  text?: string;
  /** Original source string (for display). */
  source: string;
}

export interface SedConfig {
  /** -n flag. */
  suppressAutoPrint: boolean;
  /** -E / -r flag. */
  extendedRegex: boolean;
  /** -i flag (preview only). */
  inPlace: boolean;
  /** -i backup suffix (e.g. ".bak"). */
  inPlaceSuffix: string;
  /** GNU vs BSD/macOS — affects -i syntax in the generated command. */
  gnuMode: boolean;
  /** The list of commands. */
  commands: SedCommand[];
}

export interface SedExplanationItem {
  /** The command source. */
  command: string;
  /** Plain-English explanation. */
  explanation: string;
}

export interface SedBuildResult {
  /** The sed script string (what goes between the quotes). */
  script: string;
  /** Copy-ready shell command. */
  command: string;
  /** Per-command explanation items. */
  explanations: SedExplanationItem[];
}

export interface SedRunResult {
  /** Captured stdout. */
  output: string;
  /** Error message, if any. */
  error: string | null;
  /** Exit status (0 = OK, 1 = error). */
  exitStatus: number;
  /** Number of input lines processed. */
  lineCount: number;
  /** Number of lines in output. */
  outputLineCount: number;
}

export interface HistoryEntry {
  ts: number;
  script: string;
  inputPreview: string;
  command: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export interface SampleText {
  label: string;
  description: string;
  text: string;
}

export const SAMPLE_TEXTS: SampleText[] = [
  {
    label: "CSV sales",
    description: "Comma-separated sales records",
    text: "name,units,price\nAlice,10,9.99\nBob,3,14.50\nCarol,7,4.99\nDave,0,99.00\nEve,25,2.50",
  },
  {
    label: "Access log",
    description: "Apache-style log lines",
    text: "10.0.0.1 - - [01/Jan/2024:10:00:00] \"GET / HTTP/1.1\" 200 1024\n10.0.0.2 - - [01/Jan/2024:10:00:01] \"POST /login HTTP/1.1\" 302 0\n10.0.0.3 - - [01/Jan/2024:10:00:02] \"GET /missing HTTP/1.1\" 404 256\n10.0.0.4 - - [01/Jan/2024:10:00:03] \"GET /api HTTP/1.1\" 500 8192",
  },
  {
    label: "config.ini",
    description: "INI-style configuration",
    text: "[server]\nhost = localhost\nport = 8080\ndebug = true\n\n[database]\nhost = db.local\nport = 5432\nuser = admin",
  },
  {
    label: "Code (TS)",
    description: "TypeScript snippet",
    text: "function add(a: number, b: number): number {\n  return a + b;\n}\n\nconst result = add(2, 3);\nconsole.log(result);",
  },
  {
    label: "Word list",
    description: "One word per line",
    text: "apple\nbanana\ncherry\ndate\nelderberry\nfig\nguava",
  },
];

export interface Recipe {
  label: string;
  description: string;
  /** -e script fragment. */
  script: string;
  flags: { n: boolean; E: boolean; i: boolean };
  sampleLabel: string;
}

export const RECIPE_LIBRARY: Recipe[] = [
  {
    label: "Replace text",
    description: "Replace first 'foo' with 'bar' on each line",
    script: "s/foo/bar/",
    flags: { n: false, E: false, i: false },
    sampleLabel: "Word list",
  },
  {
    label: "Replace all (g flag)",
    description: "Replace every 'foo' with 'bar' on each line",
    script: "s/foo/bar/g",
    flags: { n: false, E: false, i: false },
    sampleLabel: "Word list",
  },
  {
    label: "Case-insensitive replace",
    description: "Replace 'Error' in any case with 'WARN'",
    script: "s/error/WARN/gi",
    flags: { n: false, E: false, i: false },
    sampleLabel: "Access log",
  },
  {
    label: "Delete matching lines",
    description: "Delete lines containing '404'",
    script: "/404/d",
    flags: { n: false, E: false, i: false },
    sampleLabel: "Access log",
  },
  {
    label: "Print only matching lines (-n)",
    description: "Show only lines containing 'GET'",
    script: "/GET/p",
    flags: { n: true, E: false, i: false },
    sampleLabel: "Access log",
  },
  {
    label: "Print line range",
    description: "Show lines 2 through 4 only",
    script: "2,4p",
    flags: { n: true, E: false, i: false },
    sampleLabel: "CSV sales",
  },
  {
    label: "Last line only",
    description: "Print only the last line",
    script: "$p",
    flags: { n: true, E: false, i: false },
    sampleLabel: "Word list",
  },
  {
    label: "Insert header",
    description: "Insert a header line before line 1",
    script: "1i\\# Generated report",
    flags: { n: false, E: false, i: false },
    sampleLabel: "CSV sales",
  },
  {
    label: "Append footer",
    description: "Append a footer line after the last line",
    script: "$a\\# End of file",
    flags: { n: false, E: false, i: false },
    sampleLabel: "Word list",
  },
  {
    label: "Change error lines",
    description: "Replace 500-status lines with a fixed message",
    script: "/500/c\\SERVER ERROR",
    flags: { n: false, E: false, i: false },
    sampleLabel: "Access log",
  },
  {
    label: "Backreference (ERE)",
    description: "Swap two comma-separated fields using \\1 and \\2",
    script: "s/^([^,]*),([^,]*)/\\2,\\1/",
    flags: { n: false, E: true, i: false },
    sampleLabel: "CSV sales",
  },
  {
    label: "Path replace (auto-delimiter)",
    description: "Replace /usr/local/bin with /opt/bin (uses | delimiter)",
    script: "s|/usr/local/bin|/opt/bin|g",
    flags: { n: false, E: false, i: false },
    sampleLabel: "Code (TS)",
  },
];

export const DEFAULT_CONFIG: SedConfig = {
  suppressAutoPrint: false,
  extendedRegex: false,
  inPlace: false,
  inPlaceSuffix: "",
  gnuMode: true,
  commands: [],
};

// ---------------------------------------------------------------------------
// Input normalization
// ---------------------------------------------------------------------------

/** Normalize CRLF → LF and trim a single trailing newline. */
export function normalizeInput(input: string): string {
  if (!input) return "";
  const lf = input.replace(/\r\n?/g, "\n");
  return lf.replace(/\n+$/, "");
}

// ---------------------------------------------------------------------------
// Shell quoting
// ---------------------------------------------------------------------------

/** Single-quote a string for the shell, escaping embedded quotes. */
export function shellQuote(s: string): string {
  if (s === "") return "''";
  if (!s.includes("'")) return `'${s}'`;
  return `'${s.replace(/'/g, "'\\''")}'`;
}

// ---------------------------------------------------------------------------
// Auto-delimiter selection
// ---------------------------------------------------------------------------

export const DELIMITER_CANDIDATES = ["/", "|", "#", "~", "^", "%", "@", "!", ";", ":", ",", "."];

/** Pick a delimiter that doesn't appear in search, replace, or flags. */
export function pickDelimiter(search: string, replace: string, preferred?: string): string {
  // If the preferred delimiter doesn't appear in search or replace, use it.
  if (preferred && !search.includes(preferred) && !replace.includes(preferred)) {
    return preferred;
  }
  for (const d of DELIMITER_CANDIDATES) {
    if (!search.includes(d) && !replace.includes(d)) {
      return d;
    }
  }
  // Fallback: escape any / in the strings and use /
  return "/";
}

// ---------------------------------------------------------------------------
// BRE → JS regex conversion
// ---------------------------------------------------------------------------

/**
 * Convert a sed BRE/ERE regex source into a JS RegExp source string.
 * In BRE (default), () {} + ? | are literal unless escaped with \.
 * In ERE (-E), they are special unescaped (matching JS regex).
 *
 * Backreference syntax \1..\9 is preserved in both. & in replacement
 * is handled separately by the substitute executor.
 */
export function breToJsRegex(source: string, extended: boolean): string {
  if (extended) {
    // ERE is close to JS regex. We just need to preserve backrefs and
    // make sure escape sequences pass through. JS regex syntax is a
    // superset, so we leave it alone except for empty alternation.
    return source;
  }
  // BRE → ERE conversion. We need to swap the meaning of:
  //   unescaped ( ) { } + ? |  →  literal
  //   escaped \( \) \{ \} \+ \? \|  →  special
  let out = "";
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === "\\") {
      const next = source[i + 1];
      if (next === "(" || next === ")" || next === "{" || next === "}" || next === "+" || next === "?" || next === "|") {
        // Escaped → special in ERE → drop the backslash
        out += next;
        i += 2;
      } else if (next === "n") { out += "\\n"; i += 2; }
      else if (next === "t") { out += "\\t"; i += 2; }
      else if (next === "1" || next === "2" || next === "3" || next === "4" || next === "5" || next === "6" || next === "7" || next === "8" || next === "9") {
        // Backreference — keep as \N
        out += "\\" + next;
        i += 2;
      } else {
        // Pass through other escapes
        out += "\\" + (next ?? "");
        i += 2;
      }
    } else if (c === "(" || c === ")" || c === "{" || c === "}" || c === "+" || c === "?" || c === "|") {
      // Unescaped metachar in BRE → literal → escape
      out += "\\" + c;
      i++;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Builder — individual command constructors
// ---------------------------------------------------------------------------

export function buildSubstitute(
  search: string,
  replace: string,
  flags: string = "",
  delimiter?: string,
): SedCommand {
  const d = pickDelimiter(search, replace, delimiter);
  // If the delimiter appears in search/replace we need to escape it.
  const esc = (s: string) => s.split(d).join(`\\${d}`);
  const script = `s${d}${esc(search)}${d}${esc(replace)}${d}${flags}`;
  return {
    type: "substitute",
    address: { type: "none" },
    search,
    replace,
    flags,
    delimiter: d,
    source: script,
  };
}

export function buildDelete(address: Address): SedCommand {
  const addrStr = formatAddress(address);
  return {
    type: "delete",
    address,
    source: `${addrStr}d`,
  };
}

export function buildPrint(address: Address): SedCommand {
  const addrStr = formatAddress(address);
  return {
    type: "print",
    address,
    source: `${addrStr}p`,
  };
}

export function buildInsert(address: Address, text: string): SedCommand {
  const addrStr = formatAddress(address);
  return {
    type: "insert",
    address,
    text,
    source: `${addrStr}i\\${text}`,
  };
}

export function buildAppend(address: Address, text: string): SedCommand {
  const addrStr = formatAddress(address);
  return {
    type: "append",
    address,
    text,
    source: `${addrStr}a\\${text}`,
  };
}

export function buildChange(address: Address, text: string): SedCommand {
  const addrStr = formatAddress(address);
  return {
    type: "change",
    address,
    text,
    source: `${addrStr}c\\${text}`,
  };
}

export function buildNext(address: Address): SedCommand {
  const addrStr = formatAddress(address);
  return {
    type: "next",
    address,
    source: `${addrStr}n`,
  };
}

export function buildQuit(address: Address): SedCommand {
  const addrStr = formatAddress(address);
  return {
    type: "quit",
    address,
    source: `${addrStr}q`,
  };
}

export function buildLineNumber(address: Address): SedCommand {
  const addrStr = formatAddress(address);
  return {
    type: "lineNumber",
    address,
    source: `${addrStr}=`,
  };
}

// ---------------------------------------------------------------------------
// Address formatting
// ---------------------------------------------------------------------------

export function formatAddress(addr: Address): string {
  if (!addr || addr.type === "none") return "";
  switch (addr.type) {
    case "line": return String(addr.line ?? 1);
    case "last": return "$";
    case "regex": return `/${addr.regex ?? ""}/${addr.caseInsensitive ? "i" : ""}`;
    case "range": {
      const s = formatAddress(addr.start ?? { type: "none" });
      const e = formatAddress(addr.end ?? { type: "none" });
      return `${s},${e}`;
    }
  }
  return "";
}

// ---------------------------------------------------------------------------
// Command parser — parse a sed script into commands
// ---------------------------------------------------------------------------

class ParseError extends Error { }

export function parseScript(script: string, extended: boolean): SedCommand[] {
  const commands: SedCommand[] = [];
  let i = 0;
  const src = script;
  const n = src.length;
  // Split into statements by ; or newline, but respect \n inside s/.../.../\n etc.
  // For simplicity, we parse character by character.
  while (i < n) {
    // Skip whitespace and statement separators
    while (i < n && (src[i] === " " || src[i] === "\t" || src[i] === ";" || src[i] === "\n")) i++;
    if (i >= n) break;
    // Skip comments
    if (src[i] === "#") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    const cmdStart = i;
    // Parse address
    const addr = parseAddress(src, i);
    i = addr.next;
    // Skip whitespace
    while (i < n && (src[i] === " " || src[i] === "\t")) i++;
    if (i >= n) {
      // Address without a command — error in real sed, but we'll be lenient.
      throw new ParseError(`Address without command at position ${cmdStart}`);
    }
    // Parse command letter
    const letter = src[i];
    i++;
    let cmd: SedCommand;
    switch (letter) {
      case "s": {
        // s<delim>search<delim>replace<delim>flags
        const delim = src[i] ?? "/";
        i++;
        const { search, replace, flags, next } = parseSubstituteBody(src, i, delim);
        i = next;
        cmd = {
          type: "substitute",
          address: addr.address,
          search,
          replace,
          flags,
          delimiter: delim,
          source: src.slice(cmdStart, i),
        };
        break;
      }
      case "d":
        cmd = { type: "delete", address: addr.address, source: src.slice(cmdStart, i) };
        break;
      case "p":
        cmd = { type: "print", address: addr.address, source: src.slice(cmdStart, i) };
        break;
      case "n":
        cmd = { type: "next", address: addr.address, source: src.slice(cmdStart, i) };
        break;
      case "q":
        cmd = { type: "quit", address: addr.address, source: src.slice(cmdStart, i) };
        break;
      case "=":
        cmd = { type: "lineNumber", address: addr.address, source: src.slice(cmdStart, i) };
        break;
      case "i":
      case "a":
      case "c": {
        // i\text  or  a\text  or  c\text
        // Skip whitespace
        while (i < n && (src[i] === " " || src[i] === "\t")) i++;
        let text = "";
        if (i < n && (src[i] === "\\" || src[i] === "\n")) {
          i++; // skip backslash or newline
          // Read to end of line (or ;)
          let buf = "";
          while (i < n && src[i] !== "\n" && src[i] !== ";") {
            if (src[i] === "\\" && i + 1 < n) {
              const e = src[i + 1];
              if (e === "n") buf += "\n";
              else if (e === "t") buf += "\t";
              else if (e === "\\") buf += "\\";
              else buf += e;
              i += 2;
            } else {
              buf += src[i];
              i++;
            }
          }
          text = buf;
        }
        const type = letter === "i" ? "insert" : letter === "a" ? "append" : "change";
        cmd = { type, address: addr.address, text, source: src.slice(cmdStart, i) };
        break;
      }
      default:
        throw new ParseError(`Unknown sed command '${letter}' at position ${i - 1}`);
    }
    commands.push(cmd);
  }
  return commands;
}

interface AddressParseResult {
  address: Address;
  next: number;
}

function parseAddress(src: string, i: number): AddressParseResult {
  const start = i;
  const first = parseSingleAddress(src, i);
  if (first === null) {
    return { address: { type: "none" }, next: i };
  }
  i = first.next;
  // Skip whitespace
  while (i < src.length && (src[i] === " " || src[i] === "\t")) i++;
  if (src[i] === ",") {
    i++;
    while (i < src.length && (src[i] === " " || src[i] === "\t")) i++;
    const second = parseSingleAddress(src, i);
    if (second === null) {
      throw new ParseError(`Expected second address at position ${i}`);
    }
    i = second.next;
    return {
      address: { type: "range", start: first.address, end: second.address },
      next: i,
    };
  }
  // GNU ~ step: N~M
  if (src[i] === "~") {
    i++;
    let numStr = "";
    while (i < src.length && /\d/.test(src[i])) { numStr += src[i]; i++; }
    const step = parseInt(numStr, 10);
    if (!isNaN(step) && step > 0) {
      return {
        address: { type: "range", start: first.address, end: { type: "line", line: NaN }, step },
        next: i,
      };
    }
  }
  void start;
  return { address: first.address, next: i };
}

function parseSingleAddress(src: string, i: number): { address: Address; next: number } | null {
  if (i >= src.length) return null;
  const c = src[i];
  if (c === "$") {
    return { address: { type: "last" }, next: i + 1 };
  }
  if (/\d/.test(c)) {
    let numStr = "";
    while (i < src.length && /\d/.test(src[i])) { numStr += src[i]; i++; }
    return { address: { type: "line", line: parseInt(numStr, 10) }, next: i };
  }
  if (c === "/") {
    // /regex/[i]
    i++;
    let re = "";
    while (i < src.length && src[i] !== "/") {
      if (src[i] === "\\" && i + 1 < src.length) {
        re += src[i] + src[i + 1];
        i += 2;
      } else {
        re += src[i];
        i++;
      }
    }
    if (i >= src.length) throw new ParseError("Unterminated regex address");
    i++; // skip closing /
    let ci = false;
    if (src[i] === "i" || src[i] === "I") { ci = true; i++; }
    return { address: { type: "regex", regex: re, caseInsensitive: ci }, next: i };
  }
  return null;
}

function parseSubstituteBody(
  src: string,
  i: number,
  delim: string,
): { search: string; replace: string; flags: string; next: number } {
  let search = "";
  while (i < src.length && src[i] !== delim) {
    if (src[i] === "\\" && i + 1 < src.length) {
      search += src[i] + src[i + 1];
      i += 2;
    } else {
      search += src[i];
      i++;
    }
  }
  if (i >= src.length) throw new ParseError("Unterminated s command search");
  i++; // skip delimiter
  let replace = "";
  while (i < src.length && src[i] !== delim) {
    if (src[i] === "\\" && i + 1 < src.length) {
      const next = src[i + 1];
      if (next === delim) {
        // Escaped delimiter in replacement — keep just the delimiter
        replace += delim;
        i += 2;
      } else {
        replace += src[i] + next;
        i += 2;
      }
    } else {
      replace += src[i];
      i++;
    }
  }
  if (i >= src.length) throw new ParseError("Unterminated s command replace");
  i++; // skip delimiter
  let flags = "";
  while (i < src.length && /[gpiImNxX0-9]/.test(src[i])) {
    flags += src[i];
    i++;
  }
  return { search, replace, flags, next: i };
}

// ---------------------------------------------------------------------------
// Per-command explanation
// ---------------------------------------------------------------------------

export function explainCommand(cmd: SedCommand, extended: boolean): string {
  const addr = cmd.address.type === "none" ? "every line" : `lines matching ${formatAddress(cmd.address)}`;
  switch (cmd.type) {
    case "substitute": {
      const parts: string[] = [];
      parts.push(`On ${addr}, replace the first match of the regex ${JSON.stringify(cmd.search ?? "")} with ${JSON.stringify(cmd.replace ?? "")}.`);
      const fl = cmd.flags ?? "";
      if (fl.includes("g")) parts.push("The g flag means replace ALL matches on each line, not just the first.");
      if (fl.includes("i") || fl.includes("I")) parts.push("The i flag makes the match case-insensitive.");
      if (fl.includes("p")) parts.push("The p flag prints the line if a substitution was made.");
      const numMatch = /\d/.exec(fl);
      if (numMatch) parts.push(`The ${numMatch[0]} flag means replace only the ${numMatch[0]}-th match on each line.`);
      if (/\(\)[^?]*|\\\(|\\\)/.test(cmd.search ?? "")) {
        if (extended) parts.push("Capture groups ( ) let you backreference matches in the replacement with \\1..\\9 or & for the whole match.");
      } else if (/\\\(|\\\)/.test(cmd.search ?? "")) {
        parts.push("BRE capture groups \\( \\) let you backreference matches in the replacement with \\1..\\9 or & for the whole match. Use -E to write ( ) unescaped.");
      }
      if ((cmd.replace ?? "").includes("&")) parts.push("In the replacement, & means the entire matched text.");
      if (cmd.delimiter && cmd.delimiter !== "/") parts.push(`The delimiter is ${JSON.stringify(cmd.delimiter)} (chosen because / appears in the search or replace string).`);
      return parts.join(" ");
    }
    case "delete":
      return `Delete ${addr} from the output. The line is removed entirely (no auto-print).`;
    case "print":
      return `Print ${addr} to stdout immediately. Usually combined with -n to suppress auto-print of every line.`;
    case "insert":
      return `Insert the text ${JSON.stringify(cmd.text ?? "")} before ${addr}. The original line still prints (unless -n).`;
    case "append":
      return `Append the text ${JSON.stringify(cmd.text ?? "")} after ${addr}. The original line still prints (unless -n).`;
    case "change":
      return `Replace ${addr} entirely with the text ${JSON.stringify(cmd.text ?? "")}. For a range, the text is emitted once at the end of the range.`;
    case "next":
      return `On ${addr}, print the current line (if auto-print is on) and read the next input line, replacing the pattern space.`;
    case "quit":
      return `Quit processing on ${addr}. Lines already buffered are printed; remaining input is discarded.`;
    case "lineNumber":
      return `Print the 1-based line number of ${addr}.`;
  }
}

export function explainConfig(config: SedConfig): SedExplanationItem[] {
  return config.commands.map((c) => ({
    command: c.source,
    explanation: explainCommand(c, config.extendedRegex),
  }));
}

// ---------------------------------------------------------------------------
// Build the script + command string
// ---------------------------------------------------------------------------

export function buildScript(config: SedConfig): string {
  return config.commands.map((c) => c.source).join("; ");
}

export function buildSedCommand(config: SedConfig): string {
  const args: string[] = [];
  if (config.suppressAutoPrint) args.push("-n");
  if (config.extendedRegex) args.push(config.gnuMode ? "-E" : "-E");
  if (config.inPlace) {
    if (config.gnuMode) {
      args.push(config.inPlaceSuffix ? `-i${config.inPlaceSuffix}` : "-i");
    } else {
      // BSD/macOS sed requires -i '' or -i SUFFIX
      args.push(config.inPlaceSuffix ? `-i${config.inPlaceSuffix}` : "-i ''");
    }
  }
  const script = buildScript(config);
  args.push(shellQuote(script));
  args.push("file");
  return `sed ${args.join(" ")}`;
}

export function buildSed(config: SedConfig): SedBuildResult {
  return {
    script: buildScript(config),
    command: buildSedCommand(config),
    explanations: explainConfig(config),
  };
}

// ---------------------------------------------------------------------------
// Reverse program explainer
// ---------------------------------------------------------------------------

export interface ProgramAnnotation {
  token: string;
  explanation: string;
}

/** Annotate each significant token in a sed script (reverse explainer). */
export function explainProgram(script: string, extended: boolean = false): ProgramAnnotation[] {
  const out: ProgramAnnotation[] = [];
  const seen = new Set<string>();
  const add = (token: string, explanation: string) => {
    const key = `${token}::${explanation}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ token, explanation });
  };
  if (!script || !script.trim()) return out;

  // Whole-script flags
  if (/\b-n\b/.test(script)) add("-n", "Suppress automatic printing of the pattern space after each cycle. Use the p command to print selectively.");
  if (/\b-E\b|\b-r\b/.test(script)) add("-E / -r", "Use Extended Regular Expressions (ERE). In ERE, ( ) { } + ? | are special unescaped; in BRE (default) you must escape them as \\( \\) \\{ \\} \\+ \\? \\|.");

  let commands: SedCommand[];
  try {
    commands = parseScript(script, extended);
  } catch {
    // If we can't parse, just return what we have so far.
    return out;
  }
  for (const c of commands) {
    add(c.source, explainCommand(c, extended));
  }

  // Backreference helper
  if (/\\[1-9]/.test(script)) {
    add("\\1..\\9", "Backreference — inserts the Nth capture group from the search regex. Group numbering is by opening-paren position left-to-right.");
  }
  if (script.includes("&")) {
    add("&", "In a replacement string, & means the entire text matched by the search regex. Use \\& for a literal ampersand.");
  }

  // Address syntax helpers
  if (/\$/.test(script)) {
    add("$", "Matches the last line of input.");
  }
  if (/\d+,\d+/.test(script)) {
    add("N,M", "Line range — apply the command to lines N through M (inclusive).");
  }
  if (/~\d+/.test(script)) {
    add("N~M", "GNU extension — every Mth line starting from line N. e.g. 0~2 = even lines, 1~3 = every 3rd line.");
  }

  return out;
}

// ---------------------------------------------------------------------------
// Pure-JS sed interpreter
// ---------------------------------------------------------------------------

class SedInterpreter {
  private config: SedConfig;
  private input: string;
  private lines: string[];
  private output: string[] = [];
  private quitRequested = false;
  private nextLineReady = false;

  constructor(config: SedConfig, input: string) {
    this.config = config;
    this.input = input;
    this.lines = input.length === 0 ? [] : input.split("\n");
  }

  run(): { output: string; error: string | null } {
    try {
      let i = 0;
      while (i < this.lines.length && !this.quitRequested) {
        const line = this.lines[i];
        const lineNumber = i + 1;
        const isLast = i === this.lines.length - 1;
        let patternSpace = line;
        let autoPrint = !this.config.suppressAutoPrint;
        let deleted = false;

        for (const cmd of this.config.commands) {
          if (this.quitRequested) break;
          if (!this.addressMatches(cmd.address, lineNumber, isLast, patternSpace, i)) continue;
          const result = this.executeCommand(cmd, patternSpace, lineNumber, isLast);
          if (result.deleted) { deleted = true; autoPrint = false; break; }
          if (result.patternSpace !== undefined) patternSpace = result.patternSpace;
          if (result.printed) {
            for (const p of result.printed) this.output.push(p + "\n");
          }
          if (result.autoPrint !== undefined) autoPrint = result.autoPrint;
          if (result.quit) { this.quitRequested = true; break; }
          if (result.nextLine) {
            // Skip to next input line — current pattern space auto-prints if set
            break;
          }
        }
        if (autoPrint && !deleted) {
          this.output.push(patternSpace + "\n");
        }
        // Flush any pending appends (a\\ command) after the line is printed.
        for (const txt of this.pendingAppend) {
          this.output.push(txt + "\n");
        }
        this.pendingAppend = [];
        i++;
      }
      return { output: this.output.join(""), error: null };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { output: this.output.join(""), error: msg };
    }
  }

  private addressMatches(
    addr: Address,
    lineNumber: number,
    isLast: boolean,
    patternSpace: string,
    lineIndex: number,
  ): boolean {
    switch (addr.type) {
      case "none": return true;
      case "line": return lineNumber === addr.line;
      case "last": return isLast;
      case "regex": {
        try {
          const reSrc = breToJsRegex(addr.regex ?? "", this.config.extendedRegex);
          const re = new RegExp(reSrc, addr.caseInsensitive ? "i" : "");
          return re.test(patternSpace);
        } catch {
          return false;
        }
      }
      case "range": {
        // For range matching, we need to track state across lines.
        return this.rangeMatches(addr, lineNumber, isLast, patternSpace, lineIndex);
      }
    }
    return false;
  }

  private rangeState: { active: boolean; startLine: number; matchedOnce: boolean } = { active: false, startLine: 0, matchedOnce: false };

  private rangeMatches(
    addr: Address,
    lineNumber: number,
    isLast: boolean,
    patternSpace: string,
    lineIndex: number,
  ): boolean {
    if (!addr.start || !addr.end) return false;
    // GNU step: N~M
    if (addr.step && addr.step > 0 && addr.start.type === "line") {
      const start = addr.start.line ?? 1;
      if (lineNumber < start) return false;
      return (lineNumber - start) % addr.step === 0;
    }
    if (!this.rangeState.active) {
      // Check if start matches
      if (this.addressMatches(addr.start, lineNumber, isLast, patternSpace, lineIndex)) {
        this.rangeState.active = true;
        this.rangeState.startLine = lineNumber;
        this.rangeState.matchedOnce = true;
        // Check if end matches the same line (immediate end)
        if (this.addressMatches(addr.end, lineNumber, isLast, patternSpace, lineIndex)) {
          this.rangeState.active = false;
        }
        return true;
      }
      return false;
    } else {
      // Already in range — check if end matches
      const endMatch = this.addressMatches(addr.end, lineNumber, isLast, patternSpace, lineIndex);
      if (endMatch) {
        this.rangeState.active = false;
      }
      return true;
    }
  }

  private executeCommand(
    cmd: SedCommand,
    patternSpace: string,
    lineNumber: number,
    isLast: boolean,
  ): {
    patternSpace?: string;
    printed?: string[];
    autoPrint?: boolean;
    deleted?: boolean;
    quit?: boolean;
    nextLine?: boolean;
  } {
    switch (cmd.type) {
      case "substitute": {
        return this.execSubstitute(cmd, patternSpace);
      }
      case "delete": {
        return { deleted: true, autoPrint: false };
      }
      case "print": {
        return { printed: [patternSpace], autoPrint: undefined };
      }
      case "insert": {
        // Insert text before the current line — emit immediately
        this.output.push((cmd.text ?? "") + "\n");
        return {};
      }
      case "append": {
        // Append text after the current line — schedule for after auto-print
        // We'll emit it now and skip auto-print's newline handling
        // Simpler: emit the text now, then auto-print of current line happens later
        // But sed actually emits appended text AFTER the pattern space cycle.
        // We'll defer with a queue.
        this.pendingAppend.push(cmd.text ?? "");
        return {};
      }
      case "change": {
        // Replace the line entirely with text
        // For ranges, sed emits the text only once (at the end of the range).
        // For a single address, emit the text and skip the original.
        if (cmd.address.type === "range") {
          // Emit only on the last line of the range
          if (!this.rangeState.active) {
            return { patternSpace: cmd.text ?? "", deleted: false, autoPrint: true };
          }
          return { deleted: true, autoPrint: false };
        }
        return { patternSpace: cmd.text ?? "", deleted: false, autoPrint: true };
      }
      case "next": {
        // Print current pattern space (if auto-print on), then read next line
        return { nextLine: true, autoPrint: true };
      }
      case "quit": {
        return { quit: true };
      }
      case "lineNumber": {
        this.output.push(lineNumber + "\n");
        return {};
      }
    }
    return {};
  }

  private pendingAppend: string[] = [];

  private execSubstitute(
    cmd: SedCommand,
    patternSpace: string,
  ): {
    patternSpace?: string;
    printed?: string[];
    autoPrint?: boolean;
  } {
    const fl = cmd.flags ?? "";
    const global = fl.includes("g");
    const caseInsensitive = fl.includes("i") || fl.includes("I");
    const printIfSub = fl.includes("p");
    const numMatch = /\d/.exec(fl);
    const nth = numMatch ? parseInt(numMatch[0], 10) : 0;

    let reSrc: string;
    try {
      reSrc = breToJsRegex(cmd.search ?? "", this.config.extendedRegex);
    } catch (e) {
      throw new Error(`Invalid regex ${JSON.stringify(cmd.search)}: ${e instanceof Error ? e.message : String(e)}`);
    }
    let re: RegExp;
    try {
      re = new RegExp(reSrc, caseInsensitive ? "gi" : "g");
    } catch (e) {
      throw new Error(`Invalid regex ${JSON.stringify(cmd.search)}: ${e instanceof Error ? e.message : String(e)}`);
    }
    // Find all matches
    const matches: RegExpExecArray[] = [];
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(patternSpace)) !== null) {
      matches.push(m);
      if (m.index === re.lastIndex) re.lastIndex++; // empty match — advance
    }

    if (matches.length === 0) {
      return { patternSpace, autoPrint: undefined };
    }

    let newPatternSpace: string;
    let didSub = false;
    if (nth > 0) {
      // Replace only the Nth match
      if (nth > matches.length) {
        return { patternSpace, autoPrint: undefined };
      }
      const target = matches[nth - 1];
      const replacement = expandReplacement(cmd.replace ?? "", target);
      newPatternSpace = patternSpace.slice(0, target.index) + replacement + patternSpace.slice(target.index + target[0].length);
      didSub = true;
    } else if (global) {
      // Replace all matches — build from right to left to keep indices valid
      newPatternSpace = patternSpace;
      for (let i = matches.length - 1; i >= 0; i--) {
        const mm = matches[i];
        const replacement = expandReplacement(cmd.replace ?? "", mm);
        newPatternSpace = newPatternSpace.slice(0, mm.index) + replacement + newPatternSpace.slice(mm.index + mm[0].length);
      }
      didSub = matches.length > 0;
    } else {
      // Replace only the first match
      const target = matches[0];
      const replacement = expandReplacement(cmd.replace ?? "", target);
      newPatternSpace = patternSpace.slice(0, target.index) + replacement + patternSpace.slice(target.index + target[0].length);
      didSub = true;
    }

    const printed: string[] = [];
    if (printIfSub && didSub) {
      printed.push(newPatternSpace);
    }
    return { patternSpace: newPatternSpace, printed, autoPrint: undefined };
  }
}

/** Expand & and \1..\9 in a sed replacement string. */
export function expandReplacement(repl: string, match: RegExpExecArray): string {
  let out = "";
  for (let i = 0; i < repl.length; i++) {
    const c = repl[i];
    if (c === "\\" && i + 1 < repl.length) {
      const next = repl[i + 1];
      if (/[1-9]/.test(next)) {
        const idx = parseInt(next, 10);
        out += match[idx] ?? "";
        i++;
      } else if (next === "&") { out += "&"; i++; }
      else if (next === "\\") { out += "\\"; i++; }
      else if (next === "n") { out += "\n"; i++; }
      else if (next === "t") { out += "\t"; i++; }
      else { out += next; i++; }
    } else if (c === "&") {
      out += match[0];
    } else {
      out += c;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public run API
// ---------------------------------------------------------------------------

export interface SedRunOptions {
  /** -n flag. */
  suppressAutoPrint?: boolean;
  /** -E flag. */
  extendedRegex?: boolean;
}

/** Parse + run a sed script against input. Pure function — no side effects. */
export function runSed(script: string, input: string, options: SedRunOptions = {}): SedRunResult {
  const normalizedInput = normalizeInput(input);
  const lineCount = normalizedInput === "" ? 0 : normalizedInput.split("\n").length;
  const config: SedConfig = {
    suppressAutoPrint: options.suppressAutoPrint ?? false,
    extendedRegex: options.extendedRegex ?? false,
    inPlace: false,
    inPlaceSuffix: "",
    gnuMode: true,
    commands: [],
  };
  try {
    config.commands = parseScript(script, config.extendedRegex);
  } catch (e) {
    return {
      output: "",
      error: e instanceof Error ? e.message : String(e),
      exitStatus: 1,
      lineCount,
      outputLineCount: 0,
    };
  }
  const interp = new SedInterpreter(config, normalizedInput);
  const { output, error } = interp.run();
  if (error) {
    return {
      output,
      error,
      exitStatus: 1,
      lineCount,
      outputLineCount: output === "" ? 0 : output.split("\n").length - 1,
    };
  }
  return {
    output,
    error: null,
    exitStatus: 0,
    lineCount,
    outputLineCount: output === "" ? 0 : output.split("\n").length - 1,
  };
}

/** Run with a full config (used by the UI). */
export function runSedConfig(config: SedConfig, input: string): SedRunResult {
  const normalizedInput = normalizeInput(input);
  const lineCount = normalizedInput === "" ? 0 : normalizedInput.split("\n").length;
  try {
    const interp = new SedInterpreter(config, normalizedInput);
    const { output, error } = interp.run();
    if (error) {
      return {
        output,
        error,
        exitStatus: 1,
        lineCount,
        outputLineCount: output === "" ? 0 : output.split("\n").length - 1,
      };
    }
    return {
      output,
      error: null,
      exitStatus: 0,
      lineCount,
      outputLineCount: output === "" ? 0 : output.split("\n").length - 1,
    };
  } catch (e) {
    return {
      output: "",
      error: e instanceof Error ? e.message : String(e),
      exitStatus: 1,
      lineCount,
      outputLineCount: 0,
    };
  }
}

/** Parse-only check — returns null if OK, error message otherwise. */
export function validateScript(script: string, extended: boolean = false): string | null {
  try {
    parseScript(script, extended);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:sed-command-builder-tester:history";
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

export function buildShareUrl(script: string, input: string, nFlag: boolean, eFlag: boolean): string {
  const params = new URLSearchParams();
  if (script) params.set("s", script);
  if (input) params.set("i", input);
  if (nFlag) params.set("n", "1");
  if (eFlag) params.set("e", "1");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export interface ShareParams {
  script: string;
  input: string;
  nFlag: boolean;
  eFlag: boolean;
}

export function parseShareUrl(hash: string): ShareParams {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { script: "", input: "", nFlag: false, eFlag: false };
  const params = new URLSearchParams(clean);
  return {
    script: params.get("s") ?? "",
    input: params.get("i") ?? "",
    nFlag: params.get("n") === "1",
    eFlag: params.get("e") === "1",
  };
}
