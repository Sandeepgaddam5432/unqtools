import { describe, it, expect } from "vitest";
import { firstVowelIndex, translateWord, toPigLatin, fromPigLatin, fromPigLatinText, validateSuffix } from "./logic";

describe("firstVowelIndex", () => {
  it("returns 0 for vowel-leading word", () => {
    expect(firstVowelIndex("apple")).toBe(0);
  });
  it("returns index of first vowel", () => {
    expect(firstVowelIndex("hello")).toBe(1);
  });
  it("treats y as vowel after first letter", () => {
    expect(firstVowelIndex("rhythm")).toBeGreaterThan(0);
  });
});

describe("translateWord", () => {
  it("adds 'ay' to vowel-leading words when suffix=ay", () => {
    expect(translateWord("apple", "ay")).toBe("appleay");
  });
  it("moves consonant cluster to end + ay", () => {
    expect(translateWord("string", "ay")).toBe("ingstray");
  });
  it("handles single consonant", () => {
    expect(translateWord("hello", "ay")).toBe("ellohay");
  });
  it("preserves case", () => {
    expect(translateWord("Hello", "ay")).toBe("Ellohay");
  });
  it("preserves punctuation", () => {
    expect(translateWord("hello!", "ay")).toBe("ellohay!");
  });
});

describe("toPigLatin", () => {
  it("translates a sentence", () => {
    expect(toPigLatin("hello world", "ay")).toBe("ellohay orldway");
  });
  it("handles empty string", () => {
    expect(toPigLatin("", "ay")).toBe("");
  });
});

describe("fromPigLatin", () => {
  it("reverses consonant-cluster words", () => {
    expect(fromPigLatin("ellohay")).toBe("hello");
  });
  it("reverses vowel-leading words with 'way'", () => {
    expect(fromPigLatin("appleway")).toBe("apple");
  });
  it("reverses 'yay' suffix", () => {
    expect(fromPigLatin("appleyay")).toBe("apple");
  });
});

describe("fromPigLatinText", () => {
  it("reverses a sentence", () => {
    expect(fromPigLatinText("ellohay appleyay")).toBe("hello apple");
  });
  it("handles empty string", () => {
    expect(fromPigLatinText("")).toBe("");
  });
});

describe("validateSuffix", () => {
  it("accepts ay", () => {
    expect(validateSuffix("ay")).toEqual({ ok: true, suffix: "ay" });
  });
  it("rejects unknown", () => {
    expect(validateSuffix("xyz")).toHaveProperty("error");
  });
});
