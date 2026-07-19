/**
 * AI Code Debugger & Bug Finder — pure logic.
 *
 * Pattern-based static analysis with per-language rule sets. Detects common
 * bugs and anti-patterns, classifies them by severity, and suggests fixes.
 * Pure functions only — no DOM, no network. The optional LLM call
 * (BYO API key) lives in ui.tsx and goes directly to the user's provider.
 *
 * Honesty: pattern-based analysis is reliable for deterministic rules
 * (bracket matching, var usage, == vs ===, console.log leftovers, TODO
 * markers). Heuristic rules (undefined variables, missing returns,
 * unreachable code) may produce false positives or miss real bugs —
 * each finding is clearly labeled as deterministic vs heuristic.
 */

// ---------- Types ----------

export type Language = "python" | "javascript" | "typescript" | "java" | "cpp" | "go";

export type Severity = "info" | "warning" | "error" | "critical";

export type RuleId =
  | "bracket-mismatch"
  | "missing-semicolon"
  | "var-usage"
  | "console-log-leftover"
  | "eqeq-vs-eqeqeq"
  | "assign-in-condition"
  | "todo-fixme"
  | "empty-catch"
  | "magic-number"
  | "infinite-loop"
  | "unreachable-code"
  | "missing-break-switch"
  | "hardcoded-credential"
  | "division-by-zero"
  | "mutable-default-arg"
  | "bare-except"
  | "undefined-variable"
  | "missing-return"
  | "off-by-one"
  | "deep-nesting"
  | "long-function";

export interface Issue {
  rule: RuleId;
  severity: Severity;
  line: number;           // 1-indexed
  column?: number;        // 1-indexed (optional)
  message: string;
  suggestion?: string;
  deterministic: boolean; // true = reliable, false = heuristic
}

export interface AnalysisResult {
  language: Language;
  issues: Issue[];
  stats: SeverityStats;
  complexity: ComplexityInfo;
  smells: CodeSmell[];
  warnings: string[];
}

export interface SeverityStats {
  total: number;
  critical: number;
  error: number;
  warning: number;
  info: number;
}

export interface ComplexityInfo {
  cyclomatic: number;
  functions: number;
  maxNesting: number;
  explanation: string;
}

export interface CodeSmell {
  type: "long-function" | "deep-nesting" | "magic-number-cluster" | "too-many-params";
  line: number;
  description: string;
}

export interface AutoFix {
  rule: RuleId;
  description: string;
  applied: number;
}

export interface DiffLine {
  type: "same" | "added" | "removed";
  before?: string;
  after?: string;
}

export interface RootCauseGuess {
  matched: boolean;
  rule?: RuleId;
  severity?: Severity;
  explanation: string;
  suggestedFix?: string;
}

export interface HistoryEntry {
  ts: number;
  language: Language;
  snippet: string;
  issueCount: number;
  criticalCount: number;
}

export interface ShareState {
  language?: Language;
  code?: string;
}

export interface LlmExplanation {
  issues: { rule: RuleId; explanation: string; fix: string }[];
  overallNotes: string[];
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-code-debugger:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-code-debugger:llm-key";

export const LANGUAGE_LABELS: Record<Language, string> = {
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  java: "Java",
  cpp: "C++",
  go: "Go",
};

export const ALL_LANGUAGES: Language[] = [
  "python", "javascript", "typescript", "java", "cpp", "go",
];

export const SEVERITY_LABELS: Record<Severity, string> = {
  info: "Info",
  warning: "Warning",
  error: "Error",
  critical: "Critical",
};

export const SEVERITY_ORDER: Severity[] = ["critical", "error", "warning", "info"];

export const RULE_LABELS: Record<RuleId, string> = {
  "bracket-mismatch": "Bracket mismatch",
  "missing-semicolon": "Missing semicolon",
  "var-usage": "var usage (prefer let/const)",
  "console-log-leftover": "Leftover console.log",
  "eqeq-vs-eqeqeq": "== vs === (loose equality)",
  "assign-in-condition": "Assignment in condition (= vs ==)",
  "todo-fixme": "TODO/FIXME marker",
  "empty-catch": "Empty catch block",
  "magic-number": "Magic number",
  "infinite-loop": "Infinite loop (while true, no break)",
  "unreachable-code": "Unreachable code after return",
  "missing-break-switch": "Missing break in switch",
  "hardcoded-credential": "Hardcoded credential",
  "division-by-zero": "Division by zero literal",
  "mutable-default-arg": "Mutable default argument (Python)",
  "bare-except": "Bare except (Python)",
  "undefined-variable": "Possibly undefined variable",
  "missing-return": "Possibly missing return",
  "off-by-one": "Off-by-one loop bound",
  "deep-nesting": "Deep nesting (>4 levels)",
  "long-function": "Long function (>50 lines)",
};

export const SAMPLE_SNIPPETS: Record<Language, string> = {
  python: [
    "def add_items(item, items=[]):",
    "    items.append(item)",
    "    return items",
    "",
    "def divide(a, b):",
    "    return a / b",
    "",
    "def fetch():",
    "    try:",
    "        return get_data()",
    "    except:",
    "        pass",
    "",
    "# TODO: handle errors",
    "password = 'admin123'",
    "for i in range(11):",
    "    print(i)",
  ].join("\n"),
  javascript: [
    "function check(x) {",
    "  if (x = 5) {",
    "    return 'five'",
    "  }",
    "  var result = x == 5;",
    "  console.log('debug', result);",
    "  return result",
    "}",
    "",
    "for (let i = 0; i <= 10; i++) {",
    "  // TODO: optimize",
    "}",
  ].join("\n"),
  typescript: [
    "function test(x: any) {",
    "  if (x == null) return;",
    "  var y = x;",
    "  console.log(y);",
    "  return y",
    "}",
  ].join("\n"),
  java: [
    "public class Main {",
    "  public static void main(String[] args) {",
    "    String password = \"admin\";",
    "    int x = 10 / 0;",
    "    switch (x) {",
    "      case 1:",
    "        System.out.println(\"one\");",
    "      case 2:",
    "        System.out.println(\"two\");",
    "    }",
    "  }",
    "}",
  ].join("\n"),
  cpp: [
    "int main() {",
    "  int password = 12345;",
    "  int x = 10 / 0;",
    "  while (true) {",
    "    // TODO: break",
    "  }",
    "  return 0;",
    "}",
  ].join("\n"),
  go: [
    "package main",
    "",
    "func main() {",
    "  password := \"admin\"",
    "  for {",
    "    break",
    "  }",
    "  for i := 0; i <= 10; i++ {",
    "    // TODO",
    "  }",
    "}",
  ].join("\n"),
};

const CREDENTIAL_KEYWORDS = ["password", "passwd", "secret", "api_key", "apikey", "access_token", "auth_token", "private_key"];

// ---------- Language detection ----------

const DETECTION_KEYWORDS: Record<Language, RegExp[]> = {
  python: [/^\s*def\s+\w+\s*\(/m, /^\s*import\s+\w+/m, /^\s*from\s+\w+\s+import/m, /^\s*print\s*\(/m, /^\s*elif\s+/m, /:\s*$/m],
  javascript: [/\bfunction\s+\w+\s*\(/, /\bconst\s+\w+\s*=/, /\blet\s+\w+\s*=/, /\bconsole\.log\s*\(/, /\brequire\s*\(/, /=>/],
  typescript: [/\bfunction\s+\w+\s*\([^)]*\)\s*:\s*\w+/, /\binterface\s+\w+/, /:\s*(string|number|boolean|void)\b/, /\bconst\s+\w+\s*:\s*\w+/],
  java: [/\bpublic\s+(static\s+)?(class|void|int|String)\s+/, /\bSystem\.out\.println\s*\(/, /import\s+java\./, /\bprivate\s+(final\s+)?\w+\s+\w+\s*[;=]/],
  cpp: [/#include\s*[<"]/m, /\bstd::/, /\bcout\s*<</, /\bint\s+main\s*\(\s*\)/, /\btemplate\s*</],
  go: [/\bpackage\s+main\b/, /\bfunc\s+\w+\s*\(/, /:=/, /\bfmt\./, /\brange\s+\w/],
};

export function detectLanguage(code: string): Language {
  if (!code || !code.trim()) return "python";
  const scores: Record<Language, number> = {
    python: 0, javascript: 0, typescript: 0, java: 0, cpp: 0, go: 0,
  };
  for (const lang of ALL_LANGUAGES) {
    for (const re of DETECTION_KEYWORDS[lang]) {
      if (re.test(code)) scores[lang] += 1;
    }
  }
  if (/#include\s*[<"]/.test(code)) scores.cpp += 3;
  if (/\bpackage\s+main\b/.test(code)) scores.go += 3;
  if (/\bSystem\.out\.println\s*\(/.test(code)) scores.java += 2;
  if (/:\s*(string|number|boolean|void)\b|interface\s+\w+/.test(code)) scores.typescript += 2;
  let best: Language = "python";
  let bestScore = -1;
  for (const lang of ALL_LANGUAGES) {
    if (scores[lang] > bestScore) {
      bestScore = scores[lang];
      best = lang;
    }
  }
  return best;
}

// ---------- Helpers ----------

function linesOf(code: string): string[] {
  return code.replace(/\r\n/g, "\n").split("\n");
}

function isCommentLine(line: string, lang: Language): boolean {
  const t = line.trim();
  if (lang === "python" || lang === "go") {
    if (t.startsWith("#")) return true;
  }
  if (t.startsWith("//") || t.startsWith("/*") || t.startsWith("*") || t.startsWith("*/")) return true;
  return false;
}

function isStringOnlyLine(line: string): boolean {
  // very crude
  return false;
}

function stripTrailingComment(line: string, lang: Language): string {
  if (lang === "python" || lang === "go") {
    const idx = line.indexOf("#");
    if (idx >= 0) {
      const before = line.slice(0, idx);
      if ((before.match(/'/g) ?? []).length % 2 === 0 && (before.match(/"/g) ?? []).length % 2 === 0) {
        return before;
      }
    }
    return line;
  }
  // strip trailing //
  const m = line.match(/^(.*?)(\/\/.*)$/);
  if (m && m[1].trim() !== "") return m[1];
  return line;
}

function stripStrings(line: string): string {
  // Replace string literals with empty quotes so identifiers inside strings aren't flagged.
  // Handles single, double, and backtick strings with escape sequences.
  return line.replace(/(['"`])(?:[^\\]|\\.)*?\1/g, '""');
}

// ---------- Bracket matching ----------

export function findBracketMismatches(code: string, lang: Language): Issue[] {
  const lines = linesOf(code);
  const issues: Issue[] = [];
  const stack: { ch: string; line: number; col: number }[] = [];
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const opens = new Set(["(", "[", "{"]);
  const closes = new Set([")", "]", "}"]);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip strings/comments very crudely
    let inString: false | "'" | '"' | "`" = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (inString) {
        if (ch === inString && line[c - 1] !== "\\") inString = false;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") { inString = ch as "'" | '"' | "`"; continue; }
      if (opens.has(ch)) {
        stack.push({ ch, line: i + 1, col: c + 1 });
      } else if (closes.has(ch)) {
        const top = stack.pop();
        if (!top || top.ch !== pairs[ch]) {
          issues.push({
            rule: "bracket-mismatch",
            severity: "error",
            line: i + 1,
            column: c + 1,
            message: `Mismatched '${ch}' — no matching opening bracket.`,
            suggestion: `Check that every '${ch}' has a matching '${Object.keys(pairs).find((k) => pairs[k] === (top?.ch ?? ch)) ?? ch}' earlier in the code.`,
            deterministic: true,
          });
        }
      }
    }
  }
  // Any unclosed openers
  for (const s of stack) {
    issues.push({
      rule: "bracket-mismatch",
      severity: "error",
      line: s.line,
      column: s.col,
      message: `Unclosed '${s.ch}' — no matching closing bracket.`,
      suggestion: `Add the matching closing bracket for '${s.ch}'.`,
      deterministic: true,
    });
  }
  return issues;
}

// ---------- Per-language rules ----------

export function findMissingSemicolons(code: string, lang: Language): Issue[] {
  if (lang !== "javascript" && lang !== "typescript" && lang !== "java" && lang !== "cpp") return [];
  const lines = linesOf(code);
  const issues: Issue[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (isCommentLine(raw, lang)) continue;
    const line = stripTrailingComment(raw, lang).trim();
    if (!line) continue;
    // Skip lines that don't need a semicolon
    if (/[{};:>]\s*$/.test(line)) continue;
    if (/^(if|else|for|while|switch|case|default|do|try|catch|finally|class|interface|enum|namespace|public|private|protected|static|import|package|using)\b/.test(line)) continue;
    if (line.endsWith("{")) continue;
    // Statement-like line: variable, return, throw, expression
    if (/^(return|throw|var|let|const|int|long|short|float|double|char|bool|auto|String|System\.out|\w+\s*=[^=])/.test(line) || /\w\(\)|\w+\s*\+|\w+\s*-/.test(line)) {
      if (!line.endsWith(";")) {
        issues.push({
          rule: "missing-semicolon",
          severity: "warning",
          line: i + 1,
          message: "Statement may be missing a trailing semicolon.",
          suggestion: "Add ';' at the end of the statement.",
          deterministic: true,
        });
      }
    }
  }
  return issues;
}

export function findVarUsage(code: string, lang: Language): Issue[] {
  if (lang !== "javascript" && lang !== "typescript") return [];
  const lines = linesOf(code);
  const issues: Issue[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line, lang)) continue;
    const m = line.match(/\bvar\s+(\w+)/);
    if (m) {
      issues.push({
        rule: "var-usage",
        severity: "warning",
        line: i + 1,
        message: `Variable '${m[1]}' declared with 'var' — prefer 'let' (mutable) or 'const' (immutable).`,
        suggestion: `Replace 'var ${m[1]}' with 'let ${m[1]}' (or 'const' if never reassigned).`,
        deterministic: true,
      });
    }
  }
  return issues;
}

export function findConsoleLogLeftovers(code: string, lang: Language): Issue[] {
  if (lang !== "javascript" && lang !== "typescript") return [];
  const lines = linesOf(code);
  const issues: Issue[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line, lang)) continue;
    if (/\bconsole\.log\s*\(/.test(line)) {
      issues.push({
        rule: "console-log-leftover",
        severity: "info",
        line: i + 1,
        message: "Leftover console.log() — likely debug code that should be removed before production.",
        suggestion: "Remove this console.log or replace with a proper logger.",
        deterministic: true,
      });
    }
  }
  return issues;
}

export function findEqEqVsEqEqEq(code: string, lang: Language): Issue[] {
  if (lang !== "javascript" && lang !== "typescript") return [];
  const lines = linesOf(code);
  const issues: Issue[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line, lang)) continue;
    // Match == or != but not === or !==
    const matches = [...line.matchAll(/([^=!<>])==([^=])/g)];
    for (const m of matches) {
      const idx = (m.index ?? 0) + 1;
      issues.push({
        rule: "eqeq-vs-eqeqeq",
        severity: "warning",
        line: i + 1,
        column: idx + 1,
        message: "Loose equality '==' — use '===' to avoid type coercion bugs.",
        suggestion: "Replace '==' with '===' (and '!=' with '!==').",
        deterministic: true,
      });
    }
  }
  return issues;
}

export function findAssignInCondition(code: string, lang: Language): Issue[] {
  if (lang === "python" || lang === "go") return [];
  const lines = linesOf(code);
  const issues: Issue[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line, lang)) continue;
    // if (x = 5) or while (x = 0)
    const m = line.match(/\b(if|while)\s*\(([^)]+)\)/);
    if (m) {
      const cond = m[2];
      // Single = (not == or === or != or <= or >=)
      const assignMatch = cond.match(/(^|[^=!<>])=([^=])/);
      if (assignMatch) {
        issues.push({
          rule: "assign-in-condition",
          severity: "error",
          line: i + 1,
          message: `Assignment inside ${m[1]} condition — did you mean '=='?`,
          suggestion: `Replace '=' with '==' (or '===') in the condition.`,
          deterministic: true,
        });
      }
    }
  }
  return issues;
}

export function findTodoFixme(code: string, _lang: Language): Issue[] {
  const lines = linesOf(code);
  const issues: Issue[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/\b(TODO|FIXME|HACK|XXX|BUG)\b/i);
    if (m) {
      issues.push({
        rule: "todo-fixme",
        severity: "info",
        line: i + 1,
        message: `${m[1].toUpperCase()} marker found — unfinished work or known issue.`,
        suggestion: "Resolve and remove the marker before shipping.",
        deterministic: true,
      });
    }
  }
  return issues;
}

export function findEmptyCatchBlocks(code: string, lang: Language): Issue[] {
  const lines = linesOf(code);
  const issues: Issue[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let isCatch = false;
    if (lang === "python") {
      if (/^except\s*:/.test(line.trim())) isCatch = true;
      else if (/^except\s+\w+\s*(as\s+\w+)?\s*:/.test(line.trim())) isCatch = true;
    } else {
      // Allow leading `}` (e.g., `} catch (e) {`)
      if (/^(\}\s*)?catch\s*\(/.test(line.trim())) isCatch = true;
    }
    if (!isCatch) continue;
    // Look ahead for an empty body
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const next = lines[j].trim();
      if (!next) continue;
      // Empty: pass / /* */ / { }
      if (lang === "python" && next === "pass") {
        issues.push({
          rule: "empty-catch",
          severity: "warning",
          line: j + 1,
          message: "Empty except block (pass) — errors are silently swallowed.",
          suggestion: "At minimum, log the exception. Avoid bare 'pass'.",
          deterministic: true,
        });
        break;
      }
      if (lang !== "python" && (next === "{}" || next === "{ }" || next === "}")) {
        issues.push({
          rule: "empty-catch",
          severity: "warning",
          line: j + 1,
          message: "Empty catch block — exceptions are silently swallowed.",
          suggestion: "At minimum, log the exception. Avoid empty catch blocks.",
          deterministic: true,
        });
        break;
      }
      // Non-empty body — stop
      break;
    }
  }
  return issues;
}

export function findMagicNumbers(code: string, _lang: Language): Issue[] {
  const lines = linesOf(code);
  const issues: Issue[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line, _lang)) continue;
    // Find numeric literals > 100 (excluding 0, 1, 2, powers of 10, version numbers)
    const matches = [...line.matchAll(/\b(\d{3,})\b/g)];
    for (const m of matches) {
      const n = parseInt(m[1], 10);
      // Allow round hundreds / thousands
      if (n % 100 === 0 || n % 1000 === 0) continue;
      // Allow 100, 1000 themselves
      if (n === 100 || n === 1000) continue;
      issues.push({
        rule: "magic-number",
        severity: "info",
        line: i + 1,
        column: (m.index ?? 0) + 1,
        message: `Magic number ${n} — consider extracting to a named constant for clarity.`,
        suggestion: `Replace ${n} with a named const like MAX_${n.toString(36).toUpperCase()}.`,
        deterministic: true,
      });
    }
  }
  return issues;
}

export function findInfiniteLoops(code: string, lang: Language): Issue[] {
  const lines = linesOf(code);
  const issues: Issue[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let isInfinite = false;
    if (lang === "python") {
      if (/^\s*while\s+True\s*:/.test(line)) isInfinite = true;
      if (/^\s*while\s+1\s*:/.test(line)) isInfinite = true;
    } else {
      if (/\bwhile\s*\(\s*true\s*\)/.test(line)) isInfinite = true;
      if (lang === "go" && /^\s*for\s*\{?\s*$/.test(line)) isInfinite = true;
      if (lang === "go" && /\bfor\s+true\s*\{/.test(line)) isInfinite = true;
      if (lang !== "go" && /\bfor\s*\(\s*;\s*;\s*\)/.test(line)) isInfinite = true;
    }
    if (!isInfinite) continue;
    // Look ahead for a break statement within the next 30 lines (and same/larger indent)
    const startIndent = line.match(/^\s*/)?.[0].length ?? 0;
    let hasBreak = false;
    for (let j = i + 1; j < Math.min(i + 40, lines.length); j++) {
      const next = lines[j];
      const nextIndent = next.match(/^\s*/)?.[0].length ?? 0;
      if (next.trim() && nextIndent < startIndent) break; // exited block
      if (/\bbreak\b/.test(next) || /\breturn\b/.test(next) || /\bthrow\b/.test(next) || /\braise\b/.test(next) || /\bpanic\b/.test(next)) {
        hasBreak = true;
        break;
      }
    }
    if (!hasBreak) {
      issues.push({
        rule: "infinite-loop",
        severity: "critical",
        line: i + 1,
        message: "Infinite loop with no break/return/throw inside — likely a bug.",
        suggestion: "Add a break, return, or throw statement inside the loop, or change the condition.",
        deterministic: true,
      });
    }
  }
  return issues;
}

export function findUnreachableCode(code: string, lang: Language): Issue[] {
  const lines = linesOf(code);
  const issues: Issue[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = stripTrailingComment(lines[i], lang).trim();
    // Return statement
    if (/^(return|throw|raise|panic)\b/.test(line)) {
      // Look ahead for non-blank, non-comment lines at same or lower indent
      const indent = lines[i].match(/^\s*/)?.[0].length ?? 0;
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j];
        const nextTrim = stripTrailingComment(next, lang).trim();
        if (!nextTrim || isCommentLine(next, lang)) continue;
        const nextIndent = next.match(/^\s*/)?.[0].length ?? 0;
        if (nextIndent < indent) break;
        if (nextIndent === indent && /^[}\]]/.test(nextTrim)) continue;
        if (nextIndent === indent && /^(else|elif|except|finally|catch|case|default|end)\b/.test(nextTrim)) continue;
        issues.push({
          rule: "unreachable-code",
          severity: "warning",
          line: j + 1,
          message: "Code after a return/throw is unreachable and will never execute.",
          suggestion: "Remove the unreachable code or fix the earlier return statement.",
          deterministic: false,
        });
        break;
      }
    }
  }
  return issues;
}

export function findMissingBreakInSwitch(code: string, lang: Language): Issue[] {
  if (lang !== "javascript" && lang !== "typescript" && lang !== "java" && lang !== "cpp") return [];
  const lines = linesOf(code);
  const issues: Issue[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/^\s*case\s+/.test(line) && !/^\s*default\s*:/.test(line)) continue;
    // Look ahead for the next case/default or end of switch
    let hasStatement = false;
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j].trim();
      if (!next || isCommentLine(next, lang)) continue;
      if (/^(case|default)\b/.test(next)) {
        if (hasStatement) {
          issues.push({
            rule: "missing-break-switch",
            severity: "warning",
            line: i + 1,
            message: "Switch case falls through to the next case — likely missing 'break'.",
            suggestion: "Add a 'break;' at the end of this case, or /* fallthrough */ if intentional.",
            deterministic: true,
          });
        }
        break;
      }
      if (next === "}" || next === "};") break;
      if (next.startsWith("break") || next.startsWith("return") || next.startsWith("throw") || next.startsWith("continue")) break;
      hasStatement = true;
    }
  }
  return issues;
}

export function findHardcodedCredentials(code: string, _lang: Language): Issue[] {
  const lines = linesOf(code);
  const issues: Issue[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line, _lang)) continue;
    // Match: keyword = "..." or keyword := "..." or String keyword = "..."
    for (const kw of CREDENTIAL_KEYWORDS) {
      const re = new RegExp(`\\b${kw}\\b\\s*[:=]\\s*['"][^'"]+['"]`, "i");
      if (re.test(line)) {
        issues.push({
          rule: "hardcoded-credential",
          severity: "critical",
          line: i + 1,
          message: `Hardcoded credential detected ('${kw}') — secrets must not live in source code.`,
          suggestion: "Load the secret from an environment variable, secret manager, or config file (never commit it).",
          deterministic: true,
        });
        break;
      }
    }
  }
  return issues;
}

export function findDivisionByZero(code: string, _lang: Language): Issue[] {
  const lines = linesOf(code);
  const issues: Issue[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line, _lang)) continue;
    // Match: / 0 or /0 but not / 0.0 or comments
    if (/\/\s*0\s*[^.0-9]/.test(line) || /\/\s*0\s*$/.test(line)) {
      issues.push({
        rule: "division-by-zero",
        severity: "critical",
        line: i + 1,
        message: "Division by zero literal — this will crash at runtime.",
        suggestion: "Guard the division: check that the divisor is non-zero before dividing.",
        deterministic: true,
      });
    }
  }
  return issues;
}

export function findMutableDefaultArgs(code: string, lang: Language): Issue[] {
  if (lang !== "python") return [];
  const lines = linesOf(code);
  const issues: Issue[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line, lang)) continue;
    const m = line.match(/^def\s+\w+\s*\(([^)]*)\)/);
    if (!m) continue;
    const params = m[1];
    // Look for param=[] or param={} or param=set()
    if (/\w+\s*=\s*\[\s*\]/.test(params) || /\w+\s*=\s*\{\s*\}/.test(params) || /\w+\s*=\s*set\s*\(\s*\)/.test(params)) {
      issues.push({
        rule: "mutable-default-arg",
        severity: "error",
        line: i + 1,
        message: "Mutable default argument (list/dict/set) — shared across all calls. This is a classic Python gotcha.",
        suggestion: "Use None as the default and create the mutable inside the function: `def f(x=None): x = x or []`.",
        deterministic: true,
      });
    }
  }
  return issues;
}

export function findBareExcept(code: string, lang: Language): Issue[] {
  if (lang !== "python") return [];
  const lines = linesOf(code);
  const issues: Issue[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line, lang)) continue;
    if (/^\s*except\s*:/.test(line)) {
      issues.push({
        rule: "bare-except",
        severity: "error",
        line: i + 1,
        message: "Bare 'except:' catches everything (including KeyboardInterrupt, SystemExit) — too broad.",
        suggestion: "Catch a specific exception, e.g. 'except Exception as e:'.",
        deterministic: true,
      });
    }
  }
  return issues;
}

export function findUndefinedVariables(code: string, lang: Language): Issue[] {
  const lines = linesOf(code);
  const issues: Issue[] = [];
  const defined = new Set<string>();
  // Collect definitions
  for (const line of lines) {
    const clean = stripTrailingComment(line, lang);
    // function/class def
    let m = clean.match(/^(?:def|function|func)\s+(\w+)/);
    if (m) defined.add(m[1]);
    m = clean.match(/^(?:class|struct|interface|enum|type)\s+(\w+)/);
    if (m) defined.add(m[1]);
    // variable declaration: name = value / let/var/const/type name = / name := / name =
    m = clean.match(/^(?:let|const|var|auto|int|long|short|float|double|char|bool|String|var)\s+(\w+)/);
    if (m) defined.add(m[1]);
    m = clean.match(/^(\w+)\s*:?=\s*/);
    if (m) defined.add(m[1]);
    m = clean.match(/^(?:public|private|protected)\s+(?:static\s+)?(?:final\s+)?[\w<>[\]]+\s+(\w+)\s*[;=]/);
    if (m) defined.add(m[1]);
    // function params
    m = clean.match(/^(?:def|function|func)\s+\w+\s*\(([^)]*)\)/);
    if (m) {
      for (const p of m[1].split(",")) {
        const pm = p.trim().match(/^(\w+)/);
        if (pm) defined.add(pm[1]);
      }
    }
    // for-loop variable
    m = clean.match(/^(?:for)\s+(?:let|const|var|int|auto)?\s*(\w+)\s*(?:=|in|of|:=)/);
    if (m) defined.add(m[1]);
  }
  // Built-ins / common globals to ignore
  const builtins = new Set([
    "print", "console", "fmt", "Math", "Object", "Array", "String", "Number", "Boolean",
    "JSON", "Date", "Promise", "Symbol", "Map", "Set", "WeakMap", "WeakSet", "Error",
    "TypeError", "RangeError", "SyntaxError", "ReferenceError", "process", "module", "exports",
    "require", "window", "document", "globalThis", "this", "self", "global",
    "len", "range", "str", "int", "float", "list", "dict", "set", "tuple", "bool", "type", "isinstance",
    "open", "input", "Exception", "ValueError", "TypeError", "KeyError", "IndexError", "AttributeError",
    "RuntimeError", "StopIteration", "self", "cls", "True", "False", "None", "nil", "null", "undefined",
    "System", "std", "cout", "cin", "cerr", "endl", "string", "vector", "map", "set", "pair",
    "size_t", "void", "main", "args", "argc", "argv",
    "println", "printf", "Println", "Printf", "Print", "panic", "recover", "defer", "go", "chan", "interface",
    "i", "j", "k", "x", "y", "z", "n", "t", "v", "ok", "err", "ctx", "req", "res",
  ]);
  // Find usages that look like bare identifiers
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const line = stripStrings(stripTrailingComment(lines[i], lang));
    if (isCommentLine(lines[i], lang)) continue;
    const matches = [...line.matchAll(/\b([a-zA-Z_]\w*)\b/g)];
    for (const m of matches) {
      const name = m[1];
      if (seen.has(name)) continue;
      if (defined.has(name)) continue;
      if (builtins.has(name)) continue;
      // Skip if it's preceded by `.` (method/property access)
      const idx = m.index ?? 0;
      if (idx > 0 && line[idx - 1] === ".") continue;
      // Skip keywords
      if (KEYWORDS.has(name)) continue;
      // Skip if it's followed by `(` and likely a function call from import
      if (line.slice(idx + name.length).match(/^\s*\(/)) {
        // Likely a function call — could be from an import. Mark as seen but don't flag.
        seen.add(name);
        continue;
      }
      // Skip if it's a property name being declared (after a type in TS/Java/C++)
      if (line.slice(idx + name.length).match(/^\s*[:;=<>]/)) {
        seen.add(name);
        continue;
      }
      // Skip property access (e.g., key in object literal)
      if (line.slice(idx + name.length).match(/^\s*:/) && line.slice(0, idx).match(/[{,]\s*$/)) {
        seen.add(name);
        continue;
      }
      seen.add(name);
      issues.push({
        rule: "undefined-variable",
        severity: "warning",
        line: i + 1,
        column: idx + 1,
        message: `'${name}' may be undefined — no declaration was found in the snippet.`,
        suggestion: `Ensure '${name}' is imported, declared, or passed as a parameter.`,
        deterministic: false,
      });
    }
  }
  return issues;
}

const KEYWORDS = new Set([
  "if", "else", "elif", "for", "while", "do", "switch", "case", "default", "break", "continue",
  "return", "throw", "throws", "try", "catch", "finally", "import", "from", "package", "include",
  "using", "namespace", "class", "struct", "interface", "enum", "type", "def", "func", "function",
  "var", "let", "const", "auto", "void", "int", "long", "short", "byte", "float", "double",
  "char", "bool", "boolean", "string", "String", "true", "false", "null", "None", "nil", "undefined",
  "True", "False", "self", "cls", "this", "super", "extends", "implements", "new", "delete",
  "raise", "panic", "recover", "defer", "go", "chan", "select", "map", "filter", "reduce",
  "in", "of", "is", "as", "with", "yield", "async", "await", "static", "final", "abstract",
  "public", "private", "protected", "internal", "extern", "inline", "virtual", "override",
  "namespace", "module", "export", "default", "get", "set", "operator", "template", "typename",
  "sizeof", "typedef", "union", "volatile", "mutable", "explicit", "friend", "register",
]);

export function findMissingReturns(code: string, lang: Language): Issue[] {
  const lines = linesOf(code);
  const issues: Issue[] = [];
  // Find function definitions and check if all paths return
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m: RegExpMatchArray | null = null;
    if (lang === "python") m = line.match(/^(def\s+\w+\s*\([^)]*\))\s*:\s*$/);
    else if (lang === "javascript" || lang === "typescript") m = line.match(/^(function\s+\w+\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{)\s*$/);
    else if (lang === "go") m = line.match(/^(func\s+\w+\s*\([^)]*\)\s*(?:\([^)]*\))?\s*\{)\s*$/);
    else if (lang === "java" || lang === "cpp") m = line.match(/^((?:public|private|protected)\s+(?:static\s+)?[\w<>[\]]+\s+\w+\s*\([^)]*\))\s*\{?\s*$/);
    if (!m) continue;
    // Skip void/main/go-func-without-return-type
    if (lang === "java" || lang === "cpp") {
      if (/\bvoid\b/.test(m[1]) || /\bmain\b/.test(m[1])) continue;
    }
    if (lang === "go") {
      // Skip if no return type
      if (!/\)\s*\([\w, *\s]+\)\s*\{/.test(line)) continue;
    }
    // Find the function body — track brace depth (or indent for python)
    const startIndent = line.match(/^\s*/)?.[0].length ?? 0;
    const bodyLines: { line: number; text: string; indent: number }[] = [];
    if (lang === "python") {
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j];
        const nextIndent = next.match(/^\s*/)?.[0].length ?? 0;
        const nextTrim = next.trim();
        if (!nextTrim) continue;
        if (nextIndent <= startIndent) break;
        bodyLines.push({ line: j + 1, text: nextTrim, indent: nextIndent });
      }
    } else {
      // Brace-delimited: track depth, stop when depth returns to 0.
      // The function definition line may have opened a brace (depth starts at 1)
      // or it may be on the next line (depth starts at 0).
      let depth = line.includes("{") ? 1 : 0;
      let started = depth > 0;
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j];
        const nextTrim = next.trim();
        if (!nextTrim) continue;
        // Count braces on this line (very crude — ignores strings)
        const clean = stripStrings(nextTrim);
        const opens = (clean.match(/\{/g) ?? []).length;
        const closes = (clean.match(/\}/g) ?? []).length;
        depth += opens - closes;
        if (depth > 0) started = true;
        if (started && depth <= 0) {
          // Body ended at this line (which is the closing brace)
          break;
        }
        bodyLines.push({ line: j + 1, text: nextTrim, indent: next.match(/^\s*/)?.[0].length ?? 0 });
      }
    }
    if (bodyLines.length === 0) continue;
    // Look for any return at the top level of the body (indent === bodyIndent)
    const bodyIndent = bodyLines[0].indent;
    let hasReturn = false;
    let hasIfWithReturn = false;
    for (const bl of bodyLines) {
      if (bl.indent !== bodyIndent) continue;
      if (/^return\b/.test(bl.text)) { hasReturn = true; break; }
      if (/^if\b/.test(bl.text)) hasIfWithReturn = true;
    }
    // If function has if/else branches with returns but no top-level return, flag it
    if (!hasReturn && hasIfWithReturn) {
      issues.push({
        rule: "missing-return",
        severity: "warning",
        line: i + 1,
        message: "Function may not return on all code paths — if/else branches return but the function falls through otherwise.",
        suggestion: "Add a top-level return statement, or restructure to guarantee a return on every path.",
        deterministic: false,
      });
    }
  }
  return issues;
}

export function findOffByOneLoops(code: string, lang: Language): Issue[] {
  const lines = linesOf(code);
  const issues: Issue[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentLine(line, lang)) continue;
    // Python: for i in range(N+1) — often an off-by-one (inclusive instead of exclusive)
    let m = line.match(/for\s+\w+\s+in\s+range\s*\(\s*(\w+)\s*\+\s*1\s*\)/);
    if (m) {
      issues.push({
        rule: "off-by-one",
        severity: "warning",
        line: i + 1,
        message: `Loop uses range(${m[1]} + 1) — this iterates N+1 times. If you meant 0..N-1, drop the +1.`,
        suggestion: `Use range(${m[1]}) for the standard 0..N-1 iteration, or keep +1 only if you intentionally want 0..N inclusive.`,
        deterministic: false,
      });
      continue;
    }
    // C-style: for (i = 0; i <= N; i++) — <= instead of <
    m = line.match(/for\s*\(\s*(?:int|long|short|size_t|auto|let|const|var)?\s*\w+\s*=\s*\d+\s*;\s*\w+\s*<=\s*(\w+|\d+)\s*;\s*\w+\s*\+\+/);
    if (m) {
      issues.push({
        rule: "off-by-one",
        severity: "warning",
        line: i + 1,
        message: `Loop uses '<=' — this iterates one extra time (inclusive bound).`,
        suggestion: `Use '<' instead of '<=' for the standard exclusive bound.`,
        deterministic: false,
      });
    }
  }
  return issues;
}

// ---------- Complexity & smells ----------

export function computeComplexity(code: string, lang: Language): ComplexityInfo {
  const lines = linesOf(code);
  let branches = 1;
  let functions = 0;
  let maxNesting = 0;
  let curNesting = 0;
  const stack: number[] = [];
  for (const line of lines) {
    const t = stripTrailingComment(line, lang).trim();
    if (/^(def|function|func)\b/.test(t)) functions += 1;
    if (/\b(if|elif|else if|else|for|while|case|catch|except|and|or|&&|\|\|)\b/.test(t)) {
      branches += (t.match(/\b(if|elif|else if|for|while|case|catch|except)\b/g) ?? []).length;
      branches += (t.match(/(\band\b|\bor\b|&&|\|\|)/g) ?? []).length;
    }
    if (/[{:]\s*$/.test(t) || /\{\s*$/.test(t)) {
      curNesting += 1;
      if (curNesting > maxNesting) maxNesting = curNesting;
      stack.push(curNesting);
    }
    if (/^\}|^end\b/.test(t) && stack.length > 0) {
      stack.pop();
      curNesting = stack.length > 0 ? stack[stack.length - 1] : 0;
    }
  }
  return {
    cyclomatic: branches,
    functions,
    maxNesting,
    explanation: `Cyclomatic complexity ≈ ${branches}. ${functions} function(s). Maximum nesting depth ${maxNesting}. ` +
      (branches > 15 ? "High complexity — consider splitting into smaller functions." :
       branches > 8 ? "Moderate complexity — review for refactoring opportunities." :
       "Low complexity — easy to test and maintain."),
  };
}

export function findCodeSmells(code: string, lang: Language): CodeSmell[] {
  const smells: CodeSmell[] = [];
  const lines = linesOf(code);
  // Deep nesting
  for (let i = 0; i < lines.length; i++) {
    const indent = (lines[i].match(/^\s*/)?.[0].length ?? 0);
    if (indent >= 8 && lines[i].trim() && !isCommentLine(lines[i], lang)) {
      smells.push({
        type: "deep-nesting",
        line: i + 1,
        description: `Deep nesting at ${Math.floor(indent / 2)} levels — consider extracting to a helper function or using early returns.`,
      });
    }
  }
  // Long functions
  let funcStart = -1;
  let funcIndent = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = stripTrailingComment(line, lang).trim();
    if (/^(def|function|func)\b/.test(t)) {
      funcStart = i;
      funcIndent = line.match(/^\s*/)?.[0].length ?? 0;
    } else if (funcStart >= 0 && (t === "}" || t === "end")) {
      const length = i - funcStart - 1;
      if (length > 50) {
        smells.push({
          type: "long-function",
          line: funcStart + 1,
          description: `Function is ${length} lines long (>50) — consider splitting for readability and testability.`,
        });
      }
      funcStart = -1;
    }
  }
  return smells;
}

// ---------- Top-level analyzer ----------

export function analyzeCode(code: string, lang: Language): AnalysisResult {
  const all: Issue[] = [];
  all.push(...findBracketMismatches(code, lang));
  all.push(...findMissingSemicolons(code, lang));
  all.push(...findVarUsage(code, lang));
  all.push(...findConsoleLogLeftovers(code, lang));
  all.push(...findEqEqVsEqEqEq(code, lang));
  all.push(...findAssignInCondition(code, lang));
  all.push(...findTodoFixme(code, lang));
  all.push(...findEmptyCatchBlocks(code, lang));
  all.push(...findMagicNumbers(code, lang));
  all.push(...findInfiniteLoops(code, lang));
  all.push(...findUnreachableCode(code, lang));
  all.push(...findMissingBreakInSwitch(code, lang));
  all.push(...findHardcodedCredentials(code, lang));
  all.push(...findDivisionByZero(code, lang));
  all.push(...findMutableDefaultArgs(code, lang));
  all.push(...findBareExcept(code, lang));
  all.push(...findUndefinedVariables(code, lang));
  all.push(...findMissingReturns(code, lang));
  all.push(...findOffByOneLoops(code, lang));

  // Convert deep-nesting smells into issues too
  const smells = findCodeSmells(code, lang);
  for (const s of smells) {
    if (s.type === "deep-nesting") {
      all.push({
        rule: "deep-nesting",
        severity: "info",
        line: s.line,
        message: s.description,
        deterministic: true,
      });
    } else if (s.type === "long-function") {
      all.push({
        rule: "long-function",
        severity: "info",
        line: s.line,
        message: s.description,
        deterministic: true,
      });
    }
  }

  // Sort by line then severity
  const sevRank: Record<Severity, number> = { critical: 0, error: 1, warning: 2, info: 3 };
  all.sort((a, b) => a.line - b.line || sevRank[a.severity] - sevRank[b.severity]);

  const stats: SeverityStats = {
    total: all.length,
    critical: all.filter((i) => i.severity === "critical").length,
    error: all.filter((i) => i.severity === "error").length,
    warning: all.filter((i) => i.severity === "warning").length,
    info: all.filter((i) => i.severity === "info").length,
  };

  const complexity = computeComplexity(code, lang);
  const warnings: string[] = [];
  warnings.push("Pattern-based analysis is reliable for deterministic rules. Heuristic findings (undefined-variable, missing-return, unreachable-code, off-by-one) need your review.");
  if (all.length === 0) warnings.push("No issues detected — this does NOT guarantee the code is bug-free. The tool only checks for the patterns it knows.");
  warnings.push("Always run your language's compiler/linter and test suite before shipping.");

  return {
    language: lang,
    issues: all,
    stats,
    complexity,
    smells,
    warnings,
  };
}

// ---------- Auto-fix ----------

export function autoFix(code: string, lang: Language): { fixed: string; fixes: AutoFix[] } {
  const fixes: AutoFix[] = [];
  let lines = linesOf(code);
  let varCount = 0;
  let semiCount = 0;
  let eqeqCount = 0;
  let breakCount = 0;

  // var -> let (JS/TS only)
  if (lang === "javascript" || lang === "typescript") {
    lines = lines.map((line) => {
      if (isCommentLine(line, lang)) return line;
      const m = line.match(/\bvar\s+(\w+)/);
      if (m) {
        varCount += 1;
        return line.replace(/\bvar\b/, "let");
      }
      return line;
    });
  }

  // == -> === (JS/TS only)
  if (lang === "javascript" || lang === "typescript") {
    lines = lines.map((line) => {
      if (isCommentLine(line, lang)) return line;
      // Replace == with === and != with !==, but not ===, !==, ==, <=, >=
      const newLine = line
        .replace(/([^=!<>])==([^=])/g, "$1===$2")
        .replace(/([^=!<>])!=([^=])/g, "$1!==$2");
      if (newLine !== line) eqeqCount += 1;
      return newLine;
    });
  }

  // Missing semicolons (JS/TS/Java/C++)
  if (lang === "javascript" || lang === "typescript" || lang === "java" || lang === "cpp") {
    lines = lines.map((line) => {
      if (isCommentLine(line, lang)) return line;
      const stripped = stripTrailingComment(line, lang).trim();
      if (!stripped) return line;
      if (/[{};:>]\s*$/.test(stripped)) return line;
      if (/^(if|else|for|while|switch|case|default|do|try|catch|finally|class|interface|enum|namespace|public|private|protected|static|import|package|using)\b/.test(stripped)) return line;
      if (stripped.endsWith("{")) return line;
      if (/^(return|throw|var|let|const|int|long|short|float|double|char|bool|auto|String|System\.out|\w+\s*=[^=])/.test(stripped) || /\w\(\)|\w+\s*\+|\w+\s*-/.test(stripped)) {
        if (!stripped.endsWith(";")) {
          // Find end of code (before trailing comment)
          const commentMatch = line.match(/^(.*?)(\/\/.*)$/);
          if (commentMatch) {
            semiCount += 1;
            return `${commentMatch[1]}; ${commentMatch[2]}`;
          }
          semiCount += 1;
          return `${line};`;
        }
      }
      return line;
    });
  }

  // Missing break in switch (JS/TS/Java/C++)
  if (lang === "javascript" || lang === "typescript" || lang === "java" || lang === "cpp") {
    const newLines: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      newLines.push(lines[i]);
      const line = lines[i];
      if (!/^\s*case\s+/.test(line) && !/^\s*default\s*:/.test(line)) continue;
      // Look ahead
      let hasStatement = false;
      let insertAt = -1;
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j];
        const nextTrim = next.trim();
        if (!nextTrim || isCommentLine(nextTrim, lang)) continue;
        if (/^(case|default)\b/.test(nextTrim)) {
          if (hasStatement && insertAt === -1) insertAt = j;
          break;
        }
        if (nextTrim === "}" || nextTrim === "};") break;
        if (nextTrim.startsWith("break") || nextTrim.startsWith("return") || nextTrim.startsWith("throw") || nextTrim.startsWith("continue")) break;
        hasStatement = true;
      }
      if (insertAt >= 0) {
        const indent = " ".repeat((lines[insertAt].match(/^\s*/)?.[0].length ?? 0));
        newLines.push(`${indent}break;`);
        breakCount += 1;
      }
    }
    lines = newLines;
  }

  if (varCount > 0) fixes.push({ rule: "var-usage", description: "Replaced 'var' with 'let'", applied: varCount });
  if (semiCount > 0) fixes.push({ rule: "missing-semicolon", description: "Added missing semicolons", applied: semiCount });
  if (eqeqCount > 0) fixes.push({ rule: "eqeq-vs-eqeqeq", description: "Converted '==' to '===' (and '!=' to '!==')", applied: eqeqCount });
  if (breakCount > 0) fixes.push({ rule: "missing-break-switch", description: "Added 'break' to switch cases", applied: breakCount });

  return { fixed: lines.join("\n"), fixes };
}

// ---------- Diff ----------

export function computeDiff(before: string, after: string): DiffLine[] {
  const a = before.replace(/\r\n/g, "\n").split("\n");
  const b = after.replace(/\r\n/g, "\n").split("\n");
  const out: DiffLine[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    const x = a[i];
    const y = b[i];
    if (x === y) out.push({ type: "same", before: x, after: y });
    else {
      if (x !== undefined) out.push({ type: "removed", before: x });
      if (y !== undefined) out.push({ type: "added", after: y });
    }
  }
  return out;
}

// ---------- Runtime error → root-cause guess ----------

export function guessRootCause(errorMessage: string, lang: Language): RootCauseGuess {
  const e = (errorMessage || "").toLowerCase();
  if (/undefined is not a function|cannot read propert/.test(e)) {
    return {
      matched: true,
      rule: "undefined-variable",
      severity: "error",
      explanation: "A variable or property was undefined when accessed. Usually a typo, missing import, or a value that wasn't initialized before use.",
      suggestedFix: "Check that the variable is declared and assigned before this line. Add a null/undefined check before accessing properties.",
    };
  }
  if (/zerodivisionerror|divide by zero|division by zero/.test(e)) {
    return {
      matched: true,
      rule: "division-by-zero",
      severity: "critical",
      explanation: "Your code divided by zero. This usually happens when a variable used as a divisor was 0 (e.g., an empty list's length, or a default value).",
      suggestedFix: "Guard the division with a check: if (denominator !== 0) { ... } else { handle the zero case }.",
    };
  }
  if (/indexerror|index out of range|out of bounds/.test(e)) {
    return {
      matched: true,
      rule: "off-by-one",
      severity: "error",
      explanation: "An array index was out of bounds. Often an off-by-one error: using `<=` instead of `<` in a loop, or accessing index N in a length-N array (valid indices are 0..N-1).",
      suggestedFix: "Check loop bounds — usually change `<=` to `<`. Verify array length before accessing `arr[arr.length]` (should be `arr[arr.length - 1]`).",
    };
  }
  if (/keyerror|key not found/.test(e)) {
    return {
      matched: true,
      severity: "error",
      explanation: "A dictionary/map key was not present. You accessed a key that doesn't exist.",
      suggestedFix: "Use `.get(key, default)` (Python) or `map.getOrDefault(key, default)` (Java) to provide a fallback. Or check `key in dict` / `map.has(key)` first.",
    };
  }
  if (/attributeerror|'none'/.test(e)) {
    return {
      matched: true,
      severity: "error",
      explanation: "You called a method or accessed an attribute on `None`/`null`. A function returned None unexpectedly (e.g., a function with no return, or a method that returned void).",
      suggestedFix: "Check that the value is not None/null before accessing attributes. Add explicit returns to all paths of the function.",
    };
  }
  if (/syntaxerror|unexpected token|expected ';'/i.test(e)) {
    return {
      matched: true,
      rule: "missing-semicolon",
      severity: "error",
      explanation: "A syntax error — usually a missing semicolon, bracket, or parenthesis. The parser hit an unexpected token.",
      suggestedFix: "Check the line indicated by the error for a missing `;`, `)`, `]`, or `}`. Use the bracket-mismatch rule to find unbalanced brackets.",
    };
  }
  if (/recursionerror|maximum call stack/.test(e)) {
    return {
      matched: true,
      rule: "infinite-loop",
      severity: "critical",
      explanation: "Infinite recursion — your function calls itself with no base case (or the base case is unreachable).",
      suggestedFix: "Add a base case that returns without recursing. Verify the recursive call moves toward the base case.",
    };
  }
  if (/nameerror|is not defined/.test(e)) {
    return {
      matched: true,
      rule: "undefined-variable",
      severity: "error",
      explanation: "An undefined name was used. Likely a typo, missing import, or a variable used before its declaration.",
      suggestedFix: "Check spelling. Add the import. Ensure the variable is declared before use.",
    };
  }
  if (/typeerror|illegalargumentexception|invalid argument/.test(e)) {
    return {
      matched: true,
      severity: "error",
      explanation: "A value had the wrong type for the operation. E.g., calling a non-function, adding a string to a number, or passing the wrong type to a function.",
      suggestedFix: "Check the types of the operands. Add type checks or conversions (Number(x), String(x), int(x)) where needed.",
    };
  }
  if (/timeout|timed out/.test(e)) {
    return {
      matched: true,
      rule: "infinite-loop",
      severity: "critical",
      explanation: "The program timed out — likely an infinite loop or very slow algorithm.",
      suggestedFix: "Check loop conditions for missing increment / unreachable break. Consider optimizing the algorithm.",
    };
  }
  return {
    matched: false,
    explanation: `No specific root-cause pattern matched this ${LANGUAGE_LABELS[lang]} error. The error may be language-specific or a higher-level issue.`,
  };
}

// ---------- History (localStorage) ----------

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

// ---------- Shareable URL ----------

export function buildShareUrl(language: Language, code: string): string {
  const params = new URLSearchParams();
  params.set("lang", language);
  if (code) params.set("code", code);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  let clean = hash;
  if (clean.startsWith("#") || clean.startsWith("?")) clean = clean.slice(1);
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const lang = params.get("lang") as Language | null;
  const code = params.get("code") ?? undefined;
  return {
    language: lang && ALL_LANGUAGES.includes(lang) ? lang : undefined,
    code,
  };
}

// ---------- Optional LLM explanation ----------

export function buildLlmPrompt(code: string, lang: Language, issues: Issue[]): string {
  const lines = [
    `You are an expert ${LANGUAGE_LABELS[lang]} code reviewer. The following code was analyzed by a static bug-finder.`,
    "For each issue, explain the root cause in plain English and propose a concrete fix.",
    "If an issue is a false positive, say so. If you spot additional issues not in the list, add them.",
    "",
    "Code:",
    "```" + lang,
    code,
    "```",
    "",
    "Static analysis issues found:",
    ...issues.map((i) => `- Line ${i.line} [${i.severity}] ${i.rule}: ${i.message}`),
    "",
    "Output a JSON object with:",
    '- "issues": array of { "rule": string, "explanation": string, "fix": string }',
    '- "overallNotes": array of strings (3-5 summary notes about code quality)',
    "",
    "No markdown fences, no commentary — only the JSON object.",
  ];
  return lines.join("\n");
}

export function renderLlmResult(rawText: string): { ok: true; result: LlmExplanation } | { ok: false; error: string } {
  let s = (rawText || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  let obj: unknown;
  try {
    obj = JSON.parse(s);
  } catch {
    return { ok: false, error: "Could not parse LLM output as JSON. Try again." };
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return { ok: false, error: "LLM output was not a JSON object." };
  }
  const o = obj as Record<string, unknown>;
  const issuesArr = Array.isArray(o.issues) ? o.issues : [];
  const issues = issuesArr
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map((x) => ({
      rule: (typeof x.rule === "string" ? x.rule : "unknown") as RuleId,
      explanation: typeof x.explanation === "string" ? x.explanation : "",
      fix: typeof x.fix === "string" ? x.fix : "",
    }));
  const overallNotes = Array.isArray(o.overallNotes)
    ? (o.overallNotes as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  return { ok: true, result: { issues, overallNotes } };
}

// ---------- Honesty ----------

export function honestyNote(): string {
  return "Pattern-based static analysis reliably catches deterministic issues (bracket mismatches, var usage, console.log leftovers, TODO markers, == vs ===, missing semicolons). Heuristic findings (undefined variables, missing returns, unreachable code, off-by-one) may produce false positives or miss real bugs — always review each finding before changing your code. The optional LLM explanation uses your own API key and goes directly to your chosen provider — skip it for 100% offline use.";
}
