import { describe, it, expect, beforeEach } from "vitest";
import {
  CHANNEL_PRESETS,
  FREQUENCY_PRESETS,
  MONTH_NAMES,
  DAY_NAMES,
  DEDUP_DAYS,
  formatDate,
  parseDate,
  daysBetween,
  dayNameFor,
  generateDateList,
  parseContentMix,
  expandContentMix,
  pickContentType,
  parseTopics,
  parseChannels,
  pickTopicForDate,
  generateCalendar,
  detectConflicts,
  generateIcs,
  renderText,
  renderCsv,
  splitCsvRow,
  computeSummaryStats,
  filterByChannel,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type PostingFrequency,
  type CalendarInputs,
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

describe("content-calendar-planner constants", () => {
  it("has 7 channel presets", () => {
    expect(CHANNEL_PRESETS).toHaveLength(7);
    expect(CHANNEL_PRESETS).toContain("Blog");
    expect(CHANNEL_PRESETS).toContain("Podcast");
  });
  it("has 4 frequency presets", () => {
    expect(FREQUENCY_PRESETS).toHaveLength(4);
    expect(FREQUENCY_PRESETS.map((f) => f.value)).toEqual([
      "daily", "weekdays", "3x-week", "weekly",
    ]);
  });
  it("has 12 month names", () => { expect(MONTH_NAMES).toHaveLength(12); });
  it("has 7 day names", () => { expect(DAY_NAMES).toHaveLength(7); });
  it("dedup window is 7 days", () => { expect(DEDUP_DAYS).toBe(7); });
});

describe("content-calendar-planner date helpers", () => {
  it("formats date as YYYY-MM-DD", () => {
    expect(formatDate(2026, 1, 5)).toBe("2026-01-05");
    expect(formatDate(2026, 12, 31)).toBe("2026-12-31");
  });
  it("parses YYYY-MM-DD back to UTC date", () => {
    const d = parseDate("2026-01-05");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(0);
    expect(d.getUTCDate()).toBe(5);
  });
  it("returns invalid date for malformed input", () => {
    expect(Number.isNaN(parseDate("garbage").getTime())).toBe(true);
  });
  it("computes days between two dates", () => {
    expect(daysBetween("2026-01-01", "2026-01-08")).toBe(7);
    expect(daysBetween("2026-01-01", "2026-02-01")).toBe(31);
  });
  it("returns Infinity for invalid dates", () => {
    expect(daysBetween("bad", "2026-01-01")).toBe(Infinity);
  });
  it("returns day name for a date", () => {
    expect(dayNameFor("2026-01-05")).toBe("Mon"); // Jan 5, 2026 is Monday
    expect(dayNameFor("2026-01-01")).toBe("Thu"); // Jan 1, 2026 is Thursday
  });
});

describe("content-calendar-planner generateDateList", () => {
  it("daily frequency returns all days of the month", () => {
    const dates = generateDateList(2026, 1, "daily");
    expect(dates).toHaveLength(31);
    expect(dates[0]).toBe("2026-01-01");
    expect(dates[30]).toBe("2026-01-31");
  });
  it("daily frequency returns 28 days for February non-leap year", () => {
    expect(generateDateList(2026, 2, "daily")).toHaveLength(28);
  });
  it("weekdays frequency returns 22 weekdays for January 2026", () => {
    expect(generateDateList(2026, 1, "weekdays")).toHaveLength(22);
  });
  it("3x-week frequency returns 13 Mon/Wed/Fri for January 2026", () => {
    // Jan 2 (Fri) + 4 full weeks × 3 (Mon/Wed/Fri) = 13 dates
    expect(generateDateList(2026, 1, "3x-week")).toHaveLength(13);
    expect(generateDateList(2026, 1, "3x-week")[0]).toBe("2026-01-02");
  });
  it("weekly frequency returns 4 Mondays for January 2026", () => {
    const dates = generateDateList(2026, 1, "weekly");
    expect(dates).toHaveLength(4);
    expect(dates).toEqual(["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26"]);
  });
  it("returns empty for invalid month", () => {
    expect(generateDateList(2026, 0, "daily")).toEqual([]);
    expect(generateDateList(2026, 13, "daily")).toEqual([]);
  });
});

describe("content-calendar-planner parseContentMix", () => {
  it("parses comma-separated weights", () => {
    const mix = parseContentMix("blog:3, video:2, social:5, email:1");
    expect(mix.get("blog")).toBe(3);
    expect(mix.get("video")).toBe(2);
    expect(mix.get("social")).toBe(5);
    expect(mix.get("email")).toBe(1);
  });
  it("returns empty map for empty input", () => {
    expect(parseContentMix("").size).toBe(0);
  });
  it("skips invalid entries", () => {
    const mix = parseContentMix("blog:3, invalid, video:0, email:-1");
    expect(mix.size).toBe(1);
    expect(mix.get("blog")).toBe(3);
  });
});

describe("content-calendar-planner expandContentMix + pickContentType", () => {
  it("expands mix to weighted array", () => {
    const mix = parseContentMix("blog:3, video:2");
    const expanded = expandContentMix(mix);
    expect(expanded).toHaveLength(5);
    expect(expanded.filter((t) => t === "blog")).toHaveLength(3);
    expect(expanded.filter((t) => t === "video")).toHaveLength(2);
  });
  it("picks content type by round-robin", () => {
    const mix = parseContentMix("blog:3, video:2");
    expect(pickContentType(mix, 0)).toBe("blog");
    expect(pickContentType(mix, 1)).toBe("blog");
    expect(pickContentType(mix, 2)).toBe("blog");
    expect(pickContentType(mix, 3)).toBe("video");
    expect(pickContentType(mix, 4)).toBe("video");
    expect(pickContentType(mix, 5)).toBe("blog"); // wraps
  });
  it("returns empty string for empty mix", () => {
    expect(pickContentType(new Map(), 0)).toBe("");
  });
});

describe("content-calendar-planner parseTopics / parseChannels", () => {
  it("parses topics one per line", () => {
    expect(parseTopics("Topic A\nTopic B\nTopic C")).toEqual(["Topic A", "Topic B", "Topic C"]);
  });
  it("trims and skips blank lines", () => {
    expect(parseTopics("  A  \n\nB\n")).toEqual(["A", "B"]);
  });
  it("returns empty for empty input", () => {
    expect(parseTopics("")).toEqual([]);
  });
  it("parses channels comma-separated", () => {
    expect(parseChannels("Blog, YouTube, Email")).toEqual(["Blog", "YouTube", "Email"]);
  });
  it("parses channels newline-separated too", () => {
    expect(parseChannels("Blog\nYouTube\nEmail")).toEqual(["Blog", "YouTube", "Email"]);
  });
});

describe("content-calendar-planner pickTopicForDate (dedup)", () => {
  it("returns empty for empty topics", () => {
    expect(pickTopicForDate([], "2026-01-05", [], 0)).toBe("");
  });
  it("returns single topic when only one provided", () => {
    expect(pickTopicForDate(["Solo"], "2026-01-05", [], 0)).toBe("Solo");
  });
  it("rotates topics with no dedup (weekly)", () => {
    const assigned: { date: string; topic: string }[] = [];
    const topics = ["T1", "T2", "T3"];
    // Weekly posts in Jan 2026: Jan 5, 12, 19, 26
    const dates = ["2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26"];
    const picked = dates.map((d, i) => {
      const t = pickTopicForDate(topics, d, assigned, i);
      assigned.push({ date: d, topic: t });
      return t;
    });
    // 7-day dedup allows reuse (diff=7 not <7), so pure rotation: T1, T2, T3, T1
    expect(picked).toEqual(["T1", "T2", "T3", "T1"]);
  });
  it("dedup blocks recent topics within 7 days", () => {
    const assigned: { date: string; topic: string }[] = [];
    const topics = ["T1", "T2", "T3"];
    // 3x-week posts: Jan 5, 7, 9, 12, 14
    const dates = ["2026-01-05", "2026-01-07", "2026-01-09", "2026-01-12", "2026-01-14"];
    const picked = dates.map((d, i) => {
      const t = pickTopicForDate(topics, d, assigned, i);
      assigned.push({ date: d, topic: t });
      return t;
    });
    // Jan 5: T1 (recent empty, startIdx 0)
    // Jan 7: T1 recent (diff 2), candidate T2 → T2
    // Jan 9: T1+T2 recent, candidate T3 → T3
    // Jan 12: T1 diff 7 (not recent), T2 diff 5, T3 diff 3, candidate T1 → T1
    // Jan 14: T1 diff 2 (recent), T2 diff 7 (not recent), T3 diff 5, candidate T2 → T2
    expect(picked).toEqual(["T1", "T2", "T3", "T1", "T2"]);
  });
  it("falls back to round-robin when all topics recent", () => {
    const assigned: { date: string; topic: string }[] = [];
    const topics = ["T1", "T2"];
    // 3x-week: Jan 5, 7, 9
    const dates = ["2026-01-05", "2026-01-07", "2026-01-09"];
    const picked = dates.map((d, i) => {
      const t = pickTopicForDate(topics, d, assigned, i);
      assigned.push({ date: d, topic: t });
      return t;
    });
    // Jan 5: T1 (recent empty)
    // Jan 7: T1 recent, candidate T2 → T2
    // Jan 9: both T1+T2 recent, fallback to startIdx=0 → T1
    expect(picked).toEqual(["T1", "T2", "T1"]);
  });
});

describe("content-calendar-planner generateCalendar", () => {
  const inputs: CalendarInputs = {
    year: 2026,
    month: 1,
    topics: ["T1", "T2", "T3"],
    channels: ["Blog", "YouTube"],
    contentTypeMix: parseContentMix("blog:3, video:2"),
    postingFrequency: "weekly",
    keywords: ["kw1", "kw2"],
  };

  it("generates 4 posts for weekly Jan 2026", () => {
    const posts = generateCalendar(inputs);
    expect(posts).toHaveLength(4);
  });
  it("assigns correct dates", () => {
    const posts = generateCalendar(inputs);
    expect(posts.map((p) => p.date)).toEqual([
      "2026-01-05", "2026-01-12", "2026-01-19", "2026-01-26",
    ]);
  });
  it("assigns day-of-week names", () => {
    const posts = generateCalendar(inputs);
    expect(posts.every((p) => p.dayOfWeek === "Mon")).toBe(true);
  });
  it("rotates topics T1/T2/T3/T1", () => {
    const posts = generateCalendar(inputs);
    expect(posts.map((p) => p.topic)).toEqual(["T1", "T2", "T3", "T1"]);
  });
  it("rotates channels Blog/YouTube alternately", () => {
    const posts = generateCalendar(inputs);
    expect(posts.map((p) => p.channel)).toEqual(["Blog", "YouTube", "Blog", "YouTube"]);
  });
  it("assigns content type by weighted round-robin", () => {
    const posts = generateCalendar(inputs);
    // expanded = [blog, blog, blog, video, video]
    expect(posts.map((p) => p.contentType)).toEqual(["blog", "blog", "blog", "video"]);
  });
  it("assigns keywords by rotation", () => {
    const posts = generateCalendar(inputs);
    expect(posts.map((p) => p.keyword)).toEqual(["kw1", "kw2", "kw1", "kw2"]);
  });
  it("handles empty pools gracefully", () => {
    const posts = generateCalendar({
      ...inputs,
      topics: [],
      channels: [],
      contentTypeMix: new Map(),
      keywords: [],
    });
    expect(posts).toHaveLength(4);
    expect(posts[0].topic).toBe("");
    expect(posts[0].channel).toBe("");
    expect(posts[0].contentType).toBe("");
    expect(posts[0].keyword).toBe("");
  });
});

describe("content-calendar-planner detectConflicts", () => {
  it("returns no conflicts when topics are well-spaced", () => {
    const inputs: CalendarInputs = {
      year: 2026, month: 1,
      topics: ["T1", "T2", "T3"],
      channels: ["Blog"],
      contentTypeMix: parseContentMix("blog:1"),
      postingFrequency: "weekly",
      keywords: [],
    };
    const posts = generateCalendar(inputs);
    expect(detectConflicts(posts)).toEqual([]);
  });
  it("detects conflicts when topics repeat within 7 days", () => {
    const inputs: CalendarInputs = {
      year: 2026, month: 1,
      topics: ["T1", "T2"], // only 2 topics, 3x-week → fallback conflicts
      channels: ["Blog"],
      contentTypeMix: parseContentMix("blog:1"),
      postingFrequency: "3x-week",
      keywords: [],
    };
    const posts = generateCalendar(inputs);
    const conflicts = detectConflicts(posts);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].topic).toBe("T1");
    expect(conflicts[0].daysApart).toBeLessThan(7);
  });
  it("ignores posts without topics", () => {
    const posts = [
      { date: "2026-01-05", dayOfWeek: "Mon", dayNumber: 5, topic: "", channel: "Blog", contentType: "blog", keyword: "" },
    ];
    expect(detectConflicts(posts)).toEqual([]);
  });
});

describe("content-calendar-planner generateIcs", () => {
  it("produces valid iCalendar structure", () => {
    const posts = generateCalendar({
      year: 2026, month: 1,
      topics: ["T1"], channels: ["Blog"],
      contentTypeMix: parseContentMix("blog:1"),
      postingFrequency: "weekly",
      keywords: [],
    });
    const ics = generateIcs(posts, "My Calendar");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("X-WR-CALNAME:My Calendar");
  });
  it("emits one VEVENT per post", () => {
    const posts = generateCalendar({
      year: 2026, month: 1,
      topics: ["T1"], channels: ["Blog"],
      contentTypeMix: parseContentMix("blog:1"),
      postingFrequency: "weekly",
      keywords: [],
    });
    const ics = generateIcs(posts);
    const veventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
    expect(veventCount).toBe(posts.length);
    expect(ics).toContain("DTSTART;VALUE=DATE:20260105");
    expect(ics).toContain("SUMMARY:T1 — Blog/blog");
  });
  it("uses CRLF line endings", () => {
    const ics = generateIcs([]);
    expect(ics.includes("\r\n")).toBe(true);
    expect(ics.includes("\n")).toBe(true);
  });
  it("escapes commas in text fields", () => {
    const post = {
      date: "2026-01-05", dayOfWeek: "Mon", dayNumber: 5,
      topic: "Topic, with comma", channel: "Blog",
      contentType: "blog", keyword: "kw, with comma",
    };
    const ics = generateIcs([post]);
    expect(ics).toContain("Topic\\, with comma");
    expect(ics).toContain("kw\\, with comma");
  });
});

describe("content-calendar-planner renderText", () => {
  it("renders header and one row per post", () => {
    const posts = generateCalendar({
      year: 2026, month: 1,
      topics: ["T1"], channels: ["Blog"],
      contentTypeMix: parseContentMix("blog:1"),
      postingFrequency: "weekly",
      keywords: ["kw1"],
    });
    const text = renderText(posts);
    const lines = text.split("\n");
    expect(lines[0]).toContain("Date");
    expect(lines[0]).toContain("Topic");
    expect(lines[0]).toContain("Channel");
    // header + separator + 4 post rows = 6 lines
    expect(lines).toHaveLength(6);
    expect(text).toContain("2026-01-05");
  });
  it("returns empty for empty input", () => {
    expect(renderText([])).toBe("");
  });
});

describe("content-calendar-planner renderCsv", () => {
  it("renders header", () => {
    expect(renderCsv([])).toBe("date,day,topic,channel,content_type,keyword");
  });
  it("renders one row per post", () => {
    const posts = generateCalendar({
      year: 2026, month: 1,
      topics: ["T1"], channels: ["Blog"],
      contentTypeMix: parseContentMix("blog:1"),
      postingFrequency: "weekly",
      keywords: ["kw1"],
    });
    const csv = renderCsv(posts);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(5); // header + 4 posts
    expect(lines[1]).toContain("2026-01-05");
    expect(lines[1]).toContain("T1");
    expect(lines[1]).toContain("Blog");
  });
  it("escapes commas in topic", () => {
    const post = {
      date: "2026-01-05", dayOfWeek: "Mon", dayNumber: 5,
      topic: "Topic, with comma", channel: "Blog",
      contentType: "blog", keyword: "",
    };
    const csv = renderCsv([post]);
    expect(csv).toContain('"Topic, with comma"');
  });
});

describe("content-calendar-planner splitCsvRow", () => {
  it("splits simple", () => { expect(splitCsvRow("a,b,c")).toEqual(["a", "b", "c"]); });
  it("handles quoted commas", () => { expect(splitCsvRow('"a,b",c')).toEqual(["a,b", "c"]); });
  it("handles escaped quotes", () => {
    expect(splitCsvRow('"a""b",c')).toEqual(['a"b', "c"]);
  });
});

describe("content-calendar-planner computeSummaryStats", () => {
  it("computes stats for a calendar", () => {
    const posts = generateCalendar({
      year: 2026, month: 1,
      topics: ["T1", "T2", "T3"],
      channels: ["Blog", "YouTube"],
      contentTypeMix: parseContentMix("blog:3, video:2"),
      postingFrequency: "weekly",
      keywords: ["kw1", "kw2"],
    });
    const stats = computeSummaryStats(posts);
    expect(stats.totalPosts).toBe(4);
    expect(stats.byChannel["Blog"]).toBe(2);
    expect(stats.byChannel["YouTube"]).toBe(2);
    expect(stats.byContentType["blog"]).toBe(3);
    expect(stats.byContentType["video"]).toBe(1);
    expect(stats.uniqueTopics).toBe(3);
    expect(stats.uniqueKeywords).toBe(2);
  });
  it("returns zeros for empty input", () => {
    const stats = computeSummaryStats([]);
    expect(stats.totalPosts).toBe(0);
    expect(stats.uniqueTopics).toBe(0);
  });
});

describe("content-calendar-planner filterByChannel", () => {
  const posts = generateCalendar({
    year: 2026, month: 1,
    topics: ["T1", "T2", "T3"],
    channels: ["Blog", "YouTube"],
    contentTypeMix: parseContentMix("blog:1"),
    postingFrequency: "weekly",
    keywords: [],
  });
  it("returns all posts when channel is empty", () => {
    expect(filterByChannel(posts, "")).toHaveLength(4);
  });
  it("filters to a specific channel", () => {
    expect(filterByChannel(posts, "Blog")).toHaveLength(2);
    expect(filterByChannel(posts, "YouTube")).toHaveLength(2);
  });
  it("returns empty for unknown channel", () => {
    expect(filterByChannel(posts, "Podcast")).toHaveLength(0);
  });
});

describe("content-calendar-planner history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, year: 2026, month: 1, frequency: "weekly", totalPosts: 4 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, year: 2026, month: 1, frequency: "weekly", totalPosts: i });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, year: 2026, month: 1, frequency: "weekly", totalPosts: 4 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("content-calendar-planner shareable URL", () => {
  const shareInputs = {
    year: 2026,
    month: 1,
    topics: "Topic A\nTopic B",
    channels: "Blog, YouTube",
    contentTypeMix: "blog:3, video:2",
    postingFrequency: "weekly" as PostingFrequency,
    keywords: "kw1\nkw2",
  };

  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(shareInputs);
    expect(url).toContain("year=2026");
    expect(url).toContain("month=1");
    expect(url).toContain("freq=weekly");
    expect(url).toContain("mix=blog");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("round-trips through parseShareUrl", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(shareInputs);
    const hash = url.startsWith("?") ? url.slice(1) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed.year).toBe(2026);
    expect(parsed.month).toBe(1);
    expect(parsed.postingFrequency).toBe("weekly");
    expect(parsed.topics).toContain("Topic A");
    expect(parsed.channels).toContain("Blog");
    expect(parsed.contentTypeMix).toContain("blog:3");
    expect(parsed.keywords).toContain("kw1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("handles empty hash with defaults", () => {
    const parsed = parseShareUrl("");
    expect(parsed.topics).toBe("");
    expect(parsed.postingFrequency).toBe("weekly");
    expect(parsed.channels).toBe("");
  });
  it("falls back to weekly for invalid frequency", () => {
    const parsed = parseShareUrl("year=2026&month=1&freq=invalid");
    expect(parsed.postingFrequency).toBe("weekly");
  });
  it("falls back to current month for invalid month", () => {
    const parsed = parseShareUrl("year=2026&month=99&freq=weekly");
    const now = new Date();
    expect(parsed.month).toBe(now.getUTCMonth() + 1);
  });
});

// Suppress unused-import lint
export type _Unused = PostingFrequency | CalendarInputs;
