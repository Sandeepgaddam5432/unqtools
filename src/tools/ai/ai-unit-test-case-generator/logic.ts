/**
 * AI Unit Test Case Generator — pure logic.
 *
 * Parse pasted source code (JS/TS/Python/Java), extract function signatures,
 * and generate unit test suites for Jest, Vitest, PyTest, or JUnit. Covers
 * happy paths, edge cases, error cases, parameterized cases, mock/stub
 * scaffolding, setup/teardown, and coverage-gap hints — all in pure JS.
 *
 * Pure functions only — no DOM, no network. The optional BYO-key LLM
 * enhancement lives in ui.tsx and goes directly to the user's provider.
 *
 * Honesty: generated tests are starting points, not oracles. Each test
 * is labeled deterministic (signature-driven, reliable) or heuristic
 * (best-effort — review the expected value). Always run the suite and
 * adjust expected values to match real behavior.
 */

// ---------- Types ----------

export type Language = "javascript" | "typescript" | "python" | "java";

export type Framework = "jest" | "vitest" | "pytest" | "junit";

export type TestCaseCategory =
  | "happy"
  | "edge"
  | "error"
  | "parameterized"
  | "snapshot"
  | "setup";

export interface ParsedParameter {
  name: string;
  type?: string;
  default?: string;
  optional: boolean;
  variadic: boolean;
}

export interface ParsedFunction {
  name: string;
  parameters: ParsedParameter[];
  returnType?: string;
  isAsync: boolean;
  isExported: boolean;
  isArrow: boolean;
  isGenerator: boolean;
  body: string;
  throwsError: boolean;
  returnsValue: boolean;
  usesFetch: boolean;
  usesConsole: boolean;
  dependencies: string[];
  startLine: number;
}

export interface TestCase {
  name: string;
  category: TestCaseCategory;
  description: string;
  code: string;
  requiresMock: boolean;
  mockSuggestion?: string;
  deterministic: boolean;
}

export interface CoverageHint {
  function: string;
  hint: string;
  severity: "info" | "warning";
}

export interface GeneratedSuite {
  language: Language;
  framework: Framework;
  functions: ParsedFunction[];
  testCases: TestCase[];
  setupTeardown: string;
  imports: string[];
  coverageHints: CoverageHint[];
  warnings: string[];
  source: string;
}

export interface SuiteStats {
  total: number;
  happy: number;
  edge: number;
  error: number;
  parameterized: number;
  snapshot: number;
  setup: number;
  functions: number;
  requiresMocks: number;
  coverageHints: number;
}

export interface GenerateOptions {
  includeHappy: boolean;
  includeEdge: boolean;
  includeError: boolean;
  includeParameterized: boolean;
  includeSnapshot: boolean;
  includeSetup: boolean;
  includeMocks: boolean;
}

// ---------- Constants ----------

export const LANGUAGES: Language[] = ["javascript", "typescript", "python", "java"];

export const FRAMEWORKS: Framework[] = ["jest", "vitest", "pytest", "junit"];

export const LANGUAGE_LABELS: Record<Language, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  java: "Java",
};

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  jest: "Jest",
  vitest: "Vitest",
  pytest: "PyTest",
  junit: "JUnit 5",
};

/** Maps framework → supported languages. */
export const FRAMEWORK_LANGUAGES: Record<Framework, Language[]> = {
  jest: ["javascript", "typescript"],
  vitest: ["javascript", "typescript"],
  pytest: ["python"],
  junit: ["java"],
};

export const DEFAULT_OPTIONS: GenerateOptions = {
  includeHappy: true,
  includeEdge: true,
  includeError: true,
  includeParameterized: true,
  includeSnapshot: false,
  includeSetup: true,
  includeMocks: true,
};

export const SAMPLE_SNIPPETS: Record<Language, string> = {
  javascript: `function add(a, b) {
  return a + b;
}

function divide(a, b) {
  if (b === 0) throw new Error("divide by zero");
  return a / b;
}

function greet(name) {
  return "Hello, " + name + "!";
}`,
  typescript: `export function clamp(value: number, min: number, max: number): number {
  if (min > max) throw new Error("min > max");
  return Math.min(Math.max(value, min), max);
}

export async function fetchUser(id: string): Promise<User> {
  const res = await fetch("/api/users/" + id);
  if (!res.ok) throw new Error("not found");
  return res.json();
}`,
  python: `def add(a, b):
    return a + b

def divide(a, b):
    if b == 0:
        raise ValueError("divide by zero")
    return a / b

def greet(name):
    return f"Hello, {name}!"`,
  java: `public class MathUtils {
    public static int add(int a, int b) {
        return a + b;
    }

    public static int divide(int a, int b) throws IllegalArgumentException {
        if (b == 0) throw new IllegalArgumentException("divide by zero");
        return a / b;
    }
}`,
};

// ---------- Utilities ----------

function escapeForStringLiteral(s: string, quote: string): string {
  return s.replace(/\\/g, "\\\\").replace(new RegExp(quote, "g"), `\\${quote}`).replace(/\n/g, "\\n");
}

function toTitleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function indentBlock(text: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((l) => (l.length === 0 ? l : pad + l))
    .join("\n");
}

function isNumericType(t?: string): boolean {
  if (!t) return false;
  return /^(number|int|integer|float|double|long|short|byte)$/i.test(t.trim());
}

function isStringType(t?: string): boolean {
  if (!t) return false;
  return /^(string|str)$/i.test(t.trim());
}

function isBooleanType(t?: string): boolean {
  if (!t) return false;
  return /^(boolean|bool)$/i.test(t.trim());
}

function isArrayType(t?: string): boolean {
  if (!t) return false;
  return /^(array|list|\w+\[\]|List<.+>|Array<.+>)$/i.test(t.trim());
}

function isObjectType(t?: string): boolean {
  if (!t) return false;
  return /^(object|dict|Map<.+>|Record<.+>)$/i.test(t.trim());
}

/** Suggests example inputs for a parameter based on its name or type. */
function inferParamKind(name: string, type?: string): "number" | "string" | "boolean" | "array" | "object" | "unknown" {
  if (isNumericType(type)) return "number";
  if (isStringType(type)) return "string";
  if (isBooleanType(type)) return "boolean";
  if (isArrayType(type)) return "array";
  if (isObjectType(type)) return "object";
  const n = name.toLowerCase();
  if (/^(count|num|index|size|len|length|age|total|amount|price|qty|quantity|id)$/i.test(n)) return "number";
  if (/^(name|title|label|email|user|key|token|query|q|text|message|msg|description|desc)$/i.test(n)) return "string";
  if (/^(is|has|can|should|enabled|active|visible|flag)/i.test(n)) return "boolean";
  if (/^(items|list|arr|array|rows|data|entries|values)$/i.test(n)) return "array";
  if (/^(options|config|opts|params|props|context|ctx|payload)$/i.test(n)) return "object";
  return "unknown";
}

function sampleValue(kind: "number" | "string" | "boolean" | "array" | "object" | "unknown", lang: Language, variant: "happy" | "edge" | "error"): string {
  const q = lang === "python" ? "'" : '"';
  const arrOpen = lang === "python" ? "[" : "[";
  const arrClose = lang === "python" ? "]" : "]";
  const objOpen = lang === "python" ? "{" : "{";
  const objClose = lang === "python" ? "}" : "}";
  switch (kind) {
    case "number":
      if (variant === "happy") return lang === "python" ? "5" : "5";
      if (variant === "edge") return "0";
      return lang === "python" ? "-1" : "-1";
    case "string":
      if (variant === "happy") return `${q}hello${q}`;
      if (variant === "edge") return `${q}${q}`;
      return `${q}!@#$%${q}`;
    case "boolean":
      if (variant === "happy") return lang === "python" ? "True" : "true";
      if (variant === "edge") return lang === "python" ? "False" : "false";
      return lang === "python" ? "False" : "false";
    case "array":
      if (variant === "happy") return `${arrOpen}1, 2, 3${arrClose}`;
      if (variant === "edge") return `${arrOpen}${arrClose}`;
      return `${arrOpen}null${lang === "python" ? "" : ", undefined"}${arrClose}`;
    case "object":
      if (variant === "happy") return `${objOpen}${lang === "python" ? '"k": 1' : 'k: 1'}${objClose}`;
      if (variant === "edge") return `${objOpen}${objClose}`;
      return lang === "python" ? "None" : "null";
    default:
      if (variant === "happy") return lang === "python" ? "1" : "1";
      if (variant === "edge") return lang === "python" ? "None" : "null";
      return lang === "python" ? "None" : "undefined";
  }
}

// ---------- Language detection ----------

export function detectLanguage(code: string): Language {
  const c = code || "";
  if (/^\s*from\s+\S+\s+import\s+/m.test(c) || /^\s*def\s+\w+\s*\(/m.test(c) || /^\s*import\s+/m.test(c)) {
    return "python";
  }
  if (/\bpublic\s+(static\s+)?(class|void|int|String|boolean|long|double)\b/.test(c) || /System\.out\.print/.test(c)) {
    return "java";
  }
  if (/: (number|string|boolean|any|void|never|unknown)\b/.test(c) || /\bas\s+\w+\b/.test(c) || /\binterface\s+\w+/m.test(c)) {
    return "typescript";
  }
  return "javascript";
}

/** Auto-pick a framework compatible with the language. */
export function defaultFrameworkForLanguage(lang: Language): Framework {
  switch (lang) {
    case "python": return "pytest";
    case "java": return "junit";
    case "typescript": return "vitest";
    default: return "jest";
  }
}

// ---------- Function parsers ----------

export function parseFunctions(code: string, language: Language): ParsedFunction[] {
  if (!code) return [];
  switch (language) {
    case "python": return parsePythonFunctions(code);
    case "java": return parseJavaFunctions(code);
    default: return parseJsTsFunctions(code);
  }
}

function parsePythonFunctions(code: string): ParsedFunction[] {
  const out: ParsedFunction[] = [];
  const lines = code.split("\n");
  const re = /^(\s*)(async\s+)?def\s+(\w+)\s*\(([^)]*)\)\s*(->\s*[^:]+)?:/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(re);
    if (!m) continue;
    const indent = m[1];
    const isAsync = !!m[2];
    const name = m[3];
    const paramStr = m[4] || "";
    const retMatch = m[5];
    const returnType = retMatch ? retMatch.replace(/^->\s*/, "").trim() : undefined;
    const parameters = parsePythonParams(paramStr);
    const body = collectIndentedBody(lines, i + 1, indent.length);
    const throwsError = /\braise\s+/.test(body);
    const returnsValue = /\breturn\b(?!None\b)/.test(body);
    const usesFetch = /\brequests\.(get|post|put|delete|patch)\b/.test(body) || /\bfetch\(/.test(body);
    const usesConsole = /\bprint\(/.test(body);
    const dependencies = extractPythonImports(code);
    out.push({
      name, parameters, returnType, isAsync,
      isExported: false, isArrow: false,
      isGenerator: /\byield\b/.test(body),
      body, throwsError, returnsValue,
      usesFetch, usesConsole, dependencies,
      startLine: i + 1,
    });
  }
  return out;
}

function parsePythonParams(paramStr: string): ParsedParameter[] {
  if (!paramStr.trim()) return [];
  const params: ParsedParameter[] = [];
  const parts = splitTopLevel(paramStr, ",");
  for (const part of parts) {
    const p = part.trim();
    if (!p || p === "self" || p === "cls") continue;
    if (p.startsWith("*")) {
      params.push({ name: p.replace(/^[*]+/, ""), optional: true, variadic: true });
      continue;
    }
    let name = p;
    let type: string | undefined;
    let def: string | undefined;
    let optional = false;
    if (p.includes(":")) {
      const [n, rest] = splitTopLevel(p, ":", 1);
      name = n.trim();
      const after = (rest || "").trim();
      if (after.includes("=")) {
        const [t, d] = splitTopLevel(after, "=", 1);
        type = t.trim();
        def = (d || "").trim();
        optional = true;
      } else {
        type = after;
      }
    } else if (p.includes("=")) {
      const [n, d] = splitTopLevel(p, "=", 1);
      name = n.trim();
      def = (d || "").trim();
      optional = true;
    }
    if (name) params.push({ name, type, default: def, optional, variadic: false });
  }
  return params;
}

function parseJsTsFunctions(code: string): ParsedFunction[] {
  const out: ParsedFunction[] = [];
  const lines = code.split("\n");
  // Matches: [export] [default] [async] function name(params) [ret]
  const fnRe = /^(\s*)(export\s+)?(default\s+)?(async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(:\s*[^{=]+)?/;
  // Matches: [export] [const|let|var] name = [async] (params) [ret] => {
  const arrowRe = /^(\s*)(export\s+)?(default\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(async\s+)?\(([^)]*)\)\s*(:\s*[^=]+)?=>/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m = line.match(fnRe);
    let isArrow = false;
    if (!m) {
      m = line.match(arrowRe);
      isArrow = true;
    }
    if (!m) continue;
    const indent = m[1];
    const isExported = !!m[2];
    const isAsync = !!m[4];
    const name = isArrow ? m[4] : m[5];
    const paramStr = isArrow ? m[6] : m[6];
    const retIdx = isArrow ? 7 : 7;
    const retRaw = m[retIdx];
    const returnType = retRaw ? retRaw.replace(/^:\s*/, "").trim() : undefined;
    const parameters = parseJsTsParams(paramStr);
    const body = collectBraceBody(lines, i);
    const throwsError = /\bthrow\b/.test(body);
    const returnsValue = /\breturn\s+[^;]+;?/.test(body) || /=>\s*[^{]/.test(line);
    const usesFetch = /\bfetch\s*\(/.test(body);
    const usesConsole = /\bconsole\./.test(body);
    const dependencies = extractJsImports(code);
    out.push({
      name, parameters, returnType, isAsync,
      isExported, isArrow,
      isGenerator: /\byield\b/.test(body),
      body, throwsError, returnsValue,
      usesFetch, usesConsole, dependencies,
      startLine: i + 1,
    });
  }
  return out;
}

function parseJsTsParams(paramStr: string): ParsedParameter[] {
  if (!paramStr.trim()) return [];
  const params: ParsedParameter[] = [];
  const parts = splitTopLevel(paramStr, ",");
  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    if (p.startsWith("...")) {
      params.push({ name: p.slice(3).split(/[:?=]/)[0].trim(), optional: true, variadic: true });
      continue;
    }
    let name = p;
    let type: string | undefined;
    let def: string | undefined;
    let optional = false;
    if (p.includes(":")) {
      const [n, rest] = splitTopLevel(p, ":", 1);
      name = n.replace(/[?]/g, "").trim();
      const after = (rest || "").trim();
      if (after.includes("=")) {
        const [t, d] = splitTopLevel(after, "=", 1);
        type = t.trim();
        def = (d || "").trim();
        optional = true;
      } else {
        type = after;
      }
      if (n.includes("?")) optional = true;
    } else if (p.includes("=")) {
      const [n, d] = splitTopLevel(p, "=", 1);
      name = n.replace(/[?]/g, "").trim();
      def = (d || "").trim();
      optional = true;
    } else {
      name = p.replace(/[?]/g, "").trim();
      if (p.includes("?")) optional = true;
    }
    if (name) params.push({ name, type, default: def, optional, variadic: false });
  }
  return params;
}

function parseJavaFunctions(code: string): ParsedFunction[] {
  const out: ParsedFunction[] = [];
  const lines = code.split("\n");
  // Matches: [modifiers] returnType name(params) [throws ...] {
  const re = /^(\s*)(public|private|protected)?\s*(static\s+)?(final\s+)?(synchronized\s+)?(async\s+)?([\w<>\[\],?\s]+?)\s+(\w+)\s*\(([^)]*)\)\s*(?:throws\s+[\w,.\s]+)?\s*\{/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(re);
    if (!m) continue;
    const indent = m[1];
    const isStatic = !!m[3];
    const returnType = (m[7] || "").trim();
    const name = m[8];
    if (name === "if" || name === "while" || name === "for" || name === "switch" || name === "catch") continue;
    if (returnType === "class" || returnType === "interface" || returnType === "enum") continue;
    const paramStr = m[9] || "";
    const parameters = parseJavaParams(paramStr);
    const body = collectBraceBody(lines, i);
    const throwsError = /\bthrow\b/.test(body) || /throws\s+/.test(lines[i]);
    const returnsValue = /\breturn\s+[^;]+;/.test(body);
    const usesFetch = /\bHttpURLConnection\b|HttpClient|RestTemplate/.test(body);
    const usesConsole = /System\.(out|err)\./.test(body);
    const dependencies = extractJavaImports(code);
    out.push({
      name, parameters,
      returnType: returnType === "void" ? undefined : returnType,
      isAsync: false,
      isExported: /public/.test(lines[i]),
      isArrow: false,
      isGenerator: false,
      body, throwsError, returnsValue,
      usesFetch, usesConsole, dependencies,
      startLine: i + 1,
    });
    void isStatic;
  }
  return out;
}

function parseJavaParams(paramStr: string): ParsedParameter[] {
  if (!paramStr.trim()) return [];
  const params: ParsedParameter[] = [];
  const parts = splitTopLevel(paramStr, ",");
  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    const tokens = p.split(/\s+/);
    if (tokens.length < 2) continue;
    const name = tokens[tokens.length - 1];
    const type = tokens.slice(0, tokens.length - 1).join(" ");
    params.push({ name, type, optional: false, variadic: type.includes("...") });
  }
  return params;
}

// ---------- Helpers for body / import extraction ----------

function collectIndentedBody(lines: string[], startIdx: number, baseIndent: number): string {
  const out: string[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") { out.push(line); continue; }
    const indent = line.length - line.trimStart().length;
    if (indent <= baseIndent && line.trim().length > 0) break;
    out.push(line);
  }
  return out.join("\n");
}

function collectBraceBody(lines: string[], startIdx: number): string {
  let depth = 0;
  let started = false;
  const out: string[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    for (const ch of line) {
      if (ch === "{") { depth++; started = true; }
      else if (ch === "}") { depth--; }
    }
    out.push(line);
    if (started && depth <= 0) break;
  }
  return out.join("\n");
}

function splitTopLevel(s: string, sep: string, limit?: number): string[] {
  const out: string[] = [];
  let cur = "";
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(" || ch === "[" || ch === "{" || ch === "<") depth++;
    else if (ch === ")" || ch === "]" || ch === "}" || ch === ">") depth = Math.max(0, depth - 1);
    if (ch === sep && depth === 0) {
      out.push(cur);
      cur = "";
      if (limit && out.length >= limit) {
        out.push(s.slice(i + 1));
        return out;
      }
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function extractPythonImports(code: string): string[] {
  const out: string[] = [];
  const re = /^\s*from\s+(\S+)\s+import\s+/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) out.push(m[1]);
  const re2 = /^\s*import\s+(\S+)/gm;
  while ((m = re2.exec(code))) out.push(m[1]);
  return Array.from(new Set(out));
}

function extractJsImports(code: string): string[] {
  const out: string[] = [];
  const re = /^\s*import\s+(?:[\w*\s{},]+?\s+from\s+)?['"]([^'"]+)['"]/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) out.push(m[1]);
  const re2 = /^\s*const\s+\w+\s*=\s*require\(['"]([^'"]+)['"]\)/gm;
  while ((m = re2.exec(code))) out.push(m[1]);
  return Array.from(new Set(out));
}

function extractJavaImports(code: string): string[] {
  const out: string[] = [];
  const re = /^\s*import\s+([\w.]+);/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) out.push(m[1]);
  return Array.from(new Set(out));
}

// ---------- Test case generators ----------

export function generateHappyPath(fn: ParsedFunction, framework: Framework, language: Language): TestCase {
  const args = fn.parameters.map((p) => sampleValue(inferParamKind(p.name, p.type), language, "happy"));
  const call = buildCall(fn, args, language);
  const expected = inferExpected(fn, "happy");
  const code = renderHappyBody(fn, framework, language, call, expected);
  return {
    name: `${fn.name} returns expected result for typical input`,
    category: "happy",
    description: `Calls ${fn.name} with representative inputs and asserts the expected return value.`,
    code,
    requiresMock: fn.usesFetch,
    mockSuggestion: fn.usesFetch ? `Mock ${fn.dependencies.join(", ") || "the network call"} before calling ${fn.name}.` : undefined,
    deterministic: fn.returnsValue && !fn.usesFetch,
  };
}

export function generateEdgeCases(fn: ParsedFunction, framework: Framework, language: Language): TestCase[] {
  const out: TestCase[] = [];
  if (fn.parameters.length === 0) return out;
  // Per-parameter edge variant
  for (let i = 0; i < fn.parameters.length; i++) {
    const p = fn.parameters[i];
    const kind = inferParamKind(p.name, p.type);
    if (kind === "unknown") continue;
    const args = fn.parameters.map((pp, j) => {
      if (j === i) return sampleValue(kind, language, "edge");
      return sampleValue(inferParamKind(pp.name, pp.type), language, "happy");
    });
    const call = buildCall(fn, args, language);
    const code = renderEdgeBody(fn, framework, language, call, p.name, kind);
    out.push({
      name: `${fn.name} handles edge case for ${p.name} (${kind} = ${describeEdge(kind)})`,
      category: "edge",
      description: `Passes an edge value (${describeEdge(kind)}) for ${p.name} to verify ${fn.name} degrades gracefully.`,
      code,
      requiresMock: fn.usesFetch,
      deterministic: false,
    });
  }
  return out;
}

export function generateErrorCases(fn: ParsedFunction, framework: Framework, language: Language): TestCase[] {
  const out: TestCase[] = [];
  if (!fn.throwsError && fn.parameters.length === 0) return out;
  if (fn.throwsError) {
    const args = fn.parameters.map((p) => sampleValue(inferParamKind(p.name, p.type), language, "error"));
    const call = buildCall(fn, args, language);
    const code = renderErrorBody(fn, framework, language, call);
    out.push({
      name: `${fn.name} throws on invalid input`,
      category: "error",
      description: `Calls ${fn.name} with invalid inputs and asserts that it throws the expected error.`,
      code,
      requiresMock: false,
      deterministic: true,
    });
  }
  if (fn.isAsync) {
    const args = fn.parameters.map((p) => sampleValue(inferParamKind(p.name, p.type), language, "error"));
    const call = buildCall(fn, args, language);
    const code = renderRejectionBody(fn, framework, language, call);
    out.push({
      name: `${fn.name} rejects when the underlying call fails`,
      category: "error",
      description: `Forces the async ${fn.name} to fail and asserts the returned promise rejects.`,
      code,
      requiresMock: true,
      mockSuggestion: `Stub ${fn.dependencies.join(", ") || "the network layer"} to reject before calling ${fn.name}.`,
      deterministic: false,
    });
  }
  return out;
}

export function generateParameterizedCases(fn: ParsedFunction, framework: Framework, language: Language): TestCase | null {
  if (fn.parameters.length === 0) return null;
  const kind = inferParamKind(fn.parameters[0].name, fn.parameters[0].type);
  if (kind === "unknown") return null;
  const samples: Array<{ input: string; label: string }> = [
    { input: sampleValue(kind, language, "happy"), label: "happy" },
    { input: sampleValue(kind, language, "edge"), label: "edge" },
    { input: sampleValue(kind, language, "error"), label: "error" },
  ];
  const code = renderParameterizedBody(fn, framework, language, samples);
  return {
    name: `${fn.name} parameterized across ${samples.length} input variants`,
    category: "parameterized",
    description: `Table-driven test that exercises ${fn.name} with happy/edge/error variants of ${fn.parameters[0].name}.`,
    code,
    requiresMock: fn.usesFetch,
    deterministic: false,
  };
}

export function generateSnapshotTest(fn: ParsedFunction, framework: Framework, language: Language): TestCase | null {
  if (!isReactComponent(fn, language)) return null;
  const code = renderSnapshotBody(fn, framework, language);
  return {
    name: `${fn.name} matches stored snapshot`,
    category: "snapshot",
    description: `Renders the React component ${fn.name} and compares against the stored snapshot.`,
    code,
    requiresMock: false,
    deterministic: true,
  };
}

export function generateMockStubs(fn: ParsedFunction, framework: Framework, language: Language): string[] {
  const out: string[] = [];
  if (!fn.usesFetch && fn.dependencies.length === 0) return out;
  if (fn.usesFetch) {
    out.push(renderFetchMock(framework, language));
  }
  for (const dep of fn.dependencies) {
    if (dep === "fetch" || dep.includes("http")) continue;
    out.push(renderModuleMock(framework, language, dep));
  }
  return out;
}

export function generateCoverageHints(fn: ParsedFunction): CoverageHint[] {
  const hints: CoverageHint[] = [];
  if (fn.parameters.length === 0) {
    hints.push({ function: fn.name, hint: "No parameters — verify side effects via mocks or return-value inspection.", severity: "info" });
  }
  for (const p of fn.parameters) {
    const kind = inferParamKind(p.name, p.type);
    if (kind === "unknown") {
      hints.push({ function: fn.name, hint: `Parameter '${p.name}' has no type annotation — add tests that cover both valid and invalid inputs.`, severity: "warning" });
    }
    if (kind === "number") {
      hints.push({ function: fn.name, hint: `Number parameter '${p.name}' — cover 0, negative, NaN, Infinity, and very large values.`, severity: "info" });
    }
    if (kind === "string") {
      hints.push({ function: fn.name, hint: `String parameter '${p.name}' — cover '', whitespace, unicode, very long, and injection-like inputs.`, severity: "info" });
    }
    if (kind === "array") {
      hints.push({ function: fn.name, hint: `Array parameter '${p.name}' — cover [], single item, large array, and arrays with nulls.`, severity: "info" });
    }
    if (kind === "object") {
      hints.push({ function: fn.name, hint: `Object parameter '${p.name}' — cover {}, null, missing required keys, and extra keys.`, severity: "info" });
    }
    if (p.optional) {
      hints.push({ function: fn.name, hint: `Optional parameter '${p.name}' — verify behavior both when it is omitted and when explicitly passed.`, severity: "info" });
    }
  }
  if (fn.throwsError) {
    hints.push({ function: fn.name, hint: "Function contains throw — add tests asserting each throw path with the expected error message.", severity: "warning" });
  }
  if (fn.isAsync) {
    hints.push({ function: fn.name, hint: "Async function — test both resolved and rejected promise states.", severity: "warning" });
  }
  if (fn.usesFetch) {
    hints.push({ function: fn.name, hint: "Function calls fetch — mock the network; test success, 4xx, 5xx, and network-error paths.", severity: "warning" });
  }
  if (fn.usesConsole) {
    hints.push({ function: fn.name, hint: "Function logs to console — consider asserting log output or silencing it in tests.", severity: "info" });
  }
  if (!fn.returnsValue && !fn.isAsync) {
    hints.push({ function: fn.name, hint: "Function appears to return void — verify its effect on inputs, mocks, or global state.", severity: "info" });
  }
  return hints;
}

export function generateSetupTeardown(framework: Framework): string {
  switch (framework) {
    case "jest":
    case "vitest":
      return [
        "beforeEach(() => {",
        "  // reset mocks and module state",
        "  jest.clearAllMocks?.();",
        "});",
        "",
        "afterEach(() => {",
        "  // cleanup any global state mutated by the SUT",
        "});",
      ].join("\n");
    case "pytest":
      return [
        "import pytest",
        "",
        "@pytest.fixture(autouse=True)",
        "def _reset_state():",
        "    # runs before each test",
        "    yield",
        "    # cleanup after each test",
      ].join("\n");
    case "junit":
      return [
        "import org.junit.jupiter.api.BeforeEach;",
        "import org.junit.jupiter.api.AfterEach;",
        "",
        "    @BeforeEach",
        "    void setUp() {",
        "        // initialize fixtures",
        "    }",
        "",
        "    @AfterEach",
        "    void tearDown() {",
        "        // cleanup fixtures",
        "    }",
      ].join("\n");
  }
}

export function generateImports(framework: Framework, language: Language, functions: ParsedFunction[]): string[] {
  const imports: string[] = [];
  switch (framework) {
    case "jest":
      imports.push("// jest globals: describe, it, expect, beforeEach, afterEach, jest");
      break;
    case "vitest":
      imports.push('import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";');
      break;
    case "pytest":
      imports.push("import pytest");
      break;
    case "junit":
      imports.push("import org.junit.jupiter.api.Test;");
      imports.push("import org.junit.jupiter.api.BeforeEach;");
      imports.push("import org.junit.jupiter.api.AfterEach;");
      imports.push("import static org.junit.jupiter.api.Assertions.*;");
      break;
  }
  // Reference the SUT
  if (language === "python") {
    if (functions.length > 0) imports.push("from module_under_test import *");
  } else if (language === "java") {
    if (functions.length > 0) imports.push("import static org.example.ModuleUnderTest.*;");
  } else {
    if (functions.length > 0) imports.push('import * as sut from "./module-under-test";');
  }
  return imports;
}

// ---------- Renderers ----------

function buildCall(fn: ParsedFunction, args: string[], language: Language): string {
  if (language === "java") {
    return `${fn.name}(${args.join(", ")})`;
  }
  if (language === "python") {
    return `${fn.name}(${args.join(", ")})`;
  }
  return `sut.${fn.name}(${args.join(", ")})`;
}

function inferExpected(fn: ParsedFunction, variant: "happy" | "edge" | "error"): string {
  if (fn.returnType) {
    if (isNumericType(fn.returnType)) return variant === "happy" ? "0" : "0";
    if (isStringType(fn.returnType)) return variant === "happy" ? '"expected"' : '""';
    if (isBooleanType(fn.returnType)) return "true";
    if (isArrayType(fn.returnType)) return "[]";
    if (isObjectType(fn.returnType)) return "{}";
  }
  if (/sum|add|total|count|len|length|size/i.test(fn.name)) return "0";
  if (/is|has|can|should/i.test(fn.name)) return "true";
  return "undefined";
}

function describeEdge(kind: "number" | "string" | "boolean" | "array" | "object" | "unknown"): string {
  switch (kind) {
    case "number": return "0";
    case "string": return "empty";
    case "boolean": return "false";
    case "array": return "[]";
    case "object": return "{}";
    default: return "null/undefined";
  }
}

function renderHappyBody(fn: ParsedFunction, framework: Framework, language: Language, call: string, expected: string): string {
  const expectCall = renderExpectEqual(framework, `${fn.isAsync ? "await " : ""}result`, expected);
  if (fn.isAsync) {
    if (framework === "pytest") {
      return [
        `result = ${call}`,
        `assert result == ${expected}`,
      ].join("\n");
    }
    if (framework === "junit") {
      return [
        `var result = ${call};`,
        `assertEquals(${expected}, result);`,
      ].join("\n");
    }
    return [
      `const result = await ${call};`,
      expectCall,
    ].join("\n");
  }
  if (framework === "pytest") {
    return [
      `result = ${call}`,
      `assert result == ${expected}`,
    ].join("\n");
  }
  if (framework === "junit") {
    return [
      `var result = ${call};`,
      `assertEquals(${expected}, result);`,
    ].join("\n");
  }
  return [
    `const result = ${call};`,
    expectCall,
  ].join("\n");
}

function renderEdgeBody(fn: ParsedFunction, framework: Framework, language: Language, call: string, paramName: string, kind: string): string {
  const label = describeEdge(kind as "number" | "string" | "boolean" | "array" | "object" | "unknown");
  if (framework === "pytest") {
    return [
      `# edge case: ${paramName} = ${label}`,
      `result = ${call}`,
      `# TODO: assert the documented edge behavior`,
      `assert result is not None or result is None  # placeholder`,
    ].join("\n");
  }
  if (framework === "junit") {
    return [
      `// edge case: ${paramName} = ${label}`,
      `var result = ${call};`,
      `// TODO: assert the documented edge behavior`,
      `assertNotNull(result);  // placeholder`,
    ].join("\n");
  }
  return [
    `// edge case: ${paramName} = ${label}`,
    `const result = ${fn.isAsync ? "await " : ""}${call};`,
    `// TODO: assert the documented edge behavior`,
    `expect(result).toBeDefined();  // placeholder`,
  ].join("\n");
}

function renderErrorBody(fn: ParsedFunction, framework: Framework, language: Language, call: string): string {
  if (framework === "pytest") {
    return [
      `with pytest.raises(Exception):`,
      `    ${call}`,
    ].join("\n");
  }
  if (framework === "junit") {
    return [
      `assertThrows(Exception.class, () -> {`,
      `    ${call};`,
      `});`,
    ].join("\n");
  }
  if (fn.isAsync) {
    return [
      `await expect(${call}).rejects.toThrow();`,
    ].join("\n");
  }
  return [
    `expect(() => ${call}).toThrow();`,
  ].join("\n");
}

function renderRejectionBody(fn: ParsedFunction, framework: Framework, language: Language, call: string): string {
  void language;
  if (framework === "pytest") {
    return [
      `import pytest`,
      `with pytest.raises(Exception):`,
      `    await ${call}`,
    ].join("\n");
  }
  if (framework === "junit") {
    return [
      `assertThrows(Exception.class, () -> {`,
      `    ${call};`,
      `});`,
    ].join("\n");
  }
  return [
    `await expect(${call}).rejects.toThrow();`,
  ].join("\n");
}

function renderParameterizedBody(fn: ParsedFunction, framework: Framework, language: Language, samples: Array<{ input: string; label: string }>): string {
  const paramName = fn.parameters[0].name;
  if (framework === "pytest") {
    const rows = samples.map((s) => `    (${s.input}, "${s.label}"),`).join("\n");
    return [
      `@pytest.mark.parametrize("${paramName},label", [`,
      rows,
      `])`,
      `def test_${fn.name}_param(${paramName}, label):`,
      `    result = ${fn.name}(${paramName})`,
      `    # TODO: assert per-label expected value`,
      `    assert result is not None or result is None  # placeholder`,
    ].join("\n");
  }
  if (framework === "junit") {
    const rows = samples.map((s) => `            Arguments.of(${s.input}, "${s.label}"),`).join("\n");
    return [
      `    @ParameterizedTest`,
      `    @MethodSource("provide_${fn.name}_cases")`,
      `    void test_${fn.name}_param(${fn.parameters[0].type || "Object"} ${paramName}, String label) {`,
      `        var result = ${fn.name}(${paramName});`,
      `        // TODO: assert per-label expected value`,
      `        assertNotNull(result);  // placeholder`,
      `    }`,
      ``,
      `    private static Stream<Arguments> provide_${fn.name}_cases() {`,
      `        return Stream.of(`,
      rows,
      `        );`,
      `    }`,
    ].join("\n");
  }
  const eachMacro = framework === "vitest" ? "it.each" : "it.each";
  const rows = samples.map((s) => `  { ${paramName}: ${s.input}, label: "${s.label}" },`).join("\n");
  return [
    `${eachMacro}([`,
    rows,
    `])("returns a defined value for $label", async ({ ${paramName} }) => {`,
    `  const result = ${fn.isAsync ? "await " : ""}sut.${fn.name}(${paramName});`,
    `  // TODO: assert per-label expected value`,
    `  expect(result).toBeDefined();  // placeholder`,
    `});`,
  ].join("\n");
}

function renderSnapshotBody(fn: ParsedFunction, framework: Framework, language: Language): string {
  void language;
  const render = framework === "pytest" ? "" : "import { render } from '@testing-library/react';";
  void render;
  if (framework === "junit") {
    return [
      `// Snapshot testing in JUnit typically uses a third-party library.`,
      `// Verify the rendered output of ${fn.name} matches a stored fixture.`,
    ].join("\n");
  }
  if (framework === "pytest") {
    return [
      `# Snapshot testing in pytest: use pytest-snapshot or syrupy.`,
      `# Verify the rendered output of ${fn.name} matches a stored fixture.`,
    ].join("\n");
  }
  return [
    `import { render } from "@testing-library/react";`,
    `it("matches snapshot", () => {`,
    `  const { container } = render(<${fn.name} />);`,
    `  expect(container).toMatchSnapshot();`,
    `});`,
  ].join("\n");
}

function renderFetchMock(framework: Framework, language: Language): string {
  void language;
  if (framework === "pytest") {
    return [
      `from unittest.mock import patch, MagicMock`,
      ``,
      `mock_response = MagicMock()`,
      `mock_response.status_code = 200`,
      `mock_response.json.return_value = {}`,
      ``,
      `with patch("requests.get", return_value=mock_response):`,
      `    ...`,
    ].join("\n");
  }
  if (framework === "junit") {
    return [
      `// Mock the HTTP client (e.g., MockWebServer or Mockito stubbing).`,
      `HttpClient mockClient = mock(HttpClient.class);`,
    ].join("\n");
  }
  return [
    `global.fetch = vi.fn(() => Promise.resolve({`,
    `  ok: true,`,
    `  json: () => Promise.resolve({}),`,
    `})) as unknown as typeof fetch;`,
  ].join("\n");
}

function renderModuleMock(framework: Framework, language: Language, dep: string): string {
  if (framework === "pytest") {
    return [
      `from unittest.mock import patch`,
      `patch("${dep}").start()`,
    ].join("\n");
  }
  if (framework === "junit") {
    return `// Mock ${dep} with Mockito: when(mock.${dep}).thenReturn(...)`;
  }
  void language;
  return `vi.mock("${dep}", () => ({ /* stubs */ }));`;
}

function renderExpectEqual(framework: Framework, lhs: string, rhs: string): string {
  if (framework === "pytest") return `assert ${lhs} == ${rhs}`;
  if (framework === "junit") return `assertEquals(${rhs}, ${lhs});`;
  return `expect(${lhs}).toBe(${rhs});`;
}

// ---------- Main suite builder ----------

export function buildTestSuite(
  code: string,
  framework: Framework,
  language: Language,
  options: GenerateOptions = DEFAULT_OPTIONS,
): GeneratedSuite {
  const warnings: string[] = [];
  const functions = parseFunctions(code, language);
  if (functions.length === 0) {
    warnings.push(`No functions detected in the pasted ${LANGUAGE_LABELS[language]} code. Test suite will be empty.`);
  }
  const testCases: TestCase[] = [];
  const coverageHints: CoverageHint[] = [];
  for (const fn of functions) {
    if (options.includeHappy) testCases.push(generateHappyPath(fn, framework, language));
    if (options.includeEdge) testCases.push(...generateEdgeCases(fn, framework, language));
    if (options.includeError) testCases.push(...generateErrorCases(fn, framework, language));
    if (options.includeParameterized) {
      const pc = generateParameterizedCases(fn, framework, language);
      if (pc) testCases.push(pc);
    }
    if (options.includeSnapshot) {
      const sn = generateSnapshotTest(fn, framework, language);
      if (sn) testCases.push(sn);
    }
    coverageHints.push(...generateCoverageHints(fn));
  }
  const setupTeardown = options.includeSetup ? generateSetupTeardown(framework) : "";
  const imports = generateImports(framework, language, functions);
  return {
    language, framework, functions, testCases,
    setupTeardown, imports, coverageHints, warnings, source: code,
  };
}

export function renderTestFile(suite: GeneratedSuite): string {
  const { framework, language, functions, testCases, setupTeardown, imports, coverageHints, warnings } = suite;
  const lines: string[] = [];
  // File header
  lines.push(`/**`);
  lines.push(` * Generated unit test suite — ${FRAMEWORK_LABELS[framework]} / ${LANGUAGE_LABELS[language]}.`);
  lines.push(` * Produced by UnQTools AI Unit Test Case Generator. Review expected values.`);
  lines.push(` */`);
  lines.push("");
  for (const imp of imports) lines.push(imp);
  lines.push("");
  if (warnings.length > 0) {
    lines.push("// Warnings:");
    for (const w of warnings) lines.push(`//  - ${w}`);
    lines.push("");
  }
  if (language === "java") {
    // JUnit wraps tests in a class
    lines.push("class GeneratedTests {");
    if (setupTeardown) {
      lines.push(indentBlock(setupTeardown, 4));
      lines.push("");
    }
    for (const fn of functions) {
      lines.push(`    @Test`);
      lines.push(`    void test_${fn.name}_happy() throws Exception {`);
      const happy = testCases.find((t) => t.category === "happy" && t.name.startsWith(fn.name));
      if (happy) lines.push(indentBlock(happy.code, 8));
      lines.push(`    }`);
      lines.push("");
      const edgeCases = testCases.filter((t) => t.category === "edge" && t.name.startsWith(fn.name));
      for (const tc of edgeCases) {
        lines.push(`    @Test`);
        lines.push(`    void test_${sanitizeForMethod(tc.name)}() {`);
        lines.push(indentBlock(tc.code, 8));
        lines.push(`    }`);
        lines.push("");
      }
      const errCases = testCases.filter((t) => t.category === "error" && t.name.startsWith(fn.name));
      for (const tc of errCases) {
        lines.push(`    @Test`);
        lines.push(`    void test_${sanitizeForMethod(tc.name)}() {`);
        lines.push(indentBlock(tc.code, 8));
        lines.push(`    }`);
        lines.push("");
      }
      const paramCases = testCases.filter((t) => t.category === "parameterized" && t.name.startsWith(fn.name));
      for (const tc of paramCases) {
        lines.push(indentBlock(tc.code, 4));
        lines.push("");
      }
    }
    lines.push("}");
  } else if (framework === "pytest") {
    if (setupTeardown) {
      lines.push(setupTeardown);
      lines.push("");
    }
    for (const fn of functions) {
      lines.push(`def test_${fn.name}_happy():`);
      const happy = testCases.find((t) => t.category === "happy" && t.name.startsWith(fn.name));
      if (happy) lines.push(indentBlock(happy.code, 4));
      lines.push("");
      const others = testCases.filter((t) => t.category !== "happy" && t.name.startsWith(fn.name) && t.category !== "parameterized");
      for (const tc of others) {
        lines.push(`def test_${sanitizeForMethod(tc.name)}():`);
        lines.push(indentBlock(tc.code, 4));
        lines.push("");
      }
      const paramCases = testCases.filter((t) => t.category === "parameterized" && t.name.startsWith(fn.name));
      for (const tc of paramCases) {
        lines.push(tc.code);
        lines.push("");
      }
    }
  } else {
    // jest / vitest
    for (const fn of functions) {
      const fns = testCases.filter((t) => t.name.startsWith(fn.name));
      if (fns.length === 0) continue;
      lines.push(`describe("${fn.name}", () => {`);
      if (setupTeardown) {
        lines.push(indentBlock(setupTeardown, 2));
        lines.push("");
      }
      for (const tc of fns) {
        if (tc.category === "parameterized") {
          lines.push(indentBlock(tc.code, 2));
          lines.push("");
          continue;
        }
        lines.push(`  it("${escapeForStringLiteral(tc.name, "\"")}", ${fn.isAsync ? "async " : ""}() => {`);
        lines.push(indentBlock(tc.code, 4));
        lines.push(`  });`);
        lines.push("");
      }
      lines.push(`});`);
      lines.push("");
    }
  }
  if (coverageHints.length > 0) {
    lines.push("// Coverage hints:");
    for (const h of coverageHints) {
      lines.push(`//  [${h.function}] (${h.severity}) ${h.hint}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function sanitizeForMethod(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
}

// ---------- Stats + explain ----------

export function computeStats(testCases: TestCase[], functions: ParsedFunction[], hints: CoverageHint[]): SuiteStats {
  const stat: SuiteStats = {
    total: testCases.length, happy: 0, edge: 0, error: 0,
    parameterized: 0, snapshot: 0, setup: 0,
    functions: functions.length, requiresMocks: 0,
    coverageHints: hints.length,
  };
  for (const tc of testCases) {
    stat[tc.category] += 1;
    if (tc.requiresMock) stat.requiresMocks += 1;
  }
  return stat;
}

export function explainTest(tc: TestCase): string {
  const base = `${tc.name}. ${tc.description}`;
  const trust = tc.deterministic
    ? "Classified deterministic — the assertion is signature-driven and reliable."
    : "Classified heuristic — review the expected value before relying on it.";
  const mock = tc.requiresMock && tc.mockSuggestion
    ? ` Requires a mock: ${tc.mockSuggestion}`
    : "";
  return `${base} ${trust}${mock}`;
}

// ---------- History (localStorage) ----------

const HISTORY_KEY = "unqtools:ai-unit-test-case-generator:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  language: Language;
  framework: Framework;
  functions: number;
  testCount: number;
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

// ---------- Shareable URL ----------

export function buildShareUrl(code: string, framework: Framework, language: Language): string {
  const params = new URLSearchParams();
  if (code) {
    // Hash-encode large payloads (URLSearchParams caps at ~2KB safe)
    params.set("lang", language);
    params.set("fw", framework);
    params.set("code", code.slice(0, 4000));
  }
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): {
  code: string;
  framework: Framework | null;
  language: Language | null;
} {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { code: "", framework: null, language: null };
  const params = new URLSearchParams(clean);
  const code = params.get("code") ?? "";
  const fwRaw = params.get("fw");
  const langRaw = params.get("lang");
  const framework = fwRaw && FRAMEWORKS.includes(fwRaw as Framework) ? (fwRaw as Framework) : null;
  const language = langRaw && LANGUAGES.includes(langRaw as Language) ? (langRaw as Language) : null;
  return { code, framework, language };
}

// Re-export for tests / consumers
export const EXPORTED_FOR_TESTS = {
  escapeForStringLiteral, toTitleCase, indentBlock,
  isNumericType, isStringType, isBooleanType, isArrayType, isObjectType,
  inferParamKind, sampleValue, splitTopLevel,
  parsePythonParams, parseJsTsParams, parseJavaParams,
  collectIndentedBody, collectBraceBody,
  extractPythonImports, extractJsImports, extractJavaImports,
  buildCall, inferExpected, describeEdge, sanitizeForMethod,
  isReactComponent,
};

function isReactComponent(fn: ParsedFunction, language: Language): boolean {
  if (language !== "javascript" && language !== "typescript") return false;
  if (!/^[A-Z]/.test(fn.name)) return false;
  return /JSX\.Element|ReactNode|React\.ReactElement/.test(fn.returnType || "") ||
    /return\s*</.test(fn.body);
}
