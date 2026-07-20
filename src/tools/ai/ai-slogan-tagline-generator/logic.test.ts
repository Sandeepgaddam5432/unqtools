import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  FAV_KEY,
  HISTORY_MAX,
  FAV_MAX,
  LLM_KEY_STORAGE,
  POWER_WORDS,
  CLICHES,
  STYLES,
  STYLE_LABELS,
  TONES,
  TONE_LABELS,
  TONE_POWER_WORDS,
  SLOGAN_FORMULAS,
  normalize,
  tokenize,
  countWords,
  countSyllables,
  totalSyllables,
  detectAlliteration,
  detectRhyme,
  detectPhraseRhyme,
  isCliche,
  mulberry32,
  parseKeywords,
  scoreLength,
  scoreMemorability,
  scoreImpact,
  scoreOverall,
  fillFormula,
  capitaliseFirst,
  generateSlogans,
  generateAbPairs,
  filterByLength,
  sortByScore,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  loadFavorites,
  toggleFavorite,
  clearFavorites,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Tone,
  type SloganStyle,
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

describe("ai-slogan constants", () => {
  it("has 100+ power words", () => {
    expect(POWER_WORDS.length).toBeGreaterThanOrEqual(100);
    expect(POWER_WORDS).toContain("unleash");
    expect(POWER_WORDS).toContain("effortless");
  });
  it("has 30+ clichés", () => {
    expect(CLICHES.length).toBeGreaterThanOrEqual(30);
    expect(CLICHES).toContain("just do it");
    expect(CLICHES).toContain("think different");
  });
  it("has 6 styles with labels and formulas", () => {
    expect(STYLES).toHaveLength(6);
    expect(Object.keys(STYLE_LABELS)).toHaveLength(6);
    expect(Object.keys(SLOGAN_FORMULAS)).toHaveLength(6);
    for (const s of STYLES) {
      expect(SLOGAN_FORMULAS[s].length).toBeGreaterThanOrEqual(3);
    }
  });
  it("has 5 tones with labels and power words", () => {
    expect(TONES).toHaveLength(5);
    expect(Object.keys(TONE_LABELS)).toHaveLength(5);
    expect(Object.keys(TONE_POWER_WORDS)).toHaveLength(5);
  });
  it("exposes history + favorite storage keys", () => {
    expect(HISTORY_KEY).toContain("ai-slogan-tagline-generator");
    expect(FAV_KEY).toContain("ai-slogan-tagline-generator");
    expect(HISTORY_MAX).toBe(20);
    expect(FAV_MAX).toBe(50);
  });
  it("exposes LLM key storage id", () => {
    expect(LLM_KEY_STORAGE).toContain("ai-slogan-tagline-generator");
  });
});

// ---------- Helpers ----------

describe("ai-slogan normalize / tokenize", () => {
  it("normalizes whitespace", () => {
    expect(normalize("  Acme   Inc  ")).toBe("Acme Inc");
  });
  it("tokenizes lowercased words", () => {
    expect(tokenize("Acme, Inc.!")).toEqual(["acme", "inc"]);
  });
  it("counts words", () => {
    expect(countWords("just do it now")).toBe(4);
  });
  it("counts empty as 0 words", () => {
    expect(countWords("")).toBe(0);
  });
});

describe("ai-slogan syllables", () => {
  it("counts short words as 1", () => {
    expect(countSyllables("cat")).toBe(1);
    expect(countSyllables("it")).toBe(1);
  });
  it("counts longer words with multiple syllables", () => {
    expect(countSyllables("hello")).toBe(2);
    expect(countSyllables("banana")).toBeGreaterThanOrEqual(2);
  });
  it("totals across a phrase", () => {
    expect(totalSyllables("just do it")).toBe(3);
  });
});

describe("ai-slogan alliteration", () => {
  it("detects adjacent same-start-letter", () => {
    expect(detectAlliteration("big bold beauty")).toBe(true);
  });
  it("rejects non-alliterative phrases", () => {
    expect(detectAlliteration("the quick brown fox")).toBe(false);
  });
});

describe("ai-slogan rhyme", () => {
  it("detects rhyme between two words", () => {
    expect(detectRhyme("best", "rest")).toBe(true);
    expect(detectRhyme("cat", "bat")).toBe(true);
  });
  it("rejects non-rhymes", () => {
    expect(detectRhyme("hello", "world")).toBe(false);
  });
  it("detects rhyme within a phrase", () => {
    expect(detectPhraseRhyme("from first to best we beat the rest")).toBe(true);
  });
  it("rejects phrase with no rhyme", () => {
    expect(detectPhraseRhyme("the quick brown fox jumps")).toBe(false);
  });
});

describe("ai-slogan cliché filter", () => {
  it("flags known clichés", () => {
    expect(isCliche("Just Do It.")).toBe(true);
    expect(isCliche("Think Different.")).toBe(true);
  });
  it("lets original slogans through", () => {
    expect(isCliche("Acme: effortless magic, every time.")).toBe(false);
  });
  it("respects a custom list", () => {
    expect(isCliche("our thing", ["our thing"])).toBe(true);
  });
});

describe("ai-slogan mulberry32 + parseKeywords", () => {
  it("mulberry32 is deterministic", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect(a()).toBe(b());
  });
  it("parses keywords comma or newline separated", () => {
    expect(parseKeywords("one, two\nthree;four")).toEqual(["one", "two", "three", "four"]);
  });
  it("returns empty for empty input", () => {
    expect(parseKeywords("")).toEqual([]);
  });
});

// ---------- Scoring ----------

describe("ai-slogan scoreLength", () => {
  it("rewards 3–6 word slogans", () => {
    expect(scoreLength("just do it now")).toBe(100);   // 4
    expect(scoreLength("the quick brown fox jumps")).toBe(100); // 5
  });
  it("penalises extremes", () => {
    expect(scoreLength("hi")).toBeLessThan(100);
    expect(scoreLength("a b c d e f g h i j k")).toBeLessThan(60);
  });
  it("zero for empty", () => {
    expect(scoreLength("")).toBe(0);
  });
});

describe("ai-slogan scoreMemorability", () => {
  it("rewards alliteration", () => {
    const s = scoreMemorability("big bold beautiful bears");
    expect(s).toBeGreaterThan(50);
  });
  it("rewards rhyme", () => {
    const s = scoreMemorability("from first to best we beat the rest");
    expect(s).toBeGreaterThan(50);
  });
  it("penalises tongue twisters", () => {
    const s = scoreMemorability("antidisestablishmentarianism is extraordinarily problematic");
    expect(s).toBeLessThan(80);
  });
});

describe("ai-slogan scoreImpact", () => {
  it("rewards power-word density", () => {
    const s = scoreImpact("unleash effortless bold magic");
    expect(s).toBeGreaterThan(60);
  });
  it("penalises clichés when avoidCliches is set", () => {
    const withCliche = scoreImpact("Just do it", { avoidCliches: true });
    const without = scoreImpact("Just do it", { avoidCliches: false });
    expect(withCliche).toBeLessThan(without);
  });
  it("returns 0 for empty", () => {
    expect(scoreImpact("")).toBe(0);
  });
});

describe("ai-slogan scoreOverall", () => {
  it("combines sub-scores into a weighted overall", () => {
    const r = scoreOverall("unleash effortless bold magic");
    expect(r.overall).toBeGreaterThanOrEqual(0);
    expect(r.overall).toBeLessThanOrEqual(100);
    const expected = Math.round(r.length * 0.3 + r.memorability * 0.35 + r.impact * 0.35);
    expect(r.overall).toBe(expected);
  });
});

// ---------- Formula fillers ----------

describe("ai-slogan fillFormula / capitaliseFirst", () => {
  it("substitutes brand, kw, pw", () => {
    const out = fillFormula("${brand}: ${pw}, every time.", "Acme", "widgets", "bold");
    expect(out).toBe("Acme: bold, every time.");
  });
  it("capitalises first letter", () => {
    expect(capitaliseFirst("acme rocks")).toBe("Acme rocks");
    expect(capitaliseFirst("")).toBe("");
  });
});

// ---------- generateSlogans ----------

describe("ai-slogan generateSlogans", () => {
  it("returns slogans with the requested limit", () => {
    const out = generateSlogans("Acme", ["widgets"], { tone: "bold", limit: 5 }, 1);
    expect(out.length).toBeLessThanOrEqual(5);
    expect(out.length).toBeGreaterThan(0);
  });
  it("every slogan contains the brand or keyword when brandFit is on", () => {
    const out = generateSlogans("Acme", ["widgets"], { tone: "bold", brandFit: true, limit: 10 }, 2);
    expect(out.length).toBeGreaterThan(0);
    for (const s of out) {
      const t = s.text.toLowerCase();
      expect(t.includes("acme") || t.includes("widget")).toBe(true);
    }
  });
  it("respects maxWords", () => {
    const out = generateSlogans("Acme", ["widgets"], { tone: "bold", maxWords: 4, limit: 30 }, 3);
    // Every slogan's word count (minus brand) should be ≤ 4.
    for (const s of out) {
      const withoutBrand = s.text.toLowerCase().replace("acme", "").trim();
      expect(countWords(withoutBrand)).toBeLessThanOrEqual(4);
    }
  });
  it("filters clichés when avoidCliches is on", () => {
    const out = generateSlogans("Acme", ["just do it"], { tone: "bold", avoidCliches: true, limit: 30 }, 4);
    for (const s of out) {
      expect(isCliche(s.text)).toBe(false);
    }
  });
  it("respects the styles filter", () => {
    const out = generateSlogans("Acme", ["widgets"], { tone: "bold", styles: ["minimalist"], limit: 10 }, 5);
    for (const s of out) {
      expect(s.style).toBe("minimalist");
    }
  });
  it("sorts by overall score descending", () => {
    const out = generateSlogans("Acme", ["widgets"], { tone: "bold", limit: 20 }, 6);
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1].score.overall).toBeGreaterThanOrEqual(out[i].score.overall);
    }
  });
  it("each slogan has a valid score object", () => {
    const out = generateSlogans("Acme", ["widgets"], { tone: "bold", limit: 5 }, 7);
    for (const s of out) {
      expect(s.score.length).toBeGreaterThanOrEqual(0);
      expect(s.score.length).toBeLessThanOrEqual(100);
      expect(s.score.memorability).toBeGreaterThanOrEqual(0);
      expect(s.score.memorability).toBeLessThanOrEqual(100);
      expect(s.score.impact).toBeGreaterThanOrEqual(0);
      expect(s.score.impact).toBeLessThanOrEqual(100);
      expect(s.score.overall).toBeGreaterThanOrEqual(0);
      expect(s.score.overall).toBeLessThanOrEqual(100);
    }
  });
});

// ---------- A/B pairs ----------

describe("ai-slogan generateAbPairs", () => {
  it("produces the requested number of pairs", () => {
    const pairs = generateAbPairs("Acme", ["widgets"], { tone: "bold" }, 3, 10);
    expect(pairs).toHaveLength(3);
  });
  it("each pair has two different styles", () => {
    const pairs = generateAbPairs("Acme", ["widgets"], { tone: "bold" }, 5, 11);
    for (const p of pairs) {
      expect(p.a.style).not.toBe(p.b.style);
    }
  });
  it("returns empty for count 0", () => {
    const pairs = generateAbPairs("Acme", ["widgets"], { tone: "bold" }, 0, 12);
    expect(pairs).toHaveLength(0);
  });
});

// ---------- Filter / sort helpers ----------

describe("ai-slogan filterByLength / sortByScore", () => {
  it("filters by word count", () => {
    const slogans = generateSlogans("Acme", ["widgets"], { tone: "bold", limit: 20 }, 13);
    const filtered = filterByLength(slogans, 2, 5);
    for (const s of filtered) {
      const n = countWords(s.text);
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(5);
    }
  });
  it("sortByScore returns descending order", () => {
    const slogans = generateSlogans("Acme", ["widgets"], { tone: "bold", limit: 20 }, 14);
    const sorted = sortByScore(slogans);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i - 1].score.overall).toBeGreaterThanOrEqual(sorted[i].score.overall);
    }
  });
});

// ---------- Renderers ----------

describe("ai-slogan renderers", () => {
  it("renderText includes the score", () => {
    const out = generateSlogans("Acme", ["widgets"], { tone: "bold", limit: 3 }, 15);
    const text = renderText(out);
    expect(text).toContain("[");
    expect(text.split("\n").length).toBe(out.length);
  });
  it("renderCsv has a header row", () => {
    const csv = renderCsv([]);
    expect(csv).toContain("text,style,tone,length,memorability,impact,overall");
  });
  it("renderCsv escapes commas", () => {
    const csv = renderCsv([{ text: "Acme, Inc.", style: "minimalist", tone: "bold", score: { length: 100, memorability: 50, impact: 50, overall: 66 } }]);
    expect(csv).toContain('"Acme, Inc."');
  });
});

// ---------- History ----------

describe("ai-slogan history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, brand: "Acme", keywords: ["widgets"], tone: "bold", count: 10 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, brand: `B${i}`, keywords: [], tone: "bold", count: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, brand: "X", keywords: [], tone: "bold", count: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---------- Favorites ----------

describe("ai-slogan favorites (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadFavorites()).toEqual([]);
  });
  it("toggles a favorite on then off", () => {
    const after1 = toggleFavorite("Acme rocks");
    expect(after1).toContain("Acme rocks");
    const after2 = toggleFavorite("Acme rocks");
    expect(after2).not.toContain("Acme rocks");
  });
  it("caps at 50", () => {
    for (let i = 0; i < 60; i++) {
      toggleFavorite(`Slogan ${i}`);
    }
    expect(loadFavorites().length).toBeLessThanOrEqual(50);
  });
  it("clears", () => {
    toggleFavorite("Acme rocks");
    clearFavorites();
    expect(loadFavorites()).toEqual([]);
  });
});

// ---------- Shareable URL ----------

describe("ai-slogan shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ brand: "Acme", keywords: "widgets,fast", tone: "premium" });
    expect(url).toContain("brand=Acme");
    expect(url).toContain("kw=widgets");
    expect(url).toContain("tone=premium");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const s = parseShareUrl("brand=Acme&kw=widgets%2Cfast&tone=premium");
    expect(s.brand).toBe("Acme");
    expect(s.keywords).toBe("widgets,fast");
    expect(s.tone).toBe("premium");
  });
  it("defaults to bold tone", () => {
    const s = parseShareUrl("brand=Acme");
    expect(s.tone).toBe("bold");
  });
  it("rejects unknown tone", () => {
    const s = parseShareUrl("brand=Acme&tone=sarcastic");
    expect(s.tone).toBe("bold");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ brand: "", keywords: "", tone: "bold" });
  });
});

// ---------- BYO-key LLM ----------

describe("ai-slogan BYO-key LLM", () => {
  it("builds a prompt mentioning the brand", () => {
    const p = buildLlmPrompt("Acme", ["widgets"], "bold");
    expect(p).toContain("Acme");
    expect(p).toContain("widgets");
    expect(p).toContain("tone=bold");
  });
  it("renders LLM JSON result", () => {
    const raw = JSON.stringify({
      slogans: ["Acme rocks", "Acme rolls"],
      explanation: "playful and bold",
      warnings: ["none"],
    });
    const r = renderLlmResult(raw);
    expect(r.slogans).toEqual(["Acme rocks", "Acme rolls"]);
    expect(r.explanation).toBe("playful and bold");
    expect(r.warnings).toEqual(["none"]);
  });
  it("falls back gracefully on garbage", () => {
    const r = renderLlmResult("not json at all");
    expect(r.slogans).toEqual([]);
    expect(r.explanation).toContain("did not return");
  });
});

// Suppress unused-import lint
export type _Unused = Tone | SloganStyle;
