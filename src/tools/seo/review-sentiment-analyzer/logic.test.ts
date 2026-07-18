import { describe, it, expect, beforeEach } from "vitest";
import {
  POSITIVE_WORDS,
  NEGATIVE_WORDS,
  NEGATION_WORDS,
  STOPWORDS,
  EXAMPLE_REVIEWS,
  FILTER_OPTIONS,
  tokenize,
  parseStarRating,
  normalizeReviewText,
  parseReviews,
  analyzeSentiment,
  scoreToLabel,
  extractTopicsFromText,
  extractTopTopics,
  computeWordFrequency,
  computeStarDistribution,
  computeAverageStars,
  detectMismatch,
  computeSummaryStats,
  filterReviews,
  renderText,
  renderCsv,
  splitCsvRow,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type FilterOption,
  type SentimentLabel,
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

describe("review-sentiment-analyzer constants", () => {
  it("has 50+ positive words", () => {
    expect(POSITIVE_WORDS.length).toBeGreaterThanOrEqual(50);
  });
  it("has 50+ negative words", () => {
    expect(NEGATIVE_WORDS.length).toBeGreaterThanOrEqual(50);
  });
  it("has 100+ total lexicon entries", () => {
    expect(POSITIVE_WORDS.length + NEGATIVE_WORDS.length).toBeGreaterThanOrEqual(100);
  });
  it("positive and negative do not overlap", () => {
    const pos = new Set(POSITIVE_WORDS);
    const neg = new Set(NEGATIVE_WORDS);
    for (const w of pos) expect(neg.has(w)).toBe(false);
  });
  it("has negation words", () => {
    expect(NEGATION_WORDS).toContain("not");
    expect(NEGATION_WORDS).toContain("didn't");
    expect(NEGATION_WORDS).toContain("never");
  });
  it("has stopwords", () => {
    expect(STOPWORDS).toContain("the");
    expect(STOPWORDS).toContain("and");
  });
  it("has example reviews", () => {
    expect(EXAMPLE_REVIEWS).toContain("[5]");
    expect(EXAMPLE_REVIEWS).toContain("[1]");
  });
  it("has 5 filter options", () => {
    expect(FILTER_OPTIONS).toHaveLength(5);
    expect(FILTER_OPTIONS.map((o) => o.value)).toEqual(
      expect.arrayContaining(["all", "positive", "negative", "neutral", "mismatch"]),
    );
  });
});

describe("review-sentiment-analyzer tokenize", () => {
  it("lowercases and extracts word tokens", () => {
    expect(tokenize("Amazing service! Highly recommend.")).toEqual([
      "amazing", "service", "highly", "recommend",
    ]);
  });
  it("handles contractions", () => {
    expect(tokenize("didn't enjoy")).toEqual(["didn't", "enjoy"]);
  });
  it("returns empty for empty input", () => {
    expect(tokenize("")).toEqual([]);
  });
  it("ignores punctuation and digits", () => {
    expect(tokenize("5 stars, 100% great!!!")).toEqual(["stars", "great"]);
  });
});

describe("review-sentiment-analyzer parseStarRating", () => {
  it("parses [5] prefix", () => {
    expect(parseStarRating("[5] Amazing!")).toEqual({ text: "Amazing!", stars: 5 });
  });
  it("parses [1] prefix", () => {
    expect(parseStarRating("[1] Awful.")).toEqual({ text: "Awful.", stars: 1 });
  });
  it("returns null stars when no prefix", () => {
    expect(parseStarRating("Just a review")).toEqual({ text: "Just a review", stars: null });
  });
  it("rejects out-of-range star ratings", () => {
    expect(parseStarRating("[0] Bad").stars).toBeNull();
    expect(parseStarRating("[6] Great").stars).toBeNull();
  });
  it("trims leading whitespace", () => {
    expect(parseStarRating("   [3] Okay")).toEqual({ text: "Okay", stars: 3 });
  });
});

describe("review-sentiment-analyzer normalizeReviewText", () => {
  it("collapses whitespace", () => {
    expect(normalizeReviewText("  amazing    service  ")).toBe("amazing service");
  });
  it("handles empty", () => {
    expect(normalizeReviewText("")).toBe("");
  });
});

describe("review-sentiment-analyzer analyzeSentiment", () => {
  it("detects positive sentiment", () => {
    const r = analyzeSentiment("Amazing service and friendly staff");
    expect(r.score).toBeGreaterThan(0);
    expect(r.positiveWords).toContain("amazing");
    expect(r.positiveWords).toContain("friendly");
  });
  it("detects negative sentiment", () => {
    const r = analyzeSentiment("Terrible service and rude staff");
    expect(r.score).toBeLessThan(0);
    expect(r.negativeWords).toContain("terrible");
    expect(r.negativeWords).toContain("rude");
  });
  it("returns 0 for neutral text", () => {
    const r = analyzeSentiment("It was a place with food");
    expect(r.score).toBe(0);
  });
  it("handles 'not good' as negative (negation flip)", () => {
    const r = analyzeSentiment("not good");
    expect(r.score).toBeLessThan(0);
    expect(r.negativeWords).toContain("good");
    expect(r.positiveWords).toHaveLength(0);
  });
  it("handles 'no problem' as neutral (problem not in lexicon)", () => {
    const r = analyzeSentiment("no problem");
    expect(r.score).toBe(0);
    expect(r.positiveWords).toHaveLength(0);
    expect(r.negativeWords).toHaveLength(0);
  });
  it("handles 'didn't enjoy' as negative", () => {
    const r = analyzeSentiment("didn't enjoy");
    expect(r.score).toBeLessThan(0);
    expect(r.negativeWords).toContain("enjoy");
  });
  it("clamps score to [-10, +10]", () => {
    const many = Array(15).fill("amazing").join(" ");
    const r = analyzeSentiment(many);
    expect(r.score).toBe(10);
  });
  it("clamps negative score to -10", () => {
    const many = Array(15).fill("terrible").join(" ");
    const r = analyzeSentiment(many);
    expect(r.score).toBe(-10);
  });
});

describe("review-sentiment-analyzer scoreToLabel", () => {
  it("positive for score > 0", () => {
    expect(scoreToLabel(1)).toBe("positive");
    expect(scoreToLabel(5)).toBe("positive");
  });
  it("negative for score < 0", () => {
    expect(scoreToLabel(-1)).toBe("negative");
    expect(scoreToLabel(-5)).toBe("negative");
  });
  it("neutral for score = 0", () => {
    expect(scoreToLabel(0)).toBe("neutral");
  });
});

describe("review-sentiment-analyzer extractTopicsFromText", () => {
  it("extracts top N keywords", () => {
    const topics = extractTopicsFromText("Great pizza, amazing pizza, friendly pizza, service", 5);
    expect(topics[0]).toBe("pizza");
    expect(topics).toContain("service");
  });
  it("filters stopwords", () => {
    const topics = extractTopicsFromText("the and the pizza", 5);
    expect(topics).toContain("pizza");
    expect(topics).not.toContain("the");
    expect(topics).not.toContain("and");
  });
  it("filters short words (len < 3)", () => {
    const topics = extractTopicsFromText("ok great pizza", 5);
    expect(topics).not.toContain("ok");
  });
});

describe("review-sentiment-analyzer extractTopTopics", () => {
  it("aggregates topics across reviews", () => {
    const reviews = parseReviews("Great pizza\nAmazing pizza\nBest pizza ever");
    const topics = extractTopTopics(reviews, 3);
    expect(topics[0]).toBe("pizza");
  });
});

describe("review-sentiment-analyzer computeWordFrequency", () => {
  it("returns sorted word counts", () => {
    const reviews = parseReviews("amazing pizza delicious pizza\nfriendly service was good");
    const freq = computeWordFrequency(reviews, 10);
    expect(freq[0].word).toBe("pizza");
    expect(freq[0].count).toBe(2);
    expect(freq.find((w) => w.word === "amazing")?.count).toBe(1);
    expect(freq.find((w) => w.word === "service")?.count).toBe(1);
    expect(freq.find((w) => w.word === "good")?.count).toBe(1);
  });
  it("respects n limit", () => {
    const reviews = parseReviews("amazing brilliant wonderful great fantastic excellent");
    const freq = computeWordFrequency(reviews, 3);
    expect(freq).toHaveLength(3);
  });
});

describe("review-sentiment-analyzer parseReviews", () => {
  it("parses multiple lines into reviews", () => {
    const reviews = parseReviews("[5] Amazing!\n[1] Terrible.\nPlain review");
    expect(reviews).toHaveLength(3);
    expect(reviews[0].stars).toBe(5);
    expect(reviews[1].stars).toBe(1);
    expect(reviews[2].stars).toBeNull();
  });
  it("skips blank lines", () => {
    const reviews = parseReviews("good\n\nbad");
    expect(reviews).toHaveLength(2);
  });
  it("skips lines with only star prefix", () => {
    const reviews = parseReviews("[5]   \nreal review");
    expect(reviews).toHaveLength(1);
    expect(reviews[0].text).toBe("real review");
  });
  it("returns empty for empty input", () => {
    expect(parseReviews("")).toEqual([]);
  });
  it("populates score and label", () => {
    const reviews = parseReviews("Amazing! Great service!");
    expect(reviews[0].label).toBe("positive");
    expect(reviews[0].score).toBeGreaterThan(0);
  });
  it("populates topics per review", () => {
    const reviews = parseReviews("Great pizza and friendly service");
    expect(reviews[0].topics.length).toBeGreaterThan(0);
    expect(reviews[0].topics).toContain("pizza");
  });
});

describe("review-sentiment-analyzer computeStarDistribution", () => {
  it("counts each rating", () => {
    const reviews = parseReviews("[5] a\n[5] b\n[4] c\n[1] d\nno rating");
    const dist = computeStarDistribution(reviews);
    expect(dist[5]).toBe(2);
    expect(dist[4]).toBe(1);
    expect(dist[1]).toBe(1);
    expect(dist[3]).toBe(0);
  });
});

describe("review-sentiment-analyzer computeAverageStars", () => {
  it("computes average of rated reviews", () => {
    const reviews = parseReviews("[5] a\n[3] b\n[4] c");
    expect(computeAverageStars(reviews)).toBe(4);
  });
  it("returns null when no ratings", () => {
    const reviews = parseReviews("no rating\nanother");
    expect(computeAverageStars(reviews)).toBeNull();
  });
  it("rounds to 1 decimal", () => {
    const reviews = parseReviews("[5] a\n[4] b\n[4] c");
    // (5 + 4 + 4) / 3 = 4.333... → 4.3
    expect(computeAverageStars(reviews)).toBe(4.3);
  });
});

describe("review-sentiment-analyzer detectMismatch", () => {
  it("flags 5 stars + negative text", () => {
    expect(detectMismatch(5, "negative")).toBe(true);
  });
  it("flags 1 star + positive text", () => {
    expect(detectMismatch(1, "positive")).toBe(true);
  });
  it("does not flag 3 stars + negative", () => {
    expect(detectMismatch(3, "negative")).toBe(false);
  });
  it("does not flag 5 stars + positive", () => {
    expect(detectMismatch(5, "positive")).toBe(false);
  });
  it("returns false when stars null", () => {
    expect(detectMismatch(null, "positive")).toBe(false);
  });
});

describe("review-sentiment-analyzer computeSummaryStats", () => {
  it("computes all summary fields", () => {
    const reviews = parseReviews(
      "[5] Amazing service and friendly staff!\n[1] Terrible, rude, and slow.\nPlain review text.",
    );
    const stats = computeSummaryStats(reviews);
    expect(stats.total).toBe(3);
    expect(stats.positive).toBe(1);
    expect(stats.negative).toBe(1);
    expect(stats.neutral).toBe(1);
    expect(stats.mismatchCount).toBe(0);
    expect(stats.avgStars).toBe(3);
    expect(stats.starDistribution[5]).toBe(1);
    expect(stats.starDistribution[1]).toBe(1);
    expect(stats.topTopics.length).toBeGreaterThan(0);
    expect(stats.topWords.length).toBeGreaterThan(0);
  });
  it("handles empty input", () => {
    const stats = computeSummaryStats([]);
    expect(stats.total).toBe(0);
    expect(stats.avgScore).toBe(0);
    expect(stats.avgStars).toBeNull();
    expect(stats.mismatchCount).toBe(0);
  });
  it("detects mismatch in stats", () => {
    const reviews = parseReviews("[5] not good at all, terrible and slow");
    // 5 stars + negative → mismatch
    expect(reviews[0].label).toBe("negative");
    expect(reviews[0].mismatch).toBe(true);
    const stats = computeSummaryStats(reviews);
    expect(stats.mismatchCount).toBe(1);
  });
});

describe("review-sentiment-analyzer filterReviews", () => {
  const reviews = parseReviews(
    "[5] Amazing!\n[1] Terrible.\nPlain text.\n[5] Not good, terrible",
  );

  it("returns all with 'all' filter", () => {
    expect(filterReviews(reviews, "all")).toHaveLength(4);
  });
  it("filters positive only", () => {
    const out = filterReviews(reviews, "positive");
    expect(out.every((r) => r.label === "positive")).toBe(true);
    expect(out.length).toBeGreaterThan(0);
  });
  it("filters negative only", () => {
    const out = filterReviews(reviews, "negative");
    expect(out.every((r) => r.label === "negative")).toBe(true);
    expect(out.length).toBeGreaterThan(0);
  });
  it("filters mismatched only", () => {
    const out = filterReviews(reviews, "mismatch");
    expect(out.every((r) => r.mismatch)).toBe(true);
    expect(out.length).toBeGreaterThan(0);
  });
  it("filters neutral only", () => {
    const out = filterReviews(reviews, "neutral");
    expect(out.every((r) => r.label === "neutral")).toBe(true);
  });
});

describe("review-sentiment-analyzer renderText", () => {
  it("includes header and summary", () => {
    const reviews = parseReviews("[5] Amazing!\n[1] Terrible.");
    const stats = computeSummaryStats(reviews);
    const txt = renderText(reviews, stats);
    expect(txt).toContain("REVIEW SENTIMENT ANALYSIS");
    expect(txt).toContain("SUMMARY");
    expect(txt).toContain("Total reviews: 2");
    expect(txt).toContain("REVIEW-BY-REVIEW");
    expect(txt).toContain("TOP WORDS");
  });
  it("handles empty reviews", () => {
    const stats = computeSummaryStats([]);
    const txt = renderText([], stats);
    expect(txt).toContain("Total reviews: 0");
  });
});

describe("review-sentiment-analyzer renderCsv", () => {
  it("has header", () => {
    expect(renderCsv([])).toContain("review,stars,sentiment_score,label,topics,mismatch");
  });
  it("renders one row per review", () => {
    const reviews = parseReviews("[5] Amazing!\n[1] Terrible.\nNo rating");
    const csv = renderCsv(reviews);
    const lines = csv.split("\n");
    expect(lines.length).toBe(reviews.length + 1);
  });
  it("escapes commas in review text", () => {
    const reviews = parseReviews("Good service, friendly staff, fast!");
    const csv = renderCsv(reviews);
    expect(csv).toContain('"');
  });
});

describe("review-sentiment-analyzer splitCsvRow", () => {
  it("splits simple", () => {
    expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("handles quoted commas", () => {
    expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]);
  });
  it("handles escaped quotes", () => {
    expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]);
  });
});

describe("review-sentiment-analyzer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, reviewCount: 5, positive: 3, negative: 1, neutral: 1,
      avgScore: 1.5, mismatchCount: 0, preview: "Amazing...",
    });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].reviewCount).toBe(5);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, reviewCount: 1, positive: 1, negative: 0, neutral: 0,
        avgScore: 1, mismatchCount: 0, preview: `r${i}`,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, reviewCount: 1, positive: 1, negative: 0, neutral: 0,
      avgScore: 1, mismatchCount: 0, preview: "x",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("review-sentiment-analyzer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("[5] Amazing service!\n[1] Terrible.");
    expect(url).toContain("reviews=");
    // URLSearchParams encodes spaces as "+" rather than "%20"
    expect(url).toContain("Amazing");
    expect(url).toContain("Terrible");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const text = "[5] Amazing!\n[1] Terrible.";
    const encoded = new URLSearchParams({ reviews: text }).toString();
    const p = parseShareUrl(encoded);
    expect(p.reviews).toBe(text);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ reviews: "" });
  });
  it("handles hash prefix", () => {
    const text = "Good review";
    const encoded = new URLSearchParams({ reviews: text }).toString();
    const p = parseShareUrl(`#${encoded}`);
    expect(p.reviews).toBe(text);
  });
});

// Suppress unused-import lints for type-only imports used in tests
export type _Unused = FilterOption | SentimentLabel;
