import { describe, it, expect, beforeEach } from "vitest";
import {
  PHRASE_CATALOG,
  HISTORY_KEY,
  HISTORY_MAX,
  TONE_LABELS,
  SEVERITY_LABELS,
  SEVERITY_WEIGHTS,
  CATEGORY_LABELS,
  ESCALATION_LABELS,
  DEFAULT_TONE,
  SAMPLE_EMAILS,
  buildPhraseRegex,
  genId,
  normalizeText,
  escapeHtml,
  countWords,
  preserveCase,
  findHits,
  computeScore,
  computeEscalationLevel,
  computeConfidence,
  computeStats,
  decodeEmail,
  buildSummary,
  defuseEmail,
  applyReplacements,
  renderHighlightedHtml,
  renderDefuseDiffHtml,
  buildDiff,
  tokenizeWords,
  renderHitsCsv,
  buildLlmPrompt,
  renderLlmResult,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Tone,
  type Mode,
  type Severity,
  type EscalationLevel,
  type PhraseCategory,
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

describe("ai-passive-aggressive-email-translator constants", () => {
  it("has 50+ phrase catalog entries", () => {
    expect(PHRASE_CATALOG.length).toBeGreaterThanOrEqual(50);
  });
  it("every entry has a unique pattern (lowercase)", () => {
    const patterns = PHRASE_CATALOG.map((e) => e.pattern);
    expect(new Set(patterns).size).toBe(patterns.length);
    expect(patterns.every((p) => p === p.toLowerCase())).toBe(true);
  });
  it("every entry has all 4 tones in defuse map", () => {
    for (const e of PHRASE_CATALOG) {
      expect(e.defuse.calm).toBeTruthy();
      expect(e.defuse.professional).toBeTruthy();
      expect(e.defuse.warm).toBeTruthy();
      expect(e.defuse.direct).toBeTruthy();
    }
  });
  it("has 4 tone labels", () => {
    expect(Object.keys(TONE_LABELS)).toHaveLength(4);
  });
  it("has 3 severity labels + weights", () => {
    expect(Object.keys(SEVERITY_LABELS)).toHaveLength(3);
    expect(SEVERITY_WEIGHTS.low).toBe(1);
    expect(SEVERITY_WEIGHTS.medium).toBe(2);
    expect(SEVERITY_WEIGHTS.high).toBe(3);
  });
  it("has 6 category labels", () => {
    expect(Object.keys(CATEGORY_LABELS)).toHaveLength(6);
  });
  it("has 5 escalation labels", () => {
    expect(Object.keys(ESCALATION_LABELS)).toHaveLength(5);
  });
  it("has sample emails for both modes", () => {
    expect(SAMPLE_EMAILS.length).toBeGreaterThanOrEqual(2);
    expect(SAMPLE_EMAILS.some((s) => s.mode === "decode")).toBe(true);
    expect(SAMPLE_EMAILS.some((s) => s.mode === "defuse")).toBe(true);
  });
  it("default tone is professional", () => {
    expect(DEFAULT_TONE).toBe("professional");
  });
});

// ---------- Helpers ----------

describe("ai-passive-aggressive-email-translator helpers", () => {
  it("buildPhraseRegex matches case-insensitively at word boundaries", () => {
    const re = buildPhraseRegex("per my last email");
    const m = re.exec("Per my last email, this is done.");
    expect(m).not.toBeNull();
    expect(m?.[2].toLowerCase()).toBe("per my last email");
  });
  it("buildPhraseRegex does not match inside other words", () => {
    const re = buildPhraseRegex("kindly");
    expect(re.exec("unkindlyresponse")).toBeNull();
  });
  it("genId returns unique ids", () => {
    const a = genId();
    const b = genId();
    expect(a).not.toBe(b);
  });
  it("normalizeText collapses whitespace and trims", () => {
    expect(normalizeText("  hello   world  ")).toBe("hello world");
    expect(normalizeText("a\r\n\r\nb")).toBe("a\n\nb");
  });
  it("escapeHtml escapes dangerous chars", () => {
    expect(escapeHtml('<script>"x"&\'y\'')).toBe(
      "&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;",
    );
  });
  it("countWords counts whitespace-separated tokens", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("hello world")).toBe(2);
    expect(countWords("  one two three  ")).toBe(3);
  });
  it("preserveCase keeps all-caps and title case", () => {
    expect(preserveCase("HELLO", "hi")).toBe("HI");
    expect(preserveCase("Hello", "hi")).toBe("Hi");
    expect(preserveCase("hello", "hi")).toBe("hi");
  });
});

// ---------- Detection ----------

describe("ai-passive-aggressive-email-translator findHits", () => {
  it("returns empty for empty input", () => {
    expect(findHits("")).toEqual([]);
  });
  it("detects a single classic phrase", () => {
    const hits = findHits("Per my last email, this is done.");
    expect(hits).toHaveLength(1);
    expect(hits[0].entry.pattern).toBe("per my last email");
    expect(hits[0].original).toBe("Per my last email");
    expect(hits[0].entry.severity).toBe("high");
  });
  it("detects multiple non-overlapping phrases", () => {
    const hits = findHits(
      "Per my last email, please advise. Going forward, please ensure this is fixed.",
    );
    expect(hits.length).toBeGreaterThanOrEqual(3);
  });
  it("prefers the longest match when patterns overlap", () => {
    // "as per my previous email" contains "as per" — longest should win.
    const hits = findHits("As per my previous email, this is done.");
    expect(hits).toHaveLength(1);
    expect(hits[0].entry.pattern).toBe("as per my previous email");
  });
  it("respects case-insensitivity", () => {
    const hits = findHits("KINDLY do the needful.");
    expect(hits).toHaveLength(2);
    expect(hits[0].original).toBe("KINDLY");
    expect(hits[1].original).toBe("do the needful");
  });
  it("uses tone to select the replacement", () => {
    const hitsWarm = findHits("Just checking in.", "warm");
    const hitsDirect = findHits("Just checking in.", "direct");
    expect(hitsWarm[0].replacement).toBe(hitsWarm[0].entry.defuse.warm);
    expect(hitsDirect[0].replacement).toBe(hitsDirect[0].entry.defuse.direct);
  });
});

// ---------- Scoring ----------

describe("ai-passive-aggressive-email-translator scoring", () => {
  it("returns 0 for no hits", () => {
    expect(computeScore([], 10)).toBe(0);
  });
  it("scores a single low-severity hit low", () => {
    const hits = findHits("Just checking in on this.");
    const score = computeScore(hits, countWords("Just checking in on this."));
    expect(score).toBeGreaterThanOrEqual(5);
    expect(score).toBeLessThan(40);
  });
  it("scales up with multiple high-severity hits", () => {
    const text =
      "Per my last email, as I mentioned previously, in case you missed it, do the needful.";
    const hits = findHits(text);
    const score = computeScore(hits, countWords(text));
    expect(score).toBeGreaterThan(50);
  });
  it("clamps to 100", () => {
    // Extremely aggressive short email
    const text = "Per my last email. Do the needful. In case you missed it. As I mentioned previously. Be advised.";
    const hits = findHits(text);
    const score = computeScore(hits, countWords(text));
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(80);
  });
  it("maps scores to escalation levels", () => {
    expect(computeEscalationLevel(0)).toBe("mild");
    expect(computeEscalationLevel(14)).toBe("mild");
    expect(computeEscalationLevel(20)).toBe("annoyed");
    expect(computeEscalationLevel(40)).toBe("passive-aggressive");
    expect(computeEscalationLevel(60)).toBe("hostile");
    expect(computeEscalationLevel(85)).toBe("hr-incident");
  });
  it("computes confidence levels", () => {
    expect(computeConfidence([], 0)).toBe("low");
    expect(computeConfidence(findHits("Just checking in."), 10)).toBe("low");
    expect(computeConfidence(findHits("Just checking in. Kindly respond."), 20)).toBe("medium");
    // 3+ hits OR score >= 35
    const hits = findHits("Per my last email. Do the needful. Be advised.");
    expect(computeConfidence(hits, 60)).toBe("high");
  });
  it("computes stats by category and severity", () => {
    const text = "Per my last email, kindly do the needful. Just checking in.";
    const hits = findHits(text);
    const stats = computeStats(hits, countWords(text));
    expect(stats.phraseCount).toBeGreaterThanOrEqual(3);
    expect(stats.byCategory["point-scoring"]).toBeGreaterThanOrEqual(1);
    expect(stats.byCategory["fake-polite"]).toBeGreaterThanOrEqual(1);
    expect(stats.byCategory["hostile-directive"]).toBeGreaterThanOrEqual(1);
    expect(stats.bySeverity.high).toBeGreaterThanOrEqual(1);
    expect(stats.totalEscalation).toBeGreaterThan(0);
    expect(stats.wordCount).toBe(countWords(text));
  });
});

// ---------- Decode ----------

describe("ai-passive-aggressive-email-translator decodeEmail", () => {
  it("returns a complete DecodeResult", () => {
    const result = decodeEmail("Per my last email, please advise.");
    expect(result.original).toBe("Per my last email, please advise.");
    expect(result.hits.length).toBeGreaterThanOrEqual(2);
    expect(result.score).toBeGreaterThan(0);
    expect(result.stats.phraseCount).toBe(result.hits.length);
    expect(result.summary).toBeTruthy();
    expect(result.escalationLevel).toBeTruthy();
  });
  it("handles a clean email gracefully", () => {
    const result = decodeEmail("Hi team, the meeting is at 3pm in room 4. Thanks!");
    expect(result.hits).toHaveLength(0);
    expect(result.score).toBe(0);
    expect(result.escalationLevel).toBe("mild");
    expect(result.confidence).toBe("low");
    expect(result.summary).toContain("neutral");
  });
  it("summary includes the escalation label and top phrases", () => {
    const result = decodeEmail("Per my last email. Do the needful.");
    // Two high-severity hits in a short email → hostile or hr-incident territory.
    expect(
      result.summary.includes("hostile") ||
      result.summary.includes("HR incident"),
    ).toBe(true);
    expect(result.summary.toLowerCase()).toContain("per my last email");
  });
  it("buildSummary gives neutral message when no hits", () => {
    const s = buildSummary([], "mild", "low");
    expect(s).toContain("neutral");
  });
});

// ---------- Defuse ----------

describe("ai-passive-aggressive-email-translator defuseEmail", () => {
  it("rewrites flagged phrases into the chosen tone", () => {
    const result = defuseEmail("Per my last email, please advise.", "calm");
    expect(result.tone).toBe("calm");
    expect(result.beforeScore).toBeGreaterThan(result.afterScore);
    expect(result.rewritten).not.toContain("Per my last email");
    expect(result.rewritten).not.toContain("please advise");
    expect(result.hitsFixed).toBeGreaterThanOrEqual(2);
  });
  it("preserves text that has no flagged phrases", () => {
    const original = "Hi team, the meeting is at 3pm. Thanks!";
    const result = defuseEmail(original, "professional");
    expect(result.rewritten).toBe(original);
    expect(result.hitsFixed).toBe(0);
    expect(result.beforeScore).toBe(0);
    expect(result.afterScore).toBe(0);
  });
  it("applyReplacements splices from end backward", () => {
    const hits = findHits("Per my last email. Do the needful.", "direct");
    const out = applyReplacements("Per my last email. Do the needful.", hits);
    expect(out).not.toContain("Per my last email");
    expect(out).not.toContain("do the needful");
  });
});

// ---------- Rendering ----------

describe("ai-passive-aggressive-email-translator rendering", () => {
  it("renderHighlightedHtml wraps hits in <mark> with severity class", () => {
    const result = decodeEmail("Per my last email, please advise.");
    const html = renderHighlightedHtml(result);
    expect(html).toContain("<mark");
    expect(html).toContain("pa-hit");
    expect(html).toContain("pa-high");
    expect(html).toContain("title=");
  });
  it("renderHighlightedHtml escapes HTML in original", () => {
    const result = decodeEmail("Per my last email <script>.");
    const html = renderHighlightedHtml(result);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
  it("renderDefuseDiffHtml emits <del>/<ins>", () => {
    const html = renderDefuseDiffHtml(
      "Per my last email.",
      "Following up on my earlier email.",
    );
    expect(html).toContain("<del");
    expect(html).toContain("<ins");
  });
  it("buildDiff emits same/added/removed segments", () => {
    const segs = buildDiff("hello world", "hello there world");
    const types = segs.map((s) => s.type);
    expect(types).toContain("same");
    expect(types).toContain("added");
  });
  it("tokenizeWords preserves whitespace runs", () => {
    const toks = tokenizeWords("a  b\nc");
    expect(toks).toContain("a");
    expect(toks).toContain("  ");
    expect(toks).toContain("b");
    expect(toks).toContain("\n");
    expect(toks).toContain("c");
  });
  it("renderHitsCsv emits a header + rows", () => {
    const hits = findHits("Per my last email. Do the needful.");
    const csv = renderHitsCsv(hits);
    expect(csv).toContain("id,phrase,category,severity,escalation,gloss,why");
    expect(csv.split("\n").length).toBe(hits.length + 1);
  });
});

// ---------- LLM prompt ----------

describe("ai-passive-aggressive-email-translator LLM prompt", () => {
  it("decode prompt asks for plain-English meaning", () => {
    const p = buildLlmPrompt("Per my last email.", "decode", "professional");
    expect(p).toContain("plain English");
    expect(p).toContain("Per my last email.");
  });
  it("defuse prompt mentions the chosen tone", () => {
    const p = buildLlmPrompt("Per my last email.", "defuse", "warm");
    expect(p).toContain("warm");
    expect(p).toContain("Rewrite");
  });
  it("renderLlmResult trims whitespace", () => {
    expect(renderLlmResult("  hello  ")).toBe("hello");
  });
});

// ---------- History ----------

describe("ai-passive-aggressive-email-translator history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      mode: "decode",
      tone: "professional",
      textLength: 100,
      score: 50,
      phraseCount: 3,
      escalationLevel: "passive-aggressive",
    });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].mode).toBe("decode");
    expect(h[0].score).toBe(50);
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        mode: "decode",
        tone: "professional",
        textLength: 10,
        score: 10,
        phraseCount: 1,
        escalationLevel: "mild",
      });
    }
    expect(loadHistory()).toHaveLength(HISTORY_MAX);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, mode: "decode", tone: "professional",
      textLength: 1, score: 1, phraseCount: 1, escalationLevel: "mild",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("uses a namespaced localStorage key", () => {
    expect(HISTORY_KEY).toContain("ai-passive-aggressive-email-translator");
  });
});

// ---------- Shareable URL ----------

describe("ai-passive-aggressive-email-translator shareable URL", () => {
  it("builds a share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("Per my last email", "decode", "professional");
    expect(url).toContain("text=");
    expect(url).toContain("mode=decode");
    expect(url).toContain("tone=professional");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses a share URL back", () => {
    const s = parseShareUrl("text=Per%20my%20last%20email&mode=defuse&tone=warm");
    expect(s.text).toBe("Per my last email");
    expect(s.mode).toBe("defuse");
    expect(s.tone).toBe("warm");
  });
  it("handles empty hash", () => {
    const s = parseShareUrl("");
    expect(s.text).toBe("");
    expect(s.mode).toBe("decode");
    expect(s.tone).toBe(DEFAULT_TONE);
  });
  it("falls back to defaults for invalid mode/tone", () => {
    const s = parseShareUrl("text=hi&mode=bogus&tone=bogus");
    expect(s.mode).toBe("decode");
    expect(s.tone).toBe(DEFAULT_TONE);
  });
});

// Suppress unused-import lint
export type _Unused =
  | Tone
  | Mode
  | Severity
  | EscalationLevel
  | PhraseCategory;
