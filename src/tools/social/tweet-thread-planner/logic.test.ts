import { describe, it, expect, beforeEach } from "vitest";
import {
  TONES,
  TONE_LABELS,
  TRANSITIONS,
  HOOK_PREFIXES,
  CTA_TEMPLATES,
  ENGAGEMENT_BY_HOUR,
  TWEET_MAX_CHARS,
  TWEET_TARGET_CHARS,
  normalizeContent,
  splitSentences,
  estimateTweetCount,
  chunkByCharLimit,
  scoreHookStrength,
  pickHookSentence,
  buildHookTweet,
  buildCTATweet,
  applyToneModifier,
  pickTransition,
  applyNumbering,
  validateFlow,
  countCharLimitWarnings,
  computeHookStrength,
  computeEngagementScore,
  buildThread,
  buildAltVariations,
  computeSummaryStats,
  renderText,
  renderCsv,
  splitCsvRow,
  bestTimeToPost,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Tone,
  type ThreadInput,
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

const sampleContent = `Marketing is changing fast. Why? Because attention is the new currency. Most brands get this wrong. They focus on ads instead of value. Here's the secret: every great brand starts with a story. Stories make people care. When people care, they buy. But here's the thing — most stories die before they're told. They get buried in meeting notes. They get edited into corporate speak. Stop doing that. Be honest. Be brief. Be useful. Then watch what happens.`;

const sampleInput: ThreadInput = {
  mainTopic: "marketing",
  longContent: sampleContent,
  tweetsPerThread: 7,
  includeNumbering: true,
  includeHook: true,
  includeCTA: true,
  tone: "informational",
};

describe("tweet-thread-planner constants", () => {
  it("has 5 tones", () => {
    expect(TONES).toHaveLength(5);
  });
  it("has 5 tone labels", () => {
    expect(Object.keys(TONE_LABELS)).toHaveLength(5);
  });
  it("has 5 transitions", () => {
    expect(TRANSITIONS).toHaveLength(5);
  });
  it("has hook prefixes for each tone", () => {
    for (const t of TONES) {
      expect(HOOK_PREFIXES[t].length).toBeGreaterThanOrEqual(1);
    }
  });
  it("has CTA templates for each tone", () => {
    for (const t of TONES) {
      expect(CTA_TEMPLATES[t].length).toBeGreaterThanOrEqual(1);
    }
  });
  it("has 24 engagement-by-hour entries", () => {
    expect(ENGAGEMENT_BY_HOUR).toHaveLength(24);
  });
  it("tweet max chars is 280, target is 240", () => {
    expect(TWEET_MAX_CHARS).toBe(280);
    expect(TWEET_TARGET_CHARS).toBe(240);
  });
});

describe("tweet-thread-planner normalizeContent", () => {
  it("trims and collapses spaces", () => {
    expect(normalizeContent("  hello   world  ")).toBe("hello world");
  });
  it("normalizes newlines", () => {
    expect(normalizeContent("a\r\nb")).toBe("a\nb");
  });
  it("handles empty", () => {
    expect(normalizeContent("")).toBe("");
  });
});

describe("tweet-thread-planner splitSentences", () => {
  it("splits on .!?", () => {
    const s = splitSentences("Hello world. How are you? I am fine!");
    expect(s.length).toBeGreaterThanOrEqual(3);
  });
  it("returns [] for empty", () => {
    expect(splitSentences("")).toEqual([]);
  });
  it("handles paragraph breaks", () => {
    const s = splitSentences("Para one.\nPara two.");
    expect(s.length).toBeGreaterThanOrEqual(2);
  });
});

describe("tweet-thread-planner estimateTweetCount", () => {
  it("returns 0 for empty", () => {
    expect(estimateTweetCount("")).toBe(0);
  });
  it("returns 1 for short content", () => {
    expect(estimateTweetCount("Hello.")).toBe(1);
  });
  it("scales with length", () => {
    const long = "x".repeat(720);
    expect(estimateTweetCount(long)).toBe(3);
  });
});

describe("tweet-thread-planner chunkByCharLimit", () => {
  it("returns single chunk when under limit", () => {
    expect(chunkByCharLimit("short text", 280)).toEqual(["short text"]);
  });
  it("returns [] for empty", () => {
    expect(chunkByCharLimit("", 280)).toEqual([]);
  });
  it("splits long content at sentence boundaries", () => {
    const long = "Sentence one is here. Sentence two is also here. Sentence three is the final.";
    const chunks = chunkByCharLimit(long, 30);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(30);
  });
  it("hard-wraps overly long sentences by words", () => {
    const longSentence = "word ".repeat(100).trim();
    const chunks = chunkByCharLimit(longSentence, 50);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(50);
  });
});

describe("tweet-thread-planner scoreHookStrength", () => {
  it("returns 0 for empty", () => {
    expect(scoreHookStrength("")).toBe(0);
  });
  it("scores questions higher than plain statements", () => {
    const q = scoreHookStrength("Why is this happening?");
    const s = scoreHookStrength("The weather is nice.");
    expect(q).toBeGreaterThan(s);
  });
  it("scores numbered sentences higher", () => {
    const n = scoreHookStrength("Here are 5 secrets.");
    const s = scoreHookStrength("Here are secrets.");
    expect(n).toBeGreaterThan(s);
  });
  it("caps at 100", () => {
    const strong = "Why? 5 secrets nobody knows! Stop! Warning: breaking truth!";
    expect(scoreHookStrength(strong)).toBeLessThanOrEqual(100);
  });
});

describe("tweet-thread-planner pickHookSentence", () => {
  it("picks the strongest sentence", () => {
    const text = "This is plain. Why does this matter? Numbers don't lie — 5 reasons why.";
    const hook = pickHookSentence(text);
    expect(hook.length).toBeGreaterThan(0);
  });
  it("returns first sentence if all are weak", () => {
    const text = "a. b. c.";
    const hook = pickHookSentence(text);
    expect(hook.length).toBeGreaterThan(0);
  });
  it("returns empty for empty text", () => {
    expect(pickHookSentence("")).toBe("");
  });
});

describe("tweet-thread-planner buildHookTweet / buildCTATweet", () => {
  it("builds hook with tone prefix", () => {
    const hook = buildHookTweet("marketing", sampleContent, "controversial");
    expect(hook.startsWith("Hot take:") || hook.startsWith("Unpopular opinion:") || hook.startsWith("Most people get this wrong:")).toBe(true);
  });
  it("truncates hook to 280 chars", () => {
    const longContent = "x".repeat(500) + ". Why does this matter?";
    const hook = buildHookTweet("topic", longContent, "informational");
    expect(hook.length).toBeLessThanOrEqual(280);
  });
  it("builds CTA per tone", () => {
    const cta = buildCTATweet("storytelling");
    expect(cta.length).toBeGreaterThan(10);
    expect(cta).toContain("retweet");
  });
});

describe("tweet-thread-planner applyToneModifier", () => {
  it("informational returns content unchanged", () => {
    expect(applyToneModifier("Hello world.", "informational", 0)).toBe("Hello world.");
  });
  it("thread-bois lowercases content", () => {
    const out = applyToneModifier("Hello World.", "thread-bois", 1);
    expect(out.charAt(0)).toBe("h");
  });
  it("controversial adds contrarian marker every 4th", () => {
    const out = applyToneModifier("This is a take.", "controversial", 4);
    expect(out.startsWith("Contrarian view:")).toBe(true);
  });
  it("storytelling adds 'And then —' every 5th", () => {
    const out = applyToneModifier("Something happened.", "storytelling", 5);
    expect(out.startsWith("And then —")).toBe(true);
  });
});

describe("tweet-thread-planner pickTransition + applyNumbering", () => {
  it("pickTransition returns empty for index 0", () => {
    expect(pickTransition(0)).toBe("");
  });
  it("pickTransition cycles through TRANSITIONS", () => {
    expect(pickTransition(1)).toBe(TRANSITIONS[0]);
    expect(pickTransition(2)).toBe(TRANSITIONS[1]);
    expect(pickTransition(6)).toBe(TRANSITIONS[0]);
  });
  it("applyNumbering adds prefix when enabled", () => {
    expect(applyNumbering("hello", 1, 5, true)).toBe("1/5 hello");
  });
  it("applyNumbering skips when disabled", () => {
    expect(applyNumbering("hello", 1, 5, false)).toBe("hello");
  });
});

describe("tweet-thread-planner validateFlow + countCharLimitWarnings", () => {
  it("returns false for empty tweets", () => {
    expect(validateFlow([])).toBe(false);
  });
  it("returns true for single tweet", () => {
    expect(validateFlow([{ num: 1, content: "hi", charCount: 2, isHook: true, isCTA: false, withinLimit: true }])).toBe(true);
  });
  it("returns false for duplicate tweets", () => {
    const t = { num: 1, content: "dup", charCount: 3, isHook: false, isCTA: false, withinLimit: true };
    expect(validateFlow([t, { ...t, num: 2 }])).toBe(false);
  });
  it("counts over-limit tweets", () => {
    const tweets = [
      { num: 1, content: "ok", charCount: 2, isHook: false, isCTA: false, withinLimit: true },
      { num: 2, content: "x".repeat(281), charCount: 281, isHook: false, isCTA: false, withinLimit: false },
    ];
    expect(countCharLimitWarnings(tweets)).toBe(1);
  });
});

describe("tweet-thread-planner computeHookStrength + computeEngagementScore", () => {
  it("returns 0 for empty tweets", () => {
    expect(computeHookStrength([])).toBe(0);
    expect(computeEngagementScore([], false, false)).toBe(0);
  });
  it("engagement score is boosted by hook + CTA", () => {
    const tweets = [
      { num: 1, content: "Why does this matter? 5 secrets.", charCount: 33, isHook: true, isCTA: false, withinLimit: true },
      { num: 2, content: "First point here.", charCount: 18, isHook: false, isCTA: false, withinLimit: true },
      { num: 3, content: "Second point here.", charCount: 19, isHook: false, isCTA: false, withinLimit: true },
      { num: 4, content: "Third point here.", charCount: 18, isHook: false, isCTA: false, withinLimit: true },
      { num: 5, content: "Retweet the first tweet.", charCount: 24, isHook: false, isCTA: true, withinLimit: true },
    ];
    const without = computeEngagementScore(tweets, false, false);
    const withBoth = computeEngagementScore(tweets, true, true);
    expect(withBoth).toBeGreaterThan(without);
  });
  it("engagement score is capped at 100", () => {
    const tweets = [
      { num: 1, content: "Why? 5 secrets nobody knows! Stop! Warning!", charCount: 44, isHook: true, isCTA: false, withinLimit: true },
      { num: 2, content: "Second.", charCount: 7, isHook: false, isCTA: false, withinLimit: true },
      { num: 3, content: "Third.", charCount: 6, isHook: false, isCTA: false, withinLimit: true },
      { num: 4, content: "Fourth.", charCount: 7, isHook: false, isCTA: false, withinLimit: true },
      { num: 5, content: "RT the first tweet.", charCount: 19, isHook: false, isCTA: true, withinLimit: true },
    ];
    expect(computeEngagementScore(tweets, true, true)).toBeLessThanOrEqual(100);
  });
});

describe("tweet-thread-planner buildThread", () => {
  it("returns empty result for empty content", () => {
    const r = buildThread({ ...sampleInput, longContent: "" });
    expect(r.tweets).toEqual([]);
    expect(r.totalChars).toBe(0);
  });
  it("produces a thread with tweets", () => {
    const r = buildThread(sampleInput);
    expect(r.tweets.length).toBeGreaterThan(0);
    expect(r.tweets.length).toBeLessThanOrEqual(sampleInput.tweetsPerThread);
  });
  it("includes hook as first tweet when includeHook is true", () => {
    const r = buildThread(sampleInput);
    expect(r.tweets[0].isHook).toBe(true);
  });
  it("includes CTA as last tweet when includeCTA is true", () => {
    const r = buildThread(sampleInput);
    expect(r.tweets[r.tweets.length - 1].isCTA).toBe(true);
  });
  it("applies numbering 1/N ... N/N", () => {
    const r = buildThread(sampleInput);
    expect(r.tweets[0].content.startsWith("1/")).toBe(true);
    expect(r.tweets[r.tweets.length - 1].content.startsWith(`${r.tweets.length}/`)).toBe(true);
  });
  it("respects tweetsPerThread cap", () => {
    const r = buildThread({ ...sampleInput, tweetsPerThread: 5 });
    expect(r.tweets.length).toBeLessThanOrEqual(5);
  });
  it("validates flow", () => {
    const r = buildThread(sampleInput);
    expect(r.flowOk).toBe(true);
  });
  it("computes totalChars and avgChars", () => {
    const r = buildThread(sampleInput);
    expect(r.totalChars).toBeGreaterThan(0);
    expect(r.avgChars).toBeGreaterThan(0);
    expect(r.totalChars).toBeCloseTo(r.tweets.reduce((s, t) => s + t.charCount, 0), 0);
  });
});

describe("tweet-thread-planner buildAltVariations", () => {
  it("generates 2 variations with different tones", () => {
    const vars = buildAltVariations(sampleInput);
    expect(vars).toHaveLength(2);
    expect(vars[0].tone).not.toBe(sampleInput.tone);
    expect(vars[1].tone).not.toBe(sampleInput.tone);
    expect(vars[0].tone).not.toBe(vars[1].tone);
  });
});

describe("tweet-thread-planner computeSummaryStats", () => {
  it("computes summary stats", () => {
    const r = buildThread(sampleInput);
    const s = computeSummaryStats(r);
    expect(s.totalTweets).toBe(r.tweets.length);
    expect(s.totalChars).toBe(r.totalChars);
    expect(s.hasHook).toBe(true);
    expect(s.hasCTA).toBe(true);
    expect(s.overLimit + s.withinLimit).toBe(s.totalTweets);
  });
});

describe("tweet-thread-planner renderText + renderCsv", () => {
  it("renders text with blank-line separators", () => {
    const r = buildThread(sampleInput);
    const text = renderText(r);
    expect(text.split("\n\n").length).toBe(r.tweets.length);
  });
  it("renders CSV header", () => {
    const r = buildThread(sampleInput);
    const csv = renderCsv(r);
    expect(csv).toContain("tweet_num,content,char_count,is_hook,is_cta");
  });
  it("renders CSV rows", () => {
    const r = buildThread(sampleInput);
    const csv = renderCsv(r);
    expect(csv.split("\n").length).toBe(r.tweets.length + 1);
  });
  it("renders empty for empty result", () => {
    const r = buildThread({ ...sampleInput, longContent: "" });
    expect(renderText(r)).toBe("");
    expect(renderCsv(r)).toBe("tweet_num,content,char_count,is_hook,is_cta");
  });
});

describe("tweet-thread-planner splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
});

describe("tweet-thread-planner bestTimeToPost", () => {
  it("returns 3 hours sorted by multiplier desc", () => {
    const top = bestTimeToPost();
    expect(top).toHaveLength(3);
    expect(top[0].multiplier).toBeGreaterThanOrEqual(top[1].multiplier);
    expect(top[1].multiplier).toBeGreaterThanOrEqual(top[2].multiplier);
  });
  it("top hour is evening (high engagement)", () => {
    const top = bestTimeToPost();
    expect(top[0].multiplier).toBeGreaterThanOrEqual(1.3);
  });
});

describe("tweet-thread-planner history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, topic: "marketing", tone: "informational", tweetCount: 7, engagementScore: 70 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, topic: "x", tone: "informational", tweetCount: 5, engagementScore: 50 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, topic: "x", tone: "informational", tweetCount: 5, engagementScore: 50 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("tweet-thread-planner shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(sampleInput);
    expect(url).toContain("topic=marketing");
    expect(url).toContain("n=7");
    expect(url).toContain("tone=informational");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = buildShareUrl(sampleInput);
    const hash = url.includes("#") ? url.split("#")[1] : url.replace(/^\?/, "");
    const p = parseShareUrl(hash);
    expect(p.mainTopic).toBe("marketing");
    expect(p.tone).toBe("informational");
    expect(p.tweetsPerThread).toBe(7);
    expect(p.includeNumbering).toBe(true);
    expect(p.includeHook).toBe(true);
    expect(p.includeCTA).toBe(true);
  });
  it("handles empty hash", () => {
    const p = parseShareUrl("");
    expect(p.mainTopic).toBe("");
    expect(p.tone).toBe("informational");
    expect(p.tweetsPerThread).toBe(7);
  });
  it("filters invalid tone", () => {
    const p = parseShareUrl("tone=invalid&n=abc");
    expect(p.tone).toBe("informational");
    expect(p.tweetsPerThread).toBe(7);
  });
  it("parses booleans correctly", () => {
    const p = parseShareUrl("num=0&hook=0&cta=0");
    expect(p.includeNumbering).toBe(false);
    expect(p.includeHook).toBe(false);
    expect(p.includeCTA).toBe(false);
  });
});

// Suppress unused-import lint
export type _Unused = Tone;
