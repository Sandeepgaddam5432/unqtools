import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  STUDY_MODES,
  STUDY_MODE_LABELS,
  SAT_PRESET,
  GRE_PRESET,
  TOEFL_PRESET,
  ELEMENTARY_PRESET,
  VOCAB_PRESETS,
  PRESET_LABELS,
  entry,
  parseCommaList,
  parsePipeLine,
  parseCommaLine,
  looksLikeJson,
  parseJsonWords,
  parseWords,
  normalizeWordStr,
  dedupeStrings,
  normalizeWord,
  validateWords,
  markDifficulty,
  filterWords,
  sortAlphabetical,
  sortByDifficulty,
  shuffleWords,
  buildFlashcardDeck,
  currentCard,
  nextCard,
  prevCard,
  buildMatchRound,
  validateMatch,
  renderText,
  renderCsv,
  renderJson,
  renderSource,
  computeSummaryStats,
  tokenize,
  computeWordFrequency,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type WordEntry,
  type StudyMode,
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

function makeWord(overrides: Partial<WordEntry> = {}): WordEntry {
  return {
    id: overrides.id ?? "test-id",
    word: overrides.word ?? "happy",
    definition: overrides.definition ?? "feeling pleasure",
    example: overrides.example ?? "She felt happy.",
    synonyms: overrides.synonyms ?? ["joyful", "glad"],
    antonyms: overrides.antonyms ?? ["sad", "unhappy"],
    difficulty: overrides.difficulty ?? 3,
  };
}

describe("vocabulary-builder constants", () => {
  it("exposes HISTORY_KEY + HISTORY_MAX=20", () => {
    expect(HISTORY_KEY).toContain("vocabulary-builder");
    expect(HISTORY_MAX).toBe(20);
  });
  it("has 3 study modes", () => {
    expect(STUDY_MODES).toEqual(["browse", "flashcard", "match-game"]);
  });
  it("has labels for every mode", () => {
    for (const m of STUDY_MODES) {
      expect(STUDY_MODE_LABELS[m]).toBeTruthy();
    }
  });
  it("has 4 presets", () => {
    expect(Object.keys(VOCAB_PRESETS)).toHaveLength(4);
    expect(SAT_PRESET.length).toBeGreaterThanOrEqual(5);
    expect(GRE_PRESET.length).toBeGreaterThanOrEqual(5);
    expect(TOEFL_PRESET.length).toBeGreaterThanOrEqual(5);
    expect(ELEMENTARY_PRESET.length).toBeGreaterThanOrEqual(5);
    expect(Object.keys(PRESET_LABELS)).toHaveLength(4);
  });
});

describe("vocabulary-builder parseCommaList", () => {
  it("parses a comma-separated list", () => {
    expect(parseCommaList("a, b, c")).toEqual(["a", "b", "c"]);
  });
  it("dedupes case-insensitive (keeps first occurrence case)", () => {
    expect(parseCommaList("a, A, b")).toEqual(["a", "b"]);
  });
  it("trims and filters empty", () => {
    expect(parseCommaList("  a  , , b ")).toEqual(["a", "b"]);
  });
  it("returns empty for empty input", () => {
    expect(parseCommaList("")).toEqual([]);
  });
});

describe("vocabulary-builder parsePipeLine", () => {
  it("parses full line", () => {
    const r = parsePipeLine("happy|feeling pleasure|She felt happy.|joyful,glad|sad,unhappy");
    expect(r.word).toBe("happy");
    expect(r.definition).toBe("feeling pleasure");
    expect(r.example).toBe("She felt happy.");
    expect(r.synonyms).toEqual(["joyful", "glad"]);
    expect(r.antonyms).toEqual(["sad", "unhappy"]);
  });
  it("handles minimal word|def", () => {
    const r = parsePipeLine("happy|feeling pleasure");
    expect(r.word).toBe("happy");
    expect(r.definition).toBe("feeling pleasure");
    expect(r.example).toBe("");
    expect(r.synonyms).toEqual([]);
    expect(r.antonyms).toEqual([]);
  });
});

describe("vocabulary-builder parseCommaLine", () => {
  it("parses minimal word,def", () => {
    const r = parseCommaLine("happy,feeling pleasure");
    expect(r.word).toBe("happy");
    expect(r.definition).toBe("feeling pleasure");
  });
});

describe("vocabulary-builder looksLikeJson", () => {
  it("detects array", () => { expect(looksLikeJson("[{\"word\":\"a\"}]")).toBe(true); });
  it("detects object", () => { expect(looksLikeJson("{\"a\":1}")).toBe(true); });
  it("rejects plain text", () => { expect(looksLikeJson("happy|pleasure")).toBe(false); });
  it("rejects empty", () => { expect(looksLikeJson("")).toBe(false); });
});

describe("vocabulary-builder parseJsonWords", () => {
  it("parses array of word objects", () => {
    const json = JSON.stringify([
      { word: "happy", definition: "feeling pleasure", example: "She felt happy.", synonyms: ["joyful", "glad"], antonyms: ["sad"] },
      { word: "big", definition: "large" },
    ]);
    const words = parseJsonWords(json);
    expect(words).toHaveLength(2);
    expect(words[0].word).toBe("happy");
    expect(words[0].synonyms).toEqual(["joyful", "glad"]);
    expect(words[1].word).toBe("big");
    expect(words[1].synonyms).toEqual([]);
  });
  it("skips entries without word or definition", () => {
    const json = JSON.stringify([
      { word: "happy", definition: "feeling pleasure" },
      { word: "noDef" },
      { definition: "noWord" },
      "not-an-object",
    ]);
    expect(parseJsonWords(json)).toHaveLength(1);
  });
  it("returns empty for invalid JSON", () => {
    expect(parseJsonWords("[not valid")).toEqual([]);
  });
  it("returns empty for non-array", () => {
    expect(parseJsonWords("{\"a\":1}")).toEqual([]);
  });
});

describe("vocabulary-builder parseWords", () => {
  it("auto-detects JSON input", () => {
    const words = parseWords(JSON.stringify([{ word: "x", definition: "y" }]));
    expect(words).toHaveLength(1);
    expect(words[0].word).toBe("x");
  });
  it("parses pipe-separated multi-line input", () => {
    const words = parseWords("happy|feeling pleasure|She was happy.|joyful,glad|sad\nbig|large|||||small");
    expect(words).toHaveLength(2);
    expect(words[0].word).toBe("happy");
    expect(words[0].synonyms).toEqual(["joyful", "glad"]);
    expect(words[1].word).toBe("big");
  });
  it("parses comma-separated minimal input", () => {
    const words = parseWords("happy,feeling pleasure\nbig,large");
    expect(words).toHaveLength(2);
  });
  it("skips comment lines", () => {
    const words = parseWords("# comment\nhappy|pleasure\n// another comment\nbig|large");
    expect(words).toHaveLength(2);
  });
  it("skips blank lines and lines without word/def", () => {
    const words = parseWords("\n\n|noWord\nhappy|pleasure\n");
    expect(words).toHaveLength(1);
  });
  it("returns empty for empty input", () => {
    expect(parseWords("")).toEqual([]);
  });
  it("lowercases word + dedupes synonyms + removes self-synonym", () => {
    const words = parseWords("Happy|feeling pleasure||happy,joyful,glad");
    expect(words[0].word).toBe("happy");
    expect(words[0].synonyms).toEqual(["joyful", "glad"]); // "happy" removed (self)
  });
});

describe("vocabulary-builder normalize & dedupe", () => {
  it("normalizeWordStr lowercases + collapses whitespace", () => {
    expect(normalizeWordStr("  Happy  World ")).toBe("happy world");
  });
  it("dedupeStrings preserves order, dedupes case-insensitive", () => {
    expect(dedupeStrings(["A", "a", "b", "B", "c"])).toEqual(["A", "b", "c"]);
  });
  it("normalizeWord lowercases word + dedupes + removes self-synonym/antonym", () => {
    const w = normalizeWord(makeWord({
      word: "Happy",
      synonyms: ["joyful", "happy", "JOYFUL"],
      antonyms: ["sad", "happy"],
    }));
    expect(w.word).toBe("happy");
    expect(w.synonyms).toEqual(["joyful"]);
    expect(w.antonyms).toEqual(["sad"]);
  });
});

describe("vocabulary-builder markDifficulty", () => {
  it("returns 1 for short word + short def", () => {
    expect(markDifficulty("cat", "a small animal")).toBe(1);
  });
  it("returns 5 for long word + long def", () => {
    const longDef = "This is an extraordinarily comprehensive and detailed definition that uses many many words to thoroughly explain a concept that would normally take far fewer words to describe adequately for the average reader who is just trying to understand";
    expect(markDifficulty("supercalifragilisticexpialidocious", longDef)).toBe(5);
  });
  it("always returns a value 1-5", () => {
    const d = markDifficulty("test", "a thing to check");
    expect(d).toBeGreaterThanOrEqual(1);
    expect(d).toBeLessThanOrEqual(5);
  });
});

describe("vocabulary-builder validateWords", () => {
  it("returns ok for valid words", () => {
    const words = [makeWord(), makeWord({ id: "id2", word: "big", definition: "large" })];
    const r = validateWords(words);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.wordCount).toBe(2);
  });
  it("fails for empty list", () => {
    const r = validateWords([]);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain("required");
  });
  it("fails for duplicate words (case-insensitive)", () => {
    const words = [makeWord({ word: "happy" }), makeWord({ id: "id2", word: "HAPPY", definition: "x" })];
    const r = validateWords(words);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("duplicate"))).toBe(true);
  });
  it("fails for missing definition", () => {
    const words = [makeWord({ definition: "" })];
    const r = validateWords(words);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.includes("definition"))).toBe(true);
  });
});

describe("vocabulary-builder filter/sort/shuffle", () => {
  const words: WordEntry[] = [
    makeWord({ id: "1", word: "happy", definition: "feeling pleasure", example: "She felt happy.", synonyms: ["joyful"], antonyms: ["sad"] }),
    makeWord({ id: "2", word: "big", definition: "large", example: "A big house.", synonyms: ["huge"], antonyms: ["small"] }),
    makeWord({ id: "3", word: "smart", definition: "intelligent", example: "A smart student.", synonyms: ["clever"], antonyms: ["dull"] }),
  ];

  it("filterWords matches by word", () => {
    expect(filterWords(words, "happy")).toHaveLength(1);
  });
  it("filterWords matches by synonym", () => {
    expect(filterWords(words, "huge")).toHaveLength(1);
  });
  it("filterWords matches by antonym", () => {
    expect(filterWords(words, "small")).toHaveLength(1);
  });
  it("filterWords is case-insensitive", () => {
    expect(filterWords(words, "HAPPY")).toHaveLength(1);
  });
  it("filterWords returns all on empty query", () => {
    expect(filterWords(words, "")).toHaveLength(3);
  });
  it("sortAlphabetical sorts by word", () => {
    const sorted = sortAlphabetical(words);
    expect(sorted.map((w) => w.word)).toEqual(["big", "happy", "smart"]);
  });
  it("sortAlphabetical does not mutate input", () => {
    const orig = words.map((w) => w.word);
    sortAlphabetical(words);
    expect(words.map((w) => w.word)).toEqual(orig);
  });
  it("sortByDifficulty sorts ascending", () => {
    const ws = [
      makeWord({ id: "a", word: "a", difficulty: 3 }),
      makeWord({ id: "b", word: "b", difficulty: 1 }),
      makeWord({ id: "c", word: "c", difficulty: 5 }),
    ];
    expect(sortByDifficulty(ws).map((w) => w.difficulty)).toEqual([1, 3, 5]);
  });
  it("shuffleWords returns same length, same set", () => {
    const shuffled = shuffleWords(words, () => 0.5);
    expect(shuffled).toHaveLength(3);
    expect(new Set(shuffled.map((w) => w.id)).size).toBe(3);
  });
  it("shuffleWords does not mutate input", () => {
    const orig = words.map((w) => w.id);
    shuffleWords(words);
    expect(words.map((w) => w.id)).toEqual(orig);
  });
});

describe("vocabulary-builder flashcard deck", () => {
  const words: WordEntry[] = [
    makeWord({ id: "1", word: "alpha" }),
    makeWord({ id: "2", word: "beta" }),
    makeWord({ id: "3", word: "gamma" }),
  ];
  it("buildFlashcardDeck builds deck with current index 0", () => {
    const d = buildFlashcardDeck("Test", words);
    expect(d.name).toBe("Test");
    expect(d.cards).toHaveLength(3);
    expect(d.currentIndex).toBe(0);
  });
  it("buildFlashcardDeck with shuffle keeps all cards", () => {
    const d = buildFlashcardDeck("Test", words, true);
    expect(d.cards).toHaveLength(3);
    expect(new Set(d.cards.map((c) => c.id)).size).toBe(3);
  });
  it("currentCard returns the card at currentIndex", () => {
    const d = buildFlashcardDeck("T", words);
    expect(currentCard(d)?.word).toBe("alpha");
  });
  it("currentCard returns null on empty deck", () => {
    expect(currentCard(buildFlashcardDeck("T", []))).toBeNull();
  });
  it("nextCard wraps around", () => {
    let d = buildFlashcardDeck("T", words);
    d = nextCard(d); // 0 → 1
    expect(d.currentIndex).toBe(1);
    d = nextCard(d); // 1 → 2
    d = nextCard(d); // 2 → 0 (wrap)
    expect(d.currentIndex).toBe(0);
  });
  it("prevCard wraps around", () => {
    let d = buildFlashcardDeck("T", words);
    d = prevCard(d); // 0 → 2 (wrap)
    expect(d.currentIndex).toBe(2);
  });
});

describe("vocabulary-builder match game", () => {
  const words: WordEntry[] = [
    makeWord({ id: "w1", word: "alpha", definition: "first letter" }),
    makeWord({ id: "w2", word: "beta", definition: "second letter" }),
    makeWord({ id: "w3", word: "gamma", definition: "third letter" }),
    makeWord({ id: "w4", word: "delta", definition: "fourth letter" }),
    makeWord({ id: "w5", word: "epsilon", definition: "fifth letter" }),
    makeWord({ id: "w6", word: "zeta", definition: "sixth letter" }),
  ];
  it("buildMatchRound returns 4-6 pairs", () => {
    const r = buildMatchRound(words, 5);
    expect(r.pairs.length).toBeGreaterThanOrEqual(4);
    expect(r.pairs.length).toBeLessThanOrEqual(6);
  });
  it("buildMatchRound caps pair count to available words", () => {
    const r = buildMatchRound([words[0], words[1]], 5);
    expect(r.pairs).toHaveLength(2);
  });
  it("buildMatchRound enforces min of 4 when possible", () => {
    const r = buildMatchRound(words, 3);
    expect(r.pairs).toHaveLength(4);
  });
  it("buildMatchRound produces definitionOrder of same length", () => {
    const r = buildMatchRound(words, 5);
    expect(r.definitionOrder).toHaveLength(r.pairs.length);
  });
  it("validateMatch returns correct when word matches its own definition", () => {
    const r = buildMatchRound(words, 4);
    const firstPair = r.pairs[0];
    const result = validateMatch(r, firstPair.wordId, firstPair.wordId);
    expect(result.correct).toBe(true);
    expect(result.matchedPairId).toBe(firstPair.wordId);
  });
  it("validateMatch returns incorrect when word matches wrong definition", () => {
    const r = buildMatchRound(words, 4);
    const firstPair = r.pairs[0];
    const secondPair = r.pairs[1];
    const result = validateMatch(r, firstPair.wordId, secondPair.wordId);
    expect(result.correct).toBe(false);
    expect(result.matchedPairId).toBeNull();
  });
  it("validateMatch returns incorrect for unknown wordId", () => {
    const r = buildMatchRound(words, 4);
    const result = validateMatch(r, "nonexistent", r.pairs[0].wordId);
    expect(result.correct).toBe(false);
    expect(result.matchedPairId).toBeNull();
  });
});

describe("vocabulary-builder renderers", () => {
  const words: WordEntry[] = [
    makeWord({ id: "1", word: "happy", definition: "feeling pleasure", example: "She was happy.", synonyms: ["joyful"], antonyms: ["sad"], difficulty: 2 }),
  ];

  it("renderText includes list name + word + difficulty", () => {
    const t = renderText("My List", words);
    expect(t).toContain("My List");
    expect(t).toContain("happy");
    expect(t).toContain("difficulty: 2/5");
    expect(t).toContain("Definition: feeling pleasure");
    expect(t).toContain("Example: She was happy.");
    expect(t).toContain("Synonyms: joyful");
    expect(t).toContain("Antonyms: sad");
  });
  it("renderCsv has header row + escaped fields", () => {
    const csv = renderCsv(words);
    expect(csv.split("\n")[0]).toBe("word,definition,example,synonyms,antonyms,difficulty");
    expect(csv).toContain("happy");
    expect(csv).toContain("feeling pleasure");
    expect(csv).toContain("joyful");
    expect(csv).toContain("2"); // difficulty
  });
  it("renderCsv escapes commas/quotes in fields", () => {
    const csv = renderCsv([makeWord({ definition: 'has, comma and "quote' })]);
    expect(csv).toContain('"has, comma and ""quote"');
  });
  it("renderJson produces valid JSON with name + words", () => {
    const json = renderJson("My List", words);
    const parsed = JSON.parse(json);
    expect(parsed.name).toBe("My List");
    expect(parsed.count).toBe(1);
    expect(parsed.words[0].word).toBe("happy");
    expect(parsed.words[0].difficulty).toBe(2);
  });
  it("renderSource produces pipe-separated format", () => {
    const src = renderSource(words);
    expect(src).toContain("happy|feeling pleasure|She was happy.|joyful|sad");
  });
});

describe("vocabulary-builder summary stats", () => {
  it("computes total, by-difficulty, avg synonyms", () => {
    const words: WordEntry[] = [
      makeWord({ id: "1", word: "a", difficulty: 1, synonyms: ["s1", "s2"], antonyms: ["a1"] }),
      makeWord({ id: "2", word: "b", difficulty: 3, synonyms: ["s3"], antonyms: [] }),
    ];
    const s = computeSummaryStats(words);
    expect(s.totalWords).toBe(2);
    expect(s.byDifficulty[1]).toBe(1);
    expect(s.byDifficulty[3]).toBe(1);
    expect(s.byDifficulty[5]).toBe(0);
    expect(s.totalSynonyms).toBe(3);
    expect(s.totalAntonyms).toBe(1);
    expect(s.avgSynonymsPerWord).toBe(1.5);
    expect(s.avgAntonymsPerWord).toBe(0.5);
    expect(s.withExamples).toBe(2);
    expect(s.withSynonyms).toBe(2);
    expect(s.withAntonyms).toBe(1);
  });
  it("handles empty input", () => {
    const s = computeSummaryStats([]);
    expect(s.totalWords).toBe(0);
    expect(s.avgSynonymsPerWord).toBe(0);
  });
});

describe("vocabulary-builder word frequency", () => {
  it("tokenize lowercases + filters stop words + short tokens", () => {
    const toks = tokenize("The Quick Brown Fox jumps over the lazy dog and is happy");
    expect(toks).toContain("quick");
    expect(toks).toContain("brown");
    expect(toks).toContain("fox");
    expect(toks).toContain("jumps");
    expect(toks).toContain("lazy");
    expect(toks).toContain("dog");
    expect(toks).toContain("happy");
    expect(toks).not.toContain("the");
    expect(toks).not.toContain("and");
    expect(toks).not.toContain("is");
    expect(toks).not.toContain("over"); // 4 chars - included
  });
  it("computeWordFrequency returns top-N sorted by count desc", () => {
    const words: WordEntry[] = [
      makeWord({ definition: "love love love happy", example: "" }),
      makeWord({ definition: "happy day", example: "love" }),
    ];
    const freq = computeWordFrequency(words, 3);
    expect(freq[0].word).toBe("love");
    expect(freq[0].count).toBe(4);
    expect(freq[1].word).toBe("happy");
    expect(freq[1].count).toBe(2);
  });
  it("computeWordFrequency limits to topN", () => {
    const words: WordEntry[] = [
      makeWord({ definition: "alpha beta gamma delta epsilon zeta eta theta", example: "" }),
    ];
    const freq = computeWordFrequency(words, 3);
    expect(freq).toHaveLength(3);
  });
});

describe("vocabulary-builder history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, listName: "SAT", wordCount: 8, studyMode: "flashcard" });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].listName).toBe("SAT");
    expect(h[0].studyMode).toBe("flashcard");
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, listName: `L${i}`, wordCount: i, studyMode: "browse" });
    }
    expect(loadHistory()).toHaveLength(HISTORY_MAX);
  });
  it("clears", () => {
    saveHistory({ ts: 1, listName: "x", wordCount: 1, studyMode: "browse" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("vocabulary-builder shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ listName: "SAT", words: "happy|pleasure", studyMode: "flashcard" });
    expect(url).toContain("name=SAT");
    expect(url).toContain("mode=flashcard");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const parsed = parseShareUrl("name=SAT&words=happy%7Cpleasure&mode=flashcard");
    expect(parsed.listName).toBe("SAT");
    expect(parsed.words).toBe("happy|pleasure");
    expect(parsed.studyMode).toBe("flashcard");
  });
  it("handles empty hash with defaults", () => {
    expect(parseShareUrl("")).toEqual({ listName: "", words: "", studyMode: "browse" });
  });
  it("falls back to browse mode for unknown mode", () => {
    const parsed = parseShareUrl("name=X&mode=invalid");
    expect(parsed.studyMode).toBe("browse");
  });
  it("omits mode param when browse (default)", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ listName: "X", words: "y", studyMode: "browse" });
    expect(url).not.toContain("mode=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
});

// Suppress unused-import lint
export type _Unused = StudyMode;
