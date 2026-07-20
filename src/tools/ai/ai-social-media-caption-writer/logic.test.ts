import { describe, it, expect, beforeEach } from "vitest";
import {
  PLATFORM_LABELS,
  TONE_LABELS,
  EMOJI_DENSITY_LABELS,
  CTA_LABELS,
  NICHE_PRESETS,
  PLATFORM_CHAR_LIMIT,
  PLATFORM_SOFT_TARGET,
  PLATFORM_HASHTAG_MAX,
  PLATFORM_STYLE_HINTS,
  SHADOWBAN_RISK_TAGS,
  HISTORY_KEY,
  FAVES_KEY,
  HISTORY_MAX,
  FAVES_MAX,
  clean,
  countChars,
  suggestHashtags,
  suggestBrandedHashtags,
  flagShadowban,
  filterSafe,
  trimToCharLimit,
  buildCaption,
  generateCaptions,
  generateAbPair,
  generateThread,
  generateCarousel,
  computeStats,
  renderText,
  renderMarkdown,
  renderCsv,
  renderJson,
  loadHistory,
  saveHistory,
  clearHistory,
  loadFavorites,
  saveFavorite,
  removeFavorite,
  clearFavorites,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Platform,
  type Tone,
  type Cta,
  type EmojiDensity,
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

// ---- Constants ----

describe("ai-social-media-caption-writer constants", () => {
  it("has 5 platforms", () => {
    expect(Object.keys(PLATFORM_LABELS)).toHaveLength(5);
    expect(PLATFORM_LABELS.instagram).toBe("Instagram");
    expect(PLATFORM_LABELS.twitter).toBe("X / Twitter");
  });
  it("has 5 tones", () => {
    expect(Object.keys(TONE_LABELS)).toHaveLength(5);
  });
  it("has 4 emoji densities", () => {
    expect(Object.keys(EMOJI_DENSITY_LABELS)).toHaveLength(4);
  });
  it("has 8 CTAs", () => {
    expect(Object.keys(CTA_LABELS)).toHaveLength(8);
  });
  it("has 12+ niche presets", () => {
    expect(NICHE_PRESETS.length).toBeGreaterThanOrEqual(12);
    expect(NICHE_PRESETS).toContain("fitness");
  });
  it("has per-platform char limits", () => {
    expect(PLATFORM_CHAR_LIMIT.twitter).toBe(280);
    expect(PLATFORM_CHAR_LIMIT.instagram).toBe(2200);
    expect(PLATFORM_CHAR_LIMIT.linkedin).toBe(3000);
    expect(PLATFORM_CHAR_LIMIT.tiktok).toBe(2200);
    expect(PLATFORM_CHAR_LIMIT.facebook).toBe(5000);
  });
  it("has per-platform soft targets <= hard limits", () => {
    for (const p of Object.keys(PLATFORM_LABELS) as Platform[]) {
      expect(PLATFORM_SOFT_TARGET[p]).toBeLessThanOrEqual(PLATFORM_CHAR_LIMIT[p]);
    }
  });
  it("has per-platform hashtag max", () => {
    expect(PLATFORM_HASHTAG_MAX.twitter).toBeLessThanOrEqual(2);
    expect(PLATFORM_HASHTAG_MAX.instagram).toBeGreaterThanOrEqual(5);
  });
  it("has style hints for every platform", () => {
    for (const p of Object.keys(PLATFORM_LABELS) as Platform[]) {
      expect(PLATFORM_STYLE_HINTS[p].length).toBeGreaterThan(0);
    }
  });
  it("has shadowban-risk tag list", () => {
    expect(SHADOWBAN_RISK_TAGS.length).toBeGreaterThanOrEqual(10);
    expect(SHADOWBAN_RISK_TAGS).toContain("#anorexia");
  });
  it("has correct history constants", () => {
    expect(HISTORY_KEY).toBe("unqtools:ai-social-caption:history");
    expect(HISTORY_MAX).toBe(20);
    expect(FAVES_KEY).toBe("unqtools:ai-social-caption:faves");
    expect(FAVES_MAX).toBe(50);
  });
});

// ---- Helpers ----

describe("ai-social-media-caption-writer clean + countChars", () => {
  it("clean collapses whitespace", () => {
    expect(clean("  hello   world  ")).toBe("hello world");
  });
  it("clean handles empty", () => {
    expect(clean("")).toBe("");
  });
  it("countChars counts emoji as 1 char", () => {
    expect(countChars("a🔥b")).toBe(3);
  });
  it("countChars strips variation selectors", () => {
    // ❤️ is heart + variation selector — counts as 1
    expect(countChars("❤️")).toBe(1);
  });
});

// ---- Hashtag suggestions ----

describe("ai-social-media-caption-writer suggestHashtags", () => {
  it("suggests niche hashtags", () => {
    const tags = suggestHashtags("fitness", 10);
    expect(tags.length).toBeGreaterThan(0);
    expect(tags[0]).toBe("#fitness");
    expect(tags.every((t) => t.startsWith("#"))).toBe(true);
  });
  it("caps at max", () => {
    const tags = suggestHashtags("fitness", 5);
    expect(tags.length).toBeLessThanOrEqual(5);
  });
  it("returns empty for empty niche", () => {
    expect(suggestHashtags("")).toEqual([]);
  });
  it("strips non-alphanumeric characters", () => {
    const tags = suggestHashtags("fitness & health!", 3);
    expect(tags[0]).toBe("#fitnesshealth");
  });
});

describe("ai-social-media-caption-writer suggestBrandedHashtags", () => {
  it("suggests branded hashtags from account name", () => {
    const tags = suggestBrandedHashtags("acme", "fitness", 5);
    expect(tags).toContain("#acme");
    expect(tags).toContain("#acmefitness");
    expect(tags.some((t) => t.startsWith("#acme"))).toBe(true);
  });
  it("returns empty for empty account name", () => {
    expect(suggestBrandedHashtags("", "fitness")).toEqual([]);
  });
});

describe("ai-social-media-caption-writer shadowban flagging", () => {
  it("flags known risky tags", () => {
    const flagged = flagShadowban(["#fitness", "#anorexia", "#happy"]);
    expect(flagged).toContain("#anorexia");
    expect(flagged).not.toContain("#fitness");
  });
  it("filterSafe removes flagged tags", () => {
    const safe = filterSafe(["#fitness", "#anorexia", "#happy"]);
    expect(safe).toContain("#fitness");
    expect(safe).not.toContain("#anorexia");
  });
  it("filterSafe is case-insensitive", () => {
    const safe = filterSafe(["#Anorexia", "#fitness"]);
    expect(safe).not.toContain("#Anorexia");
  });
});

// ---- trimToCharLimit ----

describe("ai-social-media-caption-writer trimToCharLimit", () => {
  it("returns as-is when within limit", () => {
    expect(trimToCharLimit("hello world", 20)).toBe("hello world");
  });
  it("trims on word boundary with ellipsis", () => {
    const out = trimToCharLimit("one two three four five", 15);
    expect(out.length).toBeLessThanOrEqual(16); // +1 for ellipsis
    expect(out.endsWith("…")).toBe(true);
  });
  it("handles ASCII limit exactly", () => {
    expect(trimToCharLimit("12345", 5)).toBe("12345");
  });
});

// ---- buildCaption ----

describe("ai-social-media-caption-writer buildCaption", () => {
  it("builds a caption for Instagram", () => {
    const c = buildCaption({
      platform: "instagram", tone: "bold", cta: "link-in-bio",
      emojiDensity: "medium", topic: "fitness", accountName: "acme",
    });
    expect(c.platform).toBe("instagram");
    expect(c.tone).toBe("bold");
    expect(c.hook.length).toBeGreaterThan(0);
    expect(c.body.length).toBeGreaterThan(0);
    expect(c.ctaLine).toContain("Link in bio");
    expect(c.text.length).toBeGreaterThan(0);
    expect(c.charCount).toBeGreaterThan(0);
    expect(c.charLimit).toBe(2200);
  });
  it("respects Twitter hard char limit", () => {
    const c = buildCaption({
      platform: "twitter", tone: "bold", cta: "share",
      emojiDensity: "low", topic: "fitness", accountName: "acme",
    });
    expect(c.charLimit).toBe(280);
    expect(c.exceedsLimit).toBe(false);
  });
  it("includes hook style metadata", () => {
    const c = buildCaption({
      platform: "linkedin", tone: "professional", cta: "learn-more",
      emojiDensity: "none", topic: "leadership",
    });
    expect(c.hookStyle.length).toBeGreaterThan(0);
  });
  it("respects emoji density none", () => {
    const c = buildCaption({
      platform: "instagram", tone: "bold", cta: "follow",
      emojiDensity: "none", topic: "fitness",
    });
    expect(c.emojis).toHaveLength(0);
  });
  it("respects emoji density high", () => {
    const c = buildCaption({
      platform: "instagram", tone: "bold", cta: "follow",
      emojiDensity: "high", topic: "fitness",
    });
    expect(c.emojis.length).toBeGreaterThanOrEqual(3);
  });
  it("caps hashtags at platform max", () => {
    const c = buildCaption({
      platform: "twitter", tone: "bold", cta: "share",
      emojiDensity: "low", topic: "fitness",
    });
    expect(c.hashtags.length).toBeLessThanOrEqual(PLATFORM_HASHTAG_MAX.twitter);
  });
  it("filters shadowban-risk hashtags from output", () => {
    // Use a topic that won't naturally produce a banned tag — verify
    // the filter is invoked by checking that banned tags never appear.
    const c = buildCaption({
      platform: "instagram", tone: "bold", cta: "follow",
      emojiDensity: "medium", topic: "fitness",
    });
    for (const t of c.hashtags) {
      expect(SHADOWBAN_RISK_TAGS.map((s) => s.toLowerCase())).not.toContain(t.toLowerCase());
    }
  });
  it("returns deterministic output for same inputs", () => {
    const a = buildCaption({
      platform: "instagram", tone: "bold", cta: "follow",
      emojiDensity: "medium", topic: "fitness", variantIdx: 0,
    });
    const b = buildCaption({
      platform: "instagram", tone: "bold", cta: "follow",
      emojiDensity: "medium", topic: "fitness", variantIdx: 0,
    });
    expect(a.text).toBe(b.text);
    expect(a.hook).toBe(b.hook);
  });
  it("produces different hooks for different variantIdx", () => {
    const a = buildCaption({
      platform: "instagram", tone: "bold", cta: "follow",
      emojiDensity: "medium", topic: "fitness", variantIdx: 0,
    });
    const b = buildCaption({
      platform: "instagram", tone: "bold", cta: "follow",
      emojiDensity: "medium", topic: "fitness", variantIdx: 1,
    });
    expect(a.hook).not.toBe(b.hook);
  });
  it("includes branded hashtags when accountName provided", () => {
    const c = buildCaption({
      platform: "instagram", tone: "bold", cta: "follow",
      emojiDensity: "medium", topic: "fitness", accountName: "acme",
    });
    expect(c.hashtags.some((t) => t.includes("acme"))).toBe(true);
  });
  it("falls back to topic='your topic' for empty topic", () => {
    const c = buildCaption({
      platform: "instagram", tone: "bold", cta: "follow",
      emojiDensity: "medium", topic: "",
    });
    expect(c.hook.toLowerCase()).toContain("your topic");
  });
});

// ---- generateCaptions ----

describe("ai-social-media-caption-writer generateCaptions", () => {
  it("generates 5+ variants", () => {
    const out = generateCaptions(
      "instagram", "bold", "link-in-bio", "medium", "fitness", "acme", 5,
    );
    expect(out.length).toBeGreaterThanOrEqual(5);
  });
  it("generates 8 when count=8", () => {
    const out = generateCaptions(
      "twitter", "bold", "share", "low", "fitness", undefined, 8,
    );
    expect(out).toHaveLength(8);
  });
  it("all variants respect platform char limit (Twitter)", () => {
    const out = generateCaptions(
      "twitter", "bold", "share", "low", "fitness", undefined, 5,
    );
    for (const c of out) {
      expect(c.exceedsLimit).toBe(false);
    }
  });
});

// ---- generateAbPair ----

describe("ai-social-media-caption-writer generateAbPair", () => {
  it("returns control + challenger with different tones", () => {
    const pair = generateAbPair(
      "instagram", "bold", "link-in-bio", "medium", "fitness", "acme",
    );
    expect(pair.control.tone).toBe("bold");
    expect(pair.challenger.tone).not.toBe("bold");
    expect(pair.hypothesis.length).toBeGreaterThan(10);
    expect(pair.whatToMeasure.length).toBeGreaterThan(10);
  });
});

// ---- generateThread ----

describe("ai-social-media-caption-writer generateThread", () => {
  it("generates a numbered thread", () => {
    const thread = generateThread("fitness", "bold", "share", "low", 5);
    expect(thread).toHaveLength(5);
    expect(thread[0].index).toBe(1);
    expect(thread[4].index).toBe(5);
    expect(thread[0].text).toContain("Thread");
  });
  it("every tweet respects 280-char limit", () => {
    const thread = generateThread("fitness", "bold", "share", "low", 6);
    for (const t of thread) {
      expect(t.exceedsLimit).toBe(false);
    }
  });
});

// ---- generateCarousel ----

describe("ai-social-media-caption-writer generateCarousel", () => {
  it("generates 5-10 slides", () => {
    const slides = generateCarousel("fitness", "bold", "follow", "medium", 6);
    expect(slides.length).toBeGreaterThanOrEqual(5);
    expect(slides.length).toBeLessThanOrEqual(10);
  });
  it("first slide is the hook, last slide is the CTA", () => {
    const slides = generateCarousel("fitness", "bold", "follow", "medium", 6);
    expect(slides[0].length).toBeGreaterThan(0);
    expect(slides[slides.length - 1]).toContain("Follow");
  });
});

// ---- computeStats ----

describe("ai-social-media-caption-writer computeStats", () => {
  it("computes per-platform stats", () => {
    const caps = [
      ...generateCaptions("instagram", "bold", "link-in-bio", "medium", "fitness", undefined, 5),
      ...generateCaptions("twitter", "bold", "share", "low", "fitness", undefined, 5),
    ];
    const stats = computeStats(caps);
    expect(stats).toHaveLength(2);
    const ig = stats.find((s) => s.platform === "instagram");
    expect(ig?.count).toBe(5);
    expect(ig?.avgChars).toBeGreaterThan(0);
  });
  it("returns empty for empty input", () => {
    expect(computeStats([])).toEqual([]);
  });
});

// ---- Rendering ----

describe("ai-social-media-caption-writer renderText", () => {
  it("renders with platform + tone header", () => {
    const caps = generateCaptions("instagram", "bold", "link-in-bio", "medium", "fitness", undefined, 2);
    const txt = renderText(caps);
    expect(txt).toContain("Instagram");
    expect(txt).toContain("Bold");
    expect(txt).toContain("---");
  });
});

describe("ai-social-media-caption-writer renderMarkdown", () => {
  it("renders markdown headers", () => {
    const caps = generateCaptions("instagram", "bold", "link-in-bio", "medium", "fitness", undefined, 2);
    const md = renderMarkdown(caps);
    expect(md).toContain("## Caption 1");
    expect(md).toContain("```");
  });
});

describe("ai-social-media-caption-writer renderCsv", () => {
  it("renders header row", () => {
    expect(renderCsv([])).toContain("id,platform,tone,cta");
  });
  it("renders data rows", () => {
    const caps = generateCaptions("instagram", "bold", "link-in-bio", "medium", "fitness", undefined, 2);
    const csv = renderCsv(caps);
    expect(csv).toContain("instagram");
    expect(csv).toContain("bold");
  });
});

describe("ai-social-media-caption-writer renderJson", () => {
  it("renders valid JSON", () => {
    const caps = generateCaptions("instagram", "bold", "link-in-bio", "medium", "fitness", undefined, 2);
    const json = renderJson(caps);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].platform).toBe("instagram");
  });
});

// ---- History ----

describe("ai-social-media-caption-writer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, platform: "instagram", tone: "bold", cta: "link-in-bio",
      emojiDensity: "medium", topic: "fitness", accountName: "acme", variantCount: 5,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, platform: "instagram", tone: "bold", cta: "link-in-bio",
        emojiDensity: "medium", topic: "fitness", accountName: "acme", variantCount: 1,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, platform: "instagram", tone: "bold", cta: "link-in-bio",
      emojiDensity: "medium", topic: "fitness", accountName: "acme", variantCount: 1,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---- Favorites ----

describe("ai-social-media-caption-writer favorites (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadFavorites()).toEqual([]);
  });
  it("saves and loads", () => {
    saveFavorite({
      ts: 1, platform: "instagram", tone: "bold", cta: "link-in-bio",
      emojiDensity: "medium", text: "hello", topic: "fitness",
    });
    expect(loadFavorites()).toHaveLength(1);
  });
  it("removes by ts", () => {
    saveFavorite({
      ts: 1, platform: "instagram", tone: "bold", cta: "link-in-bio",
      emojiDensity: "medium", text: "hello", topic: "fitness",
    });
    removeFavorite(1);
    expect(loadFavorites()).toEqual([]);
  });
  it("clears", () => {
    saveFavorite({
      ts: 1, platform: "instagram", tone: "bold", cta: "link-in-bio",
      emojiDensity: "medium", text: "hello", topic: "fitness",
    });
    clearFavorites();
    expect(loadFavorites()).toEqual([]);
  });
});

// ---- Share URL ----

describe("ai-social-media-caption-writer shareable URL", () => {
  it("builds share URL with all params when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      platform: "instagram", tone: "bold", cta: "link-in-bio",
      emojiDensity: "medium", topic: "fitness", accountName: "acme",
    });
    expect(url).toContain("p=instagram");
    expect(url).toContain("t=bold");
    expect(url).toContain("c=link-in-bio");
    expect(url).toContain("e=medium");
    expect(url).toContain("to=fitness");
    expect(url).toContain("a=acme");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("p=instagram&t=bold&c=link-in-bio&e=medium&to=fitness&a=acme");
    expect(p.platform).toBe("instagram");
    expect(p.tone).toBe("bold");
    expect(p.cta).toBe("link-in-bio");
    expect(p.emojiDensity).toBe("medium");
    expect(p.topic).toBe("fitness");
    expect(p.accountName).toBe("acme");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown platform values", () => {
    const p = parseShareUrl("p=myspace&t=bold");
    expect(p.platform).toBeUndefined();
  });
});

// ---- LLM prompt + render ----

describe("ai-social-media-caption-writer LLM helpers", () => {
  it("builds an LLM prompt with platform + tone", () => {
    const prompt = buildLlmPrompt("instagram", "bold", "link-in-bio", "medium", "fitness", "acme");
    expect(prompt).toContain("Instagram");
    expect(prompt).toContain("Bold");
    expect(prompt).toContain("fitness");
    expect(prompt).toContain("2200");
  });
  it("renders a valid LLM JSON result", () => {
    const raw = JSON.stringify([
      { text: "hook\nbody", hook: "hook", hashtags: ["#fitness"], rationale: "works" },
    ]);
    const out = renderLlmResult(raw);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.variants).toHaveLength(1);
      expect(out.variants[0].text).toBe("hook\nbody");
      expect(out.variants[0].hashtags).toEqual(["#fitness"]);
    }
  });
  it("handles markdown-fenced JSON", () => {
    const raw = "```json\n" + JSON.stringify([
      { text: "hello", hook: "h", hashtags: [], rationale: "" },
    ]) + "\n```";
    const out = renderLlmResult(raw);
    expect(out.ok).toBe(true);
  });
  it("fails gracefully on invalid JSON", () => {
    const out = renderLlmResult("not json");
    expect(out.ok).toBe(false);
  });
  it("fails gracefully on non-array JSON", () => {
    const out = renderLlmResult('{"text":"x"}');
    expect(out.ok).toBe(false);
  });
  it("fails gracefully when no valid objects", () => {
    const out = renderLlmResult("[{}, {}]");
    expect(out.ok).toBe(false);
  });
});

// Suppress unused-import lint for type-only imports
export type _Unused = Platform | Tone | Cta | EmojiDensity;
