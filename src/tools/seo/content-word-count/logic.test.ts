import { describe, it, expect, beforeEach } from "vitest";
import {
  tokenizeWords,
  splitSentences,
  splitParagraphs,
  countLines,
  computeStats,
  computeTopKeywords,
  computeSentenceLengthBuckets,
  computeParagraphStats,
  computeSeoScore,
  analyze,
  formatReadingTime,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  STOP_WORDS,
  DEFAULT_READING_WPM,
  READING_WPM_250,
  SPEAKING_WPM,
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

describe("content-word-count tokenizeWords", () => {
  it("returns empty for empty", () => {
    expect(tokenizeWords("")).toEqual([]);
  });
  it("splits on non-letters", () => {
    expect(tokenizeWords("Hello, world!")).toEqual(["hello", "world"]);
  });
  it("lowercases", () => {
    expect(tokenizeWords("AbC")).toEqual(["abc"]);
  });
});

describe("content-word-count splitSentences", () => {
  it("returns empty for empty", () => {
    expect(splitSentences("")).toEqual([]);
  });
  it("splits on .!?", () => {
    expect(splitSentences("Hi. There! Why?")).toHaveLength(3);
  });
});

describe("content-word-count splitParagraphs", () => {
  it("returns empty for empty", () => {
    expect(splitParagraphs("")).toEqual([]);
  });
  it("splits on blank lines", () => {
    expect(splitParagraphs("Para 1.\n\nPara 2.")).toHaveLength(2);
  });
});

describe("content-word-count countLines", () => {
  it("returns 0 for empty", () => {
    expect(countLines("")).toBe(0);
  });
  it("counts newlines", () => {
    expect(countLines("a\nb\nc")).toBe(3);
  });
});

describe("content-word-count computeStats", () => {
  it("returns zeros for empty", () => {
    const s = computeStats("");
    expect(s.words).toBe(0);
    expect(s.characters).toBe(0);
    expect(s.sentences).toBe(0);
  });
  it("counts words", () => {
    expect(computeStats("the quick brown fox").words).toBe(4);
  });
  it("counts characters with and without spaces", () => {
    const s = computeStats("ab cd");
    expect(s.characters).toBe(5);
    expect(s.charactersNoSpaces).toBe(4);
  });
  it("counts paragraphs", () => {
    expect(computeStats("A.\n\nB.\n\nC.").paragraphs).toBe(3);
  });
  it("counts unique words", () => {
    expect(computeStats("the the the cat").uniqueWords).toBe(2);
  });
  it("finds longest word", () => {
    expect(computeStats("a bb ccc dddd").longestWord).toBe("dddd");
  });
  it("finds longest sentence", () => {
    const s = computeStats("Short. This is a much longer sentence with many words.");
    expect(s.longestSentenceWordCount).toBeGreaterThan(5);
  });
  it("computes reading time @200 WPM", () => {
    const text = "word ".repeat(400);
    expect(computeStats(text).readingTimeMinutes).toBeCloseTo(2, 1);
  });
  it("computes reading time @250 WPM", () => {
    const text = "word ".repeat(500);
    expect(computeStats(text).readingTimeMinutes250).toBeCloseTo(2, 1);
  });
  it("computes speaking time @130 WPM", () => {
    const text = "word ".repeat(130);
    expect(computeStats(text).speakingTimeMinutes).toBeCloseTo(1, 1);
  });
});

describe("content-word-count computeTopKeywords", () => {
  it("returns empty for empty", () => {
    expect(computeTopKeywords("")).toEqual([]);
  });
  it("excludes stop words by default", () => {
    const out = computeTopKeywords("the cat the dog the cat");
    expect(out.length).toBeGreaterThan(0);
    expect(out.find((k) => k.word === "the")).toBeUndefined();
  });
  it("includes stop words when excludeStopWords=false", () => {
    const out = computeTopKeywords("the cat the dog", 10, false);
    expect(out.find((k) => k.word === "the")).toBeDefined();
  });
  it("respects custom exclude list", () => {
    const out = computeTopKeywords("cat dog bird", 10, false, ["cat"]);
    expect(out.find((k) => k.word === "cat")).toBeUndefined();
    expect(out.find((k) => k.word === "dog")).toBeDefined();
  });
  it("sorts by count desc", () => {
    const out = computeTopKeywords("cat cat dog bird bird bird", 10, false);
    expect(out[0].word).toBe("bird");
    expect(out[0].count).toBe(3);
  });
  it("limits to N results", () => {
    const out = computeTopKeywords("a b c d e f g h i j k", 5, false);
    expect(out.length).toBeLessThanOrEqual(5);
  });
  it("computes density as percentage", () => {
    const out = computeTopKeywords("cat dog cat", 10, false);
    const cat = out.find((k) => k.word === "cat");
    expect(cat?.density).toBeCloseTo(66.67, 1);
  });
  it("skips 1-char words", () => {
    const out = computeTopKeywords("a b cat", 10, false);
    expect(out.find((k) => k.word === "a")).toBeUndefined();
    expect(out.find((k) => k.word === "b")).toBeUndefined();
  });
});

describe("content-word-count computeSentenceLengthBuckets", () => {
  it("returns empty counts for empty text", () => {
    const b = computeSentenceLengthBuckets("");
    expect(b).toHaveLength(6);
    expect(b.reduce((s, x) => s + x.count, 0)).toBe(0);
  });
  it("categorizes sentences", () => {
    const b = computeSentenceLengthBuckets(
      "Hi there. This is a slightly longer sentence for testing.",
    );
    expect(b[0].count).toBeGreaterThanOrEqual(1); // 1-5 bucket
    expect(b[1].count).toBeGreaterThanOrEqual(1); // 6-10 bucket
  });
});

describe("content-word-count computeParagraphStats", () => {
  it("returns zeros for empty", () => {
    const p = computeParagraphStats("");
    expect(p.count).toBe(0);
    expect(p.averageWordsPerParagraph).toBe(0);
  });
  it("counts paragraphs", () => {
    expect(computeParagraphStats("A.\n\nB.\n\nC.").count).toBe(3);
  });
  it("computes averages", () => {
    const p = computeParagraphStats("One two three.\n\nFour five.");
    expect(p.averageSentencesPerParagraph).toBe(1);
    expect(p.averageWordsPerParagraph).toBeCloseTo(2.5, 1);
  });
});

describe("content-word-count computeSeoScore", () => {
  it("returns 0 score for empty text", () => {
    const s = computeSeoScore("");
    expect(s.score).toBe(0);
    expect(s.checks.length).toBeGreaterThan(0);
  });
  it("returns high score for ideal text", () => {
    // Build ideal text: 4 paragraphs, sentences ~17 words, 700+ words, varied vocab
    const sentenceTemplates = [
      "Email marketing remains one of the most effective digital channels for reaching engaged audiences directly.",
      "Successful campaigns require careful planning, audience segmentation, and continuous optimization based on performance data.",
      "Marketers should focus on delivering genuine value through personalized content rather than pushing aggressive sales messages.",
      "Modern email platforms offer sophisticated automation features that enable behavioral triggers and dynamic content delivery.",
      "Testing subject lines, send times, and call-to-action placement helps improve open rates and click-through performance.",
      "Compliance with regulations like GDPR and CAN-SPAM builds trust and protects your sender reputation long term.",
      "Building a quality subscriber list organically produces better engagement than purchasing contacts from third party vendors.",
      "Analyzing metrics such as bounce rate, unsubscribe rate, and conversion helps refine future marketing strategies.",
    ];
    const paragraphs = Array.from({ length: 4 }, (_, pIdx) =>
      Array.from({ length: 6 }, (_, sIdx) => sentenceTemplates[(pIdx * 6 + sIdx) % sentenceTemplates.length]).join(" ")
    ).join("\n\n");
    const s = computeSeoScore(paragraphs);
    expect(s.score).toBeGreaterThanOrEqual(60);
  });
  it("has checks array with passed boolean and hint", () => {
    const s = computeSeoScore("Hello world.");
    expect(s.checks[0].passed).toBeDefined();
    expect(typeof s.checks[0].hint).toBe("string");
  });
  it("returns appropriate label", () => {
    expect(computeSeoScore("").label).toMatch(/Needs work/i);
  });
});

describe("content-word-count analyze", () => {
  it("returns full analysis result", () => {
    const r = analyze("Hello world. This is a test paragraph.\n\nSecond paragraph here.");
    expect(r.stats.words).toBeGreaterThan(0);
    expect(r.topKeywords).toBeDefined();
    expect(r.sentenceLengthBuckets).toHaveLength(6);
    expect(r.paragraphStats.count).toBe(2);
    expect(r.seoScore.score).toBeGreaterThanOrEqual(0);
  });
});

describe("content-word-count formatReadingTime", () => {
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

describe("content-word-count constants", () => {
  it("has reasonable WPM defaults", () => {
    expect(DEFAULT_READING_WPM).toBe(200);
    expect(READING_WPM_250).toBe(250);
    expect(SPEAKING_WPM).toBe(130);
  });
  it("has a STOP_WORDS set", () => {
    expect(STOP_WORDS.has("the")).toBe(true);
    expect(STOP_WORDS.has("cat")).toBe(false);
  });
});

describe("content-word-count history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, wordCount: 100, seoScore: 60, snippet: "x" });
    saveHistory({ ts: 2, wordCount: 200, seoScore: 80, snippet: "y" });
    expect(loadHistory()).toHaveLength(2);
    expect(loadHistory()[0].wordCount).toBe(200);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, wordCount: 1, seoScore: 50, snippet: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, wordCount: 1, seoScore: 50, snippet: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("content-word-count shareable URL", () => {
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
