import { describe, it, expect, beforeEach } from "vitest";
import {
  LANGUAGES,
  FRAMEWORKS,
  LANGUAGE_LABELS,
  FRAMEWORK_LABELS,
  FRAMEWORK_LANGUAGES,
  DEFAULT_OPTIONS,
  SAMPLE_SNIPPETS,
  detectLanguage,
  defaultFrameworkForLanguage,
  parseFunctions,
  buildTestSuite,
  renderTestFile,
  generateHappyPath,
  generateEdgeCases,
  generateErrorCases,
  generateParameterizedCases,
  generateSnapshotTest,
  generateMockStubs,
  generateCoverageHints,
  generateSetupTeardown,
  generateImports,
  computeStats,
  explainTest,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Language,
  type Framework,
  type GenerateOptions,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

describe("ai-unit-test-case-generator constants", () => {
  it("has 4 languages", () => {
    expect(LANGUAGES).toHaveLength(4);
    expect(LANGUAGES).toContain("javascript");
    expect(LANGUAGES).toContain("typescript");
    expect(LANGUAGES).toContain("python");
    expect(LANGUAGES).toContain("java");
  });
  it("has 4 frameworks", () => {
    expect(FRAMEWORKS).toHaveLength(4);
    expect(FRAMEWORKS).toContain("jest");
    expect(FRAMEWORKS).toContain("vitest");
    expect(FRAMEWORKS).toContain("pytest");
    expect(FRAMEWORKS).toContain("junit");
  });
  it("has labels for every language and framework", () => {
    for (const l of LANGUAGES) expect(LANGUAGE_LABELS[l]).toBeTruthy();
    for (const f of FRAMEWORKS) expect(FRAMEWORK_LABELS[f]).toBeTruthy();
  });
  it("maps every framework to supported languages", () => {
    for (const f of FRAMEWORKS) {
      expect(FRAMEWORK_LANGUAGES[f].length).toBeGreaterThan(0);
    }
    expect(FRAMEWORK_LANGUAGES.pytest).toEqual(["python"]);
    expect(FRAMEWORK_LANGUAGES.junit).toEqual(["java"]);
  });
  it("has default options with happy/edge/error/parameterized on", () => {
    expect(DEFAULT_OPTIONS.includeHappy).toBe(true);
    expect(DEFAULT_OPTIONS.includeEdge).toBe(true);
    expect(DEFAULT_OPTIONS.includeError).toBe(true);
    expect(DEFAULT_OPTIONS.includeParameterized).toBe(true);
  });
  it("has sample snippets for every language", () => {
    for (const l of LANGUAGES) {
      expect(SAMPLE_SNIPPETS[l].length).toBeGreaterThan(0);
      const hasFunction = SAMPLE_SNIPPETS[l].includes("function");
      const hasDef = SAMPLE_SNIPPETS[l].includes("def");
      const hasClass = SAMPLE_SNIPPETS[l].includes("class");
      expect(hasFunction || hasDef || hasClass).toBe(true);
    }
  });
});

describe("ai-unit-test-case-generator detectLanguage", () => {
  it("detects python", () => {
    expect(detectLanguage("def add(a, b):\n    return a + b\n")).toBe("python");
  });
  it("detects python with imports", () => {
    expect(detectLanguage("import os\nfrom typing import List\n")).toBe("python");
  });
  it("detects java", () => {
    expect(detectLanguage("public class Foo {\n  public static void main(String[] args) { System.out.println(\"hi\"); }\n}\n")).toBe("java");
  });
  it("detects typescript via annotations", () => {
    expect(detectLanguage("function add(a: number, b: number): number { return a + b; }")).toBe("typescript");
  });
  it("defaults to javascript", () => {
    expect(detectLanguage("function add(a, b) { return a + b; }")).toBe("javascript");
  });
});

describe("ai-unit-test-case-generator defaultFrameworkForLanguage", () => {
  it("returns pytest for python", () => {
    expect(defaultFrameworkForLanguage("python")).toBe("pytest");
  });
  it("returns junit for java", () => {
    expect(defaultFrameworkForLanguage("java")).toBe("junit");
  });
  it("returns vitest for typescript", () => {
    expect(defaultFrameworkForLanguage("typescript")).toBe("vitest");
  });
  it("returns jest for javascript", () => {
    expect(defaultFrameworkForLanguage("javascript")).toBe("jest");
  });
});

describe("ai-unit-test-case-generator parseFunctions", () => {
  it("parses python functions", () => {
    const fns = parseFunctions("def add(a, b):\n    return a + b\n\ndef divide(a, b):\n    if b == 0:\n        raise ValueError()\n    return a / b\n", "python");
    expect(fns).toHaveLength(2);
    expect(fns[0].name).toBe("add");
    expect(fns[0].parameters).toHaveLength(2);
    expect(fns[1].throwsError).toBe(true);
  });
  it("parses python function with type annotations and defaults", () => {
    const fns = parseFunctions("def f(a: int = 0, b: str = 'x') -> bool:\n    return True\n", "python");
    expect(fns).toHaveLength(1);
    expect(fns[0].returnType).toBe("bool");
    expect(fns[0].parameters[0].type).toBe("int");
    expect(fns[0].parameters[0].default).toBe("0");
    expect(fns[0].parameters[0].optional).toBe(true);
    expect(fns[0].parameters[1].type).toBe("str");
    expect(fns[0].parameters[1].default).toBe("'x'");
    expect(fns[0].parameters[1].optional).toBe(true);
  });
  it("parses javascript function declarations", () => {
    const fns = parseFunctions("function add(a, b) { return a + b; }\n", "javascript");
    expect(fns).toHaveLength(1);
    expect(fns[0].name).toBe("add");
    expect(fns[0].parameters).toHaveLength(2);
    expect(fns[0].returnsValue).toBe(true);
  });
  it("parses typescript async functions with return types", () => {
    const fns = parseFunctions("export async function fetchUser(id: string): Promise<User> {\n  const res = await fetch('/api');\n  return res.json();\n}\n", "typescript");
    expect(fns).toHaveLength(1);
    expect(fns[0].isAsync).toBe(true);
    expect(fns[0].isExported).toBe(true);
    expect(fns[0].returnType).toBe("Promise<User>");
    expect(fns[0].usesFetch).toBe(true);
    expect(fns[0].parameters[0].type).toBe("string");
  });
  it("parses arrow functions", () => {
    const fns = parseFunctions("const add = (a, b) => a + b;\n", "typescript");
    expect(fns).toHaveLength(1);
    expect(fns[0].isArrow).toBe(true);
    expect(fns[0].name).toBe("add");
  });
  it("parses java methods", () => {
    const fns = parseFunctions("public class MathUtils {\n  public static int add(int a, int b) { return a + b; }\n  public static int divide(int a, int b) throws IllegalArgumentException { if (b == 0) throw new IllegalArgumentException(); return a / b; }\n}\n", "java");
    expect(fns.length).toBeGreaterThanOrEqual(2);
    expect(fns.some((f) => f.name === "add")).toBe(true);
    expect(fns.some((f) => f.name === "divide")).toBe(true);
    expect(fns.find((f) => f.name === "divide")?.throwsError).toBe(true);
  });
  it("returns empty for empty code", () => {
    expect(parseFunctions("", "javascript")).toEqual([]);
  });
  it("detects dependencies via imports", () => {
    const code = "import { foo } from './foo';\nimport bar from 'bar';\nfunction baz() { return bar(); }\n";
    const fns = parseFunctions(code, "typescript");
    expect(fns[0].dependencies).toContain("./foo");
    expect(fns[0].dependencies).toContain("bar");
  });
});

describe("ai-unit-test-case-generator test-case generators", () => {
  const tsCode = "export function clamp(value: number, min: number, max: number): number {\n  if (min > max) throw new Error('min > max');\n  return Math.min(Math.max(value, min), max);\n}\n";
  const fns = parseFunctions(tsCode, "typescript");
  const fn = fns[0];

  it("generates a happy-path test", () => {
    const tc = generateHappyPath(fn, "vitest", "typescript");
    expect(tc.category).toBe("happy");
    expect(tc.name).toContain("clamp");
    expect(tc.code).toContain("result");
  });
  it("generates edge cases per parameter", () => {
    const tcs = generateEdgeCases(fn, "vitest", "typescript");
    expect(tcs.length).toBeGreaterThanOrEqual(3); // 3 numeric params
    expect(tcs.every((t) => t.category === "edge")).toBe(true);
    expect(tcs[0].code).toContain("result");
  });
  it("generates error case when function throws", () => {
    const tcs = generateErrorCases(fn, "vitest", "typescript");
    expect(tcs.some((t) => t.code.includes("toThrow"))).toBe(true);
  });
  it("generates parameterized cases for numeric params", () => {
    const tc = generateParameterizedCases(fn, "vitest", "typescript");
    expect(tc).not.toBeNull();
    expect(tc!.code).toContain("it.each");
  });
  it("returns null parameterized for unknown kinds", () => {
    const fnUnknown = parseFunctions("function f(a, b) { return a + b; }", "javascript")[0];
    const tc = generateParameterizedCases(fnUnknown, "jest", "javascript");
    // 'a' has no type — inferParamKind returns unknown via name heuristics; check it returns null or non-null
    // The name 'a' is unknown so we expect null
    expect(tc).toBeNull();
  });
  it("generates snapshot for React components", () => {
    const reactCode = "export function MyComponent(props: { name: string }): JSX.Element {\n  return <div>{props.name}</div>;\n}\n";
    const reactFn = parseFunctions(reactCode, "typescript")[0];
    const tc = generateSnapshotTest(reactFn, "vitest", "typescript");
    expect(tc).not.toBeNull();
    expect(tc!.code).toContain("toMatchSnapshot");
  });
  it("returns null snapshot for non-React functions", () => {
    const tc = generateSnapshotTest(fn, "vitest", "typescript");
    expect(tc).toBeNull();
  });
  it("generates mock stubs for fetch-using functions", () => {
    const stubs = generateMockStubs(fn, "vitest", "typescript");
    expect(stubs.length).toBe(0); // clamp doesn't use fetch
    const fetchFn = parseFunctions("export async function fetchUser(id: string) {\n  const r = await fetch('/u');\n  return r.json();\n}\n", "typescript")[0];
    const stubs2 = generateMockStubs(fetchFn, "vitest", "typescript");
    expect(stubs2.length).toBeGreaterThan(0);
    expect(stubs2[0]).toContain("fetch");
  });
  it("generates coverage hints", () => {
    const hints = generateCoverageHints(fn);
    expect(hints.length).toBeGreaterThan(0);
    expect(hints.some((h) => h.hint.toLowerCase().includes("number"))).toBe(true);
    expect(hints.some((h) => h.function === "clamp")).toBe(true);
    expect(hints.some((h) => h.severity === "warning")).toBe(true);
  });
});

describe("ai-unit-test-case-generator setup/teardown + imports", () => {
  it("generates jest setup", () => {
    const s = generateSetupTeardown("jest");
    expect(s).toContain("beforeEach");
    expect(s).toContain("afterEach");
  });
  it("generates vitest setup", () => {
    const s = generateSetupTeardown("vitest");
    expect(s).toContain("beforeEach");
  });
  it("generates pytest fixture", () => {
    const s = generateSetupTeardown("pytest");
    expect(s).toContain("@pytest.fixture");
    expect(s).toContain("yield");
  });
  it("generates junit @BeforeEach", () => {
    const s = generateSetupTeardown("junit");
    expect(s).toContain("@BeforeEach");
    expect(s).toContain("@AfterEach");
  });
  it("generates vitest imports", () => {
    const imports = generateImports("vitest", "typescript", []);
    expect(imports.some((s) => s.includes("vitest"))).toBe(true);
  });
  it("generates pytest imports", () => {
    const imports = generateImports("pytest", "python", []);
    expect(imports.some((s) => s.includes("pytest"))).toBe(true);
  });
  it("generates junit imports", () => {
    const imports = generateImports("junit", "java", []);
    expect(imports.some((s) => s.includes("junit.jupiter"))).toBe(true);
  });
});

describe("ai-unit-test-case-generator buildTestSuite + renderTestFile", () => {
  const tsCode = "export function clamp(value: number, min: number, max: number): number {\n  if (min > max) throw new Error('min > max');\n  return Math.min(Math.max(value, min), max);\n}\n";

  it("builds a suite with happy + edge + error + parameterized", () => {
    const suite = buildTestSuite(tsCode, "vitest", "typescript");
    expect(suite.functions).toHaveLength(1);
    expect(suite.testCases.some((t) => t.category === "happy")).toBe(true);
    expect(suite.testCases.some((t) => t.category === "edge")).toBe(true);
    expect(suite.testCases.some((t) => t.category === "error")).toBe(true);
    expect(suite.testCases.some((t) => t.category === "parameterized")).toBe(true);
    expect(suite.coverageHints.length).toBeGreaterThan(0);
  });
  it("warns when no functions detected", () => {
    const suite = buildTestSuite("// just a comment\n", "vitest", "typescript");
    expect(suite.warnings.length).toBeGreaterThan(0);
    expect(suite.functions).toHaveLength(0);
  });
  it("renders a vitest test file with describe blocks", () => {
    const suite = buildTestSuite(tsCode, "vitest", "typescript");
    const out = renderTestFile(suite);
    expect(out).toContain("describe");
    expect(out).toContain("clamp");
    expect(out).toContain("it(");
    expect(out).toContain("vitest");
  });
  it("renders a pytest test file", () => {
    const pyCode = "def add(a, b):\n    return a + b\n\ndef divide(a, b):\n    if b == 0:\n        raise ValueError()\n    return a / b\n";
    const suite = buildTestSuite(pyCode, "pytest", "python");
    const out = renderTestFile(suite);
    expect(out).toContain("def test_add");
    expect(out).toContain("def test_divide");
    expect(out).toContain("assert");
  });
  it("renders a junit test file with @Test annotations", () => {
    const javaCode = "public class MathUtils {\n  public static int add(int a, int b) { return a + b; }\n}\n";
    const suite = buildTestSuite(javaCode, "junit", "java");
    const out = renderTestFile(suite);
    expect(out).toContain("@Test");
    expect(out).toContain("class GeneratedTests");
    expect(out).toContain("assertEquals");
  });
  it("respects options to disable categories", () => {
    const opts: GenerateOptions = {
      includeHappy: true, includeEdge: false, includeError: false,
      includeParameterized: false, includeSnapshot: false,
      includeSetup: false, includeMocks: false,
    };
    const suite = buildTestSuite(tsCode, "vitest", "typescript", opts);
    expect(suite.testCases.every((t) => t.category === "happy")).toBe(true);
    expect(suite.setupTeardown).toBe("");
  });
  it("includes coverage hints in the rendered file", () => {
    const suite = buildTestSuite(tsCode, "vitest", "typescript");
    const out = renderTestFile(suite);
    expect(out).toContain("Coverage hints");
  });
});

describe("ai-unit-test-case-generator computeStats + explainTest", () => {
  it("computes stats by category", () => {
    const suite = buildTestSuite(
      "export function clamp(value: number, min: number, max: number): number {\n  if (min > max) throw new Error('m');\n  return Math.min(Math.max(value, min), max);\n}\n",
      "vitest", "typescript",
    );
    const stats = computeStats(suite.testCases, suite.functions, suite.coverageHints);
    expect(stats.total).toBe(suite.testCases.length);
    expect(stats.functions).toBe(1);
    expect(stats.happy).toBe(1);
    expect(stats.edge).toBeGreaterThanOrEqual(1);
    expect(stats.error).toBeGreaterThanOrEqual(1);
    expect(stats.parameterized).toBe(1);
    expect(stats.coverageHints).toBeGreaterThan(0);
  });
  it("explains a deterministic test", () => {
    const tc = buildTestSuite("function f(n) { return n * 2; }", "jest", "javascript").testCases[0];
    const ex = explainTest(tc);
    expect(ex).toContain(tc.name);
    expect(ex.toLowerCase()).toContain("deterministic");
  });
  it("explains a heuristic test with mock note", () => {
    const suite = buildTestSuite(
      "export async function fetchUser(id: string): Promise<any> {\n  const r = await fetch('/u');\n  return r.json();\n}\n",
      "vitest", "typescript",
    );
    const error = suite.testCases.find((t) => t.category === "error" && t.requiresMock);
    expect(error).toBeDefined();
    const ex = explainTest(error!);
    expect(ex).toContain("mock");
  });
});

describe("ai-unit-test-case-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, language: "typescript", framework: "vitest", functions: 2, testCount: 10, snippet: "function f() {}" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, language: "javascript", framework: "jest", functions: 1, testCount: 1, snippet: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, language: "javascript", framework: "jest", functions: 1, testCount: 1, snippet: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-unit-test-case-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("function add() {}", "vitest", "typescript");
    expect(url).toContain("lang=typescript");
    expect(url).toContain("fw=vitest");
    expect(url).toContain("code=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = buildShareUrl("function f() {}", "jest", "javascript");
    const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : url.replace(/^\?/, "");
    const p = parseShareUrl(hash);
    expect(p.framework).toBe("jest");
    expect(p.language).toBe("javascript");
    expect(p.code).toContain("function f");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ code: "", framework: null, language: null });
  });
  it("filters unknown framework and language", () => {
    const p = parseShareUrl("lang=unknown&fw=unknown&code=x");
    expect(p.framework).toBeNull();
    expect(p.language).toBeNull();
    expect(p.code).toBe("x");
  });
  it("truncates very long code in share URL", () => {
    const long = "x".repeat(10000);
    const url = buildShareUrl(long, "jest", "javascript");
    expect(url.length).toBeLessThan(long.length);
  });
});

// Suppress unused-import lint
export type _Unused = Language | Framework | GenerateOptions;
