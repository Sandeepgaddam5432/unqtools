import { describe, it, expect } from "vitest";
import {
  computeDiff,
  getDiffStats,
  toUnifiedPatch,
  DEFAULT_OPTIONS,
  type DiffOptions,
} from "./logic";

function opts(o: Partial<DiffOptions>): DiffOptions {
  return { ...DEFAULT_OPTIONS, ...o };
}

describe("computeDiff — line level", () => {
  it("returns empty for two empty strings", () => {
    expect(computeDiff("", "", opts({}))).toEqual([]);
  });

  it("returns all equal for identical text", () => {
    const lines = computeDiff("a\nb\nc", "a\nb\nc", opts({}));
    expect(lines.every((l) => l.type === "equal")).toBe(true);
    expect(lines.length).toBe(3);
  });

  it("detects additions", () => {
    const lines = computeDiff("a\nb", "a\nb\nc", opts({}));
    expect(lines.some((l) => l.type === "add" && l.content === "c")).toBe(true);
  });

  it("detects deletions", () => {
    const lines = computeDiff("a\nb\nc", "a\nb", opts({}));
    expect(lines.some((l) => l.type === "del" && l.content === "c")).toBe(true);
  });

  it("detects changes (adjacent del+add)", () => {
    const lines = computeDiff("hello", "world", opts({}));
    expect(lines.some((l) => l.type === "del")).toBe(true);
    expect(lines.some((l) => l.type === "add")).toBe(true);
  });

  it("assigns correct line numbers", () => {
    const lines = computeDiff("a\nb\nc", "a\nx\nc", opts({}));
    const equalBefore = lines[0]!;
    const del = lines.find((l) => l.type === "del")!;
    const add = lines.find((l) => l.type === "add")!;
    expect(equalBefore.oldNumber).toBe(1);
    expect(equalBefore.newNumber).toBe(1);
    expect(del.oldNumber).toBe(2);
    expect(del.newNumber).toBe(null);
    expect(add.oldNumber).toBe(null);
    expect(add.newNumber).toBe(2);
  });
});

describe("computeDiff — options", () => {
  it("ignores whitespace when enabled", () => {
    const lines = computeDiff("a  b", "a b", opts({ ignoreWhitespace: true }));
    expect(lines.every((l) => l.type === "equal")).toBe(true);
  });

  it("ignores case when enabled", () => {
    const lines = computeDiff("Hello", "hello", opts({ ignoreCase: true }));
    expect(lines.every((l) => l.type === "equal")).toBe(true);
  });

  it("trims lines when enabled", () => {
    const lines = computeDiff("  a  ", "a", opts({ trimLines: true }));
    expect(lines.every((l) => l.type === "equal")).toBe(true);
  });
});

describe("computeDiff — word/char inline", () => {
  it("computes word-level inline diff for changed lines", () => {
    const lines = computeDiff("the quick fox", "the slow fox", opts({ granularity: "word" }));
    const del = lines.find((l) => l.type === "del");
    const add = lines.find((l) => l.type === "add");
    expect(del?.inlineParts).toBeDefined();
    expect(add?.inlineParts).toBeDefined();
  });

  it("computes char-level inline diff for changed lines", () => {
    const lines = computeDiff("cat", "cot", opts({ granularity: "char" }));
    const del = lines.find((l) => l.type === "del");
    expect(del?.inlineParts?.some((p) => p.type === "del" && p.text === "a")).toBe(true);
  });
});

describe("getDiffStats", () => {
  it("counts additions and deletions", () => {
    const lines = computeDiff("a\nb\nc", "a\nx\ny", opts({}));
    const stats = getDiffStats(lines);
    expect(stats.additions).toBe(2);
    expect(stats.deletions).toBe(2);
  });

  it("counts changes (adjacent del+add pairs)", () => {
    const lines = computeDiff("a\nb", "a\nx", opts({}));
    const stats = getDiffStats(lines);
    expect(stats.changes).toBe(1);
  });

  it("returns zeros for identical text", () => {
    const lines = computeDiff("abc", "abc", opts({}));
    const stats = getDiffStats(lines);
    expect(stats.additions).toBe(0);
    expect(stats.deletions).toBe(0);
    expect(stats.changes).toBe(0);
  });
});

describe("toUnifiedPatch", () => {
  it("generates a valid unified diff", () => {
    const patch = toUnifiedPatch("a\nb\nc", "a\nx\nc", opts({}));
    expect(patch).toContain("--- original");
    expect(patch).toContain("+++ modified");
    expect(patch).toContain("@@");
    expect(patch).toContain("-b");
    expect(patch).toContain("+x");
  });

  it("returns empty string for identical text", () => {
    expect(toUnifiedPatch("abc", "abc", opts({}))).toBe("");
  });
});

describe("computeDiff — edge cases", () => {
  it("handles CRLF line endings", () => {
    const lines = computeDiff("a\r\nb", "a\r\nx", opts({}));
    expect(lines.some((l) => l.type === "del")).toBe(true);
    expect(lines.some((l) => l.type === "add")).toBe(true);
  });

  it("handles Unicode text", () => {
    const lines = computeDiff("你好\n世界", "你好\n世界2", opts({}));
    expect(lines.some((l) => l.type === "del")).toBe(true);
    expect(lines.some((l) => l.type === "add")).toBe(true);
  });

  it("handles completely different text", () => {
    const lines = computeDiff("abc", "xyz", opts({}));
    expect(lines[0]!.type).toBe("del");
    expect(lines[1]!.type).toBe("add");
  });

  it("handles one empty side", () => {
    const lines1 = computeDiff("", "abc", opts({}));
    expect(lines1.some((l) => l.type === "add" && l.content === "abc")).toBe(true);
    const lines2 = computeDiff("abc", "", opts({}));
    expect(lines2.some((l) => l.type === "del" && l.content === "abc")).toBe(true);
  });

  it("handles 10K-line input (performance smoke)", () => {
    const a = Array.from({ length: 10000 }, (_, i) => `line ${i}`).join("\n");
    const b = a.replace("line 5000", "line 5000 modified");
    const start = Date.now();
    const lines = computeDiff(a, b, opts({}));
    const elapsed = Date.now() - start;
    expect(lines.length).toBeGreaterThan(0);
    // Should complete in under 5 seconds
    expect(elapsed).toBeLessThan(5000);
  });
});
