/**
 * XPS to PDF Converter — unit tests.
 */
import { describe, it, expect } from "vitest";
import { generateXpsXml, summarizeResult } from "./logic";

describe("generateXpsXml", () => {
  it("generates XPS XML", () => {
    const xml = generateXpsXml("Hello world", "Title", "Author");
    expect(xml).toContain("FixedDocument");
    expect(xml).toContain("Title");
    expect(xml).toContain("Hello world");
  });
  it("escapes HTML entities", () => {
    const xml = generateXpsXml("a < b > c", "T", "A");
    expect(xml).toContain("&lt;");
    expect(xml).toContain("&gt;");
  });
});

describe("summarizeResult", () => {
  it("summarizes conversion", () => {
    const s = summarizeResult({ success: true, inputSize: 100, outputSize: 200, warnings: [], log: ["done"], pageCount: 1 });
    expect(s).toContain("Success: YES");
  });
});
