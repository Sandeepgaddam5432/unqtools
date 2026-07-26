import { describe, it, expect } from "vitest";
import {
  splitSentences,
  joinSentences,
  sentenceStats,
  formatAsList,
  splitCJK,
  parseAbbreviations,
  addAbbreviation,
  detectIssues,
  readingTime,
  filterByLength,
  highlightSentence,
  DEFAULT_ABBREVIATIONS,
} from "./logic";

describe("splitSentences", () => {
  it("splits on period", () => {
    const r = splitSentences("Hello world. Goodbye world.");
    expect(r).toHaveLength(2);
  });
  it("splits on ! and ?", () => {
    const r = splitSentences("Hi there! How are you? I'm fine.");
    expect(r).toHaveLength(3);
  });
  it("preserves delimiter by default", () => {
    const r = splitSentences("Hello. World.");
    expect(r[0]).toBe("Hello.");
  });
  it("strips delimiter when keepDelimiter=false", () => {
    const r = splitSentences("Hello. World.", { keepDelimiter: false });
    expect(r[0]).toBe("Hello");
  });
  it("does not split on common abbreviations (Dr.)", () => {
    const r = splitSentences("Dr. Smith went home. Then he ate.");
    expect(r).toHaveLength(2);
    expect(r[0]).toContain("Dr. Smith");
  });
  it("does not split on U.S.", () => {
    const r = splitSentences("I live in the U.S. It is nice.");
    expect(r).toHaveLength(2);
  });
  it("does not split on decimals (3.14)", () => {
    const r = splitSentences("Pi is 3.14. That is correct.");
    expect(r).toHaveLength(2);
  });
  it("does not split inside quotes", () => {
    const r = splitSentences('He said "Hello. How are you?" Then he left.');
    expect(r).toHaveLength(2);
  });
  it("handles initials like J.R.R. Tolkien", () => {
    const r = splitSentences("J.R.R. Tolkien wrote books. He was famous.");
    expect(r).toHaveLength(2);
  });
  it("respects custom abbreviations", () => {
    const r = splitSentences("Frobnicate. Then run.", {
      abbreviations: ["Frobnicate"],
    });
    expect(r).toHaveLength(1);
  });
});

describe("joinSentences", () => {
  it("joins with proper punctuation", () => {
    expect(joinSentences(["Hello", "World"])).toBe("Hello. World.");
  });
  it("respects custom separator", () => {
    expect(joinSentences(["Hello.", "World."], "\n")).toBe("Hello.\nWorld.");
  });
});

describe("sentenceStats", () => {
  it("computes stats", () => {
    const s = sentenceStats("Hello world. This is a longer sentence with more words.");
    expect(s.count).toBe(2);
    expect(s.avgWords).toBeGreaterThan(0);
    expect(s.longest.words).toBeGreaterThan(s.shortest.words);
  });
  it("handles empty text", () => {
    const s = sentenceStats("");
    expect(s.count).toBe(0);
  });
});

describe("formatAsList", () => {
  it("numbered format", () => {
    expect(formatAsList(["A.", "B."], "numbered")).toBe("1. A.\n2. B.");
  });
  it("bulleted format", () => {
    expect(formatAsList(["A.", "B."], "bulleted")).toBe("• A.\n• B.");
  });
  it("plain format", () => {
    expect(formatAsList(["A.", "B."], "plain")).toBe("A.\nB.");
  });
});

describe("splitCJK", () => {
  it("splits on 。", () => {
    const r = splitCJK("你好。世界。");
    expect(r).toHaveLength(2);
  });
  it("splits on ！", () => {
    const r = splitCJK("你好！世界。");
    expect(r).toHaveLength(2);
  });
});

describe("parseAbbreviations", () => {
  it("parses comma-separated", () => {
    expect(parseAbbreviations("Dr, Mr, Ms")).toEqual(["Dr", "Mr", "Ms"]);
  });
  it("parses newline-separated", () => {
    expect(parseAbbreviations("Dr\nMr\nMs")).toEqual(["Dr", "Mr", "Ms"]);
  });
});

describe("addAbbreviation", () => {
  it("adds unique entry", () => {
    expect(addAbbreviation(["Dr"], "Mr")).toContain("Mr");
  });
  it("deduplicates", () => {
    const r = addAbbreviation(["Dr"], "Dr");
    expect(r).toEqual(["Dr"]);
  });
});

describe("detectIssues", () => {
  it("flags lowercase start", () => {
    const r = detectIssues("Hello. world.");
    expect(r.some((i) => i.type === "lowercase-start")).toBe(true);
  });
  it("flags very long sentences", () => {
    const long = "This is a sentence with " + "word ".repeat(50) + "end.";
    const r = detectIssues(long);
    expect(r.some((i) => i.type === "long-sentence")).toBe(true);
  });
});

describe("readingTime", () => {
  it("estimates reading time at 200 wpm", () => {
    // 200 words = 60 seconds
    const text = "word ".repeat(200).trim();
    expect(readingTime(text)).toBe(60);
  });
});

describe("filterByLength", () => {
  it("filters by word count range", () => {
    const sentences = ["Short one.", "This is a longer sentence with many words inside."];
    expect(filterByLength(sentences, 5, 100)).toHaveLength(1);
  });
});

describe("highlightSentence", () => {
  it("wraps target sentence in markers", () => {
    const out = highlightSentence(["Hello.", "World.", "Goodbye."], 1);
    expect(out).toContain("[START] World. [END]");
  });
});

describe("DEFAULT_ABBREVIATIONS", () => {
  it("includes common abbreviations", () => {
    expect(DEFAULT_ABBREVIATIONS).toContain("Mr");
    expect(DEFAULT_ABBREVIATIONS).toContain("Dr");
    expect(DEFAULT_ABBREVIATIONS).toContain("etc");
  });
});
