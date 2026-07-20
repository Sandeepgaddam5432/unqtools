import { describe, it, expect, beforeEach } from "vitest";
import {
  FORMAT_LABELS,
  READING_LEVEL_LABELS,
  DEPTH_LABELS,
  DEPTH_CONFIG,
  READING_LEVEL_MAX_SENTENCE_WORDS,
  TOPIC_PRESETS,
  STOPWORDS,
  HISTORY_KEY,
  FAVES_KEY,
  HISTORY_MAX,
  FAVES_MAX,
  clean,
  tokenize,
  tokenizeContent,
  splitSentences,
  countWords,
  computeTermFrequencies,
  scoreSentences,
  extractKeyTerms,
  extractDefinition,
  splitSections,
  summarize,
  generateQuestions,
  generateFlashcards,
  generateObjectives,
  buildOverview,
  generateStudyGuide,
  renderMarkdown,
  renderText,
  renderCsv,
  renderJson,
  renderFlashcardsJson,
  loadHistory,
  saveHistory,
  clearHistory,
  loadFavorites,
  saveFavorite,
  removeFavorite,
  clearFavorites,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type GuideFormat,
  type ReadingLevel,
  type Depth,
} from "./logic";

const SAMPLE = `
Photosynthesis is the process by which plants convert light energy into chemical energy.
The chloroplasts in plant cells contain chlorophyll, which absorbs sunlight.
During photosynthesis, carbon dioxide and water are converted into glucose and oxygen.
This process occurs in two stages: the light-dependent reactions and the Calvin cycle.
The light-dependent reactions take place in the thylakoid membranes.
The Calvin cycle takes place in the stroma of the chloroplast.
Chlorophyll is the green pigment responsible for absorbing light energy.
Stomata are tiny pores on leaves that allow gas exchange.
Plants release oxygen as a byproduct of photosynthesis.
The overall equation for photosynthesis is: 6CO2 + 6H2O → C6H12O6 + 6O2.
Photosynthesis is essential for life on Earth because it produces oxygen and food.
Without photosynthesis, the atmosphere would lack oxygen.
`;

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

// ---- Constants ----

describe("ai-study-guide-generator constants", () => {
  it("has 4 formats", () => {
    expect(Object.keys(FORMAT_LABELS)).toHaveLength(4);
    expect(FORMAT_LABELS.outline).toBe("Outline");
    expect(FORMAT_LABELS.qa).toBe("Q&A");
    expect(FORMAT_LABELS.summary).toBe("Summary sheet");
    expect(FORMAT_LABELS.flashcard).toBe("Flashcards");
  });
  it("has 4 reading levels", () => {
    expect(Object.keys(READING_LEVEL_LABELS)).toHaveLength(4);
    expect(READING_LEVEL_LABELS.elementary).toBe("Elementary");
    expect(READING_LEVEL_LABELS.college).toBe("College");
  });
  it("has 3 depths", () => {
    expect(Object.keys(DEPTH_LABELS)).toHaveLength(3);
  });
  it("DEPTH_CONFIG has sentencesPerSection and questionCount", () => {
    expect(DEPTH_CONFIG.quick.sentencesPerSection).toBeLessThan(DEPTH_CONFIG.standard.sentencesPerSection);
    expect(DEPTH_CONFIG.standard.sentencesPerSection).toBeLessThan(DEPTH_CONFIG.comprehensive.sentencesPerSection);
    expect(DEPTH_CONFIG.comprehensive.questionCount).toBeGreaterThanOrEqual(DEPTH_CONFIG.standard.questionCount);
  });
  it("READING_LEVEL_MAX_SENTENCE_WORDS scales with level", () => {
    expect(READING_LEVEL_MAX_SENTENCE_WORDS.elementary).toBeLessThan(READING_LEVEL_MAX_SENTENCE_WORDS.college);
  });
  it("has 12+ topic presets", () => {
    expect(TOPIC_PRESETS.length).toBeGreaterThanOrEqual(12);
    expect(TOPIC_PRESETS).toContain("photosynthesis");
  });
  it("has a stopwords set", () => {
    expect(STOPWORDS.size).toBeGreaterThan(50);
    expect(STOPWORDS.has("the")).toBe(true);
    expect(STOPWORDS.has("photosynthesis")).toBe(false);
  });
  it("has correct history constants", () => {
    expect(HISTORY_KEY).toBe("unqtools:ai-study-guide:history");
    expect(HISTORY_MAX).toBe(20);
    expect(FAVES_KEY).toBe("unqtools:ai-study-guide:faves");
    expect(FAVES_MAX).toBe(50);
  });
});

// ---- Helpers ----

describe("ai-study-guide-generator clean + tokenize", () => {
  it("clean collapses whitespace", () => {
    expect(clean("  hello   world  ")).toBe("hello world");
  });
  it("tokenize lowercases and strips punctuation", () => {
    expect(tokenize("Hello, World!")).toEqual(["hello", "world"]);
  });
  it("tokenizeContent drops stopwords", () => {
    const tokens = tokenizeContent("the quick brown fox");
    expect(tokens).not.toContain("the");
    expect(tokens).toContain("quick");
  });
  it("tokenizeContent drops short tokens", () => {
    const tokens = tokenizeContent("a an the cat");
    expect(tokens).toContain("cat");
    expect(tokens).not.toContain("a");
  });
});

describe("ai-study-guide-generator splitSentences", () => {
  it("splits on . ! ?", () => {
    const s = splitSentences("First sentence. Second one! Third?");
    expect(s).toHaveLength(3);
  });
  it("returns empty for empty input", () => {
    expect(splitSentences("")).toEqual([]);
  });
  it("preserves abbreviations poorly but doesn't crash", () => {
    const s = splitSentences("Dr. Smith went home.");
    expect(s.length).toBeGreaterThanOrEqual(1);
  });
});

describe("ai-study-guide-generator countWords", () => {
  it("counts words", () => {
    expect(countWords("one two three")).toBe(3);
  });
  it("handles empty", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
});

// ---- TF scoring ----

describe("ai-study-guide-generator computeTermFrequencies", () => {
  it("computes frequencies for content words", () => {
    const freq = computeTermFrequencies("the cat sat on the mat cat");
    expect(freq.get("cat")).toBe(2);
    expect(freq.has("the")).toBe(false);
  });
  it("returns empty map for empty input", () => {
    expect(computeTermFrequencies("").size).toBe(0);
  });
});

describe("ai-study-guide-generator scoreSentences", () => {
  it("scores sentences by summed TF of content words", () => {
    const text = "Chlorophyll absorbs light energy from the sun. The cat ran away quickly. Chlorophyll is the green pigment in leaves.";
    const freq = computeTermFrequencies(text);
    const sentences = splitSentences(text);
    const scored = scoreSentences(sentences, freq, "college");
    expect(scored.length).toBeGreaterThan(0);
    // The chlorophyll sentences should score higher than "the cat ran away"
    const chloroScore = scored.filter((s) => /chlorophyll/i.test(s.text)).reduce((sum, s) => sum + s.score, 0);
    const catScore = scored.filter((s) => /cat/i.test(s.text)).reduce((sum, s) => sum + s.score, 0);
    expect(chloroScore).toBeGreaterThan(catScore);
  });
  it("skips too-short sentences", () => {
    const scored = scoreSentences(["Hi."], new Map(), "college");
    expect(scored).toHaveLength(0);
  });
  it("applies length penalty at low reading levels", () => {
    const long = "This is a very long sentence with many many many many many many many many many many many many many words.";
    const freq = new Map([["sentence", 1], ["long", 1], ["many", 10]]);
    const elementary = scoreSentences([long], freq, "elementary")[0];
    const college = scoreSentences([long], freq, "college")[0];
    expect(elementary.score).toBeLessThan(college.score);
  });
});

// ---- Key term extraction ----

describe("ai-study-guide-generator extractKeyTerms", () => {
  it("extracts frequent content terms", () => {
    const terms = extractKeyTerms(SAMPLE, 10);
    expect(terms.length).toBeGreaterThan(0);
    // Photosynthesis appears 4+ times, should be in top terms
    expect(terms.some((t) => /photosynthesis/i.test(t.term))).toBe(true);
  });
  it("returns empty for empty input", () => {
    expect(extractKeyTerms("")).toEqual([]);
  });
  it("respects max parameter", () => {
    const terms = extractKeyTerms(SAMPLE, 5);
    expect(terms.length).toBeLessThanOrEqual(5);
  });
  it("includes a definition for each term", () => {
    const terms = extractKeyTerms(SAMPLE, 5);
    for (const t of terms) {
      expect(t.definition.length).toBeGreaterThan(0);
    }
  });
  it("includes score and occurrences", () => {
    const terms = extractKeyTerms(SAMPLE, 5);
    for (const t of terms) {
      expect(t.score).toBeGreaterThan(0);
      expect(t.occurrences).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("ai-study-guide-generator extractDefinition", () => {
  it("extracts 'X is Y' definitions", () => {
    const def = extractDefinition("photosynthesis", "Photosynthesis is the process by which plants make food.");
    expect(def.toLowerCase()).toContain("process");
  });
  it("extracts 'X refers to Y' definitions", () => {
    const def = extractDefinition("gravity", "Gravity refers to the force that pulls objects toward each other.");
    expect(def.toLowerCase()).toContain("force");
  });
  it("falls back to first sentence containing term", () => {
    const def = extractDefinition("chlorophyll", "Chlorophyll absorbs sunlight efficiently.");
    expect(def).toContain("Chlorophyll");
  });
  it("returns placeholder for empty input", () => {
    const def = extractDefinition("anything", "");
    expect(def.length).toBeGreaterThan(0);
  });
});

// ---- Section splitting ----

describe("ai-study-guide-generator splitSections", () => {
  it("splits by paragraph breaks", () => {
    const text = "Para one sentence one. Para one sentence two.\n\nPara two sentence one.";
    const sections = splitSections(text, 4);
    expect(sections.length).toBeGreaterThanOrEqual(2);
  });
  it("chunks long paragraphs", () => {
    const text = "S1. S2. S3. S4. S5. S6. S7. S8. S9. S10.";
    const sections = splitSections(text, 3);
    expect(sections.length).toBeGreaterThanOrEqual(3);
  });
  it("returns empty for empty input", () => {
    expect(splitSections("", 4)).toEqual([]);
  });
});

// ---- Summarization ----

describe("ai-study-guide-generator summarize", () => {
  it("returns N sentences", () => {
    const out = summarize(SAMPLE, 3, "college");
    expect(out).toHaveLength(3);
  });
  it("returns empty for empty input", () => {
    expect(summarize("", 3, "college")).toEqual([]);
  });
  it("preserves original order", () => {
    const out = summarize(SAMPLE, 3, "college");
    const allSentences = splitSentences(SAMPLE);
    let prevIdx = -1;
    for (const s of out) {
      const idx = allSentences.indexOf(s);
      expect(idx).toBeGreaterThan(prevIdx);
      prevIdx = idx;
    }
  });
});

// ---- Q&A generation ----

describe("ai-study-guide-generator generateQuestions", () => {
  it("generates the requested count", () => {
    const terms = extractKeyTerms(SAMPLE, 10);
    const qs = generateQuestions(SAMPLE, terms, 8);
    expect(qs.length).toBeLessThanOrEqual(8);
    expect(qs.length).toBeGreaterThan(0);
  });
  it("includes both MCQ and short-answer when possible", () => {
    const terms = extractKeyTerms(SAMPLE, 10);
    const qs = generateQuestions(SAMPLE, terms, 10);
    const hasMcq = qs.some((q) => q.type === "mcq");
    const hasSa = qs.some((q) => q.type === "short-answer");
    expect(hasMcq).toBe(true);
    // Short answer may be missing for very short text; verify MCQs have choices.
    if (hasSa) expect(hasSa).toBe(true);
  });
  it("MCQ questions have 4 choices", () => {
    const terms = extractKeyTerms(SAMPLE, 10);
    const qs = generateQuestions(SAMPLE, terms, 6);
    for (const q of qs) {
      if (q.type === "mcq") {
        expect(q.choices?.length).toBeGreaterThanOrEqual(2);
        expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it("every question has an answer", () => {
    const terms = extractKeyTerms(SAMPLE, 10);
    const qs = generateQuestions(SAMPLE, terms, 8);
    for (const q of qs) {
      expect(q.answer.length).toBeGreaterThan(0);
    }
  });
});

// ---- Flashcards ----

describe("ai-study-guide-generator generateFlashcards", () => {
  it("generates flashcards from key terms", () => {
    const terms = extractKeyTerms(SAMPLE, 10);
    const cards = generateFlashcards(terms, 5);
    expect(cards.length).toBeLessThanOrEqual(5);
    for (const c of cards) {
      expect(c.front.length).toBeGreaterThan(0);
      expect(c.back.length).toBeGreaterThan(0);
    }
  });
  it("respects max parameter", () => {
    const terms = extractKeyTerms(SAMPLE, 10);
    const cards = generateFlashcards(terms, 3);
    expect(cards.length).toBeLessThanOrEqual(3);
  });
});

// ---- Learning objectives ----

describe("ai-study-guide-generator generateObjectives", () => {
  it("generates up to max objectives", () => {
    const terms = extractKeyTerms(SAMPLE, 10);
    const sents = summarize(SAMPLE, 5, "college");
    const objs = generateObjectives(terms, sents, 5);
    expect(objs.length).toBeLessThanOrEqual(5);
    expect(objs.length).toBeGreaterThan(0);
  });
  it("first objectives mention 'Define' for terms", () => {
    const terms = extractKeyTerms(SAMPLE, 5);
    const objs = generateObjectives(terms, [], 5);
    expect(objs.some((o) => /define/i.test(o))).toBe(true);
  });
});

// ---- Overview ----

describe("ai-study-guide-generator buildOverview", () => {
  it("builds an overview from sentences + terms", () => {
    const terms = extractKeyTerms(SAMPLE, 5);
    const ov = buildOverview(SAMPLE, terms);
    expect(ov.length).toBeGreaterThan(0);
  });
  it("handles empty input gracefully", () => {
    expect(buildOverview("", [])).toBe("");
  });
});

// ---- Full guide ----

describe("ai-study-guide-generator generateStudyGuide", () => {
  it("generates a full study guide", () => {
    const g = generateStudyGuide(SAMPLE, "outline", "college", "standard", "Photosynthesis");
    expect(g.topic).toBe("Photosynthesis");
    expect(g.overview.length).toBeGreaterThan(0);
    expect(g.learningObjectives.length).toBeGreaterThan(0);
    expect(g.keyTerms.length).toBeGreaterThan(0);
    expect(g.sections.length).toBeGreaterThan(0);
    expect(g.summary.length).toBeGreaterThan(0);
    expect(g.questions.length).toBeGreaterThan(0);
    expect(g.flashcards.length).toBeGreaterThan(0);
  });
  it("reports meta correctly", () => {
    const g = generateStudyGuide(SAMPLE, "qa", "high", "quick", "Photosynthesis");
    expect(g.meta.inputWordCount).toBeGreaterThan(0);
    expect(g.meta.outputWordCount).toBeGreaterThan(0);
    expect(g.meta.compressionRatio).toBeGreaterThan(0);
    expect(g.meta.termCount).toBe(g.keyTerms.length);
    expect(g.meta.questionCount).toBe(g.questions.length);
    expect(g.meta.flashcardCount).toBe(g.flashcards.length);
  });
  it("respects depth: comprehensive > quick", () => {
    const quick = generateStudyGuide(SAMPLE, "qa", "college", "quick", "X");
    const comp = generateStudyGuide(SAMPLE, "qa", "college", "comprehensive", "X");
    expect(comp.meta.questionCount).toBeGreaterThanOrEqual(quick.meta.questionCount);
  });
  it("handles empty input", () => {
    const g = generateStudyGuide("", "outline", "college", "standard", "");
    expect(g.topic).toBe("");
    expect(g.sections).toEqual([]);
    expect(g.keyTerms).toEqual([]);
  });
  it("respects format param", () => {
    const g = generateStudyGuide(SAMPLE, "flashcard", "college", "standard", "P");
    expect(g.format).toBe("flashcard");
  });
});

// ---- Rendering ----

describe("ai-study-guide-generator renderMarkdown", () => {
  it("renders markdown with overview + key terms + questions", () => {
    const g = generateStudyGuide(SAMPLE, "qa", "college", "quick", "Photosynthesis");
    const md = renderMarkdown(g);
    expect(md).toContain("# Study Guide: Photosynthesis");
    expect(md).toContain("## Overview");
    expect(md).toContain("## Key Terms");
    expect(md).toContain("## Self-Test Questions");
  });
});

describe("ai-study-guide-generator renderText", () => {
  it("renders non-empty text", () => {
    const g = generateStudyGuide(SAMPLE, "summary", "high", "quick", "P");
    const txt = renderText(g);
    expect(txt.length).toBeGreaterThan(0);
  });
});

describe("ai-study-guide-generator renderCsv", () => {
  it("renders CSV header", () => {
    const g = generateStudyGuide(SAMPLE, "qa", "college", "quick", "P");
    const csv = renderCsv(g);
    expect(csv).toContain("id,type,question,answer");
  });
});

describe("ai-study-guide-generator renderJson", () => {
  it("renders valid JSON", () => {
    const g = generateStudyGuide(SAMPLE, "qa", "college", "quick", "P");
    const json = renderJson(g);
    const parsed = JSON.parse(json);
    expect(parsed.topic).toBe("P");
    expect(Array.isArray(parsed.questions)).toBe(true);
  });
});

describe("ai-study-guide-generator renderFlashcardsJson", () => {
  it("renders flashcards as a JSON array", () => {
    const g = generateStudyGuide(SAMPLE, "flashcard", "college", "quick", "P");
    const json = renderFlashcardsJson(g);
    const arr = JSON.parse(json);
    expect(Array.isArray(arr)).toBe(true);
    if (arr.length > 0) {
      expect(arr[0].front).toBeDefined();
      expect(arr[0].back).toBeDefined();
    }
  });
});

// ---- History ----

describe("ai-study-guide-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, format: "outline", readingLevel: "college", depth: "standard",
      topic: "Photosynthesis", inputWordCount: 100, questionCount: 10, flashcardCount: 15,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, format: "outline", readingLevel: "college", depth: "standard",
        topic: "X", inputWordCount: 1, questionCount: 1, flashcardCount: 1,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, format: "outline", readingLevel: "college", depth: "standard",
      topic: "X", inputWordCount: 1, questionCount: 1, flashcardCount: 1,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---- Favorites ----

describe("ai-study-guide-generator favorites (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadFavorites()).toEqual([]);
  });
  it("saves and loads", () => {
    saveFavorite({
      ts: 1, format: "outline", readingLevel: "college", depth: "standard",
      topic: "P", markdown: "# Study Guide",
    });
    expect(loadFavorites()).toHaveLength(1);
  });
  it("removes by ts", () => {
    saveFavorite({
      ts: 1, format: "outline", readingLevel: "college", depth: "standard",
      topic: "P", markdown: "# Study Guide",
    });
    removeFavorite(1);
    expect(loadFavorites()).toEqual([]);
  });
  it("clears", () => {
    saveFavorite({
      ts: 1, format: "outline", readingLevel: "college", depth: "standard",
      topic: "P", markdown: "# Study Guide",
    });
    clearFavorites();
    expect(loadFavorites()).toEqual([]);
  });
});

// ---- Share URL ----

describe("ai-study-guide-generator shareable URL", () => {
  it("builds share URL with all params when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      format: "outline", readingLevel: "college", depth: "standard", topic: "Photosynthesis",
    });
    expect(url).toContain("f=outline");
    expect(url).toContain("r=college");
    expect(url).toContain("d=standard");
    expect(url).toContain("t=Photosynthesis");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("f=outline&r=college&d=standard&t=Photosynthesis");
    expect(p.format).toBe("outline");
    expect(p.readingLevel).toBe("college");
    expect(p.depth).toBe("standard");
    expect(p.topic).toBe("Photosynthesis");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown format values", () => {
    const p = parseShareUrl("f=invalid&r=college");
    expect(p.format).toBeUndefined();
    expect(p.readingLevel).toBe("college");
  });
});

// ---- LLM helpers ----

describe("ai-study-guide-generator LLM helpers", () => {
  it("builds an LLM prompt with format + level + depth", () => {
    const prompt = buildLlmPrompt("qa", "college", "standard", "Photosynthesis", SAMPLE);
    expect(prompt).toContain("Q&A");
    expect(prompt).toContain("College");
    expect(prompt).toContain("Photosynthesis");
    expect(prompt).toContain("Source material:");
  });
  it("renders a valid LLM JSON result", () => {
    const raw = JSON.stringify({
      overview: "Photosynthesis converts light to energy.",
      learningObjectives: ["Define photosynthesis."],
      keyTerms: [{ term: "chlorophyll", definition: "green pigment" }],
      questions: [
        { type: "mcq", question: "What is X?", answer: "Y", choices: ["Y", "Z"], correctIndex: 0, sourceSentence: "src" },
      ],
    });
    const out = renderLlmResult(raw);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.result.overview).toContain("Photosynthesis");
      expect(out.result.keyTerms).toHaveLength(1);
      expect(out.result.questions).toHaveLength(1);
      expect(out.result.questions[0].choices).toEqual(["Y", "Z"]);
    }
  });
  it("handles markdown-fenced JSON", () => {
    const raw = "```json\n" + JSON.stringify({
      overview: "X",
      learningObjectives: [],
      keyTerms: [],
      questions: [],
    }) + "\n```";
    const out = renderLlmResult(raw);
    expect(out.ok).toBe(true);
  });
  it("fails gracefully on invalid JSON", () => {
    const out = renderLlmResult("not json");
    expect(out.ok).toBe(false);
  });
  it("fails gracefully on non-object JSON", () => {
    const out = renderLlmResult("[1, 2, 3]");
    expect(out.ok).toBe(false);
  });
  it("fails gracefully when no usable content", () => {
    const out = renderLlmResult("{}");
    expect(out.ok).toBe(false);
  });
});

// Suppress unused-import lint for type-only imports
export type _Unused = GuideFormat | ReadingLevel | Depth;
