import { describe, it, expect, beforeEach } from "vitest";
import {
  PLATFORMS,
  PLATFORM_LABELS,
  PLATFORM_BASE_REACH,
  splitCsvRow,
  parseAliases,
  buildBrandMatcher,
  parseMentionLine,
  parseMentions,
  computeSentimentFromContent,
  filterByDateRange,
  filterByPlatform,
  enrichMention,
  estimateReach,
  searchMentions,
  aggregateByPlatform,
  findTopAuthors,
  computeSentimentBreakdown,
  computeSummary,
  computeTrend,
  daysBetween,
  computeVelocity,
  analyzeSentimentTrend,
  findTopMentionsByReach,
  checkAlert,
  renderText,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  parsePlatformsParam,
  type Platform,
  type MentionInput,
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

const SAMPLE_CSV = `date,platform,author,content,url,sentiment
2024-01-01,twitter,@user1,Love the new Brand Inc product!,https://twitter.com/x/status/1,1
2024-01-02,reddit,u/user2,Brand Inc is overpriced garbage,https://reddit.com/r/x/1,-1
2024-01-03,linkedin,John Doe,Proud to announce our partnership with BrandCo,https://linkedin.com/posts/1,1
2024-01-05,hackernews,alice,Brand Inc just launched a great new tool,https://news.ycombinator.com/item/1,1
2024-01-08,youtube,ChannelA,Review of the Brand Inc widget (honest opinion),https://youtube.com/watch?v=1,0
2024-01-10,producthunt,user5,Brand Inc is amazing! Kudos to the team,https://producthunt.com/posts/1,1
2024-01-12,twitter,@user2,Terrible customer service from Brand Inc,https://twitter.com/x/status/2,-1
2024-01-15,reddit,u/user3,Just tried BrandCo — works great!,https://reddit.com/r/x/2,1`;

describe("mention-tracker constants", () => {
  it("has 6 platforms", () => {
    expect(PLATFORMS).toHaveLength(6);
    expect(PLATFORMS).toContain("twitter");
    expect(PLATFORMS).toContain("producthunt");
  });
  it("has 6 platform labels", () => {
    expect(Object.keys(PLATFORM_LABELS)).toHaveLength(6);
  });
  it("has base reach for every platform", () => {
    for (const p of PLATFORMS) {
      expect(PLATFORM_BASE_REACH[p]).toBeGreaterThan(0);
    }
  });
});

describe("mention-tracker splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
  it("handles escaped quotes", () => { expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]); });
});

describe("mention-tracker parseAliases", () => {
  it("parses comma-separated", () => {
    expect(parseAliases("Brand Inc, BrandCo")).toEqual(["Brand Inc", "BrandCo"]);
  });
  it("parses semicolon-separated", () => {
    expect(parseAliases("Brand Inc; BrandCo")).toEqual(["Brand Inc", "BrandCo"]);
  });
  it("trims whitespace", () => {
    expect(parseAliases("  Brand Inc  ,  BrandCo  ")).toEqual(["Brand Inc", "BrandCo"]);
  });
  it("returns empty for empty input", () => {
    expect(parseAliases("")).toEqual([]);
  });
});

describe("mention-tracker buildBrandMatcher", () => {
  it("matches brand name case-insensitively", () => {
    const m = buildBrandMatcher("Brand Inc", []);
    expect(m.test("I love BRAND INC!")).toBe(true);
    expect(m.test("brand inc is great")).toBe(true);
    expect(m.test("not my brand")).toBe(false);
  });
  it("matches aliases", () => {
    const m = buildBrandMatcher("Brand Inc", ["BrandCo", "BI"]);
    expect(m.test("BrandCo rocks")).toBe(true);
    expect(m.test("using BI for years")).toBe(true);
    expect(m.test("different brand")).toBe(false);
  });
  it("returns matched alias", () => {
    const m = buildBrandMatcher("Brand Inc", ["BrandCo"]);
    expect(m.findMatch("BrandCo is great")).toBe("brandco");
    expect(m.findMatch("nothing here")).toBeNull();
  });
  it("handles empty brand name", () => {
    const m = buildBrandMatcher("", []);
    expect(m.test("anything")).toBe(false);
    expect(m.names).toEqual([]);
  });
  it("deduplicates case variants", () => {
    const m = buildBrandMatcher("Brand", ["brand", "BRAND"]);
    expect(m.names).toEqual(["brand"]);
  });
});

describe("mention-tracker parseMentionLine", () => {
  it("parses a valid line with sentiment", () => {
    const { mention, error } = parseMentionLine("2024-01-01,twitter,@user,content,https://x.com,1", 1);
    expect(error).toBeNull();
    expect(mention).not.toBeNull();
    expect(mention!.platform).toBe("twitter");
    expect(mention!.sentiment).toBe(1);
  });
  it("parses a valid line without sentiment", () => {
    const { mention, error } = parseMentionLine("2024-01-01,twitter,@user,content,https://x.com", 1);
    expect(error).toBeNull();
    expect(mention!.sentiment).toBeUndefined();
  });
  it("rejects bad date", () => {
    const { error } = parseMentionLine("01-01-2024,twitter,@user,content,https://x.com", 1);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("date");
  });
  it("rejects unknown platform", () => {
    const { error } = parseMentionLine("2024-01-01,mastodon,@user,content,https://x.com", 1);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("platform");
  });
  it("rejects invalid sentiment", () => {
    const { error } = parseMentionLine("2024-01-01,twitter,@user,content,https://x.com,5", 1);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("Sentiment");
  });
  it("rejects too few fields", () => {
    const { error } = parseMentionLine("2024-01-01,twitter,@user", 1);
    expect(error).not.toBeNull();
    expect(error!.message).toContain("5-6 fields");
  });
  it("returns null mention + null error for blank line", () => {
    const { mention, error } = parseMentionLine("   ", 1);
    expect(mention).toBeNull();
    expect(error).toBeNull();
  });
});

describe("mention-tracker parseMentions", () => {
  it("parses sample CSV skipping header", () => {
    const { mentions, errors } = parseMentions(SAMPLE_CSV);
    expect(mentions).toHaveLength(8);
    expect(errors).toHaveLength(0);
  });
  it("handles input without header", () => {
    const { mentions } = parseMentions("2024-01-01,twitter,@user,content,https://x.com,1");
    expect(mentions).toHaveLength(1);
  });
  it("collects errors but keeps valid mentions", () => {
    const csv = `2024-01-01,twitter,@user,content,https://x.com,1
bad-date,twitter,@user,content,https://x.com,1
2024-02-01,reddit,u/user2,content2,https://reddit.com/r/x/2,-1`;
    const { mentions, errors } = parseMentions(csv);
    expect(mentions).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(2);
  });
  it("returns empty for empty input", () => {
    const { mentions, errors } = parseMentions("");
    expect(mentions).toEqual([]);
    expect(errors).toEqual([]);
  });
});

describe("mention-tracker computeSentimentFromContent", () => {
  it("returns positive for positive words", () => {
    expect(computeSentimentFromContent("I love this great product!")).toBe(1);
  });
  it("returns negative for negative words", () => {
    expect(computeSentimentFromContent("This is terrible and awful")).toBe(-1);
  });
  it("returns neutral for mixed equal sentiment", () => {
    expect(computeSentimentFromContent("It is good but bad")).toBe(0);
  });
  it("returns neutral for empty content", () => {
    expect(computeSentimentFromContent("")).toBe(0);
  });
  it("returns neutral for neutral content", () => {
    expect(computeSentimentFromContent("Just an update on the launch")).toBe(0);
  });
});

describe("mention-tracker filterByDateRange", () => {
  const m = parseMentions(SAMPLE_CSV).mentions;
  it("filters by start", () => {
    expect(filterByDateRange(m, "2024-01-10")).toHaveLength(3);
  });
  it("filters by end", () => {
    expect(filterByDateRange(m, undefined, "2024-01-08")).toHaveLength(5);
  });
  it("filters by both", () => {
    expect(filterByDateRange(m, "2024-01-05", "2024-01-10")).toHaveLength(3);
  });
  it("returns all when no filter", () => {
    expect(filterByDateRange(m)).toHaveLength(8);
  });
});

describe("mention-tracker filterByPlatform", () => {
  const m = parseMentions(SAMPLE_CSV).mentions;
  it("returns all for empty platform list", () => {
    expect(filterByPlatform(m, [])).toHaveLength(8);
  });
  it("filters by single platform", () => {
    expect(filterByPlatform(m, ["twitter"])).toHaveLength(2);
  });
  it("filters by multiple platforms", () => {
    expect(filterByPlatform(m, ["twitter", "reddit"])).toHaveLength(4);
  });
});

describe("mention-tracker enrichMention", () => {
  it("uses user-provided sentiment when present", () => {
    const matcher = buildBrandMatcher("Brand Inc", ["BrandCo"]);
    const enriched = enrichMention(
      { date: "2024-01-01", platform: "twitter", author: "@user", content: "Brand Inc is great", url: "", sentiment: -1 },
      matcher,
    );
    expect(enriched.computedSentiment).toBe(-1);
    expect(enriched.sentimentSource).toBe("user");
  });
  it("computes sentiment when not provided", () => {
    const matcher = buildBrandMatcher("Brand Inc", []);
    const enriched = enrichMention(
      { date: "2024-01-01", platform: "twitter", author: "@user", content: "Brand Inc is amazing", url: "" },
      matcher,
    );
    expect(enriched.computedSentiment).toBe(1);
    expect(enriched.sentimentSource).toBe("computed");
  });
  it("detects brand match in content", () => {
    const matcher = buildBrandMatcher("Brand Inc", ["BrandCo"]);
    const enriched = enrichMention(
      { date: "2024-01-01", platform: "twitter", author: "@user", content: "Brand Inc rocks", url: "" },
      matcher,
    );
    expect(enriched.matchesBrand).toBe(true);
    expect(enriched.matchedAlias).toBe("brand inc");
  });
  it("detects brand match in author", () => {
    const matcher = buildBrandMatcher("Brand Inc", []);
    const enriched = enrichMention(
      { date: "2024-01-01", platform: "twitter", author: "Brand Inc Official", content: "Hello", url: "" },
      matcher,
    );
    expect(enriched.matchesBrand).toBe(true);
  });
  it("returns false for no match", () => {
    const matcher = buildBrandMatcher("Brand Inc", []);
    const enriched = enrichMention(
      { date: "2024-01-01", platform: "twitter", author: "@user", content: "Different brand", url: "" },
      matcher,
    );
    expect(enriched.matchesBrand).toBe(false);
    expect(enriched.matchedAlias).toBeNull();
  });
  it("computes reach", () => {
    const matcher = buildBrandMatcher("Brand Inc", []);
    const enriched = enrichMention(
      { date: "2024-01-01", platform: "twitter", author: "@user", content: "Brand Inc", url: "" },
      matcher,
    );
    expect(enriched.reach).toBeGreaterThan(0);
  });
});

describe("mention-tracker estimateReach", () => {
  it("returns positive number for valid platform", () => {
    expect(estimateReach("twitter", "@user")).toBeGreaterThan(0);
    expect(estimateReach("reddit", "u/user")).toBeGreaterThan(0);
  });
  it("returns deterministic value for same input", () => {
    expect(estimateReach("twitter", "@same-user")).toBe(estimateReach("twitter", "@same-user"));
  });
  it("returns different values for different authors", () => {
    expect(estimateReach("twitter", "@user1")).not.toBe(estimateReach("twitter", "@user2"));
  });
});

describe("mention-tracker searchMentions", () => {
  it("returns all for empty query", () => {
    const matcher = buildBrandMatcher("Brand Inc", []);
    const enriched = parseMentions(SAMPLE_CSV).mentions.map((m) => enrichMention(m, matcher));
    expect(searchMentions(enriched, "")).toHaveLength(8);
  });
  it("finds mentions matching query in content", () => {
    const matcher = buildBrandMatcher("Brand Inc", []);
    const enriched = parseMentions(SAMPLE_CSV).mentions.map((m) => enrichMention(m, matcher));
    const results = searchMentions(enriched, "amazing");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.content.toLowerCase().includes("amazing"))).toBe(true);
  });
  it("finds mentions matching query in author", () => {
    const matcher = buildBrandMatcher("Brand Inc", []);
    const enriched = parseMentions(SAMPLE_CSV).mentions.map((m) => enrichMention(m, matcher));
    const results = searchMentions(enriched, "@user1");
    expect(results.length).toBeGreaterThan(0);
  });
});

describe("mention-tracker aggregateByPlatform", () => {
  it("aggregates by platform", () => {
    const matcher = buildBrandMatcher("Brand Inc", ["BrandCo"]);
    const enriched = parseMentions(SAMPLE_CSV).mentions.map((m) => enrichMention(m, matcher));
    const agg = aggregateByPlatform(enriched);
    expect(agg.length).toBe(6);
    const twitter = agg.find((a) => a.platform === "twitter")!;
    expect(twitter.count).toBe(2);
  });
  it("counts sentiment breakdown per platform", () => {
    const matcher = buildBrandMatcher("Brand Inc", []);
    const enriched = parseMentions(SAMPLE_CSV).mentions.map((m) => enrichMention(m, matcher));
    const agg = aggregateByPlatform(enriched);
    const twitter = agg.find((a) => a.platform === "twitter")!;
    expect(twitter.positiveCount + twitter.neutralCount + twitter.negativeCount).toBe(twitter.count);
  });
  it("sorts by count descending", () => {
    const matcher = buildBrandMatcher("Brand Inc", []);
    const enriched = parseMentions(SAMPLE_CSV).mentions.map((m) => enrichMention(m, matcher));
    const agg = aggregateByPlatform(enriched);
    for (let i = 1; i < agg.length; i++) {
      expect(agg[i - 1].count).toBeGreaterThanOrEqual(agg[i].count);
    }
  });
});

describe("mention-tracker findTopAuthors", () => {
  it("returns authors sorted by count", () => {
    const matcher = buildBrandMatcher("Brand Inc", []);
    const enriched = parseMentions(SAMPLE_CSV).mentions.map((m) => enrichMention(m, matcher));
    const top = findTopAuthors(enriched, 5);
    expect(top.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < top.length; i++) {
      expect(top[i - 1].count).toBeGreaterThanOrEqual(top[i].count);
    }
  });
  it("respects limit", () => {
    const matcher = buildBrandMatcher("Brand Inc", []);
    const enriched = parseMentions(SAMPLE_CSV).mentions.map((m) => enrichMention(m, matcher));
    expect(findTopAuthors(enriched, 3)).toHaveLength(3);
  });
  it("returns empty for empty input", () => {
    expect(findTopAuthors([], 5)).toEqual([]);
  });
  it("aggregates platforms per author", () => {
    const matcher = buildBrandMatcher("Brand Inc", []);
    const enriched = parseMentions(SAMPLE_CSV).mentions.map((m) => enrichMention(m, matcher));
    const top = findTopAuthors(enriched, 5);
    for (const a of top) {
      expect(a.platforms.length).toBeGreaterThan(0);
      expect(a.totalReach).toBeGreaterThan(0);
    }
  });
});

describe("mention-tracker computeSentimentBreakdown", () => {
  it("computes breakdown", () => {
    const matcher = buildBrandMatcher("Brand Inc", []);
    const enriched = parseMentions(SAMPLE_CSV).mentions.map((m) => enrichMention(m, matcher));
    const s = computeSentimentBreakdown(enriched);
    expect(s.positive + s.neutral + s.negative).toBe(8);
    expect(s.avgScore).toBeGreaterThanOrEqual(-1);
    expect(s.avgScore).toBeLessThanOrEqual(1);
  });
  it("returns zeros for empty", () => {
    const s = computeSentimentBreakdown([]);
    expect(s.positive).toBe(0);
    expect(s.neutral).toBe(0);
    expect(s.negative).toBe(0);
    expect(s.avgScore).toBe(0);
  });
});

describe("mention-tracker computeSummary", () => {
  it("computes summary stats", () => {
    const matcher = buildBrandMatcher("Brand Inc", ["BrandCo"]);
    const enriched = parseMentions(SAMPLE_CSV).mentions.map((m) => enrichMention(m, matcher));
    const s = computeSummary(enriched);
    expect(s.totalMentions).toBe(8);
    expect(s.brandMentions).toBeGreaterThan(0);
    expect(s.uniqueAuthors).toBe(8);
    expect(s.totalReach).toBeGreaterThan(0);
    expect(s.avgReach).toBeGreaterThan(0);
    expect(s.byPlatform.length).toBe(6);
    expect(s.sentiment).toBeDefined();
  });
  it("returns zeros for empty", () => {
    const s = computeSummary([]);
    expect(s.totalMentions).toBe(0);
    expect(s.brandMentions).toBe(0);
    expect(s.byPlatform).toEqual([]);
  });
});

describe("mention-tracker computeTrend", () => {
  it("returns trend points sorted by date", () => {
    const matcher = buildBrandMatcher("Brand Inc", []);
    const enriched = parseMentions(SAMPLE_CSV).mentions.map((m) => enrichMention(m, matcher));
    const trend = computeTrend(enriched);
    expect(trend.length).toBeGreaterThan(0);
    for (let i = 1; i < trend.length; i++) {
      expect(trend[i].date >= trend[i - 1].date).toBe(true);
    }
  });
  it("returns empty for empty input", () => {
    expect(computeTrend([])).toEqual([]);
  });
});

describe("mention-tracker daysBetween", () => {
  it("computes days", () => {
    expect(daysBetween("2024-01-01", "2024-01-08")).toBe(7);
  });
  it("handles same day", () => {
    expect(daysBetween("2024-01-01", "2024-01-01")).toBe(0);
  });
  it("returns 0 for invalid dates", () => {
    expect(daysBetween("bad", "2024-01-01")).toBe(0);
  });
});

describe("mention-tracker computeVelocity", () => {
  it("computes velocity", () => {
    const matcher = buildBrandMatcher("Brand Inc", []);
    const enriched = parseMentions(SAMPLE_CSV).mentions.map((m) => enrichMention(m, matcher));
    const v = computeVelocity(enriched);
    expect(v.totalMentions).toBe(8);
    expect(v.totalDays).toBeGreaterThan(0);
    expect(v.mentionsPerDay).toBeGreaterThan(0);
  });
  it("returns zeros for empty", () => {
    const v = computeVelocity([]);
    expect(v.mentionsPerDay).toBe(0);
    expect(v.totalMentions).toBe(0);
  });
});

describe("mention-tracker analyzeSentimentTrend", () => {
  it("returns null for fewer than 2 mentions", () => {
    expect(analyzeSentimentTrend([])).toBeNull();
  });
  it("returns trend direction", () => {
    const matcher = buildBrandMatcher("Brand Inc", []);
    const enriched = parseMentions(SAMPLE_CSV).mentions.map((m) => enrichMention(m, matcher));
    const t = analyzeSentimentTrend(enriched);
    expect(t).not.toBeNull();
    expect(["improving", "declining", "flat"]).toContain(t!.direction);
  });
  it("detects improving trend", () => {
    const matcher = buildBrandMatcher("Brand", []);
    const mentions: MentionInput[] = [
      { date: "2024-01-01", platform: "twitter", author: "a", content: "Brand is terrible", url: "" },
      { date: "2024-01-02", platform: "twitter", author: "a", content: "Brand is terrible", url: "" },
      { date: "2024-02-01", platform: "twitter", author: "a", content: "Brand is amazing", url: "" },
      { date: "2024-02-02", platform: "twitter", author: "a", content: "Brand is amazing", url: "" },
    ];
    const enriched = mentions.map((m) => enrichMention(m, matcher));
    const t = analyzeSentimentTrend(enriched);
    expect(t!.direction).toBe("improving");
  });
  it("detects declining trend", () => {
    const matcher = buildBrandMatcher("Brand", []);
    const mentions: MentionInput[] = [
      { date: "2024-01-01", platform: "twitter", author: "a", content: "Brand is amazing", url: "" },
      { date: "2024-01-02", platform: "twitter", author: "a", content: "Brand is amazing", url: "" },
      { date: "2024-02-01", platform: "twitter", author: "a", content: "Brand is terrible", url: "" },
      { date: "2024-02-02", platform: "twitter", author: "a", content: "Brand is terrible", url: "" },
    ];
    const enriched = mentions.map((m) => enrichMention(m, matcher));
    const t = analyzeSentimentTrend(enriched);
    expect(t!.direction).toBe("declining");
  });
});

describe("mention-tracker findTopMentionsByReach", () => {
  it("returns top N sorted by reach", () => {
    const matcher = buildBrandMatcher("Brand Inc", []);
    const enriched = parseMentions(SAMPLE_CSV).mentions.map((m) => enrichMention(m, matcher));
    const top = findTopMentionsByReach(enriched, 3);
    expect(top).toHaveLength(3);
    for (let i = 1; i < top.length; i++) {
      expect(top[i - 1].reach).toBeGreaterThanOrEqual(top[i].reach);
    }
  });
  it("respects limit", () => {
    const matcher = buildBrandMatcher("Brand Inc", []);
    const enriched = parseMentions(SAMPLE_CSV).mentions.map((m) => enrichMention(m, matcher));
    expect(findTopMentionsByReach(enriched, 5)).toHaveLength(5);
  });
  it("returns empty for empty input", () => {
    expect(findTopMentionsByReach([], 5)).toEqual([]);
  });
});

describe("mention-tracker checkAlert", () => {
  it("returns safe state for empty mentions", () => {
    const r = checkAlert([], 5);
    expect(r.triggered).toBe(false);
    expect(r.currentPerDay).toBe(0);
  });
  it("triggers when threshold exceeded", () => {
    const matcher = buildBrandMatcher("Brand", []);
    const mentions: MentionInput[] = [
      { date: "2024-01-01", platform: "twitter", author: "a", content: "Brand is great", url: "" },
      { date: "2024-01-01", platform: "twitter", author: "b", content: "Brand is great", url: "" },
      { date: "2024-01-01", platform: "twitter", author: "c", content: "Brand is great", url: "" },
      { date: "2024-01-01", platform: "twitter", author: "d", content: "Brand is great", url: "" },
      { date: "2024-01-01", platform: "twitter", author: "e", content: "Brand is great", url: "" },
    ];
    const enriched = mentions.map((m) => enrichMention(m, matcher));
    const r = checkAlert(enriched, 3);
    expect(r.triggered).toBe(true);
    expect(r.maxDayCount).toBe(5);
    expect(r.maxDayDate).toBe("2024-01-01");
  });
  it("does not trigger when below threshold", () => {
    const matcher = buildBrandMatcher("Brand", []);
    const mentions: MentionInput[] = [
      { date: "2024-01-01", platform: "twitter", author: "a", content: "Brand", url: "" },
      { date: "2024-02-01", platform: "twitter", author: "b", content: "Brand", url: "" },
    ];
    const enriched = mentions.map((m) => enrichMention(m, matcher));
    const r = checkAlert(enriched, 10);
    expect(r.triggered).toBe(false);
  });
});

describe("mention-tracker renderText", () => {
  it("renders report for mentions", () => {
    const matcher = buildBrandMatcher("Brand Inc", ["BrandCo"]);
    const enriched = parseMentions(SAMPLE_CSV).mentions.map((m) => enrichMention(m, matcher));
    const txt = renderText(enriched, "Brand Inc");
    expect(txt).toContain("Social Media Mention Report");
    expect(txt).toContain("Brand: Brand Inc");
    expect(txt).toContain("Summary");
    expect(txt).toContain("By Platform");
    expect(txt).toContain("Top Authors");
    expect(txt).toContain("Top Mentions by Reach");
  });
  it("renders empty message for no mentions", () => {
    expect(renderText([], "Brand Inc")).toBe("No mentions to report.");
  });
});

describe("mention-tracker renderCsv", () => {
  it("renders header", () => {
    const csv = renderCsv([]);
    expect(csv).toContain("date,platform,author,content,url,sentiment,reach,brand_match,sentiment_source");
  });
  it("renders mention rows", () => {
    const matcher = buildBrandMatcher("Brand Inc", []);
    const enriched = parseMentions(SAMPLE_CSV).mentions.map((m) => enrichMention(m, matcher));
    const csv = renderCsv(enriched);
    const lines = csv.split("\n");
    expect(lines.length).toBe(9); // header + 8 mentions
    expect(csv).toContain("twitter");
    expect(csv).toContain("reddit");
  });
});

describe("mention-tracker history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, brand: "Brand Inc", mentionCount: 8, platformCount: 6, avgSentiment: 0.2, totalReach: 10000 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, brand: "x", mentionCount: 1, platformCount: 1, avgSentiment: 0, totalReach: 100 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, brand: "x", mentionCount: 1, platformCount: 1, avgSentiment: 0, totalReach: 100 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("mention-tracker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      brand: "Brand Inc",
      aliases: "BrandCo",
      platforms: "twitter,reddit",
      mentions: "csv,data",
      dateStart: "2024-01-01",
      dateEnd: "",
    });
    expect(url).toContain("brand=Brand+Inc");
    expect(url).toContain("aliases=BrandCo");
    expect(url).toContain("platforms=twitter%2Creddit");
    expect(url).toContain("mentions=csv%2Cdata");
    expect(url).toContain("start=2024-01-01");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("brand=Brand+Inc&aliases=BrandCo&platforms=twitter%2Creddit&mentions=csv%2Cdata&start=2024-01-01");
    expect(p.brand).toBe("Brand Inc");
    expect(p.aliases).toBe("BrandCo");
    expect(p.platforms).toBe("twitter,reddit");
    expect(p.mentions).toBe("csv,data");
    expect(p.dateStart).toBe("2024-01-01");
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.brand).toBe("");
    expect(p.mentions).toBe("");
  });
  it("parsePlatformsParam filters invalid platforms", () => {
    expect(parsePlatformsParam("twitter,invalid,reddit")).toEqual(["twitter", "reddit"]);
  });
  it("parsePlatformsParam returns empty for empty input", () => {
    expect(parsePlatformsParam("")).toEqual([]);
  });
});

// Suppress unused-import lint
export type _Unused = Platform | MentionInput;
