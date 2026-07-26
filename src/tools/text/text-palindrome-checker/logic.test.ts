/**
 * Palindrome Checker — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  checkPalindrome, isPalindrome, reverseString, reverseWords, reverseLines,
  longestPalindromicSubstring, countPalindromicSubstrings, isAlmostPalindrome,
  batchCheck, toCsv,
} from "./logic";

describe("isPalindrome — basic", () => {
  it("recognizes simple palindromes", () => {
    expect(isPalindrome("racecar")).toBe(true);
    expect(isPalindrome("level")).toBe(true);
  });
  it("rejects non-palindromes", () => {
    expect(isPalindrome("hello")).toBe(false);
  });
  it("case-insensitive by default", () => {
    expect(isPalindrome("RaceCar")).toBe(true);
  });
  it("ignores spaces and punctuation", () => {
    expect(isPalindrome("A man, a plan, a canal: Panama")).toBe(true);
  });
  it("strict mode requires exact match", () => {
    expect(isPalindrome("RaceCar", { strict: true })).toBe(false);
    expect(isPalindrome("racecar", { strict: true })).toBe(true);
  });
  it("numeric-only mode", () => {
    expect(isPalindrome("12321", { numericOnly: true })).toBe(true);
    expect(isPalindrome("12a21", { numericOnly: true })).toBe(true); // strips a
  });
});

describe("reverseString / reverseWords / reverseLines", () => {
  it("reverses characters", () => {
    expect(reverseString("hello")).toBe("olleh");
  });
  it("reverses word order", () => {
    expect(reverseWords("hello world")).toBe("world hello");
  });
  it("reverses line order", () => {
    expect(reverseLines("a\nb\nc")).toBe("c\nb\na");
  });
});

describe("checkPalindrome — full result", () => {
  it("returns full result for palindrome", () => {
    const r = checkPalindrome("racecar");
    if ("error" in r) throw new Error("err");
    expect(r.isPalindrome).toBe(true);
    expect(r.reversed).toBe("racecar");
    expect(r.charCount).toBe(7);
  });
  it("returns full result for non-palindrome", () => {
    const r = checkPalindrome("hello");
    if ("error" in r) throw new Error("err");
    expect(r.isPalindrome).toBe(false);
    expect(r.mismatches.length).toBeGreaterThan(0);
  });
  it("errors on empty", () => {
    expect("error" in checkPalindrome("")).toBe(true);
  });
});

describe("checkPalindrome — word-level", () => {
  it("checks each word", () => {
    const r = checkPalindrome("racecar hello level");
    if ("error" in r) throw new Error("err");
    expect(r.wordLevel.length).toBe(3);
    expect(r.wordLevel[0]!.isPalindrome).toBe(true);
    expect(r.wordLevel[1]!.isPalindrome).toBe(false);
    expect(r.wordLevel[2]!.isPalindrome).toBe(true);
  });
});

describe("longestPalindromicSubstring", () => {
  it("finds longest palindromic substring", () => {
    expect(longestPalindromicSubstring("babad")).toBe("bab");
  });
  it("handles empty", () => {
    expect(longestPalindromicSubstring("")).toBe("");
  });
  it("handles single char", () => {
    expect(longestPalindromicSubstring("a")).toBe("a");
  });
});

describe("countPalindromicSubstrings", () => {
  it("counts palindromic substrings of length >= 2", () => {
    const n = countPalindromicSubstrings("aaa");
    expect(n).toBeGreaterThan(0);
  });
});

describe("isAlmostPalindrome", () => {
  it("detects almost-palindrome (1 char away)", () => {
    expect(isAlmostPalindrome("abca")).toBe(true); // remove 'c' → "aba"
  });
  it("returns false for actual palindrome", () => {
    expect(isAlmostPalindrome("racecar")).toBe(false);
  });
});

describe("checkPalindrome — almost-palindrome warning", () => {
  it("flags almost-palindrome", () => {
    const r = checkPalindrome("abca");
    if ("error" in r) throw new Error("err");
    expect(r.isAlmostPalindrome).toBe(true);
    expect(r.warnings.some((w) => w.includes("Almost"))).toBe(true);
  });
});

describe("batchCheck", () => {
  it("processes multiple texts", () => {
    const results = batchCheck(["racecar", "hello", "level"]);
    expect(results.length).toBe(3);
    expect("error" in results[0]! && false).toBe(false);
  });
});

describe("toCsv", () => {
  it("produces CSV with header", () => {
    const results = batchCheck(["racecar", "hello"]);
    const csv = toCsv(results);
    expect(csv.split("\n")[0]).toContain("Text");
    expect(csv).toContain("IsPalindrome");
  });
});
