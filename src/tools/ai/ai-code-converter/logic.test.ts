import { describe, it, expect, beforeEach } from "vitest";
import {
  ALL_LANGUAGES,
  LANGUAGE_LABELS,
  LANGUAGE_FILE_EXTENSIONS,
  SAMPLE_SNIPPETS,
  detectIndent,
  detectLanguage,
  detectFromFilename,
  parseLine,
  convertCode,
  computeKeyChanges,
  libraryMappings,
  computeDiff,
  renderDiffHtml,
  wrapInFileBoilerplate,
  closeBlocks,
  emitStatement,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  honestyNote,
  type Language,
  type Statement,
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

describe("ai-code-converter constants", () => {
  it("has 7 languages", () => {
    expect(ALL_LANGUAGES).toHaveLength(7);
    expect(ALL_LANGUAGES).toContain("python");
    expect(ALL_LANGUAGES).toContain("go");
    expect(ALL_LANGUAGES).toContain("ruby");
  });

  it("has labels for all languages", () => {
    for (const l of ALL_LANGUAGES) {
      expect(LANGUAGE_LABELS[l]).toBeTruthy();
    }
  });

  it("has file extensions for all languages", () => {
    expect(LANGUAGE_FILE_EXTENSIONS.python).toContain("py");
    expect(LANGUAGE_FILE_EXTENSIONS.cpp).toContain("cpp");
    expect(LANGUAGE_FILE_EXTENSIONS.go).toContain("go");
  });

  it("has sample snippets for all languages", () => {
    for (const l of ALL_LANGUAGES) {
      expect(SAMPLE_SNIPPETS[l].length).toBeGreaterThan(0);
    }
  });
});

describe("ai-code-converter detectIndent", () => {
  it("returns 0 for no indent", () => {
    expect(detectIndent("hello")).toBe(0);
  });
  it("counts spaces", () => {
    expect(detectIndent("    hello")).toBe(4);
  });
  it("counts tabs as 4", () => {
    expect(detectIndent("\thello")).toBe(4);
  });
});

describe("ai-code-converter detectLanguage", () => {
  it("detects Python", () => {
    expect(detectLanguage("def foo():\n    print('hi')\n")).toBe("python");
  });
  it("detects JavaScript", () => {
    expect(detectLanguage("function foo() { console.log('hi'); }\n")).toBe("javascript");
  });
  it("detects TypeScript", () => {
    expect(detectLanguage("function foo(x: number): void { console.log(x); }\n")).toBe("typescript");
  });
  it("detects Java", () => {
    expect(detectLanguage("public class Main { public static void main(String[] args) { System.out.println(\"hi\"); } }\n")).toBe("java");
  });
  it("detects C++", () => {
    expect(detectLanguage("#include <iostream>\nint main() { std::cout << \"hi\"; }\n")).toBe("cpp");
  });
  it("detects Go", () => {
    expect(detectLanguage("package main\nimport \"fmt\"\nfunc main() { fmt.Println(\"hi\") }\n")).toBe("go");
  });
  it("detects Ruby", () => {
    expect(detectLanguage("def foo\n  puts 'hi'\nend\n")).toBe("ruby");
  });
  it("defaults to python for empty input", () => {
    expect(detectLanguage("")).toBe("python");
  });
});

describe("ai-code-converter detectFromFilename", () => {
  it("detects by extension", () => {
    expect(detectFromFilename("foo.py")).toBe("python");
    expect(detectFromFilename("bar.js")).toBe("javascript");
    expect(detectFromFilename("baz.ts")).toBe("typescript");
    expect(detectFromFilename("qux.java")).toBe("java");
    expect(detectFromFilename("x.cpp")).toBe("cpp");
    expect(detectFromFilename("y.go")).toBe("go");
    expect(detectFromFilename("z.rb")).toBe("ruby");
  });
  it("returns null for unknown", () => {
    expect(detectFromFilename("foo.txt")).toBeNull();
    expect(detectFromFilename("noext")).toBeNull();
  });
});

describe("ai-code-converter parseLine python", () => {
  it("parses def", () => {
    const s = parseLine("def foo(a, b):", "python");
    expect(s.kind).toBe("function");
    expect(s.name).toBe("foo");
    expect(s.params).toEqual(["a", "b"]);
  });
  it("parses class", () => {
    const s = parseLine("class Foo:", "python");
    expect(s.kind).toBe("class");
    expect(s.name).toBe("Foo");
  });
  it("parses if", () => {
    const s = parseLine("if x > 0:", "python");
    expect(s.kind).toBe("if");
    expect(s.condition).toBe("x > 0");
  });
  it("parses elif", () => {
    const s = parseLine("elif x > 0:", "python");
    expect(s.kind).toBe("elif");
  });
  it("parses else", () => {
    expect(parseLine("else:", "python").kind).toBe("else");
  });
  it("parses for-range with one arg", () => {
    const s = parseLine("for i in range(10):", "python");
    expect(s.kind).toBe("forRange");
    expect(s.varName).toBe("i");
    expect(s.end).toBe("10");
    expect(s.start).toBe("0");
  });
  it("parses for-range with two args", () => {
    const s = parseLine("for i in range(2, 10):", "python");
    expect(s.kind).toBe("forRange");
    expect(s.start).toBe("2");
    expect(s.end).toBe("10");
  });
  it("parses for-range with three args", () => {
    const s = parseLine("for i in range(0, 10, 2):", "python");
    expect(s.kind).toBe("forRange");
    expect(s.step).toBe("2");
  });
  it("parses for-each", () => {
    const s = parseLine("for x in items:", "python");
    expect(s.kind).toBe("forEach");
    expect(s.varName).toBe("x");
    expect(s.iterable).toBe("items");
  });
  it("parses while", () => {
    const s = parseLine("while x > 0:", "python");
    expect(s.kind).toBe("while");
  });
  it("parses return", () => {
    const s = parseLine("return x + 1", "python");
    expect(s.kind).toBe("return");
    expect(s.value).toBe("x + 1");
  });
  it("parses print", () => {
    const s = parseLine("print('hello')", "python");
    expect(s.kind).toBe("print");
  });
  it("parses comment", () => {
    const s = parseLine("# a comment", "python");
    expect(s.kind).toBe("comment");
  });
  it("parses try", () => {
    expect(parseLine("try:", "python").kind).toBe("try");
  });
  it("parses except", () => {
    const s = parseLine("except Exception as e:", "python");
    expect(s.kind).toBe("catch");
    expect(s.varName).toBe("e");
  });
  it("parses raise", () => {
    const s = parseLine("raise ValueError('bad')", "python");
    expect(s.kind).toBe("throw");
  });
  it("parses import", () => {
    const s = parseLine("import os", "python");
    expect(s.kind).toBe("import");
    expect(s.module).toBe("os");
  });
  it("parses from import", () => {
    const s = parseLine("from os import path", "python");
    expect(s.kind).toBe("import");
    expect(s.module).toBe("os");
  });
  it("parses variable assignment", () => {
    const s = parseLine("x = 42", "python");
    expect(s.kind).toBe("variable");
    expect(s.name).toBe("x");
    expect(s.value).toBe("42");
  });
  it("parses blank line", () => {
    expect(parseLine("", "python").kind).toBe("blank");
  });
  it("falls back to raw for unknown", () => {
    const s = parseLine("decorator @ thing", "python");
    expect(s.kind).toBe("raw");
  });
});

describe("ai-code-converter parseLine javascript", () => {
  it("parses function", () => {
    const s = parseLine("function foo(a, b) {", "javascript");
    expect(s.kind).toBe("function");
    expect(s.name).toBe("foo");
  });
  it("parses const arrow", () => {
    const s = parseLine("const foo = (a) => {", "javascript");
    expect(s.kind).toBe("function");
    expect(s.name).toBe("foo");
  });
  it("parses if", () => {
    expect(parseLine("if (x > 0) {", "javascript").kind).toBe("if");
  });
  it("parses else if", () => {
    expect(parseLine("else if (x > 0) {", "javascript").kind).toBe("elif");
  });
  it("parses for-range", () => {
    const s = parseLine("for (let i = 0; i < 10; i++) {", "javascript");
    expect(s.kind).toBe("forRange");
    expect(s.varName).toBe("i");
    expect(s.start).toBe("0");
    expect(s.end).toBe("10");
  });
  it("parses for-of", () => {
    const s = parseLine("for (const x of items) {", "javascript");
    expect(s.kind).toBe("forEach");
    expect(s.varName).toBe("x");
  });
  it("parses console.log", () => {
    expect(parseLine("console.log('hi');", "javascript").kind).toBe("print");
  });
  it("parses const var", () => {
    const s = parseLine("const x = 42;", "javascript");
    expect(s.kind).toBe("variable");
    expect(s.declKeyword).toBe("const");
  });
  it("parses comment", () => {
    expect(parseLine("// hi", "javascript").kind).toBe("comment");
  });
  it("parses return", () => {
    expect(parseLine("return x;", "javascript").kind).toBe("return");
  });
  it("parses throw", () => {
    expect(parseLine("throw new Error('x');", "javascript").kind).toBe("throw");
  });
});

describe("ai-code-converter parseLine java", () => {
  it("parses main method", () => {
    const s = parseLine("public static void main(String[] args) {", "java");
    expect(s.kind).toBe("function");
    expect(s.name).toBe("main");
  });
  it("parses println", () => {
    expect(parseLine("System.out.println(x);", "java").kind).toBe("print");
  });
  it("parses for-each", () => {
    const s = parseLine("for (int x : items) {", "java");
    expect(s.kind).toBe("forEach");
    expect(s.type).toBe("int");
  });
  it("parses class", () => {
    expect(parseLine("class Foo {", "java").kind).toBe("class");
  });
  it("parses import", () => {
    const s = parseLine("import java.util.List;", "java");
    expect(s.kind).toBe("import");
    expect(s.module).toBe("java.util.List");
  });
});

describe("ai-code-converter parseLine cpp", () => {
  it("parses include", () => {
    const s = parseLine("#include <iostream>", "cpp");
    expect(s.kind).toBe("import");
    expect(s.module).toBe("iostream");
  });
  it("parses cout", () => {
    expect(parseLine("std::cout << x << std::endl;", "cpp").kind).toBe("print");
  });
  it("parses class", () => {
    expect(parseLine("class Foo {", "cpp").kind).toBe("class");
  });
});

describe("ai-code-converter parseLine go", () => {
  it("parses package", () => {
    const s = parseLine("package main", "go");
    expect(s.kind).toBe("import");
    expect(s.module).toBe("package:main");
  });
  it("parses func", () => {
    const s = parseLine("func foo(a int, b int) {", "go");
    expect(s.kind).toBe("function");
    expect(s.name).toBe("foo");
  });
  it("parses fmt.Println", () => {
    expect(parseLine("fmt.Println(x)", "go").kind).toBe("print");
  });
  it("parses for-range", () => {
    const s = parseLine("for i := 0; i < 10; i++ {", "go");
    expect(s.kind).toBe("forRange");
  });
  it("parses for-range (range form)", () => {
    const s = parseLine("for _, x := range items {", "go");
    expect(s.kind).toBe("forEach");
  });
});

describe("ai-code-converter parseLine ruby", () => {
  it("parses def", () => {
    const s = parseLine("def foo(a, b)", "ruby");
    expect(s.kind).toBe("function");
    expect(s.name).toBe("foo");
  });
  it("parses puts", () => {
    expect(parseLine("puts 'hi'", "ruby").kind).toBe("print");
  });
  it("parses class", () => {
    expect(parseLine("class Foo", "ruby").kind).toBe("class");
  });
  it("parses times do", () => {
    const s = parseLine("5.times do |i|", "ruby");
    expect(s.kind).toBe("forRange");
    expect(s.end).toBe("5");
  });
  it("parses end", () => {
    const s = parseLine("end", "ruby");
    expect(s.kind).toBe("raw");
    expect(s.text).toBe("end");
  });
});

describe("ai-code-converter emitStatement", () => {
  it("emits python function", () => {
    const s: Statement = { kind: "function", indent: 0, name: "foo", params: ["a", "b"] };
    expect(emitStatement(s, "python")).toBe("def foo(a, b):");
  });
  it("emits javascript function", () => {
    const s: Statement = { kind: "function", indent: 0, name: "foo", params: ["a"] };
    expect(emitStatement(s, "javascript")).toBe("function foo(a) {");
  });
  it("emits go function", () => {
    const s: Statement = { kind: "function", indent: 0, name: "foo", params: ["a"] };
    expect(emitStatement(s, "go")).toBe("func foo(a) {");
  });
  it("emits python print", () => {
    const s: Statement = { kind: "print", indent: 0, args: ["'hi'"] };
    expect(emitStatement(s, "python")).toBe("print('hi')");
  });
  it("emits cpp cout", () => {
    const s: Statement = { kind: "print", indent: 0, args: ["x"] };
    expect(emitStatement(s, "cpp")).toBe("std::cout << x << std::endl;");
  });
  it("emits ruby puts", () => {
    const s: Statement = { kind: "print", indent: 0, args: ["'hi'"] };
    expect(emitStatement(s, "ruby")).toBe("puts 'hi'");
  });
  it("emits python comment from // ", () => {
    const s: Statement = { kind: "comment", indent: 0, text: "// hi" };
    expect(emitStatement(s, "python")).toBe("# hi");
  });
  it("emits javascript comment from #", () => {
    const s: Statement = { kind: "comment", indent: 0, text: "# hi" };
    expect(emitStatement(s, "javascript")).toBe("// hi");
  });
  it("emits forRange to javascript", () => {
    const s: Statement = { kind: "forRange", indent: 0, varName: "i", start: "0", end: "10", step: "1" };
    expect(emitStatement(s, "javascript")).toBe("for (let i = 0; i < 10; i++) {");
  });
  it("emits if to python", () => {
    const s: Statement = { kind: "if", indent: 0, condition: "x > 0" };
    expect(emitStatement(s, "python")).toBe("if x > 0:");
  });
  it("emits else to javascript", () => {
    const s: Statement = { kind: "else", indent: 0 };
    expect(emitStatement(s, "javascript")).toBe("} else {");
  });
  it("emits class to go struct", () => {
    const s: Statement = { kind: "class", indent: 0, name: "Foo" };
    expect(emitStatement(s, "go")).toBe("type Foo struct {");
  });
});

describe("ai-code-converter closeBlocks", () => {
  it("inserts closing braces for brace targets", () => {
    const stmts: Statement[] = [
      { kind: "function", indent: 0, name: "foo", params: [] },
      { kind: "print", indent: 2, args: ["'hi'"] },
    ];
    const out = closeBlocks(stmts, "javascript");
    // Should add a closing brace at the end
    expect(out.some((s) => s.kind === "raw" && s.text === "}")).toBe(true);
  });
  it("does not insert braces for python target", () => {
    const stmts: Statement[] = [
      { kind: "function", indent: 0, name: "foo", params: [] },
      { kind: "print", indent: 2, args: ["'hi'"] },
    ];
    const out = closeBlocks(stmts, "python");
    expect(out.some((s) => s.kind === "raw" && s.text === "}")).toBe(false);
  });
  it("closes nested blocks in order", () => {
    const stmts: Statement[] = [
      { kind: "function", indent: 0, name: "foo", params: [] },
      { kind: "if", indent: 2, condition: "x" },
      { kind: "return", indent: 4, value: "1" },
    ];
    const out = closeBlocks(stmts, "javascript");
    // Should have two closing braces
    expect(out.filter((s) => s.kind === "raw" && s.text === "}")).toHaveLength(2);
  });
});

describe("ai-code-converter convertCode python -> javascript", () => {
  const result = convertCode(
    "def foo(x):\n    print(x)\n    return x + 1\n",
    "python",
    "javascript",
  );

  it("outputs valid javascript", () => {
    expect(result.output).toContain("function foo(x) {");
    expect(result.output).toContain("console.log(x);");
    expect(result.output).toContain("return x + 1;");
    expect(result.output).toContain("}");
  });
  it("computes stats", () => {
    expect(result.stats.totalLines).toBe(4);
    expect(result.stats.parsedLines).toBeGreaterThan(0);
  });
  it("lists key changes", () => {
    expect(result.keyChanges.length).toBeGreaterThan(3);
    expect(result.keyChanges.some((c) => c.category === "Functions")).toBe(true);
    expect(result.keyChanges.some((c) => c.category === "Print")).toBe(true);
  });
  it("warns about testing", () => {
    expect(result.warnings.some((w) => w.includes("test"))).toBe(true);
  });
});

describe("ai-code-converter convertCode javascript -> python", () => {
  const result = convertCode(
    "function foo(x) {\n  console.log(x);\n  return x + 1;\n}\n",
    "javascript",
    "python",
  );
  it("outputs valid python", () => {
    expect(result.output).toContain("def foo(x):");
    expect(result.output).toContain("print(x)");
    expect(result.output).toContain("return x + 1");
  });
});

describe("ai-code-converter convertCode python -> go", () => {
  const result = convertCode(
    "def foo(x):\n    print(x)\n    return x + 1\n",
    "python",
    "go",
  );
  it("outputs valid go", () => {
    expect(result.output).toContain("func foo(x) {");
    expect(result.output).toContain("fmt.Println(x)");
    expect(result.output).toContain("return x + 1");
  });
});

describe("ai-code-converter convertCode for-range", () => {
  it("translates python for-range to javascript", () => {
    const r = convertCode("for i in range(10):\n    print(i)\n", "python", "javascript");
    expect(r.output).toContain("for (let i = 0; i < 10; i++) {");
    expect(r.output).toContain("console.log(i);");
  });
  it("translates python for-range to ruby", () => {
    const r = convertCode("for i in range(5):\n    print(i)\n", "python", "ruby");
    expect(r.output).toContain("5.times do |i|");
    expect(r.output).toContain("puts i");
  });
});

describe("ai-code-converter convertCode if/elif/else", () => {
  it("translates python if/elif/else to javascript", () => {
    const code = "if x > 0:\n    print('pos')\nelif x < 0:\n    print('neg')\nelse:\n    print('zero')\n";
    const r = convertCode(code, "python", "javascript");
    expect(r.output).toContain("if (x > 0) {");
    expect(r.output).toContain("} else if (x < 0) {");
    expect(r.output).toContain("} else {");
  });
});

describe("ai-code-converter computeKeyChanges", () => {
  it("lists block conversion for python to js", () => {
    const c = computeKeyChanges("python", "javascript");
    expect(c.some((x) => x.category === "Blocks")).toBe(true);
  });
  it("lists block conversion for js to python", () => {
    const c = computeKeyChanges("javascript", "python");
    expect(c.some((x) => x.category === "Blocks")).toBe(true);
  });
});

describe("ai-code-converter libraryMappings", () => {
  it("returns python->js mappings", () => {
    const m = libraryMappings("python", "javascript");
    expect(m.length).toBeGreaterThan(0);
    expect(m.some((x) => x.fromLib === "requests")).toBe(true);
  });
  it("returns empty for unknown pair", () => {
    const m = libraryMappings("ruby", "go");
    expect(m).toEqual([]);
  });
});

describe("ai-code-converter computeDiff", () => {
  it("marks identical lines as same", () => {
    const d = computeDiff("a\nb\nc", "a\nb\nc");
    expect(d.every((x) => x.type === "same")).toBe(true);
  });
  it("marks added/removed lines", () => {
    const d = computeDiff("a\nb\nc", "a\nx\nc");
    expect(d.some((x) => x.type === "removed" && x.source === "b")).toBe(true);
    expect(d.some((x) => x.type === "added" && x.target === "x")).toBe(true);
  });
});

describe("ai-code-converter renderDiffHtml", () => {
  it("renders plain diff", () => {
    const d = computeDiff("a\nb", "a\nc");
    const out = renderDiffHtml(d);
    expect(out).toContain("+ c");
    expect(out).toContain("- b");
  });
});

describe("ai-code-converter wrapInFileBoilerplate", () => {
  it("wraps java in class", () => {
    const out = wrapInFileBoilerplate("System.out.println(x);", "java", "Main.java");
    expect(out).toContain("public class Main");
  });
  it("wraps cpp with includes", () => {
    const out = wrapInFileBoilerplate("int x;", "cpp");
    expect(out).toContain("#include <iostream>");
  });
  it("wraps go with package", () => {
    const out = wrapInFileBoilerplate("fmt.Println(x)", "go");
    expect(out).toContain("package main");
    expect(out).toContain("\"fmt\"");
  });
  it("returns code unchanged for python", () => {
    const out = wrapInFileBoilerplate("print('hi')", "python");
    expect(out).toBe("print('hi')");
  });
});

describe("ai-code-converter history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, source: "python", target: "javascript", snippet: "x", linesTranslated: 3 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, source: "python", target: "go", snippet: "x", linesTranslated: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, source: "python", target: "go", snippet: "x", linesTranslated: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-code-converter share URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("python", "javascript", "print('hi')", {});
    expect(url).toContain("src=python");
    expect(url).toContain("tgt=javascript");
    expect(url).toContain("code=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const s = parseShareUrl("src=python&tgt=go&code=print(%27hi%27)");
    expect(s.source).toBe("python");
    expect(s.target).toBe("go");
    expect(s.code).toBe("print('hi')");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown languages", () => {
    const s = parseShareUrl("src=perl&tgt=python");
    expect(s.source).toBeUndefined();
    expect(s.target).toBe("python");
  });
});

describe("ai-code-converter LLM", () => {
  it("builds a prompt with source and target", () => {
    const p = buildLlmPrompt("def foo(): pass\n", "python", "go", []);
    expect(p).toContain("python");
    expect(p).toContain("Go");
    expect(p).toContain("def foo()");
    expect(p).toContain("refinedCode");
  });
  it("parses valid LLM JSON", () => {
    const raw = JSON.stringify({
      refinedCode: "func foo() {}",
      notes: ["ok"],
      unsupportedResolved: [],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.refinedCode).toContain("func foo");
      expect(r.result.notes).toEqual(["ok"]);
    }
  });
  it("strips markdown fences", () => {
    const raw = "```json\n" + JSON.stringify({ refinedCode: "x", notes: [], unsupportedResolved: [] }) + "\n```";
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

describe("ai-code-converter honesty", () => {
  it("returns a non-empty note", () => {
    expect(honestyNote().length).toBeGreaterThan(20);
  });
});

describe("ai-code-converter preserveComments option", () => {
  it("drops comments when preserveComments is false", () => {
    const r = convertCode("# hi\ndef foo():\n    print('x')\n", "python", "javascript", { preserveComments: false });
    expect(r.output).not.toContain("# hi");
  });
  it("keeps comments when preserveComments is true", () => {
    const r = convertCode("# hi\ndef foo():\n    print('x')\n", "python", "javascript", { preserveComments: true });
    expect(r.output).toContain("// hi");
  });
});

describe("ai-code-converter same-source-target", () => {
  it("warns when source equals target", () => {
    const r = convertCode("def foo(): pass\n", "python", "python");
    expect(r.warnings.some((w) => w.includes("identical"))).toBe(true);
  });
});

// Suppress unused-import lint
export type _Unused = Language;
