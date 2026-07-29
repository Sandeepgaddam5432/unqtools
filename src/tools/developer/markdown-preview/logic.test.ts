import { describe, it, expect } from "vitest";
import { mdToHtml, getWordCount, getReadingTime, getTableOfContents, getMarkdownStats } from "./logic";

describe("Markdown Preview", () => {
  it("converts headers", () => {
    expect(mdToHtml("# Hello")).toContain("<h1>Hello</h1>");
    expect(mdToHtml("## World")).toContain("<h2>World</h2>");
  });
  it("converts bold and italic", () => {
    expect(mdToHtml("**bold**")).toContain("<strong>bold</strong>");
    expect(mdToHtml("*italic*")).toContain("<em>italic</em>");
  });
  it("converts links", () => {
    expect(mdToHtml("[text](url)")).toContain('<a href="url">text</a>');
  });
  it("counts words", () => {
    expect(getWordCount("hello world")).toBe(2);
  });
  it("calculates reading time", () => {
    expect(getReadingTime("a ".repeat(200))).toBe(1);
  });
  it("gets table of contents", () => {
    const toc = getTableOfContents("# Title\n## Sub");
    expect(toc.length).toBe(2);
  });
  it("gets stats", () => {
    const stats = getMarkdownStats("# Hello\nThis is text");
    expect(stats.headers).toBe(1);
    expect(stats.words).toBe(3);
  });
});
