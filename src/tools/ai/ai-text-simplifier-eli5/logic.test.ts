import { describe, it, expect, beforeEach } from "vitest";
import {
  JARGON_DICTIONARY,
  LEVEL_LABELS,
  LEVEL_THRESHOLDS,
  DEFAULT_OPTIONS,
  SAMPLE_TEXTS,
  HISTORY_KEY,
  HISTORY_MAX,
  normalizeWhitespace,
  countSyllables,
  splitSentences,
  splitWords,
  findLockedTokens,
  pickReplacement,
  findJargon,
  applyJargonSubstitutions,
  splitLongSentence,
  splitLongSentencesInText,
  bulletize,
  detectPassiveVoice,
  computeReadability,
  diffText,
  simplifyText,
  loadHistory,
  saveHistory,
  clearHistory,
  loadIgnored,
  saveIgnored,
  buildShareUrl,
  parseShareUrl,
  buildLlmRequestBody,
  extractSimplifiedFromLlmResponse,
  type ReadingLevel,
  type SimplifyOptions,
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

describe("eli5 constants", () => {
  it("has a jargon dictionary with 80+ entries", () => {
    expect(JARGON_DICTIONARY.length).toBeGreaterThanOrEqual(80);
  });
  it("has 4 reading levels", () => {
    expect(Object.keys(LEVEL_LABELS)).toHaveLength(4);
    expect(LEVEL_LABELS["eli5"]).toBeDefined();
    expect(LEVEL_LABELS["grade-school"]).toBeDefined();
    expect(LEVEL_LABELS["teen"]).toBeDefined();
    expect(LEVEL_LABELS["plain-professional"]).toBeDefined();
  });
  it("has level thresholds", () => {
    expect(LEVEL_THRESHOLDS["eli5"]).toBeLessThan(LEVEL_THRESHOLDS["grade-school"]);
    expect(LEVEL_THRESHOLDS["plain-professional"]).toBeGreaterThan(100);
  });
  it("has default options", () => {
    expect(DEFAULT_OPTIONS.level).toBe("grade-school");
    expect(DEFAULT_OPTIONS.lockTokens).toBe(true);
  });
  it("has sample texts", () => {
    expect(SAMPLE_TEXTS.length).toBeGreaterThanOrEqual(3);
    expect(SAMPLE_TEXTS[0].label).toBeTruthy();
  });
  it("exports history key + max", () => {
    expect(HISTORY_KEY).toContain("ai-text-simplifier-eli5");
    expect(HISTORY_MAX).toBe(20);
  });
});

describe("eli5 normalizeWhitespace", () => {
  it("collapses runs of spaces", () => {
    expect(normalizeWhitespace("a    b\tc")).toBe("a b c");
  });
  it("trims leading/trailing whitespace", () => {
    expect(normalizeWhitespace("  hi  ")).toBe("hi");
  });
  it("converts CRLF to LF", () => {
    expect(normalizeWhitespace("a\r\nb")).toBe("a\nb");
  });
  it("handles empty input", () => {
    expect(normalizeWhitespace("")).toBe("");
  });
});

describe("eli5 countSyllables", () => {
  it("returns 1 for short words", () => {
    expect(countSyllables("the")).toBe(1);
    expect(countSyllables("cat")).toBe(1);
  });
  it("counts syllables in longer words", () => {
    expect(countSyllables("apple")).toBe(2);
    expect(countSyllables("banana")).toBeGreaterThanOrEqual(2);
    expect(countSyllables("methodology")).toBeGreaterThanOrEqual(4);
  });
  it("handles empty string", () => {
    expect(countSyllables("")).toBe(0);
  });
  it("ignores non-alpha chars", () => {
    expect(countSyllables("hello!")).toBe(2);
  });
});

describe("eli5 splitSentences / splitWords", () => {
  it("splits on . ! ?", () => {
    const s = splitSentences("Hi there. How are you? I am fine!");
    expect(s).toHaveLength(3);
    expect(s[0]).toBe("Hi there.");
  });
  it("handles empty input", () => {
    expect(splitSentences("")).toEqual([]);
  });
  it("splitWords handles spaces", () => {
    expect(splitWords("  a  b c ")).toEqual(["a", "b", "c"]);
    expect(splitWords("")).toEqual([]);
  });
});

describe("eli5 findLockedTokens", () => {
  it("finds a date", () => {
    const t = "On 2024-03-15 we launched.";
    const hits = findLockedTokens(t);
    expect(hits.some((h) => h.kind === "date")).toBe(true);
  });
  it("finds a currency amount", () => {
    const t = "It cost $1,200 total.";
    const hits = findLockedTokens(t);
    expect(hits.some((h) => h.kind === "currency")).toBe(true);
  });
  it("finds a percentage", () => {
    const t = "Down 40% this year.";
    const hits = findLockedTokens(t);
    expect(hits.some((h) => h.kind === "percent")).toBe(true);
  });
  it("finds a dosage", () => {
    const t = "Take 500mg twice daily.";
    const hits = findLockedTokens(t);
    expect(hits.some((h) => h.kind === "dosage")).toBe(true);
  });
  it("finds a citation like Smith v. Jones, 2020", () => {
    const t = "See Smith v. Jones, 2020 for precedent.";
    const hits = findLockedTokens(t);
    expect(hits.some((h) => h.kind === "citation")).toBe(true);
  });
  it("finds a URL", () => {
    const t = "Visit https://example.com/page for info.";
    const hits = findLockedTokens(t);
    expect(hits.some((h) => h.kind === "url")).toBe(true);
  });
  it("finds a plain number as figure", () => {
    const t = "There were 42 items.";
    const hits = findLockedTokens(t);
    expect(hits.some((h) => h.kind === "figure")).toBe(true);
  });
  it("returns empty for empty input", () => {
    expect(findLockedTokens("")).toEqual([]);
  });
  it("sorts by start position", () => {
    const t = "On 2024-03-15 we had 42 items at $1,200.";
    const hits = findLockedTokens(t);
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i].start).toBeGreaterThanOrEqual(hits[i - 1].start);
    }
  });
});

describe("eli5 jargon detection", () => {
  it("pickReplacement returns simpler for eli5", () => {
    const entry = JARGON_DICTIONARY.find((e) => e.term === "utilization")!;
    expect(pickReplacement(entry, "eli5")).toBe(entry.simpler);
  });
  it("pickReplacement returns plain for grade-school", () => {
    const entry = JARGON_DICTIONARY.find((e) => e.term === "utilization")!;
    expect(pickReplacement(entry, "grade-school")).toBe(entry.plain);
  });
  it("pickReplacement returns original for plain-professional", () => {
    const entry = JARGON_DICTIONARY.find((e) => e.term === "utilization")!;
    expect(pickReplacement(entry, "plain-professional")).toBe(entry.term);
  });
  it("findJargon detects 'utilization'", () => {
    const hits = findJargon(
      "The utilization of resources",
      JARGON_DICTIONARY,
      "grade-school",
    );
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].entry.term).toBe("utilization");
    expect(hits[0].replacement).toBe("use");
  });
  it("findJargon is case-insensitive", () => {
    const hits = findJargon(
      "The Utilization of resources",
      JARGON_DICTIONARY,
      "grade-school",
    );
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].original).toBe("Utilization");
  });
  it("findJargon respects ignored list", () => {
    const hits = findJargon(
      "The utilization of resources",
      JARGON_DICTIONARY,
      "grade-school",
      ["utilization"],
    );
    expect(hits).toHaveLength(0);
  });
  it("applyJargonSubstitutions rewrites the text", () => {
    const hits = findJargon(
      "Utilize the methodology.",
      JARGON_DICTIONARY,
      "grade-school",
    );
    const out = applyJargonSubstitutions("Utilize the methodology.", hits);
    expect(out).toBe("Use the method.");
  });
});

describe("eli5 sentence splitting", () => {
  it("returns the sentence as-is when under threshold", () => {
    const s = "This is short.";
    expect(splitLongSentence(s, 20)).toEqual([s]);
  });
  it("splits a long sentence at a comma", () => {
    const s = "This is a very long sentence with many words, and it should split at the comma, because it goes past the threshold limit.";
    const parts = splitLongSentence(s, 5);
    expect(parts.length).toBeGreaterThan(1);
  });
  it("force-chops when no break points", () => {
    const words = Array.from({ length: 15 }, (_, i) => `word${i}`).join(" ");
    const parts = splitLongSentence(words, 5);
    expect(parts.length).toBeGreaterThanOrEqual(3);
  });
  it("splitLongSentencesInText handles empty input", () => {
    expect(splitLongSentencesInText("", 20, true)).toBe("");
  });
  it("splitLongSentencesInText respects enabled flag", () => {
    const s = "This is a very long sentence with many words, and it should split at the comma, because it goes past the threshold limit.";
    expect(splitLongSentencesInText(s, 5, false)).toBe(s);
  });
});

describe("eli5 bulletize", () => {
  it("bullets sentences", () => {
    const out = bulletize("First. Second. Third.");
    expect(out.split("\n")).toEqual(["- First.", "- Second.", "- Third."]);
  });
  it("returns empty for empty input", () => {
    expect(bulletize("")).toBe("");
  });
});

describe("eli5 detectPassiveVoice", () => {
  it("detects 'was written'", () => {
    const hits = detectPassiveVoice("The book was written by her.");
    expect(hits.length).toBeGreaterThanOrEqual(1);
  });
  it("returns empty for active voice", () => {
    expect(detectPassiveVoice("She wrote the book.")).toHaveLength(0);
  });
});

describe("eli5 computeReadability", () => {
  it("returns zeros for empty text", () => {
    const r = computeReadability("");
    expect(r.wordCount).toBe(0);
    expect(r.sentenceCount).toBe(0);
  });
  it("counts words and sentences", () => {
    const r = computeReadability("The cat sat. The dog ran.");
    expect(r.wordCount).toBe(6);
    expect(r.sentenceCount).toBe(2);
  });
  it("easier text has higher reading ease", () => {
    const easy = computeReadability("The cat sat. The dog ran. I see a bird.");
    const hard = computeReadability(
      "The utilization of multi-faceted pedagogical methodologies facilitates the amelioration of student learning outcomes.",
    );
    expect(easy.fleschReadingEase).toBeGreaterThan(hard.fleschReadingEase);
  });
  it("counts long sentences", () => {
    const longText = "This is a very long sentence that just keeps going and going and going and going and going and going and going and going and going and going and going and going.";
    const r = computeReadability(longText, 20);
    expect(r.longSentenceCount).toBe(1);
  });
});

describe("eli5 diffText", () => {
  it("shows same segments for identical text", () => {
    const segs = diffText("hello world", "hello world");
    expect(segs.every((s) => s.type === "same")).toBe(true);
  });
  it("shows added and removed for changed text", () => {
    const segs = diffText("hello world", "hello there");
    expect(segs.some((s) => s.type === "removed")).toBe(true);
    expect(segs.some((s) => s.type === "added")).toBe(true);
  });
  it("handles empty inputs", () => {
    const segs = diffText("", "");
    expect(segs).toEqual([]);
  });
});

describe("eli5 simplifyText", () => {
  it("simplifies a dense sentence at grade-school level", () => {
    const r = simplifyText(
      "The utilization of multi-faceted methodologies facilitates improvement.",
      { ...DEFAULT_OPTIONS, level: "grade-school" },
    );
    expect(r.simplified).toContain("use");
    expect(r.simplified).toContain("methods");
    expect(r.stats.jargonCount).toBeGreaterThan(0);
  });
  it("preserves locked tokens (date)", () => {
    const r = simplifyText(
      "On 2024-03-15 the utilization improved.",
      { ...DEFAULT_OPTIONS, level: "grade-school", lockTokens: true },
    );
    expect(r.simplified).toContain("2024-03-15");
    expect(r.locked.length).toBeGreaterThan(0);
  });
  it("bullet-izes when option set", () => {
    const r = simplifyText(
      "First sentence. Second sentence.",
      { ...DEFAULT_OPTIONS, bulletize: true },
    );
    expect(r.simplified.split("\n").length).toBe(2);
    expect(r.simplified).toContain("- ");
  });
  it("computes readability improvement", () => {
    const r = simplifyText(
      "The utilization of multi-faceted pedagogical methodologies facilitates the amelioration of student learning outcomes.",
      { ...DEFAULT_OPTIONS, level: "eli5" },
    );
    expect(r.stats.improvement).toBeGreaterThan(0);
  });
  it("handles empty input", () => {
    const r = simplifyText("", DEFAULT_OPTIONS);
    expect(r.simplified).toBe("");
    expect(r.original).toBe("");
  });
  it("plain-professional keeps original terms", () => {
    const r = simplifyText(
      "The utilization of resources.",
      { ...DEFAULT_OPTIONS, level: "plain-professional" },
    );
    expect(r.simplified).toContain("utilization");
  });
});

describe("eli5 history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      level: "eli5",
      originalLength: 100,
      simplifiedLength: 80,
      jargonCount: 3,
      improvement: 12.5,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        level: "eli5",
        originalLength: 100,
        simplifiedLength: 80,
        jargonCount: 3,
        improvement: 10,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      level: "eli5",
      originalLength: 100,
      simplifiedLength: 80,
      jargonCount: 3,
      improvement: 10,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("eli5 ignored (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadIgnored()).toEqual([]);
  });
  it("saves and loads", () => {
    saveIgnored(["utilization", "methodology"]);
    expect(loadIgnored()).toEqual(["utilization", "methodology"]);
  });
});

describe("eli5 shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      text: "hello",
      level: "eli5",
      lockTokens: true,
      splitLongSentences: true,
      bulletize: false,
    });
    expect(url).toContain("text=hello");
    expect(url).toContain("level=eli5");
    expect(url).toContain("lock=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("text=hello&level=eli5&lock=1&split=0&bullets=1");
    expect(p.text).toBe("hello");
    expect(p.level).toBe("eli5");
    expect(p.lockTokens).toBe(true);
    expect(p.splitLongSentences).toBe(false);
    expect(p.bulletize).toBe(true);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown levels", () => {
    const p = parseShareUrl("text=hi&level=unknown-level");
    expect(p.level).toBeUndefined();
  });
});

describe("eli5 BYO-key LLM hook", () => {
  it("builds request body with level-appropriate system prompt", () => {
    const body = buildLlmRequestBody("hello", "eli5");
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("5-year-old");
    expect(body.messages[1].content).toBe("hello");
  });
  it("grade-school prompt mentions grade 5", () => {
    const body = buildLlmRequestBody("hello", "grade-school");
    expect(body.messages[0].content).toContain("grade-5");
  });
  it("extracts content from OpenAI-style response", () => {
    const resp = {
      choices: [{ message: { content: "  Simplified!  " } }],
    };
    expect(extractSimplifiedFromLlmResponse(resp)).toBe("Simplified!");
  });
  it("returns empty for malformed response", () => {
    expect(extractSimplifiedFromLlmResponse(null)).toBe("");
    expect(extractSimplifiedFromLlmResponse({})).toBe("");
    expect(extractSimplifiedFromLlmResponse({ choices: [] })).toBe("");
  });
});

// Suppress unused-import lint
export type _Unused = ReadingLevel | SimplifyOptions;
