import { describe, it, expect } from "vitest";
import { toMarkdown, parseCSV, DEFAULT_OPTIONS, type CsvToMarkdownOptions } from "./logic";

function opts(o: Partial<CsvToMarkdownOptions>): CsvToMarkdownOptions {
  return { ...DEFAULT_OPTIONS, ...o };
}

describe("parseCSV", () => {
  it("parses simple CSV", () => {
    expect(parseCSV("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });
  it("handles quoted fields with commas", () => {
    expect(parseCSV('"a,b",c')).toEqual([["a,b", "c"]]);
  });
  it("handles escaped quotes", () => {
    expect(parseCSV('"He said ""hi""",c')).toEqual([['He said "hi"', "c"]]);
  });
  it("handles CRLF line endings", () => {
    expect(parseCSV("a,b\r\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
  it("handles empty fields", () => {
    expect(parseCSV("a,,c")).toEqual([["a", "", "c"]]);
  });
});

describe("toMarkdown — GFM", () => {
  it("converts basic CSV with header", () => {
    const result = toMarkdown("Name,Age\nAlice,30", opts({}));
    expect(result).toContain("| Name | Age |");
    expect(result).toContain("| --- | --- |");
    expect(result).toContain("| Alice | 30 |");
  });
  it("escapes pipes in cells", () => {
    const result = toMarkdown("a|b,c", opts({}));
    expect(result).toContain("a\\|b");
  });
  it("supports alignment", () => {
    const result = toMarkdown("a,b\n1,2", opts({ alignments: ["left", "right"] }));
    expect(result).toContain(":---");
    expect(result).toContain("---:");
  });
});

describe("toMarkdown — HTML", () => {
  it("outputs HTML table", () => {
    const result = toMarkdown("a,b\n1,2", opts({ output: "html" }));
    expect(result).toContain("<table>");
    expect(result).toContain("<th>a</th>");
    expect(result).toContain("<td>1</td>");
  });
});

describe("toMarkdown — Jira", () => {
  it("outputs Jira table", () => {
    const result = toMarkdown("a,b\n1,2", opts({ output: "jira" }));
    expect(result).toContain("|| a || b ||");
    expect(result).toContain("| 1 | 2 |");
  });
});

describe("toMarkdown — edge cases", () => {
  it("handles empty input", () => {
    expect(toMarkdown("", opts({}))).toBe("");
  });
  it("handles no header", () => {
    const result = toMarkdown("a,b\nc,d", opts({ hasHeader: false }));
    expect(result).toContain("| a | b |");
  });
  it("handles huge input (10K rows)", () => {
    const input = "a,b\n" + "1,2\n".repeat(10000);
    const result = toMarkdown(input, opts({}));
    expect(result.split("\n").length).toBeGreaterThan(10000);
  });
  it("handles Unicode", () => {
    const result = toMarkdown("名前,年齢\n田中,30", opts({}));
    expect(result).toContain("名前");
    expect(result).toContain("田中");
  });
});
