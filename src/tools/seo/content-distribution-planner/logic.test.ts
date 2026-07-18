import { describe, it, expect, beforeEach } from "vitest";
import {
  CHANNEL_CONFIGS,
  ALL_CHANNEL_IDS,
  CHANNEL_PRESETS,
  MARKETING_WORDS,
  HASHTAG_SEEDS,
  normalizeText,
  normalizeHashtag,
  parseChannels,
  matchChannelId,
  parseHashtags,
  extractTitleKeywords,
  suggestHashtags,
  truncateWithWarning,
  clampHashtags,
  insertCTA,
  stripMarketingFluff,
  generateTwitter,
  generateLinkedIn,
  generateFacebook,
  generateInstagram,
  generateEmail,
  generateReddit,
  generateHackerNews,
  generateDevto,
  generateMedium,
  generateYouTube,
  generateDiscord,
  generateForChannel,
  generateAll,
  firstSentence,
  firstParagraph,
  urlShort,
  extractHashtagsFromSnippet,
  filterByChannel,
  computeSummaryStats,
  renderText,
  renderCsv,
  splitCsvRow,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ChannelId,
  type DistributionInput,
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

const sampleInput: DistributionInput = {
  title: "10 Free SEO Tools You Should Use",
  description: "We rounded up ten free SEO tools that actually move the needle. From keyword research to technical audits, here's our shortlist for 2024.",
  url: "https://example.com/blog/free-seo-tools",
  channels: ["twitter", "linkedin", "facebook", "instagram", "email", "reddit", "hackernews", "devto", "medium", "youtube", "discord"],
  hashtags: ["#seo", "#marketing", "#freetools", "#growth"],
  cta: "Read the full list",
};

describe("content-distribution-planner constants", () => {
  it("defines all 11 channels", () => {
    expect(ALL_CHANNEL_IDS).toHaveLength(11);
  });
  it("twitter limit is 280", () => {
    expect(CHANNEL_CONFIGS.twitter.charLimit).toBe(280);
  });
  it("linkedin limit is 1300", () => {
    expect(CHANNEL_CONFIGS.linkedin.charLimit).toBe(1300);
  });
  it("hackernews limit is 80", () => {
    expect(CHANNEL_CONFIGS.hackernews.charLimit).toBe(80);
  });
  it("instagram hashtag max is 30", () => {
    expect(CHANNEL_CONFIGS.instagram.maxHashtags).toBe(30);
  });
  it("devto hashtag max is 4", () => {
    expect(CHANNEL_CONFIGS.devto.maxHashtags).toBe(4);
  });
  it("has channel presets", () => {
    expect(Object.keys(CHANNEL_PRESETS).length).toBeGreaterThanOrEqual(5);
    expect(CHANNEL_PRESETS["All 11 channels"]).toHaveLength(11);
  });
  it("has marketing words list", () => {
    expect(MARKETING_WORDS.length).toBeGreaterThan(5);
    expect(MARKETING_WORDS).toContain("amazing");
  });
  it("has hashtag seeds", () => {
    expect(HASHTAG_SEEDS.length).toBeGreaterThan(5);
    expect(HASHTAG_SEEDS).toContain("marketing");
  });
});

describe("content-distribution-planner normalize", () => {
  it("normalizeText collapses whitespace", () => {
    expect(normalizeText("  a   b  ")).toBe("a b");
  });
  it("normalizeHashtag strips leading # and lowercases", () => {
    expect(normalizeHashtag("#SEO_Tools!")).toBe("#seo_tools");
  });
  it("normalizeHashtag returns empty for blank", () => {
    expect(normalizeHashtag("")).toBe("");
    expect(normalizeHashtag("#!!!")).toBe("");
  });
});

describe("content-distribution-planner parseChannels", () => {
  it("parses comma-separated canonical names", () => {
    expect(parseChannels("twitter, linkedin, reddit")).toEqual(["twitter", "linkedin", "reddit"]);
  });
  it("parses aliases (x, hn, ig, fb)", () => {
    expect(parseChannels("x, hn, ig, fb")).toEqual(["twitter", "hackernews", "instagram", "facebook"]);
  });
  it("parses newline-separated", () => {
    expect(parseChannels("twitter\nlinkedin")).toEqual(["twitter", "linkedin"]);
  });
  it("dedupes", () => {
    expect(parseChannels("twitter, twitter, twitter")).toEqual(["twitter"]);
  });
  it("ignores unknown channels", () => {
    expect(parseChannels("twitter,myspace,linkedin")).toEqual(["twitter", "linkedin"]);
  });
  it("empty input returns []", () => {
    expect(parseChannels("")).toEqual([]);
  });
  it("matchChannelId returns null for unknown", () => {
    expect(matchChannelId("myspace")).toBeNull();
  });
});

describe("content-distribution-planner parseHashtags", () => {
  it("parses space-separated", () => {
    expect(parseHashtags("#seo #marketing")).toEqual(["#seo", "#marketing"]);
  });
  it("parses comma-separated without #", () => {
    expect(parseHashtags("seo, marketing, growth")).toEqual(["#seo", "#marketing", "#growth"]);
  });
  it("returns empty for empty", () => {
    expect(parseHashtags("")).toEqual([]);
  });
});

describe("content-distribution-planner hashtag generator", () => {
  it("extracts keywords from title", () => {
    const kw = extractTitleKeywords("10 Free SEO Tools You Should Use");
    expect(kw).toContain("free");
    expect(kw).toContain("seo");
    expect(kw).toContain("tools");
    expect(kw).toContain("use");
    // Stopwords filtered
    expect(kw).not.toContain("you");
    expect(kw).not.toContain("should");
  });
  it("suggestHashtags returns at least one per title keyword", () => {
    const s = suggestHashtags("SEO Marketing Growth");
    expect(s.length).toBeGreaterThan(0);
    expect(s[0]).toBe("#seo");
  });
  it("suggestHashtags pads with seeds when title is short", () => {
    const s = suggestHashtags("hi", 5);
    expect(s.length).toBe(5);
    expect(s.some((h) => h === "#content")).toBe(true);
  });
  it("suggestHashtags respects maxCount", () => {
    expect(suggestHashtags("seo marketing growth tools strategy", 3)).toHaveLength(3);
  });
});

describe("content-distribution-planner truncate & clamp", () => {
  it("truncateWithWarning returns text as-is when under limit", () => {
    const r = truncateWithWarning("short", 100);
    expect(r.text).toBe("short");
    expect(r.truncated).toBe(false);
  });
  it("truncateWithWarning adds ellipsis when over limit", () => {
    const r = truncateWithWarning("a".repeat(100), 50);
    expect(r.text.length).toBe(50);
    expect(r.text.endsWith("…")).toBe(true);
    expect(r.truncated).toBe(true);
  });
  it("clampHashtags truncates over max", () => {
    const r = clampHashtags(["#a", "#b", "#c"], 2);
    expect(r.tags).toEqual(["#a", "#b"]);
    expect(r.warning).toContain("exceeds max");
  });
  it("clampHashtags warns below min", () => {
    const r = clampHashtags(["#a"], 5, 3);
    expect(r.warning).toContain("below");
  });
  it("clampHashtags no warning when in range", () => {
    const r = clampHashtags(["#a", "#b"], 5, 1);
    expect(r.warning).toBeNull();
  });
});

describe("content-distribution-planner CTA & fluff", () => {
  it("insertCTA replaces placeholder", () => {
    expect(insertCTA("Click here: {cta}", "Sign up")).toBe("Click here: Sign up");
  });
  it("insertCTA returns text when no cta", () => {
    expect(insertCTA("Hello", "")).toBe("Hello");
  });
  it("stripMarketingFluff removes fluff words", () => {
    // "Amazing" and "Revolutionary" stripped; trailing "!" preserved (single)
    expect(stripMarketingFluff("An Amazing Revolutionary Tool!")).toBe("An Tool!");
  });
  it("stripMarketingFluff collapses multiple exclamations", () => {
    expect(stripMarketingFluff("Wow!!!")).toBe("Wow!");
  });
});

describe("content-distribution-planner per-channel generators", () => {
  it("generateTwitter includes hook + cta + url + hashtags", () => {
    const s = generateTwitter(sampleInput);
    expect(s).toContain("Read the full list");
    expect(s).toContain("https://example.com/blog/free-seo-tools");
    expect(s.length).toBeLessThanOrEqual(280);
  });
  it("generateTwitter respects 280 limit", () => {
    const longInput = { ...sampleInput, description: "x".repeat(500) };
    const s = generateTwitter(longInput);
    expect(s.length).toBeLessThanOrEqual(280);
  });
  it("generateLinkedIn adds question hook", () => {
    const s = generateLinkedIn(sampleInput);
    expect(s).toContain("?");
    expect(s).toContain("Read the full list");
  });
  it("generateLinkedIn respects 1300 limit", () => {
    const s = generateLinkedIn({ ...sampleInput, description: "x".repeat(2000) });
    expect(s.length).toBeLessThanOrEqual(1300);
  });
  it("generateFacebook includes emoji", () => {
    const s = generateFacebook(sampleInput);
    expect(s).toContain("📘");
  });
  it("generateInstagram has hashtag block", () => {
    const input = { ...sampleInput, hashtags: ["#seo", "#marketing", "#growth", "#tips", "#strategy", "#tools", "#resources", "#ideas", "#insights", "#news"] };
    const s = generateInstagram(input);
    expect(s).toContain("#seo");
    expect(s.length).toBeLessThanOrEqual(2200);
  });
  it("generateEmail has subject/preview/body sections", () => {
    const s = generateEmail(sampleInput);
    expect(s).toContain("Subject:");
    expect(s).toContain("Preview:");
    expect(s).toContain("=== HOOK ===");
    expect(s).toContain("=== VALUE ===");
    expect(s).toContain("=== CTA ===");
  });
  it("generateReddit has TL;DR and Link", () => {
    const s = generateReddit(sampleInput);
    expect(s).toContain("**TL;DR:**");
    expect(s).toContain("**Link:**");
  });
  it("generateHackerNews strips marketing fluff", () => {
    const s = generateHackerNews({ ...sampleInput, title: "An Amazing Revolutionary SEO Tool" });
    expect(s.toLowerCase()).not.toContain("amazing");
    expect(s.toLowerCase()).not.toContain("revolutionary");
  });
  it("generateDevto includes markdown header and tags", () => {
    const s = generateDevto(sampleInput);
    expect(s.startsWith("# ")).toBe(true);
    expect(s).toContain("seo");
  });
  it("generateDevto limits to 4 tags", () => {
    const input = { ...sampleInput, hashtags: ["#a", "#b", "#c", "#d", "#e", "#f"] };
    const s = generateDevto(input);
    const tags = s.split("\n\n").pop()?.split(" ") ?? [];
    const hashLike = s.match(/#[a-zA-Z0-9_]+/g) ?? [];
    // After processing, only 4 hashtag-equivalent tokens (tag names without #)
    const tagBlock = s.split("\n\n").pop() ?? "";
    expect(tagBlock.split(" ").length).toBeLessThanOrEqual(4);
    expect(hashLike.length).toBeLessThanOrEqual(4);
  });
  it("generateMedium has Title, Subtitle, Hook", () => {
    const s = generateMedium(sampleInput);
    expect(s).toContain("Title:");
    expect(s).toContain("Subtitle:");
    expect(s).toContain("Hook:");
  });
  it("generateYouTube respects 150 limit", () => {
    const s = generateYouTube(sampleInput);
    expect(s.length).toBeLessThanOrEqual(150);
  });
  it("generateDiscord has channel suggestions", () => {
    const s = generateDiscord(sampleInput);
    expect(s).toContain("#general");
    expect(s).toContain("#announcements");
  });
  it("generateForChannel dispatches to per-channel functions", () => {
    const t = generateForChannel("twitter", sampleInput);
    const direct = generateTwitter(sampleInput);
    expect(t).toBe(direct);
  });
});

describe("content-distribution-planner generateAll", () => {
  it("generates one snippet per channel", () => {
    const out = generateAll(sampleInput);
    expect(out).toHaveLength(11);
  });
  it("each snippet has charCount and charLimit", () => {
    const out = generateAll(sampleInput);
    for (const s of out) {
      expect(s.charCount).toBe(s.snippet.length);
      expect(s.charLimit).toBeGreaterThan(0);
      expect(s.channelLabel).toBeTruthy();
    }
  });
  it("flags truncated when over limit", () => {
    const longInput = {
      ...sampleInput,
      description: "x".repeat(5000),
      title: "x".repeat(200),
    };
    const out = generateAll(longInput);
    const tw = out.find((s) => s.channelId === "twitter")!;
    expect(tw.truncated).toBe(true);
    expect(tw.warnings.length).toBeGreaterThan(0);
  });
  it("respects input channels subset", () => {
    const out = generateAll({ ...sampleInput, channels: ["twitter", "reddit"] });
    expect(out).toHaveLength(2);
    expect(out.map((s) => s.channelId)).toEqual(["twitter", "reddit"]);
  });
});

describe("content-distribution-planner helpers", () => {
  it("firstSentence extracts up to first period", () => {
    expect(firstSentence("First sentence. Second.")).toBe("First sentence.");
  });
  it("firstParagraph returns first paragraph", () => {
    expect(firstParagraph("Para one.\n\nPara two.")).toBe("Para one.");
  });
  it("urlShort strips protocol and trailing slash", () => {
    expect(urlShort("https://example.com/")).toBe("example.com");
  });
  it("extractHashtagsFromSnippet dedupes", () => {
    expect(extractHashtagsFromSnippet("hello #seo #seo #marketing")).toEqual(["#seo", "#marketing"]);
  });
});

describe("content-distribution-planner filter & stats", () => {
  it("filterByChannel returns only matching", () => {
    const out = generateAll(sampleInput);
    const filtered = filterByChannel(out, "twitter");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].channelId).toBe("twitter");
  });
  it("filterByChannel '' returns all", () => {
    const out = generateAll(sampleInput);
    expect(filterByChannel(out, "")).toHaveLength(11);
  });
  it("computeSummaryStats aggregates", () => {
    const out = generateAll(sampleInput);
    const stats = computeSummaryStats(out);
    expect(stats.totalChannels).toBe(11);
    expect(stats.totalChars).toBeGreaterThan(0);
    expect(stats.totalHashtags).toBeGreaterThanOrEqual(0);
  });
  it("computeSummaryStats counts truncations", () => {
    const longInput = { ...sampleInput, description: "x".repeat(5000), title: "x".repeat(200) };
    const out = generateAll(longInput);
    const stats = computeSummaryStats(out);
    expect(stats.truncatedCount).toBeGreaterThan(0);
    expect(stats.warningCount).toBeGreaterThan(0);
  });
});

describe("content-distribution-planner renderers", () => {
  it("renderText includes channel headers", () => {
    const out = generateAll({ ...sampleInput, channels: ["twitter"] });
    const text = renderText(out);
    expect(text).toContain("=== Twitter/X");
    expect(text).toContain("/280 chars");
  });
  it("renderText empty for empty input", () => {
    expect(renderText([])).toBe("");
  });
  it("renderCsv includes header", () => {
    expect(renderCsv([])).toContain("channel,snippet,char_count,char_limit,hashtag_count,warnings");
  });
  it("renderCsv includes rows", () => {
    const out = generateAll({ ...sampleInput, channels: ["twitter"] });
    const csv = renderCsv(out);
    expect(csv).toContain("Twitter/X");
  });
  it("splitCsvRow handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
});

describe("content-distribution-planner history", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, title: "T", channels: ["twitter"], totalSnippets: 1 });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].title).toBe("T");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, title: `T${i}`, channels: ["twitter"], totalSnippets: 1 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, title: "T", channels: ["twitter"], totalSnippets: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("content-distribution-planner shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ title: "Hello World", channels: ["twitter", "reddit"] });
    expect(url).toContain("title=Hello+World");
    expect(url).toContain("ch=twitter%2Creddit");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("title=Hello&desc=Desc&url=https%3A%2F%2Fx.com&ch=twitter%2Creddit&tags=%23seo%20%23mkt&cta=Read");
    expect(p.title).toBe("Hello");
    expect(p.description).toBe("Desc");
    expect(p.url).toBe("https://x.com");
    expect(p.channels).toEqual(["twitter", "reddit"]);
    expect(p.hashtags).toEqual(["#seo", "#mkt"]);
    expect(p.cta).toBe("Read");
  });
  it("parses empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown channels", () => {
    const p = parseShareUrl("ch=twitter%2Cunknown");
    expect(p.channels).toEqual(["twitter"]);
  });
});

// Suppress unused-import lint
export type _Unused = ChannelId;
