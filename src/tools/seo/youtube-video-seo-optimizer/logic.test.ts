import { describe, it, expect, beforeEach } from "vitest";
import {
  VIDEO_CATEGORIES,
  CATEGORY_PRESETS,
  CLICKBAIT_WORDS,
  AFFILIATE_DOMAINS,
  SOCIAL_DOMAINS,
  MAX_TITLE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_TAGS_CHARS,
  normalizeInput,
  parseInputs,
  parseList,
  tokenize,
  hasEmoji,
  analyzeTitleLength,
  analyzeTitleKeywordPlacement,
  computeClickbaitScore,
  analyzeTitle,
  extractAboveFold,
  computeKeywordDensity,
  detectLinks,
  parseChapters,
  timestampToSeconds,
  validateChapters,
  suggestChapters,
  formatTimestamp,
  analyzeDescription,
  analyzeTags,
  extractHashtags,
  suggestHashtags,
  analyzeHashtags,
  suggestThumbnailText,
  analyzeAll,
  computeSummaryStats,
  renderText,
  renderCsv,
  splitCsvRow,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type VideoCategory,
  type SeoInputs,
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

function makeInputs(over: Partial<SeoInputs> = {}): SeoInputs {
  return {
    videoTitle: "How to Bake Chocolate Chip Cookies from Scratch",
    videoDescription:
      "In this tutorial, we'll learn how to bake chocolate chip cookies from scratch.\n\nIngredients:\n2 cups flour\n1 cup sugar\n1 cup butter\n\nSteps:\n0:00 Intro\n1:30 Mixing dry ingredients\n3:00 Adding chocolate\n5:30 Baking\n\nBuy my cookbook: https://amazon.com/cookbook\nFollow me: https://instagram.com/baker\nWebsite: https://mybakingblog.com\n\n#baking #cookies #chocolatechip #dessert",
    tags: "chocolate chip cookies, baking, dessert, how to bake cookies, homemade cookies, cookie recipe, easy cookies",
    channelName: "Baking With Beth",
    targetKeywords: "chocolate chip cookies, baking, dessert",
    videoCategory: "Howto & Style",
    ...over,
  };
}

describe("yt-seo constants", () => {
  it("has 10 video categories", () => {
    expect(VIDEO_CATEGORIES).toHaveLength(10);
  });
  it("has presets for every category", () => {
    for (const c of VIDEO_CATEGORIES) {
      expect(CATEGORY_PRESETS[c]).toBeDefined();
      expect(CATEGORY_PRESETS[c].tags.length).toBeGreaterThan(0);
      expect(CATEGORY_PRESETS[c].hashtags.length).toBeGreaterThan(0);
    }
  });
  it("has clickbait words list", () => {
    expect(CLICKBAIT_WORDS.length).toBeGreaterThanOrEqual(5);
    expect(CLICKBAIT_WORDS).toContain("best");
  });
  it("has affiliate + social domain lists", () => {
    expect(AFFILIATE_DOMAINS.length).toBeGreaterThanOrEqual(3);
    expect(SOCIAL_DOMAINS.length).toBeGreaterThanOrEqual(3);
    expect(AFFILIATE_DOMAINS.some((d) => d.includes("amazon"))).toBe(true);
    expect(SOCIAL_DOMAINS.some((d) => d.includes("instagram"))).toBe(true);
  });
  it("enforces YouTube limits", () => {
    expect(MAX_TITLE_LENGTH).toBe(100);
    expect(MAX_DESCRIPTION_LENGTH).toBe(5000);
    expect(MAX_TAGS_CHARS).toBe(500);
  });
});

describe("yt-seo normalize + parse", () => {
  it("normalizeInput collapses whitespace", () => {
    expect(normalizeInput("  Best   SEO  ")).toBe("Best SEO");
  });
  it("parseInputs fills defaults", () => {
    const r = parseInputs({ videoTitle: "x", videoDescription: "", tags: "", channelName: "", targetKeywords: "", videoCategory: "Tech" });
    expect(r.videoTitle).toBe("x");
    expect(r.videoCategory).toBe("Tech");
  });
  it("parseList splits comma-separated", () => {
    expect(parseList("seo, marketing, tech")).toEqual(["seo", "marketing", "tech"]);
  });
  it("parseList handles newlines + semicolons", () => {
    expect(parseList("seo\nmarketing;tech")).toEqual(["seo", "marketing", "tech"]);
  });
  it("tokenize extracts lowercase words", () => {
    expect(tokenize("Hello, World! It's me.")).toEqual(["hello", "world", "it's", "me"]);
  });
  it("tokenize empty returns []", () => {
    expect(tokenize("")).toEqual([]);
  });
  it("hasEmoji detects emoji", () => {
    expect(hasEmoji("Check this out 🔥")).toBe(true);
  });
  it("hasEmoji false on plain text", () => {
    expect(hasEmoji("Just plain text here")).toBe(false);
  });
});

describe("yt-seo title length", () => {
  it("scores 10 for optimal 60-70 chars", () => {
    expect(analyzeTitleLength("A".repeat(65)).score).toBe(10);
  });
  it("scores lower for under 30 chars", () => {
    expect(analyzeTitleLength("Short title").score).toBeLessThanOrEqual(3);
  });
  it("scores 0 for over YouTube limit", () => {
    expect(analyzeTitleLength("A".repeat(120)).score).toBe(0);
  });
});

describe("yt-seo keyword placement", () => {
  it("scores high when target kw in first half", () => {
    const r = analyzeTitleKeywordPlacement("Chocolate Chip Cookies Recipe Easy", ["chocolate"]);
    expect(r.matched).toContain("chocolate");
    expect(r.placement).toBe(100);
    expect(r.score).toBe(10);
  });
  it("scores 0 when keyword only in second half", () => {
    const r = analyzeTitleKeywordPlacement("A long filler title with chocolate at the end here", ["chocolate"]);
    expect(r.placement).toBe(0);
    expect(r.score).toBe(0);
  });
  it("returns 0 with no targets", () => {
    expect(analyzeTitleKeywordPlacement("title", []).score).toBe(0);
  });
});

describe("yt-seo clickbait", () => {
  it("clean title scores 10", () => {
    const r = computeClickbaitScore("How to Bake Cookies");
    expect(r.score).toBe(10);
    expect(r.triggers).toHaveLength(0);
  });
  it("penalizes exclamation marks", () => {
    const r = computeClickbaitScore("Wow!!! Amazing video!");
    expect(r.triggers.some((t) => t.startsWith("!"))).toBe(true);
    expect(r.score).toBeLessThan(10);
  });
  it("penalizes ALL CAPS words", () => {
    const r = computeClickbaitScore("BEST VIDEO EVER");
    expect(r.triggers.some((t) => t.startsWith("CAPS"))).toBe(true);
  });
  it("penalizes clickbait word 'best'", () => {
    const r = computeClickbaitScore("the best cookies I ever made");
    expect(r.triggers).toContain("best");
  });
  it("penalizes emojis", () => {
    const r = computeClickbaitScore("Check this out 🔥🔥");
    expect(r.triggers).toContain("emoji");
  });
  it("caps deduction at 10", () => {
    const r = computeClickbaitScore("BEST!!! ??? EPIC INSANE 🔥");
    expect(r.score).toBe(0);
  });
  it("empty title scores 0", () => {
    expect(computeClickbaitScore("").score).toBe(0);
  });
});

describe("yt-seo analyzeTitle combined", () => {
  it("computes total out of 30", () => {
    const r = analyzeTitle(makeInputs());
    expect(r.total).toBeLessThanOrEqual(30);
    expect(r.total).toBeGreaterThanOrEqual(0);
  });
});

describe("yt-seo above the fold", () => {
  it("extracts first 125 chars", () => {
    const long = "A".repeat(200);
    expect(extractAboveFold(long)).toHaveLength(125);
  });
  it("handles short descriptions", () => {
    expect(extractAboveFold("short")).toBe("short");
  });
});

describe("yt-seo keyword density", () => {
  it("computes top 5 keywords", () => {
    const d = computeKeywordDensity("cookies cookies cookies baking baking flour");
    expect(d.length).toBeGreaterThan(0);
    expect(d[0].word).toBe("cookies");
    expect(d[0].count).toBe(3);
  });
  it("filters stopwords", () => {
    const d = computeKeywordDensity("the the the and and and");
    expect(d).toEqual([]);
  });
  it("returns [] for empty", () => {
    expect(computeKeywordDensity("")).toEqual([]);
  });
  it("respects limit parameter", () => {
    const d = computeKeywordDensity("alpha alpha beta beta gamma gamma delta delta epsilon epsilon", 3);
    expect(d.length).toBeLessThanOrEqual(3);
  });
});

describe("yt-seo detectLinks", () => {
  it("detects affiliate links", () => {
    const r = detectLinks("Buy at https://amazon.com/my-product");
    expect(r.affiliate).toHaveLength(1);
    expect(r.social).toHaveLength(0);
  });
  it("detects social links", () => {
    const r = detectLinks("Follow https://instagram.com/me and https://twitter.com/me");
    expect(r.social).toHaveLength(2);
  });
  it("classifies other links as website", () => {
    const r = detectLinks("Visit https://mybakingblog.com");
    expect(r.website).toHaveLength(1);
  });
  it("handles no links", () => {
    expect(detectLinks("no links here")).toEqual({ affiliate: [], social: [], website: [] });
  });
});

describe("yt-seo chapters", () => {
  it("parses 0:00 Intro format", () => {
    const c = parseChapters("0:00 Intro\n1:30 Mixing\n3:00 Baking");
    expect(c).toHaveLength(3);
    expect(c[0].label).toBe("Intro");
    expect(c[0].seconds).toBe(0);
    expect(c[2].seconds).toBe(180);
  });
  it("parses HH:MM:SS format", () => {
    const c = parseChapters("1:02:03 Long chapter");
    expect(c[0].seconds).toBe(1 * 3600 + 2 * 60 + 3);
  });
  it("timestampToSeconds handles MM:SS", () => {
    expect(timestampToSeconds("5:30")).toBe(330);
  });
  it("timestampToSeconds handles HH:MM:SS", () => {
    expect(timestampToSeconds("1:02:03")).toBe(3723);
  });
  it("timestampToSeconds returns -1 on invalid", () => {
    expect(timestampToSeconds("invalid")).toBe(-1);
  });
  it("validateChapters accepts increasing sequence", () => {
    const c = parseChapters("0:00 A\n1:00 B\n2:00 C");
    expect(validateChapters(c)).toBe(true);
  });
  it("validateChapters rejects non-increasing", () => {
    const c = parseChapters("0:00 A\n0:00 B");
    expect(validateChapters(c)).toBe(false);
  });
  it("validateChapters accepts empty", () => {
    expect(validateChapters([])).toBe(true);
  });
  it("suggestChapters returns existing if present", () => {
    const s = suggestChapters("0:00 Intro\n1:00 Body");
    expect(s).toHaveLength(2);
  });
  it("suggestChapters falls back to colon-terminated headings", () => {
    const s = suggestChapters("Ingredients:\nFlour Sugar\nSteps:\nDo things");
    expect(s.length).toBeGreaterThan(0);
    expect(s[0].label).toBe("Ingredients");
  });
  it("formatTimestamp formats MM:SS and HH:MM:SS", () => {
    expect(formatTimestamp(195)).toBe("3:15");
    expect(formatTimestamp(3723)).toBe("1:02:03");
  });
});

describe("yt-seo description analysis", () => {
  it("scores total out of 30", () => {
    const r = analyzeDescription(makeInputs());
    expect(r.total).toBeLessThanOrEqual(30);
  });
  it("detects keyword in above-fold", () => {
    const r = analyzeDescription(makeInputs({ videoDescription: "chocolate chip cookies are amazing today" }));
    expect(r.aboveFoldHasKeyword).toBe(true);
  });
  it("scores 0 for empty description length", () => {
    const r = analyzeDescription(makeInputs({ videoDescription: "" }));
    expect(r.lengthScore).toBe(0);
  });
  it("scores 10 for optimal description length", () => {
    const r = analyzeDescription(makeInputs({ videoDescription: "A".repeat(500) }));
    expect(r.lengthScore).toBe(10);
  });
  it("detects chapters in description", () => {
    const r = analyzeDescription(makeInputs());
    expect(r.chapters.length).toBeGreaterThanOrEqual(4);
    expect(r.chaptersValid).toBe(true);
  });
});

describe("yt-seo tags", () => {
  it("parses tags from comma-separated", () => {
    const r = analyzeTags(makeInputs());
    expect(r.tags.length).toBeGreaterThan(0);
  });
  it("scores count based on number of tags", () => {
    const r = analyzeTags(makeInputs({ tags: "tag1, tag2, tag3, tag4, tag5, tag6, tag7, tag8, tag9, tag10, tag11, tag12" }));
    expect(r.countScore).toBe(10);
  });
  it("detects long-tail tags (2+ words)", () => {
    const r = analyzeTags(makeInputs({ tags: "chocolate chip cookies, baking, homemade cookie recipe, easy cookies" }));
    expect(r.longTailCount).toBeGreaterThanOrEqual(2);
  });
  it("matches title keywords against tags", () => {
    const r = analyzeTags(makeInputs());
    expect(r.matchedKeywords).toContain("chocolate chip cookies");
  });
  it("total is out of 25", () => {
    const r = analyzeTags(makeInputs());
    expect(r.total).toBeLessThanOrEqual(25);
  });
  it("score 0 if tags exceed 500 chars", () => {
    const longTag = "a".repeat(600);
    const r = analyzeTags(makeInputs({ tags: longTag }));
    expect(r.countScore).toBe(0);
  });
  it("uses title-derived keywords when targetKeywords empty", () => {
    const r = analyzeTags(makeInputs({ targetKeywords: "" }));
    expect(r.titleKeywords.length).toBeGreaterThan(0);
  });
});

describe("yt-seo hashtags", () => {
  it("extracts hashtags from description", () => {
    expect(extractHashtags("Check this #baking #cookies #baking")).toEqual(["#baking", "#cookies"]);
  });
  it("dedupes case-insensitively", () => {
    expect(extractHashtags("#Tag #TAG #tag")).toEqual(["#Tag"]);
  });
  it("suggests from category preset + title tokens", () => {
    const s = suggestHashtags(makeInputs());
    expect(s.length).toBeGreaterThan(0);
    expect(s.some((h) => h.toLowerCase().startsWith("#howto") || h.toLowerCase().includes("chocolate"))).toBe(true);
  });
  it("analyzes total out of 15", () => {
    const r = analyzeHashtags(makeInputs(), makeInputs().videoDescription);
    expect(r.total).toBeLessThanOrEqual(15);
  });
  it("category match boosts score", () => {
    const r = analyzeHashtags(
      makeInputs({ videoCategory: "Howto & Style" }),
      "Check this #howto #diy #tutorial #style",
    );
    expect(r.categoryMatches.length).toBeGreaterThan(0);
    expect(r.categoryScore).toBeGreaterThan(0);
  });
});

describe("yt-seo thumbnail suggestion", () => {
  it("returns 3-5 word hook in CAPS", () => {
    const t = suggestThumbnailText(makeInputs({ videoTitle: "How to Bake Chocolate Chip Cookies" }));
    expect(t.words.length).toBeGreaterThanOrEqual(3);
    expect(t.words.length).toBeLessThanOrEqual(5);
    expect(t.hook).toBe(t.hook.toUpperCase());
  });
  it("returns empty for empty title", () => {
    const t = suggestThumbnailText(makeInputs({ videoTitle: "" }));
    expect(t.hook).toBe("");
    expect(t.words).toEqual([]);
  });
});

describe("yt-seo analyzeAll orchestrator", () => {
  it("produces 0-100 total score", () => {
    const r = analyzeAll(makeInputs());
    expect(r.summary.total).toBeGreaterThanOrEqual(0);
    expect(r.summary.total).toBeLessThanOrEqual(100);
  });
  it("breakdown sums to total", () => {
    const r = analyzeAll(makeInputs());
    const sum = r.summary.titleScore + r.summary.descriptionScore + r.summary.tagsScore + r.summary.hashtagsScore;
    expect(sum).toBe(r.summary.total);
  });
  it("includes thumbnail in summary", () => {
    const r = analyzeAll(makeInputs());
    expect(r.summary.thumbnail.hook).not.toBe("");
  });
  it("computeSummaryStats returns same object", () => {
    const r = analyzeAll(makeInputs());
    expect(computeSummaryStats(r)).toBe(r.summary);
  });
});

describe("yt-seo renderText", () => {
  it("contains total score and breakdown", () => {
    const txt = renderText(analyzeAll(makeInputs()));
    expect(txt).toContain("YouTube Video SEO Report");
    expect(txt).toContain("Total score:");
    expect(txt).toContain("Title:");
    expect(txt).toContain("Description:");
    expect(txt).toContain("Tags:");
    expect(txt).toContain("Hashtags:");
  });
  it("includes thumbnail hook", () => {
    const txt = renderText(analyzeAll(makeInputs()));
    expect(txt).toContain("THUMBNAIL HOOK");
  });
  it("includes chapters when present", () => {
    const txt = renderText(analyzeAll(makeInputs()));
    expect(txt).toContain("CHAPTERS");
  });
});

describe("yt-seo renderCsv", () => {
  it("has header row", () => {
    const csv = renderCsv(analyzeAll(makeInputs()));
    expect(csv.split("\n")[0]).toBe("field,value,score");
  });
  it("contains total_score row", () => {
    const csv = renderCsv(analyzeAll(makeInputs()));
    expect(csv).toContain("total_score");
  });
  it("escapes commas in thumbnail hook", () => {
    const csv = renderCsv(analyzeAll(makeInputs({ videoTitle: "How, to: Bake; Things" })));
    // CSV-quoted field with commas
    expect(csv).toContain('"');
  });
});

describe("yt-seo splitCsvRow", () => {
  it("splits simple row", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
});

describe("yt-seo history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      videoTitle: "Cookies",
      category: "Howto & Style",
      totalScore: 75,
      titleScore: 25,
      descriptionScore: 20,
      tagsScore: 20,
      hashtagsScore: 10,
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].videoTitle).toBe("Cookies");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        videoTitle: `T${i}`,
        category: "Tech",
        totalScore: i,
        titleScore: 0,
        descriptionScore: 0,
        tagsScore: 0,
        hashtagsScore: 0,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, videoTitle: "x", category: "Tech", totalScore: 1,
      titleScore: 0, descriptionScore: 0, tagsScore: 0, hashtagsScore: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("yt-seo shareable URL", () => {
  it("builds share URL without window", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(makeInputs());
    expect(url).toContain("title=");
    expect(url).toContain("cat=Howto");
    expect(url).toContain("kw=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const inputs = makeInputs();
    const url = buildShareUrl(inputs);
    // Extract hash portion (after #)
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.videoTitle).toBe(inputs.videoTitle);
    expect(parsed.videoCategory).toBe("Howto & Style");
    expect(parsed.tags).toBe(inputs.tags);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown category", () => {
    const parsed = parseShareUrl("title=hi&cat=UnknownCat");
    expect(parsed.videoCategory).toBeUndefined();
  });
});

// Suppress unused-import lint
export type _Unused = VideoCategory;
