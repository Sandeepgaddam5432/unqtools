import { describe, it, expect } from "vitest";
import { diff, diffStats, diffPercentage } from "./logic";

describe("diff — line mode", () => {
  it("detects no changes", () => {
    const parts = diff("a\nb\nc", "a\nb\nc", "line");
    expect(parts.every((p) => p.type === "equal")).toBe(true);
  });
  it("detects added lines", () => {
    const parts = diff("a\nb", "a\nb\nc", "line");
    expect(parts.some((p) => p.type === "add" && p.text.includes("c"))).toBe(true);
  });
  it("detects deleted lines", () => {
    const parts = diff("a\nb\nc", "a\nb", "line");
    expect(parts.some((p) => p.type === "del" && p.text.includes("c"))).toBe(true);
  });
  it("detects changed lines", () => {
    const parts = diff("hello", "world", "line");
    expect(parts.some((p) => p.type === "del")).toBe(true);
    expect(parts.some((p) => p.type === "add")).toBe(true);
  });
});

describe("diff — word mode", () => {
  it("detects word-level changes", () => {
    const parts = diff("the quick fox", "the slow fox", "word");
    expect(parts.some((p) => p.type === "del" && p.text.includes("quick"))).toBe(true);
    expect(parts.some((p) => p.type === "add" && p.text.includes("slow"))).toBe(true);
    expect(parts.some((p) => p.type === "equal" && p.text.includes("fox"))).toBe(true);
  });
});

describe("diff — char mode", () => {
  it("detects char-level changes", () => {
    const parts = diff("cat", "cot", "char");
    expect(parts.some((p) => p.type === "del" && p.text === "a")).toBe(true);
    expect(parts.some((p) => p.type === "add" && p.text === "o")).toBe(true);
  });
});

describe("diffStats", () => {
  it("counts additions and deletions", () => {
    const parts = diff("abc", "axc", "char");
    const stats = diffStats(parts);
    expect(stats.additions).toBeGreaterThan(0);
    expect(stats.deletions).toBeGreaterThan(0);
  });
});

describe("diffPercentage", () => {
  it("returns 0 for identical text", () => {
    expect(diffPercentage(diff("abc", "abc", "char"))).toBe(0);
  });
  it("returns 100 for completely different text", () => {
    expect(diffPercentage(diff("abc", "xyz", "char"))).toBe(100);
  });
});

describe("diff — edge cases", () => {
  it("handles empty inputs", () => {
    expect(diff("", "", "line")).toEqual([]);
    expect(diff("a", "", "line").some((p) => p.type === "del")).toBe(true);
    expect(diff("", "a", "line").some((p) => p.type === "add")).toBe(true);
  });
  it("handles huge input (10K lines)", () => {
    const a = Array.from({ length: 10000 }, (_, i) => `line${i}`).join("\n");
    const b = a + "\nnew line";
    const parts = diff(a, b, "line");
    expect(parts.length).toBeGreaterThan(0);
  });
  it("handles Unicode", () => {
    const parts = diff("你好", "你好世界", "char");
    expect(parts.some((p) => p.type === "add" && p.text.includes("世"))).toBe(true);
  });
});
