import { describe, it, expect } from "vitest";
import {
  DICTIONARY, normalizeWord, lookupWord, searchWords, partsOfSpeech,
  definitionsByPos, formatEntry, randomWord, allWords, validateWord,
  wordOfDay, dictionaryToCsv,
} from "./logic";

describe("normalizeWord", () => {
  it("lowercases and trims", () => {
    expect(normalizeWord("  Hello  ")).toBe("hello");
  });
  it("strips non-letters", () => {
    expect(normalizeWord("Hello!")).toBe("hello");
  });
  it("handles empty", () => {
    expect(normalizeWord("")).toBe("");
  });
});

describe("lookupWord", () => {
  it("finds a known word", () => {
    const e = lookupWord("serendipity");
    expect(e).not.toBeNull();
    expect(e!.word).toBe("serendipity");
  });
  it("is case-insensitive", () => {
    expect(lookupWord("EPHEMERAL")).not.toBeNull();
  });
  it("returns null for unknown", () => {
    expect(lookupWord("xyzzy")).toBeNull();
  });
  it("returns null for empty", () => {
    expect(lookupWord("")).toBeNull();
  });
});

describe("searchWords", () => {
  it("finds by substring", () => {
    const results = searchWords("re");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.word === "resilient")).toBe(true);
  });
  it("returns empty for no match", () => {
    expect(searchWords("zzzzzz")).toEqual([]);
  });
  it("returns empty for empty query", () => {
    expect(searchWords("")).toEqual([]);
  });
});

describe("partsOfSpeech & definitionsByPos", () => {
  it("returns unique POS list", () => {
    const e = lookupWord("vex")!;
    const pos = partsOfSpeech(e);
    expect(pos).toContain("verb");
  });
  it("filters definitions by POS", () => {
    const e = lookupWord("serendipity")!;
    const nouns = definitionsByPos(e, "noun");
    expect(nouns.length).toBeGreaterThan(0);
    const verbs = definitionsByPos(e, "verb");
    expect(verbs.length).toBe(0);
  });
});

describe("formatEntry", () => {
  it("includes word and definition", () => {
    const e = lookupWord("eloquent")!;
    const text = formatEntry(e);
    expect(text).toContain("eloquent");
    expect(text).toContain("fluent");
  });
  it("includes synonyms and antonyms", () => {
    const e = lookupWord("resilient")!;
    const text = formatEntry(e);
    expect(text).toContain("Synonyms:");
    expect(text).toContain("Antonyms:");
  });
  it("includes etymology when present", () => {
    const e = lookupWord("paradigm")!;
    const text = formatEntry(e);
    expect(text).toContain("Etymology:");
  });
});

describe("randomWord", () => {
  it("returns an entry", () => {
    const e = randomWord();
    expect(e).toBeDefined();
    expect(e.word.length).toBeGreaterThan(0);
  });
});

describe("allWords", () => {
  it("returns sorted list", () => {
    const words = allWords();
    expect(words.length).toBe(DICTIONARY.length);
    for (let i = 1; i < words.length; i++) {
      expect(words[i] >= words[i - 1]).toBe(true);
    }
  });
});

describe("validateWord", () => {
  it("accepts valid word", () => {
    expect(validateWord("hello").ok).toBe(true);
  });
  it("rejects empty", () => {
    expect(validateWord("").ok).toBe(false);
  });
  it("rejects too long", () => {
    expect(validateWord("a".repeat(60)).ok).toBe(false);
  });
});

describe("wordOfDay", () => {
  it("returns an entry deterministically for the same date", () => {
    const date = new Date(2024, 0, 15);
    const a = wordOfDay(date);
    const b = wordOfDay(date);
    expect(a.word).toBe(b.word);
  });
});

describe("dictionaryToCsv", () => {
  it("produces CSV with header", () => {
    const csv = dictionaryToCsv();
    expect(csv.startsWith("word,phonetic,part_of_speech,definition,example")).toBe(true);
  });
  it("includes all definitions", () => {
    const csv = dictionaryToCsv();
    const lines = csv.split("\n");
    expect(lines.length).toBeGreaterThan(DICTIONARY.length);
  });
});
