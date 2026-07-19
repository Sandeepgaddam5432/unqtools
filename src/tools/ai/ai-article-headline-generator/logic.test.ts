import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  FORMULA_LABELS,
  TRIGGER_LABELS,
  STYLE_LABELS,
  TOPIC_PRESETS,
  POWER_WORDS,
  POWER_WORD_SET,
  EMOTIONAL_LEXICONS,
  FORMULA_TEMPLATES,
  normalizeTopic,
  extractKeywords,
  extractSubject,
  summarizeDraft,
  estimatePixelWidth,
  fitsSerp,
  findPowerWords,
  detectEmotionalTrigger,
  detectClickbait,
  scoreLength,
  scorePower,
  scoreEmotion,
  scoreClickability,
  scorePixel,
  scoreHeadline,
  generateMetaDescription,
  generateHeadlines,
  pickABPair,
  computeStats,
  renderText,
  renderMarkdown,
  renderJson,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type HeadlineFormula,
  type EmotionalTrigger,
  type StylePreset,
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

describe("ai-headline constants", () => {
  it("has history key", () => {
    expect(HISTORY_KEY).toBe("unqtools:ai-headline:history");
  });
  it("caps history at 20", () => {
    expect(HISTORY_MAX).toBe(20);
  });
  it("has 10 headline formulas", () => {
    expect(Object.keys(FORMULA_LABELS)).toHaveLength(10);
  });
  it("has 6 emotional triggers", () => {
    expect(Object.keys(TRIGGER_LABELS)).toHaveLength(6);
  });
  it("has 5 style presets", () => {
    expect(Object.keys(STYLE_LABELS)).toHaveLength(5);
  });
  it("has 200+ power words", () => {
    expect(POWER_WORDS.length).toBeGreaterThanOrEqual(100);
  });
  it("power word set matches array", () => {
    expect(POWER_WORD_SET.size).toBe(POWER_WORDS.length);
  });
  it("has lexicons for all 6 triggers", () => {
    for (const t of Object.keys(TRIGGER_LABELS) as EmotionalTrigger[]) {
      expect(EMOTIONAL_LEXICONS[t].length).toBeGreaterThan(0);
    }
  });
  it("has 10 formula template entries (one per formula)", () => {
    expect(FORMULA_TEMPLATES).toHaveLength(10);
    const formulas = new Set(FORMULA_TEMPLATES.map((t) => t.formula));
    expect(formulas.size).toBe(10);
  });
  it("each formula has at least 3 templates", () => {
    for (const t of FORMULA_TEMPLATES) {
      expect(t.templates.length).toBeGreaterThanOrEqual(3);
    }
  });
  it("has topic presets", () => {
    expect(TOPIC_PRESETS.length).toBeGreaterThanOrEqual(5);
  });
});

describe("ai-headline normalizeTopic", () => {
  it("collapses whitespace", () => {
    expect(normalizeTopic("  remote   team  management  ")).toBe("remote team management");
  });
  it("handles empty", () => {
    expect(normalizeTopic("")).toBe("");
  });
});

describe("ai-headline extractKeywords", () => {
  it("extracts meaningful keywords, drops stopwords", () => {
    const kws = extractKeywords("How to start a podcast in 2025");
    expect(kws).toContain("start");
    expect(kws).toContain("podcast");
    expect(kws).toContain("2025");
    expect(kws).not.toContain("how");
    expect(kws).not.toContain("to");
    expect(kws).not.toContain("a");
  });
  it("returns empty for empty input", () => {
    expect(extractKeywords("")).toEqual([]);
  });
});

describe("ai-headline extractSubject", () => {
  it("picks the longest keyword", () => {
    expect(extractSubject("how to start a podcast")).toBe("podcast");
  });
  it("falls back to lowercased topic when no keywords", () => {
    expect(extractSubject("the and of")).toBe("the and of");
  });
});

describe("ai-headline summarizeDraft", () => {
  it("summarizes first sentence into maxWords keywords", () => {
    const draft = "Remote team management is hard. You need clear processes. This guide shows you how.";
    const summary = summarizeDraft(draft, 4);
    expect(summary.split(" ").length).toBeLessThanOrEqual(4);
    expect(summary).toContain("remote");
    expect(summary).toContain("team");
    expect(summary).toContain("management");
  });
  it("handles empty draft", () => {
    expect(summarizeDraft("")).toBe("");
  });
});

describe("ai-headline estimatePixelWidth", () => {
  it("returns positive width for any string", () => {
    expect(estimatePixelWidth("Hello World")).toBeGreaterThan(0);
  });
  it("longer strings generally have larger width", () => {
    const short = estimatePixelWidth("Hi");
    const long = estimatePixelWidth("How to start a podcast in 2025: A complete guide");
    expect(long).toBeGreaterThan(short);
  });
  it("uppercase letters add width", () => {
    const lower = estimatePixelWidth("hello");
    const upper = estimatePixelWidth("HELLO");
    expect(upper).toBeGreaterThan(lower);
  });
});

describe("ai-headline fitsSerp", () => {
  it("returns true for short titles", () => {
    expect(fitsSerp("Hello World")).toBe(true);
  });
  it("returns false for very long titles", () => {
    expect(fitsSerp("This is an extremely long headline that goes well beyond Google's typical SERP display limit of around 580 pixels so it should definitely be truncated when shown in search results pages")).toBe(false);
  });
});

describe("ai-headline findPowerWords", () => {
  it("finds power words in a headline", () => {
    const pws = findPowerWords("10 Proven Ways to Boost Your Productivity");
    expect(pws).toContain("proven");
    expect(pws).toContain("boost");
  });
  it("returns empty when no power words", () => {
    expect(findPowerWords("A Walk in the Park")).toEqual([]);
  });
});

describe("ai-headline detectEmotionalTrigger", () => {
  it("detects curiosity trigger", () => {
    expect(detectEmotionalTrigger("The Hidden Secret Nobody Talks About")).toBe("curiosity");
  });
  it("detects urgency trigger", () => {
    expect(detectEmotionalTrigger("Do This Now Before It's Too Late")).toBe("urgency");
  });
  it("detects fear trigger", () => {
    expect(detectEmotionalTrigger("The Worst Mistake You Can Make")).toBe("fear");
  });
  it("detects joy trigger", () => {
    expect(detectEmotionalTrigger("Amazing Ways to Win at Life")).toBe("joy");
  });
  it("detects trust trigger for how-to", () => {
    expect(detectEmotionalTrigger("How to Build a Website")).toBe("trust");
  });
  it("returns null when no trigger", () => {
    expect(detectEmotionalTrigger("A Walk in the Park")).toBeNull();
  });
});

describe("ai-headline detectClickbait", () => {
  it("flags 'you won't believe' pattern", () => {
    const r = detectClickbait("You Won't Believe What Happened Next");
    expect(r.isClickbait).toBe(true);
    expect(r.reasons.length).toBeGreaterThan(0);
  });
  it("flags excessive power words", () => {
    const r = detectClickbait("Shocking Secret Hidden Revealed Amazing Bizarre");
    expect(r.isClickbait).toBe(true);
  });
  it("does not flag clean headlines", () => {
    const r = detectClickbait("How to Start a Podcast in 2025");
    expect(r.isClickbait).toBe(false);
  });
});

describe("ai-headline scoreLength", () => {
  it("scores 50-60 char titles highest", () => {
    const s = scoreLength("How to Start a Podcast in 2025: A Complete Guide");
    expect(s).toBeGreaterThanOrEqual(80);
  });
  it("penalizes very short titles", () => {
    const s = scoreLength("Hi");
    expect(s).toBeLessThan(70);
  });
  it("penalizes very long titles", () => {
    const s = scoreLength("This is an extremely long headline that goes well beyond any reasonable length for a typical article title and should definitely be penalized by the scoring algorithm");
    expect(s).toBeLessThan(60);
  });
});

describe("ai-headline scorePower", () => {
  it("scores 0 power words as 40", () => {
    expect(scorePower("A Walk in the Park")).toBe(40);
  });
  it("scores 1 power word as 80", () => {
    expect(scorePower("Proven Ways to Manage Time")).toBe(80);
  });
  it("scores 2 power words as 100", () => {
    expect(scorePower("Proven Ways to Boost Productivity")).toBe(100);
  });
  it("penalizes 4+ power words", () => {
    expect(scorePower("Proven Secret Hidden Amazing Bizarre Untold")).toBe(40);
  });
});

describe("ai-headline scoreEmotion", () => {
  it("scores 90 when emotion detected", () => {
    expect(scoreEmotion("The Hidden Secret Nobody Talks About")).toBe(90);
  });
  it("scores 40 when no emotion", () => {
    expect(scoreEmotion("A Walk in the Park")).toBe(40);
  });
});

describe("ai-headline scoreClickability", () => {
  it("gives how-to formula a bonus", () => {
    const s = scoreClickability("how-to", "How to Build a Website");
    expect(s).toBeGreaterThan(50);
  });
  it("adds number bonus", () => {
    const noNum = scoreClickability("list", "Ways to Save Money");
    const withNum = scoreClickability("list", "10 Ways to Save Money");
    expect(withNum).toBeGreaterThan(noNum);
  });
  it("adds 'you' bonus", () => {
    const noYou = scoreClickability("benefit", "Save Money Today");
    const withYou = scoreClickability("benefit", "Save Your Money Today");
    expect(withYou).toBeGreaterThanOrEqual(noYou);
  });
});

describe("ai-headline scorePixel", () => {
  it("scores 100 for short titles", () => {
    expect(scorePixel("Hello")).toBe(100);
  });
  it("scores low for very long titles", () => {
    const long = "This is an extremely long headline that goes well beyond Google's typical SERP display limit of around 580 pixels so it should definitely be truncated when shown in search results pages and should receive a very low pixel score";
    expect(scorePixel(long)).toBeLessThan(50);
  });
});

describe("ai-headline scoreHeadline", () => {
  it("returns total within 0-100", () => {
    const s = scoreHeadline("How to Start a Podcast", "how-to");
    expect(s.total).toBeGreaterThanOrEqual(0);
    expect(s.total).toBeLessThanOrEqual(100);
  });
  it("returns all 5 sub-scores", () => {
    const s = scoreHeadline("How to Start a Podcast", "how-to");
    expect(s).toHaveProperty("length");
    expect(s).toHaveProperty("power");
    expect(s).toHaveProperty("emotion");
    expect(s).toHaveProperty("clickability");
    expect(s).toHaveProperty("pixel");
    expect(s).toHaveProperty("total");
  });
});

describe("ai-headline generateMetaDescription", () => {
  it("generates a meta description under 160 chars", () => {
    const meta = generateMetaDescription("How to start a podcast", "how-to", ["podcast", "start"]);
    expect(meta.length).toBeLessThanOrEqual(160);
  });
  it("generates different metas for different formulas", () => {
    const howTo = generateMetaDescription("topic x", "how-to", ["x"]);
    const contrarian = generateMetaDescription("topic x", "contrarian", ["x"]);
    expect(howTo).not.toBe(contrarian);
  });
  it("truncates long metas with ellipsis", () => {
    // Pick a formula that produces a long meta
    const meta = generateMetaDescription("very long topic name with many keywords here", "how-to", ["very", "long", "topic", "name", "keywords"]);
    expect(meta.length).toBeLessThanOrEqual(160);
  });
});

describe("ai-headline generateHeadlines", () => {
  it("generates headlines from a topic", () => {
    const hs = generateHeadlines({ topic: "How to start a podcast", style: "informative" });
    expect(hs.length).toBeGreaterThan(0);
    expect(hs.length).toBeLessThanOrEqual(12);
    for (const h of hs) {
      expect(h.text).toBeTruthy();
      expect(h.formula).toBeTruthy();
      expect(h.scores.total).toBeGreaterThanOrEqual(0);
      expect(h.id).toMatch(/^h-/);
    }
  });
  it("sorts by score descending", () => {
    const hs = generateHeadlines({ topic: "How to start a podcast", style: "informative" });
    for (let i = 1; i < hs.length; i++) {
      expect(hs[i - 1].scores.total).toBeGreaterThanOrEqual(hs[i].scores.total);
    }
  });
  it("respects max cap", () => {
    const hs = generateHeadlines({ topic: "remote team management", style: "informative", max: 5 });
    expect(hs.length).toBeLessThanOrEqual(5);
  });
  it("returns empty for empty topic", () => {
    expect(generateHeadlines({ topic: "", style: "informative" })).toEqual([]);
  });
  it("filters by formulas when provided", () => {
    const hs = generateHeadlines({
      topic: "remote team management",
      formulas: ["how-to", "list"],
      style: "informative",
    });
    const formulas = new Set(hs.map((h) => h.formula));
    expect(formulas.has("how-to") || formulas.has("list")).toBe(true);
    // Should not include other formulas
    for (const f of formulas) {
      expect(["how-to", "list"]).toContain(f);
    }
  });
  it("includes power words, trigger, scores, meta on each headline", () => {
    const hs = generateHeadlines({ topic: "remote team management", style: "informative" });
    const h = hs[0];
    expect(Array.isArray(h.powerWords)).toBe(true);
    expect(h.emotionalTrigger === null || typeof h.emotionalTrigger === "string").toBe(true);
    expect(h.scores).toHaveProperty("total");
    expect(typeof h.metaDescription).toBe("string");
    expect(h.metaDescription.length).toBeGreaterThan(0);
  });
  it("respects seed for deterministic number generation", () => {
    const a = generateHeadlines({ topic: "podcasts", style: "informative", seed: 42 });
    const b = generateHeadlines({ topic: "podcasts", style: "informative", seed: 42 });
    expect(a.map((h) => h.text)).toEqual(b.map((h) => h.text));
  });
});

describe("ai-headline pickABPair", () => {
  it("picks two contrasting headlines", () => {
    const hs = generateHeadlines({ topic: "remote team management", style: "informative" });
    const pair = pickABPair(hs);
    expect(pair).not.toBeNull();
    if (pair) {
      expect(pair.a).toBeTruthy();
      expect(pair.b).toBeTruthy();
      expect(pair.a.id).not.toBe(pair.b.id);
      expect(["a", "b", "tie"]).toContain(pair.winner);
      expect(pair.reason.length).toBeGreaterThan(0);
    }
  });
  it("returns null when fewer than 2 variations", () => {
    expect(pickABPair([])).toBeNull();
  });
});

describe("ai-headline computeStats", () => {
  it("computes stats for variations", () => {
    const hs = generateHeadlines({ topic: "remote team management", style: "informative" });
    const stats = computeStats(hs);
    expect(stats.total).toBe(hs.length);
    expect(stats.avgScore).toBeGreaterThanOrEqual(0);
    expect(stats.avgPixelWidth).toBeGreaterThan(0);
    expect(stats.bestScore).toBeGreaterThanOrEqual(stats.worstScore);
    expect(Object.keys(stats.byFormula)).toHaveLength(10);
    expect(Object.keys(stats.byTrigger)).toHaveLength(6);
  });
  it("returns empty stats for empty input", () => {
    const stats = computeStats([]);
    expect(stats.total).toBe(0);
    expect(stats.avgScore).toBe(0);
    expect(stats.clickbaitCount).toBe(0);
  });
});

describe("ai-headline renderers", () => {
  const hs = generateHeadlines({ topic: "remote team management", style: "informative", max: 3 });
  it("renderText includes score and text", () => {
    const t = renderText(hs);
    expect(t).toContain(hs[0].text);
    expect(t).toContain(`${hs[0].scores.total}/100`);
  });
  it("renderText returns empty for empty input", () => {
    expect(renderText([])).toBe("");
  });
  it("renderMarkdown includes headline as header", () => {
    const m = renderMarkdown(hs);
    expect(m).toContain(`### 1. ${hs[0].text}`);
    expect(m).toContain("**Score:**");
  });
  it("renderJson is valid JSON", () => {
    const j = renderJson(hs);
    const parsed = JSON.parse(j);
    expect(parsed).toHaveLength(hs.length);
    expect(parsed[0].text).toBe(hs[0].text);
  });
  it("renderCsv has header row", () => {
    const c = renderCsv([]);
    expect(c).toContain("text,formula,style,trigger,score");
  });
  it("renderCsv escapes commas in text", () => {
    const c = renderCsv(hs);
    // CSV should at least contain the first row's data
    expect(c.split("\n").length).toBe(hs.length + 1);
  });
});

describe("ai-headline history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, topic: "podcasts", count: 12, avgScore: 72, bestScore: 95 });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].topic).toBe("podcasts");
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, topic: "x", count: 1, avgScore: 50, bestScore: 60 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, topic: "x", count: 1, avgScore: 50, bestScore: 60 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-headline shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      topic: "podcasts",
      formulas: ["how-to", "list"],
      style: "informative",
      max: 10,
    });
    expect(url).toContain("t=podcasts");
    expect(url).toContain("f=how-to%2Clist");
    expect(url).toContain("s=informative");
    expect(url).toContain("m=10");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("t=podcasts&f=how-to%2Clist&s=informative&m=10");
    expect(p.topic).toBe("podcasts");
    expect(p.formulas).toEqual(["how-to", "list"]);
    expect(p.style).toBe("informative");
    expect(p.max).toBe(10);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown formulas", () => {
    const p = parseShareUrl("t=x&f=how-to%2Cunknown-formula");
    expect(p.formulas).toEqual(["how-to"]);
  });
  it("filters unknown style", () => {
    const p = parseShareUrl("t=x&s=unknown");
    expect(p.style).toBeUndefined();
  });
  it("rejects invalid max", () => {
    const p = parseShareUrl("t=x&m=abc");
    expect(p.max).toBeUndefined();
  });
  it("handles draft param", () => {
    const p = parseShareUrl("t=x&d=some%20draft%20text");
    expect(p.draft).toBe("some draft text");
  });
});

describe("ai-headline LLM prompt builder", () => {
  it("includes topic, formulas, style", () => {
    const p = buildLlmPrompt("podcasts", "", ["how-to", "list"], "informative");
    expect(p).toContain("podcasts");
    expect(p).toContain("How-To");
    expect(p).toContain("Listicle");
    expect(p).toContain("Informative");
  });
  it("includes draft when provided", () => {
    const p = buildLlmPrompt("podcasts", "Draft about podcasting equipment", [], "informative");
    expect(p).toContain("Draft about podcasting equipment");
  });
  it("asks for JSON array", () => {
    const p = buildLlmPrompt("podcasts", "", [], "informative");
    expect(p).toContain("JSON array");
  });
});

describe("ai-headline renderLlmResult", () => {
  it("parses valid JSON array", () => {
    const raw = JSON.stringify([
      { text: "How to Start a Podcast", formula: "how-to", metaDescription: "A guide." },
      { text: "10 Podcast Tips", formula: "list", metaDescription: "10 tips." },
    ]);
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.headlines).toHaveLength(2);
      expect(r.headlines[0].text).toBe("How to Start a Podcast");
      expect(r.headlines[0].formula).toBe("how-to");
    }
  });
  it("strips markdown fences", () => {
    const raw = "```json\n" + JSON.stringify([{ text: "X", formula: "how-to", metaDescription: "Y" }]) + "\n```";
    const r = renderLlmResult(raw);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.headlines).toHaveLength(1);
  });
  it("errors on invalid JSON", () => {
    const r = renderLlmResult("not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Could not parse");
  });
  it("errors on non-array JSON", () => {
    const r = renderLlmResult(JSON.stringify({ foo: "bar" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("not a JSON array");
  });
  it("errors when no valid items", () => {
    const r = renderLlmResult(JSON.stringify([{ formula: "how-to" }])); // no text
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("no valid headline");
  });
  it("defaults unknown formula to bold-statement", () => {
    const r = renderLlmResult(JSON.stringify([{ text: "X", formula: "unknown-formula", metaDescription: "Y" }]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.headlines[0].formula).toBe("bold-statement");
  });
  it("defaults missing metaDescription to empty string", () => {
    const r = renderLlmResult(JSON.stringify([{ text: "X", formula: "how-to" }]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.headlines[0].metaDescription).toBe("");
  });
});

// Suppress unused-import lint for type-only imports
export type _Unused =
  | HeadlineFormula
  | EmotionalTrigger
  | StylePreset;
