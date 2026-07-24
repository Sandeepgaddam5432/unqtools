/**
 * AZW3 to PDF Converter — unit tests.
 */
import { describe, it, expect } from "vitest";
import { paginateText, formatLog, summarizeResult } from "./logic";

describe("paginateText", () => {
  it("splits text into pages", () => {
    const text = "Hello world\nThis is line two\nAnd line three".repeat(100);
    const pages = paginateText(text, { pageSize: "a4", margin: 50, fontSize: 12 });
    expect(pages.length).toBeGreaterThan(1);
  });
  it("returns at least one page for short text", () => {
    const pages = paginateText("Short text", { pageSize: "a4", margin: 50, fontSize: 12 });
    expect(pages.length).toBeGreaterThanOrEqual(1);
  });
  it("respects page size", () => {
    const text = "word ".repeat(5000);
    const a4 = paginateText(text, { pageSize: "a4", margin: 50, fontSize: 12 });
    const letter = paginateText(text, { pageSize: "letter", margin: 50, fontSize: 12 });
    expect(a4.length).not.toBe(letter.length);
  });
});

describe("formatLog", () => {
  it("formats log entries", () => {
    const s = formatLog(["Started", "Loaded file", "Done"]);
    expect(s).toContain("1. Started");
    expect(s).toContain("2. Loaded file");
    expect(s).toContain("3. Done");
  });
});

describe("summarizeResult", () => {
  it("summarizes successful conversion", () => {
    const s = summarizeResult({
      success: true,
      inputSize: 1000,
      outputSize: 2000,
      warnings: [],
      log: ["done"],
      pageCount: 5,
    });
    expect(s).toContain("Success: YES");
    expect(s).toContain("Pages: 5");
  });
});
