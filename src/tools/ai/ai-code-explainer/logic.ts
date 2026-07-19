/**
 * AI Code Explainer — pure logic.
 *
 * Deterministic, line-by-line code explanation. Pure functions only — no
 * DOM, no network. The optional LLM call (BYO API key) lives in ui.tsx and
 * goes directly to the user's provider.
 *
 * Honesty: construct detection reliably identifies WHAT a line IS
 * (function declaration, loop, conditional, etc.). Template-based
 * explanations of WHAT A LINE MEANS are heuristic — they're a starting
 * point for understanding, not ground truth. The optional BYO-key LLM
 * enhancement can refine the prose.
 */

// ---------- Types ----------

export type Language = "python" | "javascript" | "typescript" | "java" | "cpp" | "go";

export type Depth = "eli5" | "beginner" | "intermediate" | "expert";

export type TranslationLang = "en" | "es" | "fr" | "de" | "zh" | "ja";

export type ConstructType =
  | "import"
  | "function-decl"
  | "arrow-function"
  | "class-decl"
  | "if"
  | "elif"
  | "else"
  | "for-loop"
  | "while-loop"
  | "do-while"
  | "try"
  | "catch"
  | "finally"
  | "switch"
  | "case"
  | "return"
  | "variable-decl"
  | "assignment"
  | "function-call"
  | "print"
  | "comment"
  | "decorator"
  | "async"
  | "await"
  | "break"
  | "continue"
  | "throw"
  | "block-end"
  | "blank"
  | "other";

export interface ConstructHit {
  type: ConstructType;
  line: number;       // 1-indexed
  column?: number;    // 1-indexed
  text: string;
  detail?: string;    // optional extra info (e.g. function name)
}

export interface LineExplanation {
  line: number;
  text: string;
  construct: ConstructType;
  explanation: string;
  blockId?: number;   // optional grouping (function/if/loop body)
}

export interface BlockInfo {
  id: number;
  startLine: number;
  endLine: number;
  kind: "function" | "class" | "if" | "loop" | "try" | "switch";
  name?: string;
  summary: string;
}

export interface ComplexityHint {
  cyclomatic: number;
  bigO: string;
  loops: number;
  nestedLoops: number;
  recursion: boolean;
  sortCall: boolean;
  explanation: string;
}

export interface LibRef {
  name: string;
  kind: "import" | "require" | "include" | "using";
  line: number;
}

export interface SecuritySmell {
  rule: string;
  line: number;
  severity: "info" | "warning" | "error";
  message: string;
}

export interface DataFlowNote {
  variable: string;
  declaredAt: number;
  usedAt: number[];
}

export interface ExplanationResult {
  language: Language;
  depth: Depth;
  overallSummary: string;
  lines: LineExplanation[];
  blocks: BlockInfo[];
  complexity: ComplexityHint;
  libraries: LibRef[];
  securitySmells: SecuritySmell[];
  dataFlow: DataFlowNote[];
  translatedTo?: TranslationLang;
  warnings: string[];
}

export interface HistoryEntry {
  ts: number;
  language: Language;
  depth: Depth;
  snippet: string;
  lineCount: number;
  constructCount: number;
}

export interface ShareState {
  language?: Language;
  depth?: Depth;
  code?: string;
  translate?: TranslationLang;
}

export interface LlmExplanation {
  overallSummary: string;
  lineNotes: { line: number; note: string }[];
  overallNotes: string[];
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-code-explainer:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-code-explainer:llm-key";

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

export const DEPTH_LABELS: Record<Depth, string> = {
  eli5: "ELI5 (Explain Like I'm 5)",
  beginner: "Beginner",
  intermediate: "Intermediate",
  expert: "Expert",
};

export const DEPTH_ORDER: Depth[] = ["eli5", "beginner", "intermediate", "expert"];

export const TRANSLATION_LABELS: Record<TranslationLang, string> = {
  en: "English (no translation)",
  es: "Spanish",
  fr: "French",
  de: "German",
  zh: "Chinese (Simplified)",
  ja: "Japanese",
};

export const ALL_TRANSLATIONS: TranslationLang[] = ["en", "es", "fr", "de", "zh", "ja"];

export const CONSTRUCT_LABELS: Record<ConstructType, string> = {
  "import": "Import / Include",
  "function-decl": "Function declaration",
  "arrow-function": "Arrow function",
  "class-decl": "Class declaration",
  "if": "If statement",
  "elif": "Else-if branch",
  "else": "Else branch",
  "for-loop": "For loop",
  "while-loop": "While loop",
  "do-while": "Do-while loop",
  "try": "Try block",
  "catch": "Catch block",
  "finally": "Finally block",
  "switch": "Switch statement",
  "case": "Switch case",
  "return": "Return statement",
  "variable-decl": "Variable declaration",
  "assignment": "Assignment",
  "function-call": "Function call",
  "print": "Print / log",
  "comment": "Comment",
  "decorator": "Decorator",
  "async": "Async declaration",
  "await": "Await expression",
  "break": "Break",
  "continue": "Continue",
  "throw": "Throw",
  "block-end": "Block end",
  "blank": "Blank line",
  "other": "Other",
};

export const SAMPLE_SNIPPETS: Record<Language, string> = {
  python: [
    "def factorial(n):",
    "    if n <= 1:",
    "        return 1",
    "    return n * factorial(n - 1)",
    "",
    "import math",
    "",
    "numbers = [1, 2, 3, 4, 5]",
    "for num in numbers:",
    "    print(factorial(num))",
  ].join("\n"),
  javascript: [
    "function fetchUser(id) {",
    "  return fetch(`/api/users/${id}`)",
    "    .then((res) => res.json())",
    "    .then((user) => {",
    "      console.log(user.name);",
    "      return user;",
    "    });",
    "}",
    "",
    "const ids = [1, 2, 3];",
    "ids.forEach((id) => fetchUser(id));",
  ].join("\n"),
  typescript: [
    "interface User { id: number; name: string }",
    "",
    "async function getUser(id: number): Promise<User> {",
    "  const res = await fetch(`/api/users/${id}`);",
    "  if (!res.ok) throw new Error('not found');",
    "  return (await res.json()) as User;",
    "}",
    "",
    "const u = await getUser(42);",
    "console.log(u.name);",
  ].join("\n"),
  java: [
    "public class Calculator {",
    "    public int add(int a, int b) {",
    "        return a + b;",
    "    }",
    "",
    "    public int factorial(int n) {",
    "        if (n <= 1) return 1;",
    "        return n * factorial(n - 1);",
    "    }",
    "}",
  ].join("\n"),
  cpp: [
    "#include <iostream>",
    "#include <vector>",
    "",
    "int factorial(int n) {",
    "    if (n <= 1) return 1;",
    "    return n * factorial(n - 1);",
    "}",
    "",
    "int main() {",
    "    std::vector<int> nums = {1, 2, 3};",
    "    for (int n : nums) {",
    "        std::cout << factorial(n) << std::endl;",
    "    }",
    "    return 0;",
    "}",
  ].join("\n"),
  go: [
    "package main",
    "",
    "import \"fmt\"",
    "",
    "func factorial(n int) int {",
    "    if n <= 1 {",
    "        return 1",
    "    }",
    "    return n * factorial(n-1)",
    "}",
    "",
    "func main() {",
    "    nums := []int{1, 2, 3}",
    "    for _, n := range nums {",
    "        fmt.Println(factorial(n))",
    "    }",
    "}",
  ].join("\n"),
};

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
  if (/:[ ]*(string|number|boolean|void)\b|interface\s+\w+/.test(code)) scores.typescript += 2;
  if (/^\s*def\s+\w+/m.test(code)) scores.python += 3;
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

function stripStrings(line: string): string {
  // Replace string literals with empty quotes so identifiers inside strings
  // aren't picked up as identifiers.
  return line.replace(/(['"`])(?:[^\\]|\\.)*?\1/g, '""');
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
  const m = line.match(/^(.*?)(\/\/.*)$/);
  if (m && m[1].trim() !== "") return m[1];
  return line;
}

// ---------- Construct detection ----------

/**
 * Classify a single line into a construct type. The detector is purely
 * syntactic — it does not track multi-line context, so constructs that
 * span multiple lines (e.g. multi-line function signatures) are detected
 * on the line where the keyword appears.
 */
export function classifyLine(line: string, lang: Language): ConstructType {
  const trimmed = line.trim();
  if (!trimmed) return "blank";

  // Comment
  if (isCommentLine(line, lang)) return "comment";

  const stripped = stripStrings(stripTrailingComment(line, lang));

  // Decorator (Python)
  if (lang === "python" && /^\s*@[\w.]+/.test(line)) return "decorator";

  // Imports / includes
  if (lang === "python" && /^\s*(from\s+\S+\s+import|import\s+)\b/.test(stripped)) return "import";
  if ((lang === "javascript" || lang === "typescript") && /^\s*(import\s|export\s+.*\s+from\s|require\s*\()/.test(stripped)) return "import";
  if (lang === "java" && /^\s*import\s+[\w.]+\s*;/.test(stripped)) return "import";
  if (lang === "cpp" && /^\s*#include\s*[<"]/.test(stripped)) return "import";
  if (lang === "go" && /^\s*import\s+("|\()/.test(stripped)) return "import";

  // Class declaration
  if (/^\s*(export\s+)?(abstract\s+)?class\s+\w+/.test(stripped) ||
      /^\s*public\s+class\s+\w+/.test(stripped) ||
      /^\s*class\s+\w+/.test(stripped)) {
    return "class-decl";
  }

  // Function declaration — per-language
  if (lang === "python" && /^\s*(async\s+)?def\s+\w+\s*\(/.test(stripped)) return "function-decl";
  if (lang === "go" && /^\s*func\s+(\w+\s*\()?\w*\s*\(/.test(stripped)) return "function-decl";
  if (lang === "java" && /^\s*(public|private|protected|static|final|\s)*\s*[\w<>\[\]]+\s+\w+\s*\([^)]*\)\s*(\{|throws)/.test(stripped)) return "function-decl";
  if (lang === "cpp" && /^\s*[\w:<>&*]+\s+\w+\s*\([^)]*\)\s*(\{|const)?/.test(stripped) && !/^\s*(if|for|while|switch|return)\b/.test(stripped)) {
    // Only treat as function-decl if it has parens followed by { or end of line
    if (/\([^)]*\)\s*(\{|const)?\s*$/.test(stripped)) return "function-decl";
  }
  if ((lang === "javascript" || lang === "typescript")) {
    if (/^\s*(export\s+)?(async\s+)?function\s*\*?\s*\w*\s*\(/.test(stripped)) return "function-decl";
    if (/^\s*(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s*)?\([^)]*\)\s*=>/.test(stripped)) return "arrow-function";
    if (/^\s*(export\s+)?(const|let|var)\s+\w+\s*=\s*(async\s*)?function\b/.test(stripped)) return "function-decl";
  }

  // Control flow
  if (/^\s*else\s+if\b/.test(stripped)) return "elif";
  if (/^\s*elif\b/.test(stripped)) return "elif";
  if (/^\s*else\b/.test(stripped)) return "else";
  if (/^\s*if\b/.test(stripped)) return "if";
  if (/^\s*for\b/.test(stripped)) return "for-loop";
  if (/^\s*foreach\b/.test(stripped)) return "for-loop";
  if (/^\s*do\b/.test(stripped)) return "do-while";
  if (/^\s*while\b/.test(stripped)) return "while-loop";
  if (/^\s*switch\b/.test(stripped)) return "switch";
  if (/^\s*case\b/.test(stripped)) return "case";
  if (/^\s*default\s*:/.test(stripped)) return "case";

  // Try/catch/finally
  if (/^\s*try\b/.test(stripped)) return "try";
  if (/^\s*(catch|except)\b/.test(stripped)) return "catch";
  if (/^\s*finally\b/.test(stripped)) return "finally";

  // Jump statements
  if (/^\s*return\b/.test(stripped)) return "return";
  if (/^\s*break\b/.test(stripped)) return "break";
  if (/^\s*continue\b/.test(stripped)) return "continue";
  if (/^\s*(throw|raise)\b/.test(stripped)) return "throw";

  // Async / await (top-level)
  if (/^\s*async\b/.test(stripped) && !/function|def|func/.test(stripped)) return "async";
  if (/^\s*await\b/.test(stripped)) return "await";

  // Print / console.log
  if (lang === "python" && /^\s*print\s*\(/.test(stripped)) return "print";
  if ((lang === "javascript" || lang === "typescript") && /\bconsole\.(log|info|warn|error|debug)\s*\(/.test(stripped)) return "print";
  if (lang === "java" && /\bSystem\.out\.print(ln)?\s*\(/.test(stripped)) return "print";
  if (lang === "cpp" && /\b(cout|cerr)\s*<</.test(stripped)) return "print";
  if (lang === "go" && /\bfmt\.Print(ln|f)?\s*\(/.test(stripped)) return "print";

  // Block end (Python uses dedent implicitly — detect closing brace for brace languages)
  if (/^\s*\}\s*$/.test(stripped) || /^\s*\}\s*(else|catch|finally|while)?\s*$/.test(stripped)) return "block-end";

  // Variable declaration
  if ((lang === "javascript" || lang === "typescript") && /^\s*(const|let|var)\s+\w+/.test(stripped)) return "variable-decl";
  if (lang === "python" && /^\s*\w+\s*=\s*/.test(stripped) && !/\s*==\s*/.test(stripped)) return "variable-decl";
  if (lang === "go" && /:=/.test(stripped)) return "variable-decl";
  if (lang === "go" && /^\s*var\s+\w+/.test(stripped)) return "variable-decl";
  if (lang === "java" && /^\s*(final\s+)?(int|long|double|float|String|boolean|char|void|var)\s+\w+\s*=/.test(stripped)) return "variable-decl";
  if (lang === "cpp" && /^\s*(int|long|double|float|std::string|char|bool|auto|const)\s+\w+\s*=/.test(stripped)) return "variable-decl";

  // Plain assignment (no var/let/const keyword)
  if (/^\s*\w+(\.\w+|\[\w+\])*\s*=[^=]/.test(stripped) && !/^\s*(if|while|for)\b/.test(stripped)) return "assignment";

  // Function call (line starts with identifier followed by paren or method call)
  if (/^\s*[\w.]+\s*\(/.test(stripped) || /\.\w+\s*\(/.test(stripped)) return "function-call";

  return "other";
}

/**
 * Extract a name from a function/class declaration line for block tracking.
 */
export function extractName(line: string, type: ConstructType): string | undefined {
  if (type === "function-decl" || type === "arrow-function") {
    const m = line.match(/(?:function\s*\*?\s*|def\s+|func\s+)(\w+)/);
    if (m) return m[1];
    const arrow = line.match(/^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=/);
    if (arrow) return arrow[1];
  }
  if (type === "class-decl") {
    const m = line.match(/class\s+(\w+)/);
    if (m) return m[1];
  }
  return undefined;
}

export function identifyConstructs(code: string, lang: Language): ConstructHit[] {
  const lines = linesOf(code);
  const out: ConstructHit[] = [];
  for (let i = 0; i < lines.length; i++) {
    const type = classifyLine(lines[i], lang);
    const detail = extractName(lines[i], type);
    out.push({
      type,
      line: i + 1,
      text: lines[i],
      detail,
    });
  }
  return out;
}

// ---------- Block grouping ----------

export function groupBlocks(hits: ConstructHit[]): BlockInfo[] {
  const blocks: BlockInfo[] = [];
  let id = 0;
  let stack: { id: number; kind: BlockInfo["kind"]; name?: string; start: number }[] = [];

  const openKinds: Record<ConstructType, BlockInfo["kind"] | undefined> = {
    "function-decl": "function",
    "arrow-function": "function",
    "class-decl": "class",
    "if": "if",
    "elif": "if",
    "else": "if",
    "for-loop": "loop",
    "while-loop": "loop",
    "do-while": "loop",
    "try": "try",
    "switch": "switch",
    "import": undefined,
    "return": undefined,
    "variable-decl": undefined,
    "assignment": undefined,
    "function-call": undefined,
    "print": undefined,
    "comment": undefined,
    "decorator": undefined,
    "async": undefined,
    "await": undefined,
    "break": undefined,
    "continue": undefined,
    "throw": undefined,
    "catch": undefined,
    "finally": undefined,
    "case": undefined,
    "block-end": undefined,
    "blank": undefined,
    "other": undefined,
  };

  for (const hit of hits) {
    const kind = openKinds[hit.type];
    if (kind) {
      id += 1;
      stack.push({ id, kind, name: hit.detail, start: hit.line });
      blocks.push({
        id,
        startLine: hit.line,
        endLine: hit.line,
        kind,
        name: hit.detail,
        summary: `${kind} ${hit.detail ?? ""}`.trim(),
      });
    }
    if (hit.type === "block-end" && stack.length > 0) {
      const top = stack.pop()!;
      const blk = blocks.find((b) => b.id === top.id);
      if (blk) blk.endLine = hit.line;
    }
  }
  // Close any blocks that never got an explicit end (Python-style)
  for (const open of stack) {
    const blk = blocks.find((b) => b.id === open.id);
    if (blk && blk.endLine === blk.startLine) {
      blk.endLine = hits.length > 0 ? hits[hits.length - 1].line : blk.startLine;
    }
  }
  return blocks;
}

// ---------- Per-construct templates ----------

/**
 * Returns a per-construct explanation string at the requested depth.
 * Pure function — deterministic.
 */
export function explainConstruct(
  type: ConstructType,
  depth: Depth,
  detail?: string,
): string {
  const name = detail ?? "this";
  switch (type) {
    case "import":
      return depth === "eli5"
        ? `This line brings in outside tools so ${name} can use them.`
        : depth === "beginner"
          ? `Imports an external module or library so we can use its functions.`
          : depth === "intermediate"
            ? `Imports an external module into the current scope, exposing its public API.`
            : `Pulls in a module's exported bindings into the current lexical scope; resolves at load time.`;
    case "function-decl":
      return depth === "eli5"
        ? `This names a new recipe called ${name} that you can call later.`
        : depth === "beginner"
          ? `Declares a function named ${name} that can be called elsewhere.`
          : depth === "intermediate"
            ? `Declares a function ${name}; parameters and return value define its signature.`
            : `Defines a function ${name}; closure captures outer scope; called via call-site; pushes a new stack frame.`;
    case "arrow-function":
      return depth === "eli5"
        ? `This makes a tiny anonymous recipe (no name) and stores it in ${name}.`
        : depth === "beginner"
          ? `Defines an arrow function stored in ${name}; shorter syntax than 'function'.`
          : depth === "intermediate"
            ? `Arrow function assigned to ${name}; inherits lexical 'this' and cannot be used as a constructor.`
            : `Arrow function bound to ${name}; lexical this/arguments binding; no own 'new.target'; suitable for callbacks.`;
    case "class-decl":
      return depth === "eli5"
        ? `This makes a new kind of thing called ${name} that can have its own data and actions.`
        : depth === "beginner"
          ? `Declares a class ${name} — a blueprint for creating objects with shared methods.`
          : depth === "intermediate"
            ? `Declares a class ${name}; constructor and methods define instances' behavior.`
            : `Declares class ${name}; prototypes chain via extends; methods go on the prototype; constructor initializes instances.`;
    case "if":
      return depth === "eli5"
        ? `If the condition is true, do what's inside.`
        : depth === "beginner"
          ? `Begins a conditional block — the body runs only if the condition is true.`
          : depth === "intermediate"
            ? `Conditional branch; the boolean expression controls whether the body executes.`
            : `Conditional control flow; the test expression is evaluated for truthiness; only true branches execute.`;
    case "elif":
      return depth === "eli5"
        ? `Otherwise, if this other condition is true, do this instead.`
        : depth === "beginner"
          ? `An alternative condition checked only if the previous 'if' was false.`
          : depth === "intermediate"
            ? `Else-if branch; only evaluated when preceding 'if'/'elif' were false.`
            : `Mutually exclusive branch; chained conditional — only the first matching branch runs.`;
    case "else":
      return depth === "eli5"
        ? `If none of the above were true, do this.`
        : depth === "beginner"
          ? `The fallback block — runs when the previous 'if' was false.`
          : depth === "intermediate"
            ? `Default branch of an if/else; no condition — always runs if no prior branch matched.`
            : `Default branch; unconditional fallback when no prior branch evaluated true.`;
    case "for-loop":
      return depth === "eli5"
        ? `Repeat what's inside, once for each item in a list or range.`
        : depth === "beginner"
          ? `A for-loop — repeats the body for each item in a sequence.`
          : depth === "intermediate"
            ? `Iterates a sequence; loop variable binds to each element; body runs once per element.`
            : `Iterates an iterable; per-iteration binding; runtime is O(n) over the sequence length.`;
    case "while-loop":
      return depth === "eli5"
        ? `Keep doing this until the condition becomes false.`
        : depth === "beginner"
          ? `Repeats the body while the condition stays true.`
          : depth === "intermediate"
            ? `Loop that runs as long as the boolean condition evaluates true.`
            : `Pre-test loop; condition checked before each iteration; risk of infinite loop if condition never falsifies.`;
    case "do-while":
      return depth === "eli5"
        ? `Do this once, then keep going while the condition is true.`
        : depth === "beginner"
          ? `Like a while-loop but the body always runs at least once.`
          : depth === "intermediate"
            ? `Post-test loop; body executes once before the condition is evaluated.`
            : `Post-test loop; guarantees one execution; condition checked after the body.`;
    case "try":
      return depth === "eli5"
        ? `Try to do this; if something goes wrong we'll catch it below.`
        : depth === "beginner"
          ? `Starts a try block — code that may throw an error.`
          : depth === "intermediate"
            ? `Opens a protected block; exceptions thrown inside are caught by matching catch handlers.`
            : `Exception barrier; runtime unwinds the stack on throw looking for a matching catch.`;
    case "catch":
      return depth === "eli5"
        ? `If something went wrong above, this is where we handle it.`
        : depth === "beginner"
          ? `Handles errors thrown by the matching try block.`
          : depth === "intermediate"
            ? `Catch handler; receives the exception object and runs recovery code.`
            : `Exception handler; the binding receives the thrown value; control resumes here after unwinding.`;
    case "finally":
      return depth === "eli5"
        ? `No matter what happened above, do this last.`
        : depth === "beginner"
          ? `Runs cleanup code whether or not an error happened.`
          : depth === "intermediate"
            ? `Finally block; always executes after try/catch — used for cleanup.`
            : `Guaranteed-execution block; runs after try and catch regardless of completion path.`;
    case "switch":
      return depth === "eli5"
        ? `Pick one of several options based on a value.`
        : depth === "beginner"
          ? `A switch — compares a value to several cases.`
          : depth === "intermediate"
            ? `Multi-branch dispatch on a single value; falls through without 'break'.`
            : `Discriminated dispatch; jumps to the first matching case label; fall-through is the default.`;
    case "case":
      return depth === "eli5"
        ? `If the value equals this, do this.`
        : depth === "beginner"
          ? `A case label — runs if the switch value matches.`
          : depth === "intermediate"
            ? `Case label; compared against the switch expression; body runs on match.`
            : `Case label; equality-checked against the switch expression; intentional fall-through unless 'break'.`;
    case "return":
      return depth === "eli5"
        ? `Send this value back to whoever called the recipe and stop.`
        : depth === "beginner"
          ? `Returns a value from the function and stops running it.`
          : depth === "intermediate"
            ? `Return statement; the expression is the function's result; control flow exits.`
            : `Return; evaluates the expression and unwinds the current frame; the value is the call-site result.`;
    case "variable-decl":
      return depth === "eli5"
        ? `Make a new box called ${name} and put a value in it.`
        : depth === "beginner"
          ? `Declares a variable and gives it a value.`
          : depth === "intermediate"
            ? `Variable declaration; allocates a binding in the current scope and assigns it.`
            : `Declaration; binding lives in the enclosing lexical scope; type inferred or annotated.`;
    case "assignment":
      return depth === "eli5"
        ? `Put a new value in an existing box.`
        : depth === "beginner"
          ? `Updates an existing variable's value.`
          : depth === "intermediate"
            ? `Assignment; replaces the current value of an existing binding.`
            : `Assignment to an existing binding or property; right-hand side evaluated first.`;
    case "function-call":
      return depth === "eli5"
        ? `Run a recipe (and maybe use its result).`
        : depth === "beginner"
          ? `Calls a function — the function's code runs and may return a value.`
          : depth === "intermediate"
            ? `Function call; pushes a new frame; arguments bind to parameters; result returned.`
            : `Call-site; new stack frame; args evaluated left-to-right; result returned to caller.`;
    case "print":
      return depth === "eli5"
        ? `Show something on the screen so you can see it.`
        : depth === "beginner"
          ? `Prints a value to the console (output).`
          : depth === "intermediate"
            ? `Console output; useful for debugging — usually removed before production.`
            : `Console output; synchronous on most runtimes; remove from production paths.`;
    case "comment":
      return depth === "eli5"
        ? `This is a note for humans — the computer ignores it.`
        : depth === "beginner"
          ? `A comment — explains the code but doesn't run.`
          : depth === "intermediate"
            ? `Comment; ignored by the compiler/interpreter; documents intent.`
            : `Comment; not executed; useful for context that the code cannot express.`;
    case "decorator":
      return depth === "eli5"
        ? `This wraps the thing below it to add extra behavior.`
        : depth === "beginner"
          ? `A decorator — modifies the function or class below.`
          : depth === "intermediate"
            ? `Decorator; wraps the following declaration to augment its behavior.`
            : `Decorator; syntactic sugar for higher-order function application at definition time.`;
    case "async":
      return depth === "eli5"
        ? `Marks a recipe that takes time (like downloading) without freezing everything.`
        : depth === "beginner"
          ? `Marks a function as async — it can use 'await' and returns a Promise.`
          : depth === "intermediate"
            ? `Async marker; the function returns a Promise; enables 'await' inside.`
            : `Async function; always returns a Promise; body runs on the microtask queue.`;
    case "await":
      return depth === "eli5"
        ? `Wait here until the slow thing finishes, then keep going.`
        : depth === "beginner"
          ? `Waits for a Promise to resolve and gives you its value.`
          : depth === "intermediate"
            ? `Await; suspends the async function until the Promise settles; resumes with the value.`
            : `Await; yields control to the event loop; resumes via microtask when the Promise settles.`;
    case "break":
      return depth === "eli5"
        ? `Stop the loop right now and exit.`
        : depth === "beginner"
          ? `Exits the nearest loop or switch immediately.`
        : depth === "intermediate"
            ? `Break; jumps out of the enclosing loop or switch.`
            : `Break; transfers control to the statement after the enclosing loop/switch.`;
    case "continue":
      return depth === "eli5"
        ? `Skip the rest of this round and go to the next one.`
        : depth === "beginner"
          ? `Skips to the next iteration of the loop.`
          : depth === "intermediate"
            ? `Continue; jumps to the next iteration of the enclosing loop.`
            : `Continue; re-evaluates the loop condition; skips the remaining body.`;
    case "throw":
      return depth === "eli5"
        ? `Yell "something's wrong!" and stop until someone catches it.`
        : depth === "beginner"
          ? `Throws an error — stops the function and looks for a catch.`
          : depth === "intermediate"
            ? `Throw; raises an exception that propagates until caught.`
            : `Throw; constructs an exception and unwinds the stack searching for a matching handler.`;
    case "block-end":
      return depth === "eli5"
        ? `Closes a section that started above.`
        : depth === "beginner"
          ? `Closing brace — ends a block of code.`
          : depth === "intermediate"
            ? `Closing brace; ends the enclosing block scope.`
            : `Closing brace; pops the current scope; control returns to the enclosing block.`;
    case "blank":
      return depth === "eli5" ? `(empty line)` : `(blank line)`;
    case "other":
      return depth === "eli5"
        ? `A line of code that doesn't match a known pattern.`
        : depth === "beginner"
          ? `A statement not matching any specific pattern.`
          : depth === "intermediate"
            ? `Generic statement; no specific construct matched.`
            : `Generic statement; pattern detector did not classify it.`;
    default:
      return `(unclassified line)`;
  }
}

// ---------- Line / block explanation ----------

export function explainLine(
  line: string,
  lang: Language,
  depth: Depth,
  construct?: ConstructType,
  detail?: string,
): LineExplanation {
  const type = construct ?? classifyLine(line, lang);
  const det = detail ?? extractName(line, type);
  return {
    line: 0, // caller fills in
    text: line,
    construct: type,
    explanation: explainConstruct(type, depth, det),
  };
}

export function explainCode(code: string, lang: Language, depth: Depth): LineExplanation[] {
  const lines = linesOf(code);
  const out: LineExplanation[] = [];
  const hits = identifyConstructs(code, lang);
  for (let i = 0; i < lines.length; i++) {
    const hit = hits[i];
    out.push({
      line: i + 1,
      text: lines[i],
      construct: hit.type,
      explanation: explainConstruct(hit.type, depth, hit.detail),
    });
  }
  return out;
}

// ---------- Overall summary ----------

export function generateOverallSummary(code: string, lang: Language, depth: Depth): string {
  const hits = identifyConstructs(code, lang);
  const counts: Partial<Record<ConstructType, number>> = {};
  for (const h of hits) counts[h.type] = (counts[h.type] ?? 0) + 1;

  const fns = hits.filter((h) => h.type === "function-decl" || h.type === "arrow-function").map((h) => h.detail).filter(Boolean) as string[];
  const classes = hits.filter((h) => h.type === "class-decl").map((h) => h.detail).filter(Boolean) as string[];
  const loops = (counts["for-loop"] ?? 0) + (counts["while-loop"] ?? 0) + (counts["do-while"] ?? 0);
  const conditionals = (counts["if"] ?? 0) + (counts["elif"] ?? 0) + (counts["else"] ?? 0);
  const returns = counts["return"] ?? 0;
  const imports = counts["import"] ?? 0;
  const lineCount = hits.length;
  const nonBlank = hits.filter((h) => h.type !== "blank").length;

  const fnPart = fns.length > 0
    ? `defines ${fns.length} function${fns.length === 1 ? "" : "s"} (${fns.slice(0, 4).join(", ")}${fns.length > 4 ? ", …" : ""})`
    : "defines no named functions";
  const classPart = classes.length > 0 ? `, and ${classes.length} class(es) (${classes.join(", ")})` : "";
  const loopPart = loops > 0 ? ` It contains ${loops} loop(s) and ${conditionals} conditional branch(es).` : "";
  const importPart = imports > 0 ? ` It imports ${imports} module(s).` : "";
  const returnPart = returns > 0 ? ` There ${returns === 1 ? "is 1 return statement" : `are ${returns} return statements`}.` : "";

  if (depth === "eli5") {
    return [
      `This is a ${LANGUAGE_LABELS[lang].toLowerCase()} program with about ${nonBlank} lines of code.`,
      `It ${fnPart}${classPart}.${loopPart}${importPart}`,
      `In simple terms: the program is a list of instructions the computer follows one by one.`,
    ].join(" ");
  }
  if (depth === "beginner") {
    return `This ${LANGUAGE_LABELS[lang]} snippet has ${lineCount} lines (${nonBlank} non-blank). It ${fnPart}${classPart}.${loopPart}${importPart}${returnPart}`;
  }
  if (depth === "intermediate") {
    return `This ${LANGUAGE_LABELS[lang]} code (${nonBlank} statements) ${fnPart}${classPart}.${loopPart}${importPart}${returnPart} Construct mix: ${Object.entries(counts).map(([k, v]) => `${CONSTRUCT_LABELS[k as ConstructType]} ×${v}`).slice(0, 6).join(", ")}.`;
  }
  return `This ${LANGUAGE_LABELS[lang]} unit (${nonBlank} statements across ${lineCount} lines) ${fnPart}${classPart}.${loopPart}${importPart}${returnPart} Construct distribution: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(", ")}. Control-flow cyclomatic complexity is driven by ${conditionals} branch(es) + ${loops} loop(s).`;
}

// ---------- Complexity hint ----------

export function computeComplexityHint(code: string, lang: Language): ComplexityHint {
  const lines = linesOf(code);
  const cleaned = lines.map((l) => stripStrings(stripTrailingComment(l, lang)));
  const codeStr = cleaned.join("\n");

  const forCount = (codeStr.match(/^\s*for\b/gm) ?? []).length;
  const whileCount = (codeStr.match(/^\s*while\b/gm) ?? []).length;
  const doCount = (codeStr.match(/^\s*do\b/gm) ?? []).length;
  const loops = forCount + whileCount + doCount;

  // Nested loop detection: look at consecutive lines, count when an inner for/while appears
  // inside an outer for/while body (heuristic: indentation increases).
  let nestedLoops = 0;
  let prevLoopIndent = -1;
  for (const line of cleaned) {
    const m = line.match(/^(\s*)(for|while|do)\b/);
    if (m) {
      const indent = m[1].length;
      if (prevLoopIndent >= 0 && indent > prevLoopIndent) nestedLoops += 1;
      prevLoopIndent = indent;
    } else if (line.trim() === "") {
      // skip blanks
    } else {
      const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
      if (prevLoopIndent >= 0 && indent <= prevLoopIndent) prevLoopIndent = -1;
    }
  }

  // Recursion detection: a function that calls itself by name
  const fnDefs: { name: string; body: string }[] = [];
  const fnRegex = lang === "python"
    ? /def\s+(\w+)\s*\([^)]*\):\s*\n((?:[ \t]+.*\n?)+)/g
    : lang === "go"
      ? /func\s+(\w+)\s*\([^)]*\)[^{]*\{([^}]*)\}/g
      : /function\s+(\w+)\s*\([^)]*\)\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = fnRegex.exec(codeStr)) !== null) {
    fnDefs.push({ name: m[1], body: m[2] });
  }
  const recursion = fnDefs.some((fn) => {
    const re = new RegExp(`\\b${fn.name}\\s*\\(`);
    return re.test(fn.body);
  });

  const sortCall = /\b(sort|sorted|\.sort\(|qsort|std::sort|\.OrderBy|\.SortBy)\b/.test(codeStr);

  const cyclomatic = 1 + (codeStr.match(/\b(if|elif|else if|case|while|for|catch|except|&&|\|\|)\b/g) ?? []).length;

  let bigO = "O(1)";
  if (recursion && loops > 0) bigO = "O(n log n) to O(n²) — recursion with loops";
  else if (recursion) bigO = "O(2^n) or O(n!) — exponential recursion (review base case)";
  else if (nestedLoops > 0) bigO = "O(n²) — nested loops";
  else if (sortCall) bigO = "O(n log n) — sort call";
  else if (loops > 0) bigO = "O(n) — single loop";
  else if (cyclomatic > 5) bigO = "O(1) — bounded branching";

  const explanation = `Detected ${loops} loop(s), ${nestedLoops} nested loop(s), ${recursion ? "recursion" : "no recursion"}, ${sortCall ? "a sort call" : "no sort call"}. Estimated upper bound: ${bigO}. Cyclomatic complexity: ${cyclomatic}.`;

  return { cyclomatic, bigO, loops, nestedLoops, recursion, sortCall, explanation };
}

// ---------- Library / API identification ----------

export function identifyLibsAndApis(code: string, lang: Language): LibRef[] {
  const lines = linesOf(code);
  const out: LibRef[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Python: import X / from X import Y
    if (lang === "python") {
      const m1 = line.match(/^\s*import\s+([\w.]+)/);
      if (m1) { out.push({ name: m1[1], kind: "import", line: i + 1 }); continue; }
      const m2 = line.match(/^\s*from\s+([\w.]+)\s+import/);
      if (m2) { out.push({ name: m2[1], kind: "import", line: i + 1 }); continue; }
    }
    // JS/TS: import X from 'Y' / import 'Y' / require('Y')
    if (lang === "javascript" || lang === "typescript") {
      const m1 = line.match(/^\s*import\s+[^'"]*?from\s+['"]([^'"]+)['"]/);
      if (m1) { out.push({ name: m1[1], kind: "import", line: i + 1 }); continue; }
      const m2 = line.match(/^\s*import\s+['"]([^'"]+)['"]/);
      if (m2) { out.push({ name: m2[1], kind: "import", line: i + 1 }); continue; }
      const m3 = line.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
      if (m3) { out.push({ name: m3[1], kind: "require", line: i + 1 }); continue; }
    }
    // Java: import x.y.Z;
    if (lang === "java") {
      const m1 = line.match(/^\s*import\s+(static\s+)?([\w.]+)\s*;/);
      if (m1) { out.push({ name: m1[2], kind: "import", line: i + 1 }); continue; }
    }
    // C++: #include <X> or #include "X"
    if (lang === "cpp") {
      const m1 = line.match(/^\s*#include\s*[<"]([^>"]+)[>"]/);
      if (m1) { out.push({ name: m1[1], kind: "include", line: i + 1 }); continue; }
    }
    // Go: import "X" / import ( ... "X" ... )
    if (lang === "go") {
      const m1 = line.match(/^\s*import\s+["`]([^"`]+)["`]/);
      if (m1) { out.push({ name: m1[1], kind: "import", line: i + 1 }); continue; }
      const m2 = line.match(/^\s*["`]([^"`]+)["`]\s*$/);
      if (m2 && i > 0 && /^\s*import\s*\(/.test(lines[i - 1])) {
        out.push({ name: m2[1], kind: "import", line: i + 1 });
        continue;
      }
    }
  }
  return out;
}

// ---------- Security smells ----------

const SECURITY_PATTERNS: { rule: string; re: RegExp; severity: SecuritySmell["severity"]; message: string }[] = [
  { rule: "eval-usage", re: /\beval\s*\(/, severity: "error", message: "`eval()` executes arbitrary strings as code — major injection risk." },
  { rule: "exec-usage", re: /\bexec\s*\(/, severity: "error", message: "`exec()` runs arbitrary code — high injection risk." },
  { rule: "inner-html", re: /\.innerHTML\s*=/, severity: "warning", message: "Assigning to `.innerHTML` can introduce XSS if the value comes from user input." },
  { rule: "document-write", re: /\bdocument\.write\s*\(/, severity: "warning", message: "`document.write` is XSS-prone and blocks rendering — avoid." },
  { rule: "dangerously-set-inner-html", re: /dangerouslySetInnerHTML/, severity: "warning", message: "`dangerouslySetInnerHTML` bypasses React's XSS protection — sanitize first." },
  { rule: "sql-string-concat", re: /["'`]SELECT\s.+\$\{|["'`]\s*\+\s*\w+\s*\+\s*["'`]SELECT/i, severity: "error", message: "SQL string concatenation — use parameterized queries to avoid SQL injection." },
  { rule: "shell-exec-user-input", re: /\bexec\s*\(\s*`|os\.system\s*\(/, severity: "error", message: "Shell execution with possible user input — command injection risk." },
  { rule: "hardcoded-credential", re: /(password|passwd|secret|api_key|apikey|access_token|auth_token|private_key)\s*[:=]\s*['"][^'"]+['"]/i, severity: "warning", message: "Possible hardcoded credential — move to an environment variable." },
  { rule: "weak-crypto-md5", re: /\b(md5|MD5)\s*\(/, severity: "warning", message: "MD5 is cryptographically broken — use SHA-256 or stronger." },
  { rule: "weak-crypto-sha1", re: /\b(sha1|SHA1)\s*\(/, severity: "info", message: "SHA-1 is deprecated for security — use SHA-256+." },
  { rule: "insecure-random", re: /\bMath\.random\s*\(/, severity: "info", message: "`Math.random` is not cryptographically secure — use `crypto.getRandomValues` for tokens." },
  { rule: "bare-except", re: /^\s*except\s*:/m, severity: "info", message: "Bare `except:` swallows all errors including KeyboardInterrupt — catch specific exceptions." },
];

export function findSecuritySmells(code: string, _lang: Language): SecuritySmell[] {
  const lines = linesOf(code);
  const out: SecuritySmell[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const p of SECURITY_PATTERNS) {
      if (p.re.test(line)) {
        out.push({ rule: p.rule, line: i + 1, severity: p.severity, message: p.message });
      }
    }
  }
  return out;
}

// ---------- Data flow ----------

export function computeDataFlow(code: string, lang: Language): DataFlowNote[] {
  const lines = linesOf(code);
  const decls = new Map<string, number>();
  const uses = new Map<string, number[]>();

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (isCommentLine(raw, lang)) continue;
    const stripped = stripStrings(stripTrailingComment(raw, lang));
    const lineNo = i + 1;

    // Detect declaration
    let declName: string | null = null;
    if (lang === "python") {
      const m = stripped.match(/^\s*(\w+)\s*=[^=]/);
      if (m && !/^\s*(if|while|for|elif|else|return|class|def)\b/.test(stripped)) declName = m[1];
    } else if (lang === "javascript" || lang === "typescript") {
      const m = stripped.match(/^\s*(?:const|let|var)\s+(\w+)/);
      if (m) declName = m[1];
    } else if (lang === "go") {
      const m1 = stripped.match(/^\s*(\w+)\s*:=/);
      const m2 = stripped.match(/^\s*var\s+(\w+)/);
      declName = m1?.[1] ?? m2?.[1] ?? null;
    } else if (lang === "java") {
      const m = stripped.match(/^\s*(?:final\s+)?(?:int|long|double|float|String|boolean|char|var)\s+(\w+)\s*=/);
      if (m) declName = m[1];
    } else if (lang === "cpp") {
      const m = stripped.match(/^\s*(?:int|long|double|float|std::string|char|bool|auto|const)\s+(\w+)\s*=/);
      if (m) declName = m[1];
    }

    if (declName) {
      if (!decls.has(declName)) decls.set(declName, lineNo);
    }

    // Detect uses of declared variables
    for (const [name, _declLine] of decls) {
      // Skip the declaration line itself for use-tracking
      if (name === declName) continue;
      const useRe = new RegExp(`\\b${name}\\b`);
      if (useRe.test(stripped)) {
        if (!uses.has(name)) uses.set(name, []);
        const arr = uses.get(name)!;
        if (!arr.includes(lineNo)) arr.push(lineNo);
      }
    }
  }

  const out: DataFlowNote[] = [];
  for (const [name, declaredAt] of decls) {
    out.push({ variable: name, declaredAt, usedAt: uses.get(name) ?? [] });
  }
  return out.slice(0, 50); // cap for display
}

// ---------- Inline comment injection ----------

export function addInlineComments(code: string, lang: Language, depth: Depth): string {
  const lines = linesOf(code);
  const hits = identifyConstructs(code, lang);
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const hit = hits[i];
    const text = lines[i];
    if (hit.type === "blank" || hit.type === "block-end") {
      out.push(text);
      continue;
    }
    const explanation = explainConstruct(hit.type, depth, hit.detail);
    const commentPrefix = (lang === "python" || lang === "go") ? "# " : "// ";
    // Skip if the line is already a comment
    if (hit.type === "comment") {
      out.push(text);
      continue;
    }
    // Don't double up trailing comments
    if (stripTrailingComment(text, lang) !== text) {
      out.push(`${text}  ${commentPrefix}${explanation}`);
    } else {
      out.push(`${text}  ${commentPrefix}${explanation}`);
    }
  }
  return out.join("\n");
}

// ---------- Translation (basic keyword-based) ----------

const TRANSLATIONS: Record<Exclude<TranslationLang, "en">, Record<string, string>> = {
  es: {
    "Imports an external module": "Importa un módulo externo",
    "Declares a function": "Declara una función",
    "Begins a conditional block": "Inicia un bloque condicional",
    "A for-loop": "Un bucle for",
    "Repeats the body": "Repite el cuerpo",
    "Returns a value": "Devuelve un valor",
    "Declares a variable": "Declara una variable",
    "Prints a value": "Imprime un valor",
    "A comment": "Un comentario",
    "Calls a function": "Llama a una función",
  },
  fr: {
    "Imports an external module": "Importe un module externe",
    "Declares a function": "Déclare une fonction",
    "Begins a conditional block": "Commence un bloc conditionnel",
    "A for-loop": "Une boucle for",
    "Repeats the body": "Répète le corps",
    "Returns a value": "Renvoie une valeur",
    "Declares a variable": "Déclare une variable",
    "Prints a value": "Affiche une valeur",
    "A comment": "Un commentaire",
    "Calls a function": "Appelle une fonction",
  },
  de: {
    "Imports an external module": "Importiert ein externes Modul",
    "Declares a function": "Deklariert eine Funktion",
    "Begins a conditional block": "Beginnt einen bedingten Block",
    "A for-loop": "Eine for-Schleife",
    "Repeats the body": "Wiederholt den Körper",
    "Returns a value": "Gibt einen Wert zurück",
    "Declares a variable": "Deklariert eine Variable",
    "Prints a value": "Gibt einen Wert aus",
    "A comment": "Ein Kommentar",
    "Calls a function": "Ruft eine Funktion auf",
  },
  zh: {
    "Imports an external module": "导入外部模块",
    "Declares a function": "声明函数",
    "Begins a conditional block": "开始条件块",
    "A for-loop": "for 循环",
    "Repeats the body": "重复循环体",
    "Returns a value": "返回一个值",
    "Declares a variable": "声明变量",
    "Prints a value": "打印一个值",
    "A comment": "注释",
    "Calls a function": "调用函数",
  },
  ja: {
    "Imports an external module": "外部モジュールをインポートします",
    "Declares a function": "関数を宣言します",
    "Begins a conditional block": "条件ブロックを開始します",
    "A for-loop": "for ループ",
    "Repeats the body": "本体を繰り返します",
    "Returns a value": "値を返します",
    "Declares a variable": "変数を宣言します",
    "Prints a value": "値を出力します",
    "A comment": "コメント",
    "Calls a function": "関数を呼び出します",
  },
};

export function translateExplanation(text: string, target: TranslationLang): string {
  if (target === "en") return text;
  const dict = TRANSLATIONS[target];
  let out = text;
  for (const [en, tr] of Object.entries(dict)) {
    out = out.split(en).join(tr);
  }
  return out;
}

// ---------- Top-level explainer ----------

export function explainCodeFull(
  code: string,
  lang: Language,
  depth: Depth,
  translate: TranslationLang = "en",
): ExplanationResult {
  const lines = linesOf(code);
  const hits = identifyConstructs(code, lang);
  const blocks = groupBlocks(hits);

  const lineExplanations: LineExplanation[] = lines.map((line, i) => {
    const hit = hits[i];
    const blockId = blocks.find((b) => b.startLine === i + 1)?.id;
    let explanation = explainConstruct(hit.type, depth, hit.detail);
    if (translate !== "en") explanation = translateExplanation(explanation, translate);
    return {
      line: i + 1,
      text: line,
      construct: hit.type,
      explanation,
      blockId,
    };
  });

  let overallSummary = generateOverallSummary(code, lang, depth);
  if (translate !== "en") overallSummary = translateExplanation(overallSummary, translate);

  const complexity = computeComplexityHint(code, lang);
  const libraries = identifyLibsAndApis(code, lang);
  const securitySmells = findSecuritySmells(code, lang);
  const dataFlow = computeDataFlow(code, lang);

  const warnings: string[] = [];
  warnings.push("Construct detection reliably identifies WHAT a line IS (function declaration, loop, etc.). Template-based explanations of WHAT a line MEANS are heuristic — review against the actual code.");
  const minified = lines.some((l) => l.length > 300);
  if (minified) warnings.push("Detected very long lines — this may be minified/obfuscated code. Explanations are best-effort.");
  if (libraries.length === 0 && lines.length > 5) warnings.push("No imports detected — the snippet may rely on globals or be incomplete.");
  warnings.push("The optional BYO-key LLM enhancement can refine the prose. Skip it for 100% offline use.");

  return {
    language: lang,
    depth,
    overallSummary,
    lines: lineExplanations,
    blocks,
    complexity,
    libraries,
    securitySmells,
    dataFlow,
    translatedTo: translate !== "en" ? translate : undefined,
    warnings,
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

export function buildShareUrl(language: Language, depth: Depth, code: string, translate: TranslationLang): string {
  const params = new URLSearchParams();
  params.set("lang", language);
  params.set("depth", depth);
  params.set("tr", translate);
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
  const depth = params.get("depth") as Depth | null;
  const tr = params.get("tr") as TranslationLang | null;
  const code = params.get("code") ?? undefined;
  return {
    language: lang && ALL_LANGUAGES.includes(lang) ? lang : undefined,
    depth: depth && DEPTH_ORDER.includes(depth) ? depth : undefined,
    translate: tr && ALL_TRANSLATIONS.includes(tr) ? tr : undefined,
    code,
  };
}

// ---------- Optional LLM enhancement ----------

export function buildLlmPrompt(code: string, lang: Language, depth: Depth): string {
  const lines = [
    `You are an expert ${LANGUAGE_LABELS[lang]} developer explaining code at the ${DEPTH_LABELS[depth]} level.`,
    "Below is a code snippet. Provide an overall summary (2-3 sentences) and per-line notes for any non-trivial line.",
    "Be accurate and concise. If a line is self-explanatory (blank, comment, closing brace), skip it.",
    "",
    "Code:",
    "```" + lang,
    code,
    "```",
    "",
    "Output a JSON object with:",
    '- "overallSummary": string (2-3 sentence summary)',
    '- "lineNotes": array of { "line": number, "note": string }',
    '- "overallNotes": array of strings (3-5 short bullet points about quality, risks, suggestions)',
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
  const overallSummary = typeof o.overallSummary === "string" ? o.overallSummary : "";
  const lineNotesArr = Array.isArray(o.lineNotes) ? o.lineNotes : [];
  const lineNotes = lineNotesArr
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map((x) => ({
      line: typeof x.line === "number" ? x.line : 0,
      note: typeof x.note === "string" ? x.note : "",
    }))
    .filter((x) => x.line > 0);
  const overallNotes = Array.isArray(o.overallNotes)
    ? (o.overallNotes as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  return { ok: true, result: { overallSummary, lineNotes, overallNotes } };
}

// ---------- Honesty ----------

export function honestyNote(): string {
  return "Construct detection reliably identifies WHAT each line IS (function declaration, loop, conditional, etc.). Template-based explanations of WHAT a line MEANS are heuristic — they're a starting point, not ground truth. Big-O hints are best-effort from structural patterns. Security smells are pattern-based and may produce false positives. The optional BYO-key LLM enhancement uses your own API key and goes directly to your chosen provider — skip it for 100% offline use.";
}
