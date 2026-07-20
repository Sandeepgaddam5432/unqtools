import { describe, it, expect, beforeEach } from "vitest";
import {
  STOP_WORDS,
  LENGTH_FRACTIONS,
  DEFAULT_CHUNK_SIZE,
  DEFAULT_KEYWORD_COUNT,
  DEFAULT_KEYPOINT_COUNT,
  CHUNK_THRESHOLD,
  splitParagraphs,
  splitSentences,
  tokenizeWords,
  removeStopWords,
  countWords,
  countSentences,
  buildTermFreq,
  buildInverseDocFreq,
  sentenceTfidf,
  extractKeywords,
  scoreByPosition,
  scoreByKeyword,
  scoreByLength,
  scoreSentences,
  pickTopSentences,
  summaryLengthCount,
  chunkSentences,
  summarizeChunk,
  mapReduceSummarize,
  summarize,
  renderParagraph,
  renderBullets,
  renderMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  type SummaryLength,
  type OutputFormat,
  type Paragraph,
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

const SAMPLE = `The quick brown fox jumps over the lazy dog. Foxes are clever animals that hunt at night. They live in forests and urban areas alike.

Dogs, on the other hand, are loyal companions. They have been bred for thousands of years. Many breeds exist today, from tiny terriers to giant mastiffs.

Both animals share our world. Understanding them helps us appreciate nature.`;

describe("ai-paragraph-summarizer constants", () => {
  it("has length fractions for short/medium/long", () => {
    expect(LENGTH_FRACTIONS.short).toBeLessThan(LENGTH_FRACTIONS.medium);
    expect(LENGTH_FRACTIONS.medium).toBeLessThan(LENGTH_FRACTIONS.long);
  });
  it("has stop words", () => {
    expect(STOP_WORDS.size).toBeGreaterThan(50);
    expect(STOP_WORDS.has("the")).toBe(true);
    expect(STOP_WORDS.has("fox")).toBe(false);
  });
  it("has defaults", () => {
    expect(DEFAULT_CHUNK_SIZE).toBeGreaterThan(0);
    expect(DEFAULT_KEYWORD_COUNT).toBeGreaterThan(0);
    expect(DEFAULT_KEYPOINT_COUNT).toBeGreaterThan(0);
    expect(CHUNK_THRESHOLD).toBeGreaterThan(0);
  });
});

describe("ai-paragraph-summarizer text splitting", () => {
  it("splits paragraphs on double newlines", () => {
    const p = splitParagraphs(SAMPLE);
    expect(p.length).toBe(3);
  });
  it("returns single paragraph when no double newlines", () => {
    expect(splitParagraphs("Just one paragraph. Two sentences.")).toHaveLength(1);
  });
  it("returns empty for empty input", () => {
    expect(splitParagraphs("")).toEqual([]);
    expect(splitParagraphs("   ")).toEqual([]);
  });
  it("splits sentences on period+capital", () => {
    const s = splitSentences("Hello world. This is a test. Bye now.");
    expect(s).toHaveLength(3);
  });
  it("filters out empty sentences", () => {
    expect(splitSentences("")).toEqual([]);
    expect(splitSentences("   ")).toEqual([]);
  });
  it("tokenizes words", () => {
    const w = tokenizeWords("Hello, world! It's a test-case.");
    expect(w).toContain("hello");
    expect(w).toContain("world");
    expect(w).toContain("it's");
    expect(w).toContain("test-case");
  });
  it("removes stop words", () => {
    const w = removeStopWords(tokenizeWords("The fox is in the forest"));
    expect(w).toEqual(["fox", "forest"]);
  });
  it("counts words", () => {
    expect(countWords("Hello world from a test")).toBe(5);
    expect(countWords("")).toBe(0);
  });
  it("counts sentences", () => {
    expect(countSentences("One. Two. Three.")).toBe(3);
    expect(countSentences("")).toBe(0);
  });
});

describe("ai-paragraph-summarizer TF-IDF", () => {
  it("builds term frequency map", () => {
    const tf = buildTermFreq(["fox", "fox", "dog"]);
    expect(tf.get("fox")).toBe(2);
    expect(tf.get("dog")).toBe(1);
  });
  it("builds IDF across sentences", () => {
    const idf = buildInverseDocFreq(["the fox runs", "the dog runs", "fox only"]);
    // 'fox' appears in 2 of 3 → idf < 'dog' which appears in 1 of 3
    expect(idf.has("fox")).toBe(true);
    expect(idf.has("dog")).toBe(true);
    expect(idf.get("dog")!).toBeGreaterThan(idf.get("fox")!);
  });
  it("computes per-sentence TF-IDF", () => {
    const idf = buildInverseDocFreq(["the fox runs fast", "the dog runs slow"]);
    const score1 = sentenceTfidf("the fox runs fast", idf);
    const score2 = sentenceTfidf("the dog runs slow", idf);
    expect(score1).toBeGreaterThan(0);
    expect(score2).toBeGreaterThan(0);
  });
  it("returns 0 for stop-word-only sentence", () => {
    const idf = buildInverseDocFreq(["the fox runs", "the dog runs"]);
    expect(sentenceTfidf("the and a of", idf)).toBe(0);
  });
});

describe("ai-paragraph-summarizer keyword extraction", () => {
  it("extracts top keywords", () => {
    const kws = extractKeywords(splitSentences(SAMPLE), 5);
    expect(kws.length).toBeLessThanOrEqual(5);
    expect(kws.length).toBeGreaterThan(0);
  });
  it("respects N limit", () => {
    const sentences = splitSentences(SAMPLE);
    expect(extractKeywords(sentences, 3).length).toBeLessThanOrEqual(3);
  });
  it("returns empty for no sentences", () => {
    expect(extractKeywords([], 5)).toEqual([]);
  });
});

describe("ai-paragraph-summarizer scoring", () => {
  it("scores position: first/last get bonus", () => {
    expect(scoreByPosition(0, 5)).toBe(1.0);
    expect(scoreByPosition(4, 5)).toBe(1.0);
    expect(scoreByPosition(2, 5)).toBeLessThan(1.0);
  });
  it("scores single-sentence paragraph as 1", () => {
    expect(scoreByPosition(0, 1)).toBe(1.0);
  });
  it("scores keyword presence", () => {
    const score = scoreByKeyword("foxes are clever animals", ["foxes", "animals"]);
    expect(score).toBe(1.0);
  });
  it("scores keyword absence as 0", () => {
    expect(scoreByKeyword("nothing relevant here", ["foxes"])).toBe(0);
  });
  it("scores length: ideal range = 1", () => {
    expect(scoreByLength(15)).toBe(1.0);
    expect(scoreByLength(20)).toBe(1.0);
  });
  it("penalizes very short sentences", () => {
    expect(scoreByLength(2)).toBeLessThan(0.5);
  });
  it("penalizes very long sentences", () => {
    expect(scoreByLength(50)).toBeLessThan(1.0);
  });
  it("scoreSentences returns one entry per sentence", () => {
    const paragraphs: Paragraph[] = [
      { index: 0, text: "A. B. C.", sentences: ["A.", "B.", "C."] },
      { index: 1, text: "D. E.", sentences: ["D.", "E."] },
    ];
    const scored = scoreSentences(paragraphs, []);
    expect(scored).toHaveLength(5);
    expect(scored[0].globalIndex).toBe(0);
    expect(scored[4].globalIndex).toBe(4);
    expect(scored[3].paragraphIndex).toBe(1);
    expect(scored[3].localIndex).toBe(0);
  });
});

describe("ai-paragraph-summarizer selection", () => {
  it("pickTopSentences returns N sentences in original order", () => {
    const paragraphs: Paragraph[] = [
      {
        index: 0,
        text: "",
        sentences: ["Alpha sentence one.", "Beta sentence two.", "Gamma sentence three."],
      },
    ];
    const scored = scoreSentences(paragraphs, []);
    const top2 = pickTopSentences(scored, 2);
    expect(top2).toHaveLength(2);
    // Sorted by globalIndex
    expect(top2[0].globalIndex).toBeLessThan(top2[1].globalIndex);
  });
  it("pickTopSentences returns empty for n<=0", () => {
    expect(pickTopSentences([], 0)).toEqual([]);
    expect(pickTopSentences([], -1)).toEqual([]);
  });
  it("summaryLengthCount maps lengths to fractions", () => {
    expect(summaryLengthCount("short", 100)).toBe(15);
    expect(summaryLengthCount("medium", 100)).toBe(30);
    expect(summaryLengthCount("long", 100)).toBe(50);
  });
  it("summaryLengthCount returns at least 1", () => {
    expect(summaryLengthCount("short", 1)).toBe(1);
  });
});

describe("ai-paragraph-summarizer chunking", () => {
  it("chunks sentences by size", () => {
    const sentences = Array.from({ length: 10 }, (_, i) => `Sentence ${i}.`);
    const chunks = chunkSentences(sentences, 4);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(4);
    expect(chunks[2]).toHaveLength(2);
  });
  it("returns single chunk for small input", () => {
    expect(chunkSentences(["A.", "B."], 100)).toHaveLength(1);
  });
  it("returns empty for empty input", () => {
    expect(chunkSentences([], 10)).toEqual([]);
  });
  it("summarizeChunk returns picked sentences", () => {
    const chunk = [
      "The quick brown fox jumps.",
      "Foxes are clever animals.",
      "They hunt at night.",
      "Dogs are loyal companions.",
      "Both animals share our world.",
    ];
    const out = summarizeChunk(chunk, "short");
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThanOrEqual(chunk.length);
  });
  it("mapReduceSummarize returns one ChunkSummary per chunk", () => {
    const sentences = Array.from({ length: 150 }, (_, i) => `Sentence number ${i} is here.`);
    const paragraphs: Paragraph[] = [
      { index: 0, text: sentences.join(" "), sentences },
    ];
    const chunks = mapReduceSummarize(paragraphs, "medium", 60);
    expect(chunks.length).toBe(3);
    expect(chunks[0].chunkIndex).toBe(0);
    expect(chunks[0].startSentence).toBe(0);
    expect(chunks[2].endSentence).toBe(149);
  });
});

describe("ai-paragraph-summarizer main entry", () => {
  it("returns summary for short text", () => {
    const r = summarize(SAMPLE, { length: "short" });
    expect(r.summary.length).toBeGreaterThan(0);
    expect(r.stats.originalWordCount).toBeGreaterThan(0);
    expect(r.stats.summaryWordCount).toBeGreaterThan(0);
    expect(r.stats.compressionRatio).toBeGreaterThan(0);
    expect(r.stats.compressionRatio).toBeLessThanOrEqual(1);
    expect(r.stats.paragraphCount).toBe(3);
    expect(r.warnings).toEqual([]);
  });
  it("returns bullets when format=bullets", () => {
    const r = summarize(SAMPLE, { length: "medium", format: "bullets" });
    expect(r.bullets.length).toBeGreaterThan(0);
    expect(r.bullets[0]).toMatch(/^- /);
  });
  it("returns keywords and key points", () => {
    const r = summarize(SAMPLE, { length: "medium", keywordCount: 5, keyPointCount: 3 });
    expect(r.keywords.length).toBeGreaterThan(0);
    expect(r.keyPoints.length).toBeGreaterThan(0);
    expect(r.keyPoints.length).toBeLessThanOrEqual(3);
  });
  it("long input triggers map-reduce warning", () => {
    const big = Array.from({ length: 100 }, (_, i) => `Sentence number ${i} is here and contains meaningful words.`).join(" ");
    const r = summarize(big, { length: "medium" });
    expect(r.stats.originalSentenceCount).toBeGreaterThan(CHUNK_THRESHOLD);
    expect(r.stats.chunkCount).toBeGreaterThan(1);
    expect(r.warnings.some((w) => w.includes("map-reduce"))).toBe(true);
  });
  it("empty input returns empty result", () => {
    const r = summarize("", { length: "medium" });
    expect(r.summary).toBe("");
    expect(r.bullets).toEqual([]);
    expect(r.stats.originalWordCount).toBe(0);
  });
  it("whitespace-only input returns empty result", () => {
    const r = summarize("   \n\n  ", { length: "medium" });
    expect(r.summary).toBe("");
  });
  it("text without sentence terminators returns the full text as summary", () => {
    const r = summarize("no punctuation here just words");
    expect(r.summary).toBe("no punctuation here just words");
    expect(r.stats.originalSentenceCount).toBe(1);
    expect(r.stats.summarySentenceCount).toBe(1);
    expect(r.stats.compressionRatio).toBe(1);
  });
});

describe("ai-paragraph-summarizer rendering", () => {
  it("renders paragraph by joining sentences", () => {
    const s = renderParagraph(["One.", "Two.", "Three."]);
    expect(s).toBe("One. Two. Three.");
  });
  it("renders bullets as markdown list", () => {
    const b = renderBullets(["One.", "Two."]);
    expect(b).toEqual(["- One.", "- Two."]);
  });
  it("renders markdown with stats + keywords + key points + summary", () => {
    const r = summarize(SAMPLE, { length: "medium" });
    const md = renderMarkdown(r);
    expect(md).toContain("# Summary");
    expect(md).toContain("Compression:");
    expect(md).toContain("## Summary");
  });
});

describe("ai-paragraph-summarizer history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      length: "medium",
      format: "paragraph",
      originalWordCount: 100,
      summaryWordCount: 30,
      compressionRatio: 0.3,
      preview: "preview",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        length: "medium",
        format: "paragraph",
        originalWordCount: 100,
        summaryWordCount: 30,
        compressionRatio: 0.3,
        preview: `preview-${i}`,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, length: "medium", format: "paragraph",
      originalWordCount: 1, summaryWordCount: 1, compressionRatio: 1, preview: "x",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-paragraph-summarizer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("hello world", "short", "bullets");
    expect(url).toContain("text=hello+world");
    expect(url).toContain("length=short");
    expect(url).toContain("format=bullets");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("text=hello+world&length=short&format=bullets");
    expect(p.text).toBe("hello world");
    expect(p.length).toBe("short");
    expect(p.format).toBe("bullets");
  });
  it("handles empty hash with defaults", () => {
    expect(parseShareUrl("")).toEqual({ text: "", length: "medium", format: "paragraph" });
  });
  it("filters invalid length/format", () => {
    const p = parseShareUrl("text=hi&length=invalid&format=invalid");
    expect(p.length).toBe("medium");
    expect(p.format).toBe("paragraph");
  });
});

describe("ai-paragraph-summarizer LLM prompt builder", () => {
  it("builds system + user prompts with length target", () => {
    const p = buildLlmPrompt("some text", "short", "paragraph");
    expect(p.system).toContain("summarization");
    expect(p.user).toContain("≈50 words");
    expect(p.user).toContain("some text");
  });
  it("medium length has ≈120 words", () => {
    expect(buildLlmPrompt("x", "medium", "paragraph").user).toContain("≈120 words");
  });
  it("long length has ≈250 words", () => {
    expect(buildLlmPrompt("x", "long", "paragraph").user).toContain("≈250 words");
  });
  it("bullet format mentions bullets", () => {
    expect(buildLlmPrompt("x", "short", "bullets").user).toContain("bullets");
  });
});

// Suppress unused-import lint
export type _Unused = SummaryLength | OutputFormat;
