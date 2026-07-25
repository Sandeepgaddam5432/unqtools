import { describe, it, expect } from "vitest";
import {
  reverseWords,
  reverseLine,
  reverseBySentence,
  reverseAllWords,
  reverseCharsInWords,
  tokenizeLine,
  tokenizeWithDelimiter,
  splitSentences,
  validateOptions,
  isIdentity,
  batchValidate,
  textStats,
  sentenceCount,
  wordCount,
  findPreset,
  PRESETS,
  DEFAULT_OPTIONS,
  type ReverseWordsOptions,
} from "./logic";

const OPTS: ReverseWordsOptions = DEFAULT_OPTIONS;

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

describe("tokenizeWithDelimiter", () => {
  it("falls back to default when delimiter is empty", () => {
    expect(tokenizeWithDelimiter("hello world", "")).toEqual(["hello", " ", "world"]);
  });
  it("splits on custom delimiter", () => {
    expect(tokenizeWithDelimiter("a,b,c", ",")).toEqual(["a", ",", "b", ",", "c"]);
  });
  it("falls back on invalid regex", () => {
    expect(tokenizeWithDelimiter("hello world", "(")).toEqual(["hello", " ", "world"]);
  });
});

describe("reverseLine", () => {
  it("reverses word order preserving single space", () => {
    expect(reverseLine("hello world", OPTS)).toBe("world hello");
  });
  it("preserves leading whitespace when preserveEdges=true", () => {
    expect(reverseLine("  hello world", OPTS)).toBe("  world hello");
  });
  it("trims edges when preserveEdges=false", () => {
    const r = reverseLine("  hello world  ", { ...OPTS, preserveEdges: false });
    expect(r).toBe("world hello");
  });
  it("handles single word", () => {
    expect(reverseLine("hello", OPTS)).toBe("hello");
  });
  it("handles empty line", () => {
    expect(reverseLine("", OPTS)).toBe("");
  });
  it("normalizes whitespace when option set", () => {
    expect(reverseLine("hello   world", { ...OPTS, normalizeWhitespace: true })).toBe("world hello");
  });
});

describe("splitSentences + reverseBySentence", () => {
  it("splitSentences splits on .!?", () => {
    const parts = splitSentences("Hi there. Hello!");
    expect(parts.length).toBeGreaterThanOrEqual(2);
  });
  it("reverseBySentence reverses within each sentence", () => {
    const out = reverseBySentence("hello world. foo bar!", OPTS);
    // Punctuation stays attached: "hello world." → "world. hello"
    expect(out).toContain("world. hello");
    expect(out).toContain("bar! foo");
  });
});

describe("reverseAllWords + reverseCharsInWords", () => {
  it("reverseAllWords treats all text as one stream", () => {
    const out = reverseAllWords("a b\nc d", { ...OPTS, scope: "all" });
    expect(out).toBe("d c b a");
  });
  it("reverseCharsInWords flips characters within words", () => {
    expect(reverseCharsInWords("hello world", OPTS)).toBe("olleh dlrow");
  });
});

describe("reverseWords", () => {
  it("reverses each line independently", () => {
    expect(reverseWords("a b\nc d", OPTS)).toBe("b a\nd c");
  });
  it("returns empty for empty input", () => {
    expect(reverseWords("", OPTS)).toBe("");
  });
  it("preserves blank lines", () => {
    expect(reverseWords("a b\n\nc d", OPTS)).toBe("b a\n\nd c");
  });
});

describe("validateOptions", () => {
  it("fills defaults", () => {
    expect(validateOptions({})).toEqual(DEFAULT_OPTIONS);
  });
  it("respects provided values", () => {
    expect(validateOptions({ preserveEdges: false })).toEqual({ ...DEFAULT_OPTIONS, preserveEdges: false });
  });
});

describe("helpers + presets", () => {
  it("isIdentity always false", () => {
    expect(isIdentity(OPTS)).toBe(false);
  });
  it("batchValidate validates each input", () => {
    const r = batchValidate([{ name: "a" }], OPTS);
    expect(r[0]!.result).toEqual(OPTS);
  });
  it("textStats returns counts", () => {
    const s = textStats("a b\nc d");
    expect(s.lines).toBe(2);
    expect(s.words).toBe(4);
    expect(s.chars).toBe(7);
  });
  it("sentenceCount counts terminators", () => {
    expect(sentenceCount("Hi. Hello! Bye?")).toBe(3);
  });
  it("wordCount counts words", () => {
    expect(wordCount("hello world foo")).toBe(3);
  });
  it("findPreset returns matching", () => {
    expect(findPreset("sentence")?.options.scope).toBe("sentence");
  });
  it("has at least 5 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(5);
  });
});
