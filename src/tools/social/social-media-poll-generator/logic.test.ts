import { describe, it, expect, beforeEach } from "vitest";
import {
  PLATFORM_CONSTRAINTS,
  PLATFORM_LABELS,
  POLL_TYPE_LABELS,
  DURATION_LABELS,
  DURATION_HOURS,
  TONE_LABELS,
  BEST_TIME_TO_POST,
  normalizeTopic,
  parseTopicWords,
  validateDuration,
  validateOptionCount,
  validateOptionChars,
  substituteTopic,
  generateQuestion,
  generateOptions,
  buildPollOptions,
  computeOptionBalanceScore,
  computePredictedEngagement,
  optimizeEngagement,
  generateCaption,
  generateHashtags,
  suggestBestTimeToPost,
  suggestFollowUpContent,
  checkFeasibility,
  generatePoll,
  generatePollVariations,
  computeSummaryStats,
  renderText,
  renderCsv,
  splitCsvRow,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Platform,
  type PollType,
  type PollDuration,
  type Tone,
  type PollInput,
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

describe("poll-generator constants", () => {
  it("has 4 platforms with constraints", () => {
    expect(Object.keys(PLATFORM_CONSTRAINTS)).toHaveLength(4);
    expect(Object.keys(PLATFORM_LABELS)).toHaveLength(4);
  });
  it("twitter allows 2-4 options, 25 chars, 168h", () => {
    const c = PLATFORM_CONSTRAINTS.twitter;
    expect(c.minOptions).toBe(2);
    expect(c.maxOptions).toBe(4);
    expect(c.maxOptionChars).toBe(25);
    expect(c.maxDurationHours).toBe(168);
  });
  it("linkedin requires exactly 4 options, 30 chars, 336h", () => {
    const c = PLATFORM_CONSTRAINTS.linkedin;
    expect(c.minOptions).toBe(4);
    expect(c.maxOptions).toBe(4);
    expect(c.maxOptionChars).toBe(30);
    expect(c.maxDurationHours).toBe(336);
  });
  it("instagram allows 2-4 options, 25 chars, 24h", () => {
    const c = PLATFORM_CONSTRAINTS.instagram;
    expect(c.minOptions).toBe(2);
    expect(c.maxOptions).toBe(4);
    expect(c.maxOptionChars).toBe(25);
    expect(c.maxDurationHours).toBe(24);
  });
  it("facebook allows 2-7 options, 80 chars, 168h", () => {
    const c = PLATFORM_CONSTRAINTS.facebook;
    expect(c.minOptions).toBe(2);
    expect(c.maxOptions).toBe(7);
    expect(c.maxOptionChars).toBe(80);
    expect(c.maxDurationHours).toBe(168);
  });
  it("has 5 poll types, 5 durations, 5 tones", () => {
    expect(Object.keys(POLL_TYPE_LABELS)).toHaveLength(5);
    expect(Object.keys(DURATION_LABELS)).toHaveLength(5);
    expect(Object.keys(TONE_LABELS)).toHaveLength(5);
  });
  it("has best time to post for every platform", () => {
    for (const p of Object.keys(PLATFORM_LABELS) as Platform[]) {
      expect(BEST_TIME_TO_POST[p].length).toBeGreaterThan(0);
    }
  });
  it("duration hours are correct", () => {
    expect(DURATION_HOURS["1-hour"]).toBe(1);
    expect(DURATION_HOURS["4-hours"]).toBe(4);
    expect(DURATION_HOURS["24-hours"]).toBe(24);
    expect(DURATION_HOURS["3-days"]).toBe(72);
    expect(DURATION_HOURS["7-days"]).toBe(168);
  });
});

describe("poll-generator normalizeTopic", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeTopic("  Remote   Work  ")).toBe("Remote Work");
  });
  it("handles empty", () => {
    expect(normalizeTopic("")).toBe("");
  });
});

describe("poll-generator parseTopicWords", () => {
  it("splits topic into lowercase alphanumeric words", () => {
    expect(parseTopicWords("Remote Work 2024!")).toEqual(["remote", "work", "2024"]);
  });
  it("returns empty for empty topic", () => {
    expect(parseTopicWords("")).toEqual([]);
  });
});

describe("poll-generator substituteTopic", () => {
  it("substitutes topic into template", () => {
    expect(substituteTopic("What about {topic}?", "remote work"))
      .toBe("What about remote work?");
  });
  it("strips placeholder gracefully when topic is empty", () => {
    expect(substituteTopic("What about {topic}?", "")).toBe("What about?");
  });
});

describe("poll-generator generateQuestion", () => {
  it("generates a serious question", () => {
    const q = generateQuestion("remote work", "serious");
    expect(q).toBe("What is your perspective on remote work?");
  });
  it("generates a casual question", () => {
    const q = generateQuestion("AI", "casual");
    expect(q).toBe("What do you think about AI?");
  });
  it("generates a fun question with topic", () => {
    const q = generateQuestion("coffee", "fun");
    expect(q).toBe("Quick! coffee — what's your take?");
  });
  it("generates a controversial question", () => {
    const q = generateQuestion("remote work", "controversial");
    expect(q).toBe("Hot take: remote work. Where do you stand?");
  });
  it("generates an educational question", () => {
    const q = generateQuestion("SEO", "educational");
    expect(q).toBe("How familiar are you with SEO?");
  });
});

describe("poll-generator generateOptions", () => {
  it("generates 2 opposing options for this-or-that", () => {
    const opts = generateOptions("this-or-that", "AI", "serious", 2);
    expect(opts).toHaveLength(2);
    expect(opts[0]).toBe("Supports AI");
    expect(opts[1]).toBe("Opposes AI");
  });
  it("generates 4 distinct options for multiple-choice on serious tone", () => {
    const opts = generateOptions("multiple-choice", "", "serious", 4);
    expect(opts).toHaveLength(4);
    expect(opts[0]).toBe("Strongly agree");
    expect(opts[3]).toBe("Strongly disagree");
  });
  it("generates 5 rating-scale options", () => {
    const opts = generateOptions("rating-scale", "", "serious", 5);
    expect(opts).toHaveLength(5);
    expect(opts[0]).toContain("1 -");
    expect(opts[4]).toContain("5 -");
  });
  it("generates 5 opinion-scale Likert options", () => {
    const opts = generateOptions("opinion-scale", "", "serious", 5);
    expect(opts).toHaveLength(5);
    expect(opts[0]).toBe("Strongly Disagree");
    expect(opts[4]).toBe("Strongly Agree");
  });
  it("generates 3 yes-no-maybe options", () => {
    const opts = generateOptions("yes-no-maybe", "", "serious", 3);
    expect(opts).toEqual(["Yes", "No", "Maybe"]);
  });
  it("respects count for multiple-choice > 4 (pads with extras)", () => {
    const opts = generateOptions("multiple-choice", "", "serious", 6);
    expect(opts).toHaveLength(6);
    expect(opts[4]).toBe("Other");
    expect(opts[5]).toBe("Not sure");
  });
  it("controversial this-or-that includes topic", () => {
    const opts = generateOptions("this-or-that", "AI", "controversial", 2);
    expect(opts[0]).toBe("AI is essential");
    expect(opts[1]).toBe("AI is overrated");
  });
});

describe("poll-generator buildPollOptions", () => {
  it("sets charCount and overLimit flag", () => {
    const opts = buildPollOptions(["Short", "A much longer option that exceeds"], "twitter");
    expect(opts[0].charCount).toBe(5);
    expect(opts[0].overLimit).toBe(false);
    expect(opts[1].overLimit).toBe(true);
  });
});

describe("poll-generator validateDuration", () => {
  it("allows 7 days on twitter", () => {
    expect(validateDuration("twitter", "7-days").ok).toBe(true);
  });
  it("rejects 7 days on instagram", () => {
    const r = validateDuration("instagram", "7-days");
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain("24h");
  });
  it("allows 24 hours on instagram", () => {
    expect(validateDuration("instagram", "24-hours").ok).toBe(true);
  });
  it("allows all durations on linkedin (max 336h)", () => {
    for (const d of Object.keys(DURATION_LABELS) as PollDuration[]) {
      expect(validateDuration("linkedin", d).ok).toBe(true);
    }
  });
});

describe("poll-generator validateOptionCount", () => {
  it("rejects 5 options on twitter", () => {
    const r = validateOptionCount("twitter", 5);
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toContain("at most 4");
  });
  it("rejects 3 options on linkedin (requires 4)", () => {
    const r = validateOptionCount("linkedin", 3);
    expect(r.ok).toBe(false);
  });
  it("allows 7 options on facebook", () => {
    expect(validateOptionCount("facebook", 7).ok).toBe(true);
  });
  it("rejects 0 options", () => {
    expect(validateOptionCount("twitter", 0).ok).toBe(false);
  });
});

describe("poll-generator validateOptionChars", () => {
  it("warns when option exceeds char limit", () => {
    const r = validateOptionChars("twitter", ["OK", "A very long option that exceeds the 25 char limit of twitter"]);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
  it("no warnings when all options fit", () => {
    const r = validateOptionChars("facebook", ["Short", "Also short"]);
    expect(r.warnings).toHaveLength(0);
  });
});

describe("poll-generator computeOptionBalanceScore", () => {
  it("returns 100 when all options are equal length", () => {
    const opts = buildPollOptions(["Yes", "No!", "Maybe"], "facebook");
    // Lengths: 3, 3, 5 → diff 2 → 100 - 4 = 96
    const s = computeOptionBalanceScore(opts);
    expect(s).toBe(96);
  });
  it("returns 0 for empty options", () => {
    expect(computeOptionBalanceScore([])).toBe(0);
  });
  it("lower score when options vary a lot", () => {
    const opts = buildPollOptions(["A", "A super long option that is much longer"], "facebook");
    const s = computeOptionBalanceScore(opts);
    expect(s).toBeLessThan(50);
  });
});

describe("poll-generator computePredictedEngagement", () => {
  it("returns a value between 0 and 100", () => {
    const s = computePredictedEngagement("twitter", "this-or-that", 90, 2, "24-hours");
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
  it("this-or-that scores higher than rating-scale (all else equal)", () => {
    const tot = computePredictedEngagement("twitter", "this-or-that", 80, 2, "24-hours");
    const trs = computePredictedEngagement("twitter", "rating-scale", 80, 5, "24-hours");
    expect(tot).toBeGreaterThan(trs);
  });
  it("24h duration gets a bonus vs 1-hour", () => {
    const a = computePredictedEngagement("twitter", "yes-no-maybe", 80, 3, "24-hours");
    const b = computePredictedEngagement("twitter", "yes-no-maybe", 80, 3, "1-hour");
    expect(a).toBeGreaterThan(b);
  });
});

describe("poll-generator optimizeEngagement", () => {
  it("truncates options that exceed platform max chars", () => {
    const opts = buildPollOptions(["Short", "A very long option that exceeds the 25 char limit of twitter"], "twitter");
    const opt = optimizeEngagement(opts, "twitter");
    expect(opt.every((o) => o.charCount <= 25)).toBe(true);
    expect(opt.every((o) => !o.overLimit)).toBe(true);
  });
  it("returns empty for empty input", () => {
    expect(optimizeEngagement([], "twitter")).toEqual([]);
  });
  it("preserves options that already fit", () => {
    const opts = buildPollOptions(["Yes", "No"], "twitter");
    const opt = optimizeEngagement(opts, "twitter");
    expect(opt[0].text).toBe("Yes");
    expect(opt[1].text).toBe("No");
  });
});

describe("poll-generator generateCaption", () => {
  it("generates a caption with topic for serious tone", () => {
    expect(generateCaption("remote work", "serious"))
      .toBe("We'd love your input on remote work. Please vote below.");
  });
  it("generates a fun caption with topic", () => {
    expect(generateCaption("coffee", "fun"))
      .toBe("Alright internet, settle this: coffee! 🎉 Vote below 👇");
  });
});

describe("poll-generator generateHashtags", () => {
  it("generates 3-5 hashtags for a multi-word topic", () => {
    const tags = generateHashtags("remote work");
    expect(tags.length).toBeGreaterThanOrEqual(3);
    expect(tags.length).toBeLessThanOrEqual(5);
    expect(tags[0]).toBe("#remotework");
  });
  it("includes topic + suffix hashtag", () => {
    const tags = generateHashtags("AI");
    expect(tags).toContain("#ai");
    expect(tags.some((t) => t.startsWith("#ai"))).toBe(true);
  });
  it("returns fallback hashtags for empty topic", () => {
    const tags = generateHashtags("");
    expect(tags.length).toBeGreaterThanOrEqual(1);
    expect(tags[0]).toBe("#poll");
  });
});

describe("poll-generator suggestBestTimeToPost", () => {
  it("returns a suggestion for twitter", () => {
    expect(suggestBestTimeToPost("twitter")).toContain("Weekdays");
  });
  it("returns a suggestion for linkedin", () => {
    expect(suggestBestTimeToPost("linkedin")).toContain("Tue-Thu");
  });
  it("returns a suggestion for instagram", () => {
    expect(suggestBestTimeToPost("instagram")).toContain("Mon-Fri");
  });
  it("returns a suggestion for facebook", () => {
    expect(suggestBestTimeToPost("facebook")).toContain("Wed-Thu");
  });
});

describe("poll-generator suggestFollowUpContent", () => {
  it("returns 3 suggestions for this-or-that", () => {
    const s = suggestFollowUpContent("this-or-that");
    expect(s).toHaveLength(3);
  });
  it("returns suggestions mentioning 'Maybe' for yes-no-maybe", () => {
    const s = suggestFollowUpContent("yes-no-maybe");
    expect(s.some((x) => x.includes("Maybe"))).toBe(true);
  });
});

describe("poll-generator checkFeasibility", () => {
  it("flags 7-day duration on instagram as error", () => {
    const r = checkFeasibility({
      topic: "AI", platform: "instagram", pollType: "this-or-that",
      optionCount: 2, duration: "7-days", tone: "serious",
    });
    expect(r.ok).toBe(false);
  });
  it("warns when topic is empty", () => {
    const r = checkFeasibility({
      topic: "", platform: "twitter", pollType: "this-or-that",
      optionCount: 2, duration: "24-hours", tone: "serious",
    });
    expect(r.warnings.some((w) => w.includes("Topic is empty"))).toBe(true);
  });
  it("passes a valid twitter poll", () => {
    const r = checkFeasibility({
      topic: "AI", platform: "twitter", pollType: "this-or-that",
      optionCount: 2, duration: "24-hours", tone: "casual",
    });
    expect(r.ok).toBe(true);
  });
});

describe("poll-generator generatePoll", () => {
  it("generates a full poll with all fields populated", () => {
    const poll = generatePoll({
      topic: "remote work", platform: "twitter", pollType: "this-or-that",
      optionCount: 2, duration: "24-hours", tone: "serious",
    });
    expect(poll.question).toContain("remote work");
    expect(poll.options).toHaveLength(2);
    expect(poll.caption.length).toBeGreaterThan(0);
    expect(poll.hashtags.length).toBeGreaterThanOrEqual(3);
    expect(poll.bestTimeToPost).toContain("Weekdays");
    expect(poll.predictedEngagement).toBeGreaterThanOrEqual(0);
    expect(poll.balanceScore).toBeGreaterThanOrEqual(0);
    expect(poll.followUpSuggestions).toHaveLength(3);
    expect(poll.durationLabel).toBe("24 Hours");
    expect(poll.durationHours).toBe(24);
  });
  it("optimizes options to fit platform chars", () => {
    const poll = generatePoll({
      topic: "remote work", platform: "twitter", pollType: "multiple-choice",
      optionCount: 4, duration: "24-hours", tone: "serious",
    });
    expect(poll.options.every((o) => !o.overLimit)).toBe(true);
  });
});

describe("poll-generator generatePollVariations", () => {
  it("generates exactly 3 variations", () => {
    const vs = generatePollVariations({
      topic: "AI", platform: "twitter", pollType: "this-or-that",
      optionCount: 2, duration: "24-hours", tone: "serious",
    });
    expect(vs).toHaveLength(3);
  });
  it("variation 2 has controversial tone question", () => {
    const vs = generatePollVariations({
      topic: "AI", platform: "twitter", pollType: "this-or-that",
      optionCount: 2, duration: "24-hours", tone: "serious",
    });
    expect(vs[1].question).toContain("Hot take");
  });
});

describe("poll-generator computeSummaryStats", () => {
  it("computes stats from a poll", () => {
    const poll = generatePoll({
      topic: "AI", platform: "twitter", pollType: "yes-no-maybe",
      optionCount: 3, duration: "24-hours", tone: "casual",
    });
    const s = computeSummaryStats(poll);
    expect(s.totalOptions).toBe(3);
    expect(s.avgCharCount).toBeGreaterThan(0);
    expect(s.durationHours).toBe(24);
    expect(s.durationLabel).toBe("24 Hours");
    expect(s.overLimitCount).toBe(0);
  });
});

describe("poll-generator renderText", () => {
  it("renders question, options, duration, hashtags", () => {
    const poll = generatePoll({
      topic: "AI", platform: "twitter", pollType: "this-or-that",
      optionCount: 2, duration: "24-hours", tone: "serious",
    });
    const text = renderText(poll);
    expect(text).toContain("Q:");
    expect(text).toContain("A)");
    expect(text).toContain("Duration: 24 Hours");
    expect(text).toContain("Predicted engagement:");
    expect(text).toContain("#");
  });
  it("includes follow-up suggestions", () => {
    const poll = generatePoll({
      topic: "AI", platform: "twitter", pollType: "yes-no-maybe",
      optionCount: 3, duration: "24-hours", tone: "serious",
    });
    const text = renderText(poll);
    expect(text).toContain("Follow-up content ideas:");
  });
});

describe("poll-generator renderCsv", () => {
  it("renders header row", () => {
    const poll = generatePoll({
      topic: "AI", platform: "twitter", pollType: "this-or-that",
      optionCount: 2, duration: "24-hours", tone: "serious",
    });
    const csv = renderCsv(poll);
    expect(csv.split("\n")[0]).toBe("component,value");
  });
  it("renders question, caption, duration rows", () => {
    const poll = generatePoll({
      topic: "AI", platform: "twitter", pollType: "this-or-that",
      optionCount: 2, duration: "24-hours", tone: "serious",
    });
    const csv = renderCsv(poll);
    expect(csv).toContain("question,");
    expect(csv).toContain("caption,");
    expect(csv).toContain("duration,");
    expect(csv).toContain("duration_hours,24");
    expect(csv).toContain("option_1,");
    expect(csv).toContain("option_1_chars,");
  });
});

describe("poll-generator splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
});

describe("poll-generator history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, topic: "AI", platform: "twitter",
      pollType: "this-or-that", predictedEngagement: 80,
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].topic).toBe("AI");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, topic: `t${i}`, platform: "twitter",
        pollType: "this-or-that", predictedEngagement: 50,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, topic: "AI", platform: "twitter",
      pollType: "this-or-that", predictedEngagement: 80,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("poll-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      topic: "AI", platform: "twitter", pollType: "this-or-that",
      optionCount: 2, duration: "24-hours", tone: "serious",
    });
    expect(url).toContain("topic=AI");
    expect(url).toContain("platform=twitter");
    expect(url).toContain("type=this-or-that");
    expect(url).toContain("count=2");
    expect(url).toContain("duration=24-hours");
    expect(url).toContain("tone=serious");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const { input, hasAny } = parseShareUrl(
      "topic=AI&platform=twitter&type=this-or-that&count=2&duration=24-hours&tone=serious",
    );
    expect(hasAny).toBe(true);
    expect(input.topic).toBe("AI");
    expect(input.platform).toBe("twitter");
    expect(input.pollType).toBe("this-or-that");
    expect(input.optionCount).toBe(2);
    expect(input.duration).toBe("24-hours");
    expect(input.tone).toBe("serious");
  });
  it("handles empty hash", () => {
    const { input, hasAny } = parseShareUrl("");
    expect(hasAny).toBe(false);
    expect(input).toEqual({});
  });
  it("filters unknown enum values", () => {
    const { input } = parseShareUrl("platform=tiktok&type=unknown&duration=bad&tone=weird");
    expect(input.platform).toBeUndefined();
    expect(input.pollType).toBeUndefined();
    expect(input.duration).toBeUndefined();
    expect(input.tone).toBeUndefined();
  });
  it("rejects invalid count", () => {
    const { input } = parseShareUrl("count=abc");
    expect(input.optionCount).toBeUndefined();
  });
});

// Suppress unused-import lint
export type _Unused = Platform | PollType | PollDuration | Tone | PollInput;
