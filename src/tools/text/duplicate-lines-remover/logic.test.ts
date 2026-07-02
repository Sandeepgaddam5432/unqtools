import { describe, it, expect } from "vitest";
import { removeDuplicateLines, DEFAULT_OPTIONS, type DedupeOptions } from "./logic";

function opts(o: Partial<DedupeOptions>): DedupeOptions {
  return { ...DEFAULT_OPTIONS, ...o };
}

describe("removeDuplicateLines — basic", () => {
  it("removes exact duplicates, keeping first", () => {
    const r = removeDuplicateLines("a\nb\na\nc", opts({ keep: "first" }));
    expect(r.output).toBe("a\nb\nc");
    expect(r.removedCount).toBe(1);
  });
  it("keeps last occurrence when keep=last", () => {
    const r = removeDuplicateLines("a\nb\nA\nc", opts({ keep: "last", caseSensitive: false }));
    // "a" and "A" are duplicates (case-insensitive); keep=last means "A" replaces "a" at position 0
    expect(r.output).toBe("A\nb\nc");
  });
  it("preserves order when no sort", () => {
    const r = removeDuplicateLines("c\nb\na", opts({}));
    expect(r.output).toBe("c\nb\na");
  });
});

describe("removeDuplicateLines — case sensitivity", () => {
  it("case-sensitive by default", () => {
    const r = removeDuplicateLines("a\nA\na", opts({}));
    expect(r.remainingCount).toBe(2);
  });
  it("case-insensitive when toggled", () => {
    const r = removeDuplicateLines("a\nA\na", opts({ caseSensitive: false }));
    expect(r.remainingCount).toBe(1);
  });
});

describe("removeDuplicateLines — trim", () => {
  it("trims before comparing", () => {
    const r = removeDuplicateLines("a\n a \na", opts({ trim: true }));
    expect(r.remainingCount).toBe(1);
  });
});

describe("removeDuplicateLines — sort", () => {
  it("sorts alphabetically", () => {
    const r = removeDuplicateLines("c\na\nb", opts({ sort: true, sortMode: "alphabetical" }));
    expect(r.output).toBe("a\nb\nc");
  });
  it("sorts by length", () => {
    const r = removeDuplicateLines("aaa\na\naa", opts({ sort: true, sortMode: "length" }));
    expect(r.output).toBe("a\naa\naaa");
  });
  it("sorts numerically", () => {
    const r = removeDuplicateLines("10\n2\n1", opts({ sort: true, sortMode: "numeric" }));
    expect(r.output).toBe("1\n2\n10");
  });
});

describe("removeDuplicateLines — edge cases", () => {
  it("handles empty input", () => {
    const r = removeDuplicateLines("", opts({}));
    expect(r.output).toBe("");
    expect(r.removedCount).toBe(0);
  });
  it("handles single line", () => {
    const r = removeDuplicateLines("hello", opts({}));
    expect(r.output).toBe("hello");
  });
  it("handles all duplicates", () => {
    const r = removeDuplicateLines("a\na\na", opts({}));
    expect(r.output).toBe("a");
    expect(r.removedCount).toBe(2);
  });
  it("handles huge input (10K lines)", () => {
    const input = Array.from({ length: 10000 }, (_, i) => `line${i % 100}`).join("\n");
    const r = removeDuplicateLines(input, opts({}));
    expect(r.remainingCount).toBe(100);
  });
  it("handles CRLF", () => {
    const r = removeDuplicateLines("a\r\nb\r\na", opts({}));
    expect(r.output).toBe("a\nb");
  });
  it("handles Unicode", () => {
    const r = removeDuplicateLines("你好\n世界\n你好", opts({}));
    expect(r.remainingCount).toBe(2);
  });
  it("reports removed lines", () => {
    const r = removeDuplicateLines("a\nb\na", opts({}));
    expect(r.removedLines).toEqual(["a"]);
  });
});
