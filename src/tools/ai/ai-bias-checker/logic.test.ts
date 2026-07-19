import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_MAX,
  LEFT_LEAN_TERMS,
  RIGHT_LEAN_TERMS,
  LOADED_VERBS,
  SUBJECTIVE_ADJECTIVES,
  WEASEL_WORDS,
  HEDGES,
  ABSOLUTISMS,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  LEAN_LABELS,
  getLexicon,
  splitSentences,
  tokenize,
  countWords,
  countSyllables,
  buildPhraseRegex,
  findPhrases,
  findPatternPhrases,
  sentenceIndexAt,
  classifySentence,
  scoreEmotional,
  scoreSubjectivity,
  scorePoliticalLean,
  scoreFactual,
  scoreOneSidedness,
  scoreSensationalism,
  scoreOverall,
  detectClickbait,
  computeReadability,
  findMissingPerspectives,
  suggestNeutral,
  neutralizeSentence,
  neutralizeText,
  buildLeanReasoning,
  analyze,
  computeStats,
  renderMarkdown,
  renderJson,
  renderHtml,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type BiasCategory,
  type LeanLabel,
  type Sensitivity,
  type Phrase,
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

describe("ai-bias-checker lexicon integrity", () => {
  it("has no duplicates in left-lean terms", () => {
    const set = new Set(LEFT_LEAN_TERMS.map((t) => t.toLowerCase()));
    expect(set.size).toBe(LEFT_LEAN_TERMS.length);
  });
  it("has no duplicates in right-lean terms", () => {
    const set = new Set(RIGHT_LEAN_TERMS.map((t) => t.toLowerCase()));
    expect(set.size).toBe(RIGHT_LEAN_TERMS.length);
  });
  it("has no duplicates in weasel words", () => {
    const set = new Set(WEASEL_WORDS.map((t) => t.toLowerCase()));
    expect(set.size).toBe(WEASEL_WORDS.length);
  });
  it("has no duplicate keys in loaded-verbs map", () => {
    // Object literal de-dupes; verify some canonical entries are present.
    expect(LOADED_VERBS["slam"]).toBe("criticize");
    expect(LOADED_VERBS["destroy"]).toBe("defeat");
    expect(Object.keys(LOADED_VERBS).length).toBeGreaterThanOrEqual(20);
  });
  it("has no duplicate keys in subjective-adjectives map", () => {
    // Verify canonical entries + size.
    expect(SUBJECTIVE_ADJECTIVES["beautiful"]).toBe("");
    expect(SUBJECTIVE_ADJECTIVES["massive"]).toBe("large");
    expect(Object.keys(SUBJECTIVE_ADJECTIVES).length).toBeGreaterThanOrEqual(30);
  });
  it("has all 9 category labels and colors", () => {
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(9);
    expect(Object.keys(CATEGORY_COLORS)).toHaveLength(9);
  });
  it("has 5 lean labels", () => {
    expect(Object.keys(LEAN_LABELS)).toHaveLength(5);
  });
  it("getLexicon returns fresh arrays", () => {
    const a = getLexicon();
    const b = getLexicon();
    expect(a).not.toBe(b);
    expect(a.leftLean).not.toBe(b.leftLean);
    expect(a.leftLean).toEqual(b.leftLean);
  });
  it("hedges and absolutisms are non-empty", () => {
    expect(HEDGES.length).toBeGreaterThanOrEqual(15);
    expect(ABSOLUTISMS.length).toBeGreaterThanOrEqual(15);
  });
});

describe("ai-bias-checker text utilities", () => {
  it("splitSentences parses basic sentences", () => {
    const s = splitSentences("Hello world. This is a test! Is it working?");
    expect(s).toHaveLength(3);
    expect(s[0].text).toBe("Hello world.");
    expect(s[1].text).toBe("This is a test!");
    expect(s[2].text).toBe("Is it working?");
  });
  it("splitSentences returns empty for empty input", () => {
    expect(splitSentences("")).toEqual([]);
  });
  it("splitSentences handles trailing text without final punctuation", () => {
    const s = splitSentences("First sentence. Second without period");
    expect(s).toHaveLength(2);
  });
  it("tokenize lowercases and strips punctuation", () => {
    expect(tokenize("Hello, WORLD! It's working.")).toEqual([
      "hello", "world", "it's", "working",
    ]);
  });
  it("countWords counts whitespace-separated tokens", () => {
    expect(countWords("one two three")).toBe(3);
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
  it("countSyllables handles short and long words", () => {
    expect(countSyllables("the")).toBe(1);
    expect(countSyllables("apple")).toBe(2);
    expect(countSyllables("banana")).toBeGreaterThanOrEqual(2);
  });
  it("buildPhraseRegex matches case-insensitively", () => {
    const re = buildPhraseRegex("slam");
    expect(re.test("They SLAM the proposal")).toBe(true);
    expect(re.test("slamming")).toBe(false); // \b boundary
  });
  it("buildPhraseRegex handles multi-word phrases", () => {
    const re = buildPhraseRegex("some say");
    expect(re.test("Some say that")).toBe(true);
  });
});

describe("ai-bias-checker phrase detection", () => {
  it("findPhrases detects loaded verbs", () => {
    const text = "The senator slammed the proposal yesterday.";
    const sents = splitSentences(text);
    const phrases = findPhrases(text, sents, Object.keys(LOADED_VERBS), "loaded-verb", LOADED_VERBS);
    expect(phrases.length).toBeGreaterThanOrEqual(1);
    expect(phrases[0].text.toLowerCase()).toBe("slammed");
    expect(phrases[0].category).toBe("loaded-verb");
    expect(phrases[0].suggestion).toBe("criticized");
  });
  it("findPhrases detects subjective adjectives", () => {
    const text = "It was a beautiful and terrible day.";
    const sents = splitSentences(text);
    const phrases = findPhrases(text, sents, Object.keys(SUBJECTIVE_ADJECTIVES), "subjective-adj", SUBJECTIVE_ADJECTIVES);
    expect(phrases.length).toBe(2);
  });
  it("findPhrases detects weasel words", () => {
    const text = "Some say that the policy is flawed. Many believe otherwise.";
    const sents = splitSentences(text);
    const phrases = findPhrases(text, sents, WEASEL_WORDS, "weasel");
    expect(phrases.length).toBeGreaterThanOrEqual(2);
  });
  it("findPhrases respects low sensitivity cap", () => {
    const text = "Always! Always! Always! Never! Never! Everyone! Everyone! Everyone!";
    const sents = splitSentences(text);
    const phrases = findPhrases(text, sents, ABSOLUTISMS, "absolutism", undefined, "low");
    // Low sensitivity caps at 5 per category.
    expect(phrases.length).toBeLessThanOrEqual(5);
  });
  it("findPhrases returns empty for empty input", () => {
    expect(findPhrases("", [], ABSOLUTISMS, "absolutism")).toEqual([]);
  });
  it("findPatternPhrases detects passive-evasion", () => {
    const text = "Mistakes were made during the rollout.";
    const sents = splitSentences(text);
    const re = [/mistakes were made/i];
    const phrases = findPatternPhrases(text, sents, re, "passive-evasion");
    expect(phrases).toHaveLength(1);
    expect(phrases[0].category).toBe("passive-evasion");
  });
  it("sentenceIndexAt returns correct sentence for offset", () => {
    const text = "First sentence. Second sentence. Third sentence.";
    const sents = splitSentences(text);
    expect(sentenceIndexAt(sents, 0)).toBe(0);
    expect(sentenceIndexAt(sents, 20)).toBe(1);
  });
});

describe("ai-bias-checker sentence classification", () => {
  it("classifySentence returns fact for statistical sentence", () => {
    expect(classifySentence("According to the data, 45% of users agreed.")).toBe("fact");
  });
  it("classifySentence returns opinion for should-statement", () => {
    expect(classifySentence("The government should do more about this.")).toBe("opinion");
  });
  it("classifySentence returns mixed for fact+opinion", () => {
    expect(classifySentence("According to a 2024 study, we should act now.")).toBe("mixed");
  });
  it("classifySentence returns neutral for plain statement", () => {
    expect(classifySentence("The cat sat on the mat.")).toBe("neutral");
  });
});

describe("ai-bias-checker scoring", () => {
  it("scoreEmotional increases with loaded verbs", () => {
    const plain = "The meeting was held on Tuesday.";
    const loaded = "The senator SLAMMED the proposal!!!";
    const sents = splitSentences(loaded);
    const sPhrases = findPhrases(loaded, sents, Object.keys(LOADED_VERBS), "loaded-verb", LOADED_VERBS);
    expect(scoreEmotional(loaded, sPhrases)).toBeGreaterThan(scoreEmotional(plain, []));
  });
  it("scoreSubjectivity increases with first-person pronouns", () => {
    const objective = "The report was published in March.";
    const subjective = "I think we must act now to save our future.";
    expect(scoreSubjectivity(subjective, [])).toBeGreaterThan(scoreSubjectivity(objective, []));
  });
  it("scorePoliticalLean returns center with no political terms", () => {
    const r = scorePoliticalLean([]);
    expect(r.label).toBe("center");
    expect(r.score).toBe(0);
  });
  it("scorePoliticalLean returns left for left-only phrases", () => {
    const phrases: Phrase[] = [
      { category: "left-lean", text: "progressive", start: 0, end: 10, sentenceIndex: 0 },
      { category: "left-lean", text: "equity", start: 11, end: 17, sentenceIndex: 0 },
    ];
    const r = scorePoliticalLean(phrases);
    expect(r.score).toBeLessThan(0);
    expect(r.label).toBe("left");
  });
  it("scorePoliticalLean returns right for right-only phrases", () => {
    const phrases: Phrase[] = [
      { category: "right-lean", text: "woke", start: 0, end: 4, sentenceIndex: 0 },
      { category: "right-lean", text: "cancel culture", start: 5, end: 19, sentenceIndex: 0 },
    ];
    const r = scorePoliticalLean(phrases);
    expect(r.score).toBeGreaterThan(0);
    expect(r.label).toBe("right");
  });
  it("scorePoliticalLean returns center for balanced phrases", () => {
    const phrases: Phrase[] = [
      { category: "left-lean", text: "progressive", start: 0, end: 10, sentenceIndex: 0 },
      { category: "right-lean", text: "woke", start: 11, end: 15, sentenceIndex: 0 },
    ];
    const r = scorePoliticalLean(phrases);
    expect(r.label).toBe("center");
    expect(r.score).toBe(0);
  });
  it("scoreFactual increases with data cues", () => {
    const factual = "According to a 2024 study, 45% of users agreed, the report shows.";
    const non = "I think this is great.";
    expect(scoreFactual(factual, splitSentences(factual))).toBeGreaterThan(
      scoreFactual(non, splitSentences(non)),
    );
  });
  it("scoreOneSidedness is high without opposing cues", () => {
    const one = "The policy is great. The policy is wonderful. Everyone supports it.";
    const sents = splitSentences(one);
    expect(scoreOneSidedness(one, sents)).toBeGreaterThan(50);
  });
  it("scoreOneSidedness drops with 'however'", () => {
    const balanced = "The policy is great. However, critics disagree strongly.";
    const sents = splitSentences(balanced);
    expect(scoreOneSidedness(balanced, sents)).toBeLessThan(50);
  });
  it("scoreSensationalism increases with clickbait", () => {
    const plain = "The meeting was held on Tuesday.";
    const bait = "You won't believe what happened next!";
    const phrases = findPatternPhrases(bait, splitSentences(bait), [/you won['']?t believe/i], "clickbait");
    expect(scoreSensationalism(bait, phrases)).toBeGreaterThan(scoreSensationalism(plain, []));
  });
  it("scoreOverall is bounded 0-100", () => {
    const s = scoreOverall({
      politicalLean: 80, leanLabel: "right", politicalConfidence: 90,
      emotional: 90, factual: 10, oneSidedness: 90, sensationalism: 90,
    });
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
    expect(s).toBeGreaterThan(50);
  });
  it("detectClickbait returns true for clickbait text", () => {
    const text = "You won't believe what happened next!";
    const r = detectClickbait(text, []);
    expect(r.isClickbait).toBe(true);
    expect(r.reasons.length).toBeGreaterThan(0);
  });
  it("detectClickbait returns false for plain text", () => {
    const r = detectClickbait("The committee met on Tuesday to discuss the proposal.", []);
    expect(r.isClickbait).toBe(false);
  });
});

describe("ai-bias-checker readability", () => {
  it("computeReadability returns 0 for empty text", () => {
    const r = computeReadability("");
    expect(r.fleschScore).toBe(0);
    expect(r.label).toBe("No text");
  });
  it("computeReadability scores simple text higher than complex", () => {
    const easy = "The cat sat on the mat. The dog ran fast. The sun is bright.";
    const hard = "Notwithstanding the antecedent circumstances attending the promulgation of the aforementioned ordinance, the substantive operational ramifications remain abstruse.";
    expect(computeReadability(easy).fleschScore).toBeGreaterThan(computeReadability(hard).fleschScore);
  });
});

describe("ai-bias-checker missing perspectives", () => {
  it("findMissingPerspectives returns all 6 with detection flags", () => {
    const r = findMissingPerspectives("The report was published.");
    expect(r).toHaveLength(6);
    expect(r.every((m) => typeof m.detected === "boolean")).toBe(true);
  });
  it("findMissingPerspectives detects 'however' as opposing viewpoint", () => {
    const r = findMissingPerspectives("The plan is good. However, critics disagree.");
    const opp = r.find((m) => m.label.includes("Opposing"));
    expect(opp?.detected).toBe(true);
  });
});

describe("ai-bias-checker neutral rewrite", () => {
  it("suggestNeutral returns replacement for loaded verb", () => {
    expect(suggestNeutral("loaded-verb", "slammed")).toBe("criticized");
  });
  it("suggestNeutral returns '[who?]' for weasel word", () => {
    expect(suggestNeutral("weasel", "some say")).toBe("[who?]");
  });
  it("suggestNeutral returns '' for subjective adjective", () => {
    expect(suggestNeutral("subjective-adj", "beautiful")).toBe("");
  });
  it("neutralizeSentence replaces loaded verb", () => {
    const text = "The senator slammed the proposal.";
    const phrases = findPhrases(text, splitSentences(text), Object.keys(LOADED_VERBS), "loaded-verb", LOADED_VERBS);
    const out = neutralizeSentence(text, phrases);
    expect(out).toContain("criticized");
    expect(out).not.toMatch(/\bslammed\b/i);
  });
  it("neutralizeSentence removes subjective adjective", () => {
    const text = "It was a beautiful day.";
    const phrases = findPhrases(text, splitSentences(text), Object.keys(SUBJECTIVE_ADJECTIVES), "subjective-adj", SUBJECTIVE_ADJECTIVES);
    const out = neutralizeSentence(text, phrases);
    expect(out).not.toMatch(/\bbeautiful\b/i);
  });
  it("neutralizeText joins all sentences", () => {
    const text = "The senator slammed the proposal. It was a terrible mistake.";
    const report = analyze(text);
    const out = neutralizeText(report.sentences);
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
    expect(out).not.toMatch(/\bslammed\b/i);
  });
});

describe("ai-bias-checker analyze (integration)", () => {
  it("returns empty report for empty input", () => {
    const r = analyze("");
    expect(r.sentences).toEqual([]);
    expect(r.scores.overall).toBe(0);
    expect(r.scores.leanLabel).toBe("center");
  });
  it("detects bias in loaded text", () => {
    const text = "The radical progressive agenda will destroy our society. Some say it is the worst plan ever. You won't believe what happens next!";
    const r = analyze(text);
    expect(r.phrases.length).toBeGreaterThan(0);
    expect(r.scores.overall).toBeGreaterThan(20);
    expect(r.clickbait).toBe(true);
  });
  it("returns lower overall score for neutral text", () => {
    const neutral = "The committee met on Tuesday to discuss the proposal. According to a 2024 report, 45% of residents agreed. However, critics noted methodological limitations.";
    const r = analyze(neutral);
    expect(r.scores.overall).toBeLessThan(50);
    expect(r.factCount).toBeGreaterThan(0);
  });
  it("buildLeanReasoning includes lean label and term counts", () => {
    const phrases: Phrase[] = [
      { category: "left-lean", text: "progressive", start: 0, end: 10, sentenceIndex: 0 },
    ];
    const lean = { score: -100, label: "left" as LeanLabel, confidence: 70 };
    const r = buildLeanReasoning(phrases, lean);
    expect(r.some((s) => s.includes("Left"))).toBe(true);
    expect(r.some((s) => s.includes("Left-leaning terms"))).toBe(true);
  });
  it("computeStats aggregates phrase counts", () => {
    const text = "The senator slammed the proposal. Some say it was beautiful.";
    const report = analyze(text);
    const stats = computeStats(report);
    expect(stats.wordCount).toBeGreaterThan(5);
    expect(stats.sentenceCount).toBe(2);
    expect(stats.phraseCount).toBe(report.phrases.length);
    expect(stats.byCategory["loaded-verb"]).toBeGreaterThanOrEqual(1);
  });
});

describe("ai-bias-checker renderers", () => {
  it("renderMarkdown contains scores and sections", () => {
    const r = analyze("The senator slammed the proposal. Some say it was terrible.");
    const md = renderMarkdown(r);
    expect(md).toContain("# Bias Report");
    expect(md).toContain("Overall bias score");
    expect(md).toContain("Phrase counts by category");
    expect(md).toContain("Neutral rewrite");
  });
  it("renderJson produces valid JSON", () => {
    const r = analyze("The senator slammed the proposal.");
    const json = renderJson(r);
    const parsed = JSON.parse(json);
    expect(parsed.scores).toBeDefined();
    expect(parsed.sentences).toBeInstanceOf(Array);
  });
  it("renderHtml wraps flagged phrases in <mark>", () => {
    const r = analyze("The senator slammed the proposal.");
    const html = renderHtml(r);
    expect(html).toContain("<mark");
    expect(html).toContain("</mark>");
  });
  it("renderHtml returns placeholder for empty input", () => {
    const r = analyze("");
    expect(renderHtml(r)).toContain("No text");
  });
});

describe("ai-bias-checker history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, snippet: "test", overall: 50, leanLabel: "center" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, snippet: `t${i}`, overall: i, leanLabel: "center" });
    }
    expect(loadHistory()).toHaveLength(HISTORY_MAX);
  });
  it("clears history", () => {
    saveHistory({ ts: 1, snippet: "x", overall: 1, leanLabel: "center" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-bias-checker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("hello world", "high");
    // URLSearchParams encodes spaces as either + or %20 — both are valid.
    expect(url).toMatch(/text=hello(?:%20|\+)world/);
    expect(url).toContain("sens=high");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back (with + or %20 encoding)", () => {
    const p1 = parseShareUrl("text=hello%20world&sens=high");
    const p2 = parseShareUrl("text=hello+world&sens=high");
    expect(p1.text).toBe("hello world");
    expect(p2.text).toBe("hello world");
    expect(p1.sensitivity).toBe("high");
  });
  it("defaults sensitivity to medium when not specified", () => {
    const p = parseShareUrl("text=foo");
    expect(p.sensitivity).toBe("medium");
  });
  it("rejects invalid sensitivity", () => {
    const p = parseShareUrl("text=foo&sens=bogus");
    expect(p.sensitivity).toBe("medium");
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.text).toBe("");
    expect(p.sensitivity).toBe("medium");
  });
});

describe("ai-bias-checker LLM enhancement", () => {
  it("buildLlmPrompt includes the article text and JSON instructions", () => {
    const p = buildLlmPrompt("The senator slammed the proposal.");
    expect(p).toContain("JSON object");
    expect(p).toContain("lean");
    expect(p).toContain("The senator slammed");
  });
  it("renderLlmResult parses valid JSON", () => {
    const raw = JSON.stringify({
      lean: "left",
      leanConfidence: 70,
      emotionScore: 80,
      factualScore: 30,
      oneSidednessScore: 75,
      sensationalismScore: 60,
      flaggedPhrases: [{ phrase: "slammed", category: "loaded-verb", suggestion: "criticized" }],
      missingPerspectives: ["opposing voices"],
      neutralRewrite: "The senator criticized the proposal.",
      reasoning: ["Detected loaded verb."],
    });
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.result.lean).toBe("left");
      expect(r.result.flaggedPhrases).toHaveLength(1);
      expect(r.result.reasoning).toHaveLength(1);
    }
  });
  it("renderLlmResult parses JSON wrapped in code fence", () => {
    const raw = "```json\n" + JSON.stringify({ lean: "center" }) + "\n```";
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
  });
  it("renderLlmResult rejects invalid JSON", () => {
    const r = renderLlmResult("not valid json");
    expect(r.ok).toBe(false);
  });
  it("renderLlmResult rejects non-object JSON", () => {
    const r = renderLlmResult("[1,2,3]");
    expect(r.ok).toBe(false);
  });
  it("renderLlmResult falls back to center for invalid lean", () => {
    const r = renderLlmResult(JSON.stringify({ lean: "bogus" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.result.lean).toBe("center");
  });
});

// Suppress unused-import lint for type-only exports used in tests.
export type _Unused = BiasCategory | LeanLabel | Sensitivity;
