import { describe, it, expect, beforeEach } from "vitest";
import {
  ALL_LANGUAGES,
  LANGUAGE_LABELS,
  DEPTH_LABELS,
  DEPTH_ORDER,
  TRANSLATION_LABELS,
  ALL_TRANSLATIONS,
  CONSTRUCT_LABELS,
  SAMPLE_SNIPPETS,
  HISTORY_MAX,
  detectLanguage,
  classifyLine,
  extractName,
  identifyConstructs,
  groupBlocks,
  explainConstruct,
  explainLine,
  explainCode,
  explainCodeFull,
  generateOverallSummary,
  computeComplexityHint,
  identifyLibsAndApis,
  findSecuritySmells,
  computeDataFlow,
  addInlineComments,
  translateExplanation,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  honestyNote,
  type Language,
  type Depth,
  type ConstructType,
  type TranslationLang,
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

describe("ai-code-explainer constants", () => {
  it("has 6 languages", () => {
    expect(ALL_LANGUAGES).toHaveLength(6);
    expect(ALL_LANGUAGES).toContain("python");
    expect(ALL_LANGUAGES).toContain("go");
  });
  it("has labels for all languages", () => {
    for (const l of ALL_LANGUAGES) expect(LANGUAGE_LABELS[l]).toBeTruthy();
  });
  it("has 4 depth levels", () => {
    expect(DEPTH_ORDER).toHaveLength(4);
    expect(DEPTH_ORDER).toContain("eli5");
    expect(DEPTH_ORDER).toContain("expert");
  });
  it("has labels for all depths", () => {
    for (const d of DEPTH_ORDER) expect(DEPTH_LABELS[d]).toBeTruthy();
  });
  it("has 6 translation targets", () => {
    expect(ALL_TRANSLATIONS).toHaveLength(6);
    expect(ALL_TRANSLATIONS).toContain("en");
    expect(ALL_TRANSLATIONS).toContain("zh");
  });
  it("has labels for all translation targets", () => {
    for (const t of ALL_TRANSLATIONS) expect(TRANSLATION_LABELS[t]).toBeTruthy();
  });
  it("has construct labels for many constructs", () => {
    expect(Object.keys(CONSTRUCT_LABELS).length).toBeGreaterThanOrEqual(20);
  });
  it("has sample snippets for all languages", () => {
    for (const l of ALL_LANGUAGES) {
      expect(SAMPLE_SNIPPETS[l].length).toBeGreaterThan(0);
    }
  });
  it("HISTORY_MAX is 20", () => {
    expect(HISTORY_MAX).toBe(20);
  });
});

// ---------- detectLanguage ----------

describe("ai-code-explainer detectLanguage", () => {
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
  it("returns python for empty input", () => {
    expect(detectLanguage("")).toBe("python");
    expect(detectLanguage("   \n  ")).toBe("python");
  });
});

// ---------- classifyLine ----------

describe("ai-code-explainer classifyLine", () => {
  it("classifies python def as function-decl", () => {
    expect(classifyLine("def foo(x):", "python")).toBe("function-decl");
  });
  it("classifies python if", () => {
    expect(classifyLine("if x > 0:", "python")).toBe("if");
  });
  it("classifies python for-loop", () => {
    expect(classifyLine("for i in range(10):", "python")).toBe("for-loop");
  });
  it("classifies python while-loop", () => {
    expect(classifyLine("while True:", "python")).toBe("while-loop");
  });
  it("classifies python import", () => {
    expect(classifyLine("import os", "python")).toBe("import");
  });
  it("classifies python from import", () => {
    expect(classifyLine("from collections import defaultdict", "python")).toBe("import");
  });
  it("classifies python return", () => {
    expect(classifyLine("return x + 1", "python")).toBe("return");
  });
  it("classifies python print", () => {
    expect(classifyLine("print('hello')", "python")).toBe("print");
  });
  it("classifies python comment", () => {
    expect(classifyLine("# this is a comment", "python")).toBe("comment");
  });
  it("classifies python elif", () => {
    expect(classifyLine("elif x == 1:", "python")).toBe("elif");
  });
  it("classifies python else", () => {
    expect(classifyLine("else:", "python")).toBe("else");
  });
  it("classifies python try/except", () => {
    expect(classifyLine("try:", "python")).toBe("try");
    expect(classifyLine("except ValueError:", "python")).toBe("catch");
  });
  it("classifies python variable-decl", () => {
    expect(classifyLine("x = 5", "python")).toBe("variable-decl");
  });
  it("classifies blank line", () => {
    expect(classifyLine("", "python")).toBe("blank");
    expect(classifyLine("   ", "python")).toBe("blank");
  });
  it("classifies python decorator", () => {
    expect(classifyLine("@app.route('/')", "python")).toBe("decorator");
  });

  it("classifies javascript function-decl", () => {
    expect(classifyLine("function foo() {", "javascript")).toBe("function-decl");
  });
  it("classifies javascript arrow-function", () => {
    expect(classifyLine("const add = (a, b) => a + b;", "javascript")).toBe("arrow-function");
  });
  it("classifies javascript import", () => {
    expect(classifyLine("import React from 'react';", "javascript")).toBe("import");
  });
  it("classifies javascript require", () => {
    expect(classifyLine("const fs = require('fs');", "javascript")).toBe("variable-decl");
    expect(classifyLine("require('dotenv').config();", "javascript")).toBe("import");
  });
  it("classifies javascript console.log as print", () => {
    expect(classifyLine("console.log('hi');", "javascript")).toBe("print");
  });
  it("classifies javascript for-loop", () => {
    expect(classifyLine("for (let i = 0; i < 10; i++) {", "javascript")).toBe("for-loop");
  });
  it("classifies javascript block-end", () => {
    expect(classifyLine("}", "javascript")).toBe("block-end");
  });
  it("classifies javascript class-decl", () => {
    expect(classifyLine("class Foo {", "javascript")).toBe("class-decl");
  });

  it("classifies go import", () => {
    expect(classifyLine("import \"fmt\"", "go")).toBe("import");
  });
  it("classifies go func", () => {
    expect(classifyLine("func main() {", "go")).toBe("function-decl");
  });
  it("classifies go Println as print", () => {
    expect(classifyLine("fmt.Println(\"hi\")", "go")).toBe("print");
  });
  it("classifies go variable-decl with :=", () => {
    expect(classifyLine("x := 5", "go")).toBe("variable-decl");
  });

  it("classifies cpp include", () => {
    expect(classifyLine("#include <iostream>", "cpp")).toBe("import");
  });
  it("classifies cpp cout as print", () => {
    expect(classifyLine("std::cout << \"hi\";", "cpp")).toBe("print");
  });

  it("classifies java System.out.println as print", () => {
    expect(classifyLine("System.out.println(\"hi\");", "java")).toBe("print");
  });
  it("classifies java import", () => {
    expect(classifyLine("import java.util.List;", "java")).toBe("import");
  });
});

// ---------- extractName ----------

describe("ai-code-explainer extractName", () => {
  it("extracts python function name", () => {
    expect(extractName("def factorial(n):", "function-decl")).toBe("factorial");
  });
  it("extracts javascript function name", () => {
    expect(extractName("function foo() {", "function-decl")).toBe("foo");
  });
  it("extracts arrow-function name", () => {
    expect(extractName("const add = (a, b) => a + b;", "arrow-function")).toBe("add");
  });
  it("extracts class name", () => {
    expect(extractName("class Foo {", "class-decl")).toBe("Foo");
  });
  it("returns undefined for non-named constructs", () => {
    expect(extractName("if (x) {", "if")).toBeUndefined();
  });
});

// ---------- identifyConstructs ----------

describe("ai-code-explainer identifyConstructs", () => {
  it("returns one hit per line", () => {
    const code = "def foo():\n    return 1\n";
    const hits = identifyConstructs(code, "python");
    expect(hits).toHaveLength(3);
    expect(hits[0].line).toBe(1);
    expect(hits[0].type).toBe("function-decl");
    expect(hits[1].line).toBe(2);
    expect(hits[1].type).toBe("return");
    expect(hits[2].type).toBe("blank");
  });
  it("captures function name in detail", () => {
    const hits = identifyConstructs("def factorial(n):\n    return 1\n", "python");
    expect(hits[0].detail).toBe("factorial");
  });
});

// ---------- groupBlocks ----------

describe("ai-code-explainer groupBlocks", () => {
  it("groups function blocks (JS)", () => {
    const code = "function foo() {\n  return 1;\n}\n";
    const hits = identifyConstructs(code, "javascript");
    const blocks = groupBlocks(hits);
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const fnBlock = blocks.find((b) => b.kind === "function");
    expect(fnBlock).toBeDefined();
    expect(fnBlock!.name).toBe("foo");
    expect(fnBlock!.startLine).toBe(1);
    expect(fnBlock!.endLine).toBe(3);
  });
  it("groups if blocks (JS)", () => {
    const code = "if (x) {\n  return 1;\n}\n";
    const hits = identifyConstructs(code, "javascript");
    const blocks = groupBlocks(hits);
    const ifBlock = blocks.find((b) => b.kind === "if");
    expect(ifBlock).toBeDefined();
  });
  it("groups class blocks (JS)", () => {
    const code = "class Foo {\n  bar() {}\n}\n";
    const hits = identifyConstructs(code, "javascript");
    const blocks = groupBlocks(hits);
    const cls = blocks.find((b) => b.kind === "class");
    expect(cls).toBeDefined();
    expect(cls!.name).toBe("Foo");
  });
});

// ---------- explainConstruct / explainLine ----------

describe("ai-code-explainer explainConstruct", () => {
  it("returns different strings per depth", () => {
    const eli5 = explainConstruct("for-loop", "eli5", "i");
    const beg = explainConstruct("for-loop", "beginner", "i");
    const int = explainConstruct("for-loop", "intermediate", "i");
    const exp = explainConstruct("for-loop", "expert", "i");
    expect(eli5).toBeTruthy();
    expect(beg).toBeTruthy();
    expect(int).toBeTruthy();
    expect(exp).toBeTruthy();
    expect(eli5).not.toBe(beg);
    expect(beg).not.toBe(int);
    expect(int).not.toBe(exp);
  });
  it("substitutes the name into the explanation", () => {
    const e = explainConstruct("function-decl", "beginner", "factorial");
    expect(e).toContain("factorial");
  });
  it("handles all construct types without throwing", () => {
    const all: ConstructType[] = [
      "import", "function-decl", "arrow-function", "class-decl",
      "if", "elif", "else", "for-loop", "while-loop", "do-while",
      "try", "catch", "finally", "switch", "case", "return",
      "variable-decl", "assignment", "function-call", "print",
      "comment", "decorator", "async", "await", "break", "continue",
      "throw", "block-end", "blank", "other",
    ];
    for (const c of all) {
      for (const d of DEPTH_ORDER) {
        const s = explainConstruct(c, d, "x");
        expect(typeof s).toBe("string");
        expect(s.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("ai-code-explainer explainLine", () => {
  it("infers construct if not given", () => {
    const e = explainLine("def foo():", "python", "beginner");
    expect(e.construct).toBe("function-decl");
    expect(e.explanation).toContain("foo");
  });
  it("uses given construct", () => {
    const e = explainLine("x = 5", "python", "beginner", "variable-decl");
    expect(e.construct).toBe("variable-decl");
  });
});

// ---------- explainCode ----------

describe("ai-code-explainer explainCode", () => {
  it("returns one explanation per line", () => {
    const code = "def foo():\n    return 1\n";
    const out = explainCode(code, "python", "beginner");
    expect(out).toHaveLength(3);
    expect(out[0].line).toBe(1);
    expect(out[0].construct).toBe("function-decl");
    expect(out[1].line).toBe(2);
    expect(out[1].construct).toBe("return");
    expect(out[2].construct).toBe("blank");
  });
});

// ---------- generateOverallSummary ----------

describe("ai-code-explainer generateOverallSummary", () => {
  it("includes line count and language at beginner", () => {
    const code = "def foo():\n    return 1\n";
    const s = generateOverallSummary(code, "python", "beginner");
    expect(s).toContain("Python");
    expect(s.toLowerCase()).toContain("function");
  });
  it("eli5 uses simpler language", () => {
    const code = "def foo():\n    return 1\n";
    const eli5 = generateOverallSummary(code, "python", "eli5");
    const exp = generateOverallSummary(code, "python", "expert");
    expect(eli5.length).toBeGreaterThan(0);
    expect(exp.length).toBeGreaterThan(0);
    expect(eli5).not.toBe(exp);
  });
  it("mentions classes when present", () => {
    const code = "class Foo:\n    pass\n";
    const s = generateOverallSummary(code, "python", "intermediate");
    expect(s.toLowerCase()).toContain("class");
  });
});

// ---------- computeComplexityHint ----------

describe("ai-code-explainer computeComplexityHint", () => {
  it("detects a single loop as O(n)", () => {
    const code = "for i in range(n):\n    print(i)\n";
    const c = computeComplexityHint(code, "python");
    expect(c.loops).toBe(1);
    expect(c.bigO).toContain("O(n)");
  });
  it("detects nested loops as O(n^2)", () => {
    const code = [
      "for i in range(n):",
      "    for j in range(n):",
      "        print(i, j)",
    ].join("\n");
    const c = computeComplexityHint(code, "python");
    expect(c.loops).toBe(2);
    expect(c.nestedLoops).toBeGreaterThanOrEqual(1);
    expect(c.bigO).toContain("O(n");
  });
  it("detects recursion", () => {
    const code = [
      "def factorial(n):",
      "    if n <= 1:",
      "        return 1",
      "    return n * factorial(n - 1)",
    ].join("\n");
    const c = computeComplexityHint(code, "python");
    expect(c.recursion).toBe(true);
  });
  it("detects sort calls", () => {
    const code = "arr.sort()\n";
    const c = computeComplexityHint(code, "javascript");
    expect(c.sortCall).toBe(true);
  });
  it("returns cyclomatic >= 1", () => {
    const c = computeComplexityHint("x = 1\n", "python");
    expect(c.cyclomatic).toBeGreaterThanOrEqual(1);
  });
});

// ---------- identifyLibsAndApis ----------

describe("ai-code-explainer identifyLibsAndApis", () => {
  it("detects python imports", () => {
    const libs = identifyLibsAndApis("import os\nfrom collections import defaultdict\n", "python");
    expect(libs).toHaveLength(2);
    expect(libs[0].name).toBe("os");
    expect(libs[1].name).toBe("collections");
  });
  it("detects JS imports", () => {
    const libs = identifyLibsAndApis("import React from 'react';\n", "javascript");
    expect(libs).toHaveLength(1);
    expect(libs[0].name).toBe("react");
  });
  it("detects JS require", () => {
    const libs = identifyLibsAndApis("const fs = require('fs');\n", "javascript");
    expect(libs.find((l) => l.name === "fs")).toBeDefined();
  });
  it("detects cpp includes", () => {
    const libs = identifyLibsAndApis("#include <iostream>\n", "cpp");
    expect(libs).toHaveLength(1);
    expect(libs[0].name).toBe("iostream");
  });
  it("detects go imports", () => {
    const libs = identifyLibsAndApis("import \"fmt\"\n", "go");
    expect(libs).toHaveLength(1);
    expect(libs[0].name).toBe("fmt");
  });
  it("detects java imports", () => {
    const libs = identifyLibsAndApis("import java.util.List;\n", "java");
    expect(libs).toHaveLength(1);
    expect(libs[0].name).toBe("java.util.List");
  });
  it("returns empty for no imports", () => {
    expect(identifyLibsAndApis("x = 1\n", "python")).toHaveLength(0);
  });
});

// ---------- findSecuritySmells ----------

describe("ai-code-explainer findSecuritySmells", () => {
  it("flags eval", () => {
    const s = findSecuritySmells("eval(userInput);\n", "javascript");
    expect(s.find((x) => x.rule === "eval-usage")).toBeDefined();
    expect(s[0].severity).toBe("error");
  });
  it("flags innerHTML assignment", () => {
    const s = findSecuritySmells("el.innerHTML = userInput;\n", "javascript");
    expect(s.find((x) => x.rule === "inner-html")).toBeDefined();
  });
  it("flags hardcoded password", () => {
    const s = findSecuritySmells("password = 'admin123';\n", "python");
    expect(s.find((x) => x.rule === "hardcoded-credential")).toBeDefined();
  });
  it("flags bare except (python)", () => {
    const s = findSecuritySmells("except:\n    pass\n", "python");
    expect(s.find((x) => x.rule === "bare-except")).toBeDefined();
  });
  it("flags MD5", () => {
    const s = findSecuritySmells("hash = md5(input);\n", "javascript");
    expect(s.find((x) => x.rule === "weak-crypto-md5")).toBeDefined();
  });
  it("returns empty for clean code", () => {
    const s = findSecuritySmells("x = 1\ny = x + 2\n", "python");
    expect(s).toHaveLength(0);
  });
});

// ---------- computeDataFlow ----------

describe("ai-code-explainer computeDataFlow", () => {
  it("tracks python variable declarations", () => {
    const df = computeDataFlow("x = 1\ny = x + 2\n", "python");
    const x = df.find((d) => d.variable === "x");
    expect(x).toBeDefined();
    expect(x!.declaredAt).toBe(1);
    expect(x!.usedAt).toContain(2);
  });
  it("tracks JS const declarations", () => {
    const df = computeDataFlow("const a = 1;\nconst b = a + 2;\n", "javascript");
    const a = df.find((d) => d.variable === "a");
    expect(a).toBeDefined();
    expect(a!.usedAt).toContain(2);
  });
  it("caps output at 50 entries", () => {
    const lines: string[] = [];
    for (let i = 0; i < 100; i++) lines.push(`v${i} = ${i}`);
    const df = computeDataFlow(lines.join("\n"), "python");
    expect(df.length).toBeLessThanOrEqual(50);
  });
});

// ---------- addInlineComments ----------

describe("ai-code-explainer addInlineComments", () => {
  it("adds python # comments", () => {
    const commented = addInlineComments("def foo():\n    return 1\n", "python", "beginner");
    const lines = commented.split("\n");
    expect(lines[0]).toContain("#");
    expect(lines[0]).toContain("function");
  });
  it("adds JS // comments", () => {
    const commented = addInlineComments("function foo() {\n  return 1;\n}\n", "javascript", "beginner");
    const lines = commented.split("\n");
    expect(lines[0]).toContain("//");
  });
  it("does not modify blank lines", () => {
    const commented = addInlineComments("x = 1\n\ny = 2\n", "python", "beginner");
    const lines = commented.split("\n");
    expect(lines[1]).toBe("");
  });
  it("does not double-comment comment lines", () => {
    const commented = addInlineComments("# already commented\nx = 1\n", "python", "beginner");
    const lines = commented.split("\n");
    // First line should not have a trailing #
    expect((lines[0].match(/#/g) ?? []).length).toBe(1);
  });
});

// ---------- translateExplanation ----------

describe("ai-code-explainer translateExplanation", () => {
  it("returns input unchanged for en", () => {
    const t = translateExplanation("Declares a function named foo.", "en");
    expect(t).toBe("Declares a function named foo.");
  });
  it("translates 'Declares a function' to Spanish", () => {
    const t = translateExplanation("Declares a function named foo.", "es");
    expect(t).toContain("Declara una función");
  });
  it("translates 'Declares a function' to Chinese", () => {
    const t = translateExplanation("Declares a function named foo.", "zh");
    expect(t).toContain("声明函数");
  });
  it("translates 'Declares a function' to Japanese", () => {
    const t = translateExplanation("Declares a function named foo.", "ja");
    expect(t).toContain("関数を宣言します");
  });
  it("leaves unmatched strings unchanged", () => {
    const t = translateExplanation("Some random text not in dictionary.", "fr");
    expect(t).toBe("Some random text not in dictionary.");
  });
});

// ---------- explainCodeFull ----------

describe("ai-code-explainer explainCodeFull", () => {
  it("returns all expected fields", () => {
    const r = explainCodeFull("def foo():\n    return 1\n", "python", "beginner");
    expect(r.language).toBe("python");
    expect(r.depth).toBe("beginner");
    expect(r.overallSummary).toBeTruthy();
    expect(r.lines).toHaveLength(3);
    expect(r.blocks).toBeInstanceOf(Array);
    expect(r.complexity).toBeDefined();
    expect(r.libraries).toBeInstanceOf(Array);
    expect(r.securitySmells).toBeInstanceOf(Array);
    expect(r.dataFlow).toBeInstanceOf(Array);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("sets translatedTo when translate is non-en", () => {
    const r = explainCodeFull("def foo():\n    return 1\n", "python", "beginner", "es");
    expect(r.translatedTo).toBe("es");
  });
  it("leaves translatedTo undefined for en", () => {
    const r = explainCodeFull("def foo():\n    return 1\n", "python", "beginner", "en");
    expect(r.translatedTo).toBeUndefined();
  });
  it("flags minified code in warnings", () => {
    const longLine = "x = " + "a".repeat(400);
    const r = explainCodeFull(longLine, "python", "beginner");
    expect(r.warnings.some((w) => /minified/i.test(w))).toBe(true);
  });
});

// ---------- History ----------

describe("ai-code-explainer history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1000,
      language: "python",
      depth: "beginner",
      snippet: "def foo():",
      lineCount: 1,
      constructCount: 1,
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
        depth: "beginner",
        snippet: `s${i}`,
        lineCount: 1,
        constructCount: 1,
      });
    }
    expect(loadHistory()).toHaveLength(HISTORY_MAX);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1,
      language: "python",
      depth: "beginner",
      snippet: "x",
      lineCount: 1,
      constructCount: 1,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------- Shareable URL ----------

describe("ai-code-explainer shareUrl", () => {
  it("builds a URL with lang, depth, tr, code", () => {
    const url = buildShareUrl("python", "beginner", "def foo():", "en");
    expect(url).toContain("lang=python");
    expect(url).toContain("depth=beginner");
    expect(url).toContain("tr=en");
    expect(url).toContain("code=def+foo");
  });
  it("parses back the state", () => {
    const url = buildShareUrl("javascript", "expert", "function foo() {}", "es");
    const parsed = parseShareUrl(url);
    expect(parsed.language).toBe("javascript");
    expect(parsed.depth).toBe("expert");
    expect(parsed.translate).toBe("es");
    expect(parsed.code).toBe("function foo() {}");
  });
  it("ignores invalid lang", () => {
    const parsed = parseShareUrl("#lang=brainfuck&depth=beginner");
    expect(parsed.language).toBeUndefined();
  });
  it("ignores invalid depth", () => {
    const parsed = parseShareUrl("#lang=python&depth=ultra");
    expect(parsed.depth).toBeUndefined();
  });
  it("returns empty state for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
    expect(parseShareUrl("#")).toEqual({});
  });
});

// ---------- LLM prompt / rendering ----------

describe("ai-code-explainer LLM", () => {
  it("builds a prompt mentioning language and depth", () => {
    const p = buildLlmPrompt("def foo():\n  return 1\n", "python", "expert");
    expect(p).toContain("Python");
    expect(p).toContain("expert");
    expect(p).toContain("def foo()");
  });
  it("renders valid JSON", () => {
    const raw = JSON.stringify({
      overallSummary: "A simple function.",
      lineNotes: [{ line: 1, note: "declares foo" }],
      overallNotes: ["short and clear"],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.overallSummary).toBe("A simple function.");
      expect(r.result.lineNotes).toHaveLength(1);
      expect(r.result.overallNotes).toEqual(["short and clear"]);
    }
  });
  it("strips markdown fences", () => {
    const raw = "```json\n" + JSON.stringify({
      overallSummary: "ok",
      lineNotes: [],
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
});

// ---------- Honesty ----------

describe("ai-code-explainer honestyNote", () => {
  it("returns a non-empty string mentioning key concepts", () => {
    const n = honestyNote();
    expect(n.length).toBeGreaterThan(50);
    expect(n.toLowerCase()).toContain("heuristic");
    expect(n.toLowerCase()).toContain("offline");
  });
});
