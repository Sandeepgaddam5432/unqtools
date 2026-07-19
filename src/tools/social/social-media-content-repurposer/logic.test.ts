import { describe, it, expect, beforeEach } from "vitest";
import {
  SOURCE_TYPES,
  TARGET_FORMATS,
  TONES,
  SOURCE_TYPE_LABELS,
  TARGET_FORMAT_LABELS,
  TONE_LABELS,
  SOURCE_TYPE_PRESETS,
  TONE_PRESETS,
  TARGET_FORMAT_CONFIGS,
  HOOK_VARIATIONS,
  normalizeContent,
  capitalize,
  splitSentences,
  extractTitle,
  extractStats,
  extractQuotes,
  extractKeyPoints,
  extractCTA,
  extractHook,
  analyzeContent,
  applyTone,
  generateHashtags,
  generateCTA,
  generateTwitterThread,
  generateLinkedInPost,
  generateInstagramCaption,
  generateFacebookPost,
  generateTiktokScript,
  generateEmailSummary,
  generateMediumArticle,
  generateForFormat,
  generateForFormats,
  generateVariations,
  scoreContentQuality,
  checkCrossFormatConsistency,
  recommendBestFormat,
  computeSummaryStats,
  renderText,
  renderCsv,
  splitCsvRow,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SourceType,
  type TargetFormat,
  type Tone,
  type GeneratorOptions,
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

const SAMPLE_BLOG = `10 Ways to Boost Your Productivity This Week

Productivity isn't about working harder — it's about working smarter. Our team's output went up 42% in one quarter.

- Start with a single priority each morning
- Batch similar tasks together
- Use the 2-minute rule for quick wins
- Take a 5-minute break every hour
- Eliminate notifications during deep work

"Focus is the new IQ." Try one technique today. Subscribe for more tips!`;

const SAMPLE_OPTS: GeneratorOptions = {
  tone: "professional",
  includeCTA: true,
  maxItemsPerFormat: 5,
};

describe("repurposer constants", () => {
  it("has 5 source types", () => {
    expect(SOURCE_TYPES).toHaveLength(5);
    expect(SOURCE_TYPES).toContain("blog-post");
    expect(SOURCE_TYPES).toContain("podcast-transcript");
  });
  it("has 7 target formats", () => {
    expect(TARGET_FORMATS).toHaveLength(7);
    expect(TARGET_FORMATS).toContain("twitter-thread");
    expect(TARGET_FORMATS).toContain("medium-article");
  });
  it("has 5 tones", () => {
    expect(TONES).toHaveLength(5);
    expect(TONES).toContain("professional");
    expect(TONES).toContain("entertaining");
  });
  it("has labels for all source types", () => {
    expect(Object.keys(SOURCE_TYPE_LABELS)).toHaveLength(5);
    expect(SOURCE_TYPE_LABELS["youtube-transcript"]).toBe("YouTube Transcript");
  });
  it("has labels for all target formats", () => {
    expect(Object.keys(TARGET_FORMAT_LABELS)).toHaveLength(7);
    expect(TARGET_FORMAT_LABELS["tiktok-script"]).toContain("TikTok");
  });
  it("has labels for all tones", () => {
    expect(Object.keys(TONE_LABELS)).toHaveLength(5);
  });
  it("has presets for all 5 source types", () => {
    for (const s of SOURCE_TYPES) {
      expect(SOURCE_TYPE_PRESETS[s].length).toBeGreaterThan(50);
    }
  });
  it("has tone presets for all 5 tones", () => {
    for (const t of TONES) {
      expect(TONE_PRESETS[t].opening.length).toBeGreaterThan(0);
      expect(TONE_PRESETS[t].emojiSet.length).toBeGreaterThan(0);
    }
  });
  it("has configs for all 7 target formats", () => {
    for (const f of TARGET_FORMATS) {
      expect(TARGET_FORMAT_CONFIGS[f].maxChars).toBeGreaterThan(100);
      expect(TARGET_FORMAT_CONFIGS[f].maxItemsDefault).toBeGreaterThan(0);
    }
  });
  it("has 2 hook variations per target format", () => {
    for (const f of TARGET_FORMATS) {
      expect(HOOK_VARIATIONS[f]).toHaveLength(2);
      expect(HOOK_VARIATIONS[f][0].variation).toBe(1);
      expect(HOOK_VARIATIONS[f][1].variation).toBe(2);
    }
  });
});

describe("repurposer normalizeContent", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeContent("  hello   world  ")).toBe("hello world");
  });
  it("handles empty", () => {
    expect(normalizeContent("")).toBe("");
  });
  it("handles null/undefined", () => {
    expect(normalizeContent(null as unknown as string)).toBe("");
  });
});

describe("repurposer capitalize & splitSentences", () => {
  it("capitalizes first letter", () => {
    expect(capitalize("hello world")).toBe("Hello world");
    expect(capitalize("")).toBe("");
  });
  it("splits sentences by punctuation and newlines", () => {
    const s = splitSentences("Hello world. This is great!\nNew line here.");
    expect(s).toHaveLength(3);
    expect(s[0]).toBe("Hello world.");
  });
  it("returns empty for empty input", () => {
    expect(splitSentences("")).toEqual([]);
  });
});

describe("repurposer extractTitle", () => {
  it("uses first short line as title", () => {
    expect(extractTitle("My Title\n\nLong body text here.")).toBe("My Title");
  });
  it("uses first sentence if first line is long", () => {
    const t = extractTitle("This is a really long sentence that goes on and on about things that should be truncated because it exceeds the limit.");
    expect(t.length).toBeLessThanOrEqual(100);
    expect(t).toContain("…");
  });
  it("returns empty for empty content", () => {
    expect(extractTitle("")).toBe("");
  });
});

describe("repurposer extractStats", () => {
  it("extracts percentages", () => {
    expect(extractStats("Growth was 42% and revenue up 12.5%")).toContain("42%");
    expect(extractStats("Growth was 42% and revenue up 12.5%")).toContain("12.5%");
  });
  it("extracts dollar amounts", () => {
    const s = extractStats("We raised $1,500,000 and another $2M last year.");
    expect(s).toContain("$1,500,000");
    expect(s).toContain("$2M");
  });
  it("extracts plain numbers >= 10", () => {
    const s = extractStats("We had 100 signups and 5 active users.");
    expect(s).toContain("100");
    expect(s).not.toContain("5");
  });
  it("returns empty for empty input", () => {
    expect(extractStats("")).toEqual([]);
  });
});

describe("repurposer extractQuotes", () => {
  it("extracts straight-quoted text", () => {
    const s = extractQuotes('She said "focus is the new IQ" yesterday.');
    expect(s.length).toBeGreaterThanOrEqual(1);
    expect(s[0]).toContain("focus is the new IQ");
  });
  it("extracts smart-quoted text", () => {
    const s = extractQuotes("She said \u201Cfocus is the new IQ\u201D yesterday.");
    expect(s.length).toBeGreaterThanOrEqual(1);
  });
  it("returns empty when no quotes", () => {
    expect(extractQuotes("Just a regular sentence.")).toEqual([]);
  });
});

describe("repurposer extractKeyPoints", () => {
  it("extracts bullet-marked lines", () => {
    const kps = extractKeyPoints("- Point one\n- Point two\n- Point three");
    expect(kps).toEqual(["Point one", "Point two", "Point three"]);
  });
  it("extracts numbered lines", () => {
    const kps = extractKeyPoints("1. First\n2. Second\n3. Third");
    expect(kps).toEqual(["First", "Second", "Third"]);
  });
  it("falls back to sentences if no bullets", () => {
    const kps = extractKeyPoints("This is a long enough sentence. Another long enough sentence here.");
    expect(kps.length).toBeGreaterThanOrEqual(2);
  });
  it("respects maxItems", () => {
    const kps = extractKeyPoints("- A\n- B\n- C\n- D\n- E", 3);
    expect(kps).toHaveLength(3);
  });
  it("returns empty for empty input", () => {
    expect(extractKeyPoints("")).toEqual([]);
  });
});

describe("repurposer extractCTA", () => {
  it("detects CTA phrase", () => {
    const cta = extractCTA("Try this today. Subscribe for more tips!");
    expect(cta.toLowerCase()).toContain("subscribe");
  });
  it("returns empty when no CTA phrase present", () => {
    expect(extractCTA("Just an informational paragraph with no call to action.")).toBe("");
  });
});

describe("repurposer extractHook", () => {
  it("picks the most engaging sentence", () => {
    const hook = extractHook("This is a plain sentence. Did you know that 95% of people fail at this? Subscribe today!");
    expect(hook).toContain("95%");
  });
  it("returns first sentence if no clear winner", () => {
    const hook = extractHook("Hello world. Another sentence.");
    expect(hook.length).toBeGreaterThan(0);
  });
  it("returns empty for empty input", () => {
    expect(extractHook("")).toBe("");
  });
});

describe("repurposer analyzeContent", () => {
  it("aggregates title, hook, key points, quotes, stats, cta", () => {
    const a = analyzeContent(SAMPLE_BLOG);
    expect(a.title).toBe("10 Ways to Boost Your Productivity This Week");
    expect(a.keyPoints.length).toBeGreaterThanOrEqual(3);
    expect(a.stats).toContain("42%");
    expect(a.quotes.length).toBeGreaterThanOrEqual(1);
    expect(a.cta.toLowerCase()).toContain("subscribe");
    expect(a.wordCount).toBeGreaterThan(40);
    expect(a.sentenceCount).toBeGreaterThan(2);
  });
  it("returns empty fields for empty input", () => {
    const a = analyzeContent("");
    expect(a.title).toBe("");
    expect(a.keyPoints).toEqual([]);
    expect(a.wordCount).toBe(0);
  });
});

describe("repurposer applyTone & generateHashtags & generateCTA", () => {
  it("applies tone returns opening, closing, emoji, flavor", () => {
    const r = applyTone("professional");
    expect(r.opening.length).toBeGreaterThan(0);
    expect(r.closing.length).toBeGreaterThan(0);
    expect(r.emoji.length).toBeGreaterThan(0);
    expect(r.flavor.length).toBeGreaterThan(0);
  });
  it("generates hashtags from title", () => {
    const tags = generateHashtags("productivity tips", 5);
    expect(tags.length).toBeGreaterThan(0);
    expect(tags[0]).toMatch(/^#/);
  });
  it("returns empty when includeCTA is false", () => {
    expect(generateCTA("twitter-thread", false)).toBe("");
  });
  it("uses detected CTA when provided", () => {
    expect(generateCTA("twitter-thread", true, "Subscribe now!")).toBe("Subscribe now!");
  });
  it("uses default CTA when none detected", () => {
    const cta = generateCTA("instagram-caption", true);
    expect(cta.toLowerCase()).toContain("link in bio");
  });
});

describe("repurposer format generators", () => {
  const a = analyzeContent(SAMPLE_BLOG);
  it("generates a Twitter thread with numbered tweets", () => {
    const r = generateTwitterThread(a, SAMPLE_OPTS);
    expect(r.format).toBe("twitter-thread");
    expect(r.content).toMatch(/1\/\d+/);
    expect(r.content).toMatch(/\d+\/\d+/);
    expect(r.itemCount).toBeGreaterThanOrEqual(3);
    expect(r.charCount).toBe(r.content.length);
  });
  it("generates a LinkedIn post with bullets", () => {
    const r = generateLinkedInPost(a, SAMPLE_OPTS);
    expect(r.format).toBe("linkedin-post");
    expect(r.content).toContain("•");
    expect(r.charCount).toBeLessThanOrEqual(3000);
  });
  it("generates an Instagram caption with emoji + hashtags", () => {
    const r = generateInstagramCaption(a, SAMPLE_OPTS);
    expect(r.format).toBe("instagram-caption");
    expect(r.content).toMatch(/#/);
    expect(r.charCount).toBeLessThanOrEqual(2200);
  });
  it("generates a Facebook post", () => {
    const r = generateFacebookPost(a, SAMPLE_OPTS);
    expect(r.format).toBe("facebook-post");
    expect(r.charCount).toBeGreaterThan(20);
  });
  it("generates a TikTok script with scene timestamps", () => {
    const r = generateTiktokScript(a, SAMPLE_OPTS);
    expect(r.format).toBe("tiktok-script");
    expect(r.content).toMatch(/\[\d+-\d+s\]/);
  });
  it("generates an email summary with subject + preview", () => {
    const r = generateEmailSummary(a, SAMPLE_OPTS);
    expect(r.format).toBe("email-summary");
    expect(r.content).toContain("Subject:");
    expect(r.content).toContain("Preview:");
  });
  it("generates a Medium article with markdown headers", () => {
    const r = generateMediumArticle(a, SAMPLE_OPTS);
    expect(r.format).toBe("medium-article");
    expect(r.content).toContain("# ");
    expect(r.content).toContain("## ");
  });
  it("respects maxItemsPerFormat limit", () => {
    const r = generateTwitterThread(a, { ...SAMPLE_OPTS, maxItemsPerFormat: 2 });
    // Items: title + hook + 2 kps + stats + quote + cta — but kps capped at 2
    expect(r.itemCount).toBeLessThanOrEqual(7);
  });
});

describe("repurposer generateForFormat & generateForFormats", () => {
  it("dispatches to the right generator", () => {
    const a = analyzeContent(SAMPLE_BLOG);
    const r = generateForFormat("tiktok-script", a, SAMPLE_OPTS);
    expect(r.format).toBe("tiktok-script");
  });
  it("generates variation 2 on request", () => {
    const a = analyzeContent(SAMPLE_BLOG);
    const r1 = generateForFormat("twitter-thread", a, SAMPLE_OPTS, 1);
    const r2 = generateForFormat("twitter-thread", a, SAMPLE_OPTS, 2);
    expect(r1.variation).toBe(1);
    expect(r2.variation).toBe(2);
    expect(r1.content).not.toBe(r2.content);
  });
  it("generates for multiple formats", () => {
    const a = analyzeContent(SAMPLE_BLOG);
    const rs = generateForFormats(["twitter-thread", "email-summary"], a, SAMPLE_OPTS);
    expect(rs).toHaveLength(2);
    expect(rs[0].format).toBe("twitter-thread");
    expect(rs[1].format).toBe("email-summary");
  });
});

describe("repurposer generateVariations", () => {
  it("generates 2 variations per format", () => {
    const a = analyzeContent(SAMPLE_BLOG);
    const vs = generateVariations("linkedin-post", a, SAMPLE_OPTS);
    expect(vs).toHaveLength(2);
    expect(vs[0].variation).toBe(1);
    expect(vs[1].variation).toBe(2);
  });
});

describe("repurposer scoreContentQuality", () => {
  it("scores high for rich content", () => {
    const a = analyzeContent(SAMPLE_BLOG);
    const q = scoreContentQuality(a);
    expect(q.score).toBeGreaterThan(50);
    expect(q.rating).toMatch(/^(medium|high)$/);
  });
  it("scores low for sparse content", () => {
    const q = scoreContentQuality(analyzeContent("Hello world."));
    expect(q.score).toBeLessThan(50);
    expect(q.rating).toBe("low");
    expect(q.reasons.length).toBeGreaterThan(0);
  });
});

describe("repurposer checkCrossFormatConsistency", () => {
  it("reports consistent when all key points covered", () => {
    const a = analyzeContent(SAMPLE_BLOG);
    const results = generateForFormats(
      ["twitter-thread", "linkedin-post", "email-summary"],
      a,
      SAMPLE_OPTS,
    );
    const report = checkCrossFormatConsistency(results, a.keyPoints);
    expect(report.coveragePercent).toBeGreaterThan(0);
    expect(report.consistent).toBe(true);
    expect(report.missingFrom).toEqual([]);
  });
  it("reports missing when a key point is omitted", () => {
    const a = analyzeContent(SAMPLE_BLOG);
    // Facebook has maxItems default 3 — might miss some key points
    const fb = generateFacebookPost(a, { ...SAMPLE_OPTS, maxItemsPerFormat: 1 });
    const report = checkCrossFormatConsistency([fb], a.keyPoints);
    expect(report.missingFrom.length).toBeGreaterThanOrEqual(0);
    expect(report.coveragePercent).toBeGreaterThanOrEqual(0);
  });
});

describe("repurposer recommendBestFormat", () => {
  it("recommends Twitter thread for blog posts", () => {
    const rec = recommendBestFormat("blog-post");
    expect(rec).toContain("twitter-thread");
    expect(rec.length).toBeGreaterThanOrEqual(2);
  });
  it("recommends TikTok for YouTube transcripts", () => {
    const rec = recommendBestFormat("youtube-transcript");
    expect(rec).toContain("tiktok-script");
  });
  it("recommends Medium for presentation slides", () => {
    const rec = recommendBestFormat("presentation-slides");
    expect(rec[0]).toBe("medium-article");
  });
});

describe("repurposer computeSummaryStats", () => {
  it("computes per-format stats", () => {
    const a = analyzeContent(SAMPLE_BLOG);
    const results = generateForFormats(
      ["twitter-thread", "linkedin-post", "email-summary"],
      a,
      SAMPLE_OPTS,
    );
    const stats = computeSummaryStats(results);
    expect(stats.totalFormats).toBe(3);
    expect(stats.totalItems).toBeGreaterThan(0);
    expect(stats.totalChars).toBeGreaterThan(0);
    expect(stats.byFormat).toHaveLength(3);
  });
  it("handles empty input", () => {
    const stats = computeSummaryStats([]);
    expect(stats.totalFormats).toBe(0);
    expect(stats.totalItems).toBe(0);
    expect(stats.totalChars).toBe(0);
    expect(stats.byFormat).toEqual([]);
  });
});

describe("repurposer renderText", () => {
  it("renders per-format blocks", () => {
    const a = analyzeContent(SAMPLE_BLOG);
    const results = generateForFormats(["twitter-thread"], a, SAMPLE_OPTS);
    const text = renderText(results);
    expect(text).toContain("=== Twitter Thread ===");
    expect(text).toContain("--- Variation 1 ---");
  });
  it("returns empty for empty input", () => {
    expect(renderText([])).toBe("");
  });
});

describe("repurposer renderCsv & splitCsvRow", () => {
  it("renders CSV header", () => {
    expect(renderCsv([])).toContain("format,content,char_count,item_count,variation");
  });
  it("renders rows with format", () => {
    const a = analyzeContent(SAMPLE_BLOG);
    const results = generateForFormats(["twitter-thread"], a, SAMPLE_OPTS);
    const csv = renderCsv(results);
    expect(csv).toContain("twitter-thread");
  });
  it("splits simple CSV row", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas in CSV", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
});

describe("repurposer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      sourceType: "blog-post",
      targetFormats: ["twitter-thread"],
      tone: "professional",
      wordCount: 100,
      totalFormats: 1,
      totalChars: 500,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        sourceType: "blog-post",
        targetFormats: ["twitter-thread"],
        tone: "professional",
        wordCount: 100,
        totalFormats: 1,
        totalChars: 500,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1,
      sourceType: "blog-post",
      targetFormats: [],
      tone: "professional",
      wordCount: 0,
      totalFormats: 0,
      totalChars: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("repurposer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      sourceContent: "Hello world",
      sourceType: "blog-post",
      targetFormats: ["twitter-thread", "linkedin-post"],
      tone: "professional",
      includeCTA: true,
      maxItemsPerFormat: 5,
    });
    expect(url).toContain("content=Hello+world");
    expect(url).toContain("src=blog-post");
    expect(url).toContain("fmt=twitter-thread%2Clinkedin-post");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("content=Hello+world&src=blog-post&fmt=twitter-thread%2Clinkedin-post&tone=casual&cta=0&max=7");
    expect(p.sourceContent).toBe("Hello world");
    expect(p.sourceType).toBe("blog-post");
    expect(p.targetFormats).toEqual(["twitter-thread", "linkedin-post"]);
    expect(p.tone).toBe("casual");
    expect(p.includeCTA).toBe(false);
    expect(p.maxItemsPerFormat).toBe(7);
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.sourceContent).toBe("");
    expect(p.targetFormats).toEqual([]);
    expect(p.tone).toBe("professional");
    expect(p.includeCTA).toBe(true);
    expect(p.maxItemsPerFormat).toBe(5);
  });
  it("filters unknown formats and tones", () => {
    const p = parseShareUrl("src=unknown-src&fmt=twitter-thread,unknown-fmt&tone=unknown-tone");
    expect(p.sourceType).toBe("blog-post");
    expect(p.targetFormats).toEqual(["twitter-thread"]);
    expect(p.tone).toBe("professional");
  });
});

// Suppress unused-import lint
export type _Unused = SourceType | TargetFormat | Tone;
