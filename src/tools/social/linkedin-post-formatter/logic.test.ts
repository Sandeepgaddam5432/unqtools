import { describe, it, expect, beforeEach } from "vitest";
import {
  POST_TYPES,
  TONES,
  POST_TYPE_LABELS,
  TONE_LABELS,
  POST_TYPE_CONFIGS,
  TONE_PRESETS,
  MAX_CHARS,
  OPTIMAL_CHARS,
  MAX_EMOJIS,
  BEST_TIMES,
  FALLBACK_HASHTAGS,
  normalizeText,
  capitalize,
  splitSentences,
  splitParagraphs,
  extractHeadline,
  trimToLength,
  extractBullets,
  formatBullets,
  formatLineBreaks,
  generateCTA,
  extractKeywords,
  generateHashtags,
  applyTone,
  countEmojis,
  validateFormat,
  scoreHook,
  readingTime,
  formatPost,
  generateVariations,
  computeStats,
  recommendBestTimes,
  topBestTimes,
  renderText,
  renderHtml,
  renderMarkdown,
  renderCsv,
  splitCsvRow,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PostType,
  type Tone,
  type PostInput,
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

describe("linkedin-post-formatter constants", () => {
  it("has 5 post types", () => {
    expect(POST_TYPES).toHaveLength(5);
    expect(POST_TYPES).toContain("text-post");
    expect(POST_TYPES).toContain("hiring");
  });
  it("has 5 tones", () => {
    expect(TONES).toHaveLength(5);
    expect(TONES).toContain("thought-leader");
    expect(TONES).toContain("analyst");
  });
  it("has 5 post type labels", () => {
    expect(Object.keys(POST_TYPE_LABELS)).toHaveLength(5);
  });
  it("has 5 tone labels", () => {
    expect(Object.keys(TONE_LABELS)).toHaveLength(5);
  });
  it("has 5 post type configs with CTAs", () => {
    expect(Object.keys(POST_TYPE_CONFIGS)).toHaveLength(5);
    expect(POST_TYPE_CONFIGS["hiring"].cta).toContain("DM");
    expect(POST_TYPE_CONFIGS["text-post"].cta).toContain("comment");
  });
  it("has 5 tone presets", () => {
    expect(Object.keys(TONE_PRESETS)).toHaveLength(5);
    expect(TONE_PRESETS["analyst"].vocabIntensity).toBe(5);
  });
  it("has correct char limits", () => {
    expect(MAX_CHARS).toBe(3000);
    expect(OPTIMAL_CHARS).toBe(1300);
    expect(MAX_EMOJIS).toBe(4);
  });
  it("has best-times data", () => {
    expect(BEST_TIMES.length).toBeGreaterThanOrEqual(5);
    expect(BEST_TIMES.some((t) => t.engagement === "high")).toBe(true);
  });
  it("has fallback hashtags", () => {
    expect(FALLBACK_HASHTAGS.length).toBeGreaterThanOrEqual(5);
    expect(FALLBACK_HASHTAGS).toContain("leadership");
  });
});

describe("linkedin-post-formatter normalizeText", () => {
  it("collapses whitespace", () => {
    expect(normalizeText("  hello   world  ")).toBe("hello world");
  });
  it("handles empty", () => {
    expect(normalizeText("")).toBe("");
  });
});

describe("linkedin-post-formatter capitalize", () => {
  it("capitalizes first letter", () => {
    expect(capitalize("hello world")).toBe("Hello world");
  });
  it("handles empty", () => {
    expect(capitalize("")).toBe("");
  });
});

describe("linkedin-post-formatter splitSentences", () => {
  it("splits on sentence punctuation", () => {
    const s = splitSentences("Hello world. This is great! Is it?");
    expect(s).toHaveLength(3);
    expect(s[0]).toBe("Hello world.");
  });
  it("returns empty for empty input", () => {
    expect(splitSentences("")).toEqual([]);
  });
});

describe("linkedin-post-formatter splitParagraphs", () => {
  it("splits on blank lines", () => {
    const p = splitParagraphs("Para one.\n\nPara two.\n\nPara three.");
    expect(p).toHaveLength(3);
  });
  it("normalizes each paragraph", () => {
    const p = splitParagraphs("Para   one.\n\nPara two.");
    expect(p[0]).toBe("Para one.");
  });
});

describe("linkedin-post-formatter extractHeadline", () => {
  it("extracts first engaging sentence", () => {
    const h = extractHeadline("I built a $1M app in 30 days. Here's what I learned about focus and shipping fast.");
    expect(h.length).toBeGreaterThan(0);
    expect(h.length).toBeLessThanOrEqual(140);
  });
  it("returns empty for empty input", () => {
    expect(extractHeadline("")).toBe("");
  });
  it("capitalizes the headline", () => {
    const h = extractHeadline("hello world this is a sentence.");
    expect(h.charAt(0)).toBe("H");
  });
});

describe("linkedin-post-formatter trimToLength", () => {
  it("truncates on word boundary", () => {
    const t = trimToLength("hello world this is too long", 15);
    expect(t.length).toBeLessThanOrEqual(15);
    expect(t).toContain("…");
  });
  it("returns text if within length", () => {
    expect(trimToLength("short", 50)).toBe("short");
  });
});

describe("linkedin-post-formatter extractBullets", () => {
  it("extracts pre-formatted bullet lines", () => {
    const b = extractBullets("- First point\n- Second point\n- Third point");
    expect(b).toHaveLength(3);
    expect(b[0]).toBe("First point");
  });
  it("extracts numbered lines", () => {
    const b = extractBullets("1. Step one\n2. Step two");
    expect(b).toHaveLength(2);
    expect(b[0]).toBe("Step one");
  });
  it("falls back to sentences", () => {
    const b = extractBullets("This is the first short sentence. This is the second one. And a third one too.");
    expect(b.length).toBeGreaterThanOrEqual(2);
  });
});

describe("linkedin-post-formatter formatBullets", () => {
  it("formats with bullet character by default", () => {
    const out = formatBullets(["one", "two"]);
    expect(out[0]).toBe("• one");
    expect(out[1]).toBe("• two");
  });
  it("formats numbered when requested", () => {
    const out = formatBullets(["one", "two"], true);
    expect(out[0]).toBe("1. one");
    expect(out[1]).toBe("2. two");
  });
});

describe("linkedin-post-formatter formatLineBreaks", () => {
  it("collapses triple+ newlines to double", () => {
    const out = formatLineBreaks("Para 1.\n\n\n\nPara 2.");
    expect(out).toBe("Para 1.\n\nPara 2.");
  });
  it("strips trailing whitespace per line", () => {
    const out = formatLineBreaks("Line one.   \nLine two.");
    expect(out).toBe("Line one.\nLine two.");
  });
  it("handles empty input", () => {
    expect(formatLineBreaks("")).toBe("");
  });
});

describe("linkedin-post-formatter generateCTA", () => {
  it("returns CTA per post type", () => {
    const hiring = generateCTA("hiring", true);
    expect(hiring).toContain("DM");
    const poll = generateCTA("poll", true);
    expect(poll).toContain("Vote");
  });
  it("returns empty when includeCTA is false", () => {
    expect(generateCTA("text-post", false)).toBe("");
  });
});

describe("linkedin-post-formatter extractKeywords", () => {
  it("extracts keywords excluding stopwords", () => {
    const k = extractKeywords("I learned leadership through experience and growth");
    expect(k).toContain("leadership");
    expect(k).toContain("experience");
    expect(k).toContain("growth");
    expect(k).not.toContain("i");
    expect(k).not.toContain("through");
  });
  it("returns empty for empty input", () => {
    expect(extractKeywords("")).toEqual([]);
  });
});

describe("linkedin-post-formatter generateHashtags", () => {
  it("generates 3-5 hashtags from content", () => {
    const tags = generateHashtags("Leadership requires strategy and growth mindset in business.", true);
    expect(tags.length).toBeGreaterThanOrEqual(3);
    expect(tags.length).toBeLessThanOrEqual(5);
    expect(tags.every((t) => t.length >= 3)).toBe(true);
  });
  it("pads with fallback when content is sparse", () => {
    const tags = generateHashtags("hi", true);
    expect(tags.length).toBeGreaterThanOrEqual(3);
  });
  it("returns empty when includeHashtags is false", () => {
    expect(generateHashtags("leadership growth", false)).toEqual([]);
  });
  it("limits to 5 hashtags max", () => {
    const long = "leadership strategy growth mindset innovation success career productivity networking professional development business executive";
    const tags = generateHashtags(long, true);
    expect(tags.length).toBeLessThanOrEqual(5);
  });
});

describe("linkedin-post-formatter applyTone", () => {
  it("analyst tone adds evidence clause", () => {
    const out = applyTone("analyst", "Revenue grew.");
    expect(out).toContain("data");
  });
  it("storyteller tone adds time framing when missing", () => {
    const out = applyTone("storyteller", "I shipped a product.");
    expect(out).toMatch(/years back|when|after|once/i);
  });
  it("mentor tone adds supportive framing", () => {
    const out = applyTone("mentor", "Keep pushing forward.");
    expect(out).toContain("You can do this too");
  });
  it("educator tone adds teaching framing", () => {
    const out = applyTone("educator", "Focus matters.");
    expect(out).toContain("key");
  });
  it("thought-leader leaves paragraph as-is", () => {
    const out = applyTone("thought-leader", "Original text stays.");
    expect(out).toBe("Original text stays.");
  });
  it("handles empty input", () => {
    expect(applyTone("analyst", "")).toBe("");
  });
});

describe("linkedin-post-formatter countEmojis", () => {
  it("counts emojis", () => {
    expect(countEmojis("Hello 🚀 world 🎉")).toBe(2);
  });
  it("returns 0 for no emojis", () => {
    expect(countEmojis("Plain text")).toBe(0);
  });
});

describe("linkedin-post-formatter validateFormat", () => {
  it("flags too many emojis", () => {
    const issues = validateFormat("🚀🎉💡🔥✨🚀 Too many emojis here.");
    expect(issues.some((i) => i.includes("Too many emojis"))).toBe(true);
  });
  it("flags informal language", () => {
    const issues = validateFormat("lol this is kinda stuff I wanna share with fam.");
    expect(issues.some((i) => i.includes("Informal language"))).toBe(true);
  });
  it("flags excessive blank lines", () => {
    const issues = validateFormat("Para 1.\n\n\n\nPara 2.");
    expect(issues.some((i) => i.includes("blank lines"))).toBe(true);
  });
  it("returns no issues for clean text", () => {
    const issues = validateFormat("This is a professional LinkedIn post with no issues.");
    expect(issues).toHaveLength(0);
  });
});

describe("linkedin-post-formatter scoreHook", () => {
  it("scores high for strong patterns", () => {
    const s = scoreHook("How I built a $1M app in 30 days");
    expect(s).toBeGreaterThanOrEqual(60);
  });
  it("scores low for weak hook", () => {
    const s = scoreHook("hi");
    expect(s).toBeLessThan(50);
  });
  it("returns 0 for empty", () => {
    expect(scoreHook("")).toBe(0);
  });
  it("caps at 100", () => {
    const s = scoreHook("How I learned the secret to success: 10 ways to never make a mistake! $1M lesson?");
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe("linkedin-post-formatter readingTime", () => {
  it("returns at least 1 minute", () => {
    expect(readingTime(50)).toBe(1);
  });
  it("calculates correctly for 400 words", () => {
    expect(readingTime(400)).toBe(2);
  });
});

describe("linkedin-post-formatter formatPost", () => {
  const input: PostInput = {
    rawContent: "I built a $1M app in 30 days.\n\nFirst lesson: focus matters.\nSecond lesson: ship fast.\n\nThe key insight is that velocity compounds.",
    postType: "text-post",
    includeHeadline: true,
    includeBullets: true,
    includeCTA: true,
    includeHashtags: true,
    tone: "thought-leader",
  };
  it("formats a full post", () => {
    const p = formatPost(input, 1);
    expect(p.headline).toContain("$1M");
    expect(p.bullets.length).toBeGreaterThan(0);
    expect(p.cta).toContain("comment");
    expect(p.hashtags.length).toBeGreaterThanOrEqual(3);
    expect(p.formattedText.length).toBeGreaterThan(0);
    expect(p.charCount).toBeGreaterThan(0);
    expect(p.wordCount).toBeGreaterThan(0);
  });
  it("generates HTML with bold hook", () => {
    const p = formatPost(input, 1);
    expect(p.htmlText).toContain("<strong>");
    expect(p.htmlText).toContain("<ul>");
  });
  it("generates Markdown with bold hook", () => {
    const p = formatPost(input, 1);
    expect(p.markdownText).toContain("**");
    expect(p.markdownText).toContain("- ");
  });
  it("respects includeHeadline=false", () => {
    const p = formatPost({ ...input, includeHeadline: false }, 1);
    expect(p.htmlText).not.toContain("<strong>");
  });
  it("respects includeCTA=false", () => {
    const p = formatPost({ ...input, includeCTA: false }, 1);
    expect(p.cta).toBe("");
  });
  it("respects includeHashtags=false", () => {
    const p = formatPost({ ...input, includeHashtags: false }, 1);
    expect(p.hashtags).toEqual([]);
  });
  it("returns empty post for empty input", () => {
    const p = formatPost({ ...input, rawContent: "" }, 1);
    expect(p.charCount).toBe(0);
    expect(p.formattedText).toBe("");
  });
  it("flags over-limit posts", () => {
    const long = "x ".repeat(2000);
    const p = formatPost({ ...input, rawContent: long }, 1);
    expect(p.withinLimit).toBe(false);
  });
  it("different variations produce different headlines", () => {
    const p1 = formatPost(input, 1);
    const p2 = formatPost(input, 2);
    expect(p1.headline).not.toBe(p2.headline);
  });
});

describe("linkedin-post-formatter generateVariations", () => {
  it("generates 3 variations", () => {
    const v = generateVariations({
      rawContent: "I built a $1M app in 30 days. Focus matters.",
      postType: "text-post",
      includeHeadline: true,
      includeBullets: false,
      includeCTA: true,
      includeHashtags: true,
      tone: "thought-leader",
    });
    expect(v).toHaveLength(3);
  });
});

describe("linkedin-post-formatter computeStats", () => {
  it("computes stats across variations", () => {
    const v = generateVariations({
      rawContent: "I built a $1M app. Focus matters. Ship fast.",
      postType: "text-post",
      includeHeadline: true,
      includeBullets: true,
      includeCTA: true,
      includeHashtags: true,
      tone: "educator",
    });
    const stats = computeStats(v);
    expect(stats.totalVariations).toBe(3);
    expect(stats.avgCharCount).toBeGreaterThan(0);
    expect(stats.avgWordCount).toBeGreaterThan(0);
    expect(stats.totalHashtags).toBeGreaterThan(0);
    expect(stats.avgHookScore).toBeGreaterThan(0);
  });
  it("returns zeros for empty input", () => {
    const stats = computeStats([]);
    expect(stats.totalVariations).toBe(0);
    expect(stats.avgCharCount).toBe(0);
  });
});

describe("linkedin-post-formatter best times", () => {
  it("recommendBestTimes returns full list", () => {
    const t = recommendBestTimes();
    expect(t.length).toBeGreaterThanOrEqual(5);
  });
  it("topBestTimes returns only high-engagement", () => {
    const t = topBestTimes();
    expect(t.length).toBeGreaterThan(0);
    expect(t.every((x) => x.engagement === "high")).toBe(true);
  });
});

describe("linkedin-post-formatter renderText", () => {
  it("renders a text report with variations and best times", () => {
    const v = generateVariations({
      rawContent: "I built a $1M app. Focus matters.",
      postType: "text-post",
      includeHeadline: true,
      includeBullets: true,
      includeCTA: true,
      includeHashtags: true,
      tone: "thought-leader",
    });
    const text = renderText(v);
    expect(text).toContain("Variation 1");
    expect(text).toContain("Hook score");
    expect(text).toContain("Best Time to Post");
  });
  it("returns empty for empty input", () => {
    expect(renderText([])).toBe("");
  });
});

describe("linkedin-post-formatter renderHtml", () => {
  it("renders HTML with doctype", () => {
    const v = generateVariations({
      rawContent: "I built a $1M app.",
      postType: "text-post",
      includeHeadline: true,
      includeBullets: false,
      includeCTA: true,
      includeHashtags: true,
      tone: "thought-leader",
    });
    const html = renderHtml(v);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<body>");
    expect(html).toContain("Variation 1");
  });
});

describe("linkedin-post-formatter renderMarkdown", () => {
  it("renders markdown with headers", () => {
    const v = generateVariations({
      rawContent: "I built a $1M app.",
      postType: "text-post",
      includeHeadline: true,
      includeBullets: true,
      includeCTA: true,
      includeHashtags: true,
      tone: "educator",
    });
    const md = renderMarkdown(v);
    expect(md).toContain("## Variation 1");
    expect(md).toContain("**");
  });
});

describe("linkedin-post-formatter renderCsv", () => {
  it("renders header", () => {
    const csv = renderCsv([]);
    expect(csv).toContain("variation,post_type,tone,component,value");
  });
  it("renders rows per component", () => {
    const v = generateVariations({
      rawContent: "I built a $1M app.",
      postType: "text-post",
      includeHeadline: true,
      includeBullets: false,
      includeCTA: true,
      includeHashtags: true,
      tone: "thought-leader",
    });
    const csv = renderCsv(v);
    expect(csv).toContain("1,text-post,thought-leader,headline");
    expect(csv).toContain("char_count");
    expect(csv).toContain("hook_score");
  });
});

describe("linkedin-post-formatter splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
});

describe("linkedin-post-formatter history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, postType: "text-post", tone: "thought-leader", charCount: 100, preview: "..." });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, postType: "text-post", tone: "thought-leader", charCount: 1, preview: "x" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, postType: "text-post", tone: "thought-leader", charCount: 1, preview: "x" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("linkedin-post-formatter shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      rawContent: "test content",
      postType: "text-post",
      includeHeadline: true,
      includeBullets: true,
      includeCTA: true,
      includeHashtags: true,
      tone: "thought-leader",
    });
    expect(url).toContain("content=test+content");
    expect(url).toContain("type=text-post");
    expect(url).toContain("tone=thought-leader");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("content=hello+world&type=hiring&tone=analyst&hook=1&bullets=1&cta=1&tags=1");
    expect(p.rawContent).toBe("hello world");
    expect(p.postType).toBe("hiring");
    expect(p.tone).toBe("analyst");
    expect(p.includeHeadline).toBe(true);
    expect(p.includeBullets).toBe(true);
    expect(p.includeCTA).toBe(true);
    expect(p.includeHashtags).toBe(true);
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.rawContent).toBe("");
    expect(p.postType).toBe("text-post");
    expect(p.tone).toBe("thought-leader");
  });
  it("filters unknown post types and tones", () => {
    const p = parseShareUrl("content=x&type=unknown&tone=unknown");
    expect(p.postType).toBe("text-post");
    expect(p.tone).toBe("thought-leader");
  });
});

// Suppress unused-import lint
export type _Unused = PostType | Tone | PostInput;
