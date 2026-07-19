import { describe, it, expect, beforeEach } from "vitest";
import {
  STORY_TYPES,
  STORY_TYPE_LABELS,
  STORY_TEMPLATES,
  TONES,
  TONE_LABELS,
  STICKER_TYPES,
  STICKER_LABELS,
  MUSIC_SUGGESTIONS,
  HOOK_PREFIXES,
  CTA_TEMPLATES,
  normalizeTopic,
  defaultSlideCount,
  buildTemplateSequence,
  pickHookPrefix,
  pickCTA,
  generateSlideText,
  recommendStickers,
  computeSlideDuration,
  buildStory,
  validateFlow,
  countStickers,
  countSlideTypes,
  buildPollSlide,
  buildQuestionSlide,
  buildLinkSlide,
  buildAltVariations,
  computeSummaryStats,
  renderText,
  renderCsv,
  splitCsvRow,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type StoryType,
  type Tone,
  type StoryInput,
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

const sampleInput: StoryInput = {
  storyTopic: "our new product launch",
  slideCount: 7,
  storyType: "announcement",
  includePolls: true,
  includeQuestions: false,
  includeLinks: true,
  tone: "casual",
};

describe("instagram-story-planner constants", () => {
  it("has 7 story types", () => {
    expect(STORY_TYPES).toHaveLength(7);
  });
  it("has 7 story type labels", () => {
    expect(Object.keys(STORY_TYPE_LABELS)).toHaveLength(7);
  });
  it("has templates for each story type", () => {
    for (const t of STORY_TYPES) {
      expect(STORY_TEMPLATES[t].length).toBeGreaterThanOrEqual(3);
    }
  });
  it("has 4 tones", () => {
    expect(TONES).toHaveLength(4);
  });
  it("has 4 tone labels", () => {
    expect(Object.keys(TONE_LABELS)).toHaveLength(4);
  });
  it("has 6 sticker types", () => {
    expect(STICKER_TYPES).toHaveLength(6);
  });
  it("has 6 sticker labels", () => {
    expect(Object.keys(STICKER_LABELS)).toHaveLength(6);
  });
  it("has music suggestions for each story type", () => {
    for (const t of STORY_TYPES) {
      expect(MUSIC_SUGGESTIONS[t].length).toBeGreaterThan(0);
    }
  });
  it("has hook prefixes for each tone", () => {
    for (const t of TONES) {
      expect(HOOK_PREFIXES[t].length).toBeGreaterThanOrEqual(1);
    }
  });
  it("has CTA templates for each tone", () => {
    for (const t of TONES) {
      expect(CTA_TEMPLATES[t].length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("instagram-story-planner normalizeTopic", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeTopic("  hello   world  ")).toBe("hello world");
  });
  it("handles empty", () => {
    expect(normalizeTopic("")).toBe("");
  });
});

describe("instagram-story-planner defaultSlideCount", () => {
  it("returns the template length", () => {
    expect(defaultSlideCount("announcement")).toBe(STORY_TEMPLATES["announcement"].length);
  });
  it("returns 5 for announcement", () => {
    expect(defaultSlideCount("announcement")).toBe(5);
  });
  it("returns 7 for tutorial", () => {
    expect(defaultSlideCount("tutorial")).toBe(7);
  });
});

describe("instagram-story-planner buildTemplateSequence", () => {
  it("returns base template when target matches", () => {
    const seq = buildTemplateSequence("announcement", 5);
    expect(seq).toEqual(STORY_TEMPLATES["announcement"]);
  });
  it("truncates when target is less than base", () => {
    const seq = buildTemplateSequence("tutorial", 3);
    expect(seq.length).toBe(3);
  });
  it("expands by repeating middle slot for tutorial", () => {
    const seq = buildTemplateSequence("tutorial", 10);
    expect(seq.length).toBe(10);
    const stepCount = seq.filter((s) => s === "step").length;
    expect(stepCount).toBeGreaterThanOrEqual(2);
  });
  it("expands list by repeating 'item'", () => {
    const seq = buildTemplateSequence("list", 10);
    expect(seq.length).toBe(10);
    const itemCount = seq.filter((s) => s === "item").length;
    expect(itemCount).toBeGreaterThanOrEqual(3);
  });
  it("expands q-and-a by repeating question/answer", () => {
    const seq = buildTemplateSequence("q-and-a", 8);
    expect(seq.length).toBe(8);
  });
});

describe("instagram-story-planner pickHookPrefix + pickCTA", () => {
  it("returns a prefix for the tone", () => {
    expect(pickHookPrefix("casual").length).toBeGreaterThan(0);
  });
  it("cycles through prefixes by index", () => {
    const a = pickHookPrefix("casual", 0);
    const b = pickHookPrefix("casual", 1);
    expect(a).not.toBe(b);
  });
  it("returns a CTA for the tone", () => {
    expect(pickCTA("urgent").length).toBeGreaterThan(0);
  });
});

describe("instagram-story-planner generateSlideText", () => {
  it("generates hook text with prefix", () => {
    const txt = generateSlideText("hook", "new product", "casual", 0);
    expect(txt.length).toBeGreaterThan(0);
    expect(txt.toLowerCase()).toContain("new product");
  });
  it("generates intro text", () => {
    const txt = generateSlideText("intro", "design tips", "professional", 0);
    expect(txt).toContain("design tips");
  });
  it("generates cta text", () => {
    const txt = generateSlideText("cta", "anything", "casual", 5);
    expect(txt.length).toBeGreaterThan(0);
  });
  it("generates step text with index", () => {
    const txt = generateSlideText("step", "tutorial", "professional", 2);
    expect(txt).toContain("Step 3");
  });
  it("generates poll text", () => {
    const txt = generateSlideText("poll", "brand x", "playful", 0);
    expect(txt).toContain("Poll");
  });
});

describe("instagram-story-planner recommendStickers", () => {
  it("adds poll sticker for poll slide when includePolls", () => {
    const s = recommendStickers("poll", sampleInput, 0);
    expect(s).toContain("poll");
  });
  it("does not add poll sticker when includePolls is false", () => {
    const s = recommendStickers("poll", { ...sampleInput, includePolls: false }, 0);
    expect(s).not.toContain("poll");
  });
  it("adds question sticker when includeQuestions", () => {
    const s = recommendStickers("question", { ...sampleInput, includeQuestions: true }, 0);
    expect(s).toContain("question");
  });
  it("adds link sticker when includeLinks", () => {
    const s = recommendStickers("link", sampleInput, 0);
    expect(s).toContain("link");
  });
  it("adds hashtag sticker for hook", () => {
    const s = recommendStickers("hook", sampleInput, 0);
    expect(s).toContain("hashtag");
  });
  it("adds mention sticker on every 4th slide", () => {
    const s = recommendStickers("details", sampleInput, 4);
    expect(s).toContain("mention");
  });
});

describe("instagram-story-planner computeSlideDuration", () => {
  it("returns at least 3 seconds", () => {
    expect(computeSlideDuration("intro", "short")).toBeGreaterThanOrEqual(3);
  });
  it("returns at most 15 seconds", () => {
    const long = "x".repeat(500);
    expect(computeSlideDuration("poll", long)).toBeLessThanOrEqual(15);
  });
  it("gives hook slides more time than basic slides", () => {
    const hook = computeSlideDuration("hook", "Same length text");
    const basic = computeSlideDuration("details", "Same length text");
    expect(hook).toBeGreaterThanOrEqual(basic);
  });
  it("gives poll slides long durations for interaction", () => {
    const poll = computeSlideDuration("poll", "Which one?");
    expect(poll).toBeGreaterThanOrEqual(10);
  });
});

describe("instagram-story-planner buildStory", () => {
  it("returns empty result for empty topic", () => {
    const r = buildStory({ ...sampleInput, storyTopic: "" });
    expect(r.slides).toEqual([]);
    expect(r.totalDurationSec).toBe(0);
  });
  it("produces slides for valid input", () => {
    const r = buildStory(sampleInput);
    expect(r.slides.length).toBeGreaterThan(0);
    expect(r.slides.length).toBeLessThanOrEqual(sampleInput.slideCount);
  });
  it("clamps slide count to 3-15", () => {
    const r = buildStory({ ...sampleInput, slideCount: 50 });
    expect(r.slides.length).toBeLessThanOrEqual(15);
    const r2 = buildStory({ ...sampleInput, slideCount: 1 });
    expect(r2.slides.length).toBeGreaterThanOrEqual(3);
  });
  it("marks first slide as hook", () => {
    const r = buildStory(sampleInput);
    expect(r.slides[0].isHook).toBe(true);
  });
  it("marks last slide as CTA when no cta/closing present", () => {
    const r = buildStory({ ...sampleInput, storyType: "tutorial", slideCount: 3 });
    expect(r.slides[r.slides.length - 1].isCTA).toBe(true);
  });
  it("computes total duration", () => {
    const r = buildStory(sampleInput);
    expect(r.totalDurationSec).toBeGreaterThan(0);
    expect(r.totalDurationSec).toBe(r.slides.reduce((s, x) => s + x.durationSec, 0));
  });
  it("returns music suggestion", () => {
    const r = buildStory(sampleInput);
    expect(r.musicSuggestion.length).toBeGreaterThan(0);
  });
  it("includes stickers in sticker counts", () => {
    const r = buildStory({ ...sampleInput, includeLinks: true });
    expect(r.stickerCounts.link).toBeGreaterThan(0);
  });
});

describe("instagram-story-planner validateFlow", () => {
  it("returns false for empty slides", () => {
    expect(validateFlow([], "announcement")).toBe(false);
  });
  it("returns false for fewer than 3 slides", () => {
    const slides = [
      { num: 1, type: "hook", textOverlay: "x", stickers: [] as never[], durationSec: 5, isHook: true, isCTA: false },
      { num: 2, type: "cta", textOverlay: "x", stickers: [] as never[], durationSec: 5, isHook: false, isCTA: true },
    ];
    expect(validateFlow(slides, "announcement")).toBe(false);
  });
  it("returns false without hook", () => {
    const slides = [
      { num: 1, type: "details", textOverlay: "x", stickers: [], durationSec: 5, isHook: false, isCTA: false },
      { num: 2, type: "details", textOverlay: "x", stickers: [], durationSec: 5, isHook: false, isCTA: false },
      { num: 3, type: "cta", textOverlay: "x", stickers: [], durationSec: 5, isHook: false, isCTA: true },
    ];
    expect(validateFlow(slides, "announcement")).toBe(false);
  });
  it("returns false without CTA", () => {
    const slides = [
      { num: 1, type: "hook", textOverlay: "x", stickers: [], durationSec: 5, isHook: true, isCTA: false },
      { num: 2, type: "details", textOverlay: "x", stickers: [], durationSec: 5, isHook: false, isCTA: false },
      { num: 3, type: "details", textOverlay: "x", stickers: [], durationSec: 5, isHook: false, isCTA: false },
    ];
    expect(validateFlow(slides, "announcement")).toBe(false);
  });
  it("returns false for tutorial without step", () => {
    const slides = [
      { num: 1, type: "hook", textOverlay: "x", stickers: [], durationSec: 5, isHook: true, isCTA: false },
      { num: 2, type: "intro", textOverlay: "x", stickers: [], durationSec: 5, isHook: false, isCTA: false },
      { num: 3, type: "cta", textOverlay: "x", stickers: [], durationSec: 5, isHook: false, isCTA: true },
    ];
    expect(validateFlow(slides, "tutorial")).toBe(false);
  });
  it("returns true for valid tutorial with step + result + hook + cta", () => {
    const slides = [
      { num: 1, type: "hook", textOverlay: "x", stickers: [], durationSec: 5, isHook: true, isCTA: false },
      { num: 2, type: "step", textOverlay: "x", stickers: [], durationSec: 5, isHook: false, isCTA: false },
      { num: 3, type: "result", textOverlay: "x", stickers: [], durationSec: 5, isHook: false, isCTA: false },
      { num: 4, type: "cta", textOverlay: "x", stickers: [], durationSec: 5, isHook: false, isCTA: true },
    ];
    expect(validateFlow(slides, "tutorial")).toBe(true);
  });
});

describe("instagram-story-planner countStickers + countSlideTypes", () => {
  it("counts stickers across slides", () => {
    const r = buildStory(sampleInput);
    const counts = countStickers(r.slides);
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    expect(total).toBe(r.slides.reduce((s, x) => s + x.stickers.length, 0));
  });
  it("counts slide types across slides", () => {
    const r = buildStory(sampleInput);
    const counts = countSlideTypes(r.slides);
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    expect(total).toBe(r.slides.length);
  });
});

describe("instagram-story-planner buildPollSlide / buildQuestionSlide / buildLinkSlide", () => {
  it("builds a poll slide", () => {
    const s = buildPollSlide("topic", "Which one?", "A", "B");
    expect(s.type).toBe("poll");
    expect(s.stickers).toContain("poll");
    expect(s.textOverlay).toContain("Which one?");
  });
  it("builds a question slide with default prompt", () => {
    const s = buildQuestionSlide("");
    expect(s.type).toBe("question");
    expect(s.stickers).toContain("question");
    expect(s.textOverlay.length).toBeGreaterThan(0);
  });
  it("builds a link slide with URL", () => {
    const s = buildLinkSlide("https://example.com", "topic");
    expect(s.type).toBe("link");
    expect(s.stickers).toContain("link");
    expect(s.textOverlay).toContain("https://example.com");
  });
  it("builds a link slide without URL (uses topic)", () => {
    const s = buildLinkSlide("", "new product");
    expect(s.textOverlay).toContain("new product");
  });
});

describe("instagram-story-planner buildAltVariations", () => {
  it("generates 2 variations with different tones", () => {
    const vars = buildAltVariations(sampleInput);
    expect(vars).toHaveLength(2);
    expect(vars[0].tone).not.toBe(sampleInput.tone);
    expect(vars[1].tone).not.toBe(sampleInput.tone);
    expect(vars[0].tone).not.toBe(vars[1].tone);
  });
});

describe("instagram-story-planner computeSummaryStats", () => {
  it("computes summary stats", () => {
    const r = buildStory(sampleInput);
    const s = computeSummaryStats(r);
    expect(s.totalSlides).toBe(r.slides.length);
    expect(s.totalDurationSec).toBe(r.totalDurationSec);
    expect(s.hasHook).toBe(true);
    expect(s.hasCTA).toBe(true);
  });
});

describe("instagram-story-planner renderText + renderCsv", () => {
  it("renders text with topic + type + slides", () => {
    const r = buildStory(sampleInput);
    const text = renderText(r);
    expect(text).toContain("Story:");
    expect(text).toContain("Type:");
    expect(text).toContain("Music:");
    expect(text).toContain("[1]");
  });
  it("renders empty for empty result", () => {
    const r = buildStory({ ...sampleInput, storyTopic: "" });
    expect(renderText(r)).toBe("");
  });
  it("renders CSV header", () => {
    const r = buildStory(sampleInput);
    const csv = renderCsv(r);
    expect(csv).toContain("slide_num,type,text_overlay,stickers,duration_sec,is_hook,is_cta");
  });
  it("renders CSV rows", () => {
    const r = buildStory(sampleInput);
    const csv = renderCsv(r);
    expect(csv.split("\n").length).toBe(r.slides.length + 1);
  });
});

describe("instagram-story-planner splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
});

describe("instagram-story-planner history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, topic: "launch", storyType: "announcement", tone: "casual", slideCount: 7, totalDurationSec: 45 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, topic: "x", storyType: "announcement", tone: "casual", slideCount: 5, totalDurationSec: 30 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, topic: "x", storyType: "announcement", tone: "casual", slideCount: 5, totalDurationSec: 30 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("instagram-story-planner shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(sampleInput);
    expect(url).toContain("topic=");
    expect(url).toContain("type=announcement");
    expect(url).toContain("tone=casual");
    expect(url).toContain("n=7");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = buildShareUrl(sampleInput);
    const hash = url.includes("#") ? url.split("#")[1] : url.replace(/^\?/, "");
    const p = parseShareUrl(hash);
    expect(p.storyTopic).toBe(sampleInput.storyTopic);
    expect(p.storyType).toBe("announcement");
    expect(p.tone).toBe("casual");
    expect(p.slideCount).toBe(7);
    expect(p.includePolls).toBe(true);
    expect(p.includeLinks).toBe(true);
    expect(p.includeQuestions).toBe(false);
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.storyTopic).toBe("");
    expect(p.storyType).toBe("announcement");
    expect(p.tone).toBe("casual");
    expect(p.slideCount).toBe(7);
  });
  it("filters invalid story type", () => {
    const p = parseShareUrl("type=invalid&tone=casual");
    expect(p.storyType).toBe("announcement");
  });
  it("filters invalid tone", () => {
    const p = parseShareUrl("type=announcement&tone=invalid");
    expect(p.tone).toBe("casual");
  });
  it("parses booleans correctly", () => {
    const p = parseShareUrl("polls=0&questions=1&links=1");
    expect(p.includePolls).toBe(false);
    expect(p.includeQuestions).toBe(true);
    expect(p.includeLinks).toBe(true);
  });
});

// Suppress unused-import lint
export type _Unused = StoryType | Tone;
