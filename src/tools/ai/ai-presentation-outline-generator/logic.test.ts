import { describe, it, expect, beforeEach } from "vitest";
import {
  DECK_TYPE_LABELS,
  SLIDE_COUNT_LABELS,
  SLIDE_COUNT_VALUES,
  TONE_LABELS,
  FRAMEWORK_LABELS,
  VISUAL_LABELS,
  SAMPLE_TOPICS,
  AUDIENCE_PRESETS,
  normalizeText,
  extractKeywords,
  titleCase,
  detectDeckType,
  suggestFramework,
  suggestTone,
  suggestAngles,
  formatTime,
  generateThesisVariants,
  estimateSlideSeconds,
  computeTotalSeconds,
  generatePresentation,
  reorderSlides,
  expandSlide,
  regenerateSlide,
  chooseThesis,
  computeStats,
  renderText,
  renderMarkdown,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type DeckType,
  type Tone,
  type SlideCountPreset,
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

describe("ai-presentation-outline constants", () => {
  it("has 6 deck type labels", () => {
    expect(Object.keys(DECK_TYPE_LABELS)).toHaveLength(6);
    expect(DECK_TYPE_LABELS.sales).toContain("Sales");
    expect(DECK_TYPE_LABELS.pitch).toContain("pitch");
  });
  it("has 5 slide count presets", () => {
    expect(Object.keys(SLIDE_COUNT_LABELS)).toHaveLength(5);
  });
  it("slide count values are ascending", () => {
    expect(SLIDE_COUNT_VALUES.lightning).toBeLessThan(SLIDE_COUNT_VALUES.short);
    expect(SLIDE_COUNT_VALUES.short).toBeLessThan(SLIDE_COUNT_VALUES.standard);
    expect(SLIDE_COUNT_VALUES.standard).toBeLessThan(SLIDE_COUNT_VALUES.long);
    expect(SLIDE_COUNT_VALUES.long).toBeLessThan(SLIDE_COUNT_VALUES.deep);
  });
  it("has 3 tone labels", () => {
    expect(Object.keys(TONE_LABELS)).toHaveLength(3);
  });
  it("has 5 framework labels", () => {
    expect(Object.keys(FRAMEWORK_LABELS)).toHaveLength(5);
  });
  it("has 8 visual labels", () => {
    expect(Object.keys(VISUAL_LABELS)).toHaveLength(8);
  });
  it("has sample topics", () => {
    expect(SAMPLE_TOPICS.length).toBeGreaterThanOrEqual(5);
    expect(SAMPLE_TOPICS.some((t) => t.toLowerCase().includes("saas"))).toBe(true);
  });
  it("has audience presets", () => {
    expect(AUDIENCE_PRESETS.length).toBeGreaterThanOrEqual(5);
    expect(AUDIENCE_PRESETS.some((a) => a.toLowerCase().includes("investor"))).toBe(true);
  });
});

describe("ai-presentation-outline normalizeText", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeText("  How   AI   changes   work  ")).toBe("How AI changes work");
  });
  it("handles empty", () => {
    expect(normalizeText("")).toBe("");
  });
});

describe("ai-presentation-outline extractKeywords", () => {
  it("extracts keywords and filters stop words", () => {
    const kw = extractKeywords("How our SaaS cut churn 32% in two quarters");
    expect(kw).toContain("saas");
    expect(kw).toContain("churn");
    expect(kw).toContain("quarters");
    expect(kw).not.toContain("how");
    expect(kw).not.toContain("our");
    expect(kw).not.toContain("in");
  });
  it("returns empty for empty input", () => {
    expect(extractKeywords("")).toEqual([]);
  });
  it("dedupes", () => {
    const kw = extractKeywords("AI AI AI");
    expect(kw).toEqual(["ai"]);
  });
});

describe("ai-presentation-outline titleCase", () => {
  it("capitalizes each word", () => {
    expect(titleCase("the future of remote work")).toBe("The Future Of Remote Work");
  });
  it("handles empty", () => {
    expect(titleCase("")).toBe("");
  });
});

describe("ai-presentation-outline detectDeckType", () => {
  it("detects sales from goal", () => {
    expect(detectDeckType("close more deals this quarter")).toBe("sales");
  });
  it("detects training from goal", () => {
    expect(detectDeckType("onboard new engineers to our monorepo")).toBe("training");
  });
  it("detects pitch from goal", () => {
    expect(detectDeckType("raise our seed round from VCs")).toBe("pitch");
  });
  it("detects report from goal", () => {
    expect(detectDeckType("share Q3 marketing findings")).toBe("report");
  });
  it("detects keynote from goal", () => {
    expect(detectDeckType("inspire the audience with a vision")).toBe("keynote");
  });
  it("defaults to conference", () => {
    expect(detectDeckType("explain our architecture")).toBe("conference");
  });
});

describe("ai-presentation-outline suggestFramework", () => {
  it("suggests problem-solution for sales", () => {
    expect(suggestFramework("sales")).toBe("problem-solution");
  });
  it("suggests pitch-deck for pitch", () => {
    expect(suggestFramework("pitch")).toBe("pitch-deck");
  });
  it("suggests heros-journey for keynote", () => {
    expect(suggestFramework("keynote")).toBe("heros-journey");
  });
  it("suggests report for report", () => {
    expect(suggestFramework("report")).toBe("report");
  });
});

describe("ai-presentation-outline suggestTone", () => {
  it("suggests formal for pitch", () => {
    expect(suggestTone("pitch")).toBe("formal");
  });
  it("suggests energetic for keynote", () => {
    expect(suggestTone("keynote")).toBe("energetic");
  });
  it("suggests conversational for training", () => {
    expect(suggestTone("training")).toBe("conversational");
  });
});

describe("ai-presentation-outline suggestAngles", () => {
  it("returns angles for a topic", () => {
    const angles = suggestAngles("remote work");
    expect(angles.length).toBeGreaterThanOrEqual(3);
    expect(angles.some((a) => a.toLowerCase().includes("remote"))).toBe(true);
  });
  it("returns empty for empty input", () => {
    expect(suggestAngles("")).toEqual([]);
  });
});

describe("ai-presentation-outline formatTime", () => {
  it("formats whole minutes", () => {
    expect(formatTime(120)).toBe("2m");
  });
  it("formats minutes and seconds", () => {
    expect(formatTime(90)).toBe("1m 30s");
  });
  it("formats zero", () => {
    expect(formatTime(0)).toBe("0m");
  });
});

describe("ai-presentation-outline generateThesisVariants", () => {
  it("produces 1-3 variants per deck type", () => {
    for (const deckType of Object.keys(DECK_TYPE_LABELS) as DeckType[]) {
      const variants = generateThesisVariants("remote work", deckType, "executives");
      expect(variants.length).toBeGreaterThanOrEqual(1);
      expect(variants.length).toBeLessThanOrEqual(3);
      for (const v of variants) {
        expect(v.text.length).toBeGreaterThan(10);
        expect(["for", "against", "neutral"]).toContain(v.stance);
      }
    }
  });
  it("pitch thesis mentions the team", () => {
    const variants = generateThesisVariants("our SaaS", "pitch", "investors");
    expect(variants.some((v) => /team/i.test(v.text))).toBe(true);
  });
});

describe("ai-presentation-outline estimateSlideSeconds", () => {
  it("scales weight by total seconds", () => {
    expect(estimateSlideSeconds(0.1, 600)).toBe(60);
  });
  it("enforces a minimum of 20", () => {
    expect(estimateSlideSeconds(0.001, 600)).toBe(20);
  });
});

describe("ai-presentation-outline computeTotalSeconds", () => {
  it("returns higher time for more slides", () => {
    const t5 = computeTotalSeconds("conference", 5);
    const t15 = computeTotalSeconds("conference", 15);
    expect(t15).toBeGreaterThan(t5);
  });
  it("differs by deck type", () => {
    const sales = computeTotalSeconds("sales", 10);
    const pitch = computeTotalSeconds("pitch", 10);
    expect(sales).not.toBe(pitch);
  });
});

describe("ai-presentation-outline generatePresentation", () => {
  it("generates a complete sales presentation", () => {
    const p = generatePresentation("Our SaaS for churn", "executives", "close the deal", "sales", "conversational", 7);
    expect(p.topic).toBe("Our SaaS for churn");
    expect(p.audience).toBe("executives");
    expect(p.deckType).toBe("sales");
    expect(p.slides).toHaveLength(7);
    expect(p.chosenThesis.length).toBeGreaterThan(20);
  });
  it("every slide has title, bullets, speaker notes, visual", () => {
    const p = generatePresentation("AI in design", "designers", "introduce AI", "conference", "energetic", 7);
    for (const s of p.slides) {
      expect(s.title.length).toBeGreaterThan(3);
      expect(s.bulletPoints.length).toBeGreaterThanOrEqual(2);
      expect(s.speakerNotes.length).toBeGreaterThan(20);
      expect(s.visual.kind.length).toBeGreaterThan(0);
      expect(s.visual.text.length).toBeGreaterThan(3);
      expect(s.secondsEstimate).toBeGreaterThanOrEqual(20);
    }
  });
  it("pitch deck has 11 base slides", () => {
    const p = generatePresentation("My startup", "seed investors", "raise $1M", "pitch", "formal", 11);
    expect(p.slides).toHaveLength(11);
    const types = p.slides.map((s) => s.type);
    expect(types).toContain("problem");
    expect(types).toContain("solution");
    expect(types).toContain("market");
    expect(types).toContain("traction");
    expect(types).toContain("ask");
  });
  it("training deck has learning objectives", () => {
    const p = generatePresentation("Onboarding to monorepo", "new hires", "train", "training", "conversational", 7);
    const types = p.slides.map((s) => s.type);
    expect(types).toContain("learning-objective");
    expect(types).toContain("concept");
    expect(types).toContain("practice");
  });
  it("keynote deck uses hero's journey", () => {
    const p = generatePresentation("The future of remote work", "general audience", "inspire", "keynote", "energetic", 7);
    const titles = p.slides.map((s) => s.title);
    expect(titles.some((t) => /ordinary world/i.test(t))).toBe(true);
    expect(titles.some((t) => /call/i.test(t))).toBe(true);
    expect(titles.some((t) => /trials/i.test(t))).toBe(true);
    expect(titles.some((t) => /revelation/i.test(t))).toBe(true);
    expect(titles.some((t) => /return/i.test(t))).toBe(true);
  });
  it("report deck has executive summary + recommendations", () => {
    const p = generatePresentation("Q3 marketing performance", "stakeholders", "report findings", "report", "formal", 7);
    const types = p.slides.map((s) => s.type);
    expect(types).toContain("executive-summary");
    expect(types).toContain("methodology");
    expect(types).toContain("findings");
    expect(types).toContain("recommendations");
  });
  it("adds extra slides when slideCount exceeds base template", () => {
    const p = generatePresentation("Deep dive topic", "engineers", "explain", "conference", "energetic", 12);
    expect(p.slides.length).toBe(12);
    // Last slide should be Q&A (closing)
    expect(p.slides[p.slides.length - 1].type).toBe("q-and-a");
  });
  it("truncates and preserves closing when slideCount is below base template", () => {
    const p = generatePresentation("Short talk", "audience", "explain", "conference", "energetic", 3);
    expect(p.slides).toHaveLength(3);
    // Last slide should be q-and-a (the closing type for conference)
    expect(p.slides[p.slides.length - 1].type).toBe("q-and-a");
  });
  it("totals time is sum of slide seconds", () => {
    const p = generatePresentation("Topic X", "aud", "goal", "sales", "formal", 7);
    const sum = p.slides.reduce((a, b) => a + b.secondsEstimate, 0);
    expect(p.totalSeconds).toBe(sum);
  });
  it("returns gracefully for empty topic", () => {
    const p = generatePresentation("", "aud", "goal", "conference", "formal", 5);
    expect(p.topic).toBe("");
    expect(p.slides.length).toBeGreaterThanOrEqual(5);
  });
});

describe("ai-presentation-outline reorderSlides", () => {
  it("reorders slides by id list", () => {
    const p = generatePresentation("Topic X", "aud", "goal", "sales", "formal", 7);
    const ids = p.slides.map((s) => s.id);
    const reversed = [...ids].reverse();
    const reordered = reorderSlides(p, reversed);
    expect(reordered.slides.map((s) => s.id)).toEqual(reversed);
  });
  it("preserves slides not in id list (appends them)", () => {
    const p = generatePresentation("Topic X", "aud", "goal", "sales", "formal", 7);
    const reordered = reorderSlides(p, []);
    expect(reordered.slides.length).toBe(p.slides.length);
  });
});

describe("ai-presentation-outline expandSlide", () => {
  it("adds sub-points and increases time estimate", () => {
    const p = generatePresentation("Topic X", "aud", "goal", "sales", "formal", 7);
    const firstId = p.slides[0].id;
    const before = p.slides.find((s) => s.id === firstId)!;
    const expanded = expandSlide(p, firstId);
    const after = expanded.slides.find((s) => s.id === firstId)!;
    expect(after.bulletPoints.length).toBeGreaterThan(before.bulletPoints.length);
    expect(after.secondsEstimate).toBeGreaterThanOrEqual(before.secondsEstimate);
  });
  it("updates total time", () => {
    const p = generatePresentation("Topic X", "aud", "goal", "sales", "formal", 7);
    const firstId = p.slides[0].id;
    const expanded = expandSlide(p, firstId);
    expect(expanded.totalSeconds).not.toBe(p.totalSeconds);
  });
});

describe("ai-presentation-outline regenerateSlide", () => {
  it("regenerates a slide without changing slide count", () => {
    const p = generatePresentation("Topic X", "aud", "goal", "conference", "formal", 7);
    const firstId = p.slides[0].id;
    const before = p.slides.find((s) => s.id === firstId)!;
    const regen = regenerateSlide(p, firstId);
    const after = regen.slides.find((s) => s.id === firstId)!;
    expect(regen.slides.length).toBe(p.slides.length);
    // Title or content should be the same template, just re-rendered
    expect(after.title.length).toBeGreaterThan(3);
    expect(after.bulletPoints.length).toBe(before.bulletPoints.length);
  });
});

describe("ai-presentation-outline chooseThesis", () => {
  it("switches to a different thesis variant", () => {
    const p = generatePresentation("Topic X", "aud", "goal", "pitch", "formal", 11);
    expect(p.thesisVariants.length).toBeGreaterThanOrEqual(1);
    if (p.thesisVariants.length >= 2) {
      const next = chooseThesis(p, 1);
      expect(next.chosenThesis).toBe(p.thesisVariants[1].text);
    }
  });
  it("returns outline unchanged for out-of-range index", () => {
    const p = generatePresentation("Topic X", "aud", "goal", "sales", "formal", 7);
    const next = chooseThesis(p, 999);
    expect(next.chosenThesis).toBe(p.chosenThesis);
  });
});

describe("ai-presentation-outline computeStats", () => {
  it("computes correct stats", () => {
    const p = generatePresentation("Topic X", "aud", "goal", "sales", "formal", 7);
    const s = computeStats(p);
    expect(s.totalSlides).toBe(p.slides.length);
    expect(s.totalBullets).toBe(p.slides.reduce((a, b) => a + b.bulletPoints.length, 0));
    expect(s.totalSeconds).toBe(p.totalSeconds);
    expect(s.deckTypeLabel).toContain("Sales");
    // Visual kinds should sum to slide count
    const visualSum = Object.values(s.visualKinds).reduce((a, b) => a + b, 0);
    expect(visualSum).toBe(p.slides.length);
  });
});

describe("ai-presentation-outline render functions", () => {
  it("renderText contains topic, thesis, and slide titles", () => {
    const p = generatePresentation("Topic X", "aud", "goal", "sales", "formal", 7);
    const txt = renderText(p);
    expect(txt).toContain("Topic X");
    expect(txt).toContain("THESIS:");
    expect(txt).toContain("Speaker notes:");
    expect(txt).toContain("Visual:");
  });
  it("renderMarkdown contains headers and visual labels", () => {
    const p = generatePresentation("Topic X", "aud", "goal", "conference", "energetic", 7);
    const md = renderMarkdown(p);
    expect(md).toContain("# Topic X");
    expect(md).toContain("## Thesis");
    expect(md).toContain("## Slide 1:");
    expect(md).toContain("**Visual:**");
  });
  it("renderJson produces valid JSON with slides array", () => {
    const p = generatePresentation("Topic X", "aud", "goal", "pitch", "formal", 11);
    const j = renderJson(p);
    const parsed = JSON.parse(j);
    expect(parsed.topic).toBe("Topic X");
    expect(parsed.deckType).toBe("pitch");
    expect(Array.isArray(parsed.slides)).toBe(true);
    expect(parsed.slides.length).toBe(11);
    expect(parsed.slides[0]).toHaveProperty("title");
    expect(parsed.slides[0]).toHaveProperty("bullets");
    expect(parsed.slides[0]).toHaveProperty("speakerNotes");
    expect(parsed.slides[0]).toHaveProperty("visual");
  });
});

describe("ai-presentation-outline history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      topic: "X",
      audience: "aud",
      deckType: "sales",
      slideCount: 7,
      totalSeconds: 600,
      thesis: "...",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        topic: "X",
        audience: "aud",
        deckType: "sales",
        slideCount: 7,
        totalSeconds: 600,
        thesis: "...",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      topic: "X",
      audience: "aud",
      deckType: "sales",
      slideCount: 7,
      totalSeconds: 600,
      thesis: "...",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-presentation-outline share URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      topic: "remote work",
      audience: "engineers",
      goal: "inspire",
      deckType: "keynote",
      tone: "energetic",
      preset: "standard",
    });
    expect(url).toContain("topic=remote+work");
    expect(url).toContain("aud=engineers");
    expect(url).toContain("type=keynote");
    expect(url).toContain("tone=energetic");
    expect(url).toContain("preset=standard");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const s = parseShareUrl("topic=remote+work&aud=engineers&goal=inspire&type=keynote&tone=energetic&preset=long");
    expect(s.topic).toBe("remote work");
    expect(s.audience).toBe("engineers");
    expect(s.goal).toBe("inspire");
    expect(s.deckType).toBe("keynote");
    expect(s.tone).toBe("energetic");
    expect(s.preset).toBe("long");
  });
  it("handles empty hash with defaults", () => {
    const s = parseShareUrl("");
    expect(s.topic).toBe("");
    expect(s.deckType).toBe("conference");
    expect(s.tone).toBe("conversational");
    expect(s.preset).toBe("standard");
  });
  it("filters unknown values to defaults", () => {
    const s = parseShareUrl("topic=hi&type=bogus&tone=evil&preset=wrong");
    expect(s.deckType).toBe("conference");
    expect(s.tone).toBe("conversational");
    expect(s.preset).toBe("standard");
  });
});

describe("ai-presentation-outline LLM prompt", () => {
  it("builds a prompt with system + user", () => {
    const p = buildLlmPrompt("remote work", "engineers", "inspire", "keynote", "energetic", 15);
    expect(p.system).toContain("keynote");
    expect(p.system).toContain("15 slides");
    expect(p.system).toContain("energetic");
    expect(p.user).toContain("remote work");
    expect(p.user).toContain("engineers");
  });
  it("renderLlmResult returns ok=true for non-empty", () => {
    const r = renderLlmResult("  some markdown  ");
    expect(r.ok).toBe(true);
    expect(r.result).toBe("some markdown");
  });
  it("renderLlmResult returns ok=false for empty", () => {
    const r = renderLlmResult("   ");
    expect(r.ok).toBe(false);
    expect(r.error).toBeDefined();
  });
});

// Suppress unused-import lint
export type _Unused = DeckType | Tone | SlideCountPreset;
