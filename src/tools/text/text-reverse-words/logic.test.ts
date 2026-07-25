import { describe, it, expect } from "vitest";
import { reverseWords, reverseLine, tokenizeLine, validateOptions, DEFAULT_OPTIONS } from "./logic";

describe("tokenizeLine", () => {
  it("splits words and whitespace", () => {
    expect(tokenizeLine("hello world", true)).toEqual(["hello", " ", "world"]);
  });
  it("preserves punctuation when keepPunctuation=true", () => {
    expect(tokenizeLine("hello, world!", true)).toEqual(["hello,", " ", "world!"]);
  });
  it("returns empty array for empty string", () => {
    expect(tokenizeLine("", true)).toEqual([]);
  });
  it("handles leading whitespace", () => {
    expect(tokenizeLine("  hi", true)).toEqual(["  ", "hi"]);
  });
});

describe("reverseLine", () => {
  it("reverses word order preserving single space", () => {
    expect(reverseLine("hello world", DEFAULT_OPTIONS)).toBe("world hello");
  });
  it("preserves leading whitespace when preserveEdges=true", () => {
    expect(reverseLine("  hello world", DEFAULT_OPTIONS)).toBe("  world hello");
  });
  it("trims edges when preserveEdges=false", () => {
    const r = reverseLine("  hello world  ", { preserveEdges: false, keepPunctuation: true });
    expect(r).toBe("world hello");
  });
  it("handles single word", () => {
    expect(reverseLine("hello", DEFAULT_OPTIONS)).toBe("hello");
  });
  it("handles empty line", () => {
    expect(reverseLine("", DEFAULT_OPTIONS)).toBe("");
  });
});

describe("reverseWords", () => {
  it("reverses each line independently", () => {
    expect(reverseWords("a b\nc d", DEFAULT_OPTIONS)).toBe("b a\nd c");
  });
  it("returns empty for empty input", () => {
    expect(reverseWords("", DEFAULT_OPTIONS)).toBe("");
  });
  it("preserves blank lines", () => {
    expect(reverseWords("a b\n\nc d", DEFAULT_OPTIONS)).toBe("b a\n\nd c");
  });
});

describe("validateOptions", () => {
  it("fills defaults", () => {
    expect(validateOptions({})).toEqual(DEFAULT_OPTIONS);
  });
  it("respects provided values", () => {
    expect(validateOptions({ preserveEdges: false })).toEqual({ preserveEdges: false, keepPunctuation: true });
  });
});
