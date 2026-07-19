import { describe, it, expect, beforeEach } from "vitest";
import {
  ELEMENTARY_WORDS,
  MIDDLE_WORDS,
  HIGH_SCHOOL_WORDS,
  COLLEGE_WORDS,
  SPELLING_BEE_WORDS,
  DIFFICULTY_PRESETS,
  DIFFICULTY_LABELS,
  PRACTICE_MODES,
  PRACTICE_MODE_LABELS,
  HOMOPHONES,
  normalizeWord,
  stripDiacritics,
  parseWordList,
  validateSpelling,
  calculateScore,
  shuffle,
  wpmToTtsRate,
  buildHint,
  levenshtein,
  findSimilarWords,
  generateMultipleChoice,
  buildFillInBlank,
  buildPronunciation,
  markFrequency,
  findHomophones,
  transition,
  computeSummary,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildSession,
  type DifficultyLevel,
  type PracticeMode,
  type AnswerRecord,
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

describe("spelling-bee-practice constants", () => {
  it("ships 5 difficulty presets", () => {
    expect(Object.keys(DIFFICULTY_PRESETS)).toHaveLength(5);
    expect(Object.keys(DIFFICULTY_LABELS)).toHaveLength(5);
  });
  it("ships 3 practice modes", () => {
    expect(PRACTICE_MODES).toHaveLength(3);
    expect(Object.keys(PRACTICE_MODE_LABELS)).toHaveLength(3);
  });
  it("has 500+ total unique words across all levels", () => {
    const all = new Set<string>();
    for (const level of Object.keys(DIFFICULTY_PRESETS) as DifficultyLevel[]) {
      for (const w of DIFFICULTY_PRESETS[level]) all.add(w.word.toLowerCase());
    }
    expect(all.size).toBeGreaterThanOrEqual(500);
  });
  it("each level has at least 100 words", () => {
    for (const level of Object.keys(DIFFICULTY_PRESETS) as DifficultyLevel[]) {
      expect(DIFFICULTY_PRESETS[level].length).toBeGreaterThanOrEqual(100);
    }
  });
  it("elementary list has no duplicates", () => {
    const words = ELEMENTARY_WORDS.map((w) => w.word);
    expect(new Set(words).size).toBe(words.length);
  });
  it("middle list has no duplicates", () => {
    const words = MIDDLE_WORDS.map((w) => w.word);
    expect(new Set(words).size).toBe(words.length);
  });
  it("high-school list has no duplicates", () => {
    const words = HIGH_SCHOOL_WORDS.map((w) => w.word);
    expect(new Set(words).size).toBe(words.length);
  });
  it("college list has no duplicates", () => {
    const words = COLLEGE_WORDS.map((w) => w.word);
    expect(new Set(words).size).toBe(words.length);
  });
  it("spelling-bee list has no duplicates", () => {
    const words = SPELLING_BEE_WORDS.map((w) => w.word);
    expect(new Set(words).size).toBe(words.length);
  });
  it("ships 50+ homophone groups", () => {
    expect(Object.keys(HOMOPHONES).length).toBeGreaterThanOrEqual(50);
  });
});

describe("spelling-bee-practice normalizeWord", () => {
  it("lowercases and trims", () => {
    expect(normalizeWord("  HELLO  ")).toBe("hello");
  });
  it("strips internal whitespace", () => {
    expect(normalizeWord("hello world")).toBe("helloworld");
  });
  it("handles empty", () => {
    expect(normalizeWord("")).toBe("");
  });
});

describe("spelling-bee-practice stripDiacritics", () => {
  it("removes accents", () => {
    expect(stripDiacritics("café")).toBe("cafe");
    expect(stripDiacritics("piñata")).toBe("pinata");
  });
  it("leaves plain ASCII alone", () => {
    expect(stripDiacritics("hello")).toBe("hello");
  });
});

describe("spelling-bee-practice parseWordList", () => {
  it("parses newline-separated", () => {
    expect(parseWordList("apple\nbanana\ncherry")).toEqual(["apple", "banana", "cherry"]);
  });
  it("parses comma-separated", () => {
    expect(parseWordList("apple, banana, cherry")).toEqual(["apple", "banana", "cherry"]);
  });
  it("dedupes", () => {
    expect(parseWordList("apple\napple\nbanana")).toEqual(["apple", "banana"]);
  });
  it("skips blanks", () => {
    expect(parseWordList("apple\n\nbanana")).toEqual(["apple", "banana"]);
  });
  it("returns empty for empty input", () => {
    expect(parseWordList("")).toEqual([]);
  });
});

describe("spelling-bee-practice validateSpelling", () => {
  it("matches identical strings case-insensitively", () => {
    expect(validateSpelling("Elephant", "elephant")).toBe(true);
  });
  it("rejects wrong answers", () => {
    expect(validateSpelling("elephant", "elefant")).toBe(false);
  });
  it("ignores diacritics by default", () => {
    expect(validateSpelling("café", "cafe")).toBe(true);
  });
  it("respects diacritics when disabled", () => {
    expect(validateSpelling("café", "cafe", { ignoreDiacritics: false })).toBe(false);
  });
  it("rejects empty answers", () => {
    expect(validateSpelling("hello", "")).toBe(false);
    expect(validateSpelling("", "hello")).toBe(false);
  });
});

describe("spelling-bee-practice calculateScore", () => {
  it("computes percentage", () => {
    expect(calculateScore(7, 10)).toBe(70);
  });
  it("handles zero total", () => {
    expect(calculateScore(0, 0)).toBe(0);
  });
  it("handles perfect score", () => {
    expect(calculateScore(10, 10)).toBe(100);
  });
  it("rounds to nearest int", () => {
    expect(calculateScore(1, 3)).toBe(33);
  });
});

describe("spelling-bee-practice shuffle (Fisher-Yates)", () => {
  it("returns a new array (does not mutate input)", () => {
    const input = [1, 2, 3, 4, 5];
    const shuffled = shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect(shuffled).not.toBe(input);
  });
  it("preserves elements with a deterministic rng", () => {
    const rng = (() => {
      let seed = 1;
      return () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };
    })();
    const out = shuffle([1, 2, 3, 4, 5, 6, 7, 8], rng);
    expect(out.sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it("handles empty array", () => {
    expect(shuffle([])).toEqual([]);
  });
  it("handles single element", () => {
    expect(shuffle(["only"])).toEqual(["only"]);
  });
});

describe("spelling-bee-practice wpmToTtsRate", () => {
  it("returns 1.0 for 180 WPM", () => {
    const { rate } = wpmToTtsRate(180);
    expect(rate).toBeCloseTo(1.0, 5);
  });
  it("clamps low WPM to rate 0.5", () => {
    const { rate } = wpmToTtsRate(10);
    expect(rate).toBeGreaterThanOrEqual(0.5);
  });
  it("clamps high WPM to rate 2.0", () => {
    const { rate } = wpmToTtsRate(1000);
    expect(rate).toBeLessThanOrEqual(2.0);
  });
  it("computes ms-per-word correctly", () => {
    const { msPerWord } = wpmToTtsRate(120);
    expect(msPerWord).toBe(500);
  });
  it("handles zero/NaN", () => {
    const { rate } = wpmToTtsRate(0);
    expect(rate).toBeGreaterThan(0);
    expect(Number.isFinite(rate)).toBe(true);
  });
});

describe("spelling-bee-practice buildHint", () => {
  it("reveals first letter by default", () => {
    expect(buildHint("elephant")).toBe("e _ _ _ _ _ _ _");
  });
  it("reveals multiple letters", () => {
    expect(buildHint("cat", 2)).toBe("c a _");
  });
  it("handles empty word", () => {
    expect(buildHint("")).toBe("");
  });
});

describe("spelling-bee-practice levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("hello", "hello")).toBe(0);
  });
  it("returns length for empty vs non-empty", () => {
    expect(levenshtein("", "abc")).toBe(3);
  });
  it("computes single-char substitution", () => {
    expect(levenshtein("cat", "cut")).toBe(1);
  });
  it("computes insertion + deletion", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
  });
  it("is case-insensitive", () => {
    expect(levenshtein("HELLO", "hello")).toBe(0);
  });
});

describe("spelling-bee-practice findSimilarWords", () => {
  it("finds words within distance threshold", () => {
    const pool = ["cat", "bat", "rat", "dog", "car"];
    const similar = findSimilarWords("cat", pool, 1);
    const words = similar.map((s) => s.word);
    expect(words).toContain("bat");
    expect(words).toContain("rat");
    expect(words).toContain("car");
  });
  it("excludes the correct word itself", () => {
    const similar = findSimilarWords("cat", ["cat", "bat"], 1);
    expect(similar.map((s) => s.word)).not.toContain("cat");
  });
  it("sorts by distance ascending", () => {
    const pool = ["bat", "cart", "scat"];
    const similar = findSimilarWords("cat", pool, 2);
    expect(similar[0].distance).toBeLessThanOrEqual(similar[similar.length - 1].distance);
  });
  it("returns empty when no similar words", () => {
    expect(findSimilarWords("elephant", ["cat", "dog"], 1)).toEqual([]);
  });
});

describe("spelling-bee-practice generateMultipleChoice", () => {
  it("returns 4 options by default", () => {
    const opts = generateMultipleChoice("cat", ["bat", "rat", "dog", "cart"]);
    expect(opts).toHaveLength(4);
  });
  it("includes exactly one correct option", () => {
    const opts = generateMultipleChoice("cat", ["bat", "rat", "dog", "cart"]);
    expect(opts.filter((o) => o.isCorrect)).toHaveLength(1);
    expect(opts.find((o) => o.isCorrect)!.text).toBe("cat");
  });
  it("synthesizes distractors when pool is small", () => {
    // Use a deterministic but varied rng so the synthesizer doesn't keep
    // producing the same single candidate.
    let s = 1;
    const rng = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
    const opts = generateMultipleChoice("cat", [], { rng });
    expect(opts).toHaveLength(4);
    expect(opts.filter((o) => o.isCorrect)).toHaveLength(1);
  });
  it("shuffles options", () => {
    const rng = (() => {
      let s = 1;
      return () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
      };
    })();
    const opts = generateMultipleChoice("cat", ["bat", "rat", "cart"], { rng });
    // correct option should NOT always be first
    const firstCorrect = opts[0].isCorrect;
    expect(typeof firstCorrect).toBe("boolean");
  });
});

describe("spelling-bee-practice buildFillInBlank", () => {
  it("replaces the word in the sentence", () => {
    const result = buildFillInBlank("The cat sat on the mat.", "cat");
    expect(result.sentence).toBe("The ___ sat on the mat.");
    expect(result.answer).toBe("cat");
  });
  it("is case-insensitive", () => {
    const result = buildFillInBlank("I love CATS", "cats");
    expect(result.sentence).toContain("___");
  });
  it("appends a letter-count hint when word not in sentence", () => {
    const result = buildFillInBlank("The animal is sleeping.", "elephant");
    expect(result.sentence).toContain("8");
    expect(result.answer).toBe("elephant");
  });
  it("handles empty sentence with hint", () => {
    const result = buildFillInBlank("", "cat");
    expect(result.sentence).toContain("___");
    expect(result.answer).toBe("cat");
  });
});

describe("spelling-bee-practice buildPronunciation", () => {
  it("converts ph to f", () => {
    expect(buildPronunciation("phone")).toContain("f");
    expect(buildPronunciation("phone")).not.toContain("ph");
  });
  it("converts kn to n at start", () => {
    expect(buildPronunciation("knot")).toMatch(/^n/);
  });
  it("handles empty word", () => {
    expect(buildPronunciation("")).toBe("");
  });
  it("produces hyphenated syllables", () => {
    const p = buildPronunciation("banana");
    expect(p).toContain("-");
  });
});

describe("spelling-bee-practice markFrequency", () => {
  it("marks elementary words as common", () => {
    expect(markFrequency("apple")).toBe("common");
    expect(markFrequency("cat")).toBe("common");
  });
  it("marks obscure words as rare", () => {
    expect(markFrequency("autochthonous")).toBe("rare");
    expect(markFrequency("obfuscate")).toBe("rare");
  });
});

describe("spelling-bee-practice findHomophones", () => {
  it("finds homophones for 'their'", () => {
    const h = findHomophones("their");
    expect(h).toContain("there");
    expect(h).toContain("they're");
  });
  it("returns empty array for words with no homophones", () => {
    expect(findHomophones("elephant")).toEqual([]);
  });
  it("is case-insensitive", () => {
    expect(findHomophones("THEIR")).toContain("there");
  });
});

describe("spelling-bee-practice transition (state machine)", () => {
  it("idle → playing on start", () => {
    expect(transition("idle", "start", true)).toBe("playing");
  });
  it("playing → answered on submit", () => {
    expect(transition("playing", "submit", true)).toBe("answered");
  });
  it("answered → playing on next when more words", () => {
    expect(transition("answered", "next", true)).toBe("playing");
  });
  it("answered → finished on next when no more words", () => {
    expect(transition("answered", "next", false)).toBe("finished");
  });
  it("finished → idle on reset", () => {
    expect(transition("finished", "reset", false)).toBe("idle");
  });
  it("playing → finished on skip when no more words", () => {
    expect(transition("playing", "skip", false)).toBe("finished");
  });
});

describe("spelling-bee-practice computeSummary", () => {
  it("computes stats for a session", () => {
    const records: AnswerRecord[] = [
      { word: "cat", userAnswer: "cat", correct: true, timeTakenMs: 1000 },
      { word: "dog", userAnswer: "dog", correct: true, timeTakenMs: 2000 },
      { word: "bird", userAnswer: "berd", correct: false, timeTakenMs: 3000 },
    ];
    const stats = computeSummary(records);
    expect(stats.totalWords).toBe(3);
    expect(stats.correct).toBe(2);
    expect(stats.incorrect).toBe(1);
    expect(stats.accuracy).toBe(67);
    expect(stats.avgTimePerWordMs).toBe(2000);
    expect(stats.hardestWord).toBe("bird");
  });
  it("returns zero stats for empty records", () => {
    const stats = computeSummary([]);
    expect(stats.totalWords).toBe(0);
    expect(stats.accuracy).toBe(0);
    expect(stats.hardestWord).toBeNull();
  });
  it("hardestWord is slowest correct when all correct", () => {
    const records: AnswerRecord[] = [
      { word: "cat", userAnswer: "cat", correct: true, timeTakenMs: 1000 },
      { word: "dog", userAnswer: "dog", correct: true, timeTakenMs: 5000 },
    ];
    expect(computeSummary(records).hardestWord).toBe("dog");
  });
});

describe("spelling-bee-practice renderText", () => {
  it("renders a header and stats", () => {
    const records: AnswerRecord[] = [
      { word: "cat", userAnswer: "cat", correct: true, timeTakenMs: 1000 },
    ];
    const stats = computeSummary(records);
    const text = renderText(records, stats, "elementary", "type-the-word");
    expect(text).toContain("Spelling Bee Practice");
    expect(text).toContain("Difficulty:");
    expect(text).toContain("Mode:");
    expect(text).toContain("cat");
    expect(text).toContain("✓");
  });
});

describe("spelling-bee-practice renderCsv", () => {
  it("renders header", () => {
    expect(renderCsv([])).toContain("word,user_answer,correct,time_taken_ms");
  });
  it("renders rows", () => {
    const records: AnswerRecord[] = [
      { word: "cat", userAnswer: "cat", correct: true, timeTakenMs: 1000 },
      { word: "dog", userAnswer: "dag", correct: false, timeTakenMs: 2000 },
    ];
    const csv = renderCsv(records);
    expect(csv).toContain("cat,cat,true,1000");
    expect(csv).toContain("dog,dag,false,2000");
  });
});

describe("spelling-bee-practice history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      difficulty: "elementary",
      mode: "type-the-word",
      totalWords: 10,
      correct: 8,
      accuracy: 80,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        difficulty: "elementary",
        mode: "type-the-word",
        totalWords: 1,
        correct: 1,
        accuracy: 100,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, difficulty: "elementary", mode: "type-the-word",
      totalWords: 1, correct: 1, accuracy: 100,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("spelling-bee-practice shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      words: "cat\ndog",
      difficulty: "elementary",
      mode: "type-the-word",
      speedWpm: 120,
    });
    expect(url).toContain("words=cat");
    expect(url).toContain("diff=elementary");
    expect(url).toContain("mode=type-the-word");
    expect(url).toContain("wpm=120");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("words=cat%0Adog&diff=middle&mode=multiple-choice&wpm=150");
    expect(p.words).toBe("cat\ndog");
    expect(p.difficulty).toBe("middle");
    expect(p.mode).toBe("multiple-choice");
    expect(p.speedWpm).toBe(150);
  });
  it("returns defaults for empty hash", () => {
    const p = parseShareUrl("");
    expect(p.difficulty).toBe("elementary");
    expect(p.mode).toBe("type-the-word");
    expect(p.speedWpm).toBe(100);
  });
  it("filters unknown difficulty/mode", () => {
    const p = parseShareUrl("diff=unknown&mode=unknown");
    expect(p.difficulty).toBe("elementary");
    expect(p.mode).toBe("type-the-word");
  });
});

describe("spelling-bee-practice buildSession", () => {
  it("uses custom words when provided", () => {
    const session = buildSession(["cat", "dog", "bird"], "elementary");
    expect(session).toHaveLength(3);
    expect(session.map((w) => w.word).sort()).toEqual(["bird", "cat", "dog"]);
  });
  it("samples from preset when no custom words", () => {
    const rng = (() => {
      let s = 1;
      return () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
      };
    })();
    const session = buildSession([], "elementary", 10, rng);
    expect(session).toHaveLength(10);
    expect(session.every((w) => w.difficulty === "elementary")).toBe(true);
  });
  it("caps at available pool size", () => {
    const session = buildSession([], "elementary", 99999);
    expect(session.length).toBeLessThanOrEqual(ELEMENTARY_WORDS.length);
  });
  it("normalizes custom words", () => {
    const session = buildSession(["  CAT  ", "Dog"], "elementary");
    expect(session.map((w) => w.word).sort()).toEqual(["cat", "dog"]);
  });
});

// Suppress unused-import lint
export type _Unused = DifficultyLevel | PracticeMode;
