/**
 * AI Code Converter — pure logic.
 *
 * Pattern-based translator that parses source code into a small intermediate
 * representation (Statement[]) and re-emits idiomatic code in the target
 * language. Supports Python, JavaScript, TypeScript, Java, C++, Go, Ruby.
 *
 * Pure functions only — no DOM, no network. The optional LLM call
 * (BYO API key) lives in ui.tsx and goes directly to the user's provider.
 *
 * Honesty: pattern-based translation cannot perfectly translate every
 * construct. Anything that doesn't match a known pattern is passed through
 * as raw text with a marker so the user can review it. Always compile and
 * test translated code (per blueprint §8).
 */

// ---------- Types ----------

export type Language =
  | "python"
  | "javascript"
  | "typescript"
  | "java"
  | "cpp"
  | "go"
  | "ruby";

export type StatementKind =
  | "comment"
  | "blank"
  | "function"
  | "class"
  | "variable"
  | "forRange"
  | "forEach"
  | "while"
  | "if"
  | "elif"
  | "else"
  | "return"
  | "print"
  | "try"
  | "catch"
  | "finally"
  | "throw"
  | "import"
  | "raw";

export interface Statement {
  kind: StatementKind;
  indent: number;          // indentation depth (in spaces)
  text?: string;           // raw / comment text
  name?: string;           // function/class/variable name
  params?: string[];       // function params (raw strings)
  value?: string;          // variable value / return value / throw expr
  varName?: string;        // loop variable / catch variable
  iterable?: string;       // for-each iterable
  start?: string;          // for-range start
  end?: string;            // for-range end (exclusive)
  step?: string;           // for-range step
  condition?: string;      // if/elif/while condition
  declKeyword?: string;    // var/let/const/auto/etc.
  type?: string;           // type annotation
  module?: string;         // import module name
  args?: string[];         // print args
  comment?: string;        // trailing comment
}

export interface KeyChange {
  category: string;
  description: string;
}

export interface UnsupportedFeature {
  line: number;
  text: string;
  reason: string;
}

export interface ConversionStats {
  totalLines: number;
  parsedLines: number;
  rawLines: number;
  blankLines: number;
  commentLines: number;
}

export interface ConversionResult {
  source: Language;
  target: Language;
  output: string;
  keyChanges: KeyChange[];
  unsupported: UnsupportedFeature[];
  stats: ConversionStats;
  warnings: string[];
}

export interface HistoryEntry {
  ts: number;
  source: Language;
  target: Language;
  snippet: string;       // first 80 chars of input
  linesTranslated: number;
}

export interface ShareState {
  source?: Language;
  target?: Language;
  code?: string;
  preserveComments?: boolean;
  fileMode?: boolean;
}

export interface LlmEnhancement {
  refinedCode: string;
  notes: string[];
  unsupportedResolved: string[];
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-code-converter:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-code-converter:llm-key";

export const LANGUAGE_LABELS: Record<Language, string> = {
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  java: "Java",
  cpp: "C++",
  go: "Go",
  ruby: "Ruby",
};

export const LANGUAGE_FILE_EXTENSIONS: Record<Language, string[]> = {
  python: ["py", "pyw"],
  javascript: ["js", "jsx", "mjs", "cjs"],
  typescript: ["ts", "tsx"],
  java: ["java"],
  cpp: ["cpp", "cc", "cxx", "hpp", "hh", "h"],
  go: ["go"],
  ruby: ["rb", "rbw"],
};

export const ALL_LANGUAGES: Language[] = [
  "python", "javascript", "typescript", "java", "cpp", "go", "ruby",
];

export const SAMPLE_SNIPPETS: Record<Language, string> = {
  python: [
    "def greet(name):",
    "    print(f'Hello, {name}!')",
    "",
    "for i in range(5):",
    "    greet(f'user{i}')",
    "",
    "if i > 3:",
    "    print('done')",
    "else:",
    "    print('more')",
  ].join("\n"),
  javascript: [
    "function greet(name) {",
    "  console.log(`Hello, ${name}!`);",
    "}",
    "",
    "for (let i = 0; i < 5; i++) {",
    "  greet(`user${i}`);",
    "}",
    "",
    "if (i > 3) {",
    "  console.log('done');",
    "} else {",
    "  console.log('more');",
    "}",
  ].join("\n"),
  typescript: [
    "function greet(name: string): void {",
    "  console.log(`Hello, ${name}!`);",
    "}",
    "",
    "for (let i = 0; i < 5; i++) {",
    "  greet(`user${i}`);",
    "}",
  ].join("\n"),
  java: [
    "public class Main {",
    "  public static void greet(String name) {",
    "    System.out.println(\"Hello, \" + name + \"!\");",
    "  }",
    "",
    "  public static void main(String[] args) {",
    "    for (int i = 0; i < 5; i++) {",
    "      greet(\"user\" + i);",
    "    }",
    "  }",
    "}",
  ].join("\n"),
  cpp: [
    "#include <iostream>",
    "",
    "void greet(const std::string& name) {",
    "  std::cout << \"Hello, \" << name << \"!\" << std::endl;",
    "}",
    "",
    "int main() {",
    "  for (int i = 0; i < 5; i++) {",
    "    greet(\"user\" + std::to_string(i));",
    "  }",
    "  return 0;",
    "}",
  ].join("\n"),
  go: [
    "package main",
    "",
    'import "fmt"',
    "",
    "func greet(name string) {",
    `  fmt.Printf("Hello, %s!\\n", name)`,
    "}",
    "",
    "func main() {",
    "  for i := 0; i < 5; i++ {",
    `    fmt.Sprintf("user%d", i)`,
    "    greet(fmt.Sprintf(\"user%d\", i))",
    "  }",
    "}",
  ].join("\n"),
  ruby: [
    "def greet(name)",
    '  puts "Hello, #{name}!"',
    "end",
    "",
    "5.times do |i|",
    '  greet("user#{i}")',
    "end",
  ].join("\n"),
};

export const LIBRARY_MAPPINGS: Record<string, { from: Language; to: Language; fromLib: string; toLib: string; note: string }[]> = {
  python_javascript: [
    { from: "python", to: "javascript", fromLib: "requests", toLib: "fetch", note: "requests.get(url) → fetch(url) (async)" },
    { from: "python", to: "javascript", fromLib: "json", toLib: "JSON", note: "json.loads → JSON.parse; json.dumps → JSON.stringify" },
    { from: "python", to: "javascript", fromLib: "os", toLib: "fs/path", note: "Use Node fs/path modules for file/path ops" },
    { from: "python", to: "javascript", fromLib: "re", toLib: "RegExp", note: "re.match → /pattern/.exec; re.sub → str.replace(/g, ...)" },
  ],
  javascript_python: [
    { from: "javascript", to: "python", fromLib: "fetch", toLib: "requests", note: "fetch(url) → requests.get(url)" },
    { from: "javascript", to: "python", fromLib: "JSON", toLib: "json", note: "JSON.parse → json.loads; JSON.stringify → json.dumps" },
    { from: "javascript", to: "python", fromLib: "lodash", toLib: "stdlib", note: "Most lodash helpers have stdlib equivalents" },
  ],
  python_go: [
    { from: "python", to: "go", fromLib: "requests", toLib: "net/http", note: "Use http.Get / http.Post" },
    { from: "python", to: "go", fromLib: "json", toLib: "encoding/json", note: "json.Marshal / json.Unmarshal" },
  ],
  java_cpp: [
    { from: "java", to: "cpp", fromLib: "java.util.List", toLib: "std::vector", note: "List<X> → std::vector<X>" },
    { from: "java", to: "cpp", fromLib: "java.util.Map", toLib: "std::unordered_map", note: "Map<K,V> → std::unordered_map<K,V>" },
    { from: "java", to: "cpp", fromLib: "System.out.println", toLib: "std::cout", note: "Use std::cout << x << std::endl" },
  ],
  cpp_java: [
    { from: "cpp", to: "java", fromLib: "std::vector", toLib: "java.util.List", note: "std::vector<X> → List<X> (ArrayList)" },
    { from: "cpp", to: "java", fromLib: "std::cout", toLib: "System.out.println", note: "cout << x → System.out.println(x)" },
  ],
};

// ---------- Indent helpers ----------

export function detectIndent(line: string): number {
  const m = line.match(/^[ \t]+/);
  if (!m) return 0;
  const s = m[0];
  // Tabs count as 4, spaces as 1
  let n = 0;
  for (const c of s) n += c === "\t" ? 4 : 1;
  return n;
}

export function normalizeIndent(spaces: number, lang: Language): string {
  const unit = lang === "python" ? 4 : 2;
  return " ".repeat(Math.max(0, Math.floor(spaces / unit)) * unit);
}

// ---------- Language detection ----------

const DETECTION_KEYWORDS: Record<Language, RegExp[]> = {
  python: [/^\s*def\s+\w+\s*\(/m, /^\s*import\s+\w+/m, /^\s*from\s+\w+\s+import/m, /^\s*print\s*\(/m, /^\s*elif\s+/m, /:\s*$/m],
  javascript: [/\bfunction\s+\w+\s*\(/, /\bconst\s+\w+\s*=/, /\blet\s+\w+\s*=/, /\bconsole\.log\s*\(/, /\brequire\s*\(/, /=>/],
  typescript: [/\bfunction\s+\w+\s*\([^)]*\)\s*:\s*\w+/, /\binterface\s+\w+/, /:\s*(string|number|boolean|void)\b/, /\bconst\s+\w+\s*:\s*\w+/],
  java: [/\bpublic\s+(static\s+)?(class|void|int|String)\s+/, /\bSystem\.out\.println\s*\(/, /\bprivate\s+(final\s+)?\w+\s+\w+\s*[;=]/, /import\s+java\./],
  cpp: [/#include\s*[<"]/m, /\bstd::/, /\bcout\s*<</, /\bint\s+main\s*\(\s*\)/, /\btemplate\s*</, /\bnamespace\s+/],
  go: [/\bpackage\s+main\b/, /\bfunc\s+\w+\s*\(/, /:=/, /\bfmt\./, /\brange\s+\w/, /\bgo\s+\w/],
  ruby: [/\bdef\s+\w+/m, /\bputs\s+/m, /\bend\s*$/m, /#\{/m, /\.times\s+do/, /\brequire\s+['"]/],
};

export function detectLanguage(code: string): Language {
  if (!code || !code.trim()) return "python";
  const scores: Record<Language, number> = {
    python: 0, javascript: 0, typescript: 0, java: 0, cpp: 0, go: 0, ruby: 0,
  };
  for (const lang of ALL_LANGUAGES) {
    for (const re of DETECTION_KEYWORDS[lang]) {
      if (re.test(code)) scores[lang] += 1;
    }
  }
  // Strong signals
  if (/#include\s*[<"]/.test(code)) scores.cpp += 3;
  if (/\bpackage\s+main\b/.test(code)) scores.go += 3;
  if (/\bSystem\.out\.println\s*\(/.test(code)) scores.java += 2;
  if (/^\s*def\s+\w+/m.test(code)) scores.python += 1;
  if (/\bend\s*$/m.test(code)) scores.ruby += 2;
  if (/: string\b|: number\b|interface \w+/.test(code)) scores.typescript += 2;
  // Pick the highest
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

export function detectFromFilename(filename: string): Language | null {
  const m = filename.match(/\.([a-z]+)$/i);
  if (!m) return null;
  const ext = m[1].toLowerCase();
  for (const lang of ALL_LANGUAGES) {
    if (LANGUAGE_FILE_EXTENSIONS[lang].includes(ext)) return lang;
  }
  return null;
}

// ---------- Parsers (per source language) ----------

/**
 * Parse a single line of code into a Statement.
 * Returns null if the line cannot be parsed into a structured statement.
 */
export function parseLine(line: string, lang: Language): Statement {
  const indent = detectIndent(line);
  const trimmed = line.slice(indent).replace(/\s+$/, "");
  // Trailing inline comment detection (non-Python)
  let trailingComment: string | undefined;
  let body = trimmed;

  // Pure comment line — handle BEFORE stripping trailing comments so a
  // line that is itself a comment is not mistaken for a blank line.
  // Note: in C/C++ `#include`, `#define`, etc. are preprocessor directives,
  // NOT comments — those are handled later in the language parser.
  const isCppPreprocessor = lang === "cpp" && /^#\s*(include|define|ifndef|ifdef|endif|else|elif|if|pragma|undef|line|error|warning)\b/.test(body);
  if (!isCppPreprocessor) {
    if (body.startsWith("//") || body.startsWith("/*") || body.startsWith("*") || body.startsWith("*/")) {
      return { kind: "comment", indent, text: body };
    }
    if ((lang === "python" || lang === "ruby") && body.startsWith("#")) {
      return { kind: "comment", indent, text: body };
    }
  }

  if (lang !== "python" && lang !== "ruby") {
    // Strip trailing // comment but not inside strings — naive
    const m = body.match(/^(.*?)(\/\/.*)$/);
    if (m && m[1].trim() !== "") {
      body = m[1].replace(/\s+$/, "");
      trailingComment = m[2];
    }
  }
  if (lang === "python" || lang === "ruby") {
    // Strip trailing # comment (naive — ignores # in strings)
    const hashIdx = body.indexOf("#");
    if (hashIdx > 0) {
      const before = body.slice(0, hashIdx);
      const after = body.slice(hashIdx);
      // Crude string-aware check: ensure # is not inside quotes
      const singleQuotes = (before.match(/'/g) ?? []).length;
      const doubleQuotes = (before.match(/"/g) ?? []).length;
      if (singleQuotes % 2 === 0 && doubleQuotes % 2 === 0) {
        body = before.replace(/\s+$/, "");
        trailingComment = after;
      }
    }
  }

  if (!body.trim()) {
    return { kind: "blank", indent, text: "", comment: trailingComment };
  }

  // Language-specific parsing
  let stmt: Statement | null = null;
  switch (lang) {
    case "python": stmt = parsePythonLine(body, indent); break;
    case "javascript": stmt = parseJavaScriptLine(body, indent); break;
    case "typescript": stmt = parseTypeScriptLine(body, indent); break;
    case "java": stmt = parseJavaLine(body, indent); break;
    case "cpp": stmt = parseCppLine(body, indent); break;
    case "go": stmt = parseGoLine(body, indent); break;
    case "ruby": stmt = parseRubyLine(body, indent); break;
  }
  if (!stmt) {
    return { kind: "raw", indent, text: body, comment: trailingComment };
  }
  if (trailingComment && !stmt.comment) stmt.comment = trailingComment;
  return stmt;
}

function parsePythonLine(body: string, indent: number): Statement | null {
  // def name(params):
  let m = body.match(/^def\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*)?$/);
  if (m) {
    return { kind: "function", indent, name: m[1], params: splitParams(m[2]) };
  }
  // class Name:
  m = body.match(/^class\s+(\w+)\s*(\([^)]*\))?\s*:\s*$/);
  if (m) {
    return { kind: "class", indent, name: m[1] };
  }
  // if cond:
  m = body.match(/^if\s+(.+?)\s*:\s*$/);
  if (m) return { kind: "if", indent, condition: m[1] };
  // elif cond:
  m = body.match(/^elif\s+(.+?)\s*:\s*$/);
  if (m) return { kind: "elif", indent, condition: m[1] };
  // else:
  if (/^else\s*:\s*$/.test(body)) return { kind: "else", indent };
  // for x in range(end):
  m = body.match(/^for\s+(\w+)\s+in\s+range\s*\(([^)]*)\)\s*:\s*$/);
  if (m) {
    const parts = splitParams(m[2]);
    if (parts.length === 1) return { kind: "forRange", indent, varName: m[1], start: "0", end: parts[0], step: "1" };
    if (parts.length === 2) return { kind: "forRange", indent, varName: m[1], start: parts[0], end: parts[1], step: "1" };
    if (parts.length === 3) return { kind: "forRange", indent, varName: m[1], start: parts[0], end: parts[1], step: parts[2] };
  }
  // for x in iterable:
  m = body.match(/^for\s+(\w+)\s+in\s+(.+?)\s*:\s*$/);
  if (m) return { kind: "forEach", indent, varName: m[1], iterable: m[2] };
  // while cond:
  m = body.match(/^while\s+(.+?)\s*:\s*$/);
  if (m) return { kind: "while", indent, condition: m[1] };
  // return value
  m = body.match(/^return\s+(.*)$/);
  if (m) return { kind: "return", indent, value: m[1] || "" };
  // print(...)
  m = body.match(/^print\s*\((.*)\)\s*$/);
  if (m) return { kind: "print", indent, args: [m[1]] };
  // try:
  if (/^try\s*:\s*$/.test(body)) return { kind: "try", indent };
  // except Exception as e:
  m = body.match(/^except\s+(\w+)\s*(?:as\s+(\w+))?\s*:\s*$/);
  if (m) return { kind: "catch", indent, type: m[1], varName: m[2] || "" };
  if (/^except\s*:\s*$/.test(body)) return { kind: "catch", indent, type: "Exception", varName: "" };
  if (/^finally\s*:\s*$/.test(body)) return { kind: "finally", indent };
  // raise X
  m = body.match(/^raise\s+(.*)$/);
  if (m) return { kind: "throw", indent, value: m[1] };
  // import x / from x import y
  m = body.match(/^from\s+([\w.]+)\s+import\s+(.+)$/);
  if (m) return { kind: "import", indent, module: m[1], value: m[2] };
  m = body.match(/^import\s+([\w.]+)(?:\s+as\s+(\w+))?$/);
  if (m) return { kind: "import", indent, module: m[1], varName: m[2] || "" };
  // variable assignment: name = value
  m = body.match(/^(\w+)\s*=\s*(.*)$/);
  if (m) return { kind: "variable", indent, name: m[1], value: m[2] };
  return null;
}

function parseJavaScriptLine(body: string, indent: number): Statement | null {
  // function name(params) {
  let m = body.match(/^function\s+(\w+)\s*\(([^)]*)\)\s*\{?\s*$/);
  if (m) return { kind: "function", indent, name: m[1], params: splitParams(m[2]) };
  // const name = (params) => {
  m = body.match(/^(?:const|let|var)\s+(\w+)\s*=\s*\(([^)]*)\)\s*=>\s*\{?\s*$/);
  if (m) return { kind: "function", indent, name: m[1], params: splitParams(m[2]) };
  // class Name {
  m = body.match(/^class\s+(\w+)(?:\s+extends\s+\w+)?\s*\{?\s*$/);
  if (m) return { kind: "class", indent, name: m[1] };
  // if (cond) {
  m = body.match(/^if\s*\((.+?)\)\s*\{?\s*$/);
  if (m) return { kind: "if", indent, condition: m[1] };
  // else if (cond) {
  m = body.match(/^else\s+if\s*\((.+?)\)\s*\{?\s*$/);
  if (m) return { kind: "elif", indent, condition: m[1] };
  // } else {
  if (/^else\s*\{?\s*$/.test(body)) return { kind: "else", indent };
  // } else if (cond) {
  m = body.match(/^\}\s*else\s+if\s*\((.+?)\)\s*\{?\s*$/);
  if (m) return { kind: "elif", indent, condition: m[1] };
  m = body.match(/^\}\s*else\s*\{?\s*$/);
  if (m) return { kind: "else", indent };
  // for (let i = 0; i < N; i++) {
  m = body.match(/^for\s*\(\s*(?:let|const|var)?\s*(\w+)\s*=\s*(.+?)\s*;\s*\1\s*(<|<=|>|>=)\s*(.+?)\s*;\s*\1\s*(\+\+|--|\+=\s*\d+|-=\s*\d+)\s*\)\s*\{?\s*$/);
  if (m) {
    const start = m[2];
    const op = m[3];
    const end = m[4];
    const stepExpr = m[5];
    let step = "1";
    if (stepExpr === "++") step = "1";
    else if (stepExpr === "--") step = "-1";
    else if (stepExpr.startsWith("+=")) step = stepExpr.slice(2).trim();
    else if (stepExpr.startsWith("-=")) step = "-" + stepExpr.slice(2).trim();
    return { kind: "forRange", indent, varName: m[1], start, end, step, condition: op };
  }
  // for (const x of xs) {
  m = body.match(/^for\s*\(\s*(?:const|let|var)\s+(\w+)\s+of\s+(.+?)\)\s*\{?\s*$/);
  if (m) return { kind: "forEach", indent, varName: m[1], iterable: m[2] };
  // for (const x in xs) {
  m = body.match(/^for\s*\(\s*(?:const|let|var)\s+(\w+)\s+in\s+(.+?)\)\s*\{?\s*$/);
  if (m) return { kind: "forEach", indent, varName: m[1], iterable: `Object.keys(${m[2]})` };
  // while (cond) {
  m = body.match(/^while\s*\((.+?)\)\s*\{?\s*$/);
  if (m) return { kind: "while", indent, condition: m[1] };
  // return value;
  m = body.match(/^return\s+(.*?);?\s*$/);
  if (m) return { kind: "return", indent, value: m[1] || "" };
  // console.log(...)
  m = body.match(/^console\.log\s*\((.*)\)\s*;?\s*$/);
  if (m) return { kind: "print", indent, args: [m[1]] };
  // try {
  if (/^try\s*\{?\s*$/.test(body)) return { kind: "try", indent };
  // catch (e) {
  m = body.match(/^catch\s*\(\s*(\w+)?\s*\)\s*\{?\s*$/);
  if (m) return { kind: "catch", indent, varName: m[1] || "", type: "" };
  // finally {
  if (/^finally\s*\{?\s*$/.test(body)) return { kind: "finally", indent };
  // throw expr;
  m = body.match(/^throw\s+(.*?);?\s*$/);
  if (m) return { kind: "throw", indent, value: m[1] };
  // import x from 'y'
  m = body.match(/^import\s+(.+?)\s+from\s+['"](.+)['"]\s*;?\s*$/);
  if (m) return { kind: "import", indent, module: m[2], value: m[1] };
  m = body.match(/^import\s+['"](.+)['"]\s*;?\s*$/);
  if (m) return { kind: "import", indent, module: m[1] };
  // const x = value;
  m = body.match(/^(const|let|var)\s+(\w+)\s*=\s*(.*?);?\s*$/);
  if (m) return { kind: "variable", indent, declKeyword: m[1], name: m[2], value: m[3] };
  // bare assignment: x = value;
  m = body.match(/^(\w+)\s*=\s*(.*?);?\s*$/);
  if (m) return { kind: "variable", indent, name: m[1], value: m[2] };
  // closing brace
  if (/^\}\s*$/.test(body)) return { kind: "raw", indent, text: "}" };
  return null;
}

function parseTypeScriptLine(body: string, indent: number): Statement | null {
  // function name(params): RetType {
  let m = body.match(/^function\s+(\w+)\s*\(([^)]*)\)\s*(?::\s*([\w<>[\]|, ]+))?\s*\{?\s*$/);
  if (m) {
    const stmt = parseJavaScriptLine(body, indent);
    if (stmt) return stmt;
    return { kind: "function", indent, name: m[1], params: splitParams(m[2]), type: m[3] };
  }
  // const name: type = value;
  m = body.match(/^(const|let|var)\s+(\w+)\s*:\s*([\w<>[\]|, ]+)\s*=\s*(.*?);?\s*$/);
  if (m) return { kind: "variable", indent, declKeyword: m[1], name: m[2], type: m[3], value: m[4] };
  // interface / type — fall through to raw
  if (/^(interface|type|enum)\s+/.test(body)) return { kind: "raw", indent, text: body };
  return parseJavaScriptLine(body, indent);
}

function parseJavaLine(body: string, indent: number): Statement | null {
  // public/private static? type name(params) {
  let m = body.match(/^(?:public|private|protected)\s+(?:static\s+)?(?:final\s+)?([\w<>[\]]+)\s+(\w+)\s*\(([^)]*)\)\s*\{?\s*$/);
  if (m) {
    // If type is "class", it's a class
    if (m[1] === "class") return { kind: "class", indent, name: m[2] };
    return { kind: "function", indent, name: m[2], params: splitParams(m[3]), type: m[1] };
  }
  // bare class Name {
  m = body.match(/^class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w, ]+)?\s*\{?\s*$/);
  if (m) return { kind: "class", indent, name: m[1] };
  // if (cond) {
  m = body.match(/^if\s*\((.+?)\)\s*\{?\s*$/);
  if (m) return { kind: "if", indent, condition: m[1] };
  // else if (cond) {
  m = body.match(/^else\s+if\s*\((.+?)\)\s*\{?\s*$/);
  if (m) return { kind: "elif", indent, condition: m[1] };
  if (/^else\s*\{?\s*$/.test(body)) return { kind: "else", indent };
  // for (int i = 0; i < N; i++) {
  m = body.match(/^for\s*\(\s*(?:int|long|short|byte|float|double)?\s*(\w+)\s*=\s*(.+?)\s*;\s*\1\s*(<|<=|>|>=)\s*(.+?)\s*;\s*\1\s*(\+\+|--)\s*\)\s*\{?\s*$/);
  if (m) return { kind: "forRange", indent, varName: m[1], start: m[2], end: m[4], step: m[5] === "++" ? "1" : "-1", condition: m[3] };
  // for (Type x : iterable) {
  m = body.match(/^for\s*\(\s*([\w<>[\]]+)\s+(\w+)\s*:\s*(.+?)\)\s*\{?\s*$/);
  if (m) return { kind: "forEach", indent, varName: m[2], iterable: m[3], type: m[1] };
  // while (cond) {
  m = body.match(/^while\s*\((.+?)\)\s*\{?\s*$/);
  if (m) return { kind: "while", indent, condition: m[1] };
  // return value;
  m = body.match(/^return\s+(.*?);?\s*$/);
  if (m) return { kind: "return", indent, value: m[1] || "" };
  // System.out.println(...)
  m = body.match(/^System\.out\.println\s*\((.*)\)\s*;?\s*$/);
  if (m) return { kind: "print", indent, args: [m[1] || ""] };
  // try {
  if (/^try\s*\{?\s*$/.test(body)) return { kind: "try", indent };
  m = body.match(/^catch\s*\(\s*([\w<>[\]]+)\s+(\w+)\s*\)\s*\{?\s*$/);
  if (m) return { kind: "catch", indent, type: m[1], varName: m[2] };
  if (/^finally\s*\{?\s*$/.test(body)) return { kind: "finally", indent };
  m = body.match(/^throw\s+new\s+(.+?)(?:\((.*)\))?\s*;?\s*$/);
  if (m) return { kind: "throw", indent, value: m[2] ? `new ${m[1]}(${m[2]})` : `new ${m[1]}` };
  // import x.y.z;
  m = body.match(/^import\s+([\w.]+);?\s*$/);
  if (m) return { kind: "import", indent, module: m[1] };
  // Type name = value;
  m = body.match(/^([\w<>[\]]+)\s+(\w+)\s*=\s*(.*?);?\s*$/);
  if (m) return { kind: "variable", indent, type: m[1], name: m[2], value: m[3] };
  // bare assignment
  m = body.match(/^(\w+)\s*=\s*(.*?);?\s*$/);
  if (m) return { kind: "variable", indent, name: m[1], value: m[2] };
  if (/^\}\s*$/.test(body)) return { kind: "raw", indent, text: "}" };
  return null;
}

function parseCppLine(body: string, indent: number): Statement | null {
  // #include
  let m = body.match(/^#include\s+[<"]([^>"]+)[>"]\s*$/);
  if (m) return { kind: "import", indent, module: m[1] };
  // using namespace X
  m = body.match(/^using\s+namespace\s+([\w:]+)\s*;?\s*$/);
  if (m) return { kind: "import", indent, module: `namespace:${m[1]}` };
  // type name(params) {
  m = body.match(/^(?:void|int|float|double|char|bool|auto|std::\w+|[\w:<>]+)\s+(\w+)\s*\(([^)]*)\)\s*\{?\s*$/);
  if (m) return { kind: "function", indent, name: m[1], params: splitParams(m[2]) };
  // class/struct Name {
  m = body.match(/^(?:class|struct)\s+(\w+)(?:\s*:\s*(?:public|private|protected)?\s*\w+)?\s*\{?\s*$/);
  if (m) return { kind: "class", indent, name: m[1] };
  // if (cond) {
  m = body.match(/^if\s*\((.+?)\)\s*\{?\s*$/);
  if (m) return { kind: "if", indent, condition: m[1] };
  m = body.match(/^else\s+if\s*\((.+?)\)\s*\{?\s*$/);
  if (m) return { kind: "elif", indent, condition: m[1] };
  if (/^else\s*\{?\s*$/.test(body)) return { kind: "else", indent };
  // for (int i = 0; i < N; i++) {
  m = body.match(/^for\s*\(\s*(?:int|long|short|size_t|auto)?\s*(\w+)\s*=\s*(.+?)\s*;\s*\1\s*(<|<=|>|>=)\s*(.+?)\s*;\s*\1\s*(\+\+|--)\s*\)\s*\{?\s*$/);
  if (m) return { kind: "forRange", indent, varName: m[1], start: m[2], end: m[4], step: m[5] === "++" ? "1" : "-1", condition: m[3] };
  // for (auto& x : iterable) {
  m = body.match(/^for\s*\(\s*(?:auto|const auto|auto&|const auto&|int|[\w:<>]+)\s+(\w+)\s*:\s*(.+?)\)\s*\{?\s*$/);
  if (m) return { kind: "forEach", indent, varName: m[1], iterable: m[2] };
  // while (cond) {
  m = body.match(/^while\s*\((.+?)\)\s*\{?\s*$/);
  if (m) return { kind: "while", indent, condition: m[1] };
  // return value;
  m = body.match(/^return\s+(.*?);?\s*$/);
  if (m) return { kind: "return", indent, value: m[1] || "" };
  // std::cout << ... ;
  m = body.match(/^std::cout\s*<<\s*(.*?);?\s*$/);
  if (m) return { kind: "print", indent, args: [m[1].replace(/<<\s*std::endl;?$/, "").replace(/<<\s*"\\n";?$/, "")] };
  if (/^try\s*\{?\s*$/.test(body)) return { kind: "try", indent };
  m = body.match(/^catch\s*\(\s*([\w:<>&*]+)\s+(\w+)\s*\)\s*\{?\s*$/);
  if (m) return { kind: "catch", indent, type: m[1], varName: m[2] };
  if (/^catch\s*\(\s*\.\.\.\s*\)\s*\{?\s*$/.test(body)) return { kind: "catch", indent, type: "...", varName: "" };
  m = body.match(/^throw\s+(.*?);?\s*$/);
  if (m) return { kind: "throw", indent, value: m[1] };
  // Type name = value;
  m = body.match(/^([\w:<>*&]+)\s+(\w+)\s*=\s*(.*?);?\s*$/);
  if (m) return { kind: "variable", indent, type: m[1], name: m[2], value: m[3] };
  m = body.match(/^(\w+)\s*=\s*(.*?);?\s*$/);
  if (m) return { kind: "variable", indent, name: m[1], value: m[2] };
  if (/^\}\s*$/.test(body)) return { kind: "raw", indent, text: "}" };
  return null;
}

function parseGoLine(body: string, indent: number): Statement | null {
  // package main
  let m = body.match(/^package\s+(\w+)\s*$/);
  if (m) return { kind: "import", indent, module: `package:${m[1]}` };
  // import "x"
  m = body.match(/^import\s+['"]([^'"]+)['"]\s*$/);
  if (m) return { kind: "import", indent, module: m[1] };
  // import ( block ) opener
  if (/^import\s*\(\s*$/.test(body)) return { kind: "raw", indent, text: "import (" };
  // func name(params) {
  m = body.match(/^func\s+(\w+)\s*\(([^)]*)\)\s*(?:\([\w, *]+\))?\s*\{?\s*$/);
  if (m) return { kind: "function", indent, name: m[1], params: splitParams(m[2]) };
  // func (recv) name(params) {
  m = body.match(/^func\s*\([^)]+\)\s+(\w+)\s*\(([^)]*)\)\s*\{?\s*$/);
  if (m) return { kind: "function", indent, name: m[1], params: splitParams(m[2]) };
  // type Name struct {
  m = body.match(/^type\s+(\w+)\s+struct\s*\{?\s*$/);
  if (m) return { kind: "class", indent, name: m[1] };
  // if cond {
  m = body.match(/^if\s+(.+?)\s*\{?\s*$/);
  if (m) return { kind: "if", indent, condition: m[1] };
  // else if cond {
  m = body.match(/^else\s+if\s+(.+?)\s*\{?\s*$/);
  if (m) return { kind: "elif", indent, condition: m[1] };
  if (/^else\s*\{?\s*$/.test(body)) return { kind: "else", indent };
  // for i := 0; i < N; i++ {
  m = body.match(/^for\s+(\w+)\s*:?=\s*(.+?)\s*;\s*\1\s*(<|<=|>|>=)\s*(.+?)\s*;\s*\1\s*(\+\+|--)\s*\{?\s*$/);
  if (m) return { kind: "forRange", indent, varName: m[1], start: m[2], end: m[4], step: m[5] === "++" ? "1" : "-1", condition: m[3] };
  // for x := range iterable {
  m = body.match(/^for\s+(?:_,\s*)?(\w+)\s*:?=\s*range\s+(.+?)\s*\{?\s*$/);
  if (m) return { kind: "forEach", indent, varName: m[1], iterable: m[2] };
  // for cond {
  m = body.match(/^for\s+(.+?)\s*\{?\s*$/);
  if (m) return { kind: "while", indent, condition: m[1] };
  // for {
  if (/^for\s*\{?\s*$/.test(body)) return { kind: "while", indent, condition: "true" };
  // return value
  m = body.match(/^return\s+(.*)$/);
  if (m) return { kind: "return", indent, value: m[1] || "" };
  // fmt.Println(...)
  m = body.match(/^fmt\.Println\s*\((.*)\)\s*$/);
  if (m) return { kind: "print", indent, args: [m[1] || ""] };
  m = body.match(/^fmt\.Printf\s*\((.*)\)\s*$/);
  if (m) return { kind: "print", indent, args: [m[1] || ""] };
  if (/^defer\s+/.test(body)) return { kind: "raw", indent, text: body };
  // name := value
  m = body.match(/^(\w+)\s*:?=\s*(.*)$/);
  if (m) return { kind: "variable", indent, name: m[1], value: m[2] };
  if (/^\}\s*$/.test(body)) return { kind: "raw", indent, text: "}" };
  return null;
}

function parseRubyLine(body: string, indent: number): Statement | null {
  // def name(params)
  let m = body.match(/^def\s+(\w+)(?:\s*\(([^)]*)\))?\s*$/);
  if (m) return { kind: "function", indent, name: m[1], params: splitParams(m[2] || "") };
  // class Name
  m = body.match(/^class\s+(\w+)\s*(?:<\s*\w+)?\s*$/);
  if (m) return { kind: "class", indent, name: m[1] };
  // if cond
  m = body.match(/^if\s+(.+?)\s*$/);
  if (m) return { kind: "if", indent, condition: m[1] };
  // elsif cond
  m = body.match(/^elsif\s+(.+?)\s*$/);
  if (m) return { kind: "elif", indent, condition: m[1] };
  // unless cond
  m = body.match(/^unless\s+(.+?)\s*$/);
  if (m) return { kind: "if", indent, condition: `!(${m[1]})` };
  if (/^else\s*$/.test(body)) return { kind: "else", indent };
  if (/^end\s*$/.test(body)) return { kind: "raw", indent, text: "end" };
  // N.times do |i|
  m = body.match(/^(\w+)\.times\s+do\s*\|(\w+)\|\s*$/);
  if (m) return { kind: "forRange", indent, varName: m[2], start: "0", end: m[1], step: "1" };
  // for x in xs
  m = body.match(/^for\s+(\w+)\s+in\s+(.+?)\s*$/);
  if (m) return { kind: "forEach", indent, varName: m[1], iterable: m[2] };
  // each do |x|
  m = body.match(/^(.+?)\.each\s+do\s*\|(\w+)\|\s*$/);
  if (m) return { kind: "forEach", indent, varName: m[2], iterable: m[1] };
  // while cond
  m = body.match(/^while\s+(.+?)\s*$/);
  if (m) return { kind: "while", indent, condition: m[1] };
  // return value
  m = body.match(/^return\s+(.*)$/);
  if (m) return { kind: "return", indent, value: m[1] || "" };
  // puts
  m = body.match(/^puts\s+(.*)$/);
  if (m) return { kind: "print", indent, args: [m[1] || ""] };
  // p
  m = body.match(/^p\s+(.*)$/);
  if (m) return { kind: "print", indent, args: [m[1] || ""] };
  // begin / rescue / ensure
  if (/^begin\s*$/.test(body)) return { kind: "try", indent };
  m = body.match(/^rescue\s*(?:=>\s*(\w+))?\s*$/);
  if (m) return { kind: "catch", indent, varName: m[1] || "", type: "" };
  if (/^ensure\s*$/.test(body)) return { kind: "finally", indent };
  // raise
  m = body.match(/^raise\s+(.*)$/);
  if (m) return { kind: "throw", indent, value: m[1] };
  // require
  m = body.match(/^require\s+['"]([^'"]+)['"]\s*$/);
  if (m) return { kind: "import", indent, module: m[1] };
  // variable assignment: name = value
  m = body.match(/^(\w+)\s*=\s*(.*)$/);
  if (m) return { kind: "variable", indent, name: m[1], value: m[2] };
  return null;
}

function splitParams(s: string): string[] {
  if (!s || !s.trim()) return [];
  // Naive split on commas, no nested parens support
  return s.split(",").map((p) => p.trim()).filter(Boolean);
}

// ---------- Emitters (per target language) ----------

export function emitStatement(stmt: Statement, lang: Language): string {
  const pad = " ".repeat(stmt.indent);
  const tail = stmt.comment && lang !== "python" && lang !== "ruby" ? ` ${stmt.comment}` : "";
  const pyTail = stmt.comment && (lang === "python" || lang === "ruby") ? `  ${stmt.comment}` : "";
  switch (stmt.kind) {
    case "blank":
      return "";
    case "comment":
      return `${pad}${renderComment(stmt.text || "", lang)}`;
    case "function":
      return `${pad}${renderFunction(stmt, lang)}`;
    case "class":
      return `${pad}${renderClass(stmt, lang)}`;
    case "variable":
      return `${pad}${renderVariable(stmt, lang)}${tail}`;
    case "forRange":
      return `${pad}${renderForRange(stmt, lang)}${pyTail}`;
    case "forEach":
      return `${pad}${renderForEach(stmt, lang)}${pyTail}`;
    case "while":
      return `${pad}${renderWhile(stmt, lang)}${pyTail}`;
    case "if":
      return `${pad}${renderIf(stmt, lang)}${pyTail}`;
    case "elif":
      return `${pad}${renderElif(stmt, lang)}${pyTail}`;
    case "else":
      return `${pad}${renderElse(stmt, lang)}`;
    case "return":
      return `${pad}${renderReturn(stmt, lang)}${tail}`;
    case "print":
      return `${pad}${renderPrint(stmt, lang)}${tail}`;
    case "try":
      return `${pad}${renderTry(lang)}`;
    case "catch":
      return `${pad}${renderCatch(stmt, lang)}`;
    case "finally":
      return `${pad}${renderFinally(lang)}`;
    case "throw":
      return `${pad}${renderThrow(stmt, lang)}${tail}`;
    case "import":
      return `${pad}${renderImport(stmt, lang)}`;
    case "raw":
      return `${pad}${stmt.text || ""}${tail}`;
  }
}

function renderComment(text: string, lang: Language): string {
  if (!text) return "";
  if (lang === "python" || lang === "ruby") {
    // Convert // to #
    if (text.startsWith("//")) return `# ${text.slice(2).trim()}`;
    if (text.startsWith("/*") || text.startsWith("*") || text.startsWith("*/")) {
      return `# ${text.replace(/[/*]/g, "").trim()}`;
    }
    return text;
  }
  // Brace languages
  if (text.startsWith("#") && !text.startsWith("#include")) {
    return `// ${text.slice(1).trim()}`;
  }
  return text;
}

function renderFunction(stmt: Statement, lang: Language): string {
  const name = stmt.name || "fn";
  const params = (stmt.params || []).join(", ");
  switch (lang) {
    case "python": return `def ${name}(${params}):`;
    case "javascript": return `function ${name}(${params}) {`;
    case "typescript": {
      const ret = stmt.type ? `: ${stmt.type}` : "";
      return `function ${name}(${params})${ret} {`;
    }
    case "java": {
      const ret = stmt.type || "void";
      return `public static ${ret} ${name}(${params}) {`;
    }
    case "cpp": {
      const ret = stmt.type || "void";
      return `${ret} ${name}(${params}) {`;
    }
    case "go":
      return `func ${name}(${params}) {`;
    case "ruby":
      return `def ${name}${params ? `(${params})` : ""}`;
  }
}

function renderClass(stmt: Statement, lang: Language): string {
  const name = stmt.name || "Cls";
  switch (lang) {
    case "python": return `class ${name}:`;
    case "javascript": return `class ${name} {`;
    case "typescript": return `class ${name} {`;
    case "java": return `public class ${name} {`;
    case "cpp": return `class ${name} {`;
    case "go": return `type ${name} struct {`;
    case "ruby": return `class ${name}`;
  }
}

function renderVariable(stmt: Statement, lang: Language): string {
  const name = stmt.name || "x";
  const value = stmt.value || "";
  switch (lang) {
    case "python": return `${name} = ${value}`;
    case "javascript": return `let ${name} = ${value};`;
    case "typescript":
      if (stmt.type) return `let ${name}: ${stmt.type} = ${value};`;
      return `let ${name} = ${value};`;
    case "java": {
      const t = stmt.type || "var";
      return `${t} ${name} = ${value};`;
    }
    case "cpp": {
      const t = stmt.type || "auto";
      return `${t} ${name} = ${value};`;
    }
    case "go": return `${name} := ${value}`;
    case "ruby": return `${name} = ${value}`;
  }
}

function renderForRange(stmt: Statement, lang: Language): string {
  const v = stmt.varName || "i";
  const start = stmt.start || "0";
  const end = stmt.end || "n";
  const step = stmt.step || "1";
  const op = stmt.condition || "<";
  switch (lang) {
    case "python": {
      if (start === "0" && step === "1") return `for ${v} in range(${end}):`;
      if (step === "1") return `for ${v} in range(${start}, ${end}):`;
      return `for ${v} in range(${start}, ${end}, ${step}):`;
    }
    case "javascript":
    case "typescript": {
      const stepExpr = step === "1" ? `${v}++` : step === "-1" ? `${v}--` : `${v} += ${step}`;
      return `for (let ${v} = ${start}; ${v} ${op} ${end}; ${stepExpr}) {`;
    }
    case "java": {
      const stepExpr = step === "1" ? `${v}++` : step === "-1" ? `${v}--` : `${v} += ${step}`;
      return `for (int ${v} = ${start}; ${v} ${op} ${end}; ${stepExpr}) {`;
    }
    case "cpp": {
      const stepExpr = step === "1" ? `${v}++` : step === "-1" ? `${v}--` : `${v} += ${step}`;
      return `for (int ${v} = ${start}; ${v} ${op} ${end}; ${stepExpr}) {`;
    }
    case "go": {
      const stepExpr = step === "1" ? `${v}++` : step === "-1" ? `${v}--` : `${v} += ${step}`;
      return `for ${v} := ${start}; ${v} ${op} ${end}; ${stepExpr} {`;
    }
    case "ruby": {
      if (start === "0" && step === "1") return `${end}.times do |${v}|`;
      if (step === "1") return `(${start}...${end}).each do |${v}|`;
      return `(${start}...${end}).step(${step}).each do |${v}|`;
    }
  }
}

function renderForEach(stmt: Statement, lang: Language): string {
  const v = stmt.varName || "x";
  const it = stmt.iterable || "xs";
  switch (lang) {
    case "python": return `for ${v} in ${it}:`;
    case "javascript": return `for (const ${v} of ${it}) {`;
    case "typescript": return `for (const ${v} of ${it}) {`;
    case "java": return `for (var ${v} : ${it}) {`;
    case "cpp": return `for (const auto& ${v} : ${it}) {`;
    case "go": return `for _, ${v} := range ${it} {`;
    case "ruby": return `${it}.each do |${v}|`;
  }
}

function renderWhile(stmt: Statement, lang: Language): string {
  const cond = stmt.condition || "true";
  switch (lang) {
    case "python": return `while ${cond}:`;
    case "javascript": return `while (${cond}) {`;
    case "typescript": return `while (${cond}) {`;
    case "java": return `while (${cond}) {`;
    case "cpp": return `while (${cond}) {`;
    case "go": return `for ${cond} {`;
    case "ruby": return `while ${cond}`;
  }
}

function renderIf(stmt: Statement, lang: Language): string {
  const cond = stmt.condition || "true";
  switch (lang) {
    case "python": return `if ${cond}:`;
    case "javascript": return `if (${cond}) {`;
    case "typescript": return `if (${cond}) {`;
    case "java": return `if (${cond}) {`;
    case "cpp": return `if (${cond}) {`;
    case "go": return `if ${cond} {`;
    case "ruby": return `if ${cond}`;
  }
}

function renderElif(stmt: Statement, lang: Language): string {
  const cond = stmt.condition || "true";
  switch (lang) {
    case "python": return `elif ${cond}:`;
    case "javascript": return `} else if (${cond}) {`;
    case "typescript": return `} else if (${cond}) {`;
    case "java": return `} else if (${cond}) {`;
    case "cpp": return `} else if (${cond}) {`;
    case "go": return `} else if ${cond} {`;
    case "ruby": return `elsif ${cond}`;
  }
}

function renderElse(stmt: Statement, lang: Language): string {
  switch (lang) {
    case "python": return `else:`;
    case "javascript": return `} else {`;
    case "typescript": return `} else {`;
    case "java": return `} else {`;
    case "cpp": return `} else {`;
    case "go": return `} else {`;
    case "ruby": return `else`;
  }
}

function renderReturn(stmt: Statement, lang: Language): string {
  const v = stmt.value || "";
  switch (lang) {
    case "python": return v ? `return ${v}` : `return`;
    case "javascript": return v ? `return ${v};` : `return;`;
    case "typescript": return v ? `return ${v};` : `return;`;
    case "java": return v ? `return ${v};` : `return;`;
    case "cpp": return v ? `return ${v};` : `return;`;
    case "go": return v ? `return ${v}` : `return`;
    case "ruby": return v ? `return ${v}` : `return`;
  }
}

function renderPrint(stmt: Statement, lang: Language): string {
  const arg = (stmt.args && stmt.args[0]) || '""';
  switch (lang) {
    case "python": return `print(${arg})`;
    case "javascript": return `console.log(${arg});`;
    case "typescript": return `console.log(${arg});`;
    case "java": return `System.out.println(${arg});`;
    case "cpp": return `std::cout << ${arg} << std::endl;`;
    case "go": return `fmt.Println(${arg})`;
    case "ruby": return `puts ${arg}`;
  }
}

function renderTry(lang: Language): string {
  switch (lang) {
    case "python": return `try:`;
    case "javascript": return `try {`;
    case "typescript": return `try {`;
    case "java": return `try {`;
    case "cpp": return `try {`;
    case "go": return `defer func() {`;
    case "ruby": return `begin`;
  }
}

function renderCatch(stmt: Statement, lang: Language): string {
  const v = stmt.varName || "e";
  switch (lang) {
    case "python": return `except ${stmt.type || "Exception"}${v ? ` as ${v}` : ""}:`;
    case "javascript": return `} catch (${v}) {`;
    case "typescript": return `} catch (${v}) {`;
    case "java": return `} catch (${stmt.type || "Exception"} ${v}) {`;
    case "cpp": return `} catch (${stmt.type || "..."} ${v === "e" ? "" : v}) {`;
    case "go": return `}()`;
    case "ruby": return `rescue${v ? ` => ${v}` : ""}`;
  }
}

function renderFinally(lang: Language): string {
  switch (lang) {
    case "python": return `finally:`;
    case "javascript": return `} finally {`;
    case "typescript": return `} finally {`;
    case "java": return `} finally {`;
    case "cpp": return `/* finally not supported in C++ */`;
    case "go": return `/* defer is the Go idiom */`;
    case "ruby": return `ensure`;
  }
}

function renderThrow(stmt: Statement, lang: Language): string {
  const v = stmt.value || `new Error("oops")`;
  switch (lang) {
    case "python": return `raise ${v}`;
    case "javascript": return `throw ${v};`;
    case "typescript": return `throw ${v};`;
    case "java": return `throw ${v};`;
    case "cpp": return `throw ${v};`;
    case "go": return `panic(${v})`;
    case "ruby": return `raise ${v}`;
  }
}

function renderImport(stmt: Statement, lang: Language): string {
  const mod = stmt.module || "";
  switch (lang) {
    case "python": {
      if (mod.startsWith("package:")) return `# package: ${mod.slice(8)}`;
      if (stmt.value && stmt.value !== mod) return `from ${mod} import ${stmt.value}`;
      if (stmt.varName) return `import ${mod} as ${stmt.varName}`;
      return `import ${mod}`;
    }
    case "javascript": return `import '${mod}';`;
    case "typescript": return `import '${mod}';`;
    case "java": return `import ${mod};`;
    case "cpp": return `#include <${mod}>`;
    case "go": return `import "${mod}"`;
    case "ruby": return `require '${mod}'`;
  }
}

// ---------- Block handling (Python source -> brace target) ----------

/**
 * Post-process emitted statements to insert closing braces / 'end'
 * for block-opening constructs when the target language requires them.
 */
export function closeBlocks(statements: Statement[], target: Language): Statement[] {
  if (target === "python" || target === "ruby") return statements;
  // For brace languages, we need to insert `}` at dedent points.
  // Strategy: track an indent stack. When indent decreases, emit closing braces.
  const out: Statement[] = [];
  const stack: number[] = [];
  for (const stmt of statements) {
    const cur = stmt.indent;
    while (stack.length > 0 && stack[stack.length - 1] >= cur) {
      const last = stack.pop()!;
      // Don't add closing brace for raw `}` lines (already closed)
      const lastStmt = out[out.length - 1];
      if (lastStmt && lastStmt.kind === "raw" && lastStmt.text === "}") continue;
      out.push({ kind: "raw", indent: last, text: "}" });
    }
    if (isOpenBlock(stmt)) {
      stack.push(cur);
    }
    out.push(stmt);
  }
  // Close remaining
  while (stack.length > 0) {
    const last = stack.pop()!;
    out.push({ kind: "raw", indent: last, text: "}" });
  }
  return out;
}

function isOpenBlock(stmt: Statement): boolean {
  switch (stmt.kind) {
    case "function":
    case "class":
    case "forRange":
    case "forEach":
    case "while":
    case "if":
    case "elif":
    case "else":
    case "try":
    case "catch":
    case "finally":
      return true;
    default:
      return false;
  }
}

// ---------- Top-level converter ----------

export interface ConvertOptions {
  preserveComments?: boolean;
  fileMode?: boolean;
}

export function convertCode(
  code: string,
  source: Language,
  target: Language,
  opts: ConvertOptions = {},
): ConversionResult {
  const lines = code.replace(/\r\n/g, "\n").split("\n");
  const parsed: Statement[] = lines.map((line) => parseLine(line, source));
  // Drop comments if not preserving
  const processed: Statement[] = opts.preserveComments === false
    ? parsed.filter((s) => s.kind !== "comment")
    : parsed;
  const withCloses = closeBlocks(processed, target);
  const output = withCloses.map((s) => emitStatement(s, target)).join("\n");

  // Stats
  let parsedLines = 0;
  let rawLines = 0;
  let blankLines = 0;
  let commentLines = 0;
  for (const s of parsed) {
    if (s.kind === "blank") blankLines += 1;
    else if (s.kind === "comment") commentLines += 1;
    else if (s.kind === "raw") rawLines += 1;
    else parsedLines += 1;
  }
  const stats: ConversionStats = {
    totalLines: lines.length,
    parsedLines,
    rawLines,
    blankLines,
    commentLines,
  };

  // Unsupported features (raw lines that aren't `}` or `end`)
  const unsupported: UnsupportedFeature[] = [];
  lines.forEach((line, i) => {
    const s = parseLine(line, source);
    if (s.kind === "raw" && s.text && s.text !== "}" && s.text !== "end" && s.text !== "import (" && s.text.trim()) {
      unsupported.push({ line: i + 1, text: s.text, reason: "Pattern not recognized — passed through verbatim" });
    }
  });

  const keyChanges = computeKeyChanges(source, target);
  const warnings: string[] = [];
  if (source === target) warnings.push("Source and target languages are identical — output will mirror input.");
  if (rawLines > 0) warnings.push(`${rawLines} line(s) could not be translated and were passed through verbatim — review manually.`);
  warnings.push("Always compile and test the translated code; pattern-based conversion cannot guarantee semantic equivalence.");

  return {
    source,
    target,
    output,
    keyChanges,
    unsupported,
    stats,
    warnings,
  };
}

export function computeKeyChanges(source: Language, target: Language): KeyChange[] {
  const changes: KeyChange[] = [];
  // Block syntax
  if ((source === "python" || source === "ruby") && target !== "python" && target !== "ruby") {
    changes.push({ category: "Blocks", description: `Indentation-based blocks converted to braces {}` });
  }
  if (source !== "python" && source !== "ruby" && (target === "python" || target === "ruby")) {
    changes.push({ category: "Blocks", description: `Brace-based blocks converted to indentation + ${target === "python" ? "':'" : "'end'"}` });
  }
  // Function defs
  changes.push({ category: "Functions", description: `Function declarations rewritten in ${LANGUAGE_LABELS[target]} syntax` });
  // Print
  changes.push({ category: "Print", description: `Print statements mapped to ${printIdiom(target)}` });
  // For loops
  changes.push({ category: "Loops", description: `For-range loops normalized to ${LANGUAGE_LABELS[target]} idiom` });
  // Variables
  changes.push({ category: "Variables", description: `Variable declarations adapted to ${LANGUAGE_LABELS[target]} typing style` });
  // Comments
  changes.push({ category: "Comments", description: `Comments normalized to ${commentIdiom(target)}` });
  return changes;
}

function printIdiom(lang: Language): string {
  switch (lang) {
    case "python": return "print()";
    case "javascript": return "console.log()";
    case "typescript": return "console.log()";
    case "java": return "System.out.println()";
    case "cpp": return "std::cout << ... << std::endl";
    case "go": return "fmt.Println()";
    case "ruby": return "puts";
  }
}

function commentIdiom(lang: Language): string {
  if (lang === "python" || lang === "ruby") return "# ...";
  return "// ...";
}

// ---------- Library mappings ----------

export function libraryMappings(source: Language, target: Language): { fromLib: string; toLib: string; note: string }[] {
  const key = `${source}_${target}`;
  const list = LIBRARY_MAPPINGS[key] || [];
  return list.map((m) => ({ fromLib: m.fromLib, toLib: m.toLib, note: m.note }));
}

// ---------- Diff ----------

export interface DiffLine {
  type: "same" | "added" | "removed";
  source?: string;
  target?: string;
}

export function computeDiff(source: string, target: string): DiffLine[] {
  const srcLines = source.replace(/\r\n/g, "\n").split("\n");
  const tgtLines = target.replace(/\r\n/g, "\n").split("\n");
  const out: DiffLine[] = [];
  const max = Math.max(srcLines.length, tgtLines.length);
  for (let i = 0; i < max; i++) {
    const s = srcLines[i];
    const t = tgtLines[i];
    if (s === t) {
      out.push({ type: "same", source: s, target: t });
    } else {
      if (s !== undefined) out.push({ type: "removed", source: s });
      if (t !== undefined) out.push({ type: "added", target: t });
    }
  }
  return out;
}

export function renderDiffHtml(diff: DiffLine[]): string {
  return diff.map((d) => {
    if (d.type === "same") return `  ${escapeHtml(d.source || "")}`;
    if (d.type === "added") return `+ ${escapeHtml(d.target || "")}`;
    return `- ${escapeHtml(d.source || "")}`;
  }).join("\n");
}

// ---------- File mode wrappers ----------

export function wrapInFileBoilerplate(code: string, lang: Language, filename?: string): string {
  switch (lang) {
    case "python": return code;
    case "javascript": return code;
    case "typescript": return code;
    case "java": {
      const cls = filename ? filename.replace(/\.java$/i, "").replace(/[^A-Za-z0-9_]/g, "") : "Main";
      return `public class ${cls || "Main"} {\n${indentBlock(code, 2)}\n}`;
    }
    case "cpp": {
      const inc = ["#include <iostream>", "#include <string>", "#include <vector>", "#include <map>"].join("\n");
      return `${inc}\n\n${indentBlock(code, 0)}\n`;
    }
    case "go": {
      const pkg = "package main\n\nimport (\n  \"fmt\"\n)\n\n";
      return `${pkg}${code}\n`;
    }
    case "ruby": return code;
  }
}

function indentBlock(code: string, n: number): string {
  const pad = " ".repeat(n);
  return code.split("\n").map((l) => l.length ? pad + l : l).join("\n");
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

export function buildShareUrl(source: Language, target: Language, code: string, opts: ConvertOptions): string {
  const params = new URLSearchParams();
  params.set("src", source);
  params.set("tgt", target);
  if (code) params.set("code", code);
  if (opts.preserveComments === false) params.set("nc", "1");
  if (opts.fileMode) params.set("file", "1");
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  let clean = hash;
  if (clean.startsWith("#") || clean.startsWith("?")) clean = clean.slice(1);
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const source = params.get("src") as Language | null;
  const target = params.get("tgt") as Language | null;
  const code = params.get("code") ?? undefined;
  const nc = params.get("nc") === "1";
  const file = params.get("file") === "1";
  return {
    source: source && ALL_LANGUAGES.includes(source) ? source : undefined,
    target: target && ALL_LANGUAGES.includes(target) ? target : undefined,
    code,
    preserveComments: nc ? false : undefined,
    fileMode: file || undefined,
  };
}

// ---------- Optional LLM enhancement ----------

export function buildLlmPrompt(code: string, source: Language, target: Language, unsupported: UnsupportedFeature[]): string {
  const lines = [
    `You are an expert polyglot programmer. Translate the following ${LANGUAGE_LABELS[source]} code to idiomatic ${LANGUAGE_LABELS[target]}.`,
    "Preserve logic, naming, and behavior. Use idiomatic patterns of the target language.",
    "If a construct has no direct equivalent, use the closest idiomatic substitute and explain it in 'notes'.",
    "",
    "Source code:",
    "```" + source,
    code,
    "```",
    "",
    "Untranslated patterns flagged by the static converter:",
    ...unsupported.map((u) => `- Line ${u.line}: ${u.text} (${u.reason})`),
    "",
    "Output a JSON object with:",
    '- "refinedCode": the full translated code as a string',
    '- "notes": array of strings (3-6 style notes about key conversions)',
    '- "unsupportedResolved": array of strings (each resolving one of the flagged unsupported patterns)',
    "",
    "No markdown fences, no commentary — only the JSON object.",
  ];
  return lines.join("\n");
}

export function renderLlmResult(rawText: string): { ok: true; result: LlmEnhancement } | { ok: false; error: string } {
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
  const refinedCode = typeof o.refinedCode === "string" ? o.refinedCode : "";
  const notes = Array.isArray(o.notes)
    ? (o.notes as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  const unsupportedResolved = Array.isArray(o.unsupportedResolved)
    ? (o.unsupportedResolved as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  return { ok: true, result: { refinedCode, notes, unsupportedResolved } };
}

// ---------- Honesty ----------

export function honestyNote(): string {
  return "Pattern-based translation handles common constructs (loops, conditionals, functions, classes, prints, variables) but cannot perfectly translate every construct. Async/await semantics, decorators, generics, operator overloading, and language-specific stdlib calls need manual review. Always compile and test the translated code. The optional LLM enhancement uses your own API key and goes directly to your chosen provider — skip it for 100% offline use.";
}

// ---------- Helpers ----------

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
