import { describe, expect, it } from "vitest";
import { replaceInStringLiteral, replaceInContentStream } from "./logic";

describe("replaceInStringLiteral", () => {
  it("replaces occurrences", () => {
    expect(replaceInStringLiteral("hello world hello", "hello", "hi", true)).toEqual({
      text: "hi world hi",
      count: 2,
    });
  });

  it("case-insensitive mode", () => {
    expect(replaceInStringLiteral("Hello HELLO", "hello", "X", false).count).toBe(2);
    expect(replaceInStringLiteral("Hello", "hello", "X", true).count).toBe(0);
  });

  it("no match returns original", () => {
    expect(replaceInStringLiteral("abc", "xyz", "q", true)).toEqual({ text: "abc", count: 0 });
  });
});

describe("replaceInContentStream", () => {
  it("replaces inside paren strings", () => {
    const { body, count } = replaceInContentStream("BT (old text) Tj (keep) Tj ET", "old", "new", true);
    expect(count).toBe(1);
    expect(body).toContain("(new text)");
    expect(body).toContain("(keep)");
  });

  it("replaces inside hex strings", () => {
    const hex = "48656c6c6f"; // "Hello"
    const { body, count } = replaceInContentStream(`BT <${hex}> Tj ET`, "Hello", "Hi", true);
    expect(count).toBe(1);
    expect(body).toContain("<4869>"); // "Hi"
  });

  it("leaves non-matching streams alone", () => {
    const { count } = replaceInContentStream("BT (nothing here) Tj ET", "zzz", "x", true);
    expect(count).toBe(0);
  });
});
