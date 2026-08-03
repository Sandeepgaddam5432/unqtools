import { describe, it, expect } from "vitest";
import { tokenize, buildAst, parseCode, formatTokenTable, formatAstJson } from "./logic";

describe("AST Explorer", () => {
  describe("tokenize", () => {
    it("tokenizes simple variable declaration", () => {
      const tokens = tokenize("const x = 42;");
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.find(t => t.value === "const")).toBeDefined();
      expect(tokens.find(t => t.value === "x")).toBeDefined();
      expect(tokens.find(t => t.value === "42")).toBeDefined();
    });

    it("tokenizes strings", () => {
      const tokens = tokenize('"hello"');
      expect(tokens.find(t => t.type === "string")).toBeDefined();
    });

    it("tokenizes comments", () => {
      const tokens = tokenize("// this is a comment\nconst x = 1;");
      expect(tokens.find(t => t.type === "comment")).toBeDefined();
    });

    it("tokenizes multiline comments", () => {
      const tokens = tokenize("/* block\ncomment */\nconst x = 1;");
      expect(tokens.find(t => t.type === "multiline-comment")).toBeDefined();
    });

    it("tokenizes operators", () => {
      const tokens = tokenize("a === b");
      expect(tokens.find(t => t.type === "operator")).toBeDefined();
    });

    it("tracks line numbers", () => {
      const tokens = tokenize("const a = 1;\nconst b = 2;");
      const bToken = tokens.find(t => t.value === "b" && t.type === "identifier");
      expect(bToken?.line).toBe(2);
    });

    it("handles empty input", () => {
      expect(tokenize("")).toHaveLength(0);
    });

    it("handles arrow functions", () => {
      const tokens = tokenize("const fn = () => {}");
      expect(tokens.find(t => t.type === "arrow")).toBeDefined();
    });
  });

  describe("buildAst", () => {
    it("builds AST from tokens", () => {
      const tokens = tokenize("const x = 1;");
      const ast = buildAst(tokens);
      expect(ast.type).toBe("Program");
      expect(ast.children.length).toBeGreaterThan(0);
    });

    it("handles nested blocks", () => {
      const tokens = tokenize("function foo() { if (true) { return 1; } }");
      const ast = buildAst(tokens);
      expect(ast.children.length).toBeGreaterThan(0);
    });
  });

  describe("parseCode", () => {
    it("parses code successfully", () => {
      const result = parseCode("const x = 42;");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.tokens.length).toBeGreaterThan(0);
      expect(result.stats.lineCount).toBe(1);
    });

    it("fails on empty code", () => {
      const result = parseCode("");
      expect(result.ok).toBe(false);
    });

    it("parses class declarations", () => {
      const result = parseCode("class Foo extends Bar { constructor() {} }");
      expect(result.ok).toBe(true);
    });

    it("provides correct stats", () => {
      const result = parseCode("const a = 1;\nconst b = 2;\nconst c = 3;");
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.stats.lineCount).toBe(3);
      expect(result.stats.tokenCount).toBeGreaterThan(0);
    });
  });

  describe("formatTokenTable", () => {
    it("formats tokens as table", () => {
      const tokens = tokenize("const x = 1;");
      const table = formatTokenTable(tokens);
      expect(table).toContain("Line");
      expect(table).toContain("Type");
    });
  });

  describe("formatAstJson", () => {
    it("formats AST as JSON", () => {
      const tokens = tokenize("const x = 1;");
      const ast = buildAst(tokens);
      const json = formatAstJson(ast);
      expect(JSON.parse(json)).toBeDefined();
    });
  });
});
