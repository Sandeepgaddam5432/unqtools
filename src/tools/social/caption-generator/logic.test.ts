import { describe, it, expect, beforeEach } from "vitest";
import {
  MOODS,
  CAPTION_LENGTHS,
  PLATFORMS,
  MOOD_LABELS,
  CAPTION_LENGTH_LABELS,
  PLATFORM_LABELS,
  PLATFORM_CONFIGS,
  MOOD_EMOJIS,
  CAPTION_TEMPLATES,
  HOOK_TEMPLATES,
  normalizeText,
  parseImageDescription,
  capitalize,
  extractKeywords,
  generateHashtags,
  generateHook,
  generateBody,
  generateCTA,
  generateEmojis,
  validateCaptionLength,
  truncateToLimit,
  composeCaption,
  countEmojis,
  countHashtags,
  countWords,
  generateCaption,
  generateVariations,
  computeSummaryStats,
  splitFirstComment,
  renderComponents,
  renderText,
  renderCsv,
  splitCsvRow,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Mood,
  type CaptionLength,
  type Platform,
  type CaptionInput,
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

describe("caption-generator constants", () => {
  it("has 8 moods", () => {
    expect(MOODS).toHaveLength(8);
    expect(MOODS).toContain("happy");
    expect(MOODS).toContain("adventurous");
  });
  it("has 3 caption lengths", () => {
    expect(CAPTION_LENGTHS).toHaveLength(3);
    expect(CAPTION_LENGTHS).toEqual(["short", "medium", "long"]);
  });
  it("has 4 platforms", () => {
    expect(PLATFORMS).toHaveLength(4);
    expect(PLATFORMS).toContain("instagram");
    expect(PLATFORMS).toContain("pinterest");
  });
  it("has 8 mood labels", () => {
    expect(Object.keys(MOOD_LABELS)).toHaveLength(8);
  });
  it("has 3 caption-length labels", () => {
    expect(Object.keys(CAPTION_LENGTH_LABELS)).toHaveLength(3);
  });
  it("has 4 platform labels", () => {
    expect(Object.keys(PLATFORM_LABELS)).toHaveLength(4);
  });
  it("has 4 platform configs with char limits", () => {
    expect(Object.keys(PLATFORM_CONFIGS)).toHaveLength(4);
    expect(PLATFORM_CONFIGS.instagram.maxChars).toBe(2200);
    expect(PLATFORM_CONFIGS.pinterest.maxChars).toBe(500);
    expect(PLATFORM_CONFIGS.tiktok.cta).toContain("Follow");
  });
  it("has 8 mood emoji sets with at least 3 emojis each", () => {
    expect(Object.keys(MOOD_EMOJIS)).toHaveLength(8);
    for (const m of MOODS) {
      expect(MOOD_EMOJIS[m].length).toBeGreaterThanOrEqual(3);
    }
  });
  it("has 70+ caption templates total (8 moods × 3 lengths × 3)", () => {
    let total = 0;
    for (const m of MOODS) {
      for (const l of CAPTION_LENGTHS) {
        expect(CAPTION_TEMPLATES[m][l].length).toBeGreaterThanOrEqual(3);
        total += CAPTION_TEMPLATES[m][l].length;
      }
    }
    expect(total).toBeGreaterThanOrEqual(72);
  });
  it("templates contain {topic} placeholder", () => {
    const tpl = CAPTION_TEMPLATES.happy.short[0];
    expect(tpl).toContain("{topic}");
  });
  it("has 3 hook templates", () => {
    expect(HOOK_TEMPLATES).toHaveLength(3);
    expect(HOOK_TEMPLATES.map((h) => h.hook)).toEqual(["question", "statement", "story"]);
  });
});

describe("caption-generator normalizeText", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeText("  hello   world  ")).toBe("hello world");
  });
  it("handles empty", () => {
    expect(normalizeText("")).toBe("");
  });
});

describe("caption-generator parseImageDescription", () => {
  it("normalizes the description", () => {
    expect(parseImageDescription("  a sunny beach day  ")).toBe("a sunny beach day");
  });
});

describe("caption-generator capitalize", () => {
  it("capitalizes first letter", () => {
    expect(capitalize("hello")).toBe("Hello");
  });
  it("handles empty", () => {
    expect(capitalize("")).toBe("");
  });
});

describe("caption-generator extractKeywords", () => {
  it("extracts keywords skipping stop words", () => {
    const kw = extractKeywords("A beautiful sunset over the mountains");
    expect(kw).toContain("beautiful");
    expect(kw).toContain("sunset");
    expect(kw).toContain("mountains");
    expect(kw).not.toContain("the");
    expect(kw).not.toContain("over");
  });
  it("returns empty for empty text", () => {
    expect(extractKeywords("")).toEqual([]);
  });
  it("filters out short words (<=2 chars)", () => {
    const kw = extractKeywords("a cat on the mat");
    expect(kw).toContain("cat");
    expect(kw).toContain("mat"); // 3 chars — kept
    expect(kw).not.toContain("on"); // 2 chars — filtered
  });
});

describe("caption-generator generateHashtags", () => {
  it("generates the requested number of hashtags", () => {
    const tags = generateHashtags("sunny beach day", 10);
    expect(tags).toHaveLength(10);
    expect(tags.every((t) => t.startsWith("#"))).toBe(true);
  });
  it("includes a joined hashtag", () => {
    const tags = generateHashtags("sunny beach", 5);
    expect(tags.some((t) => t === "#sunnybeach")).toBe(true);
  });
  it("returns empty for count 0", () => {
    expect(generateHashtags("anything", 0)).toEqual([]);
  });
  it("pads with generic hashtags when keywords are few", () => {
    const tags = generateHashtags("hi", 15);
    expect(tags).toHaveLength(15);
  });
});

describe("caption-generator generateHook", () => {
  it("generates a question hook for variation 1", () => {
    const h = generateHook("happy", "morning coffee", 1);
    expect(h).toContain("?");
    expect(h.toLowerCase()).toContain("morning coffee");
  });
  it("generates a statement hook for variation 2", () => {
    const h = generateHook("happy", "morning coffee", 2);
    expect(h.length).toBeGreaterThan(0);
  });
  it("generates a story hook for variation 3", () => {
    const h = generateHook("happy", "morning coffee", 3);
    expect(h.toLowerCase()).toContain("started");
  });
  it("falls back to default topic when description is empty", () => {
    const h = generateHook("happy", "", 1);
    expect(h.length).toBeGreaterThan(0);
  });
});

describe("caption-generator generateBody", () => {
  it("fills {topic} with image description", () => {
    const body = generateBody("happy", "short", "morning coffee", 1);
    expect(body.toLowerCase()).toContain("morning coffee");
    expect(body).not.toContain("{topic}");
  });
  it("uses the template for the mood+length combo", () => {
    const body = generateBody("motivational", "short", "shipping the project", 1);
    expect(body.toLowerCase()).toContain("shipping the project");
  });
});

describe("caption-generator generateCTA", () => {
  it("returns platform CTA when enabled", () => {
    const cta = generateCTA("instagram", true);
    expect(cta).toContain("Link in bio");
  });
  it("returns empty when disabled", () => {
    expect(generateCTA("instagram", false)).toBe("");
  });
  it("returns different CTAs per platform", () => {
    expect(generateCTA("tiktok", true)).not.toBe(generateCTA("facebook", true));
  });
});

describe("caption-generator generateEmojis", () => {
  it("returns emojis when enabled", () => {
    const e = generateEmojis("happy", true);
    expect(e.length).toBeGreaterThan(0);
  });
  it("returns empty when disabled", () => {
    expect(generateEmojis("happy", false)).toBe("");
  });
});

describe("caption-generator validateCaptionLength", () => {
  it("returns true when within limit", () => {
    expect(validateCaptionLength("instagram", "short caption")).toBe(true);
  });
  it("returns false when over limit", () => {
    const long = "a".repeat(3000);
    expect(validateCaptionLength("pinterest", long)).toBe(false);
  });
});

describe("caption-generator truncateToLimit", () => {
  it("returns text unchanged when within limit", () => {
    expect(truncateToLimit("hello world", 100)).toBe("hello world");
  });
  it("truncates with ellipsis when over limit", () => {
    const out = truncateToLimit("hello world this is a long sentence", 15);
    expect(out.length).toBeLessThanOrEqual(15);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("caption-generator composeCaption", () => {
  it("joins non-empty components with blank lines", () => {
    const out = composeCaption("hook", "body", "cta", "🙂", ["#a", "#b"], true);
    expect(out).toContain("hook");
    expect(out).toContain("body");
    expect(out).toContain("cta");
    expect(out).toContain("🙂");
    expect(out).toContain("#a #b");
  });
  it("omits hashtags when includeHashtags is false", () => {
    const out = composeCaption("hook", "body", "cta", "", ["#a"], false);
    expect(out).not.toContain("#a");
  });
});

describe("caption-generator counters", () => {
  it("counts emojis", () => {
    expect(countEmojis("hello 😊🎉 world")).toBe(2);
    expect(countEmojis("no emojis here")).toBe(0);
  });
  it("counts hashtags", () => {
    expect(countHashtags("#hello world #foo")).toBe(2);
    expect(countHashtags("no hashtags")).toBe(0);
  });
  it("counts words", () => {
    expect(countWords("hello world foo")).toBe(3);
    expect(countWords("")).toBe(0);
  });
});

describe("caption-generator generateCaption", () => {
  const input: CaptionInput = {
    imageDescription: "morning coffee by the window",
    mood: "cozy",
    captionLength: "medium",
    includeEmojis: true,
    includeCTA: true,
    includeHashtags: true,
    platform: "instagram",
  };
  it("generates a full caption with all fields", () => {
    const c = generateCaption(input, 1);
    expect(c.variation).toBe(1);
    expect(c.hook.length).toBeGreaterThan(0);
    expect(c.body.length).toBeGreaterThan(0);
    expect(c.cta).toContain("Link in bio");
    expect(c.fullCaption.length).toBeGreaterThan(0);
    expect(c.charCount).toBe(c.fullCaption.length);
    expect(c.hashtagCount).toBe(PLATFORM_CONFIGS.instagram.hashtagCount);
  });
  it("respects includeHashtags=false", () => {
    const c = generateCaption({ ...input, includeHashtags: false }, 1);
    expect(c.hashtags).toEqual([]);
    expect(c.hashtagCount).toBe(0);
  });
  it("respects includeCTA=false", () => {
    const c = generateCaption({ ...input, includeCTA: false }, 1);
    expect(c.cta).toBe("");
  });
  it("respects includeEmojis=false", () => {
    const c = generateCaption({ ...input, includeEmojis: false }, 1);
    expect(c.emojis).toBe("");
  });
});

describe("caption-generator generateVariations", () => {
  it("generates 3 variations", () => {
    const input: CaptionInput = {
      imageDescription: "morning coffee",
      mood: "cozy",
      captionLength: "short",
      includeEmojis: true,
      includeCTA: true,
      includeHashtags: true,
      platform: "tiktok",
    };
    const vs = generateVariations(input);
    expect(vs).toHaveLength(3);
    expect(vs.map((v) => v.variation)).toEqual([1, 2, 3]);
  });
});

describe("caption-generator computeSummaryStats", () => {
  it("computes stats across variations", () => {
    const input: CaptionInput = {
      imageDescription: "morning coffee",
      mood: "happy",
      captionLength: "medium",
      includeEmojis: true,
      includeCTA: true,
      includeHashtags: true,
      platform: "instagram",
    };
    const stats = computeSummaryStats(generateVariations(input));
    expect(stats.totalVariations).toBe(3);
    expect(stats.avgChars).toBeGreaterThan(0);
    expect(stats.avgHashtags).toBeGreaterThan(0);
    expect(stats.withinLimitCount).toBe(3);
  });
  it("returns zeros for empty input", () => {
    const stats = computeSummaryStats([]);
    expect(stats.totalVariations).toBe(0);
    expect(stats.avgChars).toBe(0);
  });
});

describe("caption-generator splitFirstComment", () => {
  it("splits caption and hashtags when hashtags exist", () => {
    const input: CaptionInput = {
      imageDescription: "sunset beach",
      mood: "happy",
      captionLength: "short",
      includeEmojis: false,
      includeCTA: false,
      includeHashtags: true,
      platform: "instagram",
    };
    const c = generateCaption(input, 1);
    const split = splitFirstComment(c);
    expect(split.firstComment.length).toBeGreaterThan(0);
    expect(split.firstComment.split(" ").length).toBe(c.hashtags.length);
  });
  it("returns empty firstComment when no hashtags", () => {
    const input: CaptionInput = {
      imageDescription: "sunset beach",
      mood: "happy",
      captionLength: "short",
      includeEmojis: false,
      includeCTA: false,
      includeHashtags: false,
      platform: "instagram",
    };
    const c = generateCaption(input, 1);
    const split = splitFirstComment(c);
    expect(split.firstComment).toBe("");
  });
});

describe("caption-generator renderComponents", () => {
  it("renders 12 components", () => {
    const input: CaptionInput = {
      imageDescription: "sunset",
      mood: "happy",
      captionLength: "short",
      includeEmojis: true,
      includeCTA: true,
      includeHashtags: true,
      platform: "instagram",
    };
    const comps = renderComponents(generateCaption(input, 1));
    expect(comps).toHaveLength(12);
    expect(comps.map((c) => c.key)).toContain("hook");
    expect(comps.map((c) => c.key)).toContain("full_caption");
  });
});

describe("caption-generator renderText", () => {
  it("renders variations with header", () => {
    const input: CaptionInput = {
      imageDescription: "sunset",
      mood: "happy",
      captionLength: "short",
      includeEmojis: true,
      includeCTA: true,
      includeHashtags: true,
      platform: "instagram",
    };
    const text = renderText(generateVariations(input));
    expect(text).toContain("=== Variation 1 ===");
    expect(text).toContain("=== Variation 2 ===");
    expect(text).toContain("Chars:");
  });
  it("returns empty for empty input", () => {
    expect(renderText([])).toBe("");
  });
});

describe("caption-generator renderCsv", () => {
  it("renders header for empty input", () => {
    expect(renderCsv([])).toContain("variation,component,value");
  });
  it("renders rows for each component per variation", () => {
    const input: CaptionInput = {
      imageDescription: "sunset",
      mood: "happy",
      captionLength: "short",
      includeEmojis: true,
      includeCTA: true,
      includeHashtags: true,
      platform: "instagram",
    };
    const csv = renderCsv([generateCaption(input, 1)]);
    // CSV may contain embedded newlines inside quoted values, so count rows
    // that begin with "1," (the variation number).
    const dataRows = csv.split("\n").filter((r) => r.startsWith("1,"));
    // 12 components per variation
    expect(dataRows).toHaveLength(12);
    expect(csv.split("\n")[0]).toBe("variation,component,value");
  });
});

describe("caption-generator splitCsvRow", () => {
  it("splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
});

describe("caption-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      imageDescription: "test",
      mood: "happy",
      captionLength: "short",
      platform: "instagram",
      variationCount: 3,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        imageDescription: `test-${i}`,
        mood: "happy",
        captionLength: "short",
        platform: "instagram",
        variationCount: 3,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      imageDescription: "test",
      mood: "happy",
      captionLength: "short",
      platform: "instagram",
      variationCount: 3,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("caption-generator shareable URL", () => {
  const input: CaptionInput = {
    imageDescription: "morning coffee",
    mood: "cozy",
    captionLength: "medium",
    includeEmojis: true,
    includeCTA: true,
    includeHashtags: true,
    platform: "instagram",
  };
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(input);
    expect(url).toContain("img=morning+coffee");
    expect(url).toContain("mood=cozy");
    expect(url).toContain("len=medium");
    expect(url).toContain("plat=instagram");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = buildShareUrl(input);
    const hash = url.includes("#") ? url.slice(url.indexOf("#") + 1) : url.replace(/^\?/, "");
    const parsed = parseShareUrl(hash);
    expect(parsed.imageDescription).toBe("morning coffee");
    expect(parsed.mood).toBe("cozy");
    expect(parsed.captionLength).toBe("medium");
    expect(parsed.platform).toBe("instagram");
  });
  it("returns defaults for empty hash", () => {
    const parsed = parseShareUrl("");
    expect(parsed.mood).toBe("happy");
    expect(parsed.captionLength).toBe("medium");
    expect(parsed.platform).toBe("instagram");
    expect(parsed.includeEmojis).toBe(true);
  });
  it("filters unknown mood", () => {
    const parsed = parseShareUrl("mood=unknown&img=hi");
    expect(parsed.mood).toBe("happy"); // default fallback
  });
});

// Suppress unused-import lint
export type _Unused = Mood | CaptionLength | Platform;
