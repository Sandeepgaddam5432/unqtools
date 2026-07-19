import { describe, it, expect, beforeEach } from "vitest";
import {
  TIMELINE_PRESETS,
  RAINBOW_PALETTE,
  MONO_PALETTE,
  CATEGORY_PALETTE,
  parseDate,
  formatDateLabel,
  splitPipe,
  parseEvents,
  sortEvents,
  groupByCategory,
  getCategories,
  generateColorPalette,
  getColorForCategory,
  formatImportance,
  renderAscii,
  renderAsciiHorizontal,
  renderHtml,
  renderMarkdown,
  renderCsv,
  computeSpans,
  computeStats,
  searchEvents,
  computeEra,
  getPreset,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ColorScheme,
  type SortDirection,
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

describe("history-timeline-maker constants", () => {
  it("has 4 presets", () => {
    expect(TIMELINE_PRESETS).toHaveLength(4);
  });
  it("presets have expected ids", () => {
    const ids = TIMELINE_PRESETS.map((p) => p.id);
    expect(ids).toContain("world-war-2");
    expect(ids).toContain("american-revolution");
    expect(ids).toContain("ancient-egypt");
    expect(ids).toContain("renaissance");
  });
  it("each preset has events", () => {
    for (const p of TIMELINE_PRESETS) {
      expect(p.events.length).toBeGreaterThan(0);
      expect(p.title.length).toBeGreaterThan(0);
    }
  });
  it("has 3 color palettes with entries", () => {
    expect(RAINBOW_PALETTE.length).toBeGreaterThanOrEqual(5);
    expect(MONO_PALETTE.length).toBeGreaterThanOrEqual(3);
    expect(CATEGORY_PALETTE.length).toBeGreaterThanOrEqual(5);
  });
});

describe("history-timeline-maker parseDate", () => {
  it("parses bare year", () => {
    const d = parseDate("1945");
    expect(d).not.toBeNull();
    expect(d!.year).toBe(1945);
    expect(d!.month).toBeNull();
    expect(d!.day).toBeNull();
    expect(d!.isBC).toBe(false);
  });
  it("parses year-month", () => {
    const d = parseDate("1945-08");
    expect(d).not.toBeNull();
    expect(d!.year).toBe(1945);
    expect(d!.month).toBe(8);
    expect(d!.day).toBeNull();
  });
  it("parses full date", () => {
    const d = parseDate("1945-08-06");
    expect(d).not.toBeNull();
    expect(d!.year).toBe(1945);
    expect(d!.month).toBe(8);
    expect(d!.day).toBe(6);
  });
  it("parses BC year", () => {
    const d = parseDate("44 BC");
    expect(d).not.toBeNull();
    expect(d!.year).toBe(44);
    expect(d!.isBC).toBe(true);
    expect(d!.sortKey).toBeLessThan(0);
  });
  it("parses BCE", () => {
    const d = parseDate("3100 BCE");
    expect(d).not.toBeNull();
    expect(d!.year).toBe(3100);
    expect(d!.isBC).toBe(true);
  });
  it("parses AD explicit", () => {
    const d = parseDate("1500 AD");
    expect(d).not.toBeNull();
    expect(d!.year).toBe(1500);
    expect(d!.isBC).toBe(false);
  });
  it("parses CE explicit", () => {
    const d = parseDate("1500 CE");
    expect(d).not.toBeNull();
    expect(d!.year).toBe(1500);
  });
  it("returns null for invalid month", () => {
    expect(parseDate("1945-13")).toBeNull();
  });
  it("returns null for invalid day", () => {
    expect(parseDate("1945-08-32")).toBeNull();
  });
  it("returns null for garbage", () => {
    expect(parseDate("hello")).toBeNull();
    expect(parseDate("")).toBeNull();
  });
  it("sorts BC before AD (100 BC < 44 BC < 1 AD < 1945)", () => {
    const a = parseDate("100 BC")!;
    const b = parseDate("44 BC")!;
    const c = parseDate("1 AD")!;
    const d = parseDate("1945")!;
    expect(a.sortKey).toBeLessThan(b.sortKey);
    expect(b.sortKey).toBeLessThan(c.sortKey);
    expect(c.sortKey).toBeLessThan(d.sortKey);
  });
});

describe("history-timeline-maker formatDateLabel", () => {
  it("formats full date", () => {
    const d = parseDate("1945-08-06")!;
    expect(formatDateLabel(d, "1945-08-06")).toBe("6 Aug 1945");
  });
  it("formats year-month", () => {
    const d = parseDate("1945-08")!;
    expect(formatDateLabel(d, "1945-08")).toBe("Aug 1945");
  });
  it("formats BC", () => {
    const d = parseDate("44 BC")!;
    expect(formatDateLabel(d, "44 BC")).toBe("44 BC");
  });
  it("formats bare year from original", () => {
    const d = parseDate("1945")!;
    expect(formatDateLabel(d, "1945")).toBe("1945");
  });
});

describe("history-timeline-maker splitPipe", () => {
  it("splits simple pipe-delimited", () => {
    expect(splitPipe("a|b|c")).toEqual(["a", "b", "c"]);
  });
  it("respects quoted pipes", () => {
    expect(splitPipe('a|"b|c"|d')).toEqual(["a", "b|c", "d"]);
  });
  it("handles escaped quotes inside quoted field", () => {
    expect(splitPipe('a|"say ""hi"""|c')).toEqual(["a", 'say "hi"', "c"]);
  });
  it("handles empty fields", () => {
    expect(splitPipe("a||c")).toEqual(["a", "", "c"]);
  });
});

describe("history-timeline-maker parseEvents", () => {
  it("parses valid events", () => {
    const events = parseEvents("1945-08-06|Hiroshima|US drops bomb|Military|5");
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Hiroshima");
    expect(events[0].year).toBe(1945);
    expect(events[0].importance).toBe(5);
    expect(events[0].category).toBe("Military");
  });
  it("parses multiple events", () => {
    const input = "1939|WWII begins|Germany invades Poland|Military|5\n1945|VE Day|Germany surrenders|Military|4";
    const events = parseEvents(input);
    expect(events).toHaveLength(2);
  });
  it("skips comment lines starting with #", () => {
    const input = "# comment\n1945|VE Day|Germany surrenders|Military|5";
    expect(parseEvents(input)).toHaveLength(1);
  });
  it("skips blank lines", () => {
    const input = "\n\n1945|VE Day|desc|Military|5\n\n";
    expect(parseEvents(input)).toHaveLength(1);
  });
  it("skips lines with invalid dates", () => {
    const input = "garbage|Some Title|desc|Cat|3\n1945|VE Day|desc|Military|5";
    expect(parseEvents(input)).toHaveLength(1);
  });
  it("skips lines with fewer than 2 fields", () => {
    const input = "1945\n1945|VE Day|desc|Military|5";
    expect(parseEvents(input)).toHaveLength(1);
  });
  it("defaults category and importance when omitted", () => {
    const e = parseEvents("1945|VE Day")[0];
    expect(e.category).toBe("General");
    expect(e.importance).toBe(3);
  });
  it("clamps importance to 1-5", () => {
    const e1 = parseEvents("1945|T|d|c|0")[0];
    expect(e1.importance).toBe(1);
    const e2 = parseEvents("1945|T|d|c|99")[0];
    expect(e2.importance).toBe(5);
  });
  it("handles quoted descriptions with pipe", () => {
    const e = parseEvents('1945|Title|"Description | with pipe"|Cat|3')[0];
    expect(e.description).toBe("Description | with pipe");
  });
  it("handles BC dates", () => {
    const e = parseEvents("44 BC|Caesar assassinated|Ides of March|Political|5")[0];
    expect(e).toBeDefined();
    expect(e.isBC).toBe(true);
    expect(e.year).toBe(44);
  });
});

describe("history-timeline-maker sortEvents", () => {
  it("sorts chronologically", () => {
    const events = parseEvents("1945|B|d|c|3\n1939|A|d|c|3");
    const sorted = sortEvents(events, "chronological");
    expect(sorted[0].title).toBe("A");
    expect(sorted[1].title).toBe("B");
  });
  it("sorts reverse-chronologically", () => {
    const events = parseEvents("1939|A|d|c|3\n1945|B|d|c|3");
    const sorted = sortEvents(events, "reverse-chronological");
    expect(sorted[0].title).toBe("B");
    expect(sorted[1].title).toBe("A");
  });
  it("sorts BC before AD", () => {
    const events = parseEvents("1945|Modern|d|c|3\n44 BC|Ancient|d|c|3");
    const sorted = sortEvents(events, "chronological");
    expect(sorted[0].title).toBe("Ancient");
    expect(sorted[1].title).toBe("Modern");
  });
  it("sorts higher BC year before lower BC year", () => {
    const events = parseEvents("44 BC|Lower|d|c|3\n100 BC|Higher|d|c|3");
    const sorted = sortEvents(events, "chronological");
    expect(sorted[0].title).toBe("Higher");
    expect(sorted[1].title).toBe("Lower");
  });
  it("does not mutate original", () => {
    const events = parseEvents("1945|B|d|c|3\n1939|A|d|c|3");
    const sorted = sortEvents(events, "chronological");
    expect(events[0].title).toBe("B");
    expect(sorted[0].title).toBe("A");
  });
});

describe("history-timeline-maker groupByCategory", () => {
  it("groups events by category", () => {
    const events = parseEvents([
      "1945|A|d|Military|3",
      "1946|B|d|Politics|3",
      "1947|C|d|Military|3",
    ].join("\n"));
    const groups = groupByCategory(events);
    expect(groups.size).toBe(2);
    expect(groups.get("Military")).toHaveLength(2);
    expect(groups.get("Politics")).toHaveLength(1);
  });
  it("returns empty map for empty input", () => {
    expect(groupByCategory([]).size).toBe(0);
  });
});

describe("history-timeline-maker getCategories", () => {
  it("returns unique sorted categories", () => {
    const events = parseEvents([
      "1945|A|d|Zulu|3",
      "1946|B|d|Alpha|3",
      "1947|C|d|Zulu|3",
    ].join("\n"));
    expect(getCategories(events)).toEqual(["Alpha", "Zulu"]);
  });
});

describe("history-timeline-maker colorPalette", () => {
  it("generates rainbow palette", () => {
    const p = generateColorPalette(["A", "B", "C"], "rainbow");
    expect(p.A).toBe(RAINBOW_PALETTE[0]);
    expect(p.B).toBe(RAINBOW_PALETTE[1]);
  });
  it("generates mono palette", () => {
    const p = generateColorPalette(["A", "B"], "mono");
    expect(p.A).toBe(MONO_PALETTE[0]);
    expect(p.B).toBe(MONO_PALETTE[1]);
  });
  it("generates category palette", () => {
    const p = generateColorPalette(["A"], "category");
    expect(p.A).toBe(CATEGORY_PALETTE[0]);
  });
  it("wraps around for many categories", () => {
    const cats = Array.from({ length: RAINBOW_PALETTE.length + 3 }, (_, i) => `C${i}`);
    const p = generateColorPalette(cats, "rainbow");
    expect(p.C0).toBe(p[cats[RAINBOW_PALETTE.length]]);
  });
  it("getColorForCategory falls back to gray for unknown", () => {
    expect(getColorForCategory("X", {})).toBe("#888888");
  });
});

describe("history-timeline-maker formatImportance", () => {
  it("formats 1 star", () => {
    expect(formatImportance(1)).toBe("★☆☆☆☆");
  });
  it("formats 3 stars", () => {
    expect(formatImportance(3)).toBe("★★★☆☆");
  });
  it("formats 5 stars", () => {
    expect(formatImportance(5)).toBe("★★★★★");
  });
  it("clamps out-of-range", () => {
    expect(formatImportance(0)).toBe("★☆☆☆☆");
    expect(formatImportance(99)).toBe("★★★★★");
  });
});

describe("history-timeline-maker renderAscii", () => {
  it("renders events", () => {
    const events = parseEvents("1945-08-06|Hiroshima|US drops bomb|Military|5");
    const ascii = renderAscii(events);
    expect(ascii).toContain("●");
    expect(ascii).toContain("Hiroshima");
    expect(ascii).toContain("★★★★★");
    expect(ascii).toContain("category: Military");
  });
  it("includes description", () => {
    const events = parseEvents("1945|VE Day|Germany surrenders|Military|4");
    expect(renderAscii(events)).toContain("Germany surrenders");
  });
  it("returns placeholder for empty", () => {
    expect(renderAscii([])).toBe("(no events)");
  });
});

describe("history-timeline-maker renderAsciiHorizontal", () => {
  it("renders horizontal markers", () => {
    const events = parseEvents("1939|A|d|c|3\n1945|B|d|c|3");
    const out = renderAsciiHorizontal(events);
    expect(out).toContain("●");
    expect(out).toContain("[1939]");
    expect(out).toContain("[1945]");
  });
});

describe("history-timeline-maker renderHtml", () => {
  it("renders valid HTML document", () => {
    const events = parseEvents("1945|VE Day|Germany surrenders|Military|5");
    const html = renderHtml(events, {}, "My Timeline");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<title>My Timeline</title>");
    expect(html).toContain("VE Day");
    expect(html).toContain("class=\"timeline\"");
  });
  it("escapes HTML in content", () => {
    const events = parseEvents("1945|<script>|desc|Cat|3");
    const html = renderHtml(events);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});

describe("history-timeline-maker renderMarkdown", () => {
  it("renders markdown with title and events", () => {
    const events = parseEvents("1945|VE Day|Germany surrenders|Military|5");
    const md = renderMarkdown(events, "My Timeline");
    expect(md).toContain("# My Timeline");
    expect(md).toContain("## 1945 — VE Day");
    expect(md).toContain("Germany surrenders");
    expect(md).toContain("*Category: Military*");
  });
  it("handles empty input", () => {
    const md = renderMarkdown([], "Empty");
    expect(md).toContain("# Empty");
    expect(md).toContain("_(no events)_");
  });
});

describe("history-timeline-maker renderCsv", () => {
  it("renders header", () => {
    expect(renderCsv([])).toContain("date,title,description,category,importance");
  });
  it("renders rows", () => {
    const events = parseEvents("1945|VE Day|Germany surrenders|Military|5");
    const csv = renderCsv(events);
    expect(csv).toContain("1945,VE Day,Germany surrenders,Military,5");
  });
  it("escapes commas in fields", () => {
    const events = parseEvents("1945|Hello, World|desc|Cat|3");
    const csv = renderCsv(events);
    expect(csv).toContain('"Hello, World"');
  });
});

describe("history-timeline-maker computeSpans", () => {
  it("computes spans between consecutive events", () => {
    const events = parseEvents([
      "1939-09-01|A|d|c|3",
      "1945-09-02|B|d|c|3",
    ].join("\n"));
    const spans = computeSpans(events);
    expect(spans).toHaveLength(1);
    expect(spans[0].days).toBeGreaterThan(2000);
    expect(spans[0].years).toBeGreaterThan(5);
  });
  it("returns empty for single event", () => {
    const events = parseEvents("1945|A|d|c|3");
    expect(computeSpans(events)).toEqual([]);
  });
  it("returns empty for no events", () => {
    expect(computeSpans([])).toEqual([]);
  });
});

describe("history-timeline-maker computeStats", () => {
  it("computes stats", () => {
    const events = parseEvents([
      "1939|A|d|Military|3",
      "1945|B|d|Politics|3",
      "1942|C|d|Military|3",
    ].join("\n"));
    const stats = computeStats(events);
    expect(stats.totalEvents).toBe(3);
    expect(stats.earliestDate).toBe("1939");
    expect(stats.latestDate).toBe("1945");
    expect(stats.spanYears).toBe(6);
    expect(stats.byCategory.Military).toBe(2);
    expect(stats.byCategory.Politics).toBe(1);
  });
  it("returns empty stats for empty input", () => {
    const stats = computeStats([]);
    expect(stats.totalEvents).toBe(0);
    expect(stats.spanYears).toBe(0);
  });
});

describe("history-timeline-maker searchEvents", () => {
  it("matches title", () => {
    const events = parseEvents([
      "1945|VE Day|desc|Military|3",
      "1945|VJ Day|desc|Military|3",
    ].join("\n"));
    expect(searchEvents(events, "VE")).toHaveLength(1);
  });
  it("matches description", () => {
    const events = parseEvents([
      "1945|Title|Germany surrenders|Military|3",
    ].join("\n"));
    expect(searchEvents(events, "surrenders")).toHaveLength(1);
  });
  it("matches category", () => {
    const events = parseEvents([
      "1945|Title|desc|Military|3",
      "1946|Title2|desc|Politics|3",
    ].join("\n"));
    expect(searchEvents(events, "military")).toHaveLength(1);
  });
  it("returns all when query empty", () => {
    const events = parseEvents("1945|Title|desc|Military|3");
    expect(searchEvents(events, "")).toHaveLength(1);
  });
  it("returns empty when no match", () => {
    const events = parseEvents("1945|Title|desc|Military|3");
    expect(searchEvents(events, "xyz")).toEqual([]);
  });
});

describe("history-timeline-maker computeEra", () => {
  it("1945 → Modern Era", () => {
    expect(computeEra(1945, false)).toContain("Modern Era");
    expect(computeEra(1945, false)).toContain("20");
  });
  it("1500 → Renaissance", () => {
    expect(computeEra(1500, false)).toContain("Renaissance");
  });
  it("800 → Middle Ages", () => {
    expect(computeEra(800, false)).toContain("Middle Ages");
  });
  it("200 → Classical Antiquity", () => {
    expect(computeEra(200, false)).toContain("Classical Antiquity");
  });
  it("44 BC → Classical Antiquity BC", () => {
    expect(computeEra(44, true)).toContain("Classical");
  });
  it("3100 BC → Early Bronze Age", () => {
    expect(computeEra(3100, true)).toContain("Bronze");
  });
});

describe("history-timeline-maker getPreset", () => {
  it("finds preset by id", () => {
    const p = getPreset("world-war-2");
    expect(p).toBeDefined();
    expect(p!.title).toBe("World War II");
  });
  it("returns undefined for unknown id", () => {
    expect(getPreset("nonexistent")).toBeUndefined();
  });
});

describe("history-timeline-maker history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, title: "WWII", eventCount: 10, dateRange: "1939–1945" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, title: `T${i}`, eventCount: 1, dateRange: "1939" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, title: "T", eventCount: 1, dateRange: "1939" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("history-timeline-maker shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      title: "WWII",
      events: "1945|VE Day|d|c|5",
      sortDirection: "chronological",
      groupByCategory: false,
      colorScheme: "category",
    });
    expect(url).toContain("title=WWII");
    expect(url).toContain("dir=chronological");
    expect(url).toContain("scheme=category");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("encodes group flag when set", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      title: "T",
      events: "1945|A|d|c|5",
      sortDirection: "reverse-chronological",
      groupByCategory: true,
      colorScheme: "rainbow",
    });
    expect(url).toContain("group=1");
    expect(url).toContain("scheme=rainbow");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("title=WWII&events=1945%7CVE%20Day&dir=reverse-chronological&group=1&scheme=rainbow");
    expect(p.title).toBe("WWII");
    expect(p.events).toContain("VE Day");
    expect(p.sortDirection).toBe("reverse-chronological");
    expect(p.groupByCategory).toBe(true);
    expect(p.colorScheme).toBe("rainbow");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters invalid sort direction", () => {
    const p = parseShareUrl("dir=invalid");
    expect(p.sortDirection).toBe("chronological");
  });
  it("filters invalid color scheme", () => {
    const p = parseShareUrl("scheme=invalid");
    expect(p.colorScheme).toBe("category");
  });
});

// Suppress unused-import lint
export type _Unused = ColorScheme | SortDirection;
