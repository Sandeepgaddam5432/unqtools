/**
 * Lorem Ipsum Generator — unit tests.
 */
import { describe, it, expect } from "vitest";
import { generate, countWords, countCharacters, countSentences, DEFAULT_OPTIONS, type GenerateOptions } from "./logic";

describe("generate — paragraphs", () => {
  it("generates the requested number of paragraphs", () => {
    const r = generate({ ...DEFAULT_OPTIONS, count: 3, unit: "paragraphs" });
    const paragraphs = r.split("\n\n");
    expect(paragraphs.length).toBe(3);
  });
  it("starts with 'Lorem ipsum' when startWithLorem=true", () => {
    const r = generate({ ...DEFAULT_OPTIONS, count: 1, unit: "paragraphs", startWithLorem: true });
    expect(r.startsWith("Lorem ipsum dolor sit amet")).toBe(true);
  });
  it("does not start with 'Lorem ipsum' when startWithLorem=false", () => {
    const r = generate({ ...DEFAULT_OPTIONS, count: 1, unit: "paragraphs", startWithLorem: false });
    expect(r.startsWith("Lorem ipsum")).toBe(false);
  });
});

describe("generate — sentences", () => {
  it("generates the requested number of sentences", () => {
    const r = generate({ ...DEFAULT_OPTIONS, count: 5, unit: "sentences", startWithLorem: false });
    const sentenceCount = (r.match(/\./g) ?? []).length;
    expect(sentenceCount).toBe(5);
  });
});

describe("generate — words", () => {
  it("generates the requested number of words", () => {
    const r = generate({ ...DEFAULT_OPTIONS, count: 20, unit: "words", startWithLorem: false });
    expect(countWords(r)).toBe(20);
  });
  it("starts with 'lorem ipsum' when startWithLorem=true", () => {
    const r = generate({ ...DEFAULT_OPTIONS, count: 10, unit: "words", startWithLorem: true });
    const firstTwo = r.split(" ").slice(0, 2).join(" ");
    expect(firstTwo).toBe("lorem ipsum");
  });
});

describe("generate — characters", () => {
  it("generates approximately the requested number of characters", () => {
    const r = generate({ ...DEFAULT_OPTIONS, count: 200, unit: "characters", startWithLorem: false });
    // Should be close to 200 (may truncate at word boundary)
    expect(r.length).toBeLessThanOrEqual(200);
    expect(r.length).toBeGreaterThan(150);
  });
});

describe("generate — variants", () => {
  it("generates Cicero variant", () => {
    const r = generate({ ...DEFAULT_OPTIONS, variant: "cicero", count: 1, unit: "paragraphs" });
    expect(r.length).toBeGreaterThan(0);
    // Cicero sentences contain "Sed ut" or similar
    expect(typeof r).toBe("string");
  });
  it("generates Hipster variant", () => {
    const r = generate({ ...DEFAULT_OPTIONS, variant: "hipster", count: 20, unit: "words", startWithLorem: false });
    // Should contain hipster words
    const hipsterWord = HIPSTER_TEST_WORDS.find((w) => r.includes(w));
    expect(hipsterWord).toBeDefined();
  });
  it("generates Bacon variant", () => {
    // Generate enough words that bacon is likely to appear
    const r = generate({ ...DEFAULT_OPTIONS, variant: "bacon", count: 100, unit: "words", startWithLorem: false });
    // Should contain at least one bacon-related word from the pool
    const baconWords = ["bacon", "flank", "pork", "ribeye", "sausage", "ham", "turkey", "steak"];
    const found = baconWords.some((w) => r.toLowerCase().includes(w));
    expect(found).toBe(true);
  });
  it("uses custom word list", () => {
    const customWords = ["alpha", "beta", "gamma"];
    const r = generate({ ...DEFAULT_OPTIONS, variant: "custom", customWords, count: 10, unit: "words", startWithLorem: false });
    const words = r.split(" ");
    for (const w of words) {
      expect(customWords).toContain(w);
    }
  });
});

describe("generate — output formats", () => {
  it("generates HTML output with <p> tags", () => {
    const r = generate({ ...DEFAULT_OPTIONS, count: 2, unit: "paragraphs", format: "html" });
    expect(r).toContain("<p>");
    expect(r).toContain("</p>");
  });
  it("generates Markdown output (paragraphs separated by blank line)", () => {
    const r = generate({ ...DEFAULT_OPTIONS, count: 2, unit: "paragraphs", format: "markdown" });
    expect(r).toContain("\n\n");
  });
  it("generates plain text output", () => {
    const r = generate({ ...DEFAULT_OPTIONS, count: 1, unit: "paragraphs", format: "text" });
    expect(r).not.toContain("<p>");
  });
});

describe("countWords", () => {
  it("counts words in a string", () => {
    expect(countWords("hello world")).toBe(2);
  });
  it("handles extra whitespace", () => {
    expect(countWords("  hello   world  ")).toBe(2);
  });
});

describe("countCharacters", () => {
  it("counts characters including spaces", () => {
    expect(countCharacters("hello world")).toBe(11);
  });
  it("counts characters excluding spaces", () => {
    expect(countCharacters("hello world", false)).toBe(10);
  });
});

describe("countSentences", () => {
  it("counts sentences by punctuation", () => {
    expect(countSentences("Hello. World! How?")).toBe(3);
  });
});

describe("DEFAULT_OPTIONS", () => {
  it("has sensible defaults", () => {
    expect(DEFAULT_OPTIONS.count).toBeGreaterThan(0);
    expect(DEFAULT_OPTIONS.minWordsPerSentence).toBeLessThan(DEFAULT_OPTIONS.maxWordsPerSentence);
    expect(DEFAULT_OPTIONS.minSentencesPerParagraph).toBeLessThan(DEFAULT_OPTIONS.maxSentencesPerParagraph);
  });
});

// Test fixture for hipster words
const HIPSTER_TEST_WORDS = ["artisan", "craft", "beer", "ethical", "sustainable", "small", "batch"];
