import { describe, it, expect, beforeEach } from "vitest";
import {
  PLATFORMS,
  MODES,
  PLATFORM_LABELS,
  MODE_LABELS,
  CHAR_LIMITS,
  OPTIMAL_RANGES,
  TWITTER_URL_LENGTH,
  READING_WPM,
  URL_REGEX,
  HASHTAG_REGEX,
  MENTION_REGEX,
  EMOJI_REGEX,
  SKIN_TONE_REGEX,
  countChars,
  countGraphemes,
  countWords,
  findHashtags,
  findMentions,
  findUrls,
  countEmojis,
  countLineBreaks,
  getLimit,
  getOptimalRange,
  computeUrlChars,
  computeWeightedChars,
  getLengthStatus,
  computeRemaining,
  estimateReadingTimeSec,
  truncateToFit,
  renderPreview,
  buildResult,
  renderText,
  renderCsv,
  escapeCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Platform,
  type Mode,
  type CounterInput,
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

describe("character-counter constants", () => {
  it("has 6 platforms", () => {
    expect(PLATFORMS).toHaveLength(6);
    expect(PLATFORMS).toContain("twitter");
    expect(PLATFORMS).toContain("mastodon");
  });
  it("has 4 modes", () => {
    expect(MODES).toHaveLength(4);
    expect(MODES).toContain("post");
    expect(MODES).toContain("dm");
  });
  it("has labels for every platform", () => {
    for (const p of PLATFORMS) {
      expect(PLATFORM_LABELS[p]).toBeTruthy();
    }
  });
  it("has labels for every mode", () => {
    for (const m of MODES) {
      expect(MODE_LABELS[m]).toBeTruthy();
    }
  });
  it("has char limits for every platform × mode", () => {
    for (const p of PLATFORMS) {
      for (const m of MODES) {
        expect(CHAR_LIMITS[p][m]).toBeGreaterThan(0);
      }
    }
  });
  it("has optimal ranges for every platform", () => {
    for (const p of PLATFORMS) {
      expect(OPTIMAL_RANGES[p].min).toBeLessThanOrEqual(OPTIMAL_RANGES[p].max);
    }
  });
  it("Twitter post limit is 280", () => {
    expect(CHAR_LIMITS.twitter.post).toBe(280);
  });
  it("Mastodon post limit is 500", () => {
    expect(CHAR_LIMITS.mastodon.post).toBe(500);
  });
  it("Twitter t.co URL length is 23", () => {
    expect(TWITTER_URL_LENGTH).toBe(23);
  });
  it("Reading WPM is 200", () => {
    expect(READING_WPM).toBe(200);
  });
});

describe("character-counter countChars (UTF-16)", () => {
  it("counts ASCII as length", () => {
    expect(countChars("hello")).toBe(5);
  });
  it("counts emoji (BMP-external) as 2", () => {
    expect(countChars("😀")).toBe(2);
  });
  it("counts emoji + ascii mixed", () => {
    expect(countChars("hi 😀")).toBe(5); // h + i + space + 😀(2) = 5
  });
  it("empty string is 0", () => {
    expect(countChars("")).toBe(0);
  });
});

describe("character-counter countGraphemes", () => {
  it("counts ASCII correctly", () => {
    expect(countGraphemes("hello")).toBe(5);
  });
  it("counts emoji as 1 grapheme", () => {
    expect(countGraphemes("😀")).toBe(1);
  });
  it("counts emoji + text mixed", () => {
    expect(countGraphemes("hi 😀")).toBe(4); // h, i, space, 😀
  });
  it("counts ZWJ family as 1 grapheme", () => {
    // Family: man + ZWJ + woman + ZJ + girl = 1 grapheme cluster
    expect(countGraphemes("👨‍👩‍👧")).toBe(1);
  });
});

describe("character-counter countWords", () => {
  it("counts words split on whitespace", () => {
    expect(countWords("hello world foo")).toBe(3);
  });
  it("handles leading/trailing whitespace", () => {
    expect(countWords("  hello  world  ")).toBe(2);
  });
  it("returns 0 for empty", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
});

describe("character-counter findHashtags", () => {
  it("finds #hashtags", () => {
    expect(findHashtags("hello #world #foo")).toEqual(["#world", "#foo"]);
  });
  it("handles underscores and digits", () => {
    expect(findHashtags("#foo_bar #baz123")).toEqual(["#foo_bar", "#baz123"]);
  });
  it("returns empty for none", () => {
    expect(findHashtags("no hashtags here")).toEqual([]);
  });
});

describe("character-counter findMentions", () => {
  it("finds @mentions", () => {
    expect(findMentions("hi @user and @another.user")).toEqual(["@user", "@another.user"]);
  });
  it("returns empty for none", () => {
    expect(findMentions("no mentions")).toEqual([]);
  });
});

describe("character-counter findUrls", () => {
  it("finds http URLs", () => {
    expect(findUrls("visit https://example.com/path?q=1 today")).toEqual(["https://example.com/path?q=1"]);
  });
  it("finds www URLs", () => {
    expect(findUrls("see www.example.com for info")).toEqual(["www.example.com"]);
  });
  it("returns empty for none", () => {
    expect(findUrls("no urls here")).toEqual([]);
  });
});

describe("character-counter countEmojis", () => {
  it("counts a single emoji as 1", () => {
    expect(countEmojis("😀")).toBe(1);
  });
  it("counts multiple emojis", () => {
    expect(countEmojis("😀🎉🚀")).toBe(3);
  });
  it("counts emojis mixed with text", () => {
    expect(countEmojis("hi 😀 there 🎉")).toBe(2);
  });
  it("handles skin tone modifiers", () => {
    // 👍🏽 = thumbs up + skin tone modifier = 1 grapheme cluster (1 emoji)
    expect(countEmojis("👍🏽")).toBe(1);
  });
  it("handles ZWJ family sequence as 1 emoji", () => {
    expect(countEmojis("👨‍👩‍👧")).toBe(1);
  });
  it("returns 0 for text only", () => {
    expect(countEmojis("just text")).toBe(0);
  });
  it("returns 0 for empty", () => {
    expect(countEmojis("")).toBe(0);
  });
});

describe("character-counter countLineBreaks", () => {
  it("counts newlines", () => {
    expect(countLineBreaks("line1\nline2\nline3")).toBe(2);
  });
  it("handles no newlines", () => {
    expect(countLineBreaks("no breaks")).toBe(0);
  });
  it("handles empty", () => {
    expect(countLineBreaks("")).toBe(0);
  });
});

describe("character-counter getLimit + getOptimalRange", () => {
  it("Twitter post limit is 280", () => {
    expect(getLimit("twitter", "post")).toBe(280);
  });
  it("Twitter bio limit is 160", () => {
    expect(getLimit("twitter", "bio")).toBe(160);
  });
  it("Instagram post limit is 2200", () => {
    expect(getLimit("instagram", "post")).toBe(2200);
  });
  it("Mastodon post limit is 500", () => {
    expect(getLimit("mastodon", "post")).toBe(500);
  });
  it("post mode uses OPTIMAL_RANGES", () => {
    const r = getOptimalRange("twitter", "post");
    expect(r).toEqual(OPTIMAL_RANGES.twitter);
  });
  it("bio mode optimal range is a fraction of limit", () => {
    const r = getOptimalRange("twitter", "bio");
    const limit = getLimit("twitter", "bio");
    expect(r.min).toBe(Math.floor(limit * 0.5));
    expect(r.max).toBe(Math.floor(limit * 0.9));
  });
});

describe("character-counter computeUrlChars", () => {
  it("Twitter counts each URL as 23 chars", () => {
    const urls = ["https://example.com/very/long/path", "https://other.com"];
    expect(computeUrlChars(urls, "twitter")).toBe(46); // 2 × 23
  });
  it("Non-Twitter counts actual URL length", () => {
    const urls = ["https://example.com/very/long/path"];
    expect(computeUrlChars(urls, "instagram")).toBe(urls[0].length);
  });
  it("empty list returns 0", () => {
    expect(computeUrlChars([], "twitter")).toBe(0);
  });
});

describe("character-counter computeWeightedChars", () => {
  it("Twitter replaces URLs with 23-char tokens", () => {
    const text = "hi https://example.com/very/long/url world";
    const expected = "hi " + "x".repeat(23) + " world";
    expect(computeWeightedChars(text, "twitter")).toBe(expected.length);
  });
  it("Non-Twitter counts actual text length", () => {
    const text = "hi https://example.com world";
    expect(computeWeightedChars(text, "instagram")).toBe(text.length);
  });
  it("empty text is 0", () => {
    expect(computeWeightedChars("", "twitter")).toBe(0);
  });
});

describe("character-counter getLengthStatus", () => {
  const optimal = { min: 71, max: 100 };
  it("under when below optimal.min", () => {
    expect(getLengthStatus(50, 280, optimal)).toBe("under");
  });
  it("optimal when in range", () => {
    expect(getLengthStatus(80, 280, optimal)).toBe("optimal");
  });
  it("over when above optimal but under limit", () => {
    expect(getLengthStatus(150, 280, optimal)).toBe("over");
  });
  it("exceeded when over limit", () => {
    expect(getLengthStatus(300, 280, optimal)).toBe("exceeded");
  });
});

describe("character-counter computeRemaining", () => {
  it("positive when under limit", () => {
    expect(computeRemaining(100, 280)).toBe(180);
  });
  it("zero at limit", () => {
    expect(computeRemaining(280, 280)).toBe(0);
  });
  it("negative when over limit", () => {
    expect(computeRemaining(300, 280)).toBe(-20);
  });
});

describe("character-counter estimateReadingTimeSec", () => {
  it("0 words = 0 sec", () => {
    expect(estimateReadingTimeSec(0)).toBe(0);
  });
  it("200 words = 60 sec (1 min)", () => {
    expect(estimateReadingTimeSec(200)).toBe(60);
  });
  it("100 words = 30 sec", () => {
    expect(estimateReadingTimeSec(100)).toBe(30);
  });
  it("50 words = at least 1 sec", () => {
    expect(estimateReadingTimeSec(50)).toBe(15);
  });
  it("1 word = at least 1 sec", () => {
    expect(estimateReadingTimeSec(1)).toBe(1);
  });
});

describe("character-counter truncateToFit", () => {
  it("returns text unchanged when under limit", () => {
    expect(truncateToFit("hello", 280, "twitter")).toBe("hello");
  });
  it("truncates with ellipsis when over limit", () => {
    const long = "a".repeat(300);
    const out = truncateToFit(long, 280, "instagram");
    expect(out).toHaveLength(280);
    expect(out.endsWith("…")).toBe(true);
    expect(out.slice(0, -1)).toBe("a".repeat(279));
  });
  it("Twitter truncation accounts for URL shortening", () => {
    // 5 URLs × 23 chars = 115 effective chars; with separators total fits
    const text = "https://example.com/very/long/url/1 https://example.com/very/long/url/2 https://example.com/very/long/url/3";
    // Each URL ~40 chars actual = 120 + spaces = ~122 actual
    // Effective Twitter count: 3 × 23 + 2 spaces = 71
    expect(computeWeightedChars(text, "twitter")).toBe(71);
    // Should NOT be truncated (well under 280)
    expect(truncateToFit(text, 280, "twitter")).toBe(text);
  });
  it("Twitter truncation drops URL that doesn't fit", () => {
    // Build a long text with a URL at the end
    const filler = "a".repeat(260);
    const url = "https://example.com/very/long/path";
    const text = filler + " " + url;
    const truncated = truncateToFit(text, 280, "twitter");
    // Truncated should not exceed 280 weighted chars
    expect(computeWeightedChars(truncated, "twitter")).toBeLessThanOrEqual(280);
    expect(truncated.endsWith("…")).toBe(true);
  });
});

describe("character-counter buildResult", () => {
  it("builds a complete result object", () => {
    const input: CounterInput = {
      text: "Hello world! #test @user https://example.com 😀",
      platform: "twitter",
      mode: "post",
    };
    const r = buildResult(input);
    expect(r.platform).toBe("twitter");
    expect(r.mode).toBe("post");
    expect(r.limit).toBe(280);
    expect(r.wordCount).toBeGreaterThan(0);
    expect(r.hashtags).toEqual(["#test"]);
    expect(r.mentions).toEqual(["@user"]);
    expect(r.urls).toEqual(["https://example.com"]);
    expect(r.emojiCount).toBe(1);
    expect(r.metrics.length).toBeGreaterThan(8);
  });

  it("Twitter weights URLs as 23 chars", () => {
    const input: CounterInput = {
      text: "https://example.com/very/long/path",
      platform: "twitter",
      mode: "post",
    };
    const r = buildResult(input);
    expect(r.charCount).toBe(23);
    expect(r.urlCount).toBe(1);
  });

  it("Instagram counts actual URL length", () => {
    const input: CounterInput = {
      text: "https://example.com/very/long/path",
      platform: "instagram",
      mode: "post",
    };
    const r = buildResult(input);
    expect(r.charCount).toBe("https://example.com/very/long/path".length);
  });

  it("flags over-limit", () => {
    const input: CounterInput = {
      text: "a".repeat(300),
      platform: "twitter",
      mode: "post",
    };
    const r = buildResult(input);
    expect(r.overLimit).toBe(true);
    expect(r.remaining).toBe(-20);
    expect(r.lengthStatus).toBe("exceeded");
  });

  it("flags optimal range", () => {
    const input: CounterInput = {
      text: "a".repeat(80),
      platform: "twitter",
      mode: "post",
    };
    const r = buildResult(input);
    expect(r.inOptimalRange).toBe(true);
    expect(r.lengthStatus).toBe("optimal");
  });

  it("handles empty text", () => {
    const input: CounterInput = {
      text: "",
      platform: "twitter",
      mode: "post",
    };
    const r = buildResult(input);
    expect(r.charCount).toBe(0);
    expect(r.wordCount).toBe(0);
    expect(r.hashtags).toEqual([]);
    expect(r.emojiCount).toBe(0);
    expect(r.remaining).toBe(280);
  });

  it("includes truncated text", () => {
    const input: CounterInput = {
      text: "a".repeat(300),
      platform: "twitter",
      mode: "post",
    };
    const r = buildResult(input);
    expect(r.truncated.endsWith("…")).toBe(true);
    expect(r.truncated.length).toBeLessThanOrEqual(281); // 280 + 1 for ellipsis
  });
});

describe("character-counter renderers", () => {
  const input: CounterInput = {
    text: "Hello #world @user 😀",
    platform: "twitter",
    mode: "post",
  };
  const r = buildResult(input);
  const optimalR = buildResult({
    text: "a".repeat(80),
    platform: "twitter",
    mode: "post",
  });

  it("renderText produces a stats report", () => {
    const txt = renderText(r);
    expect(txt).toContain("Twitter / X");
    expect(txt).toContain("Characters (weighted)");
    expect(txt).toContain("Hashtags");
    expect(txt).toContain("#world");
    expect(txt).toContain("@user");
  });
  it("renderText flags over-limit", () => {
    const overR = buildResult({ text: "a".repeat(300), platform: "twitter", mode: "post" });
    const txt = renderText(overR);
    expect(txt).toContain("Over limit");
  });
  it("renderCsv has metric,value header", () => {
    const csv = renderCsv(r);
    expect(csv).toContain("metric,value");
    expect(csv).toContain("Characters (weighted)");
    expect(csv).toContain("platform,twitter");
    expect(csv).toContain("mode,post");
    expect(csv).toContain("length_status,under");
  });
  it("renderCsv reports optimal when in optimal range", () => {
    const csv = renderCsv(optimalR);
    expect(csv).toContain("length_status,optimal");
    expect(csv).toContain("in_optimal_range,true");
  });
  it("renderPreview passes text through", () => {
    expect(renderPreview("hello\nworld")).toBe("hello\nworld");
  });
});

describe("character-counter escapeCsv", () => {
  it("does not escape simple text", () => {
    expect(escapeCsv("hello")).toBe("hello");
  });
  it("quotes when comma present", () => {
    expect(escapeCsv("a,b")).toBe('"a,b"');
  });
  it("doubles quotes when quote present", () => {
    expect(escapeCsv('a"b')).toBe('"a""b"');
  });
});

describe("character-counter history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, text: "hello", platform: "twitter", mode: "post", charCount: 5 });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].text).toBe("hello");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, text: `t${i}`, platform: "twitter", mode: "post", charCount: i });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, text: "x", platform: "twitter", mode: "post", charCount: 1 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("character-counter shareable URL", () => {
  const input: CounterInput = {
    text: "Hello #world",
    platform: "instagram",
    mode: "bio",
  };

  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(input);
    // URLSearchParams encodes space as '+' (form-encoding) — accept either
    expect(url).toMatch(/text=Hello(\+|%20)%23world/);
    expect(url).toContain("platform=instagram");
    expect(url).toContain("mode=bio");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("round-trips inputs through parseShareUrl", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(input);
    const hash = url.substring(url.indexOf("#") + 1);
    const parsed = parseShareUrl(hash);
    expect(parsed.text).toBe("Hello #world");
    expect(parsed.platform).toBe("instagram");
    expect(parsed.mode).toBe("bio");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("parseShareUrl returns defaults for empty hash", () => {
    const p = parseShareUrl("");
    expect(p.text).toBe("");
    expect(p.platform).toBe("twitter");
    expect(p.mode).toBe("post");
  });

  it("parseShareUrl filters invalid platform", () => {
    const p = parseShareUrl("text=hi&platform=myspace&mode=post");
    expect(p.platform).toBe("twitter");
  });

  it("parseShareUrl filters invalid mode", () => {
    const p = parseShareUrl("text=hi&platform=twitter&mode=story");
    expect(p.mode).toBe("post");
  });
});

describe("character-counter regex smoke tests", () => {
  it("URL_REGEX global flag works", () => {
    const matches = "a https://x.com b www.y.com".match(URL_REGEX);
    expect(matches).toEqual(["https://x.com", "www.y.com"]);
  });
  it("HASHTAG_REGEX matches #word", () => {
    expect("hello #world".match(HASHTAG_REGEX)).toEqual(["#world"]);
  });
  it("MENTION_REGEX matches @user", () => {
    expect("hi @user".match(MENTION_REGEX)).toEqual(["@user"]);
  });
  it("EMOJI_REGEX test for emoji", () => {
    expect(EMOJI_REGEX.test("😀")).toBe(true);
    expect(EMOJI_REGEX.test("a")).toBe(false);
  });
  it("SKIN_TONE_REGEX matches modifier", () => {
    expect(SKIN_TONE_REGEX.test("👍🏽")).toBe(true);
    expect(SKIN_TONE_REGEX.test("👍")).toBe(false);
  });
});

// Suppress unused-import lint
export type _Unused = Platform | Mode;
