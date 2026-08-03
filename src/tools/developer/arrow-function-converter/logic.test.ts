import { describe, it, expect } from "vitest";
import { convert, getStats } from "./logic";

describe("Arrow Function Converter", () => {
  it("converts function declaration to arrow", () => {
    const r = convert("function add(a, b) {", "to-arrow");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toContain("=>");
    expect(r.output).toContain("const add");
  });
  it("converts arrow to function declaration", () => {
    const r = convert("const add = (a, b) => {", "to-function");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.output).toContain("function add");
  });
  it("fails on empty input", () => {
    expect(convert("", "to-arrow").ok).toBe(false);
  });
  it("handles no-params", () => {
    const r = convert("function init() {", "to-arrow");
    if (!r.ok) return;
    expect(r.output).toContain("() =>");
  });
  it("gets stats", () => {
    const s = getStats("function foo() {}\nconst bar = () => {}");
    expect(s.functionCount).toBeGreaterThanOrEqual(1);
    expect(s.arrowCount).toBe(1);
  });
});
