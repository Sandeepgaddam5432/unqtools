/**
 * Text Sorter — unit tests.
 */
import { describe, it, expect } from "vitest";
import { sortText, naturalCompare, statsToCsv, type SortOptions } from "./logic";

describe("naturalCompare", () => {
  it("sorts numerically within strings", () => {
    expect(naturalCompare("file2", "file10")).toBeLessThan(0);
    expect(naturalCompare("file10", "file2")).toBeGreaterThan(0);
  });
  it("sorts alphabetically when no digits", () => {
    expect(naturalCompare("abc", "abd")).toBeLessThan(0);
  });
  it("returns 0 for identical strings", () => {
    expect(naturalCompare("file10", "file10")).toBe(0);
  });
});

describe("sortText — alphabetical lines", () => {
  it("sorts lines alphabetically", () => {
    const r = sortText("banana\napple\ncherry", { unit: "lines", by: "alphabetical" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("apple\nbanana\ncherry");
  });
  it("reverse alphabetical", () => {
    const r = sortText("banana\napple\ncherry", { unit: "lines", by: "alphabetical", reverse: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("cherry\nbanana\napple");
  });
  it("case-insensitive", () => {
    const r = sortText("Banana\napple\nCherry", { unit: "lines", by: "alphabetical", caseInsensitive: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output.split("\n")[0]).toBe("apple");
  });
});

describe("sortText — numeric", () => {
  it("sorts numbers numerically", () => {
    const r = sortText("10\n2\n1\n20", { unit: "lines", by: "numeric" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("1\n2\n10\n20");
  });
  it("handles non-numeric gracefully", () => {
    const r = sortText("abc\n10\nxyz", { unit: "lines", by: "numeric" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toContain("10");
  });
});

describe("sortText — natural", () => {
  it("sorts file names naturally", () => {
    const r = sortText("file10\nfile2\nfile1", { unit: "lines", by: "natural" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("file1\nfile2\nfile10");
  });
});

describe("sortText — length", () => {
  it("sorts by length", () => {
    const r = sortText("aaa\nb\ncc", { unit: "lines", by: "length" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("b\ncc\naaa");
  });
});

describe("sortText — words", () => {
  it("sorts words alphabetically", () => {
    const r = sortText("banana apple cherry", { unit: "words", by: "alphabetical" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("apple banana cherry");
  });
});

describe("sortText — paragraphs", () => {
  it("sorts paragraphs alphabetically", () => {
    const r = sortText("banana para\n\napple para\n\ncherry para", { unit: "paragraphs", by: "alphabetical" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output.split("\n\n")[0]).toBe("apple para");
  });
});

describe("sortText — duplicates", () => {
  it("removes duplicates", () => {
    const r = sortText("apple\nbanana\napple\ncherry", { unit: "lines", by: "alphabetical", removeDuplicates: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("apple\nbanana\ncherry");
    expect(r.duplicatesRemoved).toBe(1);
  });
  it("removes duplicates case-insensitively", () => {
    const r = sortText("Apple\napple", { unit: "lines", by: "alphabetical", removeDuplicates: true, caseInsensitive: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.outputCount).toBe(1);
  });
});

describe("sortText — keepEmpty", () => {
  it("removes empty lines by default", () => {
    const r = sortText("apple\n\nbanana", { unit: "lines", by: "alphabetical" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("apple\nbanana");
  });
  it("keeps empty lines when keepEmpty=true", () => {
    const r = sortText("apple\n\nbanana", { unit: "lines", by: "alphabetical", keepEmpty: true });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("\napple\nbanana");
  });
});

describe("sortText — empty input", () => {
  it("returns empty output", () => {
    const r = sortText("", { unit: "lines", by: "alphabetical" });
    if ("error" in r) throw new Error("Should not error");
    expect(r.output).toBe("");
  });
});

describe("statsToCsv", () => {
  it("generates stats CSV", () => {
    const r = sortText("b\na", { unit: "lines", by: "alphabetical" });
    if ("error" in r) throw new Error("Should not error");
    const csv = statsToCsv(r, { unit: "lines", by: "alphabetical" });
    expect(csv).toContain("Field,Value");
    expect(csv).toContain("alphabetical");
    expect(csv).toContain("InputCount,2");
  });
});
