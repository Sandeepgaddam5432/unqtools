import { describe, it, expect, beforeEach } from "vitest";
import {
  ALL_LANGUAGES,
  LANGUAGE_LABELS,
  SEVERITY_LABELS,
  RULE_LABELS,
  SAMPLE_SNIPPETS,
  HISTORY_MAX,
  detectLanguage,
  findBracketMismatches,
  findMissingSemicolons,
  findVarUsage,
  findConsoleLogLeftovers,
  findEqEqVsEqEqEq,
  findAssignInCondition,
  findTodoFixme,
  findEmptyCatchBlocks,
  findMagicNumbers,
  findInfiniteLoops,
  findUnreachableCode,
  findMissingBreakInSwitch,
  findHardcodedCredentials,
  findDivisionByZero,
  findMutableDefaultArgs,
  findBareExcept,
  findUndefinedVariables,
  findMissingReturns,
  findOffByOneLoops,
  computeComplexity,
  findCodeSmells,
  analyzeCode,
  autoFix,
  computeDiff,
  guessRootCause,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  honestyNote,
  type Language,
  type Severity,
  type RuleId,
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

describe("ai-code-debugger constants", () => {
  it("has 6 languages", () => {
    expect(ALL_LANGUAGES).toHaveLength(6);
    expect(ALL_LANGUAGES).toContain("python");
    expect(ALL_LANGUAGES).toContain("go");
  });
  it("has labels for all languages", () => {
    for (const l of ALL_LANGUAGES) expect(LANGUAGE_LABELS[l]).toBeTruthy();
  });
  it("has 4 severities", () => {
    expect(Object.keys(SEVERITY_LABELS)).toHaveLength(4);
  });
  it("has rule labels for all rule ids", () => {
    expect(Object.keys(RULE_LABELS).length).toBeGreaterThanOrEqual(15);
  });
  it("has sample snippets for all languages", () => {
    for (const l of ALL_LANGUAGES) {
      expect(SAMPLE_SNIPPETS[l].length).toBeGreaterThan(0);
    }
  });
});

describe("ai-code-debugger detectLanguage", () => {
  it("detects python", () => {
    expect(detectLanguage("def foo():\n    print('hi')\n")).toBe("python");
  });
  it("detects javascript", () => {
    expect(detectLanguage("function foo() { console.log('hi'); }\n")).toBe("javascript");
  });
  it("detects typescript", () => {
    expect(detectLanguage("function foo(x: number): void { console.log(x); }\n")).toBe("typescript");
  });
  it("detects java", () => {
    expect(detectLanguage("public class Main { public static void main(String[] args) { System.out.println(\"hi\"); } }\n")).toBe("java");
  });
  it("detects cpp", () => {
    expect(detectLanguage("#include <iostream>\nint main() { std::cout << \"hi\"; }\n")).toBe("cpp");
  });
  it("detects go", () => {
    expect(detectLanguage("package main\nimport \"fmt\"\nfunc main() { fmt.Println(\"hi\") }\n")).toBe("go");
  });
  it("defaults to python for empty", () => {
    expect(detectLanguage("")).toBe("python");
  });
});

describe("ai-code-debugger findBracketMismatches", () => {
  it("finds unclosed openers", () => {
    const issues = findBracketMismatches("function foo() {\n  return 1;\n", "javascript");
    expect(issues.some((i) => i.rule === "bracket-mismatch")).toBe(true);
  });
  it("finds mismatched closers", () => {
    const issues = findBracketMismatches("function foo() {\n  return 1;\n]\n", "javascript");
    expect(issues.some((i) => i.rule === "bracket-mismatch")).toBe(true);
  });
  it("passes balanced code", () => {
    const issues = findBracketMismatches("function foo() {\n  return 1;\n}\n", "javascript");
    expect(issues.filter((i) => i.rule === "bracket-mismatch")).toHaveLength(0);
  });
  it("ignores brackets in strings", () => {
    const issues = findBracketMismatches('const s = "(\\n";\n', "javascript");
    expect(issues.filter((i) => i.rule === "bracket-mismatch")).toHaveLength(0);
  });
});

describe("ai-code-debugger findMissingSemicolons", () => {
  it("flags missing semicolon in JS", () => {
    const issues = findMissingSemicolons("const x = 5\n", "javascript");
    expect(issues.some((i) => i.rule === "missing-semicolon")).toBe(true);
  });
  it("does not flag if/for lines", () => {
    const issues = findMissingSemicolons("if (x) {\n  y();\n}\n", "javascript");
    expect(issues.filter((i) => i.rule === "missing-semicolon")).toHaveLength(0);
  });
  it("returns empty for python", () => {
    expect(findMissingSemicolons("x = 5\n", "python")).toEqual([]);
  });
});

describe("ai-code-debugger findVarUsage", () => {
  it("flags var in JS", () => {
    const issues = findVarUsage("var x = 5;\n", "javascript");
    expect(issues.some((i) => i.rule === "var-usage")).toBe(true);
  });
  it("does not flag let", () => {
    const issues = findVarUsage("let x = 5;\n", "javascript");
    expect(issues.filter((i) => i.rule === "var-usage")).toHaveLength(0);
  });
  it("returns empty for python", () => {
    expect(findVarUsage("x = 5\n", "python")).toEqual([]);
  });
});

describe("ai-code-debugger findConsoleLogLeftovers", () => {
  it("flags console.log in JS", () => {
    const issues = findConsoleLogLeftovers("console.log('debug');\n", "javascript");
    expect(issues.some((i) => i.rule === "console-log-leftover")).toBe(true);
  });
  it("does not flag in comments", () => {
    const issues = findConsoleLogLeftovers("// console.log('debug');\n", "javascript");
    expect(issues.filter((i) => i.rule === "console-log-leftover")).toHaveLength(0);
  });
});

describe("ai-code-debugger findEqEqVsEqEqEq", () => {
  it("flags == in JS", () => {
    const issues = findEqEqVsEqEqEq("if (x == 5) {}\n", "javascript");
    expect(issues.some((i) => i.rule === "eqeq-vs-eqeqeq")).toBe(true);
  });
  it("does not flag === in JS", () => {
    const issues = findEqEqVsEqEqEq("if (x === 5) {}\n", "javascript");
    expect(issues.filter((i) => i.rule === "eqeq-vs-eqeqeq")).toHaveLength(0);
  });
  it("returns empty for python", () => {
    expect(findEqEqVsEqEqEq("if x == 5:\n  pass\n", "python")).toEqual([]);
  });
});

describe("ai-code-debugger findAssignInCondition", () => {
  it("flags = in if condition", () => {
    const issues = findAssignInCondition("if (x = 5) {}\n", "javascript");
    expect(issues.some((i) => i.rule === "assign-in-condition")).toBe(true);
  });
  it("does not flag ==", () => {
    const issues = findAssignInCondition("if (x == 5) {}\n", "javascript");
    expect(issues.filter((i) => i.rule === "assign-in-condition")).toHaveLength(0);
  });
});

describe("ai-code-debugger findTodoFixme", () => {
  it("finds TODO", () => {
    const issues = findTodoFixme("// TODO: fix this\n", "javascript");
    expect(issues.some((i) => i.rule === "todo-fixme")).toBe(true);
  });
  it("finds FIXME", () => {
    const issues = findTodoFixme("# FIXME later\n", "python");
    expect(issues.some((i) => i.rule === "todo-fixme")).toBe(true);
  });
});

describe("ai-code-debugger findEmptyCatchBlocks", () => {
  it("finds empty python except pass", () => {
    const issues = findEmptyCatchBlocks("try:\n  do()\nexcept:\n  pass\n", "python");
    expect(issues.some((i) => i.rule === "empty-catch")).toBe(true);
  });
  it("finds empty JS catch {}", () => {
    const issues = findEmptyCatchBlocks("try {\n  do();\n} catch (e) {\n}\n", "javascript");
    expect(issues.some((i) => i.rule === "empty-catch")).toBe(true);
  });
  it("does not flag non-empty catch", () => {
    const issues = findEmptyCatchBlocks("try {\n  do();\n} catch (e) {\n  log(e);\n}\n", "javascript");
    expect(issues.filter((i) => i.rule === "empty-catch")).toHaveLength(0);
  });
});

describe("ai-code-debugger findMagicNumbers", () => {
  it("flags large non-round numbers", () => {
    const issues = findMagicNumbers("const x = 12345;\n", "javascript");
    expect(issues.some((i) => i.rule === "magic-number")).toBe(true);
  });
  it("does not flag small numbers", () => {
    const issues = findMagicNumbers("const x = 5;\n", "javascript");
    expect(issues.filter((i) => i.rule === "magic-number")).toHaveLength(0);
  });
  it("does not flag round numbers", () => {
    const issues = findMagicNumbers("const x = 1000;\n", "javascript");
    expect(issues.filter((i) => i.rule === "magic-number")).toHaveLength(0);
  });
});

describe("ai-code-debugger findInfiniteLoops", () => {
  it("flags while True without break (python)", () => {
    const issues = findInfiniteLoops("while True:\n  do_something()\n", "python");
    expect(issues.some((i) => i.rule === "infinite-loop")).toBe(true);
  });
  it("does not flag while True with break", () => {
    const issues = findInfiniteLoops("while True:\n  if x:\n    break\n", "python");
    expect(issues.filter((i) => i.rule === "infinite-loop")).toHaveLength(0);
  });
  it("flags while (true) without break (JS)", () => {
    const issues = findInfiniteLoops("while (true) {\n  doSomething();\n}\n", "javascript");
    expect(issues.some((i) => i.rule === "infinite-loop")).toBe(true);
  });
  it("flags Go for {} without break", () => {
    const issues = findInfiniteLoops("for {\n  doSomething()\n}\n", "go");
    expect(issues.some((i) => i.rule === "infinite-loop")).toBe(true);
  });
});

describe("ai-code-debugger findUnreachableCode", () => {
  it("flags code after return", () => {
    const issues = findUnreachableCode("function f() {\n  return 1;\n  console.log('unreachable');\n}\n", "javascript");
    expect(issues.some((i) => i.rule === "unreachable-code")).toBe(true);
  });
  it("does not flag else after return", () => {
    const issues = findUnreachableCode("function f() {\n  if (x) {\n    return 1;\n  } else {\n    return 2;\n  }\n}\n", "javascript");
    expect(issues.filter((i) => i.rule === "unreachable-code")).toHaveLength(0);
  });
});

describe("ai-code-debugger findMissingBreakInSwitch", () => {
  it("flags missing break in JS switch", () => {
    const code = "switch (x) {\n  case 1:\n    doOne();\n  case 2:\n    doTwo();\n    break;\n}\n";
    const issues = findMissingBreakInSwitch(code, "javascript");
    expect(issues.some((i) => i.rule === "missing-break-switch")).toBe(true);
  });
  it("does not flag switch with all breaks", () => {
    const code = "switch (x) {\n  case 1:\n    doOne();\n    break;\n  case 2:\n    doTwo();\n    break;\n}\n";
    const issues = findMissingBreakInSwitch(code, "javascript");
    expect(issues.filter((i) => i.rule === "missing-break-switch")).toHaveLength(0);
  });
});

describe("ai-code-debugger findHardcodedCredentials", () => {
  it("flags password = ...", () => {
    const issues = findHardcodedCredentials("password = 'admin123'\n", "python");
    expect(issues.some((i) => i.rule === "hardcoded-credential" && i.severity === "critical")).toBe(true);
  });
  it("flags api_key = ...", () => {
    const issues = findHardcodedCredentials('const api_key = "sk-abc";\n', "javascript");
    expect(issues.some((i) => i.rule === "hardcoded-credential")).toBe(true);
  });
  it("does not flag empty password", () => {
    const issues = findHardcodedCredentials("password = ''\n", "python");
    expect(issues.filter((i) => i.rule === "hardcoded-credential")).toHaveLength(0);
  });
});

describe("ai-code-debugger findDivisionByZero", () => {
  it("flags / 0", () => {
    const issues = findDivisionByZero("const x = 10 / 0;\n", "javascript");
    expect(issues.some((i) => i.rule === "division-by-zero" && i.severity === "critical")).toBe(true);
  });
  it("does not flag / 5", () => {
    const issues = findDivisionByZero("const x = 10 / 5;\n", "javascript");
    expect(issues.filter((i) => i.rule === "division-by-zero")).toHaveLength(0);
  });
});

describe("ai-code-debugger findMutableDefaultArgs", () => {
  it("flags def f(x=[])", () => {
    const issues = findMutableDefaultArgs("def f(x=[]):\n  pass\n", "python");
    expect(issues.some((i) => i.rule === "mutable-default-arg")).toBe(true);
  });
  it("flags def f(x={})", () => {
    const issues = findMutableDefaultArgs("def f(x={}):\n  pass\n", "python");
    expect(issues.some((i) => i.rule === "mutable-default-arg")).toBe(true);
  });
  it("does not flag def f(x=None)", () => {
    const issues = findMutableDefaultArgs("def f(x=None):\n  pass\n", "python");
    expect(issues.filter((i) => i.rule === "mutable-default-arg")).toHaveLength(0);
  });
  it("returns empty for JS", () => {
    expect(findMutableDefaultArgs("function f(x=[]) {}\n", "javascript")).toEqual([]);
  });
});

describe("ai-code-debugger findBareExcept", () => {
  it("flags bare except", () => {
    const issues = findBareExcept("try:\n  do()\nexcept:\n  pass\n", "python");
    expect(issues.some((i) => i.rule === "bare-except")).toBe(true);
  });
  it("does not flag typed except", () => {
    const issues = findBareExcept("try:\n  do()\nexcept Exception:\n  pass\n", "python");
    expect(issues.filter((i) => i.rule === "bare-except")).toHaveLength(0);
  });
});

describe("ai-code-debugger findUndefinedVariables", () => {
  it("flags clearly undefined variable", () => {
    const issues = findUndefinedVariables("print(undefined_thing)\n", "python");
    expect(issues.some((i) => i.rule === "undefined-variable")).toBe(true);
  });
  it("does not flag defined variable", () => {
    const issues = findUndefinedVariables("x = 5\nprint(x)\n", "python");
    expect(issues.filter((i) => i.rule === "undefined-variable")).toHaveLength(0);
  });
  it("does not flag builtins like print", () => {
    const issues = findUndefinedVariables("print('hi')\n", "python");
    expect(issues.filter((i) => i.rule === "undefined-variable")).toHaveLength(0);
  });
});

describe("ai-code-debugger findMissingReturns", () => {
  it("flags if-branch returns but no top-level return", () => {
    const code = "function f(x) {\n  if (x) {\n    return 1;\n  }\n}\n";
    const issues = findMissingReturns(code, "javascript");
    expect(issues.some((i) => i.rule === "missing-return")).toBe(true);
  });
  it("does not flag function with top-level return", () => {
    const code = "function f(x) {\n  if (x) {\n    return 1;\n  }\n  return 0;\n}\n";
    const issues = findMissingReturns(code, "javascript");
    expect(issues.filter((i) => i.rule === "missing-return")).toHaveLength(0);
  });
});

describe("ai-code-debugger findOffByOneLoops", () => {
  it("flags range(N+1) in python", () => {
    const issues = findOffByOneLoops("for i in range(N + 1):\n  pass\n", "python");
    expect(issues.some((i) => i.rule === "off-by-one")).toBe(true);
  });
  it("flags <= in C-style for", () => {
    const issues = findOffByOneLoops("for (let i = 0; i <= 10; i++) {}\n", "javascript");
    expect(issues.some((i) => i.rule === "off-by-one")).toBe(true);
  });
  it("does not flag standard range", () => {
    const issues = findOffByOneLoops("for i in range(N):\n  pass\n", "python");
    expect(issues.filter((i) => i.rule === "off-by-one")).toHaveLength(0);
  });
});

describe("ai-code-debugger computeComplexity", () => {
  it("computes non-zero complexity for branching code", () => {
    const code = "function f(x) {\n  if (x > 0) {\n    return 1;\n  } else if (x < 0) {\n    return -1;\n  }\n  return 0;\n}\n";
    const c = computeComplexity(code, "javascript");
    expect(c.cyclomatic).toBeGreaterThan(1);
    expect(c.functions).toBe(1);
    expect(c.explanation.length).toBeGreaterThan(20);
  });
  it("reports low complexity for trivial code", () => {
    const code = "x = 1\n";
    const c = computeComplexity(code, "python");
    expect(c.cyclomatic).toBeGreaterThanOrEqual(1);
  });
});

describe("ai-code-debugger findCodeSmells", () => {
  it("detects deep nesting", () => {
    const code = "function f() {\n  if (a) {\n    if (b) {\n      if (c) {\n        if (d) {\n          if (e) {\n            return 1;\n          }\n        }\n      }\n    }\n  }\n}\n";
    const smells = findCodeSmells(code, "javascript");
    expect(smells.some((s) => s.type === "deep-nesting")).toBe(true);
  });
});

describe("ai-code-debugger analyzeCode (integration)", () => {
  it("finds multiple issues in sample python snippet", () => {
    const issues = analyzeCode(SAMPLE_SNIPPETS.python, "python");
    expect(issues.stats.total).toBeGreaterThan(3);
    expect(issues.stats.critical).toBeGreaterThan(0);
    expect(issues.complexity.functions).toBeGreaterThan(0);
  });
  it("finds multiple issues in sample JS snippet", () => {
    const issues = analyzeCode(SAMPLE_SNIPPETS.javascript, "javascript");
    expect(issues.stats.total).toBeGreaterThan(3);
  });
  it("returns empty issues list for clean code", () => {
    const code = "function add(a, b) {\n  return a + b;\n}\n";
    const r = analyzeCode(code, "javascript");
    expect(r.stats.critical).toBe(0);
    expect(r.stats.error).toBe(0);
  });
  it("always includes warnings", () => {
    const r = analyzeCode("x = 1\n", "python");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("ai-code-debugger autoFix", () => {
  it("converts var to let in JS", () => {
    const { fixed, fixes } = autoFix("var x = 5;\n", "javascript");
    expect(fixed).toContain("let x = 5");
    expect(fixes.some((f) => f.rule === "var-usage")).toBe(true);
  });
  it("converts == to === in JS", () => {
    const { fixed, fixes } = autoFix("if (x == 5) {}\n", "javascript");
    expect(fixed).toContain("===");
    expect(fixes.some((f) => f.rule === "eqeq-vs-eqeqeq")).toBe(true);
  });
  it("adds missing semicolons", () => {
    const { fixed, fixes } = autoFix("const x = 5\n", "javascript");
    expect(fixed).toContain(";");
    expect(fixes.some((f) => f.rule === "missing-semicolon")).toBe(true);
  });
  it("adds break in switch", () => {
    const code = "switch (x) {\n  case 1:\n    doOne();\n  case 2:\n    doTwo();\n    break;\n}\n";
    const { fixed, fixes } = autoFix(code, "javascript");
    expect(fixes.some((f) => f.rule === "missing-break-switch")).toBe(true);
    expect(fixed.split("\n").filter((l) => l.trim() === "break;").length).toBeGreaterThan(0);
  });
  it("returns no fixes for clean code", () => {
    const { fixes } = autoFix("function f() {\n  return 1;\n}\n", "javascript");
    expect(fixes).toEqual([]);
  });
  it("does not modify python code", () => {
    const original = "x = 5\n";
    const { fixed, fixes } = autoFix(original, "python");
    expect(fixed).toBe(original);
    expect(fixes).toEqual([]);
  });
});

describe("ai-code-debugger computeDiff", () => {
  it("marks identical lines as same", () => {
    const d = computeDiff("a\nb", "a\nb");
    expect(d.every((x) => x.type === "same")).toBe(true);
  });
  it("marks added/removed", () => {
    const d = computeDiff("a\nb", "a\nc");
    expect(d.some((x) => x.type === "removed" && x.before === "b")).toBe(true);
    expect(d.some((x) => x.type === "added" && x.after === "c")).toBe(true);
  });
});

describe("ai-code-debugger guessRootCause", () => {
  it("guesses division by zero", () => {
    const r = guessRootCause("ZeroDivisionError: integer division or modulo by zero", "python");
    expect(r.matched).toBe(true);
    expect(r.rule).toBe("division-by-zero");
  });
  it("guesses index out of range", () => {
    const r = guessRootCause("IndexError: list index out of range", "python");
    expect(r.matched).toBe(true);
    expect(r.rule).toBe("off-by-one");
  });
  it("guesses undefined variable", () => {
    const r = guessRootCause("ReferenceError: x is not defined", "javascript");
    expect(r.matched).toBe(true);
  });
  it("guesses recursion error", () => {
    const r = guessRootCause("RecursionError: maximum recursion depth exceeded", "python");
    expect(r.matched).toBe(true);
    expect(r.rule).toBe("infinite-loop");
  });
  it("returns not matched for unknown error", () => {
    const r = guessRootCause("something completely weird happened", "java");
    expect(r.matched).toBe(false);
  });
});

describe("ai-code-debugger history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, language: "python", snippet: "x", issueCount: 3, criticalCount: 1 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at HISTORY_MAX", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, language: "javascript", snippet: "x", issueCount: 1, criticalCount: 0 });
    }
    expect(loadHistory()).toHaveLength(HISTORY_MAX);
  });
  it("clears", () => {
    saveHistory({ ts: 1, language: "python", snippet: "x", issueCount: 1, criticalCount: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-code-debugger share URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("python", "print('hi')");
    expect(url).toContain("lang=python");
    expect(url).toContain("code=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const s = parseShareUrl("lang=go&code=func+main()");
    expect(s.language).toBe("go");
    expect(s.code).toContain("main");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown languages", () => {
    const s = parseShareUrl("lang=perl&code=x");
    expect(s.language).toBeUndefined();
  });
});

describe("ai-code-debugger LLM", () => {
  it("builds a prompt", () => {
    const p = buildLlmPrompt("def foo(): pass\n", "python", []);
    expect(p).toContain("Python");
    expect(p).toContain("def foo()");
    expect(p).toContain("issues");
  });
  it("parses valid LLM JSON", () => {
    const raw = JSON.stringify({
      issues: [{ rule: "var-usage", explanation: "use let", fix: "var -> let" }],
      overallNotes: ["looks ok"],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.issues).toHaveLength(1);
      expect(r.result.overallNotes).toEqual(["looks ok"]);
    }
  });
  it("strips markdown fences", () => {
    const raw = "```json\n" + JSON.stringify({ issues: [], overallNotes: [] }) + "\n```";
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
  });
  it("rejects malformed JSON", () => {
    const r = renderLlmResult("not json");
    expect(r.ok).toBe(false);
  });
  it("rejects non-object", () => {
    const r = renderLlmResult("[1,2,3]");
    expect(r.ok).toBe(false);
  });
});

describe("ai-code-debugger honesty", () => {
  it("returns a non-empty note", () => {
    expect(honestyNote().length).toBeGreaterThan(20);
  });
});

// Suppress unused-import lint
export type _Unused = Language | Severity | RuleId;
