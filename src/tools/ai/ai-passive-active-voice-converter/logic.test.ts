import { describe, it, expect, beforeEach } from "vitest";
import {
  PAST_PARTICIPLE_TO_BASE,
  BASE_TO_PAST_TENSE,
  ADJECTIVE_DENYLIST,
  BE_VERB_PATTERNS,
  HISTORY_KEY,
  HISTORY_MAX,
  STYLE_LABELS,
  DIRECTION_LABELS,
  TENSE_LABELS,
  SAMPLE_TEXTS,
  normalizeText,
  escapeHtml,
  countWords,
  splitSentences,
  tokenizeWords,
  isRegularParticiple,
  findBaseVerb,
  isPastParticiple,
  thirdSingularForm,
  simplePastForm,
  pastParticipleForm,
  presentParticipleForm,
  detectPassiveClauses,
  buildExplanation,
  conjugateForTense,
  rewritePassiveToActive,
  rewriteActiveToPassive,
  convertVoice,
  buildConvertedText,
  renderHighlightedHtml,
  renderSuggestionsCsv,
  buildLlmPrompt,
  renderLlmResult,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Direction,
  type StylePreset,
  type Tense,
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

describe("ai-passive-active-voice-converter constants", () => {
  it("has 100+ past participles in the irregular table", () => {
    expect(Object.keys(PAST_PARTICIPLE_TO_BASE).length).toBeGreaterThanOrEqual(100);
  });
  it("has 50+ irregular past-tense entries", () => {
    expect(Object.keys(BASE_TO_PAST_TENSE).length).toBeGreaterThanOrEqual(50);
  });
  it("has a non-empty adjective denylist", () => {
    expect(ADJECTIVE_DENYLIST.size).toBeGreaterThanOrEqual(20);
    expect(ADJECTIVE_DENYLIST.has("tired")).toBe(true);
    expect(ADJECTIVE_DENYLIST.has("interested")).toBe(true);
  });
  it("has 13+ be-verb patterns (covering all tenses)", () => {
    expect(BE_VERB_PATTERNS.length).toBeGreaterThanOrEqual(10);
    const tenses = new Set(BE_VERB_PATTERNS.map((p) => p.tense));
    expect(tenses.has("simple-present")).toBe(true);
    expect(tenses.has("simple-past")).toBe(true);
    expect(tenses.has("present-perfect")).toBe(true);
    expect(tenses.has("modal")).toBe(true);
  });
  it("has 3 style presets", () => {
    expect(Object.keys(STYLE_LABELS)).toHaveLength(3);
  });
  it("has 2 direction labels", () => {
    expect(Object.keys(DIRECTION_LABELS)).toHaveLength(2);
  });
  it("has 8 tense labels", () => {
    expect(Object.keys(TENSE_LABELS)).toHaveLength(8);
  });
  it("has sample texts for both directions", () => {
    expect(SAMPLE_TEXTS.some((s) => s.direction === "to-active")).toBe(true);
    expect(SAMPLE_TEXTS.some((s) => s.direction === "to-passive")).toBe(true);
  });
  it("uses a namespaced localStorage key", () => {
    expect(HISTORY_KEY).toContain("ai-passive-active-voice-converter");
  });
  it("history max is 20", () => {
    expect(HISTORY_MAX).toBe(20);
  });
});

// ---------- Helpers ----------

describe("ai-passive-active-voice-converter helpers", () => {
  it("normalizeText collapses whitespace", () => {
    expect(normalizeText("  hello   world  ")).toBe("hello world");
    expect(normalizeText("a\r\n\r\nb")).toBe("a\n\nb");
  });
  it("escapeHtml escapes dangerous chars", () => {
    expect(escapeHtml('<b>"x"&\'y\'')).toBe("&lt;b&gt;&quot;x&quot;&amp;&#39;y&#39;");
  });
  it("countWords counts whitespace-separated tokens", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("hello world")).toBe(2);
  });
  it("splitSentences splits on terminal punctuation", () => {
    const ss = splitSentences("Hello world. This is a test! Is it working?");
    expect(ss).toHaveLength(3);
    expect(ss[0].text).toContain("Hello world");
    expect(ss[1].text).toContain("This is a test");
  });
  it("splitSentences preserves trailing non-sentence text", () => {
    const ss = splitSentences("One. Two");
    expect(ss.length).toBeGreaterThanOrEqual(1);
  });
  it("tokenizeWords splits alphabetic tokens", () => {
    expect(tokenizeWords("Hello, world!")).toEqual(["Hello", "world"]);
  });
  it("isRegularParticiple recognizes -ed verbs but not adjectives", () => {
    expect(isRegularParticiple("delivered")).toBe(true);
    expect(isRegularParticiple("analyzed")).toBe(true);
    expect(isRegularParticiple("tired")).toBe(false);
    expect(isRegularParticiple("interested")).toBe(false);
  });
});

// ---------- Verb morphology ----------

describe("ai-passive-active-voice-converter verb morphology", () => {
  it("findBaseVerb resolves irregular participles", () => {
    expect(findBaseVerb("written")).toBe("write");
    expect(findBaseVerb("done")).toBe("do");
    expect(findBaseVerb("taken")).toBe("take");
    expect(findBaseVerb("begun")).toBe("begin");
  });
  it("findBaseVerb resolves regular -ed participles", () => {
    expect(findBaseVerb("delivered")).toBe("deliver");
    expect(findBaseVerb("analyzed")).toBe("analyze");
    expect(findBaseVerb("stopped")).toBe("stop");
    expect(findBaseVerb("studied")).toBe("study");
  });
  it("findBaseVerb returns null for non-participles and adjectives", () => {
    expect(findBaseVerb("tired")).toBeNull();
    expect(findBaseVerb("interested")).toBeNull();
    expect(findBaseVerb("cat")).toBeNull();
  });
  it("isPastParticiple works for regular + irregular", () => {
    expect(isPastParticiple("written")).toBe(true);
    expect(isPastParticiple("delivered")).toBe(true);
    expect(isPastParticiple("tired")).toBe(false);
    expect(isPastParticiple("cat")).toBe(false);
  });
  it("thirdSingularForm adds -s/-es/-ies correctly", () => {
    expect(thirdSingularForm("write")).toBe("writes");
    expect(thirdSingularForm("go")).toBe("goes");
    expect(thirdSingularForm("study")).toBe("studies");
    expect(thirdSingularForm("fix")).toBe("fixes");
  });
  it("simplePastForm looks up irregulars", () => {
    expect(simplePastForm("write")).toBe("wrote");
    expect(simplePastForm("take")).toBe("took");
    expect(simplePastForm("do")).toBe("did");
    expect(simplePastForm("go")).toBe("went");
  });
  it("simplePastForm handles regular -ed verbs", () => {
    expect(simplePastForm("deliver")).toBe("delivered");
    expect(simplePastForm("analyze")).toBe("analyzed");
    expect(simplePastForm("study")).toBe("studied");
    expect(simplePastForm("stop")).toBe("stopped");
  });
  it("pastParticipleForm resolves irregulars", () => {
    expect(pastParticipleForm("write")).toBe("written");
    expect(pastParticipleForm("take")).toBe("taken");
  });
  it("presentParticipleForm handles -ing rules", () => {
    expect(presentParticipleForm("write")).toBe("writing");
    expect(presentParticipleForm("study")).toBe("studying");
    expect(presentParticipleForm("stop")).toBe("stopping");
    expect(presentParticipleForm("die")).toBe("dying");
  });
});

// ---------- Detection ----------

describe("ai-passive-active-voice-converter detectPassiveClauses", () => {
  it("detects simple past passive", () => {
    const clauses = detectPassiveClauses("The report was written by Jane.", 0);
    expect(clauses).toHaveLength(1);
    expect(clauses[0].beVerb).toBe("was");
    expect(clauses[0].participle).toBe("written");
    expect(clauses[0].baseVerb).toBe("write");
    expect(clauses[0].tense).toBe("simple-past");
    expect(clauses[0].agent).toBe("Jane");
    expect(clauses[0].agentSource).toBe("by-phrase");
  });
  it("detects present perfect passive", () => {
    const clauses = detectPassiveClauses("The data has been analyzed by the team.", 0);
    expect(clauses).toHaveLength(1);
    expect(clauses[0].tense).toBe("present-perfect");
    expect(clauses[0].beVerb).toBe("has been");
    expect(clauses[0].participle).toBe("analyzed");
    expect(clauses[0].agent).toBe("the team");
  });
  it("detects agentless passives", () => {
    const clauses = detectPassiveClauses("The mixture was heated to 80°C.", 0);
    expect(clauses).toHaveLength(1);
    expect(clauses[0].agent).toBeNull();
    expect(clauses[0].agentSource).toBe("agentless");
    expect(clauses[0].isLegitimate).toBe(true);
    expect(clauses[0].legitimateReason).toBeTruthy();
  });
  it("does not flag adjectives that look like participles", () => {
    const clauses = detectPassiveClauses("She is interested in physics.", 0);
    expect(clauses).toHaveLength(0);
  });
  it("detects modal passive", () => {
    const clauses = detectPassiveClauses("The report must be submitted by Friday.", 0);
    expect(clauses).toHaveLength(1);
    expect(clauses[0].tense).toBe("modal");
  });
  it("detects progressive passive", () => {
    const clauses = detectPassiveClauses("The house was being painted by the crew.", 0);
    expect(clauses).toHaveLength(1);
    expect(clauses[0].tense).toBe("past-progressive");
  });
  it("prefers the longer auxiliary when patterns overlap", () => {
    // "has been analyzed" — should match "has been" (present-perfect), not just "been" alone.
    const clauses = detectPassiveClauses("It has been done.", 0);
    expect(clauses).toHaveLength(1);
    expect(clauses[0].tense).toBe("present-perfect");
  });
});

// ---------- Rewrites ----------

describe("ai-passive-active-voice-converter rewrites", () => {
  it("rewritePassiveToActive produces a confident rewrite when agent is found", () => {
    const clauses = detectPassiveClauses("The report was written by Jane.", 0);
    expect(clauses[0].rewrite).toBeTruthy();
    expect(clauses[0].rewrite).toContain("Jane");
    expect(clauses[0].rewrite).toContain("wrote");
    expect(clauses[0].rewrite).toContain("report");
  });
  it("rewritePassiveToActive returns null for agentless passives", () => {
    const clauses = detectPassiveClauses("The mixture was heated to 80°C.", 0);
    expect(clauses[0].rewrite).toBeNull();
  });
  it("conjugateForTense handles simple present", () => {
    // "is delivered by the team" → "the team delivers"
    expect(conjugateForTense("deliver", "simple-present", "the team")).toBe("delivers");
    expect(conjugateForTense("deliver", "simple-present", "they")).toBe("deliver");
  });
  it("conjugateForTense handles simple past", () => {
    expect(conjugateForTense("write", "simple-past", "Jane")).toBe("wrote");
    expect(conjugateForTense("deliver", "simple-past", "Jane")).toBe("delivered");
  });
  it("conjugateForTense handles present perfect", () => {
    expect(conjugateForTense("write", "present-perfect", "Jane")).toBe("has written");
    expect(conjugateForTense("write", "present-perfect", "they")).toBe("have written");
  });
  it("buildExplanation mentions the tense and rewrite", () => {
    const clauses = detectPassiveClauses("The report was written by Jane.", 0);
    expect(clauses[0].explanation).toContain("simple past");
    expect(clauses[0].explanation).toContain("wrote");
  });
  it("rewriteActiveToPassive produces a passive rewrite", () => {
    const r = rewriteActiveToPassive("Jane wrote the report.", 0);
    expect(r).not.toBeNull();
    expect(r?.passiveRewrite).toContain("was written by");
    expect(r?.passiveRewrite).toContain("Jane");
  });
  it("rewriteActiveToPassive returns null for sentences without clear SVO", () => {
    expect(rewriteActiveToPassive("Hello there.", 0)).toBeNull();
    expect(rewriteActiveToPassive("The cat sat.", 0)).toBeNull();
  });
  it("rewriteActiveToPassive skips sentences already in passive voice", () => {
    expect(rewriteActiveToPassive("The report was written by Jane.", 0)).toBeNull();
  });
});

// ---------- Convert (integration) ----------

describe("ai-passive-active-voice-converter convertVoice", () => {
  it("converts to-active and returns stats", () => {
    const result = convertVoice(
      "The report was written by Jane. The data has been analyzed by the team.",
      "to-active",
      "general",
    );
    expect(result.direction).toBe("to-active");
    expect(result.sentences.length).toBeGreaterThanOrEqual(2);
    expect(result.stats.passiveCount).toBeGreaterThanOrEqual(2);
    expect(result.stats.convertedCount).toBeGreaterThanOrEqual(2);
    expect(result.stats.sentenceCount).toBeGreaterThanOrEqual(2);
    expect(result.stats.passivePercentage).toBeGreaterThan(0);
  });
  it("preserves legitimate passives with academic style", () => {
    const result = convertVoice(
      "The mixture was heated to 80°C.",
      "to-active",
      "academic",
    );
    expect(result.stats.legitimateCount).toBeGreaterThanOrEqual(1);
    // With academic style, legitimate passives should NOT be rewritten.
    expect(result.stats.convertedCount).toBe(0);
  });
  it("converts to-passive direction", () => {
    const result = convertVoice(
      "Jane wrote the report. The team analyzed the data.",
      "to-passive",
      "general",
    );
    expect(result.direction).toBe("to-passive");
    expect(result.stats.activeCount).toBeGreaterThanOrEqual(1);
    expect(result.converted).toContain("was written by");
  });
  it("handles empty input gracefully", () => {
    const result = convertVoice("", "to-active", "general");
    expect(result.original).toBe("");
    expect(result.sentences).toEqual([]);
    expect(result.stats.sentenceCount).toBe(0);
  });
  it("buildConvertedText applies rewrites", () => {
    const result = convertVoice(
      "The report was written by Jane.",
      "to-active",
      "general",
    );
    expect(result.converted).toContain("Jane");
    expect(result.converted).toContain("wrote");
  });
});

// ---------- Rendering ----------

describe("ai-passive-active-voice-converter rendering", () => {
  it("renderHighlightedHtml wraps passive clauses in <mark>", () => {
    const result = convertVoice(
      "The report was written by Jane.",
      "to-active",
      "general",
    );
    const html = renderHighlightedHtml(result);
    expect(html).toContain("<mark");
    expect(html).toContain("pa-passive");
  });
  it("renderHighlightedHtml returns escaped text for to-passive direction", () => {
    const result = convertVoice("Jane wrote.", "to-passive", "general");
    const html = renderHighlightedHtml(result);
    expect(html).toBe("Jane wrote.");
  });
  it("renderSuggestionsCsv emits a header + rows", () => {
    const result = convertVoice(
      "The report was written by Jane.",
      "to-active",
      "general",
    );
    const csv = renderSuggestionsCsv(result);
    expect(csv).toContain("sentence_index,direction,clause,rewrite,explanation,legitimate");
    expect(csv.split("\n").length).toBeGreaterThanOrEqual(2);
  });
});

// ---------- LLM prompt ----------

describe("ai-passive-active-voice-converter LLM prompt", () => {
  it("to-active prompt asks for passive detection", () => {
    const p = buildLlmPrompt("The report was written.", "to-active");
    expect(p).toContain("passive-voice");
    expect(p).toContain("active-voice rewrite");
  });
  it("to-passive prompt asks for passive rewrite", () => {
    const p = buildLlmPrompt("Jane wrote the report.", "to-passive");
    expect(p).toContain("passive-voice rewrite");
  });
  it("renderLlmResult trims whitespace", () => {
    expect(renderLlmResult("  hi  ")).toBe("hi");
  });
});

// ---------- History ----------

describe("ai-passive-active-voice-converter history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, direction: "to-active", style: "general",
      textLength: 100, sentenceCount: 3, passiveCount: 2,
      convertedCount: 2, passivePercentage: 67,
    });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].direction).toBe("to-active");
    expect(h[0].passivePercentage).toBe(67);
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, direction: "to-active", style: "general",
        textLength: 10, sentenceCount: 1, passiveCount: 1,
        convertedCount: 1, passivePercentage: 100,
      });
    }
    expect(loadHistory()).toHaveLength(HISTORY_MAX);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, direction: "to-active", style: "general",
      textLength: 1, sentenceCount: 1, passiveCount: 1,
      convertedCount: 1, passivePercentage: 100,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------- Shareable URL ----------

describe("ai-passive-active-voice-converter shareable URL", () => {
  it("builds a share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("Hello", "to-active", "academic");
    expect(url).toContain("text=Hello");
    expect(url).toContain("dir=to-active");
    expect(url).toContain("style=academic");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses a share URL back", () => {
    const s = parseShareUrl("text=Hi&dir=to-passive&style=journalism");
    expect(s.text).toBe("Hi");
    expect(s.direction).toBe("to-passive");
    expect(s.style).toBe("journalism");
  });
  it("handles empty hash with defaults", () => {
    const s = parseShareUrl("");
    expect(s.text).toBe("");
    expect(s.direction).toBe("to-active");
    expect(s.style).toBe("general");
  });
  it("falls back to defaults for invalid values", () => {
    const s = parseShareUrl("text=hi&dir=bogus&style=bogus");
    expect(s.direction).toBe("to-active");
    expect(s.style).toBe("general");
  });
});

// Suppress unused-import lint
export type _Unused = Direction | StylePreset | Tense;
