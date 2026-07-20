import { describe, it, expect, beforeEach } from "vitest";
import {
  PLATFORM_LABELS,
  TONE_LABELS,
  LENGTH_LABELS,
  PLATFORM_DURATIONS,
  HOOK_LABELS,
  SAMPLE_TOPICS,
  HISTORY_KEY,
  HISTORY_MAX,
  DEFAULT_WPM,
  MIN_WPM,
  MAX_WPM,
  normalizeTopic,
  normalizeScan,
  extractKeywords,
  titleCase,
  detectPlatform,
  suggestTone,
  formatTimestamp,
  wordsToSeconds,
  secondsToWords,
  estimateWordCount,
  generateHookVariants,
  generateCta,
  generateRetentionTips,
  generateScript,
  chooseHook,
  getChosenHook,
  repurposeToShorts,
  planSeries,
  computeStats,
  renderMarkdown,
  renderTeleprompter,
  renderText,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Platform,
  type Tone,
  type LengthPreset,
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

describe("ai-video-script-outliner constants", () => {
  it("has 5 platform labels", () => {
    expect(Object.keys(PLATFORM_LABELS)).toHaveLength(5);
    expect(PLATFORM_LABELS["youtube-long"]).toContain("YouTube");
  });
  it("has 5 tone labels", () => {
    expect(Object.keys(TONE_LABELS)).toHaveLength(5);
    expect(TONE_LABELS.casual).toBe("Casual");
  });
  it("has 3 length presets", () => {
    expect(Object.keys(LENGTH_LABELS)).toHaveLength(3);
  });
  it("has durations for all 5 platforms × 3 lengths", () => {
    for (const p of Object.keys(PLATFORM_DURATIONS) as Platform[]) {
      expect(Object.keys(PLATFORM_DURATIONS[p])).toHaveLength(3);
      for (const l of ["short", "medium", "long"] as LengthPreset[]) {
        expect(PLATFORM_DURATIONS[p][l]).toBeGreaterThan(0);
      }
    }
  });
  it("short-form platforms have shorter durations than long-form", () => {
    expect(PLATFORM_DURATIONS.tiktok.short).toBeLessThan(PLATFORM_DURATIONS["youtube-long"].short);
  });
  it("has 5 hook style labels", () => {
    expect(Object.keys(HOOK_LABELS)).toHaveLength(5);
  });
  it("has sample topics", () => {
    expect(SAMPLE_TOPICS.length).toBeGreaterThanOrEqual(5);
  });
  it("has a history key and max of 20", () => {
    expect(HISTORY_KEY).toContain("ai-video-script-outliner");
    expect(HISTORY_MAX).toBe(20);
  });
  it("has sensible WPM defaults", () => {
    expect(DEFAULT_WPM).toBe(150);
    expect(MIN_WPM).toBeLessThan(DEFAULT_WPM);
    expect(MAX_WPM).toBeGreaterThan(DEFAULT_WPM);
  });
});

describe("ai-video-script-outliner normalizeTopic", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeTopic("  How   to   podcast ")).toBe("How to podcast");
  });
  it("handles empty", () => {
    expect(normalizeTopic("")).toBe("");
  });
});

describe("ai-video-script-outliner normalizeScan", () => {
  it("lowercases", () => {
    expect(normalizeScan("PODCAST 2025")).toBe("podcast 2025");
  });
});

describe("ai-video-script-outliner extractKeywords", () => {
  it("removes stop words", () => {
    const kw = extractKeywords("How to start a podcast in 2025 with under $100");
    expect(kw).toContain("start");
    expect(kw).toContain("podcast");
    expect(kw).toContain("2025");
    expect(kw).not.toContain("how");
    expect(kw).not.toContain("with");
  });
  it("returns empty for empty input", () => {
    expect(extractKeywords("")).toEqual([]);
  });
});

describe("ai-video-script-outliner titleCase", () => {
  it("title-cases words", () => {
    expect(titleCase("how to podcast")).toBe("How To Podcast");
  });
});

describe("ai-video-script-outliner detectPlatform", () => {
  it("detects tiktok", () => {
    expect(detectPlatform("60 seconds of Excel tips for TikTok")).toBe("tiktok");
  });
  it("detects reels", () => {
    expect(detectPlatform("Instagram reels workflow")).toBe("reels");
  });
  it("detects youtube-short", () => {
    expect(detectPlatform("YouTube shorts: 5 Excel shortcuts")).toBe("youtube-short");
  });
  it("detects explainer", () => {
    expect(detectPlatform("Beginner's guide to investing in index funds")).toBe("explainer");
  });
  it("defaults to youtube-long", () => {
    expect(detectPlatform("How to start a podcast in 2025")).toBe("youtube-long");
  });
  it("returns youtube-long for empty", () => {
    expect(detectPlatform("")).toBe("youtube-long");
  });
});

describe("ai-video-script-outliner suggestTone", () => {
  it("suggests educational for science topics", () => {
    expect(suggestTone("The science of habit formation explained")).toBe("educational");
  });
  it("suggests dramatic for history", () => {
    expect(suggestTone("The history of the QWERTY keyboard")).toBe("dramatic");
  });
  it("suggests professional for how-to", () => {
    expect(suggestTone("Step by step guide to Excel")).toBe("professional");
  });
  it("defaults to casual", () => {
    expect(suggestTone("some random topic")).toBe("casual");
  });
});

describe("ai-video-script-outliner formatTimestamp", () => {
  it("formats seconds under a minute as mm:ss", () => {
    expect(formatTimestamp(45)).toBe("00:45");
  });
  it("formats minutes correctly", () => {
    expect(formatTimestamp(125)).toBe("02:05");
  });
  it("formats hours as h:mm:ss", () => {
    expect(formatTimestamp(3661)).toBe("1:01:01");
  });
  it("clamps negative to zero", () => {
    expect(formatTimestamp(-5)).toBe("00:00");
  });
});

describe("ai-video-script-outliner wordsToSeconds / secondsToWords", () => {
  it("converts 150 words at 150 WPM to ~66 seconds (1 min + 10% padding)", () => {
    const s = wordsToSeconds(150, 150);
    // 150 words / 150 WPM = 1 minute = 60s; with 10% padding = 66s
    expect(s).toBeGreaterThanOrEqual(60);
    expect(s).toBeLessThanOrEqual(75);
  });
  it("returns 0 for non-positive inputs", () => {
    expect(wordsToSeconds(0, 150)).toBe(0);
    expect(wordsToSeconds(100, 0)).toBe(0);
  });
  it("secondsToWords is roughly the inverse of wordsToSeconds", () => {
    const w = 300;
    const s = wordsToSeconds(w, 150);
    const back = secondsToWords(s, 150);
    // Allow for rounding; should be within ~5% of the original.
    expect(Math.abs(back - w)).toBeLessThan(w * 0.10);
  });
});

describe("ai-video-script-outliner estimateWordCount", () => {
  it("estimates word count from a duration", () => {
    const w = estimateWordCount(60, 150); // 1 minute
    expect(w).toBeGreaterThan(100);
    expect(w).toBeLessThan(150);
  });
  it("returns 0 for non-positive duration", () => {
    expect(estimateWordCount(0, 150)).toBe(0);
  });
});

describe("ai-video-script-outliner generateHookVariants", () => {
  it("generates 3 hook variants for short-form", () => {
    const v = generateHookVariants("Excel tips", "tiktok", "casual");
    expect(v.length).toBe(3);
    expect(v.every((h) => h.text.length > 0)).toBe(true);
  });
  it("generates 5 hook variants for long-form", () => {
    const v = generateHookVariants("How to start a podcast", "youtube-long", "casual");
    expect(v.length).toBe(5);
  });
  it("each variant has a unique id", () => {
    const v = generateHookVariants("Excel tips", "youtube-long", "energetic");
    const ids = new Set(v.map((h) => h.id));
    expect(ids.size).toBe(v.length);
  });
  it("returns empty for empty topic", () => {
    expect(generateHookVariants("", "tiktok", "casual")).toEqual([]);
  });
  it("energetic tone opens with 'Stop scrolling'", () => {
    const v = generateHookVariants("Excel tips", "tiktok", "energetic");
    expect(v[0].text).toContain("Stop scrolling");
  });
});

describe("ai-video-script-outliner generateCta", () => {
  it("generates a short-form CTA", () => {
    const cta = generateCta("Excel tips", "tiktok", "casual");
    expect(cta.length).toBeGreaterThan(10);
  });
  it("generates a long-form CTA mentioning subscribe", () => {
    const cta = generateCta("Podcasting", "youtube-long", "casual");
    expect(cta.toLowerCase()).toContain("subscribe");
  });
  it("generates an explainer CTA with link reference", () => {
    const cta = generateCta("Index funds", "explainer", "professional");
    expect(cta.toLowerCase()).toContain("description");
  });
});

describe("ai-video-script-outliner generateRetentionTips", () => {
  it("returns tips for long-form", () => {
    const tips = generateRetentionTips("youtube-long");
    expect(tips.length).toBeGreaterThanOrEqual(3);
    expect(tips.some((t) => t.includes("8 second") || t.includes("algorithm"))).toBe(true);
  });
  it("returns tips for short-form", () => {
    const tips = generateRetentionTips("tiktok");
    expect(tips.some((t) => t.includes("3 second") || t.includes("muted"))).toBe(true);
  });
  it("returns tips for explainer", () => {
    const tips = generateRetentionTips("explainer");
    expect(tips.length).toBeGreaterThanOrEqual(2);
  });
});

describe("ai-video-script-outliner generateScript", () => {
  it("generates a long-form script with the right scenes", () => {
    const s = generateScript("How to start a podcast", "youtube-long", "casual", "medium");
    expect(s).not.toBeNull();
    expect(s!.scenes.length).toBeGreaterThanOrEqual(6);
    expect(s!.scenes.length).toBeLessThanOrEqual(8);
  });
  it("generates a short-form script with 5 scenes", () => {
    const s = generateScript("Excel tips", "tiktok", "energetic", "short");
    expect(s).not.toBeNull();
    expect(s!.scenes).toHaveLength(5);
  });
  it("generates an explainer script with 6 scenes", () => {
    const s = generateScript("Index funds explained", "explainer", "educational", "medium");
    expect(s).not.toBeNull();
    expect(s!.scenes).toHaveLength(6);
  });
  it("scenes have ascending timestamps", () => {
    const s = generateScript("Podcasting", "youtube-long", "casual", "medium")!;
    for (let i = 1; i < s.scenes.length; i++) {
      expect(s.scenes[i].startSeconds).toBeGreaterThanOrEqual(s.scenes[i - 1].endSeconds);
    }
  });
  it("scenes have non-empty talking points, on-screen text, and B-roll cues", () => {
    const s = generateScript("Podcasting", "youtube-long", "casual", "medium")!;
    for (const sc of s.scenes) {
      expect(sc.talkingPoints.length).toBeGreaterThan(0);
      expect(sc.onScreenText.length).toBeGreaterThan(0);
      expect(sc.brollCues.length).toBeGreaterThan(0);
    }
  });
  it("computes word estimate from duration", () => {
    const s = generateScript("Podcasting", "youtube-long", "casual", "medium", 150)!;
    expect(s.wordEstimate).toBeGreaterThan(0);
  });
  it("returns null for empty topic", () => {
    expect(generateScript("", "youtube-long", "casual", "medium")).toBeNull();
  });
  it("uses platform-specific duration", () => {
    const long = generateScript("X", "youtube-long", "casual", "medium")!;
    const short = generateScript("X", "tiktok", "casual", "medium")!;
    expect(long.targetSeconds).toBeGreaterThan(short.targetSeconds);
  });
});

describe("ai-video-script-outliner chooseHook / getChosenHook", () => {
  it("chooseHook returns a new script with the chosen hook", () => {
    const s = generateScript("Podcasting", "youtube-long", "casual", "medium")!;
    const firstId = s.chosenHookId;
    const secondId = s.hookVariants[1].id;
    const next = chooseHook(s, secondId);
    expect(next.chosenHookId).toBe(secondId);
    expect(next.chosenHookId).not.toBe(firstId);
  });
  it("chooseHook ignores unknown ids", () => {
    const s = generateScript("Podcasting", "youtube-long", "casual", "medium")!;
    const next = chooseHook(s, "does-not-exist");
    expect(next.chosenHookId).toBe(s.chosenHookId);
  });
  it("getChosenHook returns the chosen variant", () => {
    const s = generateScript("Podcasting", "youtube-long", "casual", "medium")!;
    const hook = getChosenHook(s);
    expect(hook).toBeDefined();
    expect(hook!.id).toBe(s.chosenHookId);
  });
});

describe("ai-video-script-outliner repurposeToShorts", () => {
  it("returns 3 shorts from a long-form script", () => {
    const s = generateScript("Podcasting", "youtube-long", "casual", "medium")!;
    const shorts = repurposeToShorts(s);
    expect(shorts).toHaveLength(3);
    expect(shorts.every((x) => x.hook.length > 0 && x.beat.length > 0)).toBe(true);
  });
  it("returns 1 short from a short-form script", () => {
    const s = generateScript("Excel tips", "tiktok", "casual", "short")!;
    const shorts = repurposeToShorts(s);
    expect(shorts.length).toBeGreaterThanOrEqual(1);
  });
  it("returns empty for a script with no scenes", () => {
    const empty = {
      ...generateScript("X", "youtube-long", "casual", "medium")!,
      scenes: [],
    };
    expect(repurposeToShorts(empty)).toEqual([]);
  });
});

describe("ai-video-script-outliner planSeries", () => {
  it("plans a 3-episode series", () => {
    const eps = planSeries("Habit formation", "youtube-long", "educational");
    expect(eps).toHaveLength(3);
    expect(eps[0].episode).toBe(1);
    expect(eps[2].episode).toBe(3);
    expect(eps.every((e) => e.title.length > 0 && e.hook.length > 0)).toBe(true);
  });
  it("returns empty for empty topic", () => {
    expect(planSeries("", "youtube-long", "casual")).toEqual([]);
  });
});

describe("ai-video-script-outliner computeStats", () => {
  it("computes summary stats", () => {
    const s = generateScript("Podcasting", "youtube-long", "casual", "medium")!;
    const stats = computeStats(s);
    expect(stats.totalScenes).toBe(s.scenes.length);
    expect(stats.totalTalkingPoints).toBeGreaterThan(0);
    expect(stats.totalOnScreenText).toBeGreaterThan(0);
    expect(stats.totalBrollCues).toBeGreaterThan(0);
    expect(stats.totalSeconds).toBeGreaterThan(0);
    expect(stats.wordEstimate).toBeGreaterThan(0);
    expect(stats.hookVariantCount).toBeGreaterThanOrEqual(3);
  });
});

describe("ai-video-script-outliner rendering", () => {
  const script = generateScript("Podcasting", "youtube-long", "casual", "medium")!;

  it("renderMarkdown contains the topic, hook, and CTA", () => {
    const md = renderMarkdown(script);
    expect(md).toContain("Video Script: Podcasting");
    expect(md).toContain("## Hook");
    expect(md).toContain("## Scenes");
    expect(md).toContain("## CTA");
    expect(md).toContain("Retention-curve tips");
  });
  it("renderTeleprompter is uppercase and bracketed", () => {
    const tp = renderTeleprompter(script);
    expect(tp).toContain("==="); // header marker
    expect(tp).toContain("[HOOK");
    expect(tp).toContain("[CTA");
  });
  it("renderText contains platform label and CTA", () => {
    const txt = renderText(script);
    expect(txt).toContain("VIDEO SCRIPT");
    expect(txt).toContain("YouTube long-form");
    expect(txt).toContain("CTA:");
  });
  it("renderJson is valid JSON", () => {
    const json = renderJson(script);
    const parsed = JSON.parse(json);
    expect(parsed.topic).toBe(script.topic);
    expect(parsed.scenes.length).toBe(script.scenes.length);
  });
  it("renderMarkdown includes on-screen text in backticks", () => {
    const md = renderMarkdown(script);
    expect(md).toContain("`");
  });
});

describe("ai-video-script-outliner history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, topic: "Podcasting", platform: "youtube-long",
      tone: "casual", length: "medium", targetSeconds: 720, sceneCount: 7,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, topic: `t${i}`, platform: "tiktok",
        tone: "casual", length: "short", targetSeconds: 30, sceneCount: 5,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, topic: "x", platform: "tiktok",
      tone: "casual", length: "short", targetSeconds: 30, sceneCount: 5,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-video-script-outliner shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      topic: "Excel tips",
      platform: "tiktok",
      tone: "energetic",
      length: "short",
      wpm: 160,
    });
    expect(url).toContain("topic=Excel+tips");
    expect(url).toContain("platform=tiktok");
    expect(url).toContain("tone=energetic");
    expect(url).toContain("length=short");
    expect(url).toContain("wpm=160");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("topic=Excel+tips&platform=tiktok&tone=energetic&length=short&wpm=160");
    expect(p.topic).toBe("Excel tips");
    expect(p.platform).toBe("tiktok");
    expect(p.tone).toBe("energetic");
    expect(p.length).toBe("short");
    expect(p.wpm).toBe(160);
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.topic).toBe("");
    expect(p.platform).toBe("youtube-long");
    expect(p.tone).toBe("casual");
    expect(p.length).toBe("medium");
    expect(p.wpm).toBe(DEFAULT_WPM);
  });
  it("filters unknown enum values", () => {
    const p = parseShareUrl("topic=x&platform=bad&tone=bad&length=bad&wpm=9999");
    expect(p.platform).toBe("youtube-long");
    expect(p.tone).toBe("casual");
    expect(p.length).toBe("medium");
    expect(p.wpm).toBe(DEFAULT_WPM);
  });
  it("falls back to default wpm for non-numeric values", () => {
    const p = parseShareUrl("topic=x&wpm=abc");
    expect(p.wpm).toBe(DEFAULT_WPM);
  });
});

describe("ai-video-script-outliner LLM prompt", () => {
  it("builds a system + user prompt", () => {
    const p = buildLlmPrompt("Excel tips", "tiktok", "energetic", "short", 160);
    expect(p.system).toContain("video scriptwriter");
    expect(p.system).toContain("TikTok");
    expect(p.system).toContain("energetic");
    expect(p.user).toContain("Excel tips");
  });
  it("renderLlmResult trims whitespace", () => {
    expect(renderLlmResult("  hello  ")).toBe("hello");
  });
});

// Suppress unused-import lint
export type _Unused = Platform | Tone | LengthPreset;
