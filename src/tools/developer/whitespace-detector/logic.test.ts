import { describe, it, expect } from "vitest";
import { detect, cleanWhitespace, getInvisibleChars } from "./logic";

describe("Whitespace Detector", () => {
  it("detects zero-width spaces", () => {
    const issues = detect("hello\u200Bworld");
    expect(issues.length).toBe(1);
    expect(issues[0].name).toContain("Zero-width");
  });
  it("detects BOM", () => {
    const issues = detect("\uFEFFhello");
    expect(issues.some(i => i.name.includes("BOM"))).toBe(true);
  });
  it("detects non-breaking spaces", () => {
    const issues = detect("hello\u00A0world");
    expect(issues.some(i => i.name.includes("Non-breaking"))).toBe(true);
  });
  it("cleans zero-width chars", () => {
    const cleaned = cleanWhitespace("hello\u200Bworld", { normalizeSpaces: false, removeZeroWidth: true, removeBom: false, normalizeLineEndings: false });
    expect(cleaned).toBe("helloworld");
  });
  it("removes BOM", () => {
    const cleaned = cleanWhitespace("\uFEFFhello", { normalizeSpaces: false, removeZeroWidth: false, removeBom: true, normalizeLineEndings: false });
    expect(cleaned).toBe("hello");
  });
  it("lists invisible chars", () => {
    expect(getInvisibleChars().length).toBeGreaterThan(5);
  });
});
