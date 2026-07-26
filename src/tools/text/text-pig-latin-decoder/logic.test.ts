import { describe, it, expect } from "vitest";
import {
  decodeWord,
  decodeSentence,
  decodeWithAlternatives,
  encodeWord,
  validateWord,
  decodeStats,
  batchDecode,
  suggestBest,
  matchSuffix,
  applyCase,
} from "./logic";

describe("matchSuffix", () => {
  it("matches way suffix", () => {
    expect(matchSuffix("appleway", ["way", "yay", "ay"])).toBe("way");
  });
  it("returns null when no match", () => {
    expect(matchSuffix("banana", ["way", "yay", "ay"])).toBeNull();
  });
});

describe("applyCase", () => {
  it("preserves all-caps", () => {
    expect(applyCase("HELLO", "hello")).toBe("HELLO");
  });
  it("preserves title case", () => {
    expect(applyCase("Hello", "hello")).toBe("Hello");
  });
  it("preserves lowercase", () => {
    expect(applyCase("hello", "hello")).toBe("hello");
  });
});

describe("decodeWord", () => {
  it("decodes vowel-start word with -way", () => {
    const r = decodeWord("appleway");
    expect(r).toContain("apple");
  });
  it("decodes vowel-start word with -yay", () => {
    const r = decodeWord("appleyay");
    expect(r).toContain("apple");
  });
  it("decodes consonant-start word (smile)", () => {
    const r = decodeWord("ilesmay");
    expect(r).toContain("smile");
  });
  it("decodes qu-cluster (queen)", () => {
    const r = decodeWord("eenquay");
    expect(r).toContain("queen");
  });
  it("preserves capitalization", () => {
    const r = decodeWord("Ilesmay");
    expect(r.some((w) => w[0] === "S")).toBe(true);
  });
  it("preserves all-caps", () => {
    const r = decodeWord("ILESMAY");
    expect(r.some((w) => w === w.toUpperCase())).toBe(true);
  });
  it("returns original if no decoding", () => {
    const r = decodeWord("zzz");
    expect(r.length).toBeGreaterThan(0);
  });
});

describe("decodeSentence", () => {
  it("decodes a sentence", () => {
    expect(decodeSentence("elloHay orldway")).toBe("Hello World");
  });
  it("preserves punctuation", () => {
    expect(decodeSentence("elloHay, orldway!")).toContain("Hello, World!");
  });
  it("handles empty input", () => {
    expect(decodeSentence("")).toBe("");
  });
  it("handles unknown words gracefully", () => {
    expect(decodeSentence("zzzzqwerty")).toBeTruthy();
  });
});

describe("decodeWithAlternatives", () => {
  it("returns multiple alternatives for ambiguous", () => {
    const r = decodeWithAlternatives("ilesmay");
    expect(r[0].alternatives.length).toBeGreaterThan(0);
  });
});

describe("encodeWord (round-trip)", () => {
  it("encodes apple to appleway", () => {
    expect(encodeWord("apple")).toBe("appleway");
  });
  it("encodes smile to ilesmay", () => {
    expect(encodeWord("smile")).toBe("ilesmay");
  });
  it("encodes queen to eenquay", () => {
    expect(encodeWord("queen")).toBe("eenquay");
  });
  it("preserves capitalization", () => {
    expect(encodeWord("Smile")).toBe("Ilesmay");
    expect(encodeWord("SMILE")).toBe("ILESMAY");
  });
  it("round-trips decode(encode(word)) for vowel words", () => {
    const enc = encodeWord("apple");
    const dec = decodeWord(enc);
    expect(dec).toContain("apple");
  });
  it("round-trips decode(encode(word)) for consonant words", () => {
    const enc = encodeWord("smile");
    const dec = decodeWord(enc);
    expect(dec).toContain("smile");
  });
});

describe("validateWord", () => {
  it("valid -way word", () => {
    expect(validateWord("appleway").valid).toBe(true);
  });
  it("valid -yay word", () => {
    expect(validateWord("appleyay").valid).toBe(true);
  });
  it("valid -ay word", () => {
    expect(validateWord("ilesmay").valid).toBe(true);
  });
  it("invalid word without suffix", () => {
    expect(validateWord("banana").valid).toBe(false);
  });
  it("invalid empty", () => {
    expect(validateWord("").valid).toBe(false);
  });
});

describe("decodeStats", () => {
  it("counts valid and invalid words", () => {
    const s = decodeStats("appleway banana ilesmay");
    expect(s.total).toBe(3);
    expect(s.valid).toBe(2);
    expect(s.invalid).toBe(1);
  });
});

describe("batchDecode", () => {
  it("preserves newlines", () => {
    const out = batchDecode("elloHay\norldway");
    expect(out.split("\n")).toHaveLength(2);
  });
  it("decodes each line", () => {
    expect(batchDecode("elloHay")).toContain("Hello");
  });
});

describe("suggestBest", () => {
  it("prefers dictionary words", () => {
    expect(suggestBest(["zzzz", "smile"])).toBe("smile");
  });
  it("prefers shorter when no dictionary match", () => {
    expect(suggestBest(["abcdefg", "abc"])).toBe("abc");
  });
});
