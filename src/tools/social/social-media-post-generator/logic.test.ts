import { describe, it, expect, beforeEach } from "vitest";
import {
  PLATFORMS,
  TONES,
  AUDIENCES,
  PLATFORM_CONFIGS,
  TONE_PRESETS,
  AUDIENCE_PRESETS,
  HOOK_TEMPLATES,
  PLATFORM_LABELS,
  TONE_LABELS,
  AUDIENCE_LABELS,
  normalizeTopic,
  capitalize,
  parseKeyPoints,
  formatKeyPoints,
  generateHashtags,
  generateCTA,
  applyTone,
  applyAudience,
  applyEmojis,
  buildHook,
  validateCharLimit,
  getCharLimitStatus,
  truncateToLimit,
  generateForPlatform,
  generateVariations,
  generateForPlatforms,
  generateAllVariations,
  computeSummaryStats,
  getBestTimeToPost,
  renderText,
  renderCsv,
  splitCsvRow,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Tone,
  type TargetAudience,
  type Platform,
  type GeneratorInput,
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

const baseInput: GeneratorInput = {
  topic: "JavaScript testing",
  keyPoints: ["Use Vitest", "Mock localStorage", "Run in CI"],
  tone: "professional",
  audience: "developers",
  platforms: ["twitter", "linkedin", "facebook", "instagram", "mastodon"],
  includeHashtags: true,
  includeCTA: true,
  includeEmojis: false,
};

describe("social-media-post-generator constants", () => {
  it("has 5 platforms", () => {
    expect(PLATFORMS).toHaveLength(5);
    expect(PLATFORMS).toContain("twitter");
    expect(PLATFORMS).toContain("mastodon");
  });
  it("has 6 tones", () => {
    expect(TONES).toHaveLength(6);
    expect(TONES).toContain("professional");
    expect(TONES).toContain("humorous");
  });
  it("has 6 audiences", () => {
    expect(AUDIENCES).toHaveLength(6);
    expect(AUDIENCES).toContain("developers");
    expect(AUDIENCES).toContain("students");
  });
  it("has platform configs for all 5 platforms", () => {
    for (const p of PLATFORMS) {
      expect(PLATFORM_CONFIGS[p]).toBeDefined();
      expect(PLATFORM_CONFIGS[p].maxChars).toBeGreaterThan(0);
      expect(PLATFORM_CONFIGS[p].optimalChars).toBeGreaterThan(0);
      expect(PLATFORM_CONFIGS[p].hashtagCount).toBeGreaterThan(0);
      expect(PLATFORM_CONFIGS[p].cta.length).toBeGreaterThan(0);
      expect(PLATFORM_CONFIGS[p].bestTime.length).toBeGreaterThan(0);
    }
  });
  it("enforces Twitter 280 char limit", () => {
    expect(PLATFORM_CONFIGS.twitter.maxChars).toBe(280);
  });
  it("enforces Mastodon 500 char limit", () => {
    expect(PLATFORM_CONFIGS.mastodon.maxChars).toBe(500);
  });
  it("enforces Instagram 2200 char limit", () => {
    expect(PLATFORM_CONFIGS.instagram.maxChars).toBe(2200);
  });
  it("enforces Instagram 10-30 hashtag count", () => {
    expect(PLATFORM_CONFIGS.instagram.hashtagCount).toBeGreaterThanOrEqual(10);
    expect(PLATFORM_CONFIGS.instagram.hashtagCount).toBeLessThanOrEqual(30);
  });
  it("has tone presets for all 6 tones", () => {
    for (const t of TONES) {
      expect(TONE_PRESETS[t]).toBeDefined();
      expect(TONE_PRESETS[t].greeting.length).toBeGreaterThan(0);
      expect(TONE_PRESETS[t].closing.length).toBeGreaterThan(0);
      expect(TONE_PRESETS[t].emojis.length).toBeGreaterThanOrEqual(2);
    }
  });
  it("has audience presets for all 6 audiences", () => {
    for (const a of AUDIENCES) {
      expect(AUDIENCE_PRESETS[a]).toBeDefined();
      expect(AUDIENCE_PRESETS[a].label.length).toBeGreaterThan(0);
    }
  });
  it("has 3 hook templates", () => {
    expect(HOOK_TEMPLATES).toHaveLength(3);
    expect(HOOK_TEMPLATES.map((h) => h.variation)).toEqual([1, 2, 3]);
    expect(HOOK_TEMPLATES.map((h) => h.hook)).toEqual(["question", "statement", "story"]);
  });
  it("has labels for all platforms, tones, audiences", () => {
    expect(Object.keys(PLATFORM_LABELS)).toHaveLength(5);
    expect(Object.keys(TONE_LABELS)).toHaveLength(6);
    expect(Object.keys(AUDIENCE_LABELS)).toHaveLength(6);
  });
});

describe("social-media-post-generator normalizeTopic / capitalize", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeTopic("  JavaScript   Testing  ")).toBe("JavaScript Testing");
  });
  it("handles empty", () => {
    expect(normalizeTopic("")).toBe("");
  });
  it("capitalizes first letter", () => {
    expect(capitalize("hello world")).toBe("Hello world");
  });
  it("capitalize handles empty", () => {
    expect(capitalize("")).toBe("");
  });
});

describe("social-media-post-generator parseKeyPoints / formatKeyPoints", () => {
  it("parses newline-separated points", () => {
    expect(parseKeyPoints("Point 1\nPoint 2\nPoint 3")).toEqual(["Point 1", "Point 2", "Point 3"]);
  });
  it("skips blank lines", () => {
    expect(parseKeyPoints("A\n\nB\n  \nC")).toEqual(["A", "B", "C"]);
  });
  it("trims each point", () => {
    expect(parseKeyPoints("  A  \n  B  ")).toEqual(["A", "B"]);
  });
  it("returns empty for empty input", () => {
    expect(parseKeyPoints("")).toEqual([]);
  });
  it("formats points as bullets", () => {
    expect(formatKeyPoints(["A", "B"])).toBe("• A\n• B");
  });
});

describe("social-media-post-generator generateHashtags", () => {
  it("generates requested count", () => {
    const tags = generateHashtags("javascript programming", 5);
    expect(tags).toHaveLength(5);
    expect(tags.every((t) => t.startsWith("#"))).toBe(true);
  });
  it("includes direct hashtag from topic", () => {
    const tags = generateHashtags("javascript", 3);
    expect(tags).toContain("#javascript");
  });
  it("handles multi-word topics", () => {
    const tags = generateHashtags("javascript programming", 5);
    expect(tags).toContain("#javascriptprogramming");
  });
  it("returns empty for empty topic", () => {
    expect(generateHashtags("", 5)).toEqual([]);
  });
  it("returns empty for count <= 0", () => {
    expect(generateHashtags("javascript", 0)).toEqual([]);
  });
  it("strips non-alphanumeric chars", () => {
    const tags = generateHashtags("c++ programming!", 3);
    expect(tags.every((t) => /^#[a-z0-9]+$/i.test(t))).toBe(true);
  });
});

describe("social-media-post-generator CTA / tone / audience / emoji", () => {
  it("generates platform CTA when included", () => {
    expect(generateCTA("instagram", true)).toBe("Link in bio.");
    expect(generateCTA("twitter", true)).toBe("Retweet & follow for more.");
  });
  it("returns empty CTA when not included", () => {
    expect(generateCTA("twitter", false)).toBe("");
  });
  it("applyTone returns opening + closing", () => {
    const r = applyTone("professional", "JavaScript testing");
    expect(r.opening).toContain("JavaScript testing");
    expect(r.closing.length).toBeGreaterThan(0);
  });
  it("applyAudience returns flavor", () => {
    expect(applyAudience("developers")).toContain("production code");
    expect(applyAudience("general")).toBe("");
  });
  it("applyEmojis returns emoji when enabled", () => {
    expect(applyEmojis("professional", true).length).toBeGreaterThan(0);
  });
  it("applyEmojis returns empty when disabled", () => {
    expect(applyEmojis("professional", false)).toBe("");
  });
});

describe("social-media-post-generator buildHook", () => {
  it("builds question hook for variation 1", () => {
    const { hook, text } = buildHook(1, "javascript testing");
    expect(hook).toBe("question");
    expect(text).toContain("javascript testing");
  });
  it("builds statement hook for variation 2", () => {
    const { hook, text } = buildHook(2, "javascript testing");
    expect(hook).toBe("statement");
    expect(text).toContain("Javascript testing");
  });
  it("builds story hook for variation 3", () => {
    const { hook, text } = buildHook(3, "javascript testing");
    expect(hook).toBe("story");
    expect(text).toContain("javascript testing");
  });
  it("falls back to variation 1 for unknown", () => {
    const { hook } = buildHook(99, "x");
    expect(hook).toBe("question");
  });
});

describe("social-media-post-generator char limit validation", () => {
  it("validateCharLimit returns true when over max", () => {
    expect(validateCharLimit("twitter", 300)).toBe(true);
  });
  it("validateCharLimit returns false when under max", () => {
    expect(validateCharLimit("twitter", 200)).toBe(false);
  });
  it("getCharLimitStatus returns red when over max", () => {
    expect(getCharLimitStatus("twitter", 300)).toBe("red");
  });
  it("getCharLimitStatus returns yellow when over optimal", () => {
    expect(getCharLimitStatus("twitter", 260)).toBe("yellow");
  });
  it("getCharLimitStatus returns green when under optimal", () => {
    expect(getCharLimitStatus("twitter", 100)).toBe("green");
  });
  it("truncateToLimit preserves text under limit", () => {
    expect(truncateToLimit("hello", 280)).toBe("hello");
  });
  it("truncateToLimit truncates with ellipsis", () => {
    const long = "a".repeat(300);
    const out = truncateToLimit(long, 280);
    expect(out.length).toBeLessThanOrEqual(280);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("social-media-post-generator generateForPlatform", () => {
  it("generates a Twitter post under 280 chars", () => {
    const post = generateForPlatform(baseInput, "twitter", 1);
    expect(post.platform).toBe("twitter");
    expect(post.charCount).toBeLessThanOrEqual(280);
    expect(post.variation).toBe(1);
    expect(post.hook).toBe("question");
  });
  it("generates a Mastodon post under 500 chars", () => {
    const post = generateForPlatform(baseInput, "mastodon", 1);
    expect(post.charCount).toBeLessThanOrEqual(500);
  });
  it("generates an Instagram post with 15 hashtags", () => {
    const post = generateForPlatform(baseInput, "instagram", 1);
    expect(post.hashtagCount).toBe(15);
  });
  it("generates a LinkedIn post", () => {
    const post = generateForPlatform(baseInput, "linkedin", 2);
    expect(post.platform).toBe("linkedin");
    expect(post.variation).toBe(2);
    expect(post.hook).toBe("statement");
  });
  it("respects includeHashtags=false", () => {
    const post = generateForPlatform({ ...baseInput, includeHashtags: false }, "instagram", 1);
    expect(post.hashtagCount).toBe(0);
  });
  it("respects includeCTA=false (no CTA in text)", () => {
    const post = generateForPlatform({ ...baseInput, includeCTA: false }, "twitter", 1);
    expect(post.text).not.toContain("Retweet");
  });
  it("respects includeEmojis=true (emoji in text)", () => {
    const post = generateForPlatform({ ...baseInput, includeEmojis: true }, "twitter", 1);
    expect(post.text).toMatch(/\p{Emoji}/u);
  });
  it("includes hashtags in text when enabled", () => {
    const post = generateForPlatform(baseInput, "twitter", 1);
    expect(post.text).toMatch(/#\w+/);
  });
});

describe("social-media-post-generator generateVariations", () => {
  it("generates 3 variations per platform", () => {
    const variations = generateVariations(baseInput, "twitter");
    expect(variations).toHaveLength(3);
    expect(variations.map((v) => v.variation)).toEqual([1, 2, 3]);
    expect(variations.map((v) => v.hook)).toEqual(["question", "statement", "story"]);
  });
});

describe("social-media-post-generator generateForPlatforms / generateAllVariations", () => {
  it("generateForPlatforms produces one post per platform", () => {
    const posts = generateForPlatforms(baseInput);
    expect(posts).toHaveLength(5);
    expect(posts.map((p) => p.platform).sort()).toEqual(
      ["facebook", "instagram", "linkedin", "mastodon", "twitter"],
    );
  });
  it("generateAllVariations produces 3 posts per platform", () => {
    const posts = generateAllVariations(baseInput);
    expect(posts).toHaveLength(15); // 5 platforms × 3 variations
  });
  it("handles empty platforms list", () => {
    expect(generateForPlatforms({ ...baseInput, platforms: [] })).toEqual([]);
  });
});

describe("social-media-post-generator computeSummaryStats", () => {
  it("computes stats across all posts", () => {
    const posts = generateForPlatforms(baseInput);
    const stats = computeSummaryStats(posts);
    expect(stats.totalPlatforms).toBe(5);
    expect(stats.totalPosts).toBe(5);
    expect(stats.totalChars).toBeGreaterThan(0);
    expect(stats.avgCharsPerPost).toBeGreaterThan(0);
    expect(stats.truncatedCount).toBeGreaterThanOrEqual(0);
  });
  it("returns zeros for empty input", () => {
    const stats = computeSummaryStats([]);
    expect(stats.totalPlatforms).toBe(0);
    expect(stats.totalPosts).toBe(0);
    expect(stats.totalChars).toBe(0);
    expect(stats.avgCharsPerPost).toBe(0);
  });
});

describe("social-media-post-generator getBestTimeToPost", () => {
  it("returns best time for twitter", () => {
    const t = getBestTimeToPost("twitter");
    expect(t.length).toBeGreaterThan(0);
    expect(t).toContain("9am");
  });
  it("returns best time for instagram", () => {
    expect(getBestTimeToPost("instagram")).toContain("11am");
  });
});

describe("social-media-post-generator renderText", () => {
  it("renders text report with platform headers", () => {
    const posts = generateForPlatforms({ ...baseInput, platforms: ["twitter", "mastodon"] });
    const text = renderText(posts);
    expect(text).toContain("=== Twitter/X ===");
    expect(text).toContain("=== Mastodon ===");
    expect(text).toContain("Best time to post:");
    expect(text).toContain("Max chars:");
  });
  it("returns empty string for empty input", () => {
    expect(renderText([])).toBe("");
  });
});

describe("social-media-post-generator renderCsv", () => {
  it("renders CSV header", () => {
    const csv = renderCsv([]);
    expect(csv).toContain("platform,variation,hook,char_count,hashtag_count,truncated,post_text");
  });
  it("renders post rows", () => {
    const posts = generateForPlatforms({ ...baseInput, platforms: ["twitter"] });
    const csv = renderCsv(posts);
    expect(csv).toContain("twitter,1,question");
  });
});

describe("social-media-post-generator splitCsvRow", () => {
  it("splits simple row", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("handles escaped quotes", () => {
    expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]);
  });
});

describe("social-media-post-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, topic: "JS testing",
      platforms: ["twitter"], tone: "professional",
      audience: "developers", totalPosts: 3,
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].topic).toBe("JS testing");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, topic: `topic ${i}`,
        platforms: ["twitter"], tone: "professional",
        audience: "developers", totalPosts: 1,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, topic: "x",
      platforms: ["twitter"], tone: "professional",
      audience: "developers", totalPosts: 1,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("social-media-post-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(baseInput);
    expect(url).toContain("topic=");
    expect(url).toContain("tone=professional");
    expect(url).toContain("aud=developers");
    expect(url).toContain("plat=twitter");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = buildShareUrl(baseInput);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : `#${url.slice(1)}`;
    const parsed = parseShareUrl(hash);
    expect(parsed.topic).toBe(baseInput.topic);
    expect(parsed.tone).toBe("professional");
    expect(parsed.audience).toBe("developers");
    expect(parsed.platforms).toEqual(baseInput.platforms);
    expect(parsed.includeHashtags).toBe(true);
    expect(parsed.includeCTA).toBe(true);
    expect(parsed.includeEmojis).toBe(false);
  });
  it("handles empty hash", () => {
    const parsed = parseShareUrl("");
    expect(parsed.topic).toBe("");
    expect(parsed.platforms).toEqual([]);
    expect(parsed.tone).toBe("professional");
  });
  it("filters unknown platforms", () => {
    const parsed = parseShareUrl("topic=x&plat=twitter,unknown,tiktok");
    expect(parsed.platforms).toEqual(["twitter"]);
  });
  it("filters unknown tones", () => {
    const parsed = parseShareUrl("topic=x&tone=unknown");
    expect(parsed.tone).toBe("professional");
  });
  it("parses key points from share URL", () => {
    const parsed = parseShareUrl("topic=x&points=A%0AB%0AC");
    expect(parsed.keyPoints).toEqual(["A", "B", "C"]);
  });
  it("parses include flags", () => {
    const parsed = parseShareUrl("topic=x&htags=0&cta=0&emoji=1");
    expect(parsed.includeHashtags).toBe(false);
    expect(parsed.includeCTA).toBe(false);
    expect(parsed.includeEmojis).toBe(true);
  });
});

// Suppress unused-import lint for type-only re-exports
export type _Unused = Tone | TargetAudience | Platform;
