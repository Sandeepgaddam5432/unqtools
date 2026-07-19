import { describe, it, expect, beforeEach } from "vitest";
import {
  VIDEO_STYLES,
  TARGET_AUDIENCES,
  STYLE_LABELS,
  AUDIENCE_LABELS,
  STYLE_OPENERS,
  STYLE_EMOJIS,
  STYLE_CTA,
  STYLE_HOOKS,
  TRENDING_SOUNDS,
  NICHE_HASHTAGS,
  TRENDING_HASHTAGS,
  BRANDED_HASHTAGS,
  BEST_POST_TIMES,
  MAX_CHARS,
  OPTIMAL_MIN,
  OPTIMAL_MAX,
  normalizeTopic,
  pickAt,
  generateOpener,
  generateHook,
  generateHashtags,
  suggestTrendingSounds,
  generateCTA,
  appendEmojis,
  generateBody,
  generateDescription,
  generateVariations,
  validateCharCount,
  scoreViralPotential,
  suggestBestPostTime,
  computeSummaryStats,
  renderText,
  renderTextAll,
  renderCsv,
  renderCsvAll,
  splitCsvRow,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type VideoStyle,
  type TargetAudience,
  type TikTokInput,
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

describe("tiktok constants", () => {
  it("has 8 video styles", () => {
    expect(VIDEO_STYLES).toHaveLength(8);
    expect(VIDEO_STYLES).toContain("dance");
    expect(VIDEO_STYLES).toContain("trend");
  });
  it("has 5 target audiences", () => {
    expect(TARGET_AUDIENCES).toHaveLength(5);
    expect(TARGET_AUDIENCES).toContain("gen-z");
    expect(TARGET_AUDIENCES).toContain("all-ages");
  });
  it("has labels for every style", () => {
    expect(Object.keys(STYLE_LABELS)).toHaveLength(8);
    for (const s of VIDEO_STYLES) {
      expect(STYLE_LABELS[s]).toBeTruthy();
    }
  });
  it("has labels for every audience", () => {
    expect(Object.keys(AUDIENCE_LABELS)).toHaveLength(5);
    for (const a of TARGET_AUDIENCES) {
      expect(AUDIENCE_LABELS[a]).toBeTruthy();
    }
  });
  it("has 3+ openers per style", () => {
    for (const s of VIDEO_STYLES) {
      expect(STYLE_OPENERS[s].length).toBeGreaterThanOrEqual(3);
    }
  });
  it("has 3+ CTAs per style", () => {
    for (const s of VIDEO_STYLES) {
      expect(STYLE_CTA[s].length).toBeGreaterThanOrEqual(3);
    }
  });
  it("has 3+ hooks per style", () => {
    for (const s of VIDEO_STYLES) {
      expect(STYLE_HOOKS[s].length).toBeGreaterThanOrEqual(3);
    }
  });
  it("has emoji pool per style", () => {
    for (const s of VIDEO_STYLES) {
      expect(Array.from(STYLE_EMOJIS[s]).length).toBeGreaterThanOrEqual(3);
    }
  });
  it("has 50+ trending sounds total", () => {
    const total = Object.values(TRENDING_SOUNDS).reduce((s, l) => s + l.length, 0);
    expect(total).toBeGreaterThanOrEqual(50);
  });
  it("has 6+ sounds per style", () => {
    for (const s of VIDEO_STYLES) {
      expect(TRENDING_SOUNDS[s].length).toBeGreaterThanOrEqual(6);
    }
  });
  it("has hashtag pools", () => {
    expect(TRENDING_HASHTAGS.length).toBeGreaterThanOrEqual(8);
    expect(BRANDED_HASHTAGS.length).toBeGreaterThanOrEqual(3);
    for (const s of VIDEO_STYLES) {
      expect(NICHE_HASHTAGS[s].length).toBeGreaterThanOrEqual(3);
    }
  });
  it("has 5+ best post times", () => {
    expect(BEST_POST_TIMES.length).toBeGreaterThanOrEqual(5);
  });
  it("has correct char limits", () => {
    expect(MAX_CHARS).toBe(2200);
    expect(OPTIMAL_MIN).toBe(150);
    expect(OPTIMAL_MAX).toBe(300);
  });
});

describe("tiktok normalizeTopic", () => {
  it("collapses whitespace", () => {
    expect(normalizeTopic("  Easy   Pasta   ")).toBe("Easy Pasta");
  });
  it("handles empty", () => {
    expect(normalizeTopic("")).toBe("");
  });
  it("handles null/undefined input gracefully", () => {
    expect(normalizeTopic(null as unknown as string)).toBe("");
  });
});

describe("tiktok pickAt", () => {
  it("returns element at modulo index", () => {
    expect(pickAt(["a", "b", "c"], 0)).toBe("a");
    expect(pickAt(["a", "b", "c"], 4)).toBe("b");
  });
  it("handles negative indices", () => {
    expect(pickAt(["a", "b", "c"], -1)).toBe("c");
  });
  it("throws on empty array", () => {
    expect(() => pickAt([], 0)).toThrow();
  });
});

describe("tiktok generateOpener", () => {
  it("returns opener for the given style", () => {
    const o = generateOpener("dance", 0);
    expect(STYLE_OPENERS["dance"]).toContain(o);
  });
  it("cycles for variation idx", () => {
    const o0 = generateOpener("comedy", 0);
    const o1 = generateOpener("comedy", 1);
    expect(o0).not.toBe(o1);
  });
});

describe("tiktok generateHook", () => {
  it("appends topic when present", () => {
    const h = generateHook("tutorial", "How to make sourdough", 0);
    expect(h.length).toBeGreaterThan(0);
    expect(h.toLowerCase()).toContain("how to make sourdough".toLowerCase());
  });
  it("returns template alone when no topic", () => {
    const h = generateHook("dance", "", 0);
    expect(STYLE_HOOKS["dance"]).toContain(h);
  });
});

describe("tiktok generateHashtags", () => {
  it("returns 3-5 hashtags", () => {
    const tags = generateHashtags("dance", "gen-z", "dance routine", 0);
    expect(tags.length).toBeGreaterThanOrEqual(3);
    expect(tags.length).toBeLessThanOrEqual(5);
  });
  it("includes a trending hashtag", () => {
    const tags = generateHashtags("comedy", "millennials", "funny cats", 0);
    const trendingMatch = tags.some((t) => TRENDING_HASHTAGS.includes(t));
    expect(trendingMatch).toBe(true);
  });
  it("includes a niche hashtag for the style", () => {
    const tags = generateHashtags("tutorial", "gen-z", "excel tips", 0);
    const nicheMatch = tags.some((t) => NICHE_HASHTAGS["tutorial"].includes(t));
    expect(nicheMatch).toBe(true);
  });
  it("includes audience tag", () => {
    const tags = generateHashtags("challenge", "gen-alpha", "plank", 0);
    expect(tags).toContain("genalpha");
  });
  it("dedupes hashtags", () => {
    const tags = generateHashtags("trend", "gen-z", "", 0);
    expect(new Set(tags).size).toBe(tags.length);
  });
});

describe("tiktok suggestTrendingSounds", () => {
  it("returns 3 sounds", () => {
    const sounds = suggestTrendingSounds("dance", 0);
    expect(sounds).toHaveLength(3);
  });
  it("returns sounds from the style pool", () => {
    const sounds = suggestTrendingSounds("comedy", 1);
    for (const s of sounds) {
      expect(TRENDING_SOUNDS["comedy"]).toContain(s);
    }
  });
});

describe("tiktok generateCTA", () => {
  it("returns a CTA for the style", () => {
    const c = generateCTA("challenge", 0);
    expect(STYLE_CTA["challenge"]).toContain(c);
  });
  it("cycles for variations", () => {
    const a = generateCTA("tutorial", 0);
    const b = generateCTA("tutorial", 1);
    expect(a).not.toBe(b);
  });
});

describe("tiktok appendEmojis", () => {
  it("returns 2 emojis", () => {
    const e = appendEmojis("dance", 0);
    expect(Array.from(e)).toHaveLength(2);
  });
});

describe("tiktok generateBody", () => {
  it("uses topic when present", () => {
    const b = generateBody("5am Morning Routine", "day-in-life", "millennials");
    expect(b.toLowerCase()).toContain("5am morning routine".toLowerCase());
  });
  it("uses fallback when topic is empty", () => {
    const b = generateBody("", "comedy", "gen-z");
    expect(b.toLowerCase()).toContain("comedy");
  });
});

describe("tiktok generateDescription", () => {
  const input: TikTokInput = {
    videoTopic: "Easy 5-Minute Pasta Recipe",
    videoStyle: "tutorial",
    targetAudience: "gen-z",
    includeTrendingSounds: true,
    includeHashtags: true,
    includeCTA: true,
  };
  it("assembles a full description", () => {
    const d = generateDescription(input, 1);
    expect(d.variation).toBe(1);
    expect(d.fullDescription).toContain(d.opener);
    expect(d.fullDescription).toContain(d.hook);
    expect(d.fullDescription).toContain(d.body);
    expect(d.fullDescription).toContain(d.cta);
    expect(d.hashtags.length).toBeGreaterThan(0);
    expect(d.trendingSounds).toHaveLength(3);
    expect(d.charCount).toBeGreaterThan(0);
    expect(d.wordCount).toBeGreaterThan(0);
  });
  it("respects includeCTA=false", () => {
    const d = generateDescription({ ...input, includeCTA: false }, 1);
    expect(d.cta).toBe("");
    expect(d.fullDescription).not.toContain("Duet");
  });
  it("respects includeHashtags=false", () => {
    const d = generateDescription({ ...input, includeHashtags: false }, 1);
    expect(d.hashtags).toEqual([]);
    expect(d.fullDescription).not.toMatch(/#[a-z]/i);
  });
  it("respects includeTrendingSounds=false", () => {
    const d = generateDescription({ ...input, includeTrendingSounds: false }, 1);
    expect(d.trendingSounds).toEqual([]);
  });
  it("computes charCount correctly", () => {
    const d = generateDescription(input, 1);
    expect(d.charCount).toBe(Array.from(d.fullDescription).length);
  });
  it("emojiCount > 0", () => {
    const d = generateDescription(input, 1);
    expect(d.emojiCount).toBeGreaterThan(0);
  });
});

describe("tiktok generateVariations", () => {
  const input: TikTokInput = {
    videoTopic: "Day in NYC",
    videoStyle: "day-in-life",
    targetAudience: "millennials",
    includeTrendingSounds: true,
    includeHashtags: true,
    includeCTA: true,
  };
  it("generates 3 variations", () => {
    const v = generateVariations(input);
    expect(v).toHaveLength(3);
    expect(v[0].variation).toBe(1);
    expect(v[1].variation).toBe(2);
    expect(v[2].variation).toBe(3);
  });
  it("returns empty when no topic", () => {
    expect(generateVariations({ ...input, videoTopic: "" })).toEqual([]);
  });
  it("variations differ", () => {
    const v = generateVariations(input);
    expect(v[0].opener).not.toBe(v[1].opener);
  });
});

describe("tiktok validateCharCount", () => {
  it("too-short under 150", () => {
    expect(validateCharCount(50)).toBe("too-short");
  });
  it("optimal between 150-300", () => {
    expect(validateCharCount(200)).toBe("optimal");
  });
  it("over-optimal between 301-2200", () => {
    expect(validateCharCount(500)).toBe("over-optimal");
  });
  it("too-long over 2200", () => {
    expect(validateCharCount(3000)).toBe("too-long");
  });
});

describe("tiktok scoreViralPotential", () => {
  it("scores within 0-100", () => {
    const input: TikTokInput = {
      videoTopic: "Test Topic",
      videoStyle: "trend",
      targetAudience: "gen-z",
      includeTrendingSounds: true,
      includeHashtags: true,
      includeCTA: true,
    };
    const d = generateDescription(input, 1);
    const s = scoreViralPotential(d);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
  it("higher score with all features on", () => {
    const baseInput: TikTokInput = {
      videoTopic: "Test Topic",
      videoStyle: "trend",
      targetAudience: "gen-z",
      includeTrendingSounds: true,
      includeHashtags: true,
      includeCTA: true,
    };
    const full = generateDescription(baseInput, 1);
    const stripped = generateDescription(
      { ...baseInput, includeTrendingSounds: false, includeHashtags: false, includeCTA: false },
      1,
    );
    expect(scoreViralPotential(full)).toBeGreaterThan(scoreViralPotential(stripped));
  });
});

describe("tiktok suggestBestPostTime", () => {
  it("returns 3 times sorted by score desc", () => {
    const times = suggestBestPostTime();
    expect(times).toHaveLength(3);
    expect(times[0].score).toBeGreaterThanOrEqual(times[1].score);
    expect(times[1].score).toBeGreaterThanOrEqual(times[2].score);
  });
  it("top time has highest score from BEST_POST_TIMES", () => {
    const times = suggestBestPostTime();
    const max = Math.max(...BEST_POST_TIMES.map((t) => t.score));
    expect(times[0].score).toBe(max);
  });
});

describe("tiktok computeSummaryStats", () => {
  it("returns zero-stats for empty", () => {
    const s = computeSummaryStats([]);
    expect(s.totalVariations).toBe(0);
    expect(s.avgChars).toBe(0);
  });
  it("computes averages across variations", () => {
    const input: TikTokInput = {
      videoTopic: "Test Topic",
      videoStyle: "dance",
      targetAudience: "gen-z",
      includeTrendingSounds: true,
      includeHashtags: true,
      includeCTA: true,
    };
    const v = generateVariations(input);
    const s = computeSummaryStats(v);
    expect(s.totalVariations).toBe(3);
    expect(s.avgChars).toBeGreaterThan(0);
    expect(s.avgHashtags).toBeGreaterThan(0);
    expect(s.viralScore).toBeGreaterThan(0);
  });
});

describe("tiktok renderText", () => {
  it("renders full description with components", () => {
    const d = generateDescription(
      {
        videoTopic: "Pasta Recipe",
        videoStyle: "tutorial",
        targetAudience: "gen-z",
        includeTrendingSounds: true,
        includeHashtags: true,
        includeCTA: true,
      },
      1,
    );
    const t = renderText(d);
    expect(t).toContain("Variation 1");
    expect(t).toContain("Hook:");
    expect(t).toContain("Full Description:");
    expect(t).toContain(d.fullDescription);
  });
  it("renderTextAll joins multiple variations", () => {
    const input: TikTokInput = {
      videoTopic: "Test",
      videoStyle: "dance",
      targetAudience: "gen-z",
      includeTrendingSounds: true,
      includeHashtags: true,
      includeCTA: true,
    };
    const v = generateVariations(input);
    const t = renderTextAll(v);
    expect(t).toContain("Variation 1");
    expect(t).toContain("Variation 2");
    expect(t).toContain("Variation 3");
    expect(t).toContain("---");
  });
});

describe("tiktok renderCsv", () => {
  it("renders header + rows", () => {
    const d = generateDescription(
      {
        videoTopic: "Pasta",
        videoStyle: "tutorial",
        targetAudience: "gen-z",
        includeTrendingSounds: true,
        includeHashtags: true,
        includeCTA: true,
      },
      1,
    );
    const csv = renderCsv(d);
    expect(csv).toContain("component,value");
    expect(csv).toContain("variation,1");
    expect(csv).toContain("hook,");
    expect(csv).toContain("full_description,");
  });
  it("renderCsvAll stacks rows", () => {
    const input: TikTokInput = {
      videoTopic: "Test",
      videoStyle: "dance",
      targetAudience: "gen-z",
      includeTrendingSounds: true,
      includeHashtags: true,
      includeCTA: true,
    };
    const v = generateVariations(input);
    const csv = renderCsvAll(v);
    expect(csv.match(/variation,/g)?.length).toBe(3);
  });
});

describe("tiktok splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
});

describe("tiktok history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      videoTopic: "Test",
      videoStyle: "dance",
      targetAudience: "gen-z",
      variationCount: 3,
      viralScore: 80,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        videoTopic: "T",
        videoStyle: "dance",
        targetAudience: "gen-z",
        variationCount: 3,
        viralScore: 80,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      videoTopic: "T",
      videoStyle: "dance",
      targetAudience: "gen-z",
      variationCount: 3,
      viralScore: 80,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("tiktok shareable URL", () => {
  const input: TikTokInput = {
    videoTopic: "Easy Pasta Recipe",
    videoStyle: "tutorial",
    targetAudience: "gen-z",
    includeTrendingSounds: true,
    includeHashtags: false,
    includeCTA: true,
  };
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(input);
    expect(url).toContain("topic=");
    expect(url).toContain("style=tutorial");
    expect(url).toContain("audience=gen-z");
    expect(url).toContain("sounds=true");
    expect(url).toContain("hashtags=false");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(input);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.videoTopic).toBe("Easy Pasta Recipe");
    expect(parsed.videoStyle).toBe("tutorial");
    expect(parsed.targetAudience).toBe("gen-z");
    expect(parsed.includeTrendingSounds).toBe(true);
    expect(parsed.includeHashtags).toBe(false);
    expect(parsed.includeCTA).toBe(true);
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("handles empty hash with defaults", () => {
    const parsed = parseShareUrl("");
    expect(parsed.videoTopic).toBe("");
    expect(parsed.videoStyle).toBe("tutorial");
    expect(parsed.targetAudience).toBe("gen-z");
  });
  it("filters unknown style/audience", () => {
    const parsed = parseShareUrl("topic=t&style=unknown&audience=also-unknown");
    expect(parsed.videoStyle).toBe("tutorial"); // default
    expect(parsed.targetAudience).toBe("gen-z"); // default
  });
});

// Suppress unused-import lint
export type _Unused = VideoStyle | TargetAudience | TikTokInput;
