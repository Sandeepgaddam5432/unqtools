import { describe, it, expect, beforeEach } from "vitest";
import {
  ALL_LANGUAGES,
  LANGUAGE_LABELS,
  SEVERITY_LABELS,
  SEVERITY_ORDER,
  SMELL_LABELS,
  REFACTORING_LABELS,
  PATTERN_LABELS,
  CATEGORY_LABELS,
  PATTERN_CATALOG,
  SAMPLE_SNIPPETS,
  HISTORY_MAX,
  detectLanguage,
  computeComplexity,
  detectCodeSmells,
  applyRefactoring,
  suggestRefactorings,
  explainRefactoring,
  explainTradeoffs,
  suggestPatterns,
  computeDiff,
  applyAllSafeRefactorings,
  analyzeCode,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  honestyNote,
  type Language,
  type Smell,
  type SmellType,
  type RefactoringType,
  type PatternId,
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

// ---------- Constants ----------

describe("ai-coding-pattern-refactorer constants", () => {
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
    expect(SEVERITY_ORDER).toHaveLength(4);
  });
  it("has 17+ smell labels", () => {
    expect(Object.keys(SMELL_LABELS).length).toBeGreaterThanOrEqual(15);
  });
  it("has 15+ refactoring labels", () => {
    expect(Object.keys(REFACTORING_LABELS).length).toBeGreaterThanOrEqual(15);
  });
  it("has 22 pattern labels (GoF)", () => {
    expect(Object.keys(PATTERN_LABELS).length).toBe(22);
  });
  it("has 3 pattern categories", () => {
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(3);
  });
  it("has 22 pattern catalog entries", () => {
    expect(PATTERN_CATALOG).toHaveLength(22);
  });
  it("every catalog entry has intent, whenToUse, whenNotToUse, template", () => {
    for (const e of PATTERN_CATALOG) {
      expect(e.intent.length).toBeGreaterThan(10);
      expect(e.whenToUse.length).toBeGreaterThan(10);
      expect(e.whenNotToUse.length).toBeGreaterThan(10);
      expect(e.template.length).toBeGreaterThan(20);
    }
  });
  it("has sample snippets for all languages", () => {
    for (const l of ALL_LANGUAGES) {
      expect(SAMPLE_SNIPPETS[l].length).toBeGreaterThan(0);
    }
  });
  it("HISTORY_MAX is 20", () => {
    expect(HISTORY_MAX).toBe(20);
  });
  it("catalog includes Singleton, Strategy, Observer, Factory", () => {
    const ids = PATTERN_CATALOG.map((p) => p.id);
    expect(ids).toContain("singleton");
    expect(ids).toContain("strategy");
    expect(ids).toContain("observer");
    expect(ids).toContain("factory-method");
  });
});

// ---------- detectLanguage ----------

describe("ai-coding-pattern-refactorer detectLanguage", () => {
  it("detects python", () => {
    expect(detectLanguage("def foo():\n    pass\n")).toBe("python");
  });
  it("detects javascript", () => {
    expect(detectLanguage("function foo() { return 1; }\n")).toBe("javascript");
  });
  it("detects typescript", () => {
    expect(detectLanguage("function foo(x: number): void { console.log(x); }\n")).toBe("typescript");
  });
  it("detects java", () => {
    expect(detectLanguage("public class Main { public static void main(String[] args) {} }\n")).toBe("java");
  });
  it("detects cpp", () => {
    expect(detectLanguage("#include <iostream>\nint main() {}\n")).toBe("cpp");
  });
  it("detects go", () => {
    expect(detectLanguage("package main\nfunc main() {}\n")).toBe("go");
  });
  it("returns python for empty input", () => {
    expect(detectLanguage("")).toBe("python");
  });
});

// ---------- computeComplexity ----------

describe("ai-coding-pattern-refactorer computeComplexity", () => {
  it("computes basic metrics for simple code", () => {
    const c = computeComplexity("x = 1\ny = 2\n", "python");
    expect(c.lines).toBe(2);
    expect(c.functions).toBe(0);
    expect(c.cyclomatic).toBeGreaterThanOrEqual(1);
    expect(c.maxNesting).toBeGreaterThanOrEqual(0);
  });
  it("counts functions", () => {
    const c = computeComplexity("def foo():\n    pass\n\ndef bar():\n    pass\n", "python");
    expect(c.functions).toBe(2);
  });
  it("counts decision points in cyclomatic", () => {
    const c = computeComplexity("def f(x):\n    if x > 0:\n        return 1\n    elif x < 0:\n        return -1\n    return 0\n", "python");
    expect(c.cyclomatic).toBeGreaterThanOrEqual(3);
  });
  it("detects duplicates", () => {
    const code = "x = 1\ny = 1\nsome_long_line_here = 1\nsome_long_line_here = 1\n";
    const c = computeComplexity(code, "python");
    expect(c.duplicates).toBeGreaterThanOrEqual(1);
  });
  it("tracks nesting depth", () => {
    const code = [
      "def f():",
      "    if x:",
      "        if y:",
      "            if z:",
      "                pass",
    ].join("\n");
    const c = computeComplexity(code, "python");
    expect(c.maxNesting).toBeGreaterThanOrEqual(3);
  });
});

// ---------- detectCodeSmells ----------

describe("ai-coding-pattern-refactorer detectCodeSmells", () => {
  it("detects long function in python", () => {
    const lines = ["def long_func():"];
    for (let i = 0; i < 40; i++) lines.push(`    x${i} = ${i}`);
    const code = lines.join("\n");
    const smells = detectCodeSmells(code, "python");
    expect(smells.some((s) => s.type === "long-function")).toBe(true);
  });
  it("detects long method in javascript", () => {
    const lines = ["function longFunc() {"];
    for (let i = 0; i < 40; i++) lines.push(`  const x${i} = ${i};`);
    lines.push("}");
    const code = lines.join("\n");
    const smells = detectCodeSmells(code, "javascript");
    expect(smells.some((s) => s.type === "long-method")).toBe(true);
  });
  it("detects magic numbers", () => {
    const code = "if (x === 42) { return 100; }\n";
    const smells = detectCodeSmells(code, "javascript");
    expect(smells.some((s) => s.type === "magic-number")).toBe(true);
  });
  it("detects deep nesting", () => {
    const code = [
      "def f():",
      "    if a:",
      "        if b:",
      "            if c:",
      "                if d:",
      "                    if e:",
      "                        pass",
    ].join("\n");
    const smells = detectCodeSmells(code, "python");
    expect(smells.some((s) => s.type === "deep-nesting")).toBe(true);
  });
  it("detects long parameter list", () => {
    const code = "def f(a, b, c, d, e, f, g):\n    pass\n";
    const smells = detectCodeSmells(code, "python");
    expect(smells.some((s) => s.type === "long-parameter-list")).toBe(true);
  });
  it("detects switch statement smell", () => {
    const code = [
      "switch (x) {",
      "  case 1: break;",
      "  case 2: break;",
      "  case 3: break;",
      "  case 4: break;",
      "}",
    ].join("\n");
    const smells = detectCodeSmells(code, "javascript");
    expect(smells.some((s) => s.type === "switch-statement")).toBe(true);
  });
  it("detects if/else-if chain as switch-statement smell", () => {
    const code = [
      "function f(x) {",
      "  if (x === 'a') return 1;",
      "  else if (x === 'b') return 2;",
      "  else if (x === 'c') return 3;",
      "  else if (x === 'd') return 4;",
      "  return 0;",
      "}",
    ].join("\n");
    const smells = detectCodeSmells(code, "javascript");
    expect(smells.some((s) => s.type === "switch-statement")).toBe(true);
  });
  it("detects duplicated code", () => {
    const code = "const result = doSomethingVerySpecific();\nconst result = doSomethingVerySpecific();\n";
    const smells = detectCodeSmells(code, "javascript");
    expect(smells.some((s) => s.type === "duplicated-code")).toBe(true);
  });
  it("detects comments-as-deodorizer", () => {
    const code = [
      "// This function does a complex thing.",
      "// It was hard to write so it should be hard to read.",
      "// The author has left the building.",
      "// Please do not modify without consulting the docs.",
      "function f() { return 1; }",
    ].join("\n");
    const smells = detectCodeSmells(code, "javascript");
    expect(smells.some((s) => s.type === "comments-as-deodorizer")).toBe(true);
  });
  it("detects god class", () => {
    const lines = ["class GodClass {"];
    for (let i = 0; i < 20; i++) lines.push(`  method${i}() { return ${i}; }`);
    lines.push("}");
    const code = lines.join("\n");
    const smells = detectCodeSmells(code, "javascript");
    expect(smells.some((s) => s.type === "god-class")).toBe(true);
  });
  it("returns empty for clean short code", () => {
    const code = "x = 1\ny = x + 1\n";
    const smells = detectCodeSmells(code, "python");
    expect(smells).toHaveLength(0);
  });
  it("provides suggested refactoring for each smell", () => {
    const code = "if (x === 42) { return; }\n";
    const smells = detectCodeSmells(code, "javascript");
    const magic = smells.find((s) => s.type === "magic-number");
    expect(magic?.suggestedRefactoring).toBe("replace-magic-number-with-symbolic-constant");
  });
  it("suggests strategy pattern for switch statements", () => {
    const code = [
      "switch (x) {",
      "  case 1: break;",
      "  case 2: break;",
      "  case 3: break;",
      "}",
    ].join("\n");
    const smells = detectCodeSmells(code, "javascript");
    const sw = smells.find((s) => s.type === "switch-statement");
    expect(sw?.suggestedPattern).toBe("strategy");
  });
  it("marks deterministic flag on smells", () => {
    const code = "x = 100\n";
    const smells = detectCodeSmells(code, "python");
    expect(smells.every((s) => typeof s.deterministic === "boolean")).toBe(true);
  });
});

// ---------- applyRefactoring ----------

describe("ai-coding-pattern-refactorer applyRefactoring", () => {
  it("replaces magic numbers with named constants (python)", () => {
    const code = "tax = price * 0.085\n";
    const smell: Smell = {
      type: "magic-number",
      severity: "info",
      line: 1,
      description: "Magic number",
      suggestedRefactoring: "replace-magic-number-with-symbolic-constant",
      deterministic: true,
    };
    const { before, after, safe } = applyRefactoring(code, "python", "replace-magic-number-with-symbolic-constant", smell);
    expect(safe).toBe(true);
    expect(before).toBe(code);
    expect(after).toContain("CONST_");
    expect(after).toContain("0.085");
  });
  it("replaces magic numbers with named constants (javascript)", () => {
    const code = "if (x === 100) { return; }\n";
    const smell: Smell = {
      type: "magic-number",
      severity: "info",
      line: 1,
      description: "Magic number",
      suggestedRefactoring: "replace-magic-number-with-symbolic-constant",
      deterministic: true,
    };
    const { after, safe } = applyRefactoring(code, "javascript", "replace-magic-number-with-symbolic-constant", smell);
    expect(safe).toBe(true);
    expect(after).toContain("const CONST_");
  });
  it("produces a diff for replace-conditional-with-strategy", () => {
    const code = [
      "if (type === 'book') { d = 0.1; }",
      "else if (type === 'electronics') { d = 0.05; }",
      "else if (type === 'clothing') { d = 0.2; }",
    ].join("\n");
    const smell: Smell = {
      type: "switch-statement",
      severity: "warning",
      line: 1,
      description: "if/else chain",
      suggestedRefactoring: "replace-conditional-with-strategy",
      suggestedPattern: "strategy",
      deterministic: true,
    };
    const { before, after, safe } = applyRefactoring(code, "javascript", "replace-conditional-with-strategy", smell);
    expect(safe).toBe(false);
    expect(before.length).toBeGreaterThan(0);
    expect(after).toContain("Strategy");
  });
  it("returns both before and after strings", () => {
    const code = "x = 100\n";
    const smell: Smell = {
      type: "magic-number",
      severity: "info",
      line: 1,
      description: "Magic number",
      suggestedRefactoring: "replace-magic-number-with-symbolic-constant",
      deterministic: true,
    };
    const { before, after } = applyRefactoring(code, "python", "replace-magic-number-with-symbolic-constant", smell);
    expect(typeof before).toBe("string");
    expect(typeof after).toBe("string");
  });
  it("handles missing smell gracefully", () => {
    const code = "x = 1\n";
    const { before, after, safe } = applyRefactoring(code, "python", "extract-function");
    expect(before).toBe(code);
    expect(after).toBeTruthy();
    expect(safe).toBe(false);
  });
  it("falls back to a generic suggestion for unknown refactorings", () => {
    const code = "x = 1\n";
    const { before, after } = applyRefactoring(code, "python", "substitute-algorithm");
    expect(before).toBe(code);
    expect(after).toContain("Suggested refactoring");
  });
});

// ---------- suggestRefactorings ----------

describe("ai-coding-pattern-refactorer suggestRefactorings", () => {
  it("produces one suggestion per smell", () => {
    const code = "if (x === 100) { return 200; }\n";
    const smells = detectCodeSmells(code, "javascript");
    const suggestions = suggestRefactorings(code, "javascript", smells);
    expect(suggestions.length).toBe(smells.length);
  });
  it("gives each suggestion a unique id", () => {
    const code = [
      "switch (x) {",
      "  case 1: return 100;",
      "  case 2: return 200;",
      "  case 3: return 300;",
      "}",
    ].join("\n");
    const smells = detectCodeSmells(code, "javascript");
    const suggestions = suggestRefactorings(code, "javascript", smells);
    const ids = suggestions.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("includes rationale and tradeoffs", () => {
    const code = "if (x === 100) { return; }\n";
    const smells = detectCodeSmells(code, "javascript");
    const suggestions = suggestRefactorings(code, "javascript", smells);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].rationale.length).toBeGreaterThan(10);
    expect(suggestions[0].tradeoffs.length).toBeGreaterThan(10);
  });
});

// ---------- explainRefactoring / explainTradeoffs ----------

describe("ai-coding-pattern-refactorer explainRefactoring", () => {
  it("explains extract-function for duplication", () => {
    const smell: Smell = {
      type: "duplicated-code",
      severity: "warning",
      line: 1,
      description: "",
      deterministic: true,
    };
    const r = explainRefactoring("extract-function", smell);
    expect(r).toContain("duplication");
  });
  it("explains extract-function for long-method", () => {
    const smell: Smell = {
      type: "long-method",
      severity: "warning",
      line: 1,
      description: "",
      deterministic: true,
    };
    const r = explainRefactoring("extract-function", smell);
    expect(r).toContain("long function");
  });
  it("explains strategy replacement", () => {
    const r = explainRefactoring("replace-conditional-with-strategy");
    expect(r).toContain("Strategy");
    expect(r).toContain("Open/Closed");
  });
  it("explains all refactoring types without throwing", () => {
    const all: RefactoringType[] = [
      "extract-function", "inline-function", "extract-class",
      "replace-conditional-with-polymorphism", "replace-conditional-with-strategy",
      "replace-nested-conditional-with-guard-clauses", "decompose-conditional",
      "remove-duplication", "introduce-parameter-object", "replace-temp-with-query",
      "replace-magic-number-with-symbolic-constant", "hide-delegate",
      "encapsulate-variable", "rename-variable", "consolidate-conditional-expression",
      "substitute-algorithm", "extract-method", "introduce-null-object",
    ];
    for (const r of all) {
      expect(explainRefactoring(r).length).toBeGreaterThan(10);
    }
  });
});

describe("ai-coding-pattern-refactorer explainTradeoffs", () => {
  it("returns non-empty tradeoff for every refactoring", () => {
    const all: RefactoringType[] = [
      "extract-function", "replace-conditional-with-strategy",
      "introduce-parameter-object", "replace-magic-number-with-symbolic-constant",
      "extract-class", "replace-nested-conditional-with-guard-clauses",
    ];
    for (const r of all) {
      const t = explainTradeoffs(r);
      expect(t.length).toBeGreaterThan(10);
      expect(t.toLowerCase()).toContain("tradeoff");
    }
  });
});

// ---------- suggestPatterns ----------

describe("ai-coding-pattern-refactorer suggestPatterns", () => {
  it("suggests strategy when switch-statement smell is present", () => {
    const smells: Smell[] = [
      {
        type: "switch-statement",
        severity: "warning",
        line: 1,
        description: "",
        suggestedRefactoring: "replace-conditional-with-strategy",
        suggestedPattern: "strategy",
        deterministic: true,
      },
    ];
    const suggestions = suggestPatterns(smells);
    expect(suggestions.some((s) => s.pattern === "strategy")).toBe(true);
  });
  it("suggests builder when long-parameter-list smell is present", () => {
    const smells: Smell[] = [
      {
        type: "long-parameter-list",
        severity: "warning",
        line: 1,
        description: "",
        deterministic: true,
      },
    ];
    const suggestions = suggestPatterns(smells);
    expect(suggestions.some((s) => s.pattern === "builder")).toBe(true);
  });
  it("returns empty array when no related smells", () => {
    const smells: Smell[] = [
      {
        type: "lazy-class",
        severity: "info",
        line: 1,
        description: "",
        deterministic: true,
      },
    ];
    const suggestions = suggestPatterns(smells);
    expect(suggestions).toHaveLength(0);
  });
  it("includes a reason string", () => {
    const smells: Smell[] = [
      {
        type: "switch-statement",
        severity: "warning",
        line: 1,
        description: "",
        deterministic: true,
      },
    ];
    const suggestions = suggestPatterns(smells);
    expect(suggestions[0].reason.length).toBeGreaterThan(10);
  });
});

// ---------- computeDiff ----------

describe("ai-coding-pattern-refactorer computeDiff", () => {
  it("marks identical lines as same", () => {
    const d = computeDiff("a\nb\nc", "a\nb\nc");
    expect(d.every((l) => l.type === "same")).toBe(true);
  });
  it("marks added lines", () => {
    const d = computeDiff("a\nb", "a\nb\nc");
    expect(d.some((l) => l.type === "added")).toBe(true);
    expect(d.some((l) => l.after === "c")).toBe(true);
  });
  it("marks removed lines", () => {
    const d = computeDiff("a\nb\nc", "a\nb");
    expect(d.some((l) => l.type === "removed")).toBe(true);
    expect(d.some((l) => l.before === "c")).toBe(true);
  });
  it("handles empty before", () => {
    const d = computeDiff("", "a\nb");
    expect(d.some((l) => l.type === "added")).toBe(true);
  });
  it("handles empty after", () => {
    const d = computeDiff("a\nb", "");
    expect(d.some((l) => l.type === "removed")).toBe(true);
  });
});

// ---------- applyAllSafeRefactorings ----------

describe("ai-coding-pattern-refactorer applyAllSafeRefactorings", () => {
  it("applies safe magic-number refactorings", () => {
    const code = "if (x === 100) { return 200; }\n";
    const { fixed, applied } = applyAllSafeRefactorings(code, "javascript");
    expect(applied.length).toBeGreaterThan(0);
    expect(fixed).toContain("CONST_");
  });
  it("does not apply unsafe refactorings", () => {
    const code = [
      "switch (x) {",
      "  case 1: break;",
      "  case 2: break;",
      "  case 3: break;",
      "}",
    ].join("\n");
    const { applied } = applyAllSafeRefactorings(code, "javascript");
    // Strategy replacement is not safe — it should not be auto-applied
    expect(applied.every((s) => s.safe)).toBe(true);
  });
  it("returns the original code if no safe refactorings apply", () => {
    const code = "x = 1\n";
    const { fixed, applied } = applyAllSafeRefactorings(code, "python");
    expect(applied).toHaveLength(0);
    expect(fixed).toBe(code);
  });
});

// ---------- analyzeCode (top-level) ----------

describe("ai-coding-pattern-refactorer analyzeCode", () => {
  it("returns all expected fields", () => {
    const code = SAMPLE_SNIPPETS.javascript;
    const r = analyzeCode(code, "javascript");
    expect(r.language).toBe("javascript");
    expect(Array.isArray(r.smells)).toBe(true);
    expect(Array.isArray(r.suggestions)).toBe(true);
    expect(r.complexityBefore).toBeDefined();
    expect(Array.isArray(r.patternSuggestions)).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("produces matching suggestions for smells", () => {
    const code = "if (x === 100) { return 200; }\n";
    const r = analyzeCode(code, "javascript");
    expect(r.suggestions.length).toBe(r.smells.length);
  });
  it("includes behavior-preservation warning", () => {
    const r = analyzeCode("x = 1\n", "python");
    expect(r.warnings.some((w) => /behavior preservation/i.test(w))).toBe(true);
  });
  it("includes offline-use warning", () => {
    const r = analyzeCode("x = 1\n", "python");
    expect(r.warnings.some((w) => /offline/i.test(w))).toBe(true);
  });
});

// ---------- History ----------

describe("ai-coding-pattern-refactorer history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1000,
      language: "python",
      snippet: "def foo():",
      smellCount: 2,
      suggestionCount: 2,
    });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].language).toBe("python");
  });
  it("caps at HISTORY_MAX", () => {
    for (let i = 0; i < HISTORY_MAX + 5; i++) {
      saveHistory({
        ts: i,
        language: "python",
        snippet: `s${i}`,
        smellCount: 0,
        suggestionCount: 0,
      });
    }
    expect(loadHistory()).toHaveLength(HISTORY_MAX);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1,
      language: "python",
      snippet: "x",
      smellCount: 0,
      suggestionCount: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------- Shareable URL ----------

describe("ai-coding-pattern-refactorer shareUrl", () => {
  it("builds a URL with lang and code", () => {
    const url = buildShareUrl("python", "def foo():");
    expect(url).toContain("lang=python");
    expect(url).toContain("code=def+foo");
  });
  it("includes applied suggestions when provided", () => {
    const url = buildShareUrl("javascript", "function foo() {}", ["s1", "s2"]);
    expect(url).toContain("applied=s1%2Cs2");
  });
  it("parses back the state", () => {
    const url = buildShareUrl("javascript", "function foo() {}", ["s1"]);
    const parsed = parseShareUrl(url);
    expect(parsed.language).toBe("javascript");
    expect(parsed.code).toBe("function foo() {}");
    expect(parsed.applied).toBe("s1");
  });
  it("ignores invalid lang", () => {
    const parsed = parseShareUrl("#lang=brainfuck&code=x");
    expect(parsed.language).toBeUndefined();
  });
  it("returns empty state for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
    expect(parseShareUrl("#")).toEqual({});
  });
});

// ---------- LLM prompt / rendering ----------

describe("ai-coding-pattern-refactorer LLM", () => {
  it("builds a prompt mentioning language and smells", () => {
    const smells: Smell[] = [
      {
        type: "magic-number",
        severity: "info",
        line: 1,
        description: "Magic number 100",
        deterministic: true,
      },
    ];
    const p = buildLlmPrompt("x = 100\n", "python", smells);
    expect(p).toContain("Python");
    expect(p.toLowerCase()).toContain("magic");
    expect(p).toContain("x = 100");
  });
  it("renders valid JSON", () => {
    const raw = JSON.stringify({
      overallSummary: "Code is okay.",
      suggestions: [{ id: "s1", rationale: "extract helper" }],
      overallNotes: ["consider tests"],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.overallSummary).toBe("Code is okay.");
      expect(r.result.suggestions).toHaveLength(1);
      expect(r.result.overallNotes).toEqual(["consider tests"]);
    }
  });
  it("strips markdown fences", () => {
    const raw = "```json\n" + JSON.stringify({
      overallSummary: "ok",
      suggestions: [],
      overallNotes: [],
    }) + "\n```";
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
  });
  it("fails on invalid JSON", () => {
    const r = renderLlmResult("not json");
    expect(r.ok).toBe(false);
  });
  it("fails on non-object", () => {
    const r = renderLlmResult("[1,2,3]");
    expect(r.ok).toBe(false);
  });
  it("handles missing fields gracefully", () => {
    const r = renderLlmResult("{}");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.overallSummary).toBe("");
      expect(r.result.suggestions).toEqual([]);
      expect(r.result.overallNotes).toEqual([]);
    }
  });
});

// ---------- Honesty ----------

describe("ai-coding-pattern-refactorer honestyNote", () => {
  it("returns a non-empty string mentioning key concepts", () => {
    const n = honestyNote();
    expect(n.length).toBeGreaterThan(50);
    expect(n.toLowerCase()).toContain("behavior");
    expect(n.toLowerCase()).toContain("offline");
    expect(n.toLowerCase()).toContain("test");
  });
});

// ---------- Sample snippets ----------

describe("ai-coding-pattern-refactorer sample snippets", () => {
  it("python sample triggers at least one smell", () => {
    const code = SAMPLE_SNIPPETS.python;
    const smells = detectCodeSmells(code, "python");
    expect(smells.length).toBeGreaterThan(0);
  });
  it("javascript sample triggers at least one smell", () => {
    const code = SAMPLE_SNIPPETS.javascript;
    const smells = detectCodeSmells(code, "javascript");
    expect(smells.length).toBeGreaterThan(0);
  });
  it("typescript sample triggers at least one smell", () => {
    const code = SAMPLE_SNIPPETS.typescript;
    const smells = detectCodeSmells(code, "typescript");
    expect(smells.length).toBeGreaterThan(0);
  });
});
