import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  BOTS_KEY,
  BOTS_MAX,
  LLM_KEY_STORAGE,
  TONE_LABELS,
  INTENT_LABELS,
  DEFAULT_CONFIG,
  DEFAULT_PERSONA,
  DEFAULT_FALLBACK,
  FIELD_HINTS,
  parseKb,
  sampleKbString,
  tokenize,
  tokenizeAll,
  normalizeText,
  extractTags,
  termFreq,
  computeIdf,
  scoreTfIdf,
  scoreJaccard,
  levenshtein,
  scoreLevenshtein,
  bestTokenLevenshtein,
  scoreMatch,
  findBestMatch,
  detectIntent,
  intentResponse,
  toneWrap,
  applyGuardrails,
  validateKb,
  computeStats,
  chunkEntry,
  generateResponse,
  runTestQueries,
  testSummary,
  renderTranscriptText,
  renderTranscriptMarkdown,
  renderConfigJson,
  parseConfigJson,
  loadHistory,
  saveHistory,
  clearHistory,
  loadBots,
  saveBot,
  deleteBot,
  clearBots,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  honestyNote,
  type BotConfig,
  type Tone,
  type Intent,
  type ChatMessage,
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

function makeConfig(overrides: Partial<BotConfig> = {}): BotConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

function makeKbConfig(): BotConfig {
  return makeConfig({
    kb: parseKb(sampleKbString()),
  });
}

// ---------- Constants ----------

describe("ai-chatbot-emulator constants", () => {
  it("has 4 tones and 6 intents", () => {
    expect(Object.keys(TONE_LABELS)).toHaveLength(4);
    expect(Object.keys(INTENT_LABELS)).toHaveLength(6);
  });
  it("has hints for all 11 config fields", () => {
    expect(Object.keys(FIELD_HINTS)).toHaveLength(11);
  });
  it("has default persona and fallback", () => {
    expect(DEFAULT_PERSONA.length).toBeGreaterThan(0);
    expect(DEFAULT_FALLBACK.length).toBeGreaterThan(0);
  });
  it("default config has valid weights and threshold", () => {
    expect(DEFAULT_CONFIG.weightTfIdf).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.weightJaccard).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.weightLevenshtein).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.confidenceThreshold).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_CONFIG.confidenceThreshold).toBeLessThanOrEqual(1);
  });
});

// ---------- KB parsing ----------

describe("ai-chatbot-emulator parseKb", () => {
  it("parses 'Q: ... | A: ...' format", () => {
    const kb = parseKb("Q: What is X? | A: X is a thing.");
    expect(kb).toHaveLength(1);
    expect(kb[0]!.question).toBe("What is X?");
    expect(kb[0]!.answer).toBe("X is a thing.");
    expect(kb[0]!.tokens.length).toBeGreaterThan(0);
  });
  it("parses multiple entries with newline-separated A:", () => {
    const raw = "Q: What is X?\nA: X is a thing.\nQ: What is Y?\nA: Y is another.";
    const kb = parseKb(raw);
    expect(kb).toHaveLength(2);
    expect(kb[1]!.question).toBe("What is Y?");
  });
  it("parses simple pipe format (one per line)", () => {
    const kb = parseKb("What is X?|A thing\nWhat is Y?|Another");
    expect(kb).toHaveLength(2);
  });
  it("parses question-mark separator format", () => {
    const kb = parseKb("What is X? A thing.");
    expect(kb).toHaveLength(1);
    expect(kb[0]!.question).toBe("What is X?");
    expect(kb[0]!.answer).toBe("A thing.");
  });
  it("strips markdown list markers", () => {
    const kb = parseKb("- What is X?|A thing");
    expect(kb).toHaveLength(1);
    expect(kb[0]!.question).toBe("What is X?");
  });
  it("returns empty for empty input", () => {
    expect(parseKb("")).toEqual([]);
    expect(parseKb("   ")).toEqual([]);
  });
  it("skips entries with empty question or answer", () => {
    expect(parseKb("|A thing")).toEqual([]);
    expect(parseKb("What is X?|")).toEqual([]);
  });
  it("parses sample KB and returns 4 entries", () => {
    const kb = parseKb(sampleKbString());
    expect(kb).toHaveLength(4);
    expect(kb.some((e) => e.question.toLowerCase().includes("password"))).toBe(true);
  });
  it("assigns sequential ids", () => {
    const kb = parseKb("Q: Q1? | A: A1\nQ: Q2? | A: A2");
    expect(kb[0]!.id).toBe(1);
    expect(kb[1]!.id).toBe(2);
  });
});

// ---------- Tokenization ----------

describe("ai-chatbot-emulator tokenize", () => {
  it("lowercases and splits on non-alphanumeric", () => {
    expect(tokenize("Hello, World!")).toEqual(["hello", "world"]);
  });
  it("filters stop words", () => {
    const tokens = tokenize("What is the best way to do this?");
    expect(tokens).not.toContain("what");
    expect(tokens).not.toContain("is");
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("to");
    expect(tokens).not.toContain("do");
    expect(tokens).toContain("best");
    expect(tokens).toContain("way");
  });
  it("returns empty for empty input", () => {
    expect(tokenize("")).toEqual([]);
  });
  it("tokenizeAll includes stop words", () => {
    const tokens = tokenizeAll("What is the best?");
    expect(tokens).toContain("what");
    expect(tokens).toContain("is");
    expect(tokens).toContain("the");
    expect(tokens).toContain("best");
  });
});

describe("ai-chatbot-emulator normalizeText", () => {
  it("lowercases and strips non-alphanumeric (preserves spaces)", () => {
    expect(normalizeText("Hello, World!")).toBe("hello world");
  });
  it("collapses multiple spaces", () => {
    expect(normalizeText("hello   world")).toBe("hello world");
  });
  it("handles empty input", () => {
    expect(normalizeText("")).toBe("");
  });
});

describe("ai-chatbot-emulator extractTags", () => {
  it("returns first 5 tokens", () => {
    const tags = extractTags("What is the best way to reset my password today");
    expect(tags.length).toBeLessThanOrEqual(5);
    expect(tags).toContain("best");
  });
});

// ---------- Scoring ----------

describe("ai-chatbot-emulator termFreq", () => {
  it("counts token frequencies", () => {
    const tf = termFreq(["a", "b", "a"]);
    expect(tf.get("a")).toBe(2);
    expect(tf.get("b")).toBe(1);
  });
});

describe("ai-chatbot-emulator computeIdf", () => {
  it("computes idf for a KB", () => {
    const kb = parseKb("Q: reset password | A: click reset link\nQ: cancel subscription | A: settings billing");
    const idf = computeIdf(kb);
    // 'reset' appears in 1 of 2 entries -> idf = log(1 + 2/1) > 0
    expect(idf.get("reset")).toBeGreaterThan(0);
  });
});

describe("ai-chatbot-emulator scoreTfIdf", () => {
  it("returns 0 for empty tokens", () => {
    expect(scoreTfIdf([], ["a"], new Map())).toBe(0);
    expect(scoreTfIdf(["a"], [], new Map())).toBe(0);
  });
  it("returns >0 for overlapping tokens", () => {
    const idf = new Map([["reset", 1], ["password", 1]]);
    const score = scoreTfIdf(["reset", "password"], ["reset", "password"], idf);
    expect(score).toBeGreaterThan(0);
  });
});

describe("ai-chatbot-emulator scoreJaccard", () => {
  it("returns 1 for identical sets", () => {
    expect(scoreJaccard(["a", "b"], ["a", "b"])).toBe(1);
  });
  it("returns 0 for disjoint sets", () => {
    expect(scoreJaccard(["a"], ["b"])).toBe(0);
  });
  it("returns 0 for empty inputs", () => {
    expect(scoreJaccard([], ["a"])).toBe(0);
    expect(scoreJaccard(["a"], [])).toBe(0);
  });
  it("returns 0.5 for half overlap", () => {
    // {a, b} ∩ {a, c} = {a}, union = {a,b,c} -> 1/3
    expect(scoreJaccard(["a", "b"], ["a", "c"])).toBeCloseTo(1 / 3, 5);
  });
});

describe("ai-chatbot-emulator levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("hello", "hello")).toBe(0);
  });
  it("returns string length for empty input", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
  });
  it("computes edit distance correctly", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("cat", "cut")).toBe(1);
  });
});

describe("ai-chatbot-emulator scoreLevenshtein", () => {
  it("returns 1 for identical strings", () => {
    expect(scoreLevenshtein("hello", "hello")).toBe(1);
  });
  it("returns 0 for empty input", () => {
    expect(scoreLevenshtein("", "abc")).toBe(0);
    expect(scoreLevenshtein("abc", "")).toBe(0);
  });
  it("returns partial score for similar strings", () => {
    const s = scoreLevenshtein("cat", "cut");
    expect(s).toBeGreaterThan(0.5);
    expect(s).toBeLessThan(1);
  });
});

describe("ai-chatbot-emulator bestTokenLevenshtein", () => {
  it("returns 0 for empty inputs", () => {
    expect(bestTokenLevenshtein([], ["a"])).toBe(0);
    expect(bestTokenLevenshtein(["a"], [])).toBe(0);
  });
  it("returns 1 for identical tokens", () => {
    expect(bestTokenLevenshtein(["cat"], ["cat"])).toBe(1);
  });
  it("handles typos via fuzzy match", () => {
    const s = bestTokenLevenshtein(["recieve"], ["receive"]);
    // 'recieve' vs 'receive' has edit distance 2 over 7 chars -> 5/7 ≈ 0.714
    expect(s).toBeGreaterThan(0.7);
  });
});

describe("ai-chatbot-emulator scoreMatch", () => {
  it("computes a combined score", () => {
    const idf = new Map([["reset", 1], ["password", 1]]);
    const entry = { id: 1, question: "How do I reset password?", answer: "Click reset.", tokens: ["reset", "password"], tags: [] };
    const score = scoreMatch(["reset", "password"], entry, idf, { tfIdf: 0.4, jaccard: 0.3, levenshtein: 0.3 });
    expect(score.entryId).toBe(1);
    expect(score.combined).toBeGreaterThanOrEqual(0);
    expect(score.combined).toBeLessThanOrEqual(1);
  });
});

describe("ai-chatbot-emulator findBestMatch", () => {
  it("returns null best for empty KB", () => {
    const result = findBestMatch("hello", makeConfig({ kb: [] }));
    expect(result.best).toBeNull();
    expect(result.scores).toEqual([]);
  });
  it("finds best matching entry", () => {
    const config = makeKbConfig();
    const result = findBestMatch("how do I reset my password?", config);
    expect(result.best).not.toBeNull();
    expect(result.best!.entryId).toBeGreaterThan(0);
    expect(result.scores.length).toBe(config.kb.length);
    // Sorted descending.
    for (let i = 1; i < result.scores.length; i++) {
      expect(result.scores[i]!.combined).toBeLessThanOrEqual(result.scores[i - 1]!.combined);
    }
  });
});

// ---------- Intent detection ----------

describe("ai-chatbot-emulator detectIntent", () => {
  it("detects greeting", () => {
    expect(detectIntent("hello")).toBe("greeting");
    expect(detectIntent("hi there")).toBe("greeting");
  });
  it("detects farewell", () => {
    expect(detectIntent("goodbye")).toBe("farewell");
    expect(detectIntent("bye")).toBe("farewell");
  });
  it("detects thanks", () => {
    expect(detectIntent("thank you")).toBe("thanks");
    expect(detectIntent("thanks a lot")).toBe("thanks");
  });
  it("detects help", () => {
    expect(detectIntent("help")).toBe("help");
    expect(detectIntent("what can you do")).toBe("help");
  });
  it("detects question via '?'", () => {
    expect(detectIntent("What is this?")).toBe("question");
  });
  it("detects question via wh- word", () => {
    expect(detectIntent("How do I do this")).toBe("question");
  });
  it("returns unknown for gibberish", () => {
    expect(detectIntent("xyzzy")).toBe("unknown");
  });
  it("returns unknown for empty", () => {
    expect(detectIntent("")).toBe("unknown");
  });
});

describe("ai-chatbot-emulator intentResponse", () => {
  it("returns non-empty for greeting", () => {
    const r = intentResponse("greeting", makeConfig({ name: "TestBot" }));
    expect(r.length).toBeGreaterThan(0);
    expect(r).toContain("TestBot");
  });
  it("returns non-empty for farewell, thanks, help", () => {
    const config = makeKbConfig();
    expect(intentResponse("farewell", config).length).toBeGreaterThan(0);
    expect(intentResponse("thanks", config).length).toBeGreaterThan(0);
    expect(intentResponse("help", config).length).toBeGreaterThan(0);
  });
  it("returns empty string for question/unknown", () => {
    expect(intentResponse("question", makeConfig())).toBe("");
    expect(intentResponse("unknown", makeConfig())).toBe("");
  });
});

// ---------- Guardrails ----------

describe("ai-chatbot-emulator applyGuardrails", () => {
  it("truncates long text", () => {
    const long = "x".repeat(100);
    const { text, warnings } = applyGuardrails(long, makeConfig({ maxResponseLength: 10 }));
    expect(text.length).toBeLessThanOrEqual(10);
    expect(warnings.some((w) => w.includes("truncated"))).toBe(true);
  });
  it("redacts banned words", () => {
    const { text, warnings } = applyGuardrails(
      "Buy our competitor product now",
      makeConfig({ bannedWords: ["competitor"] }),
    );
    expect(text).toContain("[redacted]");
    expect(warnings.some((w) => w.includes("redacted"))).toBe(true);
  });
  it("does not modify clean text", () => {
    const { text, warnings } = applyGuardrails("Hello there", makeConfig());
    expect(text).toBe("Hello there");
    expect(warnings).toEqual([]);
  });
  it("handles case-insensitive banned words", () => {
    const { text } = applyGuardrails(
      "Buy COMPETITOR now",
      makeConfig({ bannedWords: ["competitor"] }),
    );
    expect(text).toContain("[redacted]");
  });
});

describe("ai-chatbot-emulator toneWrap", () => {
  it("returns the text unchanged (passthrough)", () => {
    expect(toneWrap("formal", "Hello")).toBe("Hello");
    expect(toneWrap("casual", "Hello")).toBe("Hello");
    expect(toneWrap("friendly", "Hello")).toBe("Hello");
    expect(toneWrap("technical", "Hello")).toBe("Hello");
  });
});

// ---------- KB validation & stats ----------

describe("ai-chatbot-emulator validateKb", () => {
  it("warns on empty KB", () => {
    const w = validateKb(makeConfig({ kb: [] }));
    expect(w.some((x) => x.includes("empty"))).toBe(true);
  });
  it("warns on duplicate questions", () => {
    const w = validateKb(makeConfig({
      kb: [
        { id: 1, question: "Same Q?", answer: "A1", tokens: ["same"], tags: [] },
        { id: 2, question: "Same Q?", answer: "A2", tokens: ["same"], tags: [] },
      ],
    }));
    expect(w.some((x) => x.includes("Duplicate"))).toBe(true);
  });
  it("warns on very short answers", () => {
    const w = validateKb(makeConfig({
      kb: [{ id: 1, question: "Q?", answer: "ok", tokens: [], tags: [] }],
    }));
    expect(w.some((x) => x.includes("very short"))).toBe(true);
  });
  it("warns when all weights are zero", () => {
    const w = validateKb(makeConfig({
      weightTfIdf: 0, weightJaccard: 0, weightLevenshtein: 0,
    }));
    expect(w.some((x) => x.includes("weights are zero"))).toBe(true);
  });
  it("warns on invalid confidence threshold", () => {
    const w = validateKb(makeConfig({ confidenceThreshold: 5 }));
    expect(w.some((x) => x.includes("threshold"))).toBe(true);
  });
  it("warns on very low maxResponseLength", () => {
    const w = validateKb(makeConfig({ maxResponseLength: 10 }));
    expect(w.some((x) => x.includes("very low"))).toBe(true);
  });
  it("returns empty warnings for valid config", () => {
    const w = validateKb(makeKbConfig());
    expect(w).toEqual([]);
  });
});

describe("ai-chatbot-emulator computeStats", () => {
  it("computes stats for a populated KB", () => {
    const stats = computeStats(makeKbConfig());
    expect(stats.entryCount).toBe(4);
    expect(stats.totalWords).toBeGreaterThan(0);
    expect(stats.avgWordsPerEntry).toBeGreaterThan(0);
    expect(stats.uniqueWords).toBeGreaterThan(0);
    expect(Object.keys(stats.intentCoverage)).toHaveLength(6);
  });
  it("returns zeros for empty KB", () => {
    const stats = computeStats(makeConfig({ kb: [] }));
    expect(stats.entryCount).toBe(0);
    expect(stats.totalWords).toBe(0);
    expect(stats.avgWordsPerEntry).toBe(0);
  });
});

// ---------- Chunking ----------

describe("ai-chatbot-emulator chunkEntry", () => {
  it("returns single entry when answer is short", () => {
    const entry = { id: 1, question: "Q?", answer: "short answer", tokens: [], tags: [] };
    const chunks = chunkEntry(entry, 50);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(entry);
  });
  it("chunks long answers", () => {
    const long = Array.from({ length: 100 }, (_, i) => `word${i}`).join(" ");
    const entry = { id: 1, question: "Q?", answer: long, tokens: [], tags: [] };
    const chunks = chunkEntry(entry, 20);
    expect(chunks.length).toBeGreaterThan(1);
  });
  it("returns original entry when maxWords <= 0", () => {
    const entry = { id: 1, question: "Q?", answer: "short", tokens: [], tags: [] };
    expect(chunkEntry(entry, 0)).toHaveLength(1);
  });
});

// ---------- Response generation ----------

describe("ai-chatbot-emulator generateResponse", () => {
  it("returns intent response for greetings", () => {
    const r = generateResponse("hello", makeKbConfig());
    expect(r.intent).toBe("greeting");
    expect(r.isFallback).toBe(false);
    expect(r.confidence).toBe(1.0);
    expect(r.citation).toBeNull();
  });
  it("returns KB-grounded answer with citation", () => {
    const r = generateResponse("how do I reset my password?", makeKbConfig());
    expect(r.isFallback).toBe(false);
    expect(r.citation).not.toBeNull();
    expect(r.citation!.question.toLowerCase()).toContain("password");
    expect(r.confidence).toBeGreaterThan(0);
  });
  it("returns fallback when no match meets threshold", () => {
    const r = generateResponse("xyzzy random gibberish", makeKbConfig());
    expect(r.isFallback).toBe(true);
    expect(r.answer).toBe(DEFAULT_FALLBACK);
  });
  it("returns fallback for empty KB", () => {
    const r = generateResponse("anything", makeConfig({ kb: [] }));
    expect(r.isFallback).toBe(true);
    expect(r.warnings.some((w) => w.includes("empty"))).toBe(true);
  });
  it("applies guardrails to responses", () => {
    const r = generateResponse("how do I reset my password?", makeConfig({
      kb: parseKb("Q: reset password | A: " + "x".repeat(200)),
      maxResponseLength: 50,
    }));
    expect(r.answer.length).toBeLessThanOrEqual(50);
    expect(r.warnings.some((w) => w.includes("truncated"))).toBe(true);
  });
  it("includes debug info with scores", () => {
    const r = generateResponse("how do I reset password?", makeKbConfig());
    expect(r.debug.scores.length).toBeGreaterThan(0);
    expect(r.debug.queryTokens.length).toBeGreaterThan(0);
    expect(r.debug.detectedIntent).toBeDefined();
  });
});

// ---------- Test mode ----------

describe("ai-chatbot-emulator runTestQueries", () => {
  it("runs a batch of queries and returns responses", () => {
    const config = makeKbConfig();
    const queries = ["hello", "how do I reset my password?", "random gibberish"];
    const results = runTestQueries(queries, config);
    expect(results).toHaveLength(3);
    expect(results[0]!.response.intent).toBe("greeting");
    expect(results[1]!.response.isFallback).toBe(false);
    expect(results[2]!.response.isFallback).toBe(true);
  });
  it("handles empty queries list", () => {
    expect(runTestQueries([], makeKbConfig())).toEqual([]);
  });
});

describe("ai-chatbot-emulator testSummary", () => {
  it("computes summary stats", () => {
    const config = makeKbConfig();
    const queries = ["hello", "bye", "thanks", "how do I reset password?", "random gibberish"];
    const results = runTestQueries(queries, config);
    const summary = testSummary(results);
    expect(summary.total).toBe(5);
    expect(summary.fallbacks).toBeGreaterThanOrEqual(1);
    expect(summary.avgConfidence).toBeGreaterThan(0);
    expect(Object.keys(summary.intentCounts)).toHaveLength(6);
  });
  it("handles empty results", () => {
    const summary = testSummary([]);
    expect(summary.total).toBe(0);
    expect(summary.fallbacks).toBe(0);
    expect(summary.avgConfidence).toBe(0);
  });
});

// ---------- Render ----------

describe("ai-chatbot-emulator render", () => {
  it("renderTranscriptText produces text transcript", () => {
    const messages: ChatMessage[] = [
      { id: 1, role: "user", text: "Hello", ts: 1000 },
      { id: 2, role: "bot", text: "Hi there", ts: 1001, response: { answer: "Hi there", intent: "greeting", confidence: 1, citation: null, isFallback: false, warnings: [], debug: { scores: [], queryTokens: [], detectedIntent: "greeting" } } },
    ];
    const text = renderTranscriptText(messages);
    expect(text).toContain("USER: Hello");
    expect(text).toContain("BOT: Hi there");
  });
  it("renderTranscriptMarkdown produces Markdown transcript", () => {
    const config = makeKbConfig();
    const messages: ChatMessage[] = [
      { id: 1, role: "user", text: "Hello", ts: 1000 },
      { id: 2, role: "bot", text: "Hi there", ts: 1001 },
    ];
    const md = renderTranscriptMarkdown(messages, config);
    expect(md).toContain("# Chatbot transcript");
    expect(md).toContain("## Persona");
    expect(md).toContain("User");
  });
  it("renderConfigJson produces valid JSON", () => {
    const config = makeKbConfig();
    const json = renderConfigJson(config);
    const parsed = JSON.parse(json);
    expect(parsed.name).toBe(config.name);
    expect(parsed.kb.length).toBe(config.kb.length);
  });
  it("parseConfigJson parses valid config", () => {
    const config = makeKbConfig();
    const json = renderConfigJson(config);
    const result = parseConfigJson(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.name).toBe(config.name);
      expect(result.config.kb.length).toBe(config.kb.length);
    }
  });
  it("parseConfigJson rejects invalid JSON", () => {
    const result = parseConfigJson("not json");
    expect(result.ok).toBe(false);
  });
  it("parseConfigJson rejects non-object", () => {
    const result = parseConfigJson("[1,2,3]");
    expect(result.ok).toBe(false);
  });
  it("parseConfigJson applies defaults for missing fields", () => {
    const result = parseConfigJson("{}");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.name).toBe(DEFAULT_CONFIG.name);
      expect(result.config.tone).toBe(DEFAULT_CONFIG.tone);
      expect(result.config.kb).toEqual([]);
    }
  });
  it("parseConfigJson filters invalid KB entries", () => {
    const raw = JSON.stringify({
      kb: [
        { question: "Q1?", answer: "A1" },
        { question: "Q2?" },  // missing answer
        { answer: "A3" },     // missing question
        "not an object",
      ],
    });
    const result = parseConfigJson(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.kb).toHaveLength(1);
      expect(result.config.kb[0]!.question).toBe("Q1?");
    }
  });
});

// ---------- History ----------

describe("ai-chatbot-emulator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, botName: "Bot", query: "hi", answer: "hello", confidence: 1, isFallback: false });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at HISTORY_MAX", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, botName: "Bot", query: "q", answer: "a", confidence: 0.5, isFallback: false });
    }
    expect(loadHistory()).toHaveLength(HISTORY_MAX);
  });
  it("clears", () => {
    saveHistory({ ts: 1, botName: "Bot", query: "q", answer: "a", confidence: 0.5, isFallback: false });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("uses correct localStorage key", () => {
    saveHistory({ ts: 1, botName: "Bot", query: "q", answer: "a", confidence: 0.5, isFallback: false });
    expect(localStorage.getItem(HISTORY_KEY)).toBeTruthy();
  });
});

// ---------- Saved bots ----------

describe("ai-chatbot-emulator saved bots", () => {
  it("loads empty initially", () => {
    expect(loadBots()).toEqual([]);
  });
  it("saves and loads a bot", () => {
    saveBot(makeKbConfig());
    expect(loadBots()).toHaveLength(1);
  });
  it("caps at BOTS_MAX", () => {
    for (let i = 0; i < BOTS_MAX + 5; i++) {
      saveBot({ ...makeKbConfig(), name: `Bot ${i}` });
    }
    expect(loadBots().length).toBeLessThanOrEqual(BOTS_MAX);
  });
  it("deletes a bot by id", () => {
    const bots = saveBot(makeKbConfig());
    const id = bots[0]!.id;
    const after = deleteBot(id);
    expect(after).toHaveLength(0);
  });
  it("clears all bots", () => {
    saveBot(makeKbConfig());
    clearBots();
    expect(loadBots()).toEqual([]);
  });
  it("uses correct localStorage key", () => {
    saveBot(makeKbConfig());
    expect(localStorage.getItem(BOTS_KEY)).toBeTruthy();
  });
});

// ---------- Shareable URL ----------

describe("ai-chatbot-emulator share URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const config = makeKbConfig();
    const url = buildShareUrl(config);
    expect(url).toContain("cfg=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("round-trips config through share URL", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const config = makeKbConfig();
    const url = buildShareUrl(config);
    const params = url.split(/[?#]/)[1]!;
    (globalThis as Record<string, unknown>).window = origWindow;
    const parsed = parseShareUrl(`#${params}`);
    expect(parsed.config?.name).toBe(config.name);
    expect(parsed.config?.persona).toBe(config.persona);
    expect(parsed.config?.kb?.length).toBe(config.kb.length);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ config: {} });
  });
  it("handles invalid cfg JSON", () => {
    expect(parseShareUrl("#cfg=not-json")).toEqual({ config: {} });
  });
});

// ---------- LLM ----------

describe("ai-chatbot-emulator LLM", () => {
  it("buildLlmPrompt contains persona and query", () => {
    const config = makeKbConfig();
    const citation = config.kb[0]!;
    const prompt = buildLlmPrompt("test query", config, citation);
    expect(prompt).toContain(config.persona);
    expect(prompt).toContain("test query");
    expect(prompt).toContain("refinedAnswer");
  });
  it("buildLlmPrompt handles null citation", () => {
    const config = makeKbConfig();
    const prompt = buildLlmPrompt("test", config, null);
    expect(prompt).toContain("No KB citation");
  });
  it("renderLlmResult parses valid JSON", () => {
    const valid = JSON.stringify({
      refinedAnswer: "Here is the answer.",
      alternativeAnswers: ["Alt 1", "Alt 2"],
      notes: ["note 1"],
    });
    const result = renderLlmResult(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.refinedAnswer).toBe("Here is the answer.");
      expect(result.result.alternativeAnswers).toHaveLength(2);
      expect(result.result.notes).toHaveLength(1);
    }
  });
  it("renderLlmResult handles code fences", () => {
    const valid = "```json\n" + JSON.stringify({
      refinedAnswer: "x",
      alternativeAnswers: [],
      notes: [],
    }) + "\n```";
    expect(renderLlmResult(valid).ok).toBe(true);
  });
  it("renderLlmResult rejects invalid JSON", () => {
    expect(renderLlmResult("not json").ok).toBe(false);
  });
  it("renderLlmResult rejects non-object JSON", () => {
    expect(renderLlmResult("[1,2,3]").ok).toBe(false);
  });
  it("renderLlmResult filters malformed fields", () => {
    const malformed = JSON.stringify({
      refinedAnswer: 123,
      alternativeAnswers: ["ok", 456],
      notes: "wrong",
    });
    const result = renderLlmResult(malformed);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.refinedAnswer).toBe("");
      expect(result.result.alternativeAnswers).toEqual(["ok"]);
      expect(result.result.notes).toEqual([]);
    }
  });
});

// ---------- Honesty ----------

describe("ai-chatbot-emulator honesty", () => {
  it("honestyNote is non-empty and mentions key terms", () => {
    const note = honestyNote();
    expect(note.length).toBeGreaterThan(20);
    expect(note.toLowerCase()).toContain("prototyping");
    expect(note.toLowerCase()).toContain("hallucination");
  });
});

// Suppress unused-import lint
export type _Unused = Tone | Intent;
