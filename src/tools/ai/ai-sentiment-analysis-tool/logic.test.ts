import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  DEFAULT_THRESHOLD,
  SENTIMENT_LABELS,
  SENTIMENT_COLORS,
  EMOTION_LABELS,
  EMOTION_EMOJIS,
  LEXICON,
  NEGATION_WORDS,
  BOOSTER_WORDS,
  DAMPENER_WORDS,
  ASPECT_PATTERNS,
  lookupWord,
  tokenize,
  splitSentences,
  isNegation,
  isBooster,
  isDampener,
  analyzeTokens,
  computeSentenceScore,
  labelFromScore,
  computeConfidence,
  extractAspects,
  analyzeSentence,
  analyzeDocument,
  parseCsv,
  buildCsv,
  analyzeCsv,
  summarizeCsv,
  renderDocumentCsv,
  renderDocumentJson,
  renderHighlightedHtml,
  renderCsvResultsCsv,
  renderCsvResultsJson,
  buildLlmPrompt,
  renderLlmResult,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Sentiment,
  type Emotion,
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

// ---------- Constants ----------

describe("ai-sentiment-analysis constants", () => {
  it("has 200+ lexicon entries", () => {
    expect(LEXICON.length).toBeGreaterThanOrEqual(200);
  });
  it("every lexicon entry has unique lowercase word", () => {
    const words = LEXICON.map((e) => e.word);
    expect(new Set(words).size).toBe(words.length);
    expect(words.every((w) => w === w.toLowerCase())).toBe(true);
  });
  it("every lexicon entry has a score in [-1, +1]", () => {
    for (const e of LEXICON) {
      expect(e.score).toBeGreaterThanOrEqual(-1);
      expect(e.score).toBeLessThanOrEqual(1);
    }
  });
  it("has 3 sentiment labels + colors", () => {
    expect(Object.keys(SENTIMENT_LABELS)).toHaveLength(3);
    expect(Object.keys(SENTIMENT_COLORS)).toHaveLength(3);
  });
  it("has 8 emotion labels + emojis", () => {
    expect(Object.keys(EMOTION_LABELS)).toHaveLength(8);
    expect(Object.keys(EMOTION_EMOJIS)).toHaveLength(8);
  });
  it("default threshold is 0.15", () => {
    expect(DEFAULT_THRESHOLD).toBe(0.15);
  });
  it("has at least 20 negation words", () => {
    expect(NEGATION_WORDS.size).toBeGreaterThanOrEqual(20);
    expect(NEGATION_WORDS.has("not")).toBe(true);
    expect(NEGATION_WORDS.has("never")).toBe(true);
  });
  it("has at least 15 booster words", () => {
    expect(BOOSTER_WORDS.size).toBeGreaterThanOrEqual(15);
    expect(BOOSTER_WORDS.has("very")).toBe(true);
    expect(BOOSTER_WORDS.has("extremely")).toBe(true);
  });
  it("has at least 10 dampener words", () => {
    expect(DAMPENER_WORDS.size).toBeGreaterThanOrEqual(10);
    expect(DAMPENER_WORDS.has("slightly")).toBe(true);
    expect(DAMPENER_WORDS.has("somewhat")).toBe(true);
  });
  it("has 10 aspect patterns", () => {
    expect(ASPECT_PATTERNS.length).toBeGreaterThanOrEqual(10);
    expect(ASPECT_PATTERNS.some((p) => p.aspect === "battery")).toBe(true);
    expect(ASPECT_PATTERNS.some((p) => p.aspect === "price")).toBe(true);
  });
  it("uses a namespaced history key", () => {
    expect(HISTORY_KEY).toContain("ai-sentiment-analysis-tool");
  });
  it("history max is 20", () => {
    expect(HISTORY_MAX).toBe(20);
  });
});

// ---------- Lexicon lookup ----------

describe("ai-sentiment-analysis lookupWord", () => {
  it("looks up a known positive word", () => {
    const e = lookupWord("great");
    expect(e).toBeDefined();
    expect(e!.score).toBeGreaterThan(0);
  });
  it("looks up a known negative word", () => {
    const e = lookupWord("terrible");
    expect(e).toBeDefined();
    expect(e!.score).toBeLessThan(0);
  });
  it("returns undefined for unknown word", () => {
    expect(lookupWord("supercalifragilistic")).toBeUndefined();
  });
  it("is case-insensitive", () => {
    expect(lookupWord("GREAT")?.word).toBe("great");
    expect(lookupWord("Great")?.word).toBe("great");
  });
});

// ---------- Tokenization ----------

describe("ai-sentiment-analysis tokenize + splitSentences", () => {
  it("tokenize splits a sentence into word + non-word tokens", () => {
    const toks = tokenize("This is great!");
    expect(toks).toContain("this");
    expect(toks).toContain("great");
    expect(toks).toContain("!");
  });
  it("tokenize returns empty for empty input", () => {
    expect(tokenize("")).toEqual([]);
  });
  it("splitSentences splits on . ! ?", () => {
    const s = splitSentences("First sentence. Second one! Third?");
    expect(s).toHaveLength(3);
    expect(s[0]).toBe("First sentence.");
  });
  it("splitSentences returns empty for empty input", () => {
    expect(splitSentences("")).toEqual([]);
    expect(splitSentences("   ")).toEqual([]);
  });
  it("splitSentences preserves a single sentence", () => {
    expect(splitSentences("Just one sentence")).toEqual(["Just one sentence"]);
  });
});

// ---------- Negation + modifiers ----------

describe("ai-sentiment-analysis negation + modifiers", () => {
  it("isNegation detects negation words", () => {
    expect(isNegation("not")).toBe(true);
    expect(isNegation("NOT")).toBe(true);
    expect(isNegation("happy")).toBe(false);
  });
  it("isBooster detects boosters", () => {
    expect(isBooster("very")).toBe(true);
    expect(isBooster("happy")).toBe(false);
  });
  it("isDampener detects dampeners", () => {
    expect(isDampener("slightly")).toBe(true);
    expect(isDampener("happy")).toBe(false);
  });
  it("analyzeTokens attaches lexicon entries", () => {
    const toks = analyzeTokens(tokenize("great product"));
    expect(toks[0].lexicon?.word).toBe("great");
    expect(toks[0].effectiveScore).toBeGreaterThan(0);
  });
  it("analyzeTokens flips polarity on negation", () => {
    const pos = analyzeTokens(tokenize("good"));
    const neg = analyzeTokens(tokenize("not good"));
    expect(pos[0].effectiveScore).toBeGreaterThan(0);
    expect(neg[1].effectiveScore).toBeLessThan(0);
  });
  it("analyzeTokens amplifies with booster", () => {
    const base = analyzeTokens(tokenize("good"));
    const boosted = analyzeTokens(tokenize("very good"));
    expect(boosted[1].effectiveScore).toBeGreaterThan(base[0].effectiveScore);
  });
  it("analyzeTokens dampens with dampener", () => {
    const base = analyzeTokens(tokenize("good"));
    const damp = analyzeTokens(tokenize("slightly good"));
    expect(Math.abs(damp[1].effectiveScore)).toBeLessThan(Math.abs(base[0].effectiveScore));
  });
});

// ---------- Sentence scoring ----------

describe("ai-sentiment-analysis sentence scoring", () => {
  it("computeSentenceScore returns 0 for no lexicon hits", () => {
    expect(computeSentenceScore(analyzeTokens(tokenize("the of and")))).toBe(0);
  });
  it("computeSentenceScore returns positive for positive words", () => {
    const toks = analyzeTokens(tokenize("great amazing wonderful"));
    expect(computeSentenceScore(toks)).toBeGreaterThan(0);
  });
  it("computeSentenceScore returns negative for negative words", () => {
    const toks = analyzeTokens(tokenize("terrible awful bad"));
    expect(computeSentenceScore(toks)).toBeLessThan(0);
  });
  it("computeSentenceScore is in [-1, +1]", () => {
    const toks = analyzeTokens(tokenize("great amazing wonderful excellent fantastic best perfect"));
    const score = computeSentenceScore(toks);
    expect(score).toBeGreaterThanOrEqual(-1);
    expect(score).toBeLessThanOrEqual(1);
  });
  it("labelFromScore thresholds", () => {
    expect(labelFromScore(0.5)).toBe("positive");
    expect(labelFromScore(-0.5)).toBe("negative");
    expect(labelFromScore(0.05)).toBe("neutral");
    expect(labelFromScore(-0.05)).toBe("neutral");
  });
  it("labelFromScore respects custom threshold", () => {
    expect(labelFromScore(0.2, 0.3)).toBe("neutral");
    expect(labelFromScore(0.4, 0.3)).toBe("positive");
  });
  it("computeConfidence scales with hits", () => {
    expect(computeConfidence(0, 0)).toBe("low");
    expect(computeConfidence(1, 10)).toBe("medium");
    expect(computeConfidence(5, 20)).toBe("high");
  });
});

// ---------- Aspect extraction ----------

describe("ai-sentiment-analysis aspect extraction", () => {
  it("extracts an aspect when a cue is present", () => {
    const text = "The battery life is great.";
    const toks = analyzeTokens(tokenize(text));
    const aspects = extractAspects(text, toks);
    expect(aspects.some((a) => a.aspect === "battery")).toBe(true);
  });
  it("aspects inherit sentiment from surrounding window", () => {
    const text = "The battery life is terrible.";
    const aspects = extractAspects(text, analyzeTokens(tokenize(text)));
    const battery = aspects.find((a) => a.aspect === "battery");
    expect(battery).toBeDefined();
    expect(battery!.sentiment).toBe("negative");
  });
  it("returns empty when no cues present", () => {
    const text = "The weather is nice today.";
    const aspects = extractAspects(text, analyzeTokens(tokenize(text)));
    expect(aspects).toEqual([]);
  });
});

// ---------- Sentence analysis ----------

describe("ai-sentiment-analysis analyzeSentence", () => {
  it("classifies a clearly positive sentence", () => {
    const r = analyzeSentence("This product is amazing and wonderful!");
    expect(r.sentiment).toBe("positive");
    expect(r.score).toBeGreaterThan(0);
    expect(r.positiveWords).toContain("amazing");
  });
  it("classifies a clearly negative sentence", () => {
    const r = analyzeSentence("This product is terrible and awful.");
    expect(r.sentiment).toBe("negative");
    expect(r.score).toBeLessThan(0);
    expect(r.negativeWords).toContain("terrible");
  });
  it("handles negation at sentence level", () => {
    const r = analyzeSentence("This is not good.");
    expect(r.sentiment).toBe("negative");
    expect(r.score).toBeLessThan(0);
  });
  it("handles booster at sentence level", () => {
    const r1 = analyzeSentence("This is good.");
    const r2 = analyzeSentence("This is very good.");
    expect(r2.score).toBeGreaterThan(r1.score);
  });
  it("returns neutral for text with no sentiment words", () => {
    const r = analyzeSentence("The book is on the table.");
    expect(r.sentiment).toBe("neutral");
    expect(r.score).toBe(0);
    expect(r.positiveWords).toEqual([]);
    expect(r.negativeWords).toEqual([]);
  });
  it("collects emotions from hits", () => {
    const r = analyzeSentence("I am happy and excited!");
    expect(r.emotions).toContain("joy");
    expect(r.emotions).toContain("anticipation");
  });
  it("returns confidence level", () => {
    const r = analyzeSentence("This is absolutely great, wonderful, and amazing!");
    expect(r.confidence).toBe("high");
  });
});

// ---------- Document analysis ----------

describe("ai-sentiment-analysis analyzeDocument", () => {
  it("analyzes a multi-sentence document", () => {
    const doc = analyzeDocument("I love this product. The service is terrible.");
    expect(doc.sentences).toHaveLength(2);
    expect(doc.positiveCount).toBe(1);
    expect(doc.negativeCount).toBe(1);
    expect(doc.stats.sentenceCount).toBe(2);
    expect(doc.stats.wordCount).toBeGreaterThan(0);
  });
  it("overall sentiment reflects the mean of sentence scores", () => {
    const doc = analyzeDocument("This is great. This is amazing. This is wonderful.");
    expect(doc.sentiment).toBe("positive");
    expect(doc.score).toBeGreaterThan(0.15);
  });
  it("emotion profile aggregates across sentences", () => {
    const doc = analyzeDocument("I am happy. I am joyful. I am delighted.");
    const joy = doc.emotionProfile.find((e) => e.emotion === "joy");
    expect(joy!.count).toBeGreaterThanOrEqual(3);
  });
  it("returns empty sentences for empty input", () => {
    const doc = analyzeDocument("");
    expect(doc.sentences).toEqual([]);
    expect(doc.score).toBe(0);
    expect(doc.sentiment).toBe("neutral");
    expect(doc.stats.sentenceCount).toBe(0);
  });
  it("aspects aggregate at the document level", () => {
    const doc = analyzeDocument("The battery is great. The screen is terrible.");
    const aspects = doc.aspects;
    expect(aspects.some((a) => a.aspect === "battery")).toBe(true);
    expect(aspects.some((a) => a.aspect === "screen")).toBe(true);
  });
});

// ---------- CSV parsing ----------

describe("ai-sentiment-analysis CSV parsing", () => {
  it("parseCsv splits simple rows", () => {
    const rows = parseCsv("a,b,c\n1,2,3");
    expect(rows).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });
  it("parseCsv handles quoted commas", () => {
    const rows = parseCsv('"a,b",c\n"1,2",3');
    expect(rows[0]).toEqual(["a,b", "c"]);
    expect(rows[1]).toEqual(["1,2", "3"]);
  });
  it("parseCsv handles embedded newlines in quoted fields", () => {
    const rows = parseCsv('"line1\nline2",b\n1,2');
    expect(rows[0][0]).toBe("line1\nline2");
    expect(rows[0][1]).toBe("b");
  });
  it("parseCsv skips blank rows", () => {
    const rows = parseCsv("a,b\n\n1,2\n");
    expect(rows).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("buildCsv escapes commas + quotes", () => {
    const csv = buildCsv([["a,b", 'c"d'], ["1", "2"]]);
    expect(csv).toContain('"a,b"');
    expect(csv).toContain('"c""d"');
  });
  it("buildCsv round-trips with parseCsv", () => {
    const orig = [["hello, world", "foo"], ["bar", "baz"]];
    const csv = buildCsv(orig);
    const parsed = parseCsv(csv);
    expect(parsed).toEqual(orig);
  });
});

// ---------- CSV analysis ----------

describe("ai-sentiment-analysis analyzeCsv + summarizeCsv", () => {
  const csvText = [
    "id,text",
    "1,This product is amazing and great!",
    "2,This is terrible and awful.",
    "3,It is okay.",
    "4,I love it so much!",
    "5,Worst experience ever, broken and useless.",
  ].join("\n");

  it("analyzes each row and assigns sentiment", () => {
    const rows = analyzeCsv(csvText, 1);
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(rows[0].sentiment).toBe("positive");
    expect(rows[1].sentiment).toBe("negative");
  });
  it("summarizeCsv returns counts + top positive/negative", () => {
    const rows = analyzeCsv(csvText, 1);
    const summary = summarizeCsv(rows);
    expect(summary.totalRows).toBeGreaterThanOrEqual(5);
    expect(summary.positive).toBeGreaterThan(0);
    expect(summary.negative).toBeGreaterThan(0);
    expect(summary.topPositive[0].score).toBeGreaterThan(summary.topNegative[0].score);
    expect(summary.meanScore).toBeGreaterThanOrEqual(-1);
    expect(summary.meanScore).toBeLessThanOrEqual(1);
  });
  it("summarizeCsv handles empty input", () => {
    const s = summarizeCsv([]);
    expect(s.totalRows).toBe(0);
    expect(s.meanScore).toBe(0);
  });
  it("analyzeCsv with invalid column returns empty", () => {
    expect(analyzeCsv(csvText, 99)).toEqual([]);
  });
  it("renderCsvResultsCsv emits header + rows", () => {
    const rows = analyzeCsv(csvText, 1);
    const out = renderCsvResultsCsv(rows);
    expect(out).toContain("row,sentiment,score,confidence,emotions,text");
    expect(out.split("\n").length).toBe(rows.length + 1);
  });
  it("renderCsvResultsJson emits valid JSON", () => {
    const rows = analyzeCsv(csvText, 1);
    const out = renderCsvResultsJson(rows);
    const parsed = JSON.parse(out);
    expect(parsed.length).toBe(rows.length);
  });
});

// ---------- Document rendering ----------

describe("ai-sentiment-analysis document rendering", () => {
  it("renderDocumentCsv emits summary + sentence rows", () => {
    const doc = analyzeDocument("This is great. This is terrible.");
    const csv = renderDocumentCsv(doc);
    expect(csv).toContain("section,item,detail");
    expect(csv).toContain("summary,score");
    expect(csv).toContain("sentence,1");
  });
  it("renderDocumentJson emits valid JSON", () => {
    const doc = analyzeDocument("This is great.");
    const json = renderDocumentJson(doc);
    const parsed = JSON.parse(json);
    expect(parsed.sentiment).toBe(doc.sentiment);
  });
  it("renderHighlightedHtml wraps hits in <mark>", () => {
    const doc = analyzeDocument("This is great and terrible.");
    const html = renderHighlightedHtml(doc);
    expect(html).toContain("<mark");
    expect(html).toContain("sa-hit");
    expect(html).toContain("sa-pos");
    expect(html).toContain("sa-neg");
  });
  it("renderHighlightedHtml escapes HTML in text", () => {
    const doc = analyzeDocument("This is great <script>.");
    const html = renderHighlightedHtml(doc);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});

// ---------- LLM prompt ----------

describe("ai-sentiment-analysis LLM prompt", () => {
  it("buildLlmPrompt includes text + score", () => {
    const text = "I love this product!";
    const doc = analyzeDocument(text);
    const p = buildLlmPrompt(text, doc);
    expect(p).toContain("sentiment-analysis assistant");
    expect(p).toContain("I love this product!");
    expect(p).toContain(doc.score.toFixed(2));
  });
  it("renderLlmResult trims whitespace", () => {
    expect(renderLlmResult("  hello  ")).toBe("hello");
  });
});

// ---------- History ----------

describe("ai-sentiment-analysis history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, textLength: 100, score: 0.5,
      sentiment: "positive", sentenceCount: 3, emotionTop: "joy",
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].sentiment).toBe("positive");
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, textLength: 1, score: 0.1,
        sentiment: "neutral", sentenceCount: 1, emotionTop: null,
      });
    }
    expect(loadHistory()).toHaveLength(HISTORY_MAX);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, textLength: 1, score: 0.1,
      sentiment: "neutral", sentenceCount: 1, emotionTop: null,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------- Shareable URL ----------

describe("ai-sentiment-analysis shareable URL", () => {
  it("builds a share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("I love this!", 0.15);
    expect(url).toContain("text=");
    // URLSearchParams encodes spaces as '+' and '!' is preserved
    expect(url.toLowerCase()).toContain("i+love+this");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses a share URL back", () => {
    const { text, threshold } = parseShareUrl("text=I+love+this&th=0.25");
    expect(text).toBe("I love this");
    expect(threshold).toBe(0.25);
  });
  it("handles empty hash with default threshold", () => {
    const { text, threshold } = parseShareUrl("");
    expect(text).toBe("");
    expect(threshold).toBe(DEFAULT_THRESHOLD);
  });
  it("ignores invalid threshold", () => {
    const { threshold } = parseShareUrl("th=bogus");
    expect(threshold).toBe(DEFAULT_THRESHOLD);
  });
});

// Suppress unused-import lint
export type _Unused = Sentiment | Emotion;
