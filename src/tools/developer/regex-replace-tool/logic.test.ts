import { describe, it, expect } from "vitest";
import { regexReplace, escapeRegex, validateRegex, getCommonPatterns } from "./logic";

describe("Regex Replace", () => {
  it("replaces simple pattern", () => {
    const result = regexReplace("hello world", "world", { flags: "g", replacement: "there", useFunction: false });
    expect(result.output).toBe("hello there");
    expect(result.matchCount).toBe(1);
  });
  it("replaces with capture groups", () => {
    const result = regexReplace("John Doe", "(\\w+) (\\w+)", { flags: "g", replacement: "$2, $1", useFunction: true });
    expect(result.output).toContain("Doe");
  });
  it("escapes regex special chars", () => {
    expect(escapeRegex("a.b*c")).toBe("a\\.b\\*c");
  });
  it("validates regex", () => {
    expect(validateRegex("abc", "g").valid).toBe(true);
    expect(validateRegex("[", "g").valid).toBe(false);
  });
  it("lists common patterns", () => {
    expect(getCommonPatterns().length).toBeGreaterThan(0);
  });
});
