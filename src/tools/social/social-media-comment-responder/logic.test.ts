import { describe, it, expect, beforeEach } from "vitest";
import {
  PLATFORM_PRESETS,
  TONE_PRESETS,
  LENGTH_PRESETS,
  RESPONSE_TEMPLATES,
  EMOJI_MAP,
  CTA_PRESETS,
  BEST_PRACTICE_TIPS,
  PLATFORM_CHAR_LIMITS,
  normalizeComment,
  analyzeSentiment,
  detectEscalation,
  highlightKeywords,
  getResponseTimeSuggestion,
  getBestPracticeTips,
  applyToneModifier,
  applyPlatformFormatting,
  applyLengthControl,
  appendEmoji,
  appendCTA,
  scoreResponseQuality,
  generateResponseVariation,
  generateResponses,
  renderText,
  renderCsv,
  splitCsvRow,
  computeSummaryStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  countTemplates,
  type ResponseInput,
  type Sentiment,
  type Tone,
  type Platform,
  type ResponseLength,
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

describe("social-media-comment-responder constants", () => {
  it("has 6 platforms", () => {
    expect(PLATFORM_PRESETS).toHaveLength(6);
  });
  it("has 6 tones", () => {
    expect(TONE_PRESETS).toHaveLength(6);
  });
  it("has 3 lengths", () => {
    expect(LENGTH_PRESETS).toHaveLength(3);
  });
  it("has 50+ templates via countTemplates()", () => {
    expect(countTemplates()).toBeGreaterThanOrEqual(50);
  });
  it("has exactly 72 templates (4 sentiments × 6 tones × 3)", () => {
    expect(countTemplates()).toBe(72);
  });
  it("has 3 templates per sentiment × tone combo", () => {
    const sentiments: Sentiment[] = ["positive", "neutral", "negative", "mixed"];
    const tones: Tone[] = ["professional", "friendly", "casual", "apologetic", "grateful", "educational"];
    for (const s of sentiments) {
      for (const t of tones) {
        expect(RESPONSE_TEMPLATES[s][t]).toHaveLength(3);
      }
    }
  });
  it("has emoji map for all 4 sentiments", () => {
    expect(Object.keys(EMOJI_MAP)).toHaveLength(4);
    expect(EMOJI_MAP.positive.length).toBeGreaterThan(0);
  });
  it("has CTA presets for all 6 platforms", () => {
    expect(Object.keys(CTA_PRESETS)).toHaveLength(6);
    expect(CTA_PRESETS.twitter.length).toBeGreaterThan(0);
  });
  it("has best practice tips for all 4 sentiments", () => {
    expect(Object.keys(BEST_PRACTICE_TIPS)).toHaveLength(4);
    expect(BEST_PRACTICE_TIPS.negative.length).toBeGreaterThanOrEqual(3);
  });
  it("twitter char limit is 280", () => {
    expect(PLATFORM_CHAR_LIMITS.twitter).toBe(280);
  });
  it("tiktok has shortest char limit", () => {
    expect(PLATFORM_CHAR_LIMITS.tiktok).toBe(150);
  });
});

describe("social-media-comment-responder normalizeComment", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeComment("  Hello   world  ")).toBe("Hello world");
  });
  it("handles empty", () => {
    expect(normalizeComment("")).toBe("");
  });
});

describe("social-media-comment-responder analyzeSentiment", () => {
  it("detects positive", () => {
    expect(analyzeSentiment("I absolutely love this product, it is amazing!")).toBe("positive");
  });
  it("detects negative", () => {
    expect(analyzeSentiment("This is terrible and broken, worst service ever.")).toBe("negative");
  });
  it("detects neutral", () => {
    expect(analyzeSentiment("Just leaving a comment here.")).toBe("neutral");
  });
  it("detects mixed", () => {
    expect(analyzeSentiment("I love the design but the service is terrible.")).toBe("mixed");
  });
  it("returns neutral for empty", () => {
    expect(analyzeSentiment("")).toBe("neutral");
  });
});

describe("social-media-comment-responder detectEscalation", () => {
  it("detects legal keywords", () => {
    const r = detectEscalation("I will sue you for defamation!");
    expect(r.escalated).toBe(true);
    expect(r.reason).toBe("legal");
    expect(r.matchedKeywords.length).toBeGreaterThan(0);
  });
  it("detects threatening keywords", () => {
    const r = detectEscalation("My lawyer will be in touch about this.");
    expect(r.escalated).toBe(true);
    expect(r.reason).toBe("threatening");
  });
  it("detects angry keywords", () => {
    const r = detectEscalation("This is a scam and completely ridiculous!");
    expect(r.escalated).toBe(true);
    expect(r.matchedKeywords).toContain("scam");
    expect(r.matchedKeywords).toContain("ridiculous");
  });
  it("returns not escalated for normal comment", () => {
    const r = detectEscalation("Thanks for the great service!");
    expect(r.escalated).toBe(false);
    expect(r.matchedKeywords).toEqual([]);
    expect(r.reason).toBeNull();
  });
});

describe("social-media-comment-responder highlightKeywords", () => {
  it("wraps sensitive words in markers", () => {
    const r = highlightKeywords("This is a scam and I will sue.");
    expect(r.highlighted).toContain("[[scam]]");
    expect(r.highlighted).toContain("[[sue]]");
    expect(r.found.length).toBeGreaterThanOrEqual(2);
  });
  it("returns no markers for normal comment", () => {
    const r = highlightKeywords("Thanks for the help!");
    expect(r.highlighted).toBe("Thanks for the help!");
    expect(r.found).toEqual([]);
  });
});

describe("social-media-comment-responder getResponseTimeSuggestion", () => {
  it("returns within 1 hour for twitter", () => {
    expect(getResponseTimeSuggestion("twitter")).toBe("Within 1 hour");
  });
  it("returns within 24 hours for linkedin", () => {
    expect(getResponseTimeSuggestion("linkedin")).toBe("Within 24 hours");
  });
  it("returns within 2 hours for tiktok", () => {
    expect(getResponseTimeSuggestion("tiktok")).toBe("Within 2 hours");
  });
});

describe("social-media-comment-responder getBestPracticeTips", () => {
  it("returns tips for negative sentiment", () => {
    const tips = getBestPracticeTips("negative");
    expect(tips.length).toBeGreaterThan(0);
    expect(tips.some((t) => /apolog|frustration|acknowledge/i.test(t))).toBe(true);
  });
  it("returns tips for positive sentiment", () => {
    const tips = getBestPracticeTips("positive");
    expect(tips.length).toBeGreaterThan(0);
  });
});

describe("social-media-comment-responder applyToneModifier", () => {
  it("expands contractions for professional", () => {
    expect(applyToneModifier("We're glad you don't have issues.", "professional"))
      .toBe("We are glad you do not have issues.");
  });
  it("lowercases first letter for casual", () => {
    expect(applyToneModifier("Thanks for the love", "casual")).toBe("thanks for the love");
  });
  it("adds exclamation for friendly", () => {
    expect(applyToneModifier("Thanks for the love", "friendly")).toBe("Thanks for the love!");
  });
  it("prefixes apology for apologetic when not already apologetic", () => {
    expect(applyToneModifier("We missed the mark", "apologetic")).toBe("We're sorry — We missed the mark.");
  });
  it("does not double-prefix when already apologetic", () => {
    const out = applyToneModifier("Sorry for the delay", "apologetic");
    expect(out.startsWith("Sorry")).toBe(true);
    expect(out.startsWith("We're sorry — Sorry")).toBe(false);
  });
  it("prefixes thanks for grateful when not already grateful", () => {
    expect(applyToneModifier("Here is your feedback", "grateful")).toBe("Thank you — Here is your feedback!");
  });
  it("does not double-prefix when already grateful", () => {
    const out = applyToneModifier("Thank you for sharing", "grateful");
    expect(out.startsWith("Thank you — Thank")).toBe(false);
  });
});

describe("social-media-comment-responder applyPlatformFormatting", () => {
  it("does not truncate under limit", () => {
    const r = applyPlatformFormatting("short text", "twitter");
    expect(r.truncated).toBe(false);
    expect(r.text).toBe("short text");
  });
  it("truncates over twitter limit", () => {
    const long = "a".repeat(300);
    const r = applyPlatformFormatting(long, "twitter");
    expect(r.truncated).toBe(true);
    expect(r.text.length).toBeLessThanOrEqual(280);
    expect(r.text.endsWith("…")).toBe(true);
  });
  it("does not truncate long text under youtube limit", () => {
    const r = applyPlatformFormatting("a".repeat(500), "youtube");
    expect(r.truncated).toBe(false);
  });
  it("truncates over tiktok limit (150)", () => {
    const long = "word ".repeat(40); // 200 chars
    const r = applyPlatformFormatting(long.trim(), "tiktok");
    expect(r.truncated).toBe(true);
    expect(r.text.length).toBeLessThanOrEqual(150);
  });
});

describe("social-media-comment-responder applyLengthControl", () => {
  const templates = ["One.", "Two.", "Three."];
  it("returns one template for short", () => {
    expect(applyLengthControl(templates, "short", 0)).toBe("One.");
  });
  it("combines two templates for medium", () => {
    expect(applyLengthControl(templates, "medium", 0)).toBe("One. Two.");
  });
  it("combines three templates for long", () => {
    expect(applyLengthControl(templates, "long", 0)).toBe("One. Two. Three.");
  });
  it("rotates by variation index", () => {
    expect(applyLengthControl(templates, "short", 1)).toBe("Two.");
    expect(applyLengthControl(templates, "short", 2)).toBe("Three.");
  });
  it("wraps around for long variation 2", () => {
    // templates[2] + templates[0] + templates[1]
    expect(applyLengthControl(templates, "long", 2)).toBe("Three. One. Two.");
  });
  it("returns empty for empty templates", () => {
    expect(applyLengthControl([], "short", 0)).toBe("");
  });
});

describe("social-media-comment-responder appendEmoji", () => {
  it("appends sentiment-aware emoji", () => {
    const r = appendEmoji("Thanks!", "positive", 0);
    expect(r.length).toBeGreaterThan("Thanks!".length);
    expect(r.startsWith("Thanks! ")).toBe(true);
  });
  it("rotates emojis by variation", () => {
    const r0 = appendEmoji("Thanks!", "positive", 0);
    const r1 = appendEmoji("Thanks!", "positive", 1);
    expect(r0).not.toBe(r1);
  });
  it("returns just emoji for empty text", () => {
    const r = appendEmoji("", "positive", 0);
    expect(r.length).toBeGreaterThan(0);
  });
});

describe("social-media-comment-responder appendCTA", () => {
  it("appends platform-specific CTA", () => {
    const r = appendCTA("Thanks!", "twitter", 0);
    expect(r).toContain("DM us");
    expect(r).not.toBe("Thanks!");
  });
  it("appends instagram CTA with link in bio", () => {
    const r = appendCTA("Thanks!", "instagram", 0);
    expect(r).toContain("Link in bio");
  });
  it("rotates CTA by variation", () => {
    const r0 = appendCTA("Thanks!", "twitter", 0);
    const r1 = appendCTA("Thanks!", "twitter", 1);
    expect(r0).not.toBe(r1);
  });
});

describe("social-media-comment-responder scoreResponseQuality", () => {
  it("returns score between 0 and 100", () => {
    const input: ResponseInput = {
      originalComment: "I love this!",
      commentSentiment: "positive",
      responseTone: "grateful",
      platform: "twitter",
      responseLength: "short",
      includeEmoji: false,
      includeCTA: false,
    };
    const v = generateResponseVariation(input, 0);
    const s = scoreResponseQuality(v, input);
    expect(s.total).toBeGreaterThanOrEqual(0);
    expect(s.total).toBeLessThanOrEqual(100);
    expect(s.lengthMatch).toBeGreaterThanOrEqual(0);
    expect(s.toneMatch).toBeGreaterThanOrEqual(0);
    expect(s.empathy).toBeGreaterThanOrEqual(0);
    expect(s.platformFit).toBeGreaterThanOrEqual(0);
  });
  it("reduces platform fit when truncated", () => {
    const input: ResponseInput = {
      originalComment: "I love this product and your service is amazing!",
      commentSentiment: "positive",
      responseTone: "educational",
      platform: "tiktok",
      responseLength: "long",
      includeEmoji: true,
      includeCTA: true,
    };
    const v = generateResponseVariation(input, 0);
    const s = scoreResponseQuality(v, input);
    if (v.truncated) {
      expect(s.platformFit).toBe(10);
    } else {
      expect(s.platformFit).toBe(20);
    }
  });
});

describe("social-media-comment-responder generateResponses", () => {
  it("generates 3 variations", () => {
    const input: ResponseInput = {
      originalComment: "I love this product!",
      commentSentiment: "positive",
      responseTone: "friendly",
      platform: "twitter",
      responseLength: "short",
      includeEmoji: false,
      includeCTA: false,
    };
    const rs = generateResponses(input);
    expect(rs).toHaveLength(3);
    expect(rs[0].text).toBeTruthy();
    expect(rs[0].sentiment).toBe("positive");
    expect(rs[0].tone).toBe("friendly");
    expect(rs[0].platform).toBe("twitter");
    expect(rs[0].index).toBe(0);
    expect(rs[1].index).toBe(1);
    expect(rs[2].index).toBe(2);
  });
  it("returns empty for empty comment", () => {
    const input: ResponseInput = {
      originalComment: "",
      commentSentiment: "auto",
      responseTone: "professional",
      platform: "twitter",
      responseLength: "short",
      includeEmoji: false,
      includeCTA: false,
    };
    expect(generateResponses(input)).toEqual([]);
  });
  it("returns empty for whitespace-only comment", () => {
    const input: ResponseInput = {
      originalComment: "   \n\t  ",
      commentSentiment: "auto",
      responseTone: "professional",
      platform: "twitter",
      responseLength: "short",
      includeEmoji: false,
      includeCTA: false,
    };
    expect(generateResponses(input)).toEqual([]);
  });
  it("auto-detects sentiment when set to auto", () => {
    const input: ResponseInput = {
      originalComment: "This is terrible and broken.",
      commentSentiment: "auto",
      responseTone: "apologetic",
      platform: "facebook",
      responseLength: "medium",
      includeEmoji: false,
      includeCTA: false,
    };
    const rs = generateResponses(input);
    expect(rs[0].sentiment).toBe("negative");
  });
  it("applies emoji when enabled", () => {
    const input: ResponseInput = {
      originalComment: "Great job!",
      commentSentiment: "positive",
      responseTone: "casual",
      platform: "instagram",
      responseLength: "short",
      includeEmoji: true,
      includeCTA: false,
    };
    const withoutEmoji = generateResponses({ ...input, includeEmoji: false })[0].text;
    const withEmoji = generateResponses(input)[0].text;
    expect(withEmoji.length).toBeGreaterThan(withoutEmoji.length);
  });
  it("applies CTA when enabled", () => {
    const input: ResponseInput = {
      originalComment: "Great job!",
      commentSentiment: "positive",
      responseTone: "casual",
      platform: "twitter",
      responseLength: "short",
      includeEmoji: false,
      includeCTA: true,
    };
    const rs = generateResponses(input);
    expect(rs[0].text).toContain("DM us");
  });
  it("variations are different for medium length", () => {
    const input: ResponseInput = {
      originalComment: "I love this!",
      commentSentiment: "positive",
      responseTone: "professional",
      platform: "youtube",
      responseLength: "medium",
      includeEmoji: false,
      includeCTA: false,
    };
    const rs = generateResponses(input);
    expect(rs[0].text).not.toBe(rs[1].text);
    expect(rs[1].text).not.toBe(rs[2].text);
    expect(rs[0].text).not.toBe(rs[2].text);
  });
  it("uses explicit sentiment when not auto", () => {
    const input: ResponseInput = {
      originalComment: "I love this!", // would auto-detect as positive
      commentSentiment: "negative", // but explicitly set to negative
      responseTone: "apologetic",
      platform: "twitter",
      responseLength: "short",
      includeEmoji: false,
      includeCTA: false,
    };
    const rs = generateResponses(input);
    expect(rs[0].sentiment).toBe("negative");
  });
});

describe("social-media-comment-responder renderText", () => {
  it("joins variations with separator", () => {
    const input: ResponseInput = {
      originalComment: "Thanks!",
      commentSentiment: "positive",
      responseTone: "professional",
      platform: "twitter",
      responseLength: "short",
      includeEmoji: false,
      includeCTA: false,
    };
    const rs = generateResponses(input);
    const text = renderText(rs);
    expect(text).toContain("---");
  });
  it("returns empty for empty input", () => {
    expect(renderText([])).toBe("");
  });
});

describe("social-media-comment-responder renderCsv", () => {
  it("renders header", () => {
    expect(renderCsv([])).toContain("variation,response,char_count,sentiment,tone,platform,length,truncated");
  });
  it("renders rows", () => {
    const input: ResponseInput = {
      originalComment: "Thanks!",
      commentSentiment: "positive",
      responseTone: "professional",
      platform: "twitter",
      responseLength: "short",
      includeEmoji: false,
      includeCTA: false,
    };
    const rs = generateResponses(input);
    const csv = renderCsv(rs);
    expect(csv).toContain("positive");
    expect(csv).toContain("professional");
    expect(csv).toContain("twitter");
    expect(csv.split("\n").length).toBe(4); // header + 3 rows
  });
});

describe("social-media-comment-responder splitCsvRow", () => {
  it("splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
});

describe("social-media-comment-responder computeSummaryStats", () => {
  it("computes summary stats for variations", () => {
    const input: ResponseInput = {
      originalComment: "I love this!",
      commentSentiment: "positive",
      responseTone: "professional",
      platform: "twitter",
      responseLength: "short",
      includeEmoji: false,
      includeCTA: false,
    };
    const rs = generateResponses(input);
    const stats = computeSummaryStats(rs);
    expect(stats.totalVariations).toBe(3);
    expect(stats.bySentiment.positive).toBe(3);
    expect(stats.bySentiment.negative).toBe(0);
    expect(stats.avgCharCount).toBeGreaterThan(0);
  });
  it("returns zeros for empty input", () => {
    const stats = computeSummaryStats([]);
    expect(stats.totalVariations).toBe(0);
    expect(stats.avgCharCount).toBe(0);
    expect(stats.avgQualityScore).toBe(0);
  });
  it("tracks escalation count", () => {
    const stats = computeSummaryStats([], [], 2);
    expect(stats.escalatedCount).toBe(2);
  });
});

describe("social-media-comment-responder history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      comment: "hello",
      sentiment: "positive",
      tone: "professional",
      platform: "twitter",
      length: "short",
      variationCount: 3,
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].comment).toBe("hello");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        comment: `c${i}`,
        sentiment: "positive",
        tone: "professional",
        platform: "twitter",
        length: "short",
        variationCount: 3,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, comment: "x", sentiment: "positive", tone: "professional",
      platform: "twitter", length: "short", variationCount: 3,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("social-media-comment-responder shareable URL", () => {
  it("builds share URL with all params when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const input: ResponseInput = {
      originalComment: "I love this",
      commentSentiment: "positive",
      responseTone: "professional",
      platform: "twitter",
      responseLength: "short",
      includeEmoji: true,
      includeCTA: false,
    };
    const url = buildShareUrl(input);
    expect(url).toContain("comment=I+love+this");
    expect(url).toContain("sentiment=positive");
    expect(url).toContain("tone=professional");
    expect(url).toContain("platform=twitter");
    expect(url).toContain("length=short");
    expect(url).toContain("emoji=1");
    expect(url).toContain("cta=0");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const hash = "#comment=I+love+this&sentiment=positive&tone=professional&platform=twitter&length=short&emoji=1&cta=0";
    const parsed = parseShareUrl(hash);
    expect(parsed.originalComment).toBe("I love this");
    expect(parsed.commentSentiment).toBe("positive");
    expect(parsed.responseTone).toBe("professional");
    expect(parsed.platform).toBe("twitter");
    expect(parsed.responseLength).toBe("short");
    expect(parsed.includeEmoji).toBe(true);
    expect(parsed.includeCTA).toBe(false);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown values", () => {
    const p = parseShareUrl("tone=unknown&platform=myspace&length=huge");
    expect(p.responseTone).toBeUndefined();
    expect(p.platform).toBeUndefined();
    expect(p.responseLength).toBeUndefined();
  });
  it("accepts sentiment=auto", () => {
    const p = parseShareUrl("sentiment=auto");
    expect(p.commentSentiment).toBe("auto");
  });
});

// Suppress unused-import lint
export type _Unused = Sentiment | Tone | Platform | ResponseLength;
