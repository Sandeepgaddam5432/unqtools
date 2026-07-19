import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_MAX,
  DEPTH_LABELS,
  DEPTH_SENTENCE_COUNT,
  DEPTH_KEY_IDEAS,
  DEPTH_TAKEAWAYS,
  MAX_CHUNK_CHARS,
  STOPWORDS,
  splitSentences,
  tokenize,
  countWords,
  countSyllables,
  computeWordFrequencies,
  extractKeywords,
  extractBigrams,
  extractKeyIdeas,
  splitChapters,
  chunkText,
  scoreSentence,
  summarizeChunk,
  hierarchicalMerge,
  extractPremise,
  extractTakeaways,
  generateQAPairs,
  summarizeChapter,
  buildOutline,
  renderOutlineText,
  analyzeBook,
  computeStats,
  renderMarkdown,
  renderJson,
  renderOutlineMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Depth,
  type Chapter,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

const SAMPLE_SHORT = "The cat sat on the mat. The dog ran fast. The sun was bright. It was a good day.";
const SAMPLE_LONGER =
  "Chapter 1: Introduction\n" +
  "This book explains how to build habits. Small habits compound over time. " +
  "The author argues that tiny changes lead to remarkable results. " +
  "You should focus on systems, not goals. Goals are about results; systems are about processes. " +
  "Make a habit obvious, attractive, easy, and satisfying.\n\n" +
  "Chapter 2: The Science of Habits\n" +
  "Habits form through a four-step loop: cue, craving, response, reward. " +
  "The cue triggers a craving, which motivates a response, which delivers a reward. " +
  "According to a 2009 study, it takes about 66 days to form a new habit. " +
  "Remember that progress is non-linear. You must be patient.\n\n" +
  "Chapter 3: Identity Change\n" +
  "True behavior change is identity change. Don't just set a goal to run a marathon; become a runner. " +
  "Your habits shape your identity, and your identity shapes your habits. " +
  "Every action you take is a vote for the type of person you wish to become.";

describe("ai-book-summary constants", () => {
  it("has 3 depth labels", () => {
    expect(Object.keys(DEPTH_LABELS)).toHaveLength(3);
    expect(DEPTH_LABELS["medium"]).toContain("3 sentences");
  });
  it("depth sentence counts are low < medium < high", () => {
    expect(DEPTH_SENTENCE_COUNT["low"]).toBeLessThan(DEPTH_SENTENCE_COUNT["medium"]);
    expect(DEPTH_SENTENCE_COUNT["medium"]).toBeLessThan(DEPTH_SENTENCE_COUNT["high"]);
  });
  it("depth key-idea counts are non-zero", () => {
    expect(DEPTH_KEY_IDEAS["low"]).toBeGreaterThanOrEqual(3);
    expect(DEPTH_KEY_IDEAS["high"]).toBeGreaterThanOrEqual(DEPTH_KEY_IDEAS["low"]);
  });
  it("depth takeaway counts are non-zero", () => {
    expect(DEPTH_TAKEAWAYS["low"]).toBeGreaterThanOrEqual(3);
  });
  it("MAX_CHUNK_CHARS is reasonable", () => {
    expect(MAX_CHUNK_CHARS).toBeGreaterThanOrEqual(1000);
    expect(MAX_CHUNK_CHARS).toBeLessThanOrEqual(20000);
  });
  it("STOPWORDS is a non-empty Set", () => {
    expect(STOPWORDS).toBeInstanceOf(Set);
    expect(STOPWORDS.size).toBeGreaterThan(50);
    expect(STOPWORDS.has("the")).toBe(true);
  });
});

describe("ai-book-summary text utilities", () => {
  it("splitSentences parses basic sentences", () => {
    const s = splitSentences("First one. Second one! Third?");
    expect(s).toHaveLength(3);
    expect(s[0].text).toBe("First one.");
    expect(s[1].text).toBe("Second one!");
  });
  it("splitSentences returns empty for empty input", () => {
    expect(splitSentences("")).toEqual([]);
  });
  it("tokenize strips punctuation and lowercases", () => {
    expect(tokenize("Hello, World! It's-me.")).toEqual(["hello", "world", "it's-me"]);
  });
  it("countWords counts whitespace-separated tokens", () => {
    expect(countWords("a b c")).toBe(3);
    expect(countWords("")).toBe(0);
  });
  it("countSyllables returns positive for any word", () => {
    expect(countSyllables("cat")).toBe(1);
    expect(countSyllables("apple")).toBeGreaterThanOrEqual(2);
  });
});

describe("ai-book-summary frequency & keywords", () => {
  it("computeWordFrequencies excludes stopwords", () => {
    const f = computeWordFrequencies(tokenize("the cat sat on the mat"));
    expect(f.has("the")).toBe(false);
    expect(f.has("on")).toBe(false);
    expect(f.get("cat")).toBe(1);
    expect(f.get("mat")).toBe(1);
  });
  it("extractKeywords returns top-N by frequency", () => {
    // habits: 3, systems: 3 (tie → alphabetical: habits < systems),
    // build: 2, goals: 1.
    const text = "habits habits habits systems systems systems build build goals";
    const kw = extractKeywords(text, 2);
    expect(kw[0]).toBe("habits");
    expect(kw[1]).toBe("systems");
  });
  it("extractKeywords returns empty for empty input", () => {
    expect(extractKeywords("", 5)).toEqual([]);
  });
  it("extractBigrams finds repeated 2-word phrases", () => {
    const text = "atomic habits atomic habits small changes small changes daily practice";
    const b = extractBigrams(text, 3);
    expect(b).toContain("atomic habits");
    expect(b).toContain("small changes");
  });
  it("extractKeyIdeas combines unigrams and bigrams", () => {
    const text = "habits habits habits atomic habits atomic habits goals systems systems";
    const ideas = extractKeyIdeas(text, 5);
    expect(ideas.length).toBeGreaterThan(0);
    expect(ideas.length).toBeLessThanOrEqual(5);
  });
});

describe("ai-book-summary chapter detection", () => {
  it("splitChapters returns 1 chapter for plain text", () => {
    const chapters = splitChapters("Just some plain text. No chapters here.");
    expect(chapters).toHaveLength(1);
    expect(chapters[0].title).toBe("Full text");
  });
  it("splitChapters detects 'Chapter N:' headings", () => {
    const chapters = splitChapters(SAMPLE_LONGER);
    expect(chapters.length).toBeGreaterThanOrEqual(3);
    expect(chapters[0].title).toContain("Introduction");
  });
  it("splitChapters assigns sequential indices", () => {
    const chapters = splitChapters(SAMPLE_LONGER);
    for (let i = 0; i < chapters.length; i++) {
      expect(chapters[i].index).toBe(i);
    }
  });
  it("splitChapters returns empty for empty input", () => {
    expect(splitChapters("")).toEqual([]);
  });
  it("splitChapters handles 'Part N' headings", () => {
    const text = "Part 1: Beginning\nThe beginning.\n\nPart 2: End\nThe end.";
    const chapters = splitChapters(text);
    expect(chapters.length).toBeGreaterThanOrEqual(2);
    expect(chapters[0].title).toContain("Beginning");
  });
});

describe("ai-book-summary chunking", () => {
  it("chunkText returns single chunk for short text", () => {
    expect(chunkText("Short text.")).toEqual(["Short text."]);
  });
  it("chunkText splits long text at sentence boundaries", () => {
    const long = "This is a sentence. ".repeat(500);
    const chunks = chunkText(long, 200);
    expect(chunks.length).toBeGreaterThan(1);
    // Each chunk (except possibly the last) should be <= maxChars.
    for (let i = 0; i < chunks.length - 1; i++) {
      expect(chunks[i].length).toBeLessThanOrEqual(200);
    }
  });
  it("chunkText returns empty for empty input", () => {
    expect(chunkText("")).toEqual([]);
  });
});

describe("ai-book-summary sentence scoring", () => {
  it("scoreSentence returns 0 for empty/all-stopword sentence", () => {
    const fm = new Map([["habits", 5]]);
    expect(scoreSentence("the the the", 0, 5, fm, [])).toBe(0);
  });
  it("scoreSentence rewards keyword presence", () => {
    const fm = new Map([["habits", 5]]);
    const withKw = scoreSentence("Habits are powerful.", 0, 5, fm, ["habits"]);
    const withoutKw = scoreSentence("Things are powerful.", 0, 5, fm, ["habits"]);
    expect(withKw).toBeGreaterThan(withoutKw);
  });
  it("scoreSentence boosts early sentences", () => {
    const fm = new Map([["cat", 1]]);
    const early = scoreSentence("The cat sat.", 0, 20, fm, []);
    const late = scoreSentence("The cat sat.", 18, 20, fm, []);
    expect(early).toBeGreaterThan(late);
  });
  it("scoreSentence penalizes very short sentences", () => {
    const fm = new Map([["cat", 5]]);
    const short = scoreSentence("Cat.", 0, 5, fm, []);
    const normal = scoreSentence("The cat sat on the mat today.", 0, 5, fm, []);
    expect(short).toBeLessThan(normal);
  });
});

describe("ai-book-summary chunk summarization", () => {
  it("summarizeChunk returns all sentences if fewer than N", () => {
    const text = "One. Two.";
    expect(summarizeChunk(text, 5)).toHaveLength(2);
  });
  it("summarizeChunk returns top N sentences in original order", () => {
    const text = "First sentence about cats. Second sentence about dogs. Third sentence about birds. " +
      "Fourth sentence about fish. Fifth sentence about cats again.";
    const summary = summarizeChunk(text, 2);
    expect(summary).toHaveLength(2);
    // Returned sentences must be in original order (not by score).
    const indices = summary.map((s) => text.indexOf(s));
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }
  });
  it("summarizeChunk returns empty for empty input", () => {
    expect(summarizeChunk("", 3)).toEqual([]);
  });
  it("hierarchicalMerge handles short text", () => {
    const text = "Sentence one about cats. Sentence two about dogs. Sentence three about birds.";
    const merged = hierarchicalMerge(text, 2, 10000);
    expect(merged.length).toBeGreaterThan(0);
    expect(merged.length).toBeLessThanOrEqual(2);
  });
  it("hierarchicalMerge chunks and re-summarizes long text", () => {
    let text = "";
    for (let i = 0; i < 30; i++) {
      text += `Sentence ${i} about topic number ${i} and a few more words to bulk it up. `;
    }
    const merged = hierarchicalMerge(text, 2, 300);
    expect(merged.length).toBeGreaterThan(0);
    expect(merged.length).toBeLessThanOrEqual(2);
  });
});

describe("ai-book-summary premise & takeaways", () => {
  it("extractPremise returns a non-empty string for non-empty input", () => {
    const p = extractPremise(SAMPLE_SHORT);
    expect(p.length).toBeGreaterThan(0);
  });
  it("extractPremise returns empty for empty input", () => {
    expect(extractPremise("")).toBe("");
  });
  it("extractTakeaways prefers sentences with cue phrases", () => {
    const sentences = [
      { text: "The cat sat on the mat." },
      { text: "You should always make habits obvious." },
      { text: "It was a sunny day." },
      { text: "Remember to start small." },
    ];
    const t = extractTakeaways(sentences, 2);
    expect(t).toHaveLength(2);
    expect(t.some((s) => s.includes("should"))).toBe(true);
    expect(t.some((s) => s.includes("Remember"))).toBe(true);
  });
  it("extractTakeaways falls back to first N when no cues found", () => {
    const sentences = [
      { text: "The cat sat on the mat." },
      { text: "The dog ran fast." },
    ];
    const t = extractTakeaways(sentences, 2);
    expect(t).toHaveLength(2);
  });
  it("extractTakeaways returns empty for empty input", () => {
    expect(extractTakeaways([], 3)).toEqual([]);
  });
});

describe("ai-book-summary Q&A generation", () => {
  it("generateQAPairs returns pairs with question and answer", () => {
    const text = "Habits are formed through repetition. The cue triggers the habit. The reward reinforces it.";
    const pairs = generateQAPairs("Chapter 1", text, ["Habits are formed through repetition."], ["habits", "cue", "reward"], 2);
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs[0].question).toContain("Chapter 1");
    expect(pairs[0].answer.length).toBeGreaterThan(0);
  });
  it("generateQAPairs returns empty when n is 0", () => {
    expect(generateQAPairs("X", "text", [], [], 0)).toEqual([]);
  });
});

describe("ai-book-summary chapter summarization", () => {
  it("summarizeChapter returns summary with all fields", () => {
    const chapter: Chapter = {
      index: 0, title: "Test", text: SAMPLE_SHORT, start: 0, end: SAMPLE_SHORT.length,
    };
    const cs = summarizeChapter(chapter, "medium");
    expect(cs.chapter).toBe(chapter);
    expect(cs.summary.length).toBeGreaterThan(0);
    expect(cs.keywords).toBeInstanceOf(Array);
    expect(cs.premise.length).toBeGreaterThan(0);
    expect(cs.wordCount).toBeGreaterThan(0);
    expect(cs.sentenceCount).toBe(4);
  });
  it("summarizeChapter respects depth (low < medium < high sentences)", () => {
    const longText = "Sentence one about cats. Sentence two about dogs. Sentence three about birds. " +
      "Sentence four about fish. Sentence five about cats again. Sentence six about dogs again.";
    const chapter: Chapter = {
      index: 0, title: "Test", text: longText, start: 0, end: longText.length,
    };
    const low = summarizeChapter(chapter, "low");
    const med = summarizeChapter(chapter, "medium");
    const high = summarizeChapter(chapter, "high");
    expect(low.summary.length).toBeLessThanOrEqual(med.summary.length);
    expect(med.summary.length).toBeLessThanOrEqual(high.summary.length);
  });
});

describe("ai-book-summary outline", () => {
  it("buildOutline produces nested structure", () => {
    const chapter: Chapter = {
      index: 0, title: "Chapter 1", text: "Some text.", start: 0, end: 10,
    };
    const cs = summarizeChapter(chapter, "medium");
    const outline = buildOutline("Book", [cs], ["idea1", "idea2"]);
    expect(outline).toHaveLength(1);
    expect(outline[0].title).toBe("Book");
    expect(outline[0].children.length).toBeGreaterThan(0);
  });
  it("renderOutlineText produces nested bullets", () => {
    const outline = [
      {
        title: "Root",
        children: [
          { title: "Child A", children: [] },
          { title: "Child B", children: [{ title: "Grandchild", children: [] }] },
        ],
      },
    ];
    const text = renderOutlineText(outline);
    expect(text).toContain("- Root");
    expect(text).toContain("- Child A");
    expect(text).toContain("  - Grandchild");
  });
});

describe("ai-book-summary analyzeBook (integration)", () => {
  it("returns empty report for empty input", () => {
    const r = analyzeBook("");
    expect(r.premise).toBe("");
    expect(r.chapterSummaries).toEqual([]);
    expect(r.stats.wordCount).toBe(0);
  });
  it("produces a premise and key ideas for non-empty text", () => {
    const r = analyzeBook(SAMPLE_LONGER, "medium");
    expect(r.premise.length).toBeGreaterThan(0);
    expect(r.keyIdeas.length).toBeGreaterThan(0);
    expect(r.stats.wordCount).toBeGreaterThan(20);
    expect(r.stats.chapterCount).toBeGreaterThanOrEqual(3);
    expect(r.stats.readingTimeMinutes).toBeGreaterThan(0);
  });
  it("respect depth for chapter count", () => {
    const rLow = analyzeBook(SAMPLE_LONGER, "low");
    const rHigh = analyzeBook(SAMPLE_LONGER, "high");
    expect(rLow.chapterSummaries.length).toBe(rHigh.chapterSummaries.length);
    expect(rHigh.chapterSummaries[0].summary.length).toBeGreaterThanOrEqual(
      rLow.chapterSummaries[0].summary.length,
    );
  });
  it("adds warnings for short text", () => {
    const r = analyzeBook("Very short.", "medium");
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.warnings.some((w) => w.includes("short"))).toBe(true);
  });
  it("adds warning when no chapters detected", () => {
    const r = analyzeBook("Just a few sentences. No chapter headings. Plain text only.", "medium");
    expect(r.warnings.some((w) => w.includes("No chapter"))).toBe(true);
  });
  it("computeStats returns the report stats", () => {
    const r = analyzeBook(SAMPLE_LONGER, "medium");
    const s = computeStats(r);
    expect(s.wordCount).toBe(r.stats.wordCount);
    expect(s.chapterCount).toBe(r.stats.chapterCount);
  });
});

describe("ai-book-summary renderers", () => {
  it("renderMarkdown contains all sections", () => {
    const r = analyzeBook(SAMPLE_LONGER, "medium");
    const md = renderMarkdown(r);
    expect(md).toContain("# Book Summary");
    expect(md).toContain("## Premise");
    expect(md).toContain("## Key ideas");
    expect(md).toContain("## Overall summary");
    expect(md).toContain("## Chapter breakdown");
    expect(md).toContain("## Takeaways");
    expect(md).toContain("## Outline");
  });
  it("renderJson produces valid JSON", () => {
    const r = analyzeBook(SAMPLE_LONGER, "medium");
    const json = renderJson(r);
    const parsed = JSON.parse(json);
    expect(parsed.premise).toBeDefined();
    expect(parsed.chapterSummaries).toBeInstanceOf(Array);
  });
  it("renderOutlineMarkdown produces nested bullets", () => {
    const r = analyzeBook(SAMPLE_LONGER, "medium");
    const out = renderOutlineMarkdown(r);
    expect(out).toContain("- ");
  });
});

describe("ai-book-summary history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, title: "Book", wordCount: 100, chapterCount: 3, depth: "medium" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, title: `B${i}`, wordCount: i, chapterCount: 1, depth: "medium" });
    }
    expect(loadHistory()).toHaveLength(HISTORY_MAX);
  });
  it("clears history", () => {
    saveHistory({ ts: 1, title: "X", wordCount: 1, chapterCount: 1, depth: "medium" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-book-summary shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("hello world", "high");
    expect(url).toMatch(/text=hello(?:%20|\+)world/);
    expect(url).toContain("depth=high");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("text=hello%20world&depth=low");
    expect(p.text).toBe("hello world");
    expect(p.depth).toBe("low");
  });
  it("defaults depth to medium when not specified", () => {
    const p = parseShareUrl("text=foo");
    expect(p.depth).toBe("medium");
  });
  it("rejects invalid depth", () => {
    const p = parseShareUrl("text=foo&depth=bogus");
    expect(p.depth).toBe("medium");
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.text).toBe("");
    expect(p.depth).toBe("medium");
  });
});

describe("ai-book-summary LLM enhancement", () => {
  it("buildLlmPrompt includes the text and JSON instructions", () => {
    const p = buildLlmPrompt("This is a book about habits.", "medium");
    expect(p).toContain("JSON object");
    expect(p).toContain("premise");
    expect(p).toContain("This is a book about habits.");
  });
  it("renderLlmResult parses valid JSON", () => {
    const raw = JSON.stringify({
      premise: "Habits shape identity.",
      keyIdeas: ["atomic habits", "compound growth"],
      overallSummary: ["Small habits compound."],
      takeaways: ["Start small."],
      chapterSummaries: [{ title: "Chapter 1", summary: ["Sentence one."] }],
      reasoning: ["Picked top sentence."],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.premise).toBe("Habits shape identity.");
      expect(r.result.keyIdeas).toHaveLength(2);
      expect(r.result.chapterSummaries).toHaveLength(1);
    }
  });
  it("renderLlmResult parses JSON wrapped in code fence", () => {
    const raw = "```json\n" + JSON.stringify({ premise: "X" }) + "\n```";
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
  });
  it("renderLlmResult rejects invalid JSON", () => {
    const r = renderLlmResult("not valid json");
    expect(r.ok).toBe(false);
  });
  it("renderLlmResult rejects arrays", () => {
    const r = renderLlmResult("[1,2,3]");
    expect(r.ok).toBe(false);
  });
});

// Suppress unused-import lint for type-only exports.
export type _Unused = Depth | Chapter;
