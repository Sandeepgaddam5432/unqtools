import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  BOT_PATTERNS,
  BOT_LABELS,
  parseTimestamp,
  parseLogLine,
  parseLogs,
  detectBot,
  classifyStatus,
  computeStatusDistribution,
  computeStatusCounts,
  computeBotStats,
  computeUrlCrawlStats,
  computeResponseTimeStats,
  findGooglebot404s,
  summarize,
  filterEntries,
  renderTextReport,
  renderCsv,
  formatBytes,
  formatMicros,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type LogEntry,
  type BotFamily,
  type LogFilter,
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

const GOOGLEBOT_UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const BINGBOT_UA = "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)";
const YANDEX_UA = "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)";
const HUMAN_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

function makeLine(opts: {
  ip?: string;
  ts?: string;
  method?: string;
  path?: string;
  status?: number;
  bytes?: number | "-";
  referer?: string;
  ua?: string;
  trailing?: string;
}): string {
  const ip = opts.ip ?? "66.249.66.1";
  const ts = opts.ts ?? "10/Jul/2025:13:55:36 +0000";
  const method = opts.method ?? "GET";
  const path = opts.path ?? "/blog/seo-guide";
  const protocol = "HTTP/1.1";
  const status = opts.status ?? 200;
  const bytes = opts.bytes ?? 8456;
  const referer = opts.referer ?? "-";
  const ua = opts.ua ?? GOOGLEBOT_UA;
  let line = `${ip} - - [${ts}] "${method} ${path} ${protocol}" ${status} ${bytes} "${referer}" "${ua}"`;
  if (opts.trailing !== undefined) line += ` ${opts.trailing}`;
  return line;
}

describe("log-file-analyzer constants", () => {
  it("has 8 bot patterns", () => {
    expect(BOT_PATTERNS).toHaveLength(8);
  });
  it("has 10 bot family labels", () => {
    expect(Object.keys(BOT_LABELS)).toHaveLength(10);
  });
  it("exposes HISTORY_KEY + HISTORY_MAX", () => {
    expect(HISTORY_KEY).toBe("unqtools:log-file-analyzer:history");
    expect(HISTORY_MAX).toBe(20);
  });
  it("bot patterns include googlebot, bingbot, yandex, baidu, duckduckgo, ahrefs, semrush, apple", () => {
    const families = BOT_PATTERNS.map((p) => p.family);
    expect(families).toEqual([
      "googlebot", "bingbot", "yandex", "baidu",
      "duckduckgo", "ahrefs", "semrush", "apple",
    ]);
  });
});

describe("log-file-analyzer parseTimestamp", () => {
  it("parses a CLF timestamp to ISO", () => {
    expect(parseTimestamp("10/Jul/2025:13:55:36 +0000")).toBe("2025-07-10T13:55:36+00:00");
  });
  it("handles missing timezone (defaults to +00:00)", () => {
    expect(parseTimestamp("01/Jan/2024:00:00:00")).toBe("2024-01-01T00:00:00+00:00");
  });
  it("returns raw input if format does not match", () => {
    expect(parseTimestamp("garbage")).toBe("garbage");
  });
  it("returns empty string for empty input", () => {
    expect(parseTimestamp("")).toBe("");
  });
  it("handles negative timezone offset", () => {
    expect(parseTimestamp("15/Mar/2025:08:00:00 -0500")).toBe("2025-03-15T08:00:00-05:00");
  });
});

describe("log-file-analyzer parseLogLine", () => {
  it("parses a combined log line", () => {
    const line = makeLine({ path: "/blog/seo-guide", status: 200, ua: GOOGLEBOT_UA });
    const entry = parseLogLine(line, 1);
    expect(entry).not.toBeNull();
    expect(entry!.ip).toBe("66.249.66.1");
    expect(entry!.method).toBe("GET");
    expect(entry!.path).toBe("/blog/seo-guide");
    expect(entry!.protocol).toBe("HTTP/1.1");
    expect(entry!.status).toBe(200);
    expect(entry!.bytes).toBe(8456);
    expect(entry!.botFamily).toBe("googlebot");
    expect(entry!.timestamp).toBe("2025-07-10T13:55:36+00:00");
  });
  it("parses a 404 line", () => {
    const line = makeLine({ path: "/missing", status: 404, bytes: 1230 });
    const entry = parseLogLine(line);
    expect(entry!.status).toBe(404);
    expect(entry!.bytes).toBe(1230);
  });
  it("parses a line with bytes='-' as 0", () => {
    const line = makeLine({ bytes: "-" });
    const entry = parseLogLine(line);
    expect(entry!.bytes).toBe(0);
  });
  it("parses a line with response time (trailing microseconds)", () => {
    const line = makeLine({ trailing: "12345" });
    const entry = parseLogLine(line);
    expect(entry!.responseTimeMicros).toBe(12345);
  });
  it("returns null for empty line", () => {
    expect(parseLogLine("")).toBeNull();
  });
  it("returns null for comment line", () => {
    expect(parseLogLine("# this is a comment")).toBeNull();
  });
  it("returns null for garbage", () => {
    expect(parseLogLine("totally not a log line")).toBeNull();
  });
  it("handles request with no protocol (e.g. just \"-\")", () => {
    const line = `${makeLine({})}`.replace('"GET /blog/seo-guide HTTP/1.1"', '"-"');
    const entry = parseLogLine(line);
    expect(entry).not.toBeNull();
    expect(entry!.method).toBe("");
  });
  it("handles request with method + path but no protocol", () => {
    const line = makeLine({}).replace(" HTTP/1.1", "");
    const entry = parseLogLine(line);
    expect(entry).not.toBeNull();
    expect(entry!.method).toBe("GET");
    expect(entry!.path).toBe("/blog/seo-guide");
    expect(entry!.protocol).toBe("");
  });
});

describe("log-file-analyzer parseLogs", () => {
  it("parses multiple lines", () => {
    const input = [
      makeLine({ path: "/a", status: 200 }),
      makeLine({ path: "/b", status: 404, ua: GOOGLEBOT_UA }),
      makeLine({ path: "/c", status: 500, ua: BINGBOT_UA }),
    ].join("\n");
    const parsed = parseLogs(input);
    expect(parsed.entries).toHaveLength(3);
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.totalLines).toBe(3);
  });
  it("collects parse errors", () => {
    const input = [
      makeLine({ path: "/a" }),
      "garbage line",
      makeLine({ path: "/b" }),
    ].join("\n");
    const parsed = parseLogs(input);
    expect(parsed.entries).toHaveLength(2);
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors[0].line).toBe(2);
  });
  it("skips blank and comment lines", () => {
    const input = [
      "# comment",
      "",
      makeLine({ path: "/a" }),
      "",
    ].join("\n");
    const parsed = parseLogs(input);
    expect(parsed.entries).toHaveLength(1);
  });
  it("handles empty input", () => {
    const parsed = parseLogs("");
    expect(parsed.entries).toEqual([]);
    expect(parsed.errors).toEqual([]);
    expect(parsed.totalLines).toBe(0);
  });
  it("handles Windows-style CRLF line endings", () => {
    const input = makeLine({ path: "/a" }) + "\r\n" + makeLine({ path: "/b" });
    const parsed = parseLogs(input);
    expect(parsed.entries).toHaveLength(2);
  });
});

describe("log-file-analyzer detectBot", () => {
  it("detects googlebot", () => {
    expect(detectBot(GOOGLEBOT_UA).family).toBe("googlebot");
  });
  it("detects googlebot-image sub-type", () => {
    const ua = "Googlebot-Image/1.0";
    expect(detectBot(ua)).toEqual({ family: "googlebot", subType: "Googlebot-Image" });
  });
  it("detects googlebot-news sub-type", () => {
    const ua = "Mozilla/5.0 (compatible; Googlebot-News)";
    expect(detectBot(ua).subType).toBe("Googlebot-News");
  });
  it("detects googlebot-video sub-type", () => {
    const ua = "Googlebot-Video/1.0";
    expect(detectBot(ua).subType).toBe("Googlebot-Video");
  });
  it("detects adsbot-google sub-type", () => {
    const ua = "AdsBot-Google (+http://www.google.com/adsbot.html)";
    expect(detectBot(ua)).toEqual({ family: "googlebot", subType: "AdsBot-Google" });
  });
  it("detects mediapartners-google sub-type", () => {
    const ua = "Mediapartners-Google";
    expect(detectBot(ua)).toEqual({ family: "googlebot", subType: "Mediapartners-Google" });
  });
  it("detects bingbot", () => {
    expect(detectBot(BINGBOT_UA).family).toBe("bingbot");
  });
  it("detects yandex", () => {
    expect(detectBot(YANDEX_UA).family).toBe("yandex");
  });
  it("detects baidu", () => {
    expect(detectBot("Baiduspider+(+http://www.baidu.com)").family).toBe("baidu");
  });
  it("detects duckduckgo", () => {
    expect(detectBot("DuckDuckBot/1.0; (+http://duckduckgo.com/)").family).toBe("duckduckgo");
  });
  it("detects ahrefs", () => {
    expect(detectBot("Mozilla/5.0 (compatible; AhrefsBot/7.0)").family).toBe("ahrefs");
  });
  it("detects semrush", () => {
    expect(detectBot("Mozilla/5.0 (compatible; SemrushBot/7~bl)").family).toBe("semrush");
  });
  it("detects apple", () => {
    expect(detectBot("Mozilla/5.0 (compatible; Applebot/0.1)").family).toBe("apple");
  });
  it("classifies generic crawler as 'other'", () => {
    expect(detectBot("Mozilla/5.0 (compatible; SomeCrawler/1.0)").family).toBe("other");
  });
  it("classifies human ua as 'human'", () => {
    expect(detectBot(HUMAN_UA).family).toBe("human");
  });
  it("empty UA returns human", () => {
    expect(detectBot("")).toEqual({ family: "human" });
  });
});

describe("log-file-analyzer classifyStatus", () => {
  it("classifies 2xx", () => {
    expect(classifyStatus(200)).toBe("2xx");
    expect(classifyStatus(204)).toBe("2xx");
  });
  it("classifies 3xx", () => {
    expect(classifyStatus(301)).toBe("3xx");
    expect(classifyStatus(304)).toBe("3xx");
  });
  it("classifies 4xx", () => {
    expect(classifyStatus(404)).toBe("4xx");
    expect(classifyStatus(410)).toBe("4xx");
  });
  it("classifies 5xx", () => {
    expect(classifyStatus(500)).toBe("5xx");
    expect(classifyStatus(503)).toBe("5xx");
  });
  it("classifies weird codes as other", () => {
    expect(classifyStatus(100)).toBe("other");
    expect(classifyStatus(999)).toBe("other");
  });
});

describe("log-file-analyzer computeStatusDistribution", () => {
  it("computes distribution", () => {
    const entries = [
      { status: 200, botFamily: "googlebot" } as unknown as LogEntry,
      { status: 200, botFamily: "googlebot" } as unknown as LogEntry,
      { status: 404, botFamily: "googlebot" } as unknown as LogEntry,
      { status: 500, botFamily: "human" } as unknown as LogEntry,
      { status: 301, botFamily: "human" } as unknown as LogEntry,
    ];
    const dist = computeStatusDistribution(entries);
    expect(dist["2xx"]).toBe(2);
    expect(dist["3xx"]).toBe(1);
    expect(dist["4xx"]).toBe(1);
    expect(dist["5xx"]).toBe(1);
    expect(dist.other).toBe(0);
  });
  it("returns all zeros for empty input", () => {
    const dist = computeStatusDistribution([]);
    expect(Object.values(dist).every((v) => v === 0)).toBe(true);
  });
});

describe("log-file-analyzer computeStatusCounts", () => {
  it("counts status frequency", () => {
    const entries = [
      { status: 200 } as LogEntry,
      { status: 200 } as LogEntry,
      { status: 404 } as LogEntry,
    ];
    const counts = computeStatusCounts(entries);
    expect(counts[200]).toBe(2);
    expect(counts[404]).toBe(1);
  });
});

describe("log-file-analyzer computeBotStats", () => {
  it("counts bots and sorts descending", () => {
    const entries: LogEntry[] = [
      { botFamily: "googlebot" } as LogEntry,
      { botFamily: "googlebot" } as LogEntry,
      { botFamily: "bingbot" } as LogEntry,
      { botFamily: "human" } as LogEntry,
    ];
    const stats = computeBotStats(entries);
    expect(stats[0].family).toBe("googlebot");
    expect(stats[0].hits).toBe(2);
    expect(stats[0].percent).toBe(50);
    expect(stats.find((s) => s.family === "bingbot")!.hits).toBe(1);
  });
  it("returns empty for empty input", () => {
    expect(computeBotStats([])).toEqual([]);
  });
});

describe("log-file-analyzer computeUrlCrawlStats", () => {
  it("counts per-URL hits and sorts by hits desc", () => {
    const entries: LogEntry[] = [
      { path: "/a", status: 200, botFamily: "googlebot" } as LogEntry,
      { path: "/a", status: 200, botFamily: "googlebot" } as LogEntry,
      { path: "/a", status: 404, botFamily: "googlebot" } as LogEntry,
      { path: "/b", status: 200, botFamily: "googlebot" } as LogEntry,
      { path: "/c", status: 200, botFamily: "human" } as LogEntry,
    ];
    const stats = computeUrlCrawlStats(entries);
    expect(stats).toHaveLength(3);
    expect(stats[0].url).toBe("/a");
    expect(stats[0].hits).toBe(3);
    expect(stats[0].statuses[200]).toBe(2);
    expect(stats[0].statuses[404]).toBe(1);
    expect(stats[0].lastStatus).toBe(404);
  });
  it("filters by bot family", () => {
    const entries: LogEntry[] = [
      { path: "/a", status: 200, botFamily: "googlebot" } as LogEntry,
      { path: "/b", status: 200, botFamily: "human" } as LogEntry,
    ];
    const stats = computeUrlCrawlStats(entries, "googlebot");
    expect(stats).toHaveLength(1);
    expect(stats[0].url).toBe("/a");
  });
});

describe("log-file-analyzer computeResponseTimeStats", () => {
  it("computes stats when times present", () => {
    const entries: LogEntry[] = [
      { responseTimeMicros: 1000 } as LogEntry,
      { responseTimeMicros: 2000 } as LogEntry,
      { responseTimeMicros: 3000 } as LogEntry,
      { responseTimeMicros: 4000 } as LogEntry,
      { responseTimeMicros: 5000 } as LogEntry,
    ];
    const stats = computeResponseTimeStats(entries)!;
    expect(stats.count).toBe(5);
    expect(stats.min).toBe(1000);
    expect(stats.max).toBe(5000);
    expect(stats.avg).toBe(3000);
    expect(stats.p95).toBeGreaterThanOrEqual(4000);
  });
  it("returns undefined when no times present", () => {
    const entries: LogEntry[] = [
      { status: 200 } as LogEntry,
      { status: 404 } as LogEntry,
    ];
    expect(computeResponseTimeStats(entries)).toBeUndefined();
  });
  it("ignores zero/undefined times", () => {
    const entries: LogEntry[] = [
      { responseTimeMicros: 5000 } as LogEntry,
      { responseTimeMicros: undefined } as LogEntry,
      { responseTimeMicros: 0 } as LogEntry,
    ];
    const stats = computeResponseTimeStats(entries)!;
    expect(stats.count).toBe(1);
  });
});

describe("log-file-analyzer findGooglebot404s", () => {
  it("finds URLs that Googlebot hit with 404", () => {
    const entries: LogEntry[] = [
      { path: "/missing1", status: 404, botFamily: "googlebot" } as LogEntry,
      { path: "/missing1", status: 404, botFamily: "googlebot" } as LogEntry,
      { path: "/missing2", status: 404, botFamily: "googlebot" } as LogEntry,
      { path: "/ok", status: 200, botFamily: "googlebot" } as LogEntry,
      { path: "/missing3", status: 404, botFamily: "bingbot" } as LogEntry,
    ];
    const list = findGooglebot404s(entries);
    expect(list).toHaveLength(2);
    expect(list[0].url).toBe("/missing1");
    expect(list[0].hits).toBe(2);
  });
});

describe("log-file-analyzer summarize", () => {
  it("produces a complete summary", () => {
    const entries: LogEntry[] = [
      { path: "/a", status: 200, botFamily: "googlebot", responseTimeMicros: 1000 } as LogEntry,
      { path: "/a", status: 404, botFamily: "googlebot", responseTimeMicros: 2000 } as LogEntry,
      { path: "/b", status: 200, botFamily: "human" } as LogEntry,
    ];
    const summary = summarize(entries);
    expect(summary.totalRequests).toBe(3);
    expect(summary.googlebotHits).toBe(2);
    expect(summary.botHits).toBe(2);
    expect(summary.humanHits).toBe(1);
    expect(summary.uniqueUrls).toBe(2);
    expect(summary.botPercent).toBe(66.7);
    expect(summary.statusDistribution["2xx"]).toBe(2);
    expect(summary.statusDistribution["4xx"]).toBe(1);
    expect(summary.googlebot404s).toBe(1);
    expect(summary.responseTimes).toBeDefined();
    expect(summary.responseTimes!.count).toBe(2);
    expect(summary.topBots[0].family).toBe("googlebot");
    expect(summary.topCrawledUrls[0].url).toBe("/a");
    expect(summary.notFoundUrls[0].url).toBe("/a");
  });
  it("handles empty entries", () => {
    const summary = summarize([]);
    expect(summary.totalRequests).toBe(0);
    expect(summary.botPercent).toBe(0);
    expect(summary.topCrawledUrls).toEqual([]);
  });
  it("counts parse errors when provided", () => {
    const summary = summarize([], [{ line: 1, raw: "x", message: "bad" }]);
    expect(summary.parseErrors).toBe(1);
  });
});

describe("log-file-analyzer filterEntries", () => {
  const entries: LogEntry[] = [
    { botFamily: "googlebot" } as LogEntry,
    { botFamily: "bingbot" } as LogEntry,
    { botFamily: "human" } as LogEntry,
  ];
  it("returns all for 'all'", () => {
    expect(filterEntries(entries, "all")).toHaveLength(3);
  });
  it("returns googlebot only for 'googlebot'", () => {
    expect(filterEntries(entries, "googlebot")).toHaveLength(1);
  });
  it("returns all bots for 'bots-only'", () => {
    expect(filterEntries(entries, "bots-only")).toHaveLength(2);
  });
  it("returns specific bot family", () => {
    expect(filterEntries(entries, "bingbot")).toHaveLength(1);
  });
});

describe("log-file-analyzer renderTextReport", () => {
  it("renders report with summary stats", () => {
    const summary = summarize([
      { path: "/a", status: 200, botFamily: "googlebot" } as LogEntry,
      { path: "/missing", status: 404, botFamily: "googlebot" } as LogEntry,
    ]);
    const txt = renderTextReport(summary);
    expect(txt).toContain("Server Log Analysis Report");
    expect(txt).toContain("Total requests: 2");
    expect(txt).toContain("Googlebot hits: 2");
    expect(txt).toContain("Googlebot 404s (1 unique)");
    expect(txt).toContain("/missing");
  });
  it("renders empty report for empty summary", () => {
    const txt = renderTextReport(summarize([]));
    expect(txt).toContain("Total requests: 0");
  });
  it("includes response time section when present", () => {
    const summary = summarize([
      { path: "/a", status: 200, botFamily: "googlebot", responseTimeMicros: 5000 } as LogEntry,
    ]);
    const txt = renderTextReport(summary);
    expect(txt).toContain("Response time stats");
    expect(txt).toContain("5.00 ms");
  });
});

describe("log-file-analyzer renderCsv", () => {
  it("renders header only for empty summary", () => {
    const csv = renderCsv(summarize([]));
    expect(csv).toBe("url,hits,last_status,primary_bot,family");
  });
  it("renders rows for crawled urls", () => {
    const summary = summarize([
      { path: "/a", status: 200, botFamily: "googlebot" } as LogEntry,
      { path: "/a", status: 200, botFamily: "googlebot" } as LogEntry,
    ]);
    const csv = renderCsv(summary);
    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toContain("/a,2,200,googlebot,googlebot");
  });
});

describe("log-file-analyzer formatBytes / formatMicros", () => {
  it("formatBytes handles B/KB/MB", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1024)).toBe("1.00 KB");
    expect(formatBytes(1048576)).toBe("1.00 MB");
  });
  it("formatBytes returns - for invalid", () => {
    expect(formatBytes(-1)).toBe("-");
  });
  it("formatMicros handles µs/ms/s", () => {
    expect(formatMicros(500)).toBe("500 µs");
    expect(formatMicros(1500)).toBe("1.50 ms");
    expect(formatMicros(1500000)).toBe("1.50 s");
  });
});

describe("log-file-analyzer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, totalRequests: 100, googlebotHits: 50,
      notFoundUrls: 3, uniqueUrls: 30, botPercent: 75,
    });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].totalRequests).toBe(100);
  });
  it("caps at HISTORY_MAX (20)", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, totalRequests: i, googlebotHits: 0,
        notFoundUrls: 0, uniqueUrls: 0, botPercent: 0,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, totalRequests: 1, googlebotHits: 0,
      notFoundUrls: 0, uniqueUrls: 0, botPercent: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("log-file-analyzer shareable URL", () => {
  it("builds share URL with summary stats", () => {
    const summary = summarize([
      { path: "/a", status: 200, botFamily: "googlebot" } as LogEntry,
      { path: "/b", status: 404, botFamily: "googlebot" } as LogEntry,
      { path: "/c", status: 301, botFamily: "human" } as LogEntry,
    ]);
    const url = buildShareUrl(summary);
    expect(url).toContain("total=3");
    expect(url).toContain("gb=2");
    expect(url).toContain("g404=1");
    expect(url).toContain("s2=1");
    expect(url).toContain("s4=1");
  });
  it("parses share URL back", () => {
    const summary = summarize([
      { path: "/a", status: 200, botFamily: "googlebot" } as LogEntry,
    ]);
    const url = buildShareUrl(summary);
    // Pull just the hash part
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const parsed = parseShareUrl(hash);
    expect(parsed).not.toBeNull();
    expect(parsed!.totalRequests).toBe(1);
    expect(parsed!.googlebotHits).toBe(1);
    expect(parsed!.statusDistribution["2xx"]).toBe(1);
  });
  it("returns null for empty hash", () => {
    expect(parseShareUrl("")).toBeNull();
  });
  it("returns null for invalid hash (no total)", () => {
    expect(parseShareUrl("foo=bar")).toBeNull();
  });
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const summary = summarize([
      { path: "/a", status: 200, botFamily: "googlebot" } as LogEntry,
    ]);
    const url = buildShareUrl(summary);
    expect(url.startsWith("?")).toBe(true);
    (globalThis as Record<string, unknown>).window = origWindow;
  });
});

// Suppress unused-import lint for type-only imports
export type _Unused = BotFamily | LogFilter;
