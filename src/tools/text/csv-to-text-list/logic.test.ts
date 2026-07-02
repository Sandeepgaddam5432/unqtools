import { describe, it, expect } from "vitest";
import { csvToList, DEFAULT_OPTIONS, type CsvToListOptions } from "./logic";

function opts(o: Partial<CsvToListOptions>): CsvToListOptions {
  return { ...DEFAULT_OPTIONS, ...o };
}

describe("csvToList", () => {
  it("extracts a single column", () => {
    expect(csvToList("a,1\nb,2", opts({ column: 0 }))).toBe("a\nb");
  });
  it("extracts second column", () => {
    expect(csvToList("a,1\nb,2", opts({ column: 1 }))).toBe("1\n2");
  });
  it("flattens all columns when column = -1", () => {
    expect(csvToList("a,b\n1,2", opts({ column: -1 }))).toBe("a\nb\n1\n2");
  });
  it("joins with custom delimiter", () => {
    expect(csvToList("a,b,c", opts({ column: -1, delimiter: ", " }))).toBe("a, b, c");
  });
  it("wraps in quotes", () => {
    expect(csvToList("a,b", opts({ column: -1, quote: '"' }))).toBe('"a"\n"b"');
  });
  it("adds prefix/suffix", () => {
    expect(csvToList("a,b", opts({ column: -1, prefix: "[", suffix: "]" }))).toBe("[a]\n[b]");
  });
  it("dedupes", () => {
    expect(csvToList("a\na\nb", opts({ column: 0, dedupe: true }))).toBe("a\nb");
  });
  it("dedupes case-insensitive", () => {
    expect(csvToList("a\nA\nb", opts({ column: 0, dedupe: true, caseSensitive: false }))).toBe(
      "a\nb",
    );
  });
  it("trims items", () => {
    expect(csvToList("  a  , b", opts({ column: -1, trim: true }))).toBe("a\nb");
  });
  it("skips empty", () => {
    expect(csvToList("a,,b", opts({ column: -1, skipEmpty: true }))).toBe("a\nb");
  });
  it("handles empty input", () => {
    expect(csvToList("", opts({}))).toBe("");
  });
  it("handles huge input (10K rows)", () => {
    const input = "a\n".repeat(10000);
    expect(csvToList(input, opts({ column: 0 })).split("\n").length).toBe(10000);
  });
  it("handles quoted CSV fields", () => {
    expect(csvToList('"a,b",c', opts({ column: -1 }))).toBe("a,b\nc");
  });
  it("handles Unicode", () => {
    expect(csvToList("名前,年齢", opts({ column: -1 }))).toBe("名前\n年齢");
  });
});
