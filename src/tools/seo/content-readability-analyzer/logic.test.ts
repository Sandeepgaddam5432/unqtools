import { describe, it, expect, beforeEach } from "vitest";
import {
  countSyllables,
  tokenizeWords,
  splitSentences,
  countParagraphs,
  detectPassiveVoicePhrases,
  computeStats,
  fleschReadingEase,
  fleschKincaidGrade,
  gunningFog,
  smog,
  colemanLiau,
  automatedReadability,
  fleschToLevel,
  gradeToLevel,
  computeScores,
  formatReadingTime,
  analyze,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
});

describe("content-readability-analyzer countSyllables", () => {
  it("returns 0 for empty", () => {
    expect(countSyllables("")).toBe(0);
  });
  it("returns 1 for short words", () => {
    expect(countSyllables("the")).toBe(1);
    expect(countSyllables("cat")).toBe(1);
  });
  it("counts multi-syllable words", () => {
    expect(countSyllables("hello")).toBe(2);
    expect(countSyllables("fantastic")).toBe(3);
    expect(countSyllables("extraordinary")).toBeGreaterThan(3);
  });
  it("handles silent e", () => {
    expect(countSyllables("cake")).toBe(1);
  });
  it("strips non-letters", () => {
    expect(countSyllables("hello!")).toBe(2);
    expect(countSyllables("WHAT?")).toBe(1);
  });
});

describe("content-readability-analyzer tokenizeWords", () => {
  it("returns empty for empty text", () => {
    expect(tokenizeWords("")).toEqual([]);
  });
  it("splits on non-letter chars", () => {
    expect(tokenizeWords("Hello, world!")).toEqual(["hello", "world"]);
  });
  it("lowercases", () => {
    expect(tokenizeWords("ABC")).toEqual(["abc"]);
  });
});

describe("content-readability-analyzer splitSentences", () => {
  it("returns empty for empty text", () => {
    expect(splitSentences("")).toEqual([]);
  });
  it("splits on periods", () => {
    expect(splitSentences("Hello. World.")).toHaveLength(2);
  });
  it("splits on ! and ?", () => {
    expect(splitSentences("Hi! How? There.")).toHaveLength(3);
  });
  it("handles single sentence", () => {
    expect(splitSentences("Just one.")).toHaveLength(1);
  });
});

describe("content-readability-analyzer countParagraphs", () => {
  it("returns 0 for empty", () => {
    expect(countParagraphs("")).toBe(0);
  });
  it("counts paragraph blocks", () => {
    expect(countParagraphs("Para one.\n\nPara two.\n\nPara three.")).toBe(3);
  });
  it("handles single paragraph", () => {
    expect(countParagraphs("Just one paragraph here.")).toBe(1);
  });
});

describe("content-readability-analyzer detectPassiveVoicePhrases", () => {
  it("detects 'was opened'", () => {
    const out = detectPassiveVoicePhrases("The door was opened by him.");
    expect(out.some((p) => /was opened/i.test(p))).toBe(true);
  });
  it("detects 'has been completed'", () => {
    const out = detectPassiveVoicePhrases("The work has been completed.");
    expect(out.some((p) => /has been completed/i.test(p))).toBe(true);
  });
  it("returns empty for active voice", () => {
    expect(detectPassiveVoicePhrases("He opened the door.")).toEqual([]);
  });
  it("returns empty for empty text", () => {
    expect(detectPassiveVoicePhrases("")).toEqual([]);
  });
});

describe("content-readability-analyzer computeStats", () => {
  it("returns zero stats for empty text", () => {
    const s = computeStats("");
    expect(s.words).toBe(0);
    expect(s.sentences).toBe(0);
  });
  it("counts words correctly", () => {
    const s = computeStats("The quick brown fox jumps.");
    expect(s.words).toBe(5);
  });
  it("counts sentences correctly", () => {
    const s = computeStats("One. Two. Three.");
    expect(s.sentences).toBe(3);
  });
  it("counts paragraphs", () => {
    const s = computeStats("Para one.\n\nPara two.");
    expect(s.paragraphs).toBe(2);
  });
  it("computes averages", () => {
    const s = computeStats("The cat sat on the mat. The dog ran.");
    expect(s.averageWordsPerSentence).toBeGreaterThan(0);
    expect(s.averageSyllablesPerWord).toBeGreaterThan(0);
  });
  it("calculates reading time", () => {
    const text = "word ".repeat(400);
    const s = computeStats(text);
    expect(s.readingTimeMinutes).toBeCloseTo(2, 1);
  });
  it("tracks longest sentence", () => {
    const s = computeStats("Short. This is a much longer sentence with many more words inside it.");
    expect(s.longestSentenceWords).toBeGreaterThan(5);
  });
});

describe("content-readability-analyzer formulas", () => {
  // Use a moderately complex text that yields positive grade levels
  const stats = computeStats(
    "The utilization of sophisticated analytical methodologies facilitates comprehensive understanding. Researchers investigate multifaceted phenomena through systematic observation and empirical verification. Theoretical frameworks provide foundational structures for interpreting complex conceptual relationships within academic disciplines."
  );
  it("fleschReadingEase returns a finite number", () => {
    expect(typeof fleschReadingEase(stats)).toBe("number");
    expect(Number.isFinite(fleschReadingEase(stats))).toBe(true);
  });
  it("fleschKincaidGrade returns positive number", () => {
    expect(fleschKincaidGrade(stats)).toBeGreaterThan(0);
  });
  it("gunningFog returns positive number", () => {
    expect(gunningFog(stats)).toBeGreaterThan(0);
  });
  it("smog returns a number", () => {
    expect(typeof smog(stats)).toBe("number");
  });
  it("colemanLiau returns a number", () => {
    expect(typeof colemanLiau(stats)).toBe("number");
  });
  it("automatedReadability returns a number", () => {
    expect(typeof automatedReadability(stats)).toBe("number");
  });
  it("returns 0 for empty stats", () => {
    const empty = computeStats("");
    expect(fleschReadingEase(empty)).toBe(0);
    expect(fleschKincaidGrade(empty)).toBe(0);
    expect(gunningFog(empty)).toBe(0);
    expect(colemanLiau(empty)).toBe(0);
    expect(automatedReadability(empty)).toBe(0);
  });
});

describe("content-readability-analyzer level mappings", () => {
  it("fleschToLevel maps high score to easy", () => {
    expect(fleschToLevel(95)).toMatch(/Very Easy/i);
  });
  it("fleschToLevel maps low score to hard", () => {
    expect(fleschToLevel(20)).toMatch(/Very Hard/i);
  });
  it("gradeToLevel maps kindergarten", () => {
    expect(gradeToLevel(0)).toMatch(/Kindergarten/i);
  });
  it("gradeToLevel maps college", () => {
    expect(gradeToLevel(14)).toMatch(/College/i);
  });
  it("gradeToLevel maps graduate", () => {
    expect(gradeToLevel(20)).toMatch(/College Graduate/i);
  });
});

describe("content-readability-analyzer computeScores", () => {
  it("computes all scores and average", () => {
    const stats = computeStats(
      "The utilization of sophisticated analytical methodologies facilitates comprehensive understanding. Researchers investigate multifaceted phenomena through systematic observation and empirical verification. Theoretical frameworks provide foundational structures for interpreting complex conceptual relationships within academic disciplines. Practitioners evaluate theoretical constructs through rigorous empirical methodologies."
    );
    const scores = computeScores(stats);
    expect(Number.isFinite(scores.fleschReadingEase)).toBe(true);
    expect(scores.averageGrade).toBeGreaterThan(0);
    expect(scores.consensusLevel).toBeTruthy();
  });
  it("returns zeros for empty input", () => {
    const scores = computeScores(computeStats(""));
    expect(scores.averageGrade).toBe(0);
  });
});

describe("content-readability-analyzer formatReadingTime", () => {
  it("formats 0 as 0s", () => {
    expect(formatReadingTime(0)).toBe("0s");
  });
  it("formats minutes only", () => {
    expect(formatReadingTime(5)).toBe("5m");
  });
  it("formats minutes and seconds", () => {
    expect(formatReadingTime(1.5)).toBe("1m 30s");
  });
  it("formats seconds only", () => {
    expect(formatReadingTime(0.5)).toBe("30s");
  });
});

describe("content-readability-analyzer analyze", () => {
  it("returns full analysis result", () => {
    const r = analyze("The cat sat on the mat. The dog ran fast. Birds fly high in the sky.");
    expect(r.stats.words).toBeGreaterThan(0);
    expect(r.scores.fleschReadingEase).toBeGreaterThan(0);
    expect(Array.isArray(r.complexWordList)).toBe(true);
    expect(Array.isArray(r.longSentences)).toBe(true);
    expect(Array.isArray(r.passiveVoicePhrases)).toBe(true);
  });
  it("detects long sentences over 25 words", () => {
    const long = "This is a very long sentence that has more than twenty five words in it so that the long sentence detector will pick it up and add it to the list of long sentences that need shortening for better readability score and reader comprehension overall.";
    const r = analyze(long);
    expect(r.longSentences.length).toBeGreaterThanOrEqual(1);
  });
});

describe("content-readability-analyzer history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, wordCount: 100, fleschScore: 70, consensusLevel: "Standard", snippet: "x" });
    saveHistory({ ts: 2, wordCount: 200, fleschScore: 60, consensusLevel: "Fairly Hard", snippet: "y" });
    expect(loadHistory()).toHaveLength(2);
    expect(loadHistory()[0].wordCount).toBe(200);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, wordCount: 1, fleschScore: 50, consensusLevel: "X", snippet: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, wordCount: 1, fleschScore: 50, consensusLevel: "X", snippet: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("content-readability-analyzer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("hello world");
    expect(url).toContain("text=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back to text", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("hello world");
    const hash = url.replace(/^\?/, "#");
    const parsed = parseShareUrl(hash);
    expect(parsed.text).toBe("hello world");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("returns empty for empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
});
