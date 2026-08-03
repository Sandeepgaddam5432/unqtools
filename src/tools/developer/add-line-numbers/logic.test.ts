import { describe, it, expect } from "vitest";
import { addLineNumbers, removeLineNumbers, getStats } from "./logic";

describe("Add Line Numbers", () => {
  it("adds default line numbers", () => {
    const r = addLineNumbers("a\nb\nc");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toBe("1 a\n2 b\n3 c");
  });
  it("uses custom start and step", () => {
    const r = addLineNumbers("a\nb", { start: 10, step: 5 });
    if (!r.ok) return;
    expect(r.output).toBe("10 a\n15 b");
  });
  it("pads numbers", () => {
    const r = addLineNumbers("a\nb", { padding: 3 });
    if (!r.ok) return;
    expect(r.output).toContain("001");
  });
  it("uses bracket format", () => {
    const r = addLineNumbers("a", { format: "brackets" });
    if (!r.ok) return;
    expect(r.output).toBe("[1] a");
  });
  it("skips empty lines", () => {
    const r = addLineNumbers("a\n\nb", { skipEmpty: true });
    if (!r.ok) return;
    expect(r.output).toBe("1 a\n\n2 b");
  });
  it("places numbers after", () => {
    const r = addLineNumbers("a", { position: "after" });
    if (!r.ok) return;
    expect(r.output).toBe("a 1");
  });
  it("fails on empty input", () => {
    expect(addLineNumbers("").ok).toBe(false);
  });
  it("removes line numbers", () => {
    const r = removeLineNumbers("1 a\n2 b\n3 c");
    if (!r.ok) return;
    expect(r.output).toBe("a\nb\nc");
  });
  it("gets stats", () => {
    const s = getStats("hello\nworld\n");
    expect(s.lineCount).toBe(3);
    expect(s.wordCount).toBe(2);
  });
});
