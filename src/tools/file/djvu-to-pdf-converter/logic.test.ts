/**
 * djvu-to-pdf-converter — unit tests.
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
});

describe("formatLog", () => {
  it("formats log entries", () => {
    const s = formatLog(["Started", "Done"]);
    expect(s).toContain("Started");
    expect(s).toContain("Done");
  });
});

describe("summarizeResult", () => {
  it("summarizes successful conversion", () => {
    const s = summarizeResult({ success: true, inputSize: 100, outputSize: 200, warnings: [], log: ["done"], pageCount: 5 });
    expect(s).toContain("Success: YES");
    expect(s).toContain("Pages: 5");
  });
});
